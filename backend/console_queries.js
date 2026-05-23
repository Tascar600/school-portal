// ================================================================
// BROWSER CONSOLE SCRIPTS
// Paste these into Chrome DevTools Console (F12 → Console tab)
// while logged into school-portal as admin
// ================================================================

// --- Helper (runs any SQL, returns results) ---
async function sql(q) {
  const r = await fetch('/api/admin/sql', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('token')},
    body:JSON.stringify({sql:q})
  });
  const d = await r.json();
  if (d.error) { console.error(d.error); return; }
  console.table(d.rows || d);
  return d.rows || d;
}

// ================================================================
// USAGE: Copy & paste the ENTIRE block above once, then run any below
// ================================================================

// 1. All students with their class
await sql(`SELECT u.id, u.name, u.student_number, c.name AS class, u.is_active
  FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='student' ORDER BY u.id`);

// 2. Teachers with their class
await sql(`SELECT u.id, u.name, u.email, c.name AS class
  FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='teacher'`);

// 3. Fee balances (who owes what)
await sql(`SELECT u.name, u.student_number,
  SUM(CASE WHEN fa.account_type='SDC' THEN fa.balance END) AS sdc_owing,
  SUM(CASE WHEN fa.account_type='SSF' THEN fa.balance END) AS ssf_owing,
  SUM(fa.balance) AS total_owing,
  CASE WHEN SUM(fa.balance)=0 THEN 'PAID' ELSE 'OWING' END AS status
  FROM fee_accounts fa JOIN users u ON u.id=fa.student_id
  WHERE u.role='student' GROUP BY u.id ORDER BY total_owing DESC`);

// 4. Recent payments
await sql(`SELECT u.name, u.student_number, p.account_type, p.amount, p.status, p.receipt_number, p.created_at
  FROM payments p JOIN users u ON u.id=p.student_id ORDER BY p.created_at DESC LIMIT 30`);

// 5. Pending payments (needs verification)
await sql(`SELECT p.id, u.name, u.student_number, p.account_type, p.amount, p.receipt_number, p.created_at
  FROM payments p JOIN users u ON u.id=p.student_id WHERE p.status='pending' ORDER BY p.created_at DESC`);

// 6. Results for a class (change class_id = 1..9)
await sql(`SELECT u.name AS student, s.name AS subject, r.score, r.grade, r.term
  FROM results r JOIN users u ON u.id=r.student_id JOIN subjects s ON s.id=r.subject_id
  WHERE u.class_id=3 ORDER BY u.name, s.name`);

// 7. Timetable for a class (change class_id)
await sql(`SELECT t.day, t.start_time, t.end_time, s.name AS subject, t.room, t.status
  FROM timetables t JOIN subjects s ON s.id=t.subject_id
  WHERE t.class_id=1 ORDER BY t.day, t.start_time`);

// 8. Students who never paid
await sql(`SELECT u.name, u.student_number, c.name AS class FROM users u
  JOIN classes c ON c.id=u.class_id WHERE u.role='student'
  AND u.id NOT IN (SELECT DISTINCT student_id FROM payments WHERE status='verified')
  ORDER BY u.name`);

// 9. Fee totals collected
await sql(`SELECT account_type, COUNT(*) AS txns, SUM(amount) AS total,
  SUM(CASE WHEN status='verified' THEN amount ELSE 0 END) AS verified,
  SUM(CASE WHEN status='pending' THEN amount ELSE 0 END) AS pending
  FROM payments GROUP BY account_type`);

// 10. Class enrollment
await sql(`SELECT c.name, COUNT(u.id) AS students
  FROM classes c LEFT JOIN users u ON u.class_id=c.id AND u.role='student'
  GROUP BY c.id ORDER BY c.name`);

// 11. Attendance summary
await sql(`SELECT c.name AS class, a.date,
  LENGTH(a.records)-LENGTH(REPLACE(a.records,'present','')) AS present,
  LENGTH(a.records)-LENGTH(REPLACE(a.records,'absent','')) AS absent
  FROM attendance a JOIN classes c ON c.id=a.class_id ORDER BY a.date DESC LIMIT 15`);

// 12. Homework list
await sql(`SELECT h.title, h.due_date, s.name AS subject, c.name AS class
  FROM homework h JOIN subjects s ON s.id=h.subject_id
  JOIN classes c ON c.id=h.class_id ORDER BY h.due_date`);

// 13. Sports participants
await sql(`SELECT sp.sport, u.name, u.student_number, sp.team
  FROM sport_participants sp JOIN users u ON u.id=sp.student_id ORDER BY sp.sport`);

// 14. Nominations with vote counts
await sql(`SELECT n.position, n.candidate_name, c.name AS class,
  (SELECT COUNT(*) FROM votes WHERE nomination_id=n.id) AS votes
  FROM nominations n LEFT JOIN classes c ON c.id=n.class_id ORDER BY votes DESC`);

// 15. Average scores per student (top 20)
await sql(`SELECT u.name, u.student_number, ROUND(AVG(r.score),1) AS avg_score, COUNT(r.id) AS subjects
  FROM results r JOIN users u ON u.id=r.student_id
  WHERE u.role='student' GROUP BY u.id ORDER BY avg_score DESC LIMIT 20`);

// 16. Full DB row counts
await sql(`SELECT 'users' AS tbl, COUNT(*) FROM users
  UNION ALL SELECT 'classes', COUNT(*) FROM classes
  UNION ALL SELECT 'subjects', COUNT(*) FROM subjects
  UNION ALL SELECT 'timetables', COUNT(*) FROM timetables
  UNION ALL SELECT 'fee_accounts', COUNT(*) FROM fee_accounts
  UNION ALL SELECT 'payments', COUNT(*) FROM payments
  UNION ALL SELECT 'results', COUNT(*) FROM results
  UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
  UNION ALL SELECT 'homework', COUNT(*) FROM homework
  UNION ALL SELECT 'courses', COUNT(*) FROM courses
  UNION ALL SELECT 'sport_participants', COUNT(*) FROM sport_participants
  UNION ALL SELECT 'nominations', COUNT(*) FROM nominations
  UNION ALL SELECT 'votes', COUNT(*) FROM votes
  UNION ALL SELECT 'settings', COUNT(*) FROM settings`);
