// ═══════════════════════════════════════════════════════════
// 🖨️ CE QUE LA POLICE DU PDF SAIT ÉCRIRE
//
// jsPDF écrit ses polices standard en WinAnsi (cp1252). Un caractère
// hors de ce jeu ne lève aucune erreur : il sort en bouillie. Une
// flèche « → » entre deux dates est ainsi devenue « !’ » au milieu
// d'un rapport.
//
// Ce module ne réécrit pas les phrases : il retire ce que la police ne
// sait pas dessiner, et ne remplace que ce qui a un équivalent évident
// (une flèche devient un tiret, une lettre exotique garde sa lettre de
// base). Les accents, les guillemets français, les tirets et l'euro
// restent — ils sont dans le jeu.
// ═══════════════════════════════════════════════════════════

// Le latin-1, plus les ponctuations typographiques que cp1252 ajoute.
const HORS_WINANSI =
  /[^\u0000-\u00ff\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/gu

// Ce qui a un équivalent latin lisible. Le reste disparaît — un émoji
// n'a rien à faire dans un bulletin, mais il ne doit pas y laisser de
// charabia.
const EQUIVALENTS = {
  '→': '-', '⟶': '-', '➜': '-', '⇒': '=>',
  '←': '-', '↔': '-', '↦': '->',
  '−': '-', '⸻': '-', '▬': '-', '─': '-', '═': '=',
  '│': '|', '┃': '|', '▪': '-', '▸': '-', '●': '·', '◆': '·',
}

// Orthographes des langues du pays : la lettre la plus proche, sans
// inventer de son. Ɔ reste un O, Ɛ un E.
const LETTRES = {
  'ɔ': 'o', 'Ɔ': 'O', 'ɛ': 'e', 'Ɛ': 'E', 'ɖ': 'd', 'Ɖ': 'D',
  'ŋ': 'n', 'Ŋ': 'N', 'ʋ': 'v', 'Ʋ': 'V', 'ɓ': 'b', 'Ɓ': 'B',
  'ɗ': 'd', 'Ɗ': 'D', 'Ƒ': 'F', 'ɠ': 'g', 'Ɠ': 'G',
}

/**
 * Un caractère hors WinAnsi, ramené à ce que la police sait écrire.
 * Une lettre exotique garde sa lettre de base ; une flèche devient un
 * tiret ; un émoji ne laisse rien.
 */
function equivalent(caractere) {
  //  « Ọ » = « O » + point souscrit : la décomposition garde la lettre.
  const decompose = caractere.normalize('NFD').replace(/\p{M}/gu, '')
  if (decompose && !/[^\u0000-\u00ff]/u.test(decompose)) return decompose

  return EQUIVALENTS[caractere] ?? LETTRES[caractere] ?? ''
}

/** Le texte tel qu'il peut partir dans un PDF. */
export function texteImprimable(valeur) {
  if (valeur == null) return ''
  return String(valeur)
    .replace(HORS_WINANSI, equivalent)
    // un caractère retiré au milieu d'une phrase ne doit pas laisser
    // deux espaces collés, ni un blanc en tête
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Vrai si la police saurait écrire ce texte tel quel. */
export function estImprimable(valeur) {
  if (valeur == null) return true
  return !new RegExp(HORS_WINANSI.source, HORS_WINANSI.flags).test(String(valeur))
}

export default texteImprimable
