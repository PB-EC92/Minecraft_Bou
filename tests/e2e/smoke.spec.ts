import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dist = resolve("dist/cubes.html");
const url = pathToFileURL(dist).href;

/** Profils tactiles : le convertible replié, en portrait (« tablette ») et en paysage (« tablette-paysage », cas @tactile seulement). */
const isTouch = (info: TestInfo) => info.project.name.startsWith("tablette");

/** Monde plat de test (celui du J0) : positions et blocs connus, pour des tests stables. */
const FLAT = "#monde=plat&graine=1";

interface Stack {
  id: number;
  count: number;
}

interface DebugState {
  type: string;
  seed: number;
  player: { x: number; y: number; z: number; onGround: boolean; inWater: boolean; headInWater: boolean; climbing: boolean };
  hour: number;
  night: boolean;
  loading: boolean;
  faces: number;
  triangles: number;
  contextLost: boolean;
  contextLosses: number;
  target: { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null;
  renderDistance: number;
  /** Champ de vision vertical de la caméra (degrés). */
  fov: number;
  slot: number;
  inventory: (Stack | null)[];
  breakProgress: number;
  level: string;
  voice: boolean;
  /** Phrases demandées à la voix, les plus récentes à la fin (20 au plus). */
  spoken: string[];
  sound: string;
  paused: boolean;
  home: boolean;
  session: { profile: string; name: string; slot: number } | null;
  view: "1re" | "3e";
  avatarVisible: boolean;
  camera: { x: number; y: number; z: number };
  lastSavedAt: number;
  creatures: { id: number; x: number; y: number; z: number; mode: string; carried: number | null }[];
  companion: { x: number; y: number; z: number } | null;
  mission: { step: number; done: boolean } | null;
  missionId: string | null;
  shelter: { roof: boolean; walls: number; own: boolean; ok: boolean } | null;
  celebration: boolean;
  rewardPending: { block: number; count: number } | null;
  timeBoost: boolean;
  tutorialDone: boolean | null;
  companionText: string | null;
  lamps: number;
  bubbles: number;
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
      placeBlock(): void;
      saveNow(): boolean;
      bubbles(): void;
      spawnCreature(dx: number, dz: number): number | null;
      countBlocks(id: number): number;
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

/** Attend n images du jeu, depuis la page. */
const FRAMES = (n: number) => `for (let i = 0; i < ${n}; i++) await new Promise((r) => requestAnimationFrame(r));`;

/**
 * Clic gauche bref piloté dans la page. frames = 0 : appui et relâchement dans
 * la même tâche, un clic de durée nulle en temps réel (le conseil « Appuie
 * longtemps », qui se juge en temps réel, s'affiche à coup sûr même si les
 * images sont lentes). frames = 1 : l'appui dure une image du jeu, qui le voit
 * donc (une fleur à durée de casse nulle serait cueillie) sans dépasser 50 ms
 * de temps de jeu (dt borné), moins que la plus courte durée de casse.
 */
async function quickLeftClick(page: Page, frames = 0): Promise<void> {
  await page.evaluate(`(async () => {
    const canvas = document.querySelector("canvas.game");
    canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, buttons: 1, bubbles: true, clientX: 640, clientY: 360 }));
    ${FRAMES(frames)}
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0, buttons: 0, bubbles: true, clientX: 640, clientY: 360 }));
  })()`);
}

/** Tapotement du doigt droit de durée nulle en temps réel (même tâche), comme quickLeftClick(page, 0). */
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

test("le jeu démarre en file:// sans erreur : accueil devant une prairie générée, adresse inchangée", async ({ page }, testInfo) => {
  const errors = await openGame(page, "");
  const info = await readInfo(page);
  const s = await state(page);
  expect(errors).toEqual([]);
  expect(s.type).toBe("prairie");
  expect(s.home).toBe(true);
  expect(s.paused).toBe(true);
  await expect(page.locator(".home h1")).toContainText("Réglages de l'adulte");
  // Le monde se construit derrière l'accueil.
  await expect.poll(async () => (await state(page)).faces, { timeout: 20_000 }).toBeGreaterThan(10_000);
  expect(info.fps).toBeGreaterThan(0);
  expect(await page.locator(".info").innerText()).toMatch(/J6$/);
  // Sans #monde=… dans l'adresse : un rechargement doit ramener à l'accueil.
  expect(page.url()).not.toContain("#");
  await page.screenshot({ path: testInfo.outputPath("depart.png") });
});

test("mode adresse (#monde=…) : pas d'accueil, partie sans sauvegarde", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  const s = await state(page);
  expect(s.home).toBe(false);
  expect(s.session).toBeNull();
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(false);
  expect(page.url()).toMatch(/#monde=plat&graine=1$/);
  expect(errors).toEqual([]);
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
  // Avant tout geste, Web Audio attend (Chromium le fournit : « absent » serait une régression).
  expect((await state(page)).sound).toBe("en attente d'un geste");
  await page.getByRole("button", { name: "Tests" }).click();
  const diag = page.locator(".diag");
  // toContainText réessaie : le diagnostic se rafraîchit 4 fois par seconde.
  await expect(diag).toContainText("Version : J6");
  await expect(diag).toContainText("Sac : 1/9 cases, 2 blocs");
  await expect(diag).toContainText("Lecture : debutant, voix active");
  await expect(diag).toContainText("Adresse : file:");
  await expect(diag).toContainText("WebGL2 : oui");
  await expect(diag).toContainText("Stockage local : ok");
  await expect(diag).toContainText(/Calcul par image \(hors attente de l'écran\) : moy\. [\d.]+ ms/);
  await expect(diag).toContainText(/écartés \d+ après capture et \d+ trop grands/);
  // Le clic sur « Tests » est un geste : les sons sont débloqués.
  await expect(diag).toContainText("Sons : actif");
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
  await expect(page.locator(".info")).toContainText("bloc : clôture");
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 120); // molette vers le bas : case suivante (retour à la première)
  await expect(page.locator(".slot").nth(0)).toHaveClass(/selected/);
  await page.mouse.wheel(0, -120);
  await expect(page.locator(".slot").nth(8)).toHaveClass(/selected/);
  // Pavé tactile : une rafale de petits défilements étalée sur 240 ms (4 px toutes les 16 ms, 60 px en tout)
  // avance d'une seule case : c'est le cumul qui compte, pas le nombre d'événements.
  const slotNow = async () => (await state(page)).slot;
  await page.evaluate(async () => {
    const canvas = document.querySelector("canvas.game")!;
    for (let i = 0; i < 15; i++) {
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 4, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 16));
    }
  });
  expect(await slotNow()).toBe(0);
  await page.waitForTimeout(150);
  // Deux crans francs très rapprochés (inertie) : une seule case aussi.
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas.game")!;
    for (let i = 0; i < 2; i++) canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
  });
  expect(await slotNow()).toBe(1);
  // La molette marche aussi le curseur posé sur la barre.
  const bar = await page.locator(".hotbar").boundingBox();
  await page.mouse.move(bar!.x + bar!.width / 2, bar!.y + bar!.height / 2);
  await page.waitForTimeout(150);
  await page.mouse.wheel(0, 120);
  await expect.poll(slotNow).toBe(2);
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
  await quickLeftClick(page, 1); // l'appui est vu par une image : une fleur à durée nulle serait cueillie
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

test("appui maintenu en diagonale : un seul bloc plus bas que les pieds par appui", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await lockAndLookDown(page, -72); // le sol juste devant les pieds
  const first = await aimedBlock(page);
  await page.mouse.down({ button: "left" });
  await waitBroken(page, first);
  await page.waitForTimeout(2000); // bien plus que les durées de casse de la terre
  await page.mouse.up({ button: "left" });
  // Rien sous la surface n'a été creusé en continu, dans aucune colonne voisine.
  const dug = await page.evaluate(() => {
    const d = window.cubesDebug;
    let n = 0;
    for (let x = 12; x < 21; x++) for (let z = 14; z < 24; z++) for (let y = 1; y < 3; y++) if (d.block(x, y, z) === 0) n++;
    return n;
  });
  expect(dug).toBe(0);
  expect(errors).toEqual([]);
});

