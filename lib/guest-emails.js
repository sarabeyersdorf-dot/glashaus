// The five emails every direct guest receives, and when. Wording is Sara's (Nov 18, 2026), adapted for
// direct bookings: guests reach us by text, not the Airbnb app, and the door code comes from the phone
// number they booked with. Each email is sent at most once per booking (table glashaus_guest_emails).
import { toUTC, fromUTC } from './pricing.js';

const PHONE = '(209) 559-4966';
const SITE = () => (process.env.SITE_URL || 'https://glashausresort.com').replace(/\/$/, '');
const DAY = 86400000;
const addDays = (s, n) => fromUTC(toUTC(s) + n * DAY);
const longDate = s => new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const firstName = b => (b.guest_name || '').trim().split(/\s+/)[0] || 'there';

// Last 4 digits of the phone the guest booked with, as the lock code (the same rule Airbnb guests get).
export const doorCode = b => { const d = String(b.guest_phone || '').replace(/\D/g, ''); return d.length >= 4 ? d.slice(-4) : null; };

// When each email is due, by today's date in California. `send` is the first day it may go;
// `until` is the last (a late booking still gets what is useful, never a stale "good morning").
export const SCHEDULE = [
  { kind: 'welcome',     send: b => b.created_at ? fromUTC(Date.parse(b.created_at)) : b.check_in, until: b => addDays(b.check_out, -1) },
  { kind: 'local_guide', send: b => addDays(b.check_in, -1), until: b => addDays(b.check_out, -1) },
  { kind: 'arrival',     send: b => b.check_in,              until: b => addDays(b.check_out, -1) },
  { kind: 'checkout',    send: b => b.check_out,             until: b => b.check_out },
  { kind: 'thank_you',   send: b => addDays(b.check_out, 2), until: b => addDays(b.check_out, 9) },
];
export const dueKinds = (b, today) => SCHEDULE.filter(s => today >= s.send(b) && today <= s.until(b)).map(s => s.kind);

const SIGN = `Sara and James\nGlashaus · ${PHONE}`;

