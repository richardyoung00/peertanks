/** Leaving a game is a clean page reload, which tears down the network connections and the 3D scene. */
export function returnToMenu(): void {
  history.replaceState(null, '', location.pathname);
  location.reload();
}
