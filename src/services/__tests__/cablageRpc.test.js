// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DES APPELS RPC — « le nom des paramètres EST la signature »
// ═══════════════════════════════════════════════════════════════════════════
//  Incident du 16/10 au soir, deux heures après la réparation de la page :
//
//    POST /rest/v1/rpc/encheck_estimation_statuer → 404 (Not Found)
//    "Could not find the function public.encheck_estimation_statuer(p_action, p_ids)
//     in the schema cache"
//
//  En SQL, `encheck_estimation_statuer(p_ids uuid[], p_decision text, p_motif text)`
//  accepte n'importe quel ORDRE : un appel par noms d'arguments se fiche de la
//  position. PostgREST, lui, construit une signature canonique à partir des noms que
//  le JSON envoie — et s'ils ne forment la signature d'AUCUNE fonction de la base,
//  ce n'est pas une erreur de typage : c'est un 404 « fonction introuvable ». Un
//  `p_action` au lieu de `p_decision` (l.681 de Pointages.jsx) tuait donc les deux
//  boutons « Valider / Écarter » du bandeau d'estimation, sans que `vite build`,
//  `npm test` ni la porte de lint ne bronchent : l'objet est bien formé, la clé est
//  un simple mot, et la fonction appelée vit dans un autre langage.
//
//  Ce fichier ferme ce trou pour les fonctions QUE CE DÉPÔT DÉCLARE : il croise
//    · chaque `supabase.rpc('nom', { … })` du `src/`, avec ses clés de premier niveau ;
//    · chaque `CREATE [OR REPLACE] FUNCTION` des `supabase/migrations/*.sql`, avec ses
//      noms de paramètres et leur caractère optionnel (`DEFAULT`).
//  Un appel dont la fonction n'est déclarée nulle part ici (les fonctions de Dev 1,
//  vécues en prod seulement) est comparé à une liste documentée : un NOUVEL appel vers
//  une fonction que personne ne déclare dans ce dépôt doit devenir un choix explicite,
//  pas un angle mort de plus.
//
//  Ce n'est pas un contrôle de style : c'est le seul mécanisme, sans dépendance
//  ajoutée au projet, qui prouve que le JS et le SQL parlent de la même fonction.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..', '..')           // src/
const DEPOT = join(RACINE, '..')
const MIGRATIONS = join(DEPOT, 'supabase', 'migrations')

// ── retire les commentaires sans toucher aux chaînes (et l'inverse) ───────
function sansCommentaires(txt) {
  let out = ''
  let i = 0
  while (i < txt.length) {
    const c = txt[i], d = txt[i + 1]
    if (c === '/' && d === '/') { while (i < txt.length && txt[i] !== '\n') i++; continue }
    if (c === '/' && d === '*') {
      const fin = txt.indexOf('*/', i + 2)
      i = fin < 0 ? txt.length : fin + 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c
      i++
      while (i < txt.length) {
        if (txt[i] === '\\') { out += txt[i] + (txt[i + 1] ?? ''); i += 2; continue }
        out += txt[i]
        if (txt[i] === c) { i++; break }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

// ── les clés de premier niveau d'un objet littéral, en partant de son `{` ─
function clesObjet(txt, ouvret) {
  const cles = []
  let prof = 0, i = ouvret, attente = true
  while (i < txt.length) {
    const c = txt[i]
    if (c === '"' || c === "'" || c === '`') {
      i++
      while (i < txt.length) { if (txt[i] === '\\') { i += 2; continue } if (txt[i] === c) break; i++ }
      i++
      continue
    }
    if (c === '{' || c === '(' || c === '[') { prof++; i++; attente = prof === 1; continue }
    if (c === '}' || c === ')' || c === ']') { prof--; if (prof === 0) break; i++; continue }
    if (prof === 1 && c === ',') { i++; attente = true; continue }
    if (prof === 1 && attente) {
      const m = txt.slice(i).match(/^([A-Za-z_$][\w$]*)\s*:/)
      if (m) { cles.push(m[1]); i += m[0].length; attente = false; continue }
      const raccourci = txt.slice(i).match(/^([A-Za-z_$][\w$]*)\s*(?=[,}\n])/)
      if (raccourci) { cles.push(raccourci[1]); i += raccourci[0].length; attente = false; continue }
    }
    i++
  }
  return cles
}

// ── 1. les appels rpc() du src/ ───────────────────────────────────────────
function fichiersJs(dossier, acc = []) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) {
      if (entree.name === 'node_modules') continue
      fichiersJs(chemin, acc)
    } else if (/\.jsx?$/.test(entree.name)) {
      acc.push(chemin)
    }
  }
  return acc
}

