import PageCulturalBand from "../components/PageCulturalBand";
import PlanningPayslipBadge from "../components/PlanningPayslipBadge";
import usePlanningPayslips, { payslipsForDay } from "../hooks/usePlanningPayslips";
import useDirectPointages from "../hooks/useDirectPointages";
import { presenterEtat } from "../utils/directPointages";
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
import {
  normaliserHeure,
  normaliserTeinte,
  carteDeTeintes,
  causeRejetBase,
} from "../services/ecritureHorairesEmploye";
import FeatureService from "../services/featureService";
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
  ChevronDown,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardPaste,
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
  Palette,
  Layers,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  decrireModele,
  libelleModele,
  paquetDepuisModele,
  raccourciPressePapiers,
} from "../lib/planningCopie";
import MotifsAbsenceService, { resoudreMotif } from "../services/motifsAbsenceService";
import { MOTIFS_PAR_DEFAUT, getMotifConfig } from "../constants/motifsAbsence";
import ChoixPeriode from "../components/ChoixPeriode";
import { getTeamsPourPlanning } from "../services/teamService";
import {
  cleEquipeFormee,
  equipeParEmploye,
  groupeDeLEmploye,
  SANS_EQUIPE,
} from "../lib/planningEquipes";
import "./PlanningAfroTech.css";
import "./PlanningPostIt.css";
// LA COQUE, EMPRUNTÉE — pas recopiée : le composant partagé qui met la barre à
// gauche et la page à droite, et LA barre unique de l'application (rail
// d'icônes + registre qui se referme par paliers). Le Planning a retiré de son
// bandeau le sélecteur d'entreprise, le voyage « Aller à » et le bouton de
// thème le 22/11 EN PROMETTANT que le rail les fait ; le rail, ici, n'avait
// jamais été branché. Il l'est à la même adresse que sur la page Employés.
import CoqueAdmin from "../components/coque/CoqueAdmin";
import SidebarUnique from "../components/SidebarUnique";
import { sectionsNavAdmin } from "../components/coque/sectionsNavAdmin";

const OVERRIDES_STORAGE_KEY = "encheck_planning_day_overrides_v1";
const CUSTOM_MODELS_STORAGE_KEY = "encheck_planning_custom_models_v1";
const AVAILABILITY_STORAGE_KEY = "encheck_planning_availability_v1";
// DEUX PORTÉES, DEUX ADRESSES. Le 22/11, le fondateur a dû le redire : « chaque
// case doit avoir sa propre couleur qu'on choisit, et non appliquer la couleur
// choisie à toutes les cases sur la même ligne ». La teinte d'UNE case se range
// sous sa DATE, et voyage jusqu'à `custom_day_colors` en base ; celle de l'horaire
// entier, choisie depuis la LIGNE, reste sous cette clé sentinelle — jamais sous
// une date, pour ne jamais être confondue avec une case, et jamais l'inverse. Une
// case qui a choisi la sienne ne se laisse pas repeindre par la ligne : c'est
// l'ordre de lecture de `resolveCellShift`. Les `couleur-horaire` écrits par le
// vieux code depuis une case sont jetés au montage (voir le nettoyage de
// `dayOverrides`) : ils ne racontent plus la même chose.
const COULEUR_HORAIRE_CLE = "couleur-horaire";
const TEAMS_STORAGE_KEY = "encheck_planning_teams_v1";
const TEAM_ASSIGNMENTS_STORAGE_KEY = "encheck_planning_team_assignments_v1";
const MONTH_MODELS_STORAGE_KEY = "encheck_planning_month_models_v1";

// Ce que le planning sait recoudre sans tout reprendre : les pointages. Liste en
// constante de module parce que le crochet temps réel compare ce tableau par
// identité — un littéral dans le composant signifierait « nouveaux abonnements à
// chaque rendu », donc reconnexion à chaque frappe.
const TABLES_DU_PLANNING = ["attendances"];

// Les colonnes ne sont écrites qu'ici : la grande reprise de `loadData` et la
// reprise en second plan du temps réel doivent ramener la MÊME ligne, sinon le
// moteur de résolution prend une colonne manquante pour un pointage absent.
const COLONNES_POINTAGES =
  "id, employee_id, enterprise_id, check_time, check_type, method, is_auto_closed, anomalie, estimation_source_id, estimation_validee_le, estimation_remplacee_le, estimation_niveau, estimation_confiance, notes, modifie_le, modifie_par, created_at, origine, decision_raison, modifie_par_employe, suspect, suspect_reason";
const COLLAPSED_GROUPS_STORAGE_KEY = "encheck_planning_teams_collapsed_v1";
const GROUPS_ORDER_STORAGE_KEY = "encheck_planning_teams_ordre_v1";

// Raccourcis En-Check : rejoindre les autres modules sans repasser par le Dashboard
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

// La teinte de départ d'une fenêtre n'est pas un hexa de plus dans le code : c'est la
// première peinture de la palette, celle que le premier carré montre déjà.
const TEINTE_PAR_DEFAUT = ENCHECK_COLOR_PALETTE[0].value;

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
// Les cinq teintes de la légende sont CELLES des modèles du dock, lues à la
// source. Un modèle qui change de teinte change donc aussi dans la légende —
// les recalquer à la main dans le rendu, c'est déjà arrivé, et la légende avait
// survécu à deux changements de palette sans bouger d'un cheveu : une légende
// qui ne raconte plus la grille est un mensonge de couleur.
const LEGENDE_TEINTES = [
  { cle: "tpl-matin", mot: "Horaire" },
  { cle: "tpl-garde", mot: "Garde" },
  { cle: "tpl-nuit", mot: "Nuit" },
  { cle: "tpl-pause", mot: "Pause" },
  { cle: "tpl-repos", mot: "Congé / Repos" },
].map(({ cle, mot }) => ({
  cle,
  mot,
  teinte: DEFAULT_DOCK_TEMPLATES.find((modele) => modele.id === cle)?.color ?? null,
}));


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

// Le filtre « Afficher » : toute l'équipe, une barre (ses membres exacts) ou une personne.
const correspondAuFocus = (employe, focus, membresDuGroupe) => {
  if (focus?.type === "team") return Boolean(membresDuGroupe?.has(employe?.id));
  if (focus?.type === "employee") return employe?.id === focus.value;
  return true;
};

