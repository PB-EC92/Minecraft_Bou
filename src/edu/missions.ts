import { BlockId, isLetterId } from "../engine/blocks";
import type { ShelterCheck } from "../engine/shelter";
import { NBSP, type ChildText, type ReadingLevel } from "./texts";
import type { WriteMode } from "./wordHelp";
import { fillWord, nameWord, pickWord, wordList, type WordVars } from "./wordLists";
import {
  M2_INTRO,
  M2_OUTRO,
  M2_STEP0_HINT,
  M2_STEP_LETTER,
  M2_STEP_LETTER_TOUCH,
  M2_STEP_NAME,
  M2_STEP_NAME_COPY,
  M2_STEP_WORD,
  M2_STEP_WORD_COPY,
} from "./wordTexts";

/**
 * Moteur de missions (J5, pur ; J6 : tutoriel et mission 1 complète) : une
 * mission est une suite d'étapes décrites par des données (objectif, textes en
 * deux variantes, forme écrite et forme dite, consigne propre au doigt). Le jeu
 * observe son état (sac, blocs posés et cassés, pas, abri, créatures) et le
 * moteur fait avancer la mission ; le compagnon porte les textes. Aucun échec
 * possible : une étape attend simplement que l'enfant y arrive.
 *
 * Campagne : le tutoriel (mission 0, une fois par enfant), la mission 1
 * « Construis un abri avant la nuit » (V1), puis la mission 2 « Les mots »
 * (V2 lot 1 : poser des blocs-lettres, écrire trois mots et son prénom).
 */

/** Signal observé par le jeu (J6). */
export type MissionSignal = "lamp-scare";

export type Goal =
  /** Avoir au moins `count` blocs de ce type dans le sac. */
  | { kind: "collect"; block: BlockId; count: number }
  /** Poser `count` blocs (de ce type, ou n'importe lesquels) depuis le début de l'étape. */
  | { kind: "place"; block: BlockId | "any"; count: number }
  /** Casser `count` blocs (de ce type, ou n'importe lesquels) depuis le début de l'étape (J6). */
  | { kind: "break"; block: BlockId | "any"; count: number }
  /** Marcher `distance` blocs depuis le début de l'étape (J6). */
  | { kind: "walk"; distance: number }
  /** Se tenir dans un abri complet construit par l'enfant (J6, voir engine/shelter). */
  | { kind: "shelter" }
  /** Voir arriver un signal du jeu (J6 : une Grignote qui fuit la lampe). */
  | { kind: "watch"; signal: MissionSignal }
  /**
   * Poser `count` blocs-lettres (case ABC) depuis le début de l'étape (V2 lot 1, mission 2), comptés par la clé
   * « place:letter ». Un objectif à part plutôt qu'un « place » de bloc « letter » : pour un « place », `goal.block`
   * reste un bloc ou « any » (le jeu en tire l'icône du bandeau et le bloc protégé du sac).
   */
  | { kind: "letter"; count: number }
  /**
   * Écrire un mot avec les blocs-lettres (V2 lot 1, mission 2) : un mot de la liste du niveau, du palier `tier`, ou
   * le prénom de l'enfant (`source: "name"`, sinon un mot du palier). Le mot est fixé par MissionRunner.prepare.
   */
  | { kind: "write"; source: "list" | "name"; tier: 1 | 2 | 3 };

export interface StepText {
  /** Consigne écrite (chiffres). */
  text: ChildText;
  /** Consigne dite (nombres en lettres) ; par défaut, la consigne écrite. */
  spoken?: ChildText;
}

export interface StepDef extends StepText {
  goal: Goal;
  /** Consigne propre au doigt (tablette), quand le geste diffère de la souris et du clavier (J6). */
  touch?: StepText;
  /** Libellé court pour l'adulte (mode parent). */
  label: string;
  /** Conseil de Pixel quand l'étape n'avance plus depuis un moment (J7 : « creuse, la pierre est dessous »). */
  hint?: ChildText;
  /** Bloc montré dans le bandeau de Pixel, s'il diffère de celui de l'objectif (J7 : on cherche une pierre brillante, on obtient une lampe). */
  icon?: BlockId;
  /** Consigne d'une étape « write » quand le lecteur autonome est en copie (mot dévoilé, pas de voix, prénom à accents) (V2 lot 1). */
  copy?: StepText;
  /** Forme dite du conseil (V2 lot 1 : « a, bé, cé » pour ABC) ; par défaut, le conseil écrit. */
  hintSpoken?: ChildText;
  /** Le soir s'arrête à 17 h pendant cette étape (V2 lot 1 : la nuit attend l'abri, le tutoriel et les mots). */
  holdEvening?: boolean;
}

