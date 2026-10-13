// Fornecedores: lista de produtos de cada um, cadastro em massa pela lista que ele manda,
// compras (à vista, a prazo, consignado) e acerto do consignado.

import React, { useMemo, useRef, useState } from "react";
import { Upload, Pencil, Plus, ShoppingCart, Undo2 } from "lucide-react";
import { useApp, CAIXA_META, produtoCombina, descricaoProduto, ehDeFornecedor } from "./contexto.js";
import { fmtUSD, fmtDate, normalizar, todayISO, isoLocal } from "./lib/format.js";
import { Modal, Field, inputCls, btnPrimario, btnSecundario, btnIcone, Segmentado, Th, Td, Vazio } from "./ui.jsx";
import { LinkWhatsApp } from "./paginas.jsx";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Situação de uma compra

const CORES_CONDICAO = {
  "À vista": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "A prazo": "bg-sky-50 text-sky-700 ring-sky-600/20",
  Consignado: "bg-violet-50 text-violet-700 ring-violet-600/20",
  Devolução: "bg-slate-100 text-slate-600 ring-slate-500/20",
};
export function BadgeCondicao({ condicao }) {
  const c = condicao || "À vista";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${CORES_CONDICAO[c] || CORES_CONDICAO["À vista"]}`}>{c}</span>;
}

// Quanto ainda está consignado (não pago nem devolvido) numa compra.
export const restanteConsignado = (compra) =>
  (compra.itens || []).reduce((s, l) => s + Math.max(0, l.qtd - n(l.pago) - n(l.devolvido)) * l.custo, 0);

// Texto curto da situação e se ainda falta algo.
export function situacaoCompra(compra, contas, hoje = todayISO()) {
  const c = compra.condicao || "À vista";
  if (c === "Devolução") return { texto: "Devolvido ao fornecedor", aberto: false };
  if (c === "À vista") return { texto: compra.pagamento ? `Pago (${compra.pagamento})` : "Pago", aberto: false };
  if (c === "A prazo") {
    const pend = contas.filter((k) => k.compraId === compra.id && k.status === "Pendente").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (pend.length === 0) return { texto: "Pago", aberto: false };
    const falta = pend.reduce((s, k) => s + k.valor, 0);
    const prox = pend[0].vencimento;
    return { texto: `Falta ${fmtUSD(falta)} · vence ${fmtDate(prox)}`, aberto: true, atrasado: prox < hoje, falta };
  }
  const resto = restanteConsignado(compra);
  if (resto <= 0.004) return { texto: "Acertado", aberto: false };
  return {
    texto: `A acertar ${fmtUSD(resto)}${compra.dataAcerto ? ` · acerto ${fmtDate(compra.dataAcerto)}` : ""}`,
    aberto: true, atrasado: !!compra.dataAcerto && compra.dataAcerto < hoje, consignado: true, falta: resto,
  };
}

// ---------------------------------------------------------------------------
// Página/modal do fornecedor

export function FornecedorDetalheModal() {
  const { editando: f, estoque, compras, contas, abrirModal, fecharModal } = useApp();
  const [aba, setAba] = useState("produtos");
  const [busca, setBusca] = useState("");
  if (!f) return null;
  const voltar = { modal: "fornecedorDetalhe", item: f };
  const produtos = estoque.filter((i) => i.fornecedorId === f.id);
  const lista = produtos.filter((i) => produtoCombina(i, busca));
  const minhas = compras.filter((c) => c.fornecedorId === f.id);
  const comprado = minhas.reduce((s, c) => s + n(c.total), 0);
  const idsCompras = new Set(minhas.map((c) => c.id));
  const aPagar = contas.filter((k) => k.status === "Pendente" && (k.fornecedorId === f.id || idsCompras.has(k.compraId))).reduce((s, k) => s + k.valor, 0);
  const consignado = minhas.filter((c) => c.condicao === "Consignado").reduce((s, c) => s + restanteConsignado(c), 0);

  return (
    <Modal title={f.nome} onClose={fecharModal} wide>
      <div className="flex items-center justify-between gap-3 -mt-2 mb-4 text-sm text-slate-500">
        <span>{[f.contato, f.obs].filter(Boolean).join(" · ") || "Sem contato"}</span>
        <LinkWhatsApp contato={f.contato} texto={`Olá, tudo bem? Aqui é da Indufarma.`} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Numero rotulo="Produtos" valor={produtos.length} />
        <Numero rotulo="Total comprado" valor={fmtUSD(comprado)} />
        <Numero rotulo="A pagar" valor={fmtUSD(aPagar)} tom={aPagar > 0 ? "text-amber-700" : ""} />
        <Numero rotulo="Em consignação" valor={fmtUSD(consignado)} tom={consignado > 0 ? "text-violet-700" : ""} />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <Segmentado valor={aba} onChange={setAba} opcoes={[{ valor: "produtos", label: `Produtos (${produtos.length})` }, { valor: "compras", label: `Compras (${minhas.length})` }]} />
        <div className="flex items-center gap-2">
          {aba === "produtos" && (
            <button onClick={() => abrirModal("importarProdutos", f, voltar)} className={btnSecundario}><Upload size={14} /> Importar lista</button>
          )}
          <button onClick={() => abrirModal("compra", { fornecedorId: f.id }, voltar)} className={btnPrimario}><ShoppingCart size={14} /> Nova compra</button>
        </div>
      </div>

      {aba === "produtos" && (
        <>
          {produtos.length > 0 && (
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." className={inputCls + " mb-3"} />
          )}
          <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-100">
                  <Th>Produto</Th><Th>Onde fica</Th><Th right>Custo</Th><Th right>Varejo</Th><Th right>Atacado</Th><Th right>Lojista</Th><Th right></Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50">
                    <Td className="text-slate-900">
                      {i.nome}
                      {descricaoProduto(i) && <div className="text-xs text-slate-400">{descricaoProduto(i)}</div>}
                    </Td>
                    <Td className="text-slate-500 whitespace-nowrap">{ehDeFornecedor(i) ? "Sob encomenda" : `Estoque: ${i.qtd}`}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(i.custo)}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(i.varejo)}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(i.atacado)}</Td>
                    <Td right className="whitespace-nowrap">{fmtUSD(i.lojista)}</Td>
                    <Td right><button onClick={() => abrirModal("item", i, voltar)} className={btnIcone} title="Editar produto"><Pencil size={15} /></button></Td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <Vazio colSpan={7}>{produtos.length === 0 ? "Nenhum produto deste fornecedor. Use “Importar lista” para cadastrar todos de uma vez." : "Nenhum resultado."}</Vazio>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === "compras" && <ListaCompras compras={minhas} voltar={voltar} semFornecedor />}
    </Modal>
  );
}

function Numero({ rotulo, valor, tom = "" }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`font-semibold tabular-nums ${tom || "text-slate-900"}`}>{valor}</div>
    </div>
  );
}

// Tabela de compras (usada na página Compras e dentro do fornecedor).
export function ListaCompras({ compras, voltar = null, semFornecedor = false }) {
  const { contas, abrirModal } = useApp();
  const hoje = todayISO();
  return (
    <div className="border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Data</Th>{!semFornecedor && <Th>Fornecedor</Th>}<Th>Itens</Th><Th>Tipo</Th><Th>Situação</Th><Th right>Total</Th><Th right></Th>
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => {
            const s = situacaoCompra(c, contas, hoje);
            return (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <Td className="text-slate-600 whitespace-nowrap">{fmtDate(c.data)}</Td>
                {!semFornecedor && <Td className="font-medium text-slate-900">{c.fornecedorNome}</Td>}
                <Td className="text-slate-600">
                  {(c.itens || []).map((l, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                      {l.nome} × {Math.abs(l.qtd)} <span className="text-xs text-slate-400">({fmtUSD(l.custo)} un.)</span>
                      {c.condicao === "Consignado" && (n(l.pago) > 0 || n(l.devolvido) > 0) && (
                        <span className="text-xs text-violet-700"> · pagos {n(l.pago)}, devolvidos {n(l.devolvido)}</span>
                      )}
                    </div>
                  ))}
                </Td>
                <Td><BadgeCondicao condicao={c.condicao} /></Td>
                <Td className={s.atrasado ? "text-red-600 font-medium" : s.aberto ? "text-amber-700" : "text-slate-500"}>{s.texto}</Td>
                <Td right className="font-medium text-slate-900 whitespace-nowrap">{fmtUSD(c.total)}</Td>
                <Td right>
                  {s.consignado && (
                    <button onClick={() => abrirModal("acerto", c, voltar)} className="text-xs font-medium text-violet-700 border border-violet-200 hover:bg-violet-50 rounded-md px-2 py-1 whitespace-nowrap">
                      Fazer acerto
                    </button>
                  )}
                </Td>
              </tr>
            );
          })}
          {compras.length === 0 && <Vazio colSpan={semFornecedor ? 6 : 7}>Nenhuma compra registrada.</Vazio>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Importar a lista de produtos do fornecedor

// Número escrito de vários jeitos: "2,50", "2.50", "US$ 1.234,50", "$1,234.50".
export function lerNumero(txt) {
  let t = String(txt ?? "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(t)) return NaN;
  const v = t.lastIndexOf(","), p = t.lastIndexOf(".");
  if (v >= 0 && p >= 0) t = v > p ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (v >= 0) t = t.replace(/\./g, "").replace(",", ".");
  return Number(t);
}

const COLUNAS = [
  ["custoVendedor", /vendedor/],
  ["varejo", /varejo|minorista|consumidor|publico|público/],
  ["atacado", /atacado|mayorista|por mayor/],
  ["lojista", /lojista|revend|tienda|loja/],
  ["marca", /marca|laborat|fabric/],
  ["tipo", /tipo|categ|grupo|clase|linha|linea/],
  ["nome", /nome|produto|producto|descri|item|articulo|artículo/],
  ["custo", /custo|costo|compra|preco|preço|precio|valor|price|unit/],
];

// Lê a lista colada (do Excel, de um CSV ou de uma mensagem de WhatsApp).
// Com cabeçalho, usa os nomes das colunas. Sem cabeçalho: o 1º texto é o nome, os números
// são custo, varejo, atacado e lojista, e os outros textos são marca e tipo.
// Linha sem separador ("Dipirona 500mg ..... 0,90") usa o último número como custo.
export function lerListaProdutos(texto) {
  const linhas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0) return [];
  const sep = linhas.some((l) => l.includes("\t")) ? "\t" : linhas.some((l) => l.includes(";")) ? ";" : linhas.some((l) => l.includes("|")) ? "|" : ",";
  const dividir = (l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
  const primeira = dividir(linhas[0]).map((c) => normalizar(c));
  const temCabecalho = primeira.length > 1 && primeira.some((c) => /nome|produto|producto|descri/.test(c)) && primeira.every((c) => !/\d+[.,]\d/.test(c));
  let mapa = null;
  if (temCabecalho) {
    mapa = primeira.map((c) => (COLUNAS.find(([, re]) => re.test(c)) || [null])[0]);
    // Só uma coluna de cada.
    mapa = mapa.map((k, i) => (k && mapa.indexOf(k) === i ? k : null));
  }
  const dados = temCabecalho ? linhas.slice(1) : linhas;
  return dados.map((l) => {
    let cel = dividir(l);
    const o = {};
    if (mapa && cel.length > 1) {
      cel.forEach((c, i) => {
        const k = mapa[i];
        if (!k || c === "") return;
        o[k] = ["nome", "marca", "tipo"].includes(k) ? c : lerNumero(c);
      });
    } else {
      if (cel.length === 1) {
        const m = l.match(/^(.*?)[\s.:\-–=]*(?:US\$|U\$|\$|Gs\.?|R\$)?\s*(\d[\d.,]*)\s*$/i);
        cel = m ? [m[1].replace(/[\s.:\-–=]+$/, ""), m[2]] : [l];
      }
      const textos = [], nums = [];
      for (const c of cel) {
        if (c === "") continue;
        if (/^[^a-zA-Z]*\d[^a-zA-Z]*$/.test(c) || /^(US\$|U\$|\$|R\$)\s*\d/i.test(c)) nums.push(lerNumero(c));
        else textos.push(c);
      }
      [o.nome, o.marca, o.tipo] = textos;
      [o.custo, o.varejo, o.atacado, o.lojista] = nums;
    }
    for (const k of ["custo", "varejo", "atacado", "lojista", "custoVendedor"]) if (!Number.isFinite(o[k])) delete o[k];
    return o;
  });
}

const EXEMPLO = `Produto;Marca;Tipo;Custo;Varejo;Atacado;Lojista
Dipirona 500mg (10 comp.);Prati-Donaduzzi;Analgésico;0,90;2,50;2,00;1,80
Vitamina C 1g (10 eferv.);Cimed;Vitamina;1,40
Fralda Geriátrica G (8 un.);Bigfral;Higiene;5,20;9,90`;

export function ImportarProdutosModal() {
  const { editando: f, estoque, importarProdutos, fecharModal } = useApp();
  const [texto, setTexto] = useState("");
  const [origem, setOrigem] = useState("fornecedor");
  const [margem, setMargem] = useState({ varejo: 60, atacado: 40, lojista: 30 });
  const [desmarcados, setDesmarcados] = useState(() => new Set());
  const [feito, setFeito] = useState(null);
  const arquivo = useRef(null);

  const linhas = useMemo(() => {
    const porNome = new Map(estoque.map((i) => [normalizar(i.nome), i]));
    return lerListaProdutos(texto).map((o, idx) => {
      const existente = o.nome ? porNome.get(normalizar(o.nome)) : null;
      const erro = !o.nome ? "Sem nome" : !(o.custo > 0) && !existente ? "Sem custo" : null;
      const calc = (campo) => (o[campo] > 0 ? o[campo] : o.custo > 0 && !existente ? r2(o.custo * (1 + n(margem[campo]) / 100)) : undefined);
      return {
        idx, existente, erro, calculado: { varejo: !(o.varejo > 0), atacado: !(o.atacado > 0), lojista: !(o.lojista > 0) },
        dados: { ...o, varejo: calc("varejo"), atacado: calc("atacado"), lojista: calc("lojista") },
      };
    });
  }, [texto, estoque, margem]);
  const validas = linhas.filter((l) => !l.erro && !desmarcados.has(l.idx));
  const novos = validas.filter((l) => !l.existente).length;

  function lerArquivo(e) {
    const a = e.target.files?.[0];
    if (!a) return;
    const r = new FileReader();
    r.onload = () => setTexto(String(r.result || ""));
    r.readAsText(a);
    e.target.value = "";
  }
  function cadastrar() {
    const res = importarProdutos(f.id, validas.map((l) => l.dados), origem);
    setFeito(res);
  }
  const alternar = (idx) => setDesmarcados((s) => { const x = new Set(s); x.has(idx) ? x.delete(idx) : x.add(idx); return x; });

  if (feito) {
    return (
      <Modal title="Lista importada" onClose={fecharModal}>
        <p className="text-sm text-slate-700 mb-4">
          {feito.novos} {feito.novos === 1 ? "produto novo cadastrado" : "produtos novos cadastrados"}
          {feito.atualizados > 0 && ` e ${feito.atualizados} ${feito.atualizados === 1 ? "atualizado" : "atualizados"}`} para {f.nome}.
        </p>
        <button onClick={fecharModal} className={btnPrimario + " w-full"}>Ver produtos do fornecedor</button>
      </Modal>
    );
  }

  return (
    <Modal title={`Importar produtos de ${f?.nome || "fornecedor"}`} onClose={fecharModal} wide>
      <p className="text-sm text-slate-600 mb-3">
        Cole a lista que o fornecedor mandou: do Excel (selecione as colunas e copie), de um arquivo CSV ou de uma mensagem.
        Basta o nome e o custo de cada produto; marca, tipo e os três preços são opcionais.
      </p>
      <textarea
        value={texto} onChange={(e) => { setTexto(e.target.value); setDesmarcados(new Set()); }} rows={6}
        placeholder={"Dipirona 500mg (10 comp.)\t0,90\nVitamina C 1g ........ 1,40\n..."}
        className={inputCls + " font-mono text-xs mb-2"}
      />
      <div className="flex items-center gap-3 mb-4 text-sm">
        <button type="button" onClick={() => arquivo.current?.click()} className={btnSecundario}><Upload size={14} /> Abrir arquivo CSV</button>
        <input ref={arquivo} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={lerArquivo} className="hidden" />
        <button type="button" onClick={() => setTexto(EXEMPLO)} className="text-emerald-700 hover:underline">Ver exemplo</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-2">
        <Field label="Produtos novos ficam">
          <Segmentado valor={origem} onChange={setOrigem} opcoes={[{ valor: "fornecedor", label: "No fornecedor (sob encomenda)" }, { valor: "estoque", label: "No meu estoque" }]} />
        </Field>
        <Field label="Preço que faltar: custo + margem (%)" hint="Só para produtos novos. Os já cadastrados mantêm o preço que têm.">
          <div className="grid grid-cols-3 gap-2">
            {["varejo", "atacado", "lojista"].map((k) => (
              <label key={k} className="text-xs text-slate-500">
                {k[0].toUpperCase() + k.slice(1)}
                <input type="number" min="0" step="1" value={margem[k]} onChange={(e) => setMargem((m) => ({ ...m, [k]: e.target.value }))} className={inputCls + " mt-1"} />
              </label>
            ))}
          </div>
        </Field>
      </div>

      {linhas.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[40vh] overflow-y-auto mb-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-100">
                <Th></Th><Th>Produto</Th><Th right>Custo</Th><Th right>Varejo</Th><Th right>Atacado</Th><Th right>Lojista</Th><Th>Situação</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const d = l.dados;
                const preco = (k) => (d[k] == null ? <span className="text-slate-300">mantém</span> : <span className={l.calculado[k] ? "text-slate-400" : ""}>{fmtUSD(d[k])}</span>);
                return (
                  <tr key={l.idx} className={"border-b border-slate-50 " + (l.erro || desmarcados.has(l.idx) ? "opacity-50" : "")}>
                    <Td><input type="checkbox" disabled={!!l.erro} checked={!l.erro && !desmarcados.has(l.idx)} onChange={() => alternar(l.idx)} aria-label={`Importar ${d.nome || "linha"}`} /></Td>
                    <Td className="text-slate-900 min-w-[14rem]">
                      {d.nome || <span className="text-slate-400">—</span>}
                      {(d.marca || d.tipo) && <div className="text-xs text-slate-400">{[d.marca, d.tipo].filter(Boolean).join(" · ")}</div>}
                    </Td>
                    <Td right className="whitespace-nowrap">{d.custo > 0 ? fmtUSD(d.custo) : <span className="text-slate-300">mantém</span>}</Td>
                    <Td right className="whitespace-nowrap">{preco("varejo")}</Td>
                    <Td right className="whitespace-nowrap">{preco("atacado")}</Td>
                    <Td right className="whitespace-nowrap">{preco("lojista")}</Td>
                    <Td className="whitespace-nowrap">
                      {l.erro ? <span className="text-red-600">{l.erro}</span> : l.existente ? <span className="text-sky-700">Atualiza</span> : <span className="text-emerald-700">Novo</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {linhas.length > 0 && <p className="text-xs text-slate-400 -mt-2 mb-4">Em cinza, os preços calculados pela margem.</p>}

      <button onClick={cadastrar} disabled={validas.length === 0} className={btnPrimario + " w-full"}>
        {validas.length === 0 ? "Cole a lista para continuar" : `Cadastrar ${validas.length} ${validas.length === 1 ? "produto" : "produtos"}${novos !== validas.length ? ` (${novos} novos)` : ""}`}
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Acerto do consignado

export function AcertoModal() {
  const { editando: compra, vendas, estoque, acertarConsignado, fecharModal } = useApp();
  const restantes = (compra?.itens || []).map((l) => Math.max(0, l.qtd - n(l.pago) - n(l.devolvido)));
  // Sugestão: o que foi vendido de cada produto desde a compra e ainda não foi pago.
  const vendidos = useMemo(() => (compra?.itens || []).map((l) =>
    vendas.filter((v) => (v.data || "") >= (compra.data || "")).reduce((s, v) => s + (v.itens || []).filter((x) => x.itemId === l.itemId).reduce((a, x) => a + n(x.qtd), 0), 0)
  ), [compra, vendas]);
  const sugestao = vendidos.map((v, i) => Math.min(restantes[i], Math.max(0, v - n(compra.itens[i].pago))));
  const [linhas, setLinhas] = useState(() => (compra?.itens || []).map((l, i) => ({ pagar: sugestao[i] || 0, devolver: 0 })));
  const [forma, setForma] = useState("agora");
  const [caixaKey, setCaixaKey] = useState("pix");
  const [vencimento, setVencimento] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 15); return isoLocal(d); });
  if (!compra) return null;

  const mudar = (i, k, v) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: Math.max(0, Math.floor(n(v))) } : l)));
  const invalido = linhas.some((l, i) => l.pagar + l.devolver > restantes[i]);
  const valor = compra.itens.reduce((s, l, i) => s + linhas[i].pagar * l.custo, 0);
  const algo = linhas.some((l) => l.pagar > 0 || l.devolver > 0);
  const devolverResto = () => setLinhas((ls) => ls.map((l, i) => ({ ...l, devolver: Math.max(0, restantes[i] - l.pagar) })));

  return (
    <Modal title={`Acerto do consignado · ${compra.fornecedorNome}`} onClose={fecharModal} wide>
      <p className="text-sm text-slate-600 mb-3">
        Compra de {fmtDate(compra.data)}. Para cada produto, diga quantos você paga (os vendidos) e quantos devolve. O que sobrar continua consignado.
      </p>
      <div className="border border-slate-200 rounded-lg overflow-x-auto mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th>Produto</Th><Th right>Consignado</Th><Th right>Vendidos desde a compra</Th><Th right>Pagar</Th><Th right>Devolver</Th>
            </tr>
          </thead>
          <tbody>
            {compra.itens.map((l, i) => {
              const noEstoque = estoque.find((x) => x.id === l.itemId)?.qtd ?? 0;
              const erro = linhas[i].pagar + linhas[i].devolver > restantes[i];
              const semEstoque = linhas[i].devolver > noEstoque;
              return (
                <tr key={i} className="border-b border-slate-50">
                  <Td className="text-slate-900">
                    {l.nome}
                    <div className="text-xs text-slate-400">{fmtUSD(l.custo)} un. · {noEstoque} no estoque agora</div>
                    {semEstoque && <div className="text-xs text-amber-700">Devolvendo mais do que tem no estoque.</div>}
                  </Td>
                  <Td right className="tabular-nums">{restantes[i]}</Td>
                  <Td right className="tabular-nums text-slate-500">{vendidos[i]}</Td>
                  <Td right>
                    <input type="number" min="0" step="1" disabled={restantes[i] === 0} value={linhas[i].pagar} onChange={(e) => mudar(i, "pagar", e.target.value)} className={"w-20 border rounded-md px-2 py-1 text-right " + (erro ? "border-red-400" : "border-slate-200")} aria-label={`Pagar ${l.nome}`} />
                  </Td>
                  <Td right>
                    <input type="number" min="0" step="1" disabled={restantes[i] === 0} value={linhas[i].devolver} onChange={(e) => mudar(i, "devolver", e.target.value)} className={"w-20 border rounded-md px-2 py-1 text-right " + (erro ? "border-red-400" : "border-slate-200")} aria-label={`Devolver ${l.nome}`} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mb-4 text-sm">
        {invalido ? <span className="text-red-600">Pagar + devolver passa do que está consignado.</span> : <span />}
        <button type="button" onClick={devolverResto} className="text-violet-700 hover:underline inline-flex items-center gap-1"><Undo2 size={14} /> Devolver todo o resto</button>
      </div>

      {valor > 0 && (
        <>
          <Field label="Pagamento">
            <Segmentado valor={forma} onChange={setForma} opcoes={[{ valor: "agora", label: "Pagar agora" }, { valor: "prazo", label: "A prazo" }]} />
          </Field>
          {forma === "agora" ? (
            <Field label="Pagar com">
              <select className={inputCls} value={caixaKey} onChange={(e) => setCaixaKey(e.target.value)}>
                {Object.entries(CAIXA_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Vencimento" hint="Vai para Contas a pagar."><input type="date" className={inputCls} value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
          )}
        </>
      )}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 mb-4">
        <span className="text-sm text-slate-500">Valor a pagar ao fornecedor</span>
        <span className="text-lg font-semibold text-slate-900">{fmtUSD(valor)}</span>
      </div>
      <button
        onClick={() => { acertarConsignado(compra.id, { linhas, forma, caixaKey, vencimento }); fecharModal(); }}
        disabled={invalido || !algo}
        className={btnPrimario + " w-full"}
      >
        Confirmar acerto
      </button>
    </Modal>
  );
}
