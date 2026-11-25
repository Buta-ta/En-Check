// ═══════════════════════════════════════════════════════════
// 🪧 ABSENCES — LA POUTRE : SEPT PAN CARTES PENDUES AU BORD DU BAS DE LA CHEMISE
//
// Maquette retenue `maquettes/absences-raccord-R1-poutre.png` (2/12/2026) :
// « je choisis la R1-poutre. Je veux exactement ce résultat. Code maintenant ».
// Elle succède à `maquettes/absences-kpi-P1-etagere.png` (30/11), que le fondateur
// avait déjà validée sur la FIGURE — six pancartes pendues, pas un ruban coupé de
// filets — mais pas sur le RACCORD, qu'il a redit trois fois : « relier l'étagère au
// bloc d'en haut, les accrocher là ».
//
// Une carte = une question que se pose un RH en ouvrant la page : qui manque
// aujourd'hui, combien ce mois, quoi traiter maintenant. Deux portent une jauge, une
// montre les visages du jour, deux se cliquent et mènent droit au bon filtre.
//
// CE QUI CHANGE ICI, ET RIEN D'AUTRE. La septième planche est le solde de congés que
// le transat portait à cru au-dessus de la rangée : le bloc est descendu DANS la
// rangée (deux affichages d'un même nombre se tolèrent, deux calculs jamais — il vient
// de `services/congesRestants`, comme avant). Et les deux longues cordes qui
// traversaient une bande de 253 px sont parties avec le bloc : chaque planche tient
// DÉSORMAIS SES cordes, courtes, qui s'arrêtent sur le trait d'encre de la chemise.
// La géométrie (20 px de `<main>`, 10 px de traverse, 40 px de retrait) est sous
// `🪧 LA POUTRE` dans `AbsencesAfroTech.css`.
//
// Tout le dessin est parti dans la feuille. Ce fichier ne pose un nombre en ligne
// qu'à deux endroits, et jamais de goût : la largeur d'une jauge (un pourcentage lu en
// base) et le diamètre d'un visage (22 px, l'échelle des tuiles). Les dix-sept
// `style={…}` d'avant étaient invisibles à `npm run charte` — une attribution en ligne
// bat n'importe quel sélecteur de feuille (journal du 22/11).
//
// Composant pur : pas de Supabase, pas d'effet, pas de suppression.
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { isoLocal, estJourOuvre } from '../services/absencesCalendrier'
import { soldeMoyen } from '../services/congesRestants'
import '../pages/AbsencesAfroTech.css'

const pad2 = (n) => String(n).padStart(2, '0')

const jourDe = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : null)

