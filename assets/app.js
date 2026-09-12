/* Two Words a Day — a static vocabulary trainer.
   No build step, no backend: the word list is a JSON file and every learner's
   progress lives in their own browser (localStorage).

   The learning rules encoded here (why the intervals look like this, why a
   lapse drops two rungs, why distractors share a part of speech) are
   explained in CONTRIBUTING.md under "How the practice works". */

'use strict';

const STORAGE_KEY = 'twa-progress-v2';
const LEGACY_KEY = 'twa-progress-v1';
const DAY_MS = 86400000;
const DAYS_PER_WEEK = 7;

/* Spaced repetition: review gaps in days, indexed by level. The ladder keeps
   widening up to four months because retention over a year needs gaps of
   weeks and months, not a 32-day ceiling. A lapse drops two rungs rather
   than back to zero: one miss on a mature card is noise, not amnesia. */
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
const MASTERED_LEVEL = INTERVALS.length - 1;
const LAPSE_DROP = 2;

/* Cards per session: enough to clear a normal day, small enough that a week
   away does not produce a wall. The rest roll over to the next session. */
const SESSION_CAP = 20;

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

function startsInFuture() {
  return utcOf(today()) < utcOf(DATA.startDate);
}

function longDate(dateStr) {
  return new Date(utcOf(dateStr)).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
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

/** Zero-based week of a list position; each week is 7 days × wordsPerDay. */
const weekOfIndex = (i) => Math.floor(i / (DAYS_PER_WEEK * DATA.wordsPerDay));

/** A week's theme is whatever its first entry says. */
function themeOfWeek(week) {
  const first = DATA.words[week * DAYS_PER_WEEK * DATA.wordsPerDay];
  return first?.theme || '';
}

const entryByWord = (word) => DATA.words.find((w) => w.word === word);

/* ---------------------------------------------------------- progress I/O */

function loadProgress() {
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.cards) {
        // Levels from the old, shorter ladder still fit inside the new one.
        for (const card of Object.values(parsed.cards)) {
          card.level = Math.min(card.level, MASTERED_LEVEL);
        }
        return parsed;
      }
    } catch (err) {
      console.warn(`Could not read saved progress from ${key}.`, err);
    }
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

const isNew = (word) => !progress.cards[word];

function isDue(word) {
  const card = progress.cards[word];
  return !card || card.due <= today();
}

/** Due cards, new words first, then the shakiest ones. */
function dueWords() {
  return unlockedWords()
    .filter((w) => isDue(w.word))
    .sort((a, b) => {
      const na = isNew(a.word), nb = isNew(b.word);
      if (na !== nb) return na ? -1 : 1;
      return cardFor(a.word).level - cardFor(b.word).level;
    });
}

/** Record an answer and schedule the next review. */
function grade(word, wasCorrect) {
  const card = cardFor(word);
  card.seen += 1;
  if (wasCorrect) {
    card.correct += 1;
    card.level = Math.min(card.level + 1, MASTERED_LEVEL);
  } else {
    card.level = Math.max(0, card.level - LAPSE_DROP);
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

const TYPE_LABEL = { word: '', 'phrasal-verb': 'phrasal verb', chunk: 'chunk' };

function speakButton(text) {
  if (!('speechSynthesis' in window)) return '';
  return `<button class="speak" type="button" data-say="${escapeHtml(text)}" aria-label="Hear it" title="Hear it">🔊</button>`;
}

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn('Speech failed.', err);
  }
}

