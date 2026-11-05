import { describe, expect, it } from "vitest";
import { inJoystickZone, JOYSTICK_CATCH, JOYSTICK_DEAD, joystickVector } from "../../src/input/touchZones";

const c = { x: 100, y: 700 };
const r = 70;

describe("zone de prise du joystick fixe", () => {
  it("prend un toucher sur le rond et juste autour", () => {
    expect(inJoystickZone(c, c, r)).toBe(true);
    expect(inJoystickZone({ x: c.x + r, y: c.y }, c, r)).toBe(true);
    expect(inJoystickZone({ x: c.x, y: c.y - r * JOYSTICK_CATCH }, c, r)).toBe(true);
  });

  it("laisse le reste de l'écran au regard, même à gauche", () => {
    expect(inJoystickZone({ x: c.x, y: c.y - r * JOYSTICK_CATCH - 1 }, c, r)).toBe(false);
    expect(inJoystickZone({ x: 60, y: 200 }, c, r)).toBe(false); // haut de la moitié gauche
    expect(inJoystickZone({ x: 400, y: 700 }, c, r)).toBe(false);
  });

  it("ne prend rien si le rond n'est pas affiché (rayon nul)", () => {
    expect(inJoystickZone(c, c, 0)).toBe(false);
    expect(inJoystickZone(c, c, Number.NaN)).toBe(false);
  });
});

describe("commande du joystick", () => {
  it("doigt au centre ou dans la zone morte : pas de déplacement", () => {
    expect(joystickVector(c, c, r)).toMatchObject({ x: 0, z: 0 });
    const v = joystickVector({ x: c.x + r * JOYSTICK_DEAD * 0.9, y: c.y }, c, r);
    expect(v.x).toBe(0);
    expect(v.knobX).toBeCloseTo(r * JOYSTICK_DEAD * 0.9);
  });

  it("doigt vers le haut : avance ; vers la droite : pas de côté à droite", () => {
    const up = joystickVector({ x: c.x, y: c.y - r }, c, r);
    expect(up.z).toBeCloseTo(1);
    expect(up.x).toBeCloseTo(0);
    const right = joystickVector({ x: c.x + r, y: c.y }, c, r);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it("au-delà du bord : amplitude 1, manette bornée au rond", () => {
    const v = joystickVector({ x: c.x, y: c.y + 3 * r }, c, r);
    expect(v.z).toBeCloseTo(-1);
    expect(v.knobY).toBeCloseTo(r);
    const diag = joystickVector({ x: c.x + 2 * r, y: c.y - 2 * r }, c, r);
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1);
    expect(Math.hypot(diag.knobX, diag.knobY)).toBeCloseTo(r);
  });

  it("l'amplitude croît sans à-coup au sortir de la zone morte", () => {
    const edge = joystickVector({ x: c.x + r * JOYSTICK_DEAD + 0.01, y: c.y }, c, r);
    expect(edge.x).toBeGreaterThan(0);
    expect(edge.x).toBeLessThan(0.01);
    const half = joystickVector({ x: c.x + r * 0.5, y: c.y }, c, r).x;
    const most = joystickVector({ x: c.x + r * 0.9, y: c.y }, c, r).x;
    expect(half).toBeLessThan(most);
  });

  it("rayon invalide : rien", () => {
    expect(joystickVector({ x: 0, y: 0 }, c, 0)).toEqual({ x: 0, z: 0, knobX: 0, knobY: 0 });
  });
});
