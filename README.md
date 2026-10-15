# Petit à petit — Questionnaire

Application Next.js en français, avec une question par étape et envoi des réponses
vers Google Sheets à la fin du parcours.

## Démarrer

```bash
npm install
npm run dev
```

L’application est disponible sur http://localhost:3000. Les fichiers principaux
sont `src/app/page.js`, `src/app/questions.json` et
`src/app/api/questionnaire/route.js`.

## Google Sheets

Consulter [la documentation de l’intégration](docs/google-sheets.md) pour la
configuration, l’ordre des 66 colonnes, les corrections apportées et les résultats
de vérification.

```bash
npm test
npm run build
npm run test:sheets:live
```

Le test live utilise les identifiants de `.env.local` et écrit uniquement dans un
onglet temporaire de test, supprimé ensuite. Ne pas versionner les identifiants.
