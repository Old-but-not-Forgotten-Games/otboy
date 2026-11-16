// Арканоид — 50 уровней, настройки, топ-5, выбор уровня.
// Вся логика на клиенте; данные — в localStorage.
// Уровни генерируются процедурно (50 штук без роста бандла — лениза не нужна).

const W = 480;
const H = 720;
const BORDER = 6; // видимая рамка поля

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// --- адаптивное масштабирование ---------------------------------------------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// --- настройки и сохранённые данные ------------------------------------------
type Speed = "slow" | "normal" | "fast";
const SPEEDS: Record<Speed, number> = { slow: 300, normal: 380, fast: 480 };

interface ScoreEntry { score: number; level: number; date: string; }

const LS = {
  best: "arkanoid.bestLevel",
  scores: "arkanoid.topScores",
  speed: "arkanoid.speed",
};

function loadBest(): number {
  const v = Number(localStorage.getItem(LS.best));
  return Number.isFinite(v) ? Math.max(0, Math.min(49, v)) : 0;
}
function saveBest(v: number) {
  localStorage.setItem(LS.best, String(Math.max(0, Math.min(49, v))));
}

function loadScores(): ScoreEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS.scores) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveScore() {
  const list = loadScores();
  list.push({ score, level: level + 1, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem(LS.scores, JSON.stringify(list.slice(0, 5)));
}

let speed: Speed = (localStorage.getItem(LS.speed) as Speed) || "normal";
if (!(speed in SPEEDS)) speed = "normal";

// --- состояние игры ------------------------------------------------------------
type State = "ready" | "playing" | "gameover" | "win";

interface Brick { x: number; y: number; w: number; h: number; color: string; alive: boolean; }

const PADDLE_W = 90;
const PADDLE_H = 14;
const BALL_R = 8;
const TOTAL_LEVELS = 50;

let paddleX = W / 2 - PADDLE_W / 2;
let ballX = W / 2, ballY = 0, vx = 0, vy = 0;
let bricks: Brick[] = [];
let state: State = "ready";
let level = 0;
let lives = 3;
let score = 0;
let paused = false;

// --- генерация уровней (50, без «радуги») -------------------------------------
// Палитра: 6 спокойных цветов, на уровень — только 2 (чередуются по рядам).
const PALETTE = ["#4dc3ff", "#6de07a", "#ffb84d", "#ff5d5d", "#b07cff", "#4dd0c4"];

type Pattern = "full" | "checker" | "pyramid" | "diamond" | "columns" | "stripes" | "frame" | "cross";
const PATTERNS: Pattern[] = ["full", "checker", "pyramid", "diamond", "columns", "stripes", "frame", "cross"];

function patternOn(p: Pattern, r: number, c: number, rows: number, cols: number): boolean {
  const midR = (rows - 1) / 2;
  const midC = (cols - 1) / 2;
  switch (p) {
    case "full": return true;
    case "checker": return (r + c) % 2 === 0;
    case "pyramid": return Math.abs(c - midC) <= ((r + 1) * cols) / (2 * rows);
    case "diamond": return Math.abs(r - midR) / rows + Math.abs(c - midC) / cols <= 0.55;
    case "columns": return c % 2 === 0;
    case "stripes": return r % 2 === 0;
    case "frame": return r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
    case "cross": return Math.abs(r - midR) <= 1 || Math.abs(c - midC) <= 1;
  }
}

function makeBricks(n: number): Brick[] {
  const rows = 4 + ((n * 3) % 5); // 4..8
  const cols = 5 + ((n * 7) % 5); // 5..9
  const pattern = PATTERNS[n % PATTERNS.length] ?? "full";
  const cA = PALETTE[n % PALETTE.length] ?? "#4dc3ff";
  const cB = PALETTE[(n + 3) % PALETTE.length] ?? "#6de07a";

  const out: Brick[] = [];
  const margin = 24;
  const gap = 6;
  const bw = (W - margin * 2 - gap * (cols - 1)) / cols;
  const bh = 22;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!patternOn(pattern, r, c, rows, cols)) continue;
      out.push({
        x: margin + c * (bw + gap),
        y: BORDER + 40 + r * (bh + gap),
        w: bw, h: bh,
        color: r % 2 === 0 ? cA : cB,
        alive: true,
      });
    }
  }
  return out;
}

