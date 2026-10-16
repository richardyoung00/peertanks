import { graphicsQuality, setGraphicsQuality, type GraphicsQuality } from '../render/graphics-quality';
import { renderPillChoice, type PillOption } from './pill-choice';

const CHOICES: PillOption<GraphicsQuality>[] = [
  { value: 'high', label: 'High', hint: 'Shadows, glow and full detail' },
  { value: 'low', label: 'Low', hint: 'No shadows or glow, fewer particles: smoother on slow machines' },
];

/** High / Low buttons for the graphics setting. It applies straight away and is remembered for next time. */
export function renderGraphicsToggle(container: HTMLElement): void {
  renderPillChoice(container, CHOICES, graphicsQuality(), setGraphicsQuality);
}
