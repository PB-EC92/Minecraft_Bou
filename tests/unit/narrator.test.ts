import { describe, expect, it } from "vitest";
import { Narrator, readingMs, REPEAT_MS, speechMs, type NarratorDeps } from "../../src/edu/Narrator";

function harness(canSpeak?: () => boolean) {
  let time = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const shown: string[] = [];
  const durations: number[] = [];
  const spoken: string[] = [];
  const deps: NarratorDeps = {
    show: (t, ms) => {
      shown.push(t);
      durations.push(ms);
    },
    speak: (t) => spoken.push(t),
    now: () => time,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: time + ms, fn });
      return id;
    },
    clearTimer: (id) => void timers.delete(id),
    ...(canSpeak ? { canSpeak } : {}),
  };
  const advance = (ms: number) => {
    time += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= time) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { n: new Narrator(deps), shown, spoken, advance, durations, pendingTimers: () => timers.size };
}

const T = { debutant: "Trois pierres !", autonome: "Tu as ramassé une pierre. Tu en as 3." };

describe("Narrator", () => {
  it("débutant : affiche et lit la variante courte", () => {
    const h = harness();
    h.n.tell(T);
    expect(h.shown).toEqual(["Trois pierres !"]);
    expect(h.spoken).toEqual(["Trois pierres !"]);
  });

  it("autonome : affiche la variante complète, voix coupée par défaut", () => {
    const h = harness();
    h.n.setLevel("autonome");
    h.n.tell(T);
    expect(h.shown).toEqual([T.autonome]);
    expect(h.spoken).toEqual([]);
    h.n.voice = true;
    h.n.tell({ debutant: "a", autonome: "b" });
    expect(h.spoken).toEqual(["b"]);
  });

  it("lit la version parlée quand elle est fournie", () => {
    const h = harness();
    h.n.tell({ debutant: "3 pierres !", autonome: "x" }, { spoken: { debutant: "Trois pierres !", autonome: "y" } });
    expect(h.shown).toEqual(["3 pierres !"]);
    expect(h.spoken).toEqual(["Trois pierres !"]);
  });

  it("lecture différée : seule la dernière est lue", () => {
    const h = harness();
    h.n.tell({ debutant: "Une pierre !", autonome: "" }, { voiceDelayMs: 500 });
    h.advance(200);
    h.n.tell({ debutant: "2 pierres !", autonome: "" }, { voiceDelayMs: 500 });
    h.advance(200);
    expect(h.spoken).toEqual([]);
    h.advance(400);
    expect(h.spoken).toEqual(["2 pierres !"]);
    expect(h.shown).toEqual(["Une pierre !", "2 pierres !"]);
  });

  it("refus ou conseil (dedupe) : pas relu à l'identique avant le délai de répétition", () => {
    const h = harness();
    const t = { debutant: "Pas de place !", autonome: "" };
    h.n.tell(t, { dedupe: true });
    h.advance(REPEAT_MS - 1);
    h.n.tell(t, { dedupe: true });
    expect(h.spoken).toHaveLength(1);
    h.advance(1);
    h.n.tell(t, { dedupe: true });
    expect(h.spoken).toHaveLength(2);
    expect(h.shown).toHaveLength(3); // l'affichage, lui, suit toujours
  });

  it("un compte identique redevenu vrai est relu (pas d'anti-répétition sans dedupe)", () => {
    const h = harness();
    const t = { debutant: "Deux blocs d'herbe !", autonome: "" };
    h.n.tell(t);
    h.advance(1000);
    h.n.tell(t);
    expect(h.spoken).toEqual([t.debutant, t.debutant]);
  });

  it("snooze repousse la lecture en attente tant qu'on le rappelle", () => {
    const h = harness();
    h.n.tell({ debutant: "Trois pierres !", autonome: "" }, { voiceDelayMs: 500 });
    expect(h.n.hasPending).toBe(true);
    for (let i = 0; i < 10; i++) {
      h.advance(100);
      h.n.snooze(500);
    }
    expect(h.spoken).toEqual([]);
    h.advance(499);
    expect(h.spoken).toEqual([]);
    h.advance(1);
    expect(h.spoken).toEqual(["Trois pierres !"]);
    expect(h.n.hasPending).toBe(false);
    h.n.snooze(500); // rien en attente : sans effet
    h.advance(1000);
    expect(h.spoken).toHaveLength(1);
  });

  it("option voice: false et annulation d'une lecture en attente", () => {
    const h = harness();
    h.n.tell(T, { voice: false });
    expect(h.spoken).toEqual([]);
    h.n.tell(T, { voiceDelayMs: 300 });
    h.n.cancelPending();
    h.advance(1000);
    expect(h.spoken).toEqual([]);
  });

  it("couper la voix pendant une lecture différée l'empêche", () => {
    const h = harness();
    h.n.tell(T, { voiceDelayMs: 300 });
    h.n.voice = false;
    h.advance(1000);
    expect(h.spoken).toEqual([]);
  });

  it("laisse le temps de lire : un long message autonome reste affiché plus longtemps", () => {
    const h = harness();
    h.n.setLevel("autonome");
    const long = "Vise un bloc avec la croix et appuie longtemps pour le casser."; // 12 mots
    h.n.tell({ debutant: "Appuie longtemps !", autonome: long }, { ms: 2000 });
    expect(h.durations[0]).toBe(readingMs(long, "autonome"));
    expect(h.durations[0]).toBeGreaterThanOrEqual(5000);
    h.n.tell({ debutant: "a", autonome: "Court." }, { ms: 3000 });
    expect(h.durations[1]).toBe(3000); // la durée demandée reste un minimum
  });

  it("readingMs : croît avec le nombre de mots, plafonnée", () => {
    expect(readingMs("Trois pierres !", "debutant")).toBeLessThan(readingMs("Tu as ramassé une pierre. Tu en as 3.", "autonome"));
    expect(readingMs("mot ".repeat(100), "autonome")).toBe(9000);
  });
});

