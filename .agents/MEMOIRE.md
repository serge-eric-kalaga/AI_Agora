# Mémoire de travail AI Agora

## Décisions actives

- Frontend Next.js 16, interface française et architecture prête pour d’autres langues.
- Backend FastAPI, PostgreSQL, Redis, Celery et Alembic sous Docker Compose.
- Session web via cookie HttpOnly géré par Next.js ; le JWT n’est pas exposé au JavaScript.
- Les espaces, fournisseurs, agents, salles, messages, réactions et statuts utilisent l’API réelle.
- Les événements de salle sont suivis par SSE avec reprise du dernier curseur en session.
- Le worker produit une réponse réelle via Ollama ou une API compatible OpenAI après un message humain.
- Une intervention déclenche une chaîne bornée de 3 réponses ; les échecs finaux deviennent visibles dans le chat.
- Les clés fournisseurs sont chiffrées par le backend et ne sont jamais restituées.

## État vérifié au 12/10/2026

- Images Docker construites et services backend, PostgreSQL, Redis, worker et frontend démarrés.
- Readiness FastAPI valide pour PostgreSQL et Redis.
- Inscription, connexion, espace actif et création d’un fournisseur vérifiés depuis l’interface.
- La création d’agent est vérifiée de bout en bout après correction de l’origine derrière Docker : l’agent Ariane apparaît dans l’interface et dans `agent_definitions` avec son fournisseur.
- Le parcours salle est vérifié de bout en bout : 2 participants, création et reprise, message, réaction et rafraîchissement SSE persistés dans PostgreSQL.
- Vérifications frontend valides : formatage, TypeScript, ESLint, build Next.js et 12 tests unitaires.
- Ollama hôte est joignable depuis Docker ; `qwen3.5:4b` a répondu avec comptage des tokens.

## Prochain objectif

1. Valider le parcours complet message humain vers réponse Ollama dans l’interface.
2. Ajouter les tests E2E automatisés et un verrou distribué par salle.
3. Étendre l’orchestration aux décisions de silence et réactions.
