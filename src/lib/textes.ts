import "server-only";
import { createHash } from "node:crypto";
import { cachedOnDisk } from "@/lib/cache";
import { longQuery } from "@/lib/db";
import { htmlToText } from "@/lib/html";

/*
 * Lecture d'un texte de loi article par article, avec ses amendements
 * (données de l'Assemblée nationale).
 *
 * Les articles ne sont pas stockés en tant que tels : on les reconstitue à
 * partir des amendements, qui indiquent tous l'article qu'ils visent
 * (pointeurFragmentTexte.division). Un article sans aucun amendement
 * n'apparaît donc pas. Le texte des articles se lit sur le site de
 * l'Assemblée (lien fourni par chaque amendement).
 */

const CACHE_MS = Number(process.env.STATS_CACHE_HOURS ?? 24) * 60 * 60 * 1000;
const key = (...parts: string[]) =>
  "texte-" +
  createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);

/* ------------------------------------------------------------------ */
/* Trouver le PLF de l'année                                           */
/* ------------------------------------------------------------------ */

export type TexteRef = { uid: string; titre: string; amendements: number };

const SQL_PLF = `
with candidats as (
  select uid,
         coalesce(data->'titres'->>'titrePrincipalCourt', data->'titres'->>'titrePrincipal', uid) as titre
  from assemblee.documents
  where uid like 'PRJL%'
    and (
      data->'titres'->>'titrePrincipalCourt' ~* ('^PLF pour ' || $1::text || '$')
      or data->'titres'->>'titrePrincipal' ~* ('^projet de loi de finances pour ' || $1::text || '$')
    )
),
comptes as (
  select data->>'texteLegislatifRef' as uid, count(*)::int as nb
  from assemblee.amendements
  where data->>'texteLegislatifRef' in (select uid from candidats)
  group by 1
)
select c.uid, c.titre, coalesce(n.nb, 0) as amendements
from candidats c left join comptes n on n.uid = c.uid
order by amendements desc, c.uid
limit 1;
`;

/** PLF de l'année donnée (le texte le plus amendé s'il y en a plusieurs), ou null. */
export async function findPlf(annee: number): Promise<TexteRef | null> {
  const r = await cachedOnDisk(
    key("plf", String(annee)),
    SQL_PLF,
    CACHE_MS,
    async () => {
      const [row] = await longQuery<TexteRef>(SQL_PLF, [String(annee)]);
      return row ?? null;
    },
  );
  return r.data && r.data.amendements > 0 ? r.data : null;
}

/* ------------------------------------------------------------------ */
/* Sommaire d'un texte : articles visés et nombre d'amendements        */
/* ------------------------------------------------------------------ */

export type Position = "A" | "Avant" | "Apres";

export type ArticleEntry = {
  /** Identifiant stable dans l'URL (?article=…) */
  id: string;
  titre: string;
  position: Position;
  type: string | null;
  url: string | null;
  nb: number;
  uids: string[];
};

export type TexteIndex = {
  uid: string;
  titre: string;
  titreLong: string | null;
  total: number;
  articles: ArticleEntry[];
};

const SQL_INDEX = `
with a as (
  select
    uid,
    coalesce(data->'pointeurFragmentTexte'->'division'->>'titre', 'Hors article') as titre,
    coalesce(
      data->'pointeurFragmentTexte'->'division'->>'avantAApres',
      data->'pointeurFragmentTexte'->'division'->>'avant_A_Apres',
      'A'
    ) as position,
    data->'pointeurFragmentTexte'->'division'->>'type' as type,
    data->'pointeurFragmentTexte'->'division'->>'urlDivisionTexteVise' as url
  from assemblee.amendements
  where data->>'texteLegislatifRef' = $1
)
select
  (select coalesce(d.data->'titres'->>'titrePrincipalCourt', d.data->'titres'->>'titrePrincipal')
     from assemblee.documents d where d.uid = $1) as titre,
  (select d.data->'titres'->>'titrePrincipal' from assemblee.documents d where d.uid = $1) as titre_long,
  coalesce((
    select json_agg(g)
    from (
      select titre, position, max(type) as type, max(url) as url,
             count(*)::int as nb, array_agg(uid order by uid) as uids
      from a
      group by titre, position
    ) g
  ), '[]'::json) as articles;
`;

