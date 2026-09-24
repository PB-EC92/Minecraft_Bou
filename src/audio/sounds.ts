/**
 * Sons du jeu, entièrement synthétisés par Web Audio : aucun fichier, rien à
 * télécharger (le jeu doit marcher hors ligne, ouvert par double-clic).
 *
 * Deux parties :
 * - des RECETTES pures (`recipe`) : chaque son est décrit par quelques couches
 *   (tonalité ou bruit filtré) avec leurs durées, fréquences et volumes. Elles
 *   se testent en Node, sans navigateur ;
 * - un LECTEUR (`Sounds`) qui joue ces recettes avec Web Audio.
 *
 * Public de 6-8 ans : sons doux, courts (≤ 0,4 s), jamais agressifs (pas de
 * signal carré, niveaux modestes et équilibrés entre eux, compresseur en
 * sortie).
 *
 * Points d'attention navigateur :
 * - le contexte audio n'est créé qu'au premier geste de l'enfant (`unlock`,
 *   appelé par `attachUnlock`) : les navigateurs refusent le son avant ;
 * - sur écran tactile, poser le doigt (pointerdown/touchstart) ne compte pas
 *   encore comme un geste pour le navigateur : seul le fait de le relever
 *   (pointerup/touchend) compte. On écoute donc aussi ces deux événements ;
 * - Safari (iPad) peut suspendre ou « interrompre » le contexte : chaque geste
 *   le reprend, et le retour sur l'onglet aussi ;
 * - enveloppes sans clic : montée linéaire depuis 0,0001, descente
 *   exponentielle vers 0,0001 (jamais 0, interdit pour l'exponentielle) ;
 * - chaque couche se débranche à la fin (`onended`) ; au plus `MAX_VOICES`
 *   sons en même temps, les suivants sont ignorés ;
 * - aucune méthode publique ne lève d'exception : un souci audio ne doit
 *   jamais casser le jeu.
 */
import { BlockId } from "../engine/blocks";

/** Noms des sons joués par le jeu. */
export type SoundName = "breakTick" | "break" | "place" | "pickup" | "deny" | "select" | "giggle" | "bubbles" | "night" | "bravo";

/** Famille de matière d'un bloc : change la couleur des sons de casse. */
export type Material = "soft" | "stone" | "wood" | "plant" | "sand";

/** Tous les noms de sons (panneau de tests, boucles de vérification). */
export const SOUND_NAMES: readonly SoundName[] = ["breakTick", "break", "place", "pickup", "deny", "select", "giggle", "bubbles", "night", "bravo"];

/** Toutes les matières. */
export const MATERIALS: readonly Material[] = ["soft", "stone", "wood", "plant", "sand"];

/** Nombre maximal de sons joués en même temps ; au-delà, les nouveaux sont ignorés. */
export const MAX_VOICES = 8;

/**
 * Événements qui débloquent le son (écoutés en capture, passifs).
 * pointerup et touchend s'ajoutent aux trois premiers : sur écran tactile, seul
 * le doigt relevé compte comme geste pour le navigateur.
 */
export const UNLOCK_EVENTS: readonly string[] = ["pointerdown", "keydown", "touchstart", "pointerup", "touchend"];

/**
 * Matière d'un bloc : herbe et terre → soft ; pierre, pierre brillante et arc-en-ciel → stone ; planches,
 * tronc, cactus → wood ; pierre brillante, arc-en-ciel → stone ; feuilles et fleurs → plant ; sable et neige → sand ;
 * tout autre identifiant (air, eau, inconnu) → soft.
 */
export function materialOf(id: BlockId): Material {
  switch (id) {
    case BlockId.Grass:
    case BlockId.Dirt:
      return "soft";
    case BlockId.Stone:
    case BlockId.GlowStone:
    case BlockId.Rainbow:
      return "stone";
    case BlockId.Planks:
    case BlockId.Log:
    case BlockId.Cactus:
    case BlockId.Lamp:
    case BlockId.Fence:
      return "wood";
    case BlockId.Leaves:
    case BlockId.FlowerRed:
    case BlockId.FlowerYellow:
      return "plant";
    case BlockId.Sand:
    case BlockId.Snow:
      return "sand";
    default:
      return "soft";
  }
}

