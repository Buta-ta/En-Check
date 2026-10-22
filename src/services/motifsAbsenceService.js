// ═══════════════════════════════════════════════════════════
// 🎨 MOTIFS D'ABSENCE — ACCÈS AUX DONNÉES
//
// Les motifs ne sont plus une constante : ce sont des lignes de
// `absence_motifs`, créées, modifiées et SUPPRIMÉES par l'admin.
//
// Doctrine (validée le 22/10) : une VRAIE suppression, pas un
// archivage. Mais une absence ne peut pas se retrouver sans
// couleur : si le motif est utilisé, on transfère d'abord ses
// absences vers un autre motif, puis on supprime.
//
// Portée : chaque entreprise reçoit sa propre COPIE des 7 motifs
// d'origine (mêmes codes). L'admin travaille donc toujours sur
// des lignes qui lui appartiennent — il peut les recolorer et les
// supprimer, et les absences gardent leur code.
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

const CODES_RESERVES = new Set(MOTIFS_PAR_DEFAUT.map((m) => m.code || m.id))

/** Un nouveau motif ne peut pas voler le code d'un motif d'origine */
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

const global = (id) => !id || id === 'all'

class MotifsAbsenceService {
  /**
   * Chaque entreprise possède sa copie des motifs d'origine.
   * On la crée au premier passage : après ça, tout est modifiable
   * et supprimable par l'admin de cette entreprise.
   */
  async assurerMotifsEntreprise(enterpriseId) {
    if (global(enterpriseId)) return []

    const [{ data: globaux }, { data: miens }] = await Promise.all([
      supabase.from('absence_motifs').select('*').is('enterprise_id', null).is('archive_le', null).order('ordre'),
      supabase.from('absence_motifs').select('code').eq('enterprise_id', enterpriseId),
    ])

    const presents = new Set((miens || []).map((m) => m.code))
    const aCreer = (globaux || []).filter((g) => !presents.has(g.code))

    if (aCreer.length > 0) {
      await supabase.from('absence_motifs').insert(
        aCreer.map((g) => ({
          enterprise_id: enterpriseId,
          code: g.code,
          label: g.label,
          emoji: g.emoji,
          color: g.color,
          bg: g.bg || fondDepuisCouleur(g.color),
          ordre: g.ordre,
          is_system: false,
        }))
      )
    }
    return aCreer
  }

  /** Motifs actifs : la copie de l'entreprise, ou les globaux en vue « toutes entreprises » */
  async lister(enterpriseId) {
    await this.assurerMotifsEntreprise(enterpriseId)

    const query = supabase
      .from('absence_motifs')
      .select('*')
      .is('archive_le', null)

    if (global(enterpriseId)) query.is('enterprise_id', null)
    else query.eq('enterprise_id', enterpriseId)

    const { data, error } = await query.order('ordre', { ascending: true })
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
        enterprise_id: global(enterpriseId) ? null : enterpriseId,
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

  /**
   * SUPPRESSION RÉELLE.
   * Le garde-fou est dans l'interface : on ne supprime qu'après
   * avoir transféré les absences qui utilisaient ce motif, et
   * jamais le dernier motif de l'entreprise.
   */
  async supprimer(id) {
    const { error } = await supabase
      .from('absence_motifs')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  }

  /**
   * Bascule les absences d'un motif vers un autre, avant suppression.
   * Portée entreprise : on ne touche jamais aux absences des autres.
   */
  async reassigner({ codeSource, codeCible, enterpriseId }) {
    if (!codeSource || !codeCible || codeSource === codeCible) return 0

    let query = supabase
      .from('absences')
      .update({ reason: codeCible })
      .eq('reason', codeSource)
      .select('id')

    if (!global(enterpriseId)) query = query.eq('enterprise_id', enterpriseId)

    const { data, error } = await query
    if (error) throw error
    return (data || []).length
  }

  /** Combien d'absences de cette entreprise utilisent ce motif ? */
  async usages(code, enterpriseId) {
    if (!code) return 0
    let query = supabase
      .from('absences')
      .select('id', { count: 'exact', head: true })
      .eq('reason', code)

    if (!global(enterpriseId)) query = query.eq('enterprise_id', enterpriseId)

    const { count, error } = await query
    if (error) return 0
    return Number(count) || 0
  }
}

/** Le code source stocke `reason` = code du motif ; on garde `id` = code */
function normaliser(ligne) {
  return {
    ...ligne,
    id: ligne.code,        // code métier : 'conge', 'musique'…
    rowId: ligne.id,       // uuid de la ligne : sert aux UPDATE et DELETE

    color: ligne.color || '#9CA3AF',
    bg: ligne.bg || fondDepuisCouleur(ligne.color),
    emoji: ligne.emoji || '📋',
    label: ligne.label,
  }
}

export { fondDepuisCouleur }

export default new MotifsAbsenceService()
