// ═══════════════════════════════════════════════════════════════════════════
// 📅 EN-CHECK · PLANNING — SYSTÈME DRAG & DROP × IDENTITÉ AFRO-TECH
// Matrice hebdomadaire glisser-déposer + Modèles personnalisables + Équipes
// + Disponibilités + Vues Semaine/Mois/Jour + Demandes
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import HolidayService from "../services/holidayService";
import {
  KenteWovenTapestrySvg,
  AdinkraWatermarkSvg,
  WovenKenteBadgeSvg,
} from "../components/AfroCulturalSvg";
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
} from "lucide-react";
import toast from "react-hot-toast";
import "./PlanningAfroTech.css";

const OVERRIDES_STORAGE_KEY = "encheck_planning_day_overrides_v1";
const CUSTOM_MODELS_STORAGE_KEY = "encheck_planning_custom_models_v1";
const AVAILABILITY_STORAGE_KEY = "encheck_planning_availability_v1";
const TEAMS_STORAGE_KEY = "encheck_planning_teams_v1";
const TEAM_ASSIGNMENTS_STORAGE_KEY = "encheck_planning_team_assignments_v1";
const MONTH_MODELS_STORAGE_KEY = "encheck_planning_month_models_v1";

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
  const [loading, setLoading] = useState(true);

  // Vues En-Check : "semaine" (défaut) | "mois" | "jour" | "demandes"
  const [planningView, setPlanningView] = useState("semaine");
  const [dockOpen, setDockOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});
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

  // ═══ DISPONIBILITÉS COLLABORATEURS (aujourd'hui / cette semaine) ═══
  const [availability, setAvailability] = useState(() =>
    readStorage(AVAILABILITY_STORAGE_KEY, {})
  );

  // ═══ MODÈLES DÉPOSÉS SUR LE CALENDRIER MENSUEL (date -> [modèles]) ═══
  const [monthModels, setMonthModels] = useState(() =>
    readStorage(MONTH_MODELS_STORAGE_KEY, {})
  );
  const [monthDropDate, setMonthDropDate] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planningToDelete, setPlanningToDelete] = useState(null);

  const [showEmployeeScheduleModal, setShowEmployeeScheduleModal] = useState(false);
  const [editingEmployeeSchedule, setEditingEmployeeSchedule] = useState(null);
  // Contexte de la case en cours d'édition (permet de personnaliser la couleur de la case)
  const [cellEditContext, setCellEditContext] = useState(null);

  const [holidaysByEnterprise, setHolidaysByEnterprise] = useState({});
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

  const getHolidaySet = (id) => holidaysByEnterprise[id] || new Set();
  const getHolidayMap = (id) => holidayMapsByEnterprise[id] || new Map();

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

  // ═══ DÉPÔT D'UN MODÈLE SUR UNE CASE DU CALENDRIER MENSUEL ═══
  const handleDropOnCalendarDay = (e, dateStr) => {
    e.preventDefault();
    setMonthDropDate(null);
    const payload = draggedPayload;
    setDraggedPayload(null);
    if (!payload) return;

    const tpl =
      payload.sourceType === "dock"
        ? payload.template
        : payload.shift
        ? {
            name: payload.shift.name || "Créneau",
            label: `${payload.shift.start_time} - ${payload.shift.end_time}`,
            color: payload.shift.color,
          }
        : null;

    if (!tpl) return;

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
  };

  // ═══ DISPONIBILITÉS COLLABORATEURS (Aujourd'hui / Cette semaine) ═══
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
      if (override.isRest) return null;
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
      if (tpl.kind === "rest") {
        setDayOverrides((prev) => ({
          ...prev,
          [targetEmp.id]: {
            ...(prev[targetEmp.id] || {}),
            [targetDay.dateStr]: { isRest: true },
          },
        }));
        setPendingChangesCount((c) => c + 1);
        await persistEmployeeShiftToSupabase(targetEmp, null, targetDay.dayNum, true);
        toast.success(`Jour de repos appliqué pour ${targetEmp.first_name} (${targetDay.labelHeader})`);
        return;
      }

      if (tpl.kind === "leave") {
        setDayOverrides((prev) => ({
          ...prev,
          [targetEmp.id]: {
            ...(prev[targetEmp.id] || {}),
            [targetDay.dateStr]: {
              isLeave: true,
              start_time: "Congé",
              end_time: tpl.name || "Absence",
              has_break: false,
              variant: "conge",
              color: tpl.color,
              label: tpl.name,
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
        if (!currentShift || currentShift.isHoliday || currentShift.isAbsence) {
          toast.error(
            `Déposez d'abord un horaire sur ${targetDay.labelHeader} avant d'y ajouter une pause`
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
        // Si ce n'est pas une duplication (Alt), vider la case source
        if (!duplicateMode) {
          next[payload.fromEmpId] = {
            ...(next[payload.fromEmpId] || {}),
            [payload.fromDateStr]: { isRest: true },
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
        weekMap[d.dateStr] = { isRest: true };
      } else if (tpl.kind === "leave") {
        weekMap[d.dateStr] = {
          isLeave: true,
          start_time: "Congé",
          end_time: tpl.name || "Absence",
          has_break: false,
          variant: "conge",
          color: tpl.color,
          label: tpl.name,
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

  const handleClearCellShift = async (e, emp, dayItem) => {
    e.stopPropagation();
    setDayOverrides((prev) => ({
      ...prev,
      [emp.id]: {
        ...(prev[emp.id] || {}),
        [dayItem.dateStr]: { isRest: true },
      },
    }));
    setPendingChangesCount((c) => c + 1);
    await persistEmployeeShiftToSupabase(emp, null, dayItem.dayNum, true);
    toast.success(`Shift retiré (${emp.first_name} · ${dayItem.labelHeader})`);
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

  // ═══ TOTAUX JOURNALIERS POUR LE PIED DE PAGE EN-CHECK ═══
  const dailyTotals = useMemo(() => {
    return weekDays.map((dayItem) => {
      let headcount = 0;
      let totalMinutes = 0;
      filteredEmployees.forEach((emp) => {
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
  }, [weekDays, filteredEmployees, dayOverrides, employeeSchedules, plannings, absences, holidayMapsByEnterprise]);

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

  if (loading) {
    return (
      <div
        className="sk-plan-page"
        data-theme={darkMode ? "dark" : "light"}
        style={{ alignItems: "center", justifyContent: "center", gap: 16 }}
      >
        <WovenKenteBadgeSvg size={48} />
        <p style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sk-text-soft)" }}>
          Chargement du planning En-Check...
        </p>
      </div>
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
                  className="sk-brick"
                  style={{ "--brick-color": tpl.color || "#B56235" }}
                  draggable
                  onDragStart={(e) => handleDragStartTemplate(e, tpl)}
                  onDragEnd={() => {
                    setDraggedPayload(null);
                    setDropTargetCell(null);
                  }}
                  title={`Glisser "${tpl.label}" vers la grille ou le calendrier`}
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
                            {dayItem.labelHeader}
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
                              group.employees.map((emp) => {
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

                                          {/* Disponibilité du collaborateur : aujourd'hui / cette semaine */}
                                          <div className="sk-avail-row">
                                            <button
                                              type="button"
                                              className={`sk-avail-pill ${
                                                availability[emp.id]?.today === "available"
                                                  ? "is-on"
                                                  : availability[emp.id]?.today === "unavailable"
                                                  ? "is-off"
                                                  : ""
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEmployeeAvailability(
                                                  emp.id,
                                                  "today",
                                                  availability[emp.id]?.today === "available"
                                                    ? "unavailable"
                                                    : "available"
                                                );
                                              }}
                                              title="Marquer la disponibilité d'aujourd'hui"
                                            >
                                              <span className="sk-avail-dot" />
                                              Auj.
                                            </button>
                                            <button
                                              type="button"
                                              className={`sk-avail-pill ${
                                                availability[emp.id]?.week === "available"
                                                  ? "is-on"
                                                  : availability[emp.id]?.week === "unavailable"
                                                  ? "is-off"
                                                  : ""
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEmployeeAvailability(
                                                  emp.id,
                                                  "week",
                                                  availability[emp.id]?.week === "available"
                                                    ? "unavailable"
                                                    : "available"
                                                );
                                              }}
                                              title="Marquer la disponibilité de la semaine"
                                            >
                                              <span className="sk-avail-dot" />
                                              Sem.
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 7 Colonnes Jours (Lun -> Dim) */}
                                    {weekDays.map((dayItem) => {
                                      const shift = resolveCellShift(emp, dayItem);
                                      const isDropOver =
                                        dropTargetCell?.empId === emp.id &&
                                        dropTargetCell?.dateStr === dayItem.dateStr;
                                      const netMins = computeShiftNetMinutes(shift);
                                      const netLabel = netMins
                                        ? formatHoursCompact(netMins)
                                        : null;
                                      const breakLabel = computeBreakLabel(shift);

                                      return (
                                        <td
                                          key={dayItem.dateStr}
                                          className={`sk-td-cell ${isDropOver ? "is-drop-over" : ""}`}
                                          onDragOver={(e) => handleDragOverCell(e, emp, dayItem)}
                                          onDragLeave={() => setDropTargetCell(null)}
                                          onDrop={(e) => handleDropOnCell(e, emp, dayItem)}
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

                                                <div className="sk-shift-time">
                                                  {shift.isHoliday || shift.isAbsence
                                                    ? `${shift.start_time} · ${shift.end_time}`
                                                    : `${shift.start_time} - ${shift.end_time}`}
                                                  {isDropOver && netLabel ? ` • ${netLabel}` : ""}
                                                </div>

                                                <div className="sk-shift-meta">
                                                  {breakLabel ? (
                                                    <span className="sk-shift-break">
                                                      <Coffee size={11} />
                                                      {breakLabel}
                                                    </span>
                                                  ) : (
                                                    <span>
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
                                              </div>
                                            ) : (
                                              <div
                                                className="sk-empty-cell"
                                                onClick={() => openCellEditorModal(emp, dayItem)}
                                                title="Cliquer pour ajouter un shift ou déposer un modèle ici"
                                              >
                                                {isDropOver ? "Déposer ici" : "+ Shift"}
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

        {/* 3. VUE JOUR (TIMELINE JOURNALIÈRE EN-CHECK) */}
        {planningView === "jour" && (
          <div className="sk-matrix-card" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17 }}>
                Planning du jour —{" "}
                {calendarDate.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => setPlanningView("semaine")}
              >
                Retour à la grille Semaine
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {filteredEmployees.map((emp) => {
                const dayNum = getPlanningDay(
                  calendarDate.getFullYear(),
                  calendarDate.getMonth(),
                  calendarDate.getDate()
                );
                const dateStr = toIsoDateLocal(calendarDate);
                const shift = resolveCellShift(emp, {
                  dateStr,
                  dayNum,
                  labelHeader: dateStr,
                });
                return (
                  <div
                    key={emp.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--sk-bg-panel)",
                      border: "1px solid var(--sk-border-soft)",
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="sk-emp-avatar" style={{ width: 38, height: 38 }}>
                        {(emp.first_name || "E")[0]}
                        {(emp.last_name || "C")[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--sk-text-muted)" }}>
                          {emp.matricule} • {emp.department || "Équipe Officine & Garde"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {shift ? (
                        <span
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: "var(--sk-terracotta)",
                            color: "#FFF7ED",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {shift.start_time} – {shift.end_time}
                          {shift.has_break ? " • ☕ 1h" : ""}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--sk-text-muted)" }}>
                          Repos
                        </span>
                      )}
                      <button
                        type="button"
                        className="sk-btn-secondary"
                        onClick={() =>
                          openCellEditorModal(
                            emp,
                            { dateStr, dayNum, labelHeader: dateStr },
                            shift
                          )
                        }
                      >
                        <Edit size={13} /> Modifier
                      </button>
                    </div>
                  </div>
                );
              })}
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
                return (
                  <div
                    key={cell.id}
                    className={`sk-cal-cell ${isMonthDropOver ? "is-drop-over" : ""}`}
                    style={
                      cell.isHoliday
                        ? { background: "rgba(139, 92, 246, 0.14)" }
                        : undefined
                    }
                    onClick={() => {
                      setSelectedCalendarDay(cell);
                      setCalendarDate(new Date(cell.date + "T12:00:00"));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (monthDropDate !== cell.date) setMonthDropDate(cell.date);
                    }}
                    onDragLeave={() => setMonthDropDate(null)}
                    onDrop={(e) => handleDropOnCalendarDay(e, cell.date)}
                    title="Déposez un modèle ici pour l'afficher sur cette journée"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      <span>{cell.day}</span>
                      {cell.isHoliday && <span title={cell.holiday?.name}>🎌</span>}
                    </div>

                    <div style={{ fontSize: 11, color: "var(--sk-text-muted)" }}>
                      {cell.isHoliday ? (
                        cell.holiday?.name
                      ) : (
                        <>
                          {cell.schPlannings.length} modèle(s) • {cell.actES.length} perso
                        </>
                      )}
                    </div>

                    {/* Modèles déposés sur cette journée */}
                    <div className="sk-cal-pills-list">
                      {dayModels.map((m, mIdx) => (
                        <span
                          key={`${m.id}-${mIdx}`}
                          className="sk-cal-pill"
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
          <div className="sk-matrix-card" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 17 }}>
                  Demandes de changement de planning ({filteredRequests.length})
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sk-text-muted)" }}>
                  Validez ou refusez les demandes d'aménagement horaire soumises par les employés.
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

            {filteredRequests.length === 0 ? (
              <div
                style={{
                  padding: 36,
                  textAlign: "center",
                  color: "var(--sk-text-muted)",
                }}
              >
                Aucune demande de modification de planning.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: "var(--sk-bg-panel)",
                      border: "1px solid var(--sk-border-soft)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {req.employees?.first_name} {req.employees?.last_name}{" "}
                        <span style={{ color: "var(--sk-text-muted)", fontWeight: 500 }}>
                          ({req.employees?.matricule})
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--sk-text-soft)", marginTop: 4 }}>
                        {req.use_custom_hours
                          ? `Horaire personnalisé demandé : ${formatTime(
                              req.requested_start_time
                            )} - ${formatTime(req.requested_end_time)} (${formatWorkDays(
                              req.requested_work_days
                            )})`
                          : `Modèle demandé : ${
                              req.requested_schedule?.name || "Planning entreprise"
                            }`}
                      </div>
                      {req.reason && (
                        <div style={{ fontSize: 12, color: "var(--sk-text-muted)", marginTop: 4 }}>
                          Motif : « {req.reason} »
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {req.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            className="sk-btn-publish"
                            style={{ padding: "7px 14px", fontSize: 12.5 }}
                            onClick={() => openReviewRequestModal(req, "approved")}
                          >
                            <CheckCircle2 size={14} /> Approuver
                          </button>
                          <button
                            type="button"
                            className="sk-btn-secondary"
                            style={{ padding: "7px 14px", fontSize: 12.5, color: "#EF4444" }}
                            onClick={() => openReviewRequestModal(req, "rejected")}
                          >
                            <Ban size={14} /> Refuser
                          </button>
                        </>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: req.status === "approved" ? "#10B981" : "#EF4444",
                          }}
                        >
                          {req.status === "approved" ? "✓ Approuvée" : "✕ Refusée"}
                        </span>
                      )}
                      <button
                        type="button"
                        className="sk-btn-secondary"
                        style={{ padding: "7px 10px" }}
                        onClick={() => confirmDeleteRequest(req)}
                        title="Supprimer la demande"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    : "Refuser la demande"}
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
                  : "Refuser"}
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
