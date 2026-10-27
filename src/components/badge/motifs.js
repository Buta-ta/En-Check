// ═══════════════════════════════════════════════════════════════
// LES MOTIFS DE LA CARTE — la liste, et rien d'autre
// ═══════════════════════════════════════════════════════════════

export const MOTIFS = [
  { id: 'perles', nom: 'Perles', detail: 'Le fil du registre' },
  { id: 'kente', nom: 'Kente', detail: 'Blocs tissés' },
  { id: 'aso-oke', nom: 'Aso Oke', detail: 'Rayures filées' },
  { id: 'bogolan', nom: 'Bogolan', detail: 'Damier de terre' },
  { id: 'ndebele', nom: 'Ndebele', detail: 'Triangles peints' },
  { id: 'dogon', nom: 'Dogon', detail: 'Grille de cases' },
  { id: 'aucun', nom: 'Aucun', detail: 'Un simple filet' },
]

export const estMotif = (id) => MOTIFS.some((motif) => motif.id === id)
