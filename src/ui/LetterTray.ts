/**
 * Boîte à lettres de la mission 2 (V2 lot 1), en DOM natif sur le modèle de l'écran de félicitations : un voile,
 * une carte avec le visage de Pixel, le titre, le modèle du mot (selon le mode et le palier d'aide) et les
 * 26 lettres A à Z, illimitées. Chaque lettre est le dessin exact du bloc posé (tuile de l'atlas, une seule encre
 * sombre pour toutes les lettres), sans texte système. Choisir une lettre ferme la boîte ; le jeu la met alors
 * dans la main de l'enfant.
 *
 * Rien de ce qui se passe sur la boîte ne parvient au jeu :
 * - toucher : l'action se fait quand le doigt retenu se lève, sur la cible où il s'est posé ; un glissé de plus
 *   de TRAY_SLOP_PX, ou un doigt levé sur une autre cible, l'annule. Les événements sont arrêtés et empêchés
 *   (pas de souris ni de clic de compatibilité) ;
 * - souris : action au clic ; appui, relâchement et molette ne remontent pas ;
 * - clavier, boîte ouverte : un écouteur sur window, en phase de capture, voit toutes les touches avant le jeu
 *   et les arrête (trayKeyAction). Échap, 0 ou 0 du pavé (par KeyboardEvent.code) ferment ; une lettre tapée
 *   (KeyboardEvent.key sans accent, en capitale) est choisie. C'est la seule lecture de KeyboardEvent.key du jeu :
 *   de la saisie, pas du déplacement (règle 4). Sur un clavier AZERTY, « é », « è » et « ç » de la rangée des
 *   chiffres donnent donc E, E et C : la boîte suit ce que la touche écrit (la touche « à » est celle du 0 : elle
 *   ferme). Tab parcourt les boutons de la carte, en boucle, en commençant par les lettres ; Entrée ou Espace sur
 *   un bouton le déclenche (clic) ; tout le reste est avalé. Le relâchement des touches est arrêté aussi : le
 *   clavier du jeu l'écoute en capture sur window, avant nous, et reste donc à jour ;
 * - le menu contextuel n'est pas arrêté : le jeu le bloque déjà.
 *
 * Armement : rien ne répond pendant les TRAY_ARM_MS qui suivent l'ouverture (un double toucher ou un 0 tenu
 * n'ouvre pas puis ne referme pas la boîte aussitôt) ; la racine reçoit alors la classe « armed » (repère pour le
 * CSS et les tests de fumée). Rouvrir une boîte déjà ouverte (contenu mis à jour) ne la désarme pas. Chaque geste
 * appelle au plus un gestionnaire, une seule fois.
 *
 * Classes pour le CSS (écrit par l'intégration) : .letter-tray (.armed), .letter-tray-backdrop, .letter-tray-card,
 * .letter-tray-head, .letter-tray-face, .letter-tray-keyboard, .letter-tray-speaker, .letter-tray-close,
 * .letter-tray-model, .tray-syllable, .tray-letter (.done, .next, .todo, .box), .letter-tray-grid, .tray-key
 * (.glow sur la lettre attendue) ; .pressed sur la cible d'un doigt posé (retour immédiat au toucher).
 */

import { LETTERS, Tile } from "../engine/blocks";

/** Délai après l'ouverture pendant lequel la boîte ne répond à rien (ms). */
export const TRAY_ARM_MS = 400;
/** Glissé du doigt au-delà duquel le toucher n'agit plus (px). */
export const TRAY_SLOP_PX = 20;
/** Un clic arrivant si peu de temps après un toucher est un clic de compatibilité : ignoré (ms). */
const GHOST_CLICK_MS = 800;

/** État d'une lettre du modèle : juste, attendue, à venir, ou case vide en tirets (dictée). */
export type TrayLetterState = "done" | "next" | "todo" | "box";

/** Lettre du modèle ; ch null = case vide en tirets. */
export interface TrayLetter {
  ch: string | null;
  state: TrayLetterState;
}

/** Modèle du mot : les lettres et les longueurs des syllabes (groupes soulignés d'un arc). */
export interface TrayModel {
  letters: readonly TrayLetter[];
  syllables: readonly number[];
}

export interface TrayContent {
  title: string;
  /** Ligne « tu peux aussi la taper au clavier » (au PC) ; null : absente. */
  keyboardLine: string | null;
  model: TrayModel | null;
  /** Lettre attendue (copie), pour l'anneau d'aide ; null en dictée. */
  expected: string | null;
  /** Anneau qui palpite sur la lettre attendue (palier d'aide). */
  glow: boolean;
  /** Haut-parleur qui redit la dictée. */
  speaker: boolean;
}

