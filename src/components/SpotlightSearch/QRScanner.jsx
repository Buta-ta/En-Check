import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X, Camera, AlertCircle } from 'lucide-react'

export default function QRScanner({ onClose, onScan }) {
  const scannerRef = useRef(null)
  const hasScannedRef = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
      },
      false
    )

    scannerRef.current = scanner

    scanner.render(
      async (decodedText) => {
        if (hasScannedRef.current) return
        hasScannedRef.current = true

        try {
          try { await scannerRef.current?.clear() } catch {}
          scannerRef.current = null

          onClose?.()
          onScan?.(String(decodedText || '').trim())
        } catch (e) {
          console.error('Erreur scan QR:', e)
          setError(e?.message || 'Erreur lors du scan')
          hasScannedRef.current = false
        }
      },
      () => {}
    )

    return () => {
      try { scannerRef.current?.clear() } catch {}
      scannerRef.current = null
    }
  }, [onClose, onScan])

  return (
    <div className="qr-scanner-overlay" onClick={onClose}>
      <div className="qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-scanner-header">
          <div className="qr-scanner-header-title">
            <Camera size={20} />
            <h3>Scanner un QR Code</h3>
          </div>
          <button className="qr-scanner-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="qr-scanner-body">
          {!error ? (
            <>
              <div className="qr-scanner-instructions">
                <p>Approchez le badge employé de la caméra</p>
                <p className="qr-scanner-hint">Le scan se fait automatiquement</p>
              </div>
              <div id="qr-reader" className="qr-scanner-reader" />
            </>
          ) : (
            <div className="qr-scanner-result qr-scanner-result-error">
              <AlertCircle size={32} />
              <h4>Erreur</h4>
              <p>{error}</p>
              <button className="qr-scanner-retry" onClick={() => window.location.reload()}>
                Réessayer
              </button>
            </div>
          )}
        </div>

        <div className="qr-scanner-footer">
          <p>Assurez-vous que le QR code est bien visible et éclairé</p>
        </div>
      </div>
    </div>
  )
}