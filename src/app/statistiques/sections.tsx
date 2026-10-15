import type {
  AmendementStats,
  CommissionStats,
  IdentiquesStats,
  LoiStats,
} from "@/lib/stats";
import { Donut, type Slice } from "./Donut";
import { Histogram } from "./Histogram";

/*
 * Sections de la page de statistiques, purement présentationnelles : elles
 * reçoivent les données en props. Utilisées par la page de l'app (données
 * en direct) et par la page statique GitHub Pages (instantané JSON).
 */

const int = new Intl.NumberFormat("fr-FR");
const dec = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const num = (v: number | null) => (v == null ? "—" : dec.format(v));
const pct = (part: number, total: number) =>
  total ? `${dec.format((part / total) * 100)} %` : "—";

export function formatDate(d: Date) {
  return d.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
}

export function Tile({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Explication affichée au survol (ou au focus clavier) d'un petit « ? » */
  info?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-1 p-4">
      <span className="flex items-center gap-1.5 text-sm text-muted">
        {label}
        {info && (
          <span className="group relative inline-flex">
            <span
              tabIndex={0}
              aria-label={info}
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line text-[10px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-series-1"
            >
              ?
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-line bg-background px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-sm group-focus-within:block group-hover:block"
            >
              {info}
            </span>
          </span>
        )}
      </span>
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function LoisSection({ lois }: { lois: LoiStats }) {
  return (
    <>
      <section className="flex flex-col gap-1">
        <span className="text-sm text-muted">Textes de loi promulgués</span>
        <span className="text-6xl font-semibold tracking-tight">
          {int.format(lois.nbLoisPromulguees)}
        </span>
        <span className="text-sm text-muted">
          Lois disposant d&apos;un dossier législatif sur Légifrance
        </span>
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold">Articles par texte de loi</h2>
          <p className="mt-1 text-sm text-muted">
            Source : Légifrance, version publiée au Journal officiel. Tous les
            articles sont comptés, qu&apos;ils aient été amendés ou non.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile
            label="Nombre moyen"
            value={num(lois.moyenneArticles)}
            hint="articles par loi"
          />
          <Tile
            label="Nombre médian"
            value={num(lois.medianeArticles)}
            hint="articles par loi"
          />
          <Tile
            label="Articles au total"
            value={int.format(lois.nbArticles)}
            hint={`sur ${int.format(lois.nbLoisAvecArticles)} lois`}
          />
        </div>
        <Histogram
          title="Répartition des lois selon leur nombre d'articles"
          buckets={lois.distribution}
          unitLabel="articles"
          itemLabel="lois"
        />
        {lois.nbLoisAvecArticles < lois.nbLoisPromulguees && (
          <p className="text-sm text-muted">
            {lois.nbLoisPromulguees - lois.nbLoisAvecArticles > 1
              ? `${int.format(lois.nbLoisPromulguees - lois.nbLoisAvecArticles)} lois n'ont aucun article dans la base et sont exclues de ces calculs.`
              : "1 loi n'a aucun article dans la base et est exclue de ces calculs."}
          </p>
        )}
      </section>
    </>
  );
}

export function AmendementsSection({
  amendements,
}: {
  amendements: AmendementStats;
}) {
  const exclus =
    amendements.nbAmendementsTotal - amendements.nbAmendementsSurArticle;
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Amendements par article</h2>
        <p className="mt-1 text-sm text-muted">
          Source : Assemblée nationale. Un article = un article d&apos;un texte
          en discussion (projet ou proposition de loi, dans une version donnée).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label="Nombre moyen"
          value={num(amendements.moyenneAmendements)}
          hint="amendements par article"
        />
        <Tile
          label="Nombre médian"
          value={num(amendements.medianeAmendements)}
          hint="amendements par article"
        />
        <Tile
          label="Articles amendés"
          value={int.format(amendements.nbArticlesAmendes)}
          hint={`${int.format(amendements.nbAmendementsSurArticle)} amendements`}
        />
      </div>
      <Histogram
        title="Répartition des articles selon leur nombre d'amendements"
        buckets={amendements.distribution}
        unitLabel="amendements"
        itemLabel="articles"
      />
      <div className="rounded-lg border border-line p-4 text-sm leading-6 text-muted">
        <p className="font-medium text-foreground">
          À lire avant d&apos;interpréter ces chiffres
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            Seuls les articles ayant reçu{" "}
            <strong>au moins un amendement</strong> sont connus : les articles
            jamais amendés manquent, ce qui tire la moyenne et la médiane vers
            le haut.
          </li>
          <li>
            Les articles visés sont ceux du texte en discussion : leur
            numérotation ne correspond pas forcément à celle de la loi
            promulguée.
          </li>
          <li>
            {int.format(exclus)} {exclus > 1 ? "amendements" : "amendement"} sur{" "}
            {int.format(amendements.nbAmendementsTotal)} ne visent pas un
            article existant (articles additionnels, titres, chapitres…) et ne
            sont pas comptés ici.
          </li>
        </ul>
      </div>
    </section>
  );
}

function ComparaisonStricte({ identiques }: { identiques: IdentiquesStats }) {
  const lignes: [string, number, number][] = [
    [
      "Amendements identiques",
      identiques.nbIdentiquesStricts ?? 0,
      identiques.nbIdentiques,
    ],
    ["Doublons", identiques.nbCopiesStrictes ?? 0, identiques.nbCopies],
    ["Groupes", identiques.nbGroupesStricts ?? 0, identiques.nbFamilles],
  ];
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">
        Copier-coller exact ou simple variante ?
      </h3>
      <p className="text-sm text-muted">
        <strong className="font-semibold text-foreground">
          {pct(identiques.nbIdentiquesStricts ?? 0, identiques.nbIdentiques)}
        </strong>{" "}
        des amendements identiques le sont au caractère près. Les autres ne
        diffèrent que par la mise en forme (balises, espaces, apostrophes,
        ponctuation, majuscules).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="py-2 font-normal"></th>
              <th className="py-2 pl-2 text-right font-normal">
                Texte brut identique
              </th>
              <th className="py-2 pl-2 text-right font-normal">
                Après normalisation
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(([label, strict, normalise]) => (
              <tr key={label} className="border-t border-line">
                <td className="py-2 pr-4">{label}</td>
                <td className="py-2 text-right">{int.format(strict)}</td>
                <td className="py-2 text-right">{int.format(normalise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IdentiquesSection({
  identiques,
}: {
  identiques: IdentiquesStats;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Amendements identiques</h2>
        <p className="mt-1 text-sm text-muted">
          Source : Assemblée nationale. Deux amendements sont identiques
          s&apos;ils portent sur le même texte et le même article, avec le même
          dispositif. Sauf mention contraire, la comparaison ignore la mise en
          forme, les espaces, la ponctuation et les majuscules (les accents
          comptent).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          label="Amendements identiques"
          value={int.format(identiques.nbIdentiques)}
          hint={`${pct(identiques.nbIdentiques, identiques.nbAvecTexte)} des amendements rédigés · ${int.format(identiques.nbFamilles)} groupes`}
          info="Amendements dont au moins un autre exemplaire identique a été déposé sur le même article. Ils sont réunis en groupes d'amendements identiques."
        />
        <Tile
          label="Doublons"
          value={int.format(identiques.nbCopies)}
          hint={`${pct(identiques.nbCopies, identiques.nbAvecTexte)} des amendements rédigés`}
          info="Nombre d'amendements en trop si l'on n'en gardait qu'un par groupe. Exemple : 150 amendements identiques = 1 groupe, 149 doublons."
        />
        <Tile
          label="Plus grand groupe"
          value={int.format(identiques.plusGrosseFamille)}
          hint="amendements identiques sur un même article"
          info="Le même amendement déposé le plus grand nombre de fois sur un même article d'un même texte."
        />
      </div>
      {identiques.nbIdentiquesStricts != null && (
        <ComparaisonStricte identiques={identiques} />
      )}
      <Histogram
        title="Répartition des groupes d'amendements identiques selon leur taille"
        buckets={identiques.distribution}
        unitLabel="amendements"
        itemLabel="groupes"
      />
      {identiques.topTextes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Textes les plus concernés</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 font-normal">Texte</th>
                  <th className="py-2 pl-2 text-right font-normal">Amend.</th>
                  <th className="py-2 pl-2 text-right font-normal">
                    Identiques
                  </th>
                  <th className="py-2 pl-2 text-right font-normal">Part</th>
                </tr>
              </thead>
              <tbody>
                {identiques.topTextes.map((t) => (
                  <tr key={t.texte} className="border-t border-line">
                    <td className="py-2 pr-4">
                      <span className="block">{t.titre ?? t.texte}</span>
                      {t.titre && (
                        <span className="text-xs text-muted">{t.texte}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {int.format(t.amendements)}
                    </td>
                    <td className="py-2 text-right">
                      {int.format(t.identiques)}
                    </td>
                    <td className="py-2 text-right">
                      {pct(t.identiques, t.amendements)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-line p-4 text-sm leading-6 text-muted">
        <p className="font-medium text-foreground">Méthode</p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            Les données ne précisent pas l&apos;alinéa visé. Un dispositif
            générique comme « Cet alinéa est supprimé » peut donc viser des
            alinéas différents : ces cas ({int.format(identiques.nbAmbigus)}{" "}
            amendements) sont écartés plutôt que comptés comme identiques. Le
            chiffre affiché est donc un minimum.
          </li>
          <li>
            Normalisation : balises HTML retirées, entités décodées («
            &amp;#233; » → « é »), espaces, ponctuation et majuscules ignorés.
            Les accents sont conservés, pour ne pas confondre « ou » et « où ».
          </li>
          <li>
            Seul le dispositif est comparé, pas l&apos;exposé sommaire. Seuls
            les {int.format(identiques.nbAvecTexte)} amendements dont le texte
            est publié sont analysés.
          </li>
        </ul>
      </div>
    </section>
  );
}

const TONES = [1, 2, 3, 4, 5] as const;

/** « Commission des affaires sociales » → « Affaires sociales » */
function nomCourt(libelle: string) {
  const court = libelle.replace(
    /^Commission\s+(des|de la|de l'|de l’|du|d')\s*/i,
    "",
  );
  return court.charAt(0).toUpperCase() + court.slice(1);
}

export function CommissionsSection({
  commissions,
}: {
  commissions: CommissionStats;
}) {
  const liste = commissions.commissions;
  const avecCommission = liste.reduce((s, c) => s + c.textes, 0);

  // 5 premières commissions + « Autres » : un camembert reste lisible jusqu'à 6 parts.
  const top = liste.slice(0, 5);
  const autres = liste.slice(5).reduce((s, c) => s + c.textes, 0);
  const slices: Slice[] = top.map((c, i) => ({
    label: nomCourt(c.commission),
    value: c.textes,
    tone: TONES[i],
  }));
  if (autres > 0) {
    slices.push({
      label: `Autres (${liste.length - 5} commissions)`,
      value: autres,
      tone: "other",
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">
          Textes de loi par commission saisie
        </h2>
        <p className="mt-1 text-sm text-muted">
          Source : Assemblée nationale. Commission saisie au fond lors de la
          première lecture à l&apos;Assemblée, pour chaque projet ou proposition
          de loi.
        </p>
      </div>
      <Donut
        slices={slices}
        centerValue={int.format(avecCommission)}
        centerLabel="textes de loi"
        ariaLabel={`Répartition des textes de loi par commission : ${slices
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}`}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">
          Voir toutes les commissions ({int.format(liste.length)})
        </summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-normal">Commission</th>
              <th className="py-1 pl-2 text-right font-normal">Textes</th>
              <th className="py-1 pl-2 text-right font-normal">Part</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c.commission} className="border-t border-line">
                <td className="py-1 pr-4">{c.commission}</td>
                <td className="py-1 text-right">{int.format(c.textes)}</td>
                <td className="py-1 text-right">
                  {pct(c.textes, avecCommission)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div className="rounded-lg border border-line p-4 text-sm leading-6 text-muted">
        <p className="font-medium text-foreground">Méthode</p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            Seule la commission saisie au fond en première lecture à
            l&apos;Assemblée est retenue, pas les commissions saisies pour avis
            ni celles des lectures suivantes.
          </li>
          <li>
            Les commissions sont regroupées par nom d&apos;une législature à
            l&apos;autre ; une commission renommée apparaît donc séparément. Les
            commissions spéciales, créées pour un seul texte, sont dans « Autres
            ».
          </li>
          {commissions.nbSansCommission > 0 && (
            <li>
              {commissions.nbSansCommission > 1
                ? `${int.format(commissions.nbSansCommission)} textes de loi sur ${int.format(commissions.nbTextes)} n'ont pas de commission identifiée (par exemple, une proposition de loi pas encore renvoyée) et ne sont pas représentés.`
                : `1 texte de loi sur ${int.format(commissions.nbTextes)} n'a pas de commission identifiée (par exemple, une proposition de loi pas encore renvoyée) et n'est pas représenté.`}
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
