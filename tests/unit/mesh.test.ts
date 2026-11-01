import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BLOCKS, BlockId, Tile } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import { ChunkRenderer } from "../../src/render/ChunkRenderer";
import { LetterGhosts, DONE_SECONDS, MAX_MARKS, NEXT_OPACITY_MAX, NEXT_OPACITY_MIN, NEXT_STILL_OPACITY } from "../../src/render/LetterGhosts";
import { ghostCubes, meshSection, srgbToLinear, WATER_SURFACE, type MeshData } from "../../src/render/mesher";
import { ATLAS_COLS, ATLAS_HEIGHT, ATLAS_ROWS, ATLAS_WIDTH, tileOrigin, tileUv } from "../../src/render/atlas";

function vertices(m: MeshData): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < m.positions.length; i += 3) out.push(new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
  return out;
}

function trianglesOutward(m: MeshData, centre: THREE.Vector3): boolean {
  const v = vertices(m);
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = v[m.indices[t]!]!;
    const b = v[m.indices[t + 1]!]!;
    const c = v[m.indices[t + 2]!]!;
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const outward = a.clone().add(b).add(c).divideScalar(3).sub(centre);
    if (normal.dot(outward) <= 0) return false;
  }
  return true;
}

describe("maillage d'une section", () => {
  it("un bloc isolé a 6 faces, toutes orientées vers l'extérieur", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.Stone);
    const m = meshSection(w, 0, 0, 0);
    expect(m.faces).toBe(6);
    expect(trianglesOutward(m.opaque!, new THREE.Vector3(1.5, 1.5, 1.5))).toBe(true);
  });

  it("supprime les faces cachées entre deux blocs voisins", () => {
    const w = new World(4, 3, 3);
    w.set(1, 1, 1, BlockId.Stone);
    w.set(2, 1, 1, BlockId.Stone);
    expect(meshSection(w, 0, 0, 0).faces).toBe(10);
  });

  it("supprime aussi les faces cachées d'une section à l'autre", () => {
    const w = new World(32, 16, 16);
    w.set(15, 5, 5, BlockId.Stone); // section 0
    w.set(16, 5, 5, BlockId.Stone); // section 1
    expect(meshSection(w, 0, 0, 0).faces).toBe(5);
    expect(meshSection(w, 1, 0, 0).faces).toBe(5);
  });

  it("ne dessine ni le dessous du monde ni ses bords extérieurs", () => {
    const edge = new World(3, 3, 3);
    edge.set(0, 1, 1, BlockId.Stone);
    expect(meshSection(edge, 0, 0, 0).faces).toBe(5); // pas de face vers x < 0

    const w = new World(3, 3, 3);
    w.set(1, 0, 1, BlockId.Stone);
    expect(meshSection(w, 0, 0, 0).faces).toBe(5);
  });

  it("ombrage en couleur linéaire (constat 13) : face du dessus pleine, côtés plus sombres", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.Stone);
    const cols = new Set(Array.from(meshSection(w, 0, 0, 0).opaque!.colors));
    expect(cols.has(255)).toBe(true); // dessus sans occlusion
    expect(cols.has(Math.round(srgbToLinear(0.8) * 255))).toBe(true); // côté ±X
    expect(cols.has(Math.round(0.8 * 255))).toBe(false); // l'ancien calcul (non converti) n'existe plus
  });

  it("occlusion ambiante : le sol est plus sombre au pied d'un mur", () => {
    const w = World.createFlat(8, 8, 8, 1); // une seule couche au sol
    w.set(3, 1, 3, BlockId.Stone);
    const m = meshSection(w, 0, 0, 0).opaque!;
    const v = vertices(m);
    const colorAt = (x: number, y: number, z: number) => {
      const vals: number[] = [];
      v.forEach((p, i) => {
        if (p.x === x && p.y === y && p.z === z) vals.push(m.colors[i * 3]!);
      });
      return Math.max(...vals);
    };
    expect(colorAt(4, 1, 3.5 - 0.5)).toBeLessThan(255); // coin au contact du mur
    expect(colorAt(6, 1, 6)).toBe(255); // loin du mur
  });

  it("eau : seule la surface au contact de l'air est dessinée, un peu abaissée", () => {
    const w = World.createFlat(5, 6, 5, 2);
    for (let x = 1; x < 4; x++) for (let z = 1; z < 4; z++) for (let y = 1; y < 2; y++) w.set(x, y, z, BlockId.Water);
    // cuvette : le bord (x ou z = 0 / 4) reste en terre
    const m = meshSection(w, 0, 0, 0);
    expect(m.water).not.toBeNull();
    expect(m.water!.faces).toBe(9); // 3 × 3 faces du dessus
    const ys = new Set(vertices(m.water!).map((p) => p.y));
    expect([...ys]).toEqual([1 + WATER_SURFACE]);
    // les faces des blocs pleins au contact de l'eau restent dessinées (on voit le fond)
    expect(m.opaque!.faces).toBeGreaterThan(0);
  });

  it("fleur : deux plans croisés dans la couche « découpe », le sol garde sa face", () => {
    const w = World.createFlat(3, 4, 3, 1);
    w.set(1, 1, 1, BlockId.FlowerRed);
    const m = meshSection(w, 0, 0, 0);
    expect(m.cutout!.faces).toBe(2);
    expect(m.opaque!.faces).toBe(9); // les 9 faces du dessus ; rien vers l'extérieur du monde
  });

  it("les UV restent dans leur tuile (retrait minime, constat 14 ; atlas 8 × 8 au V2 lot 1)", () => {
    const [u0, v0, u1, v1] = tileUv(9);
    expect(u1 - u0).toBeGreaterThan(0.124);
    expect(v1 - v0).toBeGreaterThan(0.124);
    expect(v1 - v0).toBeLessThan(0.125);
    expect(u0).toBeGreaterThan(1 / 8);
    expect(u1).toBeLessThan(2 / 8);
    // Tuile 9 : ligne 1 (en partant du haut de l'image), soit v entre 6/8 et 7/8.
    expect(v0).toBeGreaterThan(6 / 8);
    expect(v1).toBeLessThan(7 / 8);
  });
});

