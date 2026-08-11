const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const walletForm = document.getElementById('walletForm');
const walletInput = document.getElementById('walletInput');
const walletList = document.getElementById('walletList');
const leaderboardList = document.getElementById('leaderboardList');
const statusCard = document.getElementById('statusCard');
const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const countdownValue = document.getElementById('countdownValue');
const poolValue = document.getElementById('poolValue');
const timerValue = document.getElementById('timerValue');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');

const config = {
  lanes: 5,
  cols: 8,
  tickMs: 30,
  roundLength: 45,
  cellSize: 72,
  pool: 1500,
};

const game = {
  running: false,
  timer: config.roundLength,
  score: 0,
  best: 0,
  activeWallet: '',
  players: [],
  lastTimestamp: 0,
  Frog: {
    x: 3,
    y: 5,
    size: 26,
    targetX: 3,
    targetY: 5,
  },
  cars: [],
};

const rewardShares = [0.5, 0.3, 0.2];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shortWallet(wallet) {
  if (!wallet) return 'Anonymous';
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function addWalletEntry(wallet) {
  const cleanWallet = wallet.trim();
  if (!cleanWallet) return;

  const exists = game.players.some((entry) => entry.wallet === cleanWallet);
  if (exists) {
    game.activeWallet = cleanWallet;
    return;
  }

  game.players.push({ wallet: cleanWallet, score: 0 });
  game.activeWallet = cleanWallet;
  renderWalletList();
}

function renderWalletList() {
  if (!game.players.length) {
    walletList.innerHTML = '<li class="placeholder">No players yet</li>';
    return;
  }

  walletList.innerHTML = game.players
    .map(
      (entry) =>
        `<li>${shortWallet(entry.wallet)}${entry.wallet === game.activeWallet ? ' <strong>(active)</strong>' : ''}</li>`
    )
    .join('');
}

function setScore(value) {
  game.score = value;
  scoreValue.textContent = String(value);
}

function updateTimerUI() {
  countdownValue.textContent = String(Math.ceil(game.timer));
  timerValue.textContent = `${Math.ceil(game.timer)}s`;
}

function updatePoolUI() {
  poolValue.textContent = `$${config.pool.toLocaleString()}`;
}

function resetFrog() {
  game.Frog.x = 3;
  game.Frog.y = 5;
  game.Frog.targetX = 3;
  game.Frog.targetY = 5;
}

function createCars() {
  const laneConfigs = [
    { y: 60, speed: 1.8, dir: 1, startX: -140 },
    { y: 150, speed: 2.2, dir: -1, startX: canvas.width + 120 },
    { y: 240, speed: 2.6, dir: 1, startX: -120 },
    { y: 330, speed: 2.1, dir: -1, startX: canvas.width + 90 },
    { y: 420, speed: 2.8, dir: 1, startX: -160 },
  ];

  game.cars = laneConfigs.map((lane, index) => ({
    lane,
    id: index,
    x: lane.startX,
    y: lane.y,
    width: 110,
    height: 42,
    speed: lane.speed,
    dir: lane.dir,
  }));
}

function moveCars() {
  game.cars.forEach((car) => {
    car.x += car.speed * car.dir * 1.3;

    if (car.dir > 0 && car.x > canvas.width + 140) {
      car.x = -160;
    }

    if (car.dir < 0 && car.x < -180) {
      car.x = canvas.width + 120;
    }
  });
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function checkCollision() {
  const frogRect = {
    x: game.Frog.x * config.cellSize + 18,
    y: game.Frog.y * config.cellSize + 18,
    width: game.Frog.size,
    height: game.Frog.size,
  };

  for (const car of game.cars) {
    const carRect = {
      x: car.x,
      y: car.y,
      width: car.width,
      height: car.height,
    };

    if (intersects(frogRect, carRect)) {
      return true;
    }
  }

  return false;
}

function moveFrog(dx, dy) {
  if (!game.running) return;

  const nextX = clamp(game.Frog.x + dx, 0, config.cols - 1);
  const nextY = clamp(game.Frog.y + dy, 0, 5);

  game.Frog.targetX = nextX;
  game.Frog.targetY = nextY;
  game.Frog.x = nextX;
  game.Frog.y = nextY;

  if (nextY === 0) {
    setScore(game.score + 1);
    if (game.score > game.best) game.best = game.score;
    bestValue.textContent = String(game.best);
    resetFrog();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1a2d2d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2f7a42';
  ctx.fillRect(0, 0, canvas.width, 60);

  ctx.fillStyle = '#3b7e39';
  for (let i = 0; i < canvas.width; i += 60) {
    ctx.fillRect(i, 54, 22, 12);
  }

  for (let row = 0; row < 6; row++) {
    const y = row * config.cellSize;
    if (row > 0 && row <= 5) {
      ctx.fillStyle = '#2d3239';
      ctx.fillRect(0, y + 10, canvas.width, 50);
    }
  }

  ctx.fillStyle = '#1c1c23';
  ctx.fillRect(0, 60, canvas.width, 420);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * config.cellSize, 60);
    ctx.lineTo(i * config.cellSize, 480);
    ctx.stroke();
  }

  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = '#c9d4eb';
    ctx.fillRect(i * config.cellSize + 14, 62, 4, 430);
  }
}

