// ═══════════════════════════════════════════════════════════
// 🎨 PALETTE DU VOLET FISCAL
//
// Ce volet était peint en dur : fond #0A0A0F, textes #FFF, accent
// ambre — un seul décor, quelle que soit la préférence de thème,
// et qui jurait avec la coque « Paie & fiscalité » dès qu'on
// bascule en clair.
//
// Les couleurs sont désormais des jetons, déclinés en deux gammes :
// la claire reprend la charte ivoire · espresso · cuivre des pages
// Absences, Planning et Pointages ; la sombre garde l'ambiance
// actuelle, réchauffée de quelques degrés pour s'accorder au
// bogolan de la coque.
//
//  ⚠️ Ce fichier n'est PAS dans les exceptions de tokens de la charte
//  (`scripts/charte-check.mjs`), donc ses couleurs comptent au contrôle C1.
//  C'est assumé : il est la source unique des deux gammes du volet paie, et
//  y déplacer une couleur d'un composant est déjà un progrès mesurable.
//  Le déplacer dans les exceptions est une décision de charte, pas un
//  ajustement de code — elle ne se prend pas au détour d'une refonte de
//  modale.
// ═══════════════════════════════════════════════════════════

const SOMBRE = {
      ambre11: 'rgba(245,158,11,0.04)',
      ambre12: 'rgba(245,158,11,0.16)',
      ambre13: 'rgba(245,158,11,0.28)',
      ambre14: 'rgba(245,158,11,0.35)',
      ambreClair: '#FCD34D',
      indigo11: 'rgba(99,102,241,0.3)',
      indigo7: 'rgba(99,102,241,0.05)',
      indigo8: 'rgba(99,102,241,0.1)',
      indigo9: 'rgba(99,102,241,0.18)',
      orange: '#F97316',
      orange2: 'rgba(249,115,22,0.08)',
      orange5: 'rgba(249,115,22,0.18)',
      rouge10: 'rgba(239,68,68,0.16)',
      rouge11: 'rgba(239,68,68,0.18)',
      rouge13: 'rgba(239,68,68,0.25)',
      rouge5: 'rgba(239,68,68,0.04)',
      rouge6: 'rgba(239,68,68,0.06)',
      rouge7: 'rgba(239,68,68,0.12)',
      rouge8: 'rgba(239,68,68,0.14)',
      rouge9: 'rgba(239,68,68,0.15)',
      vert10: 'rgba(16,185,129,0.16)',
      vert4: 'rgba(16,185,129,0.04)',
      vert8: 'rgba(16,185,129,0.14)',
      violet: '#8B5CF6',
      violet5: 'rgba(139,92,246,0.12)',
      violetClair: '#A78BFA',
      fond: '#15110E',
      surface: '#241C15',
      surface2: '#1D1713',
      texte: '#F5F2EB',
      texteDoux: 'rgba(245,242,235,0.62)',
      texteDoux2: 'rgba(245,242,235,0.45)',
      texteFaint: 'rgba(245,242,235,0.32)',
      contour: 'rgba(245,242,235,0.22)',
      overlayFond: 'rgba(0,0,0,0.6)',
      modal: 'rgba(29,23,19,0.97)',
      ombre: 'rgba(0,0,0,0.5)',
      ombreForte: 'rgba(0,0,0,0.85)',
      ambre: '#F59E0B',
      ambreFonce: '#D97706',
      //  Ici l'ambre est CLAIR : l'encre doit être sombre. Même valeur que
      //  `--charte-encre` (#2A1708), qui est plus chaud que #15110E et donne
      //  7,6:1 ici. Écrit en hex parce que ce fichier est du JS : il ne lit pas
      //  les variables CSS. C'est le prix, et il est visible au contrôle C1.
      encreSurAccent: '#2A1708',
      vert: '#10B981',
      rouge: '#EF4444',
      rougeClair: '#FCA5A5',
      indigo: '#6366F1',
      indigoClair: '#818CF8',
      rose: '#EC4899',
      voile1: 'rgba(255,255,255,0.02)',
      voile2: 'rgba(255,255,255,0.03)',
      voile3: 'rgba(255,255,255,0.04)',
      voile4: 'rgba(255,255,255,0.05)',
      voile5: 'rgba(255,255,255,0.06)',
      voile6: 'rgba(255,255,255,0.08)',
      voile7: 'rgba(255,255,255,0.1)',
      ambre1: 'rgba(245,158,11,0.06)',
      ambre2: 'rgba(245,158,11,0.08)',
      ambre3: 'rgba(245,158,11,0.1)',
      ambre4: 'rgba(245,158,11,0.12)',
      ambre5: 'rgba(245,158,11,0.15)',
      ambre6: 'rgba(245,158,11,0.18)',
      ambre7: 'rgba(245,158,11,0.2)',
      ambre8: 'rgba(245,158,11,0.25)',
      ambre9: 'rgba(245,158,11,0.3)',
      ambre10: 'rgba(245,158,11,0.4)',
      indigo1: 'rgba(99,102,241,0.06)',
      indigo2: 'rgba(99,102,241,0.08)',
      indigo3: 'rgba(99,102,241,0.12)',
      indigo4: 'rgba(99,102,241,0.15)',
      indigo5: 'rgba(99,102,241,0.2)',
      indigo6: 'rgba(99,102,241,0.25)',
      rouge1: 'rgba(239,68,68,0.08)',
      rouge2: 'rgba(239,68,68,0.1)',
      rouge3: 'rgba(239,68,68,0.2)',
      rouge4: 'rgba(239,68,68,0.35)',
      vert1: 'rgba(16,185,129,0.12)',
      vert2: 'rgba(16,185,129,0.2)',
      vert3: 'rgba(16,185,129,0.25)',
      rose1: 'rgba(236,72,153,0.12)',
      rose2: 'rgba(236,72,153,0.25)',
}

