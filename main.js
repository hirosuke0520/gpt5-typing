// GPT5 Typing - simple Japanese typing game
// Modeled loosely after Sushi-Da style falling words

const startButton = document.getElementById('startBtn');
const modeSelect = document.getElementById('modeSelect');
const timeSelect = document.getElementById('timeSelect');
const lane = document.getElementById('lane');
const scoreEl = document.getElementById('score');
const missEl = document.getElementById('miss');
const wpmEl = document.getElementById('wpm');
const timeLeftEl = document.getElementById('timeLeft');
const kanaEl = document.getElementById('kana');
const romanEl = document.getElementById('roman');
const hiddenInput = document.getElementById('hiddenInput');

/** Game state */
const game = {
  isRunning: false,
  startTimeMs: 0,
  endTimeMs: 0,
  remainingMs: 0,
  score: 0,
  miss: 0,
  typedCount: 0,
  activeWord: null,
  activeRomanIndex: 0,
  timerId: null,
  spawnerId: null,
  speed: 1.0,
};

/** Simple dictionary: kana -> roman candidates (array of acceptable sequences) */
const DICT = [
  // Short words
  ['すし', ['sushi']],
  ['さかな', ['sakana']],
  ['たい', ['tai']],
  ['まぐろ', ['maguro']],
  ['たまご', ['tamago']],
  ['あさり', ['asari']],
  ['いくら', ['ikura']],
  ['たこ', ['tako']],
  ['えび', ['ebi']],
  ['かに', ['kani']],
  ['うに', ['uni']],
  ['おちゃ', ['ocha']],[
    'しゃけ', ['shake', 'syake']
  ],
  ['ちゅうとろ', ['chuutoro','tyuutoro','chu-toro','tyu-toro','tyuutorou','chuutorou']],
  // Generic kana
  ['こんにちは', ['konnichiwa','konnihciwa','konnitiha','konnichiwa']],
  ['ありがとう', ['arigatou','arigato']]
];

