/*
 * Étape 2 de la page statique : génère docs/index.html à partir de
 * docs/donnees.json, avec les mêmes composants que l'app, puis la feuille de
 * style Tailwind (docs/styles.css). Aucun accès à la base ici.
 *
 * GitHub Pages : Settings → Pages → « Deploy from a branch » → main, /docs.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AmendementsSection,
  CommissionsSection,
  formatDate,
  IdentiquesSection,
  LoisSection,
} from "../src/app/statistiques/sections";
import {
  A,
  ListeAmendements,
  Sommaire,
  VueTexte,
  type LienFn,
} from "../src/app/textes/[uid]/vue";
import type { Amendement, TexteIndex } from "../src/lib/textes-commun";
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
  /** Textes publiés article par article (docs/textes/<uid>/). */
  textes?: { uid: string; titre: string }[];
};

type TexteExport = {
  generatedAt: string;
  index: TexteIndex;
  pages: Record<string, Amendement[][]>;
};

/** Empreinte de styles.css, ajoutée à son adresse pour forcer le rechargement. */
let versionCss = "0";

/** Enveloppe HTML commune ; `racine` = chemin relatif vers docs/. */
function documentHtml(titre: string, corps: string, racine = "") {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre.replace(/</g, "&lt;")}</title>
<meta name="description" content="Lois promulguées, articles et amendements : statistiques issues des données de l'Assemblée nationale et de Légifrance.">
<style>:root{--font-geist-sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--font-geist-mono:ui-monospace,monospace}</style>
<link rel="stylesheet" href="${racine}styles.css?v=${versionCss}">
</head>
<body class="min-h-full flex flex-col font-sans antialiased">
${corps}
</body>
</html>
`;
}

/*
 * Insère sommaire.html dans les emplacements [data-sommaire] et met en avant
 * l'article courant. Sans JavaScript, le lien « Voir la liste des articles »
 * reste disponible.
 */
const CLASSES_COURANT = ["bg-surface-1", "font-medium", "ring-1", "ring-line"];
const CHARGER_SOMMAIRE = (articleId: string) => `<script>
fetch("sommaire.html").then(r => r.ok ? r.text() : Promise.reject()).then(html => {
  document.querySelectorAll("[data-sommaire]").forEach(el => {
    el.innerHTML = html;
    const a = el.querySelector('[data-article="${articleId}"]');
    if (a) { a.setAttribute("aria-current", "true"); a.classList.add(${CLASSES_COURANT.map((c) => JSON.stringify(c)).join(", ")}); let c = a.parentElement; while (c && getComputedStyle(c).overflowY !== "auto") c = c.parentElement; if (c) c.scrollTop += a.getBoundingClientRect().top - c.getBoundingClientRect().top - 60; }
  });
}).catch(() => {});
</script>`;

/** Une page HTML par article et par page d'amendements, plus index.html. */
async function genererTexte(uid: string) {
  const dir = path.join(DOCS, "textes", uid);
  const exp = JSON.parse(
    await readFile(
      path.join(".cache", "static", "textes", `${uid}.json`),
      "utf8",
    ),
  ) as TexteExport;
  const { index } = exp;

  // Retire les pages d'une génération précédente (articles renumérotés…).
  for (const f of await readdir(dir)) {
    // donnees.json : publié par les premières versions, trop lourd (> 50 Mo).
    if (f.endsWith(".html") || f === "donnees.json")
      await rm(path.join(dir, f));
  }

  const lien: LienFn = (article, page = 1) =>
    `${article}-${page}.html#amendements`;
  // Sommaire écrit une seule fois ; chaque page le charge (voir CHARGER_SOMMAIRE).
  await writeFile(
    path.join(dir, "sommaire.html"),
    renderToStaticMarkup(<Sommaire index={index} lien={lien} Lien={A} />),
  );
  const emplacement = (
    <div data-sommaire>
      <a className="px-2 text-sm underline" href="sommaire.html">
        Voir la liste des articles
      </a>
    </div>
  );

  const parDefaut =
    index.articles.find((a) => a.position === "A") ?? index.articles[0];
  let n = 0;

  for (const article of index.articles) {
    const pages = exp.pages[article.id] ?? [[]];
    for (let p = 1; p <= pages.length; p++) {
      const corps = renderToStaticMarkup(
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12">
          <a
            className="text-sm text-muted hover:underline"
            href="../../index.html"
          >
            ← Statistiques des textes de loi
          </a>
          <VueTexte
            index={index}
            article={article}
            lien={lien}
            Lien={A}
            sommaire={emplacement}
          >
            <ListeAmendements
              article={article}
              page={p}
              liste={pages[p - 1] ?? []}
              lien={lien}
              Lien={A}
            />
          </VueTexte>
          <footer className="border-t border-line pt-6 text-sm text-muted">
            Instantané du {formatDate(new Date(exp.generatedAt))}. Source :
            Assemblée nationale (open data).
          </footer>
        </main>,
      );
      const html = documentHtml(
        `${index.titre} — Democraty Watch`,
        corps + CHARGER_SOMMAIRE(article.id),
        "../../",
      );
      await writeFile(path.join(dir, `${article.id}-${p}.html`), html);
      if (article.id === parDefaut.id && p === 1) {
        await writeFile(path.join(dir, "index.html"), html);
      }
      n++;
    }
  }
  console.log(`✓ ${index.titre} : ${n} pages générées dans ${dir}/`);
}

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
        {snapshot.textes && snapshot.textes.length > 0 && (
          <p className="text-sm">
            Lire article par article :{" "}
            {snapshot.textes.map((t, i) => (
              <span key={t.uid}>
                {i > 0 && " · "}
                <a
                  className="underline"
                  href={`textes/${encodeURIComponent(t.uid)}/index.html`}
                >
                  {t.titre}
                </a>
              </span>
            ))}
          </p>
        )}
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

