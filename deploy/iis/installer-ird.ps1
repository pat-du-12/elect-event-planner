<#
.SYNOPSIS
    Installation "one-click" de l'application « Planification des IRD » sur un serveur Windows + IIS.

.DESCRIPTION
    Ce script :
      1. active le rôle / la fonctionnalité IIS ;
      2. installe Node.js LTS et le module IIS HttpPlatformHandler (via winget, sinon téléchargement direct) ;
      3. ouvre les ports 80 / 443 du pare-feu ;
      4. copie le paquet de l'application (dossier dist-iis) vers le dossier cible ;
      5. renseigne les variables de connexion à la base dans web.config ;
      6. crée (ou met à jour) le pool d'applications et le site IIS, puis le démarre.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\installer-ird.ps1 `
        -SupabaseUrl "http://localhost:8000" `
        -AnonKey "cle_anon" `
        -ServiceRoleKey "cle_service_role" `
        -PublicSupabaseUrl "http://srv-ird.mairie.local:8000"

.NOTES
    À lancer dans une console PowerShell ouverte « en tant qu'administrateur »,
    depuis le dossier dist-iis (ou en précisant -SourcePath).
#>

[CmdletBinding()]
param(
    # Dossier contenant .output\ et web.config (paquet produit par « npm run build:iis »)
    [string]$SourcePath = (Split-Path -Parent $MyInvocation.MyCommand.Path),

    # Fichier de réponses JSON (facultatif) contenant tout ou partie des options
    [string]$ConfigFile = "",

    # Dossier d'installation sur le serveur
    [string]$SitePath = "",

    # Nom du site et du pool IIS
    [string]$SiteName = "",

    # Port HTTP du site
    [int]$Port = 0,

    # Nom d'hôte (facultatif, ex. srv-ird.mairie.local)
    [string]$HostName = "",

    # Adresse de la base vue depuis le serveur
    [string]$SupabaseUrl = "",

    # Adresse de la base vue depuis les postes utilisateurs (par défaut = SupabaseUrl)
    [string]$PublicSupabaseUrl = "",

    [string]$AnonKey = "",
    [string]$ServiceRoleKey = "",

    # Connexion PostgreSQL directe (facultative : construit DATABASE_URL)
    [string]$DbHost = "",
    [int]$DbPort = 0,
    [string]$DbName = "",
    [string]$DbUser = "",
    [string]$DbPassword = "",
    [string]$DatabaseUrl = "",

    # Poser les questions manquantes à l'écran (défaut) ou échouer si une valeur manque
    [switch]$NonInteractive,

    # Ne pas installer IIS / Node.js / HttpPlatformHandler (si déjà présents)
    [switch]$SkipPrerequisites
)

$ErrorActionPreference = "Stop"

function Write-Step($message) { Write-Host "`n=== $message ===" -ForegroundColor Cyan }
function Write-Ok($message) { Write-Host "  OK  $message" -ForegroundColor Green }
function Write-Warn2($message) { Write-Host "  !!  $message" -ForegroundColor Yellow }

# --- 0. Contrôles préalables -------------------------------------------------

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw "Ce script doit être lancé dans une console PowerShell ouverte en tant qu'administrateur."
}

if (-not (Test-Path (Join-Path $SourcePath ".output"))) {
    throw "Dossier .output introuvable dans « $SourcePath ». Lancez « npm run build:iis » puis copiez le dossier dist-iis sur le serveur."
}

# --- 0bis. Options : fichier JSON, puis questions à l'écran -------------------

$answers = @{}
if (-not [string]::IsNullOrWhiteSpace($ConfigFile)) {
    if (-not (Test-Path $ConfigFile)) { throw "Fichier de réponses introuvable : $ConfigFile" }
    $json = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    foreach ($p in $json.PSObject.Properties) { $answers[$p.Name] = [string]$p.Value }
    Write-Ok "Options lues depuis $ConfigFile"
}

