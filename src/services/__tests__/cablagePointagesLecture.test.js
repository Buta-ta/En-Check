// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DE LECTURE DE LA PAGE POINTAGES
//   · les heures supplémentaires sont lisibles dans TOUTES les vues
//     (Passeports, Groupée, Liste) et plus seulement en vue groupée dépliée ;
//   · le flux 24h est parcourable (chaque heure est cliquable, les données
//     sont relues dynamiquement et pas recopiées en dur) ;
//   · les pauses présumées validées par un humain restent visibles.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const pointagesSrc = lire('src/pages/Pointages.jsx')
const sectionsSrc = lire('src/components/PointagesAfroTechSections.jsx')
const cssSrc = lire('src/pages/PointagesAfroTech.css')
const hoursCalcSrc = lire('src/services/hoursCalculator.js')
const pausesServiceSrc = lire('src/services/pausesService.js')
const planningSrc = lire('src/pages/Planning.jsx')
const planningCssSrc = lire('src/pages/PlanningAfroTech.css')
const pausesSrc = lire('src/pages/Pauses.jsx')
const pausesSectionsSrc = lire('src/components/PausesAfroTechSections.jsx')
const hookSrc = lire('src/hooks/useLoadingMinimum.js')
const diagnosticSql = lire('supabase/outils-sql/20261021_diagnostic_pause_disparue.sql')
const migrationSql = lire('supabase/migrations/20261021000001_pauses_decisions_reversibles.sql')
const migrationRestaurSql = lire('supabase/migrations/20261021000002_pauses_jamais_supprimees_et_restaurees.sql')
const migrationCorbeilleSql = lire('supabase/migrations/20261021000003_pauses_suppression_tracee_et_corbeille.sql')

