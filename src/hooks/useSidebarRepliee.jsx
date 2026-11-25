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

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const CLE = 'encheck.sidebar.repliee'

/*  ═══════════════════════════════════════════════════════════════════════
    « REPLIÉE » NE VEUT PAS DIRE LA MÊME CHOSE SELON L'ÉCRAN — 27/11.

    Sur un grand écran, le panneau est replié et le RAIL reste : c'est le
    registre qu'on a rangé, pas la navigation. Sur téléphone, la barre EST
    une rangée de 64 px en bas de l'écran ; « dépliée » y ouvre une liste
    qui monte par-dessus la page.

    Le défaut signalé le 27/11 (« le sidebar et son rail disparaissent »)
    tenait à ça : l'état était enregistré dans le stockage et rejoué tel
    quel d'un écran à l'autre. Un panneau laissé ouvert sur un écran large
    arrivait donc OUVERT sur un téléphone, recouvrant la page et écrasant
    la rangée. Sur mobile, la barre s'ouvre donc toujours REFERMÉE — sauf
    si l'administrateur l'a ouverte lui-même depuis ce téléphone, ce qu'on
    ne peut pas distinguer ; le choix retenu est la sûreté : fermée.
    ═══════════════════════════════════════════════════════════════════════ */
const LARGEUR_TELEPHONE = 820

const etatInitial = () => {
  try {
    if (typeof window !== 'undefined' && window.innerWidth <= LARGEUR_TELEPHONE) return true
    return window.localStorage.getItem(CLE) === '1'
  } catch {
    return false
  }
}

const Contexte = createContext({ repliee: false, basculer: () => {}, replier: () => {}, deplier: () => {} })

export function SidebarProvider({ children }) {
  const [repliee, setRepliee] = useState(etatInitial)

  /*  ON N'ENREGISTRE QUE L'ÉTAT DES GRANDS ÉCRANS — ET ON N'EFFACE RIEN.
      Le stockage sert à retrouver sa barre comme on l'avait laissée sur
      son poste de travail. Sur téléphone, l'état de départ est forcé à
      « fermée » (`etatInitial`) : la préférence enregistrée du grand
      écran n'a donc aucune influence. On la LAISSE en place — l'effacer
      ferait revenir la barre ouverte quand on relargit la fenêtre alors
      qu'on l'avait repliée. */
  useEffect(() => {
    try {
      if (window.innerWidth > LARGEUR_TELEPHONE) {
        window.localStorage.setItem(CLE, repliee ? '1' : '0')
      }
    } catch {
      /* le navigateur peut refuser le stockage : on s'en passe */
    }
  }, [repliee])

  /*  LE PASSAGE D'UN ÉCRAN À L'AUTRE.
      On ne réoriente sa fenêtre qu'à la main : soit on est sur téléphone
      et le panneau se referme, soit on repasse en large et on retrouve ce
      qu'on avait enregistré. Sans ça, une fenêtre large qu'on réduit
      gardait le panneau ouvert par-dessus la rangée. */
  useEffect(() => {
    let precedent = window.innerWidth > LARGEUR_TELEPHONE
    let memorise = false
    const surRedimensionnement = () => {
      const large = window.innerWidth > LARGEUR_TELEPHONE
      if (large === precedent) return
      if (!large) {
        memorise = true
        setRepliee(true)
      } else if (memorise) {
        memorise = false
        try {
          setRepliee(window.localStorage.getItem(CLE) === '1')
        } catch {
          /* rien de mémorisé : on laisse la barre ouverte */
        }
      }
      precedent = large
    }
    window.addEventListener('resize', surRedimensionnement)
    return () => window.removeEventListener('resize', surRedimensionnement)
  }, [])

  const basculer = useCallback(() => setRepliee((v) => !v), [])
  const replier = useCallback(() => setRepliee(true), [])
  const deplier = useCallback(() => setRepliee(false), [])

  const valeur = { repliee, basculer, replier, deplier }

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useSidebarRepliee() {
  return useContext(Contexte)
}