test("escalade de secours : au fond d'un puits, sauter en avançant fait remonter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "clavier : PC uniquement");
  const errors = await openGame(page);
  // Puits d'une case, 3 blocs de profond, juste devant le point d'apparition (surface à y = 4).
  await page.evaluate(() => {
    const d = window.cubesDebug;
    for (let y = 1; y <= 3; y++) d.setBlock(16, y, 22, 0);
    d.teleport(16.5, 1.01, 22.5);
  });
  await page.waitForFunction(() => window.cubesDebug.state().player.onGround && window.cubesDebug.state().player.y < 1.1, null, { timeout: 5_000 });
  await page.keyboard.down("KeyW");
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.cubesDebug.state().player.y >= 3.99 && window.cubesDebug.state().player.onGround, null, { timeout: 15_000 });
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyW");
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

test("voix : le compte est lu au premier bloc et aux paliers de 5, pas à chaque ramassage", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  const spoken = async () => (await state(page)).spoken.map((s) => s.replaceAll("\u00a0", " "));
  const breakStone = (x: number) =>
    page.evaluate((x) => {
      window.cubesDebug.setBlock(x, 3, 5, 3);
      window.cubesDebug.breakBlock(x, 3, 5);
    }, x);
  await breakStone(4);
  await expect.poll(spoken).toContain("Une pierre !");
  // 2 à 4 : écran seul (le compte s'affiche, la voix se tait).
  for (const x of [5, 6, 7]) {
    await breakStone(x);
    await expect(page.locator(".message")).toContainText(`${x - 3} pierres`);
    await page.waitForTimeout(700);
  }
  expect(await spoken()).toEqual(["Une pierre !"]);
  await breakStone(8);
  await expect.poll(spoken).toEqual(["Une pierre !", "Cinq pierres !"]);
  // Palier suivi d'un ramassage avant la lecture (appui maintenu) : la voix dit le compte à jour.
  await page.evaluate(() => window.cubesDebug.give(3, 4)); // 9 pierres
  await breakStone(9);
  await breakStone(10);
  await expect.poll(spoken).toEqual(["Une pierre !", "Cinq pierres !", "Onze pierres !"]);
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

test("panneau Jeu : compléter le sac sans rien retirer, vider, couper sons et voix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(3, 50); // pierre : au-dessus du kit (20), ne doit pas baisser
    window.cubesDebug.give(9, 5); // fleur : hors du kit, ne doit pas disparaître
  });
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByRole("button", { name: /Compléter le sac/ }).click();
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
  await expect(page.locator(".hint")).toContainText("sauter ou nager");
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
  await page.mouse.up(); // relâché dès la fin du glisser : c'était un regard, rien n'est cassé
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
  // Viser en glissant puis tenir sans lâcher : le bloc visé finit par casser.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(700, 360, { steps: 6 });
  const aimed2 = await aimedBlock(page);
  await waitBroken(page, aimed2);
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test("au doigt : glisser regarde, tapoter ne casse pas, doigt maintenu casse, mode Poser puis tapoter pose @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
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
  await expect(page.locator(".hint")).toContainText("touche Casser");
  await page.getByRole("button", { name: "Casser" }).tap();
  await expect(page.locator(".touch-btn").first()).toHaveText("Poser");
  await expect(page.locator(".hint")).toContainText("tape");
  await quickTap(page, 850, 420); // tapotement bref en temps réel, même si les images sont lentes
  await expect.poll(() => blockAt(page, aimed)).toBe(B.grass);
  await expect(page.locator(".message")).toContainText("Plus de blocs d'herbe");
  expect(errors).toEqual([]);
});

