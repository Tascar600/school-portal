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
  entered: (params?: any) => api.get('/results/entered', { params }),
  my: () => api.get('/results/my'),
  all: (params?: any) => api.get('/results/all', { params }),
  update: (id: number, data: any) => api.put(`/results/${id}`, data),
  delete: (id: number) => api.delete(`/results/${id}`),
  classSummary: (classId: number) => api.get(`/results/class-summary/${classId}`),
  subjectBreakdown: (classId: number) => api.get(`/results/subject-breakdown/${classId}`),
  studentStats: (studentId: number) => api.get(`/results/student-stats/${studentId}`),
  archiveTerm: (data: { term: string; academic_year: string }) => api.post('/results/archive-term', data),
  reportCard: (studentId: number, params?: any) => api.get(`/results/report-card/${studentId}`, { params }),
  students: () => api.get('/results/students'),
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

// Analytics (admin)
export const analyticsApi = {
  attendance: (classId: number) => api.get(`/admin/analytics/attendance/${classId}`),
  sports: (classId: number) => api.get(`/admin/analytics/sports/${classId}`),
  homework: (classId: number) => api.get(`/admin/analytics/homework/${classId}`),
};

// Themes
export const themeApi = {
  get: () => api.get('/themes'),
  update: (data: any) => api.put('/themes', data),
  list: () => api.get('/themes/list'),
};

// Finance: Terms
export const termsApi = {
  list: () => api.get('/terms'),
  current: () => api.get('/terms/current'),
  create: (data: { year: string; term_no: number; start_date?: string; end_date?: string }) => api.post('/terms', data),
  update: (id: number, data: any) => api.put(`/terms/${id}`, data),
  setCurrent: (id: number) => api.put(`/terms/${id}/set-current`),
  setLock: (id: number, locked: boolean) => api.put(`/terms/${id}/lock`, { locked }),
};

// Finance: Fee items & fee structure
export const feeItemsApi = {
  list: () => api.get('/fee-items'),
  create: (data: any) => api.post('/fee-items', data),
  update: (id: number, data: any) => api.put(`/fee-items/${id}`, data),
  deactivate: (id: number) => api.delete(`/fee-items/${id}`),
  structure: (termId: number) => api.get(`/fee-items/structure/${termId}`),
  setStructureAmount: (termId: number, classId: number, feeItemId: number, amount: number) =>
    api.put(`/fee-items/structure/${termId}/${classId}/${feeItemId}`, { amount }),
  copyStructure: (fromTermId: number, toTermId: number, percentChange?: number) =>
    api.post(`/fee-items/structure/${fromTermId}/copy-to/${toTermId}`, { percentChange }),
};

// Finance: Billing (run term billing, ad-hoc charges/credit notes)
export const billingApi = {
  run: (data: { term_id: number; class_id: number; date?: string }) => api.post('/billing/run', data),
  charge: (data: any) => api.post('/billing/charge', data),
  creditNote: (data: any) => api.post('/billing/credit-note', data),
};

// Finance: Invoices
export const invoicesApi = {
  list: (params?: any) => api.get('/invoices', { params }),
  my: () => api.get('/invoices/my'),
  get: (id: number) => api.get(`/invoices/${id}`),
  cancel: (id: number, reason: string) => api.put(`/invoices/${id}/cancel`, { reason }),
};

// Finance: Payments (Receive Payment + receipts)
export const paymentsApi = {
  list: (params?: any) => api.get('/payments', { params }),
  my: () => api.get('/payments/my'),
  get: (id: number) => api.get(`/payments/${id}`),
  record: (data: any) => api.post('/payments', data),
  reverse: (id: number, reason: string) => api.put(`/payments/${id}/reverse`, { reason }),
};

// Finance: Currencies (USD base + ZWG/ZiG and any others)
export const currenciesApi = {
  list: () => api.get('/currencies'),
  create: (data: { code: string; name: string; rate: number }) => api.post('/currencies', data),
  update: (code: string, data: { rate: number; active?: boolean }) => api.put(`/currencies/${code}`, data),
};

// Finance: Accounts (cash & bank), transfers, ledger
export const accountsApi = {
  list: () => api.get('/accounts'),
  create: (data: any) => api.post('/accounts', data),
  update: (id: number, data: any) => api.put(`/accounts/${id}`, data),
  deactivate: (id: number) => api.delete(`/accounts/${id}`),
  balance: (id: number, asOf?: string) => api.get(`/accounts/${id}/balance`, { params: asOf ? { as_of: asOf } : {} }),
  ledger: (id: number) => api.get(`/accounts/${id}/ledger`),
  transfer: (data: { tr_date: string; from_account: number; to_account: number; amount: number; reference?: string; notes?: string }) =>
    api.post('/accounts/transfer', data),
  deleteTransfer: (id: number) => api.delete(`/accounts/transfer/${id}`),
};

