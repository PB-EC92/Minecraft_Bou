import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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

interface Info {
  fps: number;
  faces: number;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
}

async function readInfo(page: Page): Promise<Info> {
  await page.waitForTimeout(300); // l'affichage se met à jour 4 fois par seconde
  const text = await page.locator(".info").innerText();
  const num = (re: RegExp) => Number(re.exec(text)?.[1] ?? NaN);
  const m = /pos (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/.exec(text);
  const r = /regard (-?\d+)° (-?\d+)°/.exec(text);
  return {
    fps: num(/(\d+) i\/s/),
    faces: num(/faces (\d+)/),
    pos: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [NaN, NaN, NaN],
    yaw: r ? Number(r[1]) : NaN,
    pitch: r ? Number(r[2]) : NaN,
  };
}

/** Mouvement de souris « capturée » (movementX/Y), comme l'enverrait le navigateur. */
async function lockedMouseMove(page: Page, dx: number, dy: number, times: number): Promise<void> {
  await page.evaluate(
    ([x, y, n]) => {
      for (let i = 0; i < n; i++) window.dispatchEvent(new MouseEvent("mousemove", { movementX: x, movementY: y, bubbles: true }));
    },
    [dx, dy, times] as const,
  );
}

/** Pilote tactile bas niveau (plusieurs événements, glissers compris). */
async function touchDriver(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  return {
    async drag(x: number, y0: number, y1: number) {
      await send("touchStart", x, y0);
      const steps = 12;
      for (let i = 1; i <= steps; i++) await send("touchMove", x, y0 + ((y1 - y0) * i) / steps);
      await send("touchEnd");
      await page.waitForTimeout(200);
    },
    async tap(x: number, y: number) {
      await send("touchStart", x, y);
      await page.waitForTimeout(60);
      await send("touchEnd");
      await page.waitForTimeout(300);
    },
  };
}

test.beforeAll(() => {
  test.skip(!existsSync(dist), "dist/cubes.html absent : lancer `npm run build` d'abord");
});

test("le jeu démarre en file:// sans erreur et rend le monde", async ({ page }, testInfo) => {
  const errors = await openGame(page);
  const info = await readInfo(page);
  expect(errors).toEqual([]);
  expect(info.faces).toBeGreaterThan(1000);
  expect(info.fps).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("depart.png") });
});

test("le joueur apparaît au sol, pas sur un arbre (constat 3)", async ({ page }) => {
  await openGame(page);
  const info = await readInfo(page);
  expect(info.pos[1]).toBeCloseTo(4, 1);
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
  const before = (await readInfo(page)).pos;
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  const after = (await readInfo(page)).pos;
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

test("la caméra ne saute pas au moment de la capture de la souris (constat 1)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  await openGame(page);
  const before = await readInfo(page);
  await page.mouse.click(640, 360);
  const after = await readInfo(page);
  expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
  expect(after.yaw).toBe(before.yaw);
  expect(after.pitch).toBe(before.pitch);
});

test("souris capturée : clic gauche casse, clic droit pose", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  await openGame(page);
  await page.mouse.click(640, 360);
  await page.waitForTimeout(200);
  await lockedMouseMove(page, 0, 80, 6); // regarder vers le sol devant soi
  await page.waitForTimeout(200);
  await page.mouse.down({ button: "left" });
  await page.mouse.up({ button: "left" });
  await expect(page.locator(".message")).toContainText("Cassé : herbe");
  await page.keyboard.press("Digit4");
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".message")).toContainText("Posé : planches");
});

test("sans capture de la souris : glisser regarde, clic bref casse (constat 2)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  await page.addInitScript(() => {
    delete (Element.prototype as Partial<Element>).requestPointerLock;
  });
  await openGame(page);
  const before = await readInfo(page);
  await page.mouse.move(640, 250);
  await page.mouse.down();
  await page.mouse.move(640, 650, { steps: 20 });
  await page.mouse.up();
  const after = await readInfo(page);
  expect(after.pitch).toBeLessThan(before.pitch - 30);
  await page.mouse.click(640, 360);
  await expect(page.locator(".message")).toContainText("Cassé");
  await expect(page.locator(".hint")).toContainText("Glisse en tenant le bouton");
});

test("au doigt : glisser regarde, tapoter casse, bouton Poser puis tapoter pose", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "tablette", "tactile : tablette uniquement");
  await openGame(page);
  const t = await touchDriver(context, page);
  await t.drag(900, 250, 450); // regarder vers le sol
  await t.tap(850, 420);
  await expect(page.locator(".message")).toContainText("Cassé : herbe");
  await page.getByRole("button", { name: "Casser" }).tap();
  await expect(page.locator(".touch-btn").first()).toHaveText("Poser");
  await t.tap(850, 420);
  await expect(page.locator(".message")).toContainText("Posé : herbe");
});

test("l'interface tactile apparaît sur tablette, pas sur PC", async ({ page }, testInfo) => {
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

test("PC à écran tactile : interface tactile masquée jusqu'au premier toucher (constat 5)", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "cas PC uniquement");
  // Un portable tactile Windows a un pointeur principal « souris » (pointer: fine).
  // L'option hasTouch de Playwright le transformerait en tablette (pointer: coarse) :
  // on garde donc le profil PC et on envoie un vrai toucher par le protocole du navigateur.
  await openGame(page);
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(false);
  await expect(page.locator(".touch")).not.toHaveClass(/enabled/);
  const t = await touchDriver(context, page);
  await t.tap(900, 400);
  await expect(page.locator(".touch")).toHaveClass(/enabled/);
});

test("le panneau voix se charge et indique les voix locales", async ({ page }) => {
  await openGame(page);
  await page.getByRole("button", { name: "Tests J0" }).click();
  await page.waitForTimeout(2300);
  const result = await page.locator(".panel").innerText();
  // En Chromium sans interface sous Linux il n'y a généralement aucune voix.
  expect(result).toMatch(/voix française\(s\) dont \d+ locale\(s\)|Synthèse vocale non disponible/);
});
