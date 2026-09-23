import { BlockId, BLOCKS, isOpaqueId, type BlockDef } from "../engine/blocks";
import { SECTION_SIZE, type World } from "../engine/World";
import { tileUv } from "./atlas";

/**
 * Maillage d'une section de 16³ blocs (calcul pur, sans Three.js : testé en
 * Node). Trois couches, chacune dessinée avec son matériau :
 * - opaque : cubes pleins (faces au contact d'un bloc non opaque seulement) ;
 * - cutout : plantes en croix (fleurs), texture à trous ;
 * - water : eau semi-transparente (faces au contact de l'air seulement).
 *
 * Les faces tournées vers l'extérieur du monde ne sont pas produites : on ne
 * peut pas sortir du monde, elles ne seraient jamais vues.
 *
 * Ombrage sans lumière : un facteur fixe par orientation de face et une
 * occlusion ambiante par sommet (coins sombres là où les blocs se touchent).
 * Les facteurs sont convertis en couleur linéaire, car Three.js traite les
 * couleurs de sommets comme linéaires (constat 13 de l'audit J0).
 * Positions relatives à l'origine de la section.
 */
export interface MeshData {
  positions: Float32Array;
  uvs: Float32Array;
  /** Gris par sommet (r = g = b), normalisé 0-255, en linéaire. */
  colors: Uint8Array;
  indices: Uint16Array | Uint32Array;
  faces: number;
}

export interface SectionMesh {
  opaque: MeshData | null;
  cutout: MeshData | null;
  water: MeshData | null;
  faces: number;
}

type V3 = [number, number, number];

interface FaceDef {
  n: V3;
  /** 4 sommets, sens trigonométrique vu de l'extérieur, les deux premiers en bas pour les faces latérales. */
  v: V3[];
  /** Luminosité perçue (sRGB) de la face. */
  shade: number;
  which: "top" | "side" | "bottom";
}

const FACES: FaceDef[] = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8, which: "side" },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8, which: "side" },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, which: "top" },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, which: "bottom" },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9, which: "side" },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9, which: "side" },
];

/** Luminosité perçue selon le nombre de voisins qui masquent le coin : 0 = coin le plus sombre. */
const AO_LEVELS = [0.5, 0.68, 0.84, 1.0];

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const toByte = (perceived: number) => Math.round(srgbToLinear(Math.min(1, Math.max(0, perceived))) * 255);

/** LIGHT[face][ao] : gris linéaire (0-255) d'un sommet. */
const LIGHT: number[][] = FACES.map((f) => AO_LEVELS.map((a) => toByte(f.shade * a)));
const WATER_LIGHT: number[] = FACES.map((f) => toByte(f.shade));
const PLANT_BOTTOM = toByte(0.78);
const PLANT_TOP = toByte(1.0);

/**
 * Pour chaque face et chaque sommet : les trois voisins qui peuvent masquer
 * le coin (deux côtés et la diagonale), dans la couche située devant la face.
 */
const AO_OFFSETS: V3[][][] = FACES.map((f) =>
  f.v.map((v) => {
    const axes = [0, 1, 2].filter((a) => f.n[a] === 0);
    const a1 = axes[0]!;
    const a2 = axes[1]!;
    const d1 = v[a1] === 1 ? 1 : -1;
    const d2 = v[a2] === 1 ? 1 : -1;
    const offset = (k1: number, k2: number): V3 => {
      const o: V3 = [f.n[0], f.n[1], f.n[2]];
      o[a1] = o[a1]! + k1;
      o[a2] = o[a2]! + k2;
      return o;
    };
    return [offset(d1, 0), offset(0, d2), offset(d1, d2)];
  }),
);

const UV_CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** Hauteur de la surface de l'eau quand rien n'est posé dessus. */
export const WATER_SURFACE = 0.875;

