import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { raycast } from "../../src/engine/raycast";
import { World } from "../../src/engine/World";

describe("raycast", () => {
  const w = World.createFlat(16, 16, 16, 4); // surface à y = 4

  it("touche le sol en visant vers le bas, avec la normale vers le haut", () => {
    const hit = raycast(w, { x: 8.5, y: 6, z: 8.5 }, { x: 0, y: -1, z: 0 }, 10);
    expect(hit).not.toBeNull();
    expect(hit).toMatchObject({ x: 8, y: 3, z: 8, nx: 0, ny: 1, nz: 0 });
    expect(hit!.distance).toBeCloseTo(2, 5);
  });

  it("ne touche rien en visant le ciel", () => {
    expect(raycast(w, { x: 8.5, y: 6, z: 8.5 }, { x: 0, y: 1, z: 0 }, 10)).toBeNull();
  });

  it("respecte la portée maximale", () => {
    expect(raycast(w, { x: 8.5, y: 10, z: 8.5 }, { x: 0, y: -1, z: 0 }, 5)).toBeNull();
    expect(raycast(w, { x: 8.5, y: 10, z: 8.5 }, { x: 0, y: -1, z: 0 }, 7)).not.toBeNull();
  });

  it("touche un bloc isolé par la face qui regarde l'origine", () => {
    w.set(10, 5, 8, BlockId.Stone);
    const hit = raycast(w, { x: 5.5, y: 5.5, z: 8.5 }, { x: 1, y: 0, z: 0 }, 10);
    expect(hit).toMatchObject({ x: 10, y: 5, z: 8, nx: -1, ny: 0, nz: 0 });
    // Poser un bloc sur cette face le met en (9, 5, 8)
    expect(hit!.x + hit!.nx).toBe(9);
  });

  it("fonctionne en diagonale", () => {
    const hit = raycast(w, { x: 2.5, y: 5.5, z: 2.5 }, { x: 1, y: -0.3, z: 1 }, 20);
    expect(hit).not.toBeNull();
    expect(hit!.ny).toBe(1); // on arrive par le dessus
    expect(hit!.y).toBe(3);
  });
});