/** Recette pure d'un son : décrit les couches à jouer (testable sans navigateur). */
export interface Layer {
  kind: "tone" | "noise";
  /** Pour tone : "sine" | "triangle" | "square" (square très atténué seulement). */
  wave?: OscillatorType;
  /** Hz début (tone) ou fréquence centrale du filtre passe-bande (noise). */
  freq: number;
  /** Glissement de fréquence (Hz fin). */
  freqEnd?: number;
  /** Facteur Q du filtre (noise). */
  q?: number;
  /** Secondes après le déclenchement. */
  delay: number;
  /** Secondes. */
  attack: number;
  /** Secondes (durée totale de la couche, attaque comprise). */
  duration: number;
  /** 0..1 (avant le volume général). */
  gain: number;
}

/** Couleur sonore d'une matière pour les sons de casse. */
interface Timbre {
  /** Fréquence centrale du bruit filtré (Hz). */
  noise: number;
  /** Facteur Q du filtre passe-bande. */
  q: number;
  /**
   * Gain du bruit pour le tic. Un bruit blanc filtré ne garde qu'une petite
   * part de son énergie, d'autant plus petite que la bande est étroite ou
   * grave : ce gain compense, pour que les cinq matières sonnent à peu près
   * aussi fort (mesuré en niveau pondéré A, voir le commentaire de recipe).
   */
  level: number;
  /** Tonalité grave de la casse (Hz, glisse vers 60 % de sa valeur). */
  tone: number;
  /** Durée du bruit de casse (s). */
  breakLen: number;
  /** Gain de la tonalité de casse. */
  toneGain: number;
}

const TIMBRES: Record<Material, Timbre> = {
  // Herbe, terre : bruit sourd, étouffé.
  soft: { noise: 600, q: 0.8, level: 0.72, tone: 110, breakLen: 0.22, toneGain: 0.28 },
  // Pierre : plus clair et net.
  stone: { noise: 1500, q: 1.2, level: 0.42, tone: 150, breakLen: 0.2, toneGain: 0.26 },
  // Bois : bande étroite, « toc » qui résonne.
  wood: { noise: 900, q: 1.8, level: 0.76, tone: 200, breakLen: 0.18, toneGain: 0.3 },
  // Feuilles, fleurs : froissement léger (un peu moins fort), presque sans tonalité.
  plant: { noise: 2400, q: 0.7, level: 0.26, tone: 300, breakLen: 0.16, toneGain: 0.12 },
  // Sable, neige : chuintement.
  sand: { noise: 3000, q: 0.6, level: 0.25, tone: 90, breakLen: 0.28, toneGain: 0.12 },
};

/**
 * Recette d'un son. La matière (défaut "soft") colore breakTick, break et le
 * clic de place ; pickup, deny et select ne dépendent pas de la matière.
 * Renvoie un tableau neuf à chaque appel ; nom inconnu → tableau vide ;
 * matière inconnue → soft.
 *
 * Équilibre des volumes, réglé par mesure (rendu Web Audio réel, niveau
 * pondéré A sur 50 ms) et non à l'oreille : ramassage un peu au-dessus de la
 * casse et de la pose ; refus plus bas (doux, jamais effrayant) ; tic de casse
 * nettement plus bas (il se répète) ; sélection plus bas encore. Les gains des
 * couches de bruit sont plus hauts que ceux des tonalités pour un même niveau
 * perçu (voir Timbre.level) ; ils restent ≤ 1.
 * Mesures au volume par défaut (dB A, 50 ms, pleine échelle = 0) : ramassage
 * −31 ; casse −34 à −37 ; refus −33 ; pose −37 à −39 ; tic −42 à −44 ;
 * sélection −44. Crête d'un son seul ≤ −16 dBFS ; 8 casses ensemble −6 dBFS.
 */
