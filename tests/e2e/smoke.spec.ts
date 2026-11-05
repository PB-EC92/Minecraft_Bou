import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dist = resolve("dist/cubes.html");
const url = pathToFileURL(dist).href;

/** Profils tactiles : le convertible replié, en portrait (« tablette ») et en paysage (« tablette-paysage », cas @tactile seulement). */
const isTouch = (info: TestInfo) => info.project.name.startsWith("tablette");

/**
 * Ligne d'infos du HUD, enfant direct du HUD. Jusqu'à la relecture du J8, la ligne d'état du panneau de fabrication
 * portait aussi la classe « info » (son ton) ; ses tons sont désormais « tone-info », « tone-ok » et « tone-no ».
 */
const INFO = ".hud > .info";

/** Monde plat de test (celui du J0) : positions et blocs connus, pour des tests stables. */
const FLAT = "#monde=plat&graine=1";

interface Stack {
  id: number;
  count: number;
}

interface DebugState {
  type: string;
  seed: number;
  player: { x: number; y: number; z: number; onGround: boolean; inWater: boolean; headInWater: boolean; climbing: boolean; yaw: number; pitch: number };
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
  touchMode: "break" | "place";
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
  /** Le temps file (×30) : dernière étape de la mission 1, ou attente du matin avant la mission 2 (V2). */
  timeBoost: boolean;
  tutorialDone: boolean | null;
  companionText: string | null;
  lamps: number;
  bubbles: number;
  /** Appui long en cours sur une case (V2). */
  slotHold: { slot: number; progress: number; source: "mouse" | "touch" | "key" } | null;
  /** Soir retenu à 17 h par l'étape en cours (V2). */
  eveningHeld: boolean;
  /** La lampe peut être citée (décision 6 de Pierre). */
  lampRevealed: boolean;
  /** Mission suivante qui attend le matin (V2), ou null. */
  pendingMission: string | null;
  /** Fabrication (V2) : marteau disponible, panneau ouvert, halo, ligne d'état, cartes, présentation faite. */
  craft: { available: boolean; open: boolean; glow: boolean; status: string; cards: { id: string; state: string }[]; intro: boolean };
  /** Marteau découvert par l'enfant (profil), null hors d'une partie d'enfant (V2). */
  craftSeen: boolean | null;
  /** Mission 2 (V2) : case ABC là, boîte ouverte, lettre tenue, case ABC choisie. */
  letters: { unlocked: boolean; open: boolean; hand: string | null; selected: boolean };
  /** Mission 2 : mot de l'étape d'écriture en cours (null hors d'une étape d'écriture). */
  writing: {
    target: string;
    mode: "copy" | "dictation";
    stage: number;
    revealed: number;
    have: number;
    words: string[];
    ghosts: number;
    /** Cases claires affichées (x, y, z), dans l'ordre du mot. */
    ghostCells: [number, number, number][];
    wrongCells: number;
    help: { model: "full" | "boxes" | "none"; revealed: number; nextRing: boolean; ghostLine: boolean; ghostNext: boolean; trayGlow: boolean };
    /** Consigne dite (l'horloge d'aide tourne et les cases claires peuvent se montrer). */
    announced: boolean;
    found: boolean;
  } | null;
  /** Mots écrits dans la mission en cours (mission 2). */
  words: string[];
}

/** Réaction à l'écriture d'un mot (cubesDebug.checkWriting, V2). */
type WritingCheck = { found: boolean; key: string | null; have: number; wrongCells: number; newTry: boolean } | null;

/** Résultat de cubesDebug.craft (V2). */
type CraftResult = { ok: true; outputSlot: number; before: number; after: number } | { ok: false; reason: string };

/** Identifiants de blocs utiles aux tests (src/engine/blocks.ts). */
const B = { air: 0, grass: 1, dirt: 2, stone: 3, planks: 4, sand: 5, log: 6, leaves: 8, flowerRed: 9, snow: 11, cactus: 12 } as const;

declare global {
  interface Window {
    cubesDebug: {
      version: string;
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
      emptySlot(i: number): "ok" | "empty" | "keep-lamp" | "keep-gift" | "keep-goal";
      openCraft(): boolean;
      closeCraft(): void;
      craft(id: string): CraftResult;
      openLetters(): boolean;
      chooseLetter(ch: string): boolean;
      assumeVoice(v: boolean | null): void;
      checkWriting(): WritingCheck;
      advanceWritingClock(ms: number): boolean;
      skipMissionStep(): boolean;
      fillInventory(): void;
      selectSlot(i: number): void;
      setBlock(x: number, y: number, z: number, id: number): boolean;
      breakBlock(x: number, y: number, z: number): void;
      placeBlock(): void;
      newWorld(type: string, seed: number): void;
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
  // textContent : la ligne est masquée sur les écrans des enfants (J7), mais toujours tenue à jour.
  const text = (await page.locator(INFO).textContent()) ?? "";
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
  // Règle 1 : un seul fichier, hors ligne. Aucune requête en dehors du fichier lui-même (recette J7).
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
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
  expect(await page.locator(INFO).textContent()).toMatch(/1\.1-rc$/);
  expect(await page.evaluate(() => window.cubesDebug.version)).toBe("1.1-rc");
  await expect(page).toHaveTitle("Cubes");
  // J7 : ni panneau Tests ni infos techniques hors du mode adresse (réglage du mode parent, décoché par défaut).
  await expect(page.locator(INFO)).toBeHidden();
  await expect(page.locator(".panel-toggle")).toBeHidden();
  // Sans #monde=… dans l'adresse : un rechargement doit ramener à l'accueil.
  expect(page.url()).not.toContain("#");
  expect(requests.filter((u) => !/^(file|data|blob):/.test(u))).toEqual([]);
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
    expect(await page.locator(INFO).innerText()).toContain(`${name} · graine 4242`);
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
  await expect(diag).toContainText("Version : 1.1-rc");
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
  await expect(page.locator(INFO)).toContainText("île · graine 321");
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
  await expect(page.locator(INFO)).toContainText("bloc : (case vide)");
  await page.evaluate(() => window.cubesDebug.fillInventory());
  await page.keyboard.press("Digit3");
  await expect(page.locator(".slot").nth(2)).toHaveClass(/selected/);
  await expect(page.locator(INFO)).toContainText("bloc : pierre ×20");
  await expect(page.locator(".slot-name")).toHaveText("pierre");
  await expect(page.locator(".slot-name")).toHaveClass(/visible/);
  await expect(page.locator(".slot").nth(2).locator(".count")).toHaveText("20");
  await page.keyboard.press("Digit9");
  await expect(page.locator(INFO)).toContainText("bloc : clôture");
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
  await expect(page.locator(INFO)).toContainText(`bloc : herbe ×${n}`);
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

/**
 * Premier lancement complet : l'adulte règle les prénoms, Léa choisit l'avatar 2 et crée une île dans l'emplacement 1.
 * devTools : l'adulte coche aussi « panneau Tests visible » (masqué par défaut pendant les parties, J7).
 */
async function firstLaunch(page: Page, info: TestInfo, devTools = false): Promise<void> {
  await page.getByLabel("Prénom du joueur 1").fill("Léa");
  await page.getByLabel("Prénom du joueur 2").fill("Tom");
  if (devTools) await page.getByLabel("Panneau Tests visible").check();
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
  // V2 (décision 5 de Pierre) : plus de texte sous l'engrenage.
  await expect(gear).toBeVisible();
  await expect(page.locator(".parent-hint")).toHaveCount(0);
  expect((await page.locator(".parent-gear-wrap").textContent())?.trim()).toBe("");
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
  await firstLaunch(page, testInfo, true);
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
  // Le message est sur l'accueil (le jeu est caché dessous), relecture J7.
  await expect(page.locator(".home .home-warning")).toContainText("ouvert");
  expect(errors).toEqual([]);
});

// ---------- J5 : pierre brillante, clôture, Grignotes, bulles, lampe, compagnon, mission ----------

const invCount = (s: DebugState, id: number) => s.inventory.find((c) => c?.id === id)?.count ?? 0;
const B5 = { lamp: 13, fence: 14, glow: 15 } as const;

test("casser une pierre brillante donne une lampe ; un tronc ne donne qu'un tronc (la clôture se fabrique, V2)", async ({ page }, testInfo) => {
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
  expect(invCount(s, B5.fence)).toBe(0); // décision 3 de Pierre
  // La clôture se fabrique : 2 planches donnent une clôture (décision 8 de Pierre).
  await page.evaluate(() => window.cubesDebug.give(4, 2));
  expect(await page.evaluate(() => window.cubesDebug.craft("cloture"))).toMatchObject({ ok: true, before: 0, after: 1 });
  s = await state(page);
  expect(invCount(s, B5.fence)).toBe(1);
  expect(invCount(s, B.planks)).toBe(0);
  await expect(page.locator(".message")).toContainText("Une clôture");
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
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(1);
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
  // Île à graine tirée au hasard : un tronc (ou une marche de deux blocs) peut se dresser juste devant l'apparition,
  // et Z gardé n'avance plus (l'enfant, lui, se tournerait). Un couloir de 8 blocs, sol compris, est dégagé droit
  // devant (regard vers −z) : la marche ne dépend plus du terrain.
  await page.evaluate(() => {
    const d = window.cubesDebug;
    d.look(0, 0);
    const p = d.state().player;
    const [x, y, z] = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
    for (let k = 1; k <= 8; k++) {
      d.setBlock(x, y - 1, z - k, 1);
      for (let dy = 0; dy <= 2; dy++) d.setBlock(x, y + dy, z - k, 0);
    }
  });
  // Marcher (touche Z = KeyW en AZERTY) : l'étape « marcher » est validée.
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(1);
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
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(1);
  await page.keyboard.up("KeyW");
  await expect.poll(async () => (await state(page)).companionText, { timeout: 5_000 }).toContain(touch ? "garde le doigt" : "garde le clic");
  // 2. Casser (règles du jeu : le bloc est ramassé et passe dans la main vide).
  await page.evaluate(() => window.cubesDebug.breakBlock(3, 3, 3));
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  expect((await state(page)).inventory[0]).toEqual({ id: B.grass, count: 1 });
  // 3. Poser. Au centre d'une case : là où la marche s'est arrêtée, la case visée au sol pourrait chevaucher
  // les pieds (« Pas de place ! », comportement voulu du jeu).
  await page.evaluate(() => window.cubesDebug.teleport(16.5, 4, 15.5));
  if (touch) {
    await expect.poll(async () => (await state(page)).companionText, { timeout: 5_000 }).toContain("Touche Casser");
    await page.evaluate(() => window.cubesDebug.look(0, -60));
    await expect.poll(async () => (await state(page)).target !== null).toBe(true);
    await page.getByRole("button", { name: "Casser" }).tap();
    await expect(page.locator(".touch-btn").first()).toHaveText("Poser");
    const vp = page.viewportSize()!;
    await quickTap(page, vp.width * 0.7, vp.height * 0.4);
  } else {
    // La pose au clic droit est vérifiée par le cas « souris capturée… » ; ici, l'accès de test (mêmes règles),
    // car sous forte charge la capture de la souris peut faire sauter la visée juste après le clic.
    await expect.poll(async () => (await state(page)).companionText, { timeout: 5_000 }).toContain("clic droit");
    await page.evaluate(() => window.cubesDebug.look(0, -60));
    await expect.poll(async () => (await state(page)).target !== null).toBe(true);
    await page.evaluate(() => window.cubesDebug.placeBlock());
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
  // Icône du bloc demandé dans le bandeau (J7).
  await expect(page.locator(".companion-block")).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => window.cubesDebug.give(6, 6));
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(1);
  // Objectif atteint : le compte est dit (J7).
  await expect.poll(async () => (await state(page)).spoken).toContain("Six troncs\u00a0! Bravo\u00a0!");
  await page.evaluate(() => window.cubesDebug.give(3, 4));
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  await expect(page.locator(".companion-block")).toBeHidden();
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
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(3);
  // Étape « pierre brillante » : l'icône du bandeau montre la pierre brillante, pas la lampe (relecture J7).
  await expect(page.locator(".companion-block")).toHaveAttribute("data-block", "15", { timeout: 10_000 });
  // Lampe trouvée puis posée dans l'abri.
  await page.evaluate(() => window.cubesDebug.give(13, 1));
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(4);
  await page.evaluate(() => {
    const inv = window.cubesDebug.state().inventory;
    window.cubesDebug.selectSlot(inv.findIndex((c) => c?.id === 13));
    window.cubesDebug.look(0, -60);
  });
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  await page.evaluate(() => window.cubesDebug.placeBlock());
  await expect.poll(async () => (await state(page)).lamps).toBe(1);
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(5);
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
  // Pas de menu contextuel du navigateur sur l'écran (« Actualiser » ferait perdre la partie).
  expect(
    await page.evaluate(() => {
      const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      document.querySelector(".celebration-card")!.dispatchEvent(e);
      return e.defaultPrevented;
    }),
  ).toBe(true);
  // Une touche gardée pendant l'apparition et relâchée sur l'écran ne reste pas « enfoncée » pour le jeu.
  await page.keyboard.down("KeyW");
  const button = page.getByRole("button", { name: "Continuer" });
  await expect(button).toBeEnabled({ timeout: 5_000 });
  await expect(button).toBeFocused();
  await page.keyboard.up("KeyW");
  await button.click();
  await expect(page.locator(".celebration")).toBeHidden();
  expect((await state(page)).paused).toBe(false);
  const before = (await state(page)).player;
  await page.waitForTimeout(800);
  const after = (await state(page)).player;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.05);
  await expect(page.locator(".message")).toContainText("Vide une case du sac");
  // V2 : la mission 1 a fini la nuit, la mission 2 attend le matin et le temps file (×30), sans signal de la nuit.
  s = await state(page);
  expect(s.missionId).toBe("abri");
  expect(s.pendingMission).toBe("mots");
  expect(s.timeBoost).toBe(true);
  // Une case vidée par l'appui long (même chemin que le geste) : le cadeau entre dans le sac et le jeu le dit.
  const cactus = s.inventory.findIndex((c) => c?.id === 12);
  expect(await page.evaluate((i) => window.cubesDebug.emptySlot(i), cactus)).toBe("ok");
  await expect.poll(async () => invCount(await state(page), B6.rainbow)).toBe(5);
  s = await state(page);
  expect(s.rewardPending).toBeNull();
  expect(invCount(s, 12)).toBe(0);
  await expect(page.locator(".message")).toContainText("5 blocs arc-en-ciel");
  // Le matin : la mission 2 commence.
  await expect.poll(async () => (await state(page)).missionId, { timeout: 60_000 }).toBe("mots");
  s = await state(page);
  expect(s.hour).toBeGreaterThanOrEqual(6.5);
  expect(s.hour).toBeLessThan(10);
  expect(s.pendingMission).toBeNull();
  expect(s.timeBoost).toBe(false);
  expect(s.spoken.filter((t) => t.includes("nuit arrive"))).toEqual([]);
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
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(3);
  await page.evaluate(() => window.cubesDebug.give(13, 1));
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(4);
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
  // Un nouveau monde commence le matin, pas à l'heure (de nuit) du monde précédent.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect.poll(async () => (await state(page)).pendingMission).toBe("mots");
  // Mode adresse : la mission 2 en attente n'est pas perdue en changeant de monde (constat 9 de la revue du J8). Lue
  // dans la même tâche que newWorld, avant toute image : de jour, elle commence dès l'échéance passée (1,5 s après
  // « Continuer »), et une lecture plus tardive la trouverait déjà commencée.
  expect(
    await page.evaluate(() => {
      window.cubesDebug.newWorld("plat", 2);
      return window.cubesDebug.state().pendingMission;
    }),
  ).toBe("mots");
  await expect.poll(async () => Math.round((await state(page)).hour)).toBe(8);
  // De jour, elle commence.
  await expect.poll(async () => (await state(page)).missionId, { timeout: 20_000 }).toBe("mots");
  expect(errors).toEqual([]);
});

test("accueil et mode parent : étoile d'un monde réussi, tutoriel sauté pour un enfant qui l'a fait, progression affichée", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
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
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toHaveText("★");
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toHaveAttribute("aria-label", "1 mission réussie");
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
    "Monde 1 (prairie) : mission 1 (l'abri) réussie, mission 2 (les mots) pas encore commencée",
    "Monde 2 (désert) : mission 1 (l'abri) : étape 1 sur 6 (ramasser 6 troncs)",
  ]);
  // Enregistrer et fermer garde le tutoriel fait et le marteau découvert (V2).
  await page.getByRole("button", { name: "Enregistrer et fermer" }).click();
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:profils") ?? "null"));
  expect(profiles.profiles[0].tutorialDone).toBe(true);
  expect(profiles.profiles[0].craftSeen).toBe(true);
  expect(profiles.profiles[1].craftSeen).toBe(false);
  s = await state(page);
  expect(s.home).toBe(true);
  expect(errors).toEqual([]);
});

test("sac plein : une pierre brillante (ou une lampe) ne se casse pas, elle serait perdue", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  await page.evaluate(() => {
    for (const id of [1, 2, 3, 4, 5, 6, 8, 9, 10]) window.cubesDebug.give(id, 2);
    window.cubesDebug.setBlock(5, 4, 5, 15);
    window.cubesDebug.setBlock(6, 4, 5, 13);
    window.cubesDebug.breakBlock(5, 4, 5);
  });
  expect(await blockAt(page, { x: 5, y: 4, z: 5 })).toBe(B5.glow);
  await expect(page.locator(".message")).toContainText("Pose tes 2 blocs d'herbe");
  await page.evaluate(() => window.cubesDebug.breakBlock(6, 4, 5));
  expect(await blockAt(page, { x: 6, y: 4, z: 5 })).toBe(B5.lamp);
  // Conseil concret (J7) : la sorte la moins nombreuse, dite pour vider sa case.
  // Une case libérée : la pierre brillante se casse et donne sa lampe.
  await page.evaluate(() => {
    window.cubesDebug.clearInventory();
    window.cubesDebug.breakBlock(5, 4, 5);
  });
  expect(await blockAt(page, { x: 5, y: 4, z: 5 })).toBe(B.air);
  expect(invCount(await state(page), B5.lamp)).toBe(1);
  expect(errors).toEqual([]);
});

// ---------- J7 : version 1.0-rc ----------

test("écran des enfants : ni panneau Tests ni infos techniques ; le mode parent peut les réafficher", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  await firstLaunch(page, testInfo);
  await expect(page.locator(".panel-toggle")).toBeHidden();
  await expect(page.locator(INFO)).toBeHidden();
  await expect(page.locator(".home-btn")).toBeVisible();
  // Les boutons ronds se rangent contre le bord (pas de trou à la place de « Tests »).
  const vp = page.viewportSize()!;
  const eye = (await page.locator(".view-btn").boundingBox())!;
  expect(vp.width - (eye.x + eye.width)).toBeLessThan(20);
  // Mode parent : l'adulte réaffiche le panneau.
  await page.locator(".home-btn").click();
  const gear = page.locator(".parent-gear");
  const box = (await gear.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".home h1")).toHaveText("Mode parent", { timeout: 5_000 });
  await page.mouse.up();
  await page.getByLabel("Panneau Tests visible").check();
  await page.getByRole("button", { name: "Enregistrer et fermer" }).click();
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home, null, { timeout: 45_000 });
  await expect(page.locator(".panel-toggle")).toBeVisible();
  await expect(page.locator(INFO)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:reglages") ?? "null")?.devTools)).toBe(true);
  expect(errors).toEqual([]);
});

