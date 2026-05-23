-- ═══════════════════════════════════════════════════════════════
-- COMPLETE DATABASE SEED — Term 2, 100 students, ALL tables
-- Paste into browser console:
--   fetch('/api/admin/sql',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('token')},body:JSON.stringify({sql:document.querySelector('#seed-data')?.textContent||''})}).then(r=>r.json()).then(d=>console.log(d))
-- ═══════════════════════════════════════════════════════════════

-- 1. CLEAR EXISTING TEST DATA
DELETE FROM quiz_answers;
DELETE FROM quiz_attempts;
DELETE FROM quiz_questions;
DELETE FROM quizzes;
DELETE FROM homework_submissions;
DELETE FROM homework;
DELETE FROM attendance;
DELETE FROM timetables;
DELETE FROM results;
DELETE FROM payments;
DELETE FROM fee_accounts;
DELETE FROM notices;
DELETE FROM votes;
DELETE FROM nominations;
DELETE FROM voting_sessions;
DELETE FROM sport_participants;
DELETE FROM sports;
DELETE FROM courses;
DELETE FROM user_settings;
DELETE FROM subjects;
DELETE FROM users WHERE role IN ('student','teacher');
DELETE FROM settings;

-- 2. CLASSES
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (1,'ECD A','ECD','A');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (2,'ECD B','ECD','B');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (3,'Grade 1','1','');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (4,'Grade 2','2','');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (5,'Grade 3','3','');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (6,'Grade 4','4','');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (7,'Grade 5','5','');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (8,'Grade 6','6','');
INSERT OR IGNORE INTO classes (id, name, grade, section) VALUES (9,'Grade 7','7','');

-- 3. TEACHERS (10) — WITH REG NUMBERS
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Tendai Moyo','teacher1@school.com','$2a$10$nx30KqDT0jlHF3hI4tCKgeSrUli3CSoBdFemeTnx1XyfmBBDzF3w6','teacher',1,'t260001c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Chido Ndlovu','teacher2@school.com','$2a$10$SdCXtorui4m4lSopKoODC.zMSHNeJTLQJHIocoBEE5wB9nG9HOrBG','teacher',2,'t260002c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Tafadzwa Sithole','teacher3@school.com','$2a$10$wZd5DigYXBO1QBip.pI19eUL6BehO.nw5V43dpcyPQqjKY5vJmg1S','teacher',3,'t260003c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Rumbidzai Dube','teacher4@school.com','$2a$10$wDPN3jBMJWbSiRatMbVU1OIxYmGlc2mzv9b5zNQORMd1K82PxunRG','teacher',4,'t260004c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Kudzai Khumalo','teacher5@school.com','$2a$10$d4SCnVLquVISvOWghaAq3ecMax/swWIj9TQ7i/uy4XPcYyzGucmmO','teacher',5,'t260005c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Nyasha Nyoni','teacher6@school.com','$2a$10$8FycEZCEj3Z.lJfsRMUOwelgTtERUTCIVgynAbY7CYd5Lw142X5Lq','teacher',6,'t260006c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Tanaka Tshuma','teacher7@school.com','$2a$10$mGiyaEn8DUi5/7XbmdNfPexzlk0KRREOCPQzHz.F2eoEbUNL8nvnG','teacher',7,'t260007c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Tariro Ncube','teacher8@school.com','$2a$10$DfXGbv3YJzG6zKXsAbM/Iedr7ggaFTu8a8uxdc2m07bhBWCjaCp/m','teacher',8,'t260008c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Anesu Mpofu','teacher9@school.com','$2a$10$So28mXskI.WBoctIcXU0zeNnCqVyDkX2COa8M.tLl2AisiS5OT6Le','teacher',9,'t260009c',1);
INSERT INTO users (name, email, password, role, class_id, student_number, is_active) VALUES ('Mufaro Sibanda','teacher10@school.com','$2a$10$OQuYbxPqOSGrpnit1VlONemL4fEJLImRLuFG2Hh.88Pwayo5XY6my','teacher',NULL,'t260010c',1);

