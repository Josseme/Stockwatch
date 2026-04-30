import React, { useState, useEffect, useRef } from 'react';
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
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [cart, setCart] = useState([]);
  const [isAutoCheckout, setIsAutoCheckout] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [insights, setInsights] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [receiptData, setReceiptData] = useState(null);
  const [highlight, setHighlight] = useState({ id: null, type: null });
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [mpesaCode, setMpesaCode] = useState('');
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);
  
  const navigate = useNavigate();
  // New Item Form State
  const [newItem, setNewItem] = useState({ 
    name: '', quantity: '', threshold: '', price: '', cost_price: '', barcode: '', 
    supplier_contact: '', sale_price: '', sale_start: '', sale_end: '', sale_days: '' 
  });
  const userRole = localStorage.getItem('role');
  const isAdmin = userRole === 'admin';
  const itemRefs = useRef({});

  useEffect(() => {
    if (highlight.id && itemRefs.current[highlight.id]) {
      itemRefs.current[highlight.id].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [highlight.id]);

  // Shared Scan Handler
  const handleScan = async (barcode) => {
    try {
      const res = await authFetch(`${API_BASE}/scan/${barcode}`);
      if (!res.ok) {
        if (res.status === 404) {
          setUnrecognizedBarcode(barcode);
          setIsLinkModalOpen(true);
          addToast(`Unrecognized: ${barcode}`, 'warning');
        } else {
          addToast(`Error looking up barcode`, 'error');
        }
        return;
      }
      
      const item = await res.json();
      const delta = scanMode === 'sales' ? -1 : 1;

      // Always add to cart first in the new Unified Workflow
      addToCart(item, delta);
      
      if (isAutoCheckout && scanMode === 'sales') {
        addToast(`Auto-processing ${item.name}...`, 'info');
        // Use a tiny timeout to allow the cart state to update visually before processing
        setTimeout(() => handleCheckout(), 100);
      } else {
        addToast(`${scanMode === 'sales' ? 'Sold' : 'Restocked'} 1x ${item.name}`, 'success');
        triggerHighlight(item.id, scanMode);
      }
      
    } catch (err) {
       addToast(`Scan error: ${err.message}`, 'error');
    }
  };

  const addToCart = (item, delta) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty_change: i.qty_change + delta } : i);
      }
      const displayName = item.name || `Product #${item.id}`;
      return [...prev, { id: item.id, name: displayName, price: item.price, qty_change: delta }];
    });
  };

  const removeFromCart = (id) => {
    const itemToRemove = cart.find(i => i.id === id);
    if (itemToRemove) {
      // Security Flag: Log Cart Deletion (Suspicious activity)
      authFetch(`${API_BASE}/security/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'Cart Deletion', item_name: itemToRemove.name })
      }).catch(err => console.error('Failed to log security event', err));
    }
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const handleCustomerSearch = async (val) => {
    setCustomerSearch(val);
    if (val.length < 3) {
      setCustomerResults([]);
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/customers/search?q=${val}`);
      if (res.ok) setCustomerResults(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleStkPush = async () => {
    const phone = activeCustomer?.phone || customerPhone;
    if (!phone) {
      addToast("Please provide a phone number", "error");
      return;
    }
    const amount = cart.reduce((acc, i) => acc + (i.price * Math.abs(i.qty_change)), 0);
    setIsWaitingForPayment(true);
    try {
      const res = await authFetch(`${API_BASE}/mpesa/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount })
      });
      if (res.ok) {
        addToast("STK Push Sent. Awaiting payment...", "info");
      } else {
        setIsWaitingForPayment(false);
        const err = await res.json();
        addToast(err.detail || "STK Push failed", "error");
      }
    } catch (err) {
      setIsWaitingForPayment(false);
      addToast(err.message, "error");
    }
  };

  const handleCreateCustomer = async () => {
    const phone = prompt("Enter Phone Number:");
    const name = prompt("Enter Customer Name:");
    if (!phone || !name) return;
    try {
      const res = await authFetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name })
      });
      if (res.ok) {
        addToast("Customer registered!");
        setActiveCustomer({ phone, name, points: 0 });
      } else {
        const err = await res.json();
        addToast(err.detail, 'error');
      }
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const currentCart = [...cart];
      const currentPhone = activeCustomer?.phone || customerPhone;
      
      const res = await authFetch(`${API_BASE}/inventory/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: currentCart.map(i => ({ item_id: i.id, qty_change: i.qty_change })),
          customer_phone: currentPhone || null
        })
      });
      if (res.ok) {
        addToast('Batch processed successfully!', 'success');
        
        if (currentPhone) {
          const total = currentCart.reduce((acc, i) => acc + (i.price * Math.abs(i.qty_change)), 0);
          const savings = currentCart.reduce((acc, i) => {
            if (i.qty_change < 0 && i.is_on_sale && i.original_price) {
              return acc + (i.original_price - i.price) * Math.abs(i.qty_change);
            }
            return acc;
          }, 0);
          
          const vatBase = total / 1.16;
          const vatAmount = total - vatBase;
          const points = Math.floor(total / 100);
          const txId = Math.random().toString(36).substring(2, 8).toUpperCase();
          const dateStr = new Date().toLocaleString();
          const custName = activeCustomer?.name || "Valued Customer";

          let text = `━━━━━━━━━━━━━━━━━━━━━━\n`;
          text += `🛍️ *SMARTSTOCK SUPERMARKET*\n`;
          text += `_Branch: Mombasa CBD_\n`;
          text += `Contact: +254 700 000 000\n`;
          text += `PIN: P051234567Z\n`;
          text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          
          text += `*OFFICIAL FISCAL RECEIPT*\n`;
          text += `RCPT: #${txId} | TERM: T-01\n`;
          text += `DATE: ${dateStr}\n`;
          text += `CASHIER: ${localStorage.getItem('username')?.toUpperCase() || 'STAFF'}\n\n`;
          
          text += `👤 *CUSTOMER:* ${custName}\n\n`;
          
          text += `*QTY  DESCRIPTION      TOTAL*\n`;
          text += `──────────────────────\n`;
          currentCart.forEach(item => {
            const itemTotal = item.price * Math.abs(item.qty_change);
            const desc = item.is_on_sale ? `${item.name} <S>` : item.name;
            text += `${Math.abs(item.qty_change).toString().padEnd(4)} ${desc.padEnd(14)} ${itemTotal.toLocaleString()} (A)\n`;
            if (item.is_on_sale) {
              text += `     _Disc Saved: Ksh ${(item.original_price - item.price).toFixed(2)}_\n`;
            }
          });
          text += `──────────────────────\n`;
          
          text += `SUBTOTAL:        Ksh ${total.toLocaleString()}\n`;
          if (savings > 0) {
            text += `*TOTAL SAVINGS:   Ksh ${savings.toLocaleString()}*\n`;
          }
          
          text += `\n*TAX BREAKDOWN (VAT 16%)*\n`;
          text += `Taxable:         Ksh ${vatBase.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
          text += `VAT Amount:      Ksh ${vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
          
          text += `\n*GRAND TOTAL:    Ksh ${total.toLocaleString()}*\n`;
          text += `──────────────────────\n`;
          text += `PAYMENT:         ${paymentMethod.toUpperCase()}\n`;
          if (paymentMethod === 'M-Pesa' && mpesaCode) {
            text += `MPESA REF:       ${mpesaCode.toUpperCase()}\n`;
          }
          
          text += `\n✨ *LOYALTY PROGRAM*\n`;
          text += `Points Earned:   ${points} pts\n`;
          text += `New Balance:     _(Visit Shop)_\n\n`;
          
          text += `📜 *POLICY:* Returns within 7 days with original receipt. No cash refunds.\n\n`;
          text += `🙏 *THANK YOU FOR SHOPPING!*\n`;
          text += `QR: stockwatch.biz/verify/${txId}\n`;
          text += `━━━━━━━━━━━━━━━━━━━━━━`;
          
          let formattedPhone = currentPhone.replace(/\D/g, '');
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
          } else if (formattedPhone.startsWith('7')) {
            formattedPhone = '254' + formattedPhone;
          }
          
          setReceiptData({
            phone: formattedPhone,
            text: encodeURIComponent(text)
          });
        }
        
        setCart([]);
        setCustomerPhone('');
        setActiveCustomer(null);
        setCustomerSearch('');
        setMpesaCode('');
        fetchInventory();
        fetchPerformance();
      } else {
        const error = await res.json();
        addToast(error.detail || 'Checkout failed', 'error');
      }
    } catch (err) {
      addToast('Checkout error: ' + err.message, 'error');
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
        } else if (data.type === 'BARCODE_SCANNED') {
          handleScan(data.barcode);
        } else if (data.type === 'PAYMENT_SUCCESS') {
          setIsWaitingForPayment(false);
          addToast("M-Pesa Payment Received!", "success");
          // Optionally auto-trigger checkout here
        } else if (data.type === 'PAYMENT_FAILED') {
          setIsWaitingForPayment(false);
          addToast("M-Pesa Payment Failed", "error");
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

  const fetchInsights = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/insights`);
      if (res.ok) setInsights(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchPerformance = async () => {
    try {
      const res = await authFetch(`${API_BASE}/reports/performance`);
      if (res.ok) setPerformance(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchInventory();
    fetchInsights();
    fetchPerformance();
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

  const handleLinkBarcode = async (itemId) => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/${itemId}/barcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: unrecognizedBarcode })
      });
      if (res.ok) {
        addToast('Barcode linked successfully!', 'success');
        setIsLinkModalOpen(false);
        fetchInventory();
        // Automatically process the scan after linking
        setTimeout(() => handleScan(unrecognizedBarcode), 500);
      } else {
        const error = await res.json();
        addToast(error.detail || 'Failed to link barcode', 'error');
      }
    } catch (err) {
      addToast('Link error: ' + err.message, 'error');
    }
  };

  const handleRegisterNew = () => {
    setNewItem({ 
      name: '', quantity: '', threshold: '', price: '', cost_price: '', barcode: unrecognizedBarcode,
      supplier_contact: '', sale_price: '', sale_start: '', sale_end: '', sale_days: '' 
    });
    setIsLinkModalOpen(false);
    setIsModalOpen(true);
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
      cost_price: parseFloat(newItem.cost_price || 0),
      barcode: newItem.barcode || null,
      supplier_contact: newItem.supplier_contact || null,
      sale_price: newItem.sale_price ? parseFloat(newItem.sale_price) : null,
      sale_start: newItem.sale_start || null,
      sale_end: newItem.sale_end || null,
      sale_days: newItem.sale_days || null,
      isOptimistic: true
    };

    // Optimistic Update
    setItems(prev => [...prev, itemToAdd]);
    setIsModalOpen(false);
    setNewItem({ 
      name: '', quantity: '', threshold: '', price: '', cost_price: '', barcode: '',
      supplier_contact: '', sale_price: '', sale_start: '', sale_end: '', sale_days: ''
    });

    try {
      const res = await authFetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemToAdd.name,
          quantity: itemToAdd.quantity,
          threshold: itemToAdd.threshold,
          price: itemToAdd.price,
          cost_price: itemToAdd.cost_price,
          barcode: itemToAdd.barcode,
          supplier_contact: itemToAdd.supplier_contact,
          sale_price: itemToAdd.sale_price,
          sale_start: itemToAdd.sale_start,
          sale_end: itemToAdd.sale_end,
          sale_days: itemToAdd.sale_days
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

  const triggerHighlight = (id, type) => {
    setHighlight({ id, type });
    setTimeout(() => setHighlight({ id: null, type: null }), 3000);
  };

  const updateQuantity = async (id, currentQty, delta, fromScan = false) => {
    const newQty = parseInt(currentQty) + delta;
    if (newQty < 0) return; // Prevent negative stock
    
    // Optimistic UI Update (using functional update to avoid stale state)
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
    
    try {
      const res = await authFetch(`${API_BASE}/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to update quantity');
      }
      
      const item = items.find(i => i.id === id);
      if (item && newQty < item.threshold && currentQty >= item.threshold) {
         addToast(`Low stock alert triggered for ${item.name}`, 'warning');
      }
      
      if (!fromScan) {
        triggerHighlight(id, delta > 0 ? 'restock' : 'sales');
      }
    } catch (err) {
      addToast(err.message, 'error');
      // Revert optimism by refetching
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
          {isAdmin && (
            <Link to="/attendance" className="btn btn-ghost" style={{ color: 'var(--accent-secondary)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>
              <Users size={18} /> Attendance
            </Link>
          )}

          <Link to="/history" className="btn btn-ghost">
            <HistoryIcon size={18} /> View History
          </Link>

          {isAdmin && (
            <Link to="/reports" className="btn btn-ghost" style={{ color: 'var(--accent-primary)' }}>
              <TrendingUp size={18} /> Audits
            </Link>
          )}

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

        {performance.length > 0 && (
          <div className="glass-panel metric-card" style={{ gridColumn: 'span 1' }}>
            <div className="metric-icon blue" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}>
              <TrendingUp size={28} />
            </div>
            <div className="metric-info">
              <h3>Top Cashier (Today)</h3>
              <p style={{ fontSize: '1.2rem' }}>{performance[0].username}</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{performance[0].transactions} Sales</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Active Shop Inventory</h2>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {/* Grouped Scan Settings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '14px', border: '1px solid var(--panel-border)' }}>
              {/* Sales/Restock Toggle (Compact) */}
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '10px' }}>
                <button 
                  onClick={() => setScanMode('sales')}
                  style={{ 
                    padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', 
                    background: scanMode === 'sales' ? 'var(--accent-primary-bold)' : 'transparent',
                    color: scanMode === 'sales' ? 'white' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Sales
                </button>
                <button 
                  onClick={() => setScanMode('restock')}
                  style={{ 
                    padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', 
                    background: scanMode === 'restock' ? 'var(--accent-secondary)' : 'transparent',
                    color: scanMode === 'restock' ? 'white' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Restock
                </button>
              </div>

              <div style={{ width: '1px', height: '16px', background: 'var(--panel-border)' }}></div>

              {/* Auto-Checkout Toggle (Compact) */}
              <div 
                onClick={() => setIsAutoCheckout(!isAutoCheckout)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', 
                  color: isAutoCheckout ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontSize: '0.75rem', fontWeight: 600, padding: '0 4px'
                }}
              >
                <Smartphone size={14} />
                {isAutoCheckout ? 'Auto-Checkout ON' : 'Manual Cart'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.7 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-secondary)' }}></div>
              Synced
            </div>
          </div>
        </div>
        {loading ? (
          <div className="spinner"></div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
            <Package size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
            <p>Shop is currently empty. Initialize inventory to begin.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Product Details</th>
                  <th style={{ textAlign: 'center' }}>Unit Price</th>
                  <th style={{ textAlign: 'center' }}>Quantity</th>
                  <th style={{ textAlign: 'center' }}>Burn Status</th>
                  <th style={{ textAlign: 'center' }}>Live Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const isLow = item.quantity < item.threshold;
                  const isHighlighted = highlight.id === item.id;
                  const highlightType = highlight.type === 'restock' ? 'restock' : 'sale';
                  
                  return (
                    <tr 
                      key={item.id} 
                      ref={el => itemRefs.current[item.id] = el}
                      className={isHighlighted ? `highlight-row ${highlightType}` : ''}
                      style={{ 
                        opacity: item.isOptimistic ? 0.5 : 1, 
                        animation: isHighlighted ? '' : `fadeIn 0.4s ease-out ${index * 0.03}s both` 
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                           <div style={{ position: 'relative' }}>
                             <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>ID: #SW-{item.id.toString().padStart(4, '0')}</div>
                           </div>
                           {item.barcodes?.length > 0 && (
                             <div title={item.barcodes.join(', ')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.7rem', color: 'var(--accent-secondary)' }}>
                               <Smartphone size={10} /> {item.barcodes.length}
                             </div>
                           )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <div className="flex-col" style={{ alignItems: 'center' }}>
                          {item.is_on_sale ? (
                            <>
                              <span style={{ color: '#eab308', fontWeight: 700, fontSize: '1rem' }}>⚡ Ksh {item.price.toFixed(2)}</span>
                              <span style={{ fontSize: '0.7rem', textDecoration: 'line-through', opacity: 0.5 }}>Ksh {item.original_price?.toFixed(2)}</span>
                            </>
                          ) : (
                            <span style={{ fontWeight: 600 }}>Ksh {item.price.toFixed(2)}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="qty-controls" style={{ display: 'inline-flex' }}>
                          <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity, -1)}>-</button>
                          <span style={{ width: '40px', textAlign: 'center', fontWeight: '700', fontSize: '1.1rem' }}>{item.quantity}</span>
                          <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity, 1)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--accent-secondary)', fontWeight: 500 }}>
                        {insights.find(i => i.id === item.id)?.days_left < 999 
                          ? `${insights.find(i => i.id === item.id).days_left} Days Left` 
                          : 'Stable'}
                      </td>
                      <td>
                        <div className="flex-align" style={{ justifyContent: 'center' }}>
                          <span className={`status-badge ${isLow ? 'low' : 'ok'}`}>
                            {isLow ? 'Critical Low' : 'Nominal'}
                          </span>
                          {isLow && item.supplier_contact && (
                            <a 
                              href={(() => {
                                let p = item.supplier_contact.replace(/\D/g, '');
                                if (p.startsWith('0')) p = '254' + p.substring(1);
                                else if (p.startsWith('7')) p = '254' + p;
                                return `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(`Hello, we need a restock of ${item.name}.`)}`;
                              })()}
                              target="_blank" rel="noreferrer"
                              className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                            >
                              Order
                            </a>
                          )}
                        </div>
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
                <label>Unit Price (Sale)</label>
                <input type="number" required min="0" max="9999999" step="0.01" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Buying Price (Cost)</label>
                <input type="number" required min="0" max="9999999" step="0.01" value={newItem.cost_price} onChange={e => setNewItem({...newItem, cost_price: e.target.value})} placeholder="0.00" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Barcode (Optional)</label>
                <input type="text" value={newItem.barcode} onChange={e => setNewItem({...newItem, barcode: e.target.value})} placeholder="Scan barcode..." />
              </div>
              <div className="form-group">
                <label>Supplier Contact (Optional)</label>
                <input type="text" value={newItem.supplier_contact} onChange={e => setNewItem({...newItem, supplier_contact: e.target.value})} placeholder="Phone or Email" />
              </div>
            </div>

            <details className="advanced-settings">
              <summary>
                <div className="flex-align">
                  <TrendingUp size={16} />
                  Advanced: Happy Hour Pricing
                </div>
              </summary>
              <div className="advanced-content">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Sale Price (Ksh)</label>
                    <input type="number" min="0" max="9999999" step="0.01" value={newItem.sale_price} onChange={e => setNewItem({...newItem, sale_price: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label>Active Days</label>
                    <input type="text" value={newItem.sale_days} onChange={e => setNewItem({...newItem, sale_days: e.target.value})} placeholder="Mon,Tue,Wed..." />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input type="time" value={newItem.sale_start} onChange={e => setNewItem({...newItem, sale_start: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input type="time" value={newItem.sale_end} onChange={e => setNewItem({...newItem, sale_end: e.target.value})} />
                  </div>
                </div>
              </div>
            </details>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      </div>

      {/* Link Barcode Modal */}
      <div className={`modal-overlay ${isLinkModalOpen ? 'active' : ''}`} onClick={(e) => {
        if (e.target.classList.contains('modal-overlay')) setIsLinkModalOpen(false);
      }}>
        <div className="glass-panel modal-content" style={{ maxWidth: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Link New Barcode</h2>
            <button className="btn-ghost" onClick={() => setIsLinkModalOpen(false)} style={{ padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
          
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid var(--accent-secondary)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Scanned: <strong style={{ color: 'var(--accent-secondary)' }}>{unrecognizedBarcode}</strong>
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              This barcode is not in the system. Select a product below to link it.
            </p>
          </div>

          <div className="form-group">
            <label>Search Existing Product</label>
            <input 
              type="text" 
              placeholder="Filter products..." 
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              style={{ marginBottom: '12px' }}
            />
          </div>

          {isAdmin && (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginBottom: '20px', gap: '10px' }}
              onClick={handleRegisterNew}
            >
              <Plus size={18} /> Register as New Product
            </button>
          )}

          <div style={{ paddingBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--panel-border)', marginBottom: '12px' }}>
             Or link to existing:
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items
              .filter(i => i.name.toLowerCase().includes(searchFilter.toLowerCase()))
              .map(item => (
                <button 
                  key={item.id} 
                  className="btn btn-ghost" 
                  style={{ justifyContent: 'space-between', padding: '12px 16px', textAlign: 'left', width: '100%' }}
                  onClick={() => handleLinkBarcode(item.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '600' }}>{item.name}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Current Stock: {item.quantity}</span>
                  </div>
                  <LinkIcon size={16} />
                </button>
              ))}
          </div>
          
          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button className="btn btn-ghost" onClick={() => setIsLinkModalOpen(false)}>Cancel</button>
          </div>
        </div>
      </div>

      {/* Batch Checkout Drawer */}
      {cart.length > 0 && (
        <div className="glass-panel" style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          width: '450px', 
          maxHeight: '80vh', 
          zIndex: 100, 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.15)',
          animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ margin: 0, fontSize: '1rem' }}>Pending Batch ({cart.length})</h3>
             <button className="btn-ghost" onClick={() => setCart([])} style={{ fontSize: '0.75rem', color: 'var(--accent-danger)' }}>Clear All</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.qty_change > 0 ? 'Restock' : 'Sale'}: {Math.abs(item.qty_change)}x
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontWeight: 700 }}>Ksh {(item.price * Math.abs(item.qty_change)).toLocaleString()}</div>
                  <button className="btn-ghost" onClick={() => removeFromCart(item.id)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--panel-border)' }}>
             {activeCustomer ? (
               <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Active Session</div>
                   <div style={{ fontWeight: 600 }}>{activeCustomer.name}</div>
                   <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{activeCustomer.phone} • {activeCustomer.points} pts</div>
                 </div>
                 <button className="btn-ghost" onClick={() => setActiveCustomer(null)} style={{ padding: '4px' }}><X size={14} /></button>
               </div>
             ) : (
               <div className="form-group" style={{ marginBottom: '12px', position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Search Customer / Phone..." 
                    value={customerSearch}
                    onChange={e => handleCustomerSearch(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.85rem', padding: '8px 12px' }}
                  />
                  {customerResults.length > 0 && (
                    <div className="glass-panel" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', zIndex: 1000, padding: '8px', marginBottom: '8px' }}>
                      {customerResults.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => { setActiveCustomer(c); setCustomerResults([]); }}
                          style={{ padding: '8px', cursor: 'pointer', borderRadius: '6px', borderBottom: '1px solid var(--panel-border)' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {customerSearch.length >= 3 && customerResults.length === 0 && (
                    <button 
                      onClick={handleCreateCustomer}
                      style={{ marginTop: '8px', width: '100%', fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'transparent', border: '1px dashed var(--accent-primary)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      + Register New Customer
                    </button>
                  )}
               </div>
             )}

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <button 
                  className={`btn ${paymentMethod === 'Cash' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '8px' }}
                  onClick={() => setPaymentMethod('Cash')}
                >
                  💵 Cash
                </button>
                <button 
                  className={`btn ${paymentMethod === 'M-Pesa' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '8px' }}
                  onClick={() => setPaymentMethod('M-Pesa')}
                >
                  📱 M-Pesa
                </button>
             </div>

             {paymentMethod === 'M-Pesa' && (
               <div style={{ marginBottom: '12px' }}>
                 <div className="form-group" style={{ marginBottom: '8px' }}>
                   <input 
                     type="text" 
                     placeholder="M-Pesa Ref (e.g. QWE123RTY)" 
                     value={mpesaCode}
                     onChange={e => setMpesaCode(e.target.value)}
                     style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.85rem', padding: '8px 12px' }}
                   />
                 </div>
                 <button 
                   className="btn btn-primary" 
                   onClick={handleStkPush}
                   disabled={isWaitingForPayment || !(activeCustomer?.phone || customerPhone)}
                   style={{ 
                     width: '100%', padding: '10px', 
                     background: (isWaitingForPayment || !(activeCustomer?.phone || customerPhone)) ? 'rgba(255,255,255,0.05)' : '#25D366', 
                     color: (isWaitingForPayment || !(activeCustomer?.phone || customerPhone)) ? 'var(--text-muted)' : '#000', 
                     fontWeight: 700, fontSize: '0.85rem' 
                   }}
                 >
                   {isWaitingForPayment 
                     ? '⏳ Waiting for PIN...' 
                     : !(activeCustomer?.phone || customerPhone) 
                       ? '⚠️ Enter Phone Number Above' 
                       : '📲 Send M-Pesa STK Push'}
                 </button>
               </div>
             )}

             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontWeight: 700 }}>
                <span>Batch Total</span>
                <span>Ksh {cart.reduce((acc, i) => acc + (i.price * Math.abs(i.qty_change)), 0).toLocaleString()}</span>
             </div>
             <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={handleCheckout}>
                Process Batch Scans
             </button>
          </div>
        </div>
      )}

      {/* WhatsApp Receipt Modal */}
      {receiptData && (
        <div className="modal-overlay active" onClick={() => setReceiptData(null)}>
          <div className="glass-panel modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#25D366' }}>
              <Smartphone size={48} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Send Digital Receipt</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Would you like to send the customer a WhatsApp receipt for this transaction?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <a 
                href={`https://api.whatsapp.com/send?phone=${receiptData.phone}&text=${receiptData.text}`} 
                target="messaging_tab" 
                rel="noreferrer"
                className="btn btn-primary" 
                style={{ background: '#25D366', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => setReceiptData(null)}
              >
                WhatsApp
              </a>
              <a 
                href={`sms:${receiptData.phone}?body=${receiptData.text}`} 
                target="messaging_tab"
                className="btn btn-primary" 
                style={{ background: '#3b82f6', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => setReceiptData(null)}
              >
                SMS
              </a>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: '12px' }} onClick={() => setReceiptData(null)}>Skip Receipt</button>
          </div>
        </div>
      )}

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