test("coincé au fond d'un puits : le jeu explique comment grimper (au doigt : Sauter) @tactile", async ({ page }, testInfo) => {
  const touch = isTouch(testInfo);
  const errors = await openGame(page);
  // Puits de deux blocs de profondeur, juste sous l'enfant.
  await page.evaluate(() => {
    window.cubesDebug.setBlock(5, 3, 5, 0);
    window.cubesDebug.setBlock(5, 2, 5, 0);
    window.cubesDebug.teleport(5.5, 2, 5.5);
    window.cubesDebug.look(0, 0);
  });
  await expect.poll(async () => (await state(page)).player.onGround).toBe(true);
  await page.keyboard.down("KeyW"); // pousse contre la paroi, sans sauter
  await expect(page.locator(".message")).toContainText(touch ? "Garde Sauter contre le mur" : "Garde Espace contre le mur", { timeout: 15_000 });
  await page.keyboard.up("KeyW");
  expect(errors).toEqual([]);
});

test("sac plein pendant l'étape « 6 troncs » : un tronc ne se casse pas, il serait perdu (recette J7)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1");
  await expect.poll(async () => (await state(page)).missionId).toBe("abri");
  await page.evaluate(() => {
    for (const id of [1, 2, 3, 4, 5, 8, 9, 10, 11]) window.cubesDebug.give(id, 1);
    window.cubesDebug.setBlock(5, 4, 5, 6);
    window.cubesDebug.breakBlock(5, 4, 5);
  });
  expect(await blockAt(page, { x: 5, y: 4, z: 5 })).toBe(B.log);
  await expect(page.locator(".message")).toContainText("Pose ton bloc d'herbe");
  // Hors de l'étape qui le demande (autre bloc), la règle du J2 reste : cassé, pas ramassé.
  await page.evaluate(() => {
    window.cubesDebug.setBlock(6, 4, 5, 12);
    window.cubesDebug.breakBlock(6, 4, 5);
  });
  expect(await blockAt(page, { x: 6, y: 4, z: 5 })).toBe(B.air);
  expect(errors).toEqual([]);
});

test("étape abri : l'enfant qui pousse contre ses propres murs ne se fait pas dire de grimper (relecture J7)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1");
  await page.evaluate(() => {
    window.cubesDebug.give(6, 6);
    window.cubesDebug.give(3, 4);
  });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  // Abri de 1 × 1, murs de trois blocs, pas encore de toit ; l'enfant au milieu pousse contre un mur.
  await page.evaluate(() => {
    const d = window.cubesDebug;
    d.teleport(6.5, 4, 6.5);
    for (const [x, z] of [[7, 6], [5, 6], [6, 7], [6, 5]] as const) for (let y = 4; y < 7; y++) d.setBlock(x, y, z, 4);
    d.look(0, 0);
  });
  await page.keyboard.down("KeyW");
  await expect(page.locator(".message")).toContainText("Il manque le toit", { timeout: 20_000 });
  await page.waitForTimeout(1000);
  await page.keyboard.up("KeyW");
  expect((await state(page)).spoken.some((t) => t.includes("Garde Espace"))).toBe(false);
  expect(errors).toEqual([]);
});

// ---------- V2 lot 1 : suites de recette (appui long sur une case, soir retenu, lampe à découvrir, rappel d'export) ----------

/** Relève dans la page chaque image où l'anneau de l'appui long est visible : son bas, son centre et la case tenue. */
async function watchHoldRing(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { holdRings: { bottom: number; cx: number; slot: number }[] };
    w.holdRings = [];
    const ring = document.querySelector(".slot-hold")!;
    new MutationObserver(() => {
      if (!ring.classList.contains("visible")) return;
      const r = ring.getBoundingClientRect();
      const slot = Array.from(document.querySelectorAll(".hotbar .slot")).findIndex((el) => el.classList.contains("holding"));
      w.holdRings.push({ bottom: r.bottom, cx: r.left + r.width / 2, slot });
    }).observe(ring, { attributes: true, attributeFilter: ["class", "style"] });
  });
}

const holdRings = (page: Page) =>
  page.evaluate(() => (window as unknown as { holdRings: { bottom: number; cx: number; slot: number }[] }).holdRings.splice(0));

/** Centre d'une case de la barre. */
async function slotCenter(page: Page, i: number): Promise<{ x: number; y: number; top: number }> {
  const b = (await page.locator(".hotbar .slot").nth(i).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, top: b.y };
}

/** Sac plein de 9 sortes, 3 blocs chacune (le sable est dans la case 4, indice 3). */
const FULL_KIT = [B.dirt, B.stone, B.planks, B.sand, B.log, B.leaves, B.snow, B.cactus, B.flowerRed];

test("sac plein : garder le clic une seconde sur une case la vide (anneau au-dessus) ; un clic bref ou une souris qui glisse ne vident rien", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.cubesDebug.give(id, 3);
  }, FULL_KIT);
  await watchHoldRing(page);
  const c = await slotCenter(page, 3);
  await page.mouse.move(c.x, c.y);
  // Clic bref : la case est choisie, rien n'est vidé.
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator(".hotbar .slot").nth(3)).toHaveClass(/selected/);
  expect((await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1300);
  expect(invCount(await state(page), B.sand)).toBe(3);
  // Souris qui glisse pendant l'appui (l'enfant visait autre chose) : annulé. Appui et glissé envoyés dans la même
  // tâche de la page : l'appui est mesuré en temps réel, et sous charge les déplacements n'arrivent qu'aux images.
  await page.evaluate(([x, y]) => {
    const target = document.querySelectorAll(".hotbar .slot")[3]!;
    target.dispatchEvent(new MouseEvent("mousedown", { button: 0, buttons: 1, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    window.dispatchEvent(new MouseEvent("mousemove", { buttons: 1, bubbles: true, clientX: x + 30, clientY: y }));
  }, [c.x, c.y] as const);
  expect((await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1300);
  await page.evaluate(([x, y]) => window.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true, clientX: x + 30, clientY: y })), [c.x, c.y] as const);
  expect(invCount(await state(page), B.sand)).toBe(3);
  await holdRings(page);
  // Appui gardé : l'anneau se remplit au-dessus de la case (le doigt ne le cache pas), puis la case est vidée.
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await expect.poll(async () => invCount(await state(page), B.sand), { timeout: 10_000 }).toBe(0);
  await page.mouse.up();
  const rings = await holdRings(page);
  expect(rings.length).toBeGreaterThan(0);
  for (const r of rings) {
    expect(r.slot).toBe(3);
    expect(r.bottom).toBeLessThanOrEqual(c.top);
    expect(Math.abs(r.cx - c.x)).toBeLessThan(3);
  }
  await expect(page.locator(".slot-hold")).not.toHaveClass(/visible/);
  await expect(page.locator(".hotbar .slot.holding")).toHaveCount(0);
  await expect(page.locator(".message")).toContainText("Case vidée");
  const s = await state(page);
  expect(s.inventory[3]).toBeNull();
  expect(s.slotHold).toBeNull();
  expect(s.inventory.filter(Boolean)).toHaveLength(8);
  // La case libérée reçoit le bloc suivant.
  await page.evaluate(() => window.cubesDebug.give(1, 1));
  expect((await state(page)).inventory[3]).toEqual({ id: B.grass, count: 1 });
  expect(errors).toEqual([]);
});

test("appui long : la lampe et le cadeau ne se vident jamais (pas d'anneau, le jeu le dit)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "souris : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(13, 1); // lampe
    window.cubesDebug.give(16, 5); // cadeau arc-en-ciel
    window.cubesDebug.give(3, 2);
  });
  await watchHoldRing(page);
  const c = await slotCenter(page, 0);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await expect(page.locator(".message")).toContainText("Garde ta lampe", { timeout: 10_000 });
  await page.mouse.up();
  let s = await state(page);
  expect(invCount(s, 13)).toBe(1);
  expect(await holdRings(page)).toEqual([]);
  // Le cadeau, par le même chemin que le geste.
  expect(await page.evaluate(() => window.cubesDebug.emptySlot(1))).toBe("keep-gift");
  await expect(page.locator(".message")).toContainText("Garde ton cadeau");
  expect(await page.evaluate(() => window.cubesDebug.emptySlot(2))).toBe("ok");
  expect(await page.evaluate(() => window.cubesDebug.emptySlot(2))).toBe("empty");
  s = await state(page);
  expect(invCount(s, 16)).toBe(5);
  expect(invCount(s, 3)).toBe(0);
  expect(errors).toEqual([]);
});

test("au doigt : garder le doigt une seconde sur une case la vide ; un doigt qui glisse annule ; rien ne casse et la vue ne tourne pas @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(2, 4);
    window.cubesDebug.give(3, 4);
    window.cubesDebug.look(0, -60);
  });
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  const aimed = await aimedBlock(page);
  const before = await state(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const c = await slotCenter(page, 1);
  // Doigt qui glisse : l'appui est annulé, rien n'est vidé. Toucher et glissé envoyés dans la même tâche de la page
  // (l'appui est mesuré en temps réel ; sous charge, les touchmove du pilote n'arrivent qu'aux images, lentes ici).
  // Un tremblement de 10 px, lui, ne l'annule pas.
  const glide = (dx: number) =>
    page.evaluate(
      ([x, y, d]) => {
        const target = document.querySelectorAll(".hotbar .slot")[1]!;
        const at = (cx: number) => new Touch({ identifier: 41, target, clientX: cx, clientY: y });
        target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [at(x)], changedTouches: [at(x)] }));
        target.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [at(x + d)], changedTouches: [at(x + d)] }));
      },
      [c.x, c.y, dx] as const,
    );
  const lift = (dx: number) =>
    page.evaluate(
      ([x, y, d]) => {
        const target = document.querySelectorAll(".hotbar .slot")[1]!;
        const t = new Touch({ identifier: 41, target, clientX: x + d, clientY: y });
        target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [t] }));
      },
      [c.x, c.y, dx] as const,
    );
  await glide(10);
  expect((await state(page)).slotHold?.source).toBe("touch");
  await lift(10);
  expect((await state(page)).slotHold).toBeNull();
  await glide(30);
  await expect(page.locator(".hotbar .slot").nth(1)).toHaveClass(/selected/);
  expect((await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1300);
  await lift(30);
  expect(invCount(await state(page), B.stone)).toBe(4);
  // Doigt gardé une seconde : la case est vidée.
  await touch("touchStart", c.x, c.y);
  await expect.poll(async () => (await state(page)).slotHold?.source).toBe("touch");
  await expect.poll(async () => invCount(await state(page), B.stone), { timeout: 10_000 }).toBe(0);
  await touch("touchEnd");
  await expect(page.locator(".message")).toContainText("Case vidée");
  // Rien n'a été cassé ni posé, la vue n'a pas tourné, le mode n'a pas changé.
  expect(await blockAt(page, aimed)).toBe(aimed.id);
  const after = await state(page);
  expect(after.player.yaw).toBeCloseTo(before.player.yaw, 5);
  expect(after.player.pitch).toBeCloseTo(before.player.pitch, 5);
  expect(after.touchMode).toBe("break");
  expect(invCount(after, B.dirt)).toBe(4);
  expect(errors).toEqual([]);
});

test("au doigt : Windows qui annule le doigt (touchcancel) après 900 ms vaut un appui allé au bout, que la fenêtre perde le focus avant ou après ; avant, la case est gardée ; lampe toujours gardée @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(2, 4); // terre, case 1
    window.cubesDebug.give(3, 4); // pierre, case 2
    window.cubesDebug.give(5, 4); // sable, case 3
    window.cubesDebug.give(13, 1); // lampe, case 4
    window.cubesDebug.give(4, 4); // planches, case 5
    window.cubesDebug.give(6, 4); // troncs, case 6
  });
  // Doigt posé sur la case i, gardé ms millisecondes puis annulé par le système, dans une seule tâche de la page :
  // aucune image ne passe pendant l'appui, le jeu ne le voit donc jamais plein avant l'annulation (seule celle-ci
  // peut vider la case). blur : la fenêtre perd aussi le focus, juste après l'annulation ou juste avant. Rend l'appui
  // que garde la barre.
  const cancelAfter = (i: number, ms: number, blur: "after" | "before" | null = null) =>
    page.evaluate(
      ([slot, wait, lose]) => {
        const target = document.querySelectorAll(".hotbar .slot")[slot]!;
        const r = target.getBoundingClientRect();
        const t = new Touch({ identifier: 43, target, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
        target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t], changedTouches: [t] }));
        const t0 = performance.now();
        while (performance.now() - t0 < wait) {
          // doigt immobile
        }
        if (lose === "before") window.dispatchEvent(new Event("blur"));
        target.dispatchEvent(new TouchEvent("touchcancel", { bubbles: true, cancelable: false, touches: [], changedTouches: [t] }));
        if (lose === "after") window.dispatchEvent(new Event("blur"));
        return window.cubesDebug.state().slotHold;
      },
      [i, ms, blur] as const,
    );
  // Annulé à 500 ms : l'appui est abandonné, la case reste pleine.
  expect(await cancelAfter(0, 500)).toBeNull();
  await page.waitForTimeout(1300);
  expect(invCount(await state(page), B.dirt)).toBe(4);
  // Annulé à 950 ms : l'appui est mené au bout (anneau plein), la case est vidée à l'image suivante.
  expect(await cancelAfter(1, 950)).toEqual({ slot: 1, progress: 1, source: "touch" });
  await expect.poll(async () => invCount(await state(page), B.stone), { timeout: 10_000 }).toBe(0);
  await expect(page.locator(".message")).toContainText("Case vidée");
  // Même chose si la fenêtre perd le focus avec l'annulation (geste du système), juste après elle ou juste avant.
  expect(await cancelAfter(2, 950, "after")).toEqual({ slot: 2, progress: 1, source: "touch" });
  await expect.poll(async () => invCount(await state(page), B.sand), { timeout: 10_000 }).toBe(0);
  expect(await cancelAfter(4, 950, "before")).toEqual({ slot: 4, progress: 1, source: "touch" });
  await expect.poll(async () => invCount(await state(page), B.planks), { timeout: 10_000 }).toBe(0);
  // Focus perdu puis doigt annulé à 500 ms : l'appui est abandonné, la case reste pleine.
  expect(await cancelAfter(5, 500, "before")).toBeNull();
  await page.waitForTimeout(1300);
  expect(invCount(await state(page), B.log)).toBe(4);
  // Mêmes règles qu'au bout de la seconde : la lampe n'est jamais vidée, le jeu le dit.
  await cancelAfter(3, 950);
  await expect(page.locator(".message")).toContainText("Garde ta lampe", { timeout: 10_000 });
  expect(invCount(await state(page), 13)).toBe(1);
  expect((await state(page)).slotHold).toBeNull();
  // Par le vrai chemin du doigt (CDP) : annulé aussitôt posé, case gardée ; après 950 ms, case vidée. (Sous charge,
  // un événement du pilote peut attendre plusieurs centaines de millisecondes une image lente : les durées exactes
  // sont vérifiées plus haut, dans la page.) L'écart réellement vu par la page entre le toucher et son annulation est
  // relevé : s'il dépasse 900 ms (machine chargée), la règle veut que la case se vide ; on refait alors le geste
  // (au plus 4 fois) jusqu'à obtenir l'annulation « aussitôt posé » que ce cas vérifie.
  await page.evaluate(() => window.cubesDebug.give(3, 4)); // pierre, de nouveau en case 2
  await page.evaluate(() => {
    const w = window as unknown as { __touchTimes: number[] };
    w.__touchTimes = [];
    for (const ev of ["touchstart", "touchcancel"]) window.addEventListener(ev, () => w.__touchTimes.push(performance.now()), { capture: true });
  });
  const cdp = await context.newCDPSession(page);
  const c = await slotCenter(page, 1);
  let quickGap = Infinity;
  for (let attempt = 0; attempt < 4 && !(quickGap < 900); attempt++) {
    await page.evaluate(() => {
      (window as unknown as { __touchTimes: number[] }).__touchTimes = [];
    });
    await page.evaluate(() => {
      // Pierre de nouveau en case 2 si un essai précédent l'a vidée (première case libre).
      const missing = 4 - (window.cubesDebug.state().inventory.find((s) => s?.id === 3)?.count ?? 0);
      if (missing > 0) window.cubesDebug.give(3, missing);
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    const times = await page.evaluate(() => (window as unknown as { __touchTimes: number[] }).__touchTimes);
    quickGap = times.length === 2 ? (times[1] ?? 0) - (times[0] ?? 0) : Infinity;
    if (!(quickGap < 900)) await page.waitForTimeout(1300); // geste compté comme allé au bout : on laisse le jeu finir
  }
  expect(quickGap).toBeLessThan(900);
  expect((await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1300);
  expect(invCount(await state(page), B.stone)).toBe(4);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
  await page.waitForTimeout(950);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect.poll(async () => invCount(await state(page), B.stone), { timeout: 10_000 }).toBe(0);
  expect(invCount(await state(page), B.dirt)).toBe(4);
  expect(errors).toEqual([]);
});

test("clavier : garder la touche 3 une seconde vide la case 3 ; la relâcher avant ou tourner la molette annule", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "clavier : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(2, 5);
    window.cubesDebug.give(3, 5);
    window.cubesDebug.give(5, 5);
  });
  // Relâchée avant une seconde : rien (temps réel : pas d'attente superflue entre l'appui et le relâchement).
  await page.keyboard.down("Digit3");
  await page.waitForTimeout(150);
  await page.keyboard.up("Digit3");
  await expect(page.locator(".hotbar .slot").nth(2)).toHaveClass(/selected/);
  await expect.poll(async () => (await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1000);
  expect(invCount(await state(page), B.sand)).toBe(5);
  // Molette pendant l'appui : la case choisie change, l'appui est annulé.
  await page.mouse.move(640, 360);
  await page.keyboard.down("Digit3");
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await state(page)).slot).toBe(3);
  await expect.poll(async () => (await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1300);
  await page.keyboard.up("Digit3");
  expect(invCount(await state(page), B.sand)).toBe(5);
  // Gardée une seconde : la case 3 est vidée.
  await page.keyboard.down("Digit3");
  await expect.poll(async () => (await state(page)).slotHold?.source).toBe("key");
  await expect.poll(async () => invCount(await state(page), B.sand), { timeout: 10_000 }).toBe(0);
  await page.keyboard.up("Digit3");
  await expect(page.locator(".message")).toContainText("Case vidée");
  const s = await state(page);
  expect(invCount(s, B.dirt)).toBe(5);
  expect(invCount(s, B.stone)).toBe(5);
  expect(errors).toEqual([]);
});

