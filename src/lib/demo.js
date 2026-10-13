// Dados de exemplo, usados só na versão de demonstração (VITE_DEMO=1).
import { diasAtras } from "./format.js";
import { salvarFoto } from "./fotos.js";

// Marca, tipo e cor da "foto" de exemplo de cada produto.
const DETALHES = {
  p1: ["Prati-Donaduzzi", "Analgésico", "#0f766e"],
  p2: ["EMS", "Analgésico", "#b91c1c"],
  p3: ["Medley", "Anti-inflamatório", "#7c3aed"],
  p4: ["Eurofarma", "Antibiótico", "#1d4ed8"],
  p5: ["EMS", "Anti-hipertensivo", "#c2410c"],
  p6: ["Medley", "Antiácido", "#0369a1"],
  p7: ["Equiplex", "Soro", "#0891b2"],
  p8: ["La Roche-Posay", "Dermocosmético", "#ca8a04"],
};

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
  ].map(([id, nome, qtd, custo, varejo, atacado, min]) => ({
    id, nome, qtd, custo, custoVendedor: Math.round(custo * 1.15 * 100) / 100, varejo, atacado,
    lojista: Math.round((atacado - (atacado - custo) * 0.3) * 100) / 100, min, baseEm: 0,
    marca: DETALHES[id][0], tipo: DETALHES[id][1], origem: "estoque",
    fornecedorId: ["p3", "p4", "p8"].includes(id) ? "f2" : "f1", fornecedorNome: ["p3", "p4", "p8"].includes(id) ? "Farma Import CDE" : "Distribuidora Guaraní", foto: ["p1", "p3", "p6", "p8"].includes(id) ? "demo-" + id : null,
  }));
  // Produtos que ficam no fornecedor e são vendidos sob encomenda.
  estoque.push(
    { id: "p9", nome: "Insulina NPH 10ml", qtd: 0, custo: 9.5, custoVendedor: 11, varejo: 18.9, atacado: 16.5, lojista: 15.2, min: 0, baseEm: 0, marca: "Novo Nordisk", tipo: "Antidiabético", origem: "fornecedor", fornecedorId: "f2", fornecedorNome: "Farma Import CDE", foto: null },
    { id: "p10", nome: "Colágeno hidrolisado 300g", qtd: 0, custo: 7.2, custoVendedor: 8.5, varejo: 16.0, atacado: 13.5, lojista: 12.4, min: 0, baseEm: 0, marca: "Sanavita", tipo: "Suplemento", origem: "fornecedor", fornecedorId: "f1", fornecedorNome: "Distribuidora Guaraní", foto: null },
  );
  const clientes = [
    { id: "c1", vendedorId: "s1", nome: "María González", contato: "+595 981 234 567", endereco: "Av. Mcal. López 1520, Villa Morra", cidade: "Asunción" },
    { id: "c2", vendedorId: "s2", nome: "Carlos Benítez", contato: "+595 971 555 012", tabela: "Atacado", endereco: "Calle Tomás Romero Pereira 340", cidade: "Encarnación" },
    { id: "c3", vendedorId: "s2", nome: "Ana Duarte", contato: "+595 991 300 450" },
    { id: "c4", vendedorId: "s1", nome: "Farmacia San Roque", contato: "+595 981 777 222", tabela: "Lojista", limiteCredito: 300, endereco: "Ruta PY02 km 12", cidade: "Coronel Oviedo" },
    { id: "c5", vendedorId: "s1", nome: "Jorge Villalba", contato: "+595 975 410 880", proximoContato: diasAtras(0), notaContato: "Disse que faz o pedido hoje", ultimoContato: diasAtras(4) },
  ];
  const fornecedores = [
    { id: "f1", nome: "Distribuidora Guaraní", contato: "+595 21 600 100", obs: "Entrega às terças" },
    { id: "f2", nome: "Farma Import CDE", contato: "+595 61 500 200" },
  ];
  const vendedores = [
    { id: "s1", nome: "Lucas Ortiz", contato: "+595 981 100 200", comissao: 5, meta: 1500, ativo: true, email: "lucas" },
    { id: "s2", nome: "Patricia Rojas", contato: "+595 982 300 400", comissao: 4, meta: 1200, ativo: true, email: "patricia" },
  ];
  const linha = (pid, qtd, tipo = "Varejo") => {
    const p = estoque.find((x) => x.id === pid);
    const precoUnit = tipo === "Atacado" ? p.atacado : tipo === "Lojista" ? p.lojista : p.varejo;
    return { itemId: pid, itemNome: p.nome, qtd, tipoVenda: tipo, precoUnit, subtotal: precoUnit * qtd };
  };
  const vendasBrutas = [
    [0, "c1", [["p1", 2], ["p6", 1]], "PIX", "À vista", "s1"],
    [0, "", [["p7", 3]], "Dólar", "À vista", "s2"],
    [1, "c4", [["p5", 40, "Lojista"], ["p1", 60, "Lojista"]], "PIX", "A prazo", "s1"],
    [3, "c1", [["p3", 1], ["p8", 1], ["p9", 2]], "Real", "À vista", "s1"],
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
  // Duas entregas a caminho, uma delas atrasada.
  const fretes = {
    v7: { freteiroId: "t1", freteiroNome: "Transportes Itapúa", valor: 25, prazoDias: 2, endereco: "Ruta PY02 km 12", cidade: "Coronel Oviedo", status: "Enviado", enviadoEm: diasAtras(4) },
    v3: { freteiroId: "t1", freteiroNome: "Transportes Itapúa", valor: 18, prazoDias: 3, endereco: "Calle Tomás Romero Pereira 340", cidade: "Encarnación", status: "Enviado", enviadoEm: diasAtras(1) },
  };
  for (const v of vendas) {
    if (!fretes[v.id]) continue;
    v.valorProdutos = v.valor;
    v.frete = fretes[v.id];
    v.valor += v.frete.valor;
  }
  // Um produto vendido sem cadastro.
  const v1 = vendas.find((v) => v.id === "v9");
  v1.itens.push({ itemId: null, itemNome: "Termômetro digital (pedido especial)", qtd: 1, tipoVenda: "Varejo", precoUnit: 6.5, subtotal: 6.5, avulso: true });
  v1.valor += 6.5;
  const movimentos = [
    { id: "m1", caixa: "dolar", tipo: "Entrada", valor: 350, descricao: "Troco inicial", data: diasAtras(20) },
    { id: "m2", caixa: "pix", tipo: "Entrada", valor: 1200, descricao: "Saldo inicial", data: diasAtras(20) },
  ];
  const contas = [
    { id: "k1", nome: "Energia - Farmácia", categoria: "Energia", valor: 85, vencimento: diasAtras(0), status: "Pendente", dataPagamento: null },
    { id: "k2", nome: "Aluguel", categoria: "Aluguel", valor: 600, vencimento: diasAtras(-12), status: "Pendente", dataPagamento: null },
    { id: "k4", nome: "Compra de Distribuidora Guaraní (1/2)", categoria: "Fornecedor", valor: 72.5, vencimento: diasAtras(-20), status: "Pendente", dataPagamento: null, compraId: "cp2", fornecedorId: "f1" },
    { id: "k5", nome: "Compra de Distribuidora Guaraní (2/2)", categoria: "Fornecedor", valor: 72.5, vencimento: diasAtras(-50), status: "Pendente", dataPagamento: null, compraId: "cp2", fornecedorId: "f1" },
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
  // Compras de exemplo: à vista, a prazo em 2 parcelas e uma consignada ainda sem acerto.
  const lc = (pid, qtd, custo) => ({ itemId: pid, nome: estoque.find((x) => x.id === pid).nome, qtd, custo, subtotal: qtd * custo });
  const compras = [
    { id: "cp1", fornecedorId: "f1", fornecedorNome: "Distribuidora Guaraní", condicao: "À vista", pagamento: "PIX", itens: [lc("p7", 30, 0.7)], total: 21, data: diasAtras(3), ts: Date.now() - 3 * 864e5 },
    { id: "cp2", fornecedorId: "f1", fornecedorNome: "Distribuidora Guaraní", condicao: "A prazo", vencimento: diasAtras(-20), parcelas: 2, itens: [lc("p1", 100, 0.9), lc("p5", 26, 2.1)], total: 144.6, data: diasAtras(10), ts: Date.now() - 10 * 864e5 },
    {
      id: "cp3", fornecedorId: "f2", fornecedorNome: "Farma Import CDE", condicao: "Consignado", status: "Em consignação", dataAcerto: diasAtras(-5), acertos: [],
      itens: [{ ...lc("p8", 12, 6.5), pago: 0, devolvido: 0 }, { ...lc("p3", 20, 1.5), pago: 0, devolvido: 0 }], total: 108, data: diasAtras(8), ts: Date.now() - 8 * 864e5,
    },
  ];
  contas.find((k) => k.id === "k5").valor = 72.1;
  // Orçamento em que o vendedor baixou o preço: espera a aprovação do dono.
  const lp = linha("p5", 50, "Lojista");
  const precoTabela = lp.precoUnit;
  const itensO2 = [{ ...lp, precoTabela, precoUnit: 3.4, subtotal: 3.4 * 50 }];
  orcamentos.push({
    id: "o2", numero: "LO-1", status: "Aberto", data: diasAtras(0), ts: 0, clienteId: "c4", clienteNome: "Farmacia San Roque",
    vendedorId: "s1", vendedorNome: "Lucas Ortiz", itens: itensO2, total: itensO2[0].subtotal, obs: "Cliente pediu desconto por levar 50", aprovacaoPreco: "Pendente", vistoPeloDono: false,
    frete: { precisa: false, endereco: "", cidade: "", obsEntrega: "", cotacoes: [], escolhida: null },
  });
  // Um orçamento que o dono já aprovou e o Lucas ainda não viu.
  const l3 = linha("p6", 20, "Atacado");
  const itensO3 = [{ ...l3, precoTabela: l3.precoUnit, precoUnit: 3.6, subtotal: 3.6 * 20 }];
  orcamentos.push({
    id: "o3", numero: "LO-2", status: "Aberto", data: diasAtras(1), ts: 0, clienteId: "c1", clienteNome: clientes.find((c) => c.id === "c1").nome,
    vendedorId: "s1", vendedorNome: "Lucas Ortiz", itens: itensO3, total: itensO3[0].subtotal, obs: "", aprovacaoPreco: "Aprovado", precoAprovadoEm: diasAtras(0),
    vistoPeloDono: true, respostaVista: false, frete: { precisa: false, endereco: "", cidade: "", obsEntrega: "", cotacoes: [], escolhida: null },
  });
  return { estoque, clientes, fornecedores, vendedores, vendas, movimentos, contas, compras, freteiros, orcamentos };
}

// Desenha "fotos" de exemplo (uma caixa de remédio com o nome) e guarda neste navegador.
export async function fotosDemo() {
  const produtos = { p1: "Dipirona 500mg", p3: "Ibuprofeno 400mg", p6: "Omeprazol 20mg", p8: "Protetor solar FPS 50" };
  for (const [id, nome] of Object.entries(produtos)) {
    const [marca, tipo, cor] = DETALHES[id];
    const c = document.createElement("canvas");
    c.width = c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#f1f5f9";
    g.fillRect(0, 0, 600, 600);
    g.fillStyle = "rgba(15,23,42,0.08)";
    g.fillRect(118, 168, 380, 300);
    g.fillStyle = "#ffffff";
    g.fillRect(100, 150, 380, 300);
    g.fillStyle = cor;
    g.fillRect(100, 150, 380, 90);
    g.fillRect(100, 420, 380, 30);
    g.fillStyle = "#ffffff";
    g.font = "600 30px system-ui, sans-serif";
    g.fillText(marca, 124, 206);
    g.fillStyle = "#0f172a";
    g.font = "700 34px system-ui, sans-serif";
    const [l1, ...resto] = nome.split(" ");
    g.fillText(l1, 124, 300);
    g.font = "500 28px system-ui, sans-serif";
    g.fillText(resto.join(" "), 124, 342);
    g.fillStyle = "#64748b";
    g.font = "400 22px system-ui, sans-serif";
    g.fillText(tipo, 124, 392);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    await salvarFoto(blob, "demo-" + id);
  }
}
