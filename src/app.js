import { categories, learningItems, itemMap } from './data.js';

const stageFlow = [
  { id: 'consonant', label: '子音關卡', categories: ['consonant'] },
  { id: 'vowel', label: '母音 / 音調關卡', categories: ['vowel', 'tone'] },
  { id: 'word', label: '單字關卡', categories: ['word'] }
];

const elements = {
  heroCta: document.getElementById('hero-cta'),
  heroHint: document.getElementById('hero-hint'),
  dailyReminder: document.getElementById('daily-reminder'),
  card: document.getElementById('learning-card'),
  categoryLabel: document.getElementById('category-label'),
  phoneticLabel: document.getElementById('phonetic-label'),
  thaiScript: document.getElementById('thai-script'),
  mnemonic: document.getElementById('mnemonic'),
  questionArea: document.getElementById('question-area'),
  feedbackArea: document.getElementById('feedback-area'),
  playAudio: document.getElementById('play-audio'),
  showAnswer: document.getElementById('show-answer'),
  next: document.getElementById('next-card'),
  stageSubtitle: document.getElementById('stage-subtitle'),
  accuracyFill: document.getElementById('accuracy-fill'),
  accuracyLabel: document.getElementById('accuracy-label'),
  stageStar: document.getElementById('stage-star'),
  comboValue: document.getElementById('combo-value'),
  stageRoadmap: document.getElementById('stage-roadmap'),
  stageCelebration: document.getElementById('stage-celebration'),
  celebrationContinue: document.getElementById('celebration-continue'),
  customIndicator: document.getElementById('custom-indicator'),
  troubleList: document.getElementById('trouble-list'),
  alphabetList: document.getElementById('alphabet-list'),
  unfamiliarPool: document.getElementById('unfamiliar-pool'),
  unfamiliarCount: document.getElementById('unfamiliar-count'),
  resetButton: document.getElementById('reset-progress'),
  startAlphabetPractice: document.getElementById('start-alphabet-practice'),
  startUnfamiliarPractice: document.getElementById('start-unfamiliar-practice'),
  modeTabs: document.getElementById('mode-tabs'),
  modeTip: document.getElementById('mode-tip'),
  visualSymbol: document.getElementById('visual-symbol'),
  visualOrbit: document.getElementById('visual-orbit'),
  drillUnfamiliar: document.getElementById('drill-unfamiliar'),
  dailyMeterFill: document.getElementById('daily-meter-fill'),
  dailyMeterLabel: document.getElementById('daily-meter-label'),
  dailyAccuracyLabel: document.getElementById('daily-accuracy-label'),
  dailyStreak: document.getElementById('daily-streak'),
  dailyWidget: document.getElementById('daily-widget')
};

const localStorageKey = 'thai-learning-progress';
const manualStorageKey = 'thai-learning-manual-unfamiliar';
const stageStorageKey = 'thai-learning-stage-gate';
const dailyStorageKey = 'thai-learning-daily-tracker';
const dailyGoal = { attempts: 30, accuracy: 70 };
const categoryOrder = Object.fromEntries(categories.map((category, index) => [category.id, index]));

const defaultCategory = stageFlow[0].categories[0];

const state = {
  currentItem: learningItems[0],
  stage: 'quiz',
  promptOverride: '',
  showBreakdown: false,
  answerRevealed: false,
  progress: loadProgress(),
  manualUnfamiliar: loadManualUnfamiliar(),
  stageGate: loadStageGate(),
  dailyProgress: loadDailyProgress(),
  activeFilter: defaultCategory,
  mode: 'gate',
  customPool: [],
  customLabel: '',
  customStats: { attempts: 0, correct: 0, consecutive: 0 },
  customStartSnapshot: null,
  customModeType: 'custom',
  unfamiliarSessionStreaks: {},
  troubleIds: [],
  previousCombo: 0,
  recentUnlock: null
};

let dailyReminderTimeout = null;

function loadManualUnfamiliar() {
  try {
    const cached = localStorage.getItem(manualStorageKey);
    return new Set(cached ? JSON.parse(cached) : []);
  } catch (error) {
    console.warn('無法讀取不熟資料庫，使用預設值', error);
    return new Set();
  }
}

function saveManualUnfamiliar() {
  try {
    localStorage.setItem(manualStorageKey, JSON.stringify(Array.from(state.manualUnfamiliar)));
  } catch (error) {
    console.warn('無法儲存不熟資料庫', error);
  }
}

function createStageStats() {
  return stageFlow.reduce((stats, stage) => {
    stats[stage.id] = {
      attempts: 0,
      correct: 0,
      consecutive: 0,
      passed: false
    };
    return stats;
  }, {});
}

function determineCurrentStage(stats) {
  const pending = stageFlow.find((stage) => !stats[stage.id]?.passed);
  return pending ? pending.id : stageFlow[stageFlow.length - 1].id;
}

function loadStageGate() {
  const defaults = {
    stats: createStageStats(),
    currentStage: stageFlow[0].id
  };
  try {
    const cached = localStorage.getItem(stageStorageKey);
    if (!cached) {
      defaults.currentStage = determineCurrentStage(defaults.stats);
      return defaults;
    }
    const parsed = JSON.parse(cached);
    stageFlow.forEach((stage) => {
      defaults.stats[stage.id] = {
        ...defaults.stats[stage.id],
        ...(parsed.stats?.[stage.id] ?? {})
      };
    });
    defaults.currentStage = determineCurrentStage(defaults.stats);
    return defaults;
  } catch (error) {
    console.warn('無法讀取闖關紀錄，使用預設值', error);
    defaults.currentStage = determineCurrentStage(defaults.stats);
    return defaults;
  }
}

