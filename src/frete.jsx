import React, { useState } from "react";
import { Plus, Trash2, Pencil, MessageCircle, Copy, Check, Truck, FileText, Send, PackageCheck, Clock } from "lucide-react";
import { useApp, TABELAS, PAGAMENTOS, CAIXA_META, precoDe, produtoCombina, ehDeFornecedor, precoFoiAlterado } from "./contexto.js";
import { ProdutoAvulso, CampoVendedor } from "./modais.jsx";
import { fmtUSD, fmtDate, todayISO, isoLocal, parseISO, normalizar, uid } from "./lib/format.js";
import { linkWhatsApp } from "./lib/whatsapp.js";
import {
  Modal, Field, inputCls, btnPrimario, btnSecundario, btnContorno, btnIcone, btnIconePerigo, TableShell, Th, Td, Vazio, Segmentado, Badge, Cartao,
} from "./ui.jsx";

const dias = (d) => (Number(d) === 1 ? "1 dia" : `${Number(d) || 0} dias`);

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const linhaCls = "border-b border-slate-50 hover:bg-slate-50/60";
const somarDias = (iso, dias) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + Number(dias || 0));
  return isoLocal(d);
};

// ---------------- mensagens ----------------

function listaItens(itens) {
  return itens.map((l) => `• ${l.itemNome} × ${l.qtd}`).join("\n");
}

export function mensagemFreteiro(o, f) {
  return [
    `Olá, ${f.nome}! Tudo bem? Aqui é da Indufarma. Preciso de uma cotação de frete:`,
    "",
    `*Pedido (orçamento #${o.numero})*`,
    listaItens(o.itens),
    "",
    `*Entrega:* ${[o.frete.endereco, o.frete.cidade].filter(Boolean).join(" - ")}`,
    o.clienteNome ? `*Cliente:* ${o.clienteNome}` : null,
    o.frete.obsEntrega ? `*Observação:* ${o.frete.obsEntrega}` : null,
    "",
    "Pode me passar o valor do frete e em quantos dias chega ao cliente? Obrigado!",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function mensagemCliente(o, comNomes = false) {
  const linhas = [
    `Olá, ${o.clienteNome || "tudo bem"}! Segue o seu orçamento #${o.numero} da Indufarma:`,
    "",
    ...o.itens.map((l) => `• ${l.itemNome} × ${l.qtd}: ${fmtUSD(l.subtotal)}`),
    "",
    `*Total dos produtos: ${fmtUSD(o.total)}*`,
  ];
  const respondidas = (o.frete?.precisa ? o.frete.cotacoes || [] : []).filter((c) => c.status === "Respondido");
  if (respondidas.length) {
    linhas.push("", "*Opções de frete:*");
    respondidas
      .slice()
      .sort((a, b) => n(a.valor) - n(b.valor))
      .forEach((c, i) => {
        const prazo = dias(c.prazoDias);
        linhas.push(`${i + 1}) ${comNomes ? c.nome + ": " : ""}frete ${fmtUSD(c.valor)}, chega em ${prazo} · total ${fmtUSD(n(o.total) + n(c.valor))}`);
      });
    linhas.push("", "Qual opção você prefere?");
  }
  linhas.push("", "Valores em dólar.");
  return linhas.join("\n");
}

function BotaoCopiar({ texto, rotulo = "Copiar" }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch (e) {
          window.prompt("Copie o texto:", texto);
        }
      }}
      className={btnSecundario}
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? "Copiado" : rotulo}
    </button>
  );
}

function statusFrete(o) {
  if (!o.frete?.precisa) return { texto: "Sem frete", cor: "text-slate-400" };
  const cs = o.frete.cotacoes || [];
  const resp = cs.filter((c) => c.status === "Respondido").length;
  if (o.frete.escolhida) {
    const c = cs.find((x) => x.freteiroId === o.frete.escolhida);
    return { texto: `Escolhido: ${c?.nome || "—"}`, cor: "text-emerald-700" };
  }
  if (cs.length === 0) return { texto: "Nenhum freteiro", cor: "text-amber-700" };
  if (resp === 0) return { texto: `Aguardando ${cs.length} freteiro(s)`, cor: "text-amber-700" };
  return { texto: `${resp} de ${cs.length} responderam`, cor: "text-sky-700" };
}

// ---------------- páginas ----------------

