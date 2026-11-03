import * as THREE from "three";
import type { BlockId } from "../engine/blocks";
import { ghostCubes, srgbToLinear, type MeshData } from "./mesher";

/** Une case claire : position du bloc (coin bas) et lettre attendue. */
export interface GhostCell {
  x: number;
  y: number;
  z: number;
  id: BlockId;
}

/** Case d'un contour (lecture seule : reçoit directement les cases `Cell` de `words.ts`). */
export type MarkCell = readonly [number, number, number];

/** Au plus 10 cubes et 10 contours (le plus long mot de la mission 2 en compte moins). */
export const MAX_GHOSTS = 10;
export const MAX_MARKS = 10;
/** Opacité des cases claires. */
export const GHOST_OPACITY = 0.42;
/** Case suivante : l'opacité oscille entre ces bornes, à NEXT_PULSE_HZ ; fixe à NEXT_STILL_OPACITY si les animations sont réduites. */
export const NEXT_OPACITY_MIN = 0.35;
export const NEXT_OPACITY_MAX = 0.75;
export const NEXT_PULSE_HZ = 1.2;
export const NEXT_STILL_OPACITY = 0.6;
/** Durée du contour vert d'un mot réussi (secondes). */
export const DONE_SECONDS = 1.2;

const NEXT_COLOR = 0xffd23f;
const WRONG_COLOR = 0xff8a3c;
const DONE_COLOR = 0x5cbe5c;
/** Contours un peu plus grands que le bloc, pour ne pas se confondre avec ses arêtes. */
const OUTLINE_SIZE = 1.02;
/** Dessinés après les couches transparentes du monde (eau 1, verre 2) : le guide reste net. */
const GHOST_RENDER_ORDER = 3;

const cellKey = (c: readonly number[]) => c.join(",");

function toGeometry(data: MeshData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
  geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3, true));
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Fantômes des lettres (V2 lot 1, mission 2) : les « cases claires » où poser
 * les lettres d'un mot. Ce ne sont jamais des blocs du monde : rien n'est écrit
 * dans World, la visée (raycast sur le monde) les ignore et le joueur les
 * traverse.
 * - Cases claires : cubes translucides portant la lettre attendue (même tuile
 *   et même orientation que le bloc posé).
 * - Case suivante : un second maillage qui « respire » (opacité de 0,35 à 0,75
 *   à 1,2 Hz, fixe si les animations sont réduites), entouré de jaune.
 * - Contours : orange sur les lettres à revoir, vert sur un mot réussi pendant
 *   1,2 s.
 * Les géométries ne sont reconstruites que si le contenu change (le jeu peut
 * rappeler setGhosts et setMarks à chaque image). Pas de lumière : la
 * luminosité du jour et de la nuit passe par la couleur des matériaux.
 */
