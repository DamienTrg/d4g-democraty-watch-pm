import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { findPlf } from "@/lib/textes";

export const metadata: Metadata = {
  title: "Projet de loi de finances — Democraty Watch",
};

/** Années essayées dans l'ordre : le PLF le plus récent disponible dans la base. */
const ANNEES = [2026, 2025];

async function TrouverPlf() {
  await connection();
  let erreur: string | null = null;
  let uid: string | null = null;
  try {
    for (const annee of ANNEES) {
      const plf = await findPlf(annee);
      if (plf) {
        uid = plf.uid;
        break;
      }
    }
  } catch (e) {
    erreur = e instanceof Error ? e.message : String(e);
  }
  // redirect() lève une exception de navigation : à appeler hors du try.
  if (uid) redirect(`/textes/${uid}`);

  return (
    <p className="text-sm text-red-700 dark:text-red-400">
      {erreur
        ? `Recherche impossible : ${erreur}`
        : `Aucun projet de loi de finances pour ${ANNEES.join(" ni ")} n'a été trouvé dans la base.`}
    </p>
  );
}

export default function PlfPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← Accueil
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">
        Projet de loi de finances
      </h1>
      <Suspense
        fallback={
          <p className="animate-pulse text-sm text-muted">
            Recherche du PLF le plus récent… (jusqu&apos;à une minute au premier
            chargement)
          </p>
        }
      >
        <TrouverPlf />
      </Suspense>
    </main>
  );
}
