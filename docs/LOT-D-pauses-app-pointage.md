# 📋 FICHE PROBLÈME / SOLUTION — LOT D : PAUSES (En-Check-App-Pointage)

> **Destinataire** : équipe En-Check-App-Pointage (IA DEV 1).
> **Déposée par** : l'administrateur (l'arbitre ne la dépose pas lui-même).
> **Date** : 16/10/2026 — validée par l'administrateur (« la totale »).
> **Partie En-Check (admin) déjà codée** : migration `20261016000004_pauses_intelligentes.sql` (PR #18 du dépôt Buta-ta/En-Check).
> **Langage** : texte simple, pas de jargon — l'admin est débutant.

---

## 1. 🎯 Le problème (en clair)

Aujourd'hui, quand un employé fait une pause (repas, pause personnelle…), **personne ne la voit nulle part** :
- La paie ne sait pas combien de temps de pause a été pris.
- Si l'employé oublie de reprendre son service, personne ne le remarque.
- Le planning prévoit pourtant souvent une pause (ex : 12h00–13h00), mais rien ne dit si elle a vraiment été prise.

**Le principe en une phrase** : *la pause déclarée gagne ; à défaut, le créneau prévu est supposé ; l'admin arbitre ; on ne supprime jamais rien.*

## 2. 💡 La solution (le partage des rôles)

| Qui | Fait quoi |
|---|---|
| **L'app (vous)** | 2 boutons Pause/Reprise + rappel de reprise + mode hors-ligne. Rien d'autre. |
| **La base (déjà fait par l'arbitre)** | Stocke les pauses dans une table dédiée `encheck_pauses` ; déduit les pauses présumées du planning ; détecte les anomalies ; envoie les alertes à l'admin. |
| **L'admin (En-Check)** | Voit tout, statue « Valider » ou « Écarter » (jamais supprimer). |

⚠️ **Règle d'or** : l'app **n'écrit JAMAIS directement dans `attendances`** (leçon de l'incident MADEDE). Elle passe **uniquement par les 2 fonctions (RPC) ci-dessous**.

## 3. 📱 Ce qu'il faut faire dans l'app — l'écran pause

### Les 2 boutons
```
┌────────────────────────────────────┐
│  🟢 Service en cours depuis 08:02  │
│                                    │
│   [ ⏸  Je pars en pause ]          │
└────────────────────────────────────┘
        ⤵ après le tap :

┌────────────────────────────────────┐
│  ⏸ En pause depuis 12:05           │
│                                    │
│   Annonce : « Pause prévue         │
│   12:00–13:00 » (si le planning    │
│   en prévoit une ce jour-là)       │
│                                    │
│   Motif facultatif :               │
│   [Repas] [Personnelle] [Urgence]  │
│                                    │
│   [ ▶  Je reprends ]               │
└────────────────────────────────────┘
```

### Les comportements attendus
1. **« ⏸ Je pars en pause »** → appelle `encheck_pause_ouvrir`. Affiche l'heure de début et, si le planning du jour prévoit une pause, l'annonce « Pause prévue 12h00–13h00 ».
2. **« ▶ Je reprends »** → appelle `encheck_pause_fermer`. La pause est terminée.
3. **Motif facultatif** (Repas / Personnelle / Urgence) : l'employé peut le choisir AU MOMENT du départ en pause, ou le modifier tant que la pause est ouverte (la fonction accepte un motif).
4. **Rappel de reprise** : si la pause dépasse **75 minutes** (seuil `pause_rappel_minutes`, lisible dans la base), l'app affiche une notification locale amicale : « Toujours en pause ? Touche ▶ Je reprends si tu es de retour. » **Ce n'est pas une alarme, pas un SMS.**
5. **Hors-ligne (très important)** : les taps doivent fonctionner sans réseau. On les met en file d'attente locale et on les renvoie dès que le réseau revient. La base est protégée contre les doublons (un même « départ en pause » envoyé 2 fois ne crée qu'une seule pause) — ne vous inquiétez pas des replays.
6. **Géo-fencing** : si l'employé est « hors site » au moment du départ en pause, affichez juste la mention « 📍 Hors site » à côté de la pause. **Ne bloquez jamais le bouton.** C'est l'admin qui jugera.

