// ═══════════════════════════════════════════════════════════
// 🎨 BADGE ANIMÉ POUR ONGLETS
// ═══════════════════════════════════════════════════════════

import React from 'react'
import { PRIORITY_STYLES } from '../utils/animationConfig'

const AnimationBadge = ({ count, priority = 'info', icon }) => {
  const style = PRIORITY_STYLES[priority]

  return (
    <>
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        @keyframes badge-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }

        @keyframes badge-glow-pulse {
          0%, 100% { box-shadow: ${style.badgeGlow}; }
          50% { box-shadow: ${style.badgeGlow}, ${style.badgeGlow}; }
        }

        .animation-badge {
          animation: 
            badge-pulse ${style.animationDuration} ease-in-out infinite,
            ${priority === 'critical' ? `badge-shake 0.5s ease-in-out infinite,` : ''}
            badge-glow-pulse ${style.animationDuration} ease-in-out infinite;
        }
      `}</style>

      <div
        className="animation-badge"
        style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          minWidth: '22px',
          height: '22px',
          borderRadius: '11px',
          background: style.badgeColor,
          color: priority === 'info' || priority === 'low' ? '#000' : '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: '700',
          padding: '0 6px',
          border: '2px solid #0A0A0F',
          zIndex: 10,
          boxShadow: style.badgeGlow
        }}
      >
        {icon ? (
          <span style={{ fontSize: '12px' }}>{icon}</span>
        ) : (
          <span>{count > 99 ? '99+' : count}</span>
        )}
      </div>
    </>
  )
}

export default AnimationBadge