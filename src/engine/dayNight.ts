/**
 * Cycle jour/nuit (pur calcul, sans rendu).
 *
 * Temps solaire t dans [0, 1) : 0 = lever (6 h), 0,25 = midi, 0,5 = coucher
 * (18 h), 0,75 = minuit. La journée occupe les trois quarts du temps réel
 * (DAY_SHARE) : on a le temps de construire avant la nuit, et la nuit ne
 * dure pas trop pour un enfant de 6 ans. Elle n'est jamais noire.
 */

/** Durée d'un cycle complet en temps réel : 12 minutes (9 de jour, 3 de nuit). */
export const DAY_CYCLE_MS = 12 * 60_000;
export const DAY_SHARE = 0.75;
/** Luminosité minimale la nuit (1 = plein jour). */
export const NIGHT_BRIGHTNESS = 0.4;

export type Rgb = [number, number, number];

export interface SkyState {
  /** Temps solaire [0, 1). */
  t: number;
  /** Heure affichable [0, 24). */
  hour: number;
  /** Hauteur du soleil : sinus de son angle, 1 à midi, −1 à minuit. */
  sunHeight: number;
  /** Part de jour [0, 1] (0 = nuit pleine). */
  daylight: number;
  /** Multiplicateur de luminosité du monde [NIGHT_BRIGHTNESS, 1]. */
  brightness: number;
  /** Couleur du ciel et du brouillard (sRGB, 0 à 1). */
  sky: Rgb;
  night: boolean;
}

const SKY_DAY: Rgb = [0.5, 0.72, 0.9];
const SKY_NIGHT: Rgb = [0.06, 0.09, 0.22];
const SKY_DUSK: Rgb = [0.96, 0.58, 0.38];

function mix(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function smoothstep(a: number, b: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function wrap01(x: number): number {
  return ((x % 1) + 1) % 1;
}

/** Phase réelle du cycle [0, 1) → temps solaire [0, 1) (jour étiré, nuit raccourcie). */
export function solarTime(phase: number): number {
  const p = wrap01(phase);
  return p < DAY_SHARE ? (p / DAY_SHARE) * 0.5 : 0.5 + ((p - DAY_SHARE) / (1 - DAY_SHARE)) * 0.5;
}

/** Inverse de solarTime : sert à « mettre le monde à 8 h ». */
export function phaseForSolarTime(t: number): number {
  const s = wrap01(t);
  return s < 0.5 ? (s / 0.5) * DAY_SHARE : DAY_SHARE + ((s - 0.5) / 0.5) * (1 - DAY_SHARE);
}

export function phaseForHour(hour: number): number {
  return phaseForSolarTime((hour - 6) / 24);
}

export function skyState(t: number): SkyState {
  const s = wrap01(t);
  const sunHeight = Math.sin(2 * Math.PI * s);
  const daylight = smoothstep(-0.12, 0.22, sunHeight);
  const brightness = NIGHT_BRIGHTNESS + (1 - NIGHT_BRIGHTNESS) * daylight;
  const dusk = Math.exp(-((sunHeight / 0.16) ** 2)) * 0.55;
  const sky = mix(mix(SKY_NIGHT, SKY_DAY, daylight), SKY_DUSK, dusk);
  return { t: s, hour: (6 + s * 24) % 24, sunHeight, daylight, brightness, sky, night: daylight < 0.25 };
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Durée de la nuit choisie en mode parent (J4). */
export type NightLength = "normale" | "courte" | "aucune";
/** Nuit « courte » : le temps de la nuit passe trois fois plus vite (1 minute au lieu de 3). */
export const SHORT_NIGHT_SPEED = 3;

/**
 * Avance la phase du cycle de dtMs de temps réel (× timeScale), selon la durée de nuit choisie.
 * « aucune » : arrivé à 18 h (la nuit commence vers 18 h 15), on passe directement au matin (6 h 15).
 */
export function advancePhase(phase: number, dtMs: number, timeScale: number, night: NightLength): number {
  const p = wrap01(phase);
  const speed = night === "courte" && p >= DAY_SHARE ? SHORT_NIGHT_SPEED : 1;
  const next = wrap01(p + (dtMs * timeScale * speed) / DAY_CYCLE_MS);
  if (night === "aucune" && (next >= phaseForHour(18) || next < phaseForHour(6.25))) return phaseForHour(6.25);
  return next;
}
