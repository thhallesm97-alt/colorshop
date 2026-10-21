import React, { useState, useRef } from "react";
import { Plus, Trash2, Download, Upload, Cloud, LogOut, Loader2, Monitor, MessageCircle, Copy, Check, ImagePlus, Share2, Image as ImageIcon } from "lucide-react";
import { useApp, COMISSAO_PADRAO, COMISSAO_INDICACAO_PADRAO, CAIXA_META, PAGAMENTOS, caixaDoPagamento, TABELAS, precoDe, produtoCombina, ehDeFornecedor, descricaoProduto, faltaReceber, valorPagoDaVenda, caixaEmReais, paraMoedaDoCaixa, fmtConta } from "./contexto.js";
import { fmtUSD, fmtBRL, fmtDate, fmtHora, todayISO, uid, normalizar, isoLocal } from "./lib/format.js";
import { linkWhatsApp } from "./lib/whatsapp.js";
import * as db from "./lib/db.js";
import { comprimir, salvarFoto, useFoto, obterFoto, copiarFoto, podeCompartilhar, compartilharFoto, urlPublica } from "./lib/fotos.js";
import { Modal, Field, inputCls, btnPrimario, btnSecundario, Segmentado } from "./ui.jsx";
import { CambioForm } from "./paginas.jsx";
import { listarBackups } from "./lib/backup.js";

function lerLocal(k) {
  try {
    return window.localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}
function gravarLocal(k, v) {
  try {
    window.localStorage.setItem(k, v || "");
  } catch (e) {
    /* opcional */
  }
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function Erro({ children }) {
  if (!children) return null;
  return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>;
}

function SelectCaixa({ value, onChange }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.keys(CAIXA_META).map((k) => <option key={k} value={k}>{CAIXA_META[k].label}</option>)}
    </select>
  );
}

// Produto que não está no cadastro: nome e preço digitados na hora. O dono pode já
// cadastrá-lo como produto de fornecedor, para usar de novo depois.
export function ProdutoAvulso({ tabela, aoAdicionar, rotulo }) {
  const { fornecedores, salvarItem, ehVendedor } = useApp();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [qtd, setQtd] = useState(1);
  const [cadastrar, setCadastrar] = useState(false);
  const [fornecedorId, setFornecedorId] = useState(fornecedores[0]?.id || "");
  const valido = nome.trim() && n(preco) > 0 && custo !== "" && n(custo) >= 0 && qtd >= 1 && (!cadastrar || fornecedorId);

  function adicionar() {
    if (!valido) return;
    const precoUnit = n(preco);
    let itemId = null;
    if (cadastrar) {
      const forn = fornecedores.find((f) => f.id === fornecedorId);
      itemId = salvarItem({
        nome: nome.trim(), marca: "", tipo: "", qtd: 0, custo: n(custo), custoVendedor: n(custo), varejo: precoUnit, atacado: precoUnit, lojista: precoUnit, min: 0,
        origem: "fornecedor", fornecedorId, fornecedorNome: forn?.nome || "", foto: null,
      });
    }
    aoAdicionar({ itemId, nome: nome.trim(), qtd, tipoVenda: tabela, precoUnit, custoVendedor: n(custo), avulso: !itemId });
    setNome("");
    setPreco("");
    setCusto("");
    setQtd(1);
    setCadastrar(false);
  }

  return (
    <>
      <Field label="Nome do produto">
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vitamina C 1g (pedido especial)" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantidade"><input type="number" min="1" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} /></Field>
        <Field label="Valor unitário (US$)"><input type="number" min="0" step="0.01" className={inputCls} value={preco} onChange={(e) => setPreco(e.target.value)} /></Field>
        <Field label="Custo un. (US$)" hint="Para a comissão."><input type="number" min="0" step="0.01" className={inputCls} value={custo} onChange={(e) => setCusto(e.target.value)} /></Field>
      </div>
      {!ehVendedor && fornecedores.length > 0 && (
        <div className="mb-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={cadastrar} onChange={(e) => setCadastrar(e.target.checked)} className="rounded border-slate-300 text-emerald-700" />
            Cadastrar como produto de fornecedor (sob encomenda)
          </label>
          {cadastrar && (
            <select className={inputCls + " mt-2"} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} aria-label="Fornecedor">
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
        </div>
      )}
      <button type="button" onClick={adicionar} disabled={!valido} className={btnSecundario + " w-full border-emerald-700/40 text-emerald-800"}>
        <Plus size={14} /> {rotulo}
      </button>
    </>
  );
}

