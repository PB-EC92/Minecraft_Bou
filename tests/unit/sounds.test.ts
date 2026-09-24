import { describe, expect, it } from "vitest";
import { BLOCKS, BlockId } from "../../src/engine/blocks";
import {
  MATERIALS,
  MAX_VOICES,
  SOUND_NAMES,
  Sounds,
  UNLOCK_EVENTS,
  materialOf,
  recipe,
  recipeDuration,
  type AudioContextClass,
  type Layer,
  type Material,
} from "../../src/audio/sounds";

// ---------------------------------------------------------------------------
// Faux Web Audio minimal : enregistre les nœuds, les branchements et les
// automatisations, pour vérifier le lecteur sans navigateur.
// ---------------------------------------------------------------------------

interface ParamEvent {
  type: "set" | "linear" | "exp" | "target" | "cancel";
  value: number;
  time: number;
}

class FakeParam {
  value: number;
  events: ParamEvent[] = [];
  constructor(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number, t: number): this {
    this.events.push({ type: "set", value: v, time: t });
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push({ type: "linear", value: v, time: t });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    // Comme un vrai navigateur : 0 ou négatif est interdit.
    if (!(v > 0)) throw new RangeError("valeur non strictement positive");
    this.events.push({ type: "exp", value: v, time: t });
    return this;
  }
  setTargetAtTime(v: number, t: number, _c: number): this {
    this.events.push({ type: "target", value: v, time: t });
    this.value = v;
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.events.push({ type: "cancel", value: 0, time: t });
    return this;
  }
}

