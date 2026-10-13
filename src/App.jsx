import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutGrid, ArrowUpRight, ArrowDownLeft, Wallet, Users, Truck, RefreshCw, Plus, Search,
  Home, Loader2, Receipt, TrendingUp, Menu, BarChart3, BadgeDollarSign, FileText, PackageCheck, X, Cloud, CloudOff, HardDrive, AlertTriangle, Monitor,
} from "lucide-react";

import { AppCtx, CAIXA_META, CAMBIO_PADRAO, caixaDoPagamento, precoDe, DIAS_SEM_PEDIDO, ehDeFornecedor, custoComissao, precoFoiAlterado } from "./contexto.js";
import { fmtDateLong, fmtHora, todayISO, uid, normalizar as norm, somarMeses, diasAtras } from "./lib/format.js";
import { FornecedorDetalheModal, ImportarProdutosModal, AcertoModal } from "./fornecedores.jsx";
import { PagarComissaoModal, ContaClienteModal, DevolucaoModal, RelatorioPage } from "./financeiro.jsx";
import { backupDoDia, obterBackup } from "./lib/backup.js";
import * as db from "./lib/db.js";
import { lerDadosAntigosDoNavegador, normalizar } from "./lib/migracao.js";
import { btnPrimario } from "./ui.jsx";
import {
  VisaoGeral, EstoquePage, VendasPage, MaisVendidosPage, ComprasPage, CaixaPage, ContasPage, PessoasPage, CambioPage, VendedoresPage,
} from "./paginas.jsx";
import { OrcamentosPage, FretePage, OrcamentoModal, OrcamentoDetalheModal, FreteiroModal } from "./frete.jsx";
import {
  VendaModal, CompraModal, MovimentoModal, ItemModal, PessoaModal, CambioModal, ContaModal, PagarContaModal,
  ReceberVendaModal, DadosModal, VendedorModal, ListaPrecosModal, AgendarContatoModal, EnviarProdutoModal,
} from "./modais.jsx";



const NAV = [
  { key: "visao", label: "Visão geral", icon: Home },
  { key: "estoque", label: "Estoque", icon: LayoutGrid },
  { key: "orcamentos", label: "Orçamentos", icon: FileText },
  { key: "vendas", label: "Vendas", icon: ArrowUpRight },
  { key: "frete", label: "Frete", icon: PackageCheck },
  { key: "maisVendidos", label: "Mais vendidos", icon: TrendingUp },
  { key: "compras", label: "Compras", icon: ArrowDownLeft },
  { key: "caixa", label: "Caixa", icon: Wallet },
  { key: "contas", label: "Contas a pagar", icon: Receipt },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "vendedores", label: "Vendedores", icon: BadgeDollarSign },
  { key: "fornecedores", label: "Fornecedores", icon: Truck },
  { key: "relatorio", label: "Relatório do mês", icon: BarChart3 },
  { key: "cambio", label: "Câmbio", icon: RefreshCw },
];

const VERSAO_DEMO = "10";
// Na demonstração dá para ver o sistema como um vendedor o veria.
const lerVerComo = () => {
  try { return JSON.parse(localStorage.getItem("indufarma-ver-como") || "null"); } catch (e) { return null; }
};
const lerVersaoDemo = () => {
  try { return localStorage.getItem("indufarma-demo"); } catch (e) { return null; }
};

// Carrega o banco uma única vez, mesmo que o React monte o componente duas vezes.
let carregamento = null;
function carregarBanco() {
  return (carregamento ||= (async () => {
    let { vazio } = await db.abrir();
    // A demonstração recomeça com os exemplos novos quando eles mudam.
    if (import.meta.env.VITE_DEMO && lerVersaoDemo() !== VERSAO_DEMO) {
      await db.limpar();
      vazio = true;
      try { localStorage.setItem("indufarma-demo", VERSAO_DEMO); } catch (e) { /* opcional */ }
    }
    if (vazio) {
      const antigos = lerDadosAntigosDoNavegador();
      if (antigos) await db.importar(normalizar(antigos));
      else if (import.meta.env.VITE_DEMO) {
        const demo = await import("./lib/demo.js");
        await db.importar(demo.dadosDemo());
        await demo.fotosDemo().catch((e) => console.warn("Fotos de exemplo", e));
      }
    }
  })());
}

