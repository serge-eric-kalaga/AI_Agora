# AI Agora

Plateforme de laboratoire conversationnel multi-agents. Le frontend Next.js reprend l’identité des maquettes Stitch et le backend FastAPI pose les invariants transactionnels du MVP.

## Démarrage

Node.js 20.9 minimum (validé avec Node 24).

```sh
cd frontend
npm ci
npm run dev
```

Ouvrir [http://127.0.0.1:3000/fr](http://127.0.0.1:3000/fr).

Pour lancer la plateforme complète avec PostgreSQL, Redis, l'API et le worker :

```sh
cp .env.example .env
docker compose up --build
```

Swagger est disponible sur [http://localhost:8000/docs](http://localhost:8000/docs).

## Livré

- Tableau de bord et liste des salles avec recherche et filtres.
- Bibliothèque d’agents : création, édition, duplication, activation/suspension.
- Éditeur de personnalité : profils locaux, quatre traits, instructions, modèle, température, tokens et permissions d’outils.
- Création de salle en six étapes : objectif, agents, règles, temporalité, visibilité, limites et lancement.
- Chat Markdown : messages humains, mentions textuelles, réponses citées, réactions, participants modifiables, pause/reprise/arrêt, synthèse locale et export JSON.
- Fournisseurs cloud et Ollama : catalogue d’exemples, connexions simulées et configuration d’endpoint non sensible.
- Statistiques locales, journal d’activité et export complet du laboratoire.
- Français, dictionnaire centralisé et routes `/fr` pour préparer la localisation.

## Backend livré

- Authentification JWT, comptes et espaces de travail isolés.
- Fournisseurs cloud, locaux ou compatibles OpenAI avec secrets chiffrés.
- Agents versionnés et arènes à transitions contrôlées.
- Messages et réactions idempotents, budgets et événements ordonnés.
- REST documenté, SSE reprenable, audit, métriques, migrations et worker Celery.
- Stack Docker orientée AI Agora : PostgreSQL, Redis, backend, worker, frontend et profil Ollama.

## Périmètre de cette version

Le frontend continue à fonctionner avec ses données de démonstration dans le navigateur et n'est pas encore branché sur l'API. Aucun appel IA ni aucune dépense ne sont déclenchés. Le backend prépare l'orchestration durable, mais la stratégie de tours et les appels aux modèles seront traités dans la prochaine tranche.

Les données sont sauvegardées dans le `localStorage` de l’origine utilisée. `localhost` et `127.0.0.1` ont des sauvegardes distinctes. L’onglet courant constitue le périmètre d’édition ; la synchronisation simultanée entre onglets et entre appareils n’est pas implémentée. Après rechargement, les salles qui tournaient sont remises en pause. Les modes arrière-plan et permanent sont configurables, mais l’exécution durable attend le backend.

Les invitations, les appels IA, les outils externes, l'intégration du frontend, les exports PDF et les fils autonomes restent à réaliser. Les mentions ne déclenchent pas encore de routage intelligent.

## Repères

- [`frontend/README.md`](frontend/README.md) : architecture, commandes et préparation de l’intégration.
- [`docs/cahier-des-charges-v1.0.txt`](docs/cahier-des-charges-v1.0.txt) : spécification de référence fournie.
- [`design/stitch/README.md`](design/stitch/README.md) : sources originales des cinq maquettes et du document Stitch.
- [`design/preview`](design/preview) : captures de la démo desktop/mobile.
- [`docs/validation-frontend.md`](docs/validation-frontend.md) : contrôles et limites vérifiés.
- [`backend/README.md`](backend/README.md) : exécution locale, sécurité et contrat API.
- [`docs/architecture-backend.md`](docs/architecture-backend.md) : décisions, invariants et suite de l'orchestration.
