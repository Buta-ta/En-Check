// ═══════════════════════════════════════════════════════════
// NETTOYAGE DES TEXTES AFFICHÉS — garde de dernier recours
//
// Un caractère de remplacement (U+FFFD) ou un caractère invisible
// ne doit jamais atteindre l'écran : dans un produit qui vend la
// preuve, un nom cassé coûte plus cher en crédibilité que dix
// fonctionnalités manquantes. La base est nettoyée à la source ;
// cette fonction protège l'affichage contre tout résidu (anciens
// imports, données tierces, copier-coller).
//
// Contrat : toujours renvoie une chaîne (jamais null/undefined),
// prête à être interpolée dans du JSX.
// ═══════════════════════════════════════════════════════════

const RE_CASSURES = /[\uFFFD\u200B-\u200D\uFEFF]/g
const RE_ESPACES_MULTIPLES = /\s{2,}/g

/** Retire les caractères cassés et invisibles d'un texte affiché. */
export function nettoyerTexte(texte) {
  return String(texte ?? '')
    .replace(RE_CASSURES, '')
    .replace(RE_ESPACES_MULTIPLES, ' ')
    .trim()
}
