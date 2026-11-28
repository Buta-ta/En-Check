// src/components/ReglesTempsTravail.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 👤 RÈGLES DE TEMPS DE TRAVAIL D'UNE PERSONNE — une bande, et une modale
//
// Maquette retenue le 24/11/2026 : `maquettes/choix-g5-fiche-modale.png`.
// Le fondateur a dit : « ce bloc est trop imposant en haut de la fiche employé,
// il faut utiliser des modales ». La page ne porte donc plus qu'UNE BANDE de
// 52 px — le titre, le compte, et le geste. Le reste vit dans la modale.
//
// CE QUE LA MODALE DIT, ET NE DIT PAS
//   · dit, pour chaque clé : la valeur, son ORIGINE, sa date d'effet, et si
//     elle est verrouillée — en mots, jamais par la couleur seule (C7) ;
//   · dit « non configuré » et « contrôle indisponible » quand il n'y a rien :
//     jamais « 0 h », jamais une coche verte ;
//   · ne dit jamais « légal » : ce sont des paramètres d'entreprise ;
//   · affiche l'APERÇU D'IMPACT avant d'écrire, et bloque si le verrou s'y
//     oppose — le refus se voit avant, pas après l'erreur ;
//   · n'invente aucun auteur : faute de nom, on donne la date, pas un nom.
//
// ⚠️ L'écriture n'est jamais directe : tout passe par les RPC, qui contrôlent
//    l'accès, les bornes et le verrou. Ce composant ne fait que parler.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Lock, X } from 'lucide-react'
import * as Regles from '../services/reglesTempsTravail'
import {
  CLES_REGLAGES,
  apercuReglagePersonnel,
  dateEffetCourte,
  etatReglage,
  formaterValeurHeures,
  libelleEtat,
  phraseImpact,
  retourPossible,
} from '../lib/reglesPersonnelles'
import { dateEffetAuLundi } from '../services/seuilsHebdoParSemaine'
import './ReglesTempsTravail.css'

//  ⚠️ `AUJOURDHUI()` (date UTC) a été RETIRÉE : voir la décision B0-a.

