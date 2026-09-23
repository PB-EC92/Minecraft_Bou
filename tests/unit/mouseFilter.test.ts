import { describe, expect, it } from "vitest";
import { acceptMouseDelta, classifyMouseDelta, isClick, LOCK_SETTLE_MS, MAX_DELTA_PX } from "../../src/input/mouseFilter";

describe("filtre souris (audit J0, constat 1)", () => {
  it("écarte le faux mouvement envoyé au moment de la capture", () => {
    // Valeur réellement observée dans Chromium pour une fenêtre 1280 × 720
    expect(acceptMouseDelta(-640, -360, 1000, 0)).toBe(false);
  });

  it("écarte tout mouvement pendant la courte période qui suit la capture", () => {
    const lockedAt = 1000;
    expect(acceptMouseDelta(3, 2, lockedAt + 10, lockedAt + LOCK_SETTLE_MS)).toBe(false);
    expect(acceptMouseDelta(3, 2, lockedAt + LOCK_SETTLE_MS + 1, lockedAt + LOCK_SETTLE_MS)).toBe(true);
  });

  it("accepte les mouvements normaux et le seuil exact", () => {
    expect(acceptMouseDelta(12, -7, 5000, 0)).toBe(true);
    expect(acceptMouseDelta(MAX_DELTA_PX, -MAX_DELTA_PX, 5000, 0)).toBe(true);
    expect(acceptMouseDelta(MAX_DELTA_PX + 1, 0, 5000, 0)).toBe(false);
  });

  it("écarte les valeurs non numériques", () => {
    expect(acceptMouseDelta(Number.NaN, 0, 5000, 0)).toBe(false);
  });
});

describe("clic ou glisser (audit J0, constat 2)", () => {
  it("un appui bref et immobile est un clic", () => {
    expect(isClick(0, 120)).toBe(true);
    expect(isClick(4, 300)).toBe(true);
  });
  it("un déplacement ou un appui long est un glisser", () => {
    expect(isClick(20, 120)).toBe(false);
    expect(isClick(0, 900)).toBe(false);
  });
});

describe("verdict détaillé (retours J0.1 : distinguer les causes)", () => {
  it("après capture, trop grand, invalide, accepté", () => {
    expect(classifyMouseDelta(3, 2, 1010, 1080)).toBe("settle");
    expect(classifyMouseDelta(-640, -360, 1010, 1080)).toBe("settle");
    expect(classifyMouseDelta(-640, -360, 5000, 1080)).toBe("large");
    expect(classifyMouseDelta(Number.NaN, 0, 5000, 0)).toBe("invalid");
    expect(classifyMouseDelta(40, -12, 5000, 1080)).toBe("ok");
  });
});
