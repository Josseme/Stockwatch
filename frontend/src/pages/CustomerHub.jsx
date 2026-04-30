import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {   Users, UserPlus, Star, CreditCard, 
  Search, Phone, History, X,
  TrendingUp, Wallet, ShieldAlert, CheckCircle
} from 'lucide-react';
import { authFetch } from '../authFetch';
import { API_BASE } from '../config';

const CustomerHub = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create'); // 'create', 'debt'
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [toasts, setToasts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [debts, setDebts] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const navigate = useNavigate();

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  

  const fetchCustomers = async (query = '') => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/customers/search?q=${query}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("CRM FETCH ERROR:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    fetchCustomers(e.target.value);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      if (res.ok) {
        addToast('Customer profile created');
        setIsDrawerOpen(false);
        setNewCustomer({ name: '', phone: '' });
        fetchCustomers();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Creation failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openDebtDrawer = async (customer) => {
    setSelectedCustomer(customer);
    setDrawerMode('debt');
    try {
      const res = await authFetch(`${API_BASE}/customers/${customer.id}/debts`);
      if (res.ok) {
        const data = await res.json();
        setDebts(Array.isArray(data) ? data : []);
        setIsDrawerOpen(true);
      }
    } catch (err) {
      addToast('Failed to fetch debts', 'error');
    }
  };

  const handleRecordPayment = async (method) => {
    if (!paymentAmount || isNaN(paymentAmount)) return;
    try {
      const res = await authFetch(`${API_BASE}/customers/${selectedCustomer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(paymentAmount), method })
      });
      if (res.ok) {
        addToast('Payment recorded successfully');
        setPaymentAmount('');
        // Refresh debt list
        const refreshRes = await authFetch(`${API_BASE}/customers/${selectedCustomer.id}/debts`);
        if (refreshRes.ok) setDebts(await refreshRes.json());
      } else {
        const err = await res.json();
        addToast(err.detail || 'Payment failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const totalPoints = Array.isArray(customers) ? customers.reduce((acc, c) => acc + (c.points || 0), 0) : 0;

  return (
    <div className="customer-hub animate-fade-in" style={{ padding: '20px' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CRM & Loyalty Hub</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>Manage customer retention and credit lines</p>
        </div>
        <button 
          onClick={() => { setDrawerMode('create'); setIsDrawerOpen(true); }} 
          className="btn btn-primary" 
          style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)' }}
        >
          <UserPlus size={20} /> Register Customer
        </button>
      </header>

      {/* CRM Stats */}
      <div className="stats-grid">
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ padding: '14px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '14px' }}><Users size={28} /></div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Profiles</div>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{customers.length}</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '14px' }}><Star size={28} /></div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issued Points</div>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{totalPoints.toLocaleString()}</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '14px' }}><ShieldAlert size={28} /></div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Credit Limit</div>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>Active</div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '40px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="search-bar" style={{ position: 'relative', maxWidth: '600px', margin: '0 auto 48px' }}>
          <Search size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by phone, name or ID..." 
            className="input-field" 
            value={search}
            onChange={handleSearch}
            style={{ width: '100%', padding: '18px 18px 18px 60px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff', fontSize: '1.1rem' }}
          />
        </div>

        <div className="customer-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {customers.map(customer => (
            <div key={customer.id} className="glass-panel hover-glow" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', transition: 'var(--transition-smooth)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent-primary), #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: '1.25rem', boxShadow: '0 8px 16px rgba(99,102,241,0.2)' }}>
                  {customer.name?.[0]?.toUpperCase() || 'C'}
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>LOYALTY POINTS</div>
                   <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-secondary)' }}>{customer.points || 0}</div>
                </div>
              </div>
              
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800 }}>{customer.name || 'Anonymous Customer'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                <Phone size={16} /> {customer.phone}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button onClick={() => navigate('/history')} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 600 }}>
                   <History size={16} /> History
                </button>
                <button 
                  onClick={() => openDebtDrawer(customer)} 
                  className="btn btn-ghost" 
                  style={{ fontSize: '0.8rem', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#ef4444' }}
                >
                  <Wallet size={16} /> Credit Line
                </button>
              </div>
            </div>
          ))}
          {customers.length === 0 && !loading && (
             <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '100px 40px', color: 'var(--text-muted)' }}>
               <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
               <p style={{ fontSize: '1.1rem' }}>No customers found matching your search.</p>
             </div>
          )}
        </div>
      </div>

      {/* Singleton Side Drawer */}
      <div className={`side-drawer-overlay ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)} />
      <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`} style={{ width: '450px' }}>
        <div className="drawer-header" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ padding: '12px', background: drawerMode === 'create' ? 'rgba(99,102,241,0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '14px', color: drawerMode === 'create' ? 'var(--accent-primary)' : '#ef4444' }}>
                {drawerMode === 'create' ? <UserPlus size={24} /> : <Wallet size={24} />}
             </div>
             <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{drawerMode === 'create' ? 'Register Customer' : 'Debt Ledger'}</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
                  {drawerMode === 'create' ? 'Add a new profile to the system' : selectedCustomer?.name}
                </p>
             </div>
          </div>
          <button className="btn-ghost" onClick={() => setIsDrawerOpen(false)} style={{ padding: '8px', borderRadius: '10px' }}><X size={24} /></button>
        </div>

        <div className="drawer-content" style={{ padding: '32px', height: 'calc(100% - 120px)', overflowY: 'auto' }}>
           {drawerMode === 'create' ? (
             <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="form-group">
                   <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name</label>
                   <input 
                      type="text" required className="input-field"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                      placeholder="e.g. John Doe"
                      style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1rem' }}
                   />
                </div>
                <div className="form-group">
                   <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone Number</label>
                   <input 
                      type="text" required className="input-field"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                      placeholder="07..."
                      style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '1rem' }}
                   />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '12px', padding: '16px', borderRadius: '14px', fontWeight: 800, fontSize: '1.1rem' }}>Create Profile</button>
             </form>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', height: '100%' }}>
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '24px' }}>
                   <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Total Outstanding</span>
                   <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ef4444', marginTop: '10px' }}>
                     Ksh {debts.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                   </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                   <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Debt History</h4>
                   {debts.length === 0 ? (
                     <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '60px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px' }}>
                       <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '16px', opacity: 0.3 }} />
                       <p>This customer is all settled up!</p>
                     </div>
                   ) : (
                     debts.map(debt => (
                       <div key={debt.id} className="glass-panel animate-slide-up" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                         <div>
                           <div style={{ fontWeight: 700, fontSize: '1rem' }}>{debt.description || 'Credit Sale'}</div>
                           <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(debt.timestamp).toLocaleDateString()}</small>
                         </div>
                         <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '1.1rem' }}>Ksh {debt.amount.toLocaleString()}</div>
                       </div>
                     ))
                   )}
                </div>

                {debts.length > 0 && (
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                     <div className="form-group">
                       <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '10px', display: 'block', textTransform: 'uppercase' }}>Record Payment</label>
                       <input 
                         type="number" 
                         placeholder="Enter amount" 
                         value={paymentAmount}
                         onChange={(e) => setPaymentAmount(e.target.value)}
                         style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#fff', fontSize: '1.1rem' }}
                       />
                     </div>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <button className="btn btn-primary" onClick={() => handleRecordPayment('M-Pesa')} disabled={!paymentAmount} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 800 }}>
                           <CreditCard size={18} /> M-Pesa
                        </button>
                        <button className="btn btn-ghost" onClick={() => handleRecordPayment('Cash')} disabled={!paymentAmount} style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '16px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontWeight: 800 }}>
                           <Wallet size={18} /> Cash
                        </button>
                     </div>
                  </div>
                )}
             </div>
           )}
        </div>
      </div>

      <div className="toast-container" style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type} animate-slide-up`} style={{ background: t.type === 'error' ? '#ef4444' : (t.type === 'info' ? '#6366f1' : '#10b981'), color: '#fff', padding: '16px 24px', borderRadius: '16px', fontWeight: 700, boxShadow: '0 10px 25px rgba(0,0,0,0.3)', minWidth: '280px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {t.type === 'error' ? <ShieldAlert size={20} /> : <CheckCircle size={20} />}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerHub;


