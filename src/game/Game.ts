import { Sounds } from "../audio/sounds";
import { BlockId, breakDurationMs, HOTBAR_BLOCKS, isOpaqueId, isPlantId } from "../engine/blocks";
import { BreakTracker, type BlockPos } from "../engine/breaking";
import { DAY_CYCLE_MS, formatHour, phaseForHour, skyState, solarTime, type SkyState } from "../engine/dayNight";
import { Inventory, MAX_STACK } from "../engine/inventory";
import { blockBox, boxesIntersect } from "../engine/physics";
import { raycast, type RayHit } from "../engine/raycast";
import { generateWorld, randomSeed, worldTypeName, parseWorldType, type GeneratedWorld, type WorldTypeId } from "../engine/terrain";
import type { World } from "../engine/World";
import { emptiedText, maxStackText, pickupSpeech, pickupText } from "../edu/counting";
import { Narrator, type TellOptions } from "../edu/Narrator";
import { Speech } from "../edu/speech";
import {
  BOTTOM_LAYER,
  EMPTY_HAND,
  FLOWER_NEEDS_GROUND,
  FULL_BAG,
  HOLD_TO_BREAK,
  NO_SPACE,
  parseReadingLevel,
  pick,
  WELCOME,
  WORLD_EDGE,
  type ChildText,
} from "../edu/texts";
import { isHolding, shouldHintHold, type BreakPress } from "../input/breakPress";
import { Keyboard } from "../input/Keyboard";
import { MAX_DELTA_PX } from "../input/mouseFilter";
import { MouseLook } from "../input/MouseLook";
import { TouchControls } from "../input/TouchControls";
import { SceneView } from "../render/SceneView";
import { showFatalError } from "../ui/fatal";
import { HOUR_PRESETS, Hud } from "../ui/Hud";
import { Player } from "./Player";
import { formatUrlOptions, parseSeed, parseUrlOptions } from "./urlOptions";

const REACH = 6;
export const VERSION = "J2";
/** Rayon autour du joueur qui doit être construit avant de retirer l'écran de chargement (blocs). */
const LOADING_RADIUS = 40;
/** Budget de maillage par image (ms) : large pendant le chargement, réduit ensuite. */
const MESH_BUDGET_LOADING_MS = 14;
const MESH_BUDGET_MS = 5;
const FAST_TIME = 20;
/** Intervalle entre deux « tic » sonores pendant une casse (ms). */
const BREAK_TICK_MS = 130;
/** Délai avant de lire le compte à voix haute : en cassant vite, seul le dernier est lu (ms). */
const PICKUP_VOICE_DELAY_MS = 550;
/** Intervalle minimal entre deux conseils « Appuie longtemps » (ms). */
const HOLD_HINT_EVERY_MS = 6000;
/** Kit du bouton « Remplir le sac » du panneau (les planches ne se ramassent pas encore dans la nature). */
const TEST_KIT_COUNT = 20;

const HINT_TOUCH = "Doigt gauche : bouger · doigt droit : regarder · garder le doigt sur un bloc : casser";
const HINT_MOUSE =
  "Clique pour capturer la souris · ZQSD bouger · Espace sauter ou nager · Maj plonger\nGarder le clic gauche casser · clic droit poser · 1-9 ou molette choisir · Échap libérer";
const HINT_MOUSE_FALLBACK =
  "Glisse en tenant le bouton pour regarder · ZQSD bouger · Espace sauter ou nager\nGarder le clic gauche sans bouger casser · clic bref droit poser · 1-9 choisir";

interface PixelRequest {
  fx: number;
  fy: number;
  resolve: (rgba: number[]) => void;
}

/**
 * Assemble tout : monde, rendu, joueur, entrées, HUD, boucle de jeu.
 * J1 : monde généré par type et graine, jour/nuit, eau.
 * J2 : casse par appui maintenu, blocs ramassés dans un sac de 9 cases
 * (poser consomme), sons synthétisés, compte lu à voix haute.
 * Pas encore de sauvegarde (J4) ni de missions (J5).
 */
