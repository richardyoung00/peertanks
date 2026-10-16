import type { GameEvent, ShellHitEvent, TankKilledEvent } from '../sim/game-events';
import { isPickupWeapon, type WeaponId } from '../sim/items';
import { playSoundEffect, type SoundEffectId } from './sound-effects';
import { placeSound, type ListenerPosition } from './spatial';
import { playIncomingWhistle } from './synth-sounds';

const SHOT_SOUNDS: Record<WeaponId, SoundEffectId> = {
  cannon: 'cannon',
  'bouncy-cannon': 'bouncyCannon',
  'machine-gun': 'machineGun',
  laser: 'laser',
  rocket: 'launch',
  grenade: 'grenadeThrow',
  mortar: 'launch',
};

/** The whistle only covers the end of the mortar's flight, when the shell is coming down. */
const WHISTLE_SECONDS = 1.1;

/** Turns game events into sound effects, placed around the listener (the camera's focus). */
export class GameSounds {
  constructor(private readonly localId: string) {}

  handleEvents(events: GameEvent[], listener: ListenerPosition): void {
    for (const event of events) this.handleEvent(event, listener);
  }

  /** Our own predicted shot, shown before the host confirms it. */
  playOwnShot(weapon: WeaponId): void {
    playSoundEffect(SHOT_SOUNDS[weapon]);
  }

  /** Our own predicted shells hitting walls. */
  playOwnWallHits(impacts: { x: number; y: number }[], listener: ListenerPosition): void {
    for (const { x, y } of impacts) this.playAt('wallHit', x, y, listener);
  }

  private handleEvent(event: GameEvent, listener: ListenerPosition): void {
    switch (event.type) {
      case 'shotFired':
        this.playAt(SHOT_SOUNDS[event.weapon], event.x, event.y, listener);
        break;
      case 'shellHit':
        this.playShellHit(event, listener);
        break;
      case 'tankDamaged':
        if (event.tankId === this.localId) playSoundEffect('ownTankHit');
        break;
      case 'tankKilled':
        this.playAt(deathSound(event), event.x, event.y, listener);
        break;
      case 'explosion':
        this.playAt('explosion', event.x, event.y, listener);
        break;
      case 'pickupCollected':
        if (event.tankId === this.localId) playSoundEffect(isPickupWeapon(event.item) ? 'weaponPickup' : 'powerupPickup');
        break;
      case 'mortarFired':
        this.playWhistle(event.targetX, event.targetY, event.flightSeconds, listener);
        break;
    }
  }

  /** Hits on our own tank are covered by the damage sound instead. */
  private playShellHit(event: ShellHitEvent, listener: ListenerPosition): void {
    if (event.tankId === this.localId) return;
    this.playAt(event.tankId ? 'tankHit' : 'wallHit', event.x, event.y, listener);
  }

  private playWhistle(x: number, y: number, flightSeconds: number, listener: ListenerPosition): void {
    const placement = placeSound(x, y, listener);
    if (!placement) return;
    const duration = Math.min(WHISTLE_SECONDS, flightSeconds);
    playIncomingWhistle(flightSeconds - duration, duration, placement.volume, placement.pan);
  }

  private playAt(id: SoundEffectId, x: number, y: number, listener: ListenerPosition): void {
    const placement = placeSound(x, y, listener);
    if (placement) playSoundEffect(id, placement);
  }
}

/** Pits aren't on any map yet, so falling into one just uses the destroyed sound for now. */
function deathSound(event: TankKilledEvent): SoundEffectId {
  if (event.cause === 'water') return 'tankSankWater';
  if (event.cause === 'lava') return 'tankSankLava';
  return 'tankDestroyed';
}