function wordCard(entry) {
  const typeLabel = TYPE_LABEL[entry.type] || '';
  const parts = [`
    <div class="word-head">
      <h2 class="word" style="margin:0">${escapeHtml(entry.word)}</h2>
      ${speakButton(entry.word)}
      <span class="pos">${escapeHtml(typeLabel || entry.pos)}</span>
      ${entry.ipa ? `<span class="ipa">${escapeHtml(entry.ipa)}</span>` : ''}
    </div>
    <p class="definition">${escapeHtml(entry.definition)}</p>`];

  if (entry.trap) {
    parts.push(`<p class="trap"><strong>Careful:</strong> ${escapeHtml(entry.trap)}</p>`);
  }
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
        <div class="block-label">Close, but not the same</div>
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
  const week = Math.floor(day / DAYS_PER_WEEK);
  const theme = themeOfWeek(week);

  if (words.length === 0) {
    view.innerHTML = `
      <h1>Day ${day + 1}</h1>
      <p class="sub">No words left in the list — time to add some.</p>
      <div class="empty">
        <span class="big">🌱</span>
        The list holds ${total} words and they have all been released.
        Open a pull request on <code>words.json</code> to add the next week.
      </div>
      ${practiceCta(due)}`;
    return;
  }

  const notice = startsInFuture()
    ? `<p class="notice">The course starts on ${escapeHtml(longDate(DATA.startDate))}. Here is day 1 a little early.</p>`
    : '';

  view.innerHTML = `
    ${notice}
    <p class="eyebrow">Week ${week + 1}${theme ? ` · ${escapeHtml(theme)}` : ''}</p>
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
  const due = dueWords();
  const queue = due.slice(0, SESSION_CAP).map((w) => w.word);
  session = {
    queue, done: 0, planned: queue.length, correct: 0, current: null, attempts: {},
    heldBack: Math.max(0, due.length - queue.length),
  };
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
  const entry = entryByWord(session.current);
  const card = cardFor(entry.word);

  // First meeting: read the card, then prove it with a question straight away.
  if (isNew(entry.word)) renderIntro(entry);
  // Young cards: recognise the word among plausible lures.
  else if (card.level < 2) renderQuiz(entry);
  // Mature cards: produce the word yourself — recognition alone does not
  // put a word in your mouth in a meeting.
  else renderCloze(entry);
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

function renderIntro(entry) {
  view.innerHTML = `
    ${progressBar()}
    <p class="prompt">New word — read it once, then you will be asked about it.</p>
    ${wordCard(entry)}
    <div class="btn-row">
      <button class="btn wide" id="got-it">Got it, quiz me<kbd>space</kbd></button>
    </div>`;

  const next = () => {
    // Registers the card at level 0 without scoring it; the quiz that
    // follows does the scoring.
    progress.cards[entry.word] = cardFor(entry.word);
    saveProgress();
    renderQuiz(entry);
  };
  document.getElementById('got-it').onclick = next;
  keyHandler = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
  };
}

/** Lures that could plausibly be the answer: same part of speech, and for
    young cards a different theme, so a near neighbour never confuses the
    first memory of a word. */
function distractorsFor(entry, count) {
  const others = unlockedWords().filter((w) => w.word !== entry.word);
  const samePos = others.filter((w) => w.pos === entry.pos);
  const level = cardFor(entry.word).level;
  const preferred = level < 2 ? samePos.filter((w) => w.theme !== entry.theme) : samePos;
  const pool = preferred.length >= count ? preferred : samePos.length >= count ? samePos : others;
  return shuffle(pool).slice(0, count);
}

function renderQuiz(entry) {
  const distractors = distractorsFor(entry, 3);
  const options = shuffle([entry, ...distractors]);

  view.innerHTML = `
    ${progressBar()}
    <p class="prompt">Which ${TYPE_LABEL[entry.type] || 'word'} fits this meaning?</p>
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
    feedback.innerHTML = correct
      ? `Correct — <strong>${escapeHtml(entry.word)}</strong>.`
      : `Not this time. The answer is <strong>${escapeHtml(entry.word)}</strong>: ${escapeHtml(entry.examples?.[0] || entry.definition)}`;
    keyHandler = null;
    setTimeout(() => answer(entry.word, correct), correct ? 650 : 2200);
  };

  buttons.forEach((b) => { b.onclick = () => pick(b.dataset.word); });
  keyHandler = (e) => {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < buttons.length) pick(buttons[i].dataset.word);
  };
}

/** Every spelling that counts as the headword inside an example sentence. */
function formsOf(entry) {
  return [entry.word, ...(entry.forms || [])];
}

