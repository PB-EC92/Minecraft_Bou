import * as THREE from "three";
import type { Creature } from "../engine/creatures";
import { BoxKit } from "./boxModel";

const COLORS = ["#b98ce6", "#7cc6e8", "#f29ab8", "#9ad97a"];

/** Une Grignote : boule à poils (cube arrondi par des touffes), grands yeux, petits pieds, bonds. */
class Grignote {
  readonly group = new THREE.Group();
  readonly kit = new BoxKit();
  private readonly body: THREE.Object3D;
  private phase = Math.random() * 10;

  constructor(color: string) {
    const k = this.kit;
    this.body = new THREE.Group();
    this.group.add(this.body);
    k.box(this.body, 0.56, 0.5, 0.56, color, 0, 0.35, 0);
    // Touffes de poils.
    k.box(this.body, 0.2, 0.14, 0.2, color, 0, 0.66, 0);
    k.box(this.body, 0.12, 0.12, 0.12, color, 0.12, 0.7, 0.05);
    // Grands yeux (face avant −Z) avec pupilles et reflet.
    for (const sx of [-0.13, 0.13]) {
      k.box(this.body, 0.18, 0.2, 0.03, "#ffffff", sx, 0.42, -0.29);
      k.box(this.body, 0.09, 0.11, 0.02, "#1c1c28", sx, 0.4, -0.305);
      k.box(this.body, 0.04, 0.04, 0.01, "#ffffff", sx + 0.02, 0.44, -0.316);
    }
    k.box(this.body, 0.12, 0.04, 0.02, "#6a3040", 0, 0.24, -0.29);
    for (const sx of [-0.15, 0.15]) k.box(this.group, 0.14, 0.1, 0.18, "#5a4a60", sx, 0.05, -0.04);
  }

  update(c: Creature, dt: number): void {
    this.group.position.set(c.x, c.y, c.z);
    this.group.rotation.set(0, c.yaw, 0);
    this.phase += dt * (c.mode === "flee" ? 18 : c.moving ? 11 : 3);
    const hop = c.moving ? Math.abs(Math.sin(this.phase)) * 0.22 : Math.abs(Math.sin(this.phase)) * 0.03;
    this.body.position.y = hop;
    this.body.scale.set(1, c.moving ? 1 - hop * 0.3 : 1, 1);
  }
}

/** Rendu des Grignotes : un modèle par créature de la simulation, créé et retiré au fil des apparitions. */
export class Critters {
  readonly group = new THREE.Group();
  private readonly models = new Map<number, Grignote>();

  sync(creatures: readonly Creature[], dt: number, brightness: number): void {
    const alive = new Set<number>();
    for (const c of creatures) {
      alive.add(c.id);
      let m = this.models.get(c.id);
      if (!m) {
        m = new Grignote(COLORS[c.color % COLORS.length]!);
        this.models.set(c.id, m);
        this.group.add(m.group);
      }
      m.update(c, dt);
      m.kit.setBrightness(Math.max(brightness, 0.75)); // un peu visibles la nuit : on doit les voir venir
    }
    for (const [id, m] of this.models) {
      if (alive.has(id)) continue;
      this.group.remove(m.group);
      m.kit.dispose(m.group);
      this.models.delete(id);
    }
  }
}
