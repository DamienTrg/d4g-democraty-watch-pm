import Link from "next/link";
import { connection } from "next/server";
import { query } from "@/lib/db";

async function getDbStatus() {
  try {
    const [row] = await query<{ version: string }>("select version() as version");
    return { ok: true as const, version: row.version };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function Home() {
  // Rendu à chaque requête : on veut l'état réel de la base, pas une page figée au build.
  await connection();
  const status = await getDbStatus();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Democraty Watch</h1>
      <section className="rounded-lg border border-black/10 p-5 dark:border-white/15">
        <h2 className="mb-2 font-medium">Connexion à la base PostgreSQL</h2>
        {status.ok ? (
          <p className="text-green-700 dark:text-green-400">
            ✓ Connectée — {status.version}
          </p>
        ) : (
          <p className="text-red-700 dark:text-red-400">✗ Échec : {status.message}</p>
        )}
      </section>
      <Link
        href="/statistiques"
        className="self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
      >
        Voir les statistiques des textes de loi →
      </Link>
    </main>
  );
}
