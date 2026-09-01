# Tutoriel débutant — Installer l'application « Planification des IRD » sur un PC Windows 11 avec IIS

Ce tutoriel s'adresse à une personne qui n'a **jamais** déployé d'application web.
Tout est installé sur **un seul ordinateur Windows 11** : l'application **et** la base de
données. Aucun service en ligne (ni Lovable, ni cloud) n'est nécessaire une fois le code
récupéré.

- Temps à prévoir : **2 h à 3 h** la première fois.
- Vous devez être **administrateur** de l'ordinateur.
- Ouvrez un **Bloc-notes** maintenant : vous y noterez, au fur et à mesure, les mots de
  passe et les clés générés. Vous en aurez besoin plus loin.

---

## Étape 0 — Vérifier l'ordinateur

| Élément | Minimum conseillé |
| --- | --- |
| Système | Windows 11 (Édition **Pro** conseillée) |
| Processeur | 4 cœurs |
| Mémoire | 8 Go (16 Go conseillé) |
| Disque | 60 Go libres |
| Compte | Administrateur local |

> Windows 11 **Famille** fonctionne aussi (IIS et Docker Desktop y sont disponibles),
> mais certaines captures de menus peuvent légèrement différer.

**Empêcher la mise en veille** (sinon le site devient injoignable) :
`Paramètres` → `Système` → `Alimentation et batterie` → `Écran et veille` →
mettre **« Mettre mon appareil en veille après »** sur **Jamais**.

### Comment ouvrir PowerShell « en tant qu'administrateur »

Clic droit sur le bouton **Démarrer** → **Terminal (administrateur)** →
répondre **Oui** à la fenêtre de sécurité. Vous vous en servirez souvent.

---

## Étape 1 — Les logiciels à installer

Installez-les **dans cet ordre**. Pour chacun : lien officiel, version à choisir, et une
commande pour vérifier que ça a marché.

### 1.1 Node.js (fait tourner l'application)

- Lien : <https://nodejs.org/fr>
- Choisir : le bouton **LTS** (version 20 ou 22), fichier **Windows Installer (.msi) — x64**
- Installation : tout laisser par défaut, garder la case **Add to PATH**.
- Vérification (nouvelle fenêtre PowerShell) :

  ```powershell
  node -v
  npm -v
  ```

  Vous devez voir par exemple `v22.14.0` et `10.9.0`. Si « commande inconnue »,
  fermez et rouvrez PowerShell, sinon redémarrez l'ordinateur.

### 1.2 Git pour Windows (récupère le code)

- Lien : <https://git-scm.com/download/win>
- Choisir : **64-bit Git for Windows Setup**
- Installation : **Suivant** partout (options par défaut).
- Vérification : `git --version`

### 1.3 Docker Desktop (porte la base de données)

- Lien : <https://www.docker.com/products/docker-desktop/>
- Choisir : **Download for Windows — AMD64** (ou ARM64 sur PC Copilot+ / Snapdragon)
- Installation : laisser cochée l'option **Use WSL 2 instead of Hyper-V**, puis
  **redémarrer** l'ordinateur quand c'est demandé.
- Au premier lancement : accepter les conditions ; un compte Docker n'est **pas**
  obligatoire (cliquer sur « Continue without signing in » si proposé).
- Dans **Settings → General**, cocher **Start Docker Desktop when you log in**.
- En bas à gauche de la fenêtre Docker, l'indicateur doit être **vert / Engine running**.
- Vérification :

  ```powershell
  docker --version
  docker compose version
  ```

> **Si WSL 2 manque** : dans PowerShell administrateur, taper `wsl --install`, puis
> redémarrer et relancer l'installation de Docker Desktop.
>
> **Si Docker est interdit chez vous** : voir l'annexe en fin de document.

### 1.4 Module IIS « HttpPlatformHandler » (relie IIS à Node.js)

- Lien : <https://www.iis.net/downloads/microsoft/httpplatformhandler>
- Choisir : **v1.2**, fichier **x64**
- ⚠️ À installer **après** avoir activé IIS (étape 2). Notez le lien pour l'instant.

### 1.5 Visual Studio Code (facultatif, pour éditer des fichiers texte)

- Lien : <https://code.visualstudio.com/>
- Le Bloc-notes de Windows suffit si vous préférez.

