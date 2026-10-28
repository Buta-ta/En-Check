import { supabase } from '../lib/supabase';

// ============================================================
// ÉQUIPES - CRUD
// ============================================================

/**
 * Récupère toutes les équipes d'une entreprise
 * @param {string} enterpriseId - ID de l'entreprise
 * @param {object} options - Options de filtrage
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function getTeams(enterpriseId, options = {}) {
  const {
    includeInactive = false,
    includeMembers = false,
    includeStats = false,
    search = '',
  } = options;

  let query = supabase
    .from('teams')
    .select(`
      *,
      leader:leader_employee_id (
        id,
        first_name,
        last_name,
        photo_url,
        position
      ),
      created_by_admin:created_by (
        id,
        first_name,
        last_name
      )
    `)
    .eq('enterprise_id', enterpriseId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  // Filtre actif/inactif
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  // Recherche par nom
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: teams, error } = await query;

  if (error) {
    console.error('Erreur getTeams:', error);
    return { data: null, error };
  }

  // Si on veut les membres, on les charge séparément
  if (includeMembers && teams?.length > 0) {
    const teamIds = teams.map(t => t.id);
    
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        is_active,
        joined_at,
        employee:employee_id (
          id,
          first_name,
          last_name,
          photo_url,
          position,
          department,
          is_active
        )
      `)
      .in('team_id', teamIds)
      .eq('is_active', true)
      .is('removed_at', null);

    if (!membersError && members) {
      // Associer les membres à chaque équipe
      const membersByTeam = members.reduce((acc, m) => {
        if (!acc[m.team_id]) acc[m.team_id] = [];
        acc[m.team_id].push(m);
        return acc;
      }, {});

      teams.forEach(team => {
        team.members = membersByTeam[team.id] || [];
        team.member_count = team.members.length;
      });
    }
  }

  // Si on veut les stats, on les calcule
  if (includeStats && teams?.length > 0) {
    const teamsWithStats = await Promise.all(
      teams.map(async (team) => {
        const stats = await getTeamStats(team.id);
        return { ...team, stats: stats.data };
      })
    );
    return { data: teamsWithStats, error: null };
  }

  return { data: teams, error: null };
}

/**
 * Les équipes formées, pour plusieurs entreprises d'un coup.
 *
 * La page Équipes interroge une entreprise à la fois ; le planning, lui,
 * peut afficher toutes les entreprises d'un super administrateur. On lit
 * donc les équipes et leurs membres en deux requêtes, quel que soit le
 * nombre d'entreprises — et on rend la même forme que `getTeams` :
 * `members[].employee.id`.
 *
 * @param {string[]} enterpriseIds - Identifiants des entreprises à lire
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getTeamsPourPlanning(enterpriseIds = []) {
  const ids = (Array.isArray(enterpriseIds) ? enterpriseIds : [enterpriseIds])
    .filter(Boolean);

  if (ids.length === 0) return { data: [], error: null };

  const { data: teams, error } = await supabase
    .from('teams')
    .select(`
      id,
      enterprise_id,
      name,
      color,
      leader:leader_employee_id (
        id,
        first_name,
        last_name
      )
    `)
    .in('enterprise_id', ids)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('Erreur getTeamsPourPlanning:', error);
    return { data: null, error };
  }

  if (!teams || teams.length === 0) return { data: [], error: null };

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('id, team_id, employee_id, is_active, removed_at')
    .in('team_id', teams.map((team) => team.id))
    .eq('is_active', true)
    .is('removed_at', null);

  if (membersError) {
    // Les équipes restent utiles même sans leurs membres : on ne casse pas
    // la lecture du planning pour une table secondaire indisponible.
    console.error('Erreur getTeamsPourPlanning (membres):', membersError);
    return { data: teams.map((team) => ({ ...team, members: [] })), error: null };
  }

  const membresParEquipe = (members || []).reduce((acc, membre) => {
    if (!acc[membre.team_id]) acc[membre.team_id] = [];
    acc[membre.team_id].push({ ...membre, employee: { id: membre.employee_id } });
    return acc;
  }, {});

  return {
    data: teams.map((team) => ({
      ...team,
      members: membresParEquipe[team.id] || [],
      member_count: (membresParEquipe[team.id] || []).length,
    })),
    error: null,
  };
}

/**
 * Récupère une équipe par son ID
 * @param {string} teamId - ID de l'équipe
 * @returns {Promise<{data: object, error: Error}>}
 */
