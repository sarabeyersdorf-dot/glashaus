# Handoff to Claude Code: new glashausresort.com with direct booking

**From:** Sara (built with Claude in chat)
**Date:** Oct 21, 2026
**Package:** this folder, `Dropbox/Glashaus/Marketing/Website/glashausresort-site`

## What this is

A new site for glashausresort.com, the Glashaus short-term rental (not the for-sale listing page at legacycalifornia.com/glashaus, which stays as it is). Drone video leads every section, and guests can book and pay directly.

- `index.html` is the whole front end: no build step. Booking settings are in `window.GLASHAUS` near the bottom.
- `assets/video` holds the drone films and loops. `assets/fly/d` (desktop) and `assets/fly/m` (phone) are the 99-frame image sequence for the scroll-driven fly-in, drawn to a canvas. Keep the file names; the page loads them by number.
- `api/` holds four Vercel functions (Node 20, Web `Request`/`Response` handlers, no npm dependencies):
  - `GET /api/availability` returns booked nights from the Airbnb iCal plus direct bookings (paid, or held during checkout).
  - `POST /api/checkout` re-prices the stay on the server, places a 31-minute hold, and returns a Stripe Checkout URL.
  - `POST /api/stripe-webhook` marks the stay paid (or releases the hold) and optionally emails Sara and the guest via Resend.
  - `GET /calendar.ics?key=...` lists paid direct stays so Airbnb can import and block them.
- `lib/pricing.js` is the server's price source. `supabase/glashaus_bookings.sql` creates the bookings table, with an exclusion constraint that makes double-booking impossible at the database level.

## Two designs (Oct 21, 2026)

- `index.html` is V1 (dark lake-blue design).
- `v2.html` is V2 (summer-gold design with the fly-through-the-logo opener). It uses the same `assets/` folder and the same booking code and settings (`window.GLASHAUS`).
- Sara picks one before launch. To launch V2, rename `v2.html` to `index.html` (keep V1 as `v1.html` if she wants it kept).

## Tasks

1. **New Vercel project** from this folder (separate from the Legacy app). Add the domain glashausresort.com and www, and point DNS at Vercel. Find out where the domain is registered and what currently serves it before switching DNS; tell Sara what will change.
2. **Supabase:** run `supabase/glashaus_bookings.sql` (Legacy's project is fine; the table is prefixed). Keep RLS on; only the service-role key on the server touches it.
3. **Environment variables:** everything in `.env.example`. Start Stripe in test mode.
4. **Stripe webhook:** endpoint `https://glashausresort.com/api/stripe-webhook`, events `checkout.session.completed` and `checkout.session.expired`. In Stripe settings, turn on successful-payment receipts to customers.
5. **Airbnb calendar both ways:**
   - Export: Airbnb listing > Availability > Connect calendars > Export. Put that link in `AIRBNB_ICAL_URL`.
   - Import: in the same Airbnb screen, Import calendar, paste `https://glashausresort.com/calendar.ics?key=<ICAL_EXPORT_KEY>`. Airbnb refreshes imports every few hours, so there is a short window where the same night could sell on both. Sara accepts that risk or adds a channel manager later.
6. **Test booking in Stripe test mode** (card 4242 4242 4242 4242): the dates block on the site, the row shows `paid`, the .ics feed lists it, emails arrive if Resend is set. Then switch to live keys.
7. **Prices live in two places:** `window.GLASHAUS` in `index.html` and the `RATE_WEEKNIGHT` / `RATE_WEEKEND` variables. Keep them equal, or the checkout stops with "Prices changed since this page loaded".

## Prices and policies (nightly rates confirmed; the rest are placeholders)

- Nightly rates (confirmed by Sara on Oct 21): $475 Sunday to Thursday nights, $499 Friday and Saturday nights. These are the direct prices guests pay on the site. Airbnb guests pay about 20% more after Airbnb fees; the site shows that only as the amount saved.
- No cleaning fee (confirmed by Sara on Oct 21). `CLEANING_FEE=0`; the page hides the line and checkout skips it.
- Cancellation policy line: full refund 14+ days before check-in, 50 percent after. Refunds are issued by hand in Stripe.
- Lodging tax 12 percent (Calaveras County, unincorporated). If the property is inside Angels Camp city limits, the city rate applies instead. Sara registers with the county as an operator and remits tax on direct stays herself; Airbnb only remits for Airbnb stays.
- Drive times in "Getting here" are approximate.

## After deploy, please check

- Hero video plays on a phone (muted autoplay) and the geodesic tile reveal runs once.
- Scrolling the fly-in section scrubs the drone shot forward and back on desktop Chrome, Safari and an iPhone.
- The calendar shows real Airbnb nights as booked and the yellow "sample availability" note is gone.
- A test booking redirects back with the gold "Your stay is booked" banner.
- No sideways scrolling on a phone; the bottom "Check dates" bar appears after the hero and hides at the booking section.
