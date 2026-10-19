import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AI_TEST_MESSAGES, runAiSmokeTest } from '../services/aiSmokeTest'
import './AiConnectionTest.css'

export default function AiConnectionTest() {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)
  const exhausted = report?.remaining === 0 || report?.error === 'daily_test_limit'
  const origin = window.location.origin

  async function testConnection() {
    if (pending.current || !acknowledged || exhausted) return
    pending.current = true
    setBusy(true)
    setReport(null)
    try { setReport(await runAiSmokeTest(supabase)) }
    finally { pending.current = false; setBusy(false) }
  }

  async function copyOrigin() {
    try { await navigator.clipboard.writeText(origin); setCopied(true) }
    catch { setCopied(false) }
  }

  return (
    <main className="ai-test">
      <div className="ai-test-shell">
        <Link to="/dashboard" className="ai-test-back">← Retour au tableau de bord</Link>
        <header>
          <p className="ai-test-eyebrow">SUPER-ADMINISTRATEUR · TEST ISOLÉ</p>
          <h1>Connexion Gemma & Gemini</h1>
          <p>Vérifiez les deux modèles depuis votre session En-Check. Aucune donnée RH n’est envoyée.</p>
        </header>
        <section className="ai-test-card" aria-labelledby="setup-title">
          <h2 id="setup-title">Avant le premier essai</h2>
          <p>Dans les secrets Supabase, <code>AI_SMOKE_TEST_ENABLED</code> doit valoir <code>true</code> et <code>AI_TEST_ALLOWED_ORIGINS</code> doit contenir cette adresse exacte, sans barre oblique finale :</p>
          <div className="ai-test-origin"><code>{origin}</code><button type="button" onClick={copyOrigin}>{copied ? 'Copié' : 'Copier l’adresse'}</button></div>
          <p>Pour plusieurs adresses, séparez-les par des virgules. Ne copiez aucune clé ni aucun jeton ici.</p>
          <details><summary>Réglage JWT de la fonction</summary><p>Dans les réglages de <code>test-ai-search</code>, désactivez « Verify JWT with legacy secret » si ce réglage est actif. La fonction vérifie elle-même votre session Auth et votre rôle de super-administrateur. Ne retirez pas cette vérification du code.</p></details>
        </section>
        <section className="ai-test-card" aria-labelledby="run-title">
          <h2 id="run-title">Un clic, deux appels fictifs</h2>
          <blockquote>« Affiche les sorties présumées à confirmer cette semaine. »</blockquote>
          <p>Cette demande est fixée dans le code, sans consultation de la base RH. Le test vérifie la connexion et le format, pas la qualité générale des modèles.</p>
          <p><strong>3 essais par jour UTC pour tout le projet.</strong> Chaque clic consomme un essai, même si Google ne répond pas. Aucun appel au chargement de la page, aucune relance automatique.</p>
          <label className="ai-test-consent"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} />J’ai vérifié que le projet Google reste au niveau sans frais.</label>
          <button type="button" className="ai-test-run" disabled={!acknowledged || busy || exhausted} onClick={testConnection}>
            {busy ? 'Test en cours…' : exhausted ? 'Limite quotidienne atteinte' : 'Tester Gemma et Gemini'}
          </button>
          <div aria-live="polite" aria-busy={busy}>
            {busy && <p>Veuillez patienter. Ne relancez pas le test dans un autre onglet.</p>}
            {report?.error && <p className="ai-test-error" role="alert">{AI_TEST_MESSAGES[report.error]}</p>}
            {report?.results && <>
              <div className="ai-test-results">{report.results.map(result => <article key={result.model} className={`ai-test-result ${result.success ? 'is-success' : 'is-failure'}`}>
                <h3>{result.model}</h3><strong>{result.success ? 'Test réussi' : 'À vérifier'}</strong><p>{AI_TEST_MESSAGES[result.code]}</p>
              </article>)}</div>
              <p>{report.remaining === null ? 'Nombre d’essais restants indisponible.' : `Essais restants aujourd’hui pour le projet : ${report.remaining} / 3 (au moment de cette réponse).`}</p>
            </>}
          </div>
        </section>
        <p className="ai-test-reminder">Après les essais, remettez <code>AI_SMOKE_TEST_ENABLED</code> à <code>false</code> dans Supabase. Les barres de recherche restent inchangées.</p>
      </div>
    </main>
  )
}
