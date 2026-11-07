// ═══════════════════════════════════════════════════════════════
// L'ACCÈS À L'ESPACE EMPLOYÉ — une fenêtre, trois cas
//
//   · l'employé a déjà un compte    → on change son mot de passe ;
//   · il vient de l'ancien système  → on le migre, et on le dit ;
//   · il n'a pas encore de compte   → on le crée.
//
// Ce que la fenêtre montre en plus du formulaire : l'identifiant
// réel (matricule, téléphone, email), la dernière connexion — une
// information, pas un vide — et l'état du portail, qu'on peut
// allumer ou éteindre d'ici.
//
// Le mot de passe n'est jamais affiché en clair par défaut, jamais
// conservé côté navigateur : il part vers la fonction de la base
// qui l'enregistre en bcrypt.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import {
  AlertTriangle, Check, Eye, EyeOff, KeyRound, Loader2, Lock,
} from 'lucide-react'
import ModaleRegistre from '../registre/ModaleRegistre'

const LONGUEUR_MINIMALE = 6

export default function ModaleAccesPortail({
  employee,
  aCompte = false,
  compteSupabase = false,
  ancienSysteme = false,
  derniereConnexion = null,
  portailActif = false,
  onEnregistrer,
  onBasculerPortail,
  onClose,
}) {
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [portail, setPortail] = useState(Boolean(portailActif))

  const matricule = employee?.matricule || ''
  const telephone = employee?.phone || ''
  const email = employee?.email || ''

  const titre = compteSupabase
    ? 'Modifier le mot de passe'
    : ancienSysteme
      ? 'Migrer l’accès portail'
      : 'Créer l’accès portail'

  const action = compteSupabase ? 'Modifier' : ancienSysteme ? 'Migrer' : 'Créer'

  const assezLong = motDePasse.length >= LONGUEUR_MINIMALE
  const correspond = Boolean(confirmation) && confirmation === motDePasse
  const peutEnregistrer = assezLong && correspond && (aCompte || Boolean(matricule)) && !enregistrement

  const identifiants = useMemo(() => ([
    ['Matricule', matricule, Boolean(matricule)],
    ['Téléphone', telephone, Boolean(telephone)],
    ['Email', email, Boolean(email)],
  ]), [matricule, telephone, email])

  const enregistrer = async () => {
    if (!peutEnregistrer || !onEnregistrer) return
    setErreur('')
    setEnregistrement(true)
    const resultat = await onEnregistrer(motDePasse)
    setEnregistrement(false)
    if (resultat && resultat.ok === false) {
      setErreur(resultat.message || 'L’enregistrement n’a pas abouti. Réessayez.')
    }
  }

  const basculer = async () => {
    const cible = !portail
    setPortail(cible)
    const resultat = await onBasculerPortail?.(employee, cible)
    if (resultat && resultat.ok === false) setPortail(!cible)
  }

  const perleConnexion = derniereConnexion === 'Jamais connecté' ? 'jamais' : derniereConnexion ? 'actif' : null

  return (
    <ModaleRegistre
      eyebrow="Espace employé"
      titre={titre}
      sousTitre={`${employee?.first_name || ''} ${employee?.last_name || ''}`.trim()}
      onClose={onClose}
      largeur={470}
      pied={(
        <>
          <button type="button" className="rgm-bouton rgm-bouton--second" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="rgm-bouton rgm-bouton--principal"
            onClick={enregistrer}
            disabled={!peutEnregistrer}
          >
            {enregistrement ? <Loader2 size={14} className="rgm-tourne" /> : <KeyRound size={14} />}
            {enregistrement ? 'Enregistrement…' : action}
          </button>
        </>
      )}
    >
      <section className="rgm-section">
        <h3 className="rgm-section-titre">Identifiant de connexion</h3>
        <dl className="rgm-registre">
          {identifiants.map(([cle, valeur, renseigne]) => (
            <div key={cle} className="rgm-ligne">
              <dt className="rgm-cle">{cle}</dt>
              <dd
                className="rgm-valeur"
                data-mono={cle === 'Matricule' && renseigne ? 'oui' : undefined}
                data-etat={renseigne ? undefined : 'jamais'}
              >
                {valeur || 'non renseigné'}
              </dd>
            </div>
          ))}
        </dl>
        <p className="rgm-note">
          <Lock size={13} />
          <span>
            L’employé se connecte sur <strong>/employee/login</strong> avec son matricule,
            son téléphone ou son email, et le mot de passe défini ici.
          </span>
        </p>
      </section>

      {derniereConnexion && (
        <div className="rgm-ligne">
          <span className="rgm-cle">
            <span className="rgm-perle" data-creuse={perleConnexion === 'jamais' ? 'oui' : undefined} aria-hidden="true" />
            Dernière connexion
          </span>
          <span className="rgm-valeur" data-etat={perleConnexion}>{derniereConnexion}</span>
        </div>
      )}

      {ancienSysteme && (
        <p className="rgm-note" data-ton="corail">
          <AlertTriangle size={14} />
          <span>
            Cet employé se connecte aujourd’hui avec l’<strong>ancien système</strong>.
            Le mot de passe saisi le <strong>remplacera définitivement</strong> : prévenez-le
            au moment où vous enregistrez.
          </span>
        </p>
      )}

      {!aCompte && !matricule && (
        <p className="rgm-note" data-ton="corail">
          <AlertTriangle size={14} />
          <span>
            Aucun matricule : c’est pourtant avec lui que l’employé se connectera.
            Renseignez-le dans sa fiche avant de créer l’accès.
          </span>
        </p>
      )}

      <section className="rgm-section">
        <h3 className="rgm-section-titre">{compteSupabase ? 'Nouveau mot de passe' : 'Mot de passe'}</h3>

        <div className="rgm-champ">
          <label className="rgm-etiquette" htmlFor="rgm-mot-de-passe">
            <Lock size={12} /> Mot de passe
          </label>
          <div className="rgm-saisie-zone">
            <input
              id="rgm-mot-de-passe"
              type={visible ? 'text' : 'password'}
              className="rgm-saisie"
              value={motDePasse}
              onChange={(evenement) => setMotDePasse(evenement.target.value)}
              placeholder={`${LONGUEUR_MINIMALE} caractères au minimum`}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="rgm-oeil"
              onClick={() => setVisible((valeur) => !valeur)}
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {motDePasse.length > 0 && (
            <p className="rgm-aide" data-ton={assezLong ? 'teal' : 'corail'}>
              {assezLong ? <Check size={11} /> : <AlertTriangle size={11} />}
              {assezLong ? 'Longueur suffisante' : `Encore ${LONGUEUR_MINIMALE - motDePasse.length} caractère${LONGUEUR_MINIMALE - motDePasse.length > 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        <div className="rgm-champ">
          <label className="rgm-etiquette" htmlFor="rgm-confirmation">
            <Lock size={12} /> Confirmer le mot de passe
          </label>
          <input
            id="rgm-confirmation"
            type={visible ? 'text' : 'password'}
            className="rgm-saisie"
            style={{ paddingRight: '11px' }}
            value={confirmation}
            onChange={(evenement) => setConfirmation(evenement.target.value)}
            placeholder="Retaper le mot de passe"
            autoComplete="new-password"
          />
          {confirmation.length > 0 && (
            <p className="rgm-aide" data-ton={correspond ? 'teal' : 'corail'}>
              {correspond ? <Check size={11} /> : <AlertTriangle size={11} />}
              {correspond ? 'Les deux saisies correspondent' : 'Les deux saisies diffèrent'}
            </p>
          )}
        </div>
      </section>

      {aCompte && (
        <section className="rgm-etat">
          <span className="rgm-etat-texte">
            <span className="rgm-etat-titre">
              <span className="rgm-perle" data-creuse={portail ? undefined : 'oui'} aria-hidden="true" />
              Accès portail {portail ? 'actif' : 'fermé'}
            </span>
            <span className="rgm-etat-note">
              {portail
                ? 'L’employé peut se connecter dès maintenant.'
                : 'L’employé ne peut pas se connecter, même avec le bon mot de passe.'}
            </span>
          </span>
          <button
            type="button"
            className="rgm-bascule"
            aria-pressed={portail}
            aria-label={portail ? 'Fermer l’accès portail' : 'Ouvrir l’accès portail'}
            onClick={basculer}
          />
        </section>
      )}

      {erreur && (
        <p className="rgm-note" data-ton="corail" role="alert">
          <AlertTriangle size={14} />
          <span>{erreur}</span>
        </p>
      )}
    </ModaleRegistre>
  )
}
