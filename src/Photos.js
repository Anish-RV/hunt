// @flow

import './Photos.css';
import React, { useEffect, useRef, useState } from 'react';
import Leaderboard from './Leaderboard';

// Browser API; Flow in this repo doesn't include the DOM definitions
declare class IntersectionObserver {
  constructor(
    callback: (entries: Array<{ isIntersecting: boolean }>) => void,
    options?: { rootMargin?: string }
  ): void;
  observe(target: mixed): void;
  disconnect(): void;
}

// Posts are rendered a batch at a time, with more added as the visitor nears
// the end, so hundreds of photos don't all load at once
const POSTS_PER_BATCH = 10;

// Mirrors what the worker returns (see worker/photos.js)
export type StreamPhoto = {
  src: string,
  team: string,
  birds: ?string,
  since: string,
};

type Props = {
  photoLeaderboard: ?Array<Array<string>>,
  photoStream: ?Array<StreamPhoto>,
};

type View = 'stream' | 'standings';

const VIEWS: Array<{ key: View, label: string }> = [
  { key: 'stream', label: '📸 Stream' },
  { key: 'standings', label: '🏅 Standings' },
];

// Photo Leaderboard columns meant for organizers, not shown on the site
const HIDDEN_COLUMNS: Array<RegExp> = [
  /^team\s*#/i,
  /removed/i,
  /photo bonus/i,
  /^wave/i,
  /last submission/i,
];

function withoutHiddenColumns(rows: Array<Array<string>>): Array<Array<string>> {
  const [headerRow = []] = rows;
  const keep = headerRow
    .map((header, i) => (HIDDEN_COLUMNS.some((pattern) => pattern.test(header.trim())) ? -1 : i))
    .filter((i) => i >= 0);
  return rows.map((row) => keep.map((i) => row[i] ?? ''));
}

// Avatar colors, all dark enough for white text. Each team always gets the
// same one, picked from its name.
const AVATAR_COLORS: Array<string> = [
  '#9a6b14', // gold
  '#a5532a', // rust
  '#6b4e8a', // purple
  '#3f6b5a', // green
  '#8a3a3a', // blood red
  '#2f5d7c', // blue
  '#7a5c2e', // brown
  '#5a5a8a', // slate
];

function avatarColor(team: string): string {
  let hash = 0;
  for (let i = 0; i < team.length; i++) {
    hash = (hash * 31 + team.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function birdsText(birds: ?string): ?string {
  if (birds == null) return null;
  return `${birds} ${birds === '1' ? 'bird' : 'birds'}`;
}

function Stream({ photos }: { photos: ?Array<StreamPhoto> }): React.MixedElement {
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_BATCH);
  const sentinel = useRef<mixed>(null);
  const total = photos ? photos.length : 0;
  const hasMore = visibleCount < total;

  // Show the next batch when the end of the feed comes within a screen of view
  useEffect(() => {
    const target = sentinel.current;
    if (!hasMore || !target) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + POSTS_PER_BATCH);
        }
      },
      { rootMargin: '0px 0px 100% 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  if (!photos || photos.length === 0) {
    return (
      <p className="photos-empty">Photos will show up here as teams submit them. Check back soon!</p>
    );
  }
  // A single-column feed, like a social media timeline
  return (
    <>
      <ol className="photos-feed">
        {photos.slice(0, visibleCount).map((photo) => {
          const birds = birdsText(photo.birds);
          return (
            <li key={photo.src} className="photos-post">
              <header className="photos-post-header">
                <span
                  className="photos-avatar"
                  style={{ backgroundColor: avatarColor(photo.team) }}
                  aria-hidden="true"
                >
                  {photo.team.charAt(0).toUpperCase()}
                </span>
                <span className="photos-team">{photo.team}</span>
                <span className="photos-time">{photo.since}</span>
              </header>
              <img
                className="photos-image"
                src={photo.src}
                alt={`Photo from ${photo.team}`}
                loading="lazy"
              />
              {birds && <p className="photos-birds">🐦 {birds}</p>}
            </li>
          );
        })}
      </ol>
      {hasMore && (
        // Scrolling near this loads more on its own; the button is a fallback
        <div ref={sentinel} className="photos-more">
          <button
            type="button"
            className="photos-more-button"
            onClick={() => setVisibleCount((count) => count + POSTS_PER_BATCH)}
          >
            Show more photos
          </button>
        </div>
      )}
    </>
  );
}

export default function Photos({ photoLeaderboard, photoStream }: Props): React.MixedElement {
  const [view, setView] = useState<View>('stream');

  return (
    <div className="photos">
      {/* Same switch style as the tracker's direction switch (Tracker.css) */}
      <div className="tracker-switch photos-switch" role="group" aria-label="View">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            className={
              view === key ? 'tracker-switch-option tracker-switch-active' : 'tracker-switch-option'
            }
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'stream' && <Stream photos={photoStream} />}

      {view === 'standings' &&
        (photoLeaderboard ? (
          <Leaderboard rows={withoutHiddenColumns(photoLeaderboard)} />
        ) : (
          <p className="photos-empty">The photo standings aren't available right now. Check back soon!</p>
        ))}
    </div>
  );
}
