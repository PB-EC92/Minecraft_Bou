import { describe, expect, it } from "vitest";
import { formatUrlOptions, parseSeed, parseUrlOptions } from "../../src/game/urlOptions";

describe("options de l'adresse", () => {
  it("lit monde, graine, heure et distance", () => {
    expect(parseUrlOptions("#monde=ile&graine=1234&heure=20&distance=48")).toEqual({ type: "ile", seed: 1234, hour: 20, distance: 48 });
  });

  it("accepte les accents et ignore les valeurs invalides", () => {
    expect(parseUrlOptions("#monde=désert")).toEqual({ type: "desert" });
    expect(parseUrlOptions("#monde=lune&graine=-3&heure=30&distance=5")).toEqual({});
    expect(parseUrlOptions("")).toEqual({});
  });

  it("graine entière de 1 à 999 999", () => {
    expect(parseSeed("42")).toBe(42);
    expect(parseSeed("0")).toBeUndefined();
    expect(parseSeed("1000000")).toBeUndefined();
    expect(parseSeed("12a")).toBeUndefined();
  });

  it("aller-retour", () => {
    expect(parseUrlOptions(formatUrlOptions("montagne", 77))).toEqual({ type: "montagne", seed: 77 });
  });
});