// Campo de vendedor: o vendedor logado não escolhe, a venda é sempre dele.
export function CampoVendedor({ valor, onChange }) {
  const { vendedores, ehVendedor } = useApp();
  if (ehVendedor) {
    return (
      <Field label="Vendedor">
        <input disabled className={inputCls} value={vendedores[0]?.nome || ""} />
      </Field>
    );
  }
  return (
    <Field label="Vendedor">
      <select className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem vendedor</option>
        {vendedores.filter((v) => v.ativo !== false || v.id === valor).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
    </Field>
  );
}

export function VendaModal() {
  const { clientes, estoque, vendedores, registrarVenda, fecharModal, ehVendedor, emAbertoDoCliente, cambio } = useApp();
  const disponiveis = estoque.filter((i) => ehDeFornecedor(i) || i.qtd > 0);
  const ativos = vendedores.filter((v) => v.ativo !== false);
  const [clienteId, setClienteId] = useState("");
  const [modo, setModo] = useState("cadastro");
  const [vendedorId, setVendedorId] = useState(() => {
    const ultimo = lerLocal("shopping25-ultimo-vendedor");
    return ativos.some((v) => v.id === ultimo) ? ultimo : "";
  });
  const [itemId, setItemId] = useState(disponiveis[0]?.id || "");
  const [qtd, setQtd] = useState(1);
  const [tipoVenda, setTipoVenda] = useState("Varejo");
  const [pagamento, setPagamento] = useState("PIX");
  const [condicao, setCondicao] = useState("À vista");
  const [carrinho, setCarrinho] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState(null);

  const opcoes = disponiveis.filter((i) => produtoCombina(i, filtro));
  // Ao filtrar, o primeiro produto encontrado já fica escolhido.
  const item = opcoes.find((i) => i.id === itemId) || opcoes[0];
  const jaNoCarrinho = carrinho.filter((l) => l.itemId === item?.id).reduce((s, l) => s + l.qtd, 0);
  const disponivel = item ? (ehDeFornecedor(item) ? Infinity : item.qtd - jaNoCarrinho) : 0;
  const precoTabela = precoDe(item, tipoVenda);
  // O dono pode mudar o preço na hora da venda. O vendedor muda só no orçamento, com aprovação.
  const [precoManual, setPrecoManual] = useState(null);
  const chavePreco = `${item?.id}|${tipoVenda}`;
  const [chaveAnterior, setChaveAnterior] = useState(chavePreco);
  if (chaveAnterior !== chavePreco) { setChaveAnterior(chavePreco); setPrecoManual(null); }
  const precoUnit = !ehVendedor && precoManual != null && precoManual !== "" ? n(precoManual) : precoTabela;
  const total = carrinho.reduce((s, l) => s + l.precoUnit * l.qtd, 0);
  const podeAdicionar = item && qtd >= 1 && Number.isInteger(qtd) && qtd <= disponivel && precoUnit > 0;

  function addAoCarrinho() {
    if (!podeAdicionar) return;
    const alterado = Math.abs(precoUnit - precoTabela) > 0.004;
    setCarrinho((c) => [...c, { key: uid(), itemId: item.id, nome: item.nome, qtd, tipoVenda, precoUnit, precoTabela, ...(alterado ? { precoFixo: true } : {}) }]);
    setQtd(1);
    setPrecoManual(null);
    setErro(null);
  }
  function finalizar() {
    const e = registrarVenda({
      clienteId,
      vendedorId,
      itens: carrinho.map((l) => (l.avulso ? { itemId: null, itemNome: l.nome, qtd: l.qtd, tipoVenda: l.tipoVenda, precoUnit: l.precoUnit, custoVendedor: l.custoVendedor } : { itemId: l.itemId, qtd: l.qtd, tipoVenda: l.tipoVenda, ...(l.precoFixo ? { precoUnit: l.precoUnit } : {}) })),
      pagamento,
      condicao,
    });
    if (typeof e === "string") setErro(e);
    else {
      gravarLocal("shopping25-ultimo-vendedor", vendedorId);
      fecharModal();
    }
  }

  return (
    <Modal title="Nova venda" onClose={fecharModal} wide>
      <Erro>{erro}</Erro>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cliente">
          <select
            className={inputCls}
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              const c = clientes.find((x) => x.id === e.target.value);
              setTipoVenda(c?.tabela || "Varejo");
            }}
          >
            <option value="">Consumidor (sem cadastro)</option>
            {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <CampoVendedor valor={vendedorId} onChange={setVendedorId} />
      </div>

      <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="text-xs font-semibold text-slate-600">Adicionar produto</div>
          <Segmentado valor={modo} onChange={setModo} opcoes={[{ valor: "cadastro", label: "Do cadastro" }, { valor: "avulso", label: "Não cadastrado" }]} />
        </div>
        {modo === "avulso" ? (
          <ProdutoAvulso tabela={tipoVenda} rotulo="Adicionar à venda" aoAdicionar={(l) => { setCarrinho((c) => [...c, { key: uid(), ...l, precoFixo: true }]); setErro(null); }} />
        ) : disponiveis.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum produto com estoque disponível. Registre uma compra primeiro.</div>
        ) : (
          <>
            <Field label="Produto">
              <input className={inputCls + " mb-2"} placeholder="Filtrar produtos..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              <select
                className={inputCls}
                value={item?.id || ""}
                onChange={(e) => { setItemId(e.target.value); setQtd(1); }}
              >
                {!item && <option value="">Nenhum produto encontrado</option>}
                {opcoes.map((i) => <option key={i.id} value={i.id}>{i.nome}{i.marca ? ` · ${i.marca}` : ""} ({ehDeFornecedor(i) ? "sob encomenda" : `${i.qtd} disp.`})</option>)}
              </select>
            </Field>
            <Field label="Tabela de preço">
              <Segmentado valor={tipoVenda} onChange={setTipoVenda} opcoes={TABELAS} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={disponivel === Infinity ? "Quantidade (sob encomenda)" : `Quantidade (${Math.max(0, disponivel)} disp.)`}>
                <input type="number" min="1" step="1" max={disponivel === Infinity ? undefined : disponivel} className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
              </Field>
              {ehVendedor ? (
                <Field label="Valor unitário" hint="Para mudar o preço, faça um orçamento.">
                  <input type="text" disabled className={inputCls} value={item ? fmtUSD(precoUnit) : ""} />
                </Field>
              ) : (
                <Field label="Valor unitário (US$)" hint={item && Math.abs(precoUnit - precoTabela) > 0.004 ? `Tabela: ${fmtUSD(precoTabela)}` : "Pode mudar o preço."}>
                  <input type="number" step="0.01" min="0" className={inputCls} value={precoManual ?? (item ? precoTabela : "")} onChange={(e) => setPrecoManual(e.target.value)} />
                </Field>
              )}
            </div>
            <button type="button" onClick={addAoCarrinho} disabled={!podeAdicionar} className={btnSecundario + " w-full border-emerald-700/40 text-emerald-800"}>
              <Plus size={14} /> Adicionar à venda
            </button>
          </>
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-600 mb-2">Itens da venda ({carrinho.length})</div>
        {carrinho.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">Nenhum produto adicionado ainda.</div>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {carrinho.map((l) => (
              <div key={l.key} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{l.nome} × {l.qtd}</div>
                  <div className="text-xs text-slate-400">
                    {l.avulso ? "Não cadastrado" : l.tipoVenda} · {fmtUSD(l.precoUnit)} un.
                    {l.precoFixo && !l.avulso && <span className="text-amber-700"> · preço alterado (tabela {fmtUSD(l.precoTabela)})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{fmtUSD(l.precoUnit * l.qtd)}</span>
                  <button onClick={() => setCarrinho((c) => c.filter((x) => x.key !== l.key))} className="text-slate-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pagamento">
          <select className={inputCls} value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
            {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Condição">
          <select className={inputCls} value={condicao} onChange={(e) => setCondicao(e.target.value)}>
            <option>À vista</option>
            <option>A prazo</option>
          </select>
        </Field>
      </div>
      {ehVendedor && <p className="text-xs text-slate-500 -mt-2 mb-4">A venda fica como "a receber" até o dono confirmar o pagamento.</p>}
      {!ehVendedor && condicao === "À vista" && (pagamento === "PIX" || pagamento === "Real") && total > 0 && (
        <p className="text-xs text-slate-500 -mt-2 mb-4">
          Entra no caixa {pagamento === "PIX" ? "PIX" : "Real efetivo"}: <span className="font-medium text-slate-900">{fmtBRL(paraMoedaDoCaixa("pix", total, cambio))}</span> (câmbio R$ {Number(cambio.chacoCompra).toFixed(2).replace(".", ",")})
        </p>
      )}
      {(() => {
        const c = clientes.find((x) => x.id === clienteId);
        const limite = Number(c?.limiteCredito) || 0;
        if (condicao !== "A prazo" || !c || !(limite > 0)) return null;
        const deve = emAbertoDoCliente(c.id);
        if (deve + total <= limite + 0.004) return null;
        return (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {ehVendedor
              ? "Esta venda a prazo passa do limite de crédito do cliente. Fale com o dono."
              : `Passa do limite de crédito: ele já deve ${fmtUSD(deve)} e o limite é ${fmtUSD(limite)}. Você pode vender mesmo assim.`}
          </div>
        );
      })()}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 mb-4">
        <span className="text-sm text-slate-500">Total da venda</span>
        <span className="text-lg font-semibold text-slate-900">{fmtUSD(total)}</span>
      </div>
      <button onClick={finalizar} disabled={carrinho.length === 0} className={btnPrimario + " w-full"}>
        Finalizar venda
      </button>
    </Modal>
  );
}

export const CONDICOES = [
  { valor: "À vista", label: "À vista" },
  { valor: "A prazo", label: "A prazo" },
  { valor: "Consignado", label: "Consignado" },
];

export function CompraModal() {
  const { fornecedores, estoque, registrarCompra, fecharModal, editando } = useApp();
  const [fornecedorId, setFornecedorId] = useState(editando?.fornecedorId ?? fornecedores[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState(1);
  const [custo, setCusto] = useState(0);
  const [varejo, setVarejo] = useState(0);
  const [atacado, setAtacado] = useState(0);
  const [lojista, setLojista] = useState(0);
  const [condicao, setCondicao] = useState("À vista");
  const [pagamento, setPagamento] = useState("PIX");
  const [vencimento, setVencimento] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return isoLocal(d); });
  const [parcelas, setParcelas] = useState(1);
  const [dataAcerto, setDataAcerto] = useState("");
  const [carrinho, setCarrinho] = useState([]);
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState({});
  const [custos, setCustos] = useState({});

  const doFornecedor = estoque.filter((i) => fornecedorId && i.fornecedorId === fornecedorId);
  const listaForn = doFornecedor.filter((i) => produtoCombina(i, busca));
  const [verOutro, setVerOutro] = useState(doFornecedor.length === 0);

  const nomeTrim = nome.trim();
  const existente = nomeTrim ? estoque.find((i) => normalizar(i.nome) === normalizar(nomeTrim)) : null;
  const isNovoProduto = nomeTrim !== "" && !existente;
  const podeAdicionar = nomeTrim !== "" && qtd > 0 && custo > 0 && (!isNovoProduto || (varejo > 0 && atacado > 0 && lojista > 0));
  const total = carrinho.reduce((s, l) => s + l.custo * l.qtd, 0);
  const valido = carrinho.length > 0 && (condicao !== "A prazo" || (vencimento && parcelas >= 1));

  function addAoCarrinho() {
    if (!podeAdicionar) return;
    setCarrinho((c) => [...c, { key: uid(), itemId: existente?.id, nome: existente ? existente.nome : nomeTrim, qtd, custo, varejo, atacado, lojista }]);
    setNome(""); setQtd(1); setCusto(0); setVarejo(0); setAtacado(0); setLojista(0);
  }
  function addDaLista(i) {
    const q = Math.floor(n(qtds[i.id]));
    const c = custos[i.id] ?? i.custo;
    if (q <= 0 || !(n(c) > 0)) return;
    setCarrinho((cs) => [...cs, { key: uid(), itemId: i.id, nome: i.nome, qtd: q, custo: n(c) }]);
    setQtds((x) => ({ ...x, [i.id]: "" }));
  }
  function finalizar() {
    if (!valido) return;
    registrarCompra({ fornecedorId, itens: carrinho, pagamento, condicao, vencimento, parcelas, dataAcerto });
    fecharModal();
  }
  const valorParcela = parcelas > 0 ? total / parcelas : 0;

  return (
    <Modal title="Nova compra (entrada no estoque)" onClose={fecharModal} wide>
      <Field label="Fornecedor">
        <select className={inputCls} value={fornecedorId} onChange={(e) => { setFornecedorId(e.target.value); setBusca(""); }}>
          <option value="">Sem cadastro</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </Field>

      {doFornecedor.length > 0 && (
        <div className="border border-slate-200 rounded-xl mb-4 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600">Produtos deste fornecedor ({doFornecedor.length})</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="text-sm border border-slate-200 rounded-lg px-2.5 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {listaForn.map((i) => (
              <div key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-900 truncate">{i.nome}</div>
                  <div className="text-xs text-slate-400">{ehDeFornecedor(i) ? "Sob encomenda" : `${i.qtd} em estoque`}{descricaoProduto(i) ? ` · ${descricaoProduto(i)}` : ""}</div>
                </div>
                <label className="text-xs text-slate-400 flex items-center gap-1">Custo
                  <input type="number" step="0.01" min="0" value={custos[i.id] ?? i.custo ?? ""} onChange={(e) => setCustos((x) => ({ ...x, [i.id]: e.target.value }))} className="w-20 border border-slate-200 rounded-md px-2 py-1 text-sm text-right text-slate-900" />
                </label>
                <label className="text-xs text-slate-400 flex items-center gap-1">Qtd
                  <input type="number" min="0" step="1" value={qtds[i.id] ?? ""} onChange={(e) => setQtds((x) => ({ ...x, [i.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addDaLista(i)} className="w-16 border border-slate-200 rounded-md px-2 py-1 text-sm text-right text-slate-900" />
                </label>
                <button type="button" onClick={() => addDaLista(i)} disabled={!(n(qtds[i.id]) > 0)} className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 disabled:text-slate-300" aria-label={`Adicionar ${i.nome}`}><Plus size={16} /></button>
              </div>
            ))}
            {listaForn.length === 0 && <div className="text-sm text-slate-400 text-center py-3">Nenhum produto encontrado.</div>}
          </div>
        </div>
      )}

      {doFornecedor.length > 0 && !verOutro ? (
        <button type="button" onClick={() => setVerOutro(true)} className="text-sm text-emerald-700 hover:underline mb-4">+ Outro produto (novo ou de outro fornecedor)</button>
      ) : (
      <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
        <div className="text-xs font-semibold text-slate-600 mb-3">Adicionar produto</div>
        <Field label="Produto" hint={existente ? `Produto já cadastrado · ${existente.qtd} em estoque` : nomeTrim ? "Produto novo: será cadastrado no estoque" : null}>
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto (novo ou existente)" list="lista-produtos" />
          <datalist id="lista-produtos">
            {estoque.map((i) => <option key={i.id} value={i.nome} />)}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade">
            <input type="number" min="1" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
          </Field>
          <Field label="Custo unitário (US$)">
            <input type="number" step="0.01" min="0" className={inputCls} value={custo} onChange={(e) => setCusto(n(e.target.value))} />
          </Field>
        </div>
        {isNovoProduto && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Preço varejo (US$) *">
              <input type="number" step="0.01" min="0" className={inputCls} value={varejo} onChange={(e) => setVarejo(n(e.target.value))} />
            </Field>
            <Field label="Preço atacado (US$) *">
              <input type="number" step="0.01" min="0" className={inputCls} value={atacado} onChange={(e) => setAtacado(n(e.target.value))} />
            </Field>
            <Field label="Preço lojista (US$) *">
              <input type="number" step="0.01" min="0" className={inputCls} value={lojista} onChange={(e) => setLojista(n(e.target.value))} />
            </Field>
          </div>
        )}
        <button type="button" onClick={addAoCarrinho} disabled={!podeAdicionar} className={btnSecundario + " w-full border-emerald-700/40 text-emerald-800"}>
          <Plus size={14} /> Adicionar à compra
        </button>
      </div>
      )}

      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-600 mb-2">Itens da compra ({carrinho.length})</div>
        {carrinho.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">Nenhum produto adicionado ainda.</div>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {carrinho.map((l) => (
              <div key={l.key} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{l.nome} × {l.qtd}</div>
                  <div className="text-xs text-slate-400">Custo {fmtUSD(l.custo)} un.</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{fmtUSD(l.custo * l.qtd)}</span>
                  <button onClick={() => setCarrinho((c) => c.filter((x) => x.key !== l.key))} className="text-slate-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Tipo da compra">
        <Segmentado valor={condicao} onChange={setCondicao} opcoes={CONDICOES} />
      </Field>
      {condicao === "À vista" && (
        <Field label="Pago com">
          <select className={inputCls} value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
            {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      )}
      {condicao === "A prazo" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="1º vencimento"><input type="date" className={inputCls} value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
            <Field label="Parcelas (mensais)">
              <input type="number" min="1" max="24" step="1" className={inputCls} value={parcelas} onChange={(e) => setParcelas(Math.max(1, Math.floor(n(e.target.value))))} />
            </Field>
          </div>
          <p className="text-xs text-slate-500 -mt-2 mb-4">Vai para Contas a pagar{parcelas > 1 ? ` em ${parcelas} parcelas de ${fmtUSD(valorParcela)}` : ""}. Não sai nada do caixa agora.</p>
        </>
      )}
      {condicao === "Consignado" && (
        <>
          <Field label="Data do acerto (opcional)"><input type="date" className={inputCls} value={dataAcerto} onChange={(e) => setDataAcerto(e.target.value)} /></Field>
          <p className="text-xs text-slate-500 -mt-2 mb-4">Os produtos entram no estoque sem pagar. No acerto você paga só o que vendeu e devolve o resto (em Compras ou no fornecedor).</p>
        </>
      )}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 mb-4">
        <span className="text-sm text-slate-500">Total da compra</span>
        <span className="text-lg font-semibold text-slate-900">{fmtUSD(total)}</span>
      </div>
      <button onClick={finalizar} disabled={!valido} className={btnPrimario + " w-full"}>
        Finalizar compra
      </button>
    </Modal>
  );
}

export function MovimentoModal() {
  const { movimentoManual, fecharModal } = useApp();
  const [caixaKey, setCaixaKey] = useState("pix");
  const [tipo, setTipo] = useState("Entrada");
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState("");
  return (
    <Modal title="Novo movimento de caixa" onClose={fecharModal}>
      <Field label="Caixa"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option>Entrada</option>
            <option>Saída</option>
          </select>
        </Field>
        <Field label={caixaEmReais(caixaKey) ? "Valor (R$)" : caixaKey === "usdt" ? "Valor (USDT)" : "Valor (US$)"}>
          <input type="number" step="0.01" min="0" className={inputCls} value={valor} onChange={(e) => setValor(n(e.target.value))} />
        </Field>
      </div>
      <Field label="Descrição">
        <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Troco inicial, retirada, depósito" />
      </Field>
      <button
        onClick={() => { movimentoManual(caixaKey, tipo, valor, descricao.trim() || "Movimento manual"); fecharModal(); }}
        disabled={!(valor > 0)}
        className={btnPrimario + " w-full"}
      >
        Registrar movimento
      </button>
    </Modal>
  );
}

export function ItemModal() {
  const { editando, estoque, fornecedores, salvarItem, excluirItem, fecharModal, responderPedidoProduto } = useApp();
  // Aberto pelo botão "Aprovar" de um produto cadastrado pelo vendedor.
  const pedido = editando?.pedido || null;
  const isEdit = !!editando?.id;
  const [nome, setNome] = useState(editando?.nome || "");
  const [qtd, setQtd] = useState(editando?.qtd ?? 0);
  const [custo, setCusto] = useState(editando?.custo ?? 0);
  const [custoVendedor, setCustoVendedor] = useState(editando?.custoVendedor ?? "");
  const [varejo, setVarejo] = useState(editando?.varejo ?? 0);
  const [atacado, setAtacado] = useState(editando?.atacado ?? 0);
  const [lojista, setLojista] = useState(editando?.lojista ?? editando?.atacado ?? 0);
  const [min, setMin] = useState(editando?.min ?? 3);
  const [marca, setMarca] = useState(editando?.marca || "");
  const [tipo, setTipo] = useState(editando?.tipo || "");
  const [origem, setOrigem] = useState(editando?.origem || "estoque");
  const [fornecedorId, setFornecedorId] = useState(editando ? editando.fornecedorId || "" : fornecedores[0]?.id || "");
  const [foto, setFoto] = useState(editando?.foto || null);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState(null);
  const urlFoto = useFoto(foto);
  const arquivoRef = useRef(null);
  const sugestoes = (campo) => [...new Set(estoque.map((i) => (i[campo] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const deFornecedor = origem === "fornecedor";

  const nomeTrim = nome.trim();
  const duplicado = estoque.some((i) => i.id !== editando?.id && normalizar(i.nome) === normalizar(nomeTrim));
  const invalid = !nomeTrim || duplicado || !(varejo > 0) || !(atacado > 0) || !(lojista > 0) || qtd < 0 || min < 0 || (deFornecedor && !fornecedorId);

  async function escolherFoto(arquivo) {
    if (!arquivo) return;
    setErroFoto(null);
    setCarregandoFoto(true);
    try {
      setFoto(await salvarFoto(await comprimir(arquivo)));
    } catch (e) {
      setErroFoto(e.message || "Não foi possível usar esta foto.");
    } finally {
      setCarregandoFoto(false);
    }
  }

  function save() {
    if (invalid) return;
    const forn = fornecedores.find((f) => f.id === fornecedorId);
    const id = salvarItem(
      {
        nome: nomeTrim, marca: marca.trim(), tipo: tipo.trim(), qtd: deFornecedor ? 0 : qtd, custo,
        custoVendedor: custoVendedor === "" ? null : n(custoVendedor), varejo, atacado, lojista, min: deFornecedor ? 0 : min,
        origem, fornecedorId: fornecedorId || "", fornecedorNome: fornecedorId ? forn?.nome || "" : "", foto: foto || null,
      },
      isEdit ? editando : null
    );
    if (pedido) responderPedidoProduto(pedido.id, "Aprovado", id);
    fecharModal();
  }

  return (
    <Modal title={pedido ? "Aprovar entrada do produto" : isEdit ? "Editar produto" : "Novo produto"} onClose={fecharModal} wide>
      {pedido && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Cadastrado por <b>{pedido.vendedorNome}</b> em {fmtDate(pedido.data)}. Confira os preços e o custo; ao salvar, o produto entra no estoque.
          {pedido.obs && <div className="mt-1 text-amber-700">Obs.: {pedido.obs}</div>}
        </div>
      )}
      <div className="flex gap-4 items-start mb-4 flex-wrap sm:flex-nowrap">
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            className="w-28 h-28 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex items-center justify-center overflow-hidden text-slate-400"
            title="Escolher foto"
          >
            {carregandoFoto ? <Loader2 size={18} className="animate-spin" /> : urlFoto ? <img src={urlFoto} alt="" className="w-full h-full object-cover" /> : (
              <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus size={20} /> Foto</span>
            )}
          </button>
          <input ref={arquivoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
          {foto && <button type="button" onClick={() => setFoto(null)} className="block w-28 text-center text-[11px] text-slate-500 hover:text-red-600 mt-1">Remover foto</button>}
          {erroFoto && <div className="w-28 text-[11px] text-red-600 mt-1">{erroFoto}</div>}
        </div>
        <div className="flex-1 min-w-0 w-full">
          <Field label="Nome do produto">
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            {duplicado && <div className="text-xs text-red-600 mt-1">Já existe um produto com esse nome.</div>}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca / laboratório">
              <input className={inputCls} list="sugestoes-marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Bayer" />
              <datalist id="sugestoes-marca">{sugestoes("marca").map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Tipo">
              <input className={inputCls} list="sugestoes-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ex.: Analgésico" />
              <datalist id="sugestoes-tipo">{sugestoes("tipo").map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
          </div>
        </div>
      </div>

      <Field label="Onde fica o produto">
        <Segmentado
          valor={origem}
          onChange={setOrigem}
          opcoes={[{ valor: "estoque", label: "No meu estoque" }, { valor: "fornecedor", label: "No fornecedor (sob encomenda)" }]}
        />
      </Field>
      {deFornecedor ? (
        <Field label="Fornecedor" hint="Você vende e pede ao fornecedor. Não entra na conta do estoque.">
          {fornecedores.length === 0 ? (
            <div className="text-sm text-amber-700">Cadastre o fornecedor primeiro em Fornecedores.</div>
          ) : (
            <select className={inputCls} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="" disabled>Escolha o fornecedor</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
        </Field>
      ) : (
        <>
        {fornecedores.length > 0 && (
          <Field label="Fornecedor (opcional)">
            <select className={inputCls} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">Nenhum</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade em estoque" hint={isEdit ? "Altere só se contou o estoque." : null}>
            <input type="number" min="0" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
          </Field>
          <Field label="Estoque mínimo" hint="Avisa quando chegar nesse número.">
            <input type="number" min="0" step="1" className={inputCls} value={min} onChange={(e) => setMin(Math.floor(n(e.target.value)))} />
          </Field>
        </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Custo real (US$)" hint="Só você vê.">
          <input type="number" step="0.01" min="0" className={inputCls} value={custo} onChange={(e) => setCusto(n(e.target.value))} />
        </Field>
        <Field label="Custo para vendedores (US$)" hint="O vendedor vê este custo e ganha comissão sobre o lucro em cima dele. Em branco, vale o custo real.">
          <input type="number" step="0.01" min="0" className={inputCls} value={custoVendedor} onChange={(e) => setCustoVendedor(e.target.value)} placeholder="—" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Varejo (US$) *">
          <input type="number" step="0.01" min="0" className={inputCls} value={varejo} onChange={(e) => setVarejo(n(e.target.value))} />
        </Field>
        <Field label="Atacado (US$) *">
          <input type="number" step="0.01" min="0" className={inputCls} value={atacado} onChange={(e) => setAtacado(n(e.target.value))} />
        </Field>
        <Field label="Lojista (US$) *">
          <input type="number" step="0.01" min="0" className={inputCls} value={lojista} onChange={(e) => setLojista(n(e.target.value))} />
        </Field>
      </div>
      {custo > 0 && (varejo > 0 || atacado > 0 || lojista > 0) && (
        <div className="text-xs text-slate-500 -mt-2 mb-4">
          Margem real: {[["varejo", varejo], ["atacado", atacado], ["lojista", lojista]]
            .map(([l, v]) => `${l} ${v > 0 ? Math.round(((v - custo) / v) * 100) : 0}%`)
            .join(" · ")}
        </div>
      )}
      {isEdit && (
        <button onClick={() => excluirItem(editando) && fecharModal()} className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium">
          Excluir produto
        </button>
      )}
      <button onClick={save} disabled={invalid || carregandoFoto} className={btnPrimario + " w-full"}>
        {pedido ? "Aprovar e dar entrada" : isEdit ? "Salvar alterações" : "Cadastrar produto"}
      </button>
    </Modal>
  );
}

// O vendedor cadastra um produto novo; ele só entra no estoque depois que o dono aprova.
export function PedidoProdutoModal() {
  const { estoque, pedidosProduto, pedirProduto, fecharModal } = useApp();
  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [tipo, setTipo] = useState("");
  const [qtd, setQtd] = useState(1);
  const [custo, setCusto] = useState("");
  const [varejo, setVarejo] = useState(0);
  const [atacado, setAtacado] = useState(0);
  const [lojista, setLojista] = useState(0);
  const [obs, setObs] = useState("");
  const sugestoes = (campo) => [...new Set(estoque.map((i) => (i[campo] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const nomeTrim = nome.trim();
  const duplicado = estoque.some((i) => normalizar(i.nome) === normalizar(nomeTrim))
    || pedidosProduto.some((p) => p.status === "Pendente" && normalizar(p.nome) === normalizar(nomeTrim));
  const invalid = !nomeTrim || duplicado || !(qtd > 0) || !(varejo > 0);

  function save() {
    if (invalid) return;
    pedirProduto({
      nome: nomeTrim, marca: marca.trim(), tipo: tipo.trim(), qtd, custo: custo === "" ? null : n(custo),
      varejo, atacado: atacado > 0 ? atacado : varejo, lojista: lojista > 0 ? lojista : atacado > 0 ? atacado : varejo, obs: obs.trim(),
    });
    fecharModal();
  }

  return (
    <Modal title="Adicionar produto" onClose={fecharModal} wide>
      <p className="text-sm text-slate-500 mb-4">O produto fica aguardando o dono aprovar. Depois de aprovado, ele entra no estoque.</p>
      <Field label="Nome do produto">
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        {duplicado && <div className="text-xs text-red-600 mt-1">Esse produto já está no estoque ou aguardando aprovação.</div>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca">
          <input className={inputCls} list="pedido-marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
          <datalist id="pedido-marca">{sugestoes("marca").map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Tipo">
          <input className={inputCls} list="pedido-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} />
          <datalist id="pedido-tipo">{sugestoes("tipo").map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade *">
          <input type="number" min="1" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} />
        </Field>
        <Field label="Custo (US$)" hint="Quanto custou, se souber.">
          <input type="number" step="0.01" min="0" className={inputCls} value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="—" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Varejo (US$) *">
          <input type="number" step="0.01" min="0" className={inputCls} value={varejo} onChange={(e) => setVarejo(n(e.target.value))} />
        </Field>
        <Field label="Atacado (US$)">
          <input type="number" step="0.01" min="0" className={inputCls} value={atacado} onChange={(e) => setAtacado(n(e.target.value))} />
        </Field>
        <Field label="Lojista (US$)">
          <input type="number" step="0.01" min="0" className={inputCls} value={lojista} onChange={(e) => setLojista(n(e.target.value))} />
        </Field>
      </div>
      <Field label="Observação para o dono">
        <input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: chegou do fornecedor X" />
      </Field>
      <button onClick={save} disabled={invalid} className={btnPrimario + " w-full"}>Enviar para aprovação</button>
    </Modal>
  );
}

const CATEGORIAS = ["Água", "Energia", "Internet", "Aluguel", "Salários", "Impostos", "Fornecedor", "Outro"];

export function ContaModal() {
  const { editando, salvarConta, excluirConta, fecharModal } = useApp();
  const isEdit = !!editando;
  const [nome, setNome] = useState(editando?.nome || "");
  const [categoria, setCategoria] = useState(editando?.categoria || "Água");
  const [valor, setValor] = useState(editando?.valor ?? 0);
  const [moeda, setMoeda] = useState(editando?.moeda || "USD");
  const [vencimento, setVencimento] = useState(editando?.vencimento || todayISO());
  const valido = nome.trim() && valor > 0 && vencimento;

  return (
    <Modal title={isEdit ? "Editar conta" : "Nova conta a pagar"} onClose={fecharModal}>
      <Field label="Categoria">
        <select className={inputCls} value={categoria} onChange={(e) => { setCategoria(e.target.value); if (!isEdit && !nome) setNome(e.target.value); }}>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Nome da conta"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Energia - Loja" /></Field>
      <Field label="Moeda da conta">
        <Segmentado valor={moeda} onChange={setMoeda} opcoes={[{ valor: "USD", label: "Dólar (US$)" }, { valor: "BRL", label: "Reais (R$)" }]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={moeda === "BRL" ? "Valor (R$)" : "Valor (US$)"}><input type="number" step="0.01" min="0" className={inputCls} value={valor} onChange={(e) => setValor(n(e.target.value))} /></Field>
        <Field label="Vencimento"><input type="date" className={inputCls} value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
      </div>
      {isEdit && (
        <button onClick={() => excluirConta(editando) && fecharModal()} className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium">
          Excluir conta
        </button>
      )}
      <button
        onClick={() => { salvarConta({ nome: nome.trim(), categoria, valor, moeda, vencimento }, editando); fecharModal(); }}
        disabled={!valido}
        className={btnPrimario + " w-full"}
      >
        {isEdit ? "Salvar alterações" : "Adicionar conta"}
      </button>
    </Modal>
  );
}

export function PagarContaModal() {
  const { editando: conta, pagarConta, fecharModal, contaNaMoedaDoCaixa, cambio } = useApp();
  const [caixaKey, setCaixaKey] = useState(conta?.moeda === "BRL" ? "pix" : "dolar");
  const [valor, setValor] = useState(() => (conta ? String(contaNaMoedaDoCaixa(conta, conta.moeda === "BRL" ? "pix" : "dolar")) : ""));
  if (!conta) return null;
  const meta = CAIXA_META[caixaKey];
  const trocarCaixa = (k) => { setCaixaKey(k); setValor(String(contaNaMoedaDoCaixa(conta, k))); };
  const convertido = (conta.moeda === "BRL") !== caixaEmReais(caixaKey);
  const v = Math.round(n(valor) * 100) / 100;
  return (
    <Modal title={`Pagar: ${conta.nome}`} onClose={fecharModal}>
      <div className="text-sm text-slate-600 mb-4">
        Valor: <span className="font-semibold text-slate-900">{fmtConta(conta)}</span> · Vencimento: {fmtDate(conta.vencimento)}
      </div>
      <Field label="Pago com (caixa)">
        <div className="grid grid-cols-2 gap-2">
          {["pix", "real", "dolar", "usdt"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => trocarCaixa(k)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${caixaKey === k ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <div className="text-sm font-medium text-slate-800">{CAIXA_META[k].label}</div>
              <div className="text-xs text-slate-500">{CAIXA_META[k].format(contaNaMoedaDoCaixa(conta, k))}</div>
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Quanto saiu do caixa (${caixaEmReais(caixaKey) ? "R$" : caixaKey === "usdt" ? "USDT" : "US$"})`}>
        <input type="number" step="0.01" min="0" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} />
      </Field>
      {convertido && <div className="text-xs text-slate-500 -mt-1 mb-3">Convertido pelo câmbio de hoje (R$ {Number(cambio.chacoCompra).toFixed(2).replace(".", ",")}). Pode mudar se pagou outro valor.</div>}
      <button disabled={!(v > 0)} onClick={() => { pagarConta(conta.id, caixaKey, v); fecharModal(); }} className={btnPrimario + " w-full disabled:opacity-50"}>
        Confirmar pagamento ({meta.format(v)})
      </button>
    </Modal>
  );
}

export function ReceberVendaModal() {
  const { editando: venda, marcarVendaPaga, fecharModal, cambio } = useApp();
  const [caixaKey, setCaixaKey] = useState(venda?.pagamento ? caixaDoPagamento(venda.pagamento) : "pix");
  const falta = venda ? faltaReceber(venda) : 0;
  const [valor, setValor] = useState(falta ? String(falta) : "");
  if (!venda) return null;
  const pago = valorPagoDaVenda(venda);
  const v = Math.round(n(valor) * 100) / 100;
  const parcial = v > 0 && v < falta - 0.004;
  const invalido = !(v > 0) || v > falta + 0.004;
  return (
    <Modal title={`Receber venda #${venda.numero}`} onClose={fecharModal}>
      <div className="text-sm text-slate-600 mb-4 space-y-1">
        <div>Cliente: <span className="font-medium text-slate-900">{venda.clienteNome}</span> · Valor: <span className="font-semibold text-slate-900">{fmtUSD(venda.valor)}</span></div>
        {(venda.pagamentos || []).map((p, i) => (
          <div key={i} className="text-xs text-slate-500">Pagou {fmtUSD(p.valor)} em {fmtDate(p.data)} ({CAIXA_META[p.caixa]?.label || p.caixa})</div>
        ))}
        {pago > 0 && <div>Falta: <span className="font-semibold text-amber-700">{fmtUSD(falta)}</span></div>}
      </div>
      <Field label="Quanto o cliente pagou (US$)">
        <input type="number" min="0" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} />
      </Field>
      <div className="text-xs mb-3 -mt-1 min-h-4">
        {v > falta + 0.004 ? <span className="text-red-600">Maior do que falta pagar ({fmtUSD(falta)}).</span>
          : parcial ? <span className="text-amber-700">Pagamento parcial. Depois disso ainda faltam {fmtUSD(falta - v)}.</span>
          : <span className="text-slate-400">Com esse valor a venda fica paga.</span>}
      </div>
      <Field label="Recebido em"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      {caixaEmReais(caixaKey) && v > 0 && (
        <div className="text-xs text-slate-500 -mt-1 mb-3">
          Entra no {CAIXA_META[caixaKey].label}: <span className="font-medium text-slate-900">{CAIXA_META[caixaKey].format(paraMoedaDoCaixa(caixaKey, v, cambio))}</span> (câmbio R$ {Number(cambio.chacoCompra).toFixed(2).replace(".", ",")})
        </div>
      )}
      <button disabled={invalido} onClick={() => { marcarVendaPaga(venda.id, caixaKey, v); fecharModal(); }} className={btnPrimario + " w-full disabled:opacity-50"}>
        {parcial ? "Registrar pagamento parcial" : "Confirmar recebimento"}
      </button>
    </Modal>
  );
}

export function PessoaModal({ tipo }) {
  const { editando, salvarPessoa, fecharModal, vendedores, ehVendedor } = useApp();
  const [vendedorId, setVendedorId] = useState(editando?.vendedorId || "");
  const isCliente = tipo === "cliente";
  const [nome, setNome] = useState(editando?.nome || "");
  const [contato, setContato] = useState(editando?.contato || "");
  const [obs, setObs] = useState(editando?.obs || "");
  const [tabela, setTabela] = useState(editando?.tabela || "Varejo");
  const [endereco, setEndereco] = useState(editando?.endereco || "");
  const [cidade, setCidade] = useState(editando?.cidade || "");
  const [limite, setLimite] = useState(editando?.limiteCredito ?? "");
  const titulo = (editando ? "Editar " : "Novo ") + (isCliente ? "cliente" : "fornecedor");
  return (
    <Modal title={titulo} onClose={fecharModal}>
      <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
      <Field label="WhatsApp / telefone" hint="Com código do país, ex.: +595 981 234 567. Usado para enviar mensagens pelo WhatsApp.">
        <input className={inputCls} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="+595 981 234 567" />
      </Field>
      {isCliente && !ehVendedor && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tabela de preço do cliente" hint="Usada nas vendas e na lista de preços enviada a ele.">
            <Segmentado valor={tabela} onChange={setTabela} opcoes={TABELAS} />
          </Field>
          <Field label="Limite de crédito (US$)" hint="Máximo que ele pode dever em vendas a prazo. Em branco, sem limite.">
            <input type="number" step="0.01" min="0" className={inputCls} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Sem limite" />
          </Field>
        </div>
      )}
      {isCliente && ehVendedor && (
        <div className="text-sm text-slate-500 mb-4">Tabela de preço: <span className="font-medium text-slate-700">{editando?.tabela || "Varejo"}</span>. Só o dono muda a tabela.</div>
      )}
      {isCliente && !ehVendedor && (
        <Field label="Vendedor responsável" hint="O vendedor vê e atende só os clientes dele.">
          <select className={inputCls} value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
            <option value="">Nenhum (só o dono vê)</option>
            {vendedores.filter((v) => v.ativo !== false || v.id === vendedorId).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Field>
      )}
      {isCliente && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Field label="Endereço de entrega" hint="Vai junto no pedido de cotação aos freteiros.">
              <input className={inputCls} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
            </Field>
          </div>
          <Field label="Cidade"><input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Encarnación" /></Field>
        </div>
      )}
      <Field label="Observação"><input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Field>
      <button
        onClick={() => {
          const dados = { nome: nome.trim(), contato: contato.trim(), obs: obs.trim() };
          if (isCliente) Object.assign(dados, { tabela, endereco: endereco.trim(), cidade: cidade.trim() });
          if (isCliente && !ehVendedor) Object.assign(dados, { vendedorId, limiteCredito: limite === "" ? null : n(limite) });
          salvarPessoa(tipo, dados, editando);
          fecharModal();
        }}
        disabled={!nome.trim()}
        className={btnPrimario + " w-full"}
      >
        Salvar
      </button>
    </Modal>
  );
}

export function CambioModal() {
  const { cambio, setCambio, fecharModal } = useApp();
  return (
    <Modal title="Ajustar câmbio" onClose={fecharModal}>
      <CambioForm initial={cambio} onSave={(v) => { setCambio({ ...cambio, ...v }); fecharModal(); }} />
    </Modal>
  );
}

// Sincronização entre computadores, backup e instalação.
export function DadosModal() {
  const { sync, baixarBackup, baixarBackupDoDia, restaurarBackup, fecharModal, instalar, setInstalar, ehVendedor } = useApp();
  const [automaticos, setAutomaticos] = useState(null);
  React.useEffect(() => { if (!ehVendedor) listarBackups().then(setAutomaticos).catch(() => setAutomaticos([])); }, [ehVendedor]);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const arquivo = useRef(null);

  async function entrar(e) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    try {
      await db.entrar(email.trim(), senha);
      setSenha("");
      setMsg("Pronto, este computador agora sincroniza com a nuvem.");
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function restaurar(ev) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    if (!window.confirm("Importar este backup? Os registros do arquivo serão juntados aos dados atuais (registros iguais serão substituídos pela versão do arquivo).")) return;
    setOcupado(true); setErro(null); setMsg(null);
    try {
      const qtd = await restaurarBackup(f);
      setMsg(`Backup importado: ${qtd} registros.`);
    } catch (err) {
      setErro(err.message || "Não foi possível importar o arquivo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal title="Dados, sincronização e backup" onClose={fecharModal}>
      <Erro>{erro}</Erro>
      {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>}

      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-900 mb-1">Sincronização entre computadores</div>
        {!sync.configurado ? (
          <p className="text-sm text-slate-500">
            Os dados estão salvos só neste computador. A sincronização com a nuvem ainda não foi configurada neste sistema.
          </p>
        ) : sync.logado ? (
          <div className="text-sm text-slate-600 space-y-2">
            <p>Conectado como <span className="font-medium text-slate-900">{db.nomeDeLogin(sync.email)}</span>.</p>
            <p>
              {!sync.online
                ? "Sem internet agora. Continue usando normalmente: tudo fica salvo aqui e é enviado quando a internet voltar."
                : sync.erro
                ? `Erro na última tentativa: ${sync.erro}`
                : sync.ultimaSync
                ? `Última sincronização às ${fmtHora(sync.ultimaSync)}.`
                : "Sincronizando..."}
              {sync.pendentes > 0 && ` ${sync.pendentes} alterações aguardando envio.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => db.sincronizar()} disabled={!sync.online || sync.sincronizando} className={btnSecundario}>
                {sync.sincronizando ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />} Sincronizar agora
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm("Sair da conta neste computador? Os dados continuam guardados na nuvem, mas saem deste computador até alguém entrar de novo.")) return;
                  try {
                    await db.sair();
                  } catch (e) {
                    setMsg(e.message);
                  }
                }}
                className={btnSecundario}
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={entrar}>
            <p className="text-sm text-slate-500 mb-3">Entre com a conta da loja para este computador enviar e receber os dados da nuvem.</p>
            <Field label="Usuário"><input type="text" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="Ex.: thalles" /></Field>
            <Field label="Senha"><input type="password" required className={inputCls} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></Field>
            <button type="submit" disabled={ocupado || !sync.online} className={btnPrimario + " w-full"}>
              {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} {sync.online ? "Entrar" : "Sem internet"}
            </button>
          </form>
        )}
      </div>

      {!ehVendedor && (
      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-900 mb-1">Backup</div>
        <p className="text-sm text-slate-500 mb-3">Baixe uma cópia de todos os dados para guardar no computador ou em um pendrive.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => baixarBackup()} className={btnSecundario}><Download size={14} /> Baixar backup</button>
          <button onClick={() => arquivo.current?.click()} disabled={ocupado} className={btnSecundario}><Upload size={14} /> Restaurar backup</button>
          <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={restaurar} />
        </div>
        <div className="text-xs font-medium text-slate-600 mt-4 mb-1">Backups automáticos (um por dia, neste computador)</div>
        {automaticos === null ? (
          <div className="text-xs text-slate-400">Carregando...</div>
        ) : automaticos.length === 0 ? (
          <div className="text-xs text-slate-400">O primeiro backup automático é feito hoje, alguns segundos depois de abrir o sistema.</div>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {automaticos.map((b) => (
              <div key={b.dia} className="flex items-center justify-between px-3 py-1.5 text-sm">
                <span className="text-slate-700">{fmtDate(b.dia)} <span className="text-xs text-slate-400">· {b.registros} registros</span></span>
                <button onClick={() => baixarBackupDoDia(b.dia)} className="text-xs font-medium text-emerald-700 hover:underline">Baixar</button>
              </div>
            ))}
          </div>
        )}
        {sync.configurado && <p className="text-xs text-slate-400 mt-2">Na nuvem, o Supabase também guarda um backup por dia.</p>}
      </div>
      )}

      <div>
        <div className="text-sm font-semibold text-slate-900 mb-1">Usar como aplicativo</div>
        <p className="text-sm text-slate-500 mb-3">
          Instale o Shopping 25 neste computador para abrir pelo ícone na área de trabalho, mesmo sem internet.
          {!instalar && " Se o botão não aparecer, use o menu do Chrome ou Edge: “Instalar Shopping 25”."}
        </p>
        {instalar && (
          <button
            onClick={async () => { instalar.prompt(); await instalar.userChoice; setInstalar(null); }}
            className={btnSecundario}
          >
            <Monitor size={14} /> Instalar no computador
          </button>
        )}
      </div>
    </Modal>
  );
}

export function VendedorModal() {
  const { editando, salvarVendedor, excluirVendedor, fecharModal, registrar, vendedoresTodos, responderIndicacao } = useApp();
  // Aberto pelo botão "Aprovar" de um vendedor indicado por outro vendedor.
  const indicacao = editando?.indicacao || null;
  const isEdit = !!editando?.id;
  const [nome, setNome] = useState(editando?.nome || "");
  const [contato, setContato] = useState(editando?.contato || "");
  const [comissao, setComissao] = useState(editando?.comissao ?? COMISSAO_PADRAO);
  const [comissaoIndicacao, setComissaoIndicacao] = useState(editando?.comissaoIndicacao ?? COMISSAO_INDICACAO_PADRAO);
  const [indicadoPor, setIndicadoPor] = useState(editando?.indicadoPor || "");
  const [meta, setMeta] = useState(editando?.meta ?? 0);
  const [ativo, setAtivo] = useState(editando?.ativo !== false);
  const [podeCadastrarProduto, setPodeCadastrarProduto] = useState(!!editando?.podeCadastrarProduto);
  const [podeIndicarVendedor, setPodeIndicarVendedor] = useState(!!editando?.podeIndicarVendedor);
  const [email, setEmail] = useState(editando?.email || "");
  const [senha, setSenha] = useState("");
  const [estadoSenha, setEstadoSenha] = useState(null); // { ok, texto }
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const loginTrim = email.trim().toLowerCase();
  const emailOk = !loginTrim || /^[a-z0-9._+-]+$/.test(loginTrim) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginTrim);
  async function gravarSenha() {
    setSalvandoSenha(true); setEstadoSenha(null);
    try {
      await db.definirLogin(loginTrim, senha);
      registrar("Vendedor", `Login de ${nomeVendedor} criado ou senha trocada (usuário "${db.nomeDeLogin(loginTrim)}")`);
      setSenha("");
      setEstadoSenha({ ok: true, texto: `Pronto: ${nomeVendedor} entra com o usuário "${db.nomeDeLogin(loginTrim)}" e esta senha. Salve o vendedor para valer.` });
    } catch (e) {
      setEstadoSenha({ ok: false, texto: e.message });
    } finally {
      setSalvandoSenha(false);
    }
  }
  const nomeVendedor = nome.trim() || "O vendedor";
  const valido = nome.trim() && comissao >= 0 && comissao <= 100 && comissaoIndicacao >= 0 && comissaoIndicacao <= 100 && meta >= 0 && emailOk;
  // Só 1 nível: quem indica não pode ser ele mesmo.
  const podemIndicar = vendedoresTodos.filter((v) => v.id !== editando?.id);
  function salvar() {
    const id = salvarVendedor(
      { nome: nome.trim(), contato: contato.trim(), comissao, comissaoIndicacao, indicadoPor: indicadoPor || null, meta, ativo, podeCadastrarProduto, podeIndicarVendedor, email: email.trim().toLowerCase() },
      isEdit ? editando : null
    );
    if (indicacao) responderIndicacao(indicacao.id, "Aprovado", id);
    fecharModal();
  }
  return (
    <Modal title={indicacao ? "Aprovar vendedor indicado" : isEdit ? "Editar vendedor" : "Novo vendedor"} onClose={fecharModal}>
      {indicacao && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Indicado por <b>{indicacao.vendedorNome}</b> em {fmtDate(indicacao.data)}. Crie o login e salve para aprovar.
          {indicacao.obs && <div className="mt-1 text-amber-700">Obs.: {indicacao.obs}</div>}
        </div>
      )}
      <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
      <Field label="WhatsApp / telefone"><input className={inputCls} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="+595 981 234 567" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Comissão (%)" hint="Sobre o lucro de cada venda dele (preço menos o custo para vendedores).">
          <input type="number" step="0.1" min="0" max="100" className={inputCls} value={comissao} onChange={(e) => setComissao(n(e.target.value))} />
        </Field>
        <Field label="Meta do mês (US$)" hint="Deixe 0 para não ter meta.">
          <input type="number" step="1" min="0" className={inputCls} value={meta} onChange={(e) => setMeta(n(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Indicado por" hint="Quem trouxe este vendedor ganha comissão sobre o lucro das vendas dele.">
          <select className={inputCls} value={indicadoPor} onChange={(e) => setIndicadoPor(e.target.value)}>
            <option value="">Ninguém</option>
            {podemIndicar.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Field>
        <Field label="Comissão sobre indicados (%)" hint="O que este vendedor ganha sobre o lucro dos vendedores que ele indicar.">
          <input type="number" step="0.1" min="0" max="100" className={inputCls} value={comissaoIndicacao} onChange={(e) => setComissaoIndicacao(n(e.target.value))} />
        </Field>
      </div>
      <div className="border border-slate-200 rounded-xl p-4 mb-4">
        <div className="text-sm font-semibold text-slate-900 mb-1">Acesso ao sistema</div>
        <p className="text-xs text-slate-500 mb-3">Com este usuário e senha o vendedor entra e vê só os clientes, vendas e orçamentos dele.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Usuário">
            <input type="text" className={inputCls} value={email} onChange={(e) => { setEmail(e.target.value); setEstadoSenha(null); }} placeholder="Ex.: lucas" autoCapitalize="none" autoComplete="off" />
            {!emailOk && <div className="text-xs text-red-600 mt-1">Use só letras, números, ponto ou traço.</div>}
          </Field>
          <Field label={isEdit && editando?.email ? "Nova senha" : "Senha"} hint="Mínimo de 6 caracteres.">
            <input type="text" className={inputCls} value={senha} onChange={(e) => { setSenha(e.target.value); setEstadoSenha(null); }} autoComplete="new-password" placeholder={isEdit && editando?.email ? "Para trocar a senha" : ""} />
          </Field>
        </div>
        <button type="button" onClick={gravarSenha} disabled={!loginTrim || !emailOk || senha.length < 6 || salvandoSenha} className={btnSecundario}>
          {salvandoSenha ? <Loader2 size={14} className="animate-spin" /> : null} {isEdit && editando?.email && editando.email === loginTrim ? "Trocar a senha" : "Criar login"}
        </button>
        {estadoSenha && <div className={`text-xs mt-2 ${estadoSenha.ok ? "text-emerald-700" : "text-red-600"}`}>{estadoSenha.texto}</div>}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        Ativo (aparece na hora de registrar a venda e pode entrar no sistema)
      </label>
      <div className="border border-slate-200 rounded-xl p-4 mb-4">
        <div className="text-sm font-semibold text-slate-900 mb-1">O que este vendedor pode fazer</div>
        <p className="text-xs text-slate-500 mb-3">Vender, fazer orçamentos e cadastrar os próprios clientes ele sempre pode.</p>
        <label className="flex items-start gap-2 text-sm text-slate-700 mb-2">
          <input type="checkbox" checked={podeCadastrarProduto} onChange={(e) => setPodeCadastrarProduto(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
          <span>Cadastrar produtos <span className="text-xs text-slate-400">(entram no estoque depois que o dono aprova)</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={podeIndicarVendedor} onChange={(e) => setPodeIndicarVendedor(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
          <span>Indicar vendedores abaixo dele <span className="text-xs text-slate-400">(o dono aprova; ele ganha comissão sobre o lucro deles)</span></span>
        </label>
      </div>
      {isEdit && (
        <button onClick={() => excluirVendedor(editando) && fecharModal()} className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium">
          Excluir vendedor
        </button>
      )}
      <button disabled={!valido} onClick={salvar} className={btnPrimario + " w-full"}>
        {indicacao ? "Aprovar vendedor" : "Salvar"}
      </button>
    </Modal>
  );
}

// Monta a lista de preços e abre o WhatsApp com ela já escrita.
export function ListaPrecosModal() {
  const { editando: cliente, estoque, clientes, fecharModal } = useApp();
  const [clienteId, setClienteId] = useState(cliente?.id || "");
  const escolhido = clientes.find((c) => c.id === clienteId);
  const [tabela, setTabela] = useState(cliente?.tabela || "Varejo");
  const [soComEstoque, setSoComEstoque] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [desmarcados, setDesmarcados] = useState(() => new Set());
  const [copiado, setCopiado] = useState(false);
  const [texto, setTexto] = useState(null); // null = gerado automaticamente
  const [comFotos, setComFotos] = useState(false);
  const temNuvem = !!urlPublica("x");

  const candidatos = estoque.filter((i) => !soComEstoque || ehDeFornecedor(i) || i.qtd > 0);
  const visiveis = candidatos.filter((i) => produtoCombina(i, filtro));
  const selecionados = candidatos.filter((i) => !desmarcados.has(i.id));

  const gerado = [
    `*Shopping 25 · Lista de preços${tabela === "Varejo" ? "" : " " + tabela.toLowerCase()}*`,
    fmtDate(todayISO()),
    "",
    ...selecionados.map((i) => `• ${i.nome}: ${fmtUSD(precoDe(i, tabela))}${comFotos && i.foto ? `\n  Foto: ${urlPublica(i.foto)}` : ""}`),
    "",
    "Valores em dólar, sujeitos a alteração. Para fazer seu pedido, é só responder esta mensagem.",
  ].join("\n");
  const mensagem = texto ?? (escolhido ? `Olá, ${escolhido.nome}! ` : "") + gerado;
  const link = linkWhatsApp(escolhido?.contato, mensagem);

  function alternar(id) {
    setTexto(null);
    setDesmarcados((d) => {
      const novo = new Set(d);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      document.getElementById("texto-lista")?.select();
    }
  }

  return (
    <Modal title="Enviar lista de preços" onClose={fecharModal} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cliente">
          <select
            className={inputCls}
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              const c = clientes.find((x) => x.id === e.target.value);
              if (c?.tabela) setTabela(c.tabela);
              setTexto(null);
            }}
          >
            <option value="">Escolher no WhatsApp</option>
            {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <Field label="Tabela de preço">
          <Segmentado valor={tabela} onChange={(v) => { setTabela(v); setTexto(null); }} opcoes={TABELAS} />
        </Field>
      </div>

      <div className="border border-slate-200 rounded-xl mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 border-b border-slate-100">
          <input className="text-sm border border-slate-200 rounded-md px-2.5 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Filtrar produtos..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={soComEstoque} onChange={(e) => { setSoComEstoque(e.target.checked); setTexto(null); }} className="rounded border-slate-300 text-emerald-700" />
              Só com estoque
            </label>
            {temNuvem && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={comFotos} onChange={(e) => { setComFotos(e.target.checked); setTexto(null); }} className="rounded border-slate-300 text-emerald-700" />
                Com link das fotos
              </label>
            )}
            <button className="text-emerald-700 hover:underline" onClick={() => { setDesmarcados(new Set()); setTexto(null); }}>Marcar todos</button>
            <button className="text-emerald-700 hover:underline" onClick={() => { setDesmarcados(new Set(candidatos.map((i) => i.id))); setTexto(null); }}>Desmarcar</button>
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
          {visiveis.map((i) => (
            <label key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <span className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={!desmarcados.has(i.id)} onChange={() => alternar(i.id)} className="rounded border-slate-300 text-emerald-700" />
                <span className="truncate text-slate-800">{i.nome}</span>
              </span>
              <span className="font-medium text-slate-900 shrink-0">{fmtUSD(precoDe(i, tabela))}</span>
            </label>
          ))}
          {visiveis.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-400">Nenhum produto.</div>}
        </div>
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">{selecionados.length} produtos na lista</div>
      </div>

      <Field label="Mensagem" hint="Você pode editar o texto antes de enviar.">
        <textarea id="texto-lista" rows={6} className={inputCls + " font-mono text-xs"} value={mensagem} onChange={(e) => setTexto(e.target.value)} />
      </Field>

      {escolhido && !link && <div className="text-xs text-amber-700 mb-3">Este cliente não tem WhatsApp cadastrado. Você pode copiar o texto ou escolher o contato no WhatsApp.</div>}
      <div className="flex gap-2">
        <a
          href={link || linkWhatsApp(null, mensagem)}
          target="_blank"
          rel="noreferrer"
          className={btnPrimario + " flex-1" + (selecionados.length === 0 ? " pointer-events-none opacity-40" : "")}
        >
          <MessageCircle size={15} /> Abrir no WhatsApp
        </a>
        <button onClick={copiar} className={btnSecundario}>
          {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? "Copiado" : "Copiar texto"}
        </button>
      </div>
    </Modal>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const daquiA = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
// Próximo dia da semana (0 = domingo), sempre depois de hoje.
const proximoDia = (dow) => {
  const d = new Date();
  const dif = ((dow - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + dif);
  return isoLocal(d);
};

// Agenda o próximo contato com o cliente (ex.: "vai fazer pedido na terça").
export function AgendarContatoModal() {
  const { editando: cliente, agendarContato, fecharModal } = useApp();
  const [data, setData] = useState(cliente?.proximoContato || daquiA(7));
  const [nota, setNota] = useState(cliente?.notaContato || "");
  if (!cliente) return null;
  const atalhos = [
    { label: "Amanhã", data: daquiA(1) },
    { label: "Em 3 dias", data: daquiA(3) },
    { label: "Em 1 semana", data: daquiA(7) },
    { label: "Em 15 dias", data: daquiA(15) },
  ];
  const valido = data && data >= todayISO();
  return (
    <Modal title={`Próximo contato: ${cliente.nome}`} onClose={fecharModal}>
      {cliente.ultimoContato === todayISO() && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Contato de hoje registrado. Quer agendar um lembrete para falar com o cliente de novo?
        </div>
      )}
      <Field label="Avisar em">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {atalhos.map((a) => (
            <button key={a.label} type="button" onClick={() => setData(a.data)} className={`px-2.5 py-1 text-xs font-medium rounded-md border ${data === a.data ? "bg-emerald-700 border-emerald-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[1, 2, 3, 4, 5, 6].map((dow) => {
            const d = proximoDia(dow);
            return (
              <button key={dow} type="button" onClick={() => setData(d)} title={fmtDate(d)} className={`px-2.5 py-1 text-xs font-medium rounded-md border ${data === d ? "bg-emerald-700 border-emerald-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {DIAS_SEMANA[dow]}
              </button>
            );
          })}
        </div>
        <input type="date" min={todayISO()} className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
      <Field label="Anotação" hint="Aparece junto com o lembrete.">
        <input className={inputCls} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: disse que faz o pedido na terça" />
      </Field>
      <div className="flex gap-2">
        <button disabled={!valido} onClick={() => { agendarContato(cliente.id, data, nota.trim()); fecharModal(); }} className={btnPrimario + " flex-1"}>
          Agendar lembrete
        </button>
        {cliente.proximoContato ? (
          <button onClick={() => { agendarContato(cliente.id, null, ""); fecharModal(); }} className={btnSecundario}>Remover lembrete</button>
        ) : (
          <button onClick={fecharModal} className={btnSecundario}>Não agendar</button>
        )}
      </div>
    </Modal>
  );
}

// Envia um produto ao cliente: a foto e o preço da tabela dele.
export function EnviarProdutoModal() {
  const { editando: item, clientes, fecharModal } = useApp();
  const [clienteId, setClienteId] = useState("");
  const cliente = clientes.find((c) => c.id === clienteId);
  const [tabela, setTabela] = useState("Varejo");
  const [texto, setTexto] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const urlFoto = useFoto(item?.foto);
  const linkFoto = urlPublica(item?.foto);
  if (!item) return null;

  const gerado = [
    cliente ? `Olá, ${cliente.nome}!` : null,
    `*${item.nome}*`,
    descricaoProduto(item) || null,
    `Preço${tabela === "Varejo" ? "" : " " + tabela.toLowerCase()}: *${fmtUSD(precoDe(item, tabela))}*`,
    ehDeFornecedor(item) ? "Sob encomenda." : null,
    "",
    "Para pedir, é só responder esta mensagem.",
  ].filter((l) => l !== null).join("\n");
  const mensagem = texto ?? gerado;
  const link = linkWhatsApp(cliente?.contato, mensagem);
  const blobFoto = () => obterFoto(item.foto);

  async function compartilhar() {
    setOcupado(true);
    setAviso(null);
    try {
      const blob = await blobFoto();
      if (!blob) throw new Error("A foto ainda não chegou a este computador.");
      if (!podeCompartilhar(blob)) throw new Error("Este navegador não compartilha fotos. Use \"Copiar foto\".");
      await compartilharFoto(blob, item.nome, mensagem);
    } catch (e) {
      if (e?.name !== "AbortError") setAviso(e.message || "Não foi possível compartilhar.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    setOcupado(true);
    setAviso(null);
    try {
      const blob = await blobFoto();
      if (!blob) throw new Error("A foto ainda não chegou a este computador.");
      await copiarFoto(blob);
      setAviso("Foto copiada. Abra a conversa no WhatsApp e cole com Ctrl+V.");
    } catch (e) {
      setAviso(e.message && !/clipboard|denied|not allowed/i.test(e.message) ? e.message : "O navegador não deixou copiar a foto. Clique com o botão direito na foto e escolha Copiar imagem.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal title={`Enviar ao cliente · ${item.nome}`} onClose={fecharModal} wide>
      <div className="flex gap-4 flex-wrap sm:flex-nowrap mb-4">
        <div className="w-full sm:w-44 shrink-0">
          {urlFoto ? (
            <img src={urlFoto} alt={item.nome} className="w-full sm:w-44 aspect-square object-cover rounded-xl border border-slate-200" />
          ) : (
            <div className="w-full sm:w-44 aspect-square rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-xs text-slate-400 gap-1">
              <ImageIcon size={20} /> Sem foto
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Field label="Cliente">
            <select
              className={inputCls}
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                const c = clientes.find((x) => x.id === e.target.value);
                setTabela(c?.tabela || "Varejo");
                setTexto(null);
              }}
            >
              <option value="">Escolher no WhatsApp</option>
              {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Tabela de preço">
            <Segmentado valor={tabela} onChange={(v) => { setTabela(v); setTexto(null); }} opcoes={TABELAS} />
          </Field>
        </div>
      </div>
      <Field label="Mensagem" hint="Você pode editar o texto antes de enviar.">
        <textarea rows={5} className={inputCls + " font-mono text-xs"} value={mensagem} onChange={(e) => setTexto(e.target.value)} />
      </Field>
      {aviso && <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">{aviso}</div>}
      <div className="flex gap-2 flex-wrap">
        {item.foto && (
          <>
            <button onClick={compartilhar} disabled={ocupado} className={btnSecundario}><Share2 size={15} /> Compartilhar foto</button>
            <button onClick={copiar} disabled={ocupado} className={btnSecundario}><Copy size={15} /> Copiar foto</button>
          </>
        )}
        <a href={link || linkWhatsApp(null, mensagem)} target="_blank" rel="noreferrer" className={btnPrimario + " flex-1"}>
          <MessageCircle size={15} /> Abrir conversa no WhatsApp
        </a>
      </div>
      <div className="text-xs text-slate-400 mt-3">
        {item.foto
          ? "O WhatsApp não recebe foto por link. Copie a foto e cole na conversa, ou use Compartilhar foto e escolha o WhatsApp."
          : "Este produto ainda não tem foto. Coloque uma em Editar produto."}
        {linkFoto && item.foto ? " A foto também está na nuvem, se quiser mandar o link: " : ""}
        {linkFoto && item.foto && <a href={linkFoto} target="_blank" rel="noreferrer" className="text-emerald-700 underline break-all">{linkFoto}</a>}
      </div>
    </Modal>
  );
}

// O vendedor indica um vendedor novo; o dono aprova, cria o login e ele passa a vender.
export function IndicacaoModal() {
  const { indicarVendedor, fecharModal } = useApp();
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");
  const valido = nome.trim() && contato.trim();
  function save() {
    if (!valido) return;
    indicarVendedor({ nome: nome.trim(), contato: contato.trim(), obs: obs.trim() });
    fecharModal();
  }
  return (
    <Modal title="Indicar vendedor" onClose={fecharModal}>
      <p className="text-sm text-slate-500 mb-4">O dono recebe a indicação e cria o acesso. Você ganha comissão sobre o lucro das vendas de quem indicar.</p>
      <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
      <Field label="WhatsApp / telefone"><input className={inputCls} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="+595 981 234 567" /></Field>
      <Field label="Observação para o dono"><input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      <button onClick={save} disabled={!valido} className={btnPrimario + " w-full"}>Enviar indicação</button>
    </Modal>
  );
}