/** Ligne du récapitulatif de l'écran de félicitations : un bloc et son nombre, l'abri, ou les mots écrits (mission 2). */
export type RecapItem = { block: BlockId; count: number } | { shelter: true } | { words: true };

export interface MissionDef {
  id: string;
  /** Nom pour l'adulte (mode parent). */
  name: string;
  intro: ChildText;
  steps: readonly StepDef[];
  outro: ChildText;
  /** Récapitulatif montré sur l'écran de félicitations (J6) ; sans lui, pas d'écran de félicitations. */
  recap?: readonly RecapItem[];
  /** Cadeau de fin de mission (J6). */
  reward?: { block: BlockId; count: number };
}

/** Progression enregistrée (dans la sauvegarde du monde). */
export interface MissionProgress {
  id: string;
  step: number;
  /**
   * Compteurs de l'étape en cours, remis à zéro à chaque étape : « place:any », « place:13 »,
   * « break:any », « break:3 », « walk » (blocs parcourus), « signal:lamp-scare » ; V2 lot 1 : « place:letter »,
   * et pour une étape « write » : « written » (1 : mot écrit), « tries » (essais de la dictée), « help » (palier
   * d'aide), « revealed » (lettres dévoilées), « copy » (1 : passé en copie).
   */
  counts: Record<string, number>;
  /** Mots écrits dans cette mission, dans l'ordre (capitales, 10 au plus) (V2 lot 1). */
  words?: string[];
  /** Mot de l'étape « write » en cours, fixé par prepare (gardé à la reprise) (V2 lot 1). */
  word?: string;
}

/** Contexte du tirage d'un mot (V2 lot 1). */
export interface WordContext {
  level: ReadingLevel;
  /** Prénom du profil tel qu'enregistré (null en mode adresse). */
  name: string | null;
  /** Graine du monde : même monde, mêmes mots. */
  seed: number;
  /** Mots à éviter (déjà écrits dans ce monde ou dans les autres mondes de l'enfant). */
  exclude: ReadonlySet<string>;
}

/** Plus de mots retenus par mission (sécurité de la relecture). */
export const MAX_WORDS = 10;

/** Mot valide de la mission 2 : 2 à 10 capitales A–Z. */
const WORD_RE = /^[A-Z]{2,10}$/;

export interface MissionView {
  count(id: BlockId): number;
  /** Abri autour de l'enfant (seulement demandé pendant une étape « abri »). */
  shelter?(): ShelterCheck | null;
}

export type MissionEvent = { kind: "step"; index: number } | { kind: "done" };

export const BRAVO: ChildText = { debutant: `Bravo${NBSP}!`, autonome: `Bravo, c'est fait${NBSP}!` };

/** Parties d'un abri à réunir, pour l'avancement : le toit et trois murs. */
export const SHELTER_PARTS = 4;

