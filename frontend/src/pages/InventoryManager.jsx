import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, Package, Tag, Truck, 
  AlertTriangle, MoreVertical, Edit2, Trash2,
  Calendar, Check, X, ArrowUpRight, Barcode
} from 'lucide-react';
import { authFetch } from '../authFetch';
import { API_BASE } from '../config';

const InventoryManager = () => {
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchData = React.useCallback(async () => {
    try {
      const [invRes, catRes, supRes] = await Promise.all([
        authFetch(`${API_BASE}/inventory`),
        authFetch(`${API_BASE}/categories`),
        authFetch(`${API_BASE}/suppliers`)
      ]);
      
      if (invRes.ok) setItems(await invRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleAction = (e) => {
      const { action } = e.detail;
      if (action === 'new-product') {
        setCurrentItem({});
        setIsAddModalOpen(true);
      }
    };
    window.addEventListener('inventory-action', handleAction);
    return () => window.removeEventListener('inventory-action', handleAction);
  }, []);

  const filteredItems = items.filter(item => {
    const itemName = item.name || '';
    const matchesSearch = itemName.toLowerCase().includes(search.toLowerCase()) || 
                         (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || item.category_id === parseInt(filterCategory);
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Ensure numeric fields are correctly typed
    const payload = {
      ...currentItem,
      quantity: parseInt(currentItem.quantity) || 0,
      threshold: parseInt(currentItem.threshold) || 0,
      price: parseFloat(currentItem.price) || 0,
      cost_price: parseFloat(currentItem.cost_price) || 0,
      category_id: currentItem.category_id ? parseInt(currentItem.category_id) : null,
      supplier_id: currentItem.supplier_id ? parseInt(currentItem.supplier_id) : null
    };

    const method = currentItem.id ? 'PUT' : 'POST';
    const url = currentItem.id ? `${API_BASE}/inventory/${currentItem.id}` : `${API_BASE}/inventory`;
    
    try {
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        addToast(currentItem.id ? 'Product updated' : 'Product added');
        fetchData();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Operation failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('Product deleted');
        fetchData();
      } else {
        addToast('Delete failed', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'SKU', 'Quantity', 'Price', 'Cost Price'];
    const rows = items.map(i => [i.id, i.name, i.sku, i.quantity, i.price, i.cost_price]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    addToast('Exported successfully');
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const data = lines.slice(1).filter(l => l.trim()).map(line => {
        const values = line.split(',');
        return {
          name: values[1],
          sku: values[2],
          quantity: parseInt(values[3]),
          price: parseFloat(values[4]),
          cost_price: parseFloat(values[5]),
          threshold: 5,
          barcode: values[2] // Use SKU as default barcode if not provided
        };
      });

      try {
        const res = await authFetch(`${API_BASE}/inventory/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const result = await res.json();
          addToast(result.message);
          fetchData();
        }
      } catch (err) {
        addToast('Import failed', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handlePrintBarcodes = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/barcodes`);
      if (res.ok) {
        const barcodes = await res.json();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head><title>Inventory Barcodes</title></head>
            <body style="font-family: sans-serif; padding: 20px;">
              <h2>System Barcode Registry</h2>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                ${barcodes.map(b => `
                  <div style="border: 1px solid #eee; padding: 10px; text-align: center;">
                    <div style="font-size: 10px; margin-bottom: 5px;">${b.name}</div>
                    <div style="font-weight: bold;">${b.barcode}</div>
                  </div>
                `).join('')}
              </div>
              <script>window.onload = () => window.print();</script>
            </body>
          </html>
        `);
      }
    } catch (err) {
      addToast('Failed to load barcodes', 'error');
    }
  };

  return (
    <div className="inventory-manager animate-fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Product Catalog</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage SKUs, stock levels, and supply chain variants</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
           <button className="btn btn-primary" onClick={() => { setCurrentItem({}); setIsAddModalOpen(true); }} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
             <Plus size={18} /> Add Product
           </button>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="filters-bar glass-panel responsive-flex">
        <div className="search-box" style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by name, SKU or barcode..." 
            className="input-field" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 48px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="input-field" 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
          >
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-ghost" style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="table-container glass-panel" style={{ overflowX: 'auto' }}>
        <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Product Information</th>
              <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Category</th>
              <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock Status</th>
              <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Expiry Status</th>
              <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pricing</th>
              <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const getExpiryStatus = (date) => {
                if (!date) return { label: 'No Date', color: 'var(--text-muted)' };
                const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
                if (diff < 0) return { label: 'Expired', color: '#ef4444' };
                if (diff < 14) return { label: `${diff} days left`, color: '#f59e0b' };
                return { label: 'Healthy', color: '#10b981' };
              };
              const expiry = getExpiryStatus(item.expiry_date);
              
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover-row">
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        <Package size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Tag size={12} /> {item.sku || 'No SKU'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Barcode size={12} /> {item.barcodes?.[0] || 'Unlinked'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {categories.find(c => c.id === item.category_id)?.name || 'General'}
                    </span>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: 700, color: item.quantity <= item.threshold ? '#ef4444' : '#10b981' }}>
                        {item.quantity} {item.unit_measure || 'pcs'}
                      </div>
                      <div className="progress-bar" style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                         <div style={{ 
                           width: `${Math.min((item.quantity / (item.threshold * 2)) * 100, 100)}%`, 
                           height: '100%', 
                           background: item.quantity <= item.threshold ? '#ef4444' : '#10b981' 
                         }}></div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: expiry.color, fontSize: '0.85rem', fontWeight: 600 }}>
                      <Calendar size={14} />
                      {expiry.label}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 700 }}>Ksh {item.price?.toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cost: Ksh {item.cost_price?.toLocaleString()}</div>
                  </td>
                <td style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setCurrentItem(item); setIsEditModalOpen(true); }} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }} title="Edit"><Edit2 size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id, item.name); }} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: '#ef4444' }} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </td>
                  </tr>
                );
              })}
            </tbody>
        </table>
      </div>

      {/* Product Editor Modal */}
      {(isEditModalOpen || isAddModalOpen) && (
        <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', paddingTop: '80px', justifyContent: 'center', backdropFilter: 'blur(8px)', opacity: 1, visibility: 'visible' }}>
          <div className="modal-content glass-panel animate-scale-up" style={{ width: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
               <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{isEditModalOpen ? 'Edit Product' : 'Add New Product'}</h2>
               <button onClick={() => { setIsEditModalOpen(false); setIsAddModalOpen(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Product Name</label>
                  <input 
                    type="text" required className="input-field"
                    value={currentItem.name || ''}
                    onChange={e => setCurrentItem({...currentItem, name: e.target.value})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>
                
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>SKU / Internal ID</label>
                  <input 
                    type="text" className="input-field"
                    value={currentItem.sku || ''}
                    onChange={e => setCurrentItem({...currentItem, sku: e.target.value})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>
                
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Category</label>
                  <select 
                    className="input-field"
                    value={currentItem.category_id || ''}
                    onChange={e => setCurrentItem({...currentItem, category_id: parseInt(e.target.value)})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Selling Price (Ksh)</label>
                  <input 
                    type="number" required className="input-field"
                    value={currentItem.price || ''}
                    onChange={e => setCurrentItem({...currentItem, price: parseFloat(e.target.value)})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Cost Price (Ksh)</label>
                  <input 
                    type="number" className="input-field"
                    value={currentItem.cost_price || ''}
                    onChange={e => setCurrentItem({...currentItem, cost_price: parseFloat(e.target.value)})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>

                <div className="form-group">
                   <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Current Stock</label>
                   <input 
                    type="number" required className="input-field"
                    value={currentItem.quantity || ''}
                    onChange={e => setCurrentItem({...currentItem, quantity: parseInt(e.target.value)})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>

                <div className="form-group">
                   <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Low Stock Threshold</label>
                   <input 
                    type="number" required className="input-field"
                    value={currentItem.threshold || ''}
                    onChange={e => setCurrentItem({...currentItem, threshold: parseInt(e.target.value)})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>

                <div className="form-group">
                   <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Expiry Date</label>
                   <input 
                    type="date" className="input-field"
                    value={currentItem.expiry_date || ''}
                    onChange={e => setCurrentItem({...currentItem, expiry_date: e.target.value})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>

                <div className="form-group">
                   <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Unit (e.g. pcs, kg, l)</label>
                   <input 
                    type="text" className="input-field"
                    value={currentItem.unit_measure || 'pcs'}
                    onChange={e => setCurrentItem({...currentItem, unit_measure: e.target.value})}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                <button type="button" onClick={() => { setIsEditModalOpen(false); setIsAddModalOpen(false); }} className="btn btn-ghost" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--accent-primary)', border: 'none', color: '#fff', fontWeight: 700 }}>Save Changes</button>
              </div>
            </form>
          </div>
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

export default InventoryManager;