export function recipe(name: SoundName, material: Material = "soft"): Layer[] {
  const t = Object.prototype.hasOwnProperty.call(TIMBRES, material) ? TIMBRES[material] : TIMBRES.soft;
  switch (name) {
    case "breakTick":
      // Petit tic de bruit filtré selon la matière.
      return [{ kind: "noise", freq: t.noise, q: t.q, delay: 0, attack: 0.004, duration: 0.07, gain: t.level }];
    case "break":
      // Bruit filtré plus long qui descend + tonalité grave selon la matière.
      return [
        { kind: "noise", freq: t.noise, freqEnd: t.noise * 0.6, q: t.q, delay: 0, attack: 0.005, duration: t.breakLen, gain: Math.min(1, t.level * 1.3) },
        { kind: "tone", wave: "triangle", freq: t.tone, freqEnd: t.tone * 0.6, delay: 0, attack: 0.005, duration: 0.18, gain: t.toneGain },
      ];
    case "place": {
      // « Toc » (triangle 180 → 90 Hz) + petit clic. Le toc est grave : sur un
      // petit haut-parleur (tablette), c'est surtout le clic qu'on entend. Clic
      // dans une bande claire, colorée par la matière ; gain en 1/√f pour que
      // les clics sonnent aussi fort les uns que les autres.
      const click = clamp(t.noise * 1.5, 1800, 4000);
      return [
        { kind: "tone", wave: "triangle", freq: 180, freqEnd: 90, delay: 0, attack: 0.004, duration: 0.12, gain: 0.4 },
        { kind: "noise", freq: click, q: 1.2, delay: 0, attack: 0.002, duration: 0.035, gain: Math.min(1, 0.95 * Math.sqrt(1800 / click)) },
      ];
    }
    case "pickup":
      // Deux « pop » montants.
      return [
        { kind: "tone", wave: "sine", freq: 660, freqEnd: 740, delay: 0, attack: 0.006, duration: 0.09, gain: 0.11 },
        { kind: "tone", wave: "sine", freq: 990, freqEnd: 1100, delay: 0.08, attack: 0.006, duration: 0.12, gain: 0.1 },
      ];
    case "deny":
      // Deux notes douces descendantes (330 puis 247 Hz) : « non », sans rien d'effrayant.
      return [
        { kind: "tone", wave: "sine", freq: 330, delay: 0, attack: 0.015, duration: 0.16, gain: 0.13 },
        { kind: "tone", wave: "sine", freq: 247, delay: 0.14, attack: 0.015, duration: 0.22, gain: 0.13 },
      ];
    case "select":
      // Clic très bref.
      return [{ kind: "tone", wave: "triangle", freq: 1200, freqEnd: 900, delay: 0, attack: 0.002, duration: 0.03, gain: 0.17 }];
    case "giggle":
      // J5 — rire de Grignote : trois petites notes aiguës qui sautillent (vol d'un bloc, fuite).
      return [
        { kind: "tone", wave: "sine", freq: 880, freqEnd: 1040, delay: 0, attack: 0.005, duration: 0.07, gain: 0.08 },
        { kind: "tone", wave: "sine", freq: 990, freqEnd: 1170, delay: 0.09, attack: 0.005, duration: 0.07, gain: 0.08 },
        { kind: "tone", wave: "sine", freq: 1110, freqEnd: 1320, delay: 0.18, attack: 0.005, duration: 0.09, gain: 0.08 },
      ];
    case "bubbles":
      // J5 — lance-bulles : petits « bloup » montants.
      return [
        { kind: "tone", wave: "sine", freq: 300, freqEnd: 700, delay: 0, attack: 0.01, duration: 0.1, gain: 0.12 },
        { kind: "tone", wave: "sine", freq: 380, freqEnd: 820, delay: 0.1, attack: 0.01, duration: 0.1, gain: 0.1 },
        { kind: "tone", wave: "sine", freq: 460, freqEnd: 940, delay: 0.2, attack: 0.01, duration: 0.12, gain: 0.08 },
      ];
    case "night":
      // J5 — la nuit arrive : trois notes douces descendantes, comme un carillon.
      return [
        { kind: "tone", wave: "sine", freq: 784, delay: 0, attack: 0.01, duration: 0.14, gain: 0.1 },
        { kind: "tone", wave: "sine", freq: 659, delay: 0.12, attack: 0.01, duration: 0.14, gain: 0.1 },
        { kind: "tone", wave: "sine", freq: 523, delay: 0.24, attack: 0.01, duration: 0.16, gain: 0.1 },
      ];
    case "bravo":
      // J6 — étape réussie, félicitations : quatre notes montantes (do, mi, sol, do aigu), la dernière tenue.
      return [
        { kind: "tone", wave: "triangle", freq: 523, delay: 0, attack: 0.006, duration: 0.09, gain: 0.14 },
        { kind: "tone", wave: "triangle", freq: 659, delay: 0.08, attack: 0.006, duration: 0.09, gain: 0.14 },
        { kind: "tone", wave: "triangle", freq: 784, delay: 0.16, attack: 0.006, duration: 0.09, gain: 0.13 },
        { kind: "tone", wave: "sine", freq: 1047, delay: 0.24, attack: 0.008, duration: 0.16, gain: 0.12 },
      ];
    default:
      return [];
  }
}