export function OrcamentosPage() {
  const { orcamentos, abrirModal } = useApp();
  const [filtro, setFiltro] = useState("Aberto");
  const lista = orcamentos.filter((o) => filtro === "todos" || o.status === filtro);
  return (
    <TableShell
      title="Orçamentos"
      sub={`${orcamentos.filter((o) => o.status === "Aberto").length} em aberto`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <Segmentado
            valor={filtro}
            onChange={setFiltro}
            opcoes={[{ valor: "Aberto", label: "Abertos" }, { valor: "Aprovado", label: "Viraram venda" }, { valor: "Cancelado", label: "Cancelados" }, { valor: "todos", label: "Todos" }]}
          />
          <button onClick={() => abrirModal("orcamento")} className={btnPrimario}><Plus size={14} /> Novo orçamento</button>
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Orçamento</Th><Th>Cliente</Th><Th>Itens</Th><Th right>Produtos</Th><Th>Frete</Th><Th>Status</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {lista.map((o) => {
            const sf = statusFrete(o);
            return (
              <tr key={o.id} className={linhaCls + " cursor-pointer"} onClick={() => abrirModal("orcamentoDetalhe", { id: o.id })}>
                <Td>
                  <div className="font-medium text-slate-900">#{o.numero}</div>
                  <div className="text-xs text-slate-400">{fmtDate(o.data)}</div>
                </Td>
                <Td className="text-slate-700">
                  {o.clienteNome}
                  {o.vendedorNome && <div className="text-xs text-slate-400">{o.vendedorNome}</div>}
                </Td>
                <Td className="text-slate-600">{o.itens.length === 1 ? `${o.itens[0].itemNome} × ${o.itens[0].qtd}` : `${o.itens.length} produtos`}</Td>
                <Td right className="font-medium text-slate-900 whitespace-nowrap">{fmtUSD(o.total)}</Td>
                <Td className={sf.cor}>{sf.texto}</Td>
                <Td>
                  <Badge status={o.status === "Aberto" ? "Pendente" : o.status === "Aprovado" ? "Pago" : o.status} />
                  {o.status === "Aberto" && o.aprovacaoPreco === "Pendente" && <div className="text-xs font-medium text-amber-700 mt-1">Preço para aprovar</div>}
                  {o.status === "Aprovado" && o.vendaNumero && <div className="text-xs text-slate-400 mt-1">Venda #{o.vendaNumero}</div>}
                </Td>
                <Td right>
                  <button onClick={(e) => { e.stopPropagation(); abrirModal("orcamentoDetalhe", { id: o.id }); }} className={btnContorno}>Abrir</button>
                </Td>
              </tr>
            );
          })}
          {lista.length === 0 && <Vazio colSpan={7}>Nenhum orçamento aqui.</Vazio>}
        </tbody>
      </table>
    </TableShell>
  );
}

export function FretePage() {
  const { vendas, orcamentos, freteiros, clientes, abrirModal, atualizarEntrega, excluirFreteiro, ehVendedor } = useApp();
  const [aba, setAba] = useState("entregas");
  const [filtro, setFiltro] = useState("ativos");
  const hoje = todayISO();
  const entregas = vendas.filter((v) => v.frete && (filtro === "todos" || v.frete.status !== "Entregue"));
  const cotacoes = orcamentos.filter((o) => o.status === "Aberto" && o.frete?.precisa);
  const aEnviar = vendas.filter((v) => v.frete?.status === "A enviar").length;
  const emTransito = vendas.filter((v) => v.frete?.status === "Enviado").length;
  const aPagarFreteiros = vendas.filter((v) => v.frete && !v.frete.pagoFreteiroEm).reduce((s, v) => s + n(v.frete.valor), 0);

  return (
    <>
      <div className="mb-4">
        <Segmentado
          valor={aba}
          onChange={setAba}
          opcoes={[
            { valor: "entregas", label: `Entregas (${aEnviar + emTransito})` },
            { valor: "transito", label: `Em trânsito (${emTransito})` },
            ...(ehVendedor ? [] : [{ valor: "pagar", label: `Pagar freteiros (${fmtUSD(aPagarFreteiros)})` }]),
            { valor: "cotacoes", label: `Cotações (${cotacoes.length})` },
            { valor: "freteiros", label: `Freteiros (${freteiros.length})` },
          ]}
        />
      </div>

      {aba === "entregas" && (
        <TableShell
          title="Entregas"
          sub={`${aEnviar} a enviar · ${emTransito} a caminho`}
          action={<Segmentado valor={filtro} onChange={setFiltro} opcoes={[{ valor: "ativos", label: "Em andamento" }, { valor: "todos", label: "Todas" }]} />}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <Th>Venda</Th><Th>Cliente e destino</Th><Th>Freteiro</Th><Th right>Frete</Th><Th>Previsão</Th><Th>Status</Th><Th right>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {entregas.map((v) => {
                const f = v.frete;
                const cliente = clientes.find((c) => c.id === v.clienteId);
                const previsao = f.enviadoEm ? somarDias(f.enviadoEm, f.prazoDias) : null;
                const atrasada = f.status === "Enviado" && previsao && previsao < hoje;
                const msgEnvio = `Olá, ${v.clienteNome}! Seu pedido #${v.numero} da Indufarma foi enviado com ${f.freteiroNome}. A previsão de chegada é ${fmtDate(somarDias(todayISO(), f.prazoDias))}. Obrigado pela compra!`;
                return (
                  <tr key={v.id} className={linhaCls}>
                    <Td>
                      <div className="font-medium text-slate-900">#{v.numero}</div>
                      <div className="text-xs text-slate-400">{fmtDate(v.data)}</div>
                    </Td>
                    <Td className="text-slate-700">
                      {v.clienteNome}
                      <div className="text-xs text-slate-400">{[f.endereco, f.cidade].filter(Boolean).join(" - ") || "Endereço não informado"}</div>
                    </Td>
                    <Td className="text-slate-600">{f.freteiroNome}<div className="text-xs text-slate-400">{dias(f.prazoDias)}</div></Td>
                    <Td right className="text-slate-700 whitespace-nowrap">{fmtUSD(f.valor)}</Td>
                    <Td className={atrasada ? "text-red-600 font-medium" : "text-slate-600"}>
                      {previsao ? fmtDate(previsao) : "—"}
                      {f.entregueEm && <div className="text-xs text-slate-400">Entregue em {fmtDate(f.entregueEm)}</div>}
                      {atrasada && <div className="text-xs">Atrasada</div>}
                    </Td>
                    <Td><StatusEntrega status={f.status} /></Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-1.5">
                        {f.status === "A enviar" && (
                          <>
                            {cliente?.contato && (
                              <a
                                href={linkWhatsApp(cliente.contato, msgEnvio) || "#"}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => atualizarEntrega(v.id, { status: "Enviado", enviadoEm: todayISO() })}
                                className={btnContorno}
                                title="Marca como enviado e avisa o cliente"
                              >
                                <MessageCircle size={13} /> Enviado e avisar
                              </a>
                            )}
                            <button onClick={() => atualizarEntrega(v.id, { status: "Enviado", enviadoEm: todayISO() })} className={btnContorno}>
                              <Send size={13} /> Enviado
                            </button>
                          </>
                        )}
                        {f.status === "Enviado" && (
                          <button onClick={() => atualizarEntrega(v.id, { status: "Entregue", entregueEm: todayISO() })} className={btnContorno}>
                            <PackageCheck size={13} /> Entregue
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {entregas.length === 0 && <Vazio colSpan={7}>Nenhuma entrega em andamento. Vendas com frete aparecem aqui.</Vazio>}
            </tbody>
          </table>
        </TableShell>
      )}

      {aba === "cotacoes" && (
        <TableShell title="Cotações de frete em andamento" sub="Orçamentos abertos que precisam de frete" action={<button onClick={() => abrirModal("orcamento")} className={btnPrimario}><Plus size={14} /> Novo orçamento</button>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <Th>Orçamento</Th><Th>Cliente e destino</Th><Th>Respostas</Th><Th>Menor frete</Th><Th right>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {cotacoes.map((o) => {
                const cs = o.frete.cotacoes || [];
                const resp = cs.filter((c) => c.status === "Respondido");
                const menor = resp.slice().sort((a, b) => n(a.valor) - n(b.valor))[0];
                return (
                  <tr key={o.id} className={linhaCls}>
                    <Td><div className="font-medium text-slate-900">#{o.numero}</div><div className="text-xs text-slate-400">{fmtDate(o.data)}</div></Td>
                    <Td className="text-slate-700">{o.clienteNome}<div className="text-xs text-slate-400">{[o.frete.endereco, o.frete.cidade].filter(Boolean).join(" - ")}</div></Td>
                    <Td className={statusFrete(o).cor}>{statusFrete(o).texto}</Td>
                    <Td className="text-slate-700">{menor ? `${fmtUSD(menor.valor)} · ${dias(menor.prazoDias)}` : "—"}</Td>
                    <Td right><button onClick={() => abrirModal("orcamentoDetalhe", { id: o.id })} className={btnContorno}>Abrir</button></Td>
                  </tr>
                );
              })}
              {cotacoes.length === 0 && <Vazio colSpan={5}>Nenhuma cotação em andamento.</Vazio>}
            </tbody>
          </table>
        </TableShell>
      )}

      {aba === "transito" && <EmTransito />}
      {aba === "pagar" && !ehVendedor && <PagarFreteiros />}

      {aba === "freteiros" && (
        <TableShell title="Freteiros" sub="Quem recebe os pedidos de cotação" action={!ehVendedor && <button onClick={() => abrirModal("freteiro")} className={btnPrimario}><Plus size={14} /> Novo freteiro</button>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <Th>Nome</Th><Th>WhatsApp</Th><Th>Regiões / observação</Th><Th right>Entregas feitas</Th><Th right>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {freteiros.map((f) => (
                <tr key={f.id} className={linhaCls}>
                  <Td className="font-medium text-slate-900">{f.nome}</Td>
                  <Td className="text-slate-600">{f.contato || "—"}</Td>
                  <Td className="text-slate-500">{f.obs || "—"}</Td>
                  <Td right className="text-slate-600">{vendas.filter((v) => v.frete?.freteiroId === f.id).length}</Td>
                  <Td right>
                    {!ehVendedor && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirModal("freteiro", f)} className={btnIcone} title="Editar"><Pencil size={15} /></button>
                        <button onClick={() => excluirFreteiro(f)} className={btnIconePerigo} title="Excluir"><Trash2 size={15} /></button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
              {freteiros.length === 0 && <Vazio colSpan={5}>Nenhum freteiro cadastrado ainda.</Vazio>}
            </tbody>
          </table>
        </TableShell>
      )}
    </>
  );
}

// Produtos que já saíram com o freteiro e ainda não foram entregues, separados por freteiro,
// com o botão para cobrar a situação da entrega pelo WhatsApp.
function mensagemCobranca(nomeFreteiro, entregas) {
  const linhas = entregas.map(({ v, previsao }) => {
    const destino = [v.clienteNome, v.frete.cidade].filter(Boolean).join(", ");
    return `• Pedido #${v.numero} para ${destino}: enviado em ${fmtDate(v.frete.enviadoEm)}${previsao ? `, previsão ${fmtDate(previsao)}` : ""}\n  ${(v.itens || []).map((l) => `${l.itemNome} × ${l.qtd}`).join(", ")}`;
  });
  return [
    `Olá, ${nomeFreteiro}! Aqui é da Indufarma. Pode me passar a situação ${entregas.length === 1 ? "desta entrega" : "destas entregas"}?`,
    "",
    ...linhas,
    "",
    "Se já entregou, me avise por favor. Obrigado!",
  ].join("\n");
}

function EmTransito() {
  const { vendas, freteiros, atualizarEntrega } = useApp();
  const hoje = todayISO();
  const grupos = new Map();
  for (const v of vendas) {
    if (v.frete?.status !== "Enviado") continue;
    const previsao = v.frete.enviadoEm ? somarDias(v.frete.enviadoEm, v.frete.prazoDias) : null;
    const atraso = previsao && previsao < hoje ? Math.round((parseISO(hoje) - parseISO(previsao)) / 86400000) : 0;
    const chave = v.frete.freteiroId || v.frete.freteiroNome || "?";
    const g = grupos.get(chave) || { chave, nome: v.frete.freteiroNome || "Freteiro", contato: freteiros.find((f) => f.id === v.frete.freteiroId)?.contato, itens: [] };
    g.itens.push({ v, previsao, atraso });
    grupos.set(chave, g);
  }
  const lista = [...grupos.values()]
    .map((g) => ({ ...g, itens: g.itens.sort((a, b) => b.atraso - a.atraso || String(a.previsao).localeCompare(String(b.previsao))), atrasadas: g.itens.filter((x) => x.atraso > 0).length }))
    .sort((a, b) => b.atrasadas - a.atrasadas || a.nome.localeCompare(b.nome));

  if (lista.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-10 text-center text-sm text-slate-400">
        Nenhum produto em trânsito. Quando marcar uma entrega como enviada, ela aparece aqui até ser entregue.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {lista.map((g) => {
        const linkTodas = linkWhatsApp(g.contato, mensagemCobranca(g.nome, g.itens));
        return (
          <div key={g.chave} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-4 border-b border-slate-100">
              <div>
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Truck size={15} className="text-slate-400" /> {g.nome}</div>
                <div className="text-xs text-slate-400">
                  {g.itens.length} {g.itens.length === 1 ? "entrega a caminho" : "entregas a caminho"}
                  {g.atrasadas > 0 && <span className="text-red-600 font-medium"> · {g.atrasadas} {g.atrasadas === 1 ? "atrasada" : "atrasadas"}</span>}
                </div>
              </div>
              {linkTodas ? (
                <a
                  href={linkTodas}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => g.itens.forEach(({ v }) => atualizarEntrega(v.id, { cobradoEm: hoje }))}
                  className={btnContorno}
                >
                  <MessageCircle size={13} /> {g.itens.length === 1 ? "Cobrar freteiro" : "Cobrar todas"}
                </a>
              ) : (
                <span className="text-xs text-amber-700">Freteiro sem WhatsApp</span>
              )}
            </div>
            <ul className="divide-y divide-slate-100">
              {g.itens.map(({ v, previsao, atraso }) => {
                const link = linkWhatsApp(g.contato, mensagemCobranca(g.nome, [{ v, previsao }]));
                return (
                  <li key={v.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          #{v.numero} · {v.clienteNome}
                          {v.frete.cidade && <span className="font-normal text-slate-400"> · {v.frete.cidade}</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{(v.itens || []).map((l) => `${l.itemNome} × ${l.qtd}`).join(", ")}</div>
                        <div className={`text-xs mt-1 ${atraso > 0 ? "text-red-600 font-medium" : "text-slate-400"}`}>
                          Enviado em {fmtDate(v.frete.enviadoEm)}
                          {previsao && ` · previsão ${fmtDate(previsao)}`}
                          {atraso > 0 && ` · ${atraso === 1 ? "1 dia" : `${atraso} dias`} de atraso`}
                          {v.frete.cobradoEm && <span className="text-slate-400 font-normal"> · cobrado em {fmtDate(v.frete.cobradoEm)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {link && g.itens.length > 1 && (
                          <a href={link} target="_blank" rel="noreferrer" onClick={() => atualizarEntrega(v.id, { cobradoEm: hoje })} className={btnContorno} title="Cobrar só esta entrega">
                            <MessageCircle size={13} /> Cobrar
                          </a>
                        )}
                        <button onClick={() => atualizarEntrega(v.id, { status: "Entregue", entregueEm: hoje })} className={btnContorno}>
                          <PackageCheck size={13} /> Entregue
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Fretes que o cliente paga à farmácia e a farmácia repassa ao freteiro.
function PagarFreteiros() {
  const { vendas, pagarFreteiro } = useApp();
  const [verPagos, setVerPagos] = useState(false);
  const comFrete = vendas.filter((v) => v.frete && n(v.frete.valor) > 0);
  const pendentes = comFrete.filter((v) => !v.frete.pagoFreteiroEm);
  const grupos = new Map();
  for (const v of pendentes) {
    const chave = v.frete.freteiroId || v.frete.freteiroNome || "?";
    const g = grupos.get(chave) || { chave, nome: v.frete.freteiroNome || "Freteiro", vendas: [] };
    g.vendas.push(v);
    grupos.set(chave, g);
  }
  const pagos = comFrete.filter((v) => v.frete.pagoFreteiroEm).sort((a, b) => b.frete.pagoFreteiroEm.localeCompare(a.frete.pagoFreteiroEm));

  return (
    <div className="space-y-4">
      {grupos.size === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-10 text-center text-sm text-slate-400">
          Nenhum frete para pagar. Os fretes das vendas aparecem aqui até você registrar o pagamento ao freteiro.
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[...grupos.values()].map((g) => <GrupoPagarFreteiro key={g.chave} g={g} pagar={pagarFreteiro} />)}
      </div>
      {pagos.length > 0 && (
        <div>
          <button onClick={() => setVerPagos((x) => !x)} className="text-xs font-medium text-emerald-700 hover:underline">
            {verPagos ? "Esconder" : "Ver"} fretes já pagos ({pagos.length})
          </button>
          {verPagos && (
            <div className="mt-3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50"><Th>Venda</Th><Th>Freteiro</Th><Th right>Frete</Th><Th>Pago em</Th></tr>
                </thead>
                <tbody>
                  {pagos.map((v) => (
                    <tr key={v.id} className={linhaCls}>
                      <Td><span className="font-medium text-slate-900">#{v.numero}</span> <span className="text-slate-500">· {v.clienteNome}</span></Td>
                      <Td className="text-slate-600">{v.frete.freteiroNome}</Td>
                      <Td right className="text-slate-700 whitespace-nowrap">{fmtUSD(v.frete.valor)}</Td>
                      <Td className="text-slate-600">{fmtDate(v.frete.pagoFreteiroEm)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrupoPagarFreteiro({ g, pagar }) {
  const [marcados, setMarcados] = useState(() => new Set(g.vendas.map((v) => v.id)));
  const [caixa, setCaixa] = useState("dolar");
  const [confirmando, setConfirmando] = useState(false);
  const selecionadas = g.vendas.filter((v) => marcados.has(v.id));
  const total = selecionadas.reduce((s, v) => s + n(v.frete.valor), 0);
  const totalDevido = g.vendas.reduce((s, v) => s + n(v.frete.valor), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
        <div>
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Truck size={15} className="text-slate-400" /> {g.nome}</div>
          <div className="text-xs text-slate-400">{g.vendas.length} {g.vendas.length === 1 ? "frete" : "fretes"} a pagar</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400">Você deve</div>
          <div className="text-lg font-semibold text-slate-900">{fmtUSD(totalDevido)}</div>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {g.vendas.map((v) => (
          <li key={v.id} className="px-5 py-2.5 text-sm">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={marcados.has(v.id)}
                  onChange={() => setMarcados((m) => { const x = new Set(m); x.has(v.id) ? x.delete(v.id) : x.add(v.id); return x; })}
                  className="rounded border-slate-300 text-emerald-700"
                />
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">#{v.numero}</span> <span className="text-slate-600">· {v.clienteNome}</span>
                  <span className="block text-xs text-slate-400">
                    {v.frete.status === "Entregue" ? "Entregue" : v.frete.status === "Enviado" ? "A caminho" : "Ainda não enviado"}
                    {" · "}
                    {v.status === "Pago" ? <span className="text-emerald-700">cliente já pagou</span> : <span className="text-amber-700">cliente ainda não pagou</span>}
                  </span>
                </span>
              </span>
              <span className="font-medium text-slate-900 shrink-0">{fmtUSD(v.frete.valor)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2 flex-wrap px-5 py-3 bg-slate-50 border-t border-slate-100">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Pagar com</label>
          <select value={caixa} onChange={(e) => setCaixa(e.target.value)} className={inputCls + " py-1.5 w-40"} aria-label="Pagar com">
            {Object.keys(CAIXA_META).map((k) => <option key={k} value={k}>{CAIXA_META[k].label}</option>)}
          </select>
        </div>
        {confirmando ? (
          <>
            <button onClick={() => { pagar(selecionadas.map((v) => v.id), caixa, g.nome); setConfirmando(false); }} className={btnPrimario + " flex-1"}>
              <Check size={14} /> Confirmar: sai {fmtUSD(total)} do {CAIXA_META[caixa].label}
            </button>
            <button onClick={() => setConfirmando(false)} className={btnSecundario}>Voltar</button>
          </>
        ) : (
          <button disabled={selecionadas.length === 0} onClick={() => setConfirmando(true)} className={btnPrimario + " flex-1"}>
            <Check size={14} /> Pagar {fmtUSD(total)}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusEntrega({ status }) {
  const map = {
    "A enviar": "bg-amber-50 text-amber-700 ring-amber-600/20",
    Enviado: "bg-sky-50 text-sky-700 ring-sky-600/20",
    Entregue: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${map[status] || ""}`}>{status}</span>;
}

// ---------------- modais ----------------

export function FreteiroModal() {
  const { editando, salvarFreteiro, fecharModal } = useApp();
  const [nome, setNome] = useState(editando?.nome || "");
  const [contato, setContato] = useState(editando?.contato || "");
  const [obs, setObs] = useState(editando?.obs || "");
  return (
    <Modal title={editando ? "Editar freteiro" : "Novo freteiro"} onClose={fecharModal}>
      <Field label="Nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
      <Field label="WhatsApp" hint="Com código do país. É para este número que vai o pedido de cotação.">
        <input className={inputCls} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="+595 981 234 567" />
      </Field>
      <Field label="Regiões que atende / observação"><input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Asunción e Central, entrega em 24h" /></Field>
      <button disabled={!nome.trim()} onClick={() => { salvarFreteiro({ nome: nome.trim(), contato: contato.trim(), obs: obs.trim() }, editando); fecharModal(); }} className={btnPrimario + " w-full"}>
        Salvar
      </button>
    </Modal>
  );
}

// Cria ou edita um orçamento. Com frete marcado, os freteiros escolhidos recebem o pedido de cotação.
export function OrcamentoModal() {
  const { editando, orcamentos, clientes, vendedores, estoque, freteiros, salvarOrcamento, abrirModal, fecharModal, ehVendedor } = useApp();
  const original = editando?.id ? orcamentos.find((o) => o.id === editando.id) : null;
  const [clienteId, setClienteId] = useState(original?.clienteId || "");
  const [vendedorId, setVendedorId] = useState(original?.vendedorId || "");
  const [tabela, setTabela] = useState("Varejo");
  const [itemId, setItemId] = useState(estoque[0]?.id || "");
  const [qtd, setQtd] = useState(1);
  const [filtro, setFiltro] = useState("");
  const [modo, setModo] = useState("cadastro");
  const [itens, setItens] = useState(original?.itens || []);
  const [obs, setObs] = useState(original?.obs || "");
  const [precisa, setPrecisa] = useState(original?.frete?.precisa || false);
  const [endereco, setEndereco] = useState(original?.frete?.endereco || "");
  const [cidade, setCidade] = useState(original?.frete?.cidade || "");
  const [obsEntrega, setObsEntrega] = useState(original?.frete?.obsEntrega || "");
  const [escolhidos, setEscolhidos] = useState(() => new Set(original?.frete?.cotacoes ? original.frete.cotacoes.map((c) => c.freteiroId) : freteiros.map((f) => f.id)));

  const cliente = clientes.find((c) => c.id === clienteId);
  const opcoes = estoque.filter((i) => produtoCombina(i, filtro));
  // Ao filtrar, o primeiro produto encontrado já fica escolhido.
  const item = opcoes.find((i) => i.id === itemId) || opcoes[0];
  const precoTabela = precoDe(item, tabela);
  // Preço pode ser mudado. Se quem muda é o vendedor, o orçamento espera a aprovação do dono.
  const [precoManual, setPrecoManual] = useState(null);
  const chavePreco = `${item?.id}|${tabela}`;
  const [chaveAnterior, setChaveAnterior] = useState(chavePreco);
  if (chaveAnterior !== chavePreco) { setChaveAnterior(chavePreco); setPrecoManual(null); }
  const precoUnit = precoManual != null && precoManual !== "" ? n(precoManual) : precoTabela;
  const total = itens.reduce((s, l) => s + l.subtotal, 0);
  const algumAlterado = itens.some(precoFoiAlterado);
  const valido = clienteId && itens.length > 0 && (!precisa || (endereco.trim() && escolhidos.size > 0));

  function escolherCliente(id) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setTabela(c?.tabela || "Varejo");
    if (c && !endereco) setEndereco(c.endereco || "");
    if (c && !cidade) setCidade(c.cidade || "");
  }

  function adicionar() {
    if (!item || !(qtd > 0) || !(precoUnit > 0)) return;
    setItens((l) => [...l, { key: uid(), itemId: item.id, itemNome: item.nome, qtd, tipoVenda: tabela, precoUnit, precoTabela, subtotal: precoUnit * qtd }]);
    setQtd(1);
    setPrecoManual(null);
  }

  function salvar() {
    const anteriores = new Map((original?.frete?.cotacoes || []).map((c) => [c.freteiroId, c]));
    const cotacoes = precisa
      ? freteiros
          .filter((f) => escolhidos.has(f.id))
          .map((f) => anteriores.get(f.id) || { freteiroId: f.id, nome: f.nome, contato: f.contato, status: "Não enviado", valor: null, prazoDias: null })
      : [];
    const id = salvarOrcamento(
      {
        clienteId, clienteNome: cliente?.nome || "Sem nome",
        vendedorId, vendedorNome: vendedores.find((v) => v.id === vendedorId)?.nome || "",
        itens: itens.map(({ key, ...l }) => l), total, obs: obs.trim(),
        frete: { precisa, endereco: endereco.trim(), cidade: cidade.trim(), obsEntrega: obsEntrega.trim(), cotacoes, escolhida: original?.frete?.escolhida || null },
      },
      original
    );
    abrirModal("orcamentoDetalhe", { id });
  }

  return (
    <Modal title={original ? `Editar orçamento #${original.numero}` : "Novo orçamento"} onClose={fecharModal} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cliente *">
          <select className={inputCls} value={clienteId} onChange={(e) => escolherCliente(e.target.value)}>
            <option value="">Selecione...</option>
            {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <CampoVendedor valor={vendedorId} onChange={setVendedorId} />
      </div>

      <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="text-xs font-semibold text-slate-600">Adicionar produto</div>
          <Segmentado valor={modo} onChange={setModo} opcoes={[{ valor: "cadastro", label: "Do cadastro" }, { valor: "avulso", label: "Não cadastrado" }]} />
        </div>
        {modo === "avulso" ? (
          <ProdutoAvulso
            tabela={tabela}
            rotulo="Adicionar ao orçamento"
            aoAdicionar={(l) => setItens((x) => [...x, { key: uid(), itemId: l.itemId, itemNome: l.nome, qtd: l.qtd, tipoVenda: l.tipoVenda, precoUnit: l.precoUnit, subtotal: l.precoUnit * l.qtd, ...(l.avulso ? { avulso: true, custoVendedor: l.custoVendedor } : {}) }])}
          />
        ) : (
        <>
        <Field label="Produto">
          <input className={inputCls + " mb-2"} placeholder="Filtrar produtos..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <select className={inputCls} value={item?.id || ""} onChange={(e) => setItemId(e.target.value)}>
            {!item && <option value="">Nenhum produto encontrado</option>}
            {opcoes.map((i) => <option key={i.id} value={i.id}>{i.nome}{i.marca ? ` · ${i.marca}` : ""} ({ehDeFornecedor(i) ? "sob encomenda" : `${i.qtd} em estoque`})</option>)}
          </select>
        </Field>
        <Field label="Tabela de preço"><Segmentado valor={tabela} onChange={setTabela} opcoes={TABELAS} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade"><input type="number" min="1" step="1" className={inputCls} value={qtd} onChange={(e) => setQtd(Math.floor(n(e.target.value)))} /></Field>
          <Field
            label="Valor unitário (US$)"
            hint={item && Math.abs(precoUnit - precoTabela) > 0.004 ? `Tabela: ${fmtUSD(precoTabela)}${ehVendedor ? " · vai para aprovação do dono" : ""}` : "Pode mudar o preço."}
          >
            <input type="number" step="0.01" min="0" className={inputCls} value={precoManual ?? (item ? precoTabela : "")} onChange={(e) => setPrecoManual(e.target.value)} />
          </Field>
        </div>
        {item && !ehDeFornecedor(item) && qtd > item.qtd && <div className="text-xs text-amber-700 -mt-2 mb-3">Atenção: só há {item.qtd} em estoque.</div>}
        <button type="button" onClick={adicionar} disabled={!item || !(qtd > 0)} className={btnSecundario + " w-full border-emerald-700/40 text-emerald-800"}>
          <Plus size={14} /> Adicionar ao orçamento
        </button>
        </>
        )}
      </div>

      {itens.length > 0 && (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
          {itens.map((l, idx) => (
            <div key={l.key || idx} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-slate-900">{l.itemNome} × {l.qtd}</div>
                <div className="text-xs text-slate-400">
                  {l.avulso ? "Não cadastrado" : l.tipoVenda} · {fmtUSD(l.precoUnit)} un.
                  {precoFoiAlterado(l) && <span className="text-amber-700"> · tabela {fmtUSD(l.precoTabela)}</span>}
                </div>
                {l.itemId && !ehDeFornecedor(estoque.find((i) => i.id === l.itemId)) && (estoque.find((i) => i.id === l.itemId)?.qtd ?? 0) < l.qtd && (
                  <div className="text-xs text-amber-700">Só {estoque.find((i) => i.id === l.itemId)?.qtd ?? 0} em estoque agora</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{fmtUSD(l.subtotal)}</span>
                <button onClick={() => setItens((x) => x.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-sm bg-slate-50">
            <span className="text-slate-500">Total dos produtos</span>
            <span className="font-semibold text-slate-900">{fmtUSD(total)}</span>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-3">
        <input type="checkbox" checked={precisa} onChange={(e) => setPrecisa(e.target.checked)} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        <Truck size={15} className="text-slate-500" /> Precisa de frete
      </label>
      {precisa && (
        <div className="border border-slate-200 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="Endereço de entrega *"><input className={inputCls} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" /></Field>
            </div>
            <Field label="Cidade"><input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Asunción" /></Field>
          </div>
          <Field label="Observação para o freteiro"><input className={inputCls} value={obsEntrega} onChange={(e) => setObsEntrega(e.target.value)} placeholder="Ex.: 2 caixas, 8 kg, entregar de manhã" /></Field>
          <div className="text-xs font-medium text-slate-600 mb-2">Pedir cotação para</div>
          {freteiros.length === 0 ? (
            <div className="text-sm text-amber-700">Nenhum freteiro cadastrado. Cadastre em Frete › Freteiros.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {freteiros.map((f) => {
                const on = escolhidos.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setEscolhidos((s) => { const x = new Set(s); on ? x.delete(f.id) : x.add(f.id); return x; })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${on ? "bg-emerald-700 border-emerald-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {on && <Check size={12} className="inline mr-1" />}{f.nome}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Field label="Observação do orçamento"><input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Field>
      {ehVendedor && algumAlterado && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Você mudou o preço de algum produto. O orçamento vai para o dono aprovar antes de enviar ao cliente.
        </div>
      )}
      <button disabled={!valido} onClick={salvar} className={btnPrimario + " w-full"}>
        {original ? "Salvar orçamento" : precisa ? "Salvar e pedir cotações" : "Salvar orçamento"}
      </button>
    </Modal>
  );
}

export function OrcamentoDetalheModal() {
  const { editando, orcamentos, clientes, atualizarOrcamento, excluirOrcamento, converterOrcamento, aprovarPrecoOrcamento, marcarOrcamentoVisto, abrirModal, fecharModal, setPage, ehVendedor } = useApp();
  const o = orcamentos.find((x) => x.id === editando?.id);
  const [pagamento, setPagamento] = useState("PIX");
  const [condicao, setCondicao] = useState("À vista");
  const [erro, setErro] = useState(null);
  const [comNomes, setComNomes] = useState(false);
  // Abrir o orçamento tira ele dos lembretes de quem abriu.
  React.useEffect(() => { if (o) marcarOrcamentoVisto(o); }, [o?.id, o?.vistoPeloDono, o?.respostaVista]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return null;
  const cliente = clientes.find((c) => c.id === o.clienteId);
  const cotacoes = o.frete?.precisa ? o.frete.cotacoes || [] : [];
  const respondidas = cotacoes.filter((c) => c.status === "Respondido");
  const escolhida = cotacoes.find((c) => c.freteiroId === o.frete?.escolhida);
  const aberto = o.status === "Aberto";
  const aguardando = aberto && o.aprovacaoPreco === "Pendente";
  const msgCliente = mensagemCliente(o, comNomes);
  const linkCliente = linkWhatsApp(cliente?.contato, msgCliente);
  const msgGrupo = o.frete?.precisa ? mensagemFreteiro(o, { nome: "pessoal" }) : "";

  function mudarCotacao(freteiroId, mudancas) {
    atualizarOrcamento(o.id, (atual) => ({
      frete: { ...atual.frete, cotacoes: atual.frete.cotacoes.map((c) => (c.freteiroId === freteiroId ? { ...c, ...mudancas } : c)) },
    }));
  }

  function fechar() {
    const e = converterOrcamento(o, { pagamento, condicao });
    if (e) setErro(e);
    else {
      fecharModal();
      setPage(o.frete?.precisa ? "frete" : "vendas");
    }
  }

  return (
    <Modal title={`Orçamento #${o.numero} · ${o.clienteNome}`} onClose={fecharModal} wide>
      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {!aberto && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {o.status === "Aprovado" ? `Este orçamento virou a venda #${o.vendaNumero}.` : "Este orçamento foi cancelado."}
        </div>
      )}

      {aguardando && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <div className="font-medium">{o.vendedorNome || "O vendedor"} mudou o preço. {ehVendedor ? "Aguardando a aprovação do dono." : "Aprovar?"}</div>
          {!ehVendedor && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => aprovarPrecoOrcamento(o.id, true)} className={btnPrimario}><Check size={14} /> Aprovar preço</button>
              <button onClick={() => aprovarPrecoOrcamento(o.id, false)} className={btnSecundario}>Recusar (volta ao preço da tabela)</button>
            </div>
          )}
        </div>
      )}
      {aberto && o.aprovacaoPreco === "Recusado" && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">O dono recusou o preço alterado. O orçamento voltou ao preço da tabela.</div>
      )}
      {aberto && o.aprovacaoPreco === "Aprovado" && o.itens.some(precoFoiAlterado) && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Preço alterado aprovado pelo dono.</div>
      )}

      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-5">
        {o.itens.map((l, idx) => (
          <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-slate-800">
              {l.itemNome} × {l.qtd} <span className="text-xs text-slate-400">({l.tipoVenda} · {fmtUSD(l.precoUnit)} un.)</span>
              {precoFoiAlterado(l) && <span className="text-xs text-amber-700"> · tabela {fmtUSD(l.precoTabela)}</span>}
            </span>
            <span className="font-medium text-slate-900">{fmtUSD(l.subtotal)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 text-sm bg-slate-50">
          <span className="text-slate-500">Total dos produtos</span>
          <span className="font-semibold text-slate-900">{fmtUSD(o.total)}</span>
        </div>
      </div>

      {o.frete?.precisa && (
        <div className="mb-5">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Cotações de frete</div>
              <div className="text-xs text-slate-400">{[o.frete.endereco, o.frete.cidade].filter(Boolean).join(" - ")}</div>
            </div>
            {aberto && <BotaoCopiar texto={msgGrupo} rotulo="Copiar pedido (para grupo)" />}
          </div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {cotacoes.map((c) => (
              <LinhaCotacao key={c.freteiroId} o={o} c={c} aberto={aberto} escolhida={o.frete.escolhida === c.freteiroId} mudar={(m) => mudarCotacao(c.freteiroId, m)}
                escolher={() => atualizarOrcamento(o.id, (atual) => ({ frete: { ...atual.frete, escolhida: c.freteiroId } }))} />
            ))}
            {cotacoes.length === 0 && <div className="px-3 py-4 text-sm text-slate-400 text-center">Nenhum freteiro neste orçamento. Edite o orçamento para escolher.</div>}
          </div>
        </div>
      )}

      {aberto && !aguardando && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-slate-900 mb-1">Enviar ao cliente</div>
          <div className="text-xs text-slate-400 mb-2">
            {o.frete?.precisa
              ? respondidas.length
                ? `Vai com ${respondidas.length} ${respondidas.length === 1 ? "opção" : "opções"} de frete, da mais barata para a mais cara.`
                : "Ainda nenhum freteiro respondeu. A mensagem vai só com os produtos."
              : "Orçamento sem frete."}
          </div>
          <pre className="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto text-slate-700 font-mono">{msgCliente}</pre>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {linkCliente ? (
              <a href={linkCliente} target="_blank" rel="noreferrer" onClick={() => atualizarOrcamento(o.id, { enviadoClienteEm: todayISO() })} className={btnPrimario}>
                <MessageCircle size={14} /> Enviar ao cliente
              </a>
            ) : (
              <span className="text-xs text-amber-700">Cliente sem WhatsApp cadastrado.</span>
            )}
            <BotaoCopiar texto={msgCliente} />
            {respondidas.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={comNomes} onChange={(e) => setComNomes(e.target.checked)} className="rounded border-slate-300 text-emerald-700" />
                Mostrar o nome dos freteiros
              </label>
            )}
            {o.enviadoClienteEm && <span className="text-xs text-slate-400">Enviado em {fmtDate(o.enviadoClienteEm)}</span>}
          </div>
        </div>
      )}

      {aberto && (
        <div className="border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-900 mb-2">Cliente aprovou? Fechar a venda</div>
          {aguardando && <div className="text-xs text-amber-700 mb-2">Só dá para enviar ao cliente e fechar a venda depois que o dono aprovar o preço.</div>}
          {escolhida && (
            <div className="text-xs text-slate-500 mb-2">
              Frete escolhido: {escolhida.nome} · {fmtUSD(escolhida.valor)} · {dias(escolhida.prazoDias)}. Total com frete: <span className="font-semibold text-slate-900">{fmtUSD(n(o.total) + n(escolhida.valor))}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pagamento">
              <select className={inputCls} value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
                {PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Condição">
              <select className={inputCls} value={condicao} onChange={(e) => setCondicao(e.target.value)}>
                <option>À vista</option>
                <option>A prazo</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={fechar} disabled={aguardando} title={aguardando ? "Espera a aprovação do preço" : undefined} className={btnPrimario + " flex-1"}><Check size={15} /> Transformar em venda</button>
            <button onClick={() => abrirModal("orcamento", { id: o.id })} className={btnSecundario}><Pencil size={14} /> Editar</button>
            <button onClick={() => window.confirm("Cancelar este orçamento?") && (atualizarOrcamento(o.id, { status: "Cancelado" }), fecharModal())} className={btnSecundario}>Cancelar</button>
          </div>
        </div>
      )}
      {!aberto && (
        <button onClick={() => excluirOrcamento(o) && fecharModal()} className="w-full border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium">Excluir orçamento</button>
      )}
    </Modal>
  );
}

function LinhaCotacao({ o, c, aberto, escolhida, mudar, escolher }) {
  const [valor, setValor] = useState(c.valor ?? "");
  const [prazo, setPrazo] = useState(c.prazoDias ?? "");
  const link = linkWhatsApp(c.contato, mensagemFreteiro(o, c));
  const respondido = c.status === "Respondido";
  return (
    <div className={`px-3 py-3 text-sm ${escolhida ? "bg-emerald-50/60" : ""}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {respondido && aberto && (
            <input type="radio" checked={escolhida} onChange={escolher} className="text-emerald-700 focus:ring-emerald-600" aria-label={`Escolher ${c.nome}`} />
          )}
          <div className="min-w-0">
            <div className="font-medium text-slate-900">{c.nome}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              {respondido ? (
                <>Respondeu: <span className="font-medium text-slate-700">{fmtUSD(c.valor)}</span> · {dias(c.prazoDias)}{escolhida && <span className="text-emerald-700 font-medium"> · escolhido</span>}</>
              ) : c.status === "Aguardando" ? (
                <><Clock size={11} /> Pedido enviado em {fmtDate(c.enviadoEm)}, aguardando resposta</>
              ) : (
                "Pedido ainda não enviado"
              )}
            </div>
          </div>
        </div>
        {aberto && (
          <div className="flex items-center gap-1.5">
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" onClick={() => !respondido && mudar({ status: "Aguardando", enviadoEm: todayISO() })} className={btnContorno}>
                <MessageCircle size={13} /> {c.status === "Não enviado" ? "Pedir cotação" : "Mandar de novo"}
              </a>
            ) : (
              <span className="text-xs text-amber-700">Sem WhatsApp</span>
            )}
          </div>
        )}
      </div>
      {aberto && (
        <div className="flex items-end gap-2 mt-2 flex-wrap">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Valor do frete (US$)</label>
            <input type="number" min="0" step="0.01" className={inputCls + " w-32 py-1.5"} value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Chega em (dias)</label>
            <input type="number" min="0" step="1" className={inputCls + " w-28 py-1.5"} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <button
            disabled={valor === "" || prazo === ""}
            onClick={() => mudar({ status: "Respondido", valor: n(valor), prazoDias: Math.floor(n(prazo)), respondidoEm: todayISO() })}
            className={btnSecundario + " py-1.5"}
          >
            {respondido ? "Atualizar" : "Salvar resposta"}
          </button>
        </div>
      )}
    </div>
  );
}
