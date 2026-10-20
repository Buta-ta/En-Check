import { formaterHeureLocale } from '../utils/timezoneUtils'

export default function IgnoredExitNotice({ exits = [] }) {
  return exits.map(exit => <p key={exit.id} className="pointages-estimation-note">
    Sortie enregistrée à {formaterHeureLocale(exit.check_time)}, non retenue par le filtre anti-double-scan : {Math.round(exit.ecartSecondes)} s après l’entrée (seuil {exit.seuilSecondes} s). À vérifier ; le badge est conservé.
  </p>)
}
