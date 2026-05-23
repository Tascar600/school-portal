-- ═══════════════════════════════════════════════════════════════
-- FULL DATABASE SEED — 70 students, all tables
-- Paste ENTIRE block into browser console:
--   await sql(`PASTE_HERE`);
-- ═══════════════════════════════════════════════════════════════

-- Clear existing test data (keep admin)
DELETE FROM payments;
DELETE FROM fee_accounts;
DELETE FROM attendance;
DELETE FROM results;
DELETE FROM homework_submissions;
DELETE FROM homework;
DELETE FROM timetables;
DELETE FROM subjects;
DELETE FROM courses;
DELETE FROM sport_participants;
DELETE FROM sports;
DELETE FROM votes;
DELETE FROM nominations;
DELETE FROM voting_sessions;
DELETE FROM users WHERE role IN ('student','teacher');

-- ── CLASSES ──
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('ECD A','ECD','A');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('ECD B','ECD','B');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 1','1','');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 2','2','');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 3','3','');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 4','4','');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 5','5','');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 6','6','');
INSERT OR IGNORE INTO classes (name, grade, section) VALUES ('Grade 7','7','');

-- ── TEACHERS (INSERT OR IGNORE in case already exist) ──
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Tendai Moyo','teacher1@school.com','$2a$10$nx30KqDT0jlHF3hI4tCKgeSrUli3CSoBdFemeTnx1XyfmBBDzF3w6','teacher',id,1 FROM classes WHERE name='ECD A';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Chido Ndlovu','teacher2@school.com','$2a$10$SdCXtorui4m4lSopKoODC.zMSHNeJTLQJHIocoBEE5wB9nG9HOrBG','teacher',id,1 FROM classes WHERE name='ECD B';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Tafadzwa Sithole','teacher3@school.com','$2a$10$wZd5DigYXBO1QBip.pI19eUL6BehO.nw5V43dpcyPQqjKY5vJmg1S','teacher',id,1 FROM classes WHERE name='Grade 1';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Rumbidzai Dube','teacher4@school.com','$2a$10$wDPN3jBMJWbSiRatMbVU1OIxYmGlc2mzv9b5zNQORMd1K82PxunRG','teacher',id,1 FROM classes WHERE name='Grade 2';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Kudzai Khumalo','teacher5@school.com','$2a$10$d4SCnVLquVISvOWghaAq3ecMax/swWIj9TQ7i/uy4XPcYyzGucmmO','teacher',id,1 FROM classes WHERE name='Grade 3';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Nyasha Nyoni','teacher6@school.com','$2a$10$8FycEZCEj3Z.lJfsRMUOwelgTtERUTCIVgynAbY7CYd5Lw142X5Lq','teacher',id,1 FROM classes WHERE name='Grade 4';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Tanaka Tshuma','teacher7@school.com','$2a$10$mGiyaEn8DUi5/7XbmdNfPexzlk0KRREOCPQzHz.F2eoEbUNL8nvnG','teacher',id,1 FROM classes WHERE name='Grade 5';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Tariro Ncube','teacher8@school.com','$2a$10$DfXGbv3YJzG6zKXsAbM/Iedr7ggaFTu8a8uxdc2m07bhBWCjaCp/m','teacher',id,1 FROM classes WHERE name='Grade 6';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) SELECT 'Anesu Mpofu','teacher9@school.com','$2a$10$So28mXskI.WBoctIcXU0zeNnCqVyDkX2COa8M.tLl2AisiS5OT6Le','teacher',id,1 FROM classes WHERE name='Grade 7';
INSERT OR IGNORE INTO users (name, email, password, role, class_id, is_active) VALUES ('Mufaro Sibanda','teacher10@school.com','$2a$10$OQuYbxPqOSGrpnit1VlONemL4fEJLImRLuFG2Hh.88Pwayo5XY6my','teacher',NULL,1);