export interface TrayHandlers {
  /** Une lettre choisie (capitale A à Z) ; la boîte est déjà fermée. */
  pick(ch: string): void;
  /** Fermée sans choix (voile, croix, Échap, 0) ; la boîte est déjà fermée. */
  close(): void;
  /** Haut-parleur : redire la dictée (la boîte reste ouverte). */
  repeat(): void;
  /** Lettre du modèle touchée : la dire (la boîte reste ouverte). */
  sayLetter(ch: string): void;
}

/**
 * Lettre tapée au clavier (fonction pure) : KeyboardEvent.key sans accent, en capitale (« é » → "E",
 * « m » → "M") ; tout ce qui n'est pas une seule lettre A à Z donne null (« Escape », « 1 », « œ », « Dead »).
 */
export function trayKeyLetter(key: string): string | null {
  if (typeof key !== "string") return null;
  const k = key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents (diacritiques combinants après NFD)
    .toUpperCase();
  return /^[A-Z]$/.test(k) ? k : null;
}

/** Ce que la boîte fait d'une touche enfoncée (le jeu, lui, ne la voit jamais). */
export type TrayKeyAction =
  /** Échap, 0 ou 0 du pavé : fermer sans choix. */
  | { kind: "close" }
  /** Une lettre tapée : la choisir. */
  | { kind: "pick"; ch: string }
  /** Tab : passer au bouton suivant de la carte (en boucle). */
  | { kind: "tab" }
  /** Tout le reste : rien (Entrée et Espace gardent leur effet sur le bouton qui a le focus). */
  | { kind: "pass" };

/** Champs de KeyboardEvent dont dépend trayKeyAction. */
export interface TrayKey {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}

/**
 * Action d'une touche, boîte ouverte (fonction pure). La fermeture se lit par la position (code) : la touche du 0
 * ferme même si elle écrit « à » (AZERTY). Une lettre se lit par ce qu'écrit la touche (key) ; Ctrl, Alt ou Cmd
 * (raccourci du navigateur, AltGr sous Windows) et une composition en cours ne choisissent rien.
 */
export function trayKeyAction(e: TrayKey): TrayKeyAction {
  if (e.isComposing) return { kind: "pass" };
  if (e.code === "Escape" || e.code === "Digit0" || e.code === "Numpad0") return { kind: "close" };
  if (e.code === "Tab") return { kind: "tab" };
  if (e.ctrlKey || e.altKey || e.metaKey) return { kind: "pass" };
  const ch = trayKeyLetter(e.key);
  return ch === null ? { kind: "pass" } : { kind: "pick", ch };
}

/**
 * Groupes de syllabes du modèle (fonction pure) : rangs des lettres, groupe par groupe, d'après les longueurs
 * données. Une longueur qui n'est pas un entier positif est ignorée ; les groupes s'arrêtent au bout du mot ; les
 * lettres restantes forment un dernier groupe (sans syllabes : un seul groupe pour tout le mot).
 */
export function syllableGroups(count: number, syllables: readonly number[]): number[][] {
  const n = Number.isInteger(count) && count > 0 ? count : 0;
  const groups: number[][] = [];
  let i = 0;
  for (const len of syllables) {
    if (i >= n) break;
    if (!Number.isInteger(len) || len <= 0) continue;
    const g: number[] = [];
    for (let j = 0; j < len && i < n; j++) g.push(i++);
    groups.push(g);
  }
  if (i < n) {
    const rest: number[] = [];
    while (i < n) rest.push(i++);
    groups.push(rest);
  }
  return groups;
}

/** Case du modèle telle qu'elle est montrée : la lettre dessinée (null : case vide en tirets) et son état. */
export interface TrayCell {
  letter: string | null;
  state: TrayLetterState;
}

/**
 * Cases du modèle, groupées par syllabe (fonction pure). Une case « box » ne montre jamais sa lettre, même si le
 * jeu la donne (la dictée ne doit rien trahir) ; une lettre absente ou hors A–Z devient une case « box ».
 */
export function trayModelCells(model: TrayModel): TrayCell[][] {
  return syllableGroups(model.letters.length, model.syllables).map((group) =>
    group.map((i) => {
      const l = model.letters[i];
      if (!l || l.state === "box" || l.ch === null || !/^[A-Z]$/.test(l.ch)) return { letter: null, state: "box" };
      return { letter: l.ch, state: l.state };
    }),
  );
}

