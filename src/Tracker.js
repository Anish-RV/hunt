// @flow

import './Tracker.css';
import React, { useState } from 'react';

// Mirrors what worker/tracker.js returns
export type TrackerTeam = {
  number: number,
  name: string,
  direction: string,
  wave: string,
  state: 'not_started' | 'at' | 'traveling' | 'finished',
  clue?: number,
  from?: number,
  to?: number | 'final' | null,
  since?: string,
};

export type TrackerData = {
  routes: { [direction: string]: Array<number> },
  teams: Array<TrackerTeam>,
};

type Props = {
  tracker: ?TrackerData,
  updatedAt: ?string,
};

const DIRECTION_ICONS: { [string]: string } = {
  vampires: '🧛',
  zombies: '🧟',
};

type Stop = number | 'start' | 'final';

// Clues are labeled by their position on this direction's route ("Stop 1" is
// the first clue a team visits), never by clue number or name, so the tracker
// doesn't reveal where teams are headed
function stopLabel(stop: Stop, route: Array<number>): string {
  if (stop === 'start') return 'Start';
  if (stop === 'final') return 'Final';
  return `Stop ${route.indexOf(stop) + 1}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Teams standing at a stop (checked in, not started, or finished)
function teamsAtStop(teams: Array<TrackerTeam>, stop: Stop): Array<TrackerTeam> {
  return teams.filter((team) => {
    if (stop === 'start') return team.state === 'not_started';
    if (stop === 'final') return team.state === 'finished';
    return team.state === 'at' && team.clue === stop;
  });
}

// Teams walking from one stop to the next
function teamsLeaving(teams: Array<TrackerTeam>, from: Stop): Array<TrackerTeam> {
  return teams.filter((team) => team.state === 'traveling' && team.from === from);
}

// Says what the time means, so markers don't rely on color alone
function sinceText(team: TrackerTeam): ?string {
  if (!team.since) return null;
  if (team.state === 'traveling') return `left ${team.since}`;
  if (team.state === 'finished') return `finished ${team.since}`;
  if (team.state === 'not_started') return `checked in ${team.since}`;
  return `arrived ${team.since}`;
}

function TeamMarker({ team, walking }: { team: TrackerTeam, walking?: boolean }): React.MixedElement {
  const since = sinceText(team);
  return (
    <li className={walking ? 'subway-team subway-team-walking' : 'subway-team'}>
      <span className="subway-team-name">
        <span className="subway-team-icon" aria-hidden="true">
          {walking ? '🚶' : '📍'}
        </span>
        {team.name || `Team ${team.number}`}
      </span>
      {since && <span className="subway-team-since">{since}</span>}
    </li>
  );
}

function TeamList({
  teams,
  walking,
  label,
}: {
  teams: Array<TrackerTeam>,
  walking?: boolean,
  label: string,
}): React.Node {
  if (teams.length === 0) return null;
  return (
    <ul className="subway-teams" aria-label={label}>
      {teams.map((team) => (
        <TeamMarker key={team.number} team={team} walking={walking} />
      ))}
    </ul>
  );
}

// One direction's route, drawn as a transit line running top to bottom: stops
// alternate with the stretches of track between them. Each item renders the
// same four parts (top, track, label, bottom); stops show their name with the
// teams there underneath, and stretches show the teams walking them.
function SubwayLine({
  route,
  teams,
}: {
  route: Array<number>,
  teams: Array<TrackerTeam>,
}): React.MixedElement {
  const stops: Array<Stop> = ['start', ...route, 'final'];

  return (
    <ol className="subway">
      {stops.map((stop, i) => (
        <React.Fragment key={String(stop)}>
          <li
            className={
              stop === 'start' || stop === 'final'
                ? 'subway-stop subway-stop-terminal'
                : 'subway-stop'
            }
          >
            <div className="subway-top" />
            <span className="subway-track">
              <span className="subway-node" aria-hidden="true" />
            </span>
            <span className="subway-label">{stopLabel(stop, route)}</span>
            <div className="subway-bottom">
              <TeamList teams={teamsAtStop(teams, stop)} label={`At ${stopLabel(stop, route)}`} />
            </div>
          </li>
          {i < stops.length - 1 && (
            <li className="subway-segment">
              <div className="subway-top">
                <TeamList
                  teams={teamsLeaving(teams, stop)}
                  walking
                  label={`On the way to ${stopLabel(stops[i + 1], route)}`}
                />
              </div>
              <span className="subway-track" />
              <span className="subway-label" aria-hidden="true" />
              <div className="subway-bottom" />
            </li>
          )}
        </React.Fragment>
      ))}
    </ol>
  );
}

function formatUpdatedAt(iso: ?string): ?string {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function Tracker({ tracker, updatedAt }: Props): React.MixedElement {
  const directions = tracker ? Object.keys(tracker.routes) : [];
  const [selected, setSelected] = useState<?string>(directions[0]);

  if (!tracker || directions.length === 0) {
    return <p className="tracker-empty">The tracker isn't available right now. Check back soon!</p>;
  }

  const direction = selected && directions.includes(selected) ? selected : directions[0];
  const teams = tracker.teams.filter((team) => team.direction.toLowerCase() === direction);
  const updated = formatUpdatedAt(updatedAt);

  return (
    <div className="tracker">
      <div className="tracker-header">
        <div className="tracker-switch" role="group" aria-label="Direction">
          {directions.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === direction}
              className={d === direction ? 'tracker-switch-option tracker-switch-active' : 'tracker-switch-option'}
              onClick={() => setSelected(d)}
            >
              <span aria-hidden="true">{DIRECTION_ICONS[d] ?? '🧭'}</span> {capitalize(d)}
            </button>
          ))}
        </div>
      </div>

      <SubwayLine route={tracker.routes[direction]} teams={teams} />

      <ul className="tracker-legend" aria-label="Legend">
        <li>
          <span aria-hidden="true">📍</span> At a stop
        </li>
        <li>
          <span aria-hidden="true">🚶</span> On the way to the next stop
        </li>
      </ul>
      {updated && <p className="tracker-updated">Updated {updated} · refreshes every minute</p>}
    </div>
  );
}
