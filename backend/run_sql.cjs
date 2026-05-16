const init = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.log('Usage: node run_sql.cjs "YOUR SQL"');
    console.log('');
    console.log('Examples:');
    console.log('  node run_sql.cjs "SELECT * FROM users"');
    console.log('  node run_sql.cjs "DELETE FROM users WHERE id = 12"');
    console.log('  node run_sql.cjs "UPDATE users SET name = \'New Name\' WHERE id = 3"');
    console.log('  node run_sql.cjs "INSERT INTO classes (name,grade,section) VALUES (\'Grade 11\',\'11\',\'B\')"');
    console.log('  node run_sql.cjs "DROP TABLE payments"');
    process.exit(0);
  }

  const dbPath = path.join(__dirname, 'school_portal.db');
  const buffer = fs.readFileSync(dbPath);
  const SQL = await init();
  const db = new SQL.Database(buffer);
  db.run('PRAGMA foreign_keys = ON');

  try {
    const isSelect = query.trim().toUpperCase().startsWith('SELECT');
    if (isSelect) {
      const result = db.exec(query);
      if (result.length > 0 && result[0].values.length > 0) {
        console.table(result[0].values.map((v) => {
          const obj = {};
          result[0].columns.forEach((col, j) => { obj[col] = v[j]; });
          return obj;
        }));
      } else {
        console.log('(no rows)');
      }
    } else {
      db.run(query);
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
      console.log('Done. Database saved.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
