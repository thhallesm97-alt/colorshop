// Dinheiro: pagamento de comissão, conta do cliente, devolução e relatório do mês.
// Tudo aqui é só do dono (o vendedor não vê lucro nem a conta dos clientes).

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, Receipt, Wallet } from "lucide-react";
import { useApp, CAIXA_META, comissaoDoMes, lucroDaVenda, valorDevolvido, qtdDevolvida, faltaReceber, valorPagoDaVenda } from "./contexto.js";
import { fmtUSD, fmtDate, fmtNum, todayISO } from "./lib/format.js";
import { Modal, Field, inputCls, btnPrimario, btnIcone, Cartao, StatCard, Th, Td, Vazio, Badge } from "./ui.jsx";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const mesDe = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const nomeMes = (ano, mes) => new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function SelectCaixa({ value, onChange }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.keys(CAIXA_META).map((k) => <option key={k} value={k}>{CAIXA_META[k].label}</option>)}
    </select>
  );
}

export function SeletorMes({ refMes, setRefMes }) {
  const mudar = (d) => setRefMes(({ ano, mes }) => {
    const x = new Date(ano, mes + d, 1);
    return { ano: x.getFullYear(), mes: x.getMonth() };
  });
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => mudar(-1)} className={btnIcone} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
      <div className="text-sm font-semibold text-slate-900 w-40 text-center first-letter:uppercase">{nomeMes(refMes.ano, refMes.mes)}</div>
      <button onClick={() => mudar(1)} className={btnIcone} aria-label="Próximo mês"><ChevronRight size={18} /></button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagar comissão

