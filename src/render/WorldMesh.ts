import * as THREE from "three";
import { BlockId, blockDef } from "../engine/blocks";
import type { World } from "../engine/World";
import { tileUv } from "./textures";

/**
 * Une face = normale, 4 sommets (sens trigonométrique vu de l'extérieur,
 * les deux premiers en bas pour les faces latérales) et un facteur d'ombrage
 * fixe qui donne du relief sans calcul d'éclairage.
 */
interface FaceDef {
  n: [number, number, number];
  v: [number, number, number][];
  shade: number;
  which: "top" | "side" | "bottom";
}

const FACES: FaceDef[] = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.78, which: "side" },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.78, which: "side" },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, which: "top" },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, which: "bottom" },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.88, which: "side" },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.88, which: "side" },
];

const UV_CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/**
 * Maillage du monde entier (J0). Seules les faces en contact avec l'air
 * sont générées ; la face du dessous au niveau y = 0 est omise.
 * J1 remplacera ceci par un maillage par chunk.
 */
export class WorldMesh {
  readonly mesh: THREE.Mesh;
  private builtVersion = -1;

  constructor(
    private readonly world: World,
    material: THREE.Material,
  ) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
  }

  /** Reconstruit la géométrie si le monde a changé. Retourne le nombre de faces. */
  update(): number {
    if (this.builtVersion === this.world.changeVersion) return -1;
    this.builtVersion = this.world.changeVersion;
    return this.rebuild();
  }

  private rebuild(): number {
    const w = this.world;
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertexCount = 0;
    let faces = 0;

    for (let y = 0; y < w.sizeY; y++) {
      for (let z = 0; z < w.sizeZ; z++) {
        for (let x = 0; x < w.sizeX; x++) {
          const id = w.get(x, y, z);
          if (id === BlockId.Air) continue;
          const def = blockDef(id);
          for (const f of FACES) {
            const nx = x + f.n[0];
            const ny = y + f.n[1];
            const nz = z + f.n[2];
            if (ny < 0) continue; // dessous du monde : invisible
            if (w.isSolid(nx, ny, nz)) continue;

            const tile = def.tiles[f.which];
            const [u0, v0, u1, v1] = tileUv(tile);
            for (let i = 0; i < 4; i++) {
              const v = f.v[i]!;
              positions.push(x + v[0], y + v[1], z + v[2]);
              const c = UV_CORNERS[i]!;
              uvs.push(c[0] === 0 ? u0 : u1, c[1] === 0 ? v0 : v1);
              colors.push(f.shade, f.shade, f.shade);
            }
            indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
            vertexCount += 4;
            faces++;
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    return faces;
  }
}
