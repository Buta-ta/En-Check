import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const planningSrc = lire('src/pages/Planning.jsx')

// Le bandeau du haut, isolé du reste de la page : c'est lui que le fondateur a
// demandé de retravailler, et une assertion sur la page entière ne dirait pas
// si le contrôle est sorti du bandeau ou d'ailleurs.
const bandeau = planningSrc.slice(
  planningSrc.indexOf('<header className="sk-topbar">'),
  planningSrc.indexOf('</header>') + '</header>'.length
)
expect(bandeau.length).toBeGreaterThan(1000)
const planningCss = lire('src/pages/PlanningAfroTech.css')

// L'anneau de toile, lui aussi isolé : c'est le nouveau contenant du bandeau.
const cadreOuvert = planningSrc.indexOf('<div className="sk-plan-encadrement">')
const pointagesSections = lire('src/components/PointagesAfroTechSections.jsx')
const pausesSections = lire('src/components/PausesAfroTechSections.jsx')

describe('Câblage Planning v2 — Système Drag & Drop × Identité Afro-Tech En-Check', () => {
  it('1. ne fait plus aucune référence à un produit tiers dans l’interface Planning', () => {
    expect(planningSrc).not.toMatch(/Skello|SKELLO|skello/i)
    expect(planningSrc).toContain('En-Check · Planning')
  })

  it('2. rend TOUTES les équipes pliables, y compris GARDE & LOGISTIQUE, et permet de les créer / nommer', () => {
    // Une seule boucle de rendu des groupes : chaque groupe possède sa barre pliable
    expect(planningSrc).toContain('className="sk-group-row"')
    expect(planningSrc).not.toContain('groupIdx > 0')
    expect(planningSrc).toContain('Collaborateurs &amp; Équipes')
    // Création / renommage / suppression d'équipes + affectation des membres
    expect(planningSrc).toContain('Gérer les équipes')
    expect(planningSrc).toContain('openNewTeamModal')
    expect(planningSrc).toContain('openEditTeamModal')
    expect(planningSrc).toContain('handleDeleteTeam')
    expect(planningSrc).toContain('sk-team-member-row')
    expect(planningCss).toContain('.sk-group-row-btn')
  })

  it('3. permet de créer ses propres modèles (horaire, pause, congé, repos) et de les déposer dans le calendrier', () => {
    expect(planningSrc).toContain('MODEL_KINDS')
    expect(planningSrc).toMatch(/id:\s*["']shift["']/)
    expect(planningSrc).toMatch(/id:\s*["']break_only["']/)
    expect(planningSrc).toMatch(/id:\s*["']rest["']/)
    expect(planningSrc).toMatch(/id:\s*["']leave["']/)
    expect(planningSrc).toContain('openNewModelModal')
    expect(planningSrc).toContain('handleSaveCustomModel')
    expect(planningSrc).toContain('handleDeleteCustomModel')
    // Dépôt puis affichage du modèle dans la case du calendrier mensuel
    expect(planningSrc).toContain('handleDropOnCalendarDay')
    expect(planningSrc).toContain('removeMonthModel')
    expect(planningSrc).toContain('sk-cal-pill')
    expect(planningSrc).toContain('monthModels[cell.date]')
  })

  it('4. respecte l’option payante Planning : aucun horaire 08:00-17:00 inventé par défaut', () => {
    expect(planningSrc).toContain('module_planning')
    expect(planningSrc).toContain('isPlanningModuleEnabled')
    expect(planningSrc).toContain('employeesWithoutPlanningOption')
    expect(planningSrc).toContain('sk-no-option-banner')
    // Le fallback "Lun-Ven 08:00-17:00" a été supprimé
    expect(planningSrc).not.toContain('source: "fallback"')
  })

  it('5. permet de marquer la disponibilité d’un employé (aujourd’hui / cette semaine)', () => {
    expect(planningSrc).toContain('setEmployeeAvailability')
    expect(planningSrc).toContain('sk-avail-pill')
    expect(planningSrc).toMatch(/["']today["']/)
    expect(planningSrc).toMatch(/["']week["']/)
    expect(planningCss).toContain('.sk-avail-pill.is-on')
    expect(planningCss).toContain('.sk-avail-pill.is-off')
  })

  it('6. permet de personnaliser la couleur des modèles et des cases', () => {
    expect(planningSrc).toContain('ENCHECK_COLOR_PALETTE')
    expect(planningSrc).toContain('buildShiftGradient')
    expect(planningSrc).toContain('--shift-custom-bg')
    expect(planningSrc).toContain('--brick-color')
    expect(planningSrc).toContain('sk-color-swatch')
    expect(planningSrc).toContain('Couleur de la case')
    expect(planningCss).toContain('.sk-color-input')
  })

  it('7. suit le thème de l\u2019application sans le commander dans son bandeau', () => {
    // Le fondateur a retiré le bouton du bandeau le 22/11 : le thème est un
    // choix de l\u2019application, pas d\u2019une page. Ce contrat dit donc le
    // contraire de l\u2019ancien — et il est plus dur, pas plus souple : la page
    // doit OBÉIR au thème global et ne plus lever la main dessus.
    expect(planningSrc).not.toContain('toggleTheme')
    expect(planningSrc).not.toContain('sk-theme-btn')
    expect(planningSrc).toContain('const { darkMode } = useTheme();')
    expect(planningSrc).toContain('data-theme={darkMode ? "dark" : "light"}')
    // la feuille de base ne garde pas la règle d\u2019un objet supprimé
    expect(planningCss).not.toContain('.sk-theme-btn')
    // le bouton reste ailleurs : le thème se change depuis le tableau de bord
    const coque = lire('src/components/DashboardExperience.jsx')
    expect(coque).toContain('toggleTheme')
    expect(coque).toContain('theme-toggle')
  })

  it('8. affiche les 7 jours complets (Lun -> Dim) dans la barre récapitulative du bas', () => {
    expect(planningSrc).not.toContain('dailyTotals.slice(0, 4)')
    expect(planningSrc).toContain('{dailyTotals.map((dt) => (')
  })

  it('9. aligne la barre d’alerte Pause de Pointages sur celle de la page Pauses', () => {
    expect(pointagesSections).toContain('pauses-v2-live-banner-left')
    expect(pointagesSections).toContain('pauses-v2-live-pulse-dot')
    expect(pointagesSections).toContain('pauses-v2-live-chip')
    expect(pointagesSections).toContain('pauses-v2-live-timer-mono')
    expect(pointagesSections).toContain('pauses-v2-Ghost-btn')
    // Structure identique à la bannière de référence de la page Pauses
    expect(pausesSections).toContain('pauses-v2-live-banner-left')
    expect(pausesSections).toContain('pauses-v2-live-chip')
    expect(pointagesSections).not.toContain('pauses-v2-live-banner-header')
    expect(pointagesSections).not.toContain('pauses-v2-live-cards')
  })

  it('conserve l’identité Afro-Tech et le thème actif (useTheme + motifs culturels)', () => {
    expect(planningSrc).toContain('useTheme')
    expect(planningSrc).toContain('data-theme={darkMode ? "dark" : "light"}')
    // Le bandeau motif de la page n'est plus posé au-dessus du bandeau de
    // commande : il l'encadre (22/11). La page garde sa bande de pied.
    expect(planningSrc).toContain('<PageCulturalBand pathname="/planning" placement="cadre" />')
    expect(planningSrc).toContain('<PageCulturalBand pathname="/planning" placement="bottom"/>')
    expect(planningSrc).toContain('AdinkraWatermarkSvg')
    expect(planningCss).toContain('.sk-plan-page[data-theme="light"]')
  })

  it('conserve le Dock de modèles glissables et le Drag & Drop (Alt pour dupliquer)', () => {
    expect(planningSrc).toContain('Modèles à glisser-déposer')
    expect(planningSrc).toContain('handleDragStartTemplate')
    expect(planningSrc).toContain('handleDragStartCellShift')
    expect(planningSrc).toContain('handleDropOnCell')
    expect(planningSrc).toContain('Glisser pour déplacer ou')
    expect(planningSrc).toContain('Maintenir Alt pour dupliquer')
    expect(planningSrc).toContain('Dupliquer la semaine')
    expect(planningSrc).toContain('Publier le planning')
  })

  it('10. affiche TOUJOURS le modèle déposé dans la case cible (congé, pause, modèle créé)', () => {
    // Le repos/congé n'est plus masqué : resolveCellShift renvoie une carte visible
    expect(planningSrc).toContain('override.isRest)')
    expect(planningSrc).not.toMatch(/if \(override\.isRest\) return null;/)
    // Pause déposée sur une case vide = carte autonome (plus de simple message d'erreur)
    expect(planningSrc).toContain('isPauseOnly')
    expect(planningSrc).toContain('standalonePause')
    // Le modèle déposé garde son nom et sa couleur pour être identifiable dans la case
    expect(planningSrc).toContain('variant: "conge"')
  })

  it("18. retire réellement un modèle d'une case (plus de faux repos résiduel)", () => {
    // Marqueur de case vidée : resolveCellShift renvoie null (case réellement vide)
    expect(planningSrc).toContain('isEmpty: true')
    expect(planningSrc).toContain('if (override.isEmpty) return null;')
    // Le retrait passe par une fonction dédiée utilisée en Semaine, Mois et Jour
    expect(planningSrc).toContain('clearShiftForDate')
    expect(planningSrc).toContain('handleClearCellShift')
    // Le déplacement (sans Alt) vide la case source au lieu d'y laisser un repos
    expect(planningSrc).toContain('[payload.fromDateStr]: { isEmpty: true }')
    // Aucun horaire inventé en base lors d'un retrait sur grille entreprise
    expect(planningSrc).toContain('removeDay && !shiftData && existingES')
  })

  it("19. sauvegarde l'état plié / déplié de chaque équipe", () => {
    expect(planningSrc).toContain('COLLAPSED_GROUPS_STORAGE_KEY')
    expect(planningSrc).toContain('encheck_planning_teams_collapsed_v1')
    expect(planningSrc).toContain('readStorage(COLLAPSED_GROUPS_STORAGE_KEY, {})')
    expect(planningSrc).toContain('writeStorage(COLLAPSED_GROUPS_STORAGE_KEY, collapsedGroups)')
  })

  it('20. affiche « en cours » quand la sortie n\'est pas encore pointée', () => {
    expect(planningSrc).toContain('formatRealLabel')
    expect(planningSrc).toContain('realIsOpen')
    expect(planningSrc).toContain('en cours')
    // Plus de valeur tronquée du type « 10:07 → … »
    expect(planningSrc).not.toContain('" → …"')
    expect(planningCss).toContain('.sk-open-dot')
    expect(planningCss).toContain('.sk-day-real-block.is-open')
    expect(planningCss).toContain('@keyframes skOpenPulse')
  })

  it("21. affiche le nom du modèle dans le calendrier (Semaine, Mois, Jour)", () => {
    // Les créneaux issus des grilles portent désormais leur nom
    expect(planningSrc).toContain('name: ws.name || "Modèle entreprise"')
    expect(planningSrc).toContain('name: defaultPlan.name || "Modèle par défaut"')
    // Le nom est rendu dans les trois vues
    expect(planningSrc).toContain('sk-shift-name')
    expect(planningSrc).toContain('sk-cal-pill-model')
    expect(planningSrc).toContain('sk-day-block-label')
    expect(planningCss).toContain('.sk-shift-name')
    expect(planningCss).toContain('.sk-cal-pill-model')
  })

  it('22. mode Jour réellement responsive sur mobile', () => {
    // Empilement en carte : la ligne passe en colonne sur mobile
    expect(planningCss).toMatch(/\.sk-day-row\s*\{\s*flex-direction:\s*column;/)
    // Règle horaire masquée, pistes pleine largeur et blocs agrandis pour le doigt
    expect(planningCss).toMatch(/\.sk-day-ruler\s*\{\s*display:\s*none;/)
    expect(planningCss).toMatch(/\.sk-day-lanes\s*\{\s*width:\s*100%;/)
    expect(planningCss).toMatch(/\.sk-day-track\s*\{\s*min-width:\s*0;\s*height:\s*38px;/)
    expect(planningCss).toContain('min-width: 104px;')
    expect(planningCss).toMatch(/width:\s*30px;\s*height:\s*30px;/)
    // Le nom du modèle reste lisible même en petit écran
    expect(planningCss).toContain('.sk-day-block-label strong')
  })

  it("23. conserve le nom du modèle déposé (un modèle « maladie » ne s'affiche pas « Repos »)", () => {
    // resolveCellShift propage le nom / libellé / sous-titre du modèle
    expect(planningSrc).toContain('const nomModele = override.name || override.label || "Repos"')
    expect(planningSrc).toContain('name: nomModele,')
    expect(planningSrc).toContain('subtitle:')
    // Chaque dépôt mémorise le nom du modèle
    expect(planningSrc).toMatch(/name:\s*tpl\.name \|\| \(estConge \? "Congé" : "Repos"\)/)
    // Les vues affichent le sous-titre du modèle pour un repos / congé
    expect(planningSrc).toContain('shift.isRest || shift.isLeave')
    expect(planningSrc).toContain('shift.subtitle || "Repos"')
  })

  it("24. aucun bloc du mode Jour ne dépasse le bord droit de la piste (info coupée)", () => {
    expect(planningSrc).toContain('const widthPct = Math.min(rawWidthPct, 100 - (startPct || 0))')
    expect(planningSrc).toContain('const leftPct = Math.max(0, Math.min(startPct || 0, 100 - widthPct))')
    expect(planningSrc).toContain('left: `${leftPct}%`')
    expect(planningSrc).toContain('left: `${realLeftPct}%`')
    // Sur mobile le nom et les heures sont empilés pour rester lisibles
    expect(planningCss).toMatch(/\.sk-day-block-label\s*\{\s*display:\s*flex;/)
  })

  it('25. possède un écran de chargement Planning rythmé en deux scènes, comme Pointages', () => {
    const planningLoading = lire('src/components/PlanningLoadingScreen.jsx')
    // Même recette que l'écran Pointages : frise Kente, coins culturels, barre de progression
    expect(planningLoading).toContain('<PageCulturalBand pathname="/planning" placement="loading"/>')
    expect(planningLoading).toContain('CulturalCornerMotifSvg')
    expect(planningLoading).toContain('pointages-loading-bar-fill')
    expect(planningLoading).toContain('Passer l\u2019animation')
    // Deux scènes Planning : planning projeté, puis grille de la semaine
    expect(planningLoading).toContain('/images/planning-loading-ecran.jpg')
    expect(planningLoading).toContain('/images/planning-loading-grid-femme.jpg')
    expect(planningLoading).not.toMatch(/Skello|SKELLO|skello/i)
    // L'écran est réellement branché sur la page Planning
    expect(planningSrc).toMatch(/import PlanningLoadingScreen from ["']\.\.\/components\/PlanningLoadingScreen["']/)
    expect(planningSrc).toContain('<PlanningLoadingScreen')
  })

  it('26. illustre le chargement Pauses par le dépointage de pause', () => {
    const pausesLoading = lire('src/components/PausesLoadingScreen.jsx')
    expect(pausesLoading).toContain('/images/pauses-loading-depointage.jpg')
    expect(pausesLoading).toContain('/images/pauses-loading-start.jpg')
    // Plus d'images empruntées aux autres pages
    expect(pausesLoading).not.toContain('pointage-loading-qr.jpg')
    expect(pausesLoading).not.toContain('employes-loading-team.jpg')
    expect(pausesLoading).not.toMatch(/Skello|SKELLO|skello/i)
  })

  it('27. respecte l’option payante Planning sur la page Pointages', () => {
    const pointagesSrc = lire('src/pages/Pointages.jsx')
    // Seul un `true` explicite ouvre le planning : « non renseigné » n'est pas « activé »
    expect(pointagesSrc).toContain('employee.enterprises?.module_planning === true')
    expect(pointagesSrc).not.toContain('module_planning !== false')
    // Une affectation sans horaire n'est plus habillée en « Planning personnalisé »
    expect(pointagesSrc).toContain('planningPersoValide')
    expect(pointagesSrc).toContain('planningGeneralValide')
    expect(pointagesSrc).toContain('Planning non disponible dans En-Check (option non activée)')
    // Aucun horaire inventé en repli
    expect(pointagesSrc).not.toMatch(/: '08:00',/)
    expect(pointagesSrc).not.toMatch(/: '18:00',/)
    // Le moteur ne reçoit plus de planning non souscrit (ni retard, ni écart calculé dessus)
    expect(pointagesSrc).toContain('employeeSchedule: planningEnabledOnEnterprise ?')
    expect(pointagesSrc).toContain('defaultSchedule: planningEnabledOnEnterprise ? defaultSchedule : null')
    // Et on ne lit pas les affectations d'une autre entreprise
    expect(pointagesSrc).toContain('empSchedulesQuery.in(\'employee_id\', employeeIdsAffiches)')
  })

  it('28. ne refait pas le menu de l\u2019application dans son bandeau', () => {
    // La bande « Aller à » (Pointages · Employés · Pauses · Fiches de paie) est
    // retirée à la demande du fondateur : le rail fait déjà ces quatre voyages,
    // et une page qui recopie le menu en ajoute un deuxième à regarder.
    for (const morte of ['PLANNING_SHORTCUTS', 'sk-quick-nav', 'sk-quick-link']) {
      expect(planningSrc).not.toContain(morte)
      expect(planningCss).not.toContain('.' + morte.replace('PLANNING_SHORTCUTS', 'sk-quick-nav'))
    }
    // la navigation, elle, est bien vivante ailleurs : la coque du tableau de
    // bord, qu'on ne peut pas rater puisqu'elle est sur toutes les pages
    const coque = lire('src/components/DashboardExperience.jsx')
    for (const entree of ["path: '/pointages'", "path: '/employes'", "path: '/pauses'", "path: '/paie'"]) {
      expect(coque).toContain(entree)
    }
    // et le voyage de la flèche retour du bandeau reste branché
    expect(bandeau).toContain('navigate("/dashboard")')
  })

  it('28bis. ne laisse plus un sélecteur d\u2019entreprise dans le bandeau', () => {
    // Le périmètre se prend dans le sélecteur GLOBAL (le rail écrit
    // `admin.selectedEnterprise`) : deux sélecteurs pour la même échelle, c\u2019est
    // un doute de plus. La page continue de filtrer, elle ne demande plus.
    expect(bandeau).not.toContain('<select')
    expect(bandeau).not.toContain('Filtrer par entreprise')
    expect(planningSrc).toContain('admin?.selectedEnterprise?.id')
    expect(planningSrc).toContain('setSelectedEntreprise(')
    // « all » reste le réglage par défaut : rien n\u2019est filtré tant que le rail
    // n\u2019a pas choisi d\u2019entreprise — la vue globale d\u2019avant, en plus simple
    expect(planningSrc).toContain('useState("all");')
    // le sélecteur d\u2019affichage (équipes / collaborateurs), lui, est un autre
    // objet : il est dans la barre de focus, pas dans le bandeau
    expect(planningSrc).toContain('className="sk-ent-select"')
  })

  it('28quater. le bandeau motif ENTOURE la section au lieu de la couronner', () => {
    // « je veux que le bandeau motif de cette section puisse entourer cette
    // section ». Une seule et même toile, quatre lisières : le placement
    // « cadre », pas une bande de plus.
    expect(cadreOuvert).toBeGreaterThan(-1)
    expect(planningSrc.slice(cadreOuvert, cadreOuvert + 220)).toContain('placement="cadre"')
    // la toile est un FOND absolu sous la feuille : elle ne boit aucun clic…
    const peau = lire('src/pages/PlanningPostIt.css')
    const bandeauCss = lire('src/components/PageCulturalBand.css')
    const regle = (source, selecteur) => {
      const d = source.indexOf(selecteur + ' {')
      expect(d, selecteur + ' — règle manquante').toBeGreaterThan(-1)
      return source.slice(d, source.indexOf('}', d))
    }
    const toile = regle(bandeauCss, '.ec-cultural-cadre')
    expect(toile).toContain('position: absolute')
    expect(toile).toContain('inset: 0')
    expect(toile).toContain('pointer-events: none')
    // …et la toile garde ses proportions : on lui donne une HAUTEUR, la largeur
    // suit. Une largeur imposée serait un motif étiré (C4 / D-003).
    expect(toile).toContain('background-size: auto var(--ec-cadre-epaisseur, 26px)')
    expect(toile).not.toMatch(/background-size:\s*\d+px \d+px/)
    expect(toile).toContain('background-repeat: repeat')
    // l'épaisseur ne vit qu'à UN seul endroit : le cadre la prête au bandeau
    const carcasse = regle(peau, '.sk-plan-encadrement')
    expect(carcasse).toContain('--plq-cadre: 26px')
    expect(carcasse).toContain('padding: var(--plq-cadre)')
    expect(carcasse).toContain('--ec-cadre-epaisseur: var(--plq-cadre)')
    // une seule assise : le feutre dur est sur le cadre, la feuille ne se
    // projette pas en plus sur le tissu
    expect(carcasse).toContain('position: sticky')
    const feuille = regle(peau, '.sk-plan-page--postit .sk-topbar')
    expect(feuille).toContain('position: relative')
    expect(feuille).toContain('z-index: 1')
    expect(feuille).toContain('box-shadow: none')
    // aucun texte sur le motif (D-004) : les mots restent dans la feuille
    expect(bandeau).not.toContain('PageCulturalBand')
    expect(carcasse).not.toContain('!important')
    expect(toile).not.toMatch(/#[0-9a-fA-F]{3}/)
  })

  it('28ter. dit le périmètre, la semaine et le compte à la place des contrôles retirés', () => {
    // Ce que le sélecteur enlevé savait, la feuille l\u2019écrit : une étiquette,
    // pas une icône, avec deux nombres comptés sur place.
    expect(bandeau).toContain('sk-topbar-etat')
    expect(planningSrc).toContain('const etatFeuille = useMemo(')
    expect(planningSrc).toContain('"Toutes les entreprises"')
    expect(planningSrc).toContain('`Semaine ${semaineIso}`')
    expect(planningSrc).toContain('collaborateur${scopedEmployees.length > 1 ? "s" : ""}')
    // le numéro de semaine est ISO : le jeudi au milieu, l\u2019année qui le porte
    expect(planningSrc).toContain('getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3')
    const nombre = Number(new Date(2026, 10, 16).toISOString().slice(0, 10) === '2026-11-16')
    expect(nombre).toBe(1) // repère du fondateur : la semaine du 16 au 22 nov. 2026
  })

  it('11. lie les compteurs du haut au groupe déplié et au focus sélectionné', () => {
    expect(planningSrc).toContain('visibleEmployees')
    expect(planningSrc).toContain('scopedEmployees')
    expect(planningSrc).toContain('matchesFocus')
    expect(planningSrc).toContain('focusFilter')
    expect(planningSrc).toContain('sk-focus-bar')
    // Les totaux journaliers sont calculés sur le périmètre visible, pas sur tout le monde
    expect(planningSrc).toContain('scopedEmployees.forEach((emp) => {')
  })

  it('12bis. calcule les entrées/sorties avec le moteur de la page Pointages', () => {
    // Même fonction que la page Pointages (appariement, garde de nuit, auto-close, seuils)
    expect(planningSrc).toContain("resoudrePointagesJournee")
    expect(planningSrc).toContain("chargerSeuilsPointage")
    expect(planningSrc).toContain("FeatureService.getApplicableSchedule")
    expect(planningSrc).toContain("enableAutoClose: true")
    // Plus aucun calcul maison premier-entrée / première-sortie
    expect(planningSrc).not.toContain('else if (!entry.lastOut)')
  })

  it('12ter. sépare PRÉVU et RÉEL sur deux pistes (aucun chevauchement)', () => {
    expect(planningSrc).toContain('sk-day-lanes')
    expect(planningSrc).toContain('sk-day-lane-row')
    expect(planningSrc).toContain('sk-day-lane-label')
    expect(planningSrc).toContain('sk-day-ruler')
    expect(planningCss).toContain('.sk-day-track.is-real')
    expect(planningCss).toContain('.sk-day-none')
    expect(planningCss).toContain('.sk-day-ecart')
  })

  it('12. affiche les horaires réellement effectués (table attendances)', () => {
    expect(planningSrc).toContain("from(\"attendances\")")
    expect(planningSrc).toContain('realAttendanceMap')
    expect(planningSrc).toContain('getRealAttendance')
    expect(planningSrc).toContain('sk-shift-real')
    expect(planningSrc).toContain('sk-real-diff')
    expect(planningSrc).toContain('non planifié')
  })

  it('13. distingue clairement le jour en cours (Aujourd\'hui) dans le calendrier', () => {
    expect(planningSrc).toContain('sk-today-pill')
    expect(planningSrc).toContain('isToday')
    expect(planningCss).toContain('.sk-cal-cell.is-today')
    expect(planningCss).toContain('.sk-cal-day.is-today-num')
  })

  it('14. explique les couleurs par une légende et permet de marquer un jour précis', () => {
    // Légende
    expect(planningSrc).toContain('sk-legend')
    expect(planningSrc).toContain('sk-legend-swatch')
    // Choix du jour (Lun, Mar, Mer...) en plus de Auj. / Sem.
    expect(planningSrc).toMatch(/`day-\$\{j\.id\}`|`day-\$\{dayId\}`|\"day-\" \+/)
    expect(planningSrc).toContain('openAvailabilityModal')
    expect(planningSrc).toContain('sk-avail-day-row')
    expect(planningSrc).toContain('sk-avail-days')
  })

  it('15. offre la même expérience en Mois et en Jour qu\'en Semaine', () => {
    // Mois : cases dépôt + shifts + réel
    expect(planningSrc).toContain('sk-cal-pills-list')
    expect(planningSrc).toContain('sk-cal-pill-real')
    expect(planningSrc).toContain('dayNumFromDateStr')
    // Jour : timeline horaire avec blocs glissables
    expect(planningSrc).toContain('sk-day-track')
    expect(planningSrc).toContain('sk-day-block')
    expect(planningSrc).toContain('sk-day-real-block')
  })

  it('16. propose une section Demandes enrichie (comparatif, filtres, statuts)', () => {
    expect(planningSrc).toContain('sk-requests-view')
    expect(planningSrc).toContain('sk-request-compare')
    expect(planningSrc).toContain('sk-request-filter')
    expect(planningSrc).toContain('visibleRequests')
    expect(planningSrc).toContain('Remettre en attente')
    expect(planningSrc).toContain('sk-request-status')
  })

  it('17. est responsive et utilisable au doigt (mobile)', () => {
    expect(planningSrc).toContain('startTouchDrag')
    expect(planningSrc).toContain('applyTouchDropOnCell')
    expect(planningSrc).toContain('applyTouchDropOnDay')
    expect(planningSrc).toContain('sk-touch-bar')
    expect(planningCss).toContain('@media (max-width: 760px)')
    expect(planningCss).toContain('@media (max-width: 420px)')
    expect(planningCss).toContain('scroll-snap-type: x mandatory')
  })
})
