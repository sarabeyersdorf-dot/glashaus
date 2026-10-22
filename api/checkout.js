// Creates a 30-minute hold and a Stripe Checkout session. The price is always recomputed here;
// the browser's number is only used to catch a stale page.
import { quote, validateStay, todayPacific, nightsBetween } from '../lib/pricing.js';
import { blockedNights, expireStaleHolds, insertHold, updateBooking } from '../lib/store.js';

const SITE = () => (process.env.SITE_URL || 'https://glashausresort.com').replace(/\/$/, '');
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return err('Something went wrong reading your booking.', 400); }

  const stay = { checkIn: body.checkIn, checkOut: body.checkOut, guests: Number(body.guests) };
  const guest = { name: clean(body.name, 120), email: clean(body.email, 200), phone: clean(body.phone, 40), note: clean(body.note, 1000) };
  const bad = validateStay(stay, todayPacific());
  if (bad) return err(bad, 400);
  if (!guest.name || !guest.phone || !/^\S+@\S+\.\S+$/.test(guest.email)) return err('Add your name, mobile number and a valid email.', 400);

  try {
    await expireStaleHolds();
    const blocked = await blockedNights();
    if (nightsBetween(stay.checkIn, stay.checkOut).some(n => blocked.has(n))) return err('Those dates are no longer available. Please pick new dates.', 409);

    const q = quote(stay.checkIn, stay.checkOut);
    if (body.expectedTotal && Math.abs(Number(body.expectedTotal) - q.total) > 0.01) {
      return err('Prices changed since this page loaded. Refresh the page to see the current total.', 409);
    }

    const expiresAt = new Date(Date.now() + 31 * 60 * 1000); // Stripe's minimum session life is 30 minutes
    let hold;
    try {
      hold = await insertHold({
        check_in: stay.checkIn, check_out: stay.checkOut, guests: stay.guests, status: 'pending', expires_at: expiresAt.toISOString(),
        guest_name: guest.name, guest_email: guest.email, guest_phone: guest.phone, guest_note: guest.note,
        nights: q.nights, lodging: q.lodging, cleaning: q.cleaning, tax: q.tax, total: q.total, source: 'direct',
      });
    } catch (e) {
      if (e.code === '23P01') return err('Those dates are no longer available. Please pick new dates.', 409);
      throw e;
    }

    const f = new URLSearchParams();
    const line = (i, name, cents, desc) => {
      f.append(`line_items[${i}][quantity]`, '1');
      f.append(`line_items[${i}][price_data][currency]`, 'usd');
      f.append(`line_items[${i}][price_data][unit_amount]`, String(cents));
      f.append(`line_items[${i}][price_data][product_data][name]`, name);
      if (desc) f.append(`line_items[${i}][price_data][product_data][description]`, desc);
    };
    const range = `${pretty(stay.checkIn)} to ${pretty(stay.checkOut)}`;
    line(0, `Glashaus, ${q.nights} night${q.nights > 1 ? 's' : ''}`, q.cents.lodging, `${range}, ${stay.guests} guest${stay.guests > 1 ? 's' : ''}`);
    let li = 1;
    if (q.cents.cleaning > 0) line(li++, 'Cleaning', q.cents.cleaning);
    line(li, 'Calaveras County lodging tax', q.cents.tax);
    f.append('mode', 'payment');
    f.append('customer_email', guest.email);
    f.append('expires_at', String(Math.floor(expiresAt.getTime() / 1000)));
    f.append('success_url', `${SITE()}/?booking=success&session={CHECKOUT_SESSION_ID}#top`);
    f.append('cancel_url', `${SITE()}/?booking=cancelled#book`);
    f.append('client_reference_id', hold.id);
    f.append('metadata[booking_id]', hold.id);
    f.append('metadata[check_in]', stay.checkIn);
    f.append('metadata[check_out]', stay.checkOut);
    f.append('payment_intent_data[description]', `Glashaus stay ${range}`);
    f.append('payment_intent_data[metadata][booking_id]', hold.id);
    f.append('payment_intent_data[receipt_email]', guest.email);
    if (process.env.TERMS_URL) f.append('consent_collection[terms_of_service]', 'required');

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: f,
    });
    const s = await r.json();
    if (!r.ok) { await updateBooking(hold.id, { status: 'expired' }); console.error('stripe', s); throw new Error('stripe'); }
    await updateBooking(hold.id, { stripe_session_id: s.id });
    return Response.json({ url: s.url });
  } catch (e) {
    console.error('checkout', e);
    return err('Checkout could not start.', 500);
  }
}

const err = (error, status) => Response.json({ error }, { status });
const pretty = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
