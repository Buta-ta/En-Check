// src/pages/PostePointage.jsx
//
// ═══════════════════════════════════════════════════════════════════
// 🖥️ LE POSTE DE POINTAGE — l'écran qu'on laisse allumé à l'entrée du site
// ═══════════════════════════════════════════════════════════════════
// Une tablette ou un vieil ordinateur, posé à l'entrée, avec un navigateur
// ouvert sur cette page. L'employé présente son badge devant la caméra : son
// arrivée ou son départ est enregistré, et l'écran lui confirme en grand.
//
// AUCUNE POINTEUSE N'EST NÉCESSAIRE, ET L'EMPLOYÉ N'INSTALLE RIEN.
// C'est le quatrième collecteur de la gamme : le téléphone, la pointeuse,
// l'import de fichier, et maintenant le poste fixe.
//
// Le poste s'installe une seule fois : on saisit le code de l'entreprise, et
// c'est retenu dans la tablette. Ensuite, l'écran est prêt, jour et nuit.
//
// Ce que le poste ne fait PAS, volontairement : il ne demande ni photo ni
// empreinte. C'est un poste de bonne foi, surveillé par les mêmes règles que
// les autres collecteurs — geste double, pointage hors zone, sortie manquante,
// absence inhabituelle remontent tous dans la cloche.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const CLE_POSTE = 'encheck_poste'
const DELAI_ENTRE_POINTAGES = 60      // secondes : en deçà, on ne repointe pas
const DUREE_CONFIRMATION = 4000       // millisecondes d'affichage de la confirmation

// ─── Ce que veulent dire les refus du serveur, en langue d'employé ───
const MESSAGES = {
  identifiants_incorrects: "Ce badge n'est pas reconnu sur ce poste. Présentez-le à nouveau, ou saisissez votre numéro.",
  pin_requis: "Ce badge demande un code personnel.",
  pin_non_configure: "Aucun code personnel n'est configuré pour ce badge. Voyez l'administration.",
  trop_de_tentatives: "Trop d'essais sur ce poste. Patientez une minute.",
  entreprise_manquante: "Ce poste n'est plus rattaché à une entreprise active. Voyez l'administration.",
  code_manquant: "Aucun numéro n'a été saisi.",
  jeton_invalide: "La session de ce poste a expiré. Représentez le badge.",
  jeton_d_un_autre_appareil: "Ce badge a été utilisé sur un autre appareil. Représentez-le ici.",
  jeton_requis: "Ce poste doit être réinstallé. Voyez l'administration.",
  employe_inconnu_ou_inactif: "Cette fiche employé est inactive. Voyez l'administration.",
  entreprise_incoherente: "Ce badge appartient à une autre entreprise.",
  device_id_manquant: "Ce poste n'a pas d'identifiant. Réinstallez-le.",
  check_type_manquant: "Le geste n'a pas été reconnu. Recommencez.",
}

function messageDe(raison) {
  if (!raison) return "Le pointage n'a pas abouti. Recommencez."
  return MESSAGES[raison] || `Le pointage n'a pas abouti (${raison}). Recommencez.`
}

// ─── Le nom de l'employé, sans présumer du nom des colonnes ───
function nomEmploye(e) {
  if (!e) return 'Employé'
  const assemble = (a, b) => [a, b].filter(Boolean).join(' ').trim()
  return (
    (e.nom_complet || '').trim() ||
    (e.full_name || '').trim() ||
    (e.name || '').trim() ||
    assemble(e.prenom || e.first_name, e.nom || e.last_name) ||
    e.matricule ||
    'Employé'
  )
}

// ─── Le nom de l'entreprise, sans présumer du nom des colonnes ───
function nomEntreprise(e) {
  if (!e) return 'En-Check'
  return (e.nom || e.name || e.raison_sociale || e.libelle || 'Votre entreprise').trim()
}

function identifiantEntreprise(e) {
  return e?.id || e?.enterprise_id || null
}

// ─── Le sens du geste : l'inverse du dernier pointage de la journée.
//     Le mobile fait exactement le même calcul — un seul raisonnement pour tous
//     les collecteurs.
function sensSuivant(dernier) {
  if (dernier && String(dernier.check_type || '').toLowerCase() === 'in') return 'out'
  return 'in'
}

