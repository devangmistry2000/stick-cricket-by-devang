import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core';
type Captain = { id: string; name: string; style: string; skin: string; jersey: string };
type Team = { id: string; name: string; short: string; primary: string; secondary: string; strength: string };
type DeliveryState = 'idle' | 'runup' | 'released' | 'resolved' | 'finished';
type MatchState = {
  runs: number;
  wickets: number;
  balls: number;
  target: number;
  delivery: DeliveryState;
  swipeStart?: { x: number; y: number; time: number };
};
const captains: Captain[] = [
  { id: 'ace', name: 'Ace', style: 'Balanced', skin: '#d59a6f', jersey: '#18a9e6' },
  { id: 'blaze', name: 'Blaze', style: 'Power Hitter', skin: '#9b5b39', jersey: '#ef5a3d' },
  { id: 'nova', name: 'Nova', style: 'Timing Specialist', skin: '#f0c7a8', jersey: '#8f63ff' }
];
const teams: Team[] = [
  { id: 'arrows', name: 'Ahmedabad Arrows', short: 'AA', primary: '#12a9e8', secondary: '#08294f', strength: 'Balanced' },
  { id: 'waves', name: 'Mumbai Waves', short: 'MW', primary: '#1d67ff', secondary: '#ffbd2e', strength: 'Power batting' },
  { id: 'royals', name: 'Jaipur Royals', short: 'JR', primary: '#8f52d9', secondary: '#f4c95d', strength: 'Timing' },
  { id: 'guardians', name: 'Chennai Guardians', short: 'CG', primary: '#f2c94c', secondary: '#1c4a9c', strength: 'Control' }
];
export class CricketGame {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private shadow: ShadowGenerator;
  private batter!: TransformNode;
  private bat!: Mesh;
  private bowler!: TransformNode;
  private ball!: Mesh;
  private captain = captains[0];
  private team = teams[0];
  private screen: 'opening' | 'captain' | 'team' | 'match' | 'result' = 'opening';
  private state: MatchState = { runs: 0, wickets: 0, balls: 0, target: 12, delivery: 'idle' };
  private lastFrame = performance.now();
  private deliveryTimer = 0;
  private ballOrigin = new Vector3(0, 2.1, 19);
  private ballVelocity = new Vector3(0, 0, 0);
  private swipeDirection = new Vector3(0, 0, 1);
  private shotPower = 0;
  private message = '';
  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLDivElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true }, true);
    this.engine.setHardwareScalingLevel(Math.max(1, Math.min(1.7, window.devicePixelRatio / 1.25)));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.48, 0.8, 0.96, 1);
    this.camera = new ArcRotateCamera('camera', Math.PI / 2, 1.12, 34, new Vector3(0, 2.8, 0), this.scene);
    this.camera.lowerRadiusLimit = 30;
    this.camera.upperRadiusLimit = 38;
    this.camera.inputs.clear();
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.35), this.scene);
    sun.position = new Vector3(18, 40, 25);
    sun.intensity = 2.2;
    new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene).intensity = 1.1;
    this.shadow = new ShadowGenerator(1024, sun);
    this.shadow.useBlurExponentialShadowMap = true;
    this.shadow.blurKernel = 24;
    this.buildStadium();
    this.buildCharacters();
    this.bindInput();
  }
  start(): void {
    this.renderUI();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.033, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.update(dt);
      this.scene.render();
    });
    window.addEventListener('resize', () => this.engine.resize());
  }
  private material(name: string, color: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.16, 0.16, 0.16);
    return m;
  }
  private buildStadium(): void {
    const grass = MeshBuilder.CreateGround('grass', { width: 66, height: 48 }, this.scene);
    grass.material = this.material('grassMat', '#2d9b52');
    grass.receiveShadows = true;
    const pitch = MeshBuilder.CreateGround('pitch', { width: 7, height: 24 }, this.scene);
    pitch.position.y = 0.03;
    pitch.material = this.material('pitchMat', '#c9a66b');
    const boundary = MeshBuilder.CreateTorus('boundary', { diameter: 54, thickness: 0.18, tessellation: 96 }, this.scene);
    boundary.rotation.x = Math.PI / 2;
    boundary.position.y = 0.1;
    boundary.scaling.z = 0.72;
    boundary.material = this.material('ropeMat', '#f4f6f8');
    for (let side = -1; side <= 1; side += 2) {
      const stand = MeshBuilder.CreateBox(`stand${side}`, { width: 64, height: 8, depth: 7 }, this.scene);
      stand.position.set(0, 4.2, side * 28);
      stand.material = this.material(`standMat${side}`, side > 0 ? '#17335f' : '#6d2a72');
      for (let r = 0; r < 3; r++) {
        for (let i = -12; i <= 12; i++) {
          const crowd = MeshBuilder.CreateSphere(`crowd-${side}-${r}-${i}`, { diameter: 0.5, segments: 6 }, this.scene);
          crowd.position.set(i * 2.2, 2.3 + r * 1.5, side * (24.8 + r * 0.35));
          crowd.material = this.material(`crowdMat-${side}-${r}-${i}`, ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0'][Math.abs(i + r) % 4]);
        }
      }
    }
    for (const z of [-9.6, 9.6]) {
      for (const x of [-0.55, 0, 0.55]) {
        const stump = MeshBuilder.CreateCylinder(`stump-${z}-${x}`, { height: 2.5, diameter: 0.13 }, this.scene);
        stump.position.set(x, 1.25, z);
        stump.material = this.material('stumpMat', '#f4e6b8');
      }
    }
  }
  private buildCharacters(): void {
    this.batter = this.createCartoonCharacter('batter', new Vector3(0, 0, -7.6), this.captain.jersey, this.captain.skin);
    this.batter.rotation.y = Math.PI;
    this.bat = MeshBuilder.CreateBox('bat', { width: 0.45, height: 4.5, depth: 0.22 }, this.scene);
    this.bat.material = this.material('batMat', '#e2b56f');
    this.bat.parent = this.batter;
    this.bat.position.set(1.05, 2.55, -0.1);
    this.bat.rotation.z = -0.35;
    this.bowler = this.createCartoonCharacter('bowler', new Vector3(0, 0, 14.5), '#f05a3b', '#9a5a38');
    const keeper = this.createCartoonCharacter('keeper', new Vector3(0, 0, -11.2), '#ffc93c', '#c58458');
    keeper.scaling.setAll(0.9);
    for (const [x, z] of [[-14, -2], [14, -2], [-18, 10], [18, 10], [-10, 19], [10, 19]]) {
      const fielder = this.createCartoonCharacter(`fielder-${x}-${z}`, new Vector3(x, 0, z), '#f05a3b', '#c58458');
      fielder.scaling.setAll(0.72);
    }
    this.ball = MeshBuilder.CreateSphere('ball', { diameter: 0.48, segments: 16 }, this.scene);
    const ballMat = new PBRMaterial('ballMat', this.scene);
    ballMat.albedoColor = Color3.FromHexString('#b51528');
    ballMat.roughness = 0.45;
    this.ball.material = ballMat;
    this.ball.position.copyFrom(this.ballOrigin);
    this.shadow.addShadowCaster(this.ball);
  }
  private createCartoonCharacter(name: string, position: Vector3, jersey: string, skin: string): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(position);
    const body = MeshBuilder.CreateCapsule(`${name}-body`, { height: 4.2, radius: 1.1 }, this.scene);
    body.parent = root;
    body.position.y = 2.4;
    body.material = this.material(`${name}-jersey`, jersey);
    const head = MeshBuilder.CreateSphere(`${name}-head`, { diameter: 2.2, segments: 12 }, this.scene);
    head.parent = root;
    head.position.y = 5.3;
    head.material = this.material(`${name}-skin`, skin);
    const hair = MeshBuilder.CreateSphere(`${name}-hair`, { diameter: 2.25, segments: 10 }, this.scene);
    hair.parent = root;
    hair.position.y = 5.65;
    hair.scaling.y = 0.38;
    hair.material = this.material(`${name}-hairMat`, '#2b1c18');
    for (const x of [-0.38, 0.38]) {
      const eye = MeshBuilder.CreateSphere(`${name}-eye-${x}`, { diameter: 0.22, segments: 8 }, this.scene);
      eye.parent = root;
      eye.position.set(x, 5.4, -1.02);
      eye.material = this.material(`${name}-eyeMat-${x}`, '#111111');
    }
    this.shadow.addShadowCaster(body);
    this.shadow.addShadowCaster(head);
    return root;
  }
  private bindInput(): void {
    this.overlay.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action = target.dataset.action;
      const value = target.dataset.value;
      if (!action) return;
      if (action === 'start') this.screen = 'captain';
      if (action === 'captain' && value) {
        this.captain = captains.find((c) => c.id === value) ?? captains[0];
        this.screen = 'team';
      }
      if (action === 'team' && value) {
        this.team = teams.find((t) => t.id === value) ?? teams[0];
        this.applySelection();
        this.startMatch();
      }
      if (action === 'retry') this.startMatch();
      if (action === 'home') this.screen = 'opening';
      this.renderUI();
    });
    this.canvas.addEventListener('touchstart', (e) => this.beginSwipe(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    this.canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      this.endSwipe(t.clientX, t.clientY);
    }, { passive: true });
    this.canvas.addEventListener('mousedown', (e) => this.beginSwipe(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseup', (e) => this.endSwipe(e.clientX, e.clientY));
  }
  private beginSwipe(x: number, y: number): void {
    if (this.screen !== 'match') return;
    this.state.swipeStart = { x, y, time: performance.now() };
  }
  private endSwipe(x: number, y: number): void {
    if (!this.state.swipeStart || this.state.delivery !== 'released') return;
    const dx = x - this.state.swipeStart.x;
    const dy = y - this.state.swipeStart.y;
    const length = Math.hypot(dx, dy);
    if (length < 18) return;
    this.swipeDirection.set(dx / Math.max(1, Math.abs(dx) + Math.abs(dy)), Math.max(0.15, -dy / 160), 1).normalize();
    this.shotPower = Math.min(1, length / 220);
    this.resolveShot(performance.now() - this.state.swipeStart.time);
    this.state.swipeStart = undefined;
  }
  private applySelection(): void {
    const body = this.scene.getMeshByName('batter-body');
    if (body) body.material = this.material('selectedJersey', this.team.primary);
  }
  private startMatch(): void {
    this.screen = 'match';
    this.state = { runs: 0, wickets: 0, balls: 0, target: 12, delivery: 'idle' };
    this.message = 'Swipe when the ball reaches you';
    this.ball.position.copyFrom(this.ballOrigin);
    this.renderUI();
    window.setTimeout(() => this.beginDelivery(), 900);
  }
  private beginDelivery(): void {
    if (this.screen !== 'match' || this.state.balls >= 6 || this.state.wickets >= 2) return;
    this.state.delivery = 'runup';
    this.deliveryTimer = 0;
    this.message = 'Bowler running in…';
    this.bowler.position.z = 18;
    this.ball.position.copyFrom(this.ballOrigin);
    this.renderUI();
  }
  private resolveShot(reactionMs: number): void {
    if (this.state.delivery !== 'released') return;
    const timingDistance = Math.abs(this.ball.position.z + 7.2);
    const timing = Math.max(0, 1 - timingDistance / 5.2);
    const quality = timing * 0.72 + this.shotPower * 0.32 - Math.abs(this.swipeDirection.x) * 0.1;
    this.state.delivery = 'resolved';
    if (quality < 0.2 || reactionMs > 900) {
      this.state.wickets += 1;
      this.message = quality < 0.1 ? 'BOWLED!' : 'Caught behind!';
      this.ballVelocity.set(0, 0.4, -7);
    } else {
      const runs = quality > 0.78 ? 6 : quality > 0.58 ? 4 : quality > 0.42 ? 2 : 1;
      this.state.runs += runs;
      this.message = runs === 6 ? 'SIX! Perfect timing' : runs === 4 ? 'FOUR! Beautiful shot' : `${runs} run${runs > 1 ? 's' : ''}`;
      this.ballVelocity.set(this.swipeDirection.x * (13 + 9 * this.shotPower), 8 + 10 * this.shotPower, 17 + 10 * this.shotPower);
      this.animateBat();
    }
    this.renderUI();
  }
  private animateBat(): void {
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 420);
      this.bat.rotation.z = -0.35 + Math.sin(p * Math.PI) * 2.2;
      if (p < 1) requestAnimationFrame(tick);
      else this.bat.rotation.z = -0.35;
    };
    requestAnimationFrame(tick);
  }
  private update(dt: number): void {
    if (this.screen !== 'match') return;
    this.deliveryTimer += dt;
    if (this.state.delivery === 'runup') {
      this.bowler.position.z -= dt * 8.8;
      if (this.bowler.position.z <= 11.7) {
        this.state.delivery = 'released';
        this.ball.position.set(0, 2.15, 10.4);
        this.ballVelocity.set((Math.random() - 0.5) * 0.7, 0.35, -17.8);
        this.message = 'SWIPE NOW';
        this.renderUI();
      }
    } else if (this.state.delivery === 'released') {
      this.ballVelocity.y -= 9.8 * dt;
      this.ball.position.addInPlace(this.ballVelocity.scale(dt));
      if (this.ball.position.y < 0.3 && this.ball.position.z > -5) {
        this.ball.position.y = 0.3;
        this.ballVelocity.y = Math.abs(this.ballVelocity.y) * 0.62;
      }
      if (this.ball.position.z < -10.5) {
        this.state.wickets += 1;
        this.state.delivery = 'resolved';
        this.message = 'MISSED — bowled!';
        this.renderUI();
      }
    } else if (this.state.delivery === 'resolved') {
      this.ballVelocity.y -= 9.8 * dt;
      this.ball.position.addInPlace(this.ballVelocity.scale(dt));
      if (this.deliveryTimer > 2.8) this.completeBall();
    }
  }
  private completeBall(): void {
    this.state.balls += 1;
    this.state.delivery = 'idle';
    this.deliveryTimer = 0;
    this.ball.position.copyFrom(this.ballOrigin);
    const won = this.state.runs >= this.state.target;
    const ended = won || this.state.balls >= 6 || this.state.wickets >= 2;
    if (ended) {
      this.screen = 'result';
      this.state.delivery = 'finished';
      this.renderUI();
    } else {
      this.message = `${6 - this.state.balls} ball${6 - this.state.balls === 1 ? '' : 's'} remaining`;
      this.renderUI();
      window.setTimeout(() => this.beginDelivery(), 800);
    }
  }
  private renderUI(): void {
    if (this.screen === 'opening') {
      this.overlay.innerHTML = `<section class="screen opening"><div class="hero-card"><div class="logo-ball">🏏</div><p class="eyebrow">DEVANG GAMES</p><h1>Cricket Captain 3D</h1><p>Build your captain. Pick your team. Chase the target in a fast cartoon cricket showdown.</p><button data-action="start" class="primary">Play Now</button></div></section>`;
      return;
    }
    if (this.screen === 'captain') {
      this.overlay.innerHTML = `<section class="screen selection"><div class="selection-card"><p class="eyebrow">STEP 1 OF 2</p><h2>Choose your captain</h2><div class="card-grid">${captains.map(c => `<button class="choice" data-action="captain" data-value="${c.id}"><span class="avatar" style="--jersey:${c.jersey};--skin:${c.skin}"></span><strong>${c.name}</strong><small>${c.style}</small></button>`).join('')}</div></div></section>`;
      return;
    }
    if (this.screen === 'team') {
      this.overlay.innerHTML = `<section class="screen selection"><div class="selection-card wide"><p class="eyebrow">STEP 2 OF 2</p><h2>Select your team</h2><div class="team-grid">${teams.map(t => `<button class="team-choice" data-action="team" data-value="${t.id}" style="--primary:${t.primary};--secondary:${t.secondary}"><span class="team-badge">${t.short}</span><strong>${t.name}</strong><small>${t.strength}</small></button>`).join('')}</div></div></section>`;
      return;
    }
    if (this.screen === 'match') {
      this.overlay.innerHTML = `<div class="hud"><div class="score-card"><span>${this.team.short}</span><strong>${this.state.runs}/${this.state.wickets}</strong><small>${Math.floor(this.state.balls / 6)}.${this.state.balls % 6} overs</small></div><div class="target-card">TARGET <strong>${this.state.target}</strong><small>${Math.max(0, this.state.target - this.state.runs)} needed</small></div><div class="message ${this.message.includes('SWIPE') ? 'pulse' : ''}">${this.message}</div><div class="swipe-guide"><span>↖</span><span>↑</span><span>↗</span><small>Swipe to play a shot</small></div></div>`;
      return;
    }
    const won = this.state.runs >= this.state.target;
    this.overlay.innerHTML = `<section class="screen result"><div class="result-card"><div class="result-icon">${won ? '🏆' : '🏏'}</div><p class="eyebrow">MATCH RESULT</p><h2>${won ? 'Victory!' : 'So close!'}</h2><p>${this.team.name} scored <strong>${this.state.runs}/${this.state.wickets}</strong> in ${this.state.balls} balls.</p><div class="result-actions"><button data-action="retry" class="primary">Play Again</button><button data-action="home" class="secondary">Home</button></div></div></section>`;
  }
}
