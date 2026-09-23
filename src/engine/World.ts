import { BlockId, isSolidId } from "./blocks";

/**
 * Monde de blocs de taille fixe (J0 : un seul tableau ; J1 : découpage en
 * chunks). Les coordonnées sont entières ; le bloc (x, y, z) occupe le cube
 * [x, x+1] × [y, y+1] × [z, z+1].
 */
export class World {
  readonly data: Uint8Array;
  private version = 0;

  constructor(
    readonly sizeX: number,
    readonly sizeY: number,
    readonly sizeZ: number,
  ) {
    this.data = new Uint8Array(sizeX * sizeY * sizeZ);
  }

  /** Incrémenté à chaque modification : permet au rendu de savoir quoi reconstruire. */
  get changeVersion(): number {
    return this.version;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ;
  }

  index(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
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
    return true;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return isSolidId(this.get(x, y, z));
  }

  /**
   * Solidité vue par la physique : les bords horizontaux du monde et le
   * dessous (y < 0) sont des murs invisibles, pour qu'on ne tombe jamais
   * dans le vide. Le ciel (y ≥ hauteur du monde) reste libre. Les rayons de
   * visée utilisent `isSolid`, on ne peut donc pas viser ces murs.
   */
  isSolidForPhysics(x: number, y: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ || y < 0) return true;
    if (y >= this.sizeY) return false;
    return isSolidId(this.data[this.index(x, y, z)] ?? 0);
  }

  /**
   * Hauteur des pieds pour se tenir debout en (x, z) : le plus bas bloc
   * d'air ayant un bloc solide dessous et `clearance` blocs d'air libres.
   * Sert au point d'apparition : on arrive au sol, jamais sur un feuillage.
   * Retourne null si la colonne n'offre aucune place.
   */
  findStandingY(x: number, z: number, clearance = 2): number | null {
    if (x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ) return null;
    for (let y = 1; y + clearance <= this.sizeY; y++) {
      if (!this.isSolid(x, y - 1, z)) continue;
      let free = true;
      for (let k = 0; k < clearance; k++) {
        if (this.isSolid(x, y + k, z)) {
          free = false;
          break;
        }
      }
      if (free) return y;
    }
    return null;
  }

  /** Hauteur du premier bloc d'air au-dessus du sol en (x, z), ou 0. */
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
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          w.data[w.index(x, y, z)] = id;
        }
      }
    }
    return w;
  }
}