function loadLevel(i: number) {
  bricks = makeBricks(i);
  resetBall();
  state = "ready";
}

function startLevel(i: number) {
  level = i;
  score = 0;
  lives = 3;
  loadLevel(i);
}

function resetBall() {
  paddleX = W / 2 - PADDLE_W / 2;
  ballX = paddleX + PADDLE_W / 2;
  ballY = H - 60 - BALL_R;
  const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
  const sp = SPEEDS[speed];
  vx = Math.cos(angle) * sp;
  vy = Math.sin(angle) * sp;
}

// --- ввод ----------------------------------------------------------------------
let pointerActive = false;

function pointerX(clientX: number) {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * W;
}

canvas.addEventListener("pointerdown", (e) => {
  pointerActive = true;
  canvas.setPointerCapture(e.pointerId);
  movePaddle(e.clientX);
  if (state === "ready") state = "playing";
  else if (state === "gameover" || state === "win") startLevel(0);
});
canvas.addEventListener("pointermove", (e) => {
  if (pointerActive) movePaddle(e.clientX);
});
canvas.addEventListener("pointerup", () => (pointerActive = false));

function movePaddle(clientX: number) {
  paddleX = Math.max(BORDER, Math.min(W - BORDER - PADDLE_W, pointerX(clientX) - PADDLE_W / 2));
}

const keys = { left: false, right: false };
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === " " && state === "ready") state = "playing";
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});

// --- панель настроек -------------------------------------------------------------
const panel = document.getElementById("panel") as HTMLDivElement;
const btnSettings = document.getElementById("btnSettings") as HTMLButtonElement;
const btnClose = document.getElementById("btnClose") as HTMLButtonElement;
const speedSel = document.getElementById("speed") as HTMLSelectElement;
const scoresEl = document.getElementById("scores") as HTMLOListElement;
const levelsEl = document.getElementById("levels") as HTMLDivElement;

function renderScores() {
  const list = loadScores();
  scoresEl.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Пока нет результатов";
    scoresEl.appendChild(li);
    return;
  }
  for (const s of list) {
    const li = document.createElement("li");
    li.textContent = `${s.score} очков — уровень ${s.level} (${s.date})`;
    scoresEl.appendChild(li);
  }
}

function renderLevels() {
  levelsEl.innerHTML = "";
  const best = loadBest();
  for (let i = 0; i < TOTAL_LEVELS; i++) {
    const btn = document.createElement("button");
    const unlocked = i <= best;
    btn.textContent = unlocked ? String(i + 1) : "🔒";
    btn.disabled = !unlocked;
    if (i === level) btn.classList.add("current");
    btn.addEventListener("click", () => {
      startLevel(i);
      closePanel();
    });
    levelsEl.appendChild(btn);
  }
}

function openPanel() {
  paused = true;
  speedSel.value = speed;
  renderScores();
  renderLevels();
  panel.classList.remove("hidden");
}
function closePanel() {
  paused = false;
  panel.classList.add("hidden");
}

btnSettings.addEventListener("click", openPanel);
btnClose.addEventListener("click", closePanel);
speedSel.addEventListener("change", () => {
  speed = (speedSel.value as Speed) in SPEEDS ? (speedSel.value as Speed) : "normal";
  localStorage.setItem(LS.speed, speed);
});

