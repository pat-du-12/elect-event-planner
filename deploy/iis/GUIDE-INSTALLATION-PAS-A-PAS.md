# Guide d'installation pas à pas — Serveur Windows + IIS

Application : **Planification des IRD**
Public visé : personne qui n'a jamais déployé d'application web. Chaque étape est
détaillée, dans l'ordre. Comptez **2 à 3 heures** la première fois.

---

## Vue d'ensemble (à lire avant de commencer)

L'application est composée de **deux briques** :

```text
   Navigateur des utilisateurs
              |
              v
   [ IIS ]  --->  [ Serveur Node.js ]   <-- l'application (pages, écrans)
                          |
                          v
                  [ Base de données ]   <-- PostgreSQL + Supabase
                   comptes, IRD, invitations, pièces jointes
```

1. **L'application** : un petit serveur Node.js publié derrière IIS.
2. **La base de données** : PostgreSQL, accompagné de « Supabase » qui fournit
   la gestion des comptes (connexion/mot de passe) et le stockage des fichiers.
   L'application ne sait pas parler à PostgreSQL « tout nu » : elle a besoin de
   Supabase par-dessus. La méthode la plus simple sur Windows est d'installer
   **Supabase auto-hébergé avec Docker Desktop** : ça installe PostgreSQL ET les
   services de comptes/fichiers en une seule fois, gratuitement.

Vous ferez donc, dans l'ordre :

- **Partie A** — préparer le serveur Windows
- **Partie B** — installer la base de données (Docker + Supabase)
- **Partie C** — créer les tables de l'application
- **Partie D** — fabriquer le paquet de l'application
- **Partie E** — installer l'application dans IIS
- **Partie F** — premier démarrage et création de l'administrateur
- **Partie G** — sauvegardes, mises à jour, dépannage

> Astuce : ouvrez un bloc-notes et notez au fur et à mesure les mots de passe et
> clés que vous générez. Vous en aurez besoin en Partie E.

---

## Partie A — Préparer le serveur Windows

### A.1 Vérifier la machine

| Élément | Minimum conseillé |
| --- | --- |
| Système | Windows Server 2019 / 2022 (ou Windows 10/11 Pro) |
| Processeur | 4 cœurs |
| Mémoire | 8 Go (16 Go conseillé avec Docker) |
| Disque | 60 Go libres |
| Droits | un compte **Administrateur local** |

### A.2 Activer le rôle IIS

1. Ouvrir **Gestionnaire de serveur** → **Gérer** → **Ajouter des rôles et fonctionnalités**.
2. Cliquer **Suivant** jusqu'à « Rôles de serveurs ».
3. Cocher **Serveur Web (IIS)**. Accepter les fonctionnalités proposées.
4. Dans la liste des services de rôle, vérifier que **Console de gestion IIS**
   est cochée. Cliquer **Installer**, puis attendre la fin.
5. Vérification : ouvrir un navigateur sur le serveur, aller sur
   `http://localhost` → la page d'accueil IIS doit s'afficher.

*(Sur Windows 10/11 : Panneau de configuration → Programmes → Activer ou
désactiver des fonctionnalités Windows → cocher **Services Internet (IIS)**.)*

### A.3 Installer Node.js

1. Aller sur <https://nodejs.org> et télécharger la version **LTS** (20 ou 22), **Windows x64 .msi**.
2. Lancer l'installation, tout laisser par défaut (chemin
   `C:\Program Files\nodejs\`), cocher « Add to PATH » si proposé.
3. Vérification : ouvrir **PowerShell** et taper :

   ```powershell
   node -v
   ```

   Vous devez voir par exemple `v22.14.0`. Si la commande est inconnue,
   redémarrez la session Windows.

### A.4 Installer le module IIS « HttpPlatformHandler »

C'est le composant qui permet à IIS de faire tourner l'application Node.js.

1. Télécharger : <https://www.iis.net/downloads/microsoft/httpplatformhandler>
   → choisir la version **v1.2**, fichier **x64**.
2. Lancer l'installateur, **Suivant / Installer**.
3. Vérification : ouvrir le **Gestionnaire des services Internet (IIS)**,
   sélectionner le serveur dans l'arbre de gauche, ouvrir **Modules** : la ligne
   `httpPlatformHandler` doit apparaître.

### A.5 Ouvrir les ports du pare-feu

Dans PowerShell **en tant qu'administrateur** :

```powershell
New-NetFirewallRule -DisplayName "IRD HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "IRD HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## Partie B — Installer la base de données (Docker + Supabase)

