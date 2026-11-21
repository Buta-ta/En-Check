// docs/maquettes/motif-seuil.js
// Le même motif Adinkra que celui de la page Pointages (D-004), reproduit en
// SVG pour la maquette — la vraie page charge le WebP. Ce n'est pas un dessin
// inventé : c'est la bande déjà en service, réduite à sa trame.
const MOTIF_ADINKRA = `url("data:image/svg+xml,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76' viewBox='0 0 76 76'>
  <rect width='76' height='76' fill='#2A1708'/>
  <g fill='none' stroke='#C9A961' stroke-width='1.6'>
    <path d='M10 10 h20 v20 h-20 z'/>
    <path d='M46 10 h20 v20 h-20 z'/>
    <path d='M10 46 h20 v20 h-20 z'/>
    <path d='M46 46 h20 v20 h-20 z'/>
    <path d='M20 20 v10 M30 20 v10 M20 30 h10'/>
    <path d='M56 10 v20 M46 20 h20'/>
    <path d='M10 56 h20 M20 46 v20'/>
    <path d='M56 46 v10 M50 56 h16'/>
  </g>
</svg>`)}")`

// Posée en variable CSS : les deux maquettes et la page statique la lisent.
document.documentElement.style.setProperty('--motif-adinkra', MOTIF_ADINKRA)
