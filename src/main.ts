import { PLAYER_COLORS } from './config';
import { startGameLoop } from './game-loop';
import { Keyboard } from './input/keyboard';
import { readLocalInput } from './input/local-input';
import { Mouse } from './input/mouse';
import { GameView } from './render/game-view';
import { GameWorld } from './sim/game-world';
import { fetchMap } from './sim/map-loader';
import { initPhysics } from './sim/physics';
import type { PlayerInput } from './sim/player-input';

const MAP_URL = `${import.meta.env.BASE_URL}maps/arena-01.json`;
const LOCAL_PLAYER_ID = 'local';
const TRAINING_DUMMY_COUNT = 2;

async function start(): Promise<void> {
  await initPhysics();
  const world = new GameWorld(await fetchMap(MAP_URL));
  const player = world.addTank(LOCAL_PLAYER_ID, 'You', PLAYER_COLORS[0]);
  addTrainingDummies(world);

  const container = document.getElementById('game')!;
  const view = new GameView(container, world, player.id);
  const keyboard = new Keyboard(window);
  const mouse = new Mouse(container);
  const inputs = new Map<string, PlayerInput>();

  startGameLoop(
    () => {
      const aimPoint = view.groundPointAt(mouse.ndcX, mouse.ndcY);
      inputs.set(player.id, readLocalInput(keyboard, mouse, aimPoint, player));
      view.handleEvents(world.step(inputs));
    },
    (alpha, frameDt) => view.render(alpha, frameDt, view.groundPointAt(mouse.ndcX, mouse.ndcY)),
  );

  document.getElementById('loading')?.remove();
}

// Idle tanks to bump into and shoot at until multiplayer arrives in milestone 2.
function addTrainingDummies(world: GameWorld): void {
  for (let index = 1; index <= TRAINING_DUMMY_COUNT; index++) {
    world.addTank(`dummy-${index}`, `Dummy ${index}`, PLAYER_COLORS[index]);
  }
}

start().catch((error: unknown) => {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `Failed to start: ${error instanceof Error ? error.message : String(error)}`;
});