const initialesDe = (prenom, nom) =>
  `${prenom || ''} ${nom || ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

/** Une absence couvre-t-elle la journée `iso` ? (les refusées ne comptent pas) */
function couvreJour(absence, iso) {
  const debut = jourDe(absence.start_date)
  const fin = jourDe(absence.end_date) || debut
  if (!debut) return false
  return debut <= iso && iso <= fin
}

// ── Une photo ronde, avec repli sur les initiales ─────────────────────
// Le rond vient de la feuille (`.abs-planche-visage`), pas d'un `50%` recopié :
// 50 % n'est pas dans la liste des rayons de D-016, et sur un carré de 22 px le
// jeton `999px` donne exactement le même disque.
export function Avatar({ prenom, nom, photo, taille = 22 }) {
  const style = photo ? undefined : { fontSize: Math.max(9, Math.round(taille * 0.36)) }
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className="abs-planche-visage"
        data-testid="abs-kpi-avatar"
        style={{ width: taille, height: taille }}
      />
    )
  }
  return (
    <span
      className="abs-planche-visage"
      data-testid="abs-kpi-avatar"
      aria-hidden="true"
      style={{ width: taille, height: taille, ...style }}
    >
      {initialesDe(prenom, nom)}
    </span>
  )
}

/**
 * Une pancarte. Elle est pendue, donc elle a une tringle au-dessus d'elle, deux
 * cordes et deux anneaux — et un corps qui est soit un `div` (le chiffre
 * renseigne), soit un `button` (le chiffre mène quelque part).
 *
 * Le libellé tient sur DEUX lignes plutôt que de se faire couper : la rangée
 * d'avant écrivait `text-overflow: ellipsis`, c'est-à-dire « le libellé saute
 * s'il est long ». Un libellé entier ne se rogne pas.
 */
function Planche({ testId, valeur, suffixe, label, precision, jauge, action, onClick, couture, children }) {
  const corps = (
    <>
      <p className="abs-planche-label">{label}</p>
      <p className="abs-planche-nombre">
        <span className="abs-planche-chiffre">{valeur}</span>
        {suffixe && <span className="abs-planche-suffixe">{suffixe}</span>}
        {children}
      </p>
      {jauge !== undefined && jauge !== null && (
        <span
          className="abs-planche-jauge"
          data-testid="abs-kpi-jauge"
          role="progressbar"
          aria-valuenow={Math.round(jauge)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* LA seule valeur en ligne de ce fichier : elle est calculée, aucun
              sélecteur de feuille ne peut savoir que le taux fait 41 %. */}
          <i style={{ width: `${Math.max(0, Math.min(100, jauge))}%` }} />
        </span>
      )}
      {couture === 'zigzag' && (
        <span className="abs-planche-couture" data-testid="abs-kpi-couture" aria-hidden="true" />
      )}
      {action && (
        <span className="abs-planche-etiquette">
          {action}
          <ArrowRight size={11} aria-hidden="true" />
        </span>
      )}
    </>
  )

  const attributs = { className: 'abs-planche-corps', title: precision || undefined }

  return (
    <div className="abs-planche" data-testid={testId}>
      {/* les cordes, l'anneau et la traverse sont PORTÉS PAR LA PLANCHE, pas par la
          rangée : à toute largeur d'écran les planches d'un même rang partagent un
          trait continu, et chaque rang qui tombe à l'écran reçoit son propre rang de
          cordes. C'est ce qui rend la poutre responsive sans la défaire — et c'est
          aussi ce qui fait que l'anneau retombe sous la chemise à chaque coupure. */}
      <span className="abs-planche-corde" aria-hidden="true">
        <i />
        <i />
      </span>
      {onClick ? (
        <button type="button" onClick={onClick} {...attributs}>
          {corps}
        </button>
      ) : (
        <div {...attributs}>{corps}</div>
      )}
    </div>
  )
}

export default function AbsencesKpiCards({
  absences = [],
  employes = [],
  conflitsEnAttente = 0,
  joursPrisParEmploye = {},
  plafondConges = 30,
  // Le solde que portait le transat, et le jour du prochain retour. Ils entrent par
  // props parce que la PAGE les calcule déjà (`transat`) : les re-calculer ici serait
  // le deuxième calcul d'un même nombre, ce que la maison refuse.
  jours = null,
  retour = null,
  onVoirConflits,
  onVoirDemandes,
}) {
  const mesures = useMemo(() => {
    const aujourdhui = isoLocal(new Date())
    const actifs = employes.length
    const maintenant = new Date()
    const annee = maintenant.getFullYear()
    const mois = maintenant.getMonth()

    // ── Qui manque aujourd'hui ───────────────────────────────────────
    const absents = []
    const ids = new Set()
    absences.forEach((a) => {
      if ((a.status || 'approuve') === 'refuse') return
      if (!couvreJour(a, aujourdhui)) return
      const e = employes.find((x) => x.id === a.employee_id) || a.employes
      if (!e || ids.has(e.id)) return
      ids.add(e.id)
      absents.push(e)
    })

    // ── Ce mois : combien d'absences, combien de jours ───────────────
    const duMois = absences.filter((a) => {
      const debut = jourDe(a.start_date)
      return debut && `${debut.slice(0, 7)}` === `${annee}-${pad2(mois + 1)}`
    })

    const joursDecomptes = duMois.reduce((total, a) => {
      const debut = jourDe(a.start_date)
      const fin = jourDe(a.end_date) || debut
      let compte = 0
      let curseur = debut
      let garde = 0
      while (curseur <= fin && garde < 400) {
        if (a.count_holidays_as_leave || estJourOuvre(curseur)) compte += 1
        const d = new Date(`${curseur}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 1)
        curseur = d.toISOString().slice(0, 10)
        garde += 1
      }
      return total + compte
    }, 0)

    // ── Taux d'absence du mois : jours perdus / jours ouvrés possibles
    const total = new Date(annee, mois + 1, 0).getDate()
    let jourOuvresDuMois = 0
    for (let d = 1; d <= total; d += 1) {
      if (estJourOuvre(`${annee}-${pad2(mois + 1)}-${pad2(d)}`)) jourOuvresDuMois += 1
    }
    const capacite = Math.max(1, actifs * jourOuvresDuMois)
    const tauxAbsence = Math.round((joursDecomptes / capacite) * 1000) / 10

    // ── Congés : ce qu'il reste en moyenne par employé ───────────────
    // Le calcul est sorti dans `services/congesRestants` : la section du haut (le
    // transat, maquette E du 27/11) suspend le MÊME nombre. Deux affichages d'un
    // chiffre, oui ; deux calculs d'un même chiffre, jamais — l'un des deux finirait
    // par rester faux le jour où l'autre est corrigé.
    const plafond = plafondConges || 30
    const solde = soldeMoyen({ employes, joursPrisParEmploye, plafond })
    const tauxConges = Math.round((solde / plafond) * 1000) / 10

    const enAttente = absences.filter((a) => (a.status || 'approuve') === 'en_attente').length

    return {
      aujourdhui,
      effectif: actifs,
      absents,
      taux: actifs ? Math.round((absents.length / actifs) * 100) : 0,
      duMois: duMois.length,
      joursDecomptes,
      tauxAbsence,
      soldeMoyen: solde,
      tauxConges,
      plafond,
      enAttente,
      enCours: absences.filter((a) => {
        const debut = jourDe(a.start_date)
        const fin = jourDe(a.end_date) || debut
        return debut <= aujourdhui && aujourdhui <= fin && (a.status || 'approuve') !== 'refuse'
      }).length,
    }
  }, [absences, employes, joursPrisParEmploye, plafondConges])

  const apercu = mesures.absents.slice(0, 4)
  const enPlus = mesures.absents.length - apercu.length

  return (
    <div
      className="abs-etagere"
      data-testid="abs-kpi-grille"
      title={`Chiffres calculés sur les absences chargées · aujourd'hui = ${mesures.aujourdhui}`}
    >
      <div className="abs-etagere-planches">
        {/* 1. Qui manque aujourd'hui — avec les visages */}
        <Planche
          testId="abs-kpi-absents"
          valeur={mesures.absents.length}
          label="Absents aujourd'hui"
          precision={`sur ${mesures.effectif} employé${mesures.effectif > 1 ? 's' : ''} · ${mesures.taux} % de l'effectif`}
        >
          {apercu.length > 0 && (
            <span className="abs-planche-visages">
              {apercu.map((e) => (
                <Avatar key={e.id} prenom={e.first_name} nom={e.last_name} photo={e.photo_url} />
              ))}
              {enPlus > 0 && <span className="abs-planche-plus">+{enPlus}</span>}
            </span>
          )}
        </Planche>

        {/* 2. Le mois en cours */}
        <Planche
          testId="abs-kpi-mois"
          valeur={mesures.duMois}
          label="Absences ce mois-ci"
          precision={`${mesures.joursDecomptes} jour${mesures.joursDecomptes > 1 ? 's' : ''} décompté${mesures.joursDecomptes > 1 ? 's' : ''}`}
        />

        {/* 3. Taux d'absence du mois */}
        <Planche
          testId="abs-kpi-taux"
          valeur={mesures.tauxAbsence}
          suffixe="%"
          label="Taux d'absence du mois"
          precision="jours d'absence / jours ouvrés de l'effectif"
          jauge={mesures.tauxAbsence}
        />

        {/* 4. Congés restants. Le MÊME nombre que celui que le transat porte au creux
            de sa corde — deux affichages, un seul calcul (`soldeMoyen`). La redite est
            voulue par la maquette : ici on la lit, plus loin on la voit pendre. */}
        <Planche
          testId="abs-kpi-conges"
          valeur={mesures.soldeMoyen}
          suffixe="j"
          label="Congés restants (moyenne)"
          precision={`plafond ${mesures.plafond} jours · ${mesures.tauxConges} % encore disponible`}
          jauge={mesures.tauxConges}
        />

        {/* 5. LE SOLDE, jadis porté à cru par le transat au-dessus de la rangée. R1 le
            veut PENDU avec les autres : même nombre, même calcul, une planche de plus.
            Le jour du retour descend avec lui — c'était la seule autre information du
            bloc, et une date qu'on ne montre plus est une date perdue. */}
        {jours == null ? (
          <Planche
            testId="abs-kpi-solde"
            valeur="—"
            label="Jours de congé qui restent"
            precision="soldes non chargés : aucun effectif, aucun jour pris"
          />
        ) : (
          <Planche
            testId="abs-kpi-solde"
            valeur={jours}
            suffixe="j"
            label="Jours de congé qui restent"
            precision={`plafond ${mesures.plafond} jours · moyenne de l'effectif`}
          >
            {retour && (
              <span className="abs-planche-note" data-testid="abs-kpi-retour">
                retour {retour}
              </span>
            )}
          </Planche>
        )}

        {/* 6 et 7. Ce qui se traite : les deux seules pancartes qui se cliquent */}
        <Planche
          testId="abs-kpi-attente"
          valeur={mesures.enAttente}
          label="Demandes en attente"
          precision={mesures.enAttente ? 'à valider ou à refuser' : 'aucune demande en souffrance'}
          action={mesures.enAttente ? 'Traiter' : undefined}
          onClick={onVoirDemandes}
        />

        <Planche
          testId="abs-kpi-conflits"
          valeur={conflitsEnAttente}
          label="Conflits absence / pointage"
          precision={conflitsEnAttente ? 'un pointage sur une absence déclarée' : 'aucun conflit à arbitrer'}
          action={conflitsEnAttente ? 'Arbitrer' : undefined}
          couture={conflitsEnAttente ? 'zigzag' : undefined}
          onClick={onVoirConflits}
        />
      </div>
    </div>
  )
}
