/**
 * Filtre des mouvements de souris en mode capturé (Pointer Lock).
 *
 * Au moment de la capture, Chromium envoie un faux mouvement égal au trajet
 * du curseur vers le centre de la fenêtre (constaté à l'audit J0 : −640, −360
 * pour une fenêtre 1280 × 720), ce qui fait pivoter la caméra d'un coup.
 * On ignore donc les mouvements reçus juste après la capture, ainsi que tout
 * mouvement isolé anormalement grand.
 *
 * J1 : le verdict distingue les deux causes, pour que le diagnostic dise si
 * des gestes rapides légitimes sont perdus (retours J0.1 : 62 mouvements
 * écartés sans qu'on sache pourquoi).
 */

/** Durée pendant laquelle on ignore les mouvements après une capture (ms). */
export const LOCK_SETTLE_MS = 80;

/** Au-delà de ce déplacement en un seul événement (px), le mouvement est jugé aberrant. */
export const MAX_DELTA_PX = 200;

export type MouseDeltaVerdict = "ok" | "settle" | "large" | "invalid";

export function classifyMouseDelta(dx: number, dy: number, now: number, ignoreUntil: number): MouseDeltaVerdict {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return "invalid";
  if (now < ignoreUntil) return "settle";
  if (Math.abs(dx) > MAX_DELTA_PX || Math.abs(dy) > MAX_DELTA_PX) return "large";
  return "ok";
}

export function acceptMouseDelta(dx: number, dy: number, now: number, ignoreUntil: number): boolean {
  return classifyMouseDelta(dx, dy, now, ignoreUntil) === "ok";
}

/** Seuil sous lequel un appui-relâché compte comme un clic et non comme un glisser (px). */
export const CLICK_MAX_MOVE_PX = 6;

/** Durée maximale d'un clic (ms) ; au-delà c'est un glisser pour regarder. */
export const CLICK_MAX_MS = 450;

export function isClick(movedPx: number, durationMs: number): boolean {
  return movedPx <= CLICK_MAX_MOVE_PX && durationMs <= CLICK_MAX_MS;
}
