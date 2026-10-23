export default function PayslipIndicatorStatus({ status }) {
  if (!status.error && !status.loading) return null
  return <div className="sk-payslip-status" role="status">
    {status.error || 'Vérification des fiches envoyées…'}
    {status.error && <button type="button" onClick={status.refresh}>Réessayer</button>}
  </div>
}
