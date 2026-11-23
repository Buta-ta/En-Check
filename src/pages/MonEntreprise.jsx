// src/pages/MonEntreprise.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 🏢 MON ENTREPRISE — ce que l'entreprise a décidé, et depuis quand
//
// TROIS SECTIONS, ET RIEN D'AUTRE
//   1. Identité — lecture seule. Modifier le nom, le pays ou la devise reste
//      l'affaire du super-administrateur dans « Entreprises » ; un écran qui
//      laisse croire le contraire serait un bouton mort.
//   2. Règles de temps de travail — la valeur en vigueur, son origine, sa date
//      d'effet, et l'historique. Chaque écriture crée une VERSION : rien ne se
//      réécrit, donc rien ne s'efface.
//   3. Modèle proposé — 48 h / 50 h. Le produit PROPOSE, l'entreprise CONFIRME.
//      Tant que personne n'a confirmé, l'écran affiche « proposition du produit,
//      non appliquée » : c'est le `statut_source` demandé, pas un slogan.
//
// CE QUE CET ÉCRAN N'INVENTE PAS
//   · aucun « seuil légal » : aucune source pays n'est vérifiée (D5) ;
//   · aucun rattachement pays → modèle : `MODELES_PAR_PAYS` est vide ;
//   · aucune valeur par défaut écrite en douce : confirmer est un acte.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock4, History, Info, Lock, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import * as Regles from '../services/reglesTempsTravail'
import {
  MODELES_HEBDO,
  REGLES_AFFICHEES,
  accesAutorise,
  formaterHeures,
  libelleStatutModele,
  modelePropose,
  statutModele,
} from '../lib/monEntreprise'
import './MonEntreprise.css'

const CHAMPS_ENTREPRISE = 'id, name, code, country_code, currency, timezone, is_active'
const AUJOURDHUI = () => new Date().toISOString().slice(0, 10)

