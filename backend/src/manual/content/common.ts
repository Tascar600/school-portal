import { ManualPage, Role } from '../types';

export const ROLE_INTRO: Record<Role, string> = {
  bursary: 'The Bursar looks after the school’s money: fees coming in, bills going out, and the cash and bank accounts. Everything here has a date. You can look at any period you like, print it on the school letterhead, and open the full history of any pupil.',
  admin: 'The Administrator runs the whole portal: people and classes, the timetable, results and report cards, notices, and the school’s settings. The bursary pages are shown to you for checking only; you cannot change money records.',
  teacher: 'Teachers run their own class: the daily register, marks under the Heritage-Based Curriculum, report cards, homework, quizzes, the timetable, courses and notices.',
  student: 'Pupils can see their own results and report card, their homework and quizzes, their timetable and attendance, and their school fees.',
  parent: 'Parents and guardians can see how their children are doing at school: results and report cards, school fees and receipts, attendance, the timetable and notices. You can only look; nothing can be changed from a parent account.',
};

const LAYOUT_MAP = (extra: string): ManualPage => ({
  id: 'layout',
  title: 'Finding your way around',
  route: '__landing__',
  intro: 'Every page has the same top bar. The menu below it lists the pages you can use. ' + extra,
  callouts: [
    { target: '.nav-brand', press: 'School crest and name', does: 'Click it from any page to return to your home page.', kind: 'area' },
    { target: '.nav-links', press: 'The menu', does: 'One link for each page you can use. The page you are on is underlined in gold.', kind: 'area' },
    { target: 'button:has-text("Download Manual")', press: 'Download Manual', does: 'Gives you this manual as a PDF, written for your kind of account. It is on every page.', kind: 'primary' },
    { target: 'select[aria-label="Appearance"]', press: 'Appearance', does: 'Choose how the portal looks: Default (follows your computer), White, Dark or Extra dark.', kind: 'field' },
    { target: '.nav-user .who', press: 'Your name and account type', does: 'Check that you are logged in as yourself.', kind: 'area' },
    { target: 'a:has-text("Password")', press: 'Password', does: 'Change your password. Do this at once if you think someone else knows it.', kind: 'default' },
    { target: 'button:has-text("Log out")', press: 'Log out', does: 'Leaves the portal. Always do this on a shared computer.', kind: 'default' },
  ],
  tasks: [
    { title: 'Change how the portal looks', steps: ['Find the box that says "Appearance" at the top right.', 'Click it and choose Default, White, Dark or Extra dark.', 'The whole portal changes at once, and the portal remembers your choice next time.'] },
    { title: 'Print any page', steps: ['Look for the green "Print" button near the top of the page and press it.', 'The printing window opens. Every printed page gets the school crest, the school name, a border and the date.', 'Choose your printer, or choose "Save as PDF" to keep a copy.'] },
  ],
});

