# Validation de l’application — 12 octobre 2026

## Résultats

| Contrôle | Résultat |
| --- | --- |
| TypeScript (`npm run typecheck`) | Réussi |
| ESLint (`npm run lint`) | Réussi, sans erreur ni avertissement |
| Build Next.js de production (`npm run build`) | Réussi |
| Tests métier (`npm test`) | 12/12 réussis |
| Parcours navigateur (`npm run test:e2e`) | 4/4 réussis |
| Backend (`ruff`, `mypy`, `pytest`) | Réussi, 11/11 tests |
| Docker Compose | Configuration valide, 5 services actifs |
| Parcours réel Ollama | Réussi avec `qwen3.5:4b` |
| Débordements horizontaux à 390 × 844 | Aucun sur les sept pages testées |
| Captures desktop à 1440 × 1000 | Six écrans capturés et contrôlés |
| Exceptions JavaScript dans les parcours principaux | Aucune capturée |
| Audit des dépendances de production | 0 vulnérabilité signalée |

## Parcours vérifiés

1. Créer un agent, appliquer un profil local, régler ses instructions/outils, enregistrer et retrouver l’agent après rechargement.
2. Créer une salle avec deux agents, règles, permissions, temporalité, visibilité et budget ; envoyer un message Markdown, réagir, lancer une réponse en mode démonstration, mettre en pause, recharger et exporter le JSON.
3. Rechercher un agent, utiliser la recherche globale, refuser un endpoint Ollama invalide, enregistrer un endpoint valide et vérifier la persistance.
4. Retirer puis ajouter un participant sans perdre les messages ; répondre à un message et retrouver sa citation après rechargement.
5. Afficher dashboard, bibliothèque, éditeur, création de salle, fournisseurs, statistiques et chat sur mobile ; naviguer avec le menu mobile.

Les tests métier couvrent notamment les plafonds de budget/durée/activité, les agents indisponibles, les permissions intersectées, les réactions, l’usage local sans facturation cloud et le rejet des références de réponse entre salles.

## Parcours API et Ollama réel

Depuis l’interface Docker, un compte isolé a configuré Ollama sur
`http://host.docker.internal:11434`, découvert les modèles disponibles, créé
Socrate et Athéna avec `qwen3.5:4b`, puis lancé une salle. Une intervention
humaine a produit trois réponses successives `Socrate → Athéna → Socrate`.
Après rechargement, PostgreSQL contenait les cinq réponses d’agents du scénario,
3 531 tokens locaux, zéro token cloud et 0 € dépensé. Le flux SSE, l’historique,
les compteurs et la reprise après rechargement ont été contrôlés dans le navigateur.

## Portée

Les tests automatisés valident le moteur de démonstration, le rendu navigateur,
les contrats serveur, l’isolation des espaces, le chiffrement des secrets,
l’idempotence, les budgets, le verrou distribué et l’orchestration simulée des
fournisseurs. Le parcours Ollama réel est une validation locale reproductible ;
il dépend des modèles installés sur la machine. Les outils externes, pièces
jointes et planifications durables ne font pas partie du MVP validé.

Les captures se trouvent dans [`../design/preview/`](../design/preview/). Les traces temporaires de tests sont ignorées via `.gitignore`.