export class Game {
  world: World;
  player: Player;
  readonly view: SceneView;
  readonly hud: Hud;
  readonly keyboard: Keyboard;
  readonly mouse: MouseLook;
  readonly touch: TouchControls;
  readonly speech = new Speech();
  readonly sounds = new Sounds();
  readonly inventory = new Inventory();
  readonly narrator: Narrator;
  /** Appareil dont le pointeur principal est le doigt (tablette) : fixé au démarrage. */
  readonly coarsePointer: boolean;
  /** Interface tactile affichée : au démarrage sur tablette, ou dès le premier toucher (PC tactile). */
  private touchUi: boolean;
  private stopped = false;

  private gen: GeneratedWorld;
  private selectedSlot = 0;
  private target: RayHit | null = null;
  private lastTime = performance.now();
  private frameTimes: number[] = [];
  private cpuTimes: number[] = [];
  private storageOk = "?";
  /** Phase du cycle jour/nuit en temps réel [0, 1). */
  private phase = phaseForHour(8);
  private timeScale = 1;
  private sky: SkyState = skyState(solarTime(this.phase));
  private nearSections = 1;
  private loading = true;
  private renderCalls = 0;
  private renderTriangles = 0;
  private readonly pixelRequests: PixelRequest[] = [];
  private readonly breaker = new BreakTracker();
  private lastBreakAt = -Infinity;
  private lastHoldHintAt = -Infinity;
  private lastTickAt = -Infinity;
  private shownInventory = -1;

  constructor(root: HTMLElement) {
    this.coarsePointer = TouchControls.primaryPointerIsTouch();
    this.touchUi = this.coarsePointer;

    const opts = parseUrlOptions(location.hash);
    this.gen = generateWorld(opts.type ?? "prairie", opts.seed ?? randomSeed());
    this.world = this.gen.world;
    if (opts.hour !== undefined) this.phase = phaseForHour(opts.hour);

    const canvas = document.createElement("canvas");
    canvas.className = "game";
    root.appendChild(canvas);

    this.view = new SceneView(canvas, this.world, this.coarsePointer);
    this.view.setRenderDistance(opts.distance ?? (this.coarsePointer ? 48 : 96));
    this.hud = new Hud(root, this.view.atlasCanvas, VERSION);
    this.narrator = new Narrator({
      show: (text, ms) => this.hud.showMessage(text, ms),
      speak: (text) => void this.speech.speak(text),
      now: () => performance.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
    });
    this.sounds.attachUnlock(window);
    this.touch = new TouchControls(root);
    this.touch.enable(this.touchUi);
    this.keyboard = new Keyboard();
    this.mouse = new MouseLook(canvas);

    this.player = new Player(this.world);
    this.spawnPlayer();
    this.afterWorldChange();

    this.wireInputs();
    this.wirePanel();
    this.setSlot(0);
    this.testStorage();
    this.setupVoicePanel();
    this.exposeDebug();

    this.updateHint();
    this.hud.setDistance(this.view.renderDistance);
    this.syncGameControls();
    this.refreshInventory();
    // Pas de voix ici : le navigateur la bloque tant que l'enfant n'a ni cliqué ni touché l'écran.
    this.hud.showMessage(`Bienvenue dans Cubes (prototype ${VERSION})\n${pick(WELCOME, this.narrator.level)}`, 5000);

    requestAnimationFrame((t) => this.safeFrame(t));
  }

  private spawnPlayer(): void {
    const s = this.gen.spawn;
    this.player.setPosition(s.x, s.y, s.z);
    this.player.yaw = 0;
    this.player.pitch = 0;
  }

