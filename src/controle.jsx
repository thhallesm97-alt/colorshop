// Controle do dono: fechamento do caixa do dia e histórico de alterações.

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useApp, CAIXA_META } from "./contexto.js";
import { fmtUSD, fmtDate, fmtHora, todayISO, isoLocal, parseISO, normalizar } from "./lib/format.js";
import { inputCls, btnPrimario, btnIcone, Cartao, TableShell, Th, Td, Vazio, Segmentado } from "./ui.jsx";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const mudarDia = (iso, d) => { const x = parseISO(iso); x.setDate(x.getDate() + d); return isoLocal(x); };
const sinal = (m) => (m.tipo === "Entrada" ? 1 : -1) * n(m.valor);

// ---------------------------------------------------------------------------
// Fechamento do dia

export function FechamentoPage() {
  const { movimentos, vendasTodas, fechamentos, fecharDia } = useApp();
  const [dia, setDia] = useState(todayISO());
  const salvo = fechamentos.find((f) => f.id === dia);
  const [contado, setContado] = useState({});
  const [obs, setObs] = useState("");
  const [diaDoForm, setDiaDoForm] = useState(null);
  // Ao trocar de dia, o formulário mostra o que foi contado no fechamento salvo.
  if (diaDoForm !== dia) {
    setDiaDoForm(dia);
    setContado(salvo ? Object.fromEntries(Object.entries(salvo.caixas || {}).map(([k, c]) => [k, c.contado ?? ""])) : {});
    setObs(salvo?.obs || "");
  }

  const doDia = useMemo(() => movimentos.filter((m) => m.data === dia).sort((a, b) => (a.ts || 0) - (b.ts || 0)), [movimentos, dia]);
  const resumo = useMemo(() => {
    const out = {};
    for (const k of Object.keys(CAIXA_META)) {
      const abertura = r2(movimentos.filter((m) => m.caixa === k && m.data < dia).reduce((s, m) => s + sinal(m), 0));
      const entradas = r2(doDia.filter((m) => m.caixa === k && m.tipo === "Entrada").reduce((s, m) => s + n(m.valor), 0));
      const saidas = r2(doDia.filter((m) => m.caixa === k && m.tipo !== "Entrada").reduce((s, m) => s + n(m.valor), 0));
      out[k] = { abertura, entradas, saidas, esperado: r2(abertura + entradas - saidas) };
    }
    return out;
  }, [movimentos, doDia, dia]);

  const vendasDia = useMemo(() => {
    const vs = vendasTodas.filter((v) => v.data === dia);
    const total = vs.reduce((s, v) => s + n(v.valor), 0);
    const aVista = vs.filter((v) => v.condicao === "À vista").reduce((s, v) => s + n(v.valor), 0);
    const recebidoAntigas = vendasTodas.reduce((s, v) => s + (v.pagamentos || []).filter((p) => p.data === dia).reduce((a, p) => a + n(p.valor), 0), 0);
    const devolvido = vendasTodas.reduce((s, v) => s + (v.devolucoes || []).filter((d) => d.data === dia).reduce((a, d) => a + n(d.valor), 0), 0);
    return { qtd: vs.length, total, aVista, aPrazo: total - aVista, recebidoAntigas, devolvido };
  }, [vendasTodas, dia]);

  const linhas = Object.keys(CAIXA_META).map((k) => {
    const c = resumo[k];
    const temContagem = contado[k] !== undefined && contado[k] !== "" && contado[k] !== null;
    const dif = temContagem ? r2(n(contado[k]) - c.esperado) : null;
    return { k, ...c, temContagem, dif };
  });
  const depoisDoFechamento = salvo ? doDia.filter((m) => (m.ts || 0) > salvo.ts).length : 0;
  const ehHoje = dia === todayISO();

  function salvar() {
    const caixas = Object.fromEntries(linhas.map((l) => [l.k, {
      abertura: l.abertura, entradas: l.entradas, saidas: l.saidas, esperado: l.esperado,
      contado: l.temContagem ? r2(n(contado[l.k])) : null, diferenca: l.temContagem ? l.dif : 0,
    }]));
    fecharDia(dia, caixas, obs.trim());
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setDia((d) => mudarDia(d, -1))} className={btnIcone} aria-label="Dia anterior"><ChevronLeft size={18} /></button>
          <input type="date" className={inputCls + " w-44"} value={dia} max={todayISO()} onChange={(e) => e.target.value && setDia(e.target.value)} />
          <button onClick={() => setDia((d) => mudarDia(d, 1))} disabled={ehHoje} className={btnIcone + " disabled:opacity-30"} aria-label="Próximo dia"><ChevronRight size={18} /></button>
          {!ehHoje && <button onClick={() => setDia(todayISO())} className="text-xs text-emerald-700 hover:underline">Hoje</button>}
        </div>
        {salvo ? (
          <div className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 size={16} /> Fechado por {salvo.fechadoPor} às {fmtHora(salvo.ts)}{salvo.data !== isoLocal(new Date(salvo.ts)) ? ` de ${fmtDate(isoLocal(new Date(salvo.ts)))}` : ""}
          </div>
        ) : (
          <div className="text-sm text-amber-700">Dia ainda não fechado</div>
        )}
      </div>

      {depoisDoFechamento > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          {depoisDoFechamento === 1 ? "Houve 1 lançamento" : `Houve ${depoisDoFechamento} lançamentos`} depois do fechamento. Confira e feche de novo.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <Cartao title="Caixas do dia" sub="Conte o dinheiro de cada caixa e escreva quanto tem. A diferença aparece na hora." className="xl:col-span-2">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <Th>Caixa</Th><Th right>Abertura</Th><Th right>Entradas</Th><Th right>Saídas</Th><Th right>Deve ter</Th><Th right>Contado</Th><Th right>Diferença</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const f = CAIXA_META[l.k].format;
                  return (
                    <tr key={l.k} className="border-b border-slate-50">
                      <Td className="font-medium text-slate-900 whitespace-nowrap">{CAIXA_META[l.k].label}</Td>
                      <Td right className="whitespace-nowrap tabular-nums text-slate-600">{f(l.abertura)}</Td>
                      <Td right className="whitespace-nowrap tabular-nums text-emerald-700">{l.entradas ? "+ " + f(l.entradas) : "—"}</Td>
                      <Td right className="whitespace-nowrap tabular-nums text-red-600">{l.saidas ? "− " + f(l.saidas) : "—"}</Td>
                      <Td right className="whitespace-nowrap tabular-nums font-semibold text-slate-900">{f(l.esperado)}</Td>
                      <Td right>
                        <input
                          type="number" step="0.01" inputMode="decimal" placeholder={String(l.esperado)}
                          className={inputCls + " w-28 text-right ml-auto"} value={contado[l.k] ?? ""}
                          onChange={(e) => setContado((c) => ({ ...c, [l.k]: e.target.value }))}
                        />
                      </Td>
                      <Td right className={`whitespace-nowrap tabular-nums font-medium ${l.dif == null ? "text-slate-300" : Math.abs(l.dif) < 0.005 ? "text-emerald-700" : "text-red-600"}`}>
                        {l.dif == null ? "—" : Math.abs(l.dif) < 0.005 ? "Certo" : `${l.dif > 0 ? "Sobrou" : "Faltou"} ${f(Math.abs(l.dif))}`}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-slate-600 mb-1">Observação</span>
              <input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: faltou troco, sangria para o banco..." />
            </label>
            <button onClick={salvar} className={btnPrimario + " shrink-0"}>{salvo ? "Fechar de novo" : "Fechar o dia"}</button>
          </div>
          <div className="mt-2 text-xs text-slate-400">Caixa sem contagem é fechado pelo valor que o sistema calcula.</div>
        </Cartao>

        <Cartao title="Vendas do dia">
          <div className="divide-y divide-slate-100 text-sm">
            <Linha r="Vendas feitas" v={vendasDia.qtd} />
            <Linha r="Total vendido" v={fmtUSD(vendasDia.total)} forte />
            <Linha r="À vista" v={fmtUSD(vendasDia.aVista)} />
            <Linha r="A prazo (a receber)" v={fmtUSD(vendasDia.aPrazo)} />
            <Linha r="Recebido de vendas a prazo" v={fmtUSD(vendasDia.recebidoAntigas)} />
            {vendasDia.devolvido > 0 && <Linha r="Devoluções" v={"− " + fmtUSD(vendasDia.devolvido)} />}
          </div>
          {salvo?.obs && <div className="mt-3 text-xs text-slate-500">Obs. do fechamento: {salvo.obs}</div>}
        </Cartao>
      </div>

      <TableShell title="Lançamentos do dia" sub={`${doDia.length} ${doDia.length === 1 ? "lançamento" : "lançamentos"}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50"><Th>Hora</Th><Th>Caixa</Th><Th>Descrição</Th><Th right>Valor</Th></tr>
          </thead>
          <tbody>
            {doDia.map((m) => {
              const meta = CAIXA_META[m.caixa];
              return (
                <tr key={m.id} className="border-b border-slate-50">
                  <Td className="text-slate-500 whitespace-nowrap tabular-nums">{m.ts ? fmtHora(m.ts) : "—"}</Td>
                  <Td className="font-medium text-slate-900 whitespace-nowrap">{meta?.label || m.caixa}</Td>
                  <Td className="text-slate-600">{m.descricao}</Td>
                  <Td right className={`whitespace-nowrap font-medium tabular-nums ${m.tipo === "Entrada" ? "text-emerald-700" : "text-red-600"}`}>
                    {m.tipo === "Entrada" ? "+" : "−"} {meta ? meta.format(m.valor) : m.valor}
                  </Td>
                </tr>
              );
            })}
            {doDia.length === 0 && <Vazio colSpan={4}>Nenhum lançamento neste dia.</Vazio>}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}

function Linha({ r, v, forte }) {
  return (
    <div className={`flex items-center justify-between py-2 ${forte ? "font-semibold text-slate-900" : "text-slate-600"}`}>
      <span>{r}</span><span className="tabular-nums whitespace-nowrap">{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Histórico de alterações

const TIPOS = ["Venda", "Recebimento", "Devolução", "Orçamento", "Produto", "Compra", "Pagamento", "Caixa", "Cliente", "Vendedor", "Comissão", "Conta", "Câmbio", "Fechamento", "Exclusão"];
const COR = {
  Exclusão: "bg-red-50 text-red-700", Devolução: "bg-orange-50 text-orange-700", Produto: "bg-sky-50 text-sky-700",
  Orçamento: "bg-violet-50 text-violet-700", Recebimento: "bg-emerald-50 text-emerald-700", Venda: "bg-emerald-50 text-emerald-700",
  Fechamento: "bg-slate-100 text-slate-700", Câmbio: "bg-amber-50 text-amber-700",
};

export function HistoricoPage() {
  const { historico } = useApp();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [quem, setQuem] = useState("todos");
  const [limite, setLimite] = useState(200);
  const pessoas = useMemo(() => [...new Set(historico.map((h) => h.quem).filter(Boolean))].sort(), [historico]);
  const lista = useMemo(() => {
    const busca = normalizar(q);
    return historico
      .filter((h) => (!tipo || h.acao === tipo) && (quem === "todos" || h.quem === quem) && (!busca || normalizar(`${h.detalhe} ${h.quem}`).includes(busca)))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [historico, q, tipo, quem]);
  const visiveis = lista.slice(0, limite);
  // Agrupa por dia.
  const grupos = [];
  for (const h of visiveis) {
    const g = grupos[grupos.length - 1];
    if (g && g.data === h.data) g.itens.push(h);
    else grupos.push({ data: h.data, itens: [h] });
  }
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input className={inputCls + " w-full sm:w-72"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (produto, cliente, nº da venda...)" />
        <select className={inputCls + " w-auto"} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tudo</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {pessoas.length > 1 && (
          <Segmentado valor={quem} onChange={setQuem} opcoes={[{ valor: "todos", label: "Todos" }, ...pessoas.map((p) => ({ valor: p, label: p }))]} />
        )}
      </div>
      <TableShell title="Histórico de alterações" sub={`Quem mudou o quê e quando. ${lista.length} ${lista.length === 1 ? "registro" : "registros"}.`}>
        {grupos.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">{historico.length ? "Nada encontrado com esse filtro." : "Ainda não há alterações registradas."}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {grupos.map((g) => (
              <div key={g.data} className="px-5 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{g.data === todayISO() ? "Hoje" : fmtDate(g.data)}</div>
                <ul className="space-y-2">
                  {g.itens.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 text-sm">
                      <span className="w-11 shrink-0 text-xs text-slate-400 tabular-nums pt-0.5">{fmtHora(h.ts)}</span>
                      <span className={`shrink-0 text-[11px] font-medium rounded px-1.5 py-0.5 ${COR[h.acao] || "bg-slate-50 text-slate-600"}`}>{h.acao}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-700 break-words">{h.detalhe}</div>
                        <div className={`text-xs ${h.papel === "vendedor" ? "text-violet-700" : "text-slate-400"}`}>{h.quem}{h.papel === "vendedor" ? " (vendedor)" : ""}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {lista.length > limite && (
          <div className="px-5 py-3 border-t border-slate-100">
            <button onClick={() => setLimite((l) => l + 200)} className="text-sm text-emerald-700 hover:underline">Mostrar mais</button>
          </div>
        )}
      </TableShell>
    </>
  );
}