---

## Étape 2 — Activer IIS sur Windows 11

1. Appuyer sur **Windows**, taper `Fonctionnalités Windows`, ouvrir
   **Activer ou désactiver des fonctionnalités Windows**.
2. Cocher **Services Internet (IIS)**. En dépliant la ligne, vérifier que sont cochés :
   - **Outils d'administration Web** → **Console de gestion IIS**
   - **Services World Wide Web** → **Fonctionnalités HTTP communes** (Document par défaut,
     Contenu statique, Erreurs HTTP, Redirection HTTP)
   - **Services World Wide Web** → **Intégrité et diagnostics** → Journalisation HTTP
   - **Services World Wide Web** → **Performances** → Compression du contenu statique
3. **OK**, patienter, puis redémarrer si demandé.
4. Vérification : ouvrir un navigateur sur `http://localhost` → la page d'accueil IIS
   (fond bleu, logo IIS) doit s'afficher.
5. **Maintenant seulement**, installer le module **HttpPlatformHandler** téléchargé en 1.4.
6. Vérification : ouvrir **Gestionnaire des services Internet (IIS)** (taper `IIS` dans
   le menu Démarrer) → cliquer sur le nom de l'ordinateur à gauche → double-clic sur
   **Modules** → la ligne `httpPlatformHandler` doit apparaître dans la liste.

### Ouvrir le pare-feu (utile seulement si d'autres postes doivent accéder au site)

Dans PowerShell **administrateur** :

```powershell
New-NetFirewallRule -DisplayName "IRD HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "IRD HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## Étape 3 — Installer la base de données sur l'ordinateur

L'application a besoin de **PostgreSQL** (les données) **et** des services de comptes et
de fichiers qui vont avec. Le plus simple sur Windows 11 : **Supabase auto-hébergé**, qui
installe tout d'un coup avec Docker. C'est **gratuit** et **100 % local**.

### 3.1 Télécharger Supabase

Dans PowerShell (pas besoin d'être administrateur) :

```powershell
mkdir C:\ird-data
cd C:\ird-data
git clone --depth 1 https://github.com/supabase/supabase
cd C:\ird-data\supabase\docker
copy .env.example .env
```

### 3.2 Fabriquer les mots de passe et les clés

Toujours dans PowerShell :

```powershell
# 1) Mot de passe de la base de données  -> POSTGRES_PASSWORD
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | % {[char]$_})

# 2) Secret de signature des connexions   -> JWT_SECRET
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

Notez les deux résultats dans votre Bloc-notes.

Puis les **deux clés d'API** :

1. Ouvrir <https://supabase.com/docs/guides/self-hosting/docker#securing-your-services>
   (page publique, aucun compte requis).
2. Coller votre `JWT_SECRET` dans le générateur de la page.
3. Copier la clé **anon** et la clé **service_role** dans le Bloc-notes.

> La clé **service_role** donne tous les droits sur la base : ne la transmettez à
> personne et ne la mettez jamais dans un e-mail.

### 3.3 Renseigner le fichier `.env` de Supabase

Ouvrir `C:\ird-data\supabase\docker\.env` (Bloc-notes ou VS Code) et modifier ces lignes :

```env
POSTGRES_PASSWORD=votre_mot_de_passe_base
JWT_SECRET=votre_secret_jwt
ANON_KEY=votre_cle_anon
SERVICE_ROLE_KEY=votre_cle_service_role

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=un_mot_de_passe_pour_la_console

SITE_URL=http://localhost
API_EXTERNAL_URL=http://localhost:8000
SUPABASE_PUBLIC_URL=http://localhost:8000

ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
DISABLE_SIGNUP=false
```

Enregistrer et fermer.

> `ENABLE_EMAIL_AUTOCONFIRM=true` est important : sans serveur d'e-mail, les comptes
> doivent être validés automatiquement, sinon personne ne peut se connecter.

### 3.4 Démarrer la base

Docker Desktop doit être **lancé et vert**. Puis :

```powershell
cd C:\ird-data\supabase\docker
docker compose pull
docker compose up -d
```

Le premier téléchargement dure 5 à 15 minutes. Vérification :

```powershell
docker compose ps
```

Toutes les lignes doivent être `running` ou `healthy`.

Ouvrir ensuite `http://localhost:8000` : la console Supabase demande le
`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` définis plus haut.