/*
 * Génère docs/styles.css AVANT les pages : si Tailwind échoue ou produit une
 * feuille incomplète, on s'arrête au lieu de publier de nouvelles pages avec
 * l'ancienne feuille de style.
 */
async function genererCss() {
  const sortie = path.join(DOCS, "styles.css");
  execFileSync(
    process.execPath,
    [
      path.join("node_modules", "@tailwindcss", "cli", "dist", "index.mjs"),
      "-i",
      path.join("src", "app", "globals.css"),
      "-o",
      sortie,
      "--minify",
    ],
    { stdio: "inherit" },
  );
  const css = await readFile(sortie, "utf8");
  // Quelques classes propres à chaque page : leur absence signale un problème.
  const attendues = [
    ".max-w-4xl",
    ".max-w-6xl",
    ".bg-series-1",
    ".fill-series-2",
    "lg\\:hidden",
  ];
  const manquantes = attendues.filter((c) => !css.includes(c));
  if (manquantes.length > 0) {
    throw new Error(
      `styles.css incomplet (classes absentes : ${manquantes.join(", ")}). ` +
        "Vérifiez que « npm install » a bien été lancé, puis relancez « npm run static:build ».",
    );
  }
  versionCss = createHash("sha256").update(css).digest("hex").slice(0, 10);
  console.log(
    `✓ Feuille de style générée (${Math.round(css.length / 1024)} Ko)`,
  );
}

async function main() {
  await genererCss();

  const snapshot = JSON.parse(
    await readFile(path.join(DOCS, "donnees.json"), "utf8"),
  ) as Snapshot;

  const html = documentHtml(
    "Statistiques des textes de loi — Democraty Watch",
    renderToStaticMarkup(<StaticPage snapshot={snapshot} />),
  );

  await writeFile(path.join(DOCS, "index.html"), html);
  // Sans ce fichier, GitHub Pages passe le dossier dans Jekyll (inutile ici).
  await writeFile(path.join(DOCS, ".nojekyll"), "");

  for (const t of snapshot.textes ?? []) {
    await mkdir(path.join(DOCS, "textes", t.uid), { recursive: true });
    await genererTexte(t.uid);
  }

  console.log(
    `✓ Page statique générée dans ${DOCS}/ (index.html, styles.css, donnees.json)`,
  );
}

main();
