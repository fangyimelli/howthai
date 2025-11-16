import { categories, learningItems, itemMap } from './data.js';

const stageFlow = [
  { id: 'consonant', label: '子音關卡', categories: ['consonant'] },
  { id: 'vowel', label: '母音 / 音調關卡', categories: ['vowel', 'tone'] },
  { id: 'word', label: '單字關卡', categories: ['word'] }
];

const elements = {
  categoryLabel: document.getElementById('category-label'),
  progressIndicator: document.getElementById('progress-indicator'),
  thaiScript: document.getElementById('thai-script'),
  mnemonic: document.getElementById('mnemonic'),
  questionArea: document.getElementById('question-area'),
  playAudio: document.getElementById('play-audio'),
  prev: document.getElementById('prev-card'),
  next: document.getElementById('next-card'),
  stageProgress: document.getElementById('stage-progress'),
  toggles: {
    consonant: document.getElementById('toggle-consonant'),
    vowel: document.getElementById('toggle-vowel'),
    tone: document.getElementById('toggle-tone'),
    word: document.getElementById('toggle-word')
  },
  troubleList: document.getElementById('trouble-list'),
  alphabetList: document.getElementById('alphabet-list'),
  unfamiliarPool: document.getElementById('unfamiliar-pool'),
  resetButton: document.getElementById('reset-progress'),
  startAlphabetPractice: document.getElementById('start-alphabet-practice'),
  startUnfamiliarPractice: document.getElementById('start-unfamiliar-practice'),
  navButtons: document.querySelectorAll('[data-view-target]'),
  views: document.querySelectorAll('.view'),
  customIndicator: document.getElementById('custom-indicator')
};

const localStorageKey = 'thai-learning-progress';
const manualStorageKey = 'thai-learning-manual-unfamiliar';
const stageStorageKey = 'thai-learning-stage-gate';
const categoryOrder = Object.fromEntries(categories.map((category, index) => [category.id, index]));

const state = {
  currentItem: learningItems[0],
  history: [learningItems[0].id],
  historyPointer: 0,
  stage: 'quiz',
  promptOverride: '',
  showBreakdown: false,
  progress: loadProgress(),
  manualUnfamiliar: loadManualUnfamiliar(),
  stageGate: loadStageGate(),
  filters: new Set(categories.map((c) => c.id)),
  view: 'practice',
  mode: 'gate',
  customPool: [],
  customLabel: '',
  customStats: { attempts: 0, correct: 0, consecutive: 0 },
  troubleIds: []
};

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

function switchView(viewId) {
  state.view = viewId;
  if (elements.views) {
    elements.views.forEach((view) => {
      view.classList.toggle('active', view.dataset.view === viewId);
    });
  }
  if (elements.navButtons) {
    elements.navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.viewTarget === viewId);
    });
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
  elements.customIndicator.textContent = `${state.customLabel || '自選練習中'} · 正確率 ${accuracy}% · 連續正確 ${state.customStats.consecutive}`;
}

function startCustomSession(itemIds, label = '自選練習') {
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
  renderCustomIndicator();
  switchView('practice');
  const startId = state.customPool[Math.floor(Math.random() * state.customPool.length)];
  goToItem(startId, true);
}

