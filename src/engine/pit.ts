import { isSolidId } from "./blocks";
import type { World } from "./World";

/**
 * Enfant coincé (J7, pur) : le compagnon doit pouvoir dire comment sortir d'un
 * trou (règle « aucun échec bloquant »). Pour la case où se tiennent les pieds :
 * - « open » : on peut sortir en marchant dans au moins une direction (case
 *   libre, ou marche d'un bloc que le joueur monte tout seul) ;
 * - « climb » : des parois de deux blocs ou plus tout autour, mais l'escalade
 *   de secours (garder Sauter en avançant contre la paroi) fait sortir par au
 *   moins un côté : la colonne de l'enfant est libre jusqu'en haut de cette
 *   paroi, et il y a la place de se tenir dessus ;
 * - « closed » : aucune sortie, même en grimpant (abri fermé par un toit, même
 *   posé haut sur les murs ; galerie sans issue) : il faut casser un bloc.
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
  let climb = false;
  for (const [dx, dz] of DIRS) {
    const nx = fx + dx;
    const nz = fz + dz;
    // Hors du monde : le bord est un mur (on ne sort pas par là).
    if (!world.inBounds(nx, fy, nz)) continue;
    const head = solid(nx, fy + 1, nz);
    // Marche d'un bloc : montée seule s'il y a la place pour le corps au-dessus.
    const step = solid(nx, fy, nz) && solid(nx, fy + 2, nz);
    if (!head && !step) return "open";
    // Escalade par ce côté : la paroi fait h blocs ; il faut deux cases d'air au-dessus d'elle (se tenir dessus)
    // et, dans la colonne de l'enfant, de l'air jusqu'à ce qu'il puisse s'y poser (pieds en fy + h).
    let h = 0;
    while (h < MAX_WALL && solid(nx, fy + h, nz)) h++;
    if (h >= MAX_WALL || solid(nx, fy + h + 1, nz)) continue;
    let free = true;
    for (let yy = fy + 2; yy <= fy + h + 1 && free; yy++) if (solid(fx, yy, fz)) free = false;
    if (free) climb = true;
  }
  return climb ? "climb" : "closed";
}

/** Au-delà, une paroi est une falaise : on ne la compte pas comme une sortie par escalade. */
const MAX_WALL = 12;
