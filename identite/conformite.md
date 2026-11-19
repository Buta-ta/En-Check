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
| Dashboard / Accueil | `/` | bogolan | ⬜ |  | ⬜ |  | ⚠️ DÉR-01 |
| Fiche employée (modale) | — | — | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-02 |
| Absences | `/absences` | ndebele | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Planning | `/planning` | kuba | ⬜ |  | ⬜ |  | ⚠️ DÉR-04 |
| Paie | `/paie` | bogolan | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Pointages | `/pointages` | adinkra | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Pointes | `/heures-supplementaires` | aso-oke | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Retards | `/retards` | retards-tissage | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Prospection / Devis | `/prospection` | abomey | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Rémunérations | `/remunerations` | bogolan | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Comptes / Accès | `/admins` | abomey | ⬜ |  | ⬜ |  | ⚠️ DÉR-04 |
| Configuration pointeuse | `/pointeuses` | korhogo | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Géopointage | `/geopointage` | dogon | ⬜ |  | ⬜ |  | ⚠️ DÉR-04 |
| Rapports | `/rapports` | nsibidi | ⬜ |  | ⬜ |  | ⚠️ DÉR-04 |
| Système (annonces, journal) | `/system-messages`, `/analytics` | korhogo | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Pauses / Fériés | `/pauses` | lesotho | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ DÉR-04 |
| Reçus faciaux / Réglages | `/reconnaissance-faciale` | kuba | ⬜ |  | ⬜ |  | ⚠️ DÉR-04 |

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
