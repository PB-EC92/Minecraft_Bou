/**
 * Synthèse vocale du navigateur (Web Speech API). Sert à lire les consignes
 * au lecteur débutant. Les voix arrivent parfois de façon asynchrone
 * (événement voiceschanged) : on attend jusqu'à 2 s.
 */
export class Speech {
  readonly supported: boolean;
  private voices: SpeechSynthesisVoice[] = [];
  private ready: Promise<SpeechSynthesisVoice[]>;
  /** Voix choisie explicitement (mode parent / panneau J0). */
  preferredVoiceUri: string | null = null;

  constructor() {
    this.supported = typeof window !== "undefined" && "speechSynthesis" in window;
    this.ready = this.loadVoices();
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.supported) return Promise.resolve([]);
    return new Promise((resolve) => {
      const done = () => {
        this.voices = speechSynthesis.getVoices();
        resolve(this.voices);
      };
      const now = speechSynthesis.getVoices();
      if (now.length > 0) {
        this.voices = now;
        resolve(now);
        return;
      }
      speechSynthesis.addEventListener("voiceschanged", done, { once: true });
      setTimeout(done, 2000);
    });
  }

  whenReady(): Promise<SpeechSynthesisVoice[]> {
    return this.ready;
  }

  allVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  frenchVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
  }

  /** Meilleure voix française disponible : préférence explicite, sinon fr-FR, sinon fr-*. */
  pickVoice(): SpeechSynthesisVoice | null {
    if (this.preferredVoiceUri) {
      const v = this.voices.find((x) => x.voiceURI === this.preferredVoiceUri);
      if (v) return v;
    }
    const fr = this.frenchVoices();
    return fr.find((v) => v.lang.toLowerCase() === "fr-fr") ?? fr[0] ?? null;
  }

  /** Lit une phrase (interrompt la précédente). Résout quand la lecture est finie ou a échoué. */
  speak(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<{ ok: boolean; error?: string }> {
    if (!this.supported) return Promise.resolve({ ok: false, error: "speechSynthesis indisponible" });
    return new Promise((resolve) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      const v = this.pickVoice();
      if (v) u.voice = v;
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.05;
      u.onend = () => resolve({ ok: true });
      u.onerror = (e) => resolve({ ok: false, error: e.error });
      speechSynthesis.speak(u);
    });
  }

  stop(): void {
    if (this.supported) speechSynthesis.cancel();
  }
}