test("au doigt : viser en glissant puis garder le doigt immobile casse le bloc visé @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 900, y, id: 1 }] });
  await touch("touchStart", 250);
  for (let i = 1; i <= 12; i++) await touch("touchMove", 250 + (200 * i) / 12); // regard vers le sol
  const aimed = await aimedBlock(page);
  expect(aimed.id).toBe(B.grass);
  await waitBroken(page, aimed); // doigt toujours posé, immobile
  await touch("touchEnd");
  expect((await state(page)).inventory[0]).toEqual({ id: B.grass, count: 1 });
  expect(errors).toEqual([]);
});

test("au doigt : passer en mode Casser avec le doigt déjà posé commence la casse @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
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

test("au doigt : toucher une case de la barre la choisit @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  await openGame(page);
  await page.evaluate(() => window.cubesDebug.fillInventory());
  await page.locator(".slot").nth(4).tap();
  await expect(page.locator(".slot").nth(4)).toHaveClass(/selected/);
  await expect(page.locator(".slot-name")).toHaveText("sable");
  await expect(page.locator(".slot-name")).toHaveClass(/visible/);
});

test("l'interface tactile apparaît sur tablette, pas sur PC @tactile", async ({ page }, testInfo) => {
  await openGame(page);
  const touchUi = page.locator(".touch");
  if (isTouch(testInfo)) {
    await expect(touchUi).toHaveClass(/enabled/);
    await expect(page.getByRole("button", { name: "Sauter" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("tablette.png") });
  } else {
    await expect(touchUi).not.toHaveClass(/enabled/);
  }
});

/** Centre et rayon du rond (joystick fixe) à l'écran. */
async function joystickGeometry(page: Page): Promise<{ x: number; y: number; r: number }> {
  return page.locator(".joystick").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  });
}

const horizontalMove = (a: DebugState, b: DebugState) => Math.hypot(b.player.x - a.player.x, b.player.z - a.player.z);

test("au doigt : seul le rond fait marcher ; un toucher ailleurs, même au-dessus du rond, regarde (retour J2) @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const j = await joystickGeometry(page);
  expect(j.r).toBeGreaterThan(50);
  // Sur le rond, doigt vers le haut : on avance.
  const start = await state(page);
  await touch("touchStart", j.x, j.y);
  await touch("touchMove", j.x, j.y - j.r);
  await expect.poll(async () => horizontalMove(start, await state(page)), { timeout: 5_000 }).toBeGreaterThan(0.3);
  await touch("touchEnd");
  await page.waitForTimeout(300);
  // Bien au-dessus du rond, dans ce qui était la « moitié gauche » avant le J3 : glisser regarde, sans marcher.
  const before = await state(page);
  const look0 = await readInfo(page);
  const y = j.y - 4 * j.r;
  await touch("touchStart", j.x, y);
  for (let i = 1; i <= 10; i++) await touch("touchMove", j.x + 20 * i, y);
  await touch("touchEnd");
  const look1 = await readInfo(page);
  expect(look1.yaw).not.toBe(look0.yaw);
  expect(horizontalMove(before, await state(page))).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});

test("au doigt : un nouveau doigt reprend le regard (doigt d'un autre enfant, paume posée) @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const cdp = await context.newCDPSession(page);
  const vp = page.viewportSize()!;
  const p1 = { x: Math.round(vp.width * 0.8), y: 300, id: 1 }; // contact immobile qui prend le regard
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p1] });
  await page.waitForTimeout(100);
  const x2 = Math.round(vp.width * 0.6);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p1, { x: x2, y: 500, id: 2 }] });
  const look0 = await readInfo(page);
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p1, { x: x2 - 20 * i, y: 500, id: 2 }] });
  }
  const look1 = await readInfo(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(look1.yaw).not.toBe(look0.yaw);
  expect(errors).toEqual([]);
});

test("au doigt : quand le doigt qui a repris le rond se lève, le pouce resté posé fait de nouveau marcher @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const cdp = await context.newCDPSession(page);
  const j = await joystickGeometry(page);
  const a = { x: j.x, y: j.y - j.r, id: 1 }; // pouce qui pousse vers l'avant
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a, { x: j.x, y: j.y, id: 2 }] }); // tapotement au centre
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    // Lever le seul doigt 2 (le protocole de Chrome ne sait pas lever un doigt sur deux) : dans la page.
    const canvas = document.querySelector("canvas.game")!;
    const r = document.querySelector(".joystick")!.getBoundingClientRect();
    const t1 = new Touch({ identifier: 1, target: canvas, clientX: r.left + r.width / 2, clientY: r.top });
    const t2 = new Touch({ identifier: 2, target: canvas, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    canvas.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [t1], changedTouches: [t2] }));
  });
  const start = await state(page);
  await expect.poll(async () => horizontalMove(start, await state(page)), { timeout: 5_000 }).toBeGreaterThan(0.3);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(errors).toEqual([]);
});

test("au doigt : si le jeu perd le focus, le personnage s'arrête même sans doigt levé @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const cdp = await context.newCDPSession(page);
  const j = await joystickGeometry(page);
  const start = await state(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: j.x, y: j.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: j.x, y: j.y - j.r, id: 1 }] });
  await expect.poll(async () => horizontalMove(start, await state(page)), { timeout: 5_000 }).toBeGreaterThan(0.3);
  // Geste de Windows depuis un bord, autre appli : le doigt levé pendant ce temps ne parviendrait jamais au jeu.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(300);
  const a = await state(page);
  await page.waitForTimeout(600);
  expect(horizontalMove(a, await state(page))).toBeLessThan(0.05);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(errors).toEqual([]);
});

test("au doigt : toucher la marge ou l'espace entre deux cases choisit la case la plus proche @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const bar = (await page.locator(".hotbar").boundingBox())!;
  const s2 = (await page.locator(".slot").nth(2).boundingBox())!;
  const s4 = (await page.locator(".slot").nth(4).boundingBox())!;
  const s5 = (await page.locator(".slot").nth(5).boundingBox())!;
  await page.touchscreen.tap(bar.x + 3, bar.y + bar.height / 2); // marge de gauche
  await expect(page.locator(".slot").nth(0)).toHaveClass(/selected/);
  const gap = s4.x + s4.width + (s5.x - (s4.x + s4.width)) * 0.75; // entre 5 et 6, plus près de 6
  await page.touchscreen.tap(gap, s4.y + s4.height / 2);
  await expect(page.locator(".slot").nth(5)).toHaveClass(/selected/);
  await page.touchscreen.tap(s2.x + s2.width / 2, bar.y + bar.height - 2); // marge du bas
  await expect(page.locator(".slot").nth(2)).toHaveClass(/selected/);
  expect(errors).toEqual([]);
});

