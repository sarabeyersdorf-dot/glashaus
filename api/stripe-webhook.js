// Stripe calls this when a checkout finishes or expires. Marks the stay paid (blocking the dates)
// or releases the hold, and emails Sara and the guest when RESEND_API_KEY is set.
import crypto from 'node:crypto';
import { bookingBySession, updateBooking } from '../lib/store.js';

export async function POST(request) {
  const raw = await request.text();
  if (!verify(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
    return new Response('bad signature', { status: 400 });
  }
  const event = JSON.parse(raw);
  const s = event.data?.object;
  try {
    if (event.type === 'checkout.session.completed' && s.payment_status === 'paid') {
      const b = await bookingBySession(s.id);
      if (b && b.status !== 'paid') {
        await updateBooking(b.id, { status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent: s.payment_intent, expires_at: null });
        await notify(b);
      }
    } else if (event.type === 'checkout.session.expired') {
      const b = await bookingBySession(s.id);
      if (b && b.status === 'pending') await updateBooking(b.id, { status: 'expired' });
    }
    return new Response('ok');
  } catch (e) {
    console.error('webhook', e);
    return new Response('error', { status: 500 }); // Stripe retries
  }
}

function verify(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  return sigs.some(sig => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

async function notify(b) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.EMAIL_FROM || 'Glashaus <stay@glashausresort.com>';
  const host = process.env.HOST_EMAIL || 'glashausresort@gmail.com';
  const d = s => new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const send = (to, subject, text) => fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text, reply_to: host }),
  });
  await Promise.allSettled([
    send(host, `New direct booking: ${b.guest_name}, ${b.check_in} to ${b.check_out}`,
      `${b.guest_name} booked Glashaus direct.\n\nCheck-in: ${d(b.check_in)}\nCheck-out: ${d(b.check_out)}\nNights: ${b.nights}\nGuests: ${b.guests}\nTotal paid: $${Number(b.total).toFixed(2)} (includes $${Number(b.tax).toFixed(2)} lodging tax to remit)\n\nPhone: ${b.guest_phone}\nEmail: ${b.guest_email}\nNote: ${b.guest_note || 'none'}\n\nThese dates now show as booked on glashausresort.com and in the calendar feed Airbnb imports.`),
    send(b.guest_email, 'Your Glashaus stay is booked',
      `Hi ${b.guest_name.split(' ')[0]},\n\nYou're all set for Glashaus, ${d(b.check_in)} to ${d(b.check_out)}.\n\nCheck-in is from 3 pm and check-out is by 11 am. We'll text you the address, gate details and your door code a few days before you arrive.\n\nIf you need anything before then, text us at (209) 559-4966.\n\nSee you on the ridge,\nSara and James`),
  ]);
}