export default function IndufarmaApp() {
  const [page, setPage] = useState("visao");
  const [menuAberto, setMenuAberto] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [erroCarregar, setErroCarregar] = useState(null);
  const [sync, setSync] = useState(db.status());
  const [busca, setBusca] = useState("");
  const [instalar, setInstalar] = useState(null);

  // estoqueBase guarda a quantidade contada na última conferência (baseEm);
  // a quantidade atual é calculada somando compras e subtraindo vendas feitas depois.
  // Assim, vendas feitas nos dois computadores ao mesmo tempo nunca se perdem.
  const [estoqueBase, setEstoqueBase] = useState([]);
  const [vendasTodas, setVendas] = useState([]);
  const [comprasTodas, setCompras] = useState([]);
  const [clientesTodos, setClientes] = useState([]);
  const [fornecedoresTodos, setFornecedores] = useState([]);
  const [movimentosTodos, setMovimentos] = useState([]);
  const [cambio, setCambio] = useState(CAMBIO_PADRAO);
  const [contasTodas, setContas] = useState([]);
  const [vendedoresTodos, setVendedores] = useState([]);
  const [orcamentosTodos, setOrcamentos] = useState([]);
  const [freteiros, setFreteiros] = useState([]);

  const [modal, setModal] = useState(null);
  const [editando, setEditando] = useState(null);

  // "voltar": ao fechar, reabre a janela de onde veio (ex.: produto aberto dentro do fornecedor).
  const [voltarPara, setVoltarPara] = useState(null);
  const abrirModal = useCallback((nome, item = null, voltar = null) => {
    setVoltarPara(voltar);
    setEditando(item);
    setModal(nome);
  }, []);
  const fecharModal = useCallback(() => {
    setVoltarPara((v) => {
      setModal(v ? v.modal : null);
      setEditando(v ? v.item : null);
      return null;
    });
  }, []);

  const lerCambio = () => {
    const c = db.listar("config").find((x) => x.id === "cambio");
    if (c) return c;
    db.semear("config", CAMBIO_PADRAO);
    return CAMBIO_PADRAO;
  };

  const recarregarTudo = useCallback(() => {
    setEstoqueBase(db.listar("estoque"));
    setVendas(db.listar("vendas"));
    setCompras(db.listar("compras"));
    setClientes(db.listar("clientes"));
    setFornecedores(db.listar("fornecedores"));
    setMovimentos(db.listar("movimentos"));
    setContas(db.listar("contas"));
    setVendedores(db.listar("vendedores"));
    setOrcamentos(db.listar("orcamentos"));
    setFreteiros(db.listar("freteiros"));
    setCambio(lerCambio());
  }, []);

  // ---- carrega do banco local ----
  useEffect(() => {
    let vivo = true;
    carregarBanco()
      .then(() => {
        if (!vivo) return;
        recarregarTudo();
        setLoaded(true);
      })
      .catch((e) => {
        console.error(e);
        if (vivo) setErroCarregar("Não foi possível abrir os dados deste computador.");
      });
    const parar = db.ouvirStatus(setSync);
    return () => {
      vivo = false;
      parar();
    };
  }, [recarregarTudo]);

  // ---- mudanças vindas do outro computador ----
  useEffect(() => {
    const setters = {
      estoque: setEstoqueBase, vendas: setVendas, compras: setCompras, clientes: setClientes,
      fornecedores: setFornecedores, movimentos: setMovimentos, contas: setContas, vendedores: setVendedores, orcamentos: setOrcamentos, freteiros: setFreteiros,
    };
    db.aoApagarLocal(recarregarTudo);
    db.aoReceberDaNuvem((cols) => {
      cols.forEach((col) => {
        if (col === "config") {
          setCambio((prev) => {
            db.gravar("config", [prev]);
            return lerCambio();
          });
        } else if (setters[col]) {
          // Grava antes o que ainda não foi gravado, depois lê a versão combinada.
          setters[col]((prev) => {
            db.gravar(col, prev);
            return db.listar(col);
          });
        }
      });
    });
  }, [recarregarTudo]);

  // ---- grava no banco local a cada mudança ----
  useEffect(() => { if (loaded) db.gravar("estoque", estoqueBase); }, [estoqueBase, loaded]);
  useEffect(() => { if (loaded) db.gravar("vendas", vendasTodas); }, [vendasTodas, loaded]);
  useEffect(() => { if (loaded) db.gravar("compras", comprasTodas); }, [comprasTodas, loaded]);
  useEffect(() => { if (loaded) db.gravar("clientes", clientesTodos); }, [clientesTodos, loaded]);
  useEffect(() => { if (loaded) db.gravar("fornecedores", fornecedoresTodos); }, [fornecedoresTodos, loaded]);
  useEffect(() => { if (loaded) db.gravar("movimentos", movimentosTodos); }, [movimentosTodos, loaded]);
  useEffect(() => { if (loaded) db.gravar("contas", contasTodas); }, [contasTodas, loaded]);
  useEffect(() => { if (loaded) db.gravar("vendedores", vendedoresTodos); }, [vendedoresTodos, loaded]);
  useEffect(() => { if (loaded) db.gravar("orcamentos", orcamentosTodos); }, [orcamentosTodos, loaded]);
  useEffect(() => { if (loaded) db.gravar("freteiros", freteiros); }, [freteiros, loaded]);
  useEffect(() => { if (loaded) db.gravar("config", [cambio]); }, [cambio, loaded]);

  // ---- botão "Instalar no computador" ----
  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      setInstalar(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", () => setInstalar(null));
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // ---- valores calculados ----
  const estoqueReal = useMemo(() => {
    const base = new Map(estoqueBase.map((i) => [i.id, i]));
    const delta = {};
    for (const c of comprasTodas) {
      for (const l of c.itens || []) {
        const it = l.itemId && base.get(l.itemId);
        if (it && (c.ts || 0) > (it.baseEm || 0)) delta[it.id] = (delta[it.id] || 0) + Number(l.qtd || 0);
      }
    }
    for (const v of vendasTodas) {
      for (const l of v.itens || []) {
        const it = l.itemId && base.get(l.itemId);
        if (it && (v.ts || 0) > (it.baseEm || 0)) delta[it.id] = (delta[it.id] || 0) - Number(l.qtd || 0);
      }
      // Devolução do cliente: o produto volta ao estoque.
      for (const d of v.devolucoes || []) {
        for (const x of d.itens || []) {
          const it = x.itemId && base.get(x.itemId);
          if (it && (d.ts || 0) > (it.baseEm || 0)) delta[it.id] = (delta[it.id] || 0) + Number(x.qtd || 0);
        }
      }
    }
    return [...estoqueBase]
      .map((i) => ({ ...i, qtd: Number(i.qtd || 0) + (delta[i.id] || 0) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [estoqueBase, comprasTodas, vendasTodas]);

  // ---- quem está usando ----
  // O dono vê tudo. O vendedor vê só os próprios clientes, vendas e orçamentos, o custo
  // que o dono definiu para vendedores, e não vê caixa, contas, compras nem fornecedores.
  // Na nuvem isso é garantido pelo servidor; aqui a tela só mostra o que pode.
  const [verComo, setVerComoEstado] = useState(() => (import.meta.env.VITE_DEMO ? lerVerComo() : null));
  const setVerComo = (v) => {
    setVerComoEstado(v);
    try { localStorage.setItem("indufarma-ver-como", JSON.stringify(v)); } catch (e) { /* opcional */ }
  };
  const acesso = verComo || (sync.papel === "vendedor" ? { papel: "vendedor", vendedorId: sync.vendedorId } : { papel: sync.papel === "sem_acesso" ? "sem_acesso" : "dono" });
  const ehVendedor = acesso.papel === "vendedor";
  const meuVendedorId = ehVendedor ? acesso.vendedorId : null;
  const doVendedor = useCallback((lista) => (ehVendedor ? lista.filter((x) => x.vendedorId === meuVendedorId) : lista), [ehVendedor, meuVendedorId]);
  const vendas = useMemo(() => doVendedor(vendasTodas), [doVendedor, vendasTodas]);
  const clientes = useMemo(() => doVendedor(clientesTodos), [doVendedor, clientesTodos]);
  const orcamentos = useMemo(() => doVendedor(orcamentosTodos), [doVendedor, orcamentosTodos]);
  const vendedores = useMemo(() => (ehVendedor ? vendedoresTodos.filter((v) => v.id === meuVendedorId) : vendedoresTodos), [ehVendedor, meuVendedorId, vendedoresTodos]);
  const nada = useMemo(() => [], []);
  const compras = ehVendedor ? nada : comprasTodas;
  const movimentos = ehVendedor ? nada : movimentosTodos;
  const contas = ehVendedor ? nada : contasTodas;
  const fornecedores = ehVendedor ? nada : fornecedoresTodos;
  const estoque = useMemo(
    () => (ehVendedor ? estoqueReal.map((i) => { const c = custoComissao(i); const { custo, ...resto } = i; return { ...resto, custo: c, custoVendedor: c }; }) : estoqueReal),
    [ehVendedor, estoqueReal]
  );

  const caixas = useMemo(() => {
    const s = { usdt: 0, dolar: 0, pix: 0, real: 0 };
    for (const m of movimentos) if (m.caixa in s) s[m.caixa] += m.tipo === "Entrada" ? m.valor : -m.valor;
    return s;
  }, [movimentos]);

  const hoje = todayISO();
  const vendasDoDia = useMemo(() => vendas.filter((v) => v.data === hoje), [vendas, hoje]);
  const vendasHoje = useMemo(() => vendasDoDia.reduce((s, v) => s + v.valor, 0), [vendasDoDia]);
  const vendasACobrar = useMemo(
    () => vendas.filter((v) => v.status === "Pendente").sort((a, b) => a.data.localeCompare(b.data)),
    [vendas]
  );
  const aReceber = useMemo(() => vendasACobrar.reduce((s, v) => s + v.valor, 0), [vendasACobrar]);
  const proprios = useMemo(() => estoque.filter((i) => !ehDeFornecedor(i)), [estoque]);
  const valorEstoque = useMemo(() => proprios.reduce((s, i) => s + Math.max(0, i.qtd) * i.custo, 0), [proprios]);
  const unidadesEstoque = useMemo(() => proprios.reduce((s, i) => s + Math.max(0, i.qtd), 0), [proprios]);
  const estoqueBaixo = useMemo(() => proprios.filter((i) => i.qtd <= i.min), [proprios]);
  const orcamentosParaAprovar = useMemo(() => orcamentos.filter((o) => o.status === "Aberto" && o.aprovacaoPreco === "Pendente"), [orcamentos]);
  // Lembretes de orçamento. Dono: os que o vendedor fez e ele ainda não abriu (e os que esperam
  // aprovação de preço). Vendedor: os que o dono aprovou ou recusou e ele ainda não abriu.
  const orcamentosDoVendedor = useMemo(
    () => (ehVendedor ? [] : orcamentos.filter((o) => o.status === "Aberto" && o.vendedorId && (o.vistoPeloDono === false || o.aprovacaoPreco === "Pendente"))),
    [orcamentos, ehVendedor]
  );
  const respostasDoDono = useMemo(
    () => (ehVendedor ? orcamentos.filter((o) => o.respostaVista === false && (o.aprovacaoPreco === "Aprovado" || o.aprovacaoPreco === "Recusado")) : []),
    [orcamentos, ehVendedor]
  );
  function marcarOrcamentoVisto(o) {
    if (ehVendedor && o.respostaVista === false) atualizarOrcamento(o.id, { respostaVista: true });
    if (!ehVendedor && o.vistoPeloDono === false) atualizarOrcamento(o.id, { vistoPeloDono: true });
  }
  const contasPendentes = useMemo(() => contas.filter((c) => c.status === "Pendente"), [contas]);
  const totalContasPendentes = useMemo(() => contasPendentes.reduce((s, c) => s + c.valor, 0), [contasPendentes]);
  const contasVencendo = useMemo(
    () => contasPendentes.filter((c) => c.vencimento <= hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [contasPendentes, hoje]
  );

  // Clientes para contatar hoje: os que têm retorno agendado para hoje (ou antes) e os que
  // já compraram, mas não fazem pedido há mais de DIAS_SEM_PEDIDO dias e não receberam
  // mensagem nesse período. Quem tem retorno agendado para o futuro fica de fora até lá.
  const clientesSemPedido = useMemo(() => {
    const limite = diasAtras(DIAS_SEM_PEDIDO);
    const ultima = {};
    for (const v of vendas) if (v.clienteId && (!ultima[v.clienteId] || v.data > ultima[v.clienteId])) ultima[v.clienteId] = v.data;
    const out = [];
    for (const c of clientes) {
      const ultimaCompra = ultima[c.id] || null;
      if (c.proximoContato) {
        if (c.proximoContato <= hoje) out.push({ ...c, ultimaCompra, motivo: "retorno" });
      } else if (ultimaCompra && ultimaCompra < limite && !(c.ultimoContato && c.ultimoContato >= limite)) {
        out.push({ ...c, ultimaCompra, motivo: "semPedido" });
      }
    }
    return out.sort((a, b) =>
      a.motivo !== b.motivo ? (a.motivo === "retorno" ? -1 : 1) : String(a.proximoContato || a.ultimaCompra).localeCompare(String(b.proximoContato || b.ultimaCompra))
    );
  }, [clientes, vendas, hoje]);

  // Vendas com frete que ainda não saíram, e orçamentos esperando resposta do freteiro.
  const entregasPendentes = useMemo(() => vendas.filter((v) => v.frete && v.frete.status === "A enviar"), [vendas]);
  const cotacoesAguardando = useMemo(
    () => orcamentos.filter((o) => o.status === "Aberto" && o.frete?.precisa && (o.frete.cotacoes || []).some((c) => c.status === "Aguardando")),
    [orcamentos]
  );

  // ---- ações ----
  // Depois de mandar mensagem, marca o contato e abre a tela para agendar o próximo.
  function registrarContato(clienteId) {
    const c = clientes.find((x) => x.id === clienteId);
    setClientes((cs) => cs.map((x) => (x.id === clienteId ? { ...x, ultimoContato: todayISO(), proximoContato: null, notaContato: "" } : x)));
    if (c) abrirModal("agendar", { ...c, ultimoContato: todayISO(), proximoContato: null, notaContato: "" });
  }

  function agendarContato(clienteId, data, nota) {
    setClientes((cs) => cs.map((x) => (x.id === clienteId ? { ...x, proximoContato: data || null, notaContato: data ? nota : "" } : x)));
  }

  function addMovimento(caixaKey, tipo, valor, descricao, extra = {}) {
    setMovimentos((m) => [{ id: uid(), caixa: caixaKey, tipo, valor: Number(valor), descricao, data: todayISO(), ts: Date.now(), ...extra }, ...m]);
  }

  // Número da próxima venda/orçamento. O vendedor não vê os números dos outros, então os
  // dele levam as iniciais (ex.: LO-3) para nunca repetir.
  function proximoNumero(lista) {
    if (!ehVendedor) return lista.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1;
    const eu = vendedoresTodos.find((v) => v.id === meuVendedorId);
    const sigla = (eu?.nome || "V").split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 3).toUpperCase();
    const n = lista.reduce((m, x) => {
      const mt = String(x.numero || "").match(/^([A-Z]+)-(\d+)$/);
      return mt && mt[1] === sigla ? Math.max(m, Number(mt[2])) : m;
    }, 0);
    return `${sigla}-${n + 1}`;
  }

  // Devolve uma mensagem de erro, ou null se a venda foi registrada.
  function registrarVenda({ clienteId, vendedorId, itens, pagamento, condicao, frete = null, orcamentoId = null }) {
    if (!itens || itens.length === 0) return "Adicione pelo menos um produto.";
    if (ehVendedor) vendedorId = meuVendedorId;
    // Produtos avulsos (sem cadastro) e de fornecedor não passam pela conferência de estoque.
    const qtdPorItem = {};
    itens.forEach((l) => {
      if (l.itemId) qtdPorItem[l.itemId] = (qtdPorItem[l.itemId] || 0) + l.qtd;
    });
    for (const itemId in qtdPorItem) {
      const s = estoque.find((i) => i.id === itemId);
      if (!s) return "Um dos produtos não existe mais no estoque.";
      if (!ehDeFornecedor(s) && qtdPorItem[itemId] > s.qtd) return `Estoque insuficiente de ${s.nome} (${s.qtd} disponíveis).`;
    }
    const cliente = clientes.find((c) => c.id === clienteId);
    const vendedor = vendedoresTodos.find((x) => x.id === vendedorId);
    // Limite de crédito: o vendedor não passa do limite; o dono é avisado na tela e decide.
    if (ehVendedor && condicao === "A prazo" && cliente && Number(cliente.limiteCredito) > 0) {
      const totalNovo = itens.reduce((s, l) => s + Number(l.precoUnit ?? precoDe(estoque.find((i) => i.id === l.itemId), l.tipoVenda)) * l.qtd, 0) + (frete ? Number(frete.valor || 0) : 0);
      if (emAbertoDoCliente(cliente.id) + totalNovo > Number(cliente.limiteCredito) + 0.004)
        return "Esta venda a prazo passa do limite de crédito do cliente. Fale com o dono.";
    }
    const linhas = itens.map((l) => {
      const item = l.itemId ? estoque.find((i) => i.id === l.itemId) : null;
      // Venda vinda de orçamento mantém o preço combinado com o cliente.
      const precoUnit = l.precoUnit != null ? Number(l.precoUnit) : precoDe(item, l.tipoVenda);
      // Guarda o custo para vendedores do momento da venda, para a comissão não mudar depois.
      const custoVendedor = item ? custoComissao(item) : Number(l.custoVendedor) || 0;
      const linha = { itemId: l.itemId || null, itemNome: item ? item.nome : l.itemNome, qtd: l.qtd, tipoVenda: l.tipoVenda, precoUnit, subtotal: precoUnit * l.qtd, custoVendedor };
      // Custo real do momento (só o dono tem): usado no relatório do mês.
      if (item && !ehVendedor) linha.custoReal = Number(item.custo) || 0;
      if (!item) linha.avulso = true;
      else if (ehDeFornecedor(item)) Object.assign(linha, { fornecedorId: item.fornecedorId || "", fornecedorNome: item.fornecedorNome || "" });
      return linha;
    });
    const valorProdutos = linhas.reduce((s, l) => s + l.subtotal, 0);
    const valor = valorProdutos + (frete ? Number(frete.valor || 0) : 0);
    const numero = proximoNumero(vendasTodas.filter((v) => !ehVendedor || v.vendedorId === meuVendedorId));
    // Cliente que fez pedido não precisa mais do lembrete de retorno.
    if (cliente?.proximoContato) setClientes((cs) => cs.map((x) => (x.id === cliente.id ? { ...x, proximoContato: null, notaContato: "" } : x)));
    setVendas((v) => [
      {
        id: uid(), numero, clienteId, clienteNome: cliente ? cliente.nome : "Sem nome",
        vendedorId: vendedor ? vendedor.id : "", vendedorNome: vendedor ? vendedor.nome : "", itens: linhas, valor, valorProdutos, pagamento, condicao,
        frete: frete ? { ...frete, status: "A enviar" } : null, orcamentoId,
        // Venda do vendedor fica pendente: só o dono confirma que recebeu.
        status: condicao === "À vista" && !ehVendedor ? "Pago" : "Pendente", data: todayISO(), ts: Date.now(),
      },
      ...v,
    ]);
    if (condicao === "À vista" && !ehVendedor) addMovimento(caixaDoPagamento(pagamento), "Entrada", valor, `Venda #${numero}`, vendedor ? { vendedorId: vendedor.id } : {});
    return { numero };
  }

  // Quanto o cliente deve hoje (vendas a receber).
  function emAbertoDoCliente(clienteId) {
    return vendasTodas.filter((v) => v.clienteId === clienteId && v.status === "Pendente").reduce((s, v) => s + Number(v.valor || 0), 0);
  }

  // Devolução do cliente. Cada item: { linha, qtd }. Se a venda já foi paga, o dinheiro sai do
  // caixa; se ainda está a receber, o valor é abatido do que ele deve.
  function registrarDevolucao(vendaId, { itens, caixaKey, motivo }) {
    if (ehVendedor) return;
    const venda = vendasTodas.find((v) => v.id === vendaId);
    if (!venda) return;
    const linhas = itens.filter((x) => x.qtd > 0).map((x) => {
      const l = venda.itens[x.linha];
      return { linha: x.linha, itemId: l.itemId || null, nome: l.itemNome, qtd: x.qtd, valor: Math.round(Number(l.precoUnit) * x.qtd * 100) / 100 };
    });
    if (linhas.length === 0) return;
    const valor = linhas.reduce((s, l) => s + l.valor, 0);
    const pendente = venda.status === "Pendente";
    const dev = { id: uid(), data: todayISO(), ts: Date.now(), itens: linhas, valor, forma: pendente ? "abatido" : "dinheiro", caixa: pendente ? null : caixaKey, motivo: motivo || "" };
    setVendas((vs) => vs.map((v) => {
      if (v.id !== vendaId) return v;
      const novo = { ...v, devolucoes: [...(v.devolucoes || []), dev] };
      if (pendente) Object.assign(novo, { valor: Math.max(0, Number(v.valor) - valor), valorProdutos: Math.max(0, Number(v.valorProdutos ?? v.valor) - valor) });
      return novo;
    }));
    if (!pendente) addMovimento(caixaKey, "Saída", valor, `Devolução da venda #${venda.numero}`);
  }

  // Pagamento da comissão de um vendedor (mes = "2026-10").
  function pagarComissao(vendedorId, mes, valor, caixaKey) {
    if (ehVendedor || !(valor > 0)) return;
    const vd = vendedoresTodos.find((v) => v.id === vendedorId);
    if (!vd) return;
    setVendedores((d) => d.map((v) => (v.id === vendedorId ? { ...v, comissoesPagas: [...(v.comissoesPagas || []), { mes, valor, data: todayISO(), caixa: caixaKey }] } : v)));
    addMovimento(caixaKey, "Saída", valor, `Comissão ${vd.nome} (${mes.slice(5)}/${mes.slice(0, 4)})`);
  }

  function atualizarVenda(id, mudancas) {
    setVendas((vs) => vs.map((v) => (v.id === id ? { ...v, ...mudancas } : v)));
  }

  function atualizarEntrega(id, mudancas) {
    setVendas((vs) => vs.map((v) => (v.id === id && v.frete ? { ...v, frete: { ...v.frete, ...mudancas } } : v)));
  }

  // ---- orçamentos e frete ----
  function salvarOrcamento(dados, original) {
    // Preço diferente da tabela: se foi o vendedor, espera a aprovação do dono.
    const alterado = (dados.itens || []).some(precoFoiAlterado);
    dados = { ...dados, aprovacaoPreco: alterado ? (ehVendedor ? "Pendente" : "Aprovado") : null };
    // Orçamento feito ou mudado pelo vendedor aparece nos lembretes do dono até ele abrir.
    if (ehVendedor) dados.vistoPeloDono = false;
    if (original) {
      setOrcamentos((os) => os.map((o) => (o.id === original.id ? { ...o, ...dados } : o)));
      return original.id;
    }
    const id = uid();
    const numero = proximoNumero(orcamentosTodos.filter((o) => !ehVendedor || o.vendedorId === meuVendedorId));
    if (ehVendedor) {
      const eu = vendedoresTodos.find((v) => v.id === meuVendedorId);
      dados = { ...dados, vendedorId: meuVendedorId, vendedorNome: eu?.nome || "" };
    }
    setOrcamentos((os) => [{ id, numero, status: "Aberto", data: todayISO(), ts: Date.now(), ...dados }, ...os]);
    return id;
  }

  function atualizarOrcamento(id, mudancas) {
    setOrcamentos((os) => os.map((o) => (o.id === id ? { ...o, ...(typeof mudancas === "function" ? mudancas(o) : mudancas) } : o)));
  }

  // Dono aprova o preço do vendedor, ou recusa e o orçamento volta ao preço da tabela.
  function aprovarPrecoOrcamento(id, aprovar) {
    if (ehVendedor) return;
    atualizarOrcamento(id, (o) => {
      // A resposta aparece nos lembretes do vendedor até ele abrir o orçamento.
      if (aprovar) return { aprovacaoPreco: "Aprovado", precoAprovadoEm: todayISO(), vistoPeloDono: true, respostaVista: false };
      const itens = o.itens.map((l) => (precoFoiAlterado(l) ? { ...l, precoUnit: l.precoTabela, subtotal: l.precoTabela * l.qtd } : l));
      return { itens, total: itens.reduce((s, l) => s + l.subtotal, 0), aprovacaoPreco: "Recusado", precoRecusadoEm: todayISO(), vistoPeloDono: true, respostaVista: false };
    });
  }

  function excluirOrcamento(o) {
    if (!window.confirm(`Excluir o orçamento #${o.numero}?`)) return false;
    setOrcamentos((os) => os.filter((x) => x.id !== o.id));
    return true;
  }

  // Transforma o orçamento em venda, com o frete escolhido.
  function converterOrcamento(o, { pagamento, condicao }) {
    if (o.aprovacaoPreco === "Pendente") return "O preço foi alterado e ainda espera a aprovação do dono.";
    const cot = o.frete?.precisa ? (o.frete.cotacoes || []).find((c) => c.freteiroId === o.frete.escolhida) : null;
    if (o.frete?.precisa && !cot) return "Escolha uma das opções de frete antes de fechar a venda.";
    const frete = cot
      ? { freteiroId: cot.freteiroId, freteiroNome: cot.nome, valor: Number(cot.valor || 0), prazoDias: Number(cot.prazoDias || 0), endereco: o.frete.endereco, cidade: o.frete.cidade }
      : null;
    const r = registrarVenda({
      clienteId: o.clienteId, vendedorId: o.vendedorId, pagamento, condicao, frete, orcamentoId: o.id,
      itens: o.itens.map((l) => ({ itemId: l.itemId, itemNome: l.itemNome, qtd: l.qtd, tipoVenda: l.tipoVenda, precoUnit: l.precoUnit, custoVendedor: l.custoVendedor })),
    });
    if (typeof r === "string") return r;
    atualizarOrcamento(o.id, { status: "Aprovado", vendaNumero: r.numero, dataAprovacao: todayISO() });
    return null;
  }

  function salvarFreteiro(dados, original) {
    if (original) setFreteiros((d) => d.map((p) => (p.id === original.id ? { ...p, ...dados } : p)));
    else setFreteiros((d) => [...d, { id: uid(), ...dados }]);
  }

  function excluirFreteiro(f) {
    if (!window.confirm(`Excluir o freteiro "${f.nome}"?`)) return false;
    setFreteiros((d) => d.filter((x) => x.id !== f.id));
    return true;
  }

  // Compra de fornecedor. Condição:
  //   À vista     sai do caixa agora.
  //   A prazo     vira conta(s) a pagar, em parcelas mensais a partir do 1º vencimento.
  //   Consignado  entra no estoque sem pagar; no acerto paga o que vendeu e devolve o resto.
  function registrarCompra({ fornecedorId, itens, pagamento, condicao = "À vista", vencimento, parcelas = 1, dataAcerto }) {
    if (!itens || itens.length === 0) return;
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
    const nomeForn = fornecedor ? fornecedor.nome : "fornecedor";
    let base = estoqueBase;
    const linhas = itens.map((l) => {
      const existente = (l.itemId && base.find((i) => i.id === l.itemId)) || base.find((i) => norm(i.nome) === norm(l.nome));
      if (existente) {
        base = base.map((i) => (i.id === existente.id ? { ...i, custo: l.custo, ...(i.fornecedorId || !fornecedor ? {} : { fornecedorId, fornecedorNome: fornecedor.nome }) } : i));
        return { itemId: existente.id, nome: existente.nome, qtd: l.qtd, custo: l.custo, subtotal: l.custo * l.qtd };
      }
      const novo = {
        id: uid(), nome: l.nome, qtd: 0, baseEm: 0, custo: l.custo, varejo: l.varejo || l.custo * 1.3, atacado: l.atacado || l.custo * 1.15,
        lojista: l.lojista || l.atacado || l.custo * 1.1, min: 3, origem: "estoque", fornecedorId: fornecedorId || null, fornecedorNome: fornecedor?.nome || "",
      };
      base = [...base, novo];
      return { itemId: novo.id, nome: novo.nome, qtd: l.qtd, custo: l.custo, subtotal: l.custo * l.qtd };
    });
    setEstoqueBase(base);
    const total = linhas.reduce((s, l) => s + l.subtotal, 0);
    const id = uid();
    const consignado = condicao === "Consignado";
    const compra = {
      id, fornecedorId, fornecedorNome: fornecedor ? fornecedor.nome : "Sem nome", total, condicao, data: todayISO(), ts: Date.now(),
      itens: consignado ? linhas.map((l) => ({ ...l, pago: 0, devolvido: 0 })) : linhas,
      pagamento: condicao === "À vista" ? pagamento : null,
      ...(consignado ? { status: "Em consignação", dataAcerto: dataAcerto || null, acertos: [] } : {}),
      ...(condicao === "A prazo" ? { vencimento, parcelas } : {}),
    };
    setCompras((c) => [compra, ...c]);
    const descricao = `Compra de ${nomeForn} (${linhas.length} ${linhas.length === 1 ? "item" : "itens"})`;
    if (condicao === "À vista") addMovimento(caixaDoPagamento(pagamento), "Saída", total, descricao, { compraId: id });
    if (condicao === "A prazo") criarParcelas(`Compra de ${nomeForn}`, total, vencimento, parcelas, { compraId: id, fornecedorId });
  }

  function criarParcelas(nome, total, primeiroVencimento, parcelas, extra) {
    const qtd = Math.max(1, Math.floor(Number(parcelas) || 1));
    const valorParcela = Math.floor((total / qtd) * 100) / 100;
    const novas = Array.from({ length: qtd }, (_, i) => ({
      id: uid(), nome: qtd > 1 ? `${nome} (${i + 1}/${qtd})` : nome, categoria: "Fornecedor",
      valor: i === qtd - 1 ? Math.round((total - valorParcela * (qtd - 1)) * 100) / 100 : valorParcela,
      vencimento: somarMeses(primeiroVencimento || todayISO(), i), status: "Pendente", dataPagamento: null, ...extra,
    }));
    setContas((cs) => [...cs, ...novas]);
  }

  // Acerto do consignado: para cada item, quanto paga (o que vendeu) e quanto devolve.
  // O que sobra continua consignado para o próximo acerto.
  function acertarConsignado(compraId, { linhas, forma, caixaKey, vencimento }) {
    const compra = comprasTodas.find((c) => c.id === compraId);
    if (!compra) return;
    const itens = compra.itens.map((l, i) => {
      const a = linhas[i] || {};
      return { ...l, pago: Number(l.pago || 0) + Number(a.pagar || 0), devolvido: Number(l.devolvido || 0) + Number(a.devolver || 0) };
    });
    const valor = compra.itens.reduce((s, l, i) => s + Number(linhas[i]?.pagar || 0) * l.custo, 0);
    const devolvidos = compra.itens
      .map((l, i) => ({ l, q: Number(linhas[i]?.devolver || 0) }))
      .filter((x) => x.q > 0)
      .map(({ l, q }) => ({ itemId: l.itemId, nome: l.nome, qtd: -q, custo: l.custo, subtotal: -q * l.custo }));
    const fechado = itens.every((l) => l.pago + l.devolvido >= l.qtd);
    const acerto = { data: todayISO(), valor, forma: valor > 0 ? forma : null, devolvidos: devolvidos.reduce((s, l) => s - l.qtd, 0) };
    const agora = Date.now();
    setCompras((cs) => {
      const atualizadas = cs.map((c) => (c.id === compraId ? { ...c, itens, status: fechado ? "Acertado" : "Em consignação", acertos: [...(c.acertos || []), acerto] } : c));
      if (devolvidos.length === 0) return atualizadas;
      // A devolução tira os produtos do estoque.
      const devolucao = {
        id: uid(), fornecedorId: compra.fornecedorId, fornecedorNome: compra.fornecedorNome, condicao: "Devolução", compraOrigem: compraId,
        itens: devolvidos, total: devolvidos.reduce((s, l) => s + l.subtotal, 0), data: todayISO(), ts: agora,
      };
      return [devolucao, ...atualizadas];
    });
    if (valor > 0) {
      const nome = `Acerto consignado ${compra.fornecedorNome}`;
      if (forma === "prazo") criarParcelas(nome, valor, vencimento, 1, { compraId, fornecedorId: compra.fornecedorId });
      else addMovimento(caixaKey, "Saída", valor, nome, { compraId });
    }
  }

  // Cadastro em massa a partir da lista do fornecedor. Produto com o mesmo nome é atualizado.
  function importarProdutos(fornecedorId, linhas, origem) {
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
    let novos = 0, atualizados = 0;
    const out = [...estoqueBase];
    {
      for (const l of linhas) {
        const idx = out.findIndex((i) => norm(i.nome) === norm(l.nome));
        const campos = Object.fromEntries(Object.entries({
          custo: l.custo, varejo: l.varejo, atacado: l.atacado, lojista: l.lojista, custoVendedor: l.custoVendedor, marca: l.marca, tipo: l.tipo,
        }).filter(([, v]) => v !== undefined && v !== null && v !== ""));
        if (idx >= 0) {
          out[idx] = { ...out[idx], ...campos, fornecedorId, fornecedorNome: fornecedor?.nome || "" };
          atualizados++;
        } else {
          out.push({
            id: uid(), nome: l.nome, qtd: 0, baseEm: 0, min: origem === "fornecedor" ? 0 : 3, foto: null, marca: "", tipo: "",
            ...campos, origem, fornecedorId, fornecedorNome: fornecedor?.nome || "",
          });
          novos++;
        }
      }
    }
    setEstoqueBase(out);
    return { novos, atualizados };
  }

  function salvarItem(dados, original) {
    if (original) {
      const atual = estoque.find((i) => i.id === original.id);
      setEstoqueBase((e) =>
        e.map((x) => {
          if (x.id !== original.id) return x;
          const { qtd, ...campos } = dados;
          const novo = { ...x, ...campos };
          // Só reinicia a contagem se a quantidade foi alterada à mão.
          if (!atual || atual.qtd !== dados.qtd) Object.assign(novo, { qtd: dados.qtd, baseEm: Date.now() });
          return novo;
        })
      );
      return original.id;
    }
    const id = uid();
    setEstoqueBase((e) => [...e, { id, ...dados, baseEm: Date.now() }]);
    return id;
  }

  function excluirItem(item) {
    if (!window.confirm(`Excluir "${item.nome}" do estoque?`)) return false;
    setEstoqueBase((e) => e.filter((x) => x.id !== item.id));
    return true;
  }

  function pagarConta(id, caixaKey) {
    const conta = contas.find((c) => c.id === id);
    if (!conta || conta.status === "Pago") return;
    setContas((cs) => cs.map((c) => (c.id === id ? { ...c, status: "Pago", dataPagamento: todayISO(), caixa: caixaKey } : c)));
    addMovimento(caixaKey, "Saída", conta.valor, `Conta: ${conta.nome}`);
  }

  // O cliente paga o frete para a farmácia e a farmácia repassa ao freteiro.
  function pagarFreteiro(vendaIds, caixaKey, nomeFreteiro) {
    const ids = new Set(vendaIds);
    const lista = vendasTodas.filter((v) => ids.has(v.id) && v.frete && !v.frete.pagoFreteiroEm);
    if (lista.length === 0) return;
    const total = lista.reduce((s, v) => s + Number(v.frete.valor || 0), 0);
    const hojeIso = todayISO();
    setVendas((vs) => vs.map((v) => (ids.has(v.id) && v.frete && !v.frete.pagoFreteiroEm ? { ...v, frete: { ...v.frete, pagoFreteiroEm: hojeIso, pagoFreteiroCaixa: caixaKey } } : v)));
    addMovimento(caixaKey, "Saída", total, `Frete pago a ${nomeFreteiro} (${lista.map((v) => "#" + v.numero).join(", ")})`);
  }

  function marcarVendaPaga(id, caixaKey) {
    if (ehVendedor) return;
    const venda = vendas.find((v) => v.id === id);
    if (!venda || venda.status === "Pago") return;
    setVendas((vs) => vs.map((v) => (v.id === id ? { ...v, status: "Pago", dataRecebimento: todayISO() } : v)));
    addMovimento(caixaKey, "Entrada", venda.valor, `Recebimento venda #${venda.numero}`, venda.vendedorId ? { vendedorId: venda.vendedorId } : {});
  }

  function duplicarConta(id) {
    const conta = contas.find((c) => c.id === id);
    if (!conta) return;
    setContas((cs) => [
      ...cs,
      { id: uid(), nome: conta.nome, categoria: conta.categoria, valor: conta.valor, vencimento: somarMeses(conta.vencimento, 1), status: "Pendente", dataPagamento: null },
    ]);
  }

  function salvarConta(dados, original) {
    if (original) setContas((cs) => cs.map((c) => (c.id === original.id ? { ...c, ...dados } : c)));
    else setContas((cs) => [...cs, { id: uid(), ...dados, status: "Pendente", dataPagamento: null }]);
  }

  function excluirConta(conta) {
    if (!window.confirm(`Excluir a conta "${conta.nome}"?`)) return false;
    setContas((cs) => cs.filter((x) => x.id !== conta.id));
    return true;
  }

  function salvarPessoa(tipo, dados, original) {
    const set = tipo === "cliente" ? setClientes : setFornecedores;
    if (tipo === "cliente" && ehVendedor) {
      // Tabela de preço e limite de crédito só o dono define.
      const { tabela, limiteCredito, ...resto } = dados;
      dados = { ...resto, vendedorId: meuVendedorId, ...(original ? {} : { tabela: "Varejo" }) };
    }
    if (original) set((d) => d.map((p) => (p.id === original.id ? { ...p, ...dados } : p)));
    else set((d) => [...d, { id: uid(), ...dados }]);
  }

  function excluirPessoa(tipo, pessoa) {
    if (ehVendedor) return;
    if (!window.confirm(`Excluir ${tipo === "cliente" ? "o cliente" : "o fornecedor"} "${pessoa.nome}"?`)) return;
    const set = tipo === "cliente" ? setClientes : setFornecedores;
    set((d) => d.filter((x) => x.id !== pessoa.id));
  }

  function salvarVendedor(dados, original) {
    if (original) setVendedores((d) => d.map((p) => (p.id === original.id ? { ...p, ...dados } : p)));
    else setVendedores((d) => [...d, { id: uid(), ativo: true, ...dados }]);
  }

  function excluirVendedor(v) {
    if (!window.confirm(`Excluir o vendedor "${v.nome}"? As vendas dele continuam registradas.`)) return false;
    setVendedores((d) => d.filter((x) => x.id !== v.id));
    return true;
  }

  const dadosBackup = () => ({
    app: "indufarma", versao: 2, exportadoEm: new Date().toISOString(),
    estoque: estoqueBase, vendas, compras, clientes, fornecedores, vendedores, orcamentos, freteiros, movimentos, contas, cambio,
  });

  // Backup automático do dia (só no computador do dono, que tem todos os dados).
  useEffect(() => {
    if (!loaded || ehVendedor) return;
    const t = setTimeout(() => { backupDoDia(dadosBackup()).catch(() => {}); }, 3000);
    return () => clearTimeout(t);
  }, [loaded, ehVendedor, hoje]); // eslint-disable-line react-hooks/exhaustive-deps

  function baixarBackup(dados = dadosBackup(), nome = `indufarma-backup-${todayISO()}.json`) {
    const data = dados;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function baixarBackupDoDia(dia) {
    const dados = await obterBackup(dia);
    if (dados) baixarBackup(dados, `indufarma-backup-${dia}.json`);
  }

  async function restaurarBackup(arquivo) {
    const texto = typeof arquivo === "string" ? arquivo : await arquivo.text();
    let bruto;
    try {
      bruto = JSON.parse(texto);
    } catch (e) {
      throw new Error("O arquivo não é um backup válido.");
    }
    // Grava antes o que está na tela, para a importação não ser desfeita.
    db.gravar("estoque", estoqueBase); db.gravar("vendas", vendas); db.gravar("compras", compras);
    db.gravar("clientes", clientes); db.gravar("fornecedores", fornecedores); db.gravar("movimentos", movimentos);
    db.gravar("contas", contas); db.gravar("vendedores", vendedores); db.gravar("orcamentos", orcamentos); db.gravar("freteiros", freteiros); db.gravar("config", [cambio]);
    const n = await db.importar(normalizar(bruto));
    recarregarTudo();
    return n;
  }

  function aoBuscar(valor) {
    setBusca(valor);
    if (valor && page !== "estoque") setPage("estoque");
  }

  function irPara(key) {
    setPage(key);
    setMenuAberto(false);
  }

  const ctx = {
    page, setPage: irPara, busca, setBusca,
    estoque, estoqueBase, vendas, compras, clientes, fornecedores, vendedores, orcamentos, freteiros, movimentos, caixas, cambio, setCambio, contas,
    vendasHoje, vendasDoDia, aReceber, vendasACobrar, valorEstoque, unidadesEstoque, estoqueBaixo,
    contasPendentes, totalContasPendentes, contasVencendo, clientesSemPedido, registrarContato, agendarContato,
    abrirModal, fecharModal, editando,
    addMovimento, registrarVenda, registrarDevolucao, pagarComissao, emAbertoDoCliente, registrarCompra, acertarConsignado, importarProdutos, salvarItem, excluirItem, pagarConta, marcarVendaPaga,
    duplicarConta, salvarConta, excluirConta, salvarPessoa, excluirPessoa, salvarVendedor, excluirVendedor, atualizarVenda, atualizarEntrega,
    salvarOrcamento, atualizarOrcamento, aprovarPrecoOrcamento, excluirOrcamento, converterOrcamento, salvarFreteiro, excluirFreteiro, pagarFreteiro,
    entregasPendentes, cotacoesAguardando, orcamentosParaAprovar, orcamentosDoVendedor, respostasDoDono, marcarOrcamentoVisto, baixarBackup, baixarBackupDoDia, restaurarBackup, vendasTodas,
    sync, instalar, setInstalar, ehVendedor, meuVendedorId, acesso, vendedoresTodos,
  };

  if (erroCarregar) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto text-red-500 mb-3" />
          <div className="text-sm text-slate-700">{erroCarregar}</div>
          <button className={btnPrimario + " mt-4"} onClick={() => window.location.reload()}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando seus dados...
        </div>
      </div>
    );
  }

  const pages = {
    visao: <VisaoGeral />,
    estoque: <EstoquePage />,
    vendas: <VendasPage />,
    maisVendidos: <MaisVendidosPage />,
    compras: <ComprasPage />,
    caixa: <CaixaPage />,
    contas: <ContasPage />,
    clientes: <PessoasPage tipo="cliente" />,
    fornecedores: <PessoasPage tipo="fornecedor" />,
    vendedores: <VendedoresPage />,
    orcamentos: <OrcamentosPage />,
    frete: <FretePage />,
    cambio: <CambioPage />,
    relatorio: <RelatorioPage />,
  };

  const PAGINAS_VENDEDOR = ["visao", "estoque", "orcamentos", "vendas", "frete", "maisVendidos", "clientes", "vendedores"];
  const nav = ehVendedor ? NAV.filter((n) => PAGINAS_VENDEDOR.includes(n.key)).map((n) => (n.key === "vendedores" ? { ...n, label: "Minhas metas" } : n)) : NAV;
  const paginaAtual = nav.some((n) => n.key === page) ? page : "visao";

  // Com a nuvem configurada, só entra quem tem login.
  if (!verComo && sync.configurado && sync.sessaoLida && !sync.logado) return <TelaEntrar sync={sync} />;

  if (acesso.papel === "sem_acesso") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" />
          <div className="text-sm text-slate-700 mb-1 font-medium">Este login ainda não tem acesso.</div>
          <div className="text-sm text-slate-500">Peça ao dono para criar o seu acesso (usuário {db.nomeDeLogin(sync.email)}) no cadastro de vendedores. Depois, abra o sistema de novo.</div>
          <button className={btnPrimario + " mt-4"} onClick={() => db.sair().catch(() => {})}>Entrar com outro login</button>
        </div>
      </div>
    );
  }

  const contadores = {
    estoque: ehVendedor ? 0 : estoqueBaixo.length, contas: contasVencendo.length, clientes: clientesSemPedido.length,
    frete: entregasPendentes.length + cotacoesAguardando.length,
    orcamentos: ehVendedor ? respostasDoDono.length : orcamentosDoVendedor.length,
  };

  const sidebar = (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src={import.meta.env.BASE_URL + "icone.svg"} alt="" className="w-9 h-9" />
        <div>
          <div className="text-base font-semibold leading-tight tracking-tight">Indufarma</div>
          <div className="text-[11px] text-slate-400 leading-tight">Gestão da farmácia</div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = paginaAtual === n.key;
          const qtd = contadores[n.key];
          return (
            <button
              key={n.key}
              onClick={() => irPara(n.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={17} className={active ? "text-emerald-700" : "text-slate-400"} />
              <span className="flex-1 text-left">{n.label}</span>
              {qtd > 0 && <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{qtd}</span>}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-100 space-y-2">
        {instalar && (
          <button
            onClick={async () => {
              instalar.prompt();
              await instalar.userChoice;
              setInstalar(null);
            }}
            className="w-full flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-2"
          >
            <Monitor size={14} /> Instalar no computador
          </button>
        )}
        {import.meta.env.VITE_DEMO && (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2">
            <div className="text-[11px] text-slate-500 mb-1">Ver o sistema como</div>
            <select
              aria-label="Ver o sistema como"
              className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 bg-white"
              value={ehVendedor ? meuVendedorId : ""}
              onChange={(e) => { setVerComo(e.target.value ? { papel: "vendedor", vendedorId: e.target.value } : null); fecharModal(); }}
            >
              <option value="">Dono (vê tudo)</option>
              {vendedoresTodos.filter((v) => v.ativo !== false).map((v) => <option key={v.id} value={v.id}>Vendedor: {v.nome}</option>)}
            </select>
          </div>
        )}
        {ehVendedor && (
          <div className="text-[11px] text-slate-500 px-1">
            Entrou como vendedor: <span className="font-medium text-slate-700">{vendedoresTodos.find((v) => v.id === meuVendedorId)?.nome || "—"}</span>
          </div>
        )}
        <StatusSync sync={sync} onClick={() => abrirModal("dados")} />
      </div>
    </aside>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen flex">
        {/* Menu lateral: fixo em telas grandes, gaveta no celular */}
        <div className="hidden lg:block w-64 shrink-0">
          <div className="fixed inset-y-0 w-64">{sidebar}</div>
        </div>
        {menuAberto && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="w-64">{sidebar}</div>
            <div className="flex-1 bg-slate-900/40" onClick={() => setMenuAberto(false)} />
          </div>
        )}

        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-8 py-6 max-w-[1400px] mx-auto">
            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <button className="lg:hidden p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
                  <Menu size={20} />
                </button>
                <div>
                  <div className="text-xs text-slate-400 font-medium first-letter:uppercase">{fmtDateLong()}</div>
                  <h1 className="text-2xl font-semibold text-slate-900 mt-0.5 tracking-tight">{nav.find((n) => n.key === paginaAtual)?.label}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => aoBuscar(e.target.value)}
                    placeholder="Buscar produto..."
                    className="pl-9 pr-8 py-2 text-sm border border-slate-200 bg-white rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  {busca && (
                    <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpar busca">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={() => abrirModal("venda")} className={btnPrimario}>
                  <Plus size={15} /> Nova venda
                </button>
              </div>
            </div>

            {import.meta.env.VITE_DEMO && (
              <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Demonstração com dados de exemplo. O que você mudar aqui fica só neste navegador e não afeta a farmácia. Excluir e baixar backup não funcionam nesta prévia.
              </div>
            )}

            {sync.erroLocal && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sync.erroLocal}</div>
            )}

            {pages[paginaAtual]}
          </div>
        </main>

        {modal === "venda" && <VendaModal />}
        {modal === "compra" && <CompraModal />}
        {modal === "fornecedorDetalhe" && <FornecedorDetalheModal />}
        {modal === "importarProdutos" && <ImportarProdutosModal />}
        {modal === "acerto" && <AcertoModal />}
        {modal === "pagarComissao" && <PagarComissaoModal />}
        {modal === "contaCliente" && <ContaClienteModal />}
        {modal === "devolucao" && <DevolucaoModal />}
        {modal === "movimento" && <MovimentoModal />}
        {modal === "item" && <ItemModal />}
        {modal === "cliente" && <PessoaModal tipo="cliente" />}
        {modal === "fornecedor" && <PessoaModal tipo="fornecedor" />}
        {modal === "cambio" && <CambioModal />}
        {modal === "conta" && <ContaModal />}
        {modal === "pagarConta" && <PagarContaModal />}
        {modal === "receberVenda" && <ReceberVendaModal />}
        {modal === "dados" && <DadosModal />}
        {modal === "vendedor" && <VendedorModal />}
        {modal === "listaPrecos" && <ListaPrecosModal />}
        {modal === "enviarProduto" && <EnviarProdutoModal />}
        {modal === "agendar" && <AgendarContatoModal />}
        {modal === "orcamento" && <OrcamentoModal />}
        {modal === "orcamentoDetalhe" && <OrcamentoDetalheModal />}
        {modal === "freteiro" && <FreteiroModal />}
      </div>
    </AppCtx.Provider>
  );
}

function TelaEntrar({ sync }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  async function entrar(e) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    try {
      await db.entrar(usuario, senha);
    } catch (err) {
      setErro(err.message);
      setOcupado(false);
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <img src={import.meta.env.BASE_URL + "icone.svg"} alt="" className="w-10 h-10" />
          <div>
            <div className="text-lg font-semibold leading-tight">Indufarma</div>
            <div className="text-xs text-slate-400">Gestão da farmácia</div>
          </div>
        </div>
        {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
        <label className="block text-xs font-medium text-slate-600 mb-1">Usuário</label>
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} required autoFocus autoCapitalize="none" autoComplete="username"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
        <label className="block text-xs font-medium text-slate-600 mb-1">Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
        <button type="submit" disabled={ocupado || !sync.online} className={btnPrimario + " w-full"}>
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} {sync.online ? "Entrar" : "Sem internet: conecte para entrar"}
        </button>
      </form>
    </div>
  );
}

