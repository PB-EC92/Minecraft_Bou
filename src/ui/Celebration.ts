/**
 * Écran de félicitations (J6), en DOM natif : grand « Bravo » avec le prénom,
 * phrase de Pixel, récapitulatif de ce que l'enfant a réuni (icônes et nombres,
 * le comptage est au cœur de la mission 1), cadeau, gros bouton « Continuer »,
 * pluie de confettis dessinée en CSS (aucune image). Le bouton n'est actif
 * qu'après un court instant : un enfant qui saute (Espace) ou tape l'écran au
 * moment où l'écran apparaît ne le ferme pas sans l'avoir vu.
 */

export interface CelebrationLine {
  icon: HTMLElement | SVGElement | null;
  text: string;
}

export interface CelebrationContent {
  title: string;
  subtitle: string;
  recap: readonly CelebrationLine[];
  reward: CelebrationLine | null;
  button: string;
}

/** Délai avant que le bouton « Continuer » réponde (ms). */
export const CELEBRATION_ARM_MS = 1200;
const CONFETTI = 48;
const COLORS = ["#e84848", "#f49638", "#f6d646", "#5cbe5c", "#488ce2", "#9660ce", "#ffffff"];

export class Celebration {
  readonly root: HTMLDivElement;
  private closeHandler: (() => void) | null = null;
  private armTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "celebration";
    this.root.hidden = true;
    // Les gestes faits sur cet écran ne pilotent pas le jeu derrière (regard, casse, sauts). Le menu contextuel,
    // lui, doit remonter jusqu'au jeu, qui le bloque (« Actualiser » ferait perdre la partie).
    for (const ev of ["mousedown", "mouseup", "touchstart", "touchend", "touchmove", "keydown", "keyup", "wheel"]) {
      this.root.addEventListener(ev, (e) => e.stopPropagation());
    }
    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(c: CelebrationContent, onClose: () => void): void {
    this.closeHandler = onClose;
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.setAttribute("aria-hidden", "true");
    for (let i = 0; i < CONFETTI; i++) {
      const p = document.createElement("i");
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = COLORS[i % COLORS.length] ?? "#fff";
      p.style.animationDelay = `${(Math.random() * 1.6).toFixed(2)}s`;
      p.style.animationDuration = `${(2.6 + Math.random() * 1.8).toFixed(2)}s`;
      p.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 160)}px`);
      p.style.setProperty("--spin", `${Math.round(360 + Math.random() * 720)}deg`);
      confetti.appendChild(p);
    }

    const card = document.createElement("div");
    card.className = "celebration-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", c.title);
    const star = document.createElement("div");
    star.className = "celebration-star";
    star.innerHTML =
      '<svg viewBox="0 0 24 24" width="84" height="84" aria-hidden="true"><path d="M12 2.2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.1l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" fill="#ffd23f" stroke="#b4521a" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    const title = document.createElement("h1");
    title.textContent = c.title;
    const subtitle = document.createElement("p");
    subtitle.className = "celebration-subtitle";
    subtitle.textContent = c.subtitle;
    card.append(star, title, subtitle);

    if (c.recap.length > 0) {
      const list = document.createElement("ul");
      list.className = "celebration-recap";
      for (const line of c.recap) list.appendChild(this.line(line));
      card.appendChild(list);
    }
    if (c.reward) {
      const reward = this.line(c.reward);
      reward.classList.add("celebration-reward");
      const box = document.createElement("ul");
      box.className = "celebration-recap";
      box.appendChild(reward);
      card.appendChild(box);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "celebration-button";
    button.textContent = c.button;
    button.disabled = true;
    button.addEventListener("click", () => this.close());
    card.appendChild(button);

    this.root.replaceChildren(confetti, card);
    this.root.hidden = false;
    window.clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => {
      button.disabled = false;
      button.focus();
    }, CELEBRATION_ARM_MS);
  }

  /** Ferme l'écran sans prévenir le jeu (retour à l'accueil, autre onglet). */
  hide(): void {
    window.clearTimeout(this.armTimer);
    this.root.hidden = true;
    this.root.replaceChildren();
    this.closeHandler = null;
  }

  private close(): void {
    const h = this.closeHandler;
    this.hide();
    h?.();
  }

  private line(l: CelebrationLine): HTMLLIElement {
    const li = document.createElement("li");
    if (l.icon) {
      l.icon.classList.add("celebration-icon");
      li.appendChild(l.icon);
    }
    const t = document.createElement("span");
    t.textContent = l.text;
    li.appendChild(t);
    return li;
  }
}
