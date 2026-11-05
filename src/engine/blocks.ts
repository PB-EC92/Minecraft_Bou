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
  // J5
  Lamp = 13,
  Fence = 14,
  GlowStone = 15,
  // J6
  Rainbow = 16,
  // V2 lot 1 : verre (fabriqué) et blocs-lettres (mission 2)
  Glass = 17,
  LetterA = 18,
  LetterB = 19,
  LetterC = 20,
  LetterD = 21,
  LetterE = 22,
  LetterF = 23,
  LetterG = 24,
  LetterH = 25,
  LetterI = 26,
  LetterJ = 27,
  LetterK = 28,
  LetterL = 29,
  LetterM = 30,
  LetterN = 31,
  LetterO = 32,
  LetterP = 33,
  LetterQ = 34,
  LetterR = 35,
  LetterS = 36,
  LetterT = 37,
  LetterU = 38,
  LetterV = 39,
  LetterW = 40,
  LetterX = 41,
  LetterY = 42,
  LetterZ = 43,
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
  // J5
  Lamp = 15,
  Fence = 16,
  GlowStone = 17,
  // J6
  Rainbow = 18,
  // V2 lot 1 : verre, puis une face par lettre (côtés des blocs-lettres)
  Glass = 19,
  LetterA = 20,
  LetterB = 21,
  LetterC = 22,
  LetterD = 23,
  LetterE = 24,
  LetterF = 25,
  LetterG = 26,
  LetterH = 27,
  LetterI = 28,
  LetterJ = 29,
  LetterK = 30,
  LetterL = 31,
  LetterM = 32,
  LetterN = 33,
  LetterO = 34,
  LetterP = 35,
  LetterQ = 36,
  LetterR = 37,
  LetterS = 38,
  LetterT = 39,
  LetterU = 40,
  LetterV = 41,
  LetterW = 42,
  LetterX = 43,
  LetterY = 44,
  LetterZ = 45,
}

/**
 * Forme de rendu :
 * - cube : bloc plein et opaque, cache les faces de ses voisins ;
 * - cross : plante dessinée par deux plans croisés (fleurs) ;
 * - liquid : eau, semi-transparente, dessinée seulement au contact de l'air ;
 * - glass : cube plein et transparent ; bloque le joueur et se vise ; ne cache pas les faces de ses voisins
 *   et ne fait pas d'ombre (non opaque) ; ses faces contre le même verre ne sont pas dessinées.
 */
export type BlockShape = "cube" | "cross" | "liquid" | "glass";

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

/** Les 26 lettres des blocs-lettres (mission 2), dans l'ordre des identifiants : LETTERS[k] ↔ BlockId.LetterA + k. */
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
  { id: BlockId.FlowerRed, name: "fleur rouge", solid: false, targetable: true, shape: "cross", tiles: same(Tile.FlowerRed), breakMs: 150 },
  { id: BlockId.FlowerYellow, name: "fleur jaune", solid: false, targetable: true, shape: "cross", tiles: same(Tile.FlowerYellow), breakMs: 150 },
  { id: BlockId.Snow, name: "neige", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Snow), breakMs: 300 },
  { id: BlockId.Cactus, name: "cactus", solid: true, targetable: true, shape: "cube", tiles: { top: Tile.CactusTop, side: Tile.CactusSide, bottom: Tile.CactusTop }, breakMs: 450 },
  // J5 : la lampe éloigne les créatures ; elles ne franchissent pas la clôture ; la pierre brillante donne une lampe.
  // V2 lot 1 : la clôture se fabrique avec des planches (les troncs n'en rapportent plus).
  { id: BlockId.Lamp, name: "lampe", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Lamp), breakMs: 250 },
  { id: BlockId.Fence, name: "clôture", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Fence), breakMs: 400 },
  { id: BlockId.GlowStone, name: "pierre brillante", solid: true, targetable: true, shape: "cube", tiles: same(Tile.GlowStone), breakMs: 500 },
  // J6 : récompense de la mission 1 (on ne le trouve pas dans la nature).
  { id: BlockId.Rainbow, name: "arc-en-ciel", solid: true, targetable: true, shape: "cube", tiles: same(Tile.Rainbow), breakMs: 300 },
  // V2 lot 1 : verre, fabriqué avec du sable (on ne le trouve pas dans la nature) ; on voit à travers, on ne passe pas.
  { id: BlockId.Glass, name: "verre", solid: true, targetable: true, shape: "glass", tiles: same(Tile.Glass), breakMs: 300 },
  // V2 lot 1 : blocs-lettres de la mission 2, A à Z (boîte à lettres illimitée ; jamais dans le sac). La lettre est
  // sur les quatre côtés ; dessus et dessous restent en planches (une lettre couchée tournerait selon le point de vue).
  ...Array.from(
    LETTERS,
    (c, k): BlockDef => ({
      id: (BlockId.LetterA + k) as BlockId,
      name: `lettre ${c}`,
      solid: true,
      targetable: true,
      shape: "cube",
      tiles: { top: Tile.Planks, side: (Tile.LetterA + k) as Tile, bottom: Tile.Planks },
      breakMs: 200,
    }),
  ),
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