// --- обновление -------------------------------------------------------------------
function update(dt: number) {
  if (paused) return;

  if (state !== "playing") {
    if (state === "ready") {
      ballX = paddleX + PADDLE_W / 2;
      ballY = H - 60 - BALL_R;
    }
    return;
  }

  // управление ракеткой с клавиатуры
  const kspeed = 500 * dt;
  if (keys.left) paddleX -= kspeed;
  if (keys.right) paddleX += kspeed;
  paddleX = Math.max(BORDER, Math.min(W - BORDER - PADDLE_W, paddleX));

  ballX += vx * dt;
  ballY += vy * dt;

  // стены (внутри видимой рамки)
  if (ballX < BORDER + BALL_R) { ballX = BORDER + BALL_R; vx = Math.abs(vx); }
  if (ballX > W - BORDER - BALL_R) { ballX = W - BORDER - BALL_R; vx = -Math.abs(vx); }
  if (ballY < BORDER + BALL_R) { ballY = BORDER + BALL_R; vy = Math.abs(vy); }

  // ракетка
  const py = H - 60;
  if (
    vy > 0 &&
    ballY + BALL_R >= py && ballY + BALL_R <= py + PADDLE_H + 12 &&
    ballX >= paddleX - BALL_R && ballX <= paddleX + PADDLE_W + BALL_R
  ) {
    const hit = (ballX - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2); // -1..1
    const angle = hit * (Math.PI / 3); // максимум 60°
    const sp = SPEEDS[speed];
    vx = Math.sin(angle) * sp;
    vy = -Math.cos(angle) * sp;
    ballY = py - BALL_R;
  }

  // кирпичи
  for (const b of bricks) {
    if (!b.alive) continue;
    if (
      ballX + BALL_R > b.x && ballX - BALL_R < b.x + b.w &&
      ballY + BALL_R > b.y && ballY - BALL_R < b.y + b.h
    ) {
      b.alive = false;
      score += 10;
      const dx = Math.min(ballX + BALL_R - b.x, b.x + b.w - (ballX - BALL_R));
      const dy = Math.min(ballY + BALL_R - b.y, b.y + b.h - (ballY - BALL_R));
      if (dx < dy) vx = -vx; else vy = -vy;
      break;
    }
  }

  // уровень пройден
  if (bricks.every((b) => !b.alive)) {
    saveBest(Math.max(loadBest(), level + 1)); // открываем следующий уровень
    if (level + 1 < TOTAL_LEVELS) {
      level++;
      loadLevel(level);
    } else {
      state = "win";
      saveScore();
    }
    return;
  }

  // мяч потерян
  if (ballY > H + BALL_R * 2) {
    lives--;
    if (lives <= 0) {
      state = "gameover";
      saveScore();
    } else {
      resetBall();
    }
  }
}

// --- отрисовка ---------------------------------------------------------------------
function draw() {
  ctx.clearRect(0, 0, W, H);

  // рамка поля
  ctx.strokeStyle = "#4a5585";
  ctx.lineWidth = BORDER;
  ctx.strokeRect(BORDER / 2, BORDER / 2, W - BORDER, H - BORDER);

  // кирпичи
  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // ракетка
  ctx.fillStyle = "#e8ecff";
  ctx.fillRect(paddleX, H - 60, PADDLE_W, PADDLE_H);

  // мяч
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // HUD
  ctx.fillStyle = "#9aa3c7";
  ctx.font = "16px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Очки: ${score}`, BORDER + 8, 28);
  ctx.textAlign = "right";
  ctx.fillText(`Жизни: ${"●".repeat(Math.max(0, lives))}`, W - BORDER - 8, 28);
  ctx.textAlign = "center";
  ctx.fillText(`Уровень ${level + 1}/${TOTAL_LEVELS}`, W / 2, 28);

  // оверлеи
  if (state !== "playing") {
    ctx.fillStyle = "rgba(15, 18, 32, 0.7)";
    ctx.fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 28px monospace";
    const msg =
      state === "ready" ? "Тапни или нажми пробел — запуск" :
      state === "gameover" ? "Игра окончена" :
      "Победа! 🎉";
    ctx.fillText(msg, W / 2, H / 2 - 10);
    if (state === "gameover" || state === "win") {
      ctx.font = "16px monospace";
      ctx.fillStyle = "#9aa3c7";
      ctx.fillText(`Очки: ${score} — тапни, чтобы начать заново`, W / 2, H / 2 + 28);
    }
  }
}

// --- игровой цикл --------------------------------------------------------------------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
loadLevel(0);
requestAnimationFrame(frame);
