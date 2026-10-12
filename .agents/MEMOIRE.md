# Mémoire de travail AI Agora

## Décisions actives

- Frontend Next.js 16, interface française et architecture prête pour d’autres langues.
- Backend FastAPI, PostgreSQL, Redis, Celery et Alembic sous Docker Compose.
- Session web via cookie HttpOnly géré par Next.js ; le JWT n’est pas exposé au JavaScript.
- Les espaces de travail, fournisseurs et agents utilisent l’API réelle.
- Les salles, messages et événements seront raccordés dans le lot suivant.
- Les clés fournisseurs sont chiffrées par le backend et ne sont jamais restituées.

## État vérifié au 12/10/2026

- Images Docker construites et services backend, PostgreSQL, Redis, worker et frontend démarrés.
- Readiness FastAPI valide pour PostgreSQL et Redis.
- Inscription, connexion, espace actif et création d’un fournisseur vérifiés depuis l’interface.
- La création d’agent est vérifiée de bout en bout après correction de l’origine derrière Docker : l’agent Ariane apparaît dans l’interface et dans `agent_definitions` avec son fournisseur.

## Prochain objectif

1. Raccorder les salles, messages et flux SSE.
2. Remplacer les derniers libellés de démonstration dans ce parcours.
3. Ajouter la reprise de flux et les tests E2E associés.
