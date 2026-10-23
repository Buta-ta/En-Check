import PageCulturalBand from './PageCulturalBand'
import EnCheckBrandMark from './EnCheckBrandMark'
import './AbsencesLoadingScreen.css'

export default function AbsencesLoadingScreen({ darkMode = true, checkingAccess = false }) {
  return <section className="abs-loading" data-theme={darkMode ? 'dark' : 'light'} aria-busy="true" aria-label="Chargement des absences">
    <PageCulturalBand pathname="/absences"/>
    <div className="abs-loading-content">
      <EnCheckBrandMark size={52}/>
      <h1>{checkingAccess ? 'Vérification des accès…' : 'Préparation de vos absences et congés…'}</h1>
      <p role="status">{checkingAccess ? 'Un instant, nous vérifions votre accès à cette page.' : 'Chargement du calendrier, des demandes et des soldes disponibles.'}</p>
      <div className="abs-loading-scene" aria-hidden="true">
        <img className="abs-loading-static" src="/images/absences-loading-scene.webp" alt=""/>
        <div className="abs-loading-layers">
          <img src="/images/absences-loading-base.webp" alt=""/>
          <img className="abs-loading-paper" src="/images/absences-loading-paper.webp" alt=""/>
          <span className="abs-loading-days"/>
          <img className="abs-loading-lid" src="/images/absences-loading-lid.webp" alt=""/>
        </div>
      </div>
      <details className="abs-loading-note"><summary>À propos de cette animation</summary><p>Nous préparons l’affichage. Aucune demande n’est approuvée pendant cette animation.</p></details>
    </div>
    <PageCulturalBand pathname="/absences" placement="bottom"/>
  </section>
}
