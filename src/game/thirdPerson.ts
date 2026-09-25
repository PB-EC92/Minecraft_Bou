import type { World } from "../engine/World";

/**
 * Caméra à la troisième personne (J4, pure) : derrière la tête, dans l'axe du
 * regard, reculée jusqu'à THIRD_PERSON_DISTANCE mais jamais à travers un bloc
 * plein (on avance la caméra devant le mur). Les plantes et l'eau ne l'arrêtent pas.
 * J7 : le rayon est sondé avec une petite boîte (et non un point) : il ne se
 * faufile plus entre deux blocs qui se touchent par un coin (mur en escalier
 * vu en diagonale), et la caméra ne s'arrête pas à ras d'une arête.
 */
export const THIRD_PERSON_DISTANCE = 4;
/** La caméra part d'un peu au-dessus des yeux : le personnage ne cache pas la croix de visée. */
export const THIRD_PERSON_LIFT = 0.7;
/** Marge gardée devant un bloc plein (le plan proche de la caméra ne doit pas y entrer), en plus de la sonde. */
const WALL_MARGIN = 0.1;
/** Demi-côté de la boîte qui sonde le rayon (blocs). */
const PROBE = 0.15;
const STEP = 0.05;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function thirdPersonCamera(world: World, eye: Vec3, yaw: number, pitch: number, maxDistance = THIRD_PERSON_DISTANCE): Vec3 & { distance: number } {
  // Rehaussement réduit sous un plafond bas (jamais de point de départ dans un bloc).
  let lift = THIRD_PERSON_LIFT;
  while (lift > 0 && blocked(world, eye.x, eye.y + lift + WALL_MARGIN + PROBE, eye.z)) lift = Math.max(0, lift - 0.1);
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
    if (probeBlocked(world, eye.x + bx * d, eye.y + by * d, eye.z + bz * d)) {
      hit = true;
      break;
    }
    free = d;
  }
  const distance = Math.max(0, hit ? free - WALL_MARGIN : free);
  return { x: eye.x + bx * distance, y: eye.y + by * distance, z: eye.z + bz * distance, distance };
}

/** Un bloc plein touche la petite boîte centrée sur ce point (ses huit coins). */
function probeBlocked(world: World, x: number, y: number, z: number): boolean {
  for (const dx of [-PROBE, PROBE]) for (const dy of [-PROBE, PROBE]) for (const dz of [-PROBE, PROBE]) if (blocked(world, x + dx, y + dy, z + dz)) return true;
  return false;
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
