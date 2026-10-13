import { createContext, useContext } from "react";
import { fmtBRL, normalizar } from "./lib/format.js";

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const CAIXA_META = {
  usdt: { label: "USDT", sub: "Cripto", color: "bg-emerald-50 text-emerald-700", symbol: "₮", format: (v) => Number(v || 0).toFixed(2) + " USDT" },
  dolar: { label: "Dólar efetivo", sub: "Dinheiro", color: "bg-sky-50 text-sky-700", symbol: "$", format: (v) => Number(v || 0).toFixed(2) + " USD" },
  pix: { label: "PIX", sub: "Transferência", color: "bg-cyan-50 text-cyan-700", symbol: "R$", format: fmtBRL },
  real: { label: "Real efetivo", sub: "Dinheiro", color: "bg-orange-50 text-orange-700", symbol: "R$", format: fmtBRL },
};

export const PAGAMENTOS = ["PIX", "Real", "Dólar", "USDT"];
export const caixaDoPagamento = (p) => (p === "USDT" ? "usdt" : p === "Dólar" ? "dolar" : p === "PIX" ? "pix" : "real");

export const CAMBIO_PADRAO = { id: "cambio", tcr: 5.26, chacoCompra: 5.26, chacoVenda: 5.35, modo: "Manual" };

// As três tabelas de preço de cada produto.
export const TABELAS = [
  { valor: "Varejo", label: "Varejo", campo: "varejo" },
  { valor: "Atacado", label: "Atacado", campo: "atacado" },
  { valor: "Lojista", label: "Lojista", campo: "lojista" },
];
export const precoDe = (item, tabela) => {
  if (!item) return 0;
  if (tabela === "Atacado") return Number(item.atacado || 0);
  if (tabela === "Lojista") return Number(item.lojista ?? item.atacado ?? 0);
  return Number(item.varejo || 0);
};

// Depois de quantos dias sem pedido o cliente aparece nos lembretes.
export const DIAS_SEM_PEDIDO = 7;

// Busca de produto: todas as palavras digitadas precisam aparecer no nome, na marca ou no tipo.
// Ex.: "dipi 500" encontra "Dipirona 500mg".
export const produtoCombina = (item, busca) => {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const texto = normalizar([item.nome, item.marca, item.tipo].filter(Boolean).join(" "));
  return palavras.every((p) => texto.includes(p));
};
export const descricaoProduto = (item) => [item?.marca, item?.tipo].filter(Boolean).join(" · ");

// Produto de fornecedor: não fica no estoque da farmácia, é pedido ao fornecedor quando vende.
export const ehDeFornecedor = (item) => item?.origem === "fornecedor";

// Custo usado na comissão do vendedor: o custo para vendedores, ou o custo real se ele
// não foi definido.
export const custoComissao = (item) => {
  if (!item) return 0;
  const cv = item.custoVendedor;
  return cv != null && cv !== "" ? Number(cv) || 0 : Number(item.custo) || 0;
};

// Lucro de uma venda para a comissão: preço de venda menos o custo para vendedores de cada
// item (o frete não entra). Vendas antigas, sem o custo guardado, usam o custo atual.
// Produtos devolvidos pelo cliente saem do lucro (e da comissão).
export const lucroDaVenda = (venda, estoque) => {
  const custoDe = (l) => (l.custoVendedor != null ? Number(l.custoVendedor) : custoComissao(estoque.find((i) => i.id === l.itemId)));
  const vendido = (venda.itens || []).reduce((s, l) => s + Number(l.subtotal || 0) - custoDe(l) * Number(l.qtd || 0), 0);
  const devolvido = (venda.devolucoes || []).reduce(
    (s, d) => s + (d.itens || []).reduce((a, x) => { const l = venda.itens[x.linha] || {}; return a + Number(x.valor || 0) - custoDe(l) * Number(x.qtd || 0); }, 0), 0);
  return vendido - devolvido;
};

// Quanto do valor da venda foi devolvido ao cliente.
export const valorDevolvido = (venda) => (venda.devolucoes || []).reduce((s, d) => s + Number(d.valor || 0), 0);
// Quantidade já devolvida de cada linha da venda.
export const qtdDevolvida = (venda, linha) =>
  (venda.devolucoes || []).reduce((s, d) => s + (d.itens || []).filter((x) => x.linha === linha).reduce((a, x) => a + Number(x.qtd || 0), 0), 0);

// Comissão de um vendedor num mês ("2026-10"): % sobre o lucro das vendas dele.
export function comissaoDoMes(vendedor, vendas, estoque, mes) {
  const vs = vendas.filter((v) => v.vendedorId === vendedor.id && String(v.data).startsWith(mes));
  const lucro = vs.reduce((s, v) => s + lucroDaVenda(v, estoque), 0);
  const valor = (Math.max(0, lucro) * Number(vendedor.comissao || 0)) / 100;
  const pago = (vendedor.comissoesPagas || []).filter((p) => p.mes === mes).reduce((s, p) => s + Number(p.valor || 0), 0);
  return { vendas: vs, lucro, valor, pago, falta: Math.max(0, Math.round((valor - pago) * 100) / 100) };
}

// Linha com preço diferente do preço da tabela (o preço da tabela fica guardado em precoTabela).
export const precoFoiAlterado = (l) => l.precoTabela != null && Math.abs(Number(l.precoUnit) - Number(l.precoTabela)) > 0.004;
