import { blockedNights } from '../lib/store.js';
import { todayPacific } from '../lib/pricing.js';

export async function GET() {
  try {
    const today = todayPacific();
    const booked = [...(await blockedNights())].filter(n => n >= today).sort();
    return Response.json({ booked }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('availability', e);
    return Response.json({ error: 'Calendar is temporarily unavailable.' }, { status: 503 });
  }
}
