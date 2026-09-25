import { BlockId, isSolidId } from "./blocks";
import type { World } from "./World";

/**
 * Abri (J6, pur) : la mission 1 demande de « construire un abri avant la nuit ».
 * On vérifie l'endroit où se tient l'enfant, avec des règles indulgentes pour un
 * enfant de 6 ans :
 * - un toit : un bloc plein au-dessus de la tête, jusqu'à SHELTER_ROOF_REACH
 *   blocs plus haut (une pièce haute compte aussi) ;
 * - des murs : dans au moins SHELTER_WALLS_NEEDED des quatre directions, un bloc
 *   plein à hauteur des pieds ou de la tête, à SHELTER_WALL_REACH blocs au plus
 *   (la porte reste ouverte : trois murs suffisent) ;
 * - fait par l'enfant : au moins un de ces blocs a été posé par lui, ou il se
 *   tient dans un terrier qu'il a creusé : creux fait par lui ET plafond de
 *   terre ou de pierre juste au-dessus de la tête (un creux d'un bloc au pied
 *   d'un arbre, sous le feuillage, ne compte pas). Un sous-bois naturel entre
 *   trois troncs, sous les feuilles, ne compte pas non plus.
 * Le bord du monde ne sert pas de mur (hors du monde, c'est de l'air).
 */

export const SHELTER_WALLS_NEEDED = 3;
/** Distance maximale d'un mur (blocs) : une pièce de 7 de large, enfant au milieu. */
export const SHELTER_WALL_REACH = 4;
/** Hauteur maximale du toit au-dessus de la tête (blocs). */
export const SHELTER_ROOF_REACH = 4;

export interface ShelterCheck {
  /** Un toit au-dessus de la tête. */
  roof: boolean;
  /** Nombre de directions fermées par un mur (0 à 4). */
  walls: number;
  /** Fait par l'enfant : un bloc posé parmi le toit et les murs, ou un creux creusé. */
  own: boolean;
  /** Abri complet : toit, au moins trois murs, fait par l'enfant. */
  ok: boolean;
}

/** Changé par l'enfant depuis la génération du monde (bloc posé ou creusé). */
export type ChangedFn = (x: number, y: number, z: number) => boolean;

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Vérifie l'abri autour d'un joueur dont les pieds sont en (x, y, z) (coordonnées du monde). */
export function checkShelter(world: World, x: number, y: number, z: number, changed: ChangedFn): ShelterCheck {
  const fx = Math.floor(x);
  const fy = Math.floor(y + 0.001);
  const fz = Math.floor(z);
  const dug = changed(fx, fy, fz) || changed(fx, fy + 1, fz);
  let own = false;

  let roof = false;
  for (let dy = 2; dy < 2 + SHELTER_ROOF_REACH; dy++) {
    const id = world.get(fx, fy + dy, fz);
    if (isSolidId(id)) {
      roof = true;
      if (changed(fx, fy + dy, fz)) own = true;
      // Terrier : creusé par l'enfant, plafond naturel collé à la tête et qui n'est pas un arbre.
      else if (dug && dy === 2 && id !== BlockId.Leaves && id !== BlockId.Log) own = true;
      break;
    }
  }

  let walls = 0;
  for (const [dx, dz] of DIRS) {
    for (let d = 1; d <= SHELTER_WALL_REACH; d++) {
      const wx = fx + dx * d;
      const wz = fz + dz * d;
      const feet = isSolidId(world.get(wx, fy, wz));
      const head = isSolidId(world.get(wx, fy + 1, wz));
      if (!feet && !head) continue;
      walls++;
      if ((feet && changed(wx, fy, wz)) || (head && changed(wx, fy + 1, wz))) own = true;
      break;
    }
  }

  return { roof, walls, own, ok: roof && walls >= SHELTER_WALLS_NEEDED && own };
}
