import { describe, expect, it } from "vitest";
import { Tile } from "../../src/engine/blocks";
import { wordTiles } from "../../src/ui/wordIcon";

describe("icône d'un mot : tuiles des blocs-lettres", () => {
  it("une tuile par lettre, dans l'ordre", () => {
    expect(wordTiles("ABC")).toEqual([Tile.LetterA, Tile.LetterB, Tile.LetterC]);
    expect(wordTiles("LEA")).toEqual([Tile.LetterL, Tile.LetterE, Tile.LetterA]);
    expect(wordTiles("Z")).toEqual([Tile.LetterZ]);
  });

  it("un caractère hors A–Z laisse une case vide", () => {
    expect(wordTiles("A b")).toEqual([Tile.LetterA, null, null]);
    expect(wordTiles("LÉA")).toEqual([Tile.LetterL, null, Tile.LetterA]);
    expect(wordTiles("A1")).toEqual([Tile.LetterA, null]);
  });

  it("mot vide : aucune case", () => {
    expect(wordTiles("")).toEqual([]);
  });
});
