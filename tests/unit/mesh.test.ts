import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import { ChunkRenderer } from "../../src/render/ChunkRenderer";
import { meshSection, srgbToLinear, WATER_SURFACE, type MeshData } from "../../src/render/mesher";
import { tileUv } from "../../src/render/atlas";

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

  it("les UV restent dans leur tuile (retrait minime, constat 14)", () => {
    const [u0, v0, u1, v1] = tileUv(9);
    expect(u1 - u0).toBeGreaterThan(0.124);
    expect(v1 - v0).toBeGreaterThan(0.249);
    expect(u0).toBeGreaterThan(1 / 8);
    expect(u1).toBeLessThan(2 / 8);
  });
});

describe("rendu par sections", () => {
  const mats = { opaque: new THREE.MeshBasicMaterial(), cutout: new THREE.MeshBasicMaterial(), water: new THREE.MeshBasicMaterial() };

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
});
