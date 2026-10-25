// ═══════════════════════════════════════════════════════════
// 🗺️ PAGE CARTE TEMPS RÉEL
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import PageCulturalBand from '../components/PageCulturalBand'
import { DogonBlasonSvg } from '../components/DogonSvg'
import './CarteTempsReel.css'
import {
  ArrowLeft, MapPin, Users, Calendar, Filter, X, Activity,
  CheckCircle2, AlertTriangle, XCircle, Camera,
  LogIn, LogOut, Navigation,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { formaterHeureLocale } from '../utils/timezoneUtils'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function CarteTempsReel() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState('all')
  const [entreprises, setEntreprises] = useState([])
  const [pointages, setPointages] = useState([])
  const [zones, setZones] = useState([])
  const [selectedEmployeData, setSelectedEmployeData] = useState(null)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterEmploye, setFilterEmploye] = useState('tous')
  const [employees, setEmployees] = useState([])
  const [enterpriseName, setEnterpriseName] = useState('')

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const clusterGroupRef = useRef(null)
  const circlesRef = useRef([])
  const zoneLabelMarkersRef = useRef([])
  const channelRef = useRef(null)

  const navigate = useNavigate()

  // ═══════════════════════════════════════════════════════════
  // 🔧 INITIALISATION ADMIN
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }

    const parsedAdmin = JSON.parse(adminData)
    setAdmin(parsedAdmin)

    const entName = parsedAdmin.selectedEnterprise?.name || parsedAdmin.enterprise_name || ''
    setEnterpriseName(entName)

    if (parsedAdmin.role === 'super_admin') {
      loadEntreprises(parsedAdmin)
      setLoading(false)
    } else {
      const activeId = parsedAdmin.selectedEnterprise?.id || parsedAdmin.enterprise_id
      setSelectedEntrepriseId(activeId)
      if (!entName && activeId) {
        supabase.from('enterprises').select('name').eq('id', activeId).single()
          .then(({ data }) => { if (data) setEnterpriseName(data.name) })
      }
    }
  }, [navigate])

  useEffect(() => {
    if (admin) loadData()
  }, [admin, selectedDate, selectedEntrepriseId])

  // ═══════════════════════════════════════════════════════════
  // 🗺️ INITIALISER LA CARTE (avec retry)
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 20
    let timerId = null

    const tryInitMap = () => {
      attempts++
      if (mapInstanceRef.current) return

      if (mapRef.current) {
        if (mapRef.current._leaflet_id) {
          mapRef.current._leaflet_id = null
          mapRef.current.innerHTML = ''
        }
        try {
          mapInstanceRef.current = L.map(mapRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
          }).setView([46.603354, 1.888334], 6)

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(mapInstanceRef.current)

          // Initialiser le cluster group
          clusterGroupRef.current = L.markerClusterGroup({
            maxClusterRadius: 60,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: (cluster) => {
              const count = cluster.getChildCount()
              const size = count < 5 ? 40 : count < 10 ? 48 : 56
              return L.divIcon({
                html: `
                  <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    border: 3px solid #10B981;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 15px rgba(16,185,129,0.4);
                    font-family: sans-serif;
                    flex-direction: column;
                  ">
                    <span style="color: #10B981; font-size: ${count < 10 ? 16 : 13}px; font-weight: 800; line-height: 1;">
                      ${count}
                    </span>
                    <span style="color: #888; font-size: 9px; font-weight: 600;">
                      emp.
                    </span>
                  </div>
                `,
                className: '',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              })
            },
          })

          mapInstanceRef.current.addLayer(clusterGroupRef.current)

          console.log('✅ Carte + cluster initialisés à la tentative', attempts)
          setMapReady(true)
          return
        } catch (err) {
          console.error('❌ Erreur init carte:', err)
          mapInstanceRef.current = null
          if (mapRef.current) {
            mapRef.current._leaflet_id = null
            mapRef.current.innerHTML = ''
          }
        }
      }

      if (attempts < maxAttempts) {
        timerId = setTimeout(tryInitMap, 200)
      }
    }

    timerId = setTimeout(tryInitMap, 300)
    return () => { if (timerId) clearTimeout(timerId) }
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current && mapReady) updateMap()
  }, [pointages, zones, filterStatut, filterEmploye, mapReady])

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // 📡 CHARGER ENTREPRISES
  // ═══════════════════════════════════════════════════════════

  const loadEntreprises = async (adminData) => {
    const { data } = await supabase
      .from('enterprises').select('*').eq('is_active', true).order('name')
    setEntreprises(data || [])
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 CHARGER DONNÉES
  // ═══════════════════════════════════════════════════════════

  const loadData = async () => {
    setLoading(true)
    try {
      let targetId = selectedEntrepriseId
      if (admin.role !== 'super_admin') {
        targetId = admin.selectedEnterprise?.id || admin.enterprise_id
      }

      // Zones
      let zonesQuery = supabase.from('geofences').select('*').eq('is_active', true)
      if (targetId && targetId !== 'all') {
        zonesQuery = zonesQuery.eq('enterprise_id', targetId)
      }
      const { data: zonesData } = await zonesQuery
      setZones(zonesData || [])

      // Employés
      let empQuery = supabase
        .from('employees').select('id, first_name, last_name, matricule').eq('is_active', true)
      if (targetId && targetId !== 'all') {
        empQuery = empQuery.eq('enterprise_id', targetId)
      }
      const { data: empData } = await empQuery
      setEmployees(empData || [])

      // Pointages avec GPS
      const startOfDay = new Date(`${selectedDate}T00:00:00`).toISOString()
      const endOfDay = new Date(`${selectedDate}T23:59:59`).toISOString()

      let ptQuery = supabase
        .from('attendances')
        .select(`
          *,
          employees (id, first_name, last_name, matricule, photo_url),
          geofences (id, name),
          pointages_photos (id, photo_url)
        `)
        .gte('check_time', startOfDay)
        .lte('check_time', endOfDay)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .order('check_time', { ascending: true })

      if (targetId && targetId !== 'all') {
        ptQuery = ptQuery.eq('enterprise_id', targetId)
      }

      const { data: ptData, error } = await ptQuery
      if (error) throw error
      setPointages(ptData || [])

      // Realtime
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      const filter = targetId && targetId !== 'all'
        ? `enterprise_id=eq.${targetId}` : undefined

      channelRef.current = supabase
        .channel(`carte-realtime-${targetId}-${Date.now()}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'attendances',
          ...(filter ? { filter } : {}),
        }, (payload) => {
          if (payload.new.location_lat && payload.new.location_lng) {
            loadData()
          }
        })
        .subscribe()

    } catch (error) {
      console.error('Erreur chargement carte:', error)
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 👥 REGROUPER PAR EMPLOYÉ (Option D)
  // ═══════════════════════════════════════════════════════════

  const regrouperParEmploye = (pointagesList) => {
    const map = {}

    pointagesList.forEach((p) => {
      const empId = p.employee_id
      if (!map[empId]) {
        map[empId] = {
          employee: p.employees,
          pointages: [],
          location_lat: p.location_lat,
          location_lng: p.location_lng,
          is_within_zone: p.is_within_zone,
          distance_meters: p.distance_meters,
          geofence: p.geofences,
          lastType: p.check_type,
          lastTime: p.check_time,
        }
      }

      map[empId].pointages.push(p)
      // Mettre à jour avec le pointage le plus récent
      map[empId].location_lat = p.location_lat
      map[empId].location_lng = p.location_lng
      map[empId].is_within_zone = p.is_within_zone
      map[empId].distance_meters = p.distance_meters
      map[empId].geofence = p.geofences
      map[empId].lastType = p.check_type
      map[empId].lastTime = p.check_time
    })

    return Object.values(map)
  }

  // ═══════════════════════════════════════════════════════════
  // 🗺️ METTRE À JOUR LA CARTE
  // ═══════════════════════════════════════════════════════════

  const updateMap = () => {
    if (!mapInstanceRef.current || !clusterGroupRef.current) return

    // Nettoyer le cluster
    clusterGroupRef.current.clearLayers()

    // Nettoyer les cercles et labels de zones
    circlesRef.current.forEach((c) => c.remove())
    zoneLabelMarkersRef.current.forEach((m) => m.remove())
    circlesRef.current = []
    zoneLabelMarkersRef.current = []

    // ── Zones géofencées ──
    zones.forEach((zone) => {
      try {
        const circle = L.circle([zone.latitude, zone.longitude], {
          color: zone.is_blocking ? '#EF4444' : '#10B981',
          fillColor: zone.is_blocking ? '#EF4444' : '#10B981',
          fillOpacity: 0.12,
          radius: zone.radius_meters,
          weight: 2,
          dashArray: zone.is_blocking ? '6, 4' : null,
        }).addTo(mapInstanceRef.current)

        const zoneIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              background: white;
              color: #111;
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
              font-family: sans-serif;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              border: 2px solid ${zone.is_blocking ? '#EF4444' : '#10B981'};
            ">
              📍 ${zone.name}
            </div>
          `,
          iconAnchor: [0, 0],
        })

        const zoneMarker = L.marker([zone.latitude, zone.longitude], {
          icon: zoneIcon,
          zIndexOffset: -100,
        }).addTo(mapInstanceRef.current)

        zoneMarker.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="font-size: 14px;">📍 ${zone.name}</strong><br/>
            <span style="color: #666; font-size: 12px;">
              Rayon: ${zone.radius_meters}m<br/>
              ${zone.is_blocking ? '🔒 Bloquant' : '✅ Non-bloquant'}
            </span>
          </div>
        `)

        circlesRef.current.push(circle)
        zoneLabelMarkersRef.current.push(zoneMarker)
      } catch (e) {
        console.warn('Erreur dessin zone:', e)
      }
    })

    // ── Filtrer les pointages ──
    const filtered = pointages.filter((p) => {
      if (filterStatut === 'dans_zone' && p.is_within_zone !== true) return false
      if (filterStatut === 'hors_zone' && p.is_within_zone !== false) return false
      if (filterStatut === 'non_verifie' && p.is_within_zone !== null) return false
      if (filterEmploye !== 'tous' && p.employee_id !== filterEmploye) return false
      return true
    })

    // ── Option D : 1 marqueur par employé ──
    const employes = regrouperParEmploye(filtered)

    employes.forEach((data) => {
      try {
        const {
          employee: emp,
          location_lat,
          location_lng,
          is_within_zone,
          lastType,
          pointages: empPointages,
          distance_meters,
          geofence,
        } = data

        if (!location_lat || !location_lng) return

        // Couleurs selon statut
        let ringColor = '#6B7280'
        let bgColor = '#374151'
        if (is_within_zone === true) { ringColor = '#10B981'; bgColor = '#065F46' }
        if (is_within_zone === false) { ringColor = '#EF4444'; bgColor = '#7F1D1D' }

        const estPresent = lastType === 'in'
        const statusColor = estPresent ? '#10B981' : '#F59E0B'
        const statusLabel = estPresent ? 'Présent' : 'Sorti'

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="position: relative; width: 52px; height: 66px;">

              ${estPresent ? `
                <div style="
                  position: absolute;
                  top: 50%; left: 50%;
                  transform: translate(-50%, -62%);
                  width: 54px; height: 54px;
                  border-radius: 50%;
                  background: ${ringColor};
                  opacity: 0.2;
                  animation: blink 1.8s ease-in-out infinite;
                "></div>
              ` : ''}

              <div style="
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -62%);
                width: 40px; height: 40px;
                background: ${bgColor};
                border: 3px solid ${ringColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 14px rgba(0,0,0,0.4);
                font-size: 18px;
              ">
                👤
              </div>

              <div style="
                position: absolute;
                bottom: 0; left: 50%;
                transform: translateX(-50%);
                background: ${statusColor};
                color: white;
                font-size: 9px;
                font-weight: 800;
                font-family: sans-serif;
                padding: 2px 7px;
                border-radius: 6px;
                border: 1.5px solid white;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                ${statusLabel}
              </div>

            </div>
          `,
          iconSize: [52, 66],
          iconAnchor: [26, 54],
          popupAnchor: [0, -54],
        })

        const marker = L.marker([location_lat, location_lng], { icon })

        marker.on('click', () => setSelectedEmployeData(data))

        // Popup avec tous les pointages du jour
        const avatarHtml = emp?.photo_url
          ? `<img src="${emp.photo_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${ringColor};"/>`
          : `<div style="width:44px;height:44px;border-radius:50%;background:${bgColor};color:white;display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid ${ringColor};">👤</div>`

        const pointagesHtml = empPointages.map(p => `
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #f0f0f0;">
            <span style="
              background:${p.check_type === 'in' ? '#10B981' : '#F59E0B'};
              color:white;font-size:9px;font-weight:800;
              padding:2px 6px;border-radius:4px;white-space:nowrap;
            ">${p.check_type === 'in' ? 'IN' : 'OUT'}</span>
            <span style="font-size:12px;font-weight:600;color:#333;flex:1;">
              ${formaterHeureLocale(p.check_time)}
            </span>
            <span style="font-size:11px;color:${p.is_within_zone === true ? '#10B981' : p.is_within_zone === false ? '#EF4444' : '#999'};">
              ${p.is_within_zone === true ? '✅' : p.is_within_zone === false ? '⚠️' : '—'}
            </span>
          </div>
        `).join('')

        const statutText =
          is_within_zone === true ? '✅ Dans la zone'
          : is_within_zone === false ? '⚠️ Hors zone'
          : '— Non vérifié'

        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:220px;max-width:260px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              ${avatarHtml}
              <div>
                <strong style="font-size:14px;display:block;">
                  ${emp?.first_name || ''} ${emp?.last_name || ''}
                </strong>
                <span style="color:#666;font-size:11px;">${emp?.matricule || ''}</span><br/>
                <span style="
                  background:${statusColor};color:white;
                  font-size:10px;font-weight:700;
                  padding:2px 8px;border-radius:6px;
                ">${statusLabel}</span>
              </div>
            </div>

            <div style="border-top:1px solid #eee;padding-top:8px;margin-bottom:8px;">
              <p style="font-size:11px;font-weight:700;color:#888;margin:0 0 6px 0;
                text-transform:uppercase;letter-spacing:0.5px;">
                Pointages du jour
              </p>
              ${pointagesHtml}
            </div>

            <div style="font-size:12px;color:#555;line-height:1.8;">
              ${statutText}
              ${distance_meters
                ? `<br/>📏 ${distance_meters < 1000
                    ? distance_meters + 'm'
                    : (distance_meters / 1000).toFixed(1) + 'km'}`
                : ''}
              ${geofence?.name ? `<br/>🏢 ${geofence.name}` : ''}
            </div>
          </div>
        `)

        // Ajouter au cluster (Option B)
        clusterGroupRef.current.addLayer(marker)
      } catch (e) {
        console.warn('Erreur dessin marqueur:', e)
      }
    })

    // Ajuster la vue
    const allElements = [
      ...circlesRef.current,
      ...zoneLabelMarkersRef.current,
    ]

    try {
      const clusterBounds = clusterGroupRef.current.getBounds()
      if (clusterBounds.isValid()) {
        mapInstanceRef.current.fitBounds(clusterBounds.pad(0.15))
      } else if (allElements.length > 0) {
        const group = L.featureGroup(allElements)
        const bounds = group.getBounds()
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds.pad(0.15))
        }
      }
    } catch (e) {
      console.warn('fitBounds ignoré:', e)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 📍 MA POSITION
  // ═══════════════════════════════════════════════════════════

  const centrerSurMaPosition = () => {
    if (!navigator.geolocation) {
      alert("Géolocalisation non supportée")
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mapInstanceRef.current) return
        mapInstanceRef.current.setView([coords.latitude, coords.longitude], 15)

        const myIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 18px; height: 18px;
              background: #6366F1;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 6px rgba(99,102,241,0.3);
            "></div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })

        const m = L.marker([coords.latitude, coords.longitude], { icon: myIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup('📍 Votre position')
          .openPopup()

        setTimeout(() => m.remove(), 6000)
      },
      () => alert("Impossible d'obtenir votre position.")
    )
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 STATS
  // ═══════════════════════════════════════════════════════════

  const employesGroupes = regrouperParEmploye(pointages)

  const stats = {
    total: employesGroupes.length,
    presents: employesGroupes.filter((e) => e.lastType === 'in').length,
    sortis: employesGroupes.filter((e) => e.lastType === 'out').length,
    horsZone: employesGroupes.filter((e) => e.is_within_zone === false).length,
    nonVerifie: employesGroupes.filter((e) => e.is_within_zone === null).length,
  }

  const filteredPointages = pointages.filter((p) => {
    if (filterStatut === 'dans_zone' && p.is_within_zone !== true) return false
    if (filterStatut === 'hors_zone' && p.is_within_zone !== false) return false
    if (filterStatut === 'non_verifie' && p.is_within_zone !== null) return false
    if (filterEmploye !== 'tous' && p.employee_id !== filterEmploye) return false
    return true
  })

  const filteredEmployes = regrouperParEmploye(filteredPointages)

  // ═══════════════════════════════════════════════════════════
  // 🖥️ RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes blink {
          0%, 100% { opacity: 0.15; transform: translate(-50%, -62%) scale(1); }
          50% { opacity: 0.4; transform: translate(-50%, -62%) scale(1.35); }
        }
        .custom-marker { background: transparent !important; border: none !important; }
        .leaflet-container { background: #e8e0d8; }
        .leaflet-popup-content-wrapper {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
          border: none;
        }
        .leaflet-popup-tip { background: #fff; }
        .leaflet-popup-content { margin: 14px 16px; }

        /* Style du cluster */
        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background: transparent !important;
        }
        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          background: transparent !important;
        }
      `}</style>

      <div className="ct-page" style={styles.container}>
        <PageCulturalBand pathname="/carte-temps-reel" />
        <div className="ct-bordure" aria-hidden="true" />

        <header className="ct-entete">
          <button
            type="button"
            className="ct-retour"
            onClick={() => navigate('/dashboard')}
            aria-label="Revenir au tableau de bord"
            title="Tableau de bord"
          >
            <ArrowLeft size={16} />
          </button>
          <DogonBlasonSvg size={48} />
          <div className="ct-titre-bloc">
            <span className="ct-eyebrow">La porte du plateau</span>
            <h1 className="ct-titre">
              Carte en direct<span>.</span>
            </h1>
            <p className="ct-sous-titre">
              Chaque point est une personne qui a pointé, quelque part sur le site.
            </p>
          </div>
          <div className="ct-entete-droite">
            <span className="ct-direct">
              <i aria-hidden="true" />
              En direct
            </span>
          </div>
        </header>

        <main style={styles.main}>

          {/* BANDEAU ENTREPRISE */}
          {enterpriseName && (
            <div style={styles.enterpriseBanner}>
              <MapPin size={16} color="#10B981" />
              <span style={styles.enterpriseNameText}>{enterpriseName}</span>
              <span style={styles.enterpriseSub}>
                — {stats.total} employé{stats.total > 1 ? 's' : ''} avec pointage GPS
                {loading && ' (actualisation...)'}
              </span>
            </div>
          )}

          {/* TOOLBAR */}
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>

              <div style={styles.filterGroup}>
                <Calendar size={16} color="#10B981" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={styles.dateInput}
                />
              </div>

              {admin?.role === 'super_admin' && (
                <div style={styles.filterGroup}>
                  <Users size={16} color="#10B981" />
                  <select
                    value={selectedEntrepriseId}
                    onChange={(e) => setSelectedEntrepriseId(e.target.value)}
                    style={styles.select}
                  >
                    <option value="all">Toutes les entreprises</option>
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={styles.filterGroup}>
                <Filter size={16} color="#10B981" />
                <select
                  value={filterStatut}
                  onChange={(e) => setFilterStatut(e.target.value)}
                  style={styles.select}
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="dans_zone">✅ Dans la zone</option>
                  <option value="hors_zone">⚠️ Hors zone</option>
                  <option value="non_verifie">— Non vérifié</option>
                </select>
              </div>

              <div style={styles.filterGroup}>
                <Users size={16} color="#10B981" />
                <select
                  value={filterEmploye}
                  onChange={(e) => setFilterEmploye(e.target.value)}
                  style={styles.select}
                >
                  <option value="tous">Tous les employés</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.matricule})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.toolbarRight}>
              <div style={styles.liveBadge}>
                <Activity size={14} />
                <span>Temps réel</span>
              </div>
              <button onClick={centrerSurMaPosition} style={styles.geoBtn}>
                <Navigation size={16} />
                <span>Ma position</span>
              </button>
            </div>
          </div>

          {/* STATS */}
          <div style={styles.statsGrid}>
            {[
              { icon: Users, color: '#10B981', bg: 'rgba(16,185,129,0.15)', value: stats.total, label: 'Employés GPS' },
              { icon: CheckCircle2, color: '#10B981', bg: 'rgba(16,185,129,0.15)', value: stats.presents, label: 'Présents' },
              { icon: LogOut, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', value: stats.sortis, label: 'Sortis' },
              { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)', value: stats.horsZone, label: 'Hors zone' },
              { icon: XCircle, color: '#6B7280', bg: 'rgba(107,114,128,0.15)', value: stats.nonVerifie, label: 'Non vérifié' },
            ].map((s, i) => (
              <div key={i} style={styles.statCard}>
                <div style={{ ...styles.statIcon, background: s.bg }}>
                  <s.icon size={20} color={s.color} />
                </div>
                <div>
                  <span style={styles.statNumber}>{s.value}</span>
                  <span style={styles.statLabel}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CARTE */}
          <div style={styles.mapContainer}>
            {loading && (
              <div style={styles.loadingOverlay}>
                <MapPin size={32} color="#10B981" />
                <p style={{ color: '#888', fontSize: '14px', marginTop: '12px' }}>
                  Actualisation...
                </p>
              </div>
            )}

            <div ref={mapRef} style={styles.map} />

            {!loading && pointages.length === 0 && (
              <div style={styles.mapOverlayMessage}>
                <MapPin size={28} color="#10B981" />
                <p style={styles.mapOverlayText}>Aucun pointage GPS pour cette date</p>
                <p style={styles.mapOverlaySubtext}>
                  Les pointages apparaîtront ici en temps réel.
                </p>
              </div>
            )}

            {/* LÉGENDE */}
            <div style={styles.legend}>
              <h4 style={styles.legendTitle}>Légende</h4>

              <p style={styles.legendSection}>Statut employé</p>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#10B981' }} />
                <span>Présent</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#F59E0B' }} />
                <span>Sorti</span>
              </div>

              <div style={styles.legendSeparator} />

              <p style={styles.legendSection}>Zone GPS</p>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#10B981', opacity: 0.6 }} />
                <span>Non-bloquante</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#EF4444', opacity: 0.6 }} />
                <span>Bloquante</span>
              </div>

              <div style={styles.legendSeparator} />

              <p style={styles.legendSection}>Cluster</p>
              <div style={styles.legendItem}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: '#1a1a2e', border: '2px solid #10B981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', color: '#10B981', fontWeight: '800', flexShrink: 0,
                }}>N</div>
                <span>Groupe d'employés</span>
              </div>

              <div style={styles.legendSeparator} />

              <div style={styles.legendItem}>
                <div style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: '#6366F1', border: '2px solid white', flexShrink: 0,
                }} />
                <span>Ma position</span>
              </div>
            </div>
          </div>

          {/* LISTE EMPLOYÉS */}
          {filteredEmployes.length > 0 && (
            <div style={styles.list}>
              <h3 style={styles.listTitle}>
                Employés ({filteredEmployes.length})
              </h3>
              {filteredEmployes.map((data, idx) => (
                <div
                  key={data.employee?.id || idx}
                  style={styles.listItem}
                  onClick={() => setSelectedEmployeData(data)}
                >
                  <div style={styles.listItemLeft}>
                    <div style={{
                      ...styles.avatar,
                      border: `2px solid ${
                        data.is_within_zone === true ? '#10B981'
                        : data.is_within_zone === false ? '#EF4444'
                        : '#6B7280'
                      }`,
                    }}>
                      {data.employee?.photo_url ? (
                        <img src={data.employee.photo_url} alt="" style={styles.avatarImg} />
                      ) : (
                        <span style={{ fontSize: '18px' }}>👤</span>
                      )}
                    </div>
                    <div>
                      <div style={styles.employeeName}>
                        {data.employee?.first_name} {data.employee?.last_name}
                      </div>
                      <div style={styles.employeeMeta}>
                        {data.employee?.matricule}
                        {' • '}
                        {data.pointages.length} pointage{data.pointages.length > 1 ? 's' : ''}
                        {data.geofence?.name && ` • ${data.geofence.name}`}
                      </div>
                    </div>
                  </div>

                  <div style={styles.listItemRight}>
                    <span style={{
                      ...styles.typeBadge,
                      background: data.lastType === 'in'
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(245,158,11,0.12)',
                      color: data.lastType === 'in' ? '#10B981' : '#F59E0B',
                    }}>
                      {data.lastType === 'in' ? <LogIn size={12} /> : <LogOut size={12} />}
                      {data.lastType === 'in' ? 'Présent' : 'Sorti'}
                    </span>

                    <span style={{
                      ...styles.zoneBadge,
                      background: data.is_within_zone === true ? 'rgba(16,185,129,0.12)'
                        : data.is_within_zone === false ? 'rgba(239,68,68,0.12)'
                        : 'rgba(107,114,128,0.12)',
                      color: data.is_within_zone === true ? '#10B981'
                        : data.is_within_zone === false ? '#EF4444'
                        : '#6B7280',
                    }}>
                      {data.is_within_zone === true ? '✅'
                        : data.is_within_zone === false ? '⚠️' : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <div className="ct-pied">
          <PageCulturalBand pathname="/carte-temps-reel" placement="bottom" />
        </div>

        {/* MODAL DÉTAIL EMPLOYÉ */}
        {selectedEmployeData && (
          <div style={styles.modalOverlay} onClick={() => setSelectedEmployeData(null)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', overflow: 'hidden',
                    border: `2px solid ${
                      selectedEmployeData.is_within_zone === true ? '#10B981'
                      : selectedEmployeData.is_within_zone === false ? '#EF4444'
                      : '#6B7280'
                    }`,
                  }}>
                    {selectedEmployeData.employee?.photo_url ? (
                      <img
                        src={selectedEmployeData.employee.photo_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : '👤'}
                  </div>
                  <div>
                    <h3 style={styles.modalTitle}>
                      {selectedEmployeData.employee?.first_name}{' '}
                      {selectedEmployeData.employee?.last_name}
                    </h3>
                    <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
                      {selectedEmployeData.employee?.matricule}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmployeData(null)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div style={styles.modalBody}>

                {/* Statut actuel */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '6px 14px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: '700',
                    background: selectedEmployeData.lastType === 'in'
                      ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: selectedEmployeData.lastType === 'in' ? '#10B981' : '#F59E0B',
                    border: `1px solid ${selectedEmployeData.lastType === 'in'
                      ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}>
                    {selectedEmployeData.lastType === 'in' ? '✓ Présent' : '→ Sorti'}
                  </span>

                  <span style={{
                    padding: '6px 14px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: '700',
                    background: selectedEmployeData.is_within_zone === true
                      ? 'rgba(16,185,129,0.12)'
                      : selectedEmployeData.is_within_zone === false
                      ? 'rgba(239,68,68,0.12)'
                      : 'rgba(107,114,128,0.12)',
                    color: selectedEmployeData.is_within_zone === true ? '#10B981'
                      : selectedEmployeData.is_within_zone === false ? '#EF4444'
                      : '#6B7280',
                    border: `1px solid ${
                      selectedEmployeData.is_within_zone === true ? 'rgba(16,185,129,0.3)'
                      : selectedEmployeData.is_within_zone === false ? 'rgba(239,68,68,0.3)'
                      : 'rgba(107,114,128,0.3)'
                    }`,
                  }}>
                    {selectedEmployeData.is_within_zone === true ? '✅ Dans la zone'
                      : selectedEmployeData.is_within_zone === false ? '⚠️ Hors zone'
                      : '— Non vérifié'}
                  </span>
                </div>

                {/* Infos GPS */}
                <div style={styles.modalInfoItem}>
                  <span style={styles.modalLabel}>Position GPS</span>
                  <a
                    href={`https://www.google.com/maps?q=${selectedEmployeData.location_lat},${selectedEmployeData.location_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.gpsLink}
                  >
                    📍 {Number(selectedEmployeData.location_lat).toFixed(5)},{' '}
                    {Number(selectedEmployeData.location_lng).toFixed(5)}
                  </a>
                </div>

                {selectedEmployeData.distance_meters != null && (
                  <div style={styles.modalInfoItem}>
                    <span style={styles.modalLabel}>Distance zone</span>
                    <span style={styles.modalValue}>
                      {selectedEmployeData.distance_meters < 1000
                        ? `${selectedEmployeData.distance_meters}m`
                        : `${(selectedEmployeData.distance_meters / 1000).toFixed(1)}km`}
                    </span>
                  </div>
                )}

                {selectedEmployeData.geofence?.name && (
                  <div style={styles.modalInfoItem}>
                    <span style={styles.modalLabel}>Zone</span>
                    <span style={styles.modalValue}>{selectedEmployeData.geofence.name}</span>
                  </div>
                )}

                {/* Pointages du jour */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{
                    color: '#888', fontSize: '11px', fontWeight: '700',
                    textTransform: 'uppercase', letterSpacing: '1px',
                    margin: '0 0 12px 0',
                  }}>
                    Pointages du jour ({selectedEmployeData.pointages.length})
                  </h4>

                  {selectedEmployeData.pointages.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px', marginBottom: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <span style={{
                        background: p.check_type === 'in' ? '#10B981' : '#F59E0B',
                        color: 'white', fontSize: '10px', fontWeight: '800',
                        padding: '3px 8px', borderRadius: '6px', flexShrink: 0,
                      }}>
                        {p.check_type === 'in' ? 'IN' : 'OUT'}
                      </span>

                      <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '600', flex: 1 }}>
                        {formaterHeureLocale(p.check_time)}
                      </span>

                      <span style={{
                        fontSize: '12px',
                        color: p.is_within_zone === true ? '#10B981'
                          : p.is_within_zone === false ? '#EF4444'
                          : '#6B7280',
                      }}>
                        {p.is_within_zone === true ? '✅ Dans zone'
                          : p.is_within_zone === false ? '⚠️ Hors zone'
                          : '—'}
                      </span>

                      {p.pointages_photos?.length > 0 && (
                        <Camera size={14} color="#EC4899" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#0A0A0F',
  },
  main: {
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: 'clamp(16px, 2.4vw, 28px) clamp(14px, 3vw, 30px) 0',
    boxSizing: 'border-box',
  },
  enterpriseBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '12px',
    padding: '10px 16px',
    marginBottom: '24px',
  },
  enterpriseNameText: {
    color: '#10B981',
    fontSize: '14px',
    fontWeight: '600',
  },
  enterpriseSub: {
    color: '#666',
    fontSize: '13px',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  toolbarLeft: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    flex: 1,
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(20, 20, 35, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 16px',
    borderRadius: '12px',
    flex: '1 1 180px',
  },
  dateInput: {
    border: 'none',
    background: 'transparent',
    color: '#E5E5E5',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  select: {
    border: 'none',
    background: 'transparent',
    color: '#E5E5E5',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    flex: 1,
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#10B981',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  geoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    color: '#6366F1',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'rgba(20, 20, 35, 0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statNumber: {
    display: 'block',
    fontSize: '28px',
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: '1',
    marginBottom: '4px',
  },
  statLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#888',
    fontWeight: '500',
  },
  mapContainer: {
    position: 'relative',
    marginBottom: '32px',
  },
  map: {
    width: '100%',
    height: '600px',
    borderRadius: '20px',
    border: '2px solid rgba(16, 185, 129, 0.2)',
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(10, 10, 15, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '20px',
    zIndex: 999,
  },
  mapOverlayMessage: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15, 15, 25, 0.92)',
    backdropFilter: 'blur(10px)',
    padding: '16px 24px',
    borderRadius: '14px',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    textAlign: 'center',
    zIndex: 1000,
    minWidth: '280px',
  },
  mapOverlayText: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    margin: '8px 0 4px 0',
  },
  mapOverlaySubtext: {
    color: '#666',
    fontSize: '12px',
    margin: 0,
  },
  legend: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(10px)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    minWidth: '190px',
    zIndex: 1000,
  },
  legendTitle: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '700',
    margin: '0 0 10px 0',
  },
  legendSection: {
    color: '#888',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '4px 0 6px 0',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    color: '#E5E5E5',
    fontSize: '12px',
  },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid white',
    flexShrink: 0,
  },
  legendSeparator: {
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '8px 0',
  },
  list: {
    background: 'rgba(20, 20, 35, 0.6)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '20px',
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 16px 0',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px',
    marginBottom: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  listItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(16, 185, 129, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  employeeName: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
  },
  employeeMeta: {
    color: '#666',
    fontSize: '12px',
    marginTop: '2px',
  },
  listItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '700',
  },
  zoneBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    fontSize: '14px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    background: '#141423',
    borderRadius: '20px',
    maxWidth: '520px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: '700',
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#888',
  },
  modalBody: {
    padding: '20px',
  },
  modalInfoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  modalLabel: {
    color: '#888',
    fontSize: '13px',
    fontWeight: '500',
  },
  modalValue: {
    color: '#E5E5E5',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'right',
  },
  gpsLink: {
    color: '#10B981',
    fontSize: '13px',
    textDecoration: 'none',
    fontFamily: 'monospace',
  },
}