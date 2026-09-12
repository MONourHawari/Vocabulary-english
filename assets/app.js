/* Two Words a Day — a static vocabulary trainer.
   No build step, no backend: the word list is a JSON file and every learner's
   progress lives in their own browser (localStorage). */

'use strict';

const STORAGE_KEY = 'twa-progress-v1';
const DAY_MS = 86400000;

/* Spaced repetition: intervals in days, indexed by level.
   A correct answer moves the card up one level, a wrong answer sends it back
   to level 0 and it comes round again in the same session. */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
const MASTERED_LEVEL = INTERVALS.length - 1;

let DATA = null;      // contents of words.json
let progress = null;  // { cards: { word: {level, due, seen, correct} } }

/* ---------------------------------------------------------------- dates */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());

/** Midnight UTC for a YYYY-MM-DD string, so date maths ignores time zones. */
function utcOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(dateStr, days) {
  const d = new Date(utcOf(dateStr) + days * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Day 0 is the first day of the course; grows by one every calendar day. */
function dayIndex() {
  return Math.max(0, Math.floor((utcOf(today()) - utcOf(DATA.startDate)) / DAY_MS));
}

/* ------------------------------------------------------------- the words */

/** Words released so far — order in words.json is the order of introduction. */
function unlockedWords() {
  const count = (dayIndex() + 1) * DATA.wordsPerDay;
  return DATA.words.slice(0, count);
}

/** The words introduced on a given day (day 0 = the first two entries). */
function wordsForDay(day) {
  const start = day * DATA.wordsPerDay;
  return DATA.words.slice(start, start + DATA.wordsPerDay);
}

/* ---------------------------------------------------------- progress I/O */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.cards) return parsed;
  } catch (err) {
    console.warn('Could not read saved progress, starting fresh.', err);
  }
  return { cards: {} };
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Could not save progress.', err);
  }
}

function cardFor(word) {
  return progress.cards[word] || { level: 0, due: today(), seen: 0, correct: 0 };
}

function isDue(word) {
  const card = progress.cards[word];
  return !card || card.due <= today();
}

function dueWords() {
  return unlockedWords().filter((w) => isDue(w.word));
}

/** Record an answer and schedule the next review. */
function grade(word, wasCorrect) {
  const card = cardFor(word);
  card.seen += 1;
  if (wasCorrect) {
    card.correct += 1;
    card.level = Math.min(card.level + 1, MASTERED_LEVEL);
  } else {
    card.level = 0;
  }
  card.due = addDays(today(), INTERVALS[card.level]);
  progress.cards[word] = card;
  saveProgress();
}

/* ------------------------------------------------------------- rendering */

const view = document.getElementById('view');
const dueBadge = document.getElementById('due-badge');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function chips(items) {
  return items.map((i) => `<span class="chip">${escapeHtml(i)}</span>`).join('');
}

function wordCard(entry, { blurred = false } = {}) {
  const parts = [`
    <div class="word-head">
      <h2 class="word${blurred ? ' reveal-hidden' : ''}" style="margin:0">${escapeHtml(entry.word)}</h2>
      <span class="pos">${escapeHtml(entry.pos)}</span>
      ${entry.ipa ? `<span class="ipa">${escapeHtml(entry.ipa)}</span>` : ''}
    </div>
    <p class="definition">${escapeHtml(entry.definition)}</p>`];

  if (entry.examples?.length) {
    parts.push(`
      <div class="block">
        <div class="block-label">In use</div>
        <ul class="examples">${entry.examples.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
      </div>`);
  }
  if (entry.collocations?.length) {
    parts.push(`
      <div class="block">
        <div class="block-label">Goes with</div>
        <div class="chips">${chips(entry.collocations)}</div>
      </div>`);
  }
  if (entry.synonyms?.length) {
    parts.push(`
      <div class="block">
        <div class="block-label">Close in meaning</div>
        <div class="chips">${chips(entry.synonyms)}</div>
      </div>`);
  }
  return `<article class="card">${parts.join('')}</article>`;
}

function updateBadge() {
  const n = dueWords().length;
  dueBadge.hidden = n === 0;
  dueBadge.textContent = String(n);
}

/* ------------------------------------------------------------ view: today */

function renderToday() {
  const day = dayIndex();
  const words = wordsForDay(day);
  const due = dueWords().length;
  const total = DATA.words.length;
  const released = unlockedWords().length;

  if (words.length === 0) {
    view.innerHTML = `
      <h1>Day ${day + 1}</h1>
      <p class="sub">No words left in the list — time to add some.</p>
      <div class="empty">
        <span class="big">🌱</span>
        The list holds ${total} words and they have all been released.
        Open a pull request on <code>words.json</code> to add the next pair.
      </div>
      ${practiceCta(due)}`;
    return;
  }

  view.innerHTML = `
    <h1>Today's two words</h1>
    <p class="sub">Day ${day + 1} · ${released} of ${total} words released so far</p>
    ${words.map((w) => wordCard(w)).join('')}
    ${practiceCta(due)}`;
}