/** Durée totale d'une recette (s) : fin de la couche qui se termine le plus tard. */
export function recipeDuration(layers: readonly Layer[]): number {
  let end = 0;
  for (const l of layers) end = Math.max(end, l.delay + l.duration);
  return end;
}

/** État du son, affichable tel quel (panneau parent / tests). */
export type SoundState = "absent" | "en attente d'un geste" | "actif" | "suspendu" | "coupé";

/** Constructeur de contexte audio (standard ou préfixé webkit). */
export type AudioContextClass = new () => AudioContext;

/** Environnement du lecteur (injection pour les tests ; par défaut, celui du navigateur). */
export interface SoundsEnv {
  /** Constructeur du contexte audio ; null = pas d'audio. Défaut : window.AudioContext ou window.webkitAudioContext. */
  audioContext?: AudioContextClass | null;
}

/** Valeur plancher des enveloppes (jamais 0 pour une rampe exponentielle). */
const SILENCE = 0.0001;
/** Longueur du tampon de bruit blanc partagé (s) : plus long que la plus longue couche. */
const NOISE_SECONDS = 0.5;
/** Attaque minimale pour éviter un clic (s). */
const MIN_ATTACK = 0.002;
/** Durée minimale d'une couche (s). */
const MIN_DURATION = 0.01;
/** Marge avant le premier échantillon d'un son (s) : évite d'en rogner le début. */
const START_LATENCY = 0.005;
/** Marge après la fin de l'enveloppe avant d'arrêter la source (s). */
const STOP_TAIL = 0.03;
/** Bornes de fréquence appliquées au jeu (Hz). */
const MIN_FREQ = 20;
const MAX_FREQ = 12000;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Ignore le rejet éventuel d'une promesse (resume/close) ; tolère les anciens navigateurs sans promesse. */
function quiet(p: unknown): void {
  if (p && typeof (p as Promise<unknown>).catch === "function") (p as Promise<unknown>).catch(() => undefined);
}

/** Débranche des nœuds sans jamais lever (un nœud déjà débranché est sans importance). */
function disconnectAll(nodes: readonly AudioNode[]): void {
  for (const n of nodes) {
    try {
      n.disconnect();
    } catch {
      // Déjà débranché.
    }
  }
}

function findAudioContext(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  if (typeof w.AudioContext === "function") return w.AudioContext as AudioContextClass;
  if (typeof w.webkitAudioContext === "function") return w.webkitAudioContext as AudioContextClass;
  return null;
}

/** Fixe une fréquence au début de la couche, puis la fait glisser (exponentielle) jusqu'à la fin. */
function glide(param: AudioParam, from: number, to: number | undefined, t0: number, dur: number): void {
  const f0 = clamp(Number.isFinite(from) ? from : 440, MIN_FREQ, MAX_FREQ);
  param.setValueAtTime(f0, t0);
  if (to !== undefined && Number.isFinite(to) && to > 0 && to !== from) {
    param.exponentialRampToValueAtTime(clamp(to, MIN_FREQ, MAX_FREQ), t0 + dur);
  }
}

/**
 * Lecteur de sons. Chaîne : couches → gain général (volume) → compresseur →
 * sortie. Le contexte audio est créé paresseusement, au premier geste.
 */
export class Sounds {
  private readonly contextClass: AudioContextClass | null;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** La création du contexte a échoué : on n'insiste pas (état « absent »). */
  private failed = false;
  private attached = false;
  /** Instants de fin (temps du contexte) des sons en cours, pour la limite MAX_VOICES. */
  private voiceEnds: number[] = [];
  private isEnabled = true;
  private level = 0.6;

