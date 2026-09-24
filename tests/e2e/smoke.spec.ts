import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dist = resolve("dist/cubes.html");
const url = pathToFileURL(dist).href;

/** Monde plat de test (celui du J0) : positions et blocs connus, pour des tests stables. */
const FLAT = "#monde=plat&graine=1";

interface Stack {
  id: number;
  count: number;
}

interface DebugState {
  type: string;
  seed: number;
  player: { x: number; y: number; z: number; onGround: boolean; inWater: boolean; headInWater: boolean };
  hour: number;
  night: boolean;
  loading: boolean;
  faces: number;
  triangles: number;
  contextLost: boolean;
  contextLosses: number;
  target: { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null;
  slot: number;
  inventory: (Stack | null)[];
  breakProgress: number;
  level: string;
  voice: boolean;
  sound: string;
}

/** Identifiants de blocs utiles aux tests (src/engine/blocks.ts). */
const B = { air: 0, grass: 1, dirt: 2, stone: 3, planks: 4, sand: 5, log: 6, leaves: 8, flowerRed: 9, snow: 11, cactus: 12 } as const;

declare global {
  interface Window {
    cubesDebug: {
      state(): DebugState;
      setHour(h: number): void;
      look(yawDeg: number, pitchDeg: number): void;
      teleport(x: number, y: number, z: number): void;
      block(x: number, y: number, z: number): number;
      standY(x: number, z: number): number | null;
      samplePixel(fx: number, fy: number): Promise<number[]>;
      loseContext(): void;
      restoreContext(): void;
      give(id: number, n?: number): { ok: boolean };
      clearInventory(): void;
      fillInventory(): void;
      selectSlot(i: number): void;
      setBlock(x: number, y: number, z: number, id: number): boolean;
      breakBlock(x: number, y: number, z: number): void;
    };
  }
}

async function openGame(page: Page, hash = FLAT): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(url + hash);
  await page.waitForSelector("canvas.game");
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.waitForTimeout(500);
  return errors;
}

const state = (page: Page) => page.evaluate(() => window.cubesDebug.state());
const pixel = (page: Page, fx: number, fy: number) => page.evaluate(([x, y]) => window.cubesDebug.samplePixel(x, y), [fx, fy] as const);
const luminance = (p: number[]) => 0.2126 * p[0]! + 0.7152 * p[1]! + 0.0722 * p[2]!;

/** Couleur au centre de l'image en regardant le ciel (à la verticale : l'apparition est à ciel ouvert), puis le sol. */
async function skyAndGround(page: Page): Promise<{ sky: number[]; ground: number[] }> {
  await page.evaluate(() => window.cubesDebug.look(0, 88));
  const sky = await pixel(page, 0.5, 0.5);
  await page.evaluate(() => window.cubesDebug.look(0, -60));
  const ground = await pixel(page, 0.5, 0.5);
  await page.evaluate(() => window.cubesDebug.look(0, 0));
  return { sky, ground };
}

function expectSkyAndGround({ sky, ground }: { sky: number[]; ground: number[] }): void {
  expect(sky[2]!).toBeGreaterThan(sky[0]! + 30); // ciel bleu
  expect(Math.abs(luminance(sky) - luminance(ground)) + Math.abs(sky[2]! - ground[2]!)).toBeGreaterThan(20);
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

/** Bloc visé (il y en a toujours un dans les scénarios qui l'appellent). */
async function aimedBlock(page: Page): Promise<{ x: number; y: number; z: number; id: number }> {
  const t = (await state(page)).target;
  expect(t).not.toBeNull();
  const id = await page.evaluate(([x, y, z]) => window.cubesDebug.block(x, y, z), [t!.x, t!.y, t!.z] as const);
  return { x: t!.x, y: t!.y, z: t!.z, id };
}

const blockAt = (page: Page, p: { x: number; y: number; z: number }) =>
  page.evaluate(([x, y, z]) => window.cubesDebug.block(x, y, z), [p.x, p.y, p.z] as const);

/** Attend qu'un bloc précis soit devenu de l'air (la casse demande un appui maintenu). */
async function waitBroken(page: Page, p: { x: number; y: number; z: number }): Promise<void> {
  await page.waitForFunction(([x, y, z]) => window.cubesDebug.block(x, y, z) === 0, [p.x, p.y, p.z] as const, { timeout: 10_000 });
}

/**
 * Souris capturée, regard vers le sol juste devant soi. On attend la capture
 * elle-même (elle peut arriver tard sous charge), puis on oriente le regard
 * par l'accès de test : le trajet de la souris est vérifié par d'autres cas.
 */
async function lockAndLookDown(page: Page, pitchDeg = -60): Promise<void> {
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 5_000 });
  await page.evaluate((p) => window.cubesDebug.look(0, p), pitchDeg);
  await page.waitForFunction(() => window.cubesDebug.state().target !== null, null, { timeout: 5_000 });
}