function jourDuTexte(horodatage) {
  if (!horodatage) return null
  const d = new Date(horodatage)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function compterPersonnels(reglages) {
  return reglages.filter((r) => r.etat === 'personnelle' || r.etat === 'personnelle_verrouillee').length
}

export default function ReglesTempsTravail({
  entrepriseId,
  employeId,
  nomEmploye = '',
  superAdmin = false,
  //  Le fuseau de l'ENTREPRISE, obligatoire pour calculer une date d'effet.
  //  Absent : la date est REFUSÉE, jamais remplacée par la date UTC du jour.
  fuseau = null,
}) {
  const navigate = useNavigate()
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [reglages, setReglages] = useState([])
  const [informations, setInformations] = useState([])
  const [infosErreur, setInfosErreur] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [selection, setSelection] = useState(null)
  const [saisie, setSaisie] = useState({ valeur: '', dateEffet: null, verrouille: false })
  const [confirmationRetour, setConfirmationRetour] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState('')

  //  ── DATE D'EFFET, DÉCISION B0-a ─────────────────────────────
  //  Le lundi où le réglage commence à gouverner, à 04:00 dans le fuseau de
  //  l'entreprise. `null` si le fuseau manque ou est inconnu : dans ce cas
  //  l'enregistrement est REFUSÉ, et le motif est dit.
  //  ⚠️ Cette fonction ne fait AUCUN setState : elle est appelée pendant le
  //  rendu (sous-titre). Un setState ici provoquerait une boucle de rendus.
  //  Elle rend la date et le motif de refus, l'appelant décide quoi en faire.
  const calculerDateEffet = useCallback(() => {
    try {
      return { date: dateEffetAuLundi(new Date(), fuseau), refus: '' }
    } catch (e) {
      return { date: null, refus: e?.message || 'La date d’effet ne peut pas être calculée.' }
    }
  }, [fuseau])

  const { date: dateEffetAujourdhui, refus: refusDateEffet } = calculerDateEffet()

  const boutonFermer = useRef(null)
  const panneau = useRef(null)

  const charger = useCallback(async () => {
    if (!entrepriseId || !employeId) return
    setChargement(true)
    setErreur('')
    try {
      const resolutions = await Promise.all(
        CLES_REGLAGES.map((r) => Regles.resoudre({ entrepriseId, employeId, cle: r.cle })),
      )
      setReglages(
        CLES_REGLAGES.map((r, i) => ({
          ...r,
          resolution: resolutions[i],
          etat: etatReglage(resolutions[i]),
        })),
      )

      //  Les informations sont une SECONDE lecture : si elle échoue, les règles
      //  restent lisibles et l'écran dit seulement que la trace manque.
      try {
        setInformations(await Regles.informations({ entrepriseId, employeId }))
        setInfosErreur('')
      } catch (e) {
        setInformations([])
        setInfosErreur(e?.message || 'Les informations enregistrées n’ont pas pu être lues.')
      }
    } catch (e) {
      setErreur(e?.message || 'Les réglages n’ont pas pu être lus.')
      setReglages([])
      setInformations([])
      setInfosErreur('')
    } finally {
      setChargement(false)
    }
  }, [entrepriseId, employeId])

  useEffect(() => {
    charger()
  }, [charger])

  //  Échap referme ; le focus revient au geste qui a ouvert.
  useEffect(() => {
    if (!ouvert) return undefined
    const surTouche = (e) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('keydown', surTouche)
    boutonFermer.current?.focus()
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert])

  const ligneActive = useMemo(
    () => reglages.find((r) => r.cle === selection) || null,
    [reglages, selection],
  )

  const personnels = compterPersonnels(reglages)
  const resume = chargement
    ? 'Lecture des réglages…'
    : `${reglages.length} réglages · ${personnels} ${personnels > 1 ? 'personnels' : 'personnel'}`

  const impact = useMemo(() => {
    if (!ligneActive) return null
    return apercuReglagePersonnel({
      resolution: ligneActive.resolution,
      valeur: saisie.valeur,
      verrouille: saisie.verrouille,
      superAdmin,
    })
  }, [ligneActive, saisie.valeur, saisie.verrouille, superAdmin])

  function ouvrir() {
    setMessage('')
    setSelection(null)
    setConfirmationRetour(false)
    setOuvert(true)
  }

  function choisir(reglage) {
    setSelection(reglage.cle)
    setSaisie({
      valeur: reglage.resolution?.valeur === null || reglage.resolution?.valeur === undefined
        ? ''
        : String(reglage.resolution.valeur),
      dateEffet: calculerDateEffet().date,
      verrouille: false,
    })
    setConfirmationRetour(false)
    setMessage('')
    panneau.current?.scrollIntoView?.({ block: 'nearest' })
  }

  async function enregistrer() {
    if (!ligneActive || enCours) return
    //  ⚠️ Une date d'effet REFUSÉE n'est jamais remplacée par un défaut.
    if (!saisie.dateEffet) {
      setMessage(refusDateEffet || 'Date d’effet indisponible : enregistrement refusé.')
      return
    }
    const valeur = saisie.valeur === '' ? null : Number(saisie.valeur)
    const controle = Regles.validerValeur(ligneActive.cle, valeur)
    if (!controle.ok) {
      setMessage(controle.message)
      return
    }

    setEnCours(true)
    setMessage('')
    try {
      await Regles.ecrire({
        entrepriseId,
        employeId,
        cle: ligneActive.cle,
        valeur,
        dateEffet: saisie.dateEffet,
        verrouille: saisie.verrouille === true && superAdmin,
      })
      setMessage('Réglage enregistré. L’information a été enregistrée pour cette personne.')
      setSelection(null)
      await charger()
    } catch (e) {
      setMessage(e?.message || 'Le réglage n’a pas pu être enregistré.')
    } finally {
      setEnCours(false)
    }
  }

  async function revenir() {
    if (!ligneActive || enCours) return
    if (!saisie.dateEffet) {
      setMessage(refusDateEffet || 'Date d’effet indisponible : enregistrement refusé.')
      return
    }
    setEnCours(true)
    setMessage('')
    try {
      await Regles.revenirEntreprise({
        entrepriseId,
        employeId,
        cle: ligneActive.cle,
        dateEffet: saisie.dateEffet,
      })
      setMessage('Retour enregistré : la règle de l’entreprise s’applique de nouveau.')
      setConfirmationRetour(false)
      setSelection(null)
      await charger()
    } catch (e) {
      setMessage(e?.message || 'Le retour à la règle de l’entreprise n’a pas pu être enregistré.')
    } finally {
      setEnCours(false)
    }
  }

  if (!entrepriseId || !employeId) return null

  return (
    <>
      {/* ── LA BANDE : une ligne, et le geste. Rien d'autre ne monte. ── */}
      <section className="rtt-bande" aria-label="Règles de temps de travail">
        <h2 className="rtt-bande-titre">Règles de temps de travail</h2>
        <p className="rtt-bande-resume">{erreur ? 'Réglages indisponibles' : resume}</p>
        <button type="button" className="ch-btn-contour" onClick={ouvrir}>
          Voir les règles
        </button>
      </section>

      {ouvert && (
        <div className="rtt-voile" role="presentation" onMouseDown={() => setOuvert(false)}>
          <div
            className="rtt-modale"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rtt-titre"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="rtt-modale-tete">
              <div>
                <h2 className="rtt-titre" id="rtt-titre">Règles de temps de travail</h2>
                <p className="rtt-sous-titre">
                  {nomEmploye ? `${nomEmploye} · ` : ''}
                  applicables au {dateEffetCourte(dateEffetAujourdhui) || '—'}
                </p>
              </div>
              <button
                type="button"
                className="rtt-fermer"
                onClick={() => setOuvert(false)}
                aria-label="Fermer les règles de temps de travail"
                ref={boutonFermer}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="rtt-modale-corps">
              {erreur && (
                <p className="rtt-erreur" role="alert">
                  {erreur}{' '}
                  <button type="button" className="rtt-lien" onClick={charger}>Réessayer</button>
                </p>
              )}

              {chargement && !erreur && (
                <p className="rtt-vide">Lecture des réglages de cette personne…</p>
              )}

              {!chargement && !erreur && (
                <ul className="rtt-lignes">
                  {reglages.map((r) => {
                    const actif = r.cle === selection
                    const dateEffet = dateEffetCourte(r.resolution?.dateEffet)
                    return (
                      <li
                        key={r.cle}
                        className={`rtt-ligne rtt-ligne--${r.etat}${actif ? ' is-active' : ''}`}
                      >
                        <span className="rtt-feuille" aria-hidden="true" />

                        <div className="rtt-ligne-texte">
                          <h3 className="rtt-ligne-titre">{r.libelle}</h3>
                          <p className="rtt-ligne-aide">{r.aide}</p>
                        </div>

                        <p className="rtt-valeur">{formaterValeurHeures(r.resolution?.valeur)}</p>

                        <div className="rtt-origine">
                          <span className="rtt-tampon">
                            {r.etat === 'personnelle_verrouillee' && (
                              <Lock size={10} aria-hidden="true" />
                            )}
                            {libelleEtat(r.etat)}
                          </span>
                          {dateEffet ? (
                            <span className="rtt-date">
                              {r.etat === 'suit_entreprise' ? 'depuis le ' : 'décidé le '}
                              {dateEffet}
                            </span>
                          ) : (
                            <span className="rtt-date">contrôle indisponible</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="rtt-action"
                          onClick={() => (actif ? setSelection(null) : choisir(r))}
                        >
                          {actif ? 'Fermer' : 'Régler'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* ── L'aperçu vient AVANT l'écriture ── */}
              {ligneActive && impact && (
                <section className="rtt-impact" aria-label="Aperçu d’impact" ref={panneau}>
                  <h3 className="rtt-impact-titre">Aperçu d’impact</h3>

                  <dl className="rtt-impact-chiffres">
                    <div>
                      <dt>Personnes concernées</dt>
                      <dd>{impact.personnesConcernees}</dd>
                    </div>
                    <div>
                      <dt>Valeur actuelle → nouvelle</dt>
                      <dd>
                        {formaterValeurHeures(impact.valeurActuelle)}
                        <span aria-hidden="true"> → </span>
                        {formaterValeurHeures(impact.nouvelleValeur)}
                      </dd>
                    </div>
                    <div>
                      <dt>Date d’effet</dt>
                      <dd>
                        {dateEffetCourte(saisie.dateEffet) || '—'}
                        {!saisie.dateEffet && (
                          <span className="rtt-note" role="alert">
                            {' '}{refusDateEffet || 'Date d’effet indisponible.'}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <p className="rtt-impact-phrase">{phraseImpact(impact)}</p>

                  {impact.ecritureBloquee && (
                    <p className="rtt-blocage" role="status">
                      <Lock size={13} aria-hidden="true" />
                      Cette valeur est verrouillée : seul un super-administrateur peut la modifier.
                    </p>
                  )}

                  <div className="rtt-champs">
                    <label className="rtt-champ">
                      <span>Nouvelle valeur (heures)</span>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={saisie.valeur}
                        onChange={(e) => {
                          setSaisie((s) => ({ ...s, valeur: e.target.value }))
                          setMessage('')
                        }}
                        disabled={impact.ecritureBloquee}
                      />
                    </label>

                    <label className="rtt-champ">
                      <span>À partir du</span>
                      <input
                        type="date"
                        value={saisie.dateEffet}
                        onChange={(e) => setSaisie((s) => ({ ...s, dateEffet: e.target.value }))}
                        disabled={impact.ecritureBloquee}
                      />
                    </label>
                  </div>

                  {superAdmin && (
                    <label className="rtt-case">
                      <input
                        type="checkbox"
                        checked={saisie.verrouille}
                        onChange={(e) => setSaisie((s) => ({ ...s, verrouille: e.target.checked }))}
                      />
                      <span>Verrouiller ce réglage (super-administrateur)</span>
                    </label>
                  )}

                  <div className="rtt-actions">
                    {/*  Deux actes distincts ne s'arment jamais ensemble : tant que
                        le retour à la règle d'entreprise attend sa confirmation,
                        « Enregistrer » n'est pas offert. Un seul bouton de poids
                        maximal par écran (charte), et aucune confusion possible
                        entre écrire une valeur et retirer la sienne. */}
                    {!confirmationRetour && (
                      <button
                        type="button"
                        className="ch-btn-inverse"
                        onClick={enregistrer}
                        disabled={enCours || impact.ecritureBloquee}
                      >
                        Enregistrer
                      </button>
                    )}

                    {retourPossible(ligneActive.etat) && !confirmationRetour && (
                      <button
                        type="button"
                        className="ch-btn-contour"
                        onClick={() => setConfirmationRetour(true)}
                        disabled={enCours}
                      >
                        Revenir à la règle de l’entreprise
                      </button>
                    )}

                    {retourPossible(ligneActive.etat) && confirmationRetour && (
                      <div className="rtt-confirmation">
                        <p>
                          Le réglage personnel sera retiré à compter du{' '}
                          <strong>{dateEffetCourte(saisie.dateEffet) || '—'}</strong>. La règle de
                          l’entreprise s’appliquera. L’ancienne décision reste dans l’historique.
                        </p>
                        <div className="rtt-actions">
                          <button
                            type="button"
                            className="ch-btn-inverse"
                            onClick={revenir}
                            disabled={enCours}
                          >
                            Confirmer le retour
                          </button>
                          <button
                            type="button"
                            className="ch-btn-contour"
                            onClick={() => setConfirmationRetour(false)}
                            disabled={enCours}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {message && <p className="rtt-message" role="status">{message}</p>}
            </div>

            {!chargement && !erreur && (
              <footer className="rtt-pied">
                <h3 className="rtt-pied-titre">Informations enregistrées</h3>
                <p className="rtt-note">
                  <Info size={12} aria-hidden="true" />
                  Ce qui a été dit à cette personne, et quand. Un enregistrement, pas un message
                  qui disparaît.
                </p>

                {infosErreur && <p className="rtt-erreur" role="alert">{infosErreur}</p>}

                {!infosErreur && informations.length === 0 && (
                  <p className="rtt-vide">Aucune information enregistrée pour cette personne.</p>
                )}

                {informations.length > 0 && (
                  <table className="rtt-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Destinataire</th>
                        <th scope="col">Ce qui a été dit</th>
                        <th scope="col">Consulté</th>
                      </tr>
                    </thead>
                    <tbody>
                      {informations.map((info) => (
                        <tr key={info.id}>
                          <td>{jourDuTexte(info.emisLe) || '—'}</td>
                          <td>{nomEmploye || 'Cette personne'}</td>
                          <td>{info.contenu}</td>
                          <td>{info.consulteLe ? `le ${jourDuTexte(info.consulteLe)}` : 'non consultée'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </footer>
            )}

            <div className="rtt-modale-pied">
              <button
                type="button"
                className="rtt-lien"
                onClick={() => {
                  setOuvert(false)
                  navigate('/mon-entreprise')
                }}
              >
                Voir les règles de l’entreprise
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
