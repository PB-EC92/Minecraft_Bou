import type { BlockId } from "../engine/blocks";
import { recipeById, type RecipeId } from "../engine/crafting";
import { countNoun } from "../edu/counting";
import { recipeSentence, type CraftCardView } from "../edu/craftTexts";
import { NBSP, type ReadingLevel } from "../edu/texts";

/**
 * Panneau de fabrication (V2 lot 1), en DOM natif, sur le modèle de Celebration : un voile sur le jeu en pause et
 * une feuille au-dessus du sac, avec une carte par recette (ingrédient → résultat, en chiffres géants et en
 * icônes ; phrase de la recette pour l'autonome). On fabrique en deux touchers : le marteau, puis une carte.
 * Toutes les cartes restent touchables : une carte impossible explique pourquoi en réponse (le jeu écrit la
 * raison dans la ligne d'état et fait trembler la carte).
 *
 * Rien ne passe derrière : les touchers sont arrêtés et annulés (ni clic ni souris synthétisés, donc ni capture
 * de la souris ni appui « casser »), la souris et la molette sont arrêtées. Le clavier et le menu contextuel
 * remontent jusqu'au jeu, qui s'en occupe (F et Échap ferment ; le menu est bloqué).
 *
 * Le panneau ne se ferme pas tout seul : la croix et le voile appellent `handlers.close()`, et le jeu appelle
 * `hide()`. Les styles (classes ci-dessous) sont écrits par l'intégration dans style.css.
 */

/** Délai après l'ouverture avant que cartes, voile et croix répondent (ms) : protège d'un double toucher. */
export const CRAFT_ARM_MS = 400;
/** Au-delà de ce déplacement du doigt (px), le geste est annulé : rien n'est fabriqué ni fermé. */
export const CRAFT_TOUCH_SLOP_PX = 20;
/** Durée de la secousse d'une carte refusée (ms). */
export const CRAFT_SHAKE_MS = 300;
/** Au-delà de ce nombre, une seule icône et « × n ». */
const MAX_ICONS = 4;

/** Libellés d'interface, jamais lus (une seule forme). */
const TITLE = "Fabriquer";
const CLOSE_LABEL = "Fermer";

