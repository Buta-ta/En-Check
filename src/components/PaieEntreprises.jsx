// ═══════════════════════════════════════════════════════════
// 🏢 CONFIGURATION DES ENTREPRISES (vue super-administrateur)
//
// Un super-admin pilote plusieurs entreprises. Avant, rien ne lui
// disait lesquelles étaient configurées : il fallait en ouvrir une,
// aller sur la page fiscale et compter les lignes. Et recopier une
// configuration d'une entreprise à l'autre se faisait à la main.
//
// Deux réponses ici : l'état de chaque entreprise en un coup
// d'œil, et un bouton « Copier ici » qui annonce ce qu'il va
// remplacer avant de le faire.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Building2, Copy, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { palettePaie } from '../styles/paieTheme'
import { resumerConfigurations, copierConfigurationFiscale } from '../services/paieFiscale'
import RecapChargement from './PaieRecapChargement'
import { CarteGraphique } from './PaieGraphiques'

export default function PaieEntreprises({
  entreprises = [],
  entrepriseCouranteId = null,
  darkMode = true,
  onCopieEffectuee = () => {},
}) {
  const P = palettePaie(darkMode)
  const [resumes, setResumes] = useState(null)
  const [copieSource, setCopieSource] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const charger = async () => {
    const ids = (entreprises || []).map((e) => e.id).filter(Boolean)
    if (ids.length === 0) {
      setResumes({})
      return
    }
    setResumes(await resumerConfigurations(ids))
  }

  useEffect(() => {
    charger()
  }, [(entreprises || []).map((e) => e.id).join(','), entrepriseCouranteId])

  const confirmerCopie = async () => {
    if (!copieSource || !entrepriseCouranteId) return
    setEnCours(true)
    const resultat = await copierConfigurationFiscale(copieSource.id, entrepriseCouranteId)
    setEnCours(false)

    if (!resultat.success) {
      toast.error(resultat.error || 'Copie impossible')
      return
    }

    toast.success(
      `Configuration copiée : ${resultat.resume.cotisations} cotisation(s), ${resultat.resume.tranches} tranche(s)`,
    )
    setCopieSource(null)
    await charger()
    onCopieEffectuee()
  }

  const resumeCourant = (resumes || {})[entrepriseCouranteId] || { cotisations: 0, tranches: 0, regles: {} }
  const source = copieSource ? (resumes || {})[copieSource.id] : null

  return (
    <CarteGraphique
      titre="Configuration des entreprises"
      sousTitre="qui est configuré, et recopier une configuration"
      icone={{ couleur: '#B86B35' }}
      darkMode={darkMode}
      action={
        <button
          type="button"
          className="paie-btn"
          style={{ minHeight: 32, fontSize: 11 }}
          onClick={charger}
          title="Rafraîchir"
        >
          <RefreshCw size={13} />
        </button>
      }
    >
      <div data-testid="paie-entreprises" style={{ display: 'grid', gap: 8 }}>
        {!resumes && (
          <p style={{ margin: 0, fontSize: 11.5, color: P.texteFaint }}>Lecture des configurations…</p>
        )}

        {resumes &&
          (entreprises || []).map((e) => {
            const r = resumes[e.id] || { cotisations: 0, tranches: 0, configuree: false }
            const courante = e.id === entrepriseCouranteId
            return (
              <div
                key={e.id}
                data-testid={`paie-entreprise-${e.id}`}
                data-configuree={r.configuree ? 'oui' : 'non'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 11px',
                  borderRadius: 10,
                  border: `1px solid ${courante ? P.ambre7 : P.contour}`,
                  background: courante ? P.ambre2 : P.voile2,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: courante ? P.ambre : P.texteDoux }}>
                  <Building2 size={15} />
                </span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: P.texte }}>
                    {e.name}
                    {courante && (
                      <span style={{ marginLeft: 7, fontSize: 9.5, fontWeight: 800, color: P.ambre }}>
                        · entreprise ouverte
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: P.texteDoux }}>
                    {r.cotisations} cotisation{r.cotisations > 1 ? 's' : ''} · {r.tranches} tranche
                    {r.tranches > 1 ? 's' : ''}
                    {r.devise ? ` · ${r.devise}` : ' · devise non définie'}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: r.configuree ? P.vert1 : P.rouge1,
                    color: r.configuree ? P.vert : P.rouge,
                  }}
                >
                  {r.configuree ? 'Configurée' : 'À configurer'}
                </span>

                {!courante && (
                  <button
                    type="button"
                    className="paie-btn"
                    style={{ minHeight: 30, fontSize: 11 }}
                    disabled={!r.configuree}
                    title={r.configuree ? `Copier vers ${entreprises.find((x) => x.id === entrepriseCouranteId)?.name || 'l’entreprise ouverte'}` : 'Rien à copier'}
                    onClick={() => setCopieSource({ id: e.id, name: e.name })}
                  >
                    <Copy size={13} /> Copier ici
                  </button>
                )}
              </div>
            )
          })}
      </div>

      {copieSource && source && (
        <div
          data-testid="paie-copie-modale"
          style={{
            position: 'fixed',
            inset: 0,
            background: P.overlayFond,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: P.modal,
              border: `1px solid ${P.contour}`,
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span style={{ color: P.ambre }}>
                <AlertTriangle size={20} />
              </span>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: P.texte }}>
                Copier la configuration de {copieSource.name}
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: P.texteDoux }}>
              Les cotisations et les tranches de l’entreprise ouverte seront remplacées par celles de{' '}
              {copieSource.name}. Ses règles fiscales seront recopiées aussi.
            </p>

            <RecapChargement
              avant={resumeCourant}
              apres={source}
              nomApres={copieSource.name}
              titreColonne={`Depuis ${copieSource.name}`}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 14 }}>
              <button
                type="button"
                className="paie-btn"
                onClick={() => setCopieSource(null)}
                disabled={enCours}
              >
                Annuler
              </button>
              <button
                type="button"
                className="paie-btn paie-btn-principal"
                onClick={confirmerCopie}
                disabled={enCours}
              >
                {enCours ? <RefreshCw size={14} /> : <Check size={14} />} Copier
              </button>
            </div>
          </div>
        </div>
      )}
    </CarteGraphique>
  )
}
