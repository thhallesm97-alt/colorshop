import React, { useEffect, useMemo, useState } from "react";
import * as db from "./lib/db.js";
import { Field, inputCls } from "./ui.jsx";
import {
  Plus, Pencil, Trash2, Check, Copy, DollarSign, Clock, Receipt, Package, Users, TrendingUp, AlertTriangle, MessageCircle,
  ListChecks, ChevronLeft, ChevronRight, Target, Wallet, Undo2, CalendarClock, Search, X, Send, Image as ImageIcon,
} from "lucide-react";
import { useApp, CAIXA_META, DIAS_SEM_PEDIDO, produtoCombina, descricaoProduto, ehDeFornecedor, lucroDaVenda, comissaoDoMes, valorDevolvido, faltaReceber, valorPagoDaVenda, fmtConta } from "./contexto.js";
import { useFoto } from "./lib/fotos.js";
import { ListaCompras, situacaoCompra, restanteConsignado } from "./fornecedores.jsx";
import { SeletorMes } from "./financeiro.jsx";
import { linkWhatsApp } from "./lib/whatsapp.js";
import { fmtUSD, fmtDate, fmtDateLong, fmtNum, todayISO, diasAtras, normalizar, parseISO } from "./lib/format.js";
import {
  Badge, StatCard, TableShell, Th, Td, Vazio, Cartao, Segmentado, btnPrimario, btnSecundario, btnContorno, btnIcone, btnIconePerigo,
} from "./ui.jsx";

const linhaCls = "border-b border-slate-50 hover:bg-slate-50/60";

// Ranking de produtos vendidos desde a data informada (inclusive).
function calcularMaisVendidos(vendas, estoque, desde) {
  const atual = new Map(estoque.map((i) => [i.id, i]));
  const r = new Map();
  for (const v of vendas) {
    if (desde && v.data < desde) continue;
    for (const l of v.itens || []) {
      const chave = atual.has(l.itemId) ? l.itemId : "nome:" + normalizar(l.itemNome);
      const e = r.get(chave) || { chave, nome: atual.get(l.itemId)?.nome || l.itemNome || "—", qtd: 0, total: 0, vendas: 0, estoque: atual.get(l.itemId)?.qtd };
      e.qtd += Number(l.qtd || 0);
      e.total += Number(l.subtotal || 0);
      e.vendas += 1;
      r.set(chave, e);
    }
  }
  return [...r.values()].sort((a, b) => b.qtd - a.qtd || b.total - a.total);
}

// Mensagem de cobrança pelo WhatsApp (mostra o que já foi pago quando houve pagamento parcial).
function textoCobranca(v) {
  const pago = valorPagoDaVenda(v);
  const valor = pago > 0 ? `${fmtUSD(faltaReceber(v))} (já recebemos ${fmtUSD(pago)} de ${fmtUSD(v.valor)})` : fmtUSD(v.valor);
  return `Olá ${v.clienteNome}, tudo bem? Passando para lembrar do pagamento da compra #${v.numero} no Shopping 25, falta ${valor}. Obrigado!`;
}

