// src/services/currencyService.js
// ═══════════════════════════════════════════════════════════════════════════
// 💱 SERVICE DEVISE — SOURCE UNIQUE DE VÉRITÉ (livraison 02)
// ═══════════════════════════════════════════════════════════════════════════
// RÈGLE D'OR DE CE FICHIER : on n'INVENTE JAMAIS une devise.
//
// Le problème qu'il résout : dans ton code, `|| 'XAF'` apparaissait à 8
// endroits. Résultat : une entreprise sénégalaise (XOF) recevait des bulletins
// libellés XAF, et une entreprise camerounaise (XAF) recevait des bulletins
// libellés XOF — sans qu'aucun écran n'affiche d'erreur, parce que XAF et XOF
// s'écrivent tous les deux « FCFA ».
//
// XAF ≠ XOF : deux monnaies distinctes (BCEAO vs BEAC), non convertibles entre
// elles. Ce n'est donc pas un problème d'affichage, c'est un problème comptable.
//
// Désormais : si la devise est introuvable, `requireCurrency()` LÈVE UNE ERREUR
// explicite au lieu de produire un document faux. C'est volontaire.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Catalogue des devises réellement utilisées par tes marchés
 * (Afrique francophone + diaspora Europe/Amérique du Nord).
 */
export const CURRENCIES = {
  XOF: { code: 'XOF', label: 'FCFA', name: 'Franc CFA (BCEAO)', zone: 'UEMOA', decimals: 0 },
  XAF: { code: 'XAF', label: 'FCFA', name: 'Franc CFA (BEAC)', zone: 'CEMAC', decimals: 0 },
  EUR: { code: 'EUR', label: '€', name: 'Euro', zone: 'UE', decimals: 2 },
  GNF: { code: 'GNF', label: 'GNF', name: 'Franc guinéen', zone: '—', decimals: 0 },
  CDF: { code: 'CDF', label: 'FC', name: 'Franc congolais', zone: '—', decimals: 0 },
  RWF: { code: 'RWF', label: 'FRw', name: 'Franc rwandais', zone: '—', decimals: 0 },
  BIF: { code: 'BIF', label: 'FBu', name: 'Franc burundais', zone: '—', decimals: 0 },
  DJF: { code: 'DJF', label: 'Fdj', name: 'Franc djiboutien', zone: '—', decimals: 0 },
  KMF: { code: 'KMF', label: 'FC', name: 'Franc comorien', zone: '—', decimals: 0 },
  MGA: { code: 'MGA', label: 'Ar', name: 'Ariary malgache', zone: '—', decimals: 0 },
  MRU: { code: 'MRU', label: 'UM', name: 'Ouguiya', zone: '—', decimals: 2 },
  MAD: { code: 'MAD', label: 'DH', name: 'Dirham marocain', zone: '—', decimals: 2 },
  DZD: { code: 'DZD', label: 'DA', name: 'Dinar algérien', zone: '—', decimals: 2 },
  TND: { code: 'TND', label: 'DT', name: 'Dinar tunisien', zone: '—', decimals: 3 },
  USD: { code: 'USD', label: '$', name: 'Dollar américain', zone: '—', decimals: 2 },
  CAD: { code: 'CAD', label: '$ CA', name: 'Dollar canadien', zone: '—', decimals: 2 },
  CHF: { code: 'CHF', label: 'CHF', name: 'Franc suisse', zone: '—', decimals: 2 },
}

/**
 * Pays → devise officielle.
 * ⚠️ Cette table est un MIROIR de `public.country_currency_reference` en base.
 * Elle sert à SUGGÉRER dans l'interface (et fonctionne hors ligne).
 * L'autorité reste la base de données, où un trigger refuse désormais
 * une devise incohérente avec le pays.
 */
export const COUNTRY_CURRENCY = {
  // UEMOA (XOF)
  BEN: 'XOF', BFA: 'XOF', CIV: 'XOF', GNB: 'XOF', MLI: 'XOF', NER: 'XOF', SEN: 'XOF', TGO: 'XOF',
  // CEMAC (XAF)
  CMR: 'XAF', CAF: 'XAF', TCD: 'XAF', COG: 'XAF', GAB: 'XAF', GNQ: 'XAF',
  // Autres Afrique
  GIN: 'GNF', COD: 'CDF', RWA: 'RWF', BDI: 'BIF', DJI: 'DJF', COM: 'KMF',
  MDG: 'MGA', MRT: 'MRU', MAR: 'MAD', DZA: 'DZD', TUN: 'TND',
  // Europe / Amérique du Nord
  FRA: 'EUR', BEL: 'EUR', CAN: 'CAD', CHE: 'CHF',
  // Hors zone mais fréquent en diaspora
  USA: 'USD',
}

/** Noms lisibles par zone, pour les messages d'erreur et l'interface. */
export const ZONE_LABEL = {
  UEMOA: 'UEMOA — Afrique de l\'Ouest (XOF)',
  CEMAC: 'CEMAC — Afrique centrale (XAF)',
  UE: 'Union européenne (EUR)',
}

const warnedOnce = new Set()

class CurrencyService {
  // ═════════════════════════════════════════════════════════════════════════
  // 🔍 CONNAISSANCE DES DEVISES
  // ═════════════════════════════════════════════════════════════════════════

  /** true si le code est un code ISO connu du catalogue */
  static isKnown(code) {
    return !!code && Object.prototype.hasOwnProperty.call(CURRENCIES, String(code).toUpperCase())
  }

  /** Devise officielle d'un pays (ou null si pays inconnu) */
  static suggestForCountry(countryCode) {
    if (!countryCode) return null
    return COUNTRY_CURRENCY[String(countryCode).toUpperCase()] || null
  }

