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
