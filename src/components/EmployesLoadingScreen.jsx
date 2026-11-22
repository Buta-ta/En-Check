import { useEffect, useRef, useState } from 'react'
import EnCheckBrandMark from './EnCheckBrandMark'
import './EmployesLoadingScreen.css'

// Durée plancher de la scène : le temps de la voir, pas plus.
export const EMPLOYES_INTRO_MS = 2600

// Calques découpés dans l'illustration validée (scène 1600 × 900).
// `etape` relie chaque collaborateur à une étape réelle du chargement :
// le premier de la file (devant la borne) est le dossier le plus tôt prêt.
export const CALQUES_PERSONNAGES = [
  { nom: 'p1', etape: 1, gauche: 57.188, haut: 6.889, largeur: 22.625, hauteur: 86.556 },
  { nom: 'p2', etape: 2, gauche: 43.625, haut: 15.111, largeur: 12.438, hauteur: 77.222 },
  { nom: 'p3', etape: 3, gauche: 31.5, haut: 21.556, largeur: 10.688, hauteur: 69.111 },
  { nom: 'p4', etape: 4, gauche: 20.0, haut: 20.333, largeur: 10.688, hauteur: 69.778 },
]

const CALQUES_FIXES = ['decor', 'approved']

export const ETAPES_CHARGEMENT_EMPLOYES = [
  {
    id: 1,
    court: 'Collaborateurs',
    detail: 'Lecture des dossiers et fiches collaborateurs…',
    pct: 25,
  },
  {
    id: 2,
    court: 'Pointages du jour',
    detail: 'Vérification des présences et des pointages en direct…',
    pct: 55,
  },
  {
    id: 3,
    court: 'Entreprise',
    detail: 'Chargement de l’entreprise et des options actives…',
    pct: 80,
  },
  {
    id: 4,
    court: 'Plannings',
    detail: 'Synchronisation des horaires et des équipes…',
    pct: 95,
  },
]

