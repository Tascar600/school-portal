# CHAKARI GVT PRI SCHO — School Portal

**Chakari (GVT) Primary School — Mashonaland West, Sanyati District**

A school management portal for a Zimbabwean primary school, built around the **Heritage-Based Curriculum (2024–2030)**. Five kinds of account — Administrator, Teacher, Pupil, Parent and Bursar — each see only what their job needs. Built with React + TypeScript (frontend), Node.js + Express + TypeScript (backend) and SQLite (database).

School colours are green, cream and gold. The crest is `backend/assets/logo.png`; the Administrator can replace it, and the school's name, address, contacts and bank details, in **Admin Panel → School details and logo**. Everything printed picks the change up at once.

**Live URL:** https://school-portal-r4h0.onrender.com

---

## Login Credentials

| Account | Email | Password |
|---------|-------|----------|
| Administrator | punhamasiwa@gmail.com | 1234 |
| Bursar | tascarmasiwa@gmail.com | 12345678 |

The database does not auto-seed fake teachers or pupils. On a fresh start only the two accounts above exist, plus the real Zimbabwe class list (ECD A/B, Grade 1–7). Each class gets its Heritage-Based Curriculum learning areas when its teacher is added. Add real teachers and pupils through **Admin Panel → Users** (or, as Administrator, **Bursary → Students → Import from Excel** for bulk pupil import). New teacher and pupil accounts are created inactive; each person activates their own account at `/activate` with their registration number.

**A new portal makes the first person to log in to each of these two accounts choose their own password straight away** (the portal refuses to do anything else until they do, on the server as well as on screen). You can change it again at any time from the top right → **Password**. Passwords are never printed in the user manuals, on purpose.

### If a password is forgotten or you think someone knows it

| Situation | What to do |
|-----------|-----------|
| Anyone forgot their password | On the log in page press **Forgot your password?** and type their email or registration number. The request appears in the Administrator's **Admin Panel → Passwords** tab. The Administrator confirms who they are and presses **Give temporary password**. The person logs in with it and is made to choose their own straight away. |
| You think someone else knows your password | Press **Password** at the top right and choose a new one. Every other device you were logged in on is logged out immediately. |
| The Administrator forgot theirs and nobody else can log in, **on your own computer** | Switch the portal off, then run `cd backend` and `npm run reset-password -- admin@example.com NewPassword1`, then start the portal again. |
| The same, **on a host such as Render** (where the portal cannot be switched off) | In the host's settings (Render → Environment) add `RESET_STARTING_ACCOUNTS` with any word you have not used before, for example `reset1`, and save so the portal restarts. The Administrator and the Bursar are put back to the starting passwords (`1234` and `12345678`), a closed account is opened again, and anyone logged in is signed out. **Log in at once and choose a new password for both**, because those starting passwords are public. No data is lost. It works once for each different word, so leaving the setting in place does not keep resetting passwords (remove it when you are in). Other accounts are not touched: give them temporary passwords from **Admin Panel → Passwords**. |

---

## The Heritage-Based Curriculum in this portal

Every class gets these **learning areas** automatically as soon as a teacher is assigned to it:

| Learning area | Counts towards average and class position |
|---------------|:---:|
| Indigenous Language | yes |
| English Language | yes |
| Mathematics | yes |
| Science and Technology | yes |
| Social Science | yes |
| Physical Education and Art | yes |
| ICT and Robotics (additional) | no — shown separately |

* **Marks:** every learning area is marked out of 100 as **School-Based Project 20 + Test 20 + Exam 60**. Teachers enter all three for each pupil on one mark sheet (Results → Enter marks) and give the project a title. A mark above its maximum is refused. The split can be changed in **Admin Panel → Grading and marks** (the three must total 100).
* **Grades and units** are worked out from the total mark:

| Marks | Grade | Unit | Meaning |
|-------|:---:|:---:|---------|
| 90 – 100 | A | 1 | Outstanding |
| 80 – 89 | A | 2 | Excellent |
| 70 – 79 | B | 3 | Very good |
| 60 – 69 | C | 4 | Good |
| 50 – 59 | D | 5 | Satisfactory |
| 40 – 49 | E | 6 | Needs improvement |
| 30 – 39 | U | 7 | Weak |
| 20 – 29 | U | 8 | Very weak |
| 0 – 19 | U | 9 | Ungraded |

> **Please check these bands.** They are the school's defaults, not figures copied from a Ministry circular — the official mark ranges for each unit could not be confirmed. If the Ministry or your District Office gives different ranges, change them in **Admin Panel → Grading and marks → Marks, grades and units**; results and report cards use the new bands immediately.

* **Report cards** ("Pupil Progress Report") show the six core areas with project, test, exam, total, grade, unit and the teacher's remark, then the total and average, the **position in class**, attendance, the grade key, the class teacher's and head's comments and signature lines. ICT and Robotics is listed separately.
* Each teacher looks after one class. A teacher can only enter marks, take the register, set homework or quizzes for their own class.

---

## Bursary — the Bursar's account

The Bursar handles money and nothing else: no access to marks, report cards, user management, the grading set-up or the database. The Administrator can **look** at every finance page but cannot record, change, bill or reverse anything.

The Bursary pages are deliberately plain. The menu is: **Overview · Receive Fees · Students · Invoices · Expenses · Cash & Bank · Reports · Setup**.

