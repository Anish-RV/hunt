/**
 * Works out where every team is, from the sheet's Teams, Check-In Data, Form
 * Data, and Finish Data tabs. Only the computed positions are sent to the
 * site, never the raw form responses.
 *
 * Teams only appear once they've checked in at the start (or, if they skipped
 * that, once they have a clue or finish event). Each team's position comes
 * from its most recent event:
 *   - checked in at the start    -> not_started, with the check-in time
 *   - checked in at clue N       -> at clue N
 *   - checked out of clue N      -> traveling to the next clue on its route
 *   - submitted the finish form  -> finished
 */

// Clue order for each direction (matched case-insensitively against the
// Teams tab's Direction column). Clue 4 leads everyone to the final location.
export const ROUTES = {
  vampires: [1, 2, 3, 4],
  zombies: [3, 2, 1, 4],
};

// Accepts "Vampire" as well as "Vampires", since the sheet says either.
// Returns the ROUTES key, or the cell as written if it isn't a direction.
function parseDirection(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (ROUTES[text]) return text;
  if (ROUTES[`${text}s`]) return `${text}s`;
  return text;
}

// Returns the index of the first header matching the pattern, or -1
function findColumn(headers, pattern) {
  return headers.findIndex((h) => pattern.test(String(h ?? '').trim()));
}

// Parses "10/17/2026 14:40:35" (the sheet's timestamp format) into a sortable
// number. The sheet's timestamps have no time zone, so these are only compared
// with each other, never with the current time.
export function parseTimestamp(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, mo, d, y, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s || 0);
}

// e.g. 1792247235000 -> "2:40 PM"
export function formatTimeOfDay(ms) {
  const date = new Date(ms);
  const h = date.getUTCHours();
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

function parseTeamNumber(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// Teams tab: header row, then one row per team
export function parseTeams(rows) {
  const [headers = [], ...data] = rows;
  const numberCol = findColumn(headers, /^team\s*(#|number)/i);
  const nameCol = findColumn(headers, /name/i);
  const directionCol = findColumn(headers, /direction/i);
  const waveCol = findColumn(headers, /wave/i);
  if (numberCol < 0) return [];

  return data
    .map((row) => ({
      number: parseTeamNumber(row[numberCol]),
      name: String(row[nameCol] ?? '').trim(),
      direction: parseDirection(row[directionCol]),
      wave: String(row[waveCol] ?? '').trim(),
    }))
    .filter((team) => team.number != null);
}

// Check-In Data tab (the start-of-hunt check-in form): header row, then one
// row per submission. Returns when each team last checked in. (The wave a
// team picks there reaches the Teams tab through a sheet formula.)
export function parseStartCheckIns(rows) {
  const [headers = [], ...data] = rows;
  const timeCol = findColumn(headers, /timestamp/i);
  const numberCol = findColumn(headers, /team\s*(#|number)/i);
  if (timeCol < 0 || numberCol < 0) return new Map();

  const latestByTeam = new Map();
  for (const row of data) {
    const team = parseTeamNumber(row[numberCol]);
    const time = parseTimestamp(row[timeCol]);
    if (team != null && time != null && time >= (latestByTeam.get(team) ?? -Infinity)) {
      latestByTeam.set(team, time);
    }
  }
  return latestByTeam;
}

// Form Data tab: row 1 labels each clue's block of columns ("[merged] Clue 2"),
// row 2 has the question headers, responses start on row 3.
export function parseClueEvents(rows) {
  const [groupRow = [], headerRow = [], ...data] = rows;
  const events = [];

  // Find where each clue's block starts and ends
  const blocks = [];
  groupRow.forEach((label, col) => {
    const match = String(label ?? '').match(/clue\s*#?\s*(\d+)/i);
    if (match && (blocks.length === 0 || blocks[blocks.length - 1].clue !== Number(match[1]))) {
      blocks.push({ clue: Number(match[1]), start: col });
    }
  });
  blocks.forEach((block, i) => {
    block.end = i + 1 < blocks.length ? blocks[i + 1].start : headerRow.length;
  });

  for (const { clue, start, end } of blocks) {
    const headers = headerRow.slice(start, end);
    const timeCol = findColumn(headers, /timestamp/i);
    const numberCol = findColumn(headers, /team\s*(#|number)/i);
    const typeCol = findColumn(headers, /check/i);
    if (timeCol < 0 || numberCol < 0 || typeCol < 0) continue;

    for (const row of data) {
      const time = parseTimestamp(row[start + timeCol]);
      const team = parseTeamNumber(row[start + numberCol]);
      const typeText = String(row[start + typeCol] ?? '').toLowerCase();
      // Anything that isn't a check-out is a check-in, since Clue 4's form has
      // no check-out (the finish form ends it) and may not ask at all
      const type = typeText.includes('out') ? 'out' : 'in';
      if (time != null && team != null) {
        events.push({ team, clue, type, time });
      }
    }
  }
  return events;
}

// Finish Data tab: header row, then one row per finish form submission
export function parseFinishEvents(rows) {
  const [headers = [], ...data] = rows;
  const timeCol = findColumn(headers, /timestamp/i);
  const numberCol = findColumn(headers, /team\s*(#|number)/i);
  if (timeCol < 0 || numberCol < 0) return [];

  return data
    .map((row) => ({
      team: parseTeamNumber(row[numberCol]),
      type: 'finish',
      time: parseTimestamp(row[timeCol]),
    }))
    .filter((e) => e.team != null && e.time != null);
}

function positionFor(team, latest, checkedInAt) {
  const route = ROUTES[team.direction] ?? null;
  if (!latest) return { state: 'not_started', since: formatTimeOfDay(checkedInAt) };
  const since = formatTimeOfDay(latest.time);
  if (latest.type === 'finish') return { state: 'finished', since };
  if (latest.type === 'in') return { state: 'at', clue: latest.clue, since };

  // Checked out: heading to the next clue on the route, or the final location
  const index = route ? route.indexOf(latest.clue) : -1;
  const to = index < 0 ? null : index + 1 < route.length ? route[index + 1] : 'final';
  return { state: 'traveling', from: latest.clue, to, since };
}

export function buildTracker({ teamsRows, checkInRows = [], formRows, finishRows }) {
  const teams = parseTeams(teamsRows);
  const checkIns = parseStartCheckIns(checkInRows);
  const events = [...parseClueEvents(formRows), ...parseFinishEvents(finishRows)];

  const latestByTeam = new Map();
  for (const event of events) {
    const current = latestByTeam.get(event.team);
    if (!current || event.time >= current.time) {
      latestByTeam.set(event.team, event);
    }
  }

  return {
    routes: ROUTES,
    teams: teams
      .filter((team) => checkIns.has(team.number) || latestByTeam.has(team.number))
      .map((team) => ({
        ...team,
        ...positionFor(team, latestByTeam.get(team.number), checkIns.get(team.number)),
      })),
  };
}