test("étape « 6 troncs » : les troncs ne se vident pas, Pixel en a besoin (rien ne bloque la mission)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1");
  // La consigne est dite d'abord (sinon elle remplacerait le message du refus).
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.includes("six troncs")), { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => {
    window.cubesDebug.give(6, 3);
    window.cubesDebug.give(2, 2);
  });
  let s = await state(page);
  const logs = s.inventory.findIndex((c) => c?.id === B.log);
  expect(await page.evaluate((i) => window.cubesDebug.emptySlot(i), logs)).toBe("keep-goal");
  await expect(page.locator(".message")).toContainText("Garde tes troncs");
  const dirt = s.inventory.findIndex((c) => c?.id === B.dirt);
  expect(await page.evaluate((i) => window.cubesDebug.emptySlot(i), dirt)).toBe("ok");
  s = await state(page);
  expect(invCount(s, B.log)).toBe(3);
  expect(invCount(s, B.dirt)).toBe(0);
  expect(errors).toEqual([]);
});

test("mission 1 : le soir s'arrête à 17 h tant que l'abri n'est pas fait (Temps ×20 compris), puis carillon et nuit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(90_000);
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1&creatures=1&heure=16.8");
  await page.getByRole("button", { name: "Tests" }).click();
  await page.getByRole("button", { name: "Temps ×20" }).click();
  await page.getByRole("button", { name: "Tests" }).click();
  await expect.poll(async () => (await state(page)).hour, { timeout: 20_000 }).toBeGreaterThan(16.99);
  let s = await state(page);
  expect(s.eveningHeld).toBe(true);
  expect(s.hour).toBeLessThan(17.01);
  // Une seconde et demie au temps ×20 : plus d'une demi-heure de jeu sans la retenue.
  await page.waitForTimeout(1500);
  s = await state(page);
  expect(s.hour).toBeCloseTo(17, 2);
  expect(s.night).toBe(false);
  expect(s.spoken.some((t) => t.includes("nuit arrive"))).toBe(false);
  // Troncs, pierres, abri : le temps repart, carillon et « La nuit arrive ! », puis la nuit.
  await page.evaluate(() => {
    window.cubesDebug.give(6, 6);
    window.cubesDebug.give(3, 4);
  });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  expect((await state(page)).eveningHeld).toBe(true);
  await buildHut(page, Math.floor(s.player.x), Math.floor(s.player.z), true);
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(3);
  expect((await state(page)).eveningHeld).toBe(false);
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.includes("nuit arrive")), { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await state(page)).night, { timeout: 30_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test("lampe à découvrir : avant la fin de la mission 1, le signal de la nuit ne parle pas de la lampe (lecteur autonome) ; sans mission, si", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(90_000);
  const autonome = async (p: Page) => {
    await p.getByRole("button", { name: "Tests" }).click();
    await p.getByLabel("Niveau de lecture").selectOption("autonome");
    await p.getByRole("button", { name: "Tests" }).click();
  };
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1&creatures=1&heure=17.4");
  await autonome(page);
  expect((await state(page)).lampRevealed).toBe(false);
  // Troncs, pierres, abri (le soir reste à 17 h 24 jusque-là), puis le soir repart.
  await page.evaluate(() => {
    window.cubesDebug.give(6, 6);
    window.cubesDebug.give(3, 4);
  });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  const s0 = await state(page);
  await buildHut(page, Math.floor(s0.player.x), Math.floor(s0.player.z), true);
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(3);
  const message = page.locator(".message");
  await expect(message).toContainText("les Grignotes vont bientôt sortir", { timeout: 30_000 });
  expect(await message.textContent()).not.toContain("lampe");
  expect((await state(page)).lampRevealed).toBe(false);
  // Sans mission (adresse sans &mission) : la lampe est citée.
  const free = await context.newPage();
  const errors2 = await openGame(free, "#monde=plat&graine=1&creatures=1&heure=17.42");
  await autonome(free);
  expect((await state(free)).lampRevealed).toBe(true);
  await expect(free.locator(".message")).toContainText("Une lampe les éloigne", { timeout: 30_000 });
  expect(errors).toEqual([]);
  expect(errors2).toEqual([]);
});

test("mode parent : rappel du geste au premier réglage ; date du dernier export, rappel « jamais » puis au-delà de 7 jours, export et import qui la mettent à jour", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "");
  // Premier réglage : le geste de l'engrenage est dit à l'adulte (décision 5 de Pierre), pas de rappel d'export.
  await expect(page.locator(".parent-gear-note")).toContainText("3 secondes sur l'engrenage");
  await expect(page.locator(".parent-reminder")).toHaveCount(0);
  await firstLaunch(page, testInfo);
  await page.locator(".home-btn").click();
  await expect(page.locator(".parent-reminder, .parent-export-date, .parent-gear-note")).toHaveCount(0);
  const openParent = async () => {
    const box = (await page.locator(".parent-gear").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(page.locator(".home h1")).toHaveText("Mode parent", { timeout: 5_000 });
    await page.mouse.up();
  };
  await openParent();
  // Un monde, jamais exporté : rappel en tête, avec son bouton.
  const reminder = page.locator(".parent-reminder");
  await expect(reminder).toContainText("jamais été exportés");
  await expect(reminder).toHaveAttribute("role", "status");
  await expect(page.locator(".parent-export-date")).toHaveText("Dernier export : jamais.");
  // Prénom en cours de saisie : l'export ne re-rend pas le formulaire.
  await page.getByLabel("Prénom du joueur 2").fill("Tommy");
  const [download] = await Promise.all([page.waitForEvent("download"), reminder.getByRole("button", { name: "Exporter maintenant" }).click()]);
  const file = testInfo.outputPath("export.json");
  await download.saveAs(file);
  await expect(reminder).toHaveCount(0);
  await expect(page.locator(".parent-export-date")).toContainText("aujourd'hui");
  await expect(page.getByLabel("Prénom du joueur 2")).toHaveValue("Tommy");
  const at = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:dernier-export") ?? "null")?.at as number);
  expect(Math.abs(Date.now() - at)).toBeLessThan(60_000);
  // Neuf jours plus tard : rappel.
  await page.evaluate(() => localStorage.setItem("cubes:dernier-export", JSON.stringify({ at: Date.now() - 9 * 86_400_000 })));
  await page.getByRole("button", { name: "Fermer sans enregistrer" }).click();
  await openParent();
  await expect(page.locator(".parent-reminder")).toContainText("il y a 9 jours");
  await expect(page.locator(".parent-export-date")).toContainText("il y a 9 jours");
  // Import du fichier d'aujourd'hui : sa date est retenue, le rappel disparaît. (Contenu passé directement : le chemin
  // du dossier de sortie contient « à », que l'envoi par chemin ne transmet pas.)
  page.once("dialog", (d) => void d.accept());
  await page.getByLabel("Importer une sauvegarde").setInputFiles({ name: "export.json", mimeType: "application/json", buffer: readFileSync(file) });
  await expect(page.locator(".parent-status")).toHaveText("Sauvegarde importée.");
  await expect(page.locator(".parent-export-date")).toContainText("aujourd'hui");
  await expect(page.locator(".parent-reminder")).toHaveCount(0);
  // Horloge en avance de 40 jours pendant un export, remise à l'heure depuis : date incertaine et rappel tout de
  // suite (constat 12 de la revue du J8 ; avant, « aujourd'hui » sans rappel jusqu'à ce que l'horloge la rattrape).
  await page.evaluate(() => localStorage.setItem("cubes:dernier-export", JSON.stringify({ at: Date.now() + 40 * 86_400_000 })));
  await page.getByRole("button", { name: "Fermer sans enregistrer" }).click();
  await openParent();
  await expect(page.locator(".parent-export-date")).toHaveText("Dernier export : date incertaine (l'horloge de l'ordinateur a changé).");
  await expect(page.locator(".parent-reminder")).toContainText("la date du dernier export est incertaine");
  // Exporter maintenant remet la date du jour.
  await Promise.all([page.waitForEvent("download"), page.locator(".parent-reminder").getByRole("button", { name: "Exporter maintenant" }).click()]);
  await expect(page.locator(".parent-reminder")).toHaveCount(0);
  await expect(page.locator(".parent-export-date")).toContainText("aujourd'hui");
  expect(errors).toEqual([]);
});

test("monde dont la mission 1 est finie, repris la nuit : la mission 2 attend le matin (temps accéléré) ; félicitations pas encore vues : l'écran d'abord", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    // Monde de la 1.0-rc : abri fini, 22 h (phase 0,8333), félicitations déjà vues (monde 1) ou pas (monde 2).
    const world = (celebrate: boolean) => JSON.stringify({
      version: 1, gen: 2, type: "prairie", seed: 1234, edits: "",
      player: { x: 64.5, y: 30, z: 64.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.8333, savedAt: Date.now(),
      mission: { id: "abri", step: 6, counts: {} }, ...(celebrate ? { celebrate: true } : {}),
    });
    localStorage.setItem("cubes:monde:p1:0", world(false));
    localStorage.setItem("cubes:monde:p1:1", world(true));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toHaveText("★");
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  let s = await state(page);
  expect(s.missionId).toBe("abri");
  expect(s.mission).toEqual({ step: 6, done: true });
  expect(s.pendingMission).toBe("mots");
  expect(s.timeBoost).toBe(true);
  expect(s.celebration).toBe(false);
  // Abri passé : le marteau est là, avec son halo, même pour ce profil qui ne l'a jamais ouvert (constat 5 de la revue
  // du J8 : il manquait jusqu'à la fin de la mission 2).
  expect(s.craftSeen).toBe(false);
  expect(s.craft).toMatchObject({ available: true, glow: true });
  // Pixel dit qu'on attend le matin ; le matin, la mission 2 commence.
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.startsWith("Demain")), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await state(page)).missionId, { timeout: 60_000 }).toBe("mots");
  s = await state(page);
  expect(s.hour).toBeGreaterThanOrEqual(6.5);
  expect(s.hour).toBeLessThan(10);
  expect(s.pendingMission).toBeNull();
  expect(s.timeBoost).toBe(false);
  expect(await page.evaluate(() => window.cubesDebug.saveNow())).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:monde:p1:0") ?? "null")?.mission?.id)).toBe("mots");
  // Monde 2 : l'écran de félicitations de la mission 1 passe d'abord, la mission 2 attend ensuite le matin.
  await page.locator(".home-btn").click();
  await page.locator('.profile-card[data-profile="p1"]').click();
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toHaveText("★");
  await page.locator('.slot-card[data-slot="1"]').click();
  await expect(page.locator(".celebration")).toBeVisible({ timeout: 15_000 });
  s = await state(page);
  expect(s.missionId).toBe("abri");
  expect(s.pendingMission).toBeNull();
  const button = page.getByRole("button", { name: "Continuer" });
  await expect(button).toBeEnabled({ timeout: 5_000 });
  await button.click();
  await expect.poll(async () => (await state(page)).pendingMission).toBe("mots");
  expect((await state(page)).timeBoost).toBe(true);
  await expect.poll(async () => (await state(page)).missionId, { timeout: 60_000 }).toBe("mots");
  expect(errors).toEqual([]);
});

// ---------- V2 lot 1 : verre et fabrication ----------

const B8 = { glass: 17 } as const;

/** Rectangles qui se chevauchent (plus d'un pixel de recouvrement). */
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x + a.width > b.x + 1 && b.x + b.width > a.x + 1 && a.y + a.height > b.y + 1 && b.y + b.height > a.y + 1;

test("fabrication au clavier : F ouvre le panneau (souris libérée, jeu en pause) ; 1 tronc donne 2 planches, puis « 2 + 2 = 4 » ; rien ne passe derrière ; Échap ferme", async ({ page }, testInfo) => {
  test.skip(isTouch(testInfo), "clavier et souris : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => window.cubesDebug.give(6, 2));
  await lockAndLookDown(page);
  const aimed = await aimedBlock(page);
  // Mode adresse : le marteau est là, l'aide d'écran donne la touche.
  await expect(page.locator(".craft-btn")).toBeVisible();
  await expect(page.locator(".hint")).toContainText("F : fabriquer");
  await page.keyboard.press("KeyF");
  await expect(page.locator(".craft")).toBeVisible();
  let s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.craft.open).toBe(true);
  expect(s.craft.cards).toEqual([
    { id: "planches", state: "ok" },
    { id: "cloture", state: "missing" },
    { id: "verre", state: "missing" },
  ]);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator(".craft-status")).toHaveText("Clique sur une carte !");
  // Le ton de la ligne d'état a sa propre classe : « .info » ne désigne que la ligne d'infos du HUD (relecture J8).
  await expect(page.locator(".craft-status")).toHaveClass(/\btone-info\b/);
  await expect(page.locator(".info")).toHaveCount(1);
  await expect(page.locator(".craft .info, .craft .ok, .craft .no")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("fabrication-pc.png") });
  // Carte planches (armée 400 ms après l'ouverture) : 1 tronc donne 2 planches ; encore : l'addition.
  await page.waitForTimeout(500);
  const planks = page.locator('.craft-card[data-recipe="planches"]');
  await planks.click();
  await expect.poll(async () => invCount(await state(page), B.planks)).toBe(2);
  expect(invCount(await state(page), B.log)).toBe(1);
  // Résultat en vert, comme avant le renommage des classes de ton.
  await expect(page.locator(".craft-status")).toHaveClass(/\btone-ok\b/);
  await expect(page.locator(".craft-status")).toHaveCSS("color", "rgb(47, 125, 50)");
  await expect(page.locator(".craft-status")).toHaveText("2 planches !");
  await page.waitForTimeout(300);
  await planks.click();
  await expect.poll(async () => invCount(await state(page), B.planks)).toBe(4);
  await expect(page.locator(".craft-status")).toHaveText("2 + 2 = 4 planches !");
  await expect.poll(async () => (await state(page)).spoken).toContain("Deux plus deux, ça fait quatre planches !");
  s = await state(page);
  expect(s.craft.cards).toEqual([
    { id: "planches", state: "missing" },
    { id: "cloture", state: "ok" },
    { id: "verre", state: "missing" },
  ]);
  // Plus de tronc : la carte tremble et la ligne d'état dit où en trouver ; le sac ne change pas.
  await page.waitForTimeout(300);
  await planks.click();
  await expect(planks).toHaveClass(/shake/);
  await expect(page.locator(".craft-status")).toHaveClass(/\btone-no\b/);
  await expect(page.locator(".craft-status")).toHaveCSS("color", "rgb(180, 82, 26)");
  await expect(page.locator(".craft-status")).toContainText("tronc");
  // Main vide (les troncs épuisés) : les planches y sont passées.
  expect(s.slot).toBe(1);
  // Clic droit et molette sur le panneau : rien derrière (pas de pose, pas de changement de case).
  const sheet = (await page.locator(".craft-sheet").boundingBox())!;
  await page.mouse.click(sheet.x + 30, sheet.y + 30, { button: "right" });
  await page.mouse.wheel(0, 300);
  s = await state(page);
  expect(s.slot).toBe(1);
  expect(invCount(s, B.planks)).toBe(4);
  expect(s.paused).toBe(true);
  // Échap ferme ; souris libre : « Clique pour jouer ».
  await page.keyboard.press("Escape");
  await expect(page.locator(".craft")).toBeHidden();
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.craft.open).toBe(false);
  await expect(page.locator(".message")).toContainText("Clique pour jouer");
  expect(await blockAt(page, aimed)).toBe(aimed.id);
  expect(errors).toEqual([]);
});

test("fabrication, sac plein : le dernier tronc devient des planches dans sa case ; avec 2 troncs, refus et la case à vider remue", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  const kit = [B.grass, B.dirt, B.stone, B.sand, B.log, B.leaves, B.snow, B.cactus, B.flowerRed];
  const fill = (logs: number) =>
    page.evaluate(
      ([ids, n]) => {
        window.cubesDebug.clearInventory();
        for (const id of ids) window.cubesDebug.give(id, id === 6 ? n : 3);
      },
      [kit, logs] as const,
    );
  await fill(1);
  expect(await page.evaluate(() => window.cubesDebug.craft("planches"))).toEqual({ ok: true, outputSlot: 4, before: 0, after: 2 });
  let s = await state(page);
  expect(s.inventory[4]).toEqual({ id: B.planks, count: 2 });
  expect(invCount(s, B.log)).toBe(0);
  // Deux troncs : la case du tronc ne se vide pas, aucune case pour les planches.
  await fill(2);
  const before = (await state(page)).inventory;
  const r = await page.evaluate(() => {
    const res = window.cubesDebug.craft("planches");
    const wiggle = Array.from(document.querySelectorAll(".hotbar .slot")).flatMap((el, i) => (el.classList.contains("wiggle") ? [i] : []));
    return { res, wiggle };
  });
  expect(r.res).toEqual({ ok: false, reason: "full" });
  // La plus petite pile qu'on peut vider : toutes à 3, la première (ni le tronc ni les planches).
  expect(r.wiggle).toEqual([0]);
  s = await state(page);
  expect(s.inventory).toEqual(before);
  await expect(page.locator(".message")).toContainText("Sac plein");
  // Ouverture du panneau avec ce sac (2 troncs, 3 sables, aucune case libre) : rien n'est possible parce que le sac
  // est plein, pas faute de blocs. La ligne d'état et la voix le disent, et la case à vider remue (constat 4 de la
  // revue du J8 : « Il manque des blocs ! » envoyait casser un arbre).
  await page.waitForTimeout(4200); // remue précédente finie ; « Sac plein » peut être redit (anti-répétition de 4 s)
  const opened = await page.evaluate(() => {
    const ok = window.cubesDebug.openCraft();
    const wiggle = Array.from(document.querySelectorAll(".hotbar .slot")).flatMap((el, i) => (el.classList.contains("wiggle") ? [i] : []));
    return { ok, wiggle };
  });
  expect(opened.ok).toBe(true);
  expect(opened.wiggle).toEqual([0]);
  s = await state(page);
  expect(s.craft.cards).toEqual([
    { id: "planches", state: "full" },
    { id: "cloture", state: "missing" },
    { id: "verre", state: "full" },
  ]);
  await expect(page.locator(".craft-status")).toHaveText("Sac plein : vide une case !");
  await expect(page.locator(".craft-status")).toHaveClass(/no/);
  expect(s.spoken.at(-1)).toBe("Sac plein ! Garde le clic sur la case qui bouge pour la vider.");
  expect(s.spoken.some((t) => t.startsWith("Il manque des blocs"))).toBe(false);
  await page.evaluate(() => window.cubesDebug.closeCraft());
  // Rien de possible à cause du maximum (99 planches, 99 clôtures, un tronc, pas de sable) : le panneau dit le maximum.
  await page.evaluate(() => {
    window.cubesDebug.clearInventory();
    window.cubesDebug.give(6, 1);
    window.cubesDebug.give(4, 99);
    window.cubesDebug.give(14, 99);
  });
  expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
  s = await state(page);
  expect(s.craft.cards.map((c) => c.state)).toEqual(["max", "max", "missing"]);
  await expect(page.locator(".craft-status")).toHaveText("99, c'est le maximum !");
  expect(s.spoken.at(-1)).toBe("Quatre-vingt-dix-neuf, c'est le maximum !");
  await page.evaluate(() => window.cubesDebug.closeCraft());
  expect(errors).toEqual([]);
});