* **Everything has dates, and every list can be filtered by period.** The same **period bar** is on every page: *Today, This week, This month, This term, Last term, This year, Last 30 days, All time* or any **From / To** dates. Every figure, table and chart follows it, and the dates are printed on the paper copy.
* **Overview — statistics:** fees billed, collected, collection rate (with comparison to the previous period), money spent, net position, what is owing right now, money in and out by month (or day), how fees were paid, each class's billed vs collected, and the pupils who owe the most.
* **Receive Fees:** find the pupil by name, registration number or class, enter the amount, date, currency, method (cash, bank, EcoCash, swipe, in kind), who paid and **notes**. The receipt (A4, with the school letterhead, border and crest watermark) shows the pupil, class, term, who paid, the notes, how it was paid, the amount in words, and the balance after payment, and can be printed or saved straight away. A mistaken receipt is **reversed** with a recorded reason — never deleted.
* **Students:** every pupil's balance and guardian details, a dated **fee statement** for any period (bills, payments, running balance) that can be printed with the school's bank details, discounts, and **fee reminders** to the parents of pupils who owe (see "Text messages" below).
* **Invoices:** bill a class or a pupil, one-off charges, credit notes, cancel with a reason.
* **Expenses & Cash & Bank:** expense vouchers (printable), categories, cash and bank accounts, transfers and the cash book.
* **Reports** (all printable and exportable to Excel): daily cash-up, collections by class, by fee item, debtors, aged arrears, income & expenditure, payment methods, class lists.
* **Setup:** terms (set current / lock), fee items, the fee for each class, discounts, currencies and exchange rates.
* **Audit trail (Administrator only, read only):** every change made in the Bursary is written down automatically: a payment received, a receipt reversed (with the reason), an invoice or expense cancelled, a fee or exchange rate changed, a term locked, pupils imported or promoted. Each line says who, what, when and how much, in a plain sentence, and can be filtered by period, kind of change and person, searched, printed and exported. The portal has no page, button or route to edit or delete a line, and even the SQL tool in the Admin Panel refuses to change the audit table. It starts from the day the feature was installed. Restoring an old database backup replaces everything, including this record, so keep your backups.

---

## Text messages (fee reminders)

On **Students → Fee reminders** the Bursar picks a class and a minimum balance, chooses how to send, previews who will get the message, then sends. Every message, and whether it was sent or failed, is kept in the history. Phone numbers typed as `0771234567`, `263771234567` or `+263 77 123 4567` are all understood.

| Send by | What happens | Needs |
|---|---|---|
| **WhatsApp** | Opens WhatsApp with the message written; the Bursar presses send | Nothing |
| **SMS from this device** | Opens the messages app (best on a phone) with the text written; the Bursar presses send | Nothing |
| **SMS sent automatically** | The portal sends each text itself, one by one or "Send all". A refused or unanswered text is marked failed, with the reason, and can be tried again | An SMS service (below) |

**Automatic SMS is off until you connect a service.** The portal has no SMS account of its own. Set these before starting the backend, pointing at any bulk-SMS service that accepts a web request (or a small relay in front of one):

```
SMS_WEBHOOK_URL=https://your-sms-service.example/send     (required: turns the option on)
SMS_WEBHOOK_TOKEN=a-secret                               (optional: sent as "Authorization: Bearer ...")
SMS_SENDER_ID=CHAKARI                                    (optional: the name or number the text comes from)
```

For each text the portal sends one `POST` with JSON `{"to": "+263771234567", "message": "...", "from": "CHAKARI"}` and treats any 2xx answer as sent. This was tested against a pretend service (`npm run test:sms`), **not against a real SMS provider**, so try it with one or two numbers of your own first. Every text sent is also written in the audit trail.

---

## Printing

Every page with a **Print** button (and the receipts, invoices, statements and vouchers, which are PDFs) prints on the school letterhead: crest, school name, district and province, contacts, motto, the page title and period, who printed it and when. Every printed sheet has a green and gold **page border**, a faint **crest watermark** and a footer line. Menus and buttons are left off the paper.

A small line, *For all your system development contact 0710325831*, is at the bottom of every page of the website, on every printed sheet, on every page of every PDF (receipts, invoices, statements, vouchers, the user manuals) and in the print footer of the Excel exports (it shows in Print Preview; nothing is added to the data). To change the wording or number, edit it in two places: `frontend/src/components/DeveloperFooter.tsx` (the website and printed web pages) and `backend/src/utils/branding.ts` (the PDFs and Excel files). `npm run test:production` and `npm run test:pages` check that it is there.

Browser printing uses `box-decoration-break: clone` to repeat the border on each page, which needs a current Chrome, Edge or Firefox. On a very old browser the border may show only at the top of the first page and the bottom of the last.

---

## User manuals (one for each account)

Every page has a gold **Download Manual** button at the top right. It downloads the manual **for the account that is logged in** as a PDF (Administrator, Bursar, Teacher, Pupil or Parent). Each manual explains, with real pictures of the pages and gold numbered markers beside a table of "what you see / press → what it does":

* logging in, changing your password, and what to do if you forgot it or think someone knows it
* every page of that account, and step-by-step "How to" boxes
* everyday jobs at a glance, troubleshooting, keeping your account safe, and a glossary.

The pictures live in `backend/assets/manual/`. After you change how a page looks, take them again (see below).

---

## Appearance

There are exactly four, chosen from the box at the top right of every page (and remembered for that account):

| Appearance | What it does |
|------------|--------------|
| **Default** (Professional) | Follows the computer's own light or dark setting |
| **White** | Always light |
| **Dark** | Always dark |
| **Extra dark** | Darkest, for dim rooms and OLED screens |

There are no animations or moving effects anywhere in the portal.

---

## Installing as an app

The portal can be installed on a phone, tablet or computer, so it opens from its own icon (the school badge) in its own window, with no address bar.

* **Android (Chrome):** open the portal, then menu (⋮) → **Install app** (or **Add to Home screen**).
* **iPhone / iPad (Safari):** open the portal, press **Share** → **Add to Home Screen**.
* **Windows / Mac (Chrome or Edge):** press the install icon at the right end of the address bar.

It is still the live portal: it needs an internet connection, and marks, fees and receipts are never kept on the device (pages under `/api` and `/uploads` are never cached). With no connection it shows a plain "You are offline" page. The pieces are `frontend/public/manifest.webmanifest`, `sw.js` (the service worker), `offline.html` and the icons. If `backend/assets/logo.png` is ever replaced, run `node scripts/make-app-icons.mjs` in `backend/` and rebuild to redraw the icons.

---

## Sample Data & Automated Feature Check (local development only)

An **opt-in** script fills a *local* database with a realistic school and checks every feature while doing it. It is never run automatically and refuses to talk to anything but `localhost`.

```bash
# 1. start the backend with a higher auth rate limit (creating 54 accounts exceeds the default of 100 per 15 min)
cd backend
set AUTH_RATE_LIMIT=2000        # PowerShell: $env:AUTH_RATE_LIMIT = '2000'
set FIRST_LOGIN_PASSWORD_CHANGE=off   # only for a fresh local test database: keeps the documented 1234 / 12345678 logins usable
npm start

# 2. in a second terminal
cd backend
npm run seed:sample             # add BASE_URL=http://localhost:3000/api to go through the Vite proxy
```

