import { Send, ShieldCheck } from 'lucide-react'
import './PaieInteriors.css'

export default function PaieDeliveryControl({ enabled, onChange, busy, notice, onOverride }) {
  return <section className="pw-delivery-control" aria-label="Envoi des fiches de paie">
    <label className="pw-delivery-switch"><span className="pw-delivery-icon"><Send size={20}/></span><span><strong>Envoyer auto les fiches de paie</strong><small>{enabled ? 'Activé · Calculer et envoyer' : 'Désactivé · Calculer seulement'}</small></span><span className="pw-delivery-toggle"><input type="checkbox" role="switch" aria-label="Envoyer auto les fiches de paie" checked={enabled} onChange={event => onChange(event.target.checked)} disabled={busy}/><span className="pw-delivery-track" aria-hidden="true"/></span></label>
    <details className="pw-delivery-help"><summary>En savoir plus</summary>
      <p>{enabled ? 'Activé : le prochain calcul publiera toutes ses fiches vérifiées.' : 'Désactivé : vous contrôlez les fiches, puis choisissez quand les envoyer.'}</p>
      <p>Pour cette entreprise et cette période uniquement. L’option se désactive au changement de période, d’entreprise ou au rechargement. Un nouveau calcul avec l’option activée met aussi à jour les fiches déjà envoyées et republie celles qui avaient été retirées.</p>
      <div className="pw-delivery-safety"><ShieldCheck size={16}/><span>Une règle fiscale à vérifier bloque l’envoi automatique. Dans Fiches calculées, vous pouvez autoriser un envoi exceptionnel après avertissement. Publier donne accès à la fiche dans l’espace salarié : ce n’est pas un paiement.</span></div>
    </details>
    {busy && <p role="status">Calcul ou envoi en cours… Gardez cette page ouverte.</p>}
    {notice && <div className={`pw-delivery-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>
      {notice.taxReview ? <><details><summary>Envoi bloqué : règles fiscales à vérifier</summary><p>{notice.text}</p></details>{onOverride ? <button type="button" className="paie-btn" disabled={busy} onClick={onOverride}>Envoyer malgré l’avertissement…</button> : <p>Ouvrez Fiches calculées pour un envoi exceptionnel avec confirmation.</p>}</> : notice.text}
    </div>}
  </section>
}
