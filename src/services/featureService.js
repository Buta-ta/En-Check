// ═══════════════════════════════════════════════════════════
// 🔐 SERVICE DE GESTION DES FEATURES PAYANTES
// ═══════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase'

/**
 * Liste des features disponibles avec leurs codes
 */
export const FEATURES = {
  MODIFICATION_POINTAGES: 'modification_pointages',
  MULTI_ENTREPRISES: 'multi_entreprises',
  NOTIFICATIONS_PUSH: 'notifications_push',
  GESTION_CONGES: 'gestion_conges',
  HEURES_SUPPLEMENTAIRES: 'heures_supplementaires',
  PHOTO_POINTAGE: 'photo_pointage',
  SUPPORT_IA: 'support_ia',
}

/**
 * Configuration des features et leurs limites par plan
 */
const PLANS_CONFIG = {
  gratuit: {
    features: [],
    max_entreprises: 1,
    max_employes: 10,
  },
  pro: {
    features: [
      FEATURES.MODIFICATION_POINTAGES,
      FEATURES.MULTI_ENTREPRISES,
      FEATURES.HEURES_SUPPLEMENTAIRES,
    ],
    max_entreprises: 3,
    max_employes: 50,
  },
  entreprise: {
    features: [
      FEATURES.MODIFICATION_POINTAGES,
      FEATURES.MULTI_ENTREPRISES,
      FEATURES.NOTIFICATIONS_PUSH,
      FEATURES.GESTION_CONGES,
      FEATURES.HEURES_SUPPLEMENTAIRES,
      FEATURES.PHOTO_POINTAGE,
      FEATURES.SUPPORT_IA,
    ],
    max_entreprises: 999,
    max_employes: 999,
  },
}

class FeatureService {
  /**
   * Vérifie si une entreprise a accès à une feature
   * @param {string} enterpriseId - ID de l'entreprise
   * @param {string} featureCode - Code de la feature (ex: FEATURES.MODIFICATION_POINTAGES)
   * @returns {Promise<boolean>}
   */
  static async hasFeature(enterpriseId, featureCode) {
    try {
      // Récupérer l'abonnement actif
      const { data: abonnement, error } = await supabase
        .from('abonnements')
        .select('plan, features_actives, date_expiration')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (error || !abonnement) {
        // Pas d'abonnement = plan gratuit par défaut
        return PLANS_CONFIG.gratuit.features.includes(featureCode)
      }

      // Vérifier expiration
      if (abonnement.date_expiration) {
        const expirationDate = new Date(abonnement.date_expiration)
        if (expirationDate < new Date()) {
          return false // Abonnement expiré
        }
      }

      // Vérifier si la feature est dans le plan
      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      
      // Vérifier si la feature est activée manuellement (features_actives)
      const featuresActives = abonnement.features_actives || []

      return planFeatures.includes(featureCode) || featuresActives.includes(featureCode)
    } catch (err) {
      console.error('Erreur vérification feature:', err)
      return false
    }
  }

  /**
   * Récupère toutes les features actives d'une entreprise
   * @param {string} enterpriseId
   * @returns {Promise<string[]>} Liste des codes features
   */
  static async getEntrepriseFeatures(enterpriseId) {
    try {
      const { data: abonnement } = await supabase
        .from('abonnements')
        .select('plan, features_actives')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (!abonnement) {
        return PLANS_CONFIG.gratuit.features
      }

      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      const featuresActives = abonnement.features_actives || []

      // Fusionner et dédupliquer
      return [...new Set([...planFeatures, ...featuresActives])]
    } catch (err) {
      console.error('Erreur récupération features:', err)
      return []
    }
  }

  /**
   * Récupère le plan actuel d'une entreprise
   * @param {string} enterpriseId
   * @returns {Promise<{plan: string, features: string[], expired: boolean}>}
   */
  static async getEntreprisePlan(enterpriseId) {
    try {
      const { data: abonnement } = await supabase
        .from('abonnements')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .single()

      if (!abonnement) {
        return {
          plan: 'gratuit',
          features: PLANS_CONFIG.gratuit.features,
          expired: false,
        }
      }

      const expired = abonnement.date_expiration 
        ? new Date(abonnement.date_expiration) < new Date()
        : false

      const planFeatures = PLANS_CONFIG[abonnement.plan]?.features || []
      const featuresActives = abonnement.features_actives || []

      return {
        plan: abonnement.plan,
        features: [...new Set([...planFeatures, ...featuresActives])],
        expired,
        date_expiration: abonnement.date_expiration,
      }
    } catch (err) {
      console.error('Erreur récupération plan:', err)
      return {
        plan: 'gratuit',
        features: [],
        expired: false,
      }
    }
  }

  /**
   * Active/Désactive une feature pour une entreprise (SuperAdmin uniquement)
   * @param {string} enterpriseId
   * @param {string} featureCode
   * @param {boolean} activate
   */
  static async toggleFeature(enterpriseId, featureCode, activate) {
    try {
      // Récupérer l'abonnement existant
      const { data: abonnement } = await supabase
        .from('abonnements')
        .select('features_actives')
        .eq('enterprise_id', enterpriseId)
        .single()

      let featuresActives = abonnement?.features_actives || []

      if (activate) {
        // Ajouter la feature si pas déjà présente
        if (!featuresActives.includes(featureCode)) {
          featuresActives.push(featureCode)
        }
      } else {
        // Retirer la feature
        featuresActives = featuresActives.filter(f => f !== featureCode)
      }

      // Mettre à jour
      if (abonnement) {
        await supabase
          .from('abonnements')
          .update({ features_actives: featuresActives })
          .eq('enterprise_id', enterpriseId)
      } else {
        // Créer un abonnement gratuit avec cette feature
        await supabase
          .from('abonnements')
          .insert({
            enterprise_id: enterpriseId,
            plan: 'gratuit',
            features_actives: featuresActives,
            date_activation: new Date().toISOString().split('T')[0],
          })
      }

      return true
    } catch (err) {
      console.error('Erreur toggle feature:', err)
      return false
    }
  }

  /**
   * Change le plan d'une entreprise (SuperAdmin uniquement)
   * @param {string} enterpriseId
   * @param {string} newPlan - 'gratuit', 'pro', 'entreprise'
   * @param {object} options - {date_expiration, notes, montant_mensuel}
   */
  static async changePlan(enterpriseId, newPlan, options = {}) {
    try {
      const adminData = JSON.parse(localStorage.getItem('admin') || '{}')

      const abonnementData = {
        enterprise_id: enterpriseId,
        plan: newPlan,
        date_activation: new Date().toISOString().split('T')[0],
        date_expiration: options.date_expiration || null,
        notes: options.notes || null,
        montant_mensuel: options.montant_mensuel || null,
        created_by: adminData.id,
        updated_at: new Date().toISOString(),
      }

      // Upsert (insert ou update)
      const { error } = await supabase
        .from('abonnements')
        .upsert(abonnementData, {
          onConflict: 'enterprise_id',
        })

      if (error) throw error
      return true
    } catch (err) {
      console.error('Erreur changement plan:', err)
      return false
    }
  }
}

export default FeatureService