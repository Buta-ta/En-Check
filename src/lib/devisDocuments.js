// ═══════════════════════════════════════════════════════════
// 📄 LES DOCUMENTS D'UN DEVIS — devis, facture, échéancier
//
// Le même devis se présente de trois façons : l'offre (le devis
// signé), la facture (investissement + abonnement), et l'échéancier
// (ce qui tombe quand). Chaque document est une page HTML complète,
// mise en page pour l'impression, puis capturée en PDF.
//
// Ce fichier est extrait tel quel de l'ancienne page Devis : les
// totaux, les mentions et les signatures sont identiques. Rien ici
// ne calcule un prix — les montants arrivent déjà calculés par
// `./devis`.
// ═══════════════════════════════════════════════════════════

import html2pdf from 'html2pdf.js'
import { formatF, getEngagementConfig } from './devis'

export function generateStyledPDF(htmlString, filename) {
  // 1. Créer un conteneur caché
  const container = document.createElement('div')
  container.style.cssText = `
  position: fixed;
  left: -9999px;
  top: 0;
  width: 800px;
  background: #fff;
  z-index: -1;
`

  // 2. Injecter le HTML complet (avec <style>)
  container.innerHTML = htmlString

  // 3. Ajouter au DOM pour que les styles soient appliqués
  document.body.appendChild(container)

  // 4. Laisser le temps au navigateur de calculer les styles
  setTimeout(() => {
    const opt = {
      margin: 0.5,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'in',
        format: 'a4',
        orientation: 'portrait',
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }

    // 5. Capturer l'élément (pas la chaîne)
    html2pdf()
      .set(opt)
      .from(container.querySelector('.page') || container)
      .save()
      .then(() => {
        // 6. Nettoyer
        document.body.removeChild(container)

        // 7. Ouvrir la fenêtre d'impression
        const printWindow = window.open('', '_blank', 'width=900,height=700')
        printWindow.document.write(htmlString)
        printWindow.document.close()
      })
      .catch((err) => {
        console.error('Erreur PDF:', err)
        if (container.parentNode) document.body.removeChild(container)
      })
  }, 400) // 400ms pour que les styles soient calculés
}

