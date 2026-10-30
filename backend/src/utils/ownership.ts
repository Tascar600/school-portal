import { queryOne } from '../config/database';

// Class-teacher model: each teacher owns one class (users.class_id) and each student sits in one class.

export async function teacherOwnsClass(teacherId: number, classId: number): Promise<boolean> {
  return !!(await queryOne('SELECT 1 FROM users WHERE id = ? AND role = ? AND class_id = ?', [teacherId, 'teacher', classId]));
}

export async function studentInClass(studentId: number, classId: number): Promise<boolean> {
  return !!(await queryOne('SELECT 1 FROM users WHERE id = ? AND role = ? AND class_id = ?', [studentId, 'student', classId]));
}

export async function teacherTeachesStudent(teacherId: number, studentId: number): Promise<boolean> {
  return !!(await queryOne(
    `SELECT 1 FROM users t JOIN users s ON s.class_id = t.class_id
     WHERE t.id = ? AND t.role = 'teacher' AND s.id = ? AND s.role = 'student'`,
    [teacherId, studentId]
  ));
}
