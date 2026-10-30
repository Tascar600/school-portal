import { RoleManual } from '../types';

export const parent: RoleManual = {
  role: 'parent',
  roleLabel: 'Parent',
  who: 'For parents and guardians: your child’s results and report card, school fees and receipts, attendance, timetable and notices.',
  sampleLogin: { email: 'parent.moyo@chakari.school', password: 'Parent@123', landing: '/dashboard' },
  pages: [
    {
      id: 'home', title: 'Your home page: your children', route: '/dashboard',
      intro: 'After you log in you see one card for each child of yours at the school, with what is owing on their fees. If you have more than one child, the box at the top right chooses which child every other page shows.',
      callouts: [
        { target: '.grid .card >> nth=0', press: 'A child’s card', does: 'Their name, class and registration number, and whether fees are owing, in credit or fully paid.', kind: 'area' },
        { target: 'button:text-is("Fees and receipts") >> nth=0', press: 'Fees and receipts', does: 'Opens this child’s fee statement and receipts.', kind: 'primary' },
        { target: 'button:text-is("Report card") >> nth=0', press: 'Report card', does: 'Opens this child’s report card for the term.', kind: 'default' },
        { target: 'select[aria-label="Child"]', press: 'Child: (name)', does: 'Choose which child you are looking at. Every page then shows that child. With only one child this shows just their name.', kind: 'field' },
      ],
      tasks: [{ title: 'look at your other child', steps: ['Click the box at the top right that starts with "Child:".', 'Choose the other child’s name.', 'Every page now shows that child. The portal remembers your choice next time.'] }],
      tips: ['You can only look. Parents cannot change anything in the portal; if something is wrong, tell the school office.'],
    },
    {
      id: 'results', title: 'Results', route: '/results',
      intro: 'Your child’s marks for every learning area, term by term. Each line shows their School-Based Project, Test and Exam marks, the total out of 100, the grade and the unit.',
      callouts: [
        { target: '.card h2 >> nth=0', press: 'The term heading', does: 'Each block of results is one term of one year.', kind: 'area' },
        { target: 'th:has-text("Total /100")', press: 'Total /100', does: 'The project, test and exam marks added together.', kind: 'area' },
        { target: 'th:has-text("Grade")', press: 'Grade', does: 'A is the best. The unit (1 to 9) is shown beside it; Unit 1 is the best.', kind: 'area' },
        { target: 'tfoot', press: 'Average', does: 'The average of the six compulsory learning areas, with its grade.', kind: 'area' },
        { target: 'button:has-text("Print")', press: 'Print', does: 'Prints the results on the school letterhead.', kind: 'primary' },
      ],
      tips: ['ICT and Robotics is an extra subject. It is shown, but it is not counted in the average.'],
    },
    {
      id: 'reportcards', title: 'Report card', route: '/report-cards',
      intro: 'The report for the term, ready to print: marks, grades and units, position in class, attendance and the teachers’ comments. It opens on the latest term that has marks.',
      callouts: [
        { target: 'label:text-is("Term") + select', press: 'Term and Year', does: 'Choose which term’s report you want to see.', kind: 'field' },
        { target: '.rc-info', press: 'Your child’s details', does: 'Name, class, position in class and attendance.', kind: 'area' },
        { target: '.rc-table', press: 'The marks table', does: 'All the learning areas with marks, grade and unit.', kind: 'area' },
        { target: 'button:has-text("Print")', press: 'Print', does: 'Prints the report card to keep.', kind: 'primary' },
      ],
      tasks: [{ title: 'print a report card', steps: ['Choose the child (top right) if you have more than one.', 'Open "Report Cards" and choose the term.', 'Press "Print", then choose your printer or "Save as PDF".'] }],
    },
    {
      id: 'fees', title: 'Fees and receipts', route: '/fees',
      intro: 'What the school has billed, what has been paid and what is left, with the dates. You can print a statement for any dates and every receipt.',
      callouts: [
        { target: '.kpi >> nth=0', press: 'Fees owing / Fully paid', does: 'What is still owing today for this child. "Fully paid" means nothing is owing.', kind: 'area' },
        { target: '.period-bar input >> nth=0', press: 'From / To', does: 'Choose the dates for the statement below.', kind: 'field' },
        { target: 'button:text-is("Statement (PDF)")', press: 'Statement (PDF)', does: 'Opens a printable statement with the school’s bank details.', kind: 'primary' },
        { target: 'button:text-is("Print receipt") >> nth=0', press: 'Print receipt', does: 'Opens one of the receipts to print or save.', kind: 'default' },
      ],
      tasks: [{ title: 'get a receipt', steps: ['Open "Fees" and look at the list of payments.', 'Press "Print receipt" beside the payment you want.', 'The receipt opens. Print it, or save it as a PDF.'] }],
      tips: ['If a payment is missing or the balance looks wrong, take your receipt to the bursar. Only the bursar can change money records.'],
    },
    {
      id: 'attendance', title: 'Attendance', route: '/register',
      intro: 'Your child’s register: the days they were present, absent, late or excused.',
      callouts: [{ target: 'table >> nth=0', press: 'Attendance', does: 'One line for each school day with the status.', kind: 'area' }],
    },
    {
      id: 'timetable', title: 'Timetable', route: '/timetable',
      intro: 'Your child’s class timetable for the week: subject, teacher, time and room.',
      callouts: [{ target: 'table >> nth=0', press: 'A day’s lessons', does: 'Start and end times, the subject and who teaches it.', kind: 'area' }],
    },
    {
      id: 'notices', title: 'Notices', route: '/notices',
      intro: 'Messages from the school to everyone, and to pupils.',
      callouts: [{ target: 'h3 >> nth=0', press: 'A notice', does: 'The title, who wrote it, the date and the message.', kind: 'area' }],
    },
  ],
  quick: [
    { job: 'See what I owe', where: 'Home or Fees', how: 'Read the card, or open "Fees" for the full statement.' },
    { job: 'Print a receipt', where: 'Fees', how: '"Print receipt" beside the payment.' },
    { job: 'Print a report card', where: 'Report Cards', how: 'Choose the term → "Print".' },
    { job: 'Look at my other child', where: 'Top right', how: 'The "Child:" box → choose the name.' },
    { job: 'Change my password', where: 'Top right', how: 'Press "Password".' },
  ],
  faqs: [
    { q: 'I cannot log in.', a: 'Check your email for typing mistakes and that Caps Lock is off. If you have forgotten your password press "Forgot your password?" on the log in page, then tell the school office so they can give you a temporary one.' },
    { q: 'It says "No pupil is linked to your account".', a: 'The school office has to link your child to your account. Ask them; it takes a minute.' },
    { q: 'My other child is not in the list.', a: 'The office links each child separately. Ask them to link the missing child to your account.' },
    { q: 'The report card says no marks have been entered.', a: 'The teacher has not entered the marks for that term yet. Try an earlier term, or ask the class teacher.' },
    { q: 'The amount owing is wrong.', a: 'Take your receipts to the bursar. Only the bursar can correct fees, and they will fix it if there is a mistake.' },
  ],
  glossary: [
    { term: 'Learning area', meaning: 'A subject, such as Mathematics or English Language.' },
    { term: 'School-Based Project', meaning: 'A practical project the child does in each learning area. It gives their Project mark.' },
    { term: 'Grade and unit', meaning: 'A is the best grade and Unit 1 is the best unit. Both come from the total mark out of 100.' },
    { term: 'Position in class', meaning: 'Where the child is among their classmates, from the average of the six compulsory learning areas.' },
    { term: 'Statement', meaning: 'A dated list of everything billed and paid, with the balance after each line.' },
  ],
};
