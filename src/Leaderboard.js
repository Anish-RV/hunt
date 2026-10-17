// @flow

import './Leaderboard.css';
import React from 'react';

type Props = {
  rows: Array<Array<string>>,
};

export default function Leaderboard({ rows }: Props): React.MixedElement {
  const [headerRow, ...dataRows] = rows;

  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        {headerRow && (
          <thead>
            <tr>
              {headerRow.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {dataRows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}