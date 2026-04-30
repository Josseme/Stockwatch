import React, { useEffect, useState } from 'react';
import { Printer, Smartphone, MessageCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import './index.css';

const Receipt = () => {
    const [receipt, setReceipt] = useState(null);

    useEffect(() => {
        const loadReceipt = () => {
            const data = localStorage.getItem('lastReceipt');
            if (data) {
                setReceipt(JSON.parse(data));
            }
        };

        loadReceipt();

        // Listen for updates from other tabs
        const handleStorageChange = (e) => {
            if (e.key === 'lastReceipt') {
                loadReceipt();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const handlePrint = () => window.print();

    if (!receipt) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ opacity: 0.6 }}>No receipt data found. Please close this tab and try again.</p>
                <button className="btn btn-ghost" onClick={() => window.close()} style={{ marginTop: '20px' }}>Close Tab</button>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '12px' }}>
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Checkout Successful</h1>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>Transaction finalized & logged</p>
                        </div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => window.close()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowLeft size={16} /> Return to POS
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '30px' }}>
                    <button onClick={handlePrint} className="glass-panel" style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Printer size={32} style={{ color: '#3b82f6', marginBottom: '12px' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Print Receipt</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>Thermal 80mm</div>
                    </button>

                    <a href={`https://api.whatsapp.com/send?phone=${receipt.phone}&text=${receipt.text}`} target="whatsapp_window" rel="noreferrer" className="glass-panel" style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <MessageCircle size={32} style={{ color: '#25D366', marginBottom: '12px' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>WhatsApp</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>Send to {receipt.phone || 'Customer'}</div>
                    </a>

                    <a href={`sms:${receipt.phone}?body=${receipt.text}`} className="glass-panel" style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Smartphone size={32} style={{ color: '#3b82f6', marginBottom: '12px' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Send SMS</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>Carrier Rates Apply</div>
                    </a>
                </div>

                <div className="glass-panel receipt-text" style={{ padding: '40px', background: '#fff', color: '#000', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(90deg, #fff 0px, #fff 10px, transparent 10px, transparent 20px)', transform: 'translateY(-100%)' }} />
                    <pre style={{ 
                        margin: 0, 
                        whiteSpace: 'pre-wrap', 
                        fontFamily: "'Courier New', Courier, monospace", 
                        fontSize: '0.9rem',
                        lineHeight: '1.4',
                        letterSpacing: '0.5px'
                    }}>
                        {receipt.text ? decodeURIComponent(receipt.text) : 'No receipt text available'}
                    </pre>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(90deg, #fff 0px, #fff 10px, transparent 10px, transparent 20px)', transform: 'translateY(100%)' }} />
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.4, fontSize: '0.75rem' }}>
                    Generated by Stockwatch Cloud POS • {new Date().toLocaleTimeString()}
                </div>
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .receipt-text, .receipt-text * { visibility: visible; }
                    .receipt-text { position: absolute; left: 0; top: 0; width: 80mm; padding: 0; margin: 0; box-shadow: none; border: none; }
                    .glass-panel { border: none !important; box-shadow: none !important; background: white !important; color: black !important; }
                    button, a, h1, p, .metric-card { display: none !important; }
                }
                .glass-panel:hover {
                    transform: translateY(-4px);
                    border-color: rgba(255,255,255,0.15) !important;
                    background: rgba(255,255,255,0.05) !important;
                }
            `}</style>
        </div>
    );
};

export default Receipt;