function saveStageGate() {
  try {
    localStorage.setItem(stageStorageKey, JSON.stringify(state.stageGate));
  } catch (error) {
    console.warn('無法儲存闖關紀錄', error);
  }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(previous, current) {
  if (!previous || !current) return Infinity;
  const prevTime = new Date(previous).setHours(0, 0, 0, 0);
  const currentTime = new Date(current).setHours(0, 0, 0, 0);
  return Math.round((currentTime - prevTime) / (1000 * 60 * 60 * 24));
}

function createDailyProgress() {
  return {
    date: getTodayKey(),
    attempts: 0,
    correct: 0,
    streak: 0,
    lastPracticeDate: null,
    reminderDate: null
  };
}

function normalizeDailyProgress(progress) {
  const today = getTodayKey();
  const normalized = {
    ...createDailyProgress(),
    ...(progress ?? {})
  };
  if (normalized.date !== today) {
    normalized.date = today;
    normalized.attempts = 0;
    normalized.correct = 0;
  }
  if (typeof normalized.streak !== 'number' || Number.isNaN(normalized.streak)) {
    normalized.streak = 0;
  }
  return normalized;
}

function loadDailyProgress() {
  try {
    const cached = localStorage.getItem(dailyStorageKey);
    return normalizeDailyProgress(cached ? JSON.parse(cached) : createDailyProgress());
  } catch (error) {
    console.warn('無法讀取每日目標紀錄，使用預設值', error);
    return createDailyProgress();
  }
}

function saveDailyProgress() {
  try {
    localStorage.setItem(dailyStorageKey, JSON.stringify(state.dailyProgress));
  } catch (error) {
    console.warn('無法儲存每日目標紀錄', error);
  }
}

function renderCustomIndicator() {
  if (!elements.customIndicator) return;
  if (state.mode !== 'custom') {
    elements.customIndicator.dataset.active = 'false';
    elements.customIndicator.textContent = '目前為闖關模式。';
    return;
  }
  const accuracy = state.customStats.attempts
    ? Math.round((state.customStats.correct / state.customStats.attempts) * 100)
    : 0;
  elements.customIndicator.dataset.active = 'true';
  const prefix = state.customModeType === 'unfamiliar' ? '修羅場模式' : state.customLabel || '自選練習中';
  elements.customIndicator.textContent = `${prefix} · 正確率 ${accuracy}% · 連續正確 ${state.customStats.consecutive}`;
}

function renderDailyWidget() {
  if (!elements.dailyWidget) return;
  const { attempts, correct, streak } = state.dailyProgress;
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
  const progressPercent = Math.min((attempts / dailyGoal.attempts) * 100, 100);
  if (elements.dailyMeterFill) {
    elements.dailyMeterFill.style.width = `${progressPercent}%`;
  }
  if (elements.dailyMeterLabel) {
    elements.dailyMeterLabel.textContent = `已完成 ${attempts} / ${dailyGoal.attempts} 題`;
  }
  if (elements.dailyAccuracyLabel) {
    elements.dailyAccuracyLabel.textContent = `正確率 ${accuracy}% / ${dailyGoal.accuracy}%`;
  }
  if (elements.dailyStreak) {
    elements.dailyStreak.textContent = `你已連續練習 ${streak} 天 🔥`;
  }
  const complete = attempts >= dailyGoal.attempts && accuracy >= dailyGoal.accuracy;
  elements.dailyWidget.dataset.complete = complete ? 'true' : 'false';
}

function updateDailyProgress(isCorrect) {
  const today = getTodayKey();
  if (state.dailyProgress.date !== today) {
    state.dailyProgress.date = today;
    state.dailyProgress.attempts = 0;
    state.dailyProgress.correct = 0;
  }
  if (state.dailyProgress.lastPracticeDate !== today) {
    const diff = daysBetween(state.dailyProgress.lastPracticeDate, today);
    if (!state.dailyProgress.lastPracticeDate) {
      state.dailyProgress.streak = 1;
    } else if (diff === 1) {
      state.dailyProgress.streak += 1;
    } else {
      state.dailyProgress.streak = 1;
    }
    state.dailyProgress.lastPracticeDate = today;
  }
  state.dailyProgress.attempts += 1;
  if (isCorrect) {
    state.dailyProgress.correct += 1;
  }
  saveDailyProgress();
  renderDailyWidget();
}

function maybeShowDailyReminder() {
  if (!elements.dailyReminder) return;
  const today = getTodayKey();
  if (state.dailyProgress.reminderDate === today) return;
  state.dailyProgress.reminderDate = today;
  saveDailyProgress();
  elements.dailyReminder.hidden = false;
  elements.dailyReminder.classList.add('show');
  clearTimeout(dailyReminderTimeout);
  dailyReminderTimeout = setTimeout(() => {
    if (elements.dailyReminder) {
      elements.dailyReminder.hidden = true;
      elements.dailyReminder.classList.remove('show');
    }
  }, 5500);
}

function handleUnfamiliarModeResult(item, isCorrect) {
  if (state.customModeType !== 'unfamiliar') return null;
  if (!state.unfamiliarSessionStreaks[item.id]) {
    state.unfamiliarSessionStreaks[item.id] = 0;
  }
  if (isCorrect) {
    state.unfamiliarSessionStreaks[item.id] += 1;
    if (state.unfamiliarSessionStreaks[item.id] >= 3) {
      state.unfamiliarSessionStreaks[item.id] = 0;
      const manualRemoved = state.manualUnfamiliar.has(item.id);
      if (manualRemoved) {
        setManualFlag(item.id, false);
      }
      const stats = getStats(item.id);
      stats.streak = Math.max(stats.streak ?? 0, 5);
      state.progress[item.id] = stats;
      saveProgress();
      updateTroubleList();
      return { removed: true, manualRemoved };
    }
  } else {
    state.unfamiliarSessionStreaks[item.id] = 0;
  }
  return null;
}

function startCustomSession(itemIds, label = '自選練習', options = {}) {
  const pool = Array.from(new Set(itemIds))
    .map((id) => itemMap[id])
    .filter(Boolean);
  if (!pool.length) {
    alert('請先勾選至少一個項目。');
    return;
  }
  state.mode = 'custom';
  state.customPool = pool.map((item) => item.id);
  state.customLabel = label;
  state.customStats = { attempts: 0, correct: 0, consecutive: 0 };
  const snapshotIds = Array.isArray(options.snapshotIds) ? options.snapshotIds : null;
  state.customStartSnapshot = snapshotIds ? new Set(snapshotIds) : null;
  state.customModeType = options.modeType || 'custom';
  state.unfamiliarSessionStreaks = {};
  state.stage = 'quiz';
  state.showBreakdown = false;
  state.answerRevealed = false;
  renderCustomIndicator();
  renderModeTabs();
  updateHeroCta();
  scrollToPractice();
  const startId = state.customPool[Math.floor(Math.random() * state.customPool.length)];
  goToItem(startId);
}

function endCustomSession(completed = false) {
  if (state.mode !== 'custom') return;
  state.mode = 'gate';
  state.customPool = [];
  state.customLabel = '';
  state.customStats = { attempts: 0, correct: 0, consecutive: 0 };
  const snapshot = state.customStartSnapshot ? new Set(state.customStartSnapshot) : null;
  state.customStartSnapshot = null;
  state.unfamiliarSessionStreaks = {};
  const modeType = state.customModeType;
  state.customModeType = 'custom';
  renderCustomIndicator();
  renderModeTabs();
  ensureCurrentItemAllowed();
  updateHeroCta();
  if (completed) {
    const currentSet = new Set(gatherUnfamiliarIds());
    const removed = snapshot ? Array.from(snapshot).filter((id) => !currentSet.has(id)).length : 0;
    if (modeType === 'unfamiliar') {
      if (removed > 0) {
        showFeedback(`你剛剛修掉了 ${removed} 題不熟字母 👏`, true);
      } else {
        showFeedback('修羅場完成！繼續闖關累積星星。', true);
      }
    } else if (removed > 0) {
      showFeedback(`不熟題已消除 ${removed} 題！`, true);
    } else {
      showFeedback('自選練習達標，返回闖關模式！', true);
    }
  } else if (modeType === 'unfamiliar') {
    showFeedback('修羅場暫停，隨時再回來收拾不熟題。', false, { flash: false });
  }
}

function updateCustomStats(isCorrect) {
  state.customStats.attempts += 1;
  if (isCorrect) {
    state.customStats.correct += 1;
    state.customStats.consecutive += 1;
  } else {
    state.customStats.consecutive = 0;
  }
  renderCustomIndicator();
  const accuracy = state.customStats.attempts
    ? state.customStats.correct / state.customStats.attempts
    : 0;
  if (accuracy >= 0.8 && state.customStats.consecutive >= 10) {
    endCustomSession(true);
  }
}

function gatherUnfamiliarIds() {
  const ids = new Set(state.troubleIds);
  state.manualUnfamiliar.forEach((id) => ids.add(id));
  return Array.from(ids);
}

function setManualFlag(itemId, shouldAdd, row) {
  if (shouldAdd) {
    state.manualUnfamiliar.add(itemId);
  } else {
    state.manualUnfamiliar.delete(itemId);
  }
  if (row) {
    row.dataset.flagged = shouldAdd ? 'true' : 'false';
  }
  saveManualUnfamiliar();
  renderUnfamiliarPool();
  if (!row) {
    renderAlphabetList();
  }
}

function loadProgress() {
  try {
    const cached = localStorage.getItem(localStorageKey);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    console.warn('無法讀取紀錄，使用預設值', error);
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(state.progress));
  } catch (error) {
    console.warn('無法儲存紀錄', error);
  }
}

