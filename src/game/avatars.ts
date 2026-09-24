/**
 * Avatars (J4) : personnages en blocs, dessin original (rien de Minecraft),
 * choisis par l'enfant dans son profil. Couleurs en hexadécimal sRGB.
 * On ajoute à la fin, on ne renumérote jamais (les profils gardent l'index).
 */
export interface AvatarDef {
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  /** Chapeau (couleur) ou null. */
  hat: string | null;
}

export const AVATARS: readonly AvatarDef[] = [
  { name: "Tenue rouge", skin: "#f1c7a3", hair: "#5a3a22", shirt: "#d9443c", pants: "#2f4c8a", shoes: "#3a2a20", hat: null },
  { name: "Tenue verte", skin: "#8d5a3b", hair: "#1e1a18", shirt: "#3fa35a", pants: "#6b4a2e", shoes: "#2a2a2a", hat: null },
  { name: "Casquette jaune", skin: "#e8b48f", hair: "#c98a3a", shirt: "#3a7bd5", pants: "#3b3b48", shoes: "#d9d9d9", hat: "#f2c230" },
  { name: "Tenue violette", skin: "#c68b62", hair: "#2b1c14", shirt: "#8a4fc2", pants: "#2e2e3a", shoes: "#f0f0f0", hat: null },
  { name: "Bonnet orange", skin: "#f5d5b8", hair: "#e0c060", shirt: "#e8f0f5", pants: "#4a7a4a", shoes: "#6a3a2a", hat: "#f07a2a" },
  { name: "Tenue bleue", skin: "#5c3a26", hair: "#0f0c0a", shirt: "#2a8fb5", pants: "#f2e3b5", shoes: "#b53a3a", hat: null },
];

/** Avatar valide pour un index enregistré (null ou hors liste → le premier). */
export function avatarDef(index: number | null | undefined): AvatarDef {
  return (index !== null && index !== undefined ? AVATARS[index] : undefined) ?? AVATARS[0]!;
}
