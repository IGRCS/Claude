// Desenha os lutadores em SVG (vetor), pose por pose.
// Todo boneco é desenhado olhando para a DIREITA; o jogo espelha o lutador do lado direito.

export const LARGURA = 600;
export const ALTURA = 760;

const CONTORNO = '#22160f';
const QUADRIL = { x: 285, y: 478 };
const CHAO = 732;

// ---------------------------------------------------------------- cores
function hexParaRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbParaHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function misturar(a, b, t) {
  const A = hexParaRgb(a);
  const B = hexParaRgb(b);
  return rgbParaHex(A.map((v, i) => v + (B[i] - v) * t));
}
const escurecer = (c, t) => misturar(c, '#000000', t);
const clarear = (c, t) => misturar(c, '#ffffff', t);

// ---------------------------------------------------------------- geometria
const f = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f(p.x)},${f(p.y)}`;
const soma = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// Cinemática inversa de dois ossos: devolve o cotovelo/joelho.
function ik(origem, alvo, l1, l2, dobra) {
  let d = dist(origem, alvo);
  const max = l1 + l2 - 0.5;
  let fim = alvo;
  if (d > max) {
    const k = max / d;
    fim = { x: origem.x + (alvo.x - origem.x) * k, y: origem.y + (alvo.y - origem.y) * k };
    d = max;
  }
  const a = Math.atan2(fim.y - origem.y, fim.x - origem.x);
  const cos = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const b = Math.acos(cos) * dobra;
  const meio = { x: origem.x + Math.cos(a + b) * l1, y: origem.y + Math.sin(a + b) * l1 };
  return { meio, fim };
}

function estrela(cx, cy, r, rot = -90, pontas = 5, interno = 0.45) {
  const pts = [];
  for (let i = 0; i < pontas * 2; i++) {
    const raio = i % 2 === 0 ? r : r * interno;
    const ang = ((rot + (i * 180) / pontas) * Math.PI) / 180;
    pts.push(`${f(cx + Math.cos(ang) * raio)},${f(cy + Math.sin(ang) * raio)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

// Arco "fofo" (cabelo/barba com tufos): de a1 até a2 em graus.
function arcoFofo(cx, cy, r, a1, a2, n, tufo) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = ((a1 + ((a2 - a1) * i) / n) * Math.PI) / 180;
    const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    if (i === 0) {
      d += `M ${pt(p)}`;
    } else {
      const am = ((a1 + ((a2 - a1) * (i - 0.5)) / n) * Math.PI) / 180;
      const c = { x: cx + Math.cos(am) * (r + tufo), y: cy + Math.sin(am) * (r + tufo) };
      d += ` Q ${pt(c)} ${pt(p)}`;
    }
  }
  return d;
}

// ---------------------------------------------------------------- poses
// Coordenadas relativas ao quadril, antes da inclinação do tronco.
export const POSES = {
  parado: {
    inclinacao: 4, cabeca: 0, agachar: 8, rosto: 'normal',
    maoTras: { x: 112, y: -150 }, maoFrente: { x: 150, y: -104 },
    peTras: { x: -100, y: 0 }, peFrente: { x: 108, y: 0 },
  },
  soco: {
    inclinacao: 13, cabeca: 6, agachar: 4, rosto: 'grito',
    maoTras: { x: 108, y: -150 }, maoFrente: { x: 236, y: -126 },
    peTras: { x: -118, y: 0 }, peFrente: { x: 118, y: 0 },
  },
  especial: {
    inclinacao: 18, cabeca: 8, agachar: -8, rosto: 'grito',
    maoTras: { x: 100, y: -120 }, maoFrente: { x: 200, y: -250 },
    peTras: { x: -112, y: 0 }, peFrente: { x: 112, y: 0 },
  },
  apanhando: {
    inclinacao: -15, cabeca: -18, agachar: 10, rosto: 'dor', extras: ['suor'],
    maoTras: { x: -175, y: -160 }, maoFrente: { x: 120, y: -30 },
    peTras: { x: -112, y: 0 }, peFrente: { x: 92, y: 0 },
  },
  nocaute: {
    inclinacao: -6, cabeca: 16, agachar: 34, rosto: 'ko', extras: ['estrelas'],
    maoTras: { x: -62, y: 12 }, maoFrente: { x: 76, y: 14 },
    peTras: { x: -70, y: 0 }, peFrente: { x: 78, y: 0 },
  },
  vitoria: {
    inclinacao: -3, cabeca: -6, agachar: -4, rosto: 'feliz',
    maoTras: { x: -130, y: -300 }, maoFrente: { x: 140, y: -300 },
    peTras: { x: -96, y: 0 }, peFrente: { x: 100, y: 0 },
  },
};