/**
 * Cube plein et opaque : cache les faces voisines et fait de l'ombre (occlusion ambiante).
 * Le verre (forme glass) n'est pas opaque : on voit ses voisins à travers ; les blocs-lettres le sont.
 */
export function isOpaqueId(id: number): boolean {
  return OPAQUE[id] === 1;
}

export function isTargetableId(id: number): boolean {
  return TARGETABLE[id] === 1;
}

/**
 * Ce que rapporte un bloc cassé (J5) : son propre type en général ; la pierre
 * brillante donne une lampe. Air, eau et identifiants inconnus : rien. Un
 * bloc-lettre retourne dans sa boîte : rien dans le sac (V2 lot 1).
 * Depuis le V2 lot 1, un tronc ne rapporte plus de clôture (décision 3 de
 * Pierre : elle se fabrique avec des planches) ; extra vaut donc toujours null,
 * le champ est gardé pour les appelants.
 */
export function dropsOf(id: number): { main: BlockId | null; extra: BlockId | null } {
  if (!defs[id] || id === BlockId.Air || id === BlockId.Water) return { main: null, extra: null };
  if (id === BlockId.GlowStone) return { main: BlockId.Lamp, extra: null };
  if (isLetterId(id)) return { main: null, extra: null };
  return { main: id as BlockId, extra: null };
}

/** Bloc-lettre (mission 2) : identifiant entier de BlockId.LetterA (18) à BlockId.LetterZ (43). */
export function isLetterId(id: number): boolean {
  return Number.isInteger(id) && id >= BlockId.LetterA && id <= BlockId.LetterZ;
}

/** Lettre d'un bloc-lettre (BlockId.LetterA → "A") ; tout autre identifiant : null. */
export function letterChar(id: number): string | null {
  return isLetterId(id) ? LETTERS.charAt(id - BlockId.LetterA) : null;
}

/** Bloc d'une lettre : une seule capitale de A à Z ("M" → BlockId.LetterM) ; "a", "É", "1", "AB" ou "" : null. */
export function letterBlockId(ch: string): BlockId | null {
  if (typeof ch !== "string" || !/^[A-Z]$/.test(ch)) return null;
  return (BlockId.LetterA + LETTERS.indexOf(ch)) as BlockId;
}

/** Plante (fleur) : remplacée quand on pose un bloc dessus, cueillie si son support disparaît. */
export function isPlantId(id: number): boolean {
  return blockDef(id).shape === "cross";
}

/** Kit de test (bouton « Compléter le sac » du panneau) : 9 cases ; au J5, lampe et clôture remplacent neige et cactus. */
export const HOTBAR_BLOCKS: readonly BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Planks,
  BlockId.Sand,
  BlockId.Log,
  BlockId.Leaves,
  BlockId.Lamp,
  BlockId.Fence,
];
