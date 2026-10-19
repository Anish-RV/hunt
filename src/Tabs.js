// @flow

import './Tabs.css';
import React, { useState } from 'react';
import Leaderboard from './Leaderboard';
import Tracker from './Tracker';
import History from './History';
import type { TrackerData } from './Tracker';

type TabKey = 'leaderboard' | 'tracker' | 'history';

type Props = {
  leaderboardRows: Array<Array<string>>,
  tracker: ?TrackerData,
  updatedAt: ?string,
};

export default function Tabs({ leaderboardRows, tracker, updatedAt }: Props): React.MixedElement {
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');

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
          aria-selected={activeTab === 'history'}
          className={activeTab === 'history' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <div className="tabs-panel">
        {activeTab === 'leaderboard' && <Leaderboard rows={leaderboardRows} />}
        {activeTab === 'tracker' && <Tracker tracker={tracker} updatedAt={updatedAt} />}
        {activeTab === 'history' && <History />}
      </div>
    </div>
  );
}