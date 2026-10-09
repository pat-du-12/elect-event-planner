<#
  Planification des IRD - installation locale avec Docker Desktop.
  Utilise par installer.bat, mettre-a-jour.bat et sauvegarder.bat.

    ird.ps1 -Action installer
    ird.ps1 -Action mettre-a-jour
    ird.ps1 -Action sauvegarder
#>
param(
    [ValidateSet("installer", "mettre-a-jour", "sauvegarder")]
    [string]$Action = "installer",
    [string]$Dossier = "C:\IRD-serveur"
)

$ErrorActionPreference = "Stop"
$Source   = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Base     = Join-Path $Dossier "base"
$EnvFile  = Join-Path $Base ".env"
$Compose  = @("compose", "--env-file", $EnvFile, "-f", (Join-Path $Base "docker-compose.yml"), "-f", (Join-Path $Base "docker-compose.app.yml"))

function Etape($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  OK  $t" -ForegroundColor Green }
function Erreur($t){ Write-Host "`n  ERREUR : $t" -ForegroundColor Red; exit 1 }

function Tester-Docker {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { Erreur "Docker Desktop n'est pas lance. Ouvrez Docker Desktop, attendez 'Engine running', puis relancez." }
}

function Aleatoire([int]$n) {
    $c = [char[]]"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    $b = New-Object byte[] $n
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    -join ($b | ForEach-Object { $c[$_ % $c.Length] })
}

function B64Url([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd("=").Replace("+", "-").Replace("/", "_") }

function Jeton([string]$role, [string]$secret) {
    $u = [Text.Encoding]::UTF8
    $iat = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $h = B64Url $u.GetBytes('{"alg":"HS256","typ":"JWT"}')
    $p = B64Url $u.GetBytes("{`"role`":`"$role`",`"iss`":`"supabase`",`"iat`":$iat,`"exp`":$($iat + 315360000)}")
    $hmac = New-Object Security.Cryptography.HMACSHA256 (, $u.GetBytes($secret))
    "$h.$p." + (B64Url $hmac.ComputeHash($u.GetBytes("$h.$p")))
}

function Lire-Env {
    $m = @{}
    foreach ($l in Get-Content $EnvFile) { if ($l -match '^([A-Z0-9_]+)=(.*)$') { $m[$matches[1]] = $matches[2] } }
    $m
}

function Ecrire-Env([hashtable]$valeurs) {
    $lignes = [Collections.Generic.List[string]](Get-Content $EnvFile)
    foreach ($k in $valeurs.Keys) {
        $i = $lignes.FindIndex([Predicate[string]] { param($l) $l -match "^$k=" })
        if ($i -ge 0) { $lignes[$i] = "$k=$($valeurs[$k])" } else { $lignes.Add("$k=$($valeurs[$k])") }
    }
    [IO.File]::WriteAllLines($EnvFile, $lignes)
}

function Psql([string]$fichier) {
    Get-Content $fichier -Raw -Encoding UTF8 | docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -q -U supabase_admin -d postgres
    return $LASTEXITCODE
}

function Attendre-Base {
    Write-Host "  Attente du demarrage de la base (jusqu'a 5 minutes)..."
    for ($i = 0; $i -lt 100; $i++) {
        $r = docker exec supabase-db psql -U supabase_admin -d postgres -tAc "select (to_regclass('auth.users') is not null) and (to_regclass('storage.buckets') is not null)" 2>$null
        if ("$r".Trim() -eq "t") { Ok "Base prete"; return }
        Start-Sleep -Seconds 3
    }
    Erreur "La base ne repond pas. Regardez Docker Desktop > Containers."
}

function Appliquer-Migrations {
    Etape "Mise a jour des tables"
    $journal = Join-Path $Dossier "migrations-appliquees.txt"
    if (-not (Test-Path $journal)) { New-Item -ItemType File $journal | Out-Null }
    $faites = Get-Content $journal
    foreach ($f in Get-ChildItem (Join-Path $Source "supabase\migrations") -Filter *.sql | Sort-Object Name) {
        if ($faites -contains $f.Name) { continue }
        if ((Psql $f.FullName) -ne 0) { Erreur "Echec du fichier $($f.Name)" }
        Add-Content $journal $f.Name
        Ok $f.Name
    }
    if ((Psql (Join-Path $PSScriptRoot "sql\stockage.sql")) -ne 0) { Erreur "Echec de la creation du dossier des pieces jointes" }
    Ok "Dossier des pieces jointes pret"
}

function Demarrer {
    Etape "Demarrage (la premiere fois : 10 a 20 minutes)"
    $h = (Lire-Env)["IRD_HOTE"]
    Ecrire-Env @{ SITE_URL = "https://$h"; API_EXTERNAL_URL = "https://${h}:8443"; SUPABASE_PUBLIC_URL = "https://${h}:8443" }
    foreach ($r in @(@{n = "IRD https"; p = 443 }, @{n = "IRD https base"; p = 8443 }, @{n = "IRD http"; p = 80 })) {
        if (-not (Get-NetFirewallRule -DisplayName $r.n -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $r.n -Direction Inbound -Protocol TCP -LocalPort $r.p -Action Allow | Out-Null
        }
    }
    docker @Compose up -d --build
    if ($LASTEXITCODE -ne 0) { Erreur "Le demarrage a echoue (voir les messages ci-dessus)." }
    Ok "Services demarres"
    Installer-Certificat
}

function Installer-Certificat {
    $crt = Join-Path $Dossier "certificat-IRD.crt"
    # Retrouve le conteneur HTTPS quel que soit son nom reel (Compose peut le renommer).
    $cid = ""
    for ($i = 0; $i -lt 20; $i++) {
        $cid = (docker @Compose ps -q ird-https 2>$null | Select-Object -First 1)
        if ($cid) { break }
        Start-Sleep -Seconds 3
    }
    if (-not $cid) {
        Write-Host "  Conteneur HTTPS introuvable : le navigateur affichera un avertissement." -ForegroundColor Yellow
        return
    }
    for ($i = 0; $i -lt 20; $i++) {
        docker cp "${cid}:/data/caddy/pki/authorities/local/root.crt" $crt 2>$null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 3
    }
    if (Test-Path $crt) {
        Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
        Ok "Certificat HTTPS approuve sur ce PC (pour les autres postes : $crt)"
    } else { Write-Host "  Certificat HTTPS non recupere : le navigateur affichera un avertissement." -ForegroundColor Yellow }
}

function Afficher-Fin {
    $e = Lire-Env
    $adr = "https://$($e['IRD_HOTE'])"
    Write-Host "`n==============================================" -ForegroundColor Green
    Write-Host "  Application : $adr" -ForegroundColor Green
    Write-Host "  Sur ce PC   : https://localhost" -ForegroundColor Green
    Write-Host "  Console base: $($e['SUPABASE_PUBLIC_URL'])  (identifiant $($e['DASHBOARD_USERNAME']))" -ForegroundColor Green
    Write-Host "  Mots de passe et cles : $Dossier\MOTS-DE-PASSE.txt" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
switch ($Action) {

"installer" {
    Tester-Docker
    if (Test-Path $EnvFile) {
        Write-Host "Une installation existe deja dans $Dossier : redemarrage simple." -ForegroundColor Yellow
        # Recopie la configuration de l'application (elle a pu evoluer depuis la premiere installation).
        Copy-Item (Join-Path $PSScriptRoot "docker-compose.app.yml") $Base -Force
        Demarrer; Attendre-Base; Appliquer-Migrations; Afficher-Fin; break
    }

    Etape "Parametres (Entree = valeur proposee)"
    $hote = Read-Host "Nom de cet ordinateur sur le reseau [$env:COMPUTERNAME]"
    if (-not $hote) { $hote = $env:COMPUTERNAME }
    $port = Read-Host "Port de l'application [80]"
    if (-not $port) { $port = "80" }

    Etape "Telechargement de la base de donnees (Supabase)"
    New-Item -ItemType Directory -Force $Dossier | Out-Null
    $tmp = Join-Path $Dossier "supabase-src"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    docker run --rm -v "${Dossier}:/w" alpine/git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase /w/supabase-src
    if ($LASTEXITCODE -ne 0) { Erreur "Telechargement impossible (connexion Internet ?)." }
    docker run --rm -v "${Dossier}:/w" -w /w/supabase-src alpine/git sparse-checkout set docker
    Copy-Item (Join-Path $tmp "docker") $Base -Recurse -Force
    Remove-Item $tmp -Recurse -Force
    Copy-Item (Join-Path $PSScriptRoot "docker-compose.app.yml") $Base -Force
    Copy-Item (Join-Path $Base ".env.example") $EnvFile -Force
    Ok "Fichiers de la base prets"

    Etape "Creation automatique des mots de passe et des cles"
    $jwt = Aleatoire 48
    $v = @{
        POSTGRES_PASSWORD = Aleatoire 32
        JWT_SECRET = $jwt
        ANON_KEY = Jeton "anon" $jwt
        SERVICE_ROLE_KEY = Jeton "service_role" $jwt
        DASHBOARD_USERNAME = "admin"
        DASHBOARD_PASSWORD = Aleatoire 16
        SECRET_KEY_BASE = Aleatoire 64
        VAULT_ENC_KEY = Aleatoire 32
        PG_META_CRYPTO_KEY = Aleatoire 32
        LOGFLARE_PUBLIC_ACCESS_TOKEN = Aleatoire 32
        LOGFLARE_PRIVATE_ACCESS_TOKEN = Aleatoire 32
        SITE_URL = "http://$hote"
        API_EXTERNAL_URL = "http://${hote}:8000"
        SUPABASE_PUBLIC_URL = "http://${hote}:8000"
        ENABLE_EMAIL_SIGNUP = "true"
        ENABLE_EMAIL_AUTOCONFIRM = "true"
        DISABLE_SIGNUP = "false"
        IRD_SOURCE = $Source
        IRD_PORT = $port
        IRD_HOTE = $hote
    }
    Ecrire-Env $v
    @(
        "PLANIFICATION DES IRD - A CONSERVER EN LIEU SUR",
        "Console de la base : http://${hote}:8000",
        "  identifiant : admin",
        "  mot de passe : $($v.DASHBOARD_PASSWORD)",
        "Mot de passe PostgreSQL : $($v.POSTGRES_PASSWORD)",
        "Cle service_role (ne jamais diffuser) : $($v.SERVICE_ROLE_KEY)"
    ) | Set-Content (Join-Path $Dossier "MOTS-DE-PASSE.txt") -Encoding UTF8
    Ok "Cles creees et notees dans MOTS-DE-PASSE.txt"

    Etape "Ouverture du pare-feu pour les autres postes"
    foreach ($r in @(@{n = "IRD application"; p = $port }, @{n = "IRD base"; p = 8000 })) {
        if (-not (Get-NetFirewallRule -DisplayName $r.n -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $r.n -Direction Inbound -Protocol TCP -LocalPort $r.p -Action Allow | Out-Null
        }
    }
    Ok "Ports $port et 8000 ouverts"

    Demarrer; Attendre-Base; Appliquer-Migrations; Afficher-Fin
    Write-Host "`nOuvrez l'application et creez le premier compte : il devient administrateur." -ForegroundColor Green
}

"mettre-a-jour" {
    Tester-Docker
    if (-not (Test-Path $EnvFile)) { Erreur "Aucune installation trouvee. Lancez d'abord installer.bat." }
    & $PSCommandPath -Action sauvegarder -Dossier $Dossier
    Ecrire-Env @{ IRD_SOURCE = $Source }
    if (Test-Path (Join-Path $Source ".git")) {
        Etape "Recuperation de la derniere version du code"
        git -C $Source pull
    }
    Etape "Mise a jour des composants de la base"
    Copy-Item (Join-Path $PSScriptRoot "docker-compose.app.yml") $Base -Force
    docker @Compose pull --ignore-buildable
    Demarrer; Attendre-Base; Appliquer-Migrations; Afficher-Fin
}

"sauvegarder" {
    Tester-Docker
    $date = Get-Date -Format "yyyy-MM-dd_HH-mm"
    $dest = Join-Path $Dossier "sauvegardes\$date"
    New-Item -ItemType Directory -Force $dest | Out-Null
    Etape "Sauvegarde vers $dest"
    docker exec supabase-db pg_dumpall -U supabase_admin | Set-Content (Join-Path $dest "base.sql") -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { Erreur "La base n'a pas pu etre sauvegardee (est-elle demarree ?)." }
    $fichiers = Join-Path $Base "volumes\storage"
    if (Test-Path $fichiers) { Copy-Item $fichiers (Join-Path $dest "pieces-jointes") -Recurse -Force }
    Copy-Item $EnvFile (Join-Path $dest "parametres.env")
    Get-ChildItem (Join-Path $Dossier "sauvegardes") -Directory |
        Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Recurse -Force
    Ok "Sauvegarde terminee (les copies de plus de 30 jours sont effacees)"
    Write-Host "  Pensez a copier ce dossier sur une cle USB ou un disque reseau."
}
}
