// ═══════════════════════════════════════════════════════════
// 🎨 MOTIFS D'ABSENCE — ACCÈS AUX DONNÉES
//
// Les motifs ne sont plus une constante : ce sont des lignes de
// `absence_motifs`, modifiables par l'admin (libellé, emoji, couleur).
//
// Doctrine : on ARCHIVE, on n'efface jamais. Un motif archivé reste
// lisible par les absences qui l'utilisent, et se restaure en un clic.
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'
import { MOTIFS_PAR_DEFAUT, fondDepuisCouleur } from '../constants/motifsAbsence'

/** 'Congé payé' → 'conge-paye' ; 'Formation ⚡' → 'formation' */
export function codeDepuisLabel(label, index = 0) {
  const base = (label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const propre = base || 'motif'
  return index > 0 ? `${propre}-${index}` : propre
}

/** Un code ne peut pas écraser un motif d'origine (is_system) */
const CODES_RESERVES = new Set(MOTIFS_PAR_DEFAUT.map((m) => m.id))

export function codeDisponible(code, motifsExistants = []) {
  if (!CODES_RESERVES.has(code)) return code
  const pris = new Set(motifsExistants.map((m) => m.code))
  let i = 2
  let candidat = `${code}-${i}`
  while (pris.has(candidat)) {
    i += 1
    candidat = `${code}-${i}`
  }
  return candidat
}

class MotifsAbsenceService {
  /** Motifs actifs : les globaux + ceux de l'entreprise */
  async lister(enterpriseId) {
    let query = supabase
      .from('absence_motifs')
      .select('*')
      .is('archive_le', null)

    query = enterpriseId && enterpriseId !== 'all'
      ? query.or(`enterprise_id.is.null,enterprise_id.eq.${enterpriseId}`)
      : query.is('enterprise_id', null)

    const { data, error } = await query.order('ordre', { ascending: true })
    if (error) throw error
    return (data || []).map(normaliser)
  }

  /** Corbeille : les motifs archivés de l'entreprise */
  async corbeille(enterpriseId) {
    let query = supabase
      .from('absence_motifs')
      .select('*')
      .not('archive_le', 'is', null)

    if (enterpriseId && enterpriseId !== 'all') query = query.eq('enterprise_id', enterpriseId)

    const { data, error } = await query.order('archive_le', { ascending: false })
    if (error) throw error
    return (data || []).map(normaliser)
  }

  async creer({ enterpriseId, label, emoji, color, code, ordre }) {
    const { data: existants } = await supabase
      .from('absence_motifs')
      .select('code')
      .is('archive_le', null)
    const codeFinal = codeDisponible(code || codeDepuisLabel(label), existants || [])

    const { data, error } = await supabase
      .from('absence_motifs')
      .insert({
        enterprise_id: enterpriseId && enterpriseId !== 'all' ? enterpriseId : null,
        code: codeFinal,
        label: (label || '').trim(),
        emoji: emoji || '📋',
        color: color || '#9CA3AF',
        bg: fondDepuisCouleur(color || '#9CA3AF'),
        ordre: ordre ?? 100,
        is_system: false,
      })
      .select()
      .single()
    if (error) throw error
    return normaliser(data)
  }

  async modifier(id, patch) {
    const { data, error } = await supabase
      .from('absence_motifs')
      .update({
        ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
        ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
        ...(patch.color !== undefined ? { color: patch.color, bg: fondDepuisCouleur(patch.color) } : {}),
        ...(patch.ordre !== undefined ? { ordre: patch.ordre } : {}),
        maj_le: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return normaliser(data)
  }

  /** Archiver : jamais d'effacement physique */
  async archiver(id) {
    const { error } = await supabase
      .from('absence_motifs')
      .update({ archive_le: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return true
  }

  async restaurer(id) {
    const { error } = await supabase
      .from('absence_motifs')
      .update({ archive_le: null })
      .eq('id', id)
    if (error) throw error
    return true
  }

  /** Combien d'absences utilisent ce motif ? (avertissement avant archivage) */
  async usages(code) {
    if (!code) return 0
    const { data, error } = await supabase.rpc('encheck_absence_motifs_usages', { p_code: code })
    if (error) return 0
    return Number(data) || 0
  }
}

/** Le code source stocke `reason` = code du motif ; on garde `id` = code */
function normaliser(ligne) {
  return {
    ...ligne,
    id: ligne.code,
    color: ligne.color || '#9CA3AF',
    bg: ligne.bg || fondDepuisCouleur(ligne.color),
    emoji: ligne.emoji || '📋',
    label: ligne.label,
  }
}

export { fondDepuisCouleur }

export default new MotifsAbsenceService()
