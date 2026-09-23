/**
 * Disposition de l'atlas de textures (calcul pur, sans DOM ni Three.js, pour
 * être testé en Node). Grille de 8 × 4 tuiles de 16 × 16 px ; tuile n° k en
 * colonne k % 8, ligne ⌊k / 8⌋ (ligne 0 en haut de l'image).
 */
export const TILE_SIZE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
export const ATLAS_WIDTH = TILE_SIZE * ATLAS_COLS;
export const ATLAS_HEIGHT = TILE_SIZE * ATLAS_ROWS;

/** Coin haut-gauche de la tuile dans l'image (pixels). */
export function tileOrigin(tile: number): [number, number] {
  return [(tile % ATLAS_COLS) * TILE_SIZE, Math.floor(tile / ATLAS_COLS) * TILE_SIZE];
}

/**
 * Retrait des UV : un cinquantième de texel suffit à ne jamais lire la tuile
 * voisine (filtrage « au plus proche »), sans rogner les pixels du bord
 * (constat 14 de l'audit J0 : le retrait d'un demi-texel les affichait à
 * demi-largeur).
 */
const INSET_U = 0.02 / ATLAS_WIDTH;
const INSET_V = 0.02 / ATLAS_HEIGHT;

/**
 * Coordonnées de texture (u0, v0, u1, v1) d'une tuile ; v0 = bas de la tuile.
 * La texture est retournée verticalement par Three.js (flipY) : la ligne 0
 * de l'image correspond au haut de l'espace UV.
 */
export function tileUv(tile: number): [number, number, number, number] {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const u0 = col / ATLAS_COLS + INSET_U;
  const u1 = (col + 1) / ATLAS_COLS - INSET_U;
  const v1 = 1 - row / ATLAS_ROWS - INSET_V;
  const v0 = 1 - (row + 1) / ATLAS_ROWS + INSET_V;
  return [u0, v0, u1, v1];
}
