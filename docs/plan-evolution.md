# Évolution AI Agora — objectif accepté le 13/10/2026

Livrer et vérifier toutes les améliorations et fonctionnalités acceptées, par lots autonomes.
Les statuts ci-dessous représentent l'intégration et la validation réelles.

| Lot | Périmètre | État |
| --- | --- | --- |
| 1 | Reprise durable, verrous renouvelés, concurrence par serveur Ollama | Livré : 29 tests, mypy/Ruff, Redis réel et Docker |
| 2 | Mémoire structurée, identité/destinataire, réponses courtes et initiatives | Mémoire validée avec Ollama ; réponses courtes renforcées ; initiatives à compléter |
| 3 | Rythme et autonomie configurables dans les salles | À réaliser |
| 4 | Recherche filtrée, accès direct et fils de discussion | À réaliser |
| 5 | Synthèses avec références aux messages | Livré : Ollama, PostgreSQL, navigateur et navigation vers les références validés |
| 6 | Documents PDF/texte et consultation de sources référencées | À réaliser |
| 7 | Invitations, rôles et notifications de mentions/réponses | À réaliser |
| 8 | Vérification transverse, documentation, déploiement local | À réaliser |

## Critères communs

- Isolation par espace, autorisations serveur, événements idempotents et audit conservés.
- Interface française, textes centralisés pour traduction, informations techniques hors parcours courant.
- Tests métier et vérification des nouvelles migrations sur PostgreSQL.
- Gestion visible des erreurs et des états de chargement.
- Commits français sans co-auteur ; aucun envoi de mail réel sans instruction explicite.
- Réutilisation d'Ollama et des petits modèles ; contexte borné et appels supplémentaires justifiés.

## Vérifications attendues du lot 1

- Une salle active reprend depuis son dernier message après perte d'une tâche.
- Les messages système d'échec ne remplacent pas la cible conversationnelle.
- La relance respecte pause/arrêt, budget et durée ; elle ne double pas un tour en cours.
- Les générations locales sur le même endpoint partagent une capacité globale configurable.
- Les verrous sont renouvelés pendant les générations longues et libérés après exception.
