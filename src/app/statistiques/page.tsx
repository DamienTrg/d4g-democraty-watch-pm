import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getStats } from "@/lib/stats";
import { Histogram } from "./Histogram";

export const metadata: Metadata = {
  title: "Statistiques — Democraty Watch",
};

const int = new Intl.NumberFormat("fr-FR");
const dec = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const num = (v: number | null) => (v == null ? "—" : dec.format(v));

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-1 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export default async function StatistiquesPage() {
  await connection();

  let stats;
  try {
    stats = await getStats();
  } catch (error) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Statistiques</h1>
        <p className="mt-4 text-red-700 dark:text-red-400">
          Impossible de calculer les statistiques :{" "}
          {error instanceof Error ? error.message : String(error)}
        </p>
      </main>
    );
  }

  const { lois, amendements } = stats;
  const exclus = amendements.nbAmendementsTotal - amendements.nbAmendementsSurArticle;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Accueil
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Statistiques des textes de loi</h1>
        <p className="text-sm text-muted">
          Calculé le{" "}
          {stats.calculeLe.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" })}
          {" "}· mis à jour toutes les heures
        </p>
      </header>

      {/* Chiffre principal */}
      <section className="flex flex-col gap-1">
        <span className="text-sm text-muted">Textes de loi promulgués</span>
        <span className="text-6xl font-semibold tracking-tight">{int.format(lois.nbLoisPromulguees)}</span>
        <span className="text-sm text-muted">
          Lois disposant d&apos;un dossier législatif sur Légifrance
        </span>
      </section>

      {/* Articles par loi */}
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold">Articles par texte de loi</h2>
          <p className="mt-1 text-sm text-muted">
            Source : Légifrance, version publiée au Journal officiel. Tous les articles sont comptés,
            qu&apos;ils aient été amendés ou non.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Nombre moyen" value={num(lois.moyenneArticles)} hint="articles par loi" />
          <Tile label="Nombre médian" value={num(lois.medianeArticles)} hint="articles par loi" />
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

      {/* Amendements par article */}
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold">Amendements par article</h2>
          <p className="mt-1 text-sm text-muted">
            Source : Assemblée nationale. Un article = un article d&apos;un texte en discussion
            (projet ou proposition de loi, dans une version donnée).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Nombre moyen" value={num(amendements.moyenneAmendements)} hint="amendements par article" />
          <Tile label="Nombre médian" value={num(amendements.medianeAmendements)} hint="amendements par article" />
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
          <p className="font-medium text-foreground">À lire avant d&apos;interpréter ces chiffres</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Seuls les articles ayant reçu <strong>au moins un amendement</strong> sont connus : les
              articles jamais amendés manquent, ce qui tire la moyenne et la médiane vers le haut.
            </li>
            <li>
              Les articles visés sont ceux du texte en discussion : leur numérotation ne correspond pas
              forcément à celle de la loi promulguée.
            </li>
            <li>
              {int.format(exclus)} amendements sur {int.format(amendements.nbAmendementsTotal)} ne
              visent pas un article existant (articles additionnels, titres, chapitres…) et ne sont pas
              comptés ici.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