/**
 * Clic gauche bref, appui et relâchement dans la même tâche de la page : aucune
 * image (lente sous SwiftShader) ne peut s'intercaler et allonger l'appui.
 */
async function quickLeftClick(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas.game")!;
    canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, buttons: 1, bubbles: true, clientX: 640, clientY: 360 }));
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0, buttons: 0, bubbles: true, clientX: 640, clientY: 360 }));
  });
}

/** Tapotement bref du doigt droit, atomique comme quickLeftClick. */
async function quickTap(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([cx, cy]) => {
      const canvas = document.querySelector("canvas.game")!;
      const touch = new Touch({ identifier: 77, target: canvas, clientX: cx, clientY: cy });
      canvas.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch], changedTouches: [touch] }));
      canvas.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [touch] }));
    },
    [x, y] as const,
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
    /** Garde le doigt immobile jusqu'à ce que until() soit vrai, puis le lève. */
    async hold(x: number, y: number, until: () => Promise<void>) {
      await send("touchStart", x, y);
      await until();
      await send("touchEnd");
      await page.waitForTimeout(200);
    },
  };
}

test.beforeAll(() => {
  test.skip(!existsSync(dist), "dist/cubes.html absent : lancer `npm run build` d'abord");
});

test("le jeu démarre en file:// sans erreur, sur une prairie générée", async ({ page }, testInfo) => {
  const errors = await openGame(page, "");
  const info = await readInfo(page);
  const s = await state(page);
  expect(errors).toEqual([]);
  expect(s.type).toBe("prairie");
  expect(info.faces).toBeGreaterThan(10_000);
  expect(info.fps).toBeGreaterThan(0);
  expect(await page.locator(".info").innerText()).toMatch(/J2$/);
  expect(page.url()).toMatch(/#monde=prairie&graine=\d+$/);
  await page.screenshot({ path: testInfo.outputPath("depart.png") });
});

for (const [type, name] of [
  ["prairie", "prairie"],
  ["ile", "île"],
  ["montagne", "montagne"],
  ["desert", "désert"],
] as const) {
  test(`monde « ${name} » : généré, affiché, apparition au sol`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
    const errors = await openGame(page, `#monde=${type}&graine=4242`);
    const s = await state(page);
    expect(errors).toEqual([]);
    expect(s.type).toBe(type);
    expect(s.faces).toBeGreaterThan(10_000);
    expect(s.player.onGround).toBe(true);
    expect(s.player.inWater).toBe(false);
    expect(await page.locator(".info").innerText()).toContain(`${name} · graine 4242`);
    // Le ciel est bleu, le sol est dessiné et différent du ciel
    expectSkyAndGround(await skyAndGround(page));
    await page.screenshot({ path: testInfo.outputPath(`${type}.png`) });
  });
}

test("le joueur apparaît au sol, pas sur un arbre (constat 3)", async ({ page }) => {
  await openGame(page);
  const info = await readInfo(page);
  expect(info.pos[1]).toBeCloseTo(4, 1);
});

