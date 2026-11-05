import { capitalize, numberWords } from "./counting";
import { NBSP, pick, type ChildText, type ReadingLevel } from "./texts";

/**
 * Mots de la mission 2 « Les mots » (V2 lot 1, pur) : listes par niveau de lecture et par palier, noms dits des
 * lettres, prénom écrit sans accent, tirage déterministe, gabarits de texte.
 *
 * - Débutant (6 ans) : il recopie un mot montré. Palier 1 : 3 lettres ; palier 2 : 4 lettres en deux syllabes
 *   simples ; palier 3 : 4 lettres avec un son à deux lettres ou une lettre muette.
 * - Autonome (8 ans) : il écrit sous la dictée. Palier 1 : 5 lettres ; palier 2 : 6 ; palier 3 : 7.
 *
 * Les mots sont en capitales A–Z sans accent (les blocs-lettres n'en ont pas). La voix lit la forme `say`, en
 * minuscules : un mot en capitales pourrait être épelé comme un sigle. Les lettres sont dites par leur nom
 * (« emme », décision 12 de Pierre). Aucune phrase ne dit que la lampe éloigne les Grignotes (décision 6).
 */

/** Astuce d'orthographe d'un mot (dictée). Le débutant ne la voit jamais : sa variante existe pour la règle des deux variantes. */
export interface Tip {
  text: ChildText;
  /** Forme dite (lettres par leur nom) ; par défaut, la forme écrite. */
  spoken?: ChildText;
}

export interface WordEntry {
  /** Le mot, en capitales A–Z sans accent. */
  text: string;
  /** Forme dite, en minuscules (« ami » ; « Pixel » pour PIXEL). */
  say: string;
  /** Phrase d'exemple (dite à la réussite pour le débutant, dans la dictée pour l'autonome). */
  sentence: string;
  /** Découpe écrite en syllabes ; leur concaténation redonne `text`. */
  syllables: readonly string[];
  tier: 1 | 2 | 3;
  tip?: Tip;
}

/** Noms dits des lettres (décision 12 : la lettre est dite par son nom, pas par son son). */
export const LETTER_NAMES: Readonly<Record<string, string>> = {
  A: "a",
  B: "bé",
  C: "cé",
  D: "dé",
  E: "e",
  F: "effe",
  G: "gé",
  H: "ache",
  I: "i",
  J: "ji",
  K: "ka",
  L: "elle",
  M: "emme",
  N: "enne",
  O: "o",
  P: "pé",
  Q: "ku",
  R: "erre",
  S: "esse",
  T: "té",
  U: "u",
  V: "vé",
  W: "double vé",
  X: "ixe",
  Y: "i grec",
  Z: "zède",
};

/** Nom dit d'une lettre (« M » ou « m » → « emme ») ; tout autre caractère est rendu tel quel. */
export function letterName(ch: string): string {
  return LETTER_NAMES[ch.toUpperCase()] ?? ch;
}

/** Le mot épelé, lettre par lettre, par leur nom : « AMI » → « a, emme, i ». */
export function spell(word: string): string {
  return Array.from(word, letterName).join(", ");
}

/**
 * Prénom écrit avec les blocs-lettres (décision 14 : sans accent) : accents retirés, capitales. « Léa » → LEA,
 * « Chloé » → CHLOE. Un prénom qui ne s'écrit pas avec 2 à 10 lettres A–Z (« Joueur 1 », « Anne-Sophie », « X »,
 * vide, absent) : null, le jeu donne alors un mot de la liste.
 */
export function nameWord(name: string | null): string | null {
  if (typeof name !== "string") return null;
  const s = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques combinants après NFD
    .toUpperCase();
  return /^[A-Z]{2,10}$/.test(s) ? s : null;
}

/** Guillemets français avec leurs espaces insécables. */
const q = (s: string) => `«${NBSP}${s}${NBSP}»`;