/** Blank the headword out of the first example that contains it. */
function clozeFor(entry) {
  for (const sentence of entry.examples || []) {
    for (const form of formsOf(entry).sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(^|[^A-Za-z])(${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^A-Za-z])`, 'i');
      const m = sentence.match(re);
      if (m) {
        const start = m.index + m[1].length;
        return {
          before: sentence.slice(0, start),
          answer: sentence.slice(start, start + m[2].length),
          after: sentence.slice(start + m[2].length),
        };
      }
    }
  }
  return null;
}

const normalise = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();

function renderCloze(entry) {
  const cloze = clozeFor(entry);
  const accepted = new Set(formsOf(entry).map(normalise));
  if (cloze) accepted.add(normalise(cloze.answer));
  const hint = `${entry.pos}${entry.word.includes(' ') ? `, ${entry.word.split(' ').length} words` : ''}`;

  view.innerHTML = `
    ${progressBar()}
    <p class="prompt">${cloze ? 'Type the missing word.' : 'Type the word for this meaning.'} <span class="hint">(${escapeHtml(hint)})</span></p>
    <article class="card">
      ${cloze
        ? `<p class="cloze">${escapeHtml(cloze.before)}<span class="gap">${'_'.repeat(Math.max(6, cloze.answer.length))}</span>${escapeHtml(cloze.after)}</p>
           <p class="definition muted" style="margin:10px 0 0">${escapeHtml(entry.definition)}</p>`
        : `<p class="definition" style="margin:0">${escapeHtml(entry.definition)}</p>`}
    </article>
    <form id="cloze-form" class="cloze-form" autocomplete="off">
      <input id="cloze-input" class="search" type="text" placeholder="Your answer…" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Your answer">
      <div class="btn-row">
        <button class="btn" type="submit">Check<kbd>enter</kbd></button>
        <button class="btn secondary" type="button" id="give-up">I don't know</button>
      </div>
    </form>
    <p class="feedback" id="feedback" hidden></p>`;

  const input = document.getElementById('cloze-input');
  input.focus();

  const finish = (correct, typed) => {
    input.disabled = true;
    document.querySelectorAll('#cloze-form button').forEach((b) => { b.disabled = true; });
    const feedback = document.getElementById('feedback');
    feedback.hidden = false;
    feedback.className = `feedback ${correct ? 'ok' : 'no'}`;
    feedback.innerHTML = correct
      ? `Correct — <strong>${escapeHtml(entry.word)}</strong>.`
      : `${typed ? 'Not quite. ' : ''}The answer is <strong>${escapeHtml(entry.word)}</strong>: ${escapeHtml(entry.examples?.[0] || entry.definition)}`;
    keyHandler = null;
    setTimeout(() => answer(entry.word, correct), correct ? 650 : 2600);
  };

  document.getElementById('cloze-form').onsubmit = (e) => {
    e.preventDefault();
    const typed = normalise(input.value);
    if (!typed) return;
    finish(accepted.has(typed), typed);
  };
  document.getElementById('give-up').onclick = () => finish(false, '');
  keyHandler = null; // the form handles Enter itself
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
        : 'Older words will come back on their own schedule — check again tomorrow.'}</p>
    </div>
    <div class="btn-row">
      ${stillDue > 0 ? '<button class="btn" id="again-btn">Keep going</button>' : ''}
      <a class="btn secondary" href="#/today">Back to today's words</a>
    </div>`;

  const again = document.getElementById('again-btn');
  if (again) again.onclick = () => { startSession(); renderPractice(); };
}

/* -------------------------------------------------------- view: library */

function levelBadge(word) {
  const card = progress.cards[word];
  const level = card ? card.level : -1;
  const label = level >= MASTERED_LEVEL ? 'mastered' : level >= 0 ? `level ${level}` : 'new';
  const cls = level >= MASTERED_LEVEL ? 'mastered' : level >= 0 ? 'learning' : '';
  return `<span class="level ${cls}">${label}</span>`;
}

function renderLibrary() {
  const words = unlockedWords();
  const cards = words.map((w) => cardFor(w.word));
  const mastered = cards.filter((c) => c.level >= MASTERED_LEVEL).length;
  const started = words.filter((w) => progress.cards[w.word]).length;

  view.innerHTML = `
    <h1>Library</h1>
    <p class="sub">Every word released so far, week by week. Upcoming words stay hidden — no spoilers.</p>
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
    const shown = words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => !q || w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q) || (w.theme || '').toLowerCase().includes(q));
    if (shown.length === 0) {
      list.innerHTML = '<p class="empty">No match.</p>';
      return;
    }
    // Newest week first: that is the one you are working on.
    const weeks = new Map();
    for (const item of shown) {
      const wk = weekOfIndex(item.i);
      if (!weeks.has(wk)) weeks.set(wk, []);
      weeks.get(wk).push(item);
    }
    list.innerHTML = [...weeks.keys()].sort((a, b) => b - a).map((wk) => `
      <section class="week">
        <h2 class="week-title">Week ${wk + 1}${themeOfWeek(wk) ? ` <span>· ${escapeHtml(themeOfWeek(wk))}</span>` : ''}</h2>
        ${weeks.get(wk).map(({ w }) => `
          <div class="lib-item">
            <span class="lib-word">${escapeHtml(w.word)}</span>
            <span class="ipa">${escapeHtml(w.ipa || '')}</span>
            ${levelBadge(w.word)}
            <span class="lib-def">${escapeHtml(w.definition)}</span>
          </div>`).join('')}
      </section>`).join('');
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
  if (e.target.matches('input, textarea')) return;
  if (keyHandler && !e.metaKey && !e.ctrlKey && !e.altKey) keyHandler(e);
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.speak');
  if (btn) speak(btn.dataset.say);
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
