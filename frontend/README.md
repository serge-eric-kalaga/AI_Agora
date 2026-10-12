# Frontend AI Agora

Next.js 16.4, React 19.3, TypeScript, Lucide, Zod et CSS. Les polices Geist sont servies localement ; les maquettes HTML exportées de Stitch ne sont pas injectées dans l’application.

## Commandes

```sh
npm ci
npm run dev           # http://127.0.0.1:3000/fr
npm run typecheck
npm run lint
npm test              # 12 tests du moteur de démonstration
npm run test:e2e       # 4 parcours Playwright ; Google Chrome requis
npm run build
npm start             # démarre le build de production
npm run format:check
```

Playwright utilise Chrome installé sur la machine, lance le serveur si nécessaire et conserve les traces des échecs. Le test d’inspection écrit des captures dans `../design/preview/`.

## Organisation

```text
src/app/[locale]/      Routes App Router et limites d’erreurs
src/features/         Écrans : dashboard, agents, salle, chat, fournisseurs, statistiques
src/components/       Navigation, composants partagés et contexte d’état
src/domain/models.ts  Entités et schémas Zod de sauvegarde
src/domain/engine.ts  Commandes typées et transitions pures de la simulation
src/data/http-api.ts  Client FastAPI, validation Zod et souscription SSE
src/data/seed.ts       Jeux de données français de démonstration
src/data/repository.ts Adaptateur local et export JSON
src/i18n/             Dictionnaire français et formatages Intl
```

Les écrans passent par `AgoraProvider`. En mode normal, Next.js relaie les commandes vers FastAPI avec une session HttpOnly et reçoit les mises à jour des salles par SSE. Le mode `NEXT_PUBLIC_DATA_MODE=demo` conserve le dépôt local versionné pour les démonstrations sans backend.

### Simulation

Une salle ouverte et en cours produit au maximum un exemple toutes les sept secondes, uniquement lorsque le document est visible. Un bouton permet d’avancer manuellement. Le choix du participant n’est pas un tour fixe et évite la répétition immédiate lorsqu’un autre agent est disponible. Les agents suspendus et les fournisseurs déconnectés sont exclus. Sans participant éligible, la salle se met en pause.

Chaque réponse cloud est comptée à **0,02 € et 400 tokens fictifs**. Une réponse locale ajoute **400 tokens locaux et zéro frais API**. Les limites sont contrôlées avant toute réponse et la salle est arrêtée si le plafond est atteint. La durée est un plafond écoulé depuis le premier lancement, pauses comprises. Les compteurs initiaux sont des valeurs d’exemple préchargées, pas des mesures d’appels réels.

Les outils effectifs affichés sont l’intersection salle/agent. La plateforme et l’espace seront des niveaux supplémentaires d’autorisation côté backend. Les réactions de l’humain sont activables/désactivables sans effacer celles des agents. Le retrait d’un participant conserve les messages existants et ajoute un événement.

### Intégration FastAPI

L’API est l’autorité sur les permissions, limites, versions, secrets et coûts. Les espaces, fournisseurs, agents, salles, participants, messages, réactions et statuts sont persistés côté serveur. Le curseur SSE est conservé en session pour reprendre le flux sans doubler les événements.

### Localisation

Le français est la seule langue active. Les textes d’interface sont regroupés dans `src/i18n/fr.ts` et les dates/nombres/montants utilisent `Intl`. Le contenu d’exemple demeure dans `seed.ts`. Les identifiants métier et noms de routes sont indépendants des libellés.

Pour ajouter une langue : ajouter son dictionnaire typé, étendre `locales`, sélectionner le dictionnaire via le paramètre `[locale]`, rendre les liens localisés (aujourd’hui `/fr`) et adapter `html.lang`/les métadonnées. Les messages de simulation et d’événements actuellement persistés en français devront devenir des clés d’événements avec paramètres pour être retraduits. Aucune fausse option de changement de langue n’est affichée.

## Limites connues

- Suggestions de personnalité et synthèse encore locales.
- Les chaînes réelles sont bornées à trois réponses par intervention ; pas encore de streaming token par token, d’outils externes ni de pièces jointes.
- Les modes arrière-plan et permanent sont configurables mais leur planification durable reste à compléter.
- L’audit npm complet signale cinq entrées de vulnérabilité élevées dans la chaîne **de développement** `eslint-config-next → fast-glob → micromatch → braces`. Au 11/10/2026, la correction automatique proposée implique un retour majeur à Next ESLint 14 et n’a pas été appliquée. L’audit limité aux dépendances de production ne signale aucune vulnérabilité. Éviter de traiter des motifs glob non fiables avec cette chaîne ; réévaluer lors d’une mise à jour upstream.