  /** Nombre de décimales à afficher (0 pour les francs CFA) */
  static decimals(code) {
    return this.isKnown(code) ? CURRENCIES[String(code).toUpperCase()].decimals : 0
  }

  /** Libellé court : « FCFA », « € »… */
  static label(code) {
    return this.isKnown(code) ? CURRENCIES[String(code).toUpperCase()].label : ''
  }

  /** Nom complet, pour les écrans de configuration et les erreurs */
  static describe(code) {
    if (!this.isKnown(code)) return 'Devise inconnue'
    const c = CURRENCIES[String(code).toUpperCase()]
    return `${c.code} — ${c.name}`
  }

  /** Liste pour les <select> de l'interface */
  static options() {
    return Object.values(CURRENCIES).map((c) => ({
      value: c.code,
      label: `${c.code} — ${c.name}${c.zone !== '—' ? ` (${c.zone})` : ''}`,
    }))
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 🎯 RÉSOLUTION — d'où vient la devise ?
  // Ordre de priorité :
  //   1. l'entreprise        (c'est l'entité juridique qui a une devise)
  //   2. payroll_settings    (mis en cache, synchronisé par trigger en base)
  //   3. le pays de l'entreprise (déduction)
  //   4. null → on ne devine PAS
  // ═════════════════════════════════════════════════════════════════════════

  static resolveCurrency({ enterprise = null, settings = null } = {}) {
    const fromEnterprise = enterprise?.currency
    if (this.isKnown(fromEnterprise)) return String(fromEnterprise).toUpperCase()

    const fromSettings = settings?.currency
    if (this.isKnown(fromSettings)) return String(fromSettings).toUpperCase()

    const fromCountry = this.suggestForCountry(enterprise?.country_code || settings?.country_code)
    if (fromCountry) return fromCountry

    return null
  }

  /**
   * Comme resolveCurrency, mais LÈVE UNE ERREUR si la devise est indéterminable.
   * À utiliser partout où l'on s'apprête à produire un document Financier
   * (bulletin de paie, export comptable, rapport de masse salariale).
   *
   * Produire un bulletin faux coûte plus cher qu'un message d'erreur.
   */
  static requireCurrency(context = {}) {
    const resolved = this.resolveCurrency(context)
    if (resolved) return resolved

    const entreprise = context?.enterprise?.name || 'cette entreprise'
    throw new Error(
      `Devise non définie pour ${entreprise}. ` +
        `Renseigne le pays et la devise dans « Entreprises », puis relance. ` +
        `(Un bulletin de paie ne peut pas être généré sans devise : ` +
        `XOF et XAF sont deux monnaies différentes.)`,
    )
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ✅ CONTRÔLE DE COHÉRENCE (pour bandeaux d'alerte dans l'interface)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * @returns {{ok: boolean, expected: string|null, message: string|null}}
   */
  static checkCoherence({ country_code = null, currency = null } = {}) {
    const expected = this.suggestForCountry(country_code)

    if (!country_code) {
      return { ok: false, expected: null, message: 'Pays non renseigné : la devise ne peut pas être vérifiée.' }
    }
    if (!expected) {
      return { ok: true, expected: null, message: null } // pays hors table : on ne juge pas
    }
    if (!currency) {
      return { ok: false, expected, message: `Devise non renseignée. Attendue pour ${country_code} : ${expected}.` }
    }
    if (String(currency).toUpperCase() !== expected) {
      return {
        ok: false,
        expected,
        message:
          `Incohérence : pays ${country_code} → devise attendue ${expected}, ` +
          `mais ${currency} est enregistrée. ` +
          (expected === 'XOF' || currency === 'XOF' || expected === 'XAF' || currency === 'XAF'
            ? 'XOF et XAF sont deux monnaies différentes, non convertibles entre elles.'
            : ''),
      }
    }
    return { ok: true, expected, message: null }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 🖨️ AFFICHAGE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Formate un montant.
   *   format(1250000, 'XOF')                    → "1 250 000 FCFA"
   *   format(1250000, 'XOF', { withCode: true })→ "1 250 000 FCFA (XOF)"
   *   format(1250.5, 'EUR')                     → "1 250,50 €"
   *   format(1250000, null)                     → "1 250 000"   (aucune unité inventée)
   *
   * ⚠️ Le séparateur de milliers est une ESPACE ORDINAIRE (et non fine
   * insécable) : jsPDF et les polices standard ne savent pas rendre l'espace
   * fine, ce qui produirait des caractères parasites dans les PDF.
   */
  static format(amount, currency = null, { withCode = false } = {}) {
    const num = Number(amount)
    const safe = Number.isFinite(num) ? num : 0

    const decimals = this.isKnown(currency) ? this.decimals(currency) : 0
    const fixed = safe.toFixed(decimals)
    const [entier, dec] = fixed.split('.')
    const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    const nombre = dec ? `${groupe},${dec}` : groupe

    if (!this.isKnown(currency)) {
      if (currency && !warnedOnce.has(currency)) {
        warnedOnce.add(currency)
        console.warn(
          `[CurrencyService] Devise « ${currency} » inconnue : le montant est affiché sans unité. ` +
            `Devises gérées : ${Object.keys(CURRENCIES).join(', ')}.`,
        )
      }
      return nombre
    }

    const code = String(currency).toUpperCase()
    const libelle = this.label(code)
    const espace = code === 'EUR' ? ' ' : ' ' // lisibilité : « 1 250,50 € »
    return `${nombre}${espace}${libelle}${withCode ? ` (${code})` : ''}`
  }

  /**
   * Version courte sans centimes, pour les libellés de lignes de paie.
   * (Aligne le comportement historique de PayrollService.formatMoney.)
   */
  static formatShort(amount, currency = null) {
    return this.format(amount, currency)
  }
}

export default CurrencyService
