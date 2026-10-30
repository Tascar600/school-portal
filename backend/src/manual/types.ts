export type Role = 'admin' | 'bursary' | 'teacher' | 'student' | 'parent';

// How a control looks in the picture, so the manual can draw the same kind of "button" next to its explanation
export type Kind = 'primary' | 'default' | 'danger' | 'success' | 'field' | 'link' | 'area';

// Things the screenshot robot does before taking the picture (type in a box, open a tab, ...)
export interface Step { click?: string; fill?: [string, string]; select?: [string, string]; wait?: number }

export interface Callout {
  target: string;   // what to point at in the page (a Playwright selector)
  press: string;    // what the reader sees / presses, as written on the screen
  does: string;     // what it does
  kind?: Kind;
}

export interface Task { title: string; steps: string[] }

export interface ManualPage {
  id: string;
  title: string;
  route: string;          // which page to open for the picture
  steps?: Step[];
  intro: string;
  callouts: Callout[];
  tasks?: Task[];
  tips?: string[];
  warnings?: string[];
  image?: string;         // picture file name (without extension); default <role>-<id>
  noImage?: boolean;
  cropFrom?: string;      // start the picture at this element instead of the top of the page (for long pages)
}

export interface RoleManual {
  role: Role;
  roleLabel: string;
  who: string;            // one line: what this account is for
  pages: ManualPage[];    // the pages of this account, in menu order
  quick: { job: string; where: string; how: string }[];
  faqs: { q: string; a: string }[];
  glossary: { term: string; meaning: string }[];
  sampleLogin: { email: string; password: string; landing: string };  // used only by the screenshot robot, never printed
}
