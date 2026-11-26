// ═══════════════════════════════════════════════════════════
// 🎨 GESTIONNAIRE DE MOTIFS
//
// Créer, modifier et SUPPRIMER les motifs d'absence : libellé,
// emoji (le sien, celui du téléphone ou du clavier) et couleur.
//
// Règles validées :
//   • suppression RÉELLE, pas d'archivage
//   • si le motif est utilisé, on transfère d'abord ses absences
//     vers un autre motif — aucune absence ne perd ses couleurs
//   • le dernier motif ne peut pas être supprimé
//   • en vue « toutes entreprises », on consulte : la
//     personnalisation se fait entreprise par entreprise
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Plus, Pencil, Check, Trash2, Building2, Smile } from 'lucide-react'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'
import { EMOJIS_MOTIFS, PALETTE_MOTIFS, fondDepuisCouleur, nomDeCouleur } from '../constants/motifsAbsence'

const champsVides = { label: '', emoji: '📋', color: 'var(--abs-emerald)' }

/** Les motifs d'origine portent `id`, ceux de la base portent `code` */
const codeDe = (m) => m.code || m.id

/** UN emoji, pas un roman, et pas deux. `nettoyerEmoji('🎙️ Musique')` rendait
 * « 🎙️ » mais le libellé, lui, gardait l'emoji collé dans son nom — une tuile
 * « 📋 🎙️ Musique » (fondateur, 08/12 : un motif doublonné). Le champ emoji
 * segmente donc en graphèmes (un ZWJ reste UN signe) et le libellé est vidé de
 * ceux qui le précèdent : deux porteurs du même signe, c'est deux signes. */
const segmenteur = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null
const nettoyerEmoji = (valeur) => {
  const net = (valeur || '').trim()
  if (!net) return '📋'
  const signes = segmenteur ? [...segmenteur.segment(net)].map((g) => g.segment) : [...net]
  return signes[0]
}
const emojiDansLeLibellé = /\p{Extended_Pictographic}/u
const nettoyerLibellé = (valeur) =>
  (valeur || '').replace(emojiDansLeLibellé, '').replace(/\s+/g, ' ').trim()

