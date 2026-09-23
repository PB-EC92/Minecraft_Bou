import { BlockId, isPlantId, isSolidId, isTargetableId } from "./blocks";

/** Côté d'une section (cube de 16 × 16 × 16 blocs) : unité de maillage et de mise à jour du rendu. */
export const SECTION_SIZE = 16;

/**
 * Monde de blocs de taille fixe. Les coordonnées sont entières ; le bloc
 * (x, y, z) occupe le cube [x, x+1] × [y, y+1] × [z, z+1].
 *
 * Stockage : un seul tableau (monde borné, 128 × 64 × 128 = 1 Mo). Découpage
 * en sections de 16³ pour le rendu : chaque section a un numéro de version,
 * incrémenté quand un de ses blocs change, ou quand un bloc voisin change à
 * sa frontière (les faces visibles et l'ombrage en dépendent). Le rendu ne
 * remaille ainsi que les sections touchées (constat 10 de l'audit J0).
 */
export class World {
  readonly data: Uint8Array;
  readonly sectionsX: number;
  readonly sectionsY: number;
  readonly sectionsZ: number;
  /** Niveau de la mer : l'eau remplit les creux sous cette hauteur (0 = pas de mer). */
  seaLevel = 0;
  private version = 0;
  private readonly sectionVersions: Uint32Array;

  constructor(
    readonly sizeX: number,
    readonly sizeY: number,
    readonly sizeZ: number,
  ) {
    this.data = new Uint8Array(sizeX * sizeY * sizeZ);
    this.sectionsX = Math.ceil(sizeX / SECTION_SIZE);
    this.sectionsY = Math.ceil(sizeY / SECTION_SIZE);
    this.sectionsZ = Math.ceil(sizeZ / SECTION_SIZE);
    this.sectionVersions = new Uint32Array(this.sectionsX * this.sectionsY * this.sectionsZ);
  }

  /** Incrémenté à chaque modification. */
  get changeVersion(): number {
    return this.version;
  }

  get sectionCount(): number {
    return this.sectionVersions.length;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ;
  }

  index(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  sectionIndex(sx: number, sy: number, sz: number): number {
    return (sy * this.sectionsZ + sz) * this.sectionsX + sx;
  }

  sectionVersion(sx: number, sy: number, sz: number): number {
    return this.sectionVersions[this.sectionIndex(sx, sy, sz)] ?? 0;
  }

  /** Hors limites : air. */
  get(x: number, y: number, z: number): BlockId {
    if (!this.inBounds(x, y, z)) return BlockId.Air;
    return this.data[this.index(x, y, z)] as BlockId;
  }

  /** Retourne false si hors limites ou inchangé. */
  set(x: number, y: number, z: number, id: BlockId): boolean {
    if (!this.inBounds(x, y, z)) return false;
    const i = this.index(x, y, z);
    if (this.data[i] === id) return false;
    this.data[i] = id;
    this.version++;
    this.touchSections(x, y, z);
    return true;
  }

  /**
   * Marque la section du bloc, et les sections voisines si le bloc est sur
   * une frontière (arêtes et coins compris : l'ombrage d'un sommet dépend
   * des blocs en diagonale).
   */
  private touchSections(x: number, y: number, z: number): void {
    const S = SECTION_SIZE;
    const sx = Math.floor(x / S);
    const sy = Math.floor(y / S);
    const sz = Math.floor(z / S);
    const lx = x - sx * S;
    const ly = y - sy * S;
    const lz = z - sz * S;
    const rx = lx === 0 ? -1 : lx === S - 1 ? 1 : 0;
    const ry = ly === 0 ? -1 : ly === S - 1 ? 1 : 0;
    const rz = lz === 0 ? -1 : lz === S - 1 ? 1 : 0;
    const dxs = rx === 0 ? [0] : [0, rx];
    const dys = ry === 0 ? [0] : [0, ry];
    const dzs = rz === 0 ? [0] : [0, rz];
    for (const dy of dys) {
      for (const dz of dzs) {
        for (const dx of dxs) {
          const nx = sx + dx;
          const ny = sy + dy;
          const nz = sz + dz;
          if (nx < 0 || ny < 0 || nz < 0 || nx >= this.sectionsX || ny >= this.sectionsY || nz >= this.sectionsZ) continue;
          const k = this.sectionIndex(nx, ny, nz);
          this.sectionVersions[k] = (this.sectionVersions[k] ?? 0) + 1;
        }
      }
    }
  }

  /** Après une écriture en masse dans `data` (génération) : tout est à remailler. */
  markAllChanged(): void {
    this.version++;
    for (let i = 0; i < this.sectionVersions.length; i++) this.sectionVersions[i] = (this.sectionVersions[i] ?? 0) + 1;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return isSolidId(this.get(x, y, z));
  }

  /** Visée : blocs pleins et plantes, pas l'eau ni l'air. */
  isTargetable(x: number, y: number, z: number): boolean {
    return isTargetableId(this.get(x, y, z));
  }

  isWater(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) === BlockId.Water;
  }