describe("atlas (V2 lot 1 : 8 × 8 tuiles)", () => {
  it("128 × 128 px, 64 tuiles", () => {
    expect([ATLAS_COLS, ATLAS_ROWS]).toEqual([8, 8]);
    expect([ATLAS_WIDTH, ATLAS_HEIGHT]).toEqual([128, 128]);
  });

  it("toutes les tuiles du registre (dessus, côtés, dessous) tiennent dans l'atlas", () => {
    for (const d of BLOCKS) {
      for (const t of [d.tiles.top, d.tiles.side, d.tiles.bottom]) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(ATLAS_COLS * ATLAS_ROWS);
      }
    }
    const [, v0] = tileUv(Tile.LetterZ);
    expect(v0).toBeGreaterThan(0);
  });

  it("les tuiles 0 à 18 gardent leur place dans l'image (seules leurs valeurs v changent)", () => {
    for (let k = 0; k <= 18; k++) expect(tileOrigin(k)).toEqual([(k % 8) * 16, Math.floor(k / 8) * 16]);
    expect(tileOrigin(Tile.Rainbow)).toEqual([32, 32]);
    expect(tileOrigin(Tile.Glass)).toEqual([48, 32]);
    expect(tileOrigin(Tile.LetterA)).toEqual([64, 32]);
    expect(tileOrigin(Tile.LetterZ)).toEqual([80, 80]);
  });
});

/** Bornes de la tuile : toutes les UV d'un maillage sont-elles aux bords de cette tuile ? */
function uvsInTile(m: MeshData, tile: number): boolean {
  const [u0, v0, u1, v1] = tileUv(tile);
  for (let i = 0; i < m.uvs.length; i += 2) {
    const u = m.uvs[i]!;
    const v = m.uvs[i + 1]!;
    if (!(Math.abs(u - u0) < 1e-6 || Math.abs(u - u1) < 1e-6)) return false;
    if (!(Math.abs(v - v0) < 1e-6 || Math.abs(v - v1) < 1e-6)) return false;
  }
  return true;
}

