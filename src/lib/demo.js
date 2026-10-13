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
  ].map(([id, nome, qtd, custo, varejo, atacado, min]) => ({ id, nome, qtd, custo, varejo, atacado, lojista: Math.round((atacado - (atacado - custo) * 0.3) * 100) / 100, min, baseEm: 0 }));
  const clientes = [
    { id: "c1", nome: "María González", contato: "+595 981 234 567", endereco: "Av. Mcal. López 1520, Villa Morra", cidade: "Asunción" },
    { id: "c2", nome: "Carlos Benítez", contato: "+595 971 555 012", tabela: "Atacado", endereco: "Calle Tomás Romero Pereira 340", cidade: "Encarnación" },
    { id: "c3", nome: "Ana Duarte", contato: "+595 991 300 450" },
    { id: "c4", nome: "Farmacia San Roque", contato: "+595 981 777 222", tabela: "Lojista", endereco: "Ruta PY02 km 12", cidade: "Coronel Oviedo" },
    { id: "c5", nome: "Jorge Villalba", contato: "+595 975 410 880", proximoContato: diasAtras(0), notaContato: "Disse que faz o pedido hoje", ultimoContato: diasAtras(4) },
  ];
  const fornecedores = [
    { id: "f1", nome: "Distribuidora Guaraní", contato: "+595 21 600 100", obs: "Entrega às terças" },
    { id: "f2", nome: "Farma Import CDE", contato: "+595 61 500 200" },
  ];
  const vendedores = [
    { id: "s1", nome: "Lucas Ortiz", contato: "+595 981 100 200", comissao: 5, meta: 1500, ativo: true },
    { id: "s2", nome: "Patricia Rojas", contato: "+595 982 300 400", comissao: 4, meta: 1200, ativo: true },
  ];
  const linha = (pid, qtd, tipo = "Varejo") => {
    const p = estoque.find((x) => x.id === pid);
    const precoUnit = tipo === "Atacado" ? p.atacado : p.varejo;
    return { itemId: pid, itemNome: p.nome, qtd, tipoVenda: tipo, precoUnit, subtotal: precoUnit * qtd };
  };
  const vendasBrutas = [
    [0, "c1", [["p1", 2], ["p6", 1]], "PIX", "À vista", "s1"],
    [0, "", [["p7", 3]], "Dólar", "À vista", "s2"],
    [1, "c4", [["p5", 40, "Lojista"], ["p1", 60, "Lojista"]], "PIX", "A prazo", "s1"],
    [3, "c1", [["p3", 1], ["p8", 1]], "Real", "À vista", "s2"],
    [4, "c1", [["p1", 3], ["p2", 2]], "PIX", "À vista", "s1"],
    [6, "", [["p6", 2]], "Dólar", "À vista", ""],
    [9, "c2", [["p4", 10, "Atacado"], ["p1", 20, "Atacado"]], "USDT", "A prazo", "s2"],
    [15, "c3", [["p5", 1], ["p7", 2]], "PIX", "À vista", "s2"],
    [12, "c5", [["p6", 3], ["p3", 2]], "PIX", "À vista", "s1"],
  ];
  const vendas = vendasBrutas.map(([dias, clienteId, itens, pagamento, condicao, vendedorId], i) => {
    const linhas = itens.map(([p, q, t]) => linha(p, q, t));
    const valor = linhas.reduce((s, l) => s + l.subtotal, 0);
    return {
      id: "v" + (vendasBrutas.length - i), numero: vendasBrutas.length - i, clienteId,
      clienteNome: clientes.find((c) => c.id === clienteId)?.nome || "Sem nome",
      vendedorId, vendedorNome: vendedores.find((v) => v.id === vendedorId)?.nome || "", itens: linhas, valor, pagamento, condicao,
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
  const freteiros = [
    { id: "t1", nome: "Transportes Itapúa", contato: "+595 985 222 333", obs: "Interior, sai às segundas e quintas" },
    { id: "t2", nome: "Moto Express Asunción", contato: "+595 994 111 999", obs: "Entregas na capital" },
    { id: "t3", nome: "Rápido del Sur", contato: "+595 983 444 555" },
  ];
  // Um orçamento aberto com cotações de frete em andamento.
  const itensOrc = [["p5", 30, "Atacado"], ["p6", 20, "Atacado"]].map(([p, q, t]) => linha(p, q, t));
  const orcamentos = [
    {
      id: "o1", numero: 1, status: "Aberto", data: diasAtras(0), ts: 0, clienteId: "c2", clienteNome: "Carlos Benítez",
      vendedorId: "s2", vendedorNome: "Patricia Rojas", itens: itensOrc, total: itensOrc.reduce((s, l) => s + l.subtotal, 0), obs: "",
      frete: {
        precisa: true, endereco: "Calle Tomás Romero Pereira 340", cidade: "Encarnación", obsEntrega: "Entregar de manhã", escolhida: null,
        cotacoes: [
          { freteiroId: "t1", nome: "Transportes Itapúa", contato: "+595 985 222 333", status: "Respondido", valor: 18, prazoDias: 2, enviadoEm: diasAtras(0) },
          { freteiroId: "t3", nome: "Rápido del Sur", contato: "+595 983 444 555", status: "Aguardando", valor: null, prazoDias: null, enviadoEm: diasAtras(0) },
        ],
      },
    },
  ];
  return { estoque, clientes, fornecedores, vendedores, vendas, movimentos, contas, compras: [], freteiros, orcamentos };
}