test("fabrication au clavier, panneau ouvert : garder la touche 3 une seconde vide la case 3 (la ligne d'état le dit, le panneau reste ouvert) ; relâchée avant, rien", async ({ page }, testInfo) => {
  test.skip(isTouch(testInfo), "clavier : PC uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(2, 5);
    window.cubesDebug.give(3, 5);
    window.cubesDebug.give(5, 5);
    window.cubesDebug.give(6, 2);
  });
  await page.mouse.click(640, 360);
  await page.keyboard.press("KeyF");
  await expect(page.locator(".craft")).toBeVisible();
  // Relâchée avant une seconde : la case est choisie, rien n'est vidé.
  await page.keyboard.down("Digit3");
  await page.waitForTimeout(150);
  await page.keyboard.up("Digit3");
  await expect(page.locator(".hotbar .slot").nth(2)).toHaveClass(/selected/);
  await expect.poll(async () => (await state(page)).slotHold).toBeNull();
  await page.waitForTimeout(1000);
  expect(invCount(await state(page), B.sand)).toBe(5);
  // Gardée une seconde (constat 13 de la revue du J8 : les chiffres étaient avalés panneau ouvert).
  await page.keyboard.down("Digit3");
  await expect.poll(async () => (await state(page)).slotHold?.source).toBe("key");
  await expect.poll(async () => invCount(await state(page), B.sand), { timeout: 10_000 }).toBe(0);
  await page.keyboard.up("Digit3");
  await expect(page.locator(".craft-status")).toContainText("Case vidée");
  // Cartes à jour : plus de sable.
  await expect.poll(async () => (await state(page)).craft.cards.find((c) => c.id === "verre")?.state).toBe("missing");
  const s = await state(page);
  expect(s.craft.open).toBe(true);
  expect(s.paused).toBe(true);
  expect(invCount(s, B.dirt)).toBe(5);
  expect(invCount(s, B.stone)).toBe(5);
  expect(invCount(s, B.log)).toBe(2);
  // F ferme toujours le panneau.
  await page.keyboard.press("KeyF");
  await expect(page.locator(".craft")).toBeHidden();
  expect(errors).toEqual([]);
});

test("fabrication au doigt : le marteau de la colonne ouvre le panneau ; un doigt gardé 1,5 s sur une carte fabrique une fois ; le voile ferme ; rien n'est cassé ni posé, la vue ne tourne pas @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => {
    window.cubesDebug.give(6, 3);
    window.cubesDebug.look(0, -60);
  });
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  const aimed = await aimedBlock(page);
  const before = await state(page);
  const driver = await touchDriver(context, page);
  const hammer = page.locator(".touch-btn.craft-touch");
  await expect(hammer).toBeVisible();
  await expect(hammer).toHaveAttribute("aria-label", "Fabriquer");
  const hb = (await hammer.boundingBox())!;
  await driver.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await expect(page.locator(".craft")).toBeVisible();
  expect((await state(page)).paused).toBe(true);
  await expect(page.locator(".craft-status")).toHaveText("Touche une carte !");
  // Doigt gardé longtemps sur la carte (comme pour casser) : une seule fabrication, au relâchement.
  await page.waitForTimeout(500);
  const card = (await page.locator('.craft-card[data-recipe="planches"]').boundingBox())!;
  await driver.hold(card.x + card.width / 2, card.y + card.height / 2, () => page.waitForTimeout(1500));
  let s = await state(page);
  expect(invCount(s, B.planks)).toBe(2);
  expect(invCount(s, B.log)).toBe(2);
  // Un doigt qui glisse sur le panneau ne fabrique rien et ne tourne pas la vue.
  const sheet = (await page.locator(".craft-sheet").boundingBox())!;
  await driver.drag(sheet.x + sheet.width / 2, sheet.y + 20, sheet.y + sheet.height - 20);
  s = await state(page);
  expect(invCount(s, B.planks)).toBe(2);
  expect(s.craft.open).toBe(true);
  // Un toucher sur le voile ferme.
  await driver.tap(sheet.x + sheet.width / 2, Math.max(20, sheet.y / 2));
  await expect(page.locator(".craft")).toBeHidden();
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.player.yaw).toBeCloseTo(before.player.yaw, 5);
  expect(s.player.pitch).toBeCloseTo(before.player.pitch, 5);
  expect(s.touchMode).toBe("break");
  expect(await blockAt(page, aimed)).toBe(aimed.id);
  expect(invCount(s, B.planks)).toBe(2);
  expect(invCount(s, B.log)).toBe(2);
  expect(errors).toEqual([]);
});

/**
 * Touchers synthétiques sur un écran posé sur le jeu, dans la page : chaque pas est un événement (touchstart,
 * touchend) d'un doigt sur la cible sel, au centre de sa boîte ; down liste les doigts restés posés selon le
 * navigateur (touches), doigt compris pour un touchstart.
 */
async function synthTouches(page: Page, steps: { type: "touchstart" | "touchend"; id: number; sel: string; down: number[] }[]): Promise<void> {
  await page.evaluate((list) => {
    const at = new Map<number, Touch>();
    for (const s of list) {
      const target = document.querySelector(s.sel)!;
      const r = target.getBoundingClientRect();
      const t = new Touch({ identifier: s.id, target, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
      at.set(s.id, t);
      const touches = s.down.map((id) => at.get(id) ?? new Touch({ identifier: id, target, clientX: 1, clientY: 1 }));
      target.dispatchEvent(new TouchEvent(s.type, { bubbles: true, cancelable: true, touches, changedTouches: [t] }));
    }
  }, steps);
}

test("fabrication au doigt : un doigt dont la fin se perd ne bloque pas le panneau, un nouveau doigt reprend le geste ; la fenêtre qui perd le focus relâche la carte @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page);
  await page.evaluate(() => window.cubesDebug.give(6, 3));
  const open = async () => {
    expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
    await expect(page.locator(".craft")).toBeVisible();
    await page.waitForTimeout(500); // armé 400 ms après l'ouverture
  };
  const PLANKS = '.craft-card[data-recipe="planches"]';
  // Doigt fantôme que le navigateur liste encore (41 sur la carte) : la croix touchée ensuite (42) ferme le panneau.
  await open();
  await synthTouches(page, [
    { type: "touchstart", id: 41, sel: PLANKS, down: [41] },
    { type: "touchstart", id: 42, sel: ".craft-close", down: [41, 42] },
    { type: "touchend", id: 42, sel: ".craft-close", down: [41] },
  ]);
  await expect(page.locator(".craft")).toBeHidden();
  let s = await state(page);
  expect(s.craft.open).toBe(false);
  expect(s.paused).toBe(false);
  expect(invCount(s, B.log)).toBe(3);
  // Fenêtre qui perd le focus, doigt posé sur la carte : la carte est relâchée, et ce doigt, levé ensuite, ne fabrique rien.
  await open();
  await synthTouches(page, [{ type: "touchstart", id: 41, sel: PLANKS, down: [41] }]);
  await expect(page.locator(PLANKS)).toHaveClass(/pressed/);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".craft-card.pressed")).toHaveCount(0);
  await synthTouches(page, [{ type: "touchend", id: 41, sel: PLANKS, down: [] }]);
  await page.waitForTimeout(300);
  s = await state(page);
  expect(invCount(s, B.planks)).toBe(0);
  expect(s.craft.open).toBe(true);
  // Le panneau répond toujours : la carte touchée fabrique.
  await synthTouches(page, [
    { type: "touchstart", id: 44, sel: PLANKS, down: [44] },
    { type: "touchend", id: 44, sel: PLANKS, down: [] },
  ]);
  await expect.poll(async () => invCount(await state(page), B.planks)).toBe(2);
  await page.evaluate(() => window.cubesDebug.closeCraft());
  expect(errors).toEqual([]);
});

test("fabrication, mise en page : la feuille au-dessus de la barre sans la couvrir, trois cartes assez grandes dans l'écran ; le marteau ne chevauche aucun bouton ; appui long panneau ouvert : anneau et pastilles entre la barre et la feuille @tactile", async ({ page, context }, testInfo) => {
  const errors = await openGame(page);
  const vp = page.viewportSize()!;
  // Le marteau et ses voisins, panneau fermé.
  if (isTouch(testInfo)) {
    const hammer = (await page.locator(".touch-btn.craft-touch").boundingBox())!;
    const others = page.locator(".touch-btn:visible:not(.craft-touch)");
    for (const b of await others.all()) expect(overlaps(hammer, (await b.boundingBox())!)).toBe(false);
    // De haut en bas : plein écran, marteau, Casser.
    const full = (await page.locator(".fullscreen-btn").boundingBox())!;
    const mode = (await page.locator(".touch-btn").first().boundingBox())!;
    expect(full.y + full.height).toBeLessThanOrEqual(hammer.y);
    expect(hammer.y + hammer.height).toBeLessThanOrEqual(mode.y);
    const bar = (await page.locator(".hotbar").boundingBox())!;
    expect(overlaps(hammer, bar)).toBe(false);
    expect(hammer.x + hammer.width).toBeLessThanOrEqual(vp.width);
  }
  const top = (await page.locator(".craft-btn").boundingBox())!;
  for (const b of await page.locator(".top-btn:visible:not(.craft-btn), .panel-toggle").all()) {
    expect(overlaps(top, (await b.boundingBox())!)).toBe(false);
  }
  // Panneau ouvert.
  await page.evaluate(() => window.cubesDebug.give(6, 1));
  expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
  await expect(page.locator(".craft")).toBeVisible();
  const sheet = (await page.locator(".craft-sheet").boundingBox())!;
  const bar = (await page.locator(".hotbar").boundingBox())!;
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(bar.y);
  expect(sheet.y).toBeGreaterThanOrEqual(0);
  const cards = page.locator(".craft-card");
  await expect(cards).toHaveCount(3);
  for (const c of await cards.all()) {
    const b = (await c.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(200);
    expect(b.height).toBeGreaterThanOrEqual(160);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    expect(inside(b, sheet)).toBe(true);
  }
  // La feuille, remontée pour l'anneau de l'appui long, tient sans défiler.
  const sheetScrolls = await page.evaluate(() => {
    const el = document.querySelector(".craft-sheet")!;
    return el.scrollHeight > el.clientHeight + 1;
  });
  expect(sheetScrolls).toBe(false);
  // La barre reste au-dessus du voile (on peut y vider une case).
  const z = await page.evaluate(() => {
    const r = document.querySelector(".hotbar")!.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".hotbar") !== null;
  });
  expect(z).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("fabrication.png") });
  // Relecture J8, constat 14 : la pastille « +2 » d'une fabrication, puis l'anneau d'un appui gardé sur une case,
  // tous deux au-dessus du voile, restent entre la barre et la feuille ; aucun ne couvre la ligne d'état.
  await page.evaluate(() => {
    for (const id of [2, 3, 5, 8]) window.cubesDebug.give(id, 3); // cases 2 à 5
  });
  expect(await craftPlanksDeltasRisen(page)).toMatchObject({ ok: true, outputSlot: 0 });
  const risen = await layoutBoxes(page, CRAFT_LAYOUT);
  expect(layoutProblems(risen, vp)).toEqual([]);
  expect(risen.map((b) => b.name)).toEqual(["feuille", "barre", "pastille"]);
  const held = await layoutBoxesDuringHold(page, CRAFT_LAYOUT, await slotPress(page, context, testInfo, 3));
  expect(layoutProblems(held, vp)).toEqual([]);
  expect(held.map((b) => b.name)).toEqual(expect.arrayContaining(["feuille", "barre", "anneau de l'appui long"]));
  await page.evaluate(() => window.cubesDebug.closeCraft());
  expect((await state(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test("fabrication pendant l'étape « 6 troncs » : les troncs de la mission sont gardés (rien ne bloque)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, "#monde=plat&graine=1&mission=1");
  await expect.poll(async () => (await state(page)).missionId).toBe("abri");
  await page.evaluate(() => window.cubesDebug.give(6, 3));
  expect(await page.evaluate(() => window.cubesDebug.craft("planches"))).toEqual({ ok: false, reason: "reserved" });
  expect(invCount(await state(page), B.log)).toBe(3);
  await expect(page.locator(".message")).toContainText("D'abord 6 troncs");
  expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
  expect((await state(page)).craft.cards[0]).toEqual({ id: "planches", state: "reserved" });
  await expect(page.locator('.craft-card[data-recipe="planches"] .craft-badge')).toContainText("3 / 6");
  await page.evaluate(() => window.cubesDebug.closeCraft());
  expect(errors).toEqual([]);
});

test("tutoriel : pas de marteau, la touche F ne fait rien", async ({ page }) => {
  const errors = await openGame(page, "#monde=plat&graine=1&mission=0");
  await expect.poll(async () => (await state(page)).missionId).toBe("tuto");
  await page.evaluate(() => window.cubesDebug.give(6, 2));
  await expect(page.locator(".craft-btn")).toBeHidden();
  await expect(page.locator(".touch-btn.craft-touch")).toBeHidden();
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.craft).toMatchObject({ available: false, open: false });
  expect(s.paused).toBe(false);
  expect(await page.evaluate(() => window.cubesDebug.craft("planches"))).toEqual({ ok: false, reason: "unavailable" });
  await expect(page.locator(".hint")).not.toContainText("fabriquer");
  expect(errors).toEqual([]);
});

test("découverte du marteau (partie d'enfant) : caché avant l'abri ; Pixel le présente à l'étape abri, il brille ; ouvert, il est retenu dans le profil, sans nouvelle présentation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(150_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2, tutorialDone: true },
    ] }));
    // Monde plat : mission 1 à l'étape « 4 pierres », 6 troncs dans le sac.
    localStorage.setItem("cubes:monde:p2:0", JSON.stringify({
      version: 1, gen: 2, type: "plat", seed: 1, edits: "",
      player: { x: 8.5, y: 4, z: 8.5, yaw: 0, pitch: 0 }, inventory: { slots: [[6, 6]] }, phase: 0.1, savedAt: Date.now(),
      mission: { id: "abri", step: 1, counts: {} },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  const play = async () => {
    await page.locator('.profile-card[data-profile="p2"]').click();
    await page.locator('.slot-card[data-slot="0"]').click();
    await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  };
  await play();
  let s = await state(page);
  expect(s.mission).toEqual({ step: 1, done: false });
  expect(s.craftSeen).toBe(false);
  // Avant l'abri : pas de marteau, F ne fait rien.
  await expect(page.locator(".craft-btn")).toBeHidden();
  await page.keyboard.press("KeyF");
  expect((await state(page)).craft.open).toBe(false);
  // Étape abri : au bout de 15 s, Pixel présente le marteau, qui brille.
  await page.evaluate(() => window.cubesDebug.give(3, 4));
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  await expect.poll(async () => (await state(page)).craft.intro, { timeout: 40_000 }).toBe(true);
  await expect(page.locator(".message")).toContainText("Nouveau : appuie sur F pour fabriquer des blocs.");
  await expect(page.locator(".craft-btn")).toBeVisible();
  await expect(page.locator(".craft-btn")).toHaveClass(/new/);
  await expect(page.locator(".hint")).toContainText("F : fabriquer");
  // L'ouverture retire le halo et retient la découverte dans le profil.
  await page.keyboard.press("KeyF");
  await expect(page.locator(".craft")).toBeVisible();
  s = await state(page);
  expect(s.craft.glow).toBe(false);
  expect(s.craftSeen).toBe(true);
  await expect(page.locator(".craft-btn")).not.toHaveClass(/new/);
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:profils") ?? "null"));
  expect(profiles.profiles[1].craftSeen).toBe(true);
  expect(profiles.profiles[0].craftSeen).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".craft")).toBeHidden();
  // Rechargement : le marteau est là d'emblée, sans halo ni nouvelle présentation.
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await play();
  s = await state(page);
  expect(s.mission?.step).toBe(2);
  expect(s.craftSeen).toBe(true);
  await expect(page.locator(".craft-btn")).toBeVisible();
  await page.waitForTimeout(17_000);
  s = await state(page);
  expect(s.craft).toMatchObject({ available: true, glow: false, intro: false });
  expect(errors).toEqual([]);
});

test("abri passé sans avoir ouvert le marteau (monde de la 1.0-rc, mission 1 finie, de jour) : la mission 2 commence, le marteau est là avec son halo, Pixel ne l'interrompt pas pour le présenter ; ouvert, il est retenu", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(90_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    // Profils écrits par la 1.0-rc : pas de craftSeen.
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2, tutorialDone: true },
    ] }));
    // Monde de la 1.0-rc : mission 1 finie (step 6), de jour (vers 11 h), pierres, sable et planches dans le sac.
    localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
      version: 1, gen: 2, type: "plat", seed: 1, edits: "",
      player: { x: 16.5, y: 4, z: 20.5, yaw: 0, pitch: 0 }, inventory: { slots: [[3, 5], [5, 5], [4, 5]] }, phase: 0.3, savedAt: Date.now(),
      mission: { id: "abri", step: 6, counts: {} },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  let s = await state(page);
  expect(s.missionId).toBe("mots");
  expect(s.craftSeen).toBe(false);
  expect(s.craft).toMatchObject({ available: true, glow: true, intro: false });
  await expect(page.locator(".craft-btn")).toBeVisible();
  await expect(page.locator(".craft-btn")).toHaveClass(/new/);
  await expect(page.locator(".hint")).toContainText("F : fabriquer");
  // Pixel ne présente pas le marteau pendant la mission 2 (sa présentation attend 15 s après le début d'une étape).
  await page.waitForTimeout(16_000);
  s = await state(page);
  expect(s.missionId).toBe("mots");
  expect(s.craft.intro).toBe(false);
  expect(s.spoken.some((t) => t.includes("fabriquer"))).toBe(false);
  // Ouvert : le verre se fabrique, le halo s'éteint, la découverte est retenue dans le profil.
  await page.keyboard.press("KeyF");
  await expect(page.locator(".craft")).toBeVisible();
  s = await state(page);
  expect(s.craft.cards.find((c) => c.id === "verre")?.state).toBe("ok");
  expect(s.craft.glow).toBe(false);
  expect(s.craftSeen).toBe(true);
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem("cubes:profils") ?? "null"));
  expect(profiles.profiles[0].craftSeen).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".craft")).toBeHidden();
  expect(errors).toEqual([]);
});