/** Plus grande valeur de gris parmi les sommets d'un maillage situés en (x, y, z). */
function colorAt(m: MeshData, x: number, y: number, z: number): number {
  const vals: number[] = [];
  vertices(m).forEach((p, i) => {
    if (p.x === x && p.y === y && p.z === z) vals.push(m.colors[i * 3]!);
  });
  return Math.max(...vals);
}

describe("verre (V2 lot 1)", () => {
  it("verre isolé : 6 faces dans la couche verre, aucune ailleurs, toutes orientées vers l'extérieur", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.Glass);
    const m = meshSection(w, 0, 0, 0);
    expect(m.glass!.faces).toBe(6);
    expect(m.opaque).toBeNull();
    expect(m.cutout).toBeNull();
    expect(m.water).toBeNull();
    expect(m.faces).toBe(6);
    expect(trianglesOutward(m.glass!, new THREE.Vector3(1.5, 1.5, 1.5))).toBe(true);
  });

  it("deux verres voisins : la face commune n'est pas dessinée (vitre continue)", () => {
    const w = new World(4, 3, 3);
    w.set(1, 1, 1, BlockId.Glass);
    w.set(2, 1, 1, BlockId.Glass);
    expect(meshSection(w, 0, 0, 0).glass!.faces).toBe(10);
  });

  it("deux verres de part et d'autre d'une frontière de section : 5 faces de chaque côté", () => {
    const w = new World(32, 16, 16);
    w.set(15, 5, 5, BlockId.Glass);
    w.set(16, 5, 5, BlockId.Glass);
    expect(meshSection(w, 0, 0, 0).glass!.faces).toBe(5);
    expect(meshSection(w, 1, 0, 0).glass!.faces).toBe(5);
  });

  it("pierre contre verre : la pierre garde la face qu'on voit à travers la vitre, le verre perd la sienne", () => {
    const w = new World(4, 3, 3);
    w.set(1, 1, 1, BlockId.Stone);
    w.set(2, 1, 1, BlockId.Glass);
    const m = meshSection(w, 0, 0, 0);
    expect(m.opaque!.faces).toBe(6);
    expect(m.glass!.faces).toBe(5);
  });

  it("le sol sous un verre garde sa face du dessus ; le dessous du verre est caché par le sol", () => {
    const w = World.createFlat(3, 4, 3, 1);
    w.set(1, 1, 1, BlockId.Glass);
    const m = meshSection(w, 0, 0, 0);
    expect(m.opaque!.faces).toBe(9);
    expect(m.glass!.faces).toBe(5);
  });

  it("le verre ne fait pas d'ombre au sol (la pierre, si)", () => {
    const withGlass = World.createFlat(8, 8, 8, 1);
    withGlass.set(3, 1, 3, BlockId.Glass);
    expect(colorAt(meshSection(withGlass, 0, 0, 0).opaque!, 4, 1, 3)).toBe(255);
    const withStone = World.createFlat(8, 8, 8, 1);
    withStone.set(3, 1, 3, BlockId.Stone);
    expect(colorAt(meshSection(withStone, 0, 0, 0).opaque!, 4, 1, 3)).toBeLessThan(255);
  });

  it("les faces du verre sont assombries par les blocs pleins voisins (coins du bas, contre le sol)", () => {
    const w = World.createFlat(8, 8, 8, 1);
    w.set(3, 1, 3, BlockId.Glass);
    const m = meshSection(w, 0, 0, 0).glass!;
    const sides = quads(m).filter((q) => Math.abs(q.n.y) < 1e-6);
    expect(sides.length).toBe(4);
    for (const q of sides) {
      // Sommets du bas (y = 1, contre le sol) plus sombres que ceux du haut (y = 2), restés à la valeur de la face.
      const top = q.c.filter((_, i) => q.p[i]!.y === 2);
      const bottom = q.c.filter((_, i) => q.p[i]!.y === 1);
      expect(Math.max(...bottom)).toBeLessThan(Math.min(...top));
      expect(new Set(top)).toEqual(new Set([Math.round(srgbToLinear(Math.abs(q.n.x) > 0.5 ? 0.8 : 0.9) * 255)]));
    }
  });

  it("ombrage en couleur linéaire identique aux cubes", () => {
    const glass = new World(3, 3, 3);
    glass.set(1, 1, 1, BlockId.Glass);
    const stone = new World(3, 3, 3);
    stone.set(1, 1, 1, BlockId.Stone);
    const g = meshSection(glass, 0, 0, 0).glass!;
    const s = meshSection(stone, 0, 0, 0).opaque!;
    expect(Array.from(g.colors)).toEqual(Array.from(s.colors));
    expect(Array.from(g.positions)).toEqual(Array.from(s.positions));
    const cols = new Set(Array.from(g.colors));
    expect(cols.has(255)).toBe(true);
    expect(cols.has(Math.round(srgbToLinear(0.8) * 255))).toBe(true);
    expect(cols.has(Math.round(srgbToLinear(0.55) * 255))).toBe(true);
  });

  it("verre contre eau (aquarium) : la face de contact est dessinée des deux côtés", () => {
    const w = new World(4, 3, 3);
    w.set(1, 1, 1, BlockId.Water);
    w.set(2, 1, 1, BlockId.Glass);
    const m = meshSection(w, 0, 0, 0);
    expect(m.water!.faces).toBe(6);
    expect(m.glass!.faces).toBe(6);
  });

  it("fleur posée sur un verre : 2 faces en découpe, le dessus du verre reste dessiné", () => {
    const w = World.createFlat(3, 4, 3, 1);
    w.set(1, 1, 1, BlockId.Glass);
    w.set(1, 2, 1, BlockId.FlowerRed);
    const m = meshSection(w, 0, 0, 0);
    expect(m.cutout!.faces).toBe(2);
    expect(m.glass!.faces).toBe(5);
  });

  it("pas de face de verre tournée vers l'extérieur du monde", () => {
    const w = new World(3, 3, 3);
    w.set(0, 1, 1, BlockId.Glass);
    expect(meshSection(w, 0, 0, 0).glass!.faces).toBe(5);
  });

  it("les UV de la couche verre restent dans la tuile du verre", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.Glass);
    expect(uvsInTile(meshSection(w, 0, 0, 0).glass!, Tile.Glass)).toBe(true);
  });
});

