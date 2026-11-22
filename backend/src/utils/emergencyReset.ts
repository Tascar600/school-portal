import { queryOne, execute } from '../config/database';
import { hashPassword } from '../config/auth';
import { getSetting, setSetting } from './settings';

// Getting back in when nobody can log in as the Administrator, on a host where the portal cannot be switched off
// (the `npm run reset-password` tool needs it switched off).
//
// Set RESET_STARTING_ACCOUNTS to any word you have not used before (for example reset1) in the host's settings and restart.
// On that start the Administrator and the Bursar are put back to the starting passwords (1234 and 12345678, the ones in the
// README), must choose a new password at their first log in, and every log in made before is shut out. All the school's data is
// kept. Other accounts are not touched: give them temporary passwords from Admin Panel > Passwords.
//
// It works once for each different word, so leaving the setting in place does not keep resetting passwords. Only someone who can
// change the host's settings can use it, which is the same person who owns the portal.

export const STARTING_ACCOUNTS = {
  admin: { email: 'punhamasiwa@gmail.com', password: '1234' },
  bursary: { email: 'tascarmasiwa@gmail.com', password: '12345678' },
};

const mustChange = () => (process.env.FIRST_LOGIN_PASSWORD_CHANGE === 'off' ? 0 : 1); // same rule as a brand-new portal

export interface ResetResult { reset: { role: string; email: string }[] }

/** Returns null when nothing was asked for (or it was already done for this word). */
export async function applyEmergencyReset(env: NodeJS.ProcessEnv = process.env): Promise<ResetResult | null> {
  const word = (env.RESET_STARTING_ACCOUNTS || '').trim();
  if (!word) return null;
  if ((await getSetting('emergency_reset_word')) === word) return null; // already done for this word

  // The Administrator: the starting account, or, if that email no longer exists, the first administrator there is
  const admin = (await queryOne<any>("SELECT id, email FROM users WHERE role = 'admin' AND LOWER(email) = LOWER(?)", [STARTING_ACCOUNTS.admin.email]))
    || (await queryOne<any>("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"));
  const bursar = await queryOne<any>("SELECT id, email FROM users WHERE role = 'bursary' AND LOWER(email) = LOWER(?)", [STARTING_ACCOUNTS.bursary.email]);

  const reset: ResetResult['reset'] = [];
  for (const [role, account, password] of [['Administrator', admin, STARTING_ACCOUNTS.admin.password], ['Bursar', bursar, STARTING_ACCOUNTS.bursary.password]] as const) {
    if (!account) continue;
    // is_active / archived: a closed account is opened again, so the person is not locked out for that reason
    await execute(
      "UPDATE users SET password = ?, must_change_password = ?, password_changed_at = datetime('now'), is_active = 1, archived = 0 WHERE id = ?",
      [hashPassword(password), mustChange(), account.id]);
    reset.push({ role, email: account.email });
  }
  await setSetting('emergency_reset_word', word);
  await setSetting('emergency_reset_at', new Date().toISOString());
  return { reset };
}
