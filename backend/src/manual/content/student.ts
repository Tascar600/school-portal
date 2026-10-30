import { RoleManual } from '../types';

export const student: RoleManual = {
  role: 'student',
  roleLabel: 'Pupil',
  who: 'For pupils: your results and report card, homework and quizzes, timetable, attendance and school fees.',
  sampleLogin: { email: 'nyasha.chuma4@chakari.school', password: 'Student@123', landing: '/dashboard' },
  pages: [
    {
      id: 'results', title: 'My results', route: '/results',
      intro: 'Your marks for every learning area, term by term. Each line shows your School-Based Project, Test and Exam marks, the total out of 100, your grade and your unit.',
      callouts: [
        { target: '.card h2 >> nth=0', press: 'The term heading', does: 'Each block of results is one term of one year.', kind: 'area' },
        { target: 'th:has-text("Total /100")', press: 'Total /100', does: 'Your project, test and exam marks added together.', kind: 'area' },
        { target: 'th:has-text("Grade")', press: 'Grade', does: 'A is the best. The unit (1 to 9) is shown beside it; Unit 1 is the best.', kind: 'area' },
        { target: 'tfoot', press: 'Average', does: 'The average of the six compulsory learning areas, with its grade.', kind: 'area' },
        { target: 'button:has-text("Print")', press: 'Print', does: 'Prints your results on the school letterhead.', kind: 'primary' },
      ],
      tips: ['ICT and Robotics is an extra subject. It is shown, but it is not counted in your average.'],
    },
    {
      id: 'reportcards', title: 'My report card', route: '/report-cards',
      intro: 'Your report for the term, ready to print: marks, grades, your position in class, your attendance and your teacher’s comment.',
      callouts: [
        { target: 'label:text-is("Term") + select', press: 'Term and Year', does: 'Choose which term’s report you want to see.', kind: 'field' },
        { target: '.rc-info', press: 'Your details', does: 'Your name, class, position in class and attendance.', kind: 'area' },
        { target: '.rc-table', press: 'The marks table', does: 'All your learning areas with marks, grade and unit.', kind: 'area' },
        { target: 'button:has-text("Print")', press: 'Print', does: 'Prints the report card to take home.', kind: 'primary' },
      ],
    },
    {
      id: 'fees', title: 'My school fees', route: '/fees',
      intro: 'What the school has billed, what has been paid, and what is left, with the dates. You can print your statement and any receipt.',
      callouts: [
        { target: '.kpi >> nth=0', press: 'Fees owing / Fully paid', does: 'What is still owed today. "Fully paid" means nothing is owing.', kind: 'area' },
        { target: '.period-bar input >> nth=0', press: 'From / To', does: 'Choose the dates for the statement below.', kind: 'field' },
        { target: 'button:text-is("Statement (PDF)")', press: 'Statement (PDF)', does: 'Opens a printable statement with the school bank details.', kind: 'primary' },
        { target: 'button:text-is("Print receipt") >> nth=0', press: 'Print receipt', does: 'Opens one of your receipts to print.', kind: 'default' },
      ],
      tips: ['If a payment is missing or a balance looks wrong, ask your parent to speak to the bursar with their receipt.'],
    },
    {
      id: 'timetable', title: 'Timetable', route: '/timetable',
      intro: 'Your class’s lessons for the week: subject, teacher, time and room.',
      callouts: [
        { target: 'h1', press: 'Timetable', does: 'Lessons are grouped by day, in time order.', kind: 'area' },
        { target: 'table >> nth=0', press: 'A day’s lessons', does: 'Start and end times, the subject and who teaches it.', kind: 'area' },
      ],
    },
    {
      id: 'homework', title: 'Homework', route: '/homework',
      intro: 'Homework from your teachers, with the date it is due. You hand it in here, with a note or a photo of your work.',
      callouts: [
        { target: 'h3 >> nth=0', press: 'Homework title', does: 'The task, the subject and when it is due.', kind: 'area' },
        { target: 'textarea >> nth=0', press: 'Notes (optional)', does: 'Type your answer, or a message to your teacher.', kind: 'field' },
        { target: 'input[type=file] >> nth=0', press: 'Choose File', does: 'Attach a photo or a PDF of your work (up to 10 MB).', kind: 'field' },
        { target: 'button:text-is("Submit") >> nth=0', press: 'Submit', does: 'Hands in your homework. You can only hand in once, so check first.', kind: 'primary' },
      ],
      tasks: [{ title: 'hand in homework with a photo', steps: ['Find the homework and look at the due date.', 'Type a note if you wish.', 'Press "Choose File" and pick the photo.', 'Press "Submit". It then shows "Submitted" with the date.', 'Later your teacher’s mark and feedback appear on the same line.'] }],
      warnings: ['After the due date the form disappears and says "Past due date". Hand in on time.'],
    },
    {
      id: 'quizzes', title: 'Quizzes', route: '/quizzes',
      intro: 'Quizzes from your teachers. You take each one once and see your score straight away.',
      callouts: [
        { target: 'button:text-is("Take Quiz") >> nth=0', press: 'Take Quiz', does: 'Opens the questions in a window.', kind: 'primary' },
        { target: 'table', press: 'Your quizzes', does: 'After you have taken a quiz, your score such as 4/5 appears here instead of the button.', kind: 'area' },
      ],
      tasks: [{ title: 'take a quiz', steps: ['Press "Take Quiz".', 'Click the answer you think is right for each question.', 'Press "Submit Quiz".', 'You see your score and "Passed" or "Failed" at once.'] }],
      warnings: ['You can take a quiz only once. Read each question carefully before you press Submit.'],
    },
    {
      id: 'courses', title: 'Courses', route: '/courses',
      intro: 'Extra classes and clubs for your class, with the day and time.',
      callouts: [{ target: 'h1', press: 'My Courses', does: 'Each course shows its teacher, day and time.', kind: 'area' }],
    },
    {
      id: 'attendance', title: 'My attendance', route: '/register',
      intro: 'Your own register: the days you were present, absent, late or excused.',
      callouts: [
        { target: 'table >> nth=0', press: 'Your attendance', does: 'One line for each school day with your status.', kind: 'area' },
      ],
    },
    {
      id: 'notices', title: 'Notices', route: '/notices',
      intro: 'Messages from the school and your teachers.',
      callouts: [{ target: 'h3 >> nth=0', press: 'A notice', does: 'The title, who wrote it, the date and the message.', kind: 'area' }],
    },
    {
      id: 'sports', title: 'Sports', route: '/sports',
      intro: 'See the school’s sports and clubs and join the ones you like.',
      callouts: [
        { target: 'button:text-is("Join") >> nth=0', press: 'Join', does: 'Adds you to that sport. If it is full it will tell you.', kind: 'primary' },
        { target: 'button:text-is("View") >> nth=0', press: 'View', does: 'Shows who else has joined.', kind: 'default' },
      ],
    },
  ],
  quick: [
    { job: 'See my marks', where: 'Results', how: 'Open the page. Marks are listed by term.' },
    { job: 'Print my report card', where: 'Report Cards', how: 'Choose the term → "Print".' },
    { job: 'Hand in homework', where: 'Homework', how: 'Note or photo → "Submit".' },
    { job: 'Take a quiz', where: 'Quizzes', how: '"Take Quiz" → answers → "Submit Quiz".' },
    { job: 'See what I owe', where: 'Fees', how: 'Read the box at the top; "Statement (PDF)" to print.' },
    { job: 'Change my password', where: 'Top right', how: 'Press "Password".' },
  ],
  faqs: [
    { q: 'I cannot log in.', a: 'Check your email for typing mistakes and that Caps Lock is off. If you have forgotten your password press "Forgot your password?" on the log in page and tell your teacher.' },
    { q: 'My results are empty.', a: 'Your teacher has not entered the marks yet.' },
    { q: 'It says "Already submitted".', a: 'You can hand in homework only once. Ask your teacher if you must send it again.' },
    { q: 'I cannot take a quiz again.', a: 'Each quiz is taken once so the score is fair.' },
  ],
  glossary: [
    { term: 'Learning area', meaning: 'A subject, such as Mathematics or English Language.' },
    { term: 'School-Based Project', meaning: 'A practical project you do in each learning area. It gives you your Project mark.' },
    { term: 'Grade and unit', meaning: 'A is the best grade and Unit 1 is the best unit. Both come from your total mark out of 100.' },
    { term: 'Position in class', meaning: 'Where you are among your classmates, from the average of the six core learning areas.' },
  ],
};
