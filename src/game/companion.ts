import { isSolidId, BlockId } from "../engine/blocks";
import type { World } from "../engine/World";

/**
 * Déplacement du compagnon Pixel (J5, pur) : il trottine devant l'enfant, un
 * peu sur sa gauche (en vue normale, l'enfant le voit ; arrêté, il le regarde), monte les marches d'un bloc, et réapparaît près de lui s'il
 * est resté trop loin (jamais bloqué derrière un mur ou de l'eau).
 */
/** Distance devant l'enfant (blocs). */
export const COMPANION_AHEAD = 2.6;
export const COMPANION_SIDE = 1.4;
export const COMPANION_TELEPORT = 10;
const SPEED = 4.5;
/** Il s'arrête quand il est assez près de sa place. */
const CLOSE = 0.6;

export interface CompanionState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
}

/** Place visée : devant l'enfant, à sa gauche (yaw = regard de l'enfant, 0 = vers −Z). */
export function companionGoal(p: { x: number; z: number }, yaw: number): { x: number; z: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  // Gauche = direction du regard tournée d'un quart de tour.
  const lx = -Math.cos(yaw);
  const lz = Math.sin(yaw);
  return { x: p.x + fx * COMPANION_AHEAD + lx * COMPANION_SIDE, z: p.z + fz * COMPANION_AHEAD + lz * COMPANION_SIDE };
}

/** Un pas de déplacement vers goal (dt en secondes). player sert de repli pour réapparaître. */
export function stepCompanion(
  c: CompanionState,
  goal: { x: number; z: number },
  player: { x: number; y: number; z: number },
  world: World,
  dt: number,
): CompanionState {
  const dx = goal.x - c.x;
  const dz = goal.z - c.z;
  const d = Math.hypot(dx, dz);
  if (d > COMPANION_TELEPORT || Math.abs(c.y - player.y) > 4) {
    const y = groundNear(world, Math.floor(goal.x), Math.floor(goal.z), Math.floor(player.y));
    if (y !== null) return { x: goal.x, y, z: goal.z, yaw: Math.atan2(-dx, -dz), moving: false };
    return { x: player.x, y: player.y, z: player.z, yaw: c.yaw, moving: false };
  }
  // Arrivé : il se tourne vers l'enfant.
  if (d < CLOSE) return { ...c, yaw: Math.atan2(-(player.x - c.x), -(player.z - c.z)), moving: false };
  const step = Math.min(d, SPEED * Math.min(dt, 0.1) * (d > 4 ? 1.6 : 1));
  const nx = c.x + (dx / d) * step;
  const nz = c.z + (dz / d) * step;
  const yaw = Math.atan2(-dx, -dz);
  const y = groundNear(world, Math.floor(nx), Math.floor(nz), Math.floor(c.y));
  if (y === null || y > Math.floor(c.y) + 1) return { ...c, yaw, moving: false };
  return { x: nx, y, z: nz, yaw, moving: true };
}

function groundNear(world: World, x: number, z: number, y: number): number | null {
  if (!world.inBounds(x, 0, z)) return null;
  for (let yy = y + 1; yy >= Math.max(1, y - 4); yy--) {
    if (!isSolidId(world.get(x, yy - 1, z))) continue;
    const here = world.get(x, yy, z);
    if (isSolidId(here) || here === BlockId.Water) continue;
    return yy;
  }
  return null;
}
