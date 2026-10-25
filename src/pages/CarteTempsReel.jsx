// ═══════════════════════════════════════════════════════════
// 🗿 LA PORTE DU PLATEAU — CARTE TEMPS RÉEL
//
// Une porte de grenier dogon ouvre sur le site : les registres
// du haut comptent la journée, l'ouverture du milieu montre le
// plateau, la colonne de droite nomme les employés.
//
// Toute la mécanique est inchangée : mêmes requêtes, même canal
// temps réel, mêmes filtres, mêmes marqueurs, même fiche.
// Seul le dessin est neuf.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import { DogonBlasonSvg } from '../components/DogonSvg'
import { useTheme } from '../contexts/ThemeContext'
import './CarteTempsReel.css'
import {
  ArrowLeft, MapPin, Users, Calendar, X, Activity,
  CheckCircle2, AlertTriangle, XCircle, Camera,
  LogIn, LogOut, Navigation, Search, RefreshCw, Building2,
  Sun, Moon,
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

// Les couleurs que Leaflet attend en JavaScript, pas en CSS.
const COULEUR_ZONE = { bloquante: '#EF4444', libre: '#10B981' }

// Les quatre clés de statut — mêmes valeurs que la base.
const CLES_STATUT = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'dans_zone', libelle: 'Dans la zone' },
  { cle: 'hors_zone', libelle: 'Hors zone' },
  { cle: 'non_verifie', libelle: 'Non vérifié' },
]

const etatDe = (dansZone) => (dansZone === true ? 'ok' : dansZone === false ? 'hors' : 'inconnu')

const initialesDe = (employe) => {
  const a = (employe?.first_name || '').trim().charAt(0)
  const b = (employe?.last_name || '').trim().charAt(0)
  return `${a}${b}`.toUpperCase() || '?'
}

