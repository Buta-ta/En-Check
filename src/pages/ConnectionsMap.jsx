// src/pages/ConnectionsMap.jsx
// ═══════════════════════════════════════════════════════════
// 🗺️ CARTE DES CONNEXIONS — Fix Vite/Vercel (ESM only)
// + Zoom sur utilisateur même dans un cluster
// + Responsive mobile/tablette
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, Users, Shield, Building2, RefreshCw, Clock,
  MapPin, UserCircle, ArrowLeft, Smartphone, Monitor,
  Tablet, Zap, Layers, Target
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import ConnectionLogService from '../services/connectionLogService'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// 🗺️ COMPOSANT CARTE — imports dynamiques ESM
// ═══════════════════════════════════════════════════════════
function MapComponent({ connections, mapCenter, mapZoom, onMarkerClick, formatTime, focusedConnectionId }) {
  const containerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const clusterGroupRef = useRef(null)
  const markersMapRef = useRef({})
  const [isReady, setIsReady] = useState(false)
  const [LeafletLib, setLeafletLib] = useState(null)

  // ── Étape 1 : charger Leaflet via import() ESM ──
  useEffect(() => {
    let cancelled = false

    const loadLeaflet = async () => {
      try {
        const [L, _css] = await Promise.all([
          import('leaflet'),
          import('leaflet/dist/leaflet.css'),
        ])

        try {
          await import('leaflet.markercluster/dist/MarkerCluster.css')
          await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
          await import('leaflet.markercluster')
        } catch (e) {
          console.warn('MarkerCluster non disponible, fallback layerGroup')
        }

        const LLib = L.default || L
        delete LLib.Icon.Default.prototype._getIconUrl
        LLib.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        if (!cancelled) setLeafletLib(LLib)
      } catch (e) {
        console.error('Erreur chargement Leaflet:', e)
      }
    }

    loadLeaflet()
    return () => { cancelled = true }
  }, [])

  // ── Étape 2 : initialiser la carte ──
  useEffect(() => {
    if (!LeafletLib || !containerRef.current || mapInstanceRef.current) return

    const map = LeafletLib.map(containerRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      zoomControl: true,
    })

    LeafletLib.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; <a href="https://carto.com/">CARTO</a>' }
    ).addTo(map)

    mapInstanceRef.current = map
    setIsReady(true)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        setIsReady(false)
      }
    }
  }, [LeafletLib])

  // ── Étape 3 : mise à jour centre/zoom ──
  useEffect(() => {
    if (!mapInstanceRef.current || !mapCenter) return
    mapInstanceRef.current.setView(mapCenter, mapZoom, { animate: true, duration: 0.5 })
  }, [mapCenter, mapZoom])

  // ── Étape 4 : mise à jour des markers ──
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current || !LeafletLib) return

    const L = LeafletLib
    const map = mapInstanceRef.current

    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current)
      clusterGroupRef.current = null
    }

    markersMapRef.current = {}

    if (connections.length === 0) return

    const createCustomIcon = (color, isAdmin, isFocused = false) => {
      const size = isFocused ? 44 : 36
      const borderWidth = isFocused ? 4 : 3
      const glowStyle = isFocused ? `box-shadow:0 0 20px ${color}, 0 0 40px ${color}40;` : 'box-shadow:0 4px 14px rgba(0,0,0,0.4);'
      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width:${size}px;height:${size}px;
            background:${color};border:${borderWidth}px solid ${isFocused ? '#FFD700' : 'white'};border-radius:50%;
            ${glowStyle}
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:bold;font-size:${isFocused ? '16px' : '14px'};
            transition:all 0.3s ease;
            ${isFocused ? 'animation:pulseMarker 1s ease-in-out infinite;' : ''}
          ">${isAdmin ? '👑' : '👤'}</div>
        `,
        iconSize: [size + 12, size + 12],
        iconAnchor: [(size + 12) / 2, (size + 12) / 2],
        popupAnchor: [0, -(size / 2 + 4)],
      })
    }

    const createClusterIcon = (count, hasAdmin) => {
      const bgColor = hasAdmin ? '#6366F1' : '#F97316'
      const size = count > 10 ? 54 : count > 5 ? 48 : 42
      return L.divIcon({
        className: 'custom-cluster',
        html: `
          <div style="
            width:${size}px;height:${size}px;background:${bgColor};
            border:3px solid rgba(255,255,255,0.9);border-radius:50%;
            box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 0 4px rgba(${hasAdmin ? '99,102,241' : '249,115,22'},0.3);
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:800;font-size:${count > 10 ? '16px' : '14px'};
          ">${count}</div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
    }

    let group
    try {
      group = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        spiderfyDistanceMultiplier: 2.0,
        spiderLegPolylineOptions: {
          weight: 2,
          color: 'rgba(245,158,11,0.4)',
          opacity: 0.6,
        },
        iconCreateFunction: (cluster) => {
          const markers = cluster.getAllChildMarkers()
          const hasAdmin = markers.some(m => m.options.userData?.user_type === 'admin')
          return createClusterIcon(markers.length, hasAdmin)
        },
      })
    } catch (e) {
      console.warn('MarkerCluster indisponible, layerGroup utilisé:', e)
      group = L.layerGroup()
    }

    connections.forEach((conn) => {
      if (!conn.latitude || !conn.longitude) return

      const isAdmin = conn.user_type === 'admin'
      const marker = L.marker([conn.latitude, conn.longitude], {
        icon: createCustomIcon(isAdmin ? '#6366F1' : '#F97316', isAdmin),
        userData: conn,
      })

      markersMapRef.current[conn.id] = marker

      const name = isAdmin
        ? `${conn.admins?.first_name || ''} ${conn.admins?.last_name || ''}`.trim() || 'Admin'
        : `${conn.employees?.first_name || ''} ${conn.employees?.last_name || ''}`.trim() || 'Employé'

      const sub = isAdmin
        ? (conn.admins?.email || '')
        : (conn.employees?.matricule || '')

      const photoHtml = !isAdmin && conn.employees?.photo_url
        ? `<img src="${conn.employees.photo_url}" style="width:36px;height:36px;border-radius:10px;object-fit:cover;" />`
        : `<div style="
            width:36px;height:36px;border-radius:10px;
            background:${isAdmin ? 'rgba(99,102,241,0.2)' : 'rgba(249,115,22,0.2)'};
            display:flex;align-items:center;justify-content:center;font-size:18px;
          ">${isAdmin ? '👑' : '👤'}</div>`

      const deviceLabel = conn.device_type === 'mobile' ? '📱 Mobile'
        : conn.device_type === 'tablet' ? '📱 Tablette'
        : '🖥️ Desktop'

      marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            ${photoHtml}
            <div>
              <div style="font-weight:600;font-size:14px;color:#fff;">${name}</div>
              <div style="color:#888;font-size:11px;">${sub}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
            <div style="color:#aaa;">📍 ${conn.city || 'Inconnu'}, ${conn.country || ''}</div>
            <div style="color:#aaa;">🕐 ${formatTime(conn.connected_at)}</div>
            <div style="color:#aaa;">${deviceLabel}</div>
            ${conn.enterprises?.name ? `<div style="color:#F59E0B;">🏢 ${conn.enterprises.name}</div>` : ''}
            <div style="color:${conn.success !== false ? '#10B981' : '#EF4444'};margin-top:4px;">
              ${conn.success !== false ? '✅ Connexion réussie' : '⚠️ Connexion échouée'}
            </div>
          </div>
        </div>
      `, { maxWidth: 280, className: 'dark-popup' })

      marker.on('click', () => { if (onMarkerClick) onMarkerClick(conn) })
      group.addLayer(marker)
    })

    map.addLayer(group)
    clusterGroupRef.current = group
  }, [isReady, connections, formatTime, onMarkerClick, LeafletLib])

  // ── Étape 5 : Focus sur un marker spécifique (même dans un cluster) ──
  useEffect(() => {
    if (!focusedConnectionId || !isReady || !mapInstanceRef.current || !LeafletLib) return

    const marker = markersMapRef.current[focusedConnectionId]
    if (!marker) return

    const map = mapInstanceRef.current
    const group = clusterGroupRef.current

    // Spiderfy le cluster si le marker est dans un cluster
    if (group && typeof group.zoomToShowLayer === 'function') {
      group.zoomToShowLayer(marker, () => {
        setTimeout(() => {
          marker.openPopup()
          // Faire pulser le marker
          const conn = marker.options.userData
          if (conn) {
            const isAdmin = conn.user_type === 'admin'
            const L = LeafletLib
            const focusIcon = L.divIcon({
              className: 'custom-marker',
              html: `
                <div style="
                  width:44px;height:44px;
                  background:${isAdmin ? '#6366F1' : '#F97316'};
                  border:4px solid #FFD700;border-radius:50%;
                  box-shadow:0 0 20px ${isAdmin ? '#6366F1' : '#F97316'}, 0 0 40px ${isAdmin ? 'rgba(99,102,241,0.4)' : 'rgba(249,115,22,0.4)'};
                  display:flex;align-items:center;justify-content:center;
                  color:white;font-weight:bold;font-size:16px;
                  animation:pulseMarker 1s ease-in-out infinite;
                ">${isAdmin ? '👑' : '👤'}</div>
              `,
              iconSize: [56, 56],
              iconAnchor: [28, 28],
              popupAnchor: [0, -26],
            })
            marker.setIcon(focusIcon)

            // Reset icon après 4 secondes
            setTimeout(() => {
              const normalIcon = L.divIcon({
                className: 'custom-marker',
                html: `
                  <div style="
                    width:36px;height:36px;
                    background:${isAdmin ? '#6366F1' : '#F97316'};border:3px solid white;border-radius:50%;
                    box-shadow:0 4px 14px rgba(0,0,0,0.4);
                    display:flex;align-items:center;justify-content:center;
                    color:white;font-weight:bold;font-size:14px;
                  ">${isAdmin ? '👑' : '👤'}</div>
                `,
                iconSize: [48, 48],
                iconAnchor: [24, 24],
                popupAnchor: [0, -22],
              })
              marker.setIcon(normalIcon)
            }, 4000)
          }
        }, 300)
      })
    } else {
      // Fallback si pas de cluster
      map.setView(marker.getLatLng(), 16, { animate: true, duration: 0.5 })
      setTimeout(() => marker.openPopup(), 500)
    }
  }, [focusedConnectionId, isReady, LeafletLib])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {!isReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,15,25,0.8)', borderRadius: '16px',
        }}>
          <Globe size={40} color="#10B981" style={{ animation: 'spin 2s linear infinite' }} />
          <p style={{ color: '#666', marginTop: '12px', fontSize: '13px' }}>Chargement de la carte...</p>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%', borderRadius: '16px' }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 📄 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function ConnectionsMap() {
  const [admin, setAdmin] = useState(null)
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [selectedEnterprise, setSelectedEnterprise] = useState('all')
  const [timeRange, setTimeRange] = useState(24)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [mapCenter, setMapCenter] = useState([14.6937, -17.4441])
  const [mapZoom, setMapZoom] = useState(3)
  const [highlightedId, setHighlightedId] = useState(null)
  const [focusedConnectionId, setFocusedConnectionId] = useState(null)
  const [showMobileList, setShowMobileList] = useState(false)

  const refreshInterval = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsed = JSON.parse(adminData)
    if (parsed.role !== 'super_admin') {
      navigate('/dashboard')
      toast.error('Accès réservé aux super admins')
      return
    }
    setAdmin(parsed)
    loadEntreprises()
  }, [navigate])

  useEffect(() => {
    if (admin) { loadConnections(); loadStats() }
  }, [admin, selectedEnterprise, timeRange])

  useEffect(() => {
    if (autoRefresh && admin) {
      refreshInterval.current = setInterval(() => {
        loadConnections()
        setLastUpdate(new Date())
      }, 30000)
    }
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current) }
  }, [autoRefresh, admin, selectedEnterprise, timeRange])

  const loadEntreprises = async () => {
    const { data } = await supabase
      .from('enterprises').select('id, name')
      .eq('is_active', true).order('name')
    setEntreprises(data || [])
  }

  const loadConnections = async () => {
    setLoading(true)
    try {
      const data = await ConnectionLogService.getGeoLocatedConnections(
        timeRange,
        selectedEnterprise === 'all' ? null : selectedEnterprise
      )
      setConnections(data)
      if (data.length > 0) {
        const avgLat = data.reduce((s, c) => s + c.latitude, 0) / data.length
        const avgLon = data.reduce((s, c) => s + c.longitude, 0) / data.length
        setMapCenter([avgLat, avgLon])
        setMapZoom(data.length === 1 ? 10 : 4)
      }
    } catch (e) {
      console.error('Erreur connexions:', e)
      toast.error('Erreur chargement des connexions')
    }
    setLoading(false)
  }

  const loadStats = async () => {
    try {
      const data = await ConnectionLogService.getStats(
        selectedEnterprise === 'all' ? null : selectedEnterprise,
        Math.ceil(timeRange / 24)
      )
      setStats(data)
    } catch (e) {
      console.error('Erreur stats:', e)
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    const diffMs = new Date() - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins}min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'mobile': return <Smartphone size={12} />
      case 'tablet': return <Tablet size={12} />
      default: return <Monitor size={12} />
    }
  }

  const positionStats = useMemo(() => {
    const locationMap = {}
    connections.forEach(conn => {
      const key = `${conn.latitude?.toFixed(3)}_${conn.longitude?.toFixed(3)}`
      if (!locationMap[key]) locationMap[key] = { count: 0 }
      locationMap[key].count++
    })
    const overlapping = Object.values(locationMap).filter(l => l.count > 1)
    return {
      uniqueLocations: Object.keys(locationMap).length,
      overlappingCount: overlapping.length,
      maxOverlap: overlapping.reduce((max, l) => Math.max(max, l.count), 0),
    }
  }, [connections])

  const handleMarkerClick = (conn) => {
    setHighlightedId(conn.id)
    setTimeout(() => setHighlightedId(null), 3000)
  }

  // ── Focus sur un utilisateur (zoom + spiderfy cluster) ──
  const handleFocusUser = (conn) => {
    setFocusedConnectionId(null) // Reset d'abord
    setHighlightedId(conn.id)

    // Petit délai pour forcer le re-render
    setTimeout(() => {
      setFocusedConnectionId(conn.id)
    }, 50)

    // Sur mobile, fermer la liste
    if (window.innerWidth < 900) {
      setShowMobileList(false)
    }

    setTimeout(() => {
      setHighlightedId(null)
      // Ne pas reset focusedConnectionId ici, le composant carte le gère
    }, 4000)
  }

  if (!admin) return null

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes highlightCard {
          0%, 100% { background: rgba(245,158,11,0.08); }
          50% { background: rgba(245,158,11,0.2); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        @keyframes pulseMarker {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px currentColor; }
          50% { transform: scale(1.15); box-shadow: 0 0 35px currentColor, 0 0 60px currentColor; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .leaflet-container { background: #1a1a2e !important; border-radius: 16px; }
        .leaflet-popup-content-wrapper {
          background: rgba(20,20,35,0.97) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        }
        .dark-popup .leaflet-popup-content-wrapper {
          background: rgba(20,20,35,0.97) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
        }
        .leaflet-popup-content { margin: 12px 14px !important; color: #fff !important; }
        .leaflet-popup-tip { background: rgba(20,20,35,0.97) !important; }
        .leaflet-control-zoom a {
          background: rgba(20,20,35,0.9) !important;
          color: #F59E0B !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
        }
        .leaflet-control-zoom a:hover { background: rgba(245,158,11,0.2) !important; }
        .custom-marker, .custom-cluster {
          background: transparent !important; border: none !important;
        }
        .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
          background: transparent !important;
        }
        .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
          background: transparent !important;
        }
        .connection-card { transition: all 0.2s ease; cursor: pointer; }
        .connection-card:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(245,158,11,0.3) !important;
        }
        .card-highlighted { animation: highlightCard 1s ease-in-out 3; }
        select option { background: #141423; color: #E5E5E5; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .map-layout-grid {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: auto !important;
          }
          .map-container-cell {
            height: 50vh !important;
            min-height: 350px !important;
          }
          .connections-list-cell {
            max-height: none !important;
          }
          .stats-grid-responsive {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .filters-bar-responsive {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .header-responsive {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
        @media (max-width: 600px) {
          .stats-grid-responsive {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .map-container-cell {
            height: 40vh !important;
            min-height: 280px !important;
          }
          .header-title-text {
            font-size: 18px !important;
          }
        }

        /* ── MOBILE BOTTOM SHEET ── */
        .mobile-list-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1000;
          display: none;
        }
        .mobile-list-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 70vh;
          background: rgba(15,15,25,0.98);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          border-top: 1px solid rgba(255,255,255,0.1);
          z-index: 1001;
          animation: slideUp 0.3s ease;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(20px);
        }
        .mobile-sheet-handle {
          width: 40px;
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          margin: 10px auto;
          flex-shrink: 0;
        }
        @media (max-width: 900px) {
          .desktop-list { display: none !important; }
          .mobile-list-toggle { display: flex !important; }
        }
        @media (min-width: 901px) {
          .desktop-list { display: flex !important; }
          .mobile-list-toggle { display: none !important; }
          .mobile-list-overlay, .mobile-list-sheet { display: none !important; }
        }
      `}</style>

      <div style={S.container}>
        <PageHeader title="CARTE DES CONNEXIONS" />

        <main style={S.main}>

          {/* ── HEADER ── */}
          <div className="header-responsive" style={S.header}>
            <div style={S.headerLeft}>
              <button onClick={() => navigate('/connexions')} style={S.backBtn}>
                <ArrowLeft size={18} />
              </button>
              <div style={S.headerIcon}>
                <Globe size={24} color="#10B981" />
              </div>
              <div>
                <h1 className="header-title-text" style={S.title}>Carte des connexions</h1>
                <p style={S.subtitle}>
                  {connections.length} connexion{connections.length > 1 ? 's' : ''} géolocalisée{connections.length > 1 ? 's' : ''}
                  {positionStats.overlappingCount > 0 && (
                    <span style={{ color: '#F59E0B', marginLeft: '8px' }}>
                      • {positionStats.uniqueLocations} position{positionStats.uniqueLocations > 1 ? 's' : ''} unique{positionStats.uniqueLocations > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div style={S.headerRight}>
              {autoRefresh && (
                <div style={S.liveBadge}>
                  <div style={S.liveDot} />
                  <span>LIVE</span>
                </div>
              )}
              <span style={S.lastUpdateText}>
                Màj: {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => { loadConnections(); setLastUpdate(new Date()) }}
                style={S.refreshBtn}
                title="Rafraîchir"
              >
                <RefreshCw
                  size={16}
                  style={loading ? { animation: 'spin 0.8s linear infinite' } : {}}
                />
              </button>
            </div>
          </div>

          {/* ── STATS ── */}
          {stats && (
            <div className="stats-grid-responsive" style={S.statsGrid}>
              {[
                { icon: <Globe size={20} color="#10B981" />, bg: 'rgba(16,185,129,0.15)', value: stats.uniqueCountries, label: 'Pays' },
                { icon: <MapPin size={20} color="#6366F1" />, bg: 'rgba(99,102,241,0.15)', value: stats.uniqueCities, label: 'Villes' },
                { icon: <Shield size={20} color="#8B5CF6" />, bg: 'rgba(139,92,246,0.15)', value: stats.adminConnections, label: 'Admins' },
                { icon: <Users size={20} color="#F97316" />, bg: 'rgba(249,115,22,0.15)', value: stats.employeeConnections, label: 'Employés' },
                { icon: <Layers size={20} color="#F59E0B" />, bg: 'rgba(245,158,11,0.15)', value: positionStats.uniqueLocations, label: 'Positions' },
              ].map((s, i) => (
                <div key={i} style={S.statCard}>
                  <div style={{ ...S.statIcon, background: s.bg }}>{s.icon}</div>
                  <div>
                    <span style={S.statValue}>{s.value}</span>
                    <span style={S.statLabel}>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FILTRES ── */}
          <div className="filters-bar-responsive" style={S.filtersBar}>
            <div style={S.filterGroup}>
              <Clock size={14} color="#666" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                style={S.filterSelect}
              >
                <option value={1}>Dernière heure</option>
                <option value={6}>6 dernières heures</option>
                <option value={12}>12 dernières heures</option>
                <option value={24}>24 dernières heures</option>
                <option value={48}>48 dernières heures</option>
                <option value={168}>7 derniers jours</option>
              </select>
            </div>

            <div style={S.filterGroup}>
              <Building2 size={14} color="#666" />
              <select
                value={selectedEnterprise}
                onChange={(e) => setSelectedEnterprise(e.target.value)}
                style={S.filterSelect}
              >
                <option value="all">Toutes entreprises</option>
                {entreprises.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>

            <div style={S.filterGroup}>
              <label style={S.toggleLabel}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  style={{ display: 'none' }}
                />
                <Zap size={14} color={autoRefresh ? '#10B981' : '#666'} />
                <span style={{ color: autoRefresh ? '#10B981' : '#888' }}>
                  Auto-refresh (30s)
                </span>
              </label>
            </div>

            {positionStats.maxOverlap > 1 && (
              <div style={{
                ...S.filterGroup,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
              }}>
                <Layers size={14} color="#F59E0B" />
                <span style={{ color: '#F59E0B', fontSize: '12px' }}>
                  Jusqu'à {positionStats.maxOverlap} personnes au même endroit — cliquez pour déplier
                </span>
              </div>
            )}
          </div>

          {/* ── BOUTON MOBILE POUR AFFICHER LA LISTE ── */}
          <button
            className="mobile-list-toggle"
            onClick={() => setShowMobileList(true)}
            style={{
              display: 'none',
              alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '12px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '12px', color: '#F59E0B',
              fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', marginBottom: '12px',
              fontFamily: 'inherit',
            }}
          >
            <Users size={16} />
            Voir les {connections.length} connexions
          </button>

          {/* ── CARTE + LISTE ── */}
          <div className="map-layout-grid" style={S.mapLayout}>

            {/* Carte */}
            <div className="map-container-cell" style={S.mapContainer}>
              <MapComponent
                connections={connections}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                onMarkerClick={handleMarkerClick}
                formatTime={formatTime}
                focusedConnectionId={focusedConnectionId}
              />
            </div>

            {/* Liste Desktop */}
            <div className="desktop-list" style={S.connectionsList}>
              <div style={S.listHeader}>
                <h3 style={S.listTitle}>Connexions récentes</h3>
                <span style={S.listCount}>{connections.length}</span>
              </div>

              <div style={S.listScroll}>
                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    <RefreshCw size={24} color="#555" style={{ animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ marginTop: '12px', fontSize: '13px' }}>Chargement...</p>
                  </div>
                ) : connections.length === 0 ? (
                  <div style={S.emptyList}>
                    <Globe size={32} color="#555" />
                    <p style={{ color: '#555', marginTop: '8px', fontSize: '13px' }}>
                      Aucune connexion géolocalisée
                    </p>
                  </div>
                ) : (
                  connections.slice(0, 50).map((conn, index) => (
                    <div
                      key={conn.id}
                      className={`connection-card ${highlightedId === conn.id ? 'card-highlighted' : ''}`}
                      style={{
                        ...S.connectionCard,
                        animation: `fadeInUp 0.25s ease ${Math.min(index * 0.02, 0.4)}s forwards`,
                        opacity: 0,
                        borderLeftColor: conn.user_type === 'admin' ? '#6366F1' : '#F97316',
                      }}
                      onClick={() => handleFocusUser(conn)}
                    >
                      <div style={S.cardLeft}>
                        <div style={{
                          ...S.cardAvatar,
                          background: conn.user_type === 'admin'
                            ? 'rgba(99,102,241,0.15)'
                            : 'rgba(249,115,22,0.15)',
                        }}>
                          {conn.employees?.photo_url ? (
                            <img
                              src={conn.employees.photo_url}
                              alt=""
                              style={S.cardAvatarImg}
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                          ) : conn.user_type === 'admin' ? (
                            <Shield size={14} color="#6366F1" />
                          ) : (
                            <UserCircle size={14} color="#F97316" />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={S.cardName}>
                            {conn.user_type === 'admin'
                              ? `${conn.admins?.first_name || ''} ${conn.admins?.last_name || ''}`.trim() || 'Admin'
                              : `${conn.employees?.first_name || ''} ${conn.employees?.last_name || ''}`.trim() || 'Employé'
                            }
                          </div>
                          <div style={S.cardLocation}>
                            <MapPin size={10} />
                            {conn.city || 'Inconnu'}, {conn.country_code || conn.country || ''}
                          </div>
                        </div>
                      </div>
                      <div style={S.cardRight}>
                        <span style={S.cardFocusBtn} title="Localiser sur la carte">
                          <Target size={12} color="#F59E0B" />
                        </span>
                        <span style={{ ...S.cardStatus, color: conn.success !== false ? '#10B981' : '#EF4444' }}>
                          {conn.success !== false ? '✓' : '✗'}
                        </span>
                        <span style={S.cardTime}>{formatTime(conn.connected_at)}</span>
                        <span style={S.cardDevice}>{getDeviceIcon(conn.device_type)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── MOBILE BOTTOM SHEET ── */}
          {showMobileList && (
            <>
              <div
                className="mobile-list-overlay"
                style={{ display: 'block' }}
                onClick={() => setShowMobileList(false)}
              />
              <div className="mobile-list-sheet" style={{ display: 'flex' }}>
                <div className="mobile-sheet-handle" />
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '8px 16px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <h3 style={{ color: '#FFF', fontSize: '16px', fontWeight: '700', margin: 0 }}>
                    Connexions récentes
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: 'rgba(16,185,129,0.15)', color: '#10B981',
                      padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700',
                    }}>
                      {connections.length}
                    </span>
                    <button
                      onClick={() => setShowMobileList(false)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', padding: '6px 10px',
                        color: '#888', cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      Fermer
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                  {connections.slice(0, 50).map((conn, index) => (
                    <div
                      key={conn.id}
                      className={`connection-card ${highlightedId === conn.id ? 'card-highlighted' : ''}`}
                      style={{
                        ...S.connectionCard,
                        opacity: 1,
                        borderLeftColor: conn.user_type === 'admin' ? '#6366F1' : '#F97316',
                      }}
                      onClick={() => handleFocusUser(conn)}
                    >
                      <div style={S.cardLeft}>
                        <div style={{
                          ...S.cardAvatar,
                          background: conn.user_type === 'admin'
                            ? 'rgba(99,102,241,0.15)'
                            : 'rgba(249,115,22,0.15)',
                        }}>
                          {conn.employees?.photo_url ? (
                            <img src={conn.employees.photo_url} alt="" style={S.cardAvatarImg}
                              onError={(e) => { e.target.style.display = 'none' }} />
                          ) : conn.user_type === 'admin' ? (
                            <Shield size={14} color="#6366F1" />
                          ) : (
                            <UserCircle size={14} color="#F97316" />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={S.cardName}>
                            {conn.user_type === 'admin'
                              ? `${conn.admins?.first_name || ''} ${conn.admins?.last_name || ''}`.trim() || 'Admin'
                              : `${conn.employees?.first_name || ''} ${conn.employees?.last_name || ''}`.trim() || 'Employé'
                            }
                          </div>
                          <div style={S.cardLocation}>
                            <MapPin size={10} />
                            {conn.city || 'Inconnu'}, {conn.country_code || conn.country || ''}
                          </div>
                        </div>
                      </div>
                      <div style={S.cardRight}>
                        <span style={S.cardFocusBtn}>
                          <Target size={12} color="#F59E0B" />
                        </span>
                        <span style={{ ...S.cardStatus, color: conn.success !== false ? '#10B981' : '#EF4444' }}>
                          {conn.success !== false ? '✓' : '✗'}
                        </span>
                        <span style={S.cardTime}>{formatTime(conn.connected_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── LÉGENDE ── */}
          <div style={S.legend}>
            {[
              { dot: { ...S.legendDot, background: '#6366F1' }, emoji: '👑', label: 'Admin' },
              { dot: { ...S.legendDot, background: '#F97316' }, emoji: '👤', label: 'Employé' },
            ].map((item, i) => (
              <div key={i} style={S.legendItem}>
                <div style={item.dot}>{item.emoji}</div>
                <span>{item.label}</span>
              </div>
            ))}
            <div style={S.legendSep} />
            <div style={S.legendItem}>
              <div style={{ ...S.legendDot, background: '#6366F1', fontSize: '10px', fontWeight: '800', color: '#fff' }}>3</div>
              <span>Cluster — cliquez pour déplier</span>
            </div>
            <div style={S.legendItem}>
              <Target size={14} color="#F59E0B" />
              <span>Cliquez un nom → zoom sur la carte</span>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const S = {
  container: { minHeight: '100vh', background: '#0A0A0F' },
  main: { padding: '20px', maxWidth: '1600px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: '22px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#666', fontSize: '13px', margin: '2px 0 0 0' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 12px', borderRadius: '20px', color: '#10B981', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' },
  liveDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' },
  lastUpdateText: { color: '#555', fontSize: '12px' },
  refreshBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' },
  statCard: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px' },
  statIcon: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { display: 'block', color: '#FFF', fontSize: '22px', fontWeight: '700' },
  statLabel: { display: 'block', color: '#666', fontSize: '11px', fontWeight: '500' },
  filtersBar: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', padding: '14px', background: 'rgba(20,20,35,0.6)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '10px' },
  filterSelect: { background: 'transparent', border: 'none', color: '#E5E5E5', fontSize: '13px', outline: 'none', cursor: 'pointer', minWidth: '140px', fontFamily: 'inherit' },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' },
  mapLayout: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', height: 'calc(100vh - 380px)', minHeight: '500px' },
  mapContainer: { background: 'rgba(20,20,35,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' },
  connectionsList: { background: 'rgba(20,20,35,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  listTitle: { color: '#FFF', fontSize: '14px', fontWeight: '600', margin: 0 },
  listCount: { background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' },
  listScroll: { flex: 1, overflow: 'auto', padding: '8px' },
  emptyList: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' },
  connectionCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderLeft: '3px solid', transition: 'all 0.2s ease' },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 },
  cardAvatar: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  cardAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardName: { color: '#FFF', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardLocation: { display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '11px', marginTop: '2px' },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 },
  cardFocusBtn: { width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardStatus: { fontSize: '12px', fontWeight: '700' },
  cardTime: { color: '#888', fontSize: '11px' },
  cardDevice: { color: '#555' },
  legend: { display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', padding: '12px', background: 'rgba(20,20,35,0.4)', borderRadius: '12px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '13px' },
  legendDot: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' },
  legendSep: { width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' },
}