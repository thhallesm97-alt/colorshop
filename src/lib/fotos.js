// Fotos dos produtos.
//
// Cada foto fica guardada neste computador (IndexedDB), então aparece mesmo sem internet.
// Com a nuvem configurada, ela também é enviada para o Storage do Supabase, de onde os
// outros computadores a buscam e de onde sai o link que vai para o cliente.

import { useEffect, useState } from "react";
import { createStore, get, set, del, keys } from "idb-keyval";

const fotos = createStore("shopping25-fotos", "fotos");
const pendentes = createStore("shopping25-fotos-pendentes", "pendentes");
export const BUCKET = "fotos-produtos";
const SB_URL = import.meta.env.VITE_SUPABASE_URL;

const LADO_MAX = 1200;
const QUALIDADE = 0.82;

// Endereço público da foto na nuvem (vai no link para o cliente). Sem nuvem, não há link.
export function urlPublica(id) {
  if (!id || !SB_URL) return null;
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${id}.jpg`;
}

// Reduz a foto para no máximo 1200px e salva em JPEG, para ocupar pouco espaço.
export async function comprimir(arquivo) {
  const img = await new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error("Não foi possível abrir esta imagem."));
    i.src = URL.createObjectURL(arquivo);
  });
  const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
}

const urls = new Map(); // id -> object URL já criado
const ouvintes = new Set();

// Guarda a foto neste computador e marca para enviar à nuvem. Devolve o id da foto.
export async function salvarFoto(blob, id = crypto.randomUUID()) {
  await set(id, blob, fotos);
  await set(id, 1, pendentes);
  urls.delete(id);
  ouvintes.forEach((fn) => fn(id));
  return id;
}

// A foto como arquivo (para compartilhar ou copiar). Busca na nuvem se não estiver aqui.
export async function obterFoto(id) {
  if (!id) return null;
  const local = await get(id, fotos).catch(() => null);
  if (local) return local;
  const url = urlPublica(id);
  if (!url || !navigator.onLine) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    await set(id, blob, fotos);
    return blob;
  } catch (e) {
    return null;
  }
}

// Endereço para mostrar a foto na tela.
export function useFoto(id) {
  const [url, setUrl] = useState(() => (id ? urls.get(id) || null : null));
  useEffect(() => {
    let vivo = true;
    async function carregar() {
      if (!id) return setUrl(null);
      if (urls.has(id)) return setUrl(urls.get(id));
      const blob = await get(id, fotos).catch(() => null);
      if (!vivo) return;
      if (blob) {
        const u = URL.createObjectURL(blob);
        urls.set(id, u);
        setUrl(u);
      } else {
        // Ainda não veio para este computador: mostra direto da nuvem.
        setUrl(urlPublica(id));
      }
    }
    carregar();
    const fn = (alterada) => alterada === id && carregar();
    ouvintes.add(fn);
    return () => {
      vivo = false;
      ouvintes.delete(fn);
    };
  }, [id]);
  return url;
}

// Envia para a nuvem as fotos tiradas neste computador. Chamado durante a sincronização.
export async function enviarFotosPendentes(sb) {
  const ids = await keys(pendentes);
  for (const id of ids) {
    const blob = await get(id, fotos);
    if (!blob) {
      await del(id, pendentes);
      continue;
    }
    const { error } = await sb.storage.from(BUCKET).upload(`${id}.jpg`, blob, { contentType: "image/jpeg", upsert: false });
    // "Já existe" quer dizer que outro envio já levou esta foto.
    if (error && !/exist|duplicate/i.test(error.message || "")) throw error;
    await del(id, pendentes);
  }
}

// Copia a foto para colar no WhatsApp (Ctrl+V). A área de transferência só aceita PNG.
export async function copiarFoto(blob) {
  const img = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const png = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

// Abre a janela de compartilhar do computador ou celular (WhatsApp aparece na lista).
export function podeCompartilhar(blob) {
  try {
    const f = new File([blob], "foto.jpg", { type: "image/jpeg" });
    return !!navigator.canShare?.({ files: [f] });
  } catch (e) {
    return false;
  }
}
export async function compartilharFoto(blob, nome, texto) {
  const f = new File([blob], (nome || "foto").replace(/[^\w\-]+/g, "_") + ".jpg", { type: "image/jpeg" });
  await navigator.share({ files: [f], text: texto });
}