/** Mission 0 (J6) : le tutoriel, trois gestes. Fait une fois par enfant (profil), puis sauté. */
export const TUTORIAL: MissionDef = {
  id: "tuto",
  name: "tutoriel",
  intro: {
    debutant: `Je suis Pixel${NBSP}! Apprenons à jouer.`,
    autonome: `Bonjour, je suis Pixel, ton renard${NBSP}! Je vais t'apprendre à jouer.`,
  },
  steps: [
    {
      goal: { kind: "walk", distance: 5 },
      text: { debutant: "Appuie sur Z pour marcher.", autonome: `Appuie sur Z pour avancer${NBSP}: Q, S et D font aller des autres côtés.` },
      touch: { text: { debutant: "Pousse le rond pour marcher.", autonome: "Pose ton pouce sur le rond en bas à gauche et pousse-le pour marcher." } },
      label: "marcher",
      holdEvening: true,
    },
    {
      goal: { kind: "break", block: "any", count: 1 },
      text: {
        debutant: `Casse un bloc${NBSP}: garde le clic.`,
        autonome: "Vise un bloc avec la croix et garde le clic gauche appuyé pour le casser.",
      },
      touch: {
        text: {
          debutant: `Casse un bloc${NBSP}: garde le doigt.`,
          autonome: "Vise un bloc avec la croix du milieu et garde le doigt appuyé pour le casser.",
        },
      },
      label: "casser un bloc",
      holdEvening: true,
    },
    {
      goal: { kind: "place", block: "any", count: 1 },
      text: { debutant: `Pose-le${NBSP}: clic droit.`, autonome: "Vise un endroit avec la croix et fais un clic droit pour poser ton bloc." },
      touch: {
        text: {
          debutant: "Touche Casser, puis tape.",
          autonome: `Touche le bouton Casser${NBSP}: il devient Poser. Puis tape l'écran${NBSP}: ton bloc se pose sous la croix du milieu.`,
        },
      },
      label: "poser un bloc",
      holdEvening: true,
    },
  ],
  outro: {
    debutant: `Bravo, tu sais jouer${NBSP}!`,
    autonome: `Bravo${NBSP}! Tu sais marcher, casser et poser des blocs.`,
  },
};

/** Mission 1 (J5, complétée au J6) : « Construis un abri avant la nuit ». */
export const MISSION_1: MissionDef = {
  id: "abri",
  name: "mission 1 (l'abri)",
  intro: {
    debutant: `Construisons un abri avant la nuit${NBSP}!`,
    autonome: `Construisons un abri avant la nuit${NBSP}: quand il fait noir, les Grignotes sortent.`,
  },
  steps: [
    {
      goal: { kind: "collect", block: BlockId.Log, count: 6 },
      text: { debutant: "Ramasse 6 troncs.", autonome: "Casse des troncs d'arbre pour en ramasser 6." },
      spoken: { debutant: "Ramasse six troncs.", autonome: "Casse des troncs d'arbre pour en ramasser six." },
      label: "ramasser 6 troncs",
      holdEvening: true,
      hint: {
        debutant: `Cherche un arbre${NBSP}!`,
        autonome: `Les troncs sont le bois des arbres${NBSP}: approche-toi d'un arbre, vise le tronc et garde l'appui. S'il n'y a pas d'arbre près de toi, va plus loin.`,
      },
    },
    {
      goal: { kind: "collect", block: BlockId.Stone, count: 4 },
      text: { debutant: "Ramasse 4 pierres.", autonome: "Casse des pierres grises pour en ramasser 4." },
      spoken: { debutant: "Ramasse quatre pierres.", autonome: "Casse des pierres grises pour en ramasser quatre." },
      label: "ramasser 4 pierres",
      holdEvening: true,
      // Recette J7 : hors des montagnes, la pierre n'est jamais en surface (sous 4 à 5 blocs d'herbe, de terre ou de sable).
      hint: {
        debutant: `Creuse${NBSP}: la pierre est dessous${NBSP}!`,
        autonome: `La pierre grise est souvent cachée sous la terre ou le sable${NBSP}: creuse vers le bas pour la trouver.`,
      },
    },
    {
      goal: { kind: "shelter" },
      text: {
        debutant: "Fais un abri avec un toit, puis entre.",
        autonome: `Construis un abri${NBSP}: des murs autour de toi et un toit au-dessus de ta tête. Puis entre dedans.`,
      },
      label: "construire un abri et y entrer",
      holdEvening: true,
    },
    {
      goal: { kind: "collect", block: BlockId.Lamp, count: 1 },
      text: {
        debutant: "Trouve une pierre qui brille.",
        autonome: `Trouve une pierre brillante et casse-la${NBSP}: elle donne une lampe.`,
      },
      label: "trouver une lampe (pierre brillante)",
      icon: BlockId.GlowStone,
      hint: {
        debutant: `Cherche des cristaux bleus${NBSP}!`,
        autonome: `Une pierre brillante est grise avec des cristaux bleus, posée au sol. Promène-toi pour en trouver une.`,
      },
    },
    {
      goal: { kind: "place", block: BlockId.Lamp, count: 1 },
      text: {
        debutant: "Pose la lampe près de ton abri.",
        // Décision 6 de Pierre : la consigne ne dit plus pourquoi la lampe compte (l'enfant le découvre à la nuit).
        autonome: "Pose la lampe près de ton abri, pour y voir clair la nuit.",
      },
      label: "poser la lampe",
      hint: {
        debutant: "Choisis la lampe, puis pose-la.",
        autonome: "Choisis la case de la lampe dans la barre du bas, puis pose-la près de ton abri.",
      },
    },
    {
      goal: { kind: "watch", signal: "lamp-scare" },
      text: {
        debutant: `Reste près de ta lampe. La nuit tombe${NBSP}!`,
        autonome: `Reste près de ta lampe et regarde bien${NBSP}: la nuit tombe. Que vont faire les Grignotes${NBSP}?`,
      },
      label: "voir la lampe éloigner les Grignotes",
    },
  ],
  // Sans « Bravo » : l'écran de félicitations l'affiche déjà en titre, avec le prénom.
  outro: {
    debutant: "Ton abri est prêt pour la nuit.",
    autonome: "Ton abri est prêt pour la nuit, et ta lampe éloigne les Grignotes.",
  },
  recap: [{ block: BlockId.Log, count: 6 }, { block: BlockId.Stone, count: 4 }, { shelter: true }, { block: BlockId.Lamp, count: 1 }],
  reward: { block: BlockId.Rainbow, count: 5 },
};

