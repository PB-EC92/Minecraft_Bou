import { pick, type ChildText, type ReadingLevel } from "./texts";

/**
 * Narrateur (J2) : affiche les messages adressés à l'enfant dans la variante
 * de son niveau de lecture, et les lit à voix haute si la voix est active.
 *
 * Lecteur débutant (6 ans) : texte court affiché ET lu (il s'entraîne à
 * lire en entendant). Lecteur autonome (8 ans) : texte plus complet, voix
 * coupée par défaut.
 *
 * Deux garde-fous pour que la voix n'use pas la patience :
 * - une lecture différée (ramassage) est remplacée par la suivante : en
 *   cassant vite, on n'entend que le dernier compte (« cinq pierres ! ») ;
 * - la même phrase n'est pas relue avant REPEAT_MS (ex. « Pas de place ! »).
 *
 * Dépendances injectées (affichage, voix, horloge, minuterie) : testable en Node.
 */

/** Délai minimal avant de relire exactement la même phrase (ms). */
export const REPEAT_MS = 4000;

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
  /** Durée d'affichage (ms). */
  ms?: number;
  /** Lecture différée (ms) : une nouvelle lecture différée remplace celle en attente. */
  voiceDelayMs?: number;
  /** Faux : afficher sans lire (ex. avant le premier geste, la voix est bloquée par le navigateur). */
  voice?: boolean;
}

export class Narrator {
  level: ReadingLevel = "debutant";
  voice = true;
  private pending: number | null = null;
  private lastSpoken = "";
  private lastSpokenAt = -Infinity;

  constructor(private readonly deps: NarratorDeps) {}

  /** Change le niveau de lecture ; la voix prend la valeur par défaut du niveau. */
  setLevel(level: ReadingLevel): void {
    this.level = level;
    this.voice = level === "debutant";
  }

  tell(text: ChildText, opts: TellOptions = {}): void {
    this.deps.show(pick(text, this.level), opts.ms ?? 2500);
    if (!this.voice || opts.voice === false) return;
    const say = pick(opts.spoken ?? text, this.level);
    this.cancelPending();
    if (opts.voiceDelayMs && opts.voiceDelayMs > 0) {
      this.pending = this.deps.setTimer(() => {
        this.pending = null;
        this.speakNow(say);
      }, opts.voiceDelayMs);
    } else {
      this.speakNow(say);
    }
  }

  /** Annule une lecture différée en attente (ex. changement de monde). */
  cancelPending(): void {
    if (this.pending === null) return;
    this.deps.clearTimer(this.pending);
    this.pending = null;
  }

  private speakNow(say: string): void {
    if (!this.voice) return;
    const t = this.deps.now();
    if (say === this.lastSpoken && t - this.lastSpokenAt < REPEAT_MS) return;
    this.lastSpoken = say;
    this.lastSpokenAt = t;
    this.deps.speak(say);
  }
}
