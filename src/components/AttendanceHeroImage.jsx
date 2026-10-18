export default function AttendanceHeroImage() {
  return (
    <img
      className="attendance-photo"
      src="/images/dashboard-attendance.jpg"
      alt="Un employé enregistre son arrivée sur une tablette, accueilli par une collègue."
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  )
}
