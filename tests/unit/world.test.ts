import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";

describe("World", () => {
  it("crée un monde plat avec herbe en surface, terre puis pierre", () => {
    const w = World.createFlat(8, 8, 8, 4);
    expect(w.get(3, 3, 3)).toBe(BlockId.Grass);
    expect(w.get(3, 2, 3)).toBe(BlockId.Dirt);
    expect(w.get(3, 1, 3)).toBe(BlockId.Dirt);
    expect(w.get(3, 0, 3)).toBe(BlockId.Stone);
    expect(w.get(3, 4, 3)).toBe(BlockId.Air);
    expect(w.surfaceHeight(3, 3)).toBe(4);
  });

  it("renvoie de l'air hors limites et refuse d'y écrire", () => {
    const w = World.createFlat(4, 4, 4, 2);
    expect(w.get(-1, 0, 0)).toBe(BlockId.Air);
    expect(w.get(0, 99, 0)).toBe(BlockId.Air);
    expect(w.set(4, 0, 0, BlockId.Stone)).toBe(false);
  });

  it("incrémente la version uniquement quand un bloc change", () => {
    const w = World.createFlat(4, 6, 4, 4);
    const v0 = w.changeVersion;
    expect(w.set(1, 1, 1, BlockId.Dirt)).toBe(false); // déjà de la terre
    expect(w.changeVersion).toBe(v0);
    expect(w.set(1, 4, 1, BlockId.Planks)).toBe(true);
    expect(w.changeVersion).toBe(v0 + 1);
    expect(w.get(1, 4, 1)).toBe(BlockId.Planks);
  });
});
