// src/pages/MonEntreprise.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 🏢 MON ENTREPRISE — ce que l'entreprise a décidé, et depuis quand
//
// Maquette retenue le 24/11/2026 : `maquettes/choix-mon-entreprise.png`.
// Le fondateur a dit : « refais la page Mon entreprise car ça ne colle pas avec
// l'identité En-Check ». La page est donc UNE FEUILLE : bande de bogolan en
// haut, cadre d'encre de 2 px, ombre dure à flou zéro, bandes de colle, rabat
// au coin, registre à traits de feutre. Aucune carte à gros arrondi, aucune
// ombre floue, aucune couleur en dur.
//
// QUATRE SECTIONS, ET RIEN D'AUTRE
//   1. Identité — lecture seule. La modifier reste l'affaire du super-admin
//      dans « Entreprises » ; un écran qui laisse croire le contraire mentirait.
//   2. Règles de temps de travail — la valeur, son origine, sa date d'effet,
//      l'écriture en deux temps, l'aperçu d'impact. Chaque écriture crée une
//      VERSION : rien ne se réécrit, donc rien ne s'efface. L'historique est la
//      colonne de droite, comme un registre qu'on tourne.
//   3. Modèle proposé — 48 h / 50 h. Le produit PROPOSE, l'entreprise CONFIRME.
//   4. Pied — la dernière écriture, datée.
//
// CE QUE CET ÉCRAN N'INVENTE PAS
//   · aucun « seuil légal » : aucune source pays n'est vérifiée (D5) ;
//   · aucun rattachement pays → modèle : `MODELES_PAR_PAYS` est vide ;
//   · aucune valeur par défaut écrite en douce : confirmer est un acte.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Clock4, History, Info, Lock, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import * as Regles from '../services/reglesTempsTravail'
import {
  MODELES_HEBDO,
  REGLES_AFFICHEES,
  accesAutorise,
  cibleRetour,
  formaterHeures,
  libelleStatutModele,
  modelePropose,
  statutModele,
} from '../lib/monEntreprise'
import { dateEffetCourte } from '../lib/reglesPersonnelles'
import { dateEffetAuLundi } from '../services/seuilsHebdoParSemaine'
import './MonEntreprise.css'

const CHAMPS_ENTREPRISE = 'id, name, code, country_code, currency, timezone, is_active'
//  ⚠️ `AUJOURDHUI()` (date UTC du jour) a été RETIRÉE : elle servait de date
//  d'effet au seuil, ce que la décision B0-a interdit. La date d'effet se
//  calcule désormais avec `dateEffetAuLundi`, dans le fuseau de l'entreprise.

/**
 * La date d'effet d'une confirmation de SEUIL, au lundi (décision B0-a).
 *
 * ⚠️ Ce n'est PAS la date du jour : c'est le lundi où la nouvelle valeur
 * commence à gouverner, à 04:00 dans le fuseau de l'entreprise. Une
 * confirmation un mardi prend effet le lundi suivant.
 *
 * ⚠️ Sans fuseau d'entreprise, `dateEffetAuLundi` REFUSE (throw). On ne
 * remplace jamais ce refus par la date UTC du jour : ce serait exactement le
 * repli silencieux que la décision B0-a interdit. L'appelant doit traiter
 * l'erreur et le dire à l'écran.
 */
function dateEffetSeuil(fuseau) {
  return dateEffetAuLundi(new Date(), fuseau)
}

function lireAdmin() {
  try {
    return JSON.parse(localStorage.getItem('admin') || 'null')
  } catch {
    return null
  }
}

/** L'état d'une règle, pour le trait de feutre. */
function etatRegle(resolution) {
  if (!resolution || resolution.origine === 'aucune') return 'aucune'
  if (resolution.verrouille === true) return 'verrouillee'
  if (resolution.origine === 'employe') return 'personnelle'
  if (resolution.origine === 'contrat') return 'contrat'
  return 'entreprise'
}

