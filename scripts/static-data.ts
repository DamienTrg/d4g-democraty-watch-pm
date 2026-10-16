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
  const { findPlf, getTexteIndex, getArticleAmendements, decouperEnPages } =
    await import("../src/lib/textes");

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

    // Textes à publier article par article : STATIC_TEXTES=uid1,uid2…
    // ou, par défaut, le PLF le plus récent (2026, sinon 2025).
    const textes: { uid: string; titre: string }[] = [];
    let uids = (process.env.STATIC_TEXTES ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (uids.length === 0) {
      const plf = (await findPlf(2026)) ?? (await findPlf(2025));
      uids = plf ? [plf.uid] : [];
    }
    for (const uid of uids) {
      try {
        console.log(`Export du texte ${uid}…`);
        const index = (await getTexteIndex(uid)).data;
        const pages: Record<string, unknown[][]> = {};
        // Quelques requêtes en parallèle, pas plus, pour ménager la base.
        const taches = index.articles.flatMap((article) =>
          decouperEnPages(article).map((_, i) => ({ article, page: i + 1 })),
        );
        let fait = 0;
        const travailleur = async () => {
          for (let t = taches.shift(); t; t = taches.shift()) {
            const liste = (await getArticleAmendements(uid, t.article, t.page))
              .data;
            (pages[t.article.id] ??= [])[t.page - 1] = liste;
            fait++;
          }
        };
        const total = taches.length;
        const suivi = setInterval(
          () => console.log(`  ${fait}/${total} pages`),
          5000,
        );
        await Promise.all(Array.from({ length: 4 }, travailleur));
        clearInterval(suivi);

        const dir = path.join("docs", "textes", uid);
        await mkdir(dir, { recursive: true });
        await writeFile(
          path.join(dir, "donnees.json"),
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            index,
            pages,
          }),
        );
        textes.push({ uid, titre: index.titre });
        console.log(
          `✓ ${index.titre} : ${index.total} amendements → ${dir}/donnees.json`,
        );
      } catch (error) {
        console.error(
          `✗ Export du texte ${uid} impossible :`,
          error instanceof Error ? error.message : error,
        );
        process.exitCode = 1;
      }
    }

    const out = path.join("docs", "donnees.json");
    await mkdir("docs", { recursive: true });
    await writeFile(
      out,
      JSON.stringify({ ...snapshot, textes }, null, 2) + "\n",
    );
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
