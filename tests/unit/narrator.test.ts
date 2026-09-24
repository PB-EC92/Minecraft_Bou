import { describe, expect, it } from "vitest";
import { Narrator, REPEAT_MS, type NarratorDeps } from "../../src/edu/Narrator";

function harness() {
  let time = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const shown: string[] = [];
  const spoken: string[] = [];
  const deps: NarratorDeps = {
    show: (t) => shown.push(t),
    speak: (t) => spoken.push(t),
    now: () => time,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: time + ms, fn });
      return id;
    },
    clearTimer: (id) => void timers.delete(id),
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
  return { n: new Narrator(deps), shown, spoken, advance };
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
});
