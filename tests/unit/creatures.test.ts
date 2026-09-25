import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import {
  CONTACT_DISTANCE,
  CreatureSim,
  DAY_COUNT,
  DAY_DISTANCE,
  LAMP_RADIUS,
  NIGHT_COUNT,
  STEAL_COOLDOWN_MS,
  type Creature,
  type SimContext,
} from "../../src/engine/creatures";
import { World } from "../../src/engine/World";

const flat = () => World.createFlat(96, 16, 96, 4);
const ctx = (over: Partial<SimContext> = {}): SimContext => ({
  player: { x: 48, y: 4, z: 48 },
  night: false,
  lamps: [],
  enabled: true,
  bagHasBlocks: true,
  ...over,
});
const run = (sim: CreatureSim, ms: number, c: SimContext, step = 50) => {
  const events = [];
  for (let t = 0; t < ms; t += step) events.push(...sim.update(step, c));
  return events;
};
const dist = (c: Creature, p: { x: number; z: number }) => Math.hypot(c.x - p.x, c.z - p.z);

describe("les Grignotes", () => {
  it("le jour : deux Grignotes qui gardent leurs distances", () => {
    const sim = new CreatureSim(flat(), 3);
    const c = ctx();
    run(sim, 30_000, c);
    expect(sim.creatures.length).toBe(DAY_COUNT);
    for (const g of sim.creatures) expect(dist(g, c.player)).toBeGreaterThan(DAY_DISTANCE - 2);
  });

  it("la nuit : jusqu'à quatre, qui s'approchent et chipent un bloc au contact, puis s'enfuient", () => {
    const sim = new CreatureSim(flat(), 5);
    const c = ctx({ night: true });
    const events = run(sim, 40_000, c);
    expect(sim.creatures.length).toBe(NIGHT_COUNT);
    const steals = events.filter((e) => e.kind === "steal");
    expect(steals.length).toBeGreaterThanOrEqual(1);
    // Jamais deux vols à moins de STEAL_COOLDOWN_MS (au plus 2 vols en 40 s).
    expect(steals.length).toBeLessThanOrEqual(Math.floor(40_000 / STEAL_COOLDOWN_MS) + 1);
  });

  it("après un vol, la Grignote s'enfuit tout de suite", () => {
    const sim = new CreatureSim(flat(), 5);
    const c = ctx({ night: true });
    for (let t = 0; t < 60_000; t += 50) {
      const e = sim.update(50, c).find((x) => x.kind === "steal");
      if (!e) continue;
      const thief = sim.creatures.find((g) => g.id === e.id)!;
      expect(thief.mode).toBe("flee");
      run(sim, 2000, c);
      expect(dist(thief, c.player)).toBeGreaterThan(CONTACT_DISTANCE + 3);
      return;
    }
    throw new Error("aucun vol en 60 s");
  });

  it("sac vide : aucun vol", () => {
    const sim = new CreatureSim(flat(), 5);
    const events = run(sim, 40_000, ctx({ night: true, bagHasBlocks: false }));
    expect(events.some((e) => e.kind === "steal")).toBe(false);
  });

  it("une lampe près du joueur : les Grignotes ne s'en approchent pas, donc ne volent rien", () => {
    const sim = new CreatureSim(flat(), 5);
    const c = ctx({ night: true, lamps: [{ x: 48.5, y: 4.5, z: 48.5 }] });
    const events = run(sim, 60_000, c);
    expect(events.some((e) => e.kind === "steal")).toBe(false);
    for (const g of sim.creatures) expect(dist(g, { x: 48.5, z: 48.5 })).toBeGreaterThan(LAMP_RADIUS - 1);
  });

  it("une clôture tout autour du joueur : aucune Grignote n'entre", () => {
    const w = flat();
    for (let x = 43; x <= 53; x++) {
      w.set(x, 4, 43, BlockId.Fence);
      w.set(x, 4, 53, BlockId.Fence);
    }
    for (let z = 43; z <= 53; z++) {
      w.set(43, 4, z, BlockId.Fence);
      w.set(53, 4, z, BlockId.Fence);
    }
    const sim = new CreatureSim(w, 9);
    const events = run(sim, 60_000, ctx({ night: true }));
    expect(events.some((e) => e.kind === "steal")).toBe(false);
    for (const g of sim.creatures) expect(g.x > 43 && g.x < 54 && g.z > 43 && g.z < 54).toBe(false);
  });

  it("un grand enclos de clôtures (40 blocs de côté) : aucune Grignote n'y naît (J7)", () => {
    const w = flat();
    for (let i = 28; i <= 68; i++) {
      w.set(i, 4, 28, BlockId.Fence);
      w.set(i, 4, 68, BlockId.Fence);
      w.set(28, 4, i, BlockId.Fence);
      w.set(68, 4, i, BlockId.Fence);
    }
    const sim = new CreatureSim(w, 3);
    const c = ctx({ night: true });
    const inside = (k: Creature) => k.x > 28 && k.x < 69 && k.z > 28 && k.z < 69;
    let seen = 0;
    for (let t = 0; t < 60_000; t += 100) {
      for (const e of sim.update(100, c)) if (e.kind === "spawn") seen++;
      for (const k of sim.creatures) expect(inside(k)).toBe(false);
    }
    expect(seen).toBeGreaterThan(0); // elles naissent bien, dehors
    // Une seule haie (un côté) : ce n'est pas un enclos.
    const w2 = flat();
    for (let i = 0; i < 96; i++) w2.set(i, 4, 30, BlockId.Fence);
    expect(new CreatureSim(w2, 1).fencedIn(48, 4, 48)).toBe(false);
    expect(sim.fencedIn(48, 4, 48)).toBe(true);
    // Sur une pente : une clôture 5 blocs plus haut que le lieu d'apparition compte aussi (relecture J7).
    const w3 = flat();
    for (let i = 28; i <= 68; i++) {
      w3.set(i, 9, 28, BlockId.Fence);
      w3.set(i, 4, 68, BlockId.Fence);
      w3.set(28, 4, i, BlockId.Fence);
      w3.set(68, 4, i, BlockId.Fence);
    }
    expect(new CreatureSim(w3, 1).fencedIn(48, 4, 48)).toBe(true);
  });

  it("les bulles font fuir les Grignotes visées ; celle qui portait un bloc le rend", () => {
    const sim = new CreatureSim(flat(), 5);
    const c = ctx({ night: true });
    run(sim, 3000, c);
    const g = sim.creatures[0]!;
    g.x = 48.5;
    g.z = 44.5; // devant le joueur (regard vers -Z)
    g.carried = BlockId.Stone;
    const hit = sim.bubble({ x: 48.5, y: 5.6, z: 48.5 }, { x: 0, y: 0, z: -1 });
    expect(hit.map((h) => h.id)).toContain(g.id);
    expect(hit.find((h) => h.id === g.id)!.carried).toBe(BlockId.Stone);
    expect(g.carried).toBeNull();
    expect(g.mode).toBe("flee");
    // Derrière le joueur : pas touchée.
    const behind = sim.creatures[1]!;
    behind.x = 48.5;
    behind.z = 53.5;
    expect(sim.bubble({ x: 48.5, y: 5.6, z: 48.5 }, { x: 0, y: 0, z: -1 }).map((h) => h.id)).not.toContain(behind.id);
  });

  it("créatures désactivées (mode parent) : aucune", () => {
    const sim = new CreatureSim(flat(), 5);
    run(sim, 5000, ctx({ night: true }));
    expect(sim.creatures.length).toBeGreaterThan(0);
    const events = run(sim, 100, ctx({ night: true, enabled: false }));
    expect(sim.creatures.length).toBe(0);
    expect(events.some((e) => e.kind === "despawn")).toBe(true);
  });

  it("jamais dans l'eau ni sur une clôture", () => {
    const w = flat();
    for (let x = 30; x < 66; x++) for (let z = 30; z < 66; z++) if ((x + z) % 7 === 0) w.set(x, 4, z, BlockId.Fence);
    const sim = new CreatureSim(w, 11);
    const c = ctx({ night: true });
    for (let t = 0; t < 30_000; t += 50) {
      sim.update(50, c);
      for (const g of sim.creatures) {
        expect(w.get(Math.floor(g.x), Math.floor(g.y) - 1, Math.floor(g.z))).not.toBe(BlockId.Fence);
        expect(w.get(Math.floor(g.x), Math.floor(g.y), Math.floor(g.z))).not.toBe(BlockId.Water);
      }
    }
  });
});

