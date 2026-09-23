import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import { Player, PLAYER } from "../../src/game/Player";

const DT = 1 / 60;

function run(p: Player, seconds: number, input: { x: number; z: number; jump: boolean }): void {
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
