# Mémoire de travail AI Agora

## Décisions actives

- Frontend Next.js 16, interface française et architecture prête pour d’autres langues.
- Backend FastAPI, PostgreSQL, Redis, Celery et Alembic sous Docker Compose.
- Session web via cookie HttpOnly géré par Next.js ; le JWT n’est pas exposé au JavaScript.
- Les espaces, fournisseurs, agents, salles, messages, réactions et statuts utilisent l’API réelle.
- Les événements de salle sont suivis par SSE avec reprise du dernier curseur en session.
- Les clés fournisseurs sont chiffrées par le backend et ne sont jamais restituées.

## État vérifié au 12/10/2026

- Images Docker construites et services backend, PostgreSQL, Redis, worker et frontend démarrés.
- Readiness FastAPI valide pour PostgreSQL et Redis.
- Inscription, connexion, espace actif et création d’un fournisseur vérifiés depuis l’interface.
- La création d’agent est vérifiée de bout en bout après correction de l’origine derrière Docker : l’agent Ariane apparaît dans l’interface et dans `agent_definitions` avec son fournisseur.
- Le parcours salle est vérifié de bout en bout : 2 participants, création et reprise, message, réaction et rafraîchissement SSE persistés dans PostgreSQL.
- Vérifications frontend valides : formatage, TypeScript, ESLint, build Next.js et 12 tests unitaires.

## Prochain objectif

1. Exécuter les tours d’agents via le worker et les fournisseurs configurés.
2. Ajouter des tests E2E automatisés pour le parcours API et la reprise SSE.
3. Compléter les métriques de consommation et de coût remontées par le backend.