It drives the real HTTP API as each role, then prints a pass/fail summary (about 250 checks, including 60+ "who may NOT do this" permission checks). Safe to re-run — existing records are reused.

**What it creates:** 9 teachers (one per class), 45 pupils (5 per class), the 6 core learning areas + ICT and Robotics for every class, a published 15-lesson timetable per class, 5 days of register, 3 homework tasks per class (with submissions, a file upload and graded work), 2 auto-marked quizzes per class, 540 results (School-Based Project / Test / Exam, Terms 1–2) and report cards, notices, 5 sports, courses, and a full bursary (Term 2 and 3 billing, fee structure, a staff-child discount, payments in USD/ZWG by cash, bank, EcoCash and swipe, a reversal, a credit note, expenses, a bank transfer, reminders and reports).

| Role | Email | Password |
|------|-------|----------|
| Teacher, ECD A | rumbidzai.moyo0@chakari.school | Teacher@123 |
| Teacher, ECD B | tapiwa.ncube0@chakari.school | Teacher@123 |
| Teacher, Grade 1 | chiedza.sibanda0@chakari.school | Teacher@123 |
| Teacher, Grade 2 | takudzwa.mutasa0@chakari.school | Teacher@123 |
| Teacher, Grade 3 | nomsa.dube0@chakari.school | Teacher@123 |
| Teacher, Grade 4 | blessing.chikwanha0@chakari.school | Teacher@123 |
| Teacher, Grade 5 | loveness.mhlanga0@chakari.school | Teacher@123 |
| Teacher, Grade 6 | farai.mapfumo0@chakari.school | Teacher@123 |
| Teacher, Grade 7 | josephine.zhou0@chakari.school | Teacher@123 |
| Pupils (45) | full list below | Student@123 |
| Parent of Tendai Moyo (ECD A) and Netsai Moyo (Grade 2) | parent.moyo@chakari.school | Parent@123 |
| Parent of Rudo Dube (ECD A) | parent.dube@chakari.school | Parent@123 |

<details>
<summary>All 45 pupil logins (password for every one: <code>Student@123</code>)</summary>

| Class | Pupil | Email | Reg. number |
|-------|---------|-------|-------------|
| ECD A | Tendai Moyo | tendai.moyo1@chakari.school | c2600001c |
| ECD A | Rudo Dube | rudo.dube2@chakari.school | c2600002c |
| ECD A | Chipo Chigumba | chipo.chigumba3@chakari.school | c2600003c |
| ECD A | Nyasha Chuma | nyasha.chuma4@chakari.school | c2600004c |
| ECD A | Tatenda Gumbo | tatenda.gumbo5@chakari.school | c2600005c |
| ECD B | Farai Mpofu | farai.mpofu6@chakari.school | c2600006c |
| ECD B | Ruvimbo Banda | ruvimbo.banda7@chakari.school | c2600007c |
| ECD B | Tinotenda Zimunya | tinotenda.zimunya8@chakari.school | c2600008c |
| ECD B | Vimbai Marufu | vimbai.marufu9@chakari.school | c2600009c |
| ECD B | Kudzai Sibanda | kudzai.sibanda10@chakari.school | c2600010c |
| Grade 1 | Shamiso Makoni | shamiso.makoni11@chakari.school | c2600011c |
| Grade 1 | Memory Tshuma | memory.tshuma12@chakari.school | c2600012c |
| Grade 1 | Precious Ncube | precious.ncube13@chakari.school | c2600013c |
| Grade 1 | Tsitsi Ndlovu | tsitsi.ndlovu14@chakari.school | c2600014c |
| Grade 1 | Anesu Mutasa | anesu.mutasa15@chakari.school | c2600015c |
| Grade 2 | Netsai Moyo | netsai.moyo16@chakari.school | c2600016c |
| Grade 2 | Rufaro Dube | rufaro.dube17@chakari.school | c2600017c |
| Grade 2 | Chenai Chigumba | chenai.chigumba18@chakari.school | c2600018c |
| Grade 2 | Mazvita Chuma | mazvita.chuma19@chakari.school | c2600019c |
| Grade 2 | Panashe Gumbo | panashe.gumbo20@chakari.school | c2600020c |
| Grade 3 | Thabo Mpofu | thabo.mpofu21@chakari.school | c2600021c |
| Grade 3 | Sipho Banda | sipho.banda22@chakari.school | c2600022c |
| Grade 3 | Nokuthula Zimunya | nokuthula.zimunya23@chakari.school | c2600023c |
| Grade 3 | Lindiwe Marufu | lindiwe.marufu24@chakari.school | c2600024c |
| Grade 3 | Bongani Sibanda | bongani.sibanda25@chakari.school | c2600025c |
| Grade 4 | Zanele Makoni | zanele.makoni26@chakari.school | c2600026c |
| Grade 4 | Mthabisi Tshuma | mthabisi.tshuma27@chakari.school | c2600027c |
| Grade 4 | Thandiwe Ncube | thandiwe.ncube28@chakari.school | c2600028c |
| Grade 4 | Nkosana Ndlovu | nkosana.ndlovu29@chakari.school | c2600029c |
| Grade 4 | Gugulethu Mutasa | gugulethu.mutasa30@chakari.school | c2600030c |
| Grade 5 | Tafadzwa Moyo | tafadzwa.moyo31@chakari.school | c2600031c |
| Grade 5 | Munashe Dube | munashe.dube32@chakari.school | c2600032c |
| Grade 5 | Tanaka Chigumba | tanaka.chigumba33@chakari.school | c2600033c |
| Grade 5 | Kuda Chuma | kuda.chuma34@chakari.school | c2600034c |
| Grade 5 | Simbarashe Gumbo | simbarashe.gumbo35@chakari.school | c2600035c |
| Grade 6 | Fadzai Mpofu | fadzai.mpofu36@chakari.school | c2600036c |
| Grade 6 | Chiedza Banda | chiedza.banda37@chakari.school | c2600037c |
| Grade 6 | Ropafadzo Zimunya | ropafadzo.zimunya38@chakari.school | c2600038c |
| Grade 6 | Leeroy Marufu | leeroy.marufu39@chakari.school | c2600039c |
| Grade 6 | Joyline Sibanda | joyline.sibanda40@chakari.school | c2600040c |
| Grade 7 | Tapuwa Makoni | tapuwa.makoni41@chakari.school | c2600041c |
| Grade 7 | Brighton Tshuma | brighton.tshuma42@chakari.school | c2600042c |
| Grade 7 | Samantha Ncube | samantha.ncube43@chakari.school | c2600043c |
| Grade 7 | Prince Ndlovu | prince.ndlovu44@chakari.school | c2600044c |
| Grade 7 | Gift Mutasa | gift.mutasa45@chakari.school | c2600045c |

