// @flow

import type { TrackerData } from './Tracker';

// Made-up rows for local UI work, in the same shape as the real sheet. Only
// used when REACT_APP_FAKE_LEADERBOARD is set, so styling can be iterated on
// without the password or real data.
const FAKE_LEADERBOARD_ROWS: Array<Array<string>> = [
  ['Rank', 'Name', 'Total Adjusted Time', 'Total Time', '# of Clues Done', 'Wave'],
  ['1', 'Fog Chaser', '298.5', '4:28:30', '3', '1'],
  ['2', 'Cable Car Bandit', '-120.2', '3:59:48', '2', '2'],
  ['3', 'Burrito Scout', '212.9', '3:02:54', '2', '3'],
  ['4', 'Painted Lady', '255', '3:45:00', '2', '1'],
  ['5', 'Lombard Looper', '401.6', '6:11:36', '2', '2'],
  ['6', 'Sutro Seeker', '42.3', '1:12:18', '1', '3'],
  ['7', 'Twin Peaks Trekker', '0', '0:00:00', '0', '1'],
];

export default FAKE_LEADERBOARD_ROWS;

// Made-up team positions, in the shape worker/tracker.js returns
export const FAKE_TRACKER: TrackerData = {
  routes: { vampires: [1, 2, 3, 4], zombies: [3, 2, 1, 4] },
  teams: [
    { number: 1, name: 'Fog Chaser', direction: 'Vampires', wave: '1', state: 'at', clue: 3, since: '3:12 PM' },
    { number: 2, name: 'Cable Car Bandit', direction: 'Vampires', wave: '2', state: 'traveling', from: 1, to: 2, since: '2:48 PM' },
    { number: 3, name: 'Burrito Scout', direction: 'Vampires', wave: '3', state: 'at', clue: 1, since: '2:30 PM' },
    { number: 4, name: 'Painted Lady', direction: 'Vampires', wave: '1', state: 'not_started' },
    { number: 5, name: 'Lombard Looper', direction: 'Zombies', wave: '2', state: 'finished', since: '4:05 PM' },
    { number: 6, name: 'Sutro Seeker', direction: 'Zombies', wave: '3', state: 'traveling', from: 3, to: 2, since: '3:40 PM' },
    { number: 7, name: 'Twin Peaks Trekker', direction: 'Zombies', wave: '1', state: 'at', clue: 2, since: '3:01 PM' },
    { number: 8, name: 'Mission Mole', direction: 'Zombies', wave: '2', state: 'traveling', from: 4, to: 'final', since: '3:55 PM' },
    { number: 9, name: 'Late Arrivals', direction: '', wave: '', state: 'not_started' },
  ],
};
