// Banco local (IndexedDB) com sincronização opcional no Supabase.
//
// Tudo é gravado primeiro neste computador, então o sistema funciona sem internet.
// Quando há internet e a pessoa entrou na conta, as mudanças são enviadas para a nuvem
// e as mudanças feitas no outro computador são trazidas. Cada registro (um produto, uma
// venda, um cliente...) é sincronizado separadamente; se o mesmo registro for alterado nos
// dois computadores, vale a alteração mais recente.

import { createStore, entries, setMany, set, clear } from "idb-keyval";
import { createClient } from "@supabase/supabase-js";

// Ordem em que cada coleção é listada: "desc" = mais recente primeiro.
export const COLECOES = {
  estoque: "asc",
  vendas: "desc",
  compras: "desc",
  movimentos: "desc",
  clientes: "asc",
  fornecedores: "asc",
  contas: "asc",
  vendedores: "asc",
  orcamentos: "desc",
  freteiros: "asc",
  config: "asc",
};

const store = createStore("indufarma", "registros");
const META = "_meta";
const LOTE = 500;
// Relê alguns registros já vistos a cada sincronização, para não perder gravações
// que chegaram ao servidor fora de ordem.
const SOBREPOSICAO = 200;

const registros = new Map(); // "colecao/id" -> { c, id, d, u, o, x, p }
const snap = {}; // colecao -> Map(id -> objeto exibido na tela)
let meta = { cursor: 0 };
let ultimoO = 0;
const proximaOrdem = () => (ultimoO = Math.max(Date.now(), ultimoO + 1));

const estado = { sincronizando: false, ultimaSync: null, erro: null, erroLocal: null };
const ouvintes = new Set();
let aoReceber = null;

function avisar() {
  const s = status();
  ouvintes.forEach((fn) => fn(s));
}
export function ouvirStatus(fn) {
  ouvintes.add(fn);
  fn(status());
  return () => ouvintes.delete(fn);
}
export function aoReceberDaNuvem(fn) {
  aoReceber = fn;
}

function falhaLocal(e) {
  console.error("Falha ao gravar no computador", e);
  estado.erroLocal = "Não foi possível salvar neste computador. Verifique o espaço em disco.";
  avisar();
}

export async function abrir() {
  const todos = await entries(store);
  for (const [k, v] of todos) {
    if (k === META) meta = { ...meta, ...v };
    else registros.set(k, v);
  }
  // Pede ao navegador para não apagar os dados quando faltar espaço.
  try {
    await navigator.storage?.persist?.();
  } catch (e) {
    /* opcional */
  }
  iniciarNuvem();
  return { vazio: registros.size === 0 };
}

// Apaga tudo deste computador (usado só para reiniciar a demonstração).
export async function limpar() {
  await clear(store);
  registros.clear();
  meta = { cursor: 0 };
}

export function listar(col) {
  const arr = [];
  for (const r of registros.values()) if (r.c === col && !r.x) arr.push(r);
  const desc = COLECOES[col] === "desc";
  arr.sort((a, b) => (desc ? b.o - a.o : a.o - b.o));
  const m = new Map();
  const out = arr.map((r) => {
    m.set(r.id, r.d);
    return r.d;
  });
  snap[col] = m;
  return out;
}

// Registra um valor padrão como já conhecido, sem gravá-lo nem enviá-lo à nuvem.
// Assim um computador novo não sobrescreve os dados reais com valores de exemplo.
export function semear(col, d) {
  (snap[col] ||= new Map()).set(String(d.id), d);
}

// Compara a lista atual da tela com a última gravada e grava só o que mudou.
export function gravar(col, arr) {
  const ant = snap[col] || new Map();
  const novo = new Map();
  const mud = [];
  const agora = Date.now();
  for (const d of arr) {
    const id = String(d.id);
    novo.set(id, d);
    const a = ant.get(id);
    if (a === d || (a && JSON.stringify(a) === JSON.stringify(d))) continue;
    const k = col + "/" + id;
    const r0 = registros.get(k);
    const r = { c: col, id, d, u: Math.max(agora, (r0?.u || 0) + 1), o: r0?.o ?? proximaOrdem(), x: 0, p: 1 };
    registros.set(k, r);
    mud.push([k, r]);
  }
  for (const id of ant.keys()) {
    if (novo.has(id)) continue;
    const k = col + "/" + id;
    const r0 = registros.get(k);
    if (!r0 || r0.x) continue;
    const r = { c: col, id, d: null, u: Math.max(agora, r0.u + 1), o: r0.o, x: 1, p: 1 };
    registros.set(k, r);
    mud.push([k, r]);
  }
  snap[col] = novo;
  if (mud.length) {
    setMany(mud, store).catch(falhaLocal);
    agendarSync();
    avisar();
  }
}

