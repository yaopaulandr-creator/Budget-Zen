# Guide d’utilisation — BudgetZen

Ce guide décrit l’usage quotidien de BudgetZen, de la première ouverture jusqu’à la sauvegarde de vos données. Il ne suppose aucune connaissance technique.

- [1. Première ouverture](#1-première-ouverture)
- [2. Comprendre les chiffres affichés](#2-comprendre-les-chiffres-affichés)
- [3. Ajouter et gérer des opérations](#3-ajouter-et-gérer-des-opérations)
- [4. Organiser vos catégories](#4-organiser-vos-catégories)
- [5. Fixer des budgets](#5-fixer-des-budgets)
- [6. Suivre des objectifs d’épargne](#6-suivre-des-objectifs-dépargne)
- [7. Automatiser les opérations récurrentes](#7-automatiser-les-opérations-récurrentes)
- [8. Lire les rapports](#8-lire-les-rapports)
- [9. Exporter vos données](#9-exporter-vos-données)
- [10. Choisir le thème clair ou sombre](#10-choisir-le-thème-clair-ou-sombre)
- [11. Sauvegarder et restaurer](#11-sauvegarder-et-restaurer)
- [12. Questions fréquentes](#12-questions-fréquentes)
- [13. En cas de problème](#13-en-cas-de-problème)

---

## 1. Première ouverture

Ouvrez l’application dans un navigateur récent (Chrome, Edge, Firefox, Safari). Aucun compte n’est demandé : tout fonctionne immédiatement et reste sur votre appareil.

Trois points de départ possibles depuis **Paramètres** :

| Option | Quand l’utiliser |
| --- | --- |
| **Charger les données de démonstration** | Pour explorer l’application sans saisir vos vraies données. Ces données sont identifiées et supprimables en un clic. |
| **Saisir votre solde initial** | Pour retrouver votre solde bancaire réel à une date donnée. |
| **Ajouter directement une transaction** | Si vous préférez partir d’une page blanche. |

**Réglez d’abord le solde initial** (Paramètres → *Solde et préférences*) : montant présent sur vos comptes à la *date de référence*. Toutes les opérations antérieures à cette date restent visibles dans l’historique, mais ne sont pas réinjectées dans le solde cumulé — elles sont déjà censées être comprises dans ce solde de départ.

Le solde initial n’est **jamais** compté comme un revenu : il ne gonfle ni les revenus de la période, ni le résultat net.

---

## 2. Comprendre les chiffres affichés

| Indicateur | Calcul |
| --- | --- |
| **Solde cumulé** | Solde initial + revenus − dépenses, depuis la date de référence jusqu’à la fin de la période consultée. |
| **Revenus de la période** | Somme des entrées datées dans la période. |
| **Dépenses de la période** | Somme des sorties datées dans la période. |
| **Résultat net** | Revenus − dépenses. Peut être négatif (affiché en rouge). |
| **Restant sur les budgets** | Somme des plafonds non consommés pour les budgets actifs. |
| **Progression de l’épargne** | Montants suivis ÷ cible cumulée, plafonnée à 100 % à l’affichage. |

Règles utiles à garder en tête :

- les montants sont exacts au centime (aucun arrondi flottant) ;
- une période est délimitée par un début inclus et une fin exclue : le 1er et le 31 octobre appartiennent à octobre, le 1er novembre non ;
- les objectifs d’épargne et les budgets **ne modifient jamais** le solde : seul un vrai mouvement d’argent le fait ;
- les échéances récurrentes encore en attente ne sont pas comptées dans les totaux réels.

---

## 3. Ajouter et gérer des opérations

**Ajouter** : bouton *Ajouter une transaction* (barre latérale sur ordinateur, bouton flottant sur mobile). Renseignez le type (revenu ou dépense), le montant, la date, la catégorie et une description facultative. Le montant accepte `1250,50`, `1 250,50` ou `1250.50` ; il doit être strictement positif.

**Modifier** : icône crayon sur la ligne concernée. La catégorie proposée est filtrée selon le type choisi.

**Dupliquer** : pratique pour une opération quasi identique ; ajustez ensuite la date et le montant.

**Supprimer** : une confirmation est toujours demandée. Supprimer une opération issue d’une échéance récurrente remet cette échéance en « ignorée » sans toucher au reste de la série.

**Retrouver une opération** — la page Transactions combine :

- une recherche texte sur la description ;
- des filtres type, catégorie, période, dates, montants minimum et maximum, opérations récurrentes ;
- des tris par date ou montant, croissants ou décroissants ;
- une pagination et le rappel du nombre de résultats ;
- les totaux du périmètre filtré (et non de toute la base).

Le bouton *Réinitialiser les filtres* remet la liste à zéro.

---

## 4. Organiser vos catégories

Sept catégories de dépenses et quelques catégories de revenus sont fournies. Vous pouvez :

- créer une catégorie personnalisée avec un nom, une icône et une couleur ;
- renommer ou changer icône et couleur d’une catégorie existante ;
- **archiver** une catégorie pour la retirer des formulaires sans perdre l’historique ;
- réactiver une catégorie archivée à tout moment.

Une catégorie encore utilisée par des transactions, des budgets ou des récurrences ne peut pas être supprimée : archivez-la. Les opérations passées gardent leur catégorie d’origine, même renommée.

---

## 5. Fixer des budgets

Créez un budget par catégorie de **dépense**, avec :

- un plafond ;
- une périodicité : mensuelle, trimestrielle, semestrielle ou annuelle ;
- une date de début qui sert d’ancre au cycle ;
- un seuil d’alerte (80 % par défaut).

L’application calcule la consommation réelle à partir des transactions, affiche le restant et signale trois situations : *proche du seuil*, *seuil atteint*, *dépassé*. Un dépassement alerte mais **ne bloque jamais** la saisie d’une nouvelle dépense.

Deux budgets identiques (même catégorie, même périodicité) ne peuvent pas coexister.

---

## 6. Suivre des objectifs d’épargne

Chaque objectif comporte un nom, un montant cible, un montant déjà suivi, une date cible facultative et une description. Vous pouvez :

- ajouter une **contribution rapide** au fil de l’eau ;
- marquer un objectif comme **atteint** ;
- l’**archiver** pour le sortir de la liste active.

La progression est plafonnée à 100 % à l’affichage, mais le montant réellement suivi est conservé. Rappel : un objectif est un suivi, pas un mouvement bancaire — il ne change pas votre solde.

---

## 7. Automatiser les opérations récurrentes

Créez une règle pour un loyer, un abonnement ou un salaire :

- type, montant, catégorie, description ;
- fréquence : hebdomadaire, mensuelle, trimestrielle, semestrielle ou annuelle ;
- date de début, date de fin facultative.

À chaque ouverture de l’application, les échéances dues sont générées **une seule fois** — un identifiant déterministe empêche tout doublon. Selon le réglage *Enregistrer automatiquement les échéances récurrentes* :

- **activé** : la transaction est créée directement ;
- **désactivé** : l’échéance reste *en attente*, à confirmer ou à ignorer manuellement.

Vous pouvez suspendre une règle sans perdre son historique, ou la supprimer : les transactions déjà créées restent intactes.

---

## 8. Lire les rapports

La page Rapports propose les périodes **mois, trimestre, semestre, année** et **période personnalisée** (deux dates au choix).

On y trouve :

- les indicateurs de la période et le solde cumulé ;
- la répartition des revenus et des dépenses par catégorie, avec montant, part, nombre d’opérations et variation par rapport à la période précédente ;
- les budgets du cycle courant et les objectifs d’épargne ;
- l’évolution du solde et la comparaison revenus/dépenses ;
- l’historique des bilans annuels ;
- la décomposition par mois et par trimestre.

Les sous-périodes totalisent toujours le bilan principal : si ce n’est pas le cas, c’est un défaut à signaler.

---

## 9. Exporter vos données

Trois formats sont disponibles depuis Rapports et Transactions :

| Format | Usage | Remarques |
| --- | --- | --- |
| **CSV** | Tableur, retraitement | Séparateur `;`, UTF-8 avec BOM (accents corrects dans Excel), dates ISO. Choix entre périmètre filtré et totalité. |
| **XLSX** | Classeur prêt à l’emploi | Colonnes Date / Type / Catégorie / Montant / Description / Récurrente, en-têtes stylés. |
| **PDF** | Archivage ou partage | Titre, période, indicateurs, solde cumulé, graphique, détail par catégorie, budgets, objectifs, pagination. |

Les exports sont assainis contre l’injection de formules : une description commençant par `=`, `+`, `-` ou `@` est neutralisée et ne peut pas s’exécuter dans un tableur.

---

## 10. Choisir le thème clair ou sombre

Le thème est accessible à trois endroits :

- l’icône **lune/soleil** en haut de la barre latérale (ordinateur) ou de l’en-tête (mobile) ;
- **Paramètres → Apparence**, avec les deux choix explicites *Clair* / *Sombre* ;
- automatiquement, à la première visite, selon le réglage clair/sombre de votre système.

Le choix est mémorisé dans ce navigateur et s’applique immédiatement, sans rechargement. Il est conservé d’une session à l’autre, sans être inclus dans la sauvegarde JSON (c’est une préférence d’affichage, pas une donnée financière). Le thème n’a aucun effet sur les calculs, les exports ni les rapports imprimés.

---

## 11. Sauvegarder et restaurer

**C’est la partie la plus importante.** Vos données vivent uniquement dans ce navigateur : effacer les données du site, naviguer en privé ou changer d’appareil les fait disparaître.

- **Exporter** : Paramètres → *Exporter une sauvegarde*. Un fichier JSON daté est téléchargé ; il contient transactions, catégories, budgets, objectifs, règles, échéances, solde initial et préférences.
- **Restaurer** : Paramètres → *Restaurer depuis un fichier*. L’application valide le fichier, puis affiche un **aperçu** (compteurs, période couverte, solde initial). Rien n’est remplacé avant votre confirmation explicite.
- Un fichier invalide, trop volumineux (plus de 10 Mo) ou d’une version supérieure est refusé **sans toucher** à vos données.
- La restauration **remplace** tout : elle ne fusionne pas. C’est volontaire, pour éviter les doublons.

Bon réflexe : exporter une sauvegarde après chaque séance de saisie importante, et vérifier de temps en temps qu’une restauration fonctionne réellement.

---

## 12. Questions fréquentes

**Mes données sont-elles envoyées quelque part ?**
Non. Aucun compte, aucun serveur, aucun appel réseau métier, aucun outil d’analyse. Tout reste dans IndexedDB, dans votre navigateur.

**Puis-je utiliser BudgetZen sur mon téléphone et mon ordinateur avec les mêmes données ?**
Pas automatiquement. Pour transférer, exportez une sauvegarde sur un appareil et restaurez-la sur l’autre. Il n’y a ni synchronisation ni fusion.

**Pourquoi mon solde cumulé ne correspond-il pas à mon compte en banque ?**
Vérifiez le solde initial et sa date de référence, puis les opérations postérieures à cette date. Les opérations antérieures ne sont pas recalculées.

**Un budget dépassé bloque-t-il la saisie ?**
Non. Il affiche une alerte, rien de plus.

**Les objectifs d’épargne réduisent-ils mon solde ?**
Non. Seule une transaction réelle le fait.

**Puis-je annuler une suppression ?**
Non. La suppression est définitive après confirmation ; c’est pourquoi la sauvegarde régulière est recommandée.

**Où sont mes préférences d’affichage ?**
Le thème est stocké dans le navigateur (`localStorage`), séparément des données financières.

---

## 13. En cas de problème

| Symptôme | Piste |
| --- | --- |
| « Stockage local inaccessible » | Navigation privée ou stockage bloqué. Autorisez le stockage du site, puis rechargez. |
| Écran « Un problème inattendu est survenu » | Rechargez la page. Vos données enregistrées ne sont pas modifiées. En cas de doute, exportez une sauvegarde depuis un autre onglet. |
| Les échéances récurrentes n’apparaissent pas | Elles sont générées à l’ouverture de l’application ou via le bouton de génération de la page Récurrences. |
| Restauration refusée | Le fichier n’est pas une sauvegarde BudgetZen valide, ou provient d’une version plus récente. |
| Les accents sont illisibles dans Excel | Utilisez l’export XLSX, ou ouvrez le CSV en précisant l’encodage UTF-8. |

Pour aller plus loin sur l’architecture, les règles de calcul et le déploiement, voir le [README](README.md).