describe("consignes importantes (J5)", () => {
  const PIXEL = { debutant: "Ramasse quatre pierres.", autonome: "Casse des pierres grises pour en ramasser quatre." };
  it("une phrase ordinaire ne coupe pas une consigne importante : elle est affichée, pas lue", () => {
    const h = harness();
    h.n.tell(PIXEL, { important: true });
    h.advance(500);
    h.n.tell(T);
    expect(h.shown).toEqual([PIXEL.debutant, T.debutant]);
    expect(h.spoken).toEqual([PIXEL.debutant]);
    // Une fois la consigne lue, la voix revient.
    h.advance(speechMs(PIXEL.debutant));
    h.n.tell(T);
    expect(h.spoken).toEqual([PIXEL.debutant, T.debutant]);
  });
  it("une consigne importante peut en remplacer une autre", () => {
    const h = harness();
    h.n.tell(PIXEL, { important: true });
    h.n.tell(T, { important: true });
    expect(h.spoken).toEqual([PIXEL.debutant, T.debutant]);
  });

  it("say (J6) : lit sans afficher, suit le niveau et la voix, ne coupe pas une consigne importante sauf si elle l'est aussi", () => {
    const h = harness();
    h.n.say({ debutant: "Bravo !", autonome: "Bravo, mission réussie !" });
    expect(h.shown).toEqual([]);
    expect(h.spoken).toEqual(["Bravo !"]);
    h.n.tell({ debutant: "Consigne importante.", autonome: "x" }, { important: true });
    h.n.say({ debutant: "Pas maintenant.", autonome: "y" });
    expect(h.spoken).toEqual(["Bravo !", "Consigne importante."]);
    h.n.say({ debutant: "Félicitations.", autonome: "z" }, { important: true });
    expect(h.spoken.at(-1)).toBe("Félicitations.");
    h.n.setLevel("autonome"); // voix coupée par défaut
    h.n.say({ debutant: "a", autonome: "b" }, { important: true });
    expect(h.spoken.at(-1)).toBe("Félicitations.");
  });
});

describe("occupé, say différé (V2 lot 1)", () => {
  const PIXEL = { debutant: "Ramasse quatre pierres.", autonome: "Casse des pierres grises pour en ramasser quatre." };

  it("busy est vrai pendant une consigne importante, puis faux", () => {
    const h = harness();
    expect(h.n.busy).toBe(false);
    h.n.tell(T); // phrase ordinaire : pas occupé
    expect(h.n.busy).toBe(false);
    h.n.tell(PIXEL, { important: true });
    expect(h.n.busy).toBe(true);
    h.advance(speechMs(PIXEL.debutant) - 1);
    expect(h.n.busy).toBe(true);
    h.advance(1);
    expect(h.n.busy).toBe(false);
  });

  it("voix coupée : une consigne importante n'est pas lue, donc rien n'est occupé", () => {
    const h = harness();
    h.n.voice = false;
    h.n.tell(PIXEL, { important: true });
    expect(h.n.busy).toBe(false);
  });

  it("say différé : programmé, puis remplacé par le suivant", () => {
    const h = harness();
    h.n.say({ debutant: "Quatre planches !", autonome: "a" }, { voiceDelayMs: 500 });
    expect(h.n.hasPending).toBe(true);
    expect(h.spoken).toEqual([]);
    h.advance(300);
    h.n.say({ debutant: "Six planches !", autonome: "b" }, { voiceDelayMs: 500 });
    h.advance(300);
    expect(h.spoken).toEqual([]);
    h.advance(200);
    expect(h.spoken).toEqual(["Six planches !"]);
    expect(h.shown).toEqual([]); // say n'affiche rien
    expect(h.n.hasPending).toBe(false);
  });

  it("say différé : une lecture immédiate (tell) le remplace aussi", () => {
    const h = harness();
    h.n.say({ debutant: "Quatre planches !", autonome: "a" }, { voiceDelayMs: 500 });
    h.n.tell(T);
    h.advance(1000);
    expect(h.spoken).toEqual([T.debutant]);
  });

  it("voix coupée : say ne fait rien, avec ou sans délai", () => {
    const h = harness();
    h.n.setLevel("autonome");
    h.n.say({ debutant: "a", autonome: "b" });
    h.n.say({ debutant: "c", autonome: "d" }, { voiceDelayMs: 300 });
    expect(h.n.hasPending).toBe(false);
    h.advance(1000);
    expect(h.spoken).toEqual([]);
  });

  it("say sans délai : comportement du J6 (immédiat)", () => {
    const h = harness();
    h.n.say({ debutant: "Bravo !", autonome: "x" }, { voiceDelayMs: 0 });
    expect(h.spoken).toEqual(["Bravo !"]);
  });
});