interface Quad {
  p: THREE.Vector3[];
  uv: [number, number][];
  /** Gris des 4 sommets. */
  c: number[];
  n: THREE.Vector3;
}

/** Quadrilatères d'un maillage (4 sommets consécutifs) : positions, UV, gris et normale. */
function quads(m: MeshData): Quad[] {
  const v = vertices(m);
  const out: Quad[] = [];
  for (let q = 0; q < v.length; q += 4) {
    const p = v.slice(q, q + 4);
    const uv: [number, number][] = [0, 1, 2, 3].map((i) => [m.uvs[(q + i) * 2]!, m.uvs[(q + i) * 2 + 1]!]);
    const c = [0, 1, 2, 3].map((i) => m.colors[(q + i) * 3]!);
    const n = new THREE.Vector3().subVectors(p[1]!, p[0]!).cross(new THREE.Vector3().subVectors(p[2]!, p[0]!)).normalize();
    out.push({ p, uv, c, n });
  }
  return out;
}

describe("blocs-lettres (V2 lot 1)", () => {
  it("sur les 4 côtés, la lettre se lit à l'endroit : u vers la droite du spectateur, v vers le haut", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.LetterL);
    const m = meshSection(w, 0, 0, 0).opaque!;
    const [u0, v0, u1, v1] = tileUv(Tile.LetterL);
    const sides = quads(m).filter((q) => Math.abs(q.n.y) < 1e-6);
    expect(sides.length).toBe(4);
    // UV stockées en Float32 : comparaison à la même précision.
    const find = (q: Quad, u: number, v: number) => q.p[q.uv.findIndex(([a, b]) => a === Math.fround(u) && b === Math.fround(v))]!;
    for (const q of sides) {
      const origin = find(q, u0, v0);
      const right = find(q, u1, v0);
      const up = find(q, u0, v1);
      // Droite du spectateur placé devant la face (regard −n) : (−n) × haut = (nz, 0, −nx).
      const viewerRight = new THREE.Vector3(q.n.z, 0, -q.n.x);
      expect(right.clone().sub(origin).dot(viewerRight)).toBeGreaterThan(0);
      expect(up.y - origin.y).toBeGreaterThan(0);
      expect(up.x).toBe(origin.x);
      expect(up.z).toBe(origin.z);
    }
  });

  it("la lettre est sur les côtés ; dessus et dessous en planches", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.LetterM);
    const m = meshSection(w, 0, 0, 0).opaque!;
    const [lu0, lv0] = tileUv(Tile.LetterM);
    const [pu0, pv0] = tileUv(Tile.Planks);
    for (const q of quads(m)) {
      const minU = Math.min(...q.uv.map(([u]) => u));
      const minV = Math.min(...q.uv.map(([, v]) => v));
      const expected = Math.abs(q.n.y) > 0.5 ? [pu0, pv0] : [lu0, lv0];
      expect([minU, minV]).toEqual(expected.map(Math.fround));
    }
  });

  it("cubes fantômes : 6 faces par cube, mêmes UV que le bloc, gris 255, positions absolues", () => {
    const g = ghostCubes([
      { x: 20, y: 5, z: 30, id: BlockId.LetterA },
      { x: 21, y: 5, z: 30, id: BlockId.LetterB },
    ]);
    expect(g.faces).toBe(12);
    expect(new Set(Array.from(g.colors))).toEqual(new Set([255]));
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.LetterA);
    const block = meshSection(w, 0, 0, 0).opaque!;
    expect(Array.from(g.uvs.subarray(0, 48))).toEqual(Array.from(block.uvs));
    // Mêmes sommets que le bloc posé, décalés à sa place dans le monde.
    const shifted = Array.from(block.positions).map((c, i) => c - 1 + [20, 5, 30][i % 3]!);
    expect(Array.from(g.positions.subarray(0, 72))).toEqual(shifted);
    expect(trianglesOutward({ ...g, indices: g.indices.subarray(0, 36) } as MeshData, new THREE.Vector3(20.5, 5.5, 30.5))).toBe(true);
    const ps = vertices(g);
    expect(Math.min(...ps.map((p) => p.x))).toBe(20);
    expect(Math.max(...ps.map((p) => p.x))).toBe(22);
  });

  it("cubes fantômes : aucune case, maillage vide ; identifiant hors registre ignoré", () => {
    expect(ghostCubes([]).faces).toBe(0);
    expect(ghostCubes([]).positions.length).toBe(0);
    expect(ghostCubes([{ x: 0, y: 0, z: 0, id: 250 as BlockId }]).faces).toBe(0);
  });
});

