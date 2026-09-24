import { BlockId } from "../engine/blocks";
import { NBSP, type ChildText } from "./texts";

/**
 * Moteur de missions (J5, pur) : une mission est une suite d'étapes décrites par
 * des données (objectif, textes en deux variantes, forme écrite et forme dite).
 * Le jeu observe son état (sac, blocs posés) et le moteur fait avancer la
 * mission ; le compagnon porte les textes. Aucun échec possible : une étape
 * attend simplement que l'enfant y arrive.
 */

export type Goal =
  /** Avoir au moins `count` blocs de ce type dans le sac. */
  | { kind: "collect"; block: BlockId; count: number }
  /** Poser `count` blocs (de ce type, ou n'importe lesquels) depuis le début de l'étape. */
  | { kind: "place"; block: BlockId | "any"; count: number };

export interface StepDef {
  goal: Goal;
  /** Consigne écrite (chiffres). */
  text: ChildText;
  /** Consigne dite (nombres en lettres) ; par défaut, la consigne écrite. */
  spoken?: ChildText;
}

export interface MissionDef {
  id: string;
  intro: ChildText;
  steps: readonly StepDef[];
  outro: ChildText;
}

/** Progression enregistrée (dans la sauvegarde du monde). */
export interface MissionProgress {
  id: string;
  step: number;
  /** Blocs posés depuis le début de l'étape en cours, par type (clé « any » : tous types). */
  placed: Record<string, number>;
}

export interface MissionView {
  count(id: BlockId): number;
}

export type MissionEvent = { kind: "step"; index: number } | { kind: "done" };

export const BRAVO: ChildText = { debutant: `Bravo${NBSP}!`, autonome: `Bravo, c'est fait${NBSP}!` };

/** Mission 1 (première version, J5 ; tutoriel et finitions au J6). */
export const MISSION_1: MissionDef = {
  id: "abri",
  intro: {
    debutant: `Je suis Pixel${NBSP}! Construisons une cabane avant la nuit.`,
    autonome: `Bonjour, je suis Pixel, ton renard. Construisons une cabane avant la nuit${NBSP}!`,
  },
  steps: [
    {
      goal: { kind: "collect", block: BlockId.Log, count: 6 },
      text: { debutant: "Ramasse 6 troncs.", autonome: "Casse des troncs d'arbre pour en ramasser 6." },
      spoken: { debutant: "Ramasse six troncs.", autonome: "Casse des troncs d'arbre pour en ramasser six." },
    },
    {
      goal: { kind: "collect", block: BlockId.Stone, count: 4 },
      text: { debutant: "Ramasse 4 pierres.", autonome: "Casse des pierres grises pour en ramasser 4." },
      spoken: { debutant: "Ramasse quatre pierres.", autonome: "Casse des pierres grises pour en ramasser quatre." },
    },
    {
      goal: { kind: "place", block: "any", count: 10 },
      text: { debutant: `Construis ta cabane${NBSP}: pose 10 blocs.`, autonome: `Construis ta cabane${NBSP}: pose 10 blocs de ton sac.` },
      spoken: { debutant: `Construis ta cabane${NBSP}: pose dix blocs.`, autonome: `Construis ta cabane${NBSP}: pose dix blocs de ton sac.` },
    },
    {
      goal: { kind: "collect", block: BlockId.Lamp, count: 1 },
      text: {
        debutant: "Trouve une pierre qui brille.",
        autonome: `Trouve une pierre brillante et casse-la${NBSP}: elle donne une lampe.`,
      },
    },
    {
      goal: { kind: "place", block: BlockId.Lamp, count: 1 },
      text: {
        debutant: "Pose la lampe près de ta cabane.",
        autonome: `Pose la lampe près de ta cabane${NBSP}: les Grignotes n'aiment pas la lumière.`,
      },
    },
  ],
  outro: {
    debutant: `Bravo${NBSP}! Ta cabane est prête.`,
    autonome: `Bravo${NBSP}! Ta cabane est prête pour la nuit, et la lampe éloigne les Grignotes.`,
  },
};

export const MISSIONS: readonly MissionDef[] = [MISSION_1];

export class MissionRunner {
  private step: number;
  private placed: Record<string, number>;

  constructor(
    readonly def: MissionDef,
    saved?: unknown,
  ) {
    const p = readProgress(saved, def);
    this.step = p.step;
    this.placed = p.placed;
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
    const have = g.kind === "collect" ? view.count(g.block) : (this.placed[String(g.block)] ?? 0);
    return { have: Math.min(have, g.count), need: g.count };
  }

  /** Un bloc a été posé par l'enfant. */
  notePlaced(id: BlockId): void {
    if (this.done) return;
    this.placed.any = (this.placed.any ?? 0) + 1;
    this.placed[String(id)] = (this.placed[String(id)] ?? 0) + 1;
  }

  /** Fait avancer la mission selon l'état du jeu ; renvoie l'événement éventuel (une étape à la fois). */
  update(view: MissionView): MissionEvent | null {
    const p = this.progress(view);
    if (!p || p.have < p.need) return null;
    this.step++;
    this.placed = {};
    return this.done ? { kind: "done" } : { kind: "step", index: this.step };
  }

  toJSON(): MissionProgress {
    return { id: this.def.id, step: this.step, placed: { ...this.placed } };
  }
}

function readProgress(raw: unknown, def: MissionDef): { step: number; placed: Record<string, number> } {
  if (typeof raw !== "object" || raw === null) return { step: 0, placed: {} };
  const r = raw as Record<string, unknown>;
  if (r.id !== def.id) return { step: 0, placed: {} };
  const step = Number.isInteger(r.step) ? Math.max(0, Math.min(def.steps.length, r.step as number)) : 0;
  const placed: Record<string, number> = {};
  if (typeof r.placed === "object" && r.placed !== null) {
    for (const [k, v] of Object.entries(r.placed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isInteger(v) && v >= 0) placed[k] = v;
    }
  }
  return { step, placed };
}