/** Astuces d'orthographe (dictée), par son ou par règle. */
const TIPS = {
  MP: {
    text: { debutant: `Devant P, écris M${NBSP}!`, autonome: `Devant la lettre P, le son ${q("an")} s'écrit avec un M.` },
    spoken: { debutant: `Devant P, écris M${NBSP}!`, autonome: "Devant la lettre pé, le son an s'écrit avec un emme." },
  },
  EU: {
    text: { debutant: `Le son eu${NBSP}: E, U${NBSP}!`, autonome: `Le son ${q("eu")} s'écrit avec deux lettres${NBSP}: E et U.` },
    spoken: { debutant: `Le son eu${NBSP}: E, U${NBSP}!`, autonome: `Le son eu s'écrit avec deux lettres${NBSP}: e et u.` },
  },
  C_FINAL: {
    text: { debutant: `Il finit par un C${NBSP}!`, autonome: `On n'entend pas la dernière lettre de tronc${NBSP}: c'est un C.` },
    spoken: { debutant: `Il finit par un C${NBSP}!`, autonome: `On n'entend pas la dernière lettre de tronc${NBSP}: c'est un cé.` },
  },
  EI: {
    text: { debutant: `Le son è${NBSP}: E, I${NBSP}!`, autonome: `Dans ce mot, le son ${q("è")} s'écrit avec E et I.` },
    spoken: { debutant: `Le son è${NBSP}: E, I${NBSP}!`, autonome: "Dans ce mot, le son è s'écrit avec e et i." },
  },
  IN: {
    text: { debutant: `Le son in${NBSP}: I, N${NBSP}!`, autonome: `Le son ${q("in")} s'écrit avec deux lettres${NBSP}: I et N.` },
    spoken: { debutant: `Le son in${NBSP}: I, N${NBSP}!`, autonome: `Le son in s'écrit avec deux lettres${NBSP}: i et enne.` },
  },
  RR: {
    text: { debutant: `Deux R qui se suivent${NBSP}!`, autonome: "Dans ce mot, deux R se suivent, et il finit par un E." },
    spoken: { debutant: `Deux R qui se suivent${NBSP}!`, autonome: "Dans ce mot, deux erre se suivent, et il finit par un e." },
  },
  D_MUET: {
    // Forme dite identique à l'écrit.
    text: {
      debutant: `Pense à la renarde${NBSP}!`,
      autonome: `On n'entend pas la dernière lettre de renard. Pense à la renarde${NBSP}: là, on l'entend.`,
    },
  },
  AI_S: {
    text: { debutant: `Le son è${NBSP}: A, I${NBSP}!`, autonome: `Le son ${q("è")} s'écrit A et I, et le S entre deux voyelles chante ${q("z")}.` },
    spoken: { debutant: `Le son è${NBSP}: A, I${NBSP}!`, autonome: "Le son è s'écrit a et i, et le esse entre deux voyelles chante zzz." },
  },
  EIL: {
    text: { debutant: `Il finit par EIL${NBSP}!`, autonome: `La fin du mot s'écrit avec trois lettres${NBSP}: E, I et L.` },
    spoken: { debutant: `Il finit par EIL${NBSP}!`, autonome: `La fin du mot s'écrit avec trois lettres${NBSP}: e, i et elle.` },
  },
  EAU: {
    text: { debutant: `Trois lettres${NBSP}: E, A, U${NBSP}!`, autonome: `Le son ${q("o")} de la fin s'écrit avec trois lettres${NBSP}: E, A et U.` },
    spoken: { debutant: `Trois lettres${NBSP}: E, A, U${NBSP}!`, autonome: `Le son o de la fin s'écrit avec trois lettres${NBSP}: e, a et u.` },
  },
  LL: {
    text: { debutant: `Deux L qui se suivent${NBSP}!`, autonome: "Dans ce mot, deux L se suivent, et il finit par E et S." },
    spoken: { debutant: `Deux L qui se suivent${NBSP}!`, autonome: "Dans ce mot, deux elle se suivent, et il finit par e et esse." },
  },
  CH: {
    text: { debutant: `Le son ch${NBSP}: C, H${NBSP}!`, autonome: `Le son ${q("ch")} s'écrit avec deux lettres${NBSP}: C et H.` },
    spoken: { debutant: `Le son ch${NBSP}: C, H${NBSP}!`, autonome: `Le son ch s'écrit avec deux lettres${NBSP}: cé et ache.` },
  },
  SS: {
    text: { debutant: `Deux S qui se suivent${NBSP}!`, autonome: `Entre deux voyelles, le son ${q("s")} s'écrit avec deux S.` },
    spoken: { debutant: `Deux S qui se suivent${NBSP}!`, autonome: "Entre deux voyelles, le son sss s'écrit avec deux esse." },
  },
} satisfies Record<string, Tip>;

/** Une entrée de liste : « A·MI » → syllabes ["A", "MI"], mot « AMI », forme dite « ami » (ou `say`). */
function entry(tier: 1 | 2 | 3, cut: string, sentence: string, tip?: Tip, say?: string): WordEntry {
  const syllables = cut.split("·");
  const text = syllables.join("");
  return { text, say: say ?? text.toLowerCase(), sentence, syllables, tier, ...(tip ? { tip } : {}) };
}

