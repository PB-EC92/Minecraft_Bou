import { blockDef, HOTBAR_BLOCKS, type BlockId } from "../engine/blocks";
import { WORLD_TYPES, type WorldTypeId } from "../engine/terrain";
import { tileIcon } from "../render/textures";

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
 * Interface superposée au canvas : réticule, infos (images/s), message,
 * barre d'inventaire, écran de chargement, voile sous l'eau, panneau
 * « Tests » (réglages techniques du prototype). DOM natif, pas de framework.
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

  private readonly loading: HTMLDivElement;
  private readonly loadingText: HTMLDivElement;
  private readonly underwater: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private messageTimer = 0;
  private readonly selectHandlers: ((index: number) => void)[] = [];

  constructor(parent: HTMLElement, atlas: HTMLCanvasElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    this.underwater = this.div("underwater");
    this.root.appendChild(this.underwater);

    const crosshair = this.div("crosshair");
    this.root.appendChild(crosshair);

    this.info = this.div("info");
    this.root.appendChild(this.info);

    this.message = this.div("message");
    this.root.appendChild(this.message);

    this.hint = this.div("hint");
    this.root.appendChild(this.hint);

    this.hotbar = this.div("hotbar");
    HOTBAR_BLOCKS.forEach((id, i) => {
      const slot = this.div("slot");
      slot.title = blockDef(id).name;
      slot.appendChild(tileIcon(atlas, blockDef(id).tiles.side));
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const select = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        for (const h of this.selectHandlers) h(i);
      };
      slot.addEventListener("mousedown", select);
      slot.addEventListener("touchstart", select, { passive: false });
      this.hotbar.appendChild(slot);
      this.slots.push(slot);
    });
    this.root.appendChild(this.hotbar);

    this.loading = this.div("loading");
    this.loadingText = this.div("loading-text");
    this.loading.appendChild(this.loadingText);
    this.root.appendChild(this.loading);

    // ---------- Panneau « Tests » ----------
    this.panelToggle = this.button("Tests");
    this.panelToggle.classList.add("panel-toggle");
    this.root.appendChild(this.panelToggle);

    this.panel = this.div("panel");
    this.panel.appendChild(this.title("Prototype J1 — tests techniques"));

    const rowScreen = this.row();
    this.fullscreenButton = this.button("Plein écran");
    this.lockButton = this.button("Capturer la souris");
    rowScreen.append(this.fullscreenButton, this.lockButton);
    this.panel.appendChild(rowScreen);

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
    this.voiceText.value = "Bonjour ! Je suis ton compagnon. Bienvenue dans Cubes. Ramasse six bois et quatre pierres.";
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