function stageForCategory(categoryId) {
  return stageFlow.find((stage) => stage.categories.includes(categoryId))?.id;
}

function allowedCategoriesFromStage() {
  const allowed = new Set();
  stageFlow.forEach((stage) => {
    if (state.stageGate.stats[stage.id]?.passed || stage.id === state.stageGate.currentStage) {
      stage.categories.forEach((category) => allowed.add(category));
    }
  });
  return allowed;
}

function ensureCurrentItemAllowed() {
  if (!state.currentItem || state.mode === 'custom') return;
  const allowed = allowedCategoriesFromStage();
  if (!allowed.has(state.currentItem.category) || state.currentItem.category !== state.activeFilter) {
    selectNextItem();
  }
}

function ensureActiveFilterAllowed() {
  if (state.mode === 'custom') return;
  const allowed = allowedCategoriesFromStage();
  if (allowed.size === 0) return;
  if (!allowed.has(state.activeFilter)) {
    state.activeFilter = Array.from(allowed)[0];
  }
}

function renderModeTabs() {
  if (!elements.modeTabs) return;
  const allowed = allowedCategoriesFromStage();
  elements.modeTabs.innerHTML = '';
  categories.forEach((category) => {
    const button = document.createElement('button');
    button.className = 'mode-tab';
    button.textContent = category.label;
    button.dataset.category = category.id;
    const isAllowed = allowed.has(category.id);
    button.dataset.locked = isAllowed ? 'false' : 'true';
    if (state.activeFilter === category.id && state.mode !== 'custom') {
      button.classList.add('active');
    }
    if (state.mode === 'custom') {
      button.dataset.mode = 'custom';
      button.title = '完成自選練習後即可切換題型';
    } else if (!isAllowed) {
      button.title = '請先完成前一關';
    }
    button.disabled = state.mode === 'custom' || !isAllowed;
    button.addEventListener('click', () => handleModeTab(category.id, isAllowed));
    elements.modeTabs.appendChild(button);
  });
  updateModeTip();
}

