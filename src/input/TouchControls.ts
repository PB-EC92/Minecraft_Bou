export type TouchMode = "break" | "place";

/**
 * Contrôles tactiles rudimentaires (J0) :
 * - moitié gauche : joystick virtuel qui apparaît sous le doigt ;
 * - moitié droite : glisser pour regarder, tapoter pour agir (casser ou poser
 *   selon le mode) ;
 * - boutons : Sauter, bascule Casser/Poser.
 * J3 raffinera (taille, zones, retours visuels).
 */
export class TouchControls {
  static isTouchDevice(): boolean {
    return (navigator.maxTouchPoints ?? 0) > 0 || "ontouchstart" in window;
  }

  /** Vecteur de déplacement [-1, 1] : x = latéral, z = avant (+) / arrière (-). */
  moveX = 0;
  moveZ = 0;
  yawDelta = 0;
  pitchDelta = 0;
  jumpPressed = false;
  mode: TouchMode = "break";

  readonly root: HTMLDivElement;
  private readonly joystick: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly modeButton: HTMLButtonElement;

  private moveTouchId: number | null = null;
  private moveOriginX = 0;
  private moveOriginY = 0;

  private lookTouchId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private lookStartX = 0;
  private lookStartY = 0;
  private lookStartTime = 0;
  private lookMoved = false;

  private readonly actionHandlers: ((mode: TouchMode) => void)[] = [];
  private readonly radius = 48;
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
      this.updateModeButton();
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
    jump.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.jumpPressed = false;
    });

    buttons.appendChild(this.modeButton);
    buttons.appendChild(jump);
    this.root.appendChild(buttons);
    parent.appendChild(this.root);

    parent.addEventListener("touchstart", (e) => this.onStart(e), { passive: false });
    parent.addEventListener("touchmove", (e) => this.onMove(e), { passive: false });
    parent.addEventListener("touchend", (e) => this.onEnd(e), { passive: false });
    parent.addEventListener("touchcancel", (e) => this.onEnd(e), { passive: false });
  }

  enable(on: boolean): void {
    this.root.classList.toggle("enabled", on);
  }

  onAction(h: (mode: TouchMode) => void): void {
    this.actionHandlers.push(h);
  }

  consumeLook(): { yaw: number; pitch: number } {
    const r = { yaw: this.yawDelta, pitch: this.pitchDelta };
    this.yawDelta = 0;
    this.pitchDelta = 0;
    return r;
  }

  private updateModeButton(): void {
    this.modeButton.textContent = this.mode === "break" ? "Casser" : "Poser";
    this.modeButton.classList.toggle("on", this.mode === "place");
  }

  private isUiTarget(t: EventTarget | null): boolean {
    return t instanceof Element && (t.closest(".touch-btn, .btn, .panel, .hotbar") !== null);
  }

  private onStart(e: TouchEvent): void {
    if (this.isUiTarget(e.target)) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const leftHalf = t.clientX < window.innerWidth / 2;
      if (leftHalf && this.moveTouchId === null) {
        this.moveTouchId = t.identifier;
        this.moveOriginX = t.clientX;
        this.moveOriginY = t.clientY;
        this.joystick.style.left = `${t.clientX}px`;
        this.joystick.style.top = `${t.clientY}px`;
        this.joystick.classList.add("active");
        this.setKnob(0, 0);
      } else if (!leftHalf && this.lookTouchId === null) {
        this.lookTouchId = t.identifier;
        this.lookLastX = this.lookStartX = t.clientX;
        this.lookLastY = this.lookStartY = t.clientY;
        this.lookStartTime = performance.now();
        this.lookMoved = false;
      }
    }
  }

  private onMove(e: TouchEvent): void {
    if (this.isUiTarget(e.target)) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveTouchId) {
        let dx = t.clientX - this.moveOriginX;
        let dy = t.clientY - this.moveOriginY;
        const len = Math.hypot(dx, dy);
        if (len > this.radius) {
          dx = (dx / len) * this.radius;
          dy = (dy / len) * this.radius;
        }
        this.setKnob(dx, dy);
        this.moveX = dx / this.radius;
        this.moveZ = -dy / this.radius;
      } else if (t.identifier === this.lookTouchId) {
        const dx = t.clientX - this.lookLastX;
        const dy = t.clientY - this.lookLastY;
        this.lookLastX = t.clientX;
        this.lookLastY = t.clientY;
        this.yawDelta -= dx * this.lookSensitivity;
        this.pitchDelta -= dy * this.lookSensitivity;
        if (Math.hypot(t.clientX - this.lookStartX, t.clientY - this.lookStartY) > 12) this.lookMoved = true;
      }
    }
  }

  private onEnd(e: TouchEvent): void {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.moveX = 0;
        this.moveZ = 0;
        this.joystick.classList.remove("active");
      } else if (t.identifier === this.lookTouchId) {
        this.lookTouchId = null;
        const quick = performance.now() - this.lookStartTime < 300;
        if (quick && !this.lookMoved) {
          for (const h of this.actionHandlers) h(this.mode);
        }
      }
    }
  }

  private setKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}
