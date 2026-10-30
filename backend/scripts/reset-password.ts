/**
 * Emergency password reset, for when nobody can log in as the administrator.
 *
 *   cd backend
 *   npm run reset-password -- admin@example.com NewPassword1
 *
 * Switch the portal OFF first: while it is running it holds the database in memory and would overwrite this change.
 */
import fs from 'fs';
import initSqlJs from 'sql.js';
import { hashPassword } from '../src/config/auth';
import { dbPath } from '../src/config/database';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) { console.error('Usage: npm run reset-password -- <email> <new password>'); process.exit(1); }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    console.error('The new password must be at least 8 characters with letters and numbers.'); process.exit(1);
  }
  if (!fs.existsSync(dbPath)) { console.error(`No database found at ${dbPath}`); process.exit(1); }
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const found = db.exec('SELECT id, name, role FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (!found[0]) { console.error(`There is no account with the email ${email}`); process.exit(1); }
  const [id, name, role] = found[0].values[0];
  db.run("UPDATE users SET password = ?, must_change_password = 0, password_changed_at = datetime('now') WHERE id = ?", [hashPassword(password), id]);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log(`Password changed for ${name} (${role}). Start the portal again and log in.`);
}
main();
