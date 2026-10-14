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
- `src/lib/stats.ts` — requêtes SQL des statistiques, mises en cache 1 h

## Sources des statistiques

- **Lois et articles** : schéma `legifrance` — textes principaux de `dossier_legislatif`, articles JORF de `article`.
- **Amendements par article** : schéma `assemblee` — table `amendements`, article visé lu dans `pointeurFragmentTexte.division`.
  Seuls les articles amendés au moins une fois sont connus ; les articles additionnels, titres et chapitres sont exclus.

## Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion `postgresql://user:password@host:5432/db` |
| `DATABASE_SSL` | `true` par défaut ; `false` pour une base locale sans SSL |

Ne commitez jamais `.env.local` : il contient vos identifiants.
