// ═══════════════════════════════════════════════════════════
// 📝 FORMULAIRE D'ABSENCE — TIROIR DE SAISIE
//
// Rendu serveur : on vérifie les cinq étapes, les motifs vivants,
// les compteurs et les garde-fous (chevauchement, dépassement).
// ═══════════════════════════════════════════════════════════

import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AbsenceFormulaire from '../../components/AbsenceFormulaire'

const employes = [
  { id: 'e1', first_name: 'Aïssatou', last_name: 'Diallo', matricule: 'ENN-0001', photo_url: 'https://cdn.test/ad.jpg' },
  { id: 'e2', first_name: 'Mamadou', last_name: 'Konaté', matricule: 'ENN-0002', photo_url: null },
  { id: 'e3', first_name: 'Salimata', last_name: 'Keita', matricule: 'ENN-0003', photo_url: 'https://cdn.test/sk.jpg' },
]

const valeurs = {
  employee_id: 'e1',
  start_date: '2026-10-19',
  end_date: '2026-10-23',
  reason: 'conge',
  status: 'approuve',
  notes: 'Certificat fourni',
  document_file: null,
  existing_document_url: null,
  remove_document: false,
  count_holidays_as_leave: false,
}

// La page connaît les fériés de l'entreprise : c'est elle qui calcule
// la durée décomptée. Ici on la fournit comme elle le ferait.
const rendre = (props = {}) => renderToStaticMarkup(
  <AbsenceFormulaire
    ouvert
    valeurs={valeurs}
    employes={employes}
    joursDecomptes={5}
    joursCalendaires={5}
    {...props}
  />
)

const formulaire = rendre()

it('1. fermé, le tiroir ne rend rien', () => {
  expect(renderToStaticMarkup(<AbsenceFormulaire ouvert={false} valeurs={valeurs} employes={employes} />)).toBe('')
})

it('2. les cinq étapes sont dans l\'ordre où l\'on y pense', () => {
  const ordre = ['Qui ?', 'Quel motif ?', 'Quelle période ?', 'Justificatif et notes', 'Récapitulatif']
  let position = -1
  ordre.forEach((titre) => {
    const i = formulaire.indexOf(titre)
    expect(i).toBeGreaterThan(position)
    position = i
  })
})

it('3. le titre dit si l\'on crée ou si l\'on corrige', () => {
  expect(formulaire).toContain('Déclarer une absence')
  expect(rendre({ edition: true })).toContain('Modifier l&#x27;absence')
})

it('4. les employés sont des pastilles avec leur photo', () => {
  expect(formulaire).toContain('data-testid="abs-form-employe"')
  expect(formulaire).toContain('https://cdn.test/ad.jpg')
  expect(formulaire).toContain('https://cdn.test/sk.jpg')
  // Mamadou n'a pas de photo : ses initiales
  expect(formulaire).toContain('>MK<')
  // une seule pastille est sélectionnée
  expect((formulaire.match(/data-testid="abs-form-employe" data-actif="oui"/g) || [])).toHaveLength(1)
})

it('5. les motifs viennent du fournisseur, pas d\'une liste figée', () => {
  const motifs = [...formulaire.matchAll(/data-testid="abs-form-motif" data-motif="([^"]+)"/g)].map((m) => m[1])
  expect(motifs.length).toBeGreaterThanOrEqual(7)
  expect(motifs).toContain('conge')
  expect(motifs).toContain('maladie')
  // le motif choisi est celui marqué actif
  expect((formulaire.match(/data-motif="conge" data-actif="oui"/g) || [])).toHaveLength(1)
})

it('6. la période : deux dates, six raccourcis, durée en direct', () => {
  expect(formulaire).toContain('data-testid="abs-form-debut"')
  expect(formulaire).toContain('data-testid="abs-form-fin"')
  expect((formulaire.match(/data-testid="abs-form-raccourci"/g) || [])).toHaveLength(6)
  expect(formulaire).toContain('data-testid="abs-form-jours"')
  // 19 → 23 octobre 2026 = 5 jours ouvrés
  expect(formulaire).toContain('>5</span>')
  expect(formulaire).toContain('5 jours calendaires')
})

