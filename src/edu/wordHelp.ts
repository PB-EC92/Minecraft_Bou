/**
 * Aide progressive de la mission 2 « Les mots » (V2 lot 1, pur) : ce que le jeu montre et dit pendant qu'un enfant
 * écrit un mot, selon le temps passé sans progrès. On n'échoue jamais : l'aide monte jusqu'au mot entier (dictée)
 * ou jusqu'à mettre la lettre dans la main (copie).
 *
 * - Copie (débutant, ou autonome sans voix) : le modèle est toujours montré, la lettre suivante entourée. Palier 1 :
 *   fantôme de la lettre suivante et anneau dans la boîte ; palier 2 : ligne de fantômes complète. Le mot 1 commence
 *   au palier 2. Le palier ne redescend jamais pendant l'étape.
 * - Dictée (autonome) : rien au départ ; puis, toutes les 30 s sans progrès ou à chaque essai, un indice de plus :
 *   les cases du mot, la première lettre, une lettre de plus… jusqu'au mot entier, qui fait passer en copie.
 *
 * `ms` est le temps sans progrès, hors pause (boîte ouverte, félicitations, accueil). Le jeu le remet à 0 quand
 * `have` augmente, et en dictée quand `resetClock` est vrai. Un seuil est « franchi » quand prevMs < seuil ≤ ms.
 * Le palier, `revealed` et le passage en copie sont enregistrés par MissionRunner.noteHelp (reprise).
 */

export type WriteMode = "copy" | "dictation";

/** Copie : fantôme de la lettre suivante et anneau dans la boîte (palier 1). */
export const COPY_NEXT_GHOST_MS = 15_000;
/** Copie : « Maintenant, la lettre N ! ». */
export const COPY_SAY_NEXT_MS = 25_000;
/** Copie, rien posé : ligne de fantômes complète (palier 2) et « Remplis les cases claires ! ». */
export const COPY_LINE_MS = 30_000;
/** Copie : la lettre attendue est mise dans la main (« Voici la lettre N ! »). */
export const COPY_GIVE_MS = 50_000;
/** Copie : ensuite, « Maintenant, la lettre … ! » toutes les 30 s (80 s, 110 s…). */
export const COPY_REPEAT_MS = 30_000;
/** Dictée : un indice de plus toutes les 30 s sans progrès. */
export const DICT_STAGE_MS = 30_000;

/** Lettre choisie et pas posée depuis 6 s : rappel du geste (au plus toutes les 20 s). */
export const LETTER_IN_HAND_MS = 6_000;
export const LETTER_IN_HAND_EVERY_MS = 20_000;
/** Lettre fausse toujours là 10 s après la correction : comment la casser. */
export const BREAK_TIP_MS = 10_000;

/** Ce que le jeu doit dire : NEXT_LETTER, GHOST_LINE, GIVE_LETTER, DICT_HELP_COUNT / FIRST / MORE / ALL. */
export type HelpSay = "next" | "ghosts" | "give" | "count" | "first" | "more" | "all";

export interface HelpInput {
  mode: WriteMode;
  /** Premier mot de la mission (la copie commence alors au palier 2). */
  firstWord: boolean;
  /** Longueur du mot à écrire. */
  length: number;
  /** Lettres justes déjà posées (début du mot). */
  have: number;
  /** Palier d'aide actuel. */
  stage: number;
  /** Dictée : lettres dévoilées dans les cases. */
  revealed: number;
  /** Temps sans progrès à l'image précédente, puis maintenant (ms). */
  prevMs: number;
  ms: number;
  /** Dictée : l'enfant vient de faire un essai qui a reçu un retour. */
  newTry: boolean;
}

export interface HelpShow {
  /** Modèle du mot : en entier (copie), en cases (dictée avec indices) ou rien. */
  model: "full" | "boxes" | "none";
  /** Lettres visibles dans le modèle. */
  revealed: number;
  /** Lettre suivante entourée dans le modèle. */
  nextRing: boolean;
  /** Ligne de fantômes complète dans le monde. */
  ghostLine: boolean;
  /** Fantôme de la lettre suivante. */
  ghostNext: boolean;
  /** Anneau sur la lettre attendue dans la boîte. */
  trayGlow: boolean;
}

