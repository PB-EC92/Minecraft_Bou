import * as THREE from "three";

/**
 * Halo des lampes (J5) : un disque lumineux additif autour de chaque lampe, qui
 * apparaît à la tombée du jour (le jeu n'a pas d'éclairage par bloc). Il montre
 * aussi à l'enfant la zone que les Grignotes évitent.
 */
export class LampGlow {
  readonly group = new THREE.Group();
  private readonly material: THREE.SpriteMaterial;
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
  }

  setLamps(lamps: readonly { x: number; y: number; z: number }[]): void {
    for (const s of this.sprites) this.group.remove(s);
    this.sprites = lamps.map((l) => {
      const s = new THREE.Sprite(this.material);
      s.position.set(l.x, l.y, l.z);
      s.scale.setScalar(4.5);
      this.group.add(s);
      return s;
    });
  }

  /** daylight ∈ [0, 1] : halo invisible en plein jour, net la nuit. */
  setDaylight(daylight: number): void {
    this.material.opacity = Math.max(0, Math.min(1, 1 - daylight * 1.4)) * 0.9;
  }
}
