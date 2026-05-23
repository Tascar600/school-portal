// Run: node view_db.js
// Shows all database contents from the terminal
const initSqlJs = require('sql.js');
const fs = require('fs');

const DB_PATH = 'school_portal.db';
const TABLES = ['users','classes','subjects','timetables','fee_accounts','payments',
  'results','attendance','homework','courses','sport_participants','nominations','votes','settings'];

(async () => {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DB_PATH)) { console.log('Database not found:', DB_PATH); process.exit(1); }
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  db.run('PRAGMA foreign_keys = ON');

  const table = process.argv[2]; // optional: node view_db.js users

  if (table) {
    printTable(db, table);
  } else {
    console.log(`\n=== DATABASE OVERVIEW ===\n`);
    for (const t of TABLES) {
      const r = db.exec(`SELECT COUNT(*) FROM ${t}`)[0];
      const cnt = r ? r.values[0][0] : 0;
      const cols = db.exec(`PRAGMA table_info(${t})`)[0]?.values.map(v => v[1]).join(', ') || '';
      console.log(`  ${t.padEnd(20)} ${String(cnt).padStart(6)} rows  [${cols}]`);
    }
    console.log(`\nView a table: node view_db.js <table_name>`);
    console.log(`Example:      node view_db.js users\n`);
  }
  db.close();
})();

function printTable(db, table) {
  const info = db.exec(`PRAGMA table_info(${table})`)[0];
  if (!info) { console.log('Table not found:', table); return; }
  const colNames = info.values.map(v => v[1]);
  const rows = db.exec(`SELECT * FROM ${table} LIMIT 50`)[0];

  console.log(`\n=== ${table} (${rows ? rows.values.length : 0} rows shown) ===\n`);
  console.log('Columns:', colNames.join(', '));
  console.log('');

  if (!rows || rows.values.length === 0) { console.log('(empty)'); return; }

  const valsMatrix = rows.values;
  const widths = colNames.map((name, i) => {
    const vals = valsMatrix.map(r => String(r[i] || ''));
    return Math.max(name.length, ...vals.map(v => v.length));
  });

  const header = colNames.map((n, i) => n.padEnd(widths[i])).join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const vals of valsMatrix) {
    console.log(vals.map((v, i) => String(v ?? '').padEnd(widths[i])).join(' | '));
  }
  console.log('');
}
