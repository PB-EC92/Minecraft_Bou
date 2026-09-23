/**
 * Synthèse vocale du navigateur (Web Speech API). Sert à lire les consignes
 * au lecteur débutant.
 *
 * Points d'attention (audit J0) :
 * - le jeu doit marcher hors ligne : on préfère les voix LOCALES
 *   (`localService`), les voix « en ligne » d'Edge exigent internet ;
 * - les voix arrivent parfois tard (événement `voiceschanged`, fréquent sur
 *   Android) : on écoute cet événement en continu ;
 * - Chrome peut ne jamais signaler la fin d'une lecture si l'objet phrase
 *   est libéré par le ramasse-miettes : on garde une référence, et un délai
 *   de secours termine l'attente.
 */

/** Sous-ensemble de SpeechSynthesisVoice utile au choix (permet de tester sans navigateur). */
export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
}

/**
 * Choisit la voix : préférence explicite, sinon voix française locale (fr-FR
 * d'abord), sinon voix française en ligne, sinon null (le navigateur prendra
 * sa voix par défaut pour fr-FR).
 */
export function chooseVoice<V extends VoiceInfo>(voices: readonly V[], preferredUri: string | null): V | null {
  if (preferredUri) {
    const v = voices.find((x) => x.voiceURI === preferredUri);
    if (v) return v;
  }
  const fr = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("fr"));
  const isFrFr = (v: V) => v.lang.toLowerCase().replace("_", "-") === "fr-fr";
  return (
    fr.find((v) => v.localService && isFrFr(v)) ??
    fr.find((v) => v.localService) ??
    fr.find((v) => isFrFr(v)) ??
    fr[0] ??
    null
  );
}

/** Délai de secours pour une lecture : large, proportionnel à la longueur du texte (ms). */
export function speechTimeoutMs(text: string): number {
  return Math.min(60_000, 4_000 + text.length * 150);
}

export class Speech {
  readonly supported: boolean;
  private voices: SpeechSynthesisVoice[] = [];
  private readonly ready: Promise<SpeechSynthesisVoice[]>;
  private readonly changeHandlers: ((voices: SpeechSynthesisVoice[]) => void)[] = [];
  /** Phrase en cours : référence conservée pour éviter la perte de l'événement de fin. */
  private current: SpeechSynthesisUtterance | null = null;
  /** Voix choisie explicitement (mode parent / panneau de tests). */
  preferredVoiceUri: string | null = null;

  constructor() {
    this.supported = typeof window !== "undefined" && "speechSynthesis" in window;
    this.ready = this.loadVoices();
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.supported) return Promise.resolve([]);
    const refresh = () => {
      this.voices = speechSynthesis.getVoices();
      for (const h of this.changeHandlers) h(this.voices);
    };
    speechSynthesis.addEventListener("voiceschanged", refresh);
    return new Promise((resolve) => {
      const now = speechSynthesis.getVoices();
      if (now.length > 0) {
        this.voices = now;
        resolve(now);
        return;
      }
      speechSynthesis.addEventListener("voiceschanged", () => resolve(this.voices), { once: true });
      setTimeout(() => resolve(this.voices), 2000);
    });
  }

  whenReady(): Promise<SpeechSynthesisVoice[]> {
    return this.ready;
  }

  /** Appelé à chaque arrivée ou changement de la liste des voix. */
  onVoicesChanged(h: (voices: SpeechSynthesisVoice[]) => void): void {
    this.changeHandlers.push(h);
  }

  allVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  frenchVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  }

  pickVoice(): SpeechSynthesisVoice | null {
    return chooseVoice(this.voices, this.preferredVoiceUri);
  }

  /** Lit une phrase (interrompt la précédente). Résout à la fin, en cas d'erreur, ou après le délai de secours. */
  speak(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<{ ok: boolean; error?: string }> {
    if (!this.supported) return Promise.resolve({ ok: false, error: "speechSynthesis indisponible" });
    return new Promise((resolve) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      this.current = u;
      u.lang = "fr-FR";
      const v = this.pickVoice();
      if (v) u.voice = v;
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.05;
      let settled = false;
      const finish = (r: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (this.current === u) this.current = null;
        resolve(r);
      };
      const timer = window.setTimeout(
        () => finish({ ok: false, error: "fin de lecture jamais signalée (délai de secours atteint)" }),
        speechTimeoutMs(text),
      );
      u.onend = () => finish({ ok: true });
      u.onerror = (e) => finish({ ok: false, error: e.error });
      speechSynthesis.speak(u);
    });
  }

  stop(): void {
    if (this.supported) speechSynthesis.cancel();
  }
}
