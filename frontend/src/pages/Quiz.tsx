import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { quizApi } from '../services/api';

export default function Quiz() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [viewAttemptId, setViewAttemptId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  // Quiz creation form
  const [form, setForm] = useState({ class_id: '', subject_id: '', title: '', description: '', duration_minutes: '10', questions: [{ question: '', options: ['', '', '', ''], correct_answer: '' }] });

  const load = () => {
    if (user?.role === 'teacher') quizApi.my().then(r => setQuizzes(r.data));
    else if (user?.role === 'student') quizApi.available().then(r => setQuizzes(r.data));
    else if (user?.role === 'admin') quizApi.my().then(r => setQuizzes(r.data)); // fallback
  };

  useEffect(() => { load(); }, [user]);

  const addQuestion = () => {
    setForm({ ...form, questions: [...form.questions, { question: '', options: ['', '', '', ''], correct_answer: '' }] });
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const qs = [...form.questions];
    (qs as any)[idx][field] = value;
    setForm({ ...form, questions: qs });
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const qs = [...form.questions];
    qs[qIdx].options[oIdx] = value;
    setForm({ ...form, questions: qs });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await quizApi.create({ ...form, duration_minutes: parseInt(form.duration_minutes) });
      setMsg('Quiz created');
      setForm({ class_id: '', subject_id: '', title: '', description: '', duration_minutes: '10', questions: [{ question: '', options: ['', '', '', ''], correct_answer: '' }] });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const startQuiz = async (quiz: any) => {
    if (quiz.attempts && quiz.attempts.length > 0) {
      setMsg('You have already attempted this quiz');
      return;
    }
    try {
      const res = await quizApi.getQuestions(quiz.id);
      setActiveQuiz(res.data.quiz);
      setQuestions(res.data.questions);
      setAnswers({});
      setResult(null);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    const ans = questions.map(q => ({ question_id: q.id, selected_answer: answers[q.id] || '' }));
    try {
      const res = await quizApi.attempt(activeQuiz.id, { answers: ans });
      setResult(res.data);
      setActiveQuiz(null);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const viewAttempts = async (quizId: number) => {
    try {
      const res = await quizApi.attempts(quizId);
      setAttempts(res.data);
      setViewAttemptId(quizId);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: number) => {
    try { await quizApi.delete(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <h1>Quizzes</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      {/* Teacher: Create Quiz */}
      {user?.role === 'teacher' && (
        <div className="card">
          <h2>Create Quiz</h2>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div><label>Class ID</label><input value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} required /></div>
              <div><label>Subject ID</label><input value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required /></div>
              <div><label>Duration (min)</label><input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            </div>
            <label>Quiz Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

            <h3>Questions</h3>
            {form.questions.map((q, qi) => (
              <div key={qi} className="question-card">
                <label>Question {qi + 1}</label>
                <input value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} required />
                {q.options.map((opt, oi) => (
                  <div key={oi} className="option-row">
                    <span>{String.fromCharCode(65 + oi)}.</span>
                    <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} required />
                  </div>
                ))}
                <label>Correct Answer (text)</label>
                <input value={q.correct_answer} onChange={e => updateQuestion(qi, 'correct_answer', e.target.value)} required />
              </div>
            ))}
            <button type="button" className="btn" onClick={addQuestion}>+ Add Question</button>
            <div style={{ marginTop: '1rem' }}><button type="submit" className="btn btn-primary">Create Quiz</button></div>
          </form>
        </div>
      )}

      {/* Quiz list */}
      <div className="card">
        <h2>{user?.role === 'student' ? 'Available Quizzes' : 'My Quizzes'}</h2>
        {quizzes.length === 0 ? <p>No quizzes available.</p> : (
          <table>
            <thead><tr><th>Title</th><th>Subject</th><th>{user?.role === 'student' ? '' : 'Class'}</th><th>Duration</th><th>Actions</th></tr></thead>
            <tbody>
              {quizzes.map((q: any) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{q.subject_name}</td>
                  {user?.role !== 'student' && <td>{q.class_name}</td>}
                  <td>{q.duration_minutes} min</td>
                  <td>
                    {user?.role === 'student' && (!q.attempts || q.attempts.length === 0) && (
                      <button className="btn btn-primary btn-sm" onClick={() => startQuiz(q)}>Take Quiz</button>
                    )}
                    {user?.role === 'student' && q.attempts && q.attempts.length > 0 && (
                      <span className="alert-success" style={{ padding: '2px 8px', borderRadius: 4 }}>
                        Score: {q.attempts[0].score}/{q.attempts[0].total}
                      </span>
                    )}
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => viewAttempts(q.id)}>Attempts</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(q.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Active quiz attempt */}
      {activeQuiz && (
        <div className="modal-overlay" onClick={() => setActiveQuiz(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2>{activeQuiz.title}</h2>
            <p style={{ color: '#666' }}>Duration: {activeQuiz.duration_minutes} minutes</p>
            {questions.map((q, i) => (
              <div key={q.id} className="question-card">
                <p><strong>{i + 1}. {q.question}</strong></p>
                {JSON.parse(q.options).map((opt: string, oi: number) => (
                  <label key={oi} style={{ display: 'block', margin: '0.3rem 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`q${q.id}`}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                    /> {String.fromCharCode(65 + oi)}. {opt}
                  </label>
                ))}
              </div>
            ))}
            <button className="btn btn-primary" onClick={submitQuiz}>Submit Quiz</button>
          </div>
        </div>
      )}

      {/* Quiz result */}
      {result && (
        <div className="card">
          <h2>Quiz Result</h2>
          <div className="stat-card">
            <h3>{result.score}/{result.total}</h3>
            <p>Score</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: result.score >= result.total / 2 ? '#2e7d32' : '#c62828' }}>
              {result.score >= result.total / 2 ? 'PASSED' : 'FAILED'}
            </p>
          </div>
        </div>
      )}

      {/* Attempts modal */}
      {viewAttemptId && (
        <div className="modal-overlay" onClick={() => setViewAttemptId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Quiz Attempts</h2>
            {attempts.length === 0 ? <p>No attempts yet.</p> : (
              <table>
                <thead><tr><th>Student</th><th>Score</th><th>Date</th></tr></thead>
                <tbody>
                  {attempts.map((a: any) => (
                    <tr key={a.id}>
                      <td>{a.student_name}</td>
                      <td>{a.score}/{a.total}</td>
                      <td>{new Date(a.attempted_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn" onClick={() => setViewAttemptId(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