function Resolve-Option {
    param(
        [string]$Name,        # nom de l'option (aussi utilisé dans le JSON)
        [string]$Current,     # valeur passée en paramètre
        [string]$Default,     # valeur par défaut proposée
        [string]$Question,    # question affichée
        [switch]$AllowEmpty   # accepter une valeur vide
    )
    if (-not [string]::IsNullOrWhiteSpace($Current)) { return $Current }
    if ($answers.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($answers[$Name])) {
        return $answers[$Name]
    }
    if ($NonInteractive) {
        if ([string]::IsNullOrWhiteSpace($Default) -and -not $AllowEmpty) {
            throw "Option manquante en mode non interactif : -$Name"
        }
        return $Default
    }
    $label = if ([string]::IsNullOrWhiteSpace($Default)) { $Question } else { "$Question [$Default]" }
    $value = Read-Host $label
    if ([string]::IsNullOrWhiteSpace($value)) { $value = $Default }
    if ([string]::IsNullOrWhiteSpace($value) -and -not $AllowEmpty) {
        throw "Une valeur est nécessaire pour « $Name »."
    }
    return $value
}

if (-not $NonInteractive) { Write-Step "Paramètres de l'installation (Entrée = valeur proposée)" }

$SiteName = Resolve-Option -Name "SiteName" -Current $SiteName -Default "IRD" -Question "Nom du site IIS"
$SitePath = Resolve-Option -Name "SitePath" -Current $SitePath -Default "C:\inetpub\ird" -Question "Dossier de déploiement"
$portValue = Resolve-Option -Name "Port" -Current $(if ($Port -gt 0) { "$Port" } else { "" }) -Default "80" -Question "Port HTTP du site"
$Port = [int]$portValue
$HostName = Resolve-Option -Name "HostName" -Current $HostName -Default "" -Question "Nom d'hôte (vide = toutes les adresses)" -AllowEmpty

Write-Step "Paramètres de la base de données"
$SupabaseUrl = Resolve-Option -Name "SupabaseUrl" -Current $SupabaseUrl -Default "http://localhost:8000" -Question "Adresse de la base (depuis le serveur)"
$PublicSupabaseUrl = Resolve-Option -Name "PublicSupabaseUrl" -Current $PublicSupabaseUrl -Default $SupabaseUrl -Question "Adresse de la base (depuis les postes)"
$AnonKey = Resolve-Option -Name "AnonKey" -Current $AnonKey -Default "" -Question "Clé publique (anon)" -AllowEmpty
$ServiceRoleKey = Resolve-Option -Name "ServiceRoleKey" -Current $ServiceRoleKey -Default "" -Question "Clé de service (service_role)" -AllowEmpty

$DatabaseUrl = Resolve-Option -Name "DatabaseUrl" -Current $DatabaseUrl -Default "" -Question "Chaîne de connexion PostgreSQL complète (vide = la construire)" -AllowEmpty
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $DbHost = Resolve-Option -Name "DbHost" -Current $DbHost -Default "" -Question "Serveur PostgreSQL (vide = ignorer)" -AllowEmpty
    if (-not [string]::IsNullOrWhiteSpace($DbHost)) {
        $dbPortValue = Resolve-Option -Name "DbPort" -Current $(if ($DbPort -gt 0) { "$DbPort" } else { "" }) -Default "5432" -Question "Port PostgreSQL"
        $DbPort = [int]$dbPortValue
        $DbName = Resolve-Option -Name "DbName" -Current $DbName -Default "postgres" -Question "Nom de la base"
        $DbUser = Resolve-Option -Name "DbUser" -Current $DbUser -Default "postgres" -Question "Utilisateur PostgreSQL"
        $DbPassword = Resolve-Option -Name "DbPassword" -Current $DbPassword -Default "" -Question "Mot de passe PostgreSQL" -AllowEmpty
        $encUser = [uri]::EscapeDataString($DbUser)
        $encPass = [uri]::EscapeDataString($DbPassword)
        $DatabaseUrl = "postgresql://${encUser}:${encPass}@${DbHost}:${DbPort}/${DbName}"
    }
}