describe("les Grignotes ne trichent pas (relecture J5)", () => {
  it("pas de vol à travers un toit ni depuis le bord d'un trou", () => {
    const w = flat();
    // Enfant au fond d'un trou de 3 blocs.
    for (let y = 1; y < 4; y++) w.set(48, y, 48, BlockId.Air);
    const sim = new CreatureSim(w, 5);
    const c = ctx({ night: true, player: { x: 48.5, y: 1, z: 48.5 } });
    const g = sim.spawnAt(49.5, 48.5)!;
    expect(g.y).toBe(4);
    const events = run(sim, 20_000, c);
    expect(events.some((e) => e.kind === "steal")).toBe(false);
  });

  it("pas d'apparition sur un toit ou une construction", () => {
    const w = flat();
    for (let x = 20; x < 80; x++) for (let z = 20; z < 80; z++) w.set(x, 8, z, BlockId.Planks); // grand toit
    const sim = new CreatureSim(w, 5);
    run(sim, 20_000, ctx({ night: true }));
    for (const g of sim.creatures) expect(g.y).toBeLessThan(7);
  });

  it("clôture en diagonale : ni passage ni vol à travers le coin", () => {
    const w = flat();
    for (let i = 0; i < 96; i++) w.set(i, 4, i, BlockId.Fence);
    const sim = new CreatureSim(w, 7);
    const c = ctx({ night: true, player: { x: 50.7, y: 4, z: 51.3 } }); // côté z > x
    // (Les Grignotes nées du côté de l'enfant peuvent voler : seules comptent celles de l'autre côté.)
    const far = new Set<number>();
    for (let k = 0; k < 6; k++) {
      const g = sim.spawnAt(52.5, 50.5); // de l'autre côté, contre le coin
      if (!g) continue;
      g.mode = "approach";
      far.add(g.id);
      for (let t = 0; t < 5000; t += 50) {
        for (const e of sim.update(50, c)) expect(e.kind === "steal" && far.has(e.id)).toBe(false);
        for (const x of sim.creatures) if (far.has(x.id)) expect(Math.floor(x.z) > Math.floor(x.x)).toBe(false);
      }
    }
  });

  it("une voleuse retirée (trop loin, créatures coupées, autre monde) rend son bloc", () => {
    const sim = new CreatureSim(flat(), 5);
    const g = sim.spawnAt(40.5, 40.5)!;
    g.carried = BlockId.Stone;
    const events = sim.update(50, ctx({ enabled: false }));
    expect(events).toContainEqual({ kind: "despawn", id: g.id, carried: BlockId.Stone });
    const g2 = sim.spawnAt(40.5, 40.5)!;
    g2.carried = BlockId.Log;
    expect(sim.setWorld(flat())).toEqual([BlockId.Log]);
  });
});
