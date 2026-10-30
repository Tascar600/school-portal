// Heritage-Based Curriculum (2024–2030), primary level.
// Six compulsory learning areas, plus ICT and Robotics as a separate additional subject.
// Every learner does one School-Based Project (SBP) per learning area.

export interface LearningArea {
  name: string;
  core: boolean; // the six compulsory learning areas count towards the average and class position
}

export const LEARNING_AREAS: LearningArea[] = [
  { name: 'Indigenous Language', core: true },
  { name: 'English Language', core: true },
  { name: 'Mathematics', core: true },
  { name: 'Science and Technology', core: true },
  { name: 'Social Science', core: true },
  { name: 'Physical Education and Art', core: true },
  { name: 'ICT and Robotics', core: false },
];

export const CORE_AREA_NAMES = LEARNING_AREAS.filter((a) => a.core).map((a) => a.name);
export const ALL_AREA_NAMES = LEARNING_AREAS.map((a) => a.name);

// Names used before the curriculum restructure -> the learning area they belong to.
export const LEGACY_AREA_NAMES: Record<string, string> = {
  'ChiShona': 'Indigenous Language',
  'Chishona': 'Indigenous Language',
  'Shona': 'Indigenous Language',
  'IsiNdebele': 'Indigenous Language',
  'Ndebele': 'Indigenous Language',
  'Indigenous Languages': 'Indigenous Language',
  'English': 'English Language',
  'Maths': 'Mathematics',
  'Math': 'Mathematics',
  'Physical Education': 'Physical Education and Art',
  'Physical Education & Art': 'Physical Education and Art',
  'Physical Education and Arts': 'Physical Education and Art',
  'Art & Design': 'Physical Education and Art',
  'Art and Design': 'Physical Education and Art',
  'Art': 'Physical Education and Art',
  'Science & Technology': 'Science and Technology',
  'ICT': 'ICT and Robotics',
  'Sport': 'Physical Education and Art',
};

// Marks -> letter grade + unit. Edited by the Admin (Admin Panel > Grading Scale), stored as JSON in `settings`.
// These are school defaults: Unit 1 is the best and Unit 9 the lowest.
export interface GradeBand {
  min: number;       // lowest mark (out of 100) that earns this band
  grade: string;     // A, B, C, D, E or U
  unit: number;      // 1 (best) to 9
  descriptor: string;
}

export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { min: 90, grade: 'A', unit: 1, descriptor: 'Outstanding' },
  { min: 80, grade: 'A', unit: 2, descriptor: 'Excellent' },
  { min: 70, grade: 'B', unit: 3, descriptor: 'Very good' },
  { min: 60, grade: 'C', unit: 4, descriptor: 'Good' },
  { min: 50, grade: 'D', unit: 5, descriptor: 'Satisfactory' },
  { min: 40, grade: 'E', unit: 6, descriptor: 'Needs improvement' },
  { min: 30, grade: 'U', unit: 7, descriptor: 'Weak' },
  { min: 20, grade: 'U', unit: 8, descriptor: 'Very weak' },
  { min: 0, grade: 'U', unit: 9, descriptor: 'Ungraded' },
];

// Marks available for each part of a learning area; they add up to 100.
export interface AssessmentWeights { project: number; test: number; exam: number }
export const DEFAULT_WEIGHTS: AssessmentWeights = { project: 20, test: 20, exam: 60 };

export function gradeFor(mark: number, scale: GradeBand[]): GradeBand {
  const m = Math.round(mark);
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((b) => m >= b.min) || sorted[sorted.length - 1];
}

export function validateScale(scale: any): string | null {
  if (!Array.isArray(scale) || scale.length < 2) return 'The scale needs at least two bands';
  const mins = new Set<number>();
  for (const b of scale) {
    if (typeof b.min !== 'number' || b.min < 0 || b.min > 100) return 'Each band needs a lowest mark between 0 and 100';
    if (!b.grade || typeof b.grade !== 'string') return 'Each band needs a grade letter';
    if (!Number.isInteger(b.unit) || b.unit < 1 || b.unit > 9) return 'Each band needs a unit from 1 to 9';
    if (mins.has(b.min)) return `Two bands start at ${b.min}`;
    mins.add(b.min);
  }
  if (!mins.has(0)) return 'One band must start at 0 so every mark gets a grade';
  return null;
}
