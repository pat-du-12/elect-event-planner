## Objectif

Une application permettant à un administrateur de créer des IRD (événements) et d'inviter des élus par email, chaque élu répondant Présent / Absent via un lien personnel, sans compte.

## Écrans

**1. Connexion administrateur** (`/auth`)
Email + mot de passe. Un seul compte administrateur.

**2. Tableau de bord** (`/`, protégé)
Liste des IRD à venir et passés : titre, date, lieu, présence du maire, compteur de réponses (Présents / Absents / Sans réponse).

**3. Création / édition d'un IRD** (protégé)
- Titre
- Lieu
- Date et heure
- Pièce jointe (upload de fichier : PDF, image, Word…)
- Case à cocher « Le maire sera présent »
- Description optionnelle

**4. Gestion des invitations** (protégé, sur la fiche IRD)
- Ajout d'élus (nom + email), un par un ou en collage d'une liste
- Carnet d'élus réutilisable d'un événement à l'autre
- Bouton « Envoyer les invitations » (et relance possible pour les sans-réponse)
- Tableau des réponses avec date de réponse et export CSV

**5. Page de réponse de l'élu** (`/invitation/{jeton}`, publique)
Affiche les détails de l'IRD, la pièce jointe téléchargeable, la mention de la présence du maire, puis deux boutons : « Je serai présent » / « Je ne serai pas présent ». Réponse modifiable tant que l'événement n'a pas eu lieu.

## Emails

Envoi depuis votre domaine **Mairie-rodez.fr** via la messagerie intégrée de Lovable (configuration DNS à valider une fois lors de la mise en place). L'email contient le titre, la date, le lieu, la présence du maire, la pièce jointe en lien de téléchargement, et les deux boutons de réponse pointant vers le lien personnel.

## Détails techniques

- Backend Lovable Cloud : base de données, stockage des pièces jointes, authentification admin.
- Tables : `events` (titre, lieu, date, maire_present, pièce jointe), `elus` (carnet d'adresses), `invitations` (event_id, élu, jeton unique, statut pending/accepted/declined, date de réponse), `user_roles` (rôle admin).
- Sécurité : RLS — seul l'administrateur authentifié lit/écrit les événements et invitations ; la page publique de réponse passe par un endpoint serveur qui n'expose que les données de l'invitation correspondant au jeton.
- Pièces jointes dans un bucket privé, servies via lien signé à durée limitée.
- Interface en français, sobre et institutionnelle.

## Étapes

1. Activer Lovable Cloud + schéma de base de données et stockage
2. Authentification administrateur et mise en page générale
3. CRUD des IRD avec pièce jointe
4. Gestion des élus et des invitations
5. Configuration du domaine email + envoi des invitations
6. Page publique de réponse et suivi des présences
