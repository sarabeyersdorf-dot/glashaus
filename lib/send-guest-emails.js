// Sends whichever of the five guest emails are due for a paid booking, each at most once.
// A row in glashaus_guest_emails is claimed BEFORE sending, so two runs can never both send;
// if Resend refuses, the claim is released and the next run tries again.
import { TEMPLATES, dueKinds, toText, toHtml } from './guest-emails.js';
import { sendEmail, canEmailGuests } from './mail.js';
import { claimGuestEmail, releaseGuestEmail } from './store.js';

export async function sendDueGuestEmails(b, today) {
  if (b.status !== 'paid' || !canEmailGuests()) return [];
  const sent = [];
  for (const kind of dueKinds(b, today)) {
    if (!(await claimGuestEmail(b.id, kind))) continue; // already sent
    const { subject, body } = TEMPLATES[kind](b);
    const ok = await sendEmail({ to: b.guest_email, subject, text: toText(body), html: toHtml(body) });
    if (ok) sent.push(kind); else await releaseGuestEmail(b.id, kind);
  }
  return sent;
}
