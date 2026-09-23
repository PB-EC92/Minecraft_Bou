import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// Le jeu est livré en UN seul fichier HTML (dist/cubes.html) ouvrable par
// double-clic, hors ligne. Tout (JS, CSS) est inliné ; il n'y a aucun asset
// externe : les textures et les sons sont générés par le code au démarrage.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      input: "index.html",
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
