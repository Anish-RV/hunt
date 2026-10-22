// @flow

import './About.css';
import React from 'react';

const STATS: Array<{ number: string, label: string }> = [
  { number: '4', label: 'years' },
  { number: '8', label: 'editions' },
  { number: '125+', label: 'participants' },
];

// Sarah and Shayna get a short note after their name; everyone else is just a name.
const ORGANIZERS: Array<{ name: string, note?: string }> = [
  { name: 'Sarah', note: 'the brains behind it all' },
  { name: 'Shayna', note: '6-time organizer!' },
  { name: 'Madeleine' },
  { name: 'Michelle' },
  { name: 'Jack' },
  { name: 'Anne' },
  { name: 'Varsha' },
  { name: 'Anish' },
  { name: 'Harini' },
  { name: 'Baula' },
  { name: 'Linda' },
  { name: 'Ashwat' },
  { name: 'Etienne' },
  { name: 'Walker' },
  { name: 'Geena' },
  { name: 'Delaine' },
  { name: 'Kelvin' },
  { name: 'Andrew' },
];

export default function About(): React.MixedElement {
  return (
    <div className="about">
      <section className="about-section">
        <h2 className="about-title">About the hunt</h2>
        <p>
          It all started with 2 friends who wanted to force their friends to explore the
          beautiful city of San Francisco&hellip;
        </p>
      </section>

      <div className="about-stats">
        {STATS.map(({ number, label }) => (
          <div className="about-stat" key={label}>
            <div className="about-stat-number">{number}</div>
            <div className="about-stat-label">{label}</div>
          </div>
        ))}
      </div>

      <p className="about-stats-caption">
        Grown from 20 participants in year one, with plenty of hijinks, pratfalls, and new
        friendships made along the way.
      </p>

      <section className="about-section">
        <h2 className="about-title">Organizers</h2>
        <p>
          Huge shoutout to the following folks who have organized at least one hunt over the
          years. We are very grateful!
        </p>
        <div className="about-organizers">
          {ORGANIZERS.map(({ name, note }) => (
            <span className="about-organizer-tag" key={name}>
              {name}
              {note && <span className="about-organizer-note"> &middot; {note}</span>}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}