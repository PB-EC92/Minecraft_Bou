import { BlockId } from "./blocks";
import { createNoise2D, fbm, hash2, type Noise2D } from "./noise";
import { World } from "./World";

/**
 * Génération du monde par type (décision du 23/09/2026 : « plein de pays »
 * = plusieurs types de monde au choix). Le choix par l'enfant arrive avec
 * l'écran d'accueil au J4 ; en J1 il se fait dans le panneau « Tests » ou
 * par l'adresse (`cubes.html#monde=ile&graine=1234`).
 *
 * Même type + même graine = même monde, à l'identique.
 */
export type WorldTypeId = "prairie" | "ile" | "montagne" | "desert" | "plat";

export interface WorldTypeDef {
  id: WorldTypeId;
  /** Nom affiché (français). */
  name: string;
  /** Proposé aux enfants (le monde plat ne sert qu'aux tests). */
  forChildren: boolean;
}

export const WORLD_TYPES: readonly WorldTypeDef[] = [
  { id: "prairie", name: "prairie", forChildren: true },
  { id: "ile", name: "île", forChildren: true },
  { id: "montagne", name: "montagne", forChildren: true },
  { id: "desert", name: "désert", forChildren: true },
  { id: "plat", name: "plat (test)", forChildren: false },
];

export function worldTypeName(id: WorldTypeId): string {
  return WORLD_TYPES.find((t) => t.id === id)?.name ?? id;
}

export function parseWorldType(s: string | null | undefined): WorldTypeId | null {
  if (!s) return null;
  const k = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return WORLD_TYPES.find((t) => t.id === k)?.id ?? null;
}

/** Dimensions des mondes générés : 128 × 64 × 128 blocs (≈ 30 s pour traverser en marchant). */
export const WORLD_SIZE = 128;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 20;
const SNOW_LINE = 45;
const ROCK_LINE = 39;

/** Monde plat de test (reprend le J0) : 32 × 16 × 32, surface à y = 4. */
export const FLAT_SIZE = 32;
export const FLAT_HEIGHT = 16;
export const FLAT_GROUND = 4;

export interface Spawn {
  x: number;
  y: number;
  z: number;
}

export interface GeneratedWorld {
  world: World;
  type: WorldTypeId;
  seed: number;
  spawn: Spawn;
  stats: { trees: number; flowers: number; cacti: number };
}

/** Graine au hasard, courte pour pouvoir être notée et retapée. */
export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 999_999);
}

export function generateWorld(type: WorldTypeId, seed: number): GeneratedWorld {
  if (type === "plat") return generateFlat(seed);
  return new TerrainGenerator(type, seed).run();
}

function generateFlat(seed: number): GeneratedWorld {
  const w = World.createFlat(FLAT_SIZE, FLAT_HEIGHT, FLAT_SIZE, FLAT_GROUND);
  buildTestStructures(w);
  w.markAllChanged();
  const sx = FLAT_SIZE / 2;
  const sz = FLAT_SIZE / 2 + 4;
  // Au sol, jamais sur un feuillage ni dans un bloc (constat 3 de l'audit J0).
  const y = w.findStandingY(sx, sz) ?? FLAT_GROUND;
  return { world: w, type: "plat", seed, spawn: { x: sx + 0.5, y: y + 0.01, z: sz + 0.5 }, stats: { trees: 1, flowers: 0, cacti: 0 } };
}

