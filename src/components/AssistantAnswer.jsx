const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
export default function AssistantAnswer({ answer, onChoice, onNavigate }) {
  return <section className="ec-dialogue-answer" aria-label="Réponse de l’assistant" aria-live="polite">
    <div className="ec-dialogue-speaker">✧ Assistant En-Check</div>
    {answer.source?.startsWith('Reformulation IA') && <p className="ec-dialogue-provenance">Explication IA · à vérifier</p>}
    {answer.source?.startsWith('Référence En-Check') && <p className="ec-dialogue-provenance">Référence En-Check</p>}
    <h3>{answer.title}</h3>
    <p className="ec-dialogue-text">{answer.text}</p>
    {answer.period && <p className="ec-dialogue-scope">{answer.enterprise} · {answer.period}</p>}
    {answer.warning && <p className="ec-dialogue-warning">{answer.warning}</p>}
    {answer.rows?.length > 0 && <ul className="ec-dialogue-records">{answer.rows.map(row => <li key={row.id}>
      <span className="ec-dialogue-avatar" aria-hidden="true">{initials(row.label)}</span>
      <div><strong>{row.label}</strong><span>{row.detail}</span></div>
      {row.badge && <span className={`ec-dialogue-badge ${row.badge === 'Estimation' ? 'is-estimate' : ''}`}>{row.badge}</span>}
    </li>)}</ul>}
    {answer.resultHint && <p className="ec-dialogue-scope">{answer.resultHint}</p>}
    {answer.periodHint && <p>{answer.periodHint}</p>}
    {answer.choices && <div className="ec-dialogue-followups">{answer.choices.map(choice => <button type="button" key={choice} onClick={() => onChoice(choice)}>{choice.replace(/^(Combien de pointages|Qui est en retard|Sorties présumées à confirmer) /, '')}</button>)}</div>}
    {(answer.source || answer.notes?.length) && <details className="ec-dialogue-sources">
      <summary>Sources et précisions</summary>
      {answer.source && <p>Source : {answer.source}</p>}
      {answer.updatedAt && <p>Lecture demandée à {new Date(answer.updatedAt).toLocaleTimeString('fr-FR', { timeZone: answer.timezone })} · {answer.timezone}.</p>}
      {answer.notes?.map(note => <p key={note}>{note}</p>)}
    </details>}
    {answer.path && <button className="ec-dialogue-open" type="button" onClick={() => onNavigate(answer.path)}>Ouvrir {answer.path === '/retards' ? 'Retards' : 'Pointages'} ↗</button>}
    {answer.path && <small className="ec-dialogue-page-note">Vérifiez les filtres dans la page ouverte.</small>}
  </section>
}