function StatusSync({ sync, onClick }) {
  let Icone = HardDrive, cor = "text-slate-500", titulo = "Salvo neste computador", sub = "Sincronização não configurada";
  if (sync.configurado) {
    if (!sync.online) {
      Icone = CloudOff; cor = "text-amber-600"; titulo = "Sem internet";
      sub = sync.pendentes ? `${sync.pendentes} alterações aguardando envio` : "Tudo salvo neste computador";
    } else if (!sync.logado) {
      Icone = CloudOff; cor = "text-amber-600"; titulo = "Entre para sincronizar"; sub = "Toque aqui para entrar";
    } else if (sync.erro) {
      Icone = AlertTriangle; cor = "text-red-600"; titulo = "Erro ao sincronizar"; sub = "Toque para ver detalhes";
    } else if (sync.sincronizando) {
      Icone = Loader2; cor = "text-emerald-700"; titulo = "Sincronizando..."; sub = sync.pendentes ? `${sync.pendentes} alterações` : "";
    } else {
      Icone = Cloud; cor = "text-emerald-700"; titulo = "Sincronizado";
      sub = sync.pendentes ? `${sync.pendentes} alterações aguardando` : sync.ultimaSync ? `Última vez às ${fmtHora(sync.ultimaSync)}` : "";
    }
  }
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-slate-50 text-left">
      <Icone size={16} className={`${cor} shrink-0 ${sync.sincronizando && sync.online && sync.logado ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <div className={`text-xs font-semibold leading-tight ${cor}`}>{titulo}</div>
        <div className="text-[11px] text-slate-400 leading-tight truncate">{sub || "Dados e backup"}</div>
      </div>
    </button>
  );
}