-- 4. SUBJECTS (6-7 per class)
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'English', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'Mathematics', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'Science', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'History', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'Geography', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'Art & Culture', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'Shona Language', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher' WHERE c.grade>='3';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'ICT', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher' WHERE c.grade>='4';
INSERT INTO subjects (name, class_id, teacher_id)
SELECT 'Agriculture', c.id, COALESCE(t.id,(SELECT id FROM users WHERE role='teacher' LIMIT 1))
FROM classes c LEFT JOIN users t ON t.class_id=c.id AND t.role='teacher' WHERE c.grade>='5';

-- 5. STUDENTS (100) — all is_active=1
INSERT INTO users (name, email, password, role, class_id, student_number, is_active)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<100)
SELECT
  CASE (i-1)%15
    WHEN 0 THEN 'Takudzwa' WHEN 1 THEN 'Rutendo' WHEN 2 THEN 'Tatenda'
    WHEN 3 THEN 'Kundai' WHEN 4 THEN 'Makanaka' WHEN 5 THEN 'Panashe'
    WHEN 6 THEN 'Tadiwa' WHEN 7 THEN 'Kudzanai' WHEN 8 THEN 'Tanyaradzwa'
    WHEN 9 THEN 'Shamiso' WHEN 10 THEN 'Munyaradzi' WHEN 11 THEN 'Tafara'
    WHEN 12 THEN 'Ropafadzo' WHEN 13 THEN 'Masimba' ELSE 'Chiedza'
  END || ' ' ||
  CASE ((i-1)/15)%8
    WHEN 0 THEN 'Moyo' WHEN 1 THEN 'Ndlovu' WHEN 2 THEN 'Sithole'
    WHEN 3 THEN 'Dube' WHEN 4 THEN 'Khumalo' WHEN 5 THEN 'Nyoni'
    WHEN 6 THEN 'Tshuma' ELSE 'Ncube'
  END,
  'c26' || printf('%05d',i) || 'c@school.zw',
  '$2a$10$GZuNNg0kOnu.ADMBGJHIIeQ4xWhvrPaMw6569ZziGgckXD0VN8oMi',
  'student', (i-1)%9+1,
  'c26' || printf('%05d',i) || 'c', 1
FROM n;

-- 6. USER SETTINGS (everyone)
INSERT INTO user_settings (user_id, theme, accent_color)
SELECT id, 'default', '#1a237e' FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings);

-- 7. FEE SETTINGS
INSERT OR REPLACE INTO settings (key, value) VALUES ('sdc_fee','150');
INSERT OR REPLACE INTO settings (key, value) VALUES ('ssf_fee','80');

-- 8. FEE ACCOUNTS (SDC $150 + SSF $80 per student)
INSERT INTO fee_accounts (student_id, account_type, total_fee, balance)
SELECT id,'SDC',150,150 FROM users WHERE role='student';
INSERT INTO fee_accounts (student_id, account_type, total_fee, balance)
SELECT id,'SSF',80,80 FROM users WHERE role='student';

-- 9. PAYMENTS — Term 2, ~80% of students with 1-3 payments
INSERT INTO payments (student_id, account_type, amount, proof_file, notes, receipt_number, status, created_at)
SELECT u.id,
  CASE WHEN ABS(RANDOM())%3=0 THEN 'SSF' ELSE 'SDC' END,
  CAST(15+ABS(RANDOM())%70 AS REAL),
  '/uploads/term2_proof.jpg',
  'Term 2 school fees payment',
  'TR2-'||printf('%04d',u.id)||'-'||printf('%03d',ABS(RANDOM())%999+100),
  CASE WHEN ABS(RANDOM())%100<80 THEN 'verified' WHEN ABS(RANDOM())%100<95 THEN 'pending' ELSE 'rejected' END,
  datetime('2026-07-01','+'||CAST(ABS(RANDOM())%28 AS TEXT)||' days')
FROM users u WHERE u.role='student' AND ABS(RANDOM())%100<80;

UPDATE fee_accounts SET balance = balance - (
  SELECT COALESCE(SUM(amount),0) FROM payments
  WHERE payments.student_id=fee_accounts.student_id AND payments.account_type=fee_accounts.account_type AND payments.status='verified'
);

