# Règles de travail AI Agora

## Lecture économe

- Commencer par ce fichier, puis lire `.agents/MEMOIRE.md`.
- Utiliser `rg` et des plages ciblées. Ne jamais afficher un dossier ou un gros fichier en entier sans nécessité.
- Limiter les sorties de commandes avec `--tail`, `sed -n` ou `max_output_tokens`.
- Ne pas relire un fichier déjà compris si son état n’a pas changé.
- Regrouper les recherches indépendantes et résumer les résultats utiles.
- Pour Docker, cibler le service et les dernières lignes de logs.

## Exécution

- Avancer par petits lots terminés : analyse ciblée, modification, tests pertinents, revue du diff, commit atomique.
- Le code réel prime sur la documentation historique.
- Préserver l’isolation par espace, les contrôles serveur, l’audit et l’absence de secrets côté navigateur.
- Maintenir le français par défaut et préparer les textes pour l’internationalisation.
- Commenter en français lorsque le raisonnement métier ou de sécurité n’est pas évident.
- Produire des messages de commit français, clairs, sans `Co-authored-by`.

## Validation proportionnée

- Frontend : format ciblé, typecheck, lint, tests utiles, build si routes/configuration changent.
- Backend : tests ciblés, Swagger/OpenAPI à jour, migration vérifiée si le schéma change.
- Parcours transverse : vérifier navigateur → Next.js → FastAPI → PostgreSQL.
- Ne répéter un contrôle vert que si un changement ultérieur peut l’invalider.

## Communication

- Donner des mises à jour courtes : résultat, incertitude, prochaine vérification.
- Ne pas recopier les journaux complets ; citer uniquement l’erreur causale.
- Le rapport final indique changements, validations, commit et limites réelles.
