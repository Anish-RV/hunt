// @flow

import type { TrackerData, TrackerTeam } from './Tracker';

// Made-up data for local UI work, in the same shapes as the real sheet and
// worker/tracker.js. Only used when REACT_APP_FAKE_LEADERBOARD is set, so
// styling can be iterated on without the password or real data. Teams
// alternate directions, so the 50 names make 25 Vampires and 25 Zombies:
// enough to see how long lists feel on a phone.

const TEAM_NAMES: Array<string> = [
  'Fog Chaser', 'Cable Car Bandit', 'Burrito Scout', 'Painted Lady', 'Lombard Looper',
  'Sutro Seeker', 'Twin Peaks Trekker', 'Mission Mole', "Karl's Ghosts", 'Haunted Haight',
  'Alcatraz Escapees', 'Bay Bridge Banshees', 'Dolores Daredevils', 'Presidio Phantoms',
  'Coit Tower Creeps', 'Embarcadero Eels', 'Muni Mummies', 'Sourdough Specters',
  'Golden Gate Ghouls', 'Castro Cauldron', 'Nob Hill Nightmares', 'Wharf Werewolves',
  'Sea Lion Skeletons', 'Dim Sum Demons', 'Ocean Beach Zombies', 'Lands End Lurkers',
  'Bernal Banshees', 'Potrero Poltergeists', 'Tenderloin Trolls', 'Marina Monsters',
  'Richmond Revenants', 'Sunset Spooks', 'North Beach Necromancers', "Japantown Jack-o'-Lanterns",
  'Hayes Valley Hexes', 'Glen Canyon Goblins', 'Crissy Field Crows', 'Salesforce Skulls',
  'Ferry Building Fiends', 'BART Bats', 'Twin Peaks Witches', 'Bayview Boogeymen',
  'Excelsior Exorcists', 'Cow Hollow Cacklers', 'Dogpatch Doppelgangers', 'Fort Point Phantasms',
  'Palace of Fine Frights', 'Duboce Dread', 'Mount Davidson Mummies',
  // Checks that long names wrap cleanly on a narrow screen
  'The Extremely Spooky Fellowship of the Very Long Team Name',
];

const ROUTES: { [direction: string]: Array<number> } = {
  vampires: [1, 2, 3, 4],
  zombies: [3, 2, 1, 4],
};

// Seeded so the made-up numbers are the same on every reload
let seed = 31;
function random(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// e.g. 268.5 -> "4:28:30"
function toDuration(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// A clock time between 2:00 and 4:59 PM
function randomTime(): string {
  return `${randomInt(2, 4)}:${String(randomInt(0, 59)).padStart(2, '0')} PM`;
}

type FakeTeam = {
  number: number,
  name: string,
  direction: string,
  wave: string,
  cluesDone: number,
  totalMinutes: number,
  adjustedMinutes: number,
};

const FAKE_TEAMS: Array<FakeTeam> = TEAM_NAMES.map((name, i) => {
  const cluesDone = randomInt(0, 4);
  const totalMinutes = cluesDone === 0 ? 0 : cluesDone * randomInt(40, 75) + random() * 10;
  return {
    number: i + 1,
    name,
    direction: i % 2 === 0 ? 'Vampires' : 'Zombies',
    wave: String((i % 3) + 1),
    cluesDone,
    totalMinutes,
    // Bonuses and penalties move the adjusted time either way
    adjustedMinutes: cluesDone === 0 ? 0 : totalMinutes + randomInt(-45, 60) + random(),
  };
});

// Edge cases: a team well under zero after bonuses, and one that hasn't started
FAKE_TEAMS[1].adjustedMinutes = -120.2;
FAKE_TEAMS[6].cluesDone = 0;
FAKE_TEAMS[6].totalMinutes = 0;
FAKE_TEAMS[6].adjustedMinutes = 0;

// Most clues first, then the lowest adjusted time
const RANKED: Array<FakeTeam> = [...FAKE_TEAMS].sort(
  (a, b) => b.cluesDone - a.cluesDone || a.adjustedMinutes - b.adjustedMinutes
);

const FAKE_LEADERBOARD_ROWS: Array<Array<string>> = [
  ['Rank', 'Name', 'Total Adjusted Time', 'Total Time', '# of Clues Done', 'Wave'],
  ...RANKED.map((team, i) => [
    String(i + 1),
    team.name,
    team.adjustedMinutes.toFixed(1),
    toDuration(team.totalMinutes),
    String(team.cluesDone),
    team.wave,
  ]),
];

export default FAKE_LEADERBOARD_ROWS;

// Where each team is, consistent with how many clues it has done
function trackerTeam(team: FakeTeam): TrackerTeam {
  const base = { number: team.number, name: team.name, direction: team.direction, wave: team.wave };
  const route = ROUTES[team.direction.toLowerCase()];
  const done = team.cluesDone;
  if (done === 0) {
    return { ...base, state: 'not_started' };
  }
  if (done === route.length && random() < 0.5) {
    return { ...base, state: 'finished', since: randomTime() };
  }
  const last = route[done - 1];
  if (random() < 0.5) {
    return { ...base, state: 'at', clue: last, since: randomTime() };
  }
  const next = done < route.length ? route[done] : 'final';
  return { ...base, state: 'traveling', from: last, to: next, since: randomTime() };
}

export const FAKE_TRACKER: TrackerData = {
  routes: ROUTES,
  teams: [
    ...FAKE_TEAMS.map(trackerTeam),
    // Signed up but not yet given a direction or wave
    { number: FAKE_TEAMS.length + 1, name: 'Late Arrivals', direction: '', wave: '', state: 'not_started' },
  ],
};

// Photo challenge standings, in the shape of the sheet's Photo Leaderboard tab
// (including the organizer-only columns the site hides)
const PHOTO_COUNTS: Array<{ team: FakeTeam, photos: number }> = FAKE_TEAMS.slice(0, 15)
  .map((team) => ({ team, photos: randomInt(0, 9) }))
  .sort((a, b) => b.photos - a.photos);

export const FAKE_PHOTO_LEADERBOARD_ROWS: Array<Array<string>> = [
  ['Rank', 'Team #', 'Team Name', '# Photos', 'Photos Removed by Judge', 'Last Submission', 'Gets Photo Bonus?', 'Wave'],
  ...PHOTO_COUNTS.map(({ team, photos }, i) => [
    String(i + 1),
    String(team.number),
    team.name,
    String(photos),
    String(randomInt(0, 1)),
    randomTime(),
    i === 0 ? 'YES' : '',
    team.wave,
  ]),
];

// Placeholder images for the photo stream: plain colored tiles, so fake mode
// needs no network and no real photos
function placeholderImage(hue: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="hsl(${hue},35%,72%)"/><text x="400" y="320" font-family="sans-serif" font-size="48" fill="hsl(${hue},40%,30%)" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const FAKE_PHOTO_STREAM: Array<{ src: string, team: string, birds: ?string, since: string }> =
  FAKE_TEAMS.slice(0, 12).map((team, i) => ({
    src: placeholderImage((i * 47) % 360, `🐦 photo ${i + 1}`),
    team: team.name,
    birds: i % 4 === 3 ? null : String(randomInt(1, 6)),
    since: randomTime(),
  }));