/** Étape « write » de la mission 2 : textes du mot (ou du prénom), variante de copie, soir retenu. */
function writeStep(source: "list" | "name", tier: 1 | 2 | 3, label: string): StepDef {
  const t = source === "name" ? M2_STEP_NAME : M2_STEP_WORD;
  const copy = source === "name" ? M2_STEP_NAME_COPY : M2_STEP_WORD_COPY;
  return { goal: { kind: "write", source, tier }, text: t.text, ...(t.spoken ? { spoken: t.spoken } : {}), copy, label, holdEvening: true };
}

/**
 * Mission 2 (V2 lot 1) : « Les mots ». Une lettre posée depuis la case ABC, trois mots (copie pour le débutant,
 * dictée pour l'autonome), puis le prénom. Le soir reste à 17 h pendant toute la mission (décision 11 de Pierre).
 */
export const MISSION_2: MissionDef = {
  id: "mots",
  name: "mission 2 (les mots)",
  intro: M2_INTRO,
  steps: [
    {
      goal: { kind: "letter", count: 1 },
      text: M2_STEP_LETTER.text,
      ...(M2_STEP_LETTER.spoken ? { spoken: M2_STEP_LETTER.spoken } : {}),
      touch: M2_STEP_LETTER_TOUCH,
      hint: M2_STEP0_HINT.text,
      ...(M2_STEP0_HINT.spoken ? { hintSpoken: M2_STEP0_HINT.spoken } : {}),
      label: "poser une première lettre (case ABC)",
      holdEvening: true,
    },
    writeStep("list", 1, "écrire un premier mot"),
    writeStep("list", 2, "écrire un deuxième mot"),
    writeStep("list", 3, "écrire un troisième mot"),
    writeStep("name", 3, "écrire son prénom (ou un quatrième mot)"),
  ],
  outro: M2_OUTRO,
  recap: [{ words: true }],
  reward: { block: BlockId.Rainbow, count: 5 },
};

/** Campagne, dans l'ordre. */
export const CAMPAIGN: readonly MissionDef[] = [TUTORIAL, MISSION_1, MISSION_2];
export const MISSIONS = CAMPAIGN;

export function missionById(id: unknown): MissionDef | null {
  return CAMPAIGN.find((m) => m.id === id) ?? null;
}

/** Mission suivante de la campagne, ou null (fin : jeu libre). */
export function nextMission(def: MissionDef): MissionDef | null {
  const i = CAMPAIGN.indexOf(def);
  return i >= 0 ? (CAMPAIGN[i + 1] ?? null) : null;
}

