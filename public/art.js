// Ilustrações originais em SVG dos personagens de Mascarada.

const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <pattern id="p-diamond" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="18" height="18" fill="none"/>
      <rect width="9" height="9" fill="rgba(255,255,255,0.045)"/>
    </pattern>
    <radialGradient id="vignette" cx="50%" cy="42%" r="70%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.65"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff1b8"/><stop offset="0.35" stop-color="#e3b53f"/>
      <stop offset="0.7" stop-color="#a87412"/><stop offset="1" stop-color="#f3d27a"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#b9c3d1"/>
      <stop offset="1" stop-color="#6d7b90"/>
    </linearGradient>
    <linearGradient id="bone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6efdc"/><stop offset="1" stop-color="#b9ab8c"/>
    </linearGradient>
    <radialGradient id="poison" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#d8ffb0"/><stop offset="0.45" stop-color="#52e05a"/><stop offset="1" stop-color="#0d5a1f"/>
    </radialGradient>
    <radialGradient id="elixir" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#7ff9e6"/><stop offset="1" stop-color="#0b7c75"/>
    </radialGradient>
    <radialGradient id="av-shine" cx="38%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0.55 0"/>
    </filter>
    <linearGradient id="keylight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe9c4" stop-opacity="0.32"/><stop offset="0.5" stop-color="#ffe9c4" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.55"/>
    </filter>
    ${bgGrad('banqueiro', '#7b3fb0', '#1c0930')}
    ${bgGrad('envenenador', '#a3182c', '#1a0306')}
    ${bgGrad('contrabandista', '#1b8a85', '#03201f')}
    ${bgGrad('emissario', '#3168c0', '#08142c')}
    ${bgGrad('alquimista', '#1d9a63', '#03200f')}
    ${bgGrad('back', '#7a1424', '#260308')}
    <radialGradient id="skin-a" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#f6cfa8"/><stop offset="1" stop-color="#c98d62"/></radialGradient>
    <radialGradient id="skin-b" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#d9a27a"/><stop offset="1" stop-color="#8f5a3a"/></radialGradient>
    <radialGradient id="skin-c" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#ffe0c6"/><stop offset="1" stop-color="#d9a07e"/></radialGradient>
  </defs>
</svg>`;

function bgGrad(id, a, b) {
  return `<radialGradient id="bg-${id}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
}

export function injectDefs() {
  if (document.getElementById('art-defs')) return;
  const d = document.createElement('div');
  d.id = 'art-defs';
  d.innerHTML = DEFS;
  document.body.prepend(d);
}

const bg = (id) => `
  <rect width="200" height="260" fill="url(#bg-${id})"/>
  <circle cx="70" cy="70" r="90" fill="#fff" opacity="0.07"/>
  <path d="M0 190 Q60 170 120 185 T200 175 V260 H0Z" fill="#000" opacity="0.18"/>`;
const vignette = `<rect width="200" height="260" fill="url(#keylight)"/><rect width="200" height="260" fill="url(#vignette)"/><rect width="200" height="260" filter="url(#grain)" opacity="0.5"/>`;

const head = (skin = 'skin-a') => `
  <path d="M88 142 L112 142 L114 178 L86 178 Z" fill="url(#${skin})"/>
  <path d="M86 160 Q100 170 114 160 L114 178 L86 178Z" fill="#000" opacity="0.18"/>
  <ellipse cx="100" cy="116" rx="31" ry="39" fill="url(#${skin})"/>
  <ellipse cx="69" cy="118" rx="5" ry="9" fill="url(#${skin})"/>
  <ellipse cx="131" cy="118" rx="5" ry="9" fill="url(#${skin})"/>
  <ellipse cx="80" cy="130" rx="8" ry="5" fill="#d9534f" opacity="0.18"/>
  <ellipse cx="120" cy="130" rx="8" ry="5" fill="#d9534f" opacity="0.18"/>
  <path d="M120 84 C136 96 136 140 112 154 C126 136 128 104 120 84Z" fill="#000" opacity="0.13"/>
  <path d="M86 156 Q100 162 114 156" stroke="#000" stroke-opacity="0.12" stroke-width="3" fill="none"/>`;

const eyesHoles = `
  <path d="M74 110 Q84 101 95 110 Q84 117 74 110Z" fill="#140a08"/>
  <path d="M105 110 Q116 101 126 110 Q116 117 105 110Z" fill="#140a08"/>
  <circle cx="87" cy="108.5" r="1.6" fill="#fff" opacity="0.85"/>
  <circle cx="118" cy="108.5" r="1.6" fill="#fff" opacity="0.85"/>`;

