// ═══════════════════════════════════════════════════════════
// 💼 PAIE & FISCALITÉ
//
// Une seule page pour régler la paie : le moteur, la fiscalité et
// l'exploitation. Avant, « Configuration fiscale » et « Fiches de
// paie » étaient deux écrans séparés qui écrivaient pourtant le
// même enregistrement `payroll_settings`.
//
// Étape 1 : la coque et le volet fiscal. Les volets du moteur et de
// l'exploitation (profils, primes, imports, fiches générées) restent
// sur /fiches-paie le temps de la migration, et la page y renvoie.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Globe, Shield, Percent, SlidersHorizontal, Eye, Sun, Moon, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TaxationService from '../services/taxationService'
import FeatureService, { FEATURES } from '../services/featureService'
import CurrencyService from '../services/currencyService'
import { useTheme } from '../contexts/ThemeContext'
import RaccourcisPages from '../components/RaccourcisPages'
import PaieKpiCards, { totauxCotisations } from '../components/PaieKpiCards'
import { BarresTranches, DonutParts, CarteGraphique } from '../components/PaieGraphiques'
import { BogolanFriseSvg, BogolanFiligraneSvg } from '../components/BogolanMudclothSvg'
import ConfigurationFiscale from './ConfigurationFiscale'
import toast from 'react-hot-toast'
import './PaieAfroTech.css'

const ONGLETS = [
  { cle: 'apercu', libelle: 'Vue d’ensemble', icone: Globe, volet: 'pays' },
  { cle: 'contributions', libelle: 'Cotisations', icone: Shield, volet: 'contributions' },
  { cle: 'taxes', libelle: 'Barème', icone: Percent, volet: 'taxes' },
  { cle: 'rules', libelle: 'Règles fiscales', icone: SlidersHorizontal, volet: 'rules' },
  { cle: 'preview', libelle: 'Simulation', icone: Eye, volet: 'preview' },
]

const initialesDe = (prenom, nom) =>
  `${(prenom || '?')[0]}${(nom || '?')[0]}`.toUpperCase()

