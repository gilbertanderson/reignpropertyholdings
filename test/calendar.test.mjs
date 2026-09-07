// Date math for the availability calendar. The rendering half of
// public/js/calendar.js is DOM-only and guarded behind a `typeof document`
// check, so importing this module under node exercises the pure helpers
// without needing a browser.

import {
  parseDay,
  startOfUtcDay,
  toRanges,
  isBusy,
  buildMonth,
  addMonths,
  MAX_MONTHS,
} from '../public/js/calendar.js';

const d = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
let pass = 0, fail = 0;
const t = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got ${a}\n       want ${e}`); }
};

// --- parsing -------------------------------------------------------------
t('parseDay valid', parseDay('2026-09-01'), d('2026-09-01'));
t('parseDay rejects junk', parseDay('nope'), null);
t('parseDay rejects empty', parseDay(''), null);
t('parseDay rejects partial', parseDay('2026-09'), null);
t('startOfUtcDay truncates', startOfUtcDay(d('2026-09-01') + 3600000), d('2026-09-01'));

// --- range conversion ----------------------------------------------------
t('toRanges maps from/to',
  toRanges([{ from: '2026-09-01', to: '2026-09-10' }]),
  [{ start: d('2026-09-01'), end: d('2026-09-10') }]);
t('toRanges drops malformed', toRanges([{ from: 'x', to: '2026-09-10' }]), []);
t('toRanges drops inverted', toRanges([{ from: '2026-09-10', to: '2026-09-01' }]), []);
t('toRanges drops zero-length', toRanges([{ from: '2026-09-01', to: '2026-09-01' }]), []);
t('toRanges tolerates non-array', toRanges(null), []);

// --- busy lookup: DTEND is exclusive ------------------------------------
const ranges = toRanges([{ from: '2026-09-01', to: '2026-09-10' }]);
t('busy on start', isBusy(d('2026-09-01'), ranges), true);
t('busy mid-range', isBusy(d('2026-09-05'), ranges), true);
t('free on end (exclusive)', isBusy(d('2026-09-10'), ranges), false);
t('free before', isBusy(d('2026-08-31'), ranges), false);

// --- month construction --------------------------------------------------
// September 2026 starts on a Tuesday, so two leading blanks.
const sep = buildMonth(2026, 8, ranges, d('2026-09-01'));
t('label', sep.label, 'September 2026');
t('leading blanks', sep.weeks[0].slice(0, 2), [null, null]);
t('first cell is the 1st', sep.weeks[0][2].day, 1);
t('grid is rectangular', sep.weeks.every((w) => w.length === 7), true);
t('30 days in september', sep.weeks.flat().filter(Boolean).length, 30);

const cellFor = (month, iso) => month.weeks.flat().find((c) => c && c.iso === iso);
t('booked day flagged', cellFor(sep, '2026-09-05').busy, true);
t('day after checkout is open', cellFor(sep, '2026-09-10').busy, false);
t('today flagged', cellFor(sep, '2026-09-01').today, true);

// A past date is never marked booked — it is just past.
const later = buildMonth(2026, 8, ranges, d('2026-09-15'));
t('past day not busy', cellFor(later, '2026-09-05').busy, false);
t('past day flagged past', cellFor(later, '2026-09-05').past, true);
t('future open day not past', cellFor(later, '2026-09-20').past, false);

// February 2028 is a leap February beginning on a Tuesday.
const feb = buildMonth(2028, 1, [], d('2028-02-01'));
t('leap february has 29 days', feb.weeks.flat().filter(Boolean).length, 29);

// --- month arithmetic ----------------------------------------------------
t('addMonths within year', addMonths(2026, 0, 2), { year: 2026, month: 2 });
t('addMonths rolls over', addMonths(2026, 11, 1), { year: 2027, month: 0 });
t('addMonths rolls back', addMonths(2026, 0, -1), { year: 2025, month: 11 });
t('addMonths multi-year', addMonths(2026, 5, 25), { year: 2028, month: 6 });
t('horizon matches api', MAX_MONTHS, 12);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
