/**
 * DiningTimer — occupiedAt-based MM:SS stopwatch.
 *
 * Props:
 *   occupiedAt   {string|null}  ISO timestamp string set by the backend when the
 *                               table first became occupied (first KOT printed).
 *                               Null → renders nothing (VACANT / CUSTOMER REQUEST).
 *   isBillPending {boolean}     When true, the timer is frozen at the current elapsed
 *                               value and no interval runs. Default false.
 *
 * Behaviour:
 *   - OCCUPIED  : counts up every second from occupiedAt → now
 *   - BILL_PENDING: shows frozen elapsed value (no interval)
 *   - VACANT / null occupiedAt: renders nothing
 *   - Never reads createdAt, updatedAt, kotPrintedAt or any DB order timestamp
 */
import React, { useState, useEffect } from 'react';
import { formatMmSs } from '../../utils/diningTimer';

const MAX_SANITY_SECONDS = 24 * 60 * 60; // 24 hours guard against stale DB occupied_at timestamps

function parseOccupiedTimeMs(occupiedAt) {
  if (!occupiedAt) return NaN;
  if (occupiedAt instanceof Date) {
    return occupiedAt.getTime();
  }
  const raw = String(occupiedAt).trim();
  if (!raw) return NaN;

  // Normalize SQL datetime space to ISO 'T'
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(raw)
    ? raw.replace(' ', 'T')
    : raw;

  return new Date(normalized).getTime();
}

export default function DiningTimer({ occupiedAt, isBillPending = false }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!occupiedAt) {
      setDisplay('');
      return;
    }

    const startMs = parseOccupiedTimeMs(occupiedAt);
    if (isNaN(startMs)) {
      setDisplay('');
      return;
    }

    const compute = () => {
      const offset = (typeof window !== 'undefined' ? window.mejwani_server_time_offset : 0) || 0;
      const elapsedSeconds = Math.floor((Date.now() + offset - startMs) / 1000);

      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
        setDisplay(formatMmSs(0));
        return;
      }

      // If occupied_at is from a stale/unreleased historical session (> 24 hrs), show 00:00
      if (elapsedSeconds > MAX_SANITY_SECONDS) {
        setDisplay(formatMmSs(0));
        return;
      }

      setDisplay(formatMmSs(elapsedSeconds));
    };

    compute();

    if (isBillPending) {
      return;
    }

    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [occupiedAt, isBillPending]);

  if (!display) return null;

  return (
    <span
      className={`font-mono font-black tabular-nums ${isBillPending ? 'opacity-60' : ''}`}
      title="Dining duration"
    >
      {display}
    </span>
  );
}