export async function getTeamById(teamId) {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      leader:leader_employee_id (
        id,
        first_name,
        last_name,
        photo_url,
        position,
        email,
        phone
      ),
      created_by_admin:created_by (
        id,
        first_name,
        last_name
      ),
      updated_by_admin:updated_by (
        id,
        first_name,
        last_name
      )
    `)
    .eq('id', teamId)
    .is('deleted_at', null)
    .single();

  if (error) {
    console.error('Erreur getTeamById:', error);
    return { data: null, error };
  }

  // Charger les membres
  const { data: members } = await supabase
    .from('team_members')
    .select(`
      id,
      is_active,
      joined_at,
      employee:employee_id (
        id,
        first_name,
        last_name,
        photo_url,
        position,
        department,
        email,
        is_active
      )
    `)
    .eq('team_id', teamId)
    .eq('is_active', true)
    .is('removed_at', null)
    .order('joined_at', { ascending: true });

  data.members = members || [];
  data.member_count = members?.length || 0;

  // Charger les stats
  const { data: stats } = await getTeamStats(teamId);
  data.stats = stats;

  return { data, error: null };
}

/**
 * Crée une nouvelle équipe
 * @param {object} teamData - Données de l'équipe
 * @param {string} adminId - ID de l'admin qui crée
 * @returns {Promise<{data: object, error: Error}>}
 */
export async function createTeam(teamData, adminId) {
  const {
    enterprise_id,
    name,
    description = null,
    color = '#D4AF37',
    leader_employee_id = null,
    initial_members = [], // Array d'IDs d'employés
  } = teamData;

  // Validation
  if (!enterprise_id || !name?.trim()) {
    return { 
      data: null, 
      error: new Error('enterprise_id et name sont requis') 
    };
  }

  // Vérifier que le nom n'existe pas déjà
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('enterprise_id', enterprise_id)
    .ilike('name', name.trim())
    .is('deleted_at', null)
    .single();

  if (existing) {
    return { 
      data: null, 
      error: new Error('Une équipe avec ce nom existe déjà') 
    };
  }

  // Créer l'équipe
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      enterprise_id,
      name: name.trim(),
      description,
      color,
      leader_employee_id,
      created_by: adminId,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur createTeam:', error);
    return { data: null, error };
  }

  // Ajouter les membres initiaux si fournis
  if (initial_members.length > 0) {
    const membersToInsert = initial_members.map(employeeId => ({
      team_id: team.id,
      employee_id: employeeId,
      is_active: true,
    }));

    await supabase.from('team_members').insert(membersToInsert);
  }

  // Si un leader est défini et n'est pas dans les membres, l'ajouter
  if (leader_employee_id && !initial_members.includes(leader_employee_id)) {
    await supabase.from('team_members').insert({
      team_id: team.id,
      employee_id: leader_employee_id,
      is_active: true,
    });
  }

  // Retourner l'équipe complète
  return getTeamById(team.id);
}

/**
 * Met à jour une équipe
 * @param {string} teamId - ID de l'équipe
 * @param {object} updates - Champs à mettre à jour
 * @param {string} adminId - ID de l'admin qui modifie
 * @returns {Promise<{data: object, error: Error}>}
 */
export async function updateTeam(teamId, updates, adminId) {
  const allowedFields = [
    'name', 'description', 'color', 'leader_employee_id', 'is_active'
  ];

  const sanitizedUpdates = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key];
      return obj;
    }, {});

  sanitizedUpdates.updated_by = adminId;
  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('teams')
    .update(sanitizedUpdates)
    .eq('id', teamId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    console.error('Erreur updateTeam:', error);
    return { data: null, error };
  }

  return getTeamById(teamId);
}

/**
 * Supprime une équipe (soft delete)
 * @param {string} teamId - ID de l'équipe
 * @param {string} adminId - ID de l'admin qui supprime
 * @returns {Promise<{success: boolean, error: Error}>}
 */
export async function deleteTeam(teamId, adminId) {
  // Vérifier s'il y a des tâches en cours
  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('team_id', teamId)
    .in('status', ['assigned', 'in_progress', 'pending'])
    .is('deleted_at', null)
    .limit(1);

  if (activeTasks?.length > 0) {
    return { 
      success: false, 
      error: new Error('Impossible de supprimer : cette équipe a des tâches en cours') 
    };
  }

  const { error } = await supabase
    .from('teams')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: adminId,
      is_active: false,
    })
    .eq('id', teamId);

  if (error) {
    console.error('Erreur deleteTeam:', error);
    return { success: false, error };
  }

  // Désactiver aussi tous les membres
  await supabase
    .from('team_members')
    .update({
      is_active: false,
      removed_at: new Date().toISOString(),
    })
    .eq('team_id', teamId);

  return { success: true, error: null };
}


// ============================================================
// MEMBRES D'ÉQUIPE
// ============================================================

/**
 * Ajoute un ou plusieurs membres à une équipe
 * @param {string} teamId - ID de l'équipe
 * @param {string|string[]} employeeIds - ID(s) de l'employé/des employés
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function addTeamMembers(teamId, employeeIds) {
  const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds];

  // Vérifier les membres existants pour éviter les doublons
  const { data: existing } = await supabase
    .from('team_members')
    .select('employee_id')
    .eq('team_id', teamId)
    .in('employee_id', ids);

  const existingIds = existing?.map(e => e.employee_id) || [];
  
  // Réactiver les membres existants inactifs
  if (existingIds.length > 0) {
    await supabase
      .from('team_members')
      .update({ 
        is_active: true, 
        removed_at: null,
        joined_at: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .in('employee_id', existingIds);
  }

  // Ajouter les nouveaux membres
  const newIds = ids.filter(id => !existingIds.includes(id));
  
  if (newIds.length > 0) {
    const membersToInsert = newIds.map(employeeId => ({
      team_id: teamId,
      employee_id: employeeId,
      is_active: true,
    }));

    const { error } = await supabase
      .from('team_members')
      .insert(membersToInsert);

    if (error) {
      console.error('Erreur addTeamMembers:', error);
      return { data: null, error };
    }
  }

  // Retourner la liste mise à jour
  return getTeamMembers(teamId);
}

/**
 * Retire un membre d'une équipe
 * @param {string} teamId - ID de l'équipe
 * @param {string} employeeId - ID de l'employé
 * @returns {Promise<{success: boolean, error: Error}>}
 */
export async function removeTeamMember(teamId, employeeId) {
  // Vérifier si c'est le leader
  const { data: team } = await supabase
    .from('teams')
    .select('leader_employee_id')
    .eq('id', teamId)
    .single();

  if (team?.leader_employee_id === employeeId) {
    return { 
      success: false, 
      error: new Error('Impossible de retirer le leader. Changez d\'abord le leader de l\'équipe.') 
    };
  }

  const { error } = await supabase
    .from('team_members')
    .update({
      is_active: false,
      removed_at: new Date().toISOString(),
    })
    .eq('team_id', teamId)
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Erreur removeTeamMember:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Récupère les membres d'une équipe
 * @param {string} teamId - ID de l'équipe
 * @param {boolean} includeInactive - Inclure les membres inactifs
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function getTeamMembers(teamId, includeInactive = false) {
  let query = supabase
    .from('team_members')
    .select(`
      id,
      is_active,
      joined_at,
      removed_at,
      employee:employee_id (
        id,
        first_name,
        last_name,
        photo_url,
        position,
        department,
        email,
        phone,
        is_active
      )
    `)
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true).is('removed_at', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erreur getTeamMembers:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Récupère les équipes d'un employé
 * @param {string} employeeId - ID de l'employé
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function getEmployeeTeams(employeeId) {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      id,
      joined_at,
      team:team_id (
        id,
        name,
        description,
        color,
        is_active,
        leader_employee_id
      )
    `)
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .is('removed_at', null);

  if (error) {
    console.error('Erreur getEmployeeTeams:', error);
    return { data: null, error };
  }

  // Filtrer les équipes actives et non supprimées
  const activeTeams = data?.filter(d => 
    d.team?.is_active && !d.team?.deleted_at
  ) || [];

  return { data: activeTeams, error: null };
}