class FakeNode {
  connections: FakeNode[] = [];
  disconnected = false;
  connect(n: FakeNode): FakeNode {
    this.connections.push(n);
    return n;
  }
  disconnect(): void {
    this.disconnected = true;
    this.connections = [];
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

class FakeSource extends FakeNode {
  startedAt: number | null = null;
  offset = 0;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(t = 0, offset = 0): void {
    this.startedAt = t;
    this.offset = offset;
  }
  stop(t = 0): void {
    this.stoppedAt = t;
  }
}

class FakeOscillator extends FakeSource {
  type = "sine";
  frequency = new FakeParam(440);
}

class FakeBuffer {
  readonly length: number;
  private readonly data: Float32Array;
  constructor(len: number) {
    this.length = len;
    this.data = new Float32Array(len);
  }
  getChannelData(_ch: number): Float32Array {
    return this.data;
  }
}

class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
}

interface FakeOptions {
  /** État du contexte à sa création. */
  initialState?: string;
  /** Le constructeur lève. */
  throwOnCreate?: boolean;
  /** resume() rejette sans changer l'état. */
  resumeRejects?: boolean;
  /** resume() lève tout de suite (ancien navigateur). */
  resumeThrows?: boolean;
  /** createOscillator lève. */
  throwOnOscillator?: boolean;
}

class FakeContextBase {
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  bufferSources: FakeBufferSource[] = [];
  filters: FakeFilter[] = [];
  compressors: FakeCompressor[] = [];
  buffers: FakeBuffer[] = [];
  resumeCalls = 0;
  closeCalls = 0;
}

/** Fabrique un constructeur de faux contexte audio et la liste de ses instances. */
function fakeAudio(opts: FakeOptions = {}) {
  const instances: FakeContext[] = [];
  let constructed = 0;
  class FakeContext extends FakeContextBase {
    constructor() {
      super();
      constructed++;
      if (opts.throwOnCreate) throw new Error("création refusée");
      this.state = opts.initialState ?? "running";
      instances.push(this);
    }
    createGain(): FakeGain {
      const g = new FakeGain();
      this.gains.push(g);
      return g;
    }
    createOscillator(): FakeOscillator {
      if (opts.throwOnOscillator) throw new Error("oscillateur refusé");
      const o = new FakeOscillator();
      this.oscillators.push(o);
      return o;
    }
    createBufferSource(): FakeBufferSource {
      const s = new FakeBufferSource();
      this.bufferSources.push(s);
      return s;
    }
    createBiquadFilter(): FakeFilter {
      const f = new FakeFilter();
      this.filters.push(f);
      return f;
    }
    createDynamicsCompressor(): FakeCompressor {
      const c = new FakeCompressor();
      this.compressors.push(c);
      return c;
    }
    createBuffer(_channels: number, len: number, _rate: number): FakeBuffer {
      const b = new FakeBuffer(len);
      this.buffers.push(b);
      return b;
    }
    resume(): Promise<void> {
      this.resumeCalls++;
      if (opts.resumeThrows) throw new Error("resume impossible");
      if (opts.resumeRejects) return Promise.reject(new Error("refus"));
      this.state = "running";
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.closeCalls++;
      this.state = "closed";
      return Promise.resolve();
    }
  }
  return {
    ctor: FakeContext as unknown as AudioContextClass,
    instances,
    constructed: () => constructed,
  };
}

/** Faux Window : enregistre les écouteurs (type, options) et permet de les déclencher. */
function fakeWindow() {
  type Entry = { type: string; fn: () => void; opts: unknown };
  const winListeners: Entry[] = [];
  const docListeners: Entry[] = [];
  const doc = {
    visibilityState: "visible" as string,
    addEventListener(type: string, fn: () => void, opts?: unknown) {
      docListeners.push({ type, fn, opts });
    },
  };
  const win = {
    document: doc,
    addEventListener(type: string, fn: () => void, opts?: unknown) {
      winListeners.push({ type, fn, opts });
    },
  };
  const fire = (list: Entry[], type: string) => {
    for (const l of list) if (l.type === type) l.fn();
  };
  return {
    win: win as unknown as Window,
    doc,
    winListeners,
    docListeners,
    fireWin: (type: string) => fire(winListeners, type),
    fireDoc: (type: string) => fire(docListeners, type),
  };
}

/** Gain général : le gain branché sur le compresseur. */
function masterOf(ctx: FakeContextBase): FakeGain {
  const comp = ctx.compressors[0];
  const m = ctx.gains.find((g) => comp !== undefined && g.connections.includes(comp));
  if (!m) throw new Error("gain général introuvable");
  return m;
}

function unlocked(opts: FakeOptions = {}) {
  const audio = fakeAudio(opts);
  const sounds = new Sounds({ audioContext: audio.ctor });
  sounds.unlock();
  const ctx = audio.instances[0];
  if (!ctx) throw new Error("contexte non créé");
  return { sounds, ctx, audio };
}

/** Sources démarrées (oscillateurs + sources de tampon, hors échantillon muet de déblocage). */
function startedSources(ctx: FakeContextBase): FakeSource[] {
  return [...ctx.oscillators, ...ctx.bufferSources.filter((s) => (s.buffer?.length ?? 0) > 1)].filter(
    (s) => s.startedAt !== null,
  );
}

// ---------------------------------------------------------------------------

describe("materialOf", () => {
  const expected: Record<number, Material> = {
    [BlockId.Air]: "soft",
    [BlockId.Grass]: "soft",
    [BlockId.Dirt]: "soft",
    [BlockId.Stone]: "stone",
    [BlockId.Planks]: "wood",
    [BlockId.Sand]: "sand",
    [BlockId.Log]: "wood",
    [BlockId.Water]: "soft",
    [BlockId.Leaves]: "plant",
    [BlockId.FlowerRed]: "plant",
    [BlockId.FlowerYellow]: "plant",
    [BlockId.Snow]: "sand",
    [BlockId.Cactus]: "wood",
    [BlockId.Lamp]: "wood",
    [BlockId.Fence]: "wood",
    [BlockId.GlowStone]: "stone",
    [BlockId.Rainbow]: "stone",
  };

  it("couvre tous les blocs du registre avec la bonne matière", () => {
    for (const def of BLOCKS) {
      expect(expected[def.id], `bloc ${def.name} absent du tableau attendu`).toBeDefined();
      expect(materialOf(def.id), def.name).toBe(expected[def.id]);
    }
  });

  it("renvoie soft pour un identifiant inconnu", () => {
    expect(materialOf(200 as BlockId)).toBe("soft");
    expect(materialOf(-1 as BlockId)).toBe("soft");
    expect(materialOf(2.5 as BlockId)).toBe("soft");
    expect(materialOf(Number.NaN as BlockId)).toBe("soft");
  });
});

describe("recettes de sons", () => {
  const combos: { name: (typeof SOUND_NAMES)[number]; material: Material | undefined }[] = [];
  for (const name of SOUND_NAMES) {
    for (const material of [...MATERIALS, undefined]) combos.push({ name, material });
  }

  it("liste les dix sons et les cinq matières", () => {
    expect([...SOUND_NAMES].sort()).toEqual(["bravo", "break", "breakTick", "bubbles", "deny", "giggle", "night", "pickup", "place", "select"]);
    expect([...MATERIALS].sort()).toEqual(["plant", "sand", "soft", "stone", "wood"]);
  });

  it.each(combos)("$name / $material : couches valides, douces et courtes", ({ name, material }) => {
    const layers = recipe(name, material);
    expect(layers.length).toBeGreaterThan(0);
    for (const l of layers) {
      for (const v of [l.freq, l.delay, l.attack, l.duration, l.gain, l.freqEnd ?? 0, l.q ?? 1]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(l.freq).toBeGreaterThanOrEqual(40);
      expect(l.freq).toBeLessThanOrEqual(5000);
      if (l.freqEnd !== undefined) {
        expect(l.freqEnd).toBeGreaterThanOrEqual(40);
        expect(l.freqEnd).toBeLessThanOrEqual(5000);
      }
      if (l.q !== undefined) expect(l.q).toBeGreaterThan(0);
      expect(l.gain).toBeGreaterThan(0);
      expect(l.gain).toBeLessThanOrEqual(1);
      expect(l.duration).toBeGreaterThan(0);
      expect(l.duration).toBeLessThanOrEqual(0.4);
      expect(l.delay).toBeGreaterThanOrEqual(0);
      expect(l.delay + l.duration).toBeLessThanOrEqual(0.6);
      // Attaque non nulle (pas de clic) et plus courte que la couche.
      expect(l.attack).toBeGreaterThan(0);
      expect(l.attack).toBeLessThan(l.duration);
      if (l.kind === "tone") {
        expect(["sine", "triangle", "square"]).toContain(l.wave ?? "sine");
        if (l.wave === "square") expect(l.gain).toBeLessThanOrEqual(0.1);
      } else {
        expect(l.kind).toBe("noise");
      }
    }
    // Le son entier reste court.
    expect(recipeDuration(layers)).toBeLessThanOrEqual(0.4);
  });

  it("sans matière, utilise la matière soft", () => {
    for (const name of SOUND_NAMES) expect(recipe(name)).toEqual(recipe(name, "soft"));
  });

  it("colore le tic et la casse selon la matière (cinq bruits différents)", () => {
    const tickFreqs = new Set(MATERIALS.map((m) => recipe("breakTick", m)[0]?.freq));
    expect(tickFreqs.size).toBe(MATERIALS.length);
    const breakFreqs = new Set(MATERIALS.map((m) => recipe("break", m).find((l) => l.kind === "noise")?.freq));
    expect(breakFreqs.size).toBe(MATERIALS.length);
  });

  it("tic : un bruit filtré, plus court que la casse", () => {
    for (const m of MATERIALS) {
      const tick = recipe("breakTick", m);
      expect(tick.every((l) => l.kind === "noise")).toBe(true);
      expect(recipeDuration(tick)).toBeLessThan(recipeDuration(recipe("break", m)));
    }
  });

  it("casse : un bruit filtré et une tonalité grave", () => {
    for (const m of MATERIALS) {
      const layers = recipe("break", m);
      expect(layers.some((l) => l.kind === "noise")).toBe(true);
      const tone = layers.find((l) => l.kind === "tone");
      expect(tone).toBeDefined();
      expect(tone!.freq).toBeLessThan(400);
    }
  });

  it("pose : un « toc » triangle de 180 à 90 Hz et un clic", () => {
    const layers = recipe("place");
    const toc = layers.find((l) => l.kind === "tone");
    expect(toc).toMatchObject({ wave: "triangle", freq: 180, freqEnd: 90 });
    expect(layers.length).toBe(2);
    const click = layers.find((l) => l !== toc)!;
    expect(click.duration).toBeLessThan(0.05);
  });

  it("ramassage : deux « pop » sinus montants, le second après le premier", () => {
    const [a, b] = recipe("pickup");
    expect(a).toMatchObject({ kind: "tone", wave: "sine" });
    expect(b).toMatchObject({ kind: "tone", wave: "sine" });
    expect(a!.freq).toBeCloseTo(660, -2);
    expect(b!.freq).toBeCloseTo(990, -2);
    expect(b!.delay).toBeGreaterThan(a!.delay);
  });

  it("refus : deux notes sinus douces descendantes (330 puis 247 Hz)", () => {
    const [a, b] = recipe("deny");
    expect(a).toMatchObject({ kind: "tone", wave: "sine", freq: 330 });
    expect(b).toMatchObject({ kind: "tone", wave: "sine", freq: 247 });
    expect(b!.delay).toBeGreaterThan(a!.delay);
    // Pas effrayant : volume modéré, attaque qui n'est pas sèche.
    for (const l of [a!, b!]) {
      expect(l.gain).toBeLessThanOrEqual(0.3);
      expect(l.attack).toBeGreaterThanOrEqual(0.01);
    }
  });

  it("sélection : un clic très bref", () => {
    const layers = recipe("select");
    expect(layers.length).toBe(1);
    expect(recipeDuration(layers)).toBeLessThanOrEqual(0.05);
  });

  it("équilibre : le tic, qui se répète, reste plus faible que la casse de sa matière", () => {
    for (const m of MATERIALS) {
      const tick = recipe("breakTick", m)[0]!;
      const breakNoise = recipe("break", m).find((l) => l.kind === "noise")!;
      expect(tick.gain, m).toBeLessThan(breakNoise.gain);
    }
  });

  it("équilibre : les tonalités médiums et aiguës restent discrètes (gain ≤ 0,2)", () => {
    // Au-delà, ramassage et refus couvrent la casse et la pose (mesuré en rendu Web Audio réel).
    for (const name of ["pickup", "deny", "select"] as const) {
      for (const l of recipe(name)) expect(l.gain, name).toBeLessThanOrEqual(0.2);
    }
  });

  it("aucun son n'utilise de signal carré (sons doux)", () => {
    for (const name of SOUND_NAMES) {
      for (const m of MATERIALS) expect(recipe(name, m).some((l) => l.wave === "square")).toBe(false);
    }
  });

  it("renvoie un tableau neuf à chaque appel", () => {
    const a = recipe("break", "stone");
    a[0]!.gain = 99;
    a.push({ kind: "tone", freq: 1, delay: 0, attack: 0, duration: 1, gain: 1 });
    const b = recipe("break", "stone");
    expect(b[0]!.gain).not.toBe(99);
    expect(b.length).toBe(2);
  });

  it("nom ou matière inconnus : aucun son, ou matière soft", () => {
    expect(recipe("boum" as never)).toEqual([]);
    expect(recipe("break", "lave" as Material)).toEqual(recipe("break", "soft"));
    // Jamais une propriété héritée d'Object (valeurs NaN sinon).
    for (const m of ["toString", "constructor", "__proto__"]) {
      expect(recipe("break", m as Material), m).toEqual(recipe("break", "soft"));
    }
  });

  it("recipeDuration : fin de la couche la plus tardive, 0 sans couche", () => {
    const layers: Layer[] = [
      { kind: "tone", freq: 100, delay: 0, attack: 0.01, duration: 0.1, gain: 0.5 },
      { kind: "tone", freq: 100, delay: 0.2, attack: 0.01, duration: 0.15, gain: 0.5 },
    ];
    expect(recipeDuration(layers)).toBeCloseTo(0.35);
    expect(recipeDuration([])).toBe(0);
  });
});

describe("Sounds sans navigateur (Node)", () => {
  it("n'a pas de window dans ces tests", () => {
    expect(typeof window).toBe("undefined");
  });

  it("n'est pas disponible, état absent, valeurs par défaut", () => {
    const s = new Sounds();
    expect(s.available).toBe(false);
    expect(s.state).toBe("absent");
    expect(s.enabled).toBe(true);
    expect(s.volume).toBe(0.6);
  });

  it("unlock et play ne lèvent pas", () => {
    const s = new Sounds();
    expect(() => s.unlock()).not.toThrow();
    for (const name of SOUND_NAMES) {
      expect(() => s.play(name)).not.toThrow();
      expect(() => s.play(name, BlockId.Stone)).not.toThrow();
    }
    expect(s.state).toBe("absent");
  });

  it("reste absent même coupé", () => {
    const s = new Sounds();
    s.enabled = false;
    expect(s.state).toBe("absent");
  });

  it("borne le volume à [0, 1] et ignore une valeur non finie", () => {
    const s = new Sounds();
    s.volume = 2;
    expect(s.volume).toBe(1);
    s.volume = -1;
    expect(s.volume).toBe(0);
    s.volume = 0.3;
    s.volume = Number.NaN;
    expect(s.volume).toBe(0.3);
    s.volume = Number.POSITIVE_INFINITY;
    expect(s.volume).toBe(0.3);
  });

  it("attachUnlock sur une cible factice ne lève pas", () => {
    const s = new Sounds();
    const w = fakeWindow();
    expect(() => s.attachUnlock(w.win)).not.toThrow();
    expect(() => w.fireWin("pointerdown")).not.toThrow();
    expect(s.state).toBe("absent");
  });

  it("environnement explicite sans audio : absent", () => {
    const s = new Sounds({ audioContext: null });
    expect(s.available).toBe(false);
    expect(s.state).toBe("absent");
  });
});

describe("Sounds avec un contexte audio simulé", () => {
  it("ne crée le contexte qu'au premier geste (unlock), jamais avant", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    expect(s.available).toBe(true);
    expect(s.state).toBe("en attente d'un geste");
    s.play("select");
    expect(audio.constructed()).toBe(0);
    s.unlock();
    expect(audio.constructed()).toBe(1);
    expect(s.state).toBe("actif");
  });

  it("un seul contexte, même après plusieurs gestes", () => {
    const { sounds, audio } = unlocked();
    sounds.unlock();
    sounds.unlock();
    expect(audio.constructed()).toBe(1);
  });

  it("chaîne : gain général (volume) → compresseur → sortie", () => {
    const { ctx } = unlocked();
    expect(ctx.compressors.length).toBe(1);
    const comp = ctx.compressors[0]!;
    expect(comp.connections).toContain(ctx.destination);
    const master = masterOf(ctx);
    expect(master.gain.value).toBeCloseTo(0.6);
  });

  it("reprend un contexte créé suspendu (et joue un échantillon muet de déblocage)", () => {
    const { sounds, ctx } = unlocked({ initialState: "suspended" });
    expect(ctx.resumeCalls).toBe(1);
    expect(sounds.state).toBe("actif");
    const silent = ctx.bufferSources.find((b) => b.buffer?.length === 1);
    expect(silent?.startedAt).not.toBeNull();
    expect(silent?.connections).toContain(ctx.destination);
  });

  it("resume refusé : pas d'exception, état suspendu, nouvel essai au geste suivant", async () => {
    const { sounds, ctx } = unlocked({ initialState: "suspended", resumeRejects: true });
    await Promise.resolve();
    expect(sounds.state).toBe("suspendu");
    expect(() => sounds.unlock()).not.toThrow();
    expect(ctx.resumeCalls).toBe(2);
  });

  it("ne reprend pas un contexte déjà actif", () => {
    const { sounds, ctx } = unlocked();
    sounds.unlock();
    expect(ctx.resumeCalls).toBe(0);
  });

  it("joue chaque couche à travers une enveloppe branchée sur le gain général", () => {
    const { sounds, ctx } = unlocked();
    const master = masterOf(ctx);
    sounds.play("break", BlockId.Stone);
    const layers = recipe("break", "stone");
    const sources = startedSources(ctx);
    expect(sources.length).toBe(layers.length);
    for (const src of sources) {
      // source → (filtre) → enveloppe → gain général
      let node: FakeNode | undefined = src.connections[0];
      if (node instanceof FakeFilter) {
        expect(node.type).toBe("bandpass");
        node = node.connections[0];
      }
      expect(node).toBeInstanceOf(FakeGain);
      expect(node!.connections).toContain(master);
      expect(src.stoppedAt).not.toBeNull();
      expect(src.stoppedAt!).toBeGreaterThan(src.startedAt!);
    }
  });

  it("filtre le bruit selon la matière du bloc", () => {
    const { sounds, ctx } = unlocked();
    sounds.play("breakTick", BlockId.Stone);
    const expected = recipe("breakTick", "stone")[0]!;
    const filter = ctx.filters[0]!;
    expect(filter.frequency.events[0]).toMatchObject({ type: "set", value: expected.freq });
    expect(filter.Q.value).toBe(expected.q);
  });

  it("règle forme d'onde et glissement de fréquence des tonalités", () => {
    const { sounds, ctx } = unlocked();
    sounds.play("place");
    const osc = ctx.oscillators[0]!;
    expect(osc.type).toBe("triangle");
    expect(osc.frequency.events.map((e) => [e.type, e.value])).toEqual([
      ["set", 180],
      ["exp", 90],
    ]);
  });

  it("enveloppes sans clic : de 0,0001 au pic puis retour à 0,0001, jamais 0", () => {
    const { sounds, ctx } = unlocked();
    const master = masterOf(ctx);
    for (const name of SOUND_NAMES) sounds.play(name, BlockId.Log);
    const envelopes = ctx.gains.filter((g) => g !== master);
    expect(envelopes.length).toBeGreaterThan(0);
    for (const env of envelopes) {
      const ev = env.gain.events;
      expect(ev[0]).toMatchObject({ type: "set", value: 0.0001 });
      expect(ev[1]?.type).toBe("linear");
      expect(ev[1]!.value).toBeGreaterThan(0);
      expect(ev[1]!.value).toBeLessThanOrEqual(1);
      expect(ev[2]).toMatchObject({ type: "exp", value: 0.0001 });
      expect(ev[1]!.time).toBeGreaterThan(ev[0]!.time);
      expect(ev[2]!.time).toBeGreaterThan(ev[1]!.time);
    }
    // Toutes les rampes exponentielles (gains et fréquences) visent une valeur > 0.
    const params = [
      ...ctx.gains.map((g) => g.gain),
      ...ctx.oscillators.map((o) => o.frequency),
      ...ctx.filters.map((f) => f.frequency),
    ];
    for (const p of params) for (const e of p.events) if (e.type === "exp") expect(e.value).toBeGreaterThan(0);
  });

  it("respecte le délai de chaque couche", () => {
    const { sounds, ctx } = unlocked();
    ctx.currentTime = 10;
    sounds.play("pickup");
    const [a, b] = ctx.oscillators;
    expect(b!.startedAt! - a!.startedAt!).toBeCloseTo(recipe("pickup")[1]!.delay, 5);
    expect(a!.startedAt!).toBeGreaterThanOrEqual(10);
  });

  it("un seul tampon de bruit blanc, généré une fois pour tous les sons", () => {
    const { sounds, ctx } = unlocked();
    for (let i = 0; i < 5; i++) {
      sounds.play("breakTick", BlockId.Dirt);
      sounds.play("break", BlockId.Sand);
      ctx.currentTime += 1;
    }
    const noiseBuffers = ctx.buffers.filter((b) => b.length > 1);
    expect(noiseBuffers.length).toBe(1);
    const data = noiseBuffers[0]!.getChannelData(0);
    expect(data.some((v) => v !== 0)).toBe(true);
    expect(data.every((v) => v >= -1 && v <= 1)).toBe(true);
    for (const src of ctx.bufferSources.filter((b) => (b.buffer?.length ?? 0) > 1)) {
      expect(src.buffer).toBe(noiseBuffers[0]);
      // Le départ dans le tampon laisse la place à toute la couche.
      expect(src.offset).toBeGreaterThanOrEqual(0);
      expect(src.offset + (src.stoppedAt! - src.startedAt!)).toBeLessThanOrEqual(noiseBuffers[0]!.length / ctx.sampleRate);
    }
  });

  it("débranche les nœuds de chaque couche à la fin (onended)", () => {
    const { sounds, ctx } = unlocked();
    sounds.play("break", BlockId.Planks);
    const master = masterOf(ctx);
    const sources = startedSources(ctx);
    for (const src of sources) {
      expect(src.onended).toBeTypeOf("function");
      src.onended!();
      expect(src.disconnected).toBe(true);
    }
    for (const f of ctx.filters) expect(f.disconnected).toBe(true);
    for (const g of ctx.gains.filter((g) => g !== master)) expect(g.disconnected).toBe(true);
    // Le gain général reste branché.
    expect(master.disconnected).toBe(false);
  });

  it(`limite à ${MAX_VOICES} sons simultanés, puis accepte à nouveau quand ils sont finis`, () => {
    const { sounds, ctx } = unlocked();
    for (let i = 0; i < 20; i++) sounds.play("select");
    expect(ctx.oscillators.length).toBe(MAX_VOICES);
    ctx.currentTime = 0.01; // les sons précédents ne sont pas finis
    sounds.play("select");
    expect(ctx.oscillators.length).toBe(MAX_VOICES);
    ctx.currentTime = 1; // tous finis
    sounds.play("select");
    expect(ctx.oscillators.length).toBe(MAX_VOICES + 1);
  });

  it("compte un son à plusieurs couches pour un seul son", () => {
    const { sounds, ctx } = unlocked();
    for (let i = 0; i < MAX_VOICES; i++) sounds.play("pickup");
    expect(ctx.oscillators.length).toBe(MAX_VOICES * recipe("pickup").length);
  });

  it("coupé : état coupé, aucun son, gain général à 0 ; réactivé : volume rétabli", () => {
    const { sounds, ctx } = unlocked();
    const master = masterOf(ctx);
    sounds.enabled = false;
    expect(sounds.state).toBe("coupé");
    expect(master.gain.value).toBe(0);
    sounds.play("pickup");
    expect(ctx.oscillators.length).toBe(0);
    sounds.enabled = true;
    expect(sounds.state).toBe("actif");
    expect(master.gain.value).toBeCloseTo(0.6);
    sounds.play("pickup");
    expect(ctx.oscillators.length).toBeGreaterThan(0);
  });

  it("coupé avant le premier geste : le contexte naît avec un gain nul", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    s.enabled = false;
    expect(s.state).toBe("coupé");
    s.unlock();
    expect(masterOf(audio.instances[0]!).gain.value).toBe(0);
  });

  it("applique le volume au gain général, en douceur", () => {
    const { sounds, ctx } = unlocked();
    const master = masterOf(ctx);
    sounds.volume = 0.25;
    expect(master.gain.value).toBeCloseTo(0.25);
    expect(master.gain.events.some((e) => e.type === "target")).toBe(true);
    sounds.volume = 5;
    expect(master.gain.value).toBe(1);
  });

  it("volume réglé avant le premier geste : repris à la création", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    s.volume = 0.2;
    s.unlock();
    expect(masterOf(audio.instances[0]!).gain.value).toBeCloseTo(0.2);
  });

