// Generates seed_render.sql from local database
const initSqlJs = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('school_portal.db');
  const db = new SQL.Database(buf);

  const tables = ['users','classes','subjects','timetables','fee_accounts','payments','results','attendance','settings'];
  let sql = '-- Seed data for school-portal\nBEGIN TRANSACTION;\n\n';

  for (const t of [...tables].reverse()) {
    if (t === 'users') {
      sql += "DELETE FROM users WHERE email NOT IN ('punhamasiwa@gmail.com');\n";
    } else {
      sql += 'DELETE FROM ' + t + ';\n';
    }
  }
  sql += '\n';

  for (const tbl of tables) {
    const rows = db.exec('SELECT * FROM ' + tbl);
    if (!rows[0]) continue;
    const cols = rows[0].columns;
    for (const vals of rows[0].values) {
      const escaped = vals.map(v => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return v;
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
      sql += 'INSERT INTO ' + tbl + ' (' + cols.join(',') + ') VALUES (' + escaped.join(',') + ');\n';
    }
    sql += '\n';
  }

  sql += 'COMMIT;\n';
  fs.writeFileSync('seed_render.sql', sql);
  const sizeKB = Math.round(sql.length / 1024);
  console.log('SQL file generated: seed_render.sql (' + sizeKB + ' KB, ' + sql.split('\n').length + ' lines)');
  db.close();
})();
