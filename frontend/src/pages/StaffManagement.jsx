import React, { useState, useEffect } from 'react';
import {   Users, UserPlus, Shield, Clock, 
  CheckCircle, XCircle, BarChart2, Calendar,
  MoreVertical, ShieldCheck, Mail, Phone, Trash2
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

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
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

  const openPermDrawer = (user) => {
    setSelectedUser(user);
    try {
      const perms = user.permissions ? JSON.parse(user.permissions) : {
        pos_access: true,
        inventory_edit: user.role === 'admin',
        reports_view: user.role === 'admin',
        settings_manage: user.role === 'admin',
        user_manage: user.role === 'admin'
      };
      setPermissions(perms);
      setIsPermOpen(true);
    } catch {
      setPermissions({});
      setIsPermOpen(true);
    }
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const savePermissions = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedUser.role, permissions })
      });
      if (res.ok) {
        addToast('Permissions updated successfully');
        setIsPermOpen(false);
        fetchData();
      }
    } catch {
      addToast('Failed to save permissions', 'error');
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

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => openPermDrawer(user)} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <ShieldCheck size={16} /> Edit Permissions
                </button>
                <button onClick={() => { setSelectedUser(user); setIsStatsOpen(true); }} className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <BarChart2 size={16} /> View Stats
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

      {/* Permissions Drawer */}
      <div className={`side-drawer-overlay ${isPermOpen ? 'active' : ''}`} onClick={() => setIsPermOpen(false)} />
      <div className={`side-drawer ${isPermOpen ? 'open' : ''}`}>
        <div className="drawer-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px', color: '#6366f1' }}>
                <ShieldCheck size={20} />
             </div>
             <div>
                <h3 style={{ margin: 0 }}>RBAC Editor</h3>
                <small style={{ color: 'var(--text-muted)' }}>{selectedUser?.username}</small>
             </div>
           </div>
           <button className="btn-ghost" onClick={() => setIsPermOpen(false)}><XCircle size={20} /></button>
        </div>

        <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure granular feature access for this staff member.</p>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'pos_access', label: 'POS Terminal Access', desc: 'Allow user to process sales and issue receipts' },
                { id: 'inventory_edit', label: 'Inventory Modification', desc: 'Add, edit or delete products from catalog' },
                { id: 'reports_view', label: 'Financial Reports', desc: 'View revenue, profit and tax dashboards' },
                { id: 'settings_manage', label: 'System Settings', desc: 'Change shop config and hardware setups' },
                { id: 'user_manage', label: 'Staff Management', desc: 'Add or modify other team members' }
              ].map(perm => (
                <div key={perm.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                   <div style={{ flex: 1, paddingRight: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{perm.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{perm.desc}</div>
                   </div>
                   <input 
                    type="checkbox" 
                    checked={permissions[perm.id] || false} 
                    onChange={() => togglePermission(perm.id)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                   />
                </div>
              ))}
           </div>

           <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px' }} onClick={savePermissions}>
                 Save Access Controls
              </button>
           </div>
        </div>
      </div>

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
                    <span style={{ fontWeight: 700 }}>Ksh {(performance.find(p => p.username === selectedUser?.username)?.revenue / (performance.find(p => p.username === selectedUser?.username)?.orders || 1)).toFixed(2)}</span>
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


