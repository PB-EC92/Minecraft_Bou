import { blockDef, type BlockId } from "../engine/blocks";
import { GAME_NAME } from "../game/identity";
import { INVENTORY_SLOTS, type Stack } from "../engine/inventory";
import { WORLD_TYPES, type WorldTypeId } from "../engine/terrain";
import { READING_LEVELS } from "../edu/texts";
import { tileIcon } from "../render/textures";
import { slotHoldMoved, startSlotHold, type SlotHold, type SlotHoldSource } from "../input/slotHold";
import { nearestSlot } from "./nearestSlot";

/** Distances de rendu proposées dans le panneau (blocs). */
export const RENDER_DISTANCES = [32, 48, 64, 96, 128] as const;

/** Heures proposées dans le panneau. */
export const HOUR_PRESETS: readonly { label: string; hour: number }[] = [
  { label: "Matin", hour: 8 },
  { label: "Midi", hour: 12 },
  { label: "Soir", hour: 18 },
  { label: "Nuit", hour: 23 },
];

/**
 * Interface superposée au canvas : réticule et anneau de casse, infos
 * (images/s), message, barre d'inventaire à 9 cases avec compteurs (J2),
 * écran de chargement, voile sous l'eau, panneau « Tests » (réglages du
 * prototype). DOM natif, pas de framework.
 *
 * V2 lot 1 : appui long sur une case (souris libre ou doigt) pour la vider. La
 * barre suit l'appui (début, glissé, relâchement) ; le jeu lit `slotHold` à
 * chaque image, décide (blocs gardés) et règle l'anneau par setSlotHoldProgress.
 */
export class Hud {
  readonly root: HTMLDivElement;
  readonly info: HTMLDivElement;
  readonly message: HTMLDivElement;
  readonly hotbar: HTMLDivElement;
  readonly panel: HTMLDivElement;
  readonly panelToggle: HTMLButtonElement;
  readonly hint: HTMLDivElement;
  readonly diag: HTMLDivElement;
  readonly voiceSelect: HTMLSelectElement;
  readonly voiceText: HTMLTextAreaElement;
  readonly voiceResult: HTMLDivElement;
  readonly speakButton: HTMLButtonElement;
  readonly fullscreenButton: HTMLButtonElement;
  readonly lockButton: HTMLButtonElement;
  readonly worldTypeSelect: HTMLSelectElement;
  readonly seedInput: HTMLInputElement;
  readonly newWorldButton: HTMLButtonElement;
  readonly hourButtons: HTMLButtonElement[] = [];
  readonly fastTimeButton: HTMLButtonElement;
  readonly distanceSelect: HTMLSelectElement;
  readonly levelSelect: HTMLSelectElement;
  readonly voiceToggle: HTMLInputElement;
  readonly soundToggle: HTMLInputElement;
  readonly fillBagButton: HTMLButtonElement;
  readonly clearBagButton: HTMLButtonElement;

  private readonly breakRing: HTMLDivElement;
  private readonly slotName: HTMLDivElement;
  private slotNameTimer = 0;
  /** Contenu affiché de chaque case (pour ne redessiner que ce qui change). */
  private readonly shown: (Stack | null)[] = [];
  private readonly icons = new Map<BlockId, HTMLCanvasElement>();
  private readonly loading: HTMLDivElement;
  private readonly loadingText: HTMLDivElement;
  private readonly underwater: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private messageTimer = 0;
  private readonly selectHandlers: ((index: number) => void)[] = [];
  /** Appui long en cours sur une case (souris ou doigt), ou null (V2). */
  private hold: SlotHold | null = null;
  /** Anneau de l'appui long, au-dessus de la case tenue, et l'icône de son bloc (sœur de l'anneau, hors du masque). */
  private readonly holdEl: HTMLDivElement;
  private readonly holdIcon: HTMLCanvasElement;
  private holdIconId: BlockId | null = null;
  /** Case qui porte la classe .holding (-1 : aucune). */
  private holdShownSlot = -1;

  constructor(
    parent: HTMLElement,
    private readonly atlas: HTMLCanvasElement,
    version: string,
  ) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    this.underwater = this.div("underwater");
    this.root.appendChild(this.underwater);

