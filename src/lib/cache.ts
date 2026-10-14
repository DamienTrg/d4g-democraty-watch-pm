import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Cache des calculs coûteux, en mémoire ET sur disque (.cache/), pour
 * survivre aux redémarrages du serveur.
 *
 *  - Résultat de moins de `maxAgeMs` : servi tel quel, aucune requête en base.
 *  - Résultat plus ancien : servi immédiatement, et recalculé en arrière-plan
 *    (le visiteur n'attend pas ; la visite suivante a les chiffres frais).
 *  - Aucun résultat : calculé, puis enregistré.
 *  - Un échec n'est jamais enregistré ; s'il existe un ancien résultat, on le garde.
 *  - `version` (ex. le texte de la requête SQL) : si elle change, l'ancien
 *    résultat est ignoré — modifier une requête invalide donc son cache.
 */

export type Calcul<T> = { data: T; calculeLe: Date };

type Entry<T> = { version: string; calculeLe: string; data: T };

const CACHE_DIR = path.join(process.cwd(), ".cache", "stats");

const globalForCache = globalThis as unknown as {
  memo?: Map<string, Entry<unknown>>;
  inflight?: Map<string, Promise<Calcul<unknown>>>;
};
const memo = (globalForCache.memo ??= new Map());
const inflight = (globalForCache.inflight ??= new Map());

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const fileFor = (key: string) => path.join(CACHE_DIR, `${key}.json`);
const toCalcul = <T>(e: Entry<T>): Calcul<T> => ({ data: e.data, calculeLe: new Date(e.calculeLe) });

async function readEntry<T>(key: string, version: string): Promise<Entry<T> | undefined> {
  const inMemory = memo.get(key) as Entry<T> | undefined;
  if (inMemory?.version === version) return inMemory;
  try {
    const entry = JSON.parse(await readFile(fileFor(key), "utf8")) as Entry<T>;
    if (entry.version !== version) return undefined;
    memo.set(key, entry);
    return entry;
  } catch {
    return undefined; // pas de fichier, ou fichier illisible : on recalculera
  }
}

async function writeEntry<T>(key: string, entry: Entry<T>) {
  memo.set(key, entry);
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    // Écriture atomique : fichier temporaire puis renommage.
    const tmp = `${fileFor(key)}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(entry));
    await rename(tmp, fileFor(key));
  } catch (error) {
    // Disque en lecture seule (certains hébergements) : le cache mémoire suffit.
    console.warn(`[cache] écriture impossible pour « ${key} » :`, error);
  }
}

function refresh<T>(key: string, version: string, compute: () => Promise<T>): Promise<Calcul<T>> {
  const running = inflight.get(key) as Promise<Calcul<T>> | undefined;
  if (running) return running; // une seule requête à la fois par clé

  const promise = (async () => {
    const data = await compute();
    const entry: Entry<T> = { version, calculeLe: new Date().toISOString(), data };
    await writeEntry(key, entry);
    return toCalcul(entry);
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

export async function cachedOnDisk<T>(
  key: string,
  versionSource: string,
  maxAgeMs: number,
  compute: () => Promise<T>,
): Promise<Calcul<T>> {
  const version = hash(versionSource);
  const entry = await readEntry<T>(key, version);

  if (!entry) return refresh(key, version, compute);

  const age = Date.now() - new Date(entry.calculeLe).getTime();
  if (age >= maxAgeMs) {
    // Périmé : on sert l'ancien résultat et on recalcule en tâche de fond.
    refresh(key, version, compute).catch((error) =>
      console.warn(`[cache] recalcul de « ${key} » échoué, ancien résultat conservé :`, error),
    );
  }
  return toCalcul(entry);
}
