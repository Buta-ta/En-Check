// ═══════════════════════════════════════════════════════════
// 🧲 LA PROXIMITÉ — « la souris se rapproche »
//
// Sa demande du 24/11 : animer les pancartes et la borne quand la souris
// approche, au niveau « spectaculaire », déclenché par une zone élargie.
//
// ⚠️ PERFORMANCE : on n'écoute PAS la souris sur toute la page. On pose
// une zone de 56 px autour de l'objet, et on n'écoute le déplacement que
// PENDANT le survol (pour incliner la pièce vers le curseur). Un seul
// écouteur actif à la fois, retiré dès la sortie.
//
// ⚠️ RESPECT : si le système demande de réduire les animations, on ne
// branche rien du tout. Ce n'est pas une option, c'est du respect.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

const ZONE = 56          // la zone invisible autour de l'objet, en px
const INCLINAISON_MAX = 6 // degrés

export default function useProximite() {
  const ref = useRef(null)
  const [actif, setActif] = useState(false)
  const [penche, setPenche] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    // le système demande-t-il moins de mouvement ?
    const calme = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calme) return undefined

    // on calcule la distance à la boîte : zéro à l'intérieur, croissante dehors
    const distance = (x, y) => {
      const r = el.getBoundingClientRect()
      const dx = Math.max(r.left - x, 0, x - r.right)
      const dy = Math.max(r.top - y, 0, y - r.bottom)
      return Math.hypot(dx, dy)
    }

    const entrer = () => setActif(true)
    const sortir = () => { setActif(false); setPenche({ x: 0, y: 0 }) }

    // l'écouteur de mouvement n'existe QUE pendant le survol
    const bouger = (e) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 0.9)))
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 0.9)))
      setPenche({ x: nx * INCLINAISON_MAX, y: -ny * INCLINAISON_MAX })
    }

    // une zone élargie : on regarde la position sur TOUT le document, mais
    // seulement pour savoir si on entre dans le rayon — et on n'y touche
    // que si l'état change, sinon React rendrait à chaque pixel.
    let dedans = false
    const suivre = (e) => {
      const d = distance(e.clientX, e.clientY)
      const proche = d <= ZONE
      if (proche !== dedans) {
        dedans = proche
        if (proche) { entrer(); window.addEventListener('pointermove', bouger, { passive: true }) }
        else { window.removeEventListener('pointermove', bouger); sortir() }
      }
    }

    // la grande zone : un seul écouteur passif, sans calcul coûteux
    document.addEventListener('pointermove', suivre, { passive: true })
    el.addEventListener('focusin', entrer)
    el.addEventListener('focusout', sortir)

    return () => {
      document.removeEventListener('pointermove', suivre)
      window.removeEventListener('pointermove', bouger)
      el.removeEventListener('focusin', entrer)
      el.removeEventListener('focusout', sortir)
    }
  }, [])

  return { ref, actif, penche }
}