  constructor(env: SoundsEnv = {}) {
    this.contextClass = env.audioContext !== undefined ? env.audioContext : findAudioContext();
  }

  /** Son activé (défaut vrai) ; faux → état « coupé », play ne fait rien. */
  get enabled(): boolean {
    return this.isEnabled;
  }

  set enabled(v: boolean) {
    this.isEnabled = !!v;
    this.applyMaster();
  }

  /** Volume général 0..1 (défaut 0,6) ; borné, valeur non finie ignorée. */
  get volume(): number {
    return this.level;
  }

  set volume(v: number) {
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    this.level = clamp(v, 0, 1);
    this.applyMaster();
  }

  /** Le navigateur fournit AudioContext (ou webkitAudioContext). */
  get available(): boolean {
    return this.contextClass !== null;
  }

  /**
   * État courant. Priorité : absent (pas d'audio, ou création refusée) > coupé
   * (enabled faux) > en attente d'un geste (pas encore de contexte) > actif
   * (contexte en marche) > suspendu.
   */
  get state(): SoundState {
    if (!this.contextClass || this.failed) return "absent";
    if (!this.isEnabled) return "coupé";
    const ctx = this.ctx;
    if (!ctx) return "en attente d'un geste";
    const s: string = ctx.state;
    if (s === "running") return "actif";
    if (s === "closed") return "en attente d'un geste";
    return "suspendu";
  }

  /**
   * Écoute pointerdown, keydown, touchstart (et pointerup, touchend, voir
   * UNLOCK_EVENTS) en capture, passifs, sur target et appelle unlock() ; écoute
   * aussi le retour sur l'onglet pour reprendre le contexte. À appeler une fois
   * (les appels suivants sont ignorés).
   */
  attachUnlock(target: Window): void {
    if (this.attached) return;
    this.attached = true;
    const onGesture = (): void => this.unlock();
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    try {
      for (const type of UNLOCK_EVENTS) target.addEventListener(type, onGesture, opts);
      const doc = target.document;
      doc?.addEventListener("visibilitychange", () => {
        try {
          if (doc.visibilityState === "visible") this.resumeIfUnlocked();
        } catch {
          // Un écouteur ne doit jamais lever.
        }
      });
    } catch {
      // Cible sans événements : le son restera en attente, sans casser le jeu.
    }
  }

  /** Crée le contexte audio au premier appel (depuis un geste), le reprend s'il est suspendu. Ne lève jamais. */
  unlock(): void {
    if (!this.contextClass || this.failed) return;
    try {
      if (this.ctx && (this.ctx.state as string) === "closed") this.dropContext();
      const ctx = this.ctx ?? this.createContext();
      if (!ctx) return;
      if ((ctx.state as string) !== "running") {
        this.primeSilence(ctx);
        this.resume(ctx);
      }
    } catch {
      // Jamais d'exception vers le jeu.
    }
  }

  /** Joue un son ; ne lève jamais ; ne fait rien sans contexte actif ni si enabled est faux. */
  play(name: SoundName, id?: BlockId): void {
    if (!this.isEnabled) return;
    try {
      const ctx = this.ctx;
      const master = this.master;
      if (!ctx || !master || (ctx.state as string) !== "running") return;
      const layers = recipe(name, id === undefined ? undefined : materialOf(id));
      if (layers.length === 0) return;
      const now = ctx.currentTime;
      this.voiceEnds = this.voiceEnds.filter((end) => end > now);
      if (this.voiceEnds.length >= MAX_VOICES) return;
      const start = now + START_LATENCY;
      this.voiceEnds.push(start + recipeDuration(layers) + STOP_TAIL);
      for (const layer of layers) this.scheduleLayer(ctx, master, layer, start);
    } catch {
      // Un nœud refusé par le navigateur : on renonce à ce son, le jeu continue.
    }
  }