const maskShape = (fill, stroke) => `
  <path d="M63 110 C64 95 86 92 100 103 C114 92 136 95 137 110 C136 125 116 129 100 119 C84 129 64 125 63 110Z"
        fill="${fill}" stroke="${stroke}" stroke-width="2.2" filter="url(#soft)"/>
  ${eyesHoles}`;

const mouth = (d = 'M91 141 Q100 147 109 141', c = '#7a2a22') => `<path d="${d}" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const nose = `<path d="M100 117 Q97 128 100 132 Q103 133 105 131" stroke="#000" stroke-opacity="0.22" stroke-width="2" fill="none"/>`;

const svg = (inner, cls = '') => `<svg class="portrait ${cls}" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

// ---------------- Personagens ----------------

function banqueiro() {
  return svg(`
    ${bg('banqueiro')}
    <!-- moedas ao fundo -->
    <g opacity="0.9">
      ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="40" cy="${246 - i * 7}" rx="20" ry="6" fill="url(#gold)" stroke="#7a5208" stroke-width="1"/>`).join('')}
      ${[0, 1, 2].map((i) => `<ellipse cx="164" cy="${248 - i * 7}" rx="17" ry="5" fill="url(#gold)" stroke="#7a5208" stroke-width="1"/>`).join('')}
    </g>
    <!-- manto -->
    <path d="M12 260 C16 206 50 184 100 182 C150 184 184 206 188 260Z" fill="#3c1660"/>
    <path d="M100 182 L80 260 L120 260Z" fill="#2a0d45"/>
    <path d="M44 196 Q52 178 70 176 Q76 186 86 184 Q94 192 100 186 Q106 192 114 184 Q124 186 130 176 Q148 178 156 196 Q140 206 128 200 Q118 210 100 204 Q82 210 72 200 Q60 206 44 196Z" fill="#e8d8b5" stroke="#b9a37a" stroke-width="1.5"/>
    ${head('skin-a')}
    <!-- barba -->
    <path d="M71 124 Q72 160 100 165 Q128 160 129 124 Q124 146 110 146 Q100 142 90 146 Q76 146 71 124Z" fill="#cfcac4"/>
    <path d="M88 137 Q100 132 112 137 Q100 141 88 137Z" fill="#bdb6ae"/>
    ${mouth('M93 143 Q100 146 107 143', '#6b2a24')}
    ${nose}
    ${maskShape('url(#gold)', '#7a5208')}
    <circle cx="100" cy="98" r="3" fill="#7b3fb0" stroke="#fff3c4" stroke-width="1"/>
    <!-- chapéu -->
    <ellipse cx="100" cy="82" rx="56" ry="15" fill="#250b3d"/>
    <path d="M56 82 Q56 44 100 40 Q146 44 144 82Z" fill="#3a1259"/>
    <path d="M56 78 Q100 90 144 78 L144 84 Q100 96 56 84Z" fill="url(#gold)"/>
    <circle cx="124" cy="70" r="6" fill="#d0303f" stroke="url(#gold)" stroke-width="2"/>
    <!-- corrente -->
    <path d="M58 202 Q100 246 142 202" fill="none" stroke="url(#gold)" stroke-width="5" stroke-dasharray="7 3"/>
    <circle cx="100" cy="230" r="13" fill="url(#gold)" stroke="#7a5208" stroke-width="1.5"/>
    <text x="100" y="235" text-anchor="middle" font-family="Cinzel, serif" font-size="14" font-weight="700" fill="#5a3a06">$</text>
    ${vignette}`);
}

function envenenador() {
  return svg(`
    ${bg('envenenador')}
    <!-- capuz -->
    <path d="M40 170 C30 92 58 40 100 38 C142 40 170 92 160 170Z" fill="#1a1012"/>
    <path d="M10 260 C14 205 46 178 100 176 C154 178 186 205 190 260Z" fill="#160b0d"/>
    <path d="M100 176 C82 200 76 232 72 260 L128 260 C124 232 118 200 100 176Z" fill="#5e0d18"/>
    <path d="M52 150 C48 96 70 62 100 60 C130 62 152 96 148 150 C140 168 124 178 100 178 C76 178 60 168 52 150Z" fill="#0b0607"/>
    ${head('skin-b')}
    <ellipse cx="100" cy="116" rx="31" ry="39" fill="#000" opacity="0.35"/>
    <!-- máscara de bico -->
    <path d="M66 104 C66 86 134 86 134 104 L133 120 C126 127 114 128 107 132 L100 176 L93 132 C86 128 74 127 67 120Z" fill="url(#bone)" stroke="#6e624a" stroke-width="1.8" filter="url(#soft)"/>
    <path d="M100 132 L100 172" stroke="#8c7f62" stroke-width="1.4"/>
    <circle cx="84" cy="108" r="9" fill="#2b0004" stroke="#6e624a" stroke-width="2.5"/>
    <circle cx="116" cy="108" r="9" fill="#2b0004" stroke="#6e624a" stroke-width="2.5"/>
    <circle cx="84" cy="108" r="5" fill="#d1182f" filter="url(#glow)"/>
    <circle cx="116" cy="108" r="5" fill="#d1182f" filter="url(#glow)"/>
    <circle cx="82" cy="106" r="1.6" fill="#fff"/><circle cx="114" cy="106" r="1.6" fill="#fff"/>
    <!-- borda do capuz -->
    <path d="M52 150 C48 96 70 62 100 60 C130 62 152 96 148 150" fill="none" stroke="#3b2226" stroke-width="3"/>
    <!-- frasco de veneno -->
    <g transform="translate(150 206)">
      <ellipse cx="0" cy="12" rx="26" ry="22" fill="#52e05a" opacity="0.18" filter="url(#glow)"/>
      <rect x="-5" y="-22" width="10" height="16" rx="2" fill="#a4c8a8" opacity="0.9"/>
      <rect x="-7" y="-28" width="14" height="8" rx="2" fill="#6b4226"/>
      <path d="M-5 -8 C-22 -2 -22 30 0 32 C22 30 22 -2 5 -8Z" fill="url(#poison)" stroke="#d8ffd0" stroke-width="1.2" filter="url(#glow)"/>
      <path d="M-8 6 Q-4 0 0 6 Q4 12 8 6" stroke="#0d3a13" stroke-width="1.6" fill="none"/>
      <circle cx="-3" cy="2" r="2" fill="#fff" opacity="0.8"/>
      <path d="M0 34 Q-3 42 0 45 Q3 42 0 34Z" fill="#52e05a" filter="url(#glow)"/>
    </g>
    <!-- adaga -->
    <g transform="translate(44 214) rotate(-25)">
      <path d="M0 -40 L5 0 L-5 0Z" fill="url(#silver)"/>
      <rect x="-12" y="0" width="24" height="4" rx="2" fill="url(#gold)"/>
      <rect x="-3" y="4" width="6" height="16" rx="2" fill="#3b1a10"/>
    </g>
    ${vignette}`);
}

function contrabandista() {
  return svg(`
    ${bg('contrabandista')}
    <!-- ondas -->
    <g fill="none" stroke="#7fe0d6" stroke-opacity="0.15" stroke-width="2">
      <path d="M0 200 Q25 190 50 200 T100 200 T150 200 T200 200"/>
      <path d="M0 214 Q25 204 50 214 T100 214 T150 214 T200 214"/>
    </g>
    <!-- casaco -->
    <path d="M12 260 C16 206 50 184 100 182 C150 184 184 206 188 260Z" fill="#5a3820"/>
    <path d="M84 182 L100 230 L116 182Z" fill="#efe6d2"/>
    <path d="M70 186 L100 236 L84 260 L58 260 L54 196Z" fill="#6d4628" stroke="#2f1b0d" stroke-width="1.5"/>
    <path d="M130 186 L100 236 L116 260 L142 260 L146 196Z" fill="#6d4628" stroke="#2f1b0d" stroke-width="1.5"/>
    <circle cx="66" cy="228" r="3" fill="url(#gold)"/><circle cx="134" cy="228" r="3" fill="url(#gold)"/>
    ${head('skin-b')}
    <!-- barba por fazer -->
    <path d="M72 124 Q74 156 100 158 Q126 156 128 124 Q126 150 100 152 Q74 150 72 124Z" fill="#3a2414" opacity="0.45"/>
    ${mouth('M90 141 Q101 146 110 138', '#5a1d17')}
    ${nose}
    <!-- bandana -->
    <path d="M68 100 C70 74 130 74 132 100 C120 90 80 90 68 100Z" fill="#b01e2e"/>
    <path d="M128 96 L150 104 L140 118 Z" fill="#8c1622"/><path d="M130 98 L148 124 L136 126Z" fill="#a61c2b"/>
    ${maskShape('#151515', '#2bb3a4')}
    <!-- chapéu de três pontas -->
    <path d="M30 92 Q60 56 100 54 Q140 56 170 92 Q140 80 100 84 Q60 80 30 92Z" fill="#24160c" stroke="url(#gold)" stroke-width="2.5"/>
    <path d="M58 78 Q100 26 142 78 Q100 70 58 78Z" fill="#2f1d10"/>
    <circle cx="100" cy="66" r="5" fill="url(#gold)"/>
    <!-- brinco -->
    <circle cx="132" cy="130" r="5" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
    <!-- bolsa de moedas -->
    <g transform="translate(160 228)">
      <path d="M-18 -10 C-28 10 -20 26 0 26 C20 26 28 10 18 -10 Q0 -4 -18 -10Z" fill="#8a6338" stroke="#3b2612" stroke-width="1.5"/>
      <path d="M-12 -12 Q0 -20 12 -12" stroke="#3b2612" stroke-width="3" fill="none"/>
      <ellipse cx="-24" cy="24" rx="7" ry="3" fill="url(#gold)"/><ellipse cx="22" cy="27" rx="7" ry="3" fill="url(#gold)"/>
    </g>
    ${vignette}`);
}

function ruff() {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI; // meia elipse superior
    const r = i % 2 ? 40 : 30;
    pts.push(`${(100 + Math.cos(a) * r * 1.25).toFixed(1)},${(186 + Math.sin(a) * r * 0.42).toFixed(1)}`);
  }
  const lower = [];
  for (let i = n; i >= 0; i--) {
    const a = Math.PI + (i / n) * Math.PI;
    lower.push(`${(100 + Math.cos(a) * 34 * 1.25).toFixed(1)},${(186 - Math.sin(a) * 34 * 0.32).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')} ${lower.join(' ')}" fill="#f4f1ea" stroke="#b9b2a2" stroke-width="1.2"/>`;
}

