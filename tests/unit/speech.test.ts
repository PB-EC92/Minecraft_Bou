import { describe, expect, it } from "vitest";
import { chooseVoice, speechTimeoutMs, type VoiceInfo } from "../../src/edu/speech";

const v = (voiceURI: string, lang: string, localService: boolean): VoiceInfo => ({ voiceURI, name: voiceURI, lang, localService });

describe("choix de la voix (audit J0, constat 6)", () => {
  const onlineFr = v("Denise Online", "fr-FR", false);
  const localFrCa = v("Sylvie", "fr-CA", true);
  const localFr = v("Hortense", "fr-FR", true);
  const en = v("Zira", "en-US", true);

  it("préfère une voix française locale (hors ligne) à une voix en ligne", () => {
    expect(chooseVoice([onlineFr, localFrCa, localFr, en], null)).toBe(localFr);
  });

  it("prend une autre variante locale du français avant une voix en ligne", () => {
    expect(chooseVoice([onlineFr, localFrCa, en], null)).toBe(localFrCa);
  });

  it("se rabat sur une voix française en ligne, puis sur rien", () => {
    expect(chooseVoice([en, onlineFr], null)).toBe(onlineFr);
    expect(chooseVoice([en], null)).toBeNull();
  });

  it("respecte le choix explicite s'il existe encore", () => {
    expect(chooseVoice([onlineFr, localFr], "Denise Online")).toBe(onlineFr);
    expect(chooseVoice([localFr], "voix disparue")).toBe(localFr);
  });

  it("reconnaît les codes de langue écrits avec un tiret bas (Android)", () => {
    const android = v("fr_FR local", "fr_FR", true);
    expect(chooseVoice([onlineFr, android], null)).toBe(android);
  });
});

describe("délai de secours de lecture (audit J0, constat 7)", () => {
  it("laisse largement le temps de lire, sans attendre indéfiniment", () => {
    expect(speechTimeoutMs("Bonjour")).toBeGreaterThan(4000);
    expect(speechTimeoutMs("x".repeat(10_000))).toBe(60_000);
  });
});
