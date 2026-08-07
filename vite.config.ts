// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Le préréglage de sortie peut être forcé via NITRO_PRESET (ex. "node-server"
// pour un déploiement IIS via `npm run build:iis`). Sans variable, le build
// Lovable conserve son comportement par défaut.
const nitroPreset = process.env["NITRO_PRESET"];

export default defineConfig({
  ...(nitroPreset ? { nitro: { preset: nitroPreset } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

