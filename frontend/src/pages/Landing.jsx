import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, TrendingUp, ShieldCheck, Users, 
  BarChart3, Zap, Globe, ArrowRight,
  Calculator, Smartphone, ShoppingCart, Lock
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page" style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-primary)', 
      color: 'var(--text-primary)',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      {/* Dynamic Background */}
      <div className="mesh-bg" style={{ opacity: 0.6 }} />
      
      {/* Navigation */}
      <nav style={{ 
        padding: '24px 40px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="metric-icon blue" style={{ width: '40px', height: '40px' }}>
            <Package size={20} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Stockwatch</span>
        </div>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="#features" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>Solutions</a>
          <Link to="/login" className="btn btn-ghost" style={{ padding: '8px 24px' }}>Sign In</Link>
          <button 
            onClick={() => navigate('/register')}
            className="btn btn-primary" 
            style={{ padding: '10px 28px', boxShadow: 'var(--shadow-lg)' }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ 
        padding: '100px 40px 60px', 
        textAlign: 'center', 
        position: 'relative', 
        zIndex: 5,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div className="badge animate-fade-in" style={{ 
          background: 'rgba(99, 102, 241, 0.1)', 
          color: 'var(--accent-primary)', 
          padding: '8px 20px', 
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px'
        }}>
          <Zap size={14} /> NEW: AI-Driven Inventory Forecasting
        </div>
        
        <h1 style={{ 
          fontSize: '4.5rem', 
          fontWeight: 800, 
          letterSpacing: '-0.04em', 
          lineHeight: 1.1,
          marginBottom: '24px',
          background: 'linear-gradient(to right, #fff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Modern Retail OS for <br />
          <span style={{ color: 'var(--accent-primary)', WebkitTextFillColor: 'var(--accent-primary)' }}>Scale & Intelligence.</span>
        </h1>
        
        <p style={{ 
          fontSize: '1.25rem', 
          color: 'var(--text-secondary)', 
          maxWidth: '700px', 
          margin: '0 auto 48px',
          lineHeight: 1.6
        }}>
          One unified platform for inventory, POS, staff performance, and predictive audits. 
          Built for high-volume retail environments that demand precision.
        </p>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button 
             onClick={() => navigate('/register')}
             className="btn btn-primary" 
             style={{ padding: '16px 40px', fontSize: '1.1rem', gap: '12px' }}
          >
            Start Free Trial <ArrowRight size={20} />
          </button>
          <button className="btn btn-ghost" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
            Book a Demo
          </button>
        </div>
      </header>

      {/* Mock Dashboard Visualization */}
      <div style={{ 
        maxWidth: '1100px', 
        margin: '0 auto 120px',
        padding: '0 40px',
        position: 'relative'
      }}>
        <div className="glass-panel" style={{ 
          padding: '12px', 
          borderRadius: '24px', 
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(20px)',
          transform: 'perspective(1000px) rotateX(5deg)',
          animation: 'float 6s ease-in-out infinite'
        }}>
          <div style={{ 
            height: '500px', 
            borderRadius: '16px', 
            background: '#0f172a',
            overflow: 'hidden',
            display: 'flex'
          }}>
            {/* Mock Sidebar */}
            <div style={{ width: '200px', borderRight: '1px solid #1e293b', padding: '24px' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: '12px', background: '#1e293b', borderRadius: '6px', marginBottom: '20px', width: i % 2 === 0 ? '100%' : '70%' }} />
              ))}
            </div>
            {/* Mock Content */}
            <div style={{ flex: 1, padding: '40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
                {[1,2,3].map(i => (
                  <div key={i} className="glass-panel" style={{ height: '100px', background: '#1e293b' }} />
                ))}
              </div>
              <div className="glass-panel" style={{ height: '260px', background: '#1e293b' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Registration Options Section */}
      <section id="pricing" style={{ padding: '100px 40px', background: 'rgba(15, 23, 42, 0.5)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '60px' }}>Ready to optimize your business?</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {/* Option 1: Shop Owner */}
            <div className="glass-panel" style={{ padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <ShieldCheck size={32} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Shop Owner</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Full administrative access. Manage inventory, staff, customers, and view deep analytics.
              </p>
              <button 
                onClick={() => navigate('/register')}
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: 'auto' }}
              >
                Sign Up as Owner
              </button>
            </div>

            {/* Option 2: Staff Member */}
            <div className="glass-panel" style={{ padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-secondary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <Users size={32} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Staff Member</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Join an existing shop. Access POS terminal and inventory scanner assigned by your manager.
              </p>
              <button 
                onClick={() => navigate('/register')}
                className="btn btn-ghost" 
                style={{ width: '100%', marginTop: 'auto' }}
              >
                Join Your Team
              </button>
            </div>

            {/* Option 3: Enterprise */}
            <div className="glass-panel" style={{ padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <Globe size={32} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Multi-Branch</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                For chains and franchises. Centralized management with branch-specific stock sync.
              </p>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 'auto' }}>
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '60px 40px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          &copy; 2026 Stockwatch Retail Solutions. All rights reserved.
        </p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: perspective(1000px) rotateX(5deg) translateY(0); }
          50% { transform: perspective(1000px) rotateX(4deg) translateY(-20px); }
        }
        .landing-page {
          scroll-behavior: smooth;
        }
      `}} />
    </div>
  );
};

export default Landing;
