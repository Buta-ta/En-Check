import { useLayoutEffect, useRef, useState } from 'react'
import { Check, X, Paperclip, Plus } from 'lucide-react'
import '../pages/AbsencesAfroTech.css'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'
import { compterJoursOuvres, isoLocal } from '../services/absencesCalendrier'
import { LE_FIL, largeurFiche, partagerEnRangs, periodeFiche, mesuresFiche } from '../services/absencesFil'

// ═══════════════════════════════════════════════════════════
// 🧺 LE FIL — l'onglet « Demandes employés », rendu comme du linge
//
// Maquette retenue `maquettes/absences-calendrier-D-fil.png` (8/12).
// Ce que la figure doit faire, en une phrase : une demande = une fiche
// pendue, et l'onglet cesse d'être une deuxième grille d'employés — c'est
// ce qui le distingue du Planning, dont il ne doit rien copier.
//
// Deux fils : ce qui attend, ce qui est jugé. Le temps court de gauche à
// droite, la fiche pend à un anneau qui mord la corde. La longueur du linge
// est la durée comptée ; le trait sous la fiche, ce qui, de cette durée,
// tombe un jour ouvré. Deux faits différents, pas le même compté deux fois.
//
// La géométrie se calcule dans `services/absencesFil.js`, pas ici. Les
// épaisseurs (corde, saut, anneau) sont posées dans la feuille de style, et
// `absencesFil.test.jsx` relit les deux côtés.
//
// Ce composant ne décide rien et n'écrit rien : approuver, refuser, voir la
// pièce jointe se font par les gestes que la page connaît déjà
// (`openReviewModal`, `handleViewRequestDocument`). Cliquer une fiche la
// DÉTACHE — c'est la page qui la garde en main et la rend en
// `DemandeCongeCard`, avec tous ses boutons.
// ═══════════════════════════════════════════════════════════

const statutDe = (d) => (d.status === 'approved' || d.status === 'approuve' ? 'approuve'
  : d.status === 'rejected' || d.status === 'refuse' ? 'refuse' : 'attente')

/** Une demande porte soit plusieurs pièces (documents), soit une seule. */
const piecesDe = (d) => (Array.isArray(d.documents) ? d.documents.filter(Boolean) : (d.document_url ? [d.document_url] : []))

const initialesDe = (d) => `${(d.employees?.first_name || '?')[0]}${(d.employees?.last_name || '?')[0]}`.toUpperCase()

/** La fiche qui pend : le bois, le rabat, le trait. Tout ce que la corde porte. */
function FichePendaison({ fiche: f, surChoisir }) {
  return (
    <article
      className="abs-fiche"
      data-testid="abs-fiche"
      data-statut={f.statut}
      data-conflict={f.conflit ? 'oui' : undefined}
      data-aujourdhui={f.commenceAujourdhui ? 'oui' : undefined}
      style={{
        // la longueur dessinée, en variable : la feuille la borne à 100 %, donc
        // un congé de trois semaines sature le fil d'un écran d'enfant au lieu
        // de le déborder — le linge se plie, il ne crève pas le mur
        '--abs-fiche-largeur': `${f.large}px`,
        // le trait = les jours ouvrés de la période. Zéro jour ouvré, zéro trait :
        // un plancher inventé mentirait sur la durée
        '--abs-fiche-trait': `${Math.round((f.ouvr / f.jours) * 100)}%`,
        '--abs-fiche-motif': f.couleur,
      }}
    >
      <button
        type="button"
        className="abs-fiche-corps"
        onClick={() => surChoisir(f.id)}
        title="détacher la fiche et la poser sur la table"
        aria-label={`${f.nom} — ${f.motifLabel} du ${f.periode} · ${f.comptes} jour${f.comptes > 1 ? 's' : ''} décompté${f.comptes > 1 ? 's' : ''} sur ${f.jours}${f.statut === 'attente' ? ' · à valider' : ''}`}
      >
        <span className="abs-fiche-entete">
          {f.photo ? (
            <img className="abs-fiche-visage" src={f.photo} alt="" width={30} height={30} />
          ) : (
            <span className="abs-fiche-visage" aria-hidden="true">{f.initiales}</span>
          )}
          <span className="abs-fiche-nom">{f.nom}</span>
        </span>
        <span className="abs-fiche-motif">
          <span aria-hidden="true">{f.emoji}</span> {f.motifLabel}
        </span>
        <span className="abs-fiche-date">
          {f.periode}
          <b>{f.comptes} j</b>
        </span>
        {f.commenceAujourdhui && (
          <span className="abs-fiche-mention">commence aujourd’hui</span>
        )}
        {f.conflit && (
          <span className="abs-fiche-conflit"><i aria-hidden="true" />conflit</span>
        )}
        {f.statut === 'refuse' && f.motifRefus && (
          <span className="abs-fiche-refus">refusée · {f.motifRefus}</span>
        )}
        <span className="abs-fiche-trait" aria-hidden="true" />
      </button>
      {f.statut === 'attente' && (
        <span className="abs-fiche-onglet" aria-hidden="true">attente</span>
      )}
    </article>
  )
}

