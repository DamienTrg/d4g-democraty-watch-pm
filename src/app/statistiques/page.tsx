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
import {
  AmendementsSection,
  formatDate,
  IdentiquesSection,
  LoisSection,
} from "./sections";

export const metadata: Metadata = {
  title: "Statistiques — Democraty Watch",
};

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
        {title} · calculé le {title} · calculé le {formatDate(result.calculeLe)}
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
          Chaque section est recalculée au plus une fois par jour.
        </p>
      </header>

      <Suspense fallback={<Pending title="Lois et articles" />}>
        <Load title="Lois et articles" load={getLoiStats}>
          {(lois) => <LoisSection lois={lois} />}
        </Load>
      </Suspense>

      <Suspense fallback={<Pending title="Amendements par article" />}>
        <Load title="Amendements par article" load={getAmendementStats}>
          {(amendements) => <AmendementsSection amendements={amendements} />}
        </Load>
      </Suspense>

      <Suspense fallback={<Pending title="Amendements identiques" />}>
        <Load title="Amendements identiques" load={getIdentiquesStats}>
          {(identiques) => <IdentiquesSection identiques={identiques} />}
        </Load>
      </Suspense>
    </main>
  );
}
