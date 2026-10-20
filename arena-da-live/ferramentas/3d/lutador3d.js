// Lutador 3D estilo videogame de luta, esculpido por SDF (sem modelo externo).
import * as THREE from 'three';
import { sdf, malhar, fbm } from './sdf.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

// decalque (emblema) projetado no tecido, ainda na pose neutra
function colarDecalques(raiz) {
  raiz.updateMatrixWorld(true);
  for (const d of raiz.userData.decalques ?? []) {
    const pos = new THREE.Vector3(...d.pos).applyMatrix4(d.pai.matrixWorld);
    const geo = new DecalGeometry(d.malha, pos, new THREE.Euler(0, 0, 0), new THREE.Vector3(d.tam, d.tam, 0.22));
    geo.applyMatrix4(d.pai.matrixWorld.clone().invert());
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: d.mapa, transparent: true, roughness: 0.35, clearcoat: 0.5, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide }));
    d.pai.add(m);
  }
}

const { esfera, elipse, cone, caixa, cilindro, uniao, menos, inter, inflar, plano, ruido } = sdf;
const PASSO = 0.0065; // resolução da escultura (m)

function mat(cor, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, ...o });
}

function emblema(tipo, cor, fundo) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = cor;
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = 6;
  if (tipo === 'estrela') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 46 : 112;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(128 + r * Math.cos(a), 134 + r * Math.sin(a));
    }
    g.closePath();
    g.fill();
    g.stroke();
  } else if (tipo === 'losango') {
    g.beginPath();
    g.moveTo(128, 30); g.lineTo(236, 128); g.lineTo(128, 226); g.lineTo(20, 128);
    g.closePath();
    g.fillStyle = fundo;
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(128, 128, 52, 0, Math.PI * 2);
    g.fillStyle = cor;
    g.fill();
  } else if (tipo === 'texto') {
    g.font = '900 120px Arial Black, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeText(fundo, 128, 135);
    g.fillText(fundo, 128, 135);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function grupo(pai, pos = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...pos);
  pai.add(g);
  return g;
}

function peca(pai, f, min, max, material, cor, passo = PASSO) {
  const m = new THREE.Mesh(malhar(f, min, max, passo, cor), material);
  m.castShadow = true;
  m.receiveShadow = true;
  pai.add(m);
  return m;
}

