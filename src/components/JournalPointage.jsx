// src/components/JournalPointage.jsx
//
// 📓 QUI A TOUCHÉ À CES POINTAGES ?
//
// Ce bloc se pose dans la fenêtre de modification des pointages. Il raconte, en
// clair et dans l'ordre, tout ce qui est arrivé aux pointages de la journée :
// qui les a écrits à la main, qui les a modifiés, qui en a supprimé un, avec
// l'heure exacte et la valeur d'avant / la valeur d'après.
//
// L'auteur n'est pas déclaré par le navigateur : c'est la base qui le constate
// au moment du geste. Un pointage modifié depuis une session ne peut donc pas
// prétendre avoir été modifié par quelqu'un d'autre.
//
// Usage :
//   <JournalPointage employeeId={id} jour="2026-10-02" />  → tout ce qui est
//                                                            arrivé À CET
//                                                            EMPLOYÉ ce jour-là
//   <JournalPointage pointageIds={[id1, id2, …]} />        → ces pointages-là
//   <JournalPointage attendanceId={unSeulId} />            → un seul pointage
//   <JournalPointage />                                    → les 50 dernières
//                                                            interventions de
//                                                            l'entreprise
//
// Les deux premiers se cumulent volontairement. Une correction d'horaire ne
// modifie pas les pointages : elle les REMPLACE (les anciens sont effacés, les
// nouveaux portent de nouveaux identifiants). En cherchant uniquement les
// identifiants affichés à l'écran, on ne retrouvait donc jamais la correction la
// plus récente — celle qui vient d'être faite. C'est la paire employé + journée
// qui garde le fil.

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Les champs qu'on sait nommer en français. Les autres s'affichent tels quels.
const LIBELLES = {
  check_time: "Heure du pointage",
  check_type: "Sens (entrée ou sortie)",
  employee_id: "Employé",
  method: "Procédé",
  is_within_zone: "Dans la zone",
  distance_meters: "Distance du site",
  suspect: "Marqué suspect",
  suspect_reason: "Motif de suspicion",
  clock_skew_seconds: "Décalage de l'horloge",
  photo_path: "Photo",
  notes: "Note",
  note: "Note",
}

const ACTIONS = {
  creation_manuelle: { mot: "Écrit à la main", couleur: "#2563EB", fond: "#EFF6FF" },
  modification: { mot: "Modifié", couleur: "#D97706", fond: "#FFFBEB" },
  suppression: { mot: "Supprimé", couleur: "#DC2626", fond: "#FEF2F2" },
}

const PROCEDES = {
  manual: "à la main",
  adms: "par la pointeuse",
  device: "par la pointeuse",
  mobile: "par le téléphone",
  import: "par un import",
  web: "depuis un poste",
  qr: "par le badge",
  poste: "au poste de pointage",
}

function valeur(k, v) {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Oui" : "Non"
  if (k === "employee_id") return "un autre employé"
  if (k === "method") return PROCEDES[v] || v
  if (k === "clock_skew_seconds") return `${v} s`
  if (k === "distance_meters") return `${v} m`
  if (k === "check_type") {
    const t = String(v).toLowerCase()
    if (["in", "entree", "entrée", "arrivee", "arrivée", "checkin"].includes(t)) return "Entrée"
    if (["out", "sortie", "depart", "départ", "checkout"].includes(t)) return "Sortie"
    return String(v)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d)) {
      const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
      const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      return `${heure}${jour === new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) ? "" : ` (${jour})`}`
    }
  }
  return s.length > 60 ? s.slice(0, 60) + "…" : s
}

