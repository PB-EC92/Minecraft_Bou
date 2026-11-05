/**
 * Pictogramme de l'abri (J6) : un toit et trois murs. Dans le bandeau de Pixel,
 * chaque partie s'allume quand elle est en place autour de l'enfant (pas de mot
 * à lire : le lecteur débutant voit ce qui manque) ; sur l'écran de
 * félicitations, il est allumé en entier.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

export function shelterIcon(size = 40): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 40 36");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(Math.round((size * 36) / 40)));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("shelter-icon");
  const roof = document.createElementNS(SVG_NS, "path");
  roof.setAttribute("d", "M3 16 L20 3 L37 16 Z");
  roof.classList.add("part", "roof");
  svg.appendChild(roof);
  for (const x of [6, 17, 28]) {
    const wall = document.createElementNS(SVG_NS, "rect");
    wall.setAttribute("x", String(x));
    wall.setAttribute("y", "19");
    wall.setAttribute("width", "6");
    wall.setAttribute("height", "15");
    wall.setAttribute("rx", "1");
    wall.classList.add("part", "wall");
    svg.appendChild(wall);
  }
  return svg;
}

/** Allume les parties en place : le toit, et autant de murs que de côtés fermés (trois au plus). */
export function setShelterParts(svg: SVGSVGElement, roof: boolean, walls: number, ok: boolean): void {
  svg.classList.toggle("ok", ok);
  svg.querySelector(".roof")?.classList.toggle("on", roof);
  svg.querySelectorAll(".wall").forEach((w, i) => w.classList.toggle("on", i < walls));
}
