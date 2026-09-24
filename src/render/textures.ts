import * as THREE from "three";
import { Tile } from "../engine/blocks";
import { createRng } from "../engine/random";
import { ATLAS_HEIGHT, ATLAS_WIDTH, TILE_SIZE, tileOrigin } from "./atlas";

type Rgb = [number, number, number];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(c: Rgb): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

/**
 * Atlas de textures dessiné par code (pixel-art original, aucune image
 * externe) : grille de tuiles de 16 × 16 px (voir atlas.ts). Le rendu est
 * déterministe (graine fixe). Les tuiles de fleurs ont un fond transparent.
 */
export function drawAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_WIDTH;
  canvas.height = ATLAS_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const rng = createRng(20260923);
  const S = TILE_SIZE;

  const px = (tile: number, x: number, y: number, color: Rgb) => {
    const [ox, oy] = tileOrigin(tile);
    ctx.fillStyle = css(color);
    ctx.fillRect(ox + x, oy + y, 1, 1);
  };

  const noiseFill = (tile: number, base: Rgb, dark: Rgb, amount: number) => {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
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
  for (let x = 0; x < S; x++) {
    const depth = 3 + Math.floor(rng() * 3);
    for (let y = 0; y < depth; y++) px(Tile.GrassSide, x, y, mix(grass, grassDark, rng() * 0.7));
  }
  // Pierre : bruit + quelques fissures
  noiseFill(Tile.Stone, stone, stoneDark, 0.6);
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(rng() * S);
    let y = Math.floor(rng() * S);
    for (let k = 0; k < 5; k++) {
      px(Tile.Stone, x, y, stoneDark);
      x = (x + (rng() < 0.5 ? 1 : 0)) % S;
      y = (y + 1) % S;
    }
  }
  // Planches : 4 lattes horizontales séparées par une ligne sombre
  noiseFill(Tile.Planks, plank, plankDark, 0.35);
  for (let y = 0; y < S; y += 4) {
    for (let x = 0; x < S; x++) px(Tile.Planks, x, y, plankDark);
    const joint = Math.floor(rng() * S);
    for (let k = 1; k < 4; k++) px(Tile.Planks, joint, y + k, plankDark);
  }
  // Sable
  noiseFill(Tile.Sand, sand, sandDark, 0.6);
  // Tronc (côté) : écorce à rayures verticales
  noiseFill(Tile.LogSide, bark, barkDark, 0.5);
  for (let x = 0; x < S; x += 3) {
    for (let y = 0; y < S; y++) if (rng() < 0.8) px(Tile.LogSide, x, y, barkDark);
  }
  // Tronc (dessus) : anneaux
  noiseFill(Tile.LogTop, wood, plankDark, 0.3);
  for (let r = 2; r < 8; r += 2) {
    for (let a = 0; a < 64; a++) {
      const x = Math.round(7.5 + Math.cos((a / 64) * Math.PI * 2) * r);
      const y = Math.round(7.5 + Math.sin((a / 64) * Math.PI * 2) * r);
      if (x >= 0 && x < S && y >= 0 && y < S) px(Tile.LogTop, x, y, plankDark);
    }
  }
  for (let y = 0; y < S; y++) {
    px(Tile.LogTop, 0, y, bark);
    px(Tile.LogTop, S - 1, y, bark);
    px(Tile.LogTop, y, 0, bark);
    px(Tile.LogTop, y, S - 1, bark);
  }

  // ---------- J1 ----------

  // Eau : bleu avec des reflets horizontaux (la transparence vient du matériau)
  const water: Rgb = [58, 118, 205];
  const waterLight: Rgb = [110, 170, 235];
  noiseFill(Tile.Water, water, [44, 96, 178], 0.5);
  for (let i = 0; i < 7; i++) {
    const y = Math.floor(rng() * S);
    const x0 = Math.floor(rng() * S);
    const len = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < len; k++) px(Tile.Water, (x0 + k) % S, y, waterLight);
  }

  // Feuilles : vert profond tacheté de clair
  const leaf: Rgb = [58, 132, 50];
  const leafDark: Rgb = [32, 86, 30];
  const leafLight: Rgb = [96, 170, 72];
  noiseFill(Tile.Leaves, leaf, leafDark, 0.9);
  for (let i = 0; i < 30; i++) px(Tile.Leaves, Math.floor(rng() * S), Math.floor(rng() * S), leafLight);

  // Fleurs : tige, deux feuilles, corolle ronde (fond transparent)
  const flower = (tile: Tile, petal: Rgb, petalDark: Rgb, heart: Rgb) => {
    const [ox, oy] = tileOrigin(tile);
    ctx.clearRect(ox, oy, S, S);
    const stem: Rgb = [58, 130, 46];
    for (let y = 7; y < S; y++) px(tile, 7, y, stem);
    for (let y = 9; y < S; y++) px(tile, 8, y, mix(stem, [30, 80, 26], 0.4));
    for (const [x, y] of [[5, 11], [6, 11], [6, 12], [9, 10], [10, 10], [9, 11]] as const) px(tile, x, y, stem);
    for (let y = 1; y <= 7; y++) {
      for (let x = 4; x <= 11; x++) {
        const d = Math.hypot(x - 7.5, y - 4);
        if (d <= 3.4) px(tile, x, y, d < 1.3 ? heart : mix(petal, petalDark, d > 2.6 ? 0.6 : rng() * 0.3));
      }
    }
  };
  flower(Tile.FlowerRed, [226, 52, 58], [160, 28, 40], [250, 214, 70]);
  flower(Tile.FlowerYellow, [250, 214, 64], [210, 160, 30], [226, 120, 40]);

  // Neige : blanc bleuté, grain léger
  noiseFill(Tile.Snow, [242, 246, 252], [206, 218, 236], 0.5);

  // Cactus (côté) : vert, côtes verticales sombres, petites épines claires
  const cactus: Rgb = [74, 156, 72];
  const cactusDark: Rgb = [44, 108, 50];
  noiseFill(Tile.CactusSide, cactus, cactusDark, 0.35);
  for (const x of [0, 5, 10, 15]) for (let y = 0; y < S; y++) px(Tile.CactusSide, x, y, cactusDark);
  for (let i = 0; i < 12; i++) px(Tile.CactusSide, 2 + 5 * Math.floor(rng() * 3) + Math.floor(rng() * 2), Math.floor(rng() * S), [236, 232, 196]);

  // Cactus (dessus) : cercle vert clair, bord sombre
  noiseFill(Tile.CactusTop, cactus, cactusDark, 0.3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.5) px(Tile.CactusTop, x, y, cactusDark);
      else if (d < 2) px(Tile.CactusTop, x, y, [120, 190, 100]);
    }
  }

  // J5 — Lampe : cage de bois sombre, verre jaune lumineux au centre
  const frame: Rgb = [92, 62, 34];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const edge = x < 2 || y < 2 || x > S - 3 || y > S - 3 || x === 7 || x === 8;
      const d = Math.hypot(x - 7.5, y - 7.5);
      px(Tile.Lamp, x, y, edge ? mix(frame, [60, 40, 22], rng() * 0.4) : mix([255, 236, 140], [250, 190, 60], Math.min(1, d / 7) * 0.8 + rng() * 0.1));
    }
  }

  // Clôture : planches verticales claires sur fond sombre, deux traverses
  const fence: Rgb = [196, 150, 96];
  const fenceDark: Rgb = [120, 84, 48];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const post = x % 5 < 3;
      const rail = y === 4 || y === 5 || y === 11 || y === 12;
      px(Tile.Fence, x, y, post || rail ? mix(fence, fenceDark, rng() * 0.35) : mix([70, 52, 34], [50, 36, 24], rng()));
    }
  }

  // Pierre brillante : pierre grise semée de cristaux cyan et blancs
  noiseFill(Tile.GlowStone, stone, stoneDark, 0.5);
  for (let i = 0; i < 9; i++) {
    const cx = 2 + Math.floor(rng() * (S - 4));
    const cy = 2 + Math.floor(rng() * (S - 4));
    px(Tile.GlowStone, cx, cy, [230, 255, 255]);
    px(Tile.GlowStone, cx + 1, cy, [110, 230, 245]);
    px(Tile.GlowStone, cx - 1, cy, [110, 230, 245]);
    px(Tile.GlowStone, cx, cy + 1, [80, 200, 230]);
    px(Tile.GlowStone, cx, cy - 1, [160, 245, 255]);
  }

  // J6 — Arc-en-ciel : six bandes de couleur, bord clair, quelques paillettes
  const bands: Rgb[] = [
    [232, 72, 72],
    [244, 150, 56],
    [246, 214, 70],
    [92, 190, 92],
    [72, 140, 226],
    [150, 96, 206],
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const band = bands[Math.min(bands.length - 1, Math.floor(((y - 1) / (S - 2)) * bands.length))] ?? bands[0]!;
      const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      px(Tile.Rainbow, x, y, edge ? [250, 246, 236] : mix(band, [255, 255, 255], rng() * 0.18));
    }
  }
  for (let i = 0; i < 5; i++) px(Tile.Rainbow, 2 + Math.floor(rng() * (S - 4)), 2 + Math.floor(rng() * (S - 4)), [255, 255, 255]);

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

/** Copie une tuile de l'atlas dans un petit canvas (icônes de la barre d'inventaire). */
export function tileIcon(atlas: HTMLCanvasElement, tile: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE_SIZE;
  c.height = TILE_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const [ox, oy] = tileOrigin(tile);
  ctx.drawImage(atlas, ox, oy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  return c;
}
