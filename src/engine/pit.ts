import { isSolidId } from "./blocks";
import type { World } from "./World";

/**
 * Enfant coincé (J7, pur) : le compagnon doit pouvoir dire comment sortir d'un
 * trou (règle « aucun échec bloquant »). Pour la case où se tiennent les pieds :
 * - « open » : on peut sortir en marchant dans au moins une direction (case
 *   libre, ou marche d'un bloc que le joueur monte tout seul) ;
 * - « climb » : des parois de deux blocs ou plus tout autour, mais de l'air
 *   au-dessus de la tête : l'escalade de secours (garder Sauter en avançant
 *   contre la paroi) fait sortir ;
 * - « closed » : fermé tout autour et au-dessus (abri ou galerie sans issue) :
 *   il faut casser un bloc.
 */
export type PitState = "open" | "climb" | "closed";

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function pitState(world: World, x: number, y: number, z: number): PitState {
  const fx = Math.floor(x);
  const fy = Math.floor(y + 0.001);
  const fz = Math.floor(z);
  const solid = (a: number, b: number, c: number) => isSolidId(world.get(a, b, c));
  for (const [dx, dz] of DIRS) {
    const nx = fx + dx;
    const nz = fz + dz;
    // Hors du monde : le bord est un mur (on ne sort pas par là).
    if (!world.inBounds(nx, fy, nz)) continue;
    const head = solid(nx, fy + 1, nz);
    // Marche d'un bloc : montée seule s'il y a la place pour le corps au-dessus.
    const step = solid(nx, fy, nz) && solid(nx, fy + 2, nz);
    if (!head && !step) return "open";
  }
  return solid(fx, fy + 2, fz) ? "closed" : "climb";
}
