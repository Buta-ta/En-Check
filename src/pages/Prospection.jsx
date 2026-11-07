// ═══════════════════════════════════════════════════════════
// 🧭 PROSPECTION — les prospects et leurs devis, dans une pièce
//
// Deux pages vivaient côte à côte : le registre des prospects et
// l'atelier des devis. On passait de l'une à l'autre par un bouton,
// et il fallait se souvenir de ce qui avait été dit à qui. Elles
// font maintenant une page, avec trois vues :
//
//   · Prospects — le pipeline, six étapes, une fiche par entreprise ;
//   · Devis     — les devis enregistrés, leurs montants, leurs gestes ;
//   · Appels    — les scénarios de prospection téléphonique.
//
// Le motif est l'appliqué d'Abomey : des pièces de toile cousues sur
// un fond d'indigo, une couture visible, des emblèmes. Chaque carte
// est une pièce ; chaque colonne du pipeline, une bande de tissu.
//
// Aucune formule d'atelier, aucun nom de table : la page parle du
// travail commercial, pas de la base de données.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Building2, CalendarClock, Check, CheckCircle2,
  ChevronRight, Download, FileText, MessageCircle, Moon, Pencil, Phone,
  PhoneCall, Plus, Receipt, Search, Send, Sun, Trash2, TrendingUp, Users,
  X, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageCulturalBand from '../components/PageCulturalBand'
import RaccourcisPages from '../components/RaccourcisPages'
import AtelierDevis from '../components/AtelierDevis'
import { AbomeyBlasonAppliqueSvg } from '../components/AbomeySvg'
import { useTheme } from '../contexts/ThemeContext'
import {
  CONFIG_INITIAL, STATUTS_DEVIS, calculerDevis, formatF, totauxDuDevis,
} from '../lib/devis'
import {
  handleDownloadEcheancier, handleDownloadFacture, handleDownloadPDF,
} from '../lib/devisDocuments'
import {
  CANAUX, FORMES_JURIDIQUES, FORM_INITIAL, NIVEAUX_CONTACT, OBJECTIONS_UNIVERSELLES,
  POTENTIELS, SCENARIOS_PROSPECTION, SECTEURS, STATUTS,
  correspond, dateCourte, joursDeRetard, manquesDe, potentielDe, relanceDue,
  statutDe,
} from '../lib/prospection'
import './Prospection.css'

const VUES = [
  { cle: 'prospects', libelle: 'Prospects', icone: Users },
  { cle: 'devis', libelle: 'Devis', icone: FileText },
  { cle: 'appels', libelle: 'Appels', icone: PhoneCall },
]

const TON_POTENTIEL = { fort: 'vert', moyen: 'or', faible: 'faible' }

const ICONE_STATUT = {
  a_contacter: CalendarClock,
  contacte: Phone,
  en_negociation: MessageCircle,
  devis_envoye: Send,
  signe: CheckCircle2,
  perdu: XCircle,
}

const ICONE_DEVIS = {
  brouillon: FileText,
  envoye: Send,
  accepte: CheckCircle2,
  refuse: XCircle,
}

// ── les petits morceaux ─────────────────────────────────────

function Chargement({ texte = 'Chargement de la prospection…', note = 'Les fiches arrivent du serveur.' }) {
  return (
    <div className="ps-charge" role="status" aria-live="polite">
      <div className="ps-charge-chevrons" aria-hidden="true">
        <span className="ps-charge-chevron" />
        <span className="ps-charge-chevron" />
        <span className="ps-charge-chevron" />
      </div>
      <p className="ps-charge-texte">{texte}</p>
      <p className="ps-charge-note">{note}</p>
    </div>
  )
}

