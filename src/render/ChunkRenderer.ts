import * as THREE from "three";
import { SECTION_SIZE, type World } from "../engine/World";
import { meshSection, type MeshData } from "./mesher";

export interface ChunkMaterials {
  opaque: THREE.Material;
  cutout: THREE.Material;
  water: THREE.Material;
  /**
   * Verre (V2 lot 1) : transparent, sans écriture de profondeur. Sert aussi à la couche glassWet (faces de verre au
   * contact de l'eau, dessinées avant l'eau quand la caméra est hors de l'eau) ; les autres faces de verre sont
   * dessinées après l'eau.
   */
  glass: THREE.Material;
}

type Layer = "opaque" | "cutout" | "glassWet" | "water" | "glass";
const LAYERS: Layer[] = ["opaque", "cutout", "glassWet", "water", "glass"];
/** Matériau de chaque couche : les faces de verre au contact de l'eau gardent le matériau du verre. */
const MATERIAL_OF: Record<Layer, keyof ChunkMaterials> = { opaque: "opaque", cutout: "cutout", glassWet: "glass", water: "water", glass: "glass" };
/**
 * Ordre de dessin des couches transparentes (Three.js trie d'abord par cet ordre, puis par distance), caméra hors de
 * l'eau : faces de verre au contact de l'eau (0,5), eau (1), autres faces de verre (2). Jamais le même ordre pour l'eau
 * et le verre : dans une même section, la distance est la même et l'ordre retomberait sur l'identifiant de l'objet.
 */
export const LAYER_RENDER_ORDER: Readonly<Record<Layer, number>> = { opaque: 0, cutout: 0, glassWet: 0.5, water: 1, glass: 2 };
/**
 * Caméra sous l'eau : les faces de verre au contact de l'eau sont vues de l'intérieur de l'eau (le voile sous l'eau
 * les teinte déjà) ; dessinées avant l'eau, elles passeraient sous la face d'eau collée à la vitre et l'intérieur d'un
 * aquarium deviendrait presque opaque. Elles retrouvent alors l'ordre du verre, après l'eau.
 */
export const WET_GLASS_ORDER_UNDERWATER = LAYER_RENDER_ORDER.glass;

interface Section {
  sx: number;
  sy: number;
  sz: number;
  /** Centre horizontal (pour la distance de rendu). */
  cx: number;
  cz: number;
  cy: number;
  /** Version du monde au dernier maillage (−1 = jamais maillé). */
  built: number;
  faces: number;
  meshes: Partial<Record<Layer, THREE.Mesh>>;
}

export interface ChunkStats {
  sections: number;
  pending: number;
  faces: number;
  visibleSections: number;
  /** Sections remaillées lors de la dernière mise à jour, et temps passé. */
  lastRemeshed: number;
  lastRemeshMs: number;
}

const HALF_DIAGONAL = Math.sqrt(3) * (SECTION_SIZE / 2);

/**
 * Rendu du monde par sections de 16³ : une section n'est remaillée que si
 * sa version a changé. Les sections en attente sont traitées de la plus
 * proche à la plus lointaine, dans un budget de temps par image (le monde
 * apparaît autour du joueur d'abord, sans figer l'écran). Au-delà de la
 * distance de rendu, les sections sont masquées.
 */
export class ChunkRenderer {
  readonly group = new THREE.Group();
  renderDistance = 96;
  readonly stats: ChunkStats = { sections: 0, pending: 0, faces: 0, visibleSections: 0, lastRemeshed: 0, lastRemeshMs: 0 };
  private sections: Section[] = [];
  private world: World;
  /** Ordre de dessin actuel des faces de verre au contact de l'eau (selon la caméra, voir setCameraUnderwater). */
  private wetGlassOrder = LAYER_RENDER_ORDER.glassWet;

  constructor(
    world: World,
    private readonly materials: ChunkMaterials,
  ) {
    this.world = world;
    this.group.name = "monde";
    this.init();
  }

  setWorld(world: World): void {
    this.clear();
    this.world = world;
    this.init();
  }

  /**
   * Caméra dans l'eau ou non (appelé à chaque image) : hors de l'eau, les faces de verre au contact de l'eau se voient
   * à travers l'eau et sont dessinées avant elle (verre noyé, vitre du fond d'un aquarium : teintés) ; sous l'eau,
   * elles sont dessinées après l'eau, comme le reste du verre.
   */
  setCameraUnderwater(on: boolean): void {
    const order = on ? WET_GLASS_ORDER_UNDERWATER : LAYER_RENDER_ORDER.glassWet;
    if (order === this.wetGlassOrder) return;
    this.wetGlassOrder = order;
    for (const s of this.sections) {
      const m = s.meshes.glassWet;
      if (m) m.renderOrder = order;
    }
  }

  private init(): void {
    const w = this.world;
    const S = SECTION_SIZE;
    this.sections = [];
    for (let sy = 0; sy < w.sectionsY; sy++) {
      for (let sz = 0; sz < w.sectionsZ; sz++) {
        for (let sx = 0; sx < w.sectionsX; sx++) {
          this.sections.push({ sx, sy, sz, cx: sx * S + S / 2, cy: sy * S + S / 2, cz: sz * S + S / 2, built: -1, faces: 0, meshes: {} });
        }
      }
    }
    this.stats.sections = this.sections.length;
    this.stats.pending = this.sections.length;
    this.stats.faces = 0;
  }

