const REPORT_EVERY_MS = 10_000;

interface Tally {
  bytes: number;
  messages: number;
}

/** For dev builds: counts what's sent by kind and logs the rates to the console every 10 seconds. */
export class TrafficMeter {
  private tallies = new Map<string, Tally>();
  private periodStartedAt = performance.now();

  constructor(private readonly title: string) {
    setInterval(() => this.report(), REPORT_EVERY_MS);
  }

  count(kind: string, bytes: number): void {
    const tally = this.tallies.get(kind) ?? { bytes: 0, messages: 0 };
    tally.bytes += bytes;
    tally.messages++;
    this.tallies.set(kind, tally);
  }

  private report(): void {
    const seconds = (performance.now() - this.periodStartedAt) / 1000;
    const rows = [...this.tallies].sort(([, a], [, b]) => b.bytes - a.bytes);
    this.tallies = new Map();
    this.periodStartedAt = performance.now();
    if (rows.length === 0) return;

    const totalBytes = rows.reduce((sum, [, tally]) => sum + tally.bytes, 0);
    const table = Object.fromEntries(rows.map(([kind, tally]) => [kind, rates(tally, seconds)]));
    console.info(`${this.title}: ${(totalBytes / seconds / 1024).toFixed(1)} KB/s in total`);
    console.table(table);
  }
}

function rates(tally: Tally, seconds: number) {
  return {
    'KB/s': Number((tally.bytes / seconds / 1024).toFixed(2)),
    'per second': Number((tally.messages / seconds).toFixed(1)),
    'average bytes': Math.round(tally.bytes / tally.messages),
  };
}
