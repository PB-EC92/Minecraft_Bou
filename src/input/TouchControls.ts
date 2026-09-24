import { newBreakPress, type BreakPress } from "./breakPress";
import { CLICK_MAX_MS } from "./mouseFilter";
import { inJoystickZone, joystickVector, type Point } from "./touchZones";

export type TouchMode = "break" | "place";

/**
 * Contrôles tactiles (J0, casse par appui maintenu au J2, zones revues au J3) :
 * - rond fixe en bas à gauche : joystick ; seul un toucher qui commence sur lui
 *   (ou tout près, voir touchZones) fait marcher ;
 * - partout ailleurs : glisser pour regarder ; en mode Casser, garder le doigt
 *   immobile casse le bloc sous la croix (barre de progression) ; en mode Poser,
 *   tapoter pose ;
 * - boutons : Sauter, bascule Casser/Poser, plein écran.
 * Un nouveau doigt dans une zone déjà prise la reprend (doigt d'un autre enfant,
 * paume posée : le vrai doigt n'est plus bloqué).
 */
export class TouchControls {
  /**
   * Vrai si le pointeur PRINCIPAL est un doigt (tablette, convertible replié).
   * Un PC à écran tactile répond non (pointeur principal = souris/pavé) :
   * son interface tactile n'apparaît qu'au premier toucher (voir Game).
   */
  static primaryPointerIsTouch(): boolean {
    if (typeof window.matchMedia === "function") return window.matchMedia("(pointer: coarse)").matches;
    return (navigator.maxTouchPoints ?? 0) > 0;
  }

  /** Vecteur de déplacement [-1, 1] : x = latéral, z = avant (+) / arrière (-). */
  moveX = 0;
  moveZ = 0;
  yawDelta = 0;
  pitchDelta = 0;
  jumpPressed = false;
  mode: TouchMode = "break";
  /** Appui « casser » en cours (doigt qui regarde, mode Casser), ou null. Lu à chaque image par le jeu. */
  breakPress: BreakPress | null = null;

  readonly root: HTMLDivElement;
  private readonly joystick: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly modeButton: HTMLButtonElement;
  private readonly fullscreenButton: HTMLButtonElement;

  private moveTouchId: number | null = null;
  /** Centre et rayon du rond, relevés au début du toucher (la mise en page peut changer ensuite). */
  private moveCenter: Point = { x: 0, y: 0 };
  private moveRadius = 0;

  private lookTouchId: number | null = null;
  /** Doigts remplacés par un nouveau doigt : s'ils sont encore posés quand le nouveau se lève, ils reprennent la main. */
  private prevMoveId: number | null = null;
  private prevLookId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private lookStartTime = 0;
  private lookMoved = false;

  private readonly actionHandlers: ((mode: TouchMode) => void)[] = [];
  private readonly releaseHandlers: ((press: BreakPress) => void)[] = [];
  private readonly modeHandlers: ((mode: TouchMode) => void)[] = [];
  private readonly fullscreenHandlers: (() => void)[] = [];
  /** Point de référence du doigt qui regarde : un déplacement au-delà de 12 px le déplace et reprend l'appui. */
  private anchorX = 0;
  private anchorY = 0;
  private readonly lookSensitivity = 0.005;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "touch";

    this.joystick = document.createElement("div");
    this.joystick.className = "joystick";
    this.knob = document.createElement("div");
    this.knob.className = "knob";
    this.joystick.appendChild(this.knob);
    this.root.appendChild(this.joystick);

    const buttons = document.createElement("div");
    buttons.className = "touch-buttons";

