import "server-only";
import { cachedOnDisk, type Calcul } from "@/lib/cache";
import { longQuery } from "@/lib/db";

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

export type TexteIdentiques = {
  texte: string;
  titre: string | null;
  amendements: number;
  identiques: number;
  copies: number;
};

export type IdentiquesStats = {
  nbAvecTexte: number;
  nbFamilles: number;
  nbIdentiques: number;
  nbCopies: number;
  plusGrosseFamille: number;
  nbAmbigus: number;
  /** Même chose, au caractère près (texte brut). Absent des anciens instantanés. */
  nbGroupesStricts?: number;
  nbIdentiquesStricts?: number;
  nbCopiesStrictes?: number;
  distribution: Bucket[];
  topTextes: TexteIdentiques[];
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
    coalesce(
      data->'pointeurFragmentTexte'->'division'->>'avantAApres',
      data->'pointeurFragmentTexte'->'division'->>'avant_A_Apres',
      'A'
    ) as position
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

/*
 * Entités HTML présentes dans les dispositifs (ex. « alin&#233;a ») :
 * on les décode pour que « é » et « &#233; » donnent le même texte.
 * Les entités restantes, plus rares, sont ensuite supprimées.
 */
const ENTITES: [string[], string][] = [
  [["&#233;", "&eacute;"], "é"],
  [["&#232;", "&egrave;"], "è"],
  [["&#234;", "&ecirc;"], "ê"],
  [["&#235;", "&euml;"], "ë"],
  [["&#224;", "&agrave;"], "à"],
  [["&#226;", "&acirc;"], "â"],
  [["&#228;", "&auml;"], "ä"],
  [["&#231;", "&ccedil;"], "ç"],
  [["&#238;", "&icirc;"], "î"],
  [["&#239;", "&iuml;"], "ï"],
  [["&#244;", "&ocirc;"], "ô"],
  [["&#246;", "&ouml;"], "ö"],
  [["&#249;", "&ugrave;"], "ù"],
  [["&#251;", "&ucirc;"], "û"],
  [["&#252;", "&uuml;"], "ü"],
  [["&#255;", "&yuml;"], "ÿ"],
  [["&#339;", "&oelig;"], "œ"],
  [["&#230;", "&aelig;"], "æ"],
  [["&#201;", "&Eacute;"], "É"],
  [["&#200;", "&Egrave;"], "È"],
  [["&#202;", "&Ecirc;"], "Ê"],
  [["&#203;", "&Euml;"], "Ë"],
  [["&#192;", "&Agrave;"], "À"],
  [["&#194;", "&Acirc;"], "Â"],
  [["&#199;", "&Ccedil;"], "Ç"],
  [["&#206;", "&Icirc;"], "Î"],
  [["&#207;", "&Iuml;"], "Ï"],
  [["&#212;", "&Ocirc;"], "Ô"],
  [["&#217;", "&Ugrave;"], "Ù"],
  [["&#219;", "&Ucirc;"], "Û"],
  [["&#220;", "&Uuml;"], "Ü"],
  [["&#338;", "&OElig;"], "Œ"],
  [["&#198;", "&AElig;"], "Æ"],
  [["&#176;", "&deg;"], "°"],
  // Espaces et apostrophes : utiles pour repérer « cet alinéa », « l’alinéa ».
  [["&#160;", "&nbsp;", "&#8239;", "&#8201;"], " "],
  [["&#8217;", "&rsquo;", "&#39;", "&#039;", "&apos;"], "'"],
];

/** Expression SQL : texte brut d'un dispositif (sans balises, entités décodées). */
function texteDecode(expr: string): string {
  let e = `regexp_replace(${expr}, '<[^>]+>', ' ', 'g')`;
  for (const [alias, ch] of ENTITES) {
    for (const a of alias)
      e = `replace(${e}, '${a}', '${ch.replace(/'/g, "''")}')`;
  }
  return `regexp_replace(${e}, '&#?[a-z0-9]+;', '', 'gi')`;
}

/*
 * Amendements identiques = même texte en discussion, même article visé, même
 * dispositif. Deux niveaux :
 *  - strict : dispositif identique au caractère près (texte brut tel que stocké) ;
 *  - normalisé : balises HTML, entités, espaces, ponctuation et majuscules
 *    ignorés. Les accents sont conservés (« ou » ≠ « où »).
 *
 * L'alinéa visé n'est pas stocké dans les données : un dispositif générique
 * comme « Cet alinéa est supprimé » peut viser des alinéas différents.
 * Ces groupes « ambigus » (mention d'alinéa sans aucun numéro) sont
 * comptés à part et exclus des doublons, aux deux niveaux.
 */
const SQL_IDENTIQUES = `
with brut as (
  select
    data->>'texteLegislatifRef' as texte,
    coalesce(data->'pointeurFragmentTexte'->'division'->>'titre', '') as article,
    data->'corps'->'contenuAuteur'->>'dispositif' as dispositif
  from assemblee.amendements
  where data->'corps'->'contenuAuteur'->>'dispositif' is not null
    and data->>'texteLegislatifRef' is not null
),
decode as (
  select texte, article, dispositif, ${texteDecode("dispositif")} as txt
  from brut
),
norm as (
  select texte, article, dispositif, txt,
         regexp_replace(lower(txt), '[^[:alnum:]]+', '', 'g') as cle
  from decode
),
base as (
  select
    texte,
    article,
    md5(dispositif) as empreinte_stricte,
    md5(cle) as empreinte,
    cle = '' as vide,
    (txt ~* '(cet\\s+alin|l\\W?alin\\S*\\s+(de\\s+cet\\s+article\\s+)?est\\s+supprim)'
      and txt !~ '[0-9]') as ambigu
  from norm
),
familles as (
  select texte, article, empreinte, bool_or(ambigu) as ambigu, count(*)::int as nb
  from base
  where not vide
  group by texte, article, empreinte
),
familles_strictes as (
  select texte, article, empreinte_stricte, bool_or(ambigu) as ambigu, count(*)::int as nb
  from base
  where not vide
  group by texte, article, empreinte_stricte
),
doublons_stricts as (
  select * from familles_strictes where nb > 1 and not ambigu
),
doublons as (
  select * from familles where nb > 1 and not ambigu
),
top as (
  select texte, count(*)::int as familles, sum(nb)::int as identiques, sum(nb - 1)::int as copies
  from doublons
  group by texte
  order by copies desc
  limit 10
),
totaux_top as (
  select texte, count(*)::int as amendements
  from base
  where texte in (select texte from top)
  group by texte
)
select
  (select count(*) from base)::int                                   as nb_avec_texte,
  (select count(*) from doublons)::int                               as nb_familles,
  (select coalesce(sum(nb), 0) from doublons)::int                   as nb_identiques,
  (select coalesce(sum(nb - 1), 0) from doublons)::int               as nb_copies,
  (select coalesce(max(nb), 0) from doublons)::int                   as plus_grosse,
  (select coalesce(sum(nb), 0) from familles where nb > 1 and ambigu)::int as nb_ambigus,
  (select count(*) from doublons_stricts)::int                       as nb_groupes_stricts,
  (select coalesce(sum(nb), 0) from doublons_stricts)::int           as nb_identiques_stricts,
  (select coalesce(sum(nb - 1), 0) from doublons_stricts)::int       as nb_copies_strictes,
  (select count(*) from doublons where nb = 2)::int                  as b1,
  (select count(*) from doublons where nb between 3 and 5)::int      as b2,
  (select count(*) from doublons where nb between 6 and 10)::int     as b3,
  (select count(*) from doublons where nb between 11 and 50)::int    as b4,
  (select count(*) from doublons where nb between 51 and 100)::int   as b5,
  (select count(*) from doublons where nb > 100)::int                as b6,
  (
    select json_agg(json_build_object(
      'texte', t.texte,
      'titre', coalesce(d.data->'titres'->>'titrePrincipalCourt', d.data->'titres'->>'titrePrincipal'),
      'amendements', tt.amendements,
      'identiques', t.identiques,
      'copies', t.copies
    ) order by t.copies desc)
    from top t
    join totaux_top tt on tt.texte = t.texte
    left join assemblee.documents d on d.uid = t.texte
  ) as top_textes;
`;

type Row = Record<string, number | null>;

const LOI_BUCKETS = ["1", "2–5", "6–10", "11–20", "21–50", "51–100", "> 100"];
const AMDT_BUCKETS = ["1", "2–5", "6–10", "11–25", "26–50", "51–100", "> 100"];
const FAMILLE_BUCKETS = ["2", "3–5", "6–10", "11–50", "51–100", "> 100"];

function buckets(row: Row, labels: string[]): Bucket[] {
  return labels.map((label, i) => ({
    label,
    count: Number(row[`b${i + 1}`] ?? 0),
  }));
}

async function computeLois(): Promise<LoiStats> {
  const [l] = await longQuery<Row>(SQL_LOIS);
  return {
    nbLoisPromulguees: Number(l.nb_lois),
    nbLoisAvecArticles: Number(l.nb_lois_avec_articles),
    nbArticles: Number(l.nb_articles),
    moyenneArticles: l.moyenne,
    medianeArticles: l.mediane,
    distribution: buckets(l, LOI_BUCKETS),
  };
}

async function computeAmendements(): Promise<AmendementStats> {
  const [a] = await longQuery<Row>(SQL_AMENDEMENTS);
  return {
    nbAmendementsTotal: Number(a.nb_total),
    nbAmendementsSurArticle: Number(a.nb_sur_article),
    nbArticlesAmendes: Number(a.nb_articles),
    moyenneAmendements: a.moyenne,
    medianeAmendements: a.mediane,
    distribution: buckets(a, AMDT_BUCKETS),
  };
}

async function computeIdentiques(): Promise<IdentiquesStats> {
  const [i] = await longQuery<Row & { top_textes: TexteIdentiques[] | null }>(
    SQL_IDENTIQUES,
  );
  return {
    nbAvecTexte: Number(i.nb_avec_texte),
    nbFamilles: Number(i.nb_familles),
    nbIdentiques: Number(i.nb_identiques),
    nbCopies: Number(i.nb_copies),
    plusGrosseFamille: Number(i.plus_grosse),
    nbAmbigus: Number(i.nb_ambigus),
    nbGroupesStricts: Number(i.nb_groupes_stricts),
    nbIdentiquesStricts: Number(i.nb_identiques_stricts),
    nbCopiesStrictes: Number(i.nb_copies_strictes),
    distribution: buckets(i, FAMILLE_BUCKETS),
    topTextes: i.top_textes ?? [],
  };
}

/*
 * Chaque section a son propre cache (24 h par défaut, sur disque) : les
 * requêtes parcourent de grosses tables JSON, et l'échec de l'une ne doit pas
 * bloquer les autres. Modifier une requête SQL invalide automatiquement son cache.
 */
const CACHE_MS = Number(process.env.STATS_CACHE_HOURS ?? 24) * 60 * 60 * 1000;

export type { Calcul };

export const getLoiStats = () =>
  cachedOnDisk("lois", SQL_LOIS, CACHE_MS, computeLois);
export const getAmendementStats = () =>
  cachedOnDisk("amendements", SQL_AMENDEMENTS, CACHE_MS, computeAmendements);
export const getIdentiquesStats = () =>
  cachedOnDisk("identiques", SQL_IDENTIQUES, CACHE_MS, computeIdentiques);