export function commonPages(role: Role): ManualPage[] {
  const needsActivation = role === 'student' || role === 'teacher';
  const pages: ManualPage[] = [
    {
      id: 'details',
      title: 'Your login details',
      route: '', noImage: true,
      intro: 'These are the details you use to log in. They are filled in for you automatically.',
      callouts: [],
      warnings: ['Your password is never printed in this manual or shown anywhere in the portal. Do not write it on this page.'],
    },
    {
      id: 'login',
      title: 'Logging in',
      route: '/login',
      intro: 'Open the portal in a web browser (Chrome, Edge or Firefox) using the portal address above. You will see the log in page.',
      callouts: [
        { target: '#email', press: 'Email address', does: 'Type the email address shown under "Your login details".', kind: 'field' },
        { target: '#password', press: 'Password', does: 'Type your password. The letters appear as dots so nobody can read them over your shoulder.', kind: 'field' },
        { target: 'button:text-is("Log in")', press: 'Log in', does: 'Checks your details and takes you to your home page.', kind: 'primary' },
        { target: 'a:has-text("Forgot your password?")', press: 'Forgot your password?', does: 'Asks the school administrator to give you a new one. See the next pages.', kind: 'link' },
        { target: 'a:has-text("registration number")', press: 'I have a registration number', does: needsActivation ? 'For your first visit only: creates your account. See the next page.' : 'Used by teachers and pupils on their first visit.', kind: 'link' },
      ],
      tasks: [{ title: 'log in', steps: ['Open the portal address in your browser.', 'Click the "Email address" box and type your email.', 'Click the "Password" box and type your password.', 'Press the green "Log in" button (or press the Enter key).', 'If it says "Invalid credentials", check for a spelling mistake and that Caps Lock is off, then try again.'] }],
      tips: ['If you have typed your password wrongly several times, wait a few minutes and try again, or use "Forgot your password?".'],
    },
  ];
  if (needsActivation) {
    pages.push({
      id: 'activate',
      title: role === 'teacher' ? 'First time: activating your teacher account' : 'First time: activating your pupil account',
      route: '/activate',
      intro: 'The school office creates your name in the portal and gives you a registration number (it starts with ' + (role === 'teacher' ? '"t"' : '"c"') + ' and ends with the same letter). You use it once, to choose your own email and password.',
      callouts: [
        { target: '#reg', press: 'Registration number', does: 'Type the number the school gave you, exactly as written.', kind: 'field' },
        { target: '#em', press: 'Email address', does: 'Choose the email you will log in with. Use one you can always get to.', kind: 'field' },
        { target: '#pw', press: 'Choose a password', does: 'At least 8 characters, with both letters and numbers. Only you should know it.', kind: 'field' },
        { target: 'button:text-is("Activate")', press: 'Activate', does: 'Creates your account and logs you in straight away.', kind: 'primary' },
      ],
      tasks: [{ title: 'activate your account', steps: ['On the log in page press "I have a registration number".', 'Type your registration number, your email and a password you will remember.', 'Press "Activate". You go straight to your home page.', 'From now on, log in with your email and password. You never need the registration number to log in again.'] }],
      warnings: ['A registration number works only once. If it says "Account already activated", someone has used it: tell the office at once.'],
    });
  }
  if (role === 'parent') {
    pages.push({
      id: 'firstlogin',
      title: 'First time: how you get your login',
      route: '', noImage: true,
      intro: 'The school office creates your parent account, links it to your child (or children) and gives you the email address to log in with and a first password. If the password is a temporary one (a code like Kx7m-4821-Qpr), the portal asks you to choose your own the first time you log in.',
      callouts: [],
      tasks: [{ title: 'choose your own password the first time', steps: ['Log in with the email and the temporary password the office gave you.', 'The portal shows "Choose your own password". Type the temporary password, then your new one twice.', 'Wait until all four lines have a tick, then press "Save new password".', 'You go to your home page. From now on log in with your new password.'] }],
      warnings: ['Never share your password, even with the school. The office never needs it. If you think someone knows it, change it at once (see the next pages).'],
    });
  }
  pages.push(
    {
      id: 'password',
      title: 'Changing your password',
      route: '/change-password',
      intro: 'Change your password whenever you like, and straight away if you think someone else knows it. It takes half a minute.',
      callouts: [
        { target: 'a:has-text("Password")', press: 'Password (top right)', does: 'Opens this page from anywhere in the portal.', kind: 'default' },
        { target: '#cur', press: 'Current password', does: 'Type the password you use now (or the temporary one the administrator gave you).', kind: 'field' },
        { target: '#new', press: 'New password', does: 'Type the new one: at least 8 characters, with letters and numbers.', kind: 'field' },
        { target: '#conf', press: 'Type the new password again', does: 'Type it a second time so a typing mistake is caught.', kind: 'field' },
        { target: 'form ul', press: 'The ticks list', does: 'Each line turns green with a tick when you have met that rule. All four must be ticked.', kind: 'area' },
        { target: 'button:text-is("Save new password")', press: 'Save new password', does: 'Changes your password and logs out every other device that was using the old one.', kind: 'primary' },
      ],
      tasks: [{ title: 'change your password', steps: ['Press "Password" at the top right of any page.', 'Type your current password, then the new one twice.', 'Wait until all four lines have a tick.', 'Press "Save new password". You stay logged in on this computer.'] }],
      warnings: ['If you suspect someone knows your password, change it NOW. Anyone who was logged in as you on another computer or phone is logged out the moment you save.'],
    },
    {
      id: 'forgot',
      title: 'Forgot your password?',
      route: '/forgot-password',
      intro: role === 'admin'
        ? 'Another administrator can give you a temporary password (Admin Panel, then Users, then Reset password). If you are the only administrator and cannot log in, whoever looks after the portal can reset it from the server; see the last page of this manual.'
        : 'The portal does not email passwords. Instead you ask the school administrator, who gives you a temporary password. You then choose a new one of your own.',
      callouts: [
        { target: '#identifier', press: 'Email address or registration number', does: 'Type the email you log in with, or your registration number.', kind: 'field' },
        { target: 'button:text-is("Ask for a new password")', press: 'Ask for a new password', does: 'Tells the administrator that you need help. Nothing else happens until they act.', kind: 'primary' },
        { target: 'a:text-is("Back to log in")', press: 'Back to log in', does: 'Returns to the log in page.', kind: 'link' },
      ],
      tasks: [
        { title: 'get back in when you have forgotten your password', steps: ['On the log in page press "Forgot your password?".', 'Type your email address or registration number and press "Ask for a new password".', 'Tell the school office or your teacher that you asked, so they can check it is really you.', 'The administrator gives you a temporary password (a code like Kx7m-4821-Qpr).', 'Log in with it. The portal immediately asks you to choose your own password. Do that, and you are back in.'] },
      ],
      tips: ['A temporary password stops working as soon as you change it, and it cannot be used by anyone else once you have chosen your own.'],
    },
    LAYOUT_MAP(role === 'bursary' ? 'The bursar’s menu is the whole bursary: one link for each job.' : role === 'admin' ? 'The Bursary link opens the money pages in view-only mode.' : role === 'parent' ? 'Your home page shows a card for each of your children. If you have more than one, the box at the top right chooses which child every page shows.' : 'Your home page shows the main things you need today.'),
  );
  return pages;
}
