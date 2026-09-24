import { BlockId, isSolidId } from "./blocks";
import { createRng } from "./random";
import type { World } from "./World";

/**
 * Les Grignotes (J5) : petites boules à poils rigolotes. Machine à états simple,
 * sans rendu ni DOM (testée en Node) :
 * - le jour, deux Grignotes errent loin du joueur ;
 * - la nuit, jusqu'à quatre s'approchent ; au contact, une Grignote chipe un
 *   bloc du sac puis s'enfuit en riant (jamais de dégâts au joueur) ;
 * - elles fuient à quelques blocs d'une lampe et ne s'en approchent pas ;
 * - elles ne montent jamais sur une clôture (ni ne la franchissent) ;
 * - une bulle les fait fuir ; touchée par une bulle, une Grignote qui porte un
 *   bloc chipé le rend.
 */

export const LAMP_RADIUS = 6;
export const DAY_COUNT = 2;
export const NIGHT_COUNT = 4;
/** Distance d'apparition autour du joueur (blocs). */
export const SPAWN_MIN = 14;
export const SPAWN_MAX = 24;
/** Le jour, distance gardée avec le joueur. */
export const DAY_DISTANCE = 12;
/** Distance de contact (vol d'un bloc). */
export const CONTACT_DISTANCE = 0.9;
/** Délai minimal entre deux vols, toutes Grignotes confondues (ms) : pas de frustration en rafale. */
export const STEAL_COOLDOWN_MS = 25_000;
export const FLEE_MS = 7_000;
export const BUBBLE_RANGE = 10;
/** Demi-angle du cône des bulles (radians). */
export const BUBBLE_HALF_ANGLE = 0.5;
const WALK_SPEED = 1.6;
const APPROACH_SPEED = 2.2;
const FLEE_SPEED = 3.4;
/** Au-delà, une Grignote est retirée (et une autre apparaîtra plus près si besoin). */
const DESPAWN_DISTANCE = 40;

export type CreatureMode = "wander" | "approach" | "flee";

export interface Creature {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Direction du regard (radians, comme le joueur : 0 = vers −Z). */
  yaw: number;
  mode: CreatureMode;
  /** Fin de la fuite (ms, horloge de la simulation). */
  fleeUntil: number;
  /** Point d'où elle fuit. */
  fleeFrom: { x: number; z: number } | null;
  /** Bloc chipé qu'elle emporte, ou null. */
  carried: BlockId | null;
  /** Couleur (index dans une palette du rendu). */
  color: number;
  /** Cap de promenade et date du prochain changement. */
  wanderYaw: number;
  wanderUntil: number;
  /** Petits bonds (animation) : vrai si elle s'est déplacée à cette étape. */
  moving: boolean;
}

export interface SimContext {
  player: { x: number; y: number; z: number };
  night: boolean;
  /** Positions des lampes posées (centres des blocs). */
  lamps: readonly { x: number; y: number; z: number }[];
  /** Réglage du mode parent : créatures actives. */
  enabled: boolean;
  /** Le sac contient au moins un bloc (sinon, pas de vol). */
  bagHasBlocks: boolean;
}

export type CreatureEvent =
  | { kind: "steal"; id: number }
  | { kind: "flee-lamp"; id: number }
  | { kind: "spawn"; id: number }
  | { kind: "despawn"; id: number };

export class CreatureSim {
  readonly creatures: Creature[] = [];
  private nextId = 1;
  private now = 0;
  private lastStealAt = -Infinity;
  private readonly rng: () => number;

  constructor(
    private world: World,
    seed = 1,
  ) {
    this.rng = createRng(seed);
  }

  setWorld(world: World): void {
    this.world = world;
    this.creatures.length = 0;
  }

  get time(): number {
    return this.now;
  }

