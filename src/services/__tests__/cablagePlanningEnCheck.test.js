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
    // l'état replié est Nommé dans la classe : c'est lui qui ouvre le geste de
    // rangement (contrat 38), et la peau le dessine
    expect(planningSrc).toContain('className={`sk-group-row ${isCollapsed ? "is-collapsed" : ""}')
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
    // La fenêtre commande la teinte de l'horaire entier, son étiquette le dit
    expect(planningSrc).toContain("Couleur de l'horaire")
    expect(planningCss).toContain('.sk-color-input')
  })

  it('6bis. porte la couleur choisie dans la fenêtre jusqu’à chaque case de la grille', () => {
    // Le fondateur a redemandé la couleur le 22/11 : la teinte d’un poste doit
    // se voir dans la grille, qu’elle ait été choisie pour une case seule ou
    // pour l’horaire entier de la semaine. Deux chemins de donnée, un seul
    // aspect : la feuille lave son papier et peint son ruban avec cette teinte.
    expect(planningSrc).toContain('const COULEUR_HORAIRE_CLE = "couleur-horaire"')
    // TOUTES les branches de résolution peignent, y compris le modèle par défaut
    // de l'entreprise et la case surchargée : une branche qui oublierait `teinte`
    // est une case qui reste grise sans que rien ne le dise.
    expect(planningSrc.match(/color: teinte,/g)).toHaveLength(4)
    // La teinte de la ligne se lit à DEUX endroits seulement — la chaîne de
    // résolution et la fenêtre, qui doit montrer ce qui est en place.
    expect(planningSrc.match(/empOverrides\[COULEUR_HORAIRE_CLE\]\?\.color/g)).toHaveLength(1)
    // Un seul calcul de la teinte, une seule portée à la fois.
    // …et depuis le 23/11, cette valeur passe par le contrôle de format avant
    // de servir : une teinte de brouillon local qui n'est pas un hexadécimal ne
    // peut plus atteindre la base. Le contrat suit l'écriture, pas les mots
    // d'avant — il vérifie la même chose (un seul calcul) et une de plus.
    const calcul = planningSrc.match(
      /const couleur = teinteDemandee\.teinte \|\| TEINTE_PAR_DEFAUT;/g
    )
    expect(calcul).toHaveLength(1)
    expect(planningSrc).toContain('normaliserTeinte(employeeScheduleForm.custom_color)')
    // la fenêtre relit la teinte EN PLACE avant de l'afficher — celle de la case
    // visée d'abord — sinon enregistrer une seconde fois effaçait ce que la
    // première avait peint ;
    expect(planningSrc).toContain('custom_color: teinteEnCours')
    expect(planningSrc.match(/custom_color: teinteEnCours/g)).toHaveLength(2)
    expect(planningSrc).toContain('existingES?.custom_day_colors?.[dayItem.dateStr]')
    // la teinte de départ vient de la palette, plus d'un hexa recopié trois fois :
    // la fenêtre, le payload, le champ libre, et le retour en arrière d'une case.
    expect(planningSrc).toContain('const TEINTE_PAR_DEFAUT = ENCHECK_COLOR_PALETTE[0].value')
    // quatre endroits relisent la palette au lieu de recopier un hexa. Depuis le
    // 23/11, l'un d'eux s'écrit sur la valeur normalisée (`teinteDemandee`),
    // parce que la fenêtre replie d'abord ce qu'elle tient sur la première
    // teinte de la palette — le compte est le même, l'orthographe a suivi.
    expect(
      planningSrc.match(
        /custom_color: TEINTE_PAR_DEFAUT|custom_color \|\| TEINTE_PAR_DEFAUT|teinteDemandee\.teinte \|\| TEINTE_PAR_DEFAUT/g
      )
    ).toHaveLength(4)
    // La case ciblée garde le nom de son modèle : la surcharge locale ne le portait pas.
    expect(planningSrc).toContain('name: cellEditContext.shiftName || "Horaire personnalisé"')
    const peau = lire('src/pages/PlanningPostIt.css')
    expect(peau).toContain('--plq-teinte: var(--shift-teinte, var(--charte-surface2))')
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-matrix-card \.sk-shift-top\s*\{[^}]*--plq-ruban/s
    )
    expect(peau).toMatch(/--plq-postit: color-mix\(in srgb, var\(--plq-teinte\) 24%/)
  })

  it('6ter. peint la case, pas seulement le projet — et garde la teinte en base', () => {
    // Le 22/11, le fondateur est revenu une troisième fois : « encore tu nas pas
    // coloré les cases selon la couleur que j'ai choisi ». Deux manquements,
    // chacun verrouillé ici. UN · la cascade : une variable personnalisée se
    // calcule là où elle est écrite, donc `--plq-teinte` devait descendre sur la
    // carte, qui porte le style en ligne, et non rester sur le conteneur.
    // DEUX · la persistance : la teinte ne vivait que dans le `localStorage` de
    // ce navigateur, invisible d'un autre poste et perdue au moindre nettoyage.
    const peau = lire('src/pages/PlanningPostIt.css')
    const regle = (source, selecteur) => {
      const d = source.indexOf(selecteur + ' {')
      expect(d, selecteur + ' — règle manquante').toBeGreaterThan(-1)
      return source.slice(d, source.indexOf('}', d))
    }
    const carte = regle(peau, '.sk-plan-page--postit .sk-matrix-card .sk-shift-card')
    const conteneur = regle(peau, '.sk-plan-page--postit .sk-matrix-card')
    // la teinte et ses deux dérivés se calculent SUR LA CARTE
    expect(carte).toContain('--plq-teinte: var(--shift-teinte, var(--charte-surface2))')
    expect(carte).toContain('--plq-postit: color-mix(in srgb, var(--plq-teinte) 24%')
    expect(carte).toContain('--plq-ruban: color-mix(in srgb, var(--plq-teinte) 58%')
    // le conteneur ne prétend plus lire une variable qu'il ne peut pas voir
    expect(conteneur).not.toContain('var(--shift-teinte')
    // et la page attache bien la teinte sur CE nœud-là : sinon la règle est
    // juste et le rendu reste gris — c'était exactement le cas avant ce correctif
    const noeud = planningSrc.slice(
      planningSrc.indexOf('className={`sk-shift-card variant-${'),
      planningSrc.indexOf('"--shift-custom-bg"')
    )
    expect(noeud).toContain('"--shift-teinte": shift.color || undefined')

    // LA PERSISTANCE. La colonne est ajoutée par une migration du dépôt, seule
    // façon de la faire exister côté serveur ; elle est nullable (rien n'est
    // repeint d'office) et son format est contraint, pour qu'une valeur mal
    // formée ne se retrouve pas dans un `style` en ligne où elle serait muette.
    const migration = lire('supabase/migrations/20261122000002_teinte_horaire_collaborateur.sql')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS custom_color text')
    expect(migration).toContain('custom_color IS NULL OR custom_color')
    // la teinte de la LIGNE ne part en base que quand la fenêtre n'est pas ouverte
    // sur une case — voir 6quater, qui verrouille la portée
    const ecriture = planningSrc.slice(
      planningSrc.indexOf('const handleSaveEmployeeSchedule = async () => {'),
      planningSrc.indexOf('Planning collaborateur enregistré')
    )
    expect(ecriture).toContain('.from("employee_schedules")')
    expect(ecriture).toContain(': { custom_color: couleur }),')
    // la page relit la base (select *), et la fenêtre aussi : pas de second
    // endroit où la couleur pourrait se perdre
    expect(planningSrc).toContain('es?.custom_color')
    expect(planningSrc).toContain('existingES?.custom_color ||')
    // aucune valeur de couleur ajoutée dans le SQL de la migration
    expect(migration).not.toMatch(/#[0-9a-fA-F]{6}'/)
  })

  it('6quater. une case choisit SA teinte, et la ligne ne déborde pas dessus', () => {
    // Quatre heures après la correction précédente, le fondateur renvoie une
    // capture : deux cases de la même ligne, le même violet. « chaque case doit
    // avoir sa propre couleur qu'on choisit, et non appliquer la couleur choisie
    // à toutes les cases sur la même ligne ». La fenêtre servait aux deux
    // portées et n'écrivait qu'à une seule adresse. Trois verrous.

    // 1 · L'ÉCRITURE EST SCOPÉE. Une date visée écrit dans la carte des teintes
    // par jour et ne touche pas à `custom_color` ; sans date, c'est l'inverse.
    const ecriture = planningSrc.slice(
      planningSrc.indexOf('const handleSaveEmployeeSchedule = async () => {'),
      planningSrc.indexOf('Planning collaborateur enregistré')
    )
    expect(ecriture).toContain('const dateCible = cellEditContext?.dateStr || null;')
    expect(ecriture).toContain('...(dateCible')
    expect(ecriture).toContain('[dateCible]: couleur,')
    expect(ecriture).toContain(': { custom_color: couleur }),')
    // la carte se FUSIONNE avec ce qui est déjà en base : peindre un mardi ne
    // doit pas effacer le vendredi d'à côté. L'extension passe par
    // `carteDeTeintes`, qui refuse de fusionner une valeur qui n'est pas un
    // objet — `{..."abc"}` fabrique des clés "0", "1", "2" et le CHECK de la
    // colonne répond 400. Depuis le 23/11, la garde va plus loin : une teinte
    // mal formée d'un JOUR QU'ON NE TOUCHE PAS est retirée de la carte, sinon
    // elle condamnerait l'enregistrement du jour en cours (contrat 40).
    expect(ecriture).toContain('...carteJour.carte,')
    expect(ecriture).toContain('const carteJour = carteDeTeintes(ligneExistante);')
    expect(ecriture).toContain('carteJour.retirees')
    // et le brouillon local non plus ne remplace plus la ligne entière
    expect(ecriture).toContain(
      'const cetEmploye = { ...(prev[employeeScheduleForm.employee_id] || {}) };'
    )
    expect(ecriture).not.toContain('const surcharges = { [COULEUR_HORAIRE_CLE]')
    // la clé de la ligne ne peut plus être écrite depuis une case
    expect(ecriture.match(/cetEmploye\[COULEUR_HORAIRE_CLE\] = \{ color: couleur \};/g)).toHaveLength(
      1
    )
    expect(ecriture.indexOf('if (dateCible) {')).toBeLessThan(
      ecriture.indexOf('cetEmploye[COULEUR_HORAIRE_CLE]')
    )

    // 2 · LA LECTURE EST ORDONNÉE. La case (brouillon, puis base) avant la ligne
    // (base, puis brouillon). Un `indexOf` suffit à dire l'ordre, et c'est
    // l'ordre qui est la correction.
    const chaine = planningSrc.slice(
      planningSrc.indexOf('const teinteDeLaCase ='),
      planningSrc.indexOf('if (override) {')
    )
    expect(chaine).toContain('override?.color ||')
    expect(chaine).toContain('es?.custom_day_colors?.[dateStr] ||')
    expect(chaine.indexOf('teinteDeLaCase')).toBeLessThan(chaine.indexOf('es?.custom_color'))

    // 3 · LE VIEUX BROUILLON NE DÉBORDE PLUS. La clé de ligne laissée dans un
    // `localStorage` par l'ancien code signifiait autrefois « peins les sept
    // jours depuis un seul jour » : elle est jetée au montage, pas relue.
    const hydratation = planningSrc.slice(
      planningSrc.indexOf('const [dayOverrides, setDayOverrides] = useState('),
      planningSrc.indexOf('// Modals existants')
    )
    expect(hydratation).toContain('delete reste[COULEUR_HORAIRE_CLE]')

    // LA COLONNE. `custom_day_colors` naît d'une migration du dépôt, nullable,
    // contrainte à un objet dont chaque valeur est un hexa de six chiffres.
    const migration = lire('supabase/migrations/20261122000004_teinte_case_par_case.sql')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS custom_day_colors jsonb')
    expect(migration).toContain("jsonb_typeof(custom_day_colors) = 'object'")
    expect(migration).toContain('like_regex')

    // LA PORTÉE SE LIT DANS LA FENÊTRE. Un champ qui ne dit pas ce qu'il change
    // est une promesse qu'on doit deviner.
    expect(planningSrc).toContain('Couleur du ${jourViseParLaCase(cellEditContext.dateStr)}')
    expect(planningSrc).toContain('"Couleur de l\'horaire"')
    expect(planningSrc).toContain('Une seule case : les six autres gardent leur teinte')
    expect(planningSrc).toContain('Toute la ligne, pour les jours qui n\'ont pas encore choisi')

    // ET ELLE EST RÉVERSIBLE. Une teinte par case qui ne peut pas être ôtée est une
    // case qu'on n'ose plus toucher.
    expect(planningSrc).toContain('const handleRetirerTeinteDeLaCase = async () => {')
    const retrait = planningSrc.slice(
      planningSrc.indexOf('const handleRetirerTeinteDeLaCase = async () => {'),
      planningSrc.indexOf('const jourViseParLaCase =')
    )
    expect(retrait).toContain('delete carte[dateStr];')
    expect(retrait).toContain('delete sansTeinte.color;')
    expect(retrait).toContain('.from("employee_schedules")')
    expect(planningSrc).toContain("Reprendre la teinte de l'horaire")
  })

  it('7. suit le thème de l\u2019application sans le commander dans son bandeau', () => {
    // Le fondateur a retiré le bouton du bandeau le 22/11 : le thème est un
    // choix de l\u2019application, pas d\u2019une page. Ce contrat dit donc le
    // contraire de l\u2019ancien — et il est plus dur, pas plus souple : la page
    // doit OBÉIR au thème global et ne plus lever la main dessus.
    // Le basculeur passe par la barre, et PAR ELLE SEULE : la page le prête,
    // elle ne le commande pas. Le contrat est donc plus étroit qu'avant — une
    // occurrence, et c'est celle du prop.
    // compté hors commentaires : ce qui est écrit pour le lecteur n'est pas un
    // geste de la page
    const code = planningSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code.match(/toggleTheme/g)).toHaveLength(2) // le déstructurer + le prêter
    const blocBarre = planningSrc.slice(
      planningSrc.indexOf('<SidebarUnique'),
      planningSrc.indexOf('sk-plan-topbar-note')
    )
    expect(blocBarre).toContain('darkMode={darkMode}')
    expect(blocBarre).toContain('surDeconnexion={deconnexion}')
    expect(planningSrc).toContain('surTheme={toggleTheme}')
    expect(planningSrc).not.toContain('sk-theme-btn')
    expect(planningSrc).toContain('const { darkMode, toggleTheme } = useTheme();')
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
    // Le nom est rendu dans les trois vues. Dans le Mois, depuis le 23/11, la place
    // du nom du modèle est prise par le nom de la PERSONNE (direction B : « le mois
    // dit qui est là ») ; sk-cal-pill-model ne subsiste que pour le modèle DÉPOSÉ sur
    // la journée, qui est exactement ce qu'il est.
    expect(planningSrc).toContain('sk-shift-name')
    expect(planningSrc).toContain('sk-mois-nom')
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
    // AUCUN bandeau de motif dans la carte de chargement : « Enlève le bandeau
    // motif qui est dans la page loading », 22/11 au second regard. La carte est
    // un compte rendu, pas une tribune décorative ; la page, elle, garde sa toile
    // dans le cadre du bandeau de commande.
    expect(planningLoading).not.toContain('PageCulturalBand')
    expect(planningLoading).not.toContain('ruban')
    expect(carte).not.toContain('PageCulturalBand')
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

  it('25bis. anime la scène du chargement par le cadrage, pas par un décor posé dessus', () => {
    // « Anime cette scène (comment peux-tu l'animer?) », 22/11. Réponse : la
    // scène est UNE image validée — on ne lui colle pas de faux post-it par-
    // dessus (le fondateur a déjà retiré ce procédé), on la FILME. Quatre
    // cadrages, un par étape réelle ; une respiration lente ; une lumière qui
    // traverse la salle ; et quand les données arrivent, l'objectif recule.
    const carte = lire('src/components/EmployesLoadingScreen.jsx')
    const peau = lire('src/components/EmployesLoadingScreen.css')
    // les crochets du sélecteur sont échappés : sinon ils deviennent une classe
    // de caractères et la recherche ne trouve plus la règle
    const scene = '\\.emp-loading-stage\\[data-artwork="page-scene-illustration"\\]'
    // le plateau sait qu'il est filmé : il publie son étape et son état
    expect(carte).toContain('data-step={dataReady ? etapes.length : etapeCourante}')
    expect(carte).toContain("' est-pret'")
    // quatre cadrages, chacun avec son grossissement et son point regardé
    for (const pas of [1, 2, 3, 4]) {
      const regle = peau.match(
        new RegExp(scene + '\\[data-step="' + pas + '"\\]\\s*\\{([^}]*)\\}', 's')
      )
      expect(regle, `cadrage ${pas} manquant`).toBeTruthy()
      expect(regle[1]).toContain('--scene-k:')
      expect(regle[1]).toContain('--scene-x:')
      expect(regle[1]).toContain('--scene-y:')
    }
    // le point regardé porte l'image : jamais de bord vide, donc jamais de cache
    expect(peau).toMatch(/\.emp-loading-approved \{\s*transform-origin: var\(--scene-x\) var\(--scene-y\);/)
    expect(peau).toMatch(/transform: scale\(var\(--scene-k\)\);/)
    // un grossissement d'au moins un partout (la couverture le commande)
    for (const k of peau.match(/--scene-k:\s*([0-9.]+)/g)) {
      expect(Number(k.split(':')[1])).toBeGreaterThanOrEqual(1)
    }
    // le mouvement est animé, pas brut
    expect(peau).toMatch(/transition: transform 900ms ease-in-out/)
    expect(peau).toContain('@keyframes emp-scene-haleine')
    expect(peau).toContain('@keyframes emp-scene-clarte')
    // l'état prêt commande les cadrages : il est écrit après eux et recule
    const pret = peau.indexOf('.est-pret {')
    const der = peau.indexOf('[data-step="4"]')
    expect(pret).toBeGreaterThan(der)
    expect(peau.slice(pret, pret + 220)).toMatch(/--scene-k: 1\.0\d/)
    // aucun pixel nouveau sur l'image : pas de calque, pas de carte factice
    expect(peau).not.toMatch(/page-scene-illustration[^{]*\{[^}]*url\(/)
    // et « réduire les animations » garde la salle entière, immobile
    const réduit = peau.slice(peau.indexOf('@media (prefers-reduced-motion: reduce)'))
    // la respiration est couverte par la règle générale du plateau
    expect(réduit).toMatch(/\.emp-loading-stage \*,\s*\.emp-loading-dot \{\s*animation: none !important;/)
    expect(réduit).toMatch(/\.emp-loading-approved \{\s*transform: none;/)
    expect(réduit).toMatch(/::after \{\s*display: none;/)
    // aucune couleur nouvelle dans cette peau (la lumière vient du blanc de la maison)
    expect(peau.match(/#[0-9A-Fa-f]{3,8}/g) || []).toHaveLength(0)
    expect(peau).not.toMatch(/\bblur\(/)
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
    // quatre, et pas trois, depuis le 08/12 : la fenêtre de la case vide donne
    // aux briques du dock leur teinte (`--brick-color`), exactement l'autre
    // espèce de style en ligne tolérée ici — une DONNÉE nommée, jamais de la
    // peinture. C'est la règle d'en dessous qui tient : tout commence par `--`.
    expect(attribues).toHaveLength(4)
    expect(attribues.every((nom) => nom.startsWith('--'))).toBe(true)
    expect(fenetres).not.toMatch(/style=\{\{[^}]*background:/)
    expect(fenetres).not.toMatch(/color="#/)
    // et depuis le 22/11, plus AUCUNE : la valeur de départ de l'entrée native de
    // couleur se lit sur la palette (`TEINTE_PAR_DEFAUT`), elle n'est plus recopiée
    // en hexa dans la fenêtre
    expect(fenetres.match(/#[0-9A-Fa-f]{6}/g)).toBeNull()
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
    // Mois : un rang par PERSONNE, son état écrit en mot, et les modèles déposés.
    // La pastille de shift avec sa sous-puce de réel est l'objet d'avant le 23/11 :
    // à l'échelle d'un mois elle tronquait le nom à 78 px et répétait trente fois la
    // même norme. L'info n'a pas disparu, elle a changé de porte : le rang la titre
    // (infobulle du réel) et la vue Jour l'affiche en entier.
    expect(planningSrc).toContain('sk-mois-rang')
    expect(planningSrc).toContain('sk-mois-tampon')
    expect(planningSrc).toContain('sk-cal-pills-list')
    expect(planningSrc).toContain('titreReelDuJour')
    expect(planningSrc).toContain('dayNumFromDateStr')
    expect(planningSrc).not.toContain('sk-cal-pill-real')
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

  it('31. tient le mois dans son cadre et dit qui est là, jour par jour', () => {
    // Le bloc du mois, isolé : ces contrats-là portent sur UN écran, pas sur le
    // fichier entier — une assertion sur tout Planning.jsx ne dirait pas où.
    const mois = planningSrc.slice(
      planningSrc.indexOf('{planningView === "mois" && ('),
      planningSrc.indexOf('{/* 5. VUE DEMANDES DES COLLABORATEURS')
    )
    expect(mois.length).toBeGreaterThan(2000)

    // UNE SEULE GRILLE, et un gabarit qui ne peut pas déborder. `1fr` vaut
    // `minmax(auto, 1fr)` : sous ce régime, la largeur MINIMALE d'une pastille
    // `nowrap` poussait sa colonne, les six premières gonflaient et la septième —
    // le dimanche — s'écrasait et se peignait hors du panneau (la peau rend la carte
    // `overflow: visible` pour laisser respirer le rabat).
    expect(mois).toContain('<div className="sk-matrix-scroll">')
    expect(mois).toContain('<div className="sk-mois sk-mois--effectif">')
    // `null`, pas `[]` : l'absence est la preuve cherchée — plus aucun gabarit
    // écrit en style en ligne dans le mois, il n'y a qu'une grille et elle est
    // habillée par la feuille.
    expect(mois.match(/gridTemplateColumns/g)).toBeNull()
    expect(mois).toContain('joursSemaine.map')
    // le gabarit n'est plus écrit dans le style en ligne de la page : le commentaire
    // du bloc, lui, a le droit de nommer l'ancien défaut pour expliquer le nouveau
    expect(mois).not.toMatch(/gridTemplateColumns:\s*["']repeat\(7/)

    // CE QUI EST ANNONCÉ et CE QUI EST PEINT sortent du même calcul. La case du 25,
    // sur la capture du fondateur, annonçait « 1 modèle(s) • 5 perso » sans montrer
    // personne : le compteur filtrait sur le jour de SEMAINE, les pastilles sur la
    // DATE.
    expect(planningSrc).toContain('const moisParJour = (() => {')
    expect(mois).toContain('moisParJour.get(cell.date)')
    expect(mois).toContain('semainesDuMois.map')
    expect(mois).toContain('jour.rangs.length ? (')

    // le MOT, jamais la couleur seule (C7), et plus de jargon de compteur
    expect(mois).toContain('r.etat.mot')
    expect(mois).toContain('Aucun poste')
    expect(mois).not.toContain('modèle(s)')
    expect(mois).not.toContain('•')

    // rien de DESTRUCTEUR dans une vue de lecture : la croix de 16 px posée sur
    // chaque pastille est sortie du mois, le retrait d'un dépôt s'écrit en mot
    expect(mois).not.toContain('sk-shift-del-btn')
    expect(mois).toContain('sk-mois-retirer')
    // et la porte du jour est explicite : plus seulement un double-clic à deviner
    expect(mois).toContain('sk-mois-ouvrir')
    expect(mois).toContain('role="button"')
    expect(mois).toContain('onKeyDown')
    expect(mois).toContain('ouvrirLaJournee')

    // la peau du mois est ÉCRITE dans la feuille de la maison : avant le 23/11,
    // zéro règle du mois y figurait (douze dans la feuille voisine), et le mois
    // héritait de son vocabulaire — un dégradé saturé sous un texte clair, là où la
    // grille de la semaine pose un lavis.
    const peau = lire('src/pages/PlanningPostIt.css')
    const debutPeau = peau.indexOf('LE MODE MOIS, ENFIN HABILLÉ')
    expect(debutPeau).toBeGreaterThan(-1)
    const blocPeau = peau.slice(debutPeau)
    expect(blocPeau).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))')
    expect(blocPeau).toContain('.sk-plan-page--postit .sk-cal-cell.sk-mois-case')
    expect(blocPeau).toContain('.sk-plan-page--postit .sk-mois-legende')
    expect(blocPeau).toContain('min-width: 760px')
    // aucun des trois audits ne doit bouger à cause de ce chantier
    expect(blocPeau.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
    expect(blocPeau).not.toMatch(/blur\(/)
    expect(blocPeau).not.toMatch(/border-radius:\s*[^;]*\d+px/)
    // les trois tailles de la charte, pas une de plus (D-013)
    expect(blocPeau.match(/font-size:\s*\d/g)).toBeNull()
  })

  it('32. traite la file des demandes dans l ordre, et dit ce qui change jour par jour', () => {
    // Le bloc des demandes, isolé comme celui du mois : un contrat qui porte sur
    // tout Planning.jsx ne dirait pas où la faute a été commise.
    const demandes = planningSrc.slice(
      planningSrc.indexOf('{/* 5. VUE DEMANDES DES COLLABORATEURS'),
      planningSrc.indexOf('{/* Barre flottante du mode tactile')
    )
    expect(demandes.length).toBeGreaterThan(2000)

    // UN SEUL CADRE. Le bandeau du haut portait le cadre de la maison et la liste
    // flottait hors de lui, avec une carte de 380 px perdue dans 1 268 px de vide.
    expect(demandes.indexOf('sk-requests-list')).toBeGreaterThan(
      demandes.indexOf('<div className="sk-matrix-card"')
    )
    // et le titre de section n'est plus celui d'une fenêtre : sa barre de feutre
    // est collée à `left: 0; right: 0`, donc elle barrerait tout le conteneur.
    // Le NOT porte sur l'usage rendu — le commentaire du bloc, lui, a le droit de
    // nommer la classe qu'il remplace.
    expect(demandes).not.toMatch(/className="sk-modal-title/)
    expect(demandes).toContain('sk-requests-titre')

    // Plus un seul style en ligne dans cet écran : trois boutons portaient
    // `fontSize: 12.5` (quatrième taille inventée) et l'un d'eux une teinte
    // drapeau en hexadécimal — la seule source de la mesure C1 du dépôt.
    expect(demandes).not.toMatch(/fontSize:/)
    expect(demandes).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    // un seul style en ligne reste dans le bloc, et c'est celui du cadre, comme
    // dans les trois autres vues de la page — pas un style par bouton
    expect(demandes.match(/style=\{\{/g) || []).toHaveLength(1)
    expect(demandes).toContain('<div className="sk-matrix-card" style={{ padding: 20 }}>')

    // LE MOT, UNE SEULE FOIS. Le casier, son infobulle et la phrase du jour
    // sortent du même objet : trois écritures d'un même état finissent toujours
    // par se contredire.
    expect(demandes).toContain('const ETATS_CASIER = {')
    expect(demandes).toContain('...ETATS_CASIER[cle]')
    for (const mot of ['"les deux"', '"en plus"', '"en moins"']) {
      expect(demandes.match(new RegExp(mot, 'g')) || []).toHaveLength(1)
    }
    // le statut se LIT : le mot est écrit, l'emoji n'est pas l'information (C7)
    expect(demandes).toContain('"En attente"')
    expect(demandes).toContain('"Approuvée"')
    expect(demandes).toContain('"Refusée"')
    expect(demandes).not.toContain('⏳')
    expect(demandes).not.toContain('✕ Refusée')

    // CE QUI CHANGE, JOUR PAR JOUR : sept casiers et la phrase qui les résume.
    // « Lun - Sam » sous « Lun - Ven » ne disait pas quel jour s'ajoutait.
    expect(demandes).toContain('sk-demande-jours-grille')
    expect(demandes).toContain('phraseJours')
    expect(demandes).toContain('title={`${j.nom} — ${j.phrase}`}')

    // le différentiel d'heures ne s'écrit que si les DEUX côtés en ont : devant un
    // collaborateur sans ligne d'horaire, « +8h00 » serait un chiffre inventé
    expect(demandes).toContain('const heuresDesDeuxCotes = Boolean(')
    expect(demandes).toContain('if (!heuresDesDeuxCotes || !deltaMinutes) return null')

    // LA FILE, DANS L'ORDRE DU TRAVAIL : ce qui attend d'abord, le plus ancien en
    // tête. La requête renvoyait le dépôt décroissant — une attente de huit mois
    // tombait derrière trois refus de la semaine.
    expect(planningSrc).toContain('[...choisies].sort((a, b) => {')
    expect(planningSrc).toContain('return attenteA - attenteB')
    expect(planningSrc).toContain('depot(a) - depot(b)')

    // RIEN D'ICÔNE SEUL, et surtout pas sur ce qui détruit : le pictogramme
    // corbeille est devenu un mot, la fenêtre de confirmation restait déjà là.
    expect(demandes).toContain('Supprimer la demande')
    expect(demandes).toContain('confirmDeleteRequest(req)')
    expect(demandes).not.toMatch(/<Trash2 size=\{14\}[^>]*\/>\s*<\/button>/)

    // le filtre est un interrupteur, il se lit au clavier
    expect(demandes).toContain('role="group"')
    expect(demandes).toContain('aria-pressed={requestFilter === f.id}')
    // et le vide dit où aller
    expect(demandes).toContain('Voir les {filteredRequests.length} demandes')

    // LA PEAU EST ÉCRITE DANS LA FEUILLE DE LA MAISON — une colonne, sept casiers
    // égaux, et rien des trois dérives auditées par la porte de charte.
    const peau = lire('src/pages/PlanningPostIt.css')
    const debut = peau.indexOf('LES DEMANDES, ENFIN HABILLÉES')
    expect(debut).toBeGreaterThan(-1)
    const blocPeau = peau.slice(debut)
    expect(blocPeau).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(blocPeau).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))')
    expect(blocPeau).not.toContain('auto-fill')
    expect(blocPeau).not.toContain('999px')
    expect(blocPeau.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
    expect(blocPeau).not.toMatch(/blur\(/)
    expect(blocPeau).not.toMatch(/border-radius:\s*[^;]*\d+px/)
    expect(blocPeau.match(/font-size:\s*\d/g)).toBeNull()
    // les filtres se lisent au souligné, comme les quatre vues : pas de pilule
    // pleine dans une note de papier
    expect(blocPeau).toContain('.sk-plan-page--postit .sk-request-filter.active')
    expect(blocPeau).toContain('box-shadow: inset 0 -3px 0 0 var(--charte-encre)')
  })

  it('33. emprunte la coque et sa barre au lieu d’en redessiner une', () => {
    // La page ne possède pas de rail : elle rend LES deux composants partagés.
    // Un troisième rail écrit à la main est exactement la panne du 24/11
    // (« rien ne se passe ») — le rail de la page n’avait aucun panneau.
    expect(planningSrc).toContain('import CoqueAdmin from "../components/coque/CoqueAdmin";')
    expect(planningSrc).toContain('import SidebarUnique from "../components/SidebarUnique";')
    expect(planningSrc).toContain('import { sectionsNavAdmin } from "../components/coque/sectionsNavAdmin";')
    expect(planningSrc).toContain('<CoqueAdmin')
    expect(planningSrc).toContain('sections={sectionsNav}')
    // la racine de la page est DANS la colonne de la coque, pas à côté
    expect(planningSrc.indexOf('<CoqueAdmin')).toBeLessThan(
      planningSrc.indexOf('className="sk-plan-page sk-plan-page--postit"')
    )
    // le bouton clair / sombre vit dans la barre : la page le lui prête
    expect(planningSrc).toContain('surTheme={toggleTheme}')
    expect(planningSrc).toContain('surDeconnexion={deconnexion}')

    // LE PÉRIMÈTRE N’EST PAS RE-CALCULÉ. La page avait déjà l’effet qui lit
    // `admin.selectedEnterprise` et son `entrepriseActive` : les écrire deux
    // fois, c’est avoir deux réponses à « de quelle entreprise on parle ».
    expect(planningSrc.match(/const entrepriseActive = /g)).toHaveLength(1)
    // et le garde-fou de module ne peut pas lire `null` (un admin non super
    // verrait toutes ses rubriques s’éteindre) : il a son entreprise à lui
    expect(planningSrc).toContain('const entrepriseDuRail =')
    expect(planningSrc).toContain('Boolean(entrepriseDuRail?.[champ])')

    // LE SÉLECTEUR DU RAIL ÉCRIT LA MÊME CLÉ QUE L’ANNUAIRE — c’est ce qui rend
    // la promesse du bandeau du 22/11 vraie au lieu de écrite.
    const annuaire = lire('src/pages/Employes.jsx')
    expect(planningSrc).toContain('last_enterprise_id_${admin.id}')
    expect(annuaire).toContain('last_enterprise_id_')
    expect(planningSrc).toContain('window.localStorage.setItem("admin", JSON.stringify(misAJour))')
    expect(annuaire).toContain("localStorage.setItem('admin', JSON.stringify(misAJour))")
    expect(planningSrc.match(/const entrepriseActive = /g)).toHaveLength(1)

    // le composant partagé reste mince : il pose deux colonnes, il ne dessine
    // pas la barre (aucune de ses classes ne doit réapparaître ici)
    const coque = lire('src/components/coque/CoqueAdmin.jsx')
    // la minceur se juge sur ce qui est RENDU, pas sur ce qui est expliqué :
    // le composant a le droit de dire qu'il ne dessine pas la barre
    const coqueRendue = coque.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(coqueRendue).toContain('coque-admin-page')
    expect(coqueRendue).not.toContain('sb-rail')
    expect(coqueRendue).not.toContain('registre')
    expect(coqueRendue.match(/<div/g)).toHaveLength(2) // la coque, et sa colonne
    const cssCoque = lire('src/components/coque/CoqueAdmin.css')
    // `min-width: 0` est la pièce qui empêche la page de se faire pousser
    expect(cssCoque).toContain('min-width: 0')
    // et la hauteur du rail suit la barre d’URL du téléphone
    const feuilleBarre = lire('src/components/SidebarUnique.css')
    expect(feuilleBarre).toContain('.coque-admin > .sb')
    expect(feuilleBarre).toContain('height: calc(100dvh - 20px)')
    // l’ancienne adresse reste servie : personne n’a été déshabillé au passage
    expect(feuilleBarre).toContain('.empv2-layout > .sb')
  })

  it('34. descend d’un cran à chaque largeur, sans jamais rogner une brique', () => {
    const peau = lire('src/pages/PlanningPostIt.css')
    const echelle = peau.slice(peau.lastIndexOf('À TOUTES LES LARGEURS'))

    // les paliers sont écrits, dans l’ordre décroissant
    const paliers = (echelle.match(/@media \(max-width: (\d+)px\)/g) || []).map((x) =>
      Number(x.match(/(\d+)/)[1])
    )
    expect(paliers).toEqual([1280, 1180, 1023, 820, 640, 520])

    // la lisière se retire : 26 à la base, et un seul cran par palier, jamais
    // à l’envers (une lisière qui s’épaissit en rétrécissant est une erreur)
    const cades = (echelle.match(/--plq-cadre: (\d+)px/g) || []).map((x) => Number(x.match(/(\d+)/)[1]))
    expect(cades).toEqual([22, 18, 12, 8])

    // les planchers de la table de semaine : la coque prend 74 px, la table les
    // rend en défilement — mais jamais sous le plancher que la feuille voisine
    // a déjà choisi pour le téléphone (900 px, 101 px par jour)
    const planchers = (echelle.match(/sk-matrix-table \{\s*\n?\s*min-width: (\d+)px/g) || []).map(
      (x) => Number(x.match(/(\d+)px/)[1])
    )
    expect(planchers).toEqual([1040, 940, 900])
    expect(Math.min(...planchers)).toBeGreaterThanOrEqual(900)

    // LE MOIS NE SE ROGNE PAS : ses 760 px sont le choix du 23/11, et le texte
    // qui le dit vit à côté de la règle qui s’abstient de le changer
    expect(echelle).toContain('LE MOIS NE SE ROGNE PAS')

    // l’ancien palier 700 ne possède plus ni la lisière ni la bande des vues :
    // deux feuilles sur la même propriété, c’est une valeur qui meurt sans qu’on
    // le sache (l’`18px` d’avant était déjà battu par la suite)
    const ouvreur700 = peau.indexOf('@media (max-width: 700px)')
    const bloc700 = peau.slice(
      ouvreur700,
      peau.slice(ouvreur700 + 10).search(/@media [^{]*\{/) + ouvreur700 + 10
    )
    expect(bloc700.length).toBeGreaterThan(200)
    expect(bloc700).not.toContain('--plq-cadre')
    expect(bloc700).not.toContain('sk-topbar-vues')

    // la rangée du bas de l’écran ne mange ni la bande du modèle à poser ni le
    // dock de l’assistant : le même nombre, 76 px, des deux côtés
    expect(echelle).toContain('.sk-plan-page--postit .sk-touch-bar')
    expect(peau).toContain('bottom: calc(76px + env(safe-area-inset-bottom, 0px));')
    const dock = lire('src/styles/assistantDock.css')
    expect(dock).toContain('@media (max-width: 820px) and (min-width: 641px)')
    expect(dock).toContain('bottom: calc(76px + env(safe-area-inset-bottom, 0px));')

    // la fenêtre ne se coupe plus par le haut quand la barre d’URL se replie
    expect(echelle).toContain('@supports (height: 100dvh)')
    // et la page ne défile pas pour du vide : sous la coque, sa hauteur
    // minimale rend la hauteur RÉELLE de l'écran, et la réserve du bas est
    // rendue sous 820 px — la même expression que le `padding-bottom` de la
    // coque, pour que les deux nombres ne dérivent pas l'un de l'autre
    expect(echelle).toContain('min-height: 100dvh;')
    expect(echelle).toContain('min-height: calc(100dvh - 72px - var(--charte-espace-3));')
    const cssCoque = lire('src/components/coque/CoqueAdmin.css')
    expect(cssCoque).toContain('padding-bottom: calc(72px + var(--charte-espace-3));')
    expect(cssCoque).toContain('min-height: 100dvh;')
    // la hauteur de la coque se règle dans sa feuille, pas dans la peau
    expect(echelle).not.toContain('.coque-admin {')

    // et les trois audits de la porte de charte ne bougent pas d’un poil
    expect(echelle.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
    expect(echelle).not.toMatch(/blur\(/)
    expect(echelle).not.toMatch(/border-radius:\s*[^;]*\d+px/)
    expect(echelle.match(/font-size:\s*\d/g)).toBeNull()
    expect(echelle).not.toContain('!important')
  })

  it('35. laisse les quatre vues au bandeau : un seul interrupteur', () => {
    // Le rail sait afficher des vues de page (`sb-rail-vues`). Ici, il ne les
    // reçoit PAS — et le contrat veille à ce que ça ne dérive pas tout seul.
    expect(planningSrc).not.toContain('vues={[')
    expect(planningSrc).not.toContain('surVue={')
    expect(planningSrc).not.toContain('vueActive={')
    // le seul interrupteur est dans le bandeau, et il dit la vérité : le badge
    // des demandes attendues est sur SON bouton
    const bandeau = planningSrc.slice(
      planningSrc.indexOf('<div className="sk-topbar-vues">'),
      planningSrc.indexOf('sk-req-badge') + 60
    )
    expect(bandeau).toContain('["semaine", "mois", "jour", "demandes"]')
    expect(bandeau).toContain('setPlanningView(vue)')
    expect(bandeau).toContain('sk-req-badge')
    // les autres écritures de la vue sont des voyages (« voir la semaine »),
    // pas des interrupteurs : elles ne dédoublent rien
    expect(planningSrc.match(/setPlanningView\(/g)).toHaveLength(4)
  })

  it('36. porte la liste des entreprises hors de la barre, où plus rien ne la coince', () => {
    const selecteur = lire('src/components/SelecteurEntreprise.jsx')
    // « quand je clique sur l'entreprise, le panneau s'ouvre en dessous du bloc
    // (le problème est le même que dans la page dashboard) ». L'enfant absolu du
    // rail ne pouvait pas dépasser l'étage de son parent — et sur le dashboard,
    // l'`overflow: hidden` de `.dashboard-sidebar` le rognait. Un z-index de
    // plus n'y changeait rien : la liste est PORTÉE AILLEURS.
    expect(selecteur).toContain("import { createPortal } from 'react-dom'")
    expect(selecteur).toContain('createPortal(liste, hote)')
    expect(selecteur).toContain('document.body')
    // posée à des coordonnées LUES sur la bande, pas à un nombre recopié
    expect(selecteur).toContain('getBoundingClientRect()')
    expect(selecteur).toContain('style={place ? { top: place.top, left: place.left } : { visibility: \'hidden\' }}')
    // et la feuille SUIT la bande : la page roule, la barre est collante
    expect(selecteur).toContain("window.addEventListener('resize', mesurer)")
    expect(selecteur).toContain("window.addEventListener('scroll', mesurer, true)")
    // un clic DANS la liste n'est plus un clic « dehors » depuis qu'elle est
    // hors du rail : sans cette garde, choisir une entreprise la referait avant
    // que le choix parte
    expect(selecteur).toContain('feuille.current && feuille.current.contains(e.target)')

    const barre = lire('src/components/SidebarUnique.css')
    expect(barre).toMatch(
      /\.se-liste--flottante \{\s*\n\s*position: fixed;\s*\n\s*top: auto;\s*\n\s*left: auto;\s*\n\s*z-index: 78;/
    )
    // haute mais jamais hors de l'écran
    expect(barre).toContain('max-height: calc(100vh - 16px)')
    expect(barre).toContain('max-height: calc(100dvh - 16px)')
    expect(barre).toMatch(/\.se-liste--flottante \{\s*\n\s*bottom: auto;/)
    // la barre, elle, passe à l'étage 74 : le registre qui se déplie, lui, ne
    // sort pas de la barre et doit couvrir le bandeau collant de la page (60)
    expect(barre).toContain('z-index: 74;')
    // et l'ancienne cage a disparu de la variante : un `absolute` qui resterait
    // écrit là serait lu par quelqu'un
    expect(barre).not.toMatch(/\.se-liste--flottante \{[^}]*position: absolute/)
  })

  it('37. signe les sept jours dans la bande, à la couleur de la légende', () => {
    // « n'OUVRE PAS LE MODAL AJUSTER LE PLANNING QUAND JE CLIQUE SUR LMMJVSD » :
    // ces pastilles n'avaient pas de geste à retirer, elles n'en avaient AUCUN.
    // Le clic traversait la cellule du collaborateur, dont l'onClick ouvre
    // l'ajustement du planning. Elles sont donc des boutons qui arrêtent le
    // clic et tournent l'état du jour.
    const debut = planningSrc.indexOf('className="sk-avail-days"')
    const bloc = planningSrc.slice(debut, planningSrc.indexOf('</div>', debut))
    expect(bloc).toContain('<button')
    expect(bloc).toContain('e.stopPropagation();')
    expect(bloc).toContain('cycleAvailability(emp.id, `day-${j.id}`)')
    expect(bloc).not.toContain('openAvailabilityModal')
    expect(bloc).toContain('role="group"')
    // un mot par état, jamais la couleur seule (D-007)
    for (const mot of ['"disponible"', '"indisponible"', '"non renseigné"']) {
      expect(bloc).toContain(mot)
    }

    // « tu n'appliques pas la légende pour les couleurs concernant ces boutons » :
    // la ligne de légende peignait ses puces en vert et rouge fluo (deux hex de
    // la feuille voisine), les boutons ne peignaient RIEN. Les trois objets
    // lisent maintenant les mêmes tokens d'état — un fait, trois endroits.
    const peau = lire('src/pages/PlanningPostIt.css')
    // la règle est cherchée À SON ENDROIT, dans le bloc de l'objet : les trois
    // objets portent le même token, mais pas à la même propriété (la puce le
    // met en fond, la pilule en trait et en encre, le jour en fond lavé) — et
    // deux lignes qui se recopient l'une l'autre est précisément ce qu'on
    // arrête de faire ici.
    const blocDe = (selecteur) => {
      const depart = peau.indexOf(selecteur)
      expect(depart, selecteur).toBeGreaterThan(-1)
      return peau.slice(depart, peau.indexOf('}', depart))
    }
    for (const [etat, token] of [['is-on', '--charte-succes'], ['is-off', '--charte-erreur']]) {
      for (const objet of ['sk-avail-legend-dot', 'sk-avail-pill', 'sk-avail-day']) {
        expect(blocDe(`.sk-plan-page--postit .${objet}.${etat} {`)).toContain(`var(${token})`)
      }
    }
    // « non défini » a sa couleur — le brun du neutre — et ce n'est pas une case vide
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-avail-day \{[\s\S]*?color: var\(--charte-statut-neutre\);/
    )
    // une pastille qu'on tourne au pouce se prend au pouce : 22 px, pas 16
    expect(peau).toMatch(/\.sk-plan-page--postit \.sk-avail-day \{[\s\S]*?min-height: 22px;/)
    expect(peau).toMatch(/\.sk-plan-page--postit \.sk-avail-day:focus-visible \{/)
    // et le fluo n'a pas été déplacé : il a été retiré de la peau. ÉCRIT ICI
    // en toutes lettres, le nom des deux couleurs en ajouterait deux au
    // compteur de la porte de charte — le contrat serait la faute. On cherche
    // donc le motif, pas les mots.
    const reglures = peau.slice(
      peau.indexOf('.sk-plan-page--postit .sk-avail-legend-dot {'),
      peau.indexOf('/* \u2500\u2500 la carte de poste')
    )
    expect(reglures.length).toBeGreaterThan(600)
    expect(reglures.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
    expect(reglures).not.toMatch(/background: var\(--sk-/)
  })

  it('38. range les équipes au glisser, une fois la ligne repliée', () => {
    // « il faut pouvoir glisser les équipes une fois pliées pour échanger leur
    // ordre ». Trois pièces, et la donnée doit être LUE par ce qui est rendu —
    // un ordre enregistré que le mémo ignore n'est pas un ordre.
    expect(planningSrc).toContain(
      'const GROUPS_ORDER_STORAGE_KEY = "encheck_planning_teams_ordre_v1";'
    )
    expect(planningSrc).toContain('readStorage(GROUPS_ORDER_STORAGE_KEY, [])')
    expect(planningSrc).toContain('writeStorage(GROUPS_ORDER_STORAGE_KEY, ordreEquipes)')

    const memo = planningSrc.slice(
      planningSrc.indexOf('const ranges = [...groupes].sort'),
      planningSrc.indexOf('const titres = tries.map')
    )
    expect(memo).toContain('ordreEquipes.length')
    expect(memo).toContain('ranges.filter((groupe) => !ordreEquipes.includes(groupe.key))')
    // une équipe jamais rangée reste visible, elle ne disparaît pas du tri
    expect(memo).toContain('.filter(Boolean)')
    expect(planningSrc).toContain('equipesParEmploye, ordreEquipes]);')

    const ligne = planningSrc.slice(planningSrc.indexOf('key={`grp-${group.key}`}'))
    const attributs = ligne.slice(0, ligne.indexOf('onClick='))
    expect(attributs).toContain('draggable={isCollapsed}')
    expect(attributs).toContain('application/x-encheck-equipe')
    expect(attributs).toContain('e.preventDefault()')
    expect(attributs).toContain('echangerEquipes(cle, group.key)')
    expect(attributs).toContain('setEquipeGlissee(null)')
    // l'échange, pas l'insertion : le mot qu'il a employé, c'est « échanger »
    expect(planningSrc).toContain('[cles[i], cles[j]] = [cles[j], cles[i]]')

    // ce que le doigt voit : une ligne repliée est une prise, la ligne survolée
    // est la place qu'elle prendra
    const peau = lire('src/pages/PlanningPostIt.css')
    expect(peau).toMatch(/\.sk-plan-page--postit \.sk-group-row\.is-collapsed \{\s*\n\s*cursor: grab;/)
    expect(peau).toMatch(/\.sk-plan-page--postit \.sk-group-row\.is-glissee \{\s*\n\s*cursor: grabbing;/)
    expect(peau).toMatch(
      /\.sk-plan-page--postit \.sk-group-row\.is-cible \{\s*\n\s*box-shadow: inset 0 3px 0 var\(--charte-encre\);/
    )
    // et la porte de charte ne bouge pas d'un cran (aucun hex, aucun flou
    // ajoutés par ces trois états) : le compte global est pris au compteur, en
    // dur dans la chaîne de contrôle — pas rejoué ici à l'arrache.
  })

  it('39. laisse le choix sur la case vide : poser, créer, ou ajuster', () => {
    // « je veux qu'on puisse choisir ou créer le modèle (jour, pause, garde de
    // nuit etc) en cliquant seulement sur la case vide — donc il faut laisser
    // le choix entre ajuster le planning, choisir un modèle ou en créer ».
    const debutCase = planningSrc.indexOf('className="sk-empty-cell"')
    const caseVide = planningSrc.slice(
      debutCase,
      planningSrc.indexOf('\n', planningSrc.indexOf('title="Cliquer pour poser', debutCase))
    )
    expect(caseVide.length).toBeGreaterThan(60)
    // un clic sur la case vide PROPOSE, il n'ordonne plus
    expect(caseVide).toContain('onClick={() => setCaseVide({ emp, dayItem })}')
    expect(caseVide).not.toContain('openCellEditorModal(emp, dayItem)')
    // le geste validé du doigt garde la priorité : la brique tenue se pose, la
    // fenêtre ne se lève pas par-dessus
    expect(planningSrc).toContain('if (touchDragPayload) {')
    expect(planningSrc).toContain('applyTouchDropOnCell(emp, dayItem)')

    // LES TROIS SORTIES, dans la même fenêtre
    const fenetre = planningSrc.slice(
      planningSrc.indexOf('{caseVide && ('),
      planningSrc.indexOf('{showAvailabilityModal && availabilityTarget && (')
    )
    expect(fenetre.length).toBeGreaterThan(400)
    expect(fenetre).toContain('dockTemplates.map((tpl) => (')
    expect(fenetre).toContain('onClick={() => poserModeleSurLaCase(tpl)}')
    expect(fenetre).toContain('openCellEditorModal(emp, dayItem);')
    expect(fenetre).toContain('openNewModelModal();')
    expect(fenetre).toContain('Ajuster le planning')
    expect(fenetre).toContain('Créer un modèle')
    // la fenêtre emprunte le corps et le pied de la maison : pas de modale
    // parallèle à entretenir
    expect(fenetre).toContain('className="sk-modal-backdrop"')
    expect(fenetre).toContain('className="sk-modal-box"')
    expect(fenetre).toContain('className="sk-modal-body"')
    expect(fenetre).toContain('className="sk-modal-foot"')
    expect(fenetre).toContain('onClick={() => setCaseVide(null)}')

    // POSER un modèle depuis la fenêtre, c'est DÉPOSER une brique : le même
    // chemin, pas une seconde écriture de l'application (qui aurait fini par
    // mentir sur la pause autonome, le repos ou le compteur de modifications)
    const poser = planningSrc.slice(
      planningSrc.indexOf('const poserModeleSurLaCase = (tpl) => {'),
      planningSrc.indexOf('// Application du modèle sélectionné au doigt sur une case du calendrier')
    )
    expect(poser).toContain('handleDropOnCell(')
    expect(poser).toContain('sourceType: "dock"')
    expect(poser).toContain('template: tpl')
    expect(poser).toContain('setCaseVide(null)')
    // une seule application des modèles dans toute la page
    expect(planningSrc.match(/sourceType: "dock",\s*\n\s*template: tpl/g)).toHaveLength(2) // handleDragStartTemplate + la fenêtre
    expect(planningSrc.match(/const poserModeleSurLaCase = /g)).toHaveLength(1)

    // le sous-titre d'un modèle est ÉCRIT UNE FOIS et lu par les deux endroits
    // qui l'affichent — la bande du dock et la fenêtre
    expect(planningSrc.match(/soustitreModele/g)).toHaveLength(3) // définition + 2 usages
    const bande = planningSrc.slice(
      planningSrc.indexOf('<span className="sk-brick-title">'),
      planningSrc.indexOf('</span>', planningSrc.indexOf('<span className="sk-brick-sub">'))
    )
    expect(bande).toContain('{soustitreModele(tpl)}')
    // et la bande du dock ne recopie plus le ternaire : elle lit l'helper
    expect(bande).not.toContain('tpl.kind === "rest"')
    // et la teinte reste une DONNÉE du modèle : la fenêtre ne choisit pas une
    // couleur, elle reporte `--brick-color` (le repli est dans la feuille)
    expect(fenetre).toContain('"--brick-color": tpl.color || undefined')

    // la peau habite la brique de la fenêtre, sans réécrire la fenêtre
    const peau = lire('src/pages/PlanningPostIt.css')
    const reglures = peau.slice(
      peau.indexOf('.sk-plan-page--postit .sk-brick--choix {'),
      peau.indexOf('/* ── la carte de poste')
    )
    expect(reglures.length).toBeGreaterThan(200)
    expect(reglures).toContain('cursor: pointer;')
    expect(reglures).toContain('.sk-plan-page--postit .sk-choix-modeles {')
    expect(reglures).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    // le palier qui passe à une brique par ligne est CELUI de la bande des
    // modèles (700 px), pas un cran inventé pour la fenêtre
    const ouveur700 = peau.indexOf('@media (max-width: 700px)')
    const bloc700 = peau.slice(ouveur700, peau.indexOf('@media', ouveur700 + 10))
    expect(bloc700).toContain('.sk-plan-page--postit .sk-choix-modeles {')
    expect(bloc700).toContain('grid-template-columns: 1fr;')
    // les trois comptes de la porte de charte, sur ce qui vient d'être écrit
    expect(reglures.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
    expect(reglures).not.toMatch(/blur\(/)
    expect(reglures).not.toMatch(/border-radius:\s*[^;]*\d+px/)
    expect(reglures).not.toContain('!important')
  })

  it('40. refuse une valeur que la base refuserait, et nomme son refus', () => {
    // « j'essaie de modifier la couleur d'un modèle appliqué à une case mais
    // j'ai eu erreur : Failed to load resource: … 400 ». Un 400 de PostgREST
    // dans une console ne dit rien, et la page répondait « Erreur sauvegarde ».
    // Le contrat est donc double, et dans cet ordre : la page ne DOIT PLUS
    // envoyer ce que la base rejette (format de teinte, format d'heure, carte
    // des jours qui n'est pas un objet), et elle DOIT traduire tout refus en une
    // phrase qui nomme la cause. Le deuxième seul aurait laissé le fondateur
    // avec un diagnostic ; le premier seul lui aurait opposé un refus muet.
    const service = lire('src/services/ecritureHorairesEmploye.js')
    for (const sortie of [
      'export function normaliserTeinte',
      'export function normaliserHeure',
      'export function carteDeTeintes',
      'export function causeRejetBase',
    ]) {
      expect(service).toContain(sortie)
    }
    // le service ne connaît ni React ni supabase-js : c'est ce qui le rend
    // testable sans navigateur, et ce qui empêche la peinture de s'y glisser
    expect(service).not.toMatch(/^import /m)
    expect(service).not.toContain('useState')
    expect(service).not.toContain('await supabase')
    // et il ne peint pas non plus : aucune valeur de couleur en dur, la charte
    // (D-001) compte aussi les fichiers de service
    expect(service.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()

    const entete = planningSrc.indexOf('import {')
    const imports = planningSrc.slice(0, planningSrc.indexOf('const COULEUR_HORAIRE_CLE'))
    expect(imports).toContain('from "../services/ecritureHorairesEmploye"')
    expect(imports).toContain('causeRejetBase')
    expect(entete).toBeGreaterThan(-1)

    // LA FENÊTRE DE LA CASE, qui est le geste signalé
    const ecriture = planningSrc.slice(
      planningSrc.indexOf('const handleSaveEmployeeSchedule = async () => {'),
      planningSrc.indexOf('Planning collaborateur enregistré')
    )
    expect(ecriture.length).toBeGreaterThan(800)
    // une teinte illisible ne part plus : elle est repliée ET annoncée
    expect(ecriture).toContain('normaliserTeinte(employeeScheduleForm.custom_color)')
    expect(ecriture).toContain('teinteDemandee.message')
    expect(ecriture).toContain('teinteDemandee.teinte || TEINTE_PAR_DEFAUT')
    // plus de concaténation d'heure : `"" + ":00"` fabriquait `":00"`, que la
    // colonne `time` rejette en 22007 — c'est-à-dire en 400
    expect(ecriture).not.toContain('+ ":00"')
    expect(ecriture).toContain('normaliserHeure(employeeScheduleForm.custom_start_time')
    expect(ecriture).toContain('normaliserHeure(employeeScheduleForm.custom_break_end')
    // une heure obligatoire laissée vide bloque l'écriture et se nomme ; un
    // champ illisible se replie sans bloquer — le fondateur doit pouvoir réparer
    // son propre brouillon
    expect(ecriture).toContain("const heureBloquante = reglagesHeures.find((h) => h.message && h.heure === null)")
    expect(ecriture).toContain('toast.error(heureBloquante.message)')
    expect(ecriture).toContain('toast.message(h.message)')
    // la carte des jours n'est plus étendue à l'aveugle
    expect(ecriture).toContain('...carteJour.carte,')
    expect(ecriture).toContain('const carteJour = carteDeTeintes(ligneExistante);')
    expect(ecriture).not.toContain('...(ligneExistante?.custom_day_colors || {})')
    // le DÉPÔT d'un modèle écrit dans les MÊMES colonnes : il est contrôlé de la
    // même façon, sinon un modèle plus vieux que la contrainte ferait échouer le
    // dépôt — et le 400 retomberait sur la case, pas sur le modèle
    const depot = planningSrc.slice(
      planningSrc.indexOf('const persistEmployeeShiftToSupabase = async ('),
      planningSrc.indexOf('.upsert(payload, { onConflict: "employee_id" });')
    )
    expect(depot.length).toBeGreaterThan(400)
    expect(depot).toContain('const heureDeposee = (valeur, defaut, champ) =>')
    expect(depot).toContain('normaliserHeure(typeof valeur === "string" ? valeur.slice(0, 8) : null')
    expect(depot).not.toContain('+ ":00";')
    // et le refus de la base se lit à l'écran
    const catchSave = planningSrc.slice(
      planningSrc.indexOf('Planning collaborateur enregistré'),
      planningSrc.indexOf('const openReviewRequestModal')
    )
    expect(catchSave).toContain('toast.error(causeRejetBase(error))')
    expect(catchSave).not.toContain('"Erreur sauvegarde"')
    // la valeur écrite en base est LA MÊME que celle qui peint la carte : un
    // repli qui ne repeindrait pas l'écran montrerait une teinte fantôme
    expect(planningSrc).toContain('color: couleur,')

    // LE DÉPÔT D'UN MODÈLE, qui avalait son erreur : la brique restait posée à
    // l'écran sans jamais atteindre la base, et le seul témoin était un
    // `console.warn`. Une écriture ratée qui ne se dit pas est une écriture
    // qui n'existe pas.
    const synchro = planningSrc.slice(
      planningSrc.indexOf('const persistEmployeeShiftToSupabase = async ('),
      planningSrc.indexOf('const handleSaveTeam') > 0
        ? planningSrc.indexOf('if (removeDay && !shiftData && existingES')
        : planningSrc.indexOf('const persistEmployeeShiftToSupabase = async (') + 6000
    )
    const corps = planningSrc.slice(
      planningSrc.indexOf('.upsert(payload, { onConflict: "employee_id" });', 1600 * 0),
      planningSrc.indexOf('// ═══ GESTIONNAIRES DRAG & DROP EN-CHECK ═══')
    )
    expect(corps).toContain('if (error) {')
    expect(corps).toContain('pas enregistré : ${causeRejetBase(error)}')
    expect(corps).toContain('return;')
    expect(corps).not.toContain('if (!error) {')
    expect(synchro.length).toBeLessThan(4000) // l'ancre reste proche, tranche valide

    // les deux autres écritures de la même table disent la cause, elles aussi :
    // retirer une teinte et approuver une demande
    const retrait = planningSrc.slice(
      planningSrc.indexOf('const handleRetirerTeinteDeLaCase = async () => {'),
      planningSrc.indexOf('const jourViseParLaCase =')
    )
    expect(retrait).toContain('causeRejetBase(error)')
    expect(retrait).not.toContain('"Erreur lors du retrait de la couleur"')
    const revue = planningSrc.slice(
      planningSrc.indexOf('const handleReviewRequest = async () => {'),
      planningSrc.indexOf('═══ CALENDRIER MENSUEL')
    )
    expect(revue).toContain('toast.error(causeRejetBase(error))')

    // la cause est une LISTE BLANCHE : aucun message brut du fournisseur n'est
    // recopié tel quel à l'écran (même règle que pour le MFA le 26/10)
    const traducteur = service.slice(service.indexOf('export function causeRejetBase'))
    expect(service).toContain('const CAUSES = {')
    // la liste est close : un code qui n'y figure pas ne devient pas un message
    // inventé, il devient un code cité
    expect(traducteur).toContain('if (code && CAUSES[code])')
    expect(traducteur).not.toContain('return error.message')
    expect(traducteur).not.toContain('String(error)')
    // une colonne absente se nomme, migration à l'appui
    expect(service).toContain('20261122000002_teinte_horaire_collaborateur.sql')
    expect(service).toContain('20261122000004_teinte_case_par_case.sql')
    // et le contrôle qui a servi à écarter les fausses causes est rejouable
    expect(lire('supabase/outils-sql/20261123_diagnostic_teinte_horaire_refusee.sql')).toContain(
      'Lecture seule'
    )
  })
})
