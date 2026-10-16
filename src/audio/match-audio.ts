import type { RoundStatus } from '../app/game-hud';
import type { GameEvent } from '../sim/game-events';
import type { WeaponId } from '../sim/items';
import { Announcer } from './announcer';
import { GameSounds } from './game-sounds';
import type { ListenerPosition } from './spatial';

/** Everything a running game plays: sound effects for what happens, and the announcer. */
export class MatchAudio {
  private readonly sounds: GameSounds;
  private readonly announcer: Announcer;

  constructor(localId: string) {
    this.sounds = new GameSounds(localId);
    this.announcer = new Announcer(localId);
  }

  handleEvents(events: GameEvent[], listener: ListenerPosition): void {
    this.sounds.handleEvents(events, listener);
    this.announcer.handleEvents(events);
  }

  update(round: RoundStatus, roundSeconds: number): void {
    this.announcer.update(round, roundSeconds);
  }

  playOwnShot(weapon: WeaponId): void {
    this.sounds.playOwnShot(weapon);
  }

  playOwnWallHits(impacts: { x: number; y: number }[], listener: ListenerPosition): void {
    this.sounds.playOwnWallHits(impacts, listener);
  }
}
