# Tutoriel débutant : installer l'application sur un PC Windows 11 (IIS + base locale)

Objectif : un document unique, en français, écrit pour quelqu'un qui n'a jamais déployé
d'application. Tout tourne sur le même ordinateur : l'application ET la base de données.
Aucun service Lovable n'est utilisé après l'export du code.

## Ce qui sera livré

Un nouveau fichier `deploy/iis/TUTO-WINDOWS-11.md`, copié automatiquement dans le paquet
`dist-iis/` lors du `npm run build:iis`. Le guide existant (serveur Windows Server) est
conservé ; le nouveau cible Windows 11 poste unique et remplace les explications
générales par des captures d'écriture pas-à-pas, avec pour chaque logiciel :
nom exact, lien de téléchargement officiel, version à choisir, options à cocher,
et une commande de vérification.

## Plan du tutoriel

1. **Avant de commencer** — matériel minimum, compte administrateur Windows, temps estimé,
   bloc-notes pour conserver mots de passe et clés.
2. **Logiciels à installer** (chacun avec son lien) :
   - Node.js LTS (nodejs.org)
   - Git pour Windows (git-scm.com)
   - Docker Desktop + WSL 2 (docker.com) — porte la base de données
   - Module IIS HttpPlatformHandler v1.2 x64 (iis.net)
   - Visual Studio Code (facultatif, pour éditer les fichiers)
3. **Activer IIS sur Windows 11** — Panneau de configuration → Fonctionnalités Windows,
   liste précise des cases à cocher, vérification via `http://localhost`.
4. **Installer la base de données en local** — Supabase auto-hébergé via Docker
   (PostgreSQL + comptes + stockage fichiers en une fois), génération du mot de passe
   PostgreSQL, du secret JWT et des deux clés d'API, remplissage du fichier `.env`,
   démarrage `docker compose up -d`, contrôle des conteneurs.
5. **Créer les tables et le dossier de pièces jointes** — exécution des fichiers de
   `supabase/migrations/` dans l'ordre via l'éditeur SQL local, création du bucket
   `ird-attachments`, vérification de la présence des tables.
6. **Récupérer le code et fabriquer l'application** — export GitHub depuis Lovable,
   `git clone`, création du fichier `.env` de build (adresse locale + clé anon),
   `npm install`, `npm run build:iis`, contenu attendu de `dist-iis\`.
7. **Installer dans IIS** — deux voies :
   - voie rapide : `installer-ird.ps1` en mode interactif (recommandée) ;
   - voie manuelle : création du site, pool d'applications « Sans code managé »,
     délai d'inactivité à 0, droits `icacls`, renseignement de `web.config`.
8. **Premier démarrage** — ouvrir le site, créer le tout premier compte (devient
   automatiquement administrateur), créer les élus et leurs comptes, créer un IRD,
   envoyer les invitations via Outlook.
9. **Utiliser l'application depuis d'autres postes du réseau** (facultatif) — nom de la
   machine, pare-feu, valeurs `VITE_SUPABASE_URL` à adapter, note sur HTTPS.
10. **Entretien** — sauvegarde quotidienne de la base, arrêt/redémarrage propre de
    Windows et de Docker, mise à jour de l'application, tableau de dépannage
    (page blanche, 502.3, « Failed to fetch », Docker arrêté, pièce jointe refusée).

## Détails techniques

- Le tutoriel est un document Markdown ; aucune modification du code applicatif.
- `scripts/build-iis.mjs` recevra une ligne `cpSync` supplémentaire pour inclure
  `TUTO-WINDOWS-11.md` dans `dist-iis/`.
- Les valeurs sensibles (clé service_role, mot de passe PostgreSQL) sont indiquées comme
  à conserver hors du dépôt ; aucune clé réelle n'est écrite dans le document.
- Spécificités Windows 11 traitées : activation d'IIS via « Fonctionnalités Windows »
  (et non le Gestionnaire de serveur), WSL 2 requis pour Docker, mise en veille du PC à
  désactiver pour que le site reste joignable.
