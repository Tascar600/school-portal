const init = require('sql.js');
const fs = require('fs');
const path = require('path');

init().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname, 'school_portal.db')));
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  
  for (const t of tables[0].values) {
    const name = t[0];
    const rows = db.exec('SELECT * FROM "' + name + '"');
    console.log('\n========================================');
    console.log('TABLE: ' + name + ' (' + (rows[0]?.values?.length || 0) + ' rows)');
    console.log('========================================');
    if (rows[0]?.columns) {
      console.log('Columns: ' + rows[0].columns.join(', '));
      console.table(rows[0]?.values?.map((v, i) => {
        const obj = {};
        rows[0].columns.forEach((col, j) => { obj[col] = v[j]; });
        return obj;
      }));
    }
  }
});
