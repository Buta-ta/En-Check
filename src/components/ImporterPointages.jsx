// ════════════════════════════════════════════════════════════════════════════
//  📥 IMPORT DE POINTAGES — fichier USB d'une pointeuse (ZKTeco & autres)
//
// la façade humaine de la fonction serveur
// `encheck_import_batch`.
//
//  PRINCIPE DIRECTEUR : ce composant ne décide RIEN. Il lit, il montre, il
//  envoie. Toutes les règles métier (sens du pointage, doublons, heures
//  aberrantes, droits d'accès) vivent dans la fonction serveur, une seule fois.
//  Réimplémenter ces règles ici créerait deux vérités qui finiraient par
//  diverger — et c'est le genre d'écart qui coûte une paie fausse.
//
//  PARCOURS EN 4 ÉTAPES :
//    1. Fichier       → on lit le fichier (CSV, TXT, XLS, XLSX)
//    2. Colonnes      → on confirme quelle colonne veut dire quoi
//    3. Employés      → on relie les PIN de la machine aux employés
//    4. Vérification  → essai à blanc CÔTÉ SERVEUR, puis import réel
//
//  FUSEAU HORAIRE — le piège numéro un de ce genre d'import :
//  la pointeuse écrit l'heure MURALE de l'endroit où elle est posée
//  (« 08:12 »), jamais un instant universel. On convertit donc chaque ligne
//  avant l'envoi, avec `heureLocaleVersUTC` — celui de l'application, qui gère
//  déjà les changements d'heure. Envoyer l'heure telle quelle décalerait tous
//  les pointages d'une ou deux heures selon le pays du client, et personne ne
//  le verrait avant la première paie contestée.
//
//  Place : src/components/ImporterPointages.jsx
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  Upload, FileSpreadsheet, X, ChevronRight, ChevronLeft, AlertTriangle,
  CheckCircle2, Users, Clock, Loader2, ShieldCheck, Rocket, Download,
  HelpCircle
} from 'lucide-react'
import { heureLocaleVersUTC, getActiveTimezone, formaterDateHeureLocale } from '../utils/timezoneUtils'

// ────────────────────────────────────────────────────────────────────────────
//  Limite imposée par la fonction serveur. On prévient AVANT d'envoyer,
//  parce qu'un refus après trois minutes d'attente est une expérience pénible.
// ────────────────────────────────────────────────────────────────────────────
const MAX_LIGNES = 5000

// ════════════════════════════════════════════════════════════════════════════
//  PARTIE 1 — OUTILS PURS (aucun accès réseau, testables isolément)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Devine le séparateur d'un fichier texte.
 * Les exports de pointeuses sont tantôt tabulés (.txt/.dat), tantôt en
 * point-virgule (Excel français), tantôt en virgule. On compte les occurrences
 * hors guillemets sur les premières lignes : le vrai séparateur est celui qui
 * donne le même nombre de colonnes sur toutes les lignes.
 */
export const detecterSeparateur = (texte) => {
  const lignes = texte.split(/\r?\n/).filter(l => l.trim() !== '').slice(0, 12)
  if (lignes.length === 0) return '\t'
  const candidats = ['\t', ';', ',', '|']
  let meilleur = '\t'
  let meilleurScore = -1

  for (const sep of candidats) {
    const comptes = lignes.map(l => compterHorsGuillemets(l, sep))
    const premier = comptes[0]
    if (premier === 0) continue
    // Constance du nombre de colonnes = signe fort d'un bon séparateur.
    const regulieres = comptes.filter(c => c === premier).length
    const score = regulieres * 100 + premier
    if (score > meilleurScore) { meilleurScore = score; meilleur = sep }
  }
  return meilleur
}

/**
 * Une ligne est-elle un en-tête de colonnes ?
 * Deux conditions, sans ambiguïté : au moins deux cellules, dont une qui
 * ressemble à un intitulé connu, et AUCUNE qui soit déjà une date ou une
 * heure. La version précédente de ce test s'appuyait par accident sur un
 * effet de bord de `Array.some` — illisible et fragile. On l'écrit
 * maintenant en clair, pour qu'on puisse le relire dans six mois.
 */
export const ressembleAUneEntete = (cells) => {
  if (!cells || cells.length < 2) return false
  const MOTS = /pin|no\.?|n°|num|badge|matricule|employ|nom|name|date|heure|time|type|status|statut|sens|verify|mode|work|io\b|id\b/i
  const contientUnIntitule = cells.some(c => MOTS.test(c))
  const contientDejaUneMesure = cells.some(c => RESSEMBLE_A_UNE_MESURE.test(c))
  return contientUnIntitule && !contientDejaUneMesure
}

// « 08:12 », « 2026-03-18 », « 18/03/2026 », « 18-Mar-2026 »
const RESSEMBLE_A_UNE_MESURE = /^\s*(\d{1,2}[:hH]\d{2}(:\d{2})?|\d{2,4}[-/.][\dA-Za-z]{1,3}[-/.]\d{2,4})\s*$/

const compterHorsGuillemets = (ligne, sep) => {
  let n = 0
  let dansGuillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (c === '"') { dansGuillemets = !dansGuillemets; continue }
    if (!dansGuillemets && c === sep) n++
  }
  return n
}

/**
 * Découpe une ligne en respectant les champs entre guillemets (une raison
 * sociale ou un nom peut contenir un point-virgule).
 */
export const decouperLigne = (ligne, sep) => {
  const champs = []
  let courant = ''
  let dansGuillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++ }
      else dansGuillemets = !dansGuillemets
      continue
    }
    if (!dansGuillemets && c === sep) { champs.push(courant); courant = ''; continue }
    courant += c
  }
  champs.push(courant)
  return champs.map(c => c.trim())
}

/**
 * Analyse un contenu texte → { entetes, lignes, separateur }
 * Une ligne d'en-tête est détectée si elle contient au moins un mot
 * reconnaissable ET aucune date : les machines produisent parfois un
 * préambule (modèle, numéro de série, période) qu'il faut sauter.
 */
export const analyserTexte = (contenu, separateurForce = null) => {
  const brut = contenu.replace(/^\uFEFF/, '')            // BOM de Windows
  const sep = separateurForce || detecterSeparateur(brut)
  const toutes = brut.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim() !== '')
  if (toutes.length === 0) return { entetes: [], lignes: [], separateur: sep, preambule: 0 }

  let indexEntete = -1
  for (let i = 0; i < Math.min(toutes.length, 8); i++) {
    if (ressembleAUneEntete(decouperLigne(toutes[i], sep))) { indexEntete = i; break }
  }

  // ⚠️ CAS FRÉQUENT : les exports « .dat » des pointeuses n'ont AUCUN en-tête.
  //    Avant, on prenait la première ligne pour un en-tête et on la perdait.
  //    Une ligne de pointage silencieusement avalée, c'est un employé qui
  //    conteste sa paie. On fabrique donc des noms de colonnes et on garde
  //    TOUTES les lignes comme données.
  let entetes
  let lignes
  if (indexEntete >= 0) {
    entetes = decouperLigne(toutes[indexEntete], sep).map((h, i) => h || `Colonne ${i + 1}`)
    lignes = toutes.slice(indexEntete + 1)
  } else {
    const largeur = Math.max(...toutes.map(l => decouperLigne(l, sep).length))
    entetes = Array.from({ length: largeur }, (_, i) => `Colonne ${i + 1}`)
    lignes = toutes.slice()
  }

  return {
    entetes,
    lignes: lignes.map(l => decouperLigne(l, sep)).filter(c => c.some(v => v !== '')),
    separateur: sep,
    preambule: indexEntete < 0 ? 0 : indexEntete,
    sansEntete: indexEntete < 0
  }
}