export default function PaieFiscalite() {
  const navigate = useNavigate()
  const { darkMode, toggleTheme } = useTheme()

  const [chargement, setChargement] = useState(true)
  const [entreprises, setEntreprises] = useState([])
  const [entrepriseId, setEntrepriseId] = useState(null)
  const [entreprise, setEntreprise] = useState(null)
  const [employes, setEmployes] = useState([])
  const [contributions, setContributions] = useState([])
  const [tranches, setTranches] = useState([])
  const [onglet, setOnglet] = useState('apercu')

  // ── Qui est connecté, et sur quelle entreprise ──────────────────────
  useEffect(() => {
    const brut = localStorage.getItem('admin')
    if (!brut) {
      navigate('/login')
      return undefined
    }

    let annule = false
    const adminData = JSON.parse(brut)

    const demarrer = async () => {
      const superAdmin = adminData.role === 'super_admin'
      let cible = adminData.selectedEnterprise?.id || adminData.enterprise_id

      if (superAdmin) {
        const { data } = await supabase
          .from('enterprises')
          .select('id, name, code, country_code, currency, fiscal_country_label')
          .eq('is_active', true)
          .order('name')
        const liste = data || []
        if (annule) return
        setEntreprises(liste)
        if (!cible && liste.length > 0) {
          const dernier =
            (adminData.id && localStorage.getItem(`last_enterprise_id_${adminData.id}`)) ||
            localStorage.getItem('last_enterprise_id')
          const choisi = (dernier && liste.find((e) => e.id === dernier)) || liste[0]
          cible = choisi?.id || null
        }
      } else {
        const liste = Array.isArray(adminData.entreprises) ? adminData.entreprises : []
        if (annule) return
        setEntreprises(liste)
        if (!cible && liste.length > 0) cible = liste[0].id
      }

      if (!cible) {
        toast.error('Aucune entreprise sélectionnée')
        navigate('/dashboard')
        return
      }

      if (!superAdmin) {
        const acces = await FeatureService.hasFeature(cible, FEATURES.FICHES_PAIE)
        if (annule) return
        if (!acces) {
          toast.error('Module fiches de paie non activé')
          navigate('/dashboard')
          return
        }
      }

      setEntrepriseId(cible)
    }

    demarrer().catch(() => {
      if (!annule) toast.error('Erreur chargement des entreprises')
    })

    return () => {
      annule = true
    }
  }, [navigate])

  // ── Les données de l'entreprise retenue ────────────────────────────
  useEffect(() => {
    if (!entrepriseId) return undefined

    let annule = false

    const charger = async () => {
      setChargement(true)
      const [ent, equipe, config] = await Promise.all([
        supabase
          .from('enterprises')
          .select('id, name, currency, country_code, fiscal_country_label')
          .eq('id', entrepriseId)
          .single()
          .catch(() => ({ data: null })),
        supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url, position, is_active')
          .eq('enterprise_id', entrepriseId)
          .eq('is_active', true)
          .order('last_name')
          .catch(() => ({ data: [] })),
        TaxationService.getEnterprisePayrollConfig(entrepriseId).catch(() => null),
      ])

      if (annule) return
      setEntreprise(ent?.data || null)
      setEmployes(equipe?.data || [])
      setContributions(config?.contributions || [])
      setTranches(config?.taxBrackets || [])
      setChargement(false)
    }

    charger().catch(() => {
      if (!annule) {
        toast.error('Erreur chargement de la configuration')
        setChargement(false)
      }
    })

    return () => {
      annule = true
    }
  }, [entrepriseId])

  const changerEntreprise = (id) => {
    if (!id || id === entrepriseId) return
    const brut = localStorage.getItem('admin')
    if (brut) {
      try {
        const adminData = JSON.parse(brut)
        const choisie = entreprises.find((e) => e.id === id)
        if (choisie) {
          const maj = { ...adminData, selectedEnterprise: choisie }
          localStorage.setItem('admin', JSON.stringify(maj))
          localStorage.setItem('last_enterprise_id', id)
          if (adminData.id) localStorage.setItem(`last_enterprise_id_${adminData.id}`, id)
        }
      } catch {
        // le réglage reste en mémoire le temps de la session
      }
    }
    setEntrepriseId(id)
  }

  const devise = CurrencyService.resolveCurrency({
    enterprise: entreprise,
    settings: { currency: entreprise?.currency },
  })

  const totaux = totauxCotisations(contributions)
  const parts = [
    { libelle: 'Part salariale', valeur: totaux.salarial, couleur: darkMode ? '#10B981' : '#26734D' },
    { libelle: 'Part patronale', valeur: totaux.patronal, couleur: darkMode ? '#A78BFA' : '#6D28D9' },
  ]
  const totalCotisations = totaux.salarial + totaux.patronal

  if (chargement && !entrepriseId) {
    return (
      <div className="paie-page" data-theme={darkMode ? 'dark' : 'light'}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--paie-text-soft)' }}>
          <RefreshCw size={22} style={{ animation: 'spin 0.9s linear infinite' }} />
          Chargement de la paie…
          <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="paie-page" data-theme={darkMode ? 'dark' : 'light'}>
      {/* ═══ BANDEAU ═══ */}
      <header className="paie-topbar">
        <div className="paie-topbar-inner">
          <div className="paie-gauche">
            <button
              type="button"
              className="paie-retour"
              onClick={() => navigate('/dashboard')}
              aria-label="Retour au tableau de bord"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="paie-marque">
              <span className="paie-marque-titre">En-Check · PAIE &amp; FISCALITÉ</span>
              <span className="paie-marque-sous">
                {devise ? `Devise ${devise} · ` : ''}Moteur de paie, fiscalité et bulletins
              </span>
            </div>

            {entreprises.length > 1 && (
              <select
                className="paie-select"
                value={entrepriseId || ''}
                onChange={(e) => changerEntreprise(e.target.value)}
                aria-label="Entreprise"
              >
                {entreprises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.currency ? ` — ${e.currency}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="paie-droite">
            <button
              type="button"
              className="paie-btn paie-theme-btn"
              onClick={toggleTheme}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              data-testid="paie-theme-toggle"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button type="button" className="paie-btn" onClick={() => navigate('/fiches-paie')}>
              <FileText size={16} /> Fiches de paie
            </button>

            <button
              type="button"
              className="paie-btn paie-btn-principal"
              onClick={() => navigate('/fiches-paie')}
            >
              Générer les bulletins
            </button>
          </div>
        </div>

        {/* Frise bogolan : la signature de cette page */}
        <div style={{ marginTop: 10, borderRadius: 999, overflow: 'hidden' }}>
          <BogolanFriseSvg hauteur={10} couleur={darkMode ? '#C25E28' : '#B86B35'} />
        </div>

        {/* Raccourcis vers les autres pages */}
        <div style={{ maxWidth: 1560, margin: '10px auto 0' }}>
          <RaccourcisPages />
        </div>
      </header>

      {/* ═══ KPI ═══ */}
      <div style={{ maxWidth: 1560, margin: '14px auto 0', padding: '0 14px' }}>
        <PaieKpiCards contributions={contributions} tranches={tranches} darkMode={darkMode} />
      </div>

      {/* ═══ ONGLETS ═══ */}
      <nav className="paie-groupes" style={{ marginLeft: 14, marginRight: 14 }} aria-label="Sections de la paie">
        <p className="paie-groupe-titre">Fiscalité — module «&nbsp;Configuration fiscale&nbsp;»</p>
        <div className="paie-onglets">
          {ONGLETS.map((item) => {
            const Icone = item.icone
            const cle = item.cle
            const actif = onglet === cle
            const compte = cle === 'contributions' ? contributions.length
              : cle === 'taxes' ? tranches.length
              : null
            return (
              <button
                key={cle}
                type="button"
                className="paie-onglet"
                data-actif={actif ? 'oui' : 'non'}
                data-testid={`paie-onglet-${cle}`}
                onClick={() => setOnglet(cle)}
              >
                <Icone size={14} />
                {item.libelle}
                {compte !== null && <span className="paie-pastille">{compte}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ═══ CONTENU ═══ */}
      <main className="paie-contenu" style={{ paddingLeft: 14, paddingRight: 14 }}>
        {onglet === 'apercu' && (
          <div className="paie-tableau">
            <CarteGraphique
              titre="Barème d’imposition"
              sousTitre={`${tranches.length} tranche${tranches.length > 1 ? 's' : ''} configurée${tranches.length > 1 ? 's' : ''}`}
              icone={{ couleur: '#9C5321' }}
              darkMode={darkMode}
            >
              <BarresTranches tranches={tranches} darkMode={darkMode} />
            </CarteGraphique>

            <CarteGraphique
              titre="Répartition des cotisations"
              sousTitre="ce que le brut finance"
              icone={{ couleur: '#26734D' }}
              darkMode={darkMode}
            >
              <DonutParts
                parts={parts}
                darkMode={darkMode}
                centre={`${totalCotisations.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
                sousCentre="du salaire brut"
              />
            </CarteGraphique>

            <CarteGraphique
              titre="Salariés concernés"
              sousTitre={`${employes.length} salarié${employes.length > 1 ? 's' : ''} actif${employes.length > 1 ? 's' : ''}`}
              icone={{ couleur: '#B86B35' }}
              darkMode={darkMode}
              action={
                <button
                  type="button"
                  className="paie-btn"
                  style={{ minHeight: 32, fontSize: 11 }}
                  onClick={() => navigate('/fiches-paie')}
                >
                  Profils
                </button>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="paie-equipe">
                {employes.slice(0, 6).map((e) => (
                  <span key={e.id} title={`${e.first_name || ''} ${e.last_name || ''}`.trim()}>
                    {e.photo_url ? (
                      <img
                        src={e.photo_url}
                        alt={`${e.first_name || ''} ${e.last_name || ''}`.trim()}
                        className="paie-avatar"
                        width={38}
                        height={38}
                      />
                    ) : (
                      <span className="paie-avatar" style={{ width: 38, height: 38, fontSize: 12 }}>
                        {initialesDe(e.first_name, e.last_name)}
                      </span>
                    )}
                  </span>
                ))}
                {employes.length > 6 && (
                  <span className="paie-avatar" style={{ width: 38, height: 38, fontSize: 11, background: 'rgba(184,107,53,0.18)', color: 'var(--paie-text-soft)' }}>
                    +{employes.length - 6}
                  </span>
                )}
                {employes.length === 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--paie-text-faint)' }}>
                    Aucun salarié actif dans cette entreprise.
                  </span>
                )}
              </div>
            </CarteGraphique>
          </div>
        )}

        {/* Le volet fiscal, rendu sans son propre bandeau ni ses onglets */}
        <ConfigurationFiscale
          integre
          ongletExterne={ONGLETS.find((o) => o.cle === onglet)?.volet || 'pays'}
          entrepriseIdForce={entrepriseId}
        />
      </main>

      <div style={{ position: 'fixed', right: 8, bottom: 8, pointerEvents: 'none', zIndex: 0 }}>
        <BogolanFiligraneSvg size={190} opacite={darkMode ? 0.06 : 0.09} couleur={darkMode ? '#C25E28' : '#B86B35'} />
      </div>
    </div>
  )
}