    const crosshair = this.div("crosshair");
    this.root.appendChild(crosshair);
    this.breakRing = this.div("break-ring");
    this.root.appendChild(this.breakRing);

    this.info = this.div("info");
    this.root.appendChild(this.info);

    this.message = this.div("message");
    this.root.appendChild(this.message);

    this.hint = this.div("hint");
    this.root.appendChild(this.hint);

    this.slotName = this.div("slot-name");
    this.root.appendChild(this.slotName);

    this.hotbar = this.div("hotbar");
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slot = this.div("slot empty");
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const count = document.createElement("span");
      count.className = "count";
      slot.appendChild(count);
      this.shown.push(null);
      slot.addEventListener("animationend", () => slot.classList.remove("pulse"));
      this.hotbar.appendChild(slot);
      this.slots.push(slot);
    }
    // Toute la barre choisit une case, marges et espaces compris : la plus proche du doigt ou du clic (J3).
    // Annuler l'événement empêche aussi le menu contextuel du navigateur sur un appui long.
    const selectAt = (x: number): number => {
      const i = nearestSlot(
        x,
        this.slots.map((s) => {
          const r = s.getBoundingClientRect();
          return r.left + r.width / 2;
        }),
      );
      if (i >= 0) for (const h of this.selectHandlers) h(i);
      return i;
    };
    // Après la sélection, un appui gardé sur une case pleine commence l'appui long (V2) : bouton gauche seulement
    // (le clic droit ne fait que choisir), ou le doigt qui vient de se poser.
    this.hotbar.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = selectAt(e.clientX);
      if (i >= 0 && e.button === 0) this.beginHold(i, "mouse", e.clientX, e.clientY, null);
    });
    this.hotbar.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const t = e.changedTouches[0];
        if (!t) return;
        const i = selectAt(t.clientX);
        if (i >= 0) this.beginHold(i, "touch", t.clientX, t.clientY, t.identifier);
      },
      { passive: false },
    );
    // Fin de l'appui long : doigt levé ou annulé par le système, doigt ou souris qui glisse (l'enfant regardait
    // ou visait), bouton relâché, fenêtre qui perd le focus. Les touchers visent la case de départ et remontent
    // jusqu'à la barre ; la souris est suivie sur toute la fenêtre, en capture.
    const fingerUp = (e: TouchEvent) => {
      const h = this.hold;
      if (h?.source !== "touch") return;
      for (const t of Array.from(e.changedTouches)) if (t.identifier === h.pointer) this.cancelSlotHold();
    };
    this.hotbar.addEventListener("touchend", fingerUp);
    this.hotbar.addEventListener("touchcancel", fingerUp);
    // Le glissé est consommé : sans cela, Chromium n'envoie plus que le premier touchmove d'un toucher non annulé
    // (la barre ne défile jamais, rien n'est perdu).
    this.hotbar.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const h = this.hold;
        if (h?.source !== "touch") return;
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === h.pointer && slotHoldMoved(h, t.clientX, t.clientY)) this.cancelSlotHold();
        }
      },
      { passive: false },
    );
    window.addEventListener(
      "mousemove",
      (e) => {
        const h = this.hold;
        if (h?.source === "mouse" && slotHoldMoved(h, e.clientX, e.clientY)) this.cancelSlotHold();
      },
      true,
    );
    window.addEventListener(
      "mouseup",
      (e) => {
        if (e.button === 0 && this.hold?.source === "mouse") this.cancelSlotHold();
      },
      true,
    );
    window.addEventListener("blur", () => this.cancelSlotHold());
    this.root.appendChild(this.hotbar);

    // Anneau de l'appui long (V2) : au-dessus de la case tenue, pour que le doigt ne le cache pas.
    this.holdEl = this.div("slot-hold");
    this.holdEl.setAttribute("aria-hidden", "true");
    this.holdEl.appendChild(this.div("slot-hold-ring"));
    this.holdIcon = document.createElement("canvas");
    this.holdIcon.width = this.holdIcon.height = 16;
    this.holdEl.appendChild(this.holdIcon);
    this.root.appendChild(this.holdEl);

    this.loading = this.div("loading");
    this.loadingText = this.div("loading-text");
    this.loading.appendChild(this.loadingText);
    this.root.appendChild(this.loading);

    // ---------- Panneau « Tests » ----------
    this.panelToggle = this.button("Tests");
    this.panelToggle.classList.add("panel-toggle");
    this.root.appendChild(this.panelToggle);

    this.panel = this.div("panel");
    this.panel.appendChild(this.title(`${GAME_NAME} ${version} — réglages de test`));

    const rowScreen = this.row();
    this.fullscreenButton = this.button("Plein écran");
    this.lockButton = this.button("Capturer la souris");
    rowScreen.append(this.fullscreenButton, this.lockButton);
    this.panel.appendChild(rowScreen);

    this.panel.appendChild(this.title("Jeu"));
    const rowLevel = this.row();
    const levelLabel = document.createElement("label");
    levelLabel.textContent = "Lecture ";
    this.levelSelect = document.createElement("select");
    this.levelSelect.setAttribute("aria-label", "Niveau de lecture");
    for (const l of READING_LEVELS) {
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = l.name;
      this.levelSelect.appendChild(o);
    }
    levelLabel.appendChild(this.levelSelect);
    rowLevel.appendChild(levelLabel);
    this.panel.appendChild(rowLevel);
    const rowToggles = this.row();
    this.voiceToggle = this.checkbox("Lire les messages à voix haute", rowToggles);
    this.soundToggle = this.checkbox("Sons", rowToggles);
    this.panel.appendChild(rowToggles);
    const rowBag = this.row();
    this.fillBagButton = this.button("Compléter le sac (20 de chaque)");
    this.clearBagButton = this.button("Vider le sac");
    rowBag.append(this.fillBagButton, this.clearBagButton);
    this.panel.appendChild(rowBag);

    this.panel.appendChild(this.title("Monde"));
    const rowWorld = this.row();
    this.worldTypeSelect = document.createElement("select");
    this.worldTypeSelect.setAttribute("aria-label", "Type de monde");
    for (const t of WORLD_TYPES) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      this.worldTypeSelect.appendChild(o);
    }
    this.seedInput = document.createElement("input");
    this.seedInput.type = "number";
    this.seedInput.min = "1";
    this.seedInput.max = "999999";
    this.seedInput.placeholder = "graine (vide = au hasard)";
    this.seedInput.setAttribute("aria-label", "Graine");
    this.newWorldButton = this.button("Nouveau monde");
    rowWorld.append(this.worldTypeSelect, this.seedInput, this.newWorldButton);
    this.panel.appendChild(rowWorld);

    this.panel.appendChild(this.title("Heure"));
    const rowTime = this.row();
    for (const p of HOUR_PRESETS) {
      const b = this.button(p.label);
      this.hourButtons.push(b);
      rowTime.appendChild(b);
    }
    this.fastTimeButton = this.button("Temps ×20");
    rowTime.appendChild(this.fastTimeButton);
    this.panel.appendChild(rowTime);

    this.panel.appendChild(this.title("Distance de rendu"));
    const rowDist = this.row();
    this.distanceSelect = document.createElement("select");
    this.distanceSelect.setAttribute("aria-label", "Distance de rendu");
    for (const d of RENDER_DISTANCES) {
      const o = document.createElement("option");
      o.value = String(d);
      o.textContent = `${d} blocs`;
      this.distanceSelect.appendChild(o);
    }
    rowDist.appendChild(this.distanceSelect);
    this.panel.appendChild(rowDist);

    this.panel.appendChild(this.title("Voix (synthèse vocale)"));
    this.voiceSelect = document.createElement("select");
    this.voiceSelect.setAttribute("aria-label", "Voix");
    this.panel.appendChild(this.voiceSelect);
    this.voiceText = document.createElement("textarea");
    this.voiceText.value = `Bonjour ! Je suis ton compagnon. Bienvenue dans ${GAME_NAME}. Ramasse six bois et quatre pierres.`;
    this.panel.appendChild(this.voiceText);
    const rowVoice = this.row();
    this.speakButton = this.button("Tester la voix");
    rowVoice.appendChild(this.speakButton);
    this.panel.appendChild(rowVoice);
    this.voiceResult = this.div("");
    this.panel.appendChild(this.voiceResult);

    this.panel.appendChild(this.title("Diagnostic"));
    this.diag = this.div("diag");
    this.panel.appendChild(this.diag);

    this.root.appendChild(this.panel);

    this.panelToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.panel.classList.toggle("open");
    });

    // Empêche les interactions du panneau de déclencher le jeu (clavier compris : saisie de la graine).
    for (const ev of ["mousedown", "mouseup", "touchstart", "touchend", "touchmove", "keydown", "keyup"]) {
      this.panel.addEventListener(ev, (e) => e.stopPropagation());
    }

    parent.appendChild(this.root);
  }

  private div(className: string): HTMLDivElement {
    const d = document.createElement("div");
    if (className) d.className = className;
    return d;
  }

  private row(): HTMLDivElement {
    return this.div("row");
  }

  private title(text: string): HTMLHeadingElement {
    const h = document.createElement("h2");
    h.textContent = text;
    return h;
  }

  private checkbox(label: string, parent: HTMLElement): HTMLInputElement {
    const l = document.createElement("label");
    l.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    l.append(input, document.createTextNode(` ${label}`));
    parent.appendChild(l);
    return input;
  }

  private button(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = label;
    return b;
  }

  onSelectSlot(h: (index: number) => void): void {
    this.selectHandlers.push(h);
  }

  setSelectedSlot(index: number): void {
    this.slots.forEach((s, i) => s.classList.toggle("selected", i === index));
  }

  /**
   * Met à jour les cases de la barre (icône, compteur) ; seules celles qui ont changé sont redessinées. Un appui
   * long sur une case qui se vide ou change de bloc est annulé (une pile dont on a chipé une partie, non).
   */
  setInventory(stacks: readonly (Stack | null)[]): void {
    this.slots.forEach((el, i) => {
      const next = stacks[i] ?? null;
      const prev = this.shown[i] ?? null;
      if (this.hold?.slot === i && next?.id !== prev?.id) this.cancelSlotHold();
      if (prev?.id === next?.id && prev?.count === next?.count) return;
      this.shown[i] = next ? { ...next } : null;
      if (prev?.id !== next?.id) {
        el.querySelector("canvas")?.remove();
        if (next) el.prepend(this.icon(next.id));
      }
      el.classList.toggle("empty", next === null);
      el.title = next ? blockDef(next.id).name : "case vide";
      const count = el.querySelector(".count");
      if (count) count.textContent = next ? String(next.count) : "";
    });
  }

  /** Petite animation sur une case qui vient de recevoir un bloc. */
  pulseSlot(index: number): void {
    const el = this.slots[index];
    if (!el) return;
    el.classList.remove("pulse");
    void el.offsetWidth; // relance l'animation
    el.classList.add("pulse");
  }

  /** Nom du bloc tenu, affiché brièvement au-dessus de la barre (entraînement à la lecture). */
  showSlotName(text: string, durationMs = 1800): void {
    this.slotName.textContent = text;
    this.slotName.classList.add("visible");
    window.clearTimeout(this.slotNameTimer);
    this.slotNameTimer = window.setTimeout(() => this.slotName.classList.remove("visible"), durationMs);
  }

  /** Anneau de casse autour du réticule : progression [0, 1], ou null pour le masquer. */
  setBreakProgress(progress: number | null): void {
    const on = progress !== null && progress > 0;
    this.breakRing.classList.toggle("visible", on);
    if (on) this.breakRing.style.setProperty("--p", progress.toFixed(3));
  }

  /** Appui long en cours sur une case de la barre (souris ou doigt), ou null (V2). */
  get slotHold(): SlotHold | null {
    return this.hold;
  }

  /** Oublie l'appui long en cours et masque l'anneau (pause, case changée, case vidée…). */
  cancelSlotHold(): void {
    this.hold = null;
    this.setSlotHoldProgress(null);
  }

  /**
   * Anneau de l'appui long au-dessus d'une case : progression ]0, 1], ou null pour le masquer. Le jeu l'appelle à
   * chaque image (appui à la souris, au doigt ou à la touche 1 à 9), seulement pour une case qu'il peut vider.
   */
  setSlotHoldProgress(s: { slot: number; progress: number } | null): void {
    const el = s ? this.slots[s.slot] : undefined;
    const stack = s ? (this.shown[s.slot] ?? null) : null;
    if (!s || !el || !stack) {
      if (this.holdShownSlot >= 0) this.slots[this.holdShownSlot]?.classList.remove("holding");
      this.holdShownSlot = -1;
      this.holdEl.classList.remove("visible");
      this.root.classList.remove("slot-holding");
      return;
    }
    if (this.holdShownSlot !== s.slot) {
      if (this.holdShownSlot >= 0) this.slots[this.holdShownSlot]?.classList.remove("holding");
      el.classList.add("holding");
      this.holdShownSlot = s.slot;
    }
    if (this.holdIconId !== stack.id) {
      this.holdIconId = stack.id;
      const g = this.holdIcon.getContext("2d");
      if (g) {
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, 16, 16);
        g.drawImage(this.iconBase(stack.id), 0, 0, 16, 16);
      }
    }
    const r = el.getBoundingClientRect();
    const origin = this.root.getBoundingClientRect();
    this.holdEl.style.left = `${Math.round(r.left + r.width / 2 - origin.left)}px`;
    this.holdEl.style.setProperty("--p", Math.min(1, Math.max(0, s.progress)).toFixed(3));
    this.holdEl.classList.add("visible");
    this.root.classList.add("slot-holding");
  }

  /** Commence un appui long sur la case i si elle n'est pas vide (pas la case ABC de la mission 2). */
  private beginHold(i: number, source: SlotHoldSource, x: number, y: number, pointer: number | null): void {
    if (i >= INVENTORY_SLOTS || !this.shown[i]) return;
    this.hold = startSlotHold(i, performance.now(), source, x, y, pointer);
  }

  /** Icône 16 × 16 d'un bloc, dessinée une fois. */
  private iconBase(id: BlockId): HTMLCanvasElement {
    let base = this.icons.get(id);
    if (!base) {
      base = tileIcon(this.atlas, blockDef(id).tiles.side);
      this.icons.set(id, base);
    }
    return base;
  }

  private icon(id: BlockId): HTMLCanvasElement {
    const base = this.iconBase(id);
    // Chaque case a son propre canvas (un élément DOM ne peut être à deux endroits).
    const c = document.createElement("canvas");
    c.width = base.width;
    c.height = base.height;
    c.getContext("2d")?.drawImage(base, 0, 0);
    return c;
  }

  /** Panneau « Tests » et ligne d'infos techniques : pour l'adulte, masqués pendant les parties des enfants (J7). */
  setDevTools(on: boolean): void {
    this.info.hidden = !on;
    this.panelToggle.hidden = !on;
    this.root.classList.toggle("no-devtools", !on);
    if (!on) this.panel.classList.remove("open");
  }

  setInfo(text: string): void {
    this.info.textContent = text;
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  setDiagnostics(text: string): void {
    this.diag.textContent = text;
  }

  setWorldControls(type: WorldTypeId, seed: number): void {
    this.worldTypeSelect.value = type;
    this.seedInput.value = String(seed);
  }

  setDistance(blocks: number): void {
    this.distanceSelect.value = String(blocks);
  }

  setFastTime(on: boolean): void {
    this.fastTimeButton.classList.toggle("on", on);
    this.fastTimeButton.textContent = on ? "Temps normal" : "Temps ×20";
  }

  /** Écran « Construction du monde… » ; null pour le masquer. */
  setLoading(progress: number | null): void {
    this.loading.classList.toggle("visible", progress !== null);
    if (progress !== null) this.loadingText.textContent = `Construction du monde… ${Math.round(progress * 100)} %`;
  }

  setUnderwater(on: boolean): void {
    this.underwater.classList.toggle("visible", on);
  }

  setVoices(voices: SpeechSynthesisVoice[], selectedUri: string | null): void {
    this.voiceSelect.innerHTML = "";
    if (voices.length === 0) {
      const o = document.createElement("option");
      o.textContent = "Aucune voix disponible";
      this.voiceSelect.appendChild(o);
      return;
    }
    for (const v of voices) {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = `${v.name} (${v.lang})${v.localService ? "" : " — en ligne"}`;
      if (v.voiceURI === selectedUri) o.selected = true;
      this.voiceSelect.appendChild(o);
    }
  }

  showMessage(text: string, durationMs = 2500): void {
    this.message.textContent = text;
    this.message.classList.add("visible");
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove("visible"), durationMs);
  }

  blockName(id: BlockId): string {
    return blockDef(id).name;
  }
}
