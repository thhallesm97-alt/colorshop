import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutGrid, ArrowUpRight, ArrowDownLeft, Wallet, Users, Truck, RefreshCw, Plus, Search,
  Home, Loader2, Receipt, TrendingUp, Menu, X, Cloud, CloudOff, HardDrive, AlertTriangle, Monitor,
} from "lucide-react";

import { AppCtx, CAIXA_META, CAMBIO_PADRAO, caixaDoPagamento } from "./contexto.js";
import { fmtDateLong, fmtHora, todayISO, uid, normalizar as norm, somarMeses } from "./lib/format.js";
import * as db from "./lib/db.js";
import { lerDadosAntigosDoNavegador, normalizar } from "./lib/migracao.js";
import { btnPrimario } from "./ui.jsx";
import {
  VisaoGeral, EstoquePage, VendasPage, MaisVendidosPage, ComprasPage, CaixaPage, ContasPage, PessoasPage, CambioPage,
} from "./paginas.jsx";
import {
  VendaModal, CompraModal, MovimentoModal, ItemModal, PessoaModal, CambioModal, ContaModal, PagarContaModal,
  ReceberVendaModal, DadosModal,
} from "./modais.jsx";

const NAV = [
  { key: "visao", label: "Visão geral", icon: Home },
  { key: "estoque", label: "Estoque", icon: LayoutGrid },
  { key: "vendas", label: "Vendas", icon: ArrowUpRight },
  { key: "maisVendidos", label: "Mais vendidos", icon: TrendingUp },
  { key: "compras", label: "Compras", icon: ArrowDownLeft },
  { key: "caixa", label: "Caixa", icon: Wallet },
  { key: "contas", label: "Contas a pagar", icon: Receipt },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "fornecedores", label: "Fornecedores", icon: Truck },
  { key: "cambio", label: "Câmbio", icon: RefreshCw },
];