</details>

To start again from an empty portal, stop the backend, delete `backend/school_portal.db`, and start it again — it re-creates only the Administrator, Bursar, the class list and the learning areas.

### Taking the manual pictures again

With the portal running and the sample school loaded:

```bash
cd backend
npm run capture-manual               # every picture
npm run capture-manual -- bursary    # one account only (admin, bursary, teacher, student)
```

It needs Google Chrome installed, logs in as each sample account, draws the gold numbered markers on the real controls, and lists any control it could not find. The manual text lives in `backend/src/manual/content/`; restart the backend after editing it.

---

## Demo school (works with no internet)

To show the portal to someone, double-click **`Start Demo.bat`** (or run `npm run demo` in `backend/`). It starts the portal on this computer at **http://localhost:5050** and opens the browser. Nothing is fetched from the internet, so it works with no connection at all.

The first time it also loads a complete school, which takes about two minutes: 9 teachers, **10 pupils in every class (90)**, 17 parent accounts (brothers and sisters in different classes), 15 days of register, 9 homework tasks and 6 quizzes per class with hand-ins, marks and feedback, Terms 1 and 2 results and report cards, Grade 7 examination marks, 20 notices, sports teams, and the whole bursary (bills for Terms 2 and 3, payments in cash, bank, EcoCash, swipe and ZWG, instalments, arrears, charges, fee waivers, expenses, transfers and reminders). After that it starts at once with the same school.

* **It never touches your real school.** The demo school lives in its own folder, `demo-data/` beside `backend/` (ignored by Git). `npm start` still uses `backend/school_portal.db`.
* **Start again from a fresh demo:** `npm run demo -- --reset` (or `"Start Demo.bat" --reset`) throws the demo folder away and loads a new one. `--no-open` does not open the browser; `DEMO_PORT` changes the port. Press Ctrl+C (or close the window) to stop.
* **Log ins** are the sample ones in "Sample Data" above (Administrator `punhamasiwa@gmail.com` / `1234`, Bursar `tascarmasiwa@gmail.com` / `12345678`, teachers `Teacher@123`, pupils `Student@123`), plus parents `parent.<surname>@chakari.school` / `Parent@123` (for example `parent.khumalo@`, three children in three classes). The demo starts with first-log-in password changes switched off so those work straight away; never use that setting on a real school.
* The demo adds to `seed:sample`'s school with `npm run seed:demo`, which is safe to run twice. Do not run `seed:sample` again on a school that has had it: that script counts exactly 5 pupils per class.

---

## Loading class lists and registers from Excel

The school's class lists and term registers can be loaded into the live portal from the Excel sheets (one workbook per class, with the sheets **Pupils** and **Attendance Import**, and optionally **Attendance Register**). Double-click **`Import Class Registers.bat`** and drag the `.xlsx` files onto it, or run in `backend/`:

```
npm run import:register -- "C:\path\Chakari_ECD_A_2026_Pupils_and_Attendance.xlsx" "C:\path\Chakari_ECD_B_2026_Pupils_and_Attendance.xlsx"
```

**Names and details only (no attendance):** double-click **`Import Pupil Names.bat`** instead (or add `--names-only`). It finds the `..._Pupils_and_Attendance.xlsx` sheets on the Desktop and in Downloads by itself, adds the pupils with their gender, date of birth, notes and registration number, and loads **no registers**. The registers can still be added later with `Import Class Registers.bat`: the pupils already there are not added twice.

