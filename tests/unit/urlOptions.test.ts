import { describe, expect, it } from "vitest";
import { DEFAULT_RENDER_DISTANCE, DISTANCE_STORAGE_KEY, initialRenderDistance } from "../../src/game/renderDistance";
import { formatUrlOptions, isUrlMode, parseDistance, parseSeed, parseUrlOptions, startOptionsChanged } from "../../src/game/urlOptions";

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

  it("options du J5 : créatures (à 1) et mission (J6 : 0 = tutoriel, 1 = mission 1 ; V2 lot 1 : 2 = mission 2)", () => {
    expect(parseUrlOptions("#monde=plat&creatures=1&mission=1")).toEqual({ type: "plat", creatures: true, mission: 1 });
    expect(parseUrlOptions("#monde=plat&mission=0")).toEqual({ type: "plat", mission: 0 });
    expect(parseUrlOptions("#monde=plat&mission=2")).toEqual({ type: "plat", mission: 2 });
    for (const bad of ["3", "-1", "deux", "1.5", ""]) expect(parseUrlOptions(`#monde=plat&mission=${bad}`)).toEqual({ type: "plat" });
    expect(parseUrlOptions("#monde=plat&creatures=0")).toEqual({ type: "plat" });
  });

  it("durée de l'appui long (&appui=…, ms de 500 à 2 000) ; le reste ignoré", () => {
    expect(parseUrlOptions("#monde=plat&graine=1&appui=800")).toEqual({ type: "plat", seed: 1, slotHoldMs: 800 });
    expect(parseUrlOptions("#monde=plat&appui=1200")).toEqual({ type: "plat", slotHoldMs: 1200 });
    expect(parseUrlOptions("#appui=500").slotHoldMs).toBe(500);
    expect(parseUrlOptions("#appui=2000").slotHoldMs).toBe(2000);
    for (const bad of ["", "499", "2001", "0", "-800", "huit", "0,8", "800ms"]) {
      expect(parseUrlOptions(`#monde=plat&appui=${bad}`)).toEqual({ type: "plat" });
    }
  });

  it("niveau de lecture (V2 lot 1) : &lecture=debutant ou autonome, accents et casse tolérés, le reste ignoré", () => {
    expect(parseUrlOptions("#monde=plat&graine=1&mission=2&lecture=autonome")).toEqual({ type: "plat", seed: 1, mission: 2, lecture: "autonome" });
    expect(parseUrlOptions("#lecture=debutant")).toEqual({ lecture: "debutant" });
    expect(parseUrlOptions("#lecture=D%C3%A9butant")).toEqual({ lecture: "debutant" });
    expect(parseUrlOptions("#lecture=AUTONOME")).toEqual({ lecture: "autonome" });
    for (const bad of ["expert", "", "1"]) expect(parseUrlOptions(`#monde=plat&lecture=${bad}`)).toEqual({ type: "plat" });
  });

  it("garde la durée de l'appui long dans l'adresse réécrite (&appui=…) : un rechargement la retrouve", () => {
    expect(formatUrlOptions("plat", 1, 96, 96, 800)).toBe("#monde=plat&graine=1&appui=800");
    expect(formatUrlOptions("plat", 1, 48, 96, 1200)).toBe("#monde=plat&graine=1&distance=48&appui=1200");
    expect(formatUrlOptions("plat", 1, 96, 96, undefined)).toBe("#monde=plat&graine=1");
    // Aller-retour : l'adresse réécrite au chargement redonne la même durée.
    expect(parseUrlOptions(formatUrlOptions("plat", 1, 96, 96, 800))).toEqual({ type: "plat", seed: 1, slotHoldMs: 800 });
    expect(parseUrlOptions(formatUrlOptions("ile", 5, 128, 96, 500))).toEqual({ type: "ile", seed: 5, distance: 128, slotHoldMs: 500 });
    expect(parseUrlOptions(formatUrlOptions("ile", 5, 128, 96, 2000)).slotHoldMs).toBe(2000);
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

  it("adresse réécrite : Grignotes, mission et niveau de lecture du démarrage y restent (F5 les retrouve)", () => {
    expect(formatUrlOptions("plat", 1, 96, 96, undefined, { mission: 2, lecture: "autonome" })).toBe("#monde=plat&graine=1&mission=2&lecture=autonome");
    expect(formatUrlOptions("prairie", 3, 48, 96, 800, { creatures: true, mission: 0 })).toBe("#monde=prairie&graine=3&distance=48&appui=800&creatures=1&mission=0");
    expect(formatUrlOptions("plat", 1, 96, 96, undefined, { creatures: false })).toBe("#monde=plat&graine=1");
    const back = parseUrlOptions(formatUrlOptions("ile", 9, 96, 96, 1200, { creatures: true, mission: 1, lecture: "debutant" }));
    expect(back).toEqual({ type: "ile", seed: 9, slotHoldMs: 1200, creatures: true, mission: 1, lecture: "debutant" });
  });

  it("adresse changée sans rechargement : recharger seulement si le mode adresse, les Grignotes, la mission ou la lecture changent", () => {
    const p = (h: string) => parseUrlOptions(h);
    expect(isUrlMode(p("#graine=4"))).toBe(true);
    expect(isUrlMode(p("#distance=48"))).toBe(false);
    // Accueil → mode adresse, et retour (« # » laissé seul, ou monde effacé).
    expect(startOptionsChanged(p(""), p("#monde=plat&graine=1"))).toBe(true);
    expect(startOptionsChanged(p("#monde=plat&graine=1"), p("#"))).toBe(true);
    expect(startOptionsChanged(p("#monde=plat&graine=1"), p("#appui=800"))).toBe(true);
    // Hors mode adresse, rien d'autre ne compte (distance, options ignorées).
    expect(startOptionsChanged(p(""), p("#distance=48&mission=2"))).toBe(false);
    // Mode adresse : monde, graine, distance, appui, heure se relisent sans rechargement.
    const start = p("#monde=plat&graine=1&mission=2&lecture=debutant");
    expect(startOptionsChanged(start, p("#monde=ile&graine=7&mission=2&lecture=debutant&distance=48&appui=1200&heure=20"))).toBe(false);
    expect(startOptionsChanged(start, p("#monde=plat&graine=1&mission=2&lecture=d%C3%A9butant"))).toBe(false);
    // … mais pas la mission, la lecture ni les Grignotes.
    expect(startOptionsChanged(start, p("#monde=plat&graine=1&mission=2&lecture=autonome"))).toBe(true);
    expect(startOptionsChanged(start, p("#monde=plat&graine=1&lecture=debutant"))).toBe(true);
    expect(startOptionsChanged(start, p("#monde=plat&graine=1&mission=1&lecture=debutant"))).toBe(true);
    expect(startOptionsChanged(start, p("#monde=plat&graine=1&mission=2&lecture=debutant&creatures=1"))).toBe(true);
    expect(startOptionsChanged(p("#monde=plat&graine=1"), p("#monde=plat&graine=1&mission=2"))).toBe(true);
  });
});
