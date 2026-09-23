import * as THREE from "three";
import type { SkyState } from "../engine/dayNight";
import { createRng } from "../engine/random";

/** Distance à laquelle soleil, lune et étoiles sont dessinés (au-delà du monde, en deçà du plan lointain). */
const SKY_DISTANCE = 170;

function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soleil rond à rayons courts (dessin original). */
function sunTexture(): THREE.CanvasTexture {
  return makeCanvas(64, (ctx, s) => {
    const c = s / 2;
    const glow = ctx.createRadialGradient(c, c, 4, c, c, c);
    glow.addColorStop(0, "rgba(255,244,190,1)");
    glow.addColorStop(0.45, "rgba(255,214,90,0.95)");
    glow.addColorStop(0.62, "rgba(255,190,60,0.35)");
    glow.addColorStop(1, "rgba(255,190,60,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,220,110,0.9)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 19, c + Math.sin(a) * 19);
      ctx.lineTo(c + Math.cos(a) * 28, c + Math.sin(a) * 28);
      ctx.stroke();
    }
  });
}

/** Croissant de lune pâle. */
function moonTexture(): THREE.CanvasTexture {
  return makeCanvas(64, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = "rgba(236,240,255,1)";
    ctx.beginPath();
    ctx.arc(c, c, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(c + 10, c - 6, 18, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Ciel : couleur de fond et de brouillard, soleil, lune et étoiles qui
 * suivent la caméra (ils paraissent donc infiniment loin).
 */
export class Sky {
  readonly group = new THREE.Group();
  private readonly sun: THREE.Mesh;
  private readonly moon: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly starMaterial: THREE.PointsMaterial;
  private readonly tmp = new THREE.Vector3();

  constructor() {
    const quad = new THREE.PlaneGeometry(1, 1);
    const mat = (map: THREE.Texture) =>
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.sun = new THREE.Mesh(quad, mat(sunTexture()));
    this.sun.scale.setScalar(34);
    this.moon = new THREE.Mesh(quad, mat(moonTexture()));
    this.moon.scale.setScalar(22);

    const rng = createRng(1717);
    const pts: number[] = [];
    for (let i = 0; i < 420; i++) {
      // Directions au hasard sur la sphère, plutôt en hauteur
      const u = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.9 + 0.1;
      pts.push(Math.cos(a) * r * SKY_DISTANCE, y * SKY_DISTANCE, Math.sin(a) * r * SKY_DISTANCE);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false });
    this.stars = new THREE.Points(g, this.starMaterial);
    this.stars.frustumCulled = false;

    for (const o of [this.sun, this.moon, this.stars]) o.renderOrder = -1;
    this.group.add(this.stars, this.sun, this.moon);
  }

  update(state: SkyState, camera: THREE.Camera): void {
    const cam = camera.position;
    this.group.position.copy(cam);
    const a = state.t * Math.PI * 2;
    // Le soleil se lève à l'est (+X), passe au sud du zénith, se couche à l'ouest.
    this.tmp.set(Math.cos(a), Math.sin(a), 0.3).normalize().multiplyScalar(SKY_DISTANCE);
    this.sun.position.copy(this.tmp);
    this.sun.lookAt(cam);
    this.sun.visible = state.sunHeight > -0.25;
    this.moon.position.copy(this.tmp).multiplyScalar(-1);
    this.moon.lookAt(cam);
    this.moon.visible = state.sunHeight < 0.25;
    const starOpacity = Math.max(0, 1 - state.daylight * 1.6) * 0.9;
    this.starMaterial.opacity = starOpacity;
    this.stars.visible = starOpacity > 0.02;
  }
}
