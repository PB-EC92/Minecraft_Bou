import { LETTERS, Tile } from "../engine/blocks";
import { TILE_SIZE, tileOrigin } from "../render/atlas";

/**
 * Tuiles des blocs-lettres d'un mot (V2 lot 1, fonction pure) : une par caractère, Tile.LetterA + rang de la
 * lettre ; un caractère hors A–Z (minuscule, lettre accentuée, chiffre, espace…) donne null, une case vide.
 * Les mots de la mission 2 sont en capitales sans accent (« LEA » pour Léa).
 */
export function wordTiles(word: string): (number | null)[] {
  return Array.from(word, (ch) => {
    const k = /^[A-Z]$/.test(ch) ? LETTERS.indexOf(ch) : -1;
    return k >= 0 ? Tile.LetterA + k : null;
  });
}

/**
 * Icône d'un mot (V2 lot 1) : canvas de 16n × 16 px où les tuiles des blocs-lettres sont posées côte à côte,
 * exactement comme les blocs posés dans le monde (pas de texte système). Une case hors A–Z reste vide
 * (transparente). La taille d'affichage vient du CSS (rendu « pixelated »). Usages : « ABC » dans la case des
 * lettres et le bandeau de Pixel, les mots du récapitulatif des félicitations.
 */
export function wordIcon(atlas: HTMLCanvasElement, word: string): HTMLCanvasElement {
  const tiles = wordTiles(word);
  const c = document.createElement("canvas");
  c.width = TILE_SIZE * tiles.length;
  c.height = TILE_SIZE;
  const g = c.getContext("2d");
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  tiles.forEach((tile, i) => {
    if (tile === null) return;
    const [ox, oy] = tileOrigin(tile);
    g.drawImage(atlas, ox, oy, TILE_SIZE, TILE_SIZE, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
  });
  return c;
}
