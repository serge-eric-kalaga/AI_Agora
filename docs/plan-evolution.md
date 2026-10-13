# Évolution AI Agora — objectif accepté le 13/10/2026

Livrer et vérifier toutes les améliorations et fonctionnalités acceptées, par lots autonomes.

Extension acceptée : fournir un compte superadmin local et une interface sécurisée permettant de voir tous les utilisateurs et toutes les salles, dans tous les espaces. Communiquer les identifiants de chaque compte local utilisé pour la validation.
Les statuts ci-dessous représentent l'intégration et la validation réelles.

| Lot | Périmètre | État |
| --- | --- | --- |
| 1 | Reprise durable, verrous renouvelés, concurrence par serveur Ollama | Livré : 29 tests, mypy/Ruff, Redis réel et Docker |
| 2 | Mémoire structurée, identité/destinataire, réponses courtes et initiatives | Livré : identité et auteur humain attribués, choix réponse/initiative/réaction/silence, reprise idempotente ; échanges Ollama sans nouvelle intervention humaine |
| 3 | Rythme et autonomie configurables dans les salles | Livré : 36 tests backend, permissions/version, migration PostgreSQL et enregistrement navigateur |
| 4 | Recherche filtrée, accès direct et fils de discussion | Livré : recherche, fils isolés, reprise par fil ; 38 tests, migration et réponses Ollama/navigation navigateur validées |
| 5 | Synthèses avec références aux messages | Livré : Ollama, PostgreSQL, navigateur et navigation vers les références validés |
| 6 | Documents PDF/texte et consultation de sources référencées | Livré : 48 tests backend, extraction PDF, permissions, URL publiques contrôlées ; document/source/citation Ollama et téléchargement réel validés |
| 7 | Invitations, rôles et notifications de mentions/réponses | Livré : droits et liens à usage unique testés ; invitation réelle, notification et accès direct au message validés |
| 8 | Vérification transverse, documentation, déploiement local | Livré : sessions renouvelables, Docker, migrations et parcours réels ; 58 tests backend et 12 tests frontend |
| 9 | Compte superadmin, vue globale utilisateurs et salles | Livré : compte créé, accès global en lecture et refus des comptes standards testés ; interface sécurisée |

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

## Limites explicites

- Les invitations sont partagées par lien : aucun email automatique n’est envoyé.
- Les sources web sont consultées depuis les URL ajoutées dans la salle ; leur texte et leur date sont conservés, sans recherche générale autonome.
- Les PDF scannés nécessitent une version contenant du texte ; aucun OCR n’est présenté comme réalisé.
- Les références prouvent la provenance d’un propos ; elles ne certifient pas sa vérité. Les petits modèles peuvent encore produire des approximations.
- Les salles temporaires gardent leur échéance ; « Continuer sans échéance » active le mode permanent.