/**
 * Mission à reprendre dans un monde : celle de la progression enregistrée, sinon
 * le tutoriel (ou directement la mission 1 si cet enfant l'a déjà fait dans un
 * autre monde). fresh : aucune progression enregistrée pour cette mission
 * (Pixel se présente, puis lit la première consigne).
 * celebratePending (V2 lot 1) : l'écran de félicitations de la mission finie n'a pas encore été montré (partie
 * quittée juste après la fin) ; on garde alors la mission finie, pour montrer l'écran avant la suite.
 */
export function resumeMission(
  saved: unknown,
  tutorialDone: boolean,
  celebratePending = false,
): { def: MissionDef; saved: unknown; fresh: boolean } {
  const def = missionById(isObj(saved) ? saved.id : null);
  if (def) {
    // Mission finie qui a une suite (tutoriel fini, profil pas enregistré ou fermé avant la suite ; mission 1 finie
    // avec la 1.0-rc) : la suite, sauf si son écran de félicitations attend encore.
    const next = nextMission(def);
    const finished = new MissionRunner(def, saved).done;
    if (next && finished && def.recap && celebratePending) return { def, saved, fresh: false };
    if (next && (finished || (def === TUTORIAL && tutorialDone))) return { def: next, saved: undefined, fresh: true };
    return { def, saved, fresh: false };
  }
  return { def: tutorialDone ? MISSION_1 : TUTORIAL, saved: undefined, fresh: true };
}

/** La dernière mission de la campagne est finie (étoile sur le monde, à l'accueil). */
export function campaignDone(saved: unknown): boolean {
  if (!isObj(saved)) return false;
  const last = CAMPAIGN[CAMPAIGN.length - 1]!;
  return saved.id === last.id && Number.isInteger(saved.step) && (saved.step as number) >= last.steps.length;
}

/**
 * Étoiles d'un monde (accueil, V2 lot 1) : une par mission réussie après le tutoriel. Tutoriel 0 ; abri en cours 0 ;
 * abri fini 1 (l'étoile d'un monde de la 1.0-rc est gardée) ; mots en cours 1 ; mots finis 2.
 */
export function starsEarned(saved: unknown): number {
  const def = missionById(isObj(saved) ? saved.id : null);
  if (!def) return 0;
  const i = CAMPAIGN.indexOf(def);
  const finished = new MissionRunner(def, saved).done;
  return Math.max(0, i - 1) + (finished && i >= 1 ? 1 : 0);
}

/** La boîte à lettres (case ABC) est-elle ouverte à l'enfant ? Dès la mission 2 (et les suivantes) (V2 lot 1). */
export function lettersUnlocked(def: MissionDef | null): boolean {
  return def !== null && CAMPAIGN.indexOf(def) >= CAMPAIGN.indexOf(MISSION_2);
}

/**
 * L'abri de la mission 1 est-il derrière l'enfant (V2 lot 1) ? Mission 1 au-delà de son étape abri (finie comprise :
 * stepIndex vaut alors le nombre d'étapes), ou mission suivante de la campagne ; sans mission, au tutoriel ou hors
 * campagne : non. Le marteau est alors acquis, même jamais présenté ni ouvert (monde de la 1.0-rc dont la mission 1
 * est finie, présentation manquée à l'étape abri) : voir Game.craftAvailable.
 */
export function shelterPassed(def: MissionDef | null, stepIndex: number): boolean {
  if (!def) return false;
  const rank = CAMPAIGN.indexOf(def);
  const m1 = CAMPAIGN.indexOf(MISSION_1);
  if (rank < 0 || rank < m1) return false;
  if (rank > m1) return true;
  const shelter = MISSION_1.steps.findIndex((s) => s.goal.kind === "shelter");
  return shelter >= 0 && stepIndex > shelter;
}

/**
 * Peut-on dire que la lampe éloigne les Grignotes (décision 6 de Pierre : aucun indice avant que l'enfant l'ait vu) ?
 * Sans mission : oui ; tutoriel : non ; mission 1 : seulement finie ; mission 2 et suivantes : oui.
 */
