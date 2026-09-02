#!/usr/bin/env node
/**
 * Build du paquet déployable sur IIS.
 *
 *   npm run build:iis
 *
 * Produit :
 *   dist-iis/
 *     .output/            (serveur Node autonome + fichiers statiques)
 *     web.config          (configuration IIS / HttpPlatformHandler)
 *     logs/               (journaux stdout du process Node)
 *     LISEZ-MOI.md        (procédure d'installation)
 *
 * Le dossier dist-iis/ se copie tel quel sur le serveur Windows.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist-iis");

console.log("→ Build de l'application (préréglage Node autonome)…");
const build = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "build"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NITRO_PRESET: process.env.NITRO_PRESET || "node-server" },
  },
);

if (build.status !== 0) {
  console.error("✗ Le build a échoué.");
  process.exit(build.status ?? 1);
}

// Selon la version de Nitro, la sortie serveur se trouve dans « .output »
// (anciennes versions) ou dans « dist » (Nitro 3). On accepte les deux.
const candidates = [".output", "dist"];
const outputName = candidates.find((name) =>
  existsSync(resolve(root, name, "server/index.mjs")),
);

if (!outputName) {
  console.error(
    "✗ Sortie serveur introuvable (ni « .output/server/index.mjs », ni « dist/server/index.mjs »).\n" +
      "  Lancez ce script depuis un poste local (dépôt exporté via GitHub).",
  );
  process.exit(1);
}

const nitroOutput = resolve(root, outputName);

// Dans l'éditeur en ligne, le préréglage est forcé sur Cloudflare : le bundle
// produit n'est pas exécutable par Node et ne convient donc pas à IIS.
if (existsSync(resolve(nitroOutput, "server/wrangler.json"))) {
  console.error(
    "✗ Le build a ciblé l'hébergement Lovable (Cloudflare), pas un serveur Node autonome.\n" +
      "  C'est normal dans l'éditeur en ligne : la variable NITRO_PRESET y est ignorée.\n" +
      "  Exportez le projet vers GitHub, clonez-le sur le poste Windows, puis relancez\n" +
      "  « npm install » et « npm run build:iis » depuis ce poste.",
  );
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(nitroOutput, resolve(outDir, outputName), { recursive: true });

// web.config pointe vers l'entrée réellement produite.
const webConfig = readFileSync(resolve(root, "deploy/iis/web.config"), "utf8").replace(
  ".\\.output\\server\\index.mjs",
  `.\\${outputName}\\server\\index.mjs`,
);
writeFileSync(resolve(outDir, "web.config"), webConfig);

cpSync(resolve(root, "deploy/iis/LISEZ-MOI.md"), resolve(outDir, "LISEZ-MOI.md"));
cpSync(
  resolve(root, "deploy/iis/GUIDE-INSTALLATION-PAS-A-PAS.md"),
  resolve(outDir, "GUIDE-INSTALLATION-PAS-A-PAS.md"),
);
cpSync(
  resolve(root, "deploy/iis/TUTO-WINDOWS-11.md"),
  resolve(outDir, "TUTO-WINDOWS-11.md"),
);
cpSync(resolve(root, "deploy/iis/installer-ird.ps1"), resolve(outDir, "installer-ird.ps1"));
cpSync(resolve(root, "deploy/iis/ird-config.json"), resolve(outDir, "ird-config.json"));

mkdirSync(resolve(outDir, "logs"), { recursive: true });
writeFileSync(resolve(outDir, "logs/.gitkeep"), "");

console.log(`\n✓ Paquet IIS prêt : ${outDir}`);
console.log("  Copiez ce dossier sur le serveur, puis suivez LISEZ-MOI.md.");
