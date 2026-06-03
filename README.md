# Tascar School Portal

**Chakari (GVT) Primary School — Mashonaland West, Sanyati District**

A full-stack school management portal with role-based access for Admin, Teacher, Student, Bursar, and Prefect. Built with React + TypeScript (frontend), Node.js + Express + TypeScript (backend), and SQLite (database).

**Live URL:** https://school-portal-r4h0.onrender.com

---

## Login Credentials

### Admin

| Email | Password |
|-------|----------|
| punhamasiwa@gmail.com | 1234 |

### Bursar

| Email | Password |
|-------|----------|
| tascarmasiwa@gmail.com | 12345678 |

### Teachers (10 teachers)

| Name | Email | Password | Assigned Class |
|------|-------|----------|----------------|
| Tendai Moyo | teacher1@school.com | 1234 | ECD A |
| Chido Ndlovu | teacher2@school.com | 1234 | ECD B |
| Tafadzwa Sithole | teacher3@school.com | 1234 | Grade 1 |
| Rumbidzai Dube | teacher4@school.com | 1234 | Grade 2 |
| Kudzai Khumalo | teacher5@school.com | 1234 | Grade 3 |
| Nyasha Nyoni | teacher6@school.com | 1234 | Grade 4 |
| Tanaka Tshuma | teacher7@school.com | 1234 | Grade 5 |
| Tariro Ncube | teacher8@school.com | 1234 | Grade 6 |
| Anesu Mpofu | teacher9@school.com | 1234 | Grade 7 |
| Mufaro Sibanda | teacher10@school.com | 1234 | Unassigned |

### Students (100 students across ECD A to Grade 7)

All students use password: **1234**

Each student has a unique student number and logs in using their email (format: `studentnumber@temp.school`).

| Class | Student Numbers | Email Pattern | Count |
|-------|----------------|---------------|-------|
| ECD A | c2600001c – c2600011c | c2600001c@temp.school | 11 |
| ECD B | c2600012c – c2600022c | c2600012c@temp.school | 11 |
| Grade 1 | c2600023c – c2600033c | c2600023c@temp.school | 11 |
| Grade 2 | c2600034c – c2600044c | c2600034c@temp.school | 11 |
| Grade 3 | c2600045c – c2600055c | c2600045c@temp.school | 11 |
| Grade 4 | c2600056c – c2600066c | c2600056c@temp.school | 11 |
| Grade 5 | c2600067c – c2600077c | c2600067c@temp.school | 11 |
| Grade 6 | c2600078c – c2600088c | c2600078c@temp.school | 11 |
| Grade 7 | c2600089c – c2600100c | c2600089c@temp.school | 12 |

**Quick test login:** `c2600001c@temp.school` / `1234` (ECD A student)

---

## Database Access

### Method 1: SQL Console in Admin Panel

1. Log in as **Admin** (`punhamasiwa@gmail.com` / `1234`)
2. Click **Admin** in the navigation bar
3. Go to the **SQL Console** tab
4. Type or paste any SQL query and click Run

### Method 2: Browser Console (Quick SQL)

1. Log in as Admin
2. Open browser developer tools (F12 → Console)
3. Paste this helper function:

```js
async function sql(q) {
  const token = localStorage.getItem('token');
  const r = await fetch('/api/admin/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sql: q })
  });
  console.log(await r.json());
}
```

4. Run any query: `sql("SELECT * FROM users LIMIT 5");`

### Method 3: Database Browser (Visual)

1. Log in as Admin → Admin Panel → **Database Browser** tab
2. Click any table name to view its contents visually
3. Use the search box to filter rows

### Sample SQL Queries to Test

**Query 1 — List all users with their roles:**
```sql
SELECT id, name, email, role, student_number FROM users ORDER BY role, name;
```

**Query 2 — Show fee accounts with student names (owing students):**
```sql
SELECT u.name, u.student_number, f.account_type, f.total_fee, f.balance, f.credit_bf
FROM fee_accounts f
JOIN users u ON u.id = f.student_id
WHERE f.balance > 0
ORDER BY f.balance DESC;
```

**Query 3 — Attendance summary per class:**
```sql
SELECT c.name AS class,
  COUNT(*) AS total_records,
  SUM(CASE WHEN json_extract(a.records, '$[0].status') = 'present' THEN 1 ELSE 0 END) AS present
FROM attendance a
JOIN classes c ON c.id = a.class_id
GROUP BY c.name;
```

---

## Why SQLite Instead of MySQL?