function Fenetre({ eyebrow, titre, surFermer, children, pied, large = false, labelledBy }) {
  const panneau = useRef(null)

  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') surFermer()
    }
    window.addEventListener('keydown', surTouche)
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [surFermer])

  useEffect(() => {
    const premier = panneau.current?.querySelector('button, input, select, textarea, [tabindex]')
    if (premier) premier.focus({ preventScroll: true })
  }, [])

  return (
    <div className="ps-voile" onMouseDown={(evenement) => { if (evenement.target === evenement.currentTarget) surFermer() }}>
      <div
        className={`ps-fenetre${large ? ' ps-fenetre--large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={panneau}
      >
        <header className="ps-fenetre-tete">
          <div>
            {eyebrow && <p className="ps-eyebrow">{eyebrow}</p>}
            <h2 className="ps-fenetre-titre" id={labelledBy}>{titre}</h2>
          </div>
          <button type="button" className="ps-fenetre-fermer" onClick={surFermer} aria-label="Fermer">
            <X size={15} />
          </button>
        </header>
        <div className="ps-fenetre-corps">{children}</div>
        {pied && <footer className="ps-fenetre-pied">{pied}</footer>}
      </div>
    </div>
  )
}

function Etiquette({ ton = 'neutre', children, icone: Icone }) {
  return (
    <span className="ps-etiquette" data-ton={ton}>
      {Icone && <Icone size={11} aria-hidden="true" />}
      {children}
    </span>
  )
}

function Champ({ libelle, children, large = false }) {
  return (
    <label className={`ps-champ${large ? ' ps-champ--large' : ''}`}>
      <span className="ps-champ-libelle">{libelle}</span>
      {children}
    </label>
  )
}

// ── la carte d'un prospect dans le pipeline ────────────────

function CarteProspect({ prospect, onOuvrir, onDevis, onModifier }) {
  const potentiel = potentielDe(prospect.potentiel)
  const enRetard = relanceDue(prospect.next_contact_date)
  const manques = manquesDe(prospect)

  return (
    <article className="ps-carte" data-potentiel={prospect.potentiel || 'aucun'}>
      <button type="button" className="ps-carte-ouvrir" onClick={() => onOuvrir(prospect)}>
        <span className="ps-carte-nom">{prospect.company_name}</span>
        <span className="ps-carte-sous">
          {[prospect.sector, prospect.city].filter(Boolean).join(' · ') || 'Secteur et ville à renseigner'}
        </span>
      </button>

      <div className="ps-carte-marques">
        {potentiel
          ? <Etiquette ton={TON_POTENTIEL[potentiel.value]}>{potentiel.label}</Etiquette>
          : <Etiquette ton="faible">Potentiel à dire</Etiquette>}
        {prospect.nb_employees_estimate > 0 && (
          <span className="ps-carte-effectif">{prospect.nb_employees_estimate} employés</span>
        )}
      </div>

      <p className="ps-carte-contact">
        {prospect.contact_name || 'Aucun contact nommé'}
        {prospect.contact_phone && <span> · {prospect.contact_phone}</span>}
      </p>

      {prospect.next_contact_date && (
        <p className="ps-carte-relance" data-etat={enRetard ? 'retard' : 'prevu'}>
          <CalendarClock size={12} aria-hidden="true" />
          {enRetard
            ? `Relance due depuis ${joursDeRetard(prospect.next_contact_date)} j`
            : `Relance le ${dateCourte(prospect.next_contact_date)}`}
        </p>
      )}

      {manques.length > 0 && (
        <p className="ps-carte-manque">Il manque : {manques.join(', ')}</p>
      )}

      <div className="ps-carte-gestes">
        <button type="button" className="ps-lien" onClick={() => onDevis(prospect)}>
          <FileText size={12} /> Devis
        </button>
        <button type="button" className="ps-lien" onClick={() => onModifier(prospect)}>
          <Pencil size={12} /> Modifier
        </button>
      </div>
    </article>
  )
}

// ── la fiche complète ──────────────────────────────────────

function FicheProspect({ prospect, devis, onFermer, onModifier, onDevis, onSupprimer, onStatut }) {
  const statut = statutDe(prospect.status)
  const devisDuProspect = devis.filter((d) => d.prospect_id === prospect.id)
  const reseaux = prospect.reseaux_sociaux || {}

  return (
    <aside className="ps-fiche" aria-label={`Fiche de ${prospect.company_name}`}>
      <header className="ps-fiche-tete">
        <div>
          <p className="ps-eyebrow">Fiche prospect</p>
          <h2 className="ps-fiche-titre">{prospect.company_name}</h2>
          <div className="ps-fiche-marques">
            <Etiquette ton="or" icone={ICONE_STATUT[prospect.status] || CalendarClock}>{statut.label}</Etiquette>
            {prospect.potentiel && (
              <Etiquette ton={TON_POTENTIEL[prospect.potentiel]}>{potentielDe(prospect.potentiel).label}</Etiquette>
            )}
            {prospect.forme_juridique && <Etiquette ton="neutre">{prospect.forme_juridique}</Etiquette>}
          </div>
        </div>
        <button type="button" className="ps-fiche-fermer" onClick={onFermer} aria-label="Fermer la fiche">
          <X size={15} />
        </button>
      </header>

      <div className="ps-fiche-corps">
        <section className="ps-fiche-section">
          <h3>Le contact</h3>
          <dl className="ps-fiche-liste">
            <div><dt>Nom</dt><dd>{prospect.contact_name || '—'}</dd></div>
            <div><dt>Rôle</dt><dd>{prospect.contact_role || '—'}</dd></div>
            <div><dt>Téléphone</dt><dd>{prospect.contact_phone || '—'}</dd></div>
            <div><dt>Courriel</dt><dd>{prospect.contact_email || '—'}</dd></div>
            <div><dt>Niveau</dt><dd>{NIVEAUX_CONTACT.find((n) => n.value === prospect.niveau_contact)?.label || '—'}</dd></div>
          </dl>
        </section>

        <section className="ps-fiche-section">
          <h3>L’entreprise</h3>
          <dl className="ps-fiche-liste">
            <div><dt>Secteur</dt><dd>{prospect.sector || '—'}</dd></div>
            <div><dt>Ville</dt><dd>{prospect.city || '—'}</dd></div>
            <div><dt>Adresse</dt><dd>{prospect.adresse || '—'}</dd></div>
            <div><dt>Effectif</dt><dd>{prospect.nb_employees_estimate ? `${prospect.nb_employees_estimate} employés` : '—'}</dd></div>
            <div><dt>Sites</dt><dd>{prospect.nb_sites_estimate || '—'}</dd></div>
            <div><dt>Chiffre d’affaires</dt><dd>{prospect.chiffre_affaires || '—'}</dd></div>
            <div><dt>Créée en</dt><dd>{prospect.date_creation || '—'}</dd></div>
            <div><dt>Concurrent en place</dt><dd>{prospect.concurrent_actuel || '—'}</dd></div>
            <div><dt>Canal</dt><dd>{prospect.canal_acquisition || '—'}</dd></div>
          </dl>
          {(prospect.website || reseaux.linkedin || reseaux.facebook) && (
            <p className="ps-fiche-liens">
              {prospect.website && (
                <a href={prospect.website} target="_blank" rel="noreferrer">{prospect.website}</a>
              )}
              {['linkedin', 'facebook', 'instagram', 'twitter'].map((cle) =>
                reseaux[cle] ? (
                  <a key={cle} href={reseaux[cle]} target="_blank" rel="noreferrer">
                    {cle.charAt(0).toUpperCase() + cle.slice(1)}
                  </a>
                ) : null,
              )}
            </p>
          )}
        </section>

        <section className="ps-fiche-section">
          <h3>Le suivi</h3>
          {prospect.next_contact_date && (
            <p className="ps-fiche-relance" data-etat={relanceDue(prospect.next_contact_date) ? 'retard' : 'prevu'}>
              <CalendarClock size={13} aria-hidden="true" />
              {relanceDue(prospect.next_contact_date)
                ? `Relance due depuis ${joursDeRetard(prospect.next_contact_date)} j`
                : `Relance prévue le ${dateCourte(prospect.next_contact_date)}`}
            </p>
          )}
          <div className="ps-fiche-etapes" role="group" aria-label="Changer l’étape du prospect">
            {STATUTS.map((item) => {
              const Icone = ICONE_STATUT[item.key]
              const actif = prospect.status === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className="ps-etape-bouton"
                  data-actif={actif ? 'oui' : 'non'}
                  onClick={() => !actif && onStatut(prospect, item.key)}
                >
                  <Icone size={12} aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </div>
          {prospect.notes && <p className="ps-fiche-notes">{prospect.notes}</p>}
        </section>

        <section className="ps-fiche-section">
          <h3>Ses devis</h3>
          {devisDuProspect.length === 0 ? (
            <p className="ps-fiche-vide">Aucun devis pour ce prospect.</p>
          ) : (
            <ul className="ps-fiche-devis">
              {devisDuProspect.map((d) => {
                const totaux = totauxDuDevis(d)
                return (
                  <li key={d.id}>
                    <strong>{d.numero}</strong>
                    <span>{formatF(totaux.totalFixeNet)} F + {formatF(totaux.totalMensuelNet)} F/mois</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <footer className="ps-fiche-pied">
        <button type="button" className="ps-bouton" onClick={() => onDevis(prospect)}>
          <FileText size={14} /> Créer son devis
        </button>
        <button type="button" className="ps-bouton-creux" onClick={() => onModifier(prospect)}>
          <Pencil size={14} /> Modifier
        </button>
        <button type="button" className="ps-bouton-discret ps-bouton-discret--danger" onClick={() => onSupprimer(prospect)}>
          <Trash2 size={14} /> Supprimer
        </button>
      </footer>
    </aside>
  )
}

// ── la fenêtre d'un prospect (création / modification) ─────

const SECTIONS_FORM = [
  { cle: 'base', libelle: 'Entreprise' },
  { cle: 'details', libelle: 'Détails' },
  { cle: 'contact', libelle: 'Contact' },
  { cle: 'suivi', libelle: 'Suivi' },
]

function FenetreProspect({ prospect, onFermer, onEnregistrer }) {
  const [section, setSection] = useState('base')
  const [etat, setEtat] = useState(() => ({ ...FORM_INITIAL, ...(prospect || {}) }))
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const changer = (cle, valeur) => setEtat((actuel) => ({ ...actuel, [cle]: valeur }))
  const changerReseau = (cle, valeur) =>
    setEtat((actuel) => ({ ...actuel, reseaux_sociaux: { ...actuel.reseaux_sociaux, [cle]: valeur } }))

  const enregistrer = async () => {
    if (!String(etat.company_name || '').trim()) {
      setSection('base')
      setErreur('Le nom de l’entreprise est obligatoire.')
      return
    }
    setEnvoi(true)
    setErreur('')
    try {
      await onEnregistrer({
        company_name: etat.company_name.trim(),
        sector: etat.sector || null,
        city: etat.city || null,
        adresse: etat.adresse || null,
        website: etat.website || null,
        google_maps_url: etat.google_maps_url || null,
        chiffre_affaires: etat.chiffre_affaires || null,
        forme_juridique: etat.forme_juridique || null,
        date_creation: etat.date_creation || null,
        reseaux_sociaux: etat.reseaux_sociaux || {},
        concurrent_actuel: etat.concurrent_actuel || null,
        potentiel: etat.potentiel || null,
        canal_acquisition: etat.canal_acquisition || null,
        niveau_contact: etat.niveau_contact || null,
        nb_employees_estimate: parseInt(etat.nb_employees_estimate, 10) || 0,
        nb_sites_estimate: parseInt(etat.nb_sites_estimate, 10) || 1,
        contact_name: etat.contact_name || null,
        contact_phone: etat.contact_phone || null,
        contact_email: etat.contact_email || null,
        contact_role: etat.contact_role || null,
        status: etat.status || 'a_contacter',
        next_contact_date: etat.next_contact_date || null,
        notes: etat.notes || null,
      })
    } catch (probleme) {
      console.error(probleme)
      setErreur('L’enregistrement a échoué. Vérifiez la connexion, puis réessayez.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Fenetre
      eyebrow={prospect ? 'Modifier' : 'Nouveau'}
      titre={prospect ? prospect.company_name : 'Ouvrir une fiche'}
      labelledBy="ps-titre-prospect"
      surFermer={onFermer}
      large
      pied={(
        <>
          <button type="button" className="ps-bouton-creux" onClick={onFermer}>Annuler</button>
          <button type="button" className="ps-bouton" onClick={enregistrer} disabled={envoi}>
            <Check size={14} /> {envoi ? 'Enregistrement…' : prospect ? 'Enregistrer les changements' : 'Ouvrir la fiche'}
          </button>
        </>
      )}
    >
      <nav className="ps-sections" aria-label="Sections de la fiche">
        {SECTIONS_FORM.map((item) => (
          <button
            key={item.cle}
            type="button"
            className="ps-section-onglet"
            data-actif={section === item.cle ? 'oui' : 'non'}
            aria-pressed={section === item.cle}
            onClick={() => setSection(item.cle)}
          >
            {item.libelle}
          </button>
        ))}
      </nav>

      {erreur && <p className="ps-erreur" role="alert"><AlertTriangle size={13} /> {erreur}</p>}

      {section === 'base' && (
        <div className="ps-grille">
          <Champ libelle="Nom de l’entreprise" large>
            <input value={etat.company_name} onChange={(e) => changer('company_name', e.target.value)} autoFocus />
          </Champ>
          <Champ libelle="Secteur">
            <select value={etat.sector} onChange={(e) => changer('sector', e.target.value)}>
              <option value="">À renseigner</option>
              {SECTEURS.map((secteur) => <option key={secteur} value={secteur}>{secteur}</option>)}
            </select>
          </Champ>
          <Champ libelle="Ville">
            <input value={etat.city} onChange={(e) => changer('city', e.target.value)} />
          </Champ>
          <Champ libelle="Effectif estimé">
            <input type="number" min="0" value={etat.nb_employees_estimate} onChange={(e) => changer('nb_employees_estimate', e.target.value)} />
          </Champ>
          <Champ libelle="Sites">
            <input type="number" min="1" value={etat.nb_sites_estimate} onChange={(e) => changer('nb_sites_estimate', e.target.value)} />
          </Champ>
          <Champ libelle="Forme juridique">
            <select value={etat.forme_juridique} onChange={(e) => changer('forme_juridique', e.target.value)}>
              <option value="">À renseigner</option>
              {FORMES_JURIDIQUES.map((forme) => <option key={forme} value={forme}>{forme}</option>)}
            </select>
          </Champ>
        </div>
      )}

      {section === 'details' && (
        <div className="ps-grille">
          <Champ libelle="Site web">
            <input value={etat.website} onChange={(e) => changer('website', e.target.value)} placeholder="https://" />
          </Champ>
          <Champ libelle="Adresse">
            <input value={etat.adresse} onChange={(e) => changer('adresse', e.target.value)} />
          </Champ>
          <Champ libelle="Chiffre d’affaires">
            <input value={etat.chiffre_affaires} onChange={(e) => changer('chiffre_affaires', e.target.value)} placeholder="450 000 000 F" />
          </Champ>
          <Champ libelle="Année de création">
            <input value={etat.date_creation} onChange={(e) => changer('date_creation', e.target.value)} placeholder="2019" />
          </Champ>
          <Champ libelle="Concurrent en place">
            <input value={etat.concurrent_actuel} onChange={(e) => changer('concurrent_actuel', e.target.value)} />
          </Champ>
          <Champ libelle="Canal d’acquisition">
            <select value={etat.canal_acquisition} onChange={(e) => changer('canal_acquisition', e.target.value)}>
              <option value="">À renseigner</option>
              {CANAUX.map((canal) => <option key={canal} value={canal}>{canal}</option>)}
            </select>
          </Champ>
          <Champ libelle="Lien LinkedIn">
            <input value={etat.reseaux_sociaux?.linkedin || ''} onChange={(e) => changerReseau('linkedin', e.target.value)} />
          </Champ>
          <Champ libelle="Lien Facebook">
            <input value={etat.reseaux_sociaux?.facebook || ''} onChange={(e) => changerReseau('facebook', e.target.value)} />
          </Champ>
          <Champ libelle="Lien Instagram">
            <input value={etat.reseaux_sociaux?.instagram || ''} onChange={(e) => changerReseau('instagram', e.target.value)} />
          </Champ>
        </div>
      )}

      {section === 'contact' && (
        <div className="ps-grille">
          <Champ libelle="Nom du contact">
            <input value={etat.contact_name} onChange={(e) => changer('contact_name', e.target.value)} />
          </Champ>
          <Champ libelle="Rôle">
            <input value={etat.contact_role} onChange={(e) => changer('contact_role', e.target.value)} placeholder="Gérante, DAF…" />
          </Champ>
          <Champ libelle="Téléphone">
            <input value={etat.contact_phone} onChange={(e) => changer('contact_phone', e.target.value)} placeholder="+229" />
          </Champ>
          <Champ libelle="Courriel">
            <input type="email" value={etat.contact_email} onChange={(e) => changer('contact_email', e.target.value)} />
          </Champ>
          <Champ libelle="Niveau du contact" large>
            <select value={etat.niveau_contact} onChange={(e) => changer('niveau_contact', e.target.value)}>
              <option value="">À renseigner</option>
              {NIVEAUX_CONTACT.map((niveau) => <option key={niveau.value} value={niveau.value}>{niveau.label}</option>)}
            </select>
          </Champ>
        </div>
      )}

      {section === 'suivi' && (
        <div className="ps-grille">
          <Champ libelle="Potentiel" large>
            <div className="ps-potentiels">
              {POTENTIELS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="ps-potentiel"
                  data-ton={TON_POTENTIEL[item.value]}
                  data-actif={etat.potentiel === item.value ? 'oui' : 'non'}
                  onClick={() => changer('potentiel', etat.potentiel === item.value ? '' : item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Champ>
          <Champ libelle="Étape">
            <select value={etat.status} onChange={(e) => changer('status', e.target.value)}>
              {STATUTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </Champ>
          <Champ libelle="Prochaine relance">
            <input type="date" value={etat.next_contact_date || ''} onChange={(e) => changer('next_contact_date', e.target.value)} />
          </Champ>
          <Champ libelle="Notes" large>
            <textarea rows={4} value={etat.notes} onChange={(e) => changer('notes', e.target.value)} />
          </Champ>
        </div>
      )}
    </Fenetre>
  )
}

// ── la fenêtre des dates d'un document ─────────────────────

function FenetreDocument({ demande, onFermer, onProduire }) {
  const [emission, setEmission] = useState(() => new Date().toISOString().slice(0, 10))
  const [echeance, setEcheance] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().slice(0, 10)
  })
  const [depart, setDepart] = useState(() => new Date().toISOString().slice(0, 10))
  const [signatureEnCheck, setSignatureEnCheck] = useState('')
  const [signatureClient, setSignatureClient] = useState('')

  const libelles = { devis: 'Devis', facture: 'Facture', echeancier: 'Échéancier' }

  return (
    <Fenetre
      eyebrow={`Document · ${demande.devis.numero}`}
      titre={libelles[demande.type]}
      labelledBy="ps-titre-document"
      surFermer={onFermer}
      pied={(
        <>
          <button type="button" className="ps-bouton-creux" onClick={onFermer}>Annuler</button>
          <button
            type="button"
            className="ps-bouton"
            onClick={() => onProduire({ type: demande.type, devis: demande.devis, emission, echeance, depart, signatureEnCheck, signatureClient })}
          >
            <Download size={14} /> Préparer le PDF
          </button>
        </>
      )}
    >
      <p className="ps-note">
        Les montants sont ceux du devis enregistré. Les dates ci-dessous figurent sur le document.
      </p>
      <div className="ps-grille">
        {demande.type === 'facture' && (
          <>
            <Champ libelle="Date d’émission">
              <input type="date" value={emission} onChange={(e) => setEmission(e.target.value)} />
            </Champ>
            <Champ libelle="Date d’échéance">
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
            </Champ>
          </>
        )}
        {demande.type === 'echeancier' && (
          <Champ libelle="Première échéance">
            <input type="date" value={depart} onChange={(e) => setDepart(e.target.value)} />
          </Champ>
        )}
        <Champ libelle="Date de signature — En-Check">
          <input type="date" value={signatureEnCheck} onChange={(e) => setSignatureEnCheck(e.target.value)} />
        </Champ>
        <Champ libelle="Date de signature — client">
          <input type="date" value={signatureClient} onChange={(e) => setSignatureClient(e.target.value)} />
        </Champ>
      </div>
    </Fenetre>
  )
}

// ═══════════════════════════════════════════════════════════
// LA PAGE
// ═══════════════════════════════════════════════════════════

export default function Prospection() {
  const navigate = useNavigate()
  const [parametres, setParametres] = useSearchParams()
  const { darkMode, toggleTheme } = useTheme()

  const [admin, setAdmin] = useState(null)
  const [prospects, setProspects] = useState([])
  const [devis, setDevis] = useState([])
  const [chargement, setChargement] = useState(true)
  const [avis, setAvis] = useState(null)

  const [vue, setVue] = useState(() => {
    const demandee = parametres.get('vue')
    return VUES.some((item) => item.cle === demandee) ? demandee : 'prospects'
  })

  const [recherche, setRecherche] = useState('')
  const [filtrePotentiel, setFiltrePotentiel] = useState('tous')
  const [rechercheDevis, setRechercheDevis] = useState('')
  const [filtreDevis, setFiltreDevis] = useState('tous')

  const [fiche, setFiche] = useState(null)
  const [fenetreProspect, setFenetreProspect] = useState(null) // { prospect } ou {}
  const [aSupprimer, setASupprimer] = useState(null)
  const [document_, setDocument] = useState(null)
  const [scenario, setScenario] = useState(null)
  const [atelier, setAtelier] = useState(null) // { devis } ou { prospect }

  // ── l'accès et les données ──────────────────────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) { navigate('/login'); return }
    let parse
    try {
      parse = JSON.parse(brut)
    } catch {
      navigate('/login')
      return
    }
    if (parse.role !== 'super_admin') { navigate('/dashboard'); return }
    setAdmin(parse)
  }, [navigate])

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const [reponseProspects, reponseDevis] = await Promise.all([
        supabase.from('prospects').select('*').order('created_at', { ascending: false }),
        supabase.from('devis').select('*').order('created_at', { ascending: false }),
      ])
      if (reponseProspects.error) throw reponseProspects.error
      if (reponseDevis.error) throw reponseDevis.error
      setProspects(reponseProspects.data || [])
      setDevis(reponseDevis.data || [])
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'Les fiches n’ont pas pu être chargées. Vérifiez la connexion, puis rechargez.' })
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    if (admin) charger()
  }, [admin, charger])

  const changerVue = (cle) => {
    setVue(cle)
    const suivant = new URLSearchParams(parametres)
    suivant.set('vue', cle)
    setParametres(suivant, { replace: true })
  }

  // ── les chiffres ────────────────────────────────────────
  const stats = useMemo(() => {
    const relances = prospects.filter((p) => relanceDue(p.next_contact_date)).length
    const ouverts = devis.filter((d) => d.status === 'brouillon' || d.status === 'envoye').length
    const signes = devis.filter((d) => d.status === 'accepte')
    const mrr = signes.reduce((somme, d) => somme + (totauxDuDevis(d).totalMensuelNet || 0), 0)
    return { prospects: prospects.length, relances, ouverts, signes: signes.length, mrr }
  }, [prospects, devis])

  const prospectsFiltres = useMemo(
    () => prospects.filter((p) =>
      correspond(p, recherche) && (filtrePotentiel === 'tous' || p.potentiel === filtrePotentiel),
    ),
    [prospects, recherche, filtrePotentiel],
  )

  const devisFiltres = useMemo(() => {
    const terme = rechercheDevis.trim().toLowerCase()
    return devis.filter((d) => {
      const client = prospects.find((p) => p.id === d.prospect_id)
      const dansTexte = !terme
        || (d.numero || '').toLowerCase().includes(terme)
        || (client?.company_name || '').toLowerCase().includes(terme)
      const dansStatut = filtreDevis === 'tous' || d.status === filtreDevis
      return dansTexte && dansStatut
    })
  }, [devis, prospects, rechercheDevis, filtreDevis])

  const colonnes = useMemo(
    () => STATUTS.map((statut) => ({
      ...statut,
      fiches: prospectsFiltres.filter((p) => (p.status || 'a_contacter') === statut.key),
    })),
    [prospectsFiltres],
  )

  // ── les gestes ──────────────────────────────────────────
  const enregistrerProspect = async (donnees) => {
    if (fenetreProspect?.prospect) {
      const { error } = await supabase
        .from('prospects')
        .update({ ...donnees, updated_at: new Date().toISOString(), updated_by: admin?.id })
        .eq('id', fenetreProspect.prospect.id)
      if (error) throw error
      setAvis({ ton: 'ok', texte: 'La fiche est à jour.' })
    } else {
      const { error } = await supabase
        .from('prospects')
        .insert({ ...donnees, created_by: admin?.id })
      if (error) throw error
      setAvis({ ton: 'ok', texte: 'Le prospect est ouvert.' })
    }
    setFenetreProspect(null)
    await charger()
  }

  const changerStatut = async (prospect, statut) => {
    const ancien = prospect.status
    setProspects((liste) => liste.map((p) => (p.id === prospect.id ? { ...p, status: statut } : p)))
    setFiche((actuelle) => (actuelle?.id === prospect.id ? { ...actuelle, status: statut } : actuelle))
    const { error } = await supabase
      .from('prospects')
      .update({ status: statut, updated_at: new Date().toISOString() })
      .eq('id', prospect.id)
    if (error) {
      setProspects((liste) => liste.map((p) => (p.id === prospect.id ? { ...p, status: ancien } : p)))
      setAvis({ ton: 'erreur', texte: 'L’étape n’a pas pu être changée.' })
      return
    }
    setAvis({ ton: 'ok', texte: `${prospect.company_name} est maintenant à l’étape « ${statutDe(statut).label} ».` })
  }

  const supprimerProspect = async () => {
    if (!aSupprimer) return
    const { error } = await supabase.from('prospects').delete().eq('id', aSupprimer.prospect.id)
    if (error) {
      setAvis({ ton: 'erreur', texte: 'La fiche n’a pas pu être supprimée.' })
      setASupprimer(null)
      return
    }
    setASupprimer(null)
    setFiche(null)
    setAvis({ ton: 'ok', texte: 'La fiche est supprimée.' })
    await charger()
  }

  const changerStatutDevis = async (ligne, statut) => {
    setDevis((liste) => liste.map((d) => (d.id === ligne.id ? { ...d, status: statut } : d)))
    const { error } = await supabase.from('devis').update({ status: statut }).eq('id', ligne.id)
    if (error) {
      setDevis((liste) => liste.map((d) => (d.id === ligne.id ? { ...d, status: ligne.status } : d)))
      setAvis({ ton: 'erreur', texte: 'Le statut du devis n’a pas pu être changé.' })
      return
    }
    setAvis({ ton: 'ok', texte: `Devis ${ligne.numero} : ${STATUTS_DEVIS.find((s) => s.key === statut)?.label}.` })
  }

  const supprimerDevis = async () => {
    if (!aSupprimer?.devis) return
    const { error } = await supabase.from('devis').delete().eq('id', aSupprimer.devis.id)
    if (error) {
      setAvis({ ton: 'erreur', texte: 'Le devis n’a pas pu être supprimé.' })
      setASupprimer(null)
      return
    }
    setASupprimer(null)
    setAvis({ ton: 'ok', texte: 'Le devis est supprimé.' })
    await charger()
  }

  const produireDocument = ({ type, devis: ligne, emission, echeance, depart, signatureEnCheck, signatureClient }) => {
    const calcul = ligne.detail_calcul?.lignesFixe
      ? ligne.detail_calcul
      : calculerDevis(ligne.config || CONFIG_INITIAL, ligne.niveau || 'moy', {})
    const totaux = totauxDuDevis(ligne)
    try {
      if (type === 'devis') {
        handleDownloadPDF(ligne, calcul, totaux, signatureEnCheck, signatureClient, prospects)
      } else if (type === 'facture') {
        handleDownloadFacture(ligne, calcul, totaux, emission, echeance, signatureEnCheck, signatureClient, false, prospects)
      } else {
        handleDownloadEcheancier(ligne, calcul, totaux, depart, {}, signatureEnCheck, signatureClient, {}, false, prospects)
      }
      setAvis({ ton: 'ok', texte: `Le ${type === 'devis' ? 'devis' : type === 'facture' ? 'facture' : 'échéancier'} s’ouvre en PDF.` })
    } catch (probleme) {
      console.error(probleme)
      setAvis({ ton: 'erreur', texte: 'Le document n’a pas pu être préparé.' })
    }
    setDocument(null)
  }

  const envoyerParWhatsApp = (ligne) => {
    const totaux = totauxDuDevis(ligne)
    const client = prospects.find((p) => p.id === ligne.prospect_id)
    const texte = [
      `DEVIS EN-CHECK — ${ligne.numero || 'BROUILLON'}`,
      client ? `Client : ${client.company_name}` : '',
      '',
      `Investissement initial : ${formatF(totaux.totalFixeNet)} FCFA`,
      `Abonnement mensuel : ${formatF(totaux.totalMensuelNet)} FCFA/mois`,
      `Engagement : ${totaux.nbMois} mois`,
      `Total : ${formatF(totaux.totalAnnuelNet)} FCFA`,
      '',
      'Devis établi par En-Check.',
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank')
  }

  // ── le rendu ────────────────────────────────────────────
  if (chargement && !admin) {
    return <div className="ps-page"><Chargement texte="Ouverture de la prospection…" note="Vérification de la session." /></div>
  }

  return (
    <div className={`ps-page${darkMode ? '' : ' ps-clair'}`}>
      <PageCulturalBand pathname="/prospection" />
      <div className="ps-couture" aria-hidden="true" />

      <header className="ps-entete">
        <button
          type="button"
          className="ps-retour"
          onClick={() => navigate('/dashboard')}
          aria-label="Revenir au tableau de bord"
          title="Tableau de bord"
        >
          <ArrowLeft size={16} />
        </button>
        <AbomeyBlasonAppliqueSvg size={56} />

        <div className="ps-titre-bloc">
          <p className="ps-eyebrow">Commercial · pipeline</p>
          <h1 className="ps-titre">Prospection<span>.</span></h1>
          <p className="ps-sous-titre">
            Les prospects et les devis, dans la même pièce. Rien ne se perd entre les deux.
          </p>
        </div>

        <div className="ps-entete-droite">
          <span className="ps-pastille">
            <i aria-hidden="true" data-etat={stats.ouverts > 0 ? 'ok' : 'faible'} />
            {stats.ouverts === 0
              ? 'aucun devis ouvert'
              : `${stats.ouverts} devis ouvert${stats.ouverts > 1 ? 's' : ''}`}
          </span>
          <button
            type="button"
            className="ps-theme"
            role="switch"
            aria-checked={darkMode}
            onClick={toggleTheme}
            aria-label={darkMode ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={darkMode ? 'Thème clair' : 'Thème sombre'}
          >
            {darkMode ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="ps-coque">
        {/* ── le seuil ─────────────────────────────────── */}
        <section className="ps-seuil" aria-label="Résumé et accès rapides">
          <div className="ps-seuil-texte">
            <p className="ps-seuil-libelle">Pipeline</p>
            <p className="ps-seuil-chiffre">
              {stats.prospects} prospects · {devis.length} devis · {stats.signes} signé{stats.signes > 1 ? 's' : ''}
            </p>
            <p className="ps-seuil-note">
              {stats.relances > 0
                ? `${stats.relances} relance${stats.relances > 1 ? 's' : ''} à faire aujourd’hui`
                : 'Aucune relance en retard'}
            </p>
          </div>
          <div className="ps-raccourcis">
            <span className="ps-seuil-libelle">Aller à</span>
            <RaccourcisPages compact excludePaths={['/prospection']} />
          </div>
        </section>

        {avis && (
          <p className="ps-avis" data-ton={avis.ton} role="status">
            {avis.ton === 'ok' ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
            {avis.texte}
            <button type="button" className="ps-avis-fermer" onClick={() => setAvis(null)} aria-label="Masquer ce message">
              <X size={12} />
            </button>
          </p>
        )}

        {/* ── les stèles ───────────────────────────────── */}
        <section className="ps-steles" aria-label="Chiffres de la prospection">
          {[
            { libelle: 'Prospects', valeur: stats.prospects, note: 'dans le pipeline', ton: 'or', icone: Users },
            { libelle: 'À relancer', valeur: stats.relances, note: 'date dépassée', ton: 'terre', icone: CalendarClock },
            { libelle: 'Devis ouverts', valeur: stats.ouverts, note: 'brouillon ou envoyé', ton: 'bleu', icone: FileText },
            { libelle: 'Signés', valeur: stats.signes, note: `${formatF(stats.mrr)} F de MRR`, ton: 'vert', icone: TrendingUp },
          ].map((item) => {
            const Icone = item.icone
            return (
              <div className="ps-stele" data-ton={item.ton} key={item.libelle}>
                <span className="ps-stele-marque"><Icone size={16} aria-hidden="true" /></span>
                <span className="ps-stele-texte">
                  <span className="ps-stele-nombre">{item.valeur}</span>
                  <span className="ps-stele-libelle">{item.libelle}</span>
                  <span className="ps-stele-note">{item.note}</span>
                </span>
              </div>
            )
          })}
        </section>

        {/* ── le sommaire ──────────────────────────────── */}
        <div className="ps-sommaire">
          <p className="ps-sommaire-titre">Sommaire</p>
          <div className="ps-sommaire-liste" role="tablist" aria-label="Vues de la prospection">
            {VUES.map((item) => {
              const Icone = item.icone
              const actif = vue === item.cle
              const compte = item.cle === 'prospects' ? prospects.length : item.cle === 'devis' ? devis.length : null
              return (
                <button
                  key={item.cle}
                  type="button"
                  role="tab"
                  id={`ps-onglet-${item.cle}`}
                  aria-selected={actif}
                  aria-controls={`ps-vue-${item.cle}`}
                  className="ps-onglet"
                  data-actif={actif ? 'oui' : 'non'}
                  onClick={() => changerVue(item.cle)}
                >
                  <Icone size={14} aria-hidden="true" />
                  {item.libelle}
                  {compte !== null && <span className="ps-onglet-compte">{compte}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {chargement ? (
          <Chargement />
        ) : (
          <>
            {/* ═══ PROSPECTS ═══ */}
            {vue === 'prospects' && (
              <section className="ps-vue" id="ps-vue-prospects" role="tabpanel" aria-labelledby="ps-onglet-prospects">
                <header className="ps-vue-tete">
                  <div>
                    <h2 className="ps-vue-titre">Pipeline</h2>
                    <p className="ps-vue-note">
                      Une fiche par entreprise, six étapes. Changer d’étape se fait dans la fiche.
                    </p>
                  </div>
                  <button type="button" className="ps-bouton" onClick={() => setFenetreProspect({})}>
                    <Plus size={15} /> Nouveau prospect
                  </button>
                </header>

                <div className="ps-barre">
                  <label className="ps-recherche">
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      placeholder="Rechercher une entreprise, une ville, un contact"
                      aria-label="Rechercher un prospect"
                    />
                    {recherche && (
                      <button type="button" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <div className="ps-filtres" role="group" aria-label="Filtrer par potentiel">
                    {[{ valeur: 'tous', label: 'Tous' }, ...POTENTIELS.map((p) => ({ valeur: p.value, label: p.label }))].map((option) => (
                      <button
                        key={option.valeur}
                        type="button"
                        className="ps-filtre"
                        data-actif={filtrePotentiel === option.valeur ? 'oui' : 'non'}
                        aria-pressed={filtrePotentiel === option.valeur}
                        onClick={() => setFiltrePotentiel(option.valeur)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {prospects.length === 0 ? (
                  <div className="ps-vide">
                    <Building2 size={34} aria-hidden="true" />
                    <p className="ps-vide-titre">Aucun prospect pour l’instant</p>
                    <p className="ps-vide-texte">
                      Une fiche demande le nom de l’entreprise et un contact. Le reste vient au fil des appels.
                    </p>
                    <button type="button" className="ps-bouton" onClick={() => setFenetreProspect({})}>
                      <Plus size={15} /> Ouvrir la première fiche
                    </button>
                  </div>
                ) : (
                  <div className="ps-pipeline">
                    {colonnes.map((colonne) => {
                      const Icone = ICONE_STATUT[colonne.key]
                      return (
                        <div className="ps-colonne" key={colonne.key} data-statut={colonne.key}>
                          <header className="ps-colonne-tete">
                            <span className="ps-colonne-titre">
                              <Icone size={12} aria-hidden="true" /> {colonne.label}
                            </span>
                            <span className="ps-colonne-compte">{colonne.fiches.length}</span>
                          </header>
                          <div className="ps-colonne-corps">
                            {colonne.fiches.length === 0 ? (
                              <p className="ps-colonne-vide">Rien à cette étape.</p>
                            ) : colonne.fiches.map((prospect) => (
                              <CarteProspect
                                key={prospect.id}
                                prospect={prospect}
                                onOuvrir={setFiche}
                                onDevis={(p) => setAtelier({ prospect: p })}
                                onModifier={(p) => setFenetreProspect({ prospect: p })}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {prospects.length > 0 && prospectsFiltres.length === 0 && (
                  <p className="ps-aucun">Aucun prospect ne correspond à cette recherche.</p>
                )}
              </section>
            )}

            {/* ═══ DEVIS ═══ */}
            {vue === 'devis' && (
              <section className="ps-vue" id="ps-vue-devis" role="tabpanel" aria-labelledby="ps-onglet-devis">
                <header className="ps-vue-tete">
                  <div>
                    <h2 className="ps-vue-titre">Devis</h2>
                    <p className="ps-vue-note">Les montants enregistrés, et les documents qui en sortent.</p>
                  </div>
                  <button type="button" className="ps-bouton" onClick={() => setAtelier({})}>
                    <Plus size={15} /> Nouveau devis
                  </button>
                </header>

                <div className="ps-barre">
                  <label className="ps-recherche">
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      value={rechercheDevis}
                      onChange={(e) => setRechercheDevis(e.target.value)}
                      placeholder="Rechercher un numéro ou un client"
                      aria-label="Rechercher un devis"
                    />
                    {rechercheDevis && (
                      <button type="button" onClick={() => setRechercheDevis('')} aria-label="Effacer la recherche">
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <div className="ps-filtres" role="group" aria-label="Filtrer par statut">
                    {[{ key: 'tous', label: 'Tous' }, ...STATUTS_DEVIS].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className="ps-filtre"
                        data-actif={filtreDevis === option.key ? 'oui' : 'non'}
                        aria-pressed={filtreDevis === option.key}
                        onClick={() => setFiltreDevis(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {devis.length === 0 ? (
                  <div className="ps-vide">
                    <FileText size={34} aria-hidden="true" />
                    <p className="ps-vide-titre">Aucun devis</p>
                    <p className="ps-vide-texte">
                      L’atelier part d’un prospect ou de rien : le barème s’applique, puis la négociation.
                    </p>
                    <button type="button" className="ps-bouton" onClick={() => setAtelier({})}>
                      <Plus size={15} /> Créer un devis
                    </button>
                  </div>
                ) : (
                  <div className="ps-devis-liste">
                    {devisFiltres.map((ligne) => {
                      const totaux = totauxDuDevis(ligne)
                      const statut = STATUTS_DEVIS.find((s) => s.key === ligne.status) || STATUTS_DEVIS[0]
                      const Icone = ICONE_DEVIS[ligne.status] || FileText
                      const client = prospects.find((p) => p.id === ligne.prospect_id)
                      return (
                        <article className="ps-devis" key={ligne.id} data-statut={ligne.status}>
                          <div className="ps-devis-identite">
                            <p className="ps-devis-numero">{ligne.numero || 'Sans numéro'}</p>
                            <p className="ps-devis-client">{client?.company_name || 'Sans prospect lié'}</p>
                          </div>

                          <Etiquette ton={ligne.status === 'accepte' ? 'vert' : ligne.status === 'refuse' ? 'terre' : ligne.status === 'envoye' ? 'bleu' : 'faible'} icone={Icone}>
                            {statut.label}
                          </Etiquette>

                          <div className="ps-devis-montants">
                            <span>
                              <span className="ps-devis-libelle">Investissement</span>
                              <strong>{formatF(totaux.totalFixeNet)} F</strong>
                            </span>
                            <span>
                              <span className="ps-devis-libelle">Mensuel</span>
                              <strong>{formatF(totaux.totalMensuelNet)} F</strong>
                            </span>
                            <span>
                              <span className="ps-devis-libelle">Engagement</span>
                              <strong>{totaux.nbMois} mois</strong>
                            </span>
                          </div>

                          <div className="ps-devis-gestes">
                            {client && (
                              <button type="button" className="ps-lien" onClick={() => setFiche(client)}>
                                <Users size={12} /> Fiche
                              </button>
                            )}
                            <label className="ps-statut-select">
                              <span className="ps-visuellement-cache">Statut du devis</span>
                              <select value={ligne.status} onChange={(e) => changerStatutDevis(ligne, e.target.value)}>
                                {STATUTS_DEVIS.map((option) => (
                                  <option key={option.key} value={option.key}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <button type="button" className="ps-lien" onClick={() => setAtelier({ devis: ligne })}>
                              <Pencil size={12} /> Modifier
                            </button>
                            <button type="button" className="ps-lien" onClick={() => setDocument({ type: 'devis', devis: ligne })}>
                              <Download size={12} /> Devis
                            </button>
                            <button type="button" className="ps-lien" onClick={() => setDocument({ type: 'facture', devis: ligne })}>
                              <Receipt size={12} /> Facture
                            </button>
                            <button type="button" className="ps-lien" onClick={() => setDocument({ type: 'echeancier', devis: ligne })}>
                              <CalendarClock size={12} /> Échéancier
                            </button>
                            <button type="button" className="ps-lien" onClick={() => envoyerParWhatsApp(ligne)}>
                              <MessageCircle size={12} /> WhatsApp
                            </button>
                            <button
                              type="button"
                              className="ps-lien ps-lien--danger"
                              onClick={() => setASupprimer({ devis: ligne })}
                            >
                              <Trash2 size={12} /> Supprimer
                            </button>
                          </div>
                        </article>
                      )
                    })}
                    {devisFiltres.length === 0 && (
                      <p className="ps-aucun">Aucun devis ne correspond à ce filtre.</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ═══ APPELS ═══ */}
            {vue === 'appels' && (
              <section className="ps-vue" id="ps-vue-appels" role="tabpanel" aria-labelledby="ps-onglet-appels">
                <header className="ps-vue-tete">
                  <div>
                    <h2 className="ps-vue-titre">Les appels</h2>
                    <p className="ps-vue-note">
                      Un scénario par métier : l’accroche, ce qu’on explique, et ce qu’on demande à la fin.
                    </p>
                  </div>
                </header>

                <div className="ps-scenarios">
                  {SCENARIOS_PROSPECTION.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="ps-scenario"
                      onClick={() => setScenario(item)}
                    >
                      <span className="ps-scenario-rond" aria-hidden="true">
                        <PhoneCall size={15} />
                      </span>
                      <span className="ps-scenario-texte">
                        <span className="ps-scenario-titre">{item.label}</span>
                        <span className="ps-scenario-note">{item.context?.[0] || 'Scénario d’appel'}</span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>

                <div className="ps-objections">
                  <h3 className="ps-objections-titre">Les objections qui reviennent</h3>
                  <ul>
                    {OBJECTIONS_UNIVERSELLES.map((item) => (
                      <li key={item.objection}>
                        <p className="ps-objection">{item.objection}</p>
                        <p className="ps-reponse">{item.reponse}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="ps-pied">
        <span className="ps-pied-marque">PROSPECTION</span>
        <span className="ps-pied-sep">·</span>
        <span>En-Check, appliqué d’Abomey</span>
        <span className="ps-pied-sep">·</span>
        <span>{stats.prospects} prospects, {devis.length} devis</span>
      </footer>

      <PageCulturalBand pathname="/prospection" placement="bottom" />

      {/* ── la fiche ──────────────────────────────────── */}
      {fiche && (
        <>
          <div className="ps-fiche-voile" onClick={() => setFiche(null)} aria-hidden="true" />
          <FicheProspect
            prospect={prospects.find((p) => p.id === fiche.id) || fiche}
            devis={devis}
            onFermer={() => setFiche(null)}
            onModifier={(p) => { setFiche(null); setFenetreProspect({ prospect: p }) }}
            onDevis={(p) => { setFiche(null); setAtelier({ prospect: p }) }}
            onSupprimer={(p) => setASupprimer({ prospect: p })}
            onStatut={changerStatut}
          />
        </>
      )}

      {/* ── les fenêtres ──────────────────────────────── */}
      {fenetreProspect && (
        <FenetreProspect
          prospect={fenetreProspect.prospect || null}
          onFermer={() => setFenetreProspect(null)}
          onEnregistrer={enregistrerProspect}
        />
      )}

      {document_ && (
        <FenetreDocument
          demande={document_}
          onFermer={() => setDocument(null)}
          onProduire={produireDocument}
        />
      )}

      {scenario && (
        <Fenetre
          eyebrow="Scénario d’appel"
          titre={scenario.label}
          labelledBy="ps-titre-scenario"
          surFermer={() => setScenario(null)}
          large
          pied={<button type="button" className="ps-bouton-creux" onClick={() => setScenario(null)}>Fermer</button>}
        >
          <div className="ps-scenario-detail">
            <section>
              <h3>Le contexte</h3>
              <ul>{scenario.context?.map((ligne) => <li key={ligne}>{ligne}</li>)}</ul>
            </section>
            <section>
              <h3>L’accroche</h3>
              <p>{scenario.accroche}</p>
            </section>
            <section>
              <h3>Ce qu’on explique</h3>
              <p>{scenario.pitch}</p>
              {scenario.argumentCle && <p className="ps-argument">{scenario.argumentCle}</p>}
              {scenario.chiffreImpact && <p className="ps-argument">{scenario.chiffreImpact}</p>}
              {scenario.argumentROI && <p className="ps-argument">{scenario.argumentROI}</p>}
            </section>
            <section>
              <h3>Ce qu’on demande</h3>
              <p>{scenario.close}</p>
            </section>
            {scenario.barrieres?.length > 0 && (
              <section>
                <h3>Les barrières</h3>
                <ul className="ps-barrieres">
                  {scenario.barrieres.map((item) => (
                    <li key={item.situation}>
                      <p className="ps-objection">{item.situation}</p>
                      <p className="ps-reponse">{item.reponse}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {scenario.objectionPrix && (
              <section>
                <h3>Quand le prix arrive</h3>
                <p>{scenario.objectionPrix}</p>
              </section>
            )}
          </div>
        </Fenetre>
      )}

      {aSupprimer && (
        <Fenetre
          eyebrow="Suppression"
          titre={aSupprimer.devis ? 'Supprimer ce devis ?' : 'Supprimer cette fiche ?'}
          labelledBy="ps-titre-suppression"
          surFermer={() => setASupprimer(null)}
          pied={(
            <>
              <button type="button" className="ps-bouton-creux" onClick={() => setASupprimer(null)}>Annuler</button>
              <button
                type="button"
                className="ps-bouton ps-bouton--danger"
                onClick={aSupprimer.devis ? supprimerDevis : supprimerProspect}
              >
                <Trash2 size={14} /> {aSupprimer.devis ? 'Supprimer le devis' : 'Supprimer la fiche'}
              </button>
            </>
          )}
        >
          <p className="ps-note">
            {aSupprimer.devis
              ? <>Le devis <strong>{aSupprimer.devis.numero}</strong> et ses montants seront perdus. Le prospect, lui, reste en place.</>
              : <>La fiche <strong>{aSupprimer.prospect.company_name}</strong> sera retirée du pipeline. Les devis déjà créés ne sont pas supprimés.</>}
          </p>
        </Fenetre>
      )}

      {/* ── l'atelier ─────────────────────────────────── */}
      {atelier && (
        <AtelierDevis
          prospects={prospects}
          devis={atelier.devis || null}
          prospectInitial={atelier.prospect || null}
          onFermer={() => setAtelier(null)}
          onEnregistre={charger}
          onAvis={setAvis}
        />
      )}
    </div>
  )
}