test("verre : fabriqué avec du sable et posé, on voit le ciel à travers (pas à travers une pierre) ; il arrête le joueur ; cassé, il revient dans le sac ; une fleur s'y pose", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  await page.evaluate(() => window.cubesDebug.give(5, 1));
  expect(await page.evaluate(() => window.cubesDebug.craft("verre"))).toMatchObject({ ok: true, before: 0, after: 2 });
  let s = await state(page);
  expect(invCount(s, B8.glass)).toBe(2);
  expect(invCount(s, B.sand)).toBe(0);
  await expect(page.locator(".message")).toContainText("Le sable devient du verre");
  // Une vitre à hauteur des yeux, posée contre un bloc de support qu'on retire ensuite.
  const cx = Math.floor(s.player.x);
  const cz = Math.floor(s.player.z);
  await page.evaluate(([x, z]) => {
    window.cubesDebug.teleport(x + 0.5, 4, z + 0.5);
    window.cubesDebug.setBlock(x, 6, z - 3, 3);
  }, [cx, cz] as const);
  await page.waitForTimeout(300);
  const eyeY = (await state(page)).camera.y;
  const lookAt = (y: number, dist: number) =>
    page.evaluate(([a]) => window.cubesDebug.look(0, a), [(Math.atan2(y - eyeY, dist) * 180) / Math.PI] as const);
  await lookAt(6.5, 2.5);
  await expect.poll(async () => (await state(page)).target).toMatchObject({ x: cx, y: 6, z: cz - 3, nz: 1 });
  await page.evaluate(() => {
    const inv = window.cubesDebug.state().inventory;
    window.cubesDebug.selectSlot(inv.findIndex((c) => c?.id === 17));
    window.cubesDebug.placeBlock();
  });
  expect(await blockAt(page, { x: cx, y: 6, z: cz - 2 })).toBe(B8.glass);
  await expect(page.locator(".message")).toContainText("On voit à travers !");
  await page.evaluate(([x, z]) => window.cubesDebug.setBlock(x, 6, z - 3, 0), [cx, cz] as const);
  // Regard au centre de la vitre : le ciel bleu à travers ; une pierre au même endroit, non.
  await lookAt(6.5, 2);
  await expect.poll(async () => (await state(page)).target).toMatchObject({ x: cx, y: 6, z: cz - 2 });
  await page.waitForTimeout(400);
  const through = await pixel(page, 0.5, 0.5);
  await page.evaluate(([x, z]) => window.cubesDebug.setBlock(x, 6, z - 2, 3), [cx, cz] as const);
  await page.waitForTimeout(400);
  const stone = await pixel(page, 0.5, 0.5);
  expect(through[2]!).toBeGreaterThan(through[0]! + 30);
  expect(stone[2]! - stone[0]!).toBeLessThan(30);
  await page.evaluate(([x, z]) => window.cubesDebug.setBlock(x, 6, z - 2, 0), [cx, cz] as const);
  // Un mur de verre de deux blocs : le joueur ne le traverse pas.
  await page.evaluate(([x, z]) => {
    window.cubesDebug.setBlock(x, 4, z - 2, 17);
    window.cubesDebug.setBlock(x, 5, z - 2, 17);
    window.cubesDebug.look(0, 0);
  }, [cx, cz] as const);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1000);
  await page.keyboard.up("KeyW");
  s = await state(page);
  expect(s.player.z).toBeGreaterThan(cz - 1);
  expect(s.player.z).toBeLessThan(cz);
  // Cassé, le verre revient dans le sac.
  await page.evaluate(([x, z]) => window.cubesDebug.breakBlock(x, 5, z - 2), [cx, cz] as const);
  expect(invCount(await state(page), B8.glass)).toBe(2);
  await expect(page.locator(".message")).toContainText(/blocs? de verre/);
  // Une fleur se pose sur le verre.
  await page.evaluate(([x, z]) => {
    window.cubesDebug.give(9, 1);
    window.cubesDebug.teleport(x + 0.5, 4, z + 0.5);
  }, [cx, cz] as const);
  await lookAt(5, 2);
  await expect.poll(async () => (await state(page)).target).toMatchObject({ x: cx, y: 4, z: cz - 2, ny: 1 });
  await page.evaluate(() => {
    const inv = window.cubesDebug.state().inventory;
    window.cubesDebug.selectSlot(inv.findIndex((c) => c?.id === 9));
    window.cubesDebug.placeBlock();
  });
  expect(await blockAt(page, { x: cx, y: 5, z: cz - 2 })).toBe(B.flowerRed);
  expect(errors).toEqual([]);
});

// ---------- V2 lot 1 : mission 2 « Les mots » ----------

/** Mission 2 forcée par l'adresse (monde plat, lecteur débutant). */
const M2 = "#monde=plat&graine=1&mission=2";

/** Identifiant du bloc-lettre d'une capitale (A = 18 … Z = 43). */
const letterId = (ch: string) => 18 + ch.charCodeAt(0) - 65;

const reversedWord = (w: string) => Array.from(w).reverse().join("");

/**
 * Pose un mot en blocs-lettres (accès de test) au sol du monde plat (y = 4), sur la rangée z, de x0 vers +X : de
 * gauche à droite pour l'enfant de l'apparition (16,5 ; 20,5), qui regarde vers −Z.
 */
async function writeWord(page: Page, word: string, x0: number, z: number): Promise<void> {
  await page.evaluate(
    ([w, x, zz]) => {
      for (let i = 0; i < w.length; i++) window.cubesDebug.setBlock(x + i, 4, zz, 18 + w.charCodeAt(i) - 65);
    },
    [word, x0, z] as const,
  );
}

const checkWriting = (page: Page) => page.evaluate(() => window.cubesDebug.checkWriting());

/** Pose une lettre (accès de test, sans relecture) dans une case. */
const putLetter = (page: Page, c: readonly [number, number, number], ch: string) =>
  page.evaluate(([x, y, z, id]) => window.cubesDebug.setBlock(x, y, z, id), [c[0], c[1], c[2], letterId(ch)] as const);

/** Œil de l'enfant au-dessus des pieds (PLAYER.eyeHeight). */
const EYE_HEIGHT = 1.62;

/**
 * Pose une lettre dans une case comme l'enfant, sans bouger les pieds : la lettre choisie, la croix pointée vers une
 * face voisine de la case (le sol dessous d'abord, quelques points par face) jusqu'à ce que la visée du jeu (portée
 * comprise) désigne cette case, puis un clic droit (placeBlock, règles du jeu). Renvoie false si aucune visée n'y pose.
 */
async function aimAndPlace(page: Page, c: readonly [number, number, number], ch: string): Promise<boolean> {
  expect(await page.evaluate((l) => window.cubesDebug.chooseLetter(l), ch)).toBe(true);
  const p = (await state(page)).player;
  const eye = { x: p.x, y: p.y + EYE_HEIGHT, z: p.z };
  const faces = [
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [1, 0, 0],
    [-1, 0, 0],
  ] as const;
  const points = [
    [0.5, 0.5],
    [0.2, 0.2],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.8, 0.8],
  ] as const;
  for (const [ox, oy, oz] of faces) {
    for (const [u, v] of points) {
      const px = ox !== 0 ? c[0] + (ox > 0 ? 1 : 0) : c[0] + u;
      const py = oy !== 0 ? c[1] + (oy > 0 ? 1 : 0) : c[1] + (ox !== 0 ? u : v);
      const pz = oz !== 0 ? c[2] + (oz > 0 ? 1 : 0) : c[2] + v;
      const dx = px - eye.x;
      const dy = py - eye.y;
      const dz = pz - eye.z;
      const yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
      await page.evaluate(([y, pi]) => window.cubesDebug.look(y, pi), [yaw, pitch] as const);
      await page.evaluate(`(async () => { ${FRAMES(2)} })()`);
      const t = (await state(page)).target;
      if (!t || t.x + t.nx !== c[0] || t.y + t.ny !== c[1] || t.z + t.nz !== c[2]) continue;
      await page.evaluate(() => window.cubesDebug.placeBlock());
      return (await page.evaluate(([x, y, z]) => window.cubesDebug.block(x, y, z), c)) === letterId(ch);
    }
  }
  return false;
}

/** Passe l'étape en cours (accès de test) et attend la suivante (la mission avance après la consigne en cours). */
async function skipStep(page: Page): Promise<void> {
  const before = (await state(page)).mission!.step;
  expect(await page.evaluate(() => window.cubesDebug.skipMissionStep())).toBe(true);
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(before + 1);
}

/** Attend que la consigne de l'étape d'écriture ait été dite ; renvoie le mot à écrire. */
async function writingTarget(page: Page): Promise<string> {
  await expect.poll(async () => (await state(page)).writing?.announced ?? false, { timeout: 20_000 }).toBe(true);
  return (await state(page)).writing!.target;
}

test("mission 2, débutant : une lettre posée valide l'étape 0 ; mot 1 avec cases claires et modèle, lettre fausse signalée puis corrigée ; mot gardé même cassé ; mot collé validé avec le conseil d'espace", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  const errors = await openGame(page, M2);
  let s = await state(page);
  expect(s.missionId).toBe("mots");
  expect(s.letters).toEqual({ unlocked: true, open: false, hand: null, selected: false });
  await expect(page.locator(".slot.letters")).toBeVisible();
  await expect(page.locator(".slot.letters")).toHaveClass(/pulse-hint/);
  await expect(page.locator("#app")).toHaveClass(/letters-on/);
  // Étape 0 : « ABC » dans le bandeau, compteur 0 / 1 ; aide d'écran avec la touche 0.
  await expect(page.locator(".companion-block.word")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".companion-progress")).toHaveText("0 / 1");
  await expect(page.locator(".hint")).toContainText("0 : lettres");
  // Une lettre choisie puis posée devant soi : rien n'est pris dans le sac.
  expect(await page.evaluate(() => window.cubesDebug.chooseLetter("m"))).toBe(true);
  s = await state(page);
  expect(s.letters).toMatchObject({ hand: "M", selected: true, open: false });
  expect(s.paused).toBe(false);
  await expect(page.locator(".slot-name")).toHaveText("lettre M");
  await expect(page.locator(".slot.letters")).toHaveClass(/selected/);
  await page.evaluate(() => window.cubesDebug.look(0, -50));
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  const inv = (await state(page)).inventory;
  await page.evaluate(() => window.cubesDebug.placeBlock());
  expect(await page.evaluate(() => window.cubesDebug.countBlocks(30))).toBe(1);
  expect((await state(page)).inventory).toEqual(inv);
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(1);
  // Mot 1 : modèle dans le bandeau (lettre suivante entourée), cases claires devant l'enfant dès la consigne.
  await page.evaluate(() => window.cubesDebug.look(0, 0));
  const target = await writingTarget(page);
  expect(target).toMatch(/^[A-Z]{3,4}$/);
  s = await state(page);
  expect(s.writing).toMatchObject({ mode: "copy", have: 0, ghosts: target.length });
  await expect(page.locator(".companion-model .model-letter")).toHaveCount(target.length);
  await expect(page.locator(".companion-model .model-letter").first()).toHaveClass(/next/);
  expect(s.companionText).toContain(target);
  // Une lettre fausse : contour orange et « Ici, il faut un … ».
  const wrong = target[1] === "X" ? "Y" : "X";
  await writeWord(page, `${target[0]}${wrong}`, 15, 16);
  expect(await checkWriting(page)).toMatchObject({ found: false, key: "WRONG_LETTER", have: 1, wrongCells: 1 });
  expect((await state(page)).writing).toMatchObject({ have: 1, wrongCells: 1 });
  await expect(page.locator(".message")).toContainText(`Ici, il faut un ${target[1]}.`);
  await expect(page.locator(".companion-model .model-letter.done")).toHaveCount(1);
  // Corrigée : la lettre fausse cassée (elle ne rapporte rien), puis la fin du mot.
  await page.evaluate(() => window.cubesDebug.breakBlock(16, 4, 16));
  expect((await state(page)).inventory).toEqual(inv);
  expect((await state(page)).writing?.wrongCells).toBe(0);
  await writeWord(page, target.slice(1), 16, 16);
  expect(await checkWriting(page)).toMatchObject({ found: true });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  s = await state(page);
  expect(s.words).toEqual([target]);
  expect(s.spoken.some((t) => t.includes("Bravo") && t.toLowerCase().includes(target.toLowerCase()))).toBe(true);
  // Casser une lettre du mot ne le retire pas des mots écrits.
  await page.evaluate(() => window.cubesDebug.breakBlock(15, 4, 16));
  expect((await state(page)).words).toEqual([target]);
  await page.evaluate(([x, id]) => window.cubesDebug.setBlock(x, 4, 16, id), [15, letterId(target[0]!)] as const);
  // Mot 2 collé au mot 1, sans espace : validé, puis « Un espace entre les mots ! ».
  const target2 = await writingTarget(page);
  expect(target2).not.toBe(target);
  await writeWord(page, target2, 15 + target.length, 16);
  expect(await checkWriting(page)).toMatchObject({ found: true });
  await expect(page.locator(".message")).toContainText("Un espace entre les mots", { timeout: 15_000 });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(3);
  expect((await state(page)).words).toEqual([target, target2]);
  expect(errors).toEqual([]);
});

test("mission 2 : un mot écrit à l'envers pour l'enfant est validé (« Fais le tour pour lire ! ») ; sans progrès, l'aide trace les cases claires puis met la lettre dans la main", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  const errors = await openGame(page, M2);
  await skipStep(page);
  const target = await writingTarget(page);
  // À l'envers vu de l'enfant : le mot ne se lit que de l'autre côté de la rangée.
  await writeWord(page, reversedWord(target), 15, 16);
  expect(await checkWriting(page)).toMatchObject({ found: true });
  await expect(page.locator(".message")).toContainText("Fais le tour pour lire", { timeout: 15_000 });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  // Mot 2 : rien au départ ; 31 s sans progrès, la ligne de cases claires ; 50 s, la lettre attendue est en main.
  // Regard vers +Z, où la place est libre (vers −Z, le mot 1 est devant : pas de ligne derrière lui).
  await page.evaluate(() => window.cubesDebug.look(180, 0));
  const target2 = await writingTarget(page);
  let s = await state(page);
  expect(s.writing).toMatchObject({ stage: 0, ghosts: 0 });
  expect(s.letters.hand).toBeNull();
  expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(31_000))).toBe(true);
  s = await state(page);
  expect(s.writing).toMatchObject({ stage: 2, ghosts: target2.length });
  await expect(page.locator(".message")).toContainText("Remplis les cases claires");
  expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(20_000))).toBe(true);
  s = await state(page);
  expect(s.letters).toMatchObject({ hand: target2[0], selected: true });
  await expect(page.locator(".message")).toContainText(`Voici la lettre ${target2[0]}`);
  expect(errors).toEqual([]);
});

test("mission 2, cases claires : une lettre fausse dans la première case est signalée et la ligne reste en place ; trois mots écrits de suite dans leurs cases, sans bouger les pieds (visée et clic droit), sont tous trouvés", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  const errors = await openGame(page, M2);
  // Dos au mur de planches du monde plat (z = 12) : vers +Z, la place devant l'enfant est libre sur 10 blocs.
  await page.evaluate(() => window.cubesDebug.look(180, 0));
  await skipStep(page);
  const target = await writingTarget(page);
  let s = await state(page);
  const line = s.writing!.ghostCells;
  expect(line).toHaveLength(target.length);
  // Une lettre fausse dans la case de la première lettre : « Ici, il faut un … », contour orange, la ligne ne bouge pas.
  const wrong = target[0] === "B" ? "C" : "B";
  await putLetter(page, line[0]!, wrong);
  expect(await checkWriting(page)).toMatchObject({ found: false, key: "WRONG_LETTER", have: 0, wrongCells: 1 });
  await expect(page.locator(".message")).toContainText(`Ici, il faut un ${target[0]}.`);
  expect((await state(page)).writing?.ghostCells).toEqual(line.slice(1));
  // Cassée : la ligne entière revient, au même endroit.
  await page.evaluate(([x, y, z]) => window.cubesDebug.breakBlock(x, y, z), line[0]!);
  s = await state(page);
  expect(s.writing).toMatchObject({ wrongCells: 0, ghostCells: line });
  // La deuxième lettre posée d'abord, à sa place : rien à dire, la ligne reste.
  await putLetter(page, line[1]!, target[1]!);
  expect(await checkWriting(page)).toMatchObject({ found: false, key: null, have: 0, wrongCells: 0 });
  expect((await state(page)).writing?.ghostCells).toEqual([line[0], ...line.slice(2)]);
  await putLetter(page, line[0]!, target[0]!);
  expect(await checkWriting(page)).toMatchObject({ have: 2, key: null });
  for (let k = 2; k < target.length; k++) await putLetter(page, line[k]!, target[k]!);
  expect(await checkWriting(page)).toMatchObject({ found: true });
  await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(2);
  // Mots 2 et 3, depuis la même place : pas de ligne derrière un mot déjà écrit ; s'il n'y a pas de place à portée là
  // où il regarde, l'enfant tourne la tête et la ligne se trace. Chaque lettre se pose en visant, depuis là.
  const feet = (await state(page)).player;
  for (const step of [2, 3]) {
    const word = await writingTarget(page);
    await page.evaluate(() => window.cubesDebug.look(180, 0));
    expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(31_000))).toBe(true);
    let cells = (await state(page)).writing!.ghostCells;
    for (const yaw of [90, -90, 0]) {
      if (cells.length > 0) break;
      await page.evaluate((y) => window.cubesDebug.look(y, 0), yaw);
      // La ligne est réessayée toutes les 0,5 s tant qu'il n'y en a pas.
      for (let i = 0; i < 8 && cells.length === 0; i++) {
        await page.waitForTimeout(250);
        cells = (await state(page)).writing!.ghostCells;
      }
    }
    expect(cells, word).toHaveLength(word.length);
    for (let k = 0; k < word.length; k++) {
      expect(await aimAndPlace(page, cells[k]!, word[k]!), `${word} : ${word[k]} en ${cells[k]!.join(", ")}`).toBe(true);
      // La dernière lettre posée, le jeu relit lui-même le mot et le trouve (l'étape passe à la suivante).
      if (k < word.length - 1) expect(await checkWriting(page), `${word} : ${k + 1} lettre(s)`).toMatchObject({ found: false, key: null, have: k + 1 });
    }
    await expect.poll(async () => (await state(page)).words, { timeout: 10_000 }).toContain(word);
    await expect.poll(async () => (await state(page)).mission?.step, { timeout: 20_000 }).toBe(step + 1);
  }
  // Les pieds n'ont pas bougé.
  const after = (await state(page)).player;
  expect([after.x, after.y, after.z]).toEqual([feet.x, feet.y, feet.z]);
  expect((await state(page)).words).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("mission 2 : pas de place à portée pour les cases claires là où regarde l'enfant : Pixel dit la lettre suivante, puis de se tourner vers un sol plat, pas « Remplis les cases claires » ; la tête tournée, la ligne se trace", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  const errors = await openGame(page, M2);
  // Au bord du monde, face à la mer (+Z) : aucune case devant lui.
  await page.evaluate(() => {
    window.cubesDebug.teleport(16.5, 4.01, 29.5);
    window.cubesDebug.look(180, 0);
  });
  await skipStep(page);
  const target = await writingTarget(page);
  let s = await state(page);
  expect(s.writing).toMatchObject({ have: 0, ghosts: 0 });
  expect(s.writing!.help.ghostLine).toBe(true);
  // 26 s sans progrès : la lettre suivante.
  expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(26_000))).toBe(true);
  await expect(page.locator(".message")).toContainText(`Maintenant, la lettre ${target[0]}`);
  // 31 s : l'aide des cases claires tombe, mais il n'y en a pas : pas « Remplis les cases claires », ni la lettre
  // suivante redite 5 s après, mais le geste qui fait tracer la ligne.
  expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(5_000))).toBe(true);
  await expect(page.locator(".message")).toContainText("Tourne-toi vers un sol plat");
  s = await state(page);
  expect(s.writing?.ghosts).toBe(0);
  expect(s.spoken.at(-1)).toContain("Tourne-toi vers un sol plat");
  expect(s.spoken.filter((t) => t.startsWith("Maintenant, la lettre"))).toHaveLength(1);
  expect(s.spoken.some((t) => /Remplis les cases claires|Pose les lettres dans les cases claires/.test(t))).toBe(false);
  await expect(page.locator(".message")).not.toContainText("Remplis");
  // Il se retourne (vers −Z, la place est libre) : la ligne se trace sans autre geste, et chaque case se vise d'ici.
  await page.evaluate(() => window.cubesDebug.look(0, 0));
  await expect.poll(async () => (await state(page)).writing?.ghosts, { timeout: 5000 }).toBe(target.length);
  const cells = (await state(page)).writing!.ghostCells;
  for (let k = 0; k < target.length; k++) expect(await aimAndPlace(page, cells[k]!, target[k]!), `${target[k]}`).toBe(true);
  // La dernière lettre posée, le jeu relit lui-même le mot et le trouve.
  await expect.poll(async () => (await state(page)).words).toEqual([target]);
  expect(errors).toEqual([]);
});

