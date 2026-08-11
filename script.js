const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const walletForm = document.getElementById('walletForm');
const walletInput = document.getElementById('walletInput');
const walletList = document.getElementById('walletList');
const leaderboardList = document.getElementById('leaderboardList');
const statusCard = document.getElementById('statusCard');
const payoutSummary = document.getElementById('payoutSummary');
const entryHint = document.getElementById('entryHint');
const playerCount = document.getElementById('playerCount');
const rosterCount = document.getElementById('rosterCount');
const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const levelValue = document.getElementById('levelValue');
const countdownValue = document.getElementById('countdownValue');
const poolValue = document.getElementById('poolValue');
const roundLabel = document.getElementById('roundLabel');
const gameOverlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayButton = document.getElementById('overlayButton');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');

const config = {
  pool: 1500,
  roundLength: 45,
  columns: 10,
  rows: 7,
  tile: 80,
  speedIncreasePerLevel: 0.18,
  scorePerLevel: 2,
};

const prizeShares = [0.5, 0.3, 0.2];
const carPalette = ['#ff7c43', '#73caf6', '#ffdb60', '#bb89ff', '#ff718f'];

const game = {
  state: 'lobby',
  timer: config.roundLength,
  score: 0,
  best: 0,
  level: 1,
  roundId: null,
  payouts: [],
  activeWallet: '',
  players: [],
  cars: [],
  frog: { col: 4, row: 6, hop: 0 },
  animationFrame: null,
  lastTimestamp: 0,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shortWallet(wallet) {
  return wallet.length > 13 ? `${wallet.slice(0, 5)}...${wallet.slice(-5)}` : wallet;
}

function isPlausibleWallet(wallet) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
}

function activePlayer() {
  return game.players.find((player) => player.wallet === game.activeWallet);
}

function formatMoney(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatClock(seconds) {
  const wholeSeconds = Math.max(0, Math.ceil(seconds));
  return `00:${String(wholeSeconds).padStart(2, '0')}`;
}

function setStatus(message, success = false) {
  statusCard.textContent = message;
  statusCard.classList.toggle('success', success);
}

function showOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayButton.textContent = buttonText;
  gameOverlay.classList.remove('hidden');
}

function hideOverlay() {
  gameOverlay.classList.add('hidden');
}

function updateHud() {
  scoreValue.textContent = String(game.score).padStart(2, '0');
  bestValue.textContent = String(game.best).padStart(2, '0');
  levelValue.textContent = String(game.level).padStart(2, '0');
  countdownValue.textContent = formatClock(game.timer);
  playerCount.textContent = String(game.players.length);
  rosterCount.textContent = `${game.players.length} / 100`;
  poolValue.textContent = formatMoney(config.pool);
}

function renderRoster() {
  walletList.replaceChildren();

  if (!game.players.length) {
    const empty = document.createElement('li');
    empty.className = 'placeholder';
    empty.textContent = 'Waiting for the first player';
    walletList.append(empty);
    return;
  }

  for (const player of game.players) {
    const item = document.createElement('li');
    item.textContent = shortWallet(player.wallet);
    item.title = player.wallet;

    if (player.wallet === game.activeWallet) {
      item.classList.add('active');
      item.textContent += '  ACTIVE';
    }

    item.addEventListener('click', () => {
      if (game.state !== 'lobby') return;
      game.activeWallet = player.wallet;
      entryHint.textContent = `Playing as ${shortWallet(player.wallet)}. Your next score will be attached to this wallet.`;
      entryHint.classList.add('active');
      renderRoster();
      renderLeaderboard();
    });

    walletList.append(item);
  }
}

function createLeaderboardRow(player, index, prize = 0) {
  const row = document.createElement('li');
  const rank = document.createElement('span');
  const wallet = document.createElement('span');
  const score = document.createElement('span');

  rank.className = 'rank-badge';
  wallet.className = 'entry-wallet';
  score.className = 'entry-score';
  rank.textContent = String(index + 1).padStart(2, '0');
  wallet.textContent = shortWallet(player.wallet);
  wallet.title = player.wallet;
  score.textContent = `${player.score} pts`;
  row.append(rank, wallet, score);

  if (prize) {
    const prizeLine = document.createElement('span');
    prizeLine.className = 'entry-prize';
    prizeLine.textContent = `${Math.round(prizeShares[index] * 100)}% projected reward - ${formatMoney(prize)}`;
    row.append(prizeLine);
  }

  return row;
}