function emissario() {
  return svg(`
    ${bg('emissario')}
    <!-- gibão -->
    <path d="M12 260 C16 206 50 184 100 182 C150 184 184 206 188 260Z" fill="#17295a"/>
    <path d="M100 186 L100 260" stroke="#0b1736" stroke-width="3"/>
    ${[200, 216, 232, 248].map((y) => `<circle cx="100" cy="${y}" r="3.2" fill="url(#silver)"/>`).join('')}
    <path d="M40 220 Q70 210 92 222 M108 222 Q130 210 160 220" stroke="#3a5aa8" stroke-width="3" fill="none"/>
    ${head('skin-c')}
    <!-- cabelo -->
    <path d="M69 108 C66 80 86 74 100 74 C120 74 136 82 131 108 C128 92 118 86 100 88 C82 86 72 94 69 108Z" fill="#5a3a22"/>
    <!-- bigode -->
    <path d="M86 136 Q93 131 100 135 Q107 131 114 136 Q107 139 100 137 Q93 139 86 136Z" fill="#4a2e1a"/>
    ${mouth('M93 143 Q100 146 107 143', '#8a3a30')}
    ${nose}
    ${maskShape('url(#silver)', '#3a5aa8')}
    <path d="M100 96 L104 102 L100 108 L96 102Z" fill="#4a7bd0" stroke="#fff" stroke-width="0.8"/>
    ${ruff()}
    <!-- boina com pluma -->
    <path d="M58 86 Q62 60 104 58 Q146 60 146 84 Q120 92 100 90 Q76 92 58 86Z" fill="#0e1a3e" stroke="#304f9a" stroke-width="2"/>
    <path d="M126 70 C150 44 172 46 186 14 C182 46 162 62 134 80Z" fill="#f4f6fb" stroke="#c6cede" stroke-width="1.2"/>
    <path d="M132 76 C152 56 168 46 182 22" stroke="#aab4c8" stroke-width="1" fill="none"/>
    <circle cx="128" cy="78" r="5" fill="url(#gold)"/>
    <!-- pergaminho -->
    <g transform="translate(42 226) rotate(-12)">
      <rect x="-26" y="-12" width="52" height="24" rx="3" fill="#efe1bb" stroke="#a88e5c" stroke-width="1.2"/>
      <rect x="-30" y="-14" width="8" height="28" rx="4" fill="#d9c79a" stroke="#a88e5c"/>
      <rect x="22" y="-14" width="8" height="28" rx="4" fill="#d9c79a" stroke="#a88e5c"/>
      <path d="M-16 -4 H14 M-16 2 H8" stroke="#a88e5c" stroke-width="1.4"/>
      <circle cx="10" cy="10" r="7" fill="#b0202d" stroke="#6d0f18" stroke-width="1"/>
      <path d="M6 16 L4 26 M14 16 L16 26" stroke="#b0202d" stroke-width="3"/>
    </g>
    ${vignette}`);
}

