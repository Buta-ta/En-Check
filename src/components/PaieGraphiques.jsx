// ═══════════════════════════════════════════════════════════
// 📊 GRAPHIQUES DE LA PAGE PAIE
//
// Dessinés à la main en SVG : le projet n'embarque aucune
// librairie de graphiques, et trois courbes ne valent pas une
// dépendance de plus. La géométrie est sortie dans des fonctions
// pures (testables), les composants ne font que tracer.
// ═══════════════════════════════════════════════════════════

import { BogolanPastilleSvg } from './BogolanMudclothSvg'

/** Normalise une série en points SVG « x,y x,y … » */
export function pointsSparkline(valeurs, largeur = 72, hauteur = 24) {
  if (!Array.isArray(valeurs) || valeurs.length === 0) return ''
  const nums = valeurs.map((v) => Number(v) || 0)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const etendue = max - min || 1
  const pas = nums.length > 1 ? largeur / (nums.length - 1) : 0

  return nums
    .map((v, i) => {
      const x = i * pas
      const y = hauteur - ((v - min) / etendue) * (hauteur - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Découpe un donut : longueurs et décalages de chaque part */
export function secteursDonut(parts, rayon = 42) {
  const valeurs = (parts || []).map((p) => Math.max(0, Number(p?.valeur) || 0))
  const total = valeurs.reduce((s, v) => s + v, 0)
  const circonference = 2 * Math.PI * rayon
  let decalage = 0

  const tranches = (parts || []).map((p, i) => {
    const part = total > 0 ? valeurs[i] / total : 0
    const secteur = {
      libelle: p?.libelle || '',
      couleur: p?.couleur || '#B86B35',
      valeur: valeurs[i],
      part,
      longueur: part * circonference,
      decalage: -decalage,
    }
    decalage += part * circonference
    return secteur
  })

  return { rayon, circonference, total, tranches }
}

/** Hauteur relative de chaque barre (0 → 1) par rapport à la plus haute */
export function hauteursBarres(valeurs) {
  const nums = (valeurs || []).map((v) => Math.max(0, Number(v) || 0))
  const max = Math.max(...nums, 0)
  return nums.map((v) => (max > 0 ? v / max : 0))
}

// ── Une micro-courbe pour les cartes KPI ─────────────────────────────
export function Sparkline({ valeurs = [], couleur = '#26734D', largeur = 72, hauteur = 24, titre }) {
  const points = pointsSparkline(valeurs, largeur, hauteur)
  if (!points) return null

  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden={!titre} role={titre ? 'img' : undefined} data-testid="paie-sparkline">
      {titre ? <title>{titre}</title> : null}
      <polyline
        points={points}
        fill="none"
        stroke={couleur}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Le barème d'imposition, tranche par tranche ──────────────────────
export function BarresTranches({ tranches = [], darkMode = true }) {
  const actives = (tranches || []).filter((t) => t && t.is_active !== false)
  if (actives.length === 0) {
    return (
      <p style={{ fontSize: 11.5, color: darkMode ? 'rgba(245,242,235,0.45)' : '#7D6A58', margin: 0 }}>
        Aucune tranche à représenter.
      </p>
    )
  }

  const taux = actives.map((t) => Number(t.tax_rate) || 0)
  const hauteurs = hauteursBarres(taux)
  const maxTaux = Math.max(...taux, 0)
  const grisTexte = darkMode ? 'rgba(245,242,235,0.45)' : '#7D6A58'
  const grille = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(93,66,39,0.12)'

  return (
    <div data-testid="paie-barres-tranches">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 104 }}>
        {actives.map((t, i) => {
          const tauxTranche = taux[i]
          const dernier = i === actives.length - 1
          return (
            <div key={t.id || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: dernier ? '#F59E0B' : grisTexte }}>
                {tauxTranche} %
              </span>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(6, hauteurs[i] * 72)}px`,
                  borderRadius: '6px 6px 2px 2px',
                  background: dernier
                    ? 'linear-gradient(180deg, #F0A86E, #D9884A)'
                    : 'linear-gradient(180deg, #B86B35, rgba(184,107,53,0.55))',
                }}
                title={`${t.bracket_name || `Tranche ${i + 1}`} — ${tauxTranche} %`}
              />
              <span style={{ fontSize: 9.5, color: grisTexte, whiteSpace: 'nowrap' }}>
                {(Number(t.min_amount) || 0).toLocaleString('fr-FR')}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ borderTop: `1px solid ${grille}`, marginTop: 4, paddingTop: 4, fontSize: 10, color: grisTexte }}>
        Seuil bas de chaque tranche, en devise locale · taux marginal le plus haut : {maxTaux} %
      </div>
    </div>
  )
}

// ── Répartition en anneau (part salariale / part patronale…) ─────────
export function DonutParts({ parts = [], darkMode = true, centre, sousCentre }) {
  const { rayon, circonference, tranches, total } = secteursDonut(parts, 42)
  const grisTexte = darkMode ? 'rgba(245,242,235,0.62)' : '#4E3D2E'
  const piste = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(93,66,39,0.10)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} data-testid="paie-donut">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width="108" height="108" viewBox="0 0 108 108" role="img" aria-label="Répartition">
          <g transform="rotate(-90 54 54)">
            <circle cx="54" cy="54" r={rayon} fill="none" stroke={piste} strokeWidth="14" />
            {tranches.map((t, i) => (
              <circle
                key={i}
                cx="54"
                cy="54"
                r={rayon}
                fill="none"
                stroke={t.couleur}
                strokeWidth="14"
                strokeDasharray={`${t.longueur} ${circonference - t.longueur}`}
                strokeDashoffset={t.decalage}
                strokeLinecap="butt"
              />
            ))}
          </g>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          <strong style={{ fontSize: 17, fontWeight: 800, color: darkMode ? '#F5F2EB' : '#231911' }}>{centre}</strong>
          {sousCentre && <span style={{ fontSize: 9.5, color: grisTexte }}>{sousCentre}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 132 }}>
        {tranches.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: t.couleur, flexShrink: 0 }} />
            <span style={{ color: grisTexte, flex: 1 }}>{t.libelle}</span>
            <strong style={{ color: darkMode ? '#F5F2EB' : '#231911' }}>
              {total > 0 ? `${Math.round(t.part * 100)} %` : '—'}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Carte prête à poser : titre, icône bogolan et contenu */
export function CarteGraphique({ titre, sousTitre, icone, darkMode = true, children, action }) {
  const fond = darkMode ? '#1D1713' : '#FFFFFF'
  const bord = darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(93,66,39,0.18)'
  const texte = darkMode ? '#F5F2EB' : '#231911'

  return (
    <section
      className="paie-carte"
      style={{
        background: fond, border: `1px solid ${bord}`, borderRadius: 14,
        padding: 16, boxShadow: darkMode ? '0 18px 46px rgba(0,0,0,0.42)' : '0 14px 36px rgba(93,66,39,0.12)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {icone && <BogolanPastilleSvg size={30} couleur={icone.couleur || '#B86B35'} />}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: texte }}>{titre}</h3>
            {sousTitre && (
              <p style={{ margin: '2px 0 0', fontSize: 10.5, color: darkMode ? 'rgba(245,242,235,0.45)' : '#7D6A58' }}>
                {sousTitre}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
