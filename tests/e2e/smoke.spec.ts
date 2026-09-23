import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dist = resolve("dist/cubes.html");
const url = pathToFileURL(dist).href;

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(url);
  await page.waitForSelector("canvas.game");
  await page.waitForTimeout(1500);
  return errors;
}

function parseInfo(text: string): { fps: number; faces: number; pos: [number, number, number] } {
  const fps = Number(/(\d+) i\/s/.exec(text)?.[1] ?? NaN);
  const faces = Number(/faces (\d+)/.exec(text)?.[1] ?? NaN);
  const m = /pos (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/.exec(text);
  const pos: [number, number, number] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [NaN, NaN, NaN];
  return { fps, faces, pos };
}

test.beforeAll(() => {
  test.skip(!existsSync(dist), "dist/cubes.html absent : lancer `npm run build` d'abord");
});

test("le jeu démarre en file:// sans erreur et rend le monde", async ({ page }, testInfo) => {
  const errors = await openGame(page);
  const info = parseInfo(await page.locator(".info").innerText());
  expect(errors).toEqual([]);
  expect(info.faces).toBeGreaterThan(1000);
  expect(info.fps).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("depart.png") });
});

test("le diagnostic est renseigné", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: "Tests J0" }).click();
  const diag = await page.locator(".diag").innerText();
  expect(diag).toContain("Adresse : file:");
  expect(diag).toContain("WebGL2 : oui");
  expect(diag).toContain("Stockage local : ok");
});

test("le clavier déplace le joueur (position physique des touches)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "clavier : PC uniquement");
  await openGame(page);
  const before = parseInfo(await page.locator(".info").innerText()).pos;
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(400);
  const after = parseInfo(await page.locator(".info").innerText()).pos;
  // Le joueur regarde vers -Z au départ : avancer diminue z.
  expect(after[2]).toBeLessThan(before[2] - 1);
  expect(Math.abs(after[0] - before[0])).toBeLessThan(0.5);
});

test("les touches 1 à 6 changent le bloc sélectionné", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "clavier : PC uniquement");
  await openGame(page);
  await page.keyboard.press("Digit3");
  await expect(page.locator(".slot").nth(2)).toHaveClass(/selected/);
  await expect(page.locator(".info")).toContainText("bloc : pierre");
});

test("l'interface tactile n'apparaît que sur un appareil tactile", async ({ page }, testInfo) => {
  await openGame(page);
  const touchUi = page.locator(".touch");
  if (testInfo.project.name === "tablette") {
    await expect(touchUi).toHaveClass(/enabled/);
    await expect(page.getByRole("button", { name: "Sauter" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("tablette.png") });
  } else {
    await expect(touchUi).not.toHaveClass(/enabled/);
  }
});

test("le panneau voix se charge sans planter", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: "Tests J0" }).click();
  await page.waitForTimeout(2300);
  const result = await page.locator(".panel").innerText();
  // En Chromium headless Linux il n'y a généralement aucune voix : on vérifie seulement le message.
  expect(result).toMatch(/voix française|Synthèse vocale non disponible|Aucune voix/);
});
