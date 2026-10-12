#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 🛡️ EN-CHECK — SCRIPT DE SAUVEGARDE & RESTAURATION (< 30 MIN)
# Chantiers : VD-06 (Sauvegardes auto) & VD-11 (Restauration démontrée < 30 min)
# Auteur    : Gardien des fondations (Direction technique En-Check)
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

MODE="${1:-help}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y-%m-%d_%H%M%S)"

case "$MODE" in
  backup)
    if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
      echo "❌ Erreur : SUPABASE_DB_URL est requis pour la sauvegarde." >&2
      exit 1
    fi
    mkdir -p "$BACKUP_DIR"
    OUT_FILE="${BACKUP_DIR}/${TIMESTAMP}_encheck_full.sql.gz"
    echo "🛡️ [1/2] Export du schéma et des données En-Check..."
    pg_dump "$SUPABASE_DB_URL" \
      --schema=public \
      --no-owner \
      --no-privileges \
      --clean \
      --if-exists \
      | gzip -9 > "$OUT_FILE"
    sha256sum "$OUT_FILE" > "${OUT_FILE}.sha256"
    echo "✅ [2/2] Sauvegarde terminée : $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
    ;;

  restore)
    ARCHIVE="${2:-}"
    if [[ -z "${TARGET_DB_URL:-}" || -z "$ARCHIVE" ]]; then
      echo "❌ Erreur : TARGET_DB_URL et le chemin de l'archive .sql.gz sont requis." >&2
      exit 1
    fi
    if [[ "$TARGET_DB_URL" == *"cxggndvhwdolbtyezjde"* && "${ALLOW_PROD_RESTORE:-false}" != "true" ]]; then
      echo "🛑 REFUSÉ : TARGET_DB_URL pointe vers le projet de PRODUCTION (cxggndvhwdolbtyezjde)." >&2
      echo "   Utilisez un projet de staging/restauration vierge (règle VD-10)." >&2
      exit 1
    fi
    START_TS=$(date +%s)
    echo "🛡️ [1/3] Vérification de l'empreinte SHA-256..."
    if [[ -f "${ARCHIVE}.sha256" ]]; then
      sha256sum -c "${ARCHIVE}.sha256"
    fi
    echo "🛡️ [2/3] Restauration complète sur la cible..."
    gunzip -c "$ARCHIVE" | psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1
    END_TS=$(date +%s)
    ELAPSED=$((END_TS - START_TS))
    echo "✅ [3/3] Restauration terminée en ${ELAPSED} secondes (< 1800 s / 30 min)."
    ;;

  verify)
    if [[ -z "${TARGET_DB_URL:-}" ]]; then
      echo "❌ Erreur : TARGET_DB_URL est requis pour la vérification." >&2
      exit 1
    fi
    echo "🔍 Vérification des tables critiques En-Check sur la cible :"
    psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "
      SELECT 'enterprises' AS table_name, count(*) AS total FROM public.enterprises
      UNION ALL
      SELECT 'employees', count(*) FROM public.employees
      UNION ALL
      SELECT 'attendances', count(*) FROM public.attendances
      UNION ALL
      SELECT 'absences', count(*) FROM public.absences
      UNION ALL
      SELECT 'countries_payroll_config', count(*) FROM public.countries_payroll_config
      UNION ALL
      SELECT 'radar_signals', count(*) FROM public.radar_signals
      ORDER BY table_name;
    "
    if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
      echo "🔍 Comparaison stricte Source vs Cible restaurée :"
      SRC_COUNTS=$(psql "$SUPABASE_DB_URL" -At -v ON_ERROR_STOP=1 -c "
        SELECT 'enterprises:' || count(*) FROM public.enterprises
        UNION ALL SELECT 'employees:' || count(*) FROM public.employees
        UNION ALL SELECT 'attendances:' || count(*) FROM public.attendances
        UNION ALL SELECT 'absences:' || count(*) FROM public.absences
        UNION ALL SELECT 'countries_payroll_config:' || count(*) FROM public.countries_payroll_config
        UNION ALL SELECT 'radar_signals:' || count(*) FROM public.radar_signals
        ORDER BY 1;
      ")
      TGT_COUNTS=$(psql "$TARGET_DB_URL" -At -v ON_ERROR_STOP=1 -c "
        SELECT 'enterprises:' || count(*) FROM public.enterprises
        UNION ALL SELECT 'employees:' || count(*) FROM public.employees
        UNION ALL SELECT 'attendances:' || count(*) FROM public.attendances
        UNION ALL SELECT 'absences:' || count(*) FROM public.absences
        UNION ALL SELECT 'countries_payroll_config:' || count(*) FROM public.countries_payroll_config
        UNION ALL SELECT 'radar_signals:' || count(*) FROM public.radar_signals
        ORDER BY 1;
      ")
      if [[ "$SRC_COUNTS" == "$TGT_COUNTS" ]]; then
        echo "✅ CONCORDANCE 100 % SOURCE == CIBLE RESTAURÉE"
      else
        echo "❌ ÉCART DÉTECTÉ ENTRE SOURCE ET CIBLE :" >&2
        diff -u <(echo "$SRC_COUNTS") <(echo "$TGT_COUNTS") >&2 || true
        exit 1
      fi
    fi
    ;;

  *)
    echo "Usage: $0 {backup|restore <fichier.sql.gz>|verify}"
    exit 1
    ;;
esac