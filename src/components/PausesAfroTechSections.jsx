import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import PhotoSignee from './PhotoSignee'
import {
  badgeAnomalie,
  estPausePresumee,
  estPauseReelleEffectuee,
  formatDuree,
  formaterTempsPauseEnDirect,
} from '../services/pausesService'
import { getHeuresMinutesLocales } from '../utils/timezoneUtils'
import '../pages/PointagesAfroTech.css'

// ═══════════════════════════════════════════════════════════════════════════
// MOTIFS CULTURELS FIDÈLES À L'IMAGE SÉLECTIONNÉE (KENTE & ADINKRA)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Frise Kente géométrique supérieure fidèle à l'image sélectionnée :
 * succession de blocs tissés (rayures verticales or/noir, damier or/noir,
 * grecque terracotta, bandes violettes, bandes vert émeraude, damier serré,
 * treillis losanges or, grecque violette, bandes bleu indigo).
 */
export function PausesKenteTopBannerSvg({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 42"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ width: '100%', height: 42, display: 'block', borderBottom: '2px solid #9A7234' }}
    >
      <defs>
        <pattern id="pauses-kente-strip" x="0" y="0" width="600" height="42" patternUnits="userSpaceOnUse">
          <rect width="600" height="42" fill="#120D09" />

          {/* Bloc 1 (0..42) : Bandes horizontales Or & Noir */}
          <rect x="0" y="0" width="42" height="42" fill="#18110B" />
          {[2, 10, 18, 26, 34].map((y) => (
            <rect key={`b1-${y}`} x="2" y={y} width="38" height="5" fill="#D89B35" />
          ))}

          {/* Bloc 2 (42..84) : Rayures verticales Or / Terracotta / Noir */}
          <rect x="42" y="0" width="42" height="42" fill="#140E0A" />
          {[44, 50, 56, 62, 68, 74, 80].map((x, i) => (
            <rect key={`b2-${x}`} x={x} y="0" width="3.5" height="42" fill={i % 2 === 0 ? '#E4A83E' : '#B84A28'} />
          ))}

          {/* Bloc 3 (84..128) : Damier tissé Or & Noir */}
          <rect x="84" y="0" width="44" height="42" fill="#140E0A" />
          {[0, 1, 2, 3, 4, 5].map((row) =>
            [0, 1, 2, 3, 4, 5].map((col) =>
              (row + col) % 2 === 0 ? (
                <rect
                  key={`b3-${row}-${col}`}
                  x={86 + col * 6.8}
                  y={2 + row * 6.5}
                  width="5.5"
                  height="5.2"
                  fill="#E4A83E"
                />
              ) : null
            )
          )}

          {/* Bloc 4 (128..164) : Rayures verticales Or / Vert / Rouge */}
          <rect x="128" y="0" width="36" height="42" fill="#140E0A" />
          {[130, 136, 142, 148, 154, 160].map((x, i) => (
            <rect
              key={`b4-${x}`}
              x={x}
              y="0"
              width="3.5"
              height="42"
              fill={i % 3 === 0 ? '#E4A83E' : i % 3 === 1 ? '#1E824C' : '#C84B2A'}
            />
          ))}

          {/* Bloc 5 (164..206) : Grecque / Méandre carré Violet Royal */}
          <rect x="164" y="0" width="42" height="42" fill="#1A101E" />
          <rect x="168" y="4" width="34" height="34" stroke="#7E3F8F" strokeWidth="3.5" />
          <rect x="175" y="11" width="20" height="20" stroke="#9B51B0" strokeWidth="3" />
          <rect x="182" y="18" width="6" height="6" fill="#E4A83E" />

          {/* Bloc 6 (206..244) : Bandes horizontales Vert Émeraude */}
          <rect x="206" y="0" width="38" height="42" fill="#0F1E15" />
          {[2, 10, 18, 26, 34].map((y) => (
            <rect key={`b6-${y}`} x="208" y={y} width="34" height="5" fill="#1E824C" />
          ))}

          {/* Bloc 7 (244..286) : Grecque / Méandre Terracotta */}
          <rect x="244" y="0" width="42" height="42" fill="#1E110D" />
          <rect x="248" y="4" width="34" height="34" stroke="#C8522E" strokeWidth="3.5" />
          <path d="M255 28 V12 H275 V28 H262 V20" stroke="#E4A83E" strokeWidth="3" />

          {/* Bloc 8 (286..330) : Bandes horizontales Terracotta & Or */}
          <rect x="286" y="0" width="44" height="42" fill="#18100C" />
          {[2, 10, 18, 26, 34].map((y, i) => (
            <rect
              key={`b8-${y}`}
              x="288"
              y={y}
              width="40"
              height="5"
              fill={i % 2 === 0 ? '#D46238' : '#E4A83E'}
            />
          ))}

          {/* Bloc 9 (330..380) : Treillis de losanges Kente Or & Noir */}
          <rect x="330" y="0" width="50" height="42" fill="#140E0A" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const cx = 337 + c * 12
              const cy = 7 + r * 13
              return (
                <polygon
                  key={`b9-${r}-${c}`}
                  points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`}
                  fill="#E4A83E"
                />
              )
            })
          )}

          {/* Bloc 10 (380..418) : Rayures verticales Or & Émeraude */}
          <rect x="380" y="0" width="38" height="42" fill="#140E0A" />
          {[382, 388, 394, 400, 406, 412].map((x, i) => (
            <rect key={`b10-${x}`} x={x} y="0" width="3.5" height="42" fill={i % 2 === 0 ? '#E4A83E' : '#1E824C'} />
          ))}

          {/* Bloc 11 (418..466) : Double Treillis Or */}
          <rect x="418" y="0" width="48" height="42" fill="#18110B" />
          <path
            d="M420 4 L464 38 M420 20 L446 38 M438 4 L464 24 M464 4 L420 38 M446 4 L420 24 M464 20 L438 38"
            stroke="#E4A83E"
            strokeWidth="2.6"
          />

          {/* Bloc 12 (466..512) : Bandes horizontales Terracotta */}
          <rect x="466" y="0" width="46" height="42" fill="#1A100C" />
          {[2, 10, 18, 26, 34].map((y) => (
            <rect key={`b12-${y}`} x="468" y={y} width="42" height="5" fill="#C8522E" />
          ))}

          {/* Bloc 13 (512..556) : Grecque carrée Violette */}
          <rect x="512" y="0" width="44" height="42" fill="#1A101E" />
          <rect x="516" y="4" width="36" height="34" stroke="#7E3F8F" strokeWidth="3.5" />
          <rect x="523" y="11" width="22" height="20" stroke="#9B51B0" strokeWidth="3" />
          <rect x="530" y="17" width="8" height="8" fill="#7E3F8F" />

          {/* Bloc 14 (556..600) : Bandes horizontales Bleu Indigo */}
          <rect x="556" y="0" width="44" height="42" fill="#0E1722" />
          {[2, 10, 18, 26, 34].map((y) => (
            <rect key={`b14-${y}`} x="558" y={y} width="40" height="5" fill="#2B5B8C" />
          ))}
        </pattern>
      </defs>
      <rect width="1200" height="42" fill="url(#pauses-kente-strip)" />
    </svg>
  )
}

/**
 * Colonne verticale de motifs Adinkra gravés (Roue Solaire à 16 rayons,
 * Dwennimmen / Sankofa, Adinkrahene concentrique et galons Kente violets/or)
 * reproduisant fidèlement les bordures gauche et droite de l'image sélectionnée.
 */
export function PausesAdinkraSidePillarSvg({ side = 'left', className = '' }) {
  const isLeft = side === 'left'
  const rays = Array.from({ length: 16 }, (_, i) => (i * Math.PI * 2) / 16)

  return (
    <svg
      className={className}
      viewBox="0 0 68 820"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{
        width: 64,
        height: '100%',
        display: 'block',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <g stroke="#966F33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.82">
        {/* Motif 1 (Haut) : Demi-roue / Volutes Gye Nyame */}
        {isLeft ? (
          <g transform="translate(34, 72)">
            <circle cx="-18" cy="0" r="24" stroke="#8C652D" strokeWidth="2.5" />
            {rays.map((ang, idx) => (
              <line
                key={`top-l-${idx}`}
                x1={-18 + Math.cos(ang) * 5}
                y1={Math.sin(ang) * 5}
                x2={-18 + Math.cos(ang) * 23}
                y2={Math.sin(ang) * 23}
                stroke="#8C652D"
                strokeWidth="1.8"
              />
            ))}
          </g>
        ) : (
          <g transform="translate(34, 68)">
            <path d="M-16 -24 C-2 -32, 16 -22, 12 -6 C8 8, -12 8, -16 22 C-20 34, 4 42, 18 32" strokeWidth="3.2" />
            <circle cx="-12" cy="-8" r="5" />
            <circle cx="10" cy="14" r="5" />
            <circle cx="14" cy="-22" r="3" fill="#966F33" />
          </g>
        )}

        {/* Motif 2 : Grande Roue Solaire Adinkra à 16 rayons (niveau Cartes KPI) */}
        <g transform="translate(34, 188)">
          <circle cx="0" cy="0" r="28" stroke="#9E7538" strokeWidth="3" fill="#16110C" />
          <circle cx="0" cy="0" r="6" stroke="#9E7538" strokeWidth="2.2" fill="#16110C" />
          {rays.map((ang, idx) => (
            <line
              key={`sun1-${idx}`}
              x1={Math.cos(ang) * 6}
              y1={Math.sin(ang) * 6}
              x2={Math.cos(ang) * 27}
              y2={Math.sin(ang) * 27}
              stroke="#9E7538"
              strokeWidth="2.1"
            />
          ))}
        </g>

        {/* Motif 3 : Volutes Dwennimmen & Gouttes Adinkra */}
        <g transform="translate(34, 282)">
          <path d="M-22 -18 C-4 -30, 18 -14, 6 4 C-2 14, -16 10, -12 -2" strokeWidth="3" />
          <path d="M22 18 C4 30, -18 14, -6 -4 C2 -14, 16 -10, 12 2" strokeWidth="3" />
          <circle cx="-16" cy="24" r="6" strokeWidth="2.6" />
          <circle cx="16" cy="-24" r="5" strokeWidth="2.4" />
        </g>

        {/* Motif 4 : Barres diagonales & Crochets Sankofa (niveau Graphiques) */}
        <g transform="translate(34, 386)">
          <path d="M-20 26 L18 -22" strokeWidth="4" />
          <path d="M-6 30 L24 -8" strokeWidth="3.2" />
          <path d="M-22 -14 C-10 -28, 12 -24, 14 -8 C16 4, 2 10, -6 4" strokeWidth="3" />
          <circle cx="14" cy="24" r="5.5" strokeWidth="2.5" />
        </g>

        {/* Motif 5 : Seconde Roue Solaire Adinkra à 16 rayons */}
        <g transform="translate(34, 492)">
          <circle cx="0" cy="0" r="27" stroke="#9E7538" strokeWidth="3" fill="#16110C" />
          <circle cx="0" cy="0" r="5.5" stroke="#9E7538" strokeWidth="2" fill="#16110C" />
          {rays.map((ang, idx) => (
            <line
              key={`sun2-${idx}`}
              x1={Math.cos(ang) * 5.5}
              y1={Math.sin(ang) * 5.5}
              x2={Math.cos(ang) * 26}
              y2={Math.sin(ang) * 26}
              stroke="#9E7538"
              strokeWidth="2"
            />
          ))}
        </g>

        {/* Motif 6 : Adinkrahene (Cercles concentriques & Spirales) */}
        <g transform="translate(34, 595)">
          <circle cx="8" cy="0" r="26" strokeWidth="3" />
          <circle cx="8" cy="0" r="17" strokeWidth="2.6" />
          <circle cx="8" cy="0" r="8" strokeWidth="2.4" />
        </g>

        {/* Motif 7 (Bas) : Galons Kente violets/or à gauche, Spirales violettes/or à droite */}
        {isLeft ? (
          <g transform="translate(8, 660)">
            {[0, 12, 24, 36].map((x, i) => (
              <g key={`kente-v-${x}`}>
                <rect
                  x={x}
                  y="0"
                  width="7"
                  height="145"
                  rx="2"
                  fill={i % 2 === 0 ? '#5D2A6B' : '#966F33'}
                  stroke="none"
                />
                {[12, 34, 56, 78, 100, 122].map((y) => (
                  <rect
                    key={`stripe-${x}-${y}`}
                    x={x}
                    y={y}
                    width="7"
                    height="4"
                    fill="#140E0A"
                    stroke="none"
                  />
                ))}
              </g>
            ))}
          </g>
        ) : (
          <g transform="translate(34, 725)">
            <circle cx="10" cy="-18" r="24" stroke="#683078" strokeWidth="3.2" />
            <circle cx="10" cy="-18" r="15" stroke="#683078" strokeWidth="2.8" />
            <circle cx="10" cy="-18" r="7" stroke="#966F33" strokeWidth="2.4" />
            <path d="M-22 38 C-14 18, 14 18, 22 38" stroke="#966F33" strokeWidth="3" />
            <circle cx="0" cy="36" r="6" stroke="#966F33" strokeWidth="2.4" />
          </g>
        )}
      </g>
    </svg>
  )
}

/**
 * Les 4 icônes KPI exactes de l'image sélectionnée :
 * 1) 'pause' : Carré arrondi ambre avec deux barres verticales ||
 * 2) 'check' : Cercle vert émeraude avec coche ✓
 * 3) 'timer' : Chronomètre circulaire doré avec graduations et bouton-poussoir supérieur
 * 4) 'alert' : Losange rouge corail (carré à 45°) avec point d'exclamation !
 */
export function PausesKpiIconSvg({ kind = 'pause', size = 44 }) {
  if (kind === 'pause') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="4" y="4" width="40" height="40" rx="9" fill="#2A1D0E" stroke="#D99228" strokeWidth="2.2" />
        <rect x="16" y="13" width="5.5" height="22" rx="2" fill="#F0A830" />
        <rect x="26.5" y="13" width="5.5" height="22" rx="2" fill="#F0A830" />
      </svg>
    )
  }

  if (kind === 'check') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="24" cy="24" r="20" fill="#10291E" stroke="#2EA06B" strokeWidth="2.4" />
        <path
          d="M15.5 24.5 L21.5 30.5 L33 18.5"
          stroke="#34D399"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'timer') {
    const ticks = Array.from({ length: 12 }, (_, i) => (i * Math.PI * 2) / 12)
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M19 4 H29 M24 4 V8" stroke="#E5A235" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M35 9 L38 12" stroke="#E5A235" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="26" r="17.5" fill="#261B0E" stroke="#E5A235" strokeWidth="2.4" />
        {ticks.map((ang, idx) => (
          <line
            key={idx}
            x1={24 + Math.cos(ang) * 13.5}
            y1={26 + Math.sin(ang) * 13.5}
            x2={24 + Math.cos(ang) * 16}
            y2={26 + Math.sin(ang) * 16}
            stroke="#E5A235"
            strokeWidth="1.6"
          />
        ))}
        <path d="M24 26 V16.5 M24 26 L30 29" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="26" r="2" fill="#FBBF24" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect
        x="24"
        y="4.5"
        width="27.5"
        height="27.5"
        rx="4"
        transform="rotate(45 24 4.5)"
        fill="#2C1414"
        stroke="#D96552"
        strokeWidth="2.3"
      />
      <path d="M24 15.5 V26.5" stroke="#F0715E" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24" cy="32.5" r="2" fill="#F0715E" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// GÉOMÉTRIE DYNAMIQUE DES COURBES
// ═══════════════════════════════════════════════════════════════════════════

function buildDynamicSplineGeometry(values = [0, 0, 0, 0, 0, 0, 0], maxValue = 1) {
  const safeMax = Math.max(1, maxValue)
  const count = Math.max(2, values.length)
  const startX = 14
  const endX = 248
  const stepX = (endX - startX) / (count - 1)
  const baseLine = 54
  const topLine = 14
  const span = baseLine - topLine

  const pts = values.map((raw, idx) => {
    const v = Math.max(0, Number(raw) || 0)
    const x = Math.round(startX + idx * stepX)
    const y = Math.round(baseLine - (v / safeMax) * span)
    return { x, y, v }
  })

  let linePath = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const midX = Math.round((p0.x + p1.x) / 2)
    linePath += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${baseLine} L ${pts[0].x} ${baseLine} Z`
  return { pts, linePath, areaPath, baseLine }
}

function build24hCurveGeometry(points = [], maxVal = 1) {
  const safeMax = Math.max(1, maxVal)
  const leftX = 38
  const rightX = 582
  const topY = 24
  const baseY = 142
  const spanY = baseY - topY
  const count = Math.max(2, points.length)
  const stepX = (rightX - leftX) / (count - 1)

  const coords = points.map((v, idx) => {
    const num = Math.max(0, Number(v) || 0)
    const x = Math.round(leftX + idx * stepX)
    const y = Math.round(baseY - (num / safeMax) * spanY)
    return { x, y, v: num }
  })

  let linePath = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i]
    const p1 = coords[i + 1]
    const midX = Math.round((p0.x + p1.x) / 2)
    linePath += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${baseY} L ${coords[0].x} ${baseY} Z`
  return { coords, linePath, areaPath, baseY }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. EN-TÊTE EXÉCUTIF (FIDÈLE À L'IMAGE SÉLECTIONNÉE)
// ═══════════════════════════════════════════════════════════════════════════

export function PausesCulturalHero({
  darkMode = true,
  viewMode = 'jour',
  onViewModeChange,
  selectedDate,
  onShiftDate,
  onDateChange,
  entreprises = [],
  selectedEnterpriseId = 'all',
  onSelectEnterprise,
  isSuperAdmin = false,
  onToggleTheme,
  onBackDashboard,
  onToggleAddForm,
  showAddForm = false,
  onExportCsv,
}) {
  const formattedDateLabel = useMemo(() => {
    if (!selectedDate) return ''
    const parsed = new Date(`${selectedDate}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return selectedDate
    const raw = parsed.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }, [selectedDate])

  return (
    <header aria-label="En-tête Pauses En-Check" style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          padding: '6px 4px 2px',
        }}
      >
        {/* Gauche : Flèche retour + Médaillon circulaire doré + PAUSES — ON GÈRE ! */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onBackDashboard && (
            <button
              type="button"
              className="pauses-v2-back-btn"
              onClick={onBackDashboard}
              title="Retour au Dashboard"
              aria-label="Retour au Dashboard"
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                border: '1px solid rgba(196, 147, 74, 0.45)',
                background: 'rgba(26, 20, 14, 0.92)',
                color: '#E5A846',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div
            onClick={onBackDashboard}
            title="Retour au Dashboard"
            style={{ cursor: onBackDashboard ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
          >
            <EnCheckBrandMark size={64} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(1.45rem, 2.4vw, 2.05rem)',
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: 'var(--pt-text)',
                lineHeight: 1.12,
              }}
            >
              PAUSES — ON GÈRE !
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.84rem',
                color: 'var(--pt-muted)',
                fontWeight: 500,
              }}
            >
              Réelles pointées · Présumées marquées · Pauses en direct &amp; Hors planning
            </p>
          </div>
        </div>

        {/* Droite : Jour | Semaine | Mois + < Date > + + Ajouter une pause + CSV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            role="group"
            aria-label="Mode de période"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(26, 20, 14, 0.92)',
              border: '1px solid rgba(196, 147, 74, 0.45)',
              borderRadius: 999,
              padding: 3,
            }}
          >
            {['jour', 'semaine', 'mois'].map((mode, idx) => {
              const active = viewMode === mode
              return (
                <div key={mode} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {idx > 0 && !active && viewMode !== ['jour', 'semaine', 'mois'][idx - 1] && (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 1,
                        height: 16,
                        background: 'rgba(196, 147, 74, 0.28)',
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onViewModeChange && onViewModeChange(mode)}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      padding: '7px 16px',
                      fontSize: '0.84rem',
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer',
                      background: active
                        ? 'linear-gradient(180deg, #E2A84B 0%, #B87B26 100%)'
                        : 'transparent',
                      color: active ? '#18110A' : '#D6C7B2',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Navigateur de date < Mardi 18 juin 2024 > */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(26, 20, 14, 0.92)',
              border: '1px solid rgba(196, 147, 74, 0.45)',
              borderRadius: 999,
              padding: '7px 14px',
              color: '#EAE0D2',
            }}
          >
            <button
              type="button"
              onClick={() => onShiftDate && onShiftDate(-1)}
              aria-label="Période précédente"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#C89B54',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                position: 'relative',
              }}
            >
              <span>{formattedDateLabel}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange && onDateChange(e.target.value)}
                aria-label="Choisir une date"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: 1,
                  height: 1,
                  pointerEvents: 'none',
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => onShiftDate && onShiftDate(1)}
              aria-label="Période suivante"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#C89B54',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {isSuperAdmin && entreprises.length > 0 && onSelectEnterprise && (
            <label className="employes-enterprise-select-pill" title="Filtrer par entreprise">
              <Building2 size={13} />
              <select
                value={selectedEnterpriseId || 'all'}
                onChange={(e) => onSelectEnterprise(e.target.value)}
                aria-label="Sélectionner une entreprise"
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map((ent) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </label>
          )}

          {/* Bouton doré + Ajouter une pause */}
          {onToggleAddForm && (
            <button
              type="button"
              onClick={onToggleAddForm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 999,
                border: '1px solid #F3C784',
                background: 'linear-gradient(180deg, #E8B866 0%, #BA8130 100%)',
                color: '#18110A',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(217, 146, 40, 0.25)',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>{showAddForm ? 'Fermer' : 'Ajouter une pause'}</span>
            </button>
          )}

          {/* Bouton CSV */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              title="Exporter en CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 999,
                border: '1px solid rgba(196, 147, 74, 0.48)',
                background: 'rgba(26, 20, 14, 0.92)',
                color: '#EAE0D2',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <span>CSV</span>
            </button>
          )}

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid rgba(196, 147, 74, 0.42)',
                background: 'rgba(26, 20, 14, 0.92)',
                color: '#EAE0D2',
                cursor: 'pointer',
              }}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. LES 4 CARTES KPI EXÉCUTIVES (FIDÈLES AUX MOTIFS DE L'IMAGE SÉLECTIONNÉE)
// ═══════════════════════════════════════════════════════════════════════════

export function PausesExecutiveKpis({
  paies = [],
  activeTab = 'reelles',
  subFilter = 'all',
  onSelectTab,
  onSelectSubFilter,
  nowMs = Date.now(),
}) {
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const presumedPauses = useMemo(() => paies.filter((p) => estPausePresumee(p) && p.statut !== 'ecartee'), [paies])
  const presumedPending = useMemo(() => paies.filter((p) => p.statut === 'presumee'), [paies])
  const openPauses = useMemo(() => realPauses.filter((p) => p.ouverte), [realPauses])
  const unplannedRealPauses = useMemo(() => realPauses.filter((p) => p.estNonPlanifiee), [realPauses])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])

  const realDurationMin = useMemo(
    () => realPauses.filter((p) => !p.ouverte).reduce((acc, p) => acc + (Number(p.dureeMinutes) || 0), 0),
    [realPauses]
  )

  const pointeeCount = useMemo(() => realPauses.filter((p) => p.source === 'pointee').length, [realPauses])
  const adminCount = useMemo(() => realPauses.filter((p) => p.source === 'admin').length, [realPauses])
  const realValidatedCount = useMemo(() => realPauses.filter((p) => p.statut === 'validee').length, [realPauses])

  const maxBase = Math.max(1, paies.length)

  const splineCard1 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          Math.max(1, pointeeCount),
          Math.max(1, adminCount + 1),
          Math.max(1, realPauses.length),
          Math.max(1, pointeeCount + 1),
          Math.max(1, realPauses.length + 1),
          Math.max(1, pointeeCount),
          Math.max(1, realPauses.length),
        ],
        maxBase + 2
      ),
    [pointeeCount, adminCount, realPauses.length, maxBase]
  )

  const splineCard2 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          Math.max(1, pointeeCount),
          Math.max(1, realValidatedCount + 1),
          Math.max(1, realPauses.length),
          Math.max(1, pointeeCount),
          Math.max(1, realPauses.length + 1),
          Math.max(1, realPauses.length),
          Math.max(1, pointeeCount + 1),
        ],
        maxBase + 2
      ),
    [pointeeCount, realValidatedCount, realPauses.length, maxBase]
  )

  const splineCard3 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          openPauses.length,
          unplannedRealPauses.length + 1,
          openPauses.length + 1,
          openPauses.length + unplannedRealPauses.length + 1,
          openPauses.length + 1,
          unplannedRealPauses.length + 2,
          openPauses.length + 1,
        ],
        Math.max(3, realPauses.length + 2)
      ),
    [openPauses.length, unplannedRealPauses.length, realPauses.length]
  )

  const splineCard4 = useMemo(
    () =>
      buildDynamicSplineGeometry(
        [
          presumedPending.length,
          anomaliesPauses.length + 1,
          presumedPauses.length + 1,
          presumedPending.length + 1,
          anomaliesPauses.length + 2,
          presumedPending.length + anomaliesPauses.length + 1,
          presumedPauses.length + 1,
        ],
        Math.max(3, maxBase + 2)
      ),
    [presumedPending.length, presumedPauses.length, anomaliesPauses.length, maxBase]
  )

  const liveTimerSample = openPauses.length > 0 ? formaterTempsPauseEnDirect(openPauses[0], nowMs) : '0m'

  return (
    <section
      aria-label="Indicateurs exécutifs des pauses"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 14,
        marginBottom: 16,
      }}
      className="pauses-kpi-four-grid"
    >
      {/* CARTE 1 : PAUSES RÉELLES (ICÔNE PAUSE [ || ] DORÉE) */}
      <article
        onClick={() => {
          onSelectTab && onSelectTab('reelles')
          onSelectSubFilter && onSelectSubFilter('all')
        }}
        style={{
          background: 'linear-gradient(180deg, rgba(28, 22, 16, 0.96) 0%, rgba(20, 15, 11, 0.98) 100%)',
          border: activeTab === 'reelles' && subFilter === 'all'
            ? '1.5px solid #D99B38'
            : '1px solid rgba(196, 147, 74, 0.36)',
          borderRadius: 14,
          padding: '14px 16px 8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 146,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <PausesKpiIconSvg kind="pause" size={44} />
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '2rem', fontWeight: 800, color: '#F0A830', lineHeight: 1 }}>
                {realPauses.length}
              </strong>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#E5B869' }}>
                Pauses
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#EAE0D2', marginTop: 4 }}>
              {formatDuree(realDurationMin)}
            </div>
          </div>
        </div>

        <svg viewBox="0 0 260 60" style={{ width: '100%', height: 54, display: 'block', marginTop: 6 }} aria-hidden="true">
          <defs>
            <linearGradient id="pause-card1-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E59A2E" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#E59A2E" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={splineCard1.areaPath} fill="url(#pause-card1-grad)" />
          <path d={splineCard1.linePath} fill="none" stroke="#E59A2E" strokeWidth="2.2" strokeLinecap="round" />
          {splineCard1.pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
          ))}
        </svg>
      </article>

      {/* CARTE 2 : RÉELLES & VALIDÉES (ICÔNE CERCLE COCHE VERTE) */}
      <article
        onClick={() => {
          onSelectTab && onSelectTab('reelles')
          onSelectSubFilter && onSelectSubFilter(subFilter === 'reelles_pointees' ? 'all' : 'reelles_pointees')
        }}
        style={{
          background: 'linear-gradient(180deg, rgba(28, 22, 16, 0.96) 0%, rgba(20, 15, 11, 0.98) 100%)',
          border: subFilter === 'reelles_pointees'
            ? '1.5px solid #2EA06B'
            : '1px solid rgba(196, 147, 74, 0.36)',
          borderRadius: 14,
          padding: '14px 16px 8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 146,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <PausesKpiIconSvg kind="check" size={44} />
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '2rem', fontWeight: 800, color: '#34D399', lineHeight: 1 }}>
                {realPauses.length}
              </strong>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#4ADE80' }}>
                Réelles &amp; Validées
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#B8AC9C', marginTop: 5 }}>
              {pointeeCount} pointée{pointeeCount > 1 ? 's' : ''} · {adminCount} admin
            </div>
          </div>
        </div>

        <svg viewBox="0 0 260 60" style={{ width: '100%', height: 54, display: 'block', marginTop: 6 }} aria-hidden="true">
          <defs>
            <linearGradient id="pause-card2-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2EA06B" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#2EA06B" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={splineCard2.areaPath} fill="url(#pause-card2-grad)" />
          <path d={splineCard2.linePath} fill="none" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" />
          {splineCard2.pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#A7F3D0" stroke="#059669" strokeWidth="1.2" />
          ))}
        </svg>
      </article>

      {/* CARTE 3 : EN PAUSE EN DIRECT (ICÔNE CHRONOMÈTRE GRADUÉ DORÉ) */}
      <article
        onClick={() => {
          onSelectTab && onSelectTab('reelles')
          onSelectSubFilter && onSelectSubFilter(subFilter === 'en_direct' ? 'all' : 'en_direct')
        }}
        style={{
          background: 'linear-gradient(180deg, rgba(28, 22, 16, 0.96) 0%, rgba(20, 15, 11, 0.98) 100%)',
          border: subFilter === 'en_direct'
            ? '1.5px solid #F0A830'
            : '1px solid rgba(196, 147, 74, 0.36)',
          borderRadius: 14,
          padding: '14px 16px 8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 146,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <PausesKpiIconSvg kind="timer" size={44} />
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '2rem', fontWeight: 800, color: '#F0A830', lineHeight: 1 }}>
                {openPauses.length}
              </strong>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#EAE0D2' }}>
                En pause en direct
              </span>
            </div>
            <div style={{ fontSize: '0.92rem', color: '#D6C7B2', marginTop: 4 }}>
              (⏱ {liveTimerSample})
            </div>
          </div>
        </div>

        <svg viewBox="0 0 260 60" style={{ width: '100%', height: 54, display: 'block', marginTop: 6 }} aria-hidden="true">
          <defs>
            <linearGradient id="pause-card3-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E59A2E" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#E59A2E" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={splineCard3.areaPath} fill="url(#pause-card3-grad)" />
          <path d={splineCard3.linePath} fill="none" stroke="#E59A2E" strokeWidth="2.2" strokeLinecap="round" />
          {splineCard3.pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
          ))}
        </svg>
      </article>

      {/* CARTE 4 : PRÉSUMÉES À STATUER · ANOMALIES (ICÔNE LOSANGE ! CORAIL) */}
      <article
        onClick={() => {
          onSelectTab && onSelectTab('presumees')
          onSelectSubFilter && onSelectSubFilter('all')
        }}
        style={{
          background: 'linear-gradient(180deg, rgba(28, 22, 16, 0.96) 0%, rgba(20, 15, 11, 0.98) 100%)',
          border: activeTab === 'presumees' || activeTab === 'anomalies'
            ? '1.5px solid #E06350'
            : '1px solid rgba(196, 147, 74, 0.36)',
          borderRadius: 14,
          padding: '14px 16px 8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 146,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <PausesKpiIconSvg kind="alert" size={44} />
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '2rem', fontWeight: 800, color: '#F0715E', lineHeight: 1 }}>
                {presumedPending.length}
              </strong>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#F08A78' }}>
                Présumées à statuer
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#D6C7B2', marginTop: 4 }}>
              · {anomaliesPauses.length} Anomalie{anomaliesPauses.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <svg viewBox="0 0 260 60" style={{ width: '100%', height: 54, display: 'block', marginTop: 6 }} aria-hidden="true">
          <defs>
            <linearGradient id="pause-card4-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E06350" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#E06350" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={splineCard4.areaPath} fill="url(#pause-card4-grad)" />
          <path d={splineCard4.linePath} fill="none" stroke="#E06350" strokeWidth="2.2" strokeLinecap="round" />
          {splineCard4.pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#FECACA" stroke="#DC2626" strokeWidth="1.2" />
          ))}
        </svg>
      </article>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LES 2 GRAPHIQUES ANALYTIQUES (ACTIVITÉ 24H & DONUT RÉPARTITION)