test("mission 2, étape « prénom » : un prénom déjà écrit devant l'enfant valide l'étape dès son début, sans autre pose", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    // Monde plat en mission 2, au troisième mot (l'étape « prénom » suit).
    localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
      version: 1, gen: 2, type: "plat", seed: 1, edits: "",
      player: { x: 16.5, y: 4.01, z: 20.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.1, savedAt: Date.now(),
      mission: { id: "mots", step: 3, counts: {}, words: ["AMI", "LUNE"] },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  expect((await state(page)).mission).toEqual({ step: 3, done: false });
  // Pendant le troisième mot, l'enfant écrit son prénom (sans accent) devant lui ; rien ne le relit (pose de test).
  await writeWord(page, "LEA", 15, 16);
  await skipStep(page);
  // Étape « prénom » : le mot est relu à son début ; validée sans nouvelle pose, sans consigne ni aide à faux.
  await expect.poll(async () => (await state(page)).mission, { timeout: 20_000 }).toEqual({ step: 5, done: true });
  const s = await state(page);
  expect(s.words).toHaveLength(4);
  expect(s.words.slice(0, 2)).toEqual(["AMI", "LUNE"]);
  expect(s.words[3]).toBe("LEA");
  expect(s.spoken.some((t) => t.includes("Léa") && t.includes("Bravo"))).toBe(true);
  expect(s.spoken.some((t) => t.startsWith("Écris ton prénom") || t.startsWith("Maintenant"))).toBe(false);
  expect(errors).toEqual([]);
});

test("mission 2, prénom de 10 lettres regardé droit devant, sol plat : la case suivante au palier 1, toute la ligne au palier 2, chaque lettre se pose sans bouger et le prénom est trouvé", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(150_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Maximilien", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    localStorage.setItem("cubes:reglages", JSON.stringify({ night: "normale", creatures: false, devTools: true }));
    // Monde plat en mission 2, à l'étape « prénom », debout au milieu, regard droit devant (vers −Z).
    localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
      version: 1, gen: 2, type: "plat", seed: 1, edits: "",
      player: { x: 16.5, y: 4.01, z: 20.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.1, savedAt: Date.now(),
      mission: { id: "mots", step: 4, counts: {}, words: ["AMI", "LUNE", "TOIT"] },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  const target = await writingTarget(page);
  expect(target).toBe("MAXIMILIEN");
  await page.evaluate(() => window.cubesDebug.look(0, 0));
  // Palier 1 (15 s sans rien poser) : la case de la première lettre, sans tourner la tête.
  expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(16_000))).toBe(true);
  await expect.poll(async () => (await state(page)).writing?.ghosts, { timeout: 5000 }).toBe(1);
  expect((await state(page)).writing?.stage).toBe(1);
  // Palier 2 (30 s) : toute la ligne, et la consigne des cases claires (il y en a).
  expect(await page.evaluate(() => window.cubesDebug.advanceWritingClock(15_000))).toBe(true);
  await expect.poll(async () => (await state(page)).writing?.ghosts, { timeout: 5000 }).toBe(10);
  await expect(page.locator(".message")).toContainText("Remplis les cases claires");
  const cells = (await state(page)).writing!.ghostCells;
  const feet = (await state(page)).player;
  // Devant lui (vers −Z) et en travers de son regard.
  for (const [, , z] of cells) expect(z).toBeLessThan(feet.z - 1);
  expect(Math.min(...cells.map((c) => c[0]))).toBeLessThan(feet.x);
  expect(Math.max(...cells.map((c) => c[0]))).toBeGreaterThan(feet.x);
  for (let k = 0; k < target.length; k++) {
    expect(await aimAndPlace(page, cells[k]!, target[k]!), `${target[k]} en ${cells[k]!.join(", ")}`).toBe(true);
  }
  await expect.poll(async () => (await state(page)).words, { timeout: 10_000 }).toContain("MAXIMILIEN");
  const after = (await state(page)).player;
  expect([after.x, after.y, after.z]).toEqual([feet.x, feet.y, feet.z]);
  expect(errors).toEqual([]);
});

test("mission 2, lecteur autonome : le mot est dicté même voix coupée, sans être écrit ; un essai faux reçoit un retour et un indice ; sans voix française, c'est une copie du mot affiché", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  const errors = await openGame(page, `${M2}&lecture=autonome`);
  let s = await state(page);
  expect(s.level).toBe("autonome");
  expect(s.voice).toBe(false);
  await page.evaluate(() => window.cubesDebug.assumeVoice(true));
  await skipStep(page);
  const target = await writingTarget(page);
  expect(target).toMatch(/^[A-Z]{5}$/);
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.toLowerCase().includes(target.toLowerCase()))).toBe(true);
  s = await state(page);
  expect(s.writing).toMatchObject({ mode: "dictation", stage: 0, help: { model: "none" } });
  expect(s.companionText).toBe("Écris le mot que j'ai dit.");
  await expect(page.locator(".companion-model")).toBeHidden();
  // Un essai faux (une lettre changée) : retour sans dire où, le mot redit, et l'aide monte d'un palier (les cases).
  const wrong = `${target[0]}${target[1] === "X" ? "Y" : "X"}${target.slice(2)}`;
  await writeWord(page, wrong, 14, 16);
  expect(await checkWriting(page)).toMatchObject({ found: false, key: "DICT_WRONG", newTry: true, wrongCells: 0 });
  await expect(page.locator(".message")).toContainText("Presque ! La deuxième lettre n'est pas la bonne.");
  s = await state(page);
  expect(s.writing).toMatchObject({ stage: 1, help: { model: "boxes" } });
  await expect(page.locator(".companion-model .model-letter.box")).toHaveCount(target.length);
  // Le mot redit (dictée : après la fin de la dictée en cours).
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.startsWith("Écoute bien")), { timeout: 15_000 }).toBe(true);
  // Une lettre en trop au milieu du mot : « une lettre en trop dans ton mot » (et pas « le mot est là »).
  await writeWord(page, `${target.slice(0, 3)}${target[2]}${target.slice(3)}`, 14, 13);
  expect(await checkWriting(page)).toMatchObject({ found: false, key: "DICT_EXTRA", newTry: true, wrongCells: 0 });
  await expect(page.locator(".message")).toContainText("Presque ! Il y a une lettre en trop dans ton mot.");
  // Sans voix française : le mot suivant est une copie, et le jeu le dit.
  await page.evaluate(() => window.cubesDebug.assumeVoice(false));
  await skipStep(page);
  const target2 = await writingTarget(page);
  await expect(page.locator(".message")).toContainText("Je n'ai pas de voix ici");
  s = await state(page);
  expect(s.writing?.mode).toBe("copy");
  expect(s.companionText).toBe(`Recopie le mot : ${target2}.`);
  expect(errors).toEqual([]);
});

test("dictée en attente puis panneau de fabrication ouvert : le mot redit est lu sous le panneau, voix coupée (décision 13)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(90_000);
  const errors = await openGame(page, `${M2}&lecture=autonome`);
  expect((await state(page)).voice).toBe(false);
  await page.evaluate(() => window.cubesDebug.assumeVoice(true));
  await skipStep(page);
  const target = await writingTarget(page);
  const wrong = `${target[0]}${target[1] === "X" ? "Y" : "X"}${target.slice(2)}`;
  await writeWord(page, wrong, 14, 16);
  expect((await state(page)).spoken.some((t) => t.startsWith("Écoute bien"))).toBe(false);
  // Dans la même tâche : « répète » (la dictée du mot occupe la voix quelques secondes), l'essai faux (« Écoute
  // bien… » attend sa fin), puis le marteau (constat 10 de la revue du J8 : l'ouverture annulait la dictée en attente).
  const r = await page.evaluate(() => {
    (document.querySelector(".companion-repeat") as HTMLButtonElement).click();
    const check = window.cubesDebug.checkWriting();
    const opened = window.cubesDebug.openCraft();
    return { key: check?.key ?? null, opened, listened: window.cubesDebug.state().spoken.some((t) => t.startsWith("Écoute bien")) };
  });
  expect(r).toEqual({ key: "DICT_WRONG", opened: true, listened: false });
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.startsWith("Écoute bien")), { timeout: 15_000 }).toBe(true);
  const s = await state(page);
  expect(s.craft.open).toBe(true);
  expect(s.spoken.at(-1)?.toLowerCase()).toContain(target.toLowerCase());
  await page.evaluate(() => window.cubesDebug.closeCraft());
  expect(errors).toEqual([]);
});

test("mission 2 jusqu'au bout : félicitations avec chaque mot écrit en lettres-blocs, et le cadeau", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  test.setTimeout(120_000);
  const errors = await openGame(page, M2);
  for (let i = 0; i < 5; i++) await skipStep(page);
  let s = await state(page);
  expect(s.mission).toEqual({ step: 5, done: true });
  expect(s.words).toHaveLength(4);
  await expect(page.locator(".celebration")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".celebration-recap li")).toHaveText([...s.words.map((w) => w.toLowerCase()), "Cadeau : 5 blocs arc-en-ciel !"]);
  await expect(page.locator(".celebration-word")).toHaveCount(4);
  await expect(page.locator(".celebration-subtitle")).toHaveText("Tes mots sont bien écrits.");
  await expect.poll(async () => (await state(page)).spoken.some((t) => t.includes("Tu as écrit :"))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("felicitations-mots.png") });
  const button = page.getByRole("button", { name: "Continuer" });
  await expect(button).toBeEnabled({ timeout: 5_000 });
  await button.click();
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(invCount(s, B6.rainbow)).toBe(5);
  // Jeu libre : la case ABC reste dans ce monde.
  expect(s.letters.unlocked).toBe(true);
  expect(errors).toEqual([]);
});

test("accueil : un monde dont la mission 2 est réussie porte deux étoiles ; une mission 2 reprise garde son mot ; le mode parent liste les mots écrits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    const world = (mission: object) => JSON.stringify({
      version: 1, gen: 2, type: "prairie", seed: 1234, edits: "",
      player: { x: 64.5, y: 30, z: 64.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.1, savedAt: Date.now(), mission,
    });
    localStorage.setItem("cubes:monde:p1:0", world({ id: "mots", step: 5, counts: {}, words: ["AMI", "LUNE", "TOIT", "LEA"] }));
    localStorage.setItem("cubes:monde:p1:1", world({ id: "mots", step: 2, counts: {}, words: ["SOL"], word: "MOTO" }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toHaveText("★★");
  await expect(page.locator('.slot-card[data-slot="0"] .card-star')).toHaveAttribute("aria-label", "2 missions réussies");
  await expect(page.locator('.slot-card[data-slot="1"] .card-star')).toHaveText("★");
  await expect(page.locator('.slot-card[data-slot="1"] .card-star')).toHaveAttribute("aria-label", "1 mission réussie");
  // La mission 2 en cours reprend à son étape, avec son mot, et la case ABC.
  await page.locator('.slot-card[data-slot="1"]').click();
  await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  let s = await state(page);
  expect(s.missionId).toBe("mots");
  expect(s.mission).toEqual({ step: 2, done: false });
  expect(s.letters.unlocked).toBe(true);
  expect(s.writing?.target).toBe("MOTO");
  expect(s.words).toEqual(["SOL"]);
  // Mode parent : progression avec les mots écrits.
  await page.locator(".home-btn").click();
  const gear = page.locator(".parent-gear");
  const box = (await gear.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator(".home h1")).toHaveText("Mode parent", { timeout: 5_000 });
  await page.mouse.up();
  await expect(page.locator(".parent-progress li")).toHaveText([
    "Monde 1 (prairie) : mission 2 (les mots) réussie — mots écrits : AMI, LUNE, TOIT, LEA",
    "Monde 2 (prairie) : mission 2 (les mots) : étape 3 sur 5 (écrire un deuxième mot) — mots écrits : SOL",
  ]);
  s = await state(page);
  expect(s.home).toBe(true);
  expect(errors).toEqual([]);
});

test("mission 2 au doigt : la case ABC ouvre la boîte (26 grosses lettres, sans défilement) ; une lettre choisie passe en main avec le mode Poser ; la barre à 10 cases ne chevauche ni le rond ni les boutons @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  test.setTimeout(90_000);
  const vp = page.viewportSize()!;
  const rect = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const bottomGap = async (sel: string) => {
    const b = await rect(sel);
    return vp.height - (b.y + b.height);
  };
  // Sans lettres (mission 1) : la disposition de la V1.
  const errors1 = await openGame(page, "#monde=plat&graine=1&mission=1");
  await expect(page.locator(".slot.letters")).toBeHidden();
  await expect(page.locator("#app")).not.toHaveClass(/letters-on/);
  expect(Math.round(await bottomGap(".joystick"))).toBe(28);
  expect(Math.round(await bottomGap(".touch-buttons"))).toBe(28);
  expect(errors1).toEqual([]);
  // Mission 2 : dix cases, sans chevauchement ; en portrait, le rond et les boutons remontent.
  await page.goto("about:blank");
  const errors = await openGame(page, M2);
  await expect(page.locator(".slot.letters")).toBeVisible();
  const bar = await rect(".hotbar");
  expect(overlaps(bar, await rect(".joystick"))).toBe(false);
  expect(overlaps(bar, await rect(".touch-buttons"))).toBe(false);
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.x + bar.width).toBeLessThanOrEqual(vp.width);
  if (vp.width <= 1120) expect(await bottomGap(".joystick")).toBeGreaterThan(bar.height + 14);
  else expect(Math.round(await bottomGap(".joystick"))).toBe(28);
  // La case ABC touchée : la boîte s'ouvre, le jeu se fige.
  const touch = await touchDriver(context, page);
  const abc = await rect(".slot.letters");
  await touch.tap(abc.x + abc.width / 2, abc.y + abc.height / 2);
  await expect(page.locator(".letter-tray")).toBeVisible();
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  let s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.letters.open).toBe(true);
  const keys = page.locator(".tray-key");
  await expect(keys).toHaveCount(26);
  for (const k of await keys.all()) {
    const b = (await k.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(64);
    expect(b.height).toBeGreaterThanOrEqual(64);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  }
  const scrolls = await page.evaluate(() => {
    const c = document.querySelector(".letter-tray-card")!;
    return c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1;
  });
  expect(scrolls).toBe(false);
  await expect(page.locator(".letter-tray-keyboard")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("boite-a-lettres.png") });
  // C choisi : en main, mode Poser, boîte fermée.
  const c = await rect('.tray-key[data-letter="C"]');
  await touch.tap(c.x + c.width / 2, c.y + c.height / 2);
  await expect.poll(async () => (await state(page)).letters.hand).toBe("C");
  s = await state(page);
  expect(s.letters).toMatchObject({ open: false, selected: true });
  expect(s.touchMode).toBe("place");
  expect(s.paused).toBe(false);
  await expect(page.locator(".letter-tray")).toBeHidden();
  await expect(page.locator(".slot.letters canvas.letters-tile")).toBeVisible();
  expect(errors).toEqual([]);
});

test("au doigt : le mode Poser pris par une lettre (mission 2) ne passe pas à la partie suivante ; toute partie d'enfant, et un nouveau monde en mode adresse, commence en mode Casser", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  test.setTimeout(120_000);
  // Mode adresse : une lettre choisie passe au mode Poser ; « Nouveau monde » repart en mode Casser.
  let errors = await openGame(page, M2);
  expect(await page.evaluate(() => window.cubesDebug.chooseLetter("A"))).toBe(true);
  expect((await state(page)).touchMode).toBe("place");
  await page.evaluate(() => window.cubesDebug.newWorld("plat", 2));
  await page.waitForFunction(() => !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  expect((await state(page)).touchMode).toBe("break");
  await expect(page.locator(".touch-btn").first()).toHaveText("Casser");
  expect(errors).toEqual([]);
  // Partie d'enfant : Léa (mission 2) choisit une lettre puis revient à l'accueil ; Tom reprend son monde, à l'étape
  // « 6 troncs » de la mission 1 : mode Casser (constat 3 de la revue du J8 : il restait en mode Poser).
  await page.goto("about:blank");
  errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2, tutorialDone: true },
    ] }));
    const world = (mission: object) => JSON.stringify({
      version: 1, gen: 2, type: "plat", seed: 1, edits: "",
      player: { x: 16.5, y: 4, z: 20.5, yaw: 0, pitch: 0 }, inventory: { slots: [] }, phase: 0.1, savedAt: Date.now(), mission,
    });
    localStorage.setItem("cubes:monde:p1:0", world({ id: "mots", step: 1, counts: {}, words: [], word: "AMI" }));
    localStorage.setItem("cubes:monde:p2:0", world({ id: "abri", step: 0, counts: {} }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  const play = async (profile: string) => {
    await page.locator(`.profile-card[data-profile="${profile}"]`).tap();
    await page.locator('.slot-card[data-slot="0"]').tap();
    await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  };
  await play("p1");
  expect((await state(page)).missionId).toBe("mots");
  expect(await page.evaluate(() => window.cubesDebug.chooseLetter("M"))).toBe(true);
  expect((await state(page)).touchMode).toBe("place");
  await page.locator(".home-btn").tap();
  await expect(page.locator(".home h1")).toHaveText("Qui joue ?");
  await play("p2");
  const s = await state(page);
  expect(s.session?.name).toBe("Tom");
  expect(s.missionId).toBe("abri");
  expect(s.mission).toEqual({ step: 0, done: false });
  expect(s.touchMode).toBe("break");
  await expect(page.locator(".touch-btn").first()).toHaveText("Casser");
  expect(errors).toEqual([]);
});

