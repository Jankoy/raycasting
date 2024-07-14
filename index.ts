const EPS = 1e-6;
const NEAR_CLIPPING_PLANE = 0.25;
const FAR_CLIPPING_PLANE = 12.0;
const FOV = Math.PI * 0.5;
const H_FOV = FOV * 0.5;
const STRIP_COUNT = 300;
const PLAYER_TURN = Math.PI*0.0125;
const PLAYER_STEP = 0.05;

class Vector2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static zero(): Vector2D {
    return new Vector2D(0, 0);
  }

  static fromAngle(angle: number): Vector2D {
    return new Vector2D(Math.cos(angle), Math.sin(angle));
  }

  add(that: Vector2D): Vector2D {
    return new Vector2D(this.x + that.x, this.y + that.y);
  }

  sub(that: Vector2D): Vector2D {
    return new Vector2D(this.x - that.x, this.y - that.y);
  }

  mul(that: Vector2D): Vector2D {
    return new Vector2D(this.x * that.x, this.y * that.y);
  }

  div(that: Vector2D): Vector2D {
    return new Vector2D(this.x / that.x, this.y / that.y);
  }

  scale(factor: number): Vector2D {
    return new Vector2D(this.x * factor, this.y * factor);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  sqrLength(): number {
    return this.x * this.x + this.y * this.y;
  }

  norm(): Vector2D {
    const l = this.length();
    if (l === 0) return Vector2D.zero();
    return this.scale(1 / l);
  }

  distanceTo(that: Vector2D): number {
    return that.sub(this).length();
  }

  sqrDistanceTo(that: Vector2D): number {
    return that.sub(this).sqrLength();
  }

  rot90(): Vector2D {
    return new Vector2D(-this.y, this.x);
  }

  lerp(that: Vector2D, t: number): Vector2D {
    return that.sub(this).scale(t).add(this);
  }

  dot(that: Vector2D): number {
    return this.x * that.x + this.y * that.y;
  }

  array(): [number, number] {
    return [this.x, this.y];
  }
}

class Player {
  position: Vector2D;
  direction: number;

  constructor(position: Vector2D, direction: number) {
    this.position = position;
    this.direction = direction;
  }

  view(): [Vector2D, Vector2D] {
    const l = Math.tan(H_FOV) * NEAR_CLIPPING_PLANE;
    const p = this.position.add(Vector2D.fromAngle(this.direction).scale(NEAR_CLIPPING_PLANE));
    const p1 = p.sub(p.sub(this.position).rot90().norm().scale(l));
    const p2 = p.add(p.sub(this.position).rot90().norm().scale(l));
    return [p1, p2];
  }
}

type Scene = Array<Array<string | null>>;

function fillCircle(
  ctx: CanvasRenderingContext2D,
  center: Vector2D,
  radius: number,
): void {
  ctx.beginPath();
  ctx.arc(...center.array(), radius, 0, 2 * Math.PI);
  ctx.fill();
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  p1: Vector2D,
  p2: Vector2D,
): void {
  ctx.beginPath();
  ctx.moveTo(...p1.array());
  ctx.lineTo(...p2.array());
  ctx.stroke();
}

function canvasSize(ctx: CanvasRenderingContext2D): Vector2D {
  return new Vector2D(ctx.canvas.width, ctx.canvas.height);
}

function snap(x: number, dx: number): number {
  if (dx > 0) return Math.ceil(x + EPS);
  if (dx < 0) return Math.floor(x + -EPS);
  return x;
}

function hittingCell(p1: Vector2D, p2: Vector2D): Vector2D {
  const d = p2.sub(p1);
  return new Vector2D(
    Math.floor(p2.x + Math.sign(d.x) * EPS),
    Math.floor(p2.y + Math.sign(d.y) * EPS),
  );
}

function rayStep(p1: Vector2D, p2: Vector2D): Vector2D {
  let p3 = p2;
  const d = p2.sub(p1);

  if (d.x !== 0) {
    const k = d.y / d.x;
    const c = p1.y - k * p1.x;

    {
      const x3 = snap(p2.x, d.x);
      const y3 = x3 * k + c;
      p3 = new Vector2D(x3, y3);
    }

    if (k !== 0) {
      const y3 = snap(p2.y, d.y);
      const x3 = (y3 - c) / k;
      const temp = new Vector2D(x3, y3);
      if (p2.distanceTo(temp) < p2.distanceTo(p3)) {
        p3 = temp;
      }
    }
  } else {
    const y3 = snap(p2.y, d.y);
    const x3 = p2.x;
    p3 = new Vector2D(x3, y3);
  }

  return p3;
}

