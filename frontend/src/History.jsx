import React, { useState, useEffect } from 'react';
import { Clock, ArrowLeft, ShieldAlert, TrendingUp, TrendingDown, User } from 'lucide-react';
import { authFetch } from './authFetch';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:8000/api';

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await authFetch(`${API_BASE}/transactions`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="metric-icon blue" style={{ width: '48px', height: '48px' }}>
            <Clock size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, background: 'none', webkitTextFillColor: 'inherit', webkitBackgroundClip: 'none' }}>
              Audit Trail
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time immutable transaction logs</p>
          </div>
        </div>
        <Link to="/" className="btn btn-ghost" style={{ height: '44px' }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div className="spinner"></div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <ShieldAlert size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>No transactions recorded yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Quantity Change</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => {
                  const isPositive = log.qty_change > 0;
                  return (
                    <tr key={log.id} style={{ animation: `fadeIn 0.4s ease-out ${index * 0.05}s both` }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(log.timestamp + 'Z').toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={12} />
                          </div>
                          <span style={{ fontWeight: 600 }}>{log.username}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{log.item_name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '10px', background: isPositive ? 'rgba(52, 211, 153, 0.05)' : 'rgba(248, 113, 113, 0.05)', border: `1px solid ${isPositive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)'}` }}>
                          {isPositive ? <TrendingUp size={14} color="var(--accent-secondary)" /> : <TrendingDown size={14} color="var(--accent-danger)" />}
                          <span style={{ 
                            fontWeight: 700, 
                            color: isPositive ? 'var(--accent-secondary)' : 'var(--accent-danger)',
                            fontSize: '1rem'
                          }}>
                            {isPositive ? '+' : ''}{log.qty_change}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