### B.1 Installer Docker Desktop

1. Télécharger **Docker Desktop for Windows** : <https://www.docker.com/products/docker-desktop/>
2. Lancer l'installation en laissant l'option **WSL 2** cochée.
3. Redémarrer le serveur quand c'est demandé.
4. Ouvrir Docker Desktop, accepter les conditions. En bas à gauche l'indicateur
   doit être **vert / « Engine running »**.
5. Dans **Settings → General**, cocher **Start Docker Desktop when you log in**.
6. Vérification en PowerShell :

   ```powershell
   docker --version
   docker compose version
   ```

> Docker Desktop est gratuit pour les petites structures et les administrations.
> Si votre politique interne l'interdit, voir l'annexe « Sans Docker » en fin de document.

### B.2 Installer Git (pour récupérer Supabase)

1. Télécharger <https://git-scm.com/download/win>, installer avec les options par défaut.
2. Vérification : `git --version` dans PowerShell.

### B.3 Télécharger Supabase auto-hébergé

Dans PowerShell :

```powershell
mkdir C:\ird-data
cd C:\ird-data
git clone --depth 1 https://github.com/supabase/supabase
cd C:\ird-data\supabase\docker
copy .env.example .env
```

### B.4 Générer les mots de passe et les clés

Trois valeurs sont à fabriquer. Toujours dans PowerShell :

```powershell
# 1) Mot de passe de la base de données
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | % {[char]$_})

# 2) Secret JWT (clé de signature des connexions)
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

Notez les deux résultats dans votre bloc-notes (`POSTGRES_PASSWORD` et `JWT_SECRET`).

Ensuite, générer les **deux clés d'API** (anon et service_role) :

1. Aller sur <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
   (page publique, aucun compte requis) ; un formulaire permet de coller le
   `JWT_SECRET` et d'obtenir les deux clés.
2. Copier la clé **anon** et la clé **service_role** dans votre bloc-notes.

### B.5 Renseigner le fichier `.env` de Supabase

Ouvrir `C:\ird-data\supabase\docker\.env` avec le Bloc-notes et modifier
**au minimum** ces lignes (remplacer par vos valeurs notées) :

```env
POSTGRES_PASSWORD=votre_mot_de_passe_base
JWT_SECRET=votre_secret_jwt
ANON_KEY=votre_cle_anon
SERVICE_ROLE_KEY=votre_cle_service_role

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=un_mot_de_passe_pour_la_console

SITE_URL=http://nom-du-serveur
API_EXTERNAL_URL=http://nom-du-serveur:8000
SUPABASE_PUBLIC_URL=http://nom-du-serveur:8000

ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
DISABLE_SIGNUP=false
```

Remplacez `nom-du-serveur` par le nom réseau ou l'adresse IP du serveur
(ex. `srv-ird.mairie.local`). Enregistrer et fermer.

### B.6 Démarrer la base

```powershell
cd C:\ird-data\supabase\docker
docker compose pull
docker compose up -d
```

Le premier téléchargement prend 5 à 15 minutes. Vérification :

```powershell
docker compose ps
```

Tous les services doivent être `running` / `healthy`.

Ouvrir ensuite `http://localhost:8000` dans le navigateur : la console Supabase
demande le `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` définis plus haut.

### B.7 Vérifier le démarrage automatique

Docker Desktop relance les conteneurs au démarrage si l'option de la B.1 est
cochée et si la ligne `restart: unless-stopped` est présente (c'est le cas par
défaut dans le fichier fourni par Supabase).

---

## Partie C — Créer les tables de l'application

1. Dans la console Supabase (`http://localhost:8000`), ouvrir **SQL Editor**.
2. Sur le poste de développement, ouvrir le dossier `supabase/migrations/` du
   projet : il contient les fichiers `.sql` numérotés par date.
3. **Dans l'ordre chronologique** (du plus ancien au plus récent), copier le
   contenu de chaque fichier, le coller dans l'éditeur SQL, cliquer **Run**, et
   vérifier le message `Success`. Passer au fichier suivant.