/** Parameters for difficulty */
const MODES = {
  easy: { spawnMs: [1400, 2000], fallMs: [6000, 8000] },
  normal: { spawnMs: [1000, 1600], fallMs: [4500, 6500] },
  hard: { spawnMs: [700, 1200], fallMs: [3200, 4800] },
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseRandom(array) { return array[Math.floor(Math.random() * array.length)]; }

function startGame() {
  if (game.isRunning) return;
  const modeKey = modeSelect.value;
  const seconds = Number(timeSelect.value);
  resetGame(seconds);
  const mode = MODES[modeKey];

  game.isRunning = true;
  game.startTimeMs = Date.now();
  game.endTimeMs = game.startTimeMs + seconds * 1000;
  game.remainingMs = seconds * 1000;
  updateHUD();
  kanaEl.textContent = '';
  romanEl.textContent = '';
  hiddenInput.value = '';
  hiddenInput.focus();

  // spawn loop
  const spawnOnce = () => {
    if (!game.isRunning) return;
    spawnWord(mode);
    const nextMs = getRandomInt(mode.spawnMs[0], mode.spawnMs[1]);
    game.spawnerId = window.setTimeout(spawnOnce, nextMs);
  };
  spawnOnce();

  // timer loop
  const tick = () => {
    if (!game.isRunning) return;
    const now = Date.now();
    game.remainingMs = Math.max(0, game.endTimeMs - now);
    updateHUD();
    if (game.remainingMs <= 0) {
      endGame();
      return;
    }
    game.timerId = window.requestAnimationFrame(tick);
  };
  tick();
}

function endGame() {
  game.isRunning = false;
  clearTimeout(game.spawnerId);
  cancelAnimationFrame(game.timerId);
  Array.from(lane.children).forEach((el) => el.remove());
  game.activeWord = null;
  romanEl.textContent = '';
  kanaEl.textContent = 'おつかれさまでした！ スペースで再スタート';
}

function resetGame(seconds) {
  game.score = 0;
  game.miss = 0;
  game.typedCount = 0;
  game.activeRomanIndex = 0;
  timeLeftEl.textContent = String(seconds);
  scoreEl.textContent = '0';
  missEl.textContent = '0';
  wpmEl.textContent = '0';
}

function updateHUD() {
  scoreEl.textContent = String(game.score);
  missEl.textContent = String(game.miss);
  const elapsedMin = Math.max(1/60, (Date.now() - game.startTimeMs) / 1000 / 60);
  const wpm = Math.round((game.typedCount / 5) / elapsedMin);
  wpmEl.textContent = String(isFinite(wpm) ? wpm : 0);
  timeLeftEl.textContent = String(Math.ceil(game.remainingMs / 1000));
}

function spawnWord(mode) {
  const [kana, romanCandidates] = chooseRandom(DICT);
  const roman = chooseRandom(romanCandidates);

  const el = document.createElement('div');
  el.className = 'word';
  el.textContent = kana;
  el.style.setProperty('--x', getRandomInt(8, 860) + 'px');

  const fallMs = getRandomInt(mode.fallMs[0], mode.fallMs[1]);
  el.style.animation = `fall ${fallMs}ms linear forwards`;

  const wordObj = { el, kana, roman, fallMs, createdAt: performance.now(), removed: false };
  el.dataset.roman = roman;

  el.addEventListener('animationend', () => {
    if (wordObj.removed) return;
    wordObj.removed = true;
    el.classList.add('missed');
    setTimeout(() => el.remove(), 300);
    game.miss += 1;
    if (game.activeWord === wordObj) {
      game.activeWord = null;
      game.activeRomanIndex = 0;
      kanaEl.textContent = '';
      romanEl.textContent = '';
    }
    updateHUD();
  });

  lane.appendChild(el);

  // If nothing active, make this active
  if (!game.activeWord) {
    setActiveWord(wordObj);
  }
}

function setActiveWord(wordObj) {
  game.activeWord = wordObj;
  game.activeRomanIndex = 0;
  kanaEl.textContent = wordObj.kana;
  romanEl.textContent = wordObj.roman;
}

function handleInput(char) {
  if (!game.isRunning) return;
  if (!game.activeWord) {
    // try to set the nearest word as active (top-most)
    const words = Array.from(lane.children);
    if (words.length === 0) return;
    const topMost = words[0];
    const obj = { el: topMost, kana: topMost.textContent, roman: topMost.dataset.roman, fallMs: 0 };
    setActiveWord(obj);
  }

  const word = game.activeWord;
  const expected = word.roman[game.activeRomanIndex];
  if (!expected) return;

  if (char === expected) {
    game.activeRomanIndex += 1;
    game.typedCount += 1;

    const done = game.activeRomanIndex >= word.roman.length;
    if (done) {
      word.el.classList.add('killed');
      setTimeout(() => word.el.remove(), 150);
      game.score += Math.max(1, Math.round(1000 * (1.0 / Math.max(0.5, word.fallMs / 6000))));
      game.activeWord = null;
      kanaEl.textContent = '';
      romanEl.textContent = '';
    } else {
      romanEl.textContent = word.roman.substring(game.activeRomanIndex);
    }
    updateHUD();
  } else {
    game.miss += 1;
    updateHUD();
  }
}

function onKeyDown(ev) {
  // space: toggle pause / resume
  if (ev.key === ' ') {
    ev.preventDefault();
    if (game.isRunning) {
      pauseGame();
    } else {
      startGame();
    }
    return;
  }

  if (!game.isRunning) return;

  const k = ev.key;
  if (k.length === 1 && /^[a-z]$/i.test(k)) {
    handleInput(k.toLowerCase());
  }
}

function pauseGame() {
  if (!game.isRunning) return;
  game.isRunning = false;
  clearTimeout(game.spawnerId);
  cancelAnimationFrame(game.timerId);
  kanaEl.textContent = '一時停止中 - スペースで再開';
}

startButton.addEventListener('click', startGame);
window.addEventListener('keydown', onKeyDown);

document.addEventListener('click', () => hiddenInput.focus());
