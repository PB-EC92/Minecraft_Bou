/**
 * Champ de vision (J3, fonction pure). Three.js règle le champ VERTICAL : en
 * portrait (écran plus haut que large), un champ vertical fixe de 70° ne laisse
 * que 46° en largeur sur le convertible (1080 × 1802) : on voit le monde par une
 * fente. On élargit alors le champ vertical pour garder un minimum en largeur.
 */

/** Champ vertical en paysage (degrés). */
export const BASE_VERTICAL_FOV = 70;
/** Champ horizontal minimal visé (degrés). */
export const MIN_HORIZONTAL_FOV = 60;
/** Plafond du champ vertical : au-delà, l'image se déforme trop sur les bords. */
export const MAX_VERTICAL_FOV = 95;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Champ horizontal (degrés) obtenu avec un champ vertical v et un rapport largeur / hauteur aspect. */
export function horizontalFov(verticalDeg: number, aspect: number): number {
  return deg(2 * Math.atan(Math.tan(rad(verticalDeg) / 2) * aspect));
}

/** Champ vertical à donner à la caméra pour ce rapport largeur / hauteur. */
export function verticalFovFor(
  aspect: number,
  base = BASE_VERTICAL_FOV,
  minHorizontal = MIN_HORIZONTAL_FOV,
  max = MAX_VERTICAL_FOV,
): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return base;
  if (horizontalFov(base, aspect) >= minHorizontal) return base;
  const v = deg(2 * Math.atan(Math.tan(rad(minHorizontal) / 2) / aspect));
  return Math.min(Math.max(v, base), max);
}
