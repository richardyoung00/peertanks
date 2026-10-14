export interface BuildInfo {
  version: string;
  commit: string;
  /** Unix time of the commit this build came from; higher means newer. */
  commitTime: number;
}

// Replaced at build time by vite.config.ts.
declare const __BUILD_INFO__: BuildInfo;

export const BUILD: BuildInfo = __BUILD_INFO__;

export type BuildComparison = 'same' | 'older' | 'newer';

export function describeBuild(build: BuildInfo = BUILD): string {
  const devSuffix = import.meta.env.DEV ? ' (dev)' : '';
  return `v${build.version} · ${build.commit}${devSuffix}`;
}

/** How another player's build compares with ours. Builds from before version checks count as older. */
export function compareWithOurBuild(other: BuildInfo | undefined): BuildComparison {
  if (!other || typeof other.commitTime !== 'number') return 'older';
  if (other.commitTime < BUILD.commitTime) return 'older';
  if (other.commitTime > BUILD.commitTime) return 'newer';
  return 'same';
}
