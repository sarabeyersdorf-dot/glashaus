// Stripe calls this when a checkout finishes or expires. Marks the stay paid (blocking the dates)
// or releases the hold, emails Sara, and sends the guest's welcome email (lib/guest-emails.js).
import crypto from 'node:crypto';
import { bookingBySession, updateBooking } from '../lib/store.js';
import { sendEmail, hostEmail, canEmailGuests } from '../lib/mail.js';
import { sendDueGuestEmails } from '../lib/send-guest-emails.js';
import { doorCode } from '../lib/guest-emails.js';
import { todayPacific } from '../lib/pricing.js';

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

// The stay is already marked paid when this runs, so an email failure must never fail the webhook:
// Stripe would retry, find the row paid, and skip. Missed guest emails are picked up by the daily run.
async function notify(b) {
  const d = s => new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const code = doorCode(b);
  try {
    await sendEmail({
      to: hostEmail(),
      subject: `New direct booking: ${b.guest_name}, ${b.check_in} to ${b.check_out}`,
      text: `${b.guest_name} booked Glashaus direct.\n\nCheck-in: ${d(b.check_in)}\nCheck-out: ${d(b.check_out)}\nNights: ${b.nights}\nGuests: ${b.guests}\nTotal paid: $${Number(b.total).toFixed(2)} (includes $${Number(b.tax).toFixed(2)} lodging tax to remit)\n\nPhone: ${b.guest_phone}\nEmail: ${b.guest_email}\nNote: ${b.guest_note || 'none'}\n\nDoor code: ${code ? `set the lock to ${code}# before arrival. The arrival-day email gives the guest this code.` : 'the phone number has fewer than 4 digits, so text the guest a door code yourself.'}\n\nThese dates now show as booked on glashausresort.com and in the calendar feed VRBO and Airbnb import.\n\n${canEmailGuests() ? 'The guest has been sent the welcome email. The local guide, arrival, checkout and thank-you emails follow on schedule.' : 'Guest emails are off until glashausresort.com is verified in Resend.'}`,
    });
  } catch (e) { console.error('host email', e); }
  try { await sendDueGuestEmails({ ...b, status: 'paid' }, todayPacific()); } catch (e) { console.error('guest emails', e); }
}
