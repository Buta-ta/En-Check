// ═══════════════════════════════════════════════════════════
// LA CARTE DE SERVICE — le badge d'un employé
//
// Ce que c'est : un objet imprimé. Il ne suit donc pas le thème
// de la page — il reste sur papier, avec la couleur de
// l'entreprise comme seul accent, et il sort en PNG par
// html2canvas. C'est pourquoi il est dessiné en styles calculés
// ici et non par une feuille de style : ce que l'écran montre
// est exactement ce que le fichier contient.
//
// Ce qu'il porte, et rien de plus :
//   · l'entreprise, son logo, son accent ;
//   · la personne — portrait, nom, poste, département ;
//   · les données de service réellement renseignées
//     (matricule, contrat, date d'entrée) ;
//   · le QR du badge, qui mène au jeton du portail.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, Download, Share2, Check, Loader2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import EnCheckBrandMark from './EnCheckBrandMark'
import { BandeMotif, HAUTEUR_BANDE } from './badge/MotifsBadge'
import { MOTIFS, estMotif } from './badge/motifs'
import './BadgeEmploye.css'

const LARGEUR = 300
const HAUTEUR = 520
const ECHELLE_EXPORT = 3

const PAPIER = [245, 240, 230]
const ENCRE = [28, 20, 13]
const CONTRATS = {
  CDI: 'CDI',
  CDD: 'CDD',
  Stage: 'Stage',
  Interim: 'Intérim',
  Intérim: 'Intérim',
  Apprentissage: 'Apprentissage',
  Freelance: 'Freelance',
}

// ── les teintes proposées, et le réglage retenu ───────────────
// La première entrée suit l'entreprise ; les autres sont des
// accents du registre. Le réglage est rangé par employé, sur cet
// appareil : aucune table n'est modifiée pour un choix d'impression.
const TEINTES = [
  { id: 'entreprise', nom: "Couleur de l'entreprise" },
  { id: '#8f4d1d', nom: 'Cuivre' },
  { id: '#2b6a5f', nom: 'Teal' },
  { id: '#56652a', nom: 'Sauge' },
  { id: '#a2452e', nom: 'Corail' },
  { id: '#5f4560', nom: 'Prune' },
  { id: '#2f3542', nom: 'Nuit' },
  { id: '#b08d2f', nom: 'Or' },
]

const CLE_REGLAGE = (employeeId) => `encheck:carte:${employeeId || 'sans-identifiant'}`

function lireReglage(employeeId) {
  try {
    const brut = window.localStorage.getItem(CLE_REGLAGE(employeeId))
    if (!brut) return null
    const objet = JSON.parse(brut)
    return {
      couleur: typeof objet?.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(objet.couleur) ? objet.couleur : null,
      motif: estMotif(objet?.motif) ? objet.motif : null,
    }
  } catch {
    return null
  }
}

