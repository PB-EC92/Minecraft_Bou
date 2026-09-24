import { describe, expect, it } from "vitest";
import { DEFAULT_RENDER_DISTANCE, DISTANCE_STORAGE_KEY, initialRenderDistance } from "../../src/game/renderDistance";
import { formatUrlOptions, parseDistance, parseSeed, parseUrlOptions } from "../../src/game/urlOptions";

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
    expect(parseUrlOptions(formatUrlOptions("ile", 5, 128, 96))).toEqual({ type: "ile", seed: 5, distance: 128 });
  });

  it("n'écrit la distance que si elle diffère de la valeur par défaut", () => {
    expect(formatUrlOptions("prairie", 12, 96, 96)).toBe("#monde=prairie&graine=12");
    expect(formatUrlOptions("prairie", 12, 48, 96)).toBe("#monde=prairie&graine=12&distance=48");
    expect(formatUrlOptions("prairie", 12)).toBe("#monde=prairie&graine=12");
  });

  it("distance : entière, de 16 à 256", () => {
    expect(parseDistance("128")).toBe(128);
    expect(parseDistance(" 47.6 ")).toBe(48);
    expect(parseDistance("8")).toBeUndefined();
    expect(parseDistance("300")).toBeUndefined();
    expect(parseDistance("abc")).toBeUndefined();
    expect(parseDistance("")).toBeUndefined();
    expect(parseDistance(null)).toBeUndefined();
  });
});

describe("distance de rendu au démarrage", () => {
  it("96 par défaut, quel que soit le pointeur", () => {
    expect(DEFAULT_RENDER_DISTANCE).toBe(96);
    expect(initialRenderDistance(undefined, null)).toBe(96);
  });
  it("le choix retenu de l'adulte passe avant la valeur par défaut", () => {
    expect(initialRenderDistance(undefined, "128")).toBe(128);
    expect(initialRenderDistance(undefined, "n'importe quoi")).toBe(96);
  });
  it("l'adresse passe avant tout", () => {
    expect(initialRenderDistance(48, "128")).toBe(48);
  });
  it("clé de stockage préfixée cubes:", () => {
    expect(DISTANCE_STORAGE_KEY.startsWith("cubes:")).toBe(true);
  });
});
