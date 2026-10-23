// Optional presentation enrichment; SQL remains the only source of lateness.
// Fetch only profiles already represented in the result, under the existing RLS.
export async function enrichRetardPhotos(
  retards,
  sqlRows,
  client,
  enterpriseScope,
) {
  const scopes = new Map(
    sqlRows.map((row) => [row.employe_id, row.enterprise_id]),
  )
  const ids = [
    ...new Set(retards.map((row) => row.employee.id).filter(Boolean)),
  ]
  const photos = new Map()
  for (let start = 0; start < ids.length; start += 100) {
    try {
      let query = client
        .from('employees')
        .select('id,enterprise_id,photo_url')
        .in('id', ids.slice(start, start + 100))
      if (enterpriseScope !== 'all')
        query = query.eq('enterprise_id', enterpriseScope)
      const { data, error } = await query
      if (error) continue // A missing photo must never hide valid attendance results.
      for (const profile of data || []) {
        if (
          profile.enterprise_id === scopes.get(profile.id) &&
          typeof profile.photo_url === 'string'
        )
          photos.set(profile.id, profile.photo_url)
      }
    } catch {
      /* Network failure: initials remain available. */
    }
  }
  return retards.map((row) => ({
    ...row,
    employee: {
      ...row.employee,
      photo_url: photos.get(row.employee.id) || null,
    },
  }))
}
