import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Un seul pool partagé par toute l'app. En développement, Next.js recharge
// les modules à chaud : on garde le pool sur globalThis pour ne pas ouvrir
// une nouvelle série de connexions à chaque modification de fichier.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL n'est pas défini. Copiez .env.example en .env.local et renseignez-le.",
    );
  }

  // La plupart des bases hébergées exigent SSL. Mettez DATABASE_SSL=false
  // pour une base locale sans SSL.
  const useSsl = process.env.DATABASE_SSL !== "false";

  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = createPool();
  }
  return globalForDb.pgPool;
}

/** Exécute une requête paramétrée : query("select * from t where id = $1", [id]) */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/**
 * Comme query(), mais pour les requêtes d'analyse longues : relève le délai
 * maximal d'exécution le temps d'une transaction (SET LOCAL), sans modifier
 * le réglage de la base. Fonctionne aussi derrière un pooler (PgBouncer…).
 */
export async function longQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  timeoutMs = Number(process.env.DATABASE_LONG_QUERY_TIMEOUT_MS ?? 300_000),
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query("begin read only");
    await client.query(
      `set local statement_timeout = ${Math.max(0, Math.floor(timeoutMs))}`,
    );
    const result = await client.query<T>(text, params);
    await client.query("commit");
    return result.rows;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
