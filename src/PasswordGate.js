// @flow

import './PasswordGate.css';
import React, { useEffect, useState } from 'react';
import Tabs from './Tabs';
import FAKE_LEADERBOARD_ROWS from './fakeLeaderboard';

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
  const [error, setError] = useState<?string>(null);
  const [loading, setLoading] = useState(false);
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
      setRows(data.values || []);
    } catch (err) {
      setError('Could not reach the leaderboard. Check your connection and try again.');
    } finally {
      setLoading(false);
      setCheckingSaved(false);
    }
  }

  // On first load, try the saved password if there is one
  useEffect(() => {
    const saved = loadSavedPassword();
    if (!USE_FAKE_DATA && saved != null) {
      unlock(saved, true);
    }
  }, []);

  function handleUnlock(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    unlock(password, false);
  }

  // Trying a saved password: just the header, no form
  if (!rows && checkingSaved) {
    return (
      <div className="gate-screen">
        <header className="header">Haunted Hunt</header>
      </div>
    );
  }

  // Not yet unlocked: full-screen "Haunted Hunt" header plus the password form
  if (!rows) {
    return (
      <div className="gate-screen">
        <header className="header">Haunted Hunt</header>
        <div className="gate">
          <form onSubmit={handleUnlock}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="gate-password-input"
              autoFocus
            />
            <button type="submit" disabled={loading} className="gate-submit">
              {loading ? 'Checking…' : 'Unlock'}
            </button>
            {error && <p className="gate-error">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  // Unlocked: hand the fetched rows down to the tabbed site
  return <Tabs leaderboardRows={rows} />;
}