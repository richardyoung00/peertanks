const PRIMARY_BUTTON = 0;

/** Tracks the pointer in normalised device coordinates (-1..1, y up) and whether the primary button is held. */
export class Mouse {
  ndcX = 0;
  ndcY = 0;
  buttonDown = false;

  constructor(element: HTMLElement) {
    element.addEventListener('pointermove', (event) => this.updatePosition(element, event));
    element.addEventListener('pointerdown', (event) => {
      this.updatePosition(element, event);
      if (event.button === PRIMARY_BUTTON) this.buttonDown = true;
    });
    window.addEventListener('pointerup', (event) => {
      if (event.button === PRIMARY_BUTTON) this.buttonDown = false;
    });
    window.addEventListener('blur', () => (this.buttonDown = false));
    element.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private updatePosition(element: HTMLElement, event: PointerEvent): void {
    const bounds = element.getBoundingClientRect();
    this.ndcX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.ndcY = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }
}