const APPELS = []
for (const fichier of fichiersJs(RACINE)) {
  const brut = readFileSync(fichier, 'utf8')
  const propre = sansCommentaires(brut)
  const re = /\.rpc\(\s*['"`]([a-zA-Z_][\w]*)['"`]\s*,?\s*(\{)?/g
  let m
  while ((m = re.exec(propre))) {
    const ligne = propre.slice(0, m.index).split('\n').length
    const cles = m[2] ? clesObjet(propre, m.index + m[0].lastIndexOf('{')) : []
    APPELS.push({ fichier: fichier.slice(DEPOT.length + 1), ligne, nom: m[1], cles })
  }
}

// ── 2. les signatures déclarées par CE dépôt ──────────────────────────────
const MOTS_CLES = new Set(['IN', 'OUT', 'INOUT', 'VARIADIC'])

function parseSignature(txt, debutParen) {
  let prof = 0, i = debutParen
  while (i < txt.length) {
    const c = txt[i]
    if (c === "'" || c === '"') {
      i++
      while (i < txt.length && txt[i] !== c) i++
      i++
      continue
    }
    if (c === '(') prof++
    else if (c === ')') { prof--; if (prof === 0) break }
    i++
  }
  const corps = txt.slice(debutParen + 1, i)
  const morceaux = []
  let courant = '', p2 = 0
  for (const c of corps) {
    if (c === '(' || c === '[') p2++
    if (c === ')' || c === ']') p2--
    if (c === ',' && p2 === 0) { morceaux.push(courant); courant = ''; continue }
    courant += c
  }
  if (courant.trim()) morceaux.push(courant)

  const params = []
  for (const morceau of morceaux) {
    const propre = morceau.replace(/\s+/g, ' ').trim()
    if (!propre) continue
    const parDefaut = /(\s|\))DEFAULT\s/i.test(propre) || /\bDEFAULT\b/i.test(propre)
    const nettoye = propre.replace(/\bDEFAULT\b[\s\S]*$/i, '').trim()
    const tokens = nettoye.split(' ').filter(Boolean)
    let k = 0
    while (k < tokens.length && MOTS_CLES.has(tokens[k].toUpperCase())) k++
    const nom = tokens[k]
    if (!nom || !/^[a-zA-Z_][\w]*$/.test(nom)) continue
    params.push({ nom, requis: !parDefaut && !['OUT', 'INOUT'].includes((tokens[0] || '').toUpperCase()) })
  }
  return { params, fin: i }
}

const SIGNATURES = new Map()
for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'))) {
  const txt = readFileSync(join(MIGRATIONS, f), 'utf8')
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z_][\w]*)\s*\(/gi
  let m
  while ((m = re.exec(txt))) {
    const { params } = parseSignature(txt, m.index + m[0].length - 1)
    if (!SIGNATURES.has(m[1])) SIGNATURES.set(m[1], [])
    SIGNATURES.get(m[1]).push({ fichier: f, params })
  }
}

// ── 3. les fonctions que CE dépôt ne déclare pas, listées et assumées ──────
//      (fonctions de Dev 1, ou nées d'un `db push` antérieur : signature à vérifier
//      dans le dépôt pointage, pas ici. Un nom qui s'ajoute à cette liste doit être
//      un choix, pas la découverte d'un nouveau trou.)
const HORS_DEPOT = new Set([
  'encheck_import_batch', 'encheck_journal_lire', 'replace_attendance_day',
  'encheck_module_actif', 'encheck_alertes_marquer', 'encheck_signaux_controler',
  'encheck_alertes_lister', 'encheck_admin_definir_mot_de_passe', 'update_admin_password',
  'create_admin_auth_user', 'encheck_cout_periode', 'encheck_cout_projeter',
  'encheck_mois_pointes', 'encheck_cout_controler', 'set_employee_password',
  'create_employee_auth_user', 'encheck_employe_pin_machine', 'admin_login_precheck',
  'admin_login_result', 'encheck_employes_sans_pin', 'encheck_adms_appareil_ajouter',
  'encheck_entreprise_par_code', 'encheck_pointages_historique', 'encheck_punch',
  'encheck_employee_login_qr', 'employee_login_precheck', 'get_employees_triggers',
])

const VERIFIES = APPELS.filter((a) => SIGNATURES.has(a.nom))
const HORS_LISTE = APPELS.filter((a) => !SIGNATURES.has(a.nom) && !HORS_DEPOT.has(a.nom))

