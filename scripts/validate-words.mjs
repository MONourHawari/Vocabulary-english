/* Checks words.json before it reaches the site, so a typo in a pull request
   fails CI instead of breaking the page for everybody. */

import { loadWords } from './words-lib.mjs';

const REQUIRED = ['word', 'pos', 'definition'];
const errors = [];
const warnings = [];

const data = await loadWords();

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate || '')) {
  errors.push('startDate must look like YYYY-MM-DD');
}
if (!Array.isArray(data.words) || data.words.length === 0) {
  errors.push('words must be a non-empty array');
}
if (data.words.length % data.wordsPerDay !== 0) {
  warnings.push(
    `words has ${data.words.length} entries, which is not a multiple of ${data.wordsPerDay} — the last day will be short.`
  );
}

const seen = new Map();
(data.words || []).forEach((entry, i) => {
  const at = `words[${i}]${entry?.word ? ` ("${entry.word}")` : ''}`;

  for (const field of REQUIRED) {
    if (!entry?.[field] || typeof entry[field] !== 'string' || !entry[field].trim()) {
      errors.push(`${at}: "${field}" is required and must be a non-empty string`);
    }
  }
  if (entry?.word) {
    const key = entry.word.toLowerCase();
    if (seen.has(key)) errors.push(`${at}: duplicate of words[${seen.get(key)}]`);
    else seen.set(key, i);
  }
  if (entry?.definition && !/[.!?]$/.test(entry.definition.trim())) {
    warnings.push(`${at}: the definition does not end with a full stop`);
  }
  for (const field of ['examples', 'synonyms', 'collocations']) {
    if (entry?.[field] !== undefined && !Array.isArray(entry[field])) {
      errors.push(`${at}: "${field}" must be an array of strings`);
    }
  }
  if (!entry?.examples?.length) {
    warnings.push(`${at}: no example sentence — add at least one, it is how the word sticks`);
  }
  if (entry?.examples?.some((e) => entry.word && !e.toLowerCase().includes(entry.word.toLowerCase().split(' ')[0]))) {
    warnings.push(`${at}: one example does not contain the word itself`);
  }
});

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);

if (errors.length > 0) {
  console.error(`\n✖ words.json is not valid: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `\n✔ words.json is valid: ${data.words.length} words (${Math.ceil(data.words.length / data.wordsPerDay)} days)` +
    (warnings.length ? `, ${warnings.length} warning(s).` : '.')
);