function handleModeTab(categoryId, isAllowed) {
  if (state.mode === 'custom') {
    showFeedback('正在自選練習，完成後即可切換題型。', false, { flash: false });
    return;
  }
  if (!isAllowed) {
    const stageMeta = stageFlow.find((stage) => stage.categories.includes(categoryId));
    showFeedback(`建議先把${stageMeta?.label ?? '上一關'}練到 80% 且連對 10 題，再挑戰這個題型 😊`, false, {
      flash: false
    });
    return;
  }
  state.activeFilter = categoryId;
  if (state.currentItem.category !== categoryId) {
    selectNextItem();
  } else {
    renderCard();
  }
  renderModeTabs();
}

function updateModeTip() {
  if (!elements.modeTip) return;
  if (state.mode === 'custom') {
    elements.modeTip.textContent = '自選練習進行中，達到 80% 正確率＋連對 10 題即會結束。';
    return;
  }
  const category = categories.find((item) => item.id === state.activeFilter);
  const stageMeta = stageFlow.find((stage) => stage.categories.includes(state.activeFilter));
  elements.modeTip.textContent = `目前專注：${category?.label ?? ''} · 關卡：${stageMeta?.label ?? ''}`;
}

function updateHeroCta() {
  if (!elements.heroCta || !elements.heroHint) return;
  const totalAttempts = Object.values(state.stageGate.stats).reduce(
    (sum, stats) => sum + (stats?.attempts ?? 0),
    0
  );
  if (state.mode === 'custom') {
    elements.heroCta.textContent = '結束自選練習';
  } else {
    elements.heroCta.textContent = totalAttempts > 0 ? '繼續上次進度' : '開始練習';
  }
  const currentStageId = state.stageGate.currentStage;
  const stageMeta = stageFlow.find((stage) => stage.id === currentStageId);
  const stats = state.stageGate.stats[currentStageId];
  const accuracy = stats?.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
  elements.heroHint.textContent = `目前進度：${stageMeta?.label ?? '全部完成'} · 正確率 ${accuracy}% / 80% · 連對 ${
    stats?.consecutive ?? 0
  }/10`;
}