-- ── SUBJECTS (6-7 per class) ──
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'English', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'Mathematics', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'Science', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'History', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'Geography', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'Art', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'Shona', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher' WHERE c.grade>='3';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'ICT', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher' WHERE c.grade>='4';
INSERT INTO subjects (name, class_id, teacher_id) SELECT 'Agriculture', c.id, t.id FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher' WHERE c.grade>='5';

-- ── STUDENTS (70) ──
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<70) SELECT CASE (i-1)%10 WHEN 0 THEN 'Takudzwa' WHEN 1 THEN 'Rutendo' WHEN 2 THEN 'Tatenda' WHEN 3 THEN 'Kundai' WHEN 4 THEN 'Makanaka' WHEN 5 THEN 'Panashe' WHEN 6 THEN 'Tadiwa' WHEN 7 THEN 'Kudzanai' WHEN 8 THEN 'Tanyaradzwa' ELSE 'Shamiso' END || ' ' || CASE ((i-1)/10)%7 WHEN 0 THEN 'Moyo' WHEN 1 THEN 'Ndlovu' WHEN 2 THEN 'Sithole' WHEN 3 THEN 'Dube' WHEN 4 THEN 'Khumalo' WHEN 5 THEN 'Nyoni' ELSE 'Tshuma' END, 'c26' || printf('%04d',i) || 'c@temp.school', '$2a$10$GZuNNg0kOnu.ADMBGJHIIeQ4xWhvrPaMw6569ZziGgckXD0VN8oMi', 'student', (i-1)%9+1, 'c26' || printf('%04d',i) || 'c', 1 FROM n;

-- ── FEE SETTINGS ──
INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee','100');
INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee','60');

-- ── FEE ACCOUNTS ──
INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) SELECT id,'SDC',100,100 FROM users WHERE role='student';
INSERT INTO fee_accounts (student_id, account_type, total_fee, balance) SELECT id,'SSF',60,60 FROM users WHERE role='student';

-- ── PAYMENTS (~60% of students random) ──
INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number, status, created_at) SELECT u.id, CASE WHEN ABS(RANDOM())%2=0 THEN 'SDC' ELSE 'SSF' END, CAST(10+ABS(RANDOM())%80 AS REAL), '', 'Term 1 payment', 'RCP-'||printf('%04d',u.id)||'-'||printf('%03d',ABS(RANDOM())%999+100), CASE WHEN ABS(RANDOM())%100<80 THEN 'verified' ELSE 'pending' END, datetime('now','-'||CAST(ABS(RANDOM())%30 AS TEXT)||' days') FROM users u WHERE u.role='student' AND ABS(RANDOM())%100<60;
UPDATE fee_accounts SET balance = balance - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE payments.student_id=fee_accounts.student_id AND payments.account_type=fee_accounts.account_type AND payments.status='verified');

-- ── RESULTS ──
INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, score, grade) SELECT s.id, sub.id, sub.teacher_id, 'Term 1', '2026', CAST(25+ABS(RANDOM())%75 AS REAL), CASE WHEN 25+ABS(RANDOM())%75>=75 THEN 'A' WHEN 25+ABS(RANDOM())%75>=60 THEN 'B' WHEN 25+ABS(RANDOM())%75>=50 THEN 'C' WHEN 25+ABS(RANDOM())%75>=40 THEN 'D' ELSE 'E' END FROM users s JOIN subjects sub ON sub.class_id=s.class_id WHERE s.role='student' AND ABS(RANDOM())%100<85;

-- ── TIMETABLE (5 periods per class) ──
INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room, status) SELECT c.id, sub.id, sub.teacher_id, CASE d.n WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' ELSE 'Friday' END, CAST(8+(d.n-1)*2 AS TEXT)||':00', CAST(9+(d.n-1)*2 AS TEXT)||':00', 'Room '||CAST(101+d.n AS TEXT), 'published' FROM classes c CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) d JOIN subjects sub ON sub.class_id=c.id WHERE sub.id=(SELECT MIN(id) FROM subjects WHERE class_id=c.id);

