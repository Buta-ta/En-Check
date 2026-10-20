// ═══════════════════════════════════════════════════════════════════════════
// 📅 EN-CHECK · PLANNING — SYSTÈME SKELLO DRAG & DROP × IDENTITÉ AFRO-TECH
// Matrice hebdomadaire glisser-déposer + Dock de modèles + Vues Semaine/Mois/Jour + Demandes
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
} from "lucide-react";
import toast from "react-hot-toast";
import "./PlanningAfroTech.css";

const OVERRIDES_STORAGE_KEY = "encheck_skello_day_overrides_v1";

// Briques par défaut du Dock Skello (fidèles à la maquette validée)
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
  },
];

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
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [plannings, setPlannings] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [entreprises, setEntreprises] = useState([]);
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vues Skello : "semaine" (défaut) | "mois" | "jour" | "modeles" | "demandes"
  const [skelloView, setSkelloView] = useState("semaine");
  const [dockOpen, setDockOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedEntreprise, setSelectedEntreprise] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // État Drag & Drop Skello
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planningToDelete, setPlanningToDelete] = useState(null);

  const [showEmployeeScheduleModal, setShowEmployeeScheduleModal] = useState(false);
  const [editingEmployeeSchedule, setEditingEmployeeSchedule] = useState(null);

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
    try {
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(dayOverrides));
    } catch {
      // ignore quota error
    }
  }, [dayOverrides]);

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
          "id, enterprise_id, first_name, last_name, matricule, department, position, photo_url, is_active, enterprises(name)"
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

      // Chargement des absences validées sur la période pour affichage sur la grille Skello
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

  // ═══ JOURS DE LA SEMAINE SKELLO (Lun -> Dim) ═══
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

  // Libellé de période style Skello : "Lun 19 – Dim 25 Oct. 2026"
  const periodLabel = useMemo(() => {
    if (skelloView === "mois") {
      return calendarDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
    }
    if (skelloView === "jour") {
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
  }, [weekDays, calendarDate, skelloView]);

  const navigatePeriod = (direction) => {
    const next = new Date(calendarDate);
    if (skelloView === "mois") {
      next.setMonth(next.getMonth() + direction);
    } else if (skelloView === "jour") {
      next.setDate(next.getDate() + direction);
    } else {
      next.setDate(next.getDate() + direction * 7);
    }
    setCalendarDate(next);
  };

  // ═══ MODÈLES GLISSABLES DU DOCK SKELLO ═══
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
        rawSchedule: p,
      };
    });
    return [...DEFAULT_DOCK_TEMPLATES, ...customScheduleBricks];
  }, [filteredPlannings]);

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

    // Par défaut (Lun-Ven 08:00-17:00) pour que la grille Skello soit toujours exploitable
    if (dayNum <= 5) {
      return {
        start_time: "08:00",
        end_time: "17:00",
        has_break: true,
        break_start: "12:00",
        break_end: "13:00",
        variant: "standard",
        source: "fallback",
      };
    }

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

  // ═══ GESTIONNAIRES DRAG & DROP SKELLO ═══
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

      if (tpl.kind === "break_only") {
        const currentShift = resolveCellShift(targetEmp, targetDay) || {
          start_time: "08:00",
          end_time: "17:00",
          variant: "standard",
        };
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
            if (s && !s.isHoliday && !s.isAbsence && !s.isRest) {
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

  // ═══ GROUPEMENT DES EMPLOYÉS PAR ÉQUIPE / DÉPARTEMENT FAÇON SKELLO ═══
  const employeeGroups = useMemo(() => {
    const groupsMap = new Map();
    filteredEmployees.forEach((emp, idx) => {
      const rawDept = (emp.department || "").trim();
      let groupTitle = "GARDE & LOGISTIQUE";
      if (rawDept) {
        groupTitle = rawDept.toUpperCase();
      } else if (idx % 2 === 0) {
        groupTitle = "GARDE & LOGISTIQUE";
      } else {
        groupTitle = "ÉQUIPE OFFICINE & VENTE";
      }
      if (!groupsMap.has(groupTitle)) {
        groupsMap.set(groupTitle, []);
      }
      groupsMap.get(groupTitle).push(emp);
    });

    // S'assurer que l'en-tête "ÉQUIPE OFFICINE & VENTE" est toujours visible comme sur la maquette
    if (!groupsMap.has("ÉQUIPE OFFICINE & VENTE") && filteredEmployees.length > 0) {
      return [
        { title: "ÉQUIPE OFFICINE & VENTE", employees: [], isBannerOnly: true },
        ...Array.from(groupsMap.entries()).map(([title, emps]) => ({
          title,
          employees: emps,
          isBannerOnly: false,
        })),
      ];
    }

    return Array.from(groupsMap.entries()).map(([title, emps]) => ({
      title,
      employees: emps,
      isBannerOnly: false,
    }));
  }, [filteredEmployees]);

  // ═══ TOTAUX JOURNALIERS POUR LE PIED DE PAGE SKELLO ═══
  const dailyTotals = useMemo(() => {
    return weekDays.map((dayItem) => {
      let headcount = 0;
      let totalMinutes = 0;
      filteredEmployees.forEach((emp) => {
        const shift = resolveCellShift(emp, dayItem);
        if (shift && !shift.isRest && !shift.isAbsence && !shift.isHoliday) {
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
          Chargement du planning Skello × En-Check...
        </p>
      </div>
    );
  }

  // Totaux globaux pour la barre de pied Skello
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

      {/* ═══ BARRE DE COMMANDE SUPÉRIEURE FAÇON SKELLO ═══ */}
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
                className={`sk-view-link ${skelloView === "semaine" ? "active" : ""}`}
                onClick={() => setSkelloView("semaine")}
              >
                Semaine
              </button>
              <button
                type="button"
                className={`sk-view-link ${skelloView === "mois" ? "active" : ""}`}
                onClick={() => setSkelloView("mois")}
              >
                Mois
              </button>
              <button
                type="button"
                className={`sk-view-link ${skelloView === "jour" ? "active" : ""}`}
                onClick={() => setSkelloView("jour")}
              >
                Jour
              </button>
              <button
                type="button"
                className={`sk-view-link ${skelloView === "demandes" ? "active" : ""}`}
                onClick={() => setSkelloView("demandes")}
              >
                Demandes
                {pendingRequestsCount > 0 && (
                  <span className="sk-req-badge">{pendingRequestsCount}</span>
                )}
              </button>
            </div>

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

      {/* ═══ ESPACE DE TRAVAIL PRINCIPAL SKELLO ═══ */}
      <main className="sk-workspace">
        {/* 1. DOCK DRAG & DROP : "▾ Modèles à glisser-déposer (Drag & Drop)" */}
        <section className="sk-dock-panel" aria-label="Modèles à glisser-déposer">
          <div className="sk-dock-header">
            <button
              type="button"
              className="sk-dock-toggle"
              onClick={() => setDockOpen((o) => !o)}
            >
              <span className={`sk-dock-caret ${dockOpen ? "" : "collapsed"}`}>▼</span>
              <span>Modèles à glisser-déposer (Drag & Drop)</span>
            </button>

            <div className="sk-dock-actions">
              <span className="sk-dock-hint">
                Glissez un modèle sur une case jour ou sur un collaborateur • Maintenez{" "}
                <strong>Alt</strong> pour dupliquer un shift
              </span>
              <button type="button" className="sk-dock-add-btn" onClick={handleAdd}>
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
                  draggable
                  onDragStart={(e) => handleDragStartTemplate(e, tpl)}
                  onDragEnd={() => {
                    setDraggedPayload(null);
                    setDropTargetCell(null);
                  }}
                  title={`Glisser "${tpl.label}" vers la grille`}
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
                    <span className="sk-brick-title">{tpl.label}</span>
                  </div>

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
              ))}
            </div>
          )}
        </section>

        {/* 2. VUE SEMAINE (MATRICE SKELLO DRAG & DROP) */}
        {skelloView === "semaine" && (
          <>
            {/* Bannière d'équipe repliable comme sur la maquette : "▾ ÉQUIPE OFFICINE & VENTE" */}
            {employeeGroups
              .filter((g) => g.isBannerOnly)
              .map((g) => (
                <div
                  key={g.title}
                  className="sk-team-banner"
                  onClick={() =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [g.title]: !prev[g.title],
                    }))
                  }
                >
                  <div className="sk-team-banner-left">
                    <span className="sk-dock-caret">▼</span>
                    <span>{g.title}</span>
                  </div>
                  <div className="sk-team-banner-meta">
                    <span>Glisser-déposer actif</span>
                  </div>
                </div>
              ))}

            {/* Grille Matrice Hebdomadaire Skello */}
            <div className="sk-matrix-card">
              <div className="sk-matrix-scroll">
                <table className="sk-matrix-table">
                  <thead>
                    <tr>
                      <th className="sk-col-emp sk-th-emp">
                        <span style={{ color: "var(--sk-accent-warm)", marginRight: 8 }}>▼</span>
                        {employeeGroups.find((g) => !g.isBannerOnly)?.title || "GARDE & LOGISTIQUE"}
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
                        .map((group, groupIdx) => {
                          const isCollapsed = Boolean(collapsedGroups[group.title]);
                          return [
                            groupIdx > 0 && (
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
                                  <span style={{ color: "var(--sk-accent-warm)", marginRight: 8 }}>
                                    {isCollapsed ? "▶" : "▼"}
                                  </span>
                                  {group.title} ({group.employees.length})
                                </td>
                              </tr>
                            ),
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
                                          {/* Infobulle flottante Skello lors du survol en Drag & Drop */}
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

            {/* Barre Récapitulative Fixe en Bas (Pied de Grille Skello) */}
            <footer className="sk-bottom-bar">
              <div className="sk-bottom-slots">
                <div className="sk-bottom-slot">
                  <span>
                    Effectif: <strong>{totalActiveEmployees}</strong>
                  </span>
                </div>
                {dailyTotals.slice(0, 4).map((dt) => (
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

        {/* 3. VUE JOUR (TIMELINE JOURNALIÈRE SKELLO) */}
        {skelloView === "jour" && (
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
                onClick={() => setSkelloView("semaine")}
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
        {skelloView === "mois" && (
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
                        minHeight: 86,
                        background: "transparent",
                        borderRadius: 10,
                      }}
                    />
                  );
                }
                const isSelected = selectedCalendarDay?.date === cell.date;
                return (
                  <div
                    key={cell.id}
                    onClick={() => {
                      setSelectedCalendarDay(cell);
                      setCalendarDate(new Date(cell.date + "T12:00:00"));
                    }}
                    style={{
                      minHeight: 92,
                      padding: 10,
                      borderRadius: 12,
                      background: cell.isHoliday
                        ? "rgba(139, 92, 246, 0.14)"
                        : "var(--sk-bg-cell)",
                      border: isSelected
                        ? "2px solid var(--sk-accent)"
                        : "1px solid var(--sk-border-soft)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
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
                    <div style={{ fontSize: 11.5, color: "var(--sk-text-soft)" }}>
                      {cell.isHoliday
                        ? cell.holiday?.name
                        : `${cell.schPlannings.length} modèle(s) • ${cell.actES.length} perso`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. VUE DEMANDES DES COLLABORATEURS (schedule_change_requests) */}
        {skelloView === "demandes" && (
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
                onClick={() => setSkelloView("semaine")}
              >
                Retour à la grille Skello
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
                <span className="sk-modal-sub">Modèle d'horaire entreprise (Dock Skello)</span>
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
                <span className="sk-modal-sub">Configuration individuelle Skello</span>
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
