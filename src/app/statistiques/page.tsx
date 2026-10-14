import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import {
  getAmendementStats,
  getIdentiquesStats,
  getLoiStats,
  type Calcul,
} from "@/lib/stats";
import { Histogram } from "./Histogram";

export const metadata: Metadata = {
  title: "Statistiques — Democraty Watch",
};

const int = new Intl.NumberFormat("fr-FR");
const dec = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const num = (v: number | null) => (v == null ? "—" : dec.format(v));
const pct = (part: number, total: number) =>
  total ? `${dec.format((part / total) * 100)} %` : "—";

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-1 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

/** Charge une section ; en cas d'échec, affiche l'erreur à sa place sans casser la page. */
async function Load<T>({
  title,
  load,
  children,
}: {
  title: string;
  load: () => Promise<Calcul<T>>;
  children: (data: T) => ReactNode;
}) {
  await connection();
  let result: Calcul<T>;
  try {
    result = await load();
  } catch (error) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-red-700 dark:text-red-400">
          Calcul impossible :{" "}
          {error instanceof Error ? error.message : String(error)}
        </p>
      </section>
    );
  }
  return (
    <>
      {children(result.data)}
      <p className="-mt-8 text-xs text-muted">
        {title} · calculé le{" "}
        {result.calculeLe.toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Paris",
        })}
      </p>
    </>
  );
}

function Pending({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="animate-pulse text-sm text-muted">
        Calcul en cours… cela peut prendre une à deux minutes au premier
        chargement.
      </p>
    </section>
  );
}

export default function StatistiquesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Accueil
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Statistiques des textes de loi
        </h1>
        <p className="text-sm text-muted">
          Chaque section est recalculée au plus une fois par heure.
        </p>
      </header>

      <Suspense fallback={<Pending title="Lois et articles" />}>
        <Load title="Lois et articles" load={getLoiStats}>
          {(lois) => (
            <>
              <section className="flex flex-col gap-1">
                <span className="text-sm text-muted">
                  Textes de loi promulgués
                </span>
                <span className="text-6xl font-semibold tracking-tight">
                  {int.format(lois.nbLoisPromulguees)}
                </span>
                <span className="text-sm text-muted">
                  Lois disposant d&apos;un dossier législatif sur Légifrance
                </span>
              </section>

              <section className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    Articles par texte de loi
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Source : Légifrance, version publiée au Journal officiel.
                    Tous les articles sont comptés, qu&apos;ils aient été
                    amendés ou non.
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
          )}
        </Load>
      </Suspense>

      <Suspense fallback={<Pending title="Amendements par article" />}>
        <Load title="Amendements par article" load={getAmendementStats}>
          {(amendements) => {
            const exclus =
              amendements.nbAmendementsTotal -
              amendements.nbAmendementsSurArticle;
            return (
              <section className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    Amendements par article
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Source : Assemblée nationale. Un article = un article
                    d&apos;un texte en discussion (projet ou proposition de loi,
                    dans une version donnée).
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
                      <strong>au moins un amendement</strong> sont connus : les
                      articles jamais amendés manquent, ce qui tire la moyenne
                      et la médiane vers le haut.
                    </li>
                    <li>
                      Les articles visés sont ceux du texte en discussion : leur
                      numérotation ne correspond pas forcément à celle de la loi
                      promulguée.
                    </li>
                    <li>
                      {int.format(exclus)}{" "}
                      {exclus > 1 ? "amendements" : "amendement"} sur{" "}
                      {int.format(amendements.nbAmendementsTotal)} ne visent pas
                      un article existant (articles additionnels, titres,
                      chapitres…) et ne sont pas comptés ici.
                    </li>
                  </ul>
                </div>
              </section>
            );
          }}
        </Load>
      </Suspense>

      <Suspense fallback={<Pending title="Amendements identiques" />}>
        <Load title="Amendements identiques" load={getIdentiquesStats}>
          {(identiques) => (
            <section className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-semibold">
                  Amendements identiques
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Source : Assemblée nationale. Deux amendements sont identiques
                  s&apos;ils portent sur le même texte et le même article, avec
                  le même dispositif (mise en forme, ponctuation, accents et
                  majuscules ignorés).
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Tile
                  label="Amendements identiques"
                  value={int.format(identiques.nbIdentiques)}
                  hint={`${pct(identiques.nbIdentiques, identiques.nbAvecTexte)} des amendements rédigés`}
                />
                <Tile
                  label="Copies en surnombre"
                  value={int.format(identiques.nbCopies)}
                  hint={`en gardant un exemplaire par famille (${pct(identiques.nbCopies, identiques.nbAvecTexte)})`}
                />
                <Tile
                  label="Plus grosse famille"
                  value={int.format(identiques.plusGrosseFamille)}
                  hint={`amendements identiques · ${int.format(identiques.nbFamilles)} familles au total`}
                />
              </div>
              <Histogram
                title="Répartition des familles selon leur nombre d'exemplaires"
                buckets={identiques.distribution}
                unitLabel="exemplaires"
                itemLabel="familles"
              />
              {identiques.topTextes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    Textes les plus concernés
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm tabular-nums">
                      <thead className="text-muted">
                        <tr>
                          <th className="py-2 font-normal">Texte</th>
                          <th className="py-2 pl-2 text-right font-normal">
                            Amend.
                          </th>
                          <th className="py-2 pl-2 text-right font-normal">
                            Identiques
                          </th>
                          <th className="py-2 pl-2 text-right font-normal">
                            Part
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {identiques.topTextes.map((t) => (
                          <tr key={t.texte} className="border-t border-line">
                            <td className="py-2 pr-4">
                              <span className="block">
                                {t.titre ?? t.texte}
                              </span>
                              {t.titre && (
                                <span className="text-xs text-muted">
                                  {t.texte}
                                </span>
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
                    Les données ne précisent pas l&apos;alinéa visé. Un
                    dispositif générique comme « Cet alinéa est supprimé » peut
                    donc viser des alinéas différents : ces cas (
                    {int.format(identiques.nbAmbigus)} amendements) sont écartés
                    plutôt que comptés comme identiques. Le chiffre affiché est
                    donc un minimum.
                  </li>
                  <li>
                    Seuls les {int.format(identiques.nbAvecTexte)} amendements
                    dont le texte est publié sont analysés.
                  </li>
                </ul>
              </div>
            </section>
          )}
        </Load>
      </Suspense>
    </main>
  );
}
