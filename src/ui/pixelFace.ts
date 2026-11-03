/**
 * Visage de Pixel, le renard compagnon (J6) : 8 × 8 pixels dessinés sur un canvas, sans image. Le bandeau de
 * Pixel et la boîte à lettres (V2 lot 1) partagent ce dessin. La taille d'affichage vient du CSS (rendu
 * « pixelated »).
 */
export function pixelFace(): HTMLCanvasElement {
  const face = document.createElement("canvas");
  face.width = face.height = 8;
  const g = face.getContext("2d");
  if (!g) return face;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  // Oreilles, tête, museau clair, yeux et truffe.
  px(1, 0, 2, 2, "#e8762c");
  px(5, 0, 2, 2, "#e8762c");
  px(1, 2, 6, 4, "#e8762c");
  px(2, 5, 4, 3, "#f4efe6");
  px(2, 3, 1, 1, "#2a1d18");
  px(5, 3, 1, 1, "#2a1d18");
  px(3, 6, 2, 1, "#2a1d18");
  return face;
}
