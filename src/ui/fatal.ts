/**
 * Écran d'erreur lisible (au lieu d'une page vide ou figée). Le texte technique
 * est affiché pour que l'adulte puisse le copier dans docs/RETOURS.md.
 */
export function showFatalError(err: unknown): void {
  const box = document.createElement("div");
  box.className = "fatal";
  const title = document.createElement("h1");
  title.textContent = "Oups, le jeu s'est arrêté.";
  const hint = document.createElement("p");
  hint.textContent = "Recharge la page pour rejouer. Pour l'adulte : copie le texte ci-dessous dans docs/RETOURS.md.";
  const pre = document.createElement("pre");
  pre.textContent = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  box.append(title, hint, pre);
  document.body.appendChild(box);
}
