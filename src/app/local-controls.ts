import type * as THREE from 'three';
import { Keyboard } from '../input/keyboard';
import { readLocalInput } from '../input/local-input';
import { Mouse } from '../input/mouse';
import type { GameView } from '../render/game-view';
import type { PlayerInput } from '../sim/player-input';
import type { Tank } from '../sim/tank';

/** The local player's keyboard and mouse, read the same way whether hosting or joining. */
export class LocalControls {
  private readonly keyboard = new Keyboard(window);
  private readonly mouse: Mouse;

  constructor(container: HTMLElement) {
    this.mouse = new Mouse(container);
  }

  aimPoint(view: GameView): THREE.Vector3 | null {
    return view.groundPointAt(this.mouse.ndcX, this.mouse.ndcY);
  }

  read(view: GameView, tank: Tank): PlayerInput {
    return readLocalInput(this.keyboard, this.mouse, this.aimPoint(view), tank);
  }
}