-- 10. RESULTS — Term 2, ~90% subject coverage for every student
INSERT INTO results (student_id, subject_id, teacher_id, term, academic_year, score, grade, remarks)
SELECT s.id, sub.id, sub.teacher_id, 'Term 2', '2026',
  CAST(20+ABS(RANDOM())%78 AS REAL),
  CASE WHEN CAST(20+ABS(RANDOM())%78 AS REAL)>=75 THEN 'A'
       WHEN CAST(20+ABS(RANDOM())%78 AS REAL)>=65 THEN 'B'
       WHEN CAST(20+ABS(RANDOM())%78 AS REAL)>=50 THEN 'C'
       WHEN CAST(20+ABS(RANDOM())%78 AS REAL)>=40 THEN 'D' ELSE 'E' END,
  CASE CAST(ABS(RANDOM())%8 AS INTEGER)
    WHEN 0 THEN 'Excellent progress this term. Keep it up!'
    WHEN 1 THEN 'Good effort, showing steady improvement.'
    WHEN 2 THEN 'Needs more revision at home.'
    WHEN 3 THEN 'Satisfactory work this term.'
    WHEN 4 THEN 'Outstanding performance in this subject.'
    WHEN 5 THEN 'Must focus more in class.'
    ELSE 'Can do better with consistent practice.'
  END
FROM users s
JOIN subjects sub ON sub.class_id=s.class_id
WHERE s.role='student' AND ABS(RANDOM())%100<90;

-- 11. TIMETABLE — 5 periods x 5 days per class
WITH sub_ranked AS (
  SELECT id, class_id, teacher_id,
    (SELECT COUNT(*) FROM subjects s2 WHERE s2.class_id=s1.class_id AND s2.id<=s1.id)-1 AS rn,
    (SELECT COUNT(*) FROM subjects WHERE class_id=s1.class_id) AS cnt
  FROM subjects s1
)
INSERT INTO timetables (class_id, subject_id, teacher_id, day, start_time, end_time, room, status)
SELECT sr.class_id, sr.id, sr.teacher_id,
  CASE d WHEN 0 THEN 'Monday' WHEN 1 THEN 'Tuesday' WHEN 2 THEN 'Wednesday' WHEN 3 THEN 'Thursday' ELSE 'Friday' END,
  CASE p WHEN 0 THEN '08:00' WHEN 1 THEN '09:00' WHEN 2 THEN '10:00' WHEN 3 THEN '11:00' ELSE '12:00' END,
  CASE p WHEN 0 THEN '09:00' WHEN 1 THEN '10:00' WHEN 2 THEN '11:00' WHEN 3 THEN '12:00' ELSE '13:00' END,
  'Room '||CAST(101+sr.class_id*10+p AS TEXT), 'published'
FROM sub_ranked sr
JOIN (SELECT 0 AS d, 0 AS p UNION ALL SELECT 0,1 UNION ALL SELECT 0,2 UNION ALL SELECT 0,3 UNION ALL SELECT 0,4
      UNION ALL SELECT 1,0 UNION ALL SELECT 1,1 UNION ALL SELECT 1,2 UNION ALL SELECT 1,3 UNION ALL SELECT 1,4
      UNION ALL SELECT 2,0 UNION ALL SELECT 2,1 UNION ALL SELECT 2,2 UNION ALL SELECT 2,3 UNION ALL SELECT 2,4
      UNION ALL SELECT 3,0 UNION ALL SELECT 3,1 UNION ALL SELECT 3,2 UNION ALL SELECT 3,3 UNION ALL SELECT 3,4
      UNION ALL SELECT 4,0 UNION ALL SELECT 4,1 UNION ALL SELECT 4,2 UNION ALL SELECT 4,3 UNION ALL SELECT 4,4) slots
WHERE sr.rn = ((d*5+p) % sr.cnt);

-- 12. ATTENDANCE — 15 days (3 weeks), all 9 classes
INSERT INTO attendance (class_id, teacher_id, date, records)
SELECT c.id, t.id, date('2026-07-07','+'||d||' days'),
  '['||GROUP_CONCAT('{"student_id":'||s.id||',"status":"'||
    CASE ABS(RANDOM())%12 WHEN 0 THEN 'absent' WHEN 1 THEN 'late' ELSE 'present' END||'"}')||']'
FROM classes c
JOIN users t ON t.class_id=c.id AND t.role='teacher'
JOIN users s ON s.class_id=c.id AND s.role='student'
JOIN (SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
      UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
      UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
      UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14) dd
GROUP BY c.id, t.id, dd.d;

