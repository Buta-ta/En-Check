// ═══════════════════════════════════════════════════════════════════════════
// 📅 EN-CHECK · PLANNING — SYSTÈME DRAG & DROP × IDENTITÉ AFRO-TECH
// Matrice hebdomadaire glisser-déposer + Modèles personnalisables + Équipes
// + Disponibilités + Vues Semaine/Mois/Jour + Demandes
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import HolidayService from "../services/holidayService";
import { resoudrePointagesJournee } from "../services/hoursCalculator";
import { chargerSeuilsPointage } from "../services/seuilsPointage";
import FeatureService from "../services/featureService";
import {
  KenteWovenTapestrySvg,
  AdinkraWatermarkSvg,
  WovenKenteBadgeSvg,
} from "../components/AfroCulturalSvg";
import PlanningLoadingScreen from "../components/PlanningLoadingScreen";
import useLoadingMinimum from "../hooks/useLoadingMinimum";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Clock,
  Calendar,
  Building2,
  AlertCircle,
  Coffee,
  AlertTriangle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Briefcase,
  CheckCircle2,
  CalendarDays,
  Shield,
  MessageSquare,
  Send,
  Ban,
  Copy,
  Sparkles,
  Sun,
  Moon,
  Palette,
  Layers,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import "./PlanningAfroTech.css";

const OVERRIDES_STORAGE_KEY = "encheck_planning_day_overrides_v1";
const CUSTOM_MODELS_STORAGE_KEY = "encheck_planning_custom_models_v1";
const AVAILABILITY_STORAGE_KEY = "encheck_planning_availability_v1";
const TEAMS_STORAGE_KEY = "encheck_planning_teams_v1";
const TEAM_ASSIGNMENTS_STORAGE_KEY = "encheck_planning_team_assignments_v1";
const MONTH_MODELS_STORAGE_KEY = "encheck_planning_month_models_v1";
const COLLAPSED_GROUPS_STORAGE_KEY = "encheck_planning_teams_collapsed_v1";

// Raccourcis En-Check : rejoindre les autres modules sans repasser par le Dashboard
const PLANNING_SHORTCUTS = [
  { id: "pointages", label: "Pointages", path: "/pointages", icon: Clock, hint: "Entrées et sorties du jour, écarts et régularisations" },
  { id: "employes", label: "Employés", path: "/employes", icon: Users, hint: "Fiches collaborateurs, affectations et horaires" },
  { id: "pauses", label: "Pauses", path: "/pauses", icon: Coffee, hint: "Pauses pointées, chronomètre en direct et pauses présumées" },
  { id: "fiches-paie", label: "Fiches de paie", path: "/fiches-paie", icon: FileText, hint: "Bulletins et récapitulatifs de paie" },
];

// Palette de couleurs personnalisables En-Check (modèles & cases)
const ENCHECK_COLOR_PALETTE = [
  { id: "copper", label: "Cuivre", value: "#B56235" },
  { id: "amber", label: "Ambre", value: "#D97706" },
  { id: "emerald", label: "Émeraude", value: "#10B981" },
  { id: "indigo", label: "Indigo", value: "#4F46E5" },
  { id: "violet", label: "Violet", value: "#7C3AED" },
  { id: "ocean", label: "Océan", value: "#0E7490" },
  { id: "rubis", label: "Rubis", value: "#BE123C" },
  { id: "ardoise", label: "Ardoise", value: "#475569" },
];

// Types de modèles créables par l'entreprise
const MODEL_KINDS = [
  { id: "shift", label: "Horaire de travail / Garde / Nuit" },
  { id: "break_only", label: "Pause" },
  { id: "rest", label: "Repos" },
  { id: "leave", label: "Congé / Absence" },
];

// Briques par défaut du Dock En-Check (fidèles à la maquette validée)
const DEFAULT_DOCK_TEMPLATES = [
  {
    id: "tpl-matin",
    label: "Matin 08:00-17:00",
    name: "Matin",
    start_time: "08:00",
    end_time: "17:00",
    has_break: true,
    break_start: "12:00",
    break_end: "13:00",
    variant: "standard",
    kind: "shift",
    color: "#B56235",
    isPreset: true,
  },
  {
    id: "tpl-garde",
    label: "Garde 14:00-22:00",
    name: "Garde",
    start_time: "14:00",
    end_time: "22:00",
    has_break: true,
    break_start: "18:00",
    break_end: "18:30",
    variant: "garde",
    kind: "shift",
    color: "#9A5B25",
    isPreset: true,
  },
  {
    id: "tpl-nuit",
    label: "Nuit 20:00-06:00",
    name: "Garde de nuit",
    start_time: "20:00",
    end_time: "06:00",
    has_break: false,
    break_start: "01:00",
    break_end: "01:30",
    variant: "nuit",
    kind: "shift",
    color: "#4B3869",
    isPreset: true,
  },
  {
    id: "tpl-pause",
    label: "Pause 12:00-13:00",
    name: "Pause 1h",
    start_time: "08:00",
    end_time: "17:00",
    has_break: true,
    break_start: "12:00",
    break_end: "13:00",
    variant: "standard",
    kind: "break_only",
    color: "#0E7490",
    isPreset: true,
  },
  {
    id: "tpl-repos",
    label: "Congé / Repos",
    name: "Repos",
    start_time: null,
    end_time: null,
    has_break: false,
    variant: "conge",
    kind: "rest",
    color: "#2D5A43",
    isPreset: true,
  },
];

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota error
  }
}

