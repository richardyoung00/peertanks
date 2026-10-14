export interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  /** Kills since this player last died. */
  streak: number;
}

/** Kills and deaths for the current round. `version` changes whenever anything does, so it's cheap to watch. */
export class Scoreboard {
  version = 0;
  private readonly scores = new Map<string, PlayerScore>();

  get all(): PlayerScore[] {
    return sortStandings([...this.scores.values()]);
  }

  add(playerId: string): void {
    this.scores.set(playerId, { playerId, kills: 0, deaths: 0, streak: 0 });
    this.version++;
  }

  remove(playerId: string): void {
    this.scores.delete(playerId);
    this.version++;
  }

  recordDeath(victimId: string, killerId: string | undefined): void {
    const victim = this.scores.get(victimId);
    if (victim) {
      victim.deaths++;
      victim.streak = 0;
    }
    const killer = killerId ? this.scores.get(killerId) : undefined;
    if (killer) {
      killer.kills++;
      killer.streak++;
    }
    this.version++;
  }

  reset(): void {
    for (const score of this.scores.values()) {
      score.kills = 0;
      score.deaths = 0;
      score.streak = 0;
    }
    this.version++;
  }
}

/** Most kills first; fewer deaths breaks ties. */
export function sortStandings(scores: PlayerScore[]): PlayerScore[] {
  return [...scores].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}
