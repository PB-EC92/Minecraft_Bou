import type { World } from "./World";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RayHit {
  /** Bloc touché. */
  x: number;
  y: number;
  z: number;
  /** Normale de la face touchée (un seul composant non nul, ±1). */
  nx: number;
  ny: number;
  nz: number;
  /** Distance parcourue. */
  distance: number;
}

/**
 * Parcours de voxels (Amanatides & Woo) : renvoie le premier bloc visable
 * (bloc plein ou plante ; l'eau est traversée) rencontré depuis `origin` dans
 * la direction `dir` (normalisée ou non), jusqu'à `maxDistance`, ou null.
 */
export function raycast(world: World, origin: Vec3, dir: Vec3, maxDistance: number): RayHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len === 0) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

  const boundary = (p: number, cell: number, step: number) => (step > 0 ? cell + 1 - p : p - cell);
  let tMaxX = stepX !== 0 ? boundary(origin.x, x, stepX) * tDeltaX : Infinity;
  let tMaxY = stepY !== 0 ? boundary(origin.y, y, stepY) * tDeltaY : Infinity;
  let tMaxZ = stepZ !== 0 ? boundary(origin.z, z, stepZ) * tDeltaZ : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;

  // Le bloc de départ n'est pas testé : on ne vise jamais le bloc dans lequel on se trouve.
  for (let i = 0; i < 512; i++) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if (t > maxDistance) return null;
    if (world.isTargetable(x, y, z)) {
      return { x, y, z, nx, ny, nz, distance: t };
    }
  }
  return null;
}
