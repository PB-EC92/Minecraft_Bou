import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import { WorldMesh } from "../../src/render/WorldMesh";

function meshOf(w: World): { mesh: WorldMesh; faces: number } {
  const mesh = new WorldMesh(w, new THREE.MeshBasicMaterial());
  return { mesh, faces: mesh.update() };
}

describe("WorldMesh", () => {
  it("un bloc isolé a 6 faces, toutes orientées vers l'extérieur", () => {
    const w = new World(3, 3, 3);
    w.set(1, 1, 1, BlockId.Stone);
    const { mesh, faces } = meshOf(w);
    expect(faces).toBe(6);
    const g = mesh.mesh.geometry;
    const pos = g.getAttribute("position");
    const idx = g.getIndex()!;
    const centre = new THREE.Vector3(1.5, 1.5, 1.5);
    for (let t = 0; t < idx.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, idx.getX(t + k))) as [
        THREE.Vector3,
        THREE.Vector3,
        THREE.Vector3,
      ];
      const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const outward = a.clone().add(b).add(c).divideScalar(3).sub(centre);
      expect(normal.dot(outward)).toBeGreaterThan(0);
    }
  });

  it("supprime les faces cachées entre deux blocs voisins", () => {
    const w = new World(4, 3, 3);
    w.set(1, 1, 1, BlockId.Stone);
    w.set(2, 1, 1, BlockId.Stone);
    expect(meshOf(w).faces).toBe(10);
  });

  it("ne dessine pas le dessous du monde", () => {
    const w = new World(3, 3, 3);
    w.set(1, 0, 1, BlockId.Stone);
    expect(meshOf(w).faces).toBe(5);
  });

  it("ne reconstruit que si le monde a changé", () => {
    const w = World.createFlat(4, 4, 4, 2);
    const { mesh } = meshOf(w);
    expect(mesh.update()).toBe(-1);
    w.set(1, 2, 1, BlockId.Stone);
    expect(mesh.update()).toBeGreaterThan(0);
  });
});