const CLAIR = {
      ambre11: 'rgba(156,83,33,0.04)',
      ambre12: 'rgba(156,83,33,0.16)',
      ambre13: 'rgba(156,83,33,0.28)',
      ambre14: 'rgba(156,83,33,0.35)',
      ambreClair: '#B45309',
      indigo11: 'rgba(79,70,229,0.3)',
      indigo7: 'rgba(79,70,229,0.05)',
      indigo8: 'rgba(79,70,229,0.1)',
      indigo9: 'rgba(79,70,229,0.18)',
      orange: '#C2410C',
      orange2: 'rgba(194,65,12,0.08)',
      orange5: 'rgba(194,65,12,0.18)',
      rouge10: 'rgba(194,59,43,0.16)',
      rouge11: 'rgba(194,59,43,0.18)',
      rouge13: 'rgba(194,59,43,0.25)',
      rouge5: 'rgba(194,59,43,0.04)',
      rouge6: 'rgba(194,59,43,0.06)',
      rouge7: 'rgba(194,59,43,0.12)',
      rouge8: 'rgba(194,59,43,0.14)',
      rouge9: 'rgba(194,59,43,0.15)',
      vert10: 'rgba(38,115,77,0.16)',
      vert4: 'rgba(38,115,77,0.04)',
      vert8: 'rgba(38,115,77,0.14)',
      violet: '#7C3AED',
      violet5: 'rgba(124,58,237,0.12)',
      violetClair: '#8B5CF6',
      fond: '#FAF6F0',
      surface: '#F4EDE2',
      surface2: '#FFFFFF',
      texte: '#231911',
      texteDoux: '#4E3D2E',
      texteDoux2: '#7D6A58',
      texteFaint: '#8B7563',
      contour: 'rgba(93,66,39,0.22)',
      overlayFond: 'rgba(35,25,17,0.45)',
      modal: '#FFFFFF',
      ombre: 'rgba(35,25,17,0.18)',
      ombreForte: 'rgba(35,25,17,0.85)',
      ambre: '#9C5321',
      ambreFonce: '#7C4218',
      //  Ce qui se lit SUR un aplat ambre. Il n'existait pas, et c'est
      //  pourquoi « Générer quand même » écrivait `voile1` — 2 % d'opacité
      //  — sur `ambre` : brun sur brun, 1,7:1, illisible (28/11).
      //  Même valeur que `--charte-blanc`, d'où elle vient.
      encreSurAccent: '#FFFDF7',
      vert: '#26734D',
      rouge: '#C23B2B',
      rougeClair: '#B03020',
      indigo: '#4F46E5',
      indigoClair: '#6366F1',
      rose: '#DB2777',
      voile1: 'rgba(93,66,39,0.02)',
      voile2: 'rgba(93,66,39,0.03)',
      voile3: 'rgba(93,66,39,0.04)',
      voile4: 'rgba(93,66,39,0.05)',
      voile5: 'rgba(93,66,39,0.06)',
      voile6: 'rgba(93,66,39,0.08)',
      voile7: 'rgba(93,66,39,0.1)',
      ambre1: 'rgba(156,83,33,0.06)',
      ambre2: 'rgba(156,83,33,0.08)',
      ambre3: 'rgba(156,83,33,0.1)',
      ambre4: 'rgba(156,83,33,0.12)',
      ambre5: 'rgba(156,83,33,0.15)',
      ambre6: 'rgba(156,83,33,0.18)',
      ambre7: 'rgba(156,83,33,0.2)',
      ambre8: 'rgba(156,83,33,0.25)',
      ambre9: 'rgba(156,83,33,0.3)',
      ambre10: 'rgba(156,83,33,0.4)',
      indigo1: 'rgba(79,70,229,0.06)',
      indigo2: 'rgba(79,70,229,0.08)',
      indigo3: 'rgba(79,70,229,0.12)',
      indigo4: 'rgba(79,70,229,0.15)',
      indigo5: 'rgba(79,70,229,0.2)',
      indigo6: 'rgba(79,70,229,0.25)',
      rouge1: 'rgba(194,59,43,0.08)',
      rouge2: 'rgba(194,59,43,0.1)',
      rouge3: 'rgba(194,59,43,0.2)',
      rouge4: 'rgba(194,59,43,0.35)',
      vert1: 'rgba(38,115,77,0.12)',
      vert2: 'rgba(38,115,77,0.2)',
      vert3: 'rgba(38,115,77,0.25)',
      rose1: 'rgba(219,39,119,0.12)',
      rose2: 'rgba(219,39,119,0.25)',
}