  it("ne joue rien tant que le contexte est suspendu", () => {
    const { sounds, ctx } = unlocked();
    ctx.state = "suspended";
    expect(sounds.state).toBe("suspendu");
    sounds.play("deny");
    expect(ctx.oscillators.length).toBe(0);
  });

  it("création refusée par le navigateur : pas d'exception, état absent, pas d'acharnement", () => {
    const audio = fakeAudio({ throwOnCreate: true });
    const s = new Sounds({ audioContext: audio.ctor });
    expect(() => s.unlock()).not.toThrow();
    expect(() => s.unlock()).not.toThrow();
    expect(() => s.play("break", BlockId.Stone)).not.toThrow();
    expect(s.available).toBe(true);
    expect(s.state).toBe("absent");
    expect(audio.constructed()).toBe(1);
  });

  it("nœud refusé pendant la lecture : play ne lève pas", () => {
    const { sounds } = unlocked({ throwOnOscillator: true });
    for (const name of SOUND_NAMES) expect(() => sounds.play(name, BlockId.Stone)).not.toThrow();
  });

  it("couche refusée en route : rien ne reste branché sur le gain général", () => {
    const { sounds, ctx } = unlocked({ throwOnOscillator: true });
    const master = masterOf(ctx);
    const envelopes = () => ctx.gains.filter((g) => g !== master);
    // Deux tonalités, refusées toutes les deux : aucune enveloppe ne reste branchée.
    sounds.play("pickup");
    expect(envelopes().length).toBeGreaterThan(0);
    expect(envelopes().filter((g) => g.connections.includes(master))).toEqual([]);
    // Casse : le bruit passe, la tonalité est refusée ; seule l'enveloppe du bruit est branchée.
    ctx.currentTime = 1;
    sounds.play("break", BlockId.Stone);
    const live = envelopes().filter((g) => g.connections.includes(master));
    expect(live.length).toBe(1);
    expect(ctx.filters[0]!.connections).toContain(live[0]);
  });

