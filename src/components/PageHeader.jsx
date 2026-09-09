// ═══════════════════════════════════════════════════════════
// 🎯 PAGE HEADER - AFROFUTURISTE
// ═══════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Footprints } from 'lucide-react'

export default function PageHeader({ title, subtitle, showBackButton = true }) {
  const navigate = useNavigate()

  return (
    <>
      <style>{`
        .afro-header {
          background: rgba(15, 15, 25, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(245, 158, 11, 0.12);
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .afro-header-inner {
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .afro-back-btn {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 10px;
          padding: 8px;
          color: #F59E0B;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .afro-back-btn:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          transform: translateX(-2px);
        }
        .afro-logo-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .afro-title-block {
          display: flex;
          flex-direction: column;
        }
        .afro-header-title {
          color: #FFFFFF;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 3px;
          margin: 0;
          line-height: 1.2;
        }
        .afro-header-subtitle {
          color: #F59E0B;
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 500;
          margin-top: 2px;
        }
        .afro-header-glow {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.3), transparent);
          pointer-events: none;
        }
        @media (max-width: 480px) {
          .afro-header {
            padding: 10px 16px;
          }
          .afro-header-title {
            font-size: 14px;
            letter-spacing: 2px;
          }
          .afro-logo-mark {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>

      <header className="afro-header">
        <div className="afro-header-inner">
          {showBackButton && (
            <button 
              onClick={() => navigate('/dashboard')} 
              className="afro-back-btn"
              title="Retour au dashboard"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          
          <div className="afro-logo-mark">
            <Footprints size={20} color="#F59E0B" />
          </div>
          
          <div className="afro-title-block">
            <h1 className="afro-header-title">{title}</h1>
            {subtitle && (
              <span className="afro-header-subtitle">{subtitle}</span>
            )}
          </div>
        </div>
        
        <div className="afro-header-glow"></div>
      </header>
    </>
  )
}