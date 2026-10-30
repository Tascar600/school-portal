// Sending fee reminders as text messages.
//
// The portal has no SMS account of its own. To send automatically, point it at any SMS service (or a small relay in
// front of one) that accepts a web request, by setting these before starting the backend:
//
//   SMS_WEBHOOK_URL    the address to send to, e.g. https://sms.example.com/send
//   SMS_WEBHOOK_TOKEN  optional; sent as "Authorization: Bearer <token>"
//   SMS_SENDER_ID      optional; the name or number the message should come from
//
// For every message the portal makes one POST with JSON  { "to": "+263771234567", "message": "...", "from": "..." }
// and counts any 2xx answer as "sent". With no SMS_WEBHOOK_URL the automatic option is simply switched off, and the
// Bursar can still send from a phone ("SMS from this device") or by WhatsApp.
export const smsConfigured = () => !!process.env.SMS_WEBHOOK_URL;
export const smsSender = () => process.env.SMS_SENDER_ID || null;

// A Zimbabwean number in international form: 0771234567, 263771234567, 00263771234567 and +263 77 123 4567 all become +263771234567
export function normalisePhone(raw: string): string | null {
  const text = String(raw || '').trim();
  const plus = text.startsWith('+');
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (!plus && digits.startsWith('0')) digits = '263' + digits.slice(1);
  else if (!plus && digits.length === 9) digits = '263' + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return '+' + digits;
}

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SMS_WEBHOOK_URL;
  if (!url) return { ok: false, error: 'Automatic SMS is not set up on this portal' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.SMS_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${process.env.SMS_WEBHOOK_TOKEN}`;
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ to, message, ...(smsSender() ? { from: smsSender() } : {}) }), signal: controller.signal });
    if (r.ok) return { ok: true };
    return { ok: false, error: `The SMS service answered ${r.status}: ${(await r.text().catch(() => '')).slice(0, 120)}` };
  } catch (err: any) {
    return { ok: false, error: err.name === 'AbortError' ? 'The SMS service did not answer within 10 seconds' : `The SMS service could not be reached: ${err.message}` };
  } finally { clearTimeout(timer); }
}
