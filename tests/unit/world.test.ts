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

describe("bords du monde pour la physique (audit J0, constat 4)", () => {
  const w = World.createFlat(8, 8, 8, 4);

  it("les bords horizontaux et le dessous sont des murs", () => {
    expect(w.isSolidForPhysics(-1, 5, 3)).toBe(true);
    expect(w.isSolidForPhysics(8, 5, 3)).toBe(true);
    expect(w.isSolidForPhysics(3, 5, -1)).toBe(true);
    expect(w.isSolidForPhysics(3, 5, 8)).toBe(true);
    expect(w.isSolidForPhysics(3, -1, 3)).toBe(true);
  });

  it("le ciel reste libre et l'intérieur suit les blocs", () => {
    expect(w.isSolidForPhysics(3, 8, 3)).toBe(false);
    expect(w.isSolidForPhysics(3, 5, 3)).toBe(false);
    expect(w.isSolidForPhysics(3, 3, 3)).toBe(true);
  });

  it("la visée, elle, ne voit pas ces murs", () => {
    expect(w.isSolid(-1, 5, 3)).toBe(false);
  });
});

describe("point d'apparition (audit J0, constat 3)", () => {
  it("donne la surface d'un sol dégagé", () => {
    const w = World.createFlat(8, 12, 8, 4);
    expect(w.findStandingY(3, 3)).toBe(4);
  });

  it("sous un feuillage, donne le sol et non le dessus du feuillage", () => {
    const w = World.createFlat(8, 12, 8, 4);
    w.set(3, 7, 3, BlockId.Grass); // « feuillage » à 3 blocs au-dessus du sol
    expect(w.surfaceHeight(3, 3)).toBe(8); // ancien calcul : sur le feuillage
    expect(w.findStandingY(3, 3)).toBe(4);
  });

  it("saute une place trop basse pour se tenir debout", () => {
    const w = World.createFlat(8, 12, 8, 4);
    w.set(3, 5, 3, BlockId.Stone); // plafond à 1 bloc du sol : pas la place
    expect(w.findStandingY(3, 3)).toBe(6); // debout sur ce bloc
  });

  it("renvoie null hors du monde ou dans une colonne pleine", () => {
    const w = World.createFlat(4, 4, 4, 4);
    expect(w.findStandingY(1, 1)).toBeNull();
    expect(w.findStandingY(-1, 1)).toBeNull();
  });
});