function alquimista() {
  return svg(`
    ${bg('alquimista')}
    <!-- brilhos -->
    ${[[30, 50], [170, 40], [180, 140], [24, 150], [60, 24]].map(([x, y]) => `<path d="M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5}Z" fill="#c9ffe9" opacity="0.7"/>`).join('')}
    <!-- cabelo atrás -->
    <path d="M60 120 C52 70 78 64 100 64 C126 64 152 74 140 124 C150 168 152 200 144 222 L56 222 C48 200 50 166 60 120Z" fill="#8a3a1c"/>
    <!-- vestido -->
    <path d="M12 260 C16 206 50 186 100 184 C150 186 184 206 188 260Z" fill="#0f3d28"/>
    <path d="M62 190 Q100 226 138 190" fill="none" stroke="url(#gold)" stroke-width="3"/>
    <path d="M100 222 L94 232 L100 242 L106 232Z" fill="#3fbf6f" stroke="url(#gold)" stroke-width="1.5"/>
    ${head('skin-c')}
    <!-- franja -->
    <path d="M69 108 C66 76 90 70 104 72 C126 74 136 86 131 110 C124 92 112 86 98 88 C84 90 74 98 69 108Z" fill="#9c4423"/>
    <!-- mechas na frente -->
    <path d="M70 110 C62 140 66 170 74 190 C70 160 72 136 78 118Z" fill="#9c4423"/>
    <path d="M130 110 C138 140 134 170 126 190 C130 160 128 136 122 118Z" fill="#9c4423"/>
    ${mouth('M93 142 Q100 147 107 142', '#b3384a')}
    <path d="M94 141 Q100 139 106 141" stroke="#d9606f" stroke-width="2" fill="none"/>
    ${nose}
    <!-- máscara com folhas -->
    <path d="M62 104 C50 92 46 100 50 108 C44 108 46 118 58 116Z" fill="#3fbf6f" stroke="url(#gold)" stroke-width="1"/>
    <path d="M138 104 C150 92 154 100 150 108 C156 108 154 118 142 116Z" fill="#3fbf6f" stroke="url(#gold)" stroke-width="1"/>
    ${maskShape('#1f8a52', '#e3b53f')}
    <path d="M70 108 Q84 96 96 106 M104 106 Q116 96 130 108" stroke="url(#gold)" stroke-width="1.4" fill="none"/>
    <!-- tiara -->
    <path d="M72 88 Q100 78 128 88" stroke="url(#gold)" stroke-width="2.5" fill="none"/>
    <circle cx="100" cy="82" r="4" fill="#3fbf6f" stroke="url(#gold)" stroke-width="1.5"/>
    <!-- frasco de antídoto -->
    <g transform="translate(154 214)">
      <circle cx="0" cy="8" r="30" fill="#7ff9e6" opacity="0.16" filter="url(#glow)"/>
      <rect x="-5" y="-26" width="10" height="16" fill="#cdeeea" opacity="0.85"/>
      <rect x="-7" y="-31" width="14" height="7" rx="2" fill="#7a5230"/>
      <circle cx="0" cy="8" r="20" fill="url(#elixir)" stroke="#e8fffb" stroke-width="1.4" filter="url(#glow)"/>
      <circle cx="-6" cy="4" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="5" cy="12" r="2" fill="#fff" opacity="0.7"/>
      <circle cx="2" cy="-2" r="1.5" fill="#fff" opacity="0.7"/>
    </g>
    ${vignette}`);
}

