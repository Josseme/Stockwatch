import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ShieldCheck, User, Lock, UserPlus } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function Login() {
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
      <div className="glass-panel auth-card" style={{ maxWidth: '440px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="metric-icon blue" style={{ margin: '0 auto 24px', width: '64px', height: '64px' }}>
            <Package size={32} />
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '12px' }}>
            Stockwatch
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in to manage your inventory</p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(248, 113, 113, 0.1)', 
            color: 'var(--accent-danger)', 
            padding: '14px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            fontSize: '0.9rem',
            textAlign: 'center',
            border: '1px solid rgba(248, 113, 113, 0.2)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={14} /> Username
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Enter your username"
              autoFocus
              required 
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={14} /> Password
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px', height: '56px' }}
            disabled={loading}
          >
            {loading ? <div className="spinner-small" /> : (
              <>
                <ShieldCheck size={20} /> Access Portal
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center', borderTop: '1px solid var(--panel-border)', paddingTop: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Need an account for new staff?
          </p>
          <Link to="/register" className="btn btn-ghost" style={{ width: '100%', gap: '10px' }}>
            <UserPlus size={18} /> Register New Staff
          </Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .spinner-small {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