describe("rendu par sections", () => {
  const mats = {
    opaque: new THREE.MeshBasicMaterial(),
    cutout: new THREE.MeshBasicMaterial(),
    water: new THREE.MeshBasicMaterial(),
    glass: new THREE.MeshBasicMaterial(),
  };

  it("maille tout le monde, puis seulement la section touchée", () => {
    const w = World.createFlat(48, 32, 48, 4);
    const r = new ChunkRenderer(w, mats);
    r.update(24, 10, 24, 1e9);
    expect(r.pendingCount()).toBe(0);
    expect(r.stats.faces).toBe(48 * 48); // les faces du dessus seulement
    w.set(20, 5, 20, BlockId.Stone); // intérieur de la section (1, 0, 1)
    expect(r.update(24, 10, 24, 1e9)).toBe(1);
    w.set(16, 5, 20, BlockId.Stone); // frontière x = 16
    expect(r.update(24, 10, 24, 1e9)).toBe(2);
    expect(r.update(24, 10, 24, 1e9)).toBe(0);
  });

  it("respecte le budget : les sections les plus proches d'abord", () => {
    const w = World.createFlat(128, 16, 128, 4);
    const r = new ChunkRenderer(w, mats);
    r.update(8, 5, 8, 0); // budget nul : une seule section
    expect(r.pendingCount()).toBe(63);
    expect(r.pendingNear(8, 8, 0)).toBe(0); // celle du joueur est prête
    expect(r.pendingNear(8, 8, 20)).toBeGreaterThan(0);
  });

  it("masque les sections au-delà de la distance de rendu", () => {
    const w = World.createFlat(128, 16, 128, 4);
    const r = new ChunkRenderer(w, mats);
    r.renderDistance = 32;
    r.update(8, 5, 8, 1e9);
    expect(r.stats.visibleSections).toBeLessThan(20);
    r.renderDistance = 256;
    r.update(8, 5, 8, 1e9);
    expect(r.stats.visibleSections).toBe(64);
  });

  it("le verre a sa propre couche : maillage « glass 1,0,1 », dessiné après l'eau (ordre 2)", () => {
    const w = World.createFlat(48, 32, 48, 4);
    w.set(20, 5, 20, BlockId.Glass); // section (1, 0, 1)
    w.set(30, 4, 30, BlockId.Water); // eau au ras du sol, section (1, 0, 1)
    const r = new ChunkRenderer(w, mats);
    r.update(24, 10, 24, 1e9);
    const glass = r.group.getObjectByName("glass 1,0,1") as THREE.Mesh;
    expect(glass).toBeDefined();
    expect(glass.material).toBe(mats.glass);
    expect(glass.renderOrder).toBe(2);
    expect((r.group.getObjectByName("water 1,0,1") as THREE.Mesh).renderOrder).toBe(1);
    expect((r.group.getObjectByName("opaque 1,0,1") as THREE.Mesh).renderOrder).toBe(0);
    expect(r.group.getObjectByName("glass 0,0,0")).toBeUndefined(); // section sans verre : pas de maillage
  });

  it("casser le dernier verre d'une section retire le maillage de la couche verre", () => {
    const w = World.createFlat(48, 32, 48, 4);
    w.set(20, 5, 20, BlockId.Glass);
    w.set(21, 5, 20, BlockId.Glass);
    const r = new ChunkRenderer(w, mats);
    r.update(24, 10, 24, 1e9);
    const faces = r.stats.faces;
    w.set(21, 5, 20, BlockId.Air);
    r.update(24, 10, 24, 1e9);
    expect(r.group.getObjectByName("glass 1,0,1")).toBeDefined();
    expect(r.stats.faces).toBe(faces - 4); // 10 faces de verre → 6, et le sol garde ses faces sous la vitre
    w.set(20, 5, 20, BlockId.Air);
    r.update(24, 10, 24, 1e9);
    expect(r.group.getObjectByName("glass 1,0,1")).toBeUndefined();
    expect(r.stats.faces).toBe(48 * 48);
  });
});