// ═══════════════════════════════════════════════════════════════════════════

export function PausesAnalyticsCharts({ paies = [], onSelectTab }) {
  const { realByHour, presumedByHour, maxHourly } = useMemo(() => {
    const r = Array(24).fill(0)
    const pr = Array(24).fill(0)

    for (const p of paies) {
      if (p.statut === 'ecartee') continue
      let hour = null
      if (p.debutISO) {
        const parts = getHeuresMinutesLocales(p.debutISO)
        if (parts && Number.isFinite(parts.heures)) hour = parts.heures
      }
      if (hour === null && p.debutHHMM && /^\d{2}:\d{2}/.test(p.debutHHMM)) {
        hour = parseInt(p.debutHHMM.slice(0, 2), 10)
      }
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue

      if (estPauseReelleEffectuee(p)) {
        r[hour] += 1
      } else if (estPausePresumee(p)) {
        pr[hour] += 1
      }
    }

    const rPoints = []
    const prPoints = []
    for (let h = 0; h < 24; h += 2) {
      rPoints.push(r[h] + (r[h + 1] || 0))
      prPoints.push(pr[h] + (pr[h + 1] || 0))
    }

    const maxVal = Math.max(8, ...rPoints, ...prPoints)
    return { realByHour: rPoints, presumedByHour: prPoints, maxHourly: maxVal }
  }, [paies])

  const realCurve = useMemo(() => build24hCurveGeometry(realByHour, maxHourly), [realByHour, maxHourly])
  const presumedCurve = useMemo(() => build24hCurveGeometry(presumedByHour, maxHourly), [presumedByHour, maxHourly])

  const yTicks = useMemo(() => {
    const step = maxHourly / 8
    return Array.from({ length: 9 }, (_, idx) => {
      const val = Math.round(maxHourly - idx * step)
      const y = Math.round(24 + (idx * (142 - 24)) / 8)
      return { val, y }
    })
  }, [maxHourly])

  const donutStats = useMemo(() => {
    const active = paies.filter((p) => p.statut !== 'ecartee')
    const realClosed = active.filter((p) => estPauseReelleEffectuee(p) && !p.ouverte).length
    const realOpen = active.filter((p) => estPauseReelleEffectuee(p) && p.ouverte).length
    const presumed = active.filter((p) => estPausePresumee(p)).length
    const totalReal = realClosed + realOpen
    const grandTotal = Math.max(1, totalReal + presumed)

    const realPct = active.length > 0 ? Math.round((totalReal / grandTotal) * 1000) / 10 : 0
    const presumedPct = active.length > 0 ? Math.round((presumed / grandTotal) * 1000) / 10 : 0
    const openPct = active.length > 0 ? Math.round((realOpen / grandTotal) * 1000) / 10 : 0

    return {
      totalActive: active.length,
      totalReal,
      realClosed,
      realOpen,
      presumed,
      realPct,
      presumedPct,
      openPct,
      grandTotal,
    }
  }, [paies])

  const circumference = 2 * Math.PI * 44
  const realClosedArc = (donutStats.realClosed / donutStats.grandTotal) * circumference
  const presumedArc = (donutStats.presumed / donutStats.grandTotal) * circumference
  const openArc = (donutStats.realOpen / donutStats.grandTotal) * circumference

  return (
    <section
      aria-label="Graphiques analytiques des pauses"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.9fr) minmax(290px, 1fr)',
        gap: 14,
        marginBottom: 18,
      }}
      className="pauses-charts-two-grid"
    >
      {/* GRAPHIQUE 1 : ACTIVITÉ DES PAUSES — 24 HEURES */}
      <article
        style={{
          background: 'linear-gradient(180deg, rgba(26, 20, 15, 0.96) 0%, rgba(19, 15, 11, 0.98) 100%)',
          border: '1px solid rgba(196, 147, 74, 0.36)',
          borderRadius: 14,
          padding: '16px 18px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#EAE0D2' }}>
            Activité des pauses — 24 heures
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: '0.82rem', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#D6C7B2' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2EA06B', display: 'inline-block' }} />
              Réelles pointées
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#D6C7B2' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E06350', display: 'inline-block' }} />
              Présumées
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 600 166"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label="Activité des pauses sur 24 heures"
        >
          <defs>
            <linearGradient id="pauses-24h-green" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2EA06B" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#2EA06B" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="pauses-24h-coral-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D97348" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#D97348" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Zones de Nuit violettes avec bordures pointillées comme dans l'image */}
          <rect
            x="38"
            y="22"
            width="168"
            height="120"
            fill="rgba(78, 52, 102, 0.36)"
          />
          <line x1="38" y1="22" x2="38" y2="142" stroke="#8C74A6" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="206" y1="22" x2="206" y2="142" stroke="#8C74A6" strokeWidth="1" strokeDasharray="3 3" />

          <rect
            x="410"
            y="22"
            width="172"
            height="120"
            fill="rgba(78, 52, 102, 0.36)"
          />
          <line x1="410" y1="22" x2="410" y2="142" stroke="#8C74A6" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="582" y1="22" x2="582" y2="142" stroke="#8C74A6" strokeWidth="1" strokeDasharray="3 3" />

          <text x="122" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fill="#CFC2DC">
            Nuit
          </text>
          <text x="496" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fill="#CFC2DC">
            Nuit
          </text>

          {/* Lignes horizontales et axe Y */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <text x="20" y={t.y + 3} textAnchor="end" fontSize="9.5" fill="#B8AC9C">
                {t.val}
              </text>
              <line
                x1="38"
                y1={t.y}
                x2="582"
                y2={t.y}
                stroke="#FFFFFF"
                strokeOpacity="0.07"
              />
            </g>
          ))}

          {/* Courbe Présumées */}
          <path d={presumedCurve.areaPath} fill="url(#pauses-24h-coral-area)" />
          <path
            d={presumedCurve.linePath}
            fill="none"
            stroke="#E06F4B"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          {presumedCurve.coords.map((pt, idx) => (
            <circle key={`pr-${idx}`} cx={pt.x} cy={pt.y} r="3.2" fill="#FDBA74" stroke="#C85232" strokeWidth="1.4" />
          ))}

          {/* Courbe Réelles pointées */}
          <path d={realCurve.areaPath} fill="url(#pauses-24h-green)" />
          <path
            d={realCurve.linePath}
            fill="none"
            stroke="#34B377"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {realCurve.coords.map((pt, idx) => (
            <circle key={`re-${idx}`} cx={pt.x} cy={pt.y} r="3.2" fill="#A7F3D0" stroke="#1E824C" strokeWidth="1.4" />
          ))}

          {/* Axe X : 00h 03h 06h 09h 12h 15h 18h 21h 23h */}
          {['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h', '23h'].map((lbl, idx, arr) => {
            const x = Math.round(38 + (idx * (582 - 38)) / (arr.length - 1))
            return (
              <text
                key={lbl}
                x={x}
                y="158"
                textAnchor="middle"
                fontSize="10"
                fontWeight="500"
                fill="#C8B9A6"
              >
                {lbl}
              </text>
            )
          })}
        </svg>
      </article>

      {/* GRAPHIQUE 2 : RÉPARTITION DES PAUSES (DONUT) */}
      <article
        style={{
          background: 'linear-gradient(180deg, rgba(26, 20, 15, 0.96) 0%, rgba(19, 15, 11, 0.98) 100%)',
          border: '1px solid rgba(196, 147, 74, 0.36)',
          borderRadius: 14,
          padding: '16px 18px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700, color: '#EAE0D2' }}>
          Répartition des pauses
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 14,
            flexWrap: 'wrap',
            margin: 'auto 0',
          }}
        >
          <div style={{ position: 'relative', width: 146, height: 146 }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }} aria-hidden="true">
              <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
              {realClosedArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#2E8B57"
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, realClosedArc - 1.5)} ${circumference}`}
                  transform="rotate(-90 60 60)"
                />
              )}
              {presumedArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#D95F4E"
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, presumedArc - 1.5)} ${circumference}`}
                  strokeDashoffset={-realClosedArc}
                  transform="rotate(-90 60 60)"
                />
              )}
              {openArc > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#C88A32"
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, openArc - 1.5)} ${circumference}`}
                  strokeDashoffset={-(realClosedArc + presumedArc)}
                  transform="rotate(-90 60 60)"
                />
              )}
            </svg>
            <div className="pointages-donut-center">
              <strong style={{ fontSize: '1.55rem', color: '#F5EFE6' }}>
                {String(donutStats.realPct).replace('.', ',')}%
              </strong>
              <span style={{ color: '#4ADE80', fontWeight: 600, fontSize: '0.86rem' }}>
                Réelles
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem' }}>
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('reelles')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#EAE0D2',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: 0,
              }}
            >
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#2E8B57', display: 'inline-block' }} />
              <span>
                <strong style={{ color: '#4ADE80' }}>{donutStats.totalReal}</strong> Réelles · {String(donutStats.realPct).replace('.', ',')}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('presumees')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#EAE0D2',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: 0,
              }}
            >
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#D95F4E', display: 'inline-block' }} />
              <span>
                <strong>{donutStats.presumed}</strong> Présumées · {String(donutStats.presumedPct).replace('.', ',')}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('reelles')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#EAE0D2',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: 0,
              }}
            >
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#C88A32', display: 'inline-block' }} />
              <span>
                <strong>{donutStats.realOpen}</strong> En direct · {String(donutStats.openPct).replace('.', ',')}%
              </span>
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LISTE DES PAUSES DES COLLABORATEURS (HISTORIQUE RÉEL VS PRÉSUMÉES)
// ═══════════════════════════════════════════════════════════════════════════

export function PausesCollaborateursSection({
  paies = [],
  employesById = {},
  activeTab = 'reelles',
  subFilter = 'all',
  searchTerm = '',
  onSearchChange,
  onSelectTab,
  onSelectSubFilter,
  onStatuer,
  onOpenEmployeeFiche,
  onOpenPointages,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const hasOpenPause = useMemo(() => paies.some((p) => p.ouverte), [paies])

  useEffect(() => {
    if (!hasOpenPause) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasOpenPause])

  // Distinction stricte :
  // - `realPauses` = uniquement les pauses réellement effectuées (non présumées)
  // - `presumedPauses` = uniquement les pauses présumées par la grille horaire (non pointées)
  const realPauses = useMemo(() => paies.filter((p) => estPauseReelleEffectuee(p)), [paies])
  const presumedPauses = useMemo(() => paies.filter((p) => estPausePresumee(p) && p.statut !== 'ecartee'), [paies])
  const anomaliesPauses = useMemo(() => paies.filter((p) => Boolean(p.anomalie) && p.statut !== 'ecartee'), [paies])

  const filteredList = useMemo(() => {
    let base = []
    if (activeTab === 'reelles') {
      base = realPauses
      if (subFilter === 'reelles_pointees') base = base.filter((p) => p.source === 'pointee')
      else if (subFilter === 'reelles_admin') base = base.filter((p) => p.source === 'admin')
      else if (subFilter === 'reelles_planifiees') base = base.filter((p) => !p.estNonPlanifiee)
      else if (subFilter === 'reelles_hors_planning') base = base.filter((p) => p.estNonPlanifiee)
      else if (subFilter === 'en_direct') base = base.filter((p) => p.ouverte)
    } else if (activeTab === 'presumees') {
      base = presumedPauses
      if (subFilter === 'presumees_a_statuer') base = base.filter((p) => p.statut === 'presumee')
      else if (subFilter === 'presumees_validees') base = base.filter((p) => p.statut === 'validee')
    } else if (activeTab === 'anomalies') {
      base = anomaliesPauses
    } else {
      base = paies.filter((p) => p.statut !== 'ecartee')
    }

    const q = String(searchTerm || '').trim().toLowerCase()
    if (!q) return base
    return base.filter((p) => {
      const hay = `${p.employe || ''} ${p.matricule || ''} ${p.entreprise_nom || ''} ${p.motif || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [activeTab, subFilter, realPauses, presumedPauses, anomaliesPauses, paies, searchTerm])

  return (
    <section aria-label="Pauses des collaborateurs">
      {/* En-tête de section : Pauses des collaborateurs [24] + Onglets Réelles (non présumées) vs Présumées */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#EAE0D2' }}>
            Pauses des collaborateurs
          </h2>
          <span
            style={{
              background: 'rgba(42, 30, 18, 0.95)',
              border: '1px solid rgba(196, 147, 74, 0.48)',
              color: '#E5A946',
              borderRadius: 6,
              padding: '2px 9px',
              fontSize: '0.84rem',
              fontWeight: 700,
            }}
          >
            {filteredList.length}
          </span>
        </div>

        {/* Sélecteur permettant de distinguer l'Historique des pauses réelles (par défaut) et les Pauses présumées */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              onSelectTab && onSelectTab('reelles')
              onSelectSubFilter && onSelectSubFilter('all')
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'reelles' ? '1px solid #2EA06B' : '1px solid rgba(196, 147, 74, 0.28)',
              background: activeTab === 'reelles' ? 'rgba(46, 160, 107, 0.2)' : 'rgba(26, 20, 14, 0.85)',
              color: activeTab === 'reelles' ? '#4ADE80' : '#D6C7B2',
            }}
          >
            ✓ Historique · Pauses réelles ({realPauses.length})
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab && onSelectTab('presumees')
              onSelectSubFilter && onSelectSubFilter('all')
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'presumees' ? '1px solid #D96552' : '1px solid rgba(196, 147, 74, 0.28)',
              background: activeTab === 'presumees' ? 'rgba(217, 101, 82, 0.2)' : 'rgba(26, 20, 14, 0.85)',
              color: activeTab === 'presumees' ? '#FDBA74' : '#D6C7B2',
            }}
          >
            ⏳ Pauses présumées ({presumedPauses.length})
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab && onSelectTab('toutes')
              onSelectSubFilter && onSelectSubFilter('all')
            }}
            style={{
              padding: '6px 13px',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'toutes' ? '1px solid #E2A84B' : '1px solid rgba(196, 147, 74, 0.28)',
              background: activeTab === 'toutes' ? 'rgba(226, 168, 75, 0.18)' : 'rgba(26, 20, 14, 0.85)',
              color: activeTab === 'toutes' ? '#F3C784' : '#D6C7B2',
            }}
          >
            Toutes ({realPauses.length + presumedPauses.length})
          </button>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(26, 20, 14, 0.9)',
              border: '1px solid rgba(196, 147, 74, 0.32)',
              borderRadius: 999,
              padding: '5px 12px',
            }}
          >
            <Search size={13} color="#C89B54" />
            <input
              type="search"
              placeholder="Rechercher…"
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#EAE0D2',
                fontSize: '0.78rem',
                width: 135,
              }}
            />
          </label>
        </div>
      </div>

      {/* Liste des cartes horizontales fidèles à l'image sélectionnée */}
      {filteredList.length === 0 ? (
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(26, 20, 15, 0.96) 0%, rgba(19, 15, 11, 0.98) 100%)',
            border: '1px solid rgba(196, 147, 74, 0.36)',
            borderRadius: 14,
            padding: '38px 20px',
            textAlign: 'center',
            color: '#D6C7B2',
          }}
        >
          <strong style={{ display: 'block', fontSize: '1rem', color: '#EAE0D2', marginBottom: 6 }}>
            {activeTab === 'reelles'
              ? 'Aucune pause réellement effectuée sur cette période'
              : activeTab === 'presumees'
                ? 'Aucune pause présumée sur cette période'
                : 'Aucune pause enregistrée sur cette période'}
          </strong>
          <span style={{ fontSize: '0.84rem', opacity: 0.8 }}>
            {activeTab === 'reelles' && presumedPauses.length > 0
              ? `L’historique ne conserve que les pauses réellement effectuées (non présumées). ${presumedPauses.length} pause(s) présumée(s) sont consultables dans l’onglet « Pauses présumées ».`
              : 'Seules les pauses réellement effectuées figurent dans l’historique des pauses.'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredList.map((p) => {
            const empObj = employesById[p.employe_id] || null
            const initials = (p.employe || 'EC')
              .split(' ')
              .filter(Boolean)
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
            const anomalie = badgeAnomalie(p.anomalie)
            const isPresumed = estPausePresumee(p)
            const isReal = estPauseReelleEffectuee(p)

            return (
              <article
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px, 1.15fr) minmax(220px, 1.15fr) minmax(220px, 1.35fr) auto',
                  alignItems: 'center',
                  gap: 16,
                  padding: '10px 16px',
                  background: 'linear-gradient(180deg, rgba(27, 21, 16, 0.96) 0%, rgba(20, 15, 11, 0.98) 100%)',
                  border: '1px solid rgba(196, 147, 74, 0.36)',
                  borderRadius: 12,
                }}
                className="pauses-collab-row-card"
              >
                {/* Colonne 1 : Portrait carré arrondi + Nom + Badge MAT */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1.5px solid rgba(196, 147, 74, 0.45)',
                      background: '#2A1E14',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.96rem',
                      color: '#F3C784',
                    }}
                  >
                    {empObj?.photo_url ? (
                      <PhotoSignee
                        url={empObj.photo_url}
                        alt={p.employe}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        fallback={<span>{initials}</span>}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        color: '#F5EFE6',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.employe || 'Collaborateur'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {p.matricule && (
                        <span
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 5,
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(196, 147, 74, 0.32)',
                            color: '#D6C7B2',
                          }}
                        >
                          {p.matricule}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colonne 2 : Plage horaire 12:15 → 13:00 (45m) OU Chronomètre En cours : 00:28:14 */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {p.ouverte ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <PausesKpiIconSvg kind="timer" size={32} />
                      <strong
                        style={{
                          fontSize: '1.32rem',
                          fontWeight: 800,
                          color: '#F09A28',
                          letterSpacing: '0.01em',
                        }}
                      >
                        En cours : {formaterTempsPauseEnDirect(p, nowMs)}
                      </strong>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <strong
                        style={{
                          fontSize: '1.42rem',
                          fontWeight: 700,
                          color: '#F5EFE6',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {p.debutHHMM} <span style={{ opacity: 0.65, margin: '0 4px' }}>→</span> {p.finHHMM || '--:--'}
                      </strong>
                      <span style={{ fontSize: '0.88rem', color: '#C8B9A6', fontWeight: 500 }}>
                        ({formatDuree(p.dureeMinutes)})
                      </span>
                    </div>
                  )}
                </div>

                {/* Colonne 3 : Pilules de statut & boutons Valider / Écarter exactement comme dans l'image */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {isReal && !p.estNonPlanifiee && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: 'rgba(26, 68, 46, 0.75)',
                        border: '1px solid #2EA06B',
                        color: '#6EE7B7',
                      }}
                    >
                      <Check size={14} strokeWidth={2.6} />
                      <span>{p.source === 'admin' ? 'Pause réelle (admin)' : 'Pause réelle pointée'}</span>
                    </span>
                  )}

                  {isPresumed && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: 'rgba(92, 42, 28, 0.78)',
                        border: '1px solid #D97348',
                        color: '#FDBA74',
                      }}
                    >
                      <span>⏱</span>
                      <span>
                        {p.statut === 'validee'
                          ? 'Pause présumée validée'
                          : 'Pause présumée — à statuer'}
                      </span>
                    </span>
                  )}

                  {p.estNonPlanifiee && isReal && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 13px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: 'rgba(84, 56, 20, 0.78)',
                        border: '1px solid #D99228',
                        color: '#FCD34D',
                      }}
                    >
                      <span>⚡</span>
                      <span>Hors planning</span>
                    </span>
                  )}

                  {anomalie && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 13px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: 'rgba(92, 28, 28, 0.78)',
                        border: '1px solid #DC4C40',
                        color: '#FCA5A5',
                      }}
                    >
                      <AlertTriangle size={13} />
                      <span>{anomalie.label.replace(/^[^\wÀ-ÿ]+\s*/, '')}</span>
                    </span>
                  )}

                  {p.aStatuer && onStatuer && (
                    <>
                      <button
                        type="button"
                        onClick={() => onStatuer([p.id], 'valider')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 14px',
                          borderRadius: 999,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: 'rgba(30, 88, 56, 0.85)',
                          border: '1px solid #34B377',
                          color: '#A7F3D0',
                        }}
                      >
                        <Check size={14} strokeWidth={2.6} />
                        <span>Valider</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStatuer([p.id], 'ecarter')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 14px',
                          borderRadius: 999,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: 'rgba(104, 34, 34, 0.85)',
                          border: '1px solid #E05A47',
                          color: '#FECACA',
                        }}
                      >
                        <X size={14} strokeWidth={2.6} />
                        <span>Écarter</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Colonne 4 : Boutons pilules Fiche & Pointages */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  {onOpenEmployeeFiche && empObj && (
                    <button
                      type="button"
                      onClick={() => onOpenEmployeeFiche(empObj)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 14px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'rgba(26, 20, 14, 0.92)',
                        border: '1px solid rgba(196, 147, 74, 0.45)',
                        color: '#EAE0D2',
                      }}
                    >
                      <Building2 size={13} color="#C89B54" />
                      <span>Fiche</span>
                    </button>
                  )}

                  {onOpenPointages && (
                    <button
                      type="button"
                      onClick={() => onOpenPointages(p)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 14px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'rgba(26, 20, 14, 0.92)',
                        border: '1px solid rgba(196, 147, 74, 0.45)',
                        color: '#EAE0D2',
                      }}
                    >
                      <Building2 size={13} color="#C89B54" />
                      <span>Pointages</span>
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
