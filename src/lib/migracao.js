// Converte dados no formato antigo (salvos no navegador pela versão anterior, ou um
// arquivo de backup) para o formato atual.

import { todayISO, uid } from "./format.js";

const CHAVES_ANTIGAS = {
  estoque: "nexo-estoque",
  vendas: "nexo-vendas",
  compras: "nexo-compras",
  pessoas: "nexo-pessoas",
  caixa: "nexo-caixa",
  cambio: "nexo-cambio",
  contas: "nexo-contas",
};

const CAIXAS = ["usdt", "dolar", "pix", "real"];

function ler(chave) {
  try {
    const raw = window.localStorage.getItem(chave);
    return raw == null ? undefined : JSON.parse(raw);
  } catch (e) {
    return undefined;
  }
}

// Dados que a versão anterior deixou salvos neste navegador, se houver.
export function lerDadosAntigosDoNavegador() {
  if (ler(CHAVES_ANTIGAS.estoque) === undefined) return null;
  const pessoas = ler(CHAVES_ANTIGAS.pessoas) || {};
  const caixa = ler(CHAVES_ANTIGAS.caixa) || {};
  return {
    estoque: ler(CHAVES_ANTIGAS.estoque),
    vendas: ler(CHAVES_ANTIGAS.vendas),
    compras: ler(CHAVES_ANTIGAS.compras),
    clientes: pessoas.clientes,
    fornecedores: pessoas.fornecedores,
    caixas: caixa.caixas,
    movimentos: caixa.movimentos,
    cambio: ler(CHAVES_ANTIGAS.cambio),
    contas: ler(CHAVES_ANTIGAS.contas),
  };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Recebe dados antigos ou de backup e devolve as coleções do banco.
export function normalizar(bruto) {
  if (!bruto || typeof bruto !== "object") throw new Error("Arquivo inválido.");
  const estoque = (bruto.estoque || []).map((i) => ({
    ...i,
    id: String(i.id),
    nome: String(i.nome || "Sem nome"),
    qtd: num(i.qtd),
    custo: num(i.custo),
    varejo: num(i.varejo ?? i.venda ?? num(i.custo) * 1.3),
    atacado: num(i.atacado ?? i.venda ?? num(i.custo) * 1.15),
    min: num(i.min ?? 3),
    baseEm: num(i.baseEm),
  }));

  const vendas = (bruto.vendas || []).map((v) => {
    const itens = v.itens
      ? v.itens
      : [{ itemId: v.itemId || uid(), itemNome: v.itemNome, qtd: v.qtd, tipoVenda: v.tipoVenda, precoUnit: v.qtd ? v.valor / v.qtd : v.valor, subtotal: v.valor }];
    return {
      ...v,
      id: String(v.id),
      numero: v.numero ?? (Number.isFinite(Number(v.id)) ? Number(v.id) : undefined),
      itens: itens.map((l) => ({ ...l, itemId: String(l.itemId), qtd: num(l.qtd), precoUnit: num(l.precoUnit), subtotal: num(l.subtotal) })),
      valor: num(v.valor),
      ts: num(v.ts),
    };
  });
  // Vendas sem número recebem o próximo número livre.
  let maxNum = vendas.reduce((m, v) => Math.max(m, num(v.numero)), 0);
  [...vendas].reverse().forEach((v) => {
    if (v.numero == null) v.numero = ++maxNum;
  });

  const compras = (bruto.compras || []).map((c) => ({
    ...c,
    id: String(c.id),
    itens: c.itens ? c.itens : [{ nome: c.itemNome, qtd: c.qtd, custo: c.qtd ? c.total / c.qtd : c.total, subtotal: c.total }],
    total: num(c.total),
    ts: num(c.ts),
  }));

  const movimentos = (bruto.movimentos || [])
    .filter((m) => CAIXAS.includes(m.caixa))
    .map((m) => ({ ...m, id: String(m.id), valor: num(m.valor) }));

  // A versão antiga guardava o saldo de cada caixa à parte. Agora o saldo é a soma dos
  // movimentos; se houver diferença, ela entra como um movimento de ajuste.
  if (bruto.caixas && typeof bruto.caixas === "object") {
    const soma = {};
    CAIXAS.forEach((k) => (soma[k] = 0));
    movimentos.forEach((m) => (soma[m.caixa] += m.tipo === "Entrada" ? m.valor : -m.valor));
    CAIXAS.forEach((k) => {
      const dif = num(bruto.caixas[k]) - soma[k];
      if (Math.abs(dif) >= 0.005) {
        movimentos.unshift({ id: uid(), caixa: k, tipo: dif > 0 ? "Entrada" : "Saída", valor: Math.abs(dif), descricao: "Ajuste de saldo (importação)", data: todayISO(), ts: Date.now() });
      }
    });
  }

  const pessoa = (p) => ({ ...p, id: String(p.id), nome: String(p.nome || "Sem nome"), contato: p.contato || "" });
  const conta = (c) => ({ ...c, id: String(c.id), valor: num(c.valor), status: c.status || "Pendente", dataPagamento: c.dataPagamento || null });

  const out = {
    estoque,
    vendas,
    compras,
    movimentos,
    clientes: (bruto.clientes || []).map(pessoa),
    fornecedores: (bruto.fornecedores || []).map(pessoa),
    contas: (bruto.contas || []).map(conta),
  };
  if (bruto.cambio && typeof bruto.cambio === "object") {
    out.config = [{ ...bruto.cambio, id: "cambio" }];
  }
  return out;
}
