import { diagnose, type Cell, type WritingState } from "../engine/words";

/**
 * Réaction du jeu à l'écriture d'un mot (mission 2, V2 lot 1 ; pur) : après une pose, une casse ou une pause de
 * l'enfant, un seul message au plus, par ordre de priorité :
 * 1. mot trouvé (le jeu dit ensuite « bravo », puis le conseil « fais le tour » ou « un espace entre les mots ») ;
 * 2. mot caché par un bloc (une fois par mot) ;
 * 3. mot écrit en colonne de bas en haut (une fois par mot) ;
 * 4. mot écrit de droite à gauche pour l'enfant (au plus toutes les 15 s) ;
 * 5. en copie : lettre en trop ou mauvaise lettre, avec les cases à revoir (en orange) ; rien de juste encore, une
 *    lettre fausse dans une case claire de la ligne tracée devant l'enfant ;
 * 6. en dictée, seulement quand l'enfant a fini ou s'est arrêté : ce qui ne va pas, sans jamais montrer où.
 * Les messages « une fois par … » sont retenus dans `FeedbackMemory` (une mémoire par mot). Les cases à revoir
 * sont données à chaque évaluation tant que l'erreur est là : seul le message n'est dit qu'une fois.
 */

/** Dictée : délai après la dernière pose quand l'essai a la longueur du mot (ms). */
export const DICT_FEEDBACK_FULL_MS = 1500;
/** Dictée : délai après la dernière pose quand l'enfant s'arrête avant (au moins deux lettres) (ms). */
export const DICT_FEEDBACK_IDLE_MS = 8000;
/** Écart minimal entre deux conseils « de gauche à droite » (ms). */
export const LEFT_TO_RIGHT_EVERY_MS = 15000;

/** Dictée : un retour est dû (longueur du mot atteinte et 1,5 s sans pose, ou au moins 2 lettres et 8 s sans pose). */
export function feedbackDue(len: number, targetLen: number, msSinceLastPlace: number): boolean {
  return (len >= targetLen && msSinceLastPlace >= DICT_FEEDBACK_FULL_MS) || (len >= 2 && msSinceLastPlace >= DICT_FEEDBACK_IDLE_MS);
}

/** Message à dire (textes de la mission 2, `wordTexts.ts`). */
export type FeedbackKey =
  | "HIDDEN_WORD"
  | "TOWER"
  | "LEFT_TO_RIGHT"
  | "EXTRA_LETTER"
  | "WRONG_LETTER"
  | "DICT_MISSING"
  | "DICT_WRONG"
  | "DICT_SWAP"
  | "DICT_EXTRA"
  | "DICT_FAR";

/**
 * Copie : cases de la ligne tracée devant l'enfant quand rien de juste n'est encore écrit (`planLine`), dans l'ordre
 * du mot, avec la lettre posée dans chacune (null : pas de lettre). Le jeu ne la donne que si cette ligne est montrée
 * (cases claires) : une lettre posée ailleurs n'est jamais signalée ainsi.
 */
export interface PlannedLetters {
  cells: readonly Cell[];
  letters: readonly (string | null)[];
}

/** Ce qui a déjà été dit pour le mot en cours (une mémoire par mot). */
export interface FeedbackMemory {
  hiddenSaid: boolean;
  towerSaid: boolean;
  /** Instant du dernier conseil « de gauche à droite » (ms). */
  leftToRightAt: number;
  /** Clés des messages « une fois par essai » déjà dits : `x:texte`, `w:position:lettre`, `d:texte`. */
  said: string[];
}

export function newFeedbackMemory(): FeedbackMemory {
  return { hiddenSaid: false, towerSaid: false, leftToRightAt: -Infinity, said: [] };
}

export interface WritingFeedback {
  /** Le mot est écrit (lisible) : le jeu valide l'étape. */
  found: boolean;
  foundFacing: boolean;
  glued: boolean;
  /** Message à dire, ou null. */
  key: FeedbackKey | null;
  /** L = lettre attendue, rang = position de la lettre (à partir de 1). */
  vars: { L?: string; rang?: number };
  /** Lettres à revoir (contour orange), en copie seulement. */
  wrongCells: Cell[];
  /** Dictée : un nouvel essai a reçu un retour (l'aide peut dévoiler une lettre de plus). */
  newTry: boolean;
  /** Lettres justes (longueur du mot s'il est trouvé). */
  have: number;
  /** Texte de la meilleure tentative (le mot s'il est trouvé), ou null. */
  attempt: string | null;
}

/**
 * Dictée : clé du retour selon l'écart. Une lettre en trop au début ou à la fin (le mot entier est là) : EXTRA_LETTER
 * (« le mot est là, une lettre en trop est collée ») ; au milieu : DICT_EXTRA.
 */
