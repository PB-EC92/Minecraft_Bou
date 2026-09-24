import { describe, expect, it } from "vitest";
import { BASE_VERTICAL_FOV, horizontalFov, MAX_VERTICAL_FOV, MIN_HORIZONTAL_FOV, verticalFovFor } from "../../src/render/fov";

describe("champ de vision selon l'orientation", () => {
  it("paysage : champ vertical inchangé", () => {
    expect(verticalFovFor(1920 / 1080)).toBe(BASE_VERTICAL_FOV);
    expect(verticalFovFor(1280 / 720)).toBe(BASE_VERTICAL_FOV);
    expect(verticalFovFor(1)).toBe(BASE_VERTICAL_FOV);
  });

  it("portrait du convertible (1080 × 1802) : au moins 60° en largeur", () => {
    const aspect = 1080 / 1802;
    expect(horizontalFov(BASE_VERTICAL_FOV, aspect)).toBeLessThan(47); // la « fente » d'avant le J3
    const v = verticalFovFor(aspect);
    expect(v).toBeGreaterThan(BASE_VERTICAL_FOV);
    expect(v).toBeLessThanOrEqual(MAX_VERTICAL_FOV);
    expect(horizontalFov(v, aspect)).toBeCloseTo(MIN_HORIZONTAL_FOV, 5);
  });

  it("portrait très étroit : plafonné", () => {
    expect(verticalFovFor(0.2)).toBe(MAX_VERTICAL_FOV);
  });

  it("rapport invalide : champ de base", () => {
    expect(verticalFovFor(0)).toBe(BASE_VERTICAL_FOV);
    expect(verticalFovFor(Number.NaN)).toBe(BASE_VERTICAL_FOV);
    expect(verticalFovFor(-1)).toBe(BASE_VERTICAL_FOV);
  });
});