4. Créer le stockage des pièces jointes : menu **Storage** → **New bucket** →
   nom exactement `ird-attachments` → laisser **Public** décoché → **Create**.
5. Vérification : menu **Table Editor**, vous devez voir les tables
   `events`, `elus`, `invitations`, `user_roles`.

> Si un fichier SQL renvoie une erreur « already exists », c'est qu'il a déjà été
> passé : continuez au suivant.

---

## Partie D — Fabriquer le paquet de l'application

Cette étape se fait **sur un poste de développement** (ou sur le serveur, si
Node.js et Git y sont installés — c'est possible et souvent plus simple).

1. Exporter le projet vers GitHub depuis Lovable (bouton **GitHub** en haut à droite),
   puis récupérer le code :

   ```powershell
   cd C:\build
   git clone https://github.com/<votre-compte>/<votre-depot>.git ird
   cd ird
   ```

2. Installer les dépendances et construire :

   ```powershell
   npm install
   npm run build:iis
   ```

3. Un dossier **`dist-iis\`** apparaît. Il contient :

   ```text
   dist-iis\
     .output\        l'application
     web.config      la configuration IIS
     logs\           les journaux
     LISEZ-MOI.md
   ```

4. Copier tout le contenu de `dist-iis\` vers le serveur, par exemple dans
   `C:\inetpub\ird`.

---

## Partie E — Installer l'application dans IIS

### E.0 (Recommandé) Installation automatique en une commande

Le paquet contient un script `installer-ird.ps1` qui fait **tout** à votre place :
IIS, Node.js, module HttpPlatformHandler, pare-feu, copie des fichiers,
paramètres de connexion, création du site et démarrage.

1. Copier le dossier `dist-iis\` sur le serveur, par exemple dans `C:\install-ird`.
2. Ouvrir **PowerShell en tant qu'administrateur**, puis :

   ```powershell
   cd C:\install-ird
   powershell -ExecutionPolicy Bypass -File .\installer-ird.ps1
   ```

   Le script pose alors chaque question (nom du site, port, dossier, adresse et
   clés de la base…) en proposant une valeur par défaut : appuyez sur **Entrée**
   pour l'accepter. Aucun fichier n'est à modifier à la main.

3. À la fin, le script affiche l'adresse du site et vérifie qu'il répond.

**Tout indiquer en une seule commande** (sans aucune question) :

```powershell
powershell -ExecutionPolicy Bypass -File .\installer-ird.ps1 -NonInteractive `
  -SiteName "IRD" -Port 8080 -SitePath "D:\apps\ird" -HostName "srv-ird.mairie.local" `
  -SupabaseUrl "http://localhost:8000" -PublicSupabaseUrl "http://nom-du-serveur:8000" `
  -AnonKey "votre_cle_anon" -ServiceRoleKey "votre_cle_service_role" `
  -DbHost "localhost" -DbPort 5432 -DbName "postgres" -DbUser "postgres" -DbPassword "motdepasse"
```

**Ou avec un fichier de réponses** `ird-config.json` (modèle fourni dans le paquet) :

```powershell
powershell -ExecutionPolicy Bypass -File .\installer-ird.ps1 -NonInteractive -ConfigFile .\ird-config.json
```

Liste des options :

| Option | Rôle | Défaut |
| --- | --- | --- |
| `-SiteName` | Nom du site et du pool IIS | `IRD` |
| `-SitePath` | Dossier de déploiement | `C:\inetpub\ird` |
| `-Port` | Port HTTP | `80` |
| `-HostName` | Nom d'hôte du site | (toutes adresses) |
| `-SupabaseUrl` | Adresse de la base vue du serveur | `http://localhost:8000` |
| `-PublicSupabaseUrl` | Adresse de la base vue des postes | = `-SupabaseUrl` |
| `-AnonKey` / `-ServiceRoleKey` | Clés de la base | (à fournir) |
| `-DbHost` / `-DbPort` / `-DbName` / `-DbUser` / `-DbPassword` | Connexion PostgreSQL directe (`DATABASE_URL`) | `localhost` / `5432` / `postgres` / `postgres` |
| `-DatabaseUrl` | Chaîne de connexion complète (remplace les 5 options ci-dessus) | — |
| `-ConfigFile` | Fichier JSON de réponses | — |
| `-NonInteractive` | N'affiche aucune question | — |
| `-SkipPrerequisites` | IIS et Node.js déjà installés | — |


Le script sert aussi aux **mises à jour** : relancez-le avec le nouveau paquet,
il sauvegarde l'ancienne version avant de remplacer les fichiers.

> Si vous préférez tout faire à la main, suivez les étapes E.1 à E.4 ci-dessous.



### E.1 Renseigner les paramètres de connexion

Ouvrir `C:\inetpub\ird\web.config` avec le Bloc-notes et remplacer les trois
valeurs `__…__` par celles notées en Partie B :

```xml
<environmentVariable name="SUPABASE_URL"              value="http://localhost:8000" />
<environmentVariable name="SUPABASE_PUBLISHABLE_KEY"  value="votre_cle_anon" />
<environmentVariable name="SUPABASE_SERVICE_ROLE_KEY" value="votre_cle_service_role" />
```

Ajouter également, dans le même bloc `<environmentVariables>`, les variables
lues par le navigateur :

```xml
<environmentVariable name="VITE_SUPABASE_URL"             value="http://nom-du-serveur:8000" />
<environmentVariable name="VITE_SUPABASE_PUBLISHABLE_KEY" value="votre_cle_anon" />
```

> Important : `VITE_SUPABASE_URL` doit être l'adresse **vue depuis les postes des
> utilisateurs** (nom du serveur), pas `localhost`.
> Ces deux valeurs `VITE_*` doivent aussi être présentes dans un fichier `.env`
> **au moment du build** (Partie D) car elles sont intégrées aux pages :
> créez `.env` à la racine du projet avant `npm run build:iis` avec ces deux lignes.

Enregistrer le fichier.

### E.2 Créer le site dans IIS

1. Ouvrir le **Gestionnaire des services Internet (IIS)**.
2. Clic droit sur **Sites** → **Ajouter un site Web**.
   - Nom du site : `IRD`
   - Chemin d'accès physique : `C:\inetpub\ird`
   - Liaison : type `http`, port `80`, nom d'hôte vide (ou le nom DNS choisi)
   - **OK**
3. Cliquer sur **Pools d'applications** → double-clic sur le pool `IRD` :
   - Version du .NET CLR : **Sans code managé**
   - Mode pipeline : **Intégré**
   - **OK**
4. Toujours dans le pool `IRD` → **Paramètres avancés** :
   - **Démarrage automatique** : `True`
   - **Délai d'inactivité (minutes)** : `0` (évite l'arrêt du site la nuit)
   - **Intervalle de recyclage régulier** : `0`

