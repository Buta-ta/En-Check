// ═══════════════════════════════════════════════════════════════════════════
// 🕒 SECTION « MES PAUSES » — espace employé
//
// Ce que l'employé voit de ses pauses : quand, combien de temps, et si elle
// est encore en cours. Pas la cause de la fermeture — décision du fondateur.
//
// Elle est volontairement discrète : elle se glisse sous les heures
// supplémentaires sans changer la page. Si elle échoue à charger, elle
// n'affiche rien et ne casse pas l'écran.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { Coffee, Clock } from 'lucide-react'
import {
  chargerMesPauses,
  presenterMesPauses,
  totalMinutes,
  dureeLisible,
} from '../../services/mesPausesService'

const S = {
  section: {
    marginTop: '28px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '18px 20px',
  },
  entete: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  titre: {
    color: '#FFF',
    fontSize: '16px',
    fontWeight: 700,
    margin: 0,
  },
  sousTitre: {
    color: '#8B8B8B',
    fontSize: '13px',
    margin: '0 0 14px 0',
  },
  ligne: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  gauche: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  jour: { color: '#E5E5E5', fontSize: '14px', fontWeight: 600 },
  horaire: { color: '#7C7C7C', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' },
  droite: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  duree: { color: '#E5E5E5', fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  badge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '999px',
    background: 'rgba(245,158,11,0.14)',
    color: '#F59E0B',
    whiteSpace: 'nowrap',
  },
  note: { color: '#666', fontSize: '12.5px', marginTop: '12px' },
  vide: { color: '#7C7C7C', fontSize: '13.5px', margin: 0 },
}

function formaterJour (iso) {
  if (!iso) return '—'
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  } catch {
    return iso
  }
}

export default function MesPausesSection ({ fuseau }) {
  const [lignes, setLignes] = useState([])
  const [charge, setCharge] = useState(false)

  useEffect(() => {
    let vivant = true
    chargerMesPauses().then(({ pauses }) => {
      if (!vivant) return
      setLignes(presenterMesPauses(pauses, { fuseau }))
      setCharge(true)
    })
    return () => { vivant = false }
  }, [fuseau])

  //  Rien tant qu'on n'a pas de quoi parler : pas de cadre vide, pas de
  //  « chargement… » qui clignote sous une page déjà chargée.
  if (!charge || lignes.length === 0) return null

  const total = totalMinutes(lignes.map((l) => ({ ...l, ouverte: l.ouverte })))
  const enCours = lignes.filter((l) => l.ouverte).length

  return (
    <section style={S.section} aria-label="Mes pauses">
      <div style={S.entete}>
        <Coffee size={18} color="#F59E0B" />
        <h2 style={S.titre}>Mes pauses</h2>
      </div>
      <p style={S.sousTitre}>
        {lignes.length} pause{lignes.length > 1 ? 's' : ''} enregistrée{lignes.length > 1 ? 's' : ''}
        {total > 0 ? ` · ${dureeLisible(total)} au total` : ''}
        {enCours > 0 ? ` · ${enCours} en cours` : ''}
      </p>

      {lignes.map((l) => (
        <div key={l.id} style={S.ligne}>
          <div style={S.gauche}>
            <span style={S.jour}>{formaterJour(l.jour)}</span>
            <span style={S.horaire}>
              {l.debut}
              {l.ouverte ? ' → en cours' : l.fin ? ` → ${l.fin}` : ''}
            </span>
          </div>
          <div style={S.droite}>
            {l.anomalie && <span style={S.badge}>{l.anomalie}</span>}
            {l.duree ? (
              <span style={S.duree}>{l.duree}</span>
            ) : (
              <Clock size={14} color="#F59E0B" />
            )}
          </div>
        </div>
      ))}

      <p style={S.note}>
        Les pauses sont enregistrées par la borne ou la tablette de pointage.
        Une correction se demande à votre administration.
      </p>
    </section>
  )
}
