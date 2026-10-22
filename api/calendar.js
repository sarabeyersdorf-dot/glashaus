// Calendar feed of paid direct bookings. Paste https://glashausresort.com/calendar.ics?key=YOUR_KEY
// into Airbnb (Availability > Connect calendars > Import calendar) so direct stays block Airbnb too.
import { paidBookings } from '../lib/store.js';

export async function GET(request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!process.env.ICAL_EXPORT_KEY || key !== process.env.ICAL_EXPORT_KEY) return new Response('Not found', { status: 404 });
  const rows = await paidBookings();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ymd = s => s.replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Glashaus//Direct bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const b of rows) {
    lines.push('BEGIN:VEVENT', `UID:${b.id}@glashausresort.com`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(b.check_in)}`, `DTEND;VALUE=DATE:${ymd(b.check_out)}`, 'SUMMARY:Reserved (direct booking)', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}
