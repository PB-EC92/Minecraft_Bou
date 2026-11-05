import * as THREE from "three";
import { LAMP_RADIUS } from "../engine/creatures";

/**
 * Halo des lampes (J5) : un disque lumineux additif autour de chaque lampe, qui
 * apparaît à la tombée du jour (le jeu n'a pas d'éclairage par bloc). Il montre
 * aussi à l'enfant la zone que les Grignotes évitent : J6, un second disque, large
 * et pâle, a le diamètre de cette zone (LAMP_RADIUS), le premier restant le cœur lumineux.
 */
export class LampGlow {
  readonly group = new THREE.Group();
  private readonly material: THREE.SpriteMaterial;
  private readonly zoneMaterial: THREE.SpriteMaterial;
  private sprites: THREE.Sprite[] = [];

  constructor() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,240,170,1)");
      grad.addColorStop(0.35, "rgba(255,210,110,0.55)");
      grad.addColorStop(1, "rgba(255,190,80,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    // Zone : lumière presque uniforme jusqu'au bord, qui s'éteint sur le dernier dixième.
    const z = document.createElement("canvas");
    z.width = z.height = 64;
    const zg = z.getContext("2d");
    if (zg) {
      const grad = zg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,220,120,0.5)");
      grad.addColorStop(0.75, "rgba(255,205,100,0.32)");
      grad.addColorStop(0.9, "rgba(255,195,90,0.18)");
      grad.addColorStop(1, "rgba(255,190,80,0)");
      zg.fillStyle = grad;
      zg.fillRect(0, 0, 64, 64);
    }
    const zoneTex = new THREE.CanvasTexture(z);
    zoneTex.colorSpace = THREE.SRGBColorSpace;
    this.zoneMaterial = new THREE.SpriteMaterial({ map: zoneTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  }

  setLamps(lamps: readonly { x: number; y: number; z: number }[]): void {
    for (const s of this.sprites) this.group.remove(s);
    this.sprites = lamps.flatMap((l) => {
      const zone = new THREE.Sprite(this.zoneMaterial);
      zone.position.set(l.x, l.y, l.z);
      zone.scale.setScalar(LAMP_RADIUS * 2);
      const core = new THREE.Sprite(this.material);
      core.position.set(l.x, l.y, l.z);
      core.scale.setScalar(4.5);
      this.group.add(zone, core);
      return [zone, core];
    });
  }

  /** daylight ∈ [0, 1] : halo invisible en plein jour, net la nuit. */
  setDaylight(daylight: number): void {
    const k = Math.max(0, Math.min(1, 1 - daylight * 1.4));
    this.material.opacity = k * 0.9;
    this.zoneMaterial.opacity = k * 0.55;
  }
}