-- ── ATTENDANCE (5 days, first 5 classes) ──
INSERT INTO attendance (class_id, teacher_id, date, records) SELECT c.id, t.id, date('now','-'||CAST((d.n)*3 AS TEXT)||' days'), '['||GROUP_CONCAT('{"student_id":'||s.id||',"status":"'||CASE ABS(RANDOM())%10 WHEN 0 THEN 'absent' WHEN 1 THEN 'late' ELSE 'present' END||'"}')||']' FROM classes c JOIN users t ON t.class_id=c.id AND t.role='teacher' JOIN users s ON s.class_id=c.id AND s.role='student' CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) d WHERE c.id BETWEEN 1 AND 5 GROUP BY c.id, t.id, d.n;

-- ── HOMEWORK ──
INSERT INTO homework (subject_id, teacher_id, class_id, title, description, due_date) SELECT sub.id, sub.teacher_id, c.id, 'Homework - '||sub.name, 'Complete the exercises for '||sub.name, date('now','+'||CAST(7+ABS(RANDOM())%14 AS TEXT)||' days') FROM subjects sub JOIN classes c ON c.id=sub.class_id WHERE sub.id IN (SELECT MIN(id) FROM subjects GROUP BY class_id);

-- ── COURSES ──
INSERT INTO courses (name, description, teacher_id) SELECT 'Mathematics', 'Basic Mathematics', id FROM users WHERE role='teacher' ORDER BY id LIMIT 1;
INSERT INTO courses (name, description, teacher_id) SELECT 'English', 'English Language', id FROM users WHERE role='teacher' ORDER BY id LIMIT 1 OFFSET 1;
INSERT INTO courses (name, description, teacher_id) SELECT 'Science', 'General Science', id FROM users WHERE role='teacher' ORDER BY id LIMIT 1 OFFSET 2;
INSERT INTO courses (name, description, teacher_id) SELECT 'History', 'World History', id FROM users WHERE role='teacher' ORDER BY id LIMIT 1 OFFSET 3;
INSERT INTO courses (name, description, teacher_id) SELECT 'Art', 'Creative Arts', id FROM users WHERE role='teacher' ORDER BY id LIMIT 1 OFFSET 4;

-- ── SPORTS ──
INSERT INTO sports (name) VALUES ('Soccer');
INSERT INTO sports (name) VALUES ('Netball');
INSERT INTO sports (name) VALUES ('Athletics');
INSERT INTO sports (name) VALUES ('Basketball');
INSERT INTO sports (name) VALUES ('Volleyball');
INSERT INTO sport_participants (sport_id, student_id, role) SELECT sp.id, u.id, 'member' FROM sports sp CROSS JOIN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM() LIMIT 25) u GROUP BY sp.id, u.id;

-- ── VOTING SESSION + NOMINATIONS + VOTES ──
INSERT INTO voting_sessions (title, position, status, created_by) VALUES ('Head Boy Election', 'Head Boy', 'closed', (SELECT id FROM users WHERE role='admin' LIMIT 1));
INSERT INTO voting_sessions (title, position, status, created_by) VALUES ('Head Girl Election', 'Head Girl', 'closed', (SELECT id FROM users WHERE role='admin' LIMIT 1));
INSERT INTO voting_sessions (title, position, status, created_by) VALUES ('Sports Captain Election', 'Sports Captain', 'open', (SELECT id FROM users WHERE role='admin' LIMIT 1));
INSERT INTO nominations (session_id, student_id) SELECT vs.id, u.id FROM voting_sessions vs CROSS JOIN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM() LIMIT 3) u;
INSERT INTO votes (session_id, candidate_id, voter_id) SELECT n.session_id, n.id, u.id FROM nominations n CROSS JOIN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM() LIMIT 20) u GROUP BY n.session_id, n.id, u.id;
