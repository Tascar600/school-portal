import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [tab, setTab] = useState<'users' | 'classes' | 'subjects'>('users');
  const [msg, setMsg] = useState('');
  const [quickAddForm, setQuickAddForm] = useState({ first_name: '', last_name: '', role: 'student', class_id: '' });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [lastRegNumber, setLastRegNumber] = useState('');

  // User form
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'student', class_id: '' });
  const [editUserId, setEditUserId] = useState<number | null>(null);

  // Class form
  const [classForm, setClassForm] = useState({ name: '', grade: '', section: '' });
  const [editClassId, setEditClassId] = useState<number | null>(null);

  // Subject form
  const [subjectForm, setSubjectForm] = useState({ name: '', class_id: '' });

  const load = () => {
    adminApi.users().then(r => setUsers(r.data)).catch(() => {});
    adminApi.classes().then(r => setClasses(r.data)).catch(() => {});
    adminApi.subjects().then(r => setSubjects(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // User CRUD
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editUserId) {
        await adminApi.updateUser(editUserId, { name: userForm.name, email: userForm.email, role: userForm.role, class_id: userForm.class_id ? parseInt(userForm.class_id) : null });
      } else {
        await adminApi.createUser(userForm);
      }
      setMsg(editUserId ? 'User updated' : 'User created');
      setEditUserId(null);
      setUserForm({ name: '', email: '', password: '', role: 'student', class_id: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const editUser = (u: any) => {
    setEditUserId(u.id);
    setUserForm({ name: u.name, email: u.email, password: '', role: u.role, class_id: u.class_id || '' });
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Delete user?')) return;
    try { await adminApi.deleteUser(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Class CRUD
  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editClassId) {
        await adminApi.updateClass(editClassId, classForm);
      } else {
        await adminApi.createClass(classForm);
      }
      setMsg(editClassId ? 'Class updated' : 'Class created');
      setEditClassId(null);
      setClassForm({ name: '', grade: '', section: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const editClass = (c: any) => {
    setEditClassId(c.id);
    setClassForm({ name: c.name, grade: c.grade, section: c.section });
  };

  const deleteClass = async (id: number) => {
    if (!confirm('Delete class?')) return;
    try { await adminApi.deleteClass(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  // Subject CRUD
  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createSubject(subjectForm);
      setMsg('Subject created');
      setSubjectForm({ name: '', class_id: '' });
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const deleteSubject = async (id: number) => {
    if (!confirm('Delete subject?')) return;
    try { await adminApi.deleteSubject(id); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  const csvData = users.map(u => ({
    'ID': u.id,
    'Name': u.name,
    'Email': u.email,
    'Role': u.role,
    'Class': u.class_name || '-',
    'Student #': u.student_number || '-',
    'Active': u.is_active ? 'Yes' : 'No'
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Admin Control Panel</h1>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <PrintButton />
          <DownloadCSV data={csvData} headers={['ID', 'Name', 'Email', 'Role', 'Class', 'Student #', 'Active']} filename="users.csv" label=" CSV" />
        </div>
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}

      {/* Quick Stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card"><h3>{users.filter((u: any) => u.role === 'student').length}</h3><p>Students</p></div>
        <div className="stat-card"><h3>{users.filter((u: any) => u.role === 'teacher').length}</h3><p>Teachers</p></div>
        <div className="stat-card"><h3>{classes.length}</h3><p>Classes</p></div>
        <div className="stat-card"><h3>{subjects.length}</h3><p>Subjects</p></div>
      </div>

      {/* Quick Add Student */}
      <div className="card" style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <strong>Quick Actions:</strong>
        <button className="btn btn-success" onClick={() => { setQuickAddForm({ first_name: '', last_name: '', role: 'student', class_id: '' }); setShowQuickAdd(!showQuickAdd); }}>+ Add Student</button>
        <button className="btn btn-info" onClick={() => { setQuickAddForm({ first_name: '', last_name: '', role: 'teacher', class_id: '' }); setShowQuickAdd(!showQuickAdd); }}>+ Add Teacher</button>
        <button className="btn btn-primary" onClick={() => { setTab('users'); document.querySelector('input[name="email"]')?.scrollIntoView(); }}>+ Add User</button>
        <button className="btn" onClick={() => setTab('classes')}>+ Add Class</button>
      </div>

      {showQuickAdd && (
        <div className="card" style={{ border: '2px solid ' + (quickAddForm.role === 'student' ? '#2e7d32' : '#0891b2') }}>
          <h2>Quick Add {quickAddForm.role === 'student' ? 'Student' : 'Teacher'}</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await adminApi.createUser({
                first_name: quickAddForm.first_name,
                last_name: quickAddForm.last_name,
                role: quickAddForm.role,
                class_id: quickAddForm.role === 'student' ? parseInt(quickAddForm.class_id) : undefined
              });
              const num = res.data?.reg_number || '';
              setLastRegNumber(num);
              const fullName = (quickAddForm.first_name + ' ' + quickAddForm.last_name).trim();
              const label = quickAddForm.role === 'student' ? 'Student' : 'Teacher';
              setMsg(`${fullName || label} created! Reg Number: ${num}`);
              setQuickAddForm({ first_name: '', last_name: '', role: 'student', class_id: '' });
              setShowQuickAdd(false);
              adminApi.users().then(r => setUsers(r.data));
            } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
          }}>
            <div className="form-row">
              <div><label>First Name</label><input value={quickAddForm.first_name} onChange={e => setQuickAddForm({ ...quickAddForm, first_name: e.target.value })} required /></div>
              <div><label>Last Name</label><input value={quickAddForm.last_name} onChange={e => setQuickAddForm({ ...quickAddForm, last_name: e.target.value })} required /></div>
              {quickAddForm.role === 'student' && (
                <div><label>Class</label><select value={quickAddForm.class_id} onChange={e => setQuickAddForm({ ...quickAddForm, class_id: e.target.value })} required><option value="">— Select Class —</option>{classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              )}
            </div>
            <button type="submit" className="btn btn-success">Generate Reg Number</button>
            <button type="button" className="btn" onClick={() => setShowQuickAdd(false)}>Cancel</button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <button className={`btn ${tab === 'users' ? 'btn-primary' : ''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`btn ${tab === 'classes' ? 'btn-primary' : ''}`} onClick={() => setTab('classes')}>Classes</button>
        <button className={`btn ${tab === 'subjects' ? 'btn-primary' : ''}`} onClick={() => setTab('subjects')}>Subjects</button>
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <>
          <div className="card">
            <h2>{editUserId ? 'Edit User' : 'Create User'}</h2>
            <form onSubmit={handleUserSubmit}>
              <div className="form-row">
                <div><label>Name</label><input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required /></div>
                <div><label>Email</label><input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required /></div>
              </div>
              <div className="form-row">
                <div><label>Password {editUserId && '(leave blank to keep)'}</label><input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editUserId} /></div>
                <div><label>Role</label><select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></div>
                <div><label>Class</label>
                  {userForm.role === 'student' ? (
                    <select value={userForm.class_id} onChange={e => setUserForm({ ...userForm, class_id: e.target.value })} required>
                      <option value="">— Select Class —</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input value={userForm.class_id} onChange={e => setUserForm({ ...userForm, class_id: e.target.value })} placeholder="optional" />
                  )}
                </div>
              </div>
              <button type="submit" className="btn btn-primary">{editUserId ? 'Update' : 'Create'} User</button>
              {editUserId && <button type="button" className="btn" onClick={() => { setEditUserId(null); setUserForm({ name: '', email: '', password: '', role: 'student', class_id: '' }); }}>Cancel</button>}
            </form>
          </div>

          <div className="card">
            <h2>All Users ({users.length})</h2>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Class</th><th>Student #</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`alert-${u.role === 'admin' ? 'error' : u.role === 'teacher' ? 'info' : 'success'}`} style={{ padding: '2px 8px', borderRadius: 4 }}>{u.role}</span></td>
                    <td>{u.class_name || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.student_number || '-'}</td>
                    <td>{u.is_active ? '✓' : '✗'}</td>
                    <td>
                      <button className="btn btn-warning btn-sm" onClick={() => editUser(u)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Classes Tab */}
      {tab === 'classes' && (
        <>
          <div className="card">
            <h2>{editClassId ? 'Edit Class' : 'Create Class'}</h2>
            <form onSubmit={handleClassSubmit}>
              <div className="form-row">
                <div><label>Class Name</label><input value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} required /></div>
                <div><label>Grade</label><input value={classForm.grade} onChange={e => setClassForm({ ...classForm, grade: e.target.value })} required /></div>
                <div><label>Section</label><input value={classForm.section} onChange={e => setClassForm({ ...classForm, section: e.target.value })} /></div>
              </div>
              <button type="submit" className="btn btn-primary">{editClassId ? 'Update' : 'Create'} Class</button>
              {editClassId && <button type="button" className="btn" onClick={() => { setEditClassId(null); setClassForm({ name: '', grade: '', section: '' }); }}>Cancel</button>}
            </form>
          </div>

          <div className="card">
            <h2>All Classes</h2>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Grade</th><th>Section</th><th>Actions</th></tr></thead>
              <tbody>
                {classes.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                    <td>{c.grade}</td>
                    <td>{c.section}</td>
                    <td>
                      <button className="btn btn-warning btn-sm" onClick={() => editClass(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteClass(c.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Subjects Tab */}
      {tab === 'subjects' && (
        <>
          <div className="card">
            <h2>Create Subject</h2>
            <form onSubmit={handleSubjectSubmit}>
              <div className="form-row">
                <div><label>Subject Name</label><input value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} required /></div>
                <div><label>Class</label><select value={subjectForm.class_id} onChange={e => setSubjectForm({ ...subjectForm, class_id: e.target.value })} required><option value="">— Select Class —</option>{classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Teacher is auto-assigned from the class teacher.</p>
              <button type="submit" className="btn btn-primary">Create Subject</button>
            </form>
          </div>

          <div className="card">
            <h2>All Subjects</h2>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Teacher</th><th>Actions</th></tr></thead>
              <tbody>
                {subjects.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.name}</td>
                    <td>{s.class_name}</td>
                    <td>{s.teacher_name}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => deleteSubject(s.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