export default function EmployesLoadingScreen({
  darkMode = false,
  onSkip,
  onIntroDone,
  dataReady = false,
  etape = 1,
  progression,
  nomEntreprise = '',
  // La même scène sert à la fiche d'un collaborateur : ces textes et ces
  // étapes sont donc réglables, sans dupliquer le composant.
  etapes = ETAPES_CHARGEMENT_EMPLOYES,
  marque,
  titre,
  titrePret,
  statutPret,
  legende = 'Chargement de l’espace collaborateurs',
  dureeMin = EMPLOYES_INTRO_MS,
  // Une autre page peut emprunter la même carte : le dossier d’images et la
  // file de personnages découpée en calques. `imageScene` donne UNE scène
  // unique, sans calques : la page Planning regarde son mur d’équipe d’un bloc.
  dossierImages = '/images/employes-loading-',
  calques = CALQUES_PERSONNAGES,
  imageScene = null,
}) {
  const sceneUnique = Boolean(imageScene)
  const [calquesCharges, setCalquesCharges] = useState([])
  const [erreurCalque, setErreurCalque] = useState(false)
  const [erreurImage, setErreurImage] = useState(false)

  // Le minuteur ne doit pas repartir à zéro à chaque mise à jour de
  // progression : on garde le gestionnaire dans une référence et on
  // programme l'écoulement une seule fois, au montage.
  const finirRef = useRef(onIntroDone)
  finirRef.current = onIntroDone
  const dureeRef = useRef(dureeMin)
  dureeRef.current = dureeMin

  useEffect(() => {
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reduit?.matches) {
      finirRef.current?.()
      return undefined
    }
    const minuterie = window.setTimeout(() => finirRef.current?.(), dureeRef.current)
    const surChangement = (event) => {
      if (event.matches) finirRef.current?.()
    }
    reduit?.addEventListener?.('change', surChangement)
    return () => {
      window.clearTimeout(minuterie)
      reduit?.removeEventListener?.('change', surChangement)
    }
  }, [])

  const marquerCharge = (nom) => {
    setCalquesCharges((precedents) =>
      precedents.includes(nom) ? precedents : [...precedents, nom],
    )
  }

  // Au premier affichage, l'image complète approuvée est visible ; les calques
  // animés ne prennent le relais que lorsqu'ils sont tous là, sinon la file
  // arriverait morceau par morceau.
  const scenePrete =
    !sceneUnique &&
    !erreurCalque &&
    calquesCharges.length === CALQUES_FIXES.length + calques.length

  const etapeCourante = Math.min(etapes.length, Math.max(1, Number(etape) || 1))
  const infoEtape = etapes.find((item) => item.id === etapeCourante) || etapes[0]

  const pourcentageReel = dataReady
    ? 100
    : typeof progression === 'number'
      ? Math.min(99, Math.max(8, Math.round(progression)))
      : infoEtape.pct

  const propsCalque = (nom, classe = '', geo = null) => ({
    src: `${dossierImages}${nom}.webp`,
    alt: '',
    width: geo ? Math.round((geo.largeur / 100) * 1600) : 1600,
    height: geo ? Math.round((geo.hauteur / 100) * 900) : 900,
    decoding: 'async',
    draggable: false,
    className: classe,
    style: geo
      ? {
          left: `${geo.gauche}%`,
          top: `${geo.haut}%`,
          width: `${geo.largeur}%`,
          height: `${geo.hauteur}%`,
        }
      : undefined,
    onLoad: () => marquerCharge(nom),
    onError: () => setErreurCalque(true),
  })

  const ligneMarque = marque
    ?? (nomEntreprise ? `EN-CHECK · ${nomEntreprise}` : 'EN-CHECK · ESPACE COLLABORATEURS')
  const texteTitre = titre
    ?? (nomEntreprise ? `Chargement de ${nomEntreprise}…` : 'Chargement de l’espace collaborateurs…')
  const titreAffiche = dataReady ? (titrePret ?? 'L’espace collaborateurs est prêt') : texteTitre
  const statutAffiche = dataReady
    ? (statutPret ?? 'Tous les collaborateurs et pointages sont synchronisés.')
    : `Étape ${etapeCourante}/${etapes.length} · ${infoEtape.detail}`

  return (
    <section
      className="emp-loading-shell"
      data-theme={darkMode ? 'dark' : 'light'}
      role="status"
      aria-live="polite"
      aria-busy={!dataReady}
      aria-label={legende}
    >
      <div className="emp-loading-card">
        <header className="emp-loading-header">
          <div className="emp-loading-brand">
            <EnCheckBrandMark size={38} loading={!dataReady} />
            <div className="emp-loading-brand-text">
              <span className="emp-loading-eyebrow">{ligneMarque}</span>
              <h1 className="emp-loading-title">{titreAffiche}</h1>
            </div>
          </div>

          <div
            className="emp-loading-badge-pct"
            aria-label={`Progression ${pourcentageReel} pour cent`}
          >
            <span className={`emp-loading-dot${dataReady ? ' is-ready' : ''}`} aria-hidden="true" />
            <span>{pourcentageReel} %</span>
          </div>
        </header>

        {!erreurImage && (
          <div
            className={`emp-loading-stage${scenePrete ? ' is-ready' : ''}${
              dataReady ? ' est-pret' : ''
            }`}
            data-artwork={sceneUnique ? 'page-scene-illustration' : 'approved-queue-illustration'}
            data-step={dataReady ? etapes.length : etapeCourante}
            aria-hidden="true"
          >
            {!sceneUnique && (
            <div className="emp-loading-layers">
              <img {...propsCalque('decor', 'emp-layer-decor')} />
              <div className="emp-queue-movers">
                {[...calques].reverse().map((calque) => {
                  const terminee = dataReady || calque.etape < etapeCourante
                  const enCours = !dataReady && calque.etape === etapeCourante
                  return (
                    <div key={calque.nom} className={`emp-layer-person emp-layer-${calque.nom}`}>
                      <img {...propsCalque(calque.nom, '', calque)} />
                      <span
                        className={`emp-queue-pip emp-queue-pip--${calque.etape}${
                          terminee ? ' is-done' : enCours ? ' is-active' : ''
                        }`}
                      >
                        {terminee ? '✓' : calque.etape}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            )}

            <img
              src={imageScene ?? `${dossierImages}approved.webp`}
              alt=""
              width="1600"
              height="900"
              decoding="async"
              fetchPriority="high"
              draggable={false}
              className={`emp-loading-approved${sceneUnique ? ' is-unique' : ''}`}
              onLoad={() => marquerCharge('approved')}
              onError={() => setErreurImage(true)}
            />

            {!sceneUnique && (
              <>
                <div className="emp-kiosk-screen">
                  <span className="emp-kiosk-scanline" />
                </div>
                <span className="emp-kiosk-glow" />
              </>
            )}
          </div>
        )}

        <div className="emp-loading-body">
          <div className="pointages-loading-bar-track" aria-hidden="true">
            <div className="pointages-loading-bar-fill" style={{ width: `${pourcentageReel}%` }} />
          </div>

          <div className="emp-loading-steps" aria-label="Étapes du chargement">
            {etapes.map((item) => {
              const terminee = dataReady || item.id < etapeCourante
              const enCours = !dataReady && item.id === etapeCourante
              return (
                <div
                  key={item.id}
                  className={`emp-loading-step${terminee ? ' is-done' : enCours ? ' is-active' : ''}`}
                >
                  <span className="emp-loading-step-num" aria-hidden="true">
                    {terminee ? '✓' : item.id}
                  </span>
                  <span>{item.court}</span>
                </div>
              )
            })}
          </div>

          <div className="emp-loading-footer">
            <p className="emp-loading-status">{statutAffiche}</p>
            {onSkip && (
              <button type="button" className="emp-loading-skip" onClick={onSkip}>
                <span>Passer l’animation</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