// ---------------------------------------------------------------- peças
function membro(a, b, c, largura, cor, contorno = CONTORNO) {
  const d = `M ${pt(a)} L ${pt(b)} L ${pt(c)}`;
  return `
    <path d="${d}" fill="none" stroke="${contorno}" stroke-width="${largura + 9}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${clarear(cor, 0.35)}" stroke-opacity="0.45" stroke-width="${largura * 0.28}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f(largura * 0.16)},${f(-largura * 0.18)})"/>`;
}

function luva(mao, angulo, cor, punho, id) {
  const g = `url(#${id}-luva)`;
  return `
  <g transform="translate(${pt(mao)}) rotate(${f(angulo)})">
    <rect x="-34" y="-25" width="30" height="50" rx="10" fill="${punho}" stroke="${CONTORNO}" stroke-width="5"/>
    <path d="M -10,-30 C 10,-46 52,-44 62,-14 C 70,8 60,34 34,40 C 10,46 -12,34 -14,10 C -16,-8 -18,-22 -10,-30 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M -6,-8 C -2,-26 18,-30 26,-18 C 30,-10 24,-2 14,-2 C 6,-2 -2,-2 -6,-8 Z" fill="${escurecer(cor, 0.1)}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="34" cy="-20" rx="16" ry="7" fill="#ffffff" opacity="0.38" transform="rotate(-12 34 -20)"/>
  </g>`;
}

function sapato(p, cor, sola, viraTras = false) {
  const esc = viraTras ? 'scale(0.92,1)' : '';
  return `
  <g transform="translate(${pt(p)}) ${esc}">
    <path d="M -30,-16 C -28,-34 4,-38 18,-26 C 40,-24 58,-14 60,0 C 60,10 52,14 42,14 L -30,14 C -40,14 -42,-6 -30,-16 Z" fill="${cor}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M -36,6 L 58,6 C 58,12 52,15 42,15 L -30,15 C -36,15 -38,10 -36,6 Z" fill="${sola}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M -2,-26 L 10,-18 M 6,-30 L 18,-22" stroke="${clarear(cor, 0.6)}" stroke-width="4" stroke-linecap="round"/>
  </g>`;
}

// ---------------------------------------------------------------- rosto
function olhos(expr, d) {
  const pupila = d.corOlho || '#2b1d14';
  const sob = d.corSobrancelha || '#2b1d14';
  const ls = d.sobrancelhaGrossa ? 13 : 10;
  const sobr = (pts) => `<path d="${pts}" fill="none" stroke="${sob}" stroke-width="${ls}" stroke-linecap="round"/>`;
  if (expr === 'ko') {
    const x = (cx, cy, r) => `<path d="M ${cx - r},${cy - r} L ${cx + r},${cy + r} M ${cx + r},${cy - r} L ${cx - r},${cy + r}" stroke="${CONTORNO}" stroke-width="7" stroke-linecap="round"/>`;
    return x(22, -10, 12) + x(76, -12, 10) + sobr('M 2,-44 Q 22,-50 40,-40') + sobr('M 62,-42 Q 78,-48 92,-40');
  }
  if (expr === 'dor') {
    return `
      <path d="M 6,-24 L 32,-12 L 6,0" fill="none" stroke="${CONTORNO}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 90,-26 L 66,-14 L 90,-2" fill="none" stroke="${CONTORNO}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      ${sobr('M 4,-36 Q 22,-50 40,-46')}${sobr('M 62,-46 Q 80,-52 94,-38')}`;
  }
  if (expr === 'feliz') {
    return `
      <path d="M 6,-6 Q 22,-30 38,-6" fill="none" stroke="${CONTORNO}" stroke-width="7" stroke-linecap="round"/>
      <path d="M 64,-8 Q 78,-28 92,-8" fill="none" stroke="${CONTORNO}" stroke-width="7" stroke-linecap="round"/>
      ${sobr('M 2,-40 Q 22,-54 42,-42')}${sobr('M 60,-44 Q 78,-56 96,-42')}`;
  }
  const bravo = expr === 'grito';
  const ry = bravo ? 15 : 19;
  const sobrPerto = bravo ? 'M 0,-46 Q 22,-40 42,-26' : 'M 0,-40 Q 20,-48 42,-36';
  const sobrLonge = bravo ? 'M 62,-28 Q 80,-42 96,-44' : 'M 60,-38 Q 78,-48 96,-42';
  return `
    <ellipse cx="22" cy="-10" rx="17" ry="${ry}" fill="#ffffff" stroke="${CONTORNO}" stroke-width="4.5"/>
    <ellipse cx="76" cy="-12" rx="13" ry="${ry - 1}" fill="#ffffff" stroke="${CONTORNO}" stroke-width="4.5"/>
    <circle cx="28" cy="-8" r="${bravo ? 8 : 9.5}" fill="${pupila}"/>
    <circle cx="80" cy="-10" r="${bravo ? 7 : 8.5}" fill="${pupila}"/>
    <circle cx="31" cy="-12" r="3" fill="#ffffff"/>
    <circle cx="83" cy="-14" r="2.6" fill="#ffffff"/>
    ${sobr(sobrPerto)}${sobr(sobrLonge)}`;
}

