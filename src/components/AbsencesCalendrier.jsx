// ═══════════════════════════════════════════════════════════
// 🗓️ CALENDRIER DES ABSENCES — VUE « PLANNING »
//
// Trois modes : JOUR · SEMAINE · MOIS.
// Les employés sont en lignes, les jours en colonnes, et chaque
// absence devient une barre positionnée sur sa période.
// Un clic ouvre le tiroir de détail (AbsenceTiroir).
//
// Ce composant ne lit rien de Supabase et ne supprime rien : il
// reçoit des données et appelle des callbacks fournis par la page.
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, CalendarOff, Users, CalendarDays, CalendarSearch } from 'lucide-react'
import { styleBarreAbsence, DATA_TRANSFER_MOTIF } from '../constants/motifsAbsence'
import { ecartEnMois } from '../services/absencesCalendrier'
import ChoixPeriode from './ChoixPeriode'
import {
  JOURS_SEMAINE,
  joursDeLaPeriode,
  deplacerPeriode,
  parseIso,
  isoLocal,
  nomMois,
  titrePeriode,
  nomJourLong,
  segmentSurJours,
  empilerSegments,
  compterJoursOuvres,
  formaterDateCourt,
} from '../services/absencesCalendrier'
import AbsenceTiroir from './AbsenceTiroir'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'

const LARGEUR_EMPLOYE = 236
const LARGEUR_JOUR_MOIS = 36
const LARGEUR_JOUR_SEMAINE = 108
const LARGEUR_JOUR_UNIQUE = 460

const MODES = [
  { id: 'jour', label: 'Jour' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'mois', label: 'Mois' },
]

const pad2 = (n) => String(n).padStart(2, '0')

