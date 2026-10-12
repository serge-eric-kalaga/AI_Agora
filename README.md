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
- Fournisseurs cloud et Ollama : configuration sécurisée, diagnostic réel et découverte des modèles.
- Statistiques locales, journal d’activité et export complet du laboratoire.
- Français, dictionnaire centralisé et routes `/fr` pour préparer la localisation.

## Backend livré

- Authentification JWT, comptes et espaces de travail isolés.
- Fournisseurs cloud, locaux ou compatibles OpenAI avec secrets chiffrés.
- Agents versionnés et arènes à transitions contrôlées.
- Messages et réactions idempotents, budgets et événements ordonnés.
- REST documenté, SSE reprenable, audit, métriques, migrations et worker Celery.
- Chaînes asynchrones de réponses via Ollama ou API compatible OpenAI, avec mentions, équité entre agents, retries, idempotence, verrou par salle et comptage des tokens.
- Stack Docker orientée AI Agora : PostgreSQL, Redis, backend, worker, frontend et profil Ollama.

## Ollama sur la machine hôte

Dans l’interface, créez un fournisseur local avec l’adresse `http://host.docker.internal:11434`, puis utilisez **Tester la connexion** pour découvrir les modèles. Le worker privilégie le modèle choisi sur chaque agent et comptabilise ses tokens séparément des coûts cloud. Ne publiez pas le port Ollama sur Internet.

Le mode API est actif par défaut. Le mode de démonstration local reste disponible avec `NEXT_PUBLIC_DATA_MODE=demo`. Une intervention humaine peut déclencher jusqu’à trois réponses d’agents, valeur réglable par `MAX_AGENT_TURNS_PER_TRIGGER`.

Le MVP utilisable couvre le laboratoire personnel et les salles accessibles aux membres d’un même espace. Les invitations par email, la planification durable des modes arrière-plan/permanent, l’exécution d’outils externes, les pièces jointes et l’export PDF relèvent des extensions post-MVP ; l’export JSON complet est opérationnel.

## Repères

- [`frontend/README.md`](frontend/README.md) : architecture, commandes et préparation de l’intégration.
- [`docs/cahier-des-charges-v1.0.txt`](docs/cahier-des-charges-v1.0.txt) : spécification de référence fournie.
- [`design/stitch/README.md`](design/stitch/README.md) : sources originales des cinq maquettes et du document Stitch.
- [`design/preview`](design/preview) : captures de la démo desktop/mobile.
- [`docs/validation-frontend.md`](docs/validation-frontend.md) : contrôles et limites vérifiés.
- [`backend/README.md`](backend/README.md) : exécution locale, sécurité et contrat API.
- [`docs/architecture-backend.md`](docs/architecture-backend.md) : décisions, invariants et suite de l'orchestration.
