# Backend AI Agora

API FastAPI du MVP AI Agora. Elle porte les invariants serveur qui ne peuvent
pas rester dans le navigateur : authentification, isolation par espace,
chiffrement des secrets, agents versionnés, cycle de vie des arènes,
idempotence, budgets et événements ordonnés.

## Architecture

- **FastAPI** : API REST, Swagger et flux SSE.
- **PostgreSQL** : comptes, configurations, messages, audit et journal d'événements.
- **Redis + Celery** : socle des futurs tours d'agents asynchrones.
- **Alembic** : évolution explicite du schéma.
- **Pydantic Settings** : configuration par variables d'environnement.

Les fournisseurs sont découplés du domaine. Leur clé est chiffrée au repos et
la route de test filtre les destinations privées par défaut pour réduire les
risques SSRF. Docker active explicitement les endpoints privés afin de pouvoir
joindre Ollama sur le réseau interne.

## Démarrage recommandé

Depuis la racine :

```sh
cp .env.example .env
docker compose up --build
```

Services exposés :

- frontend : <http://localhost:3000/fr>
- API : <http://localhost:8000/api/v1>
- Swagger : <http://localhost:8000/docs>
- ReDoc : <http://localhost:8000/redoc>
- métriques Prometheus : <http://localhost:8000/metrics>

Pour démarrer Ollama en plus :

```sh
docker compose --profile local-ai up --build
```

## Développement Python

Python 3.11 à 3.13 et `uv` sont requis.

```sh
uv sync --python 3.12
uv run alembic upgrade head
uv run uvicorn run:app --reload --port 8000
```

Contrôles :

```sh
uv run ruff check api tests run.py
uv run mypy api run.py
uv run pytest
```

## Variables sensibles

`JWT_SECRET` signe les jetons. `CREDENTIAL_ENCRYPTION_KEY` chiffre les clés de
fournisseurs avec Fernet et devient obligatoire en production. Elles ne doivent
jamais être commitées. En production, exécuter `alembic upgrade head` dans une
étape de déploiement unique avant de répliquer l'API.

## Contrat API

Toutes les réponses utilisent le camelCase. Une erreur suit ce format stable :

```json
{
  "error": {
    "code": "stale_room_version",
    "message": "L'arène a changé; rechargez-la avant de réessayer.",
    "requestId": "...",
    "fields": null
  }
}
```

Les commandes de création d'arène et de message demandent
`X-Idempotency-Key`. Les modifications concurrentes d'agent, d'arène et de
participant transmettent `expectedVersion`. Les événements se relisent par
curseur et le flux SSE reprend avec `Last-Event-ID`.

Le worker expose aujourd'hui le contrat durable `continue_room_turn`. La
stratégie de sélection d'agent, les appels réels aux modèles, le calcul des
coûts et l'annulation coopérative seront implémentés dans la prochaine tranche.
