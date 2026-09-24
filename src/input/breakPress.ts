/**
 * Appui « casser » (J2) : le bloc visé se casse si l'on garde l'appui assez
 * longtemps, pour éviter les casses accidentelles (un enfant qui tapote ou
 * qui clique en visant mal).
 *
 * Les entrées (souris, tactile) décrivent l'appui en cours ; le jeu décide
 * à chaque image s'il compte comme « tenu » et fait avancer la casse.
 *
 * Un appui est « ambigu » quand le même geste peut aussi servir à regarder
 * (doigt à droite de l'écran, souris non capturée : glisser = regarder).
 * On attend alors un court instant d'immobilité avant de commencer à casser,
 * pour que la barre de progression n'apparaisse pas à chaque coup d'œil.
 */

export interface BreakPress {
  /** Instant du début de l'appui (ms, horloge de performance.now()). */
  readonly since: number;
  /** Faux dès que le geste s'est déplacé au-delà du seuil de clic : c'est un glisser, pas un appui. */
  still: boolean;
  /** Vrai si le geste peut aussi servir à regarder (voir en tête de module). */
  readonly ambiguous: boolean;
}

/** Immobilité exigée avant de commencer à casser, pour un appui ambigu (ms). */
export const HOLD_START_MS = 150;

/** Un relâchement plus rapide que cette durée, sans casse, déclenche le conseil « Appuie longtemps » (ms). */
export const HOLD_HINT_MAX_MS = 400;

export function newBreakPress(since: number, ambiguous: boolean): BreakPress {
  return { since, still: true, ambiguous };
}

/** L'appui compte-t-il comme « tenu » à l'instant now ? */
export function isHolding(press: BreakPress | null, now: number): boolean {
  if (!press || !press.still) return false;
  return now - press.since >= (press.ambiguous ? HOLD_START_MS : 0);
}

/**
 * Faut-il conseiller « Appuie longtemps » au relâchement ? Oui si l'appui était
 * immobile, bref, et qu'aucun bloc n'a été cassé depuis son début.
 */
export function shouldHintHold(press: BreakPress, releasedAt: number, lastBreakAt: number): boolean {
  return press.still && releasedAt - press.since < HOLD_HINT_MAX_MS && lastBreakAt < press.since;
}
