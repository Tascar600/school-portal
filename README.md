# Tascar School Portal

**Chakari (GVT) Primary School — Mashonaland West, Sanyati District**

A full-stack school management portal with role-based access for Admin, Teacher, Student, and Bursar. Built with React + TypeScript (frontend), Node.js + Express + TypeScript (backend), and SQLite (database).

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

The database no longer auto-seeds fake teachers or students. On first run only the real Admin and Bursar accounts above exist, alongside the real Zimbabwe class list (ECD A/B, Grade 1–7). Add real teachers and students through **Admin Panel → Users** (or **Finance → Student Profiles → Import from Excel** for bulk student import). New teacher/student accounts are created inactive; they activate themselves at `/activate` using their assigned student/registration number, exactly as before.

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

**Query 2 — Students who currently owe fees (live balance = billed − paid):**
```sql
SELECT u.name, u.student_number,
  COALESCE((SELECT SUM(total) FROM invoices WHERE student_id = u.id AND status = 'active'), 0)
    - COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = u.id AND status = 'active'), 0) AS balance
FROM users u WHERE u.role = 'student'
HAVING balance > 0
ORDER BY balance DESC;
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

- **Dashboard:** Analytics overview with charts (pass rates, attendance stats) using Recharts, plus live outstanding-fees total
- **Finance:** Full bursary module — terms, fee items & fee structure, billing, invoices, charges/credit notes, receiving payments (with printable PDF receipts), expenses, cash/bank accounts with transfers, bank reconciliation, budgets vs actual, sponsors & discounts, student finance profiles (with Excel/CSV import and year-end promotion), WhatsApp fee reminders, and reports with Excel export (daily collections, debtors, aged arrears, income & expenditure, sponsor claims, and more)
- **Results:** View all student results across all classes and terms
- **Register:** View attendance records for any class and date
- **Timetable:** View and manage all class timetables
- **Homework:** View all homework across classes
- **Notices:** Post notices to all users, teachers, or specific classes
- **Quiz:** Create and manage quizzes for any class
- **Sports:** Manage sports categories and participants
- **Report Cards:** Generate printable report cards for any student
- **Student Stats:** Search and view detailed student analytics
- **Themes:** Choose from 24 visual themes (16 dark + 8 light, including a Zimbabwe Heritage theme)
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
- **Fees:** View own invoices, payment history, and current balance (fees are recorded by the bursary office — students don't self-submit payments)
- **Homework:** View and submit homework
- **Quiz:** Attempt quizzes assigned to class
- **Sports:** View and join sports teams
- **Report Cards:** View and print own report cards
- **Student Stats:** View personal analytics
- **Themes:** Customize visual theme

### Bursar (Finance only)

The Bursar role is scoped strictly to money — it has no access to academic data, report cards, student analytics, themes, or any other non-finance area of the portal, at both the navigation and API level.

- **Dashboard:** Outstanding fees, active invoice count, recent payments
- **Finance:** Same full bursary module as Admin (billing, invoices, payments, expenses, accounts, reconciliation, budgets, sponsors, discounts, student finance profiles, reports) — everything except user/class/subject management and the SQL console, which stay Admin-only

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 with TypeScript |
| **Build Tool** | Vite 5 |
| **Routing** | React Router DOM v6 |
| **Charts** | Recharts |
| **Icons** | lucide-react |
| **HTTP Client** | Axios |
| **Backend Framework** | Node.js with Express + TypeScript |
| **Database** | SQLite via sql.js (embedded) |
| **Authentication** | JWT (jsonwebtoken) + bcryptjs |
| **Security** | Helmet, CORS, express-rate-limit |
| **File Upload** | Multer |
| **PDF Generation** | pdfkit (receipts, invoices — pure JS, no browser/Chromium dependency) |
| **Excel Import/Export** | exceljs (pure JS) |
| **Hosting** | Render (free tier) |

---

## Important Notes

- **⚠ Render free tier uses an ephemeral filesystem.** The SQLite database file is wiped on every server restart/redeploy, and — now that fake demo data is no longer auto-seeded to paper over this — a restart will silently erase **real** students, teachers, invoices, and payments, leaving only the Admin/Bursar bootstrap accounts and the class list. Before going live on the free tier, either:
  - Use **Admin Panel → Backup** to download the `.db` file regularly (daily, at minimum before any deploy) and **Restore** it after each restart, or
  - Move to a Render plan with a persistent disk (or any host with persistent storage) so the database survives restarts on its own.

  This is the single most important operational risk in the current setup — treat backups as mandatory, not optional, until persistent storage is in place.
- Password for the Admin bootstrap account is **1234**; the Bursar bootstrap account uses **12345678**. Change both via the app's profile/change-password screen before real use — these are meant as first-login credentials, not permanent ones.
