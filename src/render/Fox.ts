import * as THREE from "three";
import { BoxKit } from "./boxModel";

/** Pixel, le renard compagnon (J5) : en blocs orange, ventre et bout de queue blancs, pattes noires. */
export class Fox {
  readonly group = new THREE.Group();
  private readonly kit = new BoxKit();
  private readonly legs: THREE.Object3D[] = [];
  private readonly tail: THREE.Object3D;
  private readonly head: THREE.Object3D;
  private phase = 0;

  constructor() {
    const orange = "#e8762c";
    const white = "#f4efe6";
    const dark = "#2a1d18";
    const k = this.kit;
    const body = new THREE.Group();
    body.position.y = 0.42;
    this.group.add(body);
    k.box(body, 0.36, 0.3, 0.7, orange, 0, 0, 0);
    k.box(body, 0.3, 0.08, 0.5, white, 0, -0.15, 0);
    // Tête vers −Z (le renard regarde comme le joueur quand yaw = 0).
    this.head = new THREE.Group();
    this.head.position.set(0, 0.12, -0.42);
    body.add(this.head);
    k.box(this.head, 0.34, 0.3, 0.3, orange, 0, 0, 0);
    k.box(this.head, 0.18, 0.12, 0.16, white, 0, -0.07, -0.2);
    k.box(this.head, 0.06, 0.06, 0.04, dark, 0, -0.03, -0.29);
    k.box(this.head, 0.05, 0.05, 0.02, dark, -0.09, 0.05, -0.155);
    k.box(this.head, 0.05, 0.05, 0.02, dark, 0.09, 0.05, -0.155);
    k.box(this.head, 0.09, 0.14, 0.06, orange, -0.11, 0.2, 0.02);
    k.box(this.head, 0.09, 0.14, 0.06, orange, 0.11, 0.2, 0.02);
    k.box(this.head, 0.05, 0.06, 0.02, dark, -0.11, 0.25, -0.01);
    k.box(this.head, 0.05, 0.06, 0.02, dark, 0.11, 0.25, -0.01);
    // Queue touffue, bout blanc.
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.08, 0.35);
    body.add(this.tail);
    k.box(this.tail, 0.18, 0.18, 0.4, orange, 0, 0.05, 0.2);
    k.box(this.tail, 0.19, 0.19, 0.12, white, 0, 0.05, 0.42);
    // Pattes.
    for (const [x, z] of [[-0.12, -0.25], [0.12, -0.25], [-0.12, 0.25], [0.12, 0.25]] as const) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.3, z);
      k.box(leg, 0.09, 0.3, 0.09, orange, 0, -0.12, 0);
      k.box(leg, 0.1, 0.08, 0.1, dark, 0, -0.26, 0);
      this.group.add(leg);
      this.legs.push(leg);
    }
    this.group.visible = false;
  }

  update(x: number, y: number, z: number, yaw: number, moving: boolean, dt: number): void {
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, yaw, 0);
    this.phase += dt * (moving ? 12 : 3);
    const swing = moving ? Math.sin(this.phase) * 0.6 : 0;
    this.legs.forEach((l, i) => (l.rotation.x = i % 3 === 0 ? swing : -swing));
    this.tail.rotation.y = Math.sin(this.phase * (moving ? 0.5 : 1)) * 0.35;
    this.head.rotation.x = moving ? 0 : Math.sin(this.phase * 0.5) * 0.08;
  }

  setBrightness(srgb: number): void {
    this.kit.setBrightness(srgb);
  }
}