const distanceLisible = (metres) =>
  metres == null
    ? ''
    : metres < 1000
      ? `${metres} m`
      : `${(metres / 1000).toFixed(1)} km`

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
  const [avis, setAvis] = useState(null)
  const [recherche, setRecherche] = useState('')

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const clusterGroupRef = useRef(null)
  const circlesRef = useRef([])
  const zoneLabelMarkersRef = useRef([])
  const channelRef = useRef(null)

  const navigate = useNavigate()
  // La même bascule que le reste de l'application : le choix suit l'admin
  // d'une page à l'autre et se retient d'une visite à l'autre.
  const { darkMode, toggleTheme } = useTheme()

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
              const taille = count < 5 ? 'petit' : count < 10 ? 'moyen' : 'grand'
              const size = count < 5 ? 42 : count < 10 ? 50 : 58
              return L.divIcon({
                html: `
                  <div class="ct-groupe ct-groupe--${taille}">
                    <b>${count}</b>
                    <span>emp.</span>
                  </div>
                `,
                className: 'custom-marker',
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

  // La fiche se ferme à la touche Échap, comme une vraie fenêtre.
  useEffect(() => {
    if (!selectedEmployeData) return undefined
    const surTouche = (e) => {
      if (e.key === 'Escape') setSelectedEmployeData(null)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [selectedEmployeData])

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
    setAvis(null)
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
      setAvis("La carte n'a pas pu se mettre à jour. Vérifiez la connexion, puis réessayez.")
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
        const teinte = zone.is_blocking ? COULEUR_ZONE.bloquante : COULEUR_ZONE.libre

        const circle = L.circle([zone.latitude, zone.longitude], {
          color: teinte,
          fillColor: teinte,
          fillOpacity: 0.12,
          radius: zone.radius_meters,
          weight: 2,
          dashArray: zone.is_blocking ? '6, 4' : null,
        }).addTo(mapInstanceRef.current)

        const zoneIcon = L.divIcon({
          className: 'custom-marker',
          html: `<span class="ct-zone" data-bloque="${zone.is_blocking ? 'oui' : 'non'}">${zone.name}</span>`,
          iconAnchor: [0, 0],
        })

        const zoneMarker = L.marker([zone.latitude, zone.longitude], {
          icon: zoneIcon,
          zIndexOffset: -100,
        }).addTo(mapInstanceRef.current)

        zoneMarker.bindPopup(`
          <div class="ct-popup ct-popup--zone">
            <strong class="ct-popup-nom">${zone.name}</strong>
            <p class="ct-popup-ligne">Rayon : ${zone.radius_meters} m</p>
            <p class="ct-popup-ligne" data-bloque="${zone.is_blocking ? 'oui' : 'non'}">
              ${zone.is_blocking ? 'Zone bloquante' : 'Zone non bloquante'}
            </p>
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

        const etat = etatDe(is_within_zone)
        const estPresent = lastType === 'in'
        const statusLabel = estPresent ? 'Présent' : 'Sorti'

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div class="ct-pin" data-etat="${etat}">
              ${estPresent ? '<span class="ct-pin-halo" aria-hidden="true"></span>' : ''}
              <span class="ct-pin-medaillon">${initialesDe(emp)}</span>
              <span class="ct-pin-plaque" data-etat="${estPresent ? 'present' : 'sorti'}">
                ${statusLabel}
              </span>
            </div>
          `,
          iconSize: [54, 68],
          iconAnchor: [27, 56],
          popupAnchor: [0, -56],
        })

        const marker = L.marker([location_lat, location_lng], { icon })

        marker.on('click', () => setSelectedEmployeData(data))

        // Popup avec tous les pointages du jour
        const avatarHtml = emp?.photo_url
          ? `<img class="ct-popup-portrait" src="${emp.photo_url}" alt="" />`
          : `<span class="ct-popup-portrait">${initialesDe(emp)}</span>`

        const pointagesHtml = empPointages.map(p => `
          <div class="ct-popup-pointage">
            <span class="ct-popup-type" data-type="${p.check_type === 'in' ? 'in' : 'out'}">
              ${p.check_type === 'in' ? 'IN' : 'OUT'}
            </span>
            <span class="ct-popup-heure">${formaterHeureLocale(p.check_time)}</span>
            <span class="ct-popup-etat" data-ton="${etatDe(p.is_within_zone)}">
              ${p.is_within_zone === true ? 'Dans la zone'
                : p.is_within_zone === false ? 'Hors zone' : 'Non vérifié'}
            </span>
          </div>
        `).join('')

        marker.bindPopup(`
          <div class="ct-popup">
            <header class="ct-popup-tete">
              ${avatarHtml}
              <div class="ct-popup-identite">
                <strong class="ct-popup-nom">${emp?.first_name || ''} ${emp?.last_name || ''}</strong>
                <span class="ct-popup-matricule">${emp?.matricule || ''}</span>
                <span class="ct-popup-statut" data-ton="${estPresent ? 'ok' : 'attente'}">
                  ${statusLabel}
                </span>
              </div>
            </header>

            <div class="ct-popup-journee">
              <p class="ct-popup-section">Pointages du jour</p>
              ${pointagesHtml}
            </div>

            <footer class="ct-popup-pied">
              <span class="ct-popup-etat" data-ton="${etat}">
                ${is_within_zone === true ? 'Dans la zone'
                  : is_within_zone === false ? 'Hors zone' : 'Non vérifié'}
              </span>
              ${distance_meters != null
                ? `<span class="ct-popup-ligne">${distanceLisible(distance_meters)} de la zone</span>`
                : ''}
              ${geofence?.name ? `<span class="ct-popup-ligne">${geofence.name}</span>` : ''}
            </footer>
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
      setAvis("Ce navigateur ne sait pas vous situer : la géolocalisation n'y est pas disponible.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mapInstanceRef.current) return
        setAvis(null)
        mapInstanceRef.current.setView([coords.latitude, coords.longitude], 15)

        const myIcon = L.divIcon({
          className: 'custom-marker',
          html: '<span class="ct-moi"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })

        const m = L.marker([coords.latitude, coords.longitude], { icon: myIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup('<div class="ct-popup ct-popup--zone"><strong class="ct-popup-nom">Votre position</strong></div>')
          .openPopup()

        setTimeout(() => m.remove(), 6000)
      },
      () => setAvis("Impossible d'obtenir votre position. Autorisez la localisation dans le navigateur, puis réessayez.")
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

  // Le filtre de recherche ne touche qu'à l'affichage de la colonne.
  const employesAffiches = filteredEmployes.filter((data) => {
    const q = recherche.trim().toLowerCase()
    if (!q) return true
    const nom = `${data.employee?.first_name || ''} ${data.employee?.last_name || ''}`.toLowerCase()
    return nom.includes(q) || (data.employee?.matricule || '').toLowerCase().includes(q)
  })

  const entrepriseAffichee = selectedEntrepriseId === 'all' && admin?.role === 'super_admin'
    ? 'Toutes les entreprises'
    : enterpriseName || 'Entreprise non renseignée'

  const pointagesGps = pointages.length

  // ═══════════════════════════════════════════════════════════
  // 🖥️ RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className={`ct-page${darkMode ? '' : ' ct-clair'}`}>
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
            Chaque point correspond à un pointage géolocalisé sur le site.
          </p>
        </div>
        <div className="ct-entete-droite">
          <span className="ct-direct">
            <i aria-hidden="true" />
            En direct
          </span>
          <button
            type="button"
            className="ct-bascule"
            role="switch"
            aria-checked={darkMode}
            onClick={toggleTheme}
            aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={darkMode ? 'Thème clair' : 'Thème sombre'}
          >
            {darkMode ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="ct-coque">

        {/* ── Le seuil : l'entreprise et les autres écrans ── */}
        <section className="ct-seuil" aria-label="Entreprise et accès rapides">
          <div className="ct-seuil-entreprise">
            <span className="ct-seuil-libelle">Entreprise</span>
            <span className="ct-seuil-nom">{entrepriseAffichee}</span>
            <span className="ct-seuil-fait">
              <MapPin size={11} aria-hidden="true" />
              {stats.total} employé{stats.total > 1 ? 's' : ''} géolocalisé{stats.total > 1 ? 's' : ''}
            </span>
            {loading && <span className="ct-seuil-fait">Mise à jour…</span>}
          </div>

          <div className="ct-raccourcis">
            <span className="ct-seuil-libelle">Aller à</span>
            <RaccourcisPages compact excludePaths={['/carte-temps-reel']} />
          </div>
        </section>

        {avis && (
          <p className="ct-avis" role="status">
            <AlertTriangle size={13} aria-hidden="true" />
            {avis}
          </p>
        )}

        {/* ── Les registres de la journée ── */}
        <section className="ct-registres" aria-label="Les registres de la journée">
          {[
            { icone: Users, ton: 'bois', valeur: stats.total, libelle: 'Employés GPS' },
            { icone: CheckCircle2, ton: 'ok', valeur: stats.presents, libelle: 'Présents' },
            { icone: LogOut, ton: 'attente', valeur: stats.sortis, libelle: 'Sortis' },
            { icone: AlertTriangle, ton: 'alerte', valeur: stats.horsZone, libelle: 'Hors zone' },
            { icone: XCircle, ton: 'neutre', valeur: stats.nonVerifie, libelle: 'Non vérifié' },
          ].map(({ icone: Icone, ton, valeur, libelle }) => (
            <div key={libelle} className="ct-stele" data-ton={ton}>
              <span className="ct-stele-marque">
                <Icone size={18} aria-hidden="true" />
              </span>
              <span className="ct-stele-texte">
                <span className="ct-stele-nombre">{valeur}</span>
                <span className="ct-stele-libelle">{libelle}</span>
              </span>
            </div>
          ))}
        </section>

        {/* ── Les outils : la date, l'entreprise, l'employé, le statut ── */}
        <div className="ct-outils">
          <label className="ct-champ ct-champ-date">
            <span className="ct-etiquette">
              <Calendar size={11} aria-hidden="true" />
              Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Choisir le jour observé"
            />
          </label>

          {admin?.role === 'super_admin' && (
            <label className="ct-champ ct-champ-select">
              <span className="ct-etiquette">
                <Building2 size={11} aria-hidden="true" />
                Entreprise
              </span>
              <select
                value={selectedEntrepriseId}
                onChange={(e) => setSelectedEntrepriseId(e.target.value)}
                aria-label="Choisir l'entreprise"
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map((ent) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="ct-champ ct-champ-select">
            <span className="ct-etiquette">
              <Users size={11} aria-hidden="true" />
              Employé
            </span>
            <select
              value={filterEmploye}
              onChange={(e) => setFilterEmploye(e.target.value)}
              aria-label="Choisir un employé"
            >
              <option value="tous">Tous les employés</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.matricule})
                </option>
              ))}
            </select>
          </label>

          <div className="ct-champ ct-champ-statut">
            <span className="ct-etiquette">Statut</span>
            <div className="ct-cles" role="group" aria-label="Filtrer par statut de pointage">
              {CLES_STATUT.map(({ cle, libelle }) => (
                <button
                  key={cle}
                  type="button"
                  className="ct-cle"
                  aria-pressed={filterStatut === cle}
                  onClick={() => setFilterStatut(cle)}
                >
                  <i aria-hidden="true" />
                  {libelle}
                </button>
              ))}
            </div>
          </div>

          <div className="ct-boutons">
            <button
              type="button"
              className="ct-bouton-creux"
              onClick={loadData}
              title="Recharger les pointages du jour"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Actualiser
            </button>
            <button type="button" className="ct-bouton" onClick={centrerSurMaPosition}>
              <Navigation size={14} aria-hidden="true" />
              Ma position
            </button>
          </div>
        </div>

        {/* ── L'atelier : le plateau et les employés ── */}
        <div className="ct-atelier">

          <div className="ct-colonne">
            <div className="ct-cadre">
              <div className="ct-cadre-tete">
                <h2 className="ct-cadre-titre">
                  <Activity size={12} aria-hidden="true" />
                  Localisation des pointages
                </h2>
                <span className="ct-cadre-note">
                  {pointagesGps} pointage{pointagesGps > 1 ? 's' : ''} GPS
                  {' · '}
                  {zones.length} zone{zones.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="ct-linteau" aria-hidden="true" />

              <div className="ct-carte-niche">
                <div ref={mapRef} className="ct-carte" />

                {loading && (
                  <div className="ct-voile ct-voile--charge">
                    <span className="ct-balayage" aria-hidden="true" />
                    <p>Chargement des pointages…</p>
                    <span className="ct-voile-note">La carte se met à jour.</span>
                  </div>
                )}

                {!loading && pointages.length === 0 && (
                  <div className="ct-voile ct-voile--vide">
                    <div className="ct-vide" role="status">
                      <span className="ct-vide-sceau" aria-hidden="true">
                        <MapPin size={20} />
                      </span>
                      <p className="ct-vide-titre">Aucun pointage GPS pour cette date.</p>
                      <p className="ct-vide-note">
                        Les pointages apparaîtront ici en temps réel.
                      </p>
                      <span className="ct-vide-chevrons" aria-hidden="true" />
                    </div>
                  </div>
                )}

                {/* LÉGENDE */}
                <div className="ct-legende" aria-label="Légende de la carte">
                  <h4 className="ct-legende-titre">
                    <MapPin size={11} aria-hidden="true" />
                    Légende
                  </h4>

                  <div className="ct-legende-corps">
                    <div className="ct-legende-groupe">
                      <p className="ct-legende-section">Sur le site</p>
                      <div className="ct-legende-ligne">
                        <span className="ct-point ct-point--plein" data-ton="ok" />
                        <span>Présent</span>
                      </div>
                      <div className="ct-legende-ligne">
                        <span className="ct-point ct-point--plein" data-ton="attente" />
                        <span>Sorti</span>
                      </div>
                      <div className="ct-legende-ligne">
                        <span className="ct-point" data-ton="alerte" />
                        <span>Hors zone</span>
                      </div>
                    </div>

                    <div className="ct-legende-groupe">
                      <p className="ct-legende-section">Zone GPS</p>
                      <div className="ct-legende-ligne">
                        <span className="ct-point ct-point--plein" data-ton="ok" />
                        <span>Non bloquante</span>
                      </div>
                      <div className="ct-legende-ligne">
                        <span className="ct-point ct-point--creux" data-ton="alerte" />
                        <span>Bloquante</span>
                      </div>
                    </div>

                    <div className="ct-legende-groupe">
                      <p className="ct-legende-section">Groupe</p>
                      <div className="ct-legende-ligne">
                        <span className="ct-pastille">12</span>
                        <span>Employés réunis</span>
                      </div>
                    </div>

                    <div className="ct-legende-groupe">
                      <p className="ct-legende-section">Votre position</p>
                      <div className="ct-legende-ligne">
                        <span className="ct-point" data-ton="moi" />
                        <span>Ma position</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── La colonne des employés ── */}
          <aside className="ct-colonne">
            <div className="ct-liste">
              <div className="ct-liste-tete">
                <h3 className="ct-liste-titre">
                  <Users size={12} aria-hidden="true" />
                  Employés du jour
                </h3>
                <span className="ct-liste-compte">
                  {filteredEmployes.length} sur {stats.total}
                </span>
              </div>

              <label className="ct-recherche">
                <Search size={13} aria-hidden="true" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Chercher un nom ou un matricule"
                  aria-label="Chercher un employé dans la liste"
                />
              </label>

              {employesAffiches.length > 0 ? (
                <ul className="ct-planches">
                  {employesAffiches.map((data, idx) => {
                    const etat = etatDe(data.is_within_zone)
                    const estPresent = data.lastType === 'in'
                    return (
                      <li key={data.employee?.id || idx}>
                        <button
                          type="button"
                          className="ct-planche"
                          data-etat={etat}
                          onClick={() => setSelectedEmployeData(data)}
                          aria-label={`Voir la fiche de ${data.employee?.first_name || ''} ${data.employee?.last_name || ''}`}
                        >
                          <span className="ct-planche-avatar">
                            {data.employee?.photo_url ? (
                              <img src={data.employee.photo_url} alt="" />
                            ) : (
                              initialesDe(data.employee)
                            )}
                          </span>

                          <span className="ct-planche-infos">
                            <span className="ct-planche-nom">
                              {data.employee?.first_name} {data.employee?.last_name}
                            </span>
                            <span className="ct-planche-meta">
                              {data.employee?.matricule}
                              {' · '}
                              {data.pointages.length} pointage{data.pointages.length > 1 ? 's' : ''}
                              {data.geofence?.name && ` · ${data.geofence.name}`}
                            </span>
                          </span>

                          <span className="ct-planche-droite">
                            <span className="ct-grain" data-ton={estPresent ? 'ok' : 'attente'}>
                              {estPresent
                                ? <LogIn size={10} aria-hidden="true" />
                                : <LogOut size={10} aria-hidden="true" />}
                              {estPresent ? 'Présent' : 'Sorti'}
                            </span>
                            <span className="ct-planche-meta">
                              {formaterHeureLocale(data.lastTime)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="ct-liste-vide">
                  <MapPin size={20} aria-hidden="true" />
                  <p>
                    {recherche.trim()
                      ? 'Aucun nom ne correspond à cette recherche.'
                      : pointages.length === 0
                        ? 'Aucun pointage GPS sur cette date.'
                        : 'Aucun employé ne correspond à ces filtres.'}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <div className="ct-pied">
        <PageCulturalBand pathname="/carte-temps-reel" placement="bottom" />
      </div>

      {/* ── La fiche d'un employé ── */}
      {selectedEmployeData && (
        <div className="ct-fond" onClick={() => setSelectedEmployeData(null)}>
          <div
            className="ct-fiche"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ct-fiche-titre"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ct-fiche-tete">
              <span className="ct-fiche-portrait" data-etat={etatDe(selectedEmployeData.is_within_zone)}>
                {selectedEmployeData.employee?.photo_url ? (
                  <img src={selectedEmployeData.employee.photo_url} alt="" />
                ) : (
                  initialesDe(selectedEmployeData.employee)
                )}
              </span>

              <div className="ct-fiche-titres">
                <h2 id="ct-fiche-titre">
                  {selectedEmployeData.employee?.first_name}{' '}
                  {selectedEmployeData.employee?.last_name}
                </h2>
                <p className="ct-fiche-matricule">
                  {selectedEmployeData.employee?.matricule}
                  {' · '}
                  dernier relevé à {formaterHeureLocale(selectedEmployeData.lastTime)}
                </p>
              </div>

              <button
                type="button"
                className="ct-fermer"
                onClick={() => setSelectedEmployeData(null)}
                aria-label="Fermer la fiche"
                autoFocus
              >
                <X size={16} />
              </button>
            </header>

            <div className="ct-fiche-corps">
              <div className="ct-fiche-sceaux">
                <span
                  className="ct-grain"
                  data-ton={selectedEmployeData.lastType === 'in' ? 'ok' : 'attente'}
                >
                  {selectedEmployeData.lastType === 'in' ? 'Présent' : 'Sorti'}
                </span>
                <span className="ct-grain" data-ton={etatDe(selectedEmployeData.is_within_zone)}>
                  {selectedEmployeData.is_within_zone === true ? 'Dans la zone'
                    : selectedEmployeData.is_within_zone === false ? 'Hors zone'
                    : 'Non vérifié'}
                </span>
              </div>

              <div className="ct-fiche-infos">
                <div className="ct-fiche-info ct-fiche-info--large">
                  <span className="ct-fiche-libelle">Position GPS</span>
                  <a
                    className="ct-gps"
                    href={`https://www.google.com/maps?q=${selectedEmployeData.location_lat},${selectedEmployeData.location_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin size={12} aria-hidden="true" />
                    {Number(selectedEmployeData.location_lat).toFixed(5)},{' '}
                    {Number(selectedEmployeData.location_lng).toFixed(5)}
                  </a>
                </div>

                {selectedEmployeData.distance_meters != null && (
                  <div className="ct-fiche-info">
                    <span className="ct-fiche-libelle">Distance à la zone</span>
                    <span className="ct-fiche-valeur">
                      {distanceLisible(selectedEmployeData.distance_meters)}
                    </span>
                  </div>
                )}

                {selectedEmployeData.geofence?.name && (
                  <div className="ct-fiche-info">
                    <span className="ct-fiche-libelle">Zone</span>
                    <span className="ct-fiche-valeur">{selectedEmployeData.geofence.name}</span>
                  </div>
                )}
              </div>

              <section className="ct-journee">
                <h3 className="ct-journee-titre">
                  <Calendar size={11} aria-hidden="true" />
                  Pointages du jour ({selectedEmployeData.pointages.length})
                </h3>

                <ol className="ct-pointages">
                  {selectedEmployeData.pointages.map((p, i) => (
                    <li className="ct-pointage" key={i}>
                      <span className="ct-heure">{formaterHeureLocale(p.check_time)}</span>
                      <span
                        className="ct-type"
                        data-type={p.check_type === 'in' ? 'in' : 'out'}
                      >
                        {p.check_type === 'in' ? 'IN' : 'OUT'}
                      </span>
                      <span
                        className="ct-pointage-etat"
                        data-ton={etatDe(p.is_within_zone)}
                      >
                        {p.is_within_zone === true ? 'Dans la zone'
                          : p.is_within_zone === false ? 'Hors zone'
                          : 'Non vérifié'}
                      </span>
                      {p.pointages_photos?.length > 0 && (
                        <span className="ct-photo" title="Photo du pointage">
                          <Camera size={11} aria-hidden="true" />
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
