// @flow

import './PasswordGate.css';
import React, { useState } from 'react';
import Tabs from './Tabs';

// Injected by create-react-app at build time
declare var process: { env: { [string]: ?string } };

// Set REACT_APP_WORKER_URL to point at a local worker (e.g. http://localhost:8787)
const WORKER_URL: string =
  process.env.REACT_APP_WORKER_URL ||
  'https://sf-scav-hunt-leaderboard-proxy.vananish.workers.dev';

export default function PasswordGate(): React.MixedElement {
  const [password, setPassword] = useState('');
  const [rows, setRows] = useState<?Array<Array<string>>>(null);
  const [error, setError] = useState<?string>(null);
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.status === 401) {
        setError('Wrong password.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError('Something went wrong loading the leaderboard. Try again shortly.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setRows(data.values || []);
    } catch (err) {
      setError('Could not reach the leaderboard. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Not yet unlocked: full-screen "Hunt" header plus the password form
  if (!rows) {
    return (
      <div className="gate-screen">
        <header className="header">Hunt</header>
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