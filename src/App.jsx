import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutGrid, ArrowUpRight, ArrowDownLeft, Wallet, Users, Truck,
  RefreshCw, Plus, X, Trash2, Search, Download, Home, Loader2, Pencil, Receipt, Check, Copy
} from "lucide-react";

const fmtUSD = (v) =>
  "US$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (v) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const fmtDateLong = () =>
  new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase();

const uid = () => Math.random().toString(36).slice(2, 9);
function todayISODefault(day) {
  const d = new Date();
  d.setDate(day);
  return d.toISOString().slice(0, 10);
}

const NAV = [
  { key: "visao", label: "Visão geral", icon: Home },
  { key: "estoque", label: "Estoque", icon: LayoutGrid },
  { key: "vendas", label: "Vendas", icon: ArrowUpRight },
  { key: "compras", label: "Compras", icon: ArrowDownLeft },
  { key: "caixa", label: "Caixa", icon: Wallet },
  { key: "contas", label: "Contas a pagar", icon: Receipt },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "fornecedores", label: "Fornecedores", icon: Truck },
  { key: "cambio", label: "Câmbio", icon: RefreshCw },
];

// ---- storage helpers ----
const STORAGE_KEYS = {
  estoque: "nexo-estoque",
  vendas: "nexo-vendas",
  compras: "nexo-compras",
  pessoas: "nexo-pessoas", // { clientes, fornecedores }
  caixa: "nexo-caixa", // { caixas, movimentos }
  cambio: "nexo-cambio",
  contas: "nexo-contas",
};

async function loadKey(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
    return fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Falha ao salvar", key, e);
  }
}

const DEFAULTS = {
  estoque: [
    { id: uid(), nome: "Smartphone Galaxy A54", qtd: 5, custo: 100, varejo: 150, atacado: 130, min: 3 },
    { id: uid(), nome: "Fone Bluetooth JBL", qtd: 5, custo: 80, varejo: 120, atacado: 100, min: 4 },
    { id: uid(), nome: "Carregador Turbo 20W", qtd: 8, custo: 72, varejo: 95, atacado: 80, min: 5 },
  ],
  vendas: [],
  compras: [],
  pessoas: { clientes: [{ id: uid(), nome: "João Silva", contato: "+595 981 234 567" }], fornecedores: [{ id: uid(), nome: "Distribuidora Central", contato: "+595 991 555 222" }] },
  caixa: { caixas: { usdt: 0, dolar: 0, pix: 0, real: 0 }, movimentos: [] },
  cambio: { tcr: 5.26, chacoCompra: 5.26, chacoVenda: 5.35, modo: "Manual" },
  contas: [
    { id: uid(), nome: "Água", categoria: "Água", valor: 45, vencimento: todayISODefault(10), status: "Pendente", dataPagamento: null },
    { id: uid(), nome: "Energia", categoria: "Energia", valor: 120, vencimento: todayISODefault(15), status: "Pendente", dataPagamento: null },
    { id: uid(), nome: "Internet", categoria: "Internet", valor: 60, vencimento: todayISODefault(20), status: "Pendente", dataPagamento: null },
    { id: uid(), nome: "Aluguel", categoria: "Aluguel", valor: 500, vencimento: todayISODefault(5), status: "Pendente", dataPagamento: null },
  ],
};

