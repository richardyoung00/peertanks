import type { PlayerInfo } from '../net/messages';
import type { GameSettings } from '../sim/game-settings';
import type { MapListing } from '../sim/map-loader';
import { makeCopyLinkButton } from './copy-link';
import { element } from './dom';
import { showLoading } from './notice';
import { renderPlayerList } from './player-list';
import { renderSettingsForm } from './settings-form';

export interface LobbyOptions {
  code: string;
  link: string;
  localId: string;
  hostId: string;
  maps: MapListing[];
  /** Only the host can change settings and start; everyone else just waits. */
  isHost: boolean;
  onSettingsChange?(settings: GameSettings): void;
  onStart?(): void;
  onLeave(): void;
}

/** The waiting room before the first round, with the invite link already live. */
export class LobbyScreen {
  private readonly screen = element('lobby');

  constructor(private readonly options: LobbyOptions) {
    element('lobby-code').textContent = options.code;
    makeCopyLinkButton(element<HTMLButtonElement>('lobby-copy'), options.link);
    element('lobby-leave').onclick = options.onLeave;

    const start = element<HTMLButtonElement>('lobby-start');
    start.hidden = !options.isHost;
    start.onclick = () => options.onStart?.();
    element('lobby-status').textContent = options.isHost ? '' : 'Waiting for the host to start…';

    showLoading(false);
    this.screen.hidden = false;
  }

  update(players: PlayerInfo[], settings: GameSettings): void {
    renderPlayerList(element('lobby-players'), players, { localId: this.options.localId, hostId: this.options.hostId });
    renderSettingsForm(element('lobby-settings'), settings, {
      maps: this.options.maps,
      editable: this.options.isHost,
      onChange: this.options.onSettingsChange,
    });
  }

  hide(): void {
    this.screen.hidden = true;
  }
}
