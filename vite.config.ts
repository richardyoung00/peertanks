import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

function gitOutput(command: string, fallback: string): string {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

// Stamped into the code so players can see which build they have, and so the host can
// spot a player on a different build when they join. Commit time orders builds oldest to newest.
const buildInfo = {
  version: JSON.parse(readFileSync('package.json', 'utf8')).version,
  commit: gitOutput('git rev-parse --short HEAD', 'unknown'),
  commitTime: Number(gitOutput('git log -1 --format=%ct', '0')),
};

export default defineConfig({
  // Relative base so the build works both locally and under the GitHub Pages sub-path.
  base: './',
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
});
