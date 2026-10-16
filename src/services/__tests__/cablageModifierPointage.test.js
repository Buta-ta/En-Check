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

  it('3) `p_delete_ids` exclut les lignes présumées — jamais de « blanchiment » en badge', () => {
    // Règle du 16/10 soir : une sortie présumée (validée OU à statuer) reste
    // MARQUÉE — `replace_attendance_day` ne recopie que check_type/check_time
    // et la re-créerait en badge réel. Les vrais badges seuls passent par lui ;
    // les lignes présumées sont gérées en place (encheck_estimation_deplacer /
    // encheck_estimation_decider). Les lignes d'audit ne sont ni affichées ni
    // touchées : jamais de résurrection (bug MADEDE).
    expect(source).toMatch(/idsToDelete\s*=\s*lignesEditables/)
    expect(source).toMatch(/\.filter\(\s*p\s*=>\s*!p\.__estimation\s*\)/)
    expect(source).not.toMatch(/idsToDelete\s*=\s*pointagesJournee\.map/)
  })

  it('4) « Écarter » = DISPARITION de la fiche ; « Valider » = la ligne reste, MARQUÉE', () => {
    // Décision du commanditaire (16/10 soir) :
    //   « quand l'admin valide, l'heure de sortie présumée reste et est marquée
    //    dans « modifier le pointage », quand l'admin écarte, ces heures
    //    présumées disparaissent. »
    //  → le chip de marque existe (⏳ à statuer / ✅ validée) ;
    //  → plus aucune notice « N lignes d'audit masquées » (elles disparaissent) ;
    //  → retirer une ligne présumée du formulaire = « Écarter » (decider 'rejeter').
    expect(source).toMatch(/Sortie présumée/)
    expect(source).toMatch(/__estimationEtat/)
    expect(source).not.toMatch(/nbLignesMasquees/)
    expect(source).toMatch(/p_decision:\s*'rejeter'/)
  })
})