-- 13. HOMEWORK — 3 per class
INSERT INTO homework (subject_id, teacher_id, class_id, title, description, due_date)
SELECT sub.id, u.id, c.id,
  CASE hw WHEN 0 THEN sub.name||' Worksheet' WHEN 1 THEN sub.name||' Project' ELSE sub.name||' Revision' END,
  CASE hw WHEN 0 THEN 'Complete all exercises in the worksheet. Show working.'
           WHEN 1 THEN 'Research and write a one-page summary of the topic covered.'
           ELSE 'Revise all work done this term. Test scheduled next week.' END,
  date('2026-07-18','+'||CAST(hw*7 AS TEXT)||' days')
FROM classes c
JOIN users u ON u.class_id=c.id AND u.role='teacher'
JOIN subjects sub ON sub.class_id=c.id
CROSS JOIN (SELECT 0 AS hw UNION ALL SELECT 1 UNION ALL SELECT 2) hwlist
WHERE sub.id = (SELECT MIN(id) FROM subjects WHERE class_id=c.id);

-- 14. HOMEWORK SUBMISSIONS — ~65% of students submit
INSERT INTO homework_submissions (homework_id, student_id, notes, grade, feedback)
SELECT h.id, s.id,
  CASE ABS(RANDOM())%4 WHEN 0 THEN 'Please find my completed work.' WHEN 1 THEN 'I tried my best.' WHEN 2 THEN 'Some questions were difficult.' ELSE 'Completed all tasks.' END,
  CAST(35+ABS(RANDOM())%65 AS REAL),
  CASE WHEN CAST(35+ABS(RANDOM())%65 AS REAL)>=75 THEN 'Very good work! Well done.'
       WHEN CAST(35+ABS(RANDOM())%65 AS REAL)>=60 THEN 'Good effort, keep practicing.'
       WHEN CAST(35+ABS(RANDOM())%65 AS REAL)>=50 THEN 'Satisfactory, but can improve.'
       ELSE 'Needs more effort. Please redo the incorrect answers.' END
FROM homework h
JOIN users s ON s.class_id=h.class_id AND s.role='student'
WHERE ABS(RANDOM())%100<65;

-- 15. QUIZZES — 2 per class
INSERT INTO quizzes (class_id, subject_id, teacher_id, title, description, duration_minutes)
SELECT c.id, sub.id, u.id,
  sub.name||' Quick Quiz',
  'Test your understanding of '||sub.name||' for '||c.name||'.',
  15
FROM classes c
JOIN users u ON u.class_id=c.id AND u.role='teacher'
JOIN subjects sub ON sub.class_id=c.id
WHERE sub.id = (SELECT MIN(id) FROM subjects WHERE class_id=c.id);

INSERT INTO quizzes (class_id, subject_id, teacher_id, title, description, duration_minutes)
SELECT c.id, sub.id, u.id,
  sub.name||' Mid-Term Test',
  'Mid-term assessment covering all '||sub.name||' topics.',
  30
FROM classes c
JOIN users u ON u.class_id=c.id AND u.role='teacher'
JOIN subjects sub ON sub.class_id=c.id
WHERE sub.id = (SELECT id FROM subjects WHERE class_id=c.id ORDER BY id LIMIT 1 OFFSET 1);