/** Mots du débutant (copie). */
export const DEBUTANT_WORDS: readonly WordEntry[] = [
  // Palier 1 : 3 lettres.
  entry(1, "A·MI", "Pixel est ton ami."),
  entry(1, "SOL", "Tes blocs sont posés sur le sol."),
  entry(1, "MUR", "Ton abri a des murs."),
  entry(1, "SAC", "Tes blocs sont dans ton sac."),
  entry(1, "BOL", "Le lait est dans le bol."),
  entry(1, "BUS", "Le bus va à l'école."),
  // Palier 2 : 4 lettres, deux syllabes simples.
  entry(2, "MO·TO", "La moto roule vite."),
  entry(2, "LA·MA", "Le lama mange de l'herbe."),
  entry(2, "SO·FA", "On lit une histoire sur le sofa."),
  entry(2, "TI·PI", "Le tipi est une petite tente."),
  entry(2, "LU·NE", "La lune brille la nuit."),
  entry(2, "DO·DO", "Le soir, c'est l'heure du dodo."),
  entry(2, "JU·DO", "Au judo, on apprend à tomber."),
  entry(2, "PU·MA", "Le puma est un grand chat sauvage."),
  // Palier 3 : 4 lettres, un son à deux lettres ou une lettre muette (une syllabe).
  entry(3, "TOIT", "Le toit protège ton abri."),
  entry(3, "BOIS", "Les troncs donnent du bois."),
  entry(3, "CHAT", "Le chat dort au soleil."),
  entry(3, "LOUP", "Le loup court dans la forêt."),
  entry(3, "NUIT", "La nuit, les étoiles brillent."),
  entry(3, "ROUE", "Le vélo a deux roues."),
];

/** Mots de l'autonome (dictée). */
export const AUTONOME_WORDS: readonly WordEntry[] = [
  // Palier 1 : 5 lettres.
  entry(1, "LAM·PE", "La lampe éclaire ton abri.", TIPS.MP),
  entry(1, "SA·BLE", "Le désert est plein de sable."),
  entry(1, "AR·BRE", "Un oiseau chante dans l'arbre."),
  entry(1, "FLEUR", "Une fleur jaune pousse dans l'herbe.", TIPS.EU),
  entry(1, "TRONC", "Le tronc de l'arbre est solide.", TIPS.C_FINAL),
  entry(1, "NEI·GE", "La neige couvre la montagne.", TIPS.EI),
  entry(1, "LA·PIN", "Le lapin mange une carotte.", TIPS.IN),
  entry(1, "NU·A·GE", "Un gros nuage cache le soleil."),
  entry(1, "PI·XEL", "Pixel t'aide à jouer.", undefined, "Pixel"),
  // Palier 2 : 6 lettres.
  entry(2, "CA·BA·NE", "Nous avons construit une cabane."),
  entry(2, "PIER·RE", "La pierre grise est cachée sous la terre.", TIPS.RR),
  entry(2, "CAC·TUS", "Le cactus pousse dans le désert."),
  entry(2, "RE·NARD", "Pixel est un renard roux.", TIPS.D_MUET),
  entry(2, "MAI·SON", "La maison a une porte et des fenêtres.", TIPS.AI_S),
  entry(2, "JAR·DIN", "Les fleurs poussent dans le jardin.", TIPS.IN),
  entry(2, "SO·LEIL", "Le soleil se lève le matin.", TIPS.EIL),
  entry(2, "BA·TEAU", "Le bateau flotte sur l'eau.", TIPS.EAU),
  entry(2, "BUL·LES", "Les bulles font fuir les Grignotes.", TIPS.LL),
  // Palier 3 : 7 lettres.
  entry(3, "PLAN·CHE", "On fabrique une planche avec un tronc.", TIPS.CH),
  entry(3, "FEUIL·LE", "Une feuille tombe de l'arbre."),
  entry(3, "PRAI·RIE", "L'herbe est verte dans la prairie."),
  entry(3, "POIS·SON", "Le poisson nage dans l'eau.", TIPS.SS),
  entry(3, "CHA·PEAU", "Le chapeau protège du soleil.", TIPS.EAU),
  entry(3, "BIS·CUIT", "Je mange un biscuit au goûter."),
];

/** Liste du niveau de lecture. */
export function wordList(level: ReadingLevel): readonly WordEntry[] {
  return level === "autonome" ? AUTONOME_WORDS : DEBUTANT_WORDS;
}

/** Entrée d'un mot dans la liste du niveau, ou null. */
export function findEntry(level: ReadingLevel, text: string): WordEntry | null {
  return wordList(level).find((e) => e.text === text) ?? null;
}