export function lampRevealed(def: MissionDef | null, done: boolean): boolean {
  if (!def) return true;
  if (def === TUTORIAL) return false;
  if (def === MISSION_1) return done;
  return true;
}

/**
 * Mots déjà écrits dans des mondes, pour ne pas les redonner (V2 lot 1) : union des mots valides du champ
 * mission.words des sauvegardes de mondes données (une progression de mission seule, avec son champ words, convient
 * aussi). Entrées absentes ou abîmées : ignorées.
 */
export function wordsSeen(saves: readonly unknown[]): Set<string> {
  const out = new Set<string>();
  for (const save of saves) {
    if (!isObj(save)) continue;
    const progress = isObj(save.mission) ? save.mission : save;
    for (const w of readWords(progress.words)) out.add(w);
  }
  return out;
}

/**
 * Avancement d'un monde, pour l'adulte : « tutoriel : étape 2 sur 3 (casser un bloc) », « mission 1 (l'abri) réussie,
 * mission 2 (les mots) pas encore commencée », « mission 2 (les mots) : étape 3 sur 5 (…) — mots écrits : AMI ».
 */
export function progressLabel(saved: unknown): string {
  const def = missionById(isObj(saved) ? saved.id : null);
  if (!def) return "pas encore commencé";
  const m = new MissionRunner(def, saved);
  const step = m.stepIndex;
  const written = m.words.length > 0 ? ` — mots écrits : ${m.words.join(", ")}` : "";
  if (step >= def.steps.length) {
    // Mission finie qui a une suite : le monde reprendra à la suite (voir resumeMission). Après le tutoriel, on parle
    // directement de la suite ; après une vraie mission, on dit qu'elle est réussie.
    const next = nextMission(def);
    if (next && def === TUTORIAL) return `${next.name} : étape 1 sur ${next.steps.length} (${next.steps[0]?.label ?? ""})`;
    if (next) return `${def.name} réussie, ${next.name} pas encore commencée`;
    return `${def.name} réussie${written}`;
  }
  return `${def.name} : étape ${step + 1} sur ${def.steps.length} (${def.steps[step]?.label ?? ""})${written}`;
}

/** Contexte d'une consigne d'écriture (V2 lot 1) : mode de l'étape, variables du mot, prénom inutilisable. */
export interface StepTextContext {
  mode: WriteMode;
  vars: WordVars;
  /** Étape « prénom » sans prénom écrivable : les textes d'un mot de la liste servent. */
  nameFallback?: boolean;
}

/**
 * Consigne d'une étape selon l'appareil : au doigt, la variante tactile si elle existe.
 * Avec ctx (étape d'écriture, V2 lot 1) :
 * - étape « prénom » avec nameFallback : les textes d'un mot de la liste (M2_STEP_WORD) ;
 * - en copie, la variante `copy` sert au lecteur autonome (le débutant garde la sienne : il est toujours en copie) ;
 * - les gabarits sont remplis par fillWord(…, ctx.vars).
 */
export function stepText(step: StepDef, touch: boolean, ctx?: StepTextContext): { text: ChildText; spoken: ChildText } {
  const fallback = ctx?.nameFallback === true && step.goal.kind === "write" && step.goal.source === "name";
  const base: StepText = fallback ? M2_STEP_WORD : touch && step.touch ? step.touch : step;
  let text = base.text;
  let spoken = base.spoken ?? base.text;
  if (!ctx) return { text, spoken };
  const copy = fallback ? M2_STEP_WORD_COPY : step.copy;
  if (ctx.mode === "copy" && copy) {
    text = { debutant: text.debutant, autonome: copy.text.autonome };
    spoken = { debutant: spoken.debutant, autonome: (copy.spoken ?? copy.text).autonome };
  }
  return { text: fillWord(text, ctx.vars), spoken: fillWord(spoken, ctx.vars) };
}

export class MissionRunner {
  private step: number;
  private counts: Record<string, number>;
  /** Mots écrits dans cette mission (V2 lot 1). */
  private written: string[];
  /** Mot de l'étape « write » en cours (V2 lot 1). */
  private word: string | undefined;

  constructor(
    readonly def: MissionDef,
    saved?: unknown,
  ) {
    const p = readProgress(saved, def);
    this.step = p.step;
    this.counts = p.counts;
    this.written = p.words;
    this.word = this.current()?.goal.kind === "write" ? p.word : undefined;
  }

