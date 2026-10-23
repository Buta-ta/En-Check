import { KenteWovenTapestrySvg } from './AfroCulturalSvg'
import './PageCulturalBand.css'

// Central route map: page, loading screen and assistant share the same artwork.
// Pages without a dedicated artwork retain the existing Kente identity.
export function culturalMotifForPath(pathname = '') {
  const page = pathname.split(/[?#]/)[0].split('/').filter(Boolean)[0]
  if (page === 'planning') return 'kuba'
  if (page === 'absences') return 'ndebele'
  if (['paie', 'fiches-paie', 'configuration-fiscale'].includes(page)) return 'bogolan'
  return 'kente'
}

export default function PageCulturalBand({ pathname, placement = 'top' }) {
  const motif = culturalMotifForPath(pathname)
  return <div className={`ec-cultural-band ec-cultural-${placement}`} data-cultural-motif={motif} aria-hidden="true">
    {motif === 'kente' && <KenteWovenTapestrySvg/>}
  </div>
}
