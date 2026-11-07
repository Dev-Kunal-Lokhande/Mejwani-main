/**
 * Dining Timer Utility — occupiedAt-based stopwatch helpers.
 *
 * Rules:
 *  - Timer source: table.occupied_at (set by backend on first KOT, never overwritten per session)
 *  - OCCUPIED  → timer runs live counting up from occupied_at
 *  - BILL_PENDING → timer frozen (same calculation, but snapshot at the moment status changed)
 *  - VACANT / CUSTOMER REQUEST / COMPLETED / CANCELLED → no timer (occupied_at is NULL)
 *  - Never uses createdAt, updatedAt, kotPrintedAt or any order timestamp
 */

/**
 * Format a raw second count as MM:SS stopwatch string with leading zeros.
 *
 * Examples:
 *   0   → "00:00"
 *   1   → "00:01"
 *   59  → "00:59"
 *   60  → "01:00"
 *   330 → "05:30"
 *   945 → "15:45"
 *
 * @param {number} totalSeconds - Non-negative integer
 * @returns {string} "MM:SS"
 */
export function formatMmSs(totalSeconds) {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Table statuses where the timer runs live */
export const OCCUPIED_STATUSES = ['occupied'];

/** Table status where the timer is frozen (still visible but not ticking) */
export const FROZEN_STATUS = 'bill_pending';