function practiceCta(due) {
  if (due === 0) {
    return `<p class="sub" style="margin-top:24px">Nothing due right now — come back later today and older words will reappear.</p>`;
  }
  return `
    <div class="btn-row" style="margin-top:24px">
      <a class="btn" href="#/practice">Practise now · ${due} card${due === 1 ? '' : 's'} due</a>
    </div>`;
}

/* --------------------------------------------------------- view: practice */

let session = null;

function startSession() {
  const queue = shuffle(dueWords().map((w) => w.word));
  session = { queue, done: 0, planned: queue.length, correct: 0, current: null, attempts: {} };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderPractice() {
  if (!session) startSession();
  if (session.queue.length === 0) {
    renderSessionDone();
    return;
  }
  session.current = session.queue.shift();
  const entry = DATA.words.find((w) => w.word === session.current);
  const pool = unlockedWords();

  // A multiple-choice question needs distractors; fall back to a flashcard.
  const useQuiz = pool.length >= 4 && Math.random() < 0.5;
  if (useQuiz) renderQuiz(entry, pool);
  else renderFlashcard(entry);
}

function progressBar() {
  const total = session.planned || 1;
  const pct = Math.min(100, Math.round((session.done / total) * 100));
  return `
    <div class="progress">
      <span>${session.done}/${session.planned}</span>
      <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>`;
}

function renderFlashcard(entry) {
  view.innerHTML = `
    ${progressBar()}
    <p class="prompt">Do you remember what this word means?</p>
    <article class="card">
      <div class="word-head"><h2 class="word" style="margin:0">${escapeHtml(entry.word)}</h2></div>
      <div id="answer" hidden>
        <p class="definition">${escapeHtml(entry.definition)}</p>
        ${entry.examples?.length ? `<ul class="examples">${entry.examples.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}
      </div>
    </article>
    <div id="controls" class="btn-row">
      <button class="btn wide" id="reveal">Show the meaning<kbd>space</kbd></button>
    </div>`;

  const reveal = () => {
    document.getElementById('answer').hidden = false;
    document.getElementById('controls').innerHTML = `
      <button class="btn bad" id="again">Not yet<kbd>1</kbd></button>
      <button class="btn good" id="knew">I knew it<kbd>2</kbd></button>`;
    document.getElementById('again').onclick = () => answer(entry.word, false);
    document.getElementById('knew').onclick = () => answer(entry.word, true);
  };

  document.getElementById('reveal').onclick = reveal;
  keyHandler = (e) => {
    const answered = !document.getElementById('answer')?.hidden;
    if (!answered && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (answered && e.key === '1') answer(entry.word, false);
    else if (answered && e.key === '2') answer(entry.word, true);
  };
}

function renderQuiz(entry, pool) {
  const distractors = shuffle(pool.filter((w) => w.word !== entry.word)).slice(0, 3);
  const options = shuffle([entry, ...distractors]);

  view.innerHTML = `
    ${progressBar()}
    <p class="prompt">Which word fits this meaning?</p>
    <article class="card">
      <p class="definition" style="margin:0">${escapeHtml(entry.definition)}</p>
    </article>
    <div class="quiz-options" id="options">
      ${options.map((o, i) => `
        <button class="option" data-word="${escapeHtml(o.word)}">
          <span class="num">${i + 1}</span>${escapeHtml(o.word)}
        </button>`).join('')}
    </div>
    <p class="feedback" id="feedback" hidden></p>`;

  const buttons = [...document.querySelectorAll('#options .option')];

  const pick = (chosen) => {
    const correct = chosen === entry.word;
    buttons.forEach((b) => {
      b.disabled = true;
      if (b.dataset.word === entry.word) b.classList.add('correct');
      else if (b.dataset.word === chosen) b.classList.add('wrong');
    });
    const feedback = document.getElementById('feedback');
    feedback.hidden = false;
    feedback.className = `feedback ${correct ? 'ok' : 'no'}`;
    feedback.textContent = correct
      ? `Correct — ${entry.word}.`
      : `Not this time. The answer is "${entry.word}".`;
    keyHandler = null;
    setTimeout(() => answer(entry.word, correct), correct ? 650 : 1500);
  };

  buttons.forEach((b) => { b.onclick = () => pick(b.dataset.word); });
  keyHandler = (e) => {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < buttons.length) pick(buttons[i].dataset.word);
  };
}

function answer(word, wasCorrect) {
  grade(word, wasCorrect);
  session.current = null;
  session.done += 1;
  if (wasCorrect) session.correct += 1;
  else {
    // Missed cards come back at the end of the session, but only twice,
    // so one stubborn word cannot trap you in an endless loop.
    session.attempts[word] = (session.attempts[word] || 0) + 1;
    if (session.attempts[word] <= 2) {
      session.queue.push(word);
      session.planned += 1;
    }
  }
  updateBadge();
  if (session.queue.length === 0) renderSessionDone();
  else renderPractice();
}

function renderSessionDone() {
  const reviewed = session.done;
  const score = reviewed ? Math.round((session.correct / reviewed) * 100) : 0;
  const stillDue = dueWords().length;
  session = null;

  view.innerHTML = `
    <div class="empty">
      <span class="big">${reviewed ? '✅' : '🎉'}</span>
      ${reviewed
        ? `<p><strong>${reviewed} card${reviewed === 1 ? '' : 's'} reviewed · ${score}% right first time.</strong></p>`
        : '<p><strong>Nothing is due right now.</strong></p>'}
      <p>${stillDue > 0
        ? `${stillDue} card${stillDue === 1 ? '' : 's'} still waiting.`
        : 'Older words will come back on their own schedule — check again in a few hours.'}</p>
    </div>
    <div class="btn-row">
      ${stillDue > 0 ? '<button class="btn" id="again-btn">Keep going</button>' : ''}
      <a class="btn secondary" href="#/today">Back to today's words</a>
    </div>`;

  const again = document.getElementById('again-btn');
  if (again) again.onclick = () => { startSession(); renderPractice(); };
}

/* -------------------------------------------------------- view: library */

function renderLibrary() {
  const words = unlockedWords();
  const cards = words.map((w) => cardFor(w.word));
  const mastered = cards.filter((c) => c.level >= MASTERED_LEVEL).length;
  const started = cards.filter((c, i) => progress.cards[words[i].word]).length;

  view.innerHTML = `
    <h1>Library</h1>
    <p class="sub">Every word released so far. Upcoming words stay hidden — no spoilers.</p>
    <div class="stats">
      <div class="stat"><b>${words.length}</b><span>words released</span></div>
      <div class="stat"><b>${started}</b><span>words practised</span></div>
      <div class="stat"><b>${mastered}</b><span>words mastered</span></div>
    </div>
    <input class="search" id="search" type="search" placeholder="Search a word or a meaning…" autocomplete="off">
    <div id="lib-list"></div>`;

  const list = document.getElementById('lib-list');
  const draw = (filter = '') => {
    const q = filter.trim().toLowerCase();
    const shown = words.filter(
      (w) => !q || w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)
    );
    if (shown.length === 0) {
      list.innerHTML = '<p class="empty">No match.</p>';
      return;
    }
    list.innerHTML = shown.map((w) => {
      const card = progress.cards[w.word];
      const level = card ? card.level : -1;
      const label = level >= MASTERED_LEVEL ? 'mastered' : level >= 0 ? `level ${level}` : 'new';
      const cls = level >= MASTERED_LEVEL ? 'mastered' : level >= 0 ? 'learning' : '';
      return `
        <div class="lib-item">
          <span class="lib-word">${escapeHtml(w.word)}</span>
          <span class="ipa">${escapeHtml(w.ipa || '')}</span>
          <span class="level ${cls}">${label}</span>
          <span class="lib-def">${escapeHtml(w.definition)}</span>
        </div>`;
    }).join('');
  };

  draw();
  document.getElementById('search').oninput = (e) => draw(e.target.value);
}

/* ---------------------------------------------------------------- router */

let keyHandler = null;

const ROUTES = {
  '#/today': renderToday,
  '#/practice': renderPractice,
  '#/library': renderLibrary,
};

function route() {
  const hash = ROUTES[location.hash] ? location.hash : '#/today';
  if (hash !== '#/practice') session = null;
  keyHandler = null;

  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.getAttribute('href') === hash) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  updateBadge();
  ROUTES[hash]();
  window.scrollTo({ top: 0 });
}

document.addEventListener('keydown', (e) => {
  if (keyHandler && !e.metaKey && !e.ctrlKey && !e.altKey) keyHandler(e);
});

document.getElementById('reset-link').onclick = (e) => {
  e.preventDefault();
  if (confirm('Erase your progress in this browser? This cannot be undone.')) {
    progress = { cards: {} };
    saveProgress();
    route();
  }
};

window.addEventListener('hashchange', route);

fetch('words.json', { cache: 'no-cache' })
  .then((r) => {
    if (!r.ok) throw new Error(`words.json: HTTP ${r.status}`);
    return r.json();
  })
  .then((data) => {
    DATA = data;
    DATA.wordsPerDay = DATA.wordsPerDay || 2;
    progress = loadProgress();
    route();
  })
  .catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="empty"><span class="big">⚠️</span>Could not load the word list.<br>${escapeHtml(err.message)}</div>`;
  });
