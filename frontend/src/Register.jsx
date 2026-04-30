import React, { useState } from 'react';
import { authFetch } from './authFetch';
import { Package, UserPlus, User, Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { API_BASE } from './config';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      setMsg({ text: 'Staff member registered successfully!', type: 'success' });
      setUsername('');
      setPassword('');
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="mesh-bg" />
      <div className="glass-panel auth-card" style={{ maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="metric-icon blue" style={{ margin: '0 auto 24px', width: '64px', height: '64px', fontSize: '32px', background: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-secondary)' }}>
            <UserPlus />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px' }}>Register Staff</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Provision a new account for the floor team</p>
        </div>
        
        {msg.text && (
          <div style={{ 
            background: msg.type === 'error' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(52, 211, 153, 0.1)', 
            color: msg.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-secondary)', 
            padding: '14px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            fontSize: '0.9rem',
            textAlign: 'center',
            border: `1px solid ${msg.type === 'error' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(52, 211, 153, 0.2)'}`
          }}>
            {msg.text}
          </div>
        )}
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={14} /> Desired Username
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="e.g. jdoe_cashier"
              required 
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={14} /> Temporal Password
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={14} /> Assigned Permission Level
            </label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.3)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', font: 'inherit' }}>
              <option value="cashier">Standard Cashier</option>
              <option value="admin">System Administrator</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px', height: '52px', background: 'var(--accent-secondary)', boxShadow: '0 4px 20px rgba(52, 211, 153, 0.2)' }}>
            Initialize Account
          </button>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <Link to="/login" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

