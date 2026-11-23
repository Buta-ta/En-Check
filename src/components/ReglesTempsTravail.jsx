// src/components/ReglesTempsTravail.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 👤 RÈGLES DE TEMPS DE TRAVAIL D'UNE PERSONNE — la fiche employé, clé par clé
//
// Maquette retenue le 24/10/2026 : `maquettes/choix-g5-fiche-employe.png`.
// Peau « brut adouci, double feutre » : un cadre d'encre de 2 px, une ombre
// dure à flou zéro, des lavis de feutre par état, aucun dégradé.
//
// CE QUE CET ÉCRAN DIT, ET NE DIT PAS
//   · dit, pour chaque clé : la valeur, son ORIGINE, sa date d'effet, et si
//     elle est verrouillée — en mots, jamais par la couleur seule (C7) ;
//   · dit « aucune valeur » quand il n'y en a pas : jamais « 0 h », jamais une
//     coche verte qui ferait croire à une conformité constatée ;
//   · ne dit jamais « légal » : ce sont des paramètres d'entreprise ;
//   · affiche l'APERÇU D'IMPACT avant d'écrire, et bloque si le verrou s'y
//     oppose — le refus se voit avant, pas après l'erreur ;
//   · n'invente aucun auteur : faute de nom, on donne la date, pas un nom.
//
// ⚠️ L'écriture n'est jamais directe : tout passe par les RPC, qui contrôlent
//    l'accès, les bornes et le verrou. Ce composant ne fait que parler.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Lock } from 'lucide-react'
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
import './ReglesTempsTravail.css'

const AUJOURDHUI = () => new Date().toISOString().slice(0, 10)

function jourDuTexte(horodatage) {
  if (!horodatage) return null
  const d = new Date(horodatage)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReglesTempsTravail({ entrepriseId, employeId, nomEmploye = '', superAdmin = false }) {
  const navigate = useNavigate()
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [reglages, setReglages] = useState([])
  const [informations, setInformations] = useState([])
  const [infosErreur, setInfosErreur] = useState('')
  const [selection, setSelection] = useState(null)
  const [saisie, setSaisie] = useState({ valeur: '', dateEffet: AUJOURDHUI(), verrouille: false })
  const [confirmationRetour, setConfirmationRetour] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState('')

  const charger = useCallback(async () => {
    if (!entrepriseId || !employeId) return
    setChargement(true)
    setErreur('')
    try {
      const resolutions = await Promise.all(
        CLES_REGLAGES.map((r) => Regles.resoudre({ entrepriseId, employeId, cle: r.cle })),
      )
      const lues = CLES_REGLAGES.map((r, i) => ({
        ...r,
        resolution: resolutions[i],
        etat: etatReglage(resolutions[i]),
      }))
      setReglages(lues)

      //  Les informations sont une SECONDE lecture : si elle échoue, les règles
      //  restent lisibles et l'écran dit seulement que la trace manque. Faire
      //  disparaître les trois états parce qu'un journal est indisponible
      //  cacherait l'essentiel derrière l'accessoire.
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

  const ligneActive = useMemo(
    () => reglages.find((r) => r.cle === selection) || null,
    [reglages, selection],
  )

  const impact = useMemo(() => {
    if (!ligneActive) return null
    return apercuReglagePersonnel({
      resolution: ligneActive.resolution,
      valeur: saisie.valeur,
      verrouille: saisie.verrouille,
      superAdmin,
    })
  }, [ligneActive, saisie.valeur, saisie.verrouille, superAdmin])

  function ouvrir(reglage) {
    setSelection(reglage.cle)
    setSaisie({
      valeur: reglage.resolution?.valeur === null || reglage.resolution?.valeur === undefined
        ? ''
        : String(reglage.resolution.valeur),
      dateEffet: AUJOURDHUI(),
      verrouille: false,
    })
    setConfirmationRetour(false)
    setMessage('')
  }

  async function enregistrer() {
    if (!ligneActive || enCours) return
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
    <section className="rtt" aria-label="Règles de temps de travail">
      <header className="rtt-tete">
        <div>
          <h2 className="rtt-titre">Règles de temps de travail</h2>
          <p className="rtt-sous-titre">
            Ce qui s’applique à cette personne, clé par clé.
            {nomEmploye ? ' Sans réglage personnel, elle suit l’entreprise.' : ''}
          </p>
        </div>
        <button
          type="button"
          className="ch-btn-contour"
          onClick={() => navigate('/mon-entreprise')}
        >
          Mon entreprise
        </button>
      </header>

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
        <div className="rtt-corps">
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
                        <Lock size={11} aria-hidden="true" />
                      )}
                      {libelleEtat(r.etat)}
                    </span>
                    {dateEffet && (
                      <span className="rtt-date">
                        {r.etat === 'suit_entreprise' ? 'depuis le ' : 'décidé le '}
                        {dateEffet}
                      </span>
                    )}
                    {r.etat === 'aucune' && (
                      <span className="rtt-date">contrôle indisponible</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="rtt-action"
                    onClick={() => (actif ? setSelection(null) : ouvrir(r))}
                  >
                    {actif ? 'Fermer' : 'Régler'}
                  </button>
                </li>
              )
            })}
          </ul>

          <aside className="rtt-panneau" aria-live="polite">
            <h3 className="rtt-panneau-titre">Aperçu d’impact</h3>

            {!ligneActive && (
              <p className="rtt-panneau-vide">
                Choisissez un réglage pour voir ce qu’une écriture changerait, avant de l’écrire.
              </p>
            )}

            {ligneActive && impact && (
              <>
                <dl className="rtt-impact">
                  <div>
                    <dt>Personnes concernées</dt>
                    <dd>{impact.personnesConcernees}</dd>
                  </div>
                  <div>
                    <dt>Valeur actuelle</dt>
                    <dd>{formaterValeurHeures(impact.valeurActuelle)}</dd>
                  </div>
                  <div>
                    <dt>Nouvelle valeur</dt>
                    <dd>{formaterValeurHeures(impact.nouvelleValeur)}</dd>
                  </div>
                  <div>
                    <dt>Date d’effet</dt>
                    <dd>{dateEffetCourte(saisie.dateEffet) || '—'}</dd>
                  </div>
                </dl>

                <p className="rtt-impact-phrase">{phraseImpact(impact)}</p>

                {impact.ecritureBloquee && (
                  <p className="rtt-blocage" role="status">
                    <Lock size={13} aria-hidden="true" />
                    Cette valeur est verrouillée : seul un super-administrateur peut la modifier.
                  </p>
                )}

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
                  <button
                    type="button"
                    className="ch-btn-inverse"
                    onClick={enregistrer}
                    disabled={enCours || impact.ecritureBloquee}
                  >
                    Enregistrer
                  </button>

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
              </>
            )}

            {message && <p className="rtt-message" role="status">{message}</p>}
          </aside>
        </div>
      )}

      {!chargement && !erreur && (
        <section className="rtt-informations" aria-label="Informations enregistrées">
          <h3 className="rtt-informations-titre">Informations enregistrées</h3>
          <p className="rtt-note">
            <Info size={13} aria-hidden="true" />
            Ce qui a été dit à cette personne, et quand. Un enregistrement, pas un message
            qui disparaît.
          </p>

          {infosErreur && (
            <p className="rtt-erreur" role="alert">{infosErreur}</p>
          )}

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
        </section>
      )}
    </section>
  )
}
