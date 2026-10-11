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
src/domain/api.ts     Contrat d’intégration proposé pour FastAPI/SSE
src/data/seed.ts       Jeux de données français de démonstration
src/data/repository.ts Adaptateur local et export JSON
src/i18n/             Dictionnaire français et formatages Intl
```

Les écrans n’accèdent pas directement au stockage. `AgoraProvider` charge le dépôt, applique les commandes métier et persiste les mises à jour. Les sauvegardes sont versionnées (`ai-agora:workspace:v1`) et validées avec Zod. En cas de données invalides, une copie de récupération est tentée avant de revenir aux données initiales ; une alerte est affichée. En cas de stockage indisponible, l’interface reste utilisable en mémoire et prévient l’utilisateur.

### Simulation

Une salle ouverte et en cours produit au maximum un exemple toutes les sept secondes, uniquement lorsque le document est visible. Un bouton permet d’avancer manuellement. Le choix du participant n’est pas un tour fixe et évite la répétition immédiate lorsqu’un autre agent est disponible. Les agents suspendus et les fournisseurs déconnectés sont exclus. Sans participant éligible, la salle se met en pause.

Chaque réponse cloud est comptée à **0,02 € et 400 tokens fictifs**. Une réponse locale ajoute **400 tokens locaux et zéro frais API**. Les limites sont contrôlées avant toute réponse et la salle est arrêtée si le plafond est atteint. La durée est un plafond écoulé depuis le premier lancement, pauses comprises. Les compteurs initiaux sont des valeurs d’exemple préchargées, pas des mesures d’appels réels.

Les outils effectifs affichés sont l’intersection salle/agent. La plateforme et l’espace seront des niveaux supplémentaires d’autorisation côté backend. Les réactions de l’humain sont activables/désactivables sans effacer celles des agents. Le retrait d’un participant conserve les messages existants et ajoute un événement.

### Préparation FastAPI

`src/domain/api.ts` formalise le contrat envisagé, sans implémenter un faux client réseau. Pour raccorder le backend :

1. Introduire un adaptateur HTTP qui récupère les entités et exécute les commandes. L’API devient l’autorité sur les permissions, limites, versions et coûts.
2. Remplacer la boucle de simulation par une souscription SSE ou WebSocket versionnée, avec curseur, reconnexion et déduplication.
3. Conserver les composants de présentation et remplacer les données de démonstration dans le contexte.
4. Faire gérer les secrets, l’authentification, le RBAC et les connecteurs par le serveur. Ne pas ajouter de clés API au `localStorage` ni à des variables `NEXT_PUBLIC_*`.
5. Séparer les versions/instances d’agents, les invocations facturées et les événements serveur selon le cahier des charges complet.

La sauvegarde actuelle de l’état complet est un adaptateur de démo, pas une proposition d’API de persistance production.

### Localisation

Le français est la seule langue active. Les textes d’interface sont regroupés dans `src/i18n/fr.ts` et les dates/nombres/montants utilisent `Intl`. Le contenu d’exemple demeure dans `seed.ts`. Les identifiants métier et noms de routes sont indépendants des libellés.

Pour ajouter une langue : ajouter son dictionnaire typé, étendre `locales`, sélectionner le dictionnaire via le paramètre `[locale]`, rendre les liens localisés (aujourd’hui `/fr`) et adapter `html.lang`/les métadonnées. Les messages de simulation et d’événements actuellement persistés en français devront devenir des clés d’événements avec paramètres pour être retraduits. Aucune fausse option de changement de langue n’est affichée.

## Limites connues

- Prototype frontend, sans garantie de sécurité multi-utilisateur ni synchronisation réseau.
- Suggestions de personnalité et synthèse locales, sans génération IA.
- Pas de découverte de modèles réelle, streaming, exécution d’outils, téléchargement de pièces jointes ni conversations en tâche de fond.
- Le catalogue et ses noms de modèles sont illustratifs.
- L’audit npm complet signale cinq entrées de vulnérabilité élevées dans la chaîne **de développement** `eslint-config-next → fast-glob → micromatch → braces`. Au 11/10/2026, la correction automatique proposée implique un retour majeur à Next ESLint 14 et n’a pas été appliquée. L’audit limité aux dépendances de production ne signale aucune vulnérabilité. Éviter de traiter des motifs glob non fiables avec cette chaîne ; réévaluer lors d’une mise à jour upstream.
