/**
 * Registre des blocs. Les identifiants sont stockés dans un Uint8Array :
 * 0 = air, 255 valeurs possibles. Ne jamais renuméroter un bloc existant
 * (les sauvegardes en dépendent) ; ajouter à la fin.
 */

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Planks = 4,
  Sand = 5,
  Log = 6,
}

/** Index des tuiles dans l'atlas de textures (voir render/textures.ts). */
export enum Tile {
  GrassTop = 0,
  GrassSide = 1,
  Dirt = 2,
  Stone = 3,
  Planks = 4,
  Sand = 5,
  LogSide = 6,
  LogTop = 7,
}

export interface BlockDef {
  id: BlockId;
  /** Nom affiché aux enfants (français, minuscule). */
  name: string;
  /** Bloque le joueur et les rayons. */
  solid: boolean;
  /** Tuiles : dessus, côtés, dessous. */
  tiles: { top: Tile; side: Tile; bottom: Tile };
}

const defs: BlockDef[] = [
  { id: BlockId.Air, name: "air", solid: false, tiles: { top: 0, side: 0, bottom: 0 } },
  { id: BlockId.Grass, name: "herbe", solid: true, tiles: { top: Tile.GrassTop, side: Tile.GrassSide, bottom: Tile.Dirt } },
  { id: BlockId.Dirt, name: "terre", solid: true, tiles: { top: Tile.Dirt, side: Tile.Dirt, bottom: Tile.Dirt } },
  { id: BlockId.Stone, name: "pierre", solid: true, tiles: { top: Tile.Stone, side: Tile.Stone, bottom: Tile.Stone } },
  { id: BlockId.Planks, name: "planches", solid: true, tiles: { top: Tile.Planks, side: Tile.Planks, bottom: Tile.Planks } },
  { id: BlockId.Sand, name: "sable", solid: true, tiles: { top: Tile.Sand, side: Tile.Sand, bottom: Tile.Sand } },
  { id: BlockId.Log, name: "tronc", solid: true, tiles: { top: Tile.LogTop, side: Tile.LogSide, bottom: Tile.LogTop } },
];

export const BLOCKS: readonly BlockDef[] = defs;

export function blockDef(id: number): BlockDef {
  return defs[id] ?? defs[0]!;
}

export function isSolidId(id: number): boolean {
  return blockDef(id).solid;
}

/** Blocs proposés dans la barre d'inventaire du prototype. */
export const HOTBAR_BLOCKS: readonly BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Planks,
  BlockId.Sand,
  BlockId.Log,
];
