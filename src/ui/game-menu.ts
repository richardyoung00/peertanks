import type { MenuArt } from '../app/menu-art';
import type { PlayerInfo } from '../net/messages';
import type { GameSettings } from '../sim/game-settings';
import { renderControlsGuide } from './controls-guide';
import { element } from './dom';
import { renderPlayerList } from './player-list';
import { renderSettingsForm } from './settings-form';

export interface HostMenuControls {
  onSettingsChange(settings: GameSettings): void;
  onKick(playerId: string): void;
  onEndGame(): void;
}

export interface GameMenuOptions {
  localId: string;
  hostId: string;
  art: MenuArt;
  /** Only the host can change settings, kick and end the game; everyone else sees the settings and can leave. */
  host?: HostMenuControls;
  onLeave(): void;
}

/** The in-game menu, opened and closed with Esc. The game carries on behind it. */
export class GameMenu {
  private readonly screen = element('game-menu');
  private players: PlayerInfo[] = [];
  private settings: GameSettings | null = null;

  constructor(private readonly options: GameMenuOptions) {
    const isHost = Boolean(options.host);
    element('game-menu-end').hidden = !isHost;
    element('game-menu-leave').hidden = isHost;
    element('game-menu-settings-note').textContent = isHost
      ? 'Changes apply from the next round.'
      : 'Only the host can change these.';
    element('game-menu-close').onclick = () => this.close();
    element('game-menu-leave').onclick = options.onLeave;
    element('game-menu-end').onclick = () => options.host?.onEndGame();
    renderControlsGuide(element('game-menu-controls'));

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.toggle();
    });
  }

  get isOpen(): boolean {
    return !this.screen.hidden;
  }

  update(players: PlayerInfo[], settings: GameSettings): void {
    this.players = players;
    this.settings = settings;
    if (this.isOpen) this.render();
  }

  private toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private open(): void {
    this.render();
    this.screen.hidden = false;
  }

  private close(): void {
    this.screen.hidden = true;
  }

  private render(): void {
    const host = this.options.host;
    renderPlayerList(element('game-menu-players'), this.players, {
      localId: this.options.localId,
      hostId: this.options.hostId,
      onKick: host?.onKick,
    });
    if (!this.settings) return;
    renderSettingsForm(element('game-menu-settings'), this.settings, {
      maps: this.options.art.maps,
      itemThumbnails: this.options.art.itemThumbnails,
      editable: Boolean(host),
      onChange: (settings) => {
        this.settings = settings;
        host?.onSettingsChange(settings);
        this.render();
      },
    });
  }
}
