import { describe, expect, it } from "vitest";
import { HOLD_HINT_MAX_MS, HOLD_START_MS, isHolding, newBreakPress, shouldHintHold } from "../../src/input/breakPress";

describe("appui « casser »", () => {
  it("sans appui, rien n'est tenu", () => {
    expect(isHolding(null, 1000)).toBe(false);
  });

  it("souris capturée (appui non ambigu) : tenu tout de suite", () => {
    const p = newBreakPress(1000, false);
    expect(isHolding(p, 1000)).toBe(true);
  });

  it("appui ambigu : tenu seulement après un court instant d'immobilité", () => {
    const p = newBreakPress(1000, true);
    expect(isHolding(p, 1000 + HOLD_START_MS - 1)).toBe(false);
    expect(isHolding(p, 1000 + HOLD_START_MS)).toBe(true);
  });

  it("un glisser n'est jamais un appui tenu", () => {
    const p = newBreakPress(1000, true);
    p.still = false;
    expect(isHolding(p, 5000)).toBe(false);
  });

  it("conseille de rester appuyé après un appui bref sans casse", () => {
    const p = newBreakPress(1000, false);
    expect(shouldHintHold(p, 1100, -Infinity)).toBe(true);
  });

  it("pas de conseil si un bloc a été cassé pendant l'appui, si l'appui était long, ou si c'était un glisser", () => {
    const p = newBreakPress(1000, false);
    expect(shouldHintHold(p, 1100, 1050)).toBe(false);
    expect(shouldHintHold(p, 1000 + HOLD_HINT_MAX_MS, -Infinity)).toBe(false);
    const drag = newBreakPress(1000, true);
    drag.still = false;
    expect(shouldHintHold(drag, 1100, -Infinity)).toBe(false);
  });
});
