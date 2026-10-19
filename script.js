/* ============================================================
   SYNTH AUDIO ENGINE (Web Audio API - Zero External Files)
   ============================================================ */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, gainLevel = 0.15) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }

  paddleHit() {
    this.playTone(320, 'sine', 0.12, 0.2);
  }

  brickHit(pitchModifier = 1) {
    this.playTone(520 * pitchModifier, 'triangle', 0.14, 0.18);
  }

  lifeLost() {
    this.playTone(140, 'sawtooth', 0.35, 0.25);
  }

  stageWin() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.25, 0.2), idx * 80);
    });
  }
}

const audio = new SoundEngine();

/* ============================================================
   PAGE ROUTER / SCREEN MANAGER
   ============================================================ */
const screens = {
  menu: document.getElementById('screen-menu'),
  game: document.getElementById('screen-game'),
  gameOver: document.getElementById('screen-gameover'),
  victory: document.getElementById('screen-victory')
};

function navigateTo(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

/* ============================================================
   GAME LOGIC & RENDER LOOP
   ============================================================ */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const stageBox = document.getElementById('stage-box');

const uiScore = document.getElementById('ui-score');
const uiStage = document.getElementById('ui-stage');
const uiLives = document.getElementById('ui-lives');
const finalScore = document.getElementById('final-score');
const finalStage = document.getElementById('final-stage');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

let score = 0;
let lives = 3;
let stage = 1;
let isLoopRunning = false;
let animId = null;

const paddle = {
  w: 92,
  h: 12,
  x: WIDTH / 2 - 46,
  y: HEIGHT - 38,
  speed: 8,
  dx: 0
};

const ball = {
  x: WIDTH / 2,
  y: HEIGHT - 65,
  radius: 6,
  speed: 5.5,
  dx: 3.5,
  dy: -4
};

let bricks = [];
let particles = [];

const PALETTES = [
  ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'],
  ['#2dd4bf', '#38bdf8', '#a855f7', '#fb7185'],
  ['#fbbf24', '#f87171', '#c084fc', '#38bdf8']
];

function buildBricks() {
  bricks = [];
  const rows = 5;
  const cols = 6;
  const pad = 10;
  const topOffset = 50;
  const sideOffset = 18;
  const brickW = (WIDTH - (sideOffset * 2) - ((cols - 1) * pad)) / cols;
  const brickH = 18;
  const currentPalette = PALETTES[(stage - 1) % PALETTES.length];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: sideOffset + c * (brickW + pad),
        y: topOffset + r * (brickH + pad),
        w: brickW,
        h: brickH,
        color: currentPalette[r % currentPalette.length],
        points: (rows - r) * 20,
        active: true
      });
    }
  }
}

function spawnGlassShards(x, y, color) {
  for (let i = 0; i < 9; i++) {
    particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      w: Math.random() * 4 + 2,
      h: Math.random() * 4 + 2,
      color,
      alpha: 1,
      decay: Math.random() * 0.03 + 0.02
    });
  }
}

function resetPositions() {
  paddle.x = WIDTH / 2 - paddle.w / 2;
  ball.x = WIDTH / 2;
  ball.y = HEIGHT - 65;
  ball.speed = 5.2 + stage * 0.45;
  ball.dx = (Math.random() > 0.5 ? 1 : -1) * (ball.speed * 0.65);
  ball.dy = -Math.abs(ball.speed * 0.85);
}

function syncHearts() {
  const hearts = uiLives.querySelectorAll('.heart');
  hearts.forEach((h, idx) => {
    if (idx < lives) {
      h.classList.remove('lost');
    } else {
      h.classList.add('lost');
    }
  });
}