/**
 * Change le leader d'une équipe
 * @param {string} teamId - ID de l'équipe
 * @param {string} newLeaderId - ID du nouvel employé leader
 * @param {string} adminId - ID de l'admin qui fait le changement
 * @returns {Promise<{data: object, error: Error}>}
 */
export async function changeTeamLeader(teamId, newLeaderId, adminId) {
  // Vérifier que le nouvel employé est membre de l'équipe
  const { data: isMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('employee_id', newLeaderId)
    .eq('is_active', true)
    .single();

  if (!isMember) {
    // L'ajouter à l'équipe d'abord
    await addTeamMembers(teamId, newLeaderId);
  }

  return updateTeam(teamId, { leader_employee_id: newLeaderId }, adminId);
}


// ============================================================
// STATISTIQUES D'ÉQUIPE
// ============================================================

/**
 * Récupère les statistiques d'une équipe
 * @param {string} teamId - ID de l'équipe
 * @returns {Promise<{data: object, error: Error}>}
 */
export async function getTeamStats(teamId) {
  try {
    // Nombre de membres actifs
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('is_active', true);

    // Tâches par statut
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status, actual_duration_seconds, expected_duration_minutes, performance_score')
      .eq('team_id', teamId)
      .is('deleted_at', null);

    const taskStats = {
      total: tasks?.length || 0,
      assigned: tasks?.filter(t => t.status === 'assigned').length || 0,
      in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
      completed: tasks?.filter(t => t.status === 'completed').length || 0,
      rejected: tasks?.filter(t => t.status === 'rejected').length || 0,
      cancelled: tasks?.filter(t => t.status === 'cancelled').length || 0,
    };

    // Calcul du taux de complétion
    const completableTasks = taskStats.total - taskStats.cancelled;
    const completionRate = completableTasks > 0 
      ? Math.round((taskStats.completed / completableTasks) * 100) 
      : 0;

    // Performance moyenne (tâches complétées avec score)
    const scoredTasks = tasks?.filter(t => 
      t.status === 'completed' && t.performance_score != null
    ) || [];
    
    const avgPerformance = scoredTasks.length > 0
      ? Math.round(scoredTasks.reduce((sum, t) => sum + t.performance_score, 0) / scoredTasks.length)
      : null;

    return {
      data: {
        member_count: memberCount || 0,
        tasks: taskStats,
        completion_rate: completionRate,
        avg_performance_score: avgPerformance,
      },
      error: null,
    };
  } catch (error) {
    console.error('Erreur getTeamStats:', error);
    return { data: null, error };
  }
}

/**
 * Récupère les employés disponibles pour être ajoutés à une équipe
 * (employés de l'entreprise qui ne sont pas déjà dans cette équipe)
 * @param {string} enterpriseId - ID de l'entreprise
 * @param {string} teamId - ID de l'équipe
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function getAvailableEmployeesForTeam(enterpriseId, teamId) {
  // Récupérer les IDs des membres actuels
  const { data: currentMembers } = await supabase
    .from('team_members')
    .select('employee_id')
    .eq('team_id', teamId)
    .eq('is_active', true);

  const currentMemberIds = currentMembers?.map(m => m.employee_id) || [];

  // Récupérer tous les employés actifs de l'entreprise
  let query = supabase
    .from('employees')
    .select('id, first_name, last_name, photo_url, position, department')
    .eq('enterprise_id', enterpriseId)
    .eq('is_active', true)
    .order('first_name', { ascending: true });

  // Exclure les membres actuels
  if (currentMemberIds.length > 0) {
    query = query.not('id', 'in', `(${currentMemberIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erreur getAvailableEmployeesForTeam:', error);
    return { data: null, error };
  }

  return { data, error: null };
}


// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================

export default {
  // CRUD Équipes
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  
  // Membres
  addTeamMembers,
  removeTeamMember,
  getTeamMembers,
  getEmployeeTeams,
  changeTeamLeader,
  
  // Stats & Utils
  getTeamStats,
  getAvailableEmployeesForTeam,
};


// ============================================================
// 🆕 ANALYTICS & PRÉDICTIONS (#13, #14, #15, #16, #17, #8, #24)
// À ajouter à la fin de votre teamService.js existant
// ============================================================

/**
 * #13 - Récupère les employés orphelins (pas dans aucune équipe)
 * @param {string} enterpriseId - ID de l'entreprise
 * @returns {Promise<{data: Array, count: number, error: Error}>}
 */
export async function getOrphanEmployees(enterpriseId) {
  try {
    // Tous les employés actifs
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('id, first_name, last_name, photo_url, position, department, hire_date')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true);

    // Employés qui sont dans au moins une équipe active
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select(`
        employee_id,
        team:team_id (enterprise_id, deleted_at)
      `)
      .eq('is_active', true)
      .is('removed_at', null);

    // Filtrer pour ne garder que ceux de cette entreprise
    const employeesInTeams = new Set(
      teamMembers
        ?.filter(tm => tm.team?.enterprise_id === enterpriseId && !tm.team?.deleted_at)
        ?.map(tm => tm.employee_id) || []
    );

    const orphans = allEmployees?.filter(emp => !employeesInTeams.has(emp.id)) || [];

    // Récupérer les équipes pour suggestions basées sur département
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, color')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('deleted_at', null);

    const orphansWithSuggestions = orphans.map(orphan => {
      const suggestedTeams = teams?.filter(team => {
        const teamName = team.name.toLowerCase();
        const dept = (orphan.department || '').toLowerCase();
        const position = (orphan.position || '').toLowerCase();
        return teamName.includes(dept) || dept.includes(teamName) || teamName.includes(position);
      }).slice(0, 2) || [];

      return {
        ...orphan,
        days_since_hire: orphan.hire_date
          ? Math.floor((Date.now() - new Date(orphan.hire_date)) / (1000 * 60 * 60 * 24))
          : null,
        suggested_teams: suggestedTeams
      };
    });

    return { data: orphansWithSuggestions, count: orphansWithSuggestions.length, error: null };
  } catch (error) {
    console.error('Erreur getOrphanEmployees:', error);
    return { data: [], count: 0, error };
  }
}

