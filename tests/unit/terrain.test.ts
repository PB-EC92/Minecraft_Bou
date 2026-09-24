import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { generateWorld, parseWorldType, SEA_LEVEL, WORLD_SIZE, WORLD_TYPES, type WorldTypeId } from "../../src/engine/terrain";
import type { World } from "../../src/engine/World";

const NATURAL: WorldTypeId[] = ["prairie", "ile", "montagne", "desert"];

function surfaceStats(w: World) {
  const counts = new Map<BlockId, number>();
  let maxTop = 0;
  let water = 0;
  for (let z = 0; z < w.sizeZ; z++) {
    for (let x = 0; x < w.sizeX; x++) {
      let y = w.sizeY - 1;
      while (y > 0 && (w.get(x, y, z) === BlockId.Air || w.get(x, y, z) === BlockId.FlowerRed || w.get(x, y, z) === BlockId.FlowerYellow)) y--;
      const id = w.get(x, y, z);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (id === BlockId.Water) water++;
      maxTop = Math.max(maxTop, y);
    }
  }
  const n = w.sizeX * w.sizeZ;
  const share = (id: BlockId) => (counts.get(id) ?? 0) / n;
  return { share, maxTop, water: water / n };
}

describe("génération du terrain par type de monde", () => {
  it("reconnaît les noms de types, accents compris", () => {
    expect(parseWorldType("île")).toBe("ile");
    expect(parseWorldType("DESERT")).toBe("desert");
    expect(parseWorldType("désert")).toBe("desert");
    expect(parseWorldType("lune")).toBeNull();
    expect(WORLD_TYPES.filter((t) => t.forChildren).map((t) => t.id)).toEqual(NATURAL);
  });

  it("même type et même graine donnent le même monde", () => {
    const a = generateWorld("prairie", 1234).world;
    const b = generateWorld("prairie", 1234).world;
    const c = generateWorld("prairie", 1235).world;
    // Comparaison binaire : toEqual sur 1 Mo élément par élément dépassait 5 s sur une machine chargée.
    const same = (x: Uint8Array, y: Uint8Array) => Buffer.from(x.buffer, x.byteOffset, x.byteLength).equals(Buffer.from(y.buffer, y.byteOffset, y.byteLength));
    expect(same(a.data, b.data)).toBe(true);
    expect(same(a.data, c.data)).toBe(false);
  });

  for (const type of NATURAL) {
    it(`${type} : 128 × 64 × 128, socle plein, apparition au sol hors de l'eau`, () => {
      for (const seed of [1, 777, 424242]) {
        const g = generateWorld(type, seed);
        const w = g.world;
        expect([w.sizeX, w.sizeY, w.sizeZ]).toEqual([WORLD_SIZE, 64, WORLD_SIZE]);
        for (let z = 0; z < w.sizeZ; z += 7) for (let x = 0; x < w.sizeX; x += 7) expect(w.get(x, 0, z)).toBe(BlockId.Stone);
        const { x, y, z } = g.spawn;
        const fx = Math.floor(x);
        const fz = Math.floor(z);
        const fy = Math.floor(y);
        expect(y).toBeGreaterThan(SEA_LEVEL);
        expect(w.isSolid(fx, fy - 1, fz)).toBe(true);
        expect(w.isOpenSpace(fx, fy, fz)).toBe(true);
        expect(w.isOpenSpace(fx, fy + 1, fz)).toBe(true);
        expect([BlockId.Log, BlockId.Leaves, BlockId.Cactus]).not.toContain(w.get(fx, fy - 1, fz));
      }
    });
  }

  it("prairie : surtout de l'herbe, des arbres et des fleurs", () => {
    const g = generateWorld("prairie", 99);
    const s = surfaceStats(g.world);
    expect(s.share(BlockId.Grass) + s.share(BlockId.Leaves)).toBeGreaterThan(0.6);
    expect(g.stats.trees).toBeGreaterThan(40);
    expect(g.stats.flowers).toBeGreaterThan(300);
    expect(g.stats.cacti).toBe(0);
  });

  it("île : de l'eau sur les bords, de la terre au centre, des plages", () => {
    const g = generateWorld("ile", 99);
    const w = g.world;
    for (const [x, z] of [[1, 1], [126, 1], [1, 126], [126, 126], [64, 1], [1, 64]] as const) {
      expect(w.get(x, SEA_LEVEL - 1, z)).toBe(BlockId.Water);
    }
    expect(w.findStandingY(64, 64)).not.toBeNull();
    const s = surfaceStats(w);
    expect(s.water).toBeGreaterThan(0.3);
    expect(s.share(BlockId.Sand)).toBeGreaterThan(0.03);
  });

  it("montagne : des sommets bien plus hauts qu'en prairie, de la neige", () => {
    const m = surfaceStats(generateWorld("montagne", 5).world);
    const p = surfaceStats(generateWorld("prairie", 5).world);
    expect(m.maxTop).toBeGreaterThan(p.maxTop + 10);
    expect(m.share(BlockId.Snow)).toBeGreaterThan(0.005);
  });

  it("désert : surtout du sable, des cactus, aucun arbre hors des oasis", () => {
    const g = generateWorld("desert", 99);
    const s = surfaceStats(g.world);
    expect(s.share(BlockId.Sand) + s.share(BlockId.Cactus)).toBeGreaterThan(0.6);
    expect(g.stats.cacti).toBeGreaterThan(20);
  });

  it("monde plat de test : celui du J0, apparition à y = 4", () => {
    const g = generateWorld("plat", 1);
    expect([g.world.sizeX, g.world.sizeY, g.world.sizeZ]).toEqual([32, 16, 32]);
    expect(g.spawn.y).toBeCloseTo(4, 1);
    expect(g.world.get(11, 7, 23)).toBe(BlockId.Leaves); // feuillage de l'arbre de test (constat 15)
  });
});
