// ═══════════════════════════════════════════════════════════
// 💳 LA MARQUE DE PAIEMENT D'UNE FICHE
//
// Deux boutons et un tiroir, sortis de la page Fiches de paie pour
// qu'elle reste lisible. Ce que ce composant ne fait PAS : envoyer
// de l'argent. Il enregistre qu'un versement a eu lieu — quand, par
// quel canal et sous quelle référence — parce que « remise au salarié »
// et « payée » ne sont pas la même phrase.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { PaiementModal } from './BulletinModales'
import { marquerPaye, retirerPaiement, libelleMoyen } from '../services/paiementBulletins'

const jourLisible = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

/** La puce « Payé le … », posée à côté de « Envoyée ». */
export function BadgePaiement({ paiement, S, P }) {
  if (!paiement) return null
  return (
    <span
      style={{ ...S.sentBadge, background: P.indigo1, borderColor: P.indigo4, color: P.indigoClair }}
      title={`Payé le ${jourLisible(paiement.payeLe)}${paiement.moyen ? ` · ${libelleMoyen(paiement.moyen)}` : ''}${paiement.reference ? ` · réf. ${paiement.reference}` : ''}`}
    >
      <Wallet size={12} /> Payé le {jourLisible(paiement.payeLe)}
    </span>
  )
}

/**
 * Le bouton d'action et son tiroir.
 * `onPaiementChange(paiement | null)` remonte l'état à la page, qui
 * s'en sert pour le compteur et l'export.
 */
export function ActionPaiement({
  row,
  enterpriseId,
  periodStart,
  periodEnd,
  adminId,
  currency,
  isSent,
  paiement,
  onPaiementChange,
  S,
  P,
}) {
  const [ouvert, setOuvert] = useState(false)
  const [enregistre, setEnregistre] = useState(false)

  const ouvrir = () => {
    if (!isSent) {
      toast.error('Publiez d’abord la fiche : on ne marque pas payé ce que le salarié ne voit pas.')
      return
    }
    setOuvert(true)
  }

  const fermer = () => { if (!enregistre) setOuvert(false) }

  const enregistrer = async ({ date, methode, reference }) => {
    const employeeId = row.employee?.id
    if (!employeeId) return
    const iso = date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString()
    setEnregistre(true)
    try {
      const resultat = await marquerPaye({
        enterpriseId,
        employeeId,
        periodStart,
        periodEnd,
        paidAt: iso,
        methode,
        reference,
        adminId: adminId || null,
      })
      if (!resultat.ok) {
        toast.error(resultat.message)
        setEnregistre(false)
        return
      }
      onPaiementChange?.({ payeLe: iso, moyen: methode, reference: reference?.trim() || null })
      toast.success('Paiement enregistré')
      setOuvert(false)
    } catch (err) {
      console.error('Erreur marquage paiement:', err)
      toast.error('Le paiement n’a pas pu être enregistré')
    }
    setEnregistre(false)
  }

  const retirer = async () => {
    const employeeId = row.employee?.id
    if (!employeeId) return
    setEnregistre(true)
    try {
      const resultat = await retirerPaiement({ enterpriseId, employeeId, periodStart, periodEnd })
      if (!resultat.ok) {
        toast.error(resultat.message)
        setEnregistre(false)
        return
      }
      onPaiementChange?.(null)
      toast.success('Marque de paiement retirée')
      setOuvert(false)
    } catch (err) {
      console.error('Erreur retrait paiement:', err)
      toast.error('Le retrait n’a pas abouti')
    }
    setEnregistre(false)
  }

  return (
    <>
      <button
        onClick={ouvrir}
        style={{ ...S.sendBtn, ...(paiement ? { background: P.indigo1, borderColor: P.indigo4, color: P.indigoClair } : {}) }}
        title={paiement
          ? `Payé le ${jourLisible(paiement.payeLe)}${paiement.moyen ? ` · ${libelleMoyen(paiement.moyen)}` : ''}`
          : 'Marquer le paiement reçu'}
      >
        <Wallet size={14} /><span>{paiement ? 'Paiement' : 'Marquer payé'}</span>
      </button>

      {ouvert && (
        <PaiementModal
          employe={row.employee}
          periode={{ debut: periodStart, fin: periodEnd }}
          net={row.netSalary}
          currency={currency}
          paiement={paiement}
          onSave={enregistrer}
          onRetirer={retirer}
          onClose={fermer}
          saving={enregistre}
        />
      )}
    </>
  )
}
