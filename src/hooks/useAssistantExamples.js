import { useEffect, useState } from 'react'

// Only examples supported by the existing En-Check parser; no fictitious AI claims.
export const ASSISTANT_EXAMPLES = Object.freeze([
  "Retards aujourd'hui",
  "Pointages aujourd'hui",
  'Tâches urgentes',
  'Fiches de paie',
])

export default function useAssistantExamples(paused) {
  const [text, setText] = useState(ASSISTANT_EXAMPLES[0])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let timer
    let index = 0
    let length = ASSISTANT_EXAMPLES[0].length
    let deleting = true
    const tick = () => {
      const phrase = ASSISTANT_EXAMPLES[index]
      length += deleting ? -1 : 1
      setText(phrase.slice(0, length))
      let delay = deleting ? 35 : 75
      if (length === 0) {
        index = (index + 1) % ASSISTANT_EXAMPLES.length
        deleting = false
        delay = 350
      } else if (length === phrase.length && !deleting) {
        deleting = true
        delay = 2200
      }
      timer = setTimeout(tick, delay)
    }
    const sync = () => {
      clearTimeout(timer)
      index = 0
      length = ASSISTANT_EXAMPLES[0].length
      deleting = true
      setText(ASSISTANT_EXAMPLES[0])
      if (paused || document.visibilityState === 'hidden' || media?.matches) return
      timer = setTimeout(tick, 2200)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    media?.addEventListener?.('change', sync)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', sync)
      media?.removeEventListener?.('change', sync)
    }
  }, [paused])
  return text || ' '
}
