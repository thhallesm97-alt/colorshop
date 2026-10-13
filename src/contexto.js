import { createContext, useContext } from "react";
import { fmtBRL } from "./lib/format.js";

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
