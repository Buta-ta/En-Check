import { useState } from 'react'
import './EmployeeProfilePhoto.css'

function ProfileImage({ employee, className }) {
  const [failed, setFailed] = useState(false)
  const src = employee.photo_url?.trim()
  return (
    <span className={`ec-profile-photo ${className || ''}`} aria-hidden="true">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          {employee.first_name?.[0]}
          {employee.last_name?.[0]}
          {!employee.first_name && !employee.last_name ? '?' : ''}
        </>
      )}
    </span>
  )
}

// Remount the image state when the employee or its stored URL changes.
export default function EmployeeProfilePhoto({ employee, className }) {
  return (
    <ProfileImage
      key={`${employee.id}:${employee.photo_url || ''}`}
      employee={employee}
      className={className}
    />
  )
}
