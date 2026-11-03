import { describe, expect, it } from "vitest";
import {
  advancePhase,
  DAY_SHARE,
  EVENING_HOLD_HOUR,
  formatHour,
  holdEvening,
  isMissionDaytime,
  MISSION_DAY_END_HOUR,
  MISSION_DAY_START_HOUR,
  NIGHT_BRIGHTNESS,
  phaseForHour,
  phaseForSolarTime,
  skyState,
  solarTime,
  wrapPhase,
  type NightLength,
} from "../../src/engine/dayNight";

describe("cycle jour/nuit", () => {
  it("la journée occupe les trois quarts du temps réel", () => {
    expect(solarTime(0)).toBe(0);
    expect(solarTime(DAY_SHARE)).toBeCloseTo(0.5, 10); // coucher
    expect(solarTime(DAY_SHARE / 2)).toBeCloseTo(0.25, 10); // midi
  });

  it("phaseForSolarTime est l'inverse de solarTime", () => {
    for (const p of [0, 0.1, 0.5, 0.74, 0.8, 0.99]) expect(solarTime(phaseForSolarTime(solarTime(p)))).toBeCloseTo(solarTime(p), 10);
  });

  it("midi en plein jour, minuit jamais noir", () => {
    const noon = skyState(solarTime(phaseForHour(12)));
    expect(noon.hour).toBeCloseTo(12, 5);
    expect(noon.brightness).toBeCloseTo(1, 5);
    expect(noon.night).toBe(false);
    const midnight = skyState(solarTime(phaseForHour(0)));
    expect(midnight.night).toBe(true);
    expect(midnight.brightness).toBeCloseTo(NIGHT_BRIGHTNESS, 5);
    expect(midnight.brightness).toBeGreaterThan(0.3);
  });

  it("les couleurs du ciel restent valides à toute heure", () => {
    for (let h = 0; h < 24; h += 0.5) {
      const s = skyState((h - 6) / 24);
      for (const c of s.sky) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it("affiche l'heure simplement", () => {
    expect(formatHour(8.5)).toBe("8h30");
    expect(formatHour(23.99)).toBe("23h59");
  });
});

/** Heure affichée pour une phase du cycle. */
const hourOf = (phase: number) => skyState(solarTime(phase)).hour;

/**
 * Images successives comme dans Game.frame pendant une étape qui retient le soir : advancePhase puis holdEvening.
 * Renvoie les phases obtenues (une par image).
 */
function frames(start: number, count: number, dtMs: number, timeScale: number, night: NightLength): number[] {
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < count; i++) {
    p = holdEvening(p, advancePhase(p, dtMs, timeScale, night));
    out.push(p);
  }
  return out;
}

describe("soir retenu à 17 h (V2)", () => {
  const hold = phaseForHour(EVENING_HOLD_HOUR);

  it("17 h : phase 0,6875, une heure avant le crépuscule (18 h)", () => {
    expect(EVENING_HOLD_HOUR).toBe(17);
    expect(hold).toBeCloseTo(0.6875, 12);
    expect(hourOf(hold)).toBeCloseTo(17, 6);
    expect(formatHour(hourOf(hold))).toBe("17h00"); // ligne d'infos de l'adulte
    expect(skyState(solarTime(hold)).night).toBe(false);
    expect(DAY_SHARE).toBe(0.75);
  });

  it("avance jusqu'à 17 h exactement et n'en bouge plus, même au temps ×20", () => {
    for (const scale of [1, 20, 600]) {
      const ps = frames(phaseForHour(8), 60_000, 16.7, scale, "normale");
      expect(ps.every((p) => p <= hold), `×${scale}`).toBe(true);
      expect(ps.at(-1), `×${scale}`).toBe(hold);
      // Une fois atteinte, la phase ne bouge plus d'une image à l'autre.
      const first = ps.indexOf(hold);
      expect(first, `×${scale}`).toBeGreaterThan(0);
      expect(ps.slice(first).every((p) => p === hold), `×${scale}`).toBe(true);
    }
    // Avant 17 h, le temps passe comme d'habitude.
    const p = phaseForHour(9);
    const next = advancePhase(p, 1000, 20, "normale");
    expect(holdEvening(p, next)).toBe(next);
  });

  it("repris entre 17 h et 18 h : figé à son heure, rien ne recule", () => {
    for (const h of [17, 17.25, 17.5, 17.99]) {
      const start = phaseForHour(h);
      const ps = frames(start, 5000, 16.7, 20, "normale");
      expect(ps.every((p) => p === start), `${h} h`).toBe(true);
    }
    // Même devant un retour au matin (mode « pas de nuit ») ou un grand pas.
    const p = phaseForHour(17.5);
    expect(holdEvening(p, phaseForHour(6.25))).toBe(p);
    expect(holdEvening(p, phaseForHour(23))).toBe(p);
  });

  it("repris la nuit : la nuit suit son cours, puis le lendemain le soir est retenu", () => {
    const start = phaseForHour(22);
    const first = holdEvening(start, advancePhase(start, 1000, 20, "normale"));
    expect(first).toBe(advancePhase(start, 1000, 20, "normale"));
    const ps = frames(start, 8000, 16.7, 20, "normale");
    const morning = ps.findIndex((p) => p < DAY_SHARE);
    expect(morning).toBeGreaterThan(0);
    expect(ps.slice(0, morning).every((p) => skyState(solarTime(p)).night || p >= DAY_SHARE)).toBe(true);
    expect(ps.at(-1)).toBe(hold);
    expect(ps.slice(morning).every((p) => p <= hold)).toBe(true);
    // Un pas assez grand pour dépasser le soir suivant s'y arrête aussi.
    expect(holdEvening(phaseForHour(22), phaseForHour(17.5))).toBe(hold);
    expect(holdEvening(phaseForHour(22), phaseForHour(8))).toBe(phaseForHour(8));
  });

  it("nuit courte : retenue identique le jour ; la nuit déjà commencée passe trois fois plus vite", () => {
    const ps = frames(phaseForHour(8), 5000, 16.7, 20, "courte");
    expect(ps.at(-1)).toBe(hold);
    const normal = frames(phaseForHour(22), 8000, 16.7, 20, "normale").findIndex((p) => p < DAY_SHARE);
    const short = frames(phaseForHour(22), 8000, 16.7, 20, "courte");
    const shortMorning = short.findIndex((p) => p < DAY_SHARE);
    expect(shortMorning).toBeGreaterThan(0);
    expect(shortMorning).toBeLessThan(normal / 2);
    expect(short.at(-1)).toBe(hold);
  });

  it("pas de nuit : le retour à 6 h 15 ne saute jamais la retenue", () => {
    const ps = frames(phaseForHour(8), 60_000, 16.7, 20, "aucune");
    expect(ps.at(-1)).toBe(hold);
    expect(ps.every((p) => p <= hold)).toBe(true);
    // Grand pas juste avant 17 h qui mènerait après 18 h : advancePhase renvoie 6 h 15, holdEvening garde 17 h.
    const before = phaseForHour(16.9);
    const next = advancePhase(before, 60_000, 1, "aucune"); // une minute réelle : environ 2 h de jeu
    expect(next).toBe(phaseForHour(6.25));
    expect(holdEvening(before, next)).toBe(hold);
    // Avant 6 h 15, le passage habituel au matin reste permis (il ne recule pas).
    expect(holdEvening(0, advancePhase(0, 16, 1, "aucune"))).toBe(phaseForHour(6.25));
  });

  it("grand pas qui fait le tour du cycle : arrêt à 17 h", () => {
    const p = phaseForHour(16);
    expect(holdEvening(p, phaseForHour(10))).toBe(hold);
    expect(holdEvening(p, phaseForHour(20))).toBe(hold);
  });

  it("wrapPhase : à l'identique dans [0, 1), sinon ramenée dans [0, 1)", () => {
    for (const p of [0, 0.4, hold, phaseForHour(17.5), 0.999]) expect(wrapPhase(p)).toBe(p);
    expect(wrapPhase(1.25)).toBeCloseTo(0.25, 12);
    expect(wrapPhase(-0.25)).toBeCloseTo(0.75, 12);
    expect(wrapPhase(-1e-17)).toBe(0); // jamais 1
    expect(wrapPhase(3)).toBe(0);
    expect(wrapPhase(-0)).toBe(0);
    expect(wrapPhase(Number.NaN)).toBeNaN();
  });

  it("autre heure de retenue", () => {
    expect(holdEvening(phaseForHour(15), phaseForHour(16.5), 16)).toBe(phaseForHour(16));
    expect(holdEvening(phaseForHour(16.5), phaseForHour(16.6), 16)).toBe(phaseForHour(16.5));
  });
});

describe("heures de départ de la mission 2 (V2)", () => {
  it("de 6 h 30 (compris) à 16 h 30 (exclu)", () => {
    expect(MISSION_DAY_START_HOUR).toBe(6.5);
    expect(MISSION_DAY_END_HOUR).toBe(16.5);
    expect(isMissionDaytime(6.4)).toBe(false);
    expect(isMissionDaytime(6.5)).toBe(true);
    expect(isMissionDaytime(12)).toBe(true);
    expect(isMissionDaytime(16.49)).toBe(true);
    expect(isMissionDaytime(16.5)).toBe(false);
    expect(isMissionDaytime(23)).toBe(false);
    expect(isMissionDaytime(0)).toBe(false);
    expect(isMissionDaytime(Number.NaN)).toBe(false);
  });

  it("le soir retenu (17 h) n'est pas une heure de départ : il faut attendre le matin", () => {
    expect(isMissionDaytime(hourOf(phaseForHour(EVENING_HOLD_HOUR)))).toBe(false);
    expect(isMissionDaytime(hourOf(phaseForHour(8)))).toBe(true);
  });
});
