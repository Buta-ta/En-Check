// ═══════════════════════════════════════════════════════════
// ⌨️ HOOK TYPEWRITER - Animation machine à écrire pour placeholder
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'

const TYPING_SPEED = 80        // ms par caractère (typing)
const ERASING_SPEED = 40       // ms par caractère (erasing)
const PAUSE_DURATION = 2000    // ms pause fin de phrase

export default function useTypewriter(phrases, isActive = true) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!isActive || phrases.length === 0) {
      setCurrentText(phrases[0] || '')
      return
    }

    const currentPhrase = phrases[currentPhraseIndex]

    // Phase typing
    if (isTyping) {
      if (currentText.length < currentPhrase.length) {
        timeoutRef.current = setTimeout(() => {
          setCurrentText(currentPhrase.slice(0, currentText.length + 1))
        }, TYPING_SPEED)
      } else {
        // Fin typing, pause puis erase
        timeoutRef.current = setTimeout(() => {
          setIsTyping(false)
        }, PAUSE_DURATION)
      }
    } 
    // Phase erasing
    else {
      if (currentText.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1))
        }, ERASING_SPEED)
      } else {
        // Fin erasing, passer à la phrase suivante
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length)
        setIsTyping(true)
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [currentText, currentPhraseIndex, isTyping, phrases, isActive])

  return {
    currentPlaceholder: currentText,
    isTyping,
  }
}