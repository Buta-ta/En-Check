// src/components/EnterpriseSwitcher.jsx
// ═══════════════════════════════════════════════════════════
// 🏢 COMPOSANT SÉLECTEUR D'ENTREPRISE - AFROFUTURISTE
// MAJ : support autoOpen (ouverture auto du dropdown) + persistance par admin
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react'
import { Building2, ChevronDown, Check, Zap } from 'lucide-react'

export default function EnterpriseSwitcher({ admin, onSwitch, autoOpen = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const entreprises = admin?.entreprises || []
  const selectedEnterprise = admin?.selectedEnterprise
  const isMulti = entreprises.length > 1

  // ✅ ouverture auto demandée (une seule fois côté parent)
  useEffect(() => {
    if (autoOpen && isMulti) {
      setIsOpen(true)
    }
  }, [autoOpen, isMulti])

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (enterprise) => {
    if (!enterprise?.id) return

    if (enterprise.id === selectedEnterprise?.id) {
      setIsOpen(false)
      return
    }

    // Mettre à jour localStorage
    const updatedAdmin = {
      ...admin,
      selectedEnterprise: enterprise
    }
    localStorage.setItem('admin', JSON.stringify(updatedAdmin))

    // compat ancien comportement
    localStorage.setItem('last_enterprise_id', enterprise.id)

    // ✅ persistance premium par admin (évite collision multi-comptes sur même navigateur)
    if (admin?.id) {
      localStorage.setItem(`last_enterprise_id_${admin.id}`, enterprise.id)
    }

    setIsOpen(false)

    // Callback
    if (onSwitch) {
      onSwitch(enterprise, updatedAdmin)
    }
  }

  if (!selectedEnterprise) {
    return null
  }

  // Si une seule entreprise, afficher sans dropdown
  if (!isMulti) {
    return (
      <>
        <style>{switcherStyles}</style>
        <div className="switcher-single">
          <div className="switcher-logo-wrap">
            {selectedEnterprise.logo_url ? (
              <img src={selectedEnterprise.logo_url} alt="" className="switcher-logo" />
            ) : (
              <Building2 size={16} color="#F59E0B" />
            )}
          </div>
          <span className="switcher-name">{selectedEnterprise.name}</span>
        </div>
      </>
    )
  }

  // Multi-entreprises : dropdown
  return (
    <>
      <style>{switcherStyles}</style>
      <div className="switcher-container" ref={dropdownRef}>
        <button
          className={`switcher-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <div className="switcher-logo-wrap">
            {selectedEnterprise.logo_url ? (
              <img src={selectedEnterprise.logo_url} alt="" className="switcher-logo" />
            ) : (
              <Building2 size={16} color="#F59E0B" />
            )}
          </div>
          <div className="switcher-info">
            <span className="switcher-label">Entreprise</span>
            <span className="switcher-name">{selectedEnterprise.name}</span>
          </div>
          <ChevronDown
            size={16}
            className="switcher-chevron"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
          <span className="switcher-badge">{entreprises.length}</span>
        </button>

        {isOpen && (
          <div className="switcher-dropdown">
            <div className="dropdown-header">
              <Zap size={12} color="#F59E0B" />
              <span>Vos entreprises</span>
              <span className="dropdown-count">{entreprises.length}</span>
            </div>

            <div className="dropdown-list">
              {entreprises.map((enterprise) => {
                const isSelected = enterprise.id === selectedEnterprise?.id
                return (
                  <button
                    key={enterprise.id}
                    className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(enterprise)}
                    type="button"
                  >
                    <div className="item-logo-wrap">
                      {enterprise.logo_url ? (
                        <img src={enterprise.logo_url} alt="" className="item-logo" />
                      ) : (
                        <Building2 size={16} color="#F59E0B" />
                      )}
                    </div>
                    <span className="item-name">{enterprise.name}</span>
                    {isSelected && (
                      <div className="item-check">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const switcherStyles = `
  /* ═══ Container ═══ */
  .switcher-container { position: relative; }

  /* ═══ Single (non-dropdown) ═══ */
  .switcher-single {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 12px;
  }

  /* ═══ Logo Wrap ═══ */
  .switcher-logo-wrap {
    width: 28px; height: 28px; border-radius: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden;
  }
  .switcher-logo { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }

  /* ═══ Trigger Button ═══ */
  .switcher-trigger {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.12);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .switcher-trigger:hover {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
  }
  .switcher-trigger.open {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.08);
  }

  /* ═══ Trigger Info ═══ */
  .switcher-info {
    display: flex; flex-direction: column; align-items: flex-start;
    min-width: 0;
  }
  .switcher-label {
    font-size: 9px; color: #888;
    text-transform: uppercase; letter-spacing: 1px;
    font-weight: 600; line-height: 1;
  }
  .switcher-name {
    color: #FFFFFF;
    font-size: 13px; font-weight: 600;
    max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    line-height: 1.3;
  }

  /* ═══ Chevron ═══ */
  .switcher-chevron {
    color: #F59E0B;
    transition: transform 0.25s ease;
    flex-shrink: 0;
    opacity: 0.7;
  }

  /* ═══ Badge ═══ */
  .switcher-badge {
    background: linear-gradient(135deg, #F59E0B, #D97706);
    color: #000;
    font-size: 10px; font-weight: 700;
    padding: 2px 7px; border-radius: 8px;
    margin-left: 2px; flex-shrink: 0;
  }

  /* ═══ Dropdown ═══ */
  .switcher-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 260px;
    background: #141420;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03);
    z-index: 1000;
    overflow: hidden;
    animation: dropdownEnter 0.2s ease;
  }

  @keyframes dropdownEnter {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ═══ Dropdown Header ═══ */
  .dropdown-header {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 16px;
    font-size: 11px; font-weight: 700;
    color: #888;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .dropdown-count {
    margin-left: auto;
    background: rgba(245, 158, 11, 0.1);
    color: #F59E0B;
    padding: 2px 8px;
    border-radius: 8px;
    font-size: 10px;
  }

  /* ═══ Dropdown List ═══ */
  .dropdown-list {
    padding: 6px;
    max-height: 280px;
    overflow-y: auto;
  }
  .dropdown-list::-webkit-scrollbar { width: 4px; }
  .dropdown-list::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.3); border-radius: 2px; }

  /* ═══ Dropdown Item ═══ */
  .dropdown-item {
    display: flex; align-items: center; gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }
  .dropdown-item:hover { background: rgba(255, 255, 255, 0.04); }
  .dropdown-item.selected {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.15);
  }

  /* ═══ Item Logo ═══ */
  .item-logo-wrap {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden;
  }
  .dropdown-item.selected .item-logo-wrap { border-color: rgba(245, 158, 11, 0.25); }
  .item-logo { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }

  /* ═══ Item Name ═══ */
  .item-name {
    flex: 1;
    color: #E5E5E5;
    font-size: 14px; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dropdown-item.selected .item-name { color: #FFFFFF; font-weight: 600; }

  /* ═══ Item Check ═══ */
  .item-check {
    width: 24px; height: 24px; border-radius: 8px;
    background: rgba(16, 185, 129, 0.15);
    color: #10B981;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* ═══ Responsive ═══ */
  @media (max-width: 480px) {
    .switcher-trigger { padding: 6px 10px; }
    .switcher-info { display: none; }
    .switcher-name { display: block; max-width: 100px; }
    .switcher-dropdown { min-width: 220px; right: 0; left: auto; }
  }
`