# Installer « Planification des IRD » sur un PC Windows 11 (méthode simple)

Tout tourne sur **un seul ordinateur** : l'application **et** la base de données.
Pas d'IIS, pas de Node.js, pas de fichier à modifier à la main.

- Durée : environ **45 minutes**, dont 20 minutes d'attente.
- Il faut être **administrateur** du PC et avoir Internet pendant l'installation.

---

## 1. Vérifier le PC (2 min)

| Élément | Minimum |
| --- | --- |
| Windows | 11 Pro ou Famille, à jour |
| Mémoire | 8 Go (16 Go conseillé) |
| Disque | 30 Go libres |

**Empêcher la mise en veille**, sinon l'application devient injoignable :
`Paramètres` → `Système` → `Alimentation` → **Mettre en veille après : Jamais**.

---

## 2. Installer Docker Desktop (15 min)

Docker est le seul logiciel à installer. Il est gratuit.

1. Ouvrir <https://www.docker.com/products/docker-desktop/>.
2. Cliquer **Download for Windows – AMD64**.
3. Lancer le fichier téléchargé. Laisser cochée **Use WSL 2**. Cliquer **OK**.
4. **Redémarrer** le PC quand c'est demandé.
5. Ouvrir **Docker Desktop**, accepter les conditions. Le compte Docker n'est pas
   nécessaire : cliquer **Skip** ou **Continue without signing in**.
6. Dans ⚙️ **Settings** → **General**, cocher **Start Docker Desktop when you sign in**.
7. Attendre que l'indicateur en bas à gauche soit **vert : Engine running**.

> Si Docker affiche « WSL needs updating » : clic droit sur **Démarrer** →
> **Terminal (administrateur)**, taper `wsl --update`, Entrée, puis redémarrer.

---

## 3. Récupérer l'application (5 min)

1. Dans Lovable : bouton **GitHub** → **Export / Connect** pour envoyer le projet sur GitHub.
2. Sur la page GitHub du projet : bouton vert **Code** → **Download ZIP**.
3. Clic droit sur le ZIP → **Extraire tout…** → destination : `C:\IRD-application`.

Vous devez voir dans `C:\IRD-application` les fichiers **installer.bat**,
**mettre-a-jour.bat** et **sauvegarder.bat**.

> Si le dossier contient un seul sous-dossier (ex. `mon-projet-main`), ouvrez-le :
> c'est lui qui contient les fichiers `.bat`.

---

## 4. Installer (double-clic, 20 min)

1. **Docker Desktop doit être ouvert et vert.**
2. Double-cliquer **installer.bat** et répondre **Oui** à la fenêtre de sécurité.
3. Deux questions s'affichent. Appuyez simplement sur **Entrée** pour garder les valeurs proposées :
   - *Nom de cet ordinateur* : le nom du PC, proposé automatiquement.
   - *Port de l'application* : `80`.
4. Patientez. Le script fait tout seul :
   - il télécharge la base de données ;
   - il crée **tous les mots de passe et les clés** ;
   - il ouvre le pare-feu pour les autres postes ;
   - il construit et démarre l'application ;
   - il crée les tables et le dossier des pièces jointes.
5. À la fin, un encadré vert donne les adresses à utiliser.

Les mots de passe créés sont notés dans **`C:\IRD-serveur\MOTS-DE-PASSE.txt`**.
Copiez ce fichier en lieu sûr (clé USB) et ne le diffusez pas.

---

## 5. Premier démarrage (5 min)

1. Sur le PC, ouvrir <http://localhost>.
2. Cliquer **Première utilisation ? Créer le compte administrateur**, saisir votre
   e-mail et un mot de passe.
   → **Le premier compte créé devient administrateur.** Faites-le tout de suite.
3. Menu **Élus** : ajouter chaque élu puis **Créer le compte**, et transmettre le mot
   de passe affiché.
4. Menu **Événements** : créer un IRD, puis utiliser **Ouvrir dans Outlook** pour envoyer
   les invitations.

**Depuis les autres postes de la mairie**, ouvrir `http://NOM-DU-PC` (le nom affiché
dans l'encadré vert, par exemple `http://PC-CABINET`).

---

## 6. Utilisation au quotidien

| Je veux… | Je fais… |
| --- | --- |
| Allumer / éteindre | Rien de spécial : au démarrage de la session, Docker relance tout (compter 2 minutes). |
| **Sauvegarder** | Double-cliquer **sauvegarder.bat**. La copie va dans `C:\IRD-serveur\sauvegardes\date`. |
| **Mettre à jour** | Télécharger le nouveau ZIP depuis GitHub, l'extraire **par-dessus** `C:\IRD-application`, puis double-cliquer **mettre-a-jour.bat**. Une sauvegarde est faite avant. |
| Voir la base | Ouvrir `http://localhost:8000` (identifiant et mot de passe dans `MOTS-DE-PASSE.txt`). |

### Sauvegarde automatique chaque nuit (facultatif)

1. Menu Démarrer → taper **Planificateur de tâches** → **Créer une tâche de base**.
2. Nom : `Sauvegarde IRD` → **Tous les jours** → `02:00`.
3. Action **Démarrer un programme** :
   - Programme : `C:\IRD-application\sauvegarder.bat`
   - Arguments : `auto`
4. **Terminer**. Les sauvegardes de plus de 30 jours sont effacées automatiquement.

---

## 7. En cas de problème

| Symptôme | Solution |
| --- | --- |
| « Docker Desktop n'est pas lancé » | Ouvrir Docker Desktop, attendre le voyant vert, relancer le `.bat`. |
| La page ne s'ouvre pas sur `http://localhost` | Le port 80 est déjà pris (souvent IIS ou Skype). Relancez l'installation en supprimant `C:\IRD-serveur` et choisissez le port `8080`, puis ouvrez `http://localhost:8080`. |
| « Failed to fetch » à la connexion | Docker est arrêté, ou le nom du PC a changé. Ouvrez Docker Desktop. |
| Les autres postes n'accèdent pas | Vérifier qu'ils utilisent bien `http://NOM-DU-PC`, que le PC n'est pas en veille et que le réseau est de type **Privé**. |
| Tout réinstaller de zéro | Docker Desktop → **Containers** → supprimer `base`. Supprimer le dossier `C:\IRD-serveur` (faites une sauvegarde avant !), puis relancer **installer.bat**. |

Pour un diagnostic : Docker Desktop → **Containers** → cliquer sur `ird-app` ou `supabase-db`
→ onglet **Logs**. Copiez les dernières lignes rouges et transmettez-les.
