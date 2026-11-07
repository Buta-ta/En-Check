// ═══════════════════════════════════════════════════════════════════
// 🖥️ LE POSTE DE POINTAGE — l'écran qu'on laisse allumé à l'entrée
//
// Une tablette ou un vieil ordinateur, posé à l'entrée, avec un navigateur
// ouvert sur cette adresse. L'employé présente son badge devant la caméra :
// son arrivée ou son départ est enregistré, et l'écran lui confirme en grand.
//
// AUCUNE POINTEUSE N'EST NÉCESSAIRE, ET L'EMPLOYÉ N'INSTALLE RIEN.
// C'est le quatrième collecteur de la gamme : le téléphone, la pointeuse,
// l'import de fichier, et maintenant le poste fixe.
//
// Cet écran est la MOITIÉ VISIBLE de « Configuration pointeuse » : c'est la
// même entreprise, le même appareil, la même mémoire. La page
// `/configuration-pointeuse` administre le poste ; celle-ci le fait vivre.
// Les deux partagent leurs fonctions (`src/lib/postePointage.js`), donc les
// phrases de refus sont les mêmes des deux côtés.
//
// Le dessin reprend la toile de Korhogo sur un mur de fumée : une couture de
// chevrons en haut, le blason peint, l'écru et l'ocre. Rien de clinquant :
// l'écran reste lisible à deux mètres, en plein soleil comme le soir.
//
// Ce que le poste ne fait PAS, volontairement : il ne demande ni photo ni
// empreinte. C'est un poste de bonne foi, surveillé par les mêmes règles que
// les autres collecteurs — geste double, pointage hors zone, sortie manquante,
// absence inhabituelle remontent tous dans la cloche.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Check, Lock, Undo2 } from 'lucide-react'
import { KorhogoBlasonNuitSvg } from '../components/KorhogoSvg'
import { supabase } from '../lib/supabase'
import {
  DELAI_ENTRE_POINTAGES,
  DUREE_CONFIRMATION,
  SEUIL_ECART_HORLOGE,
  dateLongue,
  ecartDepuis,
  enregistrerPoste,
  heureCourte,
  installerPoste,
  lirePoste,
  messageDe,
  nomEmploye,
  oublierPoste,
  sensSuivant,
} from '../lib/postePointage'
import './PostePointage.css'