It runs **on your own computer** and talks to the portal over the internet, so you log in with your own Administrator account (it asks for the portal's address, the email, and the password, which is not shown as you type). Choose your own password on the portal first: the importer refuses an account that still has to change its starting password.

* **It shows the plan first** (pupils to add, register days to add, anything it will skip) and changes nothing until you type `IMPORT`. `--dry-run` shows the plan and stops.
* **Each pupil goes into the class named in the sheet** ("ECD A", "ECD B"). If the portal has no class with that name, nothing at all is added; make the class under Classes first.
* **Pupils are added as closed accounts** with a registration number, like any pupil created by the Administrator. Gender, date of birth and the day they joined are filled in; a date of birth that was unclear in the scan is not guessed, but written in the pupil's notes with the sheet's own remark.
* **Registers:** one register for each school day in the sheet, owned by the Administrator. Days with no marks (holidays) get no register. `N` (admitted that day) is handled as each sheet says: left out of the count, or counted as present.
* **Pupils marked `T` (transferred)** are closed and recorded as having left, with their attendance up to that day kept.
* **A row with no name** (for example "(NAME MISSING)") is skipped and reported; add the name in Excel and run it again, or add that pupil by hand in the portal.
* **Only clear dates of birth are entered.** The sheet's own "Date of Birth" column is used; a date written in the scan that the sheet marks as unclear is kept in the pupil's notes, not entered.
* **Safe to run again:** pupils and register days already in the portal are not added twice, and anything the school has edited in the portal is never overwritten.
* **Check the notes:** every doubtful row in the sheet ("Check / Notes") is copied to the pupil's notes beginning `CHECK:`, so the school can find and correct them.

`npm run test:import` checks all of this against a throw-away portal, with invented names.

---

## Scripts

| Command (in `backend/`) | What it does |
|-------------------------|--------------|
| `npm start` | Runs the portal (serves the built frontend and the API) |
| `npm run import:register -- <files.xlsx>` | Loads class lists and attendance registers from Excel into a portal (see "Loading class lists and registers from Excel") |
| `npm run test:import` | Checks that loader against a throw-away portal with invented names |
| `npm run seed:sample` | Loads the sample school and runs the feature check (local only) |
| `npm run demo` | Starts a complete demo school on this computer, with no internet (see "Demo school") |
| `npm run seed:demo` | Adds the bigger demo data (10 pupils per class, fees, homework, quizzes) to a school that has had `seed:sample` (`npm run demo` does both) |
| `npm run test:reset` | Starts throw-away portals and checks the emergency reset (`RESET_STARTING_ACCOUNTS`): both accounts back to the starting passwords, data kept, once per word |
| `npm run test:backup` | Checks the off-site backup against a pretend GitHub: encryption, upload, restore, refusing to start, and a full redeploy |
| `npm run backup:check` | Downloads and decrypts the latest off-site backup and says what is in it, changing nothing (see "Off-site backup to GitHub") |
| `npm run capture-manual` | Takes the pictures used in the PDF manuals |
| `npm test` | Runs everything below: the first-login check, the sample-school API check, then all the browser tests |
| `npm run test:first-login` | Starts a throw-away empty portal on port 5055 and checks what the very first log in does (your real database is never touched) |
| `npm run test:browser` | The browser tests only (`test:pages`, `test:journeys`, `test:classwork`) |
| `npm run test:sms` | Starts a pretend SMS service and a throw-away portal on ports 5098/5056 and checks automatic text messages |
| `npm run test:email` | Starts a pretend mail server and throw-away portals on ports 5097/5059 and checks the emailed backups (attachments, new files only, daily send, errors) |
| `npm run test:production` | Builds the frontend with the real build command and starts the portal the way a host does, on an empty database (port 5057), to check what a visitor gets and that the security warning works |
| `npm run test:mobile` | Opens every page of every account at phone width and fails if any page has to be dragged sideways |
| `npm run print:samples` | Prints key pages to PDF in `tests/browser/output/printed/` so you can inspect the paper layout |
| `npm run reset-password -- <email> <new password>` | Emergency password reset (portal switched off) |
| `node scripts/make-app-icons.mjs` | Redraws the installable-app icons from the school badge (needs Chrome) |

Settings (environment variables, all optional):

| Variable | Meaning |
|---|---|
| `PORT` | Port the portal listens on (default 5000) |
| `DATA_DIR` | One folder for everything that must survive a restart: the database, its `backups`, and `uploads` (homework, payment proofs, the logo). On a host, set it to the permanent disk's mount path (Render: `/var/data`). Without it everything stays in the project folder, which a free host wipes |
| `DB_PATH` | Use a different database file (the tests use this for throw-away copies); its `backups` folder sits beside it |
| `BACKUP_DIR` | Put the automatic daily copies somewhere else |
| `AUTH_RATE_LIMIT` | Log in / sign-up requests allowed per 15 minutes **for each visitor** (default 100; the page-load check counts too). Raise it **only for local testing** |
| `TRUST_PROXY` | Which addresses are proxies, so each visitor gets their own log in limit. On a host (Render) the portal already trusts the private network and Cloudflare's published ranges, so leave this alone. Override with a number (that many proxies), `false`, or a comma-separated list of addresses. The log shows `Visitor address check: the portal sees this visitor as ...` for the first two visitors after each start, and a `WARNING` if that is a proxy rather than the visitor |
| `FIRST_LOGIN_PASSWORD_CHANGE=off` | Do not make the Administrator and Bursar choose a password on first log in. **Only for a fresh local test database** |
| `RESET_STARTING_ACCOUNTS` | Emergency way back in: set it to a new word and restart, and the Administrator and Bursar go back to the starting passwords (see "If a password is forgotten"). Works once per word; remove it afterwards |
| `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`, `SMS_SENDER_ID` | Turn on automatic text messages (see "Text messages") |
| `BACKUP_EMAIL_TO`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM` | Turn on emailed backups (see "Emailed backups"). `SMTP_PORT` defaults to 465; `SMTP_FROM` to `SMTP_USER` |
| `BACKUP_GITHUB_TOKEN`, `BACKUP_GITHUB_REPO`, `BACKUP_PASSPHRASE` | Turn on the encrypted off-site backup to a private GitHub repository, and the automatic restore after a wipe (see "Off-site backup to GitHub"). All three are needed; with any missing it does nothing. Optional: `BACKUP_BRANCH` (default `data-backup`), `BACKUP_FILE` (default `snapshot.bin`), `BACKUP_INTERVAL_MS` (default `60000`) |

### Automated tests

Two layers, both for your **own computer only** (they refuse any address except `localhost`, because they create and undo records):

* **API check** (`npm run seed:sample`, about 250 checks): drives every feature as each kind of account and tries the things each account must *not* be able to do.
* **Browser tests** (`backend/tests/browser/`, about 200 checks, need Google Chrome): log in through the real log in page and use the screens like a person would.
  * `pages.mjs` opens every page of every account and looks for script errors, failed calls, blank pages and wrong menus.
  * `journeys.mjs` covers the manuals, entering marks, a payment with notes and its receipt, reversing it, the period bar and printing, the four appearances, forgotten and changed passwords, school details and logo, grading changes, who may see what, and the audit trail.
  * `classwork.mjs` covers homework, quizzes, the register, grading and notices.

Start the portal first (backend with `AUTH_RATE_LIMIT=2000`, frontend on port 3000), load the sample school once with `npm run seed:sample`, then run `npm run test:browser`. Each test that changes something puts it back. Pictures and a JSON report are written to `tests/browser/output/`.

---

## Database Access

### Method 1: Database tab in the Admin Panel

1. Log in as **Administrator** and open **Admin Panel → Database**.
2. **Download a backup now** saves a copy of the whole portal to your computer; **Restore Database** puts a saved copy back. The portal also keeps one automatic copy for each of the last 14 days in `backend/backups/` (these guard against mistakes, not against losing the computer or host). When no backup has been downloaded for 7 days, the Administrator's dashboard shows a reminder.
3. **Database Browser** lists every table; click one to see its rows.

4. **Check the database** looks for records that point at something that is gone (for example a bill for a pupil who was deleted, which would wrongly add to "Fees outstanding"). It reports; it never deletes anything.

**Records are protected.** The database now enforces its own links for as long as the portal runs. The Administrator cannot delete a pupil or teacher who has marks, bills or receipts, nor a class that still has pupils or records, nor your own account, nor the only Administrator or Bursar. The message says what would be lost. For someone who has left the school, press **Close** beside their name in **Admin Panel → Users**: their history stays, they can no longer log in and are taken out of their class; **Reopen** undoes it.

### Method 2: Browser Console (quick SQL, Administrator only)

1. Log in as Administrator and open the browser developer tools (F12 → Console).
2. Paste this helper function:

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

3. Run any query: `sql("SELECT * FROM users LIMIT 5");`

### Sample SQL Queries to Test

**Query 1 — List all users with their roles:**
```sql
SELECT id, name, email, role, student_number FROM users ORDER BY role, name;
```

**Query 2 — Pupils who currently owe fees (live balance = billed − paid):**
```sql
SELECT u.name, u.student_number,
  COALESCE((SELECT SUM(total) FROM invoices WHERE student_id = u.id AND status = 'active'), 0)
    - COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = u.id AND status = 'active'), 0) AS balance
