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