// ─── Une journée corrigée s'écrit en deux listes : ce qu'il y avait, ce qu'il y a.
//     On les rapproche par sens (entrée avec entrée, sortie avec sortie), dans
//     l'ordre des heures : c'est ce qui se lit d'un coup d'œil.
function lignesComparaison(avant, apres) {
  const normalise = (v) => {
    const liste = Array.isArray(v) ? v : v ? [v] : []
    return liste
      .map((p, i) => ({ i, type: String(p?.check_type || "").toLowerCase(), ts: p?.check_time || null }))
      .filter((p) => p.ts)
      .sort((a, b) => new Date(a.ts) - new Date(b.ts))
  }
  const A = normalise(avant)
  const B = normalise(apres)
  //  Les lignes suivent l'ordre des heures : la première entrée de la journée
  //  d'abord. L'ordre du tableau reçu du serveur, lui, n'est pas garanti.
  const premier = (t) => {
    const temps = [...A, ...B]
      .filter((p) => p.type === t)
      .map((p) => new Date(p.ts).getTime())
      .filter((n) => !isNaN(n))
    return temps.length ? Math.min(...temps) : Number.MAX_SAFE_INTEGER
  }
  const types = [...new Set([...A.map((p) => p.type), ...B.map((p) => p.type)])]
    .sort((x, y) => premier(x) - premier(y))

  const lignes = []
  for (const t of types) {
    const deA = A.filter((p) => p.type === t)
    const deB = B.filter((p) => p.type === t)
    for (let i = 0; i < Math.max(deA.length, deB.length); i++) {
      lignes.push({ type: t, avant: deA[i]?.ts || null, apres: deB[i]?.ts || null })
    }
  }
  return lignes
}

// ─── Ce qu'on dit à l'écran quand la lecture échoue.
//     Jamais le message brut du serveur : il parle de « schéma », de « cache » et
//     de noms de fonctions — personne n'a besoin de lire ça devant un employé.
function messageDErreur(e) {
  const brut = String(e?.message || '')
  const code = String(e?.code || '')
  if (code === 'PGRST202' || /schema cache|Could not find the function/i.test(brut)) {
    return "Le journal n'est pas encore activé sur ce serveur. Il s'activera dès que la mise à jour de la base aura été appliquée — rechargez ensuite cette page."
  }
  if (/JWT|jeton|token|session/i.test(brut)) {
    return "Votre session a expiré. Reconnectez-vous, puis rouvrez cette fenêtre."
  }
  return "Le journal est momentanément indisponible. Réessayez dans un instant."
}

