// ═══════════════════════════════════════════════════════════
// 🌍 PAGE CONFIGURATION GEOFENCING
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
  MapPin, Plus, Edit2, Trash2, Save, X,
  Navigation, Lock, Unlock, CheckCircle2, AlertTriangle,
  RefreshCw
} from 'lucide-react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function ConfigGeofencing() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [enterpriseName, setEnterpriseName] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false) // ✅ AJOUT

  const [toast, setToast] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius_meters: 200,
    is_blocking: false,
    is_active: true,
  })

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const circleRef = useRef(null)
  const markerRef = useRef(null)

  // ═══════════════════════════════════════════════════════════
  // 🔔 HELPERS MODALES
  // ═══════════════════════════════════════════════════════════

  const showSuccess = (message) => {
    setToast({ type: 'success', message })
    setTimeout(() => setToast(null), 3500)
  }

  const showError = (message) => {
    setToast({ type: 'error', message })
    setTimeout(() => setToast(null), 5000)
  }

  const showConfirm = (message, onConfirm, extra = null) => {
    setConfirmModal({ message, onConfirm, extra })
  }

  // ═══════════════════════════════════════════════════════════
  // 🔧 INITIALISATION
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const adminData = JSON.parse(localStorage.getItem('admin') || '{}')
    setAdmin(adminData)

    const selectedId = localStorage.getItem('selected_enterprise_id')
    const entId = selectedId || adminData.selectedEnterprise?.id || adminData.enterprise_id
    const entName = adminData.selectedEnterprise?.name || adminData.enterprise_name || ''
    setEnterpriseName(entName)

    if (entId) {
      setEnterpriseId(entId)
      if (!entName) {
        supabase.from('enterprises').select('name').eq('id', entId).single()
          .then(({ data }) => { if (data) setEnterpriseName(data.name) })
      }
      chargerZones(entId)
    } else {
      setLoading(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // 🗺️ INITIALISER LA CARTE
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (showForm) {
      const timer = setTimeout(() => {
        if (mapRef.current && !mapInstanceRef.current) {
          initMap()
        }
      }, 150)
      return () => clearTimeout(timer)
    } else {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [showForm])

  useEffect(() => {
    if (formData.latitude && formData.longitude && formData.radius_meters && mapInstanceRef.current) {
      updateMapCircle(
        parseFloat(formData.latitude),
        parseFloat(formData.longitude),
        parseInt(formData.radius_meters)
      )
    }
  }, [formData.radius_meters])

  const initMap = () => {
    try {
      const defaultLat = editingZone ? parseFloat(editingZone.latitude) : 48.8566
      const defaultLng = editingZone ? parseFloat(editingZone.longitude) : 2.3522
      const defaultZoom = editingZone ? 15 : 6

      mapInstanceRef.current = L.map(mapRef.current).setView([defaultLat, defaultLng], defaultZoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current)

      if (editingZone) {
        updateMapCircle(
          parseFloat(editingZone.latitude),
          parseFloat(editingZone.longitude),
          editingZone.radius_meters
        )
      }

      mapInstanceRef.current.on('click', (e) => {
        const lat = e.latlng.lat.toFixed(6)
        const lng = e.latlng.lng.toFixed(6)
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
        updateMapCircle(parseFloat(lat), parseFloat(lng), formData.radius_meters)
      })
    } catch (err) {
      console.error('❌ Erreur initialisation carte:', err)
    }
  }

  const updateMapCircle = (lat, lng, radius) => {
    if (!mapInstanceRef.current) return
    if (circleRef.current) circleRef.current.remove()
    if (markerRef.current) markerRef.current.remove()

    circleRef.current = L.circle([lat, lng], {
      color: '#8B6914',
      fillColor: '#D4AF37',
      fillOpacity: 0.2,
      radius: radius,
    }).addTo(mapInstanceRef.current)

    markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current)
    mapInstanceRef.current.setView([lat, lng], 15)
  }

  // ═══════════════════════════════════════════════════════════
  // 📡 GÉOLOCALISATION
  // ═══════════════════════════════════════════════════════════

  const obtenirPositionActuelle = () => {
    if (!navigator.geolocation) {
      showError("La géolocalisation n'est pas supportée par votre navigateur")
      return
    }

    if (gettingLocation) return // évite les doubles clics
    setGettingLocation(true)

    // ✅ Tentative 1 — Position précise avec timeout court
    const tentativePrecise = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Succès
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setFormData((prev) => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          }))
          updateMapCircle(lat, lng, formData.radius_meters)
          setGettingLocation(false)
        },
        (error) => {
          console.warn('Tentative précise échouée:', error.code, error.message)
          // ✅ Si kCLErrorLocationUnknown (code 2) ou timeout → retry sans haute précision
          if (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT) {
            tentativeRapide()
          } else {
            // Permission refusée → pas de retry possible
            setGettingLocation(false)
            if (error.code === error.PERMISSION_DENIED) {
              showError("Géolocalisation refusée. Autorisez l'accès dans les paramètres de votre navigateur.")
            } else {
              showError("Position introuvable. Essayez de vous rapprocher d'une fenêtre ou d'activer le GPS.")
            }
          }
        },
        {
          enableHighAccuracy: true,  // GPS précis
          timeout: 8000,             // 8 secondes max
          maximumAge: 30000,         // accepte un cache de 30 secondes
        }
      )
    }

    // ✅ Tentative 2 — Position approximative (WiFi/réseau), plus rapide
    const tentativeRapide = () => {
      console.log('Retry avec position approximative...')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setFormData((prev) => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          }))
          updateMapCircle(lat, lng, formData.radius_meters)
          setGettingLocation(false)
          // Avertir que c'est approximatif
          showSuccess("Position approximative obtenue (précision : " + "réseau WiFi/4G). Vous pouvez ajuster sur la carte.")
        },
        (error) => {
          console.error('Tentative rapide échouée:', error.code, error.message)
          setGettingLocation(false)
          showError(
            "Impossible d'obtenir votre position. " +
            "Vérifiez que la géolocalisation est activée sur votre appareil, " +
            "ou cliquez directement sur la carte pour placer la zone."
          )
        },
        {
          enableHighAccuracy: false, // WiFi/réseau, pas GPS
          timeout: 10000,            // 10 secondes
          maximumAge: 60000,         // accepte un cache d'1 minute
        }
      )
    }

    tentativePrecise()
  }

  // ═══════════════════════════════════════════════════════════
  // 📊 CHARGER LES ZONES
  // ═══════════════════════════════════════════════════════════

  const chargerZones = async (entId) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('enterprise_id', entId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setZones(data || [])
    } catch (err) {
      console.error('Erreur chargement zones:', err)
      showError('Erreur lors du chargement des zones')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ➕ SAUVEGARDER UNE ZONE
  // ═══════════════════════════════════════════════════════════

  const sauvegarderZone = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.latitude || !formData.longitude) {
      showError('Veuillez remplir tous les champs obligatoires')
      return
    }

    if (!enterpriseId) {
      showError('Aucune entreprise sélectionnée')
      return
    }

    try {
      const dataToSave = {
        enterprise_id: enterpriseId,
        name: formData.name,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius_meters: parseInt(formData.radius_meters),
        is_blocking: formData.is_blocking,
        is_active: formData.is_active,
      }

      if (editingZone) {
        const { error } = await supabase
          .from('geofences')
          .update(dataToSave)
          .eq('id', editingZone.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('geofences')
          .insert(dataToSave)
        if (error) throw error
      }

      fermerFormulaire()
      chargerZones(enterpriseId)
      showSuccess(editingZone ? 'Zone modifiée avec succès ✓' : 'Zone créée avec succès ✓')
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      showError('Erreur lors de la sauvegarde : ' + err.message)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🗑️ SUPPRIMER UNE ZONE
  // Gestion de la contrainte FK avec attendances
  // ═══════════════════════════════════════════════════════════

  const supprimerZone = async (id, name) => {
    // Vérifier d'abord combien de pointages sont liés à cette zone
    try {
      const { count, error: countError } = await supabase
        .from('attendances')
        .select('*', { count: 'exact', head: true })
        .eq('geofence_id', id)

      if (countError) throw countError

      const nbPointages = count || 0

      // Message adapté selon si des pointages sont liés ou non
      const message = nbPointages > 0
        ? `Voulez-vous supprimer la zone "${name}" ?\n\n⚠️ ${nbPointages} pointage${nbPointages > 1 ? 's sont' : ' est'} lié${nbPointages > 1 ? 's' : ''} à cette zone. La référence sera effacée dans l'historique (les pointages eux-mêmes seront conservés).`
        : `Voulez-vous vraiment supprimer la zone "${name}" ? Cette action est irréversible.`

      showConfirm(
        message,
        () => executerSuppression(id, nbPointages),
        { nbPointages }
      )
    } catch (err) {
      console.error('Erreur vérification pointages liés:', err)
      // En cas d'erreur de vérification, afficher quand même le modal de confirmation
      showConfirm(
        `Voulez-vous vraiment supprimer la zone "${name}" ? Cette action est irréversible.`,
        () => executerSuppression(id, 0)
      )
    }
  }

  const executerSuppression = async (id, nbPointages) => {
    setDeletingId(id)
    try {
      // ── Étape 1 : Mettre geofence_id à null dans attendances ──
      if (nbPointages > 0) {
        const { error: updateError } = await supabase
          .from('attendances')
          .update({
            geofence_id: null,
            // On conserve les autres champs géo pour l'historique
          })
          .eq('geofence_id', id)

        if (updateError) throw updateError
      }

      // ── Étape 2 : Supprimer la zone ──
      const { error: deleteError } = await supabase
        .from('geofences')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      // ── Succès ──
      chargerZones(enterpriseId)
      const message = nbPointages > 0
        ? `Zone supprimée. ${nbPointages} pointage${nbPointages > 1 ? 's mis' : ' mis'} à jour.`
        : 'Zone supprimée avec succès'
      showSuccess(message)

    } catch (err) {
      console.error('Erreur suppression:', err)

      // Message d'erreur détaillé selon le type d'erreur
      if (err.code === '23503') {
        showError(
          'Impossible de supprimer : des données sont encore liées à cette zone. ' +
          'Contactez l\'administrateur système.'
        )
      } else {
        showError('Erreur lors de la suppression : ' + (err.message || 'Erreur inconnue'))
      }
    } finally {
      setDeletingId(null)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🔄 ACTIVER/DÉSACTIVER
  // ═══════════════════════════════════════════════════════════

  const toggleZoneActive = async (zone) => {
    try {
      const { error } = await supabase
        .from('geofences')
        .update({ is_active: !zone.is_active })
        .eq('id', zone.id)

      if (error) throw error
      chargerZones(enterpriseId)
      showSuccess(zone.is_active ? 'Zone désactivée' : 'Zone activée')
    } catch (err) {
      console.error('Erreur toggle active:', err)
      showError('Erreur lors de la modification')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🎛️ GESTION DU FORMULAIRE
  // ═══════════════════════════════════════════════════════════

  const ouvrirFormulaire = (zone = null) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    if (zone) {
      setEditingZone(zone)
      setFormData({
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius_meters: zone.radius_meters,
        is_blocking: zone.is_blocking,
        is_active: zone.is_active,
      })
    } else {
      setEditingZone(null)
      setFormData({
        name: '',
        latitude: '',
        longitude: '',
        radius_meters: 200,
        is_blocking: false,
        is_active: true,
      })
    }
    setShowForm(true)
  }

  const fermerFormulaire = () => {
    setShowForm(false)
    setEditingZone(null)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 🖥️ RENDER
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0A0A0F',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}>
        <MapPin size={48} color="#10B981" />
        <p style={{ color: '#888', letterSpacing: '2px' }}>Chargement des zones...</p>
      </div>
    )
  }

  if (!enterpriseId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', minHeight: '100vh', background: '#0A0A0F' }}>
        <p style={{ color: '#EF4444', fontSize: '16px' }}>⚠️ Aucune entreprise sélectionnée.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '30px', minHeight: '100vh', background: '#0A0A0F' }}>
      <PageHeader
        title="Configuration Geofencing"
        subtitle="Définissez les zones géographiques autorisées pour le pointage"
      />

      {/* ═══ TOAST NOTIFICATION ═══ */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderRadius: '14px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          background: toast.type === 'success'
            ? 'rgba(16,185,129,0.12)'
            : 'rgba(239,68,68,0.12)',
          backdropFilter: 'blur(10px)',
          minWidth: '280px',
          maxWidth: '420px',
          animation: 'slideInRight 0.3s ease',
        }}>
          {toast.type === 'success'
            ? <CheckCircle2 size={22} color="#10B981" style={{ flexShrink: 0 }} />
            : <AlertTriangle size={22} color="#EF4444" style={{ flexShrink: 0 }} />
          }
          <span style={{
            color: toast.type === 'success' ? '#10B981' : '#EF4444',
            fontSize: '14px',
            fontWeight: '600',
            flex: 1,
            lineHeight: '1.4',
          }}>
            {toast.message}
          </span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#888' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══ MODAL CONFIRMATION ═══ */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998, padding: '20px',
        }}>
          <div style={{
            background: '#141423',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            padding: '32px',
            border: '1px solid rgba(239,68,68,0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}>
            {/* Icône */}
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px',
              background: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto',
            }}>
              <Trash2 size={28} color="#EF4444" />
            </div>

            <h3 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '700', margin: '0 0 12px 0' }}>
              Confirmer la suppression
            </h3>

            {/* Message avec mise en forme */}
            <div style={{ marginBottom: '24px' }}>
              {confirmModal.extra?.nbPointages > 0 ? (
                <>
                  <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    {confirmModal.message.split('\n\n')[0]}
                  </p>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '12px 14px',
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '12px',
                    textAlign: 'left',
                  }}>
                    <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <p style={{ color: '#F59E0B', fontSize: '13px', fontWeight: '700', margin: '0 0 4px 0' }}>
                        {confirmModal.extra.nbPointages} pointage{confirmModal.extra.nbPointages > 1 ? 's liés' : ' lié'}
                      </p>
                      <p style={{ color: '#AAA', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                        La référence à cette zone sera effacée dans l'historique. Les pointages eux-mêmes seront conservés.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  {confirmModal.message}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1, padding: '13px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', color: '#E5E5E5',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(null)
                }}
                style={{
                  flex: 1, padding: '13px',
                  background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
                  border: 'none', borderRadius: '12px', color: '#fff',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={16} />
                {confirmModal.extra?.nbPointages > 0 ? 'Supprimer quand même' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BANDEAU ENTREPRISE ═══ */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '12px', padding: '10px 16px',
        marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <MapPin size={16} color="#10B981" />
        <span style={{ color: '#10B981', fontSize: '14px', fontWeight: '600' }}>
          {enterpriseName || 'Entreprise'}
        </span>
        <span style={{ color: '#666', fontSize: '13px' }}>
          — {zones.length} zone{zones.length > 1 ? 's' : ''} configurée{zones.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* ═══ BOUTON AJOUTER ═══ */}
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => ouvrirFormulaire()} style={styles.btnAjouter}>
          <Plus size={20} />
          Ajouter une zone
        </button>
      </div>

      {/* ═══ LISTE DES ZONES ═══ */}
      {zones.length === 0 ? (
        <div style={styles.empty}>
          <MapPin size={64} color="#D4AF37" />
          <p style={{ fontSize: '18px', color: '#D4AF37', marginTop: '20px' }}>
            Aucune zone géofencée définie
          </p>
          <p style={{ color: '#666', marginTop: '10px' }}>
            Cliquez sur "Ajouter une zone" pour commencer
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {zones.map((zone) => {
            const isDeleting = deletingId === zone.id
            return (
              <div
                key={zone.id}
                style={{
                  ...styles.card,
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{zone.name}</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Activer/Désactiver */}
                    <button
                      onClick={() => toggleZoneActive(zone)}
                      disabled={isDeleting}
                      style={{
                        ...styles.iconBtn,
                        backgroundColor: zone.is_active ? '#10B981' : '#EF4444',
                        opacity: isDeleting ? 0.5 : 1,
                      }}
                      title={zone.is_active ? 'Désactiver' : 'Activer'}
                    >
                      {zone.is_active ? <Unlock size={16} /> : <Lock size={16} />}
                    </button>

                    {/* Modifier */}
                    <button
                      onClick={() => ouvrirFormulaire(zone)}
                      disabled={isDeleting}
                      style={{
                        ...styles.iconBtn,
                        opacity: isDeleting ? 0.5 : 1,
                      }}
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>

                    {/* Supprimer */}
                    <button
                      onClick={() => supprimerZone(zone.id, zone.name)}
                      disabled={isDeleting}
                      style={{
                        ...styles.iconBtn,
                        backgroundColor: '#EF4444',
                        opacity: isDeleting ? 0.5 : 1,
                        minWidth: '36px',
                      }}
                      title="Supprimer"
                    >
                      {isDeleting
                        ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Trash2 size={16} />
                      }
                    </button>
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.info}>
                    <span style={styles.label}>Coordonnées</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {Number(zone.latitude).toFixed(5)}, {Number(zone.longitude).toFixed(5)}
                    </span>
                  </div>
                  <div style={styles.info}>
                    <span style={styles.label}>Rayon</span>
                    <span>{zone.radius_meters}m</span>
                  </div>
                  <div style={styles.info}>
                    <span style={styles.label}>Mode</span>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: zone.is_blocking ? '#EF4444' : '#10B981',
                    }}>
                      {zone.is_blocking ? '🔒 Bloquant' : '✅ Non-bloquant'}
                    </span>
                  </div>
                  <div style={styles.info}>
                    <span style={styles.label}>Statut</span>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: zone.is_active ? '#10B981' : '#6B7280',
                    }}>
                      {zone.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ MODAL FORMULAIRE ═══ */}
      {showForm && (
        <div style={styles.modalOverlay} onClick={fermerFormulaire}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingZone ? '✏️ Modifier la zone' : '➕ Nouvelle zone'}
              </h2>
              <button onClick={fermerFormulaire} style={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={sauvegarderZone} style={styles.form}>
              {/* NOM */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  Nom de la zone <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Siège Paris, Usine Lyon..."
                  style={styles.input}
                  required
                />
              </div>

              {/* GÉOLOCALISATION */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Position du centre</label>
                <button
                  type="button"
                  onClick={obtenirPositionActuelle}
                  disabled={gettingLocation}
                  style={{
                    ...styles.btnGeo,
                    opacity: gettingLocation ? 0.7 : 1,
                    cursor: gettingLocation ? 'not-allowed' : 'pointer',
                  }}
                >
                  {gettingLocation ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Recherche en cours...
                    </>
                  ) : (
                    <>
                      <Navigation size={16} />
                      Utiliser ma position actuelle
                    </>
                  )}
                </button>
              </div>

              {/* CARTE */}
              <div style={styles.formGroup}>
                <div
                  ref={mapRef}
                  style={{
                    width: '100%', height: '300px',
                    borderRadius: '10px',
                    border: '2px solid rgba(212,175,55,0.4)',
                    zIndex: 1,
                  }}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  💡 Cliquez sur la carte pour définir le centre de la zone
                </p>
              </div>

              {/* COORDONNÉES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Latitude <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.latitude}
                    onChange={(e) => {
                      setFormData({ ...formData, latitude: e.target.value })
                      if (e.target.value && formData.longitude) {
                        updateMapCircle(
                          parseFloat(e.target.value),
                          parseFloat(formData.longitude),
                          formData.radius_meters
                        )
                      }
                    }}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Longitude <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.longitude}
                    onChange={(e) => {
                      setFormData({ ...formData, longitude: e.target.value })
                      if (formData.latitude && e.target.value) {
                        updateMapCircle(
                          parseFloat(formData.latitude),
                          parseFloat(e.target.value),
                          formData.radius_meters
                        )
                      }
                    }}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              {/* RAYON */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  Rayon : <strong style={{ color: '#D4AF37' }}>{formData.radius_meters}m</strong>
                </label>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) })}
                  style={styles.slider}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                  <span>50m</span>
                  <span>5000m</span>
                </div>
              </div>

              {/* MODE BLOQUANT */}
              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.is_blocking}
                    onChange={(e) => setFormData({ ...formData, is_blocking: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#D4AF37' }}
                  />
                  <span style={styles.formLabel}>Mode bloquant</span>
                </label>
                <p style={{ fontSize: '13px', color: '#666', marginTop: '6px', marginLeft: '26px' }}>
                  Si activé, les employés ne peuvent PAS pointer hors de cette zone.
                </p>
              </div>

              {/* ACTIF */}
              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#10B981' }}
                  />
                  <span style={styles.formLabel}>Zone active</span>
                </label>
              </div>

              {/* BOUTONS */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" style={styles.btnSave}>
                  <Save size={18} />
                  {editingZone ? 'Enregistrer les modifications' : 'Créer la zone'}
                </button>
                <button type="button" onClick={fermerFormulaire} style={styles.btnCancel}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ CSS ANIMATIONS ═══ */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════

const styles = {
  btnAjouter: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #8B6914, #D4AF37)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(139,105,20,0.3)',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'rgba(20,20,35,0.6)',
    borderRadius: '20px',
    border: '2px dashed rgba(212,175,55,0.3)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'rgba(20,20,35,0.8)',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    background: 'rgba(30,30,50,0.8)',
    borderBottom: '1px solid rgba(212,175,55,0.2)',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#FFFFFF',
    margin: 0,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginRight: '12px',
  },
  iconBtn: {
    padding: '8px',
    backgroundColor: '#8B6914',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s ease',
    flexShrink: 0,
  },
  cardBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  info: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#E5E5E5',
  },
  label: {
    fontWeight: '600',
    color: '#D4AF37',
    fontSize: '13px',
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '20px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: '#141423',
    borderRadius: '20px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#FFFFFF',
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    padding: '28px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#E5E5E5',
    fontSize: '14px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    color: '#E5E5E5',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '5px',
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#D4AF37',
  },
  btnGeo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '10px',
    color: '#10B981',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnSave: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '13px 24px',
    background: 'linear-gradient(135deg, #8B6914, #D4AF37)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 1,
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  btnCancel: {
    padding: '13px 24px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#E5E5E5',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}