// Convertit une couleur hex en dégradé CSS pour les cartes du planning
function buildShiftGradient(color) {
  if (!color) return undefined;
  return `linear-gradient(145deg, ${color} 0%, ${color}CC 100%)`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMondayOffset(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function getPlanningDay(year, month, d) {
  const day = new Date(year, month, d).getDay();
  return day === 0 ? 7 : day;
}

function toIsoDateLocal(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStartOfWeekMonday(dateObj) {
  const d = new Date(dateObj);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0 = Dim, 1 = Lun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function computeShiftNetMinutes(shift) {
  if (!shift || shift.isRest || !shift.start_time || !shift.end_time) return 0;
  const [sh, sm] = shift.start_time.slice(0, 5).split(":").map(Number);
  const [eh, em] = shift.end_time.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 0;
  let startMin = sh * 60 + (sm || 0);
  let endMin = eh * 60 + (em || 0);
  if (endMin <= startMin) {
    // Horaire de nuit traversant minuit (J+1)
    endMin += 24 * 60;
  }
  let total = endMin - startMin;
  if (shift.has_break && shift.break_start && shift.break_end) {
    const [bh, bm] = shift.break_start.slice(0, 5).split(":").map(Number);
    const [fh, fm] = shift.break_end.slice(0, 5).split(":").map(Number);
    if (!Number.isNaN(bh) && !Number.isNaN(fh)) {
      let bStart = bh * 60 + (bm || 0);
      let bEnd = fh * 60 + (fm || 0);
      if (bEnd <= bStart) bEnd += 24 * 60;
      total = Math.max(0, total - (bEnd - bStart));
    }
  }
  return Math.max(0, total);
}

function computeBreakLabel(shift) {
  if (!shift || !shift.has_break || !shift.break_start || !shift.break_end) return null;
  const [bh, bm] = shift.break_start.slice(0, 5).split(":").map(Number);
  const [fh, fm] = shift.break_end.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(bh) || Number.isNaN(fh)) return "1h";
  let mins = fh * 60 + (fm || 0) - (bh * 60 + (bm || 0));
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatHoursCompact(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function Planning() {
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [plannings, setPlannings] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [entreprises, setEntreprises] = useState([]);
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [absences, setAbsences] = useState([]);
  // Pointages réellement effectués (table attendances) pour comparer prévu / réalisé
  const [attendances, setAttendances] = useState([]);
  // Seuils de pointage et grilles horaires par entreprise (même moteur que Pointages)
  const [seuilsByEnterprise, setSeuilsByEnterprise] = useState({});
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const { minLoadingDone, skipLoading } = useLoadingMinimum();

  // Filtre de focus : totaux et grille liés au groupe ou au collaborateur sélectionné
  const [focusFilter, setFocusFilter] = useState({ type: "all", value: null });

  // Vues En-Check : "semaine" (défaut) | "mois" | "jour" | "demandes"
  const [planningView, setPlanningView] = useState("semaine");
  const [dockOpen, setDockOpen] = useState(true);
  // État plié / déplié de chaque équipe, sauvegardé d'une visite à l'autre
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readStorage(COLLAPSED_GROUPS_STORAGE_KEY, {})
  );
  const [selectedEntreprise, setSelectedEntreprise] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // État Drag & Drop En-Check
  const [draggedPayload, setDraggedPayload] = useState(null);
  const [dropTargetCell, setDropTargetCell] = useState(null); // { empId, dateStr, dayNum } ou { empId, rowDrop: true }
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [publishing, setPublishing] = useState(false);

  // Surcharges par jour (permet d'avoir un shift spécifique sur un jour précis via Drag & Drop)
  const [dayOverrides, setDayOverrides] = useState(() => {
    try {
      const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Modals existants
  const [showModal, setShowModal] = useState(false);
  const [editingPlanning, setEditingPlanning] = useState(null);

  // ═══ MODÈLES PERSONNALISÉS (créés par l'entreprise : horaire, pause, congé, repos) ═══
  const [customModels, setCustomModels] = useState(() =>
    readStorage(CUSTOM_MODELS_STORAGE_KEY, [])
  );
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingCustomModel, setEditingCustomModel] = useState(null);
  const [modelForm, setModelForm] = useState({
    name: "",
    kind: "shift",
    start_time: "08:00",
    end_time: "17:00",
    has_break: true,
    break_start: "12:00",
    break_end: "13:00",
    color: "#B56235",
  });

  // ═══ ÉQUIPES PERSONNALISÉES (création / renommage / suppression) ═══
  const [teams, setTeams] = useState(() => readStorage(TEAMS_STORAGE_KEY, []));
  const [teamAssignments, setTeamAssignments] = useState(() =>
    readStorage(TEAM_ASSIGNMENTS_STORAGE_KEY, {})
  );
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: "", memberIds: [] });

  // ═══ DISPONIBILITÉS COLLABORATEURS (aujourd'hui / cette semaine / jour précis) ═══
  const [availability, setAvailability] = useState(() =>
    readStorage(AVAILABILITY_STORAGE_KEY, {})
  );
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityTarget, setAvailabilityTarget] = useState(null);

  // ═══ GLISSER-DÉPOSER TACTILE (mobile : appui long puis toucher la case cible) ═══
  const [touchDragPayload, setTouchDragPayload] = useState(null);
  const [requestFilter, setRequestFilter] = useState("all");

  // ═══ MODÈLES DÉPOSÉS SUR LE CALENDRIER MENSUEL (date -> [modèles]) ═══
  const [monthModels, setMonthModels] = useState(() =>
    readStorage(MONTH_MODELS_STORAGE_KEY, {})
  );
  const [monthDropDate, setMonthDropDate] = useState(null);
  const [dayDropEmpId, setDayDropEmpId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planningToDelete, setPlanningToDelete] = useState(null);

  const [showEmployeeScheduleModal, setShowEmployeeScheduleModal] = useState(false);
  const [editingEmployeeSchedule, setEditingEmployeeSchedule] = useState(null);
  // Contexte de la case en cours d'édition (permet de personnaliser la couleur de la case)
  const [cellEditContext, setCellEditContext] = useState(null);

  const [holidaysByEnterprise, setHolidaysByEnterprise] = useState({})
  //  Pauses SUPPRIMÉES (corbeille) par case « employé | jour » : une pause
  //  retirée doit rester visible sur le planning, sinon la case ment.
  const [pausesSupprimees, setPausesSupprimees] = useState({});
  const [holidayMapsByEnterprise, setHolidayMapsByEnterprise] = useState({});

  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewingRequest, setReviewingRequest] = useState(false);
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);

  const joursSemaine = [
    { id: 1, nom: "Lundi", court: "Lun" },
    { id: 2, nom: "Mardi", court: "Mar" },
    { id: 3, nom: "Mercredi", court: "Mer" },
    { id: 4, nom: "Jeudi", court: "Jeu" },
    { id: 5, nom: "Vendredi", court: "Ven" },
    { id: 6, nom: "Samedi", court: "Sam" },
    { id: 7, nom: "Dimanche", court: "Dim" },
  ];

  const [formData, setFormData] = useState({
    enterprise_id: "",
    name: "Horaires standard",
    start_time: "08:00",
    end_time: "17:00",
    break_start: "12:00",
    break_end: "13:00",
    has_break: true,
    work_days: [1, 2, 3, 4, 5],
    late_tolerance_minutes: 15,
    is_default: true,
  });

  const [employeeScheduleForm, setEmployeeScheduleForm] = useState({
    employee_id: "",
    schedule_id: "",
    use_custom_hours: false,
    custom_start_time: "08:00",
    custom_end_time: "17:00",
    custom_break_start: "12:00",
    custom_break_end: "13:00",
    custom_has_break: true,
    custom_work_days: [1, 2, 3, 4, 5],
    custom_color: "#B56235",
  });

  // Écoute de la touche Alt pour dupliquer au lieu de déplacer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey) setIsAltPressed(true);
    };
    const handleKeyUp = (e) => {
      if (!e.altKey) setIsAltPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    writeStorage(OVERRIDES_STORAGE_KEY, dayOverrides);
  }, [dayOverrides]);

  useEffect(() => {
    writeStorage(CUSTOM_MODELS_STORAGE_KEY, customModels);
  }, [customModels]);

  useEffect(() => {
    writeStorage(TEAMS_STORAGE_KEY, teams);
  }, [teams]);

  useEffect(() => {
    writeStorage(COLLAPSED_GROUPS_STORAGE_KEY, collapsedGroups);
  }, [collapsedGroups]);

  useEffect(() => {
    writeStorage(TEAM_ASSIGNMENTS_STORAGE_KEY, teamAssignments);
  }, [teamAssignments]);

  useEffect(() => {
    writeStorage(AVAILABILITY_STORAGE_KEY, availability);
  }, [availability]);

  useEffect(() => {
    writeStorage(MONTH_MODELS_STORAGE_KEY, monthModels);
  }, [monthModels]);

  useEffect(() => {
    const adminData = localStorage.getItem("admin");
    if (!adminData) {
      navigate("/login");
      return;
    }
    const parsedAdmin = JSON.parse(adminData);
    setAdmin(parsedAdmin);
    loadData(parsedAdmin);
  }, [navigate]);

  const loadData = async (adminData) => {
    setLoading(true);
    try {
      const isSuperAdmin = adminData.role === "super_admin";
      const enterpriseId = adminData.selectedEnterprise?.id || adminData.enterprise_id;

      let entreprisesQuery = supabase
        .from("enterprises")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (!isSuperAdmin && enterpriseId)
        entreprisesQuery = entreprisesQuery.eq("id", enterpriseId);
      const { data: entreprisesData } = await entreprisesQuery;
      setEntreprises(entreprisesData || []);

      let planningsQuery = supabase
        .from("work_schedules")
        .select("*, enterprises(name, logo_url)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!isSuperAdmin && enterpriseId)
        planningsQuery = planningsQuery.eq("enterprise_id", enterpriseId);
      else if (isSuperAdmin && selectedEntreprise !== "all")
        planningsQuery = planningsQuery.eq("enterprise_id", selectedEntreprise);
      const { data: planningsData } = await planningsQuery;
      setPlannings(planningsData || []);

      let employeesQuery = supabase
        .from("employees")
        .select(
          "id, enterprise_id, first_name, last_name, matricule, department, position, photo_url, is_active, enterprises(name, module_planning)"
        )
        .eq("is_active", true)
        .order("first_name");
      if (!isSuperAdmin && enterpriseId)
        employeesQuery = employeesQuery.eq("enterprise_id", enterpriseId);
      else if (isSuperAdmin && selectedEntreprise !== "all")
        employeesQuery = employeesQuery.eq("enterprise_id", selectedEntreprise);
      const { data: employeesData } = await employeesQuery;
      setEmployees(employeesData || []);

      const employeeIds = (employeesData || []).map((e) => e.id);

      if (employeeIds.length > 0) {
        const { data: esData } = await supabase
          .from("employee_schedules")
          .select(
            "*, employees(id, first_name, last_name, matricule, enterprise_id, department, position), work_schedules(id, name, start_time, end_time, break_start, break_end, has_break, work_days, late_tolerance_minutes)"
          )
          .in("employee_id", employeeIds)
          .eq("is_active", true);
        setEmployeeSchedules(esData || []);
      } else {
        setEmployeeSchedules([]);
      }

      let scheduleRequestsQuery = supabase
        .from("schedule_change_requests")
        .select(`
          *,
          employees(id, first_name, last_name, matricule, enterprise_id, department, position),
          current_schedule:current_schedule_id(id, name, start_time, end_time, break_start, break_end, has_break, work_days),
          requested_schedule:requested_schedule_id(id, name, start_time, end_time, break_start, break_end, has_break, work_days)
        `)
        .order("created_at", { ascending: false });

      if (!isSuperAdmin && enterpriseId) {
        scheduleRequestsQuery = scheduleRequestsQuery.eq("enterprise_id", enterpriseId);
      } else if (isSuperAdmin && selectedEntreprise !== "all") {
        scheduleRequestsQuery = scheduleRequestsQuery.eq("enterprise_id", selectedEntreprise);
      }

      const { data: requestsData } = await scheduleRequestsQuery;
      setScheduleRequests(requestsData || []);

      // Chargement des absences validées sur la période pour affichage sur la grille En-Check
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const rangeStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const rangeEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        getDaysInMonth(year, month)
      ).padStart(2, "0")}`;

      let absQuery = supabase
        .from("absences")
        .select("id, employee_id, enterprise_id, start_date, end_date, reason, status")
        .lte("start_date", rangeEnd)
        .gte("end_date", rangeStart);
      if (!isSuperAdmin && enterpriseId) {
        absQuery = absQuery.eq("enterprise_id", enterpriseId);
      } else if (isSuperAdmin && selectedEntreprise !== "all") {
        absQuery = absQuery.eq("enterprise_id", selectedEntreprise);
      }
      const { data: absData } = await absQuery;
      setAbsences(absData || []);

      // Chargement des pointages réels (attendances) sur toute la période affichée
      const weekStart = getStartOfWeekMonday(calendarDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const periodeStart = new Date(
        Math.min(weekStart.getTime(), new Date(year, month, 1).getTime())
      );
      const periodeEnd = new Date(
        Math.max(weekEnd.getTime(), new Date(year, month, getDaysInMonth(year, month)).getTime())
      );
      const periodeStartISO = `${toIsoDateLocal(periodeStart)}T00:00:00`;
      const periodeEndISO = `${toIsoDateLocal(periodeEnd)}T23:59:59`;

      // Mêmes colonnes que la page Pointages : le moteur resoudrePointagesJournee
      // a besoin des champs d'estimation / modification pour ne rien inventer.
      if (employeeIds.length > 0) {
        const { data: attData } = await supabase
          .from("attendances")
          .select(
            "id, employee_id, enterprise_id, check_time, check_type, method, is_auto_closed, anomalie, estimation_source_id, estimation_validee_le, estimation_remplacee_le, estimation_niveau, estimation_confiance, notes, modifie_le, modifie_par, created_at, origine, decision_raison, modifie_par_employe, suspect, suspect_reason"
          )
          .in("employee_id", employeeIds)
          .gte("check_time", periodeStartISO)
          .lte("check_time", periodeEndISO)
          .order("check_time", { ascending: true });
        setAttendances(attData || []);
      } else {
        setAttendances([]);
      }

      // Grilles horaires entreprise + seuils de pointage (identiques à Pointages)
      const entIdsForConfig = isSuperAdmin
        ? selectedEntreprise !== "all"
          ? [selectedEntreprise]
          : (entreprisesData || []).map((e) => e.id)
        : [enterpriseId];
      const idsForConfig = entIdsForConfig.filter(Boolean);

      const [schedulesData, seuilsEntries] = await Promise.all([
        FeatureService.loadSchedules(idsForConfig),
        Promise.all(
          idsForConfig.map(async (entId) => [entId, await chargerSeuilsPointage(entId)])
        ),
      ]);
      setAllSchedules(schedulesData || []);
      setSeuilsByEnterprise(Object.fromEntries(seuilsEntries));

      const enterpriseIdsToLoad = isSuperAdmin
        ? selectedEntreprise !== "all"
          ? [selectedEntreprise]
          : (entreprisesData || []).map((e) => e.id)
        : [enterpriseId];

      const hSets = {},
        hMaps = {};
      await Promise.all(
        enterpriseIdsToLoad.filter(Boolean).map(async (entId) => {
          const holidays = await HolidayService.getHolidaysForRange(entId, rangeStart, rangeEnd);
          const active = holidays.filter((h) => !h.is_worked);
          hSets[entId] = HolidayService.buildHolidaySet(active);
          hMaps[entId] = HolidayService.buildHolidayMap(active);
        })
      );
      setHolidaysByEnterprise(hSets);
      setHolidayMapsByEnterprise(hMaps);

      //  Corbeille des pauses : ce qui a été SUPPRIMÉ reste signalé sur la case
      //  du jour. Fonction optionnelle : sans le script SQL du 21/10, la map
      //  reste vide et le planning fonctionne exactement comme avant.
      try {
        const entArgCorbeille = isSuperAdmin
          ? (selectedEntreprise !== "all" ? selectedEntreprise : null)
          : (enterpriseId || null);
        const { data: archivesData, error: errArch } = await supabase.rpc(
          "encheck_pauses_archives_lire",
          { p_enterprise: entArgCorbeille, p_du: rangeStart, p_au: rangeEnd },
        );
        const parCase = {};
        for (const ligne of errArch ? [] : archivesData || []) {
          if (!ligne?.employe_id || !ligne?.jour) continue;
          const cle = `${ligne.employe_id}|${ligne.jour}`;
          if (!parCase[cle]) parCase[cle] = [];
          parCase[cle].push(ligne);
        }
        setPausesSupprimees(parCase);
      } catch (eCorbeille) {
        setPausesSupprimees({});
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (admin) loadData(admin);
  }, [selectedEntreprise, calendarDate]);

  const formatTime = (t) => (t ? t.slice(0, 5) : "--:--");

  const formatWorkDays = (days) => {
    if (!days || days.length === 0) return "Aucun";
    if (days.length === 7) return "Tous les jours";
    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])) return "Lun - Ven";
    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5, 6])) return "Lun - Sam";
    return days.map((d) => joursSemaine.find((j) => j.id === d)?.court).join(", ");
  };

  const formatDuration = (p) => {
    const mins = computeShiftNetMinutes(p);
    if (!mins) return "—";
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
  };

  const filteredPlannings = plannings.filter(
    (p) => selectedEntreprise === "all" || p.enterprise_id === selectedEntreprise
  );

  const filteredEmployees = employees.filter(
    (e) => selectedEntreprise === "all" || e.enterprise_id === selectedEntreprise
  );

  const filteredRequests = scheduleRequests.filter(
    (r) => selectedEntreprise === "all" || r.enterprise_id === selectedEntreprise
  );

  const pendingRequestsCount = filteredRequests.filter((r) => r.status === "pending").length;

  const visibleRequests = useMemo(() => {
    if (requestFilter === "all") return filteredRequests;
    return filteredRequests.filter((r) => (r.status || "pending") === requestFilter);
  }, [filteredRequests, requestFilter]);

  const getHolidaySet = (id) => holidaysByEnterprise[id] || new Set();
  const getHolidayMap = (id) => holidayMapsByEnterprise[id] || new Map();

  // Date locale (YYYY-MM-DD) d'un horodatage Supabase
  const jourLocal = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).split("T")[0];
    return toIsoDateLocal(d);
  };

  const heureLocale = (iso) => {
    if (!iso) return "--:--";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--:--";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ═══ GLISSER-DÉPOSER TACTILE (mobile) : appui long sur un modèle puis touche la case ═══
  const touchTimerRef = useRef(null);

  const startTouchDrag = (tpl) => {
    clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setTouchDragPayload({ sourceType: "dock", template: tpl });
      if (navigator.vibrate) navigator.vibrate(30);
      toast.success(`« ${tpl.name || tpl.label} » prêt — touchez une case pour le déposer`);
    }, 450);
  };

  const cancelTouchDrag = () => {
    clearTimeout(touchTimerRef.current);
  };

  const clearTouchDrag = () => {
    clearTimeout(touchTimerRef.current);
    setTouchDragPayload(null);
  };

  // Application du modèle sélectionné au doigt sur une case (Semaine / Jour)
  const applyTouchDropOnCell = (emp, dayItem) => {
    if (!touchDragPayload) return false;
    const payload = touchDragPayload;
    setDraggedPayload(payload);
    handleDropOnCell({ preventDefault: () => {}, altKey: false }, emp, dayItem);
    clearTouchDrag();
    return true;
  };

  // Application du modèle sélectionné au doigt sur une case du calendrier (Mois)
  const applyTouchDropOnDay = (dateStr) => {
    if (!touchDragPayload) return false;
    const payload = touchDragPayload;
    setDraggedPayload(payload);
    handleDropOnCalendarDay({ preventDefault: () => {} }, dateStr);
    clearTouchDrag();
    return true;
  };

  // ═══ JOURS DE LA SEMAINE EN-CHECK (Lun -> Dim) ═══
  const weekDays = useMemo(() => {
    const monday = getStartOfWeekMonday(calendarDate);
    const todayIso = toIsoDateLocal(new Date());
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const iso = toIsoDateLocal(d);
      const dayNum = idx + 1; // 1 = Lun .. 7 = Dim
      const court = joursSemaine[idx].court;
      return {
        idx,
        dayNum,
        dateObj: d,
        dateStr: iso,
        dayOfMonth: d.getDate(),
        court,
        nom: joursSemaine[idx].nom,
        labelHeader: `${court} ${d.getDate()}`,
        isToday: iso === todayIso,
      };
    });
  }, [calendarDate]);

  // Libellé de période style En-Check : "Lun 19 – Dim 25 Oct. 2026"
  const periodLabel = useMemo(() => {
    if (planningView === "mois") {
      return calendarDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
    }
    if (planningView === "jour") {
      return calendarDate.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    const first = weekDays[0];
    const last = weekDays[6];
    const monthShort = last.dateObj.toLocaleDateString("fr-FR", { month: "short" });
    const capMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
    return `${first.court} ${first.dayOfMonth} – ${last.court} ${last.dayOfMonth} ${capMonth} ${last.dateObj.getFullYear()}`;
  }, [weekDays, calendarDate, planningView]);

  const navigatePeriod = (direction) => {
    const next = new Date(calendarDate);
    if (planningView === "mois") {
      next.setMonth(next.getMonth() + direction);
    } else if (planningView === "jour") {
      next.setDate(next.getDate() + direction);
    } else {
      next.setDate(next.getDate() + direction * 7);
    }
    setCalendarDate(next);
  };

  // ═══ MODÈLES GLISSABLES DU DOCK EN-CHECK ═══
  // 1. Modèles standards En-Check + 2. Modèles d'horaires entreprise (work_schedules)
  // 3. Modèles personnalisés créés par l'utilisateur (pause, congé, repos, garde...)
  const dockTemplates = useMemo(() => {
    const customScheduleBricks = filteredPlannings.map((p) => {
      const st = formatTime(p.start_time);
      const et = formatTime(p.end_time);
      const isNight = st >= "19:00" || et <= "07:00";
      const isGarde = st >= "13:00" && !isNight;
      return {
        id: `ws-${p.id}`,
        schedule_id: p.id,
        label: `${p.name} ${st}-${et}`,
        name: p.name,
        start_time: st,
        end_time: et,
        has_break: p.has_break ?? true,
        break_start: formatTime(p.break_start || "12:00"),
        break_end: formatTime(p.break_end || "13:00"),
        work_days: p.work_days || [1, 2, 3, 4, 5],
        variant: isNight ? "nuit" : isGarde ? "garde" : "standard",
        kind: "work_schedule",
        color: ENCHECK_COLOR_PALETTE[0].value,
        rawSchedule: p,
      };
    });

    const userModels = customModels.map((m) => ({
      ...m,
      id: m.id || `cm-${m.name}`,
      label:
        m.kind === "rest" || m.kind === "leave"
          ? m.name
          : m.kind === "break_only"
          ? `${m.name} ${formatTime(m.break_start)}-${formatTime(m.break_end)}`
          : `${m.name} ${formatTime(m.start_time)}-${formatTime(m.end_time)}`,
      variant:
        m.kind === "rest"
          ? "conge"
          : m.kind === "leave"
          ? "conge"
          : m.kind === "break_only"
          ? "pause"
          : m.variant || "standard",
      isCustom: true,
    }));

    return [...DEFAULT_DOCK_TEMPLATES, ...customScheduleBricks, ...userModels];
  }, [filteredPlannings, customModels]);

  // ═══ CRUD DES MODÈLES PERSONNALISÉS ═══
  const openNewModelModal = () => {
    setEditingCustomModel(null);
    setModelForm({
      name: "",
      kind: "shift",
      start_time: "08:00",
      end_time: "17:00",
      has_break: true,
      break_start: "12:00",
      break_end: "13:00",
      color: "#B56235",
    });
    setShowModelModal(true);
  };

  const openEditModelModal = (model) => {
    setEditingCustomModel(model);
    setModelForm({
      name: model.name || "",
      kind: model.kind || "shift",
      start_time: model.start_time || "08:00",
      end_time: model.end_time || "17:00",
      has_break: model.has_break ?? true,
      break_start: model.break_start || "12:00",
      break_end: model.break_end || "13:00",
      color: model.color || "#B56235",
    });
    setShowModelModal(true);
  };

  const handleSaveCustomModel = () => {
    if (!modelForm.name.trim()) {
      toast.error("Donnez un nom à votre modèle");
      return;
    }
    const timesNeeded = modelForm.kind === "shift";
    if (timesNeeded && (!modelForm.start_time || !modelForm.end_time)) {
      toast.error("Renseignez l'heure de début et de fin");
      return;
    }
    const payload = {
      ...modelForm,
      name: modelForm.name.trim(),
      variant:
        modelForm.kind === "rest" || modelForm.kind === "leave"
          ? "conge"
          : modelForm.kind === "break_only"
          ? "pause"
          : "standard",
    };

    if (editingCustomModel) {
      setCustomModels((prev) =>
        prev.map((m) => (m.id === editingCustomModel.id ? { ...m, ...payload } : m))
      );
      toast.success(`Modèle "${payload.name}" mis à jour`);
    } else {
      const newModel = { ...payload, id: `cm-${Date.now()}` };
      setCustomModels((prev) => [...prev, newModel]);
      toast.success(`Modèle "${payload.name}" créé — glissez-le dans la grille`);
    }
    setShowModelModal(false);
    setEditingCustomModel(null);
  };

  const handleDeleteCustomModel = (model) => {
    setCustomModels((prev) => prev.filter((m) => m.id !== model.id));
    toast.success(`Modèle "${model.name}" supprimé`);
  };

  // ═══ CRUD DES ÉQUIPES (création, renommage, affectation des membres) ═══
  // Une équipe peut être héritée du champ "department" de l'employé ou définie
  // manuellement depuis En-Check (les collaborateurs sans équipe vont dans "SANS ÉQUIPE").
  const getEmployeeTeamName = (emp) => {
    const override = teamAssignments[emp.id];
    if (override) return override;
    const dept = (emp?.department || "").trim().toUpperCase();
    return dept || null;
  };

  const openNewTeamModal = () => {
    setEditingTeam(null);
    setTeamForm({ name: "", memberIds: [] });
    setShowTeamModal(true);
  };

  const openEditTeamModal = (title) => {
    const members = filteredEmployees
      .filter((emp) => (getEmployeeTeamName(emp) || "") === title)
      .map((emp) => emp.id);
    setEditingTeam({ name: title });
    setTeamForm({ name: title, memberIds: members });
    setShowTeamModal(true);
  };

  const handleSaveTeam = async () => {
    const name = teamForm.name.trim().toUpperCase();
    if (!name) {
      toast.error("Nommez votre équipe");
      return;
    }
    const previousName = editingTeam?.name || null;

    // 1. Enregistrer le nom de l'équipe dans la liste des équipes En-Check
    setTeams((prev) => {
      const exists = prev.includes(name);
      if (exists) return prev;
      return [...prev.filter((t) => t !== previousName), name];
    });

    // 2. Affecter les membres sélectionnés (mise à jour du champ department + mémorisation locale)
    setTeamAssignments((prev) => {
      const next = { ...prev };
      teamForm.memberIds.forEach((id) => {
        next[id] = name;
      });
      return next;
    });

    if (teamForm.memberIds.length > 0) {
      try {
        await supabase
          .from("employees")
          .update({ department: name })
          .in("id", teamForm.memberIds);
        setEmployees((prev) =>
          prev.map((emp) =>
            teamForm.memberIds.includes(emp.id) ? { ...emp, department: name } : emp
          )
        );
        toast.success(`Équipe "${name}" enregistrée (${teamForm.memberIds.length} membre(s))`);
      } catch (err) {
        console.error(err);
        toast.error("Erreur lors de l'affectation de l'équipe");
      }
    } else {
      toast.success(`Équipe "${name}" enregistrée`);
    }

    setShowTeamModal(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = (title) => {
    setTeams((prev) => prev.filter((t) => t !== title));
    setTeamAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((empId) => {
        if (next[empId] === title) delete next[empId];
      });
      return next;
    });
    toast.success(`Équipe "${title}" supprimée`);
  };

  // Numéro de jour En-Check (1 = Lundi .. 7 = Dimanche) à partir d'une date YYYY-MM-DD
  const dayNumFromDateStr = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00`);
    const day = d.getDay();
    return day === 0 ? 7 : day;
  };

  // ═══ DÉPÔT D'UN MODÈLE SUR UNE CASE DU CALENDRIER MENSUEL ═══
  // Si un collaborateur est ciblé par le focus, le modèle lui est réellement affecté
  // (comme dans la vue Semaine). Sinon il est déposé au niveau de la journée.
  const handleDropOnCalendarDay = (e, dateStr) => {
    e.preventDefault();
    setMonthDropDate(null);
    const payload = draggedPayload || touchDragPayload;
    setDraggedPayload(null);
    setTouchDragPayload(null);
    if (!payload) return;

    const tpl =
      payload.sourceType === "dock"
        ? payload.template
        : payload.shift
        ? {
            id: payload.shift.id,
            name: payload.shift.name || "Créneau",
            label: `${payload.shift.start_time} - ${payload.shift.end_time}`,
            color: payload.shift.color,
            kind: "shift",
            start_time: payload.shift.start_time,
            end_time: payload.shift.end_time,
            has_break: payload.shift.has_break,
            break_start: payload.shift.break_start,
            break_end: payload.shift.break_end,
            variant: payload.shift.variant,
          }
        : null;

    if (!tpl) return;

    // Affectation réelle au collaborateur ciblé par le focus
    if (focusFilter.type === "employee") {
      const targetEmp = filteredEmployees.find((emp) => emp.id === focusFilter.value);
      if (targetEmp) {
        const dayNum = dayNumFromDateStr(dateStr);
        if (tpl.kind === "rest" || tpl.kind === "leave") {
          setDayOverrides((prev) => ({
            ...prev,
            [targetEmp.id]: {
              ...(prev[targetEmp.id] || {}),
              [dateStr]: {
                isRest: true,
                label: tpl.name || (tpl.kind === "leave" ? "Congé" : "Repos"),
                name: tpl.name || (tpl.kind === "leave" ? "Congé" : "Repos"),
                subtitle: tpl.kind === "leave" ? "Congé / Absence" : "Repos",
                reason: tpl.kind === "leave" ? "Congé" : "Repos",
                variant: "conge",
                color: tpl.color || "#2D5A43",
                kind: tpl.kind,
              },
            },
          }));
          setPendingChangesCount((c) => c + 1);
          persistEmployeeShiftToSupabase(targetEmp, null, dayNum, true);
        } else {
          const newShift = {
            start_time: tpl.start_time,
            end_time: tpl.end_time,
            has_break: tpl.has_break ?? true,
            break_start: tpl.break_start,
            break_end: tpl.break_end,
            variant: tpl.variant || "standard",
            color: tpl.color,
            schedule_id: tpl.schedule_id || null,
            name: tpl.name,
          };
          setDayOverrides((prev) => ({
            ...prev,
            [targetEmp.id]: {
              ...(prev[targetEmp.id] || {}),
              [dateStr]: newShift,
            },
          }));
          setPendingChangesCount((c) => c + 1);
          persistEmployeeShiftToSupabase(targetEmp, newShift, dayNum, false);
        }
        toast.success(
          `« ${tpl.name || "Modèle"} » affecté à ${targetEmp.first_name} le ${dateStr}`
        );
        return;
      }
    }

    const entry = {
      id: tpl.id || `shift-${Date.now()}`,
      name: tpl.name || "Modèle",
      label:
        tpl.label ||
        (tpl.kind === "rest" || tpl.kind === "leave"
          ? tpl.name
          : `${tpl.name} ${formatTime(tpl.start_time)}-${formatTime(tpl.end_time)}`),
      color: tpl.color || "#B56235",
      kind: tpl.kind || "shift",
    };

    setMonthModels((prev) => ({
      ...prev,
      [dateStr]: [...(prev[dateStr] || []), entry],
    }));
    toast.success(`« ${entry.label} » placé sur le ${dateStr}`);
  };

  const removeMonthModel = (dateStr, index) => {
    setMonthModels((prev) => ({
      ...prev,
      [dateStr]: (prev[dateStr] || []).filter((_, i) => i !== index),
    }));
    toast.success("Modèle retiré de la journée");
  };

  // ═══ DISPONIBILITÉS COLLABORATEURS (Aujourd'hui / Cette semaine / jour précis) ═══
  // scopes possibles : "today" | "week" | "day-1" .. "day-7" (Lun .. Dim)
  const setEmployeeAvailability = (empId, scope, value) => {
    setAvailability((prev) => {
      const current = prev[empId] || {};
      const nextValue = current[scope] === value ? null : value;
      return {
        ...prev,
        [empId]: { ...current, [scope]: nextValue },
      };
    });
  };

  const getAvailabilityState = (empId, scope) => availability[empId]?.[scope] || null;

  // Cycle : non renseigné -> disponible -> indisponible -> non renseigné
  const cycleAvailability = (empId, scope) => {
    const current = getAvailabilityState(empId, scope);
    const next =
      current === "available" ? "unavailable" : current === "unavailable" ? null : "available";
    setEmployeeAvailability(empId, scope, next);
  };

  const setAvailabilityValue = (empId, scope, value) => {
    const current = getAvailabilityState(empId, scope);
    setEmployeeAvailability(empId, scope, current === value ? null : value);
  };

  const openAvailabilityModal = (emp) => {
    setAvailabilityTarget(emp);
    setShowAvailabilityModal(true);
  };

  const focusLabel = useMemo(() => {
    if (focusFilter.type === "team") return focusFilter.value;
    if (focusFilter.type === "employee") {
      const emp = filteredEmployees.find((e) => e.id === focusFilter.value);
      return emp ? `${emp.first_name} ${emp.last_name}` : "Collaborateur";
    }
    return "Toute l'équipe";
  }, [focusFilter, filteredEmployees]);

  // L'option Planning est payante : aucune grille horaire n'est affichée pour les
  // entreprises qui n'y ont pas souscrit (module_planning === false).
  const isPlanningModuleEnabled = (emp) => emp?.enterprises?.module_planning !== false;

  const employeesWithoutPlanningOption = useMemo(
    () => filteredEmployees.filter((emp) => !isPlanningModuleEnabled(emp)),
    [filteredEmployees]
  );

  // ═══ RÉSOLUTION DU SHIFT D'UN EMPLOYÉ SUR UN JOUR DONNÉ ═══
  const resolveCellShift = (emp, dayItem) => {
    const { dateStr, dayNum } = dayItem;
    const empOverrides = dayOverrides[emp.id] || {};
    const override = empOverrides[dateStr] ?? empOverrides[`day-${dayNum}`];

    if (override) {
      // Case explicitement vidée par l'utilisateur : aucun créneau affiché
      if (override.isEmpty) return null;

      // Un repos / congé déposé doit rester VISIBLE dans la case (carte dédiée)
      if (override.isRest) {
        const nomModele = override.name || override.label || "Repos";
        return {
          isRest: true,
          // Le nom du modele (ex. « maladie ») doit traverser la resolution,
          // sinon l'interface retombait sur le libelle generique « Repos ».
          name: nomModele,
          label: override.label || nomModele,
          subtitle:
            override.subtitle ||
            override.reason ||
            (override.kind === "leave" ? "Congé / Absence" : "Repos"),
          start_time: nomModele,
          end_time: override.reason || "Repos",
          has_break: false,
          variant: override.variant || "conge",
          color: override.color,
          kind: override.kind || "rest",
        };
      }
      return override;
    }

    // Jour férié non travaillé ?
    const hMap = getHolidayMap(emp.enterprise_id);
    if (hMap.has(dateStr)) {
      const hol = hMap.get(dateStr);
      return {
        start_time: "Férié",
        end_time: hol?.name || "Jour férié",
        has_break: false,
        variant: "ferie",
        isHoliday: true,
        label: hol?.name || "Jour férié",
      };
    }

    // Absence / Congé couvrant ce jour ?
    const empAbs = absences.find(
      (a) =>
        a.employee_id === emp.id &&
        a.status !== "rejected" &&
        a.start_date <= dateStr &&
        a.end_date >= dateStr
    );
    if (empAbs) {
      return {
        start_time: "Congé",
        end_time: empAbs.reason || "Absence",
        has_break: false,
        variant: "conge",
        isAbsence: true,
        label: empAbs.reason || "Congé",
      };
    }

    // Option Planning non souscrite par l'entreprise : aucun horaire affiché
    if (!isPlanningModuleEnabled(emp)) return null;

    // Planning personnalisé de l'employé (employee_schedules)
    const es = employeeSchedules.find((row) => row.employee_id === emp.id && row.is_active !== false);
    if (es) {
      if (es.use_custom_hours) {
        const days = es.custom_work_days || [1, 2, 3, 4, 5];
        if (!days.includes(dayNum)) return null;
        const st = formatTime(es.custom_start_time || "08:00");
        const et = formatTime(es.custom_end_time || "17:00");
        const isNight = st >= "19:00" || et <= "07:00";
        const isGarde = st >= "13:00" && !isNight;
        return {
          start_time: st,
          end_time: et,
          has_break: es.custom_has_break ?? true,
          break_start: formatTime(es.custom_break_start || "12:00"),
          break_end: formatTime(es.custom_break_end || "13:00"),
          variant: isNight ? "nuit" : isGarde ? "garde" : "standard",
          name: es.work_schedules?.name || "Horaire personnalisé",
          source: "custom",
          esRow: es,
        };
      }
      if (es.work_schedules) {
        const ws = es.work_schedules;
        const days = ws.work_days || [1, 2, 3, 4, 5];
        if (!days.includes(dayNum)) return null;
        const st = formatTime(ws.start_time || "08:00");
        const et = formatTime(ws.end_time || "17:00");
        const isNight = st >= "19:00" || et <= "07:00";
        const isGarde = st >= "13:00" && !isNight;
        return {
          start_time: st,
          end_time: et,
          has_break: ws.has_break ?? true,
          break_start: formatTime(ws.break_start || "12:00"),
          break_end: formatTime(ws.break_end || "13:00"),
          variant: isNight ? "nuit" : isGarde ? "garde" : "standard",
          name: ws.name || "Modèle entreprise",
          source: "assigned_schedule",
          schedule_id: ws.id,
          esRow: es,
        };
      }
    }

    // Sinon : Planning par défaut de l'entreprise
    const defaultPlan =
      plannings.find((p) => p.enterprise_id === emp.enterprise_id && p.is_default) ||
      plannings.find((p) => p.enterprise_id === emp.enterprise_id);

    if (defaultPlan) {
      const days = defaultPlan.work_days || [1, 2, 3, 4, 5];
      if (!days.includes(dayNum)) return null;
      const st = formatTime(defaultPlan.start_time || "08:00");
      const et = formatTime(defaultPlan.end_time || "17:00");
      return {
        start_time: st,
        end_time: et,
        has_break: defaultPlan.has_break ?? true,
        break_start: formatTime(defaultPlan.break_start || "12:00"),
        break_end: formatTime(defaultPlan.break_end || "13:00"),
        variant: "standard",
        name: defaultPlan.name || "Modèle par défaut",
        source: "default",
        schedule_id: defaultPlan.id,
      };
    }

    // ⚠️ Aucun horaire fictif n'est inventé : sans planning attribué la case reste vide.
    return null;
  };

  // ═══ SYNCHRONISATION SUPABASE D'UN SHIFT DÉPOSÉ (DRAG & DROP) ═══
  const persistEmployeeShiftToSupabase = async (emp, shiftData, targetDayNum, removeDay = false) => {
    try {
      const existingES = employeeSchedules.find((row) => row.employee_id === emp.id);

      // Retirer un jour sur un collaborateur rattaché à une grille entreprise :
      // on n'écrit surtout pas des horaires inventés en base. La surcharge locale
      // (isEmpty) masque déjà le jour dans la grille, la grille entreprise reste intacte.
      if (removeDay && !shiftData && existingES && !existingES.use_custom_hours && existingES.schedule_id) {
        return;
      }

      const currentDays = existingES
        ? existingES.use_custom_hours
          ? existingES.custom_work_days || [1, 2, 3, 4, 5]
          : existingES.work_schedules?.work_days || [1, 2, 3, 4, 5]
        : [1, 2, 3, 4, 5];

      let nextDays = [...currentDays];
      if (removeDay) {
        nextDays = nextDays.filter((d) => d !== targetDayNum);
      } else if (targetDayNum && !nextDays.includes(targetDayNum)) {
        nextDays = [...nextDays, targetDayNum].sort();
      } else if (!targetDayNum && shiftData?.work_days) {
        nextDays = shiftData.work_days;
      }

      if (nextDays.length === 0) nextDays = [1, 2, 3, 4, 5];

      const startStr = (shiftData?.start_time || "08:00").slice(0, 5) + ":00";
      const endStr = (shiftData?.end_time || "17:00").slice(0, 5) + ":00";
      const hasBrk = shiftData?.has_break ?? true;
      const brkStart = hasBrk ? (shiftData?.break_start || "12:00").slice(0, 5) + ":00" : null;
      const brkEnd = hasBrk ? (shiftData?.break_end || "13:00").slice(0, 5) + ":00" : null;

      const payload = {
        employee_id: emp.id,
        schedule_id: shiftData?.schedule_id || null,
        use_custom_hours: !shiftData?.schedule_id,
        custom_start_time: shiftData?.schedule_id ? null : startStr,
        custom_end_time: shiftData?.schedule_id ? null : endStr,
        custom_break_start: shiftData?.schedule_id ? null : brkStart,
        custom_break_end: shiftData?.schedule_id ? null : brkEnd,
        custom_has_break: shiftData?.schedule_id ? true : hasBrk,
        custom_work_days: shiftData?.schedule_id ? null : nextDays,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("employee_schedules")
        .upsert(payload, { onConflict: "employee_id" });

      if (!error) {
        setEmployeeSchedules((prev) => {
          const others = prev.filter((r) => r.employee_id !== emp.id);
          return [...others, { ...(existingES || {}), ...payload }];
        });
      }
    } catch (err) {
      console.warn("Synchronisation directe employee_schedules:", err);
    }
  };

  // ═══ GESTIONNAIRES DRAG & DROP EN-CHECK ═══
  const handleDragStartTemplate = (e, tpl) => {
    const payload = {
      sourceType: "dock",
      template: tpl,
    };
    setDraggedPayload(payload);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    }
  };

  const handleDragStartCellShift = (e, emp, dayItem, shift) => {
    const payload = {
      sourceType: "cell",
      fromEmpId: emp.id,
      fromDateStr: dayItem.dateStr,
      fromDayNum: dayItem.dayNum,
      shift,
    };
    setDraggedPayload(payload);
    setIsAltPressed(Boolean(e.altKey || e.ctrlKey || e.metaKey));
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    }
  };

  const handleDragOverCell = (e, emp, dayItem) => {
    e.preventDefault();
    if (e.altKey || e.ctrlKey || e.metaKey) {
      if (!isAltPressed) setIsAltPressed(true);
    } else if (isAltPressed) {
      setIsAltPressed(false);
    }
    if (
      !dropTargetCell ||
      dropTargetCell.empId !== emp.id ||
      dropTargetCell.dateStr !== dayItem.dateStr
    ) {
      setDropTargetCell({
        empId: emp.id,
        dateStr: dayItem.dateStr,
        dayNum: dayItem.dayNum,
      });
    }
  };

  const handleDropOnCell = async (e, targetEmp, targetDay) => {
    e.preventDefault();
    const duplicateMode = Boolean(e.altKey || e.ctrlKey || e.metaKey || isAltPressed);
    const payload = draggedPayload;
    setDropTargetCell(null);
    setDraggedPayload(null);

    if (!payload) return;

    // 1. Dépôt depuis le Dock de modèles
    if (payload.sourceType === "dock") {
      const tpl = payload.template;
      if (tpl.kind === "rest" || tpl.kind === "leave") {
        const estConge = tpl.kind === "leave";
        setDayOverrides((prev) => ({
          ...prev,
          [targetEmp.id]: {
            ...(prev[targetEmp.id] || {}),
            [targetDay.dateStr]: {
              isRest: true,
              name: tpl.name || (estConge ? "Congé" : "Repos"),
              label: tpl.name || (estConge ? "Congé" : "Repos"),
              subtitle: estConge ? "Congé / Absence" : "Repos",
              reason: estConge ? "Congé" : "Repos",
              variant: "conge",
              color: tpl.color || "#2D5A43",
              kind: tpl.kind,
            },
          },
        }));
        setPendingChangesCount((c) => c + 1);
        await persistEmployeeShiftToSupabase(targetEmp, null, targetDay.dayNum, true);
        toast.success(
          `« ${tpl.name || (estConge ? "Congé" : "Repos")} » placé sur ${
            targetDay.labelHeader
          } (${targetEmp.first_name})`
        );
        return;
      }

      if (tpl.kind === "leave") {
        setDayOverrides((prev) => ({
          ...prev,
          [targetEmp.id]: {
            ...(prev[targetEmp.id] || {}),
            [targetDay.dateStr]: {
              isLeave: true,
              name: tpl.name || "Congé",
              label: tpl.name || "Congé",
              subtitle: "Congé / Absence",
              start_time: tpl.name || "Congé",
              end_time: "Congé / Absence",
              has_break: false,
              variant: "conge",
              color: tpl.color,
            },
          },
        }));
        setPendingChangesCount((c) => c + 1);
        await persistEmployeeShiftToSupabase(targetEmp, null, targetDay.dayNum, true);
        toast.success(
          `« ${tpl.name} » appliqué pour ${targetEmp.first_name} (${targetDay.labelHeader})`
        );
        return;
      }

      if (tpl.kind === "break_only") {
        const currentShift = resolveCellShift(targetEmp, targetDay);
        // Sans horaire sur la case : on affiche la pause comme une carte autonome
        if (!currentShift || currentShift.isHoliday || currentShift.isAbsence || currentShift.isRest) {
          const standalonePause = {
            isPauseOnly: true,
            start_time: tpl.break_start || "12:00",
            end_time: tpl.break_end || "13:00",
            has_break: true,
            break_start: tpl.break_start || "12:00",
            break_end: tpl.break_end || "13:00",
            variant: "pause",
            color: tpl.color || "#0E7490",
            name: tpl.name || "Pause",
          };
          setDayOverrides((prev) => ({
            ...prev,
            [targetEmp.id]: {
              ...(prev[targetEmp.id] || {}),
              [targetDay.dateStr]: standalonePause,
            },
          }));
          setPendingChangesCount((c) => c + 1);
          toast.success(
            `« ${tpl.name || "Pause"} » affiché sur ${targetDay.labelHeader} (${targetEmp.first_name})`
          );
          return;
        }
        const updatedShift = {
          ...currentShift,
          has_break: true,
          break_start: tpl.break_start || "12:00",
          break_end: tpl.break_end || "13:00",
        };
        setDayOverrides((prev) => ({
          ...prev,
          [targetEmp.id]: {
            ...(prev[targetEmp.id] || {}),
            [targetDay.dateStr]: updatedShift,
          },
        }));
        setPendingChangesCount((c) => c + 1);
        await persistEmployeeShiftToSupabase(targetEmp, updatedShift, targetDay.dayNum, false);
        toast.success(`Pause 12:00–13:00 ajoutée sur ${targetDay.labelHeader}`);
        return;
      }

      const newShift = {
        start_time: tpl.start_time,
        end_time: tpl.end_time,
        has_break: tpl.has_break,
        break_start: tpl.break_start,
        break_end: tpl.break_end,
        variant: tpl.variant || "standard",
        schedule_id: tpl.schedule_id || null,
        name: tpl.name,
      };

      setDayOverrides((prev) => ({
        ...prev,
        [targetEmp.id]: {
          ...(prev[targetEmp.id] || {}),
          [targetDay.dateStr]: newShift,
        },
      }));
      setPendingChangesCount((c) => c + 1);
      await persistEmployeeShiftToSupabase(targetEmp, newShift, targetDay.dayNum, false);
      toast.success(
        `${tpl.name} (${tpl.start_time}–${tpl.end_time}) affecté à ${targetEmp.first_name} (${targetDay.labelHeader})`
      );
      return;
    }

    // 2. Dépôt d'une cellule vers une autre cellule (Déplacer ou Alt+Dupliquer)
    if (payload.sourceType === "cell") {
      if (
        payload.fromEmpId === targetEmp.id &&
        payload.fromDateStr === targetDay.dateStr
      ) {
        return;
      }

      const movedShift = {
        ...payload.shift,
        isHoliday: false,
        isAbsence: false,
      };

      setDayOverrides((prev) => {
        const next = { ...prev };
        // Appliquer sur la case cible
        next[targetEmp.id] = {
          ...(next[targetEmp.id] || {}),
          [targetDay.dateStr]: movedShift,
        };
        // Si ce n'est pas une duplication (Alt), vider réellement la case source
        if (!duplicateMode) {
          next[payload.fromEmpId] = {
            ...(next[payload.fromEmpId] || {}),
            [payload.fromDateStr]: { isEmpty: true },
          };
        }
        return next;
      });

      setPendingChangesCount((c) => c + 1);
      await persistEmployeeShiftToSupabase(targetEmp, movedShift, targetDay.dayNum, false);
      toast.success(
        duplicateMode
          ? `Shift dupliqué sur ${targetDay.labelHeader} (${targetEmp.first_name})`
          : `Shift déplacé vers ${targetDay.labelHeader} (${targetEmp.first_name})`
      );
    }
  };

  // Dépôt d'un modèle directement sur la ligne entière d'un employé (affecte toute sa semaine Lun-Ven)
  const handleDropOnEmployeeRow = async (e, targetEmp) => {
    e.preventDefault();
    const payload = draggedPayload;
    setDropTargetCell(null);
    setDraggedPayload(null);

    if (!payload || payload.sourceType !== "dock") return;
    const tpl = payload.template;

    const weekMap = {};
    weekDays.forEach((d) => {
      if (tpl.kind === "rest") {
        weekMap[d.dateStr] = {
          isRest: true,
          label: tpl.name || "Repos",
          name: tpl.name || "Repos",
          subtitle: tpl.kind === "leave" ? "Congé / Absence" : "Repos",
          reason: tpl.kind === "leave" ? "Congé" : "Repos",
          variant: "conge",
          color: tpl.color || "#2D5A43",
          kind: tpl.kind === "leave" ? "leave" : "rest",
        };
      } else if (tpl.kind === "leave") {
        weekMap[d.dateStr] = {
          isLeave: true,
          name: tpl.name || "Congé",
          label: tpl.name || "Congé",
          subtitle: "Congé / Absence",
          start_time: tpl.name || "Congé",
          end_time: "Congé / Absence",
          has_break: false,
          variant: "conge",
          color: tpl.color,
        };
      } else if (d.dayNum <= 5) {
        weekMap[d.dateStr] = {
          start_time: tpl.start_time || "08:00",
          end_time: tpl.end_time || "17:00",
          has_break: tpl.has_break ?? true,
          break_start: tpl.break_start || "12:00",
          break_end: tpl.break_end || "13:00",
          variant: tpl.variant || "standard",
          schedule_id: tpl.schedule_id || null,
          name: tpl.name,
        };
      }
    });

    setDayOverrides((prev) => ({
      ...prev,
      [targetEmp.id]: {
        ...(prev[targetEmp.id] || {}),
        ...weekMap,
      },
    }));
    setPendingChangesCount((c) => c + 1);
    if (tpl.kind !== "rest") {
      await persistEmployeeShiftToSupabase(
        targetEmp,
        {
          start_time: tpl.start_time || "08:00",
          end_time: tpl.end_time || "17:00",
          has_break: tpl.has_break ?? true,
          break_start: tpl.break_start || "12:00",
          break_end: tpl.break_end || "13:00",
          schedule_id: tpl.schedule_id || null,
          work_days: [1, 2, 3, 4, 5],
        },
        null,
        false
      );
    }
    toast.success(`Modèle "${tpl.label}" appliqué sur la semaine de ${targetEmp.first_name}`);
  };

  // Retire réellement un créneau (Semaine, Mois ou Jour) : la case redevient vide
  const clearShiftForDate = async (emp, dateStr, dayNum) => {
    setDayOverrides((prev) => ({
      ...prev,
      [emp.id]: {
        ...(prev[emp.id] || {}),
        [dateStr]: { isEmpty: true },
      },
    }));
    setPendingChangesCount((c) => c + 1);
    await persistEmployeeShiftToSupabase(emp, null, dayNum, true);
  };

  const handleClearCellShift = async (e, emp, dayItem) => {
    e.stopPropagation();
    await clearShiftForDate(emp, dayItem.dateStr, dayItem.dayNum);
    toast.success(`Créneau retiré (${emp.first_name} · ${dayItem.labelHeader})`);
  };

  // Action "Dupliquer la semaine"
  const handleDuplicateWeek = () => {
    const nextMonday = new Date(getStartOfWeekMonday(calendarDate));
    nextMonday.setDate(nextMonday.getDate() + 7);

    setDayOverrides((prev) => {
      const next = { ...prev };
      filteredEmployees.forEach((emp) => {
        const empNext = { ...(next[emp.id] || {}) };
        weekDays.forEach((dayItem, idx) => {
          const currentShift = resolveCellShift(emp, dayItem);
          const targetDate = new Date(nextMonday);
          targetDate.setDate(nextMonday.getDate() + idx);
          const targetIso = toIsoDateLocal(targetDate);
          if (currentShift && !currentShift.isHoliday && !currentShift.isAbsence) {
            empNext[targetIso] = { ...currentShift };
          }
        });
        next[emp.id] = empNext;
      });
      return next;
    });

    setPendingChangesCount((c) => c + 1);
    toast.success("Planning de la semaine dupliqué sur la semaine suivante !");
  };

  // Action "Publier le planning"
  const handlePublishPlanning = async () => {
    setPublishing(true);
    try {
      await Promise.all(
        filteredEmployees.map(async (emp) => {
          const activeDays = [];
          let refShift = null;
          weekDays.forEach((d) => {
            const s = resolveCellShift(emp, d);
            if (s && !s.isHoliday && !s.isAbsence && !s.isRest && !s.isLeave) {
              activeDays.push(d.dayNum);
              if (!refShift) refShift = s;
            }
          });
          if (refShift && activeDays.length > 0) {
            await persistEmployeeShiftToSupabase(
              emp,
              { ...refShift, work_days: activeDays },
              null,
              false
            );
          }
        })
      );
      setPendingChangesCount(0);
      toast.success("Planning publié et synchronisé pour toute l'équipe !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la publication du planning");
    }
    setPublishing(false);
  };

  // ═══ GROUPEMENT DES EMPLOYÉS PAR ÉQUIPE EN-CHECK (TOUTES PLIABLES) ═══
  // Chaque équipe — y compris GARDE & LOGISTIQUE — possède sa propre barre pliable.
  const employeeGroups = useMemo(() => {
    const groupsMap = new Map();
    const NO_TEAM = "SANS ÉQUIPE";

    filteredEmployees.forEach((emp) => {
      const groupTitle = getEmployeeTeamName(emp) || NO_TEAM;
      if (!groupsMap.has(groupTitle)) groupsMap.set(groupTitle, []);
      groupsMap.get(groupTitle).push(emp);
    });

    // Les équipes déclarées dans En-Check apparaissent même si elles sont vides
    teams.forEach((t) => {
      const title = String(t).toUpperCase();
      if (!groupsMap.has(title)) groupsMap.set(title, []);
    });

    // Ordre d'affichage : GARDE & LOGISTIQUE puis ÉQUIPE OFFICINE & VENTE puis les autres
    const priority = ["GARDE & LOGISTIQUE", "ÉQUIPE OFFICINE & VENTE"];
    const entries = Array.from(groupsMap.entries());
    entries.sort((a, b) => {
      const ia = priority.indexOf(a[0]);
      const ib = priority.indexOf(b[0]);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      if (a[0] === NO_TEAM) return 1;
      if (b[0] === NO_TEAM) return -1;
      return a[0].localeCompare(b[0], "fr");
    });

    return entries.map(([title, emps]) => ({
      title,
      employees: emps,
      isBannerOnly: false,
    }));
  }, [filteredEmployees, teams, teamAssignments]);

  // ═══ COLLABORATEURS VISIBLES (groupes dépliés) ET FOCUS (équipe / collaborateur) ═══
  const visibleEmployees = useMemo(
    () =>
      employeeGroups
        .filter((g) => !collapsedGroups[g.title])
        .flatMap((g) => g.employees),
    [employeeGroups, collapsedGroups]
  );

  const matchesFocus = (emp) => {
    if (focusFilter.type === "team") {
      return (getEmployeeTeamName(emp) || "SANS ÉQUIPE") === focusFilter.value;
    }
    if (focusFilter.type === "employee") {
      return emp.id === focusFilter.value;
    }
    return true;
  };

  const scopedEmployees = useMemo(
    () => visibleEmployees.filter(matchesFocus),
    [visibleEmployees, focusFilter, teamAssignments]
  );

  // Jours de la période affichée (Semaine = 7 jours, Mois = tout le mois, Jour = 1 jour)
  const periodDates = useMemo(() => {
    if (planningView === "jour") return [toIsoDateLocal(calendarDate)];
    if (planningView === "mois") {
      const y = calendarDate.getFullYear();
      const m = calendarDate.getMonth();
      const nb = getDaysInMonth(y, m);
      return Array.from(
        { length: nb },
        (_, i) => `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
      );
    }
    return weekDays.map((d) => d.dateStr);
  }, [planningView, calendarDate, weekDays]);

  // ═══ POINTAGES RÉELS : MÊME MOTEUR QUE LA PAGE POINTAGES ═══
  // Les entrées/sorties affichées dans le Planning sont calculées par
  // `resoudrePointagesJournee` (appariement, garde de nuit, auto-close, seuils
  // entreprise) — exactement comme la carte d'un collaborateur dans Pointages.
  const employeeScheduleByEmp = useMemo(() => {
    const map = {};
    employeeSchedules.forEach((es) => {
      if (es?.employee_id) map[es.employee_id] = es;
    });
    return map;
  }, [employeeSchedules]);

  const enterpriseCfgByEnt = useMemo(() => {
    const map = {};
    entreprises.forEach((ent) => {
      map[ent.id] = {
        autoCloseEnabled: ent.auto_close_enabled === true,
        autoCloseTime: (ent.auto_close_time || "23:59:00").slice(0, 8),
        autoCloseGraceMinutes: Number(ent.auto_close_grace_minutes || 0),
      };
    });
    return map;
  }, [entreprises]);

  const attendancesByEmp = useMemo(() => {
    const map = new Map();
    attendances.forEach((a) => {
      if (!a?.employee_id) return;
      if (!map.has(a.employee_id)) map.set(a.employee_id, []);
      map.get(a.employee_id).push(a);
    });
    return map;
  }, [attendances]);

  const realAttendanceMap = useMemo(() => {
    const map = new Map();
    if (attendances.length === 0 || scopedEmployees.length === 0) return map;

    scopedEmployees.forEach((emp) => {
      const raw = attendancesByEmp.get(emp.id) || [];
      if (raw.length === 0) return;
      periodDates.forEach((date) => {
        let result;
        try {
          result = resoudrePointagesJournee(raw, date, {
            enableAutoClose: true,
            employeeSchedule: employeeScheduleByEmp[emp.id] || null,
            defaultSchedule: FeatureService.getApplicableSchedule(
              emp.enterprise_id,
              date,
              allSchedules
            ),
            enterpriseCfg: enterpriseCfgByEnt[emp.enterprise_id] || {},
            seuils: seuilsByEnterprise[emp.enterprise_id] || null,
          });
        } catch (err) {
          console.warn("Planning · calcul pointage réel", err);
          return;
        }
        if (!result || !result.firstIn) return;
        const minutes = Math.round((result.totalSecondes || 0) / 60);
        map.set(`${emp.id}|${date}`, {
          firstIn: result.firstIn.check_time,
          lastOut: result.lastOut ? result.lastOut.check_time : null,
          minutes,
          autoClosed: Boolean((result.attendances || []).some((a) => a.is_auto_closed)),
          count: (result.attendances || []).length,
          pairs: result.validPairs?.length || 0,
        });
      });
    });
    return map;
  }, [
    attendances,
    attendancesByEmp,
    scopedEmployees,
    periodDates,
    employeeScheduleByEmp,
    enterpriseCfgByEnt,
    seuilsByEnterprise,
    allSchedules,
  ]);

  const getRealAttendance = (empId, dateStr) => realAttendanceMap.get(`${empId}|${dateStr}`) || null;

  // Libellé des entrées / sorties réelles.
  // Quand la sortie n'est pas encore pointée, on affiche « en cours » (comme la page
  // Pointages) au lieu d'un « → … » incomplet.
  const formatRealLabel = (real) => {
    if (!real || !real.firstIn) return null;
    const entree = heureLocale(real.firstIn);
    return real.lastOut ? `${entree} → ${heureLocale(real.lastOut)}` : `${entree} → en cours`;
  };

  const realIsOpen = (real) => Boolean(real && real.firstIn && !real.lastOut);


  // ═══ TOTAUX JOURNALIERS POUR LE PIED DE PAGE EN-CHECK ═══
  // Les compteurs (X pers. · XXh) suivent les équipes dépliées et le focus sélectionné.
  const dailyTotals = useMemo(() => {
    return weekDays.map((dayItem) => {
      let headcount = 0;
      let totalMinutes = 0;
      scopedEmployees.forEach((emp) => {
        const shift = resolveCellShift(emp, dayItem);
        if (
          shift &&
          !shift.isRest &&
          !shift.isLeave &&
          !shift.isAbsence &&
          !shift.isHoliday
        ) {
          headcount += 1;
          totalMinutes += computeShiftNetMinutes(shift);
        }
      });
      return {
        dateStr: dayItem.dateStr,
        labelHeader: dayItem.labelHeader,
        headcount,
        totalMinutes,
        hoursLabel: formatHoursCompact(totalMinutes),
      };
    });
  }, [weekDays, scopedEmployees, dayOverrides, employeeSchedules, plannings, absences, holidayMapsByEnterprise]);

  // ═══ CRUD MODÈLES D'HORAIRES & AFFECTATIONS ═══
  const handleAdd = () => {
    const eid = admin?.selectedEnterprise?.id || admin?.enterprise_id;
    const defaultEid =
      admin?.role === "super_admin"
        ? selectedEntreprise !== "all"
          ? selectedEntreprise
          : entreprises[0]?.id || ""
        : eid;
    setFormData({
      enterprise_id: defaultEid,
      name: "Horaires standard",
      start_time: "08:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "13:00",
      has_break: true,
      work_days: [1, 2, 3, 4, 5],
      late_tolerance_minutes: 15,
      is_default: true,
    });
    setEditingPlanning(null);
    setShowModal(true);
  };

  const handleEdit = (p) => {
    setFormData({
      enterprise_id: p.enterprise_id,
      name: p.name,
      start_time: p.start_time?.slice(0, 5) || "08:00",
      end_time: p.end_time?.slice(0, 5) || "17:00",
      break_start: p.break_start?.slice(0, 5) || "12:00",
      break_end: p.break_end?.slice(0, 5) || "13:00",
      has_break: p.has_break ?? true,
      work_days: p.work_days || [1, 2, 3, 4, 5],
      late_tolerance_minutes: p.late_tolerance_minutes || 15,
      is_default: p.is_default ?? true,
    });
    setEditingPlanning(p);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast.error("Nom obligatoire");
        return;
      }
      if (!formData.enterprise_id) {
        toast.error("Sélectionnez une entreprise");
        return;
      }
      if (formData.work_days.length === 0) {
        toast.error("Sélectionnez au moins un jour");
        return;
      }
      const d = {
        enterprise_id: formData.enterprise_id,
        name: formData.name,
        start_time: formData.start_time + ":00",
        end_time: formData.end_time + ":00",
        break_start: formData.has_break ? formData.break_start + ":00" : null,
        break_end: formData.has_break ? formData.break_end + ":00" : null,
        has_break: formData.has_break,
        work_days: formData.work_days,
        late_tolerance_minutes: parseInt(formData.late_tolerance_minutes) || 15,
        is_default: formData.is_default,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (editingPlanning) {
        const { error } = await supabase
          .from("work_schedules")
          .update(d)
          .eq("id", editingPlanning.id);
        if (error) throw error;
        toast.success("Modèle de planning modifié !");
      } else {
        const { error } = await supabase.from("work_schedules").insert(d);
        if (error) throw error;
        toast.success("Modèle de planning créé !");
      }
      setShowModal(false);
      loadData(admin);
    } catch (error) {
      console.error(error);
      toast.error("Erreur sauvegarde");
    }
  };

  const confirmDelete = (p) => {
    setPlanningToDelete(p);
    setShowDeleteModal(true);
  };

  const confirmDeleteRequest = (request) => {
    setRequestToDelete(request);
    setShowDeleteRequestModal(true);
  };

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    try {
      const { error } = await supabase
        .from("schedule_change_requests")
        .delete()
        .eq("id", requestToDelete.id);
      if (error) throw error;
      toast.success("Demande supprimée");
      setShowDeleteRequestModal(false);
      setRequestToDelete(null);
      loadData(admin);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDelete = async () => {
    if (!planningToDelete) return;
    try {
      await supabase
        .from("work_schedules")
        .update({ is_active: false })
        .eq("id", planningToDelete.id);
      toast.success("Planning supprimé");
      setShowDeleteModal(false);
      setPlanningToDelete(null);
      loadData(admin);
    } catch (error) {
      console.error(error);
      toast.error("Erreur suppression");
    }
  };

  const toggleJour = (id) => {
    setFormData((f) => ({
      ...f,
      work_days: f.work_days.includes(id)
        ? f.work_days.filter((j) => j !== id)
        : [...f.work_days, id].sort(),
    }));
  };

  const toggleCustomJour = (id) => {
    setEmployeeScheduleForm((f) => ({
      ...f,
      custom_work_days: f.custom_work_days.includes(id)
        ? f.custom_work_days.filter((j) => j !== id)
        : [...f.custom_work_days, id].sort(),
    }));
  };

  const openCellEditorModal = (emp, dayItem = null, currentShift = null) => {
    setCellEditContext(
      dayItem
        ? { empId: emp.id, dateStr: dayItem.dateStr, dayNum: dayItem.dayNum }
        : null
    );
    const existingES = employeeSchedules.find((es) => es.employee_id === emp.id);
    if (existingES) {
      setEditingEmployeeSchedule(existingES);
      setEmployeeScheduleForm({
        employee_id: emp.id,
        schedule_id: existingES.schedule_id || "",
        use_custom_hours: existingES.use_custom_hours || Boolean(currentShift),
        custom_start_time:
          currentShift?.start_time?.slice(0, 5) ||
          existingES.custom_start_time?.slice(0, 5) ||
          "08:00",
        custom_end_time:
          currentShift?.end_time?.slice(0, 5) ||
          existingES.custom_end_time?.slice(0, 5) ||
          "17:00",
        custom_break_start:
          currentShift?.break_start?.slice(0, 5) ||
          existingES.custom_break_start?.slice(0, 5) ||
          "12:00",
        custom_break_end:
          currentShift?.break_end?.slice(0, 5) ||
          existingES.custom_break_end?.slice(0, 5) ||
          "13:00",
        custom_has_break: currentShift?.has_break ?? existingES.custom_has_break ?? true,
        custom_work_days: existingES.custom_work_days || [1, 2, 3, 4, 5],
      });
    } else {
      setEditingEmployeeSchedule(null);
      setEmployeeScheduleForm({
        employee_id: emp.id,
        schedule_id: filteredPlannings[0]?.id || "",
        use_custom_hours: true,
        custom_start_time: currentShift?.start_time?.slice(0, 5) || "08:00",
        custom_end_time: currentShift?.end_time?.slice(0, 5) || "17:00",
        custom_break_start: currentShift?.break_start?.slice(0, 5) || "12:00",
        custom_break_end: currentShift?.break_end?.slice(0, 5) || "13:00",
        custom_has_break: currentShift?.has_break ?? true,
        custom_work_days: dayItem ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5],
        custom_color: currentShift?.color || "#B56235",
      });
    }
    setShowEmployeeScheduleModal(true);
  };

  const handleSaveEmployeeSchedule = async () => {
    try {
      if (!employeeScheduleForm.employee_id) {
        toast.error("Sélectionnez un employé");
        return;
      }
      if (
        !employeeScheduleForm.use_custom_hours &&
        !employeeScheduleForm.schedule_id
      ) {
        toast.error("Sélectionnez un planning");
        return;
      }
      if (
        employeeScheduleForm.use_custom_hours &&
        employeeScheduleForm.custom_work_days.length === 0
      ) {
        toast.error("Sélectionnez au moins un jour");
        return;
      }

      const payload = {
        employee_id: employeeScheduleForm.employee_id,
        schedule_id: employeeScheduleForm.use_custom_hours
          ? null
          : employeeScheduleForm.schedule_id || null,
        use_custom_hours: employeeScheduleForm.use_custom_hours,
        custom_start_time: employeeScheduleForm.use_custom_hours
          ? employeeScheduleForm.custom_start_time + ":00"
          : null,
        custom_end_time: employeeScheduleForm.use_custom_hours
          ? employeeScheduleForm.custom_end_time + ":00"
          : null,
        custom_break_start:
          employeeScheduleForm.use_custom_hours &&
          employeeScheduleForm.custom_has_break
            ? employeeScheduleForm.custom_break_start + ":00"
            : null,
        custom_break_end:
          employeeScheduleForm.use_custom_hours &&
          employeeScheduleForm.custom_has_break
            ? employeeScheduleForm.custom_break_end + ":00"
            : null,
        custom_has_break: employeeScheduleForm.use_custom_hours
          ? employeeScheduleForm.custom_has_break
          : true,
        custom_work_days: employeeScheduleForm.use_custom_hours
          ? employeeScheduleForm.custom_work_days
          : null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("employee_schedules")
        .upsert(payload, { onConflict: "employee_id" });
      if (error) throw error;

      // Nettoyer les surcharges locales de cet employé pour refléter immédiatement son nouvel horaire
      setDayOverrides((prev) => {
        const next = { ...prev };
        delete next[employeeScheduleForm.employee_id];
        return next;
      });

      // Personnalisation de la couleur de la case éditée
      if (cellEditContext) {
        const color = employeeScheduleForm.custom_color || "#B56235";
        setDayOverrides((prev) => ({
          ...prev,
          [cellEditContext.empId]: {
            ...(prev[cellEditContext.empId] || {}),
            [cellEditContext.dateStr]: {
              start_time: employeeScheduleForm.custom_start_time,
              end_time: employeeScheduleForm.custom_end_time,
              has_break: employeeScheduleForm.custom_has_break,
              break_start: employeeScheduleForm.custom_break_start,
              break_end: employeeScheduleForm.custom_break_end,
              variant: "standard",
              color,
            },
          },
        }));
      }

      toast.success("Planning collaborateur enregistré !");
      setShowEmployeeScheduleModal(false);
      loadData(admin);
    } catch (error) {
      console.error(error);
      toast.error("Erreur sauvegarde");
    }
  };

  const openReviewRequestModal = (request, action) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewComment("");
    setShowReviewRequestModal(true);
  };

  const handleReviewRequest = async () => {
    if (!selectedRequest || !reviewAction || !admin) return;
    setReviewingRequest(true);
    try {
      if (reviewAction === "approved") {
        const payload = {
          employee_id: selectedRequest.employee_id,
          schedule_id: selectedRequest.use_custom_hours
            ? null
            : selectedRequest.requested_schedule_id || null,
          use_custom_hours: selectedRequest.use_custom_hours,
          custom_start_time: selectedRequest.use_custom_hours
            ? selectedRequest.requested_start_time
            : null,
          custom_end_time: selectedRequest.use_custom_hours
            ? selectedRequest.requested_end_time
            : null,
          custom_break_start:
            selectedRequest.use_custom_hours && selectedRequest.requested_has_break
              ? selectedRequest.requested_break_start
              : null,
          custom_break_end:
            selectedRequest.use_custom_hours && selectedRequest.requested_has_break
              ? selectedRequest.requested_break_end
              : null,
          custom_has_break: selectedRequest.use_custom_hours
            ? selectedRequest.requested_has_break
            : true,
          custom_work_days: selectedRequest.use_custom_hours
            ? selectedRequest.requested_work_days
            : null,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        const { error: scheduleError } = await supabase
          .from("employee_schedules")
          .upsert(payload, { onConflict: "employee_id" });
        if (scheduleError) throw scheduleError;
      }

      const { error: requestError } = await supabase
        .from("schedule_change_requests")
        .update({
          status: reviewAction,
          admin_comment: reviewComment || null,
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (requestError) throw requestError;

      toast.success(
        reviewAction === "approved"
          ? "Demande approuvée et planning mis à jour"
          : "Demande refusée"
      );

      setShowReviewRequestModal(false);
      setSelectedRequest(null);
      setReviewAction(null);
      setReviewComment("");
      await loadData(admin);
    } catch (error) {
      console.error("Erreur traitement demande:", error);
      toast.error("Erreur lors du traitement");
    }
    setReviewingRequest(false);
  };

  // ═══ CALENDRIER MENSUEL (POUR LA VUE "MOIS") ═══
  const calendarWeeks = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const offset = getMondayOffset(year, month);

    let hSet = new Set(),
      hMap = new Map();
    if (admin?.role === "super_admin") {
      if (selectedEntreprise !== "all") {
        hSet = getHolidaySet(selectedEntreprise);
        hMap = getHolidayMap(selectedEntreprise);
      }
    } else {
      const eid = admin?.selectedEnterprise?.id || admin?.enterprise_id;
      hSet = getHolidaySet(eid);
      hMap = getHolidayMap(eid);
    }

    const allCells = [];
    for (let i = 0; i < offset; i++) {
      allCells.push({ type: "empty", id: `eb-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const pDay = getPlanningDay(year, month, d);
      const schPlannings = filteredPlannings.filter((p) => p.work_days?.includes(pDay));
      const actES = employeeSchedules.filter((es) => {
        const ok =
          selectedEntreprise === "all" ||
          es.employees?.enterprise_id === selectedEntreprise;
        if (!ok) return false;
        return es.use_custom_hours
          ? es.custom_work_days?.includes(pDay)
          : es.work_schedules?.work_days?.includes(pDay);
      });
      allCells.push({
        type: "day",
        id: `d-${dateStr}`,
        date: dateStr,
        day: d,
        pDay,
        schPlannings,
        actES,
        isHoliday: hSet.has(dateStr),
        holiday: hMap.get(dateStr) || null,
      });
    }
    const rem = allCells.length % 7;
    if (rem !== 0) {
      for (let i = 0; i < 7 - rem; i++) {
        allCells.push({ type: "empty", id: `ea-${i}` });
      }
    }
    const weeks = [];
    for (let i = 0; i < allCells.length; i += 7) {
      weeks.push(allCells.slice(i, i + 7));
    }
    return weeks;
  }, [
    calendarDate,
    filteredPlannings,
    employeeSchedules,
    selectedEntreprise,
    admin,
    holidaysByEnterprise,
    holidayMapsByEnterprise,
  ]);

  //  Deux scènes à voir : l'écran reste au moins `DUREE_MIN_CHARGEMENT_MS`,
  //  même quand les données arrivent tout de suite. « Passer l'animation »
  //  lève le plancher ; la page ne s'affiche jamais avant la fin du chargement.
  if (loading || !minLoadingDone) {
    return (
      <PlanningLoadingScreen
        darkMode={darkMode}
        onSkip={() => {
          skipLoading();
          setLoading(false);
        }}
      />
    );
  }

  // Totaux globaux pour la barre de pied En-Check
  const summaryDay = dailyTotals[0] || { headcount: filteredEmployees.length, hoursLabel: "48h00" };
  const totalActiveEmployees = filteredEmployees.length;
  const totalDayHoursLabel =
    summaryDay.totalMinutes > 0
      ? `${Math.floor(summaryDay.totalMinutes / 60)}h${String(summaryDay.totalMinutes % 60).padStart(2, "0")}`
      : "48h00";

  return (
    <div className="sk-plan-page" data-theme={darkMode ? "dark" : "light"}>
      {/* Frise supérieure textile Kente */}
      <div className="sk-kente-top-strip" aria-hidden="true">
        <KenteWovenTapestrySvg />
      </div>

      {/* ═══ BARRE DE COMMANDE SUPÉRIEURE FAÇON EN-CHECK ═══ */}
      <header className="sk-topbar">
        <div className="sk-topbar-inner">
          {/* Gauche : Flèche retour ← + Titre En-Check · Planning + Filtre Entreprise */}
          <div className="sk-topbar-left">
            <button
              type="button"
              className="sk-back-btn"
              onClick={() => navigate("/dashboard")}
              title="Retour au Dashboard"
              aria-label="Retour au Dashboard"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="sk-brand-title-wrap">
              <h1 className="sk-brand-title">En-Check · Planning</h1>
            </div>

            {admin?.role === "super_admin" && entreprises.length > 0 && (
              <select
                className="sk-ent-select"
                value={selectedEntreprise}
                onChange={(e) => setSelectedEntreprise(e.target.value)}
                aria-label="Filtrer par entreprise"
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Centre : Motifs Adinkra + Sélecteur de semaine "Lun 19 – Dim 25 Oct. 2026" */}
          <div className="sk-topbar-center">
            <span className="sk-adinkra-divider" aria-hidden="true">
              <AdinkraWatermarkSvg size={24} />
            </span>

            <div className="sk-period-nav">
              <button
                type="button"
                className="sk-period-arrow"
                onClick={() => navigatePeriod(-1)}
                title="Période précédente"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="sk-period-label">{periodLabel}</span>
              <button
                type="button"
                className="sk-period-arrow"
                onClick={() => navigatePeriod(1)}
                title="Période suivante"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="sk-today-chip"
                onClick={() => setCalendarDate(new Date())}
              >
                Aujourd'hui
              </button>
            </div>

            <span className="sk-adinkra-divider" aria-hidden="true">
              <AdinkraWatermarkSvg size={24} />
            </span>
          </div>

          {/* Droite : Semaine | Mois | Jour | Demandes + Dupliquer la semaine + Publier le planning */}
          <div className="sk-topbar-right">
            <div className="sk-view-Inline" role="tablist" aria-label="Vues du planning">
              <button
                type="button"
                className={`sk-view-link ${planningView === "semaine" ? "active" : ""}`}
                onClick={() => setPlanningView("semaine")}
              >
                Semaine
              </button>
              <button
                type="button"
                className={`sk-view-link ${planningView === "mois" ? "active" : ""}`}
                onClick={() => setPlanningView("mois")}
              >
                Mois
              </button>
              <button
                type="button"
                className={`sk-view-link ${planningView === "jour" ? "active" : ""}`}
                onClick={() => setPlanningView("jour")}
              >
                Jour
              </button>
              <button
                type="button"
                className={`sk-view-link ${planningView === "demandes" ? "active" : ""}`}
                onClick={() => setPlanningView("demandes")}
              >
                Demandes
                {pendingRequestsCount > 0 && (
                  <span className="sk-req-badge">{pendingRequestsCount}</span>
                )}
              </button>
            </div>

            {/* Bouton Mode Clair / Mode Sombre */}
            <button
              type="button"
              className="sk-theme-btn"
              onClick={toggleTheme}
              title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
              aria-label={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              className="sk-btn-secondary"
              onClick={handleDuplicateWeek}
              title="Dupliquer les horaires de cette semaine sur la semaine suivante"
            >
              <Copy size={14} />
              Dupliquer la semaine
            </button>

            <button
              type="button"
              className="sk-btn-publish"
              onClick={handlePublishPlanning}
              disabled={publishing}
            >
              {publishing
                ? "Publication..."
                : pendingChangesCount > 0
                ? `Publier le planning (${pendingChangesCount})`
                : "Publier le planning"}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ ESPACE DE TRAVAIL PRINCIPAL EN-CHECK ═══ */}
      <main className="sk-workspace">
        {/* Raccourcis En-Check : Pointages · Employés · Pauses · Fiches de paie */}
        <nav className="sk-quick-nav" aria-label="Raccourcis En-Check">
          <span className="sk-quick-nav-label">
            <Zap size={13} /> Aller à
          </span>
          {PLANNING_SHORTCUTS.map((raccourci) => {
            const IconRaccourci = raccourci.icon;
            return (
              <button
                key={raccourci.id}
                type="button"
                className="sk-quick-link"
                onClick={() => navigate(raccourci.path)}
                title={raccourci.hint}
                aria-label={raccourci.hint}
              >
                <IconRaccourci size={14} />
                <span>{raccourci.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bandeau : entreprises n'ayant pas souscrit à l'option Planning (aucun horaire inventé) */}
        {employeesWithoutPlanningOption.length > 0 && (
          <div className="sk-no-option-banner" role="status">
            <span>
              <AlertTriangle size={15} color="#F59E0B" />{" "}
              <strong>{employeesWithoutPlanningOption.length}</strong> collaborateur(s)
              appartiennent à une entreprise qui n&apos;a pas souscrit à l&apos;option
              <strong> Planning </strong>: aucune grille horaire n&apos;est affichée pour eux.
            </span>
            <span style={{ fontSize: 12, color: "var(--sk-text-muted)" }}>
              Activez l&apos;option Planning sur la fiche entreprise pour planifier ces
              équipes.
            </span>
          </div>
        )}

        {/* 1. DOCK DRAG & DROP : "▾ Modèles à glisser-déposer (Drag & Drop)" */}
        <section className="sk-dock-panel" aria-label="Modèles à glisser-déposer">
          <div className="sk-dock-header">
            <button
              type="button"
              className="sk-dock-toggle"
              onClick={() => setDockOpen((o) => !o)}
            >
              <span className={`sk-dock-caret ${dockOpen ? "" : "collapsed"}`}>▼</span>
              <span>Modèles à glisser-déposer (Drag &amp; Drop)</span>
            </button>

            <div className="sk-dock-actions">
              <span className="sk-dock-hint">
                Glissez un modèle sur une case jour, sur un collaborateur ou sur le
                calendrier • Maintenez <strong>Alt</strong> pour dupliquer un shift
              </span>
              <button
                type="button"
                className="sk-dock-add-btn"
                onClick={openNewTeamModal}
                title="Créer, renommer une équipe et y affecter des collaborateurs"
              >
                <Users size={13} />
                Gérer les équipes
              </button>
              <button
                type="button"
                className="sk-dock-add-btn"
                onClick={handleAdd}
                title="Créer un modèle d'horaires entreprise (work_schedules)"
              >
                <Briefcase size={13} />
                Horaires entreprise
              </button>
              <button
                type="button"
                className="sk-dock-add-btn"
                onClick={openNewModelModal}
                title="Créer votre propre modèle En-Check (horaire, pause, congé, repos)"
              >
                <Plus size={13} />
                Nouveau modèle
              </button>
            </div>
          </div>

          {dockOpen && (
            <div className="sk-dock-bricks">
              {dockTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`sk-brick ${
                    touchDragPayload?.template?.id === tpl.id ? "is-armed" : ""
                  }`}
                  style={{ "--brick-color": tpl.color || "#B56235" }}
                  draggable
                  onDragStart={(e) => handleDragStartTemplate(e, tpl)}
                  onDragEnd={() => {
                    setDraggedPayload(null);
                    setDropTargetCell(null);
                  }}
                  onTouchStart={() => startTouchDrag(tpl)}
                  onTouchEnd={cancelTouchDrag}
                  onTouchMove={cancelTouchDrag}
                  title={`Glisser "${tpl.label}" vers la grille ou le calendrier (appui long sur mobile)`}
                >
                  <div className="sk-brick-left">
                    <div className="sk-drag-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="sk-brick-title">
                      {tpl.label}
                      <span className="sk-brick-sub">
                        {tpl.kind === "rest"
                          ? "Repos"
                          : tpl.kind === "leave"
                          ? "Congé / Absence"
                          : tpl.kind === "break_only"
                          ? `Pause ${formatTime(tpl.break_start)}-${formatTime(tpl.break_end)}`
                          : `${formatTime(tpl.start_time)} - ${formatTime(tpl.end_time)}`}
                        {tpl.isCustom ? " · Modèle En-Check" : ""}
                        {tpl.kind === "work_schedule" ? " · Horaires entreprise" : ""}
                      </span>
                    </span>
                  </div>

                  <div className="sk-brick-actions">
                    {tpl.isCustom && (
                      <>
                        <button
                          type="button"
                          className="sk-brick-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModelModal(tpl);
                          }}
                          title="Modifier ce modèle (nom, couleur, horaires)"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          type="button"
                          className="sk-brick-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomModel(tpl);
                          }}
                          title="Supprimer ce modèle"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}

                    {tpl.rawSchedule && (
                      <button
                        type="button"
                        className="sk-brick-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(tpl.rawSchedule);
                        }}
                        title="Modifier ce modèle d'horaire"
                      >
                        <Edit size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* BARRE DE FOCUS + LÉGENDE DES COULEURS */}
        <section className="sk-focus-bar" aria-label="Filtre d'affichage et légende">
          <div className="sk-focus-left">
            <span className="sk-focus-label">
              <Users size={13} /> Afficher
            </span>
            <select
              className="sk-ent-select"
              value={
                focusFilter.type === "all"
                  ? "all"
                  : focusFilter.type === "team"
                  ? `team:${focusFilter.value}`
                  : `emp:${focusFilter.value}`
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setFocusFilter({ type: "all", value: null });
                else if (v.startsWith("team:"))
                  setFocusFilter({ type: "team", value: v.slice(5) });
                else setFocusFilter({ type: "employee", value: v.slice(4) });
              }}
              aria-label="Filtrer l'affichage par équipe ou par collaborateur"
            >
              <option value="all">
                Toute l&apos;équipe ({visibleEmployees.length})
              </option>
              <optgroup label="Équipes">
                {employeeGroups.map((g) => (
                  <option key={g.title} value={`team:${g.title}`}>
                    {g.title} ({g.employees.length})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Collaborateurs">
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={`emp:${emp.id}`}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="sk-focus-count">
              {scopedEmployees.length} collaborateur(s) · {focusLabel}
            </span>
          </div>

          <div className="sk-legend">
            <span className="sk-legend-group">
              <span className="sk-legend-title">Disponibilité</span>
              <span className="sk-legend-item">
                <span className="sk-avail-dot" style={{ color: "#10B981", background: "#10B981" }} />{" "}
                Auj. / Sem. / jour = disponible
              </span>
              <span className="sk-legend-item">
                <span className="sk-avail-dot" style={{ color: "#EF4444", background: "#EF4444" }} />{" "}
                indisponible
              </span>
              <span className="sk-legend-item">
                <span className="sk-avail-dot" style={{ color: "#8E7E6F", background: "#8E7E6F" }} />{" "}
                non renseigné
              </span>
            </span>
            <span className="sk-legend-group">
              <span className="sk-legend-title">Types de cartes</span>
              <span className="sk-legend-item">
                <span className="sk-legend-swatch" style={{ background: "#B56235" }} /> Horaire
              </span>
              <span className="sk-legend-item">
                <span className="sk-legend-swatch" style={{ background: "#9A5B25" }} /> Garde
              </span>
              <span className="sk-legend-item">
                <span className="sk-legend-swatch" style={{ background: "#4B3869" }} /> Nuit
              </span>
              <span className="sk-legend-item">
                <span className="sk-legend-swatch" style={{ background: "#0E7490" }} /> Pause
              </span>
              <span className="sk-legend-item">
                <span className="sk-legend-swatch" style={{ background: "#2D5A43" }} /> Congé /
                Repos
              </span>
              <span className="sk-legend-item">
                <span className="sk-legend-swatch is-dashed" /> Réel effectué
              </span>
            </span>
          </div>
        </section>

        {/* 2. VUE SEMAINE (MATRICE EN-CHECK DRAG & DROP) */}
        {planningView === "semaine" && (
          <>
            {/* Grille Matrice Hebdomadaire En-Check */}
            <div className="sk-matrix-card">
              <div className="sk-matrix-scroll">
                <table className="sk-matrix-table">
                  <thead>
                    <tr>
                      <th className="sk-col-emp sk-th-emp">
                        <span style={{ color: "var(--sk-accent-warm)", marginRight: 8 }}>
                          <Users size={13} />
                        </span>
                        Collaborateurs &amp; Équipes
                      </th>
                      {weekDays.map((dayItem, idx) => {
                        const dt = dailyTotals[idx];
                        return (
                          <th
                            key={dayItem.dateStr}
                            className={`sk-th-day ${dayItem.isToday ? "is-today" : ""}`}
                          >
                            <span className="sk-th-day-name">
                              {dayItem.labelHeader}
                              {dayItem.isToday && (
                                <span className="sk-today-pill">Aujourd&apos;hui</span>
                              )}
                            </span>
                            <span className="sk-th-day-sub">
                              {dt ? `${dt.headcount} pers. · ${dt.hoursLabel}` : ""}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: 42,
                            textAlign: "center",
                            color: "var(--sk-text-muted)",
                          }}
                        >
                          Aucun collaborateur actif trouvé pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      employeeGroups
                        .filter((g) => !g.isBannerOnly)
                        .map((group) => {
                          const isCollapsed = Boolean(collapsedGroups[group.title]);
                          const groupEmployees = group.employees.filter(matchesFocus);
                          if (groupEmployees.length === 0 && focusFilter.type !== "all") {
                            return null;
                          }
                          return [
                            <tr
                              key={`grp-${group.title}`}
                              className="sk-group-row"
                              onClick={() =>
                                setCollapsedGroups((prev) => ({
                                  ...prev,
                                  [group.title]: !prev[group.title],
                                }))
                              }
                            >
                              <td colSpan={8}>
                                <div className="sk-group-row-inner">
                                  <span className="sk-group-row-left">
                                    <span
                                      style={{
                                        color: "var(--sk-accent-warm)",
                                        marginRight: 4,
                                      }}
                                    >
                                      {isCollapsed ? "▶" : "▼"}
                                    </span>
                                    <span>{group.title}</span>
                                    <span className="sk-group-count-badge">
                                      {group.employees.length} pers.
                                    </span>
                                  </span>
                                  <span
                                    className="sk-group-row-actions"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="sk-group-row-btn"
                                      onClick={() => openEditTeamModal(group.title)}
                                      title={`Renommer / gérer les membres de ${group.title}`}
                                    >
                                      <Edit size={12} /> Gérer
                                    </button>
                                    <button
                                      type="button"
                                      className="sk-group-row-btn is-danger"
                                      onClick={() => handleDeleteTeam(group.title)}
                                      title={`Supprimer l'équipe ${group.title}`}
                                    >
                                      <Trash2 size={12} /> Supprimer
                                    </button>
                                  </span>
                                </div>
                              </td>
                            </tr>,
                            !isCollapsed &&
                              groupEmployees.map((emp) => {
                                // Calcul du total d'heures planifiées sur la semaine pour ce collaborateur
                                const weeklyMinutes = weekDays.reduce((acc, dayItem) => {
                                  const s = resolveCellShift(emp, dayItem);
                                  return acc + computeShiftNetMinutes(s);
                                }, 0);
                                const weeklyHours = Math.round(weeklyMinutes / 60);
                                const contractHours = 40;
                                const progressPct = Math.min(
                                  100,
                                  Math.round((weeklyHours / contractHours) * 100)
                                );
                                const initials = `${(emp.first_name || "E")[0]}${
                                  (emp.last_name || "C")[0]
                                }`.toUpperCase();

                                const isRowTarget =
                                  dropTargetCell?.empId === emp.id && dropTargetCell?.rowDrop;

                                return (
                                  <tr key={emp.id}>
                                    {/* Colonne Collaborateur (Gauche) */}
                                    <td
                                      className={`sk-td-emp ${isRowTarget ? "is-drop-target" : ""}`}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDropTargetCell({ empId: emp.id, rowDrop: true });
                                      }}
                                      onDragLeave={() => setDropTargetCell(null)}
                                      onDrop={(e) => handleDropOnEmployeeRow(e, emp)}
                                      onClick={() => openCellEditorModal(emp)}
                                      title="Cliquez pour configurer le planning ou glissez un modèle ici pour toute la semaine"
                                      style={{ cursor: "pointer" }}
                                    >
                                      <div className="sk-emp-box">
                                        {emp.photo_url ? (
                                          <img
                                            src={emp.photo_url}
                                            alt={`${emp.first_name} ${emp.last_name}`}
                                            className="sk-emp-avatar"
                                          />
                                        ) : (
                                          <div className="sk-emp-avatar">{initials}</div>
                                        )}

                                        <div className="sk-emp-info">
                                          <div className="sk-emp-name">
                                            {emp.first_name} {emp.last_name}
                                          </div>
                                          <div className="sk-emp-hours-row">
                                            <span>
                                              {weeklyHours}h / {contractHours}h
                                            </span>
                                          </div>
                                          <div className="sk-emp-progress-track">
                                            <div
                                              className="sk-emp-progress-fill"
                                              style={{ width: `${progressPct}%` }}
                                            />
                                          </div>

                                          {/* Disponibilité du collaborateur : aujourd'hui / semaine / jour précis */}
                                          <div className="sk-avail-row">
                                            <button
                                              type="button"
                                              className={`sk-avail-pill ${
                                                getAvailabilityState(emp.id, "today") ===
                                                "available"
                                                  ? "is-on"
                                                  : getAvailabilityState(emp.id, "today") ===
                                                    "unavailable"
                                                  ? "is-off"
                                                  : ""
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                cycleAvailability(emp.id, "today");
                                              }}
                                              title="Disponible aujourd'hui (clic : oui / non / non renseigné)"
                                            >
                                              <span className="sk-avail-dot" />
                                              Auj.
                                            </button>
                                            <button
                                              type="button"
                                              className={`sk-avail-pill ${
                                                getAvailabilityState(emp.id, "week") ===
                                                "available"
                                                  ? "is-on"
                                                  : getAvailabilityState(emp.id, "week") ===
                                                    "unavailable"
                                                  ? "is-off"
                                                  : ""
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                cycleAvailability(emp.id, "week");
                                              }}
                                              title="Disponible cette semaine (clic : oui / non / non renseigné)"
                                            >
                                              <span className="sk-avail-dot" />
                                              Sem.
                                            </button>
                                            <button
                                              type="button"
                                              className="sk-avail-pill is-daypicker"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openAvailabilityModal(emp);
                                              }}
                                              title="Choisir la disponibilité jour par jour (Lun, Mar, Mer...)"
                                            >
                                              <CalendarDays size={10} />
                                              Jours
                                            </button>
                                          </div>

                                          {/* Récapitulatif visuel des jours marqués */}
                                          <div className="sk-avail-days">
                                            {joursSemaine.map((j) => {
                                              const st = getAvailabilityState(
                                                emp.id,
                                                `day-${j.id}`
                                              );
                                              return (
                                                <span
                                                  key={j.id}
                                                  className={`sk-avail-day ${
                                                    st === "available"
                                                      ? "is-on"
                                                      : st === "unavailable"
                                                      ? "is-off"
                                                      : ""
                                                  }`}
                                                  title={`${j.nom} : ${
                                                    st === "available"
                                                      ? "disponible"
                                                      : st === "unavailable"
                                                      ? "indisponible"
                                                      : "non renseigné"
                                                  }`}
                                                >
                                                  {j.court.charAt(0)}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 7 Colonnes Jours (Lun -> Dim) */}
                                    {weekDays.map((dayItem) => {
                                      const shift = resolveCellShift(emp, dayItem);
                                      const realAtt = getRealAttendance(emp.id, dayItem.dateStr);
                                      const isDropOver =
                                        dropTargetCell?.empId === emp.id &&
                                        dropTargetCell?.dateStr === dayItem.dateStr;
                                      const netMins = computeShiftNetMinutes(shift);
                                      const netLabel = netMins
                                        ? formatHoursCompact(netMins)
                                        : null;
                                      const breakLabel = computeBreakLabel(shift);
                                      //  Pauses supprimées (corbeille) sur CE jour pour CET employé
                                      const supprimeesDuJour =
                                        pausesSupprimees[`${emp.id}|${dayItem.dateStr}`] || [];

                                      return (
                                        <td
                                          key={dayItem.dateStr}
                                          className={`sk-td-cell ${
                                            isDropOver ? "is-drop-over" : ""
                                          } ${touchDragPayload ? "is-touch-armed" : ""}`}
                                          onDragOver={(e) => handleDragOverCell(e, emp, dayItem)}
                                          onDragLeave={() => setDropTargetCell(null)}
                                          onDrop={(e) => handleDropOnCell(e, emp, dayItem)}
                                          onClickCapture={(e) => {
                                            if (touchDragPayload) {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              applyTouchDropOnCell(emp, dayItem);
                                            }
                                          }}
                                        >
                                          {/* Infobulle flottante En-Check lors du survol en Drag & Drop */}
                                          {isDropOver && (
                                            <div className="sk-drag-tooltip">
                                              Glisser pour déplacer ou
                                              <br />
                                              Maintenir Alt pour dupliquer
                                            </div>
                                          )}

                                          <div className={isDropOver ? "sk-drop-outline" : ""}>
                                            {shift ? (
                                              <div
                                                className={`sk-shift-card variant-${
                                                  shift.variant || "standard"
                                                }`}
                                                style={{
                                                  "--shift-custom-bg": buildShiftGradient(
                                                    shift.color
                                                  ),
                                                }}
                                                draggable={!shift.isHoliday && !shift.isAbsence}
                                                onDragStart={(e) =>
                                                  handleDragStartCellShift(e, emp, dayItem, shift)
                                                }
                                                onDragEnd={() => {
                                                  setDraggedPayload(null);
                                                  setDropTargetCell(null);
                                                }}
                                                onClick={() =>
                                                  openCellEditorModal(emp, dayItem, shift)
                                                }
                                              >
                                                <div className="sk-shift-top">
                                                  <div className="sk-shift-dots" aria-hidden="true">
                                                    <span />
                                                    <span />
                                                    <span />
                                                    <span />
                                                  </div>
                                                  {!shift.isHoliday && !shift.isAbsence && (
                                                    <>
                                                      <button
                                                        type="button"
                                                        className="sk-shift-color-mini"
                                                        style={{
                                                          background:
                                                            shift.color || "#B56235",
                                                        }}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openCellEditorModal(
                                                            emp,
                                                            dayItem,
                                                            shift
                                                          );
                                                        }}
                                                        title="Personnaliser la couleur de cette case"
                                                      />
                                                      <button
                                                        type="button"
                                                        className="sk-shift-del-btn"
                                                        onClick={(e) =>
                                                          handleClearCellShift(e, emp, dayItem)
                                                        }
                                                        title="Passer ce jour en repos"
                                                      >
                                                        <X size={11} />
                                                      </button>
                                                    </>
                                                  )}
                                                </div>

                                                {/* Nom du modèle déposé / appliqué */}
                                                <div className="sk-shift-name">
                                                  {shift.name ||
                                                    (shift.isHoliday
                                                      ? "Jour férié"
                                                      : shift.isAbsence
                                                      ? "Congé"
                                                      : shift.isPauseOnly
                                                      ? "Pause"
                                                      : shift.isRest
                                                      ? "Repos"
                                                      : "Créneau")}
                                                </div>
                                                <div className="sk-shift-time">
                                                  {shift.isHoliday || shift.isAbsence
                                                    ? `${shift.start_time} · ${shift.end_time}`
                                                    : shift.isRest || shift.isLeave
                                                    ? shift.subtitle || "Repos"
                                                    : `${shift.start_time} - ${shift.end_time}`}
                                                  {isDropOver && netLabel ? ` • ${netLabel}` : ""}
                                                </div>

                                                <div className="sk-shift-meta">
                                                  {breakLabel ? (
                                                    <span
                                                      className={`sk-shift-break${
                                                        supprimeesDuJour.length > 0
                                                          ? " is-supprimee"
                                                          : ""
                                                      }`}
                                                      title={
                                                        supprimeesDuJour.length > 0
                                                          ? "Une pause a été supprimée sur cette journée — elle reste archivée et remetable"
                                                          : undefined
                                                      }
                                                    >
                                                      <Coffee size={11} />
                                                      {breakLabel}
                                                    </span>
                                                  ) : (
                                                    <span
                                                      className={
                                                        supprimeesDuJour.length > 0
                                                          ? "is-supprimee"
                                                          : undefined
                                                      }
                                                    >
                                                      {shift.isHoliday
                                                        ? "🎌 Officiel"
                                                        : shift.isAbsence
                                                        ? "🌴 Validé"
                                                        : "Continu"}
                                                    </span>
                                                  )}
                                                  {netLabel && !isDropOver && (
                                                    <span style={{ fontWeight: 700 }}>
                                                      {netLabel}
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Une pause supprimée ne disparaît pas en silence */}
                                                {supprimeesDuJour.length > 0 && (
                                                  <div
                                                    className="sk-shift-pause-supprimee"
                                                    title={supprimeesDuJour
                                                      .map((l) =>
                                                        [
                                                          l.debut ? heureLocale(l.debut) : "--:--",
                                                          l.fin ? heureLocale(l.fin) : "en cours",
                                                          l.source === "presumee"
                                                            ? "présumée"
                                                            : "réelle",
                                                        ].join(" · "),
                                                      )
                                                      .join(" | ")}
                                                  >
                                                    🗑️ Pause supprimée
                                                    {supprimeesDuJour.length > 1
                                                      ? ` (${supprimeesDuJour.length})`
                                                      : ""}
                                                    {supprimeesDuJour[0]?.debut
                                                      ? ` · ${heureLocale(
                                                          supprimeesDuJour[0].debut,
                                                        )}→${
                                                          supprimeesDuJour[0]?.fin
                                                            ? heureLocale(supprimeesDuJour[0].fin)
                                                            : "en cours"
                                                        }`
                                                      : ""}
                                                  </div>
                                                )}

                                                {/* Horaires réellement effectués (pointages) */}
                                                {realAtt && realAtt.firstIn && (
                                                  <div className="sk-shift-real">
                                                    <span>
                                                      Réel {formatRealLabel(realAtt)}
                                                      {realIsOpen(realAtt) && (
                                                        <span
                                                          className="sk-open-dot"
                                                          aria-hidden="true"
                                                        />
                                                      )}
                                                    </span>
                                                    <span
                                                      className={`sk-real-diff ${
                                                        !netMins
                                                          ? ""
                                                          : realAtt.minutes < netMins
                                                          ? "is-neg"
                                                          : realAtt.minutes > netMins
                                                          ? "is-pos"
                                                          : ""
                                                      }`}
                                                    >
                                                      {realAtt.lastOut
                                                        ? formatHoursCompact(realAtt.minutes)
                                                        : "en cours"}
                                                      {netMins && realAtt.lastOut
                                                        ? ` · ${
                                                            realAtt.minutes === netMins
                                                              ? "à l'heure"
                                                              : `${
                                                                  realAtt.minutes > netMins
                                                                    ? "+"
                                                                    : "-"
                                                                }${formatHoursCompact(
                                                                  Math.abs(
                                                                    realAtt.minutes - netMins
                                                                  )
                                                                )}`
                                                          }`
                                                        : " · non planifié"}
                                                      {realAtt.autoClosed ? " · auto" : ""}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <div
                                                className="sk-empty-cell"
                                                onClick={() => openCellEditorModal(emp, dayItem)}
                                                title="Cliquer pour ajouter un shift ou déposer un modèle ici"
                                              >
                                                {isDropOver ? (
                                                  "Déposer ici"
                                                ) : realAtt && realAtt.firstIn ? (
                                                  <span className="sk-empty-real">
                                                    Pointé {formatRealLabel(realAtt)}
                                                    <br />
                                                    <strong>
                                                      {formatHoursCompact(realAtt.minutes)} non
                                                      planifié
                                                    </strong>
                                                  </span>
                                                ) : (
                                                  "+ Shift"
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              }),
                          ];
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Barre Récapitulative Fixe en Bas (Pied de Grille En-Check) */}
            <footer className="sk-bottom-bar">
              <div className="sk-bottom-slots">
                <div className="sk-bottom-slot">
                  <span>
                    Effectif: <strong>{totalActiveEmployees}</strong>
                  </span>
                </div>
                {dailyTotals.map((dt) => (
                  <div key={dt.dateStr} className="sk-bottom-slot">
                    <span>
                      {draggedPayload
                        ? `Déposer ici · ${dt.labelHeader}`
                        : `${dt.labelHeader} : ${dt.headcount} pers. (${dt.hoursLabel})`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="sk-bottom-right">
                <span>
                  Effectif: {totalActiveEmployees} pers. &nbsp;|&nbsp; {totalDayHoursLabel}
                </span>
                <span className="sk-adinkra-divider" aria-hidden="true">
                  <AdinkraWatermarkSvg size={22} />
                </span>
              </div>
            </footer>
          </>
        )}

        {/* 3. VUE JOUR (TIMELINE HORAIRE : PRÉVU / RÉEL SANS CHEVAUCHEMENT) */}
        {planningView === "jour" && (
          <div className="sk-matrix-card sk-day-view">
            <div className="sk-day-head">
              <div>
                <h2 className="sk-day-title">
                  Planning du jour —{" "}
                  {calendarDate.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {toIsoDateLocal(calendarDate) === toIsoDateLocal(new Date()) && (
                    <span className="sk-today-pill">Aujourd&apos;hui</span>
                  )}
                </h2>
                <p className="sk-day-sub">
                  Ligne <strong>Prévu</strong> : le créneau planifié (glissez un modèle depuis
                  le Dock pour l&apos;affecter). Ligne <strong>Réel</strong> : les entrées et
                  sorties réellement pointées, calculées comme dans la page{" "}
                  <strong>Pointages</strong>.
                </p>
              </div>
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setPlanningView("semaine")}
              >
                Retour à la grille Semaine
              </button>
            </div>

            {/* Règle horaire unique (alignée sur les deux pistes) */}
            <div className="sk-day-ruler">
              <span className="sk-day-ruler-spacer" />
              <div className="sk-day-ruler-hours">
                {Array.from({ length: 25 }, (_, i) => i).map((h) => (
                  <span
                    key={h}
                    className={`sk-day-ruler-hour ${h % 3 === 0 ? "is-major" : ""}`}
                    style={{ left: `${(h / 24) * 100}%` }}
                  >
                    {h % 3 === 0 ? `${String(h).padStart(2, "0")}h` : ""}
                  </span>
                ))}
              </div>
            </div>

            <div className="sk-day-rows">
              {scopedEmployees.length === 0 ? (
                <div className="sk-day-empty">
                  Aucun collaborateur visible (dépliez une équipe ou changez le filtre
                  d&apos;affichage).
                </div>
              ) : (
                scopedEmployees.map((emp) => {
                  const dateStr = toIsoDateLocal(calendarDate);
                  const dayNum = getPlanningDay(
                    calendarDate.getFullYear(),
                    calendarDate.getMonth(),
                    calendarDate.getDate()
                  );
                  const dayItem = { dateStr, dayNum, labelHeader: dateStr };
                  const shift = resolveCellShift(emp, dayItem);
                  const real = getRealAttendance(emp.id, dateStr);
                  const isDropOver = dayDropEmpId === emp.id;

                  const pct = (hhmm) => {
                    if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return null;
                    const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
                    if (Number.isNaN(h)) return null;
                    return ((h * 60 + (m || 0)) / (24 * 60)) * 100;
                  };

                  const startPct = pct(shift?.start_time);
                  const endPct = pct(shift?.end_time);
                  const rawWidthPct =
                    startPct !== null && endPct !== null
                      ? endPct >= startPct
                        ? endPct - startPct
                        : 100 - startPct + endPct
                      : 0;
                  // Un bloc ne doit jamais depasser le bord droit de la piste :
                  // sinon le nom du modele est coupe (bug remonte sur mobile).
                  const widthPct = Math.min(rawWidthPct, 100 - (startPct || 0));
                  const leftPct = Math.max(0, Math.min(startPct || 0, 100 - widthPct));

                  const realStartPct = real ? pct(heureLocale(real.firstIn)) : null;
                  const realEndPct =
                    real && real.lastOut ? pct(heureLocale(real.lastOut)) : null;
                  const rawRealWidth =
                    realStartPct !== null && realEndPct !== null
                      ? realEndPct >= realStartPct
                        ? realEndPct - realStartPct
                        : 100 - realStartPct + realEndPct
                      : 1.5;
                  const realWidthPct = Math.min(
                    rawRealWidth,
                    100 - (realStartPct || 0)
                  );
                  const realLeftPct = Math.max(
                    0,
                    Math.min(realStartPct || 0, 100 - realWidthPct)
                  );

                  const netM = computeShiftNetMinutes(shift);
                  const diff = real ? real.minutes - netM : null;

                  return (
                    <div
                      key={emp.id}
                      className={`sk-day-row ${isDropOver ? "is-drop-over" : ""} ${
                        touchDragPayload ? "is-touch-armed" : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dayDropEmpId !== emp.id) setDayDropEmpId(emp.id);
                      }}
                      onDragLeave={() => setDayDropEmpId(null)}
                      onDrop={(e) => handleDropOnCell(e, emp, dayItem)}
                      onClickCapture={(e) => {
                        if (touchDragPayload) {
                          e.stopPropagation();
                          e.preventDefault();
                          applyTouchDropOnCell(emp, dayItem);
                        }
                      }}
                    >
                      <div className="sk-day-emp">
                        <div className="sk-emp-avatar" style={{ width: 34, height: 34 }}>
                          {(emp.first_name || "E")[0]}
                          {(emp.last_name || "C")[0]}
                        </div>
                        <div className="sk-day-emp-meta">
                          <strong>
                            {emp.first_name} {emp.last_name}
                          </strong>
                          <span>{emp.matricule || emp.position || "—"}</span>
                        </div>
                      </div>

                      <div className="sk-day-lanes">
                        {/* PISTE 1 — PRÉVU */}
                        <div className="sk-day-lane-row">
                          <span className="sk-day-lane-label">Prévu</span>
                          <div className="sk-day-track">
                            {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
                              <span
                                key={h}
                                className="sk-day-grid-line"
                                style={{ left: `${(h / 24) * 100}%` }}
                              />
                            ))}

                            {shift && startPct !== null ? (
                              <div
                                className="sk-day-block"
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${Math.max(2.5, widthPct)}%`,
                                  background: buildShiftGradient(shift.color),
                                }}
                                draggable={!shift.isHoliday && !shift.isAbsence}
                                onDragStart={(e) =>
                                  handleDragStartCellShift(e, emp, dayItem, shift)
                                }
                                onClick={() => openCellEditorModal(emp, dayItem, shift)}
                                title={`Prévu ${shift.start_time} - ${shift.end_time}${
                                  netM ? ` · ${formatHoursCompact(netM)}` : ""
                                }`}
                              >
                                <span className="sk-day-block-label">
                                  <strong>{shift.name || "Créneau"}</strong>
                                  {shift.isRest || shift.isLeave
                                    ? ` · ${shift.subtitle || "Repos"}`
                                    : ` · ${shift.start_time} - ${shift.end_time}`}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="sk-day-add"
                                onClick={() => openCellEditorModal(emp, dayItem)}
                              >
                                {isDropOver
                                  ? "Déposer ici"
                                  : "+ Ajouter (ou déposer un modèle)"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* PISTE 2 — RÉEL (entrées / sorties comme dans Pointages) */}
                        <div className="sk-day-lane-row">
                          <span className="sk-day-lane-label is-real">Réel</span>
                          <div className="sk-day-track is-real">
                            {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
                              <span
                                key={h}
                                className="sk-day-grid-line"
                                style={{ left: `${(h / 24) * 100}%` }}
                              />
                            ))}

                            {real && realStartPct !== null ? (
                              <div
                                className={`sk-day-real-block ${
                                  realIsOpen(real) ? "is-open" : ""
                                }`}
                                style={{
                                  left: `${realLeftPct}%`,
                                  width: `${Math.max(1.5, realWidthPct)}%`,
                                }}
                                title={
                                  real.lastOut
                                    ? `Réel : ${formatRealLabel(real)} · ${formatHoursCompact(
                                        real.minutes
                                      )}`
                                    : `Entrée pointée à ${heureLocale(
                                        real.firstIn
                                      )} — sortie pas encore pointée (journée en cours)`
                                }
                              >
                                <span className="sk-day-real-label">
                                  {formatRealLabel(real)}
                                  {realIsOpen(real) && (
                                    <span className="sk-open-dot" aria-hidden="true" />
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="sk-day-none">Aucun pointage ce jour</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="sk-day-actions">
                        <div className="sk-day-actions-hours">
                          <span>
                            {netM > 0 ? formatHoursCompact(netM) : "—"}
                            <em>prévu</em>
                          </span>
                          <span className="is-real">
                            {real
                              ? real.lastOut
                                ? formatHoursCompact(real.minutes)
                                : "en cours"
                              : "—"}
                            <em>réel</em>
                          </span>
                          {diff !== null && netM > 0 && real?.lastOut && (
                            <span
                              className={`sk-day-ecart ${
                                diff === 0 ? "" : diff > 0 ? "is-pos" : "is-neg"
                              }`}
                            >
                              {diff === 0
                                ? "à l'heure"
                                : `${diff > 0 ? "+" : "-"}${formatHoursCompact(Math.abs(diff))}`}
                            </span>
                          )}
                          {real?.autoClosed && <span className="sk-day-auto">auto</span>}
                        </div>
                        {shift && !shift.isHoliday && !shift.isAbsence && (
                          <button
                            type="button"
                            className="sk-shift-del-btn"
                            onClick={(e) => handleClearCellShift(e, emp, dayItem)}
                            title="Retirer ce créneau"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="sk-brick-edit"
                          onClick={() => openCellEditorModal(emp, dayItem, shift)}
                          title="Modifier / couleur"
                        >
                          <Edit size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 4. VUE MOIS (CALENDRIER MENSUEL + JOURS FÉRIÉS) */}
        {planningView === "mois" && (
          <div className="sk-matrix-card" style={{ padding: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {joursSemaine.map((j) => (
                <div
                  key={j.id}
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--sk-text-soft)",
                    padding: 6,
                  }}
                >
                  {j.nom}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {calendarWeeks.flat().map((cell) => {
                if (cell.type === "empty") {
                  return (
                    <div
                      key={cell.id}
                      style={{
                        minHeight: 112,
                        background: "transparent",
                        borderRadius: 10,
                      }}
                    />
                  );
                }
                const isSelected = selectedCalendarDay?.date === cell.date;
                const dayModels = monthModels[cell.date] || [];
                const isMonthDropOver = monthDropDate === cell.date;
                const todayIso = toIsoDateLocal(new Date());
                const isToday = cell.date === todayIso;
                const cellDayNum = dayNumFromDateStr(cell.date);

                // Shifts et pointages réels des collaborateurs du focus sur cette journée
                const cellRows = scopedEmployees
                  .map((emp) => ({
                    emp,
                    shift: resolveCellShift(emp, {
                      dateStr: cell.date,
                      dayNum: cellDayNum,
                      labelHeader: `${emp.first_name} ${cell.day}`,
                    }),
                    real: getRealAttendance(emp.id, cell.date),
                  }))
                  .filter((r) => r.shift || r.real);
                const cellMinutes = cellRows.reduce(
                  (acc, r) => acc + computeShiftNetMinutes(r.shift),
                  0
                );

                return (
                  <div
                    key={cell.id}
                    className={`sk-cal-cell ${isMonthDropOver ? "is-drop-over" : ""} ${
                      isToday ? "is-today" : ""
                    } ${isSelected ? "is-selected" : ""} ${
                      touchDragPayload ? "is-touch-armed" : ""
                    }`}
                    style={
                      cell.isHoliday
                        ? { background: "rgba(139, 92, 246, 0.14)" }
                        : undefined
                    }
                    onClick={() => {
                      if (applyTouchDropOnDay(cell.date)) return;
                      setSelectedCalendarDay(cell);
                      setCalendarDate(new Date(cell.date + "T12:00:00"));
                    }}
                    onDoubleClick={() => setPlanningView("jour")}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (monthDropDate !== cell.date) setMonthDropDate(cell.date);
                    }}
                    onDragLeave={() => setMonthDropDate(null)}
                    onDrop={(e) => handleDropOnCalendarDay(e, cell.date)}
                    title={
                      focusFilter.type === "employee"
                        ? "Déposez un modèle : il sera affecté au collaborateur sélectionné"
                        : "Déposez un modèle sur la journée (double-clic pour la vue Jour)"
                    }
                  >
                    <div className="sk-cal-cell-head">
                      <span className={isToday ? "sk-cal-day is-today-num" : "sk-cal-day"}>
                        {cell.day}
                      </span>
                      <span className="sk-cal-cell-head-right">
                        {cell.isHoliday && <span title={cell.holiday?.name}>🎌</span>}
                        {isToday && <span className="sk-today-pill">Aujourd&apos;hui</span>}
                      </span>
                    </div>

                    {cell.isHoliday ? (
                      <div className="sk-cal-holiday">{cell.holiday?.name}</div>
                    ) : (
                      <div className="sk-cal-summary">
                        {cellRows.length > 0
                          ? `${cellRows.length} pers. · ${formatHoursCompact(cellMinutes)}`
                          : `${cell.schPlannings.length} modèle(s) • ${cell.actES.length} perso`}
                      </div>
                    )}

                    {/* Shifts par collaborateur (focus équipe ou collaborateur) */}
                    <div className="sk-cal-pills-list">
                      {cellRows.slice(0, 4).map(({ emp, shift, real }) => {
                        const netM = computeShiftNetMinutes(shift);
                        return (
                          <span
                            key={emp.id}
                            className="sk-cal-pill"
                            style={{ "--cal-pill-bg": buildShiftGradient(shift?.color) }}
                            title={`${emp.first_name} ${emp.last_name} — ${
                              shift
                                ? `${shift.start_time} - ${shift.end_time}`
                                : "non planifié"
                            }`}
                            draggable={Boolean(shift) && !shift.isHoliday && !shift.isAbsence}
                            onDragStart={(e) =>
                              handleDragStartCellShift(
                                e,
                                emp,
                                {
                                  dateStr: cell.date,
                                  dayNum: cellDayNum,
                                  labelHeader: `${emp.first_name} ${cell.day}`,
                                },
                                shift
                              )
                            }
                          >
                            <span className="sk-cal-pill-name">
                              {emp.first_name?.charAt(0) || ""}
                              {emp.last_name?.charAt(0) || ""}
                            </span>
                            <span className="sk-cal-pill-model">
                              {shift?.name ||
                                (shift?.isRest
                                  ? "Repos"
                                  : shift?.isAbsence
                                  ? "Congé"
                                  : "—")}
                            </span>
                            <span>
                              {shift
                                ? shift.isRest || shift.isLeave
                                  ? shift.subtitle || "Repos"
                                  : shift.isAbsence
                                  ? shift.start_time
                                  : `${shift.start_time}-${shift.end_time}`
                                : ""}
                            </span>
                            {netM > 0 && <span className="sk-cal-pill-net">{formatHoursCompact(netM)}</span>}
                            {real && real.firstIn && (
                              <span
                                className={`sk-cal-pill-real ${
                                  realIsOpen(real) ? "is-open" : ""
                                }`}
                                title={
                                  real.lastOut
                                    ? `Pointé ${formatRealLabel(real)}`
                                    : `Entrée ${heureLocale(
                                        real.firstIn
                                      )} — sortie pas encore pointée`
                                }
                              >
                                ▸ {real.lastOut ? formatRealLabel(real) : `${heureLocale(real.firstIn)} · en cours`}
                              </span>
                            )}
                            {shift && !shift.isHoliday && !shift.isAbsence && (
                              <button
                                type="button"
                                className="sk-shift-del-btn"
                                style={{ width: 16, height: 16 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearShiftForDate(emp, cell.date, cellDayNum);
                                  toast.success(
                                    `Créneau retiré (${emp.first_name} · ${cell.date})`
                                  );
                                }}
                                title={`Retirer le créneau de ${emp.first_name} le ${cell.date}`}
                              >
                                <X size={10} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                      {cellRows.length > 4 && (
                        <span className="sk-cal-more">+{cellRows.length - 4} autres</span>
                      )}
                    </div>

                    {/* Modèles déposés au niveau de la journée */}
                    <div className="sk-cal-pills-list">
                      {dayModels.map((m, mIdx) => (
                        <span
                          key={`${m.id}-${mIdx}`}
                          className="sk-cal-pill is-daymodel"
                          style={{ "--cal-pill-bg": buildShiftGradient(m.color) }}
                          title={m.label || m.name}
                        >
                          <span>{m.label || m.name}</span>
                          <button
                            type="button"
                            className="sk-shift-del-btn"
                            style={{ width: 16, height: 16 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMonthModel(cell.date, mIdx);
                            }}
                            title="Retirer ce modèle de la journée"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. VUE DEMANDES DES COLLABORATEURS (schedule_change_requests) */}
        {planningView === "demandes" && (
          <div className="sk-requests-view">
            <div className="sk-matrix-card" style={{ padding: 20 }}>
              <div className="sk-requests-head">
                <div>
                  <h2 className="sk-modal-title" style={{ fontSize: 18 }}>
                    Demandes de changement de planning
                  </h2>
                  <p className="sk-day-sub">
                    Validez ou refusez les demandes d&apos;aménagement horaire soumises par
                    les employés. Une demande approuvée met automatiquement à jour le planning
                    du collaborateur.
                  </p>
                </div>
                <button
                  type="button"
                  className="sk-btn-secondary"
                  onClick={() => setPlanningView("semaine")}
                >
                  Retour à la grille En-Check
                </button>
              </div>

              {/* Compteurs / filtres */}
              <div className="sk-requests-filters">
                {[
                  { id: "all", label: "Toutes", count: filteredRequests.length },
                  {
                    id: "pending",
                    label: "En attente",
                    count: filteredRequests.filter((r) => r.status === "pending").length,
                  },
                  {
                    id: "approved",
                    label: "Approuvées",
                    count: filteredRequests.filter((r) => r.status === "approved").length,
                  },
                  {
                    id: "rejected",
                    label: "Refusées",
                    count: filteredRequests.filter((r) => r.status === "rejected").length,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`sk-request-filter ${
                      requestFilter === f.id ? "active" : ""
                    } is-${f.id}`}
                    onClick={() => setRequestFilter(f.id)}
                  >
                    {f.label}
                    <span className="sk-request-filter-count">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {visibleRequests.length === 0 ? (
              <div className="sk-matrix-card sk-requests-empty">
                <CalendarDays size={26} color="#C25E28" />
                <p>
                  {requestFilter === "pending"
                    ? "Aucune demande en attente."
                    : "Aucune demande pour ce filtre."}
                </p>
              </div>
            ) : (
              <div className="sk-requests-list">
                {visibleRequests.map((req) => {
                  const emp = req.employees || {};
                  const fullName =
                    `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Collaborateur";
                  const initials = `${emp.first_name?.[0] || ""}${
                    emp.last_name?.[0] || ""
                  }`.toUpperCase();
                  const statut = req.status || "pending";
                  const currentLabel = req.use_custom_hours
                    ? `${formatTime(req.requested_start_time)} - ${formatTime(
                        req.requested_end_time
                      )}`
                    : req.requested_schedule?.name || "Planning entreprise";
                  const prevLabel = req.current_schedule?.name
                    ? `${req.current_schedule.name} (${formatTime(
                        req.current_schedule.start_time
                      )} - ${formatTime(req.current_schedule.end_time)})`
                    : "Aucun planning défini";
                  const joursDemandes =
                    req.use_custom_hours && req.requested_work_days
                      ? formatWorkDays(req.requested_work_days)
                      : req.requested_schedule?.work_days
                      ? formatWorkDays(req.requested_schedule.work_days)
                      : null;
                  const ageDays = req.created_at
                    ? Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400000)
                    : null;

                  return (
                    <article key={req.id} className={`sk-request-card is-${statut}`}>
                      <div className="sk-request-card-head">
                        <div className="sk-request-emp">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt="" className="sk-emp-avatar" />
                          ) : (
                            <div className="sk-emp-avatar">{initials || "EC"}</div>
                          )}
                          <div className="sk-request-emp-meta">
                            <strong>{fullName}</strong>
                            <span>
                              {emp.matricule ? `#${emp.matricule}` : "—"} ·{" "}
                              {emp.department || emp.position || "Sans équipe"}
                            </span>
                          </div>
                        </div>
                        <div className="sk-request-card-head-right">
                          <span className={`sk-request-status is-${statut}`}>
                            {statut === "pending"
                              ? "⏳ En attente"
                              : statut === "approved"
                              ? "✓ Approuvée"
                              : "✕ Refusée"}
                          </span>
                          {ageDays !== null && (
                            <span className="sk-request-age">
                              {ageDays === 0
                                ? "déposée aujourd'hui"
                                : `déposée il y a ${ageDays} j`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Comparatif visuel : planning actuel -> planning demandé */}
                      <div className="sk-request-compare">
                        <div className="sk-request-compare-col is-from">
                          <span className="sk-request-compare-label">Planning actuel</span>
                          <strong>{prevLabel}</strong>
                        </div>
                        <span className="sk-request-compare-arrow">→</span>
                        <div className="sk-request-compare-col is-to">
                          <span className="sk-request-compare-label">Planning demandé</span>
                          <strong>
                            {currentLabel}
                            {req.use_custom_hours ? " (horaires sur-mesure)" : ""}
                          </strong>
                          {joursDemandes && (
                            <span className="sk-request-compare-days">{joursDemandes}</span>
                          )}
                        </div>
                      </div>

                      {req.reason && (
                        <div className="sk-request-reason">
                          <MessageSquare size={13} /> Motif de l&apos;employé : « {req.reason} »
                        </div>
                      )}

                      {req.admin_comment && (
                        <div className="sk-request-comment">
                          <Shield size={13} /> Réponse de l&apos;admin : « {req.admin_comment} »
                          {req.reviewed_at
                            ? ` — ${new Date(req.reviewed_at).toLocaleDateString("fr-FR")}`
                            : ""}
                        </div>
                      )}

                      <div className="sk-request-actions">
                        {statut === "pending" ? (
                          <>
                            <button
                              type="button"
                              className="sk-btn-publish"
                              style={{ padding: "8px 15px", fontSize: 12.5 }}
                              onClick={() => openReviewRequestModal(req, "approved")}
                            >
                              <CheckCircle2 size={14} /> Approuver
                            </button>
                            <button
                              type="button"
                              className="sk-btn-secondary"
                              style={{ padding: "8px 15px", fontSize: 12.5, color: "#EF4444" }}
                              onClick={() => openReviewRequestModal(req, "rejected")}
                            >
                              <Ban size={14} /> Refuser
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="sk-btn-secondary"
                            style={{ padding: "8px 15px", fontSize: 12.5 }}
                            onClick={() => openReviewRequestModal(req, "pending")}
                          >
                            <Clock size={14} /> Remettre en attente
                          </button>
                        )}
                        <button
                          type="button"
                          className="sk-btn-secondary"
                          style={{ padding: "8px 12px" }}
                          onClick={() => confirmDeleteRequest(req)}
                          title="Supprimer la demande"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Barre flottante du mode tactile (mobile) : modèle prêt à déposer */}
        {touchDragPayload && (
          <div className="sk-touch-bar" role="status">
            <span className="sk-touch-bar-text">
              ✋ <strong>{touchDragPayload.template?.name || "Modèle"}</strong> sélectionné —
              touchez une case du planning pour l&apos;y déposer
            </span>
            <button
              type="button"
              className="sk-btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={clearTouchDrag}
            >
              Annuler
            </button>
          </div>
        )}
      </main>

      {/* ═══ MODAL CRÉATION / ÉDITION DE MODÈLE (work_schedules) ═══ */}
      {showModal && (
        <div className="sk-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  {editingPlanning ? "Modifier le modèle" : "Nouveau modèle glissable"}
                </h2>
                <span className="sk-modal-sub">
                  Modèle d&apos;horaires entreprise (work_schedules)
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              {admin?.role === "super_admin" && (
                <div>
                  <label className="sk-field-label">
                    <Building2 size={13} /> Entreprise *
                  </label>
                  <select
                    className="sk-select"
                    value={formData.enterprise_id}
                    onChange={(e) =>
                      setFormData({ ...formData, enterprise_id: e.target.value })
                    }
                  >
                    <option value="">-- Sélectionner --</option>
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="sk-field-label">Nom du modèle *</label>
                <input
                  className="sk-input"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Matin Officine, Garde Soir..."
                />
              </div>

              <div className="sk-row-2">
                <div>
                  <label className="sk-field-label">
                    <Clock size={13} /> Arrivée
                  </label>
                  <input
                    className="sk-input"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="sk-field-label">
                    <Clock size={13} /> Départ
                  </label>
                  <input
                    className="sk-input"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="sk-field-label" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.has_break}
                    onChange={(e) =>
                      setFormData({ ...formData, has_break: e.target.checked })
                    }
                  />
                  <Coffee size={14} color="#F59E0B" />
                  <span>Inclure une pause déjeuner</span>
                </label>
              </div>

              {formData.has_break && (
                <div className="sk-row-2">
                  <div>
                    <label className="sk-field-label">Début pause</label>
                    <input
                      className="sk-input"
                      type="time"
                      value={formData.break_start}
                      onChange={(e) =>
                        setFormData({ ...formData, break_start: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="sk-field-label">Fin pause</label>
                    <input
                      className="sk-input"
                      type="time"
                      value={formData.break_end}
                      onChange={(e) =>
                        setFormData({ ...formData, break_end: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="sk-field-label">
                  <Calendar size={13} /> Jours de travail
                </label>
                <div className="sk-days-pills">
                  {joursSemaine.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      className={`sk-day-pill ${
                        formData.work_days.includes(j.id) ? "active" : ""
                      }`}
                      onClick={() => toggleJour(j.id)}
                    >
                      {j.court}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sk-row-2">
                <div>
                  <label className="sk-field-label">
                    <AlertCircle size={13} /> Tolérance retard (min)
                  </label>
                  <input
                    className="sk-input"
                    type="number"
                    min="0"
                    max="120"
                    value={formData.late_tolerance_minutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        late_tolerance_minutes: e.target.value,
                      })
                    }
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 10 }}>
                  <label className="sk-field-label" style={{ cursor: "pointer", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) =>
                        setFormData({ ...formData, is_default: e.target.checked })
                      }
                    />
                    <Zap size={14} color="#F59E0B" />
                    <span>Planning par défaut</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="sk-modal-foot">
              {editingPlanning && (
                <button
                  type="button"
                  className="sk-btn-secondary"
                  style={{ color: "#EF4444", marginRight: "auto" }}
                  onClick={() => {
                    setShowModal(false);
                    confirmDelete(editingPlanning);
                  }}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button type="button" className="sk-btn-publish" onClick={handleSave}>
                <Save size={14} /> {editingPlanning ? "Enregistrer" : "Créer le modèle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ÉDITION CRÉNEAU / PLANNING COLLABORATEUR (employee_schedules) ═══ */}
      {showEmployeeScheduleModal && (
        <div
          className="sk-modal-backdrop"
          onClick={() => setShowEmployeeScheduleModal(false)}
        >
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  {editingEmployeeSchedule
                    ? "Ajuster le planning du collaborateur"
                    : "Attribuer un planning"}
                </h2>
                <span className="sk-modal-sub">
                  Configuration individuelle En-Check
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setShowEmployeeScheduleModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              <div>
                <label className="sk-field-label">
                  <Users size={13} /> Collaborateur *
                </label>
                <select
                  className="sk-select"
                  value={employeeScheduleForm.employee_id}
                  onChange={(e) =>
                    setEmployeeScheduleForm({
                      ...employeeScheduleForm,
                      employee_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Sélectionner --</option>
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.matricule})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="sk-field-label" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={employeeScheduleForm.use_custom_hours}
                    onChange={(e) =>
                      setEmployeeScheduleForm({
                        ...employeeScheduleForm,
                        use_custom_hours: e.target.checked,
                      })
                    }
                  />
                  <Shield size={14} color="#F59E0B" />
                  <span>Horaires sur-mesure (personnalisés)</span>
                </label>
              </div>

              {!employeeScheduleForm.use_custom_hours ? (
                <div>
                  <label className="sk-field-label">
                    <Briefcase size={13} /> Modèle de planning *
                  </label>
                  <select
                    className="sk-select"
                    value={employeeScheduleForm.schedule_id}
                    onChange={(e) =>
                      setEmployeeScheduleForm({
                        ...employeeScheduleForm,
                        schedule_id: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Sélectionner --</option>
                    {filteredPlannings.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} • {formatTime(p.start_time)}-{formatTime(p.end_time)} (
                        {formatDuration(p)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="sk-row-2">
                    <div>
                      <label className="sk-field-label">Arrivée</label>
                      <input
                        className="sk-input"
                        type="time"
                        value={employeeScheduleForm.custom_start_time}
                        onChange={(e) =>
                          setEmployeeScheduleForm({
                            ...employeeScheduleForm,
                            custom_start_time: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="sk-field-label">Départ</label>
                      <input
                        className="sk-input"
                        type="time"
                        value={employeeScheduleForm.custom_end_time}
                        onChange={(e) =>
                          setEmployeeScheduleForm({
                            ...employeeScheduleForm,
                            custom_end_time: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="sk-field-label" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={employeeScheduleForm.custom_has_break}
                        onChange={(e) =>
                          setEmployeeScheduleForm({
                            ...employeeScheduleForm,
                            custom_has_break: e.target.checked,
                          })
                        }
                      />
                      <Coffee size={14} color="#F59E0B" />
                      <span>Inclure une pause</span>
                    </label>
                  </div>

                  {employeeScheduleForm.custom_has_break && (
                    <div className="sk-row-2">
                      <div>
                        <label className="sk-field-label">Début pause</label>
                        <input
                          className="sk-input"
                          type="time"
                          value={employeeScheduleForm.custom_break_start}
                          onChange={(e) =>
                            setEmployeeScheduleForm({
                              ...employeeScheduleForm,
                              custom_break_start: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="sk-field-label">Fin pause</label>
                        <input
                          className="sk-input"
                          type="time"
                          value={employeeScheduleForm.custom_break_end}
                          onChange={(e) =>
                            setEmployeeScheduleForm({
                              ...employeeScheduleForm,
                              custom_break_end: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="sk-field-label">Jours travaillés</label>
                    <div className="sk-days-pills">
                      {joursSemaine.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          className={`sk-day-pill ${
                            employeeScheduleForm.custom_work_days.includes(j.id)
                              ? "active"
                              : ""
                          }`}
                          onClick={() => toggleCustomJour(j.id)}
                        >
                          {j.court}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Personnalisation de la couleur de la case / du créneau */}
              <div>
                <label className="sk-field-label">
                  <Palette size={13} /> Couleur de la case
                </label>
                <div className="sk-color-swatches">
                  {ENCHECK_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`sk-color-swatch ${
                        employeeScheduleForm.custom_color === c.value ? "active" : ""
                      }`}
                      style={{ background: c.value }}
                      title={c.label}
                      onClick={() =>
                        setEmployeeScheduleForm({
                          ...employeeScheduleForm,
                          custom_color: c.value,
                        })
                      }
                    />
                  ))}
                  <input
                    type="color"
                    className="sk-color-input"
                    value={employeeScheduleForm.custom_color || "#B56235"}
                    onChange={(e) =>
                      setEmployeeScheduleForm({
                        ...employeeScheduleForm,
                        custom_color: e.target.value,
                      })
                    }
                    title="Couleur libre"
                  />
                </div>
              </div>
            </div>

            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setShowEmployeeScheduleModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                onClick={handleSaveEmployeeSchedule}
              >
                <Save size={14} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CRÉATION / ÉDITION D'UN MODÈLE PERSONNALISÉ EN-CHECK ═══ */}
      {showModelModal && (
        <div className="sk-modal-backdrop" onClick={() => setShowModelModal(false)}>
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  {editingCustomModel ? "Modifier le modèle" : "Nouveau modèle En-Check"}
                </h2>
                <span className="sk-modal-sub">
                  Horaire, pause, congé ou repos — 100 % personnalisable
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setShowModelModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              <div>
                <label className="sk-field-label">Nom du modèle *</label>
                <input
                  className="sk-input"
                  type="text"
                  value={modelForm.name}
                  onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                  placeholder="Ex : Pause déjeuner, Congé payé, Garde nuit..."
                />
              </div>

              <div>
                <label className="sk-field-label">
                  <Layers size={13} /> Type de modèle *
                </label>
                <select
                  className="sk-select"
                  value={modelForm.kind}
                  onChange={(e) => setModelForm({ ...modelForm, kind: e.target.value })}
                >
                  {MODEL_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              {modelForm.kind === "shift" && (
                <div className="sk-row-2">
                  <div>
                    <label className="sk-field-label">
                      <Clock size={13} /> Début
                    </label>
                    <input
                      className="sk-input"
                      type="time"
                      value={modelForm.start_time}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, start_time: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="sk-field-label">
                      <Clock size={13} /> Fin
                    </label>
                    <input
                      className="sk-input"
                      type="time"
                      value={modelForm.end_time}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, end_time: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {modelForm.kind === "break_only" && (
                <div className="sk-row-2">
                  <div>
                    <label className="sk-field-label">
                      <Coffee size={13} /> Début de la pause
                    </label>
                    <input
                      className="sk-input"
                      type="time"
                      value={modelForm.break_start}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, break_start: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="sk-field-label">
                      <Coffee size={13} /> Fin de la pause
                    </label>
                    <input
                      className="sk-input"
                      type="time"
                      value={modelForm.break_end}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, break_end: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {modelForm.kind === "shift" && (
                <div>
                  <label className="sk-field-label" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={modelForm.has_break}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, has_break: e.target.checked })
                      }
                    />
                    <Coffee size={14} color="#F59E0B" />
                    <span>Inclure une pause</span>
                  </label>
                </div>
              )}

              {modelForm.kind === "shift" && modelForm.has_break && (
                <div className="sk-row-2">
                  <div>
                    <label className="sk-field-label">Début pause</label>
                    <input
                      className="sk-input"
                      type="time"
                      value={modelForm.break_start}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, break_start: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="sk-field-label">Fin pause</label>
                    <input
                      className="sk-input"
                      type="time"
                      value={modelForm.break_end}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, break_end: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="sk-field-label">
                  <Palette size={13} /> Couleur du modèle et des cases
                </label>
                <div className="sk-color-swatches">
                  {ENCHECK_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`sk-color-swatch ${
                        modelForm.color === c.value ? "active" : ""
                      }`}
                      style={{ background: c.value }}
                      title={c.label}
                      onClick={() => setModelForm({ ...modelForm, color: c.value })}
                    />
                  ))}
                  <input
                    type="color"
                    className="sk-color-input"
                    value={modelForm.color}
                    onChange={(e) => setModelForm({ ...modelForm, color: e.target.value })}
                    title="Couleur libre"
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: buildShiftGradient(modelForm.color),
                  color: "#FFF7ED",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Aperçu : {modelForm.name || "Mon modèle"}
                {modelForm.kind === "shift"
                  ? ` — ${formatTime(modelForm.start_time)} - ${formatTime(
                      modelForm.end_time
                    )}`
                  : modelForm.kind === "break_only"
                  ? ` — ${formatTime(modelForm.break_start)} - ${formatTime(
                      modelForm.break_end
                    )}`
                  : modelForm.kind === "leave"
                  ? " — Congé / Absence"
                  : " — Repos"}
              </div>
            </div>

            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setShowModelModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                onClick={handleSaveCustomModel}
              >
                <Save size={14} /> {editingCustomModel ? "Enregistrer" : "Créer le modèle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL DISPONIBILITÉ D'UN COLLABORATEUR (jour par jour) ═══ */}
      {showAvailabilityModal && availabilityTarget && (
        <div
          className="sk-modal-backdrop"
          onClick={() => setShowAvailabilityModal(false)}
        >
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  Disponibilité — {availabilityTarget.first_name}{" "}
                  {availabilityTarget.last_name}
                </h2>
                <span className="sk-modal-sub">
                  Marquez jour par jour (Lun, Mar, Mer...) si le collaborateur est
                  disponible
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setShowAvailabilityModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              <div className="sk-avail-legend">
                <span className="sk-avail-legend-item">
                  <span className="sk-avail-legend-dot is-on" /> Disponible
                </span>
                <span className="sk-avail-legend-item">
                  <span className="sk-avail-legend-dot is-off" /> Indisponible
                </span>
                <span className="sk-avail-legend-item">
                  <span className="sk-avail-legend-dot" /> Non renseigné
                </span>
              </div>

              {joursSemaine.map((j) => {
                const scope = `day-${j.id}`;
                const st = getAvailabilityState(availabilityTarget.id, scope);
                return (
                  <div key={j.id} className="sk-avail-day-row">
                    <span className="sk-avail-day-label">{j.nom}</span>
                    <div className="sk-avail-day-actions">
                      <button
                        type="button"
                        className={`sk-avail-choice is-yes ${st === "available" ? "active" : ""}`}
                        onClick={() =>
                          setAvailabilityValue(availabilityTarget.id, scope, "available")
                        }
                      >
                        Disponible
                      </button>
                      <button
                        type="button"
                        className={`sk-avail-choice is-no ${st === "unavailable" ? "active" : ""}`}
                        onClick={() =>
                          setAvailabilityValue(availabilityTarget.id, scope, "unavailable")
                        }
                      >
                        Indisponible
                      </button>
                      <button
                        type="button"
                        className={`sk-avail-choice ${!st ? "active" : ""}`}
                        onClick={() =>
                          setAvailabilityValue(availabilityTarget.id, scope, null)
                        }
                      >
                        Non renseigné
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="sk-avail-day-row">
                <span className="sk-avail-day-label">Aujourd&apos;hui</span>
                <div className="sk-avail-day-actions">
                  <button
                    type="button"
                    className={`sk-avail-choice is-yes ${
                      getAvailabilityState(availabilityTarget.id, "today") === "available"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setAvailabilityValue(availabilityTarget.id, "today", "available")
                    }
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    className={`sk-avail-choice is-no ${
                      getAvailabilityState(availabilityTarget.id, "today") === "unavailable"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setAvailabilityValue(availabilityTarget.id, "today", "unavailable")
                    }
                  >
                    Indisponible
                  </button>
                </div>
              </div>

              <div className="sk-avail-day-row">
                <span className="sk-avail-day-label">Cette semaine</span>
                <div className="sk-avail-day-actions">
                  <button
                    type="button"
                    className={`sk-avail-choice is-yes ${
                      getAvailabilityState(availabilityTarget.id, "week") === "available"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setAvailabilityValue(availabilityTarget.id, "week", "available")
                    }
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    className={`sk-avail-choice is-no ${
                      getAvailabilityState(availabilityTarget.id, "week") === "unavailable"
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setAvailabilityValue(availabilityTarget.id, "week", "unavailable")
                    }
                  >
                    Indisponible
                  </button>
                </div>
              </div>
            </div>

            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => {
                  setAvailability((prev) => ({
                    ...prev,
                    [availabilityTarget.id]: {},
                  }));
                  toast.success("Disponibilités réinitialisées");
                }}
              >
                Réinitialiser
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                onClick={() => setShowAvailabilityModal(false)}
              >
                <CheckCircle2 size={14} /> Terminé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CRÉATION / ÉDITION D'UNE ÉQUIPE ═══ */}
      {showTeamModal && (
        <div className="sk-modal-backdrop" onClick={() => setShowTeamModal(false)}>
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  {editingTeam ? `Équipe ${editingTeam.name}` : "Nouvelle équipe"}
                </h2>
                <span className="sk-modal-sub">
                  Nommez votre équipe et affectez ses membres
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setShowTeamModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              <div>
                <label className="sk-field-label">
                  <Users size={13} /> Nom de l&apos;équipe *
                </label>
                <input
                  className="sk-input"
                  type="text"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="Ex : GARDE & LOGISTIQUE, ÉQUIPE OFFICINE & VENTE..."
                />
              </div>

              <div>
                <label className="sk-field-label">
                  Membres de l&apos;équipe ({teamForm.memberIds.length} sélectionné(s))
                </label>
                <div className="sk-team-member-list">
                  {filteredEmployees.map((emp) => {
                    const checked = teamForm.memberIds.includes(emp.id);
                    return (
                      <label key={emp.id} className="sk-team-member-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setTeamForm({
                              ...teamForm,
                              memberIds: checked
                                ? teamForm.memberIds.filter((id) => id !== emp.id)
                                : [...teamForm.memberIds, emp.id],
                            })
                          }
                        />
                        <span>
                          {emp.first_name} {emp.last_name}
                          {emp.matricule ? ` · ${emp.matricule}` : ""}
                        </span>
                      </label>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <span style={{ fontSize: 12.5, color: "var(--sk-text-muted)" }}>
                      Aucun collaborateur disponible pour ce filtre.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setShowTeamModal(false)}
              >
                Annuler
              </button>
              <button type="button" className="sk-btn-publish" onClick={handleSaveTeam}>
                <Save size={14} /> Enregistrer l&apos;équipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL VALIDATION / REFUS DEMANDE EMPLOYÉ ═══ */}
      {showReviewRequestModal && selectedRequest && (
        <div
          className="sk-modal-backdrop"
          onClick={() => !reviewingRequest && setShowReviewRequestModal(false)}
        >
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  {reviewAction === "approved"
                    ? "Approuver la demande"
                    : reviewAction === "rejected"
                    ? "Refuser la demande"
                    : "Remettre la demande en attente"}
                </h2>
                <span className="sk-modal-sub">
                  {selectedRequest.employees?.first_name}{" "}
                  {selectedRequest.employees?.last_name}
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setShowReviewRequestModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              <div>
                <label className="sk-field-label">
                  <MessageSquare size={13} /> Commentaire administrateur (optionnel)
                </label>
                <textarea
                  className="sk-input"
                  style={{ minHeight: 90, resize: "vertical" }}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Commentaire de validation ou motif de refus..."
                />
              </div>
            </div>

            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setShowReviewRequestModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                onClick={handleReviewRequest}
                disabled={reviewingRequest}
              >
                <Send size={14} />
                {reviewingRequest
                  ? "Traitement..."
                  : reviewAction === "approved"
                  ? "Approuver"
                  : reviewAction === "rejected"
                  ? "Refuser"
                  : "Remettre en attente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL SUPPRESSION MODÈLE ═══ */}
      {showDeleteModal && planningToDelete && (
        <div className="sk-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div
            className="sk-modal-box"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sk-modal-head">
              <h2 className="sk-modal-title">Supprimer ce modèle ?</h2>
            </div>
            <div className="sk-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--sk-text-soft)" }}>
                Voulez-vous vraiment supprimer <strong>"{planningToDelete.name}"</strong> ?
              </p>
            </div>
            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setPlanningToDelete(null);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                style={{ background: "#EF4444", color: "#fff" }}
                onClick={handleDelete}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL SUPPRESSION DEMANDE ═══ */}
      {showDeleteRequestModal && requestToDelete && (
        <div
          className="sk-modal-backdrop"
          onClick={() => setShowDeleteRequestModal(false)}
        >
          <div
            className="sk-modal-box"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sk-modal-head">
              <h2 className="sk-modal-title">Supprimer cette demande ?</h2>
            </div>
            <div className="sk-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--sk-text-soft)" }}>
                La demande de{" "}
                <strong>
                  {requestToDelete.employees?.first_name}{" "}
                  {requestToDelete.employees?.last_name}
                </strong>{" "}
                sera définitivement supprimée.
              </p>
            </div>
            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => {
                  setShowDeleteRequestModal(false);
                  setRequestToDelete(null);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                style={{ background: "#EF4444", color: "#fff" }}
                onClick={handleDeleteRequest}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