function Badge({ status }) {
  const map = {
    Pago: "bg-emerald-50 text-emerald-700",
    Pendente: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent";

export default function ColorShopDashboard() {
  const [page, setPage] = useState("visao");
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [estoque, setEstoque] = useState(DEFAULTS.estoque);
  const [vendas, setVendas] = useState(DEFAULTS.vendas);
  const [compras, setCompras] = useState(DEFAULTS.compras);
  const [clientes, setClientes] = useState(DEFAULTS.pessoas.clientes);
  const [fornecedores, setFornecedores] = useState(DEFAULTS.pessoas.fornecedores);
  const [caixas, setCaixas] = useState(DEFAULTS.caixa.caixas);
  const [movimentos, setMovimentos] = useState(DEFAULTS.caixa.movimentos);
  const [cambio, setCambio] = useState(DEFAULTS.cambio);
  const [contas, setContas] = useState(DEFAULTS.contas);

  const [modal, setModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingConta, setEditingConta] = useState(null);
  const [payingConta, setPayingConta] = useState(null);
  const [receivingVenda, setReceivingVenda] = useState(null);

  // ---- load from persistent storage on mount ----
  useEffect(() => {
    (async () => {
      const isFirstRun = window.localStorage.getItem(STORAGE_KEYS.estoque) == null;

      const [est, ven, comp, pes, cx, cam, cts] = await Promise.all([
        loadKey(STORAGE_KEYS.estoque, DEFAULTS.estoque),
        loadKey(STORAGE_KEYS.vendas, DEFAULTS.vendas),
        loadKey(STORAGE_KEYS.compras, DEFAULTS.compras),
        loadKey(STORAGE_KEYS.pessoas, DEFAULTS.pessoas),
        loadKey(STORAGE_KEYS.caixa, DEFAULTS.caixa),
        loadKey(STORAGE_KEYS.cambio, DEFAULTS.cambio),
        loadKey(STORAGE_KEYS.contas, DEFAULTS.contas),
      ]);
      const estMigrado = (est || []).map((i) =>
        i.varejo === undefined || i.atacado === undefined
          ? { ...i, varejo: i.varejo ?? i.venda ?? i.custo * 1.3, atacado: i.atacado ?? i.venda ?? i.custo * 1.15 }
          : i
      );
      setEstoque(estMigrado);
      const venMigrado = (ven || []).map((v) =>
        v.itens ? v : { ...v, itens: [{ itemId: v.itemId || uid(), itemNome: v.itemNome, qtd: v.qtd, tipoVenda: v.tipoVenda, precoUnit: v.qtd ? v.valor / v.qtd : v.valor, subtotal: v.valor }] }
      );
      setVendas(venMigrado);
      const compMigrado = (comp || []).map((c) =>
        c.itens ? c : { ...c, itens: [{ nome: c.itemNome, qtd: c.qtd, custo: c.qtd ? c.total / c.qtd : c.total, subtotal: c.total }] }
      );
      setCompras(compMigrado);
      setClientes(pes.clientes || []);
      setFornecedores(pes.fornecedores || []);
      setCaixas(cx.caixas || DEFAULTS.caixa.caixas);
      setMovimentos(cx.movimentos || []);
      setCambio(cam);
      setContas(cts || []);

      // persist defaults on very first run so the keys exist going forward
      if (isFirstRun) {
        saveKey(STORAGE_KEYS.estoque, est);
        saveKey(STORAGE_KEYS.vendas, ven);
        saveKey(STORAGE_KEYS.compras, comp);
        saveKey(STORAGE_KEYS.pessoas, { clientes: pes.clientes, fornecedores: pes.fornecedores });
        saveKey(STORAGE_KEYS.caixa, { caixas: cx.caixas, movimentos: cx.movimentos });
        saveKey(STORAGE_KEYS.cambio, cam);
        saveKey(STORAGE_KEYS.contas, cts);
      }
      setLoaded(true);
    })();
  }, []);

  // ---- persist on change (skip until initial load finishes) ----
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.estoque, estoque); }, [estoque, loaded]);
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.vendas, vendas); }, [vendas, loaded]);
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.compras, compras); }, [compras, loaded]);
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.pessoas, { clientes, fornecedores }); }, [clientes, fornecedores, loaded]);
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.caixa, { caixas, movimentos }); }, [caixas, movimentos, loaded]);
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.cambio, cambio); }, [cambio, loaded]);
  useEffect(() => { if (loaded) saveKey(STORAGE_KEYS.contas, contas); }, [contas, loaded]);

  // ---- derived values ----
  const vendasHoje = useMemo(
    () => vendas.filter((v) => v.data === todayISO()).reduce((s, v) => s + v.valor, 0),
    [vendas]
  );
  const aReceber = useMemo(
    () => vendas.filter((v) => v.status === "Pendente").reduce((s, v) => s + v.valor, 0),
    [vendas]
  );
  const valorEstoque = useMemo(() => estoque.reduce((s, i) => s + i.qtd * i.custo, 0), [estoque]);
  const unidadesEstoque = useMemo(() => estoque.reduce((s, i) => s + i.qtd, 0), [estoque]);
  const estoqueBaixo = useMemo(() => estoque.filter((i) => i.qtd < i.min), [estoque]);
  const nextVendaId = useMemo(() => (vendas.length ? Math.max(...vendas.map((v) => v.id)) + 1 : 1), [vendas]);

  const caixaMeta = {
    usdt: { label: "USDT", sub: "crypto", color: "bg-emerald-50 text-emerald-700", symbol: "₮", format: (v) => v.toFixed(2) + " USDT" },
    dolar: { label: "Dólar efetivo", sub: "cash", color: "bg-blue-50 text-blue-700", symbol: "$", format: (v) => v.toFixed(2) + " USD" },
    pix: { label: "PIX", sub: "pix", color: "bg-cyan-50 text-cyan-700", symbol: "R$", format: fmtBRL },
    real: { label: "Real efetivo", sub: "cash", color: "bg-orange-50 text-orange-700", symbol: "R$", format: fmtBRL },
  };

  function addMovimento(caixaKey, tipo, valor, descricao) {
    setCaixas((c) => ({ ...c, [caixaKey]: c[caixaKey] + (tipo === "Entrada" ? valor : -valor) }));
    setMovimentos((m) => [{ id: uid(), caixa: caixaKey, tipo, valor, descricao, data: todayISO() }, ...m]);
  }

  function registrarVenda({ clienteId, itens, pagamento, condicao }) {
    if (!itens || itens.length === 0) return;
    // validate stock per item (aggregate qty per itemId in case of duplicates)
    const qtdPorItem = {};
    itens.forEach((l) => { qtdPorItem[l.itemId] = (qtdPorItem[l.itemId] || 0) + l.qtd; });
    for (const itemId in qtdPorItem) {
      const stockItem = estoque.find((i) => i.id === itemId);
      if (!stockItem || qtdPorItem[itemId] > stockItem.qtd) return;
    }
    const cliente = clientes.find((c) => c.id === clienteId);
    const linhas = itens.map((l) => {
      const item = estoque.find((i) => i.id === l.itemId);
      const precoUnit = l.tipoVenda === "Atacado" ? item.atacado : item.varejo;
      return { itemId: l.itemId, itemNome: item.nome, qtd: l.qtd, tipoVenda: l.tipoVenda, precoUnit, subtotal: precoUnit * l.qtd };
    });
    const valor = linhas.reduce((s, l) => s + l.subtotal, 0);
    const id = nextVendaId;
    setEstoque((e) => e.map((i) => (qtdPorItem[i.id] ? { ...i, qtd: i.qtd - qtdPorItem[i.id] } : i)));
    setVendas((v) => [
      { id, clienteId, clienteNome: cliente ? cliente.nome : "Sem nome", itens: linhas, valor, pagamento, condicao, status: condicao === "À vista" ? "Pago" : "Pendente", data: todayISO() },
      ...v,
    ]);
    if (condicao === "À vista") {
      const key = pagamento === "USDT" ? "usdt" : pagamento === "Dólar" ? "dolar" : pagamento === "PIX" ? "pix" : "real";
      addMovimento(key, "Entrada", valor, `Venda #${id}`);
    }
    setModal(null);
  }

  function registrarCompra({ fornecedorId, itens, pagamento }) {
    if (!itens || itens.length === 0) return;
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
    let estoqueAtualizado = estoque;
    itens.forEach((l) => {
      const existing = estoqueAtualizado.find((i) => i.nome.toLowerCase() === l.nome.toLowerCase());
      if (existing) {
        estoqueAtualizado = estoqueAtualizado.map((i) => (i.id === existing.id ? { ...i, qtd: i.qtd + l.qtd, custo: l.custo } : i));
      } else {
        estoqueAtualizado = [...estoqueAtualizado, { id: uid(), nome: l.nome, qtd: l.qtd, custo: l.custo, varejo: l.varejo || l.custo * 1.3, atacado: l.atacado || l.custo * 1.15, min: 3 }];
      }
    });
    setEstoque(estoqueAtualizado);
    const total = itens.reduce((s, l) => s + l.custo * l.qtd, 0);
    setCompras((c) => [
      { id: uid(), fornecedorNome: fornecedor ? fornecedor.nome : "Sem nome", itens: itens.map((l) => ({ nome: l.nome, qtd: l.qtd, custo: l.custo, subtotal: l.custo * l.qtd })), total, data: todayISO() },
      ...c,
    ]);
    const key = pagamento === "USDT" ? "usdt" : pagamento === "Dólar" ? "dolar" : pagamento === "PIX" ? "pix" : "real";
    addMovimento(key, "Saída", total, `Compra de ${fornecedor ? fornecedor.nome : "fornecedor"} (${itens.length} ${itens.length === 1 ? "item" : "itens"})`);
    setModal(null);
  }

  const contasPendentes = useMemo(() => contas.filter((c) => c.status === "Pendente"), [contas]);
  const totalContasPendentes = useMemo(() => contasPendentes.reduce((s, c) => s + c.valor, 0), [contasPendentes]);
  const contasVencendo = useMemo(
    () => contasPendentes.filter((c) => c.vencimento <= todayISO()).sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [contasPendentes]
  );
  const vendasACobrar = useMemo(() => vendas.filter((v) => v.status === "Pendente").sort((a, b) => a.data.localeCompare(b.data)), [vendas]);

  function pagarConta(id, caixaKey) {
    const conta = contas.find((c) => c.id === id);
    if (!conta || conta.status === "Pago") return;
    setContas((cs) => cs.map((c) => (c.id === id ? { ...c, status: "Pago", dataPagamento: todayISO() } : c)));
    addMovimento(caixaKey, "Saída", conta.valor, `Conta: ${conta.nome}`);
  }

  function marcarVendaPaga(id, caixaKey) {
    const venda = vendas.find((v) => v.id === id);
    if (!venda || venda.status === "Pago") return;
    setVendas((vs) => vs.map((v) => (v.id === id ? { ...v, status: "Pago" } : v)));
    addMovimento(caixaKey, "Entrada", venda.valor, `Recebimento venda #${id}`);
  }

  function duplicarConta(id) {
    const conta = contas.find((c) => c.id === id);
    if (!conta) return;
    const d = new Date(conta.vencimento);
    d.setMonth(d.getMonth() + 1);
    setContas((cs) => [...cs, { id: uid(), nome: conta.nome, categoria: conta.categoria, valor: conta.valor, vencimento: d.toISOString().slice(0, 10), status: "Pendente", dataPagamento: null }]);
  }

  // ---------- PAGES ----------

  function StatCard({ label, value, sub }) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-[11px] tracking-wide text-gray-400 font-medium mb-2">{label}</div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        <div className="text-xs text-gray-400 mt-1">{sub}</div>
      </div>
    );
  }

  function VisaoGeral() {
    return (
      <>
        <div className="bg-emerald-900 text-white rounded-xl px-6 py-4 mb-6 flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <div>
              <div className="text-sm font-semibold">Câmbio manual</div>
              <div className="text-xs text-emerald-200">Valores definidos por você</div>
            </div>
          </div>
          <div className="h-8 w-px bg-emerald-700 hidden sm:block" />
          <div>
            <div className="text-[10px] tracking-wide text-emerald-300">TCR · BRL/USDT</div>
            <div className="text-lg font-semibold">R$ {cambio.tcr.toFixed(2).replace(".", ",")}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-emerald-300">CHACO · COMPRA USD</div>
            <div className="text-lg font-semibold">R$ {cambio.chacoCompra.toFixed(2).replace(".", ",")}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-emerald-300">CHACO · VENDA USD</div>
            <div className="text-lg font-semibold">R$ {cambio.chacoVenda.toFixed(2).replace(".", ",")}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div>
              <div className="text-[10px] tracking-wide text-emerald-300">MODO</div>
              <div className="text-sm font-semibold">{cambio.modo}</div>
            </div>
            <button onClick={() => setModal("cambio")} className="bg-emerald-800 hover:bg-emerald-700 text-xs font-medium px-3 py-1.5 rounded-md">
              Ajustar
            </button>
          </div>
        </div>

        {(vendasACobrar.length > 0 || contasVencendo.length > 0) && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-5 mb-6">
            <div className="text-sm font-semibold text-amber-900 mb-1">Lembretes de hoje</div>
            <div className="text-xs text-amber-700 mb-4">{fmtDateLong()}</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <div className="text-xs font-medium text-amber-800 mb-2">A cobrar ({vendasACobrar.length})</div>
                {vendasACobrar.length === 0 ? (
                  <div className="text-sm text-amber-700/60">Ninguém a cobrar no momento.</div>
                ) : (
                  <ul className="space-y-2">
                    {vendasACobrar.map((v) => (
                      <li key={v.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-900">{v.clienteNome}</span>
                          <span className="text-gray-400"> · venda #{v.id}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{fmtUSD(v.valor)}</span>
                          <button
                            onClick={() => { setReceivingVenda(v); setModal("receberVenda"); }}
                            className="text-xs font-medium text-emerald-800 hover:text-emerald-900 border border-emerald-800 rounded-md px-2 py-1"
                          >
                            Marcar recebido
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-amber-800 mb-2">A pagar ({contasVencendo.length})</div>
                {contasVencendo.length === 0 ? (
                  <div className="text-sm text-amber-700/60">Nenhuma conta vencendo hoje.</div>
                ) : (
                  <ul className="space-y-2">
                    {contasVencendo.map((c) => {
                      const atrasada = c.vencimento < todayISO();
                      return (
                        <li key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-900">{c.nome}</span>
                            <span className={atrasada ? "text-red-600" : "text-gray-400"}> · {atrasada ? "atrasada" : "vence hoje"}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900">{fmtUSD(c.valor)}</span>
                            <button
                              onClick={() => { setPayingConta(c); setModal("pagarConta"); }}
                              className="text-xs font-medium text-emerald-800 hover:text-emerald-900 border border-emerald-800 rounded-md px-2 py-1"
                            >
                              Marcar pago
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="VENDAS HOJE" value={fmtUSD(vendasHoje)} sub="Dados salvos" />
          <StatCard label="A RECEBER" value={fmtUSD(aReceber)} sub="Vendas pendentes" />
          <StatCard label="CONTAS A PAGAR" value={fmtUSD(totalContasPendentes)} sub={`${contasPendentes.length} pendentes`} />
          <StatCard label="VALOR EM ESTOQUE" value={fmtUSD(valorEstoque)} sub={`${unidadesEstoque} unidades`} />
          <StatCard label="CLIENTES" value={clientes.length} sub={`${fornecedores.length} fornecedores`} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Caixas e saldos</div>
            <div className="text-xs text-gray-400">Valores reais registrados</div>
          </div>
          <button onClick={() => setModal("movimento")} className="flex items-center gap-1.5 text-sm font-medium bg-white border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50">
            <Plus size={14} /> Movimento
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Object.keys(caixaMeta).map((k) => (
            <div key={k} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold ${caixaMeta[k].color}`}>
                  {caixaMeta[k].symbol}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{caixaMeta[k].label}</div>
                  <div className="text-xs text-gray-400">{caixaMeta[k].sub}</div>
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900">{caixaMeta[k].format(caixas[k])}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Equivale a {fmtUSD(k === "pix" || k === "real" ? caixas[k] / cambio.chacoVenda : caixas[k])}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm font-semibold text-gray-900">Vendas recentes</div>
            <div className="text-xs text-gray-400 mb-3">Últimos lançamentos</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">VENDA</th>
                  <th className="pb-2 font-medium">CLIENTE</th>
                  <th className="pb-2 font-medium">ITENS</th>
                  <th className="pb-2 font-medium">VALOR</th>
                  <th className="pb-2 font-medium">PAGAMENTO</th>
                  <th className="pb-2 font-medium">CONDIÇÃO</th>
                  <th className="pb-2 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {vendas.slice(0, 5).map((v) => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <div className="font-medium text-gray-900">#{v.id}</div>
                      <div className="text-xs text-gray-400">{fmtDate(v.data)}</div>
                    </td>
                    <td className="py-3 text-gray-600">{v.clienteNome}</td>
                    <td className="py-3 text-gray-600">
                      {v.itens?.length > 1 ? `${v.itens.length} produtos` : v.itens?.[0]?.itemNome || "—"}
                    </td>
                    <td className="py-3 font-medium text-gray-900">{fmtUSD(v.valor)}</td>
                    <td className="py-3 text-gray-600">{v.pagamento}</td>
                    <td className="py-3 text-gray-600">{v.condicao}</td>
                    <td className="py-3"><Badge status={v.status} /></td>
                  </tr>
                ))}
                {vendas.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">Nenhuma venda registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm font-semibold text-gray-900">Estoque baixo</div>
            <div className="text-xs text-gray-400 mb-4">Mercadorias que precisam de atenção</div>
            {estoqueBaixo.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">Nenhuma mercadoria abaixo do mínimo.</div>
            ) : (
              <ul className="space-y-3">
                {estoqueBaixo.map((i) => (
                  <li key={i.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{i.nome}</span>
                    <span className="text-amber-600 font-medium">{i.qtd} un.</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="text-sm font-semibold text-gray-900 mt-6">Contas a pagar</div>
            <div className="text-xs text-gray-400 mb-4">Próximos vencimentos</div>
            {contasPendentes.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">Nenhuma conta pendente.</div>
            ) : (
              <ul className="space-y-3">
                {[...contasPendentes]
                  .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
                  .slice(0, 4)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{c.nome}</span>
                      <span className={`font-medium ${c.vencimento < todayISO() ? "text-red-600" : "text-gray-500"}`}>
                        {fmtUSD(c.valor)} · {fmtDate(c.vencimento)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  }

  function TableShell({ title, sub, action, children }) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            {sub && <div className="text-xs text-gray-400">{sub}</div>}
          </div>
          {action}
        </div>
        <div className="overflow-x-auto">{children}</div>
      </div>
    );
  }

  function EstoquePage() {
    return (
      <TableShell
        title="Estoque"
        sub={`${estoque.length} mercadorias · ${unidadesEstoque} unidades`}
        action={
          <button onClick={() => { setEditingItem(null); setModal("item"); }} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-1.5">
            <Plus size={14} /> Novo item
          </button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2 font-medium">MERCADORIA</th>
              <th className="px-5 py-2 font-medium">QTD</th>
              <th className="px-5 py-2 font-medium">CUSTO UNIT.</th>
              <th className="px-5 py-2 font-medium">VAREJO</th>
              <th className="px-5 py-2 font-medium">ATACADO</th>
              <th className="px-5 py-2 font-medium">VALOR TOTAL</th>
              <th className="px-5 py-2 font-medium">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {estoque.map((i) => (
              <tr key={i.id} className="border-b border-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{i.nome}</td>
                <td className={`px-5 py-3 ${i.qtd < i.min ? "text-amber-600 font-medium" : "text-gray-600"}`}>{i.qtd}</td>
                <td className="px-5 py-3 text-gray-600">{fmtUSD(i.custo)}</td>
                <td className="px-5 py-3 text-gray-600">{fmtUSD(i.varejo)}</td>
                <td className="px-5 py-3 text-gray-600">{fmtUSD(i.atacado)}</td>
                <td className="px-5 py-3 text-gray-900 font-medium">{fmtUSD(i.qtd * i.custo)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setEditingItem(i); setModal("item"); }} className="text-gray-400 hover:text-emerald-700">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setEstoque((e) => e.filter((x) => x.id !== i.id))} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {estoque.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Nenhum item cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </TableShell>
    );
  }

  function VendasPage() {
    return (
      <TableShell
        title="Vendas"
        sub={`${vendas.length} registros`}
        action={
          <button onClick={() => setModal("venda")} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-1.5">
            <Plus size={14} /> Nova venda
          </button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2 font-medium">VENDA</th>
              <th className="px-5 py-2 font-medium">CLIENTE</th>
              <th className="px-5 py-2 font-medium">ITENS</th>
              <th className="px-5 py-2 font-medium">VALOR</th>
              <th className="px-5 py-2 font-medium">PAGAMENTO</th>
              <th className="px-5 py-2 font-medium">CONDIÇÃO</th>
              <th className="px-5 py-2 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => (
              <tr key={v.id} className="border-b border-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900 align-top">#{v.id}</td>
                <td className="px-5 py-3 text-gray-600 align-top">{v.clienteNome}</td>
                <td className="px-5 py-3 text-gray-600">
                  {(v.itens || []).map((l, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                      {l.itemNome} × {l.qtd} <span className="text-xs text-gray-400">({l.tipoVenda})</span>
                    </div>
                  ))}
                </td>
                <td className="px-5 py-3 font-medium text-gray-900 align-top">{fmtUSD(v.valor)}</td>
                <td className="px-5 py-3 text-gray-600 align-top">{v.pagamento}</td>
                <td className="px-5 py-3 text-gray-600 align-top">{v.condicao}</td>
                <td className="px-5 py-3 align-top"><Badge status={v.status} /></td>
              </tr>
            ))}
            {vendas.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">Nenhuma venda registrada.</td></tr>
            )}
          </tbody>
        </table>
      </TableShell>
    );
  }

  function ComprasPage() {
    return (
      <TableShell
        title="Compras"
        sub={`${compras.length} registros`}
        action={
          <button onClick={() => setModal("compra")} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-1.5">
            <Plus size={14} /> Nova compra
          </button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2 font-medium">FORNECEDOR</th>
              <th className="px-5 py-2 font-medium">ITENS</th>
              <th className="px-5 py-2 font-medium">TOTAL</th>
              <th className="px-5 py-2 font-medium">DATA</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-b border-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900 align-top">{c.fornecedorNome}</td>
                <td className="px-5 py-3 text-gray-600">
                  {(c.itens || []).map((l, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-1" : ""}>{l.nome} × {l.qtd}</div>
                  ))}
                </td>
                <td className="px-5 py-3 font-medium text-gray-900 align-top">{fmtUSD(c.total)}</td>
                <td className="px-5 py-3 text-gray-600 align-top">{fmtDate(c.data)}</td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">Nenhuma compra registrada.</td></tr>
            )}
          </tbody>
        </table>
      </TableShell>
    );
  }

  function CaixaPage() {
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-900">Caixas e saldos</div>
          <button onClick={() => setModal("movimento")} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-1.5">
            <Plus size={14} /> Movimento
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Object.keys(caixaMeta).map((k) => (
            <div key={k} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold ${caixaMeta[k].color}`}>
                  {caixaMeta[k].symbol}
                </div>
                <div className="text-sm font-medium text-gray-900">{caixaMeta[k].label}</div>
              </div>
              <div className="text-lg font-semibold text-gray-900">{caixaMeta[k].format(caixas[k])}</div>
            </div>
          ))}
        </div>
        <TableShell title="Movimentações" sub={`${movimentos.length} lançamentos`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">CAIXA</th>
                <th className="px-5 py-2 font-medium">TIPO</th>
                <th className="px-5 py-2 font-medium">VALOR</th>
                <th className="px-5 py-2 font-medium">DESCRIÇÃO</th>
                <th className="px-5 py-2 font-medium">DATA</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{caixaMeta[m.caixa].label}</td>
                  <td className="px-5 py-3">
                    <span className={m.tipo === "Entrada" ? "text-emerald-700" : "text-red-600"}>{m.tipo}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-900">{caixaMeta[m.caixa].format(m.valor)}</td>
                  <td className="px-5 py-3 text-gray-600">{m.descricao}</td>
                  <td className="px-5 py-3 text-gray-600">{fmtDate(m.data)}</td>
                </tr>
              ))}
              {movimentos.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-sm">Nenhuma movimentação registrada.</td></tr>
              )}
            </tbody>
          </table>
        </TableShell>
      </>
    );
  }

  function PessoasPage({ title, data, setData, placeholder }) {
    return (
      <TableShell
        title={title}
        sub={`${data.length} cadastros`}
        action={
          <button onClick={() => setModal(title === "Clientes" ? "cliente" : "fornecedor")} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-1.5">
            <Plus size={14} /> Novo
          </button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2 font-medium">NOME</th>
              <th className="px-5 py-2 font-medium">CONTATO</th>
              <th className="px-5 py-2 font-medium">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{p.nome}</td>
                <td className="px-5 py-3 text-gray-600">{p.contato || "—"}</td>
                <td className="px-5 py-3">
                  <button onClick={() => setData((d) => d.filter((x) => x.id !== p.id))} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-gray-400 text-sm">{placeholder}</td></tr>
            )}
          </tbody>
        </table>
      </TableShell>
    );
  }

  function ContasPage() {
    const hoje = todayISO();
    const ordenadas = [...contas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return (
      <TableShell
        title="Contas a pagar"
        sub={`${contasPendentes.length} pendentes · ${fmtUSD(totalContasPendentes)}`}
        action={
          <button onClick={() => { setEditingConta(null); setModal("conta"); }} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-1.5">
            <Plus size={14} /> Nova conta
          </button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-5 py-2 font-medium">CONTA</th>
              <th className="px-5 py-2 font-medium">CATEGORIA</th>
              <th className="px-5 py-2 font-medium">VALOR</th>
              <th className="px-5 py-2 font-medium">VENCIMENTO</th>
              <th className="px-5 py-2 font-medium">STATUS</th>
              <th className="px-5 py-2 font-medium">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((c) => {
              const atrasada = c.status === "Pendente" && c.vencimento < hoje;
              return (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-5 py-3 text-gray-600">{c.categoria}</td>
                  <td className="px-5 py-3 text-gray-900 font-medium">{fmtUSD(c.valor)}</td>
                  <td className={`px-5 py-3 ${atrasada ? "text-red-600 font-medium" : "text-gray-600"}`}>
                    {fmtDate(c.vencimento)}{atrasada && " · atrasada"}
                  </td>
                  <td className="px-5 py-3"><Badge status={c.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {c.status === "Pendente" && (
                        <button onClick={() => { setPayingConta(c); setModal("pagarConta"); }} className="text-gray-400 hover:text-emerald-700" title="Marcar como pago">
                          <Check size={15} />
                        </button>
                      )}
                      {c.status === "Pago" && (
                        <button onClick={() => duplicarConta(c.id)} className="text-gray-400 hover:text-emerald-700" title="Duplicar para o próximo mês">
                          <Copy size={15} />
                        </button>
                      )}
                      <button onClick={() => { setEditingConta(c); setModal("conta"); }} className="text-gray-400 hover:text-emerald-700">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setContas((cs) => cs.filter((x) => x.id !== c.id))} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {contas.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Nenhuma conta cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </TableShell>
    );
  }

  function CambioForm({ onSave, initial }) {
    const [tcr, setTcr] = useState(initial.tcr);
    const [cc, setCc] = useState(initial.chacoCompra);
    const [cv, setCv] = useState(initial.chacoVenda);
    return (
      <div>
        <Field label="TCR · BRL/USDT">
          <input type="number" step="0.01" className={inputCls} value={tcr} onChange={(e) => setTcr(Number(e.target.value))} />
        </Field>
        <Field label="Chaco · Compra USD">
          <input type="number" step="0.01" className={inputCls} value={cc} onChange={(e) => setCc(Number(e.target.value))} />
        </Field>
        <Field label="Chaco · Venda USD">
          <input type="number" step="0.01" className={inputCls} value={cv} onChange={(e) => setCv(Number(e.target.value))} />
        </Field>
        <button
          onClick={() => onSave({ tcr, chacoCompra: cc, chacoVenda: cv, modo: "Manual" })}
          className="w-full bg-emerald-800 hover:bg-emerald-900 text-white rounded-md py-2 text-sm font-medium"
        >
          Salvar taxas
        </button>
      </div>
    );
  }

  function CambioPage() {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
        <div className="text-sm font-semibold text-gray-900 mb-1">Taxas de câmbio</div>
        <div className="text-xs text-gray-400 mb-5">Defina manualmente as cotações usadas no sistema.</div>
        <CambioForm onSave={(vals) => setCambio(vals)} initial={cambio} />
      </div>
    );
  }

  // ---------- MODALS ----------

  function VendaModal() {
    const [clienteId, setClienteId] = useState(clientes[0]?.id || "");
    const [itemId, setItemId] = useState(estoque[0]?.id || "");
    const [qtd, setQtd] = useState(1);
    const [tipoVenda, setTipoVenda] = useState("Varejo");
    const [pagamento, setPagamento] = useState("PIX");
    const [condicao, setCondicao] = useState("À vista");
    const [carrinho, setCarrinho] = useState([]);

    const item = estoque.find((i) => i.id === itemId);
    const jaNoCarrinho = carrinho.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qtd, 0);
    const disponivel = item ? item.qtd - jaNoCarrinho : 0;
    const precoUnit = item ? (tipoVenda === "Atacado" ? item.atacado : item.varejo) : 0;
    const total = carrinho.reduce((s, l) => s + l.precoUnit * l.qtd, 0);

    function addAoCarrinho() {
      if (!item || qtd < 1 || qtd > disponivel) return;
      setCarrinho((c) => [...c, { key: uid(), itemId, nome: item.nome, qtd, tipoVenda, precoUnit }]);
      setQtd(1);
    }
    function removerDoCarrinho(key) {
      setCarrinho((c) => c.filter((l) => l.key !== key));
    }
    function finalizar() {
      if (carrinho.length === 0) return;
      registrarVenda({
        clienteId,
        itens: carrinho.map((l) => ({ itemId: l.itemId, qtd: l.qtd, tipoVenda: l.tipoVenda })),
        pagamento,
        condicao,
      });
    }

    return (
      <Modal title="Nova venda" onClose={() => setModal(null)} wide>
        <Field label="Cliente">
          <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Sem nome</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>

        <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
          <div className="text-xs font-medium text-gray-500 mb-3">Adicionar produto à nota</div>
          <Field label="Mercadoria">
            <select className={inputCls} value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {estoque.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.qtd} disp.)</option>)}
            </select>
          </Field>
          <Field label="Tipo de venda">
            <div className="flex gap-2">
              {["Varejo", "Atacado"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoVenda(t)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    tipoVenda === t ? "bg-emerald-800 border-emerald-800 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50 bg-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3 mb-1">
            <Field label={`Quantidade (${disponivel} disp.)`}>
              <input type="number" min="1" max={disponivel} className={inputCls} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
            </Field>
            <Field label="Valor unitário">
              <input type="text" disabled className={inputCls + " bg-white text-gray-500"} value={item ? fmtUSD(precoUnit) : ""} />
            </Field>
          </div>
          <button
            type="button"
            onClick={addAoCarrinho}
            disabled={!item || qtd < 1 || qtd > disponivel}
            className="w-full flex items-center justify-center gap-1.5 border border-emerald-800 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 rounded-md py-2 text-sm font-medium"
          >
            <Plus size={14} /> Adicionar à nota
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Itens da nota ({carrinho.length})</div>
          {carrinho.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">Nenhum produto adicionado ainda.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {carrinho.map((l) => (
                <div key={l.key} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{l.nome} × {l.qtd}</div>
                    <div className="text-xs text-gray-400">{l.tipoVenda} · {fmtUSD(l.precoUnit)} un.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{fmtUSD(l.precoUnit * l.qtd)}</span>
                    <button onClick={() => removerDoCarrinho(l.key)} className="text-gray-400 hover:text-red-600">
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
              <option>PIX</option>
              <option>Real</option>
              <option>Dólar</option>
              <option>USDT</option>
            </select>
          </Field>
          <Field label="Condição">
            <select className={inputCls} value={condicao} onChange={(e) => setCondicao(e.target.value)}>
              <option>À vista</option>
              <option>A prazo</option>
            </select>
          </Field>
        </div>
        <div className="text-sm text-gray-500 mb-4">
          Total da nota: <span className="font-semibold text-gray-900">{fmtUSD(total)}</span>
        </div>
        <button
          onClick={finalizar}
          disabled={carrinho.length === 0}
          className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-md py-2 text-sm font-medium"
        >
          Finalizar venda
        </button>
      </Modal>
    );
  }

  function CompraModal() {
    const [fornecedorId, setFornecedorId] = useState(fornecedores[0]?.id || "");
    const [nome, setNome] = useState("");
    const [qtd, setQtd] = useState(1);
    const [custo, setCusto] = useState(0);
    const [varejo, setVarejo] = useState(0);
    const [atacado, setAtacado] = useState(0);
    const [pagamento, setPagamento] = useState("PIX");
    const [carrinho, setCarrinho] = useState([]);

    const nomeTrim = nome.trim();
    const isNovoProduto = nomeTrim !== "" && !estoque.some((i) => i.nome.toLowerCase() === nomeTrim.toLowerCase());
    const podeAdicionar = nomeTrim !== "" && qtd > 0 && custo > 0 && (!isNovoProduto || (varejo > 0 && atacado > 0));
    const total = carrinho.reduce((s, l) => s + l.custo * l.qtd, 0);

    function addAoCarrinho() {
      if (!podeAdicionar) return;
      setCarrinho((c) => [...c, { key: uid(), nome: nomeTrim, qtd, custo, varejo, atacado }]);
      setNome(""); setQtd(1); setCusto(0); setVarejo(0); setAtacado(0);
    }
    function removerDoCarrinho(key) {
      setCarrinho((c) => c.filter((l) => l.key !== key));
    }
    function finalizar() {
      if (carrinho.length === 0) return;
      registrarCompra({ fornecedorId, itens: carrinho, pagamento });
    }

    return (
      <Modal title="Nova compra" onClose={() => setModal(null)} wide>
        <Field label="Fornecedor">
          <select className={inputCls} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Sem nome</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Field>

        <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
          <div className="text-xs font-medium text-gray-500 mb-3">Adicionar produto à nota</div>
          <Field label="Mercadoria">
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do item (novo ou existente)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade">
              <input type="number" min="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
            </Field>
            <Field label="Custo unit. (US$)">
              <input type="number" step="0.01" className={inputCls} value={custo} onChange={(e) => setCusto(Number(e.target.value))} />
            </Field>
          </div>
          {isNovoProduto && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço varejo (US$) *">
                  <input type="number" step="0.01" min="0.01" className={inputCls} value={varejo} onChange={(e) => setVarejo(Number(e.target.value))} />
                </Field>
                <Field label="Preço atacado (US$) *">
                  <input type="number" step="0.01" min="0.01" className={inputCls} value={atacado} onChange={(e) => setAtacado(Number(e.target.value))} />
                </Field>
              </div>
              <div className="text-xs text-gray-400 -mt-2 mb-3">* Obrigatório — mercadoria nova precisa ter os dois preços de venda cadastrados.</div>
            </>
          )}
          <button
            type="button"
            onClick={addAoCarrinho}
            disabled={!podeAdicionar}
            className="w-full flex items-center justify-center gap-1.5 border border-emerald-800 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 rounded-md py-2 text-sm font-medium"
          >
            <Plus size={14} /> Adicionar à nota
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Itens da nota ({carrinho.length})</div>
          {carrinho.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">Nenhum produto adicionado ainda.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {carrinho.map((l) => (
                <div key={l.key} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{l.nome} × {l.qtd}</div>
                    <div className="text-xs text-gray-400">Custo {fmtUSD(l.custo)} un.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{fmtUSD(l.custo * l.qtd)}</span>
                    <button onClick={() => removerDoCarrinho(l.key)} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Pago com">
          <select className={inputCls} value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
            <option>PIX</option>
            <option>Real</option>
            <option>Dólar</option>
            <option>USDT</option>
          </select>
        </Field>
        <div className="text-sm text-gray-500 mb-4">
          Total da nota: <span className="font-semibold text-gray-900">{fmtUSD(total)}</span>
        </div>
        <button
          onClick={finalizar}
          disabled={carrinho.length === 0}
          className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-md py-2 text-sm font-medium"
        >
          Finalizar compra
        </button>
      </Modal>
    );
  }

  function MovimentoModal() {
    const [caixaKey, setCaixaKey] = useState("pix");
    const [tipo, setTipo] = useState("Entrada");
    const [valor, setValor] = useState(0);
    const [descricao, setDescricao] = useState("");
    return (
      <Modal title="Novo movimento" onClose={() => setModal(null)}>
        <Field label="Caixa">
          <select className={inputCls} value={caixaKey} onChange={(e) => setCaixaKey(e.target.value)}>
            {Object.keys(caixaMeta).map((k) => <option key={k} value={k}>{caixaMeta[k].label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option>Entrada</option>
              <option>Saída</option>
            </select>
          </Field>
          <Field label="Valor">
            <input type="number" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Descrição">
          <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aporte inicial" />
        </Field>
        <button
          onClick={() => { addMovimento(caixaKey, tipo, valor, descricao || "Movimento manual"); setModal(null); }}
          disabled={valor <= 0}
          className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-md py-2 text-sm font-medium"
        >
          Registrar movimento
        </button>
      </Modal>
    );
  }

  function ItemModal() {
    const isEdit = !!editingItem;
    const [nome, setNome] = useState(editingItem?.nome || "");
    const [qtd, setQtd] = useState(editingItem?.qtd ?? 1);
    const [custo, setCusto] = useState(editingItem?.custo ?? 0);
    const [varejo, setVarejo] = useState(editingItem?.varejo ?? 0);
    const [atacado, setAtacado] = useState(editingItem?.atacado ?? 0);
    const [min, setMin] = useState(editingItem?.min ?? 3);

    function close() { setModal(null); setEditingItem(null); }

    function save() {
      if (!nome) return;
      if (isEdit) {
        setEstoque((e) => e.map((x) => (x.id === editingItem.id ? { ...x, nome, qtd, custo, varejo, atacado, min } : x)));
      } else {
        setEstoque((e) => [...e, { id: uid(), nome, qtd, custo, varejo, atacado, min }]);
      }
      close();
    }

    const invalid = !nome || !(varejo > 0) || !(atacado > 0);

    return (
      <Modal title={isEdit ? "Editar item de estoque" : "Novo item de estoque"} onClose={close}>
        <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade"><input type="number" min="0" className={inputCls} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} /></Field>
          <Field label="Estoque mínimo"><input type="number" min="0" className={inputCls} value={min} onChange={(e) => setMin(Number(e.target.value))} /></Field>
        </div>
        <Field label="Custo unit. (US$)"><input type="number" step="0.01" className={inputCls} value={custo} onChange={(e) => setCusto(Number(e.target.value))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço varejo (US$) *"><input type="number" step="0.01" min="0.01" className={inputCls} value={varejo} onChange={(e) => setVarejo(Number(e.target.value))} /></Field>
          <Field label="Preço atacado (US$) *"><input type="number" step="0.01" min="0.01" className={inputCls} value={atacado} onChange={(e) => setAtacado(Number(e.target.value))} /></Field>
        </div>
        <div className="text-xs text-gray-400 -mt-2 mb-4">* Obrigatório — todo produto precisa ter preço de varejo e de atacado.</div>
        {isEdit && (
          <button
            onClick={() => { setEstoque((e) => e.filter((x) => x.id !== editingItem.id)); close(); }}
            className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-md py-2 text-sm font-medium"
          >
            Excluir item
          </button>
        )}
        <button
          onClick={save}
          disabled={invalid}
          className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-md py-2 text-sm font-medium"
        >
          {isEdit ? "Salvar alterações" : "Adicionar item"}
        </button>
      </Modal>
    );
  }

  function ContaModal() {
    const isEdit = !!editingConta;
    const [nome, setNome] = useState(editingConta?.nome || "");
    const [categoria, setCategoria] = useState(editingConta?.categoria || "Água");
    const [valor, setValor] = useState(editingConta?.valor ?? 0);
    const [vencimento, setVencimento] = useState(editingConta?.vencimento || todayISO());

    function close() { setModal(null); setEditingConta(null); }

    function save() {
      if (!nome || !(valor > 0)) return;
      if (isEdit) {
        setContas((cs) => cs.map((c) => (c.id === editingConta.id ? { ...c, nome, categoria, valor, vencimento } : c)));
      } else {
        setContas((cs) => [...cs, { id: uid(), nome, categoria, valor, vencimento, status: "Pendente", dataPagamento: null }]);
      }
      close();
    }

    return (
      <Modal title={isEdit ? "Editar conta" : "Nova conta a pagar"} onClose={close}>
        <Field label="Categoria">
          <select className={inputCls} value={categoria} onChange={(e) => { setCategoria(e.target.value); if (!isEdit && !nome) setNome(e.target.value); }}>
            <option>Água</option>
            <option>Energia</option>
            <option>Internet</option>
            <option>Aluguel</option>
            <option>Outro</option>
          </select>
        </Field>
        <Field label="Nome da conta"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Água - Loja Matriz" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (US$)"><input type="number" step="0.01" min="0.01" className={inputCls} value={valor} onChange={(e) => setValor(Number(e.target.value))} /></Field>
          <Field label="Vencimento"><input type="date" className={inputCls} value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
        </div>
        {isEdit && (
          <button
            onClick={() => { setContas((cs) => cs.filter((x) => x.id !== editingConta.id)); close(); }}
            className="w-full mb-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-md py-2 text-sm font-medium"
          >
            Excluir conta
          </button>
        )}
        <button
          onClick={save}
          disabled={!nome || !(valor > 0)}
          className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-md py-2 text-sm font-medium"
        >
          {isEdit ? "Salvar alterações" : "Adicionar conta"}
        </button>
      </Modal>
    );
  }

  function PagarContaModal() {
    const [caixaKey, setCaixaKey] = useState("pix");
    if (!payingConta) return null;
    return (
      <Modal title={`Pagar: ${payingConta.nome}`} onClose={() => { setModal(null); setPayingConta(null); }}>
        <div className="text-sm text-gray-600 mb-4">
          Valor: <span className="font-semibold text-gray-900">{fmtUSD(payingConta.valor)}</span> · Vencimento: {fmtDate(payingConta.vencimento)}
        </div>
        <Field label="Pagar com">
          <select className={inputCls} value={caixaKey} onChange={(e) => setCaixaKey(e.target.value)}>
            {Object.keys(caixaMeta).map((k) => <option key={k} value={k}>{caixaMeta[k].label}</option>)}
          </select>
        </Field>
        <button
          onClick={() => { pagarConta(payingConta.id, caixaKey); setModal(null); setPayingConta(null); }}
          className="w-full bg-emerald-800 hover:bg-emerald-900 text-white rounded-md py-2 text-sm font-medium"
        >
          Confirmar pagamento
        </button>
      </Modal>
    );
  }

  function ReceberVendaModal() {
    const [caixaKey, setCaixaKey] = useState("pix");
    if (!receivingVenda) return null;
    return (
      <Modal title={`Receber: venda #${receivingVenda.id}`} onClose={() => { setModal(null); setReceivingVenda(null); }}>
        <div className="text-sm text-gray-600 mb-4">
          Cliente: <span className="font-medium text-gray-900">{receivingVenda.clienteNome}</span> · Valor: <span className="font-semibold text-gray-900">{fmtUSD(receivingVenda.valor)}</span>
        </div>
        <Field label="Recebido em">
          <select className={inputCls} value={caixaKey} onChange={(e) => setCaixaKey(e.target.value)}>
            {Object.keys(caixaMeta).map((k) => <option key={k} value={k}>{caixaMeta[k].label}</option>)}
          </select>
        </Field>
        <button
          onClick={() => { marcarVendaPaga(receivingVenda.id, caixaKey); setModal(null); setReceivingVenda(null); }}
          className="w-full bg-emerald-800 hover:bg-emerald-900 text-white rounded-md py-2 text-sm font-medium"
        >
          Confirmar recebimento
        </button>
      </Modal>
    );
  }

  function PessoaModal({ tipo }) {
    const [nome, setNome] = useState("");
    const [contato, setContato] = useState("");
    const isCliente = tipo === "cliente";
    return (
      <Modal title={isCliente ? "Novo cliente" : "Novo fornecedor"} onClose={() => setModal(null)}>
        <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="Contato"><input className={inputCls} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Telefone ou e-mail" /></Field>
        <button
          onClick={() => {
            if (!nome) return;
            if (isCliente) setClientes((c) => [...c, { id: uid(), nome, contato }]);
            else setFornecedores((f) => [...f, { id: uid(), nome, contato }]);
            setModal(null);
          }}
          disabled={!nome}
          className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-md py-2 text-sm font-medium"
        >
          Salvar
        </button>
      </Modal>
    );
  }

  function CambioModal() {
    return (
      <Modal title="Ajustar câmbio" onClose={() => setModal(null)}>
        <CambioForm initial={cambio} onSave={(v) => { setCambio(v); setModal(null); }} />
      </Modal>
    );
  }

  function backup() {
    const data = { estoque, vendas, compras, clientes, fornecedores, caixas, movimentos, cambio };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "colorshop-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pages = {
    visao: <VisaoGeral />,
    estoque: <EstoquePage />,
    vendas: <VendasPage />,
    compras: <ComprasPage />,
    caixa: <CaixaPage />,
    contas: <ContasPage />,
    clientes: <PessoasPage title="Clientes" data={clientes} setData={setClientes} placeholder="Nenhum cliente cadastrado." />,
    fornecedores: <PessoasPage title="Fornecedores" data={fornecedores} setData={setFornecedores} placeholder="Nenhum fornecedor cadastrado." />,
    cambio: <CambioPage />,
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando seus dados...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex text-gray-900" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">C</div>
          <div>
            <div className="text-sm font-semibold leading-tight">ColorShop</div>
            <div className="text-[11px] text-gray-400 leading-tight">Gestão comercial</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setPage(n.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-emerald-50 text-emerald-800" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-semibold">LM</div>
          <div>
            <div className="text-xs font-semibold leading-tight">Loja Matriz</div>
            <div className="text-[11px] text-gray-400 leading-tight">Dados salvos na sua conta</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="h-1 bg-gray-900" />
        <div className="px-8 py-6">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="text-[11px] tracking-wide text-gray-400 font-medium">{fmtDateLong()}</div>
              <h1 className="text-2xl font-semibold text-gray-900 mt-0.5">{NAV.find((n) => n.key === page)?.label}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Buscar mercadoria..." className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md w-56 focus:outline-none focus:ring-2 focus:ring-emerald-700" />
              </div>
              <button onClick={backup} className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50">
                <Download size={14} /> Backup
              </button>
              <button onClick={() => setModal("venda")} className="flex items-center gap-1.5 text-sm font-medium bg-emerald-800 hover:bg-emerald-900 text-white rounded-md px-3 py-2">
                <Plus size={14} /> Nova venda
              </button>
            </div>
          </div>

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
    </div>
  );
}
