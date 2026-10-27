// ═══════════════════════════════════════════════════════════
// LA CARTE DES CONNEXIONS — la toile, posée à plat
//
// Extrait de l'ancienne page « Carte des connexions » : la même
// mécanique (Leaflet chargé à la demande, agrégats, épingles
// cliquables, zoom sur une personne même dans un amas), mais le
// dessin appartient maintenant à la page : ocre pour les employés,
// or pour les administrateurs, et plus aucun emoji.
//
// Le composant ne décide de rien : il reçoit les connexions, un
// centre, un zoom, et prévient quand on clique une épingle.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import './CarteConnexions.css'

const OCRE = '#c9773c'
const OR = '#c9a961'

function CarteConnexions({
  connexions = [],
  centre = [14.6937, -17.4441],
  zoom = 3,
  surEpingles,
  identifiantCible = null,
  horodatage = (valeur) => (valeur ? new Date(valeur).toLocaleString('fr-FR') : '—'),
}) {
  const conteneur = useRef(null)
  const carte = useRef(null)
  const groupe = useRef(null)
  const epingles = useRef({})
  const [Leaflet, setLeaflet] = useState(null)
  const [pret, setPret] = useState(false)

  // ── le chargement de Leaflet, une seule fois ──
  useEffect(() => {
    let abandonne = false

    const charger = async () => {
      try {
        const [module, _css] = await Promise.all([
          import('leaflet'),
          import('leaflet/dist/leaflet.css'),
        ])

        try {
          await import('leaflet.markercluster/dist/MarkerCluster.css')
          await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
          await import('leaflet.markercluster')
        } catch {
          // Sans agrégats, la carte reste utilisable : un calque suffit.
        }

        const L = module.default || module
        delete L.Icon.Default.prototype._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        if (!abandonne) setLeaflet(L)
      } catch (probleme) {
        console.error('Carte indisponible :', probleme)
      }
    }

    charger()
    return () => { abandonne = true }
  }, [])

  // ── la carte elle-même ──
  useEffect(() => {
    if (!Leaflet || !conteneur.current || carte.current) return

    const instance = Leaflet.map(conteneur.current, { center: centre, zoom, zoomControl: true })
    Leaflet.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', maxZoom: 19 },
    ).addTo(instance)

    carte.current = instance
    setPret(true)

    return () => {
      if (carte.current) {
        carte.current.remove()
        carte.current = null
        setPret(false)
      }
    }
  }, [Leaflet])

  // ── suivre le centre et le zoom décidés par la page ──
  useEffect(() => {
    if (!carte.current || !centre) return
    carte.current.setView(centre, zoom, { animate: true, duration: 0.5 })
  }, [centre, zoom])

  // ── les épingles ──
  useEffect(() => {
    if (!pret || !carte.current || !Leaflet) return

    const L = Leaflet
    const instance = carte.current

    if (groupe.current) {
      instance.removeLayer(groupe.current)
      groupe.current = null
    }
    epingles.current = {}

    if (connexions.length === 0) return

    const epingle = (estAdmin, cible = false) => {
      const taille = cible ? 42 : 32
      const couleur = estAdmin ? OR : OCRE
      return L.divIcon({
        className: 'an-epingle',
        html: `<span class="an-epingle-point" style="--an-epingle:${couleur};width:${taille}px;height:${taille}px"></span>`,
        iconSize: [taille + 10, taille + 10],
        iconAnchor: [(taille + 10) / 2, (taille + 10) / 2],
        popupAnchor: [0, -(taille / 2 + 4)],
      })
    }

    const amas = (nombre, contientAdmin) => {
      const taille = nombre > 10 ? 50 : nombre > 5 ? 44 : 38
      return L.divIcon({
        className: 'an-amas',
        html: `<span class="an-amas-point" style="--an-amas:${contientAdmin ? OR : OCRE};width:${taille}px;height:${taille}px">${nombre}</span>`,
        iconSize: [taille, taille],
        iconAnchor: [taille / 2, taille / 2],
      })
    }

    let couche
    try {
      couche = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        spiderfyDistanceMultiplier: 2,
        spiderLegPolylineOptions: { weight: 2, color: OCRE, opacity: 0.5 },
        iconCreateFunction: (amas_) => {
          const dedans = amas_.getAllChildMarkers()
          return amas(amas_.getChildCount(), dedans.some((m) => m.options.donnees?.user_type === 'admin'))
        },
      })
    } catch {
      couche = L.layerGroup()
    }

    const nomDe = (connexion) => {
      const personne = connexion.user_type === 'admin' ? connexion.admins : connexion.employees
      const complet = `${personne?.first_name || ''} ${personne?.last_name || ''}`.trim()
      return complet || (connexion.user_type === 'admin' ? 'Administrateur' : 'Employé')
    }

    connexions.forEach((connexion) => {
      if (!connexion.latitude || !connexion.longitude) return
      const estAdmin = connexion.user_type === 'admin'
      const epingle_ = L.marker([connexion.latitude, connexion.longitude], {
        icon: epingle(estAdmin),
        donnees: connexion,
      })

      epingles.current[connexion.id] = epingle_

      const sous = estAdmin
        ? (connexion.admins?.email || '')
        : (connexion.employees?.matricule || '')
      const entreprise = connexion.enterprises?.name || ''
      const appareil = connexion.device_type === 'mobile'
        ? 'Mobile'
        : connexion.device_type === 'tablet' ? 'Tablette' : 'Bureau'

      epingle_.bindPopup(`
        <div class="an-bulle">
          <p class="an-bulle-nom">${nomDe(connexion)}</p>
          ${sous ? `<p class="an-bulle-sous">${sous}</p>` : ''}
          <p class="an-bulle-ligne">${connexion.city || 'Lieu inconnu'}${connexion.country ? `, ${connexion.country}` : ''}</p>
          <p class="an-bulle-ligne">${horodatage(connexion.connected_at)}</p>
          <p class="an-bulle-ligne">${appareil}</p>
          ${entreprise ? `<p class="an-bulle-entreprise">${entreprise}</p>` : ''}
          <p class="an-bulle-etat" data-etat="${connexion.success === false ? 'refus' : 'ok'}">
            ${connexion.success === false ? 'Connexion refusée' : 'Connexion réussie'}
          </p>
        </div>
      `, { maxWidth: 260, className: 'an-bulle-cadre' })

      epingle_.on('click', () => { if (surEpingles) surEpingles(connexion) })
      couche.addLayer(epingle_)
    })

    instance.addLayer(couche)
    groupe.current = couche
  }, [pret, connexions, Leaflet, horodatage, surEpingles])

  // ── montrer une personne précise, même dans un amas ──
  useEffect(() => {
    if (!identifiantCible || !pret || !Leaflet || !carte.current) return
    const epingle_ = epingles.current[identifiantCible]
    if (!epingle_) return

    const couche = groupe.current

    if (couche && typeof couche.zoomToShowLayer === 'function') {
      couche.zoomToShowLayer(epingle_, () => {
        setTimeout(() => {
          epingle_.openPopup()
          const donnees = epingle_.options.donnees
          if (!donnees) return
          const estAdmin = donnees.user_type === 'admin'
          const couleur = estAdmin ? OR : OCRE
          epingle_.setIcon(Leaflet.divIcon({
            className: 'an-epingle',
            html: `<span class="an-epingle-point an-epingle-point--cible" style="--an-epingle:${couleur};width:42px;height:42px"></span>`,
            iconSize: [52, 52],
            iconAnchor: [26, 26],
            popupAnchor: [0, -24],
          }))
          setTimeout(() => {
            epingle_.setIcon(Leaflet.divIcon({
              className: 'an-epingle',
              html: `<span class="an-epingle-point" style="--an-epingle:${couleur};width:32px;height:32px"></span>`,
              iconSize: [42, 42],
              iconAnchor: [21, 21],
              popupAnchor: [0, -20],
            }))
          }, 4000)
        }, 300)
      })
    } else {
      carte.current.setView(epingle_.getLatLng(), 16, { animate: true, duration: 0.5 })
      setTimeout(() => epingle_.openPopup(), 500)
    }
  }, [identifiantCible, pret, Leaflet])

  return (
    <div className="an-carte-cadre">
      {!pret && (
        <div className="an-carte-attente" role="status">
          <span className="an-carte-attente-chevrons" aria-hidden="true">
            <i /><i /><i />
          </span>
          <p>La carte se déplie…</p>
        </div>
      )}
      <div className="an-carte-toile" ref={conteneur} />
    </div>
  )
}

export default CarteConnexions
