/**
 * Appui long sur une case de la barre (V2, décisions de Pierre 2 et 10) : garder
 * le doigt, la souris ou la touche 1 à 9 sur une case pendant une seconde la vide.
 * Sur le modèle de breakPress.ts : les entrées (Hud pour la souris et le doigt,
 * Game pour le clavier) décrivent l'appui en cours ; le jeu demande à chaque
 * image où il en est, affiche l'anneau et vide la case quand il est plein.
 *
 * Un tapotement (choisir une case) ne montre rien : l'anneau n'apparaît
 * qu'après SLOT_HOLD_SHOW_MS. Un glissé du doigt ou de la souris au-delà de
 * SLOT_HOLD_MOVE_PX annule l'appui (l'enfant regardait ou visait) ; un
 * tremblement du doigt ne compte pas. Module pur, testé en Node.
 */

/** Durée totale de l'appui qui vide une case (ms ; décision de Pierre). */
export const SLOT_HOLD_MS = 1000;

/** Pas d'anneau avant cette durée : un simple tapotement choisit la case sans rien montrer (ms). */
export const SLOT_HOLD_SHOW_MS = 200;

/** Déplacement au-delà duquel l'appui est annulé (px) : environ un tiers de case, un tremblement ne compte pas. */
export const SLOT_HOLD_MOVE_PX = 18;

/** Origine de l'appui : souris, doigt ou touche 1 à 9. */
export type SlotHoldSource = "mouse" | "touch" | "key";

export interface SlotHold {
  /** Case visée (indice dans le sac). */
  readonly slot: number;
  /** Début de l'appui (ms, horloge de performance.now()). */
  readonly since: number;
  readonly source: SlotHoldSource;
  /** Position de départ du doigt ou de la souris (px) ; 0 pour une touche. */
  readonly x: number;
  readonly y: number;
  /** Doigt suivi (identifiant du toucher), touche tenue (`KeyboardEvent.code`), ou null pour la souris. */
  readonly pointer: number | string | null;
}

export function startSlotHold(
  slot: number,
  since: number,
  source: SlotHoldSource,
  x = 0,
  y = 0,
  pointer: number | string | null = null,
): SlotHold {
  return { slot, since, source, x, y, pointer };
}

/** Le geste a-t-il glissé au-delà de SLOT_HOLD_MOVE_PX depuis son début ? Jamais pour une touche. */
export function slotHoldMoved(h: SlotHold, x: number, y: number): boolean {
  if (h.source === "key") return false;
  return Math.hypot(x - h.x, y - h.y) > SLOT_HOLD_MOVE_PX;
}

/**
 * Avancement de l'anneau dans [0, 1] : 0 jusqu'à since + SLOT_HOLD_SHOW_MS, puis linéaire jusqu'à 1 à
 * since + SLOT_HOLD_MS (la case est alors vidée), borné ensuite.
 */
export function slotHoldProgress(h: SlotHold, now: number): number {
  const t = now - h.since - SLOT_HOLD_SHOW_MS;
  if (!(t > 0)) return 0;
  return Math.min(1, t / (SLOT_HOLD_MS - SLOT_HOLD_SHOW_MS));
}
