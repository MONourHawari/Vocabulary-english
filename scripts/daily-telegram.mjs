/* Posts the two words of the day to a Telegram chat.
   Run by .github/workflows/daily-telegram.yml every morning.

   Environment:
     TELEGRAM_BOT_TOKEN  required — from @BotFather
     TELEGRAM_CHAT_ID    required — the group or channel id
     SITE_URL            optional — link shown at the end of the message

   Pass --dry-run to print the message instead of sending it.
   Pass --day N to preview a specific day (0-based). */

import { loadWords, dayIndex, wordsForDay, todayUtc, utcOf, themeOfWeek, clozeFor, DAYS_PER_WEEK } from './words-lib.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DAY_ARG = args.includes('--day') ? Number(args[args.indexOf('--day') + 1]) : null;
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SITE_URL, GITHUB_REPOSITORY } = process.env;

/** Telegram's HTML parse mode only needs these three escaped. */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TYPE_LABEL = { word: '', 'phrasal-verb': 'phrasal verb', chunk: 'chunk' };

function siteUrl() {
  if (SITE_URL) return SITE_URL.replace(/\/$/, '');
  if (GITHUB_REPOSITORY) {
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    return `https://${owner.toLowerCase()}.github.io/${repo}`;
  }
  return null;
}

function dateLabel(dateStr) {
  return new Date(utcOf(dateStr)).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

/** One word, the way it should be met for the first time: meaning, a
    sentence you could say today, the chunk it lives in — and no synonyms,
    which would only blur the first memory of it. */
function wordBlock(w, i) {
  const label = TYPE_LABEL[w.type] || w.pos;
  const lines = [
    `<b>${i + 1}. ${esc(w.word)}</b>${w.ipa ? ` <code>${esc(w.ipa)}</code>` : ''} — <i>${esc(label)}</i>`,
    esc(w.definition),
  ];
  if (w.trap) lines.push(`⚠️ ${esc(w.trap)}`);
  if (w.examples?.length) lines.push(`“${esc(w.examples[0])}”`);
  if (w.collocations?.length) lines.push(`→ ${esc(w.collocations.slice(0, 2).join(' · '))}`);
  if (w.mission) lines.push(`🎯 ${esc(w.mission)}`);
  return lines.join('\n');
}

/** Yesterday's pair, with the word blanked out: the first retrieval of the day. */
function recallBlock(data, day) {
  if (day === 0) return '';
  const gaps = wordsForDay(data, day - 1)
    .map((w) => {
      const c = clozeFor(w);
      if (!c) return null;
      const blank = '_'.repeat(Math.max(5, c.answer.length));
      return `• ${esc(c.before)}${blank}${esc(c.after)}  <tg-spoiler>${esc(c.answer)}</tg-spoiler>`;
    })
    .filter(Boolean);
  if (gaps.length === 0) return '';
  return ['🔁 <b>Yesterday, from memory</b> (tap to reveal):', ...gaps].join('\n');
}

function buildMessage(data, day) {
  const words = wordsForDay(data, day);
  const url = siteUrl();
  const date = new Date(utcOf(data.startDate) + day * 86400000).toISOString().slice(0, 10);
  const week = Math.floor(day / DAYS_PER_WEEK);
  const weekday = day % DAYS_PER_WEEK;
  const theme = themeOfWeek(data, week);

  if (words.length === 0) {
    // The list has run dry: turn the day into a review day rather than an
    // empty post, and nudge for new words without pointing at anyone.
    const back = 28;
    const older = day >= back ? wordsForDay(data, day - back) : [];
    const lines = [`📖 <b>Review day</b> — ${esc(dateLabel(date))}`, ''];
    if (older.length) {
      lines.push(`Four weeks ago you met <b>${older.map((w) => esc(w.word)).join('</b> and <b>')}</b>. Still yours? Use one of them today.`);
    } else {
      lines.push('No new words today — a good day to clear the review queue.');
    }
    lines.push('', 'The list needs its next week: see CONTRIBUTING.md.');
    if (url) lines.push(url);
    return lines.join('\n');
  }

  const header = weekday === 0 && theme
    ? `🗓 <b>Week ${week + 1}: ${esc(theme)}</b>\n📖 <b>Two words for ${esc(dateLabel(date))}</b>`
    : `📖 <b>Two words for ${esc(dateLabel(date))}</b>${theme ? ` · <i>${esc(theme)}</i>` : ''}`;

  return [
    header,
    '',
    words.map(wordBlock).join('\n\n'),
    '',
    recallBlock(data, day),
    recallBlock(data, day) ? '' : null,
    '💬 Reply with one sentence using either word about something real this week.',
    url ? `🎯 Practise: ${url}` : null,
  ].filter((l) => l !== null).join('\n');
}

async function send(text) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram refused the message (HTTP ${res.status}): ${body.description || 'unknown error'}`);
  }
}

const data = await loadWords();
const day = DAY_ARG ?? dayIndex(data);
const message = buildMessage(data, day);

if (DRY_RUN) {
  console.log(message);
  process.exit(0);
}
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Add them as repository secrets.');
  process.exit(1);
}
await send(message);
console.log('Sent the words of the day to Telegram.');