// Body text uses a tiny format: a line starting "# " is a heading, "- " or "1. " a list item,
// a blank line separates paragraphs. toHtml/toText turn it into the email.
export const TEMPLATES = {
  welcome: b => ({
    subject: 'Your Glashaus stay is booked',
    body: `Hello ${firstName(b)},

Thank you for booking your stay with Glashaus. We are looking forward to hosting you!

# Your stay
- Check-in: ${longDate(b.check_in)}, 3:00 PM or later
- Check-out: ${longDate(b.check_out)}, by 11:00 AM
- Guests: ${b.guests}
- Total paid: $${Number(b.total).toFixed(2)}

Please take time to review the house manual and the pictures (${SITE()}) so you know what to expect.

Please make special note that, as described in the listing, there is NO access to the lake from this location.

This is a dome made of glass. While we do have an air conditioning unit, the temperature in the dome is affected by both the outside temperature and the sun. Use of the blinds will help greatly during your stay.

The indoor fireplace is available for your use. Please make sure to read the arrival guide for more information.

We also hope this to be an eco-conscious experience, so please use the air conditioner accordingly.

The day of your arrival you will receive a detailed message that will include directions to the dome, and other information to help you enjoy your stay.

Please don't hesitate to reach out with any questions. Text us at ${PHONE}.

We look forward to hosting your adventure.

${SIGN}`,
  }),

  local_guide: b => ({
    subject: 'Food and wine near Glashaus',
    body: `Hello ${firstName(b)},

You may be visiting the area for the first time, or you may already know Murphys and Angels Camp well and have your favorite spots. Either way, we hope these food and wine suggestions help make your stay even better. Hours can change throughout the year, so it is always a good idea to check before you go.

# Restaurants in Murphys
- Murphys Grade CBD 'n Oyster Joint: seafood, oysters, gourmet sandwiches, craft beer, and grab-and-go options.
- V's Bistro: American bistro for breakfast and lunch.
- V's Restaurant: fine dining for dinner. Reservations are recommended.
- Doke Sushi: sushi. Reservations are recommended.
- Branding Iron: steakhouse.
- House of Pita: Mediterranean food.

# Restaurants in Angels Camp
- Crusco's: Italian food.
- Angels Mexican Kitchen: Mexican food.
- Miner's Lounge: lounge and Asian fusion food. Guests must be 21 or older.

# Wineries and tasting rooms
There are more than 30 in the area. These are a few of our favorites.
- Prospect 772: vineyard and tasting room, near the entrance to our neighborhood.
- Lavender Ridge: tasting room in Murphys.
- Gossamer Cellars: tasting room in Murphys.
- Newsome Harlow: tasting room in Murphys.
- Vina Moda: they make wine next door to the dome, and their tasting room is in Murphys.

See you tomorrow!

${SIGN}`,
  }),

  arrival: b => {
    const code = doorCode(b);
    return {
      subject: 'Arriving at Glashaus today: directions and door code',
      body: `Hello ${firstName(b)},

We're looking forward to hosting you today. Please read this message before heading to the property.

# Directions
Please do not rely on GPS only. Please follow the directions below. If you arrive at a black gate, you are not at the correct address.

From Highway 4 take Appaloosa to Filly (go left) to Shetland (left) to Dunn (left). We are the first driveway on the RIGHT.

IMPORTANT: Do NOT take Dunn from Appaloosa. The road is rutted out.

# Check-in
Check-in is 3:00 PM or later. Arrival after dark can be difficult, so please arrive before sunset if possible.

Please text us at ${PHONE} with:
1. Your expected arrival time
2. When you arrive
3. When you check out

# Door code
The dome has an electronic lock. Press any key to wake it up.
${code ? `Your code is ${code}# (the last 4 digits of the phone number you booked with, followed by #).` : `We'll text you your door code before you arrive.`}
The door automatically locks after 60 seconds.

# Fire and fireplaces
- Outdoor open fires are NOT ALLOWED. You may use the propane fire table. Instructions are on the table, and propane is provided.
- Indoor fireplace: there is a pilot light that remains on all of the time. The warming flame is controlled by remote control. The fire is NOT variable: it is either on or off. DO NOT remove the safety screen. DO NOT turn any valves. Make sure the window closest to the fireplace is OPEN when in use. (This is a ventless propane burner and creates a lot of water vapor.)

# Important property notes
- The dome does get very warm during the day and was designed for nighttime stargazing and sleeping under the stars. It is not going to be a freezing air-conditioned hotel, so please plan outside activities during your stay so you can enjoy Glashaus as it was meant to be. There are blackout curtains, fans and a large capacity mini-split that is PG&E powered.
- The deck and kitchen are a new addition and a work in progress. Please be careful on the stairs. We welcome your feedback.
- All sinks drain into the yard, so please do not put food waste down any sink.
- Wind can come up suddenly. Please secure the sun shade umbrella when not in use and before leaving the property.
- As noted in the listing, there is no lake access from this location.

# If you leave before checkout instructions arrive
1. Put all garbage in the large gray bins and secure the lids.
2. Arrange the dome curtains as they were when you arrived.

Please text us at ${PHONE} any time with questions, concerns, or comments. Have a great stay!

${SIGN}`,
    };
  },

  checkout: b => ({
    subject: 'Checkout today at 11:00 AM',
    body: `Good morning ${firstName(b)},

Check-out time is 11:00 AM.

We hope you enjoyed your stay at Glashaus and made some great memories. Please be fully packed up and off the property by 11:00 AM so we have enough time to clean and prepare for the next guest.

Before you leave, please:
1. Arrange the curtains as they were when you arrived, including closing the top automated curtain.
2. Put all garbage and leftover food into one of the larger grey garbage cans (one on the way out and one by the hammocks). Please make sure they are secure to prevent animals from getting in.
3. Text us at ${PHONE} when you are leaving the property.

Thank you again for staying with us. Please drive safely, and we hope you come back and visit again!

${SIGN}`,
  }),

  thank_you: b => ({
    subject: 'Thank you for staying at Glashaus',
    body: `Hi ${firstName(b)},

We hope you had a great stay. We have worked very hard to make this a unique and memorable experience.

There are many things we still have in the works, and we welcome your feedback and suggestions for what might have made your stay just that much more special. Just reply to this email.

Thanks again and safe travels!

${SIGN}`,
  }),
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = s => esc(s).replace(/https?:\/\/[^\s)]+/g, u => `<a href="${u}" style="color:#7a5b2e">${u}</a>`);

export function toText(body) {
  return body.split('\n').map(l => l.startsWith('# ') ? l.slice(2).toUpperCase() : l.replace(/^- /, '• ')).join('\n');
}

export function toHtml(body) {
  const out = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split('\n');
    let i = 0;
    if (lines[0].startsWith('# ')) { out.push(`<h2 style="font:600 13px/1.3 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#7a5b2e;margin:28px 0 8px">${esc(lines[0].slice(2))}</h2>`); i = 1; }
    const rest = lines.slice(i);
    if (!rest.length) continue;
    const bullets = rest.every(l => l.startsWith('- ')), numbered = rest.every(l => /^\d+\. /.test(l));
    if (bullets || numbered) {
      const tag = bullets ? 'ul' : 'ol';
      out.push(`<${tag} style="margin:0 0 16px;padding-left:20px">${rest.map(l => `<li style="margin:0 0 6px">${link(l.replace(/^(- |\d+\. )/, ''))}</li>`).join('')}</${tag}>`);
    } else {
      out.push(`<p style="margin:0 0 16px">${rest.map(link).join('<br>')}</p>`);
    }
  }
  return `<!doctype html><html><body style="margin:0;background:#f4efe6">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;font:16px/1.6 Georgia,'Times New Roman',serif;color:#2b2620">
<div style="font:600 22px/1 Georgia,serif;letter-spacing:.32em;color:#2b2620;margin:0 0 28px">GLASHAUS</div>
${out.join('\n')}
<div style="border-top:1px solid #d9cfbf;margin-top:28px;padding-top:14px;font-size:13px;color:#7b7064">Glashaus · Murphys, California · <a href="${SITE()}" style="color:#7a5b2e">glashausresort.com</a></div>
</div></body></html>`;
}