function drawCars() {
  game.cars.forEach((car) => {
    ctx.fillStyle = '#ff7f50';
    ctx.fillRect(car.x, car.y, car.width, car.height);

    ctx.fillStyle = '#2b1d16';
    ctx.fillRect(car.x + 12, car.y + 10, car.width - 24, 8);
    ctx.fillRect(car.x + 12, car.y + 24, car.width - 24, 8);
    ctx.fillStyle = '#dfe7ff';
    ctx.fillRect(car.x + 18, car.y + 10, 18, 8);
    ctx.fillRect(car.x + car.width - 36, car.y + 10, 18, 8);
  });
}

function drawFrog() {
  const x = game.Frog.x * config.cellSize + 18;
  const y = game.Frog.y * config.cellSize + 18;

  ctx.fillStyle = '#7defa0';
  ctx.beginPath();
  ctx.arc(x + 18, y + 18, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3ad77c';
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 20);
  ctx.lineTo(x + 4, y + 36);
  ctx.lineTo(x + 18, y + 34);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 24, y + 20);
  ctx.lineTo(x + 32, y + 36);
  ctx.lineTo(x + 18, y + 34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#d4fbe0';
  ctx.fillRect(x + 12, y + 8, 12, 8);
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 16, y + 8, 4, 4);
  ctx.fillRect(x + 20, y + 8, 4, 4);
}

function drawStatusText() {
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '700 16px Inter';
  ctx.fillText('CROSSY RUSH', 24, 34);
}

function render() {
  drawBackground();
  drawCars();
  drawFrog();
  drawStatusText();
}

function endRound() {
  game.running = false;

  const sorted = [...game.players]
    .map((entry) => ({ ...entry, score: Number(entry.score) || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const finalResults = sorted.map((entry, idx) => {
    const share = rewardShares[idx] || 0;
    const amount = config.pool * share;
    return { ...entry, share, amount };
  });

  leaderboardList.innerHTML = finalResults
    .map(
      (entry, idx) => `
        <li>
          <span class="rank-badge">${idx + 1}</span>
          <span class="entry-wallet">${shortWallet(entry.wallet)}</span>
          <span class="entry-score">${entry.score}</span>
        </li>
      `
    )
    .join('');

  const summaryText = finalResults.length
    ? finalResults
        .map((entry) => `${entry.wallet ? shortWallet(entry.wallet) : 'Wallet'}: $${entry.amount.toFixed(0)}`)
        .join(' • ')
    : 'No winners this round.';

  statusCard.textContent = `Round complete. Rewards split: ${summaryText}`;

  if (!game.players.length) {
    game.activeWallet = '';
    statusCard.textContent = 'No players entered. Start with a wallet address.';
  }
}

function syncPlayerScore() {
  if (!game.activeWallet) return;
  const active = game.players.find((entry) => entry.wallet === game.activeWallet);
  if (active) {
    active.score = game.score;
  }
}

function tick(timestamp) {
  if (!game.running) {
    render();
    requestAnimationFrame(tick);
    return;
  }

  if (!game.lastTimestamp) game.lastTimestamp = timestamp;
  const delta = timestamp - game.lastTimestamp;
  game.lastTimestamp = timestamp;

  game.timer -= delta / 1000;
  updateTimerUI();

  if (game.timer <= 0) {
    syncPlayerScore();
    endRound();
    return;
  }

  moveCars();
  if (checkCollision()) {
    syncPlayerScore();
    endRound();
    return;
  }

  render();
  requestAnimationFrame(tick);
}

function startRound() {
  if (!game.players.length) {
    statusCard.textContent = 'Add at least one wallet address before starting.';
    return;
  }

  game.running = true;
  game.timer = config.roundLength;
  game.lastTimestamp = 0;
  setScore(0);
  updateTimerUI();
  resetFrog();
  createCars();
  syncPlayerScore();
  statusCard.textContent = `Round live for ${shortWallet(game.activeWallet)}.`;
  requestAnimationFrame(tick);
}

function resetGame() {
  game.running = false;
  game.timer = config.roundLength;
  setScore(0);
  resetFrog();
  createCars();
  updateTimerUI();
  leaderboardList.innerHTML = '<li class="empty">Waiting for players</li>';
  statusCard.textContent = 'Waiting to start.';
  render();
}

walletForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const rawWallet = walletInput.value;
  addWalletEntry(rawWallet);
  walletInput.value = '';
  walletInput.focus();
  if (!game.running) {
    statusCard.textContent = `Wallet added: ${shortWallet(game.activeWallet)}. Press Start Round to begin.`;
  }
});

startButton.addEventListener('click', startRound);
resetButton.addEventListener('click', resetGame);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') moveFrog(0, -1);
  if (key === 'arrowdown' || key === 's') moveFrog(0, 1);
  if (key === 'arrowleft' || key === 'a') moveFrog(-1, 0);
  if (key === 'arrowright' || key === 'd') moveFrog(1, 0);
});

function init() {
  setScore(0);
  updatePoolUI();
  updateTimerUI();
  createCars();
  render();
}

init();