function update() {
  // Paddle movement
  paddle.x += paddle.dx;
  if (paddle.x < 10) paddle.x = 10;
  if (paddle.x + paddle.w > WIDTH - 10) paddle.x = WIDTH - paddle.w - 10;

  // Ball movement
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Horizontal wall bounces
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.dx = -ball.dx;
    audio.playTone(240, 'sine', 0.06, 0.1);
  } else if (ball.x + ball.radius > WIDTH) {
    ball.x = WIDTH - ball.radius;
    ball.dx = -ball.dx;
    audio.playTone(240, 'sine', 0.06, 0.1);
  }

  // Ceiling bounce
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.dy = -ball.dy;
    audio.playTone(240, 'sine', 0.06, 0.1);
  }

  // Paddle collision
  if (
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.h &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.w
  ) {
    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    const angle = hit * (Math.PI / 3);
    ball.dx = ball.speed * Math.sin(angle);
    ball.dy = -ball.speed * Math.cos(angle);
    ball.y = paddle.y - ball.radius;
    audio.paddleHit();
  }

  // Brick collision
  let remainingBricks = 0;
  bricks.forEach((b, idx) => {
    if (!b.active) return;
    remainingBricks++;

    if (
      ball.x + ball.radius > b.x &&
      ball.x - ball.radius < b.x + b.w &&
      ball.y + ball.radius > b.y &&
      ball.y - ball.radius < b.y + b.h
    ) {
      b.active = false;
      ball.dy = -ball.dy;
      score += b.points;
      uiScore.textContent = score;
      spawnGlassShards(b.x + b.w / 2, b.y + b.h / 2, b.color);
      audio.brickHit(1 + (idx % 5) * 0.15);
    }
  });

  // Level Clear
  if (remainingBricks === 0) {
    isLoopRunning = false;
    cancelAnimationFrame(animId);
    audio.stageWin();
    navigateTo('victory');
    return;
  }

  // Bottom Void (Life loss)
  if (ball.y - ball.radius > HEIGHT) {
    lives--;
    syncHearts();
    audio.lifeLost();

    if (lives <= 0) {
      isLoopRunning = false;
      cancelAnimationFrame(animId);
      finalScore.textContent = score;
      finalStage.textContent = stage;
      navigateTo('gameOver');
      return;
    } else {
      resetPositions();
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= p.decay;
    if (p.alpha <= 0) particles.splice(i, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Draw Bricks (Frosted pill glass)
  bricks.forEach(b => {
    if (!b.active) return;
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 6);
    ctx.fill();

    // Specular Top Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, 3, 2);
    ctx.fill();
    ctx.restore();
  });

  // Draw Paddle (Liquid Glass Capsule)
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 999);
  ctx.fill();
  ctx.stroke();

  // Glass Inner Core
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(paddle.x + 10, paddle.y + 4, paddle.w - 20, 4, 999);
  ctx.fill();
  ctx.restore();

  // Draw Ball (Glowing Orb)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw Shards
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  });
}

function gameLoop() {
  if (!isLoopRunning) return;
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

function startFreshGame() {
  audio.init();
  score = 0;
  lives = 3;
  stage = 1;
  uiScore.textContent = score;
  uiStage.textContent = stage;
  syncHearts();
  buildBricks();
  resetPositions();
  navigateTo('game');
  isLoopRunning = true;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(gameLoop);
}

function nextStage() {
  stage++;
  uiStage.textContent = stage;
  buildBricks();
  resetPositions();
  navigateTo('game');
  isLoopRunning = true;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(gameLoop);
}

/* ============================================================
   EVENT LISTENERS & CONTROLS
   ============================================================ */
// Button Triggers
document.getElementById('btn-play').addEventListener('click', startFreshGame);
document.getElementById('btn-retry').addEventListener('click', startFreshGame);
document.getElementById('btn-next-stage').addEventListener('click', nextStage);

document.getElementById('btn-how').addEventListener('click', () => {
  const box = document.getElementById('instructions-box');
  box.classList.toggle('hidden');
});

document.getElementById('btn-quit').addEventListener('click', () => {
  isLoopRunning = false;
  cancelAnimationFrame(animId);
  navigateTo('menu');
});

document.getElementById('btn-home-over').addEventListener('click', () => navigateTo('menu'));
document.getElementById('btn-home-vic').addEventListener('click', () => navigateTo('menu'));

const soundBtn = document.getElementById('btn-sound-toggle');
soundBtn.addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  soundBtn.textContent = `Audio: ${audio.enabled ? 'ON' : 'OFF'}`;
});

// Keyboard Controls (PC)
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    paddle.dx = -paddle.speed;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    paddle.dx = paddle.speed;
  }
});

window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) {
    paddle.dx = 0;
  }
});

// Mouse Control (Desktop Trackpad/Mouse)
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const mouseX = (e.clientX - rect.left) * scaleX;
  paddle.x = mouseX - paddle.w / 2;
});

// Direct Touch / Drag Control (Mobile)
stageBox.addEventListener('touchmove', (e) => {
  if (!isLoopRunning) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const touchX = (e.touches[0].clientX - rect.left) * scaleX;
  paddle.x = touchX - paddle.w / 2;
}, { passive: false });