const SUFFIXES = [
  "",
  "bis",
  "ter",
  "quater",
  "quinquies",
  "sexies",
  "septies",
  "octies",
  "nonies",
  "decies",
];

/** Ordre de lecture : liminaire, 1er, 2, 2 bis, 3… ; « avant » puis l'article puis « après ». */
function sortKey(
  e: Pick<ArticleEntry, "titre" | "position">,
): [number, number, number, string] {
  const t = e.titre.toLowerCase();
  let num = 1e6; // titres, chapitres, annexes… à la fin
  let suf = 0;
  if (/liminaire/.test(t)) num = 0;
  else {
    const m = t.match(/article\s+(\d+)(?:er)?\s*([a-z]+)?/);
    if (m) {
      num = parseInt(m[1], 10);
      const i = SUFFIXES.indexOf(m[2] ?? "");
      suf = i >= 0 ? i : 0;
    }
  }
  const pos = e.position === "Avant" ? 0 : e.position === "A" ? 1 : 2;
  return [num, suf, pos, t];
}

function compareEntries(a: ArticleEntry, b: ArticleEntry) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < 3; i++)
    if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number);
  return ka[3].localeCompare(kb[3], "fr");
}

export function libelleArticle(e: Pick<ArticleEntry, "titre" | "position">) {
  if (e.position === "Avant")
    return `Avant l'${e.titre.replace(/^Article/i, "article")}`;
  if (e.position === "Apres")
    return `Après l'${e.titre.replace(/^Article/i, "article")}`;
  return e.titre;
}

