// Util refresh mingguan beranchor Senin 00:00 WIB (Asia/Jakarta).
// weekId = tanggal Senin (YYYY-MM-DD) dari pekan berjalan dalam kalender WIB.
// WIB = UTC+7 tetap sepanjang tahun (tanpa DST) sehingga konversi manual aman.

export const WEEK_KEY = 'mutabaah_last_refresh_week_v1';
export const SNOOZE_KEY = 'mutabaah_refresh_snooze_until_v1';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

interface JakartaParts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
}

function getJakartaParts(date: Date): JakartaParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value || '0';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hh: Number(get('hour')) % 24,
    mm: Number(get('minute')),
  };
}

/** weekId Senin-anchored, mis. "2026-10-05" untuk pekan Senin 5 Okt 2026. */
export function getJakartaWeekId(date: Date = new Date()): string {
  const { y, m, d } = getJakartaParts(date);
  const jakartaDayMs = Date.UTC(y, m - 1, d);
  const dow = new Date(jakartaDayMs).getUTCDay(); // 0=Min .. 6=Sab
  const mondayOffset = (dow + 6) % 7; // Sen->0 ... Min->6
  const mondayMs = jakartaDayMs - mondayOffset * 86400000;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

/** ms hingga Senin 00:00:05 WIB berikutnya. Max 7 hari. */
export function getMsUntilNextMondayMidnightWIB(now: Date = new Date()): number {
  const { y, m, d } = getJakartaParts(now);
  const jakartaDayMs = Date.UTC(y, m - 1, d);
  const dow = new Date(jakartaDayMs).getUTCDay();
  const daysUntilMonday = (8 - dow) % 7 === 0 ? 7 : (8 - dow) % 7;
  // Senin 00:00:05 WIB = (midnight UTC hari Senin) - 7 jam + 5 detik
  const nextMondayUtcMs = jakartaDayMs + daysUntilMonday * 86400000 - WIB_OFFSET_MS + 5000;
  const diff = nextMondayUtcMs - now.getTime();
  if (diff <= 0) return diff + 7 * 86400000;
  return Math.min(diff, 7 * 86400000);
}

export function getStoredWeekId(): string | null {
  try {
    return localStorage.getItem(WEEK_KEY);
  } catch {
    return null;
  }
}

export function markWeekRefreshed(weekId: string): void {
  try {
    localStorage.setItem(WEEK_KEY, weekId);
  } catch {
    // abaikan (mode private) — tanpa penanda, cek berikutnya akan mencoba lagi
  }
}

export function getSnoozeUntil(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0);
  } catch {
    return 0;
  }
}

export function snoozeWeeklyRefresh(ms: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
  } catch {
    // abaikan
  }
}

export function isSnoozed(now: number = Date.now()): boolean {
  return now < getSnoozeUntil();
}