  /** Après la création d'un monde : adresse, panneau, écran de chargement. */
  private afterWorldChange(): void {
    this.hud.setWorldControls(this.gen.type, this.gen.seed);
    try {
      history.replaceState(null, "", formatUrlOptions(this.gen.type, this.gen.seed));
    } catch {
      // Adresse non modifiable (certains navigateurs en file://) : sans conséquence.
    }
    this.nearSections = Math.max(1, this.view.chunks.pendingNear(this.player.x, this.player.z, LOADING_RADIUS));
    this.loading = true;
  }

  newWorld(type: WorldTypeId, seed: number): void {
    this.gen = generateWorld(type, seed);
    this.world = this.gen.world;
    this.view.setWorld(this.world);
    this.player = new Player(this.world);
    this.spawnPlayer();
    this.target = null;
    this.breaker.reset();
    // Nouveau monde, nouveau départ : le sac est vidé (la sauvegarde arrive au J4).
    this.inventory.clear();
    this.narrator.cancelPending();
    this.afterWorldChange();
    this.hud.showMessage(`Nouveau monde : ${worldTypeName(type)} (graine ${seed})`, 3000);
  }

  private updateHint(): void {
    if (this.touchUi) this.hud.setHint(HINT_TOUCH);
    else this.hud.setHint(this.mouse.inFallback() ? HINT_MOUSE_FALLBACK : HINT_MOUSE);
  }

  /** Boucle protégée : une erreur affiche un écran lisible au lieu de figer le jeu en silence. */
  private safeFrame(now: number): void {
    if (this.stopped) return;
    try {
      this.frame(now);
    } catch (err) {
      this.stopped = true;
      showFatalError(err);
      throw err;
    }
  }

