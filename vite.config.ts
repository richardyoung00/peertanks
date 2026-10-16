/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';

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

/** The TURN relay's address and login, from .env locally or from the deploy's secrets. Null if any are missing. */
function turnRelay(mode: string) {
  const env = loadEnv(mode, process.cwd(), 'TURN_');
  const { TURN_SERVER: server, TURN_USERNAME: username, TURN_PASSWORD: credential } = env;
  return server && username && credential ? { server, username, credential } : null;
}

export default defineConfig(({ mode }) => ({
  // Relative base so the build works both locally and under the GitHub Pages sub-path.
  base: './',
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
    __TURN_RELAY__: JSON.stringify(turnRelay(mode)),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
}));