| Factor | SQLite (Chosen) | MySQL |
|--------|-----------------|-------|
| **Setup** | Zero config — just include a library | Requires installing a server daemon, creating users, setting permissions |
| **Deployment** | Single file — copy and go | Needs a separate database server process |
| **Render Free Tier** | Works out of the box | Cannot install MySQL on Render free tier |
| **Size** | ~600KB library | Hundreds of MB installation |
| **Backup** | Copy one `.db` file | Requires `mysqldump` or similar tool |
| **Performance** | Fast for single-user / small scale | Designed for multi-user concurrent access |

SQLite is an **embedded database** — the database engine runs inside the application process itself. There is no separate server, no port to configure, no connection string. For a school portal with at most ~1000 students and a handful of concurrent users, SQLite is more than sufficient and dramatically simpler to deploy and maintain.

---

## System Overview — Features by Role

### Admin (Full Access)

- **Dashboard:** Analytics overview with charts (pass rates, fee collections, attendance stats) using Recharts
- **Fees:** View all fee accounts (SDC & SSF), manage payments, run term-end archive with credit carry-forward
- **Results:** View all student results across all classes and terms
- **Register:** View attendance records for any class and date
- **Timetable:** View and manage all class timetables
- **Homework:** View all homework across classes
- **Notices:** Post notices to all users, teachers, or specific classes
- **Quiz:** Create and manage quizzes for any class
- **Sports:** Manage sports categories and participants
- **Voting:** Create voting sessions (Head Boy, Head Girl, Prefect, Sports Captain)
- **Report Cards:** Generate printable report cards for any student
- **Student Stats:** Search and view detailed student analytics
- **Themes:** Choose from 23 visual themes (16 dark + 7 light)
- **Admin Panel:**
  - User management (CRUD)
  - Class management (CRUD)
  - Subject management (CRUD)
  - **SQL Console** — run raw SQL queries directly from the browser
  - **Database Browser** — visually browse any table
  - **Backup** — download the entire SQLite database file
  - **Restore** — upload a previously downloaded `.db` file

### Teacher (Class Management)

- **Dashboard:** Class-specific stats and overview
- **Register:** Mark daily attendance — each student must be manually marked as Present, Absent, or Excused (no auto-fill)
- **Results:** Enter coursework, test, and exam scores per subject per term; system auto-calculates totals and grades
- **Timetable:** View own class timetable
- **Homework:** Assign homework with due dates to own class
- **Quiz:** Create quizzes for own class
- **Notices:** Post notices to own class
- **Courses:** Manage courses
- **Report Cards:** Generate report cards for students in own class
- **Student Stats:** Search and view student analytics
- **Themes:** Customize visual theme

### Student (Personal View)

- **Dashboard:** Personal overview with attendance stats, fee balance, upcoming homework
- **Results:** View own results per term with subject scores and grades
- **Timetable:** View own class timetable
- **Fees:** View own fee accounts and payment history
- **Homework:** View and submit homework
- **Quiz:** Attempt quizzes assigned to class
- **Sports:** View and join sports teams
- **Voting:** Vote in open elections
- **Report Cards:** View and print own report cards
- **Student Stats:** View personal analytics
- **Themes:** Customize visual theme

### Bursar (Fees Only)

- **Dashboard:** Fee collection stats and overview charts
- **Fees:** View all student fee accounts, verify/reject pending payments, print e-receipts, view past fee archives
- **Report Cards:** View student report cards (read-only)
- **Student Stats:** View student analytics
- **Themes:** Customize visual theme

### Prefect (Monitoring)

- **Dashboard:** Overview of school statistics
- **Register:** View attendance records
- **Sports:** View sports teams and participants
- **Voting:** View election results
- **Themes:** Customize visual theme

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 with TypeScript |
| **Build Tool** | Vite 5 |
| **Routing** | React Router DOM v6 |
| **Charts** | Recharts |
| **HTTP Client** | Axios |
| **Backend Framework** | Node.js with Express + TypeScript |
| **Database** | SQLite via sql.js (embedded) |
| **Authentication** | JWT (jsonwebtoken) + bcryptjs |
| **Security** | Helmet, CORS, express-rate-limit |
| **File Upload** | Multer |
| **Hosting** | Render (free tier) |

---

## Important Notes

- **Render free tier** uses an ephemeral filesystem. The SQLite database resets to its initial state on every server restart/deploy. All 100 students + demo data are auto-seeded fresh each time.
- Use the **Admin Panel → Backup** feature to download the database file if you need to preserve changes. Use **Restore** to upload it back after a restart.
- Password for all pre-seeded accounts (except bursar) is **1234**.
- The bursar account uses password **12345678**.