  get stepIndex(): number {
    return this.step;
  }

  get done(): boolean {
    return this.step >= this.def.steps.length;
  }

  current(): StepDef | null {
    return this.def.steps[this.step] ?? null;
  }

  /** Mot de l'étape « write » en cours (fixé par prepare), sinon null (V2 lot 1). */
  get target(): string | null {
    return this.current()?.goal.kind === "write" ? (this.word ?? null) : null;
  }

  /** Mots écrits dans cette mission, dans l'ordre (V2 lot 1). */
  get words(): readonly string[] {
    return this.written;
  }

  /**
   * Fixe le mot de l'étape « write » en cours (V2 lot 1) ; rien pour une autre étape (null). Le mot enregistré est
   * gardé s'il convient encore : dans la liste du niveau, ou, pour l'étape « prénom », égal au prénom écrivable.
   * Sinon : le prénom écrivable (étape « prénom »), ou un mot tiré au sort dans le palier (graine × 31 + étape), hors
   * des mots à éviter, des mots déjà écrits et du prénom écrivable (demandé à la fin : déjà posé dans le monde, il
   * validerait l'étape « prénom » d'emblée).
   */
  prepare(ctx: WordContext): string | null {
    const g = this.current()?.goal;
    if (g?.kind !== "write") return null;
    const name = nameWord(ctx.name);
    const saved = this.word;
    const kept =
      saved !== undefined && (wordList(ctx.level).some((e) => e.text === saved) || (g.source === "name" && saved === name));
    if (!kept) {
      if (g.source === "name" && name !== null) this.word = name;
      else {
        const exclude = new Set([...ctx.exclude, ...this.written, ...(name !== null ? [name] : [])]);
        this.word = pickWord(ctx.level, g.tier, exclude, ctx.seed * 31 + this.step).text;
      }
    }
    return this.word ?? null;
  }

  /** Un mot a été lu dans le monde (V2 lot 1) : l'étape est validée s'il s'agit du mot attendu. */
  noteWord(text: string): void {
    const target = this.target;
    if (target !== null && text === target) this.counts.written = 1;
  }

  /** Un essai de la dictée a reçu un retour (V2 lot 1). */
  noteTry(): void {
    if (this.current()?.goal.kind !== "write") return;
    this.counts.tries = (this.counts.tries ?? 0) + 1;
  }

  /** Palier d'aide en cours, lettres dévoilées, passage en copie (V2 lot 1, relus à la reprise). */
  noteHelp(h: { stage: number; revealed: number; copy: boolean }): void {
    if (this.current()?.goal.kind !== "write") return;
    const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    this.counts.help = n(h.stage);
    this.counts.revealed = n(h.revealed);
    this.counts.copy = h.copy ? 1 : 0;
  }

  /** Aide enregistrée pour l'étape « write » en cours (V2 lot 1). */
  help(): { stage: number; revealed: number; copy: boolean } {
    return { stage: this.counts.help ?? 0, revealed: this.counts.revealed ?? 0, copy: this.counts.copy === 1 };
  }

  /** Avancement de l'étape en cours (have ≤ need), ou null si la mission est finie. */
  progress(view: MissionView): { have: number; need: number } | null {
    const s = this.current();
    if (!s) return null;
    const g = s.goal;
    switch (g.kind) {
      case "collect":
        return clampProgress(view.count(g.block), g.count);
      case "place":
      case "break":
        return clampProgress(this.counts[`${g.kind}:${String(g.block)}`] ?? 0, g.count);
      case "walk":
        return clampProgress(Math.floor(this.counts.walk ?? 0), g.distance);
      case "shelter": {
        const c = view.shelter?.() ?? null;
        if (!c) return { have: 0, need: SHELTER_PARTS };
        const parts = (c.roof ? 1 : 0) + Math.min(c.walls, SHELTER_PARTS - 1);
        return { have: c.ok ? SHELTER_PARTS : Math.min(parts, SHELTER_PARTS - 1), need: SHELTER_PARTS };
      }
      case "watch":
        return clampProgress(this.counts[`signal:${g.signal}`] ?? 0, 1);
      case "letter":
        return clampProgress(this.counts["place:letter"] ?? 0, g.count);
      case "write":
        return { have: this.counts.written ? 1 : 0, need: 1 };
    }
  }

