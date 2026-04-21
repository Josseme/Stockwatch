import React, { useState, useEffect } from 'react';
import { Clock, ArrowLeft, ShieldCheck, User } from 'lucide-react';
import { authFetch } from './authFetch';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:8000/api';

export default function Attendance() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await authFetch(`${API_BASE}/attendance`);
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
          <div className="metric-icon blue" style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-secondary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Attendance Log</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Personnel Clock-In/Out Records</p>
          </div>
        </div>
        <Link to="/" className="btn btn-ghost">
          <ArrowLeft size={18} /> Back to Operations
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="spinner"></div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
            <p>No attendance records found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Staff Member</th>
                  <th>Event Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log.id} style={{ animation: `fadeIn 0.3s ease-out ${index * 0.05}s both` }}>
                    <td style={{ color: 'var(--text-muted)' }}>
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
                    <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                      {log.event_type.replace('_', ' ')}
                    </td>
                    <td>
                      <span className="status-badge ok">Success</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
