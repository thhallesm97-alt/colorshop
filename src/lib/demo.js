// Dados de exemplo, usados só na versão de demonstração (VITE_DEMO=1).
import { diasAtras } from "./format.js";

export function dadosDemo() {
  const estoque = [
    ["p1", "Dipirona 500mg (10 comp.)", 48, 0.9, 2.5, 2.0, 15],
    ["p2", "Paracetamol 750mg (20 comp.)", 6, 1.2, 3.2, 2.7, 10],
    ["p3", "Ibuprofeno 400mg (10 caps.)", 22, 1.5, 3.9, 3.3, 8],
    ["p4", "Amoxicilina 500mg (21 caps.)", 0, 3.8, 8.5, 7.4, 5],
    ["p5", "Losartana 50mg (30 comp.)", 35, 2.1, 5.0, 4.3, 10],
    ["p6", "Omeprazol 20mg (28 caps.)", 18, 1.8, 4.6, 3.9, 8],
    ["p7", "Soro fisiológico 500ml", 40, 0.7, 1.9, 1.5, 12],
    ["p8", "Protetor solar FPS 50", 9, 6.5, 14.9, 12.5, 4],
  ].map(([id, nome, qtd, custo, varejo, atacado, min]) => ({ id, nome, qtd, custo, varejo, atacado, min, baseEm: 0 }));
  const clientes = [
    { id: "c1", nome: "María González", contato: "+595 981 234 567" },
    { id: "c2", nome: "Carlos Benítez", contato: "+595 971 555 012" },
    { id: "c3", nome: "Ana Duarte", contato: "+595 991 300 450" },
  ];
  const fornecedores = [
    { id: "f1", nome: "Distribuidora Guaraní", contato: "+595 21 600 100", obs: "Entrega às terças" },
    { id: "f2", nome: "Farma Import CDE", contato: "+595 61 500 200" },
  ];
  const linha = (pid, qtd, tipo = "Varejo") => {
    const p = estoque.find((x) => x.id === pid);
    const precoUnit = tipo === "Atacado" ? p.atacado : p.varejo;
    return { itemId: pid, itemNome: p.nome, qtd, tipoVenda: tipo, precoUnit, subtotal: precoUnit * qtd };
  };
  const vendasBrutas = [
    [0, "c1", [["p1", 2], ["p6", 1]], "PIX", "À vista"],
    [0, "", [["p7", 3]], "Dólar", "À vista"],
    [1, "c2", [["p5", 2], ["p1", 4, "Atacado"]], "PIX", "A prazo"],
    [2, "c3", [["p3", 1], ["p8", 1]], "Real", "À vista"],
    [4, "c1", [["p1", 3], ["p2", 2]], "PIX", "À vista"],
    [6, "", [["p6", 2]], "Dólar", "À vista"],
    [9, "c2", [["p4", 1], ["p1", 2]], "USDT", "A prazo"],
    [15, "c3", [["p5", 1], ["p7", 2]], "PIX", "À vista"],
  ];
  const vendas = vendasBrutas.map(([dias, clienteId, itens, pagamento, condicao], i) => {
    const linhas = itens.map(([p, q, t]) => linha(p, q, t));
    const valor = linhas.reduce((s, l) => s + l.subtotal, 0);
    return {
      id: "v" + (vendasBrutas.length - i), numero: vendasBrutas.length - i, clienteId,
      clienteNome: clientes.find((c) => c.id === clienteId)?.nome || "Sem nome", itens: linhas, valor, pagamento, condicao,
      status: condicao === "À vista" ? "Pago" : "Pendente", data: diasAtras(dias), ts: 0,
    };
  });
  const movimentos = [
    { id: "m1", caixa: "dolar", tipo: "Entrada", valor: 350, descricao: "Troco inicial", data: diasAtras(20) },
    { id: "m2", caixa: "pix", tipo: "Entrada", valor: 1200, descricao: "Saldo inicial", data: diasAtras(20) },
  ];
  const contas = [
    { id: "k1", nome: "Energia - Farmácia", categoria: "Energia", valor: 85, vencimento: diasAtras(0), status: "Pendente", dataPagamento: null },
    { id: "k2", nome: "Aluguel", categoria: "Aluguel", valor: 600, vencimento: diasAtras(-12), status: "Pendente", dataPagamento: null },
    { id: "k3", nome: "Internet", categoria: "Internet", valor: 35, vencimento: diasAtras(3), status: "Pago", dataPagamento: diasAtras(4) },
  ];
  return { estoque, clientes, fornecedores, vendas, movimentos, contas, compras: [] };
}