  private createContext(): AudioContext | null {
    const Ctx = this.contextClass;
    if (!Ctx) return null;
    let ctx: AudioContext;
    try {
      ctx = new Ctx();
    } catch {
      this.failed = true;
      return null;
    }
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      comp.connect(ctx.destination);
      const master = ctx.createGain();
      master.gain.value = this.isEnabled ? this.level : 0;
      master.connect(comp);
      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = null;
      this.voiceEnds = [];
      return ctx;
    } catch {
      this.failed = true;
      try {
        quiet(ctx.close());
      } catch {
        // Rien de plus à faire.
      }
      return null;
    }
  }

  private dropContext(): void {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.voiceEnds = [];
  }

  private resume(ctx: AudioContext): void {
    try {
      quiet(ctx.resume());
    } catch {
      // Ancien navigateur ou refus : on réessaiera au prochain geste.
    }
  }

  /** Reprend le contexte au retour sur l'onglet, seulement s'il a déjà été débloqué. */
  private resumeIfUnlocked(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s: string = ctx.state;
    if (s === "suspended" || s === "interrupted") this.resume(ctx);
  }

  /** Joue un échantillon muet pendant le geste : nécessaire pour débloquer d'anciens Safari (iPad). */
  private primeSilence(ctx: AudioContext): void {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.onended = () => disconnectAll([src]);
      src.start(0);
    } catch {
      // Sans importance : resume suffit dans les navigateurs récents.
    }
  }

  /** Tampon de bruit blanc, généré une seule fois par contexte. */
  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /**
   * Programme une couche. L'enveloppe n'est branchée sur la sortie qu'en
   * dernier : si le navigateur refuse une étape, ce qui a été créé est démonté
   * et rien ne reste branché (l'erreur remonte à play, qui renonce au son).
   */
  private scheduleLayer(ctx: AudioContext, out: AudioNode, layer: Layer, start: number): void {
    const t0 = start + (Number.isFinite(layer.delay) ? Math.max(0, layer.delay) : 0);
    const dur = Number.isFinite(layer.duration) ? Math.max(MIN_DURATION, layer.duration) : MIN_DURATION;
    const attack = Math.min(Number.isFinite(layer.attack) ? Math.max(MIN_ATTACK, layer.attack) : MIN_ATTACK, dur * 0.5);
    const peak = Number.isFinite(layer.gain) ? clamp(layer.gain, SILENCE, 1) : SILENCE;

    const nodes: AudioNode[] = [];
    let source: AudioScheduledSourceNode | null = null;
    try {
      // Enveloppe sans clic : 0,0001 → pic (linéaire) → 0,0001 (exponentielle).
      const env = ctx.createGain();
      nodes.push(env);
      env.gain.setValueAtTime(SILENCE, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + attack);
      env.gain.exponentialRampToValueAtTime(SILENCE, t0 + dur);

      if (layer.kind === "noise") {
        const src = ctx.createBufferSource();
        nodes.push(src);
        src.buffer = this.noise(ctx);
        const filter = ctx.createBiquadFilter();
        nodes.push(filter);
        filter.type = "bandpass";
        filter.Q.value = layer.q !== undefined && Number.isFinite(layer.q) && layer.q > 0 ? layer.q : 1;
        glide(filter.frequency, layer.freq, layer.freqEnd, t0, dur);
        src.connect(filter);
        filter.connect(env);
        source = src;
        // Départ à un endroit au hasard du tampon : deux tics de suite ne sonnent pas pareil.
        const maxOffset = Math.max(0, NOISE_SECONDS - dur - STOP_TAIL - 0.01);
        src.start(t0, Math.random() * maxOffset);
      } else {
        const osc = ctx.createOscillator();
        nodes.push(osc);
        osc.type = !layer.wave || layer.wave === "custom" ? "sine" : layer.wave;
        glide(osc.frequency, layer.freq, layer.freqEnd, t0, dur);
        osc.connect(env);
        source = osc;
        osc.start(t0);
      }
      source.onended = () => disconnectAll(nodes);
      source.stop(t0 + dur + STOP_TAIL);
      env.connect(out);
    } catch (err) {
      if (source) {
        try {
          source.stop();
        } catch {
          // Source jamais démarrée.
        }
      }
      disconnectAll(nodes);
      throw err;
    }
  }

  /** Applique volume et activation au gain général, en douceur (pas de clic). */
  private applyMaster(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const v = this.isEnabled ? this.level : 0;
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(v, ctx.currentTime, 0.015);
    } catch {
      try {
        master.gain.value = v;
      } catch {
        // Rien de plus à faire.
      }
    }
  }
}
