// ═══════════════════════════════════════════════════════════
// 🧮 L'ATELIER DE DEVIS — quatre étapes, un seul chiffre final
//
// L'atelier reprend l'arithmétique de l'ancienne page Devis telle
// qu'elle était : le barème, le scoring, la négociation ligne à
// ligne, les remises, l'engagement et les échéances. Rien n'est
// recalculé ici — `src/lib/devis.js` décide, l'atelier montre.
//
//   ① Prospect & scoring  — à qui, et avec quel profil
//   ② Configuration       — sites, employés, machines, options
//   ③ Négociation         — ce qui se discute, et sous quel plancher
//   ④ Résultat            — les totaux, les notes, l'enregistrement
//
// Le dessin est celui de la page : fonds indigo, pièces de toile
// cousues, couture visible. L'atelier est une pièce de la page, pas
// une autre application.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Save,
  MessageCircle, Users, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  CONFIG_INITIAL, CRITERES_SCORING, ENGAGEMENTS, NEGO_LIGNE_INITIAL,
  MONTANT_CONVENU_INITIAL, SCORING_INITIAL, STATUTS_DEVIS,
  TOTAL_CATEGORIE_INITIAL, appliquerPriorites, calculerDevis, calculerScore,
  formatF, getAlerteMinDetail, getEngagementConfig, prixAutoUnitaire,
} from '../lib/devis'
import { handleDownloadPDF } from '../lib/devisDocuments'
import './AtelierDevis.css'

const ETAPES = [
  { num: 1, label: 'Prospect & scoring' },
  { num: 2, label: 'Configuration' },
  { num: 3, label: 'Négociation' },
  { num: 4, label: 'Résultat' },
]

const CHAMPS = [
  { key: 'nb_sites', label: 'Sites', min: 1 },
  { key: 'nb_employes', label: 'Employés', min: 1 },
  { key: 'nb_machines', label: 'Machines', min: 1 },
  { key: 'nb_admins', label: 'Admins', min: 1 },
  { key: 'nb_admins_supp', label: 'Admins en plus', min: 0 },
  { key: 'nb_employes_a_former', label: 'Employés à former', min: 0 },
]

// `unite` dit sur quoi porte la quantité : les employés ou les sites.
const OPTIONS = [
  { key: 'photo_pointage', label: 'Photo au pointage', unite: 'employes' },
  { key: 'planning', label: 'Planning', unite: 'sites' },
  { key: 'retards', label: 'Retards', unite: 'sites' },
  { key: 'modifier_pointages', label: 'Modifier les pointages', unite: 'employes' },
  { key: 'absences_conges', label: 'Absences et congés', unite: 'sites' },
  { key: 'heures_supplementaires', label: 'Heures supplémentaires', unite: 'sites' },
  { key: 'espace_employe', label: 'Espace employé', unite: 'employes' },
  { key: 'geofencing', label: 'Geofencing', unite: 'employes' },
  { key: 'maps_temps_reel', label: 'Carte en temps réel', unite: 'employes' },
  { key: 'reconnaissance_faciale', label: 'Reconnaissance faciale', unite: 'employes' },
  { key: 'fiches_paie', label: 'Fiches de paie', unite: 'employes' },
  { key: 'jours_feries', label: 'Jours fériés', unite: 'sites', gratuit: true },
]

const TON_NIVEAU = { mini: 'vert', moy: 'or', max: 'terre' }

async function numeroSuivant() {
  const annee = new Date().getFullYear()
  const { count } = await supabase.from('devis').select('*', { count: 'exact', head: true })
  const rang = ((count || 0) + 1).toString().padStart(3, '0')
  return `DEV-${annee}-${rang}`
}

