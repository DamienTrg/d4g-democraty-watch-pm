/*
 * Étape 2 de la page statique : génère docs/index.html à partir de
 * docs/donnees.json, avec les mêmes composants que l'app, puis la feuille de
 * style Tailwind (docs/styles.css). Aucun accès à la base ici.
 *
 * GitHub Pages : Settings → Pages → « Deploy from a branch » → main, /docs.
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AmendementsSection,
  CommissionsSection,
  formatDate,
  IdentiquesSection,
  LoisSection,
} from "../src/app/statistiques/sections";
import type {
  AmendementStats,
  CommissionStats,
  IdentiquesStats,
  LoiStats,
} from "../src/lib/stats";

type Snap<T> = { calculeLe: string; data: T };
type Snapshot = {
  generatedAt: string;
  lois: Snap<LoiStats>;
  amendements: Snap<AmendementStats>;
  identiques: Snap<IdentiquesStats>;
  /** Absent des instantanés générés avant l'ajout de cette section. */
  commissions?: Snap<CommissionStats>;
};

const DOCS = "docs";

function CalculeLe({ title, iso }: { title: string; iso: string }) {
  return (
    <p className="-mt-8 text-xs text-muted">
      {title} · calculé le {formatDate(new Date(iso))}
    </p>
  );
}

function StaticPage({ snapshot }: { snapshot: Snapshot }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">Democraty Watch · DataForGood</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Statistiques des textes de loi
        </h1>
        <p className="text-sm text-muted">
          Instantané du {formatDate(new Date(snapshot.generatedAt))}.
        </p>
      </header>

      <LoisSection lois={snapshot.lois.data} />
      <CalculeLe title="Lois et articles" iso={snapshot.lois.calculeLe} />

      {snapshot.commissions && (
        <>
          <CommissionsSection commissions={snapshot.commissions.data} />
          <CalculeLe
            title="Textes par commission"
            iso={snapshot.commissions.calculeLe}
          />
        </>
      )}

      <AmendementsSection amendements={snapshot.amendements.data} />
      <CalculeLe
        title="Amendements par article"
        iso={snapshot.amendements.calculeLe}
      />

      <IdentiquesSection identiques={snapshot.identiques.data} />
      <CalculeLe
        title="Amendements identiques"
        iso={snapshot.identiques.calculeLe}
      />

      <footer className="border-t border-line pt-6 text-sm text-muted">
        Sources : Assemblée nationale (open data) et Légifrance. Données brutes
        de cette page :{" "}
        <a className="underline" href="donnees.json">
          donnees.json
        </a>
        .
      </footer>
    </main>
  );
}

async function main() {
  const snapshot = JSON.parse(
    await readFile(path.join(DOCS, "donnees.json"), "utf8"),
  ) as Snapshot;

  const html = `<!doctype html>
  <html lang="fr">
  <head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Statistiques des textes de loi — Democraty Watch</title>
  <meta name="description" content="Lois promulguées, articles et amendements : statistiques issues des données de l'Assemblée nationale et de Légifrance.">
  <style>:root{--font-geist-sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--font-geist-mono:ui-monospace,monospace}</style>
  <link rel="stylesheet" href="styles.css">
  </head>
  <body class="min-h-full flex flex-col font-sans antialiased">
  ${renderToStaticMarkup(<StaticPage snapshot={snapshot} />)}
  </body>
  </html>
  `;

  await writeFile(path.join(DOCS, "index.html"), html);
  // Sans ce fichier, GitHub Pages passe le dossier dans Jekyll (inutile ici).
  await writeFile(path.join(DOCS, ".nojekyll"), "");

  execFileSync(
    process.execPath,
    [
      path.join("node_modules", "@tailwindcss", "cli", "dist", "index.mjs"),
      "-i",
      path.join("src", "app", "globals.css"),
      "-o",
      path.join(DOCS, "styles.css"),
      "--minify",
    ],
    { stdio: "inherit" },
  );

  console.log(
    `✓ Page statique générée dans ${DOCS}/ (index.html, styles.css, donnees.json)`,
  );
}

main();
