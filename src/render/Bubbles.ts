import * as THREE from "three";

interface Bubble {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
}

/** Bulles du lance-bulles (J5) : sphères translucides qui filent devant le joueur, montent un peu et s'effacent. */
export class Bubbles {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.SphereGeometry(1, 12, 8);
  private readonly list: Bubble[] = [];

  burst(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }): void {
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.5 + Math.random() * 0.3, 0.7, 0.8), transparent: true, opacity: 0.55, depthWrite: false });
      const mesh = new THREE.Mesh(this.geometry, mat);
      const r = 0.08 + Math.random() * 0.14;
      mesh.scale.setScalar(r);
      mesh.position.set(origin.x + dir.x * 0.6, origin.y - 0.2 + dir.y * 0.6, origin.z + dir.z * 0.6);
      const speed = 5 + Math.random() * 4;
      const spread = 0.35;
      this.list.push({
        mesh,
        vx: (dir.x + (Math.random() - 0.5) * spread) * speed,
        vy: (dir.y + (Math.random() - 0.3) * spread) * speed * 0.6,
        vz: (dir.z + (Math.random() - 0.5) * spread) * speed,
        age: 0,
        life: 1 + Math.random() * 0.6,
      });
      this.group.add(mesh);
    }
  }

  get count(): number {
    return this.list.length;
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]!;
      b.age += dt;
      b.vx *= 1 - dt * 1.5;
      b.vz *= 1 - dt * 1.5;
      b.vy += dt * 0.8;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.max(0, 1 - b.age / b.life);
      if (b.age >= b.life) {
        this.group.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.list.splice(i, 1);
      }
    }
  }
}
