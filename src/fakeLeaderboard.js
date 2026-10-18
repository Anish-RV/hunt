// @flow

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
