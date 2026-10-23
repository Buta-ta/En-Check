// ═══════════════════════════════════════════════════════════
// 📈 CARTES KPI DE LA PAGE PAIE
//
// Même gabarit compact que les cartes de la page Absences : une
// seule ligne, quatre tuiles, chacune avec son chiffre et un
// rappel utile. Les chiffres sortent tous de la configuration
// fiscale déjà chargée — rien n'est inventé.
// ═══════════════════════════════════════════════════════════

import { Shield, Percent, Wallet, Building2 } from 'lucide-react'
import { BogolanPastilleSvg } from './BogolanMudclothSvg'
import { Sparkline } from './PaieGraphiques'

/** Somme des taux (en %) des cotisations en pourcentage */
export function totauxCotisations(contributions = []) {
  const enPourcentage = (contributions || []).filter(
    (c) => c && c.is_active !== false && c.calculation_method !== 'fixed'
  )
  const somme = (cle) =>
    enPourcentage.reduce((total, c) => {
      const side = cle === 'rate_employee' ? 'employee' : 'employer'
      return total + (!c.paid_by || c.paid_by === side || c.paid_by === 'both' ? Number(c[cle]) || 0 : 0)
    }, 0)

  return {
    salarial: somme('rate_employee'),
    patronal: somme('rate_employer'),
    nbActives: enPourcentage.length,
    nbTotal: (contributions || []).filter((c) => c && c.is_active !== false).length,
  }
}

/** Les taux du barème, dans l'ordre, pour la micro-courbe */
export function tauxParTranche(tranches = []) {
  return (tranches || [])
    .filter((t) => t && t.is_active !== false)
    .sort((a, b) => (Number(a.bracket_order) || 0) - (Number(b.bracket_order) || 0))
    .map((t) => Number(t.tax_rate) || 0)
}

function Jauge({ valeur, max, couleur, piste }) {
  const pct = max > 0 ? Math.min(100, (valeur / max) * 100) : 0
  return (
    <div style={{ height: 4, borderRadius: 999, background: piste, overflow: 'hidden', marginTop: 6 }} data-testid="paie-jauge">
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: couleur }} />
    </div>
  )
}

function Carte({ testId, icone, couleur, libelle, valeur, suffixe, precision, darkMode, children }) {
  const Icone = icone
  const fond = darkMode ? 'rgba(29,23,19,0.82)' : '#FFFFFF'
  const bord = darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(93,66,39,0.18)'
  const texte = darkMode ? '#F5F2EB' : '#231911'
  const texteDoux = darkMode ? 'rgba(245,242,235,0.62)' : '#4E3D2E'

  return (
    <div
      data-testid={testId}
      className="paie-kpi"
      style={{
        background: fond, border: `1px solid ${bord}`, borderRadius: 12,
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
        minWidth: 0, boxShadow: darkMode ? 'none' : '0 6px 18px rgba(93,66,39,0.08)',
      }}
    >
      <BogolanPastilleSvg size={32} couleur={couleur} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: texteDoux, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {libelle}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 1 }}>
          <strong style={{ fontSize: 19, fontWeight: 800, color: texte, lineHeight: 1.05 }}>{valeur}</strong>
          {suffixe && <span style={{ fontSize: 10.5, fontWeight: 700, color: texteDoux }}>{suffixe}</span>}
        </div>
        <div style={{ fontSize: 12, color: texteDoux, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {precision}
        </div>
        {children}
      </div>
      <span style={{ color: couleur, opacity: 0.7, flexShrink: 0 }}>
        <Icone size={16} />
      </span>
    </div>
  )
}

export default function PaieKpiCards({ contributions = [], tranches = [], darkMode = true }) {
  const totaux = totauxCotisations(contributions)
  const taux = tauxParTranche(tranches)
  const tauxMax = taux.length ? Math.max(...taux) : 0
  const piste = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(93,66,39,0.10)'
  const maxJauge = Math.max(totaux.salarial, totaux.patronal, 1)

  return (
    <div
      className="paie-kpi-rangee"
      data-testid="paie-kpi"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))',
        gap: 10,
      }}
    >
      <Carte
        testId="paie-kpi-cotisations"
        icone={Shield}
        couleur="#26734D"
        libelle="Cotisations"
        valeur={totaux.nbTotal}
        precision={`${totaux.nbActives} à taux nominal`}
        darkMode={darkMode}
      />

      <Carte
        testId="paie-kpi-tranches"
        icone={Percent}
        couleur="#9C5321"
        libelle="Tranches d’imposition"
        valeur={taux.length}
        suffixe={tauxMax ? `jusqu’à ${tauxMax} %` : ''}
        precision={taux.length ? 'barème progressif' : 'aucune tranche définie'}
        darkMode={darkMode}
      >
        {taux.length > 1 && (
          <div style={{ marginTop: 4 }}>
            <Sparkline valeurs={taux} couleur="#9C5321" largeur={110} hauteur={18} titre="Taux par tranche" />
          </div>
        )}
      </Carte>

      <Carte
        testId="paie-kpi-salarial"
        icone={Wallet}
        couleur="#B86B35"
        libelle="Part salariale"
        valeur={totaux.salarial.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
        suffixe="%"
        precision="taux nominaux, hors plafonds"
        darkMode={darkMode}
      >
        <Jauge valeur={totaux.salarial} max={maxJauge} couleur="#B86B35" piste={piste} />
      </Carte>

      <Carte
        testId="paie-kpi-patronal"
        icone={Building2}
        couleur="#6D28D9"
        libelle="Part patronale"
        valeur={totaux.patronal.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
        suffixe="%"
        precision="taux nominaux, hors forfaits"
        darkMode={darkMode}
      >
        <Jauge valeur={totaux.patronal} max={maxJauge} couleur="#6D28D9" piste={piste} />
      </Carte>
    </div>
  )
}
