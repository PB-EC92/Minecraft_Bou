import { blockDef, HOTBAR_BLOCKS, type BlockId } from "../engine/blocks";
import { tileIcon } from "../render/textures";

/**
 * Interface superposée au canvas : réticule, infos (FPS), message, barre
 * d'inventaire, panneau de tests J0. DOM natif, pas de framework.
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

  private slots: HTMLDivElement[] = [];
  private messageTimer = 0;
  private readonly selectHandlers: ((index: number) => void)[] = [];

  constructor(parent: HTMLElement, atlas: HTMLCanvasElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    const crosshair = document.createElement("div");
    crosshair.className = "crosshair";
    this.root.appendChild(crosshair);

    this.info = document.createElement("div");
    this.info.className = "info";
    this.root.appendChild(this.info);

    this.message = document.createElement("div");
    this.message.className = "message";
    this.root.appendChild(this.message);

    this.hint = document.createElement("div");
    this.hint.className = "hint";
    this.root.appendChild(this.hint);

    this.hotbar = document.createElement("div");
    this.hotbar.className = "hotbar";
    HOTBAR_BLOCKS.forEach((id, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.title = blockDef(id).name;
      const icon = tileIcon(atlas, blockDef(id).tiles.side);
      slot.appendChild(icon);
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

    // Panneau de tests J0
    this.panelToggle = document.createElement("button");
    this.panelToggle.className = "btn panel-toggle";
    this.panelToggle.type = "button";
    this.panelToggle.textContent = "Tests J0";
    this.root.appendChild(this.panelToggle);

    this.panel = document.createElement("div");
    this.panel.className = "panel";
    this.panel.innerHTML = `<h2>Prototype J0 — tests techniques</h2>`;

    const row1 = document.createElement("div");
    row1.className = "row";
    this.fullscreenButton = this.button("Plein écran");
    this.lockButton = this.button("Capturer la souris");
    row1.append(this.fullscreenButton, this.lockButton);
    this.panel.appendChild(row1);

    const voiceTitle = document.createElement("h2");
    voiceTitle.textContent = "Voix (synthèse vocale)";
    this.panel.appendChild(voiceTitle);
    this.voiceSelect = document.createElement("select");
    this.panel.appendChild(this.voiceSelect);
    this.voiceText = document.createElement("textarea");
    this.voiceText.value = "Bonjour ! Je suis ton compagnon. Bienvenue dans Cubes. Ramasse six bois et quatre pierres.";
    this.panel.appendChild(this.voiceText);
    const row2 = document.createElement("div");
    row2.className = "row";
    this.speakButton = this.button("Tester la voix");
    row2.appendChild(this.speakButton);
    this.panel.appendChild(row2);
    this.voiceResult = document.createElement("div");
    this.panel.appendChild(this.voiceResult);

    const diagTitle = document.createElement("h2");
    diagTitle.textContent = "Diagnostic";
    this.panel.appendChild(diagTitle);
    this.diag = document.createElement("div");
    this.diag.className = "diag";
    this.panel.appendChild(this.diag);

    this.root.appendChild(this.panel);

    const toggle = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.panel.classList.toggle("open");
    };
    this.panelToggle.addEventListener("click", toggle);

    // Empêche les interactions du panneau de déclencher le jeu.
    for (const ev of ["mousedown", "mouseup", "touchstart", "touchend", "touchmove", "keydown"]) {
      this.panel.addEventListener(ev, (e) => e.stopPropagation());
    }

    parent.appendChild(this.root);
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