/** Le tampon dit l'origine en trois mots, jamais une couleur seule (C7). */
function tamponOrigine(resolution) {
  const etat = etatRegle(resolution)
  if (etat === 'aucune') return 'Aucune valeur'
  if (etat === 'verrouillee') return 'Personnel · verrouillé'
  if (etat === 'personnelle') return 'Réglage personnel'
  if (etat === 'contrat') return 'Valeur du contrat'
  return 'Règle de l’entreprise'
}

/**
 * Le retour, en haut à gauche de la feuille — même objet que sur la fiche
 * employé (`.e360-retour`) et sur l'annuaire (`.empv3-fleche`) : 34 px, pilule,
 * contour d'encre de 2 px, papier, survol `--charte-surface2`. La maison n'a
 * qu'une flèche retour ; on ne lui en invente pas une seconde.
 *
 * Où il mène : là d'où l'on vient s'il y a un « d'où », sinon au tableau de
 * bord. Un retour ne doit jamais déposer personne hors de l'application.
 */
function RetourEntete() {
  const navigate = useNavigate()
  const retour = () => {
    const cible = cibleRetour(window.history.state?.idx)
    if (cible === 'precedent') navigate(-1)
    else navigate(cible)
  }
  return (
    <button
      type="button"
      className="me-retour"
      onClick={retour}
      aria-label="Retour à la page précédente"
      title="Retour"
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
  )
}