it('7. les jours fériés de la période sont listés, avec la case à cocher', () => {
  const avecFeries = rendre({ feries: [{ date: '2026-10-20', nom: 'Fête de l’indépendance' }] })
  expect(avecFeries).toContain('1 jour férié dans cette période')
  expect(avecFeries).toContain('20/10/2026')
  expect(avecFeries).toContain('data-testid="abs-form-feries-decomptes"')
  expect(formulaire).not.toContain('data-testid="abs-form-feries-decomptes"')
})

it('8. un chevauchement est signalé avant l\'enregistrement', () => {
  const conflit = rendre({ chevauchement: { start_date: '2026-10-21', end_date: '2026-10-24' } })
  expect(conflit).toContain('data-testid="abs-form-chevauchement"')
  expect(conflit).toContain('Chevauchement détecté')
  expect(conflit).toContain('21/10/2026')
  expect(conflit).toContain('24/10/2026')
  // sans conflit, le formulaire rassure
  expect(formulaire).toContain('Rien à signaler')
})

it('9. le solde projeté prévient le dépassement de plafond', () => {
  const serain = rendre({ solde: { pris: 12, plafond: 30, restant: 18 } })
  expect(serain).toContain('18 j → 13 j')
  expect(serain).toContain('Reste 13 jours sur 30')

  const depasse = rendre({ solde: { pris: 28, plafond: 30, restant: 2 } })
  expect(depasse).toContain('2 j → -3 j')
  expect(depasse).toContain('Plafond dépassé de 3 jours')
  expect(depasse).not.toContain('Rien à signaler')
})

it('10. le statut se choisit en un clic', () => {
  expect((formulaire.match(/data-testid="abs-form-statut"/g) || [])).toHaveLength(3)
  expect(formulaire).toContain('data-statut="approuve" data-actif="oui"')
  expect(rendre({ valeurs: { ...valeurs, status: 'en_attente' } })).toContain('data-statut="en_attente" data-actif="oui"')
})

it('11. le justificatif : zone de dépôt, puis nom du fichier', () => {
  expect(formulaire).toContain('data-testid="abs-upload-zone"')
  expect(formulaire).toContain('PDF, JPG, PNG, WebP · 5 Mo maximum')

  const avecFichier = rendre({
    valeurs: { ...valeurs, document_file: { name: 'certificat.pdf', size: 245000, type: 'application/pdf' } },
  })
  expect(avecFichier).toContain('data-testid="abs-upload-fichier"')
  expect(avecFichier).toContain('certificat.pdf')
  expect(avecFichier).toContain('239 Ko')
})

it('12. les notes sont reprises telles quelles', () => {
  expect(formulaire).toContain('data-testid="abs-form-notes"')
  expect(formulaire).toContain('Certificat fourni')
})

it('13. au-delà de six employés, une recherche apparaît', () => {
  const grand = [
    ...employes,
    { id: 'e4', first_name: 'Ibrahim', last_name: 'Sow', matricule: 'ENN-0004' },
    { id: 'e5', first_name: 'Fatou', last_name: 'Ballo', matricule: 'ENN-0005' },
    { id: 'e6', first_name: 'Kofi', last_name: 'Mensah', matricule: 'ENN-0006' },
    { id: 'e7', first_name: 'Awa', last_name: 'Traoré', matricule: 'ENN-0007' },
  ]
  expect(formulaire).not.toContain('data-testid="abs-form-recherche"')
  expect(rendre({ employes: grand })).toContain('data-testid="abs-form-recherche"')
})

it('14. le bouton du pied pilote le formulaire, sans double envoi', () => {
  expect(formulaire).toContain('id="abs-formulaire-form"')
  expect(formulaire).toContain('form="abs-formulaire-form"')
  expect(formulaire).toContain('data-testid="abs-form-enregistrer"')
  expect((formulaire.match(/onClick=/g) || [])).not.toContain('onClick=') // rendu serveur : aucun gestionnaire
})

it('15. l\'enregistrement en cours grise le bouton', () => {
  const occupe = rendre({ uploading: true })
  expect(occupe).toContain('Enregistrement…')
  expect(occupe).toContain('disabled=""')
})