/**
 * #14 - Dashboard santé des équipes
 * @param {string} enterpriseId - ID de l'entreprise
 * @param {number} dateRange - Nombre de jours à analyser (défaut: 30)
 * @returns {Promise<{data: Array, global: object, error: Error}>}
 */
export async function getTeamHealthMetrics(enterpriseId, dateRange = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Équipes avec membres
    const { data: teams } = await supabase
      .from('teams')
      .select(`
        id, name, color, leader_employee_id,
        team_members (employee_id, is_active)
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true)
      .is('deleted_at', null);

    // Pointages de la période
    const { data: attendances } = await supabase
      .from('attendances')
      .select('employee_id, check_time, check_type, is_within_zone')
      .eq('enterprise_id', enterpriseId)
      .gte('check_time', startDateStr);

    // Absences de la période
    const { data: absences } = await supabase
      .from('absences')
      .select('employee_id, start_date, end_date')
      .eq('enterprise_id', enterpriseId)
      .gte('end_date', startDateStr)
      .eq('status', 'approuve');

    // Tâches de la période
    const { data: tasks } = await supabase
      .from('tasks')
      .select('team_id, assigned_employee_id, status, due_at, performance_score')
      .eq('enterprise_id', enterpriseId)
      .is('deleted_at', null)
      .gte('created_at', startDateStr);

    const healthMetrics = teams?.map(team => {
      const activeMembers = team.team_members?.filter(m => m.is_active) || [];
      const memberIds = activeMembers.map(m => m.employee_id);
      const memberCount = activeMembers.length;

      // Présence
      const teamCheckIns = attendances?.filter(a =>
        memberIds.includes(a.employee_id) && a.check_type === 'IN'
      ) || [];
      const expectedDays = memberCount * dateRange * 0.71; // ~5j/7
      const presenceRate = expectedDays > 0
        ? Math.min(100, Math.round((teamCheckIns.length / expectedDays) * 100))
        : 0;

      // Conformité géo
      const geoCompliance = teamCheckIns.length > 0
        ? Math.round((teamCheckIns.filter(a => a.is_within_zone).length / teamCheckIns.length) * 100)
        : 100;

      // Absences
      const teamAbsences = absences?.filter(a => memberIds.includes(a.employee_id)) || [];
      const absenceDays = teamAbsences.reduce((sum, abs) => {
        return sum + Math.max(1, Math.ceil((new Date(abs.end_date) - new Date(abs.start_date)) / 86400000));
      }, 0);
      const absenceRate = expectedDays > 0 ? Math.round((absenceDays / expectedDays) * 100) : 0;

      // Tâches
      const teamTasks = tasks?.filter(t =>
        t.team_id === team.id || memberIds.includes(t.assigned_employee_id)
      ) || [];
      const completedTasks = teamTasks.filter(t => t.status === 'completed');
      const taskCompletionRate = teamTasks.length > 0
        ? Math.round((completedTasks.length / teamTasks.length) * 100)
        : null;
      const overdueTasks = teamTasks.filter(t =>
        t.due_at && new Date(t.due_at) < new Date() && t.status !== 'completed' && t.status !== 'cancelled'
      ).length;

      // Score de santé global (0-100)
      let healthScore = 0;
      let factors = 0;
      if (presenceRate > 0) { healthScore += presenceRate * 0.3; factors++; }
      if (geoCompliance > 0) { healthScore += geoCompliance * 0.15; factors++; }
      if (taskCompletionRate !== null) { healthScore += taskCompletionRate * 0.25; factors++; }
      healthScore += (100 - Math.min(absenceRate * 2, 100)) * 0.15; factors++;
      if (team.leader_employee_id) { healthScore += 15; }
      healthScore = Math.min(100, Math.max(0, Math.round(healthScore)));

      // Statut
      let status = 'healthy';
      if (healthScore < 50) status = 'critical';
      else if (healthScore < 70) status = 'warning';

      // Alertes
      const alerts = [];
      if (!team.leader_employee_id) alerts.push({ type: 'warning', message: 'Aucun leader' });
      if (memberCount === 0) alerts.push({ type: 'critical', message: 'Équipe vide' });
      if (presenceRate < 60 && presenceRate > 0) alerts.push({ type: 'warning', message: `Présence: ${presenceRate}%` });
      if (absenceRate > 20) alerts.push({ type: 'warning', message: `Absences: ${absenceRate}%` });
      if (overdueTasks > 0) alerts.push({ type: 'warning', message: `${overdueTasks} tâche(s) en retard` });

      return {
        team_id: team.id,
        team_name: team.name,
        team_color: team.color,
        has_leader: !!team.leader_employee_id,
        member_count: memberCount,
        health_score: healthScore,
        status,
        metrics: {
          presence_rate: presenceRate,
          absence_rate: absenceRate,
          geo_compliance: geoCompliance,
          task_completion_rate: taskCompletionRate,
          overdue_tasks: overdueTasks
        },
        alerts
      };
    }) || [];

    // Trier par score (critiques en premier)
    healthMetrics.sort((a, b) => a.health_score - b.health_score);

    const globalStats = {
      total_teams: healthMetrics.length,
      healthy_teams: healthMetrics.filter(t => t.status === 'healthy').length,
      warning_teams: healthMetrics.filter(t => t.status === 'warning').length,
      critical_teams: healthMetrics.filter(t => t.status === 'critical').length,
      avg_health_score: healthMetrics.length > 0
        ? Math.round(healthMetrics.reduce((s, t) => s + t.health_score, 0) / healthMetrics.length)
        : 0,
      teams_without_leader: healthMetrics.filter(t => !t.has_leader).length
    };

    return { data: healthMetrics, global: globalStats, error: null };
  } catch (error) {
    console.error('Erreur getTeamHealthMetrics:', error);
    return { data: [], global: null, error };
  }
}

/**
 * #15 - Alertes prédictives contextuelles
 * @param {string} enterpriseId - ID de l'entreprise
 * @returns {Promise<{data: Array, count: number, by_severity: object, error: Error}>}
 */
export async function getTeamAlerts(enterpriseId) {
  try {
    const alerts = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Données
    const [teamsRes, membersRes, employeesRes, attendancesRes, leavesRes, tasksRes] = await Promise.all([
      supabase.from('teams').select('id, name, leader_employee_id, color').eq('enterprise_id', enterpriseId).eq('is_active', true).is('deleted_at', null),
      supabase.from('team_members').select('team_id, employee_id').eq('is_active', true).is('removed_at', null),
      supabase.from('employees').select('id, first_name, last_name').eq('enterprise_id', enterpriseId).eq('is_active', true),
      supabase.from('attendances').select('employee_id, check_time, check_type').eq('enterprise_id', enterpriseId).gte('check_time', thirtyDaysAgo.toISOString()),
      supabase.from('leave_requests').select('employee_id, start_date, end_date').eq('enterprise_id', enterpriseId).eq('status', 'approved').gte('end_date', now.toISOString().split('T')[0]).lte('start_date', sevenDaysAhead.toISOString().split('T')[0]),
      supabase.from('tasks').select('team_id, status, due_at').eq('enterprise_id', enterpriseId).in('status', ['pending', 'in_progress', 'assigned']).is('deleted_at', null)
    ]);

    const teams = teamsRes.data || [];
    const members = membersRes.data || [];
    const employees = employeesRes.data || [];
    const attendances = attendancesRes.data || [];
    const leaves = leavesRes.data || [];
    const tasks = tasksRes.data || [];

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // 1. Équipes sans leader
    teams.filter(t => !t.leader_employee_id).forEach(team => {
      alerts.push({
        id: `no-leader-${team.id}`,
        type: 'team_no_leader',
        severity: 'warning',
        team_id: team.id,
        team_name: team.name,
        team_color: team.color,
        message: `"${team.name}" n'a pas de leader`,
        icon: 'crown',
        actionable: true
      });
    });

    // 2. Employés dans trop d'équipes (>= 4)
    const empTeamCount = new Map();
    members.forEach(m => empTeamCount.set(m.employee_id, (empTeamCount.get(m.employee_id) || 0) + 1));
    empTeamCount.forEach((count, empId) => {
      if (count >= 4) {
        const emp = employeeMap.get(empId);
        if (emp) {
          alerts.push({
            id: `overloaded-${empId}`,
            type: 'employee_overloaded',
            severity: 'warning',
            message: `${emp.first_name} ${emp.last_name} est dans ${count} équipes`,
            icon: 'alert-triangle'
          });
        }
      }
    });

    // 3. Congés à venir impactant les équipes
    const leavesByTeam = new Map();
    leaves.forEach(leave => {
      members.filter(m => m.employee_id === leave.employee_id).forEach(m => {
        if (!leavesByTeam.has(m.team_id)) leavesByTeam.set(m.team_id, []);
        leavesByTeam.get(m.team_id).push(leave);
      });
    });
    leavesByTeam.forEach((teamLeaves, teamId) => {
      if (teamLeaves.length >= 2) {
        const team = teams.find(t => t.id === teamId);
        alerts.push({
          id: `leaves-${teamId}`,
          type: 'upcoming_absences',
          severity: 'info',
          team_id: teamId,
          team_name: team?.name,
          team_color: team?.color,
          message: `${teamLeaves.length} membre(s) de "${team?.name}" en congé bientôt`,
          icon: 'calendar'
        });
      }
    });

    // 4. Membres inactifs (pas pointé depuis 15 jours)
    const lastCheckIn = new Map();
    attendances.filter(a => a.check_type === 'IN').forEach(a => {
      const existing = lastCheckIn.get(a.employee_id);
      if (!existing || new Date(a.check_time) > new Date(existing)) {
        lastCheckIn.set(a.employee_id, a.check_time);
      }
    });
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const inactiveByTeam = new Map();
    members.forEach(m => {
      const last = lastCheckIn.get(m.employee_id);
      if (!last || new Date(last) < fifteenDaysAgo) {
        inactiveByTeam.set(m.team_id, (inactiveByTeam.get(m.team_id) || 0) + 1);
      }
    });
    inactiveByTeam.forEach((count, teamId) => {
      if (count >= 2) {
        const team = teams.find(t => t.id === teamId);
        alerts.push({
          id: `inactive-${teamId}`,
          type: 'inactive_members',
          severity: count >= 3 ? 'warning' : 'info',
          team_id: teamId,
          team_name: team?.name,
          team_color: team?.color,
          message: `${count} membre(s) de "${team?.name}" inactifs (+15j)`,
          icon: 'user-x'
        });
      }
    });

    // 5. Tâches en retard par équipe
    const overdueByTeam = new Map();
    tasks.filter(t => t.due_at && new Date(t.due_at) < now && t.team_id).forEach(t => {
      overdueByTeam.set(t.team_id, (overdueByTeam.get(t.team_id) || 0) + 1);
    });
    overdueByTeam.forEach((count, teamId) => {
      if (count >= 3) {
        const team = teams.find(t => t.id === teamId);
        alerts.push({
          id: `overdue-${teamId}`,
          type: 'overdue_tasks',
          severity: count >= 5 ? 'critical' : 'warning',
          team_id: teamId,
          team_name: team?.name,
          team_color: team?.color,
          message: `${count} tâches en retard pour "${team?.name}"`,
          icon: 'clock'
        });
      }
    });

    // Trier par sévérité
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      data: alerts,
      count: alerts.length,
      by_severity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length
      },
      error: null
    };
  } catch (error) {
    console.error('Erreur getTeamAlerts:', error);
    return { data: [], count: 0, by_severity: {}, error };
  }
}

