import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import { Player, PLAYER, type MoveInput } from "../../src/game/Player";

const DT = 1 / 60;

function run(p: Player, seconds: number, input: MoveInput): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) p.update(DT, input);
}

describe("Player", () => {
  it("avance vers -Z quand il regarde droit devant (yaw = 0)", () => {
    const p = new Player(World.createFlat(32, 16, 32, 4));
    p.setPosition(16.5, 4.01, 20.5);
    run(p, 1, { x: 0, z: 1, jump: false });
    expect(p.z).toBeCloseTo(20.5 - PLAYER.walkSpeed, 0);
    expect(p.x).toBeCloseTo(16.5, 5);
    expect(p.onGround).toBe(true);
    expect(p.y).toBeCloseTo(4, 2);
  });

  it("ne sort jamais du monde et ne tombe pas dans le vide (audit J0, constat 4)", () => {
    const w = World.createFlat(32, 16, 32, 4);
    const p = new Player(w);
    p.setPosition(29.5, 4.01, 16.5);
    p.yaw = -Math.PI / 2; // regarde vers +X
    run(p, 3, { x: 0, z: 1, jump: false });
    expect(p.x).toBeLessThanOrEqual(w.sizeX - PLAYER.halfWidth + 1e-3);
    expect(p.x).toBeGreaterThan(31);
    expect(p.y).toBeCloseTo(4, 2);
    expect(p.onGround).toBe(true);
  });

  it("reste au fond d'un trou creusé jusqu'à la dernière couche", () => {
    const w = World.createFlat(8, 16, 8, 4);
    for (let y = 1; y < 4; y++) w.set(3, y, 3, BlockId.Air);
    const p = new Player(w);
    p.setPosition(3.5, 4.01, 3.5);
    run(p, 1.5, { x: 0, z: 0, jump: false });
    expect(p.y).toBeCloseTo(1, 2);
    expect(p.onGround).toBe(true);
  });

  it("saute d'un peu plus d'un bloc puis retombe au sol", () => {
    const p = new Player(World.createFlat(16, 16, 16, 4));
    p.setPosition(8.5, 4.01, 8.5);
    run(p, 0.05, { x: 0, z: 0, jump: false }); // se pose
    let maxY = p.y;
    p.update(DT, { x: 0, z: 0, jump: true });
    for (let i = 0; i < 90; i++) {
      p.update(DT, { x: 0, z: 0, jump: false });
      maxY = Math.max(maxY, p.y);
    }
    expect(maxY - 4).toBeGreaterThan(1.2);
    expect(maxY - 4).toBeLessThan(1.7);
    expect(p.y).toBeCloseTo(4, 2);
    expect(p.onGround).toBe(true);
  });

  it("bloque le regard vertical avant la verticale", () => {
    const p = new Player(World.createFlat(4, 4, 4, 2));
    p.rotate(0, 10);
    expect(p.pitch).toBeCloseTo(PLAYER.maxPitch, 5);
    p.rotate(0, -20);
    expect(p.pitch).toBeCloseTo(-PLAYER.maxPitch, 5);
  });
});