//  Les secondes écoulées depuis le dernier geste, ou null si on ne sait pas.
function ecartDepuis(dernier, maintenant) {
  if (!dernier) return null
  const quand = new Date(dernier.check_time || dernier.check_in)
  if (isNaN(quand)) return null
  return (maintenant - quand.getTime()) / 1000
}

function heureCourte(v) {
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d)) return '--:--'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function dateLongue(d) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ══════════════════════════════════════════════════════════════════
export default function PostePointage() {
  const [config, setConfig] = useState(null)
  const [code, setCode] = useState('')
  const [installationEnCours, setInstallationEnCours] = useState(false)
  const [erreurInstallation, setErreurInstallation] = useState('')

  const [etat, setEtat] = useState('pret')       // pret | travail | confirme | refus
  const [resultat, setResultat] = useState(null) // { sens, employe, heure }
  const [refus, setRefus] = useState('')
  const [saisieOuverte, setSaisieOuverte] = useState(false)
  const [numeroSaisi, setNumeroSaisi] = useState('')
  const [codeSaisi, setCodeSaisi] = useState('')
  const [replisPin, setReplisPin] = useState(null) // { numero } quand le badge réclame un code
  const [maintenant, setMaintenant] = useState(new Date())
  const [avisHorloge, setAvisHorloge] = useState(0)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  const [cameraDisponible, setCameraDisponible] = useState(true)

  const scannerRef = useRef(null)
  const enTraitementRef = useRef(false)
  const retourRef = useRef(null)

  // ─── L'horloge de l'écran ───
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ─── Le poste est-il déjà installé sur cette tablette ? ───
  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE_POSTE)
      if (brut) {
        const c = JSON.parse(brut)
        if (c && c.enterprise_id && c.device_id) {
          setConfig(c)
          setAvisHorloge(Number(c.ecart_horloge || 0))
        }
      }
    } catch {
      /* mémoire illisible : on réinstallera */
    }
    setCameraDisponible(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices &&
        !!navigator.mediaDevices.getUserMedia &&
        (typeof window === 'undefined' ? true : window.isSecureContext !== false),
    )
  }, [])

  const enregistrerConfig = useCallback((c) => {
    setConfig(c)
    try {
      localStorage.setItem(CLE_POSTE, JSON.stringify(c))
    } catch {
      /* la tablette n'a peut-être pas de mémoire : le poste marchera jusqu'au rechargement */
    }
  }, [])

  // ════════════════════════════════════════════════════════════
  //  L'INSTALLATION — une seule fois par appareil
  // ════════════════════════════════════════════════════════════
  const installer = async () => {
    const valeur = code.trim()
    if (!valeur) {
      setErreurInstallation("Saisissez le code de votre entreprise.")
      return
    }
    setInstallationEnCours(true)
    setErreurInstallation('')
    try {
      const { data, error } = await supabase.rpc('encheck_entreprise_par_code', { p_code: valeur })
      if (error) throw error
      const ent = Array.isArray(data) ? data[0] : data
      const id = identifiantEntreprise(ent)
      if (!id) {
        setErreurInstallation("Ce code ne correspond à aucune entreprise active. Vérifiez-le auprès de votre administration.")
        return
      }
      //  Un identifiant d'appareil propre à CETTE tablette : c'est lui qui lie la
      //  session de chaque employé à ce poste, et pas à un autre appareil.
      const deviceId = `poste-${String(id).slice(0, 8)}-${Math.random().toString(36).slice(2, 10)}`
      enregistrerConfig({
        enterprise_id: id,
        nom: nomEntreprise(ent),
        code: valeur,
        device_id: deviceId,
        installe_le: new Date().toISOString(),
      })
    } catch (e) {
      setErreurInstallation("La connexion au serveur a échoué. Vérifiez qu'Internet fonctionne, puis réessayez.")
    } finally {
      setInstallationEnCours(false)
    }
  }

  // ════════════════════════════════════════════════════════════
  //  LE GESTE — identifier, décider du sens, pointer
  // ════════════════════════════════════════════════════════════
  const pointer = useCallback(
    async (employe, jeton) => {
      const { data: histo, error: eHisto } = await supabase.rpc('encheck_pointages_historique', {
        p_employee_id: employe.id,
        p_limite: 10,
      })
      if (eHisto) throw eHisto

      const liste = (Array.isArray(histo) ? histo : []).filter((x) => x && (x.check_time || x.check_in))
      liste.sort((a, b) => new Date(b.check_time || b.check_in) - new Date(a.check_time || a.check_in))
      const dernier = liste[0] || null

      //  Un badge représenté coup sur coup : on le dit, et on ne crée pas un
      //  second pointage. C'est ce qui évite les alertes « deux appuis » inutiles.
      const ecartDernier = ecartDepuis(dernier, Date.now())
      if (ecartDernier !== null && ecartDernier >= 0 && ecartDernier < DELAI_ENTRE_POINTAGES) {
        setResultat({
          sens: String(dernier.check_type || '').toLowerCase() === 'out' ? 'out' : 'in',
          employe,
          heure: new Date(dernier.check_time || dernier.check_in),
          deja: true,
        })
        setEtat('confirme')
        return
      }

      const sens = sensSuivant(dernier)
      const appareil = config?.device_id

      const { data, error } = await supabase.rpc('encheck_punch', {
        p_device_id: appareil,
        p_employee_id: employe.id,
        p_enterprise_id: config?.enterprise_id,
        p_check_type: sens,
        p_method: 'poste',
        p_client_ref: `${appareil}-${employe.id}-${Date.now()}`,
        p_device_time: avisHorloge > 120 ? null : new Date().toISOString(),
        p_jeton: jeton,
      })
      if (error) throw error

      const rep = data || {}
      if (rep.ok !== true) {
        throw new Error(messageDe(rep.reason))
      }

      //  L'écart d'horloge que le serveur a constaté : s'il est réel, l'écran le
      //  dit, et le poste cesse d'envoyer sa propre heure — pour ne pas fabriquer
      //  une alerte à chaque geste.
      const ecart = Math.abs(Number(rep.ecart_horloge || 0))
      if (ecart > 120) {
        setAvisHorloge(ecart)
        if (config) enregistrerConfig({ ...config, ecart_horloge: ecart })
      }

      setResultat({
        sens,
        employe,
        heure: rep.check_time ? new Date(rep.check_time) : new Date(),
        suspect: rep.suspect === true,
      })
      setEtat('confirme')
    },
    [config, avisHorloge, enregistrerConfig],
  )

  //  L'employé s'est identifié : on enchaîne sur le geste.
  const identifierEtPointer = useCallback(
    async (numero, pin) => {
      if (enTraitementRef.current) return
      enTraitementRef.current = true
      setEtat('travail')
      setRefus('')
      try {
        const { data, error } = await supabase.rpc('encheck_employee_login_qr', {
          p_enterprise_id: config?.enterprise_id,
          p_code: numero,
          p_pin: pin || null,
          p_device_id: config?.device_id,
        })
        if (error) throw error

        const rep = data || {}
        if (rep.ok !== true) {
          if (rep.raison === 'pin_requis') {
            setReplisPin({ numero })
            setCodeSaisi('')
            setEtat('pret')
            return
          }
          setRefus(messageDe(rep.raison))
          setEtat('refus')
          return
        }

        const employe = rep.employee || {}
        const jeton = rep.jeton || null
        if (!employe.id) {
          setRefus("Ce badge n'est pas reconnu sur ce poste.")
          setEtat('refus')
          return
        }

        await pointer(employe, jeton)
      } catch (e) {
        setRefus(e?.message && e.message.length < 160 ? e.message : "Le pointage n'a pas abouti. Recommencez.")
        setEtat('refus')
      } finally {
        enTraitementRef.current = false
      }
    },
    [config, pointer],
  )

  //  Ce que fait la caméra quand elle lit un badge.
  const badgeLu = useCallback(
    (texte) => {
      const valeur = String(texte || '').trim()
      if (!valeur || enTraitementRef.current) return
      arreterCamera()
      identifierEtPointer(valeur, null)
    },
    [identifierEtPointer],
  )

  // ════════════════════════════════════════════════════════════
  //  LA CAMÉRA — ouverte quand l'écran attend, fermée sinon
  // ════════════════════════════════════════════════════════════
  const arreterCamera = useCallback(() => {
    const s = scannerRef.current
    scannerRef.current = null
    if (!s) return
    try {
      const arret = Promise.resolve(s.stop())
      if (arret && typeof arret.then === 'function') arret.then(() => s.clear()).catch(() => {})
    } catch {
      /* déjà arrêtée */
    }
  }, [])

  const demarrerCamera = useCallback(async () => {
    if (scannerRef.current || !cameraDisponible) return
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const zone = document.getElementById('zone-badge')
      if (!zone) return
      const scanner = new Html5Qrcode('zone-badge', { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (l, h) => {
            const cote = Math.floor(Math.min(l, h) * 0.78)
            return { width: cote, height: cote }
          },
          aspectRatio: 1.0,
        },
        (texte) => badgeLu(texte),
        () => {},
      )
    } catch (e) {
      scannerRef.current = null
      setCameraDisponible(false)
    }
  }, [badgeLu, cameraDisponible])

  useEffect(() => {
    if (!config) return
    if (etat === 'pret' && !replisPin && !saisieOuverte) {
      demarrerCamera()
    } else {
      arreterCamera()
    }
    return () => arreterCamera()
  }, [etat, config, replisPin, saisieOuverte, demarrerCamera, arreterCamera])

  //  La confirmation s'efface toute seule, et l'écran revient au scan.
  useEffect(() => {
    if (etat !== 'confirme') return
    if (retourRef.current) clearTimeout(retourRef.current)
    retourRef.current = setTimeout(() => {
      setResultat(null)
      setEtat('pret')
    }, DUREE_CONFIRMATION)
    return () => {
      if (retourRef.current) clearTimeout(retourRef.current)
    }
  }, [etat])

  const oublierLePoste = () => {
    arreterCamera()
    try {
      localStorage.removeItem(CLE_POSTE)
    } catch {
      /* rien à faire */
    }
    setConfig(null)
    setCode('')
    setReglagesOuverts(false)
    setEtat('pret')
    setAvisHorloge(0)
  }

  // ════════════════════════════════════════════════════════════
  //  L'INSTALLATION À L'ÉCRAN
  // ════════════════════════════════════════════════════════════
  if (!config) {
    return (
      <div style={s.page}>
        <div style={s.carteInstallation}>
          <div style={s.logoPoste}>🖥️</div>
          <h1 style={s.titreInstallation}>Poste de pointage</h1>
          <p style={s.texteInstallation}>
            Cet appareil va rester allumé à l'entrée. Les employés présenteront leur badge
            devant la caméra : leur arrivée et leur départ seront enregistrés, sans pointeuse
            et sans rien installer sur leur téléphone.
          </p>
          <label style={s.etiquette}>Code de l'entreprise</label>
          <input
            style={s.champ}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && installer()}
            placeholder="ex. ENC-229"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          {erreurInstallation && <p style={s.erreurInstallation}>{erreurInstallation}</p>}
          <button
            style={{ ...s.boutonPrincipal, opacity: installationEnCours ? 0.6 : 1 }}
            onClick={installer}
            disabled={installationEnCours}
          >
            {installationEnCours ? 'Installation…' : 'Installer ce poste'}
          </button>
          <p style={s.noteInstallation}>
            Ce code vous a été remis avec votre accès. Il ne se saisit qu'une fois sur cet appareil.
          </p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  //  L'ÉCRAN DU POSTE
  // ════════════════════════════════════════════════════════════
  return (
    <div style={s.page}>
      <header style={s.entete}>
        <div style={s.enteteGauche}>
          <span style={s.pastilleEntreprise}>📍</span>
          <div>
            <div style={s.nomEntreprise}>{config.nom || 'Poste de pointage'}</div>
            <div style={s.sousTitre}>{dateLongue(maintenant)}</div>
          </div>
        </div>
        <div style={s.enteteDroite}>
          <div style={s.horloge}>
            {maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button style={s.boutonDiscret} onClick={() => setReglagesOuverts((v) => !v)}>
            Réglages
          </button>
        </div>
      </header>

      {avisHorloge > 120 && (
        <div style={s.avisHorloge}>
          ⚠️ L'heure de cet appareil est décalée de {Math.round(avisHorloge / 60)} minute(s) sur celle du
          serveur. Corrigez l'heure automatique dans les réglages de la tablette : tant que ce n'est pas
          fait, les employés lisent une heure fausse à l'écran.
        </div>
      )}

      {reglagesOuverts && (
        <div style={s.panneauReglages}>
          <div style={s.ligneReglage}>
            <strong>Entreprise</strong>
            <span>{config.nom}</span>
          </div>
          <div style={s.ligneReglage}>
            <strong>Identifiant de ce poste</strong>
            <code style={s.codeAppareil}>{config.device_id}</code>
          </div>
          <div style={s.ligneReglage}>
            <strong>Installé le</strong>
            <span>{config.installe_le ? new Date(config.installe_le).toLocaleString('fr-FR') : '—'}</span>
          </div>
          <div style={s.actionsReglages}>
            <button style={s.boutonSecondaire} onClick={() => demarrerCamera()}>
              Réessayer la caméra
            </button>
            <button style={s.boutonDanger} onClick={oublierLePoste}>
              Changer d'entreprise
            </button>
          </div>
          <p style={s.noteReglages}>
            L'identifiant de ce poste sert à le reconnaître si vous appelez le support. Il ne change pas
            tant que vous ne réinstallez pas le poste.
          </p>
        </div>
      )}

      <main style={s.centre}>
        {/* ─── La confirmation ─── */}
        {etat === 'confirme' && resultat && (
          <div style={{ ...s.grandeCarte, borderColor: resultat.sens === 'in' ? '#16A34A' : '#2563EB' }}>
            <div style={{ ...s.rond, background: resultat.sens === 'in' ? '#16A34A' : '#2563EB' }}>
              {resultat.sens === 'in' ? '✓' : '↩'}
            </div>
            <h2 style={s.nomConfirme}>{nomEmploye(resultat.employe)}</h2>
            <p style={{ ...s.geste, color: resultat.sens === 'in' ? '#15803D' : '#1D4ED8' }}>
              {resultat.deja
                ? `Vous venez de pointer — ${heureCourte(resultat.heure)}`
                : `${resultat.sens === 'in' ? 'Arrivée' : 'Départ'} enregistré à ${heureCourte(resultat.heure)}`}
            </p>
            {resultat.suspect && !resultat.deja && (
              <p style={s.mentionSuspect}>
                Ce pointage a été marqué pour vérification par le serveur — l'administration en sera informée.
              </p>
            )}
            <p style={s.reviendra}>L'écran revient au badge dans un instant…</p>
          </div>
        )}

        {/* ─── Le refus ─── */}
        {etat === 'refus' && (
          <div style={{ ...s.grandeCarte, borderColor: '#DC2626' }}>
            <div style={{ ...s.rond, background: '#DC2626' }}>!</div>
            <h2 style={s.nomConfirme}>Pointage non enregistré</h2>
            <p style={s.messageRefus}>{refus}</p>
            <button style={s.boutonPrincipal} onClick={() => { setRefus(''); setEtat('pret') }}>
              Réessayer
            </button>
          </div>
        )}

        {/* ─── L'attente : la caméra et le badge ─── */}
        {(etat === 'pret' || etat === 'travail') && (
          <>
            {etat === 'travail' ? (
              <div style={s.grandeCarte}>
                <div style={s.rondTravail}>⏳</div>
                <h2 style={s.nomConfirme}>Un instant…</h2>
                <p style={s.consigne}>Votre pointage est en cours d'enregistrement.</p>
              </div>
            ) : replisPin ? (
              <div style={s.grandeCarte}>
                <div style={{ ...s.rond, background: '#0F172A' }}>🔒</div>
                <h2 style={s.nomConfirme}>Votre code personnel</h2>
                <p style={s.consigne}>
                  Ce badge demande votre code à quatre chiffres. Saisissez-le, puis validez.
                </p>
                <input
                  style={{ ...s.champ, textAlign: 'center', fontSize: 28, letterSpacing: 10, maxWidth: 260 }}
                  value={codeSaisi}
                  onChange={(e) => setCodeSaisi(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && codeSaisi) {
                      const n = replisPin.numero
                      setReplisPin(null)
                      setCodeSaisi('')
                      identifierEtPointer(n, codeSaisi)
                    }
                  }}
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="••••"
                />
                <div style={{ ...s.boutonsLigne, marginTop: 14 }}>
                  <button
                    style={s.boutonPrincipal}
                    disabled={!codeSaisi}
                    onClick={() => {
                      const n = replisPin.numero
                      setReplisPin(null)
                      setCodeSaisi('')
                      identifierEtPointer(n, codeSaisi)
                    }}
                  >
                    Valider mon pointage
                  </button>
                  <button
                    style={s.boutonSecondaire}
                    onClick={() => {
                      setReplisPin(null)
                      setCodeSaisi('')
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={s.blocScan}>
                <p style={s.consigneGrande}>Présentez votre badge devant la caméra</p>
                <div style={s.cadreCamera}>
                  <div id="zone-badge" style={s.zoneCamera} />
                  {!cameraDisponible && (
                    <div style={s.sansCamera}>
                      <p style={s.sansCameraTitre}>La caméra n'est pas disponible sur cet appareil.</p>
                      <p style={s.sansCameraTexte}>
                        Utilisez la saisie ci-dessous : votre numéro, puis votre code personnel.
                      </p>
                    </div>
                  )}
                </div>
                <p style={s.astuceBadge}>
                  Le badge est reconnu en une seconde. Le geste enregistré est l'inverse du précédent :
                  arrivée si vous étiez sorti, départ si vous étiez présent.
                </p>

                {!saisieOuverte ? (
                  <button style={s.boutonLien} onClick={() => setSaisieOuverte(true)}>
                    Pas de badge sous la main ? Saisir mon numéro
                  </button>
                ) : (
                  <div style={s.blocSaisie}>
                    <div style={s.champLigne}>
                      <input
                        style={s.champ}
                        value={numeroSaisi}
                        onChange={(e) => setNumeroSaisi(e.target.value)}
                        placeholder="Votre numéro (ex. ENN-0002)"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <input
                        style={s.champ}
                        value={codeSaisi}
                        onChange={(e) => setCodeSaisi(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="Votre code personnel"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </div>
                    <div style={s.boutonsLigne}>
                      <button
                        style={s.boutonPrincipal}
                        disabled={!numeroSaisi}
                        onClick={() => {
                          const n = numeroSaisi.trim()
                          const c = codeSaisi
                          setNumeroSaisi('')
                          setCodeSaisi('')
                          setSaisieOuverte(false)
                          identifierEtPointer(n, c)
                        }}
                      >
                        Pointer
                      </button>
                      <button
                        style={s.boutonSecondaire}
                        onClick={() => {
                          setSaisieOuverte(false)
                          setNumeroSaisi('')
                          setCodeSaisi('')
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                    <p style={s.noteSaisie}>
                      Votre numéro figure sur votre badge, sous le code-barres. Le code personnel est
                      celui que vous utilisez sur l'application.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer style={s.pied}>
        <span>En-Check — poste de pointage</span>
        <span style={s.piedSep}>·</span>
        <span>Les pointages de ce poste portent la provenance « poste »</span>
      </footer>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
const s = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  // ── installation ──
  carteInstallation: {
    margin: 'auto',
    background: '#FFFFFF',
    color: '#0F172A',
    padding: '34px 30px',
    borderRadius: 16,
    width: 'min(460px, 92vw)',
    boxShadow: '0 24px 60px rgba(0,0,0,.35)',
    textAlign: 'center',
  },
  logoPoste: { fontSize: 34, lineHeight: 1 },
  titreInstallation: { margin: '10px 0 6px', fontSize: 23, fontWeight: 700 },
  texteInstallation: { margin: '0 0 22px', fontSize: 14, lineHeight: 1.6, color: '#475569' },
  etiquette: { display: 'block', textAlign: 'left', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 },
  champ: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 16,
    borderRadius: 9,
    border: '1.5px solid #CBD5E1',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
    color: '#0F172A',
  },
  boutonPrincipal: {
    marginTop: 16,
    width: '100%',
    padding: '13px 18px',
    fontSize: 15.5,
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#0F172A',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  erreurInstallation: {
    margin: '12px 0 0',
    padding: '9px 12px',
    fontSize: 13,
    color: '#991B1B',
    background: '#FEF2F2',
    borderRadius: 8,
    textAlign: 'left',
  },
  noteInstallation: { margin: '14px 0 0', fontSize: 12, color: '#94A3B8', lineHeight: 1.5 },
  // ── entête ──
  entete: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 22px',
    borderBottom: '1px solid rgba(248,250,252,.10)',
  },
  enteteGauche: { display: 'flex', alignItems: 'center', gap: 10 },
  pastilleEntreprise: { fontSize: 18 },
  nomEntreprise: { fontSize: 16, fontWeight: 700 },
  sousTitre: { fontSize: 12.5, color: '#94A3B8', textTransform: 'capitalize' },
  enteteDroite: { display: 'flex', alignItems: 'center', gap: 14 },
  horloge: { fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 },
  boutonDiscret: {
    background: 'transparent',
    color: '#94A3B8',
    border: '1px solid rgba(148,163,184,.4)',
    borderRadius: 8,
    padding: '6px 11px',
    fontSize: 12.5,
    cursor: 'pointer',
  },
  avisHorloge: {
    margin: '12px 22px 0',
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#FDE68A',
    background: 'rgba(217,119,6,.16)',
    border: '1px solid rgba(217,119,6,.45)',
    borderRadius: 10,
  },
  panneauReglages: {
    margin: '14px 22px 0',
    padding: '16px 18px',
    background: 'rgba(248,250,252,.06)',
    border: '1px solid rgba(248,250,252,.12)',
    borderRadius: 12,
    fontSize: 13.5,
  },
  ligneReglage: { display: 'flex', gap: 10, marginBottom: 7, alignItems: 'baseline', flexWrap: 'wrap' },
  codeAppareil: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#93C5FD' },
  actionsReglages: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  boutonSecondaire: {
    padding: '10px 15px',
    fontSize: 13.5,
    color: '#E2E8F0',
    background: 'transparent',
    border: '1px solid rgba(226,232,240,.35)',
    borderRadius: 9,
    cursor: 'pointer',
  },
  boutonDanger: {
    padding: '10px 15px',
    fontSize: 13.5,
    color: '#FECACA',
    background: 'transparent',
    border: '1px solid rgba(248,113,113,.5)',
    borderRadius: 9,
    cursor: 'pointer',
  },
  noteReglages: { margin: '12px 0 0', fontSize: 12, color: '#94A3B8', lineHeight: 1.5 },
  // ── le centre ──
  centre: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 22px' },
  blocScan: { textAlign: 'center', width: '100%', maxWidth: 620 },
  consigneGrande: { margin: '0 0 16px', fontSize: 19, fontWeight: 600, color: '#E2E8F0' },
  cadreCamera: {
    position: 'relative',
    width: 'min(380px, 84vw)',
    height: 'min(380px, 84vw)',
    margin: '0 auto',
    borderRadius: 18,
    overflow: 'hidden',
    background: 'rgba(248,250,252,.05)',
    border: '2px dashed rgba(148,163,184,.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCamera: { width: '100%', height: '100%' },
  sansCamera: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sansCameraTitre: { margin: 0, fontSize: 14.5, fontWeight: 600 },
  sansCameraTexte: { margin: '8px 0 0', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 },
  astuceBadge: { margin: '16px 0 0', fontSize: 13, color: '#94A3B8', lineHeight: 1.6 },
  boutonLien: {
    marginTop: 18,
    background: 'transparent',
    border: 'none',
    color: '#93C5FD',
    fontSize: 14,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  blocSaisie: { marginTop: 18, maxWidth: 430, marginInline: 'auto' },
  champLigne: { display: 'grid', gap: 10 },
  boutonsLigne: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  noteSaisie: { margin: '10px 0 0', fontSize: 12, color: '#94A3B8', lineHeight: 1.5 },
  // ── les grandes cartes ──
  grandeCarte: {
    background: 'rgba(248,250,252,.06)',
    border: '3px solid rgba(148,163,184,.35)',
    borderRadius: 18,
    padding: '30px 26px',
    textAlign: 'center',
    width: 'min(540px, 92vw)',
  },
  rond: {
    width: 62,
    height: 62,
    borderRadius: '50%',
    margin: '0 auto 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: 700,
  },
  rondTravail: { fontSize: 40, marginBottom: 8 },
  nomConfirme: { margin: '0 0 8px', fontSize: 24, fontWeight: 700 },
  geste: { margin: 0, fontSize: 18, fontWeight: 600 },
  mentionSuspect: { margin: '14px 0 0', fontSize: 12.5, color: '#FCD34D', lineHeight: 1.5 },
  reviendra: { margin: '18px 0 0', fontSize: 12.5, color: '#94A3B8' },
  consigne: { margin: 0, fontSize: 14, color: '#CBD5E1', lineHeight: 1.6 },
  messageRefus: { margin: '0 0 4px', fontSize: 14.5, color: '#FECACA', lineHeight: 1.6 },
  pied: {
    padding: '12px 22px 16px',
    fontSize: 11.5,
    color: '#64748B',
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  piedSep: { opacity: 0.5 },
}
