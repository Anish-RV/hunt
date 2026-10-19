// Run with: node --test worker/tracker.test.js
// Fixtures mirror the layout of the real sheet's tabs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTracker, parseClueEvents, parseTimestamp } from './tracker.js';

const QUESTIONS = [
  'Timestamp',
  'Team Name',
  'Team Number',
  'Are you checking-in or checking-out?',
  'Which mode are you participating in?',
  'Bonus time earned (in minutes)',
];

// Builds Form Data rows: each clue gets a 6-column block plus a blank separator
function formData(blocks) {
  const groupRow = [];
  const headerRow = [];
  const height = Math.max(...blocks.map((b) => b.rows.length));
  const dataRows = Array.from({ length: height }, () => []);
  blocks.forEach(({ clue, rows }, i) => {
    groupRow.push(...QUESTIONS.map(() => `[merged] Clue ${clue}`));
    headerRow.push(...QUESTIONS);
    for (let r = 0; r < height; r++) {
      const [time, team, type] = rows[r] ?? [];
      dataRows[r].push(time ?? '', '', team ?? '', type ?? '', '', '');
    }
    if (i < blocks.length - 1) {
      groupRow.push('');
      headerRow.push('');
      dataRows.forEach((row) => row.push(''));
    }
  });
  return [groupRow, headerRow, ...dataRows];
}

const TEAMS = [
  ['Team #', 'Team Name', 'Direction', 'Wave (1, 2, or 3)'],
  ['1', 'Varsha', 'Zombies', '1'],
  ['30', 'Baula', 'Vampires', '1'],
  ['3', 'Linda', 'Zombies', '1'],
  ['2', 'Anish', 'Vampires', '2'],
  ['6', 'Harini', 'Vampires', '2'],
  ['4', 'Shayna', 'Zombies', '3'],
];

const FORM = formData([
  {
    clue: 1,
    rows: [
      ['10/9/2026 12:47:08', '', 'Check-In'], // no team number: ignored
      ['10/17/2026 13:16:30', '4', 'Check-In'],
      ['10/17/2026 13:17:34', '3', 'Check-In'],
      ['10/17/2026 13:50:25', '6', 'Check-Out'],
    ],
  },
  {
    clue: 2,
    rows: [
      ['10/17/2026 14:40:43', '4', 'Check-In'],
      ['10/17/2026 14:43:35', '2', 'Check-In'],
      ['10/17/2026 15:50:16', '4', 'Check-Out'],
    ],
  },
  {
    clue: 3,
    rows: [
      ['10/17/2026 16:31:54', '2', 'Check-In'],
      ['10/17/2026 16:31:53', '1', 'Check-In'],
      ['10/17/2026 17:53:42', '1', 'Check-Out'],
    ],
  },
  { clue: 4, rows: [['10/17/2026 17:54:04', '3', 'Check-Out']] },
]);

const FINISH = [
  ['Timestamp', 'Untitled Question', 'Team Name', 'Team Number'],
  ['', '', 'Shayna', '8'], // no timestamp: ignored
];

function byName(tracker) {
  return Object.fromEntries(tracker.teams.map((t) => [t.name, t]));
}

test('parses the sheet timestamp format', () => {
  assert.equal(parseTimestamp('10/17/2026 14:40:35'), Date.UTC(2026, 9, 17, 14, 40, 35));
  assert.equal(parseTimestamp(''), null);
});

test('reads events from every clue block', () => {
  const events = parseClueEvents(FORM);
  assert.deepEqual(
    [...new Set(events.map((e) => e.clue))].sort(),
    [1, 2, 3, 4]
  );
  assert.equal(events.length, 10);
});

test('places each team at its latest event', () => {
  const teams = byName(buildTracker({ teamsRows: TEAMS, formRows: FORM, finishRows: FINISH }));

  // Checked in at clue 3 and hasn't left
  assert.equal(teams.Anish.state, 'at');
  assert.equal(teams.Anish.clue, 3);
  assert.equal(teams.Anish.since, '4:31 PM');

  // Zombies go 3 -> 2 -> 1 -> 4, so leaving clue 3 means heading to clue 2
  assert.deepEqual(
    { state: teams.Varsha.state, from: teams.Varsha.from, to: teams.Varsha.to },
    { state: 'traveling', from: 3, to: 2 }
  );

  // Zombies leaving clue 2 head to clue 1
  assert.equal(teams.Shayna.to, 1);

  // Leaving clue 4 means heading to the final location
  assert.equal(teams.Linda.to, 'final');

  // Vampires go 1 -> 2 -> 3 -> 4
  assert.equal(teams.Harini.to, 2);

  // No events yet
  assert.equal(teams.Baula.state, 'not_started');
});

test('the finish form marks a team finished', () => {
  const finish = [...FINISH, ['10/17/2026 18:30:00', '', 'Linda', '3']];
  const teams = byName(buildTracker({ teamsRows: TEAMS, formRows: FORM, finishRows: finish }));
  assert.equal(teams.Linda.state, 'finished');
});

test('missing tabs produce an empty tracker instead of throwing', () => {
  const tracker = buildTracker({ teamsRows: [], formRows: [], finishRows: [] });
  assert.deepEqual(tracker.teams, []);
});
