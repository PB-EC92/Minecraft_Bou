import type { HelpOutput, WriteMode } from "./wordHelp";

/**
 * Temps passé sur chaque mot de la mission 2 (pur) : relevé par le jeu pour l'adulte (protocole de RETOURS.md,
 * « temps par mot »), enregistré dans la progression de la mission (champ `wordStats`), montré dans le mode parent
 * et jamais à l'enfant.
 *
 * Par étape d'écriture : le mot, le mode au moment de la consigne (copie ou dictée), la durée de jeu actif de la
 * consigne à la validation, les essais non réussis (réactions de writingFeedback qui ne valident pas) et les aides
 * données pendant l'étape. Pour la mission : la durée de jeu actif de la première consigne d'écriture aux
 * félicitations. « Actif » : partie affichée (onglet visible) et jeu non figé, boîte à lettres ouverte comprise
 * (choisir une lettre fait partie de l'écriture) ; le panneau de fabrication, l'écran de félicitations, l'accueil et
 * le chargement d'un monde ne comptent pas (voir Game.updateWordClock).
 *
 * Lecture robuste : un champ absent, d'une autre forme ou hors bornes est ignoré, jamais une erreur. La 1.1-rc ne lit
 * pas ce champ (MissionRunner ne relit que id, step, counts, words et word) : elle reprend la partie sans le voir.
 */

/**
 * Aides comptées (identifiants enregistrés : stables, on ajoute à la fin). Copie : case suivante montrée (palier 1),
 * ligne de cases claires (palier 2), lettre suivante dite, conseil « sol plat » (aucune case claire n'a trouvé de
 * place), lettre mise dans la main. Dictée : cases du mot, première lettre, une lettre de plus dévoilée, passage en
 * copie (mot entier dévoilé, ou plus de voix). Les deux : comment casser une lettre fausse.
 */
export const WORD_HELP_KINDS = [
  "nextGhost",
  "ghostLine",
  "nextLetter",
  "flatGround",
  "giveLetter",
  "wordBoxes",
  "firstLetter",
  "moreLetter",
  "toCopy",
  "breakTip",
] as const;

export type WordHelpKind = (typeof WORD_HELP_KINDS)[number];

/** Nom court de chaque aide, pour l'adulte (mode parent). */
export const WORD_HELP_LABELS: Record<WordHelpKind, string> = {
  nextGhost: "case",
  ghostLine: "ligne",
  nextLetter: "lettre dite",
  flatGround: "sol plat",
  giveLetter: "lettre donnée",
  wordBoxes: "cases du mot",
  firstLetter: "1re lettre",
  moreLetter: "lettre dévoilée",
  toCopy: "passé en copie",
  breakTip: "comment casser",
};

/** Relevé d'une étape d'écriture. */
export interface WordStat {
  /** Mot attendu (capitales ; le prénom sans accent pour l'étape « prénom »). */
  word: string;
  /** Mode au moment de la consigne ; un passage en copie en cours d'étape est une aide (toCopy). */
  mode: WriteMode;
  /** Durée de jeu actif de la consigne à la validation (ms). */
  ms: number;
  /** Réactions de writingFeedback qui ne valident pas (lettre fausse, en trop, mot caché, à l'envers…). */
  fails: number;
  /** Aides données pendant l'étape, et combien de fois. */
  helps: Partial<Record<WordHelpKind, number>>;
  /**
   * Mot remplacé par un autre avant d'être écrit (niveau de lecture ou prénom changé entre deux parties : prepare tire
   * un autre mot). Son relevé est gardé parmi les étapes finies, pour que le temps passé ne disparaisse pas ; il ne
   * compte pas parmi les mots écrits. Absent pour un mot écrit.
   */
  replaced?: true;
}

/** Relevé de la mission : étapes finies, étape en cours, durée totale (null : pas encore de consigne d'écriture). */
export interface WordStats {
  words: WordStat[];
  current: WordStat | null;
  totalMs: number | null;
}

/** Plus d'étapes retenues (sécurité de la relecture ; la mission 2 en a quatre). */
export const MAX_WORD_STATS = 10;
/** Bornes de la relecture : au-delà, la valeur est tenue pour abîmée (30 jours, 9 999 fois). */
const MAX_MS = 30 * 24 * 3600 * 1000;
const MAX_COUNT = 9999;

const WORD_RE = /^[A-Z]{2,10}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const okMs = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_MS;
const okCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_COUNT;

export function emptyWordStats(): WordStats {
  return { words: [], current: null, totalMs: null };
}

export function newWordStat(word: string, mode: WriteMode): WordStat {
  return { word, mode, ms: 0, fails: 0, helps: {} };
}

/** Relevé d'une étape relu : null si le mot, le mode, la durée ou les essais manquent ; aides inconnues ignorées. */
export function readWordStat(raw: unknown): WordStat | null {
  if (!isObj(raw)) return null;
  const { word, mode, ms, fails } = raw;
  if (typeof word !== "string" || !WORD_RE.test(word)) return null;
  if (mode !== "copy" && mode !== "dictation") return null;
  if (!okMs(ms) || !okCount(fails)) return null;
  const helps: Partial<Record<WordHelpKind, number>> = {};
  if (isObj(raw.helps)) {
    for (const k of WORD_HELP_KINDS) {
      const n = raw.helps[k];
      if (okCount(n) && n > 0) helps[k] = n;
    }
  }
  return { word, mode, ms, fails, helps, ...(raw.replaced === true ? { replaced: true as const } : {}) };
}

