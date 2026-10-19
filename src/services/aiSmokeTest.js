// No prompt, model, API key or employee data can be supplied by the caller.
export const AI_TEST_MODELS = ['gemma-4-31b-it', 'gemini-3.5-flash-lite']
export const AI_TEST_MESSAGES = {
  test_disabled: 'Le test est désactivé. Vérifiez AI_SMOKE_TEST_ENABLED dans Supabase.',
  authentication_required: 'Votre session a expiré. Reconnectez-vous à En-Check.',
  active_superadmin_required: 'Un compte super-administrateur actif lié à cette session est nécessaire.',
  authorization_unavailable: 'La vérification des droits est temporairement indisponible.',
  provider_not_configured: 'Le secret GEMINI_API_KEY manque dans Supabase.',
  quota_unavailable: 'Le compteur est indisponible. Vérifiez l’installation du SQL.',
  daily_test_limit: 'Les trois essais du projet ont été utilisés. Réessayez après minuit UTC.',
  origin_denied: 'Cette adresse du site doit être autorisée dans AI_TEST_ALLOWED_ORIGINS.',
  network: 'Connexion impossible. Vérifiez le réseau, l’origine autorisée et le réglage JWT de la fonction. Ne relancez pas plusieurs fois : un essai a peut-être été consommé.',
  unexpected_response: 'La réponse du test est inattendue. Aucun résultat brut n’est affiché.',
  ok: 'Connexion et format de réponse vérifiés.',
  unexpected_output: 'Le modèle a répondu, mais pas dans le format attendu.',
  quota_provider: 'Le quota Google de ce modèle est atteint.',
  provider_access_denied: 'Google a refusé l’accès : vérifiez la clé et les autorisations du projet.',
  model_unavailable: 'Ce modèle n’est pas accessible avec cet identifiant API.',
  provider_error: 'Le fournisseur a retourné une erreur.',
  provider_timeout: 'Le modèle n’a pas répondu dans le délai prévu.',
  provider_unreachable: 'La réponse du fournisseur n’a pas pu être obtenue.',
}
const ownCode = (code, fallback) => typeof code === 'string' && Object.hasOwn(AI_TEST_MESSAGES, code) ? code : fallback

export async function runAiSmokeTest(client) {
  // Use the existing Auth session; never ask the user to copy a token.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 35000)
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (sessionError || !sessionData?.session) return { error: 'authentication_required' }
    const { data, error } = await client.functions.invoke('test-ai-search', {
      body: { action: 'test' }, signal: controller.signal,
    })
    if (error) {
      // Only allowlisted codes from our Edge function, never error.message/raw body.
      let body
      try { body = await error.context?.json() } catch { /* CORS / gateway / network */ }
      return { error: ownCode(body?.error, 'network') }
    }
    if (data?.synthetic_test !== true || !Array.isArray(data.results) || data.results.length !== 2 ||
      !AI_TEST_MODELS.every(model => data.results.filter(r => r?.model === model).length === 1)) {
      return { error: 'unexpected_response' }
    }
    return {
      remaining: Number.isInteger(data.runs_remaining) && data.runs_remaining >= 0 && data.runs_remaining <= 2
        ? data.runs_remaining : null,
      results: AI_TEST_MODELS.map(model => {
        const result = data.results.find(r => r.model === model)
        const success = result.code === 'ok' && result.connected === true && result.interpretation_valid === true
        return { model, success, code: success ? 'ok' : result.code === 'ok'
          ? 'unexpected_output' : ownCode(result.code, 'unexpected_output') }
      }),
    }
  } catch {
    return { error: 'network' }
  } finally { clearTimeout(timer) }
}
