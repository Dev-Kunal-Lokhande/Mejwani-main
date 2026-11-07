import React, { useState, useEffect } from 'react';
import { formatMmSs } from '../../utils/diningTimer';

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
export default function DiningTimer({ occupiedAt, isBillPending = false }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!occupiedAt) {
      setDisplay('');
      return;
    }

    const startMs = new Date(occupiedAt).getTime();
    if (isNaN(startMs)) {
      setDisplay('');
      return;
    }

    const compute = () => {
      const offset = (typeof window !== 'undefined' ? window.mejwani_server_time_offset : 0) || 0;
      const totalSeconds = Math.max(0, Math.floor((Date.now() + offset - startMs) / 1000));
      setDisplay(formatMmSs(totalSeconds));
    };

    compute(); // Run immediately

    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [occupiedAt]);

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
