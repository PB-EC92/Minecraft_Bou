import type { AvatarDef } from "../game/avatars";

/** Portrait de face d'un avatar, dessiné sur un canvas (J4) : pour l'écran d'accueil et le choix de l'avatar. */
export function avatarIcon(def: AvatarDef, size = 96): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  c.style.width = c.style.height = `${size}px`;
  c.style.imageRendering = "pixelated";
  const g = c.getContext("2d");
  if (!g) return c;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  // Grille de 16 × 16 : tête (6×6), corps, bras, jambes.
  rect(5, 1, 6, 6, def.skin);
  rect(5, 1, 6, 2, def.hair);
  rect(5, 3, 1, 2, def.hair);
  rect(10, 3, 1, 2, def.hair);
  rect(6, 4, 1, 1, "#1c1c28");
  rect(9, 4, 1, 1, "#1c1c28");
  rect(7, 6, 2, 1, "#b0645a");
  if (def.hat) {
    rect(4, 0, 8, 2, def.hat);
    rect(3, 2, 4, 1, def.hat);
  }
  rect(5, 7, 6, 5, def.shirt);
  rect(3, 7, 2, 4, def.shirt);
  rect(11, 7, 2, 4, def.shirt);
  rect(3, 11, 2, 1, def.skin);
  rect(11, 11, 2, 1, def.skin);
  rect(5, 12, 3, 3, def.pants);
  rect(8, 12, 3, 3, def.pants);
  rect(5, 15, 3, 1, def.shoes);
  rect(8, 15, 3, 1, def.shoes);
  return c;
}
