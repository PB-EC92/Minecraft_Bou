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

describe("sections de rendu (constat 10 de l'audit J0)", () => {
  it("découpe le monde en sections de 16³", () => {
    const w = new World(128, 64, 128);
    expect([w.sectionsX, w.sectionsY, w.sectionsZ]).toEqual([8, 4, 8]);
    expect(w.sectionCount).toBe(256);
  });

  it("une modification à l'intérieur d'une section ne touche qu'elle", () => {
    const w = new World(48, 48, 48);
    w.set(20, 20, 20, BlockId.Stone); // section (1, 1, 1), loin des frontières
    let touched = 0;
    for (let sy = 0; sy < 3; sy++) for (let sz = 0; sz < 3; sz++) for (let sx = 0; sx < 3; sx++) if (w.sectionVersion(sx, sy, sz) > 0) touched++;
    expect(touched).toBe(1);
    expect(w.sectionVersion(1, 1, 1)).toBe(1);
  });

  it("une modification sur une frontière touche aussi les voisines, coins compris", () => {
    const w = new World(48, 48, 48);
    w.set(16, 20, 20, BlockId.Stone); // face x = 16 : sections x 0 et 1
    expect(w.sectionVersion(1, 1, 1)).toBe(1);
    expect(w.sectionVersion(0, 1, 1)).toBe(1);
    expect(w.sectionVersion(2, 1, 1)).toBe(0);
    w.set(31, 31, 31, BlockId.Stone); // coin de la section (1, 1, 1) : 8 sections
    let touched = 0;
    for (let sy = 1; sy <= 2; sy++) for (let sz = 1; sz <= 2; sz++) for (let sx = 1; sx <= 2; sx++) if (w.sectionVersion(sx, sy, sz) > 0) touched++;
    expect(touched).toBe(8);
  });

  it("une écriture sans changement ne touche rien", () => {
    const w = World.createFlat(32, 16, 32, 4);
    w.set(5, 1, 5, BlockId.Dirt); // déjà de la terre
    expect(w.sectionVersion(0, 0, 0)).toBe(0);
  });
});

describe("eau et plantes (J1)", () => {
  it("on ne peut pas se tenir au fond de l'eau ; une fleur ne gêne pas", () => {
    const w = World.createFlat(8, 12, 8, 4);
    w.set(2, 4, 2, BlockId.Water);
    w.set(2, 5, 2, BlockId.Water);
    expect(w.findStandingY(2, 2)).toBeNull(); // on y nage, on ne s'y tient pas
    w.set(4, 4, 4, BlockId.FlowerRed);
    expect(w.findStandingY(4, 4)).toBe(4);
  });

  it("la visée voit les fleurs, pas l'eau", () => {
    const w = World.createFlat(8, 12, 8, 4);
    w.set(2, 4, 2, BlockId.Water);
    w.set(3, 4, 3, BlockId.FlowerYellow);
    expect(w.isTargetable(2, 4, 2)).toBe(false);
    expect(w.isTargetable(3, 4, 3)).toBe(true);
    expect(w.isSolid(3, 4, 3)).toBe(false);
  });
});