// ══════════════════════════════════════════════════════════════════
export default function PostePointage() {
  const [config, setConfig] = useState(null)
  const [code, setCode] = useState('')
  const [installationEnCours, setInstallationEnCours] = useState(false)
  const [erreurInstallation, setErreurInstallation] = useState('')

  const [etat, setEtat] = useState('pret') // pret | travail | confirme | refus
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

  // ─── Le poste est-il déjà installé sur cet appareil ? ───
  useEffect(() => {
    const deja = lirePoste()
    if (deja) {
      setConfig(deja)
      setAvisHorloge(Number(deja.ecart_horloge || 0))
    }
    setCameraDisponible(
      typeof navigator !== 'undefined'
        && !!navigator.mediaDevices
        && !!navigator.mediaDevices.getUserMedia
        && (typeof window === 'undefined' ? true : window.isSecureContext !== false),
    )
  }, [])

  const retenirConfig = useCallback((c) => {
    setConfig(c)
    enregistrerPoste(c)
  }, [])

  // ════════════════════════════════════════════════════════════
  //  L'INSTALLATION — une seule fois par appareil
  // ════════════════════════════════════════════════════════════
  const installer = async () => {
    setInstallationEnCours(true)
    setErreurInstallation('')
    const reponse = await installerPoste(code)
    setInstallationEnCours(false)

    if (reponse.erreur) {
      setErreurInstallation(reponse.erreur)
      return
    }
    setConfig(reponse.config)
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
        p_device_time: avisHorloge > SEUIL_ECART_HORLOGE ? null : new Date().toISOString(),
        p_jeton: jeton,
      })
      if (error) throw error

      const rep = data || {}
      if (rep.ok !== true) throw new Error(messageDe(rep.reason))

      //  L'écart d'horloge que le serveur a constaté : s'il est réel, l'écran le
      //  dit, et le poste cesse d'envoyer sa propre heure — pour ne pas fabriquer
      //  une alerte à chaque geste.
      const ecart = Math.abs(Number(rep.ecart_horloge || 0))
      if (ecart > SEUIL_ECART_HORLOGE) {
        setAvisHorloge(ecart)
        if (config) retenirConfig({ ...config, ecart_horloge: ecart })
      }

      setResultat({
        sens,
        employe,
        heure: rep.check_time ? new Date(rep.check_time) : new Date(),
        suspect: rep.suspect === true,
      })
      setEtat('confirme')
    },
    [config, avisHorloge, retenirConfig],
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

  //  Ce que fait la caméra quand elle lit un badge.
  const badgeLu = useCallback(
    (texte) => {
      const valeur = String(texte || '').trim()
      if (!valeur || enTraitementRef.current) return
      arreterCamera()
      identifierEtPointer(valeur, null)
    },
    [arreterCamera, identifierEtPointer],
  )

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
    } catch {
      scannerRef.current = null
      setCameraDisponible(false)
    }
  }, [badgeLu, cameraDisponible])

  useEffect(() => {
    if (!config) return undefined
    if (etat === 'pret' && !replisPin && !saisieOuverte) {
      demarrerCamera()
    } else {
      arreterCamera()
    }
    return () => arreterCamera()
  }, [etat, config, replisPin, saisieOuverte, demarrerCamera, arreterCamera])

  //  La confirmation s'efface toute seule, et l'écran revient au scan.
  useEffect(() => {
    if (etat !== 'confirme') return undefined
    if (retourRef.current) clearTimeout(retourRef.current)
    retourRef.current = setTimeout(() => {
      setResultat(null)
      setEtat('pret')
    }, DUREE_CONFIRMATION)
    return () => {
      if (retourRef.current) clearTimeout(retourRef.current)
    }
  }, [etat])

  const detacherLePoste = () => {
    arreterCamera()
    oublierPoste()
    setConfig(null)
    setCode('')
    setReglagesOuverts(false)
    setEtat('pret')
    setAvisHorloge(0)
  }

  const revenirAuScan = () => {
    setRefus('')
    setReplisPin(null)
    setCodeSaisi('')
    setEtat('pret')
  }

  // ════════════════════════════════════════════════════════════
  //  L'INSTALLATION À L'ÉCRAN
  // ════════════════════════════════════════════════════════════
  if (!config) {
    return (
      <div className="pp-page pp-page--installation">
        <div className="pp-couture" aria-hidden="true" />
        <div className="pp-installation">
          <KorhogoBlasonNuitSvg size={64} />
          <p className="pp-eyebrow">Collecteurs · pointage</p>
          <h1 className="pp-titre-installation">Poste de pointage</h1>
          <p className="pp-texte-installation">
            Cet appareil va rester allumé à l’entrée. Les employés présenteront leur badge devant la
            caméra : leur arrivée et leur départ seront enregistrés, sans pointeuse et sans rien
            installer sur leur téléphone.
          </p>

          <label className="pp-champ pp-champ-installation">
            <span className="pp-etiquette">Code de l’entreprise</span>
            <input
              type="text"
              value={code}
              onChange={(evenement) => setCode(evenement.target.value)}
              onKeyDown={(evenement) => evenement.key === 'Enter' && installer()}
              placeholder="ex. ENC-229"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {erreurInstallation && <p className="pp-erreur" role="alert">{erreurInstallation}</p>}

          <button
            type="button"
            className="pp-bouton pp-bouton--large"
            onClick={installer}
            disabled={installationEnCours}
          >
            {installationEnCours ? 'Installation…' : 'Installer ce poste'}
          </button>

          <p className="pp-note">
            Ce code vous a été remis avec votre accès. Il ne se saisit qu’une fois sur cet appareil, et
            se retrouve dans <strong>Configuration pointeuse</strong>, onglet <em>Poste de pointage</em>.
          </p>
        </div>
        <div className="pp-couture pp-couture--basse" aria-hidden="true" />
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  //  L'ÉCRAN DU POSTE
  // ════════════════════════════════════════════════════════════
  return (
    <div className="pp-page">
      <div className="pp-couture" aria-hidden="true" />

      <header className="pp-entete">
        <div className="pp-entete-gauche">
          <KorhogoBlasonNuitSvg size={40} />
          <div className="pp-entete-textes">
            <p className="pp-nom-entreprise">{config.nom || 'Poste de pointage'}</p>
            <p className="pp-sous-titre">{dateLongue(maintenant)}</p>
          </div>
        </div>

        <div className="pp-entete-droite">
          <p className="pp-horloge" aria-label="Heure de ce poste">
            {maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <button
            type="button"
            className="pp-bouton-discret"
            aria-expanded={reglagesOuverts}
            onClick={() => setReglagesOuverts((v) => !v)}
          >
            Réglages
          </button>
        </div>
      </header>

      {avisHorloge > SEUIL_ECART_HORLOGE && (
        <p className="pp-avis-horloge" role="status">
          L’heure de cet appareil est décalée de {Math.round(avisHorloge / 60)} minute(s) sur celle du
          serveur. Corrigez l’heure automatique dans les réglages de la tablette : tant que ce n’est pas
          fait, les employés lisent une heure fausse à l’écran.
        </p>
      )}

      {reglagesOuverts && (
        <aside className="pp-reglages" aria-label="Réglages de ce poste">
          <dl className="pp-reglages-fiche">
            <div>
              <dt>Entreprise</dt>
              <dd>{config.nom || '—'}</dd>
            </div>
            <div>
              <dt>Identifiant de ce poste</dt>
              <dd><code>{config.device_id}</code></dd>
            </div>
            <div>
              <dt>Installé le</dt>
              <dd>{config.installe_le ? new Date(config.installe_le).toLocaleString('fr-FR') : '—'}</dd>
            </div>
          </dl>

          <div className="pp-reglages-gestes">
            <button type="button" className="pp-bouton-discret" onClick={() => demarrerCamera()}>
              Réessayer la caméra
            </button>
            <button type="button" className="pp-bouton-discret pp-bouton-discret--danger" onClick={detacherLePoste}>
              Changer d’entreprise
            </button>
          </div>

          <p className="pp-note pp-note--reglages">
            L’identifiant de ce poste sert à le reconnaître si vous appelez le support. Il ne change pas
            tant que vous ne réinstallez pas le poste.
          </p>
        </aside>
      )}

      <main className="pp-centre">
        {/* ─── La confirmation ─── */}
        {etat === 'confirme' && resultat && (
          <div className="pp-grande-carte" data-etat="confirme" data-sens={resultat.sens}>
            <span className="pp-rond" aria-hidden="true">
              {resultat.sens === 'in'
                ? <Check size={36} strokeWidth={3} />
                : <Undo2 size={34} strokeWidth={2.6} />}
            </span>
            <h2 className="pp-nom-confirme">{nomEmploye(resultat.employe)}</h2>
            <p className="pp-geste">
              {resultat.deja
                ? `Vous venez de pointer — ${heureCourte(resultat.heure)}`
                : `${resultat.sens === 'in' ? 'Arrivée' : 'Départ'} enregistré à ${heureCourte(resultat.heure)}`}
            </p>
            {resultat.suspect && !resultat.deja && (
              <p className="pp-mention-suspect">
                Ce pointage a été marqué pour vérification par le serveur — l’administration en sera
                informée.
              </p>
            )}
            <p className="pp-reviendra">L’écran revient au badge dans un instant…</p>
          </div>
        )}

        {/* ─── Le refus ─── */}
        {etat === 'refus' && (
          <div className="pp-grande-carte" data-etat="refus">
            <span className="pp-rond" aria-hidden="true"><AlertTriangle size={34} strokeWidth={2.4} /></span>
            <h2 className="pp-nom-confirme">Pointage non enregistré</h2>
            <p className="pp-message-refus">{refus}</p>
            <button type="button" className="pp-bouton pp-bouton--large" onClick={revenirAuScan}>
              Réessayer
            </button>
          </div>
        )}

        {/* ─── L'attente : la caméra et le badge ─── */}
        {(etat === 'pret' || etat === 'travail') && (
          <>
            {etat === 'travail' ? (
              <div className="pp-grande-carte" data-etat="travail">
                <span className="pp-rond pp-rond--attente" aria-hidden="true">
                  <span className="pp-rond-anneau" />
                </span>
                <h2 className="pp-nom-confirme">Un instant…</h2>
                <p className="pp-consigne">Votre pointage est en cours d’enregistrement.</p>
              </div>
            ) : replisPin ? (
              <div className="pp-grande-carte" data-etat="pin">
                <span className="pp-rond pp-rond--neutre" aria-hidden="true"><Lock size={26} /></span>
                <h2 className="pp-nom-confirme">Votre code personnel</h2>
                <p className="pp-consigne">
                  Ce badge demande votre code à quatre chiffres. Saisissez-le, puis validez.
                </p>
                <input
                  className="pp-champ-code"
                  value={codeSaisi}
                  onChange={(evenement) => setCodeSaisi(evenement.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(evenement) => {
                    if (evenement.key === 'Enter' && codeSaisi) {
                      const numero = replisPin.numero
                      const codePersonnel = codeSaisi
                      setReplisPin(null)
                      setCodeSaisi('')
                      identifierEtPointer(numero, codePersonnel)
                    }
                  }}
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="••••"
                  aria-label="Code personnel"
                />
                <div className="pp-boutons-ligne">
                  <button
                    type="button"
                    className="pp-bouton"
                    disabled={!codeSaisi}
                    onClick={() => {
                      const numero = replisPin.numero
                      const codePersonnel = codeSaisi
                      setReplisPin(null)
                      setCodeSaisi('')
                      identifierEtPointer(numero, codePersonnel)
                    }}
                  >
                    Valider mon pointage
                  </button>
                  <button type="button" className="pp-bouton-creux" onClick={revenirAuScan}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="pp-scan">
                <p className="pp-consigne-grande">Présentez votre badge devant la caméra</p>

                <div className="pp-cadre-camera">
                  <span className="pp-cadre-coin pp-cadre-coin--hg" aria-hidden="true" />
                  <span className="pp-cadre-coin pp-cadre-coin--hd" aria-hidden="true" />
                  <span className="pp-cadre-coin pp-cadre-coin--bg" aria-hidden="true" />
                  <span className="pp-cadre-coin pp-cadre-coin--bd" aria-hidden="true" />
                  <div id="zone-badge" className="pp-zone-camera" />
                  {!cameraDisponible && (
                    <div className="pp-sans-camera">
                      <p className="pp-sans-camera-titre">La caméra n’est pas disponible sur cet appareil.</p>
                      <p className="pp-sans-camera-texte">
                        Utilisez la saisie ci-dessous : votre numéro, puis votre code personnel.
                      </p>
                    </div>
                  )}
                </div>

                <p className="pp-astuce">
                  Le badge est reconnu en une seconde. Le geste enregistré est l’inverse du précédent :
                  arrivée si vous étiez sorti, départ si vous étiez présent.
                </p>

                {!saisieOuverte ? (
                  <button type="button" className="pp-lien" onClick={() => setSaisieOuverte(true)}>
                    Pas de badge sous la main ? Saisir mon numéro
                  </button>
                ) : (
                  <div className="pp-bloc-saisie">
                    <div className="pp-saisie-champs">
                      <label className="pp-champ">
                        <span className="pp-etiquette">Votre numéro</span>
                        <input
                          type="text"
                          value={numeroSaisi}
                          onChange={(evenement) => setNumeroSaisi(evenement.target.value)}
                          placeholder="ex. ENN-0002"
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>
                      <label className="pp-champ">
                        <span className="pp-etiquette">Code personnel</span>
                        <input
                          type="password"
                          value={codeSaisi}
                          onChange={(evenement) => setCodeSaisi(evenement.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="••••"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    <div className="pp-boutons-ligne">
                      <button
                        type="button"
                        className="pp-bouton"
                        disabled={!numeroSaisi}
                        onClick={() => {
                          const numero = numeroSaisi.trim()
                          const codePersonnel = codeSaisi
                          setNumeroSaisi('')
                          setCodeSaisi('')
                          setSaisieOuverte(false)
                          identifierEtPointer(numero, codePersonnel)
                        }}
                      >
                        Pointer
                      </button>
                      <button
                        type="button"
                        className="pp-bouton-creux"
                        onClick={() => {
                          setSaisieOuverte(false)
                          setNumeroSaisi('')
                          setCodeSaisi('')
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                    <p className="pp-note">
                      Votre numéro figure sur votre badge, sous le code-barres. Le code personnel est
                      celui que vous utilisez sur l’application.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="pp-pied">
        <span>En-Check — poste de pointage</span>
        <span className="pp-pied-sep" aria-hidden="true">·</span>
        <span>Les pointages de ce poste portent la provenance « poste »</span>
      </footer>
    </div>
  )
}
