// ═══════════════════════════════════════════════════════════
// Console kente — carte Santé RH + heatmap des heures de pointage
// ═══════════════════════════════════════════════════════════
import { BrainCircuit } from 'lucide-react'
import { JOURS_SEMAINE, couleurCellule } from './kenteUtils'

export default function KenteSanteHeatmap({ sante, santeNote, heatmap, maxHeat, prevision }) {
  return (
    <>
        <article className="dk-carte">
          <div className="dk-carte-kente" aria-hidden="true" />
          <h3 className="dk-carte-titre">Santé RH</h3>
          <div className="dk-sante">
            <div className="dk-sante-score">
              <div>
                <span className="dk-sante-nom">Assiduité</span>
                <strong>{sante ? sante.assiduite : '—'}</strong>
              </div>
              <div>
                <span className="dk-sante-nom">Régularité</span>
                <strong>{sante ? sante.regularite : '—'}</strong>
              </div>
            </div>
            <div className="dk-sante-barres">
              <div className="dk-sante-barre">
                <span style={{ width: `${Math.min(100, sante?.assiduite || 0)}%` }} />
              </div>
              <div className="dk-sante-barre dk-sante-barre--or">
                <span style={{ width: `${Math.min(100, sante?.regularite || 0)}%` }} />
              </div>
            </div>
            {santeNote && (
              <p className="dk-note-ia">
                <BrainCircuit size={14} />
                {santeNote}
              </p>
            )}
          </div>
        </article>

        <article className="dk-carte dk-carte-heatmap">
          <div className="dk-carte-kente" aria-hidden="true" />
          <h3 className="dk-carte-titre">Présence par jour et heure</h3>
          <div className="dk-heatmap" role="img" aria-label="Heatmap des pointages par jour de semaine et heure">
            {Array.isArray(heatmap) &&
              heatmap.map((ligne, j) => (
                <div className="dk-heatmap-ligne" key={j}>
                  <span className="dk-heatmap-label">{JOURS_SEMAINE[j]}</span>
                  <div className="dk-heatmap-cellules">
                    {ligne.map((v, h) => (
                      <span
                        key={h}
                        className="dk-heatmap-cellule"
                        title={`${JOURS_SEMAINE[j]} ${h} h — ${v} pointage${v > 1 ? 's' : ''}`}
                        style={{ background: couleurCellule(v, maxHeat) }}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="dk-heatmap-legende">
            <span className="dk-heatmap-chevrons" aria-hidden="true">
              <i style={{ background: 'rgba(201, 169, 97, 0.07)' }} />
              <i style={{ background: 'rgba(192, 90, 43, 0.30)' }} />
              <i style={{ background: 'rgba(192, 90, 43, 0.55)' }} />
              <i style={{ background: 'rgba(214, 118, 60, 0.82)' }} />
              <i style={{ background: '#eba35c' }} />
            </span>
            <span>moins → plus de pointages</span>
          </div>
          {prevision && (
            <p className="dk-note-ia">
              <BrainCircuit size={14} />
              {prevision}
            </p>
          )}
        </article>
    </>
  )
}
