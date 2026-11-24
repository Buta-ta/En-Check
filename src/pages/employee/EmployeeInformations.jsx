// src/pages/employee/EmployeeInformations.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 👁️ MES INFORMATIONS — ce qu'on m'a dit, et ce que je n'ai pas encore lu
//
// Maquette retenue le 24/11/2026 : `maquettes/choix-informations-employe-1.png`
// (option 2 sur 2). Le fondateur a choisi le REGISTRE : une feuille, une bande
// de bogolan en tête, un tableau à colonnes séparées par des filets, le tampon
// « à consulter » en pointillé incliné, et un pied daté.
//
// CE QUE CET ÉCRAN EST
//   Le versant employé du devoir d'informer (§3.5.g). La base a déjà écrit, au
//   moment de l'acte, la phrase exacte qui concerne cette personne. Ici, elle la
//   lit — et la marque lue, elle-même. Personne ne peut le faire à sa place.
//
// CE QUE CET ÉCRAN NE FAIT PAS
//   · il ne compose aucun texte : le contenu vient figé de la base ;
//   · il ne transmet aucun identifiant d'employé : la RPC le déduit de la
//     session, donc changer l'URL ne donne accès à rien ;
//   · il n'efface rien : marquer « consultée » pose une date, et la première
//     reste la bonne ; l'information reste dans le registre.
//
// ⚠️ Aucune couleur en dur : cette page vit dans la peau de l'espace employé,
//    dont les teintes sont des jetons `--emp-*` (EmployeeInformations.css).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Eye, Inbox, RefreshCw } from 'lucide-react'
import EmployeeLayout from '../../components/EmployeeLayout'
import EmployeeAuthService from '../../services/employeeAuthService'
import toast from 'react-hot-toast'
import {
  compterAConsulter,
  marquerConsultee,
  mesInformations,
} from '../../services/mesInformations'
import { formaterDateCourte } from '../../utils/timezoneUtils'
import './EmployeeInformations.css'

/** Une valeur d'heure, ou un tiret — jamais « 0 » quand on ne sait pas. */
function valeurOuTiret(valeur) {
  if (valeur === null || valeur === undefined) return '—'
  return `${valeur} h`
}

/**
 * Une date lisible, sans jamais inventer : une chaîne absente reste vide.
 * Le fuseau est celui de l'entreprise (`getActiveTimezone`), pas celui du
 * navigateur — un administrateur en France doit voir l'heure de Cotonou.
 */
function dateLisible(valeur) {
  if (!valeur) return ''
  return formaterDateCourte(valeur)
}

export default function EmployeeInformations() {
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [informations, setInformations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const lignes = await mesInformations()
      setInformations(lignes)
    } catch (err) {
      //  On affiche le message traduit par le service : il sait dire « ce compte
      //  n'est rattaché à aucune fiche » plutôt que « erreur 42501 ».
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    const emp = EmployeeAuthService.getEmployee()
    if (!emp) {
      navigate('/employee/login')
      return
    }
    setEmployee(emp)
    charger()
  }, [navigate, charger])

  const restant = useMemo(() => compterAConsulter(informations), [informations])

  const marquer = async (information) => {
    if (information.consulteLe || enCours) return
    setEnCours(information.id)
    try {
      const date = await marquerConsultee(information.id)
      //  On garde la date rendue par la base, pas `new Date()` : c'est elle qui
      //  fait foi, et c'est la première lecture.
      setInformations((liste) =>
        liste.map((i) =>
          i.id === information.id
            ? { ...i, consulteLe: date || i.consulteLe, etat: 'consultee', etatLibelle: 'Consultée' }
            : i,
        ),
      )
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnCours(null)
    }
  }

  if (!employee) return null

  return (
    <EmployeeLayout>
      <div className="einfo-page">
        <div className="einfo-entete">
          <button
            type="button"
            className="einfo-retour"
            onClick={() => navigate('/employee/dashboard')}
          >
            <ArrowLeft size={18} />
            <span>Tableau de bord</span>
          </button>

          <h1 className="einfo-titre">Mes informations</h1>
          <p className="einfo-sous-titre">
            Ce qu’on vous a dit, et ce que vous n’avez pas encore lu.
          </p>
        </div>

        <section className="einfo-feuille" aria-labelledby="einfo-registre">
          <div className="einfo-bande" aria-hidden="true" />

          <div className="einfo-bandeau">
            <h2 id="einfo-registre" className="einfo-bandeau-titre">
              Registre des informations
            </h2>
            <div className="einfo-bandeau-droite">
              <span className="einfo-compte">
                {restant === 0
                  ? 'Tout est lu'
                  : `${restant} à consulter`}
              </span>
              <button
                type="button"
                className="einfo-recharger"
                onClick={charger}
                disabled={chargement}
              >
                <RefreshCw size={14} />
                <span>Actualiser</span>
              </button>
            </div>
          </div>

          {chargement && (
            <p className="einfo-vide">Chargement du registre…</p>
          )}

          {!chargement && erreur && (
            <div className="einfo-erreur" role="alert">
              <p>{erreur}</p>
              <button type="button" className="einfo-recharger" onClick={charger}>
                Réessayer
              </button>
            </div>
          )}

          {!chargement && !erreur && informations.length === 0 && (
            <div className="einfo-vide">
              <Inbox size={28} />
              <p>Rien à vous signaler pour l’instant.</p>
              <small>
                Une information apparaîtra ici dès qu’un réglage vous concernant
                changera.
              </small>
            </div>
          )}

          {!chargement && !erreur && informations.length > 0 && (
            <table className="einfo-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Objet</th>
                  <th scope="col">Avant</th>
                  <th scope="col">Après</th>
                  <th scope="col">État</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {informations.map((info) => {
                  const consultee = Boolean(info.consulteLe)
                  return (
                    <tr
                      key={info.id}
                      className={consultee ? 'einfo-ligne einfo-lue' : 'einfo-ligne'}
                    >
                      <td className="einfo-date">{dateLisible(info.emisLe)}</td>
                      <td>
                        <strong className="einfo-objet">{info.libelle}</strong>
                        <p className="einfo-texte">{info.contenu}</p>
                      </td>
                      <td className="einfo-chiffre">{valeurOuTiret(info.valeurAvant)}</td>
                      <td className="einfo-chiffre">{valeurOuTiret(info.valeurApres)}</td>
                      <td>
                        {consultee ? (
                          <span className="einfo-tampon einfo-tampon-lu">
                            <Check size={12} /> Consultée
                          </span>
                        ) : (
                          <span className="einfo-tampon einfo-tampon-attente">
                            À consulter
                          </span>
                        )}
                      </td>
                      <td>
                        {consultee ? (
                          <span className="einfo-deja">
                            le {dateLisible(info.consulteLe)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="einfo-action"
                            onClick={() => marquer(info)}
                            disabled={enCours === info.id}
                          >
                            <Eye size={14} />
                            <span>{enCours === info.id ? 'Un instant…' : 'J’ai lu'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <p className="einfo-pied">
            {informations.length === 0
              ? 'Aucune information enregistrée à ce jour.'
              : `${informations.length} ${informations.length > 1 ? 'informations' : 'information'} · les textes sont ceux du jour où ils ont été émis`}
          </p>
        </section>
      </div>
    </EmployeeLayout>
  )
}
