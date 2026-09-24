import { Sounds } from "../audio/sounds";
import { BlockId, breakDurationMs, HOTBAR_BLOCKS, isOpaqueId, isPlantId } from "../engine/blocks";
import { BreakTracker, type BlockPos } from "../engine/breaking";
import { DAY_CYCLE_MS, formatHour, phaseForHour, skyState, solarTime, type SkyState } from "../engine/dayNight";
import { Inventory, MAX_STACK, type AddResult } from "../engine/inventory";
import { blockBox, boxesIntersect } from "../engine/physics";
import { raycast, type RayHit } from "../engine/raycast";
import { generateWorld, randomSeed, worldTypeName, parseWorldType, type GeneratedWorld, type WorldTypeId } from "../engine/terrain";
import type { World } from "../engine/World";
import { emptiedText, maxStackText, pickupSpeech, pickupText, shouldSpeakPickup } from "../edu/counting";
import { Narrator, type TellOptions } from "../edu/Narrator";
import { Speech } from "../edu/speech";
import {
  BOTTOM_LAYER,
  EMPTY_HAND,
  FLOWER_IN_WATER,
  FLOWER_NEEDS_GROUND,
  FULL_BAG,
  HINTS,
  HOLD_TO_BREAK,
  IMAGE_BACK,
  IMAGE_LOST,
  MOUSE_FALLBACK,
  MOUSE_RESUME,
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
import { DEFAULT_RENDER_DISTANCE, DISTANCE_STORAGE_KEY, initialRenderDistance } from "./renderDistance";
import { formatUrlOptions, parseSeed, parseUrlOptions } from "./urlOptions";

const REACH = 6;
export const VERSION = "J3";
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
/** Kit du bouton « Compléter le sac » du panneau (les planches ne se ramassent pas encore dans la nature). */
const TEST_KIT_COUNT = 20;
/** Molette : défilement cumulé (px) pour passer d'une case à la suivante, et délai minimal entre deux cases dans le même sens (ms). */
const WHEEL_STEP_PX = 60;
const WHEEL_MIN_INTERVAL_MS = 90;

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
  /** Types déjà ramassés dans ce monde : « ton premier tronc » n'est dit qu'une fois. */
  private readonly collectedTypes = new Set<BlockId>();
  private readonly spokenLog: string[] = [];
  /** Type du dernier ramassage envoyé à la voix (sa lecture peut encore attendre, voir collect). */
  private voicedPickupId: BlockId | null = null;
  /** Appui pendant lequel « Ça ne se casse pas » a déjà été dit (couche du bas). */
  private bottomToldFor: BreakPress | null = null;
  private wheelAccum = 0;
  private lastWheelStepAt = -Infinity;
  private lastWheelDir = 0;
  private lastStatsAt = -Infinity;
  /**
   * Activation par l'utilisateur : le navigateur refuse la voix avant un vrai
   * geste (relâchement du doigt, clic, touche). Une phrase demandée avant est
   * gardée et lue au premier geste ; la consigne d'accueil aussi.
   */
  private activated = false;
  private queuedSpeech: string | null = null;
  private welcomeSpoken = false;
  private wasFallback = false;

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
    this.view.setRenderDistance(initialRenderDistance(opts.distance, readStorage(DISTANCE_STORAGE_KEY)));
    this.hud = new Hud(root, this.view.atlasCanvas, VERSION);
    this.narrator = new Narrator({
      show: (text, ms) => this.hud.showMessage(text, ms),
      speak: (text) => {
        // Journal des phrases demandées à la voix (tests de fumée : le cloud n'a pas de voix à écouter).
        this.spokenLog.push(text);
        if (this.spokenLog.length > 20) this.spokenLog.shift();
        this.speakWhenAllowed(text);
      },
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
    // La consigne est lue au premier geste (voir onActivation).
    this.hud.showMessage(`Bienvenue dans Cubes (prototype ${VERSION})\n${pick(WELCOME, this.narrator.level)}`, 5000);
    this.watchActivation();

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
      history.replaceState(null, "", this.urlOptions());
    } catch {
      // Adresse non modifiable (certains navigateurs en file://) : sans conséquence.
    }
    this.nearSections = Math.max(1, this.view.chunks.pendingNear(this.player.x, this.player.z, LOADING_RADIUS));
    // Vrai chargement (nouveau monde) : levé une fois le voisinage construit ; un bloc cassé ne le remet pas.
    this.loading = true;
  }

  /** Adresse du monde affiché (type, graine, distance si elle diffère de la valeur par défaut). */
  private urlOptions(): string {
    return formatUrlOptions(this.gen.type, this.gen.seed, this.view.renderDistance, DEFAULT_RENDER_DISTANCE);
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
    this.collectedTypes.clear();
    this.narrator.cancelPending();
    this.afterWorldChange();
    this.hud.showMessage(`Nouveau monde : ${worldTypeName(type)} (graine ${seed})`, 3000);
  }

  private updateHint(): void {
    const h = this.touchUi
      ? this.touch.mode === "place"
        ? HINTS.touchPlace
        : HINTS.touch
      : this.mouse.inFallback()
        ? HINTS.mouseFallback
        : HINTS.mouse;
    this.hud.setHint(pick(h, this.narrator.level));
  }

  /** Premier vrai geste (le navigateur autorise alors la voix) : lit la phrase en attente ou la consigne d'accueil. */
  private watchActivation(): void {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    const events = ["pointerup", "touchend", "keydown", "click"] as const;
    const onGesture = () => {
      if (ua && !ua.hasBeenActive) return; // ce geste-là ne suffit pas encore (ex. doigt encore posé)
      this.activated = true;
      for (const ev of events) window.removeEventListener(ev, onGesture, true);
      window.setTimeout(() => this.onActivation(), 0);
    };
    for (const ev of events) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  }

  private onActivation(): void {
    const q = this.queuedSpeech;
    this.queuedSpeech = null;
    if (q !== null) {
      this.welcomeSpoken = true;
      void this.speech.speak(q);
      return;
    }
    if (this.welcomeSpoken || this.narrator.hasPending) return;
    this.welcomeSpoken = true;
    this.tell(WELCOME, { ms: 3000 });
  }

  /** Lit tout de suite si le navigateur le permet, sinon garde la phrase (la dernière) pour le premier geste. */
  private speakWhenAllowed(text: string): void {
    if (!this.activated) {
      this.queuedSpeech = text;
      return;
    }
    this.welcomeSpoken = true;
    void this.speech.speak(text);
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
    this.view.renderer.domElement.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    // Aussi sur la barre : c'est là que l'enfant tourne la molette pour choisir (souris non capturée).
    this.hud.hotbar.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });

    this.mouse.onAction(() => this.placeBlock());
    this.mouse.onBreakRelease((p) => this.onBreakRelease(p));
    this.mouse.onLockChange((locked) => {
      this.hud.lockButton.textContent = locked ? "Souris capturée (Échap)" : "Capturer la souris";
      this.updateHint();
      const fallback = this.mouse.inFallback();
      const enteredFallback = fallback && !this.wasFallback;
      this.wasFallback = fallback;
      if (locked || this.touchUi) return;
      // Le repli n'est annoncé qu'à son entrée, pas à chaque recapture refusée.
      if (enteredFallback) this.tell(MOUSE_FALLBACK, { ms: 3500, dedupe: true });
      else if (!fallback) this.tell(MOUSE_RESUME, { ms: 2500, dedupe: true });
    });
    this.touch.onAction(() => this.placeBlock());
    this.touch.onFullscreenRequest(() => void this.toggleFullscreen());
    // Pas de menu contextuel du navigateur sur le jeu (appui long au doigt, clic droit hors de la vue 3D) :
    // « Actualiser » y ferait perdre la construction. Les champs du panneau le gardent (copier, coller).
    document.addEventListener("contextmenu", (e) => {
      const t = e.target;
      if (t instanceof Element && (t.closest(".fatal") || (t.closest(".panel") && t.matches("input, textarea, select")))) return;
      e.preventDefault();
    });
    this.touch.onModeChange(() => this.updateHint());
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
      // Distance tapée dans l'adresse : appliquée et retenue comme un choix du panneau.
      if (o.distance !== undefined && o.distance !== this.view.renderDistance) {
        this.view.setRenderDistance(o.distance);
        this.hud.setDistance(o.distance);
        writeStorage(DISTANCE_STORAGE_KEY, String(o.distance));
      }
      const type = o.type ?? this.gen.type;
      const seed = o.seed ?? this.gen.seed;
      if (type !== this.gen.type || seed !== this.gen.seed) this.newWorld(type, seed);
    });

    this.view.onContextChange((lost) => {
      this.tell(lost ? IMAGE_LOST : IMAGE_BACK, { ms: 2500, dedupe: true });
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
      if (!Number.isFinite(d)) return;
      this.view.setRenderDistance(d);
      // Choix de l'adulte retenu (J3) : au prochain démarrage, et dans l'adresse (un rechargement le garde).
      writeStorage(DISTANCE_STORAGE_KEY, String(d));
      try {
        history.replaceState(null, "", this.urlOptions());
      } catch {
        // Adresse non modifiable : sans conséquence, le stockage local suffit.
      }
    });
    hud.levelSelect.addEventListener("change", () => {
      const level = parseReadingLevel(hud.levelSelect.value);
      if (level) this.narrator.setLevel(level);
      this.syncGameControls();
      this.updateHint();
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

  /** Complète le sac jusqu'à 20 de chaque bloc du kit, sans rien retirer de ce qui a été ramassé. */
  private fillTestKit(): void {
    for (const id of HOTBAR_BLOCKS) {
      const missing = TEST_KIT_COUNT - this.inventory.count(id);
      if (missing > 0) this.inventory.add(id, missing); // sac plein : ce bloc-là n'entre pas, sans conséquence
    }
    this.refreshInventory();
    this.setSlot(this.selectedSlot, true);
  }

  /** Molette : une case par cran, même avec un pavé tactile qui envoie des rafales de petits défilements. */
  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
    if (!Number.isFinite(px) || px === 0) return;
    if (Math.sign(px) !== Math.sign(this.wheelAccum)) this.wheelAccum = 0;
    this.wheelAccum += px;
    const now = performance.now();
    if (Math.abs(this.wheelAccum) < WHEEL_STEP_PX) return;
    const dir = this.wheelAccum > 0 ? 1 : -1;
    // Le délai minimal n'absorbe que l'inertie (même sens) : un retour en arrière passe tout de suite.
    if (dir === this.lastWheelDir && now - this.lastWheelStepAt < WHEEL_MIN_INTERVAL_MS) {
      this.wheelAccum = 0; // inertie absorbée : rien n'est gardé pour plus tard
      return;
    }
    this.wheelAccum = 0;
    this.lastWheelStepAt = now;
    this.lastWheelDir = dir;
    const n = this.inventory.size;
    this.setSlot((this.selectedSlot + dir + n) % n, true);
  }

  setHour(hour: number): void {
    this.phase = phaseForHour(hour);
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // Pas de verrouillage d'orientation (J3) : le convertible se joue en portrait comme en paysage,
        // et Firefox sur PC ne le permet pas ; la rotation se règle dans Windows.
        await document.documentElement.requestFullscreen();
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
    this.tell(text, { ms: 1800, dedupe: true });
  }

  /** Casse par appui maintenu : appelé à chaque image. */
  private updateBreaking(now: number, dtMs: number): void {
    const press = this.mouse.breakPress ?? this.touch.breakPress;
    let holding = isHolding(press, now);
    const t = this.target;
    const id = t ? this.world.get(t.x, t.y, t.z) : BlockId.Air;
    if (holding && press && t) {
      const brokeThisPress = this.lastBreakAt >= press.since;
      if (t.y === 0 && !isPlantId(id)) {
        // Couche du bas : pas d'anneau qui promet une casse impossible. Dit une fois, et seulement
        // si l'enfant la vise dès le début de l'appui (pas au bout d'une série : le compte passe avant).
        holding = false;
        if (!brokeThisPress && this.bottomToldFor !== press) {
          this.bottomToldFor = press;
          this.deny(BOTTOM_LAYER);
        }
      } else if (brokeThisPress && t.y < Math.floor(this.player.y + 0.001)) {
        // Un bloc déjà cassé pendant cet appui : on ne creuse plus plus bas que ses pieds, dans aucune
        // colonne (en diagonale, le puits se formerait juste devant). Un nouvel appui en casse un de plus ;
        // si l'enfant tombe dans un trou, l'escalade de secours l'en sort (voir Player).
        holding = false;
      }
    }
    // Tant que l'enfant garde l'appui, le compte attend : il sera lu au relâchement, pas coupé par la casse suivante.
    if (holding) this.narrator.snooze(PICKUP_VOICE_DELAY_MS);
    const pos: BlockPos | null = t ? { x: t.x, y: t.y, z: t.z } : null;
    const duration = t ? breakDurationMs(id) : 0;
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
    this.tell(HOLD_TO_BREAK, { ms: 2000, dedupe: true });
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
    // Le bloc cassé d'abord (il passe en main si elle est vide, et c'est lui qu'on annonce),
    // puis la fleur posée dessus, qui tombe avec lui et rejoint le sac sans message.
    const above = w.get(x, y + 1, z);
    this.collect(id);
    if (isPlantId(above) && w.set(x, y + 1, z, BlockId.Air)) this.collect(above, false);
  }

  /**
   * Met un bloc dans le sac. announce : affiche et lit le nouveau compte (ou
   * le refus : sac plein, maximum). Sans annonce, seuls le son et
   * l'animation de la case signalent le ramassage.
   */
  private collect(id: BlockId, announce = true): AddResult {
    const r = this.inventory.add(id);
    if (!r.ok) {
      if (announce) this.tell(r.reason === "full" ? FULL_BAG : maxStackText(id, MAX_STACK), { ms: 2500 });
      return r;
    }
    const first = !this.collectedTypes.has(id);
    this.collectedTypes.add(id);
    this.sounds.play("pickup", id);
    this.hud.pulseSlot(r.slot);
    // Main vide : le bloc annoncé passe dans la main (premier ramassage, case épuisée…).
    if (announce && !this.inventory.slot(this.selectedSlot)) this.setSlot(r.slot);
    this.refreshInventory();
    if (announce) {
      // Voix au premier bloc d'un type et aux paliers (5, 10…) ; entre les deux, l'écran seul.
      const voice = shouldSpeakPickup(r.count, this.narrator.hasPending && this.voicedPickupId === id);
      if (voice) this.voicedPickupId = id;
      this.tell(pickupText(id, r.count, first), {
        spoken: pickupSpeech(id, r.count, first),
        voiceDelayMs: PICKUP_VOICE_DELAY_MS,
        voice,
        ms: 1800,
      });
    }
    return r;
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
      if (cell === BlockId.Water) {
        this.deny(FLOWER_IN_WATER);
        return;
      }
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
    const emptied = this.inventory.count(id) === 0;
    this.sounds.play("place", id);
    // Fleur remplacée par le bloc posé : elle est cueillie (comptée, ou « sac plein » si elle ne rentre pas).
    if (isPlantId(replaced)) this.collect(replaced);
    this.refreshInventory();
    // Dit en dernier : c'est l'information utile (la main est vide, ou tient la fleur cueillie).
    if (emptied) this.tell(emptiedText(id), { ms: 2200 });
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
        player: {
          x: this.player.x,
          y: this.player.y,
          z: this.player.z,
          onGround: this.player.onGround,
          inWater: this.player.inWater,
          headInWater: this.player.headInWater,
          climbing: this.player.climbing,
        },
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
        fov: this.view.camera.fov,
        target: this.target ? { ...this.target } : null,
        slot: this.selectedSlot,
        inventory: this.inventory.slots(),
        breakProgress: this.breaker.progress,
        breakPress: this.mouse.breakPress ?? this.touch.breakPress,
        touchMode: this.touch.mode,
        level: this.narrator.level,
        voice: this.narrator.voice,
        spoken: [...this.spokenLog],
        sound: this.sounds.state,
      }),
      /** Donne des blocs (tests) : renvoie le résultat de l'ajout. */
      give: (id: number, n = 1) => {
        const r = this.inventory.add(id as BlockId, n);
        this.refreshInventory();
        return r;
      },
      clearInventory: () => this.inventory.clear(),
      /** Pose un bloc sans passer par le sac (préparer un scénario de test). */
      setBlock: (x: number, y: number, z: number, id: number) => this.world.set(x, y, z, id as BlockId),
      /** Casse un bloc comme au terme d'un appui maintenu (règles du jeu comprises : ramassage, fleur au-dessus…). */
      breakBlock: (x: number, y: number, z: number) => this.breakBlock({ x, y, z }),
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
    const frameMs = Math.max(0, now - this.lastTime);
    const dt = Math.min(frameMs / 1000, 0.05);
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
    if (pendingNear === 0) this.loading = false;
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
    this.updateStats(now, frameMs);
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

  private updateStats(now: number, frameMs: number): void {
    // Durée réelle de l'image (non bornée) : le diagnostic doit montrer les vraies lenteurs.
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    // Mise à jour de l'affichage 4 fois par seconde, même quand les images sont très lentes.
    if (now - this.lastStatsAt < 250) return;
    this.lastStatsAt = now;
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
        `Fenêtre : ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio}× (rendu ${g.pixelRatio}×), écran ${screen.width}×${screen.height}, champ de vision ${Math.round(this.view.camera.fov)}° vertical${document.fullscreenElement ? ', plein écran' : ''}`,
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

/** Lecture du stockage local sans exception (stockage bloqué ou indisponible : null). */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : le choix vaut pour cette séance seulement.
  }
}
