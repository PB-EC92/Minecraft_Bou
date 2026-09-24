import { describe, expect, it } from "vitest";
import { BLOCKS, BlockId, breakDurationMs, dropsOf } from "../../src/engine/blocks";
import { BreakTracker, REPEAT_GAP_MS, samePos, type BlockPos, type BreakStep } from "../../src/engine/breaking";

const P: BlockPos = { x: 3, y: 2, z: 5 };
const Q: BlockPos = { x: 3, y: 1, z: 5 };
const R: BlockPos = { x: 4, y: 1, z: 5 };

/** Appelle update `frames` fois et renvoie toutes les étapes. */
function hold(t: BreakTracker, target: BlockPos | null, durationMs: number, dtMs: number, frames: number): BreakStep[] {
  const steps: BreakStep[] = [];
  for (let i = 0; i < frames; i++) steps.push(t.update(true, target, durationMs, dtMs));
  return steps;
}

function progressOf(step: BreakStep): number {
  if (step.kind !== "progress") throw new Error(`étape « ${step.kind} » au lieu de « progress »`);
  return step.progress;
}

/** Casse P (durée 0) pour se placer dans l'état « une casse a eu lieu pendant cet appui ». */
function breakOnce(t: BreakTracker, pos: BlockPos = P): void {
  const step = t.update(true, pos, 0, 16);
  expect(step).toEqual({ kind: "done", pos });
}