const CROSS: V3[][] = [
  [
    [0.15, 0, 0.15],
    [0.85, 0, 0.85],
    [0.85, 1, 0.85],
    [0.15, 1, 0.15],
  ],
  [
    [0.15, 0, 0.85],
    [0.85, 0, 0.15],
    [0.85, 1, 0.15],
    [0.15, 1, 0.85],
  ],
];

/** Tampon extensible réutilisé d'une section à l'autre (évite les allocations). */
class Builder {
  private pos = new Float32Array(3 * 4096);
  private uv = new Float32Array(2 * 4096);
  private col = new Uint8Array(3 * 4096);
  private idx = new Uint32Array(6 * 1024);
  private nv = 0;
  private ni = 0;
  faces = 0;

  reset(): void {
    this.nv = 0;
    this.ni = 0;
    this.faces = 0;
  }

  private grow(): void {
    const g = <T extends Float32Array | Uint8Array | Uint32Array>(a: T): T => {
      const b = new (a.constructor as new (n: number) => T)(a.length * 2);
      b.set(a);
      return b;
    };
    this.pos = g(this.pos);
    this.uv = g(this.uv);
    this.col = g(this.col);
    this.idx = g(this.idx);
  }

  /**
   * Ajoute un quadrilatère. `p` : 4 sommets (x, y, z) à plat ; `uv` : tuile ;
   * `light` : gris des 4 sommets ; `flip` : diagonale 1-3 au lieu de 0-2
   * (évite une traînée sombre en travers de la face).
   */
  quad(p: number[], uv: readonly [number, number, number, number], l0: number, l1: number, l2: number, l3: number, flip: boolean): void {
    if ((this.nv + 4) * 3 > this.pos.length || this.ni + 6 > this.idx.length) this.grow();
    const v = this.nv;
    this.pos.set(p, v * 3);
    for (let i = 0; i < 4; i++) {
      const c = UV_CORNERS[i]!;
      this.uv[(v + i) * 2] = c[0] === 0 ? uv[0] : uv[2];
      this.uv[(v + i) * 2 + 1] = c[1] === 0 ? uv[1] : uv[3];
    }
    const ls = [l0, l1, l2, l3];
    for (let i = 0; i < 4; i++) {
      const l = ls[i]!;
      this.col[(v + i) * 3] = l;
      this.col[(v + i) * 3 + 1] = l;
      this.col[(v + i) * 3 + 2] = l;
    }
    const k = this.ni;
    if (flip) {
      this.idx[k] = v + 1;
      this.idx[k + 1] = v + 2;
      this.idx[k + 2] = v + 3;
      this.idx[k + 3] = v + 1;
      this.idx[k + 4] = v + 3;
      this.idx[k + 5] = v;
    } else {
      this.idx[k] = v;
      this.idx[k + 1] = v + 1;
      this.idx[k + 2] = v + 2;
      this.idx[k + 3] = v;
      this.idx[k + 4] = v + 2;
      this.idx[k + 5] = v + 3;
    }
    this.nv += 4;
    this.ni += 6;
    this.faces++;
  }

  finish(): MeshData | null {
    if (this.nv === 0) return null;
    const indices = this.nv <= 65535 ? Uint16Array.from(this.idx.subarray(0, this.ni)) : this.idx.slice(0, this.ni);
    return {
      positions: this.pos.slice(0, this.nv * 3),
      uvs: this.uv.slice(0, this.nv * 2),
      colors: this.col.slice(0, this.nv * 3),
      indices,
      faces: this.faces,
    };
  }
}

const opaqueB = new Builder();
const cutoutB = new Builder();
const waterB = new Builder();

/** Tuiles pré-calculées : UV[bloc][face]. */
const UVS: (readonly [number, number, number, number])[][] = BLOCKS.map((d: BlockDef) => FACES.map((f) => tileUv(d.tiles[f.which])));

