import type { World } from "./World";

/** Boîte alignée sur les axes. */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const EPS = 1e-4;

/** Vrai si la boîte recouvre au moins un bloc solide (bords du monde compris). */
export function collides(world: World, b: AABB): boolean {
  const x0 = Math.floor(b.minX);
  const x1 = Math.floor(b.maxX - EPS);
  const y0 = Math.floor(b.minY);
  const y1 = Math.floor(b.maxY - EPS);
  const z0 = Math.floor(b.minZ);
  const z1 = Math.floor(b.maxZ - EPS);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (world.isSolidForPhysics(x, y, z)) return true;
      }
    }
  }
  return false;
}

export function boxesIntersect(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ
  );
}

export function blockBox(x: number, y: number, z: number): AABB {
  return { minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 1 };
}

export interface SweepResult {
  /** Déplacement effectivement réalisé. */
  dx: number;
  dy: number;
  dz: number;
  /** Collision rencontrée sur l'axe. */
  hitX: boolean;
  hitY: boolean;
  hitZ: boolean;
}

function translate(b: AABB, dx: number, dy: number, dz: number): void {
  b.minX += dx;
  b.maxX += dx;
  b.minY += dy;
  b.maxY += dy;
  b.minZ += dz;
  b.maxZ += dz;
}

/**
 * Déplace la boîte de (dx, dy, dz) axe par axe, en s'arrêtant contre les
 * blocs solides. Le déplacement est découpé en pas d'au plus 0,5 bloc pour
 * éviter de traverser un bloc à grande vitesse. La boîte est modifiée en
 * place.
 */
export function sweep(world: World, box: AABB, dx: number, dy: number, dz: number): SweepResult {
  const res: SweepResult = { dx: 0, dy: 0, dz: 0, hitX: false, hitY: false, hitZ: false };
  const maxStep = 0.5;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / maxStep));
  const sx = dx / steps;
  const sy = dy / steps;
  const sz = dz / steps;

  for (let i = 0; i < steps; i++) {
    // Axe Y d'abord (sol), puis X, puis Z.
    if (sy !== 0 && !res.hitY) {
      translate(box, 0, sy, 0);
      if (collides(world, box)) {
        if (sy > 0) {
          const top = Math.floor(box.maxY - EPS);
          translate(box, 0, top - box.maxY - EPS, 0);
        } else {
          const bottom = Math.ceil(box.minY);
          translate(box, 0, bottom - box.minY + EPS, 0);
        }
        res.hitY = true;
      } else {
        res.dy += sy;
      }
    }
    if (sx !== 0 && !res.hitX) {
      translate(box, sx, 0, 0);
      if (collides(world, box)) {
        if (sx > 0) {
          const side = Math.floor(box.maxX - EPS);
          translate(box, side - box.maxX - EPS, 0, 0);
        } else {
          const side = Math.ceil(box.minX);
          translate(box, side - box.minX + EPS, 0, 0);
        }
        res.hitX = true;
      } else {
        res.dx += sx;
      }
    }
    if (sz !== 0 && !res.hitZ) {
      translate(box, 0, 0, sz);
      if (collides(world, box)) {
        if (sz > 0) {
          const side = Math.floor(box.maxZ - EPS);
          translate(box, 0, 0, side - box.maxZ - EPS);
        } else {
          const side = Math.ceil(box.minZ);
          translate(box, 0, 0, side - box.minZ + EPS);
        }
        res.hitZ = true;
      } else {
        res.dz += sz;
      }
    }
  }
  return res;
}
