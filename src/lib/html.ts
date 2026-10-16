/*
 * Conversion du HTML des amendements (dispositif, exposé sommaire) en texte
 * brut affichable. On n'injecte jamais ce HTML tel quel dans la page : il
 * vient d'une source externe, et React échappe le texte produit ici.
 */

const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  laquo: "«",
  raquo: "»",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  deg: "°",
  euro: "€",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  oelig: "œ",
  aelig: "æ",
  Eacute: "É",
  Egrave: "È",
  Ecirc: "Ê",
  Agrave: "À",
  Acirc: "Â",
  Ccedil: "Ç",
  Icirc: "Î",
  Ocirc: "Ô",
  OElig: "Œ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000
        ? String.fromCodePoint(n)
        : m;
    }
    return NAMED[code] ?? m;
  });
}

/** HTML → texte : paragraphes et sauts de ligne conservés, balises retirées. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