function endCustomSession(completed = false) {
  if (state.mode !== 'custom') return;
  state.mode = 'gate';
  state.customPool = [];
  state.customLabel = '';
  state.customStats = { attempts: 0, correct: 0, consecutive: 0 };
  renderCustomIndicator();
  ensureCurrentItemAllowed();
  if (completed) {
    showFeedback('自選練習達標，返回闖關模式！', true);
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
  if (!state.currentItem) return;
  if (state.mode === 'custom') return;
  if (!allowedCategoriesFromStage().has(state.currentItem.category)) {
    selectNextItem();
  }
}

function syncToggleStates() {
  const allowed = allowedCategoriesFromStage();
  Object.entries(elements.toggles).forEach(([key, checkbox]) => {
    const wasDisabled = checkbox.disabled;
    const isAllowed = allowed.has(key);
    checkbox.disabled = !isAllowed;
    if (!isAllowed) {
      checkbox.checked = false;
      state.filters.delete(key);
    } else if (wasDisabled && isAllowed) {
      checkbox.checked = true;
      state.filters.add(key);
    }
  });
}

function renderStageProgress() {
  if (!elements.stageProgress) return;
  elements.stageProgress.innerHTML = '';
  const currentStageId = state.stageGate.currentStage;

  stageFlow.forEach((stage) => {
    const stats = state.stageGate.stats[stage.id];
    const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'stage-row';
    row.dataset.status = stats.passed ? 'passed' : stage.id === currentStageId ? 'current' : 'locked';

    const header = document.createElement('div');
    header.className = 'stage-row-header';

    const title = document.createElement('div');
    title.className = 'stage-title';
    title.textContent = stage.label;

    const badge = document.createElement('span');
    badge.className = 'stage-badge';
    badge.textContent =
      stats.passed ? '已解鎖' : stage.id === currentStageId ? '進行中' : '未解鎖';

    header.append(title, badge);

    const statsLine = document.createElement('p');
    statsLine.className = 'stage-row-stats';
    statsLine.textContent = `正確率 ${accuracy}% · 連續正確 ${stats.consecutive} 題`;

    row.append(header, statsLine);
    elements.stageProgress.appendChild(row);
  });
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
  }

  saveStageGate();
  renderStageProgress();
  syncToggleStates();
  ensureCurrentItemAllowed();
  if (unlockedStage) {
    showFeedback(`恭喜通過${unlockedStage.label}，下一關已解鎖！`, true);
  }
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

function goToItem(itemId, pushHistory = true) {
  const item = itemMap[itemId];
  if (!item) return;
  if (state.mode !== 'custom' && !allowedCategoriesFromStage().has(item.category)) {
    const stageId = stageForCategory(item.category);
    const stageMeta = stageFlow.find((stage) => stage.id === stageId);
    alert(`請先完成${stageMeta?.label ?? '上一關'}，才能練習這個題型。`);
    return;
  }
  state.currentItem = item;
  state.stage = 'quiz';
  state.promptOverride = '';
  state.showBreakdown = false;

  if (pushHistory) {
    state.history = state.history.slice(0, state.historyPointer + 1);
    state.history.push(itemId);
    state.historyPointer = state.history.length - 1;
  }

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
    (item) => gateAllowed.has(item.category) && state.filters.has(item.category)
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

function renderCard() {
  const item = state.currentItem;
  const categoryMeta = categories.find((category) => category.id === item.category);
  elements.categoryLabel.textContent = categoryMeta?.label ?? '';
  elements.categoryLabel.style.borderColor = categoryMeta?.color ?? '#fff';
  elements.categoryLabel.style.color = categoryMeta?.color ?? '#fff';

  elements.thaiScript.textContent = item.thai;
  elements.mnemonic.textContent = item.mnemonic ?? '';

  const stats = getStats(item.id);
  const goal = item.masteryGoal ?? 5;
  elements.progressIndicator.textContent = `掌握度 ${stats.score}/${goal} · 正確 ${stats.correct} · 錯誤 ${stats.incorrect}`;

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

  elements.questionArea.appendChild(fragment);

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
      setTimeout(renderQuestion, 750);
    } else {
      showFeedback(`答案是：${item.mnemonicQuestion?.answer}`);
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
  recordResult(item, isCorrect);

  if (isCorrect) {
    showFeedback('太棒了！繼續下一題。', true);
    state.promptOverride = '';
    state.showBreakdown = false;
    setTimeout(() => selectNextItem(), 1000);
  } else {
    showFeedback(`正確答案是 ${item.transliteration}`);
    if (item.mnemonicQuestion) {
      state.stage = 'mnemonic';
      state.promptOverride = '';
    }
    if (item.category === 'word') {
      state.showBreakdown = true;
    }
    setTimeout(() => renderQuestion(), item.mnemonicQuestion ? 800 : 1200);
    if (!item.mnemonicQuestion) {
      setTimeout(() => selectNextItem(), 1500);
    }
  }
}

function showFeedback(text, positive = false) {
  const feedback = document.createElement('p');
  feedback.className = 'feedback';
  feedback.style.color = positive ? '#34d399' : '#f87171';
  feedback.textContent = text;
  elements.questionArea.appendChild(feedback);
}

function selectNextItem() {
  if (state.mode === 'custom' && state.customPool.length === 0) {
    endCustomSession(false);
    return;
  }
  const nextItem = pickWeightedItem(state.currentItem?.id);
  goToItem(nextItem.id, true);
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
    .slice(0, 8);

  state.troubleIds = itemsWithStats.map(({ item }) => item.id);

  if (elements.troubleList) {
    elements.troubleList.innerHTML = '';
    if (!itemsWithStats.length) {
      const empty = document.createElement('li');
      empty.textContent = '目前沒有系統偵測的不熟項目。';
      elements.troubleList.appendChild(empty);
    } else {
      itemsWithStats.forEach(({ item, stats, accuracy }) => {
        const li = document.createElement('li');
        const percent = Math.round(accuracy * 100);
        const needed = Math.max(0, 5 - (stats.streak ?? 0));
        li.textContent = `${item.thai} · ${percent}% 正確 · 連對 ${stats.streak ?? 0}/5 (還需 ${needed})`;
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
      jump.addEventListener('click', () => goToItem(item.id, true));

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

  if (!entryMap.size) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '目前沒有不熟項目。';
    elements.unfamiliarPool.appendChild(empty);
    return;
  }

  Array.from(entryMap.values())
    .sort(
      (a, b) =>
        (categoryOrder[a.item.category] ?? 0) - (categoryOrder[b.item.category] ?? 0) ||
        a.item.thai.localeCompare(b.item.thai)
    )
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
        reminder.textContent = `再連對 ${needed} 題即可自動移除`;
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

function resetProgress() {
  if (!confirm('確定要清除全部紀錄嗎？')) return;
  state.progress = {};
  saveProgress();
  state.stageGate = {
    stats: createStageStats(),
    currentStage: stageFlow[0].id
  };
  state.stageGate.currentStage = determineCurrentStage(state.stageGate.stats);
  saveStageGate();
  updateTroubleList();
  renderStageProgress();
  syncToggleStates();
  ensureCurrentItemAllowed();
  renderCard();
}

function initToggles() {
  Object.entries(elements.toggles).forEach(([key, checkbox]) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.filters.add(key);
      } else {
        state.filters.delete(key);
      }
      if (state.filters.size === 0) {
        allowedCategoriesFromStage().forEach((categoryId) => {
          state.filters.add(categoryId);
          const toggle = elements.toggles[categoryId];
          if (toggle) toggle.checked = true;
        });
      }
      if (!state.filters.has(state.currentItem.category)) {
        selectNextItem();
      }
    });
  });
}

elements.playAudio.addEventListener('click', () => speak(state.currentItem));
elements.next.addEventListener('click', () => selectNextItem());
elements.prev.addEventListener('click', () => {
  if (state.historyPointer === 0) return;
  state.historyPointer -= 1;
  const previousId = state.history[state.historyPointer];
  goToItem(previousId, false);
});
elements.resetButton.addEventListener('click', resetProgress);

elements.startAlphabetPractice?.addEventListener('click', () =>
  startCustomSession(Array.from(state.manualUnfamiliar), '字母 / 音標自選練習')
);
elements.startUnfamiliarPractice?.addEventListener('click', () =>
  startCustomSession(gatherUnfamiliarIds(), '不熟項目練習')
);

if (elements.navButtons) {
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.viewTarget));
  });
}

initToggles();
syncToggleStates();
updateTroubleList();
renderAlphabetList();
renderStageProgress();
ensureCurrentItemAllowed();
renderCard();
switchView('practice');
renderCustomIndicator();
