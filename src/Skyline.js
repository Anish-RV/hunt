// @flow

import './Skyline.css';
import React from 'react';

// Golden Gate cable heights at each suspender, from the cable's curve
const SUSPENDERS: Array<[number, number]> = [
  [40, 66], [50, 77], [60, 83], [70, 83], [80, 78], [90, 67],
];

// Painted Ladies, left to right
const HOUSE_XS: Array<number> = [142, 157, 172, 187];

// Downtown towers as [x, top, width]
const TOWERS: Array<[number, number, number]> = [
  [205, 100, 10], [216, 90, 9], [226, 80, 10], [254, 94, 7], [276, 86, 10], [287, 102, 9],
];

function Bat({ x, y }: { x: number, y: number }): React.MixedElement {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M-6 0 Q-3 -3 -1 -1 L0 -2 L1 -1 Q3 -3 6 0 Q3 -1 1 1 L0 2 L-1 1 Q-3 -1 -6 0 Z"
    />
  );
}

type Props = {
  // Shown in the open sky above the buildings
  children?: React.Node,
};

// A San Francisco silhouette under a full moon, with fog drifting through it.
// The drawing starts at y=-20 to leave room in the sky for the title, and the
// moon and bats sit off to the sides so they never end up behind it.
export default function Skyline({ children }: Props): React.MixedElement {
  return (
    <div className="skyline">
      {children && <div className="skyline-sky">{children}</div>}
      <svg
        className="skyline-svg"
        viewBox="0 -20 400 160"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <circle className="skyline-moon" cx="368" cy="20" r="14" />
        <g className="skyline-ink">
          <Bat x={14} y={26} />
          <Bat x={384} y={46} />
        </g>

        {/* Hills in the distance */}
        <path
          className="skyline-far"
          d="M0 140 V112 Q40 98 80 106 Q120 92 170 102 Q230 88 280 98 Q330 84 400 100 V140 Z"
        />

        {/* Golden Gate Bridge */}
        <g className="skyline-bridge">
          <rect x="26" y="48" width="3" height="92" />
          <rect x="32" y="48" width="3" height="92" />
          <rect x="96" y="48" width="3" height="92" />
          <rect x="102" y="48" width="3" height="92" />
          {[56, 70, 86].map((y) => (
            <g key={y}>
              <rect x="26" y={y} width="9" height="2" />
              <rect x="96" y={y} width="9" height="2" />
            </g>
          ))}
          <rect x="0" y="108" width="135" height="3" />
        </g>
        <g className="skyline-cables">
          <path d="M30.5 50 Q65 118 100.5 50" />
          <path d="M0 100 Q20 85 30.5 50" />
          <path d="M100.5 50 Q112 85 132 108" />
          {SUSPENDERS.map(([x, y]) => (
            <line key={x} x1={x} y1={y} x2={x} y2="108" />
          ))}
        </g>

        <g className="skyline-ink">
          {/* The city's ground, then Twin Peaks */}
          <path d="M132 140 V128 Q170 122 210 126 H400 V140 Z" />
          <path d="M300 127 Q345 96 395 127 Z" />

          {HOUSE_XS.map((x) => (
            <path key={x} d={`M${x} 129 V112 L${x + 7} 103 L${x + 14} 112 V129 Z`} />
          ))}

          {TOWERS.map(([x, top, width]) => (
            <rect key={x} x={x} y={top} width={width} height={127 - top} />
          ))}
          {/* Transamerica Pyramid and Salesforce Tower */}
          <path d="M238 127 L244.5 50 L245 38 L245.5 50 L252 127 Z" />
          <path d="M262 127 V60 Q268 48 274 60 V127 Z" />
        </g>

        {/* Lit windows */}
        <g className="skyline-windows">
          {HOUSE_XS.map((x, i) => (
            <rect key={x} x={x + (i % 2 ? 3 : 8)} y="115" width="3" height="4" />
          ))}
          <rect x="229" y="90" width="2" height="3" />
          <rect x="279" y="100" width="2" height="3" />
          <rect x="266" y="74" width="2" height="3" />
        </g>

        {/* Sutro Tower */}
        <g className="skyline-sutro">
          <path d="M337 110 L343 72 M353 110 L347 72 M345 110 V72 M339 98 H351 M341 85 H349" />
          <path d="M343 72 L341 48 M345 72 V46 M347 72 L349 48 M341.3 52 H348.7" />
          <path className="skyline-sutro-deck" d="M341.5 59 H348.5" />
        </g>
      </svg>
      <div className="skyline-fog skyline-fog-back" aria-hidden="true" />
      <div className="skyline-fog skyline-fog-front" aria-hidden="true" />
    </div>
  );
}