  /** Place où l'on peut se tenir : air ou plante (ni bloc plein, ni eau). */
  isOpenSpace(x: number, y: number, z: number): boolean {
    const id = this.get(x, y, z);
    return id === BlockId.Air || isPlantId(id);
  }

  /**
   * Solidité vue par la physique : les bords horizontaux du monde et le
   * dessous (y < 0) sont des murs invisibles, pour qu'on ne tombe jamais
   * dans le vide. Le ciel (y ≥ hauteur du monde) reste libre. Les rayons de
   * visée utilisent `isTargetable`, on ne peut donc pas viser ces murs.
   */
  isSolidForPhysics(x: number, y: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ || y < 0) return true;
    if (y >= this.sizeY) return false;
    return isSolidId(this.data[this.index(x, y, z)] ?? 0);
  }

  /**
   * Hauteur des pieds pour se tenir debout en (x, z) : le plus bas bloc
   * libre (air ou plante, jamais l'eau) ayant un bloc solide dessous et
   * `clearance` blocs libres. Sert au point d'apparition : on arrive au sol,
   * jamais sur un feuillage ni au fond de l'eau. Retourne null si la colonne
   * n'offre aucune place.
   */
  findStandingY(x: number, z: number, clearance = 2): number | null {
    if (x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ) return null;
    for (let y = 1; y + clearance <= this.sizeY; y++) {
      if (!this.isSolid(x, y - 1, z)) continue;
      let free = true;
      for (let k = 0; k < clearance; k++) {
        if (!this.isOpenSpace(x, y + k, z)) {
          free = false;
          break;
        }
      }
      if (free) return y;
    }
    return null;
  }

  /** Hauteur du premier bloc d'air au-dessus du plus haut bloc non vide en (x, z), ou 0. */
  surfaceHeight(x: number, z: number): number {
    for (let y = this.sizeY - 1; y >= 0; y--) {
      if (this.get(x, y, z) !== BlockId.Air) return y + 1;
    }
    return 0;
  }

  /**
   * Monde plat de test : pierre en dessous, terre, herbe en surface.
   * `groundHeight` = nombre de couches solides (la surface est à y = groundHeight).
   */
  static createFlat(sizeX: number, sizeY: number, sizeZ: number, groundHeight: number): World {
    const w = new World(sizeX, sizeY, sizeZ);
    for (let y = 0; y < Math.min(groundHeight, sizeY); y++) {
      let id: BlockId;
      if (y === groundHeight - 1) id = BlockId.Grass;
      else if (y >= groundHeight - 3) id = BlockId.Dirt;
      else id = BlockId.Stone;
      w.data.fill(id, w.index(0, y, 0), w.index(0, y + 1, 0));
    }
    return w;
  }
}