/** Relevé de la mission relu (champ `wordStats` de la progression) ; n'importe quoi d'autre : relevé vide. */
export function readWordStats(raw: unknown): WordStats {
  if (!isObj(raw)) return emptyWordStats();
  const words: WordStat[] = [];
  if (Array.isArray(raw.words)) {
    for (const w of raw.words as unknown[]) {
      if (words.length >= MAX_WORD_STATS) break;
      const s = readWordStat(w);
      if (s) words.push(s);
    }
  }
  return { words, current: readWordStat(raw.current), totalMs: okMs(raw.totalMs) ? raw.totalMs : null };
}

/** Copie d'un relevé d'étape, durée arrondie à la milliseconde (enregistrement, accès de test). */
function statJSON(s: WordStat): WordStat {
  return {
    word: s.word,
    mode: s.mode,
    ms: Math.round(s.ms),
    fails: s.fails,
    helps: { ...s.helps },
    ...(s.replaced === true ? { replaced: true as const } : {}),
  };
}

/** Forme enregistrée du relevé, ou undefined s'il est vide (rien n'est ajouté à la sauvegarde). */
export function wordStatsJSON(s: WordStats): { words: WordStat[]; current?: WordStat; totalMs?: number } | undefined {
  if (s.words.length === 0 && s.current === null && s.totalMs === null) return undefined;
  return {
    words: s.words.map(statJSON),
    ...(s.current ? { current: statJSON(s.current) } : {}),
    ...(s.totalMs !== null ? { totalMs: Math.round(s.totalMs) } : {}),
  };
}

/** Durée pour l'adulte : « 45 s », « 1 min 20 s », « 2 min », « 1 h 5 min ». */
export function formatDuration(ms: number): string {
  const s = Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 0;
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
  }
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  return min === 0 ? `${h} h` : `${h} h ${min} min`;
}

/** Aides d'une étape, dans l'ordre de WORD_HELP_KINDS : « aides : case, ligne, lettre dite ×2 », ou « sans aide ». */
export function helpsLabel(helps: Partial<Record<WordHelpKind, number>>): string {
  const parts = WORD_HELP_KINDS.flatMap((k) => {
    const n = helps[k] ?? 0;
    return n > 0 ? [n > 1 ? `${WORD_HELP_LABELS[k]} ×${n}` : WORD_HELP_LABELS[k]] : [];
  });
  return parts.length === 0 ? "sans aide" : `aide${parts.length > 1 ? "s" : ""} : ${parts.join(", ")}`;
}

/** Essais non réussis : « aucun essai non réussi », « 1 essai non réussi », « 3 essais non réussis ». */
export function failsLabel(n: number): string {
  if (n <= 0) return "aucun essai non réussi";
  return n === 1 ? "1 essai non réussi" : `${n} essais non réussis`;
}

/**
 * Ligne d'une étape : « AMI (copie) : 1 min 20 s, 2 essais non réussis, aides : case, ligne » ; « …, en cours » ;
 * « SOL (copie, remplacé par un autre mot avant d'être écrit) : … ».
 */
export function wordStatLine(s: WordStat, inProgress = false): string {
  const mode = s.mode === "copy" ? "copie" : "dictée";
  const tag = s.replaced === true ? ", remplacé par un autre mot avant d'être écrit" : inProgress ? ", en cours" : "";
  return `${s.word} (${mode}${tag}) : ${formatDuration(s.ms)}, ${failsLabel(s.fails)}, ${helpsLabel(s.helps)}`;
}

/** Ligne d'un mot écrit dont le relevé manque (écrit avec la 1.1-rc, ou relevé effacé par elle à la sauvegarde). */
export function unrecordedWordLine(word: string): string {
  return `${word} : non relevé (écrit avec une version du jeu sans ce relevé)`;
}

/**
 * Aides montrées par l'aide progressive (wordHelp) entre deux états, pour le relevé : en copie, la case suivante
 * (palier 1) et la ligne de cases claires (palier 2) quand le palier monte (le palier de départ du mot 1, fixé avant
 * la consigne, n'est pas une aide relevée : le jeu n'appelle pas cette fonction pour lui) ; en dictée, chaque indice
 * (cases du mot, première lettre, une lettre de plus) et le passage en copie (mot entier dévoilé, qui remplace la
 * dernière lettre dévoilée). Les aides dites en copie (lettre suivante, sol plat, lettre donnée) dépendent de l'état
 * du jeu et sont relevées par lui (Game.sayHelp, Game.giveLetter) ; le passage en copie faute de voix aussi
 * (Game.dictationLost).
 */
export function helpsFromOutput(before: { mode: WriteMode; stage: number }, out: Pick<HelpOutput, "mode" | "stage" | "say">): WordHelpKind[] {
  const kinds: WordHelpKind[] = [];
  if (before.mode === "copy") {
    if (out.mode !== "copy") return kinds;
    if (before.stage < 1 && out.stage >= 1) kinds.push("nextGhost");
    if (before.stage < 2 && out.stage >= 2) kinds.push("ghostLine");
    return kinds;
  }
  if (out.say === "count") kinds.push("wordBoxes");
  else if (out.say === "first") kinds.push("firstLetter");
  else if (out.say === "more") kinds.push("moreLetter");
  if (out.mode === "copy") kinds.push("toCopy");
  return kinds;
}
