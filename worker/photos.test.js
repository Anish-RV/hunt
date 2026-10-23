// Run with: node --test worker/photos.test.js
// Fixtures mirror the layout of the real sheet's Photo Data and Teams tabs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  openPhotoToken,
  parseDriveIds,
  parsePhotoStream,
  photoLinkExpiry,
  sealPhotoToken,
} from './photos.js';

const TEAMS = [
  ['Team #', 'Team Name', 'Direction', 'Wave (1, 2, or 3)'],
  ['1', 'Varsha', 'Zombies', '1'],
  ['5', 'Anne', 'Zombies', '3'],
];

const PHOTO_DATA = [
  ['Timestamp', 'Team Name', 'Team Number', 'How many birds?', 'Upload your photos'],
  ['10/17/2026 12:51:09', 'varha', '1', '2', 'https://drive.google.com/open?id=1qbWk1DW1B_Zw'],
  ['10/17/2026 18:53:59', 'Anne test', '5', '', 'https://drive.google.com/open?id=1lHtzQQCwTFku'],
  [
    '10/17/2026 18:55:03',
    'Anne',
    '5',
    '3',
    'https://drive.google.com/open?id=1n0t7lRh5R43X, https://drive.google.com/open?id=1FJSMye5gkJLm',
  ],
  ['10/17/2026 19:00:00', '', '99', '1', 'https://drive.google.com/open?id=unknownTeam1'],
];

test('pulls file IDs out of one or several Drive links', () => {
  assert.deepEqual(parseDriveIds('https://drive.google.com/open?id=abc-1'), ['abc-1']);
  assert.deepEqual(
    parseDriveIds('https://drive.google.com/open?id=a1, https://drive.google.com/file/d/b2/view'),
    ['a1', 'b2']
  );
  assert.deepEqual(parseDriveIds(''), []);
});

test('lists photos newest first, named by the Teams tab', () => {
  const stream = parsePhotoStream(PHOTO_DATA, TEAMS);
  assert.deepEqual(
    stream.map((p) => [p.fileId, p.team, p.birds]),
    [
      ['unknownTeam1', 'Team 99', '1'],
      // Two photos from one submission: the bird count shows once
      ['1FJSMye5gkJLm', 'Anne', '3'],
      ['1n0t7lRh5R43X', 'Anne', null],
      ['1lHtzQQCwTFku', 'Anne', null],
      ['1qbWk1DW1B_Zw', 'Varsha', '2'],
    ]
  );
  assert.equal(stream[1].since, '6:55 PM');
});

test('skips photos a judge marked hidden', () => {
  const rows = [
    [...PHOTO_DATA[0], 'Hide'],
    [...PHOTO_DATA[1], ''],
    [...PHOTO_DATA[2], 'TRUE'],
  ];
  assert.deepEqual(
    parsePhotoStream(rows, TEAMS).map((p) => p.fileId),
    ['1qbWk1DW1B_Zw']
  );
});

test('photo links round-trip, expire, and reject tampering', async () => {
  const secret = 'test-secret';
  const now = Date.now();
  const token = await sealPhotoToken(secret, '1n0t7lRh5R43X', now + 1000);

  assert.equal(await openPhotoToken(secret, token, now), '1n0t7lRh5R43X');
  // The file ID isn't readable from the link
  assert.ok(!token.includes('1n0t7lRh5R43X'));
  // Expired
  assert.equal(await openPhotoToken(secret, token, now + 2000), null);
  // Wrong secret, edited, or garbage
  assert.equal(await openPhotoToken('other-secret', token, now), null);
  const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
  assert.equal(await openPhotoToken(secret, tampered, now), null);
  assert.equal(await openPhotoToken(secret, 'not-a-token', now), null);
});

test('a photo keeps the same link until it renews, and photos renew at different times', async () => {
  const at = Date.UTC(2026, 9, 25, 14, 5);
  const expiry = photoLinkExpiry('file1', at);
  // Always valid for at least 2 hours, and renews at most once an hour
  assert.ok(expiry - at >= 2 * 60 * 60 * 1000);
  assert.ok(expiry - at <= 3 * 60 * 60 * 1000);
  assert.equal(photoLinkExpiry('file1', at + 30 * 1000), expiry);
  assert.equal(
    await sealPhotoToken('s', 'file1', expiry),
    await sealPhotoToken('s', 'file1', photoLinkExpiry('file1', at + 30 * 1000))
  );

  // Across many photos, renewals spread through the hour instead of bunching up
  const minutes = new Set(
    Array.from({ length: 200 }, (_, i) => Math.floor((photoLinkExpiry(`file${i}`, at) % 3600000) / 60000))
  );
  assert.ok(minutes.size > 40);
});