// Finance: Expense categories
export const expenseCategoriesApi = {
  list: () => api.get('/expense-categories'),
  create: (data: { name: string }) => api.post('/expense-categories', data),
  update: (id: number, data: any) => api.put(`/expense-categories/${id}`, data),
  deactivate: (id: number) => api.delete(`/expense-categories/${id}`),
};

// Finance: Expenses (payment vouchers)
export const expensesApi = {
  list: (params?: any) => api.get('/expenses', { params }),
  get: (id: number) => api.get(`/expenses/${id}`),
  create: (data: any) => api.post('/expenses', data),
  cancel: (id: number, reason: string) => api.put(`/expenses/${id}/cancel`, { reason }),
};

// Finance: Bank reconciliation
export const reconciliationApi = {
  unreconciled: (accountId: number, upTo?: string) => api.get(`/reconciliation/${accountId}/unreconciled`, { params: upTo ? { upTo } : {} }),
  save: (accountId: number, data: any) => api.post(`/reconciliation/${accountId}`, data),
  history: (accountId: number) => api.get(`/reconciliation/${accountId}/history`),
};

// Finance: Budgets
export const budgetsApi = {
  list: (termId: number) => api.get(`/budgets/${termId}`),
  set: (termId: number, categoryId: number, amount: number) => api.put(`/budgets/${termId}/${categoryId}`, { amount }),
  copy: (fromTermId: number, toTermId: number) => api.post(`/budgets/${fromTermId}/copy-to/${toTermId}`),
};

// Finance: Sponsors
export const sponsorsApi = {
  list: () => api.get('/sponsors'),
  create: (data: any) => api.post('/sponsors', data),
  update: (id: number, data: any) => api.put(`/sponsors/${id}`, data),
  deactivate: (id: number) => api.delete(`/sponsors/${id}`),
};

// Finance: Discounts
export const discountsApi = {
  list: () => api.get('/discounts'),
  create: (data: any) => api.post('/discounts', data),
  update: (id: number, data: any) => api.put(`/discounts/${id}`, data),
  deactivate: (id: number) => api.delete(`/discounts/${id}`),
};

// Finance: Student finance profiles (category, discount, sponsor, guardian info)
export const studentProfilesApi = {
  get: (studentId: number) => api.get(`/student-profiles/${studentId}`),
  update: (studentId: number, data: any) => api.put(`/student-profiles/${studentId}`, data),
};

// Finance: Reports
export const reportsApi = {
  daily: (date: string) => api.get('/reports/daily', { params: { date } }),
  collections: (termId: number) => api.get('/reports/collections', { params: { term_id: termId } }),
  feeItems: (termId: number) => api.get('/reports/fee-items', { params: { term_id: termId } }),
  debtors: () => api.get('/reports/debtors'),
  aged: (asOf: string) => api.get('/reports/aged', { params: { asOf } }),
  incomeExpenditure: (termId: number) => api.get('/reports/income-expenditure', { params: { term_id: termId } }),
  budget: (termId: number) => api.get('/reports/budget', { params: { term_id: termId } }),
  sponsors: (termId: number) => api.get('/reports/sponsors', { params: { term_id: termId } }),
  methods: (termId: number) => api.get('/reports/methods', { params: { term_id: termId } }),
  classList: (classId: number) => api.get('/reports/class-list', { params: { class_id: classId } }),
  exportXlsx: (reportKey: string, params: Record<string, any>) =>
    api.get(`/reports/${reportKey}/export.xlsx`, { params, responseType: 'blob' }),
};

// Finance: Messages / WhatsApp reminders
export const messagesApi = {
  list: (params?: any) => api.get('/messages', { params }),
  send: (data: { student_id?: number; phone: string; body: string; kind?: string }) => api.post('/messages', data),
  markSent: (id: number) => api.put(`/messages/${id}/sent`),
  bulkReminder: (data: { class_id?: number; min_balance?: number; template: string }) => api.post('/messages/bulk-reminder', data),
};

// Finance: Student roster — import/export/promotion
export const financeStudentsApi = {
  list: (params?: any) => api.get('/finance-students', { params }),
  exportXlsx: (params?: any) => api.get('/finance-students/export.xlsx', { params, responseType: 'blob' }),
  importPreview: (formData: FormData) =>
    api.post('/finance-students/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importConfirm: (data: { toCreate: any[]; toUpdate: any[] }) => api.post('/finance-students/import/confirm', data),
  promote: () => api.post('/finance-students/promote'),
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
  dbInfo: () => api.get('/admin/db/info'),
  dbExport: () => api.get('/admin/db/export', { responseType: 'blob' }),
  dbRestore: (formData: FormData) => api.post('/admin/db/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  executeSQL: (sql: string) => api.post('/admin/sql', { sql }),
};
