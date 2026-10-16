/*
 * Types et fonctions pures pour l'affichage d'un texte article par article.
 * Sans accès à la base : utilisables par l'app comme par la génération de
 * la page statique (GitHub Pages).
 */

export type Position = "A" | "Avant" | "Apres";

export type ArticleEntry = {
  /** Identifiant stable dans l'URL (?article=…) */
  id: string;
  titre: string;
  position: Position;
  type: string | null;
  url: string | null;
  nb: number;
  /**
   * Amendements regroupés par dispositif identique (même règle que les
   * statistiques des doublons). Les plus grands groupes d'abord ; un
   * amendement sans équivalent forme un groupe à lui seul.
   */
  groupes: string[][];
};

export type TexteIndex = {
  uid: string;
  titre: string;
  titreLong: string | null;
  total: number;
  articles: ArticleEntry[];
};

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

export function libelleArticle(e: Pick<ArticleEntry, "titre" | "position">) {
  if (e.position === "Avant")
    return `Avant l'${e.titre.replace(/^Article/i, "article")}`;
  if (e.position === "Apres")
    return `Après l'${e.titre.replace(/^Article/i, "article")}`;
  return e.titre;
}

/** Environ 50 amendements par page, sans jamais couper un groupe. */
export const PAGE_SIZE = 50;

export function decouperEnPages(article: ArticleEntry): string[][][] {
  const pages: string[][][] = [];
  let courante: string[][] = [];
  let taille = 0;
  for (const g of article.groupes) {
    if (courante.length > 0 && taille + g.length > PAGE_SIZE) {
      pages.push(courante);
      courante = [];
      taille = 0;
    }
    courante.push(g);
    taille += g.length;
  }
  if (courante.length > 0) pages.push(courante);
  return pages;
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
