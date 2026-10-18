// @flow

import './Leaderboard.css';
import React from 'react';

type Props = {
  rows: Array<Array<string>>,
};

// Matches values like "42", "1,340", "-3.5", "87%"
const NUMERIC_CELL = /^-?[\d,]*\.?\d+%?$/;

// Matches durations like "5:13:42" (H:MM:SS)
const DURATION_CELL = /^(-)?(\d+):(\d{1,2}):(\d{1,2})$/;

// A column is numeric if every non-empty cell in it looks like a number
function isNumericColumn(dataRows: Array<Array<string>>, col: number): boolean {
  const cells = dataRows
    .map((row) => (row[col] ?? '').trim())
    .filter((cell) => cell !== '');
  return cells.length > 0 && cells.every((cell) => NUMERIC_CELL.test(cell));
}

// Time columns hold either H:MM:SS durations or a decimal number of minutes
function isTimeColumn(header: string): boolean {
  return /time/i.test(header);
}

// Converts a time cell to whole minutes, or null if it isn't a time
function toMinutes(cell: string): ?number {
  const trimmed = cell.trim();
  const duration = trimmed.match(DURATION_CELL);
  if (duration) {
    const [, sign, h, m, s] = duration;
    const minutes = Number(h) * 60 + Number(m) + Number(s) / 60;
    return Math.round(sign ? -minutes : minutes);
  }
  if (NUMERIC_CELL.test(trimmed)) {
    return Math.round(Number(trimmed.replace(/,/g, '')));
  }
  return null;
}

// e.g. 314 -> "5 hr 14 min", 45 -> "45 min", -687 -> "−11 hr 27 min"
function formatMinutes(total: number): string {
  const sign = total < 0 ? '−' : '';
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return hours > 0 ? `${sign}${hours} hr ${minutes} min` : `${sign}${minutes} min`;
}

function formatCell(cell: string, isTime: boolean): string {
  if (!isTime) {
    return cell;
  }
  const minutes = toMinutes(cell);
  return minutes == null ? cell : formatMinutes(minutes);
}

export default function Leaderboard({ rows }: Props): React.MixedElement {
  const [headerRow = [], ...dataRows] = rows;
  const timeCols = headerRow.map(isTimeColumn);
  const numericCols = headerRow.map(
    (_, i) => timeCols[i] || isNumericColumn(dataRows, i)
  );
  // If the sheet starts with a Rank column, the next column (e.g. Name) is the title
  const hasRank = /^rank$/i.test((headerRow[0] ?? '').trim());
  const titleCol = hasRank ? 1 : 0;

  if (dataRows.length === 0) {
    return <p className="leaderboard-empty">No scores yet. Check back soon!</p>;
  }

  function cellClass(col: number): string {
    return [
      numericCols[col] && col !== titleCol ? 'leaderboard-num' : '',
      hasRank && col === 0 ? 'leaderboard-rank' : '',
      col === titleCol ? 'leaderboard-title' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return (
    <div className="leaderboard">
      <table className="leaderboard-table">
        <thead>
          <tr>
            {headerRow.map((col, i) => (
              <th key={i} className={cellClass(i)}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, i) => {
            // Rows come from the sheet in order, so the first row is the leader
            const isLeader = i === 0;
            return (
              <tr key={i} className={isLeader ? 'leaderboard-leader' : ''}>
                {headerRow.map((col, j) => (
                  <td key={j} data-label={col} className={cellClass(j)}>
                    {isLeader && j === titleCol && (
                      <span className="leaderboard-crown" role="img" aria-label="Leader">
                        👑
                      </span>
                    )}
                    {formatCell(row[j] ?? '', timeCols[j])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
