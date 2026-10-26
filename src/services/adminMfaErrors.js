// Only display allowlisted diagnostics, never raw provider responses or secrets.
const messages = {
  mfa_verification_failed:
    'Code non accepté. Utilisez le code actuel de l’entrée associée au QR affiché ici. Vérifiez la date et l’heure automatiques du téléphone, puis attendez le prochain code.',
  mfa_verification_rejected:
    'Vérification refusée par le service de sécurité. Ne multipliez pas les essais ; consultez le support avec cet identifiant d’erreur uniquement.',
  mfa_challenge_expired:
    'La demande de vérification a expiré. Saisissez le nouveau code de votre authentificateur et réessayez.',
  mfa_factor_not_found:
    'Cet authentificateur n’est plus disponible. Actualisez la configuration avant de recommencer.',
  mfa_ip_address_mismatch:
    'La connexion réseau a changé pendant la vérification. Gardez le même réseau pendant un nouvel essai.',
  over_request_rate_limit:
    'Trop de tentatives. Patientez avant de réessayer ; ne relancez pas en boucle.',
  mfa_factor_name_conflict:
    'Une inscription porte déjà ce nom. Actualisez la configuration avant de recommencer.',
  too_many_enrolled_mfa_factors:
    'Le nombre maximal d’authentificateurs est atteint. Consultez les facteurs existants avant toute nouvelle inscription.',
  mfa_totp_enroll_not_enabled:
    'L’inscription TOTP est désactivée côté serveur. Contactez le support.',
  mfa_totp_verify_not_enabled:
    'La vérification TOTP est désactivée côté serveur. Contactez le support.',
  mfa_code_format:
    'Saisissez les six chiffres affichés dans votre application d’authentification, pas un code reçu par e-mail ou SMS.',
  mfa_assurance_not_confirmed:
    'La session MFA n’a pas pu être confirmée. Actualisez la configuration ou reconnectez-vous ; aucun accès supplémentaire n’est accordé.',
}
export function adminMfaErrorMessage(error) {
  if (Object.prototype.hasOwnProperty.call(messages, error?.code))
    return `${messages[error.code]} (${error.code})`
  if (error?.status === 422)
    return 'Le service Auth a refusé cette vérification (422). Ce statut ne précise pas la cause. Communiquez au support uniquement l’identifiant d’erreur et son message, jamais votre code à six chiffres, votre QR ou votre clé.'
  return 'Opération non confirmée. Vérifiez votre connexion et actualisez la configuration avant de réessayer.'
}