/**
 * Le crochet resté au fil, à la place et de la largeur de ce qu'on a détaché.
 * Le fil ne se referme pas : ce qui est posé en bas sur la table garde sa place
 * en haut, et l'œil retrouve l'ordre des autres fiches en la remontant.
 */
function FicheCrochet({ fiche: f }) {
  return (
    <span
      className="abs-fiche abs-fiche-crochet"
      data-testid="abs-fiche-crochet"
      style={{ '--abs-fiche-largeur': `${f.large}px` }}
      title={`${f.nom} — la fiche est en main, posée sous le fil`}
    />
  )
}

export function AbsencesFil({
  demandes = [],
  conflitsParDemande = {},
  feriers = () => new Set(),
  soldes = [],
  enMain = null,
  filtre = 'all',
  surChoisir = () => {},
  surDeclarer,
  surApprouver = () => {},
  surRefuser = () => {},
  surDocument = () => {},
}) {
  const { motifPour } = useMotifsAbsence()
  const filRef = useRef(null)
  const [largeurCorde, setLargeurCorde] = useState(LE_FIL.cordeDefaut)

  // La corde se mesure, elle ne se devine pas : c'est la largeur du trait que
  // les rangs doivent remplir. `getBoundingClientRect`, comme le calendrier
  // des absences — pas d'Observateur de plus dans la page. `useLayoutEffect`
  // mesure avant la peinture : sinon le premier rendu part de `cordeDefaut`
  // et la rangée saute d'un cran sous les yeux.
  useLayoutEffect(() => {
    const noeud = filRef.current
    if (!noeud) return undefined
    const mesurer = () => {
      const largeur = noeud.getBoundingClientRect().width
      if (largeur > 240) setLargeurCorde(largeur)
    }
    mesurer()
    if (typeof window === 'undefined') return undefined
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [demandes.length])

  const aujourdhui = isoLocal(new Date())

  // Une fiche = une demande, augmentée de ce que le dessin réclame. Tout se
  // lit ici, une fois, et se relit dans les rangs comme dans les fiches.
  const fiches = demandes.map((d) => {
    const motif = motifPour(d) || {}
    const debut = String(d.start_date || '').slice(0, 10)
    const fin = String(d.end_date || '').slice(0, 10)
    const feriersDuJour = feriers(d.enterprise_id)
    // Les trois nombres viennent du service des durées, un appel chacun : la
    // période (aucun férié retiré), les ouvrés (les fériés de l'entreprise
    // retirés), et ce que la demande décompte. Le composant ne compte pas.
    const { span, ouvr, comptes } = mesuresFiche(d, {
      calendaires: compterJoursOuvres(debut, fin, new Set(), true),
      ouvres: compterJoursOuvres(debut, fin, feriersDuJour, false),
    })
    return {
      id: d.id,
      demande: d,
      jours: span,
      ouvr,
      motifLabel: motif.label || d.reason || 'Absence',
      emoji: motif.emoji || '📋',
      couleur: motif.color || 'var(--charte-douce)',
      statut: statutDe(d),
      large: largeurFiche(span),
      comptes,
      nom: `${d.employees?.first_name || ''} ${d.employees?.last_name || ''}`.trim() || 'Employé',
      initiales: initialesDe(d),
      photo: d.employees?.photo_url || null,
      periode: periodeFiche(debut, fin),
      pieces: piecesDe(d),
      commenceAujourdhui: debut === aujourdhui,
      motifRefus: d.review_comment || '',
      // le conflit se lit par la carte que la page a déjà indexée — une seule
      // porte d'entrée, jamais une recherche dans la liste en plus
      conflit: conflitsParDemande[d.id] || null,
      enMain: enMain === d.id,
    }
  })

  const fils = [
    { cle: 'attente', titre: 'À valider', cartes: fiches.filter((f) => f.statut === 'attente') },
    {
      cle: 'repondues',
      titre: 'Répondues',
      cartes: fiches.filter((f) => f.statut !== 'attente'),
      approuvees: fiches.filter((f) => f.statut === 'approuve').length,
      refusees: fiches.filter((f) => f.statut === 'refuse').length,
    },
  ].filter((f) => f.cartes.length)

  const totale = fiches.length
  const aValider = fiches.filter((f) => f.statut === 'attente').length
  // Le plus ancien en tête : l'ordre du travail, pas l'ordre du dépôt.
  const premiere = [...fiches]
    .filter((f) => f.statut === 'attente')
    .sort((a, b) => String(a.demande.created_at || '').localeCompare(String(b.demande.created_at || '')))[0] || null

  return (
    <section className="abs-fil" data-testid="abs-fil" aria-label="Les demandes, pendues au fil">
      <header className="abs-fil-bande">
        <p className="abs-fil-legende">
          <span>Une fiche pendue = une demande</span>
          <span aria-hidden="true">·</span>
          <span>la longueur du linge = la durée</span>
          <span className="abs-fil-chiffres">
            {totale} demande{totale > 1 ? 's' : ''}
            {aValider > 0 ? ` · ${aValider} à valider` : ''}
          </span>
        </p>
        {surDeclarer && (
          <button type="button" className="abs-fil-declarer" onClick={surDeclarer}>
            <Plus size={14} /> Déclarer
          </button>
        )}
      </header>

      {!fiches.length ? (
        // LE FIL SANS LINGE. Les mots sont ceux de la maison — « aucune demande »,
        // et la phrase qui dit où on en est — posés sur le trait tendu : le vide
        // se montre dans la langue du dessin, pas dans un panneau d'attente.
        <div className="abs-fil-vide" data-testid="abs-fil-vide">
          <p className="abs-fil-vide-titre">Aucune demande · rien sur le fil</p>
          <p className="abs-fil-vide-note">
            {filtre !== 'all'
              ? 'Aucune demande avec ce statut — les autres pendront au fil dès que le filtre sera levé'
              : 'Les employés n’ont pas encore soumis de demandes de congé'}
          </p>
        </div>
      ) : (
        <div className="abs-fil-corps">
          <div className="abs-fil-fils" ref={filRef}>
            {fils.map((fil) => (
              <div className="abs-fil-fil" data-fil={fil.cle} key={fil.cle}>
                <div className="abs-fil-tete">
                  <h3 className="abs-fil-titre">
                    {fil.titre}
                    <b>{fil.cartes.length}</b>
                    {enMain && fil.cartes.some((f) => f.id === enMain) && (
                      <span className="abs-fil-detail">1 en main</span>
                    )}
                    {fil.cle === 'repondues' && (
                      <span className="abs-fil-detail">
                        {fil.approuvees} approuvées{fil.refusees ? ` · ${fil.refusees} refusées` : ''}
                      </span>
                    )}
                  </h3>
                  {fil.cle === 'attente' && (
                    <div className="abs-fil-outils" role="group" aria-label="La pile, une fiche à la fois">
                      <button
                        type="button"
                        onClick={() => premiere && surApprouver(premiere.demande)}
                        disabled={!premiere}
                        title={premiere ? `Approuver ${premiere.nom} — la plus ancienne du fil` : 'Le fil est vide'}
                        aria-label={`Approuver la plus ancienne demande du fil (${fil.cartes.length})`}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => premiere && surRefuser(premiere.demande)}
                        disabled={!premiere}
                        title={premiere ? `Refuser ${premiere.nom} — la réponse se motive, une par une` : 'Le fil est vide'}
                        aria-label={`Refuser la plus ancienne demande du fil (${fil.cartes.length})`}
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => premiere && premiere.pieces.length && surDocument(premiere.demande)}
                        disabled={!premiere || !premiere.pieces.length}
                        title={premiere?.pieces.length ? `Pièce jointe de ${premiere.nom}` : 'Aucune pièce jointe sur la fiche en tête de file'}
                        aria-label={`Ouvrir la pièce jointe de la demande en tête (${premiere?.pieces.length || 0})`}
                      >
                        <Paperclip size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {partagerEnRangs(fil.cartes, largeurCorde).map((rang, i) => (
                  <div className="abs-fil-rang" data-rang={i} key={i}>
                    {rang.map((f) => (f.enMain
                      // LA FICHE EST DESCENDUE : il reste son crochet, à sa place
                      // et de sa largeur. Le fil ne se referme pas — ce qui est posé
                      // en bas sur la table garde sa place en haut, et l'œil retrouve
                      // l'ordre des autres fiches en la remontant.
                      ? <FicheCrochet key={f.id} fiche={f} />
                      : <FichePendaison key={f.id} fiche={f} surChoisir={surChoisir} />))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {soldes.length > 0 && (
            <aside className="abs-fil-solde" aria-label="Soldes de congés, du plus court au plus long">
              <h3>Solde</h3>
              <ul>
                {soldes.map((s) => (
                  <li key={s.id} data-court={s.court ? 'oui' : undefined}>
                    <span className="abs-fil-solde-initiales" aria-hidden="true">{s.initiales}</span>
                    <span className="abs-fil-solde-nombre">
                      <b>{s.restant}</b>/{s.plafond}
                    </span>
                    {s.court && <span className="abs-fil-solde-court">épuisé</span>}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}

      <footer className="abs-fil-captions" aria-hidden="true">
        <span>le fil tient le temps, de gauche à droite</span>
        <span>l’anneau mord la corde, jamais il ne la longe</span>
        <span>le trait sous la fiche = les jours ouvrés</span>
        <span>clic sur une fiche = elle se détache</span>
      </footer>
    </section>
  )
}

export default AbsencesFil