export function VisaoGeral() {
  const {
    cambio, vendas, vendasHoje, vendasDoDia, aReceber, totalContasPendentes, contasPendentes, valorEstoque, unidadesEstoque,
    clientes, fornecedores, caixas, estoque, estoqueBaixo, vendasACobrar, contasVencendo, abrirModal, setPage,
    clientesSemPedido, registrarContato, ehVendedor, vendedores, orcamentosDoVendedor, respostasDoDono,
  } = useApp();
  // Para o dono: o nome do vendedor que atende cada cliente.
  const nomeVendedor = (id) => (ehVendedor ? null : vendedores.find((v) => v.id === id)?.nome || null);
  const top = useMemo(() => calcularMaisVendidos(vendas, estoque, diasAtras(29)).slice(0, 5), [vendas, estoque]);
  const maxTop = top[0]?.qtd || 1;
  const temLembretes = orcamentosDoVendedor.length > 0 || respostasDoDono.length > 0 || vendasACobrar.length > 0 || contasVencendo.length > 0 || (!ehVendedor && estoqueBaixo.length > 0) || clientesSemPedido.length > 0;
  const hoje = todayISO();

  return (
    <>
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white rounded-xl px-6 py-4 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
          <div>
            <div className="text-sm font-semibold">Câmbio {cambio.modo === "Manual" ? "manual" : cambio.modo}</div>
            <div className="text-xs text-emerald-200">Valores definidos por você</div>
          </div>
        </div>
        <div className="h-8 w-px bg-emerald-700 hidden sm:block" />
        {[
          ["TCR · BRL/USDT", cambio.tcr],
          ["Chaco · compra USD", cambio.chacoCompra],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] uppercase tracking-wide text-emerald-300">{l}</div>
            <div className="text-lg font-semibold">R$ {fmtNum(v)}</div>
          </div>
        ))}
        {!ehVendedor && (
          <button onClick={() => abrirModal("cambio")} className="ml-auto bg-white/10 hover:bg-white/20 text-xs font-medium px-3 py-1.5 rounded-md">
            Ajustar
          </button>
        )}
      </div>

      {temLembretes && (
        <div className="border border-amber-200 bg-amber-50/70 rounded-xl p-5 mb-6">
          <div className="text-sm font-semibold text-amber-900">Lembretes de hoje</div>
          <div className="text-xs text-amber-700 mb-4 first-letter:uppercase">{fmtDateLong()}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-5">
            <Lembretes titulo={`A receber (${vendasACobrar.length})`} vazio="Ninguém a cobrar no momento.">
              {vendasACobrar.slice(0, 6).map((v) => {
                const cliente = clientes.find((c) => c.id === v.clienteId);
                return (
                  <li key={v.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{v.clienteNome}</div>
                      <div className="text-xs text-slate-400">Venda #{v.numero} · {fmtDate(v.data)}{nomeVendedor(v.vendedorId) ? ` · ${nomeVendedor(v.vendedorId)}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium text-slate-900" title={valorPagoDaVenda(v) > 0 ? `Já pagou ${fmtUSD(valorPagoDaVenda(v))} de ${fmtUSD(v.valor)}` : undefined}>{fmtUSD(faltaReceber(v))}</span>
                      <LinkWhatsApp contato={cliente?.contato} texto={textoCobranca(v)} />
                      {!ehVendedor && <button onClick={() => abrirModal("receberVenda", v)} className={btnContorno}>Receber</button>}
                    </div>
                  </li>
                );
              })}
            </Lembretes>
            {orcamentosDoVendedor.length > 0 && (
              <Lembretes titulo={`Orçamentos dos vendedores (${orcamentosDoVendedor.length})`} vazio="">
                {orcamentosDoVendedor.slice(0, 6).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{o.clienteNome}</div>
                      <div className="text-xs text-slate-400">#{o.numero} · {o.vendedorNome || "Vendedor"} · {fmtUSD(o.total)}</div>
                      <div className={`text-xs ${o.aprovacaoPreco === "Pendente" ? "text-amber-700 font-medium" : "text-sky-700"}`}>{o.aprovacaoPreco === "Pendente" ? "Pede aprovação de preço" : "Orçamento novo"}</div>
                    </div>
                    <button onClick={() => abrirModal("orcamentoDetalhe", { id: o.id })} className={btnContorno}>{o.aprovacaoPreco === "Pendente" ? "Aprovar" : "Ver"}</button>
                  </li>
                ))}
              </Lembretes>
            )}
            {respostasDoDono.length > 0 && (
              <Lembretes titulo={`Respostas do dono (${respostasDoDono.length})`} vazio="">
                {respostasDoDono.slice(0, 6).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{o.clienteNome}</div>
                      <div className="text-xs text-slate-400">Orçamento #{o.numero} · {fmtUSD(o.total)}</div>
                      <div className={`text-xs font-medium ${o.aprovacaoPreco === "Aprovado" ? "text-emerald-700" : "text-red-600"}`}>
                        {o.aprovacaoPreco === "Aprovado" ? "Preço aprovado: pode enviar ao cliente" : "Preço recusado: voltou ao preço da tabela"}
                      </div>
                    </div>
                    <button onClick={() => abrirModal("orcamentoDetalhe", { id: o.id })} className={btnContorno}>Abrir</button>
                  </li>
                ))}
              </Lembretes>
            )}
            {!ehVendedor && (
            <>
            <Lembretes titulo={`A pagar (${contasVencendo.length})`} vazio="Nenhuma conta vencendo hoje.">
              {contasVencendo.slice(0, 6).map((c) => {
                const atrasada = c.vencimento < hoje;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{c.nome}</div>
                      <div className={`text-xs ${atrasada ? "text-red-600" : "text-slate-400"}`}>{atrasada ? `Atrasada desde ${fmtDate(c.vencimento)}` : "Vence hoje"}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium text-slate-900">{fmtConta(c)}</span>
                      <button onClick={() => abrirModal("pagarConta", c)} className={btnContorno}>Pagar</button>
                    </div>
                  </li>
                );
              })}
            </Lembretes>
            <Lembretes titulo={`Repor estoque (${estoqueBaixo.length})`} vazio="Nenhum produto no mínimo.">
              {estoqueBaixo.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{i.nome}</div>
                    <div className="text-xs text-slate-400">Mínimo: {i.min} un.</div>
                  </div>
                  <span className={`font-semibold shrink-0 ${i.qtd <= 0 ? "text-red-600" : "text-amber-700"}`}>{i.qtd <= 0 ? "Esgotado" : `${i.qtd} un.`}</span>
                </li>
              ))}
              {estoqueBaixo.length > 6 && (
                <button onClick={() => setPage("estoque")} className="text-xs font-medium text-amber-800 hover:underline">Ver todos</button>
              )}
            </Lembretes>
            </>
            )}
            <Lembretes titulo={`Clientes para contatar (${clientesSemPedido.length})`} vazio="Nenhum cliente para contatar hoje.">
              {clientesSemPedido.slice(0, 6).map((c) => (
                <LinhaSemPedido key={c.id} c={c} vendedor={nomeVendedor(c.vendedorId)} mostrarVendedor={!ehVendedor} registrarContato={registrarContato} abrirModal={abrirModal} />
              ))}
              {clientesSemPedido.length > 6 && (
                <button onClick={() => setPage("clientes")} className="text-xs font-medium text-amber-800 hover:underline">Ver todos</button>
              )}
            </Lembretes>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${ehVendedor ? "xl:grid-cols-3" : "xl:grid-cols-5"} gap-4 mb-6`}>
        <StatCard label="Vendas hoje" value={fmtUSD(vendasHoje)} sub={`${vendasDoDia.length} ${vendasDoDia.length === 1 ? "venda" : "vendas"}`} icon={DollarSign} />
        <StatCard label="A receber" value={fmtUSD(aReceber)} sub={`${vendasACobrar.length} ${vendasACobrar.length === 1 ? "venda" : "vendas"} a prazo`} icon={Clock} tom="amber" />
        {!ehVendedor && <StatCard label="Contas a pagar" value={fmtUSD(totalContasPendentes)} sub={`${contasPendentes.length} pendentes`} icon={Receipt} tom="violet" />}
        {!ehVendedor && <StatCard label="Valor em estoque" value={fmtUSD(valorEstoque)} sub={`${unidadesEstoque} unidades · preço de custo`} icon={Package} tom="sky" />}
        <StatCard label="Clientes" value={clientes.length} sub={ehVendedor ? "seus clientes" : `${fornecedores.length} fornecedores`} icon={Users} tom="slate" />
      </div>

      {!ehVendedor && (
      <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Caixas e saldos</div>
          <div className="text-xs text-slate-400">Valores registrados nos lançamentos</div>
        </div>
        <button onClick={() => abrirModal("movimento")} className={btnSecundario}>
          <Plus size={14} /> Movimento
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Object.keys(CAIXA_META).map((k) => (
          <CartaoCaixa key={k} k={k} valor={caixas[k]} equivale={k === "pix" || k === "real" ? caixas[k] / (cambio.chacoCompra || 1) : caixas[k]} />
        ))}
      </div>
      </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Vendas recentes</div>
              <div className="text-xs text-slate-400">Últimos lançamentos</div>
            </div>
            <button onClick={() => setPage("vendas")} className="text-xs font-medium text-emerald-700 hover:underline">Ver todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/50">
                  <Th>Venda</Th><Th>Cliente</Th><Th>Itens</Th><Th right>Valor</Th><Th>Pagamento</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {vendas.slice(0, 6).map((v) => (
                  <tr key={v.id} className={linhaCls}>
                    <Td>
                      <div className="font-medium text-slate-900">#{v.numero}</div>
                      <div className="text-xs text-slate-400">{fmtDate(v.data)}</div>
                    </Td>
                    <Td className="text-slate-600">{v.clienteNome}</Td>
                    <Td className="text-slate-600">{v.itens?.length > 1 ? `${v.itens.length} produtos` : v.itens?.[0]?.itemNome || "—"}</Td>
                    <Td right className="font-medium text-slate-900 whitespace-nowrap">{fmtUSD(v.valor)}</Td>
                    <Td className="text-slate-600">{v.pagamento} · {v.condicao}</Td>
                    <Td><Badge status={v.status} /></Td>
                  </tr>
                ))}
                {vendas.length === 0 && <Vazio colSpan={6}>Nenhuma venda registrada.</Vazio>}
              </tbody>
            </table>
          </div>
        </div>

        <Cartao
          title="Mais vendidos"
          sub="Últimos 30 dias"
          action={<button onClick={() => setPage("maisVendidos")} className="text-xs font-medium text-emerald-700 hover:underline">Ver relatório</button>}
        >
          {top.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">Nenhuma venda nos últimos 30 dias.</div>
          ) : (
            <ul className="space-y-3">
              {top.map((p, idx) => (
                <li key={p.chave}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 truncate"><span className="text-slate-400 mr-1.5">{idx + 1}.</span>{p.nome}</span>
                    <span className="font-medium text-slate-900 shrink-0 ml-2">{p.qtd} un.</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(p.qtd / maxTop) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!ehVendedor && (
          <>
          <div className="text-sm font-semibold text-slate-900 mt-6">Próximas contas</div>
          <div className="text-xs text-slate-400 mb-3">Vencimentos pendentes</div>
          {contasPendentes.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">Nenhuma conta pendente.</div>
          ) : (
            <ul className="space-y-2.5">
              {[...contasPendentes].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate">{c.nome}</span>
                  <span className={`font-medium shrink-0 ml-2 ${c.vencimento < hoje ? "text-red-600" : "text-slate-500"}`}>
                    {fmtConta(c)} · {fmtDate(c.vencimento)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </>
          )}
        </Cartao>
      </div>
    </>
  );
}

export const diasDesde = (iso) => Math.round((parseISO(todayISO()) - parseISO(iso)) / 86400000);

export const mensagemSaudade = (c) =>
  c.motivo === "retorno" || c.proximoContato
    ? `Olá ${c.nome.split(" ")[0]}, tudo bem? Aqui é do Shopping 25. Conforme combinamos, estou passando para ver o seu pedido. Quer que eu te mande a lista de preços atualizada?`
    : `Olá ${c.nome.split(" ")[0]}, tudo bem? Aqui é do Shopping 25. Faz alguns dias que não recebemos seu pedido. Precisa de algum produto? Posso te mandar nossa lista de preços atualizada.`;

function LinhaSemPedido({ c, vendedor, mostrarVendedor, registrarContato, abrirModal }) {
  const retorno = c.motivo === "retorno";
  return (
    <li className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-slate-900 truncate">{c.nome}</div>
        {mostrarVendedor && <div className="text-xs text-violet-700 truncate">{vendedor ? `Vendedor: ${vendedor}` : "Sem vendedor"}</div>}
        {retorno ? (
          <div className="text-xs text-sky-700 truncate" title={c.notaContato || ""}>
            Retorno {c.proximoContato < todayISO() ? `atrasado desde ${fmtDate(c.proximoContato)}` : "agendado para hoje"}
            {c.notaContato ? ` · ${c.notaContato}` : ""}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Último pedido há {diasDesde(c.ultimaCompra)} dias</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <LinkWhatsApp contato={c.contato} texto={mensagemSaudade(c)} onClick={() => registrarContato(c.id)} rotulo="Mensagem" />
        <button onClick={() => abrirModal("listaPrecos", c)} className={btnIcone} title="Enviar lista de preços"><ListChecks size={15} /></button>
        <button onClick={() => abrirModal("agendar", c)} className={btnIcone} title="Agendar próximo contato"><CalendarClock size={15} /></button>
      </div>
    </li>
  );
}

function Lembretes({ titulo, vazio, children }) {
  const itens = React.Children.toArray(children);
  return (
    <div>
      <div className="text-xs font-semibold text-amber-800 mb-2">{titulo}</div>
      {itens.length === 0 ? <div className="text-sm text-amber-700/60">{vazio}</div> : <ul className="space-y-2">{itens}</ul>}
    </div>
  );
}

// Abre o WhatsApp (aplicativo ou WhatsApp Web) com a mensagem já escrita.
export function LinkWhatsApp({ contato, texto, onClick, rotulo }) {
  if (String(contato || "").replace(/\D/g, "").length < 8) return null;
  const href = linkWhatsApp(contato, texto);
  if (rotulo) {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={btnContorno}>
        <MessageCircle size={13} /> {rotulo}
      </a>
    );
  }
  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="noreferrer"
      title="Enviar mensagem no WhatsApp"
      className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50"
    >
      <MessageCircle size={15} />
    </a>
  );
}

function CartaoCaixa({ k, valor, equivale, mostrarEquivale = true }) {
  const m = CAIXA_META[k];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold ${m.color}`}>{m.symbol}</div>
        <div>
          <div className="text-sm font-medium text-slate-900">{m.label}</div>
          <div className="text-xs text-slate-400">{m.sub}</div>
        </div>
      </div>
      <div className={`text-lg font-semibold ${valor < 0 ? "text-red-600" : "text-slate-900"}`}>{m.format(valor)}</div>
      {mostrarEquivale && <div className="text-xs text-slate-400 mt-0.5">Equivale a {fmtUSD(equivale)}</div>}
    </div>
  );
}

