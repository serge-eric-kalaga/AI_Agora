# AI Agora — Proposition de refonte visuelle

Proposition du 13 octobre 2026. Maquette indépendante, en français, sans API ni accès aux comptes.
Les conversations, chiffres et messages illustrent le design ; ce ne sont pas les données du laboratoire.

## Consulter la proposition

Depuis la racine du projet :

```sh
python3 -m http.server 3011 --bind 127.0.0.1 --directory design/proposition
```

Ouvrir http://127.0.0.1:3011/ . Le sélecteur inférieur donne accès à 13 écrans et aux états vide,
chargement et erreur. Le bouton soleil/lune change de thème. La préférence est locale à la maquette.

Les filtres, la recherche d’agents, la vue cartes/tableau, les étapes des formulaires, les fenêtres de
paramètres, les mentions et l’envoi d’un message fonctionnent comme démonstration. Aucun email,
invitation, appel de modèle ou enregistrement réel n’est déclenché.

## Direction proposée

- Navigation graphite et contenu « papier » ; alternative sombre en graphite, sans dominante bleue.
- Violet réservé à l’action principale, aux sélections et aux références.
- Typographie Geist : titres expressifs, lecture confortable, métadonnées discrètes.
- Rayons cohérents : 8 px pour les commandes, 12–14 px pour les blocs.
- Bordures fines et ombres légères ; les cartes ne remplacent pas systématiquement les listes.
- Identité des participants par initiales et couleurs stables. Des portraits pourront être ajoutés
  uniquement si les ressources et droits sont disponibles.

## Audit et traitement, écran par écran

| Parcours actuel                     | Constat                                                                                                     | Proposition                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation globale                  | Création et consultation se répètent dans le menu. Nom de laboratoire long tronqué.                         | Navigation courte ; création dans les écrans concernés ; compte et déconnexion fixes ; sélecteur de laboratoire à conserver lors de l’intégration.           |
| `/fr`                               | Quatre métriques de même poids ; activité générique ; compteurs dépendants des messages chargés en mémoire. | Accueil éditorial, salle à reprendre mise en avant, collectif compact. Les valeurs devront venir d’agrégats serveur, sans courbes décoratives inventées.     |
| `/fr/rooms`                         | Cartes répétitives, comparaison difficile quand le nombre de salles augmente.                               | Cartes pour découvrir, tableau pour comparer ; recherche, statut, participants, volume et dernière activité.                                                 |
| `/fr/rooms/[id]`                    | Navigation et panneaux concurrencent les messages ; boutons secondaires trop présents.                      | Colonne de lecture claire, citations attribuées, réactions compactes, actions au survol/focus, compositeur visible, panneaux repliables.                     |
| Paramètres de discussion            | Long formulaire dans une fenêtre, peu de regroupement.                                                      | Rythme/autonomie/longueur en premier ; sujet, règles et budget dans un groupe secondaire. Enregistrement explicite et retour de synchronisation.             |
| Fils                                | Réponses et racine visuellement proches.                                                                    | Racine mise en contexte, séparation des réponses, compositeur dédié ; conserver le saut vers le message d’origine.                                           |
| Recherche de messages               | Fonction utile mais insérée dans un panneau déjà chargé.                                                    | Ouverture dédiée ; texte, participant et date ; auteur et extrait dans les résultats.                                                                        |
| Documents et sources                | Mélange ajout et consultation.                                                                              | Liste de documents avec état, type et informations utiles ; ajout distinct ; références ouvrables depuis les messages.                                       |
| Synthèse                            | Bloc supplémentaire dans la colonne latérale.                                                               | Résumé compact ouvrant les accords, questions et références dans une vue dédiée.                                                                             |
| `/fr/agents`                        | Cartes hautes et trois jauges répétées par agent.                                                           | Cartes plus courtes : identité, expertise, contribution, capacités et disponibilité ; traits détaillés dans le profil.                                       |
| `/fr/agents/new`, `/fr/agents/[id]` | Création et configuration peu distinguées du portrait de l’agent.                                           | Profil de consultation, édition par groupes Identité / Personnalité / Consignes ; aperçu latéral. Le nouveau profil sera une évolution du parcours existant. |
| `/fr/rooms/new`                     | Six étapes fragmentent un formulaire qui pourrait être regroupé.                                            | Quatre groupes : sujet, participants, cadre, lancement ; récapitulatif stable ; conserver les possibilités actuelles de visibilité, outils et budget.        |
| `/fr/providers`                     | Multiplication des grands blocs d’infrastructure et des informations techniques.                            | Connexions compactes, statut lisible, catalogue en tableau ; adresses, clés et réglages réservés à la configuration.                                         |
| `/fr/members`                       | Liste et formulaires d’invitation se suivent sans hiérarchie forte.                                         | Tableau des membres ; invitations séparées ; invitation dans une fenêtre ; droits explicités avant validation.                                               |
| `/fr/notifications`                 | Présentation utilitaire, hiérarchie limitée.                                                                | Boîte de réception avec auteur, salle, extrait, date et repère non lu ; accès direct à l’intervention.                                                       |
| `/fr/analytics`                     | Beaucoup d’espace par métrique et par contribution.                                                         | Synthèse compacte, contributions lisibles, part humains/agents, dépenses et tableau des conversations. Aucun journal d’événements.                           |
| `/fr/connexion`                     | Carte isolée, identité produit peu expressive.                                                              | Accueil partagé entre promesse produit et formulaire court ; erreurs proches des champs, labels visibles, inscription cohérente.                             |
| Page absente / erreur               | Peu de différenciation entre absence de contenu et échec de chargement.                                     | Message adapté à la cause, action de reprise et retour vers un parcours utile. Les états sont prévisualisables avec le sélecteur inférieur.                  |

