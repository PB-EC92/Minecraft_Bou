import { Sounds } from "../audio/sounds";
import { BlockId, blockDef, breakDurationMs, dropsOf, HOTBAR_BLOCKS, isOpaqueId, isPlantId } from "../engine/blocks";
import { BreakTracker, type BlockPos } from "../engine/breaking";
import { advancePhase, formatHour, phaseForHour, skyState, solarTime, type SkyState } from "../engine/dayNight";
import { Inventory, MAX_STACK, type AddResult } from "../engine/inventory";
import { blockBox, boxesIntersect } from "../engine/physics";
import { raycast, type RayHit } from "../engine/raycast";
import { generateWorld, GENERATOR_VERSION, randomSeed, worldTypeName, parseWorldType, type GeneratedWorld, type WorldTypeId } from "../engine/terrain";
import type { World } from "../engine/World";
import { emptiedText, emptySlotText, goalReachedText, maxStackText, pickupSpeech, pickupText, quantity, returnedText, rewardText, shouldSpeakPickup, stolenText } from "../edu/counting";
import { BRAVO, MISSION_1, MissionRunner, nextMission, resumeMission, stepText, TUTORIAL, type MissionDef, type MissionView } from "../edu/missions";
import { CreatureSim, LAMP_RADIUS } from "../engine/creatures";
import { checkShelter, SHELTER_WALLS_NEEDED, type ShelterCheck } from "../engine/shelter";
import { pitState } from "../engine/pit";
import { Narrator, speechMs, type TellOptions } from "../edu/Narrator";
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
  LAMP_SCARES,
  NIGHT_COMING,
  pick,
  BACK_TO_LAMP,
  bravoTitle,
  FULL_BAG_KEEP,
  NO_FULLSCREEN,
  OPENED_ELSEWHERE,
  PIT_CLIMB,
  PIT_CLIMB_TOUCH,
  PLACE_LAMP_AGAIN,
  WALLED_IN,
  SPOKEN_TIPS,
  REWARD_WAITING,
  SAVED,
  SHELTER_NO_ROOF,
  SHELTER_NO_WALLS,
  SHELTER_NOT_OWN,
  VIEW_FIRST,
  VIEW_THIRD,
  WELCOME,
  WORLD_EDGE,
  type ChildText,
} from "../edu/texts";
import { isHolding, shouldHintHold, type BreakPress } from "../input/breakPress";
import { Keyboard } from "../input/Keyboard";
import { MAX_DELTA_PX } from "../input/mouseFilter";
import { MouseLook } from "../input/MouseLook";
import { TouchControls } from "../input/TouchControls";
import { Avatar } from "../render/Avatar";
import { Bubbles } from "../render/Bubbles";
import { Critters } from "../render/Critters";
import { Fox } from "../render/Fox";
import { LampGlow } from "../render/LampGlow";
import { SceneView } from "../render/SceneView";
import { SaveStore } from "../save/SaveStore";
import { DEFAULT_SETTINGS, KEYS, SAVE_VERSION, type Profile, type Settings, type WorldSave } from "../save/saveFormat";
import { applyDiff, diffBlocks, fromBase64, toBase64 } from "../save/worldDiff";
import { HomeScreen } from "../ui/HomeScreen";
import { Celebration, type CelebrationLine } from "../ui/Celebration";
import { setShelterParts, shelterIcon } from "../ui/shelterIcon";
import { tileIcon } from "../render/textures";
import { isInventoryBlockId } from "../engine/inventory";
import { avatarDef } from "./avatars";
import { thirdPersonCamera } from "./thirdPerson";
import { companionGoal, landingSpot, stepCompanion, type CompanionState } from "./companion";
import { showFatalError } from "../ui/fatal";
import { HOUR_PRESETS, Hud } from "../ui/Hud";
import { Player } from "./Player";
import { DEFAULT_RENDER_DISTANCE, DISTANCE_STORAGE_KEY, initialRenderDistance } from "./renderDistance";
import { formatUrlOptions, parseSeed, parseUrlOptions } from "./urlOptions";
import { GAME_NAME, VERSION } from "./identity";

const REACH = 6;
export { VERSION } from "./identity";
/** Sauvegarde automatique pendant une partie (ms). */
const AUTOSAVE_MS = 30_000;
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
/** Dernière étape de la mission 1 : le temps file jusqu'à la nuit (un enfant de 6 ans n'attendrait pas 7 minutes). */
const WATCH_TIME_BOOST = 30;
/** Dernière étape, la nuit : sans Grignotes (réglage), l'étape se valide après ce délai ; avec, au plus tard après le second (ms). */
const WATCH_NO_CREATURES_MS = 4000;
/** Cumulé sur toutes les nuits de l'étape : la nuit « courte » (mode parent) ne dure qu'une minute. */
const WATCH_FALLBACK_MS = 40_000;
/** Conseils de Pixel pendant la construction de l'abri et la dernière étape : pas plus souvent que (ms). */
const SHELTER_HINT_EVERY_MS = 12_000;
const LAMP_HINT_EVERY_MS = 12_000;
/** Délai entre la fin d'une mission et la suite (mission suivante, écran de félicitations) (ms). */
const NEXT_MISSION_DELAY_MS = 3200;
/** Étape qui n'avance plus (J7) : délai avant le conseil de Pixel, puis écart entre deux conseils (ms). */
const STALL_HINT_MS = 40_000;
const STALL_HINT_EVERY_MS = 60_000;
/** Enfant coincé (J7) : après ce temps passé à pousser contre les parois, Pixel explique comment sortir ; pas plus souvent que. */
const STUCK_HINT_AFTER_MS = 4000;
const STUCK_HINT_EVERY_MS = 20_000;
const CELEBRATION_DELAY_MS = 4000;

interface PixelRequest {
  fx: number;
  fy: number;
  resolve: (rgba: number[]) => void;
}

