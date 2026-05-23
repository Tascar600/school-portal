-- ============================================================
-- SQL QUERIES TO EXPLORE THE DATABASE
-- Paste these into Admin → Database → SQL Console
-- ============================================================

-- 1. ALL STUDENTS WITH CLASS
SELECT id, name, student_number,
  (SELECT name FROM classes WHERE id=users.class_id) AS class,
  CASE WHEN is_active=1 THEN 'Active' ELSE 'Inactive' END AS status
FROM users WHERE role='student' ORDER BY class_id, name;

-- 2. TEACHERS WITH THEIR CLASS
SELECT u.id, u.name, u.email, c.name AS class
FROM users u LEFT JOIN classes c ON c.id=u.class_id
WHERE u.role='teacher' ORDER BY u.name;

-- 3. SUBJECTS PER CLASS
SELECT c.name AS class, s.name AS subject
FROM subjects s JOIN classes c ON c.id=s.class_id
ORDER BY c.name, s.name;

-- 4. TIMETABLE FOR A SPECIFIC CLASS (change class_id)
SELECT day, start_time, end_time,
  (SELECT name FROM subjects WHERE id=timetables.subject_id) AS subject,
  room, status
FROM timetables WHERE class_id=1 ORDER BY day, start_time;

-- 5. FEE BALANCES (who owes what)
SELECT u.name, u.student_number,
  SUM(CASE WHEN fa.account_type='SDC' THEN fa.balance END) AS sdc_owing,
  SUM(CASE WHEN fa.account_type='SSF' THEN fa.balance END) AS ssf_owing,
  SUM(fa.balance) AS total_owing,
  CASE WHEN SUM(fa.balance)=0 THEN 'FULLY PAID' ELSE 'OWING' END AS status
FROM fee_accounts fa JOIN users u ON u.id=fa.student_id
WHERE u.role='student'
GROUP BY u.id ORDER BY total_owing DESC;

-- 6. PAYMENT HISTORY (recent first)
SELECT u.name, u.student_number, p.account_type, p.amount, p.status, p.receipt_number, p.created_at
FROM payments p JOIN users u ON u.id=p.student_id
ORDER BY p.created_at DESC LIMIT 30;

-- 7. PENDING PAYMENTS (needs verification)
SELECT p.id, u.name, u.student_number, p.account_type, p.amount, p.receipt_number, p.created_at
FROM payments p JOIN users u ON u.id=p.student_id
WHERE p.status='pending' ORDER BY p.created_at DESC;

-- 8. RESULTS FOR A CLASS (change class_id)
SELECT u.name AS student,
  (SELECT name FROM subjects WHERE id=r.subject_id) AS subject,
  r.score, r.grade, r.term, r.academic_year
FROM results r JOIN users u ON u.id=r.student_id
WHERE u.class_id=3 ORDER BY u.name, subject;

-- 9. STUDENT GRADES SUMMARY (average score per student)
SELECT u.name, u.student_number,
  ROUND(AVG(r.score),1) AS avg_score,
  COUNT(r.id) AS subjects_taken
FROM results r JOIN users u ON u.id=r.student_id
WHERE u.role='student'
GROUP BY u.id ORDER BY avg_score DESC LIMIT 20;

-- 10. ATTENDANCE SUMMARY
SELECT c.name AS class, a.date,
  LENGTH(a.records) - LENGTH(REPLACE(a.records,'present','')) AS present_count,
  LENGTH(a.records) - LENGTH(REPLACE(a.records,'absent','')) AS absent_count
FROM attendance a JOIN classes c ON c.id=a.class_id
ORDER BY a.date DESC LIMIT 20;

-- 11. HOMEWORK WITH SUBJECT & CLASS
SELECT h.title, h.description, h.due_date,
  (SELECT name FROM subjects WHERE id=h.subject_id) AS subject,
  (SELECT name FROM classes WHERE id=h.class_id) AS class
FROM homework h ORDER BY h.due_date;

-- 12. SPORTS PARTICIPANTS
SELECT sp.sport, u.name, u.student_number, sp.team
FROM sport_participants sp JOIN users u ON u.id=sp.student_id
ORDER BY sp.sport;

-- 13. NOMINATIONS & VOTES
SELECT n.position, n.candidate_name,
  (SELECT name FROM classes WHERE id=n.class_id) AS class,
  (SELECT COUNT(*) FROM votes WHERE nomination_id=n.id) AS vote_count
FROM nominations n ORDER BY vote_count DESC;

-- 14. STUDENTS WHO HAVEN'T PAID ANYTHING
SELECT u.name, u.student_number,
  (SELECT name FROM classes WHERE id=u.class_id) AS class
FROM users u WHERE u.role='student'
AND u.id NOT IN (SELECT DISTINCT student_id FROM payments WHERE status='verified')
ORDER BY u.name;

-- 15. FEE COLLECTION TOTALS
SELECT account_type,
  COUNT(*) AS total_transactions,
  SUM(amount) AS total_collected,
  SUM(CASE WHEN status='verified' THEN amount ELSE 0 END) AS verified_amount,
  SUM(CASE WHEN status='pending' THEN amount ELSE 0 END) AS pending_amount
FROM payments GROUP BY account_type;

-- 16. CLASS ENROLLMENT COUNTS
SELECT c.name, COUNT(u.id) AS student_count
FROM classes c LEFT JOIN users u ON u.class_id=c.id AND u.role='student'
GROUP BY c.id ORDER BY c.name;

-- 17. FIND STUDENT BY REG NUMBER
SELECT id, name, student_number,
  (SELECT name FROM classes WHERE id=users.class_id) AS class,
  is_active
FROM users WHERE student_number LIKE '%c260001%' ORDER BY student_number;

-- 18. VERIFY SPECIFIC PAYMENT
SELECT p.id, u.name, p.account_type, p.amount, p.receipt_number, p.status, p.created_at
FROM payments p JOIN users u ON u.id=p.student_id
WHERE p.receipt_number LIKE '%RCP-00%';
