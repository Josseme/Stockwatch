import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ShieldCheck, User, Lock, UserPlus, Calculator, X } from 'lucide-react';

import { API_BASE } from './config';

export default function Login() {
  const [mode, setMode] = useState('selection'); // 'selection' | 'standard'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username.trim());
      formData.append('password', password);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('username', username.trim());
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="mesh-bg" />
      
      <div className="glass-panel auth-card" style={{ maxWidth: mode === 'selection' ? '600px' : '440px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: mode === 'selection' ? '48px' : '40px' }}>
          <div className="metric-icon blue" style={{ margin: '0 auto 24px', width: '64px', height: '64px' }}>
            <Package size={32} />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '12px' }}>
            Stockwatch
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            {mode === 'selection' ? 'Select your access level' : (mode === 'cashier' ? 'Cashier Secure Terminal' : 'Administrator Secure Login')}
          </p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(248, 113, 113, 0.1)', color: 'var(--accent-danger)', 
            padding: '14px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem',
            textAlign: 'center', border: '1px solid rgba(248, 113, 113, 0.2)'
          }}>
            {error}
          </div>
        )}

        {mode === 'selection' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <button 
              className="glass-panel" 
              onClick={() => setMode('standard')}
              style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', cursor: 'pointer', transition: 'all 0.3s ease' }}
            >
              <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '16px', color: '#6366f1' }}>
                <ShieldCheck size={32} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Administrator</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Full system control & reporting</p>
              </div>
            </button>

            <button 
              className="glass-panel" 
              onClick={() => setMode('cashier')}
              style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', cursor: 'pointer', transition: 'all 0.3s ease' }}
            >
              <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', color: '#10b981' }}>
                <Calculator size={32} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Cashier</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>POS & Inventory operations</p>
              </div>
            </button>
          </div>
        )}

        {(mode === 'standard' || mode === 'cashier') && (
          <form onSubmit={handleLogin} className="animate-fade-in">
            <div className="form-group">
              <label className="field-label">USERNAME</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={mode === 'cashier' ? 'cashier_name' : 'admin_id'} required />
            </div>

            <div className="form-group">
              <label className="field-label">PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px', height: '56px' }} disabled={loading}>
              {loading ? <div className="spinner-small" /> : <><ShieldCheck size={20} /> {mode === 'cashier' ? 'Cashier Login' : 'Authenticate Admin'}</>}
            </button>

            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '16px' }} onClick={() => setMode('selection')}>
              Change Access Level
            </button>
          </form>
        )}

        <div style={{ marginTop: '32px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>System authorized for registered staff only.</p>
          <Link to="/register" className="btn btn-ghost" style={{ width: '100%', gap: '10px' }}><UserPlus size={18} /> Register New Employee</Link>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .spinner-small { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.1); border-radius: 50%; border-top-color: white; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .glass-panel:hover { transform: translateY(-5px); border-color: var(--accent-primary); }
      `}} />
    </div>
  );
}