  it("nom de son inconnu : rien, sans exception", () => {
    const { sounds, ctx } = unlocked();
    expect(() => sounds.play("boum" as never)).not.toThrow();
    expect(startedSources(ctx).length).toBe(0);
  });

  it("contexte fermé : état en attente, un nouveau contexte au geste suivant", () => {
    const { sounds, ctx, audio } = unlocked();
    ctx.state = "closed";
    expect(sounds.state).toBe("en attente d'un geste");
    sounds.play("select");
    expect(ctx.oscillators.length).toBe(0);
    sounds.unlock();
    expect(audio.constructed()).toBe(2);
    expect(sounds.state).toBe("actif");
    sounds.play("select");
    expect(audio.instances[1]!.oscillators.length).toBe(1);
  });

  it("interrompu (Safari) : état suspendu, repris au geste suivant", () => {
    const { sounds, ctx } = unlocked();
    ctx.state = "interrupted";
    expect(sounds.state).toBe("suspendu");
    sounds.unlock();
    expect(ctx.resumeCalls).toBe(1);
    expect(sounds.state).toBe("actif");
  });
});

describe("attachUnlock et retour sur l'onglet", () => {
  it("écoute pointerdown, keydown et touchstart, en capture et passifs", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      expect(w.winListeners.find((x) => x.type === type), type).toBeDefined();
    }
    expect(w.winListeners.map((l) => l.type).sort()).toEqual([...UNLOCK_EVENTS].sort());
    for (const l of w.winListeners) expect(l.opts, l.type).toMatchObject({ capture: true, passive: true });
    // Aucun contexte tant qu'aucun geste n'a eu lieu.
    expect(audio.constructed()).toBe(0);
  });

  it.each([...UNLOCK_EVENTS])("un geste %s débloque le son", (type) => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    w.fireWin(type);
    expect(audio.constructed()).toBe(1);
    expect(s.state).toBe("actif");
  });

  it("un second appel n'ajoute pas d'écouteurs", () => {
    const s = new Sounds({ audioContext: fakeAudio().ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    const n = w.winListeners.length;
    s.attachUnlock(w.win);
    expect(w.winListeners.length).toBe(n);
    expect(w.docListeners.length).toBe(1);
  });

  it("au retour sur l'onglet, reprend un contexte suspendu déjà débloqué", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    w.fireWin("keydown");
    const ctx = audio.instances[0]!;
    ctx.state = "suspended";
    w.doc.visibilityState = "hidden";
    w.fireDoc("visibilitychange");
    expect(ctx.resumeCalls).toBe(0);
    w.doc.visibilityState = "visible";
    w.fireDoc("visibilitychange");
    expect(ctx.resumeCalls).toBe(1);
    expect(s.state).toBe("actif");
  });

  it("au retour sur l'onglet, ne crée pas de contexte sans geste préalable", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    w.fireDoc("visibilitychange");
    expect(audio.constructed()).toBe(0);
    expect(s.state).toBe("en attente d'un geste");
  });

  it("au retour sur l'onglet, reprend aussi un contexte interrompu (Safari)", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    w.fireWin("touchend");
    const ctx = audio.instances[0]!;
    ctx.state = "interrupted";
    w.fireDoc("visibilitychange");
    expect(ctx.resumeCalls).toBe(1);
    expect(s.state).toBe("actif");
  });

  it("les écouteurs ne lèvent jamais, même si resume lève", () => {
    const audio = fakeAudio({ initialState: "suspended", resumeThrows: true });
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    for (const type of UNLOCK_EVENTS) expect(() => w.fireWin(type), type).not.toThrow();
    expect(() => w.fireDoc("visibilitychange")).not.toThrow();
    expect(s.state).toBe("suspendu");
    expect(() => s.play("select")).not.toThrow();
  });

  it("cible sans événements ni document : attachUnlock ne lève pas", () => {
    const s = new Sounds({ audioContext: fakeAudio().ctor });
    expect(() => s.attachUnlock({} as Window)).not.toThrow();
    expect(() => new Sounds().attachUnlock(undefined as unknown as Window)).not.toThrow();
  });

  it("au retour sur l'onglet, ne touche pas un contexte déjà actif", () => {
    const audio = fakeAudio();
    const s = new Sounds({ audioContext: audio.ctor });
    const w = fakeWindow();
    s.attachUnlock(w.win);
    w.fireWin("pointerdown");
    w.fireDoc("visibilitychange");
    expect(audio.instances[0]!.resumeCalls).toBe(0);
  });
});
