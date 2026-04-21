import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, Trash2, Mail, Check, X, Bell, History as HistoryIcon, TrendingUp, Users, Camera, Smartphone, Link as LinkIcon, Bluetooth } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useBarcodeScanner } from './useBarcodeScanner';
import { authFetch } from './authFetch';
import './index.css';

const API_BASE = `http://${window.location.hostname}:8000/api`;
const WS_BASE = `ws://${window.location.hostname}:8000/api/ws`;

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [scanMode, setScanMode] = useState('sales'); // 'sales' | 'restock'
  const [liveStaff, setLiveStaff] = useState([]);
  
  const navigate = useNavigate();
  // New Item Form State
  const [newItem, setNewItem] = useState({ name: '', quantity: '', threshold: '', price: '', barcode: '' });
  const userRole = localStorage.getItem('role');
  const isAdmin = userRole === 'admin';

  // Shared Scan Handler
  const handleScan = async (barcode) => {
    try {
      const res = await authFetch(`${API_BASE}/scan/${barcode}`);
      if (!res.ok) {
        if (res.status === 404) addToast(`Unrecognized: ${barcode}`, 'warning');
        else addToast(`Error looking up barcode`, 'error');
        return;
      }
      
      const item = await res.json();
      const delta = scanMode === 'sales' ? -1 : 1;
      await updateQuantity(item.id, item.quantity, delta);
      addToast(`${scanMode === 'sales' ? 'Sold' : 'Restocked'} 1x ${item.name}`, 'success');
      
    } catch (err) {
       addToast(`Scan error: ${err.message}`, 'error');
    }
  };

  // Global Barcode Scanner Hook (Hardware)
  useBarcodeScanner(handleScan);

  // Fetch Items
  const fetchInventory = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      addToast('Error fetching inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Real-time WebSocket Synchronization
  useEffect(() => {
    let ws;
    const connect = () => {
      ws = new WebSocket(WS_BASE);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'REFRESH_INVENTORY') {
          fetchInventory();
        }
      };
      ws.onclose = () => {
        // Simple auto-reconnect
        setTimeout(connect, 3000);
      };
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);

  useEffect(() => {
    fetchInventory();
    if (isAdmin) {
      fetchLiveStaff();
      const interval = setInterval(fetchLiveStaff, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const fetchLiveStaff = async () => {
    try {
      const res = await authFetch(`${API_BASE}/auth/live-status`);
      if (res.ok) setLiveStaff(await res.json());
    } catch (err) {
      console.error('Failed to fetch live staff', err);
    }
  };

  const handleLogout = async () => {
    try {
      addToast('Logging out...', 'success');
      await authFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch (err) {
      console.error('Logout API failed, continuing with local cleanup', err);
    } finally {
      localStorage.clear();
      // Use small delay to ensure toast or animation has a moment
      setTimeout(() => {
        navigate('/login');
      }, 300);
    }
  };

  // UI Helpers
  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const tempId = Date.now();
    const itemToAdd = {
      id: tempId,
      name: newItem.name,
      quantity: parseInt(newItem.quantity),
      threshold: parseInt(newItem.threshold),
      price: parseFloat(newItem.price),
      barcode: newItem.barcode || null,
      isOptimistic: true
    };

    // Optimistic Update
    setItems(prev => [...prev, itemToAdd]);
    setIsModalOpen(false);
    setNewItem({ name: '', quantity: '', threshold: '', price: '', barcode: '' });

    try {
      const res = await authFetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemToAdd.name,
          quantity: itemToAdd.quantity,
          threshold: itemToAdd.threshold,
          price: itemToAdd.price,
          barcode: itemToAdd.barcode
        })
      });
      if (!res.ok) throw new Error('Failed to add item');
      
      const data = await res.json();
      addToast(data.message);
      fetchInventory(); // Refresh to get real ID
    } catch (err) {
      addToast(err.message, 'error');
      setItems(prev => prev.filter(i => i.id !== tempId));
    }
  };

  const updateQuantity = async (id, currentQty, delta) => {
    const newQty = currentQty + delta;
    if (newQty < 0) return; // Prevent negative stock
    
    // Optimistic UI Update
    setItems(items.map(item => item.id === id ? { ...item, quantity: newQty } : item));
    
    try {
      const res = await authFetch(`${API_BASE}/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty })
      });
      if (!res.ok) throw new Error('Failed to update quantity');
      
      const item = items.find(i => i.id === id);
      if (newQty < item.threshold && currentQty >= item.threshold) {
         addToast(`Low stock alert triggered for ${item.name}`, 'warning');
      }
    } catch (err) {
      addToast(err.message, 'error');
      // Revert optimism
      fetchInventory();
    }
  };

  const handleDelete = async (id, name) => {
    if(!isAdmin) return addToast('Only admins can delete items', 'error');
    if(!confirm(`Are you sure you want to delete ${name}?`)) return;
    
    // Optimistic Update
    const previousItems = [...items];
    setItems(items.filter(i => i.id !== id));

    try {
      const res = await authFetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      addToast(`${name} deleted`);
    } catch (err) {
      addToast(err.message, 'error');
      setItems(previousItems);
    }
  };

  const checkAlerts = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/alerts`);
      const data = await res.json();
      addToast(data.message);
    } catch (err) {
      addToast('Failed to run alerts', 'error');
    }
  };

  const totalItems = items.length;
  const lowStockCount = items.filter(item => item.quantity < item.threshold).length;

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <Package size={36} color="var(--accent-primary)" />
          Stockwatch
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Scan Mode Toggle */}
          <div className="glass-panel" style={{ padding: '6px', display: 'flex', gap: '4px', borderRadius: '12px' }}>
            <button 
              className="btn"
              style={{ padding: '8px 16px', borderRadius: '8px', background: scanMode === 'sales' ? 'var(--accent-primary-bold)' : 'transparent', color: scanMode === 'sales' ? 'white' : 'var(--text-secondary)' }}
              onClick={() => setScanMode('sales')}
            >
              Sales
            </button>
            <button 
              className="btn"
              style={{ padding: '8px 16px', borderRadius: '8px', background: scanMode === 'restock' ? 'var(--accent-secondary)' : 'transparent', color: scanMode === 'restock' ? 'white' : 'var(--text-secondary)' }}
              onClick={() => setScanMode('restock')}
            >
              Restock
            </button>
          </div>

          {isAdmin && (
            <Link to="/attendance" className="btn btn-ghost" style={{ color: 'var(--accent-secondary)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>
              <Users size={18} /> Attendance
            </Link>
          )}

          <Link to="/history" className="btn btn-ghost">
            <HistoryIcon size={18} /> View History
          </Link>

          <button className="btn btn-ghost" onClick={checkAlerts}>
            <Bell size={18} /> Alerts
          </button>
          
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> New Product
            </button>
          )}

          <button className="btn btn-danger" onClick={handleLogout} style={{ borderRadius: '12px' }}>
            Logout
          </button>
        </div>
      </header>



      {/* Metrics Grid */}
      <div className="dashboard-grid">
        {isAdmin && (
          <div className="glass-panel metric-card" style={{ gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="metric-icon blue" style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-secondary)' }}>
                  <Users size={20} />
                </div>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Live Presence</h3>
              </div>
              <div className="pulse-dot"></div>
            </div>
            <div style={{ display: 'flex', gap: '-8px', marginTop: '16px', overflow: 'hidden' }}>
              {liveStaff.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No staff on-site</p>
              ) : (
                liveStaff.map((staff, i) => (
                  <div 
                    key={staff.username} 
                    title={`${staff.username} (${staff.role})`}
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: `var(--accent-primary)`,
                      border: '2px solid var(--bg-dark)',
                      marginLeft: i === 0 ? 0 : '-10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      zIndex: 10 - i,
                      cursor: 'help'
                    }}
                  >
                    {staff.username.substring(0, 1).toUpperCase()}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="glass-panel metric-card">
          <div className="metric-icon blue">
            <Package size={28} />
          </div>
          <div className="metric-info">
            <h3>Total Stock</h3>
            <p>{items.reduce((acc, i) => acc + i.quantity, 0)}</p>
          </div>
        </div>
        
        <div className="glass-panel metric-card">
          <div className="metric-icon red">
            <AlertTriangle size={28} />
          </div>
          <div className="metric-info">
            <h3>Risk Alerts</h3>
            <p style={{ color: lowStockCount > 0 ? 'var(--accent-danger)' : 'inherit' }}>
              {lowStockCount}
            </p>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-icon blue" style={{ background: 'rgba(52, 211, 153, 0.05)', color: 'var(--accent-secondary)' }}>
            <TrendingUp size={28} />
          </div>
          <div className="metric-info">
            <h3>Product Variety</h3>
            <p>{totalItems}</p>
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Active Warehouse Inventory</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-secondary)' }}></div>
            System Synced
          </div>
        </div>
        {loading ? (
          <div className="spinner"></div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
            <Package size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
            <p>Warehouse is currently empty. Initialize inventory to begin.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Unit Price</th>
                  <th>Quantity</th>
                  <th>Threshold</th>
                  <th>Live Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const isLow = item.quantity < item.threshold;
                  return (
                    <tr key={item.id} style={{ opacity: item.isOptimistic ? 0.5 : 1, animation: `fadeIn 0.4s ease-out ${index * 0.03}s both` }}>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>ID: #SW-{item.id.toString().padStart(4, '0')}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Ksh {item.price.toFixed(2)}</td>
                      <td>
                        <div className="qty-controls">
                          <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity, -1)}>-</button>
                          <span style={{ width: '40px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem' }}>{item.quantity}</span>
                          <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity, 1)}>+</button>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.threshold}</td>
                      <td>
                        <span className={`status-badge ${isLow ? 'low' : 'ok'}`}>
                          {isLow ? 'Critical Low' : 'Nominal'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isAdmin && (
                          <button className="btn-danger" style={{ padding: '8px 12px', borderRadius: '10px' }} onClick={() => handleDelete(item.id, item.name)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <div className={`modal-overlay ${isModalOpen ? 'active' : ''}`} onClick={(e) => {
        if (e.target.classList.contains('modal-overlay')) setIsModalOpen(false);
      }}>
        <div className="glass-panel modal-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Add New Item</h2>
            <button className="btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Product Name</label>
              <input type="text" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Maize Flour" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Initial Quantity</label>
                <input type="number" required min="0" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} placeholder="0" />
              </div>
              
              <div className="form-group">
                <label>Low Stock Threshold</label>
                <input type="number" required min="1" value={newItem.threshold} onChange={e => setNewItem({...newItem, threshold: e.target.value})} placeholder="0" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Unit Price (Ksh)</label>
                <input type="number" required min="0" step="0.01" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Barcode (Optional)</label>
                <input type="text" value={newItem.barcode} onChange={e => setNewItem({...newItem, barcode: e.target.value})} placeholder="Scan barcode..." />
              </div>
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <Check size={18} color="var(--success-color)" /> : <AlertTriangle size={18} color="var(--danger-color)" />}
            {toast.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