export function handleDownloadPDF(devisData, calculData, totauxData, signatureDateEnCheck = '', signatureDateClient = '', prospects = []) {
  const prospect = prospects.find(p => p.id === devisData.prospect_id)
  const lignesFixe = calculData?.lignesFixe || devisData.detail_calcul?.lignesFixe || []
  const lignesMensuel = calculData?.lignesMensuel || devisData.detail_calcul?.lignesMensuel || []
  const fixeNet = totauxData?.totalFixeNet || devisData.montant_fixe_net
  const mensuelNet = totauxData?.totalMensuelNet || devisData.montant_mensuel_net
  const annuelNet = totauxData?.totalAnnuelNet || devisData.montant_annuel_net
  const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
  const nbMois = (devisData.mois_gratuit || totauxData?.nbMois) ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1)) : engConfig.mois
  const modeFixe = totauxData?.modeFixe || devisData.detail_calcul?.totaux?.modeFixe || 'lignes'
  const modeMensuel = totauxData?.modeMensuel || devisData.detail_calcul?.totaux?.modeMensuel || 'lignes'
  const nbFois = totauxData?.paiementFois || devisData.paiement_fois || 1
  const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet

  const sousTotalFixe = lignesFixe.reduce((s, l) => s + l.total, 0)
  const sousTotalMensuel = lignesMensuel.reduce((s, l) => s + l.total, 0)

  const renderLignes = (lignes) => lignes.map(l => `
  <tr>
    <td>
      ${l.label}
      ${l.isGratuit ? '<span class="gratuit-tag">🎁 GRATUIT</span>' : ''}
      ${l.negocie ? '<span class="nego-tag">✏️ négocié</span>' : ''}
    </td>
    <td>
      ${l.isGratuit ? '0 F' : `${formatF(l.unitaire)} F`}
      ${l.negocie && l.modeNego === 'total' ? '<span class="nego-tag-small">(total convenu)</span>' : ''}
    </td>
    <td>${l.qte}</td>
    <td class="total-col">
      ${l.isGratuit ? '<span style="color:#10B981;font-weight:800;">GRATUIT</span>' : `${formatF(l.total)} F`}
      ${l.negocie && l.autoTotal !== l.total ? `<div class="auto-price">Base : ${formatF(l.autoTotal)} F</div>` : ''}
    </td>
  </tr>
`).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Devis ${devisData.numero || 'DEVIS'}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
  .page { max-width:800px; margin:0 auto; padding:48px 40px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:28px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
  .brand-name { font-size:32px; font-weight:900; color:#6366F1; letter-spacing:4px; }
  .brand-tagline { font-size:11px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:6px; }
  .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
  .devis-ref { text-align:right; }
  .devis-numero { font-size:22px; font-weight:700; color:#1a1a2e; }
  .devis-date { color:#999; font-size:12px; margin-top:4px; }
  .client-box { background:#f8f7ff; border-left:4px solid #6366F1; padding:16px 20px; border-radius:0 10px 10px 0; margin-bottom:28px; }
  .client-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#6366F1; font-weight:700; margin-bottom:6px; }
  .client-name { font-size:20px; font-weight:700; color:#1a1a2e; }
  .client-sub { color:#777; font-size:12px; margin-top:4px; }
  .offert-badge { display:inline-flex; align-items:center; gap:8px; background:#dcfce7; border:1px solid #86efac; border-radius:8px; padding:10px 16px; margin-bottom:20px; color:#15803d; font-size:12px; font-weight:600; }
  .conditions-box { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
  .condition-tag { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; }
  .condition-paiement { background:#eff6ff; border:1px solid #93c5fd; color:#1d4ed8; }
  .condition-engagement { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
  .resume { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:32px; }
  .resume-card { border-radius:12px; padding:18px; text-align:center; }
  .resume-card.fixe { background:#f0f0ff; border:1px solid #d4d4f7; }
  .resume-card.mensuel { background:#f0f0ff; border:1px solid #d4d4f7; }
  .resume-card.annuel { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; }
  .resume-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; font-weight:700; }
  .resume-value { font-size:22px; font-weight:900; color:#6366F1; margin-top:6px; font-family:monospace; }
  .resume-card.annuel .resume-value { color:#d97706; }
  .resume-sub { font-size:10px; color:#16a34a; margin-top:4px; font-weight:600; }
  .section-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:#6366F1; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #e8e8f8; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07); }
  thead tr { background:#6366F1; }
  thead th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:white; }
  thead th:not(:first-child) { text-align:right; }
  tbody tr { border-bottom:1px solid #f0f0f8; }
  tbody tr:nth-child(even) { background:#fbfbff; }
  tbody td { padding:10px 14px; font-size:13px; color:#374151; vertical-align:top; }
  tbody td:not(:first-child) { text-align:right; }
  .total-col { font-weight:700; color:#1a1a2e; }
  .nego-tag { display:inline-block; background:#fffbeb; color:#d97706; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; margin-left:6px; }
  .gratuit-tag { display:inline-block; background:#dcfce7; color:#15803d; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid #86efac; margin-left:6px; }
  .nego-tag-small { display:block; color:#9ca3af; font-size:10px; font-style:italic; }
  .auto-price { color:#9ca3af; font-size:10px; font-style:italic; text-decoration:line-through; }
  .subtotal-row td { background:#f0f0ff; color:#6366F1; font-weight:700; font-size:13px; }
  .nego-cat-row td { background:#fffbeb; color:#d97706; font-weight:800; font-size:14px; border-top:2px solid #fde68a; }
  .total-row td { background:#6366F1 !important; color:white !important; font-weight:800 !important; font-size:15px !important; padding:13px 14px !important; }
  .projection { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; border-radius:14px; padding:22px 28px; display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
  .projection-left .label { font-size:15px; font-weight:700; color:#92400e; }
  .projection-left .desc { font-size:11px; color:#b45309; margin-top:4px; }
  .projection-value { font-size:30px; font-weight:900; color:#d97706; font-family:monospace; }
  .echeances-box { background:#eff6ff; border:2px solid #93c5fd; border-radius:14px; padding:18px 24px; margin-bottom:28px; }
  .echeances-title { font-size:14px; font-weight:700; color:#1d4ed8; margin-bottom:8px; }
  .echeances-detail { font-size:13px; color:#1e40af; }
  .echeances-montant { font-size:22px; font-weight:900; color:#1d4ed8; font-family:monospace; margin-top:4px; }
  .config-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:24px; }
  .config-item { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; }
  .config-item-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:3px; }
  .config-item-value { font-size:14px; font-weight:700; color:#374151; }
  .options-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px; }
  .chip { padding:5px 12px; border-radius:6px; background:#ede9fe; color:#6366F1; font-size:11px; font-weight:600; border:1px solid #c4b5fd; }
  .chip.gratuit { background:#dcfce7; color:#15803d; border-color:#86efac; }
  .notes-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; color:#6b7280; font-size:12px; line-height:1.7; margin-bottom:24px; }
  .footer { border-top:1px solid #e5e7eb; padding-top:20px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:10px; color:#aaa; }
  .footer-validity { font-size:11px; color:#aaa; font-style:italic; }
  .table-note { font-size:10px; color:#888; font-style:italic; margin-bottom:24px; padding-left:4px; }
  /* ═══ GESTION DES SAUTS DE PAGE ═══ */
table { page-break-inside: auto; }
tr { page-break-inside: avoid; page-break-after: auto; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
.client-box, .resume, .resume-card, .projection, .synthese, .echeances-box, .notes, .config-grid, .options-chips, .paiement-box, .conditions, .signatures, .totaux { page-break-inside: avoid; }
h3, .section-title, .section-sep { page-break-after: avoid; }
  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } .page { padding:20px; } }
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div>
    <div class="brand-name">EN-CHECK</div>
    <div class="brand-tagline">Système de pointage intelligent</div>
    <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
  </div>
  <div class="devis-ref">
    <div class="devis-numero">${devisData.numero || 'DEVIS'}</div>
    <div class="devis-date">Établi le ${new Date(devisData.created_at || new Date()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
</div>

${prospect ? `
<div class="client-box">
  <div class="client-label">Client</div>
  <div class="client-name">${prospect.company_name}</div>
  <div class="client-sub">
    ${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}
    ${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}
    ${prospect.contact_phone ? ` &nbsp;•&nbsp; 📞 ${prospect.contact_phone}` : ''}
    ${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}
  </div>
</div>` : ''}

<div class="conditions-box">
  ${nbMois < engConfig.mois ? `<div class="offert-badge">🎁 Offre spéciale : 1 mois d'abonnement offert — Facturation sur ${nbMois} mois</div>` : ''}
  ${nbFois > 1 ? `<span class="condition-tag condition-paiement">💳 Paiement en ${nbFois}x — ${formatF(echeance)} FCFA/échéance</span>` : ''}
  <span class="condition-tag condition-engagement">${engConfig.label}</span>
</div>

<div class="resume">
  <div class="resume-card fixe">
    <div class="resume-label">Investissement initial</div>
    <div class="resume-value">${formatF(fixeNet)} F</div>
    <div class="resume-sub">${nbFois > 1 ? `${nbFois}x ${formatF(echeance)} F` : 'Paiement unique'}</div>
  </div>
  <div class="resume-card mensuel">
    <div class="resume-label">Abonnement mensuel</div>
    <div class="resume-value">${formatF(mensuelNet)} F</div>
    ${nbMois < engConfig.mois ? '<div class="resume-sub">🎁 1er mois offert</div>' : ''}
  </div>
  <div class="resume-card annuel">
    <div class="resume-label">${engConfig.label} (${nbMois} mois)</div>
    <div class="resume-value">${formatF(annuelNet)} F</div>
  </div>
</div>

<div class="section-title">📦 Détail de l'investissement initial</div>
<table>
  <thead><tr><th style="width:45%">Prestation</th><th>Prix unitaire</th><th>Quantité</th><th>Montant</th></tr></thead>
  <tbody>
    ${renderLignes(lignesFixe)}
    ${modeFixe === 'lignes' ? `
    <tr class="total-row"><td colspan="3">TOTAL INVESTISSEMENT INITIAL</td><td>${formatF(fixeNet)} FCFA</td></tr>
    ` : `
    <tr class="subtotal-row"><td colspan="3">Sous-total</td><td>${formatF(sousTotalFixe)} F</td></tr>
    <tr class="nego-cat-row"><td colspan="3">✅ Prix convenu</td><td>${formatF(fixeNet)} FCFA</td></tr>
    `}
  </tbody>
</table>
${modeFixe !== 'lignes' ? '<p class="table-note">Prix convenu entre les parties.</p>' : ''}

${nbFois > 1 ? `
<div class="echeances-box">
  <div class="echeances-title">💳 Échéancier de paiement — ${nbFois} fois</div>
  <div class="echeances-detail">${Array.from({ length: nbFois }, (_, i) => `Échéance ${i + 1} : <strong>${formatF(i < nbFois - 1 ? echeance : fixeNet - echeance * (nbFois - 1))} FCFA</strong>`).join(' &nbsp;•&nbsp; ')}</div>
</div>
` : ''}

<div class="section-title">📅 Détail de l'abonnement mensuel</div>
<table>
  <thead><tr><th style="width:45%">Service</th><th>Prix unitaire</th><th>Quantité</th><th>Montant</th></tr></thead>
  <tbody>
    ${renderLignes(lignesMensuel)}
    ${modeMensuel === 'lignes' ? `
    <tr class="total-row"><td colspan="3">TOTAL ABONNEMENT MENSUEL</td><td>${formatF(mensuelNet)} FCFA/mois</td></tr>
    ` : `
    <tr class="subtotal-row"><td colspan="3">Sous-total</td><td>${formatF(sousTotalMensuel)} F/mois</td></tr>
    <tr class="nego-cat-row"><td colspan="3">✅ Prix convenu</td><td>${formatF(mensuelNet)} FCFA/mois</td></tr>
    `}
  </tbody>
</table>
${modeMensuel !== 'lignes' ? '<p class="table-note">Prix convenu entre les parties.</p>' : ''}

<div class="projection">
  <div class="projection-left">
    <div class="label">${engConfig.label} sur ${nbMois} mois</div>
    <div class="desc">Investissement initial + abonnement × ${nbMois} mois${nbMois < engConfig.mois ? ' (1 mois offert déduit)' : ''}</div>
  </div>
  <div class="projection-value">${formatF(annuelNet)} FCFA</div>
</div>

<div class="section-title">⚙️ Configuration</div>
<div class="config-grid">
  ${[
      { label: 'Sites', value: devisData.config?.nb_sites || '—' },
      { label: 'Employés', value: devisData.config?.nb_employes || '—' },
      { label: 'Machines', value: devisData.config?.nb_machines || '—' },
      { label: 'Admins', value: devisData.config?.nb_admins || '—' },
      { label: 'Pointage', value: (devisData.config?.type_pointage || '—').toUpperCase() },
      { label: 'Engagement', value: engConfig.label.replace(/[📅🔓]/g, '').trim() },
      { label: 'Paiement', value: nbFois > 1 ? `${nbFois}x` : 'Comptant' },
      { label: 'Validité', value: '30 jours' },
    ].map(c => `<div class="config-item"><div class="config-item-label">${c.label}</div><div class="config-item-value">${c.value}</div></div>`).join('')}
</div>

${devisData.config?.options && Object.values(devisData.config.options).some(Boolean) ? `
<div class="section-title">🔌 Services inclus</div>
<div class="options-chips">
  ${Object.entries(devisData.config.options).filter(([, v]) => v).map(([k]) => {
      const isGratuit = k === 'jours_feries'
      return `<span class="chip ${isGratuit ? 'gratuit' : ''}">${k === 'jours_feries' ? '🎌 Jours fériés (GRATUIT)' : k === 'fiches_paie' ? '💰 Fiches de paie' : k.replace(/_/g, ' ')}</span>`
    }).join('')}
</div>` : ''}

${devisData.notes ? `<div class="section-title">📝 Notes</div><div class="notes-box">${devisData.notes}</div>` : ''}



<div class="footer">
  <div class="footer-brand">Devis établi par En-Check</div>
  <div class="footer-validity">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Offre valable 30 jours</div>
</div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  // ✅ NOUVEAU
  const numero = devisData.numero || 'DEVIS'
  generateStyledPDF(html, numero)

} // ← ferme handleDownloadPDF

export function handleDownloadFacture(devisData, calculData, totauxData, dateEmissionParam, dateEcheanceParam, signatureDateEnCheck = '', signatureDateClient = '', applyStamp = false, prospects = []) {
  const prospect = prospects.find(p => p.id === devisData.prospect_id)
  const lignesFixe = calculData?.lignesFixe || devisData.detail_calcul?.lignesFixe || []
  const lignesMensuel = calculData?.lignesMensuel || devisData.detail_calcul?.lignesMensuel || []
  const fixeNet = totauxData?.totalFixeNet || devisData.montant_fixe_net
  const mensuelNet = totauxData?.totalMensuelNet || devisData.montant_mensuel_net
  const annuelNet = totauxData?.totalAnnuelNet || devisData.montant_annuel_net
  const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
  const nbMois = (devisData.mois_gratuit || totauxData?.nbMois)
    ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1))
    : engConfig.mois
  const nbFois = totauxData?.paiementFois || devisData.paiement_fois || 1
  const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet
  const numeroFacture = (devisData.numero || '').replace('DEV-', 'FAC-')
  const dateFacture = dateEmissionParam
    ? new Date(dateEmissionParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const dateEcheance = dateEcheanceParam
    ? new Date(dateEcheanceParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const renderLignesFacture = (lignes) => lignes.map(l => `
  <tr>
    <td>${l.label}${l.isGratuit ? ' <span class="gratuit-tag">GRATUIT</span>' : ''}</td>
    <td class="num">${l.isGratuit ? '0' : formatF(l.unitaire)} FCFA</td>
    <td class="num">${l.qte}</td>
    <td class="num">${l.isGratuit ? '<span class="green">GRATUIT</span>' : `${formatF(l.total)} FCFA`}</td>
  </tr>
`).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture ${numeroFacture}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
  .page { max-width:800px; margin:0 auto; padding:48px 40px;position:relative; }

  /* EN-TÊTE */
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
  .brand { font-size:30px; font-weight:900; color:#6366F1; letter-spacing:4px; }
  .brand-sub { font-size:10px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
  .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
  .facture-ref { text-align:right; }
  .facture-title { font-size:28px; font-weight:900; color:#1a1a2e; text-transform:uppercase; letter-spacing:2px; }
  .facture-num { font-size:16px; color:#6366F1; font-weight:700; margin-top:4px; }
  .facture-date { font-size:11px; color:#999; margin-top:2px; }

  /* INFOS */
  .infos-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; }
  .info-block { padding:16px; border-radius:10px; background:#f8f7ff; }
  .info-block.client { border-left:4px solid #6366F1; }
  .info-block.vendeur { border-left:4px solid #10B981; }
  .info-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:8px; }
  .info-label.blue { color:#6366F1; }
  .info-label.green { color:#10B981; }
  .info-name { font-size:16px; font-weight:700; color:#1a1a2e; }
  .info-detail { font-size:12px; color:#777; margin-top:3px; }
  .info-rccm { font-size:10px; color:#999; margin-top:6px; padding-top:6px; border-top:1px solid #EEE; font-style:italic; }

  /* STATUT */
  .statut-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
  .statut-badge { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; }
  .statut-badge.payable { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
  .statut-badge.engagement { background:#ede9fe; border:1px solid #c4b5fd; color:#5b21b6; }
  .statut-badge.gratuit { background:#dcfce7; border:1px solid #86efac; color:#15803d; }

  /* TABLEAU */
  table { width:100%; border-collapse:collapse; margin-bottom:4px; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.07); }
  thead tr { background:#6366F1; }
  thead th { padding:12px 14px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#fff; }
  thead th.num { text-align:right; }
  tbody tr { border-bottom:1px solid #f0f0f8; }
  tbody tr:nth-child(even) { background:#fbfbff; }
  tbody td { padding:11px 14px; color:#374151; vertical-align:top; }
  tbody td.num { text-align:right; }
  .gratuit-tag { display:inline-block; background:#dcfce7; color:#15803d; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid #86efac; margin-left:4px; }
  .green { color:#10B981; font-weight:700; }
  .section-sep { height:6px; }

  /* TOTAUX */
  .totaux { margin-top:16px; display:flex; justify-content:flex-end; }
  .totaux-table { width:340px; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
  .totaux-row { display:flex; justify-content:space-between; padding:10px 16px; border-bottom:1px solid #f0f0f8; }
  .totaux-row:last-child { border-bottom:none; }
  .totaux-row.subtotal { background:#f9fafb; }
  .totaux-row.total-fixe { background:#ede9fe; }
  .totaux-row.total-mensuel { background:#ede9fe; }
  .totaux-row.grand-total { background:#6366F1; }
  .totaux-label { font-size:12px; color:#6b7280; }
  .totaux-value { font-size:13px; font-weight:700; color:#1a1a2e; font-family:monospace; }
  .totaux-row.grand-total .totaux-label,
  .totaux-row.grand-total .totaux-value { color:#fff; font-size:15px; }

  /* PAIEMENT */
  .paiement-box { margin-top:24px; background:#eff6ff; border:2px solid #93c5fd; border-radius:14px; padding:20px 24px; }
  .paiement-title { font-size:14px; font-weight:700; color:#1d4ed8; margin-bottom:12px; }
  .paiement-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
  .paiement-item { background:#fff; border-radius:10px; padding:12px; border:1px solid #bfdbfe; text-align:center; }
  .paiement-item-label { font-size:10px; color:#93c5fd; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-bottom:4px; }
  .paiement-item-value { font-size:18px; font-weight:800; color:#1d4ed8; font-family:monospace; }
  .paiement-item-sub { font-size:10px; color:#6b7280; margin-top:2px; }

  /* CONDITIONS */
  .conditions { margin-top:24px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px; }
  .conditions-title { font-size:12px; font-weight:700; color:#374151; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px; }
  .conditions-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
  .conditions-list li { font-size:11px; color:#6b7280; display:flex; align-items:flex-start; gap:6px; }
  .conditions-list li::before { content:"•"; color:#6366F1; font-weight:700; }

  /* SIGNATURES */
  .signatures { display:flex; justify-content:space-between; gap:40px; margin-top:36px; }
  .sig-block { flex:1; }
  .sig-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin-bottom:6px; }
  .sig-name { font-size:12px; color:#888; margin-bottom:40px; }
  .sig-line { border-bottom:1px dashed #ccc; margin-bottom:6px; }
  .sig-footer { font-size:10px; color:#aaa; }

  .stamp-box {
position: absolute;
top: 45%;
left: 50%;
transform: translate(-50%, -50%) rotate(-18deg);
border: 6px double #dc2626;
border-radius: 50%;
width: 190px;
height: 190px;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
opacity: 0.75;
pointer-events: none;
z-index: 100;
}
.stamp-paid {
color: #dc2626;
font-size: 40px;
font-weight: 900;
letter-spacing: 5px;
}
.stamp-info {
color: #dc2626;
font-size: 9px;
font-weight: 700;
text-align: center;
letter-spacing: 0.5px;
margin-top: 6px;
line-height: 1.4;
}


      /* ═══ GESTION DES SAUTS DE PAGE ═══ */
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  .client-box, .resume-card, .paiement-box, .conditions, .signatures, .totaux { page-break-inside: avoid; }
  h3, .section-title, .section-sep { page-break-after: avoid; }

  /* PIED */
  .footer { border-top:1px solid #e5e7eb; padding-top:20px; margin-top:32px; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:10px; color:#aaa; }
  .footer-mention { font-size:9px; color:#aaa; font-style:italic; }

  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .page { padding:20px; }
  }
</style>
</head>
<body>
<div class="page">

<!-- EN-TÊTE -->
<div class="header">
  <div>
    <div class="brand">EN-CHECK</div>
    <div class="brand-sub">Système de pointage intelligent</div>
    <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
  </div>
  <div class="facture-ref">
    <div class="facture-title">Facture</div>
    <div class="facture-num">${numeroFacture}</div>
    <div class="facture-date">Émise le ${dateFacture}</div>
    <div class="facture-date" style="color:#EF4444; font-weight:600;">Échéance : ${dateEcheance}</div>
  </div>
</div>

<!-- INFOS CLIENT / VENDEUR -->
<div class="infos-grid">
  <div class="info-block vendeur">
    <div class="info-label green">Émetteur</div>
    <div class="info-name">En-Check</div>
    <div class="info-detail">Un produit MOYI TECH</div>
    <div class="info-detail">Système de pointage intelligent</div>
    <div class="info-detail">Cotonou, Bénin</div>
    <div class="info-rccm">RCCM : RB/COT/26 A 117584</div>
  </div>
  <div class="info-block client">
    <div class="info-label blue">Facturé à</div>
    ${prospect ? `
      <div class="info-name">${prospect.company_name}</div>
      <div class="info-detail">${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}</div>
      <div class="info-detail">${prospect.contact_phone ? `📞 ${prospect.contact_phone}` : ''}${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}</div>
    ` : '<div class="info-name">—</div>'}
  </div>
</div>

<!-- STATUT / CONDITIONS -->
<div class="statut-bar">
  <span class="statut-badge payable">📋 Paiement sous 30 jours</span>
  <span class="statut-badge engagement">${engConfig.label} · ${nbMois} mois</span>
  ${devisData.mois_gratuit ? '<span class="statut-badge gratuit">🎁 1 mois offert</span>' : ''}
  ${nbFois > 1 ? `<span class="statut-badge payable">💳 Paiement en ${nbFois}x</span>` : ''}
</div>

<!-- TABLEAU INVESTISSEMENT INITIAL -->
<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin-bottom:8px; padding-bottom:6px; border-bottom:2px solid #e8e8f8;">
  📦 Investissement initial — À régler ${nbFois > 1 ? `en ${nbFois} fois` : 'comptant'}
</div>
<table>
  <thead>
    <tr>
      <th style="width:46%">Désignation</th>
      <th class="num">Prix unitaire</th>
      <th class="num">Qté</th>
      <th class="num">Montant HT</th>
    </tr>
  </thead>
  <tbody>
    ${renderLignesFacture(lignesFixe)}
  </tbody>
</table>
<div class="section-sep"></div>

<!-- TABLEAU ABONNEMENT -->
<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin:16px 0 8px; padding-bottom:6px; border-bottom:2px solid #e8e8f8;">
  📅 Abonnement mensuel · ${formatF(mensuelNet)} FCFA/mois × ${nbMois} mois
</div>
<table>
  <thead>
    <tr>
      <th style="width:46%">Service</th>
      <th class="num">Prix unitaire</th>
      <th class="num">Qté</th>
      <th class="num">Montant HT</th>
    </tr>
  </thead>
  <tbody>
    ${renderLignesFacture(lignesMensuel)}
  </tbody>
</table>

<!-- TOTAUX -->
<div class="totaux">
  <div class="totaux-table">
    <div class="totaux-row subtotal">
      <span class="totaux-label">Investissement initial</span>
      <span class="totaux-value">${formatF(fixeNet)} FCFA</span>
    </div>
    <div class="totaux-row subtotal">
      <span class="totaux-label">Abonnement mensuel</span>
      <span class="totaux-value">${formatF(mensuelNet)} FCFA/mois</span>
    </div>
    <div class="totaux-row subtotal">
      <span class="totaux-label">Durée engagement</span>
      <span class="totaux-value">${nbMois} mois</span>
    </div>
    <div class="totaux-row grand-total">
      <span class="totaux-label">TOTAL GÉNÉRAL</span>
      <span class="totaux-value">${formatF(annuelNet)} FCFA</span>
    </div>
  </div>
</div>

<!-- MODALITÉS DE PAIEMENT -->
<div class="paiement-box">
  <div class="paiement-title">💳 Modalités de règlement</div>
  <div class="paiement-grid">
    <div class="paiement-item">
      <div class="paiement-item-label">Investissement initial</div>
      <div class="paiement-item-value">${formatF(fixeNet)}</div>
      <div class="paiement-item-sub">FCFA ${nbFois > 1 ? `en ${nbFois}x` : 'comptant'}</div>
    </div>
    ${nbFois > 1 ? `
    <div class="paiement-item">
      <div class="paiement-item-label">Par échéance</div>
      <div class="paiement-item-value">${formatF(echeance)}</div>
      <div class="paiement-item-sub">FCFA × ${nbFois} fois</div>
    </div>
    ` : ''}
    <div class="paiement-item">
      <div class="paiement-item-label">Mensuel</div>
      <div class="paiement-item-value">${formatF(mensuelNet)}</div>
      <div class="paiement-item-sub">FCFA / mois</div>
    </div>
    <div class="paiement-item">
      <div class="paiement-item-label">Total engagement</div>
      <div class="paiement-item-value">${formatF(annuelNet)}</div>
      <div class="paiement-item-sub">FCFA sur ${nbMois} mois</div>
    </div>
  </div>
</div>

<!-- CONDITIONS -->
<div class="conditions">
  <div class="conditions-title">📋 Conditions générales</div>
  <ul class="conditions-list">
    <li>Paiement de l'investissement initial dû à la signature du contrat${nbFois > 1 ? `, en ${nbFois} échéances égales de ${formatF(echeance)} FCFA` : ''}.</li>
    <li>Abonnement mensuel de ${formatF(mensuelNet)} FCFA dû le 1er de chaque mois, pour une durée de ${nbMois} mois.</li>
    ${devisData.mois_gratuit ? '<li>🎁 Premier mois d\'abonnement offert — déduit du plan de paiement.</li>' : ''}
    <li>Engagement : ${engConfig.label} — ${engConfig.desc}.</li>
    <li>Toute résiliation anticipée en dehors des conditions d'engagement fera l'objet d'une pénalité contractuelle.</li>
    <li>En cas de retard de paiement, des pénalités de 1,5% par mois seront appliquées.</li>
    <li>La présente facture tient lieu de document contractuel entre les parties.</li>
  </ul>
</div>

  <!-- SIGNATURES -->
<div class="signatures">
  <div class="sig-block">
    <div class="sig-title">Pour En-Check</div>
    <div class="sig-name">Signature</div>
    <div class="sig-line"></div>
    <div class="sig-footer">Date : ${signatureDateEnCheck ? new Date(signatureDateEnCheck).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
  </div>
  <div class="sig-block">
    <div class="sig-title">Pour le client</div>
    <div class="sig-name">Signature</div>
    <div class="sig-line"></div>
    <div class="sig-footer">Date : ${signatureDateClient ? new Date(signatureDateClient).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
  </div>
</div>


  ${applyStamp ? `
<div class="stamp-box">
  <div class="stamp-paid">PAYÉ</div>
  <div class="stamp-info">MOYI TECH<br/>RCCM : RB/COT/26 A 117584</div>
</div>
` : ''}

<!-- PIED DE PAGE -->
<div class="footer">
  <div class="footer-brand">Facture établie par En-Check</div>
  <div class="footer-mention">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Réf. ${numeroFacture}</div>
</div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  generateStyledPDF(html, numeroFacture)

}



// ═══════════════════════════════════════════════════════════
// FACTURE SIMPLIFIÉE — Lignes éditables
// ═══════════════════════════════════════════════════════════

export function handleDownloadFactureSimplifiee(devisData, totauxData, dateEmissionParam, dateEcheanceParam, signatureDateEnCheck = '', signatureDateClient = '', lignesEdit = [], applyStamp = false, prospects = []) {
  const prospect = prospects.find(p => p.id === devisData.prospect_id)
  const numeroFacture = (devisData.numero || '').replace('DEV-', 'FAC-')
  const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
  const nbMois = (devisData.mois_gratuit || totauxData?.nbMois)
    ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1))
    : engConfig.mois

  const dateFacture = dateEmissionParam
    ? new Date(dateEmissionParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const dateEcheance = dateEcheanceParam
    ? new Date(dateEcheanceParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Construire les lignes depuis l'éditeur
  const lignes = lignesEdit.length > 0 ? lignesEdit : [
    { label: 'Investissement initial En-Check', montant: String(totauxData?.totalFixeNet || devisData?.montant_fixe_net || 0), frequence: 'unique' },
    { label: 'Abonnement mensuel En-Check', montant: String(totauxData?.totalMensuelNet || devisData?.montant_mensuel_net || 0), frequence: 'mensuel' },
  ]

  const totalGeneral = lignes.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)

  const renderLignes = lignes.map((l, i) => {
    const montant = parseFloat(l.montant) || 0
    const frequenceLabel = l.frequence === 'mensuel' ? '/mois' : l.frequence === 'an' ? '/an' : ''
    return `
  <tr style="${i % 2 === 0 ? 'background:#fbfbff;' : ''}">
    <td style="padding:14px 16px; font-size:14px; color:#374151; font-weight:600;">
      ${l.label || 'Ligne libre'}
    </td>
    <td style="padding:14px 16px; text-align:right; font-size:14px; color:#374151;">
      ${montant > 0 ? `${formatF(montant)} FCFA` : '—'}
      ${frequenceLabel ? `<span style="color:#888; font-size:11px;"> ${frequenceLabel}</span>` : ''}
    </td>
  </tr>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture ${numeroFacture}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
  .page { max-width:800px; margin:0 auto; padding:48px 40px;position:relative; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
  .brand { font-size:30px; font-weight:900; color:#6366F1; letter-spacing:4px; }
  .brand-sub { font-size:10px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
  .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
  .facture-ref { text-align:right; }
  .facture-title { font-size:28px; font-weight:900; color:#1a1a2e; text-transform:uppercase; letter-spacing:2px; }
  .facture-num { font-size:16px; color:#6366F1; font-weight:700; margin-top:4px; }
  .facture-date { font-size:11px; color:#999; margin-top:2px; }

  .infos-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; }
  .info-block { padding:16px; border-radius:10px; background:#f8f7ff; }
  .info-block.client { border-left:4px solid #6366F1; }
  .info-block.vendeur { border-left:4px solid #10B981; }
  .info-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:8px; }
  .info-label.blue { color:#6366F1; }
  .info-label.green { color:#10B981; }
  .info-name { font-size:16px; font-weight:700; color:#1a1a2e; }
  .info-detail { font-size:12px; color:#777; margin-top:3px; }
  .info-rccm { font-size:10px; color:#999; margin-top:6px; padding-top:6px; border-top:1px solid #EEE; font-style:italic; }

  .statut-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
  .statut-badge { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; }
  .statut-badge.payable { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
  .statut-badge.engagement { background:#ede9fe; border:1px solid #c4b5fd; color:#5b21b6; }

  table { width:100%; border-collapse:collapse; margin-bottom:16px; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.07); }
  thead tr { background:#6366F1; }
  thead th { padding:12px 16px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#fff; }
  thead th.montant { text-align:right; }
  tbody tr { border-bottom:1px solid #f0f0f8; }

  .totaux { margin-top:16px; display:flex; justify-content:flex-end; }
  .totaux-table { width:340px; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
  .totaux-row { display:flex; justify-content:space-between; padding:10px 16px; border-bottom:1px solid #f0f0f8; }
  .totaux-row:last-child { border-bottom:none; }
  .totaux-row.subtotal { background:#f9fafb; }
  .totaux-row.grand-total { background:#6366F1; }
  .totaux-label { font-size:12px; color:#6b7280; }
  .totaux-value { font-size:13px; font-weight:700; color:#1a1a2e; font-family:monospace; }
  .totaux-row.grand-total .totaux-label, .totaux-row.grand-total .totaux-value { color:#fff; font-size:15px; }

  .paiement-box { margin-top:24px; background:#eff6ff; border:2px solid #93c5fd; border-radius:14px; padding:20px 24px; }
  .paiement-title { font-size:14px; font-weight:700; color:#1d4ed8; margin-bottom:12px; }
  .paiement-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
  .paiement-item { background:#fff; border-radius:10px; padding:12px; border:1px solid #bfdbfe; text-align:center; }
  .paiement-item-label { font-size:10px; color:#93c5fd; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-bottom:4px; }
  .paiement-item-value { font-size:18px; font-weight:800; color:#1d4ed8; font-family:monospace; }
  .paiement-item-sub { font-size:10px; color:#6b7280; margin-top:2px; }

  .conditions { margin-top:24px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px; }
  .conditions-title { font-size:12px; font-weight:700; color:#374151; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px; }
  .conditions-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
  .conditions-list li { font-size:11px; color:#6b7280; display:flex; align-items:flex-start; gap:6px; }
  .conditions-list li::before { content:"•"; color:#6366F1; font-weight:700; }

  

  .stamp-box {
position: absolute;
top: 45%;
left: 50%;
transform: translate(-50%, -50%) rotate(-18deg);
border: 6px double #dc2626;
border-radius: 50%;
width: 190px;
height: 190px;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
opacity: 0.75;
pointer-events: none;
z-index: 100;
}
.stamp-paid {
color: #dc2626;
font-size: 40px;
font-weight: 900;
letter-spacing: 5px;
}
.stamp-info {
color: #dc2626;
font-size: 9px;
font-weight: 700;
text-align: center;
letter-spacing: 0.5px;
margin-top: 6px;
line-height: 1.4;
}

  .footer { border-top:1px solid #e5e7eb; padding-top:20px; margin-top:32px; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:10px; color:#aaa; }
  .footer-mention { font-size:9px; color:#aaa; font-style:italic; }

  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } .page { padding:20px; } }
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div>
    <div class="brand">EN-CHECK</div>
    <div class="brand-sub">Système de pointage intelligent</div>
    <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
  </div>
  <div class="facture-ref">
    <div class="facture-title">Facture</div>
    <div class="facture-num">${numeroFacture}</div>
    <div class="facture-date">Émise le ${dateFacture}</div>
    <div class="facture-date" style="color:#EF4444; font-weight:600;">Échéance : ${dateEcheance}</div>
  </div>
</div>

<div class="infos-grid">
  <div class="info-block vendeur">
    <div class="info-label green">Émetteur</div>
    <div class="info-name">En-Check</div>
    <div class="info-detail">Un produit MOYI TECH</div>
    <div class="info-detail">Système de pointage intelligent</div>
    <div class="info-detail">Cotonou, Bénin</div>
    <div class="info-rccm">RCCM : RB/COT/26 A 117584</div>
  </div>
  <div class="info-block client">
    <div class="info-label blue">Facturé à</div>
    ${prospect ? `
      <div class="info-name">${prospect.company_name}</div>
      <div class="info-detail">${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}</div>
      <div class="info-detail">${prospect.contact_phone ? `📞 ${prospect.contact_phone}` : ''}${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}</div>
    ` : '<div class="info-name">—</div>'}
  </div>
</div>

<div class="statut-bar">
  <span class="statut-badge payable">📋 Paiement sous 30 jours</span>
  <span class="statut-badge engagement">${engConfig.label} · ${nbMois} mois</span>
</div>

<table>
  <thead>
    <tr>
      <th style="width:65%">Désignation</th>
      <th class="montant">Montant HT</th>
    </tr>
  </thead>
  <tbody>
    ${renderLignes}
  </tbody>
</table>

<div class="totaux">
  <div class="totaux-table">
    <div class="totaux-row grand-total">
      <span class="totaux-label">TOTAL GÉNÉRAL</span>
      <span class="totaux-value">${formatF(totalGeneral)} FCFA</span>
    </div>
  </div>
</div>

<div class="paiement-box">
  <div class="paiement-title">💳 Modalités de règlement</div>
  <div class="paiement-grid">
    <div class="paiement-item">
      <div class="paiement-item-label">Total facture</div>
      <div class="paiement-item-value">${formatF(totalGeneral)}</div>
      <div class="paiement-item-sub">FCFA</div>
    </div>
    <div class="paiement-item">
      <div class="paiement-item-label">Échéance</div>
      <div class="paiement-item-value" style="font-size:14px;">${dateEcheance}</div>
      <div class="paiement-item-sub">Date limite</div>
    </div>
  </div>
</div>

<div class="conditions">
  <div class="conditions-title">📋 Conditions générales</div>
  <ul class="conditions-list">
    <li>Paiement dû à la signature du présent document.</li>
    <li>En cas de retard de paiement, des pénalités de 1,5% par mois seront appliquées.</li>
    <li>La présente facture tient lieu de document contractuel entre les parties.</li>
  </ul>
</div>

${applyStamp ? `
<div class="stamp-box">
  <div class="stamp-paid">PAYÉ</div>
  <div class="stamp-info">MOYI TECH<br/>RCCM : RB/COT/26 A 117584</div>
</div>
` : ''}

<div class="footer">
  <div class="footer-brand">Facture établie par En-Check</div>
  <div class="footer-mention">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Réf. ${numeroFacture}</div>
</div>

</div>
</body>
</html>`

  generateStyledPDF(html, numeroFacture)
}

// ═══════════════════════════════════════════════════════════
// NOUVELLE FONCTION : GÉNÉRATION ÉCHÉANCIER PDF
// ═══════════════════════════════════════════════════════════

export function handleDownloadEcheancier(devisData, calculData, totauxData, dateDepartParam, echeancesStatutsParam = {}, signatureDateEnCheck = '', signatureDateClient = '', echeancesDatesParam = {}, applyStamp = false, prospects = []) {
  const prospect = prospects.find(p => p.id === devisData.prospect_id)
  const fixeNet = totauxData?.totalFixeNet || devisData.montant_fixe_net
  const mensuelNet = totauxData?.totalMensuelNet || devisData.montant_mensuel_net
  const annuelNet = totauxData?.totalAnnuelNet || devisData.montant_annuel_net
  const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
  const nbMois = (devisData.mois_gratuit || totauxData?.nbMois)
    ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1))
    : engConfig.mois
  const nbFois = totauxData?.paiementFois || devisData.paiement_fois || 1
  const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet
  const numeroEch = (devisData.numero || '').replace('DEV-', 'ECH-')
  const dateDepart = dateDepartParam ? new Date(dateDepartParam) : new Date()

  const lignesEcheancier = []
  let cumul = 0
  let numLigne = 1

  if (nbFois > 1) {
    for (let i = 0; i < nbFois; i++) {
      const montantEch = i < nbFois - 1 ? echeance : fixeNet - echeance * (nbFois - 1)
      const dateEch = new Date(dateDepart)
      dateEch.setMonth(dateEch.getMonth() + i)
      cumul += montantEch
      const numActuel = numLigne++
      // ← ICI : on prend la date modifiée si elle existe
      const datePaiement = echeancesDatesParam[numActuel]
        ? new Date(echeancesDatesParam[numActuel]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : dateEch.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      lignesEcheancier.push({
        num: numActuel,
        date: datePaiement,
        type: `💳 Investissement initial — Échéance ${i + 1}/${nbFois}`,
        montant: montantEch,
        cumul,
        categorie: 'fixe',
        statut: echeancesStatutsParam[numActuel] || 'attente',

      })
    }
  } else {
    cumul += fixeNet
    const numActuel = numLigne++
    // ← ICI : on prend la date modifiée si elle existe
    const datePaiement = echeancesDatesParam[numActuel]
      ? new Date(echeancesDatesParam[numActuel]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : dateDepart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    lignesEcheancier.push({
      num: numActuel,
      date: datePaiement,
      type: '💳 Investissement initial — Paiement comptant',
      montant: fixeNet,
      cumul,
      categorie: 'fixe',
      statut: echeancesStatutsParam[numActuel] || 'attente',
    })
  }

  for (let m = 0; m < nbMois; m++) {
    const dateMois = new Date(dateDepart)
    dateMois.setMonth(dateMois.getMonth() + (nbFois > 1 ? nbFois - 1 : 0) + m + 1)
    const isMoisOffert = devisData.mois_gratuit && m === 0
    const montantLigne = isMoisOffert ? 0 : mensuelNet
    cumul += montantLigne
    const numActuel = numLigne++
    // ← ICI : on prend la date modifiée si elle existe
    const datePaiement = echeancesDatesParam[numActuel]
      ? new Date(echeancesDatesParam[numActuel]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : dateMois.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    lignesEcheancier.push({
      num: numActuel,
      date: datePaiement,
      type: `📅 Abonnement mensuel — Mois ${m + 1}/${nbMois}${isMoisOffert ? ' 🎁 (offert)' : ''}`,
      montant: montantLigne,
      cumul,
      categorie: isMoisOffert ? 'offert' : 'mensuel',
      statut: isMoisOffert ? 'offert' : (echeancesStatutsParam[numActuel] || 'attente'),

    })
  }

  const totalReel = lignesEcheancier.reduce((s, l) => s + l.montant, 0)

  const renderLignesEch = () => lignesEcheancier.map(l => {
    // Statuts SANS émojis - badges textuels lisibles
    let statutBadge = ''
    let statutText = ''
    let statutColor = ''

    if (l.statut === 'paye') {
      statutBadge = 'PAYÉ'
      statutColor = '#10B981'
    } else if (l.statut === 'cours') {
      statutBadge = 'EN COURS'
      statutColor = '#F59E0B'
    } else if (l.statut === 'offert') {
      statutBadge = 'OFFERT'
      statutColor = '#10B981'
    } else {
      statutBadge = 'EN ATTENTE'
      statutColor = '#EF4444'
    }

    const bgColor = l.categorie === 'fixe' ? '#ede9fe' : l.categorie === 'offert' ? '#dcfce7' : '#fff'
    const textColor = l.categorie === 'fixe' ? '#5b21b6' : l.categorie === 'offert' ? '#15803d' : '#374151'
    const montantColor = l.categorie === 'offert' ? '#10B981' : '#1a1a2e'

    return `
  <tr style="background:${bgColor};">
    <td style="color:#6b7280; font-weight:700; text-align:center;">
      ${l.num}
    </td>
    <td style="color:#374151;">${l.date}</td>
    <td style="color:${textColor}; font-weight:600;">
      ${l.type}
    </td>
    <td style="text-align:right; font-weight:800; font-family:monospace; color:${montantColor}; font-size:14px;">
      ${l.categorie === 'offert' ? '<span style="color:#10B981; font-weight:800;">OFFERT</span>' : `${formatF(l.montant)} FCFA`}
    </td>
    <td style="text-align:center;">
      <span style="display:inline-block; background:${statutColor}; color:#fff; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; letter-spacing:0.5px;">
        ${statutBadge}
      </span>
    </td>
    <td style="text-align:right; font-family:monospace; color:#6b7280; font-size:12px;">${formatF(l.cumul)} FCFA</td>
  </tr>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Échéancier ${numeroEch}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
  .page { max-width:820px; margin:0 auto; padding:48px 40px;position:relative; }

  /* EN-TÊTE */
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
  .brand { font-size:30px; font-weight:900; color:#6366F1; letter-spacing:4px; }
  .brand-sub { font-size:10px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
  .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
  .ech-ref { text-align:right; }
  .ech-title { font-size:26px; font-weight:900; color:#1a1a2e; text-transform:uppercase; letter-spacing:2px; }
  .ech-num { font-size:16px; color:#6366F1; font-weight:700; margin-top:4px; }
  .ech-date { font-size:11px; color:#999; margin-top:2px; }

  /* CLIENT */
  .client-box { background:#f8f7ff; border-left:4px solid #6366F1; padding:16px 20px; border-radius:0 10px 10px 0; margin-bottom:24px; }
  .client-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#6366F1; font-weight:700; margin-bottom:4px; }
  .client-name { font-size:18px; font-weight:700; }
  .client-sub { color:#777; font-size:12px; margin-top:4px; }

  /* RÉSUMÉ FINANCIER */
  .resume { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:28px; }
  .resume-card { border-radius:12px; padding:16px; text-align:center; }
  .rc-fixe { background:#ede9fe; border:1px solid #c4b5fd; }
  .rc-mensuel { background:#eff6ff; border:1px solid #93c5fd; }
  .rc-total { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; }
  .rc-duree { background:#f0fdf4; border:1px solid #86efac; }
  .rc-label { font-size:9px; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:6px; }
  .rc-fixe .rc-label { color:#6d28d9; }
  .rc-mensuel .rc-label { color:#1d4ed8; }
  .rc-total .rc-label { color:#b45309; }
  .rc-duree .rc-label { color:#15803d; }
  .rc-value { font-size:18px; font-weight:900; font-family:monospace; }
  .rc-fixe .rc-value { color:#5b21b6; }
  .rc-mensuel .rc-value { color:#1d4ed8; }
  .rc-total .rc-value { color:#d97706; }
  .rc-duree .rc-value { color:#15803d; font-size:22px; }
  .rc-sub { font-size:10px; color:#888; margin-top:4px; }

  /* LÉGENDE */
  .legende { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
  .leg-item { display:inline-flex; align-items:center; gap:6px; font-size:11px; }
  .leg-dot { width:12px; height:12px; border-radius:3px; }

  /* TABLEAU */
  table { width:100%; border-collapse:collapse; border-radius:12px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); margin-bottom:24px; }
  thead tr { background:#6366F1; }
  thead th { padding:12px 14px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#fff; }
  tbody tr { border-bottom:1px solid rgba(0,0,0,0.04); }
  tbody td { padding:11px 14px; vertical-align:middle; font-size:13px; }
  tfoot tr { background:#6366F1; }
  tfoot td { padding:14px; font-weight:800; color:#fff; font-size:14px; }

  /* SYNTHÈSE */
  .synthese { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; border-radius:16px; padding:24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; }
  .syn-left .syn-title { font-size:16px; font-weight:700; color:#92400e; }
  .syn-left .syn-desc { font-size:12px; color:#b45309; margin-top:4px; }
  .syn-value { font-size:32px; font-weight:900; color:#d97706; font-family:monospace; }

  /* NOTES */
  .notes { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px; margin-bottom:24px; }
  .notes-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin-bottom:10px; }
  .notes-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
  .notes-list li { font-size:11px; color:#6b7280; display:flex; gap:6px; }
  .notes-list li::before { content:"→"; color:#6366F1; font-weight:700; }

      /* ═══ GESTION DES SAUTS DE PAGE ═══ */
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  .client-box, .resume-card, .synthese, .notes, .signatures { page-break-inside: avoid; }
  h3, .section-title { page-break-after: avoid; }

  /* SIGNATURES */
  .signatures { display:flex; gap:40px; margin-top:32px; }
  .sig-block { flex:1; border-top:2px solid #e5e7eb; padding-top:14px; }
  .sig-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin-bottom:6px; }
  .sig-name { font-size:12px; color:#888; margin-bottom:40px; }
  .sig-line { border-bottom:1px dashed #ccc; margin-bottom:6px; }
  .sig-footer { font-size:10px; color:#aaa; }


  .stamp-box {
position: absolute;
top: 45%;
left: 50%;
transform: translate(-50%, -50%) rotate(-18deg);
border: 6px double #dc2626;
border-radius: 50%;
width: 190px;
height: 190px;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
opacity: 0.75;
pointer-events: none;
z-index: 100;
}
.stamp-paid {
color: #dc2626;
font-size: 40px;
font-weight: 900;
letter-spacing: 5px;
}
.stamp-info {
color: #dc2626;
font-size: 9px;
font-weight: 700;
text-align: center;
letter-spacing: 0.5px;
margin-top: 6px;
line-height: 1.4;
}

  /* FOOTER */
  .footer { border-top:1px solid #e5e7eb; padding-top:18px; margin-top:24px; display:flex; justify-content:space-between; }
  .footer-brand { font-size:10px; color:#aaa; }
  .footer-mention { font-size:9px; color:#aaa; font-style:italic; }

  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .page { padding:20px; }
  }
</style>
</head>
<body>
<div class="page">

<!-- EN-TÊTE -->
<div class="header">
  <div>
    <div class="brand">EN-CHECK</div>
    <div class="brand-sub">Système de pointage intelligent</div>
    <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
  </div>
  <div class="ech-ref">
    <div class="ech-title">Échéancier</div>
    <div class="ech-num">${numeroEch}</div>
    <div class="ech-date">Établi le ${dateDepart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
</div>

<!-- CLIENT -->
${prospect ? `
<div class="client-box">
  <div class="client-label">Client</div>
  <div class="client-name">${prospect.company_name}</div>
  <div class="client-sub">
    ${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}
    ${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}
    ${prospect.contact_phone ? ` &nbsp;•&nbsp; 📞 ${prospect.contact_phone}` : ''}
    ${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}
  </div>
</div>` : ''}

<!-- RÉSUMÉ FINANCIER -->
<div class="resume">
  <div class="resume-card rc-fixe">
    <div class="rc-label">Investissement initial</div>
    <div class="rc-value">${formatF(fixeNet)}</div>
    <div class="rc-sub">FCFA ${nbFois > 1 ? `· ${nbFois}x ${formatF(echeance)} F` : '· comptant'}</div>
  </div>
  <div class="resume-card rc-mensuel">
    <div class="rc-label">Abonnement mensuel</div>
    <div class="rc-value">${formatF(mensuelNet)}</div>
    <div class="rc-sub">FCFA / mois</div>
  </div>
  <div class="resume-card rc-total">
    <div class="rc-label">Total engagement</div>
    <div class="rc-value">${formatF(annuelNet)}</div>
    <div class="rc-sub">FCFA sur ${nbMois} mois</div>
  </div>
  <div class="resume-card rc-duree">
    <div class="rc-label">Durée</div>
    <div class="rc-value">${nbMois}</div>
    <div class="rc-sub">mois · ${engConfig.label.replace(/[📅🔓]/g, '').trim()}</div>
  </div>
</div>

<!-- LÉGENDE -->
<div class="legende">
  <div class="leg-item"><div class="leg-dot" style="background:#c4b5fd;"></div><span>Investissement initial</span></div>
  <div class="leg-item"><div class="leg-dot" style="background:#e5e7eb;"></div><span>Abonnement mensuel</span></div>
  ${devisData.mois_gratuit ? '<div class="leg-item"><div class="leg-dot" style="background:#86efac;"></div><span>Mois offert</span></div>' : ''}
</div>

<!-- TABLEAU ÉCHÉANCIER -->
<table>
  <thead>
    <tr>
      <th style="width:30px; text-align:center;">N°</th>
      <th style="width:100px;">Date</th>
      <th style="flex:1;">Description</th>
      <th style="width:100px; text-align:right;">Montant</th>
      <th style="width:120px; text-align:center;">Statut</th>
      <th style="width:100px; text-align:right;">Cumul</th>
    </tr>
  </thead>
  <tbody>
    ${renderLignesEch()}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4">TOTAL GÉNÉRAL</td>
      <td style="text-align:right; font-family:monospace;">${formatF(totalReel)} FCFA</td>
    </tr>
  </tfoot>
</table>

<!-- SYNTHÈSE -->
<div class="synthese">
  <div class="syn-left">
    <div class="syn-title">📊 ${engConfig.label} — ${nbMois} mois</div>
    <div class="syn-desc">
      Initial ${nbFois > 1 ? `(${nbFois}x ${formatF(echeance)} FCFA)` : `(${formatF(fixeNet)} FCFA)`}
      + ${nbMois} mois × ${formatF(mensuelNet)} FCFA
      ${devisData.mois_gratuit ? '· 🎁 1 mois offert' : ''}
    </div>
  </div>
  <div class="syn-value">${formatF(annuelNet)} FCFA</div>
</div>

<!-- NOTES -->
<div class="notes">
  <div class="notes-title">📋 Notes importantes</div>
  <ul class="notes-list">
    <li>Le paiement de l'investissement initial est exigible à la signature du présent document.</li>
    ${nbFois > 1 ? `<li>Le paiement initial est fractionné en ${nbFois} fois. Chaque échéance de ${formatF(echeance)} FCFA est due à la date indiquée.</li>` : ''}
    <li>Les mensualités d'abonnement sont dues le 1er de chaque mois à la date indiquée dans le tableau.</li>
    ${devisData.mois_gratuit ? '<li>🎁 Le premier mois d\'abonnement est offert. Il n\'est pas comptabilisé dans le total.</li>' : ''}
    <li>En cas de retard de paiement, des pénalités de 1,5% par mois de retard seront facturées.</li>
    <li>Engagement ${engConfig.label} — ${engConfig.desc}.</li>
  </ul>
</div>

 <!-- SIGNATURES -->
<div class="signatures">
  <div class="sig-block">
    <div class="sig-title">Pour En-Check</div>
    <div class="sig-name">Signature</div>
    <div class="sig-line"></div>
    <div class="sig-footer">Date : ${signatureDateEnCheck ? new Date(signatureDateEnCheck).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
  </div>
  <div class="sig-block">
    <div class="sig-title">Pour le client</div>
    <div class="sig-name">Signature</div>
    <div class="sig-line"></div>
    <div class="sig-footer">Date : ${signatureDateEnCheck ? new Date(signatureDateEnCheck).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
  </div>
</div>

  ${applyStamp ? `
<div class="stamp-box">
  <div class="stamp-paid">PAYÉ</div>
  <div class="stamp-info">MOYI TECH<br/>RCCM : RB/COT/26 A 117584</div>
</div>
` : ''}

<!-- FOOTER -->
<div class="footer">
  <div class="footer-brand">Échéancier établi par En-Check</div>
  <div class="footer-mention">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Réf. ${numeroEch}</div>
</div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  // ✅ NOUVEAU

  generateStyledPDF(html, numeroEch)

} // ← ferme handleDownloadEcheancier
