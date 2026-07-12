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
  <a id="character-viewer-link" href="${import.meta.env.BASE_URL}characters.html" aria-label="View cricket characters">View Characters</a>
`;

const viewerLink = document.querySelector<HTMLAnchorElement>('#character-viewer-link');
if (viewerLink) {
  Object.assign(viewerLink.style, {
    position: 'fixed',
    zIndex: '30',
    right: 'max(14px, env(safe-area-inset-right))',
    bottom: 'max(14px, env(safe-area-inset-bottom))',
    padding: '11px 15px',
    borderRadius: '14px',
    color: '#ffffff',
    background: 'rgba(5, 20, 35, 0.88)',
    border: '1px solid rgba(255,255,255,.18)',
    boxShadow: '0 10px 30px rgba(0,0,0,.25)',
    backdropFilter: 'blur(12px)',
    textDecoration: 'none',
    fontWeight: '800',
    fontSize: '13px',
    letterSpacing: '.01em'
  });
}

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