const initialesDe = (prenom, nom) =>
  `${prenom || ''} ${nom || ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

const largeurJourDe = (mode) =>
  (mode === 'jour' ? LARGEUR_JOUR_UNIQUE : mode === 'semaine' ? LARGEUR_JOUR_SEMAINE : LARGEUR_JOUR_MOIS)

export default function AbsencesCalendrier({
  absences = [],
  employes = [],
  darkMode = true,
  annee,
  mois,
  onChangerMois,
  mode: modeControle,
  onChangerMode,
  jourInitial,
  getHolidaySet = () => new Set(),
  joursPrisParEmploye = {},
  plafondConges = 30,
  conflitParAbsence = {},
  onModifier,
  onChangerStatut,
  onVoirDocument,
  onSupprimer,
  onDeclarer,
  onDeposerMotif,
}) {
  const { motifs, motifPour } = useMotifsAbsence()
  // Chaque barre prend le motif de SON absence : en vue « toutes entreprises »
  // deux sociétés peuvent avoir personnalisé le même code différemment
  const listePour = (a) => {
    const m = motifPour(a)
    return m ? [m] : motifs
  }
  // Filtre en creux : rien de masqué par défaut, un motif créé ensuite est visible aussitôt
  const [motifsMasques, setMotifsMasques] = useState(() => new Set())
  const [masquerSansAbsence, setMasquerSansAbsence] = useState(false)
  const [absenceActive, setAbsenceActive] = useState(null)
  // La pince qu'on est en train de porter : elle se décolle du bois, pas du fil
  const [motifGlissé, setMotifGlissé] = useState(null)
  // Cellule survolée pendant un glisser-déposer : { employeeId, index }
  const [survol, setSurvol] = useState(null)
  const [modeInterne, setModeInterne] = useState('semaine') // la semaine est la vue par défaut
  const [jourVise, setJourVise] = useState(() => jourInitial || isoLocal(new Date()))

  const mode = modeControle || modeInterne
  const changerMode = (id) => {
    if (!modeControle) setModeInterne(id)
    onChangerMode?.(id)
  }

  const theme = {
    carte: darkMode ? '#1D1713' : '#FFFFFF',
    fond: darkMode ? '#15110E' : '#FAF6EE',
    texte: darkMode ? '#F5F2EB' : '#1D1713',
    texteDoux: darkMode ? '#d6c7b7' : '#4E3D2E',
    bordure: darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(29,23,19,0.12)',
    grille: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(29,23,19,0.06)',
    weekend: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(29,23,19,0.045)',
    ferie: darkMode ? 'rgba(139,92,246,0.13)' : 'rgba(139,92,246,0.10)',
    pastille: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(29,23,19,0.04)',
    ambre: darkMode ? '#F59E0B' : '#9C5321',
  }

  // ── Le jour visé reste toujours dans le mois affiché ────────────────
  const jourSel = useMemo(() => {
    const p = parseIso(jourVise)
    if (p && p.y === annee && p.m === mois) return jourVise
    const aujourdhui = isoLocal(new Date())
    const pa = parseIso(aujourdhui)
    if (pa && pa.y === annee && pa.m === mois) return aujourdhui
    return `${annee}-${pad2(mois + 1)}-01`
  }, [jourVise, annee, mois])

  const jours = useMemo(
    () => joursDeLaPeriode(mode, { annee, mois, jourIso: jourSel }),
    [mode, annee, mois, jourSel]
  )
  const nbJours = jours.length
  const largeurJour = largeurJourDe(mode)
  const aujourdhuiIso = isoLocal(new Date())
  const indexAujourdhui = jours.findIndex((j) => j.iso === aujourdhuiIso)
  const titre = mode === 'mois' ? nomMois(annee, mois) : titrePeriode(mode, jours, { annee, mois })

  const deplacer = (delta) => {
    const suivant = deplacerPeriode(mode, { annee, mois, jourIso: jourSel }, delta)
    if (mode === 'mois') onChangerMois?.(delta)
    else setJourVise(suivant.jourIso)
  }

  // ── Aller à une date précise (clic sur le titre de la période) ──────
  const [choixDate, setChoixDate] = useState(false)

  const fermerChoix = () => setChoixDate(false)

  /** Saute directement à la date choisie, quelle que soit l'année */
  const allerA = (iso) => {
    if (!iso) return
    const ecart = ecartEnMois(annee, mois, iso)
    if (ecart !== 0) onChangerMois?.(ecart)
    setJourVise(iso)
    fermerChoix()
  }

  // ── Construction des lignes : un employé = une ligne ────────────────
  const lignes = useMemo(() => {
    const parEmploye = new Map()
    employes.forEach((e) => parEmploye.set(e.id, { employe: e, segments: [] }))

    absences.forEach((a) => {
      const motifId = a.reason || 'autre'
      if (motifsMasques.has(motifId)) return
      const seg = segmentSurJours(a.start_date, a.end_date, jours)
      if (!seg) return
      const ligne = parEmploye.get(a.employee_id)
      if (!ligne) return // employé inactif ou hors périmètre : ignoré
      ligne.segments.push({ ...seg, absence: a })
    })

    return [...parEmploye.values()]
      .map((l) => ({ ...l, segments: empilerSegments(l.segments) }))
      .filter((l) => !masquerSansAbsence || l.segments.length > 0)
      .sort((a, b) =>
        `${a.employe.last_name || ''} ${a.employe.first_name || ''}`.localeCompare(
          `${b.employe.last_name || ''} ${b.employe.first_name || ''}`,
          'fr'
        )
      )
  }, [employes, absences, jours, motifsMasques, masquerSansAbsence])

  // ── Récapitulatif de la période affichée ────────────────────────────
  const stats = useMemo(() => {
    const vus = new Map()
    let journees = 0

    lignes.forEach((l) => {
      const feriers = getHolidaySet(l.employe.enterprise_id)
      l.segments.forEach((seg) => {
        const a = seg.absence
        if (!vus.has(a.id)) vus.set(a.id, a)
        journees += compterJoursOuvres(jours[seg.debut].iso, jours[seg.fin].iso, feriers, a.count_holidays_as_leave)
      })
    })

    const liste = [...vus.values()]
    return {
      total: liste.length,
      enAttente: liste.filter((a) => a.status === 'en_attente').length,
      refusees: liste.filter((a) => a.status === 'refuse').length,
      journees,
    }
  }, [lignes, jours, getHolidaySet])

  // ── Mode « jour » : qui est absent, qui est là ──────────────────────
  const absentsDuJour = useMemo(() => {
    if (mode !== 'jour') return []
    return lignes
      .filter((l) => l.segments.length > 0)
      .map((l) => ({
        employe: l.employe,
        absences: l.segments.map((s) => s.absence),
      }))
  }, [mode, lignes])

  const presentsDuJour = useMemo(
    () => (mode === 'jour' ? lignes.filter((l) => l.segments.length === 0).map((l) => l.employe) : []),
    [mode, lignes]
  )

  // ── un cas par motif sur la période affichée ─────────────────────────
  // La même géométrie que `lignes` : mêmes jours, mêmes employés du
  // périmètre, même `segmentSurJours`. Mais SANS le filtre des pinces —
  // une étiquette éteinte doit dire ce qu'on rate.
  const comptes = useMemo(() => {
    const vus = new Set(employes.map((e) => e.id))
    const par = {}
    absences.forEach((a) => {
      if (!vus.has(a.employee_id)) return
      if (!segmentSurJours(a.start_date, a.end_date, jours)) return
      const cle = a.reason || 'autre'
      par[cle] = (par[cle] || 0) + 1
    })
    return par
  }, [absences, employes, jours])

  const basculerMotif = (id) => {
    setMotifsMasques((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  const soldeDe = (employeeId) => {
    const pris = joursPrisParEmploye[employeeId] ?? 0
    const plafond = plafondConges || 30
    return { pris, plafond, restant: Math.max(0, plafond - pris) }
  }

  const libellePeriode =
    mode === 'jour' ? "cette journée" : mode === 'semaine' ? 'cette semaine' : 'ce mois'

  // ── Rendu ───────────────────────────────────────────────────────────
  return (
    <div className="abs-cal" data-theme={darkMode ? 'dark' : 'light'} data-mode={mode}>
      <style>{`
        .abs-cal-scroll::-webkit-scrollbar { height: 10px; }
        .abs-cal-scroll::-webkit-scrollbar-thumb { background: rgba(245,158,11,.28); border-radius: 8px; }
        .abs-cal-barre:hover { filter: brightness(1.15); }
        .abs-cal-barre:focus-visible { outline: 2px solid #F59E0B; outline-offset: 1px; }
      `}</style>

      {/* ═══ LA TRINGLE — maquette `maquettes/absences-outils-1-rideau.png` (9/12) ═══
          Une tringle de 10 px, pleine de bout en bout, et tout pend dessus : la
          planche de la période, le registre des trois modes, les sept pinces à
          motif, les billets suspendus plus bas.

          Ce qui tombe : les trois lignes de pastilles — la période, les modes,
          les motifs — qui consommaient cent cinquante pixels avant la première
          information, et le bouton « Tous les motifs », qui répétait ce qu'une
          pince fait déjà (ôter la pince = éteindre le motif). Rien n'est perdu :
          « Masquer les employés sans absence » est devenu un billet, et
          « Réallumer tout » n'existe que quand il y a quelque chose à rallumer —
          un bouton qui ne sert à rien ne s'accroche nulle part.

          Le bois se peint par TRONÇON sur chaque pièce, et le tronçon déborde de
          la moitié de l'écart : soudés de l'un à l'autre bout, ils font un trait
          continu ; et le rang qui tombe à l'écran à 390 px reçoit sa propre
          tringle, comme les planches de l'étagère reçoivent la leur.

          Le titre de la période reste la phrase du service (`titrePeriode`) : la
          maquette écrivait « LUN 23 → DIM 29 », une flèche de plus n'est pas une
          donnée. Les capitales et la chasse sont du CSS, pas du texte. */}
      <div className="abs-tringle" data-testid="abs-cal-tringle">
        {/* L'action de la section, seule, à droite et au-dessus du bois. */}
        {onDeclarer && (
          <div className="abs-tringle-bande">
            <button type="button" onClick={onDeclarer} className="abs-tringle-declarer" data-testid="abs-cal-declarer">
              <Plus size={15} /> Déclarer une absence
            </button>
          </div>
        )}

        <div className="abs-tringle-rangee">
          {/* ── la planche de la période : deux anneaux, deux clous, et le titre s'ouvre ── */}
          <div className="abs-tringle-piece abs-tringle-piece--plaque">
            <span className="abs-tringle-bois" aria-hidden="true" />
            <span className="abs-tringle-suspentes" aria-hidden="true"><i /><i /></span>
            <div className="abs-tringle-nav">
              <button type="button" onClick={() => deplacer(-1)} aria-label="Période précédente" className="abs-tringle-clou">
                <ChevronLeft size={17} />
              </button>
              <span className="abs-tringle-plaque-boite">
                <button
                  type="button"
                  onClick={() => setChoixDate((v) => !v)}
                  aria-expanded={choixDate}
                  aria-haspopup="dialog"
                  title="Choisir une date, un mois ou une année"
                  data-testid="abs-cal-titre"
                  className={`abs-tringle-plaque${choixDate ? ' est-ouvert' : ''}`}
                >
                  {titre}
                  <ChevronDown size={15} className="abs-tringle-chevron" data-ouvert={choixDate ? 'vrai' : 'faux'} />
                </button>
                <ChoixPeriode
                  ouvert={choixDate}
                  onFermer={fermerChoix}
                  jourSel={jourSel}
                  annee={annee}
                  onAllerA={allerA}
                />
              </span>
              <button type="button" onClick={() => deplacer(1)} aria-label="Période suivante" className="abs-tringle-clou">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* ── le registre des modes, sur un seul anneau ── */}
          <div className="abs-tringle-piece">
            <span className="abs-tringle-bois" aria-hidden="true" />
            <span className="abs-tringle-suspentes est-un" aria-hidden="true"><i /></span>
            <div
              role="group"
              aria-label="Mode d'affichage du calendrier"
              data-testid="abs-cal-modes"
              className="abs-tringle-registre"
            >
              {MODES.map((m) => {
                const actif = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => changerMode(m.id)}
                    aria-pressed={actif}
                    data-testid={`abs-cal-mode-${m.id}`}
                    className={`abs-tringle-mode${actif ? ' est-actif' : ''}`}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── les billets : une ficelle de plus, ils pendent sous la tringle ── */}
          <div className="abs-tringle-piece abs-tringle-piece--billets">
            <span className="abs-tringle-bois" aria-hidden="true" />
            <span className="abs-tringle-billets">
              <button
                type="button"
                onClick={() => allerA(aujourdhuiIso)}
                data-testid="abs-cal-aujourdhui"
                title="Revenir à la période en cours"
                className="abs-tringle-billet"
              >
                Aujourd’hui
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={masquerSansAbsence}
                aria-label="Masquer les employés sans absence"
                title="Retirer de la grille les lignes sans absence sur la période"
                onClick={() => setMasquerSansAbsence((v) => !v)}
                data-testid="abs-cal-masquer-sans-absence"
                className={`abs-tringle-billet${masquerSansAbsence ? ' est-actif' : ''}`}
              >
                <span className="abs-tringle-detente" aria-hidden="true" />
                Masquer sans absence
              </button>
              {motifsMasques.size > 0 && (
                <button
                  type="button"
                  onClick={() => setMotifsMasques(new Set())}
                  data-testid="abs-cal-tous-motifs"
                  className="abs-tringle-billet est-reprise"
                >
                  Réallumer {motifsMasques.size} motif{motifsMasques.size > 1 ? 's' : ''}
                </button>
              )}
            </span>
          </div>

          {/* ── les sept pinces : une étiquette par motif, et le nombre de cas
              de la période dessous. Le compte ne suit PAS le masque : une pince
              ôtée doit montrer ce qu'on rate, sinon « éteint » vaut « zéro » et
              plus personne ne rallume en confiance.

              LES PINCE ONT REÇU LE MÉTIER DU DOCK (9/12, « enlève cette section,
              les étiquettes sur étagères peuvent jouer aussi cette fonction ») :
              une pince se glisse sur la ligne d'un employé et le jour sous le
              pointeur préremplit la fiche — c'est `onDeposerMotif`, la même
              menuiserie que le dock du Planning sur sa planche de modèles. Le CLIC, lui, garde
              un seul métier : éteindre le motif. Deux gestes sur un seul objet,
              deux gestes différents — la leçon de la case du Planning, qui
              ouvrait déjà une fenêtre avant qu'on veuille y poser un bouton.
              Au clavier et au doigt, où le glisser n'existe pas, la porte est le
              formulaire : son sélecteur de motif est là (ligne 292). ── */}
          <span className="abs-tringle-pinces">
            {motifs.map((m) => {
              const actif = !motifsMasques.has(m.id)
              const nb = comptes[m.id] ?? 0
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => basculerMotif(m.id)}
                  aria-pressed={actif}
                  data-motif={m.id}
                  data-pince={actif ? 'en-place' : 'otée'}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DATA_TRANSFER_MOTIF, m.id)
                    e.dataTransfer.setData('text/plain', m.id) // repli navigateur
                    e.dataTransfer.effectAllowed = 'copy'
                    setMotifGlissé(m.id)
                  }}
                  onDragEnd={() => setMotifGlissé(null)}
                  title={actif
                    ? `${m.label} · ${nb} absence${nb > 1 ? 's' : ''} sur la période — glisser sur une ligne pour déclarer, cliquer pour éteindre`
                    : `${m.label} · éteint — cliquer pour le rallumer`}
                  className={`abs-pince${actif ? '' : ' est-eteint'}${motifGlissé === m.id ? ' est-glissée' : ''}`}
                >
                  <span className="abs-pince-bois" aria-hidden="true" />
                  <span className="abs-pince-etiquette">
                    <span className="abs-pince-emoji" aria-hidden="true">{m.emoji}</span>
                    <span className="abs-pince-nom">{m.label}</span>
                    <span className="abs-pince-nombre">{nb}</span>
                  </span>
                  <span className="abs-pince-barre" aria-hidden="true" />
                </button>
              )
            })}
          </span>
        </div>

        {/* LA NOTE, une ligne : le dock partait avec son « Comment déclarer une
            absence ? », la phrase reste — c'est elle qui explique la pince. */}
        <details className="abs-tringle-note">
          <summary>Comment déclarer une absence ?</summary>
          <p>
            Glisse une pince sur la ligne d’un employé : l’absence s’ouvre pré-remplie
            au jour visé. Un clic sur une pince éteint le motif, il ne déclare rien.
          </p>
        </details>
      </div>

      {/* ═══ Grille ═══ */}
      <div className="abs-cal-scroll" style={{
        overflowX: 'auto', border: `1px solid ${theme.bordure}`,
        borderRadius: 16, background: theme.carte,
      }}>
        <div style={{ minWidth: LARGEUR_EMPLOYE + nbJours * largeurJour }}>

          {/* Entête des jours */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${theme.bordure}` }}>
            <div style={{
              width: LARGEUR_EMPLOYE, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3,
              background: theme.carte, padding: '10px 14px',
              fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.texteDoux,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Users size={13} /> Employé · {lignes.length}
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              {jours.map((j) => {
                const estAujourdhui = j.iso === aujourdhuiIso
                return (
                  <div key={j.iso} data-jour={j.iso} style={{
                    flex: 1, minWidth: 0, textAlign: 'center', padding: '7px 0 6px',
                    background: estAujourdhui ? 'rgba(245,158,11,0.10)' : 'transparent',
                    borderLeft: `1px solid ${theme.grille}`,
                  }}>
                    <div style={{ fontSize: 10, color: theme.texteDoux, textTransform: 'uppercase' }}>
                      {mode === 'jour' ? nomJourLong(j.iso).split(' ')[0] : JOURS_SEMAINE[j.weekday - 1]}
                    </div>
                    <div style={{
                      fontSize: mode === 'mois' ? 13 : 15,
                      fontWeight: estAujourdhui ? 800 : 600,
                      color: estAujourdhui ? 'var(--abs-amber)' : theme.texte,
                    }}>
                      {j.jour}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lignes employés — UNE CORDE PAR EMPLOYÉ
              (maquette `maquettes/absences-grille-1-corde.png`, retenue le 10/12 :
              « je choisis le 1… je veux absolument avoir ce rendu »).

              Ce que la grille ne disait pas : elle répondait « qui est là ? » par
              l'ABSENCE de marque. Une case vide, un dimanche et un férié se
              ressemblaient tous, et quatorze lignes de 78 px ne montraient rien
              du tout. Ici le trait est la preuve : un anneau par jour — creux si
              l'entreprise travaille ce jour-là, plein si c'est chômé — et la
              planche d'absence pend au jour de son départ, sur SA corde.

              Le métier est intact, seul le dessin change : `segmentSurJours`
              positionne en pourcentage de la période, `empilerSegments` empile les
              chevauchements en rangs, `styleBarreAbsence` garde sa loi (la couleur
              dit le motif, le trait dit le statut), le clic ouvre le tiroir, et la
              pince de la tringle se dépose au jour sous le pointeur. Les deux
              nombres de hauteur ne sont plus ici : ils vivent dans la feuille, une
              seule fois — un nombre écrit deux fois se contredit à la première
              retouche. */}
          {lignes.map((ligne) => {
            const feriers = getHolidaySet(ligne.employe.enterprise_id)
            const nbRangees = ligne.segments.reduce((max, s) => Math.max(max, s.rangeesTotal || 1), 1)
            const solde = soldeDe(ligne.employe.id)
            const plein = solde.plafond > 0 ? Math.round((solde.restant / solde.plafond) * 100) : 0

            return (
              <div
                key={ligne.employe.id}
                className="abs-corde-ligne"
                data-testid="abs-corde-ligne"
                data-employe={ligne.employe.id}
                style={{ '--abs-corde-rangs': nbRangees }}
              >
                <div className="abs-corde-tete" style={{ width: LARGEUR_EMPLOYE, background: theme.carte }}>
                  {ligne.employe.photo_url ? (
                    <img className="abs-corde-figure" src={ligne.employe.photo_url} alt="" />
                  ) : (
                    <span className="abs-corde-figure" aria-hidden="true">
                      {initialesDe(ligne.employe.first_name, ligne.employe.last_name)}
                    </span>
                  )}
                  <span className="abs-corde-nom">
                    {ligne.employe.first_name} {ligne.employe.last_name}
                  </span>
                </div>

                {/* LA PISTE — la corde, les anneaux, les planches. Elle est aussi
                    la zone de dépôt : c'était déjà `data-drop-lane`. */}
                <div
                  className="abs-corde-piste"
                  data-drop-lane={ligne.employe.id}
                  onDragOver={(e) => {
                    if (!onDeposerMotif) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                    const rect = e.currentTarget.getBoundingClientRect()
                    const index = jourDepuisX(e.clientX, rect, nbJours)
                    if (!survol || survol.employeeId !== ligne.employe.id || survol.index !== index) {
                      setSurvol({ employeeId: ligne.employe.id, index })
                    }
                  }}
                  onDragLeave={() => setSurvol(null)}
                  onDrop={(e) => {
                    if (!onDeposerMotif) return
                    e.preventDefault()
                    const motifId = e.dataTransfer.getData(DATA_TRANSFER_MOTIF) || e.dataTransfer.getData('text/plain')
                    const rect = e.currentTarget.getBoundingClientRect()
                    const index = jourDepuisX(e.clientX, rect, nbJours)
                    setSurvol(null)
                    if (motifId) onDeposerMotif({ employeeId: ligne.employe.id, dateIso: jours[index].iso, motifId })
                  }}
                >
                  <span className="abs-corde-fil" aria-hidden="true" />
                  <span className="abs-corde-anneaux" aria-hidden="true">
                    {jours.map((j) => {
                      const chômé = feriers.has(j.iso) || j.weekend
                      // Le mot est sur l'anneau, en survol : un férié d'entreprise
                      // et un dimanche ont la MÊME pastille (le dessin choisi ne
                      // distinguait pas les deux) mais ils n'ont pas la même
                      // raison, et la raison doit être lisible. `aria-hidden` en
                      // haut du rang : trente et un anneaux annoncés à un
                      // lecteur d'écran seraient du bruit, les mots sont déjà
                      // sur les planches et dans le tiroir.
                      return (
                        <i
                          key={j.iso}
                          data-anneau={chômé ? 'chômé' : 'travaillé'}
                          title={`${nomJourLong(j.iso)} · ${
                            chômé ? (feriers.has(j.iso) ? 'chômé (férié de l’entreprise)' : 'chômé (week-end)') : 'travaillé'
                          }`}
                        />
                      )
                    })}
                  </span>

                  {/* Repère « aujourd'hui » : le trait rouille qui traverse la pile */}
                  {indexAujourdhui >= 0 && (
                    <span
                      className="abs-corde-aujourdhui"
                      data-testid="abs-corde-aujourdhui"
                      aria-hidden="true"
                      style={{ left: `${((indexAujourdhui + 0.5) / nbJours) * 100}%` }}
                    />
                  )}

                  {/* Le jour visé pendant un glisser-déposer */}
                  {survol && survol.employeeId === ligne.employe.id && (
                    <div
                      className="abs-drop-cell"
                      data-testid="abs-drop-cell"
                      aria-hidden="true"
                      style={{
                        left: `calc(${(survol.index / nbJours) * 100}% + 1px)`,
                        width: `calc(${(1 / nbJours) * 100}% - 2px)`,
                      }}
                    />
                  )}

                  {/* LES PLANCHES */}
                  {ligne.segments.map((seg) => {
                    const st = styleBarreAbsence(seg.absence, listePour(seg.absence))
                    const a = seg.absence
                    const titrePlanche = [
                      st.motif.label,
                      `${ligne.employe.first_name} ${ligne.employe.last_name}`,
                      `du ${formaterDateCourt(a.start_date)} au ${formaterDateCourt(a.end_date)}`,
                      st.statut.label,
                    ].join(' · ')
                    const coupee = seg.coupeeAvant || seg.coupeeApres
                    const joursComptés = compterJoursOuvres(
                      a.start_date,
                      a.end_date,
                      feriers,
                      a.count_holidays_as_leave
                    )

                    return (
                      <button
                        key={a.id}
                        className="abs-cal-barre abs-corde-planche"
                        onClick={() => setAbsenceActive(a)}
                        title={titrePlanche}
                        aria-label={titrePlanche}
                        data-testid="abs-cal-barre"
                        data-statut={a.status}
                        style={{
                          left: `calc(${(seg.debut / nbJours) * 100}% + 2px)`,
                          width: `calc(${((seg.fin - seg.debut + 1) / nbJours) * 100}% - 4px)`,
                          '--abs-corde-rang': seg.rangee,
                          background: st.fond,
                          borderColor: st.bordure,
                          borderStyle: st.pointillee ? 'dashed' : 'solid',
                          color: theme.texte,
                          textDecoration: st.barree ? 'line-through' : 'none',
                        }}
                      >
                        {/* la ficelle qui retient la planche à sa corde : sans elle,
                            on a une étiquette posée, pas une absence accrochée */}
                        <span className="abs-corde-attache" aria-hidden="true" />
                        {/* le nœud sur la corde, quand la pointeuse conteste ce jour */}
                        {conflitParAbsence[a.id]?.status === 'pending' && (
                          <span className="abs-corde-noeud" aria-hidden="true" />
                        )}
                        <span className="abs-corde-marque" aria-hidden="true">{st.motif.emoji}</span>
                        <span className="abs-corde-motif">{st.motif.label}</span>
                        <span className="abs-corde-durée">{joursComptés} j</span>
                        {a.status !== 'approuve' && (
                          <span className="abs-corde-statut">{st.statut.label}</span>
                        )}
                        {a.document_url && <span aria-hidden="true">📎</span>}
                        {coupee && (
                          <span className="abs-corde-coupure" aria-hidden="true">
                            {seg.coupeeAvant ? '‹' : ''}{seg.coupeeApres ? '›' : ''}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* LE SOLDE, une longueur et non plus une boîte : pleine = rien
                    pris. Le nombre reste écrit à côté — une jauge lue seule
                    serait un statut sans mot. */}
                <div
                  className="abs-corde-solde"
                  title={`${solde.pris} jour(s) pris · plafond ${solde.plafond} jours`}
                  style={{
                    background: theme.carte,
                    '--abs-corde-plein': `${Math.max(0, Math.min(100, plein))}%`,
                  }}
                >
                  <span className="abs-corde-jauge" aria-hidden="true"><i /></span>
                  <span className="abs-corde-nombre">
                    {solde.restant}/{solde.plafond}
                  </span>
                </div>
              </div>
            )
          })}
          {lignes.length === 0 && (
            <div style={{ padding: 44, textAlign: 'center', color: theme.texteDoux }}>
              <CalendarOff size={26} style={{ marginBottom: 10, opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Aucun employé à afficher sur cette période.</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mode « jour » : la feuille du jour ═══ */}
      {mode === 'jour' && (
        <div
          data-testid="abs-cal-feuille-jour"
          style={{
            marginTop: 14, padding: 16, borderRadius: 16,
            border: `1px solid ${theme.bordure}`, background: theme.carte,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarDays size={16} style={{ color: 'var(--abs-amber)' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.texte, textTransform: 'capitalize' }}>
              {nomJourLong(jours[0]?.iso)}
            </h4>
            <span style={{ fontSize: 12, color: theme.texteDoux }}>
              · {absentsDuJour.length} absent{absentsDuJour.length > 1 ? 's' : ''} sur {lignes.length} employé{lignes.length > 1 ? 's' : ''}
            </span>
          </div>

          {absentsDuJour.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: theme.texteDoux }}>
              Personne n'est absent : effectif complet.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {absentsDuJour.map(({ employe, absences: liste }) => (
              <div key={employe.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '10px 12px', borderRadius: 12,
                border: `1px solid ${theme.bordure}`, background: theme.pastille,
              }}>
                {employe.photo_url ? (
                  <img src={employe.photo_url} alt="" style={{
                    width: 38, height: 38, borderRadius: 11, objectFit: 'cover', flexShrink: 0,
                    border: `1px solid ${theme.bordure}`,
                  }} />
                ) : (
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: theme.pastille, border: `1px solid ${theme.bordure}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: theme.texte,
                  }}>
                    {initialesDe(employe.first_name, employe.last_name)}
                  </div>
                )}
                <div style={{ minWidth: 150 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: theme.texte }}>
                    {employe.first_name} {employe.last_name}
                  </p>
                  <span style={{ fontSize: 11, color: theme.texteDoux }}>{employe.matricule || '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                  {liste.map((a) => {
                    const st = styleBarreAbsence(a, listePour(a))
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAbsenceActive(a)}
                        style={{
                          padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                          background: st.fond, color: theme.texte,
                          border: st.pointillee ? `1px dashed ${st.bordure}` : `1px solid ${st.bordure}`,
                          textDecoration: st.barree ? 'line-through' : 'none',
                        }}
                      >
                        {st.motif.emoji} {st.motif.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {presentsDuJour.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: theme.texteDoux }}>Présents ({presentsDuJour.length}) :</span>
              {presentsDuJour.map((e) => (
                <span key={e.id} title={`${e.first_name} ${e.last_name}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 4px', borderRadius: 999,
                  border: `1px solid ${theme.bordure}`, background: theme.pastille,
                  fontSize: 11, color: theme.texte,
                }}>
                  {e.photo_url ? (
                    <img src={e.photo_url} alt="" style={{ width: 22, height: 22, borderRadius: 7, objectFit: 'cover' }} />
                  ) : (
                    <span style={{
                      width: 22, height: 22, borderRadius: 7, background: 'rgba(16,185,129,0.15)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: 'var(--abs-emerald)',
                    }}>
                      {initialesDe(e.first_name, e.last_name)}
                    </span>
                  )}
                  {e.first_name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Légende ═══ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, fontSize: 11, color: theme.texteDoux }}>
        {motifs.map((m) => (
          <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: m.color, display: 'block' }} />
            {m.label}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 14, height: 10, borderRadius: 3, display: 'block',
            border: '1px dashed #F59E0B', background: 'transparent',
          }} />
          En attente (contour pointillé)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 14, height: 10, borderRadius: 3, display: 'block',
            background: 'rgba(153,27,27,0.20)', border: '1px solid #B91C1C',
          }} />
          Refusé (barré)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 8, height: 8, borderRadius: 999, display: 'block',
            border: '2px solid var(--charte-encre)', background: 'transparent',
          }} />
          anneau = jour travaillé
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 8, height: 8, borderRadius: 999, display: 'block',
            border: '2px solid var(--charte-encre)', background: 'var(--charte-encre)',
          }} />
          pastille = chômé (week-end ou férié)
        </span>
        <span>‹ › à cheval sur la période</span>
        <span>📎 justificatif joint</span>
        <span>⚡ conflit de pointage</span>
      </div>

      {/* ═══ Récapitulatif ═══ */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, padding: '11px 16px',
        border: `1px solid ${theme.bordure}`, borderRadius: 12, background: theme.carte,
        fontSize: 12, color: theme.texteDoux,
      }}>
        <span><b style={{ color: theme.texte }}>{stats.total}</b> absence{stats.total > 1 ? 's' : ''} {libellePeriode}</span>
        <span style={{ color: stats.enAttente ? 'var(--abs-amber)' : theme.texteDoux }}>
          ⏳ <b>{stats.enAttente}</b> en attente
        </span>
        <span style={{ color: stats.refusees ? 'var(--abs-coral)' : theme.texteDoux }}>
          ❌ <b>{stats.refusees}</b> refusée{stats.refusees > 1 ? 's' : ''}
        </span>
        <span>
          📆 <b style={{ color: theme.texte }}>{stats.journees}</b> jour{stats.journees > 1 ? 's' : ''} compté{stats.journees > 1 ? 's' : ''} {libellePeriode}
        </span>
      </div>

      {/* ═══ Tiroir de détail ═══ */}
      {absenceActive && (
        <AbsenceTiroir
          absence={absenceActive}
          darkMode={darkMode}
          joursOuvres={compterJoursOuvres(
            absenceActive.start_date,
            absenceActive.end_date,
            getHolidaySet(absenceActive.enterprise_id),
            absenceActive.count_holidays_as_leave
          )}
          solde={soldeDe(absenceActive.employee_id)}
          conflit={conflitParAbsence[absenceActive.id] || null}
          onClose={() => setAbsenceActive(null)}
          onChangerStatut={(a, statut) => { onChangerStatut?.(a, statut); setAbsenceActive(null) }}
          onModifier={(a) => { onModifier?.(a); setAbsenceActive(null) }}
          onVoirDocument={onVoirDocument}
          onSupprimer={(a) => { onSupprimer?.(a); setAbsenceActive(null) }}
        />
      )}
    </div>
  )
}

/** Quel jour de la période se trouve sous le pointeur ? (0-based, borné) */
function jourDepuisX(clientX, rect, nbJours) {
  if (!rect || !rect.width) return 0
  const ratio = (clientX - rect.left) / rect.width
  return Math.max(0, Math.min(nbJours - 1, Math.floor(ratio * nbJours)))
}

