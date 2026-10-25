// ═══════════════════════════════════════════════════════════
// 🔖 LE SCEAU — une case à cocher qui ressemble à un cachet
//
// La vraie case reste là : `<input type="checkbox">`, son nom
// accessible vient du libellé, le clavier et les lecteurs d'écran
// s'en servent comme partout. Seule l'apparence change — une
// pastille de cire cousue, qui se remplit d'un trait doré.
//
// On ne remplace jamais le contrôle natif : sur un formulaire
// d'administration, l'état doit rester lisible par le navigateur.
// ═══════════════════════════════════════════════════════════

import { Check } from 'lucide-react'

export default function AdminSceau({
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  className = '',
  children,
  ...reste
}) {
  return (
    <label className={`aa-sceau ${className}`.trim()}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        {...reste}
      />
      <span className="aa-sceau-pastille" aria-hidden="true">
        <Check size={11} strokeWidth={3.2} />
      </span>
      <span className="aa-sceau-texte">{children}</span>
    </label>
  )
}
