/*
 * Étape 1 de la page statique : calcule les statistiques depuis la base et
 * les enregistre dans docs/donnees.json (instantané publié avec la page).
 *
 * À lancer là où la base est accessible : npm run static
 * (utilise le cache de 24 h : rapide si les statistiques sont déjà calculées).
 *
 * Lancé avec --conditions=react-server pour pouvoir importer les modules
 * serveur de l'app (protégés par « server-only »).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // pas de .env.local : on suppose les variables déjà définies
  }

  const {
    getLoiStats,
    getAmendementStats,
    getIdentiquesStats,
    getCommissionStats,
  } = await import("../src/lib/stats");
  const { getPool } = await import("../src/lib/db");

  console.log(
    "Calcul des statistiques (peut prendre quelques minutes si le cache est vide)…",
  );

  try {
    const [lois, amendements, identiques, commissions] = await Promise.all([
      getLoiStats(),
      getAmendementStats(),
      getIdentiquesStats(),
      getCommissionStats(),
    ]);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      lois: { calculeLe: lois.calculeLe.toISOString(), data: lois.data },
      amendements: {
        calculeLe: amendements.calculeLe.toISOString(),
        data: amendements.data,
      },
      identiques: {
        calculeLe: identiques.calculeLe.toISOString(),
        data: identiques.data,
      },
      commissions: {
        calculeLe: commissions.calculeLe.toISOString(),
        data: commissions.data,
      },
    };

    const out = path.join("docs", "donnees.json");
    await mkdir("docs", { recursive: true });
    await writeFile(out, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(`✓ Données enregistrées dans ${out}`);
  } catch (error) {
    console.error(
      "✗ Calcul impossible :",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await getPool().end();
  }
}

main();