describe("fantômes des lettres (mission 2)", () => {
  const atlas = new THREE.Texture();
  const A = { x: 10, y: 4, z: 10, id: BlockId.LetterA };
  const M = { x: 11, y: 4, z: 10, id: BlockId.LetterM };
  const I = { x: 12, y: 4, z: 10, id: BlockId.LetterI };
  const meshNamed = (g: LetterGhosts, name: string) => g.group.getObjectByName(name) as THREE.Mesh;

  it("cases claires et case suivante : la suivante n'est pas dessinée deux fois", () => {
    const g = new LetterGhosts(atlas);
    g.setGhosts([A, M, I], A);
    expect(g.shown).toMatchObject({ ghosts: 2, next: true });
    const next = meshNamed(g, "case suivante");
    expect(next.geometry.getIndex()!.count).toBe(36);
    expect(g.group.getObjectByName("contour suivant")!.visible).toBe(true);
    expect(g.group.getObjectByName("contour suivant")!.position.toArray()).toEqual([10.5, 4.5, 10.5]);
    g.setGhosts([], null);
    expect(g.shown).toMatchObject({ ghosts: 0, next: false });
    expect(g.group.getObjectByName("contour suivant")!.visible).toBe(false);
  });

  it("ne reconstruit la géométrie que si les cases changent ; au plus 10 cubes", () => {
    const g = new LetterGhosts(atlas);
    g.setGhosts([A, M, I], M);
    const geo = meshNamed(g, "cases claires").geometry;
    g.setGhosts([A, M, I], M);
    expect(meshNamed(g, "cases claires").geometry).toBe(geo);
    g.setGhosts([A, { ...M, id: BlockId.LetterN }, I], { ...M, id: BlockId.LetterN });
    expect(meshNamed(g, "cases claires").geometry).toBe(geo); // la case suivante seule a changé
    g.setGhosts([A, M, I], null); // plus de case suivante : M rejoint les cases claires
    expect(meshNamed(g, "cases claires").geometry).not.toBe(geo);
    expect(g.shown).toMatchObject({ ghosts: 3, next: false });
    const many = Array.from({ length: 14 }, (_, k) => ({ x: k, y: 4, z: 3, id: BlockId.LetterE }));
    g.setGhosts(many, many[0]!);
    expect(g.shown.ghosts + 1).toBe(10);
  });

  it("la case suivante respire (0,35 à 0,75), fixe si les animations sont réduites", () => {
    const g = new LetterGhosts(atlas);
    g.setGhosts([A], A);
    const mat = meshNamed(g, "case suivante").material as THREE.MeshBasicMaterial;
    const seen: number[] = [];
    for (let k = 0; k < 60; k++) {
      g.update(1 / 60, false);
      seen.push(mat.opacity);
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(NEXT_OPACITY_MIN - 1e-9);
    expect(Math.max(...seen)).toBeLessThanOrEqual(NEXT_OPACITY_MAX + 1e-9);
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.3);
    g.update(0.37, true);
    expect(mat.opacity).toBe(NEXT_STILL_OPACITY);
    expect((meshNamed(g, "cases claires").material as THREE.MeshBasicMaterial).opacity).toBe(0.42);
  });

  it("contours : orange sur les lettres à revoir, vert 1,2 s sur un mot réussi (sans relance si rien ne change)", () => {
    const g = new LetterGhosts(atlas);
    const lines = () => g.group.children.filter((o) => o.name.startsWith("contour ") && o.visible) as THREE.LineSegments[];
    const hex = (l: THREE.LineSegments) => (l.material as THREE.LineBasicMaterial).color.getHex();
    g.setMarks({ wrong: [[11, 4, 10]], done: [] });
    expect(lines().map(hex)).toEqual([0xff8a3c]);
    expect(lines()[0]!.position.toArray()).toEqual([11.5, 4.5, 10.5]);
    const word: [number, number, number][] = [[10, 4, 10], [11, 4, 10], [12, 4, 10]];
    g.setMarks({ wrong: [], done: word });
    expect(lines().map(hex)).toEqual([0x5cbe5c, 0x5cbe5c, 0x5cbe5c]);
    g.update(DONE_SECONDS * 0.75, false);
    g.setMarks({ wrong: [], done: word }); // rappelé à chaque image : le délai ne repart pas
    expect(g.shown.done).toBe(3);
    g.update(DONE_SECONDS * 0.5, false);
    expect(lines().length).toBe(0);
    expect(g.shown.done).toBe(0);
    // Au plus 10 contours.
    const wrong = Array.from({ length: 15 }, (_, k): [number, number, number] => [k, 4, 0]);
    g.setMarks({ wrong, done: [] });
    expect(lines().length).toBe(MAX_MARKS);
  });

  it("la luminosité du jour et de la nuit s'applique à la couleur des matériaux", () => {
    const g = new LetterGhosts(atlas);
    g.setGhosts([A, M], A);
    g.setBrightness(0.4);
    const expected = new THREE.Color().setRGB(0.4, 0.4, 0.4, THREE.SRGBColorSpace).r;
    expect((meshNamed(g, "cases claires").material as THREE.MeshBasicMaterial).color.r).toBeCloseTo(expected, 6);
    expect((meshNamed(g, "case suivante").material as THREE.MeshBasicMaterial).color.g).toBeCloseTo(expected, 6);
    const line = g.group.getObjectByName("contour suivant") as THREE.LineSegments;
    const c = (line.material as THREE.LineBasicMaterial).color;
    expect(c.r).toBeCloseTo(new THREE.Color(0xffd23f).r * expected, 6);
    g.setBrightness(1);
    expect(c.getHex()).toBe(0xffd23f);
    expect(g.shown.brightness).toBe(1);
  });

  it("libère ses ressources", () => {
    const g = new LetterGhosts(atlas);
    g.setGhosts([A], A);
    g.dispose();
    expect(g.group.children.length).toBe(0);
  });
});
