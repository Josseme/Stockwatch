import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, TrendingUp, ShieldAlert, 
  Calendar, DollarSign, Package, User
} from 'lucide-react';

const Reports = () => {
  const [dailyStats, setDailyStats] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const API_BASE = `http://${window.location.hostname}:8000/api`;
  const token = localStorage.getItem('token');
  const user = JSON.parse(atob(token.split('.')[1])); // Decode JWT
  const isAdmin = user.role === 'admin';

  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    const fetchData = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          authFetch(`${API_BASE}/reports/daily`),
          authFetch(`${API_BASE}/reports/security`)
        ]);
        
        if (statsRes.ok) {
           const stats = await statsRes.json();
           setDailyStats(Array.isArray(stats) ? stats : []);
        }
        if (logsRes.ok) {
           const logs = await logsRes.json();
           setSecurityLogs(Array.isArray(logs) ? logs : []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  return (
    <div className="container" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
           <button className="btn-ghost" onClick={() => navigate('/')}><ArrowLeft /></button>
           <h1 style={{ margin: 0 }}>Business Audits & Insights</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button className="btn btn-ghost" onClick={() => window.print()}>Print Summary</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '40px' }}>
         <div className="glass-panel metric-card">
            <div className="metric-icon blue"><DollarSign size={24} /></div>
            <div className="metric-info">
               <h3>Last 30 Days Sales</h3>
               <p>Ksh {(dailyStats || []).reduce((acc, curr) => acc + (curr.total_sales || 0), 0).toLocaleString()}</p>
            </div>
         </div>
         <div className="glass-panel metric-card">
            <div className="metric-icon green"><TrendingUp size={24} /></div>
            <div className="metric-info">
               <h3>Total Gross Profit</h3>
               <p>Ksh {(dailyStats || []).reduce((acc, curr) => acc + (curr.gross_profit || 0), 0).toLocaleString()}</p>
            </div>
         </div>
         <div className="glass-panel metric-card">
            <div className="metric-icon purple"><ShieldAlert size={24} /></div>
            <div className="metric-info">
               <h3>Audit Events</h3>
               <p>{(securityLogs || []).length} Total</p>
            </div>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
        {/* Financial History */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', marginBottom: '25px' }}>
            <Calendar size={18} /> Daily Financial Performance
          </h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total Sales</th>
                <th>Profit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(dailyStats || []).map((day, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{day.day}</td>
                  <td>Ksh {(day.total_sales || 0).toLocaleString()}</td>
                  <td style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>
                    +Ksh {(day.gross_profit || 0).toLocaleString()}
                  </td>
                  <td>
                    <span className="pill green">Settled</span>
                  </td>
                </tr>
              ))}
              {(!dailyStats || dailyStats.length === 0) && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>No financial data found for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Security Audit Trail */}
        <div className="glass-panel" style={{ padding: '30px' }}>
           <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', marginBottom: '25px' }}>
            <ShieldAlert size={18} /> Security Audit Trail
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(securityLogs || []).map((log) => (
              <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                <div style={{ padding: '8px', background: (log.action_type || '').includes('FAILED') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                   {(log.action_type || '').includes('LOGIN') ? <User size={16} /> : <Package size={16} />}
                </div>
                <div>
                   <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{(log.action_type || 'Unknown Action').replace(/_/g, ' ')}</div>
                   <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{log.username || 'Unknown System User'} • {new Date(log.timestamp).toLocaleString()}</div>
                   {log.item_name && <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px' }}>Target: {log.item_name}</div>}
                </div>
              </div>
            ))}
            {(!securityLogs || securityLogs.length === 0) && (
              <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No security events logged.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