/**
 * Assemble tout : monde, rendu, joueur, entrées, HUD, boucle de jeu.
 * J6 : tutoriel (une fois par enfant), mission 1 complète (abri vérifié, lampe,
 * nuit), écran de félicitations et cadeau.
 * J1 : monde généré par type et graine, jour/nuit, eau.
 * J2 : casse par appui maintenu, blocs ramassés dans un sac de 9 cases
 * (poser consomme), sons synthétisés, compte lu à voix haute.
 * J4 : écran d'accueil (profils, trois mondes par enfant), sauvegarde
 * automatique, mode parent, avatar et vue à la troisième personne.
 * L'adresse #monde=…&graine=… (tests, adulte) saute l'accueil : partie sans sauvegarde.
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

  /** Démarré par l'adresse (#monde=…) : pas d'accueil ni de sauvegarde (tests de fumée, adulte). */
  private readonly urlMode: boolean;
  private readonly store = new SaveStore();
  private settings: Settings;
  private readonly home: HomeScreen | null = null;
  /** Partie en cours d'un profil, dans un de ses emplacements (null : accueil ou mode adresse). */
  private session: { profile: Profile; slot: number } | null = null;
  /** Blocs du monde tel que généré : la sauvegarde n'enregistre que l'écart avec lui. */
  private baseData: Uint8Array;
  /** Version du générateur qui a produit ce monde (un monde enregistré en version 1 reste en version 1). */
  private worldGen = GENERATOR_VERSION;
  private paused = false;
  private lastAutosaveAt = performance.now();
  private lastSavedAt = 0;
  private saveError: string | null = null;
  private thirdPerson = false;
  private avatar: Avatar;
  private readonly homeButton: HTMLButtonElement;
  private readonly viewButton: HTMLButtonElement;

  // ---------- J5 : compagnon, mission, Grignotes, bulles, lampes ----------
  private readonly urlCreatures: boolean;
  private readonly urlMission: boolean;
  private readonly sim: CreatureSim;
  private readonly critters = new Critters();
  private readonly fox = new Fox();
  private readonly bubbles = new Bubbles();
  private readonly lampGlow = new LampGlow();
  private companion: CompanionState | null = null;
  private mission: MissionRunner | null = null;
  /** Date (performance.now) à laquelle annoncer l'étape en cours (après l'intro ou un « bravo »). */
  private announceStepAt: number | null = null;
  private missionDoneAt = 0;
  private lamps: { x: number; y: number; z: number }[] = [];
  private lampsDirty = true;
  private lastBubbleAt = -Infinity;
  private lampScareToldAt = -Infinity;
  private prevHour = 0;
  private readonly companionPanel: HTMLDivElement;
  private readonly companionText: HTMLSpanElement;
  private readonly companionProgress: HTMLSpanElement;
  private readonly bubbleButton: HTMLButtonElement;

  // ---------- J6 : tutoriel, abri, nuit de la mission 1, félicitations ----------
  private readonly companionShelter: SVGSVGElement;
  private readonly celebration: Celebration;
  /** Abri autour de l'enfant (calculé à chaque image pendant l'étape « abri »). */
  private shelterNow: ShelterCheck | null = null;
  private stepStartedAt = 0;
  private lastShelterHintAt = -Infinity;
  /** Dernière étape de la mission 1 : consigne lue (le temps file), début de la nuit. */
  private watchAnnounced = false;
  /** Temps de nuit passé pendant la dernière étape (ms, cumulé d'une nuit à l'autre). */
  private watchNightMs = 0;
  /** Écran de félicitations à montrer à la reprise (partie quittée juste après la fin de la mission). */
  private celebrateOnResume = false;
  /** Appui pendant lequel « sac plein » a déjà été dit pour un bloc précieux. */
  private fullToldFor: BreakPress | null = null;
  /** Une Grignote a vraiment fui la lampe pendant la dernière étape (la découverte sera dite). */
  private watchSawScare = false;
  private lastLampHintAt = -Infinity;
  /** Mission suivante à lancer (après le tutoriel) et écran de félicitations à montrer, avec leur date. */
  private nextMissionAt: { at: number; def: MissionDef } | null = null;
  private celebrationAt: number | null = null;
  /** Cadeau pas encore entré dans le sac (sac plein) ; enregistré avec le monde. */
  private rewardPending: { block: BlockId; count: number } | null = null;
  private rewardSeenInventory = -1;
  /** Étape qui n'avance plus (J7) : dernier avancement vu, sa date, dernier conseil de Pixel. */
  private stepHave = -1;
  private stepProgressAt = 0;
  private lastStallHintAt = -Infinity;
  /** Icône du bloc demandé dans le bandeau de Pixel (J7) et bloc qu'elle montre. */
  private readonly companionIcon: HTMLCanvasElement;
  private companionIconId: BlockId | null = null;
  /** Début (temps réel) de la poussée en vain contre les parois d'un trou ou d'un abri fermé, et dernier conseil (J7). */
  private stuckSince: number | null = null;
  private lastStuckHintAt = -Infinity;
  /** Position de l'image précédente (pas du tutoriel). */
  private prevX = 0;
  private prevZ = 0;

  constructor(root: HTMLElement) {
    this.coarsePointer = TouchControls.primaryPointerIsTouch();
    this.touchUi = this.coarsePointer;

    const opts = parseUrlOptions(location.hash);
    this.urlMode = opts.type !== undefined || opts.seed !== undefined;
    this.urlCreatures = opts.creatures === true;
    this.urlMission = opts.mission !== undefined;
    // Mode adresse (tests, vérifications de l'adulte) : réglages par défaut, pas ceux du mode parent.
    this.settings = this.urlMode ? { ...DEFAULT_SETTINGS } : this.store.loadSettings();
    document.title = GAME_NAME;
    this.gen = generateWorld(opts.type ?? "prairie", opts.seed ?? randomSeed());
    this.world = this.gen.world;
    this.baseData = this.world.data.slice();
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

    this.avatar = new Avatar(avatarDef(0));
    this.view.scene.add(this.avatar.group);
    this.sim = new CreatureSim(this.world, this.gen.seed);
    this.view.scene.add(this.critters.group, this.fox.group, this.bubbles.group, this.lampGlow.group);
    ({
      panel: this.companionPanel,
      text: this.companionText,
      progress: this.companionProgress,
      shelter: this.companionShelter,
      icon: this.companionIcon,
    } = this.buildCompanionPanel());
    this.celebration = new Celebration(root);
    this.bubbleButton = this.topButton("bubble-btn", "Bulles", '<circle cx="9" cy="14" r="5"/><circle cx="17" cy="8" r="3.2"/><circle cx="18.5" cy="17" r="2"/>');
    // Au doigt, le même bouton rejoint la colonne des boutons tactiles (sous le pouce droit).
    const touchCol = this.touch.root.querySelector(".touch-buttons");
    const touchBubble = document.createElement("button");
    touchBubble.type = "button";
    touchBubble.className = "touch-btn bubble-touch";
    touchBubble.textContent = "Bulles";
    touchBubble.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.throwBubbles();
    });
    touchCol?.appendChild(touchBubble);
    this.homeButton = this.topButton("home-btn", "Accueil", '<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h5v-5h3v5h5V10"/>');
    this.viewButton = this.topButton("view-btn", "Changer de vue", '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>');
    this.homeButton.hidden = true;

    this.wireInputs();
    this.wirePanel();
    this.setSlot(0);
    this.testStorage();
    this.setupVoicePanel();
    this.exposeDebug();

    this.updateHint();
    this.applyDevTools();
    this.hud.setDistance(this.view.renderDistance);
    this.syncGameControls();
    this.refreshInventory();
    // Pas de voix ici : le navigateur la bloque tant que l'enfant n'a ni cliqué ni touché l'écran.
    // La consigne est lue au premier geste (voir onActivation).
    this.watchActivation();
    this.watchSaves();
    if (this.urlMode) {
      this.hud.showMessage(`Bienvenue dans ${GAME_NAME} (${VERSION})\n${pick(WELCOME, this.narrator.level)}`, 5000);
      if (opts.mission !== undefined) this.startMission(undefined, opts.mission === 0 ? TUTORIAL : MISSION_1);
    } else {
      // Accueil : qui joue, quel monde. Le jeu attend derrière, en pause.
      this.paused = true;
      this.welcomeSpoken = true; // la consigne d'accueil n'a pas de sens avant d'avoir choisi un monde
      this.home = new HomeScreen(root, this.store, {
        play: (profile, slot, save, type) => this.startSession(profile, slot, save, type),
        speak: (text, profile) => {
          if (profile.voice) this.speakWhenAllowed(pick(text, profile.level));
        },
        settingsChanged: (s) => {
          this.settings = s;
          this.applyDevTools();
        },
      });
      this.home.show();
    }

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
    this.sim?.setWorld(this.world); // blocs portés par les Grignotes : déjà comptés dans la dernière sauvegarde (snapshot)
    this.lampsDirty = true;
    this.companion = null;
    this.prevHour = -1; // pas de signal de la nuit au chargement d'un monde
    this.hud.setWorldControls(this.gen.type, this.gen.seed);
    // L'adresse ne retient le monde qu'en mode adresse : sinon un rechargement sauterait l'accueil.
    if (this.urlMode) {
      try {
        history.replaceState(null, "", this.urlOptions());
      } catch {
        // Adresse non modifiable (certains navigateurs en file://) : sans conséquence.
      }
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
    this.worldGen = GENERATOR_VERSION;
    this.world = this.gen.world;
    this.baseData = this.world.data.slice();
    this.view.setWorld(this.world);
    this.player = new Player(this.world);
    this.spawnPlayer();
    this.target = null;
    this.breaker.reset();
    // Nouveau monde, nouveau départ : le sac est vidé (la sauvegarde arrive au J4).
    this.inventory.clear();
    this.collectedTypes.clear();
    this.rewardPending = null;
    this.celebrateOnResume = false;
    // Un nouveau monde commence le matin (et non à l'heure du monde précédent, qui a pu finir sa mission la nuit).
    this.phase = phaseForHour(8);
    this.narrator.cancelPending();
    this.afterWorldChange();
    this.hud.showMessage(`Nouveau monde : ${worldTypeName(type)} (graine ${seed})`, 3000);
  }

  /** Recharge un monde enregistré : régénéré depuis sa graine, puis les blocs changés par l'enfant. */
  private loadSave(save: WorldSave): void {
    this.worldGen = Math.min(save.gen, GENERATOR_VERSION);
    this.gen = generateWorld(save.type, save.seed, this.worldGen);
    this.world = this.gen.world;
    this.baseData = this.world.data.slice();
    const edits = fromBase64(save.edits);
    const applied = edits ? applyDiff(this.world.data, edits, (id) => id === BlockId.Air || isInventoryBlockId(id)) : -1;
    const foreign = save.gen > GENERATOR_VERSION || save.version > SAVE_VERSION;
    if (applied < 0 || foreign) {
      // Sauvegarde illisible ou d'une autre version du jeu : copie de secours intacte avant toute écriture
      // (une version corrigée pourra la relire), puis on joue sur ce qui a pu être relu.
      if (this.session) this.store.backupWorld(this.session.profile.id, this.session.slot, save);
      if (applied < 0) this.world.data.set(this.baseData);
      this.hud.showMessage(
        "Adulte : ce monde vient d'une autre version du jeu ou n'a pas pu être relu entièrement. Une copie de secours est gardée (exporter depuis le mode parent).",
        8000,
      );
    }
    // Monde d'avant le J5 (générateur 1) : sans pierres brillantes, la mission 1 ne pourrait pas finir.
    // On les ajoute là où le terrain n'a pas été touché ; l'écart enregistré les gardera (le monde reste en version 1).
    if (this.worldGen < 2) {
      const v2 = generateWorld(save.type, save.seed, 2).world.data;
      const d = this.world.data;
      const layer = this.world.sizeX * this.world.sizeZ;
      for (let i = 0; i < v2.length; i++) {
        if (v2[i] !== BlockId.GlowStone || d[i] !== this.baseData[i]) continue;
        const up = i + layer;
        if (up < d.length && d[up] !== this.baseData[up]) continue; // l'enfant a construit juste au-dessus
        d[i] = BlockId.GlowStone;
        if (up < d.length) d[up] = v2[up] ?? BlockId.Air;
      }
    }
    this.world.markAllChanged();
    this.view.setWorld(this.world);
    this.player = new Player(this.world);
    const p = save.player;
    if (this.world.inBounds(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
      this.player.setPosition(p.x, p.y, p.z);
      this.player.yaw = p.yaw;
      this.player.pitch = p.pitch;
    } else this.spawnPlayer();
    this.target = null;
    this.breaker.reset();
    this.inventory.load(save.inventory);
    this.collectedTypes.clear();
    for (const st of this.inventory.slots()) if (st) this.collectedTypes.add(st.id);
    this.phase = save.phase;
    this.rewardPending = save.reward && isInventoryBlockId(save.reward.block) ? { block: save.reward.block, count: save.reward.count } : null;
    this.rewardSeenInventory = -1;
    this.celebrateOnResume = save.celebrate === true;
    this.narrator.cancelPending();
    this.afterWorldChange();
  }

  /** État du monde en cours, prêt à enregistrer. */
  private snapshot(): WorldSave {
    const p = this.player;
    return {
      version: SAVE_VERSION,
      gen: this.worldGen,
      type: this.gen.type,
      seed: this.gen.seed,
      edits: toBase64(diffBlocks(this.baseData, this.world.data)),
      player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch },
      inventory: this.inventoryWithCarried(),
      phase: this.phase,
      savedAt: Date.now(),
      ...(this.mission ? { mission: this.mission.toJSON() } : {}),
      ...(this.rewardPending ? { reward: { ...this.rewardPending } } : {}),
      ...(this.celebrationAt !== null || this.celebrateOnResume ? { celebrate: true } : {}),
    };
  }

  /** Sac enregistré : les blocs chipés que portent encore les Grignotes y sont remis (rien n'est perdu en quittant). */
  private inventoryWithCarried(): ReturnType<Inventory["toJSON"]> {
    const carried = this.sim.creatures.flatMap((c) => (c.carried === null ? [] : [c.carried]));
    if (carried.length === 0) return this.inventory.toJSON();
    const copy = Inventory.fromJSON(this.inventory.toJSON());
    for (const id of carried) copy.add(id);
    return copy.toJSON();
  }

  /** Enregistre la partie en cours (rien hors d'une partie d'un profil). Renvoie vrai si c'est fait. */
  saveNow(): boolean {
    if (!this.session) return false;
    const r = this.store.saveWorld(this.session.profile.id, this.session.slot, this.snapshot());
    this.lastAutosaveAt = performance.now();
    if (r.ok) {
      this.lastSavedAt = Date.now();
      this.saveError = null;
      return true;
    }
    if (this.saveError !== r.error) this.hud.showMessage(r.error, 4000); // pour l'adulte
    this.saveError = r.error;
    return false;
  }

  /** Lance la partie d'un profil : monde enregistré, ou nouveau monde du type choisi. */
  private startSession(profile: Profile, slot: number, save: WorldSave | null, type: WorldTypeId | null): void {
    this.session = { profile, slot };
    this.narrator.setLevel(profile.level);
    this.narrator.voice = profile.voice;
    this.syncGameControls();
    this.updateHint();
    this.setAvatar(profile.avatar);
    if (save) this.loadSave(save);
    else {
      this.newWorld(type ?? "prairie", randomSeed());
      this.saveNow(); // l'emplacement apparaît aussitôt comme occupé
    }
    this.home?.hide();
    this.homeButton.hidden = false;
    this.paused = false;
    this.lastAutosaveAt = performance.now();
    this.welcomeSpoken = true;
    this.startMission(save?.mission);
  }

  /**
   * Mission et compagnon (J6) : la mission enregistrée dans le monde, sinon le tutoriel (ou la mission 1
   * si cet enfant a déjà fait le tutoriel). def : mission imposée (mode adresse, suite de la campagne).
   * Mission nouvelle : Pixel se présente puis lit la consigne ; sinon il rappelle l'étape en cours.
   */
  private startMission(saved: unknown, def?: MissionDef): void {
    const r = def ? { def, saved: undefined, fresh: true } : resumeMission(saved, this.session?.profile.tutorialDone ?? false);
    this.mission = new MissionRunner(r.def, r.saved);
    this.missionDoneAt = 0;
    this.nextMissionAt = null;
    this.celebrationAt = null;
    this.onStepStart(performance.now());
    if (r.fresh) {
      this.tell(r.def.intro, { ms: 4500, important: true });
      this.announceStepAt = performance.now() + 4500;
    } else this.announceStepAt = performance.now() + 1200;
    // Partie quittée entre la fin de la mission et l'écran de félicitations : il est montré à la reprise.
    if (this.celebrateOnResume && this.mission.done && r.def.recap) {
      this.missionDoneAt = performance.now();
      this.celebrationAt = performance.now() + 2000;
    }
    this.celebrateOnResume = false;
    this.refreshCompanionPanel();
  }

  /** Début d'une étape : remise à zéro des conseils et de la dernière étape. */
  private onStepStart(now: number): void {
    this.stepStartedAt = now;
    this.stepHave = -1;
    this.stepProgressAt = now;
    this.lastStallHintAt = -Infinity;
    this.lastShelterHintAt = -Infinity;
    this.watchAnnounced = false;
    this.watchNightMs = 0;
    this.watchSawScare = false;
    this.lastLampHintAt = -Infinity;
    this.shelterNow = null;
  }

  /** Le compagnon lit la consigne de l'étape en cours (bouton « répète » compris), selon l'appareil. */
  private announceStep(): void {
    const step = this.mission?.current();
    if (!step) return;
    const t = stepText(step, this.touchUi);
    this.tell(t.text, { spoken: t.spoken, ms: 4000, important: true });
    if (step.goal.kind === "watch") this.watchAnnounced = true;
    this.refreshCompanionPanel();
  }

  private refreshCompanionPanel(): void {
    const m = this.mission;
    const on =
      m !== null && this.companionOn() && !this.paused && !(m.done && performance.now() - this.missionDoneAt > 12_000);
    if (this.companionPanel.hidden === on) {
      this.companionPanel.hidden = !on;
      this.placeMessageBelowCompanion();
    }
    if (!m || !on) return;
    const step = m.current();
    const text = pick(step ? stepText(step, this.touchUi).text : m.def.outro, this.narrator.level);
    const goal = step?.goal;
    const counted = goal && (goal.kind === "collect" || goal.kind === "place" || goal.kind === "break");
    const p = counted ? m.progress(this.inventory) : null;
    const prog = p ? `${p.have} / ${p.need}` : "";
    // Écrire seulement ce qui change (le panneau est rafraîchi à chaque image).
    if (this.companionText.textContent !== text) {
      this.companionText.textContent = text;
      this.placeMessageBelowCompanion();
    }
    if (this.companionProgress.textContent !== prog) this.companionProgress.textContent = prog;
    const iconId = step?.icon ?? (goal && (goal.kind === "collect" || goal.kind === "place") && goal.block !== "any" ? goal.block : null);
    if (iconId !== this.companionIconId) {
      this.companionIconId = iconId;
      this.companionIcon.style.display = iconId === null ? "none" : "";
      this.companionIcon.dataset.block = iconId === null ? "" : String(iconId);
      const g = this.companionIcon.getContext("2d");
      if (g && iconId !== null) {
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, 16, 16);
        g.drawImage(tileIcon(this.view.atlasCanvas, blockDef(iconId).tiles.side), 0, 0);
      }
    }
    const sh = goal?.kind === "shelter";
    const display = sh ? "" : "none";
    if (this.companionShelter.style.display !== display) this.companionShelter.style.display = display;
    if (sh) {
      const c = this.shelterNow;
      setShelterParts(this.companionShelter, c?.roof ?? false, c?.walls ?? 0, c?.ok ?? false);
    }
  }

  /** Le message central passe sous le bandeau de Pixel (petit écran : le bandeau descend et pourrait le cacher). */
  private placeMessageBelowCompanion(): void {
    const bottom = this.companionPanel.hidden ? 0 : Math.ceil(this.companionPanel.getBoundingClientRect().bottom);
    this.hud.root.style.setProperty("--companion-bottom", `${bottom}px`);
  }

  /** Panneau « Tests » et ligne d'infos : toujours en mode adresse (adulte, tests), sinon selon le mode parent (J7). */
  private applyDevTools(): void {
    const on = this.urlMode || this.settings.devTools;
    this.hud.setDevTools(on);
    // Panneau masqué : pas de « Temps ×20 » resté actif que l'enfant ne pourrait ni voir ni arrêter.
    if (!on && this.timeScale !== 1) {
      this.timeScale = 1;
      this.hud.setFastTime(false);
    }
  }

  private companionOn(): boolean {
    return this.urlMode ? this.urlMission : this.session !== null;
  }

  private creaturesOn(): boolean {
    return this.urlMode ? this.urlCreatures : this.session !== null && this.settings.creatures;
  }

  /** Lance-bulles (bouton, touche B) : les Grignotes visées fuient et rendent ce qu'elles avaient chipé. */
  throwBubbles(): void {
    if (this.paused) return;
    const now = performance.now();
    if (now - this.lastBubbleAt < 700) return;
    this.lastBubbleAt = now;
    const eye = this.player.eye();
    const dir = this.player.lookDir();
    this.bubbles.burst(eye, dir);
    this.sounds.play("bubbles");
    for (const c of this.sim.bubble(eye, dir)) {
      if (c.carried === null) continue;
      const r = this.inventory.add(c.carried);
      if (r.ok) {
        this.hud.pulseSlot(r.slot);
        this.sounds.play("pickup", c.carried);
        this.tell(returnedText(c.carried), { ms: 2500 });
      } else {
        // Sac plein : elle le garde pour l'instant (il n'est pas perdu, voir snapshot).
        const live = this.sim.creatures.find((x) => x.id === c.id);
        if (live) live.carried = c.carried;
      }
    }
  }

  /**
   * Case où une Grignote chipe un bloc : jamais une lampe, ni un cadeau (arc-en-ciel), ni le bloc de l'étape de mission en cours ;
   * de préférence dans une grosse pile (tirage proportionnel au nombre). null : rien à prendre.
   */
  private pickStealSlot(): number | null {
    const goal = this.mission?.current()?.goal;
    const protectedId = goal && "block" in goal && goal.block !== "any" ? goal.block : null;
    const slots = this.inventory.slots();
    let total = 0;
    const safe = (id: BlockId) => id !== BlockId.Lamp && id !== BlockId.Rainbow && id !== protectedId;
    for (const st of slots) if (st && safe(st.id)) total += st.count;
    if (total === 0) return null;
    let r = Math.random() * total;
    for (let i = 0; i < slots.length; i++) {
      const st = slots[i];
      if (!st || !safe(st.id)) continue;
      r -= st.count;
      if (r < 0) return i;
    }
    return null;
  }

  /** Recherche des lampes posées (après un changement de monde ou la pose/casse d'une lampe). */
  private refreshLamps(): void {
    this.lampsDirty = false;
    const w = this.world;
    const out: { x: number; y: number; z: number }[] = [];
    const d = w.data;
    for (let i = 0; i < d.length; i++) {
      if (d[i] !== BlockId.Lamp) continue;
      const x = i % w.sizeX;
      const z = Math.floor(i / w.sizeX) % w.sizeZ;
      const y = Math.floor(i / (w.sizeX * w.sizeZ));
      out.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    }
    this.lamps = out;
    this.lampGlow.setLamps(out);
  }

  /** Panneau du compagnon (haut de l'écran) : portrait de Pixel, consigne, avancement, bouton « répète ». */
  private buildCompanionPanel(): {
    panel: HTMLDivElement;
    text: HTMLSpanElement;
    progress: HTMLSpanElement;
    shelter: SVGSVGElement;
    icon: HTMLCanvasElement;
  } {
    const panel = document.createElement("div");
    panel.className = "companion";
    panel.hidden = true;
    const face = document.createElement("canvas");
    face.width = face.height = 8;
    face.className = "companion-face";
    const g = face.getContext("2d");
    if (g) {
      const px = (x: number, y: number, w: number, h: number, c: string) => {
        g.fillStyle = c;
        g.fillRect(x, y, w, h);
      };
      px(1, 0, 2, 2, "#e8762c");
      px(5, 0, 2, 2, "#e8762c");
      px(1, 2, 6, 4, "#e8762c");
      px(2, 5, 4, 3, "#f4efe6");
      px(2, 3, 1, 1, "#2a1d18");
      px(5, 3, 1, 1, "#2a1d18");
      px(3, 6, 2, 1, "#2a1d18");
    }
    const text = document.createElement("span");
    text.className = "companion-text";
    const progress = document.createElement("span");
    progress.className = "companion-progress";
    const shelter = shelterIcon(46);
    shelter.style.display = "none";
    // Icône du bloc demandé (J7) : le lecteur débutant voit ce qu'il faut chercher, sans lire.
    const icon = document.createElement("canvas");
    icon.width = icon.height = 16;
    icon.className = "companion-block";
    icon.style.display = "none";
    const repeat = document.createElement("button");
    repeat.type = "button";
    repeat.className = "companion-repeat";
    repeat.setAttribute("aria-label", "Répète");
    repeat.innerHTML =
      '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
    for (const ev of ["mousedown", "touchstart"]) repeat.addEventListener(ev, (e) => e.stopPropagation());
    repeat.addEventListener("click", () => {
      const m = this.mission;
      if (m?.done) this.tell(m.def.outro, { ms: 4000, important: true });
      else this.announceStep();
    });
    panel.append(face, text, icon, progress, shelter, repeat);
    this.hud.root.appendChild(panel);
    window.addEventListener("resize", () => this.placeMessageBelowCompanion());
    return { panel, text, progress, shelter, icon };
  }

  /** Retour à l'accueil : la partie est enregistrée (sauf save = faux), le jeu attend en pause. */
  private goHome(save = true): void {
    if (!this.home) return;
    const saved = save && this.saveNow();
    this.narrator.cancelPending();
    this.breaker.reset();
    this.touch.reset();
    if (document.pointerLockElement) document.exitPointerLock();
    this.paused = true;
    this.homeButton.hidden = true;
    this.session = null;
    this.mission = null;
    this.nextMissionAt = null;
    this.celebrationAt = null;
    this.celebration.hide();
    this.companionPanel.hidden = true;
    this.placeMessageBelowCompanion();
    this.home.show();
    if (saved) this.hud.showMessage(pick(SAVED, this.narrator.level), 1500);
  }

  private setAvatar(index: number | null): void {
    this.view.scene.remove(this.avatar.group);
    this.avatar.dispose();
    this.avatar = new Avatar(avatarDef(index));
    this.view.scene.add(this.avatar.group);
  }

  /** Vue à la première ou à la troisième personne (touche V, bouton œil). */
  private toggleView(): void {
    this.thirdPerson = !this.thirdPerson;
    this.viewButton.classList.toggle("on", this.thirdPerson);
    this.tell(this.thirdPerson ? VIEW_THIRD : VIEW_FIRST, { ms: 1800, dedupe: true });
  }

  /** Sauvegarde automatique : toutes les 30 s (dans la boucle), et quand la page est masquée ou fermée. */
  private watchSaves(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.saveNow();
    });
    window.addEventListener("pagehide", () => this.saveNow());
    // Le même monde ouvert dans un autre onglet (double-clic deux fois) : si l'autre onglet enregistre ce monde,
    // celui-ci ne doit plus l'écraser avec un état plus ancien. On revient à l'accueil sans enregistrer.
    window.addEventListener("storage", (e) => {
      if (!this.session) return;
      if (e.key === null || e.key === KEYS.world(this.session.profile.id, this.session.slot)) {
        this.goHome(false);
        // Sur l'accueil (le message du jeu serait caché dessous), et lu à voix haute.
        this.home?.notice(pick(OPENED_ELSEWHERE, this.narrator.level));
        this.narrator.say(OPENED_ELSEWHERE, { important: true });
      }
    });
  }

  /** J5 : lampes, Grignotes, compagnon, mission, signal de la nuit, bulles. */
  private updateLiving(now: number, dt: number): void {
    if (this.lampsDirty) this.refreshLamps();
    this.lampGlow.setDaylight(this.sky.daylight);
    this.bubbles.update(dt);
    const bright = this.sky.brightness;
    if (!this.paused) {
      // Signal de la nuit : à 17 h 30, un carillon et le compagnon prévient.
      const h = this.sky.hour;
      if (this.creaturesOn() && this.prevHour >= 0 && this.prevHour < 17.5 && h >= 17.5 && h < 19) {
        this.sounds.play("night");
        // Pendant la dernière étape de la mission 1, le carillon seul : la phrase couperait la consigne
        // de Pixel et donnerait la réponse (« une lampe les éloigne ») que l'enfant doit découvrir.
        if (this.mission?.current()?.goal.kind !== "watch") this.tell(NIGHT_COMING, { ms: 4000, important: true });
      }
      this.prevHour = h;
      const events = this.sim.update(dt * 1000, {
        player: { x: this.player.x, y: this.player.y, z: this.player.z },
        night: this.sky.night,
        lamps: this.lamps,
        enabled: this.creaturesOn(),
        bagHasBlocks: this.inventory.totalBlocks() > 0,
      });
      for (const e of events) {
        if (e.kind === "steal") {
          const slot = this.pickStealSlot();
          const id = slot === null ? null : this.inventory.takeFrom(slot);
          const c = this.sim.creatures.find((x) => x.id === e.id);
          if (id !== null) {
            if (c) c.carried = id;
            this.sounds.play("giggle");
            this.tell(stolenText(id), { ms: 3500 });
          }
        } else if (e.kind === "despawn" && e.carried !== null) {
          this.inventory.add(e.carried); // partie trop loin ou créatures coupées : rien n'est perdu
        } else if (e.kind === "flee-lamp" && this.companionOn()) {
          if (this.mission?.current()?.goal.kind === "watch") {
            // Dernière étape de la mission 1 : la découverte, la nuit, une fois la consigne lue (Pixel la dira en fin de mission).
            if (this.watchAnnounced && this.sky.night) {
              this.watchSawScare = true;
              this.mission.noteSignal("lamp-scare");
            }
          } else if (now - this.lampScareToldAt > 60_000) {
            this.lampScareToldAt = now;
            this.tell(LAMP_SCARES, { ms: 3000, dedupe: true });
          }
        }
      }
      // Mission.
      const m = this.mission;
      if (m && this.companionOn()) {
        const goal = m.current()?.goal;
        this.shelterNow = goal?.kind === "shelter" ? checkShelter(this.world, this.player.x, this.player.y, this.player.z, this.changedAt) : null;
        if (goal?.kind === "shelter") this.shelterHint(now);
        if (goal?.kind === "watch") this.updateWatch(now, dt * 1000);
        this.stallHint(now);
        // Une étape à la fois, et pas avant que la consigne de la précédente ait été dite : chaque « bravo » a son moment.
        const ev = this.announceStepAt === null ? m.update(this.missionView) : null;
        if (ev?.kind === "step") {
          this.sounds.play("bravo");
          // Objectif « ramasser » atteint : le compte réel est dit (« Six troncs ! Bravo ! ») ; sinon « Bravo ! ».
          const done = m.def.steps[ev.index - 1]?.goal;
          let said = pick(BRAVO, this.narrator.level);
          if (done?.kind === "collect") {
            const t = goalReachedText(done.block, Math.max(done.count, this.inventory.count(done.block)));
            this.tell(t.text, { spoken: t.spoken, ms: 2000, important: true });
            said = pick(t.spoken, this.narrator.level);
          } else this.tell(BRAVO, { ms: 1500, important: true });
          this.onStepStart(now);
          // La consigne suivante attend la fin de la phrase (sinon la voix la couperait).
          this.announceStepAt = now + Math.max(1600, this.narrator.voice ? speechMs(said) + 300 : 0);
          this.saveNow();
        } else if (ev?.kind === "done") this.onMissionDone(m.def, now);
        if (this.announceStepAt !== null && now >= this.announceStepAt) {
          this.announceStepAt = null;
          // Étape déjà atteinte (7 pierres dans le sac en arrivant à « ramasse 4 pierres ») : pas de consigne, le
          // « bravo » arrive à l'image suivante.
          const p = m.progress(this.missionView);
          if (!(p && p.have >= p.need)) this.announceStep();
        }
        if (this.nextMissionAt && now >= this.nextMissionAt.at) this.startMission(undefined, this.nextMissionAt.def);
        if (this.celebrationAt !== null && now >= this.celebrationAt) {
          this.celebrationAt = null;
          this.showCelebration(m.def);
        }
      }
      this.deliverReward(true);
    }
    this.critters.sync(this.sim.creatures, dt, bright);
    // Compagnon.
    const showFox = this.companionOn() && !this.paused;
    if (showFox) {
      const goal = companionGoal(this.player, this.player.yaw);
      const p = { x: this.player.x, y: this.player.y, z: this.player.z };
      // Première apparition (monde chargé) : sur la terre ferme, jamais dans l'eau ; sinon il attend (J7).
      if (!this.companion) {
        const spot = landingSpot(this.world, goal, p);
        if (spot) this.companion = { x: spot.x, y: spot.y, z: spot.z, yaw: this.player.yaw, moving: false };
      }
      if (this.companion) {
        this.companion = stepCompanion(this.companion, goal, p, this.world, dt);
        const c = this.companion;
        this.fox.update(c.x, c.y, c.z, c.yaw, c.moving, dt);
        this.fox.setBrightness(bright);
      }
    }
    this.fox.group.visible = showFox && this.companion !== null;
    this.refreshCompanionPanel();
  }

  /** Bloc changé par l'enfant depuis la génération du monde (posé ou creusé) : un abri doit être le sien. */
  private readonly changedAt = (x: number, y: number, z: number): boolean => {
    const w = this.world;
    if (!w.inBounds(x, y, z)) return false;
    const i = w.index(x, y, z);
    return w.data[i] !== this.baseData[i];
  };

  private readonly missionView: MissionView = {
    count: (id) => this.inventory.count(id),
    shelter: () => this.shelterNow,
  };

  /**
   * Étape qui n'avance plus (J7) : au bout de STALL_HINT_MS sans progrès, Pixel donne le conseil de l'étape
   * (« Creuse : la pierre est dessous ! »), puis au plus toutes les STALL_HINT_EVERY_MS.
   */
  private stallHint(now: number): void {
    const m = this.mission;
    const step = m?.current();
    if (!m || !step?.hint || this.announceStepAt !== null) return;
    const have = m.progress(this.missionView)?.have ?? 0;
    if (have !== this.stepHave) {
      this.stepHave = have;
      this.stepProgressAt = now;
      return;
    }
    if (now - this.stepProgressAt < STALL_HINT_MS || now - this.lastStallHintAt < STALL_HINT_EVERY_MS) return;
    this.lastStallHintAt = now;
    // Sac plein et bloc demandé qui n'y entrerait pas : le vrai conseil est de vider une case, pas de chercher.
    const g = step.goal;
    if (g.kind === "collect" && !this.inventory.canAdd(g.block)) {
      this.tellFullBag(4500, g.block);
      return;
    }
    this.tell(step.hint, { ms: 4500, important: true });
  }

  /**
   * Sac plein (J7) : dit quelle case vider, concrètement (« Pose tes 2 fleurs rouges ! ») : la sorte la moins
   * nombreuse, hors lampe, cadeau et bloc demandé par l'étape. Sans proposition, le message générique.
   */
  private tellFullBag(ms: number, keep: BlockId | null = null): void {
    let best: { id: BlockId; count: number } | null = null;
    for (const st of this.inventory.slots()) {
      if (!st || st.id === BlockId.Lamp || st.id === BlockId.Rainbow || st.id === keep) continue;
      if (!best || st.count < best.count) best = st;
    }
    if (!best) {
      this.tell(FULL_BAG_KEEP, { ms, dedupe: true });
      return;
    }
    const t = emptySlotText(best.id, best.count);
    this.tell(t.text, { spoken: t.spoken, ms, important: true, dedupe: true });
  }

  /**
   * Étape « abri » : quand l'enfant se tient, presque immobile, dans un abri commencé, Pixel dit ce qui
   * manque (le toit, un mur) ; dans un abri naturel (sous-bois), qu'il faut construire le sien.
   */
  private shelterHint(now: number): void {
    const c = this.shelterNow;
    if (!c || c.ok) return;
    if (now - this.stepStartedAt < 6000 || now - this.lastShelterHintAt < SHELTER_HINT_EVERY_MS) return;
    if (Math.hypot(this.player.vx, this.player.vz) > 0.5) return;
    const started = c.own && (c.roof || c.walls >= 2);
    const natural = !c.own && c.roof && c.walls >= SHELTER_WALLS_NEEDED;
    if (!started && !natural) return;
    this.lastShelterHintAt = now;
    const hint = !c.roof ? SHELTER_NO_ROOF : c.walls < SHELTER_WALLS_NEEDED ? SHELTER_NO_WALLS : SHELTER_NOT_OWN;
    this.tell(hint, { ms: 3500, dedupe: true, ...(hint === SHELTER_NO_ROOF ? { spoken: SPOKEN_TIPS.noRoof } : {}) });
  }

  /**
   * Dernière étape de la mission 1 : une fois la consigne lue, le temps file jusqu'à la nuit (voir frame) ;
   * la nuit, une Grignote qui fuit la lampe valide l'étape (voir updateLiving). Jamais bloquant :
   * sans nuit (mode parent), l'étape est validée tout de suite ; sans Grignotes, peu après la tombée de la
   * nuit ; sinon, au plus tard après WATCH_FALLBACK_MS de nuit. Loin de toute lampe, Pixel rappelle d'y revenir.
   */
  private updateWatch(now: number, dtMs: number): void {
    const m = this.mission;
    if (!m) return;
    if (this.settings.night === "aucune") {
      m.noteSignal("lamp-scare");
      return;
    }
    if (!this.watchAnnounced || !this.sky.night) return;
    this.watchNightMs += dtMs;
    const t = this.watchNightMs;
    if (t >= (this.creaturesOn() ? WATCH_FALLBACK_MS : WATCH_NO_CREATURES_MS)) {
      m.noteSignal("lamp-scare");
      return;
    }
    if (!this.creaturesOn() || t < 6000 || now - this.lastLampHintAt < LAMP_HINT_EVERY_MS) return;
    if (this.lamps.length === 0) {
      // Lampe reprise : si elle est dans le sac, Pixel propose de la reposer (sinon, le délai de secours suffit).
      if (this.inventory.count(BlockId.Lamp) > 0) {
        this.lastLampHintAt = now;
        this.tell(PLACE_LAMP_AGAIN, { ms: 3000, dedupe: true });
      }
      return;
    }
    let nearest = Infinity;
    for (const l of this.lamps) nearest = Math.min(nearest, Math.hypot(l.x - this.player.x, l.z - this.player.z));
    if (nearest > LAMP_RADIUS + 1) {
      this.lastLampHintAt = now;
      this.tell(BACK_TO_LAMP, { ms: 3000, dedupe: true });
    }
  }

  /**
   * Enfant coincé (J7) : il pousse depuis un moment contre les parois d'un trou (ou d'un abri fermé) sans en
   * sortir. Pixel (ou le message, sans compagnon) dit comment faire : grimper en gardant Sauter contre la paroi,
   * ou casser un bloc si tout est fermé, toit compris. Rien pendant l'escalade elle-même.
   */
  private updateStuck(pushing: boolean, now: number): void {
    const p = this.player;
    // Pendant l'étape abri, l'enfant qui pousse contre ses propres murs construit : c'est le conseil d'abri qui parle.
    if (this.mission?.current()?.goal.kind === "shelter" && this.shelterNow?.own) {
      this.stuckSince = null;
      return;
    }
    // Temps réel, et non temps de jeu : c'est ce que vit l'enfant, même si les images sont lentes.
    const state = pushing && !p.inWater && !p.climbing && p.onGround ? pitState(this.world, p.x, p.y, p.z) : "open";
    if (state === "open") {
      this.stuckSince = null;
      return;
    }
    this.stuckSince ??= now;
    if (now - this.stuckSince < STUCK_HINT_AFTER_MS || now - this.lastStuckHintAt < STUCK_HINT_EVERY_MS) return;
    this.lastStuckHintAt = now;
    this.stuckSince = null;
    this.tell(state === "closed" ? WALLED_IN : this.touchUi ? PIT_CLIMB_TOUCH : PIT_CLIMB, { ms: 4000, dedupe: true });
  }

  /** Le temps file pendant la dernière étape de la mission 1, jusqu'à la nuit. */
  private watchBoost(): boolean {
    return !this.paused && this.watchAnnounced && !this.sky.night && this.mission?.current()?.goal.kind === "watch" && this.companionOn();
  }

  /**
   * Fin d'une mission : Pixel félicite ; le tutoriel est retenu pour l'enfant et la mission 1 suit ;
   * la mission 1 donne son cadeau et ouvre l'écran de félicitations.
   */
  private onMissionDone(def: MissionDef, now: number): void {
    this.missionDoneAt = now;
    this.sounds.play("bravo");
    if (def === TUTORIAL) {
      this.markTutorialDone();
      // Retour au mode Casser : resté en mode Poser, l'enfant poserait au lieu de casser des troncs.
      if (this.touch.mode === "place") this.touch.setMode("break");
    }
    if (def.reward) {
      this.rewardPending = { ...def.reward };
      this.rewardSeenInventory = -1;
      this.deliverReward(false);
    }
    if (def.recap) {
      // La découverte (logique) : dite par Pixel quand l'enfant a vu les Grignotes fuir la lampe.
      if (this.watchSawScare) this.tell(LAMP_SCARES, { ms: 3500, important: true });
      else this.tell(BRAVO, { ms: 1500, important: true });
      this.celebrationAt = now + (this.watchSawScare ? CELEBRATION_DELAY_MS : 1600);
    } else this.tell(def.outro, { ms: 3000, important: true });
    this.watchSawScare = false;
    const next = nextMission(def);
    if (next) this.nextMissionAt = { at: now + NEXT_MISSION_DELAY_MS, def: next };
    this.saveNow();
  }

  /** Tutoriel fini : retenu dans le profil de l'enfant (ses mondes suivants commencent à la mission 1). */
  private markTutorialDone(): void {
    const s = this.session;
    if (!s || s.profile.tutorialDone) return;
    s.profile.tutorialDone = true;
    const list = this.store.loadProfiles();
    if (!list) return;
    for (const p of list) if (p.id === s.profile.id) p.tutorialDone = true;
    this.store.saveProfiles(list);
  }

  /**
   * Cadeau en attente : il entre dans le sac dès qu'il y a de la place (sac plein à la fin de la
   * mission). On ne réessaie que quand le sac a changé. announce : le jeu le dit (pas pendant
   * l'écran de félicitations, qui le montre déjà).
   */
  private deliverReward(announce: boolean): void {
    const r = this.rewardPending;
    if (!r || this.paused || this.rewardSeenInventory === this.inventory.version) return;
    const res = this.inventory.add(r.block, r.count);
    this.rewardSeenInventory = this.inventory.version;
    if (!res.ok) return;
    this.rewardPending = res.added < r.count ? { block: r.block, count: r.count - res.added } : null;
    this.hud.pulseSlot(res.slot);
    this.refreshInventory();
    if (!announce) return;
    this.sounds.play("pickup", r.block);
    const t = rewardText(r.block, res.added);
    this.tell(t.text, { spoken: t.spoken, ms: 3500 });
  }

  /** Écran de félicitations (fin de la mission 1) : le jeu attend derrière, en pause, jusqu'à « Continuer ». */
  private showCelebration(def: MissionDef): void {
    const level = this.narrator.level;
    const title = bravoTitle(this.session?.profile.name ?? null);
    const icon = (id: BlockId) => tileIcon(this.view.atlasCanvas, blockDef(id).tiles.side);
    const recap: CelebrationLine[] = (def.recap ?? []).map((item) => {
      if ("block" in item) return { icon: icon(item.block), text: capitalize(quantity(item.block, item.count)) };
      const house = shelterIcon(40);
      setShelterParts(house, true, 3, true);
      return { icon: house, text: "Un abri" };
    });
    const reward = def.reward ? rewardText(def.reward.block, def.reward.count) : null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.breaker.reset();
    this.touch.reset();
    this.hud.setBreakProgress(null);
    this.hud.message.classList.remove("visible"); // pas de message qui dépasse derrière la carte
    this.keyboard.clear();
    this.paused = true;
    this.celebration.show(
      {
        title: pick(title, level),
        subtitle: pick(def.outro, level),
        recap,
        reward: reward && def.reward ? { icon: icon(def.reward.block), text: pick(reward.text, level) } : null,
        button: level === "autonome" ? "Continuer à jouer" : "Continuer",
      },
      () => {
        this.keyboard.clear();
        this.paused = false;
        if (this.rewardPending) this.tell(REWARD_WAITING, { ms: 4500 });
        this.updateHint();
      },
    );
    this.sounds.play("bravo");
    window.setTimeout(() => this.sounds.play("bravo"), 500);
    // Lu d'une traite (lecteur débutant, voix active) : le titre, la phrase de Pixel, le cadeau.
    const joined = (l: "debutant" | "autonome") => [pick(title, l), pick(def.outro, l), reward ? pick(reward.spoken, l) : ""].join(" ").trim();
    this.narrator.say({ debutant: joined("debutant"), autonome: joined("autonome") }, { important: true });
  }

  /** Petit bouton rond en haut à droite, à côté de « Tests » (icône SVG en traits). */
  private topButton(className: string, label: string, paths: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn top-btn ${className}`;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    // Pas de capture de la souris ni d'appui « casser » en touchant ces boutons.
    for (const ev of ["mousedown", "touchstart"]) b.addEventListener(ev, (e) => e.stopPropagation());
    this.hud.root.appendChild(b);
    return b;
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
      if (this.paused) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (m) this.setSlot(Number(m[1]) - 1, true);
      if (code === "KeyV") this.toggleView();
      if (code === "KeyB") this.throwBubbles();
    });
    this.homeButton.addEventListener("click", () => this.goHome());
    this.viewButton.addEventListener("click", () => this.toggleView());
    this.bubbleButton.addEventListener("click", () => this.throwBubbles());
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
      if (t instanceof Element && (t.closest(".fatal") || (t.closest(".panel, .home") && t.matches("input, textarea, select")))) return;
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
      if (this.session) return; // jamais de régénération pendant la partie d'un enfant (monde enregistré)
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
      // Pendant la partie d'un enfant, un nouveau monde écraserait son monde enregistré : réservé au mode adresse.
      if (this.session) {
        this.hud.showMessage("« Nouveau monde » : seulement hors d'une partie d'enfant (adresse #monde=…). Pour un enfant : accueil → + Nouveau.", 5000);
        return;
      }
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
        if (this.urlMode) history.replaceState(null, "", this.urlOptions());
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
      this.tell(NO_FULLSCREEN, { ms: 2500, dedupe: true });
      console.warn("Plein écran impossible :", err);
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
      } else if (this.wouldLose(id)) {
        // Sac plein (J6) : une pierre brillante, une lampe ou un bloc arc-en-ciel ne se cassent pas, ils seraient
        // perdus (et les pierres brillantes sont comptées : la mission 1 en a besoin). Dit une fois par appui.
        holding = false;
        if (this.fullToldFor !== press) {
          this.fullToldFor = press;
          this.sounds.play("deny");
          this.tellFullBag(2500, dropsOf(id).main);
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

  /**
   * Bloc qu'on ne casse pas sac plein, parce qu'il serait perdu : les blocs précieux (pierre brillante, lampe,
   * arc-en-ciel) et, recette J7, celui que demande l'étape en cours (un désert n'a parfois qu'une douzaine de troncs).
   */
  private wouldLose(id: BlockId): boolean {
    const drop = dropsOf(id).main;
    if (drop === null || this.inventory.canAdd(drop)) return false;
    if (id === BlockId.GlowStone || id === BlockId.Lamp || id === BlockId.Rainbow) return true;
    const goal = this.mission?.current()?.goal;
    return goal?.kind === "collect" && goal.block === drop;
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
    if (this.wouldLose(id)) {
      this.sounds.play("deny");
      this.tellFullBag(2500, dropsOf(id).main);
      return;
    }
    if (!w.set(x, y, z, BlockId.Air)) return;
    if (id === BlockId.Lamp) this.lampsDirty = true;
    this.lastBreakAt = performance.now();
    this.mission?.noteBroken(id);
    this.sounds.play("break", id);
    // Le bloc cassé d'abord (il passe en main si elle est vide, et c'est lui qu'on annonce),
    // puis la fleur posée dessus, qui tombe avec lui et rejoint le sac sans message.
    const above = w.get(x, y + 1, z);
    // Ce que rapporte le bloc (J5) : la pierre brillante donne une lampe, un tronc donne aussi une clôture (sans message).
    const drops = dropsOf(id);
    if (drops.main !== null) this.collect(drops.main);
    if (drops.extra !== null) this.collect(drops.extra, false);
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
    this.mission?.notePlaced(id);
    if (id === BlockId.Lamp) this.lampsDirty = true;
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
        paused: this.paused,
        home: this.home?.visible ?? false,
        session: this.session ? { profile: this.session.profile.id, name: this.session.profile.name, slot: this.session.slot } : null,
        view: this.thirdPerson ? "3e" : "1re",
        avatarVisible: this.avatar.group.visible,
        camera: { x: this.view.camera.position.x, y: this.view.camera.position.y, z: this.view.camera.position.z },
        nightLength: this.settings.night,
        lastSavedAt: this.lastSavedAt,
        creatures: this.sim.creatures.map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, mode: c.mode, carried: c.carried })),
        companion: this.fox.group.visible && this.companion ? { x: this.companion.x, y: this.companion.y, z: this.companion.z } : null,
        mission: this.mission ? { step: this.mission.stepIndex, done: this.mission.done } : null,
        missionId: this.mission?.def.id ?? null,
        shelter: this.shelterNow ? { ...this.shelterNow } : null,
        celebration: this.celebration.visible,
        rewardPending: this.rewardPending ? { ...this.rewardPending } : null,
        timeBoost: this.watchBoost(),
        tutorialDone: this.session?.profile.tutorialDone ?? null,
        companionText: this.companionPanel.hidden ? null : this.companionText.textContent,
        lamps: this.lamps.length,
        bubbles: this.bubbles.count,
      }),
      /** Nombre de blocs de ce type dans le monde (tests). */
      countBlocks: (id: number) => this.world.data.reduce((n, v) => (v === id ? n + 1 : n), 0),
      /** Lance des bulles (comme le bouton). */
      bubbles: () => this.throwBubbles(),
      /** Fait apparaître une Grignote à (dx, dz) du joueur ; renvoie son identifiant ou null. */
      spawnCreature: (dx: number, dz: number) => this.sim.spawnAt(this.player.x + dx, this.player.z + dz)?.id ?? null,
      /** Enregistre tout de suite la partie en cours (vrai si c'est fait). */
      saveNow: () => this.saveNow(),
      /** Donne des blocs (tests) : renvoie le résultat de l'ajout. */
      give: (id: number, n = 1) => {
        const r = this.inventory.add(id as BlockId, n);
        this.refreshInventory();
        return r;
      },
      clearInventory: () => this.inventory.clear(),
      /** Pose un bloc sans passer par le sac (préparer un scénario de test). */
      setBlock: (x: number, y: number, z: number, id: number) => {
        this.lampsDirty = true;
        return this.world.set(x, y, z, id as BlockId);
      },
      /** Casse un bloc comme au terme d'un appui maintenu (règles du jeu comprises : ramassage, fleur au-dessus…). */
      breakBlock: (x: number, y: number, z: number) => this.breakBlock({ x, y, z }),
      /** Pose le bloc de la case choisie là où vise la croix, comme un clic droit (règles du jeu comprises). */
      placeBlock: () => this.placeBlock(),
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

    // Regard (consommé même en pause : un geste fait sur l'accueil ne tourne pas la vue au retour)
    const m = this.mouse.consume();
    const t = this.touch.consumeLook();
    if (!this.paused) this.player.rotate(m.yaw + t.yaw, m.pitch + t.pitch);

    // Déplacement
    const kx = this.keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]);
    const kz = this.keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]);
    if (!this.paused) {
      this.player.update(dt, {
        x: kx + this.touch.moveX,
        z: kz + this.touch.moveZ,
        jump: this.keyboard.isDown("Space") || this.touch.jumpPressed,
        down: this.keyboard.isDown("ShiftLeft") || this.keyboard.isDown("ShiftRight"),
      });
      // Pas du tutoriel (J6) : un déplacement d'un bloc ou plus en une image est une téléportation, pas un pas.
      const moved = Math.hypot(this.player.x - this.prevX, this.player.z - this.prevZ);
      if (moved < 1) this.mission?.noteWalked(moved);
      this.updateStuck(Math.hypot(kx + this.touch.moveX, kz + this.touch.moveZ) > 0.1, performance.now());
    }
    this.prevX = this.player.x;
    this.prevZ = this.player.z;

    // Caméra : dans les yeux, ou derrière le personnage (troisième personne, jamais à travers un mur)
    const eye = this.player.eye();
    const pl = this.player;
    this.view.camera.rotation.order = "YXZ";
    this.view.camera.rotation.set(pl.pitch, pl.yaw, 0);
    if (this.thirdPerson) {
      const cam = thirdPersonCamera(this.world, eye, pl.yaw, pl.pitch);
      this.view.camera.position.set(cam.x, cam.y, cam.z);
      // Caméra collée au personnage (dos au mur) : on ne le dessine pas, il boucherait la vue.
      this.avatar.group.visible = cam.distance > 0.8;
    } else {
      this.view.camera.position.set(eye.x, eye.y, eye.z);
      this.avatar.group.visible = false;
    }
    if (this.avatar.group.visible) {
      this.avatar.update(pl.x, pl.y, pl.z, pl.yaw, pl.pitch, Math.hypot(pl.vx, pl.vz), dt);
      this.avatar.setBrightness(this.sky.brightness);
    }

    // Jour et nuit, eau
    const boost = this.watchBoost() ? WATCH_TIME_BOOST : 1;
    if (!this.paused) this.phase = advancePhase(this.phase, dt * 1000, this.timeScale * boost, this.settings.night);
    this.sky = skyState(solarTime(this.phase));
    this.view.setSky(this.sky);
    // Voile sous l'eau : là où est la caméra (en troisième personne, elle peut être hors de l'eau quand la tête y est).
    const c = this.view.camera.position;
    const camInWater = this.thirdPerson ? this.world.get(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) === BlockId.Water : this.player.headInWater;
    this.view.setUnderwater(camInWater);
    this.hud.setUnderwater(camInWater);

    // Visée, casse par appui maintenu, sac
    this.target = raycast(this.world, eye, this.player.lookDir(), REACH);
    if (this.target) this.view.setHighlight(this.target.x, this.target.y, this.target.z);
    else this.view.hideHighlight();
    if (!this.paused) this.updateBreaking(performance.now(), dt * 1000);
    this.refreshInventory();
    if (this.session && performance.now() - this.lastAutosaveAt > AUTOSAVE_MS) this.saveNow();
    this.updateLiving(performance.now(), dt);

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
        `Monde : ${worldTypeName(this.gen.type)}, graine ${this.gen.seed}, ${w.sizeX}×${w.sizeY}×${w.sizeZ}, arbres ${this.gen.stats.trees}, fleurs ${this.gen.stats.flowers}, cactus ${this.gen.stats.cacti}, pierres brillantes ${this.gen.stats.glowStones}`,
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