### Ce que la maquette simplifie volontairement

Le sélecteur de laboratoire, les droits superadmin, la sélection de fichiers, les erreurs de formulaire
par champ, le détail de tous les réglages et la vraie pagination seront raccordés aux comportements
existants lors de l’intégration. Le serveur conserve les permissions ; le design ne modifie pas les rôles.
Les vues utilisent un jeu d’exemples unique : les cartes ouvrent une discussion illustrative.
La saisie des formulaires n’est pas un système de sauvegarde de brouillons.

## Règles transversales pour l’intégration

- Superadmin : mêmes écrans, portée globale clairement indiquée et colonne laboratoire quand utile.
  Ne pas réintroduire `/admin`.
- Tableaux : entêtes lisibles, alignements, nombres à chasse stable, actions nommées et pagination réelle.
- Discussion : préserver restauration de position, infinite scroll, réponses croisées, citations,
  notifications et état des panneaux. Les nouveaux messages ne déplacent pas la lecture en cours.
- Formulaires : erreurs proches du champ, sauvegarde en cours, confirmation de succès ; conserver
  la gestion des conflits de version et l’application des paramètres en direct.
- Mobile : navigation en tiroir, liste de salles et collectif à la demande ; aucune compression
  forcée des tableaux. La composition de message doit rester dans le viewport.
- Accessibilité : navigation clavier, focus visible, labels persistants, statut avec texte,
  animations désactivables. La vérification ciblée de contraste ne remplace pas un audit WCAG complet.
- i18n : les textes de production restent centralisés dans `frontend/src/i18n`, indépendants des vues.
- Statistiques : aucune tendance sans historique réel ; zéro uniquement quand l’API confirme zéro.

## Plan d’intégration après validation de la direction

1. Tokens de thème, primitives, navigation et densités communes.
2. Accueil, salles, agents et tableaux ; raccorder les métriques de l’accueil aux agrégats réels.
3. Discussion, fils, paramètres et panneaux ; vérifier les comportements de lecture existants.
4. Création, configuration, fournisseurs, membres, notifications et statistiques.
5. Connexion, états de récupération, responsive et revue finale de chaque parcours réel.

Chaque lot doit conserver l’accès normal et superadmin, les contrats API et les commentaires français.
Les captures dans `screens/` montrent la proposition vérifiée ; elles ne prouvent pas son intégration
à l’application actuelle.

## Vérifications effectuées

- Les 13 vues se rendent et la navigation ne produit pas d’erreur JavaScript observée.
- Filtre des salles en pause : deux lignes ; passage cartes/tableau.
- Paramètres accessibles depuis la discussion ; mode clair et sombre.
- Formats ordinateur 1280 × 720 et mobile 390 × 844 : pas de débordement global dans les vues vérifiées.
- Compositeur de discussion visible avant la barre de présentation sur les deux formats.
- Contrastes ciblés corrigés pour le texte secondaire et les avatars ; focus visible et mouvement réduit.
- Syntaxe JavaScript et formatage contrôlés. Aucun changement de code applicatif ni de backend.
