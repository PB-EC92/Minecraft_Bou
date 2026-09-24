import { pick, type ChildText, type ReadingLevel } from "./texts";

/**
 * Narrateur (J2) : affiche les messages adressés à l'enfant dans la variante
 * de son niveau de lecture, et les lit à voix haute si la voix est active.
 *
 * Lecteur débutant (6 ans) : texte court affiché ET lu (il s'entraîne à
 * lire en entendant). Lecteur autonome (8 ans) : texte plus complet, voix
 * coupée par défaut.
 *
 * Garde-fous pour que la voix n'use pas la patience :
 * - une lecture différée (ramassage) est remplacée par la suivante : en
 *   cassant vite, on n'entend que le dernier compte (« cinq pierres ! ») ;
 * - tant que l'enfant garde l'appui pour casser, le jeu repousse la lecture
 *   en attente (snooze) : le compte est dit une fois l'appui relâché, au
 *   lieu d'être coupé par la casse suivante ;
 * - un refus ou un conseil (option dedupe) n'est pas relu à l'identique
 *   avant REPEAT_MS (ex. « Pas de place ! »). Un compte, lui, est toujours
 *   lu : « deux blocs d'herbe » peut redevenir vrai après une pose.
 *
 * Dépendances injectées (affichage, voix, horloge, minuterie) : testable en Node.
 */

/** Délai minimal avant de relire exactement la même phrase (ms). */
export const REPEAT_MS = 4000;

/**
 * Durée d'affichage minimale d'un message pour qu'un enfant ait le temps de
 * le lire (ms) : un lecteur de CE2 lit bien moins vite qu'un adulte, et le
 * lecteur autonome n'a pas la voix par défaut. Plafonnée à 9 s ; un message
 * suivant remplace de toute façon le précédent.
 */
export function readingMs(text: string, level: ReadingLevel): number {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const ms = level === "autonome" ? 1200 + 400 * words : 1000 + 450 * words;
  return Math.min(9000, ms);
}

export interface NarratorDeps {
  show(text: string, durationMs: number): void;
  speak(text: string): void;
  now(): number;
  setTimer(fn: () => void, ms: number): number;
  clearTimer(id: number): void;
}

export interface TellOptions {
  /** Version à lire (nombres en lettres, par exemple) ; par défaut le texte affiché. */
  spoken?: ChildText;
  /** Durée d'affichage minimale (ms) ; allongée si le texte est long à lire (voir readingMs). */
  ms?: number;
  /** Lecture différée (ms) : une nouvelle lecture différée remplace celle en attente. */
  voiceDelayMs?: number;
  /** Faux : afficher sans lire. */
  voice?: boolean;
  /** Vrai pour un refus ou un conseil : ne pas relire la même phrase avant REPEAT_MS. */
  dedupe?: boolean;
  /**
   * Consigne importante (J5 : paroles de Pixel, mission) : tant qu'elle est lue,
   * les autres phrases sont seulement affichées, sans voix (une lecture coupe la précédente).
   */
  important?: boolean;
}

/** Durée estimée d'une lecture à voix haute (ms) : synthèse française, débit normal. */
export function speechMs(text: string): number {
  return 600 + text.length * 75;
}

type Say = { text: string; dedupe: boolean; important: boolean };

export class Narrator {
  level: ReadingLevel = "debutant";
  voice = true;
  private pending: number | null = null;
  private pendingSay: Say | null = null;
  /** Fin estimée de la consigne importante en cours de lecture. */
  private busyUntil = -Infinity;
  private lastSpoken = "";
  private lastSpokenAt = -Infinity;

  constructor(private readonly deps: NarratorDeps) {}

  /** Change le niveau de lecture ; la voix prend la valeur par défaut du niveau. */
  setLevel(level: ReadingLevel): void {
    this.level = level;
    this.voice = level === "debutant";
  }

  tell(text: ChildText, opts: TellOptions = {}): void {
    const shown = pick(text, this.level);
    this.deps.show(shown, Math.max(opts.ms ?? 2500, readingMs(shown, this.level)));
    if (!this.voice || opts.voice === false) return;
    const say: Say = { text: pick(opts.spoken ?? text, this.level), dedupe: opts.dedupe === true, important: opts.important === true };
    this.cancelPending();
    if (opts.voiceDelayMs && opts.voiceDelayMs > 0) this.schedule(say, opts.voiceDelayMs);
    else this.speakNow(say);
  }

  /**
   * Lit sans afficher (J6 : l'écran de félicitations montre déjà le texte). Même règles que tell :
   * voix coupée → rien ; consigne importante en cours → pas de coupure, sauf si celle-ci l'est aussi.
   */
  say(text: ChildText, opts: { important?: boolean; dedupe?: boolean } = {}): void {
    if (!this.voice) return;
    this.cancelPending();
    this.speakNow({ text: pick(text, this.level), dedupe: opts.dedupe === true, important: opts.important === true });
  }

  /** Vrai si une lecture différée attend. */
  get hasPending(): boolean {
    return this.pending !== null;
  }

  /** Repousse la lecture en attente : elle aura lieu au plus tôt dans ms (rien si aucune lecture n'attend). */
  snooze(ms: number): void {
    const say = this.pendingSay;
    if (this.pending === null || !say) return;
    this.deps.clearTimer(this.pending);
    this.schedule(say, ms);
  }

  /** Annule une lecture différée en attente (ex. changement de monde). */
  cancelPending(): void {
    if (this.pending === null) return;
    this.deps.clearTimer(this.pending);
    this.pending = null;
    this.pendingSay = null;
  }

  private schedule(say: Say, ms: number): void {
    this.pendingSay = say;
    this.pending = this.deps.setTimer(() => {
      this.pending = null;
      this.pendingSay = null;
      this.speakNow(say);
    }, ms);
  }

  private speakNow({ text: say, dedupe, important }: Say): void {
    if (!this.voice) return;
    const t = this.deps.now();
    if (dedupe && say === this.lastSpoken && t - this.lastSpokenAt < REPEAT_MS) return;
    // Une consigne importante est en cours : on ne la coupe pas (la phrase reste affichée).
    if (!important && t < this.busyUntil) return;
    if (important) this.busyUntil = t + speechMs(say);
    this.lastSpoken = say;
    this.lastSpokenAt = t;
    this.deps.speak(say);
  }
}
