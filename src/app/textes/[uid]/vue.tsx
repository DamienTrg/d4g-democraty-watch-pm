import type { ComponentType, ReactNode } from "react";
import {
  decouperEnPages,
  libelleArticle,
  lienArticleAssemblee,
  lienTexteAssemblee,
  type Amendement,
  type ArticleEntry,
  type TexteIndex,
} from "@/lib/textes-commun";

/*
 * Affichage d'un texte article par article, sans accès aux données : utilisé
 * par la page de l'app (/textes/[uid]) et par la page statique GitHub Pages.
 * Les liens internes sont fournis par l'appelant (URL de l'app ou fichiers
 * statiques), ainsi que le composant de lien (next/link ou simple <a>).
 */

export type LienFn = (articleId: string, page?: number) => string;
type LienProps = {
  href: string;
  className?: string;
  children?: ReactNode;
  "aria-current"?: "true";
  "data-article"?: string;
};
export type LienComp = ComponentType<LienProps>;

/** Lien HTML simple (page statique). */
export function A(props: LienProps) {
  return <a {...props} />;
}

const int = new Intl.NumberFormat("fr-FR");

export function Sommaire({
  index,
  actif,
  lien,
  Lien,
}: {
  index: TexteIndex;
  /** Article courant ; absent pour le sommaire partagé de la page statique. */
  actif?: ArticleEntry;
  lien: LienFn;
  Lien: LienComp;
}) {
  const max = Math.max(...index.articles.map((a) => a.nb), 1);
  return (
    <nav
      aria-label="Articles du texte"
      className="flex flex-col gap-0.5 text-sm"
    >
      {index.articles.map((a) => {
        const courant = a.id === actif?.id;
        const additionnel = a.position !== "A";
        return (
          <Lien
            key={a.id}
            href={lien(a.id)}
            data-article={a.id}
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
          </Lien>
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

export function Badge({ sort }: { sort: string | null }) {
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

export function CarteAmendement({ a }: { a: Amendement }) {
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

export function Pagination({
  article,
  page,
  pages,
  lien,
  Lien,
}: {
  article: ArticleEntry;
  page: number;
  pages: number;
  lien: LienFn;
  Lien: LienComp;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pages d'amendements"
      className="flex items-center justify-between gap-4 text-sm"
    >
      {page > 1 ? (
        <Lien
          className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-1"
          href={lien(article.id, page - 1)}
        >
          ← Précédents
        </Lien>
      ) : (
        <span />
      )}
      <span className="text-muted tabular-nums">
        Page {page} / {pages}
      </span>
      {page < pages ? (
        <Lien
          className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-1"
          href={lien(article.id, page + 1)}
        >
          Suivants →
        </Lien>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Décompte « Rejeté ×45 · Tombé ×5 », du plus fréquent au moins fréquent. */
function decompte(valeurs: (string | null)[]) {
  const n = new Map<string, number>();
  for (const v of valeurs) if (v) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]);
}

function premierSignataire(a: Amendement) {
  const p = a.signataires.find((s) => s.auteur) ?? a.signataires[0];
  if (p) return { nom: p.nom, groupe: p.groupe };
  return { nom: a.auteurLibelle ?? "Auteur non renseigné", groupe: null };
}

/** Plusieurs amendements au dispositif identique, repliés sous un seul titre. */
export function GroupeIdentiques({
  amendements,
}: {
  amendements: Amendement[];
}) {
  const modele = amendements[0];
  const sorts = decompte(amendements.map((a) => a.sort));
  const groupes = decompte(amendements.map((a) => premierSignataire(a).groupe));
  const extrait =
    modele.dispositif.length > 220
      ? `${modele.dispositif.slice(0, 220).trimEnd()}…`
      : modele.dispositif;
  return (
    <details className="group rounded-lg border border-line bg-surface-1 [&[open]]:bg-transparent">
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            aria-hidden
            className="inline-block text-muted transition-transform group-open:rotate-90"
          >
            ▸
          </span>
          <span className="font-semibold">
            {int.format(amendements.length)} amendements identiques
          </span>
          <span className="text-sm text-muted tabular-nums">
            n° {amendements[0].numero} à{" "}
            {amendements[amendements.length - 1].numero}
          </span>
        </span>
        <span className="whitespace-pre-line text-sm leading-6">
          {extrait || <em className="text-muted">Dispositif non publié.</em>}
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {sorts.length > 0 && (
            <span>
              {sorts.map(([s, n]) => `${s} ×${int.format(n)}`).join(" · ")}
            </span>
          )}
          {groupes.length > 0 && (
            <span>
              Groupes :{" "}
              {groupes.map(([g, n]) => `${g} ×${int.format(n)}`).join(" · ")}
            </span>
          )}
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-line p-4">
        {modele.dispositif.length > extrait.length && (
          <p className="whitespace-pre-line text-sm leading-6">
            {modele.dispositif}
          </p>
        )}
        {modele.expose && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">
              Exposé sommaire (du n° {modele.numero})
            </summary>
            <p className="mt-2 whitespace-pre-line leading-6 text-muted">
              {modele.expose}
            </p>
          </details>
        )}
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-3 font-normal">N°</th>
              <th className="py-1 pr-3 font-normal">Premier signataire</th>
              <th className="py-1 font-normal">Sort</th>
            </tr>
          </thead>
          <tbody>
            {amendements.map((a) => {
              const p = premierSignataire(a);
              return (
                <tr key={a.uid} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 tabular-nums">{a.numero}</td>
                  <td className="py-1.5 pr-3">
                    {p.nom}
                    {p.groupe && (
                      <span className="text-muted"> ({p.groupe})</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    <Badge sort={a.sort} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Regroupe les amendements d'une page selon les groupes calculés dans le sommaire. */
export function blocsDeLaPage(
  article: ArticleEntry,
  page: number,
  liste: Amendement[],
) {
  const parUid = new Map(liste.map((a) => [a.uid, a]));
  return (decouperEnPages(article)[page - 1] ?? [])
    .map((g) =>
      g.map((u) => parUid.get(u)).filter((a): a is Amendement => Boolean(a)),
    )
    .filter((g) => g.length > 0);
}

/** Liste des amendements d'une page de l'article (groupes repliés + cartes). */
export function ListeAmendements({
  article,
  page,
  liste,
  lien,
  Lien,
}: {
  article: ArticleEntry;
  page: number;
  liste: Amendement[];
  lien: LienFn;
  Lien: LienComp;
}) {
  const pages = Math.max(1, decouperEnPages(article).length);
  const blocs = blocsDeLaPage(article, page, liste);
  const nbGroupes = article.groupes.filter((g) => g.length > 1).length;
  const nbDansGroupes = article.groupes
    .filter((g) => g.length > 1)
    .reduce((s, g) => s + g.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {nbGroupes > 0 && (
        <p className="text-sm text-muted">
          {int.format(nbDansGroupes)} des {int.format(article.nb)} amendements
          de cet article forment {int.format(nbGroupes)} groupe
          {nbGroupes > 1 ? "s" : ""} d&apos;amendements identiques, repliés
          ci-dessous.
        </p>
      )}
      <Pagination
        article={article}
        page={page}
        pages={pages}
        lien={lien}
        Lien={Lien}
      />
      {blocs.map((g) =>
        g.length > 1 ? (
          <GroupeIdentiques key={g[0].uid} amendements={g} />
        ) : (
          <CarteAmendement key={g[0].uid} a={g[0]} />
        ),
      )}
      <Pagination
        article={article}
        page={page}
        pages={pages}
        lien={lien}
        Lien={Lien}
      />
    </div>
  );
}

/** En-tête du texte, sommaire et titre de l'article ; les amendements viennent en enfants. */
export function VueTexte({
  index,
  article,
  lien,
  Lien,
  children,
  sommaire,
}: {
  index: TexteIndex;
  article: ArticleEntry;
  lien: LienFn;
  Lien: LienComp;
  children: ReactNode;
  /**
   * Remplace le sommaire (page statique : chargé une seule fois depuis
   * sommaire.html au lieu d'être répété dans chaque page).
   */
  sommaire?: ReactNode;
}) {
  const lienArticle = lienArticleAssemblee(index.uid, article.titre);
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
              {sommaire ?? (
                <Sommaire
                  index={index}
                  actif={article}
                  lien={lien}
                  Lien={Lien}
                />
              )}
            </div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-2 px-2 text-xs uppercase tracking-wide text-muted">
              Articles · amendements
            </p>
            {sommaire ?? (
              <Sommaire index={index} actif={article} lien={lien} Lien={Lien} />
            )}
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
                href={lienArticle}
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvre le texte intégral et fait défiler jusqu'à l'article (navigateurs récents)"
              >
                Lire l&apos;article dans le texte de l&apos;Assemblée ↗
              </a>
            </p>
          </div>
          {children}
        </section>
      </div>
    </>
  );
}
