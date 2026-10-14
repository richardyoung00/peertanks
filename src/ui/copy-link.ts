const COPIED_FEEDBACK_MS = 1500;

/** Makes a button copy the invite link, briefly showing whether it worked. */
export function makeCopyLinkButton(button: HTMLButtonElement, link: string): void {
  const label = button.textContent ?? 'Copy link';
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      button.textContent = 'Copied!';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => (button.textContent = label), COPIED_FEEDBACK_MS);
  };
}