const hex = (c) => new THREE.Color(c);
const misturar = (a, b, t) => [a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t];
const suave = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function criarLutador(def) {
  const k = def.porte ?? 1;
  const bar = def.barriga ?? 0;
  const atl = def.atletico ?? 0.5; // definição muscular
  const pele = mat('#ffffff', { vertexColors: true, roughness: 0.5, sheen: 0.25, sheenColor: hex('#ff8f6b'), sheenRoughness: 0.5, clearcoat: 0.1, clearcoatRoughness: 0.5 });
  const corPele = hex(def.pele).convertSRGBToLinear();
  const corPeleCor = (x, y, z) => [corPele.r, corPele.g, corPele.b];
  const camisa = mat(def.camisa, { roughness: 0.55, sheen: 0.8, sheenColor: hex('#ffffff'), sheenRoughness: 0.4 });
  const detalhe = mat(def.detalhe, { roughness: 0.4 });
  const short = mat(def.short, { roughness: 0.28, sheen: 1, sheenColor: hex(def.brilhoShort ?? '#ffffff'), sheenRoughness: 0.2, clearcoat: 0.6 });
  const luva = mat(def.luva, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });
  const punho = mat(def.punho, { roughness: 0.35, clearcoat: 0.6 });
  const faixa = mat('#efeae0', { roughness: 0.95 });
  const bota = mat(def.bota, { roughness: 0.3, clearcoat: 0.8 });
  const sola = mat(def.sola, { roughness: 0.6 });
  const cabelo = mat(def.cabelo.cor, { roughness: 0.75, sheen: 0.3, sheenColor: hex(def.cabelo.cor).lerp(hex('#ffffff'), 0.35), sheenRoughness: 0.5 });
  const barba = mat(def.barba?.cor ?? def.cabelo.cor, { roughness: 0.92, sheen: 0.5, sheenColor: hex('#ffffff') });
  const sobr = mat(def.sobrancelha, { roughness: 0.9 });
  const olhoBranco = mat('#f4f1ec', { roughness: 0.1, clearcoat: 1 });
  const iris = mat(def.olhos ?? '#3b2617', { roughness: 0.1, clearcoat: 1 });
  const pupila = mat('#050505', { roughness: 0.05, clearcoat: 1 });
  const boca = mat('#3a0e0e', { roughness: 0.6 });
  const dentes = mat('#f5f1e6', { roughness: 0.2, clearcoat: 1 });

  const raiz = new THREE.Group();
  const j = {};

  // ================= quadril e pernas
  j.quadril = grupo(raiz, [0, 1.0, 0]);
  const shortQuadril = uniao(0.06,
    elipse([0, -0.01, 0.0 + bar * 0.01], [0.26 * k, 0.17, 0.19 + bar * 0.03]),
    cone([0.13 * k, -0.06, 0], [0.13 * k, -0.18, 0], 0.15 * k, 0.15 * k),
    cone([-0.13 * k, -0.06, 0], [-0.13 * k, -0.18, 0], 0.15 * k, 0.15 * k),
  );
  peca(j.quadril, inter(0.01, shortQuadril, plano([0, 1, 0], 0.13)), [-0.36, -0.3, -0.28], [0.36, 0.16, 0.3], short);
  // cós
  peca(j.quadril, inter(0.004, inflar(shortQuadril, 0.012), inter(0.004, plano([0, -1, 0], -0.08), plano([0, 1, 0], 0.155))), [-0.36, 0.05, -0.28], [0.36, 0.19, 0.3], detalhe, null, 0.005);
  for (const l of [1, -1]) {
    const n = l === 1 ? 'E' : 'D';
    const coxa = (j['coxa' + n] = grupo(j.quadril, [0.13 * l * k, -0.08, 0]));
    // barra do short (acompanha a coxa)
    peca(coxa, inter(0.01, cone([0, 0.05, 0.005], [0, -0.2, 0.01], 0.155 * k, 0.15 * k), plano([0, 1, 0], 0.02)), [-0.2, -0.38, -0.2], [0.2, 0.1, 0.2], short);
    peca(coxa, uniao(0.05,
      cone([0, 0, 0], [0, -0.44, 0.0], 0.115 * k, 0.08 * k),
      elipse([0.01 * l, -0.2, 0.045], [0.085 * k, 0.17, 0.075]),
      elipse([-0.03 * l, -0.28, 0.02], [0.07 * k, 0.11, 0.07]),
    ), [-0.18, -0.52, -0.16], [0.18, -0.12, 0.16], pele, corPeleCor);
    const canela = (j['canela' + n] = grupo(coxa, [0, -0.45, 0]));
    peca(canela, uniao(0.04,
      esfera([0, 0, 0.005], 0.078 * k),
      cone([0, 0, 0], [0, -0.32, 0], 0.075 * k, 0.055 * k),
      elipse([0, -0.13, -0.035], [0.07 * k, 0.12, 0.065]),
    ), [-0.14, -0.34, -0.14], [0.14, 0.09, 0.14], pele, corPeleCor);
    // bota de boxe
    const fBota = uniao(0.05, cilindro([0, -0.34, 0], 0.08 * k, 0.1, 0.03), caixa([0, -0.455, 0.06], [0.06 * k, 0.04, 0.125], 0.04));
    peca(canela, inter(0.005, fBota, plano([0, -1, 0], 0.475)), [-0.13, -0.5, -0.12], [0.13, -0.22, 0.22], bota);
    peca(canela, inter(0.003, inflar(fBota, 0.006), plano([0, -1, 0], 0.255)), [-0.13, -0.27, -0.13], [0.13, -0.22, 0.13], detalhe, null, 0.005);
    peca(canela, caixa([0, -0.485, 0.06], [0.066 * k, 0.014, 0.132], 0.012), [-0.1, -0.51, -0.1], [0.1, -0.46, 0.21], sola, null, 0.005);
  }

  // ================= tronco (pele + regata)
  j.coluna = grupo(j.quadril, [0, 0.1, 0]);
  const tronco = uniao(0.07,
    elipse([0, 0.08, 0.0 + bar * 0.035], [0.235 * k + bar * 0.025, 0.2, 0.165 + bar * 0.07]),
    elipse([0, 0.34, -0.005], [0.29 * k, 0.23, 0.18]),
    elipse([0.105 * k, 0.4, 0.105], [0.125 * k, 0.095, 0.075]),
    elipse([-0.105 * k, 0.4, 0.105], [0.125 * k, 0.095, 0.075]),
    elipse([0.2 * k, 0.3, -0.03], [0.11 * k, 0.17, 0.12]),
    elipse([-0.2 * k, 0.3, -0.03], [0.11 * k, 0.17, 0.12]),
    elipse([0, 0.51, -0.05], [0.21 * k, 0.075, 0.1]), // trapézio
    elipse([0.3 * k, 0.48, -0.02], [0.1 * k, 0.08, 0.1]),
    elipse([-0.3 * k, 0.48, -0.02], [0.1 * k, 0.08, 0.1]),
    cone([0, 0.5, -0.02], [0, 0.66, 0.0], 0.085, 0.078), // pescoço
  );
  peca(j.coluna, tronco, [-0.42, -0.16, -0.26], [0.42, 0.7, 0.32], pele, corPeleCor);
  // regata: o tronco inflado, com alças, gola e cavas
  const regata = menos(0.025,
    inter(0.02, inflar(tronco, 0.012), inter(0.01, plano([0, 1, 0], 0.6), plano([0, -1, 0], 0.1))),
    uniao(0.02,
      elipse([0, 0.6, 0.12], [0.12, 0.15, 0.13]), // decote
      elipse([0, 0.63, -0.1], [0.11, 0.09, 0.1]), // costas
      cone([0, 0.5, -0.02], [0, 0.75, 0.0], 0.1, 0.1), // pescoço
      elipse([0.33 * k, 0.43, -0.02], [0.11, 0.2, 0.18]), // cavas
      elipse([-0.33 * k, 0.43, -0.02], [0.11, 0.2, 0.18]),
    ),
  );
  let corRegata = null;
  if (def.listras) {
    const c1 = hex(def.camisa).convertSRGBToLinear(), c2 = hex(def.listras.cor).convertSRGBToLinear();
    const largura = def.listras.largura ?? 0.07;
    corRegata = (x, y) => {
      const v = def.listras.padrao === 'v' ? x : y;
      const f = Math.floor(v / largura + 1000);
      const c = f % 2 ? c2 : c1;
      return [c.r, c.g, c.b];
    };
    camisa.color.set('#ffffff');
    camisa.vertexColors = true;
  }
  const malhaRegata = peca(j.coluna, regata, [-0.42, -0.16, -0.26], [0.42, 0.66, 0.34], camisa, corRegata, def.listras ? 0.0045 : PASSO);
  // debrum (acabamento) da gola e das cavas
  peca(j.coluna, inter(0.003, inflar(regata, 0.004), uniao(0.01,
    inter(0, elipse([0, 0.6, 0.12], [0.135, 0.165, 0.145]), plano([0, 0, -1], 0.0)),
    elipse([0.33 * k, 0.43, -0.02], [0.125, 0.215, 0.195]),
    elipse([-0.33 * k, 0.43, -0.02], [0.125, 0.215, 0.195]),
  )), [-0.42, 0.15, -0.26], [0.42, 0.66, 0.34], detalhe, null, 0.0045);
  raiz.userData.decalques = def.emblema === 'nenhum' ? [] : [{ malha: malhaRegata, pai: j.coluna, pos: [0, 0.32, 0.19 + bar * 0.06], tam: 0.19, mapa: emblema(def.emblema, def.corEmblema, def.fundoEmblema) }];

  // ================= cabeça (origem no alto do pescoço)
  j.cabeca = grupo(j.coluna, [0, 0.64, 0.0]);
  const h = j.cabeca;
  const n = def.nariz ?? 1;
  const q = def.queixo ?? 1;
  const olhoY = 0.122, olhoX = 0.049;
  const cabeca = menos(0.012,
    uniao(0.035,
      elipse([0, 0.135, -0.005], [0.13, 0.15, 0.148]),
      elipse([0, 0.04, 0.03], [0.118 * q, 0.092, 0.112]),
      elipse([0, -0.012, 0.088], [0.052 * q, 0.04, 0.042]),
      elipse([0.068, 0.092, 0.092], [0.05, 0.036, 0.04]),
      elipse([-0.068, 0.092, 0.092], [0.05, 0.036, 0.04]),
      elipse([0, 0.158, 0.112], [0.105, 0.03, 0.04]),
      cone([0, 0.145, 0.138], [0, 0.088, 0.152 + 0.008 * n], 0.015 * n, 0.02 * n),
      elipse([0, 0.08, 0.155 + 0.008 * n], [0.026 * n, 0.024 * n, 0.022 * n]),
      elipse([0.02 * n, 0.077, 0.143], [0.017 * n, 0.014, 0.015]),
      elipse([-0.02 * n, 0.077, 0.143], [0.017 * n, 0.014, 0.015]),
      elipse([0.132, 0.112, -0.005], [0.02, 0.048, 0.034]),
      elipse([-0.132, 0.112, -0.005], [0.02, 0.048, 0.034]),
      elipse([0, 0.05, 0.128], [0.042, 0.014, 0.022]), // lábio de cima
      elipse([0, 0.03, 0.124], [0.038, 0.016, 0.022]), // lábio de baixo
      cone([0, -0.06, -0.025], [0, 0.06, -0.01], 0.076, 0.076),
    ),
    uniao(0.01, esfera([olhoX, olhoY, 0.128], 0.03), esfera([-olhoX, olhoY, 0.128], 0.03), caixa([0, 0.04, 0.15], [0.034, 0.0035, 0.03], 0.003)),
  );
  const corLabio = hex('#b8605a').convertSRGBToLinear();
  const corBarbaRala = hex(def.barba?.cor ?? '#333').convertSRGBToLinear();
  const corCabeca = (x, y, z) => {
    let c = [corPele.r, corPele.g, corPele.b];
    const labio = Math.exp(-((x / 0.045) ** 2 + ((y - 0.04) / 0.022) ** 2)) * suave(0.1, 0.13, z);
    c = misturar({ r: c[0], g: c[1], b: c[2] }, corLabio, labio * 0.6);
    const bochecha = Math.exp(-(((Math.abs(x) - 0.07) / 0.035) ** 2 + ((y - 0.08) / 0.03) ** 2));
    c = misturar({ r: c[0], g: c[1], b: c[2] }, { r: c[0] * 1.05, g: c[1] * 0.82, b: c[2] * 0.8 }, bochecha * 0.4);
    if (def.barba?.estilo === 'sombra') {
      const rala = suave(0.1, 0.06, y) * suave(-0.04, 0.02, z) * (1 - labio);
      c = misturar({ r: c[0], g: c[1], b: c[2] }, corBarbaRala, rala * 0.32);
    }
    return c;
  };
  peca(h, cabeca, [-0.17, -0.08, -0.17], [0.17, 0.3, 0.21], pele, corCabeca, 0.0042);
  // olhos
  for (const l of [1, -1]) {
    const o = grupo(h, [l * olhoX, olhoY, 0.112]);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.027, 32, 24), olhoBranco);
    o.add(bola);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0158, 24, 16), iris);
    ir.position.set(-l * 0.003, 0, 0.0185);
    ir.scale.set(1, 1, 0.45);
    o.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 16, 12), pupila);
    pu.position.set(-l * 0.003, 0, 0.025);
    pu.scale.set(1, 1, 0.4);
    o.add(pu);
  }
  // pálpebras pesadas + sobrancelhas franzidas
  const palpebra = (l) => inter(0.004, elipse([l * olhoX, olhoY + 0.006, 0.122], [0.036, 0.024, 0.03]), plano([0, -1, 0], -(olhoY + 0.003)));
  peca(h, uniao(0.002, palpebra(1), palpebra(-1)), [-0.1, 0.09, 0.08], [0.1, 0.16, 0.17], pele, corPeleCor, 0.003);
  const grossa = def.sobrancelhaGrossa ? 1.45 : 1;
  const sob = (l) => ruido(cone([l * 0.02, olhoY + 0.03, 0.15], [l * 0.085, olhoY + 0.05, 0.128], 0.011 * grossa, 0.008 * grossa), 0.003, 160);
  peca(h, uniao(0.002, sob(1), sob(-1)), [-0.11, 0.12, 0.09], [0.11, 0.2, 0.18], sobr, null, 0.0028);
  // dentes cerrados
  peca(h, caixa([0, 0.04, 0.137], [0.03, 0.006, 0.012], 0.004), [-0.05, 0.02, 0.11], [0.05, 0.06, 0.16], dentes, null, 0.002);
  peca(h, caixa([0, 0.04, 0.132], [0.034, 0.01, 0.012], 0.004), [-0.05, 0.02, 0.1], [0.05, 0.06, 0.16], boca, null, 0.0025);
  // rugas
  if (def.rugas) {
    const corRuga = mat(hex(def.pele).multiplyScalar(0.72), { roughness: 0.7 });
    const ruga = (y) => cone([-0.05, y, 0.142], [0.05, y + 0.002, 0.142], 0.0032, 0.0032);
    peca(h, inter(0.002, uniao(0.002, ruga(0.2), ruga(0.215), ruga(0.23)), inflar(cabeca, 0.003)), [-0.07, 0.18, 0.1], [0.07, 0.25, 0.17], corRuga, null, 0.0025);
  }
  // cabelo
  const cranio = elipse([0, 0.135, -0.005], [0.13, 0.15, 0.148]);
  if (def.cabelo.estilo === 'grisalho-calvo') {
    const f = inter(0.02,
      inter(0.02, ruido(inflar(cranio, 0.01), 0.005, 55), plano([0, 1, 0], 0.185)),
      uniao(0.02, plano([0, 0, 1], 0.02), plano([-1, 0, 0], -0.09), plano([1, 0, 0], -0.09)),
    );
    peca(h, inter(0.01, f, plano([0, -1, 0], -0.06)), [-0.18, 0.04, -0.19], [0.18, 0.24, 0.16], cabelo, null, 0.004);
  } else if (def.cabelo.estilo === 'social') {
    const volume = uniao(0.04, inflar(cranio, 0.016), elipse([0.02, 0.255, 0.04], [0.11, 0.06, 0.1]));
    const f = menos(0.006,
      inter(0.025, ruido(volume, 0.004, 70), uniao(0.03, plano([0, -1, 0], -0.215), inter(0.03, plano([0, -1, 0], -0.1), plano([0, 0, 1], 0.07)))),
      inter(0, caixa([-0.045, 0.27, 0.04], [0.004, 0.03, 0.09], 0.003), plano([0, -1, 0], -0.2)), // risca
    );
    peca(h, inter(0.02, f, menos(0, plano([0, -1, 0], -0.05), elipse([0, 0.12, 0.17], [0.15, 0.065, 0.1]))), [-0.18, 0.04, -0.19], [0.18, 0.33, 0.2], cabelo, null, 0.004);
  }
  if (def.cabelo.estilo === 'curto') {
    // cabelo baixinho, colado na cabeça
    const f = inter(0.02, ruido(inflar(cranio, 0.009), 0.003, 90), uniao(0.03, plano([0, -1, 0], -0.2), inter(0.03, plano([0, -1, 0], -0.09), plano([0, 0, 1], 0.06))));
    peca(h, inter(0.02, f, menos(0, plano([0, -1, 0], -0.05), elipse([0, 0.12, 0.17], [0.15, 0.065, 0.1]))), [-0.18, 0.04, -0.19], [0.18, 0.31, 0.2], cabelo, null, 0.0035);
  }
  // barba
  if (def.barba?.estilo === 'cheia') {
    const mandibula = uniao(0.035, elipse([0, 0.04, 0.03], [0.118 * q, 0.092, 0.112]), elipse([0, -0.012, 0.088], [0.052 * q, 0.04, 0.042]));
    const f = menos(0.012,
      inter(0.02, ruido(inflar(mandibula, 0.02), 0.008, 48), uniao(0.02, plano([0, 1, 0], 0.09), inter(0.02, plano([0, 1, 0], 0.15), plano([0, 0, -1], -0.03)))),
      elipse([0, 0.04, 0.15], [0.045, 0.025, 0.05]),
    );
    const bigode = ruido(uniao(0.02,
      cone([0.004, 0.064, 0.152], [0.05, 0.05, 0.13], 0.016, 0.011),
      cone([-0.004, 0.064, 0.152], [-0.05, 0.05, 0.13], 0.016, 0.011),
    ), 0.003, 90);
    peca(h, uniao(0.01, inter(0.01, f, plano([0, 0, -1], 0.05)), bigode), [-0.17, -0.09, -0.09], [0.17, 0.2, 0.2], barba, null, 0.0038);
  }

  // ================= braços
  for (const l of [1, -1]) {
    const nn = l === 1 ? 'E' : 'D';
    const ombro = (j['ombro' + nn] = grupo(j.coluna, [0.35 * l * k, 0.47, -0.02]));
    peca(ombro, uniao(0.045,
      elipse([0, -0.01, 0], [0.105 * k, 0.1, 0.11]),
      cone([0, -0.03, 0], [0, -0.3, 0], 0.085 * k, 0.065 * k),
      elipse([0, -0.15, 0.04], [0.07 * k, 0.1 + atl * 0.01, 0.065 + atl * 0.01]),
      elipse([0, -0.14, -0.035], [0.07 * k, 0.11, 0.06]),
    ), [-0.16, -0.36, -0.16], [0.16, 0.12, 0.16], pele, corPeleCor);
    const cot = (j['cotovelo' + nn] = grupo(ombro, [0, -0.31, 0]));
    peca(cot, uniao(0.04,
      esfera([0, 0, 0], 0.066 * k),
      cone([0, 0, 0], [0, -0.25, 0], 0.068 * k, 0.05 * k),
      elipse([0, -0.07, 0.008], [0.07 * k, 0.1, 0.063]),
    ), [-0.12, -0.3, -0.12], [0.12, 0.08, 0.12], pele, corPeleCor);
    peca(cot, ruido(cilindro([0, -0.235, 0], 0.058 * k, 0.04, 0.012), 0.0015, 300), [-0.09, -0.3, -0.09], [0.09, -0.17, 0.09], faixa, null, 0.004);
    const luv = (j['luva' + nn] = grupo(cot, [0, -0.3, 0]));
    const fLuva = uniao(0.035,
      cilindro([0, 0.035, 0], 0.074 * k, 0.055, 0.02),
      elipse([0, -0.08, 0.015], [0.098 * k, 0.11, 0.112]),
      elipse([0, -0.13, 0.06], [0.085 * k, 0.07, 0.07]),
      cone([-0.06 * l * k, -0.03, 0.06], [-0.045 * l * k, -0.1, 0.095], 0.034, 0.03),
    );
    peca(luv, inter(0.006, fLuva, plano([0, 1, 0], 0.05)), [-0.15, -0.23, -0.15], [0.15, 0.1, 0.19], luva, null, 0.005);
    peca(luv, inter(0.004, inflar(fLuva, 0.004), plano([0, -1, 0], -0.045)), [-0.12, 0.03, -0.12], [0.12, 0.1, 0.12], punho, null, 0.0045);
  }
  raiz.userData.juntas = j;
  colarDecalques(raiz);
  return raiz;
}