test("le diagnostic est renseigné", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.cubesDebug.give(3, 2));
  await page.getByRole("button", { name: "Tests" }).click();
  const diag = page.locator(".diag");
  // toContainText réessaie : le diagnostic se rafraîchit 4 fois par seconde.
  await expect(diag).toContainText("Version : J2");
  await expect(diag).toContainText("Sac : 1/9 cases, 2 blocs");
  await expect(diag).toContainText("Lecture : debutant, voix active");
  await expect(diag).toContainText("Adresse : file:");
  await expect(diag).toContainText("WebGL2 : oui");
  await expect(diag).toContainText("Stockage local : ok");
  await expect(diag).toContainText(/Calcul par image \(hors attente de l'écran\) : moy\. [\d.]+ ms/);
  await expect(diag).toContainText(/écartés \d+ après capture et \d+ trop grands/);
  // Le profil tablette simulé n'a pas eu de geste : sons en attente ; Chromium fournit Web Audio.
  await expect(diag).toContainText("Sons : en attente d'un geste");
});

test("le panneau crée un nouveau monde du type et de la graine choisis", async ({ page }) => {
  const errors = await openGame(page);
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByLabel("Type de monde").selectOption("ile");
  await page.getByLabel("Graine").fill("321");
  await page.getByRole("button", { name: "Nouveau monde" }).click();
  await page.waitForFunction(() => window.cubesDebug.state().type === "ile" && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await expect(page.locator(".info")).toContainText("île · graine 321");
  expect(page.url()).toMatch(/#monde=ile&graine=321$/);
  expect(errors).toEqual([]);
});

test("la nuit tombe : ciel sombre, monde encore visible, jamais noir", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await openGame(page, "#monde=prairie&graine=4242&heure=12");
  const day = await skyAndGround(page);
  await page.evaluate(() => window.cubesDebug.setHour(0));
  await page.waitForTimeout(300);
  expect((await state(page)).night).toBe(true);
  const night = await skyAndGround(page);
  expect(luminance(night.sky)).toBeLessThan(luminance(day.sky) * 0.4);
  expect(luminance(night.ground)).toBeLessThan(luminance(day.ground));
  expect(luminance(night.ground)).toBeGreaterThan(8); // on voit encore le sol
  await page.screenshot({ path: testInfo.outputPath("nuit.png") });
});

test("sous l'eau : voile bleu, on remonte à la surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await openGame(page, "#monde=ile&graine=4242");
  const spot = await page.evaluate(() => {
    const d = window.cubesDebug;
    for (let x = 64; x < 127; x++) if (d.block(x, 12, 64) === 7) return x; // eau profonde (y = 12)
    return -1;
  });
  expect(spot).toBeGreaterThan(0);
  await page.evaluate((x) => window.cubesDebug.teleport(x + 0.5, 12.2, 64.5), spot);
  await page.waitForTimeout(300);
  expect((await state(page)).player.headInWater).toBe(true);
  await expect(page.locator(".underwater")).toHaveClass(/visible/);
  await page.waitForFunction(() => !window.cubesDebug.state().player.headInWater, null, { timeout: 15_000 });
  await expect(page.locator(".underwater")).not.toHaveClass(/visible/);
});

test("la perte du contexte 3D ne fige pas le jeu (constat 11)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=prairie&graine=4242&heure=12");
  await page.evaluate(() => window.cubesDebug.loseContext());
  await page.waitForFunction(() => window.cubesDebug.state().contextLost, null, { timeout: 5_000 });
  await page.evaluate(() => window.cubesDebug.restoreContext());
  await page.waitForFunction(() => !window.cubesDebug.state().contextLost, null, { timeout: 10_000 });
  await page.waitForTimeout(600);
  const s = await state(page);
  expect(s.contextLosses).toBe(1);
  expect(s.triangles).toBeGreaterThan(1000);
  expectSkyAndGround(await skyAndGround(page));
  expect(errors.filter((e) => !/CONTEXT_LOST|context lost/i.test(e))).toEqual([]);
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

