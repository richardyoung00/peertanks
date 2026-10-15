import { graphicsQuality, setGraphicsQuality, type GraphicsQuality } from '../render/graphics-quality';

const CHOICES: { quality: GraphicsQuality; label: string; hint: string }[] = [
  { quality: 'high', label: 'High', hint: 'Shadows, glow and full detail' },
  { quality: 'low', label: 'Low', hint: 'No shadows or glow, fewer particles: smoother on slow machines' },
];

/** High / Low buttons for the graphics setting. It applies straight away and is remembered for next time. */
export function renderGraphicsToggle(container: HTMLElement): void {
  const buttons = CHOICES.map(({ quality, label, hint }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.textContent = label;
    button.title = hint;
    button.setAttribute('aria-pressed', String(graphicsQuality() === quality));
    button.onclick = () => {
      setGraphicsQuality(quality);
      renderGraphicsToggle(container);
    };
    return button;
  });
  container.replaceChildren(...buttons);
}