describe('câblage rpc() ↔ signatures SQL', () => {
  it('le scan voit bien les appels : ni vide, ni muet', () => {
    expect(APPELS.length).toBeGreaterThan(20)
    // Le jour où `VERIFIES` passe à 0, ce fichier ne protège plus rien : il faut
    // soit que les migrations aient été déplacées, soit que l'appel ait changé de
    // forme (variables dynamiques) — dans les deux cas, le corriger, pas le supprimer.
    expect(VERIFIES.length, 'aucun appel rpc() vers une fonction déclarée dans ce dépôt').toBeGreaterThan(0)
    expect(VERIFIES.map((a) => a.nom)).toContain('encheck_estimation_decider')
  })

  it.each(VERIFIES.map((a) => [`${a.fichier}:${a.ligne} → ${a.nom}(${a.cles.join(', ')})`, a]))(
    '%s', (_titre, a) => {
      const surcharge = SIGNATURES.get(a.nom).find(
        (s) => a.cles.every((c) => s.params.some((p) => p.nom === c))
          && s.params.filter((p) => p.requis).every((p) => a.cles.includes(p.nom))
          && a.cles.length <= s.params.length,
      )
      for (const cle of a.cles) {
        const existe = SIGNATURES.get(a.nom).some((s) => s.params.some((p) => p.nom === cle))
        expect(
          existe,
          `PostgREST traduirait la clé « ${cle} » en argument nommé : aucune fonction ` +
          `« ${a.nom} » de ce dépôt n'a ce paramètre. Signatures déclarées : ` +
          SIGNATURES.get(a.nom).map((s) => `(${s.params.map((p) => `${p.nom} ${p.requis ? '' : '='} `)})`.replace(/\s+\)/g, ')')).join(' | '),
        ).toBe(true)
      }
      const manquants = surcharge
        ? surcharge.params.filter((p) => p.requis && !a.cles.includes(p.nom)).map((p) => p.nom)
        : SIGNATURES.get(a.nom).every((s) => s.params.some((p) => p.requis && !a.cles.includes(p.nom)))
          ? SIGNATURES.get(a.nom)[0].params.filter((p) => p.requis).map((p) => p.nom)
          : []
      expect(
        manquants,
        `paramètre(s) obligatoire(s) non envoyé(s) vers « ${a.nom} » : PostgREST répondrait ` +
        `404 « function not found », comme pour p_action le 16/10`,
      ).toEqual([])
    },
  )

  it('le contrat du 16/10 reste écrit : statuer = p_ids + p_decision (+ p_motif)', () => {
    const s = SIGNATURES.get('encheck_estimation_statuer')[0]
    expect(s.params.map((p) => p.nom)).toEqual(['p_ids', 'p_decision', 'p_motif'])
    expect(s.params.find((p) => p.nom === 'p_motif').requis).toBe(false)
  })

  it('« toujours statuer » (16/10 soir) : decider = p_id + p_source + p_decision (+ optionnels)', () => {
    // Le bandeau appelle UNIQUEMENT `encheck_estimation_decider` — il statue
    // que la sortie soit consignée en base (p_id) ou seulement à l'écran
    // (p_source = pointage d'entrée, mode ombre). Les NOMS des clés envoyées
    // par le navigateur doivent exister dans la signature SQL.
    const s = SIGNATURES.get('encheck_estimation_decider')[0]
    expect(s.params.map((p) => p.nom)).toEqual(
      ['p_id', 'p_source', 'p_decision', 'p_heure_sortie', 'p_niveau', 'p_confiance', 'p_motif'],
    )
    //  Le BANDEAU (Pointages.jsx) envoie le contrat complet ; la fiche
    //  (ModifierPointage.jsx) n'envoie que le sous-ensemble dont elle a besoin
    //  (les clés omises ont une valeur par défaut en SQL). On vérifie les deux.
    const bandeau = APPELS.find(
      (a) => a.nom === 'encheck_estimation_decider' && a.fichier === 'src/pages/Pointages.jsx',
    )
    expect([...bandeau.cles].sort()).toEqual(
      ['p_confiance', 'p_decision', 'p_heure_sortie', 'p_id', 'p_motif', 'p_niveau', 'p_source'],
    )
    const fiche = APPELS.find(
      (a) => a.nom === 'encheck_estimation_decider' && a.fichier === 'src/components/ModifierPointage.jsx',
    )
    expect([...fiche.cles].sort()).toEqual(
      ['p_decision', 'p_heure_sortie', 'p_id', 'p_motif', 'p_source'],
    )
  })

  it('tout appel vers une fonction hors de ce dépôt est sur la liste assumée', () => {
    expect(
      HORS_LISTE.map((a) => `${a.fichier}:${a.ligne} ${a.nom}`),
      `nouvel appel vers une fonction que ni ce dépôt ni la liste HORS_DEPOT ne connaissent : ` +
      `soit la déclaration manque ici (migration non rapatriée), soit Dev 1 a bougé. ` +
      `Vérifie la signature côté dépôt pointage, puis ajoute le nom à HORS_DEPOT — ne supprime pas ce test.`,
    ).toEqual([])
  })
})
