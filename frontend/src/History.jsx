import React, { useState, useEffect } from 'react';
import { Clock, ArrowLeft, ShieldAlert, TrendingUp, TrendingDown, User, DollarSign, Wallet, Calendar } from 'lucide-react';
import { authFetch } from './authFetch';
import { Link } from 'react-router-dom';

const API_BASE = `http://${window.location.hostname}:8000/api`;

export default function History() {
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = localStorage.getItem('role') === 'admin';

  useEffect(() => {
    fetchLogs();
    if (isAdmin) fetchReport();
  }, [isAdmin]);

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

  const fetchReport = async () => {
    try {
      const res = await authFetch(`${API_BASE}/reports/daily`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error(err);
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
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Audit Trail</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time immutable transaction logs</p>
          </div>
        </div>
        <Link to="/" className="btn btn-ghost" style={{ height: '44px' }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
      </div>

      {isAdmin && report.length > 0 && (
        <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
          <div className="glass-panel metric-card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
            <div className="metric-icon blue" style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-secondary)' }}>
              <DollarSign size={24} />
            </div>
            <div className="metric-info">
              <h3>Today's Sales</h3>
              <p>Ksh {report[0]?.sales.toLocaleString()}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Revenue generated today</span>
            </div>
          </div>
          
          <div className="glass-panel metric-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
            <div className="metric-icon blue">
              <Wallet size={24} />
            </div>
            <div className="metric-info">
              <h3>Today's Restock</h3>
              <p>Ksh {report[0]?.restock.toLocaleString()}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inventory investment today</span>
            </div>
          </div>

          <div className="glass-panel metric-card">
            <div className="metric-icon blue" style={{ background: 'rgba(96, 165, 250, 0.1)', color: 'var(--accent-primary)' }}>
              <Calendar size={24} />
            </div>
            <div className="metric-info">
              <h3>Current Session</h3>
              <p>{new Date().toLocaleDateString()}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reporting period</span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between' }}>
           <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Transaction History</h2>
           {isAdmin && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Financial audit active</span>}
        </div>
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
                  <th style={{ textAlign: 'center' }}>Qty Change</th>
                  <th style={{ textAlign: 'right' }}>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => {
                  const isPositive = log.qty_change > 0;
                  const value = Math.abs(log.qty_change) * (log.unit_price || 0);
                  return (
                    <tr key={log.id} style={{ animation: `fadeIn 0.4s ease-out ${index * 0.05}s both` }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(log.timestamp + 'Z').toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={12} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.username}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{log.item_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isPositive ? 'var(--accent-secondary)' : 'var(--accent-danger)', fontWeight: 700 }}>
                          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {isPositive ? '+' : ''}{log.qty_change}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          Ksh {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          @ Ksh {log.unit_price?.toFixed(2) || '0.00'}
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