FROM users u WHERE u.role = 'student'
HAVING balance > 0
ORDER BY balance DESC;
```

**Query 3 — Class averages for a term (six core areas only):**
```sql
SELECT c.name AS class, ROUND(AVG(r.coursework + r.test_score + r.exam), 1) AS average
FROM results r JOIN users u ON u.id = r.student_id JOIN classes c ON c.id = u.class_id
JOIN subjects s ON s.id = r.subject_id
WHERE r.term = 'Term 1' AND r.status = 'active' AND s.name <> 'ICT and Robotics'
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

SQLite is an **embedded database** — the database engine runs inside the application process itself. There is no separate server, no port to configure, no connection string. For a primary school with at most ~1000 pupils and a handful of people using it at once, SQLite is more than sufficient and dramatically simpler to deploy and maintain.

---

## System Overview — Features by Role

### Administrator

- **Dashboard and Analytics:** counts, pass rates, grade spread, attendance, homework and sports charts.
- **Bursary (view only):** every finance page and report, no editing. Money is handled by the Bursar. Only the Administrator can read the **Audit trail** of everything the Bursar has changed.
- **Pupils:** bulk import from Excel/CSV and year-end promotion (Bursary → Students). Administrator only.
- **Compare Classes:** every class side by side for a term: pupils marked, average mark and grade, change since the term before, attendance, the top pupil, a bar chart, and the average in each learning area (darker green = higher). Printable, with CSV.
- **Grade 7 Exams:** record the mark (0–100) and unit (1–9) each Grade 7 pupil was given in each learning area of the Grade 7 examination, by year. The page totals each pupil's marks and units and shows, for each learning area, how many pupils got each unit. It records and compares; **it does not decide who has passed**, because the official rule could not be confirmed. Also available to the Grade 7 teacher (and only to them).
- **Results, Report Cards, Timetable, Notices, Quizzes, Sports, Student Stats:** see and manage across all classes. The Administrator also publishes the timetable and archives finished terms.
- **Admin Panel:** Users, Classes, Subjects (the curriculum learning areas), **School details and logo**, **Grading and marks**, **Passwords** (forgotten-password requests), and **Database** (download, restore, browser).
- **Appearance:** the four looks.

### Teacher (one class each)

- **Dashboard:** class overview.
- **Register:** daily attendance — each pupil is marked Present, Absent, Late or Excused.
- **Results:** a mark sheet per learning area, term and year (project title + Project, Test and Exam marks with the grade and unit shown as you type), and a list of every mark entered to filter, print, download and correct.
- **Report Cards:** for any pupil in the class, with a teacher's comment.
- **Homework, Quizzes, Courses, Notices:** for their own class; homework can be marked with a grade and feedback; quizzes are marked automatically.
- **Timetable:** propose lessons for the class (published by the Administrator).
- **Student Stats:** progress, attendance and homework of one pupil.
- **Grade 7 Exams (Grade 7 teacher only):** enter and print the examination marks and units of the Grade 7 pupils.

### Pupil

- **Dashboard, Results (with grade and unit), Report Cards, Timetable, My Attendance, Notices, Sports, Courses.**
- **Fees:** what has been billed and paid and what is owing, a statement for any dates, and printable receipts. (Payments are recorded by the Bursar.)
- **Homework:** hand in with a note or a photo. **Quizzes:** take each once and see the score at once.

### Parent

A parent logs in with their email address and sees the school **through one child at a time**: a card for each child on the home page (with what is owing), and a box at the top right to choose which child every page shows. They can open that child's **Results**, **Report Card** (printable), **Fees** (statement for any dates, every receipt printable), **Attendance**, **Timetable** and the school **Notices**. A parent can only look: every request is checked on the server against the pupils linked to their account, so another family's child, the staff pages and every editing function are refused.

The Administrator creates parent accounts in **Admin Panel → Parents**: name, email, the pupils they may see, and either a first password or none, in which case a temporary one is made and shown once and the parent must choose their own at first log in. Pupils can be linked and unlinked at any time. A forgotten password is handled in the **Passwords** tab like everyone else's, and **Close** (Users tab) stops a parent logging in. Parents have their own downloadable manual.

### Bursar (money only)

See the **Bursary** section above.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 with TypeScript; each page is loaded only when someone opens it (a pupil never downloads the Bursary pages, and the charts library is fetched only by pages with charts) |
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
| **PDF Generation** | pdfkit (receipts, invoices, statements, vouchers and the user manuals — pure JS, no browser/Chromium dependency) |
| **Excel Import/Export** | exceljs (pure JS) |
| **Picture capture for manuals** | playwright-core + Google Chrome (development only) |
| **Hosting** | Render (free tier) |

---

## Emailed backups

The portal can email a backup to you, so a copy always exists somewhere other than the portal's own computer. About once a day (and whenever the Administrator presses **Admin Panel → Database → Backups → Email me a backup now**) it sends:

* **one email with the whole database**, as the plain `.db` file that **Restore Database** accepts (zipped only if it grows over 15 MB), and
* **the uploaded files** (homework, payment proofs, the logo) that are **new since the last email**, zipped, in as many further emails as it takes (each stays under 15 MB, because a mail message may not be over 25 MB). Only new files are sent, so a normal day's email is small. A school with only the two starting accounts is not emailed automatically.

