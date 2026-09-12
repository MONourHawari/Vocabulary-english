/* Checks words.json before it reaches the site, so a typo in a pull request
   fails CI instead of breaking the page for everybody — and so the learning
   rules in CONTRIBUTING.md are enforced by a script, not by memory.

   Errors block the merge. Warnings are printed for the reviewer.

   Usage: node scripts/validate-words.mjs [path/to/draft.json] */

import { loadWords, weekOfIndex, findForm, utcOf, DAYS_PER_WEEK } from './words-lib.mjs';

const TYPES = ['word', 'phrasal-verb', 'chunk'];
const COGNATES = ['none', 'partial', 'transparent', 'false-friend'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const REQUIRED_STRINGS = ['word', 'pos', 'definition', 'theme', 'type', 'level', 'source', 'cognate'];

const WINDOW_DAYS = 14;   // no look-alikes or synonym overlaps within two weeks
const PARTICLE_DAYS = 7;  // no two phrasal verbs with the same particle within a week

const errors = [];
const warnings = [];
const error = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const data = await loadWords(process.argv[2] || undefined);
const perDay = data.wordsPerDay;
const perWeek = perDay * DAYS_PER_WEEK;
const words = Array.isArray(data.words) ? data.words : [];

/* ----------------------------------------------------------- top level */

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate || '')) {
  error('startDate must look like YYYY-MM-DD');
} else if (new Date(utcOf(data.startDate)).getUTCDay() !== 1) {
  warn('startDate is not a Monday — week 1 will not line up with a calendar week');
}
if (words.length === 0) error('words must be a non-empty array');
if (words.length % perWeek !== 0) {
  warn(`words has ${words.length} entries, which is not a full number of weeks (${perWeek} per week) — the last week is incomplete`);
}

/* ------------------------------------------------------------ helpers */

const at = (i) => `words[${i}]${words[i]?.word ? ` ("${words[i].word}")` : ''}`;
const dayOf = (i) => Math.floor(i / perDay);
const lower = (s) => String(s).toLowerCase().trim();
const synonymsOf = (e) => (e.synonyms || []).map(lower);
const particleOf = (e) => (e.type === 'phrasal-verb' ? lower(e.word).split(/\s+/).pop() : null);

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

/* ------------------------------------------------------- each entry */

const seen = new Map();
words.forEach((e, i) => {
  if (!e || typeof e !== 'object') { error(`${at(i)}: not an object`); return; }

  for (const field of REQUIRED_STRINGS) {
    if (typeof e[field] !== 'string' || !e[field].trim()) {
      error(`${at(i)}: "${field}" is required and must be a non-empty string`);
    }
  }
  if (e.type && !TYPES.includes(e.type)) error(`${at(i)}: "type" must be one of ${TYPES.join(', ')}`);
  if (e.cognate && !COGNATES.includes(e.cognate)) error(`${at(i)}: "cognate" must be one of ${COGNATES.join(', ')}`);
  if (e.level && !LEVELS.includes(e.level)) error(`${at(i)}: "level" must be a CEFR level (${LEVELS.join(', ')})`);

  if (e.cognate === 'transparent') {
    warn(`${at(i)}: transparent cognate — a French speaker reads it for free; make sure it is the light half of its day`);
  }
  if (e.cognate === 'false-friend' && !e.trap) {
    error(`${at(i)}: a false friend needs a "trap" line saying what the French look-alike means instead`);
  }
  if (e.level && LEVELS.indexOf(e.level) <= LEVELS.indexOf('B1') && e.cognate !== 'false-friend' && !e.trap) {
    warn(`${at(i)}: level ${e.level} — probably already known; keep it only for a false friend or a second sense (add a "trap")`);
  }

  for (const field of ['examples', 'synonyms', 'collocations', 'forms']) {
    if (e[field] !== undefined && (!Array.isArray(e[field]) || e[field].some((x) => typeof x !== 'string'))) {
      error(`${at(i)}: "${field}" must be an array of strings`);
    }
  }
  const examples = Array.isArray(e.examples) ? e.examples : [];
  if (examples.length === 0) error(`${at(i)}: at least one example sentence is required — it is how the word sticks`);
  else if (examples.length < 2) warn(`${at(i)}: only one example — two is the norm`);
  if (e.word && examples.length && !examples.some((s) => findForm(e, s))) {
    error(`${at(i)}: no example contains the headword (or one of its "forms") — the typed-recall question needs one`);
  }
  if (examples[0] && examples[0].split(/\s+/).length > 16) {
    warn(`${at(i)}: the first example is long (${examples[0].split(/\s+/).length} words) — keep it short enough to reuse in chat`);
  }

  const collocations = Array.isArray(e.collocations) ? e.collocations : [];
  if (collocations.length < 2) warn(`${at(i)}: fewer than 2 collocations — the word is learned as a chunk, not alone`);
  if ((e.synonyms || []).length > 3) warn(`${at(i)}: more than 3 synonyms — keep 1–3 simple ones, a long list breeds confusion`);

  if (e.definition) {
    const def = e.definition.trim();
    if (!/[.!?]$/.test(def)) warn(`${at(i)}: the definition does not end with a full stop`);
    if (def.split(/\s+/).length < 3) warn(`${at(i)}: the definition is a single word or two — explain, do not translate into a synonym`);
    if (def.split(/\s+/).length > 25) warn(`${at(i)}: the definition is long (${def.split(/\s+/).length} words) — aim for 20 or fewer`);
  }
  if (!e.ipa) warn(`${at(i)}: no "ipa" — pronunciation is half of knowing a word`);

  if (e.word) {
    const key = lower(e.word);
    if (seen.has(key)) error(`${at(i)}: duplicate of words[${seen.get(key)}]`);
    else seen.set(key, i);
  }
});

