import { describe, expect, it } from "vitest";
import { LETTERS } from "../../src/engine/blocks";
import { GLYPH_H, GLYPH_W, GLYPHS, glyph, isVowel, letterInkPixels, VOWELS } from "../../src/render/font";

/** Pixels d'encre d'un glyphe, à plat (7 × 5). */
const bits = (ch: string) => glyph(ch)!.join("");
const distance = (a: string, b: string) => {
  const x = bits(a);
  const y = bits(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++;
  return d;
};
const mirror = (ch: string) =>
  glyph(ch)!
    .map((row) => [...row].reverse().join(""))
    .join("");

describe("police des blocs-lettres (V2 lot 1)", () => {
  it("26 glyphes de 5 × 7, en « # » et « . », aucun vide", () => {
    expect(Object.keys(GLYPHS).sort().join("")).toBe(LETTERS);
    for (const ch of LETTERS) {
      const g = glyph(ch)!;
      expect(g.length).toBe(GLYPH_H);
      for (const row of g) expect(row).toMatch(new RegExp(`^[#.]{${GLYPH_W}}$`));
      expect(bits(ch)).toContain("#");
    }
  });

  it("tous différents, au moins 3 pixels d'écart deux à deux", () => {
    for (const a of LETTERS) {
      for (const b of LETTERS) {
        if (a < b) expect(distance(a, b), `${a} / ${b}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("aucun glyphe n'est le miroir horizontal d'un autre (une lettre retournée ne passe pas pour une autre)", () => {
    for (const a of LETTERS) {
      for (const b of LETTERS) {
        if (a !== b) expect(mirror(a) === bits(b), `${a} retourné = ${b}`).toBe(false);
      }
    }
  });

  it("C et G bien distincts de O (au moins 5 pixels)", () => {
    expect(distance("C", "O")).toBeGreaterThanOrEqual(5);
    expect(distance("G", "O")).toBeGreaterThanOrEqual(5);
  });

  it("glyph : une capitale de A à Z seulement", () => {
    expect(glyph("A")).toEqual([".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"]);
    for (const bad of ["a", "É", "1", "", "AB", " "]) expect(glyph(bad)).toBeNull();
  });

  it("pixels d'encre dans la tuile : L en haut à gauche et en bas à droite, pas en haut à droite (orientation figée)", () => {
    const has = (ch: string, x: number, y: number) => letterInkPixels(ch).some(([a, b]) => a === x && b === y);
    expect(has("L", 3, 1)).toBe(true);
    expect(has("L", 12, 14)).toBe(true);
    expect(has("L", 12, 1)).toBe(false);
    // Agrandie deux fois : chaque case du glyphe donne 4 pixels.
    expect(letterInkPixels("L").length).toBe(bits("L").split("").filter((c) => c === "#").length * 4);
    expect(letterInkPixels("é")).toEqual([]);
  });

  it("l'encre reste à l'intérieur du cadre d'un pixel (x de 3 à 12, y de 1 à 14)", () => {
    for (const ch of LETTERS) {
      for (const [x, y] of letterInkPixels(ch)) {
        expect(x).toBeGreaterThanOrEqual(3);
        expect(x).toBeLessThanOrEqual(12);
        expect(y).toBeGreaterThanOrEqual(1);
        expect(y).toBeLessThanOrEqual(14);
      }
    }
  });

  it("voyelles : A, E, I, O, U et Y", () => {
    expect(VOWELS).toBe("AEIOUY");
    expect([...LETTERS].filter(isVowel).join("")).toBe("AEIOUY");
    for (const bad of ["a", "", "AE", "É"]) expect(isVowel(bad)).toBe(false);
  });
});