if ([string]::IsNullOrWhiteSpace($PublicSupabaseUrl)) { $PublicSupabaseUrl = $SupabaseUrl }

Write-Step "Récapitulatif"
Write-Host "  Site IIS          : $SiteName"
Write-Host "  Dossier           : $SitePath"
Write-Host "  Port / hôte       : $Port $(if ($HostName) { "($HostName)" })"
Write-Host "  Base (serveur)    : $SupabaseUrl"
Write-Host "  Base (postes)     : $PublicSupabaseUrl"
Write-Host "  Clés fournies     : anon=$([bool]$AnonKey) service_role=$([bool]$ServiceRoleKey)"
if ($DatabaseUrl) { Write-Host "  PostgreSQL        : configuré" }


# --- 1. Prérequis ------------------------------------------------------------

function Install-IIS {
    Write-Step "Installation d'IIS"
    if (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue) {
        Install-WindowsFeature -Name Web-Server, Web-Mgmt-Console, Web-Http-Redirect, Web-Static-Content `
            -IncludeManagementTools | Out-Null
    }
    else {
        $features = @("IIS-WebServerRole", "IIS-WebServer", "IIS-ManagementConsole", "IIS-StaticContent", "IIS-HttpRedirect")
        foreach ($f in $features) {
            Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart -ErrorAction SilentlyContinue | Out-Null
        }
    }
    Write-Ok "IIS installé"
}

function Install-Nodejs {
    Write-Step "Installation de Node.js LTS"
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Ok "Node.js déjà présent ($(node -v))"
        return
    }
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
    }
    else {
        $msi = Join-Path $env:TEMP "nodejs-lts.msi"
        Write-Host "  Téléchargement de Node.js…"
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi" -OutFile $msi -UseBasicParsing
        Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
    }
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User")
    Write-Ok "Node.js installé"
}

function Install-HttpPlatformHandler {
    Write-Step "Installation du module IIS HttpPlatformHandler"
    $installed = Test-Path "$env:SystemRoot\System32\inetsrv\httpplatformhandler.dll"
    if ($installed) { Write-Ok "HttpPlatformHandler déjà présent"; return }

    $msi = Join-Path $env:TEMP "httpplatformhandler.msi"
    Invoke-WebRequest -UseBasicParsing -OutFile $msi `
        -Uri "https://download.microsoft.com/download/A/A/6/AA6D0D1F-8E10-4E52-A1A0-3F0FA3D9E5F0/httpPlatformHandler_amd64.msi"
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
    Write-Ok "HttpPlatformHandler installé"
}

function Set-FirewallRules {
    Write-Step "Ouverture des ports du pare-feu"
    foreach ($rule in @(@{ Name = "IRD HTTP"; Port = $Port }, @{ Name = "IRD HTTPS"; Port = 443 })) {
        if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP `
                -LocalPort $rule.Port -Action Allow | Out-Null
        }
    }
    Write-Ok "Ports $Port et 443 autorisés"
}

if (-not $SkipPrerequisites) {
    Install-IIS
    Install-Nodejs
    Install-HttpPlatformHandler
    Set-FirewallRules
}

Import-Module WebAdministration

# --- 2. Copie des fichiers ---------------------------------------------------

Write-Step "Copie de l'application vers $SitePath"

if (Test-Path $SitePath) {
    if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
        Stop-Website -Name $SiteName -ErrorAction SilentlyContinue
    }
    $backup = "$SitePath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    if (Test-Path (Join-Path $SitePath ".output")) {
        New-Item -ItemType Directory -Force -Path $backup | Out-Null
        Copy-Item (Join-Path $SitePath ".output") $backup -Recurse -Force
        Write-Ok "Sauvegarde de l'ancienne version : $backup"
    }
    Remove-Item (Join-Path $SitePath ".output") -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $SitePath | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SitePath "logs") | Out-Null

Copy-Item (Join-Path $SourcePath ".output") $SitePath -Recurse -Force
foreach ($file in @("web.config", "LISEZ-MOI.md", "GUIDE-INSTALLATION-PAS-A-PAS.md")) {
    $src = Join-Path $SourcePath $file
    if (Test-Path $src) { Copy-Item $src $SitePath -Force }
}
Write-Ok "Fichiers copiés"

# --- 3. Configuration de web.config -----------------------------------------

Write-Step "Configuration des paramètres de connexion"

$webConfigPath = Join-Path $SitePath "web.config"
[xml]$xml = Get-Content $webConfigPath
$envNode = $xml.configuration.'system.webServer'.httpPlatform.environmentVariables

function Set-EnvVar([string]$name, [string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return }
    $node = $envNode.environmentVariable | Where-Object { $_.name -eq $name }
    if ($null -eq $node) {
        $node = $xml.CreateElement("environmentVariable")
        $node.SetAttribute("name", $name)
        $envNode.AppendChild($node) | Out-Null
    }
    $node.SetAttribute("value", $value)
}

$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodeExe) { $xml.configuration.'system.webServer'.httpPlatform.SetAttribute("processPath", $nodeExe) }

Set-EnvVar "SUPABASE_URL" $SupabaseUrl
Set-EnvVar "SUPABASE_PUBLISHABLE_KEY" $AnonKey
Set-EnvVar "SUPABASE_SERVICE_ROLE_KEY" $ServiceRoleKey
Set-EnvVar "VITE_SUPABASE_URL" $PublicSupabaseUrl
Set-EnvVar "VITE_SUPABASE_PUBLISHABLE_KEY" $AnonKey

$xml.Save($webConfigPath)

if ([string]::IsNullOrWhiteSpace($AnonKey) -or [string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
    Write-Warn2 "Clés de la base non fournies : éditez $webConfigPath avant d'ouvrir l'application."
}
else { Write-Ok "web.config renseigné" }

# --- 4. Pool d'applications et site IIS -------------------------------------

Write-Step "Création du site IIS « $SiteName »"

if (-not (Test-Path "IIS:\AppPools\$SiteName")) { New-WebAppPool -Name $SiteName | Out-Null }
Set-ItemProperty "IIS:\AppPools\$SiteName" managedRuntimeVersion ""
Set-ItemProperty "IIS:\AppPools\$SiteName" startMode "AlwaysRunning"
Set-ItemProperty "IIS:\AppPools\$SiteName" processModel.idleTimeout ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\AppPools\$SiteName" recycling.periodicRestart.time ([TimeSpan]::Zero)

if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
    Set-ItemProperty "IIS:\Sites\$SiteName" physicalPath $SitePath
    Set-ItemProperty "IIS:\Sites\$SiteName" applicationPool $SiteName
}
else {
    New-Website -Name $SiteName -PhysicalPath $SitePath -ApplicationPool $SiteName `
        -Port $Port -HostHeader $HostName -Force | Out-Null
}
Set-ItemProperty "IIS:\Sites\$SiteName" serverAutoStart $true

# Droits du pool sur le dossier
$identity = "IIS AppPool\$SiteName"
& icacls $SitePath /grant "${identity}:(OI)(CI)RX" /T /Q | Out-Null
& icacls (Join-Path $SitePath "logs") /grant "${identity}:(OI)(CI)M" /T /Q | Out-Null

Start-Website -Name $SiteName
Write-Ok "Site démarré"

# --- 5. Vérification ---------------------------------------------------------

Write-Step "Vérification"
Start-Sleep -Seconds 5
$url = "http://localhost:$Port/"
try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
    Write-Ok "L'application répond (code $($response.StatusCode)) sur $url"
}
catch {
    Write-Warn2 "Pas de réponse sur $url. Consultez les journaux : $(Join-Path $SitePath 'logs')"
}

Write-Host "`nInstallation terminée." -ForegroundColor Green
Write-Host "Ouvrez $url puis créez le premier compte : il devient automatiquement administrateur." -ForegroundColor Green