function scrollToPractice() {
  document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderStageProgress() {
  const currentStageId = state.stageGate.currentStage;
  const currentStage = stageFlow.find((stage) => stage.id === currentStageId) ?? stageFlow[0];
  const stats = state.stageGate.stats[currentStageId];
  const accuracy = stats?.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;

  if (elements.stageSubtitle) {
    elements.stageSubtitle.textContent = currentStage?.label ?? '全部完成';
  }
  if (elements.accuracyFill) {
    elements.accuracyFill.style.width = `${Math.min(accuracy, 100)}%`;
  }
  if (elements.accuracyLabel) {
    elements.accuracyLabel.textContent = `${accuracy}% / 80%`;
  }
  const combo = stats?.consecutive ?? 0;
  if (elements.comboValue) {
    elements.comboValue.textContent = `連續答對 ${combo} / 10 題 🔥`;
    elements.comboValue.classList.remove('combo-pop');
    if (combo > state.previousCombo) {
      elements.comboValue.classList.add('combo-pop');
      setTimeout(() => elements.comboValue?.classList.remove('combo-pop'), 500);
    }
    state.previousCombo = combo;
  }
  if (elements.stageStar) {
    const starReady = stats?.attempts ? accuracy >= 80 && combo >= 10 : false;
    elements.stageStar.dataset.active = starReady ? 'true' : 'false';
    elements.stageStar.textContent = starReady ? '本關星星 GET！前往下一關' : '集滿條件就能點亮星星';
  }

  if (elements.stageRoadmap) {
    elements.stageRoadmap.innerHTML = '';
    stageFlow.forEach((stage) => {
      const dot = document.createElement('div');
      dot.className = 'stage-dot';
      const stageStats = state.stageGate.stats[stage.id];
      let status = 'locked';
      if (stageStats?.passed) {
        status = 'done';
      } else if (stage.id === currentStageId) {
        status = 'current';
      }
      dot.dataset.status = status;
      dot.title = stage.label;
      elements.stageRoadmap.appendChild(dot);
    });
  }

  if (elements.stageCelebration) {
    if (state.recentUnlock) {
      const unlockedStage = stageFlow.find((stage) => stage.id === state.recentUnlock);
      const message = elements.stageCelebration.querySelector('p');
      if (message) {
        message.textContent = `✅ 恭喜！${unlockedStage?.label ?? '下一關'} 已解鎖`;
      }
      elements.stageCelebration.hidden = false;
    } else {
      elements.stageCelebration.hidden = true;
    }
  }

  updateHeroCta();
  ensureActiveFilterAllowed();
  renderModeTabs();
}

function updateStageGate(categoryId, isCorrect) {
  const stageId = stageForCategory(categoryId);
  if (!stageId) return;
  const stats = state.stageGate.stats[stageId];
  const stageMeta = stageFlow.find((stage) => stage.id === stageId);
  stats.attempts += 1;
  if (isCorrect) {
    stats.correct += 1;
    stats.consecutive += 1;
  } else {
    stats.consecutive = 0;
  }

  const accuracy = stats.attempts ? stats.correct / stats.attempts : 0;
  let unlockedStage = null;
  if (!stats.passed && accuracy >= 0.8 && stats.consecutive >= 10) {
    stats.passed = true;
    state.stageGate.currentStage = determineCurrentStage(state.stageGate.stats);
    unlockedStage = stageMeta;
    state.recentUnlock = stageMeta?.id ?? null;
  }

  saveStageGate();
  renderStageProgress();
  ensureCurrentItemAllowed();
}

function getStats(id) {
  if (!state.progress[id]) {
    state.progress[id] = { attempts: 0, correct: 0, incorrect: 0, score: 0, streak: 0 };
  }
  if (typeof state.progress[id].streak !== 'number') {
    state.progress[id].streak = 0;
  }
  return state.progress[id];
}

function goToItem(itemId) {
  const item = itemMap[itemId];
  if (!item) return;
  if (state.mode !== 'custom' && !allowedCategoriesFromStage().has(item.category)) {
    const stageId = stageForCategory(item.category);
    const stageMeta = stageFlow.find((stage) => stage.id === stageId);
    showFeedback(`請先完成${stageMeta?.label ?? '上一關'}，才能練習這個題型。`, false, {
      flash: false
    });
    return;
  }
  state.currentItem = item;
  state.stage = 'quiz';
  state.promptOverride = '';
  state.showBreakdown = false;
  state.answerRevealed = false;

  renderCard();
}

function recordResult(item, isCorrect) {
  const stats = getStats(item.id);
  stats.attempts += 1;
  if (isCorrect) {
    stats.correct += 1;
    stats.streak += 1;
    stats.score = Math.min(
      stats.score + 1,
      (itemMap[item.id]?.masteryGoal ?? 5)
    );
  } else {
    stats.incorrect += 1;
    stats.streak = 0;
  stats.score = Math.max(stats.score - 1, 0);
  }
  state.progress[item.id] = stats;
  saveProgress();
  updateTroubleList();
  updateDailyProgress(isCorrect);
  if (state.mode === 'custom') {
    updateCustomStats(isCorrect);
  } else {
    updateStageGate(item.category, isCorrect);
  }
}

function filteredItems() {
  if (state.mode === 'custom') {
    return state.customPool.map((id) => itemMap[id]).filter(Boolean);
  }
  const gateAllowed = allowedCategoriesFromStage();
  const pool = learningItems.filter(
    (item) => gateAllowed.has(item.category) && (!state.activeFilter || item.category === state.activeFilter)
  );
  if (pool.length) return pool;
  const fallback = learningItems.filter((item) => gateAllowed.has(item.category));
  return fallback.length ? fallback : learningItems;
}

function computeWeight(item) {
  const stats = getStats(item.id);
  const goal = item.masteryGoal ?? 5;
  const familiarityGap = Math.max(goal - stats.score, 0);
  const penalty = Math.max(stats.incorrect - stats.correct * 0.3, 0);
  const manualBoost = state.manualUnfamiliar.has(item.id) ? 3 : 0;
  return 1 + familiarityGap + penalty + manualBoost;
}

function pickWeightedItem(excludeId) {
  const pool = filteredItems();
  if (!pool.length) {
    return learningItems[0];
  }
  const weights = pool.map((item) => {
    const weight = computeWeight(item) * (item.id === excludeId ? 0.5 : 1);
    return weight;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let threshold = Math.random() * total;
  for (let index = 0; index < pool.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) return pool[index];
  }
  return pool[pool.length - 1];
}

function generateOptions(item) {
  const gateAllowed = state.mode === 'custom' ? null : allowedCategoriesFromStage();
  const pool = learningItems.filter(
    (candidate) =>
      candidate.category === item.category && (state.mode === 'custom' || gateAllowed.has(candidate.category))
  );
  const distractors = pool.filter((candidate) => candidate.id !== item.id);
  const selected = new Set([item.transliteration]);
  while (selected.size < 3 && distractors.length) {
    const randomIndex = Math.floor(Math.random() * distractors.length);
    const distractor = distractors.splice(randomIndex, 1)[0];
    selected.add(distractor.transliteration);
  }
  const result = Array.from(selected);
  while (result.length < 3) {
    result.push(result[0]);
  }
  return shuffle(result);
}

function shuffle(array) {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function speak(item) {
  if (!('speechSynthesis' in window)) {
    alert('此瀏覽器不支援語音播放，可改用自己朗讀喔！');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(item.speechText ?? item.thai);
  utterance.lang = item.category === 'tone' ? 'th-TH' : 'th-TH';
  utterance.rate = item.category === 'word' ? 0.9 : 0.85;
  window.speechSynthesis.speak(utterance);
}

function renderVisualOrbit(visual) {
  if (!elements.visualOrbit) return;
  elements.visualOrbit.innerHTML = '';
  const icon = visual ?? '✨';
  const orbitIcons = [icon, '✨', '🎯'];
  orbitIcons.forEach((emoji, index) => {
    const bubble = document.createElement('span');
    bubble.className = 'visual-bubble';
    bubble.textContent = emoji;
    bubble.style.setProperty('--offset-x', `${25 + Math.random() * 50}%`);
    bubble.style.setProperty('--offset-y', `${20 + Math.random() * 55}%`);
    bubble.style.setProperty('--delay', `${index * 0.25}s`);
    elements.visualOrbit.appendChild(bubble);
  });
}

function renderCard() {
  const item = state.currentItem;
  const categoryMeta = categories.find((category) => category.id === item.category);
  elements.categoryLabel.textContent = categoryMeta?.label ?? '';
  elements.categoryLabel.style.borderColor = categoryMeta?.color ?? '#fff';
  elements.categoryLabel.style.color = categoryMeta?.color ?? '#fff';
  if (elements.visualSymbol) {
    elements.visualSymbol.textContent = item.visual ?? '🌟';
  }
  renderVisualOrbit(item.visual);
  if (elements.thaiScript) {
    elements.thaiScript.textContent = item.thai;
  }
  if (elements.mnemonic) {
    elements.mnemonic.textContent = item.mnemonic ?? '';
  }
  if (elements.phoneticLabel) {
    if (state.answerRevealed || state.stage === 'mnemonic') {
      elements.phoneticLabel.dataset.revealed = 'true';
      elements.phoneticLabel.textContent = `音標：${item.transliteration ?? '—'}`;
    } else {
      elements.phoneticLabel.dataset.revealed = 'false';
      elements.phoneticLabel.textContent = '音標：？';
    }
  }
  if (elements.feedbackArea) {
    elements.feedbackArea.innerHTML = '';
  }
  elements.card?.classList.remove('flash-correct', 'flash-incorrect');
  renderQuestion();
}

function renderQuestion() {
  const item = state.currentItem;
  elements.questionArea.innerHTML = '';
  const prompt = document.createElement('p');
  prompt.className = 'question';

  if (state.stage === 'mnemonic') {
    prompt.textContent = item.mnemonicQuestion?.prompt ?? '想像聯想圖像，準備重答！';
  } else {
    prompt.textContent =
      state.promptOverride ||
      (item.category === 'word' ? '這個單字的羅馬拼音是？' : '請選擇對應的發音');
  }
  elements.questionArea.appendChild(prompt);

  const optionTemplate = document.getElementById('option-template');
  const fragment = document.createDocumentFragment();

  const options =
    state.stage === 'mnemonic'
      ? shuffle(item.mnemonicQuestion?.options ?? [])
      : generateOptions(item);

  options.forEach((optionText) => {
    const button = optionTemplate.content.firstElementChild.cloneNode(true);
    button.textContent = optionText;
    button.addEventListener('click', () => handleOption(optionText, button));
    fragment.appendChild(button);
  });

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'options-grid';
  optionsWrap.appendChild(fragment);
  elements.questionArea.appendChild(optionsWrap);

  if (state.showBreakdown && item.category === 'word') {
    const breakdown = document.createElement('div');
    breakdown.className = 'breakdown';
    const title = document.createElement('p');
    title.textContent = '拆解回顧：';
    breakdown.appendChild(title);

    (item.breakdown ?? []).forEach((id) => {
      const piece = itemMap[id];
      if (!piece) return;
      const row = document.createElement('div');
      row.className = 'breakdown-item';
      const info = document.createElement('div');
      info.innerHTML = `<strong>${piece.thai}</strong>`;
      const play = document.createElement('button');
      play.className = 'ghost-button';
      play.textContent = '播放';
      play.addEventListener('click', () => speak(piece));
      row.append(info, play);
      breakdown.appendChild(row);
    });

    elements.questionArea.appendChild(breakdown);
  }
}

function disableQuestionButtons() {
  elements.questionArea
    .querySelectorAll('button')
    .forEach((button) => button.setAttribute('disabled', 'disabled'));
}

function handleOption(selectedText, button) {
  const item = state.currentItem;
  if (state.stage === 'mnemonic') {
    const isCorrect = selectedText === item.mnemonicQuestion?.answer;
    disableQuestionButtons();
    button.classList.add(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      state.stage = 'quiz';
      state.promptOverride = '記住圖像，再選一次正確發音！';
      showFeedback('圖像鎖定！再挑戰一次發音。', true, { flash: false });
      setTimeout(renderQuestion, 800);
    } else {
      showFeedback(`答案是：${item.mnemonicQuestion?.answer}`, false, { flash: false });
      setTimeout(() => {
        state.stage = 'quiz';
        state.promptOverride = '';
        state.showBreakdown = false;
        selectNextItem();
      }, 1200);
    }
    return;
  }

  const isCorrect = selectedText === item.transliteration;
  disableQuestionButtons();
  button.classList.add(isCorrect ? 'correct' : 'incorrect');
  revealAnswer(true);
  recordResult(item, isCorrect);
  const stats = getStats(item.id);
  const unfamiliarRemoval = handleUnfamiliarModeResult(item, isCorrect);
  const inUnfamiliarMode = state.mode === 'custom' && state.customModeType === 'unfamiliar';

  if (isCorrect) {
    let subtext = '';
    if (inUnfamiliarMode) {
      subtext = '修羅場連擊中，繼續把不熟題打包！';
    }
    if (unfamiliarRemoval?.removed) {
      const extra = `${item.thai} 連對 3 次，已從不熟清單移除！`;
      subtext = subtext ? `${subtext} · ${extra}` : extra;
    }
    showFeedback(`✔ 答對！連續 ${stats.streak ?? 0} 題`, true, { subtext: subtext || undefined });
    state.promptOverride = '';
    state.showBreakdown = false;
    setTimeout(() => selectNextItem(), 1000);
  } else {
    showFeedback(`✘ 答錯，正確答案是 ${item.transliteration}`, false, {
      subtext: inUnfamiliarMode
        ? '修羅場會再出現這題，重播音檔反覆記起來！'
        : '已加入不熟清單，稍後會優先抽到。'
    });
    if (item.mnemonicQuestion) {
      state.stage = 'mnemonic';
      state.promptOverride = '';
    }
    if (item.category === 'word') {
      state.showBreakdown = true;
    }
    setTimeout(() => renderQuestion(), item.mnemonicQuestion ? 900 : 1300);
    if (!item.mnemonicQuestion) {
      setTimeout(() => selectNextItem(), 2000);
    }
  }
}

function showFeedback(text, positive = false, options = {}) {
  if (!elements.feedbackArea) return;
  elements.feedbackArea.innerHTML = '';
  const feedback = document.createElement('div');
  feedback.className = `feedback-message ${positive ? 'positive' : 'negative'}`;
  feedback.textContent = text;
  elements.feedbackArea.appendChild(feedback);

  if (options.subtext) {
    const subtext = document.createElement('p');
    subtext.className = 'feedback-subtext';
    subtext.textContent = options.subtext;
    elements.feedbackArea.appendChild(subtext);
  }

  if (options.flash !== false) {
    flashCard(positive ? 'correct' : 'incorrect');
  }
}

function flashCard(type) {
  if (!elements.card) return;
  elements.card.classList.remove('flash-correct', 'flash-incorrect');
  const className = type === 'correct' ? 'flash-correct' : 'flash-incorrect';
  elements.card.classList.add(className);
  setTimeout(() => elements.card?.classList.remove(className), 600);
}

function revealAnswer(fromInteraction = false) {
  const item = state.currentItem;
  if (!item) return;
  if (state.stage === 'mnemonic' && !fromInteraction) {
    showFeedback(`圖像提示答案是 ${item.mnemonicQuestion?.answer ?? ''}`, false, { flash: false });
    return;
  }
  state.answerRevealed = true;
  if (elements.phoneticLabel) {
    elements.phoneticLabel.dataset.revealed = 'true';
    elements.phoneticLabel.textContent = `音標：${item.transliteration ?? '—'}`;
  }
  highlightCorrectOption();
  if (!fromInteraction) {
    disableQuestionButtons();
    showFeedback(`答案：${item.transliteration}`, false, {
      subtext: '先記下來，再按「下一題」繼續。',
      flash: false
    });
  }
}

function highlightCorrectOption() {
  if (!elements.questionArea || state.stage === 'mnemonic') return;
  elements.questionArea.querySelectorAll('.option-button').forEach((button) => {
    if (button.textContent === state.currentItem.transliteration) {
      button.classList.add('reveal');
    }
  });
}

function selectNextItem() {
  if (state.mode === 'custom' && state.customPool.length === 0) {
    endCustomSession(false);
    return;
  }
  const nextItem = pickWeightedItem(state.currentItem?.id);
  if (nextItem) {
    goToItem(nextItem.id);
  }
}

function updateTroubleList() {
  const itemsWithStats = learningItems
    .map((item) => {
      const stats = getStats(item.id);
      const accuracy = stats.attempts ? stats.correct / stats.attempts : 1;
      return { item, stats, accuracy };
    })
    .filter(({ stats }) => stats.attempts > 0 && (stats.streak ?? 0) < 5)
    .sort((a, b) => a.accuracy - b.accuracy || b.stats.attempts - a.stats.attempts)
    .slice(0, 5);

  state.troubleIds = itemsWithStats.map(({ item }) => item.id);

  if (elements.troubleList) {
    elements.troubleList.innerHTML = '';
    if (!itemsWithStats.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = '今天的字母都很乖，沒有調皮鬼。';
      elements.troubleList.appendChild(empty);
    } else {
      itemsWithStats.forEach(({ item, stats, accuracy }, index) => {
        const li = document.createElement('li');
        li.dataset.rank = index + 1;
        const percent = Math.round(accuracy * 100);
        const needed = Math.max(0, 5 - (stats.streak ?? 0));
        li.innerHTML = `
          <span class="trouble-glyph">${item.thai}</span>
          <div class="trouble-meta">
            <p>錯 ${stats.incorrect ?? 0} 次 · 正確率 ${percent}%</p>
            <p>還需連對 ${needed} 題就畢業</p>
          </div>
        `;
        li.addEventListener('click', () => startCustomSession([item.id], `${item.thai} 集中練習`));
        elements.troubleList.appendChild(li);
      });
    }
  }
  renderUnfamiliarPool();
}

function renderAlphabetList() {
  if (!elements.alphabetList) return;
  elements.alphabetList.innerHTML = '';

  categories.forEach((category) => {
    const groupItems = learningItems.filter((item) => item.category === category.id);
    if (!groupItems.length) return;

    const section = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'alphabet-section-title';
    title.textContent = category.label;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'alphabet-grid';

    groupItems.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'alphabet-item';
      row.dataset.flagged = state.manualUnfamiliar.has(item.id) ? 'true' : 'false';

      const info = document.createElement('div');
      info.className = 'alphabet-item-info';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.manualUnfamiliar.has(item.id);
      checkbox.setAttribute('aria-label', `將 ${item.thai} 加入不熟資料庫`);
      checkbox.addEventListener('change', (event) => setManualFlag(item.id, event.target.checked, row));

      const text = document.createElement('div');
      text.innerHTML = `<strong>${item.thai}</strong>`;

      info.append(checkbox, text);

      const jump = document.createElement('button');
      jump.className = 'ghost-button mini-button';
      jump.textContent = '練習';
      jump.addEventListener('click', () => goToItem(item.id));

      row.append(info, jump);
      grid.appendChild(row);
    });

    section.appendChild(grid);
    elements.alphabetList.appendChild(section);
  });
}

function renderUnfamiliarPool() {
  if (!elements.unfamiliarPool) return;
  elements.unfamiliarPool.innerHTML = '';

  const entryMap = new Map();

  state.manualUnfamiliar.forEach((id) => {
    const item = itemMap[id];
    if (!item) return;
    entryMap.set(id, { item, sources: ['manual'], stats: getStats(id) });
  });

  state.troubleIds.forEach((id) => {
    const item = itemMap[id];
    if (!item) return;
    const existing = entryMap.get(id);
    const stats = getStats(id);
    if (existing) {
      if (!existing.sources.includes('trouble')) {
        existing.sources.push('trouble');
      }
      existing.stats = stats;
    } else {
      entryMap.set(id, { item, sources: ['trouble'], stats });
    }
  });

  const entries = Array.from(entryMap.values()).sort(
    (a, b) =>
      (categoryOrder[a.item.category] ?? 0) - (categoryOrder[b.item.category] ?? 0) ||
      a.item.thai.localeCompare(b.item.thai)
  );

  updateUnfamiliarSummary(entries.length);
  updateUnfamiliarButtons(entries.length > 0);

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '目前沒有不熟項目。';
    elements.unfamiliarPool.appendChild(empty);
    return;
  }

  entries
    .forEach(({ item, sources, stats }) => {
      const entry = document.createElement('div');
      entry.className = 'unfamiliar-entry';

      const info = document.createElement('div');
      info.className = 'unfamiliar-info';

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = '0.35rem';

      const title = document.createElement('strong');
      title.textContent = item.thai;
      titleRow.appendChild(title);

      sources.forEach((source) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.dataset.type = source === 'manual' ? 'manual' : 'trouble';
        tag.textContent = source === 'manual' ? '手動' : '系統';
        titleRow.appendChild(tag);
      });

      info.appendChild(titleRow);

      if (sources.includes('trouble')) {
        const needed = Math.max(0, 5 - (stats.streak ?? 0));
        const reminder = document.createElement('span');
        reminder.className = 'reminder-text';
        reminder.textContent = `再連對 ${needed} 題（或修羅場連對 3 題）即可自動移除`;
        info.appendChild(reminder);
      }

      const actions = document.createElement('div');
      actions.className = 'unfamiliar-actions';

      const practice = document.createElement('button');
      practice.className = 'ghost-button mini-button';
      practice.textContent = '立即練習';
      practice.addEventListener('click', () => startCustomSession([item.id], `${item.thai} 自選練習`));
      actions.appendChild(practice);

      if (sources.includes('manual')) {
        const remove = document.createElement('button');
        remove.className = 'ghost-button mini-button';
        remove.textContent = '移除';
        remove.addEventListener('click', () => setManualFlag(item.id, false));
        actions.appendChild(remove);
      }

      entry.append(info, actions);
      elements.unfamiliarPool.appendChild(entry);
    });
}

