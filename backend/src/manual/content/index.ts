import { Role, RoleManual } from '../types';
import { bursary } from './bursary';
import { admin } from './admin';
import { teacher } from './teacher';
import { student } from './student';
import { parent } from './parent';

export const MANUALS: Record<Role, RoleManual> = { bursary, admin, teacher, student, parent };
