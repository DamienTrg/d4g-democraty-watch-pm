# Democraty Watch

Application Next.js du projet DataForGood **Democraty Watch**, connectée à une base PostgreSQL.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseignez DATABASE_URL
npm run dev
```

Ouvrez http://localhost:3000 : la page d'accueil indique si la connexion à la base fonctionne.
L'endpoint `GET /api/health` renvoie le même diagnostic en JSON.

## Structure

- `src/lib/db.ts` — pool de connexions PostgreSQL (`pg`) et helper `query()` pour des requêtes paramétrées
- `src/app/api/health/route.ts` — vérification de la connexion
- `src/app/page.tsx` — page d'accueil
- `src/app/statistiques/` — page de statistiques (lois, articles, amendements)
- `src/app/textes/[uid]/` — lecture d'un texte article par article, avec ses amendements
  (`/textes/plf` ouvre le projet de loi de finances le plus récent : 2026, sinon 2025)
- `src/lib/stats.ts` — requêtes SQL des statistiques
- `src/lib/cache.ts` — cache sur disque (`.cache/stats/`), 24 h par défaut

## Cache des statistiques

Les statistiques sont calculées au plus une fois par 24 h et enregistrées dans `.cache/stats/`
(conservé entre deux redémarrages). Passé ce délai, les anciens chiffres restent affichés
pendant le recalcul en arrière-plan. Pour forcer un recalcul immédiat :

```bash
npm run stats:reset
```

## Sources des statistiques

- **Lois et articles** : schéma `legifrance` — textes principaux de `dossier_legislatif`, articles JORF de `article`.
- **Amendements par article** : schéma `assemblee` — table `amendements`, article visé lu dans `pointeurFragmentTexte.division`.
  Seuls les articles amendés au moins une fois sont connus ; les articles additionnels, titres et chapitres sont exclus.
- **Amendements identiques** : même texte, même article, même dispositif (`corps.contenuAuteur.dispositif`),
  comparé à deux niveaux : texte brut au caractère près, et après normalisation (balises, entités HTML,
  espaces, ponctuation et majuscules ignorés ; accents conservés).
  L'alinéa visé n'étant pas stocké, les dispositifs génériques (« Cet alinéa est supprimé ») sont écartés : le chiffre est un minimum.

## Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion `postgresql://user:password@host:5432/db` |
| `DATABASE_SSL` | `true` par défaut ; `false` pour une base locale sans SSL |
| `STATS_CACHE_HOURS` | Durée de cache des statistiques, en heures (défaut : 24) |
| `DATABASE_LONG_QUERY_TIMEOUT_MS` | Délai max. des requêtes de statistiques (défaut : 300000 = 5 min) |

Ne commitez jamais `.env.local` : il contient vos identifiants.

## Page statique (GitHub Pages)

Une version statique de la page de statistiques peut être publiée sur GitHub Pages.
Elle ne se connecte pas à la base : elle affiche un instantané des chiffres.

1. Générer la page (là où la base est accessible) :
   ```bash
   npm run static
   ```
   Cela crée `docs/index.html`, `docs/styles.css` et `docs/donnees.json` (les données brutes).
2. Publier :
   ```bash
   git add docs && git commit -m "Mettre à jour la page statique" && git push
   ```
3. Une seule fois : sur GitHub, **Settings → Pages → Build and deployment** →
   Source « Deploy from a branch », branche `main`, dossier `/docs`.

Pour mettre à jour les chiffres plus tard, refaire les étapes 1 et 2.
La page utilise le cache de 24 h : `npm run stats:reset` avant pour forcer un recalcul.