function updateUnfamiliarSummary(count) {
  if (!elements.unfamiliarCount) return;
  if (count === 0) {
    elements.unfamiliarCount.textContent = '目前沒有不熟項目，保持加油！';
  } else {
    elements.unfamiliarCount.textContent = `目前不熟項目 ${count} 題，將優先抽出加強。`;
  }
}

function updateUnfamiliarButtons(hasItems) {
  if (elements.drillUnfamiliar) {
    elements.drillUnfamiliar.disabled = !hasItems;
  }
  if (elements.startUnfamiliarPractice) {
    elements.startUnfamiliarPractice.disabled = !hasItems;
  }
}

function resetProgress() {
  if (!confirm('確定要清除全部紀錄嗎？')) return;
  state.progress = {};
  saveProgress();
  state.stageGate = {
    stats: createStageStats(),
    currentStage: stageFlow[0].id
  };
  state.stageGate.currentStage = determineCurrentStage(state.stageGate.stats);
  state.recentUnlock = null;
  state.previousCombo = 0;
  state.dailyProgress = createDailyProgress();
  saveDailyProgress();
  saveStageGate();
  updateTroubleList();
  renderStageProgress();
  ensureActiveFilterAllowed();
  renderModeTabs();
  ensureCurrentItemAllowed();
  updateHeroCta();
  renderCard();
  renderDailyWidget();
}

