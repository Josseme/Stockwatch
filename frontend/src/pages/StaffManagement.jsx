import React, { useState, useEffect } from 'react';
import {   Users, UserPlus, Shield, Clock, 
  CheckCircle, XCircle, BarChart2, Calendar,
  MoreVertical, ShieldCheck, Mail, Phone, Trash2, Lock
} from 'lucide-react';
import { authFetch } from '../authFetch';
import { API_BASE } from '../config';

const StaffManagement = () => {
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'cashier' });
  const [toasts, setToasts] = useState([]);
  const [isPermOpen, setIsPermOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({ password: '', role: '', permissions: {} });

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    let perms = {
      pos_access: true,
      inventory_edit: user.role === 'admin',
      reports_view: user.role === 'admin',
      settings_manage: user.role === 'admin',
      user_manage: user.role === 'admin'
    };

    if (user.permissions) {
      try {
        perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } catch (e) {
        console.error("Failed to parse permissions", e);
      }
    }
    
    setEditData({ password: '', role: user.role, permissions: perms });
    setIsEditOpen(true);
  };

  const fetchData = React.useCallback(async () => {
    try {
      const [userRes, attRes, perfRes] = await Promise.all([
        authFetch(`${API_BASE}/admin/users`),
        authFetch(`${API_BASE}/attendance`),
        authFetch(`${API_BASE}/reports/staff-performance`)
      ]);
      
      if (userRes.ok) setUsers(await userRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
      if (perfRes.ok) setPerformance(await perfRes.json());
    } catch (err) {
      console.error(err);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = async (userId, status) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${userId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !status })
      });
      if (res.ok) {
        addToast('User status updated');
        fetchData();
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete ${username}? This action cannot be undone.`)) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast('Staff member removed');
        fetchData();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Delete failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        addToast('Staff member added successfully');
        setIsModalOpen(false);
        setNewUser({ username: '', password: '', role: 'cashier' });
        fetchData();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Registration failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      // 1. Update Profile (Role & Permissions)
      const profileRes = await authFetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editData.role, permissions: editData.permissions })
      });

      if (!profileRes.ok) throw new Error('Failed to update profile');

      // 2. Update Password if provided
      if (editData.password && editData.password.length >= 4) {
        const passRes = await authFetch(`${API_BASE}/admin/users/${selectedUser.id}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: editData.password })
        });
        if (!passRes.ok) throw new Error('Failed to reset password');
      }

      addToast(`Staff record for ${selectedUser.username} updated`);
      setIsEditOpen(false);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="staff-management animate-fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Human Capital & RBAC</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage personnel access levels, audit performance, and track attendance</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary" style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <UserPlus size={18} /> Add Team Member
        </button>
      </header>

      <div className="staff-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {users.map(user => {
          const perf = performance.find(p => p.username === user.username) || { revenue: 0, orders: 0 };
          return (
            <div key={user.id} className="glass-panel staff-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
                    {user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{user.username}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <Shield size={12} /> {user.role.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleToggleStatus(user.id, user.is_active)}
                    style={{ 
                      padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                      background: user.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: user.is_active ? '#10b981' : '#ef4444',
                      border: 'none', cursor: 'pointer'
                    }}
                  >
                    {user.is_active ? 'ACTIVE' : 'BLOCKED'}
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    style={{ 
                      padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)', 
                      color: '#ef4444', border: 'none', cursor: 'pointer'
                    }}
                    title="Delete User"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>SALES VOLUME</div>
                   <div style={{ fontWeight: 800 }}>Ksh {perf.revenue?.toLocaleString()}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>TOTAL ORDERS</div>
                   <div style={{ fontWeight: 800 }}>{perf.orders}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button onClick={() => openEditModal(user)} title="Manage Staff Member" style={{ background: 'rgba(99,102,241,0.1)', border: 'none', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                   <ShieldCheck size={16} /> Manage Member
                </button>
                <button onClick={() => { setSelectedUser(user); setIsStatsOpen(true); }} title="View Stats" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                   <BarChart2 size={16} /> Stats
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '30px' }}>
           <h2 style={{ fontSize: '1.25rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Clock size={20} style={{ color: 'var(--accent-primary)' }} /> Live Attendance Timeline
           </h2>
           <div className="timeline" style={{ position: 'relative' }}>
             {attendance.slice(0, 8).map((log, i) => (
               <div key={i} style={{ display: 'flex', gap: '20px', marginBottom: '24px', position: 'relative' }}>
                 <div style={{ width: '80px', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                   {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </div>
                 <div style={{ position: 'relative' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: log.event_type === 'clock_in' ? '#10b981' : '#ef4444', border: '4px solid rgba(255,255,255,0.05)', zIndex: 2, position: 'relative' }}></div>
                    {i !== 7 && <div style={{ position: 'absolute', left: '50%', top: '12px', bottom: '-24px', width: '2px', background: 'rgba(255,255,255,0.05)', transform: 'translateX(-50%)' }}></div>}
                 </div>
                 <div style={{ flex: 1 }}>
                   <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{log.username}</div>
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                     {log.event_type === 'clock_in' ? 'Clocked In to work session' : 'Closed session and Clocked Out'}
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        <div className="glass-panel" style={{ padding: '30px' }}>
           <h2 style={{ fontSize: '1.25rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Shield size={20} style={{ color: '#f59e0b' }} /> Role Permissions
           </h2>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ fontWeight: 800, marginBottom: '4px' }}>Administrator</div>
               <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Full system access, financial reports, user management, and system settings.</p>
             </div>
             <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ fontWeight: 800, marginBottom: '4px' }}>Cashier</div>
               <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>POS access, customer registration, receipt printing. Limited to sales operations.</p>
             </div>
             <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ fontWeight: 800, marginBottom: '4px', opacity: 0.5 }}>Stock Clerk (Pending)</div>
               <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Inventory intake, barcode linking, and low stock management only.</p>
             </div>
           </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '80px', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', position: 'fixed', inset: 0, zIndex: 1000, opacity: 1, visibility: 'visible' }}>
          <div className="modal-content glass-panel animate-scale-up" style={{ width: '450px', padding: '40px' }}>
            <h2 style={{ marginBottom: '24px', color: '#fff' }}>Add Team Member</h2>
            <form onSubmit={handleCreateStaff}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Username</label>
                <input 
                  type="text" required className="input-field"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Initial Password</label>
                <input 
                  type="password" required className="input-field"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Access Level</label>
                <select 
                  className="input-field"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                >
                  <option value="cashier">Cashier (POS Only)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--accent-primary)', border: 'none', color: '#fff', fontWeight: 700 }}>Register Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="modal-overlay animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '80px', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', position: 'fixed', inset: 0, zIndex: 1000, opacity: 1, visibility: 'visible' }}>
          <div className="modal-content glass-panel animate-scale-up" style={{ width: '550px', padding: '40px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ width: '48px', height: '48px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                   {selectedUser?.username ? selectedUser.username[0].toUpperCase() : '?'}
                 </div>
                 <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Modify {selectedUser?.username}</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Staff ID: #{selectedUser?.id}</p>
                 </div>
              </div>
              <button className="btn-ghost" onClick={() => setIsEditOpen(false)}><XCircle size={24} /></button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div className="form-group">
                  <label className="field-label">SYSTEM ROLE</label>
                  <select 
                    className="input-field"
                    value={editData.role}
                    onChange={e => setEditData({...editData, role: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px' }}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="field-label">RESET PASSWORD (OPTIONAL)</label>
                  <input 
                    type="password"
                    className="input-field"
                    placeholder="Leave blank to keep"
                    value={editData.password}
                    onChange={e => setEditData({...editData, password: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label className="field-label" style={{ marginBottom: '16px', display: 'block' }}>FEATURE PERMISSIONS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { id: 'pos_access', label: 'POS Terminal' },
                    { id: 'inventory_edit', label: 'Inventory Manager' },
                    { id: 'reports_view', label: 'Analytics & Reports' },
                    { id: 'settings_manage', label: 'System Settings' },
                    { id: 'user_manage', label: 'Team Hub Admin' }
                  ].map(perm => (
                    <label key={perm.id} style={{ 
                      padding: '12px 16px', background: 'rgba(255,255,255,0.03)', 
                      borderRadius: '12px', display: 'flex', alignItems: 'center', 
                      gap: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' 
                    }}>
                      <input 
                        type="checkbox" 
                        checked={editData.permissions[perm.id] || false}
                        onChange={() => setEditData({
                          ...editData, 
                          permissions: { ...editData.permissions, [perm.id]: !editData.permissions[perm.id] }
                        })}
                        style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel Changes</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Staff Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Drawer (Simplified) */}
      <div className={`side-drawer-overlay ${isStatsOpen ? 'active' : ''}`} onClick={() => setIsStatsOpen(false)} />
      <div className={`side-drawer ${isStatsOpen ? 'open' : ''}`}>
        <div className="drawer-header">
           <h3 style={{ margin: 0 }}>Performance Audit</h3>
           <button className="btn-ghost" onClick={() => setIsStatsOpen(false)}><XCircle size={20} /></button>
        </div>
        <div className="drawer-content">
           <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <BarChart2 size={48} style={{ color: 'var(--accent-primary)', marginBottom: '16px', opacity: 0.5 }} />
              <h4>{selectedUser?.username}'s Activity</h4>
              <div className="glass-panel" style={{ marginTop: '24px', padding: '20px', textAlign: 'left' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Revenue Generated</span>
                    <span style={{ fontWeight: 700 }}>Ksh {performance.find(p => p.username === selectedUser?.username)?.revenue.toLocaleString() || 0}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Transactions Handled</span>
                    <span style={{ fontWeight: 700 }}>{performance.find(p => p.username === selectedUser?.username)?.orders || 0}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Average Basket Value</span>
                    <span style={{ fontWeight: 700 }}>Ksh {((performance.find(p => p.username === selectedUser?.username)?.revenue || 0) / (performance.find(p => p.username === selectedUser?.username)?.orders || 1)).toFixed(2)}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffManagement;


