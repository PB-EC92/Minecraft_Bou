import { describe, expect, it } from "vitest";
import { nearestSlot } from "../../src/ui/nearestSlot";

describe("case la plus proche d'un toucher", () => {
  const centers = [244, 316, 388, 460, 532];
  it("choisit la case sous le doigt", () => {
    expect(nearestSlot(388, centers)).toBe(2);
  });
  it("entre deux cases ou dans la marge : la plus proche", () => {
    expect(nearestSlot(350, centers)).toBe(1);
    expect(nearestSlot(200, centers)).toBe(0);
    expect(nearestSlot(600, centers)).toBe(4);
  });
  it("barre vide : aucune", () => {
    expect(nearestSlot(10, [])).toBe(-1);
  });
});