-- 16. QUIZ QUESTIONS — 5 per quiz
INSERT INTO quiz_questions (quiz_id, question, options, correct_answer)
SELECT qz.id,
  CASE qn%10
    WHEN 0 THEN 'What is the capital city of Zimbabwe?'
    WHEN 1 THEN 'What is 15 + 27?'
    WHEN 2 THEN 'Which planet is closest to the Sun?'
    WHEN 3 THEN 'What is the past tense of "sing"?'
    WHEN 4 THEN 'Name the longest river in Africa?'
    WHEN 5 THEN 'What does H2O represent?'
    WHEN 6 THEN 'How many sides does a triangle have?'
    WHEN 7 THEN 'Who is the current President of Zimbabwe?'
    WHEN 8 THEN 'What is 12 x 12?'
    ELSE 'Which ocean is to the east of Zimbabwe?'
  END,
  CASE qn%10
    WHEN 0 THEN '["Harare","Bulawayo","Gweru","Mutare"]'
    WHEN 1 THEN '["42","52","32","47"]'
    WHEN 2 THEN '["Mercury","Venus","Earth","Mars"]'
    WHEN 3 THEN '["sang","sung","singing","sings"]'
    WHEN 4 THEN '["Nile","Congo","Limpopo","Zambezi"]'
    WHEN 5 THEN '["Water","Salt","Sugar","Oxygen"]'
    WHEN 6 THEN '["3","4","5","6"]'
    WHEN 7 THEN '["Emmerson Mnangagwa","Nelson Chamisa","Morgan Tsvangirai","Robert Mugabe"]'
    WHEN 8 THEN '["144","124","132","156"]'
    ELSE '["Indian Ocean","Atlantic Ocean","Pacific Ocean","Arctic Ocean"]'
  END,
  CASE qn%10
    WHEN 0 THEN 'Harare' WHEN 1 THEN '42' WHEN 2 THEN 'Mercury'
    WHEN 3 THEN 'sang' WHEN 4 THEN 'Nile' WHEN 5 THEN 'Water'
    WHEN 6 THEN '3' WHEN 7 THEN 'Emmerson Mnangagwa' WHEN 8 THEN '144'
    ELSE 'Indian Ocean'
  END
FROM quizzes qz
CROSS JOIN (SELECT 1 AS qn UNION ALL SELECT 2 UNION ALL SELECT 3
            UNION ALL SELECT 4 UNION ALL SELECT 5) qn;

-- 17. QUIZ ATTEMPTS — ~50% of students attempt each quiz
INSERT INTO quiz_attempts (quiz_id, student_id, score, total, attempted_at)
SELECT qz.id, s.id, CAST(ABS(RANDOM())%5 AS INTEGER), 5,
  datetime('2026-07-14','+'||CAST(ABS(RANDOM())%14 AS TEXT)||' days')
FROM quizzes qz
JOIN users s ON s.class_id=qz.class_id AND s.role='student'
WHERE ABS(RANDOM())%100<50;

-- 18. QUIZ ANSWERS — one per question per attempt
INSERT INTO quiz_answers (attempt_id, question_id, selected_answer, is_correct)
SELECT qa.id, qq.id,
  json_extract(qq.options, '$['||CAST(ABS(RANDOM())%4 AS TEXT)||']'),
  CASE WHEN ABS(RANDOM())%100<60 THEN 1 ELSE 0 END
FROM quiz_attempts qa
JOIN quiz_questions qq ON qq.quiz_id=qa.quiz_id;

-- 19. COURSES — 1 per teacher with full details
INSERT INTO courses (name, description, teacher_id, class_id, day_of_week, start_time, end_time)
VALUES
  ('Literacy & Numeracy','Foundational literacy and numeracy for ECD A',1,1,'Monday','08:00','09:30'),
  ('Early Childhood Development','Creative play and social skills for ECD B',2,2,'Tuesday','08:00','09:30'),
  ('Primary Mathematics','Core mathematics for Grade 1',3,3,'Wednesday','08:00','09:30'),
  ('English Language Arts','Reading, writing, comprehension for Grade 2',4,4,'Thursday','08:00','09:30'),
  ('Environmental Science','Exploring nature for Grade 3',5,5,'Friday','08:00','09:30'),
  ('Heritage Studies','Zimbabwean history and culture for Grade 4',6,6,'Monday','10:00','11:30'),
  ('Practical Agriculture','Hands-on farming for Grade 5',7,7,'Tuesday','10:00','11:30'),
  ('Computer Literacy','Introduction to ICT for Grade 6',8,8,'Wednesday','10:00','11:30'),
  ('Advanced Mathematics','Preparation for Grade 7 exams',9,9,'Thursday','10:00','11:30'),
  ('Sports & Recreation','Physical education and team sports',10,NULL,'Friday','10:00','11:30');

