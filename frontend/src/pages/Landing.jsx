import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, TrendingUp, ShieldCheck, Users, 
  BarChart3, Zap, Globe, ArrowRight,
  Calculator, Smartphone, ShoppingCart, Lock,
  CheckCircle2, Star, ZapOff, Activity
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-page" style={{ 
      minHeight: '100vh', 
      background: '#020617', 
      color: '#f8fafc',
      overflowX: 'hidden',
      position: 'relative',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Background Orbs */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', z-index: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-5%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)', z-index: 0 }} />

      {/* Navigation */}
      <nav style={{ 
        padding: scrolled ? '16px 40px' : '24px 40px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        background: scrolled ? 'rgba(2, 6, 23, 0.8)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', height: '40px', 
            background: 'linear-gradient(135deg, #6366f1, #10b981)', 
            borderRadius: '12px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
          }}>
            <Package size={22} color="white" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Stockwatch
          </span>
        </div>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <div className="nav-links" style={{ display: 'flex', gap: '24px' }}>
            {['Features', 'Intelligence', 'Security', 'Pricing'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{ color: '#94a3b8', fontWeight: 500, textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.3s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                {item}
              </a>
            ))}
          </div>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
          <Link to="/login" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Sign In</Link>
          <button 
            onClick={() => navigate('/register')}
            style={{ 
              padding: '10px 24px', 
              background: '#fff', 
              color: '#020617', 
              border: 'none', 
              borderRadius: '10px', 
              fontWeight: 700, 
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'transform 0.3s'
            }}
            onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ 
        padding: '180px 40px 100px', 
        textAlign: 'center', 
        position: 'relative', 
        zIndex: 5,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div className="animate-fade-in" style={{ 
          background: 'rgba(99, 102, 241, 0.1)', 
          border: '1px solid rgba(99, 102, 241, 0.2)',
          color: '#818cf8', 
          padding: '6px 16px', 
          borderRadius: '100px',
          fontSize: '0.75rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <Zap size={12} fill="#818cf8" /> Trusted by 500+ High-Volume Retailers
        </div>
        
        <h1 style={{ 
          fontSize: '5rem', 
          fontWeight: 900, 
          letterSpacing: '-0.05em', 
          lineHeight: 1,
          marginBottom: '32px',
          background: 'linear-gradient(to bottom, #fff 40%, #64748b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Control your stock. <br />
          <span style={{ color: '#10b981', WebkitTextFillColor: '#10b981' }}>Scale your empire.</span>
        </h1>
        
        <p style={{ 
          fontSize: '1.35rem', 
          color: '#94a3b8', 
          maxWidth: '800px', 
          margin: '0 auto 56px',
          lineHeight: 1.6,
          fontWeight: 400
        }}>
          Stockwatch Enterprise is a unified operating system for modern retail. 
          Real-time inventory sync, AI-driven predictive audits, and high-performance POS 
          built for the next generation of commerce.
        </p>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '80px' }}>
          <button 
             onClick={() => navigate('/register')}
             className="btn-primary"
             style={{ 
               padding: '18px 48px', 
               fontSize: '1.1rem', 
               background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
               color: 'white',
               border: 'none',
               borderRadius: '14px',
               fontWeight: 700,
               display: 'flex',
               alignItems: 'center',
               gap: '12px',
               cursor: 'pointer',
               boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)'
             }}
          >
            Launch System <ArrowRight size={22} />
          </button>
          <button style={{ 
            padding: '18px 48px', 
            fontSize: '1.1rem',
            background: 'rgba(255,255,255,0.05)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(10px)'
          }}>
            Explore Features
          </button>
        </div>

        {/* Hero Image Container */}
        <div style={{ 
          position: 'relative',
          padding: '20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '32px',
          border: '1px solid rgba(255,255,255,0.05)',
          maxWidth: '1100px',
          margin: '0 auto',
          boxShadow: '0 0 100px rgba(99, 102, 241, 0.1)'
        }}>
          <img 
            src="/landing_hero_mockup_1777627730622.png" 
            alt="Stockwatch Dashboard Mockup" 
            style={{ 
              width: '100%', 
              borderRadius: '20px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
              display: 'block'
            }} 
          />
          
          {/* Floating UI Elements */}
          <div className="floating" style={{ 
            position: 'absolute', top: '10%', right: '-5%', 
            padding: '16px 24px', background: 'rgba(30, 41, 59, 0.9)', 
            backdropFilter: 'blur(12px)', borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
             <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
             <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Live Sync Active</span>
          </div>
        </div>
      </header>

      {/* Social Proof */}
      <section style={{ padding: '40px 0 100px', textAlign: 'center' }}>
        <p style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '40px' }}>POWERING MODERN COMMERCE</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '60px', opacity: 0.5, filter: 'grayscale(1)' }}>
          {['Lumina Global', 'Aether Retail', 'Vertex Logistics', 'Nova Stores'].map(name => (
            <span key={name} style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8' }}>{name}</span>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '120px 40px', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '80px' }}>
            <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '16px' }}>Built for the high-performance shop.</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px' }}>Enterprise-grade tools simplified for everyday retail success.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              { title: 'Predictive Audits', desc: 'Identify stock discrepancies before they impact your bottom line.', icon: <Activity />, color: '#6366f1' },
              { title: 'Omnichannel Sync', desc: 'One inventory for physical stores, mobile sales, and warehouse.', icon: <Globe />, color: '#10b981' },
              { title: 'Staff Performance', desc: 'Real-time leaderboard and commission tracking for floor teams.', icon: <Users />, color: '#f59e0b' },
              { title: 'Financial Intelligence', desc: 'Auto-calculated VAT, profit margins, and daily revenue reports.', icon: <BarChart3 />, color: '#ef4444' },
              { title: 'Universal Scanning', desc: 'Native support for barcodes, QR codes, and custom SKU patterns.', icon: <Smartphone />, color: '#0ea5e9' },
              { title: 'Hardened Security', desc: 'Role-based access control and detailed tamper-proof logs.', icon: <ShieldCheck />, color: '#8b5cf6' }
            ].map((f, i) => (
              <div key={i} className="feature-card" style={{ 
                padding: '40px', background: 'rgba(255,255,255,0.02)', 
                borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ 
                  width: '56px', height: '56px', background: `${f.color}20`, 
                  color: f.color, borderRadius: '14px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '24px'
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>{f.title}</h3>
                <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / Registration */}
      <section id="pricing" style={{ padding: '120px 40px', background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.05) 0%, transparent 70%)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '64px', letterSpacing: '-0.04em' }}>Choose your perspective.</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            <div className="tier-card" style={{ 
              padding: '60px 48px', background: 'rgba(255,255,255,0.03)', 
              borderRadius: '32px', border: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'left', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '24px', opacity: 0.1 }}><ShieldCheck size={120} /></div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '16px' }}>Shop Owner</h3>
              <p style={{ color: '#94a3b8', marginBottom: '32px' }}>The full administrative suite. Control everything from suppliers to staff performance.</p>
              <ul style={{ listArray: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Advanced Business Intelligence', 'Multi-staff Management', 'Inventory Level Forecasting', 'Financial Audit Reports'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' }}><CheckCircle2 size={18} color="#10b981" /> {item}</li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} className="btn-white" style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#fff', color: '#020617', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>Register as Owner</button>
            </div>

            <div className="tier-card" style={{ 
              padding: '60px 48px', background: 'rgba(255,255,255,0.03)', 
              borderRadius: '32px', border: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'left', position: 'relative', overflow: 'hidden'
            }}>
               <div style={{ position: 'absolute', top: 0, right: 0, padding: '24px', opacity: 0.1 }}><Users size={120} /></div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '16px' }}>Staff Member</h3>
              <p style={{ color: '#94a3b8', marginBottom: '32px' }}>Join an established team. Access the POS terminal and manage floor operations.</p>
              <ul style={{ listArray: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Lightning Fast POS Checkout', 'Personal Sales Performance', 'Real-time Stock Lookups', 'Digital Receipt Issuing'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' }}><CheckCircle2 size={18} color="#6366f1" /> {item}</li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>Join Your Team</button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '120px 40px', textAlign: 'center' }}>
        <div style={{ 
          maxWidth: '800px', margin: '0 auto', 
          padding: '80px', background: 'linear-gradient(135deg, #6366f1, #10b981)', 
          borderRadius: '40px', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")', opacity: 0.1 }} />
          <h2 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '24px', color: '#fff' }}>Stop guessing. Start knowing.</h2>
          <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.9)', marginBottom: '40px' }}>Join the next generation of retailers using data to win.</p>
          <button onClick={() => navigate('/register')} style={{ padding: '18px 48px', background: '#fff', color: '#020617', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Get Started for Free</button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '80px 40px 40px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Package color="#6366f1" />
              <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>Stockwatch</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '300px' }}>The intelligent operating system for high-volume retail. Built in Nairobi for the world.</p>
          </div>
          <div style={{ display: 'flex', gap: '80px' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Product</span>
                <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>Dashboard</a>
                <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>Intelligence</a>
                <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>Security</a>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Company</span>
                <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>About Us</a>
                <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>Careers</a>
                <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>Contact</a>
             </div>
          </div>
        </div>
        <div style={{ maxWidth: '1200px', margin: '60px auto 0', paddingTop: '40px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
          &copy; 2026 Stockwatch Retail Solutions. All rights reserved.
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        .floating { animation: float 6s ease-in-out infinite; }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        .feature-card:hover { 
          background: rgba(255,255,255,0.04) !important; 
          border-color: rgba(99, 102, 241, 0.3) !important;
          transform: translateY(-5px);
        }
        .tier-card:hover {
          border-color: rgba(255,255,255,0.2) !important;
          background: rgba(255,255,255,0.05) !important;
          transform: scale(1.02);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        html { scroll-behavior: smooth; }
      `}} />
    </div>
  );
};

export default Landing;
