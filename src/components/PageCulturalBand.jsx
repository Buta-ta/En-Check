import { KenteWovenTapestrySvg } from './AfroCulturalSvg'
import { AbomeyFriseSvg } from './AbomeySvg'
import { KorhogoFriseSvg } from './KorhogoSvg'
import { DogonFriseSvg } from './DogonSvg'
import { NsibidiFriseSvg } from './NsibidiSvg'
import { culturalMotifForPath } from './culturalMotif'
import './PageCulturalBand.css'

export default function PageCulturalBand({ pathname, placement = 'top' }) {
  const motif = culturalMotifForPath(pathname)
  return <div className={`ec-cultural-band ec-cultural-${placement}`} data-cultural-motif={motif} aria-hidden="true">
    {motif === 'kente' && <KenteWovenTapestrySvg/>}
    {motif === 'abomey' && <AbomeyFriseSvg/>}
    {motif === 'korhogo' && <KorhogoFriseSvg/>}
    {motif === 'dogon' && <DogonFriseSvg/>}
    {motif === 'nsibidi' && <NsibidiFriseSvg/>}
  </div>
}
