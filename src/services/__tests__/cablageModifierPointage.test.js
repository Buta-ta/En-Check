import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ═══════════════════════════════════════════════════════════════════════════
// CÂBLAGE DE « MODIFIER LE POINTAGE » — une ligne d'audit ne ressuscite jamais
// ═══════════════════════════════════════════════════════════════════════════
//  Incident du 16/10 (cas MADEDE), après avoir cliqué « Écarter » sur la sortie
//  présumée de 17:00 :
//
//    · la carte disait « 🚫 Sortie présumée écartée — non comptée » (correct) ;
//    · mais « Modifier le pointage » affichait TOUJOURS le 17:00, comme un vrai
//      pointage modifiable ;
//    · et surtout : `replace_attendance_day` supprime les lignes du jour puis
//      ré-insère celles du formulaire — ENREGISTRER LA FICHE SANS RIEN TOUCHER
//      faisait donc renaître le 17:00 rejeté en VRAIE sortie. L'heure que
//      l'admin venait de condamner ressuscitait par un simple « Enregistrer ».
//
//  La règle du cadre (arbitrage n°3, C4) : une ligne d'audit — estimation
//  ÉCARTÉE ou REMPLACÉE — n'est ni affichée dans le formulaire, ni supprimée par
//  l'enregistrement. Elle reste en base, intacte, pour la mesure d'erreur.
//
//  Analyse lexicale, sans React ni jsdom (même contrat que
//  cablagePointageCard.test.js) : elle ne prouve pas le rendu, elle prouve que
//  l'ÉTAT AFFICHÉ et `p_delete_ids` partagent le MÊME filtre — précisément la
//  classe de bug vécue (deux chemins, un seul filtre).
//
//  Les bornes de fonction sont prises au niveau 0 d'indentation (`^function`),
//  pas en équilibrant les accolades : le JSX français contient des apostrophes
//  hors chaînes qui cassent tout lexer de portées naïf.

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FICHIER = join(RACINE, 'components', 'ModifierPointage.jsx')
const source = readFileSync(FICHIER, 'utf8')

describe('« Modifier le pointage » — les lignes d’audit ne s’y éditent ni ne s’y suppriment', () => {
  it('1) le filtre des lignes exploitables utilise les deux prédicats du cadre : uuid de base + hors-calc', () => {
    // `estLigneHorsCalcul` = estimation écartée OU remplacée (jamais la vérité).
    // `estIdentifiantDeBase` = une clé primaire réelle, jamais un agrégat virtuel
    //   du moteur (`virtual-out-…`) — le même 400 « uuid » que le 16/10 08:54.
    expect(source).toMatch(/lignesEditables\s*=/)
    expect(source).toMatch(/estIdentifiantDeBase\(p\.id\)/)
    expect(source).toMatch(/estLigneHorsCalcul\(p\)/)
  })

  it('2) l’état du formulaire est construit depuis CE filtre (pas depuis la journée brute)', () => {
    // `initPointages` doit mapper `lignesEditables` — si quelqu'un le rebascule
    // sur `pointagesJournee`, le 17:00 écarté réapparaît dans le formulaire.
    const init = source.match(/const initPointages[\s\S]*?\n {2}\}/)
    expect(init).toBeTruthy()
    expect(init[0]).toMatch(/lignesEditables\.map\(/)
    expect(init[0]).not.toMatch(/pointagesJournee\.map\(/)
  })

  it('3) `p_delete_ids` partage le MÊME filtre — l’enregistrement ne touche jamais aux lignes d’audit', () => {
    // C'EST LE BUG : `pointagesJournee.map(p => p.id)` envoyait les lignes
    // d'audit à la suppression / ré-insertion → l'heure écartée ressuscitait en
    // vrai pointage. La seule source légitime est `lignesEditables`.
    expect(source).toMatch(/idsToDelete\s*=\s*lignesEditables\.map\(p\s*=>\s*p\.id\)/)
    expect(source).not.toMatch(/idsToDelete\s*=\s*pointagesJournee\.map/)
  })

  it('4) le formulaire DIT que des lignes d’audit sont masquées (pas de disparition silencieuse)', () => {
    // Honnêteté : si des lignes sont cachées, l'admin doit le voir — sinon il
    // croit que la journée est vide ou se demande où est passée son heure.
    expect(source).toMatch(/nbLignesMasquees/)
    expect(source).toMatch(/noteAudit/)
  })
})
