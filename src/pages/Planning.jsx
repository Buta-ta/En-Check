// ═══════════════════════════════════════════════════════════
// 📅 PAGE GESTION DES PLANNINGS / HORAIRES - VERSION PRO V3
// Vue liste + calendrier + plannings personnalisés + demandes employé + jours fériés
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import HolidayService from "../services/holidayService";
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
  Timer,
  Shield,
  Sparkles,
  Eye,
  MessageSquare,
  Send,
  Ban,
} from "lucide-react";
import toast from "react-hot-toast";

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

function formatDateFR(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTimeFR(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Planning() {
  const [admin, setAdmin] = useState(null);
  const [plannings, setPlannings] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [entreprises, setEntreprises] = useState([]);
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingPlanning, setEditingPlanning] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planningToDelete, setPlanningToDelete] = useState(null);

  const [selectedEntreprise, setSelectedEntreprise] = useState("all");
  const [activeTab, setActiveTab] = useState("plannings");
  const [viewMode, setViewMode] = useState("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const [showEmployeeScheduleModal, setShowEmployeeScheduleModal] = useState(false);
  const [editingEmployeeSchedule, setEditingEmployeeSchedule] = useState(null);

  const [holidaysByEnterprise, setHolidaysByEnterprise] = useState({});
  const [holidayMapsByEnterprise, setHolidayMapsByEnterprise] = useState({});

  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewingRequest, setReviewingRequest] = useState(false);
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false)
  const [requestToDelete, setRequestToDelete] = useState(null) 

  const navigate = useNavigate();

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
          "id, enterprise_id, first_name, last_name, matricule, department, position, is_active, enterprises(name)"
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

      const enterpriseIdsToLoad = isSuperAdmin
        ? selectedEntreprise !== "all"
          ? [selectedEntreprise]
          : (entreprisesData || []).map((e) => e.id)
        : [enterpriseId];

      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(getDaysInMonth(year, month)).padStart(2, "0")}`;

      const hSets = {},
        hMaps = {};
      await Promise.all(
        enterpriseIdsToLoad.filter(Boolean).map(async (entId) => {
          const holidays = await HolidayService.getHolidaysForRange(entId, start, end);
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

  const handleAdd = () => {
    const eid = admin.selectedEnterprise?.id || admin.enterprise_id;
    const defaultEid =
      admin.role === "super_admin"
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
        toast.success("Planning modifié !");
      } else {
        const { error } = await supabase.from("work_schedules").insert(d);
        if (error) throw error;
        toast.success("Planning créé !");
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
  setRequestToDelete(request)
  setShowDeleteRequestModal(true)
}

const handleDeleteRequest = async () => {
  if (!requestToDelete) return

  try {
    const { error } = await supabase
      .from('schedule_change_requests')
      .delete()
      .eq('id', requestToDelete.id)

    if (error) throw error

    toast.success('Demande supprimée')
    setShowDeleteRequestModal(false)
    setRequestToDelete(null)
    loadData(admin)
  } catch (error) {
    console.error(error)
    toast.error('Erreur lors de la suppression')
  }
}
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

  const formatTime = (t) => (t ? t.slice(0, 5) : "--:--");

  const formatWorkDays = (days) => {
    if (!days || days.length === 0) return "Aucun";
    if (days.length === 7) return "Tous les jours";
    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5]))
      return "Lun - Ven";
    if (JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5, 6]))
      return "Lun - Sam";
    return days
      .map((d) => joursSemaine.find((j) => j.id === d)?.court)
      .join(", ");
  };

  const formatDuration = (p) => {
    if (!p.start_time || !p.end_time) return "—";
    const [sh, sm] = p.start_time.slice(0, 5).split(":").map(Number);
    const [eh, em] = p.end_time.slice(0, 5).split(":").map(Number);
    let total = eh * 60 + em - (sh * 60 + sm);
    if (p.has_break && p.break_start && p.break_end) {
      const [bh, bm] = p.break_start.slice(0, 5).split(":").map(Number);
      const [fh, fm] = p.break_end.slice(0, 5).split(":").map(Number);
      total -= fh * 60 + fm - (bh * 60 + bm);
    }
    return `${Math.floor(total / 60)}h${(total % 60).toString().padStart(2, "0")}`;
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

  const employeesWithoutCustomSchedule = filteredEmployees.filter(
    (emp) => !employeeSchedules.some((es) => es.employee_id === emp.id)
  );

  const getHolidaySet = (id) => holidaysByEnterprise[id] || new Set();
  const getHolidayMap = (id) => holidayMapsByEnterprise[id] || new Map();

  // ═══ CALENDAR DATA ═══
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

  const openEmployeeScheduleModal = (es = null) => {
    if (es) {
      setEditingEmployeeSchedule(es);
      setEmployeeScheduleForm({
        employee_id: es.employee_id,
        schedule_id: es.schedule_id || "",
        use_custom_hours: es.use_custom_hours || false,
        custom_start_time: es.custom_start_time?.slice(0, 5) || "08:00",
        custom_end_time: es.custom_end_time?.slice(0, 5) || "17:00",
        custom_break_start: es.custom_break_start?.slice(0, 5) || "12:00",
        custom_break_end: es.custom_break_end?.slice(0, 5) || "13:00",
        custom_has_break: es.custom_has_break ?? true,
        custom_work_days: es.custom_work_days || [1, 2, 3, 4, 5],
      });
    } else {
      setEditingEmployeeSchedule(null);
      setEmployeeScheduleForm({
        employee_id: filteredEmployees[0]?.id || "",
        schedule_id: filteredPlannings[0]?.id || "",
        use_custom_hours: false,
        custom_start_time: "08:00",
        custom_end_time: "17:00",
        custom_break_start: "12:00",
        custom_break_end: "13:00",
        custom_has_break: true,
        custom_work_days: [1, 2, 3, 4, 5],
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

      if (editingEmployeeSchedule) {
        const { error } = await supabase
          .from("employee_schedules")
          .update(payload)
          .eq("id", editingEmployeeSchedule.id);
        if (error) throw error;
        toast.success("Planning personnalisé modifié");
      } else {
        const { error } = await supabase
          .from("employee_schedules")
          .upsert(payload, { onConflict: "employee_id" });
        if (error) throw error;
        toast.success("Planning personnalisé enregistré");
      }

      setShowEmployeeScheduleModal(false);
      loadData(admin);
    } catch (error) {
      console.error(error);
      toast.error("Erreur sauvegarde");
    }
  };

  const handleDeleteEmployeeSchedule = async (es) => {
    try {
      const { error } = await supabase
        .from("employee_schedules")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", es.id);
      if (error) throw error;
      toast.success("Planning personnalisé supprimé");
      loadData(admin);
    } catch (error) {
      console.error(error);
      toast.error("Erreur suppression");
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
          custom_start_time: selectedRequest.use_custom_hours ? selectedRequest.requested_start_time : null,
          custom_end_time: selectedRequest.use_custom_hours ? selectedRequest.requested_end_time : null,
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

  const stats = {
    totalPlannings: filteredPlannings.length,
    defaultPlannings: filteredPlannings.filter((p) => p.is_default).length,
    customES: employeeSchedules.filter((es) => es.use_custom_hours || es.schedule_id).length,
    pendingRequests: filteredRequests.filter((r) => r.status === "pending").length,
  };

  if (loading) {
    return (
      <div className="pl-loading">
        <style>{`
          .pl-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            background: #07070C;
          }
          .pl-loading-icon {
            animation: plFloat 2s ease-in-out infinite;
          }
          .pl-loading-text {
            color: #888;
            font-size: 15px;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-weight: 500;
          }
          .pl-loading-bar {
            width: 200px;
            height: 3px;
            background: rgba(245,158,11,0.12);
            border-radius: 3px;
            overflow: hidden;
          }
          .pl-loading-fill {
            width: 40%;
            height: 100%;
            border-radius: 3px;
            background: linear-gradient(90deg, #F59E0B, #D97706);
            animation: plShimmer 1.2s ease-in-out infinite;
          }
          @keyframes plFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          @keyframes plShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
        <div className="pl-loading-icon">
          <Calendar size={50} color="#F59E0B" />
        </div>
        <p className="pl-loading-text">Chargement des plannings...</p>
        <div className="pl-loading-bar">
          <div className="pl-loading-fill"></div>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        @keyframes plFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .pl-root {
          min-height: 100vh; background: #07070C;
          color: #E5E5E5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .pl-header {
          background: rgba(12,12,20,0.96); backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(245,158,11,0.12);
          position: sticky; top: 0; z-index: 100;
        }
        .pl-header-inner {
          max-width: 1300px; margin: 0 auto; padding: 12px 20px;
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }
        .pl-header-left { display: flex; align-items: center; gap: 10px; }
        .pl-back {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.18);
          color: #F59E0B; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s;
        }
        .pl-back:hover { background: rgba(245,158,11,0.15); }
        .pl-logo-box {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.18);
          display: flex; align-items: center; justify-content: center;
        }
        .pl-header-title { color: #fff; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; margin: 0; }
        .pl-header-sub { color: #F59E0B; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600; }
        .pl-header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pl-pill {
          display: flex; align-items: center; gap: 7px;
          background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.18);
          padding: 7px 14px; border-radius: 999px; color: #F59E0B; font-size: 13px; font-weight: 600;
        }
        .pl-add-btn {
          display: flex; align-items: center; gap: 7px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          border: none; padding: 10px 16px; border-radius: 12px;
          color: #000; font-weight: 700; font-size: 14px; cursor: pointer;
          font-family: inherit; transition: transform 0.15s;
        }
        .pl-add-btn:hover { transform: scale(1.03); }

        .pl-main { max-width: 1300px; margin: 0 auto; padding: 24px 20px; }

        .pl-hero { margin-bottom: 20px; }
        .pl-hero h2 { color: #fff; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; }
        .pl-hero p { color: #777; font-size: 14px; margin: 0; line-height: 1.5; }

        .pl-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;
        }
        .pl-stat {
          background: rgba(18,18,30,0.8); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 12px;
        }
        .pl-stat-icon {
          width: 42px; height: 42px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pl-stat-num { color: #fff; font-size: 22px; font-weight: 800; line-height: 1; }
        .pl-stat-label { color: #777; font-size: 11px; margin-top: 3px; }

        .pl-toolbar {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .pl-tabs {
          display: flex; gap: 4px; background: rgba(18,18,30,0.9);
          border-radius: 12px; padding: 4px; border: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
        }
        .pl-tab {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 14px; border: none; background: transparent;
          border-radius: 9px; color: #777; cursor: pointer;
          font-weight: 600; font-size: 13px; font-family: inherit; transition: all 0.2s;
        }
        .pl-tab:hover { background: rgba(245,158,11,0.06); }
        .pl-tab.active { background: linear-gradient(135deg, #F59E0B, #D97706); color: #000; }
        .pl-toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pl-view-switch {
          display: flex; background: rgba(18,18,30,0.9);
          border-radius: 10px; padding: 3px; border: 1px solid rgba(255,255,255,0.06);
        }
        .pl-view-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 11px; border: none; background: transparent;
          border-radius: 7px; color: #777; cursor: pointer;
          font-weight: 600; font-size: 12px; font-family: inherit;
        }
        .pl-view-btn.active { background: rgba(245,158,11,0.12); color: #F59E0B; }
        .pl-filter {
          display: flex; align-items: center; gap: 8px;
          background: rgba(18,18,30,0.9); border: 1px solid rgba(255,255,255,0.06);
          padding: 9px 14px; border-radius: 10px;
        }
        .pl-filter select {
          flex: 1; background: transparent; border: none; outline: none;
          color: #E5E5E5; font-size: 13px; font-family: inherit;
        }
        .pl-filter select option { background: #141423; color: #E5E5E5; }
        .pl-sec-btn {
          display: flex; align-items: center; gap: 7px;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          color: #818CF8; padding: 9px 14px; border-radius: 10px;
          cursor: pointer; font-weight: 700; font-size: 13px; font-family: inherit;
        }

        .pl-layout {
          display: grid; grid-template-columns: 1fr 360px; gap: 16px; align-items: start;
        }

        .pl-section {
          background: rgba(18,18,30,0.75); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 18px; padding: 16px; backdrop-filter: blur(8px);
        }
        .pl-section-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 14px;
        }
        .pl-section-head-left { display: flex; align-items: center; gap: 10px; }
        .pl-section-icon {
          width: 32px; height: 32px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pl-section-title { color: #fff; font-size: 15px; font-weight: 700; margin: 0; }
        .pl-badge {
          background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2);
          color: #F59E0B; padding: 3px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700;
        }

        .pl-card {
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 14px; margin-bottom: 10px;
          transition: all 0.2s; animation: plFadeIn 0.3s ease forwards; opacity: 0;
        }
        .pl-card:hover { border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.03); transform: translateY(-2px); }
        .pl-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .pl-card-main { display: flex; gap: 10px; flex: 1; min-width: 0; }
        .pl-card-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pl-card-info { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        .pl-card-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pl-card-name { color: #fff; font-size: 15px; font-weight: 700; }
        .pl-default-badge {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(16,185,129,0.1); color: #10B981;
          border: 1px solid rgba(16,185,129,0.18);
          font-size: 10px; padding: 2px 7px; border-radius: 999px; font-weight: 700;
        }
        .pl-ent-name {
          display: inline-flex; align-items: center; gap: 4px;
          color: #F59E0B; font-size: 11px; font-weight: 500;
        }
        .pl-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .pl-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 600;
        }
        .pl-tag-gold { background: rgba(245,158,11,0.08); color: #F59E0B; border: 1px solid rgba(245,158,11,0.14); }
        .pl-tag-blue { background: rgba(99,102,241,0.08); color: #818CF8; border: 1px solid rgba(99,102,241,0.14); }
        .pl-tag-green { background: rgba(16,185,129,0.08); color: #10B981; border: 1px solid rgba(16,185,129,0.14); }
        .pl-meta { display: flex; gap: 10px; flex-wrap: wrap; }
        .pl-meta span { display: inline-flex; align-items: center; gap: 4px; color: #777; font-size: 11px; }
        .pl-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .pl-act-btn {
          width: 34px; height: 34px; border-radius: 9px; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.15s;
        }
        .pl-act-btn:hover { transform: scale(1.08); }
        .pl-act-gold { background: rgba(245,158,11,0.1); color: #F59E0B; }
        .pl-act-red { background: rgba(239,68,68,0.1); color: #EF4444; }
        .pl-act-blue { background: rgba(99,102,241,0.1); color: #818CF8; }
        .pl-act-green { background: rgba(16,185,129,0.1); color: #10B981; }

        .pl-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 30px 16px; text-align: center; gap: 8px;
        }
        .pl-empty h4 { color: #fff; font-size: 16px; font-weight: 700; margin: 0; }
        .pl-empty p { color: #666; font-size: 13px; margin: 0; }
        .pl-empty-btn {
          display: flex; align-items: center; gap: 7px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          border: none; padding: 10px 16px; border-radius: 10px;
          color: #000; font-weight: 700; font-size: 13px; cursor: pointer;
          margin-top: 6px; font-family: inherit;
        }
        .pl-empty-mini {
          padding: 14px; text-align: center; color: #555; font-size: 12px;
          background: rgba(255,255,255,0.015); border-radius: 10px;
          border: 1px dashed rgba(255,255,255,0.06);
        }

        .pl-cal-nav {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 14px;
        }
        .pl-cal-nav-btn {
          width: 36px; height: 36px; border-radius: 9px;
          background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.16);
          color: #F59E0B; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s;
        }
        .pl-cal-nav-btn:hover { background: rgba(245,158,11,0.15); }
        .pl-cal-month { color: #fff; font-size: 16px; font-weight: 700; text-transform: capitalize; }
        .pl-cal-sub { color: #555; font-size: 11px; margin-top: 2px; text-align: center; }

        .pl-cal-table {
          width: 100%; border-collapse: separate; border-spacing: 4px;
          table-layout: fixed;
        }
        .pl-cal-table th {
          color: #666; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 1px;
          padding: 6px 0; text-align: center;
        }
        .pl-cal-table td {
          vertical-align: top; height: 90px; padding: 0;
        }
        .pl-cal-cell-empty {
          background: transparent;
        }
        .pl-cal-cell {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px; padding: 6px; cursor: pointer;
          transition: all 0.2s; height: 100%;
          display: flex; flex-direction: column; gap: 3px;
        }
        .pl-cal-cell:hover {
          border-color: rgba(245,158,11,0.3); transform: translateY(-1px);
        }
        .pl-cal-cell.weekend { background: rgba(255,255,255,0.012); }
        .pl-cal-cell.today {
          border-color: rgba(245,158,11,0.5);
          box-shadow: inset 0 0 0 1px rgba(245,158,11,0.2);
        }
        .pl-cal-cell.holiday {
          background: rgba(139,92,246,0.06);
          border-color: rgba(139,92,246,0.18);
        }
        .pl-cal-cell.selected {
          background: rgba(245,158,11,0.08);
          border-color: rgba(245,158,11,0.4);
        }
        .pl-cal-cell-top {
          display: flex; justify-content: space-between; align-items: center;
        }
        .pl-cal-day { color: #fff; font-size: 12px; font-weight: 700; }
        .pl-cal-holiday-emoji { font-size: 10px; }
        .pl-cal-holiday-name {
          color: #A78BFA; font-size: 8px; font-weight: 700;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pl-cal-chips { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
        .pl-cal-chip {
          font-size: 8px; font-weight: 700; padding: 2px 5px;
          border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pl-cal-chip-gold {
          background: rgba(245,158,11,0.1); color: #F59E0B;
          border: 1px solid rgba(245,158,11,0.16);
        }
        .pl-cal-chip-blue {
          background: rgba(99,102,241,0.1); color: #818CF8;
          border: 1px solid rgba(99,102,241,0.16);
        }
        .pl-cal-more { color: #555; font-size: 8px; font-weight: 700; }

        .pl-cal-legend {
          display: flex; gap: 14px; flex-wrap: wrap; margin-top: 12px;
          padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);
        }
        .pl-cal-legend-item { display: flex; align-items: center; gap: 5px; }
        .pl-cal-legend-dot { width: 9px; height: 9px; border-radius: 50%; }
        .pl-cal-legend-text { color: #777; font-size: 11px; }

        .pl-detail-list { display: flex; flex-direction: column; gap: 8px; }
        .pl-detail-item {
          display: flex; justify-content: space-between; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px; padding: 10px 12px;
        }
        .pl-detail-name { color: #fff; font-size: 13px; font-weight: 700; }
        .pl-detail-meta { color: #777; font-size: 11px; margin-top: 2px; }
        .pl-detail-chip {
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.18);
          color: #10B981; padding: 2px 7px; border-radius: 999px;
          font-size: 10px; font-weight: 700; flex-shrink: 0;
        }
        .pl-inline-btn {
          width: 28px; height: 28px; border-radius: 7px; border: none;
          background: rgba(99,102,241,0.1); color: #818CF8;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
        }

        .pl-holiday-box {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(139,92,246,0.07); border: 1px solid rgba(139,92,246,0.16);
          border-radius: 12px; padding: 12px; margin-bottom: 12px;
        }
        .pl-holiday-box-title { color: #EDE9FE; font-size: 13px; font-weight: 700; }
        .pl-holiday-box-sub { color: #A78BFA; font-size: 11px; margin-top: 2px; }

        .pl-request-status {
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .pl-footer {
          margin-top: 36px; padding-bottom: 20px; text-align: center;
        }
        .pl-footer-line {
          height: 1px; margin-bottom: 14px;
          background: linear-gradient(90deg, transparent, rgba(245,158,11,0.18), transparent);
        }
        .pl-footer-text {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          color: #444; font-size: 11px; letter-spacing: 2px;
        }

        .pl-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px); display: flex; align-items: center;
          justify-content: center; padding: 16px; z-index: 300; overflow-y: auto;
        }
        .pl-modal {
          background: #0D0D18; border: 1px solid rgba(245,158,11,0.18);
          border-radius: 18px; width: 100%; max-width: 540px;
          max-height: 90vh; overflow: auto;
          box-shadow: 0 16px 60px rgba(0,0,0,0.5);
        }
        .pl-modal-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 18px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .pl-modal-head-left { display: flex; align-items: center; gap: 12px; }
        .pl-modal-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pl-modal-title { color: #fff; font-size: 17px; font-weight: 700; margin: 0; }
        .pl-modal-sub { color: #555; font-size: 11px; display: block; margin-top: 2px; }
        .pl-close {
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(255,255,255,0.08); border: none; color: #888;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
        }
        .pl-modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
        .pl-form-group { display: flex; flex-direction: column; gap: 6px; }
        .pl-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pl-label {
          display: flex; align-items: center; gap: 5px;
          color: #888; font-size: 12px; font-weight: 600;
        }
        .pl-input {
          width: 100%; padding: 12px 14px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; color: #fff; font-size: 14px;
          outline: none; font-family: inherit;
        }
        .pl-input:focus { border-color: rgba(245,158,11,0.3); }
        .pl-select {
          width: 100%; padding: 12px 14px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; color: #fff; font-size: 14px;
          outline: none; cursor: pointer; font-family: inherit;
        }
        .pl-select option { background: #141423; color: #E5E5E5; }
        .pl-check-label {
          display: flex; align-items: center; gap: 8px;
          color: #fff; font-size: 13px; cursor: pointer;
        }
        .pl-check-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #F59E0B; }
        .pl-days-grid { display: flex; gap: 6px; flex-wrap: wrap; }
        .pl-day-btn {
          padding: 8px 12px; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; background: rgba(255,255,255,0.04);
          cursor: pointer; font-size: 12px; font-weight: 600;
          color: #777; font-family: inherit; transition: all 0.15s;
        }
        .pl-day-btn.active-gold {
          background: linear-gradient(135deg, #F59E0B, #D97706);
          border-color: #F59E0B; color: #000;
        }
        .pl-day-btn.active-blue {
          background: linear-gradient(135deg, #6366F1, #4F46E5);
          border-color: #6366F1; color: #fff;
        }
        .pl-hint { font-size: 10px; color: #555; margin-top: 2px; }
        .pl-modal-foot {
          display: flex; gap: 10px; padding: 14px 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .pl-cancel-btn {
          flex: 1; padding: 12px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; color: #fff; font-size: 14px;
          font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .pl-save-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 12px; background: linear-gradient(135deg, #F59E0B, #D97706);
          border: none; border-radius: 10px; color: #000;
          font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .pl-save-btn-blue {
          background: linear-gradient(135deg, #6366F1, #4F46E5); color: #fff;
        }
        .pl-delete-btn {
          flex: 1; padding: 12px; background: #EF4444; border: none;
          border-radius: 10px; color: #fff; font-size: 14px;
          font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .pl-save-btn-green {
          background: linear-gradient(135deg, #10B981, #059669);
          color: #fff;
        }
        .pl-save-btn-red {
          background: linear-gradient(135deg, #EF4444, #B91C1C);
          color: #fff;
        }

        .pl-confirm {
          background: #0D0D18; border: 1px solid rgba(239,68,68,0.18);
          border-radius: 18px; width: 100%; max-width: 380px;
          padding: 28px; text-align: center;
          box-shadow: 0 16px 60px rgba(0,0,0,0.5);
        }
        .pl-confirm-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(239,68,68,0.12);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px auto;
        }
        .pl-confirm h3 { color: #fff; font-size: 18px; font-weight: 700; margin: 0 0 10px 0; }
        .pl-confirm p { color: #777; font-size: 13px; line-height: 1.5; margin-bottom: 20px; }
        .pl-confirm-actions { display: flex; gap: 10px; }

        @media (max-width: 980px) {
          .pl-layout { grid-template-columns: 1fr !important; }
          .pl-form-row { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .pl-header-inner { flex-direction: column; align-items: stretch; }
          .pl-toolbar { flex-direction: column; }
          .pl-stats { grid-template-columns: repeat(2, 1fr); }
          .pl-cal-table td { height: 70px; }
        }
        @media (max-width: 520px) {
          .pl-stats { grid-template-columns: 1fr; }
          .pl-cal-table td { height: 60px; }
        }

        ::-webkit-scrollbar { width: 7px; }
        ::-webkit-scrollbar-track { background: #07070C; }
        ::-webkit-scrollbar-thumb { background: #F59E0B; border-radius: 4px; }
      `}</style>

      <div className="pl-root">
        {/* ══ HEADER ══ */}
        <header className="pl-header">
          <div className="pl-header-inner">
            <div className="pl-header-left">
              <button className="pl-back" onClick={() => navigate("/dashboard")}>
                <ArrowLeft size={18} />
              </button>
              <div className="pl-logo-box">
                <Calendar size={22} color="#F59E0B" />
              </div>
              <div>
                <h1 className="pl-header-title">PLANNING</h1>
                <span className="pl-header-sub">Horaires, pauses & tolérance</span>
              </div>
            </div>
            <div className="pl-header-right">
              <div className="pl-pill">
                <Clock size={14} />
                <span>{stats.totalPlannings} planning{stats.totalPlannings > 1 ? "s" : ""}</span>
              </div>
              <button className="pl-add-btn" onClick={handleAdd}>
                <Plus size={16} />
                <span>Nouveau</span>
              </button>
            </div>
          </div>
        </header>

        <main className="pl-main">
          {/* ══ HERO ══ */}
          <div className="pl-hero">
            <h2>Gestion des horaires</h2>
            <p>Plannings entreprise, personnalisés, demandes employé et vue calendrier avec jours fériés.</p>
          </div>

          {/* ══ STATS ══ */}
          <div className="pl-stats">
            <div className="pl-stat">
              <div className="pl-stat-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
                <Calendar size={20} color="#F59E0B" />
              </div>
              <div>
                <div className="pl-stat-num">{stats.totalPlannings}</div>
                <div className="pl-stat-label">Plannings</div>
              </div>
            </div>
            <div className="pl-stat">
              <div className="pl-stat-icon" style={{ background: "rgba(16,185,129,0.12)" }}>
                <CheckCircle2 size={20} color="#10B981" />
              </div>
              <div>
                <div className="pl-stat-num">{stats.defaultPlannings}</div>
                <div className="pl-stat-label">Par défaut</div>
              </div>
            </div>
            <div className="pl-stat">
              <div className="pl-stat-icon" style={{ background: "rgba(99,102,241,0.12)" }}>
                <User size={20} color="#6366F1" />
              </div>
              <div>
                <div className="pl-stat-num">{stats.customES}</div>
                <div className="pl-stat-label">Personnalisés</div>
              </div>
            </div>
            <div className="pl-stat">
              <div className="pl-stat-icon" style={{ background: "rgba(139,92,246,0.12)" }}>
                <MessageSquare size={20} color="#8B5CF6" />
              </div>
              <div>
                <div className="pl-stat-num">{stats.pendingRequests}</div>
                <div className="pl-stat-label">Demandes en attente</div>
              </div>
            </div>
          </div>

          {/* ══ TOOLBAR ══ */}
          <div className="pl-toolbar">
            <div className="pl-tabs">
              <button
                className={`pl-tab ${activeTab === "plannings" ? "active" : ""}`}
                onClick={() => setActiveTab("plannings")}
              >
                <Calendar size={15} />
                <span>Entreprise</span>
              </button>
              <button
                className={`pl-tab ${activeTab === "personnalises" ? "active" : ""}`}
                onClick={() => setActiveTab("personnalises")}
              >
                <User size={15} />
                <span>Personnalisés</span>
              </button>
              <button
                className={`pl-tab ${activeTab === "demandes" ? "active" : ""}`}
                onClick={() => setActiveTab("demandes")}
              >
                <MessageSquare size={15} />
                <span>Demandes employé</span>
              </button>
            </div>

            <div className="pl-toolbar-right">
              <div className="pl-view-switch">
                <button
                  className={`pl-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <Eye size={14} />
                  <span>Liste</span>
                </button>
                <button
                  className={`pl-view-btn ${viewMode === "calendar" ? "active" : ""}`}
                  onClick={() => setViewMode("calendar")}
                >
                  <CalendarDays size={14} />
                  <span>Calendrier</span>
                </button>
              </div>

              {admin?.role === "super_admin" && (
                <div className="pl-filter">
                  <Building2 size={14} color="#F59E0B" />
                  <select
                    value={selectedEntreprise}
                    onChange={(e) => setSelectedEntreprise(e.target.value)}
                  >
                    <option value="all">Toutes les entreprises</option>
                    {entreprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === "personnalises" && (
                <button className="pl-sec-btn" onClick={() => openEmployeeScheduleModal()}>
                  <Plus size={14} />
                  <span>Attribuer</span>
                </button>
              )}
            </div>
          </div>

          {/* ══ LAYOUT ══ */}
          <div className="pl-layout">
            {/* LEFT COL */}
            <div>
              {activeTab === "plannings" && viewMode === "list" && (
                <div className="pl-section">
                  <div className="pl-section-head">
                    <div className="pl-section-head-left">
                      <div className="pl-section-icon" style={{ background: "rgba(245,158,11,0.1)" }}>
                        <Clock size={16} color="#F59E0B" />
                      </div>
                      <h3 className="pl-section-title">Plannings entreprise</h3>
                    </div>
                    <span className="pl-badge">{filteredPlannings.length}</span>
                  </div>

                  {filteredPlannings.length === 0 ? (
                    <div className="pl-empty">
                      <Clock size={38} color="#555" />
                      <h4>Aucun planning</h4>
                      <p>Créez un planning pour démarrer.</p>
                      <button className="pl-empty-btn" onClick={handleAdd}>
                        <Plus size={14} />
                        Créer
                      </button>
                    </div>
                  ) : (
                    filteredPlannings.map((p, i) => (
                      <div key={p.id} className="pl-card" style={{ animationDelay: `${i * 0.04}s` }}>
                        <div className="pl-card-top">
                          <div className="pl-card-main">
                            <div className="pl-card-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
                              <Clock size={18} color="#F59E0B" />
                            </div>
                            <div className="pl-card-info">
                              <div className="pl-card-name-row">
                                <span className="pl-card-name">{p.name}</span>
                                {p.is_default && (
                                  <span className="pl-default-badge">
                                    <Zap size={9} /> Défaut
                                  </span>
                                )}
                              </div>
                              {admin?.role === "super_admin" && p.enterprises && (
                                <span className="pl-ent-name">
                                  <Building2 size={11} />
                                  {p.enterprises.name}
                                </span>
                              )}
                              <div className="pl-tags">
                                <span className="pl-tag pl-tag-gold">
                                  <Clock size={10} />
                                  {formatTime(p.start_time)} - {formatTime(p.end_time)}
                                </span>
                                <span className="pl-tag pl-tag-blue">
                                  <Timer size={10} />
                                  {formatDuration(p)}
                                </span>
                                {p.has_break && (
                                  <span className="pl-tag pl-tag-green">
                                    <Coffee size={10} />
                                    {formatTime(p.break_start)} - {formatTime(p.break_end)}
                                  </span>
                                )}
                              </div>
                              <div className="pl-meta">
                                <span><Calendar size={11} /> {formatWorkDays(p.work_days)}</span>
                                <span><AlertCircle size={11} color="#F59E0B" /> Tolérance {p.late_tolerance_minutes} min</span>
                              </div>
                            </div>
                          </div>
                          <div className="pl-actions">
                            <button className="pl-act-btn pl-act-gold" onClick={() => handleEdit(p)}>
                              <Edit size={14} />
                            </button>
                            <button className="pl-act-btn pl-act-red" onClick={() => confirmDelete(p)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "personnalises" && viewMode === "list" && (
                <div className="pl-section">
                  <div className="pl-section-head">
                    <div className="pl-section-head-left">
                      <div className="pl-section-icon" style={{ background: "rgba(99,102,241,0.1)" }}>
                        <User size={16} color="#6366F1" />
                      </div>
                      <h3 className="pl-section-title">Plannings personnalisés</h3>
                    </div>
                    <span className="pl-badge">{employeeSchedules.length}</span>
                  </div>

                  {employeeSchedules.length === 0 ? (
                    <div className="pl-empty">
                      <Users size={38} color="#555" />
                      <h4>Aucun planning personnalisé</h4>
                      <p>Attribuez un planning spécifique.</p>
                      <button className="pl-empty-btn" onClick={() => openEmployeeScheduleModal()}>
                        <Plus size={14} />
                        Attribuer
                      </button>
                    </div>
                  ) : (
                    employeeSchedules.map((item, i) => (
                      <div key={item.id} className="pl-card" style={{ animationDelay: `${i * 0.04}s` }}>
                        <div className="pl-card-top">
                          <div className="pl-card-main">
                            <div className="pl-card-icon" style={{ background: "rgba(99,102,241,0.12)" }}>
                              <User size={18} color="#6366F1" />
                            </div>
                            <div className="pl-card-info">
                              <div className="pl-card-name-row">
                                <span className="pl-card-name">
                                  {item.employees?.first_name} {item.employees?.last_name}
                                </span>
                                <span style={{ color: "#777", fontSize: 10, background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 6 }}>
                                  {item.employees?.matricule}
                                </span>
                              </div>
                              <div className="pl-tags">
                                {item.use_custom_hours ? (
                                  <>
                                    <span className="pl-tag pl-tag-blue">
                                      <Shield size={10} />
                                      Personnalisé
                                    </span>
                                    <span className="pl-tag pl-tag-gold">
                                      <Clock size={10} />
                                      {formatTime(item.custom_start_time)} - {formatTime(item.custom_end_time)}
                                    </span>
                                    {item.custom_has_break && (
                                      <span className="pl-tag pl-tag-green">
                                        <Coffee size={10} />
                                        {formatTime(item.custom_break_start)} - {formatTime(item.custom_break_end)}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="pl-tag pl-tag-blue">
                                      <Briefcase size={10} />
                                      {item.work_schedules?.name || "Planning lié"}
                                    </span>
                                    <span className="pl-tag pl-tag-gold">
                                      <Clock size={10} />
                                      {formatTime(item.work_schedules?.start_time)} - {formatTime(item.work_schedules?.end_time)}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="pl-meta">
                                <span>
                                  <Calendar size={11} />
                                  {item.use_custom_hours
                                    ? formatWorkDays(item.custom_work_days)
                                    : formatWorkDays(item.work_schedules?.work_days)}
                                </span>
                                {item.employees?.position && (
                                  <span><Briefcase size={11} />{item.employees.position}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="pl-actions">
                            <button className="pl-act-btn pl-act-blue" onClick={() => openEmployeeScheduleModal(item)}>
                              <Edit size={14} />
                            </button>
                            <button className="pl-act-btn pl-act-red" onClick={() => handleDeleteEmployeeSchedule(item)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "demandes" && viewMode === "list" && (
                <div className="pl-section">
                  <div className="pl-section-head">
                    <div className="pl-section-head-left">
                      <div className="pl-section-icon" style={{ background: "rgba(139,92,246,0.1)" }}>
                        <MessageSquare size={16} color="#8B5CF6" />
                      </div>
                      <h3 className="pl-section-title">Demandes de modification d’horaires</h3>
                    </div>
                    <span className="pl-badge">{filteredRequests.length}</span>
                  </div>

                  {filteredRequests.length === 0 ? (
                    <div className="pl-empty">
                      <MessageSquare size={38} color="#555" />
                      <h4>Aucune demande</h4>
                      <p>Aucun employé n’a encore demandé de modification.</p>
                    </div>
                  ) : (
                    filteredRequests.map((req, i) => (
                      <div key={req.id} className="pl-card" style={{ animationDelay: `${i * 0.04}s` }}>
                        <div className="pl-card-top">
                          <div className="pl-card-main">
                            <div className="pl-card-icon" style={{ background: "rgba(139,92,246,0.12)" }}>
                              <MessageSquare size={18} color="#8B5CF6" />
                            </div>
                            <div className="pl-card-info">
                              <div className="pl-card-name-row">
                                <span className="pl-card-name">
                                  {req.employees?.first_name} {req.employees?.last_name}
                                </span>
                                <span style={{ color: "#777", fontSize: 10, background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 6 }}>
                                  {req.employees?.matricule}
                                </span>
                                <span
                                  className="pl-request-status"
                                  style={{
                                    background:
                                      req.status === "pending"
                                        ? "rgba(245,158,11,0.12)"
                                        : req.status === "approved"
                                        ? "rgba(16,185,129,0.12)"
                                        : "rgba(239,68,68,0.12)",
                                    color:
                                      req.status === "pending"
                                        ? "#F59E0B"
                                        : req.status === "approved"
                                        ? "#10B981"
                                        : "#EF4444",
                                  }}
                                >
                                  {req.status === "pending"
                                    ? "En attente"
                                    : req.status === "approved"
                                    ? "Approuvée"
                                    : "Refusée"}
                                </span>
                              </div>

                              <div className="pl-tags">
                                {req.use_custom_hours ? (
                                  <>
                                    <span className="pl-tag pl-tag-blue">
                                      <Shield size={10} />
                                      Horaire personnalisé demandé
                                    </span>
                                    <span className="pl-tag pl-tag-gold">
                                      <Clock size={10} />
                                      {formatTime(req.requested_start_time)} - {formatTime(req.requested_end_time)}
                                    </span>
                                    {req.requested_has_break && (
                                      <span className="pl-tag pl-tag-green">
                                        <Coffee size={10} />
                                        {formatTime(req.requested_break_start)} - {formatTime(req.requested_break_end)}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="pl-tag pl-tag-blue">
                                      <Briefcase size={10} />
                                      Planning demandé
                                    </span>
                                    <span className="pl-tag pl-tag-gold">
                                      <Clock size={10} />
                                      {req.requested_schedule?.name || "Planning sélectionné"}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="pl-meta">
                                <span><CalendarDays size={11} />Demandé le {formatDateTimeFR(req.created_at)}</span>
                                {req.use_custom_hours && (
                                  <span><Calendar size={11} />{formatWorkDays(req.requested_work_days)}</span>
                                )}
                              </div>

                              {req.reason && (
                                <div style={{
                                  marginTop: 8,
                                  padding: '10px 12px',
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  borderRadius: 10,
                                  color: '#B0B0B0',
                                  fontSize: 12,
                                  lineHeight: 1.5
                                }}>
                                  <strong style={{ color: '#E5E5E5' }}>Motif :</strong> {req.reason}
                                </div>
                              )}

                              {req.admin_comment && (
                                <div style={{
                                  marginTop: 8,
                                  padding: '10px 12px',
                                  background: req.status === 'approved'
                                    ? 'rgba(16,185,129,0.06)'
                                    : 'rgba(239,68,68,0.06)',
                                  border: `1px solid ${req.status === 'approved'
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'rgba(239,68,68,0.15)'}`,
                                  borderRadius: 10,
                                  color: '#B0B0B0',
                                  fontSize: 12,
                                  lineHeight: 1.5
                                }}>
                                  <strong style={{ color: req.status === 'approved' ? '#10B981' : '#EF4444' }}>
                                    Commentaire admin :
                                  </strong> {req.admin_comment}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pl-actions">
  {req.status === "pending" && (
    <>
      <button
        className="pl-act-btn pl-act-green"
        onClick={() => openReviewRequestModal(req, "approved")}
      >
        <CheckCircle2 size={14} />
      </button>
      <button
        className="pl-act-btn pl-act-red"
        onClick={() => openReviewRequestModal(req, "rejected")}
      >
        <Ban size={14} />
      </button>
    </>
  )}

  <button
    className="pl-act-btn pl-act-red"
    onClick={() => confirmDeleteRequest(req)}
    title="Supprimer définitivement"
  >
    <Trash2 size={14} />
  </button>
</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {viewMode === "calendar" && (
                <div className="pl-section">
                  <div className="pl-cal-nav">
                    <button
                      className="pl-cal-nav-btn"
                      onClick={() => {
                        setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
                        setSelectedCalendarDay(null);
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div>
                      <div className="pl-cal-month">
                        {calendarDate.toLocaleDateString("fr-FR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <div className="pl-cal-sub">Planning & jours fériés</div>
                    </div>
                    <button
                      className="pl-cal-nav-btn"
                      onClick={() => {
                        setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
                        setSelectedCalendarDay(null);
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <table className="pl-cal-table">
                    <thead>
                      <tr>
                        <th>L</th>
                        <th>M</th>
                        <th>M</th>
                        <th>J</th>
                        <th>V</th>
                        <th>S</th>
                        <th>D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarWeeks.map((week, wi) => (
                        <tr key={`w-${wi}`}>
                          {week.map((cell) => {
                            if (cell.type === "empty") {
                              return <td key={cell.id} className="pl-cal-cell-empty"></td>;
                            }

                            const isToday = cell.date === todayStr;
                            const isSelected = selectedCalendarDay?.date === cell.date;
                            const isWeekend = cell.pDay === 6 || cell.pDay === 7;

                            let cls = "pl-cal-cell";
                            if (isWeekend) cls += " weekend";
                            if (isToday) cls += " today";
                            if (cell.isHoliday) cls += " holiday";
                            if (isSelected) cls += " selected";

                            return (
                              <td key={cell.id}>
                                <div className={cls} onClick={() => setSelectedCalendarDay(isSelected ? null : cell)}>
                                  <div className="pl-cal-cell-top">
                                    <span className="pl-cal-day">{cell.day}</span>
                                    {cell.isHoliday && <span className="pl-cal-holiday-emoji">🎌</span>}
                                  </div>

                                  {cell.isHoliday && (
                                    <div className="pl-cal-holiday-name">{cell.holiday?.name}</div>
                                  )}

                                  {activeTab === "plannings" && cell.schPlannings.length > 0 && (
                                    <div className="pl-cal-chips">
                                      {cell.schPlannings.slice(0, 2).map((p) => (
                                        <div key={p.id} className="pl-cal-chip pl-cal-chip-gold">
                                          {p.name}
                                        </div>
                                      ))}
                                      {cell.schPlannings.length > 2 && (
                                        <div className="pl-cal-more">+{cell.schPlannings.length - 2}</div>
                                      )}
                                    </div>
                                  )}

                                  {activeTab === "personnalises" && cell.actES.length > 0 && (
                                    <div className="pl-cal-chips">
                                      {cell.actES.slice(0, 2).map((es) => (
                                        <div key={es.id} className="pl-cal-chip pl-cal-chip-blue">
                                          {es.employees?.first_name}
                                        </div>
                                      ))}
                                      {cell.actES.length > 2 && (
                                        <div className="pl-cal-more">+{cell.actES.length - 2}</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="pl-cal-legend">
                    <div className="pl-cal-legend-item">
                      <div className="pl-cal-legend-dot" style={{ background: "#F59E0B" }}></div>
                      <span className="pl-cal-legend-text">Aujourd'hui</span>
                    </div>
                    <div className="pl-cal-legend-item">
                      <div className="pl-cal-legend-dot" style={{ background: "#8B5CF6" }}></div>
                      <span className="pl-cal-legend-text">Jour férié</span>
                    </div>
                    <div className="pl-cal-legend-item">
                      <div className="pl-cal-legend-dot" style={{ background: "#6366F1" }}></div>
                      <span className="pl-cal-legend-text">Personnalisé</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COL */}
            <div>
              {viewMode === "calendar" && selectedCalendarDay && (
                <div className="pl-section" style={{ marginBottom: 14 }}>
                  <div className="pl-section-head">
                    <div className="pl-section-head-left">
                      <div className="pl-section-icon" style={{ background: "rgba(245,158,11,0.1)" }}>
                        <CalendarDays size={16} color="#F59E0B" />
                      </div>
                      <h3 className="pl-section-title">
                        {new Date(selectedCalendarDay.date + "T12:00:00Z").toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: "UTC",
                        })}
                      </h3>
                    </div>
                  </div>

                  {selectedCalendarDay.isHoliday && (
                    <div className="pl-holiday-box">
                      <span style={{ fontSize: 16 }}>🎌</span>
                      <div>
                        <div className="pl-holiday-box-title">{selectedCalendarDay.holiday?.name}</div>
                        <div className="pl-holiday-box-sub">Jour férié actif</div>
                      </div>
                    </div>
                  )}

                  <div className="pl-detail-list">
                    {activeTab === "plannings" &&
                      (selectedCalendarDay.schPlannings.length === 0 ? (
                        <div className="pl-empty-mini">Aucun planning ce jour</div>
                      ) : (
                        selectedCalendarDay.schPlannings.map((p) => (
                          <div key={p.id} className="pl-detail-item">
                            <div>
                              <div className="pl-detail-name">{p.name}</div>
                              <div className="pl-detail-meta">
                                {formatTime(p.start_time)} - {formatTime(p.end_time)}
                                {p.has_break && ` • pause ${formatTime(p.break_start)}-${formatTime(p.break_end)}`}
                              </div>
                            </div>
                            {p.is_default && <span className="pl-detail-chip">Défaut</span>}
                          </div>
                        ))
                      ))}

                    {activeTab === "personnalises" &&
                      (selectedCalendarDay.actES.length === 0 ? (
                        <div className="pl-empty-mini">Aucun planning personnalisé</div>
                      ) : (
                        selectedCalendarDay.actES.map((es) => (
                          <div key={es.id} className="pl-detail-item">
                            <div>
                              <div className="pl-detail-name">
                                {es.employees?.first_name} {es.employees?.last_name}
                              </div>
                              <div className="pl-detail-meta">
                                {es.use_custom_hours
                                  ? `${formatTime(es.custom_start_time)} - ${formatTime(es.custom_end_time)}`
                                  : `${es.work_schedules?.name} • ${formatTime(es.work_schedules?.start_time)} - ${formatTime(es.work_schedules?.end_time)}`}
                              </div>
                            </div>
                            <button className="pl-inline-btn" onClick={() => openEmployeeScheduleModal(es)}>
                              <Edit size={12} />
                            </button>
                          </div>
                        ))
                      ))}
                  </div>
                </div>
              )}

              <div className="pl-section" style={{ marginBottom: 14 }}>
                <div className="pl-section-head">
                  <div className="pl-section-head-left">
                    <div className="pl-section-icon" style={{ background: "rgba(139,92,246,0.1)" }}>
                      <AlertTriangle size={16} color="#8B5CF6" />
                    </div>
                    <h3 className="pl-section-title">Jours fériés</h3>
                  </div>
                </div>
                <div className="pl-detail-list">
                  {(() => {
                    const entId =
                      admin?.role === "super_admin"
                        ? selectedEntreprise !== "all"
                          ? selectedEntreprise
                          : null
                        : admin?.selectedEnterprise?.id || admin?.enterprise_id;
                    if (!entId) return <div className="pl-empty-mini">Sélectionnez une entreprise</div>;
                    const hMap = getHolidayMap(entId);
                    const upcoming = [...hMap.values()]
                      .filter((h) => h.date >= todayStr)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 6);
                    if (upcoming.length === 0) return <div className="pl-empty-mini">Aucun jour férié à venir</div>;
                    return upcoming.map((h) => (
                      <div key={h.id} className="pl-detail-item">
                        <div>
                          <div className="pl-detail-name">🎌 {h.name}</div>
                          <div className="pl-detail-meta">
                            {new Date(h.date + "T12:00:00Z").toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              timeZone: "UTC",
                            })}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {activeTab === "personnalises" && (
                <div className="pl-section">
                  <div className="pl-section-head">
                    <div className="pl-section-head-left">
                      <div className="pl-section-icon" style={{ background: "rgba(16,185,129,0.1)" }}>
                        <Users size={16} color="#10B981" />
                      </div>
                      <h3 className="pl-section-title">Sans planning</h3>
                    </div>
                    <span className="pl-badge">{employeesWithoutCustomSchedule.length}</span>
                  </div>
                  <div className="pl-detail-list">
                    {employeesWithoutCustomSchedule.length === 0 ? (
                      <div className="pl-empty-mini">Tous ont un planning</div>
                    ) : (
                      employeesWithoutCustomSchedule.slice(0, 8).map((emp) => (
                        <div key={emp.id} className="pl-detail-item">
                          <div>
                            <div className="pl-detail-name">{emp.first_name} {emp.last_name}</div>
                            <div className="pl-detail-meta">{emp.matricule}</div>
                          </div>
                          <button
                            className="pl-inline-btn"
                            onClick={() => {
                              setEditingEmployeeSchedule(null);
                              setEmployeeScheduleForm({
                                employee_id: emp.id,
                                schedule_id: filteredPlannings[0]?.id || "",
                                use_custom_hours: false,
                                custom_start_time: "08:00",
                                custom_end_time: "17:00",
                                custom_break_start: "12:00",
                                custom_break_end: "13:00",
                                custom_has_break: true,
                                custom_work_days: [1, 2, 3, 4, 5],
                              });
                              setShowEmployeeScheduleModal(true);
                            }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pl-footer">
            <div className="pl-footer-line"></div>
            <p className="pl-footer-text">
              <Calendar size={12} color="#F59E0B" />
              EN-CHECK • Plannings
            </p>
          </div>
        </main>

        {/* MODAL PLANNING */}
        {showModal && (
          <div className="pl-overlay" onClick={() => setShowModal(false)}>
            <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pl-modal-head">
                <div className="pl-modal-head-left">
                  <div className="pl-modal-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
                    {editingPlanning ? <Edit size={20} color="#F59E0B" /> : <Plus size={20} color="#F59E0B" />}
                  </div>
                  <div>
                    <h2 className="pl-modal-title">{editingPlanning ? "Modifier" : "Nouveau planning"}</h2>
                    <span className="pl-modal-sub">Planning entreprise</span>
                  </div>
                </div>
                <button className="pl-close" onClick={() => setShowModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="pl-modal-body">
                {admin?.role === "super_admin" && (
                  <div className="pl-form-group">
                    <label className="pl-label">
                      <Building2 size={13} />
                      Entreprise *
                    </label>
                    <select
                      className="pl-select"
                      value={formData.enterprise_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          enterprise_id: e.target.value,
                        })
                      }
                    >
                      <option value="">-- Sélectionner --</option>
                      {entreprises.map((ent) => (
                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pl-form-group">
                  <label className="pl-label">Nom du planning *</label>
                  <input
                    className="pl-input"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ex: Horaires standard"
                  />
                </div>

                <div className="pl-form-row">
                  <div className="pl-form-group">
                    <label className="pl-label">
                      <Clock size={13} />
                      Arrivée
                    </label>
                    <input
                      className="pl-input"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) =>
                        setFormData({ ...formData, start_time: e.target.value })
                      }
                    />
                  </div>
                  <div className="pl-form-group">
                    <label className="pl-label">
                      <Clock size={13} />
                      Départ
                    </label>
                    <input
                      className="pl-input"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) =>
                        setFormData({ ...formData, end_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="pl-form-group">
                  <label className="pl-check-label">
                    <input
                      type="checkbox"
                      checked={formData.has_break}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          has_break: e.target.checked,
                        })
                      }
                    />
                    <Coffee size={14} color="#F59E0B" />
                    <span>Pause déjeuner</span>
                  </label>
                </div>

                {formData.has_break && (
                  <div className="pl-form-row">
                    <div className="pl-form-group">
                      <label className="pl-label">Début pause</label>
                      <input
                        className="pl-input"
                        type="time"
                        value={formData.break_start}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            break_start: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="pl-form-group">
                      <label className="pl-label">Fin pause</label>
                      <input
                        className="pl-input"
                        type="time"
                        value={formData.break_end}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            break_end: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="pl-form-group">
                  <label className="pl-label">
                    <Calendar size={13} />
                    Jours de travail
                  </label>
                  <div className="pl-days-grid">
                    {joursSemaine.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        className={`pl-day-btn ${formData.work_days.includes(j.id) ? "active-gold" : ""}`}
                        onClick={() => toggleJour(j.id)}
                      >
                        {j.court}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pl-form-group">
                  <label className="pl-label">
                    <AlertCircle size={13} />
                    Tolérance retard (min)
                  </label>
                  <input
                    className="pl-input"
                    type="number"
                    value={formData.late_tolerance_minutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        late_tolerance_minutes: e.target.value,
                      })
                    }
                    min="0"
                    max="120"
                  />
                  <span className="pl-hint">
                    Arrivée tolérée jusqu'à {formData.late_tolerance_minutes} min après.
                  </span>
                </div>

                <div className="pl-form-group">
                  <label className="pl-check-label">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_default: e.target.checked,
                        })
                      }
                    />
                    <Zap size={14} color="#F59E0B" />
                    <span>Planning par défaut</span>
                  </label>
                </div>
              </div>
              <div className="pl-modal-foot">
                <button className="pl-cancel-btn" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button className="pl-save-btn" onClick={handleSave}>
                  <Save size={15} />
                  {editingPlanning ? "Modifier" : "Créer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EMPLOYEE SCHEDULE */}
        {showEmployeeScheduleModal && (
          <div className="pl-overlay" onClick={() => setShowEmployeeScheduleModal(false)}>
            <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pl-modal-head">
                <div className="pl-modal-head-left">
                  <div className="pl-modal-icon" style={{ background: "rgba(99,102,241,0.12)" }}>
                    <User size={20} color="#6366F1" />
                  </div>
                  <div>
                    <h2 className="pl-modal-title">
                      {editingEmployeeSchedule ? "Modifier" : "Attribuer un planning"}
                    </h2>
                    <span className="pl-modal-sub">Planning personnalisé</span>
                  </div>
                </div>
                <button className="pl-close" onClick={() => setShowEmployeeScheduleModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="pl-modal-body">
                <div className="pl-form-group">
                  <label className="pl-label">
                    <Users size={13} />
                    Employé *
                  </label>
                  <select
                    className="pl-select"
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

                <div className="pl-form-group">
                  <label className="pl-check-label">
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
                    <Shield size={14} color="#6366F1" />
                    <span>Horaires personnalisés</span>
                  </label>
                </div>

                {!employeeScheduleForm.use_custom_hours ? (
                  <div className="pl-form-group">
                    <label className="pl-label">
                      <Briefcase size={13} />
                      Planning *
                    </label>
                    <select
                      className="pl-select"
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
                          {p.name} • {formatTime(p.start_time)}-{formatTime(p.end_time)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="pl-form-row">
                      <div className="pl-form-group">
                        <label className="pl-label">Arrivée</label>
                        <input
                          className="pl-input"
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
                      <div className="pl-form-group">
                        <label className="pl-label">Départ</label>
                        <input
                          className="pl-input"
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

                    <div className="pl-form-group">
                      <label className="pl-check-label">
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
                        <span>Pause</span>
                      </label>
                    </div>

                    {employeeScheduleForm.custom_has_break && (
                      <div className="pl-form-row">
                        <div className="pl-form-group">
                          <label className="pl-label">Début pause</label>
                          <input
                            className="pl-input"
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
                        <div className="pl-form-group">
                          <label className="pl-label">Fin pause</label>
                          <input
                            className="pl-input"
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

                    <div className="pl-form-group">
                      <label className="pl-label">Jours de travail</label>
                      <div className="pl-days-grid">
                        {joursSemaine.map((j) => (
                          <button
                            key={j.id}
                            type="button"
                            className={`pl-day-btn ${employeeScheduleForm.custom_work_days.includes(j.id) ? "active-blue" : ""}`}
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
              <div className="pl-modal-foot">
                <button className="pl-cancel-btn" onClick={() => setShowEmployeeScheduleModal(false)}>
                  Annuler
                </button>
                <button className="pl-save-btn pl-save-btn-blue" onClick={handleSaveEmployeeSchedule}>
                  <Save size={15} />
                  {editingEmployeeSchedule ? "Modifier" : "Attribuer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL REVIEW REQUEST */}
        {showReviewRequestModal && selectedRequest && (
          <div className="pl-overlay" onClick={() => !reviewingRequest && setShowReviewRequestModal(false)}>
            <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pl-modal-head">
                <div className="pl-modal-head-left">
                  <div
                    className="pl-modal-icon"
                    style={{
                      background: reviewAction === "approved"
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(239,68,68,0.12)"
                    }}
                  >
                    {reviewAction === "approved"
                      ? <CheckCircle2 size={20} color="#10B981" />
                      : <Ban size={20} color="#EF4444" />
                    }
                  </div>
                  <div>
                    <h2 className="pl-modal-title">
                      {reviewAction === "approved" ? "Approuver la demande" : "Refuser la demande"}
                    </h2>
                    <span className="pl-modal-sub">
                      {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name}
                    </span>
                  </div>
                </div>
                <button className="pl-close" onClick={() => setShowReviewRequestModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="pl-modal-body">
                <div className="pl-detail-list">
                  <div className="pl-detail-item">
                    <div>
                      <div className="pl-detail-name">Employé</div>
                      <div className="pl-detail-meta">
                        {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name} ({selectedRequest.employees?.matricule})
                      </div>
                    </div>
                  </div>

                  <div className="pl-detail-item">
                    <div>
                      <div className="pl-detail-name">Type de demande</div>
                      <div className="pl-detail-meta">
                        {selectedRequest.use_custom_hours ? "Horaires personnalisés" : "Changement de planning"}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.use_custom_hours ? (
                    <>
                      <div className="pl-detail-item">
                        <div>
                          <div className="pl-detail-name">Horaires demandés</div>
                          <div className="pl-detail-meta">
                            {formatTime(selectedRequest.requested_start_time)} - {formatTime(selectedRequest.requested_end_time)}
                          </div>
                        </div>
                      </div>

                      {selectedRequest.requested_has_break && (
                        <div className="pl-detail-item">
                          <div>
                            <div className="pl-detail-name">Pause demandée</div>
                            <div className="pl-detail-meta">
                              {formatTime(selectedRequest.requested_break_start)} - {formatTime(selectedRequest.requested_break_end)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pl-detail-item">
                        <div>
                          <div className="pl-detail-name">Jours demandés</div>
                          <div className="pl-detail-meta">
                            {formatWorkDays(selectedRequest.requested_work_days)}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="pl-detail-item">
                      <div>
                        <div className="pl-detail-name">Planning demandé</div>
                        <div className="pl-detail-meta">
                          {selectedRequest.requested_schedule?.name || "Planning sélectionné"}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRequest.reason && (
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      color: '#CCC',
                      fontSize: 13,
                      lineHeight: 1.5
                    }}>
                      <strong style={{ color: '#FFF' }}>Motif :</strong> {selectedRequest.reason}
                    </div>
                  )}
                </div>

                <div className="pl-form-group">
                  <label className="pl-label">
                    <MessageSquare size={13} />
                    Commentaire administrateur (optionnel)
                  </label>
                  <textarea
                    className="pl-input"
                    style={{ minHeight: 90, resize: "vertical" }}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={
                      reviewAction === "approved"
                        ? "Ex: Demande approuvée, mise en place à compter de lundi."
                        : "Ex: Demande refusée pour raison d’organisation."
                    }
                  />
                </div>
              </div>

              <div className="pl-modal-foot">
                <button className="pl-cancel-btn" onClick={() => setShowReviewRequestModal(false)}>
                  Annuler
                </button>
                <button
                  className={reviewAction === "approved" ? "pl-save-btn pl-save-btn-green" : "pl-save-btn pl-save-btn-red"}
                  onClick={handleReviewRequest}
                  disabled={reviewingRequest}
                >
                  <Send size={15} />
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

        {/* MODAL DELETE */}
        {showDeleteModal && planningToDelete && (
          <div className="pl-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="pl-confirm" onClick={(e) => e.stopPropagation()}>
              <div className="pl-confirm-icon">
                <AlertTriangle size={28} color="#EF4444" />
              </div>
              <h3>Supprimer ce planning ?</h3>
              <p>
                <strong>"{planningToDelete.name}"</strong>
                <br />
                Cette action est irréversible.
              </p>
              <div className="pl-confirm-actions">
                <button
                  className="pl-cancel-btn"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPlanningToDelete(null);
                  }}
                >
                  Annuler
                </button>
                <button className="pl-delete-btn" onClick={handleDelete}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}


        {showDeleteRequestModal && requestToDelete && (
  <div className="pl-overlay" onClick={() => setShowDeleteRequestModal(false)}>
    <div className="pl-confirm" onClick={(e) => e.stopPropagation()}>
      <div className="pl-confirm-icon">
        <AlertTriangle size={28} color="#EF4444" />
      </div>
      <h3>Supprimer cette demande ?</h3>
      <p>
        <strong>
          {requestToDelete.employees?.first_name} {requestToDelete.employees?.last_name}
        </strong>
        <br />
        Cette demande sera définitivement supprimée.
      </p>
      <div className="pl-confirm-actions">
        <button
          className="pl-cancel-btn"
          onClick={() => {
            setShowDeleteRequestModal(false)
            setRequestToDelete(null)
          }}
        >
          Annuler
        </button>
        <button className="pl-delete-btn" onClick={handleDeleteRequest}>
          Supprimer
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </>
  );
}