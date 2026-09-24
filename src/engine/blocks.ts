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
  // J1
  Water = 7,
  Leaves = 8,
  FlowerRed = 9,
  FlowerYellow = 10,
  Snow = 11,
  Cactus = 12,
}

/**
 * Index des tuiles dans l'atlas de textures (voir render/atlas.ts et
 * render/textures.ts). Même règle que les blocs : on ajoute à la fin.
 */
export enum Tile {
  GrassTop = 0,
  GrassSide = 1,
  Dirt = 2,
  Stone = 3,
  Planks = 4,
  Sand = 5,
  LogSide = 6,
  LogTop = 7,
  // J1
  Water = 8,
  Leaves = 9,
  FlowerRed = 10,
  FlowerYellow = 11,
  Snow = 12,
  CactusSide = 13,
  CactusTop = 14,
}

/**
 * Forme de rendu :
 * - cube : bloc plein et opaque, cache les faces de ses voisins ;
 * - cross : plante dessinée par deux plans croisés (fleurs) ;
 * - liquid : eau, semi-transparente, dessinée seulement au contact de l'air.
 */
export type BlockShape = "cube" | "cross" | "liquid";

export interface BlockDef {
  id: BlockId;
  /** Nom affiché aux enfants (français, minuscule). */
  name: string;
  /** Bloque le joueur (physique). */
  solid: boolean;
  /** Peut être visé, cassé et servir d'appui pour poser (rayon de visée). */
  targetable: boolean;
  shape: BlockShape;
  /** Tuiles : dessus, côtés, dessous. */
  tiles: { top: Tile; side: Tile; bottom: Tile };
  /** Durée d'appui maintenu pour casser le bloc (ms) ; 0 = immédiat (J2). */
  breakMs: number;
}

const same = (t: Tile) => ({ top: t, side: t, bottom: t });

const defs: BlockDef[] = [
  { id: BlockId.Air, name: "air", solid: false, targetable: false, shape: "cube", tiles: same(0), breakMs: 0 },
  { id: BlockId.Grass, name: "herbe", solid: true, targetable: true, shape: "cube", tiles: { top: Tile.GrassTop, side: Tile.GrassSide, bottom: Tile.Dirt }, breakMs: 350 },
  { id: BlockId.Dirt, name: "terre", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Dirt), breakMs: 350 },
  { id: BlockId.Stone, name: "pierre", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Stone), breakMs: 650 },
  { id: BlockId.Planks, name: "planches", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Planks), breakMs: 500 },
  { id: BlockId.Sand, name: "sable", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Sand), breakMs: 300 },
  { id: BlockId.Log, name: "tronc", solid: true, targetable: true, shape: "cube", tiles: { top: Tile.LogTop, side: Tile.LogSide, bottom: Tile.LogTop }, breakMs: 550 },
  { id: BlockId.Water, name: "eau", solid: false, targetable: false, shape: "liquid", tiles: same(Tile.Water), breakMs: 0 },
  { id: BlockId.Leaves, name: "feuilles", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Leaves), breakMs: 200 },
  { id: BlockId.FlowerRed, name: "fleur rouge", solid: false, targetable: true, shape: "cross", tiles: same(Tile.FlowerRed), breakMs: 0 },
  { id: BlockId.FlowerYellow, name: "fleur jaune", solid: false, targetable: true, shape: "cross", tiles: same(Tile.FlowerYellow), breakMs: 0 },
  { id: BlockId.Snow, name: "neige", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Snow), breakMs: 300 },
  { id: BlockId.Cactus, name: "cactus", solid: true, targetable: true, shape: "cube", tiles: { top: Tile.CactusTop, side: Tile.CactusSide, bottom: Tile.CactusTop }, breakMs: 450 },
];

export const BLOCKS: readonly BlockDef[] = defs;

export function blockDef(id: number): BlockDef {
  return defs[id] ?? defs[0]!;
}

/**
 * Durée d'appui maintenu nécessaire pour casser un bloc (ms), 0 = immédiat.
 * Identifiant inconnu (hors registre, non entier) : 0.
 */
export function breakDurationMs(id: number): number {
  return defs[id]?.breakMs ?? 0;
}

// Tables de consultation rapides (le maillage et la physique les interrogent des millions de fois).
const SOLID = new Uint8Array(256);
const OPAQUE = new Uint8Array(256);
const TARGETABLE = new Uint8Array(256);
for (const d of defs) {
  SOLID[d.id] = d.solid ? 1 : 0;
  OPAQUE[d.id] = d.shape === "cube" && d.id !== BlockId.Air ? 1 : 0;
  TARGETABLE[d.id] = d.targetable ? 1 : 0;
}

export function isSolidId(id: number): boolean {
  return SOLID[id] === 1;
}

/** Cube plein et opaque : cache les faces voisines et fait de l'ombre (occlusion ambiante). */
export function isOpaqueId(id: number): boolean {
  return OPAQUE[id] === 1;
}

export function isTargetableId(id: number): boolean {
  return TARGETABLE[id] === 1;
}

/** Plante (fleur) : remplacée quand on pose un bloc dessus, cueillie si son support disparaît. */
export function isPlantId(id: number): boolean {
  return blockDef(id).shape === "cross";
}

/** Blocs proposés dans la barre d'inventaire du prototype (touches 1 à 9). */
export const HOTBAR_BLOCKS: readonly BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Planks,
  BlockId.Sand,
  BlockId.Log,
  BlockId.Leaves,
  BlockId.Snow,
  BlockId.Cactus,
];
