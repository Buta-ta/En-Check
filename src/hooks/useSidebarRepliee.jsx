// ═══════════════════════════════════════════════════════════
// 📕 LA SIDEBAR EST-ELLE OUVERTE ? — l'état partagé
//
// Une seule sidebar dans toute l'application (sa décision du 24/11).
// Or la page Employés a SA propre coque, elle n'est pas dans le
// DashboardExperience : sans état partagé, elle aurait sa sidebar et le
// tableau de bord la sienne — deux barres, deux comportements.
//
// L'état vit donc ici, à la racine de l'application, et redescend par un
// contexte. Changer de page ne la referme pas : elle garde sa position.
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useState } from 'react'

const CLE = 'encheck.sidebar.repliee'

const Contexte = createContext({ repliee: false, basculer: () => {}, replier: () => {}, deplier: () => {} })

export function SidebarProvider({ children }) {
  const [repliee, setRepliee] = useState(() => {
    try {
      return window.localStorage.getItem(CLE) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(CLE, repliee ? '1' : '0')
    } catch {
      /* le navigateur peut refuser le stockage : on s'en passe */
    }
  }, [repliee])

  const valeur = {
    repliee,
    basculer: () => setRepliee((v) => !v),
    replier: () => setRepliee(true),
    deplier: () => setRepliee(false),
  }

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useSidebarRepliee() {
  return useContext(Contexte)
}
