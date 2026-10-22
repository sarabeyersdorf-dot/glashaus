// Single source of truth for prices on the server. Keep in step with window.GLASHAUS in index.html.
// Dates are plain "YYYY-MM-DD" strings; the "night of" a date is the night that starts on it.

export const PRICING = {
  directNightly: { weeknight: num('RATE_WEEKNIGHT', 475), weekend: num('RATE_WEEKEND', 499) },
  airbnbFeeMarkup: num('AIRBNB_FEE_MARKUP', 0.20), // only used to show what the same stay costs on Airbnb
  cleaningFee: num('CLEANING_FEE', 0), // Glashaus charges no cleaning fee
  lodgingTaxRate: num('LODGING_TAX_RATE', 0.12),
  minNights: num('MIN_NIGHTS', 1),
  maxNightsAhead: 365,
  maxNightsPerStay: 28, // stays of 30+ nights change the tax rules; keep direct stays shorter
  maxGuests: 2,
};

function num(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : Number(v);
}

const DAY = 86400000;
export const isISODate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
export const toUTC = s => Date.parse(s + 'T00:00:00Z');
export const fromUTC = t => new Date(t).toISOString().slice(0, 10);

export function nightsBetween(checkIn, checkOut) {
  const out = [];
  for (let t = toUTC(checkIn); t < toUTC(checkOut); t += DAY) out.push(fromUTC(t));
  return out;
}

export function nightRate(dateStr) {
  const dow = new Date(toUTC(dateStr)).getUTCDay();
  const direct = dow === 5 || dow === 6 ? PRICING.directNightly.weekend : PRICING.directNightly.weeknight;
  return { direct, air: Math.round(direct * (1 + PRICING.airbnbFeeMarkup)) };
}

// Returns amounts in dollars (2 decimals) and cents for Stripe.
export function quote(checkIn, checkOut) {
  const nights = nightsBetween(checkIn, checkOut);
  let lodging = 0, air = 0;
  for (const n of nights) { const r = nightRate(n); lodging += r.direct; air += r.air; }
  const taxable = lodging + PRICING.cleaningFee;
  const tax = Math.round(taxable * PRICING.lodgingTaxRate * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;
  return {
    nights: nights.length, nightList: nights, lodging, cleaning: PRICING.cleaningFee, tax, total,
    savingVsAirbnb: air - lodging,
    cents: { lodging: lodging * 100, cleaning: PRICING.cleaningFee * 100, tax: Math.round(tax * 100), total: Math.round(total * 100) },
  };
}

// Checks the stay request itself (not availability). Returns an error message or null.
export function validateStay({ checkIn, checkOut, guests }, todayStr) {
  if (!isISODate(checkIn) || !isISODate(checkOut)) return 'Choose a check-in and check-out day.';
  const n = (toUTC(checkOut) - toUTC(checkIn)) / DAY;
  if (toUTC(checkIn) < toUTC(todayStr)) return 'Check-in can’t be in the past.';
  if (n < PRICING.minNights) return `The minimum stay is ${PRICING.minNights} night${PRICING.minNights > 1 ? 's' : ''}.`;
  if (n > PRICING.maxNightsPerStay) return `For stays longer than ${PRICING.maxNightsPerStay} nights, text us at (209) 559-4966.`;
  if ((toUTC(checkIn) - toUTC(todayStr)) / DAY > PRICING.maxNightsAhead) return 'Those dates aren’t open for booking yet.';
  if (!Number.isInteger(guests) || guests < 1 || guests > PRICING.maxGuests) return `Glashaus sleeps up to ${PRICING.maxGuests} guests.`;
  return null;
}

// Today in California, as YYYY-MM-DD
export const todayPacific = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