> La base redémarre toute seule à chaque ouverture de session Windows, tant que Docker
> Desktop est réglé sur « Start when you log in » (étape 1.3).

---

## Étape 4 — Créer les tables et le dossier des pièces jointes

1. Récupérer le code du projet si ce n'est pas déjà fait (voir étape 5.1) : le dossier
   `supabase\migrations\` contient des fichiers `.sql` nommés par date.
2. Dans la console `http://localhost:8000`, ouvrir **SQL Editor** → **New query**.
3. **Dans l'ordre chronologique** (du plus ancien au plus récent) : ouvrir un fichier
   `.sql`, copier tout son contenu, le coller dans l'éditeur, cliquer **Run**, vérifier le
   message `Success`. Passer au fichier suivant. Ne sautez aucun fichier.
4. Créer le stockage des pièces jointes : menu **Storage** → **New bucket** →
   nom exactement `ird-attachments` → laisser **Public** **décoché** → **Create**.
5. Vérification : menu **Table Editor** → vous devez voir les tables
   `events`, `elus`, `invitations`, `user_roles`.

> Une erreur « already exists » signifie que ce fichier a déjà été passé : continuez
> simplement au suivant.

---

## Étape 5 — Fabriquer l'application

### 5.1 Récupérer le code

Dans Lovable, bouton **GitHub** en haut à droite → **Export to GitHub**. Puis, sur le PC :

```powershell
mkdir C:\build
cd C:\build
git clone https://github.com/<votre-compte>/<votre-depot>.git ird
cd C:\build\ird
```

### 5.2 Créer le fichier `.env` du build

Deux valeurs sont intégrées aux pages au moment de la construction : elles doivent donc
exister **avant** de lancer le build. Dans `C:\build\ird`, créer un fichier nommé
exactement `.env` contenant :

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_anon
```

Commande équivalente en PowerShell :

```powershell
cd C:\build\ird
@"
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_anon
"@ | Set-Content -Encoding utf8 .env
```

> Si d'autres postes du réseau doivent utiliser l'application, remplacez `localhost` par
> le **nom de l'ordinateur** (voir étape 8).

### 5.3 Construire le paquet

```powershell
npm install
npm run build:iis
```

Un dossier **`dist-iis\`** apparaît :

```text
dist-iis\
  .output\                      l'application
  web.config                    la configuration IIS
  installer-ird.ps1             l'installateur automatique
  ird-config.json               modèle de réponses (facultatif)
  logs\                         les journaux
  LISEZ-MOI.md
  GUIDE-INSTALLATION-PAS-A-PAS.md
  TUTO-WINDOWS-11.md            (ce document)
```

---

## Étape 6 — Installer l'application dans IIS

### Voie rapide (recommandée) — l'installateur automatique

```powershell
cd C:\build\ird\dist-iis
powershell -ExecutionPolicy Bypass -File .\installer-ird.ps1
```

Le script pose chaque question en proposant une valeur par défaut : appuyez sur **Entrée**
pour l'accepter.

| Question | Réponse pour une installation sur un seul PC |
| --- | --- |
| Nom du site IIS | `IRD` |
| Port HTTP | `80` (ou `8080` si le port 80 est déjà pris) |
| Dossier de déploiement | `C:\inetpub\ird` |
| Nom d'hôte | laisser vide |
| Adresse de la base (serveur) | `http://localhost:8000` |
| Adresse de la base (postes) | `http://localhost:8000` |
| Clé anon / clé service_role | celles du Bloc-notes |
| Hôte / port / base / utilisateur PostgreSQL | `localhost` / `5432` / `postgres` / `postgres` |
| Mot de passe PostgreSQL | `POSTGRES_PASSWORD` du Bloc-notes |

À la fin, le script affiche l'adresse du site et vérifie qu'il répond. Passez à l'étape 7.

### Voie manuelle (si vous préférez tout faire à la main)

