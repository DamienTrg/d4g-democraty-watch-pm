import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  decouperEnPages,
  getArticleAmendements,
  getTexteIndex,
  type Amendement,
  type ArticleEntry,
  type TexteIndex,
} from "@/lib/textes";
import { ListeAmendements, VueTexte, type LienFn } from "./vue";

export const metadata: Metadata = {
  title: "Texte et amendements — Democraty Watch",
};

type Params = Promise<{ uid: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const lienApp =
  (uid: string): LienFn =>
  (article, page = 1) => {
    const q = new URLSearchParams({ article });
    if (page > 1) q.set("page", String(page));
    return `/textes/${encodeURIComponent(uid)}?${q}#amendements`;
  };

async function Amendements({
  index,
  article,
  page,
}: {
  index: TexteIndex;
  article: ArticleEntry;
  page: number;
}) {
  const pages = Math.max(1, decouperEnPages(article).length);
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
  return (
    <ListeAmendements
      article={article}
      page={p}
      liste={liste}
      lien={lienApp(index.uid)}
      Lien={Link}
    />
  );
}

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

  return (
    <VueTexte
      index={index}
      article={article}
      lien={lienApp(index.uid)}
      Lien={Link}
    >
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
    </VueTexte>
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
