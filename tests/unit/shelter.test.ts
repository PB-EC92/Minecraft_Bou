import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { checkShelter, SHELTER_ROOF_REACH, SHELTER_WALL_REACH } from "../../src/engine/shelter";
import { World } from "../../src/engine/World";

/** Monde plat (sol à y = 4) et fonction « changé depuis la génération ». */
function setup() {
  const w = World.createFlat(32, 16, 32, 4);
  const base = w.data.slice();
  const changed = (x: number, y: number, z: number) => w.inBounds(x, y, z) && w.get(x, y, z) !== base[w.index(x, y, z)];
  return { w, changed };
}

/** Cabane de 3 × 3 à l'intérieur centrée sur (cx, cz), murs de h blocs, porte au sud (+Z), toit plein si roof. */
function hut(w: World, cx: number, cz: number, h = 3, roof = true, door = true) {
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      for (let y = 4; y < 4 + h; y++) {
        if (edge && !(door && dx === 0 && dz === 2 && y < 6)) w.set(cx + dx, y, cz + dz, BlockId.Planks);
      }
      if (roof) w.set(cx + dx, 4 + h, cz + dz, BlockId.Planks);
    }
  }
}

describe("abri (mission 1)", () => {
  it("dehors, en plein champ : ni toit ni murs", () => {
    const { w, changed } = setup();
    expect(checkShelter(w, 16.5, 4, 16.5, changed)).toEqual({ roof: false, walls: 0, own: false, ok: false });
  });

  it("cabane avec toit et porte : abri complet au milieu, et même sur le seuil", () => {
    const { w, changed } = setup();
    hut(w, 16, 16);
    expect(checkShelter(w, 16.5, 4, 16.5, changed)).toEqual({ roof: true, walls: 3, own: true, ok: true });
    // Dans un coin, loin de l'axe de la porte : quatre murs.
    expect(checkShelter(w, 15.5, 4, 15.5, changed).walls).toBe(4);
    // Sur le seuil (dans l'ouverture de la porte), sous le toit : trois murs aussi.
    expect(checkShelter(w, 16.5, 4, 18.5, changed).ok).toBe(true);
  });

  it("sans toit : pas encore un abri (murs comptés)", () => {
    const { w, changed } = setup();
    hut(w, 16, 16, 3, false);
    expect(checkShelter(w, 16.5, 4, 16.5, changed)).toEqual({ roof: false, walls: 3, own: true, ok: false });
  });

  it("un toit sur deux murs seulement : il manque un mur", () => {
    const { w, changed } = setup();
    for (let z = 14; z <= 18; z++) {
      w.set(14, 4, z, BlockId.Stone);
      w.set(18, 4, z, BlockId.Stone);
    }
    w.set(16, 7, 16, BlockId.Stone);
    const r = checkShelter(w, 16.5, 4, 16.5, changed);
    expect(r).toMatchObject({ roof: true, walls: 2, ok: false });
  });

  it("des murs d'un seul bloc de haut suffisent (pieds ou tête) ; trop loin, ils ne comptent pas", () => {
    const { w, changed } = setup();
    w.set(16 + SHELTER_WALL_REACH, 4, 16, BlockId.Dirt); // à la limite : compte
    w.set(16 - SHELTER_WALL_REACH - 1, 4, 16, BlockId.Dirt); // un bloc trop loin : ne compte pas
    w.set(16, 5, 16 + 2, BlockId.Dirt); // à hauteur de tête seulement
    w.set(16, 4, 16 - 1, BlockId.Dirt);
    const r = checkShelter(w, 16.5, 4, 16.5, changed);
    expect(r.walls).toBe(3);
  });

  it("toit trop haut : ne compte pas", () => {
    const { w, changed } = setup();
    w.set(16, 4 + 2 + SHELTER_ROOF_REACH, 16, BlockId.Stone);
    expect(checkShelter(w, 16.5, 4, 16.5, changed).roof).toBe(false);
    w.set(16, 4 + 1 + SHELTER_ROOF_REACH, 16, BlockId.Stone);
    expect(checkShelter(w, 16.5, 4, 16.5, changed).roof).toBe(true);
  });

  it("abri naturel (sous-bois : feuilles et troncs d'origine) : pas « fait par l'enfant »", () => {
    const w = World.createFlat(32, 16, 32, 4);
    w.set(16, 7, 16, BlockId.Leaves);
    w.set(17, 4, 16, BlockId.Log);
    w.set(15, 4, 16, BlockId.Log);
    w.set(16, 4, 18, BlockId.Log);
    const base = w.data.slice(); // le sous-bois fait partie du monde généré
    const changed = (x: number, y: number, z: number) => w.get(x, y, z) !== base[w.index(x, y, z)];
    expect(checkShelter(w, 16.5, 4, 16.5, changed)).toEqual({ roof: true, walls: 3, own: false, ok: false });
    // Un seul bloc posé par l'enfant dans le quatrième côté en fait son abri.
    w.set(16, 4, 14, BlockId.Dirt);
    expect(checkShelter(w, 16.5, 4, 16.5, changed)).toMatchObject({ walls: 4, own: true, ok: true });
  });

  it("terrier creusé dans une colline : il compte (l'enfant se tient dans un creux qu'il a creusé)", () => {
    const w = World.createFlat(32, 16, 32, 4);
    for (let x = 10; x < 22; x++) for (let z = 10; z < 22; z++) for (let y = 4; y < 9; y++) w.set(x, y, z, BlockId.Stone);
    const base = w.data.slice();
    const changed = (x: number, y: number, z: number) => w.get(x, y, z) !== base[w.index(x, y, z)];
    // Galerie de 1 × 2 depuis le bord sud, jusqu'en (16, 16).
    for (let z = 16; z < 22; z++) for (let y = 4; y < 6; y++) w.set(16, y, z, BlockId.Air);
    expect(checkShelter(w, 16.5, 4, 16.5, changed)).toEqual({ roof: true, walls: 3, own: true, ok: true });
  });

  it("le bord du monde ne sert pas de mur", () => {
    const { w, changed } = setup();
    w.set(0, 4, 0, BlockId.Stone);
    w.set(0, 4, 3, BlockId.Stone);
    w.set(0, 6, 1, BlockId.Stone);
    const r = checkShelter(w, 0.5, 4, 1.5, changed);
    expect(r.walls).toBe(2); // nord et sud ; ouest = hors du monde, est = vide
    expect(r.ok).toBe(false);
  });

  it("un creux d'un bloc au pied d'un arbre, sous le feuillage : pas un abri (relecture J6)", () => {
    const w = World.createFlat(32, 16, 32, 4);
    for (let y = 4; y < 8; y++) w.set(16, y, 15, BlockId.Log);
    for (let x = 14; x <= 18; x++) for (let z = 13; z <= 17; z++) for (let y = 7; y < 9; y++) if (w.get(x, y, z) === BlockId.Air) w.set(x, y, z, BlockId.Leaves);
    const base = w.data.slice();
    const changed = (x: number, y: number, z: number) => w.get(x, y, z) !== base[w.index(x, y, z)];
    w.set(16, 3, 16, BlockId.Air); // l'enfant creuse la case voisine du tronc et s'y tient
    const r = checkShelter(w, 16.5, 3, 16.5, changed);
    expect(r.roof).toBe(true);
    expect(r.walls).toBe(4);
    expect(r).toMatchObject({ own: false, ok: false });
    // Un bloc posé par l'enfant parmi les murs en fait son abri.
    w.set(17, 4, 16, BlockId.Dirt);
    expect(checkShelter(w, 16.5, 3, 16.5, changed).ok).toBe(true);
  });

  it("un terrier sous un plafond de feuilles posé à ras de la tête : pas un terrier (plafond d'arbre)", () => {
    const w = World.createFlat(32, 16, 32, 4);
    w.set(16, 5, 16, BlockId.Leaves);
    const base = w.data.slice();
    const changed = (x: number, y: number, z: number) => w.get(x, y, z) !== base[w.index(x, y, z)];
    w.set(16, 3, 16, BlockId.Air);
    expect(checkShelter(w, 16.5, 3, 16.5, changed)).toMatchObject({ roof: true, own: false, ok: false });
  });
});
