# Mémoire de travail AI Agora

## Décisions actives

- Frontend Next.js 16, interface française et architecture prête pour d’autres langues.
- Backend FastAPI, PostgreSQL, Redis, Celery et Alembic sous Docker Compose.
- Session web via cookie HttpOnly géré par Next.js ; le JWT n’est pas exposé au JavaScript.
- Les espaces, fournisseurs, agents, salles, messages, réactions et statuts utilisent l’API réelle.
- Les événements de salle sont suivis par SSE avec reprise du dernier curseur en session.
- Le worker produit une réponse réelle via Ollama ou une API compatible OpenAI après un message humain.
- Une salle active entretient une conversation autonome sans plafond de tours ; chaque réponse cite le
  message visé, ajoute une réaction d’agent et reste courte par défaut. Le choix du locuteur varie tout
  en favorisant les agents moins entendus. Un message humain remplace les relances plus anciennes.
- Un verrou Redis expirant sérialise les générations d’une même salle.
- Les clés fournisseurs sont chiffrées par le backend et ne sont jamais restituées.

## État vérifié au 12/10/2026

- Images Docker construites et services backend, PostgreSQL, Redis, worker et frontend démarrés.
- Readiness FastAPI valide pour PostgreSQL et Redis.
- Inscription, connexion, espace actif et création d’un fournisseur vérifiés depuis l’interface.
- La création d’agent est vérifiée de bout en bout après correction de l’origine derrière Docker : l’agent Ariane apparaît dans l’interface et dans `agent_definitions` avec son fournisseur.
- Le parcours salle est vérifié de bout en bout : 2 participants, création et reprise, message, réaction et rafraîchissement SSE persistés dans PostgreSQL.
- Vérifications frontend valides : formatage, TypeScript, ESLint, build Next.js et 12 tests unitaires.
- Ollama hôte est joignable depuis Docker ; `qwen3.5:4b` a produit une chaîne réelle `Socrate → Athéna → Socrate` depuis l’interface, persistée avec 3 531 tokens locaux et 0 € cloud.
- Vérifications backend valides : Ruff, mypy et 11 tests Pytest.
- Vérifications frontend valides : formatage, TypeScript, ESLint, build Next.js, 12 tests unitaires et 4 parcours Playwright.
- La configuration de production refuse les secrets faibles, les clés Fernet invalides, CORS `*` et les endpoints fournisseurs privés.

## Extensions post-MVP

1. Invitations par email et gestion visuelle des membres d’un espace.
2. Planification durable des salles en arrière-plan ou permanentes.
3. Outils externes, pièces jointes, streaming token par token et export PDF.
