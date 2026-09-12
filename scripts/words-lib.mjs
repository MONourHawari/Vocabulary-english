/* Shared helpers for the scripts: reading words.json and working out which
   pair of words belongs to a given day. The site does the same thing in
   assets/app.js — keep the two in step if you change the rules. */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAY_MS = 86400000;
export const DAYS_PER_WEEK = 7;

/** Reads words.json — or another file, for checking a draft before it is merged. */
export async function loadWords(file = join(ROOT, 'words.json')) {
  const raw = await readFile(file, 'utf8');
  const data = JSON.parse(raw);
  data.wordsPerDay = data.wordsPerDay || 2;
  return data;
}

export function utcOf(dateStr) {
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

/** Zero-based week of a list position; each week is 7 days × wordsPerDay. */
export const weekOfIndex = (data, i) => Math.floor(i / (DAYS_PER_WEEK * data.wordsPerDay));

/** A week's theme is whatever its first entry says. */
export function themeOfWeek(data, week) {
  return data.words[week * DAYS_PER_WEEK * data.wordsPerDay]?.theme || '';
}

/** Every spelling that counts as the headword inside an example sentence. */
export const formsOf = (entry) => [entry.word, ...(entry.forms || [])];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Find the headword (or one of its forms) inside a sentence, longest form first. */
export function findForm(entry, sentence) {
  for (const form of formsOf(entry).sort((a, b) => b.length - a.length)) {
    const m = sentence.match(new RegExp(`(^|[^A-Za-z])(${escapeRe(form)})(?=$|[^A-Za-z])`, 'i'));
    if (m) return { start: m.index + m[1].length, text: m[2] };
  }
  return null;
}

/** Blank the headword out of the first example that contains it. */
export function clozeFor(entry) {
  for (const sentence of entry.examples || []) {
    const hit = findForm(entry, sentence);
    if (hit) {
      return {
        before: sentence.slice(0, hit.start),
        answer: hit.text,
        after: sentence.slice(hit.start + hit.text.length),
      };
    }
  }
  return null;
}
