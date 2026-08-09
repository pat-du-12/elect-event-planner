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

const nitroOutput = resolve(root, ".output");
if (!existsSync(nitroOutput)) {
  console.error(
    "✗ Dossier .output introuvable.\n" +
      "  Ce script doit être lancé depuis un poste local (dépôt exporté via GitHub),\n" +
      "  et non depuis l'éditeur en ligne où le build cible toujours l'hébergement Lovable.",
  );
  process.exit(1);
}


rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(nitroOutput, resolve(outDir, ".output"), { recursive: true });
cpSync(resolve(root, "deploy/iis/web.config"), resolve(outDir, "web.config"));
cpSync(resolve(root, "deploy/iis/LISEZ-MOI.md"), resolve(outDir, "LISEZ-MOI.md"));
cpSync(
  resolve(root, "deploy/iis/GUIDE-INSTALLATION-PAS-A-PAS.md"),
  resolve(outDir, "GUIDE-INSTALLATION-PAS-A-PAS.md"),
);
mkdirSync(resolve(outDir, "logs"), { recursive: true });
writeFileSync(resolve(outDir, "logs/.gitkeep"), "");

console.log(`\n✓ Paquet IIS prêt : ${outDir}`);
console.log("  Copiez ce dossier sur le serveur, puis suivez LISEZ-MOI.md.");
