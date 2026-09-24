import { parseDistance } from "./urlOptions";

/**
 * Distance de rendu au démarrage (J3). Avant, elle dépendait du pointeur (48 blocs
 * au doigt, 96 à la souris) et n'était jamais retenue : le convertible, qui tient
 * 60 images/s à 96 blocs, repartait à 48 à chaque ouverture en mode tablette.
 * Ordre : l'adresse (#distance=…), puis le dernier choix de l'adulte (stockage
 * local), puis 96. 128 ne deviendra la valeur par défaut qu'après une mesure des
 * images par seconde à cette distance sur le convertible.
 */
export const DEFAULT_RENDER_DISTANCE = 96;
export const DISTANCE_STORAGE_KEY = "cubes:distance";

export function initialRenderDistance(fromUrl: number | undefined, stored: string | null | undefined): number {
  return fromUrl ?? parseDistance(stored) ?? DEFAULT_RENDER_DISTANCE;
}