  /** Un bloc a été posé par l'enfant. */
  notePlaced(id: BlockId): void {
    this.bump("place", id);
  }

  /** Un bloc a été cassé par l'enfant (J6). */
  noteBroken(id: BlockId): void {
    this.bump("break", id);
  }

  /** L'enfant a marché (distance horizontale, en blocs) (J6). */
  noteWalked(distance: number): void {
    if (this.done || !(distance > 0) || !Number.isFinite(distance)) return;
    this.counts.walk = (this.counts.walk ?? 0) + distance;
  }

  /** Le jeu a observé un signal (J6). Compté seulement pendant une étape qui l'attend. */
  noteSignal(signal: MissionSignal): void {
    const g = this.current()?.goal;
    if (g?.kind === "watch" && g.signal === signal) this.counts[`signal:${signal}`] = 1;
  }

  /** Fait avancer la mission selon l'état du jeu ; renvoie l'événement éventuel (une étape à la fois). */
  update(view: MissionView): MissionEvent | null {
    const p = this.progress(view);
    if (!p || p.have < p.need) return null;
    // Étape d'écriture validée : son mot rejoint les mots écrits (V2 lot 1).
    const target = this.target;
    if (target !== null && !this.written.includes(target) && this.written.length < MAX_WORDS) this.written.push(target);
    this.word = undefined;
    this.step++;
    this.counts = {};
    return this.done ? { kind: "done" } : { kind: "step", index: this.step };
  }

  toJSON(): MissionProgress {
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.counts)) counts[k] = k === "walk" ? Math.round(v * 100) / 100 : v;
    return {
      id: this.def.id,
      step: this.step,
      counts,
      ...(this.written.length > 0 ? { words: [...this.written] } : {}),
      ...(this.word !== undefined ? { word: this.word } : {}),
    };
  }

  private bump(kind: "place" | "break", id: BlockId): void {
    if (this.done) return;
    const keys = [`${kind}:any`, `${kind}:${String(id)}`];
    // Bloc-lettre posé (V2 lot 1) : compté aussi pour l'objectif « letter ».
    if (kind === "place" && isLetterId(id)) keys.push("place:letter");
    for (const key of keys) this.counts[key] = (this.counts[key] ?? 0) + 1;
  }
}

function clampProgress(have: number, need: number): { have: number; need: number } {
  return { have: Math.min(have, need), need };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Mots enregistrés (V2 lot 1), relus de façon robuste : les chaînes de 2 à 10 capitales A–Z, sans doublon, dans
 * l'ordre, 10 au plus ; les autres entrées sont ignorées ; autre chose qu'un tableau : aucun mot.
 */
function readWords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const words: string[] = [];
  for (const w of raw as unknown[]) {
    if (words.length >= MAX_WORDS) break;
    if (typeof w === "string" && WORD_RE.test(w) && !words.includes(w)) words.push(w);
  }
  return words;
}

function readProgress(raw: unknown, def: MissionDef): { step: number; counts: Record<string, number>; words: string[]; word: string | undefined } {
  if (!isObj(raw) || raw.id !== def.id) return { step: 0, counts: {}, words: [], word: undefined };
  const step = Number.isInteger(raw.step) ? Math.max(0, Math.min(def.steps.length, raw.step as number)) : 0;
  const counts: Record<string, number> = {};
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (isObj(raw.counts)) {
    for (const [k, v] of Object.entries(raw.counts)) if (ok(v)) counts[k] = v;
  } else if (isObj(raw.placed)) {
    // Format du J5 : { placed: { any: 3, "13": 1 } } → « place:any », « place:13 ».
    for (const [k, v] of Object.entries(raw.placed)) if (ok(v) && Number.isInteger(v)) counts[`place:${k}`] = v;
  }
  const word = typeof raw.word === "string" && WORD_RE.test(raw.word) ? raw.word : undefined;
  return { step, counts, words: readWords(raw.words), word };
}