// poses (radianos). Frente do boneco = +Z.
// Poses (radianos). Frente do boneco = +Z. Escritas para o lutador da DIREITA (braço esquerdo do lado
// da câmera); o da esquerda usa a mesma pose espelhada.
export const POSES = {
  parado: {
    quadril: [0, -0.32, 0], coluna: [0.16, -0.12, 0], cabeca: [0.1, 0.38, 0],
    ombroE: [-0.75, 0.35, 0.55], cotoveloE: [-2.15, 0, 0], luvaE: [0.35, 0, 0],
    ombroD: [-0.55, -0.35, -0.5], cotoveloD: [-2.3, 0, 0], luvaD: [0.35, 0, 0],
    coxaE: [-0.3, 0, 0.1], canelaE: [0.3, 0, 0], coxaD: [0.32, 0, -0.08], canelaD: [0.22, 0, 0],
    altura: -0.03,
  },
  // direto com o braço da frente
  soco: {
    quadril: [0, -0.45, 0], coluna: [0.2, -0.4, 0], cabeca: [0.08, 0.75, 0],
    ombroE: [-1.62, 0.05, 0.1], cotoveloE: [-0.08, 0, 0], luvaE: [0.05, 0, 0],
    ombroD: [-0.55, -0.35, -0.5], cotoveloD: [-2.3, 0, 0], luvaD: [0.35, 0, 0],
    coxaE: [-0.55, 0, 0.12], canelaE: [0.45, 0, 0], coxaD: [0.45, 0, -0.1], canelaD: [0.2, 0, 0],
    altura: -0.07,
  },
  // gancho de cima pra baixo, corpo todo no golpe
  especial: {
    quadril: [0, -0.5, 0], coluna: [-0.12, -0.45, 0.05], cabeca: [-0.1, 0.8, 0],
    ombroE: [-1.25, 0.1, 0.12], cotoveloE: [-2.0, 0, 0], luvaE: [0.2, 0, 0],
    ombroD: [-0.55, -0.35, -0.5], cotoveloD: [-2.3, 0, 0], luvaD: [0.35, 0, 0],
    coxaE: [-0.6, 0, 0.15], canelaE: [0.75, 0, 0], coxaD: [0.55, 0, -0.12], canelaD: [0.45, 0, 0],
    altura: -0.13,
  },
  apanhando: {
    quadril: [0, -0.25, 0], coluna: [-0.32, -0.05, 0.1], cabeca: [-0.45, 0.2, 0.3],
    ombroE: [-0.55, 0.3, 0.9], cotoveloE: [-1.6, 0, 0], luvaE: [0.2, 0, 0],
    ombroD: [-0.3, -0.3, -0.9], cotoveloD: [-1.3, 0, 0], luvaD: [0.2, 0, 0],
    coxaE: [-0.2, 0, 0.12], canelaE: [0.2, 0, 0], coxaD: [0.45, 0, -0.1], canelaD: [0.35, 0, 0],
    altura: -0.04,
  },
  // grogue (a tela tomba o boneco no nocaute)
  nocaute: {
    quadril: [0, -0.25, 0], coluna: [-0.2, -0.05, 0.15], cabeca: [-0.5, 0.3, 0.45],
    ombroE: [0.15, 0, 0.3], cotoveloE: [-0.3, 0, 0], luvaE: [0, 0, 0],
    ombroD: [0.1, 0, -0.35], cotoveloD: [-0.25, 0, 0], luvaD: [0, 0, 0],
    coxaE: [-0.3, 0, 0.18], canelaE: [0.55, 0, 0], coxaD: [0.2, 0, -0.15], canelaD: [0.5, 0, 0],
    altura: -0.1,
  },
  // braços pro alto, virado pra plateia
  vitoria: {
    quadril: [0, 0.85, 0], coluna: [-0.05, 0.1, 0], cabeca: [-0.2, 0.05, 0],
    ombroE: [-2.85, 0, 0.45], cotoveloE: [-0.35, 0, 0], luvaE: [0, 0, 0],
    ombroD: [-2.85, 0, -0.45], cotoveloD: [-0.35, 0, 0], luvaD: [0, 0, 0],
    coxaE: [-0.05, 0, 0.14], canelaE: [0.05, 0, 0], coxaD: [0.05, 0, -0.14], canelaD: [0.05, 0, 0],
    altura: 0,
  },
};
POSES.guarda = POSES.parado;

// espelhar: troca esquerda/direita (para o braço que soca ficar do lado da câmera)
export function aplicarPose(lutador, pose, espelhar = false) {
  const j = lutador.userData.juntas;
  for (const [nome, rot] of Object.entries(pose)) {
    if (!Array.isArray(rot)) continue;
    let alvo = nome;
    let [x, y, z] = rot;
    if (espelhar) {
      if (/E$/.test(nome)) alvo = nome.replace(/E$/, 'D');
      else if (/D$/.test(nome)) alvo = nome.replace(/D$/, 'E');
      y = -y;
      z = -z;
    }
    if (j[alvo]) j[alvo].rotation.set(x, y, z);
  }
  j.quadril.position.y = 1.0 + (pose.altura ?? 0);
}
