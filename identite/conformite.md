# En-Check — État de conformité du dépôt

Matrice page par page, mise à jour à chaque fusion. Une page est **CONFORME**
quand : fiche remplie (ce dossier), `npm run charte` sans FAIL, 2 captures
1440 px clair + sombre dans `docs/captures/`, notation ≥ 85.

Légende : ✅ conforme · ⚠️ en dérogation (voir DEROGATIONS.md) · ⬜ non redevinée.

| Page | Route | Motif | Fiche | charte-check | Captures | Notation | État |
|---|---|---|---|---|---|---|---|
| **Fondations** | — | — | ✅ | ✅ en place | — | — | ✅ 18/11 |
| Barre latérale | toutes | kente 28 px sous logo | — | ✅ (D-018) | — | — | ✅ 18/11 (D-018) |
| Thème | toutes | — | — | ✅ (D-005) | — | — | ✅ 18/11 |
| **Employés** | `/employes` | zoulou | ⬜ | ⬜ | ⬜ | ⬜ | 🔄 en cours (D-021) |
| Dashboard / Accueil | `/` | bogolan | ⬜ |  | ⬜ |  | ⚠️ D-022 |
| Fiche employée (modale) | — | — | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-023 |
| Absences | `/absences` | ndebele | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Planning | `/planning` | kuba | ⬜ |  | ⬜ |  | ⚠️ D-025 |
| Paie | `/paie` | bogolan | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Pointages | `/pointages` | adinkra | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Pointes | `/heures-supplementaires` | aso-oke | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Retards | `/retards` | retards-tissage | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Prospection / Devis | `/prospection` | abomey | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Rémunérations | `/remunerations` | bogolan | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Comptes / Accès | `/admins` | abomey | ⬜ |  | ⬜ |  | ⚠️ D-025 |
| Configuration pointeuse | `/pointeuses` | korhogo | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Géopointage | `/geopointage` | dogon | ⬜ |  | ⬜ |  | ⚠️ D-025 |
| Rapports | `/rapports` | nsibidi | ⬜ |  | ⬜ |  | ⚠️ D-025 |
| Système (annonces, journal) | `/system-messages`, `/analytics` | korhogo | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Pauses / Fériés | `/pauses` | lesotho | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ D-025 |
| Reçus faciaux / Réglages | `/reconnaissance-faciale` | kuba | ⬜ |  | ⬜ |  | ⚠️ D-025 |

## Verdict du dépôt

- **Statut** : en transition — les fondations sont en place, les pages redeviennent
  page par page (une page = une branche = une fiche).
- **Porte CI** : `npm run charte` en rapport **non bloquant** jusqu'à ce que toutes
  les pages soient conformes ; elle devient `--strict` bloquante à ce moment-là
  (portage prévu dans la fiche du dashboard, dernière page).
- **Prochaine page** : **Employés** (D-021) — fiche : `identite/fiche-page-employes.md`.

## Historique

| Date | Événement |
|---|---|
| 18/11/2026 | Fondations : registre, template, dérogations, tokens, charte.css, IBM Plex, charte-check.mjs, thème D-005, barre D-018. Dérogations D-022 à D-025 ouvertes. |