test("plein écran à la portée de l'enfant : un bouton au doigt, masqué une fois en plein écran @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  const btn = page.locator(".fullscreen-btn");
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute("aria-label", "Plein écran");
  await btn.tap();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await expect(btn).toBeHidden();
  expect(errors).toEqual([]);
});

test("champ de vision élargi en portrait, inchangé en paysage ; distance de rendu 96 par défaut @tactile", async ({ page }) => {
  const errors = await openGame(page);
  const st = await state(page);
  expect(st.renderDistance).toBe(96);
  const vp = page.viewportSize()!;
  const aspect = vp.width / vp.height;
  const horizontal = (2 * Math.atan(Math.tan((st.fov * Math.PI) / 360) * aspect) * 180) / Math.PI;
  if (aspect < 1) {
    expect(st.fov).toBeGreaterThan(80);
    expect(horizontal).toBeGreaterThan(59.9);
  } else {
    expect(st.fov).toBe(70);
  }
  expect(errors).toEqual([]);
});

test("distance de rendu : le choix de l'adulte est retenu (adresse et stockage local)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  expect(page.url()).not.toContain("distance=");
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByLabel("Distance de rendu").selectOption("128");
  expect((await state(page)).renderDistance).toBe(128);
  await expect.poll(() => page.url()).toContain("distance=128");
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  expect((await state(page)).renderDistance).toBe(128);
  // Nouvelle ouverture, sans distance dans l'adresse : le choix vient du stockage local.
  await page.goto("about:blank");
  await openGame(page);
  expect((await state(page)).renderDistance).toBe(128);
  expect(errors).toEqual([]);
});

test("pas de menu contextuel du navigateur sur le jeu, sauf dans les champs du panneau", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  const prevented = (sel: string) =>
    page.evaluate((sel) => {
      const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      document.querySelector(sel)!.dispatchEvent(ev);
      return ev.defaultPrevented;
    }, sel);
  expect(await prevented("canvas.game")).toBe(true);
  expect(await prevented(".hotbar")).toBe(true);
  expect(await prevented(".panel-toggle")).toBe(true);
  expect(await prevented(".panel input")).toBe(false);
  // Écran d'erreur : l'adulte doit pouvoir copier le texte au doigt (appui long).
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.className = "fatal";
    d.innerHTML = "<pre>erreur</pre>";
    document.body.appendChild(d);
  });
  expect(await prevented(".fatal pre")).toBe(false);
  expect(errors).toEqual([]);
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

// ---------- J4 : accueil, profils, sauvegarde, mode parent, troisième personne ----------

/** Toucher sur tablette, clic sur PC. */
async function press(_page: Page, locator: ReturnType<Page["locator"]>, info: TestInfo): Promise<void> {
  if (isTouch(info)) await locator.tap();
  else await locator.click();
}

/** Premier lancement complet : l'adulte règle les prénoms, Léa choisit l'avatar 2 et crée une île dans l'emplacement 1. */
async function firstLaunch(page: Page, info: TestInfo): Promise<void> {
  await page.getByLabel("Prénom du joueur 1").fill("Léa");
  await page.getByLabel("Prénom du joueur 2").fill("Tom");
  await press(page, page.getByRole("button", { name: "C'est parti !" }), info);
  await expect(page.locator(".home h1")).toHaveText("Qui joue ?");
  await expect(page.locator(".profile-card")).toHaveText(["Léa", "Tom"]);
  await press(page, page.locator('.profile-card[data-profile="p1"]'), info);
  await expect(page.locator(".home h1")).toHaveText("Choisis ton personnage !");
  await press(page, page.locator('.avatar-card[data-avatar="2"]'), info);
  await expect(page.locator(".slot-card")).toHaveCount(3);
  await press(page, page.locator('.slot-card[data-slot="0"]'), info);
  await press(page, page.locator('.type-card[data-type="ile"]'), info);
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
}

test("premier lancement : prénoms par l'adulte, personnage et nouveau monde choisis par l'enfant @tactile", async ({ page }, testInfo) => {
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  const s = await state(page);
  expect(s.session).toEqual({ profile: "p1", name: "Léa", slot: 0 });
  expect(s.type).toBe("ile");
  expect(s.paused).toBe(false);
  expect(s.level).toBe("debutant");
  expect(s.inventory.every((c) => c === null)).toBe(true);
  // L'emplacement est aussitôt occupé.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0") ?? "null"));
  expect(stored?.type).toBe("ile");
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:profils") ?? "null"));
  expect(profiles.profiles[0]).toMatchObject({ name: "Léa", level: "debutant", avatar: 2 });
  expect(profiles.profiles[1]).toMatchObject({ name: "Tom", level: "autonome", avatar: null });
  expect(page.url()).not.toContain("#");
  expect(errors).toEqual([]);
});

