import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { collides, sweep, type AABB } from "../../src/engine/physics";
import { World } from "../../src/engine/World";

function playerBox(x: number, y: number, z: number): AABB {
  return { minX: x - 0.3, maxX: x + 0.3, minY: y, maxY: y + 1.8, minZ: z - 0.3, maxZ: z + 0.3 };
}

describe("physics", () => {
  const w = World.createFlat(16, 16, 16, 4); // surface à y = 4

  it("détecte la collision avec le sol", () => {
    expect(collides(w, playerBox(8, 4.0001, 8))).toBe(false);
    expect(collides(w, playerBox(8, 3.9, 8))).toBe(true);
  });

  it("arrête la chute sur le sol", () => {
    const b = playerBox(8, 6, 8);
    const r = sweep(w, b, 0, -5, 0);
    expect(r.hitY).toBe(true);
    expect(b.minY).toBeCloseTo(4, 3);
    expect(b.minY).toBeGreaterThanOrEqual(4);
    expect(collides(w, b)).toBe(false);
  });

  it("glisse le long d'un mur sans le traverser", () => {
    const world = World.createFlat(16, 16, 16, 4);
    for (let y = 4; y < 7; y++) world.set(10, y, 8, BlockId.Stone);
    const b = playerBox(9, 4.001, 8.5);
    const r = sweep(world, b, 3, 0, 1);
    expect(r.hitX).toBe(true);
    expect(r.hitZ).toBe(false);
    expect(b.maxX).toBeLessThanOrEqual(10);
    expect(b.minZ).toBeCloseTo(9.2, 3); // le déplacement en Z est conservé
    expect(collides(world, b)).toBe(false);
  });

  it("ne traverse pas un bloc à grande vitesse", () => {
    const world = World.createFlat(16, 16, 16, 4);
    world.set(8, 6, 8, BlockId.Stone); // plafond fin au-dessus de la tête
    const b = playerBox(8, 4.001, 8);
    const r = sweep(world, b, 0, 4, 0);
    expect(r.hitY).toBe(true);
    expect(b.maxY).toBeLessThanOrEqual(6);
  });
});