export default function Planning() {
  // SEUL `darkMode` est demandé ici : le bandeau n'a plus de bouton de thème
  // (c'est un choix de l'application, pas d'une page) — la page continue de le
  // suivre, son `data-theme` se pose toujours sur la racine.
  // `toggleTheme` est demandé depuis que le rail est là : le bouton clair /
  // sombre vit dans la barre, une seule fois pour toute l'application — le
  // bandeau de la page, lui, n'a jamais eu à le porter.
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [plannings, setPlannings] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [entreprises, setEntreprises] = useState([]);
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [absences, setAbsences] = useState([]);
  // Motifs d'absence de l'entreprise : mêmes couleurs et emojis que la page Absences
  const [motifs, setMotifs] = useState(MOTIFS_PAR_DEFAUT);
  // Pointages réellement effectués (table attendances) pour comparer prévu / réalisé
  const [attendances, setAttendances] = useState([]);
  // Seuils de pointage et grilles horaires par entreprise (même moteur que Pointages)
  const [seuilsByEnterprise, setSeuilsByEnterprise] = useState({});
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  // « les données repartent, ce n'est pas la première feuille » : le bandeau le
  // dit, la grille ne se démonte pas.
  const [rechargement, setRechargement] = useState(false);
  const { minLoadingDone, skipLoading } = useLoadingMinimum();

  // Filtre de focus : totaux et grille liés au groupe ou au collaborateur sélectionné
  const [focusFilter, setFocusFilter] = useState({ type: "all", value: null });
  // La barre de filtres et de légende se replie : le planning garde la
  // place pour la grille. Le choix est retenu d'une visite à l'autre.
  const [legendeOuverte, setLegendeOuverte] = useState(() => {
    try {
      return localStorage.getItem("planning_legende_ouverte") !== "false";
    } catch {
      return true;
    }
  });
  const basculerLegende = () => {
    const suite = !legendeOuverte;
    setLegendeOuverte(suite);
    try {
      localStorage.setItem("planning_legende_ouverte", String(suite));
    } catch {
      // Un navigateur qui refuse le stockage ne bloque pas le repli.
    }
  };

  // Vues En-Check : "semaine" (défaut) | "mois" | "jour" | "demandes"
  const [planningView, setPlanningView] = useState("semaine");
  const [dockOpen, setDockOpen] = useState(true);
  // État plié / déplié de chaque équipe, sauvegardé d'une visite à l'autre
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readStorage(COLLAPSED_GROUPS_STORAGE_KEY, {})
  );
  // L'ordre des équipes, tel que le fondateur le range à la main (08/12) : une
  // liste de clés, dans l'ordre voulu. Rien d'autre — la place de chaque ligne
  // se relit là, et nulle part ailleurs.
  const [ordreEquipes, setOrdreEquipes] = useState(() =>
    readStorage(GROUPS_ORDER_STORAGE_KEY, [])
  );
  const [selectedEntreprise, setSelectedEntreprise] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // Le glisser d'ÉQUIPE à ÉQUIPE (08/12) : `equipeGlissee` est la ligne qu'on
  // tient, `equipeCible` celle qu'on survole — de la peinture, pas de la donnée.
  const [equipeGlissee, setEquipeGlissee] = useState(null);
  const [equipeCible, setEquipeCible] = useState(null);

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
      const lu = raw ? JSON.parse(raw) : {};
      // NETTOYAGE UNE FOIS. Avant le 22/11, la teinte demandée sur UNE case était
      // rangée sous la clé de la ligne entière : le brouillon local suffisait donc
      // à peindre les sept jours, et c'est exactement ce débordement que le
      // fondateur reproche. Cette clé ne veut plus dire aujourd'hui que « teinte de
      // la ligne, choisie depuis la ligne » — on jette donc ce que le vieux code y
      // a laissé. Rien n'est inventé à la place : la case se recolorie en un clic,
      // et part dans sa colonne.
      const nettoye = {};
      for (const [cle, surcharges] of Object.entries(lu || {})) {
        if (!surcharges || typeof surcharges !== "object") continue;
        const reste = { ...surcharges };
        delete reste[COULEUR_HORAIRE_CLE];
        if (Object.keys(reste).length > 0) nettoye[cle] = reste;
      }
      return nettoye;
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

  // ═══ ÉQUIPES FORMÉES DANS EMPLOYÉS → ÉQUIPES (tables teams / team_members) ═══
  // Elles ne remplacent pas les équipes locales : elles passent devant.
  const [equipesFormees, setEquipesFormees] = useState([]);
  const equipesCleRef = useRef("");

  // ═══ DISPONIBILITÉS COLLABORATEURS (aujourd'hui / cette semaine / jour précis) ═══
  const [availability, setAvailability] = useState(() =>
    readStorage(AVAILABILITY_STORAGE_KEY, {})
  );
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityTarget, setAvailabilityTarget] = useState(null);

  // LA CASE VIDE N'ORDONNE RIEN, ELLE PROPOSE (08/12) : { emp, dayItem }.
  const [caseVide, setCaseVide] = useState(null);

  // Le clic sur une case du mois (23/11). Une case du mois n'est pas une case
  // d'employé : c'est une JOURNÉE, avec un à N rangs. Sans intermédiaire, le clic
  // ne pouvait qu'ouvrir la journée (l'ancien comportement) ou mentir sur la
  // personne visée. Cet état ouvre le « qui ? », et rien d'autre.
  const [choixJour, setChoixJour] = useState(null); // { cell, dayNum }

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
    custom_color: TEINTE_PAR_DEFAUT,
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
    writeStorage(GROUPS_ORDER_STORAGE_KEY, ordreEquipes);
  }, [ordreEquipes]);

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

  // LA FENÊTRE RENDUE, calculée à un seul endroit (23/11). Elle vivait au
  // milieu de `loadData`, ce qui rendait impossible de répondre AVANT de relancer
  // sept requêtes à la seule question qui vaille : « la période a-t-elle changé ? ».
  // Les bornes restent l'union de la semaine et du mois — ce n'est pas une
  // nouvelle fenêtre, c'est la même, écrite une fois.
  const fenetreAffichee = useMemo(() => {
    const annee = calendarDate.getFullYear();
    const mois = calendarDate.getMonth();
    const debutMois = new Date(annee, mois, 1);
    const finMois = new Date(annee, mois, getDaysInMonth(annee, mois));
    const debutSemaine = getStartOfWeekMonday(calendarDate);
    const finSemaine = new Date(debutSemaine);
    finSemaine.setDate(finSemaine.getDate() + 6);
    const debut = new Date(Math.min(debutSemaine.getTime(), debutMois.getTime()));
    const fin = new Date(Math.max(finSemaine.getTime(), finMois.getTime()));
    const debutISO = toIsoDateLocal(debut);
    const finISO = toIsoDateLocal(fin);
    // « même fenêtre » veut dire mêmes bornes, pas même curseur : la clé est ce
    // que l'effet regarde, et elle serait fausse déduite d'autre chose.
    return { debutISO, finISO, cle: `${debutISO}|${finISO}` };
  }, [calendarDate]);

  // Les pointages d'une fenêtre, pour une liste d'employés. Deux appelants, une
  // écriture : `loadData`, et la reprise en second plan déclenchée par le canal —
  // qui ne doit surtout pas demander d'autres colonnes que la première.
  const chargerPointages = async (idsEmployes) => {
    if (!idsEmployes || idsEmployes.length === 0) return [];
    const { data, error } = await supabase
      .from("attendances")
      .select(COLONNES_POINTAGES)
      .in("employee_id", idsEmployes)
      .gte("check_time", `${fenetreAffichee.debutISO}T00:00:00`)
      .lte("check_time", `${fenetreAffichee.finISO}T23:59:59`)
      .order("check_time", { ascending: true });
    if (error) throw error;
    return data || [];
  };

  const loadData = async (adminData, { enFond = false } = {}) => {
    // LE PLEIN ÉCRAN N'EST QUE POUR LA PREMIÈRE FEUILLE (23/11). Remettre
    // `loading` à vrai à chaque sauvegarde avait deux effets que personne ne
    // voulait : l'écran de chargement est un `return` anticipé, il démontait le
    // modal ouvert au clic sous les yeux du fondateur ; et chaque écriture coûtait
    // sept requêtes avec disparition de la grille. En second plan la grille reste
    // en place, le bandeau dit la reprise, le modal survit à son propre
    // enregistrement.
    //
    // Ce que l'APPELANT décide, et rien d'autre : écrire « si on est déjà en
    // train de charger » aurait fait basculer une vraie première feuille en
    // second plan dès que `loading` est rouge — le plein écran disparaissait au
    // changement d'entreprise, ce qui n'était demandé par personne.
    if (enFond) setRechargement(true);
    else setLoading(true);
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

      // Les équipes formées dans Employés → Équipes : ce sont elles que le
      // filtre du planning propose en premier. Deux requêtes, quel que soit
      // le nombre d'entreprises ; on ne les relit que si le périmètre change.
      const idsEquipes = (
        isSuperAdmin
          ? selectedEntreprise !== "all"
            ? [selectedEntreprise]
            : (entreprisesData || []).map((e) => e.id)
          : [enterpriseId]
      ).filter(Boolean);
      const cleEquipes = idsEquipes.slice().sort().join("|");
      if (cleEquipes !== equipesCleRef.current) {
        const { data: equipesData } = await getTeamsPourPlanning(idsEquipes);
        setEquipesFormees(equipesData || []);
        equipesCleRef.current = cleEquipes;
      }

      const employeeIds = (employeesData || []).map((e) => e.id);
      idsPointagesRef.current = employeeIds;

      if (employeeIds.length > 0) {
        const { data: esData } = await supabase
          .from("employee_schedules")
          .select(
            "*, employees(id, first_name, last_name, matricule, enterprise_id, department, position, photo_url), work_schedules(id, name, start_time, end_time, break_start, break_end, has_break, work_days, late_tolerance_minutes)"
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
          employees(id, first_name, last_name, matricule, enterprise_id, department, position, photo_url),
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

      // Les motifs de CHAQUE entreprise visible : en vue « Toutes entreprises »
      // une absence doit garder l'emoji choisi par sa propre maison
      try {
        const motifsMaison = await MotifsAbsenceService.listerTout();
        if (motifsMaison && motifsMaison.length > 0) setMotifs(motifsMaison);
      } catch (err) {
        // La base ne répond pas : on garde les 7 motifs d'origine
        console.error("[planning] motifs indisponibles", err);
      }

      // Les pointages de la période. Les bornes ne se recalculent plus ici :
      // c'est `fenetreAffichee`, la même pour la reprise complète et pour celle du
      // direct. Sept lignes de dates recopiées à cet endroit, c'est deux fenêtres
      // qui peuvent cesser d'être la même — et la seconde n'aurait aucun témoin.
      setAttendances(await chargerPointages(employeeIds));

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
    setRechargement(false);
  };

  // LA REPRISE DÉPEND DE LA PÉRIODE, PAS DU CURSEUR. C'était `calendarDate` :
  // choisir un jour du mois déjà chargé, ou poser un modèle sur une case,
  // repartait pour sept requêtes alors que les bornes demandées étaient
  // identiques. Passer à la semaine d'à côté change `cle` (l'union semaine/mois
  // se déplace) et reprend bien ; cliquer dans le mois ne la change plus.
  useEffect(() => {
    if (admin) loadData(admin);
  }, [selectedEntreprise, fenetreAffichee.cle]);

  // ── LE PLANNING EN DIRECT (23/11) ─────────────────────────────
  // « Pourquoi le planning ne montre pas les pointages en temps réel ? » : parce
  // qu'il ne regardait rien. Les « 8h », « oubli de sortie », « en cours » sont
  // lus dans un instantané pris au dernier `loadData`.
  //
  // Un canal dit « une ligne a bougé » ; on redemande les pointages de la période
  // — UNE requête — et rien d'autre ne bouge. Le crochet, lui, apporte ce que la
  // page Pointages a appris à la dure : un canal PAR table (une table non publiée
  // faisait refuser le canal entier), le statut ÉCOUTÉ (un `.subscribe()` muet
  // rend l'incident invisible), les tentatives qui s'espacent, et la reprise au
  // retour de l'onglet comme au retour du réseau — la cause n°1 des « il faut que
  // je recharge » est là, pas dans les données.
  const idsPointagesRef = useRef([]);
  const rafraichirPointages = async () => {
    if (idsPointagesRef.current.length === 0) return;
    setRechargement(true);
    try {
      setAttendances(await chargerPointages(idsPointagesRef.current));
    } catch (eReel) {
      // Le direct est tombé : la grille garde ce qu'elle avait, et le bandeau
      // porte l'état du canal. Un « Erreur lors du chargement » toutes les
      // trente secondes pendant une coupure serait pire que le silence.
      console.error("[planning] reprise des pointages impossible", eReel);
    }
    setRechargement(false);
  };
  const { etat: etatDirect } = useDirectPointages({
    enterpriseId: selectedEntreprise,
    onChangement: rafraichirPointages,
    actif: Boolean(admin),
    tables: TABLES_DU_PLANNING,
  });

  const formatTime = (t) => (t ? t.slice(0, 5) : "--:--");

  // Le sous-titre d'un modèle : les heures, la pause, le repos, et d'où il vient.
  // La bande du dock et la fenêtre de la case vide l'affichent TOUS LES DEUX —
  // écrit une fois ici, pas recopié là (deux copies, c'est l'une des deux qui
  // ment le jour où on ajoute un type de brique).
  const soustitreModele = (tpl) => {
    const coeur =
      tpl.kind === "rest"
        ? "Repos"
        : tpl.kind === "leave"
          ? "Congé / Absence"
          : tpl.kind === "break_only"
            ? `Pause ${formatTime(tpl.break_start)}-${formatTime(tpl.break_end)}`
            : `${formatTime(tpl.start_time)} - ${formatTime(tpl.end_time)}`;
    return (
      coeur +
      (tpl.isCustom ? " · Modèle En-Check" : "") +
      (tpl.kind === "work_schedule" ? " · Horaires entreprise" : "")
    );
  };

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

  // LA FILE, DANS L'ORDRE OÙ ELLE SE TRAITE. La requête arrivait triée par dépôt
  // décroissant : une demande en attente depuis huit mois tombait en bas de page,
  // derrière trois refus de la semaine. Ici : d'abord ce qui ATTEND, le plus
  // ancien en tête (c'est celui qui bloque depuis le plus longtemps), puis ce qui
  // est décidé, de la décision la plus récente à la plus ancienne.
  const visibleRequests = useMemo(() => {
    const choisies =
      requestFilter === "all"
        ? filteredRequests
        : filteredRequests.filter((r) => (r.status || "pending") === requestFilter);
    const depot = (r) => new Date(r.created_at || 0).getTime();
    const decision = (r) => new Date(r.reviewed_at || r.created_at || 0).getTime();
    return [...choisies].sort((a, b) => {
      const attenteA = (a.status || "pending") === "pending" ? 0 : 1;
      const attenteB = (b.status || "pending") === "pending" ? 0 : 1;
      if (attenteA !== attenteB) return attenteA - attenteB;
      return attenteA === 0 ? depot(a) - depot(b) : decision(b) - decision(a);
    });
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

  // ═══ COPIER / COLLER UN MODÈLE ═══
  // Le modèle copié reste en mémoire de la page : un clic sur « Copier »,
  // ou Ctrl/⌘+C sur un modèle, puis « Coller » dans une case ou Ctrl/⌘+V.
  const [modeleCopie, setModeleCopie] = useState(null);
  const [caseCible, setCaseCible] = useState(null);
  const modeleActifRef = useRef(null);

  const copierModele = (tpl) => {
    if (!tpl) return;
    modeleActifRef.current = tpl;
    setModeleCopie({ template: tpl, libelle: libelleModele(tpl) });
    toast.success(
      `« ${libelleModele(tpl)} » copié — collez-le dans une case (Ctrl+V ou « Coller »).`
    );
  };

  const oublierModeleCopie = () => {
    setModeleCopie(null);
    setCaseCible(null);
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
    handleDropOnCell({ preventDefault: () => {}, altKey: false }, emp, dayItem, payload);
    clearTouchDrag();
    return true;
  };

  // Poser un modèle choisi DANS LA FENÊTRE DE LA CASE (08/12) : le même chemin
  // que la brique glissée — un payload `{ sourceType: "dock", template }` et
  // `handleDropOnCell`, qui tient déjà le repos, le congé, la pause autonome,
  // la surcharge d'horaire, le compteur de modifications et le toast. Réécrire
  // une application ici aurait fait DEUX règles de pose : celle du glisser et
  // celle du clic, et l'une des deux aurait fini par mentir.
  const poserModeleSurLaCase = (tpl) => {
    if (!caseVide) return;
    const { emp, dayItem } = caseVide;
    setCaseVide(null);
    handleDropOnCell({ preventDefault: () => {}, altKey: false }, emp, dayItem, {
      sourceType: "dock",
      template: tpl,
    });
  };

  // Application du modèle sélectionné au doigt sur une case du calendrier (Mois)
  const applyTouchDropOnDay = (dateStr) => {
    if (!touchDragPayload) return false;
    const payload = touchDragPayload;
    setDraggedPayload(payload);
    handleDropOnCalendarDay({ preventDefault: () => {} }, dateStr, payload);
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

  // Le libellé de période s'ouvre, comme sur la page Absences
  const [periodeOuverte, setPeriodeOuverte] = useState(false)
  const jourSelPlanning = toIsoDateLocal(calendarDate)

  const allerADate = (iso) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (y && m && d) setCalendarDate(new Date(y, m - 1, d));
    setPeriodeOuverte(false);
  };

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
  // Trois sources, dans cet ordre : l'équipe formée dans Employés → Équipes,
  // l'affectation faite ici même, puis le département de la fiche employé.
  // Les collaborateurs sans aucune des trois vont dans "SANS ÉQUIPE".
  const equipesParEmploye = useMemo(() => equipeParEmploye(equipesFormees), [equipesFormees]);



  const openNewTeamModal = () => {
    setEditingTeam(null);
    setTeamForm({ name: "", memberIds: [] });
    setShowTeamModal(true);
  };

  const openEditTeamModal = (cleGroupe, titreGroupe) => {
    // On repart de la barre elle-même : une équipe locale « RECETTE » ne doit
    // pas embarquer les personnes d'un département homonyme.
    const members = filteredEmployees
      .filter(
        (emp) =>
          groupeDeLEmploye(emp, {
            equipeParEmploye: equipesParEmploye,
            affectations: teamAssignments,
          }).cle === cleGroupe
      )
      .map((emp) => emp.id);
    setEditingTeam({ name: titreGroupe });
    setTeamForm({ name: titreGroupe, memberIds: members });
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
  const handleDropOnCalendarDay = (e, dateStr, payloadExplicite = null) => {
    e.preventDefault();
    setMonthDropDate(null);
    const payload = payloadExplicite || draggedPayload || touchDragPayload;
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
    if (focusFilter.type === "team") return focusFilter.label || focusFilter.value;
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

  /**
   * Un code d'absence (« conge ») devient le motif de l'ENTREPRISE de
   * l'absence : on prend sa copie personnalisée, sinon le motif d'origine.
   * Sans ça, la vue « Toutes entreprises » affichait les emojis d'origine
   * et les réglages du client semblaient sans effet au planning.
   */
  const motifDe = (absence) =>
    resoudreMotif(motifs, absence) ||
    getMotifConfig(typeof absence === "string" ? absence : absence?.reason);

  // ═══ RÉSOLUTION DU SHIFT D'UN EMPLOYÉ SUR UN JOUR DONNÉ ═══
  const resolveCellShift = (emp, dayItem) => {
    const { dateStr, dayNum } = dayItem;
    const empOverrides = dayOverrides[emp.id] || {};
    const override = empOverrides[dateStr] ?? empOverrides[`day-${dayNum}`];

    // DEUX PORTÉES, DEUX ENDROITS, ET UN ORDRE. La ligne de base du collaborateur
    // porte la teinte de l'horaire entier (`custom_color`) et, à côté, la carte des
    // teintes choisies jour par jour (`custom_day_colors`). L'ordre de lecture EST
    // la correction : la case (brouillon local, puis base) avant la ligne (base,
    // puis brouillon local). Une teinte de ligne qui descendrait sur une case
    // ayant déjà choisi la sienne, c'est exactement le débordement reproché le
    // 22/11 — « chaque case doit avoir sa propre couleur qu'on choisit, et non
    // appliquer la couleur choisie à toutes les cases sur la même ligne ».
    const es = employeeSchedules.find(
      (row) => row.employee_id === emp.id && row.is_active !== false
    );
    const teinteDeLaCase =
      override?.color ||
      es?.custom_day_colors?.[dateStr] ||
      es?.custom_day_colors?.[`day-${dayNum}`];
    const teinte =
      teinteDeLaCase ||
      es?.custom_color ||
      empOverrides[COULEUR_HORAIRE_CLE]?.color ||
      undefined;

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
      // Une case surchargée garde LA SIENNE. Elle ne prend la teinte de la ligne
      // que si elle n'en a jamais choisi — c'est précisément ce débordement qui a
      // fait dire au fondateur « non, pas à toutes les cases de la ligne ».
      return {
        ...override,
        color: teinte,
      };
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
      const motifAbs = motifDe(empAbs);
      return {
        // La ligne forte de la case : l'emoji du motif, comme dans le calendrier des absences
        name: `${motifAbs.emoji} ${motifAbs.label}`,
        start_time: "Congé",
        end_time: motifAbs.label || "Absence",
        has_break: false,
        variant: "conge",
        isAbsence: true,
        motifColor: motifAbs.color,
        label: `${motifAbs.emoji} ${motifAbs.label}`,
      };
    }

    // Option Planning non souscrite par l'entreprise : aucun horaire affiché
    if (!isPlanningModuleEnabled(emp)) return null;

    // Planning personnalisé de l'employé (employee_schedules) — `es` est déjà lu
    // en tête de fonction, pour que les deux teintes y soient relues une seule fois
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
          // `teinte`, calculé en tête de fonction : la case d'abord, la ligne
          // ensuite. Jamais l'inverse.
          color: teinte,
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
          // un modèle d'entreprise teinté jour par jour, même règle qu'au-dessus :
          // la case a la parole avant la ligne
          color: teinte,
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
        // un collaborateur sans ligne `employee_schedules` n'est pas pour autant
        // aveugle à la couleur : sa case peut avoir choisi la sienne
        color: teinte,
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

      // LES QUATRE HEURES, CONTRÔLÉES ICI AUSSI (23/11). Ce payload-là ne vient
      // pas d'un champ du formulaire mais du MODÈLE déposé — un modèle d'avant la
      // contrainte de format, ou une brique d'entreprise dont l'horaire a été
      // rangé à la main. `(valeur || "08:00").slice(0, 5) + ":00"` laissait donc
      // passer n'importe quoi de jusqu'à cinq caractères, et l'`upsert`
      // répondait 22007 — un 400 de plus, sur un geste qui n'avait rien de
      // suspect. La règle est la même que dans la fenêtre : on replie sur
      // l'heure attendue, on ne bloque pas le dépôt.
      const heureDeposee = (valeur, defaut, champ) =>
        normaliserHeure(typeof valeur === "string" ? valeur.slice(0, 8) : null, {
          defaut,
          champ,
        }).heure;
      const startStr = heureDeposee(shiftData?.start_time, "08:00:00", "Début du modèle");
      const endStr = heureDeposee(shiftData?.end_time, "17:00:00", "Fin du modèle");
      const hasBrk = shiftData?.has_break ?? true;
      const brkStart = hasBrk
        ? heureDeposee(shiftData?.break_start, "12:00:00", "Début de pause")
        : null;
      const brkEnd = hasBrk
        ? heureDeposee(shiftData?.break_end, "13:00:00", "Fin de pause")
        : null;

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

      if (error) {
        // La brique est posée à l'écran — c'est le geste du fondateur, on ne le
        // remet pas en question — mais elle n'est pas en base. L'avaler en
        // `console.warn` est ce qui a rendu ce dossier muet : le planning avait
        // l'air de marcher jusqu'au rechargement, et le seul message visible
        // était un 400 sans nom.
        toast.error(`Le modèle est posé à l'écran, mais pas enregistré : ${causeRejetBase(error)}`);
        return;
      }
      setEmployeeSchedules((prev) => {
        const others = prev.filter((r) => r.employee_id !== emp.id);
        return [...others, { ...(existingES || {}), ...payload }];
      });
    } catch (err) {
      console.warn("Synchronisation directe employee_schedules:", err);
      toast.error(`Le modèle est posé à l'écran, mais pas enregistré : ${causeRejetBase(err)}`);
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

  const handleDropOnCell = async (e, targetEmp, targetDay, payloadExplicite = null) => {
    e.preventDefault();
    const duplicateMode = Boolean(e.altKey || e.ctrlKey || e.metaKey || isAltPressed);
    const payload = payloadExplicite || draggedPayload;
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

  // Application du modèle copié sur une case (clic « Coller » ou Ctrl/⌘+V)
  const collerModeleDansCellule = (emp, dayItem) => {
    if (!modeleCopie) {
      toast.error("Copiez d'abord un modèle du dock (Ctrl+C ou « Copier »).");
      return false;
    }
    handleDropOnCell(
      { preventDefault: () => {}, altKey: false },
      emp,
      dayItem,
      paquetDepuisModele(modeleCopie.template)
    );
    return true;
  };

  const collerModeleSurJour = (dateStr) => {
    if (!modeleCopie) {
      toast.error("Copiez d'abord un modèle du dock (Ctrl+C ou « Copier »).");
      return false;
    }
    handleDropOnCalendarDay(
      { preventDefault: () => {} },
      dateStr,
      paquetDepuisModele(modeleCopie.template)
    );
    return true;
  };

  // Mémorise la dernière case survolée : c'est elle que Ctrl/⌘+V remplit.
  const survolerCase = (vue, empId, dateStr, dayNum) => {
    if (!modeleCopie) return;
    setCaseCible({ vue, empId, dateStr, dayNum });
  };

  const collerDansCaseCible = () => {
    if (!modeleCopie) return;
    if (!caseCible) {
      toast.error("Survolez une case du calendrier, puis appuyez sur Ctrl+V.");
      return;
    }
    if (caseCible.vue === "mois") {
      collerModeleSurJour(caseCible.dateStr);
      return;
    }
    const emp = employees.find((item) => String(item.id) === String(caseCible.empId));
    if (!emp) return;
    const journalier = weekDays.find((d) => d.dateStr === caseCible.dateStr) || {
      dateStr: caseCible.dateStr,
      dayNum: caseCible.dayNum || dayNumFromDateStr(caseCible.dateStr),
      labelHeader: caseCible.dateStr,
    };
    collerModeleDansCellule(emp, journalier);
  };

  // ═══ RACCOURCIS CTRL/⌘+C ET CTRL/⌘+V ═══
  // Pas de tableau de dépendances : les gestionnaires de dépôt sont
  // recréés à chaque rendu et doivent rester à jour.
  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === "Escape" && modeleCopie) {
        oublierModeleCopie();
        return;
      }
      const selection =
        typeof window.getSelection === "function"
          ? String(window.getSelection() || "")
          : "";
      const action = raccourciPressePapiers(evenement, selection);
      if (action === "copier") {
        const modele = modeleActifRef.current;
        if (!modele) return;
        evenement.preventDefault();
        copierModele(modele);
        return;
      }
      if (action === "coller") {
        if (!modeleCopie) return;
        evenement.preventDefault();
        collerDansCaseCible();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  });

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
    // Une barre = une clé stable. Une équipe formée « Équipe de vente » et un
    // département « ÉQUIPE DE VENTE » font deux barres : seuls les membres de
    // la table team_members sont dans la première.
    const annoncees = equipesFormees.map((equipe) => ({
      cle: cleEquipeFormee(equipe),
      titre: String(equipe?.name || "").trim(),
      type: "equipe",
    }));

    const desEmployes = filteredEmployees.map((emp) => ({
      groupe: groupeDeLEmploye(emp, {
        equipeParEmploye: equipesParEmploye,
        affectations: teamAssignments,
      }),
      employe: emp,
    }));

    const locales = teams.map((nom) => ({
      cle: `locale:${String(nom || "").trim().toUpperCase()}`,
      titre: String(nom || "").trim(),
      type: "locale",
    }));

    const lignes = [
      ...annoncees.map((groupe) => ({ groupe, employe: null })),
      ...desEmployes,
      ...locales.map((groupe) => ({ groupe, employe: null })),
    ].filter((ligne) => ligne.groupe?.titre && ligne.groupe?.cle);

    const groupes = lignes.reduce((liste, { groupe, employe }) => {
      const rang = liste.findIndex((entree) => entree.key === groupe.cle);
      if (rang === -1) {
        return [
          ...liste,
          {
            key: groupe.cle,
            title: groupe.titre,
            type: groupe.type,
            employees: employe ? [employe] : [],
          },
        ];
      }
      if (!employe) return liste;
      return liste.map((entree, index) =>
        index === rang ? { ...entree, employees: [...entree.employees, employe] } : entree
      );
    }, []);

    // Ordre d'affichage : GARDE & LOGISTIQUE puis ÉQUIPE OFFICINE & VENTE puis les autres
    const priority = ["GARDE & LOGISTIQUE", "ÉQUIPE OFFICINE & VENTE"];
    const rangPrioritaire = (groupe) => {
      const rang = priority.indexOf(groupe.title);
      if (rang !== -1) return rang;
      return groupe.title === SANS_EQUIPE ? priority.length + 1 : priority.length;
    };

    const ranges = [...groupes].sort((a, b) => rangPrioritaire(a) - rangPrioritaire(b));

    // L'ordre GLISSÉ à la main passe devant les priorités écrites : ce que
    // l'écran montre, c'est lui, et il revient d'une visite à l'autre. Une
    // équipe absente de la liste — créée depuis, ou jamais déplacée — garde sa
    // place de priorité APRÈS les glissées : elle ne disparaît pas pour n'avoir
    // pas encore été rangée.
    const tries = ordreEquipes.length
      ? [
          ...ordreEquipes
            .map((cle) => ranges.find((groupe) => groupe.key === cle))
            .filter(Boolean),
          ...ranges.filter((groupe) => !ordreEquipes.includes(groupe.key)),
        ]
      : ranges;

    // Deux barres du même nom (équipe officielle + département hérité) :
    // on les signale, sinon on ne sait plus laquelle on regarde.
    const titres = tries.map((groupe) => groupe.title.toUpperCase());

    return tries.map((groupe) => ({
      ...groupe,
      isBannerOnly: false,
      estFormee: groupe.type === "equipe",
      collision:
        titres.filter((titre) => titre === groupe.title.toUpperCase()).length > 1,
    }));
  }, [filteredEmployees, teams, teamAssignments, equipesFormees, equipesParEmploye, ordreEquipes]);

  // L'ÉCHANGE, pas l'insertion : « glisser les équipes une fois pliées pour
  // ÉCHANGER leur ordre ». Poser A sur B permute les deux lignes. C'est plus
  // sûr qu'un trait d'insertion raté d'un demi-centimètre, et c'est le mot
  // qu'il a employé. Les clés non rangées sont remises dans l'ordre affiché,
  // pour que la liste mémorisée reste la liste complète.
  const echangerEquipes = (cle, cible) => {
    if (!cle || !cible || cle === cible) return;
    const cles = employeeGroups.filter((groupe) => !groupe.isBannerOnly).map((groupe) => groupe.key);
    const i = cles.indexOf(cle);
    const j = cles.indexOf(cible);
    if (i === -1 || j === -1) return;
    [cles[i], cles[j]] = [cles[j], cles[i]];
    setOrdreEquipes(cles);
  };

  // ═══ COLLABORATEURS VISIBLES (groupes dépliés) ET FOCUS (équipe / collaborateur) ═══
  const visibleEmployees = useMemo(
    () =>
      employeeGroups
        .filter((g) => !collapsedGroups[g.key])
        .flatMap((g) => g.employees),
    [employeeGroups, collapsedGroups]
  );

  // Le filtre suit exactement la barre choisie : ses membres, rien de plus.
  // Une équipe formée ne récupère donc jamais les personnes d'un département
  // qui porte le même nom.
  const membresDuGroupeFocalise = useMemo(() => {
    if (focusFilter.type !== "team") return null;
    const groupe = employeeGroups.find((g) => g.key === focusFilter.value);
    return new Set((groupe?.employees || []).map((membre) => membre.id));
  }, [employeeGroups, focusFilter]);

  const matchesFocus = (emp) => correspondAuFocus(emp, focusFilter, membresDuGroupeFocalise);

  const scopedEmployees = useMemo(
    () => visibleEmployees.filter(matchesFocus),
    [visibleEmployees, focusFilter, teamAssignments, equipesParEmploye]
  );

  // ═══ LE PÉRIMÈTRE D'ENTREPRISE N'A PLUS DE SÉLECTEUR DANS LE BANDEAU (22/11) ═══
  // Il suit le sélecteur GLOBAL de l'application (le rail du dashboard, qui
  // écrit `admin.selectedEnterprise`) : un super-administrateur qui a choisi
  // une entreprise la voit ici aussi, sans deuxième sélecteur dans la page —
  // deux portes pour la même pièce font douter de laquelle est la bonne.
  // « all » = la vue globale, exactement le réglage par défaut d'avant.
  useEffect(() => {
    const id = admin?.selectedEnterprise?.id || null;
    setSelectedEntreprise(id && entreprises.some((e) => e.id === id) ? id : "all");
  }, [admin?.selectedEnterprise?.id, entreprises]);

  const entrepriseActive = useMemo(
    () =>
      selectedEntreprise === "all"
        ? null
        : entreprises.find((e) => e.id === selectedEntreprise) || null,
    [selectedEntreprise, entreprises]
  );

  // Le numéro de semaine ISO, pour que la feuille se repère dans l'année
  // sans compter les lundis à la main.
  const semaineIso = useMemo(() => {
    const d = new Date(Date.UTC(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // le jeudi de la semaine
    const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((d - premierJeudi) / 86400000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
  }, [calendarDate]);

  // Ce que le bandeau dit à la place du sélecteur retiré : le périmètre réel
  // et le nombre de collaborateurs sous les yeux — deux nombres lus dans cet
  // écran, pas une phrase.
  const etatFeuille = useMemo(() => {
    const morceaux = [entrepriseActive ? entrepriseActive.name : "Toutes les entreprises"];
    if (planningView === "semaine") morceaux.push(`Semaine ${semaineIso}`);
    morceaux.push(
      `${scopedEmployees.length} collaborateur${scopedEmployees.length > 1 ? "s" : ""}`
    );
    // DEUX MOTS DE PLUS, ET ILS NE SONT PAS DÉCORATIFS (23/11). Depuis que la
    // reprise ne démonnte plus la page, le fondateur doit pouvoir savoir si ce
    // qu'il voit est à jour : « reprise en cours » le dit pendant la requête, et
    // « direct » / « figé » dit si les pointages arrivent tout seuls. Sans ces
    // deux-là, le fond discret serait une nouvelle forme de mensonge — une page
    // qui ne change plus d'écran n'est visible à rien.
    // Le libellé vient de `presenterEtat`, pas d'un texte inventé ici ; SA
    // bulle, non : elle promet un sondage toutes les 30 s que la page Pointages
    // seule fait. La bulle du planning s'écrit donc à côté, à la mesure de ce
    // que cette page sait faire.
    if (rechargement) morceaux.push("reprise en cours");
    morceaux.push(presenterEtat(etatDirect).libelle.toLowerCase());
    return morceaux.join(" · ");
  }, [entrepriseActive, planningView, semaineIso, scopedEmployees.length, rechargement, etatDirect]);

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

  const publishedPayslips = usePlanningPayslips(employees, periodDates);
  const payslipEntries = (people, date) => people.map(employee => ({
    employee, slips: payslipsForDay(publishedPayslips.index, employee, date),
  })).filter(entry => entry.slips.length > 0);

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
          //  Une sortie inventée par l'auto-clôture est MARQUÉE comme telle :
          //  jamais présentée comme un vrai badge (« on invente, on marque,
          //  on n'encaisse pas »).
          autoClosed:
            Boolean((result.attendances || []).some((a) => a.is_auto_closed)) ||
            Boolean(result.lastOut?.is_auto_closed),
          //  Une sortie présumée VALIDÉE par un humain n'est plus un oubli :
          //  elle est comptée, et on l'affiche comme telle.
          sortieValidee: Boolean(result.lastOut?.estimation_validee_le),
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

  //  Symbole d'un oubli de pointage : la sortie n'a jamais été badgée. Il est
  //  défini UNE fois ici pour que la case et la légende ne puissent pas
  //  diverger (un symbole dans la case qui n'est pas expliqué n'explique rien).
  const SYMBOLE_OUBLI = "⚠️ oubli";

  // Libellé des entrées / sorties réelles.
  //  Cette ligne ne montre QUE des heures réellement badgées. Quand la sortie
  //  manque, l'heure inventée par l'auto-clôture (la fin de la grille, souvent
  //  17:00) ne s'affiche PAS dans la case : elle se lit comme une vraie sortie.
  //  On affiche le symbole d'oubli, et l'heure présumée reste au survol.
  const formatRealLabel = (real) => {
    if (!real || !real.firstIn) return null;
    const entree = heureLocale(real.firstIn);
    if (!real.lastOut) return `${entree} → en cours`;
    //  Présumée MAIS validée par un humain : elle compte, on la montre marquée.
    if (real.sortieValidee) return `${entree} → ${heureLocale(real.lastOut)} (validée)`;
    //  Inventée et non validée : ce n'est pas une heure, c'est un oubli.
    if (real.autoClosed) return `${entree} → ${SYMBOLE_OUBLI}`;
    return `${entree} → ${heureLocale(real.lastOut)}`;
  };

  //  Infobulle de la ligne « Réel » : ce qu'on ne peut pas mettre dans la case.
  const titreReelDuJour = (real) => {
    if (!real || !real.firstIn) return undefined;
    if (!real.lastOut) return `Entrée ${heureLocale(real.firstIn)} — sortie pas encore pointée`;
    if (real.sortieValidee) {
      return `Sortie présumée ${heureLocale(real.lastOut)}, validée par un humain — comptée`;
    }
    if (real.autoClosed) {
      return (
        `Aucune sortie pointée. Sortie présumée ${heureLocale(real.lastOut)} (auto-clôture) ` +
        "— non comptée, à régulariser depuis la page Pointages."
      );
    }
    return `Réel ${heureLocale(real.firstIn)} → ${heureLocale(real.lastOut)}`;
  };

  const realIsOpen = (real) => Boolean(real && real.firstIn && !real.lastOut);

  //  Horloge : pour dire si une session ouverte est ENCORE « en cours » ou déjà
  //  une « sortie manquante », il faut l'heure. Une minute suffit.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const entrepriseParEmploye = useMemo(() => {
    const map = new Map();
    scopedEmployees.forEach((e) => map.set(e.id, e.enterprise_id));
    return map;
  }, [scopedEmployees]);

  //  Heure à partir de laquelle la journée ne peut plus recevoir de sortie
  //  réelle : l'auto-clôture de l'entreprise (+ la grâce). `null` si non
  //  configurée — le délai d'oubli prend alors seul le relais.
  const limiteAutoCloseMs = (dateStr, cfg) => {
    if (!cfg || cfg.autoCloseEnabled !== true || !cfg.autoCloseTime) return null;
    const [h, m] = String(cfg.autoCloseTime).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const base = new Date(`${dateStr}T00:00:00`).getTime();
    if (!Number.isFinite(base)) return null;
    return base + (h * 60 + m + (Number(cfg.autoCloseGraceMinutes) || 0)) * 60000;
  };

  //  ⏳ LA RÈGLE DE LA PAGE POINTAGES — une session ouverte n'est « en cours »
  //  que tant que la journée peut encore se fermer. Elle devient SORTIE
  //  MANQUANTE dès que :
  //     · le jour est révolu (hier et avant) → plus aucune sortie ne viendra ;
  //     · le délai d'oubli de l'entreprise est dépassé ;
  //     · l'heure d'auto-clôture (+ grâce) est passée.
  //  Résultat : une sortie jamais pointée ne fait plus clignoter la case
  //  « en cours · non planifié » sans fin — elle s'arrête et elle le dit.
  const sortiesManquantes = useMemo(() => {
    const set = new Set();
    const aujourdhui = toIsoDateLocal(new Date(nowMs));
    realAttendanceMap.forEach((real, cle) => {
      if (real.lastOut) return;
      const [empId, dateStr] = cle.split("|");
      if (dateStr < aujourdhui) {
        set.add(cle);
        return;
      }
      const entId = entrepriseParEmploye.get(empId);
      const seuils = seuilsByEnterprise[entId] || {};
      const oubliH = Number(seuils.oubliSortieHeures) || 12;
      const depuisH = (nowMs - Date.parse(real.firstIn)) / 3600000;
      const limite = limiteAutoCloseMs(dateStr, enterpriseCfgByEnt[entId]);
      if (depuisH >= oubliH || (limite && nowMs > limite)) set.add(cle);
    });
    return set;
  }, [
    realAttendanceMap,
    nowMs,
    seuilsByEnterprise,
    enterpriseCfgByEnt,
    entrepriseParEmploye,
  ]);

  //  Vrai seulement tant que la personne est réellement en train de travailler.
  const estEnCours = (emp, dateStr, real) =>
    realIsOpen(real) && !sortiesManquantes.has(`${emp.id}|${dateStr}`);


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
        isToday: dayItem.isToday,
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
      loadData(admin, { enFond: true });
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
      loadData(admin, { enFond: true });
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
      loadData(admin, { enFond: true });
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

  // Une teinte par case n'est libre que si elle est réversible : ce bouton rend
  // la case à la teinte de l'horaire, en base comme dans le brouillon local. Sans
  // lui, un clic de trop resterait colorié pour toujours — et on n'oserait plus
  // essayer une couleur, ce qui est la façon la plus sûre de ne jamais en mettre.
  const handleRetirerTeinteDeLaCase = async () => {
    const dateStr = cellEditContext?.dateStr || null;
    const id = employeeScheduleForm.employee_id;
    if (!dateStr || !id) return;
    const ligne = employeeSchedules.find((row) => row.employee_id === id);
    // LA CARTE EST RELUE ICI AUSSI, comme à l'enregistrement (23/11, second volet).
    // « Retirer » renvoie en base la carte telle qu'elle est déjà : si une teinte
    // illisible dort sur un AUTRE jour, le CHECK refuse le retrait — un bouton qui
    // efface se met à refuser d'effacer. Et si la carte n'est pas un objet, l'extension
    // à l'aveugle fabrique des clés "0", "1", "2".
    const carteJour = carteDeTeintes(ligne);
    const carte = { ...carteJour.carte };
    delete carte[dateStr];
    try {
      const { error } = await supabase
        .from("employee_schedules")
        .update({ custom_day_colors: carte, updated_at: new Date().toISOString() })
        .eq("employee_id", id);
      if (error) throw error;
      setEmployeeSchedules((prev) =>
        prev.map((row) =>
          row.employee_id === id ? { ...row, custom_day_colors: carte } : row
        )
      );
      setDayOverrides((prev) => {
        const cetEmploye = { ...(prev[id] || {}) };
        if (cetEmploye[dateStr]) {
          const sansTeinte = { ...cetEmploye[dateStr] };
          delete sansTeinte.color;
          cetEmploye[dateStr] = sansTeinte;
        }
        return { ...prev, [id]: cetEmploye };
      });
      setEmployeeScheduleForm({
        ...employeeScheduleForm,
        // la teinte de la ligne est relue avant de rejoindre le formulaire : elle
        // repartira en base au prochain enregistrement, et une valeur raccourcie y
        // serait un 400
        custom_color: normaliserTeinte(ligne?.custom_color ?? null).teinte || TEINTE_PAR_DEFAUT,
      });
      toast.success(
        carteJour.retirees > 0
          ? `Cette case reprend la teinte de l'horaire · ${carteJour.retirees} couleur saisie à la main sur un autre jour écartée${carteJour.retirees > 1 ? "s" : ""}`
          : "Cette case reprend la teinte de l'horaire"
      );
    } catch (error) {
      console.error(error);
      toast.error(`${causeRejetBase(error)} — la case reste donc coloriée ici seulement`);
    }
  };

  // La portée d'une fenêtre se LIT dans sa propre étiquette : « couleur de
  // l'horaire » et « couleur du mardi 24 novembre » ne promettent pas la même
  // chose, et le fondateur a passé trois phases à découvrir laquelle s'appliquait.
  const jourViseParLaCase = (dateStr) =>
    dateStr
      ? new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : null;

  // UNE CASE DU MOIS, UN COLLABORATEUR, UNE DES DEUX FENÊTRES. Deux portes
  // existent déjà et il n'y en aura pas de troisième : la case réglée s'ajuste
  // dans `openCellEditorModal`, la case vide lève le choisisseur de modèles de la
  // vue semaine (`setCaseVide`, né avec la case vide de la vue semaine). Le `dayItem` porte la même forme que celui
  // que le glisser-déposer des noms fabrique à côté — mêmes champs, mêmes
  // libellés, sinon les deux chemins finiraient par dire deux choses différentes
  // de la même case.
  const ouvrirLaCaseDuJour = (emp, dateStr, dayNum, shift, etiquette) => {
    setChoixJour(null);
    const dayItem = {
      dateStr,
      dayNum,
      labelHeader: `${emp.first_name} ${etiquette}`,
    };
    if (shift) openCellEditorModal(emp, dayItem, shift);
    else setCaseVide({ emp, dayItem });
  };

  const openCellEditorModal = (emp, dayItem = null, currentShift = null) => {
    setCellEditContext(
      dayItem
        ? {
            empId: emp.id,
            dateStr: dayItem.dateStr,
            dayNum: dayItem.dayNum,
            shiftName: currentShift?.name,
          }
        : null
    );
    // La fenêtre doit montrer la teinte EN PLACE, pas repartir de zéro : sans cette
    // relecture, un enregistrement effaçait la couleur choisie la fois précédente.
    // L'ordre compte, et c'est celui de la grille : ce que CETTE case a choisi
    // (base jour par jour) avant ce que la LIGNE a choisi. Sinon, peindre un mardi
    // ferait croire au fondateur que le choix du lundi a disparu.
    const existingES = employeeSchedules.find((es) => es.employee_id === emp.id);
    const teinteDeja = dayItem
      ? existingES?.custom_day_colors?.[dayItem.dateStr]
      : undefined;
    const teinteEnCours =
      teinteDeja ||
      currentShift?.color ||
      existingES?.custom_color ||
      (!dayItem ? (dayOverrides[emp.id] || {})[COULEUR_HORAIRE_CLE]?.color : undefined) ||
      TEINTE_PAR_DEFAUT;
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
        custom_color: teinteEnCours,
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
        custom_color: teinteEnCours,
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

      // La teinte est calculée UNE FOIS, mais elle ne part pas au même endroit
      // selon la portée de la fenêtre. Une case (la fenêtre a été ouverte sur un
      // jour) écrit dans la carte des teintes par jour ; la ligne entière (fenêtre
      // ouverte depuis le collaborateur) écrit `custom_color`. Le 22/11, les deux
      // se confondaient : choisir une teinte pour un jour écrivait la clé de la
      // ligne, et les sept jours prenaient la couleur.
      //
      // LE FORMAT AVANT L'ENVOI (23/11). Ces valeurs ne viennent pas que du
      // nuancier : la fenêtre se rouvre sur ce qui est EN PLACE, et « en place »
      // inclut le brouillon local de ce navigateur (`dayOverrides`), écrit par
      // les versions d'avant la contrainte de format. Le 400 signalé par le
      // fondateur est un refus de la base sur une valeur de cette origine — elle
      // a raison de la refuser, la page a tort de l'envoyer. On replie donc sur
      // la première teinte de la palette en le DISANT, au lieu de laisser
      // l'enregistrement échouer sans explication : refuser ici empêcherait le
      // fondateur de réparer son propre brouillon.
      const teinteDemandee = normaliserTeinte(employeeScheduleForm.custom_color);
      // un avis NEUTRE se dit `toast(...)`. `toast.message` serait l'API d'une
      // autre bibliothèque : n'existant pas, elle levait un TypeError dans le
      // `try`, et l'enregistrement entier partait dans son `catch` — le 23/11,
      // en production, pendant vingt minutes. La liste des méthodes autorisées
      // est verrouillée par contrat, dans le fichier de tests de câblage.
      if (teinteDemandee.message) toast(teinteDemandee.message);
      const couleur = teinteDemandee.teinte || TEINTE_PAR_DEFAUT;

      // Les quatre heures suivent la même règle, avec une exception : une heure
      // vide alors qu'elle est obligatoire n'a rien à quoi se replier. C'est le
      // seul cas où la fenêtre refuse d'écrire, et elle le nomme champ par
      // champ — « une heure est invalide » ne dit pas où cliquer.
      const heuresLibres = employeeScheduleForm.use_custom_hours;
      const avecPause = heuresLibres && employeeScheduleForm.custom_has_break;
      const reglagesHeures = [
        normaliserHeure(employeeScheduleForm.custom_start_time, {
          champ: "Début de journée",
          obligatoire: heuresLibres,
          defaut: "08:00:00",
        }),
        normaliserHeure(employeeScheduleForm.custom_end_time, {
          champ: "Fin de journée",
          obligatoire: heuresLibres,
          defaut: "17:00:00",
        }),
        normaliserHeure(employeeScheduleForm.custom_break_start, {
          champ: "Début de pause",
          obligatoire: avecPause && !employeeScheduleForm.custom_break_start,
          defaut: "12:00:00",
        }),
        normaliserHeure(employeeScheduleForm.custom_break_end, {
          champ: "Fin de pause",
          obligatoire: avecPause && !employeeScheduleForm.custom_break_end,
          defaut: "13:00:00",
        }),
      ];
      const heureBloquante = reglagesHeures.find((h) => h.message && h.heure === null);
      if (heureBloquante) {
        toast.error(heureBloquante.message);
        return;
      }
      reglagesHeures
        .filter((h) => h.message && h.heure !== null)
        .forEach((h) => toast(h.message));
      const [debut, fin, pauseDebut, pauseFin] = reglagesHeures;

      const dateCible = cellEditContext?.dateStr || null;
      const ligneExistante = employeeSchedules.find(
        (row) => row.employee_id === employeeScheduleForm.employee_id
      );
      // Fusionner la carte telle qu'elle est, c'est laisser UNE teinte saisie à
      // la main un jour précédent refuser l'enregistrement de celui d'aujourd'hui
      // (le CHECK de la colonne ne fait pas de sentiment). `carteDeTeintes` la
      // retire, et cette fenêtre le dit : retirer rend à la case son état
      // d'avant tout choix, « la ligne décide » — ce n'est pas une punition.
      const carteJour = carteDeTeintes(ligneExistante);
      if (carteJour.retirees > 0) {
        toast(
          `${carteJour.retirees} autre${carteJour.retirees > 1 ? "s" : ""} jour${
            carteJour.retirees > 1 ? "s" : ""
          } portaient une teinte que la base refuse ; ils reprennent la teinte de l'horaire.`
        );
      }

      const payload = {
        employee_id: employeeScheduleForm.employee_id,
        schedule_id: heuresLibres ? null : employeeScheduleForm.schedule_id || null,
        use_custom_hours: heuresLibres,
        custom_start_time: heuresLibres ? debut.heure : null,
        custom_end_time: heuresLibres ? fin.heure : null,
        custom_break_start: avecPause ? pauseDebut.heure : null,
        custom_break_end: avecPause ? pauseFin.heure : null,
        custom_has_break: heuresLibres ? employeeScheduleForm.custom_has_break : true,
        custom_work_days: heuresLibres ? employeeScheduleForm.custom_work_days : null,
        // DEUX PORTÉES, DEUX COLONNES. La fenêtre ouverte SUR UNE case écrit dans
        // la carte des teintes jour par jour et ne touche pas à la teinte de la
        // ligne ; la fenêtre ouverte depuis le collaborateur écrit `custom_color`
        // et ne touche pas aux cases qui ont déjà choisi la leur.
        ...(dateCible
          ? {
              custom_day_colors: {
                ...carteJour.carte,
                [dateCible]: couleur,
              },
            }
          : { custom_color: couleur }),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("employee_schedules")
        .upsert(payload, { onConflict: "employee_id" });
      if (error) throw error;

      // Le brouillon local de ce navigateur suit la MÊME portée que l'écriture en
      // base, et il se FUSIONNE : remplacer la ligne entière avait pour effet
      // collatéral d'effacer les autres jours déjà travaillés sur cette ligne.
      setDayOverrides((prev) => {
        const cetEmploye = { ...(prev[employeeScheduleForm.employee_id] || {}) };
        if (dateCible) {
          cetEmploye[dateCible] = {
            ...(cetEmploye[dateCible] || {}),
            start_time: employeeScheduleForm.custom_start_time,
            end_time: employeeScheduleForm.custom_end_time,
            has_break: employeeScheduleForm.custom_has_break,
            break_start: employeeScheduleForm.custom_break_start,
            break_end: employeeScheduleForm.custom_break_end,
            variant: "standard",
            name: cellEditContext.shiftName || "Horaire personnalisé",
            color: couleur,
          };
        } else {
          cetEmploye[COULEUR_HORAIRE_CLE] = { color: couleur };
        }
        return { ...prev, [employeeScheduleForm.employee_id]: cetEmploye };
      });

      // La ligne en mémoire reçoit la valeur qui vient d'être écrite : c'est elle
      // qui peint, pas un brouillon parallèle. Un seul endroit où la teinte de la
      // ligne fait foi, donc un seul endroit où elle peut déborder.
      setEmployeeSchedules((prev) => {
        const autres = prev.filter(
          (row) => row.employee_id !== employeeScheduleForm.employee_id
        );
        return [...autres, { ...(ligneExistante || {}), ...payload }];
      });

      toast.success("Planning collaborateur enregistré !");
      setShowEmployeeScheduleModal(false);
      loadData(admin, { enFond: true });
    } catch (error) {
      // Le refus de la base EST le message : sans lui, le fondateur reste avec
      // un « Erreur sauvegarde » et un 400 dans la console, et doit deviner.
      console.error("Enregistrement de la ligne d'horaire refusé:", error);
      toast.error(causeRejetBase(error));
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
      await loadData(admin, { enFond: true });
    } catch (error) {
      console.error("Erreur traitement demande:", error);
      toast.error(causeRejetBase(error));
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
        nomEntreprise={entrepriseActive?.name ?? ""}
        dataReady={!loading}
        onSkip={() => {
          skipLoading();
          setLoading(false);
        }}
      />
    );
  }

  // Le pied de grille ne répète pas la grille : il la résume. L'ancien total de la barre
  // de pied portait les heures du SEUL lundi sous un libellé qui prétendait parler de la
  // semaine, et tombait sur un nombre inventé dès que la semaine était vide. Trois valeurs
  // réelles le remplacent : les heures cumulées, les jours réellement couverts, la moyenne
  // par jour couvert. Chacune se lit une fois, nulle part deux.
  const totalActiveEmployees = filteredEmployees.length;
  const heuresSemaine = dailyTotals.reduce((somme, dt) => somme + (dt.totalMinutes || 0), 0);
  const joursCouverts = dailyTotals.filter((dt) => dt.headcount > 0).length;
  const labelHeures = (minutes) =>
    `${Math.floor(minutes / 60)}h${String(Math.round(minutes % 60)).padStart(2, "0")}`;
  const totalHeuresSemaineLabel = labelHeures(heuresSemaine);
  const moyenneJourCouvertLabel = labelHeures(
    joursCouverts ? Math.round(heuresSemaine / joursCouverts) : 0,
  );

  // LE MOIS, CALCULÉ UNE FOIS. La grille ET le pied de semaine lisent le même
  // résultat. Avant ce chantier, le compteur d'une case filtrait sur le JOUR DE
  // SEMAINE (`work_days.includes(pDay)`) pendant que ses pastilles passaient
  // par `resolveCellShift`, qui lui connaît la DATE : deux questions, deux
  // réponses, et une case pouvait annoncer « 5 perso » sans montrer personne —
  // c'est exactement ce que la capture du 23/11 montrait sur le 25.
  //
  // Pas de `useMemo` ici, et c'est voulu : `resolveCellShift` et
  // `getRealAttendance` sont recréés à chaque rendu, donc une mémoïsation qui
  // les prendrait comme dépendance recalculerait de toute façon.
  const moisParJour = (() => {
    const carte = new Map();
    for (const cellule of calendarWeeks.flat()) {
      if (cellule.type !== "day") continue;
      const dayNum = dayNumFromDateStr(cellule.date);
      const rangs = [];
      for (const emp of scopedEmployees) {
        const shift = resolveCellShift(emp, {
          dateStr: cellule.date,
          dayNum,
          labelHeader: `${emp.first_name} ${cellule.day}`,
        });
        const real = getRealAttendance(emp.id, cellule.date);
        if (!shift && !real?.firstIn) continue;
        // Un rang ne porte qu'un seul mot, pris dans l'ordre de gravité. Une
        // teinte sans mot ne dit rien (C7) : l'état s'écrit, il ne se devine pas.
        const etat = shift?.isRest
          ? { mot: "repos", espece: "repos" }
          : shift?.isAbsence
          ? { mot: "absence", espece: "absent" }
          : shift?.isLeave
          ? { mot: "congé", espece: "conge" }
          : sortiesManquantes.has(`${emp.id}|${cellule.date}`)
          ? { mot: "sortie manquante", espece: "absent" }
          : estEnCours(emp, cellule.date, real)
          ? { mot: "en cours", espece: "heure" }
          : real?.autoClosed
          ? { mot: "oubli de sortie", espece: "oubli" }
          : null;
        rangs.push({
          emp,
          shift,
          real,
          minutes: computeShiftNetMinutes(shift),
          teinte: shift?.color || null,
          etat,
        });
      }
      carte.set(cellule.date, {
        rangs,
        minutes: rangs.reduce((somme, r) => somme + r.minutes, 0),
        anomalies: rangs.filter((r) => r.etat && r.etat.espece !== "heure").length,
      });
    }
    return carte;
  })();

  // Le pied de semaine se lit en dates, pas en numéro ISO : un numéro inventé
  // serait un chiffre de plus que personne ne peut vérifier.
  const dateCourte = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const semainesDuMois = calendarWeeks
    .map((semaine) => {
      const jours = semaine.filter((c) => c.type === "day");
      if (!jours.length) return null;
      const portees = jours.map((c) => moisParJour.get(c.date)).filter(Boolean);
      return {
        cle: jours[0].date,
        libelle:
          jours.length === 1
            ? `le ${dateCourte(new Date(`${jours[0].date}T12:00:00`))}`
            : `du ${dateCourte(new Date(`${jours[0].date}T12:00:00`))} au ${dateCourte(
                new Date(`${jours[jours.length - 1].date}T12:00:00`)
              )}`,
        postes: portees.reduce((n, j) => n + j.rangs.length, 0),
        minutes: portees.reduce((n, j) => n + j.minutes, 0),
        anomalies: portees.reduce((n, j) => n + j.anomalies, 0),
        feries: jours.filter((c) => c.isHoliday).length,
      };
    })
    .filter(Boolean);

  // ═══ LA COQUE : les voyages et le périmètre, dans la barre ═══
  //
  // LE PÉRIMÈTRE N'EST PAS RE-CALCULÉ ICI. Plus haut, la page a déjà l'effet qui
  // lit `admin.selectedEnterprise` (le choix du sélecteur GLOBAL) et le
  // `entrepriseActive` qui en découle — c'est la promesse du bandeau du 22/11,
  // qui avait retiré son propre sélecteur pour cette raison. Le rail ne fait
  // qu'écrire la même valeur, à la même adresse (`last_enterprise_id_<id>`),
  // donc choisir son établissement ici le change sur la page Employés, et
  // l'inverse.
  const changerEntreprise = (entreprise) => {
    const choix = entreprise && entreprise.id ? entreprise : null;
    setSelectedEntreprise(choix ? choix.id : "all");
    if (admin) {
      const misAJour = { ...admin, selectedEnterprise: choix };
      setAdmin(misAJour);
      try {
        window.localStorage.setItem("admin", JSON.stringify(misAJour));
        if (choix) {
          window.localStorage.setItem(`last_enterprise_id_${admin.id}`, choix.id);
        }
      } catch {
        /* le navigateur peut refuser le stockage : la page reste utilisable */
      }
    }
  };

  // Le rail a besoin d'UNE entreprise, là où la page accepte « toutes » : un
  // administrateur qui n'a pas choisi voit la vue globale — c'est juste — mais
  // ses rubriques, elles, s'allument sur les modules SOUSCRITS par son
  // établissement. Lu sur `null`, le garde-fou les éteindrait toutes.
  const entrepriseDuRail =
    entrepriseActive ||
    entreprises.find((e) => e.id === (admin?.selectedEnterprise?.id || admin?.enterprise_id)) ||
    (admin?.role === "super_admin" ? null : entreprises[0]);

  // Les rubriques du rail, par la fabrique partagée avec l'annuaire et la fiche
  // employé : une seule liste pour les trois coques.
  const moduleActif = (champ) =>
    admin?.role === "super_admin" || Boolean(entrepriseDuRail?.[champ]);
  const sectionsNav = sectionsNavAdmin({ admin, moduleActif });
  const nomAdmin = admin?.name || admin?.email || "Administrateur";

  const deconnexion = () => {
    window.localStorage.removeItem("admin");
    window.localStorage.removeItem("last_enterprise_id");
    navigate("/login");
  };

  // LES QUATRE VUES RESTENT AU BANDEAU, ET LE RAIL N'EST PAS NOURRI EN `vues`.
  // `SidebarUnique` sait les recevoir (`sb-rail-vues` : Semaine · Mois · Jour ·
  // Demandes y tiendrait), mais les y mettre ferait deux interrupteurs pour la
  // même lampe — et l'un des deux mentirait : le badge « demandes en attente »
  // vit sur le bouton du bandeau (`pendingRequestsCount`), pas dans le rail.
  // C'est le raisonnement du 22/11 sur le sélecteur d'entreprise, appliqué ici.
  return (
    <CoqueAdmin
      sidebar={
        <SidebarUnique
          sections={sectionsNav}
          nomAdmin={nomAdmin}
          initialeAdmin={(nomAdmin || "A").charAt(0)}
          darkMode={darkMode}
          surTheme={toggleTheme}
          surDeconnexion={deconnexion}
          entreprises={entreprises}
          entrepriseActive={entrepriseDuRail}
          surEntreprise={changerEntreprise}
        />
      }
    >
      <div className="sk-plan-page sk-plan-page--postit" data-theme={darkMode ? "dark" : "light"}>
      {/* ═══ LE BANDEAU DE COMMANDE — UNE FEUILLE ENCADRÉE DE TOILE (22/11/2026) ═══
          Trois choses sont SORTIES du bandeau, à la demande du fondateur :
          · le sélecteur d'entreprise — le périmètre vient du sélecteur global
            de l'application (voir `entrepriseActive`), et le bandeau LE DIT :
            le nom de l'entreprise choisie s'affiche à droite, en toutes lettres ;
          · la bande « Aller à » (Pointages · Employés · Pauses · Fiches de
            paie) — le rail du tableau de bord fait déjà ce voyage, une page
            n'a pas à se refaire menu ;
          · le bouton clair / sombre — le thème est un choix de l'application,
            pas d'une page ; il reste dans le tableau de bord et l'application
            lui obéit ici comme avant (`darkMode` pilote toujours `data-theme`).
          Et le bandeau motif ne se pose plus AU-DESSUS de la feuille : il l'EN-
          CADRE (« je veux que le bandeau motif de cette section puisse entourer
          cette section »). Une seule et même toile, `placement="cadre"`, quatre
          lisières de 26 px autour de la note. Elle ne prend ni texte ni clic :
          le motif fait le tour, les mots restent sur le papier (D-004). */}
      <div className="sk-plan-encadrement">
        <PageCulturalBand pathname="/planning" placement="cadre" />
        <header className="sk-topbar">
          <div className="sk-topbar-inner">
            {/* Gauche : la flèche retour et le titre, posés sur le papier, jamais sur la toile */}
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
            </div>

            {/* Droite : la période, puis les deux seuls gestes du bandeau */}
            <div className="sk-topbar-right">
              <div className="sk-period-nav">
                <button
                  type="button"
                  className="sk-period-arrow"
                  onClick={() => navigatePeriod(-1)}
                  title="Période précédente"
                  aria-label="Période précédente"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="sk-period-label-wrap">
                  <button
                    type="button"
                    className="sk-period-label"
                    onClick={() => setPeriodeOuverte((v) => !v)}
                    aria-expanded={periodeOuverte}
                    aria-haspopup="dialog"
                    title="Choisir une date, un mois ou une année"
                    data-testid="sk-period-label"
                  >
                    {periodLabel}
                    <ChevronDown size={14} className="sk-period-caret" data-ouvert={periodeOuverte ? "oui" : "non"} />
                  </button>

                  <ChoixPeriode
                    ouvert={periodeOuverte}
                    onFermer={() => setPeriodeOuverte(false)}
                    jourSel={jourSelPlanning}
                    annee={calendarDate.getFullYear()}
                    onAllerA={allerADate}
                  />
                </div>
                <button
                  type="button"
                  className="sk-period-arrow"
                  onClick={() => navigatePeriod(1)}
                  title="Période suivante"
                  aria-label="Période suivante"
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

              <button
                type="button"
                className="sk-btn-secondary"
                onClick={handleDuplicateWeek}
                title="Dupliquer les horaires de cette semaine sur la semaine suivante"
              >
                <Copy size={14} />
                <span>Dupliquer la semaine</span>
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

              {/* Un seul voyage hors de la page, et c'est le vrai : la fiche de
                  paie du jour se lit dans l'île Paie. Les quatre tuiles « Aller à »
                  sont parties le 22/11 — le rail fait déjà ces voyages ; celui-ci
                  reste parce qu'il prolonge l'acte publié : publier la semaine,
                  puis vérifier qu'elle est bien sortie sur les fiches. */}
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => navigate("/paie")}
                title="Voir les fiches de paie dans l'île Paie"
              >
                <FileText size={14} />
                <span>Fiches de paie</span>
              </button>
            </div>
          </div>

          {/* Rang 2 : les quatre vues, en mots soulignés de feutre, et l'état de
              la feuille à droite — le nom de l'entreprise, le numéro de semaine,
              le compte des collaborateurs vus. */}
          <div className="sk-topbar-vues">
            <div className="sk-view-Inline" role="tablist" aria-label="Vues du planning">
              {["semaine", "mois", "jour", "demandes"].map((vue) => (
                <button
                  key={vue}
                  type="button"
                  className={`sk-view-link ${planningView === vue ? "active" : ""}`}
                  onClick={() => setPlanningView(vue)}
                  aria-selected={planningView === vue}
                  role="tab"
                >
                  {vue === "semaine" ? "Semaine" : vue === "mois" ? "Mois" : vue === "jour" ? "Jour" : "Demandes"}
                  {vue === "demandes" && pendingRequestsCount > 0 && (
                    <span className="sk-req-badge">{pendingRequestsCount}</span>
                  )}
                </button>
              ))}
            </div>

            <p
              className="sk-topbar-etat"
              aria-live="polite"
              aria-busy={rechargement || undefined}
              title={
                etatDirect === "direct"
                  ? "Les pointages arrivent dès qu'ils sont enregistrés."
                  : "Écoute en direct indisponible : le planning reste celui de la dernière reprise. Elle repart d'elle-même au retour sur cet onglet ou à la reprise du réseau — et elle ne montre rien de faux en attendant."
              }
              data-reprise={rechargement ? "oui" : undefined}
            >
              {etatFeuille}
            </p>
          </div>
        </header>
      </div>

      {/* ═══ ESPACE DE TRAVAIL PRINCIPAL EN-CHECK ═══ */}
      <main className="sk-workspace">
        <div className="sk-payslip-status" role="status">
          <span>{publishedPayslips.loading ? 'Vérification des fiches envoyées…' : publishedPayslips.error || 'Billet animé : jour couvert par une fiche envoyée au salarié (pas une preuve de paiement).'}</span>
          <button type="button" onClick={publishedPayslips.refresh} disabled={publishedPayslips.loading}>Actualiser les fiches</button>
        </div>

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
              <span className="sk-dock-titre">
                Modèles à glisser-déposer (Drag &amp; Drop)
              </span>
            </button>

            <div className="sk-dock-actions">
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

            {/* La consigne descend sous le titre et sous les trois gestes : la
                maquette retenue la montre posée EN TRAVERS de la feuille, comme
                une mention manuscrite — pas comme un quatrième bouton aligné
                avec les actions. */}
            <span className="sk-dock-hint">
              Glissez un modèle sur une case jour, sur un collaborateur ou sur le
              calendrier • Maintenez <strong>Alt</strong> pour dupliquer un shift
            </span>
          </div>

          {dockOpen && (
            <div className="sk-dock-bricks">
              {dockTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`sk-brick ${
                    touchDragPayload?.template?.id === tpl.id ? "is-armed" : ""
                  } ${
                    modeleCopie?.template?.id === tpl.id ? "is-copie" : ""
                  }`}
                  style={{ "--brick-color": tpl.color || "#B56235" }}
                  draggable
                  onMouseEnter={() => {
                    modeleActifRef.current = tpl;
                  }}
                  onFocus={() => {
                    modeleActifRef.current = tpl;
                  }}
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
                      <span className="sk-brick-sub">{soustitreModele(tpl)}</span>
                    </span>
                  </div>

                  <div className="sk-brick-actions">
                    <button
                      type="button"
                      className={`sk-brick-copy${
                        modeleCopie?.template?.id === tpl.id ? " is-copie" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copierModele(tpl);
                      }}
                      title="Copier ce modèle (Ctrl+C) puis le coller dans une case du calendrier (Ctrl+V)"
                      aria-label={`Copier le modèle ${tpl.label}`}
                    >
                      {modeleCopie?.template?.id === tpl.id ? (
                        <ClipboardCheck size={13} />
                      ) : (
                        <ClipboardCopy size={13} />
                      )}
                    </button>
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

        {/* MODÈLE COPIÉ — rappel permanent tant qu'il attend d'être collé */}
        {modeleCopie && (
          <div className="sk-copie-bar" role="status" aria-live="polite">
            <ClipboardCheck size={16} className="sk-copie-icone" aria-hidden="true" />
            <span className="sk-copie-texte">
              <strong>{libelleModele(modeleCopie.template)}</strong>
              <span>
                {decrireModele(modeleCopie.template)} — survolez une case, puis{" "}
                <strong>Coller</strong> ou <kbd>Ctrl</kbd>+<kbd>V</kbd>
              </span>
            </span>
            <button
              type="button"
              className="sk-copie-coller"
              onClick={collerDansCaseCible}
              title="Coller le modèle dans la case survolée"
            >
              <ClipboardPaste size={13} />
              Coller dans la case
            </button>
            <button
              type="button"
              className="sk-copie-annuler"
              onClick={oublierModeleCopie}
              title="Annuler la copie (Échap)"
              aria-label="Annuler la copie du modèle"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* BARRE DE FOCUS + LÉGENDE DES COULEURS — pliable */}
        <section
          className={`sk-focus-bar${legendeOuverte ? " is-ouverte" : " is-repliee"}`}
          aria-label="Filtre d'affichage et légende"
        >
          <div className="sk-focus-tete">
            <button
              type="button"
              className="sk-focus-toggle"
              onClick={basculerLegende}
              aria-expanded={legendeOuverte}
              aria-controls="sk-focus-corps"
            >
              <ChevronDown size={15} className="sk-focus-chevron" aria-hidden="true" />
              <span className="sk-focus-toggle-titre">
                {legendeOuverte ? "Replier les filtres et la légende" : "Filtres, équipes et légende"}
              </span>
            </button>
            {!legendeOuverte && (
              <span className="sk-focus-resume">
                {scopedEmployees.length} collaborateur(s) · {focusLabel}
                {focusFilter.type !== "all" ? " · filtre actif" : ""}
              </span>
            )}
          </div>

          {legendeOuverte && (
            <div className="sk-focus-corps" id="sk-focus-corps">
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
                else if (v.startsWith("team:")) {
                  const cle = v.slice(5);
                  const groupe = employeeGroups.find((g) => g.key === cle);
                  setFocusFilter({ type: "team", value: cle, label: groupe?.title || cle });
                } else setFocusFilter({ type: "employee", value: v.slice(4) });
              }}
              aria-label="Filtrer l'affichage par équipe ou par collaborateur"
            >
              <option value="all">
                Toute l&apos;équipe ({visibleEmployees.length})
              </option>
              {employeeGroups.some((g) => g.estFormee) && (
                <optgroup label="Équipes formées · page Équipes">
                  {employeeGroups
                    .filter((g) => g.estFormee)
                    .map((g) => (
                      <option key={g.key} value={`team:${g.key}`}>
                        {g.title} ({g.employees.length})
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Départements et équipes du planning">
                {employeeGroups
                  .filter((g) => !g.estFormee)
                  .map((g) => (
                    <option key={g.key} value={`team:${g.key}`}>
                      {g.title} ({g.employees.length})
                      {g.collision
                        ? g.type === "locale"
                          ? " · équipe du planning"
                          : " · département"
                        : ""}
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
              {/* Les mêmes puces que la fenêtre de disponibilités, donc LES
                  MÊMES couleurs : la bande peignait ses trois pastilles à la
                  main, avec son propre vert menthe, et ne racontait plus ni la
                  grille ni la fenêtre. « sk-avail-legend-dot » est la classe
                  qui sert déjà les deux états à côté des pilules. */}
              <span className="sk-legend-item">
                <span className="sk-avail-legend-dot is-on" />{" "}
                Auj. / Sem. / jour = disponible
              </span>
              <span className="sk-legend-item">
                <span className="sk-avail-legend-dot is-off" /> indisponible
              </span>
              <span className="sk-legend-item">
                <span className="sk-avail-legend-dot" /> non renseigné
              </span>
            </span>
            <span className="sk-legend-group">
              <span className="sk-legend-title">Types de cartes</span>
              {LEGENDE_TEINTES.map((teinte) => (
                <span className="sk-legend-item" key={teinte.cle}>
                  <span
                    className="sk-legend-swatch"
                    // la teinte arrive en DONNÉE, comme sur la brique du dock :
                    // c'est la couleur du modèle, pas un choix de la feuille
                    style={teinte.teinte ? { "--brick-color": teinte.teinte } : undefined}
                  />{" "}
                  {teinte.mot}
                </span>
              ))}
              <span className="sk-legend-item">
                <span className="sk-legend-swatch is-dashed" /> Réel effectué
              </span>
            </span>
            <span className="sk-legend-group">
              <span className="sk-legend-title">Signaux</span>
              <span
                className="sk-legend-item"
                title={
                  "Entrée pointée, aucune sortie : la journée n'est pas fermée. " +
                  "L'heure de fin n'est pas affichée dans la case — ce n'est pas une heure badgée."
                }
              >
                <span className="sk-legend-symbol">{SYMBOLE_OUBLI}</span>
                Oubli de pointage
              </span>
              <span
                className="sk-legend-item"
                title="Pause retirée : elle reste archivée et remetable depuis la page Pauses."
              >
                <span className="sk-legend-symbol">🗑️</span>
                Pause supprimée (
                <span className="sk-legend-pause-barree">☕ 1h</span>)
              </span>
            </span>
          </div>
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
                        <span className="sk-th-emp-icone" aria-hidden="true">
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
                        <td className="sk-matrix-vide" colSpan={8}>
                          Aucun collaborateur actif trouvé pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      employeeGroups
                        .filter((g) => !g.isBannerOnly)
                        .map((group) => {
                          const isCollapsed = Boolean(collapsedGroups[group.key]);
                          const groupEmployees = group.employees.filter(matchesFocus);
                          if (groupEmployees.length === 0 && focusFilter.type !== "all") {
                            return null;
                          }
                          return [
                            <tr
                              key={`grp-${group.key}`}
                              className={`sk-group-row ${isCollapsed ? "is-collapsed" : ""} ${
                                equipeGlissee === group.key ? "is-glissee" : ""
                              } ${equipeCible === group.key ? "is-cible" : ""}`}
                              // Une ligne REPLIÉE se glisse : c'est la demande du
                              // 08/12. Dépliée, elle ne se glisse pas — on y
                              // attraperait des collaborateurs, et le glisser des
                              // modèles sur une ligne a déjà sa règle propre.
                              draggable={isCollapsed}
                              title={
                                isCollapsed
                                  ? "Équipe repliée : glissez-la sur une autre pour échanger leur ordre"
                                  : "Cliquez pour replier l'équipe et pouvoir la glisser"
                              }
                              onDragStart={(e) => {
                                if (!isCollapsed) return;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("application/x-encheck-equipe", group.key);
                                setEquipeGlissee(group.key);
                              }}
                              onDragEnd={() => {
                                setEquipeGlissee(null);
                                setEquipeCible(null);
                              }}
                              onDragOver={(e) => {
                                if (!equipeGlissee || equipeGlissee === group.key) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (equipeCible !== group.key) setEquipeCible(group.key);
                              }}
                              onDragLeave={() => {
                                if (equipeCible === group.key) setEquipeCible(null);
                              }}
                              onDrop={(e) => {
                                // une équipe seulement : un modèle qu'on poserait
                                // ici repart par la cellule du collaborateur
                                const cle = e.dataTransfer.getData("application/x-encheck-equipe");
                                if (!cle || cle === group.key) return;
                                e.preventDefault();
                                echangerEquipes(cle, group.key);
                                setEquipeGlissee(null);
                                setEquipeCible(null);
                              }}
                              onClick={() =>
                                setCollapsedGroups((prev) => ({
                                  ...prev,
                                  [group.key]: !prev[group.key],
                                }))
                              }
                            >
                              <td colSpan={8}>
                                <div className="sk-group-row-inner">
                                  <span className="sk-group-row-left">
                                    <span className="sk-group-caret" aria-hidden="true">
                                      {isCollapsed ? "▶" : "▼"}
                                    </span>
                                    <span>{group.title}</span>
                                    <span className="sk-group-count-badge">
                                      {group.employees.length} pers.
                                    </span>
                                    {group.estFormee ? (
                                      <span
                                        className="sk-group-badge"
                                        title="Cette équipe se gère dans Employés → Équipes"
                                      >
                                        Équipe formée
                                      </span>
                                    ) : group.collision ? (
                                      <span
                                        className="sk-group-badge is-secondaire"
                                        title={
                                          group.type === "locale"
                                            ? "Équipe créée depuis le planning, pas depuis la page Équipes"
                                            : "Département de la fiche employé — ce n'est pas une équipe formée"
                                        }
                                      >
                                        {group.type === "locale" ? "Équipe du planning" : "Département"}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span
                                    className="sk-group-row-actions"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {group.estFormee ? (
                                      <button
                                        type="button"
                                        className="sk-group-row-btn"
                                        onClick={() => navigate("/employes?vue=equipes")}
                                        title={`Ouvrir ${group.title} dans la page Équipes`}
                                      >
                                        <Users size={12} /> Voir dans Équipes
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="sk-group-row-btn"
                                          onClick={() => openEditTeamModal(group.key, group.title)}
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
                                      </>
                                    )}
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
                                              title="Ouvrir la fiche de disponibilité jour par jour — les pastilles du bas la tournent aussi, sans fenêtre"
                                            >
                                              <CalendarDays size={10} />
                                              Jours
                                            </button>
                                          </div>

                                          {/* LES SEPT JOURS, À SIGNALER ICI — la demande du
                                              08/12/2026 : « n'ouvre pas le modal Ajuster le
                                              planning quand je clique sur L M M J V S D ».
                                              Ce n'était pas un choix à retirer : c'était un
                                              TROU. Ces sept jours étaient des <span> sans geste,
                                              posés dans la cellule du collaborateur — et la
                                              cellule, elle, a un onClick qui ouvre l'ajustement
                                              du planning. Le clic traversait la pastille et
                                              atterrissait sur la cellule : la fenêtre se levait
                                              pour un jour qu'on voulait seulement colorer.
                                              Ils sont donc des BOUTONS qui arrêtent le clic, et
                                              qui font ce que la pastille Auj. fait déjà : tourner
                                              l'état du jour (non renseigné → disponible →
                                              indisponible → non renseigné). Le mot reste dans
                                              l'intitulé : la couleur ne porte jamais l'état
                                              seule (D-007). */}
                                          <div
                                            className="sk-avail-days"
                                            role="group"
                                            aria-label="Disponibilité jour par jour — cliquer un jour pour tourner son état"
                                          >
                                            {joursSemaine.map((j) => {
                                              const etatDuJour = getAvailabilityState(
                                                emp.id,
                                                `day-${j.id}`
                                              );
                                              const motDuJour =
                                                etatDuJour === "available"
                                                  ? "disponible"
                                                  : etatDuJour === "unavailable"
                                                    ? "indisponible"
                                                    : "non renseigné";
                                              return (
                                                <button
                                                  key={j.id}
                                                  type="button"
                                                  className={`sk-avail-day ${
                                                    etatDuJour === "available"
                                                      ? "is-on"
                                                      : etatDuJour === "unavailable"
                                                        ? "is-off"
                                                        : ""
                                                  }`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    cycleAvailability(emp.id, `day-${j.id}`);
                                                  }}
                                                  title={`${j.nom} : ${motDuJour} — clic pour tourner (disponible / indisponible / non renseigné)`}
                                                  aria-label={`${j.nom} : ${motDuJour}`}
                                                >
                                                  {j.court.charAt(0)}
                                                </button>
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
                                      //  Session ouverte : EN COURS (ça clignote)
                                      //  ou SORTIE MANQUANTE (ça ne clignote plus).
                                      const sessionEnCours = estEnCours(emp, dayItem.dateStr, realAtt);
                                      const sortieManquante = realIsOpen(realAtt) && !sessionEnCours;

                                      return (
                                        <td
                                          key={dayItem.dateStr}
                                          className={`sk-td-cell ${
                                            isDropOver ? "is-drop-over" : ""
                                          } ${touchDragPayload ? "is-touch-armed" : ""} ${
                                            modeleCopie ? "is-collable" : ""
                                          } ${
                                            caseCible?.vue === "semaine" &&
                                            String(caseCible.empId) === String(emp.id) &&
                                            caseCible.dateStr === dayItem.dateStr
                                              ? "is-cible-collage"
                                              : ""
                                          }`}
                                          onDragOver={(e) => handleDragOverCell(e, emp, dayItem)}
                                          onDragLeave={() => setDropTargetCell(null)}
                                          onDrop={(e) => handleDropOnCell(e, emp, dayItem)}
                                          onMouseEnter={() =>
                                            survolerCase("semaine", emp.id, dayItem.dateStr, dayItem.dayNum)
                                          }
                                          onMouseLeave={() => setCaseCible(null)}
                                          onClickCapture={(e) => {
                                            if (touchDragPayload) {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              applyTouchDropOnCell(emp, dayItem);
                                            }
                                          }}
                                        >
                                          <PlanningPayslipBadge entries={payslipEntries([emp], dayItem.dateStr)} />
                                          {modeleCopie && (
                                            <button
                                              type="button"
                                              className="sk-case-coller"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                collerModeleDansCellule(emp, dayItem);
                                              }}
                                              title={`Coller « ${libelleModele(modeleCopie.template)} » sur ${dayItem.dateStr}`}
                                            >
                                              <ClipboardPaste size={12} />
                                              Coller
                                            </button>
                                          )}
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
                                                  // la teinte nue, pour la peau post-it (lavée sur papier)
                                                  "--shift-teinte": shift.color || undefined,
                                                  // le dégradé peint, pour les autres peaux de la page
                                                  "--shift-custom-bg": shift.color
                                                    ? buildShiftGradient(shift.color)
                                                    : undefined,
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
                                                <div
                                                  className="sk-shift-name"
                                                  title={shift.label || shift.name || shift.end_time || ""}
                                                >
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
                                                    <span className="sk-shift-net">
                                                      {netLabel}
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Une pause supprimée ne disparaît pas en silence */}
                                                {supprimeesDuJour.length > 0 && (
                                                  <div
                                                    className="sk-shift-pause-supprimee"
                                                    title={`Pause supprimée${
                                                      supprimeesDuJour.length > 1
                                                        ? ` (${supprimeesDuJour.length})`
                                                        : ""
                                                    } — ${supprimeesDuJour
                                                      .map((l) =>
                                                        [
                                                          `de ${l.debut ? heureLocale(l.debut) : "--:--"}`,
                                                          `à ${l.fin ? heureLocale(l.fin) : "en cours"}`,
                                                          l.source === "presumee"
                                                            ? "présumée"
                                                            : "réelle",
                                                        ].join(" · "),
                                                      )
                                                      .join(" | ")}`}
                                                  >
                                                    <span className="sk-shift-pause-supprimee-titre">
                                                      🗑️ Pause supprimée
                                                      {supprimeesDuJour.length > 1
                                                        ? ` (${supprimeesDuJour.length})`
                                                        : ""}
                                                    </span>
                                                    {supprimeesDuJour[0]?.debut && (
                                                      <span className="sk-shift-pause-supprimee-plage">
                                                        {`de ${heureLocale(
                                                          supprimeesDuJour[0].debut
                                                        )} à ${
                                                          supprimeesDuJour[0]?.fin
                                                            ? heureLocale(supprimeesDuJour[0].fin)
                                                            : "en cours"
                                                        }`}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}

                                                {/* Horaires réellement effectués (pointages) */}
                                                {realAtt && realAtt.firstIn && (
                                                  <div
                                                    className="sk-shift-real"
                                                    title={titreReelDuJour(realAtt)}
                                                  >
                                                    <span>
                                                      Réel {formatRealLabel(realAtt)}
                                                      {sessionEnCours && (
                                                        <span
                                                          className="sk-open-dot"
                                                          aria-hidden="true"
                                                        />
                                                      )}
                                                    </span>
                                                    <span
                                                      className={`sk-real-diff ${
                                                        sortieManquante ? "is-manquante" : ""
                                                      } ${
                                                        !netMins
                                                          ? ""
                                                          : realAtt.minutes < netMins
                                                          ? "is-neg"
                                                          : realAtt.minutes > netMins
                                                          ? "is-pos"
                                                          : ""
                                                      }`}
                                                      title={
                                                        sortieManquante
                                                          ? "Entrée pointée, aucune sortie : la journée n’a pas été fermée — à régulariser depuis la page Pointages."
                                                          : undefined
                                                      }
                                                    >
                                                      {realAtt.lastOut
                                                        ? formatHoursCompact(realAtt.minutes)
                                                        : sortieManquante
                                                        ? "sortie manquante"
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
                                                // Un clic sur une case VIDE ouvrait DROIT la fenêtre
                                                // d'ajustement : les modèles, eux, n'avaient qu'une
                                                // porte — le dock, en haut de l'écran, à attraper
                                                // puis à redescendre. La case ouvre maintenant les
                                                // trois gestes (poser · créer · ajuster). Le dépôt
                                                // armé au doigt garde la priorité : il est absorbé
                                                // plus haut par `onClickCapture`, ce clic n'arrive
                                                // jamais jusqu'ici quand une brique est tenue.
                                                onClick={() => setCaseVide({ emp, dayItem })}
                                                title="Cliquer pour poser un modèle, en créer un, ou ajuster l'horaire de cette case"
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

            {/* Pied de grille : la semaine récapitulée, un chiffre par jour. Le
                geste de dépôt prend la place du chiffre tant qu'un modèle est en
                main ; le filigrane de culture, lui, ne se pose plus ici — la page
                le porte déjà en cadre, au bandeau de commande. */}
            <footer className="sk-bottom-bar">
              <div className="sk-bottom-tete">
                <span className="sk-bottom-etiquette">Collaborateurs</span>
                <strong className="sk-bottom-nombre">{totalActiveEmployees}</strong>
                <span className="sk-bottom-legende">dans la sélection</span>
              </div>

              <div className="sk-bottom-jours">
                {dailyTotals.map((dt) => (
                  <div
                    key={dt.dateStr}
                    className={[
                      "sk-bottom-jour",
                      dt.headcount ? "is-plein" : "",
                      dt.isToday ? "is-today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="sk-bottom-jour-nom">{dt.labelHeader}</span>
                    {draggedPayload ? (
                      <span className="sk-bottom-jour-deposer">Déposer ici</span>
                    ) : (
                      <>
                        <span className="sk-bottom-jour-chiffre">
                          {dt.headcount}
                          <small>pers.</small>
                        </span>
                        <span className="sk-bottom-jour-heures">{dt.hoursLabel}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="sk-bottom-recap">
                <div className="sk-bottom-recap-lignes">
                  <span>
                    Jours couverts
                    <strong> {joursCouverts}/7</strong>
                  </span>
                  <span>
                    Moyenne par jour couvert
                    <strong> {moyenneJourCouvertLabel}</strong>
                  </span>
                </div>
                <span className="sk-bottom-tampon">
                  <small>Heures de la semaine</small>
                  <strong>{totalHeuresSemaineLabel}</strong>
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
                      } ${modeleCopie ? "is-collable" : ""} ${
                        caseCible?.vue === "jour" &&
                        String(caseCible.empId) === String(emp.id) &&
                        caseCible.dateStr === dayItem.dateStr
                          ? "is-cible-collage"
                          : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dayDropEmpId !== emp.id) setDayDropEmpId(emp.id);
                      }}
                      onDragLeave={() => setDayDropEmpId(null)}
                      onDrop={(e) => handleDropOnCell(e, emp, dayItem)}
                      onMouseEnter={() => survolerCase("jour", emp.id, dayItem.dateStr, dayItem.dayNum)}
                      onMouseLeave={() => setCaseCible(null)}
                      onClickCapture={(e) => {
                        if (touchDragPayload) {
                          e.stopPropagation();
                          e.preventDefault();
                          applyTouchDropOnCell(emp, dayItem);
                        }
                      }}
                    >
                      <div className="sk-day-emp">
                        {emp.photo_url ? (
                          <img
                            src={emp.photo_url}
                            alt={`${emp.first_name || ""} ${emp.last_name || ""}`.trim()}
                            className="sk-emp-avatar"
                            style={{ width: 34, height: 34 }}
                          />
                        ) : (
                          <div className="sk-emp-avatar" style={{ width: 34, height: 34 }}>
                            {`${(emp.first_name || "E")[0]}${(emp.last_name || "C")[0]}`.toUpperCase()}
                          </div>
                        )}
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
                            {modeleCopie && (
                              <button
                                type="button"
                                className="sk-case-coller is-jour"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  collerModeleDansCellule(emp, dayItem);
                                }}
                                title={`Coller « ${libelleModele(modeleCopie.template)} »`}
                              >
                                <ClipboardPaste size={12} />
                                Coller « {libelleModele(modeleCopie.template)} »
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
                                  estEnCours(emp, dateStr, real) ? "is-open" : ""
                                } ${sortiesManquantes.has(`${emp.id}|${dateStr}`) ? "is-manquante" : ""}`}
                                style={{
                                  left: `${realLeftPct}%`,
                                  width: `${Math.max(1.5, realWidthPct)}%`,
                                }}
                                title={
                                  real.lastOut
                                    ? titreReelDuJour(real)
                                    : sortiesManquantes.has(`${emp.id}|${dateStr}`)
                                    ? `Entrée pointée à ${heureLocale(
                                        real.firstIn
                                      )} — aucune sortie : journée non fermée (sortie manquante)`
                                    : `Entrée pointée à ${heureLocale(
                                        real.firstIn
                                      )} — sortie pas encore pointée (journée en cours)`
                                }
                              >
                                <span className="sk-day-real-label">
                                  {formatRealLabel(real)}
                                  {estEnCours(emp, dateStr, real) && (
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
                        <PlanningPayslipBadge entries={payslipEntries([emp], dayItem.dateStr)} />
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
            {/* UNE SEULE GRILLE POUR L'EN-TÊTE ET POUR LES CASES. Le mois posait
                deux grilles `repeat(7, 1fr)` l'une sur l'autre : celle des jours,
                réglée sur la largeur du cadre, et celle des cases, poussée par la
                largeur MINIMALE de ses pastilles (un `1fr` ne descend jamais sous
                le `min-content` de son contenu, et les pastilles étaient en
                `nowrap`). Résultat mesuré sur la page du fondateur : six colonnes
                gonflées, la septième écrasée et peinte par-dessus le liseré du
                panneau — la peau Post-it rend le cadre `overflow: visible` pour
                laisser respirer le rabat — et « Jeudi » qui tombe au-dessus du
                mercredi. Ici, l'alignement n'est plus une intention : c'est une
                conséquence. */}
            <div className="sk-matrix-scroll">
              <div className="sk-mois sk-mois--effectif">
                {joursSemaine.map((j) => (
                  <div
                    key={`mois-jour-${j.id}`}
                    className="sk-mois-jour"
                    data-fin-semaine={j.id >= 6 ? "oui" : undefined}
                  >
                    {j.nom}
                  </div>
                ))}
                {calendarWeeks.flat().map((cell) => {
                  if (cell.type === "empty") {
                    // Hors du mois, il n'y a RIEN à montrer : une encoche, pas une
                    // case à 112 px qui affiche zéro compteur pour zéro personne. Douze
                    // de ces fausses cases sur quarante-deux en novembre.
                    return <div key={cell.id} className="sk-mois-encoche" />;
                  }
                  const isSelected = selectedCalendarDay?.date === cell.date;
                  const dayModels = monthModels[cell.date] || [];
                  const isMonthDropOver = monthDropDate === cell.date;
                  const todayIso = toIsoDateLocal(new Date());
                  const isToday = cell.date === todayIso;
                  const cellDayNum = dayNumFromDateStr(cell.date);
                  const jour = moisParJour.get(cell.date) || { rangs: [], minutes: 0, anomalies: 0 };
                  // UN SEUL RANG, UNE SEULE PERSONNE, UN SEUL CLIC. Le choisisseur
                  // n'existe que pour lever l'ambiguïté ; là où il n'y en a pas, il
                  // serait un clic de plus pour une réponse déjà écrite dans la case.
                  const unSeulRang = jour.rangs.length === 1;
                  // La bande de teinte ne se pose que si le jour a UN auteur :
                  // peindre une case collective de la teinte choisie par une seule
                  // personne serait un mensonge de plus dans cette vue.
                  const teinteDuJour = jour.rangs.length === 1 ? jour.rangs[0].teinte : null;
                  const ouvrirLaJournee = () => {
                    setSelectedCalendarDay(cell);
                    setCalendarDate(new Date(`${cell.date}T12:00:00`));
                    setPlanningView("jour");
                  };
                  const classes = [
                    "sk-cal-cell",
                    "sk-mois-case",
                    isMonthDropOver ? "is-drop-over" : "",
                    isToday ? "is-today" : "",
                    isSelected ? "is-selected" : "",
                    touchDragPayload ? "is-touch-armed" : "",
                    modeleCopie ? "is-collable" : "",
                    caseCible?.vue === "mois" && caseCible.dateStr === cell.date
                      ? "is-cible-collage"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      key={cell.id}
                      role="button"
                      tabIndex={0}
                      className={classes}
                      data-fin-semaine={cell.pDay >= 6 ? "oui" : undefined}
                      style={teinteDuJour ? { "--teinte-du-jour": teinteDuJour } : undefined}
                      onClick={() => {
                        if (applyTouchDropOnDay(cell.date)) return;
                        if (unSeulRang) {
                          // Un seul rang, c'est CETTE personne : demander « qui ? »
                          // devant un nom déjà sous les yeux serait un clic de plus
                          // pour une réponse évidente. Et le curseur ne bouge pas —
                          // c'est son déplacement qui partait chercher sept requêtes
                          // et plaquait l'écran de chargement sur la page.
                          const r = jour.rangs[0];
                          ouvrirLaCaseDuJour(r.emp, cell.date, cellDayNum, r.shift, cell.day);
                          return;
                        }
                        setChoixJour({ cell, dayNum: cellDayNum });
                      }}
                      onKeyDown={(e) => {
                        // la même porte, au clavier
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        if (unSeulRang) {
                          const r = jour.rangs[0];
                          ouvrirLaCaseDuJour(r.emp, cell.date, cellDayNum, r.shift, cell.day);
                          return;
                        }
                        setChoixJour({ cell, dayNum: cellDayNum });
                      }}
                      onMouseEnter={() => survolerCase("mois", null, cell.date, cellDayNum)}
                      onMouseLeave={() => setCaseCible(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (monthDropDate !== cell.date) setMonthDropDate(cell.date);
                      }}
                      onDragLeave={() => setMonthDropDate(null)}
                      onDrop={(e) => handleDropOnCalendarDay(e, cell.date)}
                      title={
                        focusFilter.type === "employee"
                          ? "Déposez un modèle : il sera affecté au collaborateur sélectionné"
                          : "Déposez un modèle sur la journée · double-clic ou Entrée pour ouvrir le jour"
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

                      <PlanningPayslipBadge entries={payslipEntries(scopedEmployees, cell.date)} />

                      {modeleCopie && (
                        <button
                          type="button"
                          className="sk-case-coller is-mois"
                          onClick={(e) => {
                            e.stopPropagation();
                            collerModeleSurJour(cell.date);
                          }}
                          title={`Coller « ${libelleModele(modeleCopie.template)} » sur cette journée`}
                        >
                          <ClipboardPaste size={12} />
                          Coller
                        </button>
                      )}

                      <div className="sk-cal-summary sk-mois-chiffre">
                        {cell.isHoliday && cell.holiday?.name ? (
                          <span className="sk-cal-holiday sk-mois-tampon" data-espece="ferie">
                            {cell.holiday.name}
                          </span>
                        ) : jour.rangs.length ? (
                          <>
                            <b>{jour.rangs.length}</b>
                            {` poste${jour.rangs.length > 1 ? "s" : ""} · ${formatHoursCompact(
                              jour.minutes
                            )}`}
                          </>
                        ) : (
                          <span className="sk-mois-vide">
                            {cell.schPlannings.length
                              ? "Modèle posé, aucun nom dans ce focus"
                              : "Aucun poste"}
                          </span>
                        )}
                      </div>

                      {/* QUI EST LÀ, CE JOUR-LÀ. C'est la question qu'on se pose
                          devant un mois ; la pastille du modèle, elle, répondait à
                          côté — un nom tronqué à 78 px répété trente fois. */}
                      <div className="sk-mois-liste">
                        {jour.rangs.slice(0, 4).map((r) => (
                          <span
                            key={r.emp.id}
                            className="sk-mois-rang"
                            draggable={Boolean(r.shift) && !r.shift.isHoliday && !r.shift.isAbsence}
                            onDragStart={(e) =>
                              handleDragStartCellShift(
                                e,
                                r.emp,
                                {
                                  dateStr: cell.date,
                                  dayNum: cellDayNum,
                                  labelHeader: `${r.emp.first_name} ${cell.day}`,
                                },
                                r.shift
                              )
                            }
                            title={`${r.emp.first_name} ${r.emp.last_name || ""} — ${
                              r.shift
                                ? `${r.shift.name || "poste"} · ${r.shift.start_time}-${r.shift.end_time}`
                                : "aucun poste planifié, pointage seul"
                            }${r.real?.firstIn ? ` · ${titreReelDuJour(r.real)}` : ""}`}
                          >
                            <i
                              aria-hidden="true"
                              style={r.teinte ? { "--teinte-du-rang": r.teinte } : undefined}
                            />
                            <span className="sk-mois-nom">
                              {r.emp.first_name} {r.emp.last_name}
                            </span>
                            <b className="sk-mois-heures">
                              {r.shift ? formatHoursCompact(r.minutes) : "pointage seul"}
                            </b>
                            {r.etat && (
                              <em className="sk-mois-tampon" data-espece={r.etat.espece}>
                                {r.etat.mot}
                              </em>
                            )}
                          </span>
                        ))}
                        {jour.rangs.length > 4 && (
                          // Le « +N » n'est pas un compteur : c'est une porte.
                          <button
                            type="button"
                            className="sk-mois-plus"
                            onClick={(e) => {
                              e.stopPropagation();
                              ouvrirLaJournee();
                            }}
                          >
                            +{jour.rangs.length - 4} autres · ouvrir la journée
                          </button>
                        )}
                      </div>

                      {dayModels.length > 0 && (
                        <div className="sk-cal-pills-list sk-mois-depots">
                          {dayModels.map((m, mIdx) => (
                            <span
                              key={`${m.id}-${mIdx}`}
                              className="sk-cal-pill is-daymodel"
                              style={{ "--teinte-du-depot": m.color }}
                              title={m.label || m.name}
                            >
                              <span className="sk-cal-pill-model">{m.label || m.name}</span>
                              {/* Un seul mot, écrit, pas une croix de 16 px posée
                                  sur une vue de lecture. */}
                              <button
                                type="button"
                                className="sk-mois-retirer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMonthModel(cell.date, mIdx);
                                }}
                                title={`Retirer « ${m.label || m.name} » de cette journée`}
                              >
                                Retirer
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        className="sk-mois-ouvrir"
                        onClick={(e) => {
                          e.stopPropagation();
                          ouvrirLaJournee();
                        }}
                      >
                        Ouvrir la journée
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LE PIED, dans les termes de celui de la semaine : une ligne par
                semaine, les heures à droite en colonnes serrées, et le compte des
                jours à vérifier — ce qu'un mois doit laisser lire sans clic. */}
            {semainesDuMois.length > 0 && (
              <div className="sk-mois-pied">
                {semainesDuMois.map((s) => (
                  <div key={s.cle} className="sk-mois-ligne-pied">
                    <span>
                      <em>{s.libelle}</em>
                      {` · ${s.postes} poste${s.postes > 1 ? "s" : ""}`}
                      {s.feries ? ` · ${s.feries} férié${s.feries > 1 ? "s" : ""}` : ""}
                      {s.anomalies ? ` · ${s.anomalies} à vérifier` : ""}
                    </span>
                    <strong>{formatHoursCompact(s.minutes)}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* LA MÊME LÉGENDE QUE DANS LA SECTION FILTRES (24/11, sur la remarque du
                fondateur). Les deux ne disaient pas la même chose avec les mêmes
                mots, et pire : celle du mois alignait quatre carrés peints À LA
                MAIN — `--charte-aplat`, `--charte-alerte`, `--charte-statut-absent`,
                `--charte-douce` — pour décrire une grille qui montre, elle, une
                teinte de modèle et des MOTS d'état cerclés. Une légende qui ne
                ressemble pas à ce qu'elle légende est une seconde peinture à
                entretenir, et c'est exactement ce que la section filtres avait déjà
                réglé. Elle prend donc la structure des filtres (`sk-legend`,
                `sk-legend-group`, `sk-legend-title`, `sk-legend-item`,
                `sk-legend-swatch`) et, pour les états, LE VRAI OBJET de la case
                (`sk-mois-tampon`, `sk-cal-pill.is-daymodel`) : ce qui est écrit en
                bas de la grille est ce qui est écrit dans la case, même élément,
                même feuille. Aucun carré inventé ici, aucune couleur de plus. */}
            <div className="sk-legend sk-mois-legende">
              <span className="sk-legend-group">
                <span className="sk-legend-title">Case du mois</span>
                <span className="sk-legend-item">
                  <span className="sk-legend-swatch" /> poste planifié · la bande et la
                  pastille portent sa teinte
                </span>
                <span className="sk-legend-item">
                  <em className="sk-mois-tampon" data-espece="oubli">
                    oubli de sortie
                  </em>{" "}
                  — à vérifier
                </span>
                <span className="sk-legend-item">
                  <em className="sk-mois-tampon" data-espece="absent">
                    sortie manquante
                  </em>{" "}
                  — non pointé après la fin du poste
                </span>
                <span className="sk-legend-item">
                  <em className="sk-mois-tampon" data-espece="heure">
                    en cours
                  </em>{" "}
                  — journée ouverte, heure de fin non affichée
                </span>
                <span className="sk-legend-item">
                  <em className="sk-mois-tampon" data-espece="repos">
                    repos
                  </em>
                  <em className="sk-mois-tampon" data-espece="conge">
                    congé
                  </em>
                  <em className="sk-mois-tampon" data-espece="ferie">
                    férié
                  </em>
                  jour non travaillé
                </span>
              </span>
              <span className="sk-legend-group">
                <span className="sk-legend-title">Lecture</span>
                {/* Le compte était le mauvais : il écrivait
                    `min(collaborateurs affichés, 4)`, donc « 2 rangées par case au
                    plus » devant deux collaborateurs — alors que la case coupe à
                    QUATRE rangées, quel que soit l'effectif. Le chiffre d'une règle
                    de rendu ne se déduit pas du nombre de lignes du jour. */}
                <span className="sk-legend-item">
                  4 rangées par case au plus, le reste s&apos;ouvre au clic
                </span>
                <span className="sk-legend-item">
                  un clic sur la case ouvre la fenêtre de réglage
                </span>
                <span className="sk-legend-item" title="Un modèle posé en vue mois reste sur CE poste tant qu'il n'est pas enregistré depuis la journée.">
                  <span className="sk-cal-pill is-daymodel">modèle déposé</span> brouillon
                  local, pas encore en base
                </span>
              </span>
            </div>
          </div>
        )}

        {/* 5. VUE DEMANDES DES COLLABORATEURS (schedule_change_requests) */}
        {planningView === "demandes" && (
          <div className="sk-requests-view">
            {/* L'ÉCRAN ENTIER DANS UN SEUL CADRE. Avant le 23/11, le bandeau du haut
                portait le cadre de la maison et la liste flottait hors de lui : deux
                régimes visuels sur un même écran, et une carte de 380 px perdue dans
                un cadre de 1 268 px. */}
            <div className="sk-matrix-card" style={{ padding: 20 }}>
              <div className="sk-requests-head">
                <div>
                  {/* `sk-modal-title` est le titre des FENÊTRES : sa barre de feutre
                      est collée à `left: 0; right: 0`, donc elle prend la largeur du
                      conteneur — sur cette page elle barrait 750 px sous 340 px de
                      texte. Le titre de section a sa classe, et sa barre suit le mot. */}
                  <h2 className="sk-requests-titre">Demandes de changement de planning</h2>
                  {/* Ce que fait le geste, écrit avant le geste. La phrase d'avant
                      promettait « met à jour le planning du collaborateur » : c'est la
                      LIGNE d'horaire entière qui est remplacée, pas la semaine affichée
                      — la différence compte le jour où l'on décide. */}
                  <p className="sk-day-sub">
                    Une demande porte sur la ligne d&apos;horaire du collaborateur, pas sur une
                    semaine : approuver la remplace par l&apos;horaire demandé, refuser ne change
                    rien.
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

              {/* Compteurs / filtres. Le filtre est un INTERRUPTEUR, pas un onglet :
                  `aria-pressed` se lit au clavier, `role` nomme le groupe. */}
              <div
                className="sk-requests-filters"
                role="group"
                aria-label="Filtrer les demandes par statut"
              >
                {[
                  { id: "all", label: "Toutes", count: filteredRequests.length },
                  {
                    id: "pending",
                    label: "En attente",
                    count: filteredRequests.filter((r) => (r.status || "pending") === "pending")
                      .length,
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
                    aria-pressed={requestFilter === f.id}
                    onClick={() => setRequestFilter(f.id)}
                  >
                    {f.label}
                    <span className="sk-request-filter-count">{f.count}</span>
                  </button>
                ))}
              </div>

              {filteredRequests.length > 0 && (
                <p className="sk-requests-memo">
                  {`${filteredRequests.length} demande${
                    filteredRequests.length > 1 ? "s" : ""
                  } au total pour cette entreprise · ${
                    filteredRequests.filter((r) => (r.status || "pending") === "pending").length
                  } à traiter`}
                </p>
              )}

              {visibleRequests.length === 0 ? (
                <div className="sk-requests-empty sk-demandes-vide">
                  <CalendarDays size={26} aria-hidden="true" />
                  <p>
                    {filteredRequests.length === 0
                      ? "Aucune demande pour l'instant. C'est ici que celles des collaborateurs arrivent."
                      : requestFilter === "pending"
                      ? "Rien en attente : toutes les demandes de cette entreprise sont traitées."
                      : requestFilter === "approved"
                      ? "Aucune demande approuvée pour l'instant."
                      : "Aucune demande refusée pour l'instant."}
                  </p>
                  {filteredRequests.length > 0 && (
                    <button
                      type="button"
                      className="sk-btn-secondary"
                      onClick={() => setRequestFilter("all")}
                    >
                      Voir les {filteredRequests.length} demandes
                    </button>
                  )}
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

                    // LES DEUX CÔTÉS DU COMPARAT ONT LA MÊME FORME, sinon la
                    // comparaison ne compare rien : à gauche la ligne d'horaire du
                    // collaborateur telle qu'elle est, à droite ce qui est demandé —
                    // un modèle d'entreprise OU des heures posées à la main, qui
                    // n'arrivent pas dans le même champ.
                    const courant = req.current_schedule || null;
                    const demande = req.use_custom_hours
                      ? {
                          name: "Heures écrites à la main",
                          start_time: req.requested_start_time,
                          end_time: req.requested_end_time,
                          has_break: req.requested_has_break,
                          break_start: req.requested_break_start,
                          break_end: req.requested_break_end,
                          work_days: req.requested_work_days || [],
                        }
                      : req.requested_schedule || null;

                    const joursCourants = courant?.work_days || [];
                    const joursDemandes = demande?.work_days || [];
                    // LES MOTS D'UN CASIER, ÉCRITS UNE SEULE FOIS. Le casier, son
                    // infobulle et la légende du jour sortent du même objet : trois
                    // écritures d'un même état, c'est le chemin le plus court vers une
                    // case qui dit « en plus » sous une légende qui dit « s'ajoute ».
                    const ETATS_CASIER = {
                      identique: { mot: "les deux", phrase: "travaillé des deux côtés" },
                      ajoute: {
                        mot: "en plus",
                        phrase: "demandé, et il ne l'était pas aujourd'hui",
                      },
                      retire: {
                        mot: "en moins",
                        phrase: "travaillé aujourd'hui, et il ne le serait plus",
                      },
                      libre: { mot: "-", phrase: "chômé des deux côtés" },
                    };
                    const jours = joursSemaine.map((j) => {
                      const desDeuxCotes =
                        joursCourants.includes(j.id) && joursDemandes.includes(j.id);
                      const cle = desDeuxCotes
                        ? "identique"
                        : joursDemandes.includes(j.id)
                        ? "ajoute"
                        : joursCourants.includes(j.id)
                        ? "retire"
                        : "libre";
                      return { id: j.id, nom: j.nom, court: j.court, cle, ...ETATS_CASIER[cle] };
                    });
                    const ajoutes = jours.filter((j) => j.cle === "ajoute");
                    const retires = jours.filter((j) => j.cle === "retire");
                    // La phrase ne parle QUE de ce qui bouge ; les deux listes de
                    // jours sont écrites sous chaque côté du comparatif — une fois
                    // l'écart dit, on n'a plus besoin qu'on les raconte.
                    const motsJours = (liste) =>
                      liste.map((j) => j.nom.toLowerCase()).join(", ");
                    const phraseJours = !demande
                      ? "Aucun horaire n'est arrivé — rien à comparer"
                      : !joursCourants.length
                      ? `${
                          courant ? "Aucun jour travaillé aujourd'hui" : "Aucune ligne d'horaire"
                        } : tout ce qui est demandé s'ajoute`
                      : ajoutes.length === 0 && retires.length === 0
                      ? "Les jours travaillés ne changent pas"
                      : [
                          ajoutes.length ? `s'ajoutent : ${motsJours(ajoutes)}` : "",
                          retires.length ? `partent : ${motsJours(retires)}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");

                    // Heures : le différentiel ne s'écrit que si les DEUX côtés en ont.
                    // Annoncer « +8h00 » devant un collaborateur sans ligne d'horaire
                    // serait un chiffre inventé.
                    const heuresDesDeuxCotes = Boolean(
                      courant?.start_time &&
                        courant?.end_time &&
                        demande?.start_time &&
                        demande?.end_time
                    );
                    const deltaMinutes = heuresDesDeuxCotes
                      ? computeShiftNetMinutes(demande) - computeShiftNetMinutes(courant)
                      : 0;
                    const etiquetteDelta = (() => {
                      if (!heuresDesDeuxCotes || !deltaMinutes) return null;
                      const abs = Math.abs(deltaMinutes);
                      const texte = `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}`;
                      return deltaMinutes > 0 ? `+${texte} par jour` : `−${texte} par jour`;
                    })();

                    const etiquetteCote = (obj) =>
                      obj?.start_time
                        ? `${formatTime(obj.start_time)} – ${formatTime(obj.end_time)} · ${formatDuration(
                            obj
                          )} par jour travaillé`
                        : "aucune heure précisée";

                    const dateFr = (horodatage) => {
                      const jour = jourLocal(horodatage);
                      if (!jour) return null;
                      const [a, m, j] = jour.split("-");
                      return `${j}/${m}/${a}`;
                    };
                    const joursDAttente = req.created_at
                      ? Math.max(
                          0,
                          Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400000)
                        )
                      : null;

                    return (
                      <article key={req.id} className={`sk-request-card sk-demande is-${statut}`}>
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
                                ? "En attente"
                                : statut === "approved"
                                ? "Approuvée"
                                : "Refusée"}
                            </span>
                            {/* La date d'abord, le compte de jours ensuite, et jamais
                                les deux pour dire la même chose : « déposée le
                                23/11/2026 » suivi de « déposée aujourd'hui » est une
                                carte qui se répète. Le nombre ne sort que s'il ajoute
                                quelque chose — et un jour d'attente n'est pas une urgence. */}
                            <span className="sk-request-age">
                              {statut === "pending" && joursDAttente === 0
                                ? "déposée aujourd'hui"
                                : statut === "pending"
                                ? `déposée le ${dateFr(req.created_at) || "—"}`
                                : `déposée le ${dateFr(req.created_at) || "—"} · décidée le ${
                                    dateFr(req.reviewed_at) || "—"
                                  }`}
                            </span>
                            {statut === "pending" && joursDAttente > 0 && (
                              <span
                                className="sk-demande-attente"
                                data-urgence={joursDAttente > 7 ? "oui" : undefined}
                              >
                                {`attend depuis ${joursDAttente} jour${joursDAttente > 1 ? "s" : ""}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Comparatif visuel : planning actuel -> planning demandé */}
                        <div className="sk-request-compare">
                          <div className="sk-request-compare-col is-from">
                            <span className="sk-request-compare-label">Aujourd&apos;hui</span>
                            <strong>{courant ? courant.name : "Aucun planning défini"}</strong>
                            {courant && (
                              <span className="sk-request-compare-heures">
                                {etiquetteCote(courant)}
                              </span>
                            )}
                            <span className="sk-request-compare-days">
                              {formatWorkDays(joursCourants)}
                            </span>
                          </div>
                          <span className="sk-request-compare-arrow" aria-hidden="true">
                            →
                          </span>
                          <div className="sk-request-compare-col is-to">
                            <span className="sk-request-compare-label">Demandé</span>
                            <strong>{demande?.name || "Modèle d'horaire non chargé"}</strong>
                            {demande && (
                              <span className="sk-request-compare-heures">
                                {etiquetteCote(demande)}
                              </span>
                            )}
                            <span className="sk-request-compare-days">
                              {formatWorkDays(joursDemandes)}
                            </span>
                            {etiquetteDelta && (
                              <span className="sk-demande-delta" data-sens={deltaMinutes > 0 ? "plus" : "moins"}>
                                {etiquetteDelta}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* LA SEMAINE, EN SEPT CASIERS. C'est la question réelle de
                            l'écran : qu'est-ce qui bouge, jour par jour ? Le texte seul
                            (« Lun - Sam ») ne répondait pas — on ne voyait pas le jour
                            ajouté ni le jour perdu. */}
                        <div className="sk-demande-jours">
                          <div className="sk-demande-jours-legende">
                            <span>{phraseJours}</span>
                            <span className="sk-demande-jours-comptes">
                              <i aria-hidden="true" data-etat="ajoute" />
                              {` ${ajoutes.length} ajouté${ajoutes.length > 1 ? "s" : ""}`}
                              <i aria-hidden="true" data-etat="retire" />
                              {` ${retires.length} retiré${retires.length > 1 ? "s" : ""}`}
                            </span>
                          </div>
                          <div className="sk-demande-jours-grille">
                            {jours.map((j) => (
                              <span
                                key={j.id}
                                className="sk-demande-casier"
                                data-etat={j.cle}
                                title={`${j.nom} — ${j.phrase}`}
                              >
                                <em>{j.court}</em>
                                <b>{j.mot}</b>
                              </span>
                            ))}
                          </div>
                        </div>

                        {req.reason && (
                          <div className="sk-request-reason">
                            <MessageSquare size={13} aria-hidden="true" />
                            <span>
                              {`Motif du collaborateur : « ${req.reason} »`}
                            </span>
                          </div>
                        )}

                        {req.admin_comment && (
                          <div className="sk-request-comment">
                            <Shield size={13} aria-hidden="true" />
                            <span>
                              {`Réponse de l'admin : « ${req.admin_comment} »`}
                              {req.reviewed_at ? ` — ${dateFr(req.reviewed_at)}` : ""}
                            </span>
                          </div>
                        )}

                        <div className="sk-request-actions">
                          {statut === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="sk-btn-publish sk-demande-action"
                                onClick={() => openReviewRequestModal(req, "approved")}
                              >
                                <CheckCircle2 size={14} aria-hidden="true" />
                                Approuver
                              </button>
                              <button
                                type="button"
                                className="sk-btn-secondary sk-demande-action"
                                onClick={() => openReviewRequestModal(req, "rejected")}
                              >
                                <Ban size={14} aria-hidden="true" />
                                Refuser
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="sk-btn-secondary sk-demande-action"
                              onClick={() => openReviewRequestModal(req, "pending")}
                            >
                              <Clock size={14} aria-hidden="true" />
                              Remettre en attente
                            </button>
                          )}
                          {/* Le geste reste, le mot aussi : un pictogramme seul, sur une
                              carte qui décide d'un horaire, n'est pas une étiquette. La
                              confirmation, elle, est déjà une fenêtre du système. */}
                          <button
                            type="button"
                            className="sk-demande-action is-dossier"
                            onClick={() => confirmDeleteRequest(req)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Supprimer la demande
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
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
                <label className="sk-field-label sk-field-label--geste">
                  <input
                    type="checkbox"
                    checked={formData.has_break}
                    onChange={(e) =>
                      setFormData({ ...formData, has_break: e.target.checked })
                    }
                  />
                  <Coffee size={14} />
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
                <div className="sk-modal-pied-ligne">
                  <label className="sk-field-label sk-field-label--geste sk-field-label--sans-marge">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) =>
                        setFormData({ ...formData, is_default: e.target.checked })
                      }
                    />
                    <Zap size={14} />
                    <span>Planning par défaut</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="sk-modal-foot">
              {editingPlanning && (
                <button
                  type="button"
                  className="sk-btn-secondary sk-btn--danger"
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
                  {cellEditContext?.dateStr
                    ? `Une seule case — cette fenêtre ne change que le ${jourViseParLaCase(
                        cellEditContext.dateStr
                      )}`
                    : "Configuration individuelle En-Check"}
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
                <label className="sk-field-label sk-field-label--geste">
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
                  <Shield size={14} />
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
                    <label className="sk-field-label sk-field-label--geste">
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
                      <Coffee size={14} />
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

              {/* Personnalisation de la couleur — la portée se dit dans le titre
                  du champ, pas dans une note qu'on ne lit pas */}
              <div>
                <label className="sk-field-label">
                  <Palette size={13} />{" "}
                  {cellEditContext?.dateStr
                    ? `Couleur du ${jourViseParLaCase(cellEditContext.dateStr)}`
                    : "Couleur de l'horaire"}
                </label>
                <p className="sk-modal-note">
                  {cellEditContext?.dateStr
                    ? "Une seule case : les six autres gardent leur teinte, et les jours sans couleur restent sur celle de l'horaire."
                    : "Toute la ligne, pour les jours qui n'ont pas encore choisi leur teinte. Une case qui a la sienne la garde."}
                </p>
                <div className="sk-color-swatches">
                  {ENCHECK_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`sk-color-swatch ${
                        employeeScheduleForm.custom_color === c.value ? "active" : ""
                      }`}
                      style={{ "--pastille": c.value }}
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
                    value={employeeScheduleForm.custom_color || TEINTE_PAR_DEFAUT}
                    onChange={(e) =>
                      setEmployeeScheduleForm({
                        ...employeeScheduleForm,
                        custom_color: e.target.value,
                      })
                    }
                    title="Couleur libre"
                  />
                </div>
                {cellEditContext?.dateStr && (
                  // Une teinte par case veut dire aussi que la case peut la
                  // rendre : sans ce geste, un clic de trop reste peint pour
                  // toujours et la personne n'ose plus essayer.
                  <button
                    type="button"
                    className="sk-btn-secondary"
                    onClick={handleRetirerTeinteDeLaCase}
                  >
                    Reprendre la teinte de l'horaire
                  </button>
                )}
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
                  <label className="sk-field-label sk-field-label--geste">
                    <input
                      type="checkbox"
                      checked={modelForm.has_break}
                      onChange={(e) =>
                        setModelForm({ ...modelForm, has_break: e.target.checked })
                      }
                    />
                    <Coffee size={14} />
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
                      style={{ "--pastille": c.value }}
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
                className="sk-modele-apercu"
                style={{ "--shift-teinte": modelForm.color || undefined }}
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

      {/* ═══ FENÊTRE DE LA CASE VIDE : POSER · CRÉER · AJUSTER (08/12/2026) ═══
          « je veux qu'on puisse choisir ou créer le modèle (jour, pause, garde
          de nuit etc) en cliquant seulement sur la case vide — donc il faut
          laisser le choix entre ajuster le planning, choisir un modèle ou en
          créer ». Trois sorties, une seule fenêtre, posée sur la case :
          · la liste des briques du dock, telle qu'elle est déjà dessinée — la
            même classe, le même sous-titre, la même teinte en bord gauche ;
          · « Créer un modèle » ouvre la fenêtre de création qui existe déjà
            (`showModelModal`), pas un formulaire bis ;
          · « Ajuster le planning » ouvre la fenêtre de la case, comme avant :
            le geste d'hier n'a pas été enlevé, il est devenu UN CHOIX.
          Rien n'est verrouillé au passage : l'arrière-plan ferme la fenêtre, et
          le × avec lui. */}
      {/* QUI, SUR CETTE JOURNÉE ? — Le choisisseur du mois (23/11). Il n'invente
          aucune fenêtre : une rangée déjà placée ouvre le réglage de la case, une
          rangée vide ouvre le choisisseur de modèles de la vue semaine. Le
          « ouvrir la journée » y trouve enfin une porte écrite, alors qu'il
          n'existait que par un double-clic invisible. */}
      {choixJour && (() => {
        const jourChoisi = moisParJour.get(choixJour.cell.date) || { rangs: [] };
        const placees = jourChoisi.rangs;
        const restees = scopedEmployees.filter((e) => !placees.some((r) => r.emp.id === e.id));
        const dateChoisie = choixJour.cell.date;
        // UNE LIGNE PAR PERSONNE, dans le même ordre que la ligne de la case :
        // ce qui est posé, combien, et l'état qui fâche s'il y en a un. Trois
        // morceaux recollés, pas deux phrases séparées : la fenêtre doit dire la
        // même chose que la grille, mot pour mot.
        const sousRang = (r) =>
          [
            r.shift ? r.shift.name || "poste" : "pointage seul",
            r.shift ? formatHoursCompact(r.minutes) : null,
            r.etat?.mot || null,
          ]
            .filter(Boolean)
            .join(" · ");
        return (
          <div className="sk-modal-backdrop" onClick={() => setChoixJour(null)}>
            <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="sk-modal-head">
                <div>
                  <h2 className="sk-modal-title">
                    Journée du {choixJour.cell.day} — qui, sur cette case ?
                  </h2>
                  {/* LE CHAPEAU DIT LE GESTE, pas une définition de la vue mois, et
                      aucun compte : le compte est déjà dans l'étiquette du groupe
                      en dessous. Deux lignes de majuscules épaisses au-dessus de
                      deux boutons, c'est ce qui « mélangeait les écrits avec les
                      boutons » — le chapeau criait comme un bouton et répétait ce
                      que la liste allait dire. */}
                  <span className="sk-modal-sub">Un clic ouvre le réglage de la personne</span>
                </div>
                <button
                  type="button"
                  className="sk-back-btn"
                  onClick={() => setChoixJour(null)}
                  aria-label="Fermer sans rien changer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="sk-modal-body">
                {placees.length > 0 && (
                  <>
                    <p className="sk-choix-legende">
                      Déjà placé{placees.length > 1 ? "s" : ""} · {placees.length}
                    </p>
                    <div
                      className="sk-choix-modeles"
                      role="group"
                      aria-label="Personnes déjà placées ce jour"
                    >
                      {placees.map((r) => (
                        <button
                          key={r.emp.id}
                          type="button"
                          className="sk-brick sk-brick--choix"
                          style={{ "--brick-color": r.teinte || undefined }}
                          title={`Régler la case de ${r.emp.first_name} ${r.emp.last_name || ""}`}
                          onClick={() =>
                            ouvrirLaCaseDuJour(
                              r.emp,
                              dateChoisie,
                              choixJour.dayNum,
                              r.shift,
                              choixJour.cell.day
                            )
                          }
                        >
                          <span className="sk-brick-title">
                            {r.emp.first_name} {r.emp.last_name || ""}
                          </span>
                          <span className="sk-brick-sub">{sousRang(r)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {restees.length > 0 && (
                  <>
                    <p className="sk-choix-legende">Sans poste ce jour · {restees.length}</p>
                    <div
                      className="sk-choix-modeles"
                      role="group"
                      aria-label="Personnes sans poste ce jour"
                    >
                      {restees.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          className="sk-brick sk-brick--choix"
                          title={`Poser un modèle sur la case de ${e.first_name} ${e.last_name || ""}`}
                          onClick={() =>
                            ouvrirLaCaseDuJour(
                              e,
                              dateChoisie,
                              choixJour.dayNum,
                              null,
                              choixJour.cell.day
                            )
                          }
                        >
                          <span className="sk-brick-title">
                            {e.first_name} {e.last_name || ""}
                          </span>
                          {/* le verbe, pas la phrase : l'étiquette du groupe a déjà
                              dit « sans poste ce jour », et une ligne de texte long
                              dans un bouton le fait ressembler à du texte */}
                          <span className="sk-brick-sub">choisir ou créer un modèle</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {placees.length === 0 && restees.length === 0 && (
                  <span className="sk-modal-sub">
                    Personne dans le périmètre affiché : changez de focus ou
                    d&apos;entreprise pour amener un collaborateur sur ce jour.
                  </span>
                )}
              </div>

              {/* LE PIED PORTE LA SORTIE, PAS LE COIN. La première version de cette
                  fenêtre avait posé son bouton de sortie sur `sk-back-btn` — la
                  classe du × , qui est `position: absolute` dans le coin plié : le
                  bouton quittait le pied, allait s'écraser sur le titre et se
                  repliait en trois lignes de trois syllabes. Le contrat 42 veille
                  sur cette classe : elle n'a le droit d'apparaître qu'une fois par
                  fenêtre, sur le ×. */}
              <div className="sk-modal-foot">
                <button
                  type="button"
                  className="sk-btn-secondary"
                  onClick={() => {
                    const cell = choixJour.cell;
                    setChoixJour(null);
                    setSelectedCalendarDay(cell);
                    setCalendarDate(new Date(`${cell.date}T12:00:00`));
                    setPlanningView("jour");
                  }}
                >
                  Ouvrir la journée
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {caseVide && (
        <div className="sk-modal-backdrop" onClick={() => setCaseVide(null)}>
          <div className="sk-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sk-modal-head">
              <div>
                <h2 className="sk-modal-title">
                  {caseVide.emp.first_name} {caseVide.emp.last_name} —{" "}
                  {caseVide.dayItem.labelHeader}
                </h2>
                <span className="sk-modal-sub">
                  Cette case est vide : posez un modèle, créez celui qui manque,
                  ou ajustez l&apos;horaire à la main
                </span>
              </div>
              <button
                type="button"
                className="sk-back-btn"
                onClick={() => setCaseVide(null)}
                aria-label="Fermer sans rien poser"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sk-modal-body">
              <p className="sk-choix-legende">
                Choisir un modèle · {dockTemplates.length} disponible
                {dockTemplates.length > 1 ? "s" : ""} — jour, pause, garde de
                nuit, repos
                {touchDragPayload ? " (une brique est déjà tenue au doigt : la poser suffit)" : ""}
              </p>

              <div className="sk-choix-modeles" role="group" aria-label="Modèles à poser sur cette case">
                {dockTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="sk-brick sk-brick--choix"
                    style={{ "--brick-color": tpl.color || undefined }}
                    title={`Poser « ${tpl.label} » sur cette case`}
                    onClick={() => poserModeleSurLaCase(tpl)}
                  >
                    <span className="sk-brick-title">
                      {tpl.label}
                      <span className="sk-brick-sub">{soustitreModele(tpl)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sk-modal-foot">
              <button
                type="button"
                className="sk-btn-secondary"
                onClick={() => {
                  const { emp, dayItem } = caseVide;
                  setCaseVide(null);
                  openCellEditorModal(emp, dayItem);
                }}
              >
                <Edit size={13} /> Ajuster le planning
              </button>
              <button
                type="button"
                className="sk-btn-publish"
                onClick={() => {
                  setCaseVide(null);
                  openNewModelModal();
                }}
              >
                <Plus size={13} /> Créer un modèle
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
                  Équipe locale du planning — les équipes officielles se créent dans
                  Employés → Équipes
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
                    <span className="sk-modal-note">
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
                onClick={() => {
                  setShowTeamModal(false);
                  navigate("/employes?vue=equipes");
                }}
                title="Créer et organiser les équipes officielles"
              >
                <Users size={14} /> Page Équipes
              </button>
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
                  className="sk-input sk-input--longue"
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
            className="sk-modal-box sk-modal-box--petite"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sk-modal-head">
              <h2 className="sk-modal-title">Supprimer ce modèle ?</h2>
            </div>
            <div className="sk-modal-body">
              <p className="sk-modal-texte">
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
                className="sk-btn-publish sk-btn--danger-rempli"
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
            className="sk-modal-box sk-modal-box--petite"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sk-modal-head">
              <h2 className="sk-modal-title">Supprimer cette demande ?</h2>
            </div>
            <div className="sk-modal-body">
              <p className="sk-modal-texte">
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
                className="sk-btn-publish sk-btn--danger-rempli"
                onClick={handleDeleteRequest}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CoqueAdmin>
  );
}