### E.3 Donner les droits sur le dossier

Dans PowerShell **administrateur** :

```powershell
icacls "C:\inetpub\ird"      /grant "IIS AppPool\IRD:(OI)(CI)RX" /T
icacls "C:\inetpub\ird\logs" /grant "IIS AppPool\IRD:(OI)(CI)M"  /T
```

### E.4 Démarrer

Dans IIS, sélectionner le site `IRD` → **Démarrer** (colonne de droite).
Ouvrir `http://localhost` sur le serveur : la page de connexion de l'application
doit s'afficher.

### E.5 Activer le HTTPS (fortement recommandé)

1. Obtenir le certificat de la collectivité (fichier `.pfx`).
2. Dans IIS, au niveau du serveur → **Certificats de serveur** → **Importer**.
3. Site `IRD` → **Liaisons** → **Ajouter** : type `https`, port `443`,
   certificat = celui importé.
4. Une fois le HTTPS actif, remplacer partout `http://` par `https://` dans
   `web.config` (`VITE_SUPABASE_URL`) et dans le `.env` de Supabase
   (`SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`), puis relancer :
   `docker compose up -d` et redémarrer le site IIS.

---

## Partie F — Premier démarrage

1. Ouvrir l'application depuis un poste du réseau : `http://nom-du-serveur/`.
2. Cliquer sur **Créer un compte** et saisir l'adresse et le mot de passe de
   l'administrateur principal.
   → **Le tout premier compte créé devient automatiquement administrateur.**
   Créez-le immédiatement, avant d'ouvrir l'application aux autres utilisateurs.
