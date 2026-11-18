// Sends whichever of the five guest emails are due for a paid booking, each at most once.
// A row in glashaus_guest_emails is claimed BEFORE sending, so two runs can never both send;
// if Resend refuses, the claim is released and the next run tries again.
import { TEMPLATES, dueKinds, toText, toHtml, doorCode } from './guest-emails.js';
import { sendEmail, canEmailGuests, hostEmail } from './mail.js';
import { claimGuestEmail, releaseGuestEmail } from './store.js';
import { fromUTC, toUTC } from './pricing.js';

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

// Reminds Sara the morning before arrival to set the lock to the guest's code. The booking alert
// already named the code, so a stay booked within a day of check-in gets no second reminder.
export async function sendLockReminder(b, today) {
  if (b.status !== 'paid') return false;
  const dayBefore = fromUTC(toUTC(b.check_in) - 86400000);
  const booked = b.created_at ? fromUTC(Date.parse(b.created_at)) : dayBefore;
  if (today < dayBefore || today > b.check_in || booked >= dayBefore) return false;
  if (!(await claimGuestEmail(b.id, 'lock_reminder'))) return false;
  const code = doorCode(b);
  const when = today === b.check_in ? 'today' : 'tomorrow';
  const ok = await sendEmail({
    to: hostEmail(),
    subject: `Set the door code: ${b.guest_name} arrives ${when}`,
    text: `${b.guest_name} arrives ${when} (${b.check_in}), checking out ${b.check_out}. ${b.guests} guest${b.guests > 1 ? 's' : ''}.\n\n${code ? `Set the lock to ${code}# before 3 PM. Their arrival email tells them this code.` : 'Their phone number has fewer than 4 digits, so text them a door code yourself.'}\n\nPhone: ${b.guest_phone}\nEmail: ${b.guest_email}\nNote: ${b.guest_note || 'none'}`,
  });
  if (!ok) await releaseGuestEmail(b.id, 'lock_reminder');
  return ok;
}