describe("breakDurationMs", () => {
  it("renvoie les durées prévues pour chaque bloc", () => {
    const expected: Record<number, number> = {
      [BlockId.Air]: 0,
      [BlockId.Grass]: 350,
      [BlockId.Dirt]: 350,
      [BlockId.Stone]: 650,
      [BlockId.Planks]: 500,
      [BlockId.Sand]: 300,
      [BlockId.Log]: 550,
      [BlockId.Water]: 0,
      [BlockId.Leaves]: 200,
      [BlockId.FlowerRed]: 150,
      [BlockId.FlowerYellow]: 150,
      [BlockId.Snow]: 300,
      [BlockId.Cactus]: 450,
      [BlockId.Lamp]: 250,
      [BlockId.Fence]: 400,
      [BlockId.GlowStone]: 500,
    };
    for (const d of BLOCKS) {
      expect(breakDurationMs(d.id), d.name).toBe(expected[d.id]);
      expect(d.breakMs, d.name).toBe(expected[d.id]);
    }
  });

  it("une fleur se cueille vite mais pas sur un clic bref (casses accidentelles), la pierre résiste plus que l'herbe", () => {
    expect(breakDurationMs(BlockId.FlowerRed)).toBeGreaterThan(0);
    expect(breakDurationMs(BlockId.FlowerRed)).toBeLessThan(breakDurationMs(BlockId.Leaves));
    expect(breakDurationMs(BlockId.FlowerYellow)).toBe(breakDurationMs(BlockId.FlowerRed));
    expect(breakDurationMs(BlockId.Stone)).toBeGreaterThan(breakDurationMs(BlockId.Grass));
  });

  it("identifiant inconnu → 0", () => {
    expect(breakDurationMs(BLOCKS.length)).toBe(0);
    expect(breakDurationMs(200)).toBe(0);
    expect(breakDurationMs(-1)).toBe(0);
    expect(breakDurationMs(1.5)).toBe(0);
    expect(breakDurationMs(Number.NaN)).toBe(0);
  });

  it("toutes les durées sont finies et positives ou nulles", () => {
    for (const d of BLOCKS) {
      expect(Number.isFinite(d.breakMs), d.name).toBe(true);
      expect(d.breakMs, d.name).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("BreakTracker — progression", () => {
  it("commence au repos", () => {
    const t = new BreakTracker();
    expect(t.progress).toBe(0);
    expect(t.target).toBeNull();
  });

  it("accumule le temps d'appui sur plusieurs images puis casse", () => {
    const t = new BreakTracker();
    const steps = hold(t, P, 500, 100, 4);
    expect(steps.map(progressOf)).toEqual([0.2, 0.4, 0.6, 0.8].map((v) => expect.closeTo(v, 10)));
    expect(t.progress).toBeCloseTo(0.8, 10);
    expect(t.target).toEqual(P);
    expect(t.update(true, P, 500, 100)).toEqual({ kind: "done", pos: P });
    expect(t.progress).toBe(0);
    expect(t.target).toBeNull();
  });

  it("casse exactement quand elapsed atteint la durée", () => {
    const t = new BreakTracker();
    expect(t.update(true, P, 300, 150).kind).toBe("progress");
    expect(t.update(true, P, 300, 150)).toEqual({ kind: "done", pos: P });
  });

  it("le premier update ajoute déjà dtMs (une longue image peut casser d'un coup)", () => {
    const t = new BreakTracker();
    expect(progressOf(t.update(true, P, 400, 100))).toBeCloseTo(0.25, 10);
    const t2 = new BreakTracker();
    expect(t2.update(true, P, 400, 400)).toEqual({ kind: "done", pos: P });
  });

  it("compare les cibles par coordonnées, pas par référence", () => {
    const t = new BreakTracker();
    t.update(true, { x: 3, y: 2, z: 5 }, 400, 100);
    const step = t.update(true, { x: 3, y: 2, z: 5 }, 400, 100);
    expect(progressOf(step)).toBeCloseTo(0.5, 10);
  });

  it("accepte un résultat de visée complet (champs en plus) et ne renvoie que x, y, z", () => {
    const t = new BreakTracker();
    const hit = { x: 1, y: 2, z: 3, nx: 0, ny: 1, nz: 0, distance: 2.5 };
    const step = t.update(true, hit, 0, 16);
    expect(step).toEqual({ kind: "done", pos: { x: 1, y: 2, z: 3 } });
  });

  it("copie la cible : modifier l'objet passé ne change pas la casse en cours", () => {
    const t = new BreakTracker();
    const target = { x: 3, y: 2, z: 5 };
    t.update(true, target, 400, 100);
    target.x = 99;
    const seen = t.target;
    expect(seen).toEqual(P);
    seen!.y = -7; // la copie renvoyée n'est pas l'état interne
    expect(t.target).toEqual(P);
    // L'objet modifié est désormais une autre cible : on repart de zéro.
    expect(progressOf(t.update(true, target, 400, 100))).toBeCloseTo(0.25, 10);
  });

  it("la position renvoyée par « done » est une copie", () => {
    const t = new BreakTracker();
    const target = { x: 3, y: 2, z: 5 };
    const step = t.update(true, target, 0, 16);
    expect(step.kind).toBe("done");
    if (step.kind === "done") {
      expect(step.pos).not.toBe(target);
      expect(step.pos).toEqual(P);
    }
  });
});

describe("BreakTracker — relâcher et changer de cible", () => {
  it("relâcher remet à zéro", () => {
    const t = new BreakTracker();
    hold(t, P, 500, 100, 3);
    expect(t.update(false, P, 500, 100)).toEqual({ kind: "idle" });
    expect(t.progress).toBe(0);
    expect(t.target).toBeNull();
    // Nouvel appui : on repart de zéro.
    expect(progressOf(t.update(true, P, 500, 100))).toBeCloseTo(0.2, 10);
  });

  it("une cible nulle remet à zéro comme un relâchement", () => {
    const t = new BreakTracker();
    hold(t, P, 500, 100, 3);
    expect(t.update(true, null, 500, 100)).toEqual({ kind: "idle" });
    expect(t.progress).toBe(0);
    expect(t.target).toBeNull();
    expect(progressOf(t.update(true, P, 500, 100))).toBeCloseTo(0.2, 10);
  });

  it("changer de cible recommence la casse", () => {
    const t = new BreakTracker();
    hold(t, P, 500, 100, 4); // 80 % sur P
    expect(progressOf(t.update(true, Q, 500, 100))).toBeCloseTo(0.2, 10);
    expect(t.target).toEqual(Q);
    // Revenir sur P ne reprend pas l'ancienne progression.
    expect(progressOf(t.update(true, P, 500, 100))).toBeCloseTo(0.2, 10);
  });

  it("reset() efface tout : casse en cours, verrou et écart", () => {
    const t = new BreakTracker();
    breakOnce(t);
    t.reset();
    expect(t.progress).toBe(0);
    expect(t.target).toBeNull();
    // Plus de verrou sur P, plus d'écart : la casse immédiate repart.
    expect(t.update(true, P, 0, 16)).toEqual({ kind: "done", pos: P });
    t.reset();
    expect(t.update(true, Q, 200, 200)).toEqual({ kind: "done", pos: Q });
  });
});

describe("BreakTracker — durée nulle", () => {
  it("casse immédiatement au premier update, même avec dt = 0", () => {
    const t = new BreakTracker();
    expect(t.update(true, P, 0, 0)).toEqual({ kind: "done", pos: P });
  });

  it("durée négative traitée comme immédiate", () => {
    const t = new BreakTracker();
    expect(t.update(true, P, -50, 16)).toEqual({ kind: "done", pos: P });
  });

  it("durée d'une fleur (breakDurationMs) : un clic bref de 50 ms ne la cueille pas, 150 ms oui", () => {
    const t = new BreakTracker();
    const d = breakDurationMs(BlockId.FlowerRed);
    expect(t.update(true, P, d, 50).kind).toBe("progress");
    expect(t.update(true, P, d, 100)).toEqual({ kind: "done", pos: P });
  });
});

describe("BreakTracker — verrou après une casse", () => {
  it("ne renvoie plus « done » tant que la même cible reste visée (casse refusée par le jeu)", () => {
    const t = new BreakTracker();
    breakOnce(t);
    const steps = hold(t, P, 0, 100, 50);
    expect(steps.every((s) => s.kind === "idle")).toBe(true);
    expect(t.progress).toBe(0);
    expect(t.target).toBeNull();
  });

  it("verrou aussi pour un bloc à durée non nulle", () => {
    const t = new BreakTracker();
    hold(t, P, 300, 100, 2);
    expect(t.update(true, P, 300, 100)).toEqual({ kind: "done", pos: P });
    const steps = hold(t, P, 300, 100, 20);
    expect(steps.every((s) => s.kind === "idle")).toBe(true);
  });

  it("viser ailleurs lève le verrou (avec l'écart de répétition)", () => {
    const t = new BreakTracker();
    breakOnce(t);
    hold(t, P, 0, 100, 3);
    const step = t.update(true, Q, 300, 100);
    expect(progressOf(step)).toBe(0); // −150 + 100 : encore dans l'écart
    expect(t.target).toEqual(Q);
  });

  it("quitter la cible verrouillée puis y revenir la recasse, après l'écart", () => {
    const t = new BreakTracker();
    breakOnce(t);
    t.update(true, Q, 300, 16); // on quitte P
    expect(progressOf(t.update(true, P, 0, 100))).toBe(0); // −150 + 100
    expect(t.update(true, P, 0, 50)).toEqual({ kind: "done", pos: P });
  });

  it("perdre la cible sans relâcher lève aussi le verrou", () => {
    const t = new BreakTracker();
    breakOnce(t);
    expect(t.update(true, P, 0, 16)).toEqual({ kind: "idle" }); // verrouillé
    expect(t.update(true, null, 0, 16)).toEqual({ kind: "idle" });
    // Remise à zéro complète : ni verrou, ni écart de répétition.
    expect(t.update(true, P, 0, 0)).toEqual({ kind: "done", pos: P });
  });

  it("relâcher puis rappuyer sur la même cible lève le verrou", () => {
    const t = new BreakTracker();
    breakOnce(t);
    expect(t.update(true, P, 0, 16)).toEqual({ kind: "idle" });
    t.update(false, P, 0, 16);
    expect(t.update(true, P, 0, 16)).toEqual({ kind: "done", pos: P });
  });
});

describe("BreakTracker — écart de répétition", () => {
  it("la cible suivante ne casse pas avant REPEAT_GAP_MS + durée", () => {
    const duration = breakDurationMs(BlockId.Grass); // 350
    const t = new BreakTracker();
    breakOnce(t);
    const dt = 10;
    let total = 0;
    let step: BreakStep = { kind: "idle" };
    while (total < REPEAT_GAP_MS + duration - dt) {
      step = t.update(true, Q, duration, dt);
      total += dt;
      expect(step.kind, `à ${total} ms`).toBe("progress");
    }
    step = t.update(true, Q, duration, dt);
    total += dt;
    expect(total).toBe(REPEAT_GAP_MS + duration);
    expect(step).toEqual({ kind: "done", pos: Q });
  });

  it("progress vaut 0 pendant l'écart, puis augmente", () => {
    const t = new BreakTracker();
    breakOnce(t);
    expect(progressOf(t.update(true, Q, 400, 50))).toBe(0); // −100
    expect(t.progress).toBe(0);
    expect(progressOf(t.update(true, Q, 400, 50))).toBe(0); // −50
    expect(progressOf(t.update(true, Q, 400, 50))).toBe(0); // 0
    expect(progressOf(t.update(true, Q, 400, 100))).toBeCloseTo(0.25, 10); // 100
  });

  it("bloc immédiat après une casse : attend REPEAT_GAP_MS", () => {
    const t = new BreakTracker();
    breakOnce(t);
    expect(progressOf(t.update(true, Q, 0, 100))).toBe(0);
    expect(progressOf(t.update(true, Q, 0, 49))).toBe(0);
    expect(t.update(true, Q, 0, 1)).toEqual({ kind: "done", pos: Q });
  });

  it("enchaîne plusieurs casses en gardant l'appui, chacune après l'écart", () => {
    const t = new BreakTracker();
    breakOnce(t, P);
    const doneAt: number[] = [];
    let time = 0;
    const targets = [Q, R];
    for (const target of targets) {
      for (let i = 0; i < 100; i++) {
        time += 25;
        const s = t.update(true, target, 200, 25);
        if (s.kind === "done") {
          doneAt.push(time);
          break;
        }
      }
    }
    expect(doneAt).toEqual([REPEAT_GAP_MS + 200, 2 * (REPEAT_GAP_MS + 200)]);
  });

  it("changer de cible pendant l'appui après une casse remet l'écart", () => {
    const t = new BreakTracker();
    breakOnce(t);
    hold(t, Q, 300, 100, 3); // −150 + 300 = 150 : 50 %
    expect(t.progress).toBeCloseTo(0.5, 10);
    expect(progressOf(t.update(true, R, 300, 100))).toBe(0); // repart à −150 + 100
  });

  it("relâcher efface l'écart", () => {
    const t = new BreakTracker();
    breakOnce(t);
    t.update(false, null, 0, 16);
    expect(t.update(true, Q, 200, 200)).toEqual({ kind: "done", pos: Q });
    t.update(false, Q, 0, 16);
    expect(t.update(true, R, 0, 0)).toEqual({ kind: "done", pos: R });
  });

  it("perdre la cible sans relâcher efface aussi l'écart", () => {
    const t = new BreakTracker();
    breakOnce(t);
    expect(t.update(true, null, 200, 16)).toEqual({ kind: "idle" });
    expect(t.update(true, Q, 200, 200)).toEqual({ kind: "done", pos: Q });
  });

  it("sans casse pendant l'appui, changer de cible ne met pas d'écart", () => {
    const t = new BreakTracker();
    hold(t, P, 500, 100, 2);
    expect(t.update(true, Q, 100, 100)).toEqual({ kind: "done", pos: Q });
  });
});

describe("BreakTracker — bornes et valeurs aberrantes", () => {
  it("progress reste strictement inférieur à 1 avant « done »", () => {
    const t = new BreakTracker();
    const duration = 1000;
    let last = 0;
    for (let i = 0; i < 999; i++) {
      const s = t.update(true, P, duration, 1);
      const p = progressOf(s);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThan(1);
      expect(p).toBeLessThanOrEqual(0.999);
      expect(t.progress).toBe(p);
      last = p;
    }
    // Juste avant la durée : progress plafonné à 0,999.
    expect(progressOf(t.update(true, P, duration, 0.5))).toBe(0.999);
    expect(t.update(true, P, duration, 0.5).kind).toBe("done");
  });

  it("dtMs négatif ou non fini est traité comme 0", () => {
    const t = new BreakTracker();
    expect(progressOf(t.update(true, P, 400, 100))).toBeCloseTo(0.25, 10);
    expect(progressOf(t.update(true, P, 400, -500))).toBeCloseTo(0.25, 10);
    expect(progressOf(t.update(true, P, 400, Number.NaN))).toBeCloseTo(0.25, 10);
    expect(progressOf(t.update(true, P, 400, Number.POSITIVE_INFINITY))).toBeCloseTo(0.25, 10);
    expect(progressOf(t.update(true, P, 400, Number.NEGATIVE_INFINITY))).toBeCloseTo(0.25, 10);
    expect(progressOf(t.update(true, P, 400, 100))).toBeCloseTo(0.5, 10);
  });

  it("dtMs négatif ne raccourcit pas l'écart de répétition", () => {
    const t = new BreakTracker();
    breakOnce(t);
    expect(progressOf(t.update(true, Q, 0, -1000))).toBe(0);
    expect(progressOf(t.update(true, Q, 0, 149))).toBe(0);
    expect(t.update(true, Q, 0, 1)).toEqual({ kind: "done", pos: Q });
  });

  it("durée NaN : casse immédiate ; durée infinie : jamais de casse, progress 0", () => {
    const t = new BreakTracker();
    expect(t.update(true, P, Number.NaN, 16)).toEqual({ kind: "done", pos: P });
    const t2 = new BreakTracker();
    const steps = hold(t2, P, Number.POSITIVE_INFINITY, 1000, 20);
    expect(steps.every((s) => s.kind === "progress" && s.progress === 0)).toBe(true);
    expect(t2.progress).toBe(0);
  });

  it("2000 images au hasard : progression finie dans [0, 1[, repos sans appui, casse de la cible visée", () => {
    const t = new BreakTracker();
    const durations = [0, 1, 50, 350, 650, -1, Number.POSITIVE_INFINITY];
    const dts = [0, 1, 16, 33, 200, -5, Number.NaN];
    const targets = [P, Q, R, P];
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let i = 0; i < 2000; i++) {
      const holding = rnd(10) !== 0;
      const target = rnd(12) === 0 ? null : targets[rnd(targets.length)]!;
      const s = t.update(holding, target, durations[rnd(durations.length)]!, dts[rnd(dts.length)]!);
      if (!holding || target === null) expect(s.kind).toBe("idle");
      if (s.kind === "done") {
        expect(s.pos).toEqual(target);
        // Verrou : la même cible, appui gardé, ne recasse pas à l'image suivante.
        expect(t.update(true, target, 0, 16)).toEqual({ kind: "idle" });
      }
      if (s.kind === "progress") {
        expect(Number.isFinite(s.progress)).toBe(true);
        expect(s.progress).toBeGreaterThanOrEqual(0);
        expect(s.progress).toBeLessThan(1);
      }
      expect(Number.isFinite(t.progress)).toBe(true);
      expect(t.progress).toBeGreaterThanOrEqual(0);
      expect(t.progress).toBeLessThan(1);
    }
  });
});

describe("samePos", () => {
  it("compare x, y et z", () => {
    expect(samePos(P, { x: 3, y: 2, z: 5 })).toBe(true);
    expect(samePos(P, Q)).toBe(false);
    expect(samePos(Q, R)).toBe(false);
    expect(samePos(P, { x: 3, y: 2, z: 6 })).toBe(false);
  });
});

describe("ce que rapporte un bloc cassé (J5)", () => {
  it("son propre type en général, une lampe pour la pierre brillante, une clôture en plus pour un tronc", () => {
    expect(dropsOf(BlockId.Stone)).toEqual({ main: BlockId.Stone, extra: null });
    expect(dropsOf(BlockId.GlowStone)).toEqual({ main: BlockId.Lamp, extra: null });
    expect(dropsOf(BlockId.Log)).toEqual({ main: BlockId.Log, extra: BlockId.Fence });
    expect(dropsOf(BlockId.Lamp)).toEqual({ main: BlockId.Lamp, extra: null });
    expect(dropsOf(BlockId.Air)).toEqual({ main: null, extra: null });
    expect(dropsOf(BlockId.Water)).toEqual({ main: null, extra: null });
    expect(dropsOf(200)).toEqual({ main: null, extra: null });
  });
});