1. Copier tout le contenu de `dist-iis\` dans `C:\inetpub\ird`.
2. Ouvrir `C:\inetpub\ird\web.config` et renseigner les valeurs :

   ```xml
   <environmentVariable name="SUPABASE_URL"              value="http://localhost:8000" />
   <environmentVariable name="SUPABASE_PUBLISHABLE_KEY"  value="votre_cle_anon" />
   <environmentVariable name="SUPABASE_SERVICE_ROLE_KEY" value="votre_cle_service_role" />
   <environmentVariable name="VITE_SUPABASE_URL"             value="http://localhost:8000" />
   <environmentVariable name="VITE_SUPABASE_PUBLISHABLE_KEY" value="votre_cle_anon" />
   ```

3. Ouvrir le **Gestionnaire des services Internet (IIS)** → clic droit sur **Sites** →
   **Ajouter un site Web** :
   - Nom du site : `IRD`
   - Chemin d'accès physique : `C:\inetpub\ird`
   - Liaison : `http`, port `80`, nom d'hôte vide
4. **Pools d'applications** → double-clic sur `IRD` :
   - Version du .NET CLR : **Sans code managé**
   - Mode pipeline : **Intégré**
5. Pool `IRD` → **Paramètres avancés** :
   - **Démarrage automatique** : `True`
   - **Délai d'inactivité (minutes)** : `0`
   - **Intervalle de recyclage régulier** : `0`
6. Donner les droits, dans PowerShell **administrateur** :

   ```powershell
   icacls "C:\inetpub\ird"      /grant "IIS AppPool\IRD:(OI)(CI)RX" /T
   icacls "C:\inetpub\ird\logs" /grant "IIS AppPool\IRD:(OI)(CI)M"  /T
   ```

7. Sélectionner le site `IRD` → **Démarrer** (colonne de droite).

> Le site par défaut d'IIS occupe déjà le port 80. Si le démarrage échoue, arrêtez
> **Default Web Site** dans IIS, ou choisissez le port `8080` pour le site `IRD`
> (l'adresse devient alors `http://localhost:8080`).

---

## Étape 7 — Premier démarrage

1. Ouvrir `http://localhost` (ou `http://localhost:8080`) : la page de connexion de
   l'application s'affiche.
2. Cliquer sur **Créer un compte**, saisir l'adresse e-mail et le mot de passe de
   l'administrateur principal.
   → **Le tout premier compte créé devient automatiquement administrateur.**
   Créez-le tout de suite, avant d'ouvrir l'application aux autres.
