# Intégration de la direction visuelle validée

La proposition du 13 octobre 2026 est intégrée aux parcours réels de Next.js.
L’aperçu indépendant reste archivé dans `design/proposition`.

## Parcours

- Navigation compacte avec laboratoire, portée globale du superadmin et déconnexion, y compris en mode réduit.
- Thèmes graphite et papier : sombre par défaut, préférence persistée et appliquée avant le premier affichage.
- Accueil éditorial, cartes de conversations et tableau avec laboratoire, participants, statut, messages et activité.
- Bibliothèque compacte, profils consultables et configuration séparée via `?edit=1`.
- Création des salles en quatre étapes ; mêmes réglages et validations serveur.
- Discussion avec composeur fixe, citations attribuées, panneaux et fenêtres adaptés au mobile.
- Fournisseurs, tableau des collaborateurs, invitation dans une fenêtre, notifications filtrables.
- Statistiques persistées, contributions, répartition humains/agents et tableau des conversations.

Les styles de présentation et les variables des deux thèmes sont centralisés dans
`frontend/src/app/design.css`. `globals.css` conserve les fondations et les comportements
existants ; les textes restent dans `frontend/src/i18n/fr.ts`.

## Données et sécurité

Le backend expose `messageCount` et `lastMessageAt` sur les salles. Les compteurs incluent
les fils et excluent les événements système. La liste utilise une agrégation unique,
indépendante du nombre de messages chargés dans le navigateur. Aucun changement de schéma SQL.
Les contrôles serveur, le routage par laboratoire et les sessions protégées restent actifs.
Les variantes de thème ne modifient pas les droits ni les réglages de conversation.

## Vérifications du 13 octobre 2026

- Frontend : TypeScript, ESLint, format ciblé, 13 tests et construction de production Docker.
- Backend : Ruff, mypy et 59 tests, dont les compteurs indépendants de la pagination.
- Navigateur : parcours réels sur ordinateur et à 390 × 844, thèmes clair/sombre,
  persistance après rechargement, menu réduit et mobile, profils et édition,
  création d’une salle en pause, modification persistée du sujet, invitation,
  notifications, statistiques, connexion/déconnexion et périmètres standard/superadmin.
- Les tableaux larges défilent dans leur conteneur ; les pages mobiles n’ont pas de
  débordement horizontal global. Le panneau de discussion reste consultable en fenêtre.

Salle créée pour cette validation dans le laboratoire dédié :
`23c00ad8-6d03-4e58-97d1-ee4d0fcb16ad`, en pause. Aucun email d’invitation envoyé.
Cette revue ciblée ne constitue pas un audit d’accessibilité complet.

## Aperçus de l’application déployée

- [Accueil sombre](accueil-sombre.png)
- [Accueil clair](accueil-clair.png)
- [Discussion mobile](discussion-mobile.png)

La version intégrée est active sur `http://127.0.0.1:3000/fr`. Les workers n’ont pas été
redémarrés pendant le déploiement de l’interface. La session de validation a été
rétablie sur le compte superadmin après le contrôle du compte standard.