/**
 * Cible d'un toucher (fonction pure) : celle où le doigt s'est posé, si le doigt n'a pas glissé de plus de
 * TRAY_SLOP_PX et ne s'est pas levé sur une autre cible (lettre voisine) ; se lever entre deux cibles (écart
 * entre les lettres) garde la cible de départ. null : rien à faire.
 */
export function tapTarget<T>(start: T | null, end: T | null, moved: number): T | null {
  if (start === null || !(moved <= TRAY_SLOP_PX)) return null;
  return end === null || end === start ? start : null;
}

/** Cibles qui agissent : une lettre de la grille, une lettre du modèle, le haut-parleur, la croix, le voile. */
const ACTIONABLE = ".tray-key, .tray-letter[data-letter], .letter-tray-speaker, .letter-tray-close, .letter-tray-backdrop";

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

export class LetterTray {
  readonly root: HTMLDivElement;
  private handlers: TrayHandlers | null = null;
  private card: HTMLDivElement | null = null;
  /** Instant (performance.now) à partir duquel la boîte répond. */
  private armedAt = 0;
  private armTimer = 0;
  private listening = false;
  /** Doigt retenu (le premier posé une fois la boîte armée), son point de départ et sa cible. */
  private touchId: number | null = null;
  private touchX = 0;
  private touchY = 0;
  private touchTarget: Element | null = null;
  private lastTouchAt = -Infinity;

