import { defineConfig, devices } from "@playwright/test";

// Tests de fumée sur le fichier construit (dist/cubes.html) ouvert en file://,
// exactement comme le fera l'enfant par double-clic. WebGL est rendu en
// logiciel (SwiftShader) : les performances mesurées ici ne veulent rien dire,
// seul le fonctionnement compte. Seul Chromium est disponible ici : ce qui est
// propre à Firefox (navigateur du convertible des enfants) se vérifie à la main.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: true,
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "pc", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    // Le convertible des enfants replié en mode tablette, en portrait (fenêtre relevée par le diagnostic
    // de Pierre : 1080 × 1802 à 1×). hasTouch donne « pointer: coarse », comme sur l'appareil.
    {
      name: "tablette",
      use: { browserName: "chromium", viewport: { width: 1080, height: 1802 }, hasTouch: true, deviceScaleFactor: 1 },
    },
    // Le même en paysage : seulement les cas tactiles (titre contenant @tactile).
    {
      name: "tablette-paysage",
      grep: /@tactile/,
      use: { browserName: "chromium", viewport: { width: 1920, height: 1080 }, hasTouch: true, deviceScaleFactor: 1 },
    },
  ],
});
