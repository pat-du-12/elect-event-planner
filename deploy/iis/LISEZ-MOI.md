# Déploiement sur un serveur IIS (Windows)

Application : **Planification des IRD** (TanStack Start / React, base de données et
authentification hébergées dans le cloud).

## 1. Prérequis sur le serveur

| Élément | Détail |
| --- | --- |
| Windows Server | 2016 ou plus récent, rôle **IIS** installé |
| Node.js | version **20 LTS ou 22 LTS** (installation « x64 », chemin par défaut `C:\Program Files\nodejs\node.exe`) |
| Module IIS | **HttpPlatformHandler v1.2** ([téléchargement Microsoft](https://www.iis.net/downloads/microsoft/httpplatformhandler)) |
| Sortie réseau | HTTPS sortant autorisé vers le service cloud (base de données / authentification) |

## 2. Générer le paquet (sur le poste de développement)

Le build doit être lancé **en local**, après export du projet vers GitHub puis
clone du dépôt (dans l'éditeur en ligne, le build cible l'hébergement Lovable).

```bash
npm install
npm run build:iis
```


Un dossier **`dist-iis/`** est créé :

```text
dist-iis/
  .output/        serveur Node autonome + fichiers statiques
  web.config      configuration IIS
  logs/           journaux du process Node
  LISEZ-MOI.md    ce document
```

Aucun `node_modules` n'est nécessaire sur le serveur : tout est empaqueté.

## 3. Copier et configurer

1. Copier le contenu de `dist-iis/` dans par exemple `C:\inetpub\ird`.
2. Ouvrir `C:\inetpub\ird\web.config` et remplacer les valeurs `__…__` par les
   identifiants du backend (URL du projet, clé publique, clé de service).
   Ces valeurs sont visibles dans le fichier `.env` du projet et dans les
   paramètres du backend.
3. Dans le **Gestionnaire IIS** :
   - créer un site (ou une application) pointant sur `C:\inetpub\ird` ;
   - lui affecter un pool d'applications en mode **« Sans code managé »** ;
   - donner au compte du pool (`IIS AppPool\<nom>`) les droits **Lecture/Exécution**
     sur le dossier et **Modification** sur `logs\`.
4. Redémarrer le site puis ouvrir `http://<serveur>/`.

## 4. HTTPS et nom de domaine

- Ajouter la liaison HTTPS (port 443) avec le certificat de la collectivité.
- Recommandé : forcer la redirection HTTP → HTTPS via le module **URL Rewrite**.
- Le nom public doit être stable : il sert dans les invitations Outlook envoyées
  aux élus (lien vers leur espace personnel).

## 5. Mise à jour de l'application

1. Relancer `npm run build:iis` sur le poste de développement.
2. Arrêter le site dans IIS.
3. Remplacer le dossier `.output` (conserver `web.config` et `logs`).
4. Redémarrer le site.

## 6. Dépannage

| Symptôme | Cause probable |
| --- | --- |
| Erreur 502.3 / 500.19 | HttpPlatformHandler absent ou chemin `node.exe` incorrect dans `web.config` |
| Page blanche, journaux vides | Droits insuffisants du pool sur le dossier |
| Erreur de connexion aux données | Variables `SUPABASE_*` non renseignées dans `web.config` |
| Pièce jointe refusée | Augmenter `maxAllowedContentLength` dans `web.config` |

Les journaux du serveur applicatif se trouvent dans `logs\node*.log`.
