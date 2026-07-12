import './styles/game.css';
import { CricketGame } from './game/CricketGame';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root not found');

root.innerHTML = `
  <canvas id="game-canvas" aria-label="3D cricket game"></canvas>
  <div id="orientation-lock" class="orientation-lock">
    <div class="panel compact"><h2>Rotate your iPhone</h2><p>This game is designed for landscape mode.</p></div>
  </div>
  <div id="overlay" class="overlay"></div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const overlay = document.querySelector<HTMLDivElement>('#overlay');
if (!canvas || !overlay) throw new Error('Required game elements not found');

const game = new CricketGame(canvas, overlay);
game.start();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => undefined);
  });
}
