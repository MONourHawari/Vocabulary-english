/* Posts the two words of the day to a Telegram chat.
   Run by .github/workflows/daily-telegram.yml every morning.

   Environment:
     TELEGRAM_BOT_TOKEN  required — from @BotFather
     TELEGRAM_CHAT_ID    required — the group or channel id
     SITE_URL            optional — link shown at the end of the message

   Pass --dry-run to print the message instead of sending it. */

import { loadWords, dayIndex, wordsForDay, todayUtc } from './words-lib.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SITE_URL, GITHUB_REPOSITORY } = process.env;

/** Telegram's HTML parse mode only needs these three escaped. */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function siteUrl() {
  if (SITE_URL) return SITE_URL.replace(/\/$/, '');
  if (GITHUB_REPOSITORY) {
    const [owner, repo] = GITHUB_REPOSITORY.split('/');
    return `https://${owner.toLowerCase()}.github.io/${repo}`;
  }
  return null;
}

function buildMessage(data) {
  const day = dayIndex(data);
  const words = wordsForDay(data, day);
  const url = siteUrl();
  const dateLabel = new Date(`${todayUtc()}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

  if (words.length === 0) {
    return [
      `📖 <b>Day ${day + 1}</b> — ${esc(dateLabel)}`,
      '',
      'The word list is empty for today. Somebody needs to add the next pair to <code>words.json</code> 🙂',
      url ? `\n${url}` : '',
    ].join('\n');
  }

  const blocks = words.map((w, i) => {
    const lines = [
      `<b>${i + 1}. ${esc(w.word)}</b>${w.ipa ? ` <code>${esc(w.ipa)}</code>` : ''} — <i>${esc(w.pos)}</i>`,
      esc(w.definition),
    ];
    if (w.examples?.length) lines.push(`“${esc(w.examples[0])}”`);
    if (w.synonyms?.length) lines.push(`≈ ${esc(w.synonyms.join(', '))}`);
    return lines.join('\n');
  });

  return [
    `📖 <b>Two words for ${esc(dateLabel)}</b> · day ${day + 1}`,
    '',
    blocks.join('\n\n'),
    '',
    '💬 Use both words in this chat today — that is the whole point.',
    url ? `🎯 Practise older words: ${url}` : '',
  ].filter(Boolean).join('\n');
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
const message = buildMessage(data);

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
