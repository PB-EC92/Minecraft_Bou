import type { World } from "../engine/World";
import { collides, sweep, type AABB } from "../engine/physics";

export interface MoveInput {
  /** Latéral [-1, 1] (droite positive) et avant [-1, 1] (avant positif), dans le repère du regard. */
  x: number;
  z: number;
  jump: boolean;
  /** Plonger (dans l'eau). */
  down?: boolean;
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
  /** Hauteur d'une marche montée sans sauter (constat 9 de l'audit J0). */
  stepHeight: 1.01,
  /** Dans l'eau : on peut aussi se hisser sur une berge un peu plus haute. */
  waterStepHeight: 2.0,
  waterSpeedFactor: 0.7,
  /** On flotte naturellement : les pieds se stabilisent à cette profondeur sous la surface. */
  floatDepth: 0.9,
  floatUpSpeed: 1.6,
  swimUpSpeed: 3.4,
  swimDownSpeed: 2.2,
  /** Rapidité avec laquelle la vitesse verticale rejoint la vitesse visée dans l'eau (1/s). */
  waterDrag: 6,
  /** Durée caractéristique du lissage de la caméra après une marche (s). */
  eyeSmoothing: 0.08,
};

const EPS = 1e-4;

/**
 * Le joueur : position des pieds (centre de la base), vitesse, orientation.
 * La physique est une boîte contre les blocs ; on ne peut ni mourir ni se
 * blesser, ni se noyer : dans l'eau on flotte.
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
  inWater = false;
  headInWater = false;
  /** Montée automatique des marches (réglable, par exemple en mode parent au J4). */
  autoStep = true;
  /** Nombre de marches montées automatiquement (diagnostic, tests). */
  stepsClimbed = 0;
  /** Décalage de la caméra après une marche, ramené à 0 en douceur. */
  private eyeOffset = 0;

  constructor(private readonly world: World) {}

  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.eyeOffset = 0;
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

  /** Position de l'œil (caméra), lissée après une marche. */
  eye(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y + PLAYER.eyeHeight + this.eyeOffset, z: this.z };
  }

  /** Direction du regard (vecteur unitaire). */
  lookDir(): { x: number; y: number; z: number } {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  private overlapsWater(b: AABB): boolean {
    const x0 = Math.floor(b.minX);
    const x1 = Math.floor(b.maxX - EPS);
    const y0 = Math.floor(b.minY);
    const y1 = Math.floor(b.maxY - EPS);
    const z0 = Math.floor(b.minZ);
    const z1 = Math.floor(b.maxZ - EPS);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.world.isWater(x, y, z)) return true;
    return false;
  }

  update(dt: number, input: MoveInput): void {
    this.inWater = this.overlapsWater(this.box());

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
    const speed = PLAYER.walkSpeed * (this.inWater ? PLAYER.waterSpeedFactor : 1);
    this.vx = (-sin * iz + cos * ix) * speed;
    this.vz = (-cos * iz - sin * ix) * speed;

    if (this.inWater) {
      // Flotter par défaut, nager vers le haut (saut), plonger (bas).
      const probe = this.world.isWater(Math.floor(this.x), Math.floor(this.y + PLAYER.floatDepth), Math.floor(this.z));
      let target: number;
      if (input.down) target = -PLAYER.swimDownSpeed;
      else if (input.jump) target = PLAYER.swimUpSpeed;
      else target = probe ? PLAYER.floatUpSpeed : 0;
      this.vy += (target - this.vy) * Math.min(1, PLAYER.waterDrag * dt);
    } else {
      if (input.jump && this.onGround) {
        this.vy = PLAYER.jumpSpeed;
        this.onGround = false;
      }
      this.vy = Math.max(this.vy - PLAYER.gravity * dt, -PLAYER.maxFallSpeed);
    }

    const wasOnGround = this.onGround;
    const wantX = this.vx * dt;
    const wantZ = this.vz * dt;
    const box = this.box();
    const r = sweep(this.world, box, wantX, this.vy * dt, wantZ);
    let hitY = r.hitY;
    let hitX = r.hitX;
    let hitZ = r.hitZ;
    let stepped = false;

    if ((hitX || hitZ) && this.autoStep && (wasOnGround || this.inWater) && Math.abs(wantX) + Math.abs(wantZ) > 1e-6) {
      const rise = this.tryStep(box, wantX - r.dx, wantZ - r.dz, this.inWater ? PLAYER.waterStepHeight : PLAYER.stepHeight);
      if (rise > 0) {
        stepped = true;
        hitX = hitZ = false;
        hitY = true;
        this.vy = 0;
        this.eyeOffset -= rise;
        this.stepsClimbed++;
      }
    }

    this.x = (box.minX + box.maxX) / 2;
    this.y = box.minY;
    this.z = (box.minZ + box.maxZ) / 2;

    if (hitY) {
      if (this.vy <= 0 || stepped) this.onGround = true;
      this.vy = 0;
    } else {
      this.onGround = false;
    }
    if (hitX) this.vx = 0;
    if (hitZ) this.vz = 0;

    this.inWater = this.overlapsWater(this.box());
    const e = this.eye();
    this.headInWater = this.world.isWater(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    this.eyeOffset *= Math.exp(-dt / PLAYER.eyeSmoothing);
    if (Math.abs(this.eyeOffset) < 1e-3) this.eyeOffset = 0;

    // Filet de sécurité (ne devrait plus servir : les bords et le dessous du
    // monde sont des murs) : si on se retrouve sous le monde, retour au centre.
    if (this.y < -20) {
      const cx = Math.floor(this.world.sizeX / 2);
      const cz = Math.floor(this.world.sizeZ / 2);
      this.setPosition(cx + 0.5, (this.world.findStandingY(cx, cz) ?? this.world.surfaceHeight(cx, cz)) + 0.01, cz + 0.5);
    }
  }

  /**
   * Montée d'une marche : on soulève la boîte, on termine le déplacement
   * horizontal, puis on la repose. Accepté seulement si l'on a avancé et que
   * l'on se retrouve plus haut. Modifie `box` en place ; retourne la hauteur
   * montée (0 = pas de marche, boîte inchangée).
   */
  private tryStep(box: AABB, dx: number, dz: number, maxRise: number): number {
    const saved = { ...box };
    const restore = () => Object.assign(box, saved);
    box.minY += maxRise;
    box.maxY += maxRise;
    if (collides(this.world, box)) {
      restore();
      return 0;
    }
    const h = sweep(this.world, box, dx, 0, dz);
    if (Math.abs(h.dx) + Math.abs(h.dz) < 1e-3) {
      restore();
      return 0;
    }
    sweep(this.world, box, 0, -maxRise, 0);
    const rise = box.minY - saved.minY;
    if (rise < 0.5) {
      restore();
      return 0;
    }
    return rise;
  }
}