An emailed copy counts as a downloaded backup, so the dashboard stops asking for one while the emails keep arriving. If sending fails, the Backups panel shows why in plain words, and the dashboard reminder returns after a week.

**Setting it up with Gmail** (the sending account can be the same as the receiving one):

1. In the Gmail account that will send, switch on **2-Step Verification** (myaccount.google.com → Security).
2. Make an **App Password** at myaccount.google.com/apppasswords (call it "School portal") and copy the 16 letters. Gmail refuses the normal password here.
3. In Render → Environment add: `BACKUP_EMAIL_TO` = `punhamasiwa@gmail.com`, `SMTP_HOST` = `smtp.gmail.com`, `SMTP_USER` = the sending Gmail address, `SMTP_PASS` = the App Password. (`SMTP_PORT` defaults to 465, which is what Gmail wants.)
4. Save, wait for the redeploy, then press **Email me a backup now** to test.

**It needs a paid Render instance.** Render's free web services block outgoing email on ports 25, 465 and 587 ([Render's notice](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)). Any mail server works, not only Gmail.

**Restoring:** use the `.db` from the newest email in **Restore Database**. The portal has no button to put the uploaded files back; unzip them into the portal's `uploads` folder (on Render: the disk, under `DATA_DIR`).

**Keep those emails private.** They hold children's records, fee details and (scrambled) passwords. Protect that mailbox with 2-Step Verification, and do not forward the emails. `npm run test:email` checks all of this against a pretend mail server; it has not been tried against real Gmail.

---

## Off-site backup to GitHub

The portal can keep an **encrypted copy of the whole database in a private GitHub repository** and **bring the school back by itself** when its host loses the disk. It is free, works on Render's free plan (where every redeploy, restart and sleep wipes the disk), and is a second safety net on a paid plan with a disk.

**What it does**

* About every minute, **only if something changed**, it takes a consistent copy of the database from memory, compresses it, **encrypts it** (AES-256-GCM, with a key made from your passphrase) and puts it on a branch of your private repository. When Render stops the portal for a redeploy it makes one last upload first.
* When the portal **starts and has no database file**, it downloads the latest copy, decrypts and checks it, and puts it in place **before the database is opened**. The log says `Off-site backup: the database was missing, so it was restored from the off-site copy`.
* A database that is **already there is never touched or replaced**, and no network is needed to start.
* **If a restore is needed but fails** (GitHub unreachable, wrong passphrase, damaged file) the portal **refuses to start** and says why. Starting with an empty school would, a minute later, replace your good copy with the empty one. The very first start, when nothing has been backed up yet, is normal and starts empty.
* A school that holds only the two starting accounts is never uploaded. A **public** repository is refused.
* It is switched off completely unless all three settings below exist. If only some are set, or a name has a dash instead of an underscore (the host silently ignores those), the log says so by name.

**What is in the copy, and what is not.** The database: pupils, teachers, parents, marks, fees, payments, notices, the audit trail, the settings (passwords are stored scrambled, as always). **Not** the uploaded files (homework pictures, payment proofs, the logo): the emailed backups carry those ("Emailed backups" above). The log in secret is not in it either, so after a restore people may have to log in again once.

### Setting it up (once)

1. **A private repository.** On github.com: **+ → New repository**. Give it a name such as `school-portal-backups`, choose **Private**, tick **Add a README file** (the repository needs a first branch to make the backup branch from), **Create**.
2. **A token that can touch only that repository.** GitHub → your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Name it `school portal backup`. **Repository access: Only select repositories** → the repository from step 1. **Permissions → Repository permissions → Contents: Read and write**. Choose an expiry (a long one; write the date in your diary, see "When it stops working" below). Generate and copy the token (it starts `github_pat_`; GitHub shows it only once).
3. **A passphrase.** Make up a long phrase, for example five unrelated words and a number. **Write it on paper and keep it somewhere safe, with someone you trust as well.** Without it no copy can ever be read again: nobody can recover it, and that includes whoever built this portal.
4. **Tell the host.** On Render: your service → **Environment → Add Environment Variable**, three times (the names use **underscores**):

   | Name | Value |
   |------|-------|
   | `BACKUP_GITHUB_TOKEN` | the token from step 2 |
   | `BACKUP_GITHUB_REPO` | `your-github-name/school-portal-backups` |
   | `BACKUP_PASSPHRASE` | the passphrase from step 3 |

   Save. Render redeploys. Optional: `BACKUP_BRANCH` (default `data-backup`), `BACKUP_FILE` (default `snapshot.bin`), `BACKUP_INTERVAL_MS` (default `60000`, see "Limits").
5. **Check it.** In Render → **Logs**, look for `Off-site backup is ON`. Once the school holds some data (more than the two starting accounts) and a minute has passed, the log says `Off-site backup: uploaded ... KB`, and on GitHub the repository has a branch **`data-backup`** with a file `snapshot.bin` (unreadable, as it should be).

### Test a restore (do this once, before you need it)

* **The safe check, which changes nothing:** on your own computer, in `backend/`, with the same three settings, run `npm run backup:check`. It downloads the latest copy, decrypts it and prints what is inside, for example `The database inside is healthy ... It holds: 1 admin, 1 bursary, 9 teacher, 90 student ...`. A wrong passphrase prints `BACKUP_PASSPHRASE is not the phrase it was made with`. In PowerShell:

  ```powershell
  cd backend
  $env:BACKUP_GITHUB_TOKEN = 'github_pat_...'; $env:BACKUP_GITHUB_REPO = 'you/school-portal-backups'; $env:BACKUP_PASSPHRASE = 'your phrase'
  npm run backup:check
  ```
* **The whole thing, on your own computer:** start the portal with the same three settings and `DATA_DIR` set to a **new empty folder** (never your real one). It prints `restored from the off-site copy` and your school is there. Look, then stop it without changing anything: a portal with the settings uploads its changes to the same repository.
* **The automatic test:** `npm run test:backup` checks every part against a pretend GitHub (encryption and the wrong passphrase, upload and download, the schedule and the last upload, every way a restore can fail, a portal that refuses to start, and a complete redeploy: start, change something, delete the whole disk, start on an empty one, and the data is back).