// ── la couleur de l'entreprise : on la lit, on ne l'invente pas ──
function lireCouleur(valeur) {
  const texte = String(valeur || '').trim().replace('#', '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(texte)) return [212, 175, 55]
  const plein = texte.length === 3 ? texte.split('').map((c) => c + c).join('') : texte
  return [0, 2, 4].map((i) => parseInt(plein.slice(i, i + 2), 16))
}

function versHex([r, g, b]) {
  return `#${[r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('')}`
}

function melange(a, b, part) {
  return versHex([0, 1, 2].map((i) => a[i] * (1 - part) + b[i] * part))
}

function luminance([r, g, b]) {
  const lin = [r, g, b].map((n) => {
    const s = n / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function paletteDe(primaryColor) {
  const accent = lireCouleur(primaryColor)
  const clair = luminance(accent) > 0.4
  return {
    accent: versHex(accent),
    surAccent: clair ? '#1c140d' : '#f7f1e6',
    accentTexte: clair ? melange(accent, ENCRE, 0.46) : melange(accent, PAPIER, 0.2),
    accentVoile: melange(accent, PAPIER, 0.87),
    perleA: melange(accent, PAPIER, 0.28),
    perleB: melange(accent, PAPIER, 0.62),
  }
}

// ── les données de service : seulement ce qui est renseigné ──────
function formaterDate(valeur) {
  if (!valeur) return ''
  const date = new Date(`${String(valeur).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function nomCompletDe(employee) {
  return `${employee?.first_name || ''} ${employee?.last_name || ''}`.replace(/\s+/g, ' ').trim()
}

function initialesDe(employee) {
  const lettres = [employee?.first_name, employee?.last_name]
    .map((mot) => (mot ? String(mot).trim()[0] : ''))
    .join('')
    .toUpperCase()
  return lettres || '—'
}

function monogrammeDe(nom) {
  const mots = String(nom || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (mots.length === 0) return 'EC'
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : mots[0].slice(0, 2)).toUpperCase()
}

function lignesDeService(employee) {
  const lignes = []
  if (employee?.matricule) lignes.push(['Matricule', employee.matricule])
  const contrat = CONTRATS[employee?.contract_type] || employee?.contract_type
  if (contrat) lignes.push(['Contrat', contrat])
  const entree = formaterDate(employee?.hire_date)
  if (entree) lignes.push(['Entrée', entree])
  return lignes.slice(0, 3)
}

// ── l'écriture de la carte, calculée une fois par palette ───────
function stylesDe(palette) {
  const hair = 'rgba(60, 40, 22, 0.16)'
  const hairFort = 'rgba(60, 40, 22, 0.3)'
  const serif = "Georgia, 'Times New Roman', serif"

  return {
    carte: {
      position: 'relative',
      display: 'flex',
      width: `${LARGEUR}px`,
      height: `${HAUTEUR}px`,
      flexDirection: 'column',
      overflow: 'hidden',
      border: `1px solid ${hairFort}`,
      borderRadius: '10px',
      background: '#f5f0e6',
      color: '#1c140d',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      boxSizing: 'border-box',
    },

    // le bandeau : la couleur de l'entreprise, et le nom en clair
    bandeau: {
      position: 'relative',
      flex: 'none',
      padding: '12px 15px 16px',
      background: palette.accent,
      color: palette.surAccent,
    },
    rail: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 },
    puce: {
      display: 'flex',
      width: '34px',
      height: '34px',
      flex: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: '1px solid rgba(28, 20, 13, 0.12)',
      borderRadius: '50%',
      background: '#f5f0e6',
    },
    puceImage: { width: '100%', height: '100%', objectFit: 'contain' },
    puceMonogramme: {
      color: palette.accentTexte,
      fontFamily: serif,
      fontSize: '12.5px',
      letterSpacing: '0.02em',
    },
    entreprise: {
      overflow: 'hidden',
      margin: 0,
      color: palette.surAccent,
      fontSize: '12.4px',
      fontWeight: 700,
      letterSpacing: '0.05em',
      lineHeight: 1.2,
      textOverflow: 'ellipsis',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },
    entrepriseSous: {
      margin: '2px 0 0',
      color: palette.surAccent,
      fontSize: '7px',
      letterSpacing: '0.26em',
      opacity: 0.76,
      textTransform: 'uppercase',
    },
    marque: {
      flex: 'none',
      marginLeft: 'auto',
      color: palette.surAccent,
      fontSize: '6.4px',
      letterSpacing: '0.2em',
      opacity: 0.82,
    },
    bandeMotif: {
      flex: 'none',
      overflow: 'hidden',
      lineHeight: 0,
    },

    corps: {
      display: 'flex',
      flex: '1 1 auto',
      minHeight: 0,
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 17px 0',
    },

    portrait: {
      display: 'flex',
      width: '104px',
      height: '104px',
      flex: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: `2px solid ${palette.accent}`,
      borderRadius: '50%',
      background: palette.accentVoile,
      boxShadow: `0 0 0 4px #f5f0e6, 0 0 0 5px ${hair}`,
    },
    portraitImage: { width: '100%', height: '100%', objectFit: 'cover' },
    portraitInitiales: {
      color: palette.accentTexte,
      fontFamily: serif,
      fontSize: '31px',
      letterSpacing: '0.02em',
    },

    nom: {
      maxWidth: '100%',
      overflow: 'hidden',
      margin: '11px 0 0',
      color: '#1c140d',
      fontFamily: serif,
      fontSize: '20px',
      fontWeight: 400,
      letterSpacing: '0.005em',
      lineHeight: 1.15,
      textAlign: 'center',
      textOverflow: 'ellipsis',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },
    poste: {
      margin: '5px 0 0',
      color: palette.accentTexte,
      fontSize: '8px',
      fontWeight: 700,
      letterSpacing: '0.2em',
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    departement: {
      margin: '3px 0 0',
      color: '#6b5c44',
      fontFamily: serif,
      fontSize: '9.4px',
      fontStyle: 'italic',
      textAlign: 'center',
    },

    registre: {
      width: '100%',
      margin: '9px 0 0',
      padding: 0,
      borderTop: `1px solid ${hair}`,
    },
    ligne: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: '10px',
      padding: '4.4px 0',
      borderBottom: `1px solid ${hair}`,
    },
    cle: {
      margin: 0,
      color: '#7a6952',
      fontSize: '7px',
      fontWeight: 800,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
    },
    valeur: {
      overflow: 'hidden',
      margin: 0,
      color: '#42342a',
      fontSize: '9.6px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },

    qrZone: {
      display: 'flex',
      margin: 'auto 0 0',
      paddingTop: '10px',
      flexDirection: 'column',
      alignItems: 'center',
    },
    qrPlaque: {
      position: 'relative',
      padding: '5px',
      border: `1px solid ${hairFort}`,
      background: '#ffffff',
    },
    qrVide: {
      display: 'flex',
      width: '108px',
      height: '108px',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#7a6952',
      fontSize: '7.2px',
      letterSpacing: '0.16em',
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    qrNote: {
      margin: '5px 0 0',
      color: '#7a6952',
      fontSize: '7px',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
    },

    pied: {
      display: 'flex',
      flex: 'none',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      marginTop: '8px',
      padding: '7px 15px 8px',
      borderTop: `1px solid ${hairFort}`,
      background: palette.accentVoile,
    },
    piedMarque: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      color: palette.accentTexte,
      fontSize: '7px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    },
    piedSerie: {
      color: '#6b5c44',
      fontSize: '7.4px',
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '0.16em',
    },
  }
}

// les quatre angles du QR : deux traits, comme un repère de lecture
function AnglesDeQr({ couleur }) {
  const base = { position: 'absolute', width: '9px', height: '9px', borderColor: couleur, borderStyle: 'solid' }
  return (
    <>
      <span aria-hidden="true" style={{ ...base, top: '-1px', left: '-1px', borderWidth: '2px 0 0 2px' }} />
      <span aria-hidden="true" style={{ ...base, top: '-1px', right: '-1px', borderWidth: '2px 2px 0 0' }} />
      <span aria-hidden="true" style={{ ...base, bottom: '-1px', left: '-1px', borderWidth: '0 0 2px 2px' }} />
      <span aria-hidden="true" style={{ ...base, bottom: '-1px', right: '-1px', borderWidth: '0 2px 2px 0' }} />
    </>
  )
}

export default function BadgeEmploye({
  employee,
  entrepriseName,
  entrepriseLogo,
  primaryColor = '#D4AF37',
  onClose,
}) {
  const badgeRef = useRef(null)
  const minuteur = useRef(null)
  const [telechargement, setTelechargement] = useState(false)
  const [succes, setSucces] = useState(false)
  const [partage, setPartage] = useState(false)
  const [message, setMessage] = useState('')

  const couleurEntreprise = primaryColor || '#D4AF37'
  const reglageInitial = useRef(lireReglage(employee?.id))
  // `null` = la carte suit la couleur de l'entreprise ; une valeur =
  // la teinte choisie pour cette personne, retenue sur l'appareil.
  const [couleurChoisie, setCouleurChoisie] = useState(() => reglageInitial.current?.couleur || null)
  const [motif, setMotif] = useState(() => reglageInitial.current?.motif || 'perles')

  const couleur = couleurChoisie || couleurEntreprise
  const choisirCouleur = (valeur) => {
    setCouleurChoisie(String(valeur).toLowerCase() === String(couleurEntreprise).toLowerCase() ? null : valeur)
  }

  const palette = useMemo(() => paletteDe(couleur), [couleur])
  const paletteBande = useMemo(() => ({ ...palette, papier: '#f5f0e6', filets: 'rgba(60, 40, 22, 0.16)' }), [palette])
  const s = useMemo(() => stylesDe(palette), [palette])

  const nom = nomCompletDe(employee) || 'Nom à compléter'
  const nomEntreprise = String(entrepriseName || 'En-Check').trim() || 'En-Check'
  const lignes = useMemo(() => lignesDeService(employee), [employee])
  const qrValeur = employee?.qr_token || employee?.matricule || ''
  const tailleNom = nom.length > 24 ? 15.5 : nom.length > 18 ? 17.5 : 20
  const reference = employee?.matricule ? `N° ${employee.matricule}` : 'Carte nominative'

  // le choix est retenu sur cet appareil, par employé
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_REGLAGE(employee?.id), JSON.stringify({ couleur: couleurChoisie, motif }))
    } catch {
      // stockage refusé : la carte reste utilisable, le choix ne survit pas
    }
  }, [couleurChoisie, motif, employee?.id])

  const reglageModifie = Boolean(couleurChoisie) || motif !== 'perles'
  const revenirAlOrigine = () => {
    setCouleurChoisie(null)
    setMotif('perles')
  }

  // la fenêtre se ferme à Échap, et le fond ne défile plus dessous
  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onClose?.()
    }
    const ancienDebordement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancienDebordement
      if (minuteur.current) clearTimeout(minuteur.current)
    }
  }, [onClose])

  const capturer = useCallback(async () => {
    if (!badgeRef.current) throw new Error('badge absent')
    return html2canvas(badgeRef.current, {
      scale: ECHELLE_EXPORT,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      logging: false,
    })
  }, [])

  const nomFichier = `badge-${(employee?.matricule || nom).toString().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.png`

  const telecharger = useCallback(async () => {
    if (telechargement || partage) return
    setTelechargement(true)
    setMessage('')
    try {
      const canvas = await capturer()
      const lien = document.createElement('a')
      lien.download = nomFichier
      lien.href = canvas.toDataURL('image/png', 1.0)
      lien.click()
      setSucces(true)
      if (minuteur.current) clearTimeout(minuteur.current)
      minuteur.current = setTimeout(() => setSucces(false), 2400)
    } catch {
      setMessage('Le fichier n’a pas pu être généré. Réessayez dans un instant.')
    } finally {
      setTelechargement(false)
    }
  }, [capturer, nomFichier, partage, telechargement])

  const partager = useCallback(async () => {
    if (telechargement || partage) return
    setPartage(true)
    setMessage('')
    try {
      const canvas = await capturer()
      const blob = await new Promise((resoudre) => canvas.toBlob(resoudre, 'image/png', 1.0))
      if (!blob) throw new Error('blob absent')
      const fichier = new File([blob], nomFichier, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [fichier] })) {
        try {
          await navigator.share({ title: `Carte de service — ${nom}`, files: [fichier] })
        } catch (erreur) {
          if (erreur?.name !== 'AbortError') throw erreur
        }
      } else {
        const lien = document.createElement('a')
        lien.download = nomFichier
        lien.href = URL.createObjectURL(fichier)
        lien.click()
        URL.revokeObjectURL(lien.href)
        setMessage('Le partage direct n’est pas disponible ici : la carte a été téléchargée.')
      }
    } catch {
      setMessage('Le partage n’a pas abouti. La carte peut être téléchargée.')
    } finally {
      setPartage(false)
    }
  }, [capturer, nom, nomFichier, partage, telechargement])

  return (
    <div
      className="bge-voile"
      role="presentation"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onClose?.()
      }}
    >
      <div className="bge-fenetre" role="dialog" aria-modal="true" aria-labelledby="bge-titre">
        <header className="bge-entete">
          <div style={{ minWidth: 0 }}>
            <p className="bge-eyebrow">Badge employé</p>
            <h2 className="bge-titre" id="bge-titre">Carte de service</h2>
            <p className="bge-sous-titre">{nom}</p>
          </div>
          <button type="button" className="bge-fermer" onClick={onClose} aria-label="Fermer le badge">
            <X size={15} />
          </button>
        </header>

        <div className="bge-corps">
          <div className="bge-apercu">
          <div className="bge-echelle">
            <div ref={badgeRef} style={s.carte} data-testid="badge-carte">
              {/* ── l'entreprise ── */}
              <header style={s.bandeau}>
                <div style={s.rail}>
                  <span style={s.puce}>
                    {entrepriseLogo ? (
                      <img
                        src={entrepriseLogo}
                        alt=""
                        crossOrigin="anonymous"
                        style={s.puceImage}
                      />
                    ) : (
                      <span style={s.puceMonogramme}>{monogrammeDe(nomEntreprise)}</span>
                    )}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={s.entreprise}>{nomEntreprise}</p>
                    <p style={s.entrepriseSous}>Carte de service</p>
                  </div>
                  <span style={s.marque}>EN-CHECK</span>
                </div>
              </header>

              {/* la bande tissée : le motif choisi, à la couleur de la carte */}
              <div style={s.bandeMotif} data-motif={motif} data-testid="badge-bande">
                <BandeMotif motif={motif} palette={paletteBande} hauteur={HAUTEUR_BANDE} />
              </div>

              {/* ── la personne ── */}
              <div style={s.corps}>
                <div style={s.portrait}>
                  {employee?.photo_url ? (
                    <img
                      src={employee.photo_url}
                      alt=""
                      crossOrigin="anonymous"
                      style={s.portraitImage}
                    />
                  ) : (
                    <span style={s.portraitInitiales}>{initialesDe(employee)}</span>
                  )}
                </div>

                <h3 style={{ ...s.nom, fontSize: `${tailleNom}px` }}>{nom}</h3>

                {employee?.position && <p style={s.poste}>{employee.position}</p>}
                {employee?.department && <p style={s.departement}>{employee.department}</p>}

                {lignes.length > 0 && (
                  <dl style={s.registre}>
                    {lignes.map(([cle, valeur]) => (
                      <div key={cle} style={s.ligne}>
                        <dt style={s.cle}>{cle}</dt>
                        <dd style={s.valeur}>{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div style={s.qrZone}>
                  <div style={s.qrPlaque}>
                    {qrValeur ? (
                      <QRCodeSVG
                        value={qrValeur}
                        size={108}
                        level="H"
                        fgColor="#1c140d"
                        bgColor="#ffffff"
                      />
                    ) : (
                      <span style={s.qrVide}>QR à générer</span>
                    )}
                    <AnglesDeQr couleur={palette.accent} />
                  </div>
                  <p style={s.qrNote}>Scannez pour pointer</p>
                </div>
              </div>

              {/* ── la maison ── */}
              <footer style={s.pied}>
                <span style={s.piedMarque}>
                  <EnCheckBrandMark size={12} />
                  En-Check · On gère !
                </span>
                <span style={s.piedSerie}>{reference}</span>
              </footer>
            </div>
          </div>
        </div>

            <aside className="bge-reglages" aria-label="Personnalisation de la carte">
              <section className="bge-section">
                <h3 className="bge-section-titre">Couleur</h3>
                <div className="bge-teintes" role="group" aria-label="Couleur de la carte">
                  {TEINTES.map((teinte) => {
                    const valeur = teinte.id === 'entreprise' ? couleurEntreprise : teinte.id
                    const active = valeur.toLowerCase() === couleur.toLowerCase()
                    return (
                      <button
                        key={teinte.id}
                        type="button"
                        className="bge-teinte"
                        data-actif={active ? 'oui' : undefined}
                        style={{ '--teinte': valeur }}
                        aria-label={teinte.nom}
                        aria-pressed={active}
                        title={teinte.nom}
                        onClick={() => choisirCouleur(valeur)}
                      >
                        <span className="bge-teinte-point" />
                      </button>
                    )
                  })}
                  <label className="bge-teinte bge-teinte--libre" title="Autre couleur">
                    <input
                      type="color"
                      value={couleur}
                      aria-label="Choisir une autre couleur"
                      onChange={(evenement) => choisirCouleur(evenement.target.value)}
                    />
                    <span className="bge-teinte-point" />
                  </label>
                </div>
              </section>

              <section className="bge-section">
                <h3 className="bge-section-titre">Motif culturel</h3>
                <div className="bge-motifs" role="group" aria-label="Motif culturel de la carte">
                  {MOTIFS.map((choix) => (
                    <button
                      key={choix.id}
                      type="button"
                      className="bge-motif"
                      data-motif-choix={choix.id}
                      aria-pressed={motif === choix.id}
                      title={choix.detail}
                      onClick={() => setMotif(choix.id)}
                    >
                      <span className="bge-motif-vignette">
                        <BandeMotif motif={choix.id} palette={paletteBande} hauteur={22} />
                      </span>
                      <span className="bge-motif-nom">{choix.nom}</span>
                    </button>
                  ))}
                </div>
                <p className="bge-aide">Le choix est conservé sur cet appareil.</p>
                {reglageModifie && (
                  <button type="button" className="bge-lien" onClick={revenirAlOrigine}>
                    Revenir à la carte d’origine
                  </button>
                )}
              </section>
            </aside>
        </div>

        <div className="bge-actions">
          <button
            type="button"
            className="bge-bouton bge-bouton--second"
            onClick={partager}
            disabled={telechargement || partage}
          >
            {partage ? <Loader2 size={15} className="bge-tourne" /> : <Share2 size={15} />}
            Partager
          </button>
          <button
            type="button"
            className="bge-bouton bge-bouton--principal"
            onClick={telecharger}
            disabled={telechargement || partage}
          >
            {telechargement ? (
              <Loader2 size={15} className="bge-tourne" />
            ) : succes ? (
              <Check size={15} />
            ) : (
              <Download size={15} />
            )}
            {telechargement ? 'Génération…' : succes ? 'Téléchargé' : 'Télécharger'}
          </button>
        </div>

        <p className="bge-note">
          PNG · {LARGEUR * ECHELLE_EXPORT} × {HAUTEUR * ECHELLE_EXPORT} px · fond transparent
        </p>
        {message && (
          <p className="bge-alerte" role="alert">{message}</p>
        )}
      </div>
    </div>
  )
}