test("boîte à lettres au doigt : un doigt dont la fin se perd ne la bloque pas, un nouveau doigt reprend le geste ; la fenêtre qui perd le focus relâche la lettre @tactile", async ({ page, context }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page, M2);
  const touch = await touchDriver(context, page);
  const center = async (sel: string) => {
    const b = (await page.locator(sel).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const openArmed = async () => {
    expect(await page.evaluate(() => window.cubesDebug.openLetters())).toBe(true);
    await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  };
  // Fin de geste perdue (relecture J8, constat 0) : le touchend du doigt posé sur B n'arrive jamais à la boîte.
  await openArmed();
  await page.evaluate(() =>
    window.addEventListener("touchend", (e) => e.stopImmediatePropagation(), { capture: true, once: true }),
  );
  const b = await center('.tray-key[data-letter="B"]');
  await touch.tap(b.x, b.y);
  await expect(page.locator('.tray-key[data-letter="B"]')).toHaveClass(/pressed/);
  expect((await state(page)).letters.open).toBe(true);
  // La croix, touchée ensuite, ferme quand même la boîte (avant : plus rien ne répondait au doigt).
  const close = await center(".letter-tray-close");
  await touch.tap(close.x, close.y);
  await expect(page.locator(".letter-tray")).toBeHidden();
  let s = await state(page);
  expect(s.letters).toMatchObject({ open: false, hand: null });
  expect(s.paused).toBe(false);
  // Doigt fantôme que le navigateur liste encore (41 sur B) : M touché ensuite (42) est choisi.
  await openArmed();
  await synthTouches(page, [
    { type: "touchstart", id: 41, sel: '.tray-key[data-letter="B"]', down: [41] },
    { type: "touchstart", id: 42, sel: '.tray-key[data-letter="M"]', down: [41, 42] },
    { type: "touchend", id: 42, sel: '.tray-key[data-letter="M"]', down: [41] },
  ]);
  await expect.poll(async () => (await state(page)).letters.hand).toBe("M");
  s = await state(page);
  expect(s.letters.open).toBe(false);
  await expect(page.locator(".letter-tray")).toBeHidden();
  // Fenêtre qui perd le focus, doigt posé sur B : B est relâchée, et ce doigt, levé ensuite, ne choisit rien.
  await openArmed();
  await synthTouches(page, [{ type: "touchstart", id: 41, sel: '.tray-key[data-letter="B"]', down: [41] }]);
  await expect(page.locator('.tray-key[data-letter="B"]')).toHaveClass(/pressed/);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".tray-key.pressed")).toHaveCount(0);
  await synthTouches(page, [{ type: "touchend", id: 41, sel: '.tray-key[data-letter="B"]', down: [] }]);
  await page.waitForTimeout(300);
  s = await state(page);
  expect(s.letters).toMatchObject({ open: true, hand: "M" });
  // La boîte répond toujours : la croix la ferme.
  await touch.tap(close.x, close.y);
  await expect(page.locator(".letter-tray")).toBeHidden();
  expect((await state(page)).letters).toMatchObject({ open: false, hand: "M" });
  expect(errors).toEqual([]);
});

test("au doigt, un pouce posé sur le voile pendant qu'un doigt touche une lettre, une carte ou une case de la barre : la lettre est choisie, la carte fabrique, l'appui long continue, rien ne se ferme @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page, M2);
  // Boîte à lettres : doigt 1 sur N, le pouce (2) se pose sur le voile, 1 se lève sur N, puis le pouce se lève.
  expect(await page.evaluate(() => window.cubesDebug.openLetters())).toBe(true);
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  const N = '.tray-key[data-letter="N"]';
  await synthTouches(page, [
    { type: "touchstart", id: 1, sel: N, down: [1] },
    { type: "touchstart", id: 2, sel: ".letter-tray-backdrop", down: [1, 2] },
    { type: "touchend", id: 1, sel: N, down: [2] },
  ]);
  await expect.poll(async () => (await state(page)).letters.hand).toBe("N");
  await expect(page.locator(".letter-tray")).toBeHidden();
  // Le pouce se lève ensuite (boîte déjà fermée par le choix) : rien d'autre.
  await synthTouches(page, [{ type: "touchend", id: 2, sel: "canvas.game", down: [] }]);
  expect((await state(page)).letters).toMatchObject({ open: false, hand: "N" });
  // Même chose sans lever le doigt de la lettre d'abord : le pouce posé puis levé sur le voile ne ferme pas la boîte.
  expect(await page.evaluate(() => window.cubesDebug.openLetters())).toBe(true);
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  const M = '.tray-key[data-letter="M"]';
  await synthTouches(page, [
    { type: "touchstart", id: 3, sel: M, down: [3] },
    { type: "touchstart", id: 4, sel: ".letter-tray-backdrop", down: [3, 4] },
    { type: "touchend", id: 4, sel: ".letter-tray-backdrop", down: [3] },
  ]);
  await page.waitForTimeout(300);
  expect((await state(page)).letters).toMatchObject({ open: true, hand: "N" });
  await synthTouches(page, [{ type: "touchend", id: 3, sel: M, down: [] }]);
  await expect.poll(async () => (await state(page)).letters.hand).toBe("M");
  // Panneau de fabrication : doigt 1 sur la carte des planches, pouce sur le voile, 1 se lève : deux planches.
  await page.evaluate(() => window.cubesDebug.give(6, 3));
  expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
  await expect(page.locator(".craft")).toBeVisible();
  await page.waitForTimeout(500); // armé 400 ms après l'ouverture
  const PLANKS = '.craft-card[data-recipe="planches"]';
  await synthTouches(page, [
    { type: "touchstart", id: 5, sel: PLANKS, down: [5] },
    { type: "touchstart", id: 6, sel: ".craft-backdrop", down: [5, 6] },
    { type: "touchend", id: 5, sel: PLANKS, down: [6] },
    { type: "touchend", id: 6, sel: ".craft-backdrop", down: [] },
  ]);
  await expect.poll(async () => invCount(await state(page), B.planks)).toBe(2);
  expect((await state(page)).craft.open).toBe(true);
  await expect(page.locator(".craft")).toBeVisible();
  // Appui long sur une case de la barre (touchable au-dessus du voile, hors du panneau, qui ne voit pas ce doigt) et
  // pouce sur le voile : le pouce levé ne ferme pas le panneau, qu'il se soit posé après le doigt de la case ou avant.
  const planksSlot = (await state(page)).inventory.findIndex((c) => c?.id === B.planks);
  expect(planksSlot).toBeGreaterThanOrEqual(0);
  const SLOT = `.hotbar > .slot:nth-child(${planksSlot + 1})`;
  await synthTouches(page, [
    { type: "touchstart", id: 8, sel: SLOT, down: [8] },
    { type: "touchstart", id: 9, sel: ".craft-backdrop", down: [8, 9] },
    { type: "touchend", id: 9, sel: ".craft-backdrop", down: [8] },
  ]);
  await page.waitForTimeout(300);
  let s = await state(page);
  expect(s.craft.open).toBe(true);
  expect(s.slotHold).toMatchObject({ slot: planksSlot, source: "touch" });
  await synthTouches(page, [{ type: "touchend", id: 8, sel: SLOT, down: [] }]);
  s = await state(page);
  expect(s.slotHold).toBeNull();
  expect(invCount(s, B.planks)).toBe(2);
  // Pouce posé d'abord, puis appui long allé au bout (la case se vide), doigt levé, puis pouce levé.
  await synthTouches(page, [
    { type: "touchstart", id: 10, sel: ".craft-backdrop", down: [10] },
    { type: "touchstart", id: 11, sel: SLOT, down: [10, 11] },
  ]);
  await expect.poll(async () => invCount(await state(page), B.planks), { timeout: 5000 }).toBe(0);
  await synthTouches(page, [
    { type: "touchend", id: 11, sel: SLOT, down: [10] },
    { type: "touchend", id: 10, sel: ".craft-backdrop", down: [] },
  ]);
  await page.waitForTimeout(300);
  expect((await state(page)).craft.open).toBe(true);
  await expect(page.locator(".craft")).toBeVisible();
  // Le voile seul, touché d'un doigt, ferme toujours le panneau.
  await synthTouches(page, [
    { type: "touchstart", id: 7, sel: ".craft-backdrop", down: [7] },
    { type: "touchend", id: 7, sel: ".craft-backdrop", down: [] },
  ]);
  await expect(page.locator(".craft")).toBeHidden();
  expect(errors).toEqual([]);
});

test("au doigt, double toucher qui ferme la boîte ou le panneau : le second toucher, sur le jeu, ne pose ni la lettre ni le bloc en main ; un tapotement 500 ms plus tard pose @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  const errors = await openGame(page, M2);
  await page.evaluate(() => window.cubesDebug.look(0, -50));
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  const N = letterId("N");
  // Double toucher sur N : le premier lever choisit N, ferme la boîte et passe en mode Poser ; le second toucher
  // tombe sur le jeu tout de suite après.
  expect(await page.evaluate(() => window.cubesDebug.openLetters())).toBe(true);
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  await synthTouches(page, [
    { type: "touchstart", id: 1, sel: '.tray-key[data-letter="N"]', down: [1] },
    { type: "touchend", id: 1, sel: '.tray-key[data-letter="N"]', down: [] },
    { type: "touchstart", id: 2, sel: "canvas.game", down: [2] },
    { type: "touchend", id: 2, sel: "canvas.game", down: [] },
  ]);
  await expect(page.locator(".letter-tray")).toBeHidden();
  let s = await state(page);
  expect(s.letters).toMatchObject({ open: false, hand: "N" });
  expect(s.touchMode).toBe("place");
  await page.waitForTimeout(300);
  expect(await page.evaluate((id) => window.cubesDebug.countBlocks(id), N)).toBe(0);
  // 500 ms après la fermeture : un tapotement sur le jeu pose bien la lettre.
  await page.waitForTimeout(250);
  await synthTouches(page, [
    { type: "touchstart", id: 3, sel: "canvas.game", down: [3] },
    { type: "touchend", id: 3, sel: "canvas.game", down: [] },
  ]);
  await expect.poll(() => page.evaluate((id) => window.cubesDebug.countBlocks(id), N)).toBe(1);
  // Double toucher sur la croix de la boîte : rien n'est posé non plus.
  expect(await page.evaluate(() => window.cubesDebug.openLetters())).toBe(true);
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  await synthTouches(page, [
    { type: "touchstart", id: 4, sel: ".letter-tray-close", down: [4] },
    { type: "touchend", id: 4, sel: ".letter-tray-close", down: [] },
    { type: "touchstart", id: 5, sel: "canvas.game", down: [5] },
    { type: "touchend", id: 5, sel: "canvas.game", down: [] },
  ]);
  await expect(page.locator(".letter-tray")).toBeHidden();
  await page.waitForTimeout(300);
  expect(await page.evaluate((id) => window.cubesDebug.countBlocks(id), N)).toBe(1);
  // Panneau de fabrication, de l'herbe en main, mode Poser : double toucher sur la croix, rien n'est posé ; puis un
  // tapotement 500 ms plus tard pose un bloc.
  await page.evaluate(() => window.cubesDebug.give(1, 20));
  s = await state(page);
  const grassSlot = s.inventory.findIndex((c) => c?.id === B.grass);
  await synthTouches(page, [
    { type: "touchstart", id: 6, sel: `.hotbar > .slot:nth-child(${grassSlot + 1})`, down: [6] },
    { type: "touchend", id: 6, sel: `.hotbar > .slot:nth-child(${grassSlot + 1})`, down: [] },
  ]);
  s = await state(page);
  expect(s.slot).toBe(grassSlot);
  expect(s.touchMode).toBe("place");
  expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
  await expect(page.locator(".craft")).toBeVisible();
  await page.waitForTimeout(500); // armé 400 ms après l'ouverture
  await synthTouches(page, [
    { type: "touchstart", id: 7, sel: ".craft-close", down: [7] },
    { type: "touchend", id: 7, sel: ".craft-close", down: [] },
    { type: "touchstart", id: 8, sel: "canvas.game", down: [8] },
    { type: "touchend", id: 8, sel: "canvas.game", down: [] },
  ]);
  await expect(page.locator(".craft")).toBeHidden();
  await page.waitForTimeout(300);
  expect(invCount(await state(page), B.grass)).toBe(20);
  await page.waitForTimeout(250);
  await synthTouches(page, [
    { type: "touchstart", id: 9, sel: "canvas.game", down: [9] },
    { type: "touchend", id: 9, sel: "canvas.game", down: [] },
  ]);
  await expect.poll(async () => invCount(await state(page), B.grass)).toBe(19);
  expect(errors).toEqual([]);
});

test("au doigt, double toucher sur « Continuer » des félicitations : le second toucher ne pose pas le bloc en main @tactile", async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), "tactile : tablette uniquement");
  test.setTimeout(120_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  await page.evaluate(() => {
    localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
      { name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
      { name: "Tom", level: "autonome", voice: false, avatar: 2 },
    ] }));
    // Monde plat dont la mission 1 est finie, félicitations pas encore vues ; de l'herbe dans le sac, de jour.
    localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
      version: 1, gen: 2, type: "plat", seed: 1, edits: "",
      player: { x: 16.5, y: 4.01, z: 20.5, yaw: 0, pitch: 0 }, inventory: { slots: [[1, 20]] }, phase: 0.4, savedAt: Date.now(),
      mission: { id: "abri", step: 6, counts: {} }, celebrate: true,
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
  await page.locator('.profile-card[data-profile="p1"]').click();
  await page.locator('.slot-card[data-slot="0"]').click();
  await expect(page.locator(".celebration")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".celebration-button")).toBeEnabled({ timeout: 5_000 });
  await page.evaluate(() => window.cubesDebug.look(0, -50));
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  // Mode Poser (bouton Casser / Poser), l'herbe en main.
  await page.evaluate(() => {
    const mode = Array.from(document.querySelectorAll(".touch-btn")).find((b) => b.textContent === "Casser")!;
    mode.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
  });
  let s = await state(page);
  expect(s.touchMode).toBe("place");
  expect(s.inventory[s.slot]).toMatchObject({ id: B.grass, count: 20 });
  // Le premier toucher ferme l'écran (clic qui suit le lever), le second tombe sur le jeu tout de suite après.
  await synthTouches(page, [
    { type: "touchstart", id: 1, sel: ".celebration-button", down: [1] },
    { type: "touchend", id: 1, sel: ".celebration-button", down: [] },
  ]);
  await page.evaluate(() => (document.querySelector(".celebration-button") as HTMLButtonElement).click());
  await synthTouches(page, [
    { type: "touchstart", id: 2, sel: "canvas.game", down: [2] },
    { type: "touchend", id: 2, sel: "canvas.game", down: [] },
  ]);
  await expect(page.locator(".celebration")).toBeHidden();
  await page.waitForTimeout(300);
  expect(invCount(await state(page), B.grass)).toBe(20);
  // 500 ms après la fermeture : un tapotement pose bien le bloc.
  await page.waitForTimeout(250);
  await synthTouches(page, [
    { type: "touchstart", id: 3, sel: "canvas.game", down: [3] },
    { type: "touchend", id: 3, sel: "canvas.game", down: [] },
  ]);
  await expect.poll(async () => invCount(await state(page), B.grass)).toBe(19);
  s = await state(page);
  expect(s.celebration).toBe(false);
  expect(errors).toEqual([]);
});

test("mission 2 au clavier : 0 ouvre la boîte (souris libérée) ; une lettre tapée la choisit (Z gardé ne fait pas marcher) et la souris est reprise ; clic droit pose la lettre ; 0 puis Échap ferme sans choisir", async ({ page }, testInfo) => {
  test.skip(isTouch(testInfo), "clavier et souris : PC uniquement");
  const errors = await openGame(page, M2);
  await lockAndLookDown(page, -50);
  await page.keyboard.press("Digit0");
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  let s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.letters.open).toBe(true);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator(".letter-tray-keyboard")).toHaveText("Ou tape-la au clavier !");
  // La touche Z (KeyW, « avancer ») gardée, boîte ouverte : elle écrit sa lettre, que la boîte prend (lue par
  // KeyboardEvent.key : W sur le clavier QWERTY du test) ; le jeu ne la voit pas, le personnage ne marche pas.
  const before = s.player;
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  s = await state(page);
  await page.keyboard.up("KeyW");
  expect(Math.hypot(s.player.x - before.x, s.player.z - before.z)).toBeLessThan(0.01);
  expect(s.letters).toMatchObject({ open: false, hand: "W" });
  // Une lettre tapée (KeyboardEvent.key, seulement boîte ouverte) : choisie, la souris est capturée de nouveau.
  await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 5_000 });
  await page.keyboard.press("Digit0");
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  await page.keyboard.type("a");
  await expect.poll(async () => (await state(page)).letters.hand).toBe("A");
  s = await state(page);
  expect(s.letters).toMatchObject({ open: false, selected: true });
  expect(s.paused).toBe(false);
  await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 5_000 });
  await page.evaluate(() => window.cubesDebug.look(0, -50));
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => page.evaluate(() => window.cubesDebug.countBlocks(18))).toBe(1);
  // 0 puis Échap : fermée sans choix, la lettre reste en main.
  await page.keyboard.press("Digit0");
  await expect(page.locator(".letter-tray")).toHaveClass(/armed/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".letter-tray")).toBeHidden();
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.letters).toMatchObject({ open: false, hand: "A" });
  expect(errors).toEqual([]);
});

test("mission 2 : les lettres ne sont jamais dans le sac (sac plein, lettre cassée, herbe cassée lettre en main)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page, M2);
  await page.evaluate((kit) => {
    for (const id of kit) window.cubesDebug.give(id, 3);
  }, FULL_KIT);
  const inv = (await state(page)).inventory;
  expect(inv.every((c) => c !== null)).toBe(true);
  // Sac plein : la lettre se pose quand même, et se casse sans rien rapporter.
  expect(await page.evaluate(() => window.cubesDebug.chooseLetter("B"))).toBe(true);
  await page.evaluate(() => window.cubesDebug.look(0, -50));
  await expect.poll(async () => (await state(page)).target !== null).toBe(true);
  const t = (await state(page)).target!;
  await page.evaluate(() => window.cubesDebug.placeBlock());
  const pos = { x: t.x + t.nx, y: t.y + t.ny, z: t.z + t.nz };
  expect(await blockAt(page, pos)).toBe(letterId("B"));
  expect((await state(page)).inventory).toEqual(inv);
  await page.evaluate(([x, y, z]) => window.cubesDebug.breakBlock(x, y, z), [pos.x, pos.y, pos.z] as const);
  expect(await blockAt(page, pos)).toBe(B.air);
  let s = await state(page);
  expect(s.inventory).toEqual(inv);
  expect(s.letters).toMatchObject({ hand: "B", selected: true });
  // Sac vide, herbe cassée lettre en main : le bloc va dans le sac, la lettre reste en main.
  await page.evaluate(() => window.cubesDebug.clearInventory());
  await page.evaluate(([x, z]) => window.cubesDebug.breakBlock(x, 3, z), [pos.x + 1, pos.z] as const);
  s = await state(page);
  expect(s.inventory.filter((c) => c !== null)).toHaveLength(1);
  expect(s.letters).toMatchObject({ hand: "B", selected: true });
  expect(s.slot).toBe(9);
  expect(s.inventory.every((c) => c === null || c.id < 18 || c.id > 43)).toBe(true);
  expect(errors).toEqual([]);
});