  /** Avance la simulation de dtMs. Renvoie les événements à traduire en sons et messages. */
  update(dtMs: number, ctx: SimContext): CreatureEvent[] {
    this.now += dtMs;
    const events: CreatureEvent[] = [];
    const dt = Math.min(dtMs, 100) / 1000;
    if (!ctx.enabled) {
      for (const c of this.creatures.splice(0)) events.push({ kind: "despawn", id: c.id });
      return events;
    }
    // Population : quelques Grignotes le jour, plus la nuit.
    const want = ctx.night ? NIGHT_COUNT : DAY_COUNT;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i]!;
      const d = Math.hypot(c.x - ctx.player.x, c.z - ctx.player.z);
      if (d > DESPAWN_DISTANCE || (this.creatures.length > want && d > SPAWN_MIN && c.carried === null)) {
        this.creatures.splice(i, 1);
        events.push({ kind: "despawn", id: c.id });
      }
    }
    if (this.creatures.length < want) {
      const c = this.trySpawn(ctx);
      if (c) events.push({ kind: "spawn", id: c.id });
    }
    for (const c of this.creatures) this.step(c, dt, ctx, events);
    return events;
  }

  /** Fait apparaître une Grignote à cet endroit (tests, et plus tard missions) ; null si le sol ne s'y prête pas. */
  spawnAt(x: number, z: number): Creature | null {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const y = this.standY(ix, iz);
    if (y === null) return null;
    const c: Creature = {
      id: this.nextId++, x: ix + 0.5, y, z: iz + 0.5, yaw: 0, mode: "wander", fleeUntil: 0, fleeFrom: null,
      carried: null, color: this.creatures.length % 4, wanderYaw: 0, wanderUntil: 0, moving: false,
    };
    this.creatures.push(c);
    return c;
  }

  /**
   * Bulles lancées depuis origin dans la direction dir : les Grignotes dans le
   * cône fuient. Renvoie celles qui ont été touchées (le jeu rend les blocs chipés).
   */
  bubble(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }): Creature[] {
    const len = Math.hypot(dir.x, dir.z) || 1;
    const dx = dir.x / len;
    const dz = dir.z / len;
    const hit: Creature[] = [];
    for (const c of this.creatures) {
      const vx = c.x - origin.x;
      const vz = c.z - origin.z;
      const d = Math.hypot(vx, vz);
      if (d > BUBBLE_RANGE) continue;
      const angle = d < 0.5 ? 0 : Math.acos(Math.max(-1, Math.min(1, (vx * dx + vz * dz) / d)));
      if (angle > BUBBLE_HALF_ANGLE) continue;
      this.flee(c, origin);
      hit.push({ ...c });
      c.carried = null;
    }
    return hit;
  }

  private flee(c: Creature, from: { x: number; z: number }): void {
    c.mode = "flee";
    c.fleeFrom = { x: from.x, z: from.z };
    c.fleeUntil = this.now + FLEE_MS;
  }

  private trySpawn(ctx: SimContext): Creature | null {
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = this.rng() * Math.PI * 2;
      const r = SPAWN_MIN + this.rng() * (SPAWN_MAX - SPAWN_MIN);
      const x = Math.floor(ctx.player.x + Math.sin(a) * r);
      const z = Math.floor(ctx.player.z + Math.cos(a) * r);
      const y = this.standY(x, z);
      if (y === null) continue;
      if (this.nearLamp(x + 0.5, z + 0.5, ctx.lamps)) continue;
      const c: Creature = {
        id: this.nextId++,
        x: x + 0.5,
        y,
        z: z + 0.5,
        yaw: this.rng() * Math.PI * 2,
        mode: "wander",
        fleeUntil: 0,
        fleeFrom: null,
        carried: null,
        color: Math.floor(this.rng() * 4),
        wanderYaw: this.rng() * Math.PI * 2,
        wanderUntil: 0,
        moving: false,
      };
      this.creatures.push(c);
      return c;
    }
    return null;
  }

  private step(c: Creature, dt: number, ctx: SimContext, events: CreatureEvent[]): void {
    const p = ctx.player;
    const toPlayer = Math.hypot(p.x - c.x, p.z - c.z);
    const lamp = this.nearLamp(c.x, c.z, ctx.lamps);

    // Choix du mode.
    if (c.mode === "flee" && this.now >= c.fleeUntil) c.mode = "wander";
    if (lamp && c.mode !== "flee") {
      this.flee(c, lamp);
      events.push({ kind: "flee-lamp", id: c.id });
    }
    if (c.mode !== "flee") c.mode = ctx.night && c.carried === null ? "approach" : "wander";

    // Contact : vol d'un bloc, puis fuite en riant.
    if (c.mode === "approach" && toPlayer < CONTACT_DISTANCE && ctx.bagHasBlocks && this.now - this.lastStealAt >= STEAL_COOLDOWN_MS) {
      this.lastStealAt = this.now;
      events.push({ kind: "steal", id: c.id });
      this.flee(c, p);
    }

    // Direction voulue.
    let yaw: number;
    let speed: number;
    if (c.mode === "flee" && c.fleeFrom) {
      yaw = Math.atan2(-(c.x - c.fleeFrom.x), -(c.z - c.fleeFrom.z));
      speed = FLEE_SPEED;
    } else if (c.mode === "approach") {
      yaw = Math.atan2(-(p.x - c.x), -(p.z - c.z));
      speed = toPlayer < CONTACT_DISTANCE * 0.6 ? 0 : APPROACH_SPEED;
    } else {
      if (this.now >= c.wanderUntil) {
        c.wanderYaw = this.rng() * Math.PI * 2;
        c.wanderUntil = this.now + 2000 + this.rng() * 3000;
      }
      // Le jour, elles gardent leurs distances.
      yaw = toPlayer < DAY_DISTANCE && !ctx.night ? Math.atan2(-(c.x - p.x), -(c.z - p.z)) : c.wanderYaw;
      speed = WALK_SPEED;
    }
    c.yaw = yaw;
    c.moving = false;
    if (speed <= 0) return;
    const nx = c.x - Math.sin(yaw) * speed * dt;
    const nz = c.z - Math.cos(yaw) * speed * dt;
    if (!this.tryMove(c, nx, nz, ctx.lamps)) {
      // Obstacle : on essaie de le contourner, sinon nouveau cap.
      const side = yaw + (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      if (!this.tryMove(c, c.x - Math.sin(side) * speed * dt, c.z - Math.cos(side) * speed * dt, ctx.lamps)) {
        c.wanderYaw = this.rng() * Math.PI * 2;
        c.wanderUntil = this.now + 1500;
      }
    }
  }

  /** Déplace si la case d'arrivée est praticable : montée d'un bloc au plus, jamais sur une clôture ni dans l'eau, pas vers une lampe. */
  private tryMove(c: Creature, nx: number, nz: number, lamps: SimContext["lamps"]): boolean {
    const ix = Math.floor(nx);
    const iz = Math.floor(nz);
    if (ix === Math.floor(c.x) && iz === Math.floor(c.z)) {
      c.x = nx;
      c.z = nz;
      c.moving = true;
      return true;
    }
    if (!this.world.inBounds(ix, 0, iz)) return false;
    const ny = this.groundNear(ix, iz, Math.floor(c.y));
    if (ny === null || ny > Math.floor(c.y) + 1) return false;
    if (c.mode !== "flee" && this.nearLamp(nx, nz, lamps)) return false;
    c.x = nx;
    c.z = nz;
    c.y = ny;
    c.moving = true;
    return true;
  }

  /** Sol praticable dans la colonne (x, z), de y+1 à y−3 : bloc plein dessous (pas une clôture), air à hauteur, pas d'eau. */
  private groundNear(x: number, z: number, y: number): number | null {
    for (let yy = y + 1; yy >= Math.max(1, y - 3); yy--) {
      const below = this.world.get(x, yy - 1, z);
      const here = this.world.get(x, yy, z);
      if (!isSolidId(below) || below === BlockId.Fence) continue;
      if (isSolidId(here) || here === BlockId.Water) continue;
      return yy;
    }
    return null;
  }

  private standY(x: number, z: number): number | null {
    const y = this.world.findStandingY(x, z, 1);
    if (y === null) return null;
    // Le plus haut sol libre de la colonne (au-dessus des arbres éventuels : on repart du sommet).
    for (let yy = this.world.sizeY - 1; yy >= 1; yy--) {
      if (isSolidId(this.world.get(x, yy - 1, z))) {
        const below = this.world.get(x, yy - 1, z);
        if (below === BlockId.Leaves || below === BlockId.Fence || below === BlockId.Log) return null;
        return this.world.get(x, yy, z) === BlockId.Water ? null : yy;
      }
    }
    return y;
  }

  private nearLamp(x: number, z: number, lamps: SimContext["lamps"]): { x: number; z: number } | null {
    for (const l of lamps) if (Math.hypot(l.x - x, l.z - z) < LAMP_RADIUS) return l;
    return null;
  }
}
