// ═══════════════════════════════════════════════════════════
// 🧵 QUEL MOTIF POUR QUELLE PAGE
//
// Une seule carte, lue par le bandeau, l'écran de chargement et
// l'assistant : une page ne peut pas changer d'identité selon
// l'endroit d'où on la regarde.
//
// Ce fichier existe à part parce qu'un module de composants ne
// doit exporter que des composants (règle du rechargement à chaud) :
// la carte est une donnée, le bandeau est un dessin.
// ═══════════════════════════════════════════════════════════

// Pages sans motif dessiné historiquement : elles gardent le kente.
export function culturalMotifForPath(pathname = '') {
  const page = pathname.split(/[?#]/)[0].split('/').filter(Boolean)[0]
  if (page === 'heures-supplementaires') return 'aso-oke'
  if (page === 'retards') return 'retards-tissage'
  if (page === 'pointages') return 'adinkra'
  if (page === 'admins' || page === 'mon-compte') return 'abomey'
  if (page === 'entreprises') return 'korhogo'
  if (page === 'carte-temps-reel') return 'dogon'
  if (page === 'rapports') return 'nsibidi'
  if (page === 'pauses' || page === 'jours-feries') return 'lesotho'
  if (page === 'employes') return 'zoulou'
  if (page === 'planning') return 'kuba'
  if (page === 'absences') return 'ndebele'
  //  Rémunérations nourrit la Paie : même pagne de boue, même famille.
  if (page === 'remunerations') return 'bogolan'
  if (['paie', 'fiches-paie', 'configuration-fiscale'].includes(page)) return 'bogolan'
  return 'kente'
}

export default culturalMotifForPath
