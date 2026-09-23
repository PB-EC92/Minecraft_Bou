import { describe, expect, it } from "vitest";
import { DAY_SHARE, formatHour, NIGHT_BRIGHTNESS, phaseForHour, phaseForSolarTime, skyState, solarTime } from "../../src/engine/dayNight";

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