3. Une fois connecté :
   - **Élus** : ajouter chaque élu (nom + e-mail), puis **Créer le compte**. Le mot de
     passe s'affiche : copiez-le et transmettez-le à l'élu. L'administrateur peut aussi
     réinitialiser un mot de passe ou supprimer un utilisateur.
   - **Administrateurs** : ajouter d'autres administrateurs si nécessaire.
   - **Événements** : créer un IRD (titre, lieu, adresse, date et heure, organisateur,
     présence du maire, document et visuel de l'invitation).
4. **Envoyer les invitations** : sur la fiche de l'IRD, bouton **Ouvrir dans Outlook**.
   Un brouillon **nominatif par élu** est téléchargé (fichier `.eml`) puis s'ouvre dans
   Outlook avec les pièces jointes. Il ne reste qu'à cliquer sur **Envoyer**.
   → Outlook doit être l'application par défaut pour les fichiers `.eml` :
   `Paramètres` → `Applications` → `Applications par défaut` → rechercher `.eml`.
5. Les élus se connectent à l'application avec leur compte, ouvrent **Mes invitations**,
   voient l'invitation complète, la liste des invités, et répondent **Présent / Absent**.
6. Le **calendrier** est consultable par tout le monde : les IRD où le maire est présent
   apparaissent dans une couleur différente.

---

## Étape 8 — Accéder à l'application depuis d'autres postes (facultatif)

1. Trouver le nom de l'ordinateur : `Paramètres` → `Système` → `Informations système` →
   **Nom de l'appareil** (ex. `PC-MAIRIE`).
2. Dans `C:\ird-data\supabase\docker\.env`, remplacer `localhost` par ce nom dans
   `SITE_URL`, `API_EXTERNAL_URL` et `SUPABASE_PUBLIC_URL`, puis :
   `docker compose up -d`.
3. Dans le `.env` du build (étape 5.2), mettre `VITE_SUPABASE_URL=http://PC-MAIRIE:8000`,
   refaire `npm run build:iis` et réinstaller (étape 6).
4. Vérifier les règles de pare-feu (étape 2) et ajouter le port de la base :

   ```powershell
   New-NetFirewallRule -DisplayName "IRD BDD" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
   ```

5. Depuis un autre poste : `http://PC-MAIRIE/`.

> **HTTPS** : pour un usage au-delà d'un poste isolé, importez le certificat de la
> collectivité dans IIS (**Certificats de serveur** → **Importer**), ajoutez une liaison
> `https` port `443` au site, puis remplacez partout `http://` par `https://` dans les
> deux fichiers `.env` et dans `web.config`, et relancez Docker et le site.

---

## Étape 9 — Entretien courant

### Sauvegarder la base chaque nuit

Créer `C:\ird-data\sauvegarde.ps1` :

```powershell
$date = Get-Date -Format "yyyy-MM-dd"
$dest = "C:\ird-data\backups"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
docker exec supabase-db pg_dumpall -U postgres | Out-File "$dest\ird-$date.sql" -Encoding utf8
Get-ChildItem $dest -Filter *.sql | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

Puis **Planificateur de tâches** → **Créer une tâche de base** → tous les jours à 02:00 →
Action : `powershell.exe -File C:\ird-data\sauvegarde.ps1`.
Copiez ensuite le dossier `backups` sur une clé USB ou un lecteur réseau.

### Éteindre et rallumer l'ordinateur

Rien de particulier : au démarrage de la session Windows, Docker Desktop relance la base
et IIS relance le site automatiquement. Comptez 1 à 2 minutes avant que le site réponde.

### Mettre à jour l'application

```powershell
cd C:\build\ird
git pull
npm install
npm run build:iis
```

Puis relancer `installer-ird.ps1` (il sauvegarde l'ancienne version avant de remplacer),
ou, en manuel : arrêter le site dans IIS, remplacer **uniquement** le dossier `.output`
(garder `web.config` et `logs`), redémarrer le site.

### Dépannage

| Symptôme | Cause probable / solution |
| --- | --- |
| Page d'accueil IIS au lieu de l'application | Le site `IRD` n'est pas démarré, ou `Default Web Site` occupe le port 80 |
| Erreur 502.3 ou 500.19 | HttpPlatformHandler non installé, ou chemin de `node.exe` erroné dans `web.config` |
| Page blanche et dossier `logs\` vide | Le pool n'a pas les droits sur le dossier → refaire les commandes `icacls` |
| « Failed to fetch » à la connexion | Docker est arrêté, ou `VITE_SUPABASE_URL` ne correspond pas à l'adresse réellement utilisée |
| Mot de passe refusé / compte introuvable | Clé `anon` incorrecte, ou compte non encore créé par l'administrateur |
| Pièce jointe refusée | Augmenter `maxAllowedContentLength` dans `web.config` |
| Le site tombe après quelques heures | Délai d'inactivité du pool non mis à `0` (étape 6) |
| Docker « Engine stopped » | Ouvrir Docker Desktop ; vérifier WSL 2 avec `wsl --status` |
| `docker compose` inconnu | Docker Desktop n'est pas lancé, ou PowerShell doit être rouvert |

Journaux utiles :
- Application : `C:\inetpub\ird\logs\node*.log`
- Base de données : `docker compose logs -f` dans `C:\ird-data\supabase\docker`

---

## Annexe — Si Docker est interdit sur le poste

Il faut alors installer séparément **PostgreSQL**
(<https://www.postgresql.org/download/windows/>, installateur EDB, tout par défaut sauf le
mot de passe `postgres` à noter) **puis** les services Supabase (GoTrue pour les comptes,
PostgREST pour l'API, Storage pour les fichiers) en tant que services Windows. C'est une
installation nettement plus technique, à réserver à un prestataire ou à la DSI. Docker
reste la voie recommandée.

---

## Récapitulatif des valeurs à conserver

| Valeur | Créée à l'étape | Utilisée dans |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | 3.2 | `.env` Supabase, installateur, sauvegardes |
| `JWT_SECRET` | 3.2 | `.env` Supabase |
| Clé `anon` | 3.2 | `.env` Supabase + `.env` du build + `web.config` |
| Clé `service_role` | 3.2 | `.env` Supabase + `web.config` (**ne jamais diffuser**) |
| `DASHBOARD_PASSWORD` | 3.3 | console `http://localhost:8000` |
| Compte administrateur | 7.2 | l'application |
