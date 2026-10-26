// Writes supabase/messages.sql, the server's answer key, from src/data/emails.json.
// Run `npm run supabase:messages`, then paste the file into Supabase's SQL editor.
// `npm run check:data` fails if the file is out of date, so a content change
// can't ship without the scoreboard learning about it.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const OUT = `${root}supabase/messages.sql`;

export function messagesSql() {
  const emails = JSON.parse(readFileSync(`${root}src/data/emails.json`, 'utf8'));
  const q = s => `'${String(s).replace(/'/g, "''")}'`;
  const rows = emails
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(e => `  (${q(e.id)}, ${q(e.level)}, ${e.is_phishing}, ${Boolean(e.verify_first)})`);
  return [
    '-- LureLens answer key for the online scoreboard. GENERATED: do not edit.',
    '-- Regenerate with `npm run supabase:messages`, then run this in Supabase (SQL Editor).',
    `-- ${emails.length} messages.`,
    '',
    'begin;',
    'insert into public.messages (id, level, is_phishing, verify_first) values',
    rows.join(',\n'),
    'on conflict (id) do update set level = excluded.level, is_phishing = excluded.is_phishing, verify_first = excluded.verify_first;',
    `delete from public.messages where id not in (${emails.map(e => q(e.id)).join(', ')});`,
    'commit;',
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, messagesSql());
  console.log(`Wrote ${OUT}`);
}
