import * as THREE from "three";

/**
 * Petits modèles en blocs (J5) : boîtes colorées, relief sans lumière (faces
 * assombries à la main, comme l'avatar), luminosité du jour et de la nuit.
 */
export class BoxKit {
  private readonly materials: THREE.MeshBasicMaterial[] = [];

  box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
    const c = new THREE.Color(color);
    const shades = [0.72, 0.72, 1, 0.6, 0.85, 0.85];
    const mats = shades.map((k) => {
      const m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(k) });
      m.userData.base = m.color.clone();
      this.materials.push(m);
      return m;
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /** Luminosité en sRGB, comme les blocs (SceneView.setSky). */
  setBrightness(srgb: number): void {
    const k = new THREE.Color().setRGB(srgb, srgb, srgb, THREE.SRGBColorSpace).r;
    for (const m of this.materials) m.color.copy(m.userData.base as THREE.Color).multiplyScalar(k);
  }

  dispose(root: THREE.Object3D): void {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
