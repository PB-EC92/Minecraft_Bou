import { defineConfig, devices } from "@playwright/test";

// Tests de fumée sur le fichier construit (dist/cubes.html) ouvert en file://,
// exactement comme le fera l'enfant par double-clic. WebGL est rendu en
// logiciel (SwiftShader) : les performances mesurées ici ne veulent rien dire,
// seul le fonctionnement compte.
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
    {
      name: "tablette",
      use: {
        browserName: "chromium",
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      },
    },
  ],
});
