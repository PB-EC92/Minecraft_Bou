import * as THREE from "three";
import type { SkyState } from "../engine/dayNight";
import type { World } from "../engine/World";
import { ChunkRenderer } from "./ChunkRenderer";
import { verticalFovFor } from "./fov";
import { WATER_SURFACE } from "./mesher";
import { Sky } from "./Sky";
import { createAtlasTexture, drawAtlas } from "./textures";

export interface GpuInfo {
  webgl2: boolean;
  renderer: string;
  vendor: string;
  pixelRatio: number;
}

const WATER_FOG = new THREE.Color().setRGB(0.12, 0.3, 0.55, THREE.SRGBColorSpace);
/** Couleur de la mer au-delà du monde (sRGB), proche de l'eau vue de loin. */
const OCEAN_RGB: [number, number, number] = [0.29, 0.52, 0.81];
/** Étendue de la mer autour du monde (blocs) : bien au-delà du brouillard. */
const OCEAN_REACH = 1500;

/**
 * Mer au-delà des bords du monde : quatre grands rectangles au niveau de la
 * mer, autour du monde. Le monde reste borné (murs invisibles), mais il
 * paraît posé sur l'océan au lieu de s'arrêter sur le vide.
 */
function oceanGeometry(world: World): THREE.BufferGeometry | null {
  if (world.seaLevel <= 0) return null;
  const y = world.seaLevel - 1 + WATER_SURFACE - 0.02;
  const W = world.sizeX;
  const D = world.sizeZ;
  const R = OCEAN_REACH;
  const rects: [number, number, number, number][] = [
    [-R, -R, W + R, 0],
    [-R, D, W + R, D + R],
    [-R, 0, 0, D],
    [W, 0, W + R, D],
  ];
  const pos: number[] = [];
  const idx: number[] = [];
  rects.forEach(([x0, z0, x1, z1], i) => {
    pos.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0);
    const k = i * 4;
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Scène Three.js : caméra, ciel, brouillard, monde par sections,
 * surbrillance du bloc visé. Pas de lumière : l'ombrage vient des couleurs
 * de sommets, la luminosité jour/nuit de la couleur des matériaux.
 */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly atlasCanvas: HTMLCanvasElement;
  readonly chunks: ChunkRenderer;
  readonly sky = new Sky();
  readonly highlight: THREE.LineSegments;
  readonly gpu: GpuInfo;
  /** Contexte 3D perdu (Android en arrière-plan, pilote graphique) : on ne dessine plus jusqu'à sa restauration. */
  contextLost = false;
  contextLosses = 0;

  private readonly atlas: THREE.CanvasTexture;
  private readonly materials: { opaque: THREE.MeshBasicMaterial; cutout: THREE.MeshBasicMaterial; water: THREE.MeshBasicMaterial };
  private readonly fog: THREE.Fog;
  private readonly skyColor = new THREE.Color();
  private underwater = false;
  private readonly lostHandlers: ((lost: boolean) => void)[] = [];
  private readonly ocean: THREE.Mesh;
  private readonly oceanMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

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

    this.skyColor.setRGB(0.5, 0.72, 0.9, THREE.SRGBColorSpace);
    this.scene.background = this.skyColor;
    this.fog = new THREE.Fog(this.skyColor.clone(), 50, 96);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 400);

    this.atlasCanvas = drawAtlas();
    this.atlas = createAtlasTexture(this.atlasCanvas);
    this.materials = {
      opaque: new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true }),
      cutout: new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      water: new THREE.MeshBasicMaterial({
        map: this.atlas,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
    this.chunks = new ChunkRenderer(world, this.materials);
    this.scene.add(this.chunks.group);
    this.ocean = new THREE.Mesh(new THREE.BufferGeometry(), this.oceanMaterial);
    this.ocean.name = "mer";
    this.scene.add(this.ocean);
    this.setOcean(world);
    this.scene.add(this.sky.group);

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

    // Perte du contexte 3D (constat 11 de l'audit J0) : Three.js recrée ses
    // ressources à la restauration ; on suspend le rendu entre les deux.
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.contextLosses++;
      for (const h of this.lostHandlers) h(true);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.atlas.needsUpdate = true;
      for (const h of this.lostHandlers) h(false);
    });

    this.setRenderDistance(this.chunks.renderDistance);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  onContextChange(h: (lost: boolean) => void): void {
    this.lostHandlers.push(h);
  }

  setWorld(world: World): void {
    this.chunks.setWorld(world);
    this.setOcean(world);
  }

  private setOcean(world: World): void {
    const g = oceanGeometry(world);
    this.ocean.geometry.dispose();
    this.ocean.geometry = g ?? new THREE.BufferGeometry();
    this.ocean.visible = g !== null;
  }

  get renderDistance(): number {
    return this.chunks.renderDistance;
  }

  setRenderDistance(blocks: number): void {
    this.chunks.renderDistance = blocks;
    this.camera.far = Math.max(250, blocks * 1.6 + 40);
    this.camera.updateProjectionMatrix();
    this.applyFog();
  }

  /** Couleur du ciel, luminosité du monde, soleil et lune. */
  setSky(state: SkyState): void {
    this.skyColor.setRGB(state.sky[0], state.sky[1], state.sky[2], THREE.SRGBColorSpace);
    const b = state.brightness;
    for (const m of [this.materials.opaque, this.materials.cutout]) m.color.setRGB(b, b, b, THREE.SRGBColorSpace);
    this.materials.water.color.setRGB(b, b, b, THREE.SRGBColorSpace);
    this.oceanMaterial.color.setRGB(OCEAN_RGB[0] * b, OCEAN_RGB[1] * b, OCEAN_RGB[2] * b, THREE.SRGBColorSpace);
    this.sky.update(state, this.camera);
    this.applyFog();
  }

  /** Sous l'eau : brouillard bleu et court. */
  setUnderwater(on: boolean): void {
    this.underwater = on;
    this.applyFog();
  }

  private applyFog(): void {
    if (this.underwater) {
      this.fog.color.copy(WATER_FOG);
      this.fog.near = 0.5;
      this.fog.far = 14;
      this.scene.background = WATER_FOG;
    } else {
      this.fog.color.copy(this.skyColor);
      this.fog.far = this.chunks.renderDistance;
      this.fog.near = this.chunks.renderDistance * 0.55;
      this.scene.background = this.skyColor;
    }
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait : champ vertical élargi pour garder au moins 60° en largeur (J3, voir fov.ts).
    this.camera.fov = verticalFovFor(w / h);
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
    if (this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
  }
}