    this.modeButton = document.createElement("button");
    this.modeButton.className = "touch-btn";
    this.modeButton.type = "button";
    this.updateModeButton();
    this.modeButton.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.mode = this.mode === "break" ? "place" : "break";
      // Doigt qui regarde déjà posé et immobile : en passant en mode Casser, l'appui commence maintenant.
      this.breakPress =
        this.mode === "break" && this.lookTouchId !== null ? newBreakPress(performance.now(), true, this.lookMoved) : null;
      this.updateModeButton();
      for (const h of this.modeHandlers) h(this.mode);
    });

    const jump = document.createElement("button");
    jump.className = "touch-btn";
    jump.type = "button";
    jump.textContent = "Sauter";
    jump.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.jumpPressed = true;
    });
    const release = (e: TouchEvent) => {
      e.preventDefault();
      this.jumpPressed = false;
    };
    jump.addEventListener("touchend", release);
    jump.addEventListener("touchcancel", release);

    // Plein écran à la portée de l'enfant (J3) : hors plein écran, la barre des tâches de Windows et
    // les onglets du navigateur sont collés aux commandes. « click » et non « touchstart » : le
    // navigateur n'accorde le plein écran qu'à un geste terminé (doigt levé).
    this.fullscreenButton = document.createElement("button");
    this.fullscreenButton.className = "touch-btn fullscreen-btn";
    this.fullscreenButton.type = "button";
    this.fullscreenButton.setAttribute("aria-label", "Plein écran");
    this.fullscreenButton.title = "Plein écran";
    this.fullscreenButton.innerHTML =
      '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
      '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    this.fullscreenButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const h of this.fullscreenHandlers) h();
    });

    buttons.appendChild(this.modeButton);
    buttons.appendChild(jump);
    // Dernier dans l'ordre du document (le bouton de mode reste le premier .touch-btn), affiché en haut par le CSS.
    buttons.appendChild(this.fullscreenButton);
    this.root.appendChild(buttons);
    parent.appendChild(this.root);

    parent.addEventListener("touchstart", (e) => this.onStart(e), { passive: false });
    parent.addEventListener("touchmove", (e) => this.onMove(e), { passive: false });
    parent.addEventListener("touchend", (e) => this.onEnd(e), { passive: false });
    parent.addEventListener("touchcancel", (e) => this.onEnd(e), { passive: false });

    // Le jeu perd le focus (autre appli, geste de Windows depuis un bord) : un doigt levé pendant ce temps
    // ne nous parviendrait jamais ; sans remise à zéro, le personnage marcherait ou casserait tout seul.
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.reset();
    });
    document.addEventListener("fullscreenchange", () => this.updateFullscreenButton());
    this.updateFullscreenButton();
  }

  enable(on: boolean): void {
    this.root.classList.toggle("enabled", on);
  }

  /** Tapotement en mode Poser (le mode Casser passe par breakPress). */
  onAction(h: (mode: TouchMode) => void): void {
    this.actionHandlers.push(h);
  }

  /** Appelé à chaque changement de mode Casser / Poser (l'aide d'écran en dépend). */
  onModeChange(h: (mode: TouchMode) => void): void {
    this.modeHandlers.push(h);
  }

  /** Appelé quand le doigt qui cassait se lève (pas quand le toucher est annulé par le système). */
  onBreakRelease(h: (press: BreakPress) => void): void {
    this.releaseHandlers.push(h);
  }

  /** Bouton plein écran touché (le jeu bascule). */
  onFullscreenRequest(h: () => void): void {
    this.fullscreenHandlers.push(h);
  }

  consumeLook(): { yaw: number; pitch: number } {
    const r = { yaw: this.yawDelta, pitch: this.pitchDelta };
    this.yawDelta = 0;
    this.pitchDelta = 0;
    return r;
  }

  /** Oublie les doigts suivis, sans appeler les gestionnaires de relâchement (aucun geste de l'enfant). */
  reset(): void {
    this.endMove();
    this.lookTouchId = null;
    this.prevMoveId = null;
    this.prevLookId = null;
    this.breakPress = null;
    this.jumpPressed = false;
  }

  private updateModeButton(): void {
    this.modeButton.textContent = this.mode === "break" ? "Casser" : "Poser";
    this.modeButton.classList.toggle("on", this.mode === "place");
  }

  private updateFullscreenButton(): void {
    this.fullscreenButton.hidden = typeof document.fullscreenElement !== "undefined" && document.fullscreenElement !== null;
  }

  private isUiTarget(t: EventTarget | null): boolean {
    return t instanceof Element && t.closest(".touch-btn, .btn, .panel, .hotbar, .companion") !== null;
  }

  /** Centre et rayon du rond à l'écran (rayon nul s'il n'est pas affiché). */
  private joystickGeometry(): { center: Point; radius: number } {
    const r = this.joystick.getBoundingClientRect();
    return { center: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, radius: r.width / 2 };
  }

  private onStart(e: TouchEvent): void {
    if (this.isUiTarget(e.target)) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.isUiTarget(t.target)) continue;
      const p = { x: t.clientX, y: t.clientY };
      const { center, radius } = this.joystickGeometry();
      if (inJoystickZone(p, center, radius)) {
        // Un nouveau doigt sur le rond reprend le joystick.
        if (this.moveTouchId !== null) this.prevMoveId = this.moveTouchId;
        this.moveTouchId = t.identifier;
        this.moveCenter = center;
        this.moveRadius = radius;
        this.joystick.classList.add("active");
        this.updateMove(p);
      } else {
        // Un nouveau doigt ailleurs reprend le regard ; l'appui du doigt précédent est oublié sans casser.
        if (this.lookTouchId !== null) this.prevLookId = this.lookTouchId;
        this.lookTouchId = t.identifier;
        this.lookLastX = this.anchorX = t.clientX;
        this.lookLastY = this.anchorY = t.clientY;
        this.lookStartTime = performance.now();
        this.lookMoved = false;
        this.breakPress = this.mode === "break" ? newBreakPress(this.lookStartTime, true) : null;
      }
    }
  }

  private onMove(e: TouchEvent): void {
    if (this.isUiTarget(e.target)) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveTouchId) {
        this.updateMove({ x: t.clientX, y: t.clientY });
      } else if (t.identifier === this.lookTouchId) {
        const dx = t.clientX - this.lookLastX;
        const dy = t.clientY - this.lookLastY;
        this.lookLastX = t.clientX;
        this.lookLastY = t.clientY;
        this.yawDelta -= dx * this.lookSensitivity;
        this.pitchDelta -= dy * this.lookSensitivity;
        if (Math.hypot(t.clientX - this.anchorX, t.clientY - this.anchorY) > 12) {
          // Le doigt glisse : c'est un regard. S'il s'immobilise ensuite (viser puis tenir),
          // l'appui repart de là, avec une attente plus longue (voir breakPress).
          this.lookMoved = true;
          this.anchorX = t.clientX;
          this.anchorY = t.clientY;
          if (this.mode === "break") this.breakPress = newBreakPress(performance.now(), true, true);
        }
      }
    }
  }

  private onEnd(e: TouchEvent): void {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.prevMoveId) this.prevMoveId = null;
      if (t.identifier === this.prevLookId) this.prevLookId = null;
      if (t.identifier === this.moveTouchId) {
        this.endMove();
        const back = this.stillDown(e, this.prevMoveId);
        this.prevMoveId = null;
        if (back) {
          // Le pouce resté sur le rond reprend la marche.
          this.moveTouchId = back.identifier;
          this.joystick.classList.add("active");
          this.updateMove({ x: back.clientX, y: back.clientY });
        }
      } else if (t.identifier === this.lookTouchId) {
        this.lookTouchId = null;
        const press = this.breakPress;
        this.breakPress = null;
        if (press && e.type === "touchend") for (const h of this.releaseHandlers) h(press);
        // Seuil aligné sur le clic souris (450 ms) : un enfant de 6 ans tapote plus lentement
        // qu'un adulte (constat 12 de l'audit J0). Casser se fait par appui maintenu (J2).
        const quick = performance.now() - this.lookStartTime < CLICK_MAX_MS;
        if (quick && !this.lookMoved && this.mode === "place" && e.type === "touchend") {
          for (const h of this.actionHandlers) h(this.mode);
        }
        const back = this.stillDown(e, this.prevLookId);
        this.prevLookId = null;
        if (back) {
          // Le doigt resté posé reprend le regard ; un appui « casser » repart de sa position.
          this.lookTouchId = back.identifier;
          this.lookLastX = this.anchorX = back.clientX;
          this.lookLastY = this.anchorY = back.clientY;
          this.lookStartTime = performance.now();
          this.lookMoved = true;
          this.breakPress = this.mode === "break" ? newBreakPress(this.lookStartTime, true, true) : null;
        }
      }
    }
  }

  /** Le doigt id est-il encore posé (liste des doigts restants de l'événement) ? */
  private stillDown(e: TouchEvent, id: number | null): Touch | null {
    if (id === null) return null;
    return Array.from(e.touches).find((t) => t.identifier === id) ?? null;
  }

  private updateMove(p: Point): void {
    const v = joystickVector(p, this.moveCenter, this.moveRadius);
    this.moveX = v.x;
    this.moveZ = v.z;
    this.setKnob(v.knobX, v.knobY);
  }

  private endMove(): void {
    this.moveTouchId = null;
    this.moveX = 0;
    this.moveZ = 0;
    this.joystick.classList.remove("active");
    this.setKnob(0, 0);
  }

  private setKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}
