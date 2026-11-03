import { describe, expect, it } from "vitest";
import {
  SLOT_HOLD_CANCEL_OK_MS,
  SLOT_HOLD_MOVE_PX,
  SLOT_HOLD_MS,
  SLOT_HOLD_SHOW_MS,
  slotHoldAfterBlur,
  slotHoldAfterCancel,
  slotHoldMoved,
  slotHoldProgress,
  startSlotHold,
} from "../../src/input/slotHold";

describe("appui long sur une case (V2)", () => {
  it("réglages : une seconde en tout, anneau après 200 ms, 18 px de tolérance", () => {
    expect(SLOT_HOLD_MS).toBe(1000);
    expect(SLOT_HOLD_SHOW_MS).toBe(200);
    expect(SLOT_HOLD_MOVE_PX).toBe(18);
  });

  it("garde la case, l'instant, l'origine, la position et le doigt ; valeurs par défaut pour une touche", () => {
    expect(startSlotHold(3, 1000, "touch", 120, 900, 7)).toEqual({ slot: 3, since: 1000, source: "touch", x: 120, y: 900, pointer: 7 });
    expect(startSlotHold(0, 50, "key")).toEqual({ slot: 0, since: 50, source: "key", x: 0, y: 0, pointer: null });
    expect(startSlotHold(8, 50, "key", 0, 0, "Digit9").pointer).toBe("Digit9");
  });

  it("aucun anneau avant 200 ms (un tapotement ne montre rien)", () => {
    const h = startSlotHold(2, 1000, "mouse", 10, 10);
    expect(slotHoldProgress(h, 900)).toBe(0); // horloge d'avant l'appui
    expect(slotHoldProgress(h, 1000)).toBe(0);
    expect(slotHoldProgress(h, 1100)).toBe(0);
    expect(slotHoldProgress(h, 1000 + SLOT_HOLD_SHOW_MS)).toBe(0);
    expect(slotHoldProgress(h, 1000 + SLOT_HOLD_SHOW_MS + 1)).toBeGreaterThan(0);
  });

  it("l'anneau se remplit de 200 à 1 000 ms, plein à 1 s, borné à 1", () => {
    const h = startSlotHold(2, 1000, "touch", 10, 10, 1);
    expect(slotHoldProgress(h, 1000 + 600)).toBeCloseTo(0.5, 10);
    expect(slotHoldProgress(h, 1000 + 999)).toBeLessThan(1);
    expect(slotHoldProgress(h, 1000 + SLOT_HOLD_MS)).toBe(1);
    expect(slotHoldProgress(h, 1000 + 5000)).toBe(1);
    expect(slotHoldProgress(h, Number.NaN)).toBe(0);
  });

  it("un glissé de plus de 18 px annule, un tremblement de 10 px non", () => {
    const h = startSlotHold(4, 0, "touch", 100, 200, 3);
    expect(slotHoldMoved(h, 100, 200)).toBe(false);
    expect(slotHoldMoved(h, 110, 200)).toBe(false);
    expect(slotHoldMoved(h, 106, 208)).toBe(false); // 10 px en diagonale
    expect(slotHoldMoved(h, 100, 218)).toBe(false); // 18 px tout juste
    expect(slotHoldMoved(h, 100, 219)).toBe(true);
    expect(slotHoldMoved(h, 115, 215)).toBe(true); // 21 px en diagonale
    const m = startSlotHold(4, 0, "mouse", 100, 200);
    expect(slotHoldMoved(m, 70, 200)).toBe(true);
    expect(slotHoldMoved(m, 95, 195)).toBe(false);
  });

  it("doigt annulé par le système (touchcancel) : avant 900 ms l'appui est abandonné ; après, il est mené au bout", () => {
    expect(SLOT_HOLD_CANCEL_OK_MS).toBe(900);
    const h = startSlotHold(5, 1000, "touch", 120, 900, 7);
    expect(slotHoldAfterCancel(h, 1000)).toBeNull();
    expect(slotHoldAfterCancel(h, 1500)).toBeNull();
    expect(slotHoldAfterCancel(h, 1000 + SLOT_HOLD_CANCEL_OK_MS - 1)).toBeNull();
    expect(slotHoldAfterCancel(h, 900)).toBeNull(); // horloge d'avant l'appui
    expect(slotHoldAfterCancel(h, Number.NaN)).toBeNull();
    for (const at of [1000 + SLOT_HOLD_CANCEL_OK_MS, 1950, 1000 + SLOT_HOLD_MS, 4000]) {
      const done = slotHoldAfterCancel(h, at);
      expect(done).not.toBeNull();
      // Même case, même doigt, même origine : le jeu la vide à l'image suivante (anneau plein).
      expect(done).toMatchObject({ slot: 5, source: "touch", pointer: 7, x: 120, y: 900 });
      expect(slotHoldProgress(done!, at)).toBe(1);
      expect(slotHoldProgress(done!, at + 16)).toBe(1);
    }
    // Un appui déjà plein garde son début ; sinon, il est avancé juste assez ; l'appui de départ n'est pas modifié.
    expect(slotHoldAfterCancel(h, 4000)!.since).toBe(1000);
    expect(slotHoldAfterCancel(h, 1950)!.since).toBe(1950 - SLOT_HOLD_MS);
    expect(h.since).toBe(1000);
  });

  it("fenêtre qui perd le focus : appui plein gardé ; doigt tenu 900 ms mené au bout (la perte de focus peut précéder le touchcancel) ; sinon abandonné", () => {
    const finger = startSlotHold(5, 1000, "touch", 120, 900, 7);
    expect(slotHoldAfterBlur(finger, 1500)).toBeNull();
    expect(slotHoldAfterBlur(finger, 1000 + SLOT_HOLD_CANCEL_OK_MS - 1)).toBeNull();
    const kept = slotHoldAfterBlur(finger, 1950);
    expect(kept).toMatchObject({ slot: 5, source: "touch", pointer: 7 });
    expect(slotHoldProgress(kept!, 1950)).toBe(1);
    // Le touchcancel qui suit trouve l'appui, plein : il le garde plein (la case sera vidée à l'image suivante).
    expect(slotHoldProgress(slotHoldAfterCancel(kept!, 1960)!, 1960)).toBe(1);
    // Un appui plein (la seconde écoulée) reste tel quel, quelle que soit son origine.
    for (const source of ["mouse", "touch", "key"] as const) {
      const h = startSlotHold(1, 0, source);
      expect(slotHoldAfterBlur(h, SLOT_HOLD_MS)).toBe(h);
    }
    // Souris et clavier, pas encore pleins : abandonnés, même après 900 ms.
    expect(slotHoldAfterBlur(startSlotHold(2, 0, "mouse", 10, 10), 950)).toBeNull();
    expect(slotHoldAfterBlur(startSlotHold(2, 0, "key", 0, 0, "Digit3"), 950)).toBeNull();
  });

  it("souris et clavier n'ont pas d'annulation par le système : rien n'est mené au bout", () => {
    expect(slotHoldAfterCancel(startSlotHold(2, 0, "mouse", 10, 10), 950)).toBeNull();
    expect(slotHoldAfterCancel(startSlotHold(2, 0, "key", 0, 0, "Digit3"), 950)).toBeNull();
  });

  it("une touche ne glisse jamais", () => {
    const h = startSlotHold(0, 0, "key", 0, 0, "Digit1");
    expect(slotHoldMoved(h, 500, 500)).toBe(false);
    expect(slotHoldMoved(h, -1000, 0)).toBe(false);
  });
});
