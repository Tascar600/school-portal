import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { PrintButton, DownloadCSV } from '../components/PrintDownload';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [tab, setTab] = useState<'users' | 'classes' | 'subjects' | 'db'>('users');
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

  // DB browser
  const [dbBrowseTable, setDbBrowseTable] = useState('');
  const [dbBrowseRows, setDbBrowseRows] = useState<any[]>([]);
  const [dbBrowseCols, setDbBrowseCols] = useState<string[]>([]);
  const [dbBrowseLoading, setDbBrowseLoading] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [dbError, setDbError] = useState('');
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [dbRestoreFile, setDbRestoreFile] = useState<File | null>(null);

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
        <button className="btn btn-primary" onClick={() => { setTab('users'); setEditUserId(null); setUserForm({ name: '', email: '', password: '', role: 'student', class_id: '' }); }}>+ Add User</button>
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
        <button className={`btn ${tab === 'db' ? 'btn-primary' : ''}`} onClick={() => { setTab('db'); if (!dbInfo) adminApi.dbInfo().then(r => setDbInfo(r.data)).catch(() => setDbInfo(null)); }}> Database</button>
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <>
          <div className="card">
            <h2>{editUserId ? 'Edit User' : 'Create User'}</h2>
            <form onSubmit={handleUserSubmit}>
              <div className="form-row">
                <div><label>Name</label><input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required /></div>
                <div><label>Email {userForm.role !== 'admin' && <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>(optional — student uses reg number)</span>}</label><input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required={userForm.role === 'admin'} /></div>
              </div>
              <div className="form-row">
                <div><label>Password {editUserId ? '(leave blank to keep)' : userForm.role !== 'admin' ? '(optional — user activates with reg number)' : ''}</label><input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editUserId && userForm.role === 'admin'} /></div>
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
            <input placeholder="Search by name, email, or reg number..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ marginBottom: '0.5rem', width: '100%' }} />
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Class</th><th>Student #</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {users.filter((u: any) => {
                  if (!userSearch) return true;
                  const q = userSearch.toLowerCase();
                  return (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.student_number||'').toLowerCase().includes(q);
                }).map((u: any) => (
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
            <input placeholder="Search class name..." value={classSearch} onChange={e => setClassSearch(e.target.value)} style={{ marginBottom: '0.5rem', width: '100%' }} />
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Grade</th><th>Section</th><th>Actions</th></tr></thead>
              <tbody>
                {classes.filter((c: any) => !classSearch || (c.name||'').toLowerCase().includes(classSearch.toLowerCase())).map((c: any) => (
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

      {/* Database Tab */}
      {tab === 'db' && (
        <div>

          <div className="card">
            <h2>Database Status</h2>
            {dbInfo ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                  <div className="stat-card"><h3>{(dbInfo.sizeBytes / 1024).toFixed(1)} KB</h3><p>Size</p></div>
                  <div className="stat-card"><h3>{new Date(dbInfo.lastModified).toLocaleString()}</h3><p>Last Modified</p></div>
                  <div className="stat-card"><h3>{dbInfo.tables?.length || 0}</h3><p>Tables</p></div>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {dbInfo.tables?.map((t: string) => (
                    <span key={t} style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem' }}>
                      {t}: {dbInfo.rowCounts?.[t] || 0}
                    </span>
                  ))}
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '1rem' }}>
                  ⚠ On Render free tier, the database resets on every deploy. Use the backup tools below.
                </p>
              </div>
            ) : <p style={{ color: 'var(--text-dim)' }}>Loading...</p>}
          </div>

          <div className="card">
            <h2>Download Backup</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Download the entire SQLite database file. Keep this file safe — you can restore it later.</p>
            <button className="btn btn-primary" onClick={async () => {
              try {
                const r = await adminApi.dbExport();
                const url = URL.createObjectURL(new Blob([r.data]));
                const a = document.createElement('a');
                a.href = url; a.download = 'school_portal.db';
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
              } catch (err: any) { setMsg(err.response?.data?.message || 'Download failed'); }
            }}> Download Database</button>
          </div>

          <div className="card">
            <h2>Restore Backup</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Upload a previously downloaded .db file to restore your data. This replaces ALL current data.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!dbRestoreFile) { setMsg('Select a .db file first'); return; }
              const fd = new FormData();
              fd.append('database', dbRestoreFile);
              try {
                await adminApi.dbRestore(fd);
                setMsg('Database restored! Refresh the page to see changes.');
                setDbRestoreFile(null);
                adminApi.dbInfo().then(r => setDbInfo(r.data)).catch(() => {});
              } catch (err: any) { setMsg(err.response?.data?.message || 'Restore failed'); }
            }}>
              <input type="file" accept=".db,.sqlite,.sqlite3" onChange={e => setDbRestoreFile(e.target.files?.[0] || null)} required />
              <button type="submit" className="btn btn-danger" style={{ marginTop: '0.5rem' }}>Restore Database</button>
            </form>
          </div>

          <div className="card">
            <h2> Database Browser</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Click any table to view its data visually.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {dbInfo?.tables?.filter((t: string) => !t.startsWith('sqlite_')).map((t: string) => {
                const cnt = dbInfo.rowCounts?.[t] || 0;
                const barW = Math.min(100, Math.max(10, cnt * 5));
                const colors = ['#60a5fa','#4ade80','#fbbf24','#f87171','#a78bfa','#fb923c','#22d3ee','#e879f9'];
                const ci = dbInfo.tables?.indexOf(t) % colors.length;
                return (
                  <button key={t} onClick={async () => {
                    setDbBrowseTable(t); setDbBrowseLoading(true); setDbError(''); setDbSearch('');
                    try {
                      const res = await adminApi.executeSQL(`SELECT * FROM "${t}"`);
                      if (res.data.rows?.length > 0) {
                        setDbBrowseCols(Object.keys(res.data.rows[0]));
                        setDbBrowseRows(res.data.rows);
                      } else { setDbBrowseCols([]); setDbBrowseRows([]); }
                    } catch (e: any) { setDbError(e.message); setDbBrowseCols([]); setDbBrowseRows([]); }
                    finally { setDbBrowseLoading(false); }
                  }} style={{
                    background: dbBrowseTable === t ? `${colors[ci]}33` : 'rgba(255,255,255,0.04)',
                    border: dbBrowseTable === t ? `1px solid ${colors[ci]}` : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '0.6rem 0.8rem', cursor: 'pointer',
                    textAlign: 'left', minWidth: 130, flex: '1 0 auto', color: '#fff',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: colors[ci] }}>{t}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{cnt}</div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ width: `${barW}%`, height: '100%', background: colors[ci], borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 2 }}>rows</div>
                  </button>
                );
              })}
            </div>
            {dbError && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{dbError}</p>}
            {dbBrowseLoading && <p style={{ color: 'var(--text-dim)' }}>Loading...</p>}
            {dbBrowseTable && !dbBrowseLoading && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--neon)', fontWeight: 600, fontSize: '0.95rem' }}>
                    {dbBrowseTable} <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '0.8rem' }}>{dbBrowseRows.length} rows</span>
                  </span>
                  {dbBrowseRows.length > 0 && (
                    <input type="text" placeholder="Filter rows..." value={dbSearch} onChange={e => setDbSearch(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0.3rem 0.6rem', color: '#fff', fontSize: '0.8rem', width: 200 }} />
                  )}
                </div>
                {dbBrowseRows.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>Empty table.</p> : (
                  <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                    <table style={{ fontSize: '0.78rem', width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>{dbBrowseCols.map(c => <th key={c} style={{
                          background: 'rgba(15,15,30,0.95)', padding: '0.4rem 0.6rem',
                          borderBottom: '2px solid rgba(96,165,250,0.3)', whiteSpace: 'nowrap'
                        }}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {dbBrowseRows.filter(r => {
                          if (!dbSearch) return true;
                          const q = dbSearch.toLowerCase();
                          return dbBrowseCols.some(c => String(r[c]).toLowerCase().includes(q));
                        }).map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            {dbBrowseCols.map(c => {
                              const v = row[c];
                              const isNum = typeof v === 'number';
                              const isBool = typeof v === 'boolean';
                              return (
                                <td key={c} style={{
                                  padding: '0.3rem 0.6rem', maxWidth: 250, overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  color: v === null ? '#555' : isNum ? '#fbbf24' : '#e2e8f0',
                                  fontFamily: isNum ? 'monospace' : 'inherit',
                                  borderBottom: '1px solid rgba(255,255,255,0.04)'
                                }}>
                                  {v === null ? <span style={{ fontStyle: 'italic', fontSize: '0.7rem' }}>NULL</span>
                                    : isBool ? (v ? '✓' : '✗')
                                    : String(v).length > 80 ? String(v).slice(0, 80) + '…' : String(v)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
            <input placeholder="Search subject name..." value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} style={{ marginBottom: '0.5rem', width: '100%' }} />
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Teacher</th><th>Actions</th></tr></thead>
              <tbody>
                {subjects.filter((s: any) => !subjectSearch || (s.name||'').toLowerCase().includes(subjectSearch.toLowerCase())).map((s: any) => (
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
