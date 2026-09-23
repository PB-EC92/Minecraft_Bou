import { describe, expect, it } from "vitest";
import { createNoise2D, fbm, hash2 } from "../../src/engine/noise";

describe("bruit à graine", () => {
  it("même graine, mêmes valeurs ; autre graine, autres valeurs", () => {
    const a = createNoise2D(42);
    const b = createNoise2D(42);
    const c = createNoise2D(43);
    const pts = [0.3, 1.7, 5.25, 12.9, 40.1];
    expect(pts.map((p) => a(p, p * 0.7))).toEqual(pts.map((p) => b(p, p * 0.7)));
    expect(pts.map((p) => a(p, p * 0.7))).not.toEqual(pts.map((p) => c(p, p * 0.7)));
  });

  it("reste dans [-1, 1] et varie vraiment", () => {
    const n = createNoise2D(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const v = fbm(n, (i % 63) * 0.37, Math.floor(i / 63) * 0.41, 4);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.6);
  });

  it("hachage de colonne déterministe, dans [0, 1), bien réparti", () => {
    expect(hash2(3, 9, 5)).toBe(hash2(3, 9, 5));
    let sum = 0;
    for (let x = 0; x < 100; x++) for (let z = 0; z < 100; z++) {
      const h = hash2(x, z, 123);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      sum += h;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });
});
