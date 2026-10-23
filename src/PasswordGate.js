// @flow

import './PasswordGate.css';
import React, { useEffect, useRef, useState } from 'react';
import Tabs from './Tabs';
import Skyline from './Skyline';
import FAKE_LEADERBOARD_ROWS, {
  FAKE_PHOTO_LEADERBOARD_ROWS,
  FAKE_PHOTO_STREAM,
  FAKE_TRACKER,
} from './fakeLeaderboard';
import type { StreamPhoto } from './Photos';
import type { TrackerData } from './Tracker';

// Injected by create-react-app at build time
declare var process: { env: { [string]: ?string } };
declare var localStorage: {
  getItem(key: string): ?string,
  setItem(key: string, value: string): void,
  removeItem(key: string): void,
};

// Set REACT_APP_WORKER_URL to point at a local worker (e.g. http://localhost:8787)
const WORKER_URL: string =
  process.env.REACT_APP_WORKER_URL ||
  'https://sf-scav-hunt-leaderboard-proxy.vananish.workers.dev';

const USE_FAKE_DATA = Boolean(process.env.REACT_APP_FAKE_LEADERBOARD);

// How often an unlocked page re-fetches, so the tracker stays live
const REFRESH_MS = 60 * 1000;

// The password is remembered in this browser after a successful unlock, so
// returning visitors skip the form. Storage can be unavailable (e.g. private
// browsing), so every access is guarded.
const PASSWORD_STORAGE_KEY = 'hunt-password';

function loadSavedPassword(): ?string {
  try {
    return localStorage.getItem(PASSWORD_STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePassword(password: string): void {
  try {
    localStorage.setItem(PASSWORD_STORAGE_KEY, password);
  } catch {}
}

function forgetPassword(): void {
  try {
    localStorage.removeItem(PASSWORD_STORAGE_KEY);
  } catch {}
}

export default function PasswordGate(): React.MixedElement {
  const [password, setPassword] = useState('');
  // REACT_APP_FAKE_LEADERBOARD skips the password and shows made-up rows (local dev only)
  const [rows, setRows] = useState<?Array<Array<string>>>(
    USE_FAKE_DATA ? FAKE_LEADERBOARD_ROWS : null
  );
  const [tracker, setTracker] = useState<?TrackerData>(USE_FAKE_DATA ? FAKE_TRACKER : null);
  const [photoLeaderboard, setPhotoLeaderboard] = useState<?Array<Array<string>>>(
    USE_FAKE_DATA ? FAKE_PHOTO_LEADERBOARD_ROWS : null
  );
  const [photoStream, setPhotoStream] = useState<?Array<StreamPhoto>>(
    USE_FAKE_DATA ? FAKE_PHOTO_STREAM : null
  );
  const [updatedAt, setUpdatedAt] = useState<?string>(
    USE_FAKE_DATA ? new Date().toISOString() : null
  );
  const [error, setError] = useState<?string>(null);
  const [loading, setLoading] = useState(false);
  // The password that unlocked the page, reused for background refreshes
  const unlockedPassword = useRef<?string>(null);
  // True while trying a saved password, so the form doesn't flash on screen
  const [checkingSaved, setCheckingSaved] = useState(
    !USE_FAKE_DATA && loadSavedPassword() != null
  );

  async function unlock(candidate: string, isSaved: boolean) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: candidate }),
      });

      if (res.status === 401) {
        forgetPassword();
        // A saved password failing means it was changed since the last visit
        setError(isSaved ? 'The password has changed. Please enter the new one.' : 'Wrong password.');
        return;
      }

      if (!res.ok) {
        setError('Something went wrong loading the leaderboard. Try again shortly.');
        return;
      }

      const data = await res.json();
      savePassword(candidate);
      unlockedPassword.current = candidate;
      showData(data);
    } catch (err) {
      setError('Could not reach the leaderboard. Check your connection and try again.');
    } finally {
      setLoading(false);
      setCheckingSaved(false);
    }
  }

  function showData(data: Object) {
    // `leaderboard` replaced `values`; fall back for an older worker
    setRows(data.leaderboard || data.values || []);
    setTracker(data.tracker || null);
    setPhotoLeaderboard(data.photoLeaderboard || null);
    // Photo paths are relative to the worker
    setPhotoStream(
      data.photoStream
        ? data.photoStream.map((photo) => ({ ...photo, src: WORKER_URL.replace(/\/$/, '') + photo.src }))
        : null
    );
    setUpdatedAt(data.updatedAt || null);
  }

  // On first load, try the saved password if there is one
  useEffect(() => {
    const saved = loadSavedPassword();
    if (!USE_FAKE_DATA && saved != null) {
      unlock(saved, true);
    }
  }, []);

  // While unlocked, quietly re-fetch so the tracker and scores stay current.
  // A failed refresh keeps the last data on screen, except a rejected password,
  // which sends the visitor back to the form.
  const isUnlocked = rows != null;
  useEffect(() => {
    if (USE_FAKE_DATA || !isUnlocked) {
      return undefined;
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: unlockedPassword.current }),
        });
        if (res.status === 401) {
          forgetPassword();
          setRows(null);
          setError('The password has changed. Please enter the new one.');
        } else if (res.ok) {
          showData(await res.json());
        }
      } catch {}
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [isUnlocked]);

  function handleUnlock(e: { preventDefault(): void, ... }) {
    e.preventDefault();
    unlock(password, false);
  }

  // The entrance: the password form, or nothing while a saved password is tried
  let content = null;
  if (rows) {
    content = (
      <Tabs
        leaderboardRows={rows}
        tracker={tracker}
        photoLeaderboard={photoLeaderboard}
        photoStream={photoStream}
        updatedAt={updatedAt}
      />
    );
  } else if (!checkingSaved) {
    content = (
      <div className="gate">
        {/* unlock() clears the error first, so each wrong guess replays the shake */}
        <form
          onSubmit={handleUnlock}
          className={error ? 'gate-form gate-form-error' : 'gate-form'}
        >
          <label htmlFor="gate-password" className="gate-prompt">
            Speak the password, if you dare…
          </label>
          <input
            id="gate-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="gate-password-input"
            autoFocus
          />
          <button type="submit" disabled={loading} className="gate-submit">
            {loading ? 'Summoning…' : 'Enter'}
          </button>
          {error && <p className="gate-error">{error}</p>}
        </form>
      </div>
    );
  }

  // The skyline header stays put while the content below it changes, so
  // unlocking swaps the form for the tabs without anything jumping
  return (
    <div className="site">
      <Skyline>
        <h1 className="site-title">Haunted Hunt</h1>
      </Skyline>
      {content}
    </div>
  );
}