test("le monde est retrouvé après rechargement : blocs posés, sac, position", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  const s0 = await state(page);
  const px = Math.floor(s0.player.x) + 2;
  const pz = Math.floor(s0.player.z);
  const before = await page.evaluate(
    ([x, z]) => {
      const d = window.cubesDebug;
      const y = d.standY(x, z)!;
      d.setBlock(x, y, z, 4); // planches posées
      d.setBlock(x, y - 1, z, 0); // un bloc creusé dessous
      d.give(3, 7);
      d.give(6, 2);
      return { y };
    },
    [px, pz] as const,
  );
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(true);
  const saved = await state(page);
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  expect((await state(page)).home).toBe(true);
  await page.locator('.profile-card[data-profile="p1"]').click();
  const card = page.locator('.slot-card[data-slot="0"]');
  await expect(card).toContainText("Île");
  await expect(card).toContainText("aujourd'hui");
  await card.click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  const s = await state(page);
  expect(s.type).toBe("ile");
  expect(s.inventory.filter(Boolean)).toEqual([
    { id: 3, count: 7 },
    { id: 6, count: 2 },
  ]);
  expect(await blockAt(page, { x: px, y: before.y, z: pz })).toBe(4);
  expect(await blockAt(page, { x: px, y: before.y - 1, z: pz })).toBe(0);
  expect(Math.abs(s.player.x - saved.player.x)).toBeLessThan(0.01);
  expect(Math.abs(s.player.z - saved.player.z)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test("bouton accueil : la partie est enregistrée et l'on revient à « Qui joue ? » @tactile", async ({ page }, testInfo) => {
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  await page.evaluate(() => window.cubesDebug.give(5, 3));
  await press(page, page.locator(".home-btn"), testInfo);
  await expect(page.locator(".home h1")).toHaveText("Qui joue ?");
  const s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.session).toBeNull();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0") ?? "null"));
  expect(stored.inventory.slots.filter(Boolean)).toEqual([[5, 3]]);
  expect(errors).toEqual([]);
});

test("mode parent : appui long de 3 s ; effacer un monde, exporter puis importer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  await page.locator(".home-btn").click();
  const gear = page.locator(".parent-gear");
  const box = (await gear.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Appui court : rien.
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await expect(page.locator(".home h1")).toHaveText("Qui joue ?");
  // Appui long.
  await page.mouse.down();
  await expect(page.locator(".home h1")).toHaveText("Mode parent", { timeout: 5_000 });
  await page.mouse.up();
  await expect(page.locator(".parent-note")).toContainText("cubes.html");
  // Export.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter (fichier)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^cubes-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
  const file = testInfo.outputPath("export.json");
  await download.saveAs(file);
  const exported = JSON.parse(readFileSync(file, "utf8"));
  expect(Object.keys(exported.worlds)).toEqual(["cubes:monde:p1:0"]);
  // Effacer le monde 1 de Léa (confirmation acceptée).
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /^1\. île .* effacer$/ }).first().click();
  expect(await page.evaluate(() => localStorage.getItem("cubes:monde:p1:0"))).toBeNull();
  // Import : le monde revient.
  page.once("dialog", (d) => void d.accept());
  await page.getByLabel("Importer une sauvegarde").setInputFiles(file);
  await expect(page.locator(".parent-status")).toHaveText("Sauvegarde importée.");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0") ?? "null")?.type)).toBe("ile");
  // Un fichier qui n'est pas une sauvegarde est refusé sans rien effacer.
  const bad = testInfo.outputPath("mauvais.json");
  writeFileSync(bad, JSON.stringify({ app: "autre" }));
  page.once("dialog", (d) => void d.accept());
  await page.getByLabel("Importer une sauvegarde").setInputFiles(bad);
  await expect(page.locator(".parent-status")).toContainText("pas une sauvegarde de Cubes");
  expect(await page.evaluate(() => localStorage.getItem("cubes:monde:p1:0"))).not.toBeNull();
  expect(errors).toEqual([]);
});

test("troisième personne : touche V ou bouton œil, le personnage se voit, la caméra ne traverse pas un mur @tactile", async ({ page }, testInfo) => {
  const errors = await openGame(page);
  const eyeOf = (s: DebugState) => ({ x: s.player.x, y: s.player.y + 1.62, z: s.player.z });
  await page.evaluate(() => window.cubesDebug.look(0, 0)); // regard vers -Z : caméra en arrière, vers +Z
  await press(page, page.locator(".view-btn"), testInfo);
  await expect.poll(async () => (await state(page)).view).toBe("3e");
  await expect.poll(async () => (await state(page)).avatarVisible).toBe(true);
  const s = await state(page);
  const e = eyeOf(s);
  expect(Math.hypot(s.camera.x - e.x, s.camera.y - e.y, s.camera.z - e.z)).toBeGreaterThan(3);
  expect(s.camera.z).toBeGreaterThan(e.z);
  // Mur juste derrière le personnage : la caméra reste devant lui.
  const wz = Math.floor(e.z) + 2;
  await page.evaluate(
    ([x0, y0, z]) => {
      for (let x = x0 - 3; x <= x0 + 3; x++) for (let y = y0; y < y0 + 5; y++) window.cubesDebug.setBlock(x, y, z, 3);
    },
    [Math.floor(e.x), Math.floor(s.player.y), wz] as const,
  );
  await expect.poll(async () => (await state(page)).camera.z).toBeLessThan(wz);
  await page.screenshot({ path: testInfo.outputPath("troisieme-personne.png") });
  await press(page, page.locator(".view-btn"), testInfo);
  await expect.poll(async () => (await state(page)).view).toBe("1re");
  await expect.poll(async () => (await state(page)).avatarVisible).toBe(false);
  expect(errors).toEqual([]);
});

test("pendant la partie d'un enfant, « Nouveau monde » du panneau Tests n'écrase pas son monde", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  const seed = (await state(page)).seed;
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByRole("button", { name: "Nouveau monde" }).click();
  await expect(page.locator(".message")).toContainText("seulement hors d'une partie");
  expect((await state(page)).seed).toBe(seed);
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0") ?? "null")?.seed)).toBe(seed);
  expect(errors).toEqual([]);
});

test("le même monde ouvert dans deux onglets : l'onglet resté en arrière n'écrase pas le travail de l'autre", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  // Second onglet sur le même monde.
  const b = await context.newPage();
  await b.goto(url);
  await b.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await b.locator('.profile-card[data-profile="p1"]').click();
  await b.locator('.slot-card[data-slot="0"]').click();
  await b.waitForFunction(() => !window.cubesDebug.state().home, null, { timeout: 45_000 });
  // L'onglet B joue et enregistre ; l'onglet A, resté en arrière, revient à l'accueil sans rien écrire.
  await b.evaluate(() => {
    window.cubesDebug.give(4, 42);
    window.cubesDebug.saveNow();
  });
  await expect.poll(async () => (await state(page)).home).toBe(true);
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(false);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0") ?? "null"));
  expect(stored.inventory.slots.filter(Boolean)).toEqual([[4, 42]]);
  expect(errors).toEqual([]);
});

