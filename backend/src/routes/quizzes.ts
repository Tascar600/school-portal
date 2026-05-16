import { Router, Response } from 'express';
import { query, execute } from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Teacher: create quiz
router.post('/', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { class_id, subject_id, title, description, duration_minutes, questions } = req.body;
    const quizResult = await execute(
      'INSERT INTO quizzes (class_id, subject_id, teacher_id, title, description, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)',
      [class_id, subject_id, req.user!.id, title, description || '', duration_minutes || 10]
    );
    const quizId = quizResult.insertId;

    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        await execute(
          'INSERT INTO quiz_questions (quiz_id, question, options, correct_answer) VALUES (?, ?, ?, ?)',
          [quizId, q.question, JSON.stringify(q.options), q.correct_answer]
        );
      }
    }
    res.status(201).json({ message: 'Quiz created', quizId });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Teacher: get their quizzes
router.get('/my', authenticate, authorize('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const quizzes = await query<any[]>(
      `SELECT q.*, s.name AS subject_name, c.name AS class_name FROM quizzes q
       JOIN subjects s ON s.id = q.subject_id
       JOIN classes c ON c.id = q.class_id
       WHERE q.teacher_id = ?
       ORDER BY q.created_at DESC`,
      [req.user!.id]
    );
    res.json(quizzes);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Student: get available quizzes for their class
router.get('/available', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await query<any[]>('SELECT class_id FROM users WHERE id = ?', [req.user!.id]);
    const classId = student[0]?.class_id;
    if (!classId) {
      res.json([]);
      return;
    }
    const quizzes = await query<any[]>(
      `SELECT q.id, q.title, q.description, q.duration_minutes, s.name AS subject_name
       FROM quizzes q JOIN subjects s ON s.id = q.subject_id
       WHERE q.class_id = ?
       ORDER BY q.created_at DESC`,
      [classId]
    );
    // Check if already attempted
    for (const quiz of quizzes) {
      const attempts = await query<any[]>(
        'SELECT id, score, total, attempted_at FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?',
        [quiz.id, req.user!.id]
      );
      quiz.attempts = attempts;
    }
    res.json(quizzes);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Student: get quiz questions for attempt
router.get('/:id/questions', authenticate, authorize('student', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const questions = await query<any[]>(
      'SELECT id, question, options FROM quiz_questions WHERE quiz_id = ?',
      [req.params.id]
    );
    const quiz = await query<any[]>('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
    res.json({ quiz: quiz[0], questions });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Student: submit quiz attempt
router.post('/:id/attempt', authenticate, authorize('student'), async (req: AuthRequest, res: Response) => {
  try {
    const { answers } = req.body; // [{ question_id, selected_answer }]
    const quizId = parseInt(req.params.id);

    const questions = await query<any[]>('SELECT id, correct_answer FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    let score = 0;
    const total = questions.length;
    const answersMap = new Map(answers.map((a: any) => [a.question_id, a.selected_answer]));

    for (const q of questions) {
      const selected = answersMap.get(q.id);
      if (selected === q.correct_answer) {
        score++;
      }
    }

    const attemptResult = await execute(
      'INSERT INTO quiz_attempts (quiz_id, student_id, score, total) VALUES (?, ?, ?, ?)',
      [quizId, req.user!.id, score, total]
    );
    const attemptId = attemptResult.insertId;

    for (const q of questions) {
      const selected = answersMap.get(q.id) || '';
      const isCorrect = selected === q.correct_answer;
      await execute(
        'INSERT INTO quiz_answers (attempt_id, question_id, selected_answer, is_correct) VALUES (?, ?, ?, ?)',
        [attemptId, q.id, selected, isCorrect]
      );
    }

    res.json({ attemptId, score, total, message: 'Quiz submitted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Teacher/Admin: view quiz attempts
router.get('/:id/attempts', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const attempts = await query<any[]>(
      `SELECT qa.*, u.name AS student_name FROM quiz_attempts qa
       JOIN users u ON u.id = qa.student_id
       WHERE qa.quiz_id = ?
       ORDER BY qa.attempted_at DESC`,
      [req.params.id]
    );
    res.json(attempts);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Teacher: delete quiz
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    await execute('DELETE FROM quizzes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Quiz deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
