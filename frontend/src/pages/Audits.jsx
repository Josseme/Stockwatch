import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, ShieldAlert, Calendar, DollarSign, Package, 
  User, Star, Users, LayoutDashboard, 
  ShieldCheck, FileText, Download, Printer, Plus,
  Search, ChevronRight, RotateCcw
} from 'lucide-react';
import { authFetch } from '../authFetch';
import { API_BASE } from '../config';

const Audits = () => {
  const [activeTab, setActiveTab] = useState('financials');
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [taxReport, setTaxReport] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [salesSearch, setSalesSearch] = useState('');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'Utilities', amount: '', description: '' });
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const navigate = useNavigate();
  
  const isAdmin = localStorage.getItem('role') === 'admin';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, securityLogsRes, topRes, expRes, taxRes, deadRes, ordersRes] = await Promise.all([
        authFetch(`${API_BASE}/reports/daily`),
        authFetch(`${API_BASE}/reports/security`),
        authFetch(`${API_BASE}/reports/top-products`),
        authFetch(`${API_BASE}/expenses`),
        authFetch(`${API_BASE}/reports/tax`),
        authFetch(`${API_BASE}/reports/dead-stock`),
        authFetch(`${API_BASE}/orders`)
      ]);
      
      if (statsRes.ok) setDailyStats(await statsRes.json());
      if (securityLogsRes.ok) setSecurityLogs(await securityLogsRes.json());
      if (topRes.ok) setTopProducts(await topRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (taxRes.ok) setTaxReport(await taxRes.json());
      if (deadRes.ok) setDeadStock(await deadRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isAdmin, navigate, fetchData]);

  const handleRefund = async (orderId) => {
    if (!window.confirm('Are you sure you want to refund this order? This will restore stock levels.')) return;
    try {
      const res = await authFetch(`${API_BASE}/orders/${orderId}/refund`, { method: 'POST' });
      if (res.ok) {
        addToast('Order refunded successfully');
        setSelectedOrder(null);
        fetchData();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Refund failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const fetchOrderDetails = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/orders/${id}`);
      if (res.ok) setSelectedOrder(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newExpense,
        amount: parseFloat(newExpense.amount) || 0
      };
      const res = await authFetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsExpenseModalOpen(false);
        setNewExpense({ category: 'Utilities', amount: '', description: '' });
        addToast('Expense logged successfully');
        fetchData();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to log expense', 'error');
      }
    } catch (err) { 
      console.error(err); 
      addToast(err.message, 'error');
    }
  };

  const handleExportReport = () => {
    try {
      const sections = [];

      // 1. Financial Summary
      sections.push(['FINANCIAL SUMMARY']);
      sections.push(['Date Generated', new Date().toLocaleString()]);
      sections.push(['Total Revenue', `Ksh ${totalRevenue.toLocaleString()}`]);
      sections.push(['Gross Profit', `Ksh ${totalGrossProfit.toLocaleString()}`]);
      sections.push(['Total Expenses', `Ksh ${totalExpenses.toLocaleString()}`]);
      sections.push(['Net Profit', `Ksh ${netProfit.toLocaleString()}`]);
      sections.push([]);

      // 2. Performance Trends
      sections.push(['PERFORMANCE TRENDS (Daily)']);
      sections.push(['Date', 'Revenue', 'Expenses', 'Profit']);
      dailyStats.forEach(day => {
        sections.push([day.date, day.sales || 0, day.expenses || 0, day.profit || 0]);
      });
      sections.push([]);

      // 3. Sales Ledger
      sections.push(['SALES LEDGER (Last 50 Orders)']);
      sections.push(['Order ID', 'Timestamp', 'Customer', 'Amount', 'Method', 'Staff', 'Status']);
      orders.forEach(o => {
        sections.push([
          o.id,
          new Date(o.timestamp).toLocaleString(),
          o.customer || 'Guest',
          o.total || 0,
          o.method,
          o.staff,
          o.status
        ]);
      });
      sections.push([]);

      // 4. Expenses
      sections.push(['BUSINESS EXPENSES']);
      sections.push(['ID', 'Date', 'Category', 'Amount', 'Description']);
      expenses.forEach(e => {
        sections.push([
          e.id,
          new Date(e.timestamp).toLocaleString(),
          e.category,
          e.amount || 0,
          e.description
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8," 
        + sections.map(row => row.map(val => {
          const s = String(val).replace(/"/g, '""');
          return `"${s}"`;
        }).join(",")).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `stockwatch_full_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Full report exported successfully');
    } catch (err) {
      addToast('Export failed: ' + err.message, 'error');
    }
  };

  if (!isAdmin) return null;

  const totalRevenue = (dailyStats || []).reduce((acc, curr) => acc + (curr.sales || 0), 0);
  const totalGrossProfit = (dailyStats || []).reduce((acc, curr) => acc + (curr.profit || 0), 0);
  const totalExpenses = (expenses || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netProfit = totalGrossProfit - totalExpenses;

  const filteredOrders = orders.filter(o => 
    o.id.toString().includes(salesSearch) || 
    (o.customer && o.customer.toLowerCase().includes(salesSearch.toLowerCase())) ||
    o.staff.toLowerCase().includes(salesSearch.toLowerCase())
  );

  const tabs = [
    { id: 'financials', name: 'Financials', icon: <DollarSign size={18} /> },
    { id: 'ledger', name: 'Sales Ledger', icon: <FileText size={18} /> },
    { id: 'security', name: 'Security', icon: <ShieldCheck size={18} /> },
    { id: 'compliance', name: 'Compliance', icon: <FileText size={18} /> },
  ];

  return (
    <div className="intelligence-view animate-fade-in">
      <header className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Business Audits</h1>
          <p className="subtitle">Unified oversight of financials, sales, operations, and security logs</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={fetchData} title="Refresh Data">
              <RotateCcw size={18} />
            </button>
            <button className="btn btn-secondary" onClick={handleExportReport}>
              <Download size={18} /> Export Full Report
            </button>
            <button className="btn btn-primary" onClick={() => setIsExpenseModalOpen(true)}>
              <Plus size={18} /> Log Expense
            </button>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <div className="tabs-nav glass-panel" style={{ display: 'flex', gap: '8px', padding: '8px', marginBottom: '32px', borderRadius: '16px' }}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'financials' && (
          <div className="financials-pane animate-fade-in">
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
               <div className="glass-panel metric-card" style={{ padding: '24px' }}>
                  <div className="metric-icon blue" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}><DollarSign size={24} /></div>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Total Revenue</h3>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Ksh {totalRevenue.toLocaleString()}</p>
               </div>
               <div className="glass-panel metric-card" style={{ padding: '24px' }}>
                  <div className="metric-icon green" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}><TrendingUp size={24} /></div>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Gross Profit</h3>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Ksh {totalGrossProfit.toLocaleString()}</p>
               </div>
               <div className="glass-panel metric-card" style={{ padding: '24px' }}>
                  <div className="metric-icon red" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}><Package size={24} /></div>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Total Expenses</h3>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Ksh {totalExpenses.toLocaleString()}</p>
               </div>
               <div className="glass-panel metric-card" style={{ padding: '24px', border: '1px solid var(--accent-primary)' }}>
                  <div className="metric-icon purple" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}><ShieldAlert size={24} /></div>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Net Take-Home</h3>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--accent-primary)' }}>Ksh {netProfit.toLocaleString()}</p>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '30px' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Calendar size={18} /> Performance Trends</h2>
                <table className="modern-table" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px' }}>Date</th>
                      <th style={{ padding: '12px' }}>Revenue</th>
                      <th style={{ padding: '12px' }}>Expenses</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.map((day, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{day.date}</td>
                        <td style={{ padding: '16px 12px' }}>Ksh {day.sales?.toLocaleString()}</td>
                        <td style={{ padding: '16px 12px', color: '#ef4444' }}>-Ksh {day.expenses?.toLocaleString()}</td>
                        <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                           Ksh {day.profit?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="glass-panel" style={{ padding: '30px' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Star size={18} /> Top Selling Items</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topProducts.map((p, i) => (
                    <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <div style={{ fontWeight: 700 }}>{p.name}</div>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.qty} units sold</div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <div style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>Ksh {p.profit.toLocaleString()}</div>
                         <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Net Profit</div>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="ledger-pane animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1.5fr 1fr' : '1fr', gap: '24px' }}>
            <div className="ledger-main">
              <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '32px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search by Order ID, Customer, or Cashier..." 
                  className="input-field" 
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  style={{ width: '100%', padding: '12px 12px 12px 48px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                />
              </div>

              <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '16px 24px' }}>Order ID</th>
                      <th style={{ padding: '16px 24px' }}>Timestamp</th>
                      <th style={{ padding: '16px 24px' }}>Customer</th>
                      <th style={{ padding: '16px 24px' }}>Amount</th>
                      <th style={{ padding: '16px 24px' }}>Method</th>
                      <th style={{ padding: '16px 24px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr 
                        key={order.id} 
                        onClick={() => fetchOrderDetails(order.id)}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: selectedOrder?.id === order.id ? 'rgba(99,102,241,0.05)' : 'transparent' }} 
                        className="hover-row"
                      >
                        <td style={{ padding: '20px 24px', fontWeight: 700, color: 'var(--accent-primary)' }}>#{order.id}</td>
                        <td style={{ padding: '20px 24px', fontSize: '0.85rem' }}>{new Date(order.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '20px 24px' }}>{order.customer || 'Guest'}</td>
                        <td style={{ padding: '20px 24px', fontWeight: 700 }}>Ksh {order.total?.toLocaleString()}</td>
                        <td style={{ padding: '20px 24px' }}>
                           <span style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>{order.method}</span>
                        </td>
                        <td style={{ padding: '20px 24px' }}><ChevronRight size={18} style={{ color: 'var(--text-muted)' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedOrder && (
              <div className="order-details-panel glass-panel animate-slide-in-right" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0 }}>Order #{selectedOrder.id}</h3>
                  <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  <div>Served By: {selectedOrder.staff}</div>
                  <div>Status: <span style={{ color: selectedOrder.status === 'Refunded' ? '#ef4444' : '#10b981' }}>{selectedOrder.status}</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.9rem' }}>{item.qty}x {item.name}</div>
                      <div style={{ fontWeight: 600 }}>Ksh {(item.qty * item.price).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                     <span>Total</span>
                     <span style={{ color: 'var(--accent-secondary)' }}>Ksh {selectedOrder.total?.toLocaleString()}</span>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <button onClick={() => window.print()} className="btn btn-ghost" style={{ flex: 1 }}><Printer size={16} /> Print</button>
                  {selectedOrder.status !== 'Refunded' && (
                    <button onClick={() => handleRefund(selectedOrder.id)} className="btn btn-ghost" style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444' }}><RotateCcw size={16} /> Refund</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}


        {activeTab === 'security' && (
          <div className="security-pane animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '30px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h2 style={{ fontSize: '1.1rem', color: '#ef4444', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldAlert size={18} /> High-Risk Inventory</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {deadStock.map(item => (
                    <div key={item.id} style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                       <div style={{ fontWeight: 700, marginBottom: '4px' }}>{item.name}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Last Sale: {item.last_sale}</div>
                       <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                         Suggested Sale: Ksh {item.suggested_clearance.toLocaleString()}
                       </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '30px' }}>
                 <h2 style={{ fontSize: '1.1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck size={18} /> System Audit Logs</h2>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {securityLogs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', alignItems: 'center' }}>
                         <div style={{ padding: '10px', background: log.action_type.includes('FAILED') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: log.action_type.includes('FAILED') ? '#ef4444' : '#3b82f6', borderRadius: '10px' }}>
                            {log.action_type.includes('LOGIN') ? <User size={18} /> : <Plus size={18} />}
                         </div>
                         <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{log.action_type.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Performed by {log.username}</div>
                         </div>
                         <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.5 }}>
                            {new Date(log.timestamp).toLocaleString()}
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="compliance-pane animate-fade-in">
             <div className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                   <h2 style={{ fontSize: '1.1rem', margin: 0 }}>VAT Compliance Tracker (16%)</h2>
                   <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print Tax Report</button>
                </div>
                <table className="modern-table" style={{ width: '100%' }}>
                   <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--panel-border)' }}>
                         <th style={{ padding: '16px' }}>Reporting Date</th>
                         <th style={{ padding: '16px' }}>Taxable Sales</th>
                         <th style={{ padding: '16px' }}>VAT Output</th>
                         <th style={{ padding: '16px', textAlign: 'right' }}>Status</th>
                      </tr>
                   </thead>
                   <tbody>
                      {taxReport.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                           <td style={{ padding: '16px', fontWeight: 600 }}>{row.day}</td>
                           <td style={{ padding: '16px' }}>Ksh {row.revenue.toLocaleString()}</td>
                           <td style={{ padding: '16px', color: 'var(--accent-secondary)', fontWeight: 700 }}>Ksh {row.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                           <td style={{ padding: '16px', textAlign: 'right' }}>
                              <span style={{ fontSize: '0.65rem', padding: '4px 8px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', borderRadius: '4px', fontWeight: 700 }}>AUDITED</span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="modal-overlay animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '80px', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', position: 'fixed', inset: 0, zIndex: 1000, opacity: 1, visibility: 'visible' }}>
          <div className="modal-content glass-panel animate-scale-up" style={{ width: '450px', padding: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Log Business Expense</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>All expenses are tracked in real-time for profit calculations.</p>
            
            <form onSubmit={handleAddExpense}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>CATEGORY</label>
                <select 
                  className="input-field" 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: '#fff' }}
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                >
                  <option>Rent</option>
                  <option>Utilities</option>
                  <option>Staff Wages</option>
                  <option>Transport</option>
                  <option>Supplies</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>AMOUNT (KSH)</label>
                <input 
                  type="number" className="input-field" required
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: '#fff' }}
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '40px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>DESCRIPTION</label>
                <input 
                  type="text" className="input-field" placeholder="e.g. Monthly Electricity Bill"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: '#fff' }}
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '14px' }} onClick={() => setIsExpenseModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '14px' }}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
           <div className="spinner"></div>
        </div>
      )}

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

export default Audits;


