import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminMfaChallenge from '../components/AdminMfaChallenge'
export default function useAdminMfaCheckpoint() {
  const pending = useRef(null),
    [visible, setVisible] = useState(false)
  useEffect(
    () => () => {
      pending.current?.reject(new Error('Vérification interrompue.'))
      pending.current = null
    },
    [],
  )
  const ensureMfa = useCallback(async () => {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data)
      throw new Error('Impossible de vérifier la sécurité de la session.')
    if (data.nextLevel !== 'aal2' || data.currentLevel === 'aal2') return
    if (pending.current) throw new Error('Vérification déjà en cours.')
    await new Promise((resolve, reject) => {
      pending.current = { resolve, reject }
      setVisible(true)
    })
  }, [])
  const verified = async () => {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || data?.currentLevel !== 'aal2')
      throw new Error('Vérification requise.')
    pending.current?.resolve()
    pending.current = null
    setVisible(false)
  }
  const cancel = async () => {
    pending.current?.reject(new Error('Connexion annulée.'))
    pending.current = null
    setVisible(false)
    localStorage.removeItem('admin')
    await supabase.auth.signOut({ scope: 'local' })
  }
  return {
    ensureMfa,
    challenge: visible ? (
      <AdminMfaChallenge onVerified={verified} onCancel={cancel} />
    ) : null,
  }
}
