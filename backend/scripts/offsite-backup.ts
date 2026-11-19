/**
 * Looks at the latest off-site backup WITHOUT changing anything: downloads it from GitHub, decrypts it, checks that the
 * database inside is healthy, and says what it holds. The safe way to find out that the settings, the passphrase and the
 * backup itself all work (README, "Off-site backup to GitHub", step "Test a restore").
 *
 *   cd backend
 *   BACKUP_GITHUB_TOKEN=... BACKUP_GITHUB_REPO=owner/name BACKUP_PASSPHRASE=... npm run backup:check
 *
 * It never writes a file and never touches the school's own database.
 */
import initSqlJs from 'sql.js';
import { checkDatabaseFile } from '../src/config/database';
import { BackupError, GitHubStore, offsiteConfig, offsiteSetupWarnings, open, unpack } from '../src/utils/offsiteBackup';

async function main(): Promise<number> {
  for (const w of offsiteSetupWarnings()) console.error(`!! ${w}`);
  const cfg = offsiteConfig();
  if (!cfg) { console.error('Off-site backup is not set up here. Set BACKUP_GITHUB_TOKEN, BACKUP_GITHUB_REPO and BACKUP_PASSPHRASE first.'); return 1; }

  const sealed = await new GitHubStore(cfg).download();
  if (!sealed) { console.log(`No backup has been uploaded yet to ${cfg.repo} (branch ${cfg.branch}, file ${cfg.file}). That is normal before the first upload.`); return 0; }
  console.log(`Downloaded ${(sealed.length / 1024).toFixed(0)} KB from ${cfg.repo} (branch ${cfg.branch}).`);

  const { db } = await unpack(await open(sealed, cfg.passphrase));
  console.log('Decrypted: the passphrase is right.');
  const problem = await checkDatabaseFile(db);
  if (problem) { console.error(`But the database inside is not usable: ${problem}`); return 1; }

  const SQL = await initSqlJs();
  const probe = new SQL.Database(db);
  try {
    const roles = probe.exec('SELECT role, COUNT(*) FROM users GROUP BY role')[0]?.values || [];
    const one = (sql: string) => Number(probe.exec(sql)[0]?.values[0][0] || 0);
    console.log(`The database inside is healthy (${(db.length / 1024).toFixed(0)} KB). It holds: ${roles.map(([r, n]) => `${n} ${r}`).join(', ') || 'no accounts'}; ${one('SELECT COUNT(*) FROM fee_payments')} payments; ${one('SELECT COUNT(*) FROM results')} results.`);
  } finally { probe.close(); }
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err instanceof BackupError ? `${err.message}` : err);
  process.exit(1);
});
