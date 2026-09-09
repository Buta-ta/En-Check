// ═══════════════════════════════════════════════════════════
// 🔔 MODAL DE CONFIRMATION PERSONNALISÉE
// ═══════════════════════════════════════════════════════════

import { X, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isDangerous = false,
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#141423',
          border: `1px solid ${isDangerous ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'}`,
          borderRadius: 20,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 24,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {isDangerous ? (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(239,68,68,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={24} color="#EF4444" />
            </div>
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(99,102,241,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={24} color="#6366F1" />
            </div>
          )}
          <h2 style={{ color: '#FFF', fontSize: 18, fontWeight: 700, margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onCancel}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 8,
              color: '#888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{ color: '#CCC', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#FFF',
              borderRadius: 10,
              padding: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              background: isDangerous
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(99,102,241,0.15)',
              border: isDangerous
                ? '1px solid rgba(239,68,68,0.3)'
                : '1px solid rgba(99,102,241,0.3)',
              color: isDangerous ? '#EF4444' : '#818CF8',
              borderRadius: 10,
              padding: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? '⏳ Suppression...' : confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}