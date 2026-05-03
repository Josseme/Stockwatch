import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Minus, TrendingUp, ShieldAlert, Calendar, DollarSign, Package, User, UserPlus, Star, AlertTriangle, Plus, Trash2, Mail, Check, X, Bell, History as HistoryIcon, Users, Camera, Smartphone, Link as LinkIcon, Bluetooth, Settings as SettingsIcon, Banknote, Scale, Search } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useBarcodeScanner } from './useBarcodeScanner';
import { authFetch } from './authFetch';
import './index.css';
import { API_BASE, WS_BASE } from './config';


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
  const [sessions, setSessions] = useState([{
    id: Date.now(),
    cart: [],
    activeCustomer: null,
    customerSearch: '',
    customerResults: [],
    paymentMethod: 'Cash',
    mpesaCode: '',
    isWaitingForPayment: false,
    customerPhone: ''
  }]);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);

  const activeSession = sessions[activeSessionIndex] || sessions[0] || {
    id: Date.now(),
    cart: [],
    activeCustomer: null,
    customerSearch: '',
    customerResults: [],
    paymentMethod: 'Cash',
    mpesaCode: '',
    isWaitingForPayment: false,
    customerPhone: ''
  };
  const cart = activeSession.cart;
  const activeCustomer = activeSession.activeCustomer;
  const customerSearch = activeSession.customerSearch;
  const customerResults = activeSession.customerResults;
  const paymentMethod = activeSession.paymentMethod;
  const mpesaCode = activeSession.mpesaCode;
  const isWaitingForPayment = activeSession.isWaitingForPayment;
  const customerPhone = activeSession.customerPhone;

  const updateActiveSession = (key, val) => {
    setSessions(prev => {
      const next = [...prev];
      const idx = activeSessionIndex >= next.length ? next.length - 1 : activeSessionIndex;
      if (idx < 0) return prev;
      next[idx] = { 
        ...next[idx], 
        [key]: typeof val === 'function' ? val(next[idx][key]) : val 
      };
      return next;
    });
  };

  const setCart = (val) => updateActiveSession('cart', val);
  const setActiveCustomer = (val) => updateActiveSession('activeCustomer', val);
  const setCustomerSearch = (val) => updateActiveSession('customerSearch', val);
  const setCustomerResults = (val) => updateActiveSession('customerResults', val);
  const setPaymentMethod = (val) => updateActiveSession('paymentMethod', val);
  const setMpesaCode = (val) => updateActiveSession('mpesaCode', val);
  const setIsWaitingForPayment = (val) => updateActiveSession('isWaitingForPayment', val);
  const setCustomerPhone = (val) => updateActiveSession('customerPhone', val);

  const addSession = () => {
    setSessions(prev => [...prev, {
      id: Date.now(),
      cart: [],
      activeCustomer: null,
      customerSearch: '',
      customerResults: [],
      paymentMethod: 'Cash',
      mpesaCode: '',
      isWaitingForPayment: false,
      customerPhone: ''
    }]);
    setActiveSessionIndex(sessions.length);
  };

  const closeSession = (idx, e) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      setCart([]);
      setActiveCustomer(null);
      setCustomerSearch('');
      return;
    }
    const next = sessions.filter((_, i) => i !== idx);
    setSessions(next);
    if (activeSessionIndex >= next.length) setActiveSessionIndex(next.length - 1);
  };

  const [isAutoCheckout, setIsAutoCheckout] = useState(false);
  const [qtyMultiplier, setQtyMultiplier] = useState(1);
  const [insights, setInsights] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [receiptData, setReceiptData] = useState(null);
  const [highlight, setHighlight] = useState({ id: null, type: null });
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [pingStatus, setPingStatus] = useState(null);
  
  const navigate = useNavigate();
  // New Item Form State
  const [newItem, setNewItem] = useState({ 
    name: '', quantity: '', threshold: '', price: '', cost_price: '', barcode: '', 
    supplier_contact: '', sale_price: '', sale_start: '', sale_end: '', sale_days: '' 
  });
  const [editingItem, setEditingItem] = useState(null);
  const userRole = localStorage.getItem('role');
  const username = localStorage.getItem('username');
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

  useEffect(() => {
    const handleAction = (e) => {
      const { action } = e.detail;
      if (action === 'new-product') setIsModalOpen(true);
    };
    window.addEventListener('inventory-action', handleAction);
    return () => window.removeEventListener('inventory-action', handleAction);
  }, []);

  const handlePing = async () => {
    try {
      setPingStatus('pinging');
      const res = await authFetch(`${API_BASE}/ping`);
      if (res.ok) {
        const data = await res.json();
        addToast(`Africa/Nairobi: ${data.latency_ms}ms`, 'success');
        setPingStatus('online');
      } else {
        setPingStatus('error');
      }
    } catch (err) {
      setPingStatus('error');
      addToast('Ping failed', 'error');
    }
  };
  
  const [lastError, setLastError] = useState(null);
  const handleScanRef = useRef(null);

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
      const delta = scanMode === 'sales' ? -qtyMultiplier : qtyMultiplier;

      addToCart(item, delta);
      setQtyMultiplier(1);
      
      if (isAutoCheckout && scanMode === 'sales') {
        addToast(`Auto-processing ${item.name}...`, 'info');
        setTimeout(() => handleCheckout(), 100);
      } else {
        addToast(`${scanMode === 'sales' ? 'Sold' : 'Restocked'} 1x ${item.name}`, 'success');
        triggerHighlight(item.id, scanMode);
      }
      
    } catch (err) {
       addToast(`Scan error: ${err.message}`, 'error');
    }
  };

  const handleEditClick = (item) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem)
      });
      if (res.ok) {
        addToast(`${editingItem.name} updated!`, 'success');
        setIsEditModalOpen(false);
        fetchInventory();
      }
    } catch (err) { addToast(err.message, 'error'); }
  };

  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  const addToCart = (item, delta) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty_change: i.qty_change + delta } : i);
      }
      const displayName = item.name || `Product #${item.id}`;
      return [...prev, { id: item.id, name: displayName, price: item.price, qty_change: delta }];
    });
    // If called from a UI button (not scanner), we might want to reset too
    // but typically addToCart is the low-level func. handleScan already resets it.
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
    const phone = activeCustomer?.phone || customerPhone || customerSearch;
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

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const currentCart = [...cart];
      const currentPhone = activeCustomer?.phone || customerPhone || customerSearch;
      
      const res = await authFetch(`${API_BASE}/inventory/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: currentCart.map(i => ({ item_id: i.id, qty_change: i.qty_change })),
          customer_phone: currentPhone || null,
          payment_method: paymentMethod
        })
      });
      if (res.ok) {
        const orderData = await res.json();
        addToast('Batch processed successfully!', 'success');
        
        const total = orderData.total;
        const savings = currentCart.reduce((acc, i) => {
          if (i.qty_change < 0 && i.is_on_sale && i.original_price) {
            return acc + (i.original_price - i.price) * Math.abs(i.qty_change);
          }
          return acc;
        }, 0);
        
        const vatAmount = orderData.vat;
        const vatBase = total - vatAmount;
        const points = orderData.points;
        const txId = orderData.order_id;
        const dateStr = orderData.timestamp;
        const custName = activeCustomer?.name || "Valued Customer";

        const currency = licenseStatus?.currency || 'Ksh';
        const vatRate = licenseStatus?.vat_rate || 16;
        const shopFooter = licenseStatus?.shop_footer || 'THANK YOU FOR SHOPPING!';

        let text = `━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `🛍️ *${licenseStatus?.shop_name?.toUpperCase() || 'STOCKWATCH ENTERPRISE'}*\n`;
        text += `_${licenseStatus?.shop_location || 'Personalized Retail Solutions'}_\n`;
        text += `Contact: ${licenseStatus?.owner_phone || '+254 700 000 000'}\n`;
        text += `PIN: ${licenseStatus?.tax_id || 'PIN-000000000'}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        text += `*OFFICIAL FISCAL RECEIPT*\n`;
        text += `RCPT: #${txId} | TERM: T-01\n`;
        text += `DATE: ${dateStr}\n`;
        text += `CASHIER: ${localStorage.getItem('username')?.toUpperCase() || 'STAFF'}\n\n`;
        
        text += `👤 *CUSTOMER:* ${custName} (${currentPhone || 'Walk-in'})\n\n`;
        
        text += `*QTY  DESCRIPTION      TOTAL*\n`;
        text += `──────────────────────\n`;
        currentCart.forEach(item => {
          const itemTotal = item.price * Math.abs(item.qty_change);
          const desc = item.is_on_sale ? `${item.name} <S>` : item.name;
          text += `${Math.abs(item.qty_change).toString().padEnd(4)} ${desc.padEnd(14)} ${itemTotal.toLocaleString()} (A)\n`;
          if (item.is_on_sale) {
            text += `     _Disc Saved: ${currency} ${(item.original_price - item.price).toFixed(2)}_\n`;
          }
        });
        text += `──────────────────────\n`;
        
        text += `SUBTOTAL:        ${currency} ${total.toLocaleString()}\n`;
        if (savings > 0) {
          text += `*TOTAL SAVINGS:   ${currency} ${savings.toLocaleString()}*\n`;
        }
        
        text += `\n*TAX BREAKDOWN (VAT ${vatRate}%)*\n`;
        text += `Taxable:         ${currency} ${vatBase.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
        text += `VAT Amount:      ${currency} ${vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
        
        text += `\n*GRAND TOTAL:    ${currency} ${total.toLocaleString()}*\n`;
        text += `──────────────────────\n`;
        text += `PAYMENT:         ${paymentMethod.toUpperCase()}\n`;
        if (paymentMethod === 'M-Pesa' && mpesaCode) {
          text += `MPESA REF:       ${mpesaCode.toUpperCase()}\n`;
        }
        
        text += `\n✨ *LOYALTY PROGRAM*\n`;
        text += `Points Earned:   ${points} pts\n`;
        text += `New Balance:     _(Visit Shop)_\n\n`;
        
        text += `📜 *POLICY:* Returns within 7 days with original receipt. No cash refunds.\n\n`;
        text += `🙏 *${shopFooter.toUpperCase()}*\n`;
        text += `QR: stockwatch.biz/verify/${txId}\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━`;
        
        let formattedPhone = "";
        if (currentPhone) {
          formattedPhone = currentPhone.replace(/\D/g, '');
          if (formattedPhone.length === 10 && formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
          } else if (formattedPhone.length === 9 && (formattedPhone.startsWith('7') || formattedPhone.startsWith('1'))) {
            formattedPhone = '254' + formattedPhone;
          }
        }
        
        const receiptDataObj = {
          phone: formattedPhone,
          text: encodeURIComponent(text)
        };
        
        localStorage.setItem('lastReceipt', JSON.stringify(receiptDataObj));
        window.open('/receipt', 'StockwatchReceipt');
        
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

  const fetchLicense = async () => {
    try {
      const res = await authFetch(`${API_BASE}/license/status`);
      if (res.ok) setLicenseStatus(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleLicenseRenew = async () => {
    setIsWaitingForPayment(true);
    try {
      const res = await authFetch(`${API_BASE}/license/renew`, { method: 'POST' });
      if (res.ok) {
        addToast("Renewal STK Push sent...", "info");
      } else {
        setIsWaitingForPayment(false);
        addToast("Renewal failed", "error");
      }
    } catch (err) {
      setIsWaitingForPayment(false);
      addToast(err.message, "error");
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
    let reconnectTimer;
    
    const connect = () => {
      try {
        ws = new WebSocket(WS_BASE);
        ws.onopen = () => console.log("Connected to Stockwatch Sync Server");
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'REFRESH_INVENTORY') {
              fetchInventory();
            } else if (data.type === 'REFRESH_SETTINGS') {
              fetchLicense();
            } else if (data.type === 'BARCODE_SCANNED') {
              if (handleScanRef.current) handleScanRef.current(data.barcode);
            } else if (data.type === 'PAYMENT_SUCCESS') {
              setIsWaitingForPayment(false);
              addToast("M-Pesa Payment Received!", "success");
            } else if (data.type === 'LICENSE_RENEWED') {
              setIsWaitingForPayment(false);
              addToast("Subscription Renewed!", "success");
              fetchLicense();
            } else if (data.type === 'PAYMENT_FAILED') {
              setIsWaitingForPayment(false);
              addToast("M-Pesa Payment Failed", "error");
            }
          } catch (err) {
            console.error("WS Parse Error:", err);
          }
        };
        ws.onclose = () => {
          console.warn("Sync Server Disconnected. Retrying...");
          reconnectTimer = setTimeout(connect, 5000);
        };
        ws.onerror = (err) => {
          console.error("WS Socket Error:", err);
          ws.close();
        };
      } catch (err) {
        console.error("WS Setup Error:", err);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
    
    connect();
    return () => { 
      if (ws) ws.close(); 
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
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
    fetchLicense();
    if (isAdmin) {
      fetchLiveStaff();
      const interval = setInterval(fetchLiveStaff, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!customerSearch && !activeCustomer && isWaitingForPayment) {
      setIsWaitingForPayment(false);
    }
  }, [customerSearch, activeCustomer, isWaitingForPayment]);

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
      setTimeout(() => {
        navigate('/login');
      }, 300);
    }
  };

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
      fetchInventory();
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
    if (newQty < 0) return;
    
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
      fetchInventory();
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
    try {
      const res = await authFetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      addToast(`${name} deleted`);
    } catch (err) {
      addToast(err.message, 'error');
      fetchInventory();
    }
  };

  const checkAlerts = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/alerts`);
      const data = await res.json();
      addToast(data.message);
    } catch (_err) {
      addToast('Failed to run alerts', 'error');
    }
  };

  const filteredItems = Array.isArray(items) ? items.filter(i => 
    (i.name || '').toLowerCase().includes((searchFilter || '').toLowerCase()) || 
    (i.barcode && i.barcode.includes(searchFilter))
  ) : [];

  const totalItems = filteredItems.length;
  const lowStockCount = filteredItems.filter(item => item.quantity < item.threshold).length;

  const currentTheme = localStorage.getItem('theme') || 'light';

  return (
    <div className="inventory-page">
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>
            {isAdmin ? 'Business Overview' : (licenseStatus?.shop_name || 'Sales Terminal')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            {isAdmin ? 'Real-time inventory intelligence and shop performance' : `Welcome back, ${username}! Terminal is ready.`}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
           <button 
             className={`btn btn-ghost ${pingStatus === 'pinging' ? 'animate-pulse' : ''}`} 
             onClick={handlePing}
             title="Ping Africa (Nairobi Status)"
             style={{ color: pingStatus === 'online' ? 'var(--accent-secondary)' : pingStatus === 'error' ? 'var(--accent-danger)' : 'inherit' }}
           >
             <LinkIcon size={18} />
             {pingStatus === 'online' && <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>NG</span>}
           </button>
           <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>QTY</span>
              <input 
                type="number" 
                min="1" 
                value={qtyMultiplier} 
                onChange={(e) => setQtyMultiplier(parseInt(e.target.value) || 1)}
                onFocus={(e) => e.target.select()}
                style={{ width: '50px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 800, textAlign: 'center', padding: 0 }}
              />
           </div>
           <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ maxWidth: '300px', width: '100%', paddingLeft: '44px', paddingRight: '44px' }}
              />
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              {searchFilter && (
                <button 
                  onClick={() => setSearchFilter('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
           </div>
           <button className="btn btn-ghost" onClick={checkAlerts}>
             <Bell size={18} />
             {lowStockCount > 0 && <span style={{ width: '8px', height: '8px', background: 'var(--accent-danger)', borderRadius: '50%', position: 'absolute', top: '10px', right: '14px' }}></span>}
           </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {!isAdmin && (
          <div className="card metric-card" style={{ background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)', border: 'none' }}>
             <div className="metric-header">
                <div className="metric-label" style={{ color: 'rgba(255,255,255,0.8)' }}>My Performance</div>
                <TrendingUp size={20} color="white" />
             </div>
             <div className="metric-value" style={{ color: 'white' }}>
               {performance.find(p => p.username === username)?.transactions || 0} Sales
             </div>
             <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Recorded today</p>
          </div>
        )}

        <div className="card metric-card">
          <div className="metric-header">
            <div className="metric-label">Total Inventory</div>
            <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
              <Package size={20} />
            </div>
          </div>
          <div className="metric-value">
            {Array.isArray(items) ? items.reduce((acc, i) => acc + (i.quantity || 0), 0).toLocaleString() : 0}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Units across all products</div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <div className="metric-label">Stock Alerts</div>
            <div className="metric-icon" style={{ background: lowStockCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: lowStockCount > 0 ? 'var(--accent-danger)' : 'var(--accent-secondary)' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: lowStockCount > 0 ? 'var(--accent-danger)' : 'inherit' }}>
            {lowStockCount}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Products below threshold</div>
        </div>
      </div>
      
      {/* Velocity / Burn Status Strip - Removed for Cashiers per request */}

      {licenseStatus?.is_expired && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          animation: 'fadeIn 0.5s ease'
        }}>
          <div className="glass-panel" style={{ width: '450px', padding: '40px', textAlign: 'center', boxShadow: '0 0 100px rgba(59, 130, 246, 0.3)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
            <h1 style={{ marginBottom: '16px' }}>Subscription Expired</h1>
            <p style={{ opacity: 0.7, marginBottom: '30px' }}>
              Your monthly access to Stockwatch has ended. 
              Please renew to continue managing your inventory and processing sales.
            </p>
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.5 }}>RENEWAL FEE</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>Ksh 4,500</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Monthly Standard License</div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleLicenseRenew}
              disabled={isWaitingForPayment}
              style={{ width: '100%', padding: '16px', fontSize: '1rem', fontWeight: 700 }}
            >
              {isWaitingForPayment ? '⏳ Waiting for PIN...' : '📲 Renew via M-Pesa STK Push'}
            </button>
            <p style={{ marginTop: '20px', fontSize: '0.75rem', opacity: 0.4 }}>
              The popup will appear on the owner's phone ending in {licenseStatus?.owner_phone?.slice(-4) || 'XXXX'}
            </p>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Active Shop Inventory</h2>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '14px', border: '1px solid var(--panel-border)' }}>
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
            
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ 
                  padding: '10px 16px 10px 40px', background: 'rgba(255,255,255,0.07)', 
                  border: '1px solid var(--panel-border)', borderRadius: '12px', width: '250px',
                  fontSize: '0.85rem', color: 'var(--text-primary)', outline: 'none'
                }}
              />
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.7 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-secondary)' }}></div>
              Synced
            </div>
          </div>
        </div>
        {loading ? (
          <div className="spinner"></div>
        ) : (!Array.isArray(items) || items.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-secondary)' }}>
            <Package size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
            <p>Shop is currently empty. Initialize inventory to begin.</p>
          </div>
        ) : (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Product Details</th>
              <th style={{ textAlign: 'center' }}>Unit Price</th>
              <th style={{ textAlign: 'center' }}>Stock Level</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(filteredItems) && filteredItems.map((item) => {
              const isLow = item.quantity < item.threshold;
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '40px', height: '40px', background: 'var(--bg-secondary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                        <Package size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>#SW-{item.id.toString().padStart(4, '0')}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    Ksh {item.price.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <span style={{ fontWeight: 700, color: isLow ? 'var(--accent-danger)' : 'inherit' }}>{item.quantity}</span>
                       <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.625rem', marginTop: '4px' }}>
                         {isLow ? 'Low' : 'OK'}
                       </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className={`btn ${scanMode === 'sales' ? 'btn-primary' : 'btn-secondary'}`} 
                        style={{ padding: '6px 14px', fontSize: '0.8125rem', background: scanMode === 'restock' ? 'var(--accent-secondary)' : '' }} 
                        onClick={() => {
                          if (scanMode === 'sales') {
                            addToCart(item, -qtyMultiplier);
                            setQtyMultiplier(1);
                          } else {
                            updateQuantity(item.id, item.quantity, qtyMultiplier);
                            setQtyMultiplier(1);
                          }
                        }}
                      >
                        {scanMode === 'sales' ? 'Sell' : 'Restock'}
                      </button>
                      {isAdmin && (
                        <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => handleEditClick(item)}>
                          <SettingsIcon size={16} />
                        </button>
                      )}
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

      {isModalOpen && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) setIsModalOpen(false);
        }}>
          <div className="glass-panel modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Add New Product</h2>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} /> Advanced: Happy Hour Pricing
                  </div>
                </summary>
                <div className="advanced-content">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Sale Price (Ksh)</label>
                      <input type="number" min="0" max="9999999" step="0.01" value={newItem.sale_price} onChange={e => setNewItem({...newItem, sale_price: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="form-group">
                      <label>Active Days</label>
                      <input type="text" value={newItem.sale_days} onChange={e => setNewItem({...newItem, sale_days: e.target.value})} placeholder="Mon,Tue,Wed..." />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
      )}

      {isEditModalOpen && editingItem && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) setIsEditModalOpen(false);
        }}>
          <div className="glass-panel modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Edit {editingItem.name}</h2>
              <button className="btn-ghost" onClick={() => setIsEditModalOpen(false)} style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Product Name</label>
                <input type="text" required value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Current Quantity</label>
                  <input type="number" required value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Low Stock Threshold</label>
                  <input type="number" required value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Unit Price (Sale)</label>
                  <input type="number" required step="0.01" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Buying Price (Cost)</label>
                  <input type="number" required step="0.01" value={editingItem.cost_price} onChange={e => setEditingItem({...editingItem, cost_price: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Supplier Contact (Optional)</label>
                <input type="text" value={editingItem.supplier_contact || ''} onChange={e => setEditingItem({...editingItem, supplier_contact: e.target.value})} />
              </div>

              <details className="advanced-settings">
                <summary>Advanced: Special Pricing</summary>
                <div className="advanced-content">
                   <div className="form-group">
                    <label>Special Price (Ksh)</label>
                    <input type="number" step="0.01" value={editingItem.sale_price || ''} onChange={e => setEditingItem({...editingItem, sale_price: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Active Days (e.g. Mon,Tue)</label>
                    <input type="text" value={editingItem.sale_days || ''} onChange={e => setEditingItem({...editingItem, sale_days: e.target.value})} />
                  </div>
                </div>
              </details>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLinkModalOpen && (
        <div className="modal-overlay active" onClick={(e) => {
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
              <input type="text" placeholder="Filter products..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} style={{ marginBottom: '12px' }} />
            </div>
            {isAdmin && (
              <button className="btn btn-primary" style={{ width: '100%', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} onClick={handleRegisterNew}>
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
                  <button key={item.id} className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '12px 16px', textAlign: 'left', width: '100%' }} onClick={() => handleLinkBarcode(item.id)}>
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
      )}

      {/* Cart Drawer (Professional POS) */}
      <div className={`side-drawer ${(isCartOpen || sessions.some(s => s.cart.length > 0) || activeSessionIndex > 0) ? 'open' : ''}`}>
        <div className="drawer-header">
           <h3 style={{ margin: 0 }}>Active Checkout</h3>
           <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ padding: '6px' }} onClick={addSession}><Plus size={18} /></button>
              <button className="btn btn-ghost" style={{ padding: '6px', color: 'var(--accent-danger)' }} onClick={() => {
                if (window.confirm("Clear all items in this session?")) setCart([]);
              }}><Trash2 size={18} /></button>
           </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', padding: '8px 16px', overflowX: 'auto', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          {sessions.map((s, idx) => (
            <div key={s.id} onClick={() => setActiveSessionIndex(idx)} style={{ 
              padding: '6px 12px', borderRadius: '8px', 
              background: idx === activeSessionIndex ? 'var(--accent-primary)' : 'var(--surface)',
              color: idx === activeSessionIndex ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
              border: '1px solid var(--border)', whiteSpace: 'nowrap'
            }}>
              {s.activeCustomer?.name?.split(' ')[0] || `Session ${idx + 1}`} ({s.cart.length})
              {sessions.length > 1 && <X size={12} onClick={(e) => closeSession(idx, e)} />}
            </div>
          ))}
        </div>

        <div className="drawer-content">
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
               <Package size={48} />
               <p style={{ marginTop: '16px' }}>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    Ksh {item.price.toLocaleString()} × 
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px 4px' }}>
                      <button onClick={() => { if (Math.abs(item.qty_change) > 1) addToCart(item, 1); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}><Minus size={14} /></button>
                      <input 
                        type="number" 
                        value={Math.abs(item.qty_change)} 
                        onChange={(e) => {
                          const newVal = Math.max(1, parseInt(e.target.value) || 1);
                          setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty_change: -newVal } : i));
                        }}
                        onFocus={(e) => e.target.select()}
                        style={{ width: '35px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 700, padding: 0 }}
                      />
                      <button onClick={() => addToCart(item, -1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontWeight: 700 }}>Ksh {(item.price * Math.abs(item.qty_change)).toLocaleString()}</div>
                  <button className="btn btn-ghost" style={{ padding: '6px', color: 'var(--accent-danger)' }} onClick={() => removeFromCart(item.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-footer">
          {activeCustomer ? (
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Customer Linked</div>
                  <div style={{ fontWeight: 700 }}>{activeCustomer.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{activeCustomer.phone}</div>
                </div>
                <button className="btn-ghost" style={{ padding: '4px' }} onClick={() => setActiveCustomer(null)}><X size={14} /></button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input type="text" placeholder="Search or Register Customer..." value={customerSearch} onChange={e => handleCustomerSearch(e.target.value)} style={{ fontSize: '0.875rem' }} />
                  {customerResults.length > 0 && (
                    <div className="card" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 100, padding: '8px', marginBottom: '8px' }}>
                      {customerResults.map(c => (
                        <div key={c.id} onClick={() => { setActiveCustomer(c); setCustomerResults([]); }} style={{ padding: '12px', cursor: 'pointer', borderRadius: '8px' }} className="nav-item">
                           <div style={{ fontWeight: 600 }}>{c.name}</div>
                           <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{c.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost" onClick={handleCreateCustomer} title="Register New Customer" style={{ padding: '8px', border: '1px solid var(--border)' }}>
                  <UserPlus size={18} />
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
             {['Cash', 'M-Pesa', 'Credit'].map(m => (
               <button key={m} className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: '0.75rem', padding: '8px' }} onClick={() => {
                 if (m === 'Credit' && !activeCustomer) return addToast("Select customer for credit", "warning");
                 setPaymentMethod(m);
               }}>{m}</button>
             ))}
          </div>

          {paymentMethod === 'M-Pesa' && (
             <div style={{ marginBottom: '20px' }}>
               <input type="text" placeholder="M-Pesa Ref Code" value={mpesaCode} onChange={e => setMpesaCode(e.target.value)} style={{ fontSize: '0.875rem', marginBottom: '8px' }} />
               <button className="btn btn-primary" onClick={handleStkPush} style={{ width: '100%', fontSize: '0.8125rem' }}>Send STK Push</button>
             </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Grand Total</span>
             <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
               Ksh {cart.reduce((acc, i) => acc + (i.price * Math.abs(i.qty_change)), 0).toLocaleString()}
             </span>
          </div>
          
          <button className="btn btn-primary" style={{ width: '100%', height: '52px', fontSize: '1rem' }} onClick={handleCheckout} disabled={cart.length === 0}>
            Complete Transaction
          </button>
        </div>
      </div>




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

