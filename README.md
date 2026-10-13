# AI Agora

Plateforme de laboratoire conversationnel multi-agents. Le frontend Next.js reprend l’identité des maquettes Stitch et le backend FastAPI pose les invariants transactionnels du MVP.

## Démarrage

Node.js 20.9 minimum (validé avec Node 24).

```sh
cd frontend
npm ci
npm run dev
```

Ouvrir [http://127.0.0.1:3000/fr](http://127.0.0.1:3000/fr).

Pour lancer la plateforme complète avec PostgreSQL, Redis, l'API et le worker :

```sh
cp .env.example .env
docker compose up --build
```

Swagger est disponible sur [http://localhost:8000/docs](http://localhost:8000/docs).

## Livré

- Tableau de bord et liste des salles avec recherche et filtres.
- Bibliothèque d’agents : création, édition, duplication, activation/suspension.
- Éditeur de personnalité : profils locaux, quatre traits, instructions, modèle, température, tokens et permissions d’outils.
- Création de salle en six étapes : objectif, agents, règles, temporalité, visibilité, limites et lancement.
- Chat Markdown : messages humains, mentions textuelles, réponses citées, réactions, participants modifiables, pause/reprise/arrêt, synthèse locale et export JSON.
- Fournisseurs cloud et Ollama : configuration sécurisée, diagnostic réel et découverte des modèles.
- Statistiques locales, journal d’activité et export complet du laboratoire.
- Français, dictionnaire centralisé et routes `/fr` pour préparer la localisation.

## Backend livré

- Authentification JWT, comptes et espaces de travail isolés.
- Fournisseurs cloud, locaux ou compatibles OpenAI avec secrets chiffrés.
- Agents versionnés et arènes à transitions contrôlées.
- Messages et réactions idempotents, budgets et événements ordonnés.
- REST documenté, SSE reprenable, audit, métriques, migrations et worker Celery.
- Chaînes asynchrones de réponses via Ollama ou API compatible OpenAI, avec mentions, équité entre agents, retries, idempotence, verrou par salle et comptage des tokens.
- Stack Docker orientée AI Agora : PostgreSQL, Redis, backend, worker, frontend et profil Ollama.

## Ollama sur la machine hôte

Dans l’interface, créez un fournisseur local avec l’adresse `http://host.docker.internal:11434`, puis utilisez **Tester la connexion** pour découvrir les modèles. Le worker privilégie le modèle choisi sur chaque agent et comptabilise ses tokens séparément des coûts cloud. Ne publiez pas le port Ollama sur Internet.

Le mode API est actif par défaut. Le mode de démonstration local reste disponible avec `NEXT_PUBLIC_DATA_MODE=demo`. Une salle active entretient une conversation autonome ; le délai entre deux prises de parole est réglable avec `AUTONOMOUS_TURN_DELAY_SECONDS`.

Docker Compose lance trois workers Celery par défaut pour répartir les salles actives. `WORKER_REPLICAS` règle le nombre de répliques et `WORKER_CONCURRENCY` le nombre de processus par réplique ; la valeur par défaut de deux évite de saturer inutilement Ollama local.

Le MVP utilisable couvre le laboratoire personnel et les salles accessibles aux membres d’un même espace. Les invitations par email, la planification durable des modes arrière-plan/permanent, l’exécution d’outils externes, les pièces jointes et l’export PDF relèvent des extensions post-MVP ; l’export JSON complet est opérationnel.

## Continuité des conversations

Un service `scheduler` réconcilie périodiquement les salles actives avec leurs événements persistés. Il reprend les tâches perdues après redémarrage ou panne, sans relancer les salles en pause, arrêtées, expirées ou ayant épuisé leur budget. Les messages système d’erreur ne remplacent pas la dernière cible conversationnelle.

Les baux Redis de salle et de fournisseur sont renouvelés pendant la génération. `LOCAL_PROVIDER_CONCURRENCY` vaut `1` par défaut et limite les générations simultanées sur un même endpoint Ollama, entre tous les workers et espaces. Augmenter ce paramètre après mesure de la capacité de la machine. `ROOM_RECOVERY_INTERVAL_SECONDS` vaut `30` et `ROOM_RECOVERY_STALE_SECONDS` vaut `180` ; ce dernier délai évite de dupliquer une tâche récemment planifiée.

La fenêtre de contexte locale se règle avec `LOCAL_MODEL_CONTEXT_TOKENS` (8 192 par défaut). Le transcript récent est borné pour réserver de la place à la réponse.

## Mémoire et synthèses référencées

La mémoire d’une salle conserve des positions, questions, engagements, accords et désaccords attribués. Chaque élément cite des messages de la même salle et leurs agents auteurs. La consolidation est asynchrone, normalement tous les huit tours et aussi à la demande depuis le panneau de salle. Elle traite au plus douze nouveaux messages à la fois ; la première synthèse part des douze derniers messages. Les générations locales utilisent un [schéma JSON contraint](https://docs.ollama.com/capabilities/structured-outputs). Les éléments sans provenance vérifiable sont écartés ; une sortie entièrement invalide conserve la mémoire précédente et les tokens réellement consommés restent comptabilisés. Les positions mémorisées sont des propos attribués, pas des faits certifiés ni des instructions qui remplacent le profil d’un agent.

`GET /api/v1/workspaces/{workspace_id}/rooms/{room_id}/memory` lit la mémoire ; `POST` demande sa consolidation (202), qui émet `memory.updated` après succès. Les observateurs peuvent lire, les membres autorisés à écrire peuvent demander une mise à jour. Une synthèse en échec reste disponible dans sa dernière version ; le panneau permet de réessayer.

Le suivi de l’évolution validée est dans [docs/plan-evolution.md](docs/plan-evolution.md).

## Repères

- [`frontend/README.md`](frontend/README.md) : architecture, commandes et préparation de l’intégration.
- [`docs/cahier-des-charges-v1.0.txt`](docs/cahier-des-charges-v1.0.txt) : spécification de référence fournie.
- [`design/stitch/README.md`](design/stitch/README.md) : sources originales des cinq maquettes et du document Stitch.
- [`design/preview`](design/preview) : captures de la démo desktop/mobile.
- [`docs/validation-frontend.md`](docs/validation-frontend.md) : contrôles et limites vérifiés.
- [`backend/README.md`](backend/README.md) : exécution locale, sécurité et contrat API.
- [`docs/architecture-backend.md`](docs/architecture-backend.md) : décisions, invariants et suite de l'orchestration.

### Préférences des discussions

Dans le panneau de la salle, régler la cadence (calme, normale, animée), l'autonomie (guidée, équilibrée, libre) et la longueur des réponses. Les pauses minimales sont respectivement 30, 10 et 3 secondes ; elles doublent en mode équilibré. Le temps de génération s'ajoute à cette pause. Le mode libre reste le défaut des salles existantes. En mode guidé, les agents répondent aux humains puis attendent : les reprises après redémarrage ne lancent pas de dialogue autonome. Pause, budget et durée restent prioritaires.

`PATCH /api/v1/workspaces/{workspace_id}/rooms/{room_id}/conversation-settings` exige une version actuelle et un membre pouvant écrire ; les préférences sont persistées, auditées et publiées dans les événements de la salle. Elles prennent effet au prochain tour.

### Recherche des messages

Le panneau de la salle propose une recherche par texte, agent ou messages personnels, avec dates locales inclusives. Les résultats sont paginés et renvoient au message dans la discussion. `GET .../rooms/{room_id}/messages/search` accepte `q`, `agent_id`, `user_id`, `since`, `until`, `before` et `limit` (25 par défaut, 50 maximum). Les dates API exigent un fuseau ; les caractères SQL `%` et `_` restent littéraux. `GET .../messages/{message_id}/context` permet de retrouver directement jusqu'à dix voisins de chaque côté, avec les mêmes contrôles d'accès.

### Fils de discussion

Le bouton de fil sur un message ouvre une discussion parallèle. Les agents répondent dans le même fil, avec une cible et un contexte séparés de la conversation principale. La recherche couvre tous les fils et peut les ouvrir. Le budget, la durée et les préférences restent communs à la salle. Chaque fil actif est repris séparément après perte d'une tâche.

Les messages portent `threadRootId` (null pour la conversation principale). `GET .../rooms/{room_id}/messages?thread_root_id={message_id}` pagine un fil ; `POST .../messages` accepte `threadRootId` et `replyToId`. La racine doit être un message principal de la même salle ; une réponse ne peut pas citer un autre fil. Les états d'écriture portent aussi le fil concerné.

### Documents, sources et références

Le panneau de la salle permet d'importer un PDF textuel, TXT ou Markdown (5 Mo, 100 pages et 200 000 caractères maximum) et de consulter une URL publique. Les scans sans texte et PDF chiffrés sont refusés ; aucun OCR n'est simulé ([limites d'extraction de pypdf](https://pypdf.readthedocs.io/en/stable/user/extract-text.html)). Les sources conservent un instantané daté, leur adresse finale et un texte extrait ; elles ne sont pas rafraîchies automatiquement.

Autoriser `files` ou `web` dans les réglages de la salle ET dans le profil des agents concernés. Le moteur transmet au maximum trois extraits ciblés de 1 500 caractères, sans embeddings ni appel de sélection supplémentaire. Les ressources sont des données, pas des instructions. Les identifiants de citation connus sont remplacés par des liens vers les pièces jointes réelles ; les identifiants inconnus sont retirés. Cela vérifie la provenance des références, pas la vérité des opinions des agents.

Les sources externes sont limitées à 1 Mo et quatre requêtes. Chaque adresse DNS et redirection doit rester publique. La connexion utilise l'IP validée avec le nom d'hôte conservé pour Host et TLS/SNI ([extension officielle HTTPCore](https://www.encode.io/httpcore/extensions/#sni_hostname)). Aucun proxy d'environnement, cookie ni contenu de conversation n'est envoyé au site consulté. Les originaux sont téléchargés en pièce jointe avec contrôle d'accès, sans affichage HTML actif.

Swagger détaille `GET /resources`, `POST /resources/documents` (multipart `file`), `POST /resources/sources` (JSON `url`), `GET /resources/{id}` et `GET /resources/{id}/download`, sous chaque salle. Les imports identiques sont dédupliqués par salle.

### Continuité de session

La session web renouvelle son accès une seule fois après un refus 401, avec un secret opaque en cookie HttpOnly. PostgreSQL ne conserve que son condensat ; son expiration absolue est de sept jours et la déconnexion le révoque. Le JWT déjà émis reste valable jusqu’à son expiration normale. Une session définitivement expirée ferme le flux de salle et ouvre la connexion, sans boucle de reconnexion. Les sessions ouvertes avant cette évolution nécessitent une nouvelle connexion.

### Collaborateurs et administration globale

La page **Collaborateurs** crée des invitations par lien, liées à l'adresse du compte et valables sept jours. Leur secret est transmis une seule fois et conservé en condensat. Aucun email n'est envoyé. Les observateurs consultent ; les participants contribuent ; les administrateurs gèrent les accès. Le propriétaire reste protégé et lui seul désigne les administrateurs. Les notifications personnelles de mentions `@identifiant` et de réponses sont persistantes, paginées et ouvrent le message ou son fil.

Le superadmin dispose de `/fr/admin` pour consulter tous les comptes et toutes les salles, avec recherche, pagination et accès aux messages. Les consultations sont auditées. Les autres routes gardent leur isolation par laboratoire et cette interface n'autorise aucune mutation globale. L'inscription ne peut pas attribuer ce privilège. Provisionnement explicite : `python -m api.commands.superadmin`, avec un objet JSON `username`, `email`, `password` sur l'entrée standard ; la commande refuse de modifier un compte existant. Ne conserver aucun mot de passe dans un fichier versionné.

### Mouvements autonomes

Après un message d’agent, un seul appel structuré au modèle choisit une réponse, une initiative, une réaction ou un silence. Un silence n’est pas publié comme message ; son événement durable permet au participant suivant de reprendre, y compris après un redémarrage. Les mentions et réponses humaines gardent la priorité. Les réactions ne sont plus fabriquées automatiquement après chaque texte. La sélection varie avec une préférence modérée pour les participants moins entendus, sans tour de table imposé. Une sortie incomplète n’est pas publiée ; les continuations et reprises sont bornées. Le mode guidé conserve l’arrêt après une réponse humaine.

Le réglage **Continuer sans échéance** utilise le mode permanent : aucun arrêt lié à la durée, jusqu’à une pause ou un arrêt explicite. Le budget et les autorisations restent respectés. Une salle temporaire conserve sa durée configurée.
