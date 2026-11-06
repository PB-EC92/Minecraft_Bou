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
 * tremblement du doigt ne compte pas. Un doigt annulé par le système après
 * SLOT_HOLD_CANCEL_OK_MS (900 ms ; durée − 100 ms) compte comme un appui allé
 * au bout (slotHoldAfterCancel), que la fenêtre perde le focus avant ou après
 * l'annulation (slotHoldAfterBlur).
 *
 * Durée réglable (préparation du test de Pierre sur le convertible) : chaque appui garde sa durée (durationMs),
 * choisie au début de l'appui (réglage du mode parent, ou &appui=… en mode adresse) ; l'anneau, le seuil du
 * touchcancel (durée − SLOT_HOLD_CANCEL_MARGIN_MS) et la perte de focus en dérivent. Par défaut, une seconde.
 * Module pur, testé en Node.
 */

/** Durée totale de l'appui qui vide une case, par défaut (ms ; décision de Pierre). */
export const SLOT_HOLD_MS = 1000;

/** Durées proposées dans le mode parent (ms) : 0,8 s, 1 s, 1,2 s. */
export const SLOT_HOLD_CHOICES = [800, 1000, 1200] as const;
export type SlotHoldChoice = (typeof SLOT_HOLD_CHOICES)[number];

/** Bornes d'une durée acceptée (option d'adresse &appui=…, ms). */
export const SLOT_HOLD_MIN_MS = 500;
export const SLOT_HOLD_MAX_MS = 2000;

/** Pas d'anneau avant cette durée : un simple tapotement choisit la case sans rien montrer (ms). */
export const SLOT_HOLD_SHOW_MS = 200;

/** Déplacement au-delà duquel l'appui est annulé (px) : environ un tiers de case, un tremblement ne compte pas. */
export const SLOT_HOLD_MOVE_PX = 18;

/**
 * Doigt annulé par le système (touchcancel) au plus tant avant la fin de l'appui : l'appui compte comme allé au bout
 * (ms). Parade au risque « Firefox sous Windows au doigt » (docs/V2-LOT1.md §9, docs/PLAN.md) : Windows peut prendre
 * un doigt gardé vers 1 s pour en faire un clic droit, et l'enfant qui a tenu presque toute la seconde verrait sa case
 * gardée.
 */
export const SLOT_HOLD_CANCEL_MARGIN_MS = 100;

/** Seuil du touchcancel pour la durée par défaut (900 ms ; voir slotHoldCancelOkMs). */
export const SLOT_HOLD_CANCEL_OK_MS = SLOT_HOLD_MS - SLOT_HOLD_CANCEL_MARGIN_MS;

/** Seuil du touchcancel pour une durée d'appui : 700 ms pour 800, 900 pour 1 000, 1 100 pour 1 200. */
export function slotHoldCancelOkMs(durationMs: number): number {
  return durationMs - SLOT_HOLD_CANCEL_MARGIN_MS;
}

/** Durée retenue : un nombre fini de SLOT_HOLD_MIN_MS à SLOT_HOLD_MAX_MS (arrondi à la ms), sinon SLOT_HOLD_MS. */
export function validSlotHoldMs(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= SLOT_HOLD_MIN_MS && v <= SLOT_HOLD_MAX_MS ? Math.round(v) : SLOT_HOLD_MS;
}

/** Durée lue dans l'adresse (&appui=800) : nombre de 500 à 2 000 ms, arrondi ; sinon (absente, hors bornes, texte), undefined. */
export function parseSlotHoldMs(s: string | null | undefined): number | undefined {
  if (s === null || s === undefined || s.trim() === "") return undefined;
  const n = Number(s.trim());
  return Number.isFinite(n) && n >= SLOT_HOLD_MIN_MS && n <= SLOT_HOLD_MAX_MS ? Math.round(n) : undefined;
}

/** Durée d'appui pour la ligne d'infos : « appui 0,8 s » ; rien pour la durée par défaut (1 s). */
export function slotHoldInfoLabel(durationMs: number): string {
  if (durationMs === SLOT_HOLD_MS) return "";
  return `appui ${String(Math.round(durationMs) / 1000).replace(".", ",")} s`;
}

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
  /** Durée de cet appui (ms ; SLOT_HOLD_MS par défaut), fixée à son début. */
  readonly durationMs: number;
}

export function startSlotHold(
  slot: number,
  since: number,
  source: SlotHoldSource,
  x = 0,
  y = 0,
  pointer: number | string | null = null,
  durationMs: number = SLOT_HOLD_MS,
): SlotHold {
  return { slot, since, source, x, y, pointer, durationMs: validSlotHoldMs(durationMs) };
}

/** Le geste a-t-il glissé au-delà de SLOT_HOLD_MOVE_PX depuis son début ? Jamais pour une touche. */
export function slotHoldMoved(h: SlotHold, x: number, y: number): boolean {
  if (h.source === "key") return false;
  return Math.hypot(x - h.x, y - h.y) > SLOT_HOLD_MOVE_PX;
}

/**
 * Avancement de l'anneau dans [0, 1] : 0 jusqu'à since + SLOT_HOLD_SHOW_MS, puis linéaire jusqu'à 1 à
 * since + durationMs (la case est alors vidée), borné ensuite.
 */
export function slotHoldProgress(h: SlotHold, now: number): number {
  const t = now - h.since - SLOT_HOLD_SHOW_MS;
  if (!(t > 0)) return 0;
  return Math.min(1, t / (h.durationMs - SLOT_HOLD_SHOW_MS));
}

/**
 * Doigt de l'appui annulé par le système (touchcancel) à l'instant now. Avant slotHoldCancelOkMs(durationMs) (900 ms
 * pour une seconde) : l'appui est abandonné (null), comme un doigt levé trop tôt. Ensuite : l'appui est mené à son terme, rendu plein dès now
 * (slotHoldProgress vaut 1) ; le jeu vide alors la case à l'image suivante, par le même chemin et avec les mêmes
 * règles qu'au bout de la seconde (blocs gardés compris). Seulement pour un doigt : la souris et le clavier n'ont
 * pas d'annulation.
 */
export function slotHoldAfterCancel(h: SlotHold, now: number): SlotHold | null {
  if (h.source !== "touch" || !(now - h.since >= slotHoldCancelOkMs(h.durationMs))) return null;
  return { ...h, since: Math.min(h.since, now - h.durationMs) };
}

/**
 * Fenêtre qui perd le focus pendant l'appui, à l'instant now. Un appui déjà plein reste tel quel (le jeu vide la case
 * à l'image suivante). Un doigt tenu depuis slotHoldCancelOkMs(durationMs) est mené au bout comme par
 * slotHoldAfterCancel : sous Windows, la perte de focus d'un geste du système peut arriver avant son touchcancel, qui ne trouverait alors
 * plus d'appui. Sinon (souris, touche, doigt posé depuis moins longtemps), l'appui est abandonné (null).
 */
export function slotHoldAfterBlur(h: SlotHold, now: number): SlotHold | null {
  if (slotHoldProgress(h, now) >= 1) return h;
  return slotHoldAfterCancel(h, now);
}
