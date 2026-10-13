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

Pour un déploiement HTTPS, configurez `APP_ENVIRONMENT=production`,
`AGORA_COOKIE_SECURE=true` et `ALLOW_PRIVATE_PROVIDER_ENDPOINTS=false`. Le
backend refuse de démarrer si le secret JWT est faible, si la clé Fernet est
absente ou invalide, si CORS accepte `*`, ou si les endpoints privés restent
autorisés.

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

Le worker exécute `continue_room_turn` après chaque message d’une salle active et
entretient ensuite une conversation autonome. Une mention explicite sélectionne
l’agent visé ; sinon la prise de parole varie tout en favorisant les participants
les moins entendus et ceux qui ne viennent pas d’intervenir. Le délai entre deux
tours est réglé par `AUTONOMOUS_TURN_DELAY_SECONDS`. Les appels Ollama et OpenAI
compatibles sont normalisés, idempotents et soumis aux limites de durée et de coût.
Les tokens locaux et cloud sont comptabilisés séparément. Un nouveau message humain
remplace les relances encore en attente, mais une réponse déjà en préparation peut
terminer sur sa cible d’origine. Deux parcours indépendants par fil permettent de
répondre au même message ou de revenir sur une autre intervention récente. Un agent
peut aussi lancer une idée, réagir ou se taire. Le choix exclut les questions adressées
explicitement à un autre agent et les messages auxquels il a déjà répondu.
Un pointeur Redis par parcours borne les relances ; les événements PostgreSQL servent
à les reconstruire après une panne. L’idempotence est propre à chaque parcours.
Les verrous expirants `ROOM_TURN_LOCK_SECONDS` protègent chaque parcours et chaque
agent : deux agents peuvent préparer leurs réponses ensemble, un même agent garde
une seule génération à la fois. La publication, le budget et les séquences restent
sérialisés par verrou de ligne PostgreSQL. La capacité Ollama reste partagée et régulée
par `LOCAL_PROVIDER_CONCURRENCY` ; deux parcours n’impliquent pas deux générations
locales simultanées si cette capacité vaut un.
Docker Compose démarre trois répliques Celery par défaut, configurables avec
`WORKER_REPLICAS`, afin que plusieurs salles puissent progresser en parallèle.
Chaque réplique utilise deux processus par défaut, réglables avec
`WORKER_CONCURRENCY`, pour préserver les ressources du fournisseur local.

Pour joindre un Ollama déjà lancé sur la machine hôte depuis Docker, configurez
le fournisseur avec `http://host.docker.internal:11434`. Sans Docker, utilisez
`http://127.0.0.1:11434`. Le bouton de diagnostic découvre les modèles exposés.