/**
 * Devine à quoi sert chaque colonne, d'après son intitulé.
 * L'utilisateur confirme ensuite : une devinette ne remplace pas un choix.
 */
export const devinerColonnes = (entetes, lignes) => {
  const trouve = { pin: -1, date: -1, heure: -1, sens: -1 }
  entetes.forEach((h, i) => {
    const t = (h || '').toLowerCase()
    if (trouve.pin < 0 && /^(pin|no\.?|n°|num(ero)?|badge|card|matricule|id employ|employee id|user ?id|enroll)/.test(t)) trouve.pin = i
    if (trouve.sens < 0 && /(type|status|statut|sens|state|io|in ?\/? ?out|evenement)/.test(t)) trouve.sens = i
    // « date/time » ou « date heure » : colonne unique contenant les deux.
    if (trouve.date < 0 && /^(date ?\/? ?time|datetime|date ?heure|horodatage|timestamp|date)$/.test(t)) trouve.date = i
    else if (trouve.heure < 0 && /^(time|heure)/.test(t)) trouve.heure = i
  })

  // Repli sur le CONTENU quand les intitulés ne disent rien : on cherche une
  // colonne dont les valeurs ressemblent à une date, une heure, un petit
  // entier (le PIN), etc. Utile pour les fichiers sans en-tête.
  const echantillon = lignes.slice(0, 30)
  if (trouve.pin < 0) {
    trouve.pin = entetes.findIndex((_, i) => echantillon.length > 0 && echantillon.every(
      c => c[i] !== undefined && /^[0-9A-Za-z_-]{1,16}$/.test(c[i]) && !/^\d{1,2}[:hH]\d{2}/.test(c[i])
    ))
  }
  if (trouve.date < 0) {
    trouve.date = entetes.findIndex((_, i) => echantillon.length > 0 && echantillon.some(
      c => c[i] !== undefined && /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/.test(c[i])
    ))
  }
  // Le sens, deviné par le CONTENU : une colonne dont toutes les valeurs sont
  // des codes de pointage. C'est important — si on ne la trouve pas et que
  // l'utilisateur coche « tout en entrée », toutes les sorties seront
  // enregistrées comme des entrées, sans que rien ne le signale.
  if (trouve.sens < 0) {
    trouve.sens = entetes.findIndex((_, i) => {
      if (i === trouve.pin || i === trouve.date || i === trouve.heure) return false
      const valeurs = echantillon.map(c => (c[i] ?? '').trim()).filter(v => v !== '')
      if (valeurs.length === 0) return false
      return valeurs.every(v => /^([0-5]|i|o|in|out|entree|entrée|sortie|check_?in|check_?out)$/i.test(v))
    })
  }
  return trouve
}

const MOIS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
               janv: 1, fevr: 2, mars: 3, avri: 4, mai: 5, juin: 6, juil: 7, aout: 8, sept: 9, octo: 10, nove: 11, dece: 12 }

const deuxChiffres = (n) => String(n).padStart(2, '0')

/**
 * Interprète une date + une heure écrites par une machine.
 *
 * @param texteDate  « 2026-03-18 », « 18/03/2026 », « 18.03.2026 »,
 *                   « 18-Mar-2026 », ou les deux déjà collés
 * @param texteHeure « 08:12 », « 08:12:33 », « 8h12 », « 08:12:33 AM »
 * @param ordreDate  'JMA' (jour/mois/année, usage francophone) ou 'MJA'
 * @returns {{iso, ambigu, erreur}}
 */
export const lireDateHeure = (texteDate, texteHeure, ordreDate = 'JMA') => {
  const bad = (erreur) => ({ iso: null, ambigu: false, erreur })

  let d = String(texteDate ?? '').trim()
  let h = String(texteHeure ?? '').trim()
  if (!d && !h) return bad('vide')

  // Si la date contient déjà l'heure, on sépare.
  const collage = d.match(/^(.+?)[T ]+(\d{1,2}[:hH]\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)$/)
  if (collage) { d = collage[1].trim(); h = h ? h : collage[2].trim() }

  // Un instant déjà universel (fichier exporté par une passerelle) : on le
  // respecte tel quel — surtout pas de double conversion.
  const absolu = d.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:?\d{2})$/)
  if (absolu) {
    const t = Date.parse(`${absolu[1]}T${absolu[2]}${absolu[3]}`)
    return isNaN(t) ? bad('date_illisible') : { iso: new Date(t).toISOString(), ambigu: false, erreur: null }
  }

  let annee = null, mois = null, jour = null, ambigu = false

  // 1) Année en tête : 2026-03-18, 2026/03/18
  let m = d.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) { annee = +m[1]; mois = +m[2]; jour = +m[3] }

  // 2) Année en queue : 18/03/2026, 18.03.2026, 18-03-2026
  if (annee === null) {
    m = d.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
    if (m) {
      let a = +m[1], b = +m[2]
      let an = +m[3]; if (an < 100) an += an < 70 ? 2000 : 1900
      annee = an
      if (a > 12 && b <= 12) { jour = a; mois = b }              // 18/03 → jour d'abord
      else if (b > 12 && a <= 12) { jour = b; mois = a }         // 03/18 → mois d'abord
      else {
        // Vraie ambiguïté : 05/03 est le 5 mars ou le 3 mai ?
        // On suit le choix de l'utilisateur, et on le SIGNALE.
        ambigu = true
        if (ordreDate === 'MJA') { mois = a; jour = b } else { jour = a; mois = b }
      }
    }
  }

  // 3) Mois en lettres : 18-Mar-2026, Mar 18 2026
  if (annee === null) {
    m = d.match(/^(\d{1,2})[- ]([A-Za-zÀ-ÿ]{3,})[- ](\d{2,4})$/) || d.match(/^([A-Za-zÀ-ÿ]{3,})[- ](\d{1,2})[,]?[- ](\d{2,4})$/)
    if (m) {
      const cle = (s) => s.toLowerCase().slice(0, 4).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const estMois = MOIS[cle(m[1])] !== undefined
      const num = estMois ? m[2] : m[1]
      const mot = estMois ? m[1] : m[2]
      annee = +m[3]; if (annee < 100) annee += annee < 70 ? 2000 : 1900
      jour = +num
      mois = MOIS[cle(mot)] || MOIS[cle(mot).slice(0, 3)] || null
    }
  }

  // Une date seule, sans heure : la machine n'a pas exporté l'heure.
  if (annee === null) return bad('date_illisible')
  if (!mois || mois < 1 || mois > 12 || !jour || jour < 1 || jour > 31) return bad('date_hors_bornes')

  // ─── l'heure ───
  let hh = 0, mm = 0, ss = 0
  if (h) {
    const hm = h.match(/^(\d{1,2})\s*[:hH.]\s*(\d{1,2})(?:\s*[:mMsS.]\s*(\d{1,2}))?\s*([AaPp][Mm])?$/)
    if (!hm) return bad('heure_illisible')
    hh = +hm[1]; mm = +hm[2]; ss = hm[3] ? +hm[3] : 0
    const suffixe = (hm[4] || '').toLowerCase()
    if (suffixe === 'pm' && hh < 12) hh += 12
    if (suffixe === 'am' && hh === 12) hh = 0
    if (hh > 23 || mm > 59 || ss > 59) return bad('heure_hors_bornes')
  } else {
    return bad('heure_absente')   // on refuse plutôt que d'inventer « minuit »
  }

  // Conversion heure murale → instant universel.
  const iso = heureLocaleVersUTC(
    `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`, hh, mm, ss, getActiveTimezone()
  )
  if (!iso) return bad('conversion_impossible')
  return { iso, ambigu, erreur: null }
}

