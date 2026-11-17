// ═══════════════════════════════════════════════════════════
// VÉRITÉ DE L'ÉTAT DE PRÉSENCE — « pas encore pointé » ≠ « absent »
//
// Règle du dictionnaire de données : le mot « absent » ne doit
// jamais apparaître avant la fin du poste. Tant que la fin du
// poste (auto_close_time de l'entreprise, sinon 18 h, à l'heure
// locale de l'entreprise) n'est pas dépassée, un salarié sans
// pointage est « pas encore pointé » — une absence
// d'information, pas une accusation.
// ═══════════════════════════════════════════════════════════

/**
 * La fin du poste est-elle dépassée ?
 * Seuil : auto_close_time de l'entreprise (sinon 18:00), évalué
 * dans le fuseau de l'entreprise (sinon fuseau local du navigateur).
 */
export function finPosteDepassee(entreprise = {}) {
  const [fh, fm] = String(entreprise.auto_close_time || '18:00')
    .split(':')
    .map((n) => Number(n) || 0)
  const seuil = fh * 60 + fm
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: entreprise.timezone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const h = Number(parts.find((p) => p.type === 'hour')?.value) || 0
    const m = Number(parts.find((p) => p.type === 'minute')?.value) || 0
    return h * 60 + m >= seuil
  } catch {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes() >= seuil
  }
}

/** Libellé honnête du contingent « sans pointage ni congé ». */
export function libelleSansPointage(depassee, singulier = false) {
  if (depassee) return singulier ? 'absent' : 'absents'
  return singulier ? 'pas encore pointé' : 'pas encore pointés'
}

/**
 * Bannière « N ayant pointé aujourd’hui » : liste des employés ayant
 * pointé (dédoublonnés par id), prêts à être affichés en profils.
 *
 * Les pointages arrivent déjà triés du plus récent au plus ancien ;
 * l'ordre d'apparition est conservé (le plus récent pointe en tête).
 * La photo du pointage du jour prime sur la photo du profil : c'est
 * le visage qui s'est réellement présenté à la borne aujourd'hui.
 */
export function construirePresentsAujourdhui(attendances = []) {
  const vus = new Set()
  const presents = []
  for (const a of attendances || []) {
    const id = a?.employee_id
    if (!id || vus.has(id)) continue
    vus.add(id)
    const e = a?.employees || {}
    const photoPointage = a?.pointages_photos?.[0]?.photo_url
    presents.push({
      id,
      prenom: e.first_name || '',
      nom: e.last_name || '',
      nomComplet: [e.first_name, e.last_name].filter(Boolean).join(' ').trim(),
      matricule: e.matricule,
      photo: photoPointage || e.photo_url || null,
    })
  }
  return presents
}