  private wireInputs(): void {
    this.keyboard.onPressed((code) => {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (m) this.setSlot(Number(m[1]) - 1, true);
    });
    this.hud.onSelectSlot((i) => this.setSlot(i, true));
    this.view.renderer.domElement.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.deltaY === 0) return;
        const n = this.inventory.size;
        this.setSlot((this.selectedSlot + (e.deltaY > 0 ? 1 : n - 1)) % n, true);
      },
      { passive: false },
    );

    this.mouse.onAction(() => this.placeBlock());
    this.mouse.onBreakRelease((p) => this.onBreakRelease(p));
    this.mouse.onLockChange((locked) => {
      this.hud.lockButton.textContent = locked ? "Souris capturée (Échap)" : "Capturer la souris";
      this.updateHint();
      if (locked || this.touchUi) return;
      this.hud.showMessage(
        this.mouse.inFallback() ? "Capture de la souris refusée : glisse pour regarder, clic bref pour agir" : "Clique sur le monde pour reprendre",
        2500,
      );
    });
    this.touch.onAction(() => this.placeBlock());
    this.touch.onBreakRelease((p) => this.onBreakRelease(p));

    // PC à écran tactile : l'interface tactile n'apparaît qu'au premier vrai toucher.
    window.addEventListener(
      "touchstart",
      () => {
        if (this.touchUi) return;
        this.touchUi = true;
        this.touch.enable(true);
        this.updateHint();
      },
      { capture: true, passive: true },
    );

    this.hud.lockButton.addEventListener("click", () => this.mouse.requestLock());
    this.hud.fullscreenButton.addEventListener("click", () => this.toggleFullscreen());

    // Adresse modifiée à la main (#monde=…&graine=…) : on régénère.
    window.addEventListener("hashchange", () => {
      const o = parseUrlOptions(location.hash);
      const type = o.type ?? this.gen.type;
      const seed = o.seed ?? this.gen.seed;
      if (type !== this.gen.type || seed !== this.gen.seed) this.newWorld(type, seed);
    });

    this.view.onContextChange((lost) => {
      this.hud.showMessage(lost ? "L'image s'est interrompue, le monde revient…" : "Le monde est revenu", 2500);
    });
  }

  private wirePanel(): void {
    const hud = this.hud;
    hud.newWorldButton.addEventListener("click", () => {
      const type = parseWorldType(hud.worldTypeSelect.value) ?? "prairie";
      let seed = parseSeed(hud.seedInput.value) ?? randomSeed();
      // Même type et même graine = le même monde : on en veut un autre.
      if (type === this.gen.type && seed === this.gen.seed) seed = randomSeed();
      this.newWorld(type, seed);
    });
    HOUR_PRESETS.forEach((p, i) => {
      hud.hourButtons[i]?.addEventListener("click", () => this.setHour(p.hour));
    });
    hud.fastTimeButton.addEventListener("click", () => {
      this.timeScale = this.timeScale === 1 ? FAST_TIME : 1;
      hud.setFastTime(this.timeScale !== 1);
    });
    hud.distanceSelect.addEventListener("change", () => {
      const d = Number(hud.distanceSelect.value);
      if (Number.isFinite(d)) this.view.setRenderDistance(d);
    });
    hud.levelSelect.addEventListener("change", () => {
      const level = parseReadingLevel(hud.levelSelect.value);
      if (level) this.narrator.setLevel(level);
      this.syncGameControls();
    });
    hud.voiceToggle.addEventListener("change", () => {
      this.narrator.voice = hud.voiceToggle.checked;
      if (!this.narrator.voice) this.narrator.cancelPending();
    });
    hud.soundToggle.addEventListener("change", () => {
      this.sounds.enabled = hud.soundToggle.checked;
    });
    hud.fillBagButton.addEventListener("click", () => this.fillTestKit());
    hud.clearBagButton.addEventListener("click", () => this.inventory.clear());
  }

  /** Recopie les réglages de jeu (lecture, voix, sons) dans le panneau. */
  private syncGameControls(): void {
    this.hud.levelSelect.value = this.narrator.level;
    this.hud.voiceToggle.checked = this.narrator.voice;
    this.hud.soundToggle.checked = this.sounds.enabled;
  }

  private fillTestKit(): void {
    this.inventory.fill(HOTBAR_BLOCKS, TEST_KIT_COUNT);
    this.refreshInventory();
    this.setSlot(this.selectedSlot, true);
  }

  setHour(hour: number): void {
    this.phase = phaseForHour(hour);
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (orientation.lock) await orientation.lock("landscape").catch(() => undefined);
      }
    } catch (err) {
      this.hud.showMessage(`Plein écran impossible : ${String(err)}`);
    }
  }

  /** Choisit une case de la barre. byUser : geste de l'enfant (son, nom du bloc affiché). */
  private setSlot(i: number, byUser = false): void {
    if (i < 0 || i >= this.inventory.size) return;
    this.selectedSlot = i;
    this.hud.setSelectedSlot(i);
    if (!byUser) return;
    this.sounds.play("select");
    const s = this.inventory.slot(i);
    this.hud.showSlotName(s ? this.hud.blockName(s.id) : "case vide");
  }

  /** Texte du bloc tenu pour la ligne d'infos. */
  private heldLabel(): string {
    const s = this.inventory.slot(this.selectedSlot);
    return s ? `${this.hud.blockName(s.id)} ×${s.count}` : "(case vide)";
  }

  private refreshInventory(): void {
    if (this.shownInventory === this.inventory.version) return;
    this.shownInventory = this.inventory.version;
    this.hud.setInventory(this.inventory.slots());
  }

  private tell(text: ChildText, opts?: TellOptions): void {
    this.narrator.tell(text, opts);
  }

  private deny(text: ChildText): void {
    this.sounds.play("deny");
    this.tell(text, { ms: 1800 });
  }

  /** Casse par appui maintenu : appelé à chaque image. */
  private updateBreaking(now: number, dtMs: number): void {
    const press = this.mouse.breakPress ?? this.touch.breakPress;
    const holding = isHolding(press, now);
    const t = this.target;
    const pos: BlockPos | null = t ? { x: t.x, y: t.y, z: t.z } : null;
    const duration = t ? breakDurationMs(this.world.get(t.x, t.y, t.z)) : 0;
    const step = this.breaker.update(holding, pos, duration, dtMs);
    if (step.kind === "done") {
      this.hud.setBreakProgress(null);
      this.breakBlock(step.pos);
      return;
    }
    const progress = step.kind === "progress" ? step.progress : 0;
    this.hud.setBreakProgress(progress > 0 ? progress : null);
    if (progress > 0 && now - this.lastTickAt >= BREAK_TICK_MS && t) {
      this.lastTickAt = now;
      this.sounds.play("breakTick", this.world.get(t.x, t.y, t.z));
    }
  }

  /** Relâchement d'un appui « casser » : conseil si l'enfant a seulement cliqué ou tapoté. */
  private onBreakRelease(press: BreakPress): void {
    const now = performance.now();
    if (!this.target || !shouldHintHold(press, now, this.lastBreakAt)) return;
    if (now - this.lastHoldHintAt < HOLD_HINT_EVERY_MS) return;
    this.lastHoldHintAt = now;
    this.tell(HOLD_TO_BREAK, { ms: 2000 });
  }

  private breakBlock(pos: BlockPos): void {
    const { x, y, z } = pos;
    const w = this.world;
    const id = w.get(x, y, z);
    if (id === BlockId.Air) return;
    if (y === 0 && !isPlantId(id)) {
      this.deny(BOTTOM_LAYER);
      return;
    }
    if (!w.set(x, y, z, BlockId.Air)) return;
    this.lastBreakAt = performance.now();
    this.sounds.play("break", id);
    this.collect(id);
    // Une fleur posée sur le bloc cassé tombe avec lui : elle est ramassée aussi.
    const above = w.get(x, y + 1, z);
    if (isPlantId(above) && w.set(x, y + 1, z, BlockId.Air)) this.collect(above);
  }

  /** Met un bloc cassé dans le sac et annonce le nouveau compte. */
  private collect(id: BlockId): void {
    const r = this.inventory.add(id);
    if (!r.ok) {
      this.tell(r.reason === "full" ? FULL_BAG : maxStackText(id, MAX_STACK), { ms: 2500 });
      return;
    }
    this.sounds.play("pickup", id);
    this.hud.pulseSlot(r.slot);
    // Main vide : le bloc ramassé passe dans la main (premier ramassage, case épuisée…).
    if (!this.inventory.slot(this.selectedSlot)) this.setSlot(r.slot);
    this.refreshInventory();
    this.tell(pickupText(id, r.count), { spoken: pickupSpeech(id, r.count), voiceDelayMs: PICKUP_VOICE_DELAY_MS, ms: 1800 });
  }

  private placeBlock(): void {
    if (!this.target) return;
    const t = this.target;
    const w = this.world;
    // Viser une fleur et poser : le bloc prend sa place (la fleur est ramassée).
    const onPlant = isPlantId(w.get(t.x, t.y, t.z));
    const x = onPlant ? t.x : t.x + t.nx;
    const y = onPlant ? t.y : t.y + t.ny;
    const z = onPlant ? t.z : t.z + t.nz;
    if (!w.inBounds(x, y, z)) {
      this.deny(WORLD_EDGE);
      return;
    }
    const stack = this.inventory.slot(this.selectedSlot);
    if (!stack) {
      this.deny(EMPTY_HAND);
      return;
    }
    const id = stack.id;
    if (isPlantId(id)) {
      // Une fleur se pose sur un bloc plein, dans l'air (pas dans l'eau).
      const cell = w.get(x, y, z);
      if (!isOpaqueId(w.get(x, y - 1, z)) || !(cell === BlockId.Air || isPlantId(cell))) {
        this.deny(FLOWER_NEEDS_GROUND);
        return;
      }
    } else if (boxesIntersect(blockBox(x, y, z), this.player.box())) {
      this.deny(NO_SPACE);
      return;
    }
    const replaced = w.get(x, y, z);
    if (replaced === id || !w.set(x, y, z, id)) return;
    this.inventory.takeFrom(this.selectedSlot);
    if (isPlantId(replaced)) this.inventory.add(replaced);
    this.sounds.play("place", id);
    this.refreshInventory();
    if (!this.inventory.slot(this.selectedSlot)) this.tell(emptiedText(id), { ms: 2200 });
  }

  private testStorage(): void {
    try {
      localStorage.setItem("cubes:test", String(Date.now()));
      this.storageOk = localStorage.getItem("cubes:test") ? "ok" : "lecture vide";
    } catch (err) {
      this.storageOk = `erreur : ${String(err)}`;
    }
  }

  private setupVoicePanel(): void {
    const hud = this.hud;
    hud.voiceResult.textContent = "Chargement des voix…";
    const refresh = () => {
      const fr = this.speech.frenchVoices();
      const all = this.speech.allVoices();
      const local = fr.filter((v) => v.localService).length;
      const list = fr.length > 0 ? fr : all;
      hud.setVoices(list, this.speech.pickVoice()?.voiceURI ?? null);
      hud.voiceResult.textContent = this.speech.supported
        ? `${fr.length} voix française(s) dont ${local} locale(s) (hors ligne), sur ${all.length} voix au total`
        : "Synthèse vocale non disponible dans ce navigateur";
    };
    void this.speech.whenReady().then(refresh);
    this.speech.onVoicesChanged(refresh);
    hud.voiceSelect.addEventListener("change", () => {
      this.speech.preferredVoiceUri = hud.voiceSelect.value || null;
    });
    hud.speakButton.addEventListener("click", async () => {
      hud.voiceResult.textContent = "Lecture…";
      const t0 = performance.now();
      const r = await this.speech.speak(hud.voiceText.value);
      const ms = Math.round(performance.now() - t0);
      hud.voiceResult.textContent = r.ok ? `Lecture terminée (${ms} ms)` : `Échec : ${r.error ?? "inconnu"}`;
    });
  }

  /** Accès pour les tests de fumée (et la curiosité de l'adulte, depuis la console du navigateur). */
  private exposeDebug(): void {
    const api = {
      version: VERSION,
      state: () => ({
        type: this.gen.type,
        seed: this.gen.seed,
        spawn: this.gen.spawn,
        player: { x: this.player.x, y: this.player.y, z: this.player.z, onGround: this.player.onGround, inWater: this.player.inWater, headInWater: this.player.headInWater },
        hour: this.sky.hour,
        night: this.sky.night,
        brightness: this.sky.brightness,
        loading: this.loading,
        pending: this.view.chunks.stats.pending,
        faces: this.view.chunks.stats.faces,
        calls: this.renderCalls,
        triangles: this.renderTriangles,
        contextLost: this.view.contextLost,
        contextLosses: this.view.contextLosses,
        renderDistance: this.view.renderDistance,
        target: this.target ? { ...this.target } : null,
        slot: this.selectedSlot,
        inventory: this.inventory.slots(),
        breakProgress: this.breaker.progress,
        level: this.narrator.level,
        voice: this.narrator.voice,
        sound: this.sounds.state,
      }),
      /** Donne des blocs (tests) : renvoie le résultat de l'ajout. */
      give: (id: number, n = 1) => {
        const r = this.inventory.add(id as BlockId, n);
        this.refreshInventory();
        return r;
      },
      clearInventory: () => this.inventory.clear(),
      fillInventory: () => this.fillTestKit(),
      selectSlot: (i: number) => this.setSlot(i),
      setHour: (h: number) => this.setHour(h),
      /** Oriente le regard (degrés ; cap 0 = vers −Z, inclinaison positive = vers le haut). */
      look: (yawDeg: number, pitchDeg: number) => {
        this.player.yaw = (yawDeg * Math.PI) / 180;
        this.player.pitch = (pitchDeg * Math.PI) / 180;
      },
      teleport: (x: number, y: number, z: number) => this.player.setPosition(x, y, z),
      block: (x: number, y: number, z: number) => this.world.get(x, y, z),
      standY: (x: number, z: number) => this.world.findStandingY(x, z),
      newWorld: (type: WorldTypeId, seed: number) => this.newWorld(type, seed),
      /** Couleur d'un pixel de l'image (fx, fy dans [0, 1], depuis le haut à gauche), lue juste après le rendu. */
      samplePixel: (fx: number, fy: number) => new Promise<number[]>((resolve) => this.pixelRequests.push({ fx, fy, resolve })),
      loseContext: () => this.view.renderer.forceContextLoss(),
      restoreContext: () => this.view.renderer.forceContextRestore(),
    };
    (window as unknown as { cubesDebug: typeof api }).cubesDebug = api;
  }

  private frame(now: number): void {
    const t0 = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Regard
    const m = this.mouse.consume();
    const t = this.touch.consumeLook();
    this.player.rotate(m.yaw + t.yaw, m.pitch + t.pitch);

    // Déplacement
    const kx = this.keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]);
    const kz = this.keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]);
    this.player.update(dt, {
      x: kx + this.touch.moveX,
      z: kz + this.touch.moveZ,
      jump: this.keyboard.isDown("Space") || this.touch.jumpPressed,
      down: this.keyboard.isDown("ShiftLeft") || this.keyboard.isDown("ShiftRight"),
    });

    // Caméra
    const eye = this.player.eye();
    this.view.camera.position.set(eye.x, eye.y, eye.z);
    this.view.camera.rotation.order = "YXZ";
    this.view.camera.rotation.set(this.player.pitch, this.player.yaw, 0);

    // Jour et nuit, eau
    this.phase = (this.phase + (dt * 1000 * this.timeScale) / DAY_CYCLE_MS) % 1;
    this.sky = skyState(solarTime(this.phase));
    this.view.setSky(this.sky);
    this.view.setUnderwater(this.player.headInWater);
    this.hud.setUnderwater(this.player.headInWater);

    // Visée, casse par appui maintenu, sac
    this.target = raycast(this.world, eye, this.player.lookDir(), REACH);
    if (this.target) this.view.setHighlight(this.target.x, this.target.y, this.target.z);
    else this.view.hideHighlight();
    this.updateBreaking(performance.now(), dt * 1000);
    this.refreshInventory();

    // Monde : sections à (re)mailler, les plus proches d'abord
    const pendingNear = this.view.chunks.pendingNear(this.player.x, this.player.z, LOADING_RADIUS);
    this.loading = pendingNear > 0;
    this.view.chunks.update(eye.x, eye.y, eye.z, this.loading ? MESH_BUDGET_LOADING_MS : MESH_BUDGET_MS);
    this.hud.setLoading(this.loading ? 1 - pendingNear / this.nearSections : null);

    // Rendu
    this.view.render();
    const info = this.view.renderer.info.render;
    this.renderCalls = info.calls;
    this.renderTriangles = info.triangles;
    this.servePixelRequests();

    this.cpuTimes.push(performance.now() - t0);
    if (this.cpuTimes.length > 60) this.cpuTimes.shift();
    this.updateStats(now, dt);
    requestAnimationFrame((n) => this.safeFrame(n));
  }

  private servePixelRequests(): void {
    if (this.pixelRequests.length === 0 || this.view.contextLost) return;
    const gl = this.view.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    for (const r of this.pixelRequests.splice(0)) {
      const x = Math.min(w - 1, Math.max(0, Math.floor(r.fx * w)));
      const y = Math.min(h - 1, Math.max(0, Math.floor((1 - r.fy) * h)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      r.resolve(Array.from(px));
    }
  }

  private updateStats(now: number, dt: number): void {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    // Mise à jour de l'affichage 4 fois par seconde
    if (Math.floor(now / 250) === Math.floor((now - dt * 1000) / 250)) return;
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const frameAvg = avg(this.frameTimes);
    const worst = Math.max(...this.frameTimes);
    const cpuAvg = avg(this.cpuTimes);
    const cpuWorst = Math.max(...this.cpuTimes);
    const p = this.player;
    const deg = (r: number) => Math.round((r * 180) / Math.PI);
    const cap = ((deg(p.yaw) % 360) + 360) % 360;
    const cs = this.view.chunks.stats;
    const w = this.world;
    const where = p.headInWater ? "sous l'eau" : p.inWater ? "dans l'eau" : p.onGround ? "sol" : "air";
    this.hud.setInfo(
      `${Math.round(1000 / frameAvg)} i/s  (moy. ${frameAvg.toFixed(1)} ms, pire ${worst.toFixed(0)} ms, calcul ${cpuAvg.toFixed(1)} ms)\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ${where}  regard ${cap}° ${deg(p.pitch)}°\n` +
        `faces ${cs.faces}  sections ${cs.visibleSections}/${cs.sections}  bloc : ${this.heldLabel()}\n` +
        `${worldTypeName(this.gen.type)} · graine ${this.gen.seed} · ${formatHour(this.sky.hour)}  ${VERSION}`,
    );
    const g = this.view.gpu;
    const ml = this.mouse;
    this.hud.setDiagnostics(
      [
        `Version : ${VERSION}`,
        `Monde : ${worldTypeName(this.gen.type)}, graine ${this.gen.seed}, ${w.sizeX}×${w.sizeY}×${w.sizeZ}, arbres ${this.gen.stats.trees}, fleurs ${this.gen.stats.flowers}, cactus ${this.gen.stats.cacti}`,
        `Rendu : distance ${this.view.renderDistance} blocs, sections affichées ${cs.visibleSections}/${cs.sections}, en attente ${cs.pending}, appels ${this.renderCalls}, triangles ${this.renderTriangles}`,
        `Calcul par image (hors attente de l'écran) : moy. ${cpuAvg.toFixed(1)} ms, pire ${cpuWorst.toFixed(1)} ms`,
        `Heure : ${formatHour(this.sky.hour)} (${this.sky.night ? "nuit" : "jour"}), vitesse ×${this.timeScale}`,
        `Adresse : ${location.protocol}//${location.host || "(fichier local)"}`,
        `Navigateur : ${navigator.userAgent}`,
        `Écran : ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio}× (rendu ${g.pixelRatio}×)`,
        `Tactile : pointeur principal ${this.coarsePointer ? "doigt" : "souris"}, interface tactile ${
          this.touchUi ? "affichée" : "masquée"
        } (${navigator.maxTouchPoints} points)`,
        `WebGL2 : ${g.webgl2 ? "oui" : "non"} — ${g.renderer}`,
        `Pointer Lock : ${ml.supported ? "disponible" : "absent"}, ${ml.locked ? "actif" : "inactif"}${ml.inFallback() ? ", mode repli" : ""}, captures ${ml.locks}, écartés ${
          ml.rejectedSettle
        } après capture et ${ml.rejectedLarge} trop grands (> ${MAX_DELTA_PX} px), plus grand reçu ${ml.maxDelta} px${ml.lastError ? `, erreur : ${ml.lastError}` : ""}`,
        `Contexte 3D : ${this.view.contextLost ? "perdu" : "ok"}, perdu ${this.view.contextLosses} fois`,
        `Stockage local : ${this.storageOk}`,
        `Synthèse vocale : ${this.speech.supported ? "disponible" : "absente"}`,
        `Sons : ${this.sounds.state}`,
        `Lecture : ${this.narrator.level}, voix ${this.narrator.voice ? "active" : "coupée"}`,
        `Sac : ${this.inventory.usedSlots()}/${this.inventory.size} cases, ${this.inventory.totalBlocks()} blocs`,
      ].join("\n"),
    );
  }
}