export function meshSection(world: World, sx: number, sy: number, sz: number): SectionMesh {
  const S = SECTION_SIZE;
  const W = world.sizeX;
  const H = world.sizeY;
  const D = world.sizeZ;
  const data = world.data;
  const x0 = sx * S;
  const y0 = sy * S;
  const z0 = sz * S;
  const x1 = Math.min(x0 + S, W);
  const y1 = Math.min(y0 + S, H);
  const z1 = Math.min(z0 + S, D);

  /** Bloc aux coordonnées du monde. Hors du monde : air, sauf en dessous (plein : le dessous n'est jamais vu). */
  const at = (x: number, y: number, z: number): number => {
    if (y < 0) return BlockId.Stone;
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return BlockId.Air;
    return data[(y * D + z) * W + x]!;
  };
  const op = (x: number, y: number, z: number): number => (isOpaqueId(at(x, y, z)) ? 1 : 0);

  opaqueB.reset();
  cutoutB.reset();
  waterB.reset();
  const p = new Array<number>(12);
  const ao = [0, 0, 0, 0];

  for (let y = y0; y < y1; y++) {
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const id = data[(y * D + z) * W + x]!;
        if (id === BlockId.Air) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const lx = x - x0;
        const ly = y - y0;
        const lz = z - z0;

        if (def.shape === "cube") {
          for (let f = 0; f < 6; f++) {
            const face = FACES[f]!;
            const nx = x + face.n[0];
            const nz = z + face.n[2];
            // Face tournée vers l'extérieur du monde : jamais visible (on ne peut pas sortir).
            if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
            if (isOpaqueId(at(nx, y + face.n[1], nz))) continue;
            const offs = AO_OFFSETS[f]!;
            for (let i = 0; i < 4; i++) {
              const o = offs[i]!;
              const a = o[0]!;
              const b = o[1]!;
              const c = o[2]!;
              const s1 = op(x + a[0], y + a[1], z + a[2]);
              const s2 = op(x + b[0], y + b[1], z + b[2]);
              const cc = op(x + c[0], y + c[1], z + c[2]);
              ao[i] = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
              const v = face.v[i]!;
              p[i * 3] = lx + v[0];
              p[i * 3 + 1] = ly + v[1];
              p[i * 3 + 2] = lz + v[2];
            }
            const L = LIGHT[f]!;
            opaqueB.quad(p, UVS[id]![f]!, L[ao[0]!]!, L[ao[1]!]!, L[ao[2]!]!, L[ao[3]!]!, ao[0]! + ao[2]! < ao[1]! + ao[3]!);
          }
        } else if (def.shape === "liquid") {
          const top = at(x, y + 1, z) === id ? 1 : WATER_SURFACE;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f]!;
            const nx = x + face.n[0];
            const nz = z + face.n[2];
            // Pas de « mur d'eau » au bord du monde : la mer se prolonge au-delà (plan d'océan, SceneView).
            if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
            const nb = at(nx, y + face.n[1], nz);
            if (nb === id || isOpaqueId(nb)) continue;
            for (let i = 0; i < 4; i++) {
              const v = face.v[i]!;
              p[i * 3] = lx + v[0];
              p[i * 3 + 1] = ly + (v[1] === 1 ? top : 0);
              p[i * 3 + 2] = lz + v[2];
            }
            const l = WATER_LIGHT[f]!;
            waterB.quad(p, UVS[id]![f]!, l, l, l, l, false);
          }
        } else {
          // Plante en croix
          const uv = UVS[id]![0]!;
          for (const q of CROSS) {
            for (let i = 0; i < 4; i++) {
              const v = q[i]!;
              p[i * 3] = lx + v[0];
              p[i * 3 + 1] = ly + v[1];
              p[i * 3 + 2] = lz + v[2];
            }
            cutoutB.quad(p, uv, PLANT_BOTTOM, PLANT_BOTTOM, PLANT_TOP, PLANT_TOP, false);
          }
        }
      }
    }
  }

  const opaque = opaqueB.finish();
  const cutout = cutoutB.finish();
  const water = waterB.finish();
  return { opaque, cutout, water, faces: (opaque?.faces ?? 0) + (cutout?.faces ?? 0) + (water?.faces ?? 0) };
}