-- 20. NOTICES — 6 realistic school notices
INSERT INTO notices (title, content, author_id, target_role, class_id)
VALUES
  ('Term 2 Sports Day','Term 2 Inter-House Sports Day will be held on 15 August 2026. All students must report in their house uniforms by 7:30 AM.',1,'all',NULL),
  ('School Fees Reminder','Please ensure all school fees are fully paid by 31 July 2026. Statements can be obtained from the finance office.',1,'all',NULL),
  ('Staff Meeting','There will be a staff meeting on Monday at 2:30 PM in the staff room. Attendance is mandatory.',1,'teachers',NULL),
  ('Grade 7 Mock Exams','Grade 7 mock examinations begin on 1 August 2026. Revision timetable has been posted.',1,'students',9),
  ('Agriculture Project Submissions','All Grade 5-7 agriculture projects must be submitted by 25 July 2026. Late submissions penalized.',1,'students',NULL),
  ('Reading Competition','Annual reading competition on 10 August 2026. Sign up at the library.',1,'students',NULL);

-- 21. SPORTS
INSERT INTO sports (name, description, coach_id, max_participants)
SELECT 'Soccer','Inter-school soccer league',id,22 FROM users WHERE email='teacher1@school.com';
INSERT INTO sports (name, description, coach_id, max_participants)
SELECT 'Netball','Girls netball team',id,14 FROM users WHERE email='teacher8@school.com';
INSERT INTO sports (name, description, coach_id, max_participants)
SELECT 'Athletics','Track and field events',id,30 FROM users WHERE email='teacher6@school.com';
INSERT INTO sports (name, description, coach_id, max_participants)
SELECT 'Basketball','Basketball team',id,16 FROM users WHERE email='teacher7@school.com';
INSERT INTO sports (name, description, coach_id, max_participants)
SELECT 'Volleyball','Volleyball team',id,16 FROM users WHERE email='teacher5@school.com';

-- 22. VOTING SESSIONS (insert BEFORE nominations)
INSERT INTO voting_sessions (title, description, position, status, start_date, end_date, created_by)
SELECT 'Head Boy Election 2026','Vote for the next Head Boy','Head Boy','open','2026-09-01','2026-09-15',id FROM users WHERE role='admin' LIMIT 1;
INSERT INTO voting_sessions (title, description, position, status, start_date, end_date, created_by)
SELECT 'Head Girl Election 2026','Vote for the next Head Girl','Head Girl','open','2026-09-01','2026-09-15',id FROM users WHERE role='admin' LIMIT 1;
INSERT INTO voting_sessions (title, description, position, status, start_date, end_date, created_by)
SELECT 'Sports Captain Election 2026','Vote for the next Sports Captain','Sports Captain','open','2026-09-01','2026-09-15',id FROM users WHERE role='admin' LIMIT 1;
INSERT INTO voting_sessions (title, description, position, status, start_date, end_date, created_by)
SELECT 'Prefect Council Election 2026','Vote for student prefect representatives','Prefect','open','2026-09-01','2026-09-15',id FROM users WHERE role='admin' LIMIT 1;

-- 23. SPORT PARTICIPANTS — ~15 per sport
INSERT INTO sport_participants (sport_id, student_id, role)
SELECT sp.id, u.id,
  CASE WHEN ABS(RANDOM())%15=0 THEN 'captain' WHEN ABS(RANDOM())%15=1 THEN 'vice-captain' ELSE 'member' END
FROM sports sp
CROSS JOIN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM()) u
WHERE u.id IN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM() LIMIT 15)
GROUP BY sp.id, u.id;

-- 24. NOMINATIONS — 3-4 candidates per session
INSERT INTO nominations (session_id, student_id, manifesto)
SELECT vs.id, u.id,
  CASE ABS(RANDOM())%4
    WHEN 0 THEN 'I promise to represent all students fairly and work with teachers to improve our school.'
    WHEN 1 THEN 'Together we can make this school better. Vote for me and I will be your voice.'
    WHEN 2 THEN 'I am dedicated, responsible, and ready to serve. Let us build a brighter future.'
    ELSE 'I will ensure discipline, respect, and excellence are upheld in our school.'
  END
FROM voting_sessions vs
CROSS JOIN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM() LIMIT 4) u
GROUP BY vs.id, u.id;

-- 25. VOTES — one vote per voter per session
INSERT INTO votes (session_id, candidate_id, voter_id)
SELECT n.session_id, n.id, u.id
FROM nominations n
CROSS JOIN (SELECT id FROM users WHERE role='student' ORDER BY RANDOM() LIMIT 25) u
WHERE NOT EXISTS (SELECT 1 FROM votes v WHERE v.session_id=n.session_id AND v.voter_id=u.id)
GROUP BY n.session_id, u.id;
