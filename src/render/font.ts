/**
 * Police des blocs-lettres (V2 lot 1, mission 2) : capitales de A à Z en
 * pixel-art de 5 × 7, dessinées pour ce jeu (calcul pur, sans DOM ni
 * Three.js, testé en Node). Chaque glyphe a 7 lignes de 5 caractères :
 * « # » pour l'encre, « . » pour le fond, ligne 0 en haut.
 *
 * Dans la tuile de 16 × 16 px (voir textures.ts), le glyphe est agrandi deux
 * fois (10 × 14 px) et placé à 3 px du bord gauche et 1 px du haut : il tient
 * à l'intérieur du cadre d'un pixel, centré en largeur.
 *
 * Choix de dessin, vérifiés par les tests : 26 glyphes tous différents, au
 * moins 3 pixels d'écart deux à deux, aucun n'est le miroir horizontal d'un
 * autre (une lettre retournée ne passe pas pour une autre), C et G bien
 * distincts de O (au moins 5 pixels).
 */

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Voyelles (Y compris, comme à l'école). */
export const VOWELS = "AEIOUY";

/** Écrit sur une ligne : les 7 lignes du glyphe, séparées par des espaces. */
const RAW: Readonly<Record<string, string>> = {
  A: ".###. #...# #...# ##### #...# #...# #...#",
  B: "####. #...# #...# ####. #...# #...# ####.",
  C: ".#### #.... #.... #.... #.... #.... .####",
  D: "###.. #..#. #...# #...# #...# #..#. ###..",
  E: "##### #.... #.... ####. #.... #.... #####",
  F: "##### #.... #.... ####. #.... #.... #....",
  G: ".#### #.... #.... #.### #...# #...# .###.",
  H: "#...# #...# #...# ##### #...# #...# #...#",
  I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  J: "..### ...#. ...#. ...#. ...#. #..#. .##..",
  K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
  L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#",
  N: "#...# #...# ##..# #.#.# #..## #...# #...#",
  O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #.... #.... #....",
  Q: ".###. #...# #...# #...# #.#.# #..#. .##.#",
  R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
  U: "#...# #...# #...# #...# #...# #...# .###.",
  V: "#...# #...# #...# #...# #...# .#.#. ..#..",
  W: "#...# #...# #...# #.#.# #.#.# ##.## #...#",
  X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
  Z: "##### ....# ...#. ..#.. .#... #.... #####",
};

/** Glyphes de A à Z : 7 lignes de 5 caractères, « # » pour l'encre, « . » pour le fond. */
export const GLYPHS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(Object.entries(RAW).map(([ch, rows]) => [ch, Object.freeze(rows.split(" "))])),
);

/** Une seule capitale de A à Z (pas de minuscule, d'accent ni de chaîne plus longue). */
function isCapital(ch: string): boolean {
  return typeof ch === "string" && /^[A-Z]$/.test(ch);
}

/** Glyphe d'une capitale de A à Z ; tout autre caractère (minuscule, accent, chiffre, "", "AB") : null. */
export function glyph(ch: string): readonly string[] | null {
  return isCapital(ch) ? (GLYPHS[ch] ?? null) : null;
}

/** Voyelle : A, E, I, O, U ou Y (capitale seule). */
export function isVowel(ch: string): boolean {
  return isCapital(ch) && VOWELS.includes(ch);
}

/**
 * Pixels d'encre de la lettre dans sa tuile de 16 × 16 (x vers la droite,
 * y vers le bas, ligne 0 en haut) : la case (colonne c, ligne r) du glyphe
 * donne les 4 pixels x = 3 + 2c + {0, 1}, y = 1 + 2r + {0, 1}. Hors A–Z : aucun.
 */
export function letterInkPixels(ch: string): readonly (readonly [number, number])[] {
  const g = glyph(ch);
  if (!g) return [];
  const out: [number, number][] = [];
  for (let r = 0; r < GLYPH_H; r++) {
    const row = g[r] ?? "";
    for (let c = 0; c < GLYPH_W; c++) {
      if (row.charAt(c) !== "#") continue;
      for (const dy of [0, 1]) for (const dx of [0, 1]) out.push([3 + 2 * c + dx, 1 + 2 * r + dy]);
    }
  }
  return out;
}
