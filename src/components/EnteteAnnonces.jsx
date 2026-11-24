// ═══════════════════════════════════════════════════════════════════════════
// 🗂️ L'EN-TÊTE DES ANNONCES — l'onglet, le tampon, le champ souligné
//
// Maquette retenue : `identite/maquettes/entete-annonces-B.png` (25/11).
// Trois formes du kit (D-017) et aucune boîte :
//
//   · l'ONGLET — le titre sort du papier et devient un onglet de dossier
//     qui déborde vers le haut. C'est lui qui dit « on ouvre une page ».
//   · le TAMPON — le blason est un cachet appliqué : double cadre, incliné
//     de 2°. Il ne se contente pas d'être posé au milieu d'une barre.
//   · le CHAMP SOULIGNÉ — « Mon compte » n'est plus une carte, c'est un
//     champ que le trait du bas suffit à désigner.
//
// Ce que j'ai retiré, sur votre mot : la bascule sombre/clair, et la bande
// de bogolan qui ouvrait la page.
//
// ⚠ Un seul titre. Le générateur de la maquette avait écrit « ANNONCES
// D'ACCUEIL » deux fois — dans l'onglet et sur le papier. Un seul suffit :
// l'onglet le porte, la page ne le répète pas.
// ═══════════════════════════════════════════════════════════════════════════
import { ArrowLeft, ArrowUpRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AbomeyBlasonSvg } from './AbomeySvg'
import './EnteteAnnonces.css'

export default function EnteteAnnonces() {
  return (
    <header className="aph">
      {/* ── L'ONGLET ──
          Il est en `position: absolute` au-dessus du papier : c'est son
          débord qui fait l'onglet. Le titre vit dedans, et nulle part
          ailleurs. */}
      <div className="aph-onglet">
        <h1>Annonces d’accueil</h1>
      </div>

      <div className="aph-papier">
        <Link
          className="aph-retour"
          to="/dashboard"
          aria-label="Retour au tableau de bord"
          title="Retour au tableau de bord"
        >
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>

        {/* ── LE TAMPON ──
            Un cachet : fond indigo, double cadre crème, inclinaison de 2°.
            Il est décoratif — le titre est dans l'onglet, qui porte le sens. */}
        <span className="aph-tampon" aria-hidden="true">
          <AbomeyBlasonSvg size={44} />
        </span>

        <div className="aph-texte">
          <p className="aph-surtitre">Le carrousel média de l’en-tête Pointage</p>
        </div>

        {/* ── LE CHAMP SOULIGNÉ ──
            Aucun cadre : le trait du bas et le rond terracotta suffisent.
            C'est la forme « champ souligné » du kit, pas une carte. */}
        <Link className="aph-compte" to="/mon-compte">
          <span className="aph-compte-rond" aria-hidden="true">
            <Users size={15} />
          </span>
          <span className="aph-compte-texte">
            <strong>Mon compte</strong>
            <small>Profil, mot de passe, sécurité</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
