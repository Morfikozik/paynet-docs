/**
 * Helpers that keep sample requests valid "out of the box".
 *
 * Two things made the old samples fail for merchants:
 *  - a fixed order number (Paynet rejects a second order with the same number);
 *  - a fixed ExpiryDate that is already in the past.
 * The portal now fills both with fresh values every time a sample is shown.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** End of tomorrow in local time, formatted as `YYYY-MM-DDTHH:mm:ss` (no time zone). */
export const getDefaultExpiryDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T23:59:59`;
};

/** Unique numeric order number for tests (milliseconds since epoch, fits int64). */
export const getUniqueOrderNumber = (): number => Date.now();

/**
 * Returns a copy of a request example with a fresh `Order` and `ExpiryDate`
 * (only if those keys exist at the top level).
 */
export const freshenRequestExample = <T,>(example: T): T => {
  if (!example || typeof example !== 'object' || Array.isArray(example)) return example;
  const copy: Record<string, unknown> = { ...(example as Record<string, unknown>) };
  if ('Order' in copy) copy.Order = getUniqueOrderNumber();
  if ('ExpiryDate' in copy) copy.ExpiryDate = getDefaultExpiryDate();
  return copy as T;
};
