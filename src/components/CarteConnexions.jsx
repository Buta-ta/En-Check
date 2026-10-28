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

// ── LE FOND DE CARTE ──────────────────────────────────────
// Trois fonds, aucun ne réclame de clé :
//
//   1. Esri « Canvas » — le gris clair ou le gris sombre, avec ses
//      étiquettes dans un second calque. C'est le fond des deux
//      thèmes : il a l'air d'avoir été dessiné pour la page.
//   2. OpenStreetMap — le filet de sécurité si Esri ne répond pas.
//   3. Le monde Dessiné — /data/monde-110m.geojson, une carte
//      vectorielle embarquée dans l'application. Quand aucune tuile
//      n'arrive (réseau fermé, machine hors ligne), la carte reste
//      une carte : les côtes sont tracées, les épingles se posent
//      dessus, et rien ne dépend d'un service extérieur.
//
// Aucun des trois ne demande de compte : une clé d'API manquante ne
// peut plus vider la carte.
const FONDS = {
  sombre: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    libelles:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Fonds &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap',
    zoomMaximum: 16,
  },
  clair: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    libelles:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Fonds &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap',
    zoomMaximum: 16,
  },
  secours: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    zoomMaximum: 19,
  },
}

const MONDE = '/data/monde-110m.geojson'
const ZOOM_DESSINE = 6

function CarteConnexions({
  connexions = [],
  centre = [14.6937, -17.4441],
  zoom = 3,
  surEpingles,
  identifiantCible = null,
  sombre = true,
  horodatage = (valeur) => (valeur ? new Date(valeur).toLocaleString('fr-FR') : '—'),
}) {
  const conteneur = useRef(null)
  const carte = useRef(null)
  const groupe = useRef(null)
  const epingles = useRef({})
  const [Leaflet, setLeaflet] = useState(null)
  const [pret, setPret] = useState(false)
  const [fond, setFond] = useState('tuiles')
  const [mondeDessine, setMondeDessine] = useState(false)

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

  // ── le fond de carte : trois essais, puis le monde dessiné ──
  useEffect(() => {
    if (!Leaflet || !carte.current) return
    const instance = carte.current

    let abandonne = false
    let essai = 0
    let calques = []
    let minuterie = null

    const arreterMinuterie = () => {
      if (minuterie) {
        clearTimeout(minuterie)
        minuterie = null
      }
    }

    const retirerCalques = () => {
      arreterMinuterie()
      calques.forEach((calque) => {
        try {
          instance.removeLayer(calque)
        } catch {
          // La carte a pu être détruite entre-temps : rien à retirer.
        }
      })
      calques = []
    }

    // Le monde dessiné : un GeoJSON embarqué, tracé à même la carte.
    const dessinerLeMonde = async () => {
      try {
        const reponse = await fetch(MONDE, { cache: 'force-cache' })
        if (!reponse.ok) throw new Error(`Monde indisponible (${reponse.status})`)
        const donnees = await reponse.json()
        if (abandonne) return

        const trace = Leaflet.geoJSON(donnees, {
          interactive: false,
          style: {
            color: sombre ? '#c9a961' : '#8a6a20',
            weight: 0.7,
            fillColor: sombre ? '#241d18' : '#efe5d1',
            fillOpacity: 1,
          },
        }).addTo(instance)

        calques.push(trace)
        instance.setMaxZoom(ZOOM_DESSINE)
        instance.setMinZoom(1)
        setFond('dessin')
        setMondeDessine(true)
      } catch {
        if (!abandonne) setFond('aucun')
      }
    }

    const poser = () => {
      if (abandonne) return
      retirerCalques()

      if (essai >= 2) {
        dessinerLeMonde()
        return
      }

      const choix = essai === 0 ? (sombre ? FONDS.sombre : FONDS.clair) : FONDS.secours
      let erreurs = 0

      const tuiles = Leaflet.tileLayer(choix.url, {
        attribution: choix.attribution,
        maxZoom: 19,
        maxNativeZoom: choix.zoomMaximum || 19,
        crossOrigin: true,
      })

      // Trois tuiles manquantes : le fond suivant prend le relais. C'est
      // ce qui protège la carte d'un fournisseur fermé ou d'une clé
      // d'API exigée — jamais d'écran gris, jamais de message d'erreur
      // d'un service tiers au milieu de la page.
      tuiles.on('tileerror', () => {
        erreurs += 1
        if (erreurs >= 3 && !abandonne) {
          essai += 1
          poser()
        }
      })

      tuiles.addTo(instance)
      calques.push(tuiles)

      // Un serveur qui ne répond ni oui ni non ne doit pas figer la carte :
      // sans une seule tuile chargée au bout de quatre secondes, on passe
      // au fond suivant comme si les tuiles avaient échoué.
      let tuilesChargees = 0
      tuiles.on('tileload', () => {
        tuilesChargees += 1
        if (tuilesChargees === 1) arreterMinuterie()
      })
      minuterie = setTimeout(() => {
        if (abandonne || tuilesChargees > 0) return
        essai += 1
        poser()
      }, 4000)

      if (choix.libelles) {
        const etiquettes = Leaflet.tileLayer(choix.libelles, {
          maxZoom: 19,
          maxNativeZoom: choix.zoomMaximum || 19,
          crossOrigin: true,
          pane: 'shadowPane',
        })
        etiquettes.addTo(instance)
        calques.push(etiquettes)
      }

      instance.setMaxZoom(19)
      setFond('tuiles')
      setMondeDessine(false)
    }

    poser()

    return () => {
      abandonne = true
      retirerCalques()
    }
  }, [Leaflet, pret, sombre])

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
    <div
      className="an-carte-cadre"
      data-sombre={sombre ? 'oui' : 'non'}
      data-fond={fond}
      data-monde={mondeDessine ? 'oui' : 'non'}
    >
      {!pret && (
        <div className="an-carte-attente" role="status">
          <span className="an-carte-attente-chevrons" aria-hidden="true">
            <i /><i /><i />
          </span>
          <p>La carte se déplie…</p>
        </div>
      )}
      <div className="an-carte-toile" ref={conteneur} />
      {fond === 'dessin' && (
        <p className="an-carte-muette" role="status">
          Les tuiles n’ont pas répondu : le monde est dessiné ici, les épingles
          restent à leur place.
        </p>
      )}
      {fond === 'aucun' && (
        <p className="an-carte-muette" role="status">
          Aucun fond n’a pu être chargé — les épingles restent à leur place.
        </p>
      )}
    </div>
  )
}

export default CarteConnexions
