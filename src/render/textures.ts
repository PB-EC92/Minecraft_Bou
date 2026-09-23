import * as THREE from "three";
import { Tile } from "../engine/blocks";
import { createRng } from "../engine/random";

export const TILE_SIZE = 16;
export const TILE_COUNT = 8;

type Rgb = [number, number, number];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(c: Rgb): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

/**
 * Atlas de textures dessiné par code (pixel-art original, aucune image
 * externe). Une bande horizontale de TILE_COUNT tuiles de 16 × 16 px.
 * Le rendu est déterministe (graine fixe).
 */
export function drawAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * TILE_COUNT;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const rng = createRng(20260923);

  const px = (tile: number, x: number, y: number, color: Rgb) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(tile * TILE_SIZE + x, y, 1, 1);
  };

  const noiseFill = (tile: number, base: Rgb, dark: Rgb, amount: number) => {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        px(tile, x, y, mix(base, dark, rng() * amount));
      }
    }
  };

  const grass: Rgb = [98, 170, 64];
  const grassDark: Rgb = [62, 122, 40];
  const dirt: Rgb = [134, 96, 62];
  const dirtDark: Rgb = [92, 64, 40];
  const stone: Rgb = [138, 140, 144];
  const stoneDark: Rgb = [96, 98, 104];
  const plank: Rgb = [190, 150, 90];
  const plankDark: Rgb = [140, 105, 60];
  const sand: Rgb = [226, 210, 150];
  const sandDark: Rgb = [196, 178, 118];
  const bark: Rgb = [110, 82, 50];
  const barkDark: Rgb = [70, 50, 30];
  const wood: Rgb = [200, 165, 105];

  // Herbe (dessus)
  noiseFill(Tile.GrassTop, grass, grassDark, 0.7);
  // Terre
  noiseFill(Tile.Dirt, dirt, dirtDark, 0.7);
  // Herbe (côté) : terre + bande d'herbe en haut, bord irrégulier
  noiseFill(Tile.GrassSide, dirt, dirtDark, 0.7);
  for (let x = 0; x < TILE_SIZE; x++) {
    const depth = 3 + Math.floor(rng() * 3);
    for (let y = 0; y < depth; y++) px(Tile.GrassSide, x, y, mix(grass, grassDark, rng() * 0.7));
  }
  // Pierre : bruit + quelques fissures
  noiseFill(Tile.Stone, stone, stoneDark, 0.6);
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(rng() * TILE_SIZE);
    let y = Math.floor(rng() * TILE_SIZE);
    for (let k = 0; k < 5; k++) {
      px(Tile.Stone, x, y, stoneDark);
      x = (x + (rng() < 0.5 ? 1 : 0)) % TILE_SIZE;
      y = (y + 1) % TILE_SIZE;
    }
  }
  // Planches : 4 lattes horizontales séparées par une ligne sombre
  noiseFill(Tile.Planks, plank, plankDark, 0.35);
  for (let y = 0; y < TILE_SIZE; y += 4) {
    for (let x = 0; x < TILE_SIZE; x++) px(Tile.Planks, x, y, plankDark);
    const joint = Math.floor(rng() * TILE_SIZE);
    for (let k = 1; k < 4; k++) px(Tile.Planks, joint, y + k, plankDark);
  }
  // Sable
  noiseFill(Tile.Sand, sand, sandDark, 0.6);
  // Tronc (côté) : écorce à rayures verticales
  noiseFill(Tile.LogSide, bark, barkDark, 0.5);
  for (let x = 0; x < TILE_SIZE; x += 3) {
    for (let y = 0; y < TILE_SIZE; y++) if (rng() < 0.8) px(Tile.LogSide, x, y, barkDark);
  }
  // Tronc (dessus) : anneaux
  noiseFill(Tile.LogTop, wood, plankDark, 0.3);
  for (let r = 2; r < 8; r += 2) {
    for (let a = 0; a < 64; a++) {
      const x = Math.round(7.5 + Math.cos((a / 64) * Math.PI * 2) * r);
      const y = Math.round(7.5 + Math.sin((a / 64) * Math.PI * 2) * r);
      if (x >= 0 && x < TILE_SIZE && y >= 0 && y < TILE_SIZE) px(Tile.LogTop, x, y, plankDark);
    }
  }
  for (let y = 0; y < TILE_SIZE; y++) {
    px(Tile.LogTop, 0, y, bark);
    px(Tile.LogTop, TILE_SIZE - 1, y, bark);
    px(Tile.LogTop, y, 0, bark);
    px(Tile.LogTop, y, TILE_SIZE - 1, bark);
  }

  return canvas;
}

export function createAtlasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Coordonnées UV (u0, v0, u1, v1) d'une tuile, avec un léger retrait anti-débordement. */
export function tileUv(tile: number): [number, number, number, number] {
  const inset = 0.5 / (TILE_SIZE * TILE_COUNT);
  const insetV = 0.5 / TILE_SIZE;
  const u0 = tile / TILE_COUNT + inset;
  const u1 = (tile + 1) / TILE_COUNT - inset;
  return [u0, insetV, u1, 1 - insetV];
}

/** Copie une tuile de l'atlas dans un petit canvas (icônes de la barre d'inventaire). */
export function tileIcon(atlas: HTMLCanvasElement, tile: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, tile * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  return c;
}
