import type { PttTx } from "@/lib/ptt";

const DB_NAME = "apex-cb-local-recordings";
const STORE = "grille";
const KEY = "current";
export const GRILLE_LIMIT = 8;
export type VoiceClip = Pick<PttTx, "id" | "from" | "ts" | "body" | "ch">;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Local recording storage unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readVoiceGrille(): Promise<VoiceClip[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result as VoiceClip[] : []);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export async function cacheVoiceGrille(clips: VoiceClip[]): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(clips, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

/** A portable JSON file preserves each original audio data URL and timestamp. */
export function downloadVoiceGrille(clips: VoiceClip[]): void {
  if (!clips.length) throw new Error("No recordings to save");
  const blob = new Blob([JSON.stringify({ format: "apex-cb-voice-v1", clips }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `sovereign-cb-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
