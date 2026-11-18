// Daily run (Vercel cron, see vercel.json): sends each paid guest whatever email is due today,
// e.g. the local guide the day before arrival, directions on arrival day, checkout morning, thank-you.
// Safe to call any number of times: each email is sent at most once per booking.
import { paidBookingsForEmails } from '../lib/store.js';
import { sendDueGuestEmails } from '../lib/send-guest-emails.js';
import { todayPacific, fromUTC, toUTC } from '../lib/pricing.js';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Not found', { status: 404 });
  const today = todayPacific();
  const bookings = await paidBookingsForEmails(fromUTC(toUTC(today) - 9 * 86400000));
  const results = [];
  for (const b of bookings) {
    try {
      const sent = await sendDueGuestEmails(b, today);
      if (sent.length) results.push({ booking: b.id, sent });
    } catch (e) { console.error('guest-emails', b.id, e); }
  }
  return Response.json({ today, checked: bookings.length, results }, { headers: { 'cache-control': 'no-store' } });
}
