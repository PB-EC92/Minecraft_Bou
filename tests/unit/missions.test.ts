import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import { MISSION_1, MissionRunner, type MissionView } from "../../src/edu/missions";
import { COMPANION_TELEPORT, companionGoal, stepCompanion } from "../../src/game/companion";

const bag = (counts: Partial<Record<BlockId, number>>): MissionView => ({ count: (id) => counts[id] ?? 0 });

describe("moteur de missions", () => {
  it("mission 1 : troncs, pierres, cabane, lampe trouvée, lampe posée", () => {
    const m = new MissionRunner(MISSION_1);
    expect(m.stepIndex).toBe(0);
    expect(m.progress(bag({ [BlockId.Log]: 2 }))).toEqual({ have: 2, need: 6 });
    expect(m.update(bag({ [BlockId.Log]: 5 }))).toBeNull();
    expect(m.update(bag({ [BlockId.Log]: 7 }))).toEqual({ kind: "step", index: 1 });
    expect(m.progress(bag({ [BlockId.Log]: 7 }))).toEqual({ have: 0, need: 4 });
    expect(m.update(bag({ [BlockId.Stone]: 4 }))).toEqual({ kind: "step", index: 2 });
    for (let i = 0; i < 9; i++) m.notePlaced(BlockId.Planks);
    expect(m.update(bag({}))).toBeNull();
    m.notePlaced(BlockId.Dirt);
    expect(m.update(bag({}))).toEqual({ kind: "step", index: 3 });
    expect(m.update(bag({ [BlockId.Lamp]: 1 }))).toEqual({ kind: "step", index: 4 });
    // Les blocs posés avant l'étape ne comptent pas.
    expect(m.progress(bag({}))).toEqual({ have: 0, need: 1 });
    m.notePlaced(BlockId.Lamp);
    expect(m.update(bag({}))).toEqual({ kind: "done" });
    expect(m.done).toBe(true);
    expect(m.current()).toBeNull();
    expect(m.update(bag({}))).toBeNull();
  });

  it("une étape à la fois, même si plusieurs objectifs sont déjà atteints", () => {
    const m = new MissionRunner(MISSION_1);
    const full = bag({ [BlockId.Log]: 9, [BlockId.Stone]: 9 });
    expect(m.update(full)).toEqual({ kind: "step", index: 1 });
    expect(m.update(full)).toEqual({ kind: "step", index: 2 });
    expect(m.update(full)).toBeNull();
  });

  it("progression enregistrée puis relue ; donnée abîmée ou d'une autre mission : départ", () => {
    const m = new MissionRunner(MISSION_1);
    m.update(bag({ [BlockId.Log]: 6 }));
    m.update(bag({ [BlockId.Stone]: 4 }));
    m.notePlaced(BlockId.Sand);
    const saved = JSON.parse(JSON.stringify(m.toJSON()));
    const again = new MissionRunner(MISSION_1, saved);
    expect(again.stepIndex).toBe(2);
    expect(again.progress(bag({}))).toEqual({ have: 1, need: 10 });
    expect(new MissionRunner(MISSION_1, { id: "autre", step: 3 }).stepIndex).toBe(0);
    expect(new MissionRunner(MISSION_1, { id: "abri", step: 99 }).done).toBe(true);
    expect(new MissionRunner(MISSION_1, "n'importe quoi").stepIndex).toBe(0);
  });

  it("textes : deux variantes, la débutante plus courte ; forme dite en lettres", () => {
    for (const s of MISSION_1.steps) {
      expect(s.text.debutant.length).toBeLessThan(s.text.autonome.length);
      if (s.spoken) expect(s.spoken.debutant).not.toMatch(/\d/);
    }
    expect(MISSION_1.intro.debutant).toContain("Pixel");
  });
});

describe("compagnon Pixel", () => {
  const w = () => World.createFlat(32, 16, 32, 4);

  it("sa place : devant l'enfant (visible) et sur sa gauche", () => {
    const g = companionGoal({ x: 16, z: 16 }, 0); // regard vers -Z : devant = -Z, gauche = -X
    expect(g.z).toBeLessThan(16);
    expect(g.x).toBeLessThan(16);
  });

  it("il la rejoint en trottinant, puis s'arrête", () => {
    let c = { x: 10.5, y: 4, z: 10.5, yaw: 0, moving: false };
    const player = { x: 16, y: 4, z: 16 };
    const goal = companionGoal(player, 0);
    for (let i = 0; i < 100; i++) c = stepCompanion(c, goal, player, w(), 0.05);
    expect(Math.hypot(c.x - goal.x, c.z - goal.z)).toBeLessThan(0.7);
    expect(c.moving).toBe(false);
  });

  it("resté trop loin : il réapparaît près de l'enfant", () => {
    const player = { x: 16, y: 4, z: 16 };
    const goal = companionGoal(player, 0);
    const c = stepCompanion({ x: 1, y: 4, z: 1 + COMPANION_TELEPORT * 2, yaw: 0, moving: false }, goal, player, w(), 0.05);
    expect(Math.hypot(c.x - goal.x, c.z - goal.z)).toBeLessThan(0.01);
  });

  it("un mur de deux blocs l'arrête (il réapparaîtra si l'enfant s'éloigne)", () => {
    const world = w();
    for (let z = 0; z < 32; z++) for (let y = 4; y < 6; y++) world.set(14, y, z, BlockId.Stone);
    let c = { x: 12.5, y: 4, z: 16.5, yaw: 0, moving: false };
    const player = { x: 18, y: 4, z: 16 };
    for (let i = 0; i < 40; i++) c = stepCompanion(c, { x: 17, z: 16.5 }, player, world, 0.05);
    expect(c.x).toBeLessThan(14);
  });
});