// Importa listas inteiras (dados antigos do navegador ou arquivo de backup).
export async function importar(colecoes) {
  const agora = Date.now();
  const mud = [];
  for (const [col, arr] of Object.entries(colecoes)) {
    if (!(col in COLECOES) || !Array.isArray(arr)) continue;
    const desc = COLECOES[col] === "desc";
    const n = arr.length;
    arr.forEach((d, i) => {
      const id = String(d.id);
      const k = col + "/" + id;
      const r0 = registros.get(k);
      const r = { c: col, id, d, u: Math.max(agora, (r0?.u || 0) + 1), o: r0?.o ?? (desc ? n - i : i + 1), x: 0, p: 1 };
      registros.set(k, r);
      mud.push([k, r]);
    });
  }
  await setMany(mud, store);
  agendarSync();
  avisar();
  return mud.length;
}

// ---------------- Nuvem (Supabase) ----------------

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
let sb = null;
let sessao = null;
let timer = null;
let rodando = false;
let repetir = false;

function iniciarNuvem() {
  if (!SB_URL || !SB_KEY || sb) return;
  sb = createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "indufarma-login" },
  });
  sb.auth.getSession().then(({ data }) => {
    sessao = data.session;
    avisar();
    sincronizar();
  });
  sb.auth.onAuthStateChange((_evento, s) => {
    const entrou = !sessao && s;
    sessao = s;
    avisar();
    if (entrou) sincronizar();
  });
  window.addEventListener("online", () => {
    avisar();
    sincronizar();
  });
  window.addEventListener("offline", avisar);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sincronizar();
  });
  setInterval(sincronizar, 30000);
}

function agendarSync() {
  clearTimeout(timer);
  timer = setTimeout(sincronizar, 1500);
}

export function status() {
  let pendentes = 0;
  for (const r of registros.values()) if (r.p) pendentes++;
  return {
    configurado: !!sb,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    logado: !!sessao,
    email: sessao?.user?.email || null,
    pendentes,
    ...estado,
  };
}

export async function entrar(email, senha) {
  if (!sb) throw new Error("Sincronização não configurada.");
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
}

export async function sair() {
  if (sb) await sb.auth.signOut();
}

export async function sincronizar() {
  if (!sb || !sessao || !navigator.onLine) {
    avisar();
    return;
  }
  if (rodando) {
    repetir = true;
    return;
  }
  rodando = true;
  estado.sincronizando = true;
  avisar();
  try {
    await enviar();
    await receber();
    estado.ultimaSync = Date.now();
    estado.erro = null;
  } catch (e) {
    console.error("Falha na sincronização", e);
    estado.erro = e?.message || "Falha na sincronização.";
  } finally {
    rodando = false;
    estado.sincronizando = false;
    avisar();
    if (repetir) {
      repetir = false;
      sincronizar();
    }
  }
}

async function enviar() {
  const pend = [...registros.values()].filter((r) => r.p);
  for (let i = 0; i < pend.length; i += LOTE) {
    const lote = pend.slice(i, i + LOTE);
    const linhas = lote.map((r) => ({
      colecao: r.c,
      id: r.id,
      dados: r.d,
      excluido: !!r.x,
      atualizado_em: r.u,
      criado_em: r.o,
    }));
    const { error } = await sb.rpc("salvar_registros", { linhas });
    if (error) throw error;
    const limpos = [];
    for (const r of lote) {
      const k = r.c + "/" + r.id;
      const atual = registros.get(k);
      // Só marca como enviado se não mudou de novo enquanto enviava.
      if (atual && atual.u === r.u && atual.p) {
        const n = { ...atual, p: 0 };
        registros.set(k, n);
        limpos.push([k, n]);
      }
    }
    if (limpos.length) await setMany(limpos, store);
  }
}

async function receber() {
  let cursor = Math.max(0, (meta.cursor || 0) - SOBREPOSICAO);
  let maior = meta.cursor || 0;
  const cols = new Set();
  for (;;) {
    const { data, error } = await sb
      .from("registros")
      .select("colecao,id,dados,excluido,atualizado_em,criado_em,seq")
      .gt("seq", cursor)
      .order("seq")
      .limit(1000);
    if (error) throw error;
    if (!data.length) break;
    const grava = [];
    for (const l of data) {
      const seq = Number(l.seq);
      cursor = seq;
      maior = Math.max(maior, seq);
      if (!(l.colecao in COLECOES)) continue;
      const k = l.colecao + "/" + l.id;
      const local = registros.get(k);
      const u = Number(l.atualizado_em);
      if (local && local.u >= u) continue;
      const r = { c: l.colecao, id: l.id, d: l.excluido ? null : l.dados, u, o: Number(l.criado_em), x: l.excluido ? 1 : 0, p: 0 };
      registros.set(k, r);
      grava.push([k, r]);
      cols.add(l.colecao);
    }
    if (grava.length) await setMany(grava, store);
    if (data.length < 1000) break;
  }
  meta = { ...meta, cursor: maior };
  await set(META, meta, store);
  if (cols.size && aoReceber) aoReceber([...cols]);
}