/** Marteau (dessin original, en traits) : manche, tête, cerclage. */
const HAMMER = '<path d="M4.5 19.5 13 11"/><path d="m11 6 3-3 7 7-3 3z"/><path d="m12.5 7.5 4 4"/>';
const ARROW = '<path d="M3.5 12h16"/><path d="m13.5 6 6 6-6 6"/>';
const BADGE_ICONS: Record<NonNullable<CraftCardView["icon"]>, { color: string; body: string }> = {
  check: { color: "#3c9a4a", body: '<path d="m5 12.5 4.5 4.5L19 7.5"/>' },
  lock: { color: "#6b5a4e", body: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>' },
  bag: {
    color: "#b4521a",
    body: '<path d="M6 9h12l-1.2 11H7.2z"/><path d="M9.5 9V7a2.5 2.5 0 0 1 5 0v2"/><path d="M4 4l16 16"/>',
  },
};

export interface CraftHandlers {
  /** Carte touchée ou cliquée (une fabrication ; l'écart entre deux fabrications est géré par le jeu). */
  pick(id: RecipeId): void;
  /** Croix ou voile : le jeu ferme le panneau (hide). */
  close(): void;
}

/**
 * Ton de la ligne d'état : consigne (info), résultat (ok), raison d'un refus (no). Classe CSS « tone-<ton> » : jamais
 * « info » seule, que porte la ligne d'infos du HUD (.hud > .info).
 */
export type CraftStatusTone = "info" | "ok" | "no";

/** Classe CSS du ton de la ligne d'état (préfixée : aucune collision avec les autres classes du jeu). */
export function craftToneClass(tone: CraftStatusTone): string {
  return `tone-${tone}`;
}

/** Ce que vise un geste : une carte, ou la fermeture (voile, croix). */
type Target = { kind: "card"; id: RecipeId } | { kind: "close" };

/** Éléments d'une carte, gardés pour la mettre à jour sans la recréer. */
interface CardParts {
  /** Ce qui fixe la structure de la carte (recette, nombres, phrase) : s'il change, la carte est reconstruite. */
  key: string;
  id: RecipeId;
  el: HTMLButtonElement;
  badge: HTMLSpanElement;
  /** Icônes de l'ingrédient : celles qui manquent deviennent des fantômes (pointillés). */
  inTiles: HTMLSpanElement[];
}

/** Doigt suivi : le dernier posé sur le panneau (un nouveau doigt reprend le geste). */
interface TrackedTouch {
  id: number;
  x: number;
  y: number;
  /** null : geste sans effet (hors carte, voile ou croix ; ou doigt qui a glissé). */
  target: Target | null;
}

function span(className: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = className;
  return s;
}

/** Petit dessin SVG en traits (viewBox 24), sans texte variable. */
function svgIcon(className: string, size: number, body: string, color = "currentColor"): SVGSVGElement {
  const holder = document.createElement("span");
  holder.innerHTML =
    `<svg class="${className}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}"` +
    ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  return holder.firstElementChild as SVGSVGElement;
}

function findTouch(list: TouchList, id: number): Touch | null {
  for (let k = 0; k < list.length; k++) {
    const t = list.item(k);
    if (t && t.identifier === id) return t;
  }
  return null;
}

function cardKey(v: CraftCardView): string {
  return [v.id, v.input.block, v.input.need, v.output.block, v.output.count, v.sentence ?? ""].join("|");
}

export class CraftPanel {
  readonly root: HTMLDivElement;
  private readonly backdrop: HTMLDivElement;
  private readonly cardsBox: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private cards: CardParts[] = [];
  private handlers: CraftHandlers | null = null;
  private armedUntil = 0;
  private touch: TrackedTouch | null = null;
  /** Carte enfoncée (classe pressed) : :active ne s'applique pas toujours quand l'appui est annulé. */
  private pressed: HTMLElement | null = null;
  private readonly shakeTimers = new Map<RecipeId, number>();

  constructor(
    parent: HTMLElement,
    private readonly icon: (id: BlockId) => HTMLCanvasElement,
  ) {
    this.root = document.createElement("div");
    this.root.className = "craft";
    this.root.hidden = true;

    this.backdrop = document.createElement("div");
    this.backdrop.className = "craft-backdrop";

    const sheet = document.createElement("div");
    sheet.className = "craft-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", TITLE);

    const head = document.createElement("div");
    head.className = "craft-head";
    const title = document.createElement("h2");
    title.textContent = TITLE;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "craft-close";
    close.setAttribute("aria-label", CLOSE_LABEL);
    close.textContent = "✕";
    head.append(svgIcon("craft-hammer", 36, HAMMER), title, close);

    this.cardsBox = document.createElement("div");
    this.cardsBox.className = "craft-cards";

    this.status = document.createElement("p");
    this.status.className = `craft-status ${craftToneClass("info")}`;
    this.status.setAttribute("aria-live", "polite");

    sheet.append(head, this.cardsBox, this.status);
    this.root.append(this.backdrop, sheet);

    // Doigt : tout est arrêté et annulé ; on agit au relâchement du doigt suivi, quelle que soit la durée.
    this.root.addEventListener("touchstart", (e) => this.onTouchStart(e), { passive: false });
    this.root.addEventListener("touchmove", (e) => this.onTouchMove(e), { passive: false });
    this.root.addEventListener("touchend", (e) => this.onTouchEnd(e, false), { passive: false });
    this.root.addEventListener("touchcancel", (e) => this.onTouchEnd(e, true), { passive: false });
    // Souris : on agit au clic. Un clic commencé sur une carte et fini sur le voile part vers leur ancêtre commun
    // (la racine) : il ne ferme pas.
    this.root.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const card = this.cardElement(e.target);
      if (!card) return;
      e.preventDefault(); // la carte ne prend pas le focus (Espace ou Entrée referaient une fabrication)
      if (e.button === 0) this.setPressed(card);
    });
    this.root.addEventListener("mouseup", (e) => {
      e.stopPropagation();
      this.setPressed(null);
    });
    this.root.addEventListener("click", (e) => {
      const t = this.targetOf(e.target);
      if (t) this.act(t);
    });
    // Molette : arrêtée seulement, pour que la feuille puisse défiler dans une petite fenêtre.
    this.root.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    // Fenêtre qui perd le focus : le doigt suivi est oublié (sa fin risque de ne jamais arriver), la carte relâchée.
    window.addEventListener("blur", () => this.forgetTouch());
    // Un doigt qui se pose hors du panneau (sur la barre, qui reste touchable au-dessus du voile et ne laisse pas
    // passer ses touchers) : un pouce posé avant sur le voile ne fermera pas le panneau en se levant. Écouté en
    // capture sur la fenêtre, avant que la barre n'arrête le toucher.
    window.addEventListener(
      "touchstart",
      (e) => {
        if (!this.visible || this.touch?.target?.kind !== "close") return;
        if (e.target instanceof Node && this.root.contains(e.target)) return;
        this.forgetTouch();
      },
      { capture: true, passive: true },
    );

    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /**
   * Ouvre le panneau avec ces cartes (dans l'ordre reçu). `status` : texte de la ligne d'état (ton « info »).
   * Cartes, voile et croix ne répondent qu'après CRAFT_ARM_MS.
   */
  show(cards: readonly CraftCardView[], level: ReadingLevel, status: string, handlers: CraftHandlers): void {
    this.handlers = handlers;
    this.touch = null;
    this.setPressed(null);
    this.clearShakes();
    this.root.dataset.level = level;
    this.build(cards);
    this.setStatus(status, "info");
    this.root.hidden = false;
    this.armedUntil = performance.now() + CRAFT_ARM_MS;
  }

  /** Met les cartes à jour (état, badge, icônes manquantes) sans les recréer : mêmes éléments, même ordre. */
  update(cards: readonly CraftCardView[]): void {
    if (!this.visible) return;
    const same = cards.length === this.cards.length && cards.every((c, i) => this.cards[i]?.key === cardKey(c));
    if (!same) {
      this.build(cards);
      return;
    }
    cards.forEach((c, i) => {
      const parts = this.cards[i];
      if (parts) this.fill(parts, c);
    });
  }

  /** Ligne d'état : consigne (info), résultat (ok) ou raison d'un refus (no). */
  setStatus(text: string, tone: CraftStatusTone): void {
    this.status.textContent = text;
    this.status.className = `craft-status ${craftToneClass(tone)}`;
  }

  /** Fait trembler une carte (refus), classe shake pendant CRAFT_SHAKE_MS. */
  shake(id: RecipeId): void {
    const parts = this.cards.find((c) => c.id === id);
    if (!parts) return;
    const el = parts.el;
    window.clearTimeout(this.shakeTimers.get(id));
    el.classList.remove("shake");
    void el.offsetWidth; // relance l'animation si la carte tremblait déjà
    el.classList.add("shake");
    this.shakeTimers.set(
      id,
      window.setTimeout(() => {
        el.classList.remove("shake");
        this.shakeTimers.delete(id);
      }, CRAFT_SHAKE_MS),
    );
  }

  /** Ferme le panneau sans prévenir le jeu (c'est le jeu qui l'appelle). */
  hide(): void {
    this.root.hidden = true;
    this.handlers = null;
    this.touch = null;
    this.setPressed(null);
    this.clearShakes();
    this.cardsBox.replaceChildren();
    this.cards = [];
  }

  // ---------- Cartes ----------

  private build(cards: readonly CraftCardView[]): void {
    this.setPressed(null);
    this.cards = cards.map((c) => this.buildCard(c));
    this.cardsBox.replaceChildren(...this.cards.map((c) => c.el));
  }

  private buildCard(v: CraftCardView): CardParts {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "craft-card";
    el.dataset.recipe = v.id;
    const recipe = recipeById(v.id);
    el.setAttribute("aria-label", recipe ? recipeSentence(recipe) : TITLE);
    el.addEventListener("mouseleave", () => {
      if (this.pressed === el) this.setPressed(null);
    });

    const badge = span("craft-badge");
    const input = this.side("in", v.input.block, v.input.need);
    const output = this.side("out", v.output.block, v.output.count);
    el.append(badge, input.el, svgIcon("craft-arrow", 36, ARROW), output.el);
    if (v.sentence) {
      const sentence = span("craft-sentence");
      sentence.textContent = v.sentence;
      el.appendChild(sentence);
    }
    const parts: CardParts = { key: cardKey(v), id: v.id, el, badge, inTiles: input.tiles };
    this.fill(parts, v);
    return parts;
  }

  /** Un côté de la carte : nombre géant, icônes (au plus MAX_ICONS, sinon une et « × n »), nom du bloc. */
  private side(kind: "in" | "out", block: BlockId, n: number): { el: HTMLSpanElement; tiles: HTMLSpanElement[] } {
    const el = span(`craft-side ${kind}`);
    const count = document.createElement("b");
    count.textContent = String(n);
    const icons = span("craft-icons");
    const shown = n <= MAX_ICONS ? n : 1;
    const tiles: HTMLSpanElement[] = [];
    for (let k = 0; k < shown; k++) {
      const tile = span("craft-tile");
      const canvas = this.icon(block);
      canvas.setAttribute("aria-hidden", "true");
      tile.appendChild(canvas);
      icons.appendChild(tile);
      tiles.push(tile);
    }
    if (n > MAX_ICONS) {
      const times = span("craft-times");
      times.textContent = `×${NBSP}${String(n)}`;
      icons.appendChild(times);
    }
    icons.dataset.n = String(shown);
    const name = document.createElement("small");
    const noun = countNoun(block);
    name.textContent = n >= 2 ? noun.many : noun.one;
    el.append(count, icons, name);
    return { el, tiles };
  }

  /** Ce qui change d'une mise à jour à l'autre : état, badge, icônes manquantes de l'ingrédient. */
  private fill(parts: CardParts, v: CraftCardView): void {
    parts.el.dataset.state = v.state;

    const badge: (Node | string)[] = [];
    if (v.icon) {
      const i = BADGE_ICONS[v.icon];
      badge.push(svgIcon(`craft-badge-icon ${v.icon}`, 26, i.body, i.color));
    }
    if (v.badge) badge.push(v.badge);
    parts.badge.replaceChildren(...badge);

    // Fantômes : ce qui manque (manque), ou tout l'ingrédient quand il est gardé pour la mission (réservé).
    const need = v.input.need;
    const available = v.state === "missing" ? Math.max(0, v.input.have) : v.state === "reserved" ? 0 : need;
    const tiles = parts.inTiles;
    tiles.forEach((tile, k) => {
      const ghost = tiles.length === need ? k >= available : available < need;
      tile.classList.toggle("ghost", ghost);
    });
  }

  // ---------- Gestes ----------

  private cardElement(t: EventTarget | null): HTMLElement | null {
    if (!(t instanceof Element)) return null;
    const card = t.closest<HTMLElement>(".craft-card");
    return card && this.root.contains(card) ? card : null;
  }

  private targetOf(t: EventTarget | null): Target | null {
    const card = this.cardElement(t);
    if (card) {
      const recipe = recipeById(card.dataset.recipe);
      return recipe ? { kind: "card", id: recipe.id } : null;
    }
    if (t === this.backdrop) return { kind: "close" };
    if (t instanceof Element && t.closest(".craft-close") && this.root.contains(t)) return { kind: "close" };
    return null;
  }

  private act(t: Target): void {
    const h = this.handlers;
    if (!h || !this.visible || performance.now() < this.armedUntil) return;
    if (t.kind === "card") h.pick(t.id);
    else h.close();
  }

  private onTouchStart(e: TouchEvent): void {
    e.stopPropagation();
    e.preventDefault();
    const f = e.changedTouches.item(0);
    if (!f) return;
    const target = this.targetOf(f.target);
    // Un pouce qui tient l'appareil, posé sur le voile (ou sur rien qui agisse) pendant qu'un autre doigt est posé
    // (le doigt suivi, ou un doigt sur la barre, que le panneau ne voit pas) : il ne reprend pas le geste (la carte
    // touchée fabrique au lever du doigt, l'appui long sur une case continue, le panneau ne se ferme pas au lever du
    // pouce).
    const passive = target === null || f.target === this.backdrop;
    if (passive && e.touches.length > 1) return;
    // Sinon, un nouveau doigt reprend le geste : le doigt suivi jusque-là n'agira plus. Un doigt dont la fin s'est
    // perdue (geste du système) ou une paume posée d'abord sur le voile ne bloquent donc jamais le panneau (sous son
    // voile, la croix et les cartes seraient sans réponse au doigt ; elles répondent toujours).
    this.forgetTouch();
    this.touch = { id: f.identifier, x: f.clientX, y: f.clientY, target };
    this.setPressed(target?.kind === "card" ? this.cardElement(f.target) : null);
  }

  private onTouchMove(e: TouchEvent): void {
    e.stopPropagation();
    e.preventDefault();
    const g = this.touch;
    if (!g || !g.target) return;
    const f = findTouch(e.changedTouches, g.id);
    if (f && Math.hypot(f.clientX - g.x, f.clientY - g.y) > CRAFT_TOUCH_SLOP_PX) {
      g.target = null;
      this.setPressed(null);
    }
  }

  private onTouchEnd(e: TouchEvent, cancelled: boolean): void {
    e.stopPropagation();
    e.preventDefault();
    const g = this.touch;
    if (!g) return;
    const f = findTouch(e.changedTouches, g.id);
    if (!f) return;
    this.forgetTouch();
    if (cancelled || !g.target) return;
    if (Math.hypot(f.clientX - g.x, f.clientY - g.y) > CRAFT_TOUCH_SLOP_PX) return;
    this.act(g.target);
  }

  private forgetTouch(): void {
    this.touch = null;
    this.setPressed(null);
  }

  private setPressed(el: HTMLElement | null): void {
    if (this.pressed === el) return;
    this.pressed?.classList.remove("pressed");
    this.pressed = el;
    el?.classList.add("pressed");
  }

  private clearShakes(): void {
    for (const [id, timer] of this.shakeTimers) {
      window.clearTimeout(timer);
      this.cards.find((c) => c.id === id)?.el.classList.remove("shake");
    }
    this.shakeTimers.clear();
  }
}