// Miniatura da foto do produto (ou um quadrado vazio).
export function MiniFoto({ id, tamanho = "w-10 h-10" }) {
  const url = useFoto(id);
  return (
    <div className={`${tamanho} shrink-0 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-300`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ImageIcon size={14} />}
    </div>
  );
}

const selectCls = "text-sm border border-slate-200 bg-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600";

export function EstoquePage() {
  const { estoque, unidadesEstoque, valorEstoque, estoqueBaixo, abrirModal, excluirItem, busca, setBusca, ehVendedor, pode } = useApp();
  const [mostrar, setMostrar] = useState("todos");
  const [tipo, setTipo] = useState("");
  const [marca, setMarca] = useState("");
  const valores = (campo) => [...new Set(estoque.map((i) => (i[campo] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const tipos = valores("tipo");
  const marcas = valores("marca");
  const deFornecedor = estoque.filter(ehDeFornecedor).length;
  const lista = estoque.filter(
    (i) =>
      produtoCombina(i, busca) &&
      (mostrar !== "baixo" || (!ehDeFornecedor(i) && i.qtd <= i.min)) &&
      (mostrar !== "fornecedor" || ehDeFornecedor(i)) &&
      (!tipo || (i.tipo || "").trim() === tipo) &&
      (!marca || (i.marca || "").trim() === marca)
  );
  const filtrando = busca || tipo || marca;
  const colunas = ehVendedor ? 7 : 9;
  return (
    <>
    <PedidosProdutoPainel />
    <TableShell
      title="Estoque"
      sub={ehVendedor ? `${estoque.length} produtos` : `${estoque.length} produtos · ${unidadesEstoque} unidades · ${fmtUSD(valorEstoque)} a preço de custo`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <Segmentado
            valor={mostrar}
            onChange={setMostrar}
            opcoes={[
              { valor: "todos", label: "Todos" },
              { valor: "baixo", label: `Repor (${estoqueBaixo.length})` },
              { valor: "fornecedor", label: `De fornecedor (${deFornecedor})` },
            ]}
          />
          <button onClick={() => abrirModal("listaPrecos")} className={btnSecundario}>
            <ListChecks size={14} /> Lista de preços
          </button>
          {ehVendedor && pode.cadastrarProduto && (
            <button onClick={() => abrirModal("pedidoProduto")} className={btnPrimario}>
              <Plus size={14} /> Adicionar produto
            </button>
          )}
          {!ehVendedor && (
            <>
              <button onClick={() => abrirModal("compra")} className={btnSecundario}>
                <Plus size={14} /> Entrada (compra)
              </button>
              <button onClick={() => abrirModal("item")} className={btnPrimario}>
                <Plus size={14} /> Novo produto
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar pelo nome, marca ou tipo..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpar pesquisa">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {tipos.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={marca} onChange={(e) => setMarca(e.target.value)} className={selectCls} aria-label="Marca">
          <option value="">Todas as marcas</option>
          {marcas.map((t) => <option key={t}>{t}</option>)}
        </select>
        {filtrando && (
          <span className="text-xs text-slate-500">
            {lista.length} de {estoque.length} · <button className="text-emerald-700 hover:underline" onClick={() => { setBusca(""); setTipo(""); setMarca(""); }}>limpar</button>
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Produto</Th><Th right>Qtd</Th>
            {ehVendedor ? <Th right>Custo</Th> : <><Th right>Custo real</Th><Th right>Custo vend.</Th></>}
            <Th right>Varejo</Th><Th right>Atacado</Th><Th right>Lojista</Th>
            {!ehVendedor && <Th right>Valor total</Th>}
            <Th right>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {lista.map((i) => {
            const fornecedor = ehDeFornecedor(i);
            const baixo = !fornecedor && i.qtd <= i.min;
            return (
              <tr key={i.id} className={linhaCls}>
                <Td className="font-medium text-slate-900">
                  <div className="flex items-center gap-3 min-w-[15rem]">
                    <MiniFoto id={i.foto} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {i.nome}
                        {baixo && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-1.5 py-0.5 ${i.qtd <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                            <AlertTriangle size={11} /> {i.qtd <= 0 ? "Esgotado" : "Repor"}
                          </span>
                        )}
                      </div>
                      {descricaoProduto(i) && <div className="text-xs font-normal text-slate-400">{descricaoProduto(i)}</div>}
                    </div>
                  </div>
                </Td>
                {fornecedor ? (
                  <Td right className="text-slate-500">
                    <div className="text-xs font-medium text-sky-700 whitespace-nowrap">Sob encomenda</div>
                    <div className="text-xs text-slate-400">{ehVendedor ? "Fornecedor" : i.fornecedorNome || "Fornecedor"}</div>
                  </Td>
                ) : (
                  <>
                    <Td right className={baixo ? (i.qtd <= 0 ? "text-red-600 font-semibold" : "text-amber-700 font-semibold") : "text-slate-700"}>
                      {i.qtd}
                      <div className="text-xs font-normal text-slate-400 whitespace-nowrap">mín. {i.min}</div>
                    </Td>
                  </>
                )}
                {ehVendedor ? (
                  <Td right className="text-slate-600 whitespace-nowrap">{i.custoVendedor != null ? fmtUSD(i.custoVendedor) : "—"}</Td>
                ) : (
                  <>
                    <Td right className="text-slate-600 whitespace-nowrap">{fmtUSD(i.custo)}</Td>
                    <Td right className="text-slate-400 whitespace-nowrap">{i.custoVendedor != null && i.custoVendedor !== "" ? fmtUSD(i.custoVendedor) : <span className="text-xs">= real</span>}</Td>
                  </>
                )}
                <Td right className="text-slate-600 whitespace-nowrap">{fmtUSD(i.varejo)}</Td>
                <Td right className="text-slate-600 whitespace-nowrap">{fmtUSD(i.atacado)}</Td>
                <Td right className="text-slate-600 whitespace-nowrap">{fmtUSD(i.lojista ?? i.atacado)}</Td>
                {!ehVendedor && <Td right className="text-slate-900 font-medium whitespace-nowrap">{fornecedor ? "—" : fmtUSD(Math.max(0, i.qtd) * i.custo)}</Td>}
                <Td right>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => abrirModal("enviarProduto", i)} className={btnIcone} title="Enviar ao cliente (foto e preço)"><Send size={15} /></button>
                    {!ehVendedor && (
                      <>
                        <button onClick={() => abrirModal("item", i)} className={btnIcone} title="Editar"><Pencil size={15} /></button>
                        <button onClick={() => excluirItem(i)} className={btnIconePerigo} title="Excluir"><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
          {lista.length === 0 && (
            <Vazio colSpan={colunas}>{estoque.length === 0 ? "Nenhum produto cadastrado." : "Nenhum produto encontrado."}</Vazio>
          )}
        </tbody>
      </table>
    </TableShell>
    </>
  );
}

export function VendasPage() {
  const { vendas, abrirModal, clientes, vendedores, ehVendedor } = useApp();
  const [filtro, setFiltro] = useState("todas");
  const [vend, setVend] = useState("");
  const lista = vendas.filter((v) => (filtro === "todas" || v.status === filtro) && (!vend || (vend === "-" ? !v.vendedorId : v.vendedorId === vend)));
  const total = lista.reduce((s, v) => s + v.valor, 0);
  return (
    <TableShell
      title="Vendas"
      sub={`${lista.length} registros · ${fmtUSD(total)}`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          {vendedores.length > 0 && (
            <select value={vend} onChange={(e) => setVend(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600">
              <option value="">Todos os vendedores</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              <option value="-">Sem vendedor</option>
            </select>
          )}
          <Segmentado
            valor={filtro}
            onChange={setFiltro}
            opcoes={[{ valor: "todas", label: "Todas" }, { valor: "Pendente", label: "A receber" }, { valor: "Pago", label: "Pagas" }]}
          />
          <button onClick={() => abrirModal("venda")} className={btnPrimario}>
            <Plus size={14} /> Nova venda
          </button>
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Venda</Th><Th>Cliente</Th><Th>Vendedor</Th><Th>Itens</Th><Th right>Valor</Th><Th>Pagamento</Th><Th>Status</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {lista.map((v) => {
            const cliente = clientes.find((c) => c.id === v.clienteId);
            return (
              <tr key={v.id} className={linhaCls}>
                <Td>
                  <div className="font-medium text-slate-900">#{v.numero}</div>
                  <div className="text-xs text-slate-400">{fmtDate(v.data)}</div>
                </Td>
                <Td className="text-slate-600">{v.clienteNome}</Td>
                <Td className="text-slate-500">{v.vendedorNome || "—"}</Td>
                <Td className="text-slate-600">
                  {(v.itens || []).map((l, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                      {l.itemNome} × {l.qtd} <span className="text-xs text-slate-400">({l.tipoVenda})</span>
                    </div>
                  ))}
                  {valorDevolvido(v) > 0 && <div className="text-xs text-red-600 mt-1">Devolução: {fmtUSD(valorDevolvido(v))}</div>}
                </Td>
                <Td right className="font-medium text-slate-900 whitespace-nowrap">
                  {fmtUSD(v.valor)}
                  {v.status === "Pendente" && valorPagoDaVenda(v) > 0 && <div className="text-xs font-normal text-amber-700">Falta {fmtUSD(faltaReceber(v))}</div>}
                </Td>
                <Td className="text-slate-600">{v.pagamento} · {v.condicao}</Td>
                <Td><Badge status={v.status} /></Td>
                <Td right>
                  <div className="flex items-center justify-end gap-1">
                  {!ehVendedor && <button onClick={() => abrirModal("editarVenda", v)} className={btnIcone} title="Editar venda"><Pencil size={15} /></button>}
                  {!ehVendedor && <button onClick={() => abrirModal("devolucao", v)} className={btnIcone} title="Devolução do cliente"><Undo2 size={15} /></button>}
                  {v.status === "Pendente" && (
                    <div className="flex items-center justify-end gap-1">
                      <LinkWhatsApp contato={cliente?.contato} texto={textoCobranca(v)} />
                      {ehVendedor ? (
                        <span className="text-xs text-slate-400 whitespace-nowrap">O dono confirma</span>
                      ) : (
                        <button onClick={() => abrirModal("receberVenda", v)} className={btnContorno}>Receber</button>
                      )}
                    </div>
                  )}
                  </div>
                </Td>
              </tr>
            );
          })}
          {lista.length === 0 && <Vazio colSpan={8}>Nenhuma venda encontrada.</Vazio>}
        </tbody>
      </table>
    </TableShell>
  );
}

const PERIODOS = [
  { valor: "7", label: "7 dias" },
  { valor: "30", label: "30 dias" },
  { valor: "90", label: "90 dias" },
  { valor: "tudo", label: "Tudo" },
];

export function MaisVendidosPage() {
  const { vendas, estoque } = useApp();
  const [periodo, setPeriodo] = useState("30");
  const desde = periodo === "tudo" ? null : diasAtras(Number(periodo) - 1);
  const lista = useMemo(() => calcularMaisVendidos(vendas, estoque, desde), [vendas, estoque, desde]);
  const totalQtd = lista.reduce((s, p) => s + p.qtd, 0);
  const totalValor = lista.reduce((s, p) => s + p.total, 0);
  const max = lista[0]?.qtd || 1;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Unidades vendidas" value={totalQtd} sub={periodo === "tudo" ? "Desde o início" : `Últimos ${periodo} dias`} icon={Package} />
        <StatCard label="Faturamento" value={fmtUSD(totalValor)} sub="Soma dos produtos vendidos" icon={DollarSign} tom="sky" />
        <StatCard label="Produtos diferentes" value={lista.length} sub="Com pelo menos uma venda" icon={TrendingUp} tom="violet" />
      </div>
      <TableShell
        title="Ranking de produtos"
        sub="Ordenado pela quantidade vendida"
        action={<Segmentado valor={periodo} onChange={setPeriodo} opcoes={PERIODOS} />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th>#</Th><Th>Produto</Th><Th right>Unidades</Th><Th>Participação</Th><Th right>Faturamento</Th><Th right>Nº de vendas</Th><Th right>Em estoque</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p, idx) => (
              <tr key={p.chave} className={linhaCls}>
                <Td className="text-slate-400 font-medium">{idx + 1}</Td>
                <Td className="font-medium text-slate-900">{p.nome}</Td>
                <Td right className="font-semibold text-slate-900">{p.qtd}</Td>
                <Td className="min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(p.qtd / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{totalQtd ? Math.round((p.qtd / totalQtd) * 100) : 0}%</span>
                  </div>
                </Td>
                <Td right className="text-slate-700 whitespace-nowrap">{fmtUSD(p.total)}</Td>
                <Td right className="text-slate-500">{p.vendas}</Td>
                <Td right className={p.estoque == null ? "text-slate-300" : "text-slate-600"}>{p.estoque ?? "—"}</Td>
              </tr>
            ))}
            {lista.length === 0 && <Vazio colSpan={7}>Nenhuma venda neste período.</Vazio>}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}

export function ComprasPage() {
  const { compras, contas, abrirModal } = useApp();
  const [filtro, setFiltro] = useState("todas");
  const abertas = compras.filter((c) => situacaoCompra(c, contas).aberto);
  const lista = filtro === "abertas" ? abertas : filtro === "todas" ? compras : compras.filter((c) => (c.condicao || "À vista") === filtro);
  return (
    <TableShell
      title="Compras"
      sub={`${compras.length} registros · ${abertas.length} em aberto`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar compras" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600">
            <option value="todas">Todas</option>
            <option value="abertas">Em aberto ({abertas.length})</option>
            <option value="À vista">À vista</option>
            <option value="A prazo">A prazo</option>
            <option value="Consignado">Consignado</option>
            <option value="Devolução">Devoluções</option>
          </select>
          <button onClick={() => abrirModal("compra")} className={btnPrimario}>
            <Plus size={14} /> Nova compra
          </button>
        </div>
      }
    >
      <ListaCompras compras={lista} />
    </TableShell>
  );
}

export function CaixaPage() {
  const { caixas, movimentos, abrirModal } = useApp();
  const [filtro, setFiltro] = useState("todos");
  const lista = movimentos.filter((m) => filtro === "todos" || m.caixa === filtro);
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-900">Caixas e saldos</div>
        <button onClick={() => abrirModal("movimento")} className={btnPrimario}>
          <Plus size={14} /> Movimento
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Object.keys(CAIXA_META).map((k) => <CartaoCaixa key={k} k={k} valor={caixas[k]} mostrarEquivale={false} />)}
      </div>
      <TableShell
        title="Movimentações"
        sub={`${lista.length} lançamentos`}
        action={
          <Segmentado
            valor={filtro}
            onChange={setFiltro}
            opcoes={[{ valor: "todos", label: "Todos" }, ...Object.keys(CAIXA_META).map((k) => ({ valor: k, label: CAIXA_META[k].label }))]}
          />
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th>Data</Th><Th>Caixa</Th><Th>Tipo</Th><Th>Descrição</Th><Th right>Valor</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => {
              const meta = CAIXA_META[m.caixa];
              return (
                <tr key={m.id} className={linhaCls}>
                  <Td className="text-slate-600 whitespace-nowrap">{fmtDate(m.data)}</Td>
                  <Td className="font-medium text-slate-900">{meta?.label || m.caixa}</Td>
                  <Td><span className={m.tipo === "Entrada" ? "text-emerald-700 font-medium" : "text-red-600 font-medium"}>{m.tipo}</span></Td>
                  <Td className="text-slate-600">{m.descricao}</Td>
                  <Td right className={`whitespace-nowrap font-medium ${m.tipo === "Entrada" ? "text-emerald-700" : "text-red-600"}`}>
                    {m.tipo === "Entrada" ? "+" : "−"} {meta ? meta.format(m.valor) : m.valor}
                  </Td>
                </tr>
              );
            })}
            {lista.length === 0 && <Vazio colSpan={5}>Nenhuma movimentação registrada.</Vazio>}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}

export function PessoasPage({ tipo }) {
  const app = useApp();
  const isCliente = tipo === "cliente";
  const data = isCliente ? app.clientes : app.fornecedores;
  const [q, setQ] = useState("");
  const [soSemPedido, setSoSemPedido] = useState(false);
  const [doVendedor, setDoVendedor] = useState("todos");
  const semPedido = new Set(isCliente ? app.clientesSemPedido.map((c) => c.id) : []);
  const termo = normalizar(q);
  const nomeVendedor = (id) => app.vendedores.find((v) => v.id === id)?.nome;
  const lista = data
    .filter((p) => !termo || normalizar(p.nome).includes(termo) || normalizar(p.contato).includes(termo))
    .filter((p) => doVendedor === "todos" || (p.vendedorId || "") === doVendedor)
    .filter((p) => !soSemPedido || semPedido.has(p.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const resumo = useMemo(() => {
    if (!isCliente) return {};
    const r = {};
    for (const v of app.vendas) {
      if (!v.clienteId) continue;
      const e = (r[v.clienteId] ||= { total: 0, ultima: null, pendente: 0 });
      e.total += v.valor;
      if (!e.ultima || v.data > e.ultima) e.ultima = v.data;
      if (v.status === "Pendente") e.pendente += faltaReceber(v);
    }
    return r;
  }, [app.vendas, isCliente]);
  // Fornecedor: quantos produtos, quanto falta pagar e quanto está consignado.
  const resumoForn = useMemo(() => {
    if (isCliente) return {};
    const r = {};
    const de = (id) => (r[id] ||= { produtos: 0, aPagar: 0, consignado: 0 });
    for (const i of app.estoque) if (i.fornecedorId) de(i.fornecedorId).produtos++;
    const fornDaCompra = new Map(app.compras.map((c) => [c.id, c.fornecedorId]));
    for (const k of app.contas) {
      const fid = k.fornecedorId || fornDaCompra.get(k.compraId);
      if (fid && k.status === "Pendente") de(fid).aPagar += k.valor;
    }
    for (const c of app.compras) if (c.condicao === "Consignado" && c.fornecedorId) de(c.fornecedorId).consignado += restanteConsignado(c);
    return r;
  }, [isCliente, app.estoque, app.compras, app.contas]);

  return (
    <TableShell
      title={isCliente ? "Clientes" : "Fornecedores"}
      sub={`${data.length} cadastros`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          {isCliente && (
            <Segmentado
              valor={soSemPedido ? "sem" : "todos"}
              onChange={(v) => setSoSemPedido(v === "sem")}
              opcoes={[{ valor: "todos", label: "Todos" }, { valor: "sem", label: `Para contatar (${semPedido.size})` }]}
            />
          )}
          {isCliente && !app.ehVendedor && app.vendedores.length > 0 && (
            <select value={doVendedor} onChange={(e) => setDoVendedor(e.target.value)} aria-label="Vendedor" className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600">
              <option value="todos">Todos os vendedores</option>
              <option value="">Sem vendedor</option>
              {app.vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          <button onClick={() => app.abrirModal(tipo)} className={btnPrimario}>
            <Plus size={14} /> Novo
          </button>
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Nome</Th><Th>Contato</Th>
            {isCliente && <><Th>Tabela</Th><Th right>Total comprado</Th><Th>Última compra</Th><Th right>A receber</Th></>}
            {!isCliente && <><Th>Observação</Th><Th right>Produtos</Th><Th right>A pagar</Th><Th right>Consignado</Th></>}
            <Th right>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => {
            const r = resumo[p.id];
            return (
              <tr key={p.id} className={linhaCls}>
                <Td className="font-medium text-slate-900">
                  {isCliente ? (app.ehVendedor ? p.nome : <button onClick={() => app.abrirModal("contaCliente", p)} className="text-left font-medium text-slate-900 hover:text-emerald-700 hover:underline">{p.nome}</button>) : <button onClick={() => app.abrirModal("fornecedorDetalhe", p)} className="text-left font-medium text-slate-900 hover:text-emerald-700 hover:underline">{p.nome}</button>}
                  {isCliente && !app.ehVendedor && <div className="text-xs font-normal text-slate-400">{nomeVendedor(p.vendedorId) ? `Vendedor: ${nomeVendedor(p.vendedorId)}` : "Sem vendedor"}</div>}
                </Td>
                <Td className="text-slate-600">{p.contato || "—"}</Td>
                {isCliente && (
                  <>
                    <Td className="text-slate-500">{p.tabela || "Varejo"}</Td>
                    <Td right className="text-slate-700 whitespace-nowrap">{fmtUSD(r?.total)}</Td>
                    <Td className={semPedido.has(p.id) ? "text-amber-700 font-medium" : "text-slate-500"}>
                      {r?.ultima ? fmtDate(r.ultima) : "—"}
                      {r?.ultima && semPedido.has(p.id) && <div className="text-xs font-normal">há {diasDesde(r.ultima)} dias</div>}
                      {p.proximoContato && (
                        <div className="text-xs font-normal text-sky-700" title={p.notaContato || ""}>Retornar em {fmtDate(p.proximoContato)}{p.notaContato ? ` · ${p.notaContato}` : ""}</div>
                      )}
                    </Td>
                    <Td right className={r?.pendente ? "text-amber-700 font-medium whitespace-nowrap" : "text-slate-400"}>
                      {r?.pendente ? fmtUSD(r.pendente) : "—"}
                      {!app.ehVendedor && Number(p.limiteCredito) > 0 && (
                        <div className={`text-xs font-normal ${(r?.pendente || 0) > Number(p.limiteCredito) ? "text-red-600" : "text-slate-400"}`}>limite {fmtUSD(p.limiteCredito)}</div>
                      )}
                    </Td>
                  </>
                )}
                {!isCliente && (
                  <>
                    <Td className="text-slate-500">{p.obs || "—"}</Td>
                    <Td right className="tabular-nums text-slate-700">{resumoForn[p.id]?.produtos || 0}</Td>
                    <Td right className={resumoForn[p.id]?.aPagar ? "text-amber-700 font-medium whitespace-nowrap" : "text-slate-400"}>{resumoForn[p.id]?.aPagar ? fmtUSD(resumoForn[p.id].aPagar) : "—"}</Td>
                    <Td right className={resumoForn[p.id]?.consignado ? "text-violet-700 font-medium whitespace-nowrap" : "text-slate-400"}>{resumoForn[p.id]?.consignado ? fmtUSD(resumoForn[p.id].consignado) : "—"}</Td>
                  </>
                )}
                <Td right>
                  <div className="flex items-center justify-end gap-1">
                    <LinkWhatsApp
                      contato={p.contato}
                      texto={semPedido.has(p.id) ? mensagemSaudade(p) : `Olá ${p.nome.split(" ")[0]}, tudo bem? Aqui é do Shopping 25.`}
                      onClick={isCliente ? () => app.registrarContato(p.id) : undefined}
                    />
                    {isCliente && <button onClick={() => app.abrirModal("listaPrecos", p)} className={btnIcone} title="Enviar lista de preços"><ListChecks size={15} /></button>}
                    {!isCliente && <button onClick={() => app.abrirModal("fornecedorDetalhe", p)} className={btnIcone} title="Produtos e compras"><Package size={15} /></button>}
                    {isCliente && <button onClick={() => app.abrirModal("agendar", p)} className={btnIcone} title="Agendar próximo contato"><CalendarClock size={15} /></button>}
                    {isCliente && !app.ehVendedor && <button onClick={() => app.abrirModal("contaCliente", p)} className={btnIcone} title="Conta do cliente"><Wallet size={15} /></button>}
                    <button onClick={() => app.abrirModal(tipo, p)} className={btnIcone} title="Editar"><Pencil size={15} /></button>
                    {!app.ehVendedor && <button onClick={() => app.excluirPessoa(tipo, p)} className={btnIconePerigo} title="Excluir"><Trash2 size={15} /></button>}
                  </div>
                </Td>
              </tr>
            );
          })}
          {lista.length === 0 && (
            <Vazio colSpan={isCliente ? 7 : 7}>{data.length === 0 ? `Nenhum ${isCliente ? "cliente" : "fornecedor"} cadastrado.` : "Nenhum resultado."}</Vazio>
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

export function ContasPage() {
  const { contas, contasPendentes, totalContasPendentes, abrirModal, duplicarConta, excluirConta } = useApp();
  const hoje = todayISO();
  const ordenadas = [...contas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return (
    <TableShell
      title="Contas a pagar"
      sub={`${contasPendentes.length} pendentes · ${fmtUSD(totalContasPendentes)}`}
      action={
        <button onClick={() => abrirModal("conta")} className={btnPrimario}>
          <Plus size={14} /> Nova conta
        </button>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Conta</Th><Th>Categoria</Th><Th right>Valor</Th><Th>Vencimento</Th><Th>Status</Th><Th right>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((c) => {
            const atrasada = c.status === "Pendente" && c.vencimento < hoje;
            return (
              <tr key={c.id} className={linhaCls}>
                <Td className="font-medium text-slate-900">{c.nome}</Td>
                <Td className="text-slate-600">{c.categoria}</Td>
                <Td right className="text-slate-900 font-medium whitespace-nowrap">
                  {fmtConta(c)}
                  {c.status === "Pago" && c.caixa && c.valorPagoNoCaixa != null && <div className="text-xs font-normal text-slate-400">Saiu {CAIXA_META[c.caixa]?.format(c.valorPagoNoCaixa)} do {CAIXA_META[c.caixa]?.label}</div>}
                </Td>
                <Td className={atrasada ? "text-red-600 font-medium" : "text-slate-600"}>
                  {fmtDate(c.vencimento)}
                  {c.status === "Pago" && c.dataPagamento && <div className="text-xs text-slate-400">Pago em {fmtDate(c.dataPagamento)}</div>}
                </Td>
                <Td><Badge status={atrasada ? "Atrasada" : c.status} /></Td>
                <Td right>
                  <div className="flex items-center justify-end gap-1">
                    {c.status === "Pendente" && (
                      <button onClick={() => abrirModal("pagarConta", c)} className={btnIcone} title="Marcar como paga"><Check size={15} /></button>
                    )}
                    {c.status === "Pago" && (
                      <button onClick={() => duplicarConta(c.id)} className={btnIcone} title="Repetir no próximo mês"><Copy size={15} /></button>
                    )}
                    <button onClick={() => abrirModal("conta", c)} className={btnIcone} title="Editar"><Pencil size={15} /></button>
                    <button onClick={() => excluirConta(c)} className={btnIconePerigo} title="Excluir"><Trash2 size={15} /></button>
                  </div>
                </Td>
              </tr>
            );
          })}
          {contas.length === 0 && <Vazio colSpan={6}>Nenhuma conta cadastrada.</Vazio>}
        </tbody>
      </table>
    </TableShell>
  );
}

export function CambioPage() {
  const { cambio, setCambio } = useApp();
  return (
    <Cartao title="Taxas de câmbio" sub="Defina manualmente as cotações usadas no sistema." className="max-w-lg">
      <CambioForm initial={cambio} onSave={(vals) => setCambio({ ...cambio, ...vals })} />
    </Cartao>
  );
}

export function CambioForm({ onSave, initial }) {
  const [tcr, setTcr] = useState(initial.tcr);
  const [cc, setCc] = useState(initial.chacoCompra);
  const [salvo, setSalvo] = useState(false);
  const valido = tcr > 0 && cc > 0;
  return (
    <div>
      <Field label="TCR · BRL/USDT">
        <input type="number" step="0.01" min="0" className={inputCls} value={tcr} onChange={(e) => { setTcr(Number(e.target.value)); setSalvo(false); }} />
      </Field>
      <Field label="Chaco · compra USD" hint="Usada no orçamento enviado ao cliente (valor em reais) e para converter os caixas em reais (PIX e Real) para dólar.">
        <input type="number" step="0.01" min="0" className={inputCls} value={cc} onChange={(e) => { setCc(Number(e.target.value)); setSalvo(false); }} />
      </Field>
      <button
        disabled={!valido}
        onClick={() => { onSave({ tcr, chacoCompra: cc, modo: "Manual" }); setSalvo(true); }}
        className={btnPrimario + " w-full"}
      >
        {salvo ? "Taxas salvas" : "Salvar taxas"}
      </button>
    </div>
  );
}

const nomeMes = (ano, mes) => new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

export function VendedoresPage() {
  const { vendedores, vendedoresTodos, vendas, estoque, abrirModal, ehVendedor, pode } = useApp();
  // O vendedor não recebe as vendas dos outros: as dos vendedores que ele indicou vêm do servidor.
  const [doServidor, setDoServidor] = useState(null);
  useEffect(() => {
    if (!ehVendedor) return;
    db.vendasDosIndicados().then(setDoServidor).catch(() => setDoServidor(null));
  }, [ehVendedor]);
  const vendasComissao = ehVendedor ? [...vendas, ...(doServidor?.vendas || [])] : vendas;
  const vendedoresComissao = ehVendedor ? [...vendedores, ...(doServidor?.indicados || [])] : vendedoresTodos;
  const hoje = new Date();
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const prefixo = `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}`;
  const ehMesAtual = ref.ano === hoje.getFullYear() && ref.mes === hoje.getMonth();
  const mudarMes = (d) => setRef(({ ano, mes }) => {
    const x = new Date(ano, mes + d, 1);
    return { ano: x.getFullYear(), mes: x.getMonth() };
  });

  const doMes = vendas.filter((v) => String(v.data).startsWith(prefixo));
  const linhas = [...vendedores]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((vd) => {
      const vs = doMes.filter((v) => v.vendedorId === vd.id);
      // Frete não entra na comissão nem na meta.
      const prod = (v) => Number(v.valorProdutos ?? v.valor);
      const total = vs.reduce((s, v) => s + prod(v), 0);
      const recebido = vs.filter((v) => v.status === "Pago").reduce((s, v) => s + prod(v), 0);
      // A comissão é sobre o lucro: preço de venda menos o custo para vendedores.
      const c = comissaoDoMes(vd, vendasComissao, estoque, prefixo, vendedoresComissao);
      const meta = Number(vd.meta || 0);
      return { vd, c, qtd: vs.length, total, recebido, lucro: c.lucro, comissao: c.valor, pago: c.pago, falta: c.falta, meta, pct: meta > 0 ? (total / meta) * 100 : null };
    })
    .sort((a, b) => b.total - a.total);
  const semVendedor = doMes.filter((v) => !v.vendedorId).reduce((s, v) => s + Number(v.valorProdutos ?? v.valor), 0);
  const totalComissoes = linhas.reduce((s, l) => s + l.comissao, 0);
  const totalFalta = linhas.reduce((s, l) => s + l.falta, 0);
  const totalVendido = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => mudarMes(-1)} className={btnIcone} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <div className="text-sm font-semibold text-slate-900 w-40 text-center first-letter:uppercase">{nomeMes(ref.ano, ref.mes)}</div>
          <button onClick={() => mudarMes(1)} className={btnIcone} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
        {!ehVendedor && <button onClick={() => abrirModal("vendedor")} className={btnPrimario}><Plus size={14} /> Novo vendedor</button>}
        {ehVendedor && pode.indicarVendedor && <button onClick={() => abrirModal("indicacao")} className={btnPrimario}><Plus size={14} /> Indicar vendedor</button>}
      </div>

      <IndicacoesPainel />

      <div className={`grid grid-cols-1 ${ehVendedor ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4 mb-6`}>
        <StatCard label={ehVendedor ? "Suas vendas" : "Vendido pelos vendedores"} value={fmtUSD(totalVendido)} sub={semVendedor > 0 ? `${fmtUSD(semVendedor)} em vendas sem vendedor` : "No mês selecionado"} icon={DollarSign} />
        <StatCard label={ehVendedor ? "Sua comissão" : "Comissões a pagar"} value={fmtUSD(ehVendedor ? totalComissoes : totalFalta)} sub={ehVendedor ? (totalFalta < totalComissoes - 0.004 ? `${fmtUSD(totalComissoes - totalFalta)} já pago` : "No mês selecionado") : `De ${fmtUSD(totalComissoes)} no mês, sobre o lucro`} icon={Receipt} tom="violet" />
        {!ehVendedor && <StatCard label="Vendedores" value={vendedores.filter((v) => v.ativo !== false).length} sub="Ativos" icon={Users} tom="slate" />}
      </div>

      {vendedores.length === 0 ? (
        <Cartao>
          <div className="text-center py-8">
            <div className="text-sm text-slate-600 mb-3">Nenhum vendedor cadastrado ainda.</div>
            <button onClick={() => abrirModal("vendedor")} className={btnPrimario}><Plus size={14} /> Cadastrar o primeiro vendedor</button>
          </div>
        </Cartao>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {linhas.map(({ vd, c, qtd, total, recebido, lucro, comissao, pago, falta, meta, pct }) => {
            const bateu = pct != null && pct >= 100;
            return (
              <div key={vd.id} className={`bg-white border rounded-xl p-5 shadow-sm ${vd.ativo === false ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{vd.nome}</div>
                    <div className="text-xs text-slate-400">Comissão de {fmtNum(vd.comissao, 1)}%{vd.ativo === false ? " · inativo" : ""}</div>
                    {!ehVendedor && vd.indicadoPor && (
                      <div className="text-xs text-slate-400">Indicado por {vendedoresTodos.find((x) => x.id === vd.indicadoPor)?.nome || "vendedor excluído"}</div>
                    )}
                  </div>
                  {!ehVendedor && <button onClick={() => abrirModal("vendedor", vd)} className={btnIcone} title="Editar"><Pencil size={15} /></button>}
                </div>
                <div className="text-2xl font-semibold text-slate-900 tracking-tight">{fmtUSD(total)}</div>
                <div className="text-xs text-slate-400 mb-4">{qtd} {qtd === 1 ? "venda" : "vendas"} · {fmtUSD(recebido)} já recebido</div>

                {meta > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1 text-slate-500"><Target size={12} /> Meta {fmtUSD(meta)}</span>
                      <span className={`font-semibold ${bateu ? "text-emerald-700" : "text-slate-700"}`}>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${bateu ? "bg-emerald-600" : "bg-sky-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1.5">
                      {bateu ? `Meta batida! Bônus de ${fmtNum(c.pctBonus, 1)}% na comissão` : ehMesAtual ? `Faltam ${fmtUSD(meta - total)} para ganhar +${fmtNum(c.pctBonus, 1)}% na comissão` : `Ficou ${fmtUSD(meta - total)} abaixo da meta`}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mb-4">Sem meta definida.</div>
                )}

                {/* O lucro fica só para o dono; o vendedor vê apenas a comissão dele. */}
                {!ehVendedor && (
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
                    <span>Lucro das vendas</span>
                    <span className="font-medium text-slate-700">{fmtUSD(lucro)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2">
                  <span className="text-xs font-medium text-violet-700">{ehVendedor ? "Sua comissão do mês" : `Comissão do mês (${fmtNum(vd.comissao, 1)}% do lucro)`}</span>
                  <span className="text-sm font-semibold text-violet-800">{fmtUSD(comissao)}</span>
                </div>
                {(c.indicados.length > 0 || c.bonus > 0) && (
                  <div className="mt-2 px-1 text-xs text-slate-500 space-y-0.5">
                    <div className="flex justify-between"><span>Vendas {ehVendedor ? "suas" : "dele"} ({fmtNum(vd.comissao, 1)}%)</span><span>{fmtUSD(c.propria)}</span></div>
                    {c.bonus > 0 && (
                      <div className="flex justify-between text-emerald-700"><span>Bônus da meta (+{fmtNum(c.pctBonus, 1)}%)</span><span>{fmtUSD(c.bonus)}</span></div>
                    )}
                    {c.indicados.map((x) => (
                      <div key={x.vendedor.id} className="flex justify-between"><span>{x.bateuMeta ? `Bônus porque ${x.vendedor.nome} bateu a meta` : `${x.vendedor.nome} ainda não bateu a meta`}</span><span>{fmtUSD(x.valor)}</span></div>
                    ))}
                  </div>
                )}
                {comissao > 0 && (
                  <div className="flex items-center justify-between gap-2 mt-2 px-1 text-xs">
                    <span className={falta > 0 ? "text-slate-500" : "text-emerald-700 font-medium"}>
                      {falta > 0 ? (pago > 0 ? `Pago ${fmtUSD(pago)} · falta ${fmtUSD(falta)}` : ehVendedor ? "Ainda não paga" : `Falta pagar ${fmtUSD(falta)}`) : "Comissão paga"}
                    </span>
                    {!ehVendedor && falta > 0 && (
                      <button onClick={() => abrirModal("pagarComissao", { vendedorId: vd.id, mes: prefixo })} className="font-medium text-violet-700 border border-violet-200 hover:bg-violet-50 rounded-md px-2 py-1">Pagar comissão</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// Produtos cadastrados pelo vendedor: o dono aprova (entra no estoque) ou recusa;
// o vendedor acompanha a resposta.
function PedidosProdutoPainel() {
  const { pedidosProduto, pedidosParaAprovar, responderPedidoProduto, abrirModal, ehVendedor } = useApp();
  const lista = ehVendedor
    ? pedidosProduto.filter((p) => p.status === "Pendente" || (p.respondidoEm || "") >= diasAtras(7))
    : pedidosParaAprovar;
  if (!lista.length) return null;
  const cor = { Pendente: "text-amber-700", Aprovado: "text-emerald-700", Recusado: "text-red-600" };
  function aprovar(p) {
    abrirModal("item", {
      nome: p.nome, marca: p.marca, tipo: p.tipo, qtd: p.qtd, custo: p.custo ?? 0,
      varejo: p.varejo, atacado: p.atacado, lojista: p.lojista, origem: "estoque", min: 3, pedido: p,
    });
  }
  return (
    <Cartao
      className="mb-6 border-amber-200"
      title={ehVendedor ? "Seus produtos para aprovação" : `Produtos aguardando aprovação (${lista.length})`}
      sub={ehVendedor ? "O produto entra no estoque quando o dono aprovar." : "Cadastrados pelos vendedores. Ao aprovar, o produto entra no estoque."}
    >
      <div className="divide-y divide-slate-100">
        {lista.map((p) => (
          <div key={p.id} className="py-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[12rem]">
              <div className="text-sm font-medium text-slate-900">{p.nome} <span className="text-slate-400 font-normal">· {p.qtd} un.</span></div>
              <div className="text-xs text-slate-500">
                {[p.marca, p.tipo].filter(Boolean).join(" · ")}{(p.marca || p.tipo) ? " · " : ""}Varejo {fmtUSD(p.varejo)}
                {!ehVendedor && ` · ${p.vendedorNome} · ${fmtDate(p.data)}`}
                {p.obs && ` · ${p.obs}`}
              </div>
            </div>
            {ehVendedor ? (
              <span className={`text-xs font-medium ${cor[p.status] || ""}`}>{p.status === "Pendente" ? "Aguardando o dono" : p.status}</span>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { if (window.confirm(`Recusar "${p.nome}"?`)) responderPedidoProduto(p.id, "Recusado"); }} className="text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-md px-2.5 py-1">Recusar</button>
                <button onClick={() => aprovar(p)} className={btnContorno}>Aprovar entrada</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Cartao>
  );
}

// Vendedores novos indicados por um vendedor: o dono aprova (cadastra e cria o login) ou
// recusa; o vendedor acompanha a resposta.
function IndicacoesPainel() {
  const { indicacoes, indicacoesParaAprovar, responderIndicacao, abrirModal, ehVendedor } = useApp();
  const lista = ehVendedor
    ? indicacoes.filter((p) => p.status === "Pendente" || (p.respondidoEm || "") >= diasAtras(7))
    : indicacoesParaAprovar;
  if (!lista.length) return null;
  const cor = { Pendente: "text-amber-700", Aprovado: "text-emerald-700", Recusado: "text-red-600" };
  return (
    <Cartao
      className="mb-6 border-amber-200"
      title={ehVendedor ? "Suas indicações" : `Vendedores indicados aguardando aprovação (${lista.length})`}
      sub={ehVendedor ? "Quando o dono aprovar, você ganha um bônus nos meses em que quem você indicou bater a meta." : "Ao aprovar, você cadastra o vendedor e cria o login dele."}
    >
      <div className="divide-y divide-slate-100">
        {lista.map((p) => (
          <div key={p.id} className="py-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[12rem]">
              <div className="text-sm font-medium text-slate-900">{p.nome}</div>
              <div className="text-xs text-slate-500">
                {p.contato}{!ehVendedor && ` · indicado por ${p.vendedorNome} · ${fmtDate(p.data)}`}{p.obs && ` · ${p.obs}`}
              </div>
            </div>
            {ehVendedor ? (
              <span className={`text-xs font-medium ${cor[p.status] || ""}`}>{p.status === "Pendente" ? "Aguardando o dono" : p.status}</span>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { if (window.confirm(`Recusar a indicação de "${p.nome}"?`)) responderIndicacao(p.id, "Recusado"); }} className="text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-md px-2.5 py-1">Recusar</button>
                <button onClick={() => abrirModal("vendedor", { nome: p.nome, contato: p.contato, indicadoPor: p.vendedorId, indicacao: p })} className={btnContorno}>Aprovar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Cartao>
  );
}
