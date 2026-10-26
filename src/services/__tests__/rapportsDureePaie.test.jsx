// ═══════════════════════════════════════════════════════════
// ⏱️💳 LE RAPPORT DIT LA DURÉE EFFECTIVE, ET QUI A ÉTÉ PAYÉ
//
// Ce que ces tests gardent, dans les trois exports :
//   ① la présence brute ET les pauses réellement déduites y sont,
//      côte à côte, pour que le temps effectif se lise sans calcul ;
//   ② le rapport descend au jour quand on vise une seule personne ;
//   ③ le paiement vient de la page Paie, pas d'une supposition ;
//   ④ la marque de paiement se pose depuis les fiches, et se retire.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const rapports = lire('src/pages/Rapports.jsx')
const css = lire('src/pages/Rapports.css')
const fiches = lire('src/pages/FichesPaie.jsx')
const action = lire('src/components/PaiementFiche.jsx')
const modales = lire('src/components/BulletinModales.jsx')
const hook = lire('src/hooks/usePaiementsFiches.js')
const migration = lire('supabase/migrations/20261026000018_paiement_bulletins.sql')

describe('1. la durée du travail effectuée', () => {
  it('lit les pauses dans la même source que la page Pointages', () => {
    expect(rapports).toContain("supabase.rpc('encheck_pauses_lire'")
    expect(rapports).toContain('construirePauses')
    expect(rapports).toContain('pausesDeductiblesPourEmploye')
  })

  it('n’affiche jamais un brut sans dire ce que les pauses ont retiré', () => {
    // le résumé du PDF
    expect(rapports).toContain("label: 'Présence brute'")
    expect(rapports).toContain("label: 'Pauses déduites'")
    expect(rapports).toContain("label: 'Temps effectif'")
    // les colonnes du registre
    expect(rapports).toContain("'Présence', 'Pauses', 'Effectif'")
    // l'aperçu de la page
    expect(rapports).toContain('>Pauses<')
    expect(rapports).toContain('>Effectif<')
  })

  it('calcule le temps effectif une seule fois, pour les trois exports', () => {
    expect(rapports).toContain('const construireLigneEmploye = ')
    // PDF, PDF graphique et tableur passent tous par la même ligne
    const appels = rapports.match(/construireLigneEmploye\(/g) || []
    expect(appels.length).toBeGreaterThanOrEqual(4)
  })

  it('déduit les pauses du seul temps payable', () => {
    expect(rapports).toContain('filtrerPointagesPayables')
    expect(rapports).toContain('effectifMinutes = Math.max(0, presenceMinutes - pauses.minutes)')
  })
})

describe('2. un rapport pour une seule personne', () => {
  it('propose « tous » ou un employé, cherché par nom ou matricule', () => {
    expect(rapports).toContain('selectedEmployeId')
    expect(rapports).toContain('placeholder="Nom ou matricule"')
    expect(rapports).toContain('aria-label="Choisir l’employé du rapport"')
    expect(rapports).toContain('>Tous les employés (')
  })

  it('filtre réellement la requête des employés', () => {
    expect(rapports).toContain("e => selectedEmployeId === 'tous' || e.id === selectedEmployeId")
  })

  it('descend au jour quand il n’y a qu’une personne', () => {
    expect(rapports).toContain('construireJourneesEmploye')
    expect(rapports).toContain("'Registre jour par jour'")
    expect(rapports).toContain("'Date', 'Entrée', 'Sortie', 'Présence', 'Pauses', 'Effectif', 'Zone'")
  })

  it('nomme le document et le fichier d’après la personne', () => {
    expect(rapports).toContain("employeUnique ? 'Dossier de présence' : 'Rapport de pointage'")
    expect(rapports).toContain('suffixeEmploye')
    expect(rapports).not.toContain('`Rapport_${enterpriseName}_${dateDebut}_${dateFin}.pdf`')
  })

  it('garde le sujet visible dans la bande du PDF', () => {
    expect(rapports).toContain('sujetEmploye')
    expect(rapports).toContain('complement: employeUnique ? sujetEmploye')
  })

  it('habille le sélecteur, sans case native nue', () => {
    expect(css).toContain('.rp-sujet {')
    expect(css).toContain('.rp-select-employe')
    expect(css).toContain('.rp-recherche')
    // et tient en poche
    expect(css).toMatch(/@media \(max-width: 720px\) \{\s*\.rp-sujet-corps/)
  })
})

describe('3. le paiement, marqué et non deviné', () => {
  it('vient de la table des bulletins, pas d’une case du rapport', () => {
    expect(rapports).toContain('chargerBulletinsPeriode')
    expect(rapports).toContain('resumerPaieParEmploye')
    expect(rapports).toContain('etiquettePaie')
    expect(rapports).toContain("'Bulletins et paiements'")
  })

  it('distingue payé, émis et calculé dans les trois exports', () => {
    expect(rapports).toContain('`Payé ${jour}`')
    expect(rapports).toContain("court: 'Émis'")
    expect(rapports).toContain("court: 'Calculé'")
    expect(rapports).toContain("'Payé le'")
  })

  it('dit quand la base ne sait pas encore suivre un paiement', () => {
    expect(rapports).toContain('paiementConnu')
    expect(rapports).toContain('paiement non suivi sur cette base')
  })

  it('pose la marque depuis les fiches de paie', () => {
    expect(action).toContain('marquerPaye')
    expect(action).toContain('retirerPaiement')
    expect(action).toContain('<PaiementModal')
    expect(action).toContain("'Marquer payé'")
    expect(action).toContain('Payé le {jourLisible(paiement.payeLe)}')
    // la page porte la puce et le compteur, pas la mécanique
    expect(fiches).toContain('<BadgePaiement')
    expect(fiches).toContain('<ActionPaiement')
    expect(hook).toContain('chargerPaiementsPeriode')
  })

  it('ne marque payé qu’une fiche déjà publiée', () => {
    expect(action).toContain('Publiez d’abord la fiche')
  })

  it('tient la date, le moyen et la référence dans le tiroir', () => {
    expect(modales).toContain('export function PaiementModal')
    expect(modales).toContain('MOYENS_PAIEMENT.map')
    expect(modales).toContain('Date du paiement')
    expect(modales).toContain('Retirer la marque')
    expect(modales).toContain("Cette marque n'envoie aucun argent")
  })

  it('garde la page des fiches sous son poids promis', () => {
    // 2 000 lignes : au-delà, la logique doit sortir dans un composant.
    expect(fiches.split('\n').length).toBeLessThan(2000)
  })

  it('s’appuie sur une migration qui ne casse rien', () => {
    for (const colonne of ['paid_at', 'paid_by', 'payment_method', 'payment_reference']) {
      expect(migration).toContain(`add column if not exists ${colonne}`)
    }
    expect(migration).toContain('idx_employee_payslips_paid_at')
    expect(migration).toContain('begin;')
    expect(migration).toContain('commit;')
  })
})