test("les touches 1 à 9 et la molette changent la case choisie", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "clavier : PC uniquement");
  await openGame(page);
  await expect(page.locator(".info")).toContainText("bloc : (case vide)");
  await page.evaluate(() => window.cubesDebug.fillInventory());
  await page.keyboard.press("Digit3");
  await expect(page.locator(".slot").nth(2)).toHaveClass(/selected/);
  await expect(page.locator(".info")).toContainText("bloc : pierre ×20");
  await expect(page.locator(".slot-name")).toHaveText("pierre");
  await expect(page.locator(".slot-name")).toHaveClass(/visible/);
  await expect(page.locator(".slot").nth(2).locator(".count")).toHaveText("20");
  await page.keyboard.press("Digit9");
  await expect(page.locator(".info")).toContainText("bloc : cactus");
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 120); // molette vers le bas : case suivante (retour à la première)
  await expect(page.locator(".slot").nth(0)).toHaveClass(/selected/);
  await page.mouse.wheel(0, -120);
  await expect(page.locator(".slot").nth(8)).toHaveClass(/selected/);
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
  // Une fois la capture posée, les mouvements de la souris font bien tourner le regard.
  await page.waitForTimeout(200);
  await lockedMouseMove(page, 0, 80, 6);
  await expect.poll(async () => (await readInfo(page)).pitch).toBeLessThan(before.pitch - 20);
});

test("souris capturée : garder le clic gauche casse et ramasse, clic droit pose le bloc ramassé", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await lockAndLookDown(page);
  const aimed = await aimedBlock(page);
  expect(aimed.id).toBe(B.grass);
  await page.mouse.down({ button: "left" });
  // Pendant l'appui : l'anneau de progression se remplit (vérifié dans la même évaluation que la progression).
  await page.waitForFunction(
    () => window.cubesDebug.state().breakProgress > 0 && document.querySelector(".break-ring")!.classList.contains("visible"),
    null,
    { timeout: 5_000 },
  );
  await waitBroken(page, aimed);
  await page.mouse.up({ button: "left" });
  await expect(page.locator(".break-ring")).not.toHaveClass(/visible/);
  // Sur une machine très chargée, le relâchement peut arriver après la casse du bloc suivant :
  // on lit le compte réel plutôt que de supposer 1.
  const n = (await state(page)).inventory[0]!.count;
  expect((await state(page)).inventory[0]!.id).toBe(B.grass);
  await expect(page.locator(".message")).toContainText(n === 1 ? "Un bloc d'herbe" : `${n} blocs d'herbe`);
  await expect(page.locator(".slot").nth(0).locator(".count")).toHaveText(String(n));
  await expect(page.locator(".info")).toContainText(`bloc : herbe ×${n}`);
  // Clic droit : un bloc d'herbe est posé dans la case visée (celle d'où vient le rayon), le sac en perd un.
  const t = (await state(page)).target!;
  const cell = { x: t.x + t.nx, y: t.y + t.ny, z: t.z + t.nz };
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => blockAt(page, cell)).toBe(B.grass);
  if (n === 1) {
    expect((await state(page)).inventory[0]).toBeNull();
    await expect(page.locator(".message")).toContainText("Plus de blocs d'herbe");
    await expect(page.locator(".slot").nth(0)).toHaveClass(/empty/);
  } else {
    expect((await state(page)).inventory[0]).toEqual({ id: B.grass, count: n - 1 });
  }
  expect(errors).toEqual([]);
});

test("un clic bref ne casse rien, même une fleur, et conseille d'appuyer longtemps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await lockAndLookDown(page);
  const aimed = await aimedBlock(page);
  await quickLeftClick(page);
  await expect(page.locator(".message")).toContainText("Appuie longtemps");
  await page.waitForTimeout(500);
  expect(await blockAt(page, aimed)).toBe(aimed.id);
  // Une fleur non plus ne se cueille pas sur un clic bref.
  await page.evaluate(([x, y, z]) => window.cubesDebug.setBlock(x, y + 1, z, 9), [aimed.x, aimed.y, aimed.z] as const);
  await page.waitForFunction((y) => window.cubesDebug.state().target?.y === y + 1, aimed.y, { timeout: 5_000 });
  await quickLeftClick(page);
  await page.waitForTimeout(500);
  expect(await blockAt(page, { ...aimed, y: aimed.y + 1 })).toBe(B.flowerRed);
  expect((await state(page)).inventory.every((s) => s === null)).toBe(true);
  expect(errors).toEqual([]);
});