// Carrega o banco uma única vez, mesmo que o React monte o componente duas vezes.
let carregamento = null;
function carregarBanco() {
  return (carregamento ||= (async () => {
    const { vazio } = await db.abrir();
    if (vazio) {
      const antigos = lerDadosAntigosDoNavegador();
      if (antigos) await db.importar(normalizar(antigos));
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
  const [vendas, setVendas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [cambio, setCambio] = useState(CAMBIO_PADRAO);
  const [contas, setContas] = useState([]);

  const [modal, setModal] = useState(null);
  const [editando, setEditando] = useState(null);

  const abrirModal = useCallback((nome, item = null) => {
    setEditando(item);
    setModal(nome);
  }, []);
  const fecharModal = useCallback(() => {
    setModal(null);
    setEditando(null);
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
      fornecedores: setFornecedores, movimentos: setMovimentos, contas: setContas,
    };
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
  }, []);

  // ---- grava no banco local a cada mudança ----
  useEffect(() => { if (loaded) db.gravar("estoque", estoqueBase); }, [estoqueBase, loaded]);
  useEffect(() => { if (loaded) db.gravar("vendas", vendas); }, [vendas, loaded]);
  useEffect(() => { if (loaded) db.gravar("compras", compras); }, [compras, loaded]);
  useEffect(() => { if (loaded) db.gravar("clientes", clientes); }, [clientes, loaded]);
  useEffect(() => { if (loaded) db.gravar("fornecedores", fornecedores); }, [fornecedores, loaded]);
  useEffect(() => { if (loaded) db.gravar("movimentos", movimentos); }, [movimentos, loaded]);
  useEffect(() => { if (loaded) db.gravar("contas", contas); }, [contas, loaded]);
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
  const estoque = useMemo(() => {
    const base = new Map(estoqueBase.map((i) => [i.id, i]));
    const delta = {};
    for (const c of compras) {
      for (const l of c.itens || []) {
        const it = l.itemId && base.get(l.itemId);
        if (it && (c.ts || 0) > (it.baseEm || 0)) delta[it.id] = (delta[it.id] || 0) + Number(l.qtd || 0);
      }
    }
    for (const v of vendas) {
      for (const l of v.itens || []) {
        const it = base.get(l.itemId);
        if (it && (v.ts || 0) > (it.baseEm || 0)) delta[it.id] = (delta[it.id] || 0) - Number(l.qtd || 0);
      }
    }
    return [...estoqueBase]
      .map((i) => ({ ...i, qtd: Number(i.qtd || 0) + (delta[i.id] || 0) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [estoqueBase, compras, vendas]);

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
  const valorEstoque = useMemo(() => estoque.reduce((s, i) => s + Math.max(0, i.qtd) * i.custo, 0), [estoque]);
  const unidadesEstoque = useMemo(() => estoque.reduce((s, i) => s + Math.max(0, i.qtd), 0), [estoque]);
  const estoqueBaixo = useMemo(() => estoque.filter((i) => i.qtd <= i.min), [estoque]);
  const contasPendentes = useMemo(() => contas.filter((c) => c.status === "Pendente"), [contas]);
  const totalContasPendentes = useMemo(() => contasPendentes.reduce((s, c) => s + c.valor, 0), [contasPendentes]);
  const contasVencendo = useMemo(
    () => contasPendentes.filter((c) => c.vencimento <= hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [contasPendentes, hoje]
  );

  // ---- ações ----
  function addMovimento(caixaKey, tipo, valor, descricao) {
    setMovimentos((m) => [{ id: uid(), caixa: caixaKey, tipo, valor: Number(valor), descricao, data: todayISO(), ts: Date.now() }, ...m]);
  }

  // Devolve uma mensagem de erro, ou null se a venda foi registrada.
  function registrarVenda({ clienteId, itens, pagamento, condicao }) {
    if (!itens || itens.length === 0) return "Adicione pelo menos um produto.";
    const qtdPorItem = {};
    itens.forEach((l) => (qtdPorItem[l.itemId] = (qtdPorItem[l.itemId] || 0) + l.qtd));
    for (const itemId in qtdPorItem) {
      const s = estoque.find((i) => i.id === itemId);
      if (!s) return "Um dos produtos não existe mais no estoque.";
      if (qtdPorItem[itemId] > s.qtd) return `Estoque insuficiente de ${s.nome} (${s.qtd} disponíveis).`;
    }
    const cliente = clientes.find((c) => c.id === clienteId);
    const linhas = itens.map((l) => {
      const item = estoque.find((i) => i.id === l.itemId);
      const precoUnit = l.tipoVenda === "Atacado" ? item.atacado : item.varejo;
      return { itemId: l.itemId, itemNome: item.nome, qtd: l.qtd, tipoVenda: l.tipoVenda, precoUnit, subtotal: precoUnit * l.qtd };
    });
    const valor = linhas.reduce((s, l) => s + l.subtotal, 0);
    const numero = vendas.reduce((m, v) => Math.max(m, Number(v.numero) || 0), 0) + 1;
    setVendas((v) => [
      {
        id: uid(), numero, clienteId, clienteNome: cliente ? cliente.nome : "Sem nome", itens: linhas, valor, pagamento, condicao,
        status: condicao === "À vista" ? "Pago" : "Pendente", data: todayISO(), ts: Date.now(),
      },
      ...v,
    ]);
    if (condicao === "À vista") addMovimento(caixaDoPagamento(pagamento), "Entrada", valor, `Venda #${numero}`);
    return null;
  }

  function registrarCompra({ fornecedorId, itens, pagamento }) {
    if (!itens || itens.length === 0) return;
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
    let base = estoqueBase;
    const linhas = itens.map((l) => {
      const existente = base.find((i) => norm(i.nome) === norm(l.nome));
      if (existente) {
        base = base.map((i) => (i.id === existente.id ? { ...i, custo: l.custo } : i));
        return { itemId: existente.id, nome: existente.nome, qtd: l.qtd, custo: l.custo, subtotal: l.custo * l.qtd };
      }
      const novo = { id: uid(), nome: l.nome, qtd: 0, baseEm: 0, custo: l.custo, varejo: l.varejo || l.custo * 1.3, atacado: l.atacado || l.custo * 1.15, min: 3 };
      base = [...base, novo];
      return { itemId: novo.id, nome: novo.nome, qtd: l.qtd, custo: l.custo, subtotal: l.custo * l.qtd };
    });
    setEstoqueBase(base);
    const total = linhas.reduce((s, l) => s + l.subtotal, 0);
    setCompras((c) => [
      { id: uid(), fornecedorId, fornecedorNome: fornecedor ? fornecedor.nome : "Sem nome", itens: linhas, total, pagamento, data: todayISO(), ts: Date.now() },
      ...c,
    ]);
    addMovimento(
      caixaDoPagamento(pagamento), "Saída", total,
      `Compra de ${fornecedor ? fornecedor.nome : "fornecedor"} (${linhas.length} ${linhas.length === 1 ? "item" : "itens"})`
    );
  }

  function salvarItem(dados, original) {
    if (original) {
      const atual = estoque.find((i) => i.id === original.id);
      setEstoqueBase((e) =>
        e.map((x) => {
          if (x.id !== original.id) return x;
          const novo = { ...x, nome: dados.nome, custo: dados.custo, varejo: dados.varejo, atacado: dados.atacado, min: dados.min };
          // Só reinicia a contagem se a quantidade foi alterada à mão.
          if (!atual || atual.qtd !== dados.qtd) Object.assign(novo, { qtd: dados.qtd, baseEm: Date.now() });
          return novo;
        })
      );
    } else {
      setEstoqueBase((e) => [...e, { id: uid(), ...dados, baseEm: Date.now() }]);
    }
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

  function marcarVendaPaga(id, caixaKey) {
    const venda = vendas.find((v) => v.id === id);
    if (!venda || venda.status === "Pago") return;
    setVendas((vs) => vs.map((v) => (v.id === id ? { ...v, status: "Pago", dataRecebimento: todayISO() } : v)));
    addMovimento(caixaKey, "Entrada", venda.valor, `Recebimento venda #${venda.numero}`);
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
    if (original) set((d) => d.map((p) => (p.id === original.id ? { ...p, ...dados } : p)));
    else set((d) => [...d, { id: uid(), ...dados }]);
  }

  function excluirPessoa(tipo, pessoa) {
    if (!window.confirm(`Excluir ${tipo === "cliente" ? "o cliente" : "o fornecedor"} "${pessoa.nome}"?`)) return;
    const set = tipo === "cliente" ? setClientes : setFornecedores;
    set((d) => d.filter((x) => x.id !== pessoa.id));
  }

  function baixarBackup() {
    const data = {
      app: "indufarma", versao: 2, exportadoEm: new Date().toISOString(),
      estoque: estoqueBase, vendas, compras, clientes, fornecedores, movimentos, contas, cambio,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indufarma-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function restaurarBackup(arquivo) {
    const texto = await arquivo.text();
    let bruto;
    try {
      bruto = JSON.parse(texto);
    } catch (e) {
      throw new Error("O arquivo não é um backup válido.");
    }
    // Grava antes o que está na tela, para a importação não ser desfeita.
    db.gravar("estoque", estoqueBase); db.gravar("vendas", vendas); db.gravar("compras", compras);
    db.gravar("clientes", clientes); db.gravar("fornecedores", fornecedores); db.gravar("movimentos", movimentos);
    db.gravar("contas", contas); db.gravar("config", [cambio]);
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
    estoque, estoqueBase, vendas, compras, clientes, fornecedores, movimentos, caixas, cambio, setCambio, contas,
    vendasHoje, vendasDoDia, aReceber, vendasACobrar, valorEstoque, unidadesEstoque, estoqueBaixo,
    contasPendentes, totalContasPendentes, contasVencendo,
    abrirModal, fecharModal, editando,
    addMovimento, registrarVenda, registrarCompra, salvarItem, excluirItem, pagarConta, marcarVendaPaga,
    duplicarConta, salvarConta, excluirConta, salvarPessoa, excluirPessoa, baixarBackup, restaurarBackup,
    sync, instalar, setInstalar,
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
    cambio: <CambioPage />,
  };

  const contadores = { estoque: estoqueBaixo.length, contas: contasVencendo.length };

  const sidebar = (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/icone.svg" alt="" className="w-9 h-9" />
        <div>
          <div className="text-base font-semibold leading-tight tracking-tight">Indufarma</div>
          <div className="text-[11px] text-slate-400 leading-tight">Gestão da farmácia</div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = page === n.key;
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
                  <h1 className="text-2xl font-semibold text-slate-900 mt-0.5 tracking-tight">{NAV.find((n) => n.key === page)?.label}</h1>
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

            {sync.erroLocal && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sync.erroLocal}</div>
            )}

            {pages[page]}
          </div>
        </main>

        {modal === "venda" && <VendaModal />}
        {modal === "compra" && <CompraModal />}
        {modal === "movimento" && <MovimentoModal />}
        {modal === "item" && <ItemModal />}
        {modal === "cliente" && <PessoaModal tipo="cliente" />}
        {modal === "fornecedor" && <PessoaModal tipo="fornecedor" />}
        {modal === "cambio" && <CambioModal />}
        {modal === "conta" && <ContaModal />}
        {modal === "pagarConta" && <PagarContaModal />}
        {modal === "receberVenda" && <ReceberVendaModal />}
        {modal === "dados" && <DadosModal />}
      </div>
    </AppCtx.Provider>
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
