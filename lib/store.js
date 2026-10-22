// Bookings live in Supabase (table: glashaus_bookings). Uses the REST API with the service-role key,
// so it runs only on the server. Airbnb nights come from the listing's iCal export.
import { nightsBetween, fromUTC, toUTC } from './pricing.js';

const SB_URL = () => process.env.SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, init = {}) {
  const r = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY(), authorization: `Bearer ${SB_KEY()}`, 'content-type': 'application/json',
      prefer: 'return=representation', ...(init.headers || {}),
    },
  });
  const text = await r.text();
  const body = text ? JSON.parse(text) : null;
  if (!r.ok) { const e = new Error(body?.message || `Supabase ${r.status}`); e.code = body?.code; e.status = r.status; throw e; }
  return body;
}

export async function expireStaleHolds() {
  await sb(`glashaus_bookings?status=eq.pending&expires_at=lt.${new Date().toISOString()}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'expired' }),
  });
}

export async function directBookings() {
  const now = new Date().toISOString();
  return sb(`glashaus_bookings?select=id,check_in,check_out,status,guest_name,created_at&or=(status.eq.paid,and(status.eq.pending,expires_at.gt.${now}))&check_out=gte.${fromUTC(Date.now() - 86400000)}`);
}

export async function insertHold(row) {
  // The table's exclusion constraint rejects overlapping paid/pending stays (error 23P01).
  const [b] = await sb('glashaus_bookings', { method: 'POST', body: JSON.stringify(row) });
  return b;
}
export const updateBooking = (id, patch) =>
  sb(`glashaus_bookings?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const bookingBySession = sid =>
  sb(`glashaus_bookings?stripe_session_id=eq.${encodeURIComponent(sid)}&select=*`).then(r => r[0] || null);
export const paidBookings = () => sb('glashaus_bookings?status=eq.paid&select=id,check_in,check_out,created_at&order=check_in');

// ---- Airbnb iCal ----
let cache = { at: 0, nights: [] };
export async function airbnbNights() {
  const url = process.env.AIRBNB_ICAL_URL;
  if (!url) return [];
  if (Date.now() - cache.at < 5 * 60 * 1000) return cache.nights;
  const r = await fetch(url, { headers: { 'user-agent': 'GlashausDirect/1.0' } });
  if (!r.ok) throw new Error('Airbnb calendar unavailable');
  const ics = (await r.text()).replace(/\r?\n[ \t]/g, ''); // unfold lines
  const nights = new Set();
  for (const ev of ics.split('BEGIN:VEVENT').slice(1)) {
    const s = ev.match(/DTSTART[^:]*:(\d{8})/), e = ev.match(/DTEND[^:]*:(\d{8})/);
    if (!s) continue;
    const a = s[1].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const b = e ? e[1].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : fromUTC(toUTC(a) + 86400000);
    for (const n of nightsBetween(a, b)) nights.add(n);
  }
  cache = { at: Date.now(), nights: [...nights] };
  return cache.nights;
}

// Every night that can't be sold: Airbnb + direct (paid or held in checkout)
export async function blockedNights() {
  const [air, direct] = await Promise.all([airbnbNights(), directBookings()]);
  const set = new Set(air);
  for (const b of direct) for (const n of nightsBetween(b.check_in, b.check_out)) set.add(n);
  return set;
}