export interface HelpOutput {
  mode: WriteMode;
  stage: number;
  revealed: number;
  /** Dictée : un indice vient d'être donné, l'horloge repart à 0. */
  resetClock: boolean;
  say: HelpSay | null;
  show: HelpShow;
}

const crossed = (prevMs: number, ms: number, t: number) => prevMs < t && t <= ms;

/** Copie : un des seuils de répétition (COPY_GIVE_MS + k × COPY_REPEAT_MS, k ≥ 1) est-il franchi ? */
function repeatCrossed(prevMs: number, ms: number): boolean {
  const k = Math.max(1, Math.floor((prevMs - COPY_GIVE_MS) / COPY_REPEAT_MS) + 1);
  return crossed(prevMs, ms, COPY_GIVE_MS + k * COPY_REPEAT_MS);
}

function copyShow(stage: number, length: number): HelpShow {
  return { model: "full", revealed: length, nextRing: true, ghostLine: stage >= 2, ghostNext: stage >= 1, trayGlow: stage >= 1 };
}

/** Palier de départ de la copie : 2 au premier mot (fantômes et anneau d'emblée). */
const copyFloor = (firstWord: boolean) => (firstWord ? 2 : 0);

function copyHelp(i: HelpInput, length: number): HelpOutput {
  let stage = Math.max(0, i.stage, copyFloor(i.firstWord));
  let say: HelpSay | null = null;
  // Dans l'ordre de priorité croissante : si deux seuils tombent dans la même image, give > ghosts > next.
  if (crossed(i.prevMs, i.ms, COPY_NEXT_GHOST_MS)) stage = Math.max(stage, 1);
  if (crossed(i.prevMs, i.ms, COPY_SAY_NEXT_MS) || repeatCrossed(i.prevMs, i.ms)) say = "next";
  if (crossed(i.prevMs, i.ms, COPY_LINE_MS) && i.have === 0) {
    stage = Math.max(stage, 2);
    say = "ghosts";
  }
  if (crossed(i.prevMs, i.ms, COPY_GIVE_MS)) say = "give";
  return { mode: "copy", stage, revealed: i.revealed, resetClock: false, say, show: copyShow(stage, length) };
}

function dictationHelp(i: HelpInput, length: number): HelpOutput {
  let stage = Math.max(0, i.stage);
  let revealed = Math.max(0, i.revealed);
  let say: HelpSay | null = null;
  let resetClock = false;
  if (i.ms >= DICT_STAGE_MS || i.newTry) {
    stage += 1;
    resetClock = true;
    if (stage === 1) say = "count";
    else if (stage === 2) {
      revealed = Math.max(revealed, i.have, 1);
      say = "first";
    } else {
      revealed = Math.max(revealed + 1, i.have + 1);
      say = "more";
    }
  }
  if (revealed >= length) {
    // Mot entier dévoilé : on passe en copie (lettre suivante entourée, fantôme, anneau) ; jamais d'échec.
    const copyStage = Math.max(1, copyFloor(i.firstWord));
    return { mode: "copy", stage: copyStage, revealed: length, resetClock: true, say: "all", show: copyShow(copyStage, length) };
  }
  return {
    mode: "dictation",
    stage,
    revealed,
    resetClock,
    say,
    show: { model: stage === 0 ? "none" : "boxes", revealed, nextRing: false, ghostLine: false, ghostNext: false, trayGlow: false },
  };
}

/** Aide à montrer et à dire pour cette image (voir l'en-tête du module). */
export function wordHelp(i: HelpInput): HelpOutput {
  const length = Math.max(0, Math.floor(i.length));
  if (length === 0) {
    // Pas de mot à écrire : rien à montrer.
    return {
      mode: i.mode,
      stage: i.stage,
      revealed: i.revealed,
      resetClock: false,
      say: null,
      show: { model: "none", revealed: 0, nextRing: false, ghostLine: false, ghostNext: false, trayGlow: false },
    };
  }
  return i.mode === "copy" ? copyHelp(i, length) : dictationHelp(i, length);
}