test("case vide : poser explique qu'il faut d'abord ramasser", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await lockAndLookDown(page);
  const faces = (await state(page)).faces;
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".message")).toContainText("case est vide");
  await page.waitForTimeout(300);
  expect((await state(page)).faces).toBe(faces);
  expect(errors).toEqual([]);
});

test("pas de place : on ne pose pas un bloc là où l'on se tient", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => window.cubesDebug.give(3, 5));
  await lockAndLookDown(page, -89); // le bloc sous les pieds : poser viserait la case du joueur
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".message")).toContainText("Pas de place");
  expect((await state(page)).inventory[0]).toEqual({ id: B.stone, count: 5 });
  expect(errors).toEqual([]);
});

test("appui maintenu vers le bas : un seul bloc sous les pieds par appui (pas de puits sans issue)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await lockAndLookDown(page, -89);
  const under = await aimedBlock(page);
  await page.mouse.down({ button: "left" });
  await waitBroken(page, under);
  await page.waitForFunction(() => window.cubesDebug.state().player.onGround, null, { timeout: 5_000 });
  const below = { ...under, y: under.y - 1 };
  await page.waitForTimeout(1500); // bien plus que la durée de casse de la terre (350 ms)
  expect(await blockAt(page, below)).not.toBe(B.air);
  await page.mouse.up({ button: "left" });
  // Nouvel appui : la casse reprend.
  await page.mouse.down({ button: "left" });
  await waitBroken(page, below);
  await page.mouse.up({ button: "left" });
  expect(errors).toEqual([]);
});

test("fleurs : cassée avec son bloc, elle est ramassée aussi ; remplacée par une pose, elle est cueillie", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  const inv = async () => (await state(page)).inventory.filter(Boolean);
  // Bloc d'herbe portant une fleur, cassé : herbe et fleur dans le sac, le message parle du bloc cassé.
  await page.evaluate(() => {
    window.cubesDebug.setBlock(5, 4, 5, 9);
    window.cubesDebug.breakBlock(5, 3, 5);
  });
  expect(await inv()).toEqual(expect.arrayContaining([{ id: B.flowerRed, count: 1 }, { id: B.grass, count: 1 }]));
  await expect(page.locator(".message")).toContainText("Un bloc d'herbe");
  expect(await blockAt(page, { x: 5, y: 4, z: 5 })).toBe(B.air);
  // Pierre posée en visant une fleur : la fleur est cueillie, la pierre prend sa place.
  await page.evaluate(() => window.cubesDebug.clearInventory());
  await page.evaluate(() => window.cubesDebug.give(3, 3));
  await lockAndLookDown(page);
  const aimed = await aimedBlock(page);
  await page.evaluate(([x, y, z]) => window.cubesDebug.setBlock(x, y + 1, z, 9), [aimed.x, aimed.y, aimed.z] as const);
  await page.waitForFunction((y) => window.cubesDebug.state().target?.y === y + 1, aimed.y, { timeout: 5_000 });
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => blockAt(page, { ...aimed, y: aimed.y + 1 })).toBe(B.stone);
  expect(await inv()).toEqual([{ id: B.stone, count: 2 }, { id: B.flowerRed, count: 1 }]);
  await expect(page.locator(".message")).toContainText("Une fleur rouge");
  expect(errors).toEqual([]);
});

test("maximum de 99 blocs par case : le bloc cassé n'est pas ramassé, le jeu le dit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  await page.evaluate(() => window.cubesDebug.give(1, 99));
  await page.evaluate(() => window.cubesDebug.breakBlock(5, 3, 5));
  await expect(page.locator(".message")).toContainText("99, c'est le maximum");
  expect((await state(page)).inventory[0]).toEqual({ id: B.grass, count: 99 });
  expect(errors).toEqual([]);
});

