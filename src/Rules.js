// @flow

import './Rules.css';
import React from 'react';

// A quick reference for teams during the hunt. Teams only see the site on hunt
// day, so this covers what they need while out walking, not preparation.
// Never name clues or locations here.
const SECTIONS: Array<{ title: string, items: Array<React.Node> }> = [
  {
    title: 'Waves and directions',
    items: [
      <>
        Teams set off in waves. Your clock starts when your wave leaves, so starting later
        doesn't count against you.
      </>,
      <>
        Teams are split into two directions, <strong>🧛 Vampires</strong> and{' '}
        <strong>🧟 Zombies</strong>, which visit the stops in a different order.
      </>,
    ],
  },
  {
    title: 'At each stop',
    items: [
      <>
        <strong>Check in</strong> when you arrive and <strong>check out</strong> when you leave,
        using that stop's form.
      </>,
      <>Choose easy or hard when you check in. You can still switch when you check out.</>,
    ],
  },
  {
    title: 'Easy vs. hard',
    items: [
      <>
        <strong>Easy mode adds 30 minutes</strong> to your time for that stop. Hard mode adds
        nothing.
      </>,
      <>The mode you choose at check-out is the one that counts.</>,
    ],
  },
  {
    title: 'Finishing',
    items: [<>At the final location, submit the finish form to stop your clock.</>],
  },
  {
    title: 'Scoring',
    items: [
      <>Teams are ranked by most stops completed, then lowest adjusted time.</>,
      <>Adjusted time is your real time, plus easy-mode penalties, minus any bonuses.</>,
    ],
  },
];

export default function Rules(): React.MixedElement {
  return (
    <div className="rules">
      {SECTIONS.map(({ title, items }) => (
        <section key={title} className="rules-section">
          <h2 className="rules-title">{title}</h2>
          <ul className="rules-list">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rules-help">
        <h2 className="rules-title">Need help?</h2>
        <p>
          Message your team's WhatsApp group. Lost, stuck on a clue, or a form won't submit:
          don't hesitate to ask!
        </p>
        {/* Opens WhatsApp's chat picker so each team picks its own group.
            Works on Android Chrome; iPhone Safari not yet tested. Links that
            failed on Android Chrome: whatsapp://send, whatsapp://app,
            https://wa.me/, and https://wa.me/?text= ("couldn't open this
            chat link"). The text must be non-empty, so it's a single space. */}
        <a className="rules-help-link" href="whatsapp://send?text=%20">
          Open WhatsApp
        </a>
      </section>

      {/* Formerly the History tab */}
      <section className="rules-about">
        <h2 className="rules-title">About the hunt</h2>
        <p>
          It all started with 2 friends who wanted to force their friends to explore the beautiful
          city of San Francisco...
        </p>
      </section>
    </div>
  );
}