export function palettePaie(darkMode = true) {
  return darkMode ? SOMBRE : CLAIR
}

// Les styles sont reconstruits une fois par gamme puis partagés : une
// carte de cotisation ne reclasse pas 150 propriétés à chaque rendu.
const cache = { sombre: null, clair: null }

export function stylesPaie(darkMode = true) {
  const cle = darkMode ? 'sombre' : 'clair'
  if (cache[cle]) return cache[cle]

  const p = palettePaie(darkMode)
  cache[cle] = {
  conteneurIntegre: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minHeight: '100vh',
  },

  loadingWrap: {
    minHeight: '100vh',
    background: p.fond,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: `1px solid ${p.ambre7}`,
    background: p.ambre3,
    color: p.ambre,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: p.ambre4,
    border: `1px solid ${p.ambre6}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { color: p.texte, fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '2px' },
  subtitle: { color: p.texteDoux2, fontSize: '12px', margin: '4px 0 0 0' },

  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 12,
    border: `1px solid ${p.rose2}`,
    background: p.rose1,
    color: p.rose,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  loadCountryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 12,
    border: `1px solid ${p.indigo6}`,
    background: p.indigo3,
    color: p.indigoClair,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  infoBar: {
    display: 'flex',
    gap: 12,
    padding: '16px 18px',
    background: p.ambre1,
    border: `1px solid ${p.ambre5}`,
    borderRadius: 16,
  },
  infoTitle: { color: p.ambre, fontSize: 13, fontWeight: 700, margin: '0 0 4px 0' },
  infoText: { color: p.texteDoux, fontSize: 12, margin: 0, lineHeight: 1.6 },

  explainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  explainCard: {
    padding: '16px 18px',
    background: p.modal,
    border: `1px solid ${p.voile5}`,
    borderRadius: 16,
  },

  explainWide: {
    padding: '16px 18px',
    background: p.modal,
    border: `1px solid ${p.voile5}`,
    borderRadius: 16,
  },

  explainHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  explainTitle: { color: p.texte, fontSize: 13, fontWeight: 700 },
  explainText: { color: p.texteDoux, fontSize: 12, lineHeight: 1.6, margin: 0 },
  explainList: { color: p.texteDoux2, fontSize: 12, margin: '10px 0 0 18px', padding: 0, lineHeight: 1.8 },

  countryBar: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12,
    background: p.modal,
    border: `1px solid ${p.voile5}`,
    borderRadius: 16,
    padding: 16,
  },
  countryGroup: { display: 'flex', flexDirection: 'column', gap: 6 },

  topActionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },

  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${p.voile6}`,
    background: p.modal,
    color: p.texteDoux2,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: 13,
  },
  tabBtnActive: {
    background: p.ambre4,
    border: `1px solid ${p.ambre8}`,
    color: p.ambre,
  },
  tabBadge: {
    background: p.ambre7,
    color: p.ambre,
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },

  card: {
    background: p.modal,
    border: `1px solid ${p.voile5}`,
    borderRadius: 18,
    padding: 18,
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: p.texte, fontSize: 16, fontWeight: 700, margin: 0 },
  cardSub: { color: p.texteFaint, fontSize: 12, margin: '3px 0 0 0' },

  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${p.vert3}`,
    background: p.vert1,
    color: p.vert,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    borderRadius: 14,
    background: p.voile1,
    border: `1px dashed ${p.voile6}`,
  },

  contribList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 12,
  },

  contribCard: {
    background: p.voile2,
    border: `1px solid ${p.voile4}`,
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  contribHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  contribName: { color: p.texte, fontSize: 14, fontWeight: 700, margin: 0 },
  contribCode: { color: p.texteFaint, fontSize: 11, margin: '3px 0 0 0', fontFamily: 'monospace' },

  mandatoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    background: p.vert1,
    border: `1px solid ${p.vert2}`,
    color: p.vert,
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  },

  contribBody: { display: 'flex', flexDirection: 'column', gap: 8 },

  contribRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: p.voile1,
    borderRadius: 10,
  },

  contribLabel: { color: p.texteDoux2, fontSize: 12 },
  contribAmount: { color: p.texte, fontSize: 13, fontWeight: 700 },

  contribActions: { display: 'flex', gap: 8, paddingTop: 4, borderTop: `1px solid ${p.voile4}` },

  editBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${p.indigo5}`,
    background: p.indigo2,
    color: p.indigoClair,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  deleteBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${p.rouge3}`,
    background: p.rouge1,
    color: p.rouge,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  bracketList: { display: 'flex', flexDirection: 'column', gap: 10 },

  bracketCard: {
    background: p.voile2,
    border: `1px solid ${p.voile4}`,
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  bracketHeader: { display: 'flex', alignItems: 'center', gap: 10 },

  bracketOrder: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: p.indigo3,
    border: `1px solid ${p.indigo5}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: p.indigoClair,
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },

  bracketName: { color: p.texte, fontSize: 14, fontWeight: 700, margin: 0 },

  bracketBody: { display: 'flex', flexDirection: 'column', gap: 8 },

  bracketRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: p.voile1,
    borderRadius: 10,
  },

  bracketLabel: { color: p.texteDoux2, fontSize: 12 },
  bracketValue: { color: p.texte, fontSize: 13, fontWeight: 700 },

  rulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },

  ruleItem: {
    padding: '12px 14px',
    background: p.voile2,
    border: `1px solid ${p.voile4}`,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  ruleLabel: { color: p.texteDoux2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  ruleValue: { color: p.texte, fontSize: 13, fontWeight: 700 },

  noteBox: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: p.indigo1,
    border: `1px solid ${p.indigo4}`,
    borderRadius: 12,
  },

  customRuleTitle: {
    color: p.texte,
    fontSize: 13,
    fontWeight: 700,
    margin: '0 0 10px 0',
  },

  customRuleForm: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1.3fr auto',
    gap: 10,
    marginBottom: 12,
  },

  customRuleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  customRuleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: p.voile2,
    border: `1px solid ${p.voile4}`,
    borderRadius: 12,
  },

  customRuleName: {
    color: p.texte,
    fontSize: 13,
    fontWeight: 700,
  },

  customRuleDesc: {
    color: p.texteFaint,
    fontSize: 11,
    marginTop: 3,
  },

  customRuleValue: {
    color: p.ambre,
    fontSize: 12,
    fontWeight: 700,
    background: p.ambre2,
    border: `1px solid ${p.ambre5}`,
    borderRadius: 999,
    padding: '4px 10px',
  },

  iconDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${p.rouge3}`,
    background: p.rouge1,
    color: p.rouge,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  chargeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  simGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginTop: 8,
  },

  simCard: {
    padding: '14px 16px',
    borderRadius: 14,
    background: p.voile2,
    border: `1px solid ${p.voile5}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },

  simLabel: { color: p.texteDoux2, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  simValue: { color: p.texte, fontSize: 15, fontWeight: 800 },

  label: {
    color: p.texteDoux,
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: `1px solid ${p.voile6}`,
    background: p.voile3,
    color: p.texte,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    fontSize: 14,
  },

  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: `1px solid ${p.voile6}`,
    background: p.voile3,
    color: p.texte,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    fontSize: 14,
    cursor: 'pointer',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: p.ombreForte,
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },

  /*  LA FEUILLE (maquette D « fiche », 02/12)
      Même cartouche que la modale des profils manquants : coin carré,
      contour d'encre 2 px, ombre dure de 8 px, bande de colle de 14 px.
      L'ombre floue de 60 px disparaît (C9). */
  modalContent: {
    position: 'relative',
    width: '100%',
    maxWidth: 680,
    maxHeight: 'calc(100dvh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 14,
    overflow: 'hidden',
    border: 'var(--charte-trait) solid var(--charte-encre)',
    borderRadius: 0,
    backgroundColor: 'var(--charte-surface)',
    backgroundImage: 'linear-gradient(to bottom, color-mix(in srgb, var(--charte-blanc) 45%, transparent) 0 14px, color-mix(in srgb, var(--charte-encre) 16%, transparent) 14px 15px, transparent 15px)',
    boxShadow: '8px 8px 0 0 var(--charte-encre)',
    color: 'var(--charte-encre)',
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '24px 24px 16px',
    borderBottom: '1px solid var(--charte-bordure)',
  },

  modalTitle: { color: 'var(--charte-encre)', fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' },

  /*  Le carré chiffré de la maquette D : c'est un repère, pas une décoration.
      Il est annoncé `aria-hidden` dans le composant. */
  modalGlyphe: {
    display: 'grid',
    placeItems: 'center',
    width: 56,
    height: 56,
    flex: '0 0 auto',
    border: 'var(--charte-trait) solid var(--charte-encre)',
    borderRadius: 0,
    backgroundColor: 'var(--charte-surface)',
    color: 'var(--charte-encre)',
    fontFamily: 'var(--charte-police)',
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1,
  },

  /*  Le sous-titre : en capitales espacées, SOUS le titre, sur sa propre
      ligne — jamais à côté. C'est ce qui manquait sur la capture : le titre
      était seul et rien ne disait de quelle fenêtre il s'agissait. */
  modalSousTitre: {
    margin: '6px 0 0',
    color: 'var(--charte-texte)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },

  /*  « Annuler » et « Enregistrer » étaient illisibles (capture du 02/12,
      1,51:1 et 2,55:1) parce qu'ils s'écrivaient en valeurs TRANSLUCIDES
      sur du papier. Ils prennent les jetons de la charte, dont les paires
      sont vérifiées par le contrôle C2. */
  modalCloseBtn: {
    width: 36,
    height: 36,
    flex: '0 0 auto',
    borderRadius: 0,
    background: 'transparent',
    border: '1px solid var(--charte-encre)',
    color: 'var(--charte-texte)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  modalBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    /*  c'est lui qui défile : la feuille garde son contour et son rabat */
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },

  /*  La perforation de la maquette D : le pied se détache comme un talon. */
  modalFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '16px 24px 20px',
    borderTop: '1px dashed var(--charte-encre)',
  },

  /*  LE DÉFAUT DE LA CAPTURE DU 02/12, verrouillé plus bas par un test :
      `color` valait `p.contour` = rgba(93,66,39,0.22) — une encre à 22 %
      d'opacité — sur un fond à 4 %. Mesuré sur la capture : 1,51:1.
      Un bouton doit se voir AVANT de se lire. */
  cancelBtn: {
    padding: '10px 18px',
    borderRadius: 0,
    border: 'var(--charte-trait) solid var(--charte-encre)',
    backgroundColor: 'var(--charte-surface)',
    color: 'var(--charte-encre)',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    whiteSpace: 'nowrap',
    boxShadow: '2px 2px 0 0 var(--charte-encre)',
  },

  /*  `color` valait `p.overlayFond` = rgba(35,25,17,0.45) : une encre à
      45 % sur l'ambre. Mesuré sur la capture : 2,55:1 au cœur des glyphes. */
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 0,
    border: 'var(--charte-trait) solid var(--charte-encre)',
    backgroundColor: 'var(--charte-encre)',
    color: 'var(--charte-surface)',
    boxShadow: '2px 2px 0 0 var(--charte-encre)',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },

  confirmBox: {
    padding: 28,
    textAlign: 'center',
  },

  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px auto',
  },

  confirmTitle: {
    color: p.texte,
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 10px 0',
  },

  confirmText: {
    color: p.texteDoux,
    fontSize: 14,
    lineHeight: 1.6,
    margin: '0 0 22px 0',
  },

  confirmActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },

  confirmBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    color: p.texte,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  },

  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },

  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: p.contour,
    fontSize: 13,
    cursor: 'pointer',
    padding: '10px 12px',
    background: p.voile2,
    borderRadius: 12,
    border: `1px solid ${p.voile4}`,
  },

  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: 8,
    background: p.surface,
    border: `1px solid ${p.ambre7}`,
    borderRadius: 12,
    padding: '12px 14px',
    minWidth: 240,
    maxWidth: 320,
    zIndex: 999,
    boxShadow: `0 12px 40px ${p.ombre}`,
  },

  tooltipExample: {
    background: p.ambre2,
    border: `1px solid ${p.ambre5}`,
    borderRadius: 8,
    padding: '8px 10px',
    marginTop: 6,
  },

  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    width: 12,
    height: 12,
    background: p.surface,
    borderRight: `1px solid ${p.ambre7}`,
    borderBottom: `1px solid ${p.ambre7}`,
  },
  }
  return cache[cle]
}
