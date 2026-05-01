import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { authFetch } from '../authFetch';
import { 
  X, Settings, Package, Bell, 
  Printer, Mail, Database, Globe,
  Landmark, ShieldCheck, Check, Menu
} from 'lucide-react';

const Layout = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || '#6366f1');
  const [nightLight, setNightLight] = useState(localStorage.getItem('nightLight') === 'true');
  const [eyeProtection, setEyeProtection] = useState(localStorage.getItem('eyeProtection') === 'true');
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebarCollapsed') === 'true');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('role') === 'admin' ? 'Business Profile' : 'Themes');
  const [settings, setSettings] = useState({
    shop_name: '', owner_phone: '', shop_location: '', shop_email: '',
    shop_footer: '', currency: 'Ksh', tax_id: '', vat_rate: 16.0,
    low_stock_threshold: 20, enable_email_alerts: false,
    smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '',
    smtp_sender: '', auto_backup: true, timezone: 'Africa/Nairobi'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchSettings = async () => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') return;
    
    try {
      const res = await authFetch(`http://${window.location.hostname}:8000/api/admin/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  useEffect(() => {
    if (isSettingsOpen) fetchSettings();
  }, [isSettingsOpen]);

  useEffect(() => {
    // Apply theme to body
    const themeClasses = ['dark-mode', 'midnight-theme', 'arctic-theme', 'slate-theme'];
    document.body.classList.remove(...themeClasses);
    if (theme !== 'light') {
      document.body.classList.add(theme);
    }
    document.documentElement.style.setProperty('--accent-primary', accentColor);
    localStorage.setItem('theme', theme);
    localStorage.setItem('accentColor', accentColor);
    
    // Apply special visual modes
    if (nightLight) document.body.classList.add('night-light');
    else document.body.classList.remove('night-light');
    
    if (eyeProtection) document.body.classList.add('eye-protection');
    else document.body.classList.remove('eye-protection');

    localStorage.setItem('nightLight', nightLight);
    localStorage.setItem('eyeProtection', eyeProtection);
  }, [theme, accentColor, nightLight, eyeProtection]);

  const handleSave = async () => {
    // Basic Validation
    if (!settings.owner_phone || !settings.owner_phone.trim()) {
      setNotification({ type: 'error', message: 'Owner phone is required for M-Pesa updates' });
      return;
    }

    if (isNaN(settings.vat_rate)) {
      setNotification({ type: 'error', message: 'Invalid VAT rate' });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      const res = await authFetch(`http://${window.location.hostname}:8000/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        setNotification({ type: 'success', message: 'Configuration saved successfully!' });
        setTimeout(() => {
          setIsSettingsOpen(false);
          setNotification(null);
        }, 1500);
      } else {
        const errorData = await res.json();
        setNotification({ type: 'error', message: errorData.detail || 'Failed to save configuration' });
      }
    } catch (err) {
      console.error("Save failed:", err);
      setNotification({ type: 'error', message: 'Network error: Could not reach the server' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', newState);
      return newState;
    });
  };

  // Listen for global actions from sidebar
  useEffect(() => {
    const handleAction = (e) => {
      const { action, payload } = e.detail;
      if (action === 'settings') {
        if (payload) {
          const isAdmin = localStorage.getItem('role') === 'admin';
          if (payload === 'Business Profile' && !isAdmin) setActiveTab('Themes');
          else setActiveTab(payload);
        }
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener('inventory-action', handleAction);
    return () => window.removeEventListener('inventory-action', handleAction);
  }, []);

  // Expose theme switcher and sidebar toggle
  useEffect(() => {
    window.toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark-mode' : 'light');
    return () => delete window.toggleTheme;
  }, []);

  const isAdmin = localStorage.getItem('role') === 'admin';
  const settingsTabs = [
    { name: 'Business Profile', icon: <Package size={18} />, adminOnly: true },
    { name: 'Tax & Finance', icon: <Landmark size={18} />, adminOnly: true },
    { name: 'Inventory Alerts', icon: <Bell size={18} />, adminOnly: true },
    { name: 'Thermal Printer', icon: <Printer size={18} /> },
    { name: 'Email/SMS SMTP', icon: <Mail size={18} />, adminOnly: true },
    { name: 'Backup & Sync', icon: <Database size={18} />, adminOnly: true },
    { name: 'Localization', icon: <Globe size={18} /> },
    { name: 'Themes', icon: <Settings size={18} /> },
  ].filter(tab => !tab.adminOnly || isAdmin);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [window.location.pathname]);

  return (
    <div className="layout-wrapper">
      <div className="mesh-bg" />
      
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={20} color="var(--accent-primary)" />
          <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>STOCKWATCH</span>
        </div>
        <div style={{ width: '40px' }} /> {/* Spacer */}
      </header>

      {/* Mobile Sidebar Overlay */}
      <div 
        className={`side-drawer-overlay ${mobileMenuOpen ? 'active' : ''}`} 
        onClick={() => setMobileMenuOpen(false)} 
        style={{ zIndex: 199 }}
      />

      <Sidebar 
        isCollapsed={isCollapsed} 
        onToggle={toggleSidebar} 
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      
      <main className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>

      {/* Global Settings Drawer */}
      <div className={`side-drawer-overlay ${isSettingsOpen ? 'active' : ''}`} onClick={() => setIsSettingsOpen(false)} />
      <div className={`side-drawer ${isSettingsOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px', color: 'var(--accent-primary)' }}>
              <Settings size={20} />
            </div>
            <h3 style={{ margin: 0 }}>System Control</h3>
          </div>
          <button className="btn-ghost" onClick={() => setIsSettingsOpen(false)} style={{ padding: '8px' }}><X size={20} /></button>
        </div>

        <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          <div className="settings-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
             {settingsTabs.map(tab => (
               <button 
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`btn ${activeTab === tab.name ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '8px 12px', borderRadius: '8px' }}
               >
                 {tab.icon} {tab.name}
               </button>
             ))}
          </div>

          <div className="settings-pane glass-panel animate-fade-in" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{activeTab}</h4>
               <span className="badge badge-success">Configuration</span>
             </div>

             {notification && (
               <div className={`animate-slide-in`} style={{ 
                 padding: '12px', 
                 borderRadius: '8px', 
                 background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                 color: notification.type === 'success' ? '#10b981' : '#ef4444',
                 border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                 fontSize: '0.875rem',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px'
               }}>
                 <ShieldCheck size={16} />
                 {notification.message}
               </div>
             )}

             <div className="settings-fields" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeTab === 'Business Profile' && isAdmin && (
                  <>
                    <div>
                      <label className="field-label">BUSINESS NAME</label>
                      <input type="text" value={settings.shop_name} onChange={e => setSettings({...settings, shop_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="field-label">OWNER PHONE (M-PESA)</label>
                      <input type="text" value={settings.owner_phone} onChange={e => setSettings({...settings, owner_phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="field-label">STORE LOCATION</label>
                      <input type="text" value={settings.shop_location} onChange={e => setSettings({...settings, shop_location: e.target.value})} />
                    </div>
                    <div>
                      <label className="field-label">SUPPORT EMAIL</label>
                      <input type="email" value={settings.shop_email} onChange={e => setSettings({...settings, shop_email: e.target.value})} />
                    </div>
                    <div>
                      <label className="field-label">RECEIPT FOOTER</label>
                      <textarea value={settings.shop_footer} onChange={e => setSettings({...settings, shop_footer: e.target.value})} rows={2} />
                    </div>
                  </>
                )}

                {activeTab === 'Tax & Finance' && (
                  <>
                    <div>
                      <label className="field-label">TAX ID / KRA PIN</label>
                      <input type="text" value={settings.tax_id} onChange={e => setSettings({...settings, tax_id: e.target.value})} />
                    </div>
                    <div>
                      <label className="field-label">VAT RATE (%)</label>
                      <input type="number" step="0.1" value={settings.vat_rate} onChange={e => setSettings({...settings, vat_rate: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="field-label">CURRENCY SYMBOL</label>
                      <select value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})}>
                        <option value="Ksh">KES (Ksh)</option>
                        <option value="$">USD ($)</option>
                        <option value="€">EUR (€)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'Inventory Alerts' && (
                  <>
                    <div>
                      <label className="field-label">GLOBAL LOW STOCK THRESHOLD (%)</label>
                      <input type="number" value={settings.low_stock_threshold} onChange={e => setSettings({...settings, low_stock_threshold: parseInt(e.target.value)})} />
                    </div>
                    <div className="form-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                       <span>Enable Email Notifications</span>
                       <input type="checkbox" checked={settings.enable_email_alerts} onChange={e => setSettings({...settings, enable_email_alerts: e.target.checked})} />
                    </div>
                  </>
                )}

                {activeTab === 'Thermal Printer' && (
                  <div style={{ textAlign: 'center', padding: '40px 0', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                     <Printer size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                     <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No printer connected via Bluetooth or USB.</p>
                     <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                        <button className="btn btn-primary btn-sm">Scan USB</button>
                        <button className="btn btn-ghost btn-sm">Bluetooth Pair</button>
                     </div>
                  </div>
                )}

                {activeTab === 'Email/SMS SMTP' && (
                  <>
                    <div>
                      <label className="field-label">SMTP HOST</label>
                      <input type="text" placeholder="smtp.gmail.com" value={settings.smtp_host || ''} onChange={e => setSettings({...settings, smtp_host: e.target.value})} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="field-label">SMTP PORT</label>
                        <input type="number" value={settings.smtp_port} onChange={e => setSettings({...settings, smtp_port: parseInt(e.target.value)})} />
                      </div>
                      <div>
                        <label className="field-label">SENDER ADDRESS</label>
                        <input type="email" value={settings.smtp_sender || ''} onChange={e => setSettings({...settings, smtp_sender: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">SMTP USERNAME</label>
                      <input type="text" value={settings.smtp_user || ''} onChange={e => setSettings({...settings, smtp_user: e.target.value})} />
                    </div>
                    <div>
                      <label className="field-label">SMTP PASSWORD</label>
                      <input type="password" value={settings.smtp_pass || ''} onChange={e => setSettings({...settings, smtp_pass: e.target.value})} />
                    </div>
                  </>
                )}

                {activeTab === 'Backup & Sync' && (
                  <>
                    <div className="form-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                       <span>Automated Daily Backup</span>
                       <input type="checkbox" checked={settings.auto_backup} onChange={e => setSettings({...settings, auto_backup: e.target.checked})} />
                    </div>
                    <div style={{ marginTop: '12px' }}>
                       <button className="btn btn-ghost" style={{ width: '100%' }}>
                         <Database size={16} style={{ marginRight: '8px' }} /> Download Manual Backup (.db)
                       </button>
                    </div>
                  </>
                )}

                {activeTab === 'Localization' && (
                  <>
                    <div>
                      <label className="field-label">SYSTEM LANGUAGE</label>
                      <select value={settings.language || 'en'} onChange={e => setSettings({...settings, language: e.target.value})}>
                        <option value="en">English (US/UK)</option>
                        <option value="sw">Kiswahili (East Africa)</option>
                        <option value="fr">Français (French)</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">SYSTEM TIMEZONE</label>
                      <select value={settings.timezone} onChange={e => setSettings({...settings, timezone: e.target.value})}>
                        <option value="Africa/Nairobi">East Africa Time (Nairobi)</option>
                        <option value="UTC">UTC / GMT</option>
                        <option value="America/New_York">Eastern Time (New York)</option>
                        <option value="Europe/London">London (GMT+1)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'Themes' && (
                  <>
                    <div>
                      <label className="field-label">SYSTEM APPEARANCE</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <button className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTheme('light')}>Classic Light</button>
                        <button className={`btn ${theme === 'dark-mode' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTheme('dark-mode')}>Standard Dark</button>
                        <button className={`btn ${theme === 'midnight-theme' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTheme('midnight-theme')}>Midnight Navy</button>
                        <button className={`btn ${theme === 'arctic-theme' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTheme('arctic-theme')}>Arctic White</button>
                        <button className={`btn ${theme === 'slate-theme' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTheme('slate-theme')}>Soft Slate</button>
                      </div>
                    </div>
                    <div>
                      <label className="field-label">ACCENT COLOR</label>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9'].map(color => (
                          <div 
                            key={color} 
                            onClick={() => setAccentColor(color)}
                            style={{ 
                              width: '32px', height: '32px', borderRadius: '50%', background: color, cursor: 'pointer',
                              border: accentColor === color ? '3px solid white' : 'none',
                              boxShadow: accentColor === color ? '0 0 10px ' + color : 'none'
                            }} 
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      <div className="form-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span>Night Light (Warm Overlay)</span>
                        <input type="checkbox" checked={nightLight} onChange={e => setNightLight(e.target.checked)} />
                      </div>
                      <div className="form-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span>Eye Protection (Reduced Blue Light)</span>
                        <input type="checkbox" checked={eyeProtection} onChange={e => setEyeProtection(e.target.checked)} />
                      </div>
                    </div>
                  </>
                )}
             </div>

             <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : <><Check size={18} style={{ marginRight: '8px' }} /> Save Configuration</>}
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;

