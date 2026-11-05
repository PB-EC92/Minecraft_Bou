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

/**
 * Ramène x dans [0, 1). Exact pour une valeur déjà dans [0, 1) (l'ancienne forme ((x % 1) + 1) % 1 la décalait
 * parfois d'un arrondi, ce qui faisait bouger une phase retenue à 17 h, V2).
 */
function wrap01(x: number): number {
  const r = x % 1; // dans ]−1, 1[, du signe de x ; NaN si x n'est pas fini (comme avant)
  if (r < 0) {
    const w = r + 1;
    return w < 1 ? w : 0; // −1e−17 + 1 s'arrondit à 1
  }
  return r === 0 ? 0 : r; // −0 → 0
}

/** Phase quelconque ramenée dans [0, 1), à l'identique si elle y est déjà (relecture des sauvegardes, V2). */
export function wrapPhase(phase: number): number {
  return wrap01(phase);
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

/**
 * Heure où le soir s'arrête tant que l'étape le demande (V2, décisions de Pierre 4 et 11 : la nuit attend
 * l'abri de la mission 1 ; aussi pendant le tutoriel et la mission 2).
 */
export const EVENING_HOLD_HOUR = 17;

/**
 * Phase à garder au lieu de `next` (sortie d'advancePhase) pendant une étape qui retient le soir. Avec
 * hold = phaseForHour(holdHour) (0,6875 pour 17 h) et dusk = DAY_SHARE (0,75, soit 18 h), selon la phase p :
 * - p < hold : `next`, sans dépasser hold. Si next < p (retour au matin du mode « pas de nuit », ou grand pas
 *   qui fait le tour du cycle), hold : le soir n'est jamais sauté ;
 * - hold ≤ p < dusk : p. Un monde repris le soir reste figé à son heure ; rien ne recule ;
 * - p ≥ dusk : `next`. Une nuit commencée suit son cours ; le lendemain, le soir est de nouveau retenu (un
 *   pas assez grand pour dépasser le soir suivant s'y arrête aussi).
 * Le multiplicateur de temps (×20 des tests, ×30) n'y change rien. `holdHour` est une heure de jour, avant 18 h.
 */
export function holdEvening(phase: number, next: number, holdHour: number = EVENING_HOLD_HOUR): number {
  const p = wrap01(phase);
  const n = wrap01(next);
  const hold = phaseForHour(holdHour);
  if (p < hold) return n < p ? hold : Math.min(n, hold);
  if (p < DAY_SHARE) return p;
  return n < p && n > hold ? hold : n;
}

/** Heures où la mission 2 peut commencer (V2) : de jour, assez loin du soir pour ne pas finir dans la nuit. */
export const MISSION_DAY_START_HOUR = 6.5;
export const MISSION_DAY_END_HOUR = 16.5;

/** Vrai de 6 h 30 (compris) à 16 h 30 (exclu) : la mission 2 peut démarrer (sinon le temps file jusqu'au matin). */
export function isMissionDaytime(hour: number): boolean {
  return hour >= MISSION_DAY_START_HOUR && hour < MISSION_DAY_END_HOUR;
}
