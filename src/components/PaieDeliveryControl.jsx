import { Send, ShieldCheck } from 'lucide-react'
import './PaieInteriors.css'

export default function PaieDeliveryControl({ enabled, onChange, busy, notice }) {
  return <section className="pw-delivery-control" aria-label="Envoi des fiches de paie">
    <label className="pw-delivery-switch"><span className="pw-delivery-icon"><Send size={20}/></span><span><strong>Envoyer automatiquement après le calcul</strong><small>{enabled ? 'Activé : le prochain calcul publiera toutes ses fiches vérifiées.' : 'Désactivé : vous contrôlez les fiches, puis choisissez quand les envoyer.'}</small></span><input type="checkbox" role="switch" aria-label="Envoyer automatiquement après le calcul" checked={enabled} onChange={event => onChange(event.target.checked)} disabled={busy}/></label>
    <p>Pour cette entreprise et cette période uniquement. L’option se désactive au changement de période, d’entreprise ou au rechargement. Un nouveau calcul avec l’option activée met aussi à jour les fiches déjà envoyées et republie celles qui avaient été retirées.</p>
    <div className="pw-delivery-safety"><ShieldCheck size={16}/><span>Si une règle fiscale reste à vérifier, aucun bulletin du lot n’est envoyé. Publier donne accès à la fiche dans l’espace salarié : ce n’est pas un paiement.</span></div>
    {busy && <p role="status">Calcul ou envoi en cours… Gardez cette page ouverte.</p>}
    {notice && <div className={`pw-delivery-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
  </section>
}