function sceneSize(scene: Scene): Vector2D {
  const y = scene.length;
  let x = Number.MIN_VALUE;
  for (let row of scene) {
    x = Math.max(x, row.length);
  }
  return new Vector2D(x, y);
}

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  player: Player,
): void {
  ctx.save();

  ctx.fillStyle = "#181818";
  ctx.strokeStyle = "#363636";

  const gridSize = sceneSize(scene);
  const position = Vector2D.zero().add(canvasSize(ctx).scale(0.03));
  const cellSize = ctx.canvas.width * 0.03;
  const size = gridSize.scale(cellSize);

  ctx.translate(...position.array());
  ctx.scale(...size.div(gridSize).array());
  ctx.lineWidth = 0.05;

  ctx.beginPath();
  ctx.fillRect(0, 0, ...gridSize.array());
  ctx.fill();
  
  for (let y = 0; y < gridSize.y; ++y) {
    for (let x = 0; x < gridSize.x; ++x) {
      if (scene[y][x] !== null) {
        ctx.fillStyle = scene[y][x]!;
        ctx.beginPath();
        ctx.fillRect(x, y, 1, 1);
        ctx.fill();
      }
    }
  }

  for (let x = 0; x <= gridSize.x; ++x) {
    const p1 = new Vector2D(x, 0);
    const p2 = new Vector2D(x, gridSize.y);
    strokeLine(ctx, p1, p2);
  }

  for (let y = 0; y <= gridSize.y; ++y) {
    const p1 = new Vector2D(0, y);
    const p2 = new Vector2D(gridSize.x, y);
    strokeLine(ctx, p1, p2);
  }

  ctx.fillStyle = "magenta";
  ctx.strokeStyle = "magenta";

  fillCircle(ctx, player.position, 0.2);
  const [p1, p2] = player.view();
  strokeLine(ctx, player.position, p1);
  strokeLine(ctx, player.position, p2);
  strokeLine(ctx, p1, p2);

  ctx.restore();
}

function insideScene(scene: Scene, p: Vector2D): boolean {
  const size = sceneSize(scene);
  return 0 <= p.x && p.x < size.x && 0 <= p.y && p.y < size.y;
}

function castRay(scene: Scene, p1: Vector2D, p2: Vector2D): Vector2D {
  let start = p1;
  while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE ** 2) {
    const c = hittingCell(p1, p2);
    if (insideScene(scene, c) && scene[c.y][c.x] !== null) break;
    const p3 = rayStep(p1, p2);
    p1 = p2;
    p2 = p3;
  }
  return p2;
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  player: Player,
): void {
  const stripWidth = Math.ceil(ctx.canvas.width / STRIP_COUNT);
  const [p1, p2] = player.view();
  for (let x = 0; x < STRIP_COUNT; ++x) {
    const p = castRay(scene, player.position, p1.lerp(p2, x / STRIP_COUNT));
    const c = hittingCell(player.position, p);
    if (insideScene(scene, c) && scene[c.y][c.x] !== null) {
      const v = p.sub(player.position);
      const d = Vector2D.fromAngle(player.direction);
      const stripHeight = ctx.canvas.height / v.dot(d);
      ctx.fillStyle = scene[c.y][c.x]!;
      ctx.beginPath();
      ctx.fillRect(x * stripWidth, (ctx.canvas.height - stripHeight) * 0.5, stripWidth + 1, stripHeight);
      ctx.fill();
    }
  }
}

function renderGame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  player: Player,
): void {
  ctx.reset();

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.fillRect(0, 0, ...canvasSize(ctx).array());
  ctx.fill();

  renderScene(ctx, scene, player);
  renderMinimap(ctx, scene, player);
}

(() => {
  const scene: Scene = [
    [null,  null,  null, null,   "blue", null, null,    null,    null,    null],
    [null,  null,  null, "blue", null,   null, null,    null,    null,    null],
    [null,  null,  null, "blue", "blue", null, null,    null,    null,    null],
    [null,  null,  null, null,   null,   null, null,    null,    null,    null],
    [null,  null,  null, null,   null,   null, null,    null,    null,    null],
    ["red", null,  null, null,   null,   null, null,    null,    null,    null],
    ["red", "red", null, null,   null,   null, "green", "green", "green", null],
    ["red", null,  null, null,   null,   null, null,    null,    null,    null],
    ["red", null,  null, null,   null,   null, null,    null,    null,    null],
    [null,  null,  null, null,   null,   null, null,    null,    null,    null],
  ];
  
  const game = document.getElementById("game") as (HTMLCanvasElement | null);
  if (game === null) {
    throw new Error("No canvas with id `game` is found");
  }

  const ctx = game.getContext("2d");
  if (ctx === null) {
    throw new Error("2D context is not supported");
  }
  
  let player = new Player(
    sceneSize(scene).mul(new Vector2D(0.5, 0.5)),
    Math.PI * 0.25,
  );
  
  let keyStates: {[code: string]: boolean} = {};

  window.addEventListener("keydown", (e) => {
    keyStates[e.code] = !e.repeat || keyStates[e.code];
  });

  window.addEventListener("keyup", (e) => {
    keyStates[e.code] = false;
  });

  let prevTimestamp = 0;

  const frame = (timestamp: number) => {
    const deltaTime = (timestamp - prevTimestamp) / 1000;
    prevTimestamp = timestamp;
    if (keyStates["KeyW"]) player.position = player.position.add(Vector2D.fromAngle(player.direction).scale(PLAYER_STEP * deltaTime * 60));
    if (keyStates["KeyS"]) player.position = player.position.sub(Vector2D.fromAngle(player.direction).scale(PLAYER_STEP * deltaTime * 60));
    if (keyStates["KeyA"]) player.direction -= PLAYER_TURN * deltaTime * 60;
    if (keyStates["KeyD"]) player.direction += PLAYER_TURN * deltaTime * 60;
    renderGame(ctx, scene, player);
    window.requestAnimationFrame(frame)
  }
  
  window.requestAnimationFrame((timestamp) => {
    prevTimestamp = timestamp;
    window.requestAnimationFrame(frame)
  });
})();
