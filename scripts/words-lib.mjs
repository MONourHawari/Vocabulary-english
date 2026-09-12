/* Shared helpers for the scripts: reading words.json and working out which
   pair of words belongs to a given day. The site does the same thing in
   assets/app.js — keep the two in step if you change the rules. */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAY_MS = 86400000;

export async function loadWords() {
  const raw = await readFile(join(ROOT, 'words.json'), 'utf8');
  const data = JSON.parse(raw);
  data.wordsPerDay = data.wordsPerDay || 2;
  return data;
}

function utcOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function dayIndex(data, dateStr = todayUtc()) {
  return Math.max(0, Math.floor((utcOf(dateStr) - utcOf(data.startDate)) / DAY_MS));
}

export function wordsForDay(data, day) {
  const start = day * data.wordsPerDay;
  return data.words.slice(start, start + data.wordsPerDay);
}
