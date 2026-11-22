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
    const peau = lire('src/pages/PlanningPostIt.css')
    expect(planningSrc).toContain('ENCHECK_COLOR_PALETTE')
    expect(planningSrc).toContain('buildShiftGradient')
    expect(planningSrc).toContain('--shift-custom-bg')
    // La grille de la semaine, sous la peau post-it, ne peint plus de dégradé :
    // la page attache aussi la teinte nue du poste, et c'est la feuille qui la
    // lave sur son papier. Le contrat porte donc sur les deux, chacun pour sa peau.
    expect(planningSrc).toContain('"--shift-teinte": shift.color')
    expect(peau).toContain('--plq-postit: color-mix')
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-matrix-card \.sk-shift-card\s*\{[^}]*background-image: none/s
    )
    expect(planningSrc).toContain('--brick-color')
    expect(planningSrc).toContain('sk-color-swatch')
    expect(planningSrc).toContain('Couleur de la case')
    expect(planningCss).toContain('.sk-color-input')
  })

  it('6bis. porte la couleur choisie dans la fenêtre jusqu’à chaque case de la grille', () => {
    // Le fondateur a redemandé la couleur le 22/11 : la teinte d’un poste doit
    // se voir dans la grille, qu’elle ait été choisie pour une case seule ou
    // pour l’horaire entier de la semaine. Deux chemins de donnée, un seul
    // aspect : la feuille lave son papier et peint son ruban avec cette teinte.
    expect(planningSrc).toContain('const COULEUR_HORAIRE_CLE = "couleur-horaire"')
    expect(planningSrc.match(/empOverrides\[COULEUR_HORAIRE_CLE\]\?\.color/g)).toHaveLength(2)
    expect(planningSrc).toContain('[COULEUR_HORAIRE_CLE]: { color: couleur }')
    const peau = lire('src/pages/PlanningPostIt.css')
    expect(peau).toContain('--plq-teinte: var(--shift-teinte, var(--charte-surface2))')
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-matrix-card \.sk-shift-top\s*\{[^}]*--plq-ruban/s
    )
    expect(peau).toMatch(/--plq-postit: color-mix\(in srgb, var\(--plq-teinte\) 24%/)
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

  it('8bis. dit le pied de grille en chiffres, pas en phrase', () => {
    // Le fondateur a relu le pied de la grille : « Effectif: 6 | Lun 16 : 2 pers.
    // (15h) | … » ne se lisait pas. La maquette retenue
    // (docs/maquettes/planning-pied-grille-choix.png) découpe la bande en trois
    // blocs : une tête (l'effectif, en chiffre), sept colonnettes (un jour, ses
    // personnes, ses heures), un récapitulatif chiffré à droite.
    const peau = lire('src/pages/PlanningPostIt.css')
    const pied = planningSrc.slice(
      planningSrc.indexOf('<footer className="sk-bottom-bar">'),
      planningSrc.indexOf('</footer>', planningSrc.indexOf('<footer className="sk-bottom-bar">'))
    )
    expect(pied.length).toBeGreaterThan(400)
    for (const objet of [
      'sk-bottom-tete',
      'sk-bottom-etiquette',
      'sk-bottom-nombre',
      'sk-bottom-legende',
      'sk-bottom-jours',
      'sk-bottom-jour-nom',
      'sk-bottom-jour-chiffre',
      'sk-bottom-jour-heures',
      'sk-bottom-recap',
      'sk-bottom-tampon',
    ]) {
      expect(pied).toContain(objet)
      expect(peau).toContain('.sk-plan-page--postit .' + objet)
    }
    // le jour est porté par DEUX nombres étiquetés, plus une phrase entre
    // parenthèses ; et le vide reste écrit, il ne se tait pas
    expect(pied).toContain('<small>pers.</small>')
    expect(pied).toContain('is-plein')
    expect(pied).toContain('dt.isToday ? "is-today" : ""')
    // un fait, une seule fois : le pied ne répète plus « Effectif » deux fois et
    // ne dit plus « Heures de la semaine » sur les heures du seul lundi
    expect(pied.match(/Effectif/g) || []).toHaveLength(0)
    expect(pied).toContain('Collaborateurs')
    expect(pied).toContain('Jours couverts')
    expect(pied).toContain('Moyenne par jour couvert')
    expect(pied).toContain('<small>Heures de la semaine</small>')
    // et le chiffre du tampon est cumulé, pas copié du premier jour : le « 48h00 »
    // de repli, lui, est sorti de la page (un récapitulatif ne s'invente pas)
    expect(planningSrc).toContain('const heuresSemaine = dailyTotals.reduce(')
    expect(planningSrc).toMatch(/const joursCouverts = dailyTotals\.filter\(\(dt\) => dt\.headcount > 0\)/)
    expect(planningSrc).not.toMatch(/totalDayHoursLabel|summaryDay/)
    expect(planningSrc).not.toMatch(/dailyTotals\[0\][^\n]*48h00/)
    // le geste de dépôt prend la place du chiffre, à la FORME et non à la couleur
    expect(pied).toContain('<span className="sk-bottom-jour-deposer">Déposer ici</span>')
    expect(peau).toMatch(/\.sk-plan-page--postit \.sk-bottom-jour-deposer\s*\{[^}]*dashed/s)
    // et la bande se tient sur téléphone : trois rangées, pas sept colonnes écrasées
    const petit = peau.slice(peau.lastIndexOf('@media (max-width: 700px)'))
    expect(petit).toContain('.sk-plan-page--postit .sk-bottom-bar')
    expect(petit).toContain('.sk-plan-page--postit .sk-bottom-jours')
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
    // commande : il l'encadre (22/11). La page ne porte donc AUCUNE autre bande
    // de motif — ni en haut, ni en bas (« enlève le bandeau motif en bas »,
    // 22/11) — et le filigrane du pied de grille a suivi la même règle : la
    // page dit une seule fois d'où elle vient.
    expect(planningSrc).toContain('<PageCulturalBand pathname="/planning" placement="cadre" />')
    expect(planningSrc).not.toContain('placement="bottom"')
    expect(planningSrc).not.toContain('AdinkraWatermarkSvg')
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

  it('25. emprunte à la page Employés sa carte de chargement, en quatre étapes', () => {
    // « Je veux le même style de loading comme la page employé », 22/11. La
    // carte est PRÊTÉE, pas recopiée : un seul composant, deux pages. Et le
    // fondateur a écarté le dessin en SVG : la scène est une image.
    const planningLoading = lire('src/components/PlanningLoadingScreen.jsx')
    const carte = lire('src/components/EmployesLoadingScreen.jsx')
    expect(planningLoading).toContain('<EmployesLoadingScreen')
    expect(planningLoading).toContain('dossierImages="/images/planning-loading-"')
    expect(planningLoading).toContain('imageScene="/images/planning-loading-scene.webp"')
    expect(planningLoading).not.toMatch(/<svg|CulturalCornerMotifSvg/)
    // les quatre étapes sont celles que la page traverse vraiment, dans l'ordre
    expect(planningLoading).toContain('export const ETAPES_CHARGEMENT_PLANNING')
    for (const mot of ['Modèles', 'Collaborateurs', 'Horaires & dispos', 'Grille de la semaine']) {
      expect(planningLoading).toContain(mot)
    }
    // le kuba reste dans la carte : un seul motif par écran, la page ne portant
    // plus sa bande de pied depuis le même jour
    expect(planningLoading).toContain('<PageCulturalBand pathname="/planning" placement="loading" />')
    // la carte, elle, accepte l'emprunt sans dupliquer la file de personnages
    expect(carte).toContain('dossierImages')
    expect(carte).toContain('sceneUnique')
    expect(carte).toContain('imageScene ?? ')
    expect(carte).toContain('pointages-loading-bar-fill')
    expect(carte).toContain('Passer l\u2019animation')
    // et le pourcentage est branché sur la donnée réelle, pas sur le minuteur
    expect(planningSrc).toContain('dataReady={!loading}')
    expect(planningSrc).toMatch(/import PlanningLoadingScreen from ["']\.\.\/components\/PlanningLoadingScreen["']/)
    expect(planningSrc).toContain('<PlanningLoadingScreen')
    expect(planningLoading).not.toMatch(/Skello|SKELLO|skello/i)
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

  it('29. le dock des modèles et la bande des filtres portent la peau de la feuille', () => {
    // Le fondateur a choisi une maquette pour cette section, et la règle 5 de la
    // carte de poste veut qu'une maquette se maquette EN CODE : le contrat vit
    // donc dans la feuille, pas dans une image. Ce test-là vérifie que le code
    // dit bien ce que la peau promet.
    const peau = lire('src/pages/PlanningPostIt.css')
    const regle = (selecteur) => {
      const d = peau.indexOf(selecteur + ' {')
      expect(d, selecteur + ' — règle manquante').toBeGreaterThan(-1)
      return peau.slice(d, peau.indexOf('}', d))
    }

    // deux feuilles de plus, la même assise que le bandeau, un seul objet posé
    const feuilles = regle('.sk-plan-page--postit .sk-dock-panel,\n.sk-plan-page--postit .sk-focus-bar')
    expect(feuilles).toContain('border: var(--charte-trait) solid var(--charte-encre)')
    expect(feuilles).toContain('border-radius: 0')
    expect(feuilles).toContain('background-color: var(--charte-surface)')
    expect(feuilles).toContain('backdrop-filter: none')
    expect(feuilles).toContain('overflow: visible')
    expect(feuilles).toContain('color: var(--charte-encre)')
    // le rognage tuerait le rabat et l'assise — faute déjà payée, donc vérifiée
    expect(feuilles).not.toContain('overflow: hidden')

    // la bande de colle ne se pose QUE sur la feuille du dock : la seconde note
    // a son rabat, pas son ruban (c'est ce que la maquette retenue montre)
    const dock = regle('.sk-plan-page--postit .sk-dock-panel')
    expect(dock).toContain('background-image: linear-gradient(')
    expect(dock).toContain('padding-top: calc(var(--plq-pli) + var(--charte-espace-4))')
    expect(peau).toContain('.sk-plan-page--postit .sk-dock-panel::after,')
    expect(peau).toContain('.sk-plan-page--postit .sk-focus-bar::after')

    // les trois gestes : capitales 9,5 / 700 sous contour d'encre (C11, C12),
    // plus de pilule pointillée dorée
    const geste = regle('.sk-plan-page--postit .sk-dock-add-btn')
    expect(geste).toContain('text-transform: uppercase')
    expect(geste).toContain('font-size: var(--charte-taille-bouton)')
    expect(geste).toContain('font-weight: 700')
    expect(geste).toContain('border: var(--charte-trait) solid var(--charte-encre)')
    expect(geste).toContain('border-radius: var(--charte-rayon-champ)')
    // et le survol remue l'assise, il ne repeint pas le mot
    expect(regle('.sk-plan-page--postit .sk-dock-add-btn:hover')).toContain(
      'box-shadow: var(--charte-ombre-dure)'
    )

    // les briques : la teinte du modèle reste une DONNÉE sur le bord gauche
    const brique = regle('.sk-plan-page--postit .sk-brick')
    expect(brique).toContain('border-left: 6px solid var(--brick-color, var(--charte-encre))')
    expect(brique).toContain('background-color: var(--plq-lave)')
    expect(brique).toContain('box-shadow: var(--charte-ombre-dure)')
    // les deux états d'une brique se lisent dans la FORME, pas dans une teinte
    expect(regle('.sk-plan-page--postit .sk-brick.is-armed')).toContain('translate(-2px, -2px)')
    expect(regle('.sk-plan-page--postit .sk-brick.is-copie')).toContain('dashed')

    // la légende s'écrit en encre pleine, plus en gris de remplissage
    expect(regle('.sk-plan-page--postit .sk-legend-item')).toContain('color: var(--charte-encre)')
    expect(regle('.sk-plan-page--postit .sk-legend-swatch')).toContain(
      'background-color: var(--brick-color, transparent)'
    )
    // le rouge de la pause barrée vient des statuts de la maison, pas d'un rose
    // importé qui ne se lit pas en nuit
    expect(regle('.sk-plan-page--postit .sk-legend-pause-barree')).toContain(
      'var(--charte-statut-absent)'
    )

    // aucune taille hors des trois de la charte dans toute la feuille, et pas
    // d'`!important` — la feuille de la section se tient par son poids propre
    const horsCommentaires = peau.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(horsCommentaires).not.toContain('!important')
    expect(horsCommentaires).not.toContain('clip-path')
    for (const taille of horsCommentaires.matchAll(/font-size:\s*([^;]+);/g)) {
      expect(taille[1].trim()).toMatch(/^var\(--charte-taille-(titre|corps|micro|bouton)\)$/)
    }
    for (const rayon of horsCommentaires.matchAll(/border-radius:\s*([^;]+);/g)) {
      expect(['0', 'var(--charte-rayon-champ)', 'var(--charte-rayon-carte)', 'var(--charte-rayon-badge)']).toContain(
        rayon[1].trim()
      )
    }
    // le liseré de toile que la maquette dessinait sur le bord du dock n'est PAS
    // repris : la page a déjà sa bande de motif, le cadre du bandeau (D-003)
    expect(peau).not.toMatch(/\.sk-dock-panel[^}]*background-image:[^}]*planning-kuba/s)
    expect(planningSrc).not.toMatch(/sk-dock-panel[^>]*kuba/)
  })

  it('29bis. la légende lit les teintes sur le modèle au lieu de les recopier', () => {
    // Cinq pastilles peintes à la main dans le rendu, c'est une légende qui peut
    // mentir : elle a survécu à deux changements de palette sans bouger.
    expect(planningSrc).toContain('const LEGENDE_TEINTES = [')
    expect(planningSrc).toContain('DEFAULT_DOCK_TEMPLATES.find((modele) => modele.id === cle)')
    expect(planningSrc).toContain('{LEGENDE_TEINTES.map((teinte) => (')
    // la teinte passe en donnée, comme sur la brique — plus de couleur en ligne
    expect(planningSrc).not.toMatch(/sk-legend-swatch" style=\{\{ background:/)
    expect(planningSrc).toContain('"--brick-color": teinte.teinte')
    // et les trois puces de disponibilité sont LES MÊMES que dans la fenêtre de
    // disponibilités : une légende, une grille, une seule couleur par état
    const bandeLegende = planningSrc.slice(
      planningSrc.indexOf('<span className="sk-legend-title">Disponibilité</span>'),
      planningSrc.indexOf('Types de cartes')
    )
    expect(bandeLegende).toContain('sk-avail-legend-dot is-on')
    expect(bandeLegende).toContain('sk-avail-legend-dot is-off')
    expect(bandeLegende).toContain('className="sk-avail-legend-dot"')
    expect(bandeLegende).not.toMatch(/style=\{\{/)
  })

  it('29ter. la consigne du dock se pose sous les gestes, et le titre a un mot à souligner', () => {
    // la maquette retenue montre la mention en travers de la feuille, pas un
    // quatrième bouton aligné avec les actions
    const actions = planningSrc.indexOf('className="sk-dock-actions"')
    const consigne = planningSrc.indexOf('className="sk-dock-hint"')
    const briques = planningSrc.indexOf('className="sk-dock-bricks"')
    expect(actions).toBeGreaterThan(-1)
    expect(consigne).toBeGreaterThan(actions)
    expect(consigne).toBeLessThan(briques)
    // le titre est un mot, pas une chaîne noyée dans le bouton : c'est lui qui
    // reçoit le double trait de feutre, comme sur le bandeau de commande
    expect(planningSrc).toContain('<span className="sk-dock-titre">')
    const peau = lire('src/pages/PlanningPostIt.css')
    expect(peau).toContain('.sk-plan-page--postit .sk-dock-titre::after')
    expect(peau).toContain('box-shadow: 2px 4px 0 0 var(--charte-encre)')
    // et la section entière se tient sur téléphone : une brique par rangée, la
    // légende en colonne
    const petit = peau.slice(peau.lastIndexOf('@media (max-width: 700px)'))
    expect(petit).toContain('.sk-plan-page--postit .sk-dock-bricks')
    expect(petit).toContain('grid-template-columns: 1fr')
    expect(petit).toContain('.sk-plan-page--postit .sk-legend')
  })

  it('30. les huit fenêtres du Planning portent la feuille et ne se peignent plus elles-mêmes', () => {
    // « Retravaille les modales de la page planning », 22/11, sur la maquette
    // choisie : un ruban de scotch en travers du haut, un coin plié en haut à
    // droite qui abrite le ×, un titre centré à double trait, des champs à
    // angle droit, un pied séparé d'un pointillé. Le contrat est double : la
    // feuille habille, et le JSX, lui, ne peint plus rien.
    const peau = lire('src/pages/PlanningPostIt.css')
    const debut = planningSrc.indexOf('sk-modal-backdrop')
    const fin = planningSrc.lastIndexOf('sk-modal-foot')
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    const fenetres = planningSrc.slice(debut, fin)
    expect(fenetres.length).toBeGreaterThan(6000)
    // dans les fenêtres, un style en ligne ne porte DÉSORMAIS PLUS qu'une
    // donnée nommée (une teinte choisie dans la fenêtre), jamais de la peinture
    const attribues = [...fenetres.matchAll(/style=\{\{\s*"([^"]+)"/g)].map((m) => m[1])
    expect(attribues).toHaveLength(3)
    expect(attribues.every((nom) => nom.startsWith('--'))).toBe(true)
    expect(fenetres).not.toMatch(/style=\{\{[^}]*background:/)
    expect(fenetres).not.toMatch(/color="#/)
    // la seule couleur en dur qui reste est la valeur de l'entrée native de
    // couleur : un `input type="color"` ne connaît pas les variables
    expect(fenetres.match(/#[0-9A-Fa-f]{6}/g)).toHaveLength(1)
    // la feuille, elle : voile sans flou, ruban, rabat, double trait au titre
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-modal-backdrop\s*\{[^}]*backdrop-filter: none/s
    )
    expect(peau).toContain('background: var(--charte-modale-voile)')
    expect(peau).toContain('.sk-plan-page--postit .sk-modal-box::before')
    expect(peau).toContain('.sk-plan-page--postit .sk-modal-box::after')
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-modal-title::after\s*\{[^}]*box-shadow: 2px 4px 0 0 var\(--charte-encre\)/s
    )
    // et la peau d'origine de la page a bien reçu ce que le JSX lui rendait
    expect(planningCss).toContain('.sk-modal-box--petite')
    expect(planningCss).toContain('.sk-modal-pied-ligne')
    expect(planningCss).toContain('.sk-field-label--geste')
    expect(planningCss).toContain('.sk-modele-apercu')
    expect(planningCss).toContain('background-color: var(--pastille')
    // les deux largeurs connaissent les fenêtres : le ruban s'élargit, le pied
    // se partage les gestes, la disponibilité passe en colonne
    const petit = peau.slice(peau.lastIndexOf('@media (max-width: 700px)'))
    expect(petit).toContain('.sk-plan-page--postit .sk-modal-backdrop')
    expect(petit).toContain('.sk-plan-page--postit .sk-avail-day-row')
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