export function PagarComissaoModal() {
  const { editando, vendedoresTodos, vendas, estoque, pagarComissao, fecharModal } = useApp();
  const vd = vendedoresTodos.find((v) => v.id === editando?.vendedorId);
  const mes = editando?.mes;
  const c = vd ? comissaoDoMes(vd, vendas, estoque, mes) : null;
  const [valor, setValor] = useState(c ? c.falta : 0);
  const [caixaKey, setCaixaKey] = useState("dolar");
  if (!vd) return null;
  const [ano, m] = mes.split("-").map(Number);
  return (
    <Modal title={`Pagar comissão · ${vd.nome}`} onClose={fecharModal}>
      <div className="rounded-lg bg-slate-50 px-4 py-3 mb-4 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-slate-500 first-letter:uppercase">Comissão de {nomeMes(ano, m - 1)}</span><span className="font-medium">{fmtUSD(c.valor)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Já pago</span><span className="font-medium">{fmtUSD(c.pago)}</span></div>
        <div className="flex justify-between"><span className="text-slate-700 font-medium">Falta pagar</span><span className="font-semibold text-violet-700">{fmtUSD(c.falta)}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (US$)"><input type="number" step="0.01" min="0" className={inputCls} value={valor} onChange={(e) => setValor(n(e.target.value))} /></Field>
        <Field label="Pago com"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      </div>
      {(vd.comissoesPagas || []).filter((p) => p.mes === mes).length > 0 && (
        <div className="text-xs text-slate-500 mb-4">
          {(vd.comissoesPagas || []).filter((p) => p.mes === mes).map((p, i) => (
            <div key={i}>Pago {fmtUSD(p.valor)} em {fmtDate(p.data)} ({CAIXA_META[p.caixa]?.label || p.caixa})</div>
          ))}
        </div>
      )}
      <button disabled={!(valor > 0)} onClick={() => { pagarComissao(vd.id, mes, valor, caixaKey); fecharModal(); }} className={btnPrimario + " w-full"}>
        Registrar pagamento (sai do caixa)
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Conta do cliente

export function ContaClienteModal() {
  const { editando: c, vendas, abrirModal, fecharModal } = useApp();
  if (!c) return null;
  const voltar = { modal: "contaCliente", item: c };
  const vs = vendas.filter((v) => v.clienteId === c.id).sort((a, b) => (b.ts || 0) - (a.ts || 0) || String(b.data).localeCompare(String(a.data)));
  const total = vs.reduce((s, v) => s + n(v.valor), 0);
  const emAberto = vs.filter((v) => v.status === "Pendente").reduce((s, v) => s + faltaReceber(v), 0);
  const limite = n(c.limiteCredito);
  const atrasadas = vs.filter((v) => v.status === "Pendente" && v.data < diasAtrasISO(30));
  return (
    <Modal title={`Conta de ${c.nome}`} onClose={fecharModal} wide>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Numero rotulo="Total comprado" valor={fmtUSD(total)} />
        <Numero rotulo="Deve hoje" valor={fmtUSD(emAberto)} tom={emAberto > 0 ? "text-amber-700" : ""} />
        <Numero rotulo="Limite de crédito" valor={limite > 0 ? fmtUSD(limite) : "Sem limite"} />
        <Numero rotulo="Disponível" valor={limite > 0 ? fmtUSD(Math.max(0, limite - emAberto)) : "—"} tom={limite > 0 && emAberto > limite ? "text-red-600" : ""} />
      </div>
      {limite > 0 && emAberto > limite && <div className="mb-3 text-sm text-red-600">Passou do limite em {fmtUSD(emAberto - limite)}.</div>}
      {atrasadas.length > 0 && <div className="mb-3 text-sm text-amber-700">{atrasadas.length} {atrasadas.length === 1 ? "venda a prazo há mais de 30 dias" : "vendas a prazo há mais de 30 dias"} sem pagar.</div>}
      <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-100"><Th>Data</Th><Th>Venda</Th><Th>Itens</Th><Th right>Valor</Th><Th>Situação</Th><Th right></Th></tr>
          </thead>
          <tbody>
            {vs.map((v) => (
              <tr key={v.id} className="border-b border-slate-50">
                <Td className="whitespace-nowrap text-slate-600">{fmtDate(v.data)}</Td>
                <Td className="whitespace-nowrap">#{v.numero}{v.vendedorNome && <div className="text-xs text-slate-400">{v.vendedorNome}</div>}</Td>
                <Td className="text-slate-600">
                  {(v.itens || []).map((l, i) => <div key={i}>{l.itemNome} × {l.qtd}</div>)}
                  {valorDevolvido(v) > 0 && <div className="text-xs text-red-600">Devolvido {fmtUSD(valorDevolvido(v))}</div>}
                </Td>
                <Td right className="whitespace-nowrap font-medium">
                  {fmtUSD(v.valor)}
                  {v.status === "Pendente" && valorPagoDaVenda(v) > 0 && <div className="text-xs font-normal text-amber-700">Falta {fmtUSD(faltaReceber(v))}</div>}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge status={v.status} />
                  {(v.pagamentos || []).map((p, i) => <div key={i} className="text-xs text-slate-500 mt-0.5">Pagou {fmtUSD(p.valor)} em {fmtDate(p.data)}</div>)}
                  <div className="text-xs text-slate-400 mt-0.5">{v.status === "Pago" ? (v.dataRecebimento ? `Recebido ${fmtDate(v.dataRecebimento)}` : v.condicao) : v.condicao}</div>
                </Td>
                <Td right>
                  {v.status === "Pendente" && <button onClick={() => abrirModal("receberVenda", v, voltar)} className="text-xs font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-md px-2 py-1">Receber</button>}
                </Td>
              </tr>
            ))}
            {vs.length === 0 && <Vazio colSpan={6}>Este cliente ainda não comprou.</Vazio>}
          </tbody>
        </table>
      </div>
      <button onClick={() => abrirModal("cliente", c, voltar)} className="mt-3 text-sm text-emerald-700 hover:underline">Mudar limite de crédito ou tabela de preço</button>
    </Modal>
  );
}

const diasAtrasISO = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

function Numero({ rotulo, valor, tom = "" }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`font-semibold tabular-nums ${tom || "text-slate-900"}`}>{valor}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Devolução do cliente

export function DevolucaoModal() {
  const { editando: venda, vendasTodas, registrarDevolucao, fecharModal } = useApp();
  const v = vendasTodas.find((x) => x.id === venda?.id) || venda;
  const [qtds, setQtds] = useState({});
  const [caixaKey, setCaixaKey] = useState("dolar");
  const [motivo, setMotivo] = useState("");
  if (!v) return null;
  const linhas = (v.itens || []).map((l, i) => ({ l, i, max: Math.max(0, n(l.qtd) - qtdDevolvida(v, i)) }));
  const valor = linhas.reduce((s, { l, i }) => s + n(qtds[i]) * n(l.precoUnit), 0);
  const invalido = linhas.some(({ i, max }) => n(qtds[i]) > max || n(qtds[i]) < 0);
  const pendente = v.status === "Pendente";
  return (
    <Modal title={`Devolução da venda #${v.numero} · ${v.clienteNome}`} onClose={fecharModal}>
      <p className="text-sm text-slate-600 mb-3">Quantos de cada produto o cliente devolveu? Os produtos voltam ao estoque.</p>
      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
        {linhas.map(({ l, i, max }) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="text-slate-900">{l.itemNome}</div>
              <div className="text-xs text-slate-400">Vendidos {l.qtd} · {fmtUSD(l.precoUnit)} un.{max < l.qtd ? ` · já devolvidos ${l.qtd - max}` : ""}</div>
            </div>
            <input type="number" min="0" max={max} step="1" disabled={max === 0} value={qtds[i] ?? ""} placeholder="0"
              onChange={(e) => setQtds((q) => ({ ...q, [i]: Math.floor(n(e.target.value)) }))}
              className={"w-20 border rounded-md px-2 py-1 text-right " + (n(qtds[i]) > max ? "border-red-400" : "border-slate-200")} aria-label={`Devolver ${l.itemNome}`} />
          </div>
        ))}
      </div>
      <Field label="Motivo (opcional)"><input className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: produto errado" /></Field>
      {pendente ? (
        <p className="text-sm text-slate-600 mb-4">A venda ainda está a receber: o valor é abatido do que o cliente deve.</p>
      ) : (
        <Field label="Devolver o dinheiro pelo caixa"><SelectCaixa value={caixaKey} onChange={setCaixaKey} /></Field>
      )}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 mb-4">
        <span className="text-sm text-slate-500">{pendente ? "Abater do que deve" : "Devolver ao cliente"}</span>
        <span className="text-lg font-semibold text-slate-900">{fmtUSD(valor)}</span>
      </div>
      <button disabled={invalido || !(valor > 0)}
        onClick={() => { registrarDevolucao(v.id, { itens: linhas.map(({ i }) => ({ linha: i, qtd: n(qtds[i]) })), caixaKey, motivo: motivo.trim() }); fecharModal(); }}
        className={btnPrimario + " w-full"}>
        Registrar devolução
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Relatório do mês

export function RelatorioPage() {
  const { vendas, estoque, vendedores, fornecedores, contas, compras } = useApp();
  const hoje = new Date();
  const [refMes, setRefMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const mes = `${refMes.ano}-${String(refMes.mes + 1).padStart(2, "0")}`;

  const r = useMemo(() => {
    const porId = new Map(estoque.map((i) => [i.id, i]));
    // Custo real de cada linha: o guardado na venda, ou o custo atual do produto.
    const custoReal = (l) => (l.custoReal != null ? n(l.custoReal) : l.itemId && porId.get(l.itemId) ? n(porId.get(l.itemId).custo) : n(l.custoVendedor));
    const doMes = vendas.filter((v) => String(v.data).startsWith(mes));
    const produtos = new Map();
    const porForn = new Map();
    let receita = 0, custo = 0, devolvido = 0;
    for (const v of doMes) {
      const devPorLinha = {};
      for (const d of v.devolucoes || []) for (const x of d.itens || []) devPorLinha[x.linha] = (devPorLinha[x.linha] || { qtd: 0, valor: 0 }), devPorLinha[x.linha].qtd += n(x.qtd), devPorLinha[x.linha].valor += n(x.valor);
      v.itens.forEach((l, i) => {
        const dv = devPorLinha[i] || { qtd: 0, valor: 0 };
        const q = n(l.qtd) - dv.qtd;
        const rec = n(l.subtotal) - dv.valor;
        const cst = custoReal(l) * q;
        receita += rec; custo += cst; devolvido += dv.valor;
        const k = l.itemId || "avulso:" + l.itemNome;
        const p = produtos.get(k) || { nome: l.itemNome, qtd: 0, receita: 0, lucro: 0 };
        p.qtd += q; p.receita += rec; p.lucro += rec - cst;
        produtos.set(k, p);
        const item = l.itemId && porId.get(l.itemId);
        const fid = item?.fornecedorId || l.fornecedorId || "";
        const f = porForn.get(fid) || { qtd: 0, receita: 0, lucro: 0 };
        f.qtd += q; f.receita += rec; f.lucro += rec - cst;
        porForn.set(fid, f);
      });
    }
    const vend = vendedores.map((vd) => {
      const c = comissaoDoMes(vd, vendas, estoque, mes);
      const vendido = c.vendas.reduce((s, v) => s + v.itens.reduce((a, l) => a + n(l.subtotal), 0) - valorDevolvido(v), 0);
      const lucroReal = c.vendas.reduce((s, v) => s + v.itens.reduce((a, l, i) => a + n(l.subtotal) - custoReal(l) * n(l.qtd), 0), 0)
        - c.vendas.reduce((s, v) => s + (v.devolucoes || []).reduce((a, d) => a + (d.itens || []).reduce((b, x) => b + n(x.valor) - custoReal(v.itens[x.linha] || {}) * n(x.qtd), 0), 0), 0);
      return { vd, vendido, lucroReal, comissao: c.valor, pago: c.pago, falta: c.falta };
    }).filter((x) => x.vendido > 0 || x.comissao > 0);
    const comissoes = vend.reduce((s, x) => s + x.comissao, 0);
    const despesasLista = contas.filter((k) => k.status === "Pago" && String(k.dataPagamento || "").startsWith(mes) && k.categoria !== "Fornecedor");
    const despesas = despesasLista.reduce((s, k) => s + n(k.valor), 0);
    const porCategoria = {};
    for (const k of despesasLista) porCategoria[k.categoria] = (porCategoria[k.categoria] || 0) + n(k.valor);
    const comprado = compras.filter((c) => String(c.data).startsWith(mes) && c.condicao !== "Devolução").reduce((s, c) => s + n(c.total), 0);
    // A receber: o que falta pagar (sem passar do valor dos produtos, pois o frete é repassado).
    const aReceber = doMes.filter((v) => v.status === "Pendente").reduce((s, v) => s + Math.min(n(v.valorProdutos ?? v.valor), faltaReceber(v)), 0);
    const recebido = doMes.reduce((s, v) => s + n(v.valorProdutos ?? v.valor), 0) - aReceber;
    const bruto = receita - custo;
    return {
      qtdVendas: doMes.length, receita, custo, bruto, devolvido, comissoes, despesas, porCategoria, liquido: bruto - comissoes - despesas,
      comprado, recebido, aReceber, vend,
      produtos: [...produtos.values()].sort((a, b) => b.lucro - a.lucro),
      fornecedores: [...porForn.entries()].map(([id, f]) => ({ ...f, nome: id ? fornecedores.find((x) => x.id === id)?.nome || "Fornecedor" : "Sem fornecedor" })).sort((a, b) => b.lucro - a.lucro),
    };
  }, [vendas, estoque, vendedores, fornecedores, contas, compras, mes]);
  const margem = r.receita > 0 ? (r.bruto / r.receita) * 100 : 0;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <SeletorMes refMes={refMes} setRefMes={setRefMes} />
        <div className="text-xs text-slate-400">Só você vê esta página. O frete não entra (você recebe e repassa ao freteiro).</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Vendido (produtos)" value={fmtUSD(r.receita)} sub={`${r.qtdVendas} vendas${r.devolvido > 0 ? ` · ${fmtUSD(r.devolvido)} devolvidos` : ""}`} icon={DollarSign} />
        <StatCard label="Lucro bruto" value={fmtUSD(r.bruto)} sub={`Margem de ${fmtNum(margem, 1)}% sobre o custo real`} icon={TrendingUp} tom="sky" />
        <StatCard label="Comissões e despesas" value={fmtUSD(r.comissoes + r.despesas)} sub={`${fmtUSD(r.comissoes)} comissões · ${fmtUSD(r.despesas)} contas`} icon={Receipt} tom="violet" />
        <StatCard label="Lucro líquido" value={fmtUSD(r.liquido)} sub="Lucro bruto menos comissões e contas pagas" icon={Wallet} tom={r.liquido >= 0 ? "emerald" : "amber"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Cartao title="Resumo do mês">
          <div className="text-sm divide-y divide-slate-100">
            <Linha r="Vendido em produtos" v={fmtUSD(r.receita)} />
            <Linha r="Custo real dos produtos" v={`− ${fmtUSD(r.custo)}`} />
            <Linha r="Lucro bruto" v={fmtUSD(r.bruto)} forte />
            <Linha r="Comissões dos vendedores" v={`− ${fmtUSD(r.comissoes)}`} />
            {Object.entries(r.porCategoria).map(([k, v]) => <Linha key={k} r={`Conta: ${k}`} v={`− ${fmtUSD(v)}`} />)}
            <Linha r="Lucro líquido" v={fmtUSD(r.liquido)} forte />
            <Linha r="Já recebido das vendas do mês" v={fmtUSD(r.recebido)} cinza />
            <Linha r="Ainda a receber" v={fmtUSD(r.aReceber)} cinza />
            <Linha r="Comprado de fornecedores" v={fmtUSD(r.comprado)} cinza />
          </div>
        </Cartao>
        <Cartao title="Por vendedor">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100"><Th>Vendedor</Th><Th right>Vendido</Th><Th right>Lucro real</Th><Th right>Comissão</Th><Th right>A pagar</Th></tr></thead>
              <tbody>
                {r.vend.map((x) => (
                  <tr key={x.vd.id} className="border-b border-slate-50">
                    <Td className="text-slate-900">{x.vd.nome}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(x.vendido)}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(x.lucroReal)}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(x.comissao)}</Td>
                    <Td right className={"whitespace-nowrap " + (x.falta > 0 ? "text-violet-700 font-medium" : "text-slate-400")}>{x.falta > 0 ? fmtUSD(x.falta) : "Pago"}</Td>
                  </tr>
                ))}
                {r.vend.length === 0 && <Vazio colSpan={5}>Nenhuma venda de vendedor neste mês.</Vazio>}
              </tbody>
            </table>
          </div>
        </Cartao>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Cartao title="Produtos que mais deram lucro">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100"><Th>Produto</Th><Th right>Qtd</Th><Th right>Vendido</Th><Th right>Lucro</Th><Th right>Margem</Th></tr></thead>
              <tbody>
                {r.produtos.slice(0, 15).map((p, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <Td className="text-slate-900">{p.nome}</Td>
                    <Td right className="tabular-nums">{p.qtd}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(p.receita)}</Td>
                    <Td right className={"whitespace-nowrap font-medium " + (p.lucro < 0 ? "text-red-600" : "text-slate-900")}>{fmtUSD(p.lucro)}</Td>
                    <Td right className="text-slate-500">{p.receita > 0 ? `${fmtNum((p.lucro / p.receita) * 100, 0)}%` : "—"}</Td>
                  </tr>
                ))}
                {r.produtos.length === 0 && <Vazio colSpan={5}>Nenhuma venda neste mês.</Vazio>}
              </tbody>
            </table>
          </div>
        </Cartao>
        <Cartao title="Por fornecedor">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100"><Th>Fornecedor</Th><Th right>Qtd</Th><Th right>Vendido</Th><Th right>Lucro</Th></tr></thead>
              <tbody>
                {r.fornecedores.map((f, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <Td className="text-slate-900">{f.nome}</Td>
                    <Td right className="tabular-nums">{f.qtd}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(f.receita)}</Td>
                    <Td right className="whitespace-nowrap font-medium">{fmtUSD(f.lucro)}</Td>
                  </tr>
                ))}
                {r.fornecedores.length === 0 && <Vazio colSpan={4}>Nenhuma venda neste mês.</Vazio>}
              </tbody>
            </table>
          </div>
        </Cartao>
      </div>
    </>
  );
}

function Linha({ r, v, forte, cinza }) {
  return (
    <div className={`flex items-center justify-between py-2 ${forte ? "font-semibold text-slate-900" : cinza ? "text-slate-400" : "text-slate-600"}`}>
      <span>{r}</span><span className="tabular-nums whitespace-nowrap">{v}</span>
    </div>
  );
}
