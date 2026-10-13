const KEY_DIRECTIONS: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

export class Keyboard {
  private readonly pressed = new Set<string>();

  constructor(target: Window) {
    target.addEventListener('keydown', (event) => {
      if (event.code in KEY_DIRECTIONS) event.preventDefault();
      this.pressed.add(event.code);
    });
    target.addEventListener('keyup', (event) => this.pressed.delete(event.code));
    target.addEventListener('blur', () => this.pressed.clear());
  }

  /** The combined direction of all held movement keys, in screen space (y points down). */
  moveDirection(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      const direction = KEY_DIRECTIONS[code];
      if (!direction) continue;
      x += direction.x;
      y += direction.y;
    }
    return { x: Math.sign(x), y: Math.sign(y) };
  }
}
