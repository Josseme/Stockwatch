import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, 
  Users, Package, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Calendar, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { authFetch } from '../authFetch';
import { API_BASE } from '../config';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveStaff, setLiveStaff] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [insights, setInsights] = useState([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/dashboard/analytics`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setError("Failed to load analytics");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveStaff = async () => {
    try {
      const res = await authFetch(`${API_BASE}/auth/live-status`);
      if (res.ok) setLiveStaff(await res.json());
    } catch (err) {
      console.error('Failed to fetch live staff', err);
    }
  };

  const fetchPerformance = async () => {
    try {
      const res = await authFetch(`${API_BASE}/reports/performance`);
      if (res.ok) setPerformance(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchInsights = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/insights`);
      if (res.ok) setInsights(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchLiveStaff();
    fetchPerformance();
    fetchInsights();
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetchAnalytics();
      fetchLiveStaff();
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading-state">Initializing Command Center...</div>;
  if (error) return <div className="error-state">{error}</div>;

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="dashboard-view animate-fade-in">
      <header className="page-header">
        <div>
          <h1>Command Center</h1>
          <p className="subtitle">Real-time business intelligence and performance metrics</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-ghost" onClick={() => { fetchAnalytics(); fetchInsights(); }}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Sync Data
            </button>
        </div>
      </header>

      {/* Main Metrics */}
      <div className="stats-grid">
        <div className="glass-panel metric-card" style={{ padding: '24px' }}>
          <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="metric-icon blue" style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '12px' }}><DollarSign size={20} /></div>
            <div className="metric-trend positive" style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={14} /> 12.5%
            </div>
          </div>
          <div className="metric-body">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Today's Revenue</h3>
            <p className="value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Ksh {data?.today?.revenue?.toLocaleString()}</p>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ padding: '24px' }}>
          <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="metric-icon green" style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px' }}><ShoppingCart size={20} /></div>
            <div className="metric-trend positive" style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={14} /> 8.2%
            </div>
          </div>
          <div className="metric-body">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Transaction Count</h3>
            <p className="value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{data?.today?.orders}</p>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ padding: '24px' }}>
          <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="metric-icon purple" style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '12px' }}><TrendingUp size={20} /></div>
            <div className="metric-trend positive" style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={14} /> Stable
            </div>
          </div>
          <div className="metric-body">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Today's Profit</h3>
            <p className="value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Ksh {data?.today?.profit?.toLocaleString()}</p>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ padding: '24px' }}>
          <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="metric-icon orange" style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px' }}><Users size={20} /></div>
            <div className="badge badge-success" style={{ fontSize: '0.625rem' }}>Online</div>
          </div>
          <div className="metric-body">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Active Staff</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex' }}>
                {liveStaff.length > 0 ? liveStaff.map((s, i) => (
                  <div key={s.username} title={s.username} style={{ width: '32px', height: '32px', borderRadius: '50%', background: COLORS[i % COLORS.length], border: '2px solid var(--surface)', marginLeft: i === 0 ? 0 : '-12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 800, position: 'relative', cursor: 'help' }}>
                    {s.username[0].toUpperCase()}
                  </div>
                )) : <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>None online</span>}
              </div>
              {liveStaff.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>{liveStaff.length} Current</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Burn Status Strip */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', display: 'flex', gap: '20px', overflowX: 'auto', alignItems: 'center' }}>
        <div style={{ minWidth: '120px', borderRight: '1px solid var(--panel-border)', paddingRight: '20px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-danger)', textTransform: 'uppercase' }}>Burn Status</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Stock Velocity</div>
        </div>
        {insights.slice(0, 5).map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--panel-border)', minWidth: '200px' }}>
            <div style={{ padding: '8px', background: item.burn_rate > 2 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: item.burn_rate > 2 ? 'var(--accent-danger)' : 'var(--accent-secondary)', borderRadius: '8px' }}>
              <Package size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.burn_rate} units/day • {item.days_left} days left</div>
            </div>
            {item.burn_rate > 0 && <TrendingUp size={14} color={item.burn_rate > 2 ? '#ef4444' : '#10b981'} />}
          </div>
        ))}
        {insights.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No velocity data available yet.</p>}
      </div>

      {/* Shop Performance & Trends */}
      <div className="dashboard-grid">
        <div className="glass-panel metric-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="metric-icon green" style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px' }}><TrendingUp size={20} /></div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOP PERFORMER</span>
          </div>
          <div className="metric-body">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Shop Performance</h3>
            <p className="value" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 4px 0' }}>
              {performance[0]?.username || 'Stable'}
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {performance[0]?.transactions || 0} transactions today
            </div>
          </div>
        </div>

        <div className="glass-panel chart-container main-chart" style={{ padding: '30px' }}>
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Revenue Trends</h2>
            <div className="chart-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-sm active" style={{ padding: '4px 12px', background: 'var(--accent-primary)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.75rem' }}>7D</button>
              <button className="btn-sm" style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>1M</button>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={data?.trends}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel chart-container" style={{ padding: '30px' }}>
          <div className="chart-header" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Sales by Category</h2>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data?.categories}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data?.categories?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Legend iconType="circle" layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="dashboard-grid bottom">
        <div className="glass-panel list-container" style={{ padding: '30px' }}>
          <div className="chart-header" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Staff Performance</h2>
          </div>
          <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Member</th>
                <th style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Orders</th>
                <th style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data?.staff?.map((member, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '16px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{member.username[0]}</div>
                      <span style={{ fontWeight: 600 }}>{member.username}</span>
                    </div>
                  </td>
                  <td>{member.orders}</td>
                  <td style={{ fontWeight: 700 }}>Ksh {member.sales?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-panel list-container" style={{ padding: '30px' }}>
           <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Critical Inventory</h2>
            <span style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', fontWeight: 700 }}>Action Required</span>
          </div>
          <div className="alert-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#f59e0b' }}><AlertTriangle size={20} /></div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Maize Flour (2kg)</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stock: 12 units (Threshold: 20)</p>
              </div>
              <button className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--accent-primary)' }}><ArrowUpRight size={18} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              <div style={{ color: '#ef4444' }}><AlertTriangle size={20} /></div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Cooking Oil (3L)</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stock: 2 units (Threshold: 10)</p>
              </div>
              <button className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--accent-primary)' }}><ArrowUpRight size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

