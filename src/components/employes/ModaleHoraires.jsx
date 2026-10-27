// ═══════════════════════════════════════════════════════════════
// ENVOYER LES HORAIRES — ce que le clic doit montrer
//
// Avant, « Envoyer les horaires » ouvrait un onglet WhatsApp sans
// rien dire : si le navigateur bloquait la fenêtre, ou si l'onglet
// restait derrière, l'administrateur ne voyait rien se passer et
// croyait le bouton mort.
//
// Cette fenêtre montre d'abord le message exact, puis les moyens de
// l'envoyer. Rien ne part sans un second geste : le clic sur
// « Envoyer les horaires » ouvre toujours quelque chose de visible.
// ═══════════════════════════════════════════════════════════════

import { useRef, useState } from 'react'
import {
  AlertTriangle, Check, Copy, Mail, MessageCircle, MessageSquare,
} from 'lucide-react'
import ModaleRegistre from '../registre/ModaleRegistre'

const JOURS = {
  1: { nom: 'lundi', court: 'Lun' },
  2: { nom: 'mardi', court: 'Mar' },
  3: { nom: 'mercredi', court: 'Mer' },
  4: { nom: 'jeudi', court: 'Jeu' },
  5: { nom: 'vendredi', court: 'Ven' },
  6: { nom: 'samedi', court: 'Sam' },
  7: { nom: 'dimanche', court: 'Dim' },
}

const heure = (valeur) => (valeur ? String(valeur).slice(0, 5) : '')

function joursLisibles(jours) {
  const liste = (Array.isArray(jours) ? jours : []).map(Number).filter((jour) => JOURS[jour]).sort()
  if (liste.length === 0) return ''
  if (liste.length === 7) return 'tous les jours'
  const semaine = [1, 2, 3, 4, 5]
  if (liste.length === 5 && semaine.every((jour) => liste.includes(jour))) return 'du lundi au vendredi'
  if (liste.length === 6 && [1, 2, 3, 4, 5, 6].every((jour) => liste.includes(jour))) return 'du lundi au samedi'
  return liste.map((jour) => JOURS[jour].nom).join(', ')
}

function horairesDe(employee) {
  const planning = employee?.employee_schedules?.[0]
  const perso = Boolean(planning?.use_custom_hours)
  const grille = planning?.work_schedules

  const journee = perso
    ? (heure(planning.custom_start_time) && heure(planning.custom_end_time)
      ? `${heure(planning.custom_start_time)} – ${heure(planning.custom_end_time)}`
      : '')
    : (grille && heure(grille.start_time) && heure(grille.end_time)
      ? `${heure(grille.start_time)} – ${heure(grille.end_time)}`
      : '')

  const avecPause = perso ? planning?.custom_has_break : grille?.has_break
  const pause = avecPause
    ? (perso
      ? `${heure(planning.custom_break_start)} – ${heure(planning.custom_break_end)}`
      : `${heure(grille.break_start)} – ${heure(grille.break_end)}`)
    : ''

  const jours = perso ? joursLisibles(planning?.custom_work_days) : joursLisibles(grille?.work_days)
  const nom = perso ? 'Planning personnalisé' : grille?.name || ''

  return { journee, pause: pause === ' – ' ? '' : pause, jours, nom, defini: Boolean(journee) }
}

