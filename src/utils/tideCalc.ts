// M2 tidal constituent for False Bay (Simon's Town / Pringle Bay / Silversands area)
// M2 phase lag (kappa) for False Bay ≈ 301°, angular velocity = 28.9841°/hr
// First M2 high tide after J2000 (2000-01-01 12:00 UTC):
//   t = (360*m - V0 + kappa) / n = (360*1 - 357.26 + 301) / 28.9841 ≈ 10.48h after J2000
//   → 2000-01-01 22:29 UTC
// Accuracy: ±30-60 min (M2 only, ignores S2/K1/O1 minor constituents)

const M2_REF_HIGH_UTC = Date.UTC(2000, 0, 1, 22, 29, 0);
const M2_PERIOD_MS = 12.4206 * 3_600_000;

export interface TideEvent {
  type: 'high' | 'low';
  timeMs: number;
  hoursAway: number;
  timeStr: string;
}

export function getNextTideEvent(): TideEvent {
  const now = Date.now();
  const elapsed = now - M2_REF_HIGH_UTC;
  const halfPeriod = M2_PERIOD_MS / 2;
  const posInCycle = ((elapsed % M2_PERIOD_MS) + M2_PERIOD_MS) % M2_PERIOD_MS;

  let timeToNext: number;
  let type: 'high' | 'low';

  if (posInCycle < halfPeriod) {
    timeToNext = halfPeriod - posInCycle;
    type = 'low';
  } else {
    timeToNext = M2_PERIOD_MS - posInCycle;
    type = 'high';
  }

  const nextTimeMs = now + timeToNext;
  const hoursAway = timeToNext / 3_600_000;
  const timeStr = new Date(nextTimeMs).toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });

  return { type, timeMs: nextTimeMs, hoursAway, timeStr };
}

export function formatHoursAway(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