/** Quelques éléments du J0 pour tester saut, collisions et visée : escalier, mur à porte, arbre, sable. */
function buildTestStructures(w: World): void {
  const G = FLAT_GROUND;
  const cx = FLAT_SIZE / 2;
  const cz = FLAT_SIZE / 2;
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k <= i; k++) w.set(cx - 6 + i, G + k, cz - 3, BlockId.Stone);
  }
  for (let x = cx + 2; x < cx + 8; x++) {
    for (let y = G; y < G + 3; y++) {
      if (x === cx + 4 && y < G + 2) continue;
      w.set(x, y, cz - 4, BlockId.Planks);
    }
  }
  const tx = cx - 6;
  const tz = cz + 7;
  for (let y = G; y < G + 4; y++) w.set(tx, y, tz, BlockId.Log);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 3; dy <= 5; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + (dy - 3) > 4) continue;
        if (w.get(tx + dx, G + dy, tz + dz) === BlockId.Air) w.set(tx + dx, G + dy, tz + dz, BlockId.Leaves);
      }
    }
  }
  for (let x = cx + 3; x < cx + 8; x++) for (let z = cz + 3; z < cz + 8; z++) w.set(x, G - 1, z, BlockId.Sand);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Blocs sur lesquels on peut apparaître (pas sur un arbre ni un cactus). */
const SPAWN_GROUND = new Set<BlockId>([BlockId.Grass, BlockId.Sand, BlockId.Dirt, BlockId.Snow, BlockId.Stone]);

class TerrainGenerator {
  private readonly world: World;
  private readonly S = WORLD_SIZE;
  private readonly heights: Int16Array;
  /** Désert : zones d'oasis (herbe autour de l'eau). */
  private readonly oasis: Float32Array;
  private readonly n1: Noise2D;
  private readonly n2: Noise2D;
  private readonly n3: Noise2D;
  private readonly stats = { trees: 0, flowers: 0, cacti: 0 };

  constructor(
    private readonly type: Exclude<WorldTypeId, "plat">,
    private readonly seed: number,
  ) {
    this.world = new World(this.S, WORLD_HEIGHT, this.S);
    this.world.seaLevel = SEA_LEVEL;
    this.heights = new Int16Array(this.S * this.S);
    this.oasis = new Float32Array(this.S * this.S);
    this.n1 = createNoise2D(seed);
    this.n2 = createNoise2D(seed + 1);
    this.n3 = createNoise2D(seed + 2);
  }

  run(): GeneratedWorld {
    this.computeHeights();
    this.fillColumns();
    this.decorate();
    this.world.markAllChanged();
    return { world: this.world, type: this.type, seed: this.seed, spawn: this.findSpawn(), stats: this.stats };
  }

  private h(x: number, z: number): number {
    const cx = Math.min(this.S - 1, Math.max(0, x));
    const cz = Math.min(this.S - 1, Math.max(0, z));
    return this.heights[cz * this.S + cx] ?? 0;
  }

