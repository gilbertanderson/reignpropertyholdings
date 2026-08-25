import { unfoldIcs, parseIcsDate, parseBusyRanges, mergeRanges, nextAvailableFrom }
  from '../functions/api/availability.js';

const DAY = 86400000;
const d = (s) => Date.UTC(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
let pass = 0, fail = 0;
const t = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got ${a}\n       want ${e}`); }
};

// folded line: CRLF + space continues previous line
t('unfold', unfoldIcs('DTSTART;VALUE=DATE:2026\r\n 0901'), 'DTSTART;VALUE=DATE:20260901');
t('parse all-day', parseIcsDate('20260901'), d('20260901'));
t('parse datetime', parseIcsDate('20260901T140000Z'), d('20260901'));

const ics = [
 'BEGIN:VCALENDAR',
 'BEGIN:VEVENT','DTSTART;VALUE=DATE:20260901','DTEND;VALUE=DATE:20260910','END:VEVENT',
 'BEGIN:VEVENT','DTSTART;VALUE=DATE:20261001','DTEND;VALUE=DATE:20261005','END:VEVENT',
 'END:VCALENDAR',
].join('\r\n');
const busy = parseBusyRanges(ics);
t('two events', busy.length, 2);
// DTEND exclusive: booking ending the 10th frees the 10th
t('DTEND exclusive', busy[0].end, d('20260910'));

// folded DTSTART must still parse
const folded = 'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:2026\r\n 1201\r\nDTEND;VALUE=DATE:20261205\r\nEND:VEVENT';
t('folded event parses', parseBusyRanges(folded)[0].start, d('20261201'));

// missing DTEND = single day
t('no DTEND = 1 day',
  parseBusyRanges('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260901\r\nEND:VEVENT')[0].end,
  d('20260902'));

t('merge overlapping',
  mergeRanges([{start:d('20260901'),end:d('20260910')},{start:d('20260905'),end:d('20260915')}]),
  [{start:d('20260901'),end:d('20260915')}]);

// from 8/20: gap to 9/1 is 12d, then 9/10->10/1 is 21d; both < 30, so 10/5
t('next 30-night gap skips short windows',
  new Date(nextAvailableFrom(busy, 30, d('20260820'))).toISOString().slice(0,10),
  '2026-10-05');
// 8/1 -> 9/1 is 31d, which DOES fit 30 nights
t('30 nights fits a 31-day gap',
  new Date(nextAvailableFrom(busy, 30, d('20260801'))).toISOString().slice(0,10),
  '2026-08-01');
// boundary: exactly 30 days available
t('exactly 30d gap fits',
  new Date(nextAvailableFrom(busy, 30, d('20260802'))).toISOString().slice(0,10),
  '2026-08-02');
// 31 nights does NOT fit the same 30-day gap
t('31 nights does not fit 30d gap',
  new Date(nextAvailableFrom(busy, 31, d('20260802'))).toISOString().slice(0,10),
  '2026-10-05');
// 60-day horizon before first booking is enough at 10 nights
t('short min fits earlier',
  new Date(nextAvailableFrom(busy, 10, d('20260801'))).toISOString().slice(0,10),
  '2026-08-01');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