/**
 * #16 - Détection automatique d'équipes à créer
 * @param {string} enterpriseId - ID de l'entreprise
 * @returns {Promise<{data: Array, count: number, total_orphans: number, error: Error}>}
 */
export async function detectPotentialTeams(enterpriseId) {
  try {
    const suggestions = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Données
    const [employeesRes, attendancesRes, teamsRes, membersRes, geofencesRes] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, department, position, schedule_id').eq('enterprise_id', enterpriseId).eq('is_active', true),
      supabase.from('attendances').select('employee_id, geofence_id').eq('enterprise_id', enterpriseId).gte('check_time', thirtyDaysAgo.toISOString()).eq('check_type', 'IN'),
      supabase.from('teams').select('id, name').eq('enterprise_id', enterpriseId).eq('is_active', true).is('deleted_at', null),
      supabase.from('team_members').select('employee_id').eq('is_active', true),
      supabase.from('geofences').select('id, name').eq('enterprise_id', enterpriseId).eq('is_active', true)
    ]);

    const employees = employeesRes.data || [];
    const attendances = attendancesRes.data || [];
    const existingTeams = teamsRes.data || [];
    const teamMembers = membersRes.data || [];
    const geofences = geofencesRes.data || [];

    const employeesInTeams = new Set(teamMembers.map(tm => tm.employee_id));
    const employeesWithoutTeam = employees.filter(e => !employeesInTeams.has(e.id));

    const colors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'];

    // 1. Clustering par DÉPARTEMENT
    const byDepartment = new Map();
    employeesWithoutTeam.forEach(emp => {
      const dept = emp.department || 'Sans département';
      if (!byDepartment.has(dept)) byDepartment.set(dept, []);
      byDepartment.get(dept).push(emp);
    });

    byDepartment.forEach((emps, dept) => {
      if (emps.length >= 3 && dept !== 'Sans département') {
        const similarExists = existingTeams.some(t =>
          t.name.toLowerCase().includes(dept.toLowerCase()) ||
          dept.toLowerCase().includes(t.name.toLowerCase())
        );
        if (!similarExists) {
          suggestions.push({
            id: `dept-${dept.toLowerCase().replace(/\s+/g, '-')}`,
            type: 'department',
            name: `Équipe ${dept}`,
            reason: `${emps.length} employés du département "${dept}" sans équipe`,
            employees: emps.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}`, position: e.position })),
            employee_ids: emps.map(e => e.id),
            confidence: Math.min(95, 60 + emps.length * 5),
            suggested_color: colors[Math.abs(dept.charCodeAt(0) || 0) % colors.length]
          });
        }
      }
    });

    // 2. Clustering par SITE/GEOFENCE
    if (geofences.length > 0) {
      const byGeofence = new Map();
      attendances.forEach(att => {
        if (att.geofence_id && !employeesInTeams.has(att.employee_id)) {
          if (!byGeofence.has(att.geofence_id)) byGeofence.set(att.geofence_id, new Set());
          byGeofence.get(att.geofence_id).add(att.employee_id);
        }
      });

      byGeofence.forEach((empIds, geofenceId) => {
        const geofence = geofences.find(g => g.id === geofenceId);
        const empIdsArray = Array.from(empIds);
        if (empIdsArray.length >= 3 && geofence) {
          const similarExists = existingTeams.some(t =>
            t.name.toLowerCase().includes(geofence.name.toLowerCase())
          );
          if (!similarExists) {
            const emps = employees.filter(e => empIdsArray.includes(e.id));
            suggestions.push({
              id: `site-${geofenceId}`,
              type: 'geolocation',
              name: `Équipe Site ${geofence.name}`,
              reason: `${empIdsArray.length} employés pointent sur "${geofence.name}"`,
              employees: emps.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })),
              employee_ids: empIdsArray,
              confidence: Math.min(90, 50 + empIdsArray.length * 8),
              suggested_color: colors[Math.abs(geofence.name.charCodeAt(0) || 0) % colors.length],
              geofence_id: geofenceId
            });
          }
        }
      });
    }

    // Trier par confiance
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return {
      data: suggestions,
      count: suggestions.length,
      total_orphans: employeesWithoutTeam.length,
      error: null
    };
  } catch (error) {
    console.error('Erreur detectPotentialTeams:', error);
    return { data: [], count: 0, total_orphans: 0, error };
  }
}

/**
 * #17 - Prédiction de besoin de recrutement par équipe
 * @param {string} enterpriseId - ID de l'entreprise
 * @returns {Promise<{data: Array, count: number, error: Error}>}
 */
export async function predictStaffingNeeds(enterpriseId) {
  try {
    const predictions = [];
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Données
    const [teamsRes, membersRes, absencesRes, tasksRes] = await Promise.all([
      supabase.from('teams').select('id, name, color').eq('enterprise_id', enterpriseId).eq('is_active', true).is('deleted_at', null),
      supabase.from('team_members').select('team_id, employee_id').eq('is_active', true),
      supabase.from('absences').select('employee_id, start_date, end_date').eq('enterprise_id', enterpriseId).gte('end_date', sixtyDaysAgo.toISOString().split('T')[0]),
      supabase.from('tasks').select('team_id, status, actual_duration_seconds, expected_duration_minutes').eq('enterprise_id', enterpriseId).is('deleted_at', null).gte('created_at', sixtyDaysAgo.toISOString())
    ]);

    const teams = teamsRes.data || [];
    const members = membersRes.data || [];
    const absences = absencesRes.data || [];
    const tasks = tasksRes.data || [];

    teams.forEach(team => {
      const teamMembers = members.filter(m => m.team_id === team.id);
      const memberIds = teamMembers.map(m => m.employee_id);
      const teamSize = teamMembers.length;
      if (teamSize === 0) return;

      // Taux d'absence
      const teamAbsences = absences.filter(a => memberIds.includes(a.employee_id));
      const absenceDays = teamAbsences.reduce((sum, abs) => {
        return sum + Math.max(1, Math.ceil((new Date(abs.end_date) - new Date(abs.start_date)) / 86400000));
      }, 0);
      const avgAbsenceRate = (absenceDays / (teamSize * 60)) * 100;

      // Charge de travail
      const teamTasks = tasks.filter(t => t.team_id === team.id);
      const pendingTasks = teamTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
      const tasksPerMember = pendingTasks.length / teamSize;

      // Dépassements de temps
      const completedWithTime = teamTasks.filter(t =>
        t.status === 'completed' && t.actual_duration_seconds && t.expected_duration_minutes
      );
      let avgOverrun = 0;
      if (completedWithTime.length > 0) {
        avgOverrun = completedWithTime.reduce((sum, t) => {
          const expected = t.expected_duration_minutes * 60;
          return sum + ((t.actual_duration_seconds - expected) / expected) * 100;
        }, 0) / completedWithTime.length;
      }

      // Analyse
      let needsRecruiting = false;
      let urgency = 'low';
      const reasons = [];

      if (avgAbsenceRate > 15) {
        needsRecruiting = true;
        reasons.push(`Absences élevées (${Math.round(avgAbsenceRate)}%)`);
        if (avgAbsenceRate > 25) urgency = 'high';
      }
      if (tasksPerMember > 5) {
        needsRecruiting = true;
        reasons.push(`Charge élevée (${tasksPerMember.toFixed(1)} tâches/pers)`);
        if (tasksPerMember > 8) urgency = 'high';
      }
      if (avgOverrun > 30) {
        needsRecruiting = true;
        reasons.push(`Dépassements (+${Math.round(avgOverrun)}%)`);
      }

      if (needsRecruiting) {
        predictions.push({
          team_id: team.id,
          team_name: team.name,
          team_color: team.color,
          current_size: teamSize,
          suggested_hires: urgency === 'high' ? 2 : 1,
          urgency,
          reasons,
          metrics: {
            absence_rate: Math.round(avgAbsenceRate),
            tasks_per_member: Math.round(tasksPerMember * 10) / 10,
            time_overrun: Math.round(avgOverrun)
          }
        });
      }
    });

    // Trier par urgence
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    predictions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return { data: predictions, count: predictions.length, error: null };
  } catch (error) {
    console.error('Erreur predictStaffingNeeds:', error);
    return { data: [], count: 0, error };
  }
}

/**
 * #8 - Historique des changements d'équipe
 * @param {string} enterpriseId - ID de l'entreprise
 * @param {number} limit - Nombre max d'entrées
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function getTeamHistory(enterpriseId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        id, action, details, created_at,
        admin:admin_id (first_name, last_name)
      `)
      .eq('enterprise_id', enterpriseId)
      .or('action.ilike.%team%,action.ilike.%member%,action.ilike.%leader%,action.ilike.%équipe%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const history = data?.map(log => {
      const details = log.details || {};
      let description = log.action;
      let icon = 'activity';
      let color = '#888';

      if (log.action.includes('create') && log.action.includes('team')) {
        description = `Équipe "${details.team_name || ''}" créée`;
        icon = 'plus'; color = '#10B981';
      } else if (log.action.includes('update') && log.action.includes('team')) {
        description = `Équipe "${details.team_name || ''}" modifiée`;
        icon = 'edit'; color = '#F59E0B';
      } else if (log.action.includes('delete') && log.action.includes('team')) {
        description = `Équipe "${details.team_name || ''}" supprimée`;
        icon = 'trash'; color = '#EF4444';
      } else if (log.action.includes('add') && log.action.includes('member')) {
        description = `${details.member_name || 'Membre'} ajouté à "${details.team_name || ''}"`;
        icon = 'user-plus'; color = '#10B981';
      } else if (log.action.includes('remove') && log.action.includes('member')) {
        description = `${details.member_name || 'Membre'} retiré de "${details.team_name || ''}"`;
        icon = 'user-minus'; color = '#EF4444';
      } else if (log.action.includes('leader')) {
        description = `Nouveau leader pour "${details.team_name || ''}"`;
        icon = 'crown'; color = '#F59E0B';
      }

      return {
        id: log.id,
        description,
        icon,
        color,
        timestamp: log.created_at,
        admin: log.admin ? `${log.admin.first_name} ${log.admin.last_name}` : 'Système'
      };
    }) || [];

    return { data: history, error: null };
  } catch (error) {
    console.error('Erreur getTeamHistory:', error);
    return { data: [], error };
  }
}

/**
 * #24 - Métriques d'usage des équipes
 * @param {string} enterpriseId - ID de l'entreprise
 * @param {number} dateRange - Nombre de jours
 * @returns {Promise<{data: object, error: Error}>}
 */
export async function getTeamUsageMetrics(enterpriseId, dateRange = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const [connRes, auditRes] = await Promise.all([
      supabase.from('connection_logs').select('user_type, admin_id, connected_at, device_type').eq('enterprise_id', enterpriseId).gte('connected_at', startDate.toISOString()).eq('success', true),
      supabase.from('audit_logs').select('action, created_at').eq('enterprise_id', enterpriseId).gte('created_at', startDate.toISOString()).or('action.ilike.%team%,action.ilike.%member%')
    ]);

    const connections = connRes.data || [];
    const audits = auditRes.data || [];

    const adminConnections = connections.filter(c => c.user_type === 'admin').length;
    const uniqueAdmins = new Set(connections.filter(c => c.user_type === 'admin').map(c => c.admin_id)).size;

    const teamActions = {
      created: audits.filter(a => a.action.includes('create')).length,
      updated: audits.filter(a => a.action.includes('update')).length,
      members_changed: audits.filter(a => a.action.includes('member')).length
    };

    return {
      data: {
        period_days: dateRange,
        total_connections: connections.length,
        admin_connections: adminConnections,
        unique_admins: uniqueAdmins,
        team_actions: teamActions,
        avg_daily_connections: Math.round(connections.length / dateRange)
      },
      error: null
    };
  } catch (error) {
    console.error('Erreur getTeamUsageMetrics:', error);
    return { data: null, error };
  }
}

/**
 * Logger une action dans audit_logs
 * @param {string} enterpriseId - ID entreprise
 * @param {string} adminId - ID admin
 * @param {string} action - Type d'action
 * @param {string} targetId - ID cible
 * @param {object} details - Détails supplémentaires
 */
export async function logTeamAction(enterpriseId, adminId, action, targetId, details = {}) {
  try {
    await supabase.from('audit_logs').insert({
      enterprise_id: enterpriseId,
      admin_id: adminId,
      action,
      target_id: targetId,
      details
    });
  } catch (error) {
    console.error('Erreur logTeamAction:', error);
  }
}