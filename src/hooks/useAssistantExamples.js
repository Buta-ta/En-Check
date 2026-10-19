import { useEffect, useState } from 'react'

// Only examples supported by the existing En-Check parser; no fictitious AI claims.
export const ASSISTANT_EXAMPLES = Object.freeze([
  "Retards aujourd'hui",
  "Pointages aujourd'hui",
  'Tâches urgentes',
  'Fiches de paie',
])

export default function useAssistantExamples(paused) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (paused) return
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let timer
    const sync = () => {
      clearInterval(timer)
      if (document.visibilityState === 'hidden' || media?.matches) return
      timer = setInterval(() => setIndex(value => (value + 1) % ASSISTANT_EXAMPLES.length), 4500)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    media?.addEventListener?.('change', sync)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
      media?.removeEventListener?.('change', sync)
    }
  }, [paused])
  return `Ex. : ${ASSISTANT_EXAMPLES[index]}`
}