// ---------- J5 : pierre brillante, clôture, Grignotes, bulles, lampe, compagnon, mission ----------

const invCount = (s: DebugState, id: number) => s.inventory.find((c) => c?.id === id)?.count ?? 0;
const B5 = { lamp: 13, fence: 14, glow: 15 } as const;

test("casser une pierre brillante donne une lampe ; un tronc donne aussi une clôture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.setBlock(5, 3, 5, 15);
    window.cubesDebug.breakBlock(5, 3, 5);
  });
  let s = await state(page);
  expect(invCount(s, B5.lamp)).toBe(1);
  expect(invCount(s, B5.glow)).toBe(0);
  await expect(page.locator(".message")).toContainText("Une lampe");
  await page.evaluate(() => {
    window.cubesDebug.setBlock(6, 3, 5, 6);
    window.cubesDebug.breakBlock(6, 3, 5);
  });
  s = await state(page);
  expect(invCount(s, B.log)).toBe(1);
  expect(invCount(s, B5.fence)).toBe(1);
  expect(errors).toEqual([]);
});

test("Grignotes : la nuit, au contact, une Grignote chipe un bloc ; une bulle le fait rendre", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=plat&graine=1&heure=23&creatures=1");
  await page.evaluate(() => window.cubesDebug.give(3, 5));
  const id = await page.evaluate(() => window.cubesDebug.spawnCreature(0, -3));
  expect(id).not.toBeNull();
  await expect.poll(async () => invCount(await state(page), 3), { timeout: 15_000 }).toBe(4);
  await expect(page.locator(".message")).toContainText("Une Grignote a pris une pierre");
  // Viser la voleuse et lancer des bulles.
  const s = await state(page);
  const thief = s.creatures.find((c) => c.carried === 3)!;
  expect(thief).toBeTruthy();
  const yaw = (Math.atan2(-(thief.x - s.player.x), -(thief.z - s.player.z)) * 180) / Math.PI;
  await page.evaluate((y) => {
    window.cubesDebug.look(y, 0);
    window.cubesDebug.bubbles();
  }, yaw);
  await expect.poll(async () => invCount(await state(page), 3)).toBe(5);
  await expect(page.locator(".message")).toContainText("Elle te rend une pierre");
  expect((await state(page)).bubbles).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Grignotes : une lampe posée à côté les tient à distance, rien n'est chipé", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=plat&graine=1&heure=23&creatures=1");
  const s0 = await state(page);
  await page.evaluate(
    ([x, y, z]) => {
      window.cubesDebug.give(3, 5);
      window.cubesDebug.setBlock(x + 1, y, z, 13);
    },
    [Math.floor(s0.player.x), Math.floor(s0.player.y), Math.floor(s0.player.z)] as const,
  );
  await expect.poll(async () => (await state(page)).lamps).toBe(1);
  await page.evaluate(() => window.cubesDebug.spawnCreature(0, -9));
  await page.waitForTimeout(6000);
  const s = await state(page);
  expect(invCount(s, 3)).toBe(5);
  for (const c of s.creatures) expect(Math.hypot(c.x - (Math.floor(s0.player.x) + 1.5), c.z - (Math.floor(s0.player.z) + 0.5))).toBeGreaterThan(4.5);
  expect(errors).toEqual([]);
});

test("compagnon Pixel et mission 1 : il suit, lit la consigne, la mission avance @tactile", async ({ page }, testInfo) => {
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1");
  await expect.poll(async () => (await state(page)).companion !== null).toBe(true);
  await expect.poll(async () => (await state(page)).companionText, { timeout: 10_000 }).toContain("troncs");
  await expect(page.locator(".companion-progress")).toHaveText("0 / 6");
  await page.evaluate(() => window.cubesDebug.give(6, 6));
  await expect.poll(async () => (await state(page)).mission?.step).toBe(1);
  await expect.poll(async () => (await state(page)).companionText, { timeout: 10_000 }).toContain("pierres");
  // Il reste près de l'enfant quand celui-ci se téléporte loin.
  await page.evaluate(() => window.cubesDebug.teleport(6.5, 4, 26.5));
  await expect.poll(async () => {
    const s = await state(page);
    return s.companion ? Math.hypot(s.companion.x - s.player.x, s.companion.z - s.player.z) : 99;
  }).toBeLessThan(4);
  await page.screenshot({ path: testInfo.outputPath("compagnon.png") });
  expect(errors).toEqual([]);
});

test("partie d'un enfant : le tutoriel est enregistré avec le monde et reprend où il en était", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  let s = await state(page);
  expect(s.missionId).toBe("tuto");
  expect(s.mission).toEqual({ step: 0, done: false });
  expect(s.tutorialDone).toBe(false);
  // Marcher (touche Z = KeyW en AZERTY) : l'étape « marcher » est validée.
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 15_000 }).toBe(1);
  await page.keyboard.up("KeyW");
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home, null, { timeout: 45_000 });
  s = await state(page);
  expect(s.missionId).toBe("tuto");
  expect(s.mission).toEqual({ step: 1, done: false });
  await expect.poll(async () => (await state(page)).companionText, { timeout: 10_000 }).toContain("Casse un bloc");
  expect(errors).toEqual([]);
});

