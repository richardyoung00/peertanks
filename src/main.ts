import { startClientGame } from './app/client-game';
import { startHostGame } from './app/host-game';
import { returnToMenu } from './app/navigation';
import { describeBuild } from './build-info';
import { describeConnectionError, normaliseJoinCode, readJoinCodeFromUrl } from './net/peer';
import { initPhysics } from './sim/physics';
import { element } from './ui/dom';
import { showMenu } from './ui/menu';
import { showLoading, showNotice } from './ui/notice';

async function main(): Promise<void> {
  element('build-version').textContent = describeBuild();
  await initPhysics();
  showLoading(false);

  const choice = await showMenu(readJoinCodeFromUrl());
  showLoading(true, choice.mode === 'host' ? 'Opening lobby…' : 'Joining game…');
  const container = element('game');

  try {
    if (choice.mode === 'host') await startHostGame(choice.name, container);
    else await startClientGame(choice.name, normaliseJoinCode(choice.code), container);
    showLoading(false);
  } catch (error) {
    console.error(error);
    showLoading(false);
    showNotice(describeConnectionError(error), 'Back to menu', returnToMenu);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  showLoading(true, `Failed to start: ${error instanceof Error ? error.message : String(error)}`);
});