  /** Sections pas encore (re)maillées. */
  pendingCount(): number {
    let n = 0;
    for (const s of this.sections) if (s.built !== this.world.sectionVersion(s.sx, s.sy, s.sz)) n++;
    return n;
  }

  /** Nombre de sections en attente dans un rayon donné autour d'un point (écran de chargement). */
  pendingNear(x: number, z: number, radius: number): number {
    let n = 0;
    const r2 = (radius + HALF_DIAGONAL) ** 2;
    for (const s of this.sections) {
      if ((s.cx - x) ** 2 + (s.cz - z) ** 2 > r2) continue;
      if (s.built !== this.world.sectionVersion(s.sx, s.sy, s.sz)) n++;
    }
    return n;
  }

  /**
   * Remaille les sections modifiées, les plus proches d'abord, tant que le
   * budget (ms) n'est pas épuisé (au moins une par appel), puis met à jour
   * la visibilité. Retourne le nombre de sections remaillées.
   */
  update(camX: number, camY: number, camZ: number, budgetMs: number): number {
    const w = this.world;
    const dirty: { s: Section; d: number }[] = [];
    for (const s of this.sections) {
      if (s.built !== w.sectionVersion(s.sx, s.sy, s.sz)) dirty.push({ s, d: (s.cx - camX) ** 2 + (s.cy - camY) ** 2 * 0.25 + (s.cz - camZ) ** 2 });
    }
    let done = 0;
    const t0 = performance.now();
    if (dirty.length > 0) {
      dirty.sort((a, b) => a.d - b.d);
      for (const { s } of dirty) {
        this.rebuild(s);
        done++;
        if (performance.now() - t0 >= budgetMs) break;
      }
    }
    this.stats.lastRemeshed = done;
    this.stats.lastRemeshMs = performance.now() - t0;
    this.stats.pending = dirty.length - done;

    // Visibilité selon la distance horizontale (Three.js fait ensuite le tri par champ de vision).
    const r2 = (this.renderDistance + HALF_DIAGONAL) ** 2;
    let visible = 0;
    for (const s of this.sections) {
      const on = (s.cx - camX) ** 2 + (s.cz - camZ) ** 2 <= r2;
      let any = false;
      for (const l of LAYERS) {
        const m = s.meshes[l];
        if (m) {
          m.visible = on;
          any = true;
        }
      }
      if (on && any) visible++;
    }
    this.stats.visibleSections = visible;
    return done;
  }

  private rebuild(s: Section): void {
    const version = this.world.sectionVersion(s.sx, s.sy, s.sz);
    const mesh = meshSection(this.world, s.sx, s.sy, s.sz);
    this.stats.faces += mesh.faces - s.faces;
    s.faces = mesh.faces;
    for (const l of LAYERS) this.setLayer(s, l, mesh[l]);
    s.built = version;
  }

  private setLayer(s: Section, layer: Layer, data: MeshData | null): void {
    const old = s.meshes[layer];
    if (!data) {
      if (old) {
        old.geometry.dispose();
        this.group.remove(old);
        delete s.meshes[layer];
      }
      return;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3, true));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    const c = SECTION_SIZE / 2;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(c, c, c), HALF_DIAGONAL + 0.5);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(SECTION_SIZE, SECTION_SIZE, SECTION_SIZE));
    if (old) {
      old.geometry.dispose();
      old.geometry = geo;
      return;
    }
    const m = new THREE.Mesh(geo, this.materials[MATERIAL_OF[layer]]);
    m.position.set(s.sx * SECTION_SIZE, s.sy * SECTION_SIZE, s.sz * SECTION_SIZE);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    m.name = `${layer} ${s.sx},${s.sy},${s.sz}`;
    // Couches transparentes, caméra hors de l'eau : les faces de verre au contact de l'eau (on ne les voit qu'à
    // travers l'eau : verre noyé, vitre du fond d'un aquarium), puis l'eau, puis les autres faces de verre (on voit
    // l'eau d'un aquarium derrière sa vitre) ; caméra sous l'eau, tout le verre après l'eau (setCameraUnderwater).
    // Three.js trie la liste transparente par renderOrder, puis par distance au centre de la sphère de la section
    // (fixée plus haut) : dans une couche, les sections vont de la plus lointaine à la plus proche. À l'intérieur
    // d'une section, pas de tri par face : l'ordre du maillage est fixe, rien ne clignote (défaut accepté, voir
    // docs/V2-LOT1.md).
    m.renderOrder = layer === "glassWet" ? this.wetGlassOrder : LAYER_RENDER_ORDER[layer];
    s.meshes[layer] = m;
    this.group.add(m);
  }

  private clear(): void {
    for (const s of this.sections) {
      for (const l of LAYERS) {
        const m = s.meshes[l];
        if (m) {
          m.geometry.dispose();
          this.group.remove(m);
        }
      }
    }
    this.sections = [];
  }

  dispose(): void {
    this.clear();
  }
}