export default function AtelierDevis({ prospects = [], devis = null, prospectInitial = null, onFermer, onEnregistre, onAvis }) {
  const brouillon = devis?.detail_calcul || {}

  const [etape, setEtape] = useState(1)
  const [prospectId, setProspectId] = useState(devis?.prospect_id || prospectInitial?.id || '')
  const [scoring, setScoring] = useState(devis?.scoring || SCORING_INITIAL)
  const [niveauSuggere, setNiveauSuggere] = useState(devis ? calculerScore(devis.scoring || SCORING_INITIAL) : null)
  const [niveau, setNiveau] = useState(devis?.niveau || 'moy')
  const [config, setConfig] = useState(devis?.config || CONFIG_INITIAL)
  const [negoLigne, setNegoLigne] = useState(brouillon.nego_ligne || NEGO_LIGNE_INITIAL)
  const [totalCategorie, setTotalCategorie] = useState(brouillon.total_categorie || TOTAL_CATEGORIE_INITIAL)
  const [montantConvenu, setMontantConvenu] = useState(brouillon.montant_convenu || MONTANT_CONVENU_INITIAL)
  const [remiseFixe, setRemiseFixe] = useState(devis?.remise_fixe_pct || 0)
  const [remiseMensuel, setRemiseMensuel] = useState(devis?.remise_mensuel_pct || 0)
  const [moisGratuit, setMoisGratuit] = useState(Boolean(devis?.mois_gratuit))
  const [engagement, setEngagement] = useState(devis?.engagement || 'annuel')
  const [paiementFois, setPaiementFois] = useState(devis?.paiement_fois || 1)
  const [notes, setNotes] = useState(devis?.notes || '')
  const [signatureEnCheck, setSignatureEnCheck] = useState('')
  const [signatureClient, setSignatureClient] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState('')

  const prospect = useMemo(
    () => prospects.find((p) => p.id === prospectId) || null,
    [prospects, prospectId],
  )

  const calcul = useMemo(
    () => calculerDevis(config, niveau, negoLigne),
    [config, niveau, negoLigne],
  )

  const totaux = useMemo(
    () => appliquerPriorites(calcul, {
      engagement, moisGratuit, remiseFixe, remiseMensuel,
      montantConvenu, totalCategorie, paiementFois,
    }),
    [calcul, engagement, moisGratuit, remiseFixe, remiseMensuel, montantConvenu, totalCategorie, paiementFois],
  )

  const engagementConfig = getEngagementConfig(engagement)
  const lignesAlertes = [...calcul.lignesFixe, ...calcul.lignesMensuel].filter((l) => l.sousMinimum)
  const nbOptions = Object.values(config.options).filter(Boolean).length

  // La fenêtre se ferme à Échap, comme toutes celles de la page.
  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape' && !enregistrement) onFermer()
    }
    window.addEventListener('keydown', surTouche)
    const ancien = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.body.style.overflow = ancien
    }
  }, [onFermer, enregistrement])

  // Le prospect choisi remplit les effectifs : c'est ce qu'il nous a dit.
  useEffect(() => {
    if (!prospect) return
    setConfig((actuel) => ({
      ...actuel,
      nb_employes: prospect.nb_employees_estimate || actuel.nb_employes,
      nb_employes_a_former: prospect.nb_employees_estimate || actuel.nb_employes_a_former,
      nb_sites: prospect.nb_sites_estimate || actuel.nb_sites,
    }))
  }, [prospect])

  const choisirScore = (critere, valeur) => {
    const suivant = { ...scoring, [critere]: valeur }
    setScoring(suivant)
    const suggestion = calculerScore(suivant)
    setNiveauSuggere(suggestion)
    if (suggestion) setNiveau(suggestion)
  }

  const changerConfig = (champ, valeur) => {
    setConfig((actuel) => ({ ...actuel, [champ]: valeur }))
  }

  const basculerOption = (cle) => {
    setConfig((actuel) => ({
      ...actuel,
      options: { ...actuel.options, [cle]: !actuel.options[cle] },
    }))
  }

  const ecrireNego = (cle, champ, valeur) => {
    setNegoLigne((actuel) => ({
      ...actuel,
      [cle]: { ...(actuel[cle] || { unitaire: '', total: '' }), [champ]: valeur },
    }))
  }

  const effacerNego = (cle) => {
    setNegoLigne((actuel) => ({ ...actuel, [cle]: { unitaire: '', total: '' } }))
  }

  const quantiteOption = (option) =>
    option.unite === 'employes' ? config.nb_employes : config.nb_sites

  const prixOption = (option) => {
    if (option.gratuit) return 0
    return prixAutoUnitaire(option.key, niveau, config.type_pointage) * quantiteOption(option)
  }

  const devisCourant = () => ({
    numero: devis?.numero || `DEV-${new Date().getFullYear()}-BROUILLON`,
    prospect_id: prospectId || null,
    engagement,
    mois_gratuit: moisGratuit,
    paiement_fois: paiementFois,
    montant_fixe_net: totaux.totalFixeNet,
    montant_mensuel_net: totaux.totalMensuelNet,
    montant_annuel_net: totaux.totalAnnuelNet,
    detail_calcul: {
      ...calcul, nego_ligne: negoLigne, total_categorie: totalCategorie,
      montant_convenu: montantConvenu, totaux,
    },
  })

  const apercu = () => {
    try {
      handleDownloadPDF(devisCourant(), calcul, totaux, signatureEnCheck, signatureClient, prospects)
    } catch (probleme) {
      console.error(probleme)
      setErreur('Le document n’a pas pu être préparé.')
    }
  }

  const messageWhatsApp = () => {
    const nbMois = totaux.nbMois
    const lignes = [
      `DEVIS EN-CHECK${devis?.numero ? ` — ${devis.numero}` : ''}`,
      prospect ? `Client : ${prospect.company_name}` : '',
      '',
      `Investissement initial : ${formatF(totaux.totalFixeNet)} FCFA`,
      paiementFois > 1
        ? `Paiement en ${paiementFois} fois : ${formatF(Math.ceil(totaux.totalFixeNet / paiementFois))} FCFA par échéance`
        : '',
      `Abonnement mensuel : ${formatF(totaux.totalMensuelNet)} FCFA/mois`,
      `Engagement : ${engagementConfig.label} (${engagementConfig.desc})`,
      moisGratuit ? 'Un mois offert' : '',
      `Total sur ${nbMois} mois : ${formatF(totaux.totalAnnuelNet)} FCFA`,
      '',
      'Devis établi par En-Check.',
    ].filter(Boolean)
    window.open(`https://wa.me/?text=${encodeURIComponent(lignes.join('\n'))}`, '_blank')
  }

  const enregistrer = async () => {
    setEnregistrement(true)
    setErreur('')
    try {
      const numero = devis?.numero || await numeroSuivant()
      const donnees = {
        numero,
        prospect_id: prospectId || null,
        scoring,
        niveau,
        config,
        montant_fixe_brut: calcul.sousTotalFixe,
        montant_fixe_net: totaux.totalFixeNet,
        montant_mensuel_brut: calcul.sousTotalMensuel,
        montant_mensuel_net: totaux.totalMensuelNet,
        montant_annuel_net: totaux.totalAnnuelNet,
        remise_fixe_pct: remiseFixe,
        remise_mensuel_pct: remiseMensuel,
        mois_gratuit: moisGratuit,
        paiement_fois: paiementFois,
        engagement,
        detail_calcul: {
          ...calcul,
          nego_ligne: negoLigne,
          total_categorie: totalCategorie,
          montant_convenu: montantConvenu,
          totaux,
        },
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }

      if (devis) {
        const { error } = await supabase.from('devis').update(donnees).eq('id', devis.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('devis').insert({ ...donnees, status: 'brouillon' })
        if (error) throw error
        if (prospectId) {
          await supabase
            .from('prospects')
            .update({ status: 'devis_envoye', updated_at: new Date().toISOString() })
            .eq('id', prospectId)
        }
      }

      onAvis?.({
        ton: 'ok',
        texte: devis ? `Devis ${numero} mis à jour.` : `Devis ${numero} enregistré.`,
      })
      onEnregistre?.()
      onFermer?.()
    } catch (probleme) {
      console.error(probleme)
      setErreur('L’enregistrement a échoué. Vérifiez la connexion, puis réessayez.')
    } finally {
      setEnregistrement(false)
    }
  }

  const peutAvancer = etape < 4
  const peutReculer = etape > 1

  return (
    <div className="at-voile" role="dialog" aria-modal="true" aria-labelledby="at-titre">
      <div className="at-panneau">
        <header className="at-tete">
          <div className="at-tete-texte">
            <p className="at-eyebrow">{devis ? 'Modifier un devis' : 'Nouveau devis'}</p>
            <h2 className="at-titre" id="at-titre">
              {devis ? devis.numero : 'Atelier de devis'}
            </h2>
            <p className="at-sous-titre">
              {prospect ? prospect.company_name : 'Aucun prospect lié — le devis reste possible'}
            </p>
          </div>
          <button type="button" className="at-fermer" onClick={onFermer} aria-label="Fermer l’atelier">
            <X size={16} />
          </button>
        </header>

        <nav className="at-etapes" aria-label="Étapes du devis">
          {ETAPES.map((item) => {
            const fait = etape > item.num
            const actif = etape === item.num
            return (
              <button
                key={item.num}
                type="button"
                className="at-etape"
                data-etat={fait ? 'fait' : actif ? 'active' : 'a_venir'}
                aria-current={actif ? 'step' : undefined}
                onClick={() => setEtape(item.num)}
              >
                <span className="at-etape-rond" aria-hidden="true">
                  {fait ? <Check size={12} strokeWidth={3} /> : item.num}
                </span>
                <span className="at-etape-libelle">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="at-corps">
          {/* ─── ① PROSPECT & SCORING ─────────────────────── */}
          {etape === 1 && (
            <section className="at-section" aria-labelledby="at-scoring">
              <div className="at-section-tete">
                <h3 id="at-scoring">À qui, et avec quel profil</h3>
                <p>Le scoring est interne : il propose un niveau de prix, il ne l’impose pas.</p>
              </div>

              <label className="at-champ at-champ--large">
                <span className="at-etiquette">Prospect</span>
                <select value={prospectId} onChange={(evenement) => setProspectId(evenement.target.value)}>
                  <option value="">Aucun prospect</option>
                  {prospects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company_name}{item.city ? ` — ${item.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="at-criteres">
                {CRITERES_SCORING.map((critere) => (
                  <fieldset className="at-critere" key={critere.key}>
                    <legend>{critere.label}</legend>
                    <div className="at-critere-choix">
                      {critere.options.map((option) => {
                        const choisi = scoring[critere.key] === option.value
                        return (
                          <label
                            key={option.value}
                            className="at-choix"
                            data-choisi={choisi ? 'oui' : 'non'}
                            data-ton={TON_NIVEAU[option.value]}
                          >
                            <input
                              type="radio"
                              name={`critere-${critere.key}`}
                              value={option.value}
                              checked={choisi}
                              onChange={() => choisirScore(critere.key, option.value)}
                            />
                            <span className="at-choix-point" aria-hidden="true" />
                            <span className="at-choix-texte">
                              <span className="at-choix-label">{option.label}</span>
                              <span className="at-choix-desc">{option.desc}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {scoring[critere.key] && (
                      <button
                        type="button"
                        className="at-effacer"
                        onClick={() => choisirScore(critere.key, null)}
                      >
                        Effacer
                      </button>
                    )}
                  </fieldset>
                ))}
              </div>

              <div className="at-niveau">
                <div>
                  <p className="at-etiquette">Niveau suggéré par le scoring</p>
                  <p className="at-niveau-suggere">
                    {niveauSuggere ? niveauSuggere.toUpperCase() : '—'}
                    {!niveauSuggere && <span> Évaluez au moins un critère pour une suggestion.</span>}
                  </p>
                </div>
                <div>
                  <p className="at-etiquette">Niveau retenu pour les prix</p>
                  <div className="at-niveaux">
                    {['mini', 'moy', 'max'].map((valeur) => (
                      <button
                        key={valeur}
                        type="button"
                        className="at-niveau-bouton"
                        data-ton={TON_NIVEAU[valeur]}
                        data-choisi={niveau === valeur ? 'oui' : 'non'}
                        onClick={() => setNiveau(valeur)}
                      >
                        {valeur.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── ② CONFIGURATION ──────────────────────────── */}
          {etape === 2 && (
            <section className="at-section" aria-labelledby="at-configuration">
              <div className="at-section-tete">
                <h3 id="at-configuration">L’installation et ses options</h3>
                <p>Les quantités décident des totaux : elles viennent du prospect quand on en a choisi un.</p>
              </div>

              <div className="at-compteurs">
                {CHAMPS.map((champ) => (
                  <label className="at-champ" key={champ.key}>
                    <span className="at-etiquette">{champ.label}</span>
                    <input
                      type="number"
                      min={champ.min}
                      value={config[champ.key]}
                      onChange={(evenement) => changerConfig(champ.key, parseInt(evenement.target.value, 10) || 0)}
                    />
                  </label>
                ))}
              </div>

              <div className="at-bloc">
                <p className="at-etiquette">Type de pointage</p>
                <div className="at-pointages">
                  {[
                    { value: 'pin', label: 'Code personnel', cle: 'pointage_pin' },
                    { value: 'qr', label: 'Badge QR', cle: 'pointage_qr' },
                  ].map((option) => {
                    const choisi = config.type_pointage === option.value
                    const unitaire = prixAutoUnitaire(option.cle, niveau, option.value)
                    return (
                      <label key={option.value} className="at-pointage" data-choisi={choisi ? 'oui' : 'non'}>
                        <input
                          type="radio"
                          name="type-pointage"
                          value={option.value}
                          checked={choisi}
                          onChange={() => changerConfig('type_pointage', option.value)}
                        />
                        <span className="at-pointage-label">{option.label}</span>
                        <span className="at-pointage-prix">
                          {formatF(unitaire)} F / employé / mois
                        </span>
                        <span className="at-pointage-total">
                          {formatF(unitaire * config.nb_employes)} F / mois pour {config.nb_employes} employés
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="at-bloc">
                <div className="at-bloc-tete">
                  <p className="at-etiquette">Options mensuelles</p>
                  <span className="at-bloc-note">
                    {nbOptions} option{nbOptions > 1 ? 's' : ''} retenue{nbOptions > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="at-options">
                  {OPTIONS.map((option) => {
                    const active = Boolean(config.options[option.key])
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className="at-option"
                        data-active={active ? 'oui' : 'non'}
                        aria-pressed={active}
                        onClick={() => basculerOption(option.key)}
                      >
                        <span className="at-option-case" aria-hidden="true">
                          {active && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="at-option-texte">
                          <span className="at-option-label">{option.label}</span>
                          <span className="at-option-detail">
                            {option.gratuit
                              ? 'Gratuit'
                              : `${formatF(prixAutoUnitaire(option.key, niveau, config.type_pointage))} F × ${quantiteOption(option)} ${option.unite === 'employes' ? 'employés' : 'sites'}`}
                          </span>
                        </span>
                        <span className="at-option-prix">
                          {option.gratuit ? '0 F' : `${formatF(prixOption(option))} F`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="at-fil">
                <p className="at-fil-titre">Ce que ça donne à ce stade</p>
                <div className="at-fil-chiffres">
                  <span><strong>{formatF(calcul.sousTotalFixe)} F</strong> d’investissement</span>
                  <span><strong>{formatF(calcul.sousTotalMensuel)} F</strong> par mois</span>
                </div>
              </div>
            </section>
          )}

          {/* ─── ③ NÉGOCIATION ────────────────────────────── */}
          {etape === 3 && (
            <section className="at-section" aria-labelledby="at-negociation">
              <div className="at-section-tete">
                <h3 id="at-negociation">Ce qui se discute</h3>
                <p>
                  Un montant saisi remplace le prix du barème. Sous le minimum, la ligne s’allume :
                  le devis reste possible, la marge se décide en connaissance de cause.
                </p>
              </div>

              {[['Investissement', calcul.lignesFixe], ['Abonnement mensuel', calcul.lignesMensuel]].map(([titre, lignes]) => (
                <div className="at-lignes" key={titre}>
                  <p className="at-lignes-titre">{titre}</p>
                  <div className="at-tableau" role="table" aria-label={titre}>
                    <div className="at-tableau-tete" role="row">
                      <span role="columnheader">Ligne</span>
                      <span role="columnheader">Barème</span>
                      <span role="columnheader">Négocié</span>
                      <span role="columnheader">Total</span>
                    </div>
                    {lignes.map((ligne) => {
                      const alerte = getAlerteMinDetail(ligne.key, ligne.qte, negoLigne, config.type_pointage)
                      const nego = negoLigne[ligne.key] || { unitaire: '', total: '' }
                      return (
                        <div className="at-tableau-ligne" role="row" key={ligne.key} data-alerte={alerte.sousMin ? 'oui' : 'non'}>
                          <span className="at-ligne-label" role="cell">
                            {ligne.label}
                            <span className="at-ligne-qte">{ligne.qte} × {ligne.isGratuit ? '0' : formatF(ligne.autoUnitaire)} F</span>
                          </span>
                          <span className="at-ligne-bareme" role="cell">
                            {ligne.isGratuit ? 'offert' : `${formatF(ligne.autoTotal)} F`}
                          </span>
                          <span className="at-ligne-saisie" role="cell">
                            <label className="at-saisie">
                              <span className="at-saisie-libelle">unitaire</span>
                              <input
                                type="number"
                                min="0"
                                value={nego.unitaire}
                                placeholder={String(Math.round(ligne.autoUnitaire))}
                                onChange={(evenement) => ecrireNego(ligne.key, 'unitaire', evenement.target.value)}
                              />
                            </label>
                            <label className="at-saisie">
                              <span className="at-saisie-libelle">total</span>
                              <input
                                type="number"
                                min="0"
                                value={nego.total}
                                placeholder={String(Math.round(ligne.autoTotal))}
                                onChange={(evenement) => ecrireNego(ligne.key, 'total', evenement.target.value)}
                              />
                            </label>
                            {ligne.negocie && (
                              <button type="button" className="at-effacer" onClick={() => effacerNego(ligne.key)}>
                                Barème
                              </button>
                            )}
                          </span>
                          <span className="at-ligne-total" role="cell">
                            {formatF(ligne.total)} F
                            {alerte.sousMin && (
                              <span className="at-alerte-ligne">
                                <AlertTriangle size={11} /> minimum {formatF(alerte.tarifMin)} F
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="at-reglages">
                <div className="at-reglage">
                  <p className="at-etiquette">Remise sur l’investissement</p>
                  <label className="at-saisie at-saisie--large">
                    <input
                      type="number" min="0" max="100" value={remiseFixe}
                      onChange={(evenement) => setRemiseFixe(Math.min(parseFloat(evenement.target.value) || 0, 100))}
                    />
                    <span className="at-saisie-suffixe">%</span>
                  </label>
                </div>
                <div className="at-reglage">
                  <p className="at-etiquette">Remise sur l’abonnement</p>
                  <label className="at-saisie at-saisie--large">
                    <input
                      type="number" min="0" max="50" value={remiseMensuel}
                      onChange={(evenement) => setRemiseMensuel(Math.min(parseFloat(evenement.target.value) || 0, 50))}
                    />
                    <span className="at-saisie-suffixe">%</span>
                  </label>
                </div>
                <div className="at-reglage">
                  <p className="at-etiquette">Engagement</p>
                  <select value={engagement} onChange={(evenement) => setEngagement(evenement.target.value)}>
                    {ENGAGEMENTS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.desc}{item.remise ? ` — remise ${item.remise} %` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="at-reglage">
                  <p className="at-etiquette">Paiement de l’investissement</p>
                  <select value={paiementFois} onChange={(evenement) => setPaiementFois(parseInt(evenement.target.value, 10))}>
                    {[1, 2, 3, 4].map((fois) => (
                      <option key={fois} value={fois}>{fois === 1 ? 'Comptant' : `En ${fois} fois`}</option>
                    ))}
                  </select>
                </div>
                <label className="at-bascule">
                  <input type="checkbox" checked={moisGratuit} onChange={() => setMoisGratuit(!moisGratuit)} />
                  <span className="at-bascule-case" aria-hidden="true">{moisGratuit && <Check size={11} strokeWidth={3} />}</span>
                  <span className="at-bascule-texte">Offrir un mois sur l’engagement</span>
                </label>
              </div>

              <details className="at-plafond">
                <summary>Fixer un montant convenu ou un total par catégorie</summary>
                <p className="at-plafond-note">
                  La priorité reste la même : montant convenu, puis total de catégorie, puis les lignes.
                  Ces champs n’écrasent pas la négociation ligne à ligne, ils la remplacent.
                </p>
                <div className="at-plafond-grille">
                  {[
                    { titre: 'Montant convenu', etat: montantConvenu, set: setMontantConvenu },
                    { titre: 'Total de catégorie', etat: totalCategorie, set: setTotalCategorie },
                  ].map((groupe) => (
                    <fieldset className="at-plafond-bloc" key={groupe.titre}>
                      <legend>{groupe.titre}</legend>
                      <label className="at-champ">
                        <span className="at-etiquette">Investissement (F)</span>
                        <input
                          type="number" min="0" value={groupe.etat.fixe}
                          onChange={(evenement) => groupe.set({ ...groupe.etat, fixe: evenement.target.value })}
                        />
                      </label>
                      <label className="at-champ">
                        <span className="at-etiquette">Mensuel (F)</span>
                        <input
                          type="number" min="0" value={groupe.etat.mensuel}
                          onChange={(evenement) => groupe.set({ ...groupe.etat, mensuel: evenement.target.value })}
                        />
                      </label>
                    </fieldset>
                  ))}
                </div>
              </details>
            </section>
          )}

          {/* ─── ④ RÉSULTAT ───────────────────────────────── */}
          {etape === 4 && (
            <section className="at-section" aria-labelledby="at-resultat">
              <div className="at-section-tete">
                <h3 id="at-resultat">Le devis, tel qu’il partira</h3>
                <p>Les montants ci-dessous sont ceux qui seront enregistrés et imprimés.</p>
              </div>

              <div className="at-totaux">
                <div className="at-total">
                  <p className="at-etiquette">Investissement initial</p>
                  <p className="at-total-valeur">{formatF(totaux.totalFixeNet)} F</p>
                  <p className="at-total-note">
                    {totaux.paiementFois > 1
                      ? `en ${totaux.paiementFois} fois — ${formatF(totaux.echeanceFixe)} F par échéance`
                      : 'en une fois'}
                  </p>
                </div>
                <div className="at-total">
                  <p className="at-etiquette">Abonnement mensuel</p>
                  <p className="at-total-valeur">{formatF(totaux.totalMensuelNet)} F</p>
                  <p className="at-total-note">{engagementConfig.desc}{remiseMensuel ? ` · remise ${remiseMensuel} %` : ''}</p>
                </div>
                <div className="at-total at-total--fort">
                  <p className="at-etiquette">Total sur {totaux.nbMois} mois</p>
                  <p className="at-total-valeur">{formatF(totaux.totalAnnuelNet)} F</p>
                  <p className="at-total-note">{moisGratuit ? `${engagementConfig.desc}, un mois offert` : engagementConfig.desc}</p>
                </div>
              </div>

              {lignesAlertes.length > 0 && (
                <p className="at-avertissement" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {lignesAlertes.length} ligne{lignesAlertes.length > 1 ? 's sont' : ' est'} sous le tarif minimum
                  ({lignesAlertes.map((ligne) => ligne.label).join(', ')}).
                </p>
              )}

              <div className="at-documents">
                <label className="at-champ">
                  <span className="at-etiquette">Date de signature — En-Check</span>
                  <input type="date" value={signatureEnCheck} onChange={(evenement) => setSignatureEnCheck(evenement.target.value)} />
                </label>
                <label className="at-champ">
                  <span className="at-etiquette">Date de signature — client</span>
                  <input type="date" value={signatureClient} onChange={(evenement) => setSignatureClient(evenement.target.value)} />
                </label>
              </div>

              <label className="at-champ at-champ--large">
                <span className="at-etiquette">Notes internes du devis</span>
                <textarea
                  rows={3}
                  value={notes}
                  placeholder="Ce qui s’est dit, ce qui reste à trancher…"
                  onChange={(evenement) => setNotes(evenement.target.value)}
                />
              </label>

              <div className="at-actions-doc">
                <button type="button" className="at-bouton-creux" onClick={apercu}>
                  <FileText size={15} /> Aperçu PDF
                </button>
                <button type="button" className="at-bouton-creux" onClick={messageWhatsApp}>
                  <MessageCircle size={15} /> Envoyer par WhatsApp
                </button>
                <span className="at-etat-devis">
                  Statut à l’enregistrement : <strong>{devis ? (STATUTS_DEVIS.find((s) => s.key === devis.status)?.label || 'Brouillon') : 'Brouillon'}</strong>
                </span>
              </div>

              {erreur && <p className="at-erreur" role="alert">{erreur}</p>}
            </section>
          )}
        </div>

        <footer className="at-pied">
          <div className="at-pied-gauche">
            {peutReculer && (
              <button type="button" className="at-bouton-creux" onClick={() => setEtape(etape - 1)}>
                <ChevronLeft size={15} /> Retour
              </button>
            )}
          </div>
          <div className="at-pied-droit">
            <span className="at-rappel">
              <Users size={13} aria-hidden="true" />
              {config.nb_employes} employés · {config.nb_sites} site{config.nb_sites > 1 ? 's' : ''}
            </span>
            {peutAvancer ? (
              <button type="button" className="at-bouton" onClick={() => setEtape(etape + 1)}>
                Continuer <ChevronRight size={15} />
              </button>
            ) : (
              <button type="button" className="at-bouton at-bouton--valider" onClick={enregistrer} disabled={enregistrement}>
                <Save size={15} /> {enregistrement ? 'Enregistrement…' : devis ? 'Mettre à jour le devis' : 'Enregistrer le devis'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