**Last resort.** If the off-site copy ever cannot be used, **Admin Panel → Database → Download a backup now** and **Restore Database** (a downloaded or emailed `.db` file) still work.

### When it stops working, and limits

* **The token expires** on the date you chose, and then uploads fail (`Off-site backup FAILED ... 401`). The log shows each problem once, not every minute, so look at the Render log now and then. If the disk is lost while the token is expired, the portal refuses to start; put a fresh token in `BACKUP_GITHUB_TOKEN` and it restores. The data is still on GitHub.
* **Every upload is one commit** on the branch, and old ones are kept by GitHub. A busy school day can make hundreds of uploads of a few hundred KB each. Keep the repository comfortably under 1 GB: for a larger school raise `BACKUP_INTERVAL_MS` (`600000` is ten minutes), and every few months, while the portal is healthy, delete the `data-backup` branch in GitHub (after downloading a backup); the portal makes it again at the next change.
* **Only one portal** should use one repository and branch. Two portals would overwrite each other's copy.
* This has been tested against a pretend GitHub (`npm run test:backup`), **not against github.com itself**. Do the first test above with your real token before you rely on it.

---

## Deploying (Render)

`render.yaml` describes the service: it builds the frontend (`npm install` in `backend/` runs the build), starts the backend, and asks Render to make a private random `JWT_SECRET`. **Deploying is something you do from your Render account; this project is not connected to one from here.** In outline:

### Keeping your data: the permanent disk (do this once)

Render's **free** web service has temporary storage: its files, including the database and everything uploaded, are erased on every redeploy, every restart and every time it goes to sleep after 15 minutes without a visitor. A **paid** instance can have a **persistent disk**, which keeps its files. The portal keeps everything it must not lose (the database, its daily copies, uploaded homework and payment proofs, the school logo) in **one folder, `DATA_DIR`**, so all you do is point that folder at the disk.

For a service you made by hand in the Render dashboard (the existing one):

1. Open the service → **Settings → Instance Type** → choose a paid type (for example *Starter*). See [render.com/pricing](https://render.com/pricing) for the price. The free type cannot have a disk.
2. **Disks → Add Disk**: name `school-data`, **Mount Path** `/var/data`, size **1 GB** is plenty (disks cost [$0.25 per GB per month](https://render.com/pricing)).
3. **Environment → Add Environment Variable**: `DATA_DIR` = `/var/data` (exactly the mount path, or the data is lost again).
4. Save. Render redeploys. The first start on the new disk is an empty database: log in as the Administrator (`punhamasiwa@gmail.com` / `1234`) and the Bursar (`tascarmasiwa@gmail.com` / `12345678`), choose your own passwords, then **Restore Database** if you have a downloaded backup.
5. Check it worked: the Administrator's dashboard must **not** show a red "This portal is on temporary storage" message. Then make a small change (for example add a notice), use **Manual Deploy → Restart** in Render, and confirm the change is still there.

A service created from `render.yaml` (New → Blueprint) already has the paid instance, the disk and `DATA_DIR` set. Two limits of a Render disk: only one copy of the portal can run, and a redeploy takes the portal offline for a short moment.

The disk protects against restarts and redeploys, **not** against a mistake or the host losing the disk itself, so keep downloading a backup every week (the dashboard reminds the Administrator) and keep it somewhere other than the portal.

### Deploying

1. **Back up first.** In the portal go to **Admin Panel → Database → Download a backup now**. (Without the disk above, every deploy starts from an *empty* database and you must **Restore Database** afterwards.)
2. Put this project in the Git repository your Render service watches and push, or create a service from `render.yaml` (New → Blueprint).
3. Optional: in Render → Environment add `JWT_SECRET` (a long random value; the name needs an **underscore**, not a dash; `render.yaml` does this only when the service is created from it as a Blueprint, **not** for a service created by hand). If it is missing the portal is still safe, because on a host it never uses the public fallback in the source code. With the permanent disk (the section above) it makes a secret of its own once and keeps it in `jwt-secret` beside the database (never inside a backup, and never served), so log ins survive restarts and the log says `Log in secret: …`. Without a permanent disk it makes a new random secret at each start, so everyone is logged out whenever it restarts, and the Administrator sees a red notice on the dashboard. A `JWT_SECRET` setting always wins over the kept one (the kept file is then ignored, and everyone logs in again once).
4. Open the live address. On a brand-new database the first log in to the Administrator (`punhamasiwa@gmail.com` / `1234`) and the Bursar (`tascarmasiwa@gmail.com` / `12345678`) makes each choose their own password. Do both straight away.
5. Optional: add `SMS_WEBHOOK_URL` (and `SMS_WEBHOOK_TOKEN`) for automatic text messages.

`npm run test:production` rehearses a deployment on your own computer (built pages served by the backend, empty database, host-style settings) before you try the real thing.

---

## Important Notes

- **⚠ Render's free tier has temporary storage.** The database file and every upload are wiped on every redeploy, every restart **and every time the free service goes to sleep after 15 minutes without a visitor** ([Render's free-tier rules](https://render.com/docs/free)), which silently erases **real** pupils, teachers, invoices, payments and marks, leaving only the Administrator/Bursar accounts and the class list. Use a paid instance with a persistent disk and set `DATA_DIR` (see "Keeping your data" above). The Administrator's dashboard shows a red warning for as long as the portal is on a host without it. On the free tier the only protection is a downloaded backup (**Admin Panel → Database → Download a backup now**, daily) and **Restore Database** after each wipe, or the automatic encrypted copy on GitHub described in "Off-site backup to GitHub", which restores the database by itself (not the uploaded files).
- **Restore Database** replaces everything with the file you choose. It first checks the file really is a backup of this portal (anything else is refused and nothing changes), and it saves what the portal held just before as `school_portal-<date>-before-restore-<time>.db` in the backup list, so restoring the wrong file can be undone by downloading that copy and restoring it. *(Before 2026-10-31 this button reported success but did not actually restore anything on a running portal; it does now, and `npm run test:production` checks it.)*
- The Administrator (**1234**) and Bursar (**12345678**) passwords above are first-login credentials. Change both before real use.
- The portal is in English only.