  /**
   * tile : un canvas de la tuile demandée (tileIcon de l'atlas, un nouveau à chaque appel) ; face : le visage de
   * Pixel (pixelFace). La taille d'affichage des deux vient du CSS.
   */
  constructor(
    parent: HTMLElement,
    private readonly tile: (t: number) => HTMLCanvasElement,
    private readonly face: () => HTMLCanvasElement,
  ) {
    this.root = document.createElement("div");
    this.root.className = "letter-tray";
    this.root.hidden = true;
    for (const ev of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
      this.root.addEventListener(ev, (e) => this.onTouch(e as TouchEvent), { passive: false });
    }
    for (const ev of ["mousedown", "mouseup", "wheel"]) {
      this.root.addEventListener(ev, (e) => e.stopPropagation());
    }
    this.root.addEventListener("click", (e) => this.onClick(e));
    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /**
   * Ouvre la boîte. Déjà ouverte, son contenu et ses gestionnaires sont remplacés sans la désarmer (un doigt
   * posé est oublié). Fraîchement ouverte, elle ne répond qu'après TRAY_ARM_MS.
   */
  open(content: TrayContent, handlers: TrayHandlers): void {
    const fresh = !this.visible;
    this.handlers = handlers;
    const backdrop = document.createElement("div");
    backdrop.className = "letter-tray-backdrop";
    const card = document.createElement("div");
    card.className = "letter-tray-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "Boîte à lettres");
    card.appendChild(this.head(content));
    const model = this.model(content.model);
    if (model) card.appendChild(model);
    card.appendChild(this.grid(content));

    this.resetTouch();
    const active = document.activeElement;
    const refocus = !fresh && active instanceof HTMLElement && this.root.contains(active) ? this.focusKey(active) : null;
    this.card = card;
    this.root.replaceChildren(backdrop, card);
    if (refocus) this.restoreFocus(refocus);
    this.root.hidden = false;
    if (fresh) {
      this.root.classList.remove("armed");
      this.armedAt = performance.now() + TRAY_ARM_MS;
      window.clearTimeout(this.armTimer);
      this.armTimer = window.setTimeout(() => this.root.classList.add("armed"), TRAY_ARM_MS);
      // Un bouton du jeu resté actif derrière le voile ne doit pas répondre à Entrée ou Espace.
      if (active instanceof HTMLElement && !this.root.contains(active)) active.blur();
    }
    if (!this.listening) {
      window.addEventListener("keydown", this.onKeyDown, true);
      window.addEventListener("keyup", this.onKeyUp, true);
      this.listening = true;
    }
  }

  /** Ferme la boîte sans appeler handlers.close (fermeture décidée par le jeu, ou juste avant un gestionnaire). */
  close(): void {
    window.clearTimeout(this.armTimer);
    if (this.listening) {
      window.removeEventListener("keydown", this.onKeyDown, true);
      window.removeEventListener("keyup", this.onKeyUp, true);
      this.listening = false;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.root.contains(active)) active.blur();
    this.resetTouch();
    this.root.hidden = true;
    this.root.classList.remove("armed");
    this.root.replaceChildren();
    this.card = null;
    this.handlers = null;
  }

  private armed(): boolean {
    return this.visible && performance.now() >= this.armedAt;
  }

  // Construction.

  /** Canvas d'une tuile, jamais déjà placé ailleurs (un canvas déplacé quitterait son premier emplacement). */
  private tileCanvas(t: number): HTMLCanvasElement {
    const c = this.tile(t);
    if (!c.parentNode) return c;
    const copy = document.createElement("canvas");
    copy.width = c.width;
    copy.height = c.height;
    const g = copy.getContext("2d");
    if (g) {
      g.imageSmoothingEnabled = false;
      g.drawImage(c, 0, 0);
    }
    return copy;
  }

  private head(c: TrayContent): HTMLDivElement {
    const head = document.createElement("div");
    head.className = "letter-tray-head";
    const face = this.face();
    face.classList.add("letter-tray-face");
    face.setAttribute("aria-hidden", "true");
    const title = document.createElement("h2");
    title.textContent = c.title;
    head.append(face, title);
    if (c.keyboardLine !== null) {
      const kb = document.createElement("p");
      kb.className = "letter-tray-keyboard";
      kb.textContent = c.keyboardLine;
      head.appendChild(kb);
    }
    if (c.speaker) {
      const speaker = document.createElement("button");
      speaker.type = "button";
      speaker.className = "letter-tray-speaker";
      speaker.setAttribute("aria-label", "Répète");
      speaker.innerHTML = SPEAKER_SVG;
      head.appendChild(speaker);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "letter-tray-close";
    close.setAttribute("aria-label", "Fermer");
    close.textContent = "✕";
    head.appendChild(close);
    return head;
  }

  private model(m: TrayModel | null): HTMLDivElement | null {
    if (!m || m.letters.length === 0) return null;
    const box = document.createElement("div");
    box.className = "letter-tray-model";
    for (const group of trayModelCells(m)) {
      const syllable = document.createElement("span");
      syllable.className = "tray-syllable";
      for (const cell of group) syllable.appendChild(this.modelLetter(cell));
      box.appendChild(syllable);
    }
    return box;
  }

  private modelLetter(cell: TrayCell): HTMLSpanElement {
    const span = document.createElement("span");
    span.className = `tray-letter ${cell.state}`;
    span.setAttribute("role", "img");
    if (cell.letter !== null) {
      span.dataset.letter = cell.letter;
      span.setAttribute("aria-label", `lettre ${cell.letter}`);
      const t = this.tileCanvas(Tile.LetterA + LETTERS.indexOf(cell.letter));
      t.setAttribute("aria-hidden", "true");
      span.appendChild(t);
    } else {
      span.setAttribute("aria-label", "case vide");
    }
    return span;
  }

  private grid(c: TrayContent): HTMLDivElement {
    const grid = document.createElement("div");
    grid.className = "letter-tray-grid";
    for (let k = 0; k < LETTERS.length; k++) {
      const ch = LETTERS.charAt(k);
      const key = document.createElement("button");
      key.type = "button";
      key.className = "tray-key";
      key.dataset.letter = ch;
      key.setAttribute("aria-label", `lettre ${ch}`);
      if (c.glow && c.expected === ch) key.classList.add("glow");
      const t = this.tileCanvas(Tile.LetterA + k);
      t.setAttribute("aria-hidden", "true");
      key.appendChild(t);
      grid.appendChild(key);
    }
    return grid;
  }

  /** Repère du bouton qui a le focus, pour le retrouver après un remplacement du contenu. */
  private focusKey(el: HTMLElement): string | null {
    if (el.classList.contains("tray-key")) {
      const ch = el.dataset.letter;
      return ch ? `.tray-key[data-letter="${ch}"]` : null;
    }
    if (el.classList.contains("letter-tray-speaker")) return ".letter-tray-speaker";
    if (el.classList.contains("letter-tray-close")) return ".letter-tray-close";
    return null;
  }

  private restoreFocus(selector: string): void {
    const el = this.card?.querySelector(selector);
    if (el instanceof HTMLElement) el.focus();
  }

  // Gestes.

  /** Cible qui agit, à partir de l'élément touché ou cliqué (null : rien, ou hors de la boîte). */
  private actionTarget(t: EventTarget | null): Element | null {
    if (!(t instanceof Element)) return null;
    const el = t.closest(ACTIONABLE);
    return el && this.root.contains(el) ? el : null;
  }

  /** Exécute l'action d'une cible : un seul gestionnaire ; pick et close ferment la boîte avant d'appeler le jeu. */
  private act(el: Element): void {
    const h = this.handlers;
    if (!h) return;
    const ch = el.getAttribute("data-letter");
    if (el.classList.contains("tray-key")) {
      if (ch === null) return;
      this.close();
      h.pick(ch);
    } else if (el.classList.contains("tray-letter")) {
      if (ch !== null) h.sayLetter(ch);
    } else if (el.classList.contains("letter-tray-speaker")) {
      h.repeat();
    } else {
      // Croix ou voile.
      this.close();
      h.close();
    }
  }

  private onTouch(e: TouchEvent): void {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (!this.visible) return;
    const now = performance.now();
    switch (e.type) {
      case "touchstart": {
        this.lastTouchAt = now;
        if (this.touchId !== null || !this.armed()) return;
        const t = e.changedTouches[0];
        if (!t) return;
        this.touchId = t.identifier;
        this.touchX = t.clientX;
        this.touchY = t.clientY;
        this.touchTarget = this.actionTarget(t.target);
        this.touchTarget?.classList.add("pressed");
        return;
      }
      case "touchmove": {
        const t = this.retained(e);
        if (t && this.touchTarget && Math.hypot(t.clientX - this.touchX, t.clientY - this.touchY) > TRAY_SLOP_PX) {
          // Glissé : ce doigt n'agira plus (il reste retenu jusqu'à ce qu'il se lève).
          this.touchTarget.classList.remove("pressed");
          this.touchTarget = null;
        }
        return;
      }
      case "touchend": {
        this.lastTouchAt = now;
        const t = this.retained(e);
        if (!t) return;
        const start = this.touchTarget;
        const moved = Math.hypot(t.clientX - this.touchX, t.clientY - this.touchY);
        this.resetTouch();
        if (!this.armed()) return;
        // Le doigt se lève-t-il sur une autre cible (lettre voisine) ? La cible d'un touchend reste celle du départ :
        // on regarde sous le doigt.
        const end = this.actionTarget(document.elementFromPoint(t.clientX, t.clientY));
        const target = tapTarget(start, end, moved);
        if (target) this.act(target);
        return;
      }
      case "touchcancel": {
        if (this.retained(e)) this.resetTouch();
        return;
      }
    }
  }

  /** Le doigt retenu, s'il fait partie des doigts de cet événement. */
  private retained(e: TouchEvent): Touch | null {
    if (this.touchId === null) return null;
    for (const t of Array.from(e.changedTouches)) if (t.identifier === this.touchId) return t;
    return null;
  }

  private resetTouch(): void {
    this.touchTarget?.classList.remove("pressed");
    this.touchTarget = null;
    this.touchId = null;
  }

  private onClick(e: MouseEvent): void {
    e.stopPropagation();
    if (!this.armed()) return;
    // Clic de compatibilité juste après un toucher (déjà traité au lever du doigt). Un clic venu du clavier
    // (Entrée, Espace : detail = 0) passe toujours.
    if (e.detail !== 0 && performance.now() - this.lastTouchAt < GHOST_CLICK_MS) return;
    const el = this.actionTarget(e.target);
    if (el) this.act(el);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Le jeu ne voit aucune touche tant que la boîte est ouverte.
    e.stopPropagation();
    if (!this.visible) return;
    const action = trayKeyAction(e);
    switch (action.kind) {
      case "tab":
        this.cycleFocus(e);
        return;
      case "close": {
        e.preventDefault();
        if (e.repeat || !this.armed()) return;
        const h = this.handlers;
        this.close();
        h?.close();
        return;
      }
      case "pick": {
        e.preventDefault();
        if (e.repeat || !this.armed()) return;
        const h = this.handlers;
        this.close();
        h?.pick(action.ch);
        return;
      }
      case "pass":
        return;
    }
  };

  /** Relâchement : arrêté aussi (le clavier du jeu, en capture sur window avant nous, reste à jour). */
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    e.stopPropagation();
  };

  /**
   * Tab et Maj+Tab parcourent les boutons de la carte, en boucle, sans jamais repartir derrière le voile. Sans
   * bouton choisi, Tab va à la lettre A (Maj+Tab : Z).
   */
  private cycleFocus(e: KeyboardEvent): void {
    e.preventDefault();
    const card = this.card;
    if (!card) return;
    const buttons = Array.from(card.querySelectorAll("button")).filter((b) => !b.disabled);
    const keys = buttons.filter((b) => b.classList.contains("tray-key"));
    const active = document.activeElement;
    const i = active instanceof HTMLButtonElement ? buttons.indexOf(active) : -1;
    const n = buttons.length;
    const next = i < 0 ? (e.shiftKey ? keys[keys.length - 1] : keys[0]) : buttons[(i + (e.shiftKey ? n - 1 : 1)) % n];
    next?.focus();
  }
}
