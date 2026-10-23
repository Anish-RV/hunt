// @flow

import './Tabs.css';
import React from 'react';
import { useLocation, useNavigate } from 'react-router';
import Leaderboard from './Leaderboard';
import Tracker from './Tracker';
import Photos from './Photos';
import type { StreamPhoto } from './Photos';
import Rules from './Rules';
import About from './About';
import type { TrackerData } from './Tracker';

type TabKey = 'leaderboard' | 'tracker' | 'photos' | 'rules' | 'about';

const TAB_KEYS: Array<TabKey> = ['leaderboard', 'tracker', 'photos', 'rules', 'about'];

// The open tab lives in the URL's hash (e.g. /#tracker), so reloading keeps
// it, links can point at a tab, and Back steps through the tabs visited. A
// hash rather than a path because GitHub Pages only serves the home page.
function tabFromHash(hash: string): TabKey {
  const key = hash.replace(/^#/, '');
  return TAB_KEYS.find((tab) => tab === key) ?? 'leaderboard';
}

type Props = {
  leaderboardRows: Array<Array<string>>,
  tracker: ?TrackerData,
  photoLeaderboard: ?Array<Array<string>>,
  photoStream: ?Array<StreamPhoto>,
  updatedAt: ?string,
};

export default function Tabs({
  leaderboardRows,
  tracker,
  photoLeaderboard,
  photoStream,
  updatedAt,
}: Props): React.MixedElement {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromHash(location.hash);
  function setActiveTab(tab: TabKey) {
    if (tab !== activeTab) navigate({ hash: tab });
  }

  return (
    <div className="tabs">
      <div className="tabs-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'leaderboard'}
          className={activeTab === 'leaderboard' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'tracker'}
          className={activeTab === 'tracker' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('tracker')}
        >
          Tracker
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'photos'}
          className={activeTab === 'photos' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('photos')}
        >
          Photos
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'rules'}
          className={activeTab === 'rules' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('rules')}
        >
          Rules
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'about'}
          className={activeTab === 'about' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('about')}
        >
          About
        </button>
      </div>

      <div className="tabs-panel">
        {activeTab === 'leaderboard' && <Leaderboard rows={leaderboardRows} />}
        {activeTab === 'tracker' && <Tracker tracker={tracker} updatedAt={updatedAt} />}
        {activeTab === 'photos' && <Photos photoLeaderboard={photoLeaderboard} photoStream={photoStream} />}
        {activeTab === 'rules' && <Rules />}
        {activeTab === 'about' && <About />}
      </div>
    </div>
  );
}