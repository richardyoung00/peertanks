import type { MenuArt } from '../app/menu-art';
import type { BotLevel } from '../bots/bot-level';
import { NETWORK } from '../config';
import type { PlayerInfo } from '../net/messages';
import type { GameSettings } from '../sim/game-settings';
import { renderAddBotButtons } from './add-bot-buttons';
import { renderControlsGuide } from './controls-guide';
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
  art: MenuArt;
  /** Only the host can change settings and start; everyone else just waits. */
  isHost: boolean;
  onSettingsChange?(settings: GameSettings): void;
  onAddBot?(level: BotLevel): void;
  onKick?(playerId: string): void;
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
    renderControlsGuide(element('lobby-controls'));

    const start = element<HTMLButtonElement>('lobby-start');
    start.hidden = !options.isHost;
    start.onclick = () => options.onStart?.();
    element('lobby-status').textContent = options.isHost ? 'Players can join now' : 'Waiting for the host to start';

    showLoading(false);
    this.screen.hidden = false;
  }

  update(players: PlayerInfo[], settings: GameSettings): void {
    const { localId, hostId, onAddBot, onKick } = this.options;
    renderPlayerList(element('lobby-players'), players, { localId, hostId, onKick });
    const addBots = onAddBot ? { full: players.length >= NETWORK.maxPlayers, onAdd: onAddBot } : null;
    renderAddBotButtons(element('lobby-add-bots'), addBots);
    renderSettingsForm(element('lobby-settings'), settings, {
      maps: this.options.art.maps,
      itemThumbnails: this.options.art.itemThumbnails,
      editable: this.options.isHost,
      onChange: this.options.onSettingsChange,
    });
  }

  hide(): void {
    this.screen.hidden = true;
  }
}