function quand(v) {
  if (!v) return ""
  const d = new Date(v)
  if (isNaN(d)) return ""
  const auj = new Date()
  const memeJour = d.toDateString() === auj.toDateString()
  const jour = memeJour
    ? "aujourd'hui"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })
  return `${jour} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
}

export default function JournalPointage({
  pointageIds = null,
  attendanceId = null,
  employeeId = null,
  jour = null,
  max = 50,
}) {
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState("")
  const [ouvert, setOuvert] = useState(false)

  //  La fenêtre qui nous héberge reconstruit sa liste de pointages à chaque frappe :
  //  on la réduit à un texte stable, sinon la lecture du registre se relancerait à
  //  chaque caractère tapé dans un champ d'heure.
  const filtreParListe = Array.isArray(pointageIds)
  const clePointages = filtreParListe ? pointageIds.join(",") : ""


  const charger = useCallback(async () => {
    setChargement(true)
    setErreur("")
    try {
      const admin = JSON.parse(localStorage.getItem("admin") || "{}")
      const enterpriseId = admin?.selectedEnterprise?.id || admin?.enterprise_id || null
      if (!enterpriseId) {
        setErreur("Aucune entreprise sélectionnée.")
        setLignes([])
        return
      }

      //  Aucun pointage encore enregistré sur cette journée : il n'y a rien à raconter,
      //  et rien à demander au serveur.
      const ids = filtreParListe && clePointages ? clePointages.split(",").filter(Boolean) : null
      //  Aucun pointage enregistré sur cette journée : rien à raconter — sauf si on
      //  interroge un employé, car une correction peut avoir tout retiré.
      if (filtreParListe && (!ids || ids.length === 0) && !employeeId) {
        setLignes([])
        setChargement(false)
        return
      }

      const { data, error } = await supabase.rpc("encheck_journal_lire", {
        p_enterprise: enterpriseId,
        //  Filtré sur les pointages de la fenêtre : on veut tout ce qui les concerne,
        //  même sur une grosse journée. Sans filtre, on suit le réglage de la fenêtre.
        p_limite: Math.max(1, Math.min(filtreParListe || employeeId ? 200 : Number(max) || 50, 300)),
        p_attendance: attendanceId || null,
        p_attendances: ids,
        p_employee: employeeId || null,
        p_jour: jour || null,
      })
      if (error) throw error

      setLignes(Array.isArray(data) ? data : [])
    } catch (e) {
      //  La cause technique reste dans la console du navigateur, pour la personne
      //  qui cherchera le vrai problème. L'écran, lui, ne montre qu'une phrase.
      console.warn('[journal des modifications] lecture impossible :', e?.message || e)
      setErreur(messageDErreur(e))
      setLignes([])
    } finally {
      setChargement(false)
    }
  }, [attendanceId, filtreParListe, clePointages, employeeId, jour, max])

  useEffect(() => {
    charger()
  }, [charger])

  const compteur = lignes.length

  return (
    <div style={s.cadre}>
      <button type="button" onClick={() => setOuvert((v) => !v)} style={s.entete}>
        <span style={s.pastille}>📓</span>
        <span style={s.titre}>Qui a touché à ces pointages ?</span>
        <span style={s.compteur}>
          {chargement ? "…" : compteur === 0 ? "aucune intervention" : `${compteur} intervention${compteur > 1 ? "s" : ""}`}
        </span>
        <span style={{ ...s.chevron, transform: ouvert ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {ouvert && (
        <div style={s.corps}>
          {chargement && <p style={s.vide}>Lecture du journal…</p>}

          {!chargement && erreur && (
            <div style={s.blocErreur}>
              <p style={{ ...s.vide, color: "#B91C1C" }}>{erreur}</p>
              <button type="button" onClick={charger} style={s.boutonReessayer}>
                Réessayer
              </button>
            </div>
          )}

          {!chargement && !erreur && compteur === 0 && (
            <p style={s.vide}>
              Aucune intervention enregistrée sur ces pointages. Le journal note désormais toute
              écriture à la main, toute modification et toute suppression, avec le nom de la
              personne et l'heure du geste.
              <br />
              <span style={s.note}>
                L'écriture, la modification et la suppression sont aussi annoncées dans la cloche.
              </span>
            </p>
          )}

          {!chargement && !erreur && compteur > 0 && (
            <ul style={s.liste}>
              {lignes.map((l) => {
                const a = ACTIONS[l.action] || { mot: l.action, couleur: "#475569", fond: "#F8FAFC" }
                const champs = Array.isArray(l.champs) ? l.champs : []
                return (
                  <li key={l.id} style={s.item}>
                    <div style={s.ligne1}>
                      <span style={{ ...s.etiquette, color: a.couleur, background: a.fond }}>{a.mot}</span>
                      <span style={s.qui}>{l.auteur || "auteur inconnu"}</span>
                      <span style={s.quand}>{quand(l.quand)}</span>
                    </div>

                    {l.motif && <p style={s.motif}>Motif donné : « {l.motif} »</p>}

                    {Array.isArray(l.avant) || Array.isArray(l.apres) ? (
                      <div style={s.grille}>
                        {lignesComparaison(l.avant, l.apres).map((x, i) => (
                          <div key={`${x.type}-${i}`} style={s.compare}>
                            <span style={s.sens}>{valeur("check_type", x.type) === "—" ? "Pointage" : valeur("check_type", x.type)}</span>
                            <span style={x.avant ? s.avant : s.rien}>
                              {x.avant ? valeur("check_time", x.avant) : "rien"}
                            </span>
                            <span style={s.fleche}>→</span>
                            <span style={x.apres ? s.apres : s.retire}>
                              {x.apres ? valeur("check_time", x.apres) : "retiré"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                    <div style={s.detail}>
                      {l.action === "creation_manuelle" && (
                        <span>
                          Pointage écrit à la main
                          {l.employe ? ` pour ${l.employe}` : ""} — {valeur("check_time", l.apres?.check_time)}
                          {l.apres?.check_type ? `, ${valeur("check_type", l.apres.check_type).toLowerCase()}` : ""}
                          .
                        </span>
                      )}

                      {l.action === "suppression" && (
                        <span>
                          Pointage supprimé{l.employe ? ` pour ${l.employe}` : ""} — c'était{" "}
                          {valeur("check_time", l.avant?.check_time)}
                          {l.avant?.check_type ? `, ${valeur("check_type", l.avant.check_type).toLowerCase()}` : ""}
                          .
                        </span>
                      )}

                      {l.action !== "creation_manuelle" && l.action !== "suppression" && (
                        <span>
                          {l.employe ? `${l.employe} — ` : ""}
                          {champs.length === 0 && "aucun détail"}
                          {champs.map((k, i) => (
                            <span key={k}>
                              {i > 0 && " · "}
                              <strong style={s.champ}>{LIBELLES[k] || k}</strong>
                              {" : "}
                              <span style={s.avant}>{valeur(k, l.avant?.[k])}</span>
                              {" → "}
                              <span style={s.apres}>{valeur(k, l.apres?.[k])}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    )}

                    <div style={s.pied}>
                      {l.source === "service"
                        ? "geste hors application (service, import, correction automatisée)"
                        : "geste fait depuis l'application"}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  cadre: {
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    background: "#FFFFFF",
    overflow: "hidden",
    marginTop: 12,
  },
  entete: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 12px",
    background: "#F8FAFC",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  pastille: { fontSize: 15, lineHeight: 1 },
  titre: { flex: 1, fontSize: 13, fontWeight: 600, color: "#0F172A" },
  compteur: { fontSize: 11.5, color: "#64748B", whiteSpace: "nowrap" },
  chevron: { fontSize: 11, color: "#94A3B8", transition: "transform .15s" },
  corps: { padding: "10px 12px 12px" },
  vide: { margin: 0, fontSize: 12.5, color: "#64748B", lineHeight: 1.55 },
  note: { color: "#94A3B8" },
  blocErreur: { display: "grid", gap: 8, justifyItems: "start" },
  boutonReessayer: {
    fontSize: 12,
    color: "#334155",
    background: "#F1F5F9",
    border: "1px solid #CBD5E1",
    borderRadius: 7,
    padding: "6px 12px",
    cursor: "pointer",
  },
  liste: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  item: {
    borderLeft: "3px solid #E2E8F0",
    paddingLeft: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },
  ligne1: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  etiquette: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".04em",
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: 4,
  },
  qui: { fontSize: 12.5, fontWeight: 600, color: "#0F172A" },
  quand: { fontSize: 11.5, color: "#64748B" },
  detail: { fontSize: 12.5, color: "#334155", lineHeight: 1.55, marginTop: 3 },
  motif: { margin: "3px 0 0", fontSize: 12, color: "#475569", fontStyle: "italic" },
  grille: { display: "grid", gap: 3, marginTop: 4 },
  compare: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12.5 },
  sens: { minWidth: 58, color: "#475569" },
  fleche: { color: "#94A3B8" },
  rien: { color: "#94A3B8" },
  retire: { color: "#B91C1C", fontWeight: 600 },
  champ: { fontWeight: 600, color: "#0F172A" },
  avant: { color: "#B91C1C", textDecoration: "line-through" },
  apres: { color: "#15803D", fontWeight: 600 },
  pied: { fontSize: 10.5, color: "#94A3B8", marginTop: 3 },
}