export class LetterGhosts {
  readonly group = new THREE.Group();
  private readonly material: THREE.MeshBasicMaterial;
  private readonly nextMaterial: THREE.MeshBasicMaterial;
  private readonly ghostMesh: THREE.Mesh;
  private readonly nextMesh: THREE.Mesh;
  private readonly outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(OUTLINE_SIZE, OUTLINE_SIZE, OUTLINE_SIZE));
  private readonly nextLineMaterial = new THREE.LineBasicMaterial({ color: NEXT_COLOR });
  private readonly wrongLineMaterial = new THREE.LineBasicMaterial({ color: WRONG_COLOR });
  private readonly doneLineMaterial = new THREE.LineBasicMaterial({ color: DONE_COLOR });
  private readonly nextOutline: THREE.LineSegments;
  /** Contours des lettres à revoir et du mot réussi (réserve fixe, au plus MAX_MARKS). */
  private readonly marks: THREE.LineSegments[] = [];
  private ghostKey = "";
  private nextKey = "";
  private wrongKey = "";
  private doneKey = "";
  private doneCells: MarkCell[] = [];
  private wrongCells: MarkCell[] = [];
  /** Temps restant du contour vert (secondes). */
  private doneLeft = 0;
  private time = 0;
  private brightness = 1;

  constructor(atlas: THREE.Texture) {
    this.group.name = "fantômes";
    const opts = { map: atlas, vertexColors: true, transparent: true, depthWrite: false };
    this.material = new THREE.MeshBasicMaterial({ ...opts, opacity: GHOST_OPACITY });
    this.nextMaterial = new THREE.MeshBasicMaterial({ ...opts, opacity: NEXT_STILL_OPACITY });
    this.ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.ghostMesh.name = "cases claires";
    this.nextMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.nextMaterial);
    this.nextMesh.name = "case suivante";
    for (const m of [this.ghostMesh, this.nextMesh]) {
      m.renderOrder = GHOST_RENDER_ORDER;
      m.visible = false;
    }
    this.nextOutline = new THREE.LineSegments(this.outlineGeometry, this.nextLineMaterial);
    this.nextOutline.name = "contour suivant";
    this.nextOutline.visible = false;
    for (let i = 0; i < MAX_MARKS; i++) {
      const l = new THREE.LineSegments(this.outlineGeometry, this.wrongLineMaterial);
      l.name = `contour ${i}`;
      l.visible = false;
      this.marks.push(l);
    }
    this.group.add(this.ghostMesh, this.nextMesh, this.nextOutline, ...this.marks);
  }

  /**
   * Cases claires (au plus MAX_GHOSTS) et case suivante (ou null). La case
   * suivante n'est pas dessinée deux fois si elle figure aussi dans cells.
   * Liste vide et null : plus rien d'affiché.
   */
  setGhosts(cells: readonly GhostCell[], next: GhostCell | null): void {
    const nextAt = next ? cellKey([next.x, next.y, next.z]) : null;
    const rest = cells.filter((c) => cellKey([c.x, c.y, c.z]) !== nextAt).slice(0, MAX_GHOSTS - (next ? 1 : 0));
    const key = rest.map((c) => cellKey([c.x, c.y, c.z, c.id])).join(";");
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      this.replace(this.ghostMesh, rest);
    }
    const nk = next ? cellKey([next.x, next.y, next.z, next.id]) : "";
    if (nk !== this.nextKey) {
      this.nextKey = nk;
      this.replace(this.nextMesh, next ? [next] : []);
      this.nextOutline.visible = next !== null;
      if (next) this.nextOutline.position.set(next.x + 0.5, next.y + 0.5, next.z + 0.5);
    }
  }

  /**
   * Contours : lettres à revoir (orange, tant qu'elles sont données) et mot
   * réussi (vert, pendant DONE_SECONDS à partir du premier appel qui le
   * donne ; le rappeler avec les mêmes cases ne relance pas le délai).
   */
  setMarks(m: { wrong: readonly MarkCell[]; done: readonly MarkCell[] }): void {
    const wk = m.wrong.map(cellKey).join(";");
    const dk = m.done.map(cellKey).join(";");
    if (wk === this.wrongKey && dk === this.doneKey) return;
    if (dk !== this.doneKey) {
      this.doneKey = dk;
      this.doneCells = m.done.slice(0, MAX_MARKS).map((c) => [c[0], c[1], c[2]]);
      this.doneLeft = this.doneCells.length > 0 ? DONE_SECONDS : 0;
    }
    this.wrongKey = wk;
    this.wrongCells = m.wrong.slice(0, MAX_MARKS).map((c) => [c[0], c[1], c[2]]);
    this.layoutMarks();
  }

  /** Luminosité du monde (jour et nuit), appliquée à la couleur des matériaux comme pour les blocs. */
  setBrightness(b: number): void {
    this.brightness = b;
    for (const mat of [this.material, this.nextMaterial]) mat.color.setRGB(b, b, b, THREE.SRGBColorSpace);
    // Même facteur que les blocs (gris b perçu, appliqué en linéaire) pour les contours colorés.
    const k = srgbToLinear(Math.min(1, Math.max(0, b)));
    const lines: [THREE.LineBasicMaterial, number][] = [
      [this.nextLineMaterial, NEXT_COLOR],
      [this.wrongLineMaterial, WRONG_COLOR],
      [this.doneLineMaterial, DONE_COLOR],
    ];
    for (const [mat, hex] of lines) mat.color.setHex(hex).multiplyScalar(k);
  }

  /** Animation : respiration de la case suivante, fin du contour vert. */
  update(dtSeconds: number, reducedMotion: boolean): void {
    const dt = Math.max(0, dtSeconds);
    this.time += dt;
    const mid = (NEXT_OPACITY_MIN + NEXT_OPACITY_MAX) / 2;
    const amp = (NEXT_OPACITY_MAX - NEXT_OPACITY_MIN) / 2;
    this.nextMaterial.opacity = reducedMotion ? NEXT_STILL_OPACITY : mid + amp * Math.sin(2 * Math.PI * NEXT_PULSE_HZ * this.time);
    if (this.doneLeft > 0) {
      this.doneLeft = Math.max(0, this.doneLeft - dt);
      if (this.doneLeft === 0) this.layoutMarks();
    }
  }

  /** Pour les tests et l'accès de débogage : ce qui est affiché. */
  get shown(): { ghosts: number; next: boolean; wrong: number; done: number; brightness: number } {
    const doneShown = this.doneLeft > 0 ? this.doneCells.length : 0;
    return {
      ghosts: this.ghostMesh.visible ? this.faces(this.ghostMesh) / 6 : 0,
      next: this.nextMesh.visible,
      wrong: Math.min(this.wrongCells.length, MAX_MARKS - doneShown),
      done: doneShown,
      brightness: this.brightness,
    };
  }

  dispose(): void {
    this.ghostMesh.geometry.dispose();
    this.nextMesh.geometry.dispose();
    this.outlineGeometry.dispose();
    for (const m of [this.material, this.nextMaterial, this.nextLineMaterial, this.wrongLineMaterial, this.doneLineMaterial]) m.dispose();
    this.group.clear();
    this.ghostKey = this.nextKey = this.wrongKey = this.doneKey = "";
    this.doneCells = [];
    this.wrongCells = [];
    this.doneLeft = 0;
  }

  private faces(mesh: THREE.Mesh): number {
    const idx = mesh.geometry.getIndex();
    return idx ? idx.count / 6 : 0;
  }

  private replace(mesh: THREE.Mesh, cells: readonly GhostCell[]): void {
    mesh.geometry.dispose();
    const data = ghostCubes(cells);
    mesh.geometry = data.faces > 0 ? toGeometry(data) : new THREE.BufferGeometry();
    mesh.visible = data.faces > 0;
  }

  /** Place les contours : d'abord le mot réussi (s'il est encore affiché), puis les lettres à revoir. */
  private layoutMarks(): void {
    const list: [MarkCell, THREE.LineBasicMaterial][] = [];
    if (this.doneLeft > 0) for (const c of this.doneCells) list.push([c, this.doneLineMaterial]);
    for (const c of this.wrongCells) list.push([c, this.wrongLineMaterial]);
    this.marks.forEach((line, i) => {
      const item = list[i];
      line.visible = item !== undefined;
      if (!item) return;
      const [c, mat] = item;
      line.material = mat;
      line.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
    });
  }
}
