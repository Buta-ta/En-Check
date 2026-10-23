import { useEffect, useRef, useState } from 'react'
import './PaieInteriors.css'

export default function PaieTaxOverrideDialog({ rows, periodStart, periodEnd, onCancel, onConfirm }) {
  const dialog = useRef(null)
  const cancelButton = useRef(null)
  const [acknowledged, setAcknowledged] = useState(false)
  useEffect(() => {
    const node = dialog.current
    const previous = document.activeElement
    node.showModal()
    cancelButton.current?.focus()
    return () => { node.close(); previous?.focus?.() }
  }, [])
  return <dialog ref={dialog} className="pw-tax-dialog" aria-labelledby="tax-override-title" aria-describedby="tax-override-warning" onCancel={event => { event.preventDefault(); onCancel() }}>
    <h2 id="tax-override-title">Envoyer malgré l’avertissement fiscal ?</h2>
    <p id="tax-override-warning">Les règles d’impôt ne sont pas encore vérifiées. Les montants peuvent être incorrects. Cet envoi rendra les fiches accessibles aux salariés, sans certifier leur conformité fiscale.</p>
    <p><strong>{rows.length} fiche(s)</strong> · du {periodStart.split('-').reverse().join('/')} au {periodEnd.split('-').reverse().join('/')}</p>
    <details><summary>Voir les salariés concernés</summary><ul>{rows.map(row => <li key={row.employee.id}>{[row.employee.first_name, row.employee.last_name].filter(Boolean).join(' ') || row.employee.id}</li>)}</ul></details>
    <label className="pw-tax-ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>Je comprends le risque et autorise exceptionnellement l’envoi de ce lot.</label>
    <details><summary>Portée de cette autorisation</summary><p>Valable pour cet envoi uniquement. Les règles restent « à vérifier ». Votre confirmation est conservée avec les fiches concernées. Les autres contrôles restent actifs et les futurs envois automatiques ne sont pas débloqués.</p></details>
    <footer><button type="button" className="paie-btn" ref={cancelButton} onClick={onCancel}>Annuler</button><button type="button" className="paie-btn pw-tax-confirm" disabled={!acknowledged} onClick={onConfirm}>Confirmer l’envoi exceptionnel</button></footer>
  </dialog>
}
