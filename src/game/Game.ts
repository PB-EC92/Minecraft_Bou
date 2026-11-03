import { Sounds } from "../audio/sounds";
import { BlockId, breakDurationMs, dropsOf, HOTBAR_BLOCKS, isLetterId, isPlantId, isSolidId, letterBlockId, letterChar, LETTERS, Tile } from "../engine/blocks";
import { craft, craftPlans, planCraft, RECIPES, recipeById, type CraftReserve, type RecipeId } from "../engine/crafting";
import { BreakTracker, type BlockPos } from "../engine/breaking";
import { advancePhase, formatHour, holdEvening, isMissionDaytime, phaseForHour, skyState, solarTime, type SkyState } from "../engine/dayNight";
import { discardVerdict, Inventory, MAX_STACK, slotToEmpty, type AddResult, type DiscardVerdict } from "../engine/inventory";
import { blockBox, boxesIntersect } from "../engine/physics";
import { raycast, type RayHit } from "../engine/raycast";
import { generateWorld, GENERATOR_VERSION, randomSeed, worldTypeName, parseWorldType, type GeneratedWorld, type WorldTypeId } from "../engine/terrain";
import type { World } from "../engine/World";
import {
  discardedText,
  emptiedText,
  emptySlotText,
  goalReachedText,
  keepSlotText,
  maxStackText,
  pickupSpeech,
  pickupText,
  quantity,
  returnedText,
  ordinalWord,
  rewardText,
  shouldSpeakPickup,
  stolenText,
} from "../edu/counting";
import {
  BRAVO,
  CAMPAIGN,
  lampRevealed,
  lettersUnlocked,
  MISSION_1,
  MISSION_2,
  MissionRunner,
  nextMission,
  resumeMission,
  stepText,
  TUTORIAL,
  wordsSeen,
  type MissionDef,
  type MissionView,
  type StepDef,
} from "../edu/missions";
import {
  BREAK_TIP_TOUCH,
  BREAK_TIP_MOUSE,
  DICT_EXTRA,
  DICT_FAR,
  DICT_HELP_ALL,
  DICT_HELP_COUNT,
  DICT_HELP_FIRST,
  DICT_HELP_MORE,
  DICT_MISSING,
  DICT_SWAP,
  DICT_WRONG,
  EXTRA_LETTER,
  fillSaid,
  GHOST_LINE,
  GIVE_LETTER,
  HIDDEN_WORD,
  LEFT_TO_RIGHT,
  LETTER_IN_HAND_MOUSE,
  LETTER_IN_HAND_TOUCH,
  LETTERS_HINT,
  LETTERS_LABEL,
  LISTEN_AGAIN,
  MISSION_2_TOMORROW,
  NEXT_LETTER,
  NO_VOICE_COPY,
  PLACE_WHERE,
  READ_OTHER_SIDE,
  RECAP_SPOKEN,
  recapVars,
  recapWordLabel,
  SPACE_BETWEEN,
  TOWER,
  TRAY_KEYBOARD,
  TRAY_TITLE,
  TRAY_WRONG_PICK,
  WORD_DONE,
  WORD_DONE_NAME,
  WRONG_LETTER,
  type SaidTemplate,
} from "../edu/wordTexts";
import { findEntry, fillWord, letterName, nameWord, wordVars, type WordVars } from "../edu/wordLists";
import { BREAK_TIP_MS, LETTER_IN_HAND_EVERY_MS, LETTER_IN_HAND_MS, wordHelp, type HelpSay, type HelpShow, type WriteMode } from "../edu/wordHelp";
import {
  DICT_FEEDBACK_FULL_MS,
  DICT_FEEDBACK_IDLE_MS,
  newFeedbackMemory,
  writingFeedback,
  type FeedbackKey,
  type FeedbackMemory,
  type PlannedLetters,
  type WritingFeedback,
} from "../edu/writingFeedback";
import { evaluateWriting, ghostCells, planLine, presentWords, type Cell, type Dir, type Reading, type WritingState } from "../engine/words";
import {
  craftCardViews,
  craftIntroText,
  craftMoreBlocksText,
  craftRefusalText,
  craftText,
  withFact,
  type CraftCardView,
  type SaidText,
} from "../edu/craftTexts";
import { CreatureSim, LAMP_RADIUS } from "../engine/creatures";
import { checkShelter, SHELTER_WALLS_NEEDED, type ShelterCheck } from "../engine/shelter";
import { pitState } from "../engine/pit";
import { Narrator, speechMs, type TellOptions } from "../edu/Narrator";
import { Speech } from "../edu/speech";
import {
  BOTTOM_LAYER,
  CRAFT_GLASS_FACT,
  CRAFT_NOTHING,
  CRAFT_OPEN_MOUSE,
  CRAFT_OPEN_TOUCH,
  EMPTY_HAND,
  FLOWER_IN_WATER,
  FLOWER_NEEDS_GROUND,
  FULL_BAG,
  FULL_BAG_TOUCH,
  GLASS_SEE_THROUGH,
  HINT_EXTRAS,
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
  NIGHT_COMING_LAMP,
  pick,
  BACK_TO_LAMP,
  bravoTitle,
  FULL_BAG_KEEP,
  FULL_BAG_KEEP_TOUCH,
  NO_FULLSCREEN,
  OPENED_ELSEWHERE,
  PIT_CLIMB,
  PIT_CLIMB_TOUCH,
  PLACE_LAMP_AGAIN,
  WALLED_IN,
  SPOKEN_TIPS,
  REWARD_WAITING,
  REWARD_WAITING_TOUCH,
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
import { slotHoldProgress, startSlotHold, type SlotHold } from "../input/slotHold";
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
import { CRAFT_ARM_MS, CraftPanel, type CraftStatusTone } from "../ui/CraftPanel";
import { setShelterParts, shelterIcon } from "../ui/shelterIcon";
import { blockIcon, tileIcon } from "../render/textures";
import { horizontalFov } from "../render/fov";
import { LetterTray, trayModelCells, type TrayContent, type TrayLetter, type TrayModel } from "../ui/LetterTray";
import { wordIcon } from "../ui/wordIcon";
import { pixelFace } from "../ui/pixelFace";
import { isInventoryBlockId } from "../engine/inventory";
import { avatarDef } from "./avatars";
import { thirdPersonCamera } from "./thirdPerson";
import { companionGoal, landingSpot, stepCompanion, type CompanionState } from "./companion";
import { showFatalError } from "../ui/fatal";
import { HOUR_PRESETS, Hud, LETTERS_CELL } from "../ui/Hud";
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
/**
 * Mission 2 et suivantes (V2) : elles ne commencent que de jour. Si la mission 1 finit la nuit, le temps file
 * (×30, comme la dernière étape) jusqu'au matin ; la suite attend au moins ce délai après les félicitations (ms),
 * et « Demain, on écrira des mots » n'est dit qu'au bout du second, pour que le message du cadeau reste lisible.
 */
const MORNING_TIME_BOOST = 30;
const AFTER_CELEBRATION_DELAY_MS = 1500;
/** Affichage du message « Vide une case du sac » après les félicitations (ms) ; la suite ne commence pas avant. */
const REWARD_WAITING_MS = 4500;
const TOMORROW_AFTER_MS = 5000;
/** Le message « demain » reste lu avant que la mission suivante ne commence (ms). */
const TOMORROW_READ_MS = 3500;
/** Fabrication (V2) : écart minimal entre deux fabrications (un toucher = une fabrication) (ms). */
const CRAFT_REPEAT_MS = 250;
/** Présentation du marteau par Pixel : au plus tôt ce délai après le début de l'étape abri (ms). */
const CRAFT_INTRO_AFTER_MS = 15_000;
/** Lecture différée du résultat d'une fabrication : en touchant vite, seul le dernier total est dit (ms). */
const CRAFT_VOICE_DELAY_MS = PICKUP_VOICE_DELAY_MS;
/** Conseil « fabrique des planches » à l'étape abri quand le sac compte moins de blocs que ce nombre. */
const CRAFT_HINT_BLOCKS = 10;
/** Marteau (dessin original, en traits, viewBox 24) : manche, tête, cerclage. */
const HAMMER_PATHS = '<path d="M4.5 19.5 13 11"/><path d="m11 6 3-3 7 7-3 3z"/><path d="m12.5 7.5 4 4"/>';

/** Case ABC de la mission 2 (V2) : 10e position de la barre, après les 9 cases du sac ; la main tient alors une lettre. */
const LETTER_SLOT = LETTERS_CELL;
/** Mot réussi : le conseil « fais le tour » ou « un espace » vient au plus tôt ce délai après le « bravo » (ms). */
const WORD_FOLLOW_UP_MS = 2500;
/** Temps laissé pour lire (ou entendre) ce conseil avant la consigne suivante (ms). */
const WORD_FOLLOW_UP_READ_MS = 3000;
/** Dictée : l'indice gagné par un essai est dit un peu après le retour sur l'essai, pour le laisser lire (ms). */
const HELP_AFTER_FEEDBACK_MS = 4000;

/** Messages de la réaction à l'écriture d'un mot (writingFeedback), par clé. */
const FEEDBACK_TEXTS: Readonly<Record<FeedbackKey, SaidTemplate | ChildText>> = {
  HIDDEN_WORD,
  TOWER,
  LEFT_TO_RIGHT,
  EXTRA_LETTER,
  WRONG_LETTER,
  DICT_MISSING,
  DICT_WRONG,
  DICT_SWAP,
  DICT_EXTRA,
  DICT_FAR,
};

/**
 * Écriture du mot d'une étape « write » de la mission 2 (V2) : mot, mode (copie ou dictée), aide progressive,
 * avancement lu dans le monde, retours déjà donnés, cases claires. Rien de tout cela n'est enregistré, sauf ce que
 * la mission garde (mot, palier, lettres dévoilées, passage en copie) : à la reprise, une nouvelle écriture repart.
 */
interface WritingRun {
  def: MissionDef;
  step: number;
  target: string;
  /** Le mot est le prénom de l'enfant (sans accent). */
  isName: boolean;
  /** Étape « prénom » sans prénom écrivable : un mot de la liste, avec ses textes. */
  nameFallback: boolean;
  mode: WriteMode;
  /** Premier mot de la mission (la copie commence au palier 2 : cases claires et anneau d'emblée). */
  firstWord: boolean;
  stage: number;
  revealed: number;
  /** Temps sans progrès, hors pause (ms). */
  ms: number;
  show: HelpShow;
  /** Lettres justes (début du mot) et meilleure lecture du côté de l'enfant. */
  have: number;
  best: Reading | null;
  /** Lettres à revoir (copie : contour orange). */
  wrongCells: Cell[];
  memory: FeedbackMemory;
  lastPlaceAt: number;
  /** Vérifications prévues après la dernière pose (l'enfant s'est arrêté). */
  checksAt: number[];
  /** Ligne de cases claires tracée devant l'enfant (rien d'écrit), gardée tant que ses cases restent libres. */
  planned: { cells: Cell[]; dir: Dir } | null;
  /** Consigne dite : l'horloge d'aide tourne et les cases claires se montrent. */
  announced: boolean;
  /** Pas de voix française : la dictée devient une copie, dite une fois (« Je n'ai pas de voix ici »). */
  noVoice: boolean;
  noVoiceTold: boolean;
  /** Lettre fausse : si elle est encore là à cette date, Pixel dit comment la casser. */
  breakTip: { at: number; cell: Cell; id: number } | null;
  /** Indice de la dictée gagné par un essai, dit un peu plus tard. */
  helpSayAt: { at: number; say: HelpSay } | null;
  /** Mot trouvé : lu du côté de l'enfant ? collé à un mot déjà écrit ? */
  found: { facing: boolean; glued: boolean } | null;
}

/** Résultat d'une fabrication demandée (carte touchée ou accès de test). */
type CraftResult =
  | { ok: true; outputSlot: number; before: number; after: number }
  | { ok: false; reason: "unknown" | "unavailable" | "early" | "reserved" | "missing" | "max" | "full" };

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
  /** Ce que montre l'icône : « block:13 », « word:ABC » (mission 2, étape 0), ou rien. */
  private companionIconKey = "";
  /** Début (temps réel) de la poussée en vain contre les parois d'un trou ou d'un abri fermé, et dernier conseil (J7). */
  private stuckSince: number | null = null;
  private lastStuckHintAt = -Infinity;
  /** Position de l'image précédente (pas du tutoriel). */
  private prevX = 0;
  private prevZ = 0;

  // ---------- V2 lot 1 : socle commun et suites de recette ----------
  /** Appui long au clavier (touche 1 à 9 gardée) ; celui de la souris ou du doigt est suivi par la barre (Hud). */
  private keyHold: SlotHold | null = null;
  /** Mission suivante qui attend le jour (la mission 2 ne commence pas la nuit), et date au plus tôt. */
  private pendingMission: { def: MissionDef; notBefore: number } | null = null;
  /** Mission à mettre en attente quand l'enfant fermera l'écran de félicitations. */
  private afterCelebration: MissionDef | null = null;
  /** Date à laquelle Pixel dit qu'il faut attendre le matin (null : rien à dire). */
  private tomorrowAt: number | null = null;

  // ---------- V2 lot 1 : verre et fabrication ----------
  /** « On voit à travers ! » : dit à la première pose d'un bloc de verre, une fois par chargement de la page. */
  private glassHintDone = false;
  private readonly craftPanel: CraftPanel;
  /** Marteau : rond du haut (souris) et bouton de la colonne tactile. */
  private readonly craftButton: HTMLButtonElement;
  private readonly craftTouchButton: HTMLButtonElement;
  /** Pixel a présenté le marteau pendant cette partie ; consigne du panneau déjà lue à voix haute (par partie). */
  private craftIntroTold = false;
  private craftOpenTold = false;
  private craftOpenedAt = 0;
  private lastCraftAt = -Infinity;
  /** Quelque chose a été fabriqué depuis l'ouverture du panneau (la partie est alors enregistrée à la fermeture). */
  private craftedSinceOpen = false;
  /** Version du sac affichée par les cartes, et cartes affichées. */
  private craftShownVersion = -1;
  private craftCards: CraftCardView[] = [];
  /** Disponibilité du marteau à l'image précédente (l'aide d'écran en dépend). */
  private craftWasAvailable: boolean | null = null;

  // ---------- V2 lot 1 : mission 2 « Les mots » ----------
  /** Boîte à lettres (26 lettres illimitées) ouverte par la case ABC ou la touche 0. */
  private readonly letterTray: LetterTray;
  /** Lettre tenue dans la case ABC (jamais dans le sac, jamais enregistrée). */
  private handLetter: BlockId | null = null;
  /** La souris était capturée à l'ouverture de la boîte : elle l'est de nouveau au choix d'une lettre. */
  private trayHadLock = false;
  /** Écriture du mot de l'étape en cours (voir WritingRun). */
  private writing: WritingRun | null = null;
  /** Accès de test : voix française supposée présente (true) ou absente (false) ; null : celle du navigateur. */
  private voiceOverride: boolean | null = null;
  /** Lettre choisie et pas encore posée depuis (rappel du geste), et dernier rappel. */
  private letterIdleSince: number | null = null;
  private lastLetterHandHintAt = -Infinity;
  /** Conseil qui suit le « bravo » d'un mot (« Fais le tour pour lire ! », « Un espace entre les mots ! »). */
  private wordFollowUp: { at: number; text: ChildText } | null = null;
  /**
   * Cases du dernier mot réussi (contour vert, 1,2 s) et numéro de cette réussite : un mot réussi dans les mêmes cases
   * que le précédent relance quand même le contour. Cases claires affichées (accès de test : leur nombre et leurs cases).
   */
  private doneMarks: Cell[] = [];
  private doneSerial = 0;
  private ghostCount = 0;
  private ghostCellsShown: Cell[] = [];
  private ghostNextShown = false;
  /** Étape passée par l'accès de test (skipMissionStep) : ramasser et abri comptent comme atteints. */
  private stepSkipped = false;
  /** Case ABC visible à l'image précédente (l'aide d'écran en dépend). */
  private lettersWereOn = false;
  /** Modèle du mot dans le bandeau de Pixel (lettres-blocs, arcs des syllabes) et ce qu'il montre. */
  private readonly companionModel: HTMLDivElement;
  private companionModelKey = "";
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
      // Dictée de la mission 2 : lue seulement s'il existe une voix française (sinon, copie).
      canSpeak: () => this.canSpeak(),
    });
    // Mode adresse : niveau de lecture choisi par l'adresse (&lecture=autonome), débutant sinon (V2).
    if (this.urlMode && opts.lecture) this.narrator.setLevel(opts.lecture);
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
      model: this.companionModel,
    } = this.buildCompanionPanel());
    this.celebration = new Celebration(root);
    // Boîte à lettres (mission 2) : même niveau que le panneau de fabrication, sous les félicitations.
    this.letterTray = new LetterTray(root, (t) => tileIcon(this.view.atlasCanvas, t), pixelFace);
    // Fabrication (V2) : au-dessus du jeu et du calque tactile, sous les félicitations.
    this.craftPanel = new CraftPanel(root, (id) => blockIcon(this.view.atlasCanvas, id));
    this.bubbleButton = this.topButton("bubble-btn", "Bulles", '<circle cx="9" cy="14" r="5"/><circle cx="17" cy="8" r="3.2"/><circle cx="18.5" cy="17" r="2"/>');
    // Au doigt, le même bouton rejoint la colonne des boutons tactiles (sous le pouce droit).
    this.touchColumnButton("bubble-touch", "Bulles", "Bulles", () => this.throwBubbles());
    // Marteau (V2) : rond du haut, et en haut de la colonne tactile (sous le plein écran). Caché tant qu'il n'est
    // pas disponible (voir craftAvailable).
    this.craftButton = this.topButton("craft-btn", "Fabriquer", HAMMER_PATHS);
    this.craftTouchButton = this.touchColumnButton(
      "craft-touch",
      "Fabriquer",
      `<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${HAMMER_PATHS}</svg>`,
      () => this.openCraft(),
    );
    this.craftButton.hidden = true;
    this.craftTouchButton.hidden = true;
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
      if (opts.mission !== undefined) this.startMission(undefined, opts.mission === 0 ? TUTORIAL : opts.mission === 1 ? MISSION_1 : MISSION_2);
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
    this.closeOverlays();
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
    this.closeOverlays();
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
    // Présentation du marteau et consigne du panneau : une fois par partie.
    this.craftIntroTold = false;
    this.craftOpenTold = false;
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
   * si cet enfant a déjà fait le tutoriel). def : mission imposée, qui commence tout de suite (mode adresse,
   * suite de la campagne). Mission nouvelle : Pixel se présente puis lit la consigne ; sinon il rappelle
   * l'étape en cours.
   * V2 lot 1 : à la reprise d'un monde dont la mission 1 est finie, la mission 2 ne commence que de jour
   * (6 h 30 à 16 h 30). Le soir ou la nuit, la mission 1 finie reste en cours (la sauvegarde garde
   * { id: "abri", step: 6 }) et la mission 2 attend le matin (pendingMission, le temps file). Écran de
   * félicitations encore à montrer (partie quittée juste après la fin) : il passe d'abord, la suite après.
   */
  private startMission(saved: unknown, def?: MissionDef): void {
    const now = performance.now();
    const r = def
      ? { def, saved: undefined, fresh: true }
      : resumeMission(saved, this.session?.profile.tutorialDone ?? false, this.celebrateOnResume);
    this.missionDoneAt = 0;
    this.nextMissionAt = null;
    this.celebrationAt = null;
    this.pendingMission = null;
    this.afterCelebration = null;
    this.tomorrowAt = null;
    const rank = CAMPAIGN.indexOf(r.def);
    const before = rank >= 2 ? CAMPAIGN[rank - 1] : undefined;
    if (!def && r.fresh && before && !isMissionDaytime(this.hourNow())) {
      this.mission = new MissionRunner(before, saved);
      this.onStepStart(now);
      this.announceStepAt = null;
      this.queueMission(r.def, now, 1200);
      this.celebrateOnResume = false;
      this.refreshCompanionPanel();
      return;
    }
    this.mission = new MissionRunner(r.def, r.saved);
    this.onStepStart(now);
    if (r.fresh) {
      this.tell(r.def.intro, { ms: 4500, important: true });
      this.announceStepAt = now + 4500;
    } else this.announceStepAt = now + 1200;
    // Partie quittée entre la fin de la mission et l'écran de félicitations : il est montré à la reprise, la suite après.
    if (this.celebrateOnResume && this.mission.done && r.def.recap) {
      this.missionDoneAt = now;
      this.celebrationAt = now + 2000;
      this.afterCelebration = nextMission(r.def);
    }
    this.celebrateOnResume = false;
    this.refreshCompanionPanel();
  }

  /**
   * Suite de la campagne après l'écran de félicitations (V2) : elle attend notBefore et le jour (voir
   * updateLiving). Le soir ou la nuit, le temps file jusqu'au matin (timeMultiplier) et Pixel dit pourquoi on
   * attend, au bout de tomorrowDelayMs.
   */
  private queueMission(def: MissionDef, notBefore: number, tomorrowDelayMs = TOMORROW_AFTER_MS): void {
    this.pendingMission = { def, notBefore };
    this.tomorrowAt = def === MISSION_2 && !isMissionDaytime(this.hourNow()) ? performance.now() + tomorrowDelayMs : null;
  }

  /** Heure du monde, calculée depuis la phase (le ciel n'est recalculé qu'à l'image suivante). */
  private hourNow(): number {
    return skyState(solarTime(this.phase)).hour;
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
    this.stepSkipped = false;
    // Mission 2 : le mot de la nouvelle étape est tiré à la demande (writingRun) ; ses cases claires attendent la consigne.
    this.writing = null;
    this.refreshGhosts();
  }

  /**
   * Le compagnon lit la consigne de l'étape en cours (bouton « répète » compris), selon l'appareil. Mission 2,
   * dictée : la consigne est affichée sans voix et le mot est dicté (lu même voix coupée) ; sans voix française,
   * Pixel dit une fois qu'il faut recopier le mot affiché.
   */
  private announceStep(): void {
    const step = this.mission?.current();
    if (!step) return;
    const t = this.stepTexts(step);
    const w = step.goal.kind === "write" ? this.writingRun() : null;
    if (w) {
      // Les cases claires se tracent là où regarde l'enfant quand il entend la consigne (la première fois).
      w.announced = true;
      if (w.noVoice && !w.noVoiceTold) {
        w.noVoiceTold = true;
        this.tell(NO_VOICE_COPY, { voice: false, ms: 5000 });
      } else if (this.isDictated(w)) {
        this.tell(t.text, { voice: false, ms: 4000 });
        if (!this.narrator.dictate(pick(t.spoken, "autonome"))) this.dictationLost(w);
      } else this.tell(t.text, { spoken: t.spoken, ms: 4000, important: true });
      this.refreshWritingView();
    } else this.tell(t.text, { spoken: t.spoken, ms: 4000, important: true });
    if (step.goal.kind === "watch") this.watchAnnounced = true;
    this.refreshCompanionPanel();
  }

  /** Consigne d'une étape selon l'appareil ; étape d'écriture : selon le mot, le mode et le prénom (mission 2). */
  private stepTexts(step: StepDef): { text: ChildText; spoken: ChildText } {
    const w = step.goal.kind === "write" && step === this.mission?.current() ? this.writingRun() : null;
    if (!w) return stepText(step, this.touchUi);
    return stepText(step, this.touchUi, { mode: w.mode, vars: this.wordVarsFor(w), nameFallback: w.nameFallback });
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
    const text = pick(step ? this.stepTexts(step).text : m.def.outro, this.narrator.level);
    const goal = step?.goal;
    // Pas de compteur pour un mot à écrire (il trahirait la longueur du mot dicté) : le modèle le remplace.
    const counted = goal && (goal.kind === "collect" || goal.kind === "place" || goal.kind === "break" || goal.kind === "letter");
    const p = counted ? m.progress(this.inventory) : null;
    const prog = p ? `${p.have} / ${p.need}` : "";
    // Écrire seulement ce qui change (le panneau est rafraîchi à chaque image).
    if (this.companionText.textContent !== text) {
      this.companionText.textContent = text;
      this.placeMessageBelowCompanion();
    }
    if (this.companionProgress.textContent !== prog) this.companionProgress.textContent = prog;
    const iconId = step?.icon ?? (goal && (goal.kind === "collect" || goal.kind === "place") && typeof goal.block === "number" ? goal.block : null);
    // Mission 2, étape 0 : « ABC » en tuiles de lettres (la case à toucher).
    const word = goal?.kind === "letter" ? LETTERS_LABEL : null;
    const iconKey = word !== null ? `word:${word}` : iconId !== null ? `block:${iconId}` : "";
    if (iconKey !== this.companionIconKey) {
      this.companionIconKey = iconKey;
      const icon = this.companionIcon;
      icon.style.display = iconKey === "" ? "none" : "";
      icon.dataset.block = word === null && iconId !== null ? String(iconId) : "";
      icon.classList.toggle("word", word !== null);
      const src = word !== null ? wordIcon(this.view.atlasCanvas, word) : iconId !== null ? blockIcon(this.view.atlasCanvas, iconId) : null;
      if (src) {
        icon.width = src.width;
        icon.height = src.height;
        const g = icon.getContext("2d");
        if (g) {
          g.imageSmoothingEnabled = false;
          g.clearRect(0, 0, icon.width, icon.height);
          g.drawImage(src, 0, 0);
        }
      }
    }
    this.refreshCompanionModel();
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
   * Case où une Grignote chipe un bloc : jamais une lampe, ni un cadeau (arc-en-ciel), ni le bloc de l'étape de mission en cours
   * (règle unique discardVerdict, V2) ; de préférence dans une grosse pile (tirage proportionnel au nombre). null : rien à prendre.
   */
  private pickStealSlot(): number | null {
    const kept = this.keptBlocks();
    const slots = this.inventory.slots();
    let total = 0;
    const safe = (id: BlockId) => discardVerdict({ id, count: 1 }, kept) === "ok";
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

  /**
   * Blocs que demande l'étape en cours (V2) : protégés de l'appui long, du vol des Grignotes et du conseil « sac plein »
   * (« aucun échec bloquant »). Seulement pour un objectif ramasser, poser ou casser d'un bloc précis.
   */
  private keptBlocks(): BlockId[] {
    const goal = this.mission?.current()?.goal;
    if (!goal || (goal.kind !== "collect" && goal.kind !== "place" && goal.kind !== "break")) return [];
    return typeof goal.block === "number" ? [goal.block] : [];
  }

  /** La lampe peut-elle être citée (décision 6 de Pierre : pas avant que l'enfant l'ait vue éloigner les Grignotes) ? */
  private lampIsRevealed(): boolean {
    const m = this.mission;
    return lampRevealed(m?.def ?? null, m?.done ?? false);
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
    model: HTMLDivElement;
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
    // Modèle du mot (mission 2) : sur sa propre ligne, sous la consigne ; toucher une lettre la dit.
    const model = document.createElement("div");
    model.className = "companion-model";
    model.hidden = true;
    for (const ev of ["mousedown", "touchstart"]) model.addEventListener(ev, (e) => e.stopPropagation());
    model.addEventListener("click", (e) => {
      const ch = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-letter]")?.dataset.letter : undefined;
      if (ch) this.sayLetterName(ch);
    });
    panel.append(face, text, icon, progress, shelter, repeat, model);
    this.hud.root.appendChild(panel);
    window.addEventListener("resize", () => this.placeMessageBelowCompanion());
    return { panel, text, progress, shelter, icon, model };
  }

  /**
   * Gèle le jeu sous un écran posé dessus (V2 : félicitations ; fabrication et boîte à lettres ensuite) : souris
   * libérée, casse, doigts, appui « casser », touches et appui long oubliés, jeu en pause.
   */
  private freezeForOverlay(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.breaker.reset();
    this.touch.reset();
    this.mouse.cancelPress();
    this.keyboard.clear();
    this.hud.setBreakProgress(null);
    this.cancelSlotHold();
    this.paused = true;
  }

  /**
   * Ferme sans bruit ce qui est posé sur le jeu et oublie ce qui attendait (V2) : retour à l'accueil, nouveau
   * monde, monde rechargé, adresse changée, autre onglet. Panneau de fabrication et boîte à lettres fermés, appui
   * long annulé ; mission en attente du matin et suite des félicitations oubliées (la reprise du monde les retrouve
   * depuis la sauvegarde). Mission 2 : lettre en main, cases claires, contours et horloge d'aide remis à zéro (le mot
   * en cours est gardé par la mission).
   */
  private closeOverlays(): void {
    this.closeCraft({ silent: true });
    if (this.letterTray.visible) {
      this.letterTray.close();
      this.paused = false;
      this.keyboard.clear();
    }
    this.cancelSlotHold();
    this.pendingMission = null;
    this.afterCelebration = null;
    this.tomorrowAt = null;
    this.handLetter = null;
    this.letterIdleSince = null;
    if (this.selectedSlot === LETTER_SLOT) this.setSlot(0);
    this.writing = null;
    this.wordFollowUp = null;
    this.doneMarks = [];
    this.refreshGhosts();
  }

  /** Annule l'appui long en cours (souris, doigt ou touche) et masque son anneau. */
  private cancelSlotHold(): void {
    this.hud.cancelSlotHold();
    this.keyHold = null;
  }

  /** Retour à l'accueil : la partie est enregistrée (sauf save = faux), le jeu attend en pause. */
  private goHome(save = true): void {
    if (!this.home) return;
    const saved = save && this.saveNow();
    this.closeOverlays();
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
      // Signal de la nuit : à 17 h 30, un carillon et le compagnon prévient. Rien pendant l'attente du matin (V2).
      const h = this.sky.hour;
      if (this.creaturesOn() && this.pendingMission === null && this.prevHour >= 0 && this.prevHour < 17.5 && h >= 17.5 && h < 19) {
        this.sounds.play("night");
        // Pendant la dernière étape de la mission 1, le carillon seul : la phrase couperait la consigne de Pixel.
        // Décision 6 de Pierre : la lampe n'est citée qu'une fois découverte (mission 1 finie, mission 2, jeu libre).
        if (this.mission?.current()?.goal.kind !== "watch") {
          this.tell(this.lampIsRevealed() ? NIGHT_COMING_LAMP : NIGHT_COMING, { ms: 4000, important: true });
        }
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
          } else if (this.lampIsRevealed() && now - this.lampScareToldAt > 60_000) {
            // Hors de la dernière étape, seulement une fois la lampe découverte (décision 6 de Pierre).
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
          // Objectif « ramasser » atteint : le compte réel est dit (« Six troncs ! Bravo ! ») ; mot écrit (mission 2) :
          // « Tu as écrit AMI ! » ; sinon « Bravo ! ».
          const done = m.def.steps[ev.index - 1]?.goal;
          let said = pick(BRAVO, this.narrator.level);
          if (done?.kind === "collect") {
            const t = goalReachedText(done.block, Math.max(done.count, this.inventory.count(done.block)));
            this.tell(t.text, { spoken: t.spoken, ms: 2000, important: true });
            said = pick(t.spoken, this.narrator.level);
          } else if (done?.kind === "write") said = this.tellWordDone(now);
          else this.tell(BRAVO, { ms: 1500, important: true });
          this.onStepStart(now);
          // La consigne suivante attend la fin de la phrase (sinon la voix la couperait), et le conseil qui suit un mot.
          this.announceStepAt = this.afterSaid(now, said);
          this.saveNow();
        } else if (ev?.kind === "done") this.onMissionDone(m.def, now);
        if (this.announceStepAt !== null && now >= this.announceStepAt) {
          this.announceStepAt = null;
          // Étape d'écriture dont le mot est déjà lisible (prénom écrit plus tôt, pendant les mots 1 à 3) : il est
          // relu ici, sans attendre qu'un bloc change, et l'étape est atteinte.
          if (m.current()?.goal.kind === "write") this.checkWritingAtStart();
          // Étape déjà atteinte (7 pierres dans le sac en arrivant à « ramasse 4 pierres », mot déjà écrit) : pas de
          // consigne, le « bravo » arrive à l'image suivante.
          const p = m.progress(this.missionView);
          if (!(p && p.have >= p.need)) this.announceStep();
        }
        if (this.nextMissionAt && now >= this.nextMissionAt.at) this.startMission(undefined, this.nextMissionAt.def);
        if (this.celebrationAt !== null && now >= this.celebrationAt) {
          this.celebrationAt = null;
          this.showCelebration(m.def);
        }
        this.updatePendingMission(now, h);
        this.maybeIntroduceCraft(now);
        this.updateWriting(now, dt * 1000);
        this.letterHandReminder(now);
        if (this.wordFollowUp && now >= this.wordFollowUp.at) {
          const t = this.wordFollowUp.text;
          this.wordFollowUp = null;
          this.tell(t, { ms: WORD_FOLLOW_UP_READ_MS + 1000, important: true });
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

  /**
   * Mission suivante qui attend (V2) : la nuit, Pixel dit qu'on attend le matin ; de jour, une fois notBefore passé,
   * elle commence. Le temps file pendant l'attente (timeMultiplier).
   */
  private updatePendingMission(now: number, hour: number): void {
    const pm = this.pendingMission;
    if (!pm || this.paused) return;
    const day = isMissionDaytime(hour);
    if (this.tomorrowAt !== null && now >= this.tomorrowAt) {
      this.tomorrowAt = null;
      if (!day) {
        this.tell(MISSION_2_TOMORROW, { ms: 4000, important: true });
        pm.notBefore = Math.max(pm.notBefore, now + TOMORROW_READ_MS);
      }
    }
    if (day && now >= pm.notBefore) this.startMission(undefined, pm.def);
  }

  /** Bloc changé par l'enfant depuis la génération du monde (posé ou creusé) : un abri doit être le sien. */
  private readonly changedAt = (x: number, y: number, z: number): boolean => {
    const w = this.world;
    if (!w.inBounds(x, y, z)) return false;
    const i = w.index(x, y, z);
    return w.data[i] !== this.baseData[i];
  };

  /** Ce que la mission observe ; une étape passée par l'accès de test (skipMissionStep) compte comme atteinte. */
  private readonly missionView: MissionView = {
    count: (id) => {
      const g = this.mission?.current()?.goal;
      const n = this.inventory.count(id);
      return this.stepSkipped && g?.kind === "collect" && g.block === id ? Math.max(n, g.count) : n;
    },
    shelter: () => (this.stepSkipped ? { roof: true, walls: 4, own: true, ok: true } : this.shelterNow),
  };

  /**
   * Étape qui n'avance plus (J7) : au bout de STALL_HINT_MS sans progrès, Pixel donne le conseil de l'étape
   * (« Creuse : la pierre est dessous ! »), puis au plus toutes les STALL_HINT_EVERY_MS.
   */
  private stallHint(now: number): void {
    const m = this.mission;
    const step = m?.current();
    if (!m || !step || this.announceStepAt !== null) return;
    // L'avancement est suivi à chaque étape, conseil ou non (V2 : l'étape abri a un conseil calculé).
    const have = m.progress(this.missionView)?.have ?? 0;
    if (have !== this.stepHave) {
      this.stepHave = have;
      this.stepProgressAt = now;
      return;
    }
    if (now - this.stepProgressAt < STALL_HINT_MS || now - this.lastStallHintAt < STALL_HINT_EVERY_MS) return;
    // Étape abri, sac presque vide et marteau découvert : fabriquer des planches (V2).
    const craftHint = step.goal.kind === "shelter" ? this.craftMoreHint() : null;
    if (!step.hint && !craftHint) return;
    this.lastStallHintAt = now;
    // Sac plein et bloc demandé qui n'y entrerait pas : le vrai conseil est de vider une case, pas de chercher.
    const g = step.goal;
    if (g.kind === "collect" && !this.inventory.canAdd(g.block)) {
      this.tellFullBag(4500, g.block);
      return;
    }
    if (craftHint) this.tell(craftHint.text, { spoken: craftHint.spoken, ms: 4500, important: true });
    else if (step.hint) this.tell(step.hint, { spoken: step.hintSpoken ?? step.hint, ms: 4500, important: true });
  }

  /**
   * Sac plein (J7) : dit quelle case vider, concrètement (« Pose tes 2 fleurs rouges ! ») : la sorte la moins
   * nombreuse, hors lampe, cadeau, bloc demandé par l'étape et bloc keep (celui qu'on voulait ramasser). V2 : le
   * geste pour la vider selon l'appareil (doigt gardé, touche gardée), et la case fait sa petite animation. Sans
   * proposition, le message générique.
   */
  private tellFullBag(ms: number, keep: BlockId | null = null): void {
    const slots = this.inventory.slots();
    const i = slotToEmpty(slots, keep === null ? this.keptBlocks() : [...this.keptBlocks(), keep]);
    const st = i === null ? null : (slots[i] ?? null);
    if (i === null || !st) {
      this.tell(this.touchUi ? FULL_BAG_KEEP_TOUCH : FULL_BAG_KEEP, {
        spoken: this.touchUi ? SPOKEN_TIPS.fullBagTouch : SPOKEN_TIPS.fullBagKeys,
        ms,
        dedupe: true,
      });
      return;
    }
    const t = emptySlotText(st.id, st.count, this.touchUi ? { kind: "touch" } : { kind: "key", key: i + 1 });
    this.tell(t.text, { spoken: t.spoken, ms, important: true, dedupe: true });
    this.hud.pulseSlot(i);
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

  /** Mission suivante qui attend le jour (V2) : le temps file jusqu'au matin. */
  private morningBoost(): boolean {
    return !this.paused && this.pendingMission !== null && !isMissionDaytime(this.sky.hour) && this.companionOn();
  }

  /** Vitesse du temps : Temps ×20 du panneau, et ×30 pendant la dernière étape de la mission 1 ou l'attente du matin. */
  private timeMultiplier(): number {
    return this.timeScale * (this.watchBoost() ? WATCH_TIME_BOOST : this.morningBoost() ? MORNING_TIME_BOOST : 1);
  }

  /**
   * Le soir s'arrête à 17 h (V2, décisions 4 et 11 de Pierre) : compagnon actif, mission en cours et étape qui le
   * demande (tutoriel, mission 1 jusqu'à l'abri, mission 2). Les boutons Soir et Nuit du panneau passent outre.
   */
  private eveningHeld(): boolean {
    const m = this.mission;
    return this.companionOn() && m !== null && !m.done && m.current()?.holdEvening === true;
  }

  /**
   * Fin d'une mission : Pixel félicite ; le tutoriel est retenu pour l'enfant et la mission 1 suit ;
   * la mission 1 donne son cadeau et ouvre l'écran de félicitations. V2 : après un écran de félicitations,
   * la suite (mission 2) attend qu'il soit fermé, puis le jour.
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
      // Un cadeau précédent encore en attente (sac plein depuis la mission 1) : les deux s'additionnent.
      const r = this.rewardPending;
      this.rewardPending = r && r.block === def.reward.block ? { block: r.block, count: r.count + def.reward.count } : { ...def.reward };
      this.rewardSeenInventory = -1;
      this.deliverReward(false);
    }
    const lastGoal = def.steps[def.steps.length - 1]?.goal;
    if (def.recap && lastGoal?.kind === "write") {
      // Mission 2 : le dernier mot est félicité (« Tu as écrit LEA ! »), puis l'écran ; au doigt, retour au mode Casser.
      const said = this.tellWordDone(now);
      this.celebrationAt = this.afterSaid(now, said);
      if (this.touch.mode === "place") this.touch.setMode("break");
    } else if (def.recap) {
      // La découverte (logique) : dite par Pixel quand l'enfant a vu les Grignotes fuir la lampe (et pas redite aussitôt,
      // voir flee-lamp).
      if (this.watchSawScare) {
        this.tell(LAMP_SCARES, { ms: 3500, important: true });
        this.lampScareToldAt = now;
      } else this.tell(BRAVO, { ms: 1500, important: true });
      this.celebrationAt = now + (this.watchSawScare ? CELEBRATION_DELAY_MS : 1600);
    } else this.tell(def.outro, { ms: 3000, important: true });
    this.watchSawScare = false;
    const next = nextMission(def);
    if (next && def.recap) this.afterCelebration = next;
    else if (next) this.nextMissionAt = { at: now + NEXT_MISSION_DELAY_MS, def: next };
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
    if (this.paused) return; // un autre écran est déjà posé sur le jeu
    const level = this.narrator.level;
    const title = bravoTitle(this.session?.profile.name ?? null);
    const icon = (id: BlockId) => blockIcon(this.view.atlasCanvas, id);
    const name = this.session?.profile.name ?? null;
    const words = this.mission?.def === def ? this.mission.words : [];
    const recap: CelebrationLine[] = (def.recap ?? []).flatMap((item): CelebrationLine[] => {
      if ("block" in item) return [{ icon: icon(item.block), text: capitalize(quantity(item.block, item.count)) }];
      if ("words" in item) {
        // Mission 2 : chaque mot écrit, en blocs-lettres, avec sa forme en minuscules (« lampe (5 lettres) »).
        return words.map((w) => {
          const c = wordIcon(this.view.atlasCanvas, w);
          c.classList.add("celebration-word");
          c.setAttribute("aria-hidden", "true");
          return { icon: c, text: recapWordLabel(w, level, name) };
        });
      }
      const house = shelterIcon(40);
      setShelterParts(house, true, 3, true);
      return [{ icon: house, text: "Un abri" }];
    });
    const recapSaid = (def.recap ?? []).some((item) => "words" in item) ? fillWord(RECAP_SPOKEN, recapVars(words, level, name)) : null;
    const reward = def.reward ? rewardText(def.reward.block, def.reward.count) : null;
    this.freezeForOverlay();
    this.hud.message.classList.remove("visible"); // pas de message qui dépasse derrière la carte
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
        const now = performance.now();
        // Les Grignotes fuient encore la lampe : « Elles fuient la lampe ! », déjà dit, ne recouvre pas le message du cadeau.
        this.lampScareToldAt = now;
        if (this.rewardPending) {
          this.tell(this.touchUi ? REWARD_WAITING_TOUCH : REWARD_WAITING, {
            spoken: this.touchUi ? SPOKEN_TIPS.rewardTouch : SPOKEN_TIPS.rewardKeys,
            ms: REWARD_WAITING_MS,
          });
        }
        // Suite de la campagne (V2) : elle attend un court instant (le temps de lire le message du cadeau), et le jour.
        const next = this.afterCelebration;
        this.afterCelebration = null;
        if (next) this.queueMission(next, now + (this.rewardPending ? REWARD_WAITING_MS : AFTER_CELEBRATION_DELAY_MS));
        this.updateHint();
      },
    );
    this.sounds.play("bravo");
    window.setTimeout(() => this.sounds.play("bravo"), 500);
    // Lu d'une traite (lecteur débutant, voix active) : le titre, la phrase de Pixel, les mots écrits, le cadeau.
    const joined = (l: "debutant" | "autonome") =>
      [pick(title, l), pick(def.outro, l), recapSaid ? pick(recapSaid, l) : "", reward ? pick(reward.spoken, l) : ""].filter((x) => x !== "").join(" ");
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

  /**
   * Bouton de la colonne tactile (sous le pouce droit) : ajouté à la fin, pour que le bouton Casser / Poser reste le
   * premier (le CSS règle l'ordre affiché). Il agit dès que le doigt se pose, sans clic ni souris synthétisés.
   * content : texte ou dessin SVG (HTML fixe, jamais une saisie).
   */
  private touchColumnButton(className: string, label: string, content: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `touch-btn ${className}`;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = content;
    b.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTap();
      },
      { passive: false },
    );
    this.touch.root.querySelector(".touch-buttons")?.appendChild(b);
    return b;
  }

  // ---------- Fabrication (V2 lot 1) ----------

  /**
   * Le marteau est-il là ? Partie en cours (enfant ou mode adresse), pas pendant le tutoriel ; dans une partie
   * d'enfant, seulement une fois découvert (profil) ou présenté par Pixel dans cette partie. En mode adresse,
   * toujours (sauf #mission=0).
   */
  private craftAvailable(): boolean {
    if (!this.urlMode && !this.session) return false;
    if (this.mission?.def === TUTORIAL) return false;
    return this.urlMode || this.session?.profile.craftSeen === true || this.craftIntroTold;
  }

  /** Ingrédient gardé pour la mission : le bloc de l'étape « ramasser » en cours, qu'on ne peut pas faire passer sous son nombre. */
  private craftReserve(): CraftReserve | null {
    if (!this.companionOn()) return null;
    const goal = this.mission?.current()?.goal;
    return goal?.kind === "collect" ? { block: goal.block, keep: goal.count } : null;
  }

  /** Cartes du panneau d'après le sac et la réserve (la version du sac est retenue pour les mettre à jour). */
  private craftViews(): { views: CraftCardView[]; anyPossible: boolean } {
    const slots = this.inventory.slots();
    const plans = craftPlans(slots, { reserved: this.craftReserve() });
    this.craftShownVersion = this.inventory.version;
    this.craftCards = craftCardViews(plans, slots, this.narrator.level);
    return { views: this.craftCards, anyPossible: plans.some((p) => p.ok) };
  }

  /**
   * Ouvre le panneau de fabrication (marteau, touche F) : le jeu se fige dessous comme pour les félicitations. Refusé
   * pendant une autre pause (accueil, félicitations) ou si le marteau n'est pas disponible. Renvoie vrai s'il s'ouvre.
   */
  private openCraft(): boolean {
    if (this.paused || this.craftPanel.visible || !this.craftAvailable()) return false;
    this.freezeForOverlay();
    this.narrator.cancelPending();
    this.hud.setCraftOpen(true);
    this.hud.message.classList.remove("visible"); // la ligne d'état du panneau prend le relais
    this.craftOpenedAt = performance.now();
    this.craftedSinceOpen = false;
    const { views, anyPossible } = this.craftViews();
    const status = anyPossible ? (this.touchUi ? CRAFT_OPEN_TOUCH : CRAFT_OPEN_MOUSE) : CRAFT_NOTHING;
    const level = this.narrator.level;
    this.craftPanel.show(views, level, pick(status, level), {
      pick: (id) => void this.doCraft(id),
      close: () => this.closeCraft(),
    });
    this.sounds.play("select");
    // Rien de possible : la voix dit où trouver des blocs ; sinon, la consigne n'est lue qu'à la première ouverture.
    if (!anyPossible) this.narrator.say(SPOKEN_TIPS.craftNothing, { dedupe: true });
    else if (!this.craftOpenTold) this.narrator.say(status, { dedupe: true });
    this.craftOpenTold = true;
    this.markCraftSeen();
    this.syncCraftButtons();
    return true;
  }

  /**
   * Ferme le panneau (F, Échap, croix, voile) : le jeu reprend. silent : fermeture imposée par le jeu (accueil,
   * autre monde), sans son ni message. Sinon, la partie est enregistrée si quelque chose a été fabriqué, et, souris
   * libre au PC, « Clique pour jouer ».
   */
  private closeCraft(opts: { silent?: boolean } = {}): void {
    if (!this.craftPanel.visible) return;
    this.craftPanel.hide();
    this.hud.setCraftOpen(false);
    this.paused = false;
    this.keyboard.clear();
    this.touch.reset();
    this.mouse.cancelPress();
    this.updateHint();
    if (opts.silent) return;
    this.sounds.play("select");
    if (this.craftedSinceOpen) this.saveNow();
    if (!this.touchUi && !this.mouse.locked && !this.mouse.inFallback()) this.tell(MOUSE_RESUME, { ms: 2500, dedupe: true });
  }

  /**
   * Une fabrication (carte touchée, ou accès de test : fromDebug, sans les délais du doigt). Tout ou rien : le sac
   * change d'un coup, ou le jeu dit pourquoi (réserve de la mission, ingrédient qui manque, maximum, sac plein) et la
   * carte tremble. Sac plein : la case à vider remue.
   */
  private doCraft(id: RecipeId, fromDebug = false): CraftResult {
    const recipe = recipeById(id);
    if (!recipe) return { ok: false, reason: "unknown" };
    if (!this.craftAvailable()) return { ok: false, reason: "unavailable" };
    const now = performance.now();
    // Un toucher = une fabrication : pas dans les premiers instants du panneau, ni deux fois de suite trop vite.
    if (!fromDebug && (now < this.craftOpenedAt + CRAFT_ARM_MS || now - this.lastCraftAt < CRAFT_REPEAT_MS)) {
      return { ok: false, reason: "early" };
    }
    this.lastCraftAt = now;
    const reserved = this.craftReserve();
    const before = this.inventory.slots();
    const plan = craft(this.inventory, recipe, { reserved });
    let result: CraftResult;
    if (plan.ok) {
      const out = recipe.output.block;
      const made = recipe.output.count;
      this.sounds.play("craft");
      const first = !this.collectedTypes.has(out);
      this.collectedTypes.add(out);
      this.hud.pulseSlot(plan.outputSlot);
      if (!plan.sameSlot) this.hud.slotDelta(plan.inputSlot, `−${recipe.input.count}`);
      this.hud.slotDelta(plan.outputSlot, `+${made}`);
      // Main vide (la case de l'ingrédient s'est vidée, ou rien n'était tenu) : le résultat passe dans la main.
      if (this.handEmpty()) this.setSlot(plan.outputSlot);
      this.refreshInventory();
      this.craftedSinceOpen = true;
      let t: SaidText = craftText(out, plan.before, made);
      if (out === BlockId.Glass && first) t = withFact(t, CRAFT_GLASS_FACT);
      this.notify(t.text, { spoken: t.spoken, voiceDelayMs: CRAFT_VOICE_DELAY_MS, ms: 2500, tone: "ok" });
      result = { ok: true, outputSlot: plan.outputSlot, before: plan.before, after: plan.after };
    } else {
      this.sounds.play("deny");
      this.craftPanel.shake(id);
      const r = craftRefusalText(plan, craftPlans(before, { reserved }), this.touchUi);
      this.notify(r.text, { spoken: r.spoken, ms: 3000, dedupe: true, tone: "no" });
      if (plan.reason === "full") {
        // La case à vider remue : jamais la lampe, le cadeau, l'ingrédient, le résultat ni le bloc de l'étape.
        const k = slotToEmpty(before, [recipe.input.block, recipe.output.block, ...this.keptBlocks()]);
        if (k !== null) this.hud.wiggleSlot(k);
        else {
          this.notify(this.touchUi ? FULL_BAG_KEEP_TOUCH : FULL_BAG_KEEP, {
            spoken: this.touchUi ? SPOKEN_TIPS.fullBagTouch : SPOKEN_TIPS.fullBagKeys,
            ms: 3000,
            dedupe: true,
            tone: "no",
          });
        }
      }
      result = { ok: false, reason: plan.reason };
    }
    if (this.craftPanel.visible) this.craftPanel.update(this.craftViews().views);
    return result;
  }

  /** Marteau découvert (première ouverture du panneau) : retenu dans le profil de l'enfant, pour tous ses mondes. */
  private markCraftSeen(): void {
    const s = this.session;
    if (!s || s.profile.craftSeen === true) return;
    s.profile.craftSeen = true;
    const list = this.store.loadProfiles();
    if (!list) return;
    for (const p of list) if (p.id === s.profile.id) p.craftSeen = true;
    this.store.saveProfiles(list);
  }

  /**
   * À chaque image : marteaux montrés ou cachés, halo jusqu'à la découverte (partie d'enfant), aide d'écran quand
   * la disponibilité change ; panneau ouvert, cartes à jour si le sac a changé (appui long sur une case…).
   */
  private syncCraftButtons(): void {
    const available = this.craftAvailable();
    if (this.craftButton.hidden === available) {
      this.craftButton.hidden = !available;
      this.craftTouchButton.hidden = !available;
    }
    const glow = available && this.session !== null && this.session.profile.craftSeen !== true;
    this.craftButton.classList.toggle("new", glow);
    this.craftTouchButton.classList.toggle("new", glow);
    if (available !== this.craftWasAvailable) {
      this.craftWasAvailable = available;
      this.updateHint();
    }
    if (this.craftPanel.visible && this.inventory.version !== this.craftShownVersion) this.craftPanel.update(this.craftViews().views);
  }

  /**
   * Présentation du marteau par Pixel, une fois par partie tant que l'enfant ne l'a pas découvert : à l'étape abri de
   * la mission 1 (ou une fois toute la campagne finie), au moins 15 s après le début de l'étape, quand Pixel ne parle
   * pas, qu'aucune consigne n'attend et qu'une recette est possible. Jamais au tutoriel, à la dernière étape, pendant
   * l'attente du matin ni pendant la mission 2.
   */
  private maybeIntroduceCraft(now: number): void {
    const s = this.session;
    const m = this.mission;
    if (!s || s.profile.craftSeen === true || this.craftIntroTold || !m || m.def === TUTORIAL || !this.companionOn()) return;
    if (this.pendingMission || this.announceStepAt !== null || this.celebrationAt !== null || this.nextMissionAt !== null) return;
    const shelterStep = m.current()?.goal.kind === "shelter";
    const campaignOver = m.done && nextMission(m.def) === null;
    if (!shelterStep && !campaignOver) return;
    if (now - this.stepStartedAt < CRAFT_INTRO_AFTER_MS || this.narrator.busy) return;
    const possible = craftPlans(this.inventory.slots(), { reserved: this.craftReserve() }).find((p) => p.ok);
    if (!possible) return;
    this.craftIntroTold = true;
    this.sounds.play("select");
    const intro = craftIntroText(possible.recipe, this.touchUi);
    this.tell(intro.text, { spoken: intro.spoken, ms: 6000, important: true });
    this.syncCraftButtons();
  }

  /** Conseil de l'étape abri quand le sac est presque vide (V2) : fabriquer des planches, si c'est possible. */
  private craftMoreHint(): SaidText | null {
    if (!this.craftAvailable() || this.inventory.totalBlocks() >= CRAFT_HINT_BLOCKS) return null;
    const planks = RECIPES[0];
    if (!planks || !planCraft(this.inventory.slots(), planks, { reserved: this.craftReserve() }).ok) return null;
    return craftMoreBlocksText(this.touchUi);
  }

  // ---------- Mission 2 « Les mots » (V2 lot 1) ----------

  /** La case ABC est-elle là ? Compagnon actif et mission 2 (ou suivante) commencée, finie comprise. */
  private lettersOn(): boolean {
    return this.companionOn() && lettersUnlocked(this.mission?.def ?? null);
  }

  /** Une voix française peut lire la dictée (sinon, copie) ; l'accès de test peut le forcer (assumeVoice). */
  private canSpeak(): boolean {
    return this.voiceOverride ?? (this.speech.supported && this.speech.frenchVoices().length > 0);
  }

  /** À chaque image : case ABC montrée ou cachée, lettre tenue, anneau de l'étape 0 ; aide d'écran quand elle change. */
  private syncLetters(): void {
    const on = this.lettersOn();
    if (!on) {
      this.handLetter = null;
      this.letterIdleSince = null;
      if (this.selectedSlot === LETTER_SLOT) this.setSlot(0);
    }
    const hand = this.handLetter;
    this.hud.setLettersCell({
      visible: on,
      tile: on && hand !== null ? Tile.LetterA + (hand - BlockId.LetterA) : null,
      selected: this.selectedSlot === LETTER_SLOT,
      hint: on && this.mission?.current()?.goal.kind === "letter",
    });
    if (on !== this.lettersWereOn) {
      this.lettersWereOn = on;
      this.updateHint();
    }
  }

  /**
   * Ouvre la boîte à lettres (case ABC, touche 0, poser sans lettre en main) : le jeu se fige dessous comme pour
   * la fabrication. Refusée pendant une autre pause ou sans case ABC. La partie est enregistrée (une boîte laissée
   * ouverte ne bloque pas la sauvegarde automatique). Renvoie vrai si elle s'ouvre.
   */
  private openLetters(): boolean {
    if (this.paused || this.letterTray.visible || !this.lettersOn()) return false;
    this.trayHadLock = this.mouse.locked;
    this.freezeForOverlay();
    this.hud.message.classList.remove("visible"); // pas de message qui dépasse derrière la boîte
    this.saveNow();
    this.letterTray.open(this.trayContent(), {
      pick: (ch) => this.pickLetter(ch),
      close: () => this.afterTrayClosed(),
      repeat: () => this.repeatDictation(),
      sayLetter: (ch) => this.sayLetterName(ch),
    });
    this.sounds.play("select");
    return true;
  }

  /** Contenu de la boîte : titre, ligne du clavier (PC), modèle du mot, lettre attendue et son anneau, haut-parleur. */
  private trayContent(): TrayContent {
    const level = this.narrator.level;
    const w = this.writingRun();
    const expected = w && !w.found && w.mode === "copy" && w.have < w.target.length ? w.target.charAt(w.have) : null;
    return {
      title: pick(TRAY_TITLE, level),
      keyboardLine: this.touchUi ? null : pick(TRAY_KEYBOARD, level),
      model: w && !w.found ? this.wordModel(w) : null,
      expected,
      glow: w !== null && expected !== null && (w.show.trayGlow || w.firstWord),
      speaker: w !== null && this.isDictated(w),
    };
  }

  /** Boîte fermée sans choix (voile, croix, Échap, 0) : le jeu reprend. */
  private afterTrayClosed(): void {
    this.paused = false;
    this.keyboard.clear();
    this.touch.reset();
    this.mouse.cancelPress();
    this.updateHint();
    if (!this.touchUi && !this.mouse.locked && !this.mouse.inFallback()) this.tell(MOUSE_RESUME, { ms: 2500, dedupe: true });
  }

  /**
   * Lettre choisie dans la boîte (déjà fermée) : elle va dans la main (case ABC), son nom est dit. Au doigt, le mode
   * Poser ; au PC, la souris est capturée de nouveau dans le même geste si elle l'était. En copie, une autre lettre que
   * celle attendue reste en main, et Pixel dit laquelle chercher.
   */
  private pickLetter(ch: string): void {
    this.paused = false;
    this.keyboard.clear();
    this.touch.reset();
    this.mouse.cancelPress();
    const id = letterBlockId(ch);
    if (id === null || !this.lettersOn()) {
      this.updateHint();
      return;
    }
    this.handLetter = id;
    this.letterIdleSince = performance.now();
    this.setSlot(LETTER_SLOT, true); // son « select », « lettre M » au-dessus de la barre
    this.syncLetters();
    if (this.touchUi) {
      if (this.touch.mode !== "place") this.touch.setMode("place");
    } else if (this.trayHadLock && !this.mouse.locked) this.mouse.requestLock();
    this.updateHint();
    const w = this.writingRun();
    const want = w && !w.found && w.mode === "copy" ? w.target.charAt(w.have) : "";
    if (w && want !== "" && want !== ch) {
      const t = fillSaid(TRAY_WRONG_PICK, { ...this.wordVarsFor(w), L: want, nom: letterName(want), nomChoisi: letterName(ch) });
      this.tell(t.text, { spoken: t.spoken, ms: 3000, dedupe: true, important: true });
      return;
    }
    this.sayLetterName(ch);
    if (!this.touchUi && !this.trayHadLock && !this.mouse.locked && !this.mouse.inFallback()) this.tell(MOUSE_RESUME, { ms: 2500, dedupe: true });
  }

  /** Accès de test : comme un choix dans la boîte (ouverte ou non). */
  private debugChooseLetter(ch: string): boolean {
    const up = typeof ch === "string" ? ch.toUpperCase() : "";
    if (letterBlockId(up) === null || !this.lettersOn()) return false;
    if (this.letterTray.visible) this.letterTray.close();
    else if (this.paused) return false;
    this.pickLetter(up);
    return true;
  }

  /** Nom d'une lettre (« emme »), lu si la voix est active. */
  private sayLetterName(ch: string): void {
    const n = letterName(ch);
    this.narrator.say({ debutant: n, autonome: n });
  }

  /** Haut-parleur de la boîte : le mot est dicté de nouveau. */
  private repeatDictation(): void {
    const step = this.mission?.current();
    const w = this.writingRun();
    if (!step || !w || !this.isDictated(w)) return;
    this.narrator.dictate(pick(this.stepTexts(step).spoken, "autonome"));
  }

  /**
   * Poser la lettre tenue (case ABC choisie) : mêmes refus qu'un bloc (bord du monde, pas de place), sans rien
   * prendre dans le sac (les lettres sont illimitées). Sans lettre en main, la boîte s'ouvre.
   */
  private placeLetter(): void {
    const id = this.handLetter;
    if (id === null) {
      this.openLetters();
      return;
    }
    if (!this.target) return;
    const t = this.target;
    const w = this.world;
    const onPlant = isPlantId(w.get(t.x, t.y, t.z));
    const x = onPlant ? t.x : t.x + t.nx;
    const y = onPlant ? t.y : t.y + t.ny;
    const z = onPlant ? t.z : t.z + t.nz;
    if (!w.inBounds(x, y, z)) {
      this.deny(WORLD_EDGE);
      return;
    }
    if (boxesIntersect(blockBox(x, y, z), this.player.box())) {
      this.deny(NO_SPACE);
      return;
    }
    const replaced = w.get(x, y, z);
    if (replaced === id || !w.set(x, y, z, id)) return;
    this.mission?.notePlaced(id);
    this.letterIdleSince = null;
    this.sounds.play("place", id);
    if (isPlantId(replaced)) this.collect(replaced);
    this.afterBlockChange(true);
  }

  /** Un bloc posé ou cassé pendant une étape d'écriture : le mot est relu (après une lettre posée, de nouveau plus tard). */
  private afterBlockChange(letterPlaced: boolean): void {
    const w = this.writingRun();
    if (!w || w.found) return;
    if (letterPlaced) {
      const now = performance.now();
      w.lastPlaceAt = now;
      // Dictée : retour quand l'enfant s'arrête (mot de la bonne longueur, ou plus long arrêt).
      w.checksAt = w.mode === "dictation" ? [now + DICT_FEEDBACK_FULL_MS + 50, now + DICT_FEEDBACK_IDLE_MS + 50] : [now + DICT_FEEDBACK_IDLE_MS + 50];
    }
    this.checkWriting("change");
  }

  /** Écriture du mot de l'étape « write » en cours, préparée au besoin (mot tiré, mode, aide enregistrée) ; null sinon. */
  private writingRun(): WritingRun | null {
    const m = this.mission;
    const g = m?.current()?.goal;
    if (!m || g?.kind !== "write" || !this.companionOn()) return null;
    const w = this.writing;
    if (w && w.def === m.def && w.step === m.stepIndex) return w;
    this.writing = this.prepareWriting(m, g.source);
    return this.writing;
  }

  /**
   * Prépare le mot d'une étape d'écriture : tiré au sort hors des mots déjà dans ce monde et dans les autres mondes de
   * l'enfant (ou repris), mode (débutant : copie ; autonome : dictée s'il y a une voix française, sinon copie ;
   * prénom à accents : copie), aide enregistrée, lettres déjà posées.
   */
  private prepareWriting(m: MissionRunner, source: "list" | "name"): WritingRun {
    const level = this.narrator.level;
    const name = this.session?.profile.name ?? null;
    const exclude = presentWords(this.world);
    const s = this.session;
    if (s) for (const word of wordsSeen(this.store.worlds(s.profile.id).filter((_, i) => i !== s.slot))) exclude.add(word);
    const target = m.prepare({ level, name, seed: this.gen.seed, exclude }) ?? "";
    const written = nameWord(name);
    const isName = source === "name" && written !== null && target === written;
    const saved = m.help();
    let mode: WriteMode = "dictation";
    let noVoice = false;
    if (level === "debutant" || saved.copy) mode = "copy";
    else if (isName) mode = name !== null && written !== name.trim().toUpperCase() ? "copy" : "dictation";
    else if (!this.canSpeak()) {
      mode = "copy";
      noVoice = true;
    }
    const w: WritingRun = {
      def: m.def,
      step: m.stepIndex,
      target,
      isName,
      nameFallback: source === "name" && !isName,
      mode,
      firstWord: m.words.length === 0,
      stage: saved.stage,
      revealed: saved.revealed,
      ms: 0,
      show: { model: "none", revealed: 0, nextRing: false, ghostLine: false, ghostNext: false, trayGlow: false },
      have: 0,
      best: null,
      wrongCells: [],
      memory: newFeedbackMemory(),
      lastPlaceAt: performance.now(),
      checksAt: [],
      planned: null,
      announced: false,
      noVoice,
      noVoiceTold: false,
      breakTip: null,
      helpSayAt: null,
      found: null,
    };
    // Reprise : les lettres déjà posées comptent (sans message).
    const st = this.evaluate(w);
    w.best = st.best?.reading ?? null;
    w.have = st.best?.match.have ?? 0;
    const out = wordHelp({ mode, firstWord: w.firstWord, length: target.length, have: w.have, stage: w.stage, revealed: w.revealed, prevMs: 0, ms: 0, newTry: false });
    w.mode = out.mode;
    w.stage = out.stage;
    w.revealed = out.revealed;
    w.show = out.show;
    return w;
  }

  /** Le mot est dicté (lu même voix coupée) : dictée d'un mot de la liste, pas le prénom. */
  private isDictated(w: WritingRun): boolean {
    return w.mode === "dictation" && !w.isName;
  }

  /** Variables des gabarits pour ce mot (spoken : l'astuce dite). */
  private wordVarsFor(w: WritingRun, spoken = false): WordVars {
    return wordVars(this.narrator.level, w.target, this.session?.profile.name ?? null, spoken);
  }

  private evaluate(w: WritingRun): WritingState {
    const p = this.player;
    return evaluateWriting(this.world, { x: p.x, y: p.y, z: p.z }, w.target, { x: p.x, z: p.z }, this.mission?.words ?? []);
  }

  /**
   * Relit le mot autour de l'enfant (après une pose ou une casse, quand il s'arrête, ou par l'accès de test) : mot
   * trouvé (l'étape se valide), sinon un retour au plus (writingFeedback), lettres à revoir, avancement. Un progrès
   * remet l'horloge d'aide à zéro ; en dictée, un essai qui reçoit un retour fait monter l'aide d'un palier.
   */
  private checkWriting(cause: "change" | "idle" | "debug"): WritingFeedback | null {
    const w = this.writingRun();
    const m = this.mission;
    if (!w || !m || w.found) return null;
    const now = performance.now();
    const st = this.evaluate(w);
    // Accès de test : comme si l'enfant s'était arrêté depuis longtemps.
    const since = cause === "debug" ? Infinity : now - w.lastPlaceAt;
    const f = writingFeedback(st, w.mode, w.target, now, since, w.memory, this.plannedLetters(w));
    if (f.found && st.found) {
      m.noteWord(w.target);
      w.found = { facing: f.foundFacing, glued: f.glued };
      w.have = w.target.length;
      w.wrongCells = [];
      w.checksAt = [];
      w.breakTip = null;
      w.helpSayAt = null;
      this.doneSerial++;
      this.doneMarks = st.found.cells.map((c): Cell => [c[0], c[1], c[2]]);
      this.refreshWritingView();
      return f;
    }
    w.best = st.best?.reading ?? null;
    w.wrongCells = f.wrongCells;
    if (f.key) this.sayFeedback(w, f, now);
    if (f.have > w.have) w.ms = 0; // un progrès : l'aide repart de zéro
    w.have = f.have;
    if (f.newTry) {
      m.noteTry();
      this.applyHelp(w, w.ms, true, now + HELP_AFTER_FEEDBACK_MS);
    }
    this.refreshWritingView();
    return f;
  }

  /**
   * Début d'une étape d'écriture (avant sa consigne) : si le mot est déjà lisible autour de l'enfant (le prénom écrit
   * plus tôt), il est validé tout de suite. Rien d'autre n'est dit ici : pas de retour sur un essai avant la consigne.
   * Jamais appelé depuis prepareWriting (checkWriting repasse par writingRun, qui n'a pas encore son écriture).
   */
  private checkWritingAtStart(): void {
    const w = this.writingRun();
    if (w && !w.found && this.evaluate(w).found) this.checkWriting("idle");
  }

  /**
   * Copie, ligne de cases claires tracée devant l'enfant (rien de juste écrit) : la lettre posée dans chacune de ses
   * cases, pour signaler une lettre fausse à sa place (writingFeedback). null si la ligne n'est pas montrée.
   */
  private plannedLetters(w: WritingRun): PlannedLetters | null {
    if (w.mode !== "copy" || !w.planned || !w.announced || !(w.show.ghostLine || w.show.ghostNext)) return null;
    const cells = w.planned.cells;
    return { cells, letters: cells.map(([x, y, z]) => letterChar(this.world.get(x, y, z))) };
  }

  /** Retour sur l'essai (lettre fausse, en trop, mot caché…) ; en dictée, le mot est redit. */
  private sayFeedback(w: WritingRun, f: WritingFeedback, now: number): void {
    const key = f.key;
    if (!key) return;
    const L = f.vars.L;
    const vars: WordVars = {
      ...this.wordVarsFor(w),
      ...(L ? { L, nom: letterName(L) } : {}),
      ...(f.vars.rang !== undefined ? { rang: ordinalWord(f.vars.rang) } : {}),
    };
    const t = fillSaid(FEEDBACK_TEXTS[key], vars);
    this.tell(t.text, { spoken: t.spoken, ms: 4000, important: true, dedupe: true });
    if (key === "WRONG_LETTER") {
      const cell = f.wrongCells[0];
      if (cell) w.breakTip = { at: now + BREAK_TIP_MS, cell, id: this.world.get(cell[0], cell[1], cell[2]) };
    }
    if (this.isDictated(w) && (key === "DICT_WRONG" || key === "DICT_MISSING" || key === "DICT_EXTRA" || key === "DICT_FAR")) {
      this.narrator.dictate(pick(fillWord(LISTEN_AGAIN, vars), "autonome"));
    }
  }

  /**
   * Aide progressive (wordHelp) pour le temps passé sans progrès : palier, lettres dévoilées, passage en copie,
   * retenus par la mission ; ce que Pixel dit (tout de suite, ou à sayAt après un retour de la dictée).
   */
  private applyHelp(w: WritingRun, prevMs: number, newTry: boolean, sayAt: number | null = null): void {
    const out = wordHelp({
      mode: w.mode,
      firstWord: w.firstWord,
      length: w.target.length,
      have: w.have,
      stage: w.stage,
      revealed: w.revealed,
      prevMs,
      ms: w.ms,
      newTry,
    });
    const changed = out.stage !== w.stage || out.revealed !== w.revealed || out.mode !== w.mode;
    w.mode = out.mode;
    w.stage = out.stage;
    w.revealed = out.revealed;
    w.show = out.show;
    if (out.resetClock) w.ms = 0;
    if (changed) {
      this.mission?.noteHelp({ stage: w.stage, revealed: w.revealed, copy: w.mode === "copy" });
      this.refreshWritingView();
    }
    if (!out.say) return;
    if (sayAt !== null) w.helpSayAt = { at: sayAt, say: out.say };
    else this.sayHelp(w, out.say);
  }

  /** Ce que dit l'aide : lettre suivante, cases claires, lettre donnée (copie) ; indices de la dictée. */
  private sayHelp(w: WritingRun, say: HelpSay): void {
    const base = this.wordVarsFor(w);
    const next = w.target.charAt(Math.min(w.have, w.target.length - 1));
    const letter = (ch: string) => ({ L: ch, nom: letterName(ch) });
    switch (say) {
      case "next": {
        const t = fillSaid(NEXT_LETTER, { ...base, ...letter(next) });
        this.tell(t.text, { spoken: t.spoken, ms: 3500, important: true });
        return;
      }
      case "ghosts": {
        const t = fillSaid(GHOST_LINE, base);
        this.tell(t.text, { spoken: t.spoken, ms: 3500, important: true });
        return;
      }
      case "give":
        this.giveLetter(w, next);
        return;
      default: {
        // Indices de la dictée : écrits, et dits par la dictée (même voix coupée) pour un mot dicté.
        const tpl = say === "count" ? DICT_HELP_COUNT : say === "first" ? DICT_HELP_FIRST : say === "more" ? DICT_HELP_MORE : DICT_HELP_ALL;
        const k = say === "more" ? Math.max(1, w.revealed) : 1;
        const extra = { ...letter(w.target.charAt(k - 1)), rang: ordinalWord(k) };
        const t = fillSaid(tpl, { ...base, ...extra }, { ...this.wordVarsFor(w, true), ...extra });
        const text = trimText(t.text);
        const spoken = trimText(t.spoken);
        if (!w.isName && this.narrator.level === "autonome") {
          this.tell(text, { voice: false, ms: 4500 });
          this.narrator.dictate(pick(spoken, "autonome"));
        } else this.tell(text, { spoken, ms: 4500, important: true });
      }
    }
  }

  /** Copie, au bout de 50 s sans progrès : la lettre attendue est mise dans la main (mode Poser au doigt). */
  private giveLetter(w: WritingRun, ch: string): void {
    const id = letterBlockId(ch);
    if (id === null || !this.lettersOn()) return;
    this.handLetter = id;
    this.letterIdleSince = performance.now();
    this.setSlot(LETTER_SLOT);
    this.hud.showSlotName(this.hud.blockName(id));
    if (this.touchUi && this.touch.mode !== "place") this.touch.setMode("place");
    this.updateHint();
    this.syncLetters();
    this.refreshGhosts();
    // « Dans la case claire » seulement si la case de cette lettre est montrée (pas une lettre fausse à sa place).
    const ou = this.ghostNextShown ? PLACE_WHERE.ghost : PLACE_WHERE.ahead;
    const t = fillSaid(GIVE_LETTER, { ...this.wordVarsFor(w), L: ch, nom: letterName(ch), ou });
    this.tell(t.text, { spoken: t.spoken, ms: 4500, important: true });
  }

  /** La dictée n'a pas pu être lue (plus de voix) : le mot passe en copie, et Pixel le dit. */
  private dictationLost(w: WritingRun): void {
    w.mode = "copy";
    w.stage = 0;
    w.noVoice = true;
    w.noVoiceTold = true;
    this.applyHelp(w, w.ms, false);
    this.mission?.noteHelp({ stage: w.stage, revealed: w.revealed, copy: true });
    this.tell(NO_VOICE_COPY, { voice: false, ms: 5000 });
    this.refreshWritingView();
  }

  /**
   * À chaque image d'une étape d'écriture (hors pause, consigne dite) : vérifications prévues après une pose, indice
   * en attente, conseil pour casser une lettre fausse restée là, puis horloge d'aide.
   */
  private updateWriting(now: number, dtMs: number): void {
    const w = this.writingRun();
    if (!w || w.found || !w.announced || this.announceStepAt !== null) return;
    const due = w.checksAt[0];
    if (due !== undefined && now >= due) {
      w.checksAt.shift();
      this.checkWriting("idle");
      if (w.found) return;
    }
    // L'indice gagné par un essai attend aussi que la voix ait fini (le mot redit par la dictée, par exemple).
    if (w.helpSayAt && now >= w.helpSayAt.at && !this.narrator.busy) {
      const say = w.helpSayAt.say;
      w.helpSayAt = null;
      this.sayHelp(w, say);
    }
    const tip = w.breakTip;
    if (tip && now >= tip.at) {
      w.breakTip = null;
      // Au doigt, seulement en mode Poser : en mode Casser, garder le doigt dessus suffit.
      const still = this.world.get(tip.cell[0], tip.cell[1], tip.cell[2]) === tip.id;
      if (still && (!this.touchUi || this.touch.mode === "place")) {
        this.tell(this.touchUi ? BREAK_TIP_TOUCH : BREAK_TIP_MOUSE, { ms: 4000, dedupe: true, important: true });
      }
    }
    const prev = w.ms;
    w.ms += dtMs;
    this.applyHelp(w, prev, false);
  }

  /** Lettre choisie et pas posée depuis 6 s pendant la mission 2 : rappel du geste (au plus toutes les 20 s). */
  private letterHandReminder(now: number): void {
    const since = this.letterIdleSince;
    const m = this.mission;
    if (since === null || this.selectedSlot !== LETTER_SLOT || this.handLetter === null) return;
    if (!m || m.def !== MISSION_2 || m.done || this.announceStepAt !== null || this.narrator.busy) return;
    if (now - since < LETTER_IN_HAND_MS || now - this.lastLetterHandHintAt < LETTER_IN_HAND_EVERY_MS) return;
    this.lastLetterHandHintAt = now;
    this.tell(this.touchUi ? LETTER_IN_HAND_TOUCH : LETTER_IN_HAND_MOUSE, { ms: 3500, dedupe: true });
  }

  /**
   * Mot écrit (étape validée) : « Tu as écrit AMI ! » (dit : épelé, le mot et sa phrase ; le prénom tel qu'il est
   * enregistré). Lu de l'autre côté ou collé à un mot déjà écrit : le conseil suit, après le bravo. Renvoie ce qui est dit.
   */
  private tellWordDone(now: number): string {
    const m = this.mission;
    const w = this.writing;
    const word = w?.target ?? m?.words[m.words.length - 1] ?? "";
    const name = this.session?.profile.name ?? null;
    const level = this.narrator.level;
    const t = fillSaid(name !== null && nameWord(name) === word ? WORD_DONE_NAME : WORD_DONE, wordVars(level, word, name));
    this.tell(t.text, { spoken: t.spoken, ms: 3000, important: true });
    const said = pick(t.spoken, level);
    const found = w?.found ?? null;
    const follow = found ? (!found.facing ? READ_OTHER_SIDE : found.glued ? SPACE_BETWEEN : null) : null;
    this.wordFollowUp = follow
      ? { at: Math.max(now + WORD_FOLLOW_UP_MS, now + (this.narrator.voice ? speechMs(said) + 300 : 0)), text: follow }
      : null;
    return said;
  }

  /** Date de la suite (consigne, écran) : après la phrase dite, et après le conseil qui suit un mot s'il y en a un. */
  private afterSaid(now: number, said: string): number {
    let at = now + Math.max(1600, this.narrator.voice ? speechMs(said) + 300 : 0);
    const f = this.wordFollowUp;
    if (f) {
      const read = Math.max(WORD_FOLLOW_UP_READ_MS, this.narrator.voice ? speechMs(pick(f.text, this.narrator.level)) + 300 : 0);
      at = Math.max(at, f.at + read);
    }
    return at;
  }

  /**
   * Modèle du mot (bandeau de Pixel et boîte) : copie, le mot entier avec les lettres justes et la suivante entourée ;
   * dictée, rien, puis des cases vides, puis les lettres dévoilées. Arcs sous les syllabes.
   */
  private wordModel(w: WritingRun): TrayModel | null {
    if (w.show.model === "none") return null;
    const level = this.narrator.level;
    const entry = findEntry(level, w.target) ?? findEntry(level === "debutant" ? "autonome" : "debutant", w.target);
    const syllables = entry ? entry.syllables.map((x) => x.length) : [];
    const boxes = w.show.model === "boxes";
    const letters: TrayLetter[] = Array.from(w.target, (ch, i): TrayLetter => {
      if (boxes) return i < w.show.revealed ? { ch, state: "todo" } : { ch: null, state: "box" };
      return { ch, state: i < w.have ? "done" : i === w.have && w.show.nextRing ? "next" : "todo" };
    });
    return { letters, syllables };
  }

  private refreshWritingView(): void {
    this.refreshGhosts();
    this.refreshCompanionModel();
  }

  /**
   * Cases claires et contours : rien de juste écrit, une ligne tracée devant l'enfant (gardée tant qu'aucun bloc
   * plein autre qu'une lettre n'occupe ses cases : une lettre posée dedans, juste ou fausse, ne la déplace pas) ;
   * sinon, la suite du mot après les lettres justes. Une case pleine n'a pas de case claire ; une lettre fausse sur la
   * ligne (contour orange) passe avant la case suivante, qui ne clignote pas tant qu'elle est là. Palier 1 : seulement
   * la première case à remplir. Contours orange sur les lettres à revoir (copie), vert sur le mot réussi.
   */
  private refreshGhosts(): void {
    const ghosts = this.view.ghosts;
    const w = this.writing;
    const m = this.mission;
    const active = w !== null && !w.found && w.announced && m !== null && m.def === w.def && m.stepIndex === w.step;
    const list: { x: number; y: number; z: number; id: BlockId }[] = [];
    let next: { x: number; y: number; z: number; id: BlockId } | null = null;
    if (active && (w.show.ghostLine || w.show.ghostNext)) {
      const len = w.target.length;
      let cells: Cell[];
      let offset = 0;
      if (w.have > 0 && w.best) {
        cells = ghostCells(this.world, w.best, w.have, len);
        offset = w.have;
      } else {
        const blocked = (id: number) => isSolidId(id) && !isLetterId(id);
        if (w.planned?.cells.some(([x, y, z]) => blocked(this.world.get(x, y, z)))) w.planned = null;
        if (!w.planned) {
          // Le mot doit tenir dans les 60° du milieu du regard (moins si l'écran est plus étroit) : la ligne se pose
          // alors à 4 ou 5 blocs, visible sans baisser les yeux (avec tout le champ d'un PC, elle serait à 2 blocs).
          const p = this.player;
          const cam = this.view.camera;
          w.planned = planLine(this.world, { x: p.x, y: p.y, z: p.z }, p.yaw, len, Math.min(60, horizontalFov(cam.fov, cam.aspect)));
        }
        cells = w.planned?.cells ?? [];
      }
      // Cases encore à remplir (libres) ou à corriger (lettre fausse) ; une case déjà juste est passée.
      let wrongBefore = false;
      for (let k = 0; k < cells.length; k++) {
        const [x, y, z] = cells[k]!;
        const id = letterBlockId(w.target.charAt(offset + k));
        if (id === null) continue;
        const here = this.world.get(x, y, z);
        if (here === id) continue;
        if (isSolidId(here)) wrongBefore = true;
        else {
          const g = { x, y, z, id };
          list.push(g);
          if (!wrongBefore && !next) next = g;
        }
        if (!w.show.ghostLine) break;
      }
    }
    ghosts.setGhosts(list, next);
    ghosts.setMarks({ wrong: active && w.mode === "copy" ? w.wrongCells : [], done: this.doneMarks, doneId: this.doneSerial });
    this.ghostCount = list.length;
    this.ghostCellsShown = list.map((g): Cell => [g.x, g.y, g.z]);
    this.ghostNextShown = next !== null;
  }

  /** Modèle du bandeau de Pixel, redessiné seulement quand il change (sa hauteur peut déplacer le message central). */
  private refreshCompanionModel(): void {
    const w = this.mission?.current()?.goal.kind === "write" ? this.writingRun() : null;
    const model = w && !w.found ? this.wordModel(w) : null;
    const key = model ? JSON.stringify(model) : "";
    if (key === this.companionModelKey) return;
    this.companionModelKey = key;
    const box = this.companionModel;
    box.replaceChildren();
    box.hidden = model === null;
    this.companionPanel.classList.toggle("with-model", model !== null);
    if (model) {
      box.classList.toggle("long", model.letters.length > 5);
      for (const group of trayModelCells(model)) {
        const syllable = document.createElement("span");
        syllable.className = "model-syllable";
        for (const cell of group) {
          const span = document.createElement("span");
          span.className = `model-letter ${cell.state}`;
          span.setAttribute("role", "img");
          if (cell.letter !== null) {
            span.dataset.letter = cell.letter;
            span.setAttribute("aria-label", `lettre ${cell.letter}`);
            const t = tileIcon(this.view.atlasCanvas, Tile.LetterA + LETTERS.indexOf(cell.letter));
            t.setAttribute("aria-hidden", "true");
            span.appendChild(t);
          } else span.setAttribute("aria-label", "case vide");
          syllable.appendChild(span);
        }
        box.appendChild(syllable);
      }
    }
    this.placeMessageBelowCompanion();
  }

  /**
   * Accès de test : valide l'étape en cours comme si l'objectif était atteint (la mission avance à l'image suivante,
   * après la consigne en cours). Renvoie faux sans mission.
   */
  private skipMissionStep(): boolean {
    const m = this.mission;
    const g = m?.current()?.goal;
    if (!m || !g || !this.companionOn()) return false;
    switch (g.kind) {
      case "collect":
      case "shelter":
        this.stepSkipped = true;
        break;
      case "place":
        for (let i = 0; i < g.count; i++) m.notePlaced(g.block === "any" ? BlockId.Dirt : g.block);
        break;
      case "break":
        for (let i = 0; i < g.count; i++) m.noteBroken(g.block === "any" ? BlockId.Dirt : g.block);
        break;
      case "walk":
        m.noteWalked(g.distance);
        break;
      case "watch":
        m.noteSignal(g.signal);
        break;
      case "letter":
        for (let i = 0; i < g.count; i++) m.notePlaced(BlockId.LetterA);
        break;
      case "write": {
        const w = this.writingRun();
        if (!w) return false;
        m.noteWord(w.target);
        w.found = { facing: true, glued: false };
        this.refreshWritingView();
        break;
      }
    }
    return true;
  }

  private updateHint(): void {
    const h = this.touchUi
      ? this.touch.mode === "place"
        ? HINTS.touchPlace
        : HINTS.touch
      : this.mouse.inFallback()
        ? HINTS.mouseFallback
        : HINTS.mouse;
    let hint = pick(h, this.narrator.level);
    // Au clavier, la touche F une fois le marteau là, et la touche 0 une fois la boîte à lettres là (V2).
    if (!this.touchUi && this.craftAvailable()) hint += ` · ${pick(HINT_EXTRAS.craft, this.narrator.level)}`;
    if (!this.touchUi && this.lettersOn()) hint += ` · ${pick(LETTERS_HINT, this.narrator.level)}`;
    this.hud.setHint(hint);
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
      // Panneau de fabrication ouvert : F et Échap le ferment, rien d'autre ne passe (V2).
      if (this.craftPanel.visible) {
        if (code === "KeyF" || code === "Escape") this.closeCraft();
        return;
      }
      if (this.paused) return;
      // F : fabriquer (par position physique, règle 4), dès que le marteau est là.
      if (code === "KeyF" && this.craftAvailable()) {
        this.openCraft();
        return;
      }
      // 0 : la boîte à lettres (mission 2). Ouverte, elle prend elle-même ses touches (0 et Échap la ferment).
      if ((code === "Digit0" || code === "Numpad0") && this.lettersOn()) {
        this.openLetters();
        return;
      }
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (m) {
        const i = Number(m[1]) - 1;
        this.setSlot(i, true);
        // Touche gardée une seconde : la case est vidée (V2, décision 10 de Pierre ; voir updateSlotHold).
        this.keyHold = startSlotHold(i, performance.now(), "key", 0, 0, code);
      }
      if (code === "KeyV") this.toggleView();
      if (code === "KeyB") this.throwBubbles();
    });
    this.homeButton.addEventListener("click", () => this.goHome());
    this.viewButton.addEventListener("click", () => this.toggleView());
    this.bubbleButton.addEventListener("click", () => this.throwBubbles());
    this.craftButton.addEventListener("click", () => {
      // Sans focus resté sur le marteau : Espace (sauter) ou Entrée le rouvriraient après la fermeture.
      this.craftButton.blur();
      this.openCraft();
    });
    // Case ABC touchée (mission 2) : la boîte s'ouvre si la case est déjà choisie ou sans lettre en main ; sinon,
    // la case est choisie (la lettre tenue revient dans la main).
    this.hud.onSelectSlot((i) => {
      if (i !== LETTER_SLOT) this.setSlot(i, true);
      else if (this.selectedSlot === LETTER_SLOT || this.handLetter === null) this.openLetters();
      else this.setSlot(LETTER_SLOT, true);
    });
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
      // En pause (écran posé sur le jeu, accueil), pas de « Clique pour jouer » : la souris a été libérée exprès.
      if (locked || this.touchUi || this.paused) return;
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
    // Avec la case ABC (mission 2), la molette parcourt dix positions.
    const n = this.lettersOn() ? LETTER_SLOT + 1 : this.inventory.size;
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

  /**
   * Choisit une case de la barre. byUser : geste de l'enfant (son, nom du bloc affiché). Un appui long sur une
   * autre case est annulé (molette, autre touche, case choisie par le jeu) (V2).
   */
  private setSlot(i: number, byUser = false): void {
    // La case ABC (mission 2) n'est choisie que si elle est là.
    if (i < 0 || i >= (this.lettersOn() ? LETTER_SLOT + 1 : this.inventory.size)) return;
    if (this.keyHold && this.keyHold.slot !== i) this.keyHold = null;
    const held = this.hud.slotHold;
    if (held && held.slot !== i) this.hud.cancelSlotHold();
    this.selectedSlot = i;
    this.hud.setSelectedSlot(i);
    if (!byUser) return;
    this.sounds.play("select");
    if (i === LETTER_SLOT) {
      this.hud.showSlotName(this.handLetter !== null ? this.hud.blockName(this.handLetter) : LETTERS_LABEL);
      return;
    }
    const s = this.inventory.slot(i);
    this.hud.showSlotName(s ? this.hud.blockName(s.id) : "case vide");
  }

  /**
   * La main ne tient rien : le prochain bloc ramassé ou fabriqué y passe. La case ABC choisie (mission 2) n'est pas
   * une main vide : une casse ou une fabrication ne retire pas la lettre de la main.
   */
  private handEmpty(): boolean {
    return this.selectedSlot !== LETTER_SLOT && !this.inventory.slot(this.selectedSlot);
  }

  /** Texte du bloc tenu pour la ligne d'infos. */
  private heldLabel(): string {
    if (this.selectedSlot === LETTER_SLOT) return this.handLetter !== null ? this.hud.blockName(this.handLetter) : LETTERS_LABEL;
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

  /**
   * Message à l'enfant qui peut arriver pendant un écran posé sur le jeu (V2 : appui long, fabrication). Panneau
   * de fabrication ouvert : dans sa ligne d'état (tone : couleur), le message central étant caché sous le voile, et
   * la voix par le narrateur (lecture différée comprise) ; sinon, comme tell.
   */
  private notify(text: ChildText, opts: TellOptions & { tone?: CraftStatusTone } = {}): void {
    const { tone, ...tellOpts } = opts;
    if (!this.craftPanel.visible) {
      this.tell(text, tellOpts);
      return;
    }
    this.craftPanel.setStatus(pick(text, this.narrator.level), tone ?? "info");
    if (tellOpts.voice === false) return;
    this.narrator.say(tellOpts.spoken ?? text, { dedupe: tellOpts.dedupe === true, voiceDelayMs: tellOpts.voiceDelayMs });
  }

  /**
   * Appui long sur une case (V2, décisions 2 et 10 de Pierre), à chaque image hors pause : souris ou doigt (suivis
   * par la barre), ou touche 1 à 9 gardée. L'anneau ne se montre que pour une case qu'on peut vider ; à une seconde,
   * la case est vidée, ou le jeu dit pourquoi il la garde (lampe, cadeau, bloc de l'étape).
   */
  private updateSlotHold(now: number): void {
    const kh = this.keyHold;
    if (kh && typeof kh.pointer === "string" && !this.keyboard.isDown(kh.pointer)) this.keyHold = null;
    const h = this.hud.slotHold ?? this.keyHold;
    if (!h) {
      this.hud.setSlotHoldProgress(null);
      return;
    }
    const verdict = discardVerdict(this.inventory.slot(h.slot), this.keptBlocks());
    if (verdict === "empty") {
      this.cancelSlotHold();
      return;
    }
    const p = slotHoldProgress(h, now);
    this.hud.setSlotHoldProgress(verdict === "ok" && p > 0 ? { slot: h.slot, progress: p } : null);
    if (p < 1) return;
    this.cancelSlotHold();
    this.emptySlotByHold(h.slot);
  }

  /**
   * Fin d'un appui long sur la case i (même chemin pour l'accès de test) : la case est vidée (« pouf ») si rien ne
   * la protège ; sinon, refus dit (lampe, cadeau, bloc de l'étape). Pas de sauvegarde dédiée : l'automatique suffit.
   */
  private emptySlotByHold(i: number): DiscardVerdict {
    const st = this.inventory.slot(i);
    const verdict = discardVerdict(st, this.keptBlocks());
    if (!st || verdict === "empty") return verdict;
    if (verdict === "ok") {
      this.inventory.discard(i);
      this.sounds.play("discard");
      this.refreshInventory();
      const t = discardedText(st.id, st.count);
      this.notify(t.text, { spoken: t.spoken, ms: 2200 });
    } else {
      this.sounds.play("deny");
      this.notify(keepSlotText(st.id, st.count, verdict), { ms: 2500, dedupe: true });
    }
    return verdict;
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
    // Une lettre ne rapporte rien : elle retourne dans la boîte (mission 2).
    const drops = dropsOf(id);
    if (drops.main !== null) this.collect(drops.main);
    if (drops.extra !== null) this.collect(drops.extra, false);
    if (isPlantId(above) && w.set(x, y + 1, z, BlockId.Air)) this.collect(above, false);
    this.afterBlockChange(false);
  }

  /**
   * Met un bloc dans le sac. announce : affiche et lit le nouveau compte (ou
   * le refus : sac plein, maximum). Sans annonce, seuls le son et
   * l'animation de la case signalent le ramassage.
   */
  private collect(id: BlockId, announce = true): AddResult {
    const r = this.inventory.add(id);
    if (!r.ok) {
      if (!announce) return r;
      // Sac plein (V2) : le geste pour vider une case, selon l'appareil ; pas relu à chaque bloc cassé.
      if (r.reason === "full") {
        this.tell(this.touchUi ? FULL_BAG_TOUCH : FULL_BAG, {
          spoken: this.touchUi ? SPOKEN_TIPS.fullBagTouch : SPOKEN_TIPS.fullBagKeys,
          ms: 2500,
          dedupe: true,
        });
      } else this.tell(maxStackText(id, MAX_STACK), { ms: 2500 });
      return r;
    }
    const first = !this.collectedTypes.has(id);
    this.collectedTypes.add(id);
    this.sounds.play("pickup", id);
    this.hud.pulseSlot(r.slot);
    // Main vide : le bloc annoncé passe dans la main (premier ramassage, case épuisée…).
    if (announce && this.handEmpty()) this.setSlot(r.slot);
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
    // Case ABC choisie (mission 2) : la lettre tenue, sans rien prendre dans le sac.
    if (this.selectedSlot === LETTER_SLOT) {
      this.placeLetter();
      return;
    }
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
      // Une fleur se pose sur un bloc plein (le verre compris, V2), dans l'air (pas dans l'eau).
      const cell = w.get(x, y, z);
      if (cell === BlockId.Water) {
        this.deny(FLOWER_IN_WATER);
        return;
      }
      if (!isSolidId(w.get(x, y - 1, z)) || !(cell === BlockId.Air || isPlantId(cell))) {
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
    else if (id === BlockId.Glass && !this.glassHintDone) {
      // Premier verre posé (V2) : une fois par chargement de la page ; si la pose vide la case, à la vitre suivante.
      this.glassHintDone = true;
      this.tell(GLASS_SEE_THROUGH, { ms: 3500 });
    }
    // Un bloc posé devant un mot peut le cacher (mission 2) : le mot est relu.
    this.afterBlockChange(false);
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
          yaw: this.player.yaw,
          pitch: this.player.pitch,
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
        /** Le temps file (×30) : dernière étape de la mission 1, ou attente du matin avant la mission suivante (V2). */
        timeBoost: this.watchBoost() || this.morningBoost(),
        /** Appui long en cours sur une case (souris, doigt ou touche) et son avancement (V2). */
        slotHold: (() => {
          const h = this.hud.slotHold ?? this.keyHold;
          return h ? { slot: h.slot, progress: slotHoldProgress(h, performance.now()), source: h.source } : null;
        })(),
        eveningHeld: this.eveningHeld(),
        lampRevealed: this.lampIsRevealed(),
        pendingMission: this.pendingMission?.def.id ?? null,
        /** Fabrication (V2) : marteau disponible, panneau ouvert, halo, ligne d'état, cartes, présentation faite. */
        craft: {
          available: this.craftAvailable(),
          open: this.craftPanel.visible,
          glow: this.craftButton.classList.contains("new"),
          status: this.craftPanel.visible ? (this.craftPanel.root.querySelector(".craft-status")?.textContent ?? "") : "",
          cards: this.craftPanel.visible ? this.craftCards.map((c) => ({ id: c.id, state: c.state })) : [],
          intro: this.craftIntroTold,
        },
        /** Mission 2 (V2) : case ABC là, boîte ouverte, lettre tenue, case ABC choisie. */
        letters: {
          unlocked: this.lettersOn(),
          open: this.letterTray.visible,
          hand: this.handLetter !== null ? letterChar(this.handLetter) : null,
          selected: this.selectedSlot === LETTER_SLOT,
        },
        /** Mission 2 : mot de l'étape d'écriture en cours, mode, aide, avancement, cases claires et lettres à revoir. */
        writing: (() => {
          const w = this.writingRun();
          if (!w) return null;
          return {
            target: w.target,
            mode: w.mode,
            stage: w.stage,
            revealed: w.revealed,
            have: w.have,
            words: [...(this.mission?.words ?? [])],
            ghosts: this.ghostCount,
            ghostCells: this.ghostCellsShown.map((c) => [c[0], c[1], c[2]]),
            wrongCells: w.mode === "copy" ? w.wrongCells.length : 0,
            help: { ...w.show },
            announced: w.announced,
            found: w.found !== null,
          };
        })(),
        /** Mots écrits dans la mission en cours (mission 2). */
        words: [...(this.mission?.words ?? [])],
        tutorialDone: this.session?.profile.tutorialDone ?? null,
        craftSeen: this.session ? this.session.profile.craftSeen === true : null,
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
      /** Vide la case i comme au bout d'un appui long (mêmes règles : lampe, cadeau, bloc de l'étape gardés) ; renvoie le verdict (V2). */
      emptySlot: (i: number) => this.emptySlotByHold(i),
      /** Ouvre le panneau de fabrication comme le marteau (mêmes refus) ; vrai s'il s'est ouvert (V2). */
      openCraft: () => this.openCraft(),
      /** Ferme le panneau de fabrication comme la croix (V2). */
      closeCraft: () => this.closeCraft(),
      /** Fabrique une fois (« planches », « cloture », « verre ») avec les règles du jeu, réserve comprise, sans les délais du doigt (V2). */
      craft: (id: string) => this.doCraft(id as RecipeId, true),
      /** Ouvre la boîte à lettres comme la case ABC (mêmes refus) ; vrai si elle s'est ouverte (mission 2). */
      openLetters: () => this.openLetters(),
      /** Choisit une lettre comme dans la boîte (ouverte ou non) ; vrai si elle est en main (mission 2). */
      chooseLetter: (ch: string) => this.debugChooseLetter(ch),
      /** Voix française supposée présente (true) ou absente (false) pour la dictée ; null : celle du navigateur. */
      assumeVoice: (v: boolean | null) => {
        this.voiceOverride = v;
      },
      /** Relit le mot de l'étape (après setBlock), comme si l'enfant s'était arrêté ; renvoie la réaction, ou null. */
      checkWriting: () => {
        const f = this.checkWriting("debug");
        return f ? { found: f.found, key: f.key, have: f.have, wrongCells: f.wrongCells.length, newTry: f.newTry } : null;
      },
      /** Avance l'horloge d'aide de l'étape d'écriture (ms) ; faux hors d'une étape d'écriture. */
      advanceWritingClock: (ms: number) => {
        const w = this.writingRun();
        if (!w || w.found || !Number.isFinite(ms)) return false;
        const prev = w.ms;
        w.ms += Math.max(0, ms);
        this.applyHelp(w, prev, false);
        return true;
      },
      /** Valide l'étape en cours comme si son objectif était atteint (la mission avance après la consigne en cours). */
      skipMissionStep: () => this.skipMissionStep(),
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

    // Jour et nuit, eau. Soir retenu à 17 h pendant les étapes qui le demandent (V2) ; Soir et Nuit du panneau passent outre.
    if (!this.paused) {
      const next = advancePhase(this.phase, dt * 1000, this.timeMultiplier(), this.settings.night);
      this.phase = this.eveningHeld() ? holdEvening(this.phase, next) : next;
    }
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
    // Appui long sur une case (V2) : en jeu, et panneau de fabrication ouvert (vider une case pour fabriquer) ;
    // toute autre pause l'annule.
    if (!this.paused || this.craftPanel.visible) this.updateSlotHold(performance.now());
    else if (this.keyHold || this.hud.slotHold) this.cancelSlotHold();
    this.refreshInventory();
    this.syncCraftButtons();
    this.syncLetters();
    if (this.session && performance.now() - this.lastAutosaveAt > AUTOSAVE_MS) this.saveNow();
    this.updateLiving(performance.now(), dt);
    // Cases claires de la mission 2 : la case suivante « respire », le contour vert d'un mot réussi s'efface.
    this.view.ghosts.update(dt, this.reducedMotion.matches);

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

/** Gabarit rempli sans espace en trop (une astuce absente laisse une espace finale). */
function trimText(t: ChildText): ChildText {
  return { debutant: t.debutant.trim(), autonome: t.autonome.trim() };
}