function getRankedPlayers() {
  return [...game.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}

function renderLeaderboard(final = false) {
  leaderboardList.replaceChildren();
  const ranked = final
    ? game.payouts.map((payout) => payout.player)
    : getRankedPlayers().slice(0, 3);

  if (!ranked.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No scores posted yet';
    leaderboardList.append(empty);
    return;
  }

  ranked.forEach((player, index) => {
    const reward = final ? game.payouts[index].amount : 0;
    leaderboardList.append(createLeaderboardRow(player, index, reward));
  });
}

function calculatePayouts() {
  const eligibleWinners = getRankedPlayers()
    .filter((player) => player.score > 0)
    .slice(0, prizeShares.length);

  const payouts = eligibleWinners.map((player, index) => ({
    place: index + 1,
    wallet: player.wallet,
    score: player.score,
    amount: Number((config.pool * prizeShares[index]).toFixed(2)),
    share: prizeShares[index],
    player,
    status: 'pending_backend_settlement',
  }));
  const paidAmount = payouts.reduce((total, payout) => total + payout.amount, 0);

  return {
    roundId: game.roundId,
    poolAmount: config.pool,
    payouts,
    unclaimedAmount: Number((config.pool - paidAmount).toFixed(2)),
    status: 'pending_backend_settlement',
  };
}

function publishPayoutManifest(manifest) {
  window.dispatchEvent(new CustomEvent('bullbank:round-complete', {
    detail: manifest,
  }));
}

function addWallet(rawWallet) {
  const wallet = rawWallet.trim();
  if (!wallet) {
    entryHint.textContent = 'Paste a Solana wallet address to enter.';
    entryHint.classList.remove('active');
    return;
  }

  if (!isPlausibleWallet(wallet)) {
    entryHint.textContent = 'Enter a valid base58 Solana wallet address (32-44 characters).';
    entryHint.classList.remove('active');
    return;
  }

  const existing = game.players.find((player) => player.wallet === wallet);
  if (existing) {
    game.activeWallet = existing.wallet;
    entryHint.textContent = `${shortWallet(existing.wallet)} is already entered and is now your active player.`;
  } else if (game.players.length < 100) {
    game.players.push({ wallet, score: 0, joinedAt: Date.now() });
    game.activeWallet = wallet;
    entryHint.textContent = `${shortWallet(wallet)} entered. You are ready to play.`;
  }

  entryHint.classList.add('active');
  renderRoster();
  renderLeaderboard();
  updateHud();
}

function resetFrog() {
  game.frog.col = 4;
  game.frog.row = 6;
  game.frog.hop = 0;
}

function createCars() {
  const laneSettings = [
    { row: 1, direction: 1, speed: 85, count: 2 },
    { row: 2, direction: -1, speed: 120, count: 3 },
    { row: 3, direction: 1, speed: 150, count: 2 },
    { row: 4, direction: -1, speed: 105, count: 3 },
    { row: 5, direction: 1, speed: 135, count: 2 },
  ];

  game.cars = laneSettings.flatMap((lane, laneIndex) =>
    Array.from({ length: lane.count }, (_, index) => ({
      row: lane.row,
      direction: lane.direction,
      speed: lane.speed,
      width: 74 + ((laneIndex + index) % 2) * 16,
      x: lane.direction > 0
        ? -180 + index * 300 + laneIndex * 67
        : canvas.width + 80 - index * 270 - laneIndex * 48,
      color: carPalette[(laneIndex + index) % carPalette.length],
    }))
  );

  applyDifficulty();
}

function createTrafficCar(laneIndex) {
  const laneSettings = [
    { row: 1, direction: 1, speed: 85 },
    { row: 2, direction: -1, speed: 120 },
    { row: 3, direction: 1, speed: 150 },
    { row: 4, direction: -1, speed: 105 },
    { row: 5, direction: 1, speed: 135 },
  ];
  const lane = laneSettings[laneIndex % laneSettings.length];
  const index = game.cars.length;

  return {
    row: lane.row,
    direction: lane.direction,
    speed: lane.speed,
    width: 74 + (index % 2) * 16,
    x: lane.direction > 0 ? -180 - (laneIndex * 47) : canvas.width + 80 + (laneIndex * 47),
    color: carPalette[index % carPalette.length],
  };
}

function applyDifficulty() {
  const speedMultiplier = 1 + (game.level - 1) * config.speedIncreasePerLevel;
  const targetCarCount = 12 + Math.min(game.level - 1, 6);

  for (const car of game.cars) {
    car.speedMultiplier = speedMultiplier;
  }

  while (game.cars.length < targetCarCount) {
    const newCar = createTrafficCar(game.cars.length % 5);
    newCar.speedMultiplier = speedMultiplier;
    game.cars.push(newCar);
  }
}

function updateCars(deltaSeconds) {
  for (const car of game.cars) {
    car.x += car.speed * car.speedMultiplier * car.direction * deltaSeconds;
    if (car.direction > 0 && car.x > canvas.width + 115) car.x = -car.width - 80;
    if (car.direction < 0 && car.x < -car.width - 115) car.x = canvas.width + 80;
  }
}

function frogRect() {
  return {
    x: game.frog.col * config.tile + 24,
    y: game.frog.row * config.tile + 24,
    width: 32,
    height: 32,
  };
}

function hitDetected() {
  const frog = frogRect();
  return game.cars.some((car) => {
    if (car.row !== game.frog.row) return false;
    const carY = car.row * config.tile + 17;
    return frog.x < car.x + car.width && frog.x + frog.width > car.x && frog.y < carY + 45 && frog.y + frog.height > carY;
  });
}

function bankCurrentScore() {
  const player = activePlayer();
  if (player) player.score = Math.max(player.score, game.score);
  renderLeaderboard();
}

function completeRun() {
  game.score += 1;
  game.best = Math.max(game.best, game.score);
  const nextLevel = Math.floor(game.score / config.scorePerLevel) + 1;
  const leveledUp = nextLevel > game.level;
  game.level = nextLevel;
  if (leveledUp) applyDifficulty();
  bankCurrentScore();
  resetFrog();
  updateHud();
  setStatus(
    leveledUp
      ? `Rush level ${game.level}: traffic speed and density increased.`
      : `Checkpoint banked. ${game.score} ${game.score === 1 ? 'point' : 'points'} on the board.`,
    true
  );
}

function endRound(reason) {
  if (game.state !== 'running') return;
  game.state = 'complete';
  cancelAnimationFrame(game.animationFrame);
  bankCurrentScore();
  const manifest = calculatePayouts();
  game.payouts = manifest.payouts;
  renderLeaderboard(true);

  payoutSummary.hidden = false;
  payoutSummary.textContent = `PAYOUT MANIFEST: ${manifest.payouts.length} winner${manifest.payouts.length === 1 ? '' : 's'} eligible | ${formatMoney(manifest.unclaimedAmount)} unclaimed`;
  publishPayoutManifest(manifest);

  const winner = manifest.payouts[0];
  const title = reason === 'collision' ? 'Run ended.' : 'Round complete.';
  const detail = winner
    ? `${shortWallet(winner.wallet)} takes first with ${winner.score} points. The fixed payout manifest is ready for backend settlement.`
    : `No eligible score was posted. The full ${formatMoney(config.pool)} remains unclaimed.`;

  roundLabel.textContent = 'ROUND COMPLETE';
  setStatus(detail, true);
  showOverlay(title, detail, 'Play another round');
  startButton.textContent = 'New round';
}

function startRound() {
  if (!game.activeWallet) {
    setStatus('Enter a wallet address before starting a prize round.');
    walletInput.focus();
    return;
  }

  if (game.state === 'running') return;

  game.state = 'running';
  game.timer = config.roundLength;
  game.score = 0;
  game.level = 1;
  game.payouts = [];
  game.roundId = `crossy-${Date.now()}`;
  game.lastTimestamp = 0;
  resetFrog();
  createCars();
  updateHud();
  hideOverlay();
  payoutSummary.hidden = true;
  roundLabel.textContent = 'ROUND LIVE';
  startButton.textContent = 'Round live';
  setStatus(`Round live for ${shortWallet(game.activeWallet)}. Reach the neon bank zone to score.`, true);
  game.animationFrame = requestAnimationFrame(loop);
}

function resetGame() {
  cancelAnimationFrame(game.animationFrame);
  game.state = 'lobby';
  game.timer = config.roundLength;
  game.score = 0;
  game.level = 1;
  game.payouts = [];
  game.roundId = null;
  game.lastTimestamp = 0;
  resetFrog();
  createCars();
  updateHud();
  renderLeaderboard();
  payoutSummary.hidden = true;
  roundLabel.textContent = 'WAITING FOR PLAYERS';
  startButton.textContent = 'Start round';
  setStatus('Round reset. Select an entered wallet, then start when ready.');
  showOverlay('Ready to rush?', 'Enter a wallet, then start the round. Cross each road to bank your score.', 'Start playing');
  render();
}

function moveFrog(deltaColumn, deltaRow) {
  if (game.state !== 'running') return;
  game.frog.col = clamp(game.frog.col + deltaColumn, 0, config.columns - 1);
  game.frog.row = clamp(game.frog.row + deltaRow, 0, config.rows - 1);
  game.frog.hop = 1;

  if (game.frog.row === 0) completeRun();
}

function drawPixelBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#143127';
  ctx.fillRect(0, 0, canvas.width, config.tile);
  ctx.fillStyle = '#0c211c';
  ctx.fillRect(0, config.tile * 6, canvas.width, config.tile);

  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(0, config.tile, canvas.width, config.tile * 5);

  for (let row = 1; row <= 5; row += 1) {
    const y = row * config.tile;
    ctx.fillStyle = row % 2 === 0 ? '#22262c' : '#1c2026';
    ctx.fillRect(0, y, canvas.width, config.tile);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([27, 22]);
    ctx.beginPath();
    ctx.moveTo(0, y + config.tile - 4);
    ctx.lineTo(canvas.width, y + config.tile - 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let x = 0; x < canvas.width; x += 60) {
    ctx.fillStyle = x % 120 === 0 ? '#2d6042' : '#25543b';
    ctx.fillRect(x + 5, 18, 18, 14);
    ctx.fillRect(x + 28, 34, 12, 12);
    ctx.fillRect(x + 42, 13, 11, 16);
  }

  ctx.fillStyle = '#dfff63';
  ctx.fillRect(0, 68, canvas.width, 4);
  ctx.fillStyle = '#80a72e';
  ctx.fillRect(0, 0, canvas.width, 5);

  ctx.fillStyle = 'rgba(223,255,99,.18)';
  ctx.fillRect(22, 20, 162, 30);
  ctx.fillStyle = '#e8f8ad';
  ctx.font = '600 12px "DM Mono"';
  ctx.fillText('NEON BANK ZONE', 38, 40);
}

function drawCar(car) {
  const y = car.row * config.tile + 17;
  const height = 45;

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(car.x + 4, y + height, car.width - 8, 4);
  ctx.fillStyle = car.color;
  ctx.fillRect(car.x, y + 8, car.width, height - 8);
  ctx.fillStyle = '#15171b';
  ctx.fillRect(car.x + 10, y + 16, car.width - 20, 13);
  ctx.fillStyle = '#bdeaff';
  ctx.fillRect(car.x + (car.direction > 0 ? car.width - 16 : 7), y + 20, 9, 6);
  ctx.fillStyle = '#0d1013';
  ctx.fillRect(car.x + 11, y + height - 2, 14, 6);
  ctx.fillRect(car.x + car.width - 25, y + height - 2, 14, 6);
}

function drawFrog() {
  const x = game.frog.col * config.tile + 19;
  const y = game.frog.row * config.tile + 19 - Math.sin(game.frog.hop * Math.PI) * 8;

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(x + 5, y + 42, 38, 5);
  ctx.fillStyle = '#dfff63';
  ctx.fillRect(x + 8, y + 12, 34, 29);
  ctx.fillStyle = '#b9dc45';
  ctx.fillRect(x + 3, y + 24, 11, 17);
  ctx.fillRect(x + 36, y + 24, 11, 17);
  ctx.fillStyle = '#f0ffd0';
  ctx.fillRect(x + 11, y + 4, 12, 12);
  ctx.fillRect(x + 28, y + 4, 12, 12);
  ctx.fillStyle = '#101410';
  ctx.fillRect(x + 16, y + 8, 4, 4);
  ctx.fillRect(x + 31, y + 8, 4, 4);
  ctx.fillStyle = '#202b14';
  ctx.fillRect(x + 20, y + 28, 11, 3);
}

function render() {
  drawPixelBackground();
  game.cars.forEach(drawCar);
  drawFrog();
}

function loop(timestamp) {
  if (game.state !== 'running') return;
  if (!game.lastTimestamp) game.lastTimestamp = timestamp;
  const deltaSeconds = Math.min((timestamp - game.lastTimestamp) / 1000, 0.05);
  game.lastTimestamp = timestamp;
  game.timer -= deltaSeconds;
  game.frog.hop = Math.max(0, game.frog.hop - deltaSeconds * 5);

  if (game.timer <= 0) {
    game.timer = 0;
    updateHud();
    render();
    endRound('timer');
    return;
  }

  updateCars(deltaSeconds);
  if (hitDetected()) {
    render();
    endRound('collision');
    return;
  }

  updateHud();
  render();
  game.animationFrame = requestAnimationFrame(loop);
}

walletForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (game.state === 'running') {
    setStatus('Wallet entry is locked while a round is live.');
    return;
  }
  addWallet(walletInput.value);
  walletInput.value = '';
});

startButton.addEventListener('click', startRound);
resetButton.addEventListener('click', resetGame);
overlayButton.addEventListener('click', startRound);

window.addEventListener('keydown', (event) => {
  const movement = {
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
  };
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (movement[key]) {
    event.preventDefault();
    moveFrog(...movement[key]);
  }
});

let touchStart;
canvas.addEventListener('touchstart', (event) => {
  touchStart = event.changedTouches[0];
}, { passive: true });
canvas.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  const end = event.changedTouches[0];
  const deltaX = end.clientX - touchStart.clientX;
  const deltaY = end.clientY - touchStart.clientY;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
  if (Math.abs(deltaX) > Math.abs(deltaY)) moveFrog(deltaX > 0 ? 1 : -1, 0);
  else moveFrog(0, deltaY > 0 ? 1 : -1);
  touchStart = null;
}, { passive: true });

function init() {
  createCars();
  updateHud();
  renderRoster();
  renderLeaderboard();
  render();
}

init();
