import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, ArrowRight, ShieldCheck, TrendingDown, Package, Search } from 'lucide-react';
import { authFetch } from '../authFetch';
import { API_BASE, WS_BASE } from '../config';



export default function ExpiryRisk() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [discount, setDiscount] = useState(20);
  const [daysWindow, setDaysWindow] = useState(30);

  const fetchExpiryRisk = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/reports/expiry-risk?days=${daysWindow}`);
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch expiry risk', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryRisk();
  }, [daysWindow]);

  const toggleSelect = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const applyDiscount = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Apply ${discount}% discount to ${selectedItems.length} items?`)) return;

    try {
      const res = await authFetch(`${API_BASE}/inventory/clearance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: selectedItems, discount_percent: discount })
      });
      if (res.ok) {
        alert('Discount applied successfully!');
        setSelectedItems([]);
        fetchExpiryRisk();
      }
    } catch (err) {
      alert('Failed to apply discount');
    }
  };

  const getRiskLevel = (date) => {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 7) return { label: 'High Risk', color: 'var(--accent-danger)', icon: <AlertTriangle size={14} /> };
    if (diff < 14) return { label: 'Medium Risk', color: 'var(--accent-warning)', icon: <Calendar size={14} /> };
    return { label: 'Low Risk', color: 'var(--accent-secondary)', icon: <ShieldCheck size={14} /> };
  };

  return (
    <div className="page-container" style={{ padding: '40px' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Expiry Risk Control</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px' }}>
            Identify and manage inventory items nearing their expiration dates. Apply proactive discounts to ensure stock movement before loss.
          </p>
        </div>
        <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>Analysis Window:</span>
            <select 
              value={daysWindow} 
              onChange={(e) => setDaysWindow(e.target.value)}
              className="btn btn-ghost"
              style={{ border: 'none', background: 'transparent', padding: '4px' }}
            >
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
            </select>
        </div>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: '40px' }}>
        <div className="card metric-card">
          <div className="metric-header">
            <div className="metric-label">Items at Risk</div>
            <AlertTriangle size={20} color="var(--accent-danger)" />
          </div>
          <div className="metric-value">{items.length}</div>
          <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>Across selected window</p>
        </div>
        <div className="card metric-card">
          <div className="metric-header">
            <div className="metric-label">Potential Loss Value</div>
            <TrendingDown size={20} color="var(--accent-warning)" />
          </div>
          <div className="metric-value">Ksh {items.reduce((acc, i) => acc + (i.cost_price * i.quantity), 0).toLocaleString()}</div>
          <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>Based on cost price</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 350px', alignItems: 'start', gap: '32px' }}>
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    onChange={(e) => setSelectedItems(e.target.checked ? items.map(i => i.id) : [])}
                    checked={selectedItems.length === items.length && items.length > 0}
                  />
                </th>
                <th>Product</th>
                <th>Expiry Date</th>
                <th>Quantity</th>
                <th>Current Price</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>Analyzing inventory...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No items at risk in this window.</td></tr>
              ) : items.map(item => {
                const risk = getRiskLevel(item.expiry_date);
                return (
                  <tr key={item.id} className={selectedItems.includes(item.id) ? 'selected' : ''}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>ID: #{item.id}</div>
                    </td>
                    <td>{new Date(item.expiry_date).toLocaleDateString()}</td>
                    <td>{item.quantity} units</td>
                    <td>Ksh {item.price.toLocaleString()}</td>
                    <td>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '6px', 
                        color: risk.color, fontSize: '0.8125rem', fontWeight: 600,
                        background: `${risk.color}15`, padding: '4px 10px', borderRadius: '20px',
                        width: 'fit-content'
                      }}>
                        {risk.icon}
                        {risk.label}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ position: 'sticky', top: '32px' }}>
          <h3>Bulk Action: Clearance</h3>
          <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '24px' }}>
            Apply discounts to selected items to accelerate sales before expiration.
          </p>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Discount Percentage</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                type="range" 
                min="5" 
                max="90" 
                step="5"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontWeight: 700, fontSize: '1.25rem', width: '60px' }}>{discount}%</span>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '16px', gap: '12px' }}
            disabled={selectedItems.length === 0}
            onClick={applyDiscount}
          >
            <TrendingDown size={20} />
            Apply to {selectedItems.length} Items
          </button>
          
          {selectedItems.length > 0 && (
            <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8125rem' }}>
              <strong>Preview:</strong> Selected items will be discounted by {discount}%. This action is permanent but can be reverted manually in Inventory Manager.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