elements.playAudio.addEventListener('click', () => speak(state.currentItem));
elements.showAnswer?.addEventListener('click', () => revealAnswer(false));
elements.next.addEventListener('click', () => selectNextItem());
elements.resetButton.addEventListener('click', resetProgress);

elements.startAlphabetPractice?.addEventListener('click', () =>
  startCustomSession(Array.from(state.manualUnfamiliar), '字母 / 音標自選練習')
);
elements.startUnfamiliarPractice?.addEventListener('click', () => {
  const ids = gatherUnfamiliarIds();
  startCustomSession(ids, '修羅場模式', { modeType: 'unfamiliar', snapshotIds: ids });
});
elements.drillUnfamiliar?.addEventListener('click', () => {
  const ids = gatherUnfamiliarIds();
  startCustomSession(ids, '修羅場模式', { modeType: 'unfamiliar', snapshotIds: ids });
});

elements.heroCta?.addEventListener('click', () => {
  if (state.mode === 'custom') {
    endCustomSession(false);
    scrollToPractice();
    return;
  }
  scrollToPractice();
  const totalAttempts = Object.values(state.stageGate.stats).reduce(
    (sum, stats) => sum + (stats?.attempts ?? 0),
    0
  );
  if (totalAttempts === 0) {
    selectNextItem();
  }
});

elements.celebrationContinue?.addEventListener('click', () => {
  state.recentUnlock = null;
  renderStageProgress();
  selectNextItem();
});

const mobileButtons = document.querySelectorAll('[data-mobile-action]');
mobileButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.mobileAction;
    if (action === 'play') {
      speak(state.currentItem);
    } else if (action === 'answer') {
      revealAnswer(false);
    } else if (action === 'next') {
      selectNextItem();
    }
  });
});

updateTroubleList();
renderAlphabetList();
renderStageProgress();
ensureCurrentItemAllowed();
renderCard();
renderCustomIndicator();
renderDailyWidget();
maybeShowDailyReminder();