export default function AbsencesMotifsManager({ absences = [] }) {
  const { motifs, toutesEntreprises, creer, modifier, supprimer } = useMotifsAbsence()
  const [brouillon, setBrouillon] = useState(null) // null | { rowId?, label, emoji, color }
  const [aSupprimer, setASupprimer] = useState(null) // motif dont on prépare la suppression
  const [codeCible, setCodeCible] = useState('') // motif qui récupère les absences
  const [enCours, setEnCours] = useState(false)

  const usages = useMemo(() => {
    const map = {}
    absences.forEach((a) => {
      const cle = a.reason || 'autre'
      map[cle] = (map[cle] || 0) + 1
    })
    return map
  }, [absences])

  const ouvrirCreation = () => {
    setBrouillon({ ...champsVides })
    setASupprimer(null)
  }
  const ouvrirEdition = (m) => {
    setBrouillon({ rowId: m.rowId, code: m.code, label: m.label, emoji: m.emoji, color: m.color })
    setASupprimer(null)
  }

  const enregistrer = async () => {
    // le libellé se nettoie UNE fois, avant le garde-fou : sinon on refuse un
    // motif dont le nom ne contenait qu'un emoji, et on écrit deux fois la même
    // correction (dans le brouillon et dans la sauvegarde)
    const libellé = nettoyerLibellé(brouillon?.label || '')
    if (!brouillon || !libellé) return
    setEnCours(true)
    try {
      if (brouillon.rowId) await modifier(brouillon.rowId, {
        label: libellé,
        emoji: brouillon.emoji,
        color: brouillon.color,
      })
      else await creer({ label: libellé, emoji: brouillon.emoji, color: brouillon.color })
      setBrouillon(null)
    } finally {
      setEnCours(false)
    }
  }

  const demanderSuppression = (m) => {
    setBrouillon(null)
    setASupprimer(m)
    // par défaut on propose le premier autre motif
    const autre = motifs.find((x) => codeDe(x) !== codeDe(m))
    setCodeCible(autre ? autre.code : '')
  }

  const confirmerSuppression = async () => {
    if (!aSupprimer) return
    const nbUsages = usages[aSupprimer.code] || 0
    setEnCours(true)
    try {
      await supprimer({
        rowId: aSupprimer.rowId,
        codeSource: codeDe(aSupprimer),
        codeCible: nbUsages > 0 ? codeCible : null,
      })
      setASupprimer(null)
      setCodeCible('')
    } finally {
      setEnCours(false)
    }
  }

  const dernierMotif = motifs.length <= 1
  const nbUsagesCible = aSupprimer ? (usages[aSupprimer.code] || 0) : 0

  /* Le gestionnaire ne peint PAS : il habille. Ses tuiles portent les classes de
   la pile de configuration (`AbsencesAfroTech.css`), donc les mêmes cotes que les
   planches du pli — 2 px de trait, 6 px de rayon, une seule couleur d'action — et
   le thème sombre se soigne tout seul, ce que quatre objets de style inline ne
   faisaient pas. La couleur du motif reste visible où elle est une DONNÉE : le
   pastille du glyphe, le nuancier et l'aperçu ; jamais en liseré de la tuile. */
  return (
    <div className="abs-config-carte abs-motifs-manager" data-testid="abs-motifs-manager">
      <header className="abs-motifs-tete">
        <div className="abs-motifs-tete-texte">
          <h3>Motifs d’absence</h3>
          <p className="abs-config-note">
            {motifs.length} motif{motifs.length > 1 ? 's' : ''} · ces motifs alimentent le calendrier, le dock et les filtres
          </p>
        </div>
        <button
          type="button"
          onClick={ouvrirCreation}
          disabled={toutesEntreprises}
          className="ch-btn-pleine abs-motifs-nouveau"
          data-testid="abs-motifs-nouveau"
          title={toutesEntreprises ? 'Sélectionnez une entreprise pour personnaliser' : 'Créer un motif'}
        >
          <Plus size={15} /> Nouveau motif
        </button>
      </header>

      {toutesEntreprises && (
        <p className="abs-motifs-avis">
          <Building2 size={14} aria-hidden="true" />
          <span>
            Vue « toutes entreprises » : les motifs affichés sont les motifs communs. Sélectionnez une entreprise
            pour les personnaliser et les supprimer.
          </span>
        </p>
      )}

      <div className="abs-motifs-pile">
        {motifs.map((m) => {
          const nb = usages[codeDe(m)] || 0
          return (
            <article key={m.code} className="abs-motifs-carte" data-testid="abs-motifs-carte" data-motif={codeDe(m)}>
              <span className="abs-motifs-glyphe" style={{ background: fondDepuisCouleur(m.color) }} aria-hidden="true">
                {m.emoji}
              </span>
              <div className="abs-motifs-texte">
                <p className="abs-motifs-nom" title={m.label}>
                  {m.label}
                </p>
                <p className="abs-motifs-detail">
                  {/* le NUANCIER montre la teinte, le texte la NOMME : écrit deux fois,
                      le hex se lit comme une erreur de saisie */}
                  <span className="abs-motifs-nuancier" style={{ background: m.color }} aria-hidden="true" />
                  <span className="abs-motifs-teinte">{nomDeCouleur(m.color)}</span>
                  <span className="abs-motifs-usage" data-vide={nb === 0 ? 'vrai' : 'faux'}>
                    {nb} absence{nb === 1 ? '' : 's'}
                  </span>
                </p>
              </div>
              <div className="abs-motifs-actions">
                <button
                  type="button"
                  onClick={() => ouvrirEdition(m)}
                  disabled={toutesEntreprises}
                  aria-label={`Modifier ${m.label}`}
                  className="abs-motifs-pince"
                  data-testid="abs-motifs-modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => demanderSuppression(m)}
                  disabled={toutesEntreprises || dernierMotif || enCours}
                  aria-label={`Supprimer ${m.label}`}
                  className="abs-motifs-pince"
                  data-testid="abs-motifs-supprimer"
                  title={dernierMotif ? 'Gardez au moins un motif' : 'Supprimer définitivement'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* ══ Formulaire création / édition ══ */}
      {brouillon && (
        <div className="abs-motifs-form" data-testid="abs-motifs-formulaire">
          <p className="abs-motifs-form-titre">{brouillon.rowId ? 'Modifier le motif' : 'Nouveau motif'}</p>

          <div className="abs-motifs-form-rang">
            <label className="abs-motifs-champ">
              <span className="abs-motifs-etiquette">Libellé</span>
              <input
                className="ch-champ-cadre"
                value={brouillon.label}
                onChange={(e) => setBrouillon({ ...brouillon, label: e.target.value })}
                placeholder="Congé payé, Télétravail…"
                data-testid="abs-motifs-libelle"
              />
            </label>

            <label className="abs-motifs-champ abs-motifs-champ--emoji">
              <span className="abs-motifs-etiquette">Emoji</span>
              <input
                className="ch-champ-cadre abs-motifs-emoji"
                value={brouillon.emoji}
                onChange={(e) => setBrouillon({ ...brouillon, emoji: nettoyerEmoji(e.target.value) })}
                placeholder="🎙️"
                title="Collez l'emoji de votre choix (clavier emoji du téléphone ou de l'ordinateur)"
                data-testid="abs-motifs-emoji-libre"
              />
            </label>
          </div>

          {/* Palette d'emojis : un raccourci, la saisie libre reste au-dessus */}
          <div className="abs-motifs-groupe">
            <p className="abs-motifs-etiquette">
              <Smile size={13} aria-hidden="true" /> Suggestions (vous pouvez coller n’importe quel emoji)
            </p>
            <div className="abs-motifs-palette">
              {EMOJIS_MOTIFS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setBrouillon({ ...brouillon, emoji: e })}
                  className="abs-motifs-suggestion"
                  data-choisi={brouillon.emoji === e ? 'vrai' : 'faux'}
                  aria-pressed={brouillon.emoji === e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="abs-motifs-groupe">
            <p className="abs-motifs-etiquette">Couleur</p>
            <div className="abs-motifs-palette">
              {PALETTE_MOTIFS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBrouillon({ ...brouillon, color: c })}
                  aria-label={`Couleur ${c}`}
                  aria-pressed={brouillon.color === c}
                  className="abs-motifs-couleur"
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={brouillon.color}
                onChange={(e) => setBrouillon({ ...brouillon, color: e.target.value.toUpperCase() })}
                aria-label="Couleur personnalisée"
                className="abs-motifs-couleur-libre"
              />
            </div>
          </div>

          {/* L'aperçu peint la couleur qu'il annonce : c'est le seul endroit du
              formulaire où le hex doit se VOIR, sinon on règle à l'aveugle. */}
          <p className="abs-motifs-apercu">
            <span>Aperçu</span>
            <span className="abs-motifs-apercu-puce" style={{ background: fondDepuisCouleur(brouillon.color), borderColor: brouillon.color, color: brouillon.color }}>
              {brouillon.emoji} {brouillon.label || 'Mon motif'}
            </span>
          </p>

          <div className="abs-motifs-pied">
            <button type="button" onClick={() => setBrouillon(null)} className="ch-btn-contour">
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={!nettoyerLibellé(brouillon.label) || enCours}
              className="ch-btn-pleine"
              data-testid="abs-motifs-enregistrer"
            >
              <Check size={15} /> {brouillon.rowId ? 'Enregistrer' : 'Créer le motif'}
            </button>
          </div>
        </div>
      )}

      {/* ══ Suppression : transfert des absences si besoin ══ */}
      {aSupprimer && (
        <div className="abs-motifs-danger" data-testid="abs-motifs-suppression">
          <p className="abs-motifs-danger-titre">Supprimer « {aSupprimer.emoji} {aSupprimer.label} » ?</p>
          <p className="abs-config-note">
            {nbUsagesCible === 0
              ? 'Ce motif n’est utilisé par aucune absence. La suppression est définitive.'
              : `${nbUsagesCible} absence${nbUsagesCible > 1 ? 's' : ''} utilisent ce motif. Choisissez où les transférer : elles garderont leurs dates, seul le motif change.`}
          </p>

          {nbUsagesCible > 0 && (
            <label className="abs-motifs-champ abs-motifs-danger-cible">
              <span className="abs-motifs-etiquette">Transférer vers</span>
              <select
                className="ch-champ-cadre"
                value={codeCible}
                onChange={(e) => setCodeCible(e.target.value)}
                data-testid="abs-motifs-transfert"
              >
                {motifs.filter((m) => codeDe(m) !== codeDe(aSupprimer)).map((m) => (
                  <option key={codeDe(m)} value={codeDe(m)}>{m.emoji} {m.label}</option>
                ))}
              </select>
            </label>
          )}

          <div className="abs-motifs-pied">
            <button type="button" onClick={() => { setASupprimer(null); setCodeCible('') }} className="ch-btn-contour">
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmerSuppression}
              disabled={enCours || (nbUsagesCible > 0 && !codeCible)}
              className="ch-btn-pleine ch-btn-danger"
              data-testid="abs-motifs-confirmer-suppression"
            >
              <Trash2 size={15} /> Supprimer définitivement
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