describe('Lecture de la page Pointages — heures sup, flux 24h, pauses', () => {
  it('1. les heures supplémentaires sont affichées en mode Passeport', () => {
    // La grille Passeport reçoit l'option et l'affiche
    expect(sectionsSrc).toMatch(/export function PointagesPassportGrid\(\{[\s\S]*?hasOvertimeFeature = false/)
    expect(sectionsSrc).toContain('hasOvertimeFeature && p.overtimeData?.hasOvertime')
    expect(sectionsSrc).toContain('pointages-passport-overtime')
    // … et la page la lui passe vraiment (prop déclarée ≠ prop reçue)
    expect(pointagesSrc).toContain('hasOvertimeFeature={hasOvertimeFeature}')
    // Détail lisible : total + taux, et majoré quand il existe
    expect(sectionsSrc).toContain('p.overtimeData.rateApplied')
    expect(sectionsSrc).toContain('p.overtimeData.overtimeMajorSeconds')
    expect(cssSrc).toContain('.pointages-passport-overtime')
  })

  it('2. le flux 24h est parcourable : chaque heure est un creneau cliquable', () => {
    // Données relues dynamiquement, avec le détail de chaque badge
    expect(sectionsSrc).toContain('entrees: []')
    expect(sectionsSrc).toContain('sorties: []')
    expect(sectionsSrc).toContain('bucket.entrees.push(ligne)')
    expect(sectionsSrc).toContain('bucket.sorties.push(ligne)')
    // État de l'heure parcourue + créneau interactif
    expect(sectionsSrc).toContain('const [activeHour, setActiveHour] = useState(null)')
    expect(sectionsSrc).toContain('pointages-hourly-slot')
    expect(sectionsSrc).toContain('pointages-hourly-hit')
    expect(sectionsSrc).toContain('const activeBucket = useMemo(')
    // Navigation clavier : flèches + Échap
    expect(sectionsSrc).toContain("event.key === 'ArrowRight'")
    expect(sectionsSrc).toContain("event.key === 'ArrowLeft'")
    expect(sectionsSrc).toContain("event.key === 'Escape'")
    // Panneau de lecture : qui, à quelle heure, par quel canal
    expect(sectionsSrc).toContain('pointages-hourly-detail')
    expect(sectionsSrc).toContain('ligne.methode')
    expect(cssSrc).toContain('.pointages-hourly-detail-head')
  })

  it('3. une pause présumée validée reste visible dans Pointages (jamais comptée comme réelle)', () => {
    expect(pointagesSrc).toContain('pausesVisiblesDansPointages(p.pauses)')
    expect(sectionsSrc).toContain('pausesVisiblesDansPointages(p.pauses)')
    expect(pointagesSrc).toContain('estPresumeeValidee')
    expect(sectionsSrc).toContain('estPresumeeValidee')
    // Le libellé le dit : « dont N présumée(s) validée(s) »
    expect(pointagesSrc).toMatch(/dont \$\{presumedValidees\} présumée/)
    expect(sectionsSrc).toMatch(/dont \{presumedValidees\} présumée/)
    // La pause en direct, elle, ne peut venir que d'une pause réelle
    expect(pointagesSrc).toContain('const activePause = realPauses.find(pa => pa.ouverte)')
  })

  it('4. les heures sup du passeport sont lisibles et jamais imbriquées', () => {
    // Trois niveaux distincts : total, part normale, part majorée
    expect(sectionsSrc).toContain('pointages-passport-overtime-total')
    expect(sectionsSrc).toContain('pointages-passport-overtime-parts')
    expect(sectionsSrc).toContain('pointages-passport-overtime-rate')
    expect(sectionsSrc).toContain('is-major')
    // La ligne du bas sait se réorganiser
    expect(cssSrc).toMatch(/\.pointages-passport-timeline-bottom\s*\{[\s\S]*?flex-wrap:\s*wrap;/)
    // Et sur mobile le bloc HS prend sa propre ligne
    expect(cssSrc).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.pointages-passport-overtime\s*\{[\s\S]*?flex: 1 0 100%;/)
  })

  it("5. les écrans de chargement Planning et Pauses durent comme celui de Pointages", () => {
    // Un crochet partagé impose un plancher
    expect(hookSrc).toContain('export const DUREE_MIN_CHARGEMENT_MS = 4500')
    expect(hookSrc).toContain('setMinLoadingDone(true)')
    expect(hookSrc).toContain('skipLoading')
    // Les deux pages l'utilisent : l'écran reste tant que les données OU le délai ne sont pas prêts
    expect(planningSrc).toContain('useLoadingMinimum')
    expect(planningSrc).toContain('if (loading || !minLoadingDone)')
    expect(pausesSrc).toContain('useLoadingMinimum')
    expect(pausesSrc).toContain('|| !minLoadingDone')
    // « Passer l'animation » lève le plancher sans afficher une page vide
    expect(planningSrc).toMatch(/onSkip=\{\(\) => \{[\s\S]*?skipLoading\(\);[\s\S]*?\}/)
    expect(pausesSrc).toMatch(/onSkip=\{\(\) => \{[\s\S]*?skipLoading\(\)[\s\S]*?\}/)
  })

  it("6. l'activité des pauses est parcourable tranche par tranche", () => {
    expect(pausesSectionsSrc).toContain('const [activeHour, setActiveHour] = useState(null)')
    expect(pausesSectionsSrc).toContain('pausesByHour[hour].push(p)')
    expect(pausesSectionsSrc).toContain('pauses: pausesByHour[h] || []')
    expect(pausesSectionsSrc).toContain('pauses-v2-hour-slot')
    expect(pausesSectionsSrc).toContain('pauses-v2-hour-hit')
    expect(pausesSectionsSrc).toContain('pauses-v2-hour-detail')
    // Navigation clavier + lecture de la nature de chaque pause
    expect(pausesSectionsSrc).toContain("event.key === 'ArrowRight'")
    expect(pausesSectionsSrc).toContain("event.key === 'Escape'")
    expect(pausesSectionsSrc).toContain('p.natureLabel')
    expect(cssSrc).toContain('.pauses-v2-hour-detail-head')
  })


  it('7. le journal des décisions rend toute pause validée ou écartée retrouvable', () => {
    // Composant dédié, alimenté par les statuts validee / ecartee
    expect(pausesSectionsSrc).toContain('export function PausesJournalDecisions')
    expect(pausesSectionsSrc).toContain("p.statut === 'validee' || p.statut === 'ecartee'")
    expect(pausesSectionsSrc).toContain('pauses-v2-journal-panel')
    expect(pausesSectionsSrc).toContain('Voir dans la liste')
    // Câblé dans la page, avec un bouton qui ramène la ligne dans le tableau
    expect(pausesSrc).toContain('PausesJournalDecisions')
    expect(pausesSrc).toContain('onVoir={voirPause}')
    expect(pausesSrc).toContain('const voirPause = useCallback(')
    // … y compris pour une pause ÉCARTÉE, qui a désormais son filtre
    expect(pausesSrc).toContain("setSubFilter('ecartees')")
    expect(pausesSectionsSrc).toContain("subFilter === 'ecartees'")
    expect(pausesSectionsSrc).toContain("value=\"ecartees\"")
    // Un script SQL livré pour vérifier en base ce que contient vraiment la table
    expect(diagnosticSql).toContain('encheck_pauses')
    expect(diagnosticSql).toContain("p.source,   -- pointee | presumee | admin")
  })

  it('8. après Valider / Écarter, l’écran atterrit là où la pause se trouve', () => {
    // Le toast annonce la destination au lieu de laisser croire à une disparition
    expect(pausesSrc).toContain('classée dans « Présumées → Validées »')
    expect(pausesSrc).toContain('retrouvable dans « Écartées » et dans le journal')
    // Et le filtre suit : présumée validée → onglet Présumées → Validées
    expect(pausesSrc).toContain("setActiveTab('presumees')")
    expect(pausesSrc).toContain("setSubFilter('presumees_validees')")
    // Une réelle validée reste dans l'onglet Réelles, recherche réinitialisée
    expect(pausesSrc).toContain("setActiveTab('reelles')")
    expect(pausesSrc).toContain("setSearchTerm('')")
  })


  it('9. un filet de lecture directe récupère toute ligne que la RPC omettrait', () => {
    // La page ne dépend plus d'une seule fonction : elle relit la table.
    expect(pausesSrc).toContain(".from('encheck_pauses')")
    expect(pausesSrc).toContain(".gte('jour', startDate)")
    expect(pausesSrc).toContain(".lte('jour', endDate)")
    // Les lignes absentes de la RPC sont fusionnées et MARQUÉES, pas inventées
    expect(pausesSrc).toContain('const idsRpc = new Set(')
    expect(pausesSrc).toContain('recupereeDirecte: true')
    expect(pausesSrc).toContain('construirePauses([...(lignes || []), ...manquantes])')
    // Le marqueur est visible dans le tableau et dans le journal
    expect(pausesSectionsSrc).toContain('p.recupereeDirecte')
    // La lecture directe ne doit jamais faire échouer le chargement
    expect(pausesSrc).toContain('lecture directe indisponible')
  })

  it('10. une décision est réversible : « Annuler la décision »', () => {
    expect(pausesSrc).toContain('const annulerDecision = useCallback(')
    expect(pausesSrc).toContain('encheck_pauses_annuler_decision')
    // Repli sans SQL : écriture directe sur la table
    expect(pausesSrc).toContain(".update({ statut: p.source === 'presumee' ? 'presumee' : 'reelle' })")
    // Accessible depuis le journal ET depuis le tableau
    expect(pausesSectionsSrc).toContain('onAnnuler')
    expect(pausesSectionsSrc).toContain('onAnnulerDecision')
    expect(pausesSectionsSrc).toContain('Annuler la décision')
    expect(pausesSrc).toContain('onAnnulerDecision={annulerDecision}')
  })

  it('11. le script SQL rend les décisions réversibles et ferme les trous du moteur', () => {
    // 1. annuler une décision
    expect(migrationSql).toContain('encheck_pauses_annuler_decision')
    expect(migrationSql).toContain("THEN 'presumee' ELSE 'reelle' END")
    // 2. une pause validée pendant qu'elle est ouverte reste FERmable
    expect(migrationSql).toContain("statut IN ('reelle', 'presumee', 'validee')")
    // 3. plus de pause fantôme : idempotence réelle à l'ouverture
    expect(migrationSql).toContain('IF v_id IS NOT NULL AND v_jr = v_jour THEN')
    // Rien de destructif : jamais de DELETE
    expect(migrationSql).not.toMatch(/DELETE\s+FROM/i)
  })


  it('12. plus aucune décision ne peut supprimer une pause (cause racine)', () => {
    // Cause racine trouvée en base : encheck_alerte_journaliser est une PURGE
    // (copie au journal PUIS DELETE). Valider/Écarter l'appelait sur les pauses.
    expect(migrationRestaurSql).toContain('encheck_journal_tracer')
    expect(migrationRestaurSql).toContain('NE SUPPRIME JAMAIS')
    // Garde-fou : même un autre appelant ne peut plus effacer une donnée métier
    expect(migrationRestaurSql).toContain("('encheck_pauses', 'attendances', 'employees', 'pointages', 'encheck_pointages')")
    // Valider et Annuler passent par le journal PUR
    expect(migrationRestaurSql).toContain("PERFORM public.encheck_journal_tracer('encheck_pauses', v_id, v_ent, v_emp,")
    expect(migrationRestaurSql).toContain("'pause_validee'")
    expect(migrationRestaurSql).toContain("'decision_annulee'")
    // Le script 0001 ne doit plus appeler la fonction qui supprime
    expect(migrationSql).toContain('PERFORM public.encheck_journal_tracer(')
    expect(migrationSql).not.toContain("PERFORM public.encheck_alerte_journaliser('encheck_pauses'")
  })

  it('13. les pauses déjà supprimées sont restaurées depuis les snapshots', () => {
    expect(migrationRestaurSql).toContain('INSERT INTO public.encheck_pauses')
    expect(migrationRestaurSql).toContain('FROM public.encheck_pointages_journal')
    expect(migrationRestaurSql).toContain("snapshot->>'source' IN ('pointee', 'presumee', 'admin')")
    // Idempotent : jamais de doublon, jamais d'écrasement
    expect(migrationRestaurSql).toContain('ON CONFLICT (id) DO NOTHING')
    expect(migrationRestaurSql).toContain('DISTINCT ON (snapshot->>')
    // Et la table redevient lisible (RLS active sans politique = lectures vides)
    expect(migrationRestaurSql).toContain('encheck_pauses_lecture_admin')
    expect(migrationRestaurSql).toContain('FOR SELECT')
  })


  it('14. supprimer une pause est possible, mais archivé et remetable', () => {
    // Un bouton Supprimer, avec confirmation explicite
    expect(pausesSectionsSrc).toContain('onSupprimer')
    expect(pausesSectionsSrc).toContain('Supprimer cette pause (archivée et restaurable)')
    expect(pausesSrc).toContain('onSupprimer={supprimerPause}')
    expect(pausesSrc).toContain('window.confirm(')
    expect(pausesSrc).toContain('encheck_pauses_supprimer')
    // Corbeille : on ne perd rien, on peut remettre
    expect(pausesSectionsSrc).toContain('export function PausesCorbeille')
    expect(pausesSectionsSrc).toContain('Remettre')
    expect(pausesSrc).toContain('encheck_pauses_archives_lire')
    expect(pausesSrc).toContain('encheck_pauses_restaurer')
    expect(pausesSrc).toContain('<PausesCorbeille lignes={corbeille} onRestaurer={restaurerPause} />')
    // La corbeille est optionnelle : sans le script SQL, le chargement continue
    expect(pausesSrc).toContain('setCorbeille([])')
  })

  it('15. le script SQL archive AVANT d’effacer', () => {
    expect(migrationCorbeilleSql).toContain('encheck_pauses_supprimer')
    expect(migrationCorbeilleSql).toContain("'pause_supprimee'")
    expect(migrationCorbeilleSql).toContain('DELETE FROM public.encheck_pauses WHERE id = v_id')
    // L'archivage précède l'effacement dans le corps de la fonction
    const iArchive = migrationCorbeilleSql.indexOf('ARCHIVAGE OBLIGATOIRE')
    const iDelete = migrationCorbeilleSql.indexOf('DELETE FROM public.encheck_pauses WHERE id = v_id')
    expect(iArchive).toBeGreaterThan(0)
    expect(iDelete).toBeGreaterThan(iArchive)
    // La restauration n'écrase jamais une pause existante
    expect(migrationCorbeilleSql).toContain('ON CONFLICT (id) DO NOTHING')
    expect(migrationCorbeilleSql).toContain('restaurable')
  })


  it('16. le temps de pause est déduit du temps travaillé (risque paie)', () => {
    // Une règle, un seul endroit, testable
    expect(pausesServiceSrc).toContain('export function minutesPausesDeductibles')
    expect(hoursCalcSrc).toContain('minutesPausesDeductibles')
    // Le moteur reçoit les pauses et applique la déduction au total payé
    expect(hoursCalcSrc).toContain('minutesPausesDeductibles(options.pauses || [], sorted,')
    expect(hoursCalcSrc).toContain('const totalSecondesNet = Math.max(0, totalSecondes - pauseDeduitesSecondes)')
    expect(hoursCalcSrc).toContain('totalSecondes: totalSecondesNet,')
    // … sans jamais déduire deux fois une pause déjà matérialisée par des badges
    expect(pausesServiceSrc).toContain('const dejaComptee =')
    // … ni encaisser une présomption non validée
    expect(pausesServiceSrc).toContain("if (presume && p.statut !== 'validee') continue")
    // La page Pointages transmet bien les pauses au moteur
    expect(pointagesSrc).toContain('pauses: pausesByEmployee[employee.id] || [],')
    expect(pointagesSrc).toContain('pauseDeduitesSecondes,')
    // Et l'écran le dit : ce qui est déduit est visible
    expect(pointagesSrc).toContain('déduit')
  })


  it('17. une pause supprimée est signalée sur la case du jour', () => {
    // Le planning lit la corbeille des pauses sur la période affichée
    expect(planningSrc).toContain('encheck_pauses_archives_lire')
    expect(planningSrc).toContain('setPausesSupprimees(')
    // … et repère la case « employé | jour » concernée
    expect(planningSrc).toContain('const supprimeesDuJour =')
    expect(planningSrc).toContain('pausesSupprimees[`${emp.id}|${dayItem.dateStr}`]')
    // Le signe « pause » de la case est barré en rouge…
    expect(planningSrc).toContain('sk-shift-break' + '${')
    expect(planningCssSrc).toContain('.sk-shift-break.is-supprimee')
    expect(planningCssSrc).toContain('text-decoration: line-through')
    // … et un signe explicite apparaît dans la case
    expect(planningSrc).toContain('Pause supprimée')
    expect(planningCssSrc).toContain('.sk-shift-pause-supprimee')
    // Sans le script SQL, la map reste vide : le planning continue de tourner
    expect(planningSrc).toContain('setPausesSupprimees({})')
  })

  it('18. le signe « pause supprimée » tient DANS la case du planning', () => {
    //  Deux lignes souples : le `white-space: nowrap` d'avant faisait sortir
    //  « Pause supprimée · 12 » hors du cadre de la case.
    expect(planningSrc).toContain('sk-shift-pause-supprimee-titre')
    expect(planningSrc).toContain('sk-shift-pause-supprimee-plage')
    const blocSigne = (planningCssSrc.match(/\.sk-shift-pause-supprimee \{[^}]*\}/) || [''])[0]
    expect(blocSigne).toContain('max-width: 100%')
    expect(blocSigne).toContain('overflow-wrap: anywhere')
    expect(blocSigne).not.toContain('white-space: nowrap')
    //  Le nombre affiché est une PLAGE « de … à … » : un « 12 » tout seul ne
    //  voulait rien dire pour l'utilisateur.
    expect(planningSrc).toContain('de ${heureLocale(')
    expect(planningSrc).toContain('sk-shift-pause-supprimee-plage')
  })

  it('19. une sortie manquante ne fait plus clignoter la case « en cours »', () => {
    //  Le moteur retient la session ouverte de CHAQUE jour : une entrée écrasée
    //  par un badge du lendemain n'est plus perdue, donc elle est rattrapée par
    //  la règle d'auto-clôture (celle de la page Pointages).
    expect(hoursCalcSrc).toContain('const sessionsOuvertesAbandonnees = new Map()')
    expect(hoursCalcSrc).toContain('const openInDuJour =')
    expect(hoursCalcSrc).toContain('totalSecondesPresumes += calculerDureeSecondes(openInDuJour.check_time')
    //  Le planning ne clignote que si la session est RÉELLEMENT en cours
    expect(planningSrc).toContain('const sortiesManquantes = useMemo(')
    expect(planningSrc).toContain('const estEnCours = (emp, dateStr, real)')
    expect(planningSrc).toContain('{sessionEnCours && (')
    expect(planningSrc).not.toContain('{realIsOpen(realAtt) && (')
    expect(planningSrc).not.toContain('realIsOpen(real) ? "is-open"')
    //  … et il le DIT au lieu de clignoter sans fin
    expect(planningSrc).toContain('"sortie manquante"')
    expect(planningCssSrc).toContain('.sk-real-diff.is-manquante')
    //  La règle est celle du moteur : jour révolu, délai d'oubli, ou heure
  //  d'auto-clôture (+ grâce) dépassée.
    expect(planningSrc).toContain("seuils.oubliSortieHeures")
    expect(planningSrc).toContain('cfg.autoCloseEnabled !== true')
    expect(planningSrc).toContain('const limiteAutoCloseMs =')
  })

  it('20. une pause supprimée est aussi signalée côté page Pointages', () => {
    //  La page lit la corbeille des pauses pour le jour affiché…
    expect(pointagesSrc).toContain('encheck_pauses_archives_lire')
    expect(pointagesSrc).toContain('const pausesSupprimeesByEmployee = {}')
    //  … transmet la trace à chaque ligne…
    expect(pointagesSrc).toContain('pausesSupprimees: pausesSupprimeesByEmployee[employee.id] || [],')
    //  … et l'affiche au jour correspondant, dans les vues Liste/Groupée…
    expect(pointagesSrc).toContain('pointages-pause-supprimee')
    expect(pointagesSrc).toContain('Pause supprim')
    //  … comme dans la vue Passeport (sinon le signal disparaît selon la vue)
    expect(sectionsSrc).toContain('pointages-pause-supprimee')
    expect(cssSrc).toContain('.pointages-pause-supprimee')
    //  Sans le script SQL, la page continue de tourner
    expect(pointagesSrc).toMatch(/catch \(eCorbeille\)/)
  })

  it('21. la case n’affiche JAMAIS une heure inventée — symbole + légende', () => {
    //  Un symbole défini UNE seule fois : la case et la légende ne peuvent pas diverger
    expect(planningSrc).toContain('const SYMBOLE_OUBLI =')
    expect(planningSrc).toContain('if (real.autoClosed) return `${entree} → ${SYMBOLE_OUBLI}`')
    //  L'heure inventée par l'auto-clôture quitte la case et reste au survol
    expect(planningSrc).toContain('const titreReelDuJour =')
    expect(planningSrc).toContain('title={titreReelDuJour(realAtt)}')
    expect(planningSrc).not.toContain('(auto)"')
    //  Une sortie présumée VALIDÉE par un humain, elle, est montrée (elle compte)
    expect(planningSrc).toContain('sortieValidee: Boolean(result.lastOut?.estimation_validee_le)')
    expect(planningSrc).toContain('(validée)')
    //  La légende explique les deux signaux de la case
    expect(planningSrc).toMatch(/sk-legend-title">Signaux</)
    expect(planningSrc).toContain('Oubli de pointage')
    expect(planningSrc).toContain('Pause supprimée (')
    expect(planningCssSrc).toContain('.sk-legend-pause-barree')
    expect(planningCssSrc).toContain('.sk-legend-symbol')
  })

})
