# AI Agora

Frontend Next.js de démonstration d’un laboratoire conversationnel multi-agents. L’interface reprend l’identité des maquettes Stitch : bleu nuit, accents violet/cyan, navigation latérale et panneaux denses, avec adaptations responsive.

## Démarrage

Node.js 20.9 minimum (validé avec Node 24).

```sh
cd frontend
npm ci
npm run dev
```

Ouvrir [http://127.0.0.1:3000/fr](http://127.0.0.1:3000/fr).

## Livré

- Tableau de bord et liste des salles avec recherche et filtres.
- Bibliothèque d’agents : création, édition, duplication, activation/suspension.
- Éditeur de personnalité : profils locaux, quatre traits, instructions, modèle, température, tokens et permissions d’outils.
- Création de salle en six étapes : objectif, agents, règles, temporalité, visibilité, limites et lancement.
- Chat Markdown : messages humains, mentions textuelles, réponses citées, réactions, participants modifiables, pause/reprise/arrêt, synthèse locale et export JSON.
- Fournisseurs cloud et Ollama : catalogue d’exemples, connexions simulées et configuration d’endpoint non sensible.
- Statistiques locales, journal d’activité et export complet du laboratoire.
- Français, dictionnaire centralisé et routes `/fr` pour préparer la localisation.

## Périmètre de cette version

Tout fonctionne avec des données de démonstration dans le navigateur. Aucun appel IA, aucune dépense et aucun serveur Ollama ne sont contactés. La simulation sélectionne des agents disponibles et utilise des réponses prédéfinies ; elle ne constitue pas un orchestrateur IA réel.

Les données sont sauvegardées dans le `localStorage` de l’origine utilisée. `localhost` et `127.0.0.1` ont des sauvegardes distinctes. L’onglet courant constitue le périmètre d’édition ; la synchronisation simultanée entre onglets et entre appareils n’est pas implémentée. Après rechargement, les salles qui tournaient sont remises en pause. Les modes arrière-plan et permanent sont configurables, mais l’exécution durable attend le backend.

L’authentification, les invitations réelles, le RBAC serveur, les appels IA, les clés API, les outils externes, le streaming réseau et les exports PDF seront traités lors de l’intégration backend. Les mentions ne déclenchent pas encore de routage intelligent. Les réponses sont citées dans la conversation ; il n’y a pas encore de fils autonomes.

## Repères

- [`frontend/README.md`](frontend/README.md) : architecture, commandes et préparation de l’intégration.
- [`docs/cahier-des-charges-v1.0.txt`](docs/cahier-des-charges-v1.0.txt) : spécification de référence fournie.
- [`design/stitch/README.md`](design/stitch/README.md) : sources originales des cinq maquettes et du document Stitch.
- [`design/preview`](design/preview) : captures de la démo desktop/mobile.
- [`docs/validation-frontend.md`](docs/validation-frontend.md) : contrôles et limites vérifiés.

Le dossier `backend` est réservé à la phase FastAPI ; aucune implémentation backend n’a été ajoutée.
