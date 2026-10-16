/*
 * Fragments SQL partagés pour comparer le texte des amendements
 * (statistiques des doublons, regroupement sur la page d'un texte).
 */

/*
 * Entités HTML présentes dans les dispositifs (ex. « alin&#233;a ») :
 * on les décode pour que « é » et « &#233; » donnent le même texte.
 * Les entités restantes, plus rares, sont ensuite supprimées.
 */
export const ENTITES: [string[], string][] = [
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
export function texteDecode(expr: string): string {
  let e = `regexp_replace(${expr}, '<[^>]+>', ' ', 'g')`;
  for (const [alias, ch] of ENTITES) {
    for (const a of alias)
      e = `replace(${e}, '${a}', '${ch.replace(/'/g, "''")}')`;
  }
  return `regexp_replace(${e}, '&#?[a-z0-9]+;', '', 'gi')`;
}

/** Expression SQL : clé de comparaison (minuscules, sans espaces ni ponctuation, accents conservés). */
export function cleNormalisee(txt: string): string {
  return `regexp_replace(lower(${txt}), '[^[:alnum:]]+', '', 'g')`;
}

/**
 * Expression SQL : dispositif générique visant « cet alinéa » sans numéro.
 * L'alinéa visé n'étant pas stocké, ces amendements peuvent viser des
 * alinéas différents : on ne les regroupe jamais.
 */
export function estAmbigu(txt: string): string {
  return `(${txt} ~* '(cet\\s+alin|l\\W?alin\\S*\\s+(de\\s+cet\\s+article\\s+)?est\\s+supprim)' and ${txt} !~ '[0-9]')`;
}
