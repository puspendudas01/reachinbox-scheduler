/**
 * Formats an ISO date string into a user-friendly readable date and time.
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Returns a string formatted for datetime-local input (YYYY-MM-DDTHH:mm).
 */
export function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns default start time for scheduling, e.g. 5 minutes from now.
 */
export function getDefaultScheduleTime(minutesInFuture = 5): string {
  const d = new Date(Date.now() + minutesInFuture * 60 * 1000);
  return toDateTimeLocalString(d);
}

/**
 * Returns the current time formatted for `min` attribute on datetime-local input.
 */
export function getMinDateTimeLocal(): string {
  return toDateTimeLocalString(new Date());
}