test("monde enregistré au J4 (générateur 1) : les pierres brillantes sont ajoutées, la mission peut finir", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1 },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
      version: 1, gen: 1, type: "prairie", seed: 1234, edits: "",
      player: { x: 64.5, y: 30, z: 64.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.1, savedAt: Date.now(),
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home, null, { timeout: 45_000 });
  expect(await page.evaluate(() => window.cubesDebug.countBlocks(15))).toBeGreaterThanOrEqual(5);
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0")!));
  expect(saved.gen).toBe(1);
  expect(saved.edits.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("au doigt : garder le doigt sur le bandeau de Pixel ne casse rien et ne tourne pas la vue @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1");
  await expect(page.locator(".companion")).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => window.cubesDebug.look(0, -60));
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  const aimed = await aimedBlock(page);
  const before = await readInfo(page);
  const box = (await page.locator(".companion-text").boundingBox())!;
  await page.touchscreen.tap(box.x + 5, box.y + 5); // un toucher bref ne suffit pas à vérifier la tenue : CDP ci-dessous
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 10, y: box.y + 10, id: 1 }] });
  await page.waitForTimeout(1500);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 60, y: box.y + 10, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await blockAt(page, aimed)).toBe(aimed.id);
  expect((await readInfo(page)).yaw).toBe(before.yaw);
  expect(errors).toEqual([]);
});

// ---------- J6 : tutoriel, mission 1 complète, félicitations ----------

const B6 = { rainbow: 16 } as const;

test("tutoriel : marcher, casser, poser, puis la mission 1 commence (au doigt : retour au mode Casser) @tactile", async ({ page }, testInfo) => {
  const touch = isTouch(testInfo);
  const errors = await openGame(page, "#monde=plat&graine=1&mission=0");
  await expect.poll(async () => (await state(page)).missionId).toBe("tuto");
  // Consigne propre à l'appareil.
  await expect.poll(async () => (await state(page)).companionText).toContain(touch ? "rond" : "Z");
  await expect(page.locator(".companion-progress")).toHaveText("");
  // 1. Marcher.
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 15_000 }).toBe(1);
  await page.keyboard.up("KeyW");
  await expect.poll(async () => (await state(page)).companionText, { timeout: 5_000 }).toContain(touch ? "garde le doigt" : "garde le clic");
  // 2. Casser (règles du jeu : le bloc est ramassé et passe dans la main vide).
  await page.evaluate(() => window.cubesDebug.breakBlock(3, 3, 3));
  await expect.poll(async () => (await state(page)).mission?.step).toBe(2);
  expect((await state(page)).inventory[0]).toEqual({ id: B.grass, count: 1 });
  // 3. Poser.
  if (touch) {
    await expect.poll(async () => (await state(page)).companionText, { timeout: 5_000 }).toContain("Touche Casser");
    await page.evaluate(() => window.cubesDebug.look(0, -60));
    await expect.poll(async () => (await state(page)).target !== null).toBe(true);
    await page.getByRole("button", { name: "Casser" }).tap();
    await expect(page.locator(".touch-btn").first()).toHaveText("Poser");
    const vp = page.viewportSize()!;
    await quickTap(page, vp.width * 0.7, vp.height * 0.4);
  } else {
    await expect.poll(async () => (await state(page)).companionText, { timeout: 5_000 }).toContain("clic droit");
    await lockAndLookDown(page);
    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
  }
  await expect.poll(async () => (await state(page)).mission?.done).toBe(true);
  await expect(page.locator(".message")).toContainText("tu sais jouer");
  if (touch) await expect(page.locator(".touch-btn").first()).toHaveText("Casser");
  // La mission 1 suit, Pixel la présente.
  await expect.poll(async () => (await state(page)).missionId, { timeout: 10_000 }).toBe("abri");
  await expect.poll(async () => (await state(page)).companionText, { timeout: 10_000 }).toContain("troncs");
  expect((await state(page)).spoken.some((t) => t.includes("abri avant la nuit"))).toBe(true);
  expect(errors).toEqual([]);
});

/** Cabane de 3 × 3 autour de (cx, cz) dans le monde plat (sol à y = 4) : murs de 3 blocs, porte au sud ; toit si roof. */
async function buildHut(page: Page, cx: number, cz: number, roof: boolean): Promise<void> {
  await page.evaluate(
    ([x0, z0, withRoof]) => {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
          for (let y = 4; y < 7; y++) if (edge && !(dx === 0 && dz === 2 && y < 6)) window.cubesDebug.setBlock(x0 + dx, y, z0 + dz, 4);
          if (withRoof) window.cubesDebug.setBlock(x0 + dx, 7, z0 + dz, 4);
        }
      }
    },
    [cx, cz, roof] as const,
  );
}

