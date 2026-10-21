// Banco local (IndexedDB) com sincronização opcional no Supabase.
//
// Tudo é gravado primeiro neste computador, então o sistema funciona sem internet.
// Quando há internet e a pessoa entrou na conta, as mudanças são enviadas para a nuvem
// e as mudanças feitas no outro computador são trazidas. Cada registro (um produto, uma
// venda, um cliente...) é sincronizado separadamente; se o mesmo registro for alterado nos
// dois computadores, vale a alteração mais recente.

import { createStore, entries, setMany, set, clear } from "idb-keyval";
import { createClient } from "@supabase/supabase-js";
import { enviarFotosPendentes } from "./fotos.js";

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
  historico: "desc",
  fechamentos: "desc",
  config: "asc",
};

const store = createStore("shopping25", "registros");
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

const estado = { sincronizando: false, ultimaSync: null, erro: null, erroLocal: null, acesso: lerAcessoSalvo() };

// Quem está usando: "dono" vê tudo; "vendedor" vê só os próprios clientes e vendas.
// Fica guardado para o sistema abrir certo mesmo sem internet.
function lerAcessoSalvo() {
  try {
    return JSON.parse(localStorage.getItem("shopping25-acesso") || "null");
  } catch (e) {
    return null;
  }
}
function guardarAcesso(a) {
  estado.acesso = a;
  try {
    if (a) localStorage.setItem("shopping25-acesso", JSON.stringify(a));
    else localStorage.removeItem("shopping25-acesso");
  } catch (e) {
    /* opcional */
  }
}
const ouvintes = new Set();
let aoReceber = null;
let aoReiniciar = null;

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
// Chamado quando os dados deste computador são apagados (troca de login).
export function aoApagarLocal(fn) {
  aoReiniciar = fn;
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
let sessaoLida = false;
let timer = null;
let rodando = false;
let repetir = false;

function iniciarNuvem() {
  if (!SB_URL || !SB_KEY || sb) return;
  sb = createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "shopping25-login" },
  });
  sb.auth.getSession().then(({ data }) => {
    sessao = data.session;
    sessaoLida = true;
    avisar();
    sincronizar();
  });
  sb.auth.onAuthStateChange((_evento, s) => {
    const entrou = !sessao && s;
    sessao = s;
    if (!s) guardarAcesso(null);
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
    sessaoLida,
    email: sessao?.user?.email || null,
    pendentes,
    ...estado,
    papel: !sb ? "dono" : estado.acesso?.papel || null,
    vendedorId: estado.acesso?.vendedorId || null,
  };
}

// Login por usuário: "joao" entra como joao@shopping25.app. Quem digitar um e-mail usa o e-mail.
export const DOMINIO_LOGIN = "shopping25.app";
export const emailDeLogin = (usuario) => {
  const u = String(usuario || "").trim().toLowerCase();
  return !u ? "" : u.includes("@") ? u : `${u}@${DOMINIO_LOGIN}`;
};
export const nomeDeLogin = (email) => String(email || "").replace(new RegExp(`@${DOMINIO_LOGIN.replace(".", "\\.")}$`, "i"), "");

export async function entrar(usuario, senha) {
  if (!sb) throw new Error("Sincronização não configurada.");
  const { error } = await sb.auth.signInWithPassword({ email: emailDeLogin(usuario), password: senha });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Usuário ou senha incorretos." : error.message);
}

// O dono cria o login de um vendedor, ou troca a senha dele.
export async function definirLogin(usuario, senha) {
  if (!sb) throw new Error("A nuvem não está configurada neste sistema.");
  if (!navigator.onLine) throw new Error("Precisa de internet para criar ou trocar a senha.");
  const { error } = await sb.rpc("definir_login", { p_usuario: usuario, p_senha: senha });
  if (error) throw new Error(error.message);
}

// Ao sair, os dados deste computador são apagados (ficam na nuvem), para que outra pessoa
// que entre aqui não veja o que não deve. Antes, tudo precisa ter sido enviado.
export async function sair() {
  if (!sb) return;
  await sincronizar();
  const pendentes = status().pendentes;
  if (pendentes > 0) {
    throw new Error(`Ainda há ${pendentes} alteração(ões) não enviada(s) para a nuvem. Conecte à internet e tente de novo.`);
  }
  await sb.auth.signOut();
  await esvaziarLocal();
}

async function esvaziarLocal() {
  await clear(store);
  registros.clear();
  for (const k of Object.keys(snap)) delete snap[k];
  meta = { cursor: 0 };
  guardarAcesso(null);
  if (aoReiniciar) aoReiniciar();
  avisar();
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
    if (!(await conferirAcesso())) return;
    await enviar();
    if (estado.acesso.papel === "dono") {
      try {
        await enviarFotosPendentes(sb);
        estado.erroFotos = null;
      } catch (e) {
        console.error("Falha ao enviar fotos", e);
        estado.erroFotos = "Algumas fotos ainda não foram para a nuvem.";
      }
    }
    await receber();
    if (estado.acesso.papel === "vendedor") await receberEstoqueVendedor();
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

// Descobre se este login é do dono ou de um vendedor. Se outra pessoa entrou neste
// computador, apaga primeiro os dados da pessoa anterior.
async function conferirAcesso() {
  const email = sessao?.user?.email?.toLowerCase() || null;
  if (meta.email && email && meta.email !== email) await esvaziarLocal();
  const { data, error } = await sb.rpc("meu_acesso");
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha?.papel) {
    guardarAcesso({ papel: "sem_acesso", email });
    estado.erro = "Este login ainda não tem acesso. Peça ao dono para colocar seu e-mail no cadastro de vendedores.";
    return false;
  }
  const antes = estado.acesso;
  guardarAcesso({ papel: linha.papel, vendedorId: linha.vendedor_id || null, email });
  if (!meta.email) {
    meta = { ...meta, email };
    await set(META, meta, store);
  }
  if (!antes || antes.papel !== linha.papel || antes.vendedorId !== (linha.vendedor_id || null)) avisar();
  return true;
}

// O vendedor recebe o estoque já com a quantidade atual calculada e sem o custo real.
async function receberEstoqueVendedor() {
  const { data, error } = await sb.rpc("estoque_vendedor");
  if (error) throw error;
  const agora = Date.now();
  const vistos = new Set();
  const grava = [];
  for (const l of data || []) {
    const k = "estoque/" + l.id;
    vistos.add(k);
    const r = { c: "estoque", id: l.id, d: l.dados, u: agora, o: Number(l.criado_em), x: 0, p: 0 };
    registros.set(k, r);
    grava.push([k, r]);
  }
  for (const [k, r] of registros) {
    if (r.c === "estoque" && !r.x && !vistos.has(k)) {
      const n = { ...r, d: null, x: 1, p: 0, u: agora };
      registros.set(k, n);
      grava.push([k, n]);
    }
  }
  if (grava.length) await setMany(grava, store);
  if (aoReceber) aoReceber(["estoque"]);
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