/**
 * Tirage déterministe d'un mot (même graine → même mot). Candidats : les mots du palier, dans l'ordre de la liste,
 * hors `exclude` (mots déjà écrits ou présents dans le monde). S'il n'en reste aucun : les paliers voisins, puis
 * toute la liste hors `exclude`, puis toute la liste. Indice = ((seed × 2654435761 + tier × 40503) mod 2³²) mod n,
 * calculé exactement sur 32 bits (Math.imul) quelle que soit la graine.
 */
export function pickWord(level: ReadingLevel, tier: 1 | 2 | 3, exclude: ReadonlySet<string>, seed: number): WordEntry {
  const list = wordList(level);
  const free = (e: WordEntry) => !exclude.has(e.text);
  let candidates = list.filter((e) => e.tier === tier && free(e));
  if (candidates.length === 0) candidates = list.filter((e) => Math.abs(e.tier - tier) === 1 && free(e));
  if (candidates.length === 0) candidates = list.filter(free);
  if (candidates.length === 0) candidates = [...list];
  const s = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  const index = ((Math.imul(s, 2654435761) + tier * 40503) >>> 0) % candidates.length;
  return candidates[index] ?? list[0]!;
}

/**
 * Variables des gabarits (wordTexts.ts) :
 * - MOT : le mot en capitales ; mot : sa forme dite en minuscules ; Mot : la même avec une majuscule ;
 * - lettres : le mot épelé (« a, emme, i ») ; L : une lettre en capitale ; nom : le nom dit d'une lettre ;
 *   nomChoisi : le nom dit de la lettre choisie par erreur ; rang : un ordinal au féminin (« troisième ») ;
 * - n : un nombre en chiffres ; nLettres : le même en lettres, au féminin ;
 * - phrase : la phrase d'exemple du mot ; prenom : le prénom tel qu'enregistré ;
 * - liste : la liste des mots écrits ; nMots : leur nombre en lettres ;
 * - ou : l'endroit où poser la lettre ; astuce : l'astuce d'orthographe du mot.
 */
export interface WordVars {
  MOT?: string;
  mot?: string;
  Mot?: string;
  lettres?: string;
  phrase?: string;
  n?: string;
  nLettres?: string;
  L?: string;
  nom?: string;
  nomChoisi?: string;
  rang?: string;
  prenom?: string;
  liste?: string;
  nMots?: string;
  ou?: string;
  astuce?: string;
}

function fillOne(s: string, v: WordVars): string {
  const filled = s.replace(/\{([A-Za-z]+)\}/g, (all, key: string) => {
    const value = (v as Record<string, string | undefined>)[key];
    return value === undefined ? all : value;
  });
  // Une variable vide (mot sans astuce, sans phrase) ne laisse ni espace doublée ni espace au bout.
  return filled.replace(/ {2,}/g, " ").trim();
}

/** Remplit les deux variantes d'un gabarit : chaque {clé} fournie est remplacée ; une clé absente reste telle quelle. */
export function fillWord(t: ChildText, v: WordVars): ChildText {
  return { debutant: fillOne(t.debutant, v), autonome: fillOne(t.autonome, v) };
}

/** Forme dite d'un mot à écrire : la forme `say` d'une liste, le prénom tel qu'enregistré, sinon le mot en minuscules. */
export function sayWord(text: string, name: string | null): string {
  if (name && nameWord(name) === text) return name.trim();
  return (findEntry("debutant", text) ?? findEntry("autonome", text))?.say ?? text.toLowerCase();
}

/**
 * Variables d'un mot à écrire, pour fillWord : MOT, mot, Mot, lettres, phrase, n, nLettres, prenom et astuce (celle
 * du niveau, écrite ou dite selon `spoken` ; vide si le mot n'en a pas). Les variables d'une lettre (L, nom, rang…)
 * et du lieu (ou) dépendent du moment : le jeu les ajoute.
 */
export function wordVars(level: ReadingLevel, text: string, name: string | null, spoken = false): WordVars {
  const e = findEntry(level, text) ?? findEntry(level === "autonome" ? "debutant" : "autonome", text);
  const mot = sayWord(text, name);
  const tip = e?.tip;
  return {
    MOT: text,
    mot,
    Mot: capitalize(mot),
    lettres: spell(text),
    phrase: e?.sentence ?? "",
    n: String(text.length),
    nLettres: numberWords(text.length, true),
    prenom: name?.trim() ?? "",
    astuce: tip ? pick(spoken ? (tip.spoken ?? tip.text) : tip.text, level) : "",
  };
}
