// One way to send email (Resend). Returns true only when Resend accepted the message.
export const mailFrom = () => process.env.EMAIL_FROM || 'Glashaus <stay@glashausresort.com>';
export const hostEmail = () => process.env.HOST_EMAIL || 'glashausresort@gmail.com';

// Resend's shared onboarding@resend.dev sender only reaches the Resend account's own address,
// so guest email waits until glashausresort.com is verified in Resend and EMAIL_FROM uses it.
export const canEmailGuests = () => !!process.env.RESEND_API_KEY && !/@resend\.dev>?\s*$/i.test(mailFrom());

export async function sendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: mailFrom(), to, subject, text, ...(html ? { html } : {}), reply_to: hostEmail() }),
  });
  if (!r.ok) console.error('resend', subject, r.status, await r.text());
  return r.ok;
}