test("panneau Jeu : remplir complète le sac sans rien retirer, vider, couper sons et voix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(3, 50); // pierre : au-dessus du kit (20), ne doit pas baisser
    window.cubesDebug.give(9, 5); // fleur : hors du kit, ne doit pas disparaître
  });
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByRole("button", { name: /Remplir le sac/ }).click();
  const inv = (await state(page)).inventory;
  expect(inv.find((s) => s?.id === B.stone)?.count).toBe(50);
  expect(inv.find((s) => s?.id === B.flowerRed)?.count).toBe(5);
  expect(inv.find((s) => s?.id === B.planks)?.count).toBe(20);
  expect(inv.filter(Boolean)).toHaveLength(9); // 2 + 7 blocs du kit : le dernier n'entre pas (sac plein)
  await page.getByRole("button", { name: "Vider le sac" }).click();
  expect((await state(page)).inventory.filter(Boolean)).toHaveLength(0);
  await page.getByLabel("Sons").uncheck();
  expect((await state(page)).sound).toBe("coupé");
  await page.getByLabel("Lire les messages à voix haute").uncheck();
  expect((await state(page)).voice).toBe(false);
  expect(errors).toEqual([]);
});

test("sac plein : le bloc est cassé, pas ramassé, et le jeu le dit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.cubesDebug.give(id, 3);
  }, [B.dirt, B.stone, B.planks, B.sand, B.log, B.leaves, B.snow, B.cactus, B.flowerRed]);
  await lockAndLookDown(page);
  const aimed = await aimedBlock(page);
  expect(aimed.id).toBe(B.grass);
  await page.mouse.down({ button: "left" });
  await waitBroken(page, aimed);
  await page.mouse.up({ button: "left" });
  await expect(page.locator(".message")).toContainText("sac est plein");
  const inv = (await state(page)).inventory;
  expect(inv.some((s) => s?.id === B.grass)).toBe(false);
  expect(errors).toEqual([]);
});

test("lecteur autonome : message complet au ramassage", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByLabel("Niveau de lecture").selectOption("autonome");
  expect((await state(page)).level).toBe("autonome");
  await expect(page.getByLabel("Lire les messages à voix haute")).not.toBeChecked();
  await page.getByRole("button", { name: "Tests" }).click();
  await lockAndLookDown(page);
  const aimed = await aimedBlock(page);
  await page.mouse.down({ button: "left" });
  await waitBroken(page, aimed);
  await page.mouse.up({ button: "left" });
  await expect(page.locator(".message")).toContainText("Tu as ramassé ton premier bloc d'herbe");
  // Aide d'écran dans la variante autonome.
  await expect(page.locator(".hint")).toContainText("Espace sauter ou nager");
  expect(errors).toEqual([]);
});

test("les sons se débloquent au premier geste", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  await openGame(page);
  // Chromium fournit Web Audio : « absent » serait une régression.
  expect((await state(page)).sound).toBe("en attente d'un geste");
  await page.mouse.click(640, 360);
  await expect.poll(async () => (await state(page)).sound).toBe("actif");
});

test("un nouveau monde vide le sac", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await openGame(page);
  await page.evaluate(() => window.cubesDebug.fillInventory());
  expect((await state(page)).inventory.filter(Boolean)).toHaveLength(9);
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByRole("button", { name: "Nouveau monde" }).click();
  await page.waitForFunction(() => !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  expect((await state(page)).inventory.filter(Boolean)).toHaveLength(0);
});

