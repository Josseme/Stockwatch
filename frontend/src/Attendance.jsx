import React, { useState, useEffect } from 'react';
import { Clock, ArrowLeft, ShieldCheck, User } from 'lucide-react';
import { authFetch } from './authFetch';
import { Link } from 'react-router-dom';

import { API_BASE } from './config';

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
    <div className="attendance-view">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Staff Attendance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Personnel Clock-In/Out audit records and presence tracking
          </p>
        </div>
      </header>

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

