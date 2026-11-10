// Chișinău local time (Europe/Chisinau) without Intl time-zone data:
// UTC+3 from the last Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC, otherwise UTC+2.

const lastSundayUtc = (year, month) => {
  const d = new Date(Date.UTC(year, month + 1, 0, 1, 0, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
};

const pad = (n) => String(n).padStart(2, '0');

/** `YYYY-MM-DDTHH:mm:ss` in Chișinău time — the format of ExpiryDate. */
export function chisinauDateTime(date = new Date()) {
  const y = date.getUTCFullYear();
  const summer = date.getTime() >= lastSundayUtc(y, 2) && date.getTime() < lastSundayUtc(y, 9);
  const local = new Date(date.getTime() + (summer ? 3 : 2) * 3600 * 1000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
}

/** `YYYY-MM-DD` in Chișinău time — the format of statement dates. */
export function chisinauDate(date = new Date()) {
  return chisinauDateTime(date).slice(0, 10);
}

/** ExpiryDate `hours` from now, in Chișinău time. */
export function expiryInHours(hours = 24, now = new Date()) {
  return chisinauDateTime(new Date(now.getTime() + hours * 3600 * 1000));
}
