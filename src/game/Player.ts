import type { World } from "../engine/World";
import { sweep, type AABB } from "../engine/physics";

export interface MoveInput {
  /** Latéral [-1, 1] (droite positive) et avant [-1, 1] (avant positif), dans le repère du regard. */
  x: number;
  z: number;
  jump: boolean;
}

/** Constantes de déplacement (unités : blocs, secondes). */
export const PLAYER = {
  halfWidth: 0.3,
  height: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 4.3,
  gravity: 24,
  jumpSpeed: 8.2,
  maxFallSpeed: 30,
  maxPitch: Math.PI / 2 - 0.01,
};

/**
 * Le joueur : position des pieds (centre de la base), vitesse, orientation.
 * La physique est une boîte contre les blocs ; on ne peut ni mourir ni se blesser.
 */
export class Player {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  /** Rotation horizontale (radians, 0 = regarde vers -Z). */
  yaw = 0;
  /** Rotation verticale (radians, positif = vers le haut). */
  pitch = 0;
  onGround = false;

  constructor(private readonly world: World) {}

  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = this.vy = this.vz = 0;
  }

  rotate(yawDelta: number, pitchDelta: number): void {
    this.yaw += yawDelta;
    this.pitch = Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, this.pitch + pitchDelta));
  }

  box(): AABB {
    return {
      minX: this.x - PLAYER.halfWidth,
      maxX: this.x + PLAYER.halfWidth,
      minY: this.y,
      maxY: this.y + PLAYER.height,
      minZ: this.z - PLAYER.halfWidth,
      maxZ: this.z + PLAYER.halfWidth,
    };
  }

  eye(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y + PLAYER.eyeHeight, z: this.z };
  }

  /** Direction du regard (vecteur unitaire). */
  lookDir(): { x: number; y: number; z: number } {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  update(dt: number, input: MoveInput): void {
    // Déplacement horizontal dans le repère du regard (yaw seulement).
    const len = Math.hypot(input.x, input.z);
    let ix = input.x;
    let iz = input.z;
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Avant = -Z tourné par yaw ; droite = +X tourné par yaw.
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    this.vx = (fx * iz + rx * ix) * PLAYER.walkSpeed;
    this.vz = (fz * iz + rz * ix) * PLAYER.walkSpeed;

    if (input.jump && this.onGround) {
      this.vy = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    this.vy = Math.max(this.vy - PLAYER.gravity * dt, -PLAYER.maxFallSpeed);

    const box = this.box();
    const r = sweep(this.world, box, this.vx * dt, this.vy * dt, this.vz * dt);
    this.x = (box.minX + box.maxX) / 2;
    this.y = box.minY;
    this.z = (box.minZ + box.maxZ) / 2;

    if (r.hitY) {
      if (this.vy < 0) this.onGround = true;
      this.vy = 0;
    } else {
      this.onGround = false;
    }
    if (r.hitX) this.vx = 0;
    if (r.hitZ) this.vz = 0;

    // Filet de sécurité (ne devrait plus servir : les bords et le dessous du
    // monde sont des murs) : si on se retrouve sous le monde, retour au centre.
    if (this.y < -20) {
      const cx = Math.floor(this.world.sizeX / 2);
      const cz = Math.floor(this.world.sizeZ / 2);
      this.setPosition(cx + 0.5, (this.world.findStandingY(cx, cz) ?? this.world.surfaceHeight(cx, cz)) + 0.01, cz + 0.5);
    }
  }
}
