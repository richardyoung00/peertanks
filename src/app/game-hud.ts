import type { GameEvent } from '../sim/game-events';
import type { Loadout } from '../sim/loadout';
import type { RoundPhase } from '../sim/round';
import type { PlayerScore } from '../sim/scores';
import { EventFeed, type FeedPlayer } from '../ui/event-feed';
import type { PlayerLookup } from '../ui/player-lookup';
import { RespawnNotice } from '../ui/respawn-notice';
import { ResultsScreen } from '../ui/results-screen';
import { updateRoundTimer } from '../ui/round-timer';
import { ScoreboardPanel } from '../ui/scoreboard';
import { WeaponBar } from '../ui/weapon-bar';

export interface RoundStatus {
  phase: RoundPhase;
  timeLeft: number;
}

/** The in-game overlay: round timer, scoreboard, weapon bar, event feed, respawn countdown and results. */
export class GameHud {
  private readonly feed: EventFeed;
  private readonly scoreboard: ScoreboardPanel;
  private readonly results: ResultsScreen;
  private readonly respawnNotice: RespawnNotice;
  private readonly weaponBar = new WeaponBar();

  constructor(
    players: PlayerLookup,
    private readonly localId: string,
  ) {
    this.feed = new EventFeed(players);
    this.scoreboard = new ScoreboardPanel(players, localId);
    this.results = new ResultsScreen(players);
    this.respawnNotice = new RespawnNotice(players);
  }

  handleEvents(events: GameEvent[], nowSeconds: number): void {
    for (const event of events) {
      if (event.type === 'tankKilled') {
        this.feed.addKill(event);
        if (event.tankId === this.localId) this.respawnNotice.show(event, nowSeconds);
      }
      if (event.type === 'tankRespawned' && event.tankId === this.localId) this.respawnNotice.hide();
    }
  }

  playerJoined(player: FeedPlayer): void {
    this.feed.addPlayerJoined(player);
  }

  playerLeft(player: FeedPlayer): void {
    this.feed.addPlayerLeft(player);
  }

  /** Driven by state rather than events, so someone joining mid-results still sees the right screen. */
  update(round: RoundStatus, scores: PlayerScore[], loadout: Loadout, nextMapName: string, nowSeconds: number): void {
    updateRoundTimer(round.phase, round.timeLeft);
    this.weaponBar.update(loadout);
    this.scoreboard.update(scores);
    this.respawnNotice.update(nowSeconds);

    if (round.phase === 'results') {
      this.results.show(scores);
      this.results.updateCountdown(round.timeLeft, nextMapName);
    } else {
      this.results.hide();
    }
  }
}
