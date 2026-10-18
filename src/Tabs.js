// @flow

import './Tabs.css';
import React, { useState } from 'react';
import Leaderboard from './Leaderboard';
import History from './History';

type TabKey = 'leaderboard' | 'history';

type Props = {
  leaderboardRows: Array<Array<string>>,
};

export default function Tabs({ leaderboardRows }: Props): React.MixedElement {
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');

  return (
    <div className="tabs">
      <h1 className="tabs-title">Haunted Hunt</h1>
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
          aria-selected={activeTab === 'history'}
          className={activeTab === 'history' ? 'tab tab-active' : 'tab'}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <div className="tabs-panel">
        {activeTab === 'leaderboard' ? (
          <Leaderboard rows={leaderboardRows} />
        ) : (
          <History />
        )}
      </div>
    </div>
  );
}