function boca(expr, d) {
  const escuro = '#5b1414';
  const lingua = '#e2657a';
  if (expr === 'grito') {
    return `
      <path d="M 24,52 Q 54,40 88,48 Q 84,98 52,98 Q 26,92 24,52 Z" fill="${escuro}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 28,54 Q 56,44 85,50 L 84,60 Q 56,54 30,64 Z" fill="#ffffff"/>
      <ellipse cx="56" cy="88" rx="18" ry="8" fill="${lingua}"/>`;
  }
  if (expr === 'dor') {
    return `
      <path d="M 26,60 Q 56,50 86,58 Q 84,80 56,80 Q 28,80 26,60 Z" fill="#ffffff" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 27,69 Q 56,62 85,68 M 40,56 L 40,80 M 56,54 L 56,80 M 72,55 L 72,79" stroke="${CONTORNO}" stroke-width="3" fill="none"/>`;
  }
  if (expr === 'ko') {
    return `
      <path d="M 30,58 Q 58,48 84,56 Q 82,82 56,84 Q 32,82 30,58 Z" fill="${escuro}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 50,72 C 48,96 58,112 70,108 C 80,104 78,88 72,72 Z" fill="${lingua}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (expr === 'feliz') {
    return `
      <path d="M 20,46 Q 56,52 92,42 Q 84,98 52,98 Q 22,92 20,46 Z" fill="${escuro}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 24,48 Q 56,54 88,45 L 86,56 Q 56,64 26,58 Z" fill="#ffffff"/>
      <ellipse cx="54" cy="86" rx="20" ry="9" fill="${lingua}"/>`;
  }
  // normal: sorrisinho de canto
  return `<path d="M 30,62 Q 54,72 82,54" fill="none" stroke="${CONTORNO}" stroke-width="6" stroke-linecap="round"/>
          <path d="M 80,48 Q 86,54 82,60" fill="none" stroke="${CONTORNO}" stroke-width="4" stroke-linecap="round"/>`;
}

function nariz(d) {
  const pele = `url(#${d.id}-pele)`;
  if (d.nariz === 'grande') {
    return `<path d="M 50,-4 C 56,10 70,14 84,18 C 100,24 98,46 80,46 C 72,50 60,46 56,38" fill="${pele}" stroke="${CONTORNO}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 70,38 Q 76,34 82,38" fill="none" stroke="${escurecer(d.pele, 0.35)}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (d.nariz === 'nenhum') return '';
  return `<path d="M 54,-2 C 60,12 72,18 80,24 C 86,32 76,38 62,36" fill="none" stroke="${CONTORNO}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------- cabelos e barbas
function cabeloTras(d) {
  const c = d.cabelo;
  if (!c) return '';
  const g = `url(#${d.id}-cabelo)`;
  if (c.estilo === 'grisalho-calvo') {
    // tufos brancos na nuca, aparecendo por trás do crânio
    return `<path d="${arcoFofo(-4, -4, 104, -98, -238, 7, 16)} L -30,30 L -10,-40 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>`;
  }
  return '';
}

function cabeloFrente(d) {
  const c = d.cabelo;
  if (!c) return '';
  const g = `url(#${d.id}-cabelo)`;
  const brilho = clarear(c.cor, 0.45);
  if (c.estilo === 'grisalho-calvo') {
    // topo ralo (entradas grandes) + costeleta ligando à barba
    const sombraFio = escurecer(c.cor, 0.22);
    return `
      <path d="M 2,-106 C -40,-108 -84,-82 -98,-36 C -102,-22 -102,-8 -100,4 Q -90,-2 -80,6 Q -78,-12 -70,-16 Q -72,-30 -60,-36 Q -60,-50 -46,-54 Q -42,-68 -28,-70 Q -22,-84 -8,-86 Q 0,-98 14,-98 Q 10,-104 2,-106 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M -88,-40 C -80,-62 -60,-82 -30,-94 M -76,-22 C -66,-44 -50,-60 -26,-74 M -60,-90 C -40,-100 -16,-102 0,-100" fill="none" stroke="${sombraFio}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M -72,-22 C -82,-4 -80,18 -62,34 L -46,16 C -54,4 -56,-8 -54,-20 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M 26,-84 C 40,-90 54,-88 64,-82" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.35"/>`;
  }
  if (c.estilo === 'social') {
    return `
      <path d="M -100,0 C -108,-62 -62,-116 8,-114 C 58,-114 96,-86 100,-46 C 88,-60 70,-66 52,-62 C 44,-52 28,-50 12,-54 C -12,-60 -40,-48 -56,-26 C -64,-12 -68,6 -72,22 C -84,18 -96,12 -100,0 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M -6,-112 C 40,-130 98,-110 104,-58 C 92,-76 66,-90 34,-90 C 18,-90 4,-96 -6,-112 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M -40,-96 C -10,-108 30,-110 70,-96" fill="none" stroke="${brilho}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
      <path d="M -22,-108 C -26,-90 -34,-76 -46,-64" fill="none" stroke="${escurecer(c.cor, 0.4)}" stroke-width="4" stroke-linecap="round"/>
      <path d="M -44,-20 C -48,-4 -46,14 -40,26 L -30,24 C -34,8 -34,-6 -30,-20 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (c.estilo === 'curto') {
    return `
      <path d="M -100,4 C -108,-64 -60,-112 6,-112 C 62,-112 98,-82 100,-40 C 86,-54 60,-60 34,-58 C 2,-56 -30,-50 -52,-30 C -62,-18 -68,2 -72,20 C -86,18 -96,14 -100,4 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M -70,-70 q 8,-8 16,0 M -40,-88 q 8,-8 16,0 M -6,-96 q 8,-8 16,0 M 28,-90 q 8,-8 16,0 M 58,-78 q 8,-8 16,0 M -84,-36 q 8,-8 16,0" fill="none" stroke="${brilho}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`;
  }
  if (c.estilo === 'raspado') {
    return `<path d="M -98,10 C -108,-60 -60,-108 4,-108 C 60,-108 96,-80 98,-36 C 70,-50 40,-56 10,-56 C -24,-54 -50,-42 -64,-22 C -70,-10 -72,4 -74,18 C -86,18 -94,16 -98,10 Z" fill="${c.cor}" opacity="0.85" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  return '';
}

function barba(d, expr) {
  const b = d.barba;
  if (!b) return { tras: '', bigode: '' };
  if (b.estilo === 'cheia') {
    const g = `url(#${d.id}-barba)`;
    const claro = clarear(b.cor, 0.5);
    const tras = `
      <path d="M -44,8 C -48,52 -34,96 -2,114 C 32,132 76,118 98,84 C 110,62 110,40 104,22 C 94,34 84,38 72,36 C 58,34 38,36 22,40 C 4,44 -14,38 -26,22 C -32,14 -38,8 -44,8 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M -26,46 q 6,10 0,20 M -8,74 q 8,8 4,18 M 18,92 q 8,6 6,16 M 50,100 q 6,4 8,14 M 80,86 q 6,2 10,10" fill="none" stroke="${claro}" stroke-width="4" stroke-linecap="round" opacity="0.9"/>`;
    const bigode = `
      <path d="M 18,44 C 30,28 54,24 66,34 C 76,24 98,26 106,40 C 98,52 80,52 68,46 C 54,56 30,56 18,44 Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 34,40 q 10,-6 22,-4 M 74,36 q 12,-2 22,4" fill="none" stroke="${claro}" stroke-width="3.5" stroke-linecap="round"/>`;
    return { tras, bigode };
  }
  if (b.estilo === 'sombra') {
    return {
      tras: `<path d="M -40,26 C -34,72 -2,104 40,104 C 74,100 94,72 98,40 C 82,60 62,68 40,68 C 8,68 -22,52 -40,26 Z" fill="${b.cor}" opacity="0.2"/>`,
      bigode: `<path d="M 34,48 Q 58,40 86,46" fill="none" stroke="${b.cor}" stroke-width="7" stroke-linecap="round" opacity="0.22"/>`,
    };
  }
  if (b.estilo === 'cavanhaque') {
    return {
      tras: `<path d="M 30,78 C 34,100 50,112 66,108 C 80,104 86,92 86,78 C 70,86 46,86 30,78 Z" fill="${b.cor}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>`,
      bigode: `<path d="M 30,46 C 44,38 60,38 70,42 C 80,38 92,40 98,46 C 88,50 76,50 68,48 C 56,52 40,52 30,46 Z" fill="${b.cor}" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>`,
    };
  }
  return { tras: '', bigode: '' };
}

// ---------------------------------------------------------------- cabeças
function cabecaHumana(d, expr) {
  const pele = `url(#${d.id}-pele)`;
  const { tras: barbaTras, bigode } = barba(d, expr);
  const cranio = 'M 0,-106 C 62,-106 100,-62 100,-6 C 100,40 86,80 54,100 C 30,112 -10,112 -40,98 C -80,80 -100,40 -100,-6 C -100,-62 -62,-106 0,-106 Z';
  const temBarbaCheia = d.barba && d.barba.estilo === 'cheia';
  return `
    ${cabeloTras(d)}
    <path d="${cranio}" fill="${pele}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="14" cy="34" rx="18" ry="11" fill="#ff7b7b" opacity="0.25"/>
    ${barbaTras}
    <g>
      <ellipse cx="-58" cy="10" rx="18" ry="26" fill="${pele}" stroke="${CONTORNO}" stroke-width="5"/>
      <path d="M -62,-4 Q -50,10 -60,24" fill="none" stroke="${escurecer(d.pele, 0.35)}" stroke-width="4" stroke-linecap="round"/>
    </g>
    ${cabeloFrente(d)}
    ${d.rugas ? `<path d="M 22,-74 Q 50,-84 82,-70 M 28,-60 Q 52,-68 78,-58" fill="none" stroke="${escurecer(d.pele, 0.3)}" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>` : ''}
    ${olhos(expr, d)}
    ${temBarbaCheia ? boca(expr, d) + bigode + nariz(d) : nariz(d) + bigode + boca(expr, d)}
  `;
}

function cabecaBiscoito(d, expr) {
  const g = `url(#${d.id}-pele)`;
  const gotas = [[-60, -50, 13], [-30, -78, 10], [-72, 18, 12], [-40, 60, 11], [10, 82, 9], [60, -74, 9], [-6, -46, 7]];
  return `
    <mask id="${d.id}-mordida">
      <rect x="-130" y="-130" width="260" height="260" fill="#fff"/>
      <circle cx="-86" cy="-74" r="26" fill="#000"/><circle cx="-62" cy="-96" r="20" fill="#000"/>
    </mask>
    <g mask="url(#${d.id}-mordida)">
      <circle cx="0" cy="0" r="104" fill="${g}" stroke="${CONTORNO}" stroke-width="5"/>
      <circle cx="0" cy="0" r="88" fill="none" stroke="${escurecer(d.pele, 0.15)}" stroke-width="3" stroke-dasharray="4 10" opacity="0.7"/>
      ${gotas.map(([x, y, r]) => `<path d="M ${x - r},${y} C ${x - r},${y - r * 1.2} ${x + r},${y - r * 1.3} ${x + r},${y} C ${x + r},${y + r} ${x - r},${y + r} ${x - r},${y} Z" fill="#4a2a14" stroke="${CONTORNO}" stroke-width="2"/>`).join('')}
    </g>
    <ellipse cx="10" cy="36" rx="18" ry="11" fill="#ff7b7b" opacity="0.3"/>
    <ellipse cx="96" cy="30" rx="14" ry="9" fill="#ff7b7b" opacity="0.3"/>
    ${olhos(expr, d)}
    ${boca(expr, d)}`;
}

function cabecaBolacha(d, expr) {
  const g = `url(#${d.id}-pele)`;
  // borda recortada (bolacha Maria / maisena)
  const pts = [];
  const n = 44;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 102 + (i % 2 === 0 ? 4 : -1);
    pts.push(`${f(Math.cos(a) * r * 1.02)},${f(Math.sin(a) * r * 0.98)}`);
  }
  const furos = [];
  for (let gx = -60; gx <= 60; gx += 40) {
    for (let gy = -60; gy <= 60; gy += 40) {
      if (gx > -20 && gy > -40) continue; // deixa o rosto limpo
      furos.push(`<circle cx="${gx}" cy="${gy}" r="5" fill="${escurecer(d.pele, 0.35)}"/>`);
    }
  }
  return `
    <path d="M ${pts.join(' L ')} Z" fill="${g}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="-74" y="-74" width="148" height="148" rx="20" fill="none" stroke="${escurecer(d.pele, 0.2)}" stroke-width="3" opacity="0.6"/>
    ${furos.join('')}
    <ellipse cx="10" cy="36" rx="18" ry="11" fill="#ff7b7b" opacity="0.3"/>
    <ellipse cx="96" cy="30" rx="14" ry="9" fill="#ff7b7b" opacity="0.3"/>
    ${olhos(expr, d)}
    ${boca(expr, d)}`;
}

function cabeca(d, expr) {
  if (d.cabeca === 'biscoito') return cabecaBiscoito(d, expr);
  if (d.cabeca === 'bolacha') return cabecaBolacha(d, expr);
  return cabecaHumana(d, expr);
}

// ---------------------------------------------------------------- tronco
function tronco(d) {
  const pele = `url(#${d.id}-pele)`;
  const camisa = `url(#${d.id}-camisa)`;
  const gordo = d.corpo === 'gordinho';
  const pescoco = `<path d="M 6,-150 L 14,-182" stroke="${CONTORNO}" stroke-width="58" stroke-linecap="round"/>
                   <path d="M 6,-150 L 14,-182" stroke="${d.pele}" stroke-width="48" stroke-linecap="round"/>`;
  const peito = 'M -78,-150 C -100,-146 -98,-108 -92,-80 L -74,-4 Q 0,12 74,-4 L 90,-80 C 96,-108 100,-146 78,-150 C 40,-160 -40,-160 -78,-150 Z';
  const camisaD = gordo
    ? 'M -76,-130 C -62,-140 -50,-142 -38,-140 Q 2,-102 40,-140 C 52,-142 66,-140 80,-130 C 102,-104 110,-60 96,-26 C 90,-10 82,-2 72,2 Q 0,16 -72,2 L -88,-40 C -92,-70 -90,-104 -76,-130 Z'
    : 'M -76,-130 C -62,-140 -50,-142 -38,-140 Q 2,-102 40,-140 C 52,-142 66,-140 80,-130 C 88,-102 90,-72 88,-42 L 72,2 Q 0,14 -72,2 L -88,-42 C -90,-72 -88,-102 -76,-130 Z';
  let estampa = '';
  const c = d.camisa;
  if (c.padrao === 'listras-h' || c.padrao === 'listras-v') {
    const faixas = [];
    if (c.padrao === 'listras-h') for (let y = -150; y < 20; y += 34) faixas.push(`<rect x="-120" y="${y}" width="240" height="17" fill="${c.cor2}"/>`);
    else for (let x = -112; x < 120; x += 52) faixas.push(`<rect x="${x}" y="-160" width="26" height="190" fill="${c.cor2}"/>`);
    estampa += `<clipPath id="${d.id}-clipcamisa"><path d="${camisaD}"/></clipPath><g clip-path="url(#${d.id}-clipcamisa)">${faixas.join('')}</g>`;
  }
  if (c.emblema === 'estrela') {
    estampa += `<path d="${estrela(10, -74, 30)}" fill="${c.corEmblema || '#ffffff'}" stroke="${CONTORNO}" stroke-width="4.5" stroke-linejoin="round"/>`;
  } else if (c.emblema === 'losango') {
    estampa += `<path d="M 10,-112 L 52,-74 L 10,-36 L -32,-74 Z" fill="${c.corEmblema || '#ffd400'}" stroke="${CONTORNO}" stroke-width="4.5" stroke-linejoin="round"/>
                <circle cx="10" cy="-74" r="17" fill="#1f4fbf" stroke="${CONTORNO}" stroke-width="3.5"/>
                <path d="M -6,-78 Q 10,-84 26,-72" fill="none" stroke="#ffffff" stroke-width="3"/>`;
  } else if (c.emblema === 'biscoito') {
    estampa += `<circle cx="10" cy="-74" r="26" fill="#d8933f" stroke="${CONTORNO}" stroke-width="4"/><circle cx="2" cy="-80" r="5" fill="#4a2a14"/><circle cx="18" cy="-66" r="5" fill="#4a2a14"/><circle cx="20" cy="-84" r="4" fill="#4a2a14"/>`;
  } else if (c.emblema === 'bolacha') {
    estampa += `<rect x="-16" y="-100" width="52" height="52" rx="10" fill="#f2cf7e" stroke="${CONTORNO}" stroke-width="4"/><circle cx="0" cy="-84" r="3.5" fill="#a8823a"/><circle cx="20" cy="-84" r="3.5" fill="#a8823a"/><circle cx="0" cy="-64" r="3.5" fill="#a8823a"/><circle cx="20" cy="-64" r="3.5" fill="#a8823a"/>`;
  } else if (c.emblema === 'numero') {
    estampa += `<text x="10" y="-52" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" text-anchor="middle" fill="${c.corEmblema || '#fff'}" stroke="${CONTORNO}" stroke-width="3">${c.numero || '10'}</text>`;
  }
  const brilho = `<path d="M 50,-124 C 66,-110 72,-84 70,-60" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.22"/>`;
  return `
    ${pescoco}
    <path d="${peito}" fill="${pele}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${camisaD}" fill="${camisa}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    ${estampa}
    <path d="${camisaD}" fill="none" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>
    ${c.acabamento ? `<path d="M -38,-140 Q 2,-102 40,-140" fill="none" stroke="${c.acabamento}" stroke-width="7" stroke-linecap="round"/>` : ''}
    ${brilho}`;
}

// ---------------------------------------------------------------- extras
function extras(lista) {
  let s = '';
  if (lista.includes('suor')) {
    const gota = (x, y, r) => `<path d="M ${x},${y - r * 1.8} C ${x + r},${y - r * 0.4} ${x + r},${y + r} ${x},${y + r} C ${x - r},${y + r} ${x - r},${y - r * 0.4} ${x},${y - r * 1.8} Z" fill="#8fd3ff" stroke="${CONTORNO}" stroke-width="3.5"/>`;
    s += gota(-118, -70, 10) + gota(118, -92, 12) + gota(-104, -112, 7);
  }
  if (lista.includes('estrelas')) {
    s += `<ellipse cx="0" cy="-128" rx="96" ry="22" fill="none" stroke="#fff3a0" stroke-width="3" stroke-dasharray="8 8" opacity="0.8"/>`;
    s += [[-74, -128, 18, -10], [0, -152, 22, 12], [74, -124, 17, 30]]
      .map(([x, y, r, rot]) => `<path d="${estrela(x, y, r, -90 + rot)}" fill="#ffd93b" stroke="${CONTORNO}" stroke-width="4" stroke-linejoin="round"/>`)
      .join('');
  }
  return s;
}

// ---------------------------------------------------------------- montagem
function gradientes(d) {
  const radial = (id, cor, forca = 0.3) => `
    <radialGradient id="${id}" cx="0.62" cy="0.32" r="0.85">
      <stop offset="0" stop-color="${clarear(cor, 0.22)}"/>
      <stop offset="0.5" stop-color="${cor}"/>
      <stop offset="1" stop-color="${escurecer(cor, forca)}"/>
    </radialGradient>`;
  return `<defs>
    ${radial(`${d.id}-pele`, d.pele, 0.28)}
    ${radial(`${d.id}-camisa`, d.camisa.cor, 0.35)}
    ${radial(`${d.id}-luva`, d.luvas, 0.35)}
    ${radial(`${d.id}-cabelo`, d.cabelo ? d.cabelo.cor : '#000', 0.3)}
    ${radial(`${d.id}-barba`, d.barba ? d.barba.cor : '#000', 0.25)}
    <filter id="${d.id}-sombra" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>`;
}

export function desenharBoneco(def, nomePose) {
  const d = { ...def };
  const p = POSES[nomePose];
  if (!p) throw new Error(`Pose desconhecida: ${nomePose}`);
  const quadril = { x: QUADRIL.x, y: QUADRIL.y + p.agachar };

  // pernas (fora da inclinação do tronco)
  const coxa = 116;
  const canela = 118;
  const juntaTras = soma(quadril, { x: -30, y: 12 });
  const juntaFrente = soma(quadril, { x: 34, y: 12 });
  const tornozeloTras = { x: QUADRIL.x + p.peTras.x, y: CHAO - 30 };
  const tornozeloFrente = { x: QUADRIL.x + p.peFrente.x, y: CHAO - 30 };
  const pernaTras = ik(juntaTras, tornozeloTras, coxa, canela, -1);
  const pernaFrente = ik(juntaFrente, tornozeloFrente, coxa, canela, -1);
  const largPerna = 44;

  const short = (junta, joelho, frente) => {
    const fim = { x: junta.x + (joelho.x - junta.x) * 0.62, y: junta.y + (joelho.y - junta.y) * 0.62 };
    const lista = d.short.listra
      ? `<path d="M ${pt(junta)} L ${pt(fim)}" stroke="${d.short.listra}" stroke-width="10" stroke-linecap="round" transform="translate(${frente ? 14 : -14},0)"/>`
      : '';
    return `
      <path d="M ${pt(junta)} L ${pt(fim)}" stroke="${CONTORNO}" stroke-width="84" stroke-linecap="round"/>
      <path d="M ${pt(junta)} L ${pt(fim)}" stroke="${d.short.cor}" stroke-width="74" stroke-linecap="round"/>
      ${lista}`;
  };

  const sapatos = d.sapatos || { cor: '#ffffff', sola: '#d33' };
  const pernas = `
    ${membro(juntaTras, pernaTras.meio, pernaTras.fim, largPerna, escurecer(d.pele, 0.12))}
    ${sapato({ x: pernaTras.fim.x, y: CHAO - 14 }, escurecer(sapatos.cor, 0.12), sapatos.sola, true)}
    ${short(juntaTras, pernaTras.meio, false)}
    ${membro(juntaFrente, pernaFrente.meio, pernaFrente.fim, largPerna, d.pele)}
    ${sapato({ x: pernaFrente.fim.x, y: CHAO - 14 }, sapatos.cor, sapatos.sola)}
    ${short(juntaFrente, pernaFrente.meio, true)}
    <path d="M ${pt(soma(quadril, { x: -80, y: -8 }))} Q ${pt(soma(quadril, { x: 0, y: 8 }))} ${pt(soma(quadril, { x: 82, y: -8 }))}" stroke="${CONTORNO}" stroke-width="34" stroke-linecap="round" fill="none"/>
    <path d="M ${pt(soma(quadril, { x: -80, y: -8 }))} Q ${pt(soma(quadril, { x: 0, y: 8 }))} ${pt(soma(quadril, { x: 82, y: -8 }))}" stroke="${d.short.cos || '#ffffff'}" stroke-width="24" stroke-linecap="round" fill="none"/>`;

  // braços (no referencial do tronco: origem no quadril)
  const ombroTras = { x: -60, y: -128 };
  const ombroFrente = { x: 64, y: -124 };
  const braco = 78;
  const antebraco = 76;
  const bTras = ik(ombroTras, p.maoTras, braco, antebraco, 1);
  const bFrente = ik(ombroFrente, p.maoFrente, braco, antebraco, 1);
  const angulo = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const punho = d.punho || '#ffffff';
  const bracoTras = membro(ombroTras, bTras.meio, bTras.fim, 34, escurecer(d.pele, 0.12)) +
    luva(bTras.fim, angulo(bTras.meio, bTras.fim), escurecer(d.luvas, 0.1), escurecer(punho, 0.1), d.id);
  const bracoFrente = membro(ombroFrente, bFrente.meio, bFrente.fim, 36, d.pele) +
    luva(bFrente.fim, angulo(bFrente.meio, bFrente.fim), d.luvas, punho, d.id);

  const escalaCabeca = d.escalaCabeca || 1.1;
  const centroCabeca = { x: 22, y: -272 };
  const pescoco = { x: 12, y: -170 };
  const cabecaSvg = `
    <g transform="rotate(${p.cabeca} ${pt(pescoco)})">
      <g transform="translate(${pt(centroCabeca)}) scale(${escalaCabeca})">
        ${cabeca(d, p.rosto)}
        ${extras(p.extras || [])}
      </g>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}" viewBox="0 0 ${LARGURA} ${ALTURA}">
  ${gradientes(d)}
  <ellipse cx="${QUADRIL.x + 10}" cy="${CHAO}" rx="170" ry="20" fill="#000" opacity="0.35" filter="url(#${d.id}-sombra)"/>
  ${pernas}
  <g transform="translate(${pt(quadril)}) rotate(${p.inclinacao})">
    ${bracoTras}
    ${tronco(d)}
    ${cabecaSvg}
    ${bracoFrente}
  </g>
</svg>`;
}

export const NOMES_POSES = Object.keys(POSES);
