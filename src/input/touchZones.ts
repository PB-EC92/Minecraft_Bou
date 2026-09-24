/**
 * Zones tactiles (J3, fonctions pures). Le joystick est un rond FIXE en bas à
 * gauche : seul un toucher qui commence sur lui (ou tout près) fait marcher.
 * Partout ailleurs, le doigt regarde et casse. Avant le J3, toute la moitié
 * gauche de l'écran commandait le déplacement : un enfant qui touchait le bloc
 * là où il le voyait avançait au lieu de casser (retour de la séance J2).
 */

export interface Point {
  x: number;
  y: number;
}

/** Zone de prise du joystick : son rayon multiplié par ce facteur (un doigt de 6 ans vise large). */
export const JOYSTICK_CATCH = 1.5;
/** Zone morte au centre du rond, en fraction du rayon : un doigt posé sans bouger ne fait pas marcher. */
export const JOYSTICK_DEAD = 0.15;

/** Vrai si un toucher en p commence dans la zone de prise du joystick (centre, rayon du rond en pixels). */
export function inJoystickZone(p: Point, center: Point, radius: number, catchFactor = JOYSTICK_CATCH): boolean {
  if (!(radius > 0)) return false;
  return Math.hypot(p.x - center.x, p.y - center.y) <= radius * catchFactor;
}

export interface JoystickState {
  /** Déplacement latéral [-1, 1] (droite +). */
  x: number;
  /** Déplacement avant [-1, 1] (avant +, c'est-à-dire doigt vers le haut). */
  z: number;
  /** Décalage de la manette dessinée, borné au rayon (pixels). */
  knobX: number;
  knobY: number;
}

/**
 * Commande du joystick pour un doigt en p. La manette suit le doigt sans sortir
 * du rond ; le déplacement est nul dans la zone morte, puis croît jusqu'à 1 au bord.
 */
export function joystickVector(p: Point, center: Point, radius: number, dead = JOYSTICK_DEAD): JoystickState {
  if (!(radius > 0)) return { x: 0, z: 0, knobX: 0, knobY: 0 };
  let dx = p.x - center.x;
  let dy = p.y - center.y;
  const len = Math.hypot(dx, dy);
  if (len > radius) {
    dx = (dx / len) * radius;
    dy = (dy / len) * radius;
  }
  const knobX = dx;
  const knobY = dy;
  const clamped = Math.min(len, radius);
  if (clamped <= radius * dead) return { x: 0, z: 0, knobX, knobY };
  // Au-delà de la zone morte, l'amplitude repart de 0 pour éviter un à-coup.
  const scale = (clamped - radius * dead) / (radius * (1 - dead)) / clamped;
  return { x: dx * scale, z: -dy * scale, knobX, knobY };
}
