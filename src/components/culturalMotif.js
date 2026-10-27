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
  // Les devis ont rejoint la prospection : même appliqué cousu.
  if (page === 'prospection' || page === 'devis') return 'abomey'
  if (page === 'entreprises') return 'korhogo'
  // Les pointeuses et le poste de pointage ont fusionné sous la même toile.
  if (page === 'configuration-pointeuse' || page === 'pointeuses') return 'korhogo'
  // Le plateau et les zones ont fusionné : une seule porte dogon.
  if (page === 'geopointage' || page === 'carte-temps-reel') return 'dogon'
  if (page === 'rapports') return 'nsibidi'
  if (page === 'pauses' || page === 'jours-feries') return 'lesotho'
  if (page === 'employes') return 'zoulou'
  if (page === 'planning') return 'kuba'
  // Les enrôlements et les réglages ont fusionné sous le même velours.
  // Les deux adresses retirées gardent l'identité de la page qui les reçoit.
  if (['reconnaissance-faciale', 'enrollements-faciaux', 'config-reco-faciale'].includes(page)) return 'kuba'
  if (page === 'absences') return 'ndebele'
  //  Rémunérations nourrit la Paie : même pagne de boue, même famille.
  if (page === 'remunerations') return 'bogolan'
  if (['paie', 'fiches-paie', 'configuration-fiscale'].includes(page)) return 'bogolan'
  return 'kente'
}

export default culturalMotifForPath
