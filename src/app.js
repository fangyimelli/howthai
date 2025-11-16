import { categories, learningItems, itemMap } from './data.js';

const elements = {
  categoryLabel: document.getElementById('category-label'),
  progressIndicator: document.getElementById('progress-indicator'),
  thaiScript: document.getElementById('thai-script'),
  transliteration: document.getElementById('transliteration'),
  mnemonic: document.getElementById('mnemonic'),
  questionArea: document.getElementById('question-area'),
  playAudio: document.getElementById('play-audio'),
  prev: document.getElementById('prev-card'),
  next: document.getElementById('next-card'),
  toggles: {
    consonant: document.getElementById('toggle-consonant'),
    vowel: document.getElementById('toggle-vowel'),
    tone: document.getElementById('toggle-tone'),
    word: document.getElementById('toggle-word')
  },
  troubleList: document.getElementById('trouble-list'),
  resetButton: document.getElementById('reset-progress')
};

const localStorageKey = 'thai-learning-progress';

const state = {
  currentItem: learningItems[0],
  history: [learningItems[0].id],
  historyPointer: 0,
  stage: 'quiz',
  promptOverride: '',
  showBreakdown: false,
  progress: loadProgress(),
  filters: new Set(categories.map((c) => c.id))
};

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

function getStats(id) {
  if (!state.progress[id]) {
    state.progress[id] = { attempts: 0, correct: 0, incorrect: 0, score: 0 };
  }
  return state.progress[id];
}

function goToItem(itemId, pushHistory = true) {
  const item = itemMap[itemId];
  if (!item) return;
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

function recordResult(itemId, isCorrect) {
  const stats = getStats(itemId);
  stats.attempts += 1;
  if (isCorrect) {
    stats.correct += 1;
    stats.score = Math.min(
      stats.score + 1,
      (itemMap[itemId]?.masteryGoal ?? 5)
    );
  } else {
    stats.incorrect += 1;
    stats.score = Math.max(stats.score - 1, 0);
  }
  state.progress[itemId] = stats;
  saveProgress();
  updateTroubleList();
}

function filteredItems() {
  const allowed = Array.from(state.filters);
  const pool = learningItems.filter((item) => allowed.includes(item.category));
  return pool.length ? pool : learningItems;
}

function computeWeight(item) {
  const stats = getStats(item.id);
  const goal = item.masteryGoal ?? 5;
  const familiarityGap = Math.max(goal - stats.score, 0);
  const penalty = Math.max(stats.incorrect - stats.correct * 0.3, 0);
  return 1 + familiarityGap + penalty;
}

function pickWeightedItem(excludeId) {
  const pool = filteredItems();
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
  const pool = filteredItems().filter((candidate) => candidate.category === item.category);
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
  elements.transliteration.textContent = item.transliteration;
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
      info.innerHTML = `<strong>${piece.thai}</strong><div>${piece.transliteration}</div>`;
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
  recordResult(item.id, isCorrect);

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
    .filter(({ stats }) => stats.attempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.stats.attempts - a.stats.attempts)
    .slice(0, 5);

  elements.troubleList.innerHTML = '';
  itemsWithStats.forEach(({ item, stats, accuracy }) => {
    const li = document.createElement('li');
    const percent = Math.round(accuracy * 100);
    li.textContent = `${item.thai} (${item.transliteration}) · ${percent}% 正確 · 錯 ${stats.incorrect}`;
    li.addEventListener('click', () => goToItem(item.id, true));
    elements.troubleList.appendChild(li);
  });
}

function resetProgress() {
  if (!confirm('確定要清除全部紀錄嗎？')) return;
  state.progress = {};
  saveProgress();
  updateTroubleList();
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
        categories.forEach((category) => state.filters.add(category.id));
        Object.values(elements.toggles).forEach((toggle) => (toggle.checked = true));
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

initToggles();
updateTroubleList();
renderCard();
