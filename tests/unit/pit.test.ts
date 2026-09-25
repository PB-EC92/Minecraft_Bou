import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { pitState } from "../../src/engine/pit";
import { World } from "../../src/engine/World";

const flat = () => World.createFlat(32, 16, 32, 4);

describe("enfant coincé (conseil de Pixel, J7)", () => {
  it("en plein champ, ou dans un creux d'un bloc (marche) : on sort en marchant", () => {
    const w = flat();
    expect(pitState(w, 16.5, 4, 16.5)).toBe("open");
    w.set(16, 3, 16, BlockId.Air);
    expect(pitState(w, 16.5, 3, 16.5)).toBe("open");
  });

  it("au fond d'un puits de deux blocs : il faut grimper (escalade de secours)", () => {
    const w = flat();
    w.set(16, 3, 16, BlockId.Air);
    w.set(16, 2, 16, BlockId.Air);
    expect(pitState(w, 16.5, 2, 16.5)).toBe("climb");
  });

  it("une marche d'un bloc mais sans place au-dessus : pas une sortie, ni en marchant ni en grimpant", () => {
    const w = flat();
    w.set(16, 3, 16, BlockId.Air);
    for (const [x, z] of [[17, 16], [15, 16], [16, 17], [16, 15]] as const) w.set(x, 5, z, BlockId.Stone);
    expect(pitState(w, 16.5, 3, 16.5)).toBe("closed");
  });

  it("abri 1 × 1 fermé, murs de trois blocs, toit posé sur les murs : il faut casser (relecture J7)", () => {
    const w = flat();
    for (const [x, z] of [[17, 16], [15, 16], [16, 17], [16, 15]] as const) for (let y = 4; y < 7; y++) w.set(x, y, z, BlockId.Planks);
    w.set(16, 7, 16, BlockId.Planks);
    expect(pitState(w, 16.5, 4, 16.5)).toBe("closed");
    w.set(16, 7, 16, BlockId.Air); // sans toit : on grimpe par-dessus les murs
    expect(pitState(w, 16.5, 4, 16.5)).toBe("climb");
  });

  it("enfermé (quatre murs et un toit) : il faut casser un bloc", () => {
    const w = flat();
    for (const [x, z] of [[17, 16], [15, 16], [16, 17], [16, 15]] as const) for (let y = 4; y < 6; y++) w.set(x, y, z, BlockId.Planks);
    w.set(16, 6, 16, BlockId.Planks);
    expect(pitState(w, 16.5, 4, 16.5)).toBe("closed");
    w.set(16, 4, 17, BlockId.Air);
    w.set(16, 5, 17, BlockId.Air);
    expect(pitState(w, 16.5, 4, 16.5)).toBe("open");
  });

  it("contre le bord du monde : le bord n'est pas une sortie", () => {
    const w = flat();
    for (const [x, z] of [[1, 0], [0, 1]] as const) for (let y = 4; y < 6; y++) w.set(x, y, z, BlockId.Stone);
    expect(pitState(w, 0.5, 4, 0.5)).toBe("climb");
  });
});
