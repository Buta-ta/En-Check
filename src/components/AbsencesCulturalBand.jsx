import '../pages/AbsencesAfroTech.css'

// Image selected by the user: contemporary Ndebele-inspired artwork, not a new pattern.
export default function AbsencesCulturalBand({ position = 'top', drawer = false }) {
  return <div className={`abs-ndebele-band abs-ndebele-${position}${drawer ? ' abs-ndebele-drawer' : ''}`} aria-hidden="true"/>
}
