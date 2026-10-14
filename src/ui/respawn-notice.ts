import { GAMEPLAY } from '../gameplay-config';
import type { TankKilledEvent } from '../sim/game-events';
import { element } from './dom';
import { playerNameElement, type PlayerLookup } from './player-lookup';

const HAZARD_DEATH_TEXT = {
  water: 'You sank',
  lava: 'You melted',
  pit: 'You fell',
};

/** "Destroyed by X / Respawning in 3" while the local player is dead. */
export class RespawnNotice {
  private readonly notice = element('respawn-notice');
  private readonly countdown = document.createElement('small');
  private respawnAt = 0;

  constructor(private readonly players: PlayerLookup) {}

  show(event: TankKilledEvent, nowSeconds: number): void {
    this.respawnAt = nowSeconds + GAMEPLAY.respawn.delaySeconds;
    this.notice.replaceChildren(...this.headline(event), this.countdown);
    this.notice.hidden = false;
    this.update(nowSeconds);
  }

  hide(): void {
    this.notice.hidden = true;
  }

  update(nowSeconds: number): void {
    if (this.notice.hidden) return;
    const secondsLeft = Math.max(1, Math.ceil(this.respawnAt - nowSeconds));
    this.countdown.textContent = `Respawning in ${secondsLeft}`;
  }

  private headline(event: TankKilledEvent): (string | HTMLElement)[] {
    if (event.killerId) return ['Destroyed by ', playerNameElement(this.players, event.killerId)];
    return event.cause === 'cannon' ? ['Destroyed'] : [HAZARD_DEATH_TEXT[event.cause]];
  }
}
