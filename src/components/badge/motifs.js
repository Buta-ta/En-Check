// ═══════════════════════════════════════════════════════════════
// LES MOTIFS DE LA CARTE — les vrais, ceux des bandeaux
// ═══════════════════════════════════════════════════════════════
//
// Un badge ne dessine pas son propre motif : il reprend celui de la
// page, à l'identique. Trois motifs viennent des images de bandeau
// (`public/images`), deux des frises vectorielles maison (kente,
// dogon). Ce qui change d'un écran à l'autre, c'est la hauteur —
// jamais le dessin.

export const MOTIFS = [
  {
    id: 'perles',
    nom: 'Perles',
    detail: 'Le bandeau des employés',
    image: '/images/employes-zoulou.webp',
  },
  {
    id: 'kente',
    nom: 'Kente',
    detail: 'Le tissage akan',
    svg: 'kente',
  },
  {
    id: 'aso-oke',
    nom: 'Aso Oke',
    detail: 'Les rayures filées',
    image: '/images/heures-aso-oke.svg',
  },
  {
    id: 'bogolan',
    nom: 'Bogolan',
    detail: 'La terre teinte',
    image: '/images/paie-bogolan-haut.webp',
  },
  {
    id: 'ndebele',
    nom: 'Ndebele',
    detail: 'La peinture ndebele',
    image: '/images/absences-ndebele.webp',
  },
  {
    id: 'dogon',
    nom: 'Dogon',
    detail: 'La porte de grenier',
    svg: 'dogon',
  },
  {
    id: 'aucun',
    nom: 'Aucun',
    detail: 'Un simple filet',
  },
]

export const estMotif = (id) => MOTIFS.some((motif) => motif.id === id)

export const motifParId = (id) => MOTIFS.find((motif) => motif.id === id) || null
