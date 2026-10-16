import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  getArticleAmendements,
  getTexteIndex,
  libelleArticle,
  lienArticleAssemblee,
  lienTexteAssemblee,
  PAGE_SIZE,
  type Amendement,
  type ArticleEntry,
  type TexteIndex,
} from "@/lib/textes";

export const metadata: Metadata = {
  title: "Texte et amendements — Democraty Watch",
};

type Params = Promise<{ uid: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const int = new Intl.NumberFormat("fr-FR");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(uid: string, article: string, page = 1) {
  const q = new URLSearchParams({ article });
  if (page > 1) q.set("page", String(page));
  return `/textes/${encodeURIComponent(uid)}?${q}#amendements`;
}

/* ------------------------------------------------------------------ */

function Sommaire({
  index,
  actif,
}: {
  index: TexteIndex;
  actif: ArticleEntry;
}) {
  const max = Math.max(...index.articles.map((a) => a.nb), 1);
  return (
    <nav
      aria-label="Articles du texte"
      className="flex flex-col gap-0.5 text-sm"
    >
      {index.articles.map((a) => {
        const courant = a.id === actif.id;
        const additionnel = a.position !== "A";
        return (
          <Link
            key={a.id}
            href={href(index.uid, a.id)}
            aria-current={courant ? "true" : undefined}
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 ${
              courant
                ? "bg-surface-1 font-medium ring-1 ring-line"
                : "hover:bg-surface-1"
            } ${additionnel ? "pl-5 text-muted" : ""}`}
          >
            <span className="min-w-0 flex-1 truncate">{libelleArticle(a)}</span>
            <span
              aria-hidden
              className="hidden h-1.5 rounded-full bg-series-1 sm:block"
              style={{ width: `${Math.max(2, (a.nb / max) * 48)}px` }}
            />
            <span className="w-10 shrink-0 text-right tabular-nums text-muted">
              {int.format(a.nb)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Explications affichées au survol des sorts les moins parlants. */
const EXPLICATIONS: [RegExp, string][] = [
  [
    /irrecevable\s*40/i,
    "Irrecevable au titre de l'article 40 de la Constitution : l'amendement aurait diminué les ressources publiques ou créé ou aggravé une charge publique.",
  ],
  [
    /irrecevable.*45|cavalier/i,
    "Irrecevable au titre de l'article 45 de la Constitution : sans lien, même indirect, avec le texte (« cavalier législatif »).",
  ],
  [
    /irrecevable.*(lolf|lfss|47)/i,
    "Irrecevable au regard des règles propres aux lois de finances ou de financement de la sécurité sociale (LOLF / LOLFSS).",
  ],
  [
    /irrecevable/i,
    "Déclaré irrecevable : l'amendement n'a pas été mis en discussion.",
  ],
  [
    /tomb/i,
    "Tombé : devenu sans objet, généralement après l'adoption ou le rejet d'un autre amendement ou de l'article.",
  ],
  [
    /non soutenu/i,
    "Non soutenu : aucun de ses auteurs n'était présent pour le défendre en séance.",
  ],
  [/retir/i, "Retiré par son auteur avant le vote."],
];

function Badge({ sort }: { sort: string | null }) {
  if (!sort) return null;
  const adopte = /^adopt/i.test(sort);
  const explication = EXPLICATIONS.find(([re]) => re.test(sort))?.[1];
  return (
    <span
      title={explication}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        adopte
          ? "border-green-700/40 text-green-800 dark:border-green-400/40 dark:text-green-300"
          : "border-line text-muted"
      } ${explication ? "cursor-help" : ""}`}
    >
      {adopte && <span aria-hidden>✓</span>}
      {sort}
    </span>
  );
}

function CarteAmendement({ a }: { a: Amendement }) {
  const auteurs = a.signataires.filter((s) => s.auteur);
  const cosignataires = a.signataires.filter((s) => !s.auteur);
  const premier = auteurs[0] ?? a.signataires[0];
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-semibold tabular-nums">Amendement n° {a.numero}</h3>
        <Badge sort={a.sort} />
      </header>
      <p className="text-sm text-muted">
        {premier ? (
          <>
            <span className="text-foreground">{premier.nom}</span>
            {premier.groupe && <> ({premier.groupe})</>}
            {a.signataires.length > 1 && (
              <>
                {" "}
                et {int.format(a.signataires.length - 1)} cosignataire
                {a.signataires.length > 2 ? "s" : ""}
              </>
            )}
          </>
        ) : (
          <span className="text-foreground">
            {a.auteurLibelle ?? "Auteur non renseigné"}
          </span>
        )}
      </p>
      {a.dispositif ? (
        <p className="whitespace-pre-line text-sm leading-6">{a.dispositif}</p>
      ) : (
        <p className="text-sm italic text-muted">Dispositif non publié.</p>
      )}
      {(a.expose || cosignataires.length > 0) && (
        <div className="flex flex-col gap-1">
          {a.expose && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">
                Exposé sommaire
              </summary>
              <p className="mt-2 whitespace-pre-line leading-6 text-muted">
                {a.expose}
              </p>
            </details>
          )}
          {cosignataires.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">
                Signataires ({int.format(a.signataires.length)})
              </summary>
              <p className="mt-2 leading-6 text-muted">
                {a.signataires
                  .map((s) => `${s.nom}${s.groupe ? ` (${s.groupe})` : ""}`)
                  .join(", ")}
              </p>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

function Pagination({
  uid,
  article,
  page,
  pages,
}: {
  uid: string;
  article: ArticleEntry;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pages d'amendements"
      className="flex items-center justify-between gap-4 text-sm"
    >
      {page > 1 ? (
        <Link
          className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-1"
          href={href(uid, article.id, page - 1)}
        >
          ← Précédents
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted tabular-nums">
        Page {page} / {pages}
      </span>
      {page < pages ? (
        <Link
          className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-1"
          href={href(uid, article.id, page + 1)}
        >
          Suivants →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

async function Amendements({
  index,
  article,
  page,
}: {
  index: TexteIndex;
  article: ArticleEntry;
  page: number;
}) {
  const pages = Math.max(1, Math.ceil(article.nb / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  let liste: Amendement[];
  try {
    liste = (await getArticleAmendements(index.uid, article, p)).data;
  } catch (e) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Chargement impossible : {e instanceof Error ? e.message : String(e)}
      </p>
    );
  }
  const adoptes = liste.filter((a) => a.sort && /^adopt/i.test(a.sort)).length;
  return (
    <div className="flex flex-col gap-4">
      {liste.some((a) => a.sort) && (
        <p className="text-sm text-muted">
          Sur cette page : {int.format(adoptes)} adopté{adoptes > 1 ? "s" : ""}{" "}
          sur {int.format(liste.length)}.
        </p>
      )}
      <Pagination uid={index.uid} article={article} page={p} pages={pages} />
      {liste.map((a) => (
        <CarteAmendement key={a.uid} a={a} />
      ))}
      <Pagination uid={index.uid} article={article} page={p} pages={pages} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

async function Texte({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await connection();
  const uid = decodeURIComponent((await params).uid);
  const sp = await searchParams;

  let index: TexteIndex;
  try {
    index = (await getTexteIndex(uid)).data;
  } catch (e) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Chargement du texte impossible :{" "}
        {e instanceof Error ? e.message : String(e)}
      </p>
    );
  }
  if (index.articles.length === 0) {
    return (
      <p className="text-sm text-muted">
        Aucun amendement trouvé pour le texte {uid}.
      </p>
    );
  }

  const demande = one(sp.article);
  const article =
    index.articles.find((a) => a.id === demande) ??
    // par défaut : le premier article « à l'article » (pas un additionnel)
    index.articles.find((a) => a.position === "A") ??
    index.articles[0];
  const page = Number(one(sp.page) ?? 1) || 1;
  const lien = lienArticleAssemblee(index.uid, article.titre);
  const nbArticles = index.articles.filter((a) => a.position === "A").length;

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted tabular-nums">{index.uid}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{index.titre}</h1>
        {index.titreLong && index.titreLong !== index.titre && (
          <p className="text-muted">{index.titreLong}</p>
        )}
        <p className="text-sm">
          <a
            className="underline"
            href={lienTexteAssemblee(index.uid)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Texte intégral sur le site de l&apos;Assemblée ↗
          </a>
        </p>
        <p className="text-sm text-muted">
          {int.format(index.total)} amendements sur {int.format(nbArticles)}{" "}
          articles
          {index.articles.length > nbArticles &&
            ` et ${int.format(index.articles.length - nbArticles)} emplacements d'articles additionnels`}
          .
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Sommaire : liste dépliable sur mobile, colonne fixe sur grand écran */}
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <details className="rounded-lg border border-line p-2 lg:hidden">
            <summary className="cursor-pointer px-2 py-1 text-sm font-medium">
              Articles ({int.format(index.articles.length)}) — actuel :{" "}
              {libelleArticle(article)}
            </summary>
            <div className="mt-2 max-h-96 overflow-y-auto">
              <Sommaire index={index} actif={article} />
            </div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-2 px-2 text-xs uppercase tracking-wide text-muted">
              Articles · amendements
            </p>
            <Sommaire index={index} actif={article} />
          </div>
        </aside>

        <section
          id="amendements"
          className="flex min-w-0 scroll-mt-6 flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">
              {libelleArticle(article)}
            </h2>
            <p className="text-sm text-muted">
              {int.format(article.nb)} amendement{article.nb > 1 ? "s" : ""}
              {article.position !== "A" &&
                " proposant d'insérer un article additionnel"}
              {" · "}
              <a
                className="underline"
                href={lien}
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvre le texte intégral et fait défiler jusqu'à l'article (navigateurs récents)"
              >
                Lire l&apos;article dans le texte de l&apos;Assemblée ↗
              </a>
            </p>
          </div>
          <Suspense
            key={`${article.id}-${page}`}
            fallback={
              <p className="animate-pulse text-sm text-muted">
                Chargement des amendements…
              </p>
            }
          >
            <Amendements index={index} article={article} page={page} />
          </Suspense>
        </section>
      </div>
    </>
  );
}

export default function TextePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← Accueil
      </Link>
      <Suspense
        fallback={
          <p className="animate-pulse text-sm text-muted">
            Chargement du texte… (jusqu&apos;à une minute au premier chargement)
          </p>
        }
      >
        <Texte params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