export async function getTexteIndex(uid: string) {
  return cachedOnDisk(
    key("index", uid),
    SQL_INDEX,
    CACHE_MS,
    async (): Promise<TexteIndex> => {
      const [r] = await longQuery<{
        titre: string | null;
        titre_long: string | null;
        articles: Omit<ArticleEntry, "id">[];
      }>(SQL_INDEX, [uid]);
      const articles = r.articles
        .map((a) => ({
          ...a,
          position: (["A", "Avant", "Apres"].includes(a.position)
            ? a.position
            : "A") as Position,
          id: createHash("sha1")
            .update(`${a.position}|${a.titre}`)
            .digest("hex")
            .slice(0, 10),
        }))
        .sort(compareEntries);
      return {
        uid,
        titre: r.titre ?? uid,
        titreLong: r.titre_long,
        total: articles.reduce((s, a) => s + a.nb, 0),
        articles,
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* Amendements d'un article (une page à la fois)                       */
/* ------------------------------------------------------------------ */

export type Signataire = {
  nom: string;
  groupe: string | null;
  auteur: boolean;
};

export type Amendement = {
  uid: string;
  numero: string;
  sort: string | null;
  auteurLibelle: string | null;
  signataires: Signataire[];
  dispositif: string;
  expose: string;
};

const SQL_AMENDEMENTS = `
select
  uid,
  data->'identification' as identification,
  data->'cycleDeVie' as cycle,
  data->'signataires' as signataires_json,
  data->'corps'->'contenuAuteur'->>'dispositif' as dispositif,
  data->'corps'->'contenuAuteur'->>'exposeSommaire' as expose
from assemblee.amendements
where uid = any($1::text[]);
`;

const SQL_SIGNATAIRES = `
select
  s.amendement_uid as uid,
  coalesce(ac.nom_complet, s.depute_uid) as nom,
  coalesce(o.data->>'libelleAbrev', o.data->>'libelleAbrege', o.data->>'libelle') as groupe,
  coalesce(s.auteur, false) as auteur
from assemblee.deputes_signataires_amendements s
left join assemblee.acteurs ac on ac.uid = s.depute_uid
left join assemblee.organes o on o.uid = ac.depute_groupe_parlementaire_uid
where s.amendement_uid = any($1::text[])
order by s.amendement_uid, s.auteur desc nulls last, nom;
`;

type Json = unknown;
const str = (v: Json): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const obj = (v: Json): Record<string, Json> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, Json>)
    : {};

/** Le format exact varie selon les années : on cherche prudemment. */
function lireNumero(identification: Json, uid: string) {
  const id = obj(identification);
  return (
    str(id.numeroLong) ?? str(id.numero) ?? str(id.numeroOrdreDepot) ?? uid
  );
}

function lireSort(cycle: Json) {
  const c = obj(cycle);
  const sort =
    str(c.sort) ?? str(obj(c.sort).libelle) ?? str(obj(c.sort)["#text"]);
  if (sort) return sort;
  const etat = obj(obj(c.etatDesTraitements).etat);
  return str(etat.libelle);
}

function lireAuteurLibelle(sig: Json) {
  const s = obj(sig);
  const auteur = obj(s.auteur);
  const type = str(auteur.typeAuteur);
  if (type && /gouvernement/i.test(type)) return "Gouvernement";
  if (type && /commission|rapporteur/i.test(type))
    return str(s.libelle) ?? "Commission";
  return str(s.libelle);
}

export const PAGE_SIZE = 50;

export async function getArticleAmendements(
  texte: string,
  article: ArticleEntry,
  page: number,
) {
  const uids = article.uids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return cachedOnDisk(
    key("amdts", texte, article.id, String(page), uids.join(",")),
    SQL_AMENDEMENTS + SQL_SIGNATAIRES,
    CACHE_MS,
    async (): Promise<Amendement[]> => {
      if (uids.length === 0) return [];
      const [rows, sigs] = await Promise.all([
        longQuery<{
          uid: string;
          identification: Json;
          cycle: Json;
          signataires_json: Json;
          dispositif: string | null;
          expose: string | null;
        }>(SQL_AMENDEMENTS, [uids]),
        longQuery<Signataire & { uid: string }>(SQL_SIGNATAIRES, [uids]),
      ]);
      const parAmdt = new Map<string, Signataire[]>();
      for (const s of sigs) {
        const list = parAmdt.get(s.uid) ?? [];
        list.push({ nom: s.nom, groupe: s.groupe, auteur: s.auteur });
        parAmdt.set(s.uid, list);
      }
      const byUid = new Map(rows.map((r) => [r.uid, r]));
      return uids
        .map((u) => byUid.get(u))
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .map((r) => ({
          uid: r.uid,
          numero: lireNumero(r.identification, r.uid),
          sort: lireSort(r.cycle),
          auteurLibelle: lireAuteurLibelle(r.signataires_json),
          signataires: parAmdt.get(r.uid) ?? [],
          dispositif: htmlToText(r.dispositif),
          expose: htmlToText(r.expose),
        }));
    },
  );
}

/*
 * Lien vers le texte intégral sur le site de l'Assemblée.
 *
 * Les adresses stockées dans les amendements (urlDivisionTexteVise, du type
 * « /15/textes/2623.asp#D_Article_56 ») renvoient vers l'ancien site et ne
 * fonctionnent plus. On utilise à la place l'adresse du texte en open data,
 * construite à partir de son identifiant et valable pour tous les textes.
 *
 * Pour aller directement à l'article, on ajoute un « fragment de texte »
 * (#:~:text=ARTICLE 3) : les navigateurs récents font défiler jusqu'à la
 * première occurrence ; les autres ouvrent simplement le texte en haut.
 */
export function lienTexteAssemblee(texteUid: string) {
  return `https://www.assemblee-nationale.fr/dyn/opendata/${encodeURIComponent(texteUid)}.html`;
}

export function lienArticleAssemblee(texteUid: string, titreArticle: string) {
  const base = lienTexteAssemblee(texteUid);
  const t = titreArticle.toLowerCase();
  let cible: string | null = null;
  if (/liminaire/.test(t)) cible = "ARTICLE liminaire";
  else {
    const m = t.match(
      /^article\s+(\d+)(?:er)?(?:\s+(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies))?\b/,
    );
    if (m) cible = `ARTICLE ${m[1]}${m[2] ? ` ${m[2]}` : ""}`;
  }
  return cible ? `${base}#:~:text=${encodeURIComponent(cible)}` : base;
}