const DICT_KEYS = {
  missing: "DICT_MISSING",
  extra: "DICT_EXTRA",
  wrong: "DICT_WRONG",
  swap: "DICT_SWAP",
  far: "DICT_FAR",
} as const satisfies Partial<Record<ReturnType<typeof diagnose>["kind"], FeedbackKey>>;

/**
 * Réaction à l'état de l'écriture ; met `memory` à jour. `now` et `msSinceLastPlace` en ms. `planned` (copie) :
 * lettres posées dans les cases claires de la ligne tracée devant l'enfant ; quand aucune lettre juste n'est lue,
 * une lettre fausse dans une de ces cases est signalée comme une mauvaise lettre (jamais une lettre posée ailleurs).
 */
export function writingFeedback(
  s: WritingState,
  mode: "copy" | "dictation",
  target: string,
  now: number,
  msSinceLastPlace: number,
  memory: FeedbackMemory,
  planned: PlannedLetters | null = null,
): WritingFeedback {
  const best = s.best;
  const out: WritingFeedback = {
    found: false,
    foundFacing: false,
    glued: false,
    key: null,
    vars: {},
    wrongCells: [],
    newTry: false,
    have: s.found ? target.length : (best?.match.have ?? 0),
    attempt: s.found ? s.found.text : (best?.reading.text ?? null),
  };
  /** Message « une fois par … » : dit seulement si sa clé est nouvelle. */
  const once = (id: string, key: FeedbackKey): boolean => {
    if (memory.said.includes(id)) return false;
    memory.said.push(id);
    out.key = key;
    return true;
  };

  if (s.found) {
    out.found = true;
    out.foundFacing = s.foundFacing;
    out.glued = s.glued;
    return out;
  }
  if (s.hidden) {
    if (!memory.hiddenSaid) {
      memory.hiddenSaid = true;
      out.key = "HIDDEN_WORD";
    }
    return out;
  }
  if (s.tower) {
    if (!memory.towerSaid) {
      memory.towerSaid = true;
      out.key = "TOWER";
    }
    return out;
  }
  if (s.reversed) {
    if (now - memory.leftToRightAt >= LEFT_TO_RIGHT_EVERY_MS) {
      memory.leftToRightAt = now;
      out.key = "LEFT_TO_RIGHT";
    }
    return out;
  }
  if (mode === "copy") {
    const match = best?.match;
    if (best && (match?.kind === "extra" || match?.kind === "inside")) {
      const start = match.kind === "inside" ? match.at : 0;
      const end = start + target.length;
      out.wrongCells = best.reading.cells.filter((_, i) => i < start || i >= end);
      once(`x:${best.reading.text}`, "EXTRA_LETTER");
    } else if (best && match?.kind === "wrong") {
      const cell = best.reading.cells[match.have];
      if (cell) out.wrongCells = [cell];
      if (once(`w:${match.have}:${match.got}`, "WRONG_LETTER")) out.vars = { L: match.want, rang: match.have + 1 };
    } else if (out.have === 0 && planned) {
      // Rien de juste n'est lu : une lettre fausse posée dans une case claire (la première, par exemple) est
      // signalée comme une mauvaise lettre à cette place. Une lettre qui traîne ailleurs ne compte pas.
      const wrong: { cell: Cell; k: number; got: string }[] = [];
      planned.cells.forEach((cell, k) => {
        const got = planned.letters[k] ?? null;
        if (got !== null && k < target.length && got !== target.charAt(k)) wrong.push({ cell, k, got });
      });
      out.wrongCells = wrong.map((x) => x.cell);
      const first = wrong[0];
      if (first && once(`w:${first.k}:${first.got}`, "WRONG_LETTER")) out.vars = { L: target.charAt(first.k), rang: first.k + 1 };
    }
    return out;
  }

  if (!best) return out;
  const { reading } = best;
  // Dictée : rien tant que l'enfant n'a pas fini ou ne s'est pas arrêté ; jamais de cases à revoir.
  if (!feedbackDue(reading.text.length, target.length, msSinceLastPlace)) return out;
  const d = diagnose(reading.text, target);
  if (d.kind === "exact" || d.kind === "prefix") return out;
  // Lettre en trop au bout du mot (le mot entier est là) : le même message qu'en copie.
  const key = d.kind === "extra" && (reading.text.startsWith(target) || reading.text.endsWith(target)) ? "EXTRA_LETTER" : DICT_KEYS[d.kind];
  if (once(`d:${reading.text}`, key)) {
    out.newTry = true;
    if (d.kind === "wrong" && d.at !== null) out.vars = { rang: d.at + 1 };
  }
  return out;
}