describe("montée automatique des marches (constat 9 de l'audit J0)", () => {
  function stepWorld(wallHeight: number): World {
    const w = World.createFlat(24, 16, 16, 4);
    // Palier d'une (ou plusieurs) marche(s) à partir de x = 10, sur toute la largeur utile
    for (let x = 10; x < 24; x++) for (let z = 4; z < 12; z++) for (let y = 4; y < 4 + wallHeight; y++) w.set(x, y, z, BlockId.Stone);
    return w;
  }

  it("monte une marche d'un bloc en marchant, sans sauter", () => {
    const p = new Player(stepWorld(1));
    p.setPosition(7.5, 4.01, 8.5);
    p.yaw = -Math.PI / 2; // regarde vers +X
    run(p, 1.5, { x: 0, z: 1, jump: false });
    expect(p.x).toBeGreaterThan(11);
    expect(p.y).toBeCloseTo(5, 2);
    expect(p.stepsClimbed).toBe(1);
    expect(p.onGround).toBe(true);
  });

  it("ne franchit pas un mur de deux blocs", () => {
    const p = new Player(stepWorld(2));
    p.setPosition(7.5, 4.01, 8.5);
    p.yaw = -Math.PI / 2;
    run(p, 2, { x: 0, z: 1, jump: false });
    expect(p.x).toBeLessThan(10);
    expect(p.y).toBeCloseTo(4, 2);
    expect(p.stepsClimbed).toBe(0);
  });

  it("se désactive (réglage)", () => {
    const p = new Player(stepWorld(1));
    p.autoStep = false;
    p.setPosition(7.5, 4.01, 8.5);
    p.yaw = -Math.PI / 2;
    run(p, 1.5, { x: 0, z: 1, jump: false });
    expect(p.x).toBeLessThan(10);
  });

  it("la caméra monte en douceur, sans à-coup", () => {
    const p = new Player(stepWorld(1));
    p.setPosition(7.5, 4.01, 8.5);
    p.yaw = -Math.PI / 2;
    let prev = p.eye().y;
    let maxJump = 0;
    for (let i = 0; i < 90; i++) {
      p.update(DT, { x: 0, z: 1, jump: false });
      maxJump = Math.max(maxJump, p.eye().y - prev);
      prev = p.eye().y;
    }
    expect(p.y).toBeCloseTo(5, 2);
    expect(maxJump).toBeLessThan(0.3); // la marche fait 1 bloc, la caméra la monte en plusieurs images
  });
});

describe("dans l'eau (J1) : on flotte, on nage, on ne se noie pas", () => {
  /** Bassin : sol à y = 4, eau de y = 4 à y = 9 (surface à y = 10), berge à x ≥ 12 (herbe jusqu'à y = 10). */
  function pool(): World {
    const w = World.createFlat(20, 20, 12, 4);
    for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) for (let y = 4; y < 10; y++) w.set(x, y, z, BlockId.Water);
    for (let x = 12; x < 20; x++) for (let z = 0; z < 12; z++) for (let y = 4; y < 11; y++) w.set(x, y, z, BlockId.Dirt);
    return w;
  }

  it("remonte seul à la surface et y flotte, la tête hors de l'eau", () => {
    const p = new Player(pool());
    p.setPosition(5.5, 4.01, 5.5);
    run(p, 6, { x: 0, z: 0, jump: false });
    expect(p.inWater).toBe(true);
    expect(p.headInWater).toBe(false);
    expect(p.y + PLAYER.floatDepth).toBeGreaterThan(9.6);
    expect(p.y + PLAYER.floatDepth).toBeLessThan(10.4);
  });

  it("plonge avec la touche « bas », remonte en la relâchant", () => {
    const p = new Player(pool());
    p.setPosition(5.5, 9.1, 5.5);
    run(p, 1.5, { x: 0, z: 0, jump: false, down: true });
    expect(p.y).toBeLessThan(7);
    expect(p.headInWater).toBe(true);
    run(p, 6, { x: 0, z: 0, jump: false });
    expect(p.headInWater).toBe(false);
  });

  it("sort de l'eau en avançant vers une berge d'un bloc", () => {
    const p = new Player(pool());
    p.setPosition(8.5, 9.1, 5.5);
    p.yaw = -Math.PI / 2; // vers la berge (+X)
    run(p, 4, { x: 0, z: 1, jump: false });
    expect(p.x).toBeGreaterThan(12.5);
    expect(p.y).toBeCloseTo(11, 1);
    expect(p.inWater).toBe(false);
  });

  it("avance moins vite dans l'eau", () => {
    const p = new Player(pool());
    p.setPosition(1.5, 9.1, 5.5);
    p.yaw = -Math.PI / 2;
    run(p, 1, { x: 0, z: 1, jump: false });
    expect(p.x - 1.5).toBeLessThan(PLAYER.walkSpeed * 0.8);
    expect(p.x - 1.5).toBeGreaterThan(PLAYER.walkSpeed * 0.5);
  });
});
