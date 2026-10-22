// ═══════════════════════════════════════════════════════════
// 📋 RÉCAPITULATIF AVANT / APRÈS
//
// « Charger la configuration du pays » EFFACE les cotisations et
// les tranches propres à l'entreprise. Le message de confirmation
// le disait en une phrase ; on montre maintenant les chiffres : ce
// qui existe aujourd'hui, et ce qui le remplacera. Une entreprise
// qui a passé une matinée à saisir ses six cotisations doit le
// voir AVANT de cliquer.
//
// Le même récapitulatif sert à la copie de configuration entre
// entreprises : ce qui change, c'est seulement la provenance.
// ═══════════════════════════════════════════════════════════

import { useTheme } from '../contexts/ThemeContext'
import { palettePaie } from '../styles/paieTheme'

export function resumerReglesFiscales(regles = {}) {
  const abattement =
    regles.abattement_type === 'percentage' ? `Abattement ${regles.abattement_percent || 0} %`
      : regles.abattement_type === 'fixed' ? 'Abattement forfaitaire'
      : 'Pas d’abattement'

  const methode =
    regles.tax_calculation_method === 'fixed' ? 'Impôt au forfait'
      : regles.tax_calculation_method === 'flat' ? 'Taux unique'
      : 'Barème progressif'

  const famille = regles.situation_famille?.type && regles.situation_famille.type !== 'aucun'
    ? 'Quotient familial activé'
    : 'Quotient familial inactif'

  return [abattement, methode, famille]
}

export default function RecapChargement({ avant, apres, nomApres = 'pays', titreColonne = 'Après chargement' }) {
  const { darkMode } = useTheme()
  const P = palettePaie(darkMode)

  const lignes = [
    { libelle: 'Cotisations', avant: avant.cotisations, apres: apres.cotisations },
    { libelle: 'Tranches d’imposition', avant: avant.tranches, apres: apres.tranches },
  ]

  const cellule = {
    padding: '7px 10px',
    fontSize: 11.5,
    borderBottom: `1px solid ${P.contour}`,
  }

  return (
    <div
      data-testid="paie-recap-chargement"
      style={{
        border: `1px solid ${P.contour}`,
        borderRadius: 10,
        background: P.voile2,
        padding: '10px 12px',
        marginTop: 12,
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: P.texteDoux }}>
        Ce qui va changer
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', color: P.texte }}>
        <thead>
          <tr>
            <th style={{ ...cellule, textAlign: 'left', color: P.texteFaint, fontWeight: 700 }} />
            <th style={{ ...cellule, textAlign: 'right', color: P.texteFaint, fontWeight: 700 }}>Aujourd’hui</th>
            <th style={{ ...cellule, textAlign: 'right', color: P.ambre, fontWeight: 800 }}>{titreColonne}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.libelle}>
              <td style={{ ...cellule, color: P.texteDoux }}>{l.libelle}</td>
              <td style={{ ...cellule, textAlign: 'right', fontWeight: 700 }}>{l.avant}</td>
              <td style={{ ...cellule, textAlign: 'right', fontWeight: 800, color: P.ambre }}>{l.apres}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: P.texteFaint, textTransform: 'uppercase' }}>
            Règles actuelles
          </p>
          {resumerReglesFiscales(avant.regles).map((t) => (
            <p key={t} style={{ margin: '2px 0', fontSize: 11, color: P.texteDoux }}>· {t}</p>
          ))}
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: P.ambre, textTransform: 'uppercase' }}>
            Règles de {nomApres}
          </p>
          {resumerReglesFiscales(apres.regles).map((t) => (
            <p key={t} style={{ margin: '2px 0', fontSize: 11, color: P.texteDoux }}>· {t}</p>
          ))}
        </div>
      </div>

      {(avant.cotisations > 0 || avant.tranches > 0) && (
        <p style={{ margin: '10px 0 0', fontSize: 11, color: P.rouge, fontWeight: 700 }}>
          ⚠️ {avant.cotisations} cotisation(s) et {avant.tranches} tranche(s) propres à l’entreprise
          seront définitivement remplacées.
        </p>
      )}
    </div>
  )
}