/**
 * Clé de rapprochement PIN ↔ matricule.
 * Les pointeuses écrivent « 0001 » quand l'application contient « 1 » :
 * on normalise des deux côtés pour que ce détail n'empêche pas l'import.
 */
export const normaliserCle = (v) => {
  let s = String(v ?? '').trim().toUpperCase().replace(/[\s.'_-]/g, '')
  if (/^0+\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, '')
  return s
}

const ENTETE_LISIBLE = {
  pin: 'Identifiant sur la machine (PIN)',
  date: 'Date',
  heure: 'Heure',
  sens: 'Sens du pointage (entrée/sortie)'
}

// ════════════════════════════════════════════════════════════════════════════
//  PARTIE 2 — LE COMPOSANT
// ════════════════════════════════════════════════════════════════════════════

const ETAPES = [
  { n: 1, titre: 'Fichier',   aide: 'Le fichier exporté de la pointeuse' },
  { n: 2, titre: 'Colonnes',  aide: 'Ce que veut dire chaque colonne' },
  { n: 3, titre: 'Employés',  aide: 'Qui est qui' },
  { n: 4, titre: 'Vérifier',  aide: 'Rien n’est écrit avant votre accord' }
]

export default function ImporterPointages({ open, onClose, enterpriseId, onImported }) {
  const [etape, setEtape] = useState(1)
  const [fichier, setFichier] = useState(null)          // { nom, entetes, lignes, separateur }
  const [enLecture, setEnLecture] = useState(false)
  const [colonnes, setColonnes] = useState({ pin: -1, date: -1, heure: -1, sens: -1 })
  const [ordreDate, setOrdreDate] = useState('JMA')
  const [sensDefaut, setSensDefaut] = useState('')        // '' | 'in' | 'out'
  const [source, setSource] = useState('')
  const [employes, setEmployes] = useState([])
  const [chargementEmployes, setChargementEmployes] = useState(false)
  const [forcage, setForcage] = useState({})            // PIN → employee_id choisi à la main
  const [ignores, setIgnores] = useState({})            // PIN → true (laissé de côté)
  const [apercu, setApercu] = useState(null)            // réponse de l'essai à blanc
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState(null)        // réponse de l'import réel
  const [filtreDetails, setFiltreDetails] = useState('tous')
  const zoneFichier = useRef(null)

  // ─── chargement de la liste des employés (une fois, à l'ouverture) ───
  const chargerEmployes = useCallback(async () => {
    if (!enterpriseId) return
    setChargementEmployes(true)
    const { data, error } = await supabase
      .from('employees')
      .select('id, matricule, first_name, last_name, is_active')
      .eq('enterprise_id', enterpriseId)
      .order('last_name')
    if (error) {
      toast.error('Impossible de lire la liste des employés : ' + error.message)
      setEmployes([])
    } else {
      setEmployes(data || [])
    }
    setChargementEmployes(false)
  }, [enterpriseId])

  // Les employés sont chargés dès l'ouverture : l'étape 3 est ainsi
  // instantanée, et une erreur de droits se voit tout de suite.
  useEffect(() => {
    if (open && enterpriseId) chargerEmployes()
  }, [open, enterpriseId, chargerEmployes])

  // ─── lecture du fichier ───
  const traiterFichier = async (f) => {
    if (!f) return
    setEnLecture(true)
    try {
      const nom = f.name || 'export'
      const ext = nom.toLowerCase().split('.').pop()

      let entetes = [], lignes = [], separateur = '\t'

      if (ext === 'xls' || ext === 'xlsx') {
        // SheetJS n'est chargé QUE si un fichier Excel est choisi : les
        // utilisateurs qui exportent en CSV/TXT ne le téléchargent jamais,
        // et l'application reste utilisable hors connexion dans ce cas.
        let XLSX
        try {
          XLSX = await import('xlsx')
        } catch (e) {
          toast.error(
            'Lecture des fichiers Excel indisponible hors connexion. ' +
            'Exportez plutôt en CSV ou TXT depuis la pointeuse.',
            { duration: 7000 }
          )
          setEnLecture(false)
          return
        }
        const classeur = XLSX.read(await f.arrayBuffer(), { type: 'array' })
        const feuille = classeur.Sheets[classeur.SheetNames[0]]
        const tableau = XLSX.utils.sheet_to_json(feuille, { header: 1, raw: false, defval: '' })
        const propres = tableau.map(l => l.map(c => String(c ?? '').trim())).filter(l => l.some(v => v !== ''))
        // Le même préambule éventuel que pour le texte : on cherche l'en-tête.
        const motsEntete = /pin|no\.?|n°|num|id|badge|matricule|employ|nom|name|date|heure|time|type|status|statut|sens|verify/i
        let i0 = 0
        for (let i = 0; i < Math.min(propres.length, 8); i++) {
          if (propres[i].some(c => motsEntete.test(c))) { i0 = i; break }
        }
        entetes = propres[i0].map((h, i) => h || `Colonne ${i + 1}`)
        lignes = propres.slice(i0 + 1)
        separateur = 'excel'
      } else {
        const texte = await f.text()
        const a = analyserTexte(texte)
        entetes = a.entetes; lignes = a.lignes; separateur = a.separateur
      }

      if (entetes.length === 0 || lignes.length === 0) {
        toast.error('Ce fichier ne contient aucune ligne exploitable.')
        setEnLecture(false)
        return
      }

      setFichier({ nom, entetes, lignes, separateur })
      setColonnes(devinerColonnes(entetes, lignes))
      setSource(nom.replace(/\.[^.]+$/, '').slice(0, 40))
      setForcage({}); setIgnores({}); setApercu(null); setResultat(null)
      setEtape(2)
      toast.success(`${lignes.length} ligne(s) lue(s)`)
    } catch (e) {
      toast.error('Fichier illisible : ' + (e?.message || 'format inconnu'))
    }
    setEnLecture(false)
  }

  const surDepot = (e) => {
    e.preventDefault()
    traiterFichier(e.dataTransfer?.files?.[0])
  }

  // ─── interprétation de chaque ligne (fait localement, pour l'aperçu) ───
  const lignesLues = useMemo(() => {
    if (!fichier) return []
    const c = colonnes
    return fichier.lignes.map((cells, i) => {
      const pinBrut = c.pin >= 0 ? cells[c.pin] : ''
      const dateBrut = c.date >= 0 ? cells[c.date] : ''
      const heureBrut = c.heure >= 0 ? cells[c.heure] : ''
      const sensBrut = c.sens >= 0 ? cells[c.sens] : ''
      const r = lireDateHeure(dateBrut, heureBrut, ordreDate)
      return { num: i + 1, pinBrut, pin: normaliserCle(pinBrut), dateBrut, heureBrut, sensBrut, iso: r.iso, erreur: r.erreur, ambigu: r.ambigu }
    })
  }, [fichier, colonnes, ordreDate])

  const ambiguïtés = lignesLues.filter(l => l.ambigu).length

  // ─── rapprochement PIN ↔ employé ───
  const rapprochement = useMemo(() => {
    const parCle = new Map()
    const doublonsMatricule = new Set()
    employes.forEach(e => {
      const k = normaliserCle(e.matricule)
      if (!k) return
      if (parCle.has(k)) doublonsMatricule.add(k)
      else parCle.set(k, e)
    })

    const parPin = new Map()
    lignesLues.forEach(l => {
      if (!l.pin) return
      if (!parPin.has(l.pin)) parPin.set(l.pin, { pin: l.pin, pinBrut: l.pinBrut, nb: 0, periode: [null, null] })
      const g = parPin.get(l.pin)
      g.nb++
      if (l.iso) {
        if (!g.periode[0] || l.iso < g.periode[0]) g.periode[0] = l.iso
        if (!g.periode[1] || l.iso > g.periode[1]) g.periode[1] = l.iso
      }
    })

    const groupes = [...parPin.values()].map(g => {
      let employe = forcage[g.pin] !== undefined
        ? employes.find(e => e.id === forcage[g.pin]) || null
        : parCle.get(g.pin) || null
      const auto = forcage[g.pin] === undefined && !!parCle.get(g.pin)
      if (doublonsMatricule.has(g.pin) && forcage[g.pin] === undefined) employe = null   // ambigu → choix manuel
      return { ...g, employe, auto, ignore: !!ignores[g.pin] }
    })

    return { groupes, doublonsMatricule: [...doublonsMatricule] }
  }, [lignesLues, employes, forcage, ignores])

  const lignesExploitables = useMemo(() => {
    const parPin = new Map(rapprochement.groupes.map(g => [g.pin, g]))
    return lignesLues.filter(l => {
      if (!l.pin || !l.iso) return false
      const g = parPin.get(l.pin)
      return g && g.employe && !g.ignore
    })
  }, [lignesLues, rapprochement])

  const periode = useMemo(() => {
    const dates = lignesExploitables.map(l => l.iso).filter(Boolean).sort()
    return dates.length ? { debut: dates[0], fin: dates[dates.length - 1] } : null
  }, [lignesExploitables])

  const sensTranche = colonnes.sens >= 0 || !!sensDefaut
  const pretAEnvoyer = fichier && colonnes.pin >= 0 && colonnes.date >= 0 && sensTranche
    && lignesExploitables.length > 0 && lignesExploitables.length <= MAX_LIGNES && !!enterpriseId

  // ─── l'appel au serveur, en deux temps ───
  const envoyer = async (essai) => {
    if (!pretAEnvoyer) return
    setEnvoi(true)
    if (essai) setApercu(null); else setResultat(null)
    try {
      const parPin = new Map(rapprochement.groupes.map(g => [g.pin, g]))
      const p_rows = lignesExploitables.map(l => ({
        employee_id: parPin.get(l.pin).employe.id,
        check_time: l.iso,                                        // déjà en UTC
        check_type: l.sensBrut || sensDefaut || ''                // le serveur interprète
      }))

      const { data, error } = await supabase.rpc('encheck_import_batch', {
        p_enterprise_id: enterpriseId,
        p_source: (source || 'import-usb').slice(0, 60),
        p_file_name: fichier.nom.slice(0, 120),
        p_rows,
        p_dry_run: essai
      })
      if (error) throw error

      const rep = typeof data === 'string' ? JSON.parse(data) : data
      if (essai) {
        setApercu(rep)
        if (rep?.ok) toast.success('Vérification réussie — rien n’a été écrit')
        else toast.error(motifLisible(rep?.reason))
      } else {
        setResultat(rep)
        if (rep?.ok) {
          toast.success(`${rep.importes} pointage(s) importé(s)`)
          onImported?.()
        } else {
          toast.error(motifLisible(rep?.reason))
        }
      }
    } catch (e) {
      toast.error('Échec : ' + (e?.message || 'erreur inconnue'), { duration: 7000 })
    }
    setEnvoi(false)
  }

  const recommencer = () => {
    setFichier(null); setColonnes({ pin: -1, date: -1, heure: -1, sens: -1 })
    setForcage({}); setIgnores({}); setApercu(null); setResultat(null)
    setSource(''); setEtape(1)
  }

  const fermer = () => { recommencer(); onClose?.() }

  if (!open) return null

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={S.voile} role="dialog" aria-modal="true" aria-label="Importer des pointages">
      <div style={S.cadre}>

        {/* ─── en-tête ─── */}
        <div style={S.tete}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.pastille}><Download size={18} /></div>
            <div>
              <div style={S.titre}>Importer des pointages</div>
              <div style={S.sousTitre}>Depuis une clé USB, un export de pointeuse</div>
            </div>
          </div>
          <button onClick={fermer} style={S.boutonX} aria-label="Fermer"><X size={20} /></button>
        </div>

        {/* ─── fil des étapes ─── */}
        <div style={S.fil}>
          {ETAPES.map((e, i) => {
            const actif = e.n === etape
            const fait = e.n < etape
            return (
              <div key={e.n} style={{ ...S.filEtape, opacity: actif || fait ? 1 : 0.45 }}>
                <div style={{ ...S.filRond, ...(actif ? S.filRondActif : {}), ...(fait ? S.filRondFait : {}) }}>
                  {fait ? <CheckCircle2 size={14} /> : e.n}
                </div>
                <div style={S.filTexte}>
                  <div style={{ fontWeight: 600 }}>{e.titre}</div>
                  <div style={S.filAide}>{e.aide}</div>
                </div>
                {i < ETAPES.length - 1 && <ChevronRight size={14} style={{ opacity: 0.4 }} />}
              </div>
            )
          })}
        </div>

        <div style={S.corps}>

          {/* ═══════════ ÉTAPE 1 — LE FICHIER ═══════════ */}
          {etape === 1 && (
            <div>
              {!enterpriseId ? (
                <Avertissement ton="rouge">
                  Aucune entreprise n’est sélectionnée. Choisissez une entreprise avant d’importer
                  (sélecteur en haut de la page).
                </Avertissement>
              ) : (
                <>
                  <div
                    style={S.zoneDepot}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={surDepot}
                    onClick={() => zoneFichier.current?.click()}
                  >
                    <input
                      ref={zoneFichier} type="file" hidden
                      accept=".csv,.txt,.dat,.tsv,.xls,.xlsx"
                      onChange={(e) => traiterFichier(e.target.files?.[0])}
                    />
                    {enLecture
                      ? <><Loader2 size={28} className="spin-icon" /><div style={{ marginTop: 10 }}>Lecture du fichier…</div></>
                      : <>
                          <Upload size={28} />
                          <div style={{ marginTop: 10, fontWeight: 600 }}>Déposez le fichier ici</div>
                          <div style={S.aide}>ou touchez pour le choisir — CSV, TXT, XLS, XLSX</div>
                        </>}
                  </div>

                  <Aide>
                    <b>Où trouver ce fichier ?</b> Sur la pointeuse : menu <b>Rapport</b> (ou <i>Report</i>)
                    → insérez la clé USB → <b>Télécharger les pointages</b> (ou <i>Download Attendance</i>).
                    Choisissez si possible le format <b>TXT</b> ou <b>CSV</b> : il est lu instantanément et
                    fonctionne même sans connexion.
                  </Aide>
                </>
              )}
            </div>
          )}

          {/* ═══════════ ÉTAPE 2 — LES COLONNES ═══════════ */}
          {etape === 2 && fichier && (
            <div>
              <div style={S.resumeFichier}>
                <FileSpreadsheet size={16} />
                <b>{fichier.nom}</b>
                <span style={S.puce}>{fichier.lignes.length} lignes</span>
                <span style={S.puce}>{fichier.entetes.length} colonnes</span>
                <span style={S.puce}>
                  séparateur : {fichier.separateur === '\t' ? 'tabulation'
                    : fichier.separateur === 'excel' ? 'Excel'
                    : fichier.separateur === ';' ? 'point-virgule' : fichier.separateur === ',' ? 'virgule' : 'barre verticale'}
                </span>
              </div>

              {rapprochement.doublonsMatricule.length > 0 && (
                <Avertissement ton="orange">
                  Deux employés partagent le même matricule ({rapprochement.doublonsMatricule.join(', ')}).
                  Les lignes concernées devront être reliées à la main, à l’étape suivante.
                </Avertissement>
              )}

              <Section titre="Que veut dire chaque colonne ?">
                {['pin', 'date', 'heure', 'sens'].map(champ => (
                  <div key={champ} style={S.ligneChamp}>
                    <label style={S.etiquette}>{ENTETE_LISIBLE[champ]}</label>
                    <select
                      style={S.select}
                      value={colonnes[champ]}
                      onChange={(e) => setColonnes(c => ({ ...c, [champ]: Number(e.target.value) }))}
                    >
                      <option value={-1}>
                        {champ === 'heure' ? '— incluse dans la colonne Date —' : '— aucune —'}
                      </option>
                      {fichier.entetes.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                    {champ === 'pin' && colonnes.pin < 0 && (
                      <span style={S.champRouge}>obligatoire</span>
                    )}
                    {champ === 'date' && colonnes.date < 0 && (
                      <span style={S.champRouge}>obligatoire</span>
                    )}
                  </div>
                ))}
              </Section>

              {(colonnes.pin >= 0 || colonnes.date >= 0) && (
                <Section titre="Ce que ça donne sur les premières lignes">
                  <div style={S.tableauDefilant}>
                    <table style={S.tableau}>
                      <thead>
                        <tr>
                          <th style={S.th}>#</th>
                          <th style={S.th}>PIN</th>
                          <th style={S.th}>Date lue</th>
                          <th style={S.th}>Sens (brut)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lignesLues.slice(0, 8).map(l => (
                          <tr key={l.num}>
                            <td style={S.td}>{l.num}</td>
                            <td style={S.tdMono}>{l.pinBrut || <span style={S.vide}>—</span>}</td>
                            <td style={S.td}>
                              {l.erreur
                                ? <span style={S.ko}>illisible ({l.erreur})</span>
                                : <>{(colonnes.date >= 0 ? l.dateBrut : '')} <b>{l.heureBrut}</b></>
                                  }
                            </td>
                            <td style={S.tdMono}>{l.sensBrut || <span style={S.vide}>—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {ambiguïtés > 0 && (
                    <div style={S.ambigu}>
                      <AlertTriangle size={16} />
                      <div>
                        <b>{ambiguïtés} date(s) ambiguë(s).</b> « 05/03 » peut être le 5 mars ou le 3 mai.
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            style={{ ...S.boutonChoix, ...(ordreDate === 'JMA' ? S.boutonChoixActif : {}) }}
                            onClick={() => setOrdreDate('JMA')}
                          >Jour / Mois / Année <span style={{ opacity: 0.7 }}>(5 mars)</span></button>
                          <button
                            style={{ ...S.boutonChoix, ...(ordreDate === 'MJA' ? S.boutonChoixActif : {}) }}
                            onClick={() => setOrdreDate('MJA')}
                          >Mois / Jour / Année <span style={{ opacity: 0.7 }}>(3 mai)</span></button>
                        </div>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              <Section titre="Colonnes non utilisées">
                <div style={S.aide}>
                  Vérifiez qu’il ne manque rien — en particulier le <b>sens du pointage</b>.
                </div>
                <div style={S.listeColonnes}>
                  {fichier.entetes.map((h, i) => {
                    if (Object.values(colonnes).includes(i)) return null
                    const ex = fichier.lignes.slice(0, 3).map(l => l[i]).filter(v => v !== undefined && v !== '')
                    return (
                      <span key={i} style={S.puceColonne}>
                        {h} {ex.length > 0 && <span style={{ opacity: 0.65 }}>· {ex.join(' · ')}</span>}
                      </span>
                    )
                  })}
                  {Object.values(colonnes).every(v => v < 0) && <span style={S.vide}>— aucune colonne reliée —</span>}
                </div>
              </Section>

              <Section titre="Nom de la machine (gardé sur chaque pointage)">
                <input
                  style={S.input}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="ex. K40 entrée, K40 sortie, Portail"
                  maxLength={60}
                />
                {colonnes.sens < 0 && (
                  <div style={{ marginTop: 12 }}>
                    <label style={S.etiquette}>Cette machine ne précise pas le sens : ces pointages sont des</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {[['in', 'Entrées'], ['out', 'Sorties']].map(([v, t]) => (
                        <button key={v}
                          style={{ ...S.boutonChoix, ...(sensDefaut === v ? S.boutonChoixActif : {}) }}
                          onClick={() => setSensDefaut(v)}>{t}</button>
                      ))}
                    </div>
                    {!sensDefaut && (
                      <div style={{ ...S.champRouge, marginTop: 7 }}>
                        À préciser : sans cela, le serveur écartera toutes les lignes.
                      </div>
                    )}
                    <div style={S.aide}>
                      Correspond à l’export « une seule direction » de certaines pointeuses
                      (un fichier d’entrées, un fichier de sorties).
                    </div>
                  </div>
                )}
                <div style={S.aide}>
                  Utile si vous avez plusieurs pointeuses : c’est ce nom qui apparaîtra ensuite
                  dans la colonne « Méthode » de chaque pointage.
                </div>
              </Section>
            </div>
          )}

          {/* ═══════════ ÉTAPE 3 — LES EMPLOYÉS ═══════════ */}
          {etape === 3 && (
            <div>
              {chargementEmployes ? (
                <div style={S.centre}><Loader2 className="spin-icon" /> Chargement des employés…</div>
              ) : rapprochement.groupes.length === 0 ? (
                <Avertissement ton="orange">
                  Aucun PIN n’a pu être lu. Revenez à l’étape précédente et vérifiez la colonne choisie
                  comme « Identifiant sur la machine ».
                </Avertissement>
              ) : (
                <>
                  <div style={S.resumeFichier}>
                    <Users size={16} />
                    <b>{rapprochement.groupes.length} identifiant(s)</b> sur la machine,
                    <b> {rapprochement.groupes.filter(g => g.employe && !g.ignore).length}</b> relié(s) à un employé,
                    <span style={{ color: '#c2410c' }}>
                      {' '}{rapprochement.groupes.filter(g => !g.employe && !g.ignore).length} à traiter
                    </span>
                  </div>

                  <div style={S.tableauDefilant}>
                    <table style={S.tableau}>
                      <thead>
                        <tr>
                          <th style={S.th}>PIN machine</th>
                          <th style={S.th}>Pointages</th>
                          <th style={S.th}>Employé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapprochement.groupes.map(g => {
                          const classe = g.ignore ? 'ignore' : g.employe ? 'ok' : 'attente'
                          return (
                            <tr key={g.pin}>
                              <td style={S.tdMono}>
                                {g.pinBrut}
                                {g.auto && <span style={S.puceVerte} title="reconnu par son matricule">auto</span>}
                              </td>
                              <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{g.nb}</td>
                              <td style={S.td}>
                                <select
                                  style={{ ...S.select, ...(classe === 'attente' ? S.selectAttente : {}), ...(classe === 'ignore' ? S.selectIgnore : {}) }}
                                  value={g.ignore ? '__ignore__' : (g.employe?.id || '')}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    if (v === '__ignore__') {
                                      setIgnores(m => ({ ...m, [g.pin]: true }))
                                    } else {
                                      setIgnores(m => { const n = { ...m }; delete n[g.pin]; return n })
                                      if (v) setForcage(m => ({ ...m, [g.pin]: v }))
                                      else setForcage(m => { const n = { ...m }; delete n[g.pin]; return n })
                                    }
                                  }}
                                >
                                  <option value="">— à relier —</option>
                                  <option value="__ignore__">⛔ ignorer ces lignes</option>
                                  {employes.map(e => (
                                    <option key={e.id} value={e.id}>
                                      {e.last_name} {e.first_name}{e.matricule ? ` (${e.matricule})` : ''}{e.is_active ? '' : ' — inactif'}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Aide>
                    Le rapprochement se fait sur le <b>matricule</b> : le PIN réglé sur la pointeuse doit
                    correspondre au matricule de la fiche employé. « 0001 » et « 1 » sont considérés
                    identiques. Pour les PIN non reconnus, choisissez l’employé à la main — ou ignorez
                    ces lignes si elles appartiennent à une machine qui n’est pas la vôtre.
                  </Aide>
                </>
              )}
            </div>
          )}

          {/* ═══════════ ÉTAPE 4 — VÉRIFICATION ═══════════ */}
          {etape === 4 && (
            <div>
              {lignesExploitables.length > MAX_LIGNES && (
                <Avertissement ton="rouge">
                  <b>{lignesExploitables.length.toLocaleString('fr')} pointages</b> dépassent la limite
                  de {MAX_LIGNES.toLocaleString('fr')} par import. Découpez l’export par période
                  (un fichier par mois, par exemple) et importez-les l’un après l’autre.
                </Avertissement>
              )}

              {!apercu && !resultat && (
                <>
                  <div style={S.grille}>
                    <Carte valeur={lignesExploitables.length} libelle="pointages lu(s)" />
                    <Carte valeur={rapprochement.groupes.filter(g => g.employe && !g.ignore).length} libelle="employé(s)" />
                    <Carte valeur={rapprochement.groupes.filter(g => !g.employe && !g.ignore).length} libelle="employé(s) non relié(s)" ton={rapprochement.groupes.filter(g => !g.employe && !g.ignore).length ? 'orange' : null} />
                    <Carte valeur={lignesLues.length - lignesExploitables.length} libelle="ligne(s) écartée(s)" ton={(lignesLues.length - lignesExploitables.length) ? 'orange' : null} />
                  </div>

                  {periode && (
                    <div style={S.periode}>
                      <Clock size={16} />
                      Période : du <b>{formaterDateHeureLocale(periode.debut)}</b> au <b>{formaterDateHeureLocale(periode.fin)}</b>
                      <span style={S.fuseau}>(heure locale : {getActiveTimezone()})</span>
                    </div>
                  )}

                  <Avertissement ton="bleu">
                    <b>Rien n’a encore été écrit.</b> L’étape suivante demande au serveur de vérifier
                    chaque pointage (doublon, heure aberrante, employé inconnu) et de vous montrer le
                    résultat <b>sans rien enregistrer</b>. Vous déciderez ensuite.
                  </Avertissement>
                </>
              )}

              {depouillement(apercu, resultat, filtreDetails, setFiltreDetails)}
            </div>
          )}
        </div>

        {/* ─── barre d'actions ─── */}
        <div style={S.pied}>
          <div>
            {etape > 1 && !resultat && (
              <button style={S.boutonSecondaire} onClick={() => setEtape(etape - 1)} disabled={envoi}>
                <ChevronLeft size={16} /> Retour
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {etape === 4 && !apercu && !resultat && (
              <button
                style={{ ...S.boutonPrincipal, opacity: pretAEnvoyer && !envoi ? 1 : 0.5 }}
                onClick={() => envoyer(true)}
                disabled={!pretAEnvoyer || envoi}
              >
                {envoi ? <Loader2 size={16} className="spin-icon" /> : <ShieldCheck size={16} />}
                Vérifier sans rien écrire
              </button>
            )}
            {etape === 4 && apercu && !apercu.ok && !resultat && (
              <span style={S.refus}>⛔ {motifLisible(apercu.reason)}</span>
            )}
            {etape === 4 && apercu?.ok && !resultat && (
              <button
                style={{ ...S.boutonVert, opacity: envoi ? 0.6 : 1 }}
                onClick={() => envoyer(false)}
                disabled={envoi}
              >
                {envoi ? <Loader2 size={16} className="spin-icon" /> : <Rocket size={16} />}
                Importer {apercu.importes} pointage(s)
              </button>
            )}
            {resultat?.ok && (
              <>
                <span style={S.succes}><CheckCircle2 size={16} /> importé</span>
                <button style={S.boutonSecondaire} onClick={recommencer}>Importer un autre fichier</button>
                <button style={S.boutonPrincipal} onClick={fermer}>Terminer</button>
              </>
            )}
            {etape < 4 && (
              <button
                style={{ ...S.boutonPrincipal, opacity: peutAvancer(etape, fichier, colonnes, lignesExploitables.length, enterpriseId, sensDefaut) ? 1 : 0.5 }}
                onClick={() => setEtape(etape + 1)}
                disabled={!peutAvancer(etape, fichier, colonnes, lignesExploitables.length, enterpriseId, sensDefaut)}
              >
                Continuer <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PARTIE 3 — PETITS BLOCS D'AFFICHAGE ET TRADUCTIONS
// ────────────────────────────────────────────────────────────────────────────

/** Peut-on passer à l'étape suivante ? (une seule règle, un seul endroit) */
const peutAvancer = (etape, fichier, colonnes, nbExploitables, enterpriseId, sensDefaut) => {
  if (!enterpriseId) return false
  if (etape === 1) return !!fichier
  if (etape === 2) return colonnes.pin >= 0 && colonnes.date >= 0 && (colonnes.sens >= 0 || !!sensDefaut)
  if (etape === 3) return nbExploitables > 0
  return false
}

/**
 * Les motifs renvoyés par la fonction serveur, dits en français lisible.
 * ⚠️ Toute valeur inconnue est AFFICHÉE telle quelle plutôt que masquée :
 * un motif non traduit reste une information ; « erreur » n'en est pas une.
 */
export const motifLisible = (m) => {
  const T = {
    non_connecte: 'Vous n’êtes pas connecté. Reconnectez-vous puis réessayez.',
    acces_refuse: 'Votre compte n’a pas les droits d’administrateur sur cette entreprise.',
    entreprise_manquante: 'Aucune entreprise n’a été indiquée.',
    format_invalide: 'Le contenu envoyé n’a pas le format attendu.',
    fichier_vide: 'Le fichier ne contient aucun pointage exploitable.',
    trop_de_lignes: `Trop de lignes en un seul import (maximum ${MAX_LIGNES.toLocaleString('fr')}).`,
    employe_non_identifie: 'employé inconnu',
    employe_etranger_a_l_entreprise: 'cet employé appartient à une autre entreprise',
    heure_illisible: 'heure illisible',
    heure_dans_le_futur: 'heure dans le futur',
    heure_absurde_horloge_de_la_machine: 'heure invraisemblable (horloge de la machine déréglée)',
    sens_du_pointage_inconnu: 'sens du pointage inconnu',
    deja_importe: 'déjà importé',
    pointage_deja_present_a_la_meme_minute: 'un pointage existe déjà à la même minute',
    employe_desactive: 'employé désactivé'
  }
  return T[m] || m || 'motif non précisé'
}

const VERDICT = {
  a_importer: { texte: 'à importer', ton: 'bleu' },
  importe: { texte: 'importé', ton: 'vert' },
  doublon: { texte: 'doublon', ton: 'gris' },
  refuse: { texte: 'écarté', ton: 'orange' }
}

/** Le dépouillement : avant l'accord → essence à blanc ; après → import réel. */
function depouillement(apercu, resultat, filtre, setFiltre) {
  const rep = resultat || apercu
  if (!rep) return null
  if (!rep.ok) {
    return <Avertissement ton="rouge">⛔ Import refusé : <b>{motifLisible(rep.reason)}</b></Avertissement>
  }
  const details = rep.details || []
  const visibles = filtre === 'tous' ? details : details.filter(d => d.verdict === filtre)
  const estEssai = !resultat

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ ...S.bandeau, ...(estEssai ? S.bandeauEssai : S.bandeauReel) }}>
        {estEssai ? <ShieldCheck size={16} /> : <CheckCircle2 size={16} />}
        <b>{estEssai ? 'Essai à blanc — rien n’a été enregistré' : 'Import effectué'}</b>
        <span style={{ opacity: 0.8 }}>lot du {formaterDateHeureLocale(new Date().toISOString())}</span>
      </div>

      <div style={S.grille}>
        <Carte valeur={rep.lignes_lues} libelle="lignes reçues" />
        <Carte valeur={rep.importes} libelle={estEssai ? 'seront importées' : 'importées'} ton="vert" />
        <Carte valeur={rep.lignes_refusees} libelle="écartées" ton={rep.lignes_refusees ? 'orange' : null} />
        <Carte valeur={rep.doublons} libelle="doublons" ton={rep.doublons ? 'gris' : null} />
        {rep.employes_etrangers > 0 && <Carte valeur={rep.employes_etrangers} libelle="d’une autre entreprise" ton="rouge" />}
      </div>

      {rep.periode?.debut && (
        <div style={S.periode}>
          <Clock size={16} /> Période reconnue : du <b>{formaterDateHeureLocale(rep.periode.debut)}</b> au <b>{formaterDateHeureLocale(rep.periode.fin)}</b>
        </div>
      )}

      {details.length > 0 && (
        <>
          <div style={S.onglets}>
            {['tous', 'refuse', 'doublon', 'a_importer', 'importe'].map(v => {
              const n = v === 'tous' ? details.length : details.filter(d => d.verdict === v).length
              if (n === 0 && v !== 'tous') return null
              return (
                <button key={v} onClick={() => setFiltre(v)}
                  style={{ ...S.onglet, ...(filtre === v ? S.ongletActif : {}) }}>
                  {v === 'tous' ? 'Tout' : VERDICT[v]?.texte || v} ({n})
                </button>
              )
            })}
          </div>

          <div style={S.tableauDefilant}>
            <table style={S.tableau}>
              <thead>
                <tr>
                  <th style={S.th}>Ligne</th>
                  <th style={S.th}>Employé</th>
                  <th style={S.th}>Heure</th>
                  <th style={S.th}>Sort</th>
                </tr>
              </thead>
              <tbody>
                {visibles.slice(0, 300).map((d, i) => {
                  const v = VERDICT[d.verdict] || { texte: d.verdict, ton: 'gris' }
                  return (
                    <tr key={i}>
                      <td style={S.td}>{d.ligne}</td>
                      <td style={S.tdMono}>{d.employee_id ? String(d.employee_id).slice(0, 8) + '…' : <span style={S.vide}>—</span>}</td>
                      <td style={S.td}>{d.check_time ? formaterDateHeureLocale(d.check_time) : <span style={S.vide}>—</span>}</td>
                      <td style={S.td}>
                        <span style={{ ...S.etiquetteVerdict, ...tonVerdict(v.ton) }}>{v.texte}</span>
                        {d.raison && <span style={S.raison}> — {motifLisible(d.raison)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {visibles.length > 300 && (
            <div style={S.aide}>Affichage limité aux 300 premières lignes ({visibles.length} au total).</div>
          )}
        </>
      )}
    </div>
  )
}

const tonVerdict = (ton) => ({
  vert:   { background: '#dcfce7', color: '#166534' },
  orange: { background: '#ffedd5', color: '#9a3412' },
  rouge:  { background: '#fee2e2', color: '#991b1b' },
  bleu:   { background: '#dbeafe', color: '#1e40af' },
  gris:   { background: '#e5e7eb', color: '#374151' }
}[ton] || {})

function Avertissement({ ton = 'orange', children }) {
  const fond = { orange: '#fff7ed', bleu: '#eff6ff', rouge: '#fef2f2' }[ton]
  const bord = { orange: '#fb923c', bleu: '#60a5fa', rouge: '#f87171' }[ton]
  return (
    <div style={{ ...S.avert, background: fond, borderColor: bord }}>
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  )
}

const Aide = ({ children }) => (
  <div style={S.blocAide}><HelpCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} /><div>{children}</div></div>
)

const Section = ({ titre, children }) => (
  <div style={{ marginTop: 18 }}>
    <div style={S.sectionTitre}>{titre}</div>
    {children}
  </div>
)

const Carte = ({ valeur, libelle, ton }) => (
  <div style={{ ...S.carte, ...tonVerdict(ton).background ? { background: tonVerdict(ton).background, borderColor: tonVerdict(ton).color } : {} }}>
    <div style={{ ...S.carteValeur, ...(tonVerdict(ton).color ? { color: tonVerdict(ton).color } : {}) }}>
      {Number(valeur ?? 0).toLocaleString('fr')}
    </div>
    <div style={S.carteLibelle}>{libelle}</div>
  </div>
)

// ────────────────────────────────────────────────────────────────────────────
//  Styles — en ligne, pour rester autonome (l'aperçu de l'application ne
//  charge aucune feuille de style externe).
// ────────────────────────────────────────────────────────────────────────────
const S = {
  voile: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 },
  cadre: { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.35)' },
  tete: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#fff' },
  pastille: { width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 16, fontWeight: 700 },
  sousTitre: { fontSize: 12, opacity: 0.75 },
  boutonX: { background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', padding: 6, borderRadius: 8 },
  fil: { display: 'flex', gap: 4, padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', alignItems: 'center' },
  filEtape: { display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto' },
  filRond: { width: 22, height: 22, borderRadius: '50%', background: '#e5e7eb', color: '#6b7280', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  filRondActif: { background: '#4f46e5', color: '#fff' },
  filRondFait: { background: '#16a34a', color: '#fff' },
  filTexte: { fontSize: 12, lineHeight: 1.25 },
  filAide: { fontSize: 10.5, color: '#6b7280' },
  corps: { padding: 16, overflowY: 'auto', flex: 1 },
  pied: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexWrap: 'wrap' },
  zoneDepot: { border: '2px dashed #a5b4fc', borderRadius: 12, padding: '34px 16px', textAlign: 'center', color: '#4338ca', cursor: 'pointer', background: '#f5f3ff' },
  aide: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  blocAide: { display: 'flex', gap: 8, marginTop: 16, padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12.5, color: '#374151', lineHeight: 1.5 },
  avert: { display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 10, border: '1px solid', fontSize: 13, lineHeight: 1.5, marginBottom: 12, color: '#111827' },
  resumeFichier: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, padding: '9px 11px', background: '#eef2ff', borderRadius: 10, color: '#312e81' },
  puce: { background: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 11.5, border: '1px solid #c7d2fe' },
  listeColonnes: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  puceColonne: { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 9px', fontSize: 11.5, color: '#374151' },
  puceVerte: { background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '1px 7px', fontSize: 10, marginLeft: 6, fontWeight: 600 },
  sectionTitre: { fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#111827' },
  ligneChamp: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, flexWrap: 'wrap' },
  etiquette: { width: 250, fontSize: 12.5, color: '#374151' },
  select: { flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', color: '#111827' },
  selectAttente: { borderColor: '#fb923c', background: '#fff7ed' },
  selectIgnore: { borderColor: '#d1d5db', background: '#f3f4f6', color: '#6b7280', textDecoration: 'line-through' },
  champRouge: { fontSize: 11, color: '#dc2626', fontWeight: 600 },
  input: { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 },
  tableauDefilant: { maxHeight: 300, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 },
  tableau: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '8px 10px', background: '#f3f4f6', position: 'sticky', top: 0, fontSize: 11.5, color: '#374151', fontWeight: 700, borderBottom: '1px solid #e5e7eb' },
  td: { padding: '7px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  tdMono: { padding: '7px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12 },
  vide: { color: '#9ca3af' },
  ko: { color: '#dc2626' },
  ambigu: { display: 'flex', gap: 9, marginTop: 10, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5 },
  boutonChoix: { padding: '6px 11px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' },
  boutonChoixActif: { borderColor: '#4f46e5', background: '#eef2ff', color: '#3730a3', fontWeight: 700 },
  grille: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 9, marginBottom: 12 },
  carte: { border: '1px solid #e5e7eb', borderRadius: 10, padding: '11px 12px', background: '#fafafa' },
  carteValeur: { fontSize: 21, fontWeight: 800, lineHeight: 1.1, color: '#111827' },
  carteLibelle: { fontSize: 11.5, color: '#4b5563', marginTop: 3 },
  periode: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, padding: '9px 11px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, color: '#14532d' },
  fuseau: { fontSize: 11.5, opacity: 0.75 },
  bandeau: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, marginBottom: 12, fontSize: 13 },
  bandeauEssai: { background: '#eef2ff', border: '1px solid #c7d2fe', color: '#312e81' },
  bandeauReel: { background: '#dcfce7', border: '1px solid #86efac', color: '#14532d' },
  onglets: { display: 'flex', gap: 6, marginBottom: 9, flexWrap: 'wrap' },
  onglet: { padding: '5px 11px', borderRadius: 20, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' },
  ongletActif: { background: '#4f46e5', color: '#fff', borderColor: '#4f46e5', fontWeight: 600 },
  etiquetteVerdict: { padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700 },
  raison: { fontSize: 11.5, color: '#6b7280' },
  boutonPrincipal: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, border: 0, background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  boutonVert: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, border: 0, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  boutonSecondaire: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' },
  centre: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 30, color: '#6b7280' },
  refus: { color: '#dc2626', fontSize: 13, fontWeight: 600 },
  succes: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 700, fontSize: 13 }
}

export { ETAPES, MAX_LIGNES }
