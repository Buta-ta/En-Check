import { ArrowRight, ShieldCheck, Percent, SlidersHorizontal, Globe2, Pencil, CircleHelp } from 'lucide-react'
import PaieCoin from './PaieCoin'
import './PaieInteriors.css'

const GUIDES = {
  settings: ['Votre bulletin, votre signature', 'Réglez le moteur de paie et les mentions de votre entreprise.', 'Exemple : ajouter un signataire et un cachet avant de publier les bulletins.'],
  profiles: ['Un profil juste pour chaque salarié', 'Définissez la base salariale et le mode de paiement, salarié par salarié.', 'Exemple : 200 000 par mois ou un taux de 1 500 par heure, dans la devise de l’entreprise.'],
  allowances: ['Primes & retenues', 'Séparez les montants récurrents des ajustements de la période.', 'Exemple : transport mensuel de 15 000, puis prime exceptionnelle de 25 000 ce mois-ci.'],
  imports: ['Vos variables, sans ressaisie', 'Importez le fichier, vérifiez les correspondances, puis enregistrez.', 'Exemple : une ligne par matricule avec les primes du mois. Un fichier choisi n’est pas encore enregistré.'],
  preview: ['Vérifiez avant de partager', 'Relisez les montants calculés avant de télécharger ou envoyer les bulletins.', 'Exemple : contrôler une prime ajoutée avant de publier la fiche dans l’espace salarié.'],
  contributions: ['Les cotisations, en clair', 'Distinguez les retenues salariales des charges payées par l’employeur.', 'Exemple : un taux de 5 % sur une base de 100 000 donne 5 000, hors plafond.'],
  taxes: ['Un barème facile à parcourir', 'Chaque ligne représente une plage de revenu et son taux. Ouvrez-la pour la modifier.', 'Exemple progressif : seule la part du revenu située dans une tranche reçoit son taux.'],
  rules: ['Du brut au revenu imposable', 'Retrouvez les abattements, les charges déductibles et la méthode d’imposition.', 'Exemple : un abattement réduit la base imposable ; il ne correspond pas à une prime versée.'],
  simulation: ['Comprendre un résultat avant de l’appliquer', 'Essayez un salaire et les paramètres familiaux disponibles sans créer de bulletin.', 'Exemple : comparer deux salaires bruts avec la configuration enregistrée.'],
}
export function PaieSectionIntro({ section }) {
  const guide = GUIDES[section]
  if (!guide) return null
  return <header className="pi-section-intro"><div><span className="pw-eyebrow">ATELIER PAIE · {section === 'settings' ? 'PARAMÈTRES' : 'VOTRE ESPACE DE TRAVAIL'}</span><h2>{guide[0]}</h2><p>{guide[1]}</p></div><details className="pi-example"><summary><CircleHelp size={16}/>Un exemple</summary><p>{guide[2]}</p></details></header>
}
export function PaieFiscalGuide() {
  return <section className="pi-guide"><header><span className="pw-eyebrow">COMPRENDRE LA FISCALITÉ</span><h2>Des règles claires, des calculs lisibles.</h2><p>Les réglages de cette entreprise alimentent le calcul des bulletins. Les exemples ci-dessous sont illustratifs, pas des barèmes officiels.</p></header>
    <div className="pi-guide-grid">{[
      [ShieldCheck, 'Cotisations sociales', 'Qui paie quoi ?', 'La part salariale est retenue sur le bulletin. La part patronale s’ajoute au coût employeur.', 'À 5 % sur 100 000, la cotisation vaut 5 000 avant plafond.'],
      [Percent, 'Barème fiscal', 'Un taux par tranche', 'En mode progressif, chaque portion du revenu imposable reçoit le taux de sa tranche.', 'Une portion de 50 000 taxée à 10 % représente 5 000 d’impôt.'],
      [SlidersHorizontal, 'Règles de calcul', 'Quelle base imposer ?', 'Les charges déductibles et les abattements ajustent la base avant application de l’impôt.', 'Un abattement de 20 % sur 100 000 réduit cette base de 20 000, hors plafond.'],
    ].map(([Icon, title, subtitle, text, example], i) => <article key={title}><PaieCoin variant={i}><Icon size={21}/></PaieCoin><span className="pi-kicker">{subtitle}</span><h3>{title}</h3><p>{text}</p><details><summary>Voir un exemple</summary><p>{example}</p></details></article>)}</div>
    <ol className="pi-calculation-path" aria-label="Parcours simplifié du calcul">{['Salaire brut', 'Cotisations', 'Revenu imposable', 'Impôt', 'Net à payer'].map((label, i) => <li key={label}><b>{i + 1}</b><span>{label}</span>{i < 4 && <ArrowRight size={14} aria-hidden="true"/>}</li>)}</ol><p className="pi-footnote">Parcours simplifié : le résultat dépend aussi des primes, retenues et règles applicables.</p>
  </section>
}
export function PaieCountrySummary({ country, currency, label, onEdit }) {
  return <button className="pi-country-summary" onClick={onEdit}><span className="pi-country-emblem"><Globe2 size={25}/></span><span className="pi-country-info"><small>CADRE FISCAL DE L’ENTREPRISE</small><strong>{label || country || 'Pays à définir'}</strong><span>{country || 'Code non défini'} · {currency || 'Devise à définir'}</span></span><span className="pi-country-edit"><Pencil size={16}/>Pays, libellé & devise<ArrowRight size={17}/></span></button>
}
export function PaieRulesSummary({ rules, contributions = [], formatMoney, onEdit }) {
  const type = { percentage: 'En pourcentage', fixed: 'Montant fixe', none: 'Sans abattement' }[rules.abattement_type] || 'Non défini'
  const method = { progressive: 'Par tranches progressives', fixed: 'Forfaitaire', flat: 'Taux unique' }[rules.tax_calculation_method] || 'Méthode non reconnue'
  const charges = Array.isArray(rules.charges_deductibles) ? rules.charges_deductibles : []
  const custom = Array.isArray(rules.custom_rules) ? rules.custom_rules : []
  return <div className="pi-rules-summary">
    <div className="pi-rules-grid">{[
      ['Abattement', type, [['Taux', `${rules.abattement_percent ?? 0} %`], ['Montant fixe', formatMoney(rules.abattement_fixed || 0)], ['Plafond', rules.max_abattement == null ? 'Non défini' : formatMoney(rules.max_abattement)]], 'Réduit la base imposable, selon les limites du régime.'],
      ['Imposition', method, [['Seuil minimum', formatMoney(rules.min_taxable_income || 0)]], 'Détermine comment le revenu imposable est taxé.'],
      ['Charges déductibles', `${charges.length} charge${charges.length > 1 ? 's' : ''}`, charges.map(code => [code, contributions.find(c => (c.contribution_code || c.code) === code)?.contribution_name || contributions.find(c => (c.contribution_code || c.code) === code)?.name || 'Charge configurée']), 'Seules les charges sélectionnées sont déduites par cette règle.'],
    ].map(([title, value, lines, help]) => <button className="pi-rule-tile" key={title} onClick={onEdit}><span className="pi-rule-heading"><span>{title}</span><Pencil size={15}/></span><strong>{value}</strong><dl>{lines.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl><small>{help}</small><span className="pi-open">Ouvrir les règles <ArrowRight size={14}/></span></button>)}</div>
    <details className="pi-custom-rules"><summary>Règles personnalisées <span>{custom.length}</span></summary>{custom.length ? custom.map((rule, i) => <div key={i}><strong>{rule.description || rule.key}</strong><span>{String(rule.value)}</span><small>Clé technique : {rule.key}</small></div>) : <p>Aucune règle complémentaire. Ajoutez uniquement des clés documentées et reconnues par le moteur.</p>}</details>
  </div>
}
