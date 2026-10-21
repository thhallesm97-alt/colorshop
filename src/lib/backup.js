// Backup automático: uma cópia completa dos dados por dia, guardada neste computador
// (IndexedDB). Ficam as últimas 30. Na nuvem, o Supabase faz o próprio backup diário.

import { createStore, get, set, del, keys } from "idb-keyval";

const loja = createStore("shopping25-backups", "backups");
const MANTER = 30;

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Guarda a cópia de hoje, se ainda não houver. Devolve true quando gravou.
export async function backupDoDia(dados) {
  const dia = hojeISO();
  if (await get(dia, loja).catch(() => null)) return false;
  await set(dia, { dia, criadoEm: new Date().toISOString(), dados }, loja);
  const dias = (await keys(loja)).map(String).sort();
  for (const antigo of dias.slice(0, Math.max(0, dias.length - MANTER))) await del(antigo, loja);
  return true;
}

// Lista do mais novo para o mais antigo: [{ dia, criadoEm, registros }].
export async function listarBackups() {
  const dias = (await keys(loja).catch(() => [])).map(String).sort().reverse();
  const out = [];
  for (const dia of dias) {
    const b = await get(dia, loja);
    if (!b) continue;
    const registros = Object.values(b.dados || {}).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
    out.push({ dia, criadoEm: b.criadoEm, registros });
  }
  return out;
}

export async function obterBackup(dia) {
  return (await get(dia, loja))?.dados || null;
}
