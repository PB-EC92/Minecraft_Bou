import { BlockId } from "../engine/blocks";
import type { ShelterCheck } from "../engine/shelter";
import { NBSP, type ChildText } from "./texts";

/**
 * Moteur de missions (J5, pur ; J6 : tutoriel et mission 1 complète) : une
 * mission est une suite d'étapes décrites par des données (objectif, textes en
 * deux variantes, forme écrite et forme dite, consigne propre au doigt). Le jeu
 * observe son état (sac, blocs posés et cassés, pas, abri, créatures) et le
 * moteur fait avancer la mission ; le compagnon porte les textes. Aucun échec
 * possible : une étape attend simplement que l'enfant y arrive.
 *
 * Campagne de la V1 : le tutoriel (mission 0, une fois par enfant), puis la
 * mission 1 « Construis un abri avant la nuit ».
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
  | { kind: "watch"; signal: MissionSignal };

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
}

/** Ligne du récapitulatif de l'écran de félicitations : un bloc et son nombre, ou l'abri. */
export type RecapItem = { block: BlockId; count: number } | { shelter: true };

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
   * « break:any », « break:3 », « walk » (blocs parcourus), « signal:lamp-scare ».
   */
  counts: Record<string, number>;
}

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
      hint: {
        debutant: `Cherche un arbre${NBSP}!`,
        autonome: `Les troncs sont le bois des arbres${NBSP}: approche-toi d'un arbre, vise le tronc et garde l'appui. Dans le désert, les arbres sont rares${NBSP}: va plus loin.`,
      },
    },
    {
      goal: { kind: "collect", block: BlockId.Stone, count: 4 },
      text: { debutant: "Ramasse 4 pierres.", autonome: "Casse des pierres grises pour en ramasser 4." },
      spoken: { debutant: "Ramasse quatre pierres.", autonome: "Casse des pierres grises pour en ramasser quatre." },
      label: "ramasser 4 pierres",
      // Recette J7 : hors des montagnes, la pierre n'est jamais en surface (sous 4 à 5 blocs d'herbe, de terre ou de sable).
      hint: {
        debutant: `Creuse${NBSP}: la pierre est dessous${NBSP}!`,
        autonome: `La pierre grise est cachée sous l'herbe et la terre${NBSP}: creuse vers le bas pour la trouver.`,
      },
    },
    {
      goal: { kind: "shelter" },
      text: {
        debutant: "Fais un abri avec un toit, puis entre.",
        autonome: `Construis un abri${NBSP}: des murs autour de toi et un toit au-dessus de ta tête. Puis entre dedans.`,
      },
      label: "construire un abri et y entrer",
    },
    {
      goal: { kind: "collect", block: BlockId.Lamp, count: 1 },
      text: {
        debutant: "Trouve une pierre qui brille.",
        autonome: `Trouve une pierre brillante et casse-la${NBSP}: elle donne une lampe.`,
      },
      label: "trouver une lampe (pierre brillante)",
      hint: {
        debutant: `Cherche des cristaux bleus${NBSP}!`,
        autonome: `Une pierre brillante est grise avec des cristaux bleus, posée au sol. Promène-toi pour en trouver une.`,
      },
    },
    {
      goal: { kind: "place", block: BlockId.Lamp, count: 1 },
      text: {
        debutant: "Pose la lampe près de ton abri.",
        autonome: `Pose la lampe près de ton abri${NBSP}: les Grignotes n'aiment pas la lumière.`,
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

/** Campagne de la V1, dans l'ordre. */
export const CAMPAIGN: readonly MissionDef[] = [TUTORIAL, MISSION_1];
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
 */
export function resumeMission(saved: unknown, tutorialDone: boolean): { def: MissionDef; saved: unknown; fresh: boolean } {
  const def = missionById(isObj(saved) ? saved.id : null);
  if (def) {
    // Mission finie qui a une suite (tutoriel fini, profil pas enregistré ou fermé avant la suite) : la suite.
    const next = nextMission(def);
    const finished = new MissionRunner(def, saved).done;
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

/** Avancement d'un monde, pour l'adulte : « tutoriel : étape 2 sur 3 (casser un bloc) », « mission 1 (l'abri) réussie ». */
export function progressLabel(saved: unknown): string {
  const def = missionById(isObj(saved) ? saved.id : null);
  if (!def) return "pas encore commencé";
  const step = new MissionRunner(def, saved).stepIndex;
  if (step >= def.steps.length) {
    // Mission finie qui a une suite (tutoriel) : le monde reprendra à la suite (voir resumeMission).
    const next = nextMission(def);
    if (next) return `${next.name} : étape 1 sur ${next.steps.length} (${next.steps[0]?.label ?? ""})`;
    return `${def.name} réussie`;
  }
  return `${def.name} : étape ${step + 1} sur ${def.steps.length} (${def.steps[step]?.label ?? ""})`;
}

/** Consigne d'une étape selon l'appareil : au doigt, la variante tactile si elle existe. */
export function stepText(step: StepDef, touch: boolean): { text: ChildText; spoken: ChildText } {
  const t = touch && step.touch ? step.touch : step;
  return { text: t.text, spoken: t.spoken ?? t.text };
}

export class MissionRunner {
  private step: number;
  private counts: Record<string, number>;

  constructor(
    readonly def: MissionDef,
    saved?: unknown,
  ) {
    const p = readProgress(saved, def);
    this.step = p.step;
    this.counts = p.counts;
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
    this.step++;
    this.counts = {};
    return this.done ? { kind: "done" } : { kind: "step", index: this.step };
  }

  toJSON(): MissionProgress {
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.counts)) counts[k] = k === "walk" ? Math.round(v * 100) / 100 : v;
    return { id: this.def.id, step: this.step, counts };
  }

  private bump(kind: "place" | "break", id: BlockId): void {
    if (this.done) return;
    for (const key of [`${kind}:any`, `${kind}:${String(id)}`]) this.counts[key] = (this.counts[key] ?? 0) + 1;
  }
}

function clampProgress(have: number, need: number): { have: number; need: number } {
  return { have: Math.min(have, need), need };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function readProgress(raw: unknown, def: MissionDef): { step: number; counts: Record<string, number> } {
  if (!isObj(raw) || raw.id !== def.id) return { step: 0, counts: {} };
  const step = Number.isInteger(raw.step) ? Math.max(0, Math.min(def.steps.length, raw.step as number)) : 0;
  const counts: Record<string, number> = {};
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (isObj(raw.counts)) {
    for (const [k, v] of Object.entries(raw.counts)) if (ok(v)) counts[k] = v;
  } else if (isObj(raw.placed)) {
    // Format du J5 : { placed: { any: 3, "13": 1 } } → « place:any », « place:13 ».
    for (const [k, v] of Object.entries(raw.placed)) if (ok(v) && Number.isInteger(v)) counts[`place:${k}`] = v;
  }
  return { step, counts };
}
