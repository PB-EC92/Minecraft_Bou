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
 * Dictée (V2 lot 1, mission 2) : les mots dictés au lecteur autonome sont lus
 * même voix coupée (décision 13 de Pierre), s'il existe une voix française
 * (canSpeak) ; sinon le jeu passe à la copie. Voir dictate.
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
  /** Une voix française est disponible pour lire (dictée de la mission 2). Absent : faux. */
  canSpeak?(): boolean;
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
  /** Dictée en attente de la fin d'une consigne importante (minuterie). */
  private pendingDictation: number | null = null;
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
    this.speakOrSchedule(say, opts.voiceDelayMs);
  }

  /**
   * Lit sans afficher (J6 : l'écran de félicitations montre déjà le texte ; V2 lot 1 : le panneau de fabrication
   * affiche le sien). Même règles que tell : voix coupée → rien ; consigne importante en cours → pas de coupure,
   * sauf si celle-ci l'est aussi ; voiceDelayMs > 0 → lecture différée, remplacée par la suivante.
   */
  say(text: ChildText, opts: { important?: boolean; dedupe?: boolean; voiceDelayMs?: number } = {}): void {
    if (!this.voice) return;
    this.speakOrSchedule({ text: pick(text, this.level), dedupe: opts.dedupe === true, important: opts.important === true }, opts.voiceDelayMs);
  }

  /**
   * Dictée de la mission 2 (V2 lot 1) : lit le texte tel quel (déjà choisi pour le lecteur autonome), MÊME si la
   * voix est coupée (décision 13 de Pierre), sans anti-répétition, comme une consigne importante (rien ne la coupe
   * pendant sa lecture). Si une consigne importante est en cours, la dictée attend sa fin sans la couper ; une seule
   * dictée attend, remplacée par la suivante ; cancelPending l'annule.
   * Renvoie faux, sans rien faire, s'il n'y a pas de voix pour lire (canSpeak absent ou faux) : le jeu montre alors
   * le mot à copier.
   */
  dictate(text: string): boolean {
    if (!this.deps.canSpeak?.()) return false;
    this.cancelDictation();
    this.dictateWhenFree(text);
    return true;
  }

  /** Vrai pendant la lecture estimée d'une consigne importante (ou d'une dictée). */
  get busy(): boolean {
    return this.deps.now() < this.busyUntil;
  }

  /** Vrai si une lecture différée attend (hors dictée). */
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

  /** Annule une lecture différée en attente et une dictée en attente (ex. changement de monde). */
  cancelPending(): void {
    this.cancelDelayed();
    this.cancelDictation();
  }

  /**
   * Annule seulement la lecture différée en attente (compte du ramassage), pas la dictée (V2 lot 1) : un écran posé
   * sur le jeu (panneau de fabrication) ne doit pas faire perdre le mot redit ou l'indice dicté (décision 13).
   */
  cancelDelayedSpeech(): void {
    this.cancelDelayed();
  }

  /** Une nouvelle lecture remplace la lecture différée en attente (pas la dictée, qui attend son tour). */
  private speakOrSchedule(say: Say, delayMs: number | undefined): void {
    this.cancelDelayed();
    if (delayMs !== undefined && delayMs > 0) this.schedule(say, delayMs);
    else this.speakNow(say);
  }

  private cancelDelayed(): void {
    if (this.pending === null) return;
    this.deps.clearTimer(this.pending);
    this.pending = null;
    this.pendingSay = null;
  }

  private cancelDictation(): void {
    if (this.pendingDictation === null) return;
    this.deps.clearTimer(this.pendingDictation);
    this.pendingDictation = null;
  }

  /** Lit la dictée tout de suite, ou à la fin de la consigne importante en cours (vérifié de nouveau à l'échéance). */
  private dictateWhenFree(text: string): void {
    const t = this.deps.now();
    if (t < this.busyUntil) {
      this.pendingDictation = this.deps.setTimer(() => {
        this.pendingDictation = null;
        this.dictateWhenFree(text);
      }, this.busyUntil - t);
      return;
    }
    this.busyUntil = t + speechMs(text);
    this.lastSpoken = text;
    this.lastSpokenAt = t;
    this.deps.speak(text);
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