function lireAdmin() {
  try {
    return JSON.parse(localStorage.getItem('admin') || 'null')
  } catch {
    return null
  }
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
  const appliquer = async ({ cle, valeur, dateEffet }) => {
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
        <div className="me-carte" role="alert">
          <h1>Accès refusé</h1>
          <p>Cette entreprise n’est pas rattachée à votre compte.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="me-page">
      <header className="me-tete">
        <div>
          <p className="me-surtitre">Réglages</p>
          <h1>Mon entreprise</h1>
          <p className="me-sous-titre">
            Les règles de temps de travail qui s’appliquent ici, d’où elles
            viennent et depuis quand.
          </p>
        </div>

        {admin.role === 'super_admin' && entreprises.length > 1 && (
          <label className="me-selecteur">
            <span>Entreprise</span>
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
          </label>
        )}
      </header>

      {erreur && <p className="me-erreur" role="alert">{erreur}</p>}

      {/* ── Identité : lecture seule, et on dit pourquoi ─────────── */}
      <section className="me-carte" aria-label="Identité de l’entreprise">
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

      {/* ── Règles de temps de travail ───────────────────────────── */}
      <section className="me-carte" aria-label="Règles de temps de travail">
        <h2 className="me-carte-titre">Règles de temps de travail</h2>
        <p className="me-note">
          <Info size={14} aria-hidden="true" /> Ce sont des paramètres
          d’entreprise, pas des obligations légales. Chaque changement crée une
          version : la précédente reste dans l’historique.
        </p>

        {chargement ? (
          <p className="me-vide">Chargement des règles…</p>
        ) : (
          <ul className="me-regles">
            {REGLES_AFFICHEES.map((regle) => {
              const resolution = regles[regle.cle]
              const enEdition = edition?.cle === regle.cle
              return (
                <li key={regle.cle} className="me-regle">
                  <div className="me-regle-entete">
                    <div>
                      <h3>{regle.libelle}</h3>
                      <p className="me-regle-valeur">
                        {formaterHeures(resolution?.valeur)}
                        {resolution?.valeur !== null && resolution?.valeur !== undefined && (
                          <span className="me-regle-origine">
                            {' · '}{resolution?.libelle}
                            {resolution?.dateEffet ? ` · depuis le ${resolution.dateEffet}` : ''}
                          </span>
                        )}
                      </p>
                      <p className="me-regle-aide">{regle.aide}</p>
                    </div>

                    {!enEdition && (
                      <button
                        type="button"
                        className="me-bouton me-bouton--discret"
                        onClick={() => {
                          setConfirmationModele(false)
                          setEdition({
                            cle: regle.cle,
                            valeur: resolution?.valeur ?? '',
                            dateEffet: AUJOURDHUI(),
                            confirme: false,
                          })
                        }}
                      >
                        Modifier
                      </button>
                    )}
                  </div>

                  {enEdition && (
                    <div className="me-edition">
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
                        <span>À partir du</span>
                        <input
                          type="date"
                          value={edition.dateEffet}
                          onChange={(e) => setEdition({ ...edition, dateEffet: e.target.value, confirme: false })}
                        />
                      </label>

                      {/*  La confirmation montre ce qui sera remplacé. */}
                      <div className="me-confirmation">
                        <p>
                          Remplacer <strong>{formaterHeures(resolution?.valeur)}</strong> par{' '}
                          <strong>{formaterHeures(edition.valeur)}</strong> à partir du{' '}
                          <strong>{edition.dateEffet}</strong>.
                        </p>
                        <label className="me-case">
                          <input
                            type="checkbox"
                            checked={edition.confirme}
                            onChange={(e) => setEdition({ ...edition, confirme: e.target.checked })}
                          />
                          <span>Je confirme ce changement</span>
                        </label>
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
                          disabled={!edition.confirme || enCours}
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
      </section>

      {/* ── Modèle proposé (G4b) ─────────────────────────────────── */}
      <section className="me-carte" aria-label="Modèle proposé">
        <h2 className="me-carte-titre">Modèle de seuil hebdomadaire</h2>

        <p className={`me-statut me-statut--${etatDuModele.statut_source}`}>
          {libelleStatutModele(etatDuModele.statut_source)}
          {' · '}
          {formaterHeures(etatDuModele.valeur)}
        </p>

        <p className="me-note">
          <Info size={14} aria-hidden="true" /> Le produit propose un point de
          départ ; il ne l’applique jamais tout seul, et aucun modèle n’est
          rattaché à un pays tant qu’aucune source n’a été vérifiée.
        </p>

        {!confirmationModele && etatDuModele.statut_source !== 'applique' && (
          <button type="button" className="me-bouton" onClick={() => setConfirmationModele(true)}>
            Utiliser le modèle {modele.heures} h
          </button>
        )}

        {confirmationModele && (
          <div className="me-confirmation">
            <p>
              Appliquer <strong>{modele.heures} h</strong> au seuil d’alerte
              hebdomadaire, à partir du <strong>{AUJOURDHUI()}</strong>. Un
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
                disabled={enCours}
                onClick={() =>
                  appliquer({
                    cle: 'alerte_hebdo_heures',
                    valeur: modele.heures,
                    dateEffet: AUJOURDHUI(),
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

      {/* ── Historique ───────────────────────────────────────────── */}
      <section className="me-carte" aria-label="Historique des règles">
        <h2 className="me-carte-titre">
          <History size={16} aria-hidden="true" /> Historique
        </h2>
        {historique.length === 0 ? (
          <p className="me-vide">
            Aucune règle enregistrée. Tant qu’il n’y en a pas, l’alerte retombe
            sur la valeur par défaut du produit et le dit.
          </p>
        ) : (
          <ol className="me-historique">
            {historique.slice(0, 20).map((v) => {
              const libelle = REGLES_AFFICHEES.find((r) => r.cle === v.cle)?.libelle || v.cle
              return (
                <li key={v.id}>
                  <Clock4 size={14} aria-hidden="true" />
                  <span className="me-historique-date">{v.dateEffet}</span>
                  <span className="me-historique-texte">
                    {libelle} : <strong>{formaterHeures(v.valeur)}</strong>
                    {v.employeId ? ' (valeur personnelle)' : ''}
                    {v.remplaceId ? ' — remplace la version précédente' : ' — première version'}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </main>
  )
}