  /** Hauteur = nombre de couches solides ; la surface est le bloc y = hauteur − 1. */
  private computeHeights(): void {
    const S = this.S;
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        let h: number;
        switch (this.type) {
          case "prairie": {
            h = 23 + 6 * fbm(this.n1, x / 56, z / 56, 4) + 2 * fbm(this.n2, x / 14, z / 14, 2);
            const lake = fbm(this.n3, x / 40, z / 40, 2);
            if (lake > 0.3) h -= (lake - 0.3) * 30; // quelques étangs
            break;
          }
          case "ile": {
            let d = Math.hypot(x - S / 2, z - S / 2) / (S / 2);
            d += 0.18 * fbm(this.n2, x / 40, z / 40, 3);
            const island = 1 - smoothstep(0.45, 0.95, d);
            h = 12 + island * (16 + 5 * fbm(this.n1, x / 32, z / 32, 4)) + 2 * fbm(this.n3, x / 12, z / 12, 2);
            break;
          }
          case "montagne": {
            // Chaînes de montagnes (arêtes) séparées par des vallées herbeuses.
            const ridge = 1 - Math.abs(fbm(this.n1, x / 48, z / 48, 4));
            const range = smoothstep(-0.4, 0.35, fbm(this.n2, x / 64, z / 64, 3));
            h = 22 + 5 * fbm(this.n3, x / 24, z / 24, 3) + range * 34 * Math.pow(ridge, 1.5);
            break;
          }
          case "desert": {
            h = 24 + 3 * fbm(this.n1, x / 40, z / 40, 3) + 1.5 * fbm(this.n2, x / 10, z / 10, 2);
            const o = fbm(this.n3, x / 30, z / 30, 2);
            this.oasis[z * S + x] = o;
            if (o > 0.4) h -= (o - 0.4) * 30;
            break;
          }
        }
        this.heights[z * S + x] = Math.round(Math.min(WORLD_HEIGHT - 9, Math.max(2, h)));
      }
    }
  }

  private slope(x: number, z: number): number {
    const h = this.h(x, z);
    return Math.max(
      Math.abs(h - this.h(x + 1, z)),
      Math.abs(h - this.h(x - 1, z)),
      Math.abs(h - this.h(x, z + 1)),
      Math.abs(h - this.h(x, z - 1)),
    );
  }

  /** Bloc de surface et bloc de sous-couche selon le type, l'altitude et la pente. */
  private layers(x: number, z: number, H: number): { top: BlockId; sub: BlockId; subDepth: number } {
    const top = H - 1;
    if (H <= SEA_LEVEL + 1) return { top: BlockId.Sand, sub: BlockId.Sand, subDepth: 3 }; // fond de l'eau et plages
    switch (this.type) {
      case "prairie":
        return { top: BlockId.Grass, sub: BlockId.Dirt, subDepth: 3 };
      case "ile":
        if (H <= SEA_LEVEL + 2) return { top: BlockId.Sand, sub: BlockId.Sand, subDepth: 3 };
        return { top: BlockId.Grass, sub: BlockId.Dirt, subDepth: 3 };
      case "montagne":
        if (top >= SNOW_LINE) return { top: BlockId.Snow, sub: BlockId.Stone, subDepth: 0 };
        if (top >= ROCK_LINE || this.slope(x, z) >= 4) return { top: BlockId.Stone, sub: BlockId.Stone, subDepth: 0 };
        return { top: BlockId.Grass, sub: BlockId.Dirt, subDepth: 2 };
      case "desert":
        if ((this.oasis[z * this.S + x] ?? 0) > 0.28) return { top: BlockId.Grass, sub: BlockId.Dirt, subDepth: 3 };
        return { top: BlockId.Sand, sub: BlockId.Sand, subDepth: 4 };
    }
  }

  private fillColumns(): void {
    const w = this.world;
    const S = this.S;
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const H = this.h(x, z);
        const { top, sub, subDepth } = this.layers(x, z, H);
        for (let y = 0; y < H; y++) {
          const depth = H - 1 - y;
          let id: BlockId;
          if (y === 0) id = BlockId.Stone;
          else if (depth === 0) id = top;
          else if (depth <= subDepth) id = sub;
          else id = BlockId.Stone;
          w.data[w.index(x, y, z)] = id;
        }
        for (let y = H; y < SEA_LEVEL; y++) w.data[w.index(x, y, z)] = BlockId.Water;
      }
    }
  }

  private surface(x: number, z: number): BlockId {
    return this.world.get(x, this.h(x, z) - 1, z);
  }

  private decorate(): void {
    const t = this.type;
    const grid = t === "ile" ? 6 : t === "desert" ? 7 : 7;
    const treeChance = t === "desert" ? 0.5 : t === "ile" ? 0.35 : t === "montagne" ? 0.3 : 0.22;
    const cells = Math.ceil(this.S / grid);
    for (let cz = 0; cz < cells; cz++) {
      for (let cx = 0; cx < cells; cx++) {
        if (hash2(cx, cz, this.seed ^ 0x51ed) >= treeChance) continue;
        const x = cx * grid + Math.floor(hash2(cx, cz, this.seed ^ 0x2a1b) * grid);
        const z = cz * grid + Math.floor(hash2(cx, cz, this.seed ^ 0x7f33) * grid);
        this.tryTree(x, z);
      }
    }
    if (t === "desert") {
      const g = 6;
      const n = Math.ceil(this.S / g);
      for (let cz = 0; cz < n; cz++) {
        for (let cx = 0; cx < n; cx++) {
          if (hash2(cx, cz, this.seed ^ 0x0cac) >= 0.16) continue;
          const x = cx * g + Math.floor(hash2(cx, cz, this.seed ^ 0x1cac) * g);
          const z = cz * g + Math.floor(hash2(cx, cz, this.seed ^ 0x2cac) * g);
          this.tryCactus(x, z);
        }
      }
    }
    const flowerChance = t === "prairie" ? 0.07 : t === "ile" ? 0.035 : t === "desert" ? 0.04 : 0.02;
    for (let z = 1; z < this.S - 1; z++) {
      for (let x = 1; x < this.S - 1; x++) {
        if (hash2(x, z, this.seed ^ 0xf10e) >= flowerChance) continue;
        const H = this.h(x, z);
        if (this.surface(x, z) !== BlockId.Grass || this.world.get(x, H, z) !== BlockId.Air) continue;
        const id = hash2(x, z, this.seed ^ 0xc01) < 0.5 ? BlockId.FlowerRed : BlockId.FlowerYellow;
        this.world.data[this.world.index(x, H, z)] = id;
        this.stats.flowers++;
      }
    }
  }

  private tryTree(x: number, z: number): void {
    const w = this.world;
    if (x < 2 || z < 2 || x > this.S - 3 || z > this.S - 3) return;
    const H = this.h(x, z);
    if (H <= SEA_LEVEL + 1 || H + 8 >= WORLD_HEIGHT) return;
    if (this.surface(x, z) !== BlockId.Grass || this.slope(x, z) > 1) return;
    const trunk = 4 + Math.floor(hash2(x, z, this.seed ^ 0x3e3) * 2);
    for (let y = H; y < H + trunk; y++) w.data[w.index(x, y, z)] = BlockId.Log;
    // Feuillage : deux couches larges, puis deux couches étroites, coins arrondis.
    for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
      const r = dy < trunk ? 2 : 1;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 1 ? dy === trunk + 1 : hash2(x + dx, z + dz, this.seed + dy) < 0.6)) continue;
          const px = x + dx;
          const py = H + dy;
          const pz = z + dz;
          if (!w.inBounds(px, py, pz)) continue;
          const i = w.index(px, py, pz);
          if (w.data[i] === BlockId.Air) w.data[i] = BlockId.Leaves;
        }
      }
    }
    this.stats.trees++;
  }

  private tryCactus(x: number, z: number): void {
    const w = this.world;
    if (x < 1 || z < 1 || x > this.S - 2 || z > this.S - 2) return;
    const H = this.h(x, z);
    if (H <= SEA_LEVEL + 1 || this.surface(x, z) !== BlockId.Sand) return;
    const height = 1 + Math.floor(hash2(x, z, this.seed ^ 0x4ca) * 3);
    for (let y = H; y < H + height; y++) w.data[w.index(x, y, z)] = BlockId.Cactus;
    this.stats.cacti++;
  }

  /** Ciel dégagé au-dessus d'une position : pas de feuillage ni de tronc sur 10 blocs. */
  private openSky(x: number, y: number, z: number): boolean {
    for (let k = 0; k < 10; k++) {
      const id = this.world.get(x, y + k, z);
      if (id === BlockId.Leaves || id === BlockId.Log || id === BlockId.Cactus) return false;
    }
    return true;
  }

  /** Point d'apparition : terre ferme la plus proche du centre, au sol, à ciel ouvert, hors de l'eau. */
  private findSpawn(): Spawn {
    const w = this.world;
    const c = this.S / 2;
    for (let r = 0; r < this.S / 2; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = c + dx;
          const z = c + dz;
          const y = w.findStandingY(x, z);
          if (y === null || y <= SEA_LEVEL) continue;
          if (!SPAWN_GROUND.has(w.get(x, y - 1, z)) || !this.openSky(x, y, z)) continue;
          return { x: x + 0.5, y: y + 0.01, z: z + 0.5 };
        }
      }
    }
    return { x: c + 0.5, y: w.surfaceHeight(c, c) + 0.01, z: c + 0.5 };
  }
}