3. Une fois connecté :
   - **Élus** : ajouter les élus (nom + e-mail), puis **Créer le compte** pour
     chacun. Le mot de passe s'affiche une seule fois : copiez-le et
     transmettez-le à l'élu.
   - **Administrateurs** : ajouter d'autres administrateurs si besoin.
   - **Événements** : créer un IRD (titre, lieu, adresse, date, organisateur,
     présence du maire, document et visuel).
4. **Envoi des invitations** : sur la fiche de l'IRD, bouton **Ouvrir dans
   Outlook**. Un brouillon nominatif par élu est téléchargé (fichier `.eml`) puis
   s'ouvre dans le client Outlook installé sur le poste de l'administrateur, avec
   les pièces jointes. Il suffit de cliquer sur **Envoyer**.
   → Pour cela, Outlook doit être l'application par défaut pour les fichiers
   `.eml` sur le poste de l'administrateur.

---

## Partie G — Exploitation

### G.1 Sauvegarde de la base (à planifier chaque nuit)

Créer `C:\ird-data\sauvegarde.ps1` :

```powershell
$date = Get-Date -Format "yyyy-MM-dd"
$dest = "C:\ird-data\backups"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
docker exec supabase-db pg_dumpall -U postgres | Out-File "$dest\ird-$date.sql" -Encoding utf8
Get-ChildItem $dest -Filter *.sql | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

Puis **Planificateur de tâches** → **Créer une tâche de base** → tous les jours à
02:00 → Action : `powershell.exe -File C:\ird-data\sauvegarde.ps1`.
Copiez ensuite le dossier `backups` sur votre sauvegarde réseau habituelle.

### G.2 Mettre à jour l'application

1. Sur le poste de build : `git pull` puis `npm install` puis `npm run build:iis`.
2. Sur le serveur : arrêter le site `IRD` dans IIS.
3. Remplacer **uniquement** le dossier `.output` (garder `web.config` et `logs`).
4. Redémarrer le site.

### G.3 Dépannage

| Symptôme | Cause probable / solution |
| --- | --- |
| Erreur 502.3 ou 500.19 | HttpPlatformHandler non installé, ou chemin `node.exe` faux dans `web.config` |
| Page blanche, `logs\` vide | Le pool n'a pas les droits sur le dossier → refaire E.3 |
| « Failed to fetch » à la connexion | `VITE_SUPABASE_URL` pointe sur `localhost` au lieu du nom du serveur, ou Docker est arrêté |
| Connexion refusée / mot de passe invalide | Clé `anon` incorrecte, ou compte non créé |
| Pièce jointe refusée | Augmenter `maxAllowedContentLength` dans `web.config` |
| Le site tombe après quelques heures | Délai d'inactivité du pool non mis à `0` (E.2) |
| Docker « Engine stopped » | Ouvrir Docker Desktop, vérifier que WSL 2 est actif |

Journaux utiles :
- Application : `C:\inetpub\ird\logs\node*.log`
- Base de données : `docker compose logs -f` dans `C:\ird-data\supabase\docker`

---

## Annexe — Installation sans Docker

Si Docker est interdit sur votre parc, il faut installer séparément
PostgreSQL (<https://www.postgresql.org/download/windows/>, installateur EDB,
tout par défaut sauf le mot de passe `postgres` à noter) **puis** les services
Supabase (GoTrue pour les comptes, PostgREST pour l'API, Storage pour les
fichiers) en tant que services Windows. C'est une installation nettement plus
technique, à réserver à un prestataire ou à la DSI. Docker reste la voie
recommandée.

---

## Récapitulatif des valeurs à conserver

| Valeur | Où elle a été créée | Où elle est utilisée |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | B.4 | `.env` Supabase, sauvegardes |
| `JWT_SECRET` | B.4 | `.env` Supabase |
| Clé `anon` | B.4 | `.env` Supabase + `web.config` + `.env` du build |
| Clé `service_role` | B.4 | `.env` Supabase + `web.config` (**à ne jamais diffuser**) |
| `DASHBOARD_PASSWORD` | B.5 | console Supabase `http://localhost:8000` |
| Compte administrateur | F.2 | l'application |