/* ----------------------------------------------------- pairs and windows */

for (let i = 0; i < words.length; i++) {
  const a = words[i];
  if (!a?.word) continue;
  for (let j = i + 1; j < words.length; j++) {
    const b = words[j];
    if (!b?.word) continue;
    const dayGap = dayOf(j) - dayOf(i);
    if (dayGap > WINDOW_DAYS) break;
    const pair = `${at(i)} and ${at(j)}`;

    // The two words of one day must not resemble each other in any way.
    if (dayGap === 0) {
      if (a.pos === b.pos && a.type === b.type) error(`${pair}: same day, same part of speech and type — pair a verb with a noun, a word with a chunk`);
      if (a.cognate === 'transparent' && b.cognate === 'transparent') error(`${pair}: two transparent cognates on one day — at most one`);
      if (a.cognate === 'false-friend' && b.cognate === 'false-friend') error(`${pair}: two false friends on one day — at most one`);
      if (a.theme !== b.theme) error(`${pair}: same day, different themes`);
    }

    // Within two weeks: no synonym overlap and no look-alikes.
    const synA = synonymsOf(a), synB = synonymsOf(b);
    if (synA.includes(lower(b.word)) || synB.includes(lower(a.word))) {
      error(`${pair}: one lists the other as a synonym, ${dayGap} day(s) apart — near-synonyms need at least ${WINDOW_DAYS} days between them`);
    }
    const shared = synA.filter((s) => synB.includes(s));
    if (shared.length) {
      const msg = `${pair}: share the synonym "${shared[0]}", ${dayGap} day(s) apart`;
      if (dayGap === 0) error(msg); else warn(msg);
    }
    const wa = lower(a.word), wb = lower(b.word);
    if (!wa.includes(' ') && !wb.includes(' ') && wa.length >= 5 && wb.length >= 5 && levenshtein(wa, wb) <= 2) {
      error(`${pair}: look-alikes (${dayGap} day(s) apart) — learners confuse similar spellings; keep them ${WINDOW_DAYS}+ days apart`);
    }
    const pa = particleOf(a), pb = particleOf(b);
    if (pa && pb && pa === pb && dayGap <= PARTICLE_DAYS) {
      warn(`${pair}: two phrasal verbs with "${pa}" within ${PARTICLE_DAYS} days — space particles out`);
    }
  }
}

/* --------------------------------------------------------------- weeks */

const weekCount = Math.ceil(words.length / perWeek);
for (let w = 0; w < weekCount; w++) {
  const entries = words.slice(w * perWeek, (w + 1) * perWeek).filter((e) => e && typeof e === 'object');
  if (entries.length === 0) continue;
  const label = `week ${w + 1}`;

  const themes = new Set(entries.map((e) => e.theme).filter(Boolean));
  if (themes.size > 1) error(`${label}: more than one theme (${[...themes].join(' / ')}) — one situation per week`);

  if (entries.length === perWeek) {
    const multiword = entries.filter((e) => e.type !== 'word').length;
    if (multiword < 2) warn(`${label}: only ${multiword} phrasal verb/chunk — aim for at least 2, they are the real gap for French speakers`);
    const transparent = entries.filter((e) => e.cognate === 'transparent').length;
    if (transparent > 4) warn(`${label}: ${transparent} transparent cognates — that is a lot of words the group can already read`);
    const posSet = new Set(entries.map((e) => e.pos));
    if (posSet.size < 3) warn(`${label}: only ${posSet.size} part(s) of speech — mix verbs, nouns and adjectives`);
    const falseFriends = entries.filter((e) => e.cognate === 'false-friend').length;
    if (falseFriends === 0) warn(`${label}: no false friend — one every week or two keeps the classic French traps in circulation`);
  }
}

/* --------------------------------------------------------------- report */

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);

if (errors.length > 0) {
  console.error(`\n✖ words.json is not valid: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(
  `\n✔ words.json is valid: ${words.length} entries, ${weekCount} week(s)` +
    (warnings.length ? `, ${warnings.length} warning(s).` : '.')
);
