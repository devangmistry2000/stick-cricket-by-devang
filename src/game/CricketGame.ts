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
type CharacterRole = 'batter' | 'bowler' | 'keeper' | 'fielder';
type CharacterRig = {
  root: TransformNode;
  torso: Mesh;
  head: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  leftLeg: TransformNode;
  rightLeg: TransformNode;
};
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
  private batterRig!: CharacterRig;
  private bat!: Mesh;
  private bowler!: TransformNode;
  private bowlerRig!: CharacterRig;
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

  private part(name: string, parent: TransformNode, kind: 'box' | 'sphere' | 'capsule' | 'cylinder', size: Vector3, position: Vector3, color: string): Mesh {
    let mesh: Mesh;
    if (kind === 'box') mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    else if (kind === 'sphere') mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 12 }, this.scene);
    else if (kind === 'capsule') mesh = MeshBuilder.CreateCapsule(name, { height: size.y, radius: size.x }, this.scene);
    else mesh = MeshBuilder.CreateCylinder(name, { height: size.y, diameterTop: size.x, diameterBottom: size.z || size.x, tessellation: 10 }, this.scene);
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    if (kind === 'sphere') mesh.scaling.copyFrom(size);
    mesh.material = this.material(`${name}-mat`, color);
    this.shadow.addShadowCaster(mesh);
    return mesh;
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
    this.batterRig = this.createCartoonCharacter('batter', new Vector3(0, 0, -7.6), this.captain.jersey, this.captain.skin, 'batter');
    this.batter = this.batterRig.root;
    this.batter.rotation.y = Math.PI;
    this.bat = MeshBuilder.CreateBox('bat', { width: 0.52, height: 4.25, depth: 0.25 }, this.scene);
    this.bat.material = this.material('batMat', '#e8b96e');
    this.bat.parent = this.batterRig.rightArm;
    this.bat.position.set(0, -1.7, -0.2);
    this.bat.rotation.z = -0.2;
    this.shadow.addShadowCaster(this.bat);

    this.bowlerRig = this.createCartoonCharacter('bowler', new Vector3(0, 0, 14.5), '#f05a3b', '#9a5a38', 'bowler');
    this.bowler = this.bowlerRig.root;
    const keeper = this.createCartoonCharacter('keeper', new Vector3(0, 0, -11.2), '#ffc93c', '#c58458', 'keeper');
    keeper.root.scaling.setAll(0.9);
    for (const [x, z] of [[-14, -2], [14, -2], [-18, 10], [18, 10], [-10, 19], [10, 19]]) {
      const fielder = this.createCartoonCharacter(`fielder-${x}-${z}`, new Vector3(x, 0, z), '#f05a3b', '#c58458', 'fielder');
      fielder.root.scaling.setAll(0.72);
      fielder.root.rotation.y = Math.atan2(-x, -z);
    }

    this.ball = MeshBuilder.CreateSphere('ball', { diameter: 0.48, segments: 16 }, this.scene);
    const ballMat = new PBRMaterial('ballMat', this.scene);
    ballMat.albedoColor = Color3.FromHexString('#b51528');
    ballMat.roughness = 0.45;
    this.ball.material = ballMat;
    this.ball.position.copyFrom(this.ballOrigin);
    this.shadow.addShadowCaster(this.ball);
  }

  private createCartoonCharacter(name: string, position: Vector3, jersey: string, skin: string, role: CharacterRole): CharacterRig {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(position);
    const shortsColor = role === 'batter' ? '#f4f7fb' : '#263a55';
    const shoeColor = '#17202b';

    const torso = this.part(`${name}-body`, root, 'capsule', new Vector3(0.95, 3.3, 0), new Vector3(0, 3.55, 0), jersey);
    torso.scaling.x = 1.08;
    const chestStripe = this.part(`${name}-stripe`, root, 'box', new Vector3(1.95, 0.38, 1.72), new Vector3(0, 3.7, -0.05), '#ffffff');
    chestStripe.scaling.z = 0.35;

    const waist = this.part(`${name}-waist`, root, 'cylinder', new Vector3(1.65, 0.7, 1.45), new Vector3(0, 1.85, 0), shortsColor);

    const head = new TransformNode(`${name}-head-rig`, this.scene);
    head.parent = root;
    head.position.set(0, 6.3, 0);
    const face = this.part(`${name}-head`, head, 'sphere', new Vector3(1.25, 1.35, 1.15), Vector3.Zero(), skin);
    face.scaling.y = 1.08;
    const nose = this.part(`${name}-nose`, head, 'sphere', new Vector3(0.16, 0.2, 0.18), new Vector3(0, -0.05, -1.1), skin);
    const mouth = this.part(`${name}-mouth`, head, 'box', new Vector3(0.48, 0.08, 0.08), new Vector3(0, -0.42, -1.08), '#6f2c2c');
    mouth.rotation.z = 0.05;
    for (const x of [-0.42, 0.42]) {
      const white = this.part(`${name}-eye-white-${x}`, head, 'sphere', new Vector3(0.25, 0.2, 0.1), new Vector3(x, 0.2, -1.05), '#ffffff');
      white.scaling.y = 0.9;
      this.part(`${name}-eye-${x}`, head, 'sphere', new Vector3(0.105, 0.105, 0.07), new Vector3(x, 0.19, -1.14), '#171717');
      const brow = this.part(`${name}-brow-${x}`, head, 'box', new Vector3(0.42, 0.07, 0.08), new Vector3(x, 0.5, -1.04), '#2b1c18');
      brow.rotation.z = x < 0 ? -0.08 : 0.08;
    }
    const earL = this.part(`${name}-ear-l`, head, 'sphere', new Vector3(0.22, 0.34, 0.18), new Vector3(-1.17, 0, 0), skin);
    const earR = this.part(`${name}-ear-r`, head, 'sphere', new Vector3(0.22, 0.34, 0.18), new Vector3(1.17, 0, 0), skin);
    earL.scaling.z = earR.scaling.z = 0.8;

    if (role === 'batter' || role === 'keeper') {
      const helmet = this.part(`${name}-helmet`, head, 'sphere', new Vector3(1.34, 0.74, 1.24), new Vector3(0, 0.65, 0), role === 'batter' ? '#173b75' : '#e2a71e');
      helmet.scaling.y = 0.72;
      const peak = this.part(`${name}-helmet-peak`, head, 'box', new Vector3(1.45, 0.16, 0.8), new Vector3(0, 0.42, -1.02), role === 'batter' ? '#173b75' : '#e2a71e');
      peak.rotation.x = 0.12;
      for (const x of [-0.72, 0, 0.72]) {
        const grill = this.part(`${name}-grill-${x}`, head, 'cylinder', new Vector3(0.06, 1.05, 0.06), new Vector3(x, -0.18, -1.28), '#d7dde2');
        grill.rotation.z = x * 0.12;
      }
    } else {
      const hair = this.part(`${name}-hair`, head, 'sphere', new Vector3(1.28, 0.55, 1.2), new Vector3(0, 0.72, 0.08), '#241914');
      hair.scaling.y = 0.75;
      const capPeak = this.part(`${name}-cap-peak`, head, 'box', new Vector3(1.3, 0.16, 0.7), new Vector3(0, 0.45, -1), '#243a66');
      capPeak.rotation.x = 0.12;
    }

    const leftArm = new TransformNode(`${name}-left-arm`, this.scene);
    const rightArm = new TransformNode(`${name}-right-arm`, this.scene);
    leftArm.parent = rightArm.parent = root;
    leftArm.position.set(-1.18, 4.45, 0);
    rightArm.position.set(1.18, 4.45, 0);
    for (const [side, arm] of [['l', leftArm], ['r', rightArm]] as const) {
      const upper = this.part(`${name}-${side}-upper-arm`, arm, 'capsule', new Vector3(0.34, 2, 0), new Vector3(0, -0.75, 0), jersey);
      upper.rotation.z = side === 'l' ? -0.13 : 0.13;
      this.part(`${name}-${side}-hand`, arm, 'sphere', new Vector3(0.43, 0.46, 0.4), new Vector3(0, -1.75, 0), role === 'batter' || role === 'keeper' ? '#f2f4f7' : skin);
    }

    const leftLeg = new TransformNode(`${name}-left-leg`, this.scene);
    const rightLeg = new TransformNode(`${name}-right-leg`, this.scene);
    leftLeg.parent = rightLeg.parent = root;
    leftLeg.position.set(-0.55, 1.7, 0);
    rightLeg.position.set(0.55, 1.7, 0);
    for (const [side, leg] of [['l', leftLeg], ['r', rightLeg]] as const) {
      this.part(`${name}-${side}-leg`, leg, 'capsule', new Vector3(0.43, 2.4, 0), new Vector3(0, -0.9, 0), shortsColor);
      const shoe = this.part(`${name}-${side}-shoe`, leg, 'box', new Vector3(0.8, 0.43, 1.25), new Vector3(0, -2.05, -0.23), shoeColor);
      shoe.rotation.x = -0.08;
      if (role === 'batter' || role === 'keeper') {
        const pad = this.part(`${name}-${side}-pad`, leg, 'box', new Vector3(0.72, 1.72, 0.38), new Vector3(0, -0.78, -0.48), '#f5f2df');
        pad.rotation.x = -0.05;
      }
    }

    if (role === 'keeper') {
      leftArm.rotation.z = -0.4;
      rightArm.rotation.z = 0.4;
      leftArm.rotation.x = rightArm.rotation.x = -0.55;
      leftLeg.rotation.z = -0.13;
      rightLeg.rotation.z = 0.13;
      root.scaling.y = 0.93;
    } else if (role === 'fielder') {
      leftArm.rotation.z = -0.12;
      rightArm.rotation.z = 0.12;
    } else if (role === 'batter') {
      leftArm.rotation.x = -0.55;
      rightArm.rotation.x = -0.72;
      leftArm.rotation.z = 0.18;
      rightArm.rotation.z = -0.15;
      leftLeg.rotation.z = -0.06;
      rightLeg.rotation.z = 0.08;
    }

    return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg };
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
    const stripe = this.scene.getMeshByName('batter-stripe');
    if (stripe) stripe.material = this.material('selectedStripe', this.team.secondary);
  }

  private startMatch(): void {
    this.screen = 'match';
    this.state = { runs: 0, wickets: 0, balls: 0, target: 12, delivery: 'idle' };
    this.message = 'Swipe when the ball reaches you';
    this.ball.position.copyFrom(this.ballOrigin);
    this.resetCharacterPose();
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
      this.animateMiss();
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
    const direction = this.swipeDirection.x;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 520);
      const swing = Math.sin(p * Math.PI);
      this.batterRig.root.rotation.y = Math.PI - direction * 0.5 * swing;
      this.batterRig.rightArm.rotation.z = -0.15 + 1.7 * swing;
      this.batterRig.rightArm.rotation.x = -0.72 - 0.75 * swing;
      this.batterRig.leftArm.rotation.z = 0.18 + 0.9 * swing;
      this.batterRig.leftLeg.rotation.z = -0.06 - 0.16 * swing;
      this.bat.rotation.z = -0.2 + swing * 1.6;
      if (p < 1) requestAnimationFrame(tick);
      else this.resetCharacterPose();
    };
    requestAnimationFrame(tick);
  }

  private animateMiss(): void {
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 560);
      const sway = Math.sin(p * Math.PI);
      this.batterRig.head.rotation.z = 0.16 * sway;
      this.batterRig.rightArm.rotation.z = -0.15 + 0.7 * sway;
      this.batterRig.root.rotation.x = -0.08 * sway;
      if (p < 1) requestAnimationFrame(tick);
      else this.resetCharacterPose();
    };
    requestAnimationFrame(tick);
  }

  private resetCharacterPose(): void {
    if (!this.batterRig) return;
    this.batterRig.root.rotation.set(0, Math.PI, 0);
    this.batterRig.head.rotation.set(0, 0, 0);
    this.batterRig.leftArm.rotation.set(-0.55, 0, 0.18);
    this.batterRig.rightArm.rotation.set(-0.72, 0, -0.15);
    this.batterRig.leftLeg.rotation.set(0, 0, -0.06);
    this.batterRig.rightLeg.rotation.set(0, 0, 0.08);
    this.bat.rotation.set(0, 0, -0.2);
  }

  private update(dt: number): void {
    if (this.screen !== 'match') return;
    this.deliveryTimer += dt;
    const idle = performance.now() * 0.002;
    this.batterRig.head.rotation.y = Math.sin(idle) * 0.035;
    if (this.state.delivery === 'runup') {
      this.bowler.position.z -= dt * 8.8;
      const run = Math.sin(this.deliveryTimer * 15);
      this.bowlerRig.leftArm.rotation.x = run * 0.7;
      this.bowlerRig.rightArm.rotation.x = -run * 0.7;
      this.bowlerRig.leftLeg.rotation.x = -run * 0.55;
      this.bowlerRig.rightLeg.rotation.x = run * 0.55;
      this.bowlerRig.root.position.y = Math.abs(run) * 0.08;
      if (this.bowler.position.z <= 11.7) {
        this.state.delivery = 'released';
        this.bowlerRig.rightArm.rotation.x = -2.1;
        this.bowlerRig.leftArm.rotation.x = 0.65;
        this.bowlerRig.root.position.y = 0;
        this.ball.position.set(0, 2.15, 10.4);
        this.ballVelocity.set((Math.random() - 0.5) * 0.7, 0.35, -17.8);
        this.message = 'SWIPE NOW';
        this.renderUI();
      }
    } else if (this.state.delivery === 'released') {
      this.ballVelocity.y -= 9.8 * dt;
      this.ball.position.addInPlace(this.ballVelocity.scale(dt));
      this.ball.rotation.x += dt * 18;
      if (this.ball.position.y < 0.3 && this.ball.position.z > -5) {
        this.ball.position.y = 0.3;
        this.ballVelocity.y = Math.abs(this.ballVelocity.y) * 0.62;
      }
      if (this.ball.position.z < -10.5) {
        this.state.wickets += 1;
        this.state.delivery = 'resolved';
        this.message = 'MISSED — bowled!';
        this.animateMiss();
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
    this.bowlerRig.leftArm.rotation.set(0, 0, 0);
    this.bowlerRig.rightArm.rotation.set(0, 0, 0);
    this.bowlerRig.leftLeg.rotation.set(0, 0, 0);
    this.bowlerRig.rightLeg.rotation.set(0, 0, 0);
    this.bowlerRig.root.position.y = 0;
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
