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
import { ChevronLeft, ChevronRight, ChevronDown, Plus, CalendarOff, CalendarDays, CalendarSearch } from 'lucide-react'
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

/* Le second dessin (10/12) ne sépare plus le champ en trois colonnes : la
   coupure est ENTRE la colonne d'identité et le champ des jours, et c'est tout.
   252, c'est x 53 (l'intérieur du plateau) → x 305 (la naissance de la première
   cellule, celle que touche la pointe de la planche). Le prénom du dessin court
   jusqu'à x 311 — il ne pousse pas la coupure, il la borde. */
const LARGEUR_EMPLOYE = 252
// À droite, le dessin ne réserve rien : la plaquette DU SOLDE est peinte par-dessus
// la dernière cellule, de x 1178 (le bord gauche de la pilule) à x 1307 (la fin du
// nombre), soit 130 px, et son nombre s'arrête treize pixels avant la rive du champ
// (1320 − 1307). Ces deux cotes ne vivent qu'en CSS — `--abs-pli-solde` et
// `--abs-pli-solde-repli` — parce que le plateau ne prend plus sa largeur d'un
// plancher écrit en JavaScript : il prend la somme de ses jours (`--abs-pli-champ`).
// Réserver cent quarante-sept pixels de plus pour la plaquette, c'est ce qui avait
// fait glisser le jour de 145 à 108, puis 127 selon l'écran — et une planche d'une
// journée qui cherche cinquante pixels de plus que sa cellule pour loger son mot ne
// dit plus la période. Le fondateur, 11/12 : « on ne voit pas où s'arrête la
// planche "Formation · 1 j" ». La cote du dessin, elle, est une.
const LARGEUR_JOUR_MOIS = 36
const LARGEUR_JOUR_SEMAINE = 145
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
  // LE PLI. Le second dessin ferme la grille par défaut : les lignes sans absence
  // ne sont pas masquées, elles se REPLIENT en pastilles sous le plateau, avec le
  // compte écrit en clair. Ses deux ensembles d'état se lisent plus bas, à la
  // rubrique `pliActif` — un `useState` de plus pour la case d'entête aurait été
  // le compte écrit deux fois, et c'est exactement ainsi que le pli se perdait.
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
  const toutesLesLignes = useMemo(() => {
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
      .sort((a, b) =>
        `${a.employe.last_name || ''} ${a.employe.first_name || ''}`.localeCompare(
          `${b.employe.last_name || ''} ${b.employe.first_name || ''}`,
          'fr'
        )
      )
  }, [employes, absences, jours, motifsMasques])

  // Un seul tri, deux lectures : la grille montre ce qui a un trait, le registre
  // du pli garde le reste. `àSignaler.length + rienÀSignaler.length ===
  // toutesLesLignes.length` est LA loi de l'étage — un nombre écrit deux fois se
  // contredit à la première retouche, donc les deux étages lisent le même tableau.
  //
  // Le pli ne se ferme que là où le dessin le ferme : le second dessin est une
  // semaine. En mode jour, la feuille du jour a déjà son second étage — « Présents
  // (n) » — et un registre de pastilles en dessous répéterait la même liste, sous
  // une autre forme. Donc : pas de pli en jour, tous les employés restent en ligne.
  // LE PLI SE PILOTE LIGNE À LIGNE. La case d'entête n'était qu'un commutateur
  // global : « c\'est impossible de cliquer sur un employé plié, et le déplier ou le
  // plier juste lui » (fondateur, 12/12). Deux ensembles — ceux qu\'on a tenus
  // OUVERTS, ceux qu\'on a tenus FERMÉS — et un défaut par ligne : ce qui a une
  // planche se lit, ce qui n\'en a pas se tait. La case d\'entête n\'est pas un
  // troisième état : elle remplit les deux ensembles, et son `checked` se RELIT de
  // là. Écrit deux fois (un `useState` de case + deux ensembles), le pli se
  // contredit au premier clic — c\'est la loi du champ, encore.
  const [pliOuverts, setPliOuverts] = useState(() => new Set())
  const [pliFermés, setPliFermés] = useState(() => new Set())
  // Le mois ne plie pas : sa vignette de trente et une colonnes de 36 n\'a pas de
  // place pour une ligne « rien à signaler » vide, ni pour la plaquette du solde.
  const pliActif = mode === 'semaine'

  // Le défaut du pli, une seule fois : ouvert si la ligne a une planche, fermé si
  // non. Les deux ensembles ne font que la contredire, pour un employé ou pour
  // tous.
  const estOuvert = (ligne) =>
    pliOuverts.has(ligne.employe.id)
      ? true
      : pliFermés.has(ligne.employe.id)
        ? false
        : ligne.segments.length > 0
  const pliÉcrit = (ligne) => {
    const id = ligne.employe.id
    if (estOuvert(ligne)) {
      setPliOuverts((actuel) => {
        const suite = new Set(actuel)
        suite.delete(id)
        return suite
      })
      setPliFermés((actuel) => new Set(actuel).add(id))
    } else {
      setPliFermés((actuel) => {
        const suite = new Set(actuel)
        suite.delete(id)
        return suite
      })
      setPliOuverts((actuel) => new Set(actuel).add(id))
    }
  }
  const sansPlanche = useMemo(
    () => toutesLesLignes.filter((l) => l.segments.length === 0),
    [toutesLesLignes]
  )
  const déplierTout = sansPlanche.length > 0 && sansPlanche.every((l) => estOuvert(l))
  const plierTout = () => {
    if (déplierTout) {
      setPliFermés(() => new Set(toutesLesLignes.map((l) => l.employe.id)))
      setPliOuverts(() => new Set())
    } else {
      setPliOuverts(() => new Set(toutesLesLignes.map((l) => l.employe.id)))
      setPliFermés(() => new Set())
    }
  }
  const lignes = pliActif ? toutesLesLignes.filter(estOuvert) : toutesLesLignes
  // le registre porte TOUS les sans-absence de la période, chacun dans son état
  // (plié = muet, ouvert = pressé) : un nombre écrit en fonction du pli se
  // contredit au premier clic. La partition du bas du plateau, elle, se lit sur ce
  // qui est réellement hors-champ — `pliés` est le complément exact de `lignes`,
  // même tableau, même calcul, jamais un second filtre inventé à côté.
  const rienÀSignaler = useMemo(
    () => (mode === 'jour' ? [] : toutesLesLignes.filter((l) => l.segments.length === 0)),
    [mode, toutesLesLignes]
  )
  const pliés = useMemo(
    () => (pliActif ? toutesLesLignes.filter((l) => !estOuvert(l)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pliActif, toutesLesLignes, pliOuverts, pliFermés]
  )
  // le compte du haut se lit en ABSENCES, pas en employés, et il ne dépend PAS du
  // pli : trois lignes ouvertes à la main ne changent pas le bilan de la période.
  const àSignaler = useMemo(() => {
    if (mode === 'jour') return 0
    const vus = new Set()
    toutesLesLignes.forEach((l) => l.segments.forEach((seg) => vus.add(seg.absence.id)))
    return vus.size
  }, [mode, toutesLesLignes])

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
          « Masquer les employés sans absence » est devenu la case « Déplier tout »
          de l'entête de grille (10/12), et
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
              {/* Le billet « Masquer sans absence » est descendu dans la grille :
                  le second dessin en fait une case d'entête, « Déplier tout », et
                  le pli ne masque plus rien — il replie. Un interrupteur accroché à
                  la tringle pour commander les lignes serait un deuxième mot pour
                  la même chose. */}
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

      {/* ═══ Grille — LE PLI PAR EMPLOYÉ ═══
          Maquette `maquettes/absences-grille-2-pli.png` (10/12, « retravaille ça
          et utilise la 2e maquette comme modèle »). La corde est déposée : plus de
          fil, plus d'anneaux, plus de carte suspendue au-dessus du voisin.

          Le dessin répond à « qui est absent, et pendant quels jours ? » par une
          planche POSÉE SUR LE JOUR : sa pointe touche la naissance de sa première
          cellule, sa rive touche la fin de sa dernière, sa hauteur tient dans la
          ligne (40 dans 78). Le champ est nu mais ENCADRÉ — un plateau de trois
          pixels sur le sable de la page, et son ombre est dure. Les jours vides
          portent un trait de crayon tous les tiers de cellule, le jour courant est
          lavé d'argile sur une cellule et traversé d'un plomb, les week-ends sont
          hachurés dans l'entête, et le solde est peint À LA RIVE DROITE DU CHAMP,
          par-dessus la dernière cellule — ce n'est plus une colonne à côté.

          Le second étage du dessin, celui que la corde n'avait pas : ce que la
          grille ne montre pas n'est pas effacé. Les lignes sans absence se replient
          en pastilles, chacune marquée de son coin plié, avec le compte écrit en
          clair à droite. « Déplier tout », case d'entête, rouvre le pli.

          Le métier est intact, seul le dessin change : `segmentSurJours` positionne
          en pourcentage de la période, `empilerSegments` empile les chevauchements
          en rangs, `styleBarreAbsence` garde sa loi (le trait dit le statut), le
          clic ouvre le tiroir, la pince de la tringle se dépose au jour sous le
          pointeur. Les jours chômés ne se peignent plus : le dessin ne les hache
          que dans l'entête, et le mot du jour se lit dans le titre de la planche. */}
      <div className="abs-cal-scroll">
        <div
          className="abs-cal-champ"
          style={{
            '--abs-pli-employe': `${LARGEUR_EMPLOYE}px`,
            /* LE JOUR, EN UN SEUL ÉCRITURE. Le dessin en donne 145 (champ x 305 →
               1320 pour sept cellules) ; le mode jour et le mode mois gardent leur
               propre pas. Le jeton est lu par l'entête ET par la piste — un champ,
               deux usages — et le plateau ne connaît plus que le produit des deux.
               C'est ici, et pas dans un plancher de `minWidth`, que la largeur du
               champ se décide : écrit deux fois, le nombre se contredit dès que
               l'écran bouge. */
            '--abs-pli-jour': `${largeurJour}px`,
            // le lavage et les traits de jour se mesurent en colonnes, pas en
            // pixels : la piste s'étire au-delà de `largeurJour` sur un écran
            // large, et un pas fixé ici serait faux de vingt-quatre pixels.
            '--abs-pli-nb-jours': nbJours,
          }}
        >

          {/* LA LIGNE DE COMPTE — le dessin écrit le bilan de la période entre la
              tringle et l'entête des jours, et sa case de pli est là, à sa droite.
              Deux nombres, une seule source : ce que la grille montre et ce
              qu'elle replie, jamais « ce qu'il y a dans la base ». */}
          <div className="abs-pli-comptes" data-testid="abs-cal-comptes">
            {/* Le bilan de la PÉRIODE, jamais l'état du pli : trois lignes ouvertes
                à la main ne changent pas le nombre d'absences. En mode jour, le
                compte retombe sur `stats` — la feuille du jour n'a pas de registre. */}
            {/* La phrase se lit, elle ne se devine pas : la capture du fondateur
                (08/12) montrait « 4 RIEN CE MOIS-CI » — trois mots collés, un
                verbe avalé, une casse imposée par la règle du bandeau. Le second
                membre reprend donc le verbe du premier (« rien À SIGNALER ce
                mois-ci ») : la loi du champ, encore, un seul mot écrit deux fois
                vaut mieux que deux mots qui se contredisent. */}
            <span>
              <span className="abs-pli-compte-nombre">{mode === 'jour' ? stats.total : àSignaler}</span>{' '}
              à signaler
              <span aria-hidden="true"> · </span>
              <span className="abs-pli-compte-nombre">{mode === 'jour' ? 0 : rienÀSignaler.length}</span> rien{' '}
              à signaler{' '}
              {mode === 'mois' ? 'ce mois-ci' : mode === 'jour' ? 'aujourd’hui' : 'cette semaine'}
            </span>
            {/* LE PLI EST RÉVERSIBLE. Le dessin dessine sa case qu'il y ait ou non
                des lignes à replier, et une case qui s'efface après service est un
                défaut, pas une économie : « le bouton déplier disparait une fois
                déplier donc on ne peut plus plier après » (fondateur, 11/12). Elle
                reste donc posée, et c'est son MOT qui bascule — « Déplier tout »
                ouvre, « Replier tout » ferme, la case cochée disant déjà l'état.
                Elle ne s'éteint qu'une fois vidée de son office : rien à ouvrir.
                En mode jour, pas de case : la feuille du jour a déjà son second
                étage et le pli n'a pas de sens sur une colonne unique. */}
            {pliActif && (
              <label className="abs-pli-deplier">
                <input
                  type="checkbox"
                  checked={déplierTout}
                  disabled={!déplierTout && sansPlanche.length === 0}
                  onChange={plierTout}
                  data-testid="abs-cal-deplier-tout"
                />
                {déplierTout ? 'Replier tout' : 'Déplier tout'}
              </label>
            )}
          </div>

          {/* Entête des jours — la cote du dessin : « L 23 » sur une seule ligne,
              centré dans sa cellule, haché à sa rive droite le week-end, aucun
              filet entre les colonnes, aucune colonne de solde réservée. Les
              étiquettes sont ÉCRITES AU-DESSUS du plateau (x 169..185 pour une
              règle à 199) et lisent le même `--abs-pli-employe` que la piste. */}
          <div className="abs-cal-entete">
            {/* La colonne de tête de l'entête est VIDE, et c'est une cote : le
                dessin ne écrit rien au-dessus des prénoms (x 53..305, y 165..192
                : aucun pixel d'encre). Le compte, lui, se lit une seule fois,
                dans la ligne du haut — un nombre écrit deux fois se contredit à
                la première retouche. Ce div reste : il porte la largeur de la
                coupure, et sans lui les sept étiquettes glisseraient d'un
                demi-jour. */}
            <div className="abs-cal-entete-employes" aria-hidden="true" />
            <div className="abs-cal-entete-jours">
              {jours.map((j) => (
                <div
                  key={j.iso}
                  data-jour={j.iso}
                  data-weekend={j.weekend ? 'vrai' : 'faux'}
                  className="abs-cal-jour"
                  data-aujourdhui={j.iso === aujourdhuiIso ? 'vrai' : 'faux'}
                >
                  <span className="abs-cal-jour-nom">
                    {mode === 'jour' ? nomJourLong(j.iso).split(' ')[0] : JOURS_SEMAINE[j.weekday - 1]}
                  </span>
                  <span className="abs-cal-jour-num">{j.jour}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="abs-pli-plateau" data-testid="abs-pli-plateau">
          {/* Lignes employés — UNE PLANCHE POSÉE PAR ABSENCE. */}
          {lignes.map((ligne) => {
            const feriers = getHolidaySet(ligne.employe.enterprise_id)
            const nbRangees = ligne.segments.reduce((max, s) => Math.max(max, s.rangeesTotal || 1), 1)
            const solde = soldeDe(ligne.employe.id)
            // la jauge se remplit de CE QUI EST PRIS, pas du restant : remplie du
            // restant, un solde épuisé se dirait vierge (le dessin, lui, remplit
            // d'argile jusqu'à 82 % sous un « 26/30 » — donc du pris)
            const plein = solde.plafond > 0 ? Math.round((solde.pris / solde.plafond) * 100) : 0

            return (
              <div
                key={ligne.employe.id}
                className="abs-pli-ligne"
                data-testid="abs-pli-ligne"
                data-employe={ligne.employe.id}
                // deux planches qui se chevauchent ne se marchent pas dessus :
                // la ligne grandit du MÊME cran que la montée, un seul calcul des
                // deux côtés (écrit deux fois, le deuxième rang mangeait la ligne).
                style={{ '--abs-pli-rangs': nbRangees }}
              >
                <div className="abs-pli-tete">
                  {ligne.employe.photo_url ? (
                    <img className="abs-pli-figure" src={ligne.employe.photo_url} alt="" />
                  ) : (
                    <span className="abs-pli-figure" aria-hidden="true">
                      {initialesDe(ligne.employe.first_name, ligne.employe.last_name)}
                    </span>
                  )}
                  <span className="abs-pli-nom">
                    {ligne.employe.first_name} {ligne.employe.last_name}
                  </span>
                  {/* LA PINCE, PAR LIGNE. Elle est dans la colonne d'identité — la
                      seule que le dessin ne clique pas pour autre chose — et jamais
                      sur la piste, qui est la surface des planches et la zone de
                      dépôt. `aria-pressed` dit l'état, le mot le dit aussi. */}
                  {pliActif && (
                    <button
                      type="button"
                      className="abs-pli-plier"
                      data-testid="abs-pli-plier"
                      data-employe={ligne.employe.id}
                      aria-pressed={estOuvert(ligne) ? 'true' : 'false'}
                      aria-label={`${ligne.segments.length > 0 ? 'Replier' : 'Déplier'} la ligne de ${ligne.employe.first_name} ${ligne.employe.last_name}`}
                      title={`${ligne.segments.length > 0 ? 'Replier' : 'Déplier'} cette ligne`}
                      onClick={() => pliÉcrit(ligne)}
                    >
                      {ligne.segments.length > 0 ? '⌄' : '⌃'}
                    </button>
                  )}
                </div>

                {/* LA PISTE — les traits de jour (un fond, pas trente et un
                    éléments), le lavage, le plomb, les planches et le solde. Elle
                    est aussi la zone de dépôt : c'était déjà `data-drop-lane`. */}
                <div
                  className="abs-pli-piste"
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
                  {/* Repère « aujourd'hui » : la colonne lavée et le fil à plomb
                      partagent le même `left` que l'étiquette du jour dans
                      l'entête — un seul champ, deux usages, pas de dérive. */}
                  {indexAujourdhui >= 0 && (
                    <>
                      <span
                        className="abs-pli-lavage"
                        aria-hidden="true"
                        style={{ left: `${((indexAujourdhui + 0.5) / nbJours) * 100}%` }}
                      />
                      <span
                        className="abs-pli-plomb"
                        data-testid="abs-pli-aujourdhui"
                        aria-hidden="true"
                        style={{ left: `${((indexAujourdhui + 0.5) / nbJours) * 100}%` }}
                      />
                    </>
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
                    const coupee = seg.coupeeAvant || seg.coupeeAprès
                    // une journée collée au bord gauche (mode jour, ou période
                    // coupée avant son premier jour) n'a pas de naissance à
                    // mesurer : elle se pose à deux pixels du montant.
                    const colle = nbJours === 1 || seg.coupeeAvant
                    const joursComptés = compterJoursOuvres(
                      a.start_date,
                      a.end_date,
                      feriers,
                      a.count_holidays_as_leave
                    )
                    return (
                      <button
                        key={a.id}
                        className="abs-cal-barre abs-pli-planche"
                        onClick={() => setAbsenceActive(a)}
                        title={titrePlanche}
                        aria-label={titrePlanche}
                        data-testid="abs-cal-barre"
                        data-statut={a.status}
                        data-trait={st.pointillee ? 'pointillé' : st.barree ? 'barré' : 'plein'}
                        data-coupée={seg.coupeeAvant ? 'vrai' : 'faux'}
                        style={{
                          /* LES BORDS, PAS LES CENTRES, ET UN SEUL NOMBRE À GAUCHE.
                             Le dessin pose l'encre à x 302 pour une cellule née à
                             305 — la pointe de seize rend au jour ce que le cerne
                             lui prend — et finit sa planche de trois jours à x 735
                             pour une dernière cellule morte à 740. `left` ET `right`,
                             jamais une largeur calculée à la main. La naissance est
                             un JETON, pas une chaîne recopiée : la feuille en fait
                             deux usages, le `left` et la borne de `max-width` (la
                             planche ne pousse jamais hors du plateau) — un seul
                             nombre, deux lectures, la loi du champ.
                             Ce qui manque à la largeur, c'est le mot qui ne tient
                             pas dans une journée : c'est `min-width: max-content`
                             qui le rattrape dans la feuille, pas un plancher de jour
                             moyen. Et une période coupée par la fenêtre reste collée
                             au bord, les deux rives se lisent dans le même `style`. */
                          '--abs-pli-entree': colle
                            ? '2px'
                            : `calc(${(seg.debut / nbJours) * 100}% + var(--abs-pli-pointe))`,
                          left: 'var(--abs-pli-entree)',
                          right: nbJours === 1 || seg.coupeeAprès
                            ? '2px'
                            : `calc(${100 - ((seg.fin + 1) / nbJours) * 100}% + var(--abs-pli-rive))`,
                          '--abs-pli-rang': seg.rangee,
                          /* La loi reste dans `styleBarreAbsence` : le trait dit le
                             statut — pointillé pour ce qui n'est pas acquis, barré
                             pour le refus — et le mot du statut s'ÉCRIT sous son
                             trait, à sa rive droite, comme le dessin écrit REFUSÉE
                             sous son enveloppe. La couleur du motif ne se pose
                             nulle part ici : le dessin remplit d'argile, une seule
                             teinte pour tous les motifs. */
                          borderStyle: st.pointillee || st.barree ? 'dashed' : 'solid',
                          textDecoration: st.barree ? 'line-through' : 'none',
                        }}
                      >
                        {/* le caret ‹ de la pointe, crème dans le ruban — il dit
                            « ici commence un jour travaillé », pas « ceci est
                            décoré » : il disparaît quand la planche est coupée. */}
                        {!seg.coupeeAvant && (
                          <span className="abs-pli-glyphe" aria-hidden="true">‹</span>
                        )}
                        {/* le carré de corail, quand la pointeuse conteste ce jour :
                            centré sur la rive gauche de la planche (dessin :
                            x 586..597 pour une rive à 595) */}
                        {conflitParAbsence[a.id]?.status === 'pending' && (
                          <span className="abs-pli-noeud" aria-hidden="true" />
                        )}
                        <span className="abs-pli-marque" aria-hidden="true">{st.motif.emoji}</span>
                        <span className="abs-pli-motif">{st.motif.label}</span>
                        <span className="abs-pli-séparateur" aria-hidden="true">·</span>
                        <span className="abs-pli-durée">{joursComptés} j</span>
                        {a.document_url && <span aria-hidden="true">📎</span>}
                        {coupee && (
                          <span className="abs-pli-coupure" aria-hidden="true">
                            {seg.coupeeAvant ? '‹' : ''}{seg.coupeeAprès ? '›' : ''}
                          </span>
                        )}
                        {/* le mot du statut n'est pas un ornement : en attente et
                            refusée se LISENT (C7), et le dessin l'écrit SOUS son
                            trait, à sa droite — jamais dans la planche. */}
                        {a.status !== 'approuve' && (
                          <span className="abs-pli-statut">{st.statut.label}</span>
                        )}
                      </button>
                    )
                  })}

                  {/* LE SOLDE, peint à la rive droite du champ : pleine = rien
                      pris. Le nombre reste écrit à côté — une jauge lue seule
                      serait un statut sans mot. Le « + » du dessin devant
                      « 26/30 » n'est pas une donnée : le nombre se lit nu. */}
                  <div
                    className="abs-pli-solde"
                    title={`${solde.pris} jour(s) pris · plafond ${solde.plafond} jours`}
                    style={{ '--abs-pli-plein': `${Math.max(0, Math.min(100, plein))}%` }}
                  >
                    {/* la pilule ne se rend même pas en mois : sous 36 pixels par
                        jour, ses cinquante pixels et son cerclage ne sont pas une
                        mesure, c'est un débordement. `title` et l'étage Soldes de
                        la page gardent le nombre. */}
                    {mode !== 'mois' && <span className="abs-pli-jauge" aria-hidden="true"><i /></span>}
                    <span className="abs-pli-nombre">
                      {solde.restant}/{solde.plafond}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* LE REGISTRE DU PLI — le second étage du dessin : ceux qui n'ont rien
              à signaler ne sortent pas de la grille, ils se replient en pastilles,
              chacune marquée de son coin plié, et le compte reste écrit en clair.
              Un clic ouvre la même fiche que la ligne. En mode jour, le registre
              reste vide : la feuille du jour a déjà son étage « présents », et un
              nombre écrit deux fois se contredit à la première retouche. */}
          {pliés.length > 0 && (
            <div className="abs-pli-registre" data-testid="abs-pli-registre">
              {/* LA PASTILLE EST LE CONTRÔLE DU PLI. Elle était écrite muette — « le
                  dessin ne lui prête aucun geste » — et c'est exactement ce qui
                  rendait un employé plié inaccessible. Le dessin ne montre pas non
                  plus de liste de lignes repliées : le geste est donc ICI, sur la
                  pastille, unique entrée de la grille pour qui n'a rien à signaler.
                  Un clic soulève la ligne, un second la referme ; l'état se lit
                  (`aria-pressed`) et se dit (`aria-label`). */}
              {pliés.map((ligne) => {
                const nom = `${ligne.employe.first_name} ${ligne.employe.last_name}`
                const ouvert = false // le registre ne montre QUE le pli : ouvert = hors champ
                return (
                  <button
                    key={ligne.employe.id}
                    type="button"
                    className="abs-pli-chip"
                    data-testid="abs-pli-chip"
                    data-employe={ligne.employe.id}
                    aria-pressed={ouvert}
                    aria-label={`${nom} · ${ouvert ? 'déplier' : 'plier'} sa ligne`}
                    title={`${nom} · rien à signaler sur la période · ${ouvert ? 'ligne dépliée, cliquer pour replier' : 'cliquer pour déplier la ligne'}`}
                    onClick={() => pliÉcrit(ligne)}
                  >
                    {ligne.employe.photo_url ? (
                      <img className="abs-pli-chip-figure" src={ligne.employe.photo_url} alt="" />
                    ) : (
                      initialesDe(ligne.employe.first_name, ligne.employe.last_name)
                    )}
                  </button>
                )
              })}
              <span className="abs-pli-compte">
                <span className="abs-pli-compte-nombre">{rienÀSignaler.length}</span> · rien à signaler
              </span>
            </div>
          )}

            {/* L'état vide se lit DANS le plateau, aux cotes de la feuille — pas un
                pavé `style` posé à l'intérieur du champ, qui héritait du sable et
                des règles comme d'un cadre de plus. */}
            {toutesLesLignes.length === 0 && (
              <p className="abs-pli-vide" data-testid="abs-pli-vide">
                <CalendarOff size={26} aria-hidden="true" />
                Aucun employé à afficher sur cette période.
              </p>
            )}
          </div>
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
            width: 2, height: 12, display: 'block', background: 'var(--charte-bordure)',
          }} />
          trait de crayon = jour nu
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 10, height: 10, display: 'block', background: 'var(--abs-amber)', opacity: 0.26,
          }} />
          colonne lavée = aujourd’hui
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 14, height: 10, borderRadius: 3, display: 'block',
            border: '2px solid var(--charte-encre)', background: 'var(--charte-aplat)',
            clipPath: 'polygon(0 50%, 14% 0, 100% 0, 100% 100%, 14% 100%)',
          }} />
          planche posée = l’absence, de son premier jour au dernier
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 10, height: 10, borderRadius: 3, display: 'block',
            border: '2px solid var(--charte-encre)', background: 'var(--charte-aplat)',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)', marginLeft: 6,
          }} />
          pastille à coin replié = rien à signaler (bas du plateau)
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

