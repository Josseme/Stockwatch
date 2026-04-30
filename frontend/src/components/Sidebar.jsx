import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  History, 
  BarChart3, 
  UserCheck, 
  Settings, 
  LogOut,
  Package,
  ShieldCheck,
  Users,
  Menu,
  ChevronDown,
  ChevronRight,
  Globe,
  Printer,
  Bell,
  Database,
  Mail,
  Landmark,
  AlertTriangle
} from 'lucide-react';

const Sidebar = ({ isCollapsed, onToggle, isMobileOpen }) => {
  const navigate = useNavigate();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const role = localStorage.getItem('role') || 'staff';
  const username = localStorage.getItem('username') || 'User';
  const isAdmin = role === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const triggerAction = (action, payload = null) => {
    // Custom event to communicate with Layout.jsx
    window.dispatchEvent(new CustomEvent('inventory-action', { detail: { action, payload } }));
  };

  const commerceItems = [
    { name: 'POS / Checkout', path: '/pos', icon: <Package size={20} /> },
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, adminOnly: true },
  ];


  const inventorySubItems = [
    { name: 'Full Catalog', path: '/admin/inventory', icon: <ShieldCheck size={20} />, adminOnly: true },
    { name: 'Expiry Risk', path: '/admin/expiry', icon: <AlertTriangle size={20} />, adminOnly: true },
  ];

  const peopleSubItems = [
    { name: 'Team Hub', path: '/admin/staff', icon: <Users size={20} />, adminOnly: true },
    { name: 'Attendance', path: '/attendance', icon: <History size={20} /> },
  ];

  const peopleItems = [
    { name: 'CRM & Loyalty', path: '/admin/customers', icon: <UserCheck size={20} />, adminOnly: true },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>

      <div className="sidebar-logo" style={{ 
        padding: '32px 24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
             <Package size={24} />
          </div>
          {!isCollapsed && (
            <span style={{ 
              fontSize: '1.25rem', 
              fontWeight: 900, 
              letterSpacing: '0.1em',
              background: 'linear-gradient(to right, #6366f1, #10b981)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: "'Outfit', sans-serif"
            }}>
              STOCKWATCH
            </span>
          )}
        </div>
        <button 
          onClick={onToggle}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'var(--transition-smooth)'
          }}
          className="hover-bg"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="nav-list">
        {!isCollapsed && (
          <div style={{ padding: '0 16px 8px', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} className="user-info">
            Core Operations
          </div>
        )}
        {commerceItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.name : ''}
          >
            {item.icon}
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <NavLink 
            to="/admin/intelligence" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Audits' : ''}
          >
            <BarChart3 size={20} />
            {!isCollapsed && <span>Audits</span>}
          </NavLink>
        )}

        {isAdmin && (
          <div className="nav-group">
            <div style={{ margin: '16px 0', borderTop: '1px solid var(--panel-border)', opacity: 0.5 }} />
            {!isCollapsed && (
              <div style={{ padding: '0 16px 8px', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} className="user-info">
                Inventory
              </div>
            )}
            <button 
              className="nav-item group-header" 
              onClick={() => setInventoryOpen(!inventoryOpen)}
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={20} />
                {!isCollapsed && <span>Product Catalog</span>}
              </div>
              {!isCollapsed && (inventoryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
            </button>
            {inventoryOpen && !isCollapsed && (
              <div className="sub-items" style={{ paddingLeft: '16px' }}>
                {inventorySubItems.map(item => (
                  <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item sub ${isActive ? 'active' : ''}`}>
                    {item.icon}
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* People & Management */}
        <div style={{ margin: '16px 0', borderTop: '1px solid var(--panel-border)', opacity: 0.5 }} />
        {!isCollapsed && (
          <div style={{ padding: '0 16px 8px', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} className="user-info">
            People & Management
          </div>
        )}

        {/* Staff & Attendance Toggle */}
        {isAdmin && (
          <div className="nav-group">
            <button 
              className="nav-item group-header" 
              onClick={() => setPeopleOpen(!peopleOpen)}
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Users size={20} />
                {!isCollapsed && <span>Staff & Attendance</span>}
              </div>
              {!isCollapsed && (peopleOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
            </button>
            {peopleOpen && !isCollapsed && (
              <div className="sub-items" style={{ paddingLeft: '16px' }}>
                {peopleSubItems.filter(item => !item.adminOnly || isAdmin).map(item => (
                  <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item sub ${isActive ? 'active' : ''}`}>
                    {item.icon}
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {peopleItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.name : ''}
          >
            {item.icon}
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}

        <div style={{ margin: '16px 0', borderTop: '1px solid var(--panel-border)', opacity: 0.5 }} />

          <button 
            className="nav-item" 
            onClick={() => triggerAction('settings')}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            title={isCollapsed ? 'Settings' : ''}
          >
            <Settings size={20} />
            {!isCollapsed && <span>{isAdmin ? 'System Settings' : 'Preferences'}</span>}
          </button>
      </nav>

      <div className="nav-footer">
        <div style={{ padding: '0 12px 20px 12px' }} className="user-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'var(--accent-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.8rem',
              fontWeight: 700,
              flexShrink: 0
            }}>
              {username[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{username}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={10} /> {role}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleLogout} 
          className="nav-item" 
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
          title={isCollapsed ? 'Sign Out' : ''}
        >
          <LogOut size={20} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

