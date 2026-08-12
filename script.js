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
const zoneValue = document.getElementById('zoneValue');
const countdownValue = document.getElementById('countdownValue');
const poolValue = document.getElementById('poolValue');
const roundLabel = document.getElementById('roundLabel');
const gameOverlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayButton = document.getElementById('overlayButton');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const audioToggle = document.getElementById('audioToggle');
const tokenCaValue = document.getElementById('tokenCaValue');
const copyTokenCa = document.getElementById('copyTokenCa');

const config = {
  tokenCa: '',
  pool: 1500,
  roundLength: 45,
  columns: 12,
  rows: 9,
  tile: 60,
  frogSize: 30,
  scorePerLevel: 1,
  speedIncreasePerLevel: 0.22,
  roadRows: [5, 6, 7],
  riverRows: [1, 2, 3],
  safeRows: [4, 8],
};

const prizeShares = [0.5, 0.3, 0.2];
const carPalette = ['#ff5e57', '#f6bf3d', '#36b4ed', '#a978ff', '#f76da7'];

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
  logs: [],
  frog: { x: 345, row: 8, hop: 0 },
  animationFrame: null,
  lastTimestamp: 0,
  audio: { context: null, muted: false },
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

function updateTokenCa() {
  const configuredCa = new URLSearchParams(window.location.search).get('ca') || config.tokenCa;
  const tokenCa = configuredCa.trim();
  const isValidTokenCa = isPlausibleWallet(tokenCa);

  tokenCaValue.textContent = isValidTokenCa ? tokenCa : 'Not configured';
  tokenCaValue.title = isValidTokenCa ? tokenCa : '';
  copyTokenCa.disabled = !isValidTokenCa;
}

function activePlayer() {
  return game.players.find((player) => player.wallet === game.activeWallet);
}