export default function ModaleHoraires({
  employee,
  entrepriseName,
  onDefinirHoraires,
  onClose,
}) {
  const [copie, setCopie] = useState('')
  const [bloque, setBloque] = useState(false)
  const messageRef = useRef(null)

  const horaires = horairesDe(employee)
  const nom = `${employee?.first_name || ''} ${employee?.last_name || ''}`.replace(/\s+/g, ' ').trim()
  const telephone = employee?.phone || ''
  const email = employee?.email || ''

  const lignes = [
    `Horaires de travail${entrepriseName ? ` — ${entrepriseName}` : ''}`,
    '',
    nom,
  ]
  if (employee?.matricule) lignes.push(`Matricule : ${employee.matricule}`)
  lignes.push(`Journée : ${horaires.journee || 'à définir'}`)
  if (horaires.pause) lignes.push(`Pause : ${horaires.pause}`)
  if (horaires.jours) lignes.push(`Jours : ${horaires.jours}`)
  lignes.push('', 'Envoyé depuis En-Check')
  const texte = lignes.join('\n')

  const versWhatsApp = () => {
    const chiffres = telephone.replace(/[^\d]/g, '')
    const url = `https://wa.me/${chiffres}?text=${encodeURIComponent(texte)}`
    const fenetre = window.open(url, '_blank')
    if (fenetre) {
      try { fenetre.opener = null } catch { /* certains navigateurs refusent, sans conséquence */ }
      setBloque(false)
    } else {
      setBloque(true)
    }
  }

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie('ok')
    } catch {
      const zone = messageRef.current
      if (zone && window.getSelection) {
        const selection = window.getSelection()
        const plage = document.createRange()
        plage.selectNodeContents(zone)
        selection.removeAllRanges()
        selection.addRange(plage)
      }
      setCopie('manuel')
    }
  }

  return (
    <ModaleRegistre
      eyebrow="Planning"
      titre="Envoyer les horaires"
      sousTitre={`${nom}${employee?.matricule ? ` · ${employee.matricule}` : ''}`}
      onClose={onClose}
      largeur={480}
      pied={(
        <>
          <button type="button" className="rgm-bouton rgm-bouton--second" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="rgm-bouton rgm-bouton--principal" onClick={versWhatsApp}>
            <MessageCircle size={14} /> Ouvrir WhatsApp
          </button>
        </>
      )}
    >
      <section className="rgm-section">
        <h3 className="rgm-section-titre">Ce qui sera envoyé</h3>
        <dl className="rgm-registre">
          <div className="rgm-ligne">
            <dt className="rgm-cle">Journée</dt>
            <dd className="rgm-valeur" data-mono="oui" data-etat={horaires.journee ? undefined : 'alerte'}>
              {horaires.journee || 'aucun horaire défini'}
            </dd>
          </div>
          <div className="rgm-ligne">
            <dt className="rgm-cle">Pause</dt>
            <dd className="rgm-valeur" data-mono="oui" data-etat={horaires.pause ? undefined : 'jamais'}>
              {horaires.pause || 'aucune'}
            </dd>
          </div>
          <div className="rgm-ligne">
            <dt className="rgm-cle">Jours</dt>
            <dd className="rgm-valeur" data-etat={horaires.jours ? undefined : 'jamais'}>
              {horaires.jours || 'non précisés'}
            </dd>
          </div>
          {horaires.nom && (
            <div className="rgm-ligne">
              <dt className="rgm-cle">Planning</dt>
              <dd className="rgm-valeur">{horaires.nom}</dd>
            </div>
          )}
        </dl>
      </section>

      {!horaires.defini && (
        <p className="rgm-note" data-ton="corail">
          <AlertTriangle size={14} />
          <span>
            Aucun horaire n’est défini pour cet employé : le message le dira.
            {onDefinirHoraires && (
              <>
                {' '}
                <button type="button" className="rgm-lien" onClick={onDefinirHoraires}>
                  Définir ses horaires
                </button>
              </>
            )}
          </span>
        </p>
      )}

      <section className="rgm-section">
        <h3 className="rgm-section-titre">Le message</h3>
        <p className="rgm-message" ref={messageRef}>{texte}</p>

        <div className="rgm-envois">
          <button type="button" className="rgm-bouton rgm-bouton--second" onClick={copier}>
            {copie === 'ok' ? <Check size={14} /> : <Copy size={14} />}
            {copie === 'ok' ? 'Message copié' : 'Copier'}
          </button>
          {telephone && (
            <a className="rgm-bouton rgm-bouton--second" href={`sms:${telephone}?body=${encodeURIComponent(texte)}`}>
              <MessageSquare size={14} /> SMS
            </a>
          )}
          {email && (
            <a
              className="rgm-bouton rgm-bouton--second"
              href={`mailto:${email}?subject=${encodeURIComponent('Vos horaires de travail')}&body=${encodeURIComponent(texte)}`}
            >
              <Mail size={14} /> Email
            </a>
          )}
        </div>

        {copie === 'manuel' && (
          <p className="rgm-aide" data-ton="corail">
            <AlertTriangle size={11} />
            Copie automatique indisponible : le message est sélectionné, copiez-le avec Ctrl+C.
          </p>
        )}

        {bloque && (
          <p className="rgm-note" data-ton="corail" role="alert">
            <AlertTriangle size={14} />
            <span>
              Le navigateur a bloqué l’ouverture de WhatsApp. Rien n’est perdu :
              copiez le message ci-dessus et envoyez-le depuis votre application.
            </span>
          </p>
        )}

        <p className="rgm-aide">
          {telephone
            ? `WhatsApp s’ouvre directement sur le numéro ${telephone}.`
            : 'Aucun téléphone enregistré : WhatsApp s’ouvrira sans destinataire, à vous de le choisir.'}
        </p>
      </section>
    </ModaleRegistre>
  )
}
