import * as THREE from "three";
import type { AvatarDef } from "../game/avatars";

/**
 * Personnage en blocs visible à la troisième personne (J4). Proportions d'un
 * joueur de 1,8 bloc ; les pieds sont à l'origine du groupe. Pas de lumière
 * Three.js dans le jeu : les faces sont assombries à la main (dessus clair,
 * côtés plus sombres) pour garder du relief.
 */
export class Avatar {
  readonly group = new THREE.Group();
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private readonly leftArm: THREE.Object3D;
  private readonly rightArm: THREE.Object3D;
  private readonly leftLeg: THREE.Object3D;
  private readonly rightLeg: THREE.Object3D;
  private readonly head: THREE.Object3D;
  private walk = 0;

  constructor(def: AvatarDef) {
    const skin = def.skin;
    // Jambes (pivot aux hanches, à 0,75).
    this.leftLeg = this.limb(0.24, 0.75, 0.26, def.pants, def.shoes, -0.13, 0.75);
    this.rightLeg = this.limb(0.24, 0.75, 0.26, def.pants, def.shoes, 0.13, 0.75);
    // Corps.
    this.group.add(this.box(0.5, 0.62, 0.28, def.shirt, 0, 0.75 + 0.31, 0));
    // Bras (pivot aux épaules, à 1,33).
    this.leftArm = this.limb(0.2, 0.62, 0.22, def.shirt, skin, -0.36, 1.35);
    this.rightArm = this.limb(0.2, 0.62, 0.22, def.shirt, skin, 0.36, 1.35);
    // Tête (pivot au cou), cheveux, yeux, chapeau.
    this.head = new THREE.Group();
    this.head.position.set(0, 1.37, 0);
    this.head.add(this.box(0.42, 0.42, 0.42, skin, 0, 0.21, 0));
    this.head.add(this.box(0.44, 0.1, 0.44, def.hair, 0, 0.4, 0));
    this.head.add(this.box(0.44, 0.3, 0.08, def.hair, 0, 0.27, 0.19));
    // Yeux sur la face avant (-Z : le personnage regarde comme la caméra).
    this.head.add(this.box(0.07, 0.07, 0.02, "#1c1c28", -0.09, 0.24, -0.215));
    this.head.add(this.box(0.07, 0.07, 0.02, "#1c1c28", 0.09, 0.24, -0.215));
    if (def.hat) {
      this.head.add(this.box(0.48, 0.1, 0.48, def.hat, 0, 0.46, 0));
      this.head.add(this.box(0.48, 0.04, 0.2, def.hat, 0, 0.42, -0.3));
    }
    this.group.add(this.head);
    this.group.visible = false;
  }

  /** Place le personnage (pieds en x, y, z), tourné selon le regard, et anime la marche selon la vitesse horizontale. */
  update(x: number, y: number, z: number, yaw: number, pitch: number, speed: number, dt: number): void {
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, yaw, 0);
    this.head.rotation.set(Math.max(-0.8, Math.min(0.8, pitch)), 0, 0);
    const moving = speed > 0.3;
    this.walk = moving ? this.walk + dt * Math.min(speed, 6) * 2.2 : this.walk * Math.max(0, 1 - dt * 8);
    const swing = Math.sin(this.walk) * (moving ? 0.7 : Math.min(0.7, Math.abs(Math.sin(this.walk))));
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.8;
    this.rightArm.rotation.x = swing * 0.8;
  }

  /** Luminosité du jour et de la nuit, en sRGB comme pour les blocs (voir SceneView.setSky). */
  setBrightness(srgb: number): void {
    const k = new THREE.Color().setRGB(srgb, srgb, srgb, THREE.SRGBColorSpace).r;
    for (const m of this.materials) {
      const base = m.userData.base as THREE.Color;
      m.color.copy(base).multiplyScalar(k);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }

  /** Membre qui pivote à son sommet (hanche, épaule) : partie haute d'une couleur, bout d'une autre. */
  private limb(w: number, h: number, d: number, top: string, end: string, x: number, pivotY: number): THREE.Object3D {
    const g = new THREE.Group();
    g.position.set(x, pivotY, 0);
    const endH = h * 0.22;
    g.add(this.box(w, h - endH, d, top, 0, -(h - endH) / 2, 0));
    g.add(this.box(w * 1.02, endH, d * 1.02, end, 0, -h + endH / 2, 0));
    this.group.add(g);
    return g;
  }

  private box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
    const c = new THREE.Color(color);
    // Relief sans lumière : dessus 100 %, faces avant/arrière 85 %, côtés 72 %, dessous 60 %.
    const shades = [0.72, 0.72, 1, 0.6, 0.85, 0.85];
    const mats = shades.map((k) => {
      const m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(k) });
      m.userData.base = m.color.clone();
      this.materials.push(m);
      return m;
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(x, y, z);
    return mesh;
  }
}