export default function MonEntreprise() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [entreprises, setEntreprises] = useState([])
  const [entrepriseId, setEntrepriseId] = useState(null)
  const [entreprise, setEntreprise] = useState(null)
  const [regles, setRegles] = useState({})
  const [historique, setHistorique] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  //  Édition en deux temps : on saisit, puis on CONFIRME en voyant l'ancienne
  //  valeur. Un écran qui écrase sans montrer ce qu'il remplace n'informe pas.
  const [edition, setEdition] = useState(null)
  const [confirmationModele, setConfirmationModele] = useState(false)
  //  Aperçu d'impact (protection (a) du §3.3) : chargé AVANT l'écriture.
  const [impact, setImpact] = useState(null)

  useEffect(() => {
    const courant = lireAdmin()
    if (!courant) {
      navigate('/login')
      return
    }
    setAdmin(courant)
  }, [navigate])

  //  ── 1) Les entreprises visibles ──────────────────────────────
  useEffect(() => {
    if (!admin) return
    let actif = true

    const charger = async () => {
      if (admin.role === 'super_admin') {
        const { data } = await supabase
          .from('enterprises')
          .select(CHAMPS_ENTREPRISE)
          .eq('is_active', true)
          .order('name')
        if (!actif) return
        const liste = data || []
        setEntreprises(liste)
        const choix =
          admin.selectedEnterprise?.id || admin.enterprise_id || liste[0]?.id || null
        setEntrepriseId((precedent) => precedent || choix)
        return
      }

      //  Un administrateur ordinaire ne choisit pas son entreprise ici : elle
      //  est portée par son compte. On la relit pour l'identité seulement.
      const id = admin.selectedEnterprise?.id || admin.enterprise_id || null
      if (!id) {
        if (actif) {
          setErreur('Aucune entreprise n’est rattachée à ce compte.')
          setChargement(false)
        }
        return
      }
      const { data } = await supabase
        .from('enterprises')
        .select(CHAMPS_ENTREPRISE)
        .eq('id', id)
        .maybeSingle()
      if (!actif) return
      const liste = data ? [data] : []
      setEntreprises(liste)
      setEntrepriseId(id)
    }

    charger()
    return () => { actif = false }
  }, [admin])

  const autorise = useMemo(
    () => (admin && entrepriseId ? accesAutorise(admin, entrepriseId, entreprises) : false),
    [admin, entrepriseId, entreprises],
  )

  //  ── 2) Identité + règles + historique ────────────────────────
  const chargerRegles = useCallback(async (id) => {
    const [resolutions, histo] = await Promise.all([
      Promise.all(
        REGLES_AFFICHEES.map((regle) =>
          Regles.resoudre({ entrepriseId: id, cle: regle.cle }).catch(() => null),
        ),
      ),
      Regles.historique({ entrepriseId: id }).catch(() => []),
    ])
    const parCle = {}
    REGLES_AFFICHEES.forEach((regle, i) => { parCle[regle.cle] = resolutions[i] })
    setRegles(parCle)
    setHistorique(histo)
  }, [])

  useEffect(() => {
    if (!entrepriseId || !autorise) return
    let actif = true
    setChargement(true)
    setErreur('')

    ;(async () => {
      try {
        const { data } = await supabase
          .from('enterprises')
          .select(CHAMPS_ENTREPRISE)
          .eq('id', entrepriseId)
          .maybeSingle()
        if (!actif) return
        setEntreprise(data || null)
        await chargerRegles(entrepriseId)
      } catch (e) {
        if (actif) setErreur(e?.message || 'Les règles n’ont pas pu être lues.')
      } finally {
        if (actif) setChargement(false)
      }
    })()

    return () => { actif = false }
  }, [entrepriseId, autorise, chargerRegles])

  //  ── 3) Écriture ──────────────────────────────────────────────
  //  ── DATE D'EFFET, DÉCISION B0-a ─────────────────────────────
  //  ⚠️ `dateEffetAuLundi` REFUSE sans fuseau d'entreprise (throw). On ne
  //  remplace pas ce refus par la date UTC du jour : ce serait le repli
  //  silencieux que la décision interdit. Le motif est mémorisé et NOMMÉ.
  const [refusDateEffet, setRefusDateEffet] = useState('')

  /** La date d'effet du seuil, ou null si elle est refusée. */
  const calculerDateEffet = useCallback(() => {
    try {
      const date = dateEffetSeuil(entreprise?.timezone)
      setRefusDateEffet('')
      return date
    } catch (e) {
      //  Le refus est affiché, jamais contourné.
      setRefusDateEffet(e?.message || 'La date d’effet ne peut pas être calculée.')
      return null
    }
  }, [entreprise?.timezone])

  /** Ouvre une édition : sans date d'effet valide, l'écriture est refusée. */
  const saisirDateEffet = useCallback(() => calculerDateEffet(), [calculerDateEffet])

  const dateEffetModele = useMemo(() => calculerDateEffet(), [calculerDateEffet, confirmationModele]) // eslint-disable-line react-hooks/exhaustive-deps

  const appliquer = async ({ cle, valeur, dateEffet }) => {
    //  ⚠️ Une date d'effet REFUSÉE n'est jamais remplacée par un défaut.
    if (!dateEffet) {
      setErreur(refusDateEffet || 'Date d’effet indisponible : enregistrement refusé.')
      return
    }
    setEnCours(true)
    setErreur('')
    try {
      await Regles.ecrire({ entrepriseId, cle, valeur, dateEffet })
      await chargerRegles(entrepriseId)
      setEdition(null)
      setConfirmationModele(false)
    } catch (e) {
      setErreur(e?.message || 'La règle n’a pas pu être enregistrée.')
    } finally {
      setEnCours(false)
    }
  }

  const modele = modelePropose(entreprise?.country_code)
  const etatDuModele = statutModele({
    valeurRegle: regles.alerte_hebdo_heures?.valeur ?? null,
    modele,
  })

  //  ── Rendu ────────────────────────────────────────────────────
  if (!admin) return null

  if (admin.role !== 'super_admin' && entrepriseId && entreprises.length && !autorise) {
    return (
      <main className="me-page">
        <div className="me-feuille">
          <span className="me-bande-motif" aria-hidden="true" />
          <RetourEntete />
          <div className="me-carte" role="alert">
            <h1>Accès refusé</h1>
            <p>Cette entreprise n’est pas rattachée à votre compte.</p>
          </div>
        </div>
      </main>
    )
  }

  const derniere = historique[0] || null

  return (
    <main className="me-page">
      <div className="me-feuille">
        <span className="me-bande-motif" aria-hidden="true" />

        <header className="me-tete">
          <div className="me-tete-texte">
            <RetourEntete />
            <p className="me-surtitre">En-Check · Réglages</p>
            <h1 className="me-titre">Mon entreprise</h1>
            <p className="me-sous-titre">
              Les règles de temps de travail qui s’appliquent ici, d’où elles
              viennent et depuis quand.
            </p>
          </div>

          {admin.role === 'super_admin' && entreprises.length > 1 && (
            <label className="me-selecteur">
              <span className="me-selecteur-libelle">Entreprise</span>
              <span className="me-selecteur-champ">
                <select
                  value={entrepriseId || ''}
                  onChange={(e) => {
                    setEntrepriseId(e.target.value)
                    setEdition(null)
                    setConfirmationModele(false)
                  }}
                >
                  {entreprises.map((e) => (
                    <option key={e.id} value={e.id}>{e.name || e.code || e.id}</option>
                  ))}
                </select>
                <span className="me-chevron" aria-hidden="true">▾</span>
              </span>
            </label>
          )}
        </header>

        {erreur && <p className="me-erreur" role="alert">{erreur}</p>}

        {/* ── Identité : lecture seule, et on dit pourquoi ─────────── */}
        <section className="me-carte me-carte--identite" aria-label="Identité de l’entreprise">
          <h2 className="me-carte-titre">Identité</h2>
          <dl className="me-identite">
            <div><dt>Nom</dt><dd>{entreprise?.name || '—'}</dd></div>
            <div><dt>Code</dt><dd>{entreprise?.code || '—'}</dd></div>
            <div><dt>Pays</dt><dd>{entreprise?.country_code || 'non renseigné'}</dd></div>
            <div><dt>Devise</dt><dd>{entreprise?.currency || 'non renseignée'}</dd></div>
            <div><dt>Fuseau</dt><dd>{entreprise?.timezone || '—'}</dd></div>
          </dl>
          <p className="me-note">
            <Lock size={14} aria-hidden="true" /> Cette identité se modifie dans
            « Entreprises », réservé au super-administrateur. Ici, elle se lit.
          </p>
        </section>

        {/* ── Règles de temps de travail + historique ───────────────── */}
        <section className="me-carte me-carte--regles" aria-label="Règles de temps de travail">
          <div className="me-regles-corps">
            <div className="me-regles-principal">
              <h2 className="me-carte-titre">Règles de temps de travail</h2>
              <p className="me-note">
                <Info size={14} aria-hidden="true" /> Ce sont des paramètres
                d’entreprise, pas des obligations légales. Chaque changement crée
                une version : la précédente reste dans l’historique.
              </p>

              {chargement ? (
                <p className="me-vide">Chargement des règles…</p>
              ) : (
                <ul className="me-regles">
                  {REGLES_AFFICHEES.map((regle) => {
                    const resolution = regles[regle.cle]
                    const enEdition = edition?.cle === regle.cle
                    const etat = etatRegle(resolution)
                    const dateEffet = dateEffetCourte(resolution?.dateEffet)
                    return (
                      <li key={regle.cle} className={`me-regle me-regle--${etat}`}>
                        <span className="me-trait" aria-hidden="true" />

                        <div className="me-regle-texte">
                          <h3 className="me-regle-titre">{regle.libelle}</h3>
                          <p className="me-regle-aide">{regle.aide}</p>
                        </div>

                        <p className="me-regle-valeur">{formaterHeures(resolution?.valeur)}</p>

                        <div className="me-regle-origine">
                          <span className="me-tampon">{tamponOrigine(resolution)}</span>
                          {dateEffet ? (
                            <span className="me-regle-date">
                              {etat === 'entreprise' || etat === 'contrat'
                                ? 'depuis le '
                                : 'décidé le '}
                              {dateEffet}
                            </span>
                          ) : (
                            <span className="me-regle-date">contrôle indisponible</span>
                          )}
                        </div>

                        {!enEdition && (
                          <button
                            type="button"
                            className="me-bouton me-bouton--discret"
                            onClick={() => {
                              setConfirmationModele(false)
                              setImpact(null)
                              setEdition({
                                cle: regle.cle,
                                valeur: resolution?.valeur ?? '',
                                //  La date d'effet n'est pas saisie : elle est
                                //  calculée au lundi par la règle B0-a.
                                dateEffet: saisirDateEffet(),
                                confirme: false,
                              })
                            }}
                          >
                            Modifier
                          </button>
                        )}

                        {enEdition && (
                          <div className="me-edition">
                            <div className="me-edition-champs">
                              <label>
                                <span>Nouvelle valeur (heures)</span>
                                <input
                                  type="number"
                                  min="0.5"
                                  step="0.5"
                                  value={edition.valeur}
                                  onChange={(e) => setEdition({ ...edition, valeur: e.target.value, confirme: false })}
                                />
                              </label>
                              <label>
                                <span>À partir du lundi</span>
                                {/*  ⚠️ Non éditable : la date d'effet est
                                    calculée (B0-a, borne 04:00). La laisser
                                    saisir librement permettrait de viser une
                                    semaine déjà entamée — ce que la règle
                                    interdit. */}
                                <input
                                  type="text"
                                  value={dateEffetCourte(edition.dateEffet) || '—'}
                                  readOnly
                                  aria-readonly="true"
                                />
                                {/*  Un refus est DIT, jamais contourné. */}
                                {!edition.dateEffet && (
                                  <span className="me-note me-note--alerte" role="alert">
                                    {refusDateEffet || 'Date d’effet indisponible.'}
                                  </span>
                                )}
                                {edition.dateEffet && (
                                  <span className="me-note">
                                    C’est le lundi où la valeur commence à gouverner, à 04:00
                                    dans le fuseau de l’entreprise. Une confirmation en
                                    semaine vise le lundi suivant.
                                  </span>
                                )}
                              </label>
                            </div>

                            {/*  La confirmation montre ce qui sera remplacé. */}
                            <div className="me-confirmation">
                              <p>
                                Remplacer <strong>{formaterHeures(resolution?.valeur)}</strong> par{' '}
                                <strong>{formaterHeures(edition.valeur)}</strong> à partir du{' '}
                                <strong>{dateEffetCourte(edition.dateEffet) || '—'}</strong>.
                              </p>
                              <label className="me-case">
                                <input
                                  type="checkbox"
                                  checked={edition.confirme}
                                  onChange={async (e) => {
                                    const coche = e.target.checked
                                    setEdition({ ...edition, confirme: coche })
                                    setImpact(null)
                                    if (!coche) return
                                    const valeur = Number(edition.valeur)
                                    if (!Number.isFinite(valeur)) return
                                    try {
                                      setImpact(await Regles.apercuImpact({
                                        entrepriseId,
                                        cle: regle.cle,
                                        valeur,
                                        date: edition.dateEffet,
                                      }))
                                    } catch {
                                      //  Pas d'aperçu : on n'en fabrique pas un.
                                      setImpact(null)
                                    }
                                  }}
                                />
                                <span>Je confirme ce changement</span>
                              </label>

                              {/*  Ce que le changement va remplacer, nommé, avant l'écriture. */}
                              {impact && (
                                <p className={impact.ecritureBloquee ? 'me-impact me-impact--bloque' : 'me-impact'}>
                                  {impact.valeursChangees === 0
                                    ? 'Aucune valeur personnelle ne serait remplacée.'
                                    : impact.valeursChangees === 1
                                      ? `1 employé verrait sa valeur remplacée (sur ${impact.employesConcernes} ayant une valeur personnelle).`
                                      : `${impact.valeursChangees} employés verraient leur valeur remplacée (sur ${impact.employesConcernes} ayant une valeur personnelle).`}
                                  {impact.dontVerrouillees > 0 && (
                                    <> {impact.dontVerrouillees} valeur{impact.dontVerrouillees > 1 ? 's sont verrouillées' : ' est verrouillée'}
                                      {impact.ecritureBloquee
                                        ? ' : l’enregistrement sera refusé. Un super-administrateur doit lever le verrou.'
                                        : '.'}</>
                                  )}
                                </p>
                              )}
                            </div>

                            <div className="me-actions">
                              <button
                                type="button"
                                className="me-bouton me-bouton--discret"
                                onClick={() => setEdition(null)}
                                disabled={enCours}
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                className="me-bouton"
                                disabled={!edition.confirme || enCours || impact?.ecritureBloquee === true}
                                onClick={() =>
                                  appliquer({
                                    cle: regle.cle,
                                    valeur: edition.valeur === '' ? null : Number(edition.valeur),
                                    dateEffet: edition.dateEffet,
                                  })
                                }
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <aside className="me-historique-col" aria-label="Historique des règles">
              <h3 className="me-historique-titre">
                <History size={13} aria-hidden="true" /> Historique
              </h3>
              {historique.length === 0 ? (
                <p className="me-vide">
                  Aucune règle enregistrée. Tant qu’il n’y en a pas, l’alerte
                  retombe sur la valeur par défaut du produit et le dit.
                </p>
              ) : (
                <ol className="me-historique">
                  {historique.slice(0, 12).map((v) => {
                    const libelle = REGLES_AFFICHEES.find((r) => r.cle === v.cle)?.libelle || v.cle
                    return (
                      <li key={v.id}>
                        <span className="me-historique-date">
                          <Clock4 size={11} aria-hidden="true" />
                          {dateEffetCourte(v.dateEffet) || '—'}
                        </span>
                        <span className="me-historique-texte">
                          {libelle} : <strong>{formaterHeures(v.valeur)}</strong>
                          {v.employeId ? ' (personnel)' : ''}
                          {v.verrouille ? ' · verrouillée' : ''}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </aside>
          </div>
        </section>

        {/* ── Modèle proposé (G4b) ─────────────────────────────────── */}
        <section className="me-carte me-carte--modele" aria-label="Modèle proposé">
          <h2 className="me-carte-titre">Modèle proposé</h2>

          <div className="me-modele-corps">
            <p className="me-modele-grand">{formaterHeures(etatDuModele.valeur)}</p>

            <div className="me-modele-texte">
              <p className={`me-statut me-statut--${etatDuModele.statut_source}`}>
                {libelleStatutModele(etatDuModele.statut_source)}
              </p>
              <p className="me-note">
                <Info size={14} aria-hidden="true" /> Le produit propose un point
                de départ ; il ne l’applique jamais tout seul, et aucun modèle
                n’est rattaché à un pays tant qu’aucune source n’a été vérifiée.
              </p>

              {!confirmationModele && etatDuModele.statut_source !== 'applique' && (
                <button type="button" className="me-bouton" onClick={() => setConfirmationModele(true)}>
                  Utiliser le modèle {modele.heures} h
                </button>
              )}
            </div>
          </div>

          {confirmationModele && (
            <div className="me-confirmation">
              <p>
                Appliquer <strong>{modele.heures} h</strong> au seuil d’alerte
                hebdomadaire, à partir du <strong>{dateEffetCourte(dateEffetModele) || '—'}</strong>. Un
                changement d’avis est possible : chaque version reste dans
                l’historique.
              </p>
              <div className="me-actions">
                <button
                  type="button"
                  className="me-bouton me-bouton--discret"
                  onClick={() => setConfirmationModele(false)}
                  disabled={enCours}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="me-bouton"
                  disabled={enCours || !dateEffetModele}
                  onClick={() =>
                    appliquer({
                      cle: 'alerte_hebdo_heures',
                      valeur: modele.heures,
                      dateEffet: dateEffetModele,
                    })
                  }
                >
                  <Check size={15} aria-hidden="true" /> Confirmer l’application
                </button>
              </div>
            </div>
          )}

          {etatDuModele.statut_source === 'applique' && (
            <p className="me-note">
              <ShieldCheck size={14} aria-hidden="true" /> Ce modèle est bien celui
              en vigueur. Il reste modifiable ci-dessus, réglage par réglage.
            </p>
          )}

          <ul className="me-modeles">
            {MODELES_HEBDO.map((m) => (
              <li key={m.id} className={m.heures === modele.heures ? 'is-propose' : ''}>
                {m.libelle}
                {m.heures === modele.heures && <span className="me-puce">proposé</span>}
              </li>
            ))}
          </ul>
        </section>

        <footer className="me-pied">
          {derniere ? (
            <p className="me-pied-texte">
              Dernière écriture : <strong>{dateEffetCourte(derniere.dateEffet) || '—'}</strong>
              {' · '}
              {formaterHeures(derniere.valeur)}
            </p>
          ) : (
            <p className="me-pied-texte">Aucune écriture enregistrée pour l’instant.</p>
          )}
        </footer>
      </div>
    </main>
  )
}
