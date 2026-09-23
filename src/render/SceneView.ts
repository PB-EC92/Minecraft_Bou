import * as THREE from "three";
import type { World } from "../engine/World";
import { WorldMesh } from "./WorldMesh";
import { createAtlasTexture, drawAtlas } from "./textures";

export interface GpuInfo {
  webgl2: boolean;
  renderer: string;
  vendor: string;
  pixelRatio: number;
}

/**
 * Scène Three.js : caméra, ciel, brouillard, maillage du monde, surbrillance
 * du bloc visé. Pas de lumière : l'ombrage vient des couleurs de sommets.
 */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly atlasCanvas: HTMLCanvasElement;
  readonly worldMesh: WorldMesh;
  readonly highlight: THREE.LineSegments;
  readonly gpu: GpuInfo;

  constructor(
    readonly canvas: HTMLCanvasElement,
    world: World,
    isTouch: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const sky = new THREE.Color(0x7fb7e6);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 40, 90);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);

    this.atlasCanvas = drawAtlas();
    const material = new THREE.MeshBasicMaterial({
      map: createAtlasTexture(this.atlasCanvas),
      vertexColors: true,
    });
    this.worldMesh = new WorldMesh(world, material);
    this.scene.add(this.worldMesh.mesh);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    const gl = this.renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    this.gpu = {
      webgl2: this.renderer.capabilities.isWebGL2,
      renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      vendor: dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
      pixelRatio,
    };

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setHighlight(x: number, y: number, z: number): void {
    this.highlight.visible = true;
    this.highlight.position.set(x + 0.5, y + 0.5, z + 0.5);
  }

  hideHighlight(): void {
    this.highlight.visible = false;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