function formatMoney(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatClock(seconds) {
  return `00:${String(Math.max(0, Math.ceil(seconds))).padStart(2, '0')}`;
}

function getZone(row) {
  if (row === 0) return 'FINISH';
  if (config.roadRows.includes(row)) return 'ROAD';
  if (config.riverRows.includes(row)) return 'RIVER';
  return 'SAFE';
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

function ensureAudio() {
  if (!game.audio.context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    game.audio.context = new AudioContext();
  }
  if (game.audio.context.state === 'suspended') game.audio.context.resume();
}

function playTone(frequency, duration, type = 'square', volume = 0.03, delay = 0) {
  if (game.audio.muted || !game.audio.context) return;

  const startTime = game.audio.context.currentTime + delay;
  const oscillator = game.audio.context.createOscillator();
  const gain = game.audio.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(game.audio.context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playSound(name) {
  if (name === 'hop') playTone(330, 0.06, 'square', 0.025);
  if (name === 'score') {
    playTone(523, 0.1, 'triangle', 0.04);
    playTone(784, 0.16, 'triangle', 0.04, 0.1);
  }
  if (name === 'hit') {
    playTone(130, 0.24, 'sawtooth', 0.06);
    playTone(80, 0.3, 'sawtooth', 0.045, 0.08);
  }
}

function updateHud() {
  scoreValue.textContent = String(game.score).padStart(2, '0');
  bestValue.textContent = String(game.best).padStart(2, '0');
  levelValue.textContent = String(game.level).padStart(2, '0');
  zoneValue.textContent = getZone(game.frog.row);
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
  const ranked = final ? game.payouts.map((payout) => payout.player) : getRankedPlayers().slice(0, 3);
  if (!ranked.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No scores posted yet';
    leaderboardList.append(empty);
    return;
  }
  ranked.forEach((player, index) => leaderboardList.append(createLeaderboardRow(player, index, final ? game.payouts[index].amount : 0)));
}

function calculatePayouts() {
  const eligibleWinners = getRankedPlayers().filter((player) => player.score > 0).slice(0, prizeShares.length);
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
  window.dispatchEvent(new CustomEvent('bullbank:round-complete', { detail: manifest }));
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
  game.frog.x = (canvas.width - config.frogSize) / 2;
  game.frog.row = 8;
  game.frog.hop = 0;
}

function createCars() {
  const laneSettings = [
    { row: 7, direction: -1, speed: 135, starts: [800, 600, 240, 30] },
    { row: 6, direction: 1, speed: 165, starts: [-120, 100, 420, 650] },
    { row: 5, direction: -1, speed: 195, starts: [790, 560, 300, 30] },
  ];
  game.cars = laneSettings.flatMap((lane, laneIndex) =>
    lane.starts.map((start, index) => ({
      row: lane.row,
      direction: lane.direction,
      speed: lane.speed,
      width: 58 + ((laneIndex + index) % 2) * 12,
      x: start,
      color: carPalette[(laneIndex + index) % carPalette.length],
      speedMultiplier: 1,
    }))
  );
}

function createLogs() {
  const laneSettings = [
    { row: 3, direction: 1, speed: 72, starts: [-115, 130, 370, 610] },
    { row: 2, direction: -1, speed: 88, starts: [760, 540, 300, 80] },
    { row: 1, direction: 1, speed: 103, starts: [-90, 180, 450, 680] },
  ];
  game.logs = laneSettings.flatMap((lane, laneIndex) =>
    lane.starts.map((start) => ({
      row: lane.row,
      direction: lane.direction,
      speed: lane.speed,
      baseWidth: 112 - (laneIndex % 2) * 8,
      width: 112 - (laneIndex % 2) * 8,
      x: start,
      speedMultiplier: 1,
    }))
  );
}

function createTrafficCar(laneIndex) {
  const lanes = [
    { row: 7, direction: -1, speed: 135 },
    { row: 6, direction: 1, speed: 165 },
    { row: 5, direction: -1, speed: 195 },
  ];
  const lane = lanes[laneIndex % lanes.length];
  const index = game.cars.length;
  return {
    ...lane,
    width: 58 + (index % 2) * 16,
    x: lane.direction > 0 ? -170 - laneIndex * 42 : canvas.width + 90 + laneIndex * 42,
    color: carPalette[index % carPalette.length],
    speedMultiplier: 1,
  };
}

function applyDifficulty() {
  const speedMultiplier = 1 + (game.level - 1) * config.speedIncreasePerLevel;
  const targetCarCount = 12 + Math.min((game.level - 1) * 2, 12);
  for (const car of game.cars) car.speedMultiplier = speedMultiplier;
  for (const log of game.logs) {
    log.speedMultiplier = speedMultiplier;
    log.width = Math.max(64, log.baseWidth - (game.level - 1) * 5);
  }
  while (game.cars.length < targetCarCount) {
    const car = createTrafficCar(game.cars.length % 4);
    car.speedMultiplier = speedMultiplier;
    game.cars.push(car);
  }
}

function updateObstacles(deltaSeconds) {
  for (const car of game.cars) {
    car.x += car.speed * car.speedMultiplier * car.direction * deltaSeconds;
    if (car.direction > 0 && car.x > canvas.width + 85) car.x = -car.width - 80;
    if (car.direction < 0 && car.x < -car.width - 85) car.x = canvas.width + 80;
  }
  for (const log of game.logs) {
    log.x += log.speed * log.speedMultiplier * log.direction * deltaSeconds;
    if (log.direction > 0 && log.x > canvas.width + 60) log.x = -log.width - 60;
    if (log.direction < 0 && log.x < -log.width - 60) log.x = canvas.width + 60;
  }
}

function frogRect() {
  return {
    x: game.frog.x,
    y: game.frog.row * config.tile + 10,
    width: config.frogSize,
    height: config.frogSize,
  };
}

function supportingLog() {
  const frog = frogRect();
  return game.logs.find((log) =>
    log.row === game.frog.row &&
    frog.x + frog.width - 5 > log.x &&
    frog.x + 5 < log.x + log.width
  );
}

function getCollisionReason() {
  const frog = frogRect();
  const hitByCar = game.cars.some((car) => {
    if (car.row !== game.frog.row) return false;
    const carY = car.row * config.tile + 8;
    return frog.x < car.x + car.width && frog.x + frog.width > car.x && frog.y < carY + 34 && frog.y + frog.height > carY;
  });
  if (hitByCar) return 'collision';

  if (config.riverRows.includes(game.frog.row)) {
    const log = supportingLog();
    if (!log || game.frog.x < 0 || game.frog.x + config.frogSize > canvas.width) return 'water';
  }
  return null;
}

function carryFrog(deltaSeconds) {
  if (!config.riverRows.includes(game.frog.row)) return;
  const log = supportingLog();
  if (log) game.frog.x += log.speed * log.speedMultiplier * log.direction * deltaSeconds;
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
  playSound('score');
  setStatus(
    leveledUp
      ? `Level ${game.level}: traffic is faster and the log gaps are tighter.`
      : `Finish reached. ${game.score} ${game.score === 1 ? 'point' : 'points'} banked.`,
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
  const title = reason === 'collision' ? 'Traffic got you.' : reason === 'water' ? 'The river got you.' : 'Round complete.';
  const detail = winner
    ? `${shortWallet(winner.wallet)} takes first with ${winner.score} points. The fixed payout manifest is ready for backend settlement.`
    : `No eligible score was posted. The full ${formatMoney(config.pool)} remains unclaimed.`;
  roundLabel.textContent = 'ROUND COMPLETE';
  setStatus(detail, true);
  showOverlay(title, detail, 'Play another round');
  startButton.textContent = 'New round';
  playSound('hit');
}

function startRound() {
  if (!game.activeWallet) {
    setStatus('Enter a wallet address before starting a prize round.');
    walletInput.focus();
    return;
  }
  if (game.state === 'running') return;

  ensureAudio();
  game.state = 'running';
  game.timer = config.roundLength;
  game.score = 0;
  game.level = 1;
  game.payouts = [];
  game.roundId = `frogger-${Date.now()}`;
  game.lastTimestamp = 0;
  resetFrog();
  createCars();
  createLogs();
  applyDifficulty();
  updateHud();
  hideOverlay();
  payoutSummary.hidden = true;
  roundLabel.textContent = 'ROUND LIVE';
  startButton.textContent = 'Round live';
  setStatus(`Round live for ${shortWallet(game.activeWallet)}. Survive the road, then ride the logs to the finish.`, true);
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
  createLogs();
  applyDifficulty();
  updateHud();
  renderLeaderboard();
  payoutSummary.hidden = true;
  roundLabel.textContent = 'WAITING FOR HOPPERS';
  startButton.textContent = 'Start round';
  setStatus('Round reset. Select an entered wallet, then start when ready.');
  showOverlay('Ready to hop?', 'Enter a wallet, survive the road, then ride the logs to the finish and bank your score.', 'Start playing');
  render();
}

function moveFrog(deltaColumn, deltaRow) {
  if (game.state !== 'running') return;
  game.frog.x = clamp(game.frog.x + deltaColumn * config.tile, 0, canvas.width - config.frogSize);
  game.frog.row = clamp(game.frog.row + deltaRow, 0, config.rows - 1);
  game.frog.hop = 1;
  playSound('hop');
  if (game.frog.row === 0) completeRun();
  updateHud();
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < config.rows; row += 1) {
    const y = row * config.tile;
    const zone = getZone(row);
    if (zone === 'ROAD') {
      ctx.fillStyle = row % 2 ? '#252a2e' : '#20262b';
      ctx.fillRect(0, y, canvas.width, config.tile);
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 2;
      ctx.setLineDash([26, 24]);
      ctx.beginPath();
      ctx.moveTo(0, y + config.tile / 2);
      ctx.lineTo(canvas.width, y + config.tile / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (zone === 'RIVER') {
      ctx.fillStyle = row % 2 ? '#0f6098' : '#126eab';
      ctx.fillRect(0, y, canvas.width, config.tile);
      ctx.fillStyle = 'rgba(186,239,255,.17)';
      for (let x = (row % 2) * 35; x < canvas.width; x += 95) {
        ctx.fillRect(x, y + 13, 48, 3);
        ctx.fillRect(x + 22, y + 35, 38, 3);
      }
    } else {
      ctx.fillStyle = row === 0 ? '#1b4b21' : '#123b1d';
      ctx.fillRect(0, y, canvas.width, config.tile);
      for (let x = row % 2 ? 14 : 48; x < canvas.width; x += 92) {
        ctx.fillStyle = 'rgba(128,202,69,.28)';
        ctx.fillRect(x, y + 11, 14, 10);
        ctx.fillRect(x + 11, y + 27, 10, 12);
      }
    }
  }

  ctx.fillStyle = '#88f73e';
  [60, 240, 300].forEach((y) => ctx.fillRect(0, y - 3, canvas.width, 3));
  ctx.fillStyle = 'rgba(222,255,175,.8)';
  ctx.font = '600 11px "DM Mono"';
  ctx.fillText('FINISH', 20, 31);
  ctx.fillText('RIVER', 650, 82);
  ctx.fillText('ROAD', 655, 322);
}

function drawCar(car) {
  const y = car.row * config.tile + 8;
  const height = 34;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(car.x + 3, y + height, car.width - 6, 3);
  ctx.fillStyle = car.color;
  ctx.fillRect(car.x, y + 7, car.width, height - 7);
  ctx.fillStyle = '#121519';
  ctx.fillRect(car.x + 9, y + 13, car.width - 18, 10);
  ctx.fillStyle = '#c4edff';
  ctx.fillRect(car.x + (car.direction > 0 ? car.width - 13 : 4), y + 16, 7, 5);
  ctx.fillStyle = '#0b0d0e';
  ctx.fillRect(car.x + 8, y + height - 1, 11, 5);
  ctx.fillRect(car.x + car.width - 19, y + height - 1, 11, 5);
}

function drawLog(log) {
  const y = log.row * config.tile + 9;
  const height = 29;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(log.x + 3, y + height, log.width - 6, 4);
  ctx.fillStyle = '#914c20';
  ctx.fillRect(log.x, y, log.width, height);
  ctx.fillStyle = '#d47b32';
  ctx.fillRect(log.x + 5, y + 5, log.width - 10, 5);
  ctx.fillStyle = '#663715';
  ctx.beginPath();
  ctx.arc(log.x + 11, y + height / 2, 7, 0, Math.PI * 2);
  ctx.arc(log.x + log.width - 11, y + height / 2, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrog() {
  const x = game.frog.x - Math.sin(game.frog.hop * Math.PI) * 2;
  const y = game.frog.row * config.tile + 9 - Math.sin(game.frog.hop * Math.PI) * 7;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x + 3, y + 33, 28, 4);
  ctx.fillStyle = '#8df73d';
  ctx.fillRect(x + 5, y + 10, 22, 22);
  ctx.fillStyle = '#63c62d';
  ctx.fillRect(x, y + 19, 8, 13);
  ctx.fillRect(x + 24, y + 19, 8, 13);
  ctx.fillStyle = '#efffc8';
  ctx.fillRect(x + 7, y + 3, 9, 9);
  ctx.fillRect(x + 18, y + 3, 9, 9);
  ctx.fillStyle = '#0b1307';
  ctx.fillRect(x + 10, y + 6, 3, 3);
  ctx.fillRect(x + 21, y + 6, 3, 3);
}

function render() {
  drawBackground();
  game.logs.forEach(drawLog);
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

  carryFrog(deltaSeconds);
  updateObstacles(deltaSeconds);
  const collisionReason = getCollisionReason();
  if (collisionReason) {
    render();
    endRound(collisionReason);
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
audioToggle.addEventListener('click', () => {
  ensureAudio();
  game.audio.muted = !game.audio.muted;
  audioToggle.textContent = game.audio.muted ? 'SOUND OFF' : 'SOUND ON';
  audioToggle.setAttribute('aria-pressed', String(!game.audio.muted));
  if (!game.audio.muted) playSound('hop');
});
copyTokenCa.addEventListener('click', () => {
  const tokenCa = tokenCaValue.textContent;
  if (!isPlausibleWallet(tokenCa)) return;

  navigator.clipboard.writeText(tokenCa).then(
    () => {
      copyTokenCa.textContent = 'Copied';
      setTimeout(() => { copyTokenCa.textContent = 'Copy'; }, 1500);
    },
    () => {
      copyTokenCa.textContent = 'Copy failed';
      setTimeout(() => { copyTokenCa.textContent = 'Copy'; }, 1500);
    }
  );
});

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
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 24) {
    if (Math.abs(deltaX) > Math.abs(deltaY)) moveFrog(deltaX > 0 ? 1 : -1, 0);
    else moveFrog(0, deltaY > 0 ? 1 : -1);
  }
  touchStart = null;
}, { passive: true });

function init() {
  resetFrog();
  updateTokenCa();
  createCars();
  createLogs();
  applyDifficulty();
  updateHud();
  renderRoster();
  renderLeaderboard();
  render();
}

init();