### Ce qu'il ne faut PAS faire
- ❌ Pas de SMS ni de notification payante.
- ❌ Pas d'alerte à chaque pause (seulement le rappel de reprise local).
- ❌ Pas de détection automatique de pause par l'app (c'est la base qui présume, en base, et qui MARQUE).
- ❌ Pas d'écriture directe dans `attendances` ou toute autre table.

## 4. 🔌 Le contrat technique (les 2 fonctions à appeler)

Les deux fonctions existent déjà dans la base Supabase (migration `20261016000004`) et sont accessibles aux utilisateurs connectés (`authenticated`) comme aux invités (`anon`).

### `encheck_pause_ouvrir` — partir en pause
```
Paramètres (par nom, recommandé) :
  p_employee : uuid       → id de l'employé
  p_debut    : timestamptz→ heure de départ en pause (ISO 8601 ; défaut = maintenant)
  p_motif    : text       → 'Repas' | 'Personnelle' | 'Urgence' | NULL (facultatif)

Réponse (jsonb) :
  { "ok": true,  "pause_id": "uuid", "fermees": 1, "jour": "2026-10-16" }
  { "ok": false, "erreur": "employé inconnu ou inactif" }
  { "ok": true,  "pause_id": "uuid", "deja": true, ... }   ← replay hors-ligne accepté
```

### `encheck_pause_fermer` — reprendre
```
Paramètres :
  p_employee : uuid
  p_fin      : timestamptz→ heure de reprise (défaut = maintenant)

Réponse (jsonb) :
  { "ok": true, "pause_id": "uuid", "fermee": true }
  { "ok": true, "fermee": false }        ← aucune pause ouverte : ne rien afficher d'alarmant
  { "ok": false, "erreur": "..." }
```

### Traduction Flutter (esquisse)
```dart
final res = await supabase.rpc('encheck_pause_ouvrir', params: {
  'p_employee': employeId,
  'p_debut': DateTime.now().toUtc().toIso8601String(),
  'p_motif': motifChoisi, // null si pas de motif
});
if (res['ok'] == true) { /* afficher l'écran « En pause » */ }
```

## 5. ✅ Ce qui compte pour la recette (critères d'acceptation)

1. Les 2 boutons fonctionnent **avec et sans réseau** (rejeu propre, pas de doublon affiché).
2. Le motif est facultatif ; la pause fonctionne sans motif.
3. Le rappel « Toujours en pause ? » apparaît après **75 minutes** de pause (notification locale, gratuite).
4. L'app n'écrit **que** via les 2 RPC (vérifiable : aucune requête INSERT/UPDATE vers `attendances` dans le code).
5. La mention « 📍 Hors site » s'affiche le cas échéant, sans bloquer.
6. Après reprise, la pause apparaît dans l'admin En-Check (côté base c'est déjà géré).

## 6. ❓ Questions-réponses pour l'équipe

- **Q : et si l'employé tape « pause » 2 fois par erreur ?**
  R : la base ne crée qu'une seule pause (clé d'unicité), le 2e appel renvoie la première.
- **Q : et s'il oublie de reprendre ?**
  R : après 75 min, l'app le rappelle gentiment ; la base marque la pause « sans reprise » et prévient l'admin ; l'admin arbitre.
- **Q : faut-il lire les plannings dans l'app pour l'annonce « Pause prévue » ?**
  R : idéalement NON — la base le fait. Si vous ne pouvez pas l'éviter, lisez uniquement `work_schedules.break_start/break_end` en lecture seule (jamais `valide_du` sur `employee_schedules`, cette colonne n'existe pas).
- **Q : que se passe-t-il si l'admin écarte une pause ?**
  R : rien pour l'employé ; la pause existe toujours (audit) mais ne compte plus pour la paie.

---
*Fiche produite par l'IA ARBITRE (En-Check) — 16/10/2026. La partie admin est en PR #18 ; cette fiche est à déposer par l'administrateur dans En-Check-App-Pointage.*
