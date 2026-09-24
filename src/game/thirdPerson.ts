import type { World } from "../engine/World";

/**
 * Caméra à la troisième personne (J4, pure) : derrière la tête, dans l'axe du
 * regard, reculée jusqu'à THIRD_PERSON_DISTANCE mais jamais à travers un bloc
 * plein (on avance la caméra devant le mur). Les plantes et l'eau ne l'arrêtent pas.
 */
export const THIRD_PERSON_DISTANCE = 4;
/** La caméra part d'un peu au-dessus des yeux : le personnage ne cache pas la croix de visée. */
export const THIRD_PERSON_LIFT = 0.7;
/** Marge gardée devant un bloc plein (le plan proche de la caméra ne doit pas y entrer). */
const WALL_MARGIN = 0.25;
const STEP = 0.05;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function thirdPersonCamera(world: World, eye: Vec3, yaw: number, pitch: number, maxDistance = THIRD_PERSON_DISTANCE): Vec3 & { distance: number } {
  // Rehaussement réduit sous un plafond bas (jamais de point de départ dans un bloc).
  let lift = THIRD_PERSON_LIFT;
  while (lift > 0 && blocked(world, eye.x, eye.y + lift + WALL_MARGIN, eye.z)) lift = Math.max(0, lift - 0.1);
  if (lift < 0.1) lift = 0;
  eye = { x: eye.x, y: eye.y + lift, z: eye.z };
  const cp = Math.cos(pitch);
  // Vers l'arrière : opposé de la direction du regard.
  const bx = Math.sin(yaw) * cp;
  const by = -Math.sin(pitch);
  const bz = Math.cos(yaw) * cp;
  let free = 0;
  let hit = false;
  const steps = Math.round(maxDistance / STEP);
  for (let k = 1; k <= steps; k++) {
    const d = (k * maxDistance) / steps;
    if (blocked(world, eye.x + bx * d, eye.y + by * d, eye.z + bz * d)) {
      hit = true;
      break;
    }
    free = d;
  }
  const distance = Math.max(0, hit ? free - WALL_MARGIN : free);
  return { x: eye.x + bx * distance, y: eye.y + by * distance, z: eye.z + bz * distance, distance };
}

function blocked(world: World, x: number, y: number, z: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  // Hors du monde : les bords sont des murs, sauf au-dessus (le ciel est libre).
  if (iy >= world.sizeY) return false;
  if (!world.inBounds(ix, iy, iz)) return true;
  return world.isSolid(ix, iy, iz);
}