// ---------------- Cartas como imagem ----------------
// Coloque arquivos em public/cartas/<nome>.(png|jpg|jpeg|webp|svg).
// Nomes: duque, envenenador, contrabandista, embaixador, alquimista e verso.
// Quando a imagem existe, ela substitui a ilustração desenhada.
// id interno da carta -> nome do arquivo em public/cartas
export const CARD_FILES = {
  banqueiro: 'duque', envenenador: 'assassino', contrabandista: 'capitao',
  emissario: 'embaixador', alquimista: 'condessa', verso: 'verso',
};
const EXTS = ['png', 'webp', 'jpg', 'jpeg', 'svg'];
export const cardImages = {};

function probe(url) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = url;
  });
}

export async function loadCardImages() {
  await Promise.all(Object.entries(CARD_FILES).map(async ([role, name]) => {
    for (const ext of EXTS) {
      const url = `cartas/${name}.${ext}`;
      if (await probe(url)) { cardImages[role] = url; return; }
    }
  }));
}

export const hasImage = (role) => !!cardImages[role];
const imgTag = (name) => `<img class="portrait card-img" src="${cardImages[name]}" alt="" draggable="false">`;

export function cardBack() {
  if (cardImages.verso) return imgTag('verso');
  return svg(`
    ${bg('back')}
    <rect width="200" height="260" fill="url(#p-diamond)"/>
    <rect x="10" y="10" width="180" height="240" rx="6" fill="none" stroke="#e9dcbc" stroke-width="2.5"/>
    <rect x="17" y="17" width="166" height="226" rx="4" fill="none" stroke="#e9dcbc" stroke-width="0.8" opacity="0.7"/>
    ${[[17, 17], [183, 17], [17, 243], [183, 243]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#e9dcbc"/>`).join('')}
    <g transform="translate(100 124) scale(1.15)">
      <circle r="44" fill="none" stroke="url(#gold)" stroke-width="1.5" opacity="0.6"/>
      <path d="M-37 -4 C-36 -19 -14 -22 0 -11 C14 -22 36 -19 37 -4 C36 11 16 15 0 5 C-16 15 -36 11 -37 -4Z" fill="url(#gold)" stroke="#6d4a08" stroke-width="1.5"/>
      <path d="M-26 -4 Q-16 -13 -5 -4 Q-16 3 -26 -4Z M5 -4 Q16 -13 26 -4 Q16 3 5 -4Z" fill="#2a0408"/>
      <path d="M-37 -4 C-48 -12 -52 -26 -42 -34 M37 -4 C48 -12 52 -26 42 -34" stroke="url(#gold)" stroke-width="2" fill="none"/>
      <path d="M0 5 L0 30" stroke="url(#gold)" stroke-width="2"/>
      <path d="M-6 30 L0 40 L6 30Z" fill="url(#gold)"/>
    </g>
    <text x="100" y="226" text-anchor="middle" font-family="Cinzel, serif" font-size="13" letter-spacing="4" fill="#e9dcbc" opacity="0.9">MASCARADA</text>
    ${vignette}`, 'back');
}

const PORTRAITS = { banqueiro, envenenador, contrabandista, emissario, alquimista };
const cache = {};
export function portrait(role) {
  if (cardImages[role]) return imgTag(role);
  if (!PORTRAITS[role]) return cardBack();
  return (cache[role] ||= PORTRAITS[role]());
}

/** Medalhão de avatar com máscara colorida. */
export function avatar(name, hue, isBot) {
  const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
  return `<svg viewBox="0 0 64 64" class="avatar-svg">
    <circle cx="32" cy="32" r="30" fill="hsl(${hue} 65% 38%)"/>
    <circle cx="32" cy="32" r="30" fill="url(#av-shine)" stroke="url(#gold)" stroke-width="3"/>
    <path d="M12 28 C13 20 25 18 32 24 C39 18 51 20 52 28 C51 36 40 38 32 33 C24 38 13 36 12 28Z" fill="#111" opacity="0.85"/>
    <path d="M18 28 Q24 23 29 28 Q24 31 18 28Z M35 28 Q40 23 46 28 Q40 31 35 28Z" fill="hsl(${hue} 80% 75%)"/>
    <text x="32" y="54" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="15" fill="#fff">${initial.replace(/[<>&]/g, '')}</text>
  </svg>`;
}

export function coinSvg() {
  return `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="url(#gold)" stroke="#7a5208" stroke-width="2"/><circle cx="20" cy="20" r="12" fill="none" stroke="#7a5208" stroke-width="1.5" opacity="0.6"/><text x="20" y="25" text-anchor="middle" font-family="Cinzel,serif" font-weight="700" font-size="13" fill="#6b4606">M</text></svg>`;
}
