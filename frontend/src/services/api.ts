import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Don't redirect on login/register 401s - let those pages handle errors
    const isAuthEndpoint = err.config?.url?.startsWith('/auth/');
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  activate: (data: { student_number: string; email: string; password: string }) => api.post('/auth/activate', data),
  me: () => api.get('/auth/me'),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// Fees
export const feesApi = {
  myAccounts: () => api.get('/fees/my'),
  pay: (formData: FormData) => api.post('/fees/pay', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  pending: () => api.get('/fees/pending'),
  verify: (paymentId: number, action: string) => api.put(`/fees/verify/${paymentId}`, { action }),
  accounts: () => api.get('/fees/accounts'),
  createAccount: (data: any) => api.post('/fees/accounts', data),
  teacherAccounts: () => api.get('/fees/accounts/my-students'),
};

// Timetables
export const timetableApi = {
  create: (data: any) => api.post('/timetables', data),
  my: () => api.get('/timetables/my'),
  all: () => api.get('/timetables/all'),
  getProposals: (classId: number) => api.get(`/timetables/proposals/${classId}`),
  update: (id: number, data: any) => api.put(`/timetables/${id}`, data),
  delete: (id: number) => api.delete(`/timetables/${id}`),
  getByClass: (classId: number) => api.get(`/timetables/class/${classId}`),
  publish: (classId: number) => api.post(`/timetables/publish/${classId}`),
  generate: (classId: number) => api.post(`/timetables/generate/${classId}`),
};

// Results
export const resultApi = {
  create: (data: any) => api.post('/results', data),
  entered: () => api.get('/results/entered'),
  my: () => api.get('/results/my'),
  all: () => api.get('/results/all'),
  update: (id: number, data: any) => api.put(`/results/${id}`, data),
  delete: (id: number) => api.delete(`/results/${id}`),
};

// Notices
export const noticeApi = {
  create: (data: any) => api.post('/notices', data),
  get: () => api.get('/notices'),
  delete: (id: number) => api.delete(`/notices/${id}`),
};

// Homework
export const homeworkApi = {
  create: (data: any) => api.post('/homework', data),
  myClasses: () => api.get('/homework/my-classes'),
  my: () => api.get('/homework/my'),
  submit: (homeworkId: number, formData: FormData) =>
    api.post(`/homework/submit/${homeworkId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submissions: (homeworkId: number) => api.get(`/homework/submissions/${homeworkId}`),
  grade: (submissionId: number, data: any) => api.put(`/homework/grade/${submissionId}`, data),
  delete: (id: number) => api.delete(`/homework/${id}`),
};

// Quizzes
export const quizApi = {
  create: (data: any) => api.post('/quizzes', data),
  my: () => api.get('/quizzes/my'),
  available: () => api.get('/quizzes/available'),
  getQuestions: (id: number) => api.get(`/quizzes/${id}/questions`),
  attempt: (id: number, data: any) => api.post(`/quizzes/${id}/attempt`, data),
  attempts: (id: number) => api.get(`/quizzes/${id}/attempts`),
  delete: (id: number) => api.delete(`/quizzes/${id}`),
};

// Subjects
export const subjectApi = {
  byClass: (classId: number) => api.get(`/subjects/class/${classId}`),
  studentsByClass: (classId: number) => api.get(`/subjects/students/${classId}`),
};

// Courses
export const courseApi = {
  create: (data: any) => api.post('/courses', data),
  my: () => api.get('/courses/my'),
  enrolled: () => api.get('/courses/enrolled'),
  getByClass: (classId: number) => api.get(`/courses/class/${classId}`),
  update: (id: number, data: any) => api.put(`/courses/${id}`, data),
  delete: (id: number) => api.delete(`/courses/${id}`),
};

// Attendance
export const attendanceApi = {
  mark: (data: any) => api.post('/attendance', data),
  get: (params?: any) => api.get('/attendance', { params }),
  my: () => api.get('/attendance/my'),
  students: (classId: number) => api.get(`/attendance/students/${classId}`),
};

// Sports
export const sportApi = {
  create: (data: any) => api.post('/sports', data),
  getAll: () => api.get('/sports'),
  join: (sportId: number) => api.post(`/sports/join/${sportId}`),
  leave: (sportId: number) => api.delete(`/sports/leave/${sportId}`),
  participants: (sportId: number) => api.get(`/sports/${sportId}/participants`),
  delete: (id: number) => api.delete(`/sports/${id}`),
};

// Voting
export const votingApi = {
  createSession: (data: any) => api.post('/voting/sessions', data),
  getSessions: () => api.get('/voting/sessions'),
  toggleStatus: (id: number, status: string) => api.put(`/voting/sessions/${id}/status`, { status }),
  getCandidates: (sessionId: number) => api.get(`/voting/sessions/${sessionId}/candidates`),
  nominate: (data: any) => api.post('/voting/nominate', data),
  vote: (data: any) => api.post('/voting/vote', data),
  deleteSession: (id: number) => api.delete(`/voting/sessions/${id}`),
};

// Themes
export const themeApi = {
  get: () => api.get('/themes'),
  update: (data: any) => api.put('/themes', data),
  list: () => api.get('/themes/list'),
};

// Admin
export const adminApi = {
  users: () => api.get('/admin/users'),
  createUser: (data: any) => api.post('/admin/users', data),
  updateUser: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  classes: () => api.get('/admin/classes'),
  createClass: (data: any) => api.post('/admin/classes', data),
  updateClass: (id: number, data: any) => api.put(`/admin/classes/${id}`, data),
  deleteClass: (id: number) => api.delete(`/admin/classes/${id}`),
  subjects: () => api.get('/admin/subjects'),
  createSubject: (data: any) => api.post('/admin/subjects', data),
  deleteSubject: (id: number) => api.delete(`/admin/subjects/${id}`),
};