test("mission 1 de bout en bout : abri vérifié, lampe, nuit, Grignotes qui fuient, félicitations et cadeau", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(150_000);
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1&creatures=1&heure=16");
  const s0 = await state(page);
  const cx = Math.floor(s0.player.x);
  const cz = Math.floor(s0.player.z);
  await page.evaluate(() => window.cubesDebug.give(6, 6));
  await expect.poll(async () => (await state(page)).mission?.step).toBe(1);
  await page.evaluate(() => window.cubesDebug.give(3, 4));
  await expect.poll(async () => (await state(page)).mission?.step).toBe(2);
  // Abri : pictogramme dans le bandeau, rien d'allumé dehors.
  await expect(page.locator(".companion .shelter-icon")).toBeVisible();
  await expect(page.locator(".companion .shelter-icon .part.on")).toHaveCount(0);
  await expect(page.locator(".companion-progress")).toHaveText("");
  // Des murs sans toit : les murs s'allument, Pixel dit qu'il manque le toit.
  await buildHut(page, cx, cz, false);
  await expect.poll(async () => (await state(page)).shelter).toEqual({ roof: false, walls: 3, own: true, ok: false });
  await expect(page.locator(".companion .shelter-icon .wall.on")).toHaveCount(3);
  await expect(page.locator(".message")).toContainText("Il manque le toit", { timeout: 20_000 });
  expect((await state(page)).mission?.step).toBe(2);
  // Le toit : abri complet, étape validée.
  await buildHut(page, cx, cz, true);
  await expect.poll(async () => (await state(page)).mission?.step).toBe(3);
  // Lampe trouvée puis posée dans l'abri.
  await page.evaluate(() => window.cubesDebug.give(13, 1));
  await expect.poll(async () => (await state(page)).mission?.step).toBe(4);
  await page.evaluate(() => {
    const inv = window.cubesDebug.state().inventory;
    window.cubesDebug.selectSlot(inv.findIndex((c) => c?.id === 13));
    window.cubesDebug.look(0, -60);
  });
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  await page.evaluate(() => window.cubesDebug.placeBlock());
  await expect.poll(async () => (await state(page)).lamps).toBe(1);
  await expect.poll(async () => (await state(page)).mission?.step).toBe(5);
  // Sac plein (9 sortes) : le cadeau devra attendre une case libre.
  await page.evaluate(() => {
    for (const id of [1, 2, 4, 5, 8, 11, 12]) window.cubesDebug.give(id, 1);
  });
  // Dernière étape : consigne lue, le temps file jusqu'à la nuit ; une Grignote fuit la lampe.
  await expect.poll(async () => (await state(page)).companionText, { timeout: 10_000 }).toContain("Reste près de ta lampe");
  await expect.poll(async () => (await state(page)).timeBoost, { timeout: 5_000 }).toBe(true);
  await expect.poll(async () => (await state(page)).night, { timeout: 60_000 }).toBe(true);
  expect((await state(page)).timeBoost).toBe(false);
  await page.evaluate(() => window.cubesDebug.spawnCreature(0, -12));
  await expect.poll(async () => (await state(page)).mission?.done, { timeout: 45_000 }).toBe(true);
  expect((await state(page)).spoken).toContain("Elles fuient la lampe\u00a0!");
  // Écran de félicitations : titre, récapitulatif (6 troncs, 4 pierres, un abri, une lampe), cadeau.
  await expect(page.locator(".celebration")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".celebration h1")).toHaveText("Bravo\u00a0!");
  await expect(page.locator(".celebration-recap li")).toHaveText(["6 troncs", "4 pierres", "Un abri", "Une lampe", "Cadeau\u00a0: 5 blocs arc-en-ciel\u00a0!"]);
  let s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.rewardPending).toEqual({ block: B6.rainbow, count: 5 });
  await page.screenshot({ path: testInfo.outputPath("felicitations.png") });
  const button = page.getByRole("button", { name: "Continuer" });
  await expect(button).toBeEnabled({ timeout: 5_000 });
  await button.click();
  await expect(page.locator(".celebration")).toBeHidden();
  expect((await state(page)).paused).toBe(false);
  await expect(page.locator(".message")).toContainText("Vide une case du sac");
  // Une case libérée : le cadeau entre dans le sac et le jeu le dit.
  await page.evaluate(() => {
    const inv = window.cubesDebug.state().inventory;
    const i = inv.findIndex((c) => c?.id === 12);
    window.cubesDebug.selectSlot(i);
  });
  await page.evaluate(() => window.cubesDebug.clearInventory());
  await expect.poll(async () => invCount(await state(page), B6.rainbow)).toBe(5);
  s = await state(page);
  expect(s.rewardPending).toBeNull();
  await expect(page.locator(".message")).toContainText("5 blocs arc-en-ciel");
  expect(errors).toEqual([]);
});

test("sans Grignotes : la dernière étape se valide peu après la tombée de la nuit (rien ne bloque)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(90_000);
  // Mode adresse sans Grignotes : la nuit tombe (temps accéléré), l'étape se valide peu après.
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1&heure=17");
  const s0 = await state(page);
  await buildHut(page, Math.floor(s0.player.x), Math.floor(s0.player.z), true);
  await page.evaluate(() => {
    window.cubesDebug.give(6, 6);
    window.cubesDebug.give(3, 4);
  });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 10_000 }).toBe(3);
  await page.evaluate(() => window.cubesDebug.give(13, 1));
  await expect.poll(async () => (await state(page)).mission?.step).toBe(4);
  await page.evaluate(() => {
    const inv = window.cubesDebug.state().inventory;
    window.cubesDebug.selectSlot(inv.findIndex((c) => c?.id === 13));
    window.cubesDebug.look(0, -60);
  });
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  await page.evaluate(() => window.cubesDebug.placeBlock());
  await expect.poll(async () => (await state(page)).mission?.done, { timeout: 60_000 }).toBe(true);
  await expect(page.locator(".celebration")).toBeVisible({ timeout: 10_000 });
  // Le cadeau est entré tout de suite (sac pas plein).
  expect(invCount(await state(page), B6.rainbow)).toBe(5);
  expect(errors).toEqual([]);
});

test("accueil et mode parent : étoile d'un monde réussi, tutoriel sauté pour un enfant qui l'a fait, progression affichée", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
      version: 1, gen: 2, type: "prairie", seed: 1234, edits: "",
      player: { x: 64.5, y: 30, z: 64.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.1, savedAt: Date.now(),
      mission: { id: "abri", step: 6, counts: {} },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toBeVisible();
  await expect(page.locator('.slot-card[data-slot="1"] .card-star')).toHaveCount(0);
  // Nouveau monde : Léa a déjà fait le tutoriel, la mission 1 commence.
  await page.locator('.slot-card[data-slot="1"]').click();
  await page.locator('.type-card[data-type="desert"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  let s = await state(page);
  expect(s.missionId).toBe("abri");
  expect(s.mission).toEqual({ step: 0, done: false });
  // Mode parent : progression de chacun.
  await page.locator(".home-btn").click();
  const gear = page.locator(".parent-gear");
  const box = (await gear.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".home h1")).toHaveText("Mode parent", { timeout: 5_000 });
  await page.mouse.up();
  await expect(page.locator(".parent-who")).toHaveText(["Léa : tutoriel fait", "Tom : tutoriel pas encore fait"]);
  await expect(page.locator(".parent-progress li")).toHaveText([
    "Monde 1 (prairie) : mission 1 (l'abri) réussie",
    "Monde 2 (désert) : mission 1 (l'abri) : étape 1 sur 6 (ramasser 6 troncs)",
  ]);
  // Enregistrer et fermer garde le tutoriel fait.
  await page.getByRole("button", { name: "Enregistrer et fermer" }).click();
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:profils") ?? "null"));
  expect(profiles.profiles[0].tutorialDone).toBe(true);
  s = await state(page);
  expect(s.home).toBe(true);
  expect(errors).toEqual([]);
});