describe("dictée de la mission 2 (V2 lot 1)", () => {
  const PIXEL = { debutant: "Écris le mot.", autonome: "Pixel va te dicter un mot : écris-le avec les lettres." };
  const WORD = "Écris le mot : lampe. La lampe éclaire ton abri. Lampe.";

  it("renvoie faux sans rien faire sans canSpeak (absent ou faux)", () => {
    const absent = harness();
    expect(absent.n.dictate(WORD)).toBe(false);
    expect(absent.spoken).toEqual([]);
    expect(absent.n.busy).toBe(false);
    const no = harness(() => false);
    expect(no.n.dictate(WORD)).toBe(false);
    no.advance(10_000);
    expect(no.spoken).toEqual([]);
  });

  it("lit même voix coupée (lecteur autonome), par speak (journalisé), sans rien afficher", () => {
    const h = harness(() => true);
    h.n.setLevel("autonome"); // voix coupée par défaut
    expect(h.n.voice).toBe(false);
    expect(h.n.dictate(WORD)).toBe(true);
    expect(h.spoken).toEqual([WORD]);
    expect(h.shown).toEqual([]);
  });

  it("compte comme une consigne importante : occupé pendant sa lecture, une phrase ordinaire ne la coupe pas", () => {
    const h = harness(() => true);
    h.n.dictate(WORD);
    expect(h.n.busy).toBe(true);
    h.n.tell(T);
    expect(h.spoken).toEqual([WORD]);
    h.advance(speechMs(WORD));
    expect(h.n.busy).toBe(false);
  });

  it("sans anti-répétition : la même dictée est relue aussitôt la précédente finie", () => {
    const h = harness(() => true);
    h.n.dictate("Lampe.");
    h.advance(speechMs("Lampe."));
    h.n.dictate("Lampe.");
    expect(h.spoken).toEqual(["Lampe.", "Lampe."]);
  });

  it("attend sans la couper la fin d'une consigne importante en cours", () => {
    const h = harness(() => true);
    h.n.tell(PIXEL, { important: true });
    expect(h.n.dictate(WORD)).toBe(true);
    expect(h.spoken).toEqual([PIXEL.debutant]);
    h.advance(speechMs(PIXEL.debutant) - 1);
    expect(h.spoken).toEqual([PIXEL.debutant]);
    h.advance(1);
    expect(h.spoken).toEqual([PIXEL.debutant, WORD]);
    expect(h.n.busy).toBe(true);
  });

  it("une seule dictée attend : la suivante la remplace", () => {
    const h = harness(() => true);
    h.n.tell(PIXEL, { important: true });
    h.n.dictate("Écoute bien : lampe.");
    h.n.dictate("Écoute bien : pierre.");
    h.advance(10_000);
    expect(h.spoken).toEqual([PIXEL.debutant, "Écoute bien : pierre."]);
  });

  it("une phrase ordinaire ou un say différé ne l'annulent pas ; cancelPending l'annule", () => {
    const h = harness(() => true);
    h.n.tell(PIXEL, { important: true });
    h.n.dictate(WORD);
    h.n.tell(T, { voiceDelayMs: 100 }); // remplace une lecture différée, pas la dictée
    h.advance(speechMs(PIXEL.debutant));
    expect(h.spoken).toEqual([PIXEL.debutant, WORD]);

    const c = harness(() => true);
    c.n.tell(PIXEL, { important: true });
    c.n.dictate(WORD);
    c.n.cancelPending();
    expect(c.pendingTimers()).toBe(0);
    c.advance(10_000);
    expect(c.spoken).toEqual([PIXEL.debutant]);
  });

  it("une nouvelle consigne importante arrivée entre-temps repousse encore la dictée", () => {
    const h = harness(() => true);
    h.n.tell(PIXEL, { important: true });
    h.n.dictate(WORD);
    h.advance(speechMs(PIXEL.debutant) - 10);
    const NEXT = { debutant: "Encore une consigne.", autonome: "x" };
    h.n.tell(NEXT, { important: true });
    h.advance(10);
    expect(h.spoken).toEqual([PIXEL.debutant, NEXT.debutant]);
    h.advance(speechMs(NEXT.debutant));
    expect(h.spoken).toEqual([PIXEL.debutant, NEXT.debutant, WORD]);
  });
});