test("bloc-lettre : une lettre L posée face à la caméra se lit à l'endroit (encre en haut à gauche, papier en haut à droite)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette", "un seul profil suffit");
  const errors = await openGame(page);
  const s0 = await state(page);
  const bx = Math.floor(s0.player.x);
  const bz = Math.floor(s0.player.z) - 3;
  const by = Math.floor(s0.camera.y);
  await page.evaluate(([x, y, z, id]) => {
    window.cubesDebug.setBlock(x, y, z, id);
    window.cubesDebug.look(0, 0);
  }, [bx, by, bz, letterId("L")] as const);
  await page.waitForTimeout(500);
  const s = await state(page);
  const vp = page.viewportSize()!;
  const tan = Math.tan((s.fov * Math.PI) / 360);
  // Projection d'un point de la face tournée vers +Z (z = bz + 1) sur l'image (caméra vers −Z, sans inclinaison).
  const at = (x: number, y: number) => {
    const d = s.camera.z - (bz + 1);
    return [0.5 + (x - s.camera.x) / (d * tan * (vp.width / vp.height)) / 2, 0.5 - (y - s.camera.y) / (d * tan) / 2] as const;
  };
  // Tuile 16 × 16 : le jambage du L occupe les colonnes 3 et 4, en haut ; la ligne du haut est du papier à droite.
  const ink = await pixel(page, ...at(bx + 0.22, by + 0.9));
  const paper = await pixel(page, ...at(bx + 0.72, by + 0.9));
  expect(luminance(paper) - luminance(ink)).toBeGreaterThan(80);
  expect(errors).toEqual([]);
});

// ---------- V2 lot 1 : mise en page (ronds du haut, colonne tactile, barre à 10 cases, panneaux) ----------

interface LayoutBox {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Boîtes de l'interface à ne jamais superposer, par nom. Le message, le nom du bloc et l'anneau de l'appui long ne
 * comptent que visibles (ils restent dans la page, transparents, le reste du temps ; le nom du bloc s'efface pendant
 * un appui long) ; le calque tactile seulement quand il est actif.
 */
const HUD_LAYOUT: Record<string, string> = {
  "ligne d'infos": ".hud > .info",
  Tests: ".panel-toggle",
  "rond marteau": ".craft-btn",
  "rond Bulles": ".bubble-btn",
  "rond accueil": ".home-btn",
  "rond vue": ".view-btn",
  "bandeau de Pixel": ".companion",
  message: ".message.visible",
  "nom du bloc": ".hud:not(.slot-holding) .slot-name.visible",
  "anneau de l'appui long": ".slot-hold.visible",
  "aide d'écran": ".hint",
  barre: ".hotbar",
  "rond pour marcher": ".joystick",
  "plein écran": ".fullscreen-btn",
  "marteau (colonne)": ".craft-touch",
  "Casser / Poser": ".touch-buttons > .touch-btn:nth-child(1)",
  Sauter: ".touch-buttons > .touch-btn:nth-child(2)",
  "Bulles (colonne)": ".bubble-touch",
};

/**
 * Ce qui est posé au-dessus du voile du panneau de fabrication (V2), avec la feuille : rien ne doit s'y superposer.
 * La ligne d'état, dans la feuille, est couverte par la boîte de celle-ci.
 */
const CRAFT_LAYOUT: Record<string, string> = {
  feuille: ".craft-sheet",
  barre: ".hotbar",
  "anneau de l'appui long": ".slot-hold.visible",
  pastille: ".hotbar > .slot-delta",
};

/**
 * Mesure, dans une seule tâche de la page, les boîtes affichées (taille non nulle, ni display: none ni visibility:
 * hidden). letter : choisie juste avant la mesure (accès de test), pour que son nom, affiché 1,8 s, soit compté.
 * onHold : rien n'est mesuré tout de suite ; un observateur mesure dans l'image même où l'anneau de l'appui long se
 * montre, et range le résultat (une promesse) dans window.layoutOnHold (voir layoutBoxesDuringHold).
 */
async function layoutBoxes(page: Page, selectors: Record<string, string>, letter: string | null = null, onHold = false): Promise<LayoutBox[]> {
  return page.evaluate(
    ([sels, ch, hold]) => {
      const measure = (): LayoutBox[] => {
        const out: LayoutBox[] = [];
        for (const [name, sel] of Object.entries(sels)) {
          document.querySelectorAll(sel).forEach((el, i) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width === 0 || r.height === 0 || cs.display === "none" || cs.visibility === "hidden") return;
            const touch = el.closest(".touch");
            if (touch && !touch.classList.contains("enabled")) return;
            out.push({ name: i > 0 ? `${name} ${i + 1}` : name, x: r.x, y: r.y, width: r.width, height: r.height });
          });
        }
        return out;
      };
      if (ch !== null) window.cubesDebug.chooseLetter(ch);
      if (!hold) return measure();
      const ring = document.querySelector(".slot-hold")!;
      (window as unknown as { layoutOnHold: Promise<LayoutBox[]> }).layoutOnHold = new Promise((resolve, reject) => {
        const obs = new MutationObserver(() => {
          if (!ring.classList.contains("visible")) return;
          obs.disconnect();
          window.clearTimeout(timer);
          resolve(measure());
        });
        const timer = window.setTimeout(() => {
          obs.disconnect();
          reject(new Error("anneau de l'appui long jamais visible"));
        }, 8000);
        obs.observe(ring, { attributes: true, attributeFilter: ["class"] });
      });
      return [];
    },
    [selectors, letter, onHold] as const,
  );
}

/**
 * Fabrique des planches (accès de test) et mène les pastilles « −1 » / « +2 » au bout de leur montée, dans la même
 * tâche : elles sont mesurées à leur plus haute position, avant d'être retirées (900 ms).
 */
async function craftPlanksDeltasRisen(page: Page): Promise<CraftResult> {
  return page.evaluate(() => {
    const r = window.cubesDebug.craft("planches");
    for (const el of Array.from(document.querySelectorAll(".hotbar > .slot-delta"))) for (const a of el.getAnimations()) a.finish();
    return r;
  });
}

/** Appui gardé sur la case i : souris au PC, doigt (CDP) sur tablette. */
async function slotPress(page: Page, context: BrowserContext, info: TestInfo, i: number): Promise<{ down(): Promise<void>; up(): Promise<void> }> {
  const c = await slotCenter(page, i);
  if (!isTouch(info)) {
    return {
      down: async () => {
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
      },
      up: () => page.mouse.up(),
    };
  }
  const cdp = await context.newCDPSession(page);
  return {
    down: async () => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
    },
    up: async () => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    },
  };
}

/**
 * Boîtes mesurées pendant un appui long sur une case (relecture J8) : l'observateur est posé, puis l'appui commence ;
 * la mesure est prise dans l'image où l'anneau se montre, avant que la case ne soit vidée, puis l'appui est relâché.
 */
async function layoutBoxesDuringHold(page: Page, selectors: Record<string, string>, press: { down(): Promise<void>; up(): Promise<void> }): Promise<LayoutBox[]> {
  await layoutBoxes(page, selectors, null, true);
  await press.down();
  try {
    return await page.evaluate(() => (window as unknown as { layoutOnHold: Promise<LayoutBox[]> }).layoutOnHold);
  } finally {
    await press.up();
  }
}

/** Ce qui ne va pas : boîtes qui sortent de l'écran, paires qui se chevauchent (plus d'un pixel). */
function layoutProblems(boxes: readonly LayoutBox[], vp: { width: number; height: number }): string[] {
  const out: string[] = [];
  for (const b of boxes) {
    if (b.x < -0.5 || b.y < -0.5 || b.x + b.width > vp.width + 0.5 || b.y + b.height > vp.height + 0.5) out.push(`${b.name} hors de l'écran`);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (overlaps(a, b)) out.push(`${a.name} × ${b.name}`);
    }
  }
  return out;
}

const boxNamed = (boxes: readonly LayoutBox[], name: string): LayoutBox => {
  const b = boxes.find((x) => x.name === name);
  expect(b, `boîte « ${name} »`).toBeDefined();
  return b!;
};

/** a entièrement dans b (demi-pixel de tolérance). */
const inside = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;

/** Bandeau de Pixel : les lettres du modèle dedans, le message (s'il est là) dessous. */
async function expectCompanionModel(page: Page, boxes: readonly LayoutBox[], letters: number): Promise<void> {
  const companion = boxNamed(boxes, "bandeau de Pixel");
  const model = page.locator(".companion-model .model-letter");
  await expect(model).toHaveCount(letters);
  for (const l of await model.all()) expect(inside((await l.boundingBox())!, companion)).toBe(true);
  const message = boxes.find((b) => b.name === "message");
  if (message) expect(message.y).toBeGreaterThanOrEqual(companion.y + companion.height);
}

/** Colonne tactile, de haut en bas : plein écran, marteau, Casser (ou Poser), Sauter, Bulles. */
function expectTouchColumn(boxes: readonly LayoutBox[]): void {
  const column = ["plein écran", "marteau (colonne)", "Casser / Poser", "Sauter", "Bulles (colonne)"].map((n) => boxNamed(boxes, n));
  for (let i = 1; i < column.length; i++) expect(column[i - 1]!.y + column[i - 1]!.height).toBeLessThanOrEqual(column[i]!.y);
  const bar = boxNamed(boxes, "barre");
  expect(column[column.length - 1]!.y + column[column.length - 1]!.height).toBeLessThanOrEqual(bar.y + bar.height);
}

test("mise en page, partie d'enfant : ronds du haut avec et sans « Tests », bandeau de Pixel avec un prénom de 10 lettres, barre à 10 cases, colonne tactile dans l'ordre ; rien ne se chevauche @tactile", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto("about:blank");
  const errors = await openGame(page, "");
  const vp = page.viewportSize()!;
  const touch = isTouch(testInfo);
  // Mission 2 à l'étape du prénom (le plus long des modèles : 10 lettres), marteau déjà découvert.
  const prepare = (devTools: boolean) =>
    page.evaluate((dt) => {
      localStorage.setItem("cubes:profils", JSON.stringify({ version: 1, profiles: [
        { name: "Maximilien", level: "debutant", voice: true, avatar: 1, tutorialDone: true, craftSeen: true },
        { name: "Tom", level: "autonome", voice: false, avatar: 2, tutorialDone: true },
      ] }));
      localStorage.setItem("cubes:reglages", JSON.stringify({ night: "normale", creatures: true, devTools: dt }));
      localStorage.setItem("cubes:monde:p1:0", JSON.stringify({
        version: 1, gen: 2, type: "plat", seed: 1, edits: "",
        player: { x: 16.5, y: 4, z: 20.5, yaw: 0, pitch: 0 }, inventory: { slots: [[6, 6], [3, 4]] }, phase: 0.1, savedAt: Date.now(),
        mission: { id: "mots", step: 4, counts: {}, words: ["AMI", "LUNE", "TOIT"] },
      }));
    }, devTools);
  const play = async () => {
    await page.reload();
    await page.waitForFunction(() => window.cubesDebug && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
    await press(page, page.locator('.profile-card[data-profile="p1"]'), testInfo);
    await press(page, page.locator('.slot-card[data-slot="0"]'), testInfo);
    await page.waitForFunction(() => !window.cubesDebug.state().home && !window.cubesDebug.state().loading, null, { timeout: 45_000 });
    expect(await writingTarget(page)).toBe("MAXIMILIEN");
    await expect(page.locator(".companion")).toBeVisible();
    await expect(page.locator(".slot.letters")).toBeVisible();
  };
  const check = async (label: string): Promise<LayoutBox[]> => {
    const boxes = await layoutBoxes(page, HUD_LAYOUT);
    expect(layoutProblems(boxes, vp), label).toEqual([]);
    await expectCompanionModel(page, boxes, 10);
    // Dix cases dans la barre, assez grandes pour un doigt.
    const bar = boxNamed(boxes, "barre");
    const cells = page.locator(".hotbar .slot:visible");
    await expect(cells).toHaveCount(10);
    for (const c of await cells.all()) {
      const b = (await c.boundingBox())!;
      expect(inside(b, bar)).toBe(true);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    if (touch) expectTouchColumn(boxes);
    else expect(boxes.some((b) => b.name === "rond pour marcher")).toBe(false);
    // Ronds du haut, du bord vers le centre : vue, accueil, Bulles, marteau.
    const row = ["rond vue", "rond accueil", "rond Bulles", "rond marteau"].map((n) => boxNamed(boxes, n));
    for (let i = 1; i < row.length; i++) expect(row[i]!.x + row[i]!.width).toBeLessThanOrEqual(row[i - 1]!.x);
    return boxes;
  };

  // Avec « Tests » (l'adulte l'a rallumé) : ligne d'infos et cinq ronds, le bandeau n'en touche aucun.
  await prepare(true);
  await play();
  let boxes = await check("avec Tests");
  expect(boxes.map((b) => b.name)).toEqual(expect.arrayContaining(["ligne d'infos", "Tests"]));
  expect(boxNamed(boxes, "rond vue").x + boxNamed(boxes, "rond vue").width).toBeLessThanOrEqual(boxNamed(boxes, "Tests").x);
  await page.screenshot({ path: testInfo.outputPath("mise-en-page-avec-tests.png") });

  // Sans « Tests » (réglage par défaut des parties d'enfant) : les ronds se rangent contre le bord.
  await press(page, page.locator(".home-btn"), testInfo);
  await expect(page.locator(".home h1")).toHaveText("Qui joue ?");
  await prepare(false);
  await play();
  boxes = await check("sans Tests");
  expect(boxes.some((b) => b.name === "Tests" || b.name === "ligne d'infos")).toBe(false);
  const eye = boxNamed(boxes, "rond vue");
  expect(vp.width - (eye.x + eye.width)).toBeLessThan(20);
  await page.screenshot({ path: testInfo.outputPath("mise-en-page-sans-tests.png") });
  expect(errors).toEqual([]);
});

test("mise en page de la mission 2 : lettre en main (son nom au-dessus de la barre), aide d'écran et modèle du mot sans chevauchement ; appui long, panneau fermé puis ouvert ; panneau de fabrication au-dessus des 10 cases ; boîte à lettres entière dans l'écran @tactile", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await openGame(page, M2);
  const vp = page.viewportSize()!;
  await skipStep(page);
  const target = await writingTarget(page);
  // La lettre choisie dans la même tâche que la mesure : son nom (1,8 s) est bien compté.
  const boxes = await layoutBoxes(page, HUD_LAYOUT, "M");
  expect(layoutProblems(boxes, vp)).toEqual([]);
  expect(boxes.map((b) => b.name)).toEqual(expect.arrayContaining(["nom du bloc", "aide d'écran", "barre", "bandeau de Pixel"]));
  await expect(page.locator(".slot-name")).toHaveText("lettre M");
  await expectCompanionModel(page, boxes, target.length);
  if (isTouch(testInfo)) {
    expectTouchColumn(boxes);
    await expect(page.locator(".touch-buttons > .touch-btn").first()).toHaveText("Poser");
  }
  // L'aide d'écran du PC tient sur une ligne (« … · F : fabriquer · 0 : lettres »).
  if (!isTouch(testInfo)) {
    await expect(page.locator(".hint")).toContainText("0 : lettres");
    expect(boxNamed(boxes, "aide d'écran").height).toBeLessThan(24);
  }
  await page.screenshot({ path: testInfo.outputPath("mission-2-lettre-en-main.png") });

  // Appui long sur une case, panneau fermé : l'anneau, au-dessus de la case, ne touche ni l'aide d'écran ni le rond,
  // ni les boutons (le nom du bloc s'efface pendant l'appui).
  await page.evaluate(() => {
    for (const id of [2, 3, 5]) window.cubesDebug.give(id, 3); // cases 1 à 3
  });
  const heldHud = await layoutBoxesDuringHold(page, HUD_LAYOUT, await slotPress(page, context, testInfo, 1));
  expect(layoutProblems(heldHud, vp)).toEqual([]);
  expect(heldHud.map((b) => b.name)).toEqual(expect.arrayContaining(["anneau de l'appui long", "aide d'écran", "barre"]));

  // Panneau de fabrication : la feuille au-dessus de la barre à 10 cases, ses cartes entières dans l'écran ;
  // la barre reste touchable (au-dessus du voile). Sac refait (sous charge, l'appui ci-dessus a pu vider sa case).
  await page.evaluate(() => {
    window.cubesDebug.clearInventory();
    for (const id of [2, 3, 5]) window.cubesDebug.give(id, 3); // cases 1 à 3
    window.cubesDebug.give(6, 2); // case 4
  });
  expect(await page.evaluate(() => window.cubesDebug.openCraft())).toBe(true);
  await expect(page.locator(".craft")).toBeVisible();
  const sheet = (await page.locator(".craft-sheet").boundingBox())!;
  const bar = (await page.locator(".hotbar").boundingBox())!;
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(bar.y);
  expect(inside(sheet, { x: 0, y: 0, width: vp.width, height: vp.height })).toBe(true);
  const cards = page.locator(".craft-card");
  await expect(cards).toHaveCount(3);
  for (const c of await cards.all()) {
    const b = (await c.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(200);
    expect(b.height).toBeGreaterThanOrEqual(160);
    expect(inside(b, { x: 0, y: 0, width: vp.width, height: vp.height })).toBe(true);
  }
  const abcOnTop = await page.evaluate(() => {
    const r = document.querySelector(".slot.letters")!.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".hotbar") !== null;
  });
  expect(abcOnTop).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mission-2-fabrication.png") });
  // Relecture J8, constat 14 : les pastilles « −1 » (case 4) et « +2 » (case 5) d'une fabrication, puis l'anneau
  // d'un appui gardé sur une case, restent entre la barre et la feuille.
  expect(await craftPlanksDeltasRisen(page)).toMatchObject({ ok: true, outputSlot: 4 });
  const risen = await layoutBoxes(page, CRAFT_LAYOUT);
  expect(layoutProblems(risen, vp)).toEqual([]);
  expect(risen.map((b) => b.name)).toEqual(["feuille", "barre", "pastille", "pastille 2"]);
  const held = await layoutBoxesDuringHold(page, CRAFT_LAYOUT, await slotPress(page, context, testInfo, 0));
  expect(layoutProblems(held, vp)).toEqual([]);
  expect(held.map((b) => b.name)).toEqual(expect.arrayContaining(["feuille", "barre", "anneau de l'appui long"]));
  await page.evaluate(() => window.cubesDebug.closeCraft());

  // Boîte à lettres : 26 lettres d'au moins 64 px, le modèle du mot et la croix, tout dans l'écran, sans défilement.
  expect(await page.evaluate(() => window.cubesDebug.openLetters())).toBe(true);
  await expect(page.locator(".letter-tray")).toBeVisible();
  const card = (await page.locator(".letter-tray-card").boundingBox())!;
  expect(inside(card, { x: 0, y: 0, width: vp.width, height: vp.height })).toBe(true);
  const keys = page.locator(".tray-key");
  await expect(keys).toHaveCount(26);
  for (const k of await keys.all()) {
    const b = (await k.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(64);
    expect(b.height).toBeGreaterThanOrEqual(64);
    expect(inside(b, card)).toBe(true);
  }
  for (const sel of [".letter-tray-close", ".letter-tray-model"]) expect(inside((await page.locator(sel).boundingBox())!, card)).toBe(true);
  const scrolls = await page.evaluate(() => {
    const c = document.querySelector(".letter-tray-card")!;
    return c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1;
  });
  expect(scrolls).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("mission-2-boite.png") });
  expect(errors).toEqual([]);
});