test("sans capture de la souris : glisser regarde sans casser, appui maintenu casse (constat 2)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  await page.addInitScript(() => {
    delete (Element.prototype as Partial<Element>).requestPointerLock;
  });
  const errors = await openGame(page);
  const before = await readInfo(page);
  await page.mouse.move(640, 250);
  await page.mouse.down();
  await page.mouse.move(640, 650, { steps: 20 });
  await page.waitForTimeout(700); // bouton toujours enfoncé après un glisser : ce n'est pas une casse
  await page.mouse.up();
  const after = await readInfo(page);
  expect(after.pitch).toBeLessThan(before.pitch - 30);
  expect((await state(page)).inventory.every((s) => s === null)).toBe(true);
  // Revenir au centre sans bouton enfoncé (ne tourne pas la vue) : en bas, on serait sur la barre.
  await page.mouse.move(640, 360, { steps: 5 });
  const aimed = await aimedBlock(page);
  await page.mouse.down();
  await waitBroken(page, aimed);
  await page.mouse.up();
  await expect(page.locator(".message")).toContainText("bloc");
  expect((await state(page)).inventory[0]?.id).toBe(aimed.id);
  await expect(page.locator(".hint")).toContainText("Glisse");
  await expect(page.locator(".hint")).toContainText("clic gauche gardé");
  expect(errors).toEqual([]);
});

test("au doigt : glisser regarde, tapoter ne casse pas, doigt maintenu casse, mode Poser puis tapoter pose", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "tablette", "tactile : tablette uniquement");
  const errors = await openGame(page);
  const t = await touchDriver(context, page);
  await t.drag(900, 250, 450); // regarder vers le sol
  const aimed = await aimedBlock(page);
  expect(aimed.id).toBe(B.grass);
  await quickTap(page, 850, 420);
  await expect(page.locator(".message")).toContainText("Appuie longtemps");
  expect(await blockAt(page, aimed)).toBe(B.grass);
  await t.hold(850, 420, () => waitBroken(page, aimed));
  await expect(page.locator(".message")).toContainText("Un bloc d'herbe");
  await page.getByRole("button", { name: "Casser" }).tap();
  await expect(page.locator(".touch-btn").first()).toHaveText("Poser");
  await t.tap(850, 420);
  await expect.poll(() => blockAt(page, aimed)).toBe(B.grass);
  await expect(page.locator(".message")).toContainText("Plus de blocs d'herbe");
  expect(errors).toEqual([]);
});

test("au doigt : passer en mode Casser avec le doigt déjà posé commence la casse", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "tablette", "tactile : tablette uniquement");
  const errors = await openGame(page);
  const t = await touchDriver(context, page);
  await t.drag(900, 250, 450);
  const aimed = await aimedBlock(page);
  await page.getByRole("button", { name: "Casser" }).tap(); // → mode Poser
  await expect(page.locator(".touch-btn").first()).toHaveText("Poser");
  const cdp = await context.newCDPSession(page);
  // Doigt droit réellement posé (mode Poser), puis un second doigt sur le bouton pour revenir en mode Casser.
  // Le second doigt est simulé dans la page : le protocole de Chrome ne sait pas lever un seul doigt sur deux.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 850, y: 420, id: 1 }] });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const btn = document.querySelector(".touch-btn")!;
    const r = btn.getBoundingClientRect();
    const touch = new Touch({ identifier: 2, target: btn, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
    btn.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch], changedTouches: [touch] }));
    btn.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [touch] }));
  });
  await expect(page.locator(".touch-btn").first()).toHaveText("Casser");
  await waitBroken(page, aimed);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(errors).toEqual([]);
});

test("au doigt : toucher une case de la barre la choisit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablette", "tactile : tablette uniquement");
  await openGame(page);
  await page.evaluate(() => window.cubesDebug.fillInventory());
  await page.locator(".slot").nth(4).tap();
  await expect(page.locator(".slot").nth(4)).toHaveClass(/selected/);
  await expect(page.locator(".slot-name")).toHaveText("sable");
  await expect(page.locator(".slot-name")).toHaveClass(/visible/);
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
  await page.getByRole("button", { name: "Tests" }).click();
  await page.waitForTimeout(2300);
  const result = await page.locator(".panel").innerText();
  // En Chromium sans interface sous Linux il n'y a généralement aucune voix.
  expect(result).toMatch(/voix française\(s\) dont \d+ locale\(s\)|Synthèse vocale non disponible/);
});
