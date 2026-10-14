import "server-only";
import { query } from "@/lib/db";

/*
 * Indicateurs sur les textes de loi.
 *
 * Deux sources, car aucune ne couvre tout :
 *  - Légifrance : les lois promulguées et leurs articles tels que publiés au JO.
 *    On compte TOUS les articles d'une loi, amendés ou non.
 *  - Assemblée nationale : les amendements, qui visent les articles du texte
 *    *en discussion* (dont la numérotation diffère souvent de la loi finale).
 *    Seuls les articles ayant reçu au moins un amendement apparaissent.
 */

export type Bucket = { label: string; count: number };

export type LoiStats = {
  nbLoisPromulguees: number;
  nbLoisAvecArticles: number;
  nbArticles: number;
  moyenneArticles: number | null;
  medianeArticles: number | null;
  distribution: Bucket[];
};

export type AmendementStats = {
  nbAmendementsTotal: number;
  nbAmendementsSurArticle: number;
  nbArticlesAmendes: number;
  moyenneAmendements: number | null;
  medianeAmendements: number | null;
  distribution: Bucket[];
};

export type Stats = {
  lois: LoiStats;
  amendements: AmendementStats;
  calculeLe: Date;
};

// Lois = textes JORF principaux des dossiers législatifs Légifrance.
// Articles = articles JORF (version publiée) rattachés à ces textes.
const SQL_LOIS = `
with lois as (
  select distinct trim(jorf_texte_principal_id) as cid
  from legifrance.dossier_legislatif
  where jorf_texte_principal_id is not null
),
articles as (
  select a.data->'CONTEXTE'->'TEXTE'->>'@cid' as cid, count(*)::int as nb
  from legifrance.article a
  where a.id like 'JORFARTI%'
    and coalesce(a.data->'META'->'META_COMMUN'->>'NATURE', 'Article') = 'Article'
  group by 1
),
par_loi as (
  select l.cid, a.nb from lois l join articles a on a.cid = l.cid
)
select
  (select count(*) from lois)::int                                   as nb_lois,
  count(*)::int                                                      as nb_lois_avec_articles,
  coalesce(sum(nb), 0)::int                                          as nb_articles,
  avg(nb)::float                                                     as moyenne,
  percentile_cont(0.5) within group (order by nb)::float             as mediane,
  count(*) filter (where nb = 1)::int                                as b1,
  count(*) filter (where nb between 2 and 5)::int                    as b2,
  count(*) filter (where nb between 6 and 10)::int                   as b3,
  count(*) filter (where nb between 11 and 20)::int                  as b4,
  count(*) filter (where nb between 21 and 50)::int                  as b5,
  count(*) filter (where nb between 51 and 100)::int                 as b6,
  count(*) filter (where nb > 100)::int                              as b7
from par_loi;
`;

// Article = couple (texte discuté, article visé). On écarte les amendements
// portant sur un titre/chapitre et les « articles additionnels » (avant/après).
const SQL_AMENDEMENTS = `
with cibles as (
  select
    data->>'texteLegislatifRef' as texte,
    coalesce(
      data->'pointeurFragmentTexte'->'division'->>'articleDesignation',
      data->'pointeurFragmentTexte'->'division'->>'titre'
    ) as article,
    data->'pointeurFragmentTexte'->'division'->>'type' as type_division,
    coalesce(data->'pointeurFragmentTexte'->'division'->>'avant_A_Apres', 'A') as position
  from assemblee.amendements
),
par_article as (
  select texte, article, count(*)::int as nb
  from cibles
  where type_division = 'ARTICLE' and position = 'A'
    and texte is not null and article is not null
  group by texte, article
)
select
  (select count(*) from assemblee.amendements)::int                  as nb_total,
  coalesce(sum(nb), 0)::int                                          as nb_sur_article,
  count(*)::int                                                      as nb_articles,
  avg(nb)::float                                                     as moyenne,
  percentile_cont(0.5) within group (order by nb)::float             as mediane,
  count(*) filter (where nb = 1)::int                                as b1,
  count(*) filter (where nb between 2 and 5)::int                    as b2,
  count(*) filter (where nb between 6 and 10)::int                   as b3,
  count(*) filter (where nb between 11 and 25)::int                  as b4,
  count(*) filter (where nb between 26 and 50)::int                  as b5,
  count(*) filter (where nb between 51 and 100)::int                 as b6,
  count(*) filter (where nb > 100)::int                              as b7
from par_article;
`;

type Row = Record<string, number | null>;

const LOI_BUCKETS = ["1", "2–5", "6–10", "11–20", "21–50", "51–100", "> 100"];
const AMDT_BUCKETS = ["1", "2–5", "6–10", "11–25", "26–50", "51–100", "> 100"];

function buckets(row: Row, labels: string[]): Bucket[] {
  return labels.map((label, i) => ({ label, count: Number(row[`b${i + 1}`] ?? 0) }));
}

async function computeStats(): Promise<Stats> {
  const [[l], [a]] = await Promise.all([query<Row>(SQL_LOIS), query<Row>(SQL_AMENDEMENTS)]);
  return {
    lois: {
      nbLoisPromulguees: Number(l.nb_lois),
      nbLoisAvecArticles: Number(l.nb_lois_avec_articles),
      nbArticles: Number(l.nb_articles),
      moyenneArticles: l.moyenne,
      medianeArticles: l.mediane,
      distribution: buckets(l, LOI_BUCKETS),
    },
    amendements: {
      nbAmendementsTotal: Number(a.nb_total),
      nbAmendementsSurArticle: Number(a.nb_sur_article),
      nbArticlesAmendes: Number(a.nb_articles),
      moyenneAmendements: a.moyenne,
      medianeAmendements: a.mediane,
      distribution: buckets(a, AMDT_BUCKETS),
    },
    calculeLe: new Date(),
  };
}

// Les requêtes parcourent de grosses tables JSON : on garde le résultat
// en mémoire une heure plutôt que de tout recalculer à chaque visite.
const CACHE_MS = 60 * 60 * 1000;
const globalForStats = globalThis as unknown as {
  statsCache?: { at: number; promise: Promise<Stats> };
};

export function getStats(): Promise<Stats> {
  const cached = globalForStats.statsCache;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;

  const promise = computeStats();
  globalForStats.statsCache = { at: Date.now(), promise };
  // En cas d'erreur, on n'enferme pas l'échec dans le cache.
  promise.catch(() => {
    if (globalForStats.statsCache?.promise === promise) globalForStats.statsCache = undefined;
  });
  return promise;
}
