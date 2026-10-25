import { supabase } from '../lib/supabase'
export const ADMIN_FIELDS =
  'id,user_id,first_name,last_name,email,username,role,enterprise_id,photo_url,is_active,created_at,last_login_at'
export async function currentAdminAccount() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Veuillez vous reconnecter.')
  const result = await supabase
    .from('admins')
    .select(ADMIN_FIELDS)
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .single()
  if (result.error || !result.data)
    throw new Error('Compte administrateur actif introuvable.')
  return result.data
}
export async function accountRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error)
    throw new Error(
      error.code === 'PGRST202'
        ? 'Cette action nécessite la migration sécurisée des comptes. Elle n’est pas encore installée sur ce serveur.'
        : error.message,
    )
  return data
}
export function filterAdminAccounts(rows, search, enterprise, status) {
  const needle = search.trim().toLocaleLowerCase('fr')
  return rows.filter(
    (row) =>
      (!enterprise || row.enterprise_id === enterprise) &&
      (!status || (status === 'active' ? row.is_active : !row.is_active)) &&
      [row.first_name, row.last_name, row.email, row.username]
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(needle),
  )
}
export async function uploadAdminAvatar(file, userId) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error('Choisissez une image JPG, PNG ou WebP de moins de 2 Mo.')
  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[file.type]
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('admin-avatars')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error)
    throw new Error(
      'Photo non envoyée. Vérifiez que le stockage sécurisé admin-avatars est installé.',
    )
  return {
    path,
    url: supabase.storage.from('admin-avatars').getPublicUrl(path).data
      .publicUrl,
  }
}
