// ═══════════════════════════════════════════════════════════
// 🕗 LA BORNE DE POINTAGE
//
// Sa demande du 22/11 : « dessine mieux cette borne […] dans la borne
// tu mets une empreinte digitale avec un écran disant "Et
// maintenant…" ». Et : « grossis les un peu ».
//
// Le texte de l'écran est du VRAI HTML, pas du dessin : il se lit à
// toutes les tailles, il se sélectionne, et il grossit avec la
// préférence du système. Le reste est en SVG.
// ═══════════════════════════════════════════════════════════

export default function BornePointage({ taille = 96, className = '' }) {
  return (
    <div className={`borne ${className}`.trim()} style={{ '--borne-taille': `${taille}px` }}>
      <div className="borne-machine">
        {/* l'écran : « Et maintenant… » */}
        <span className="borne-ecran">Et maintenant…</span>

        {/* le capteur d'empreinte, sous l'écran */}
        <svg className="borne-empreinte" viewBox="0 0 40 30" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 22 C7.5 17.5 7.5 11 12 7.5 C16.5 4 24 4 28.5 8 C32.5 11.6 33 18 30 22.6" />
            <path d="M15 23.5 C12.5 19.6 12.8 14.4 16.2 11.8 C19.6 9.2 24.6 9.6 27 13 C29 15.9 29 20 26.6 23.4" />
            <path d="M19 24.6 C17.6 21.6 17.8 17.6 20 15.8 C22.2 14 25 14.6 26.2 17 C27.2 19 26.8 21.9 25.2 24" />
            <path d="M22.4 25.4 C21.9 23.3 22.3 20.8 23.6 19.8 C24.8 18.9 25.8 19.7 26 21.2" />
          </g>
        </svg>
      </div>

      {/* le pied de la borne : un mât, puis un socle */}
      <span className="borne-mat" aria-hidden="true" />
      <span className="borne-socle" aria-hidden="true" />
      <span className="borne-ombre" aria-hidden="true" />

      <span className="borne-mot">Borne de pointage</span>
    </div>
  )
}
