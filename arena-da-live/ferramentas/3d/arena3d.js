// Cenário 3D: ringue, plateia, telão, luzes.
import * as THREE from 'three';

function textura(w, h, desenhar) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function criarArena(cena, { cor0, cor1, titulo, logo }) {
  const g = new THREE.Group();
  cena.add(g);
  const c0 = new THREE.Color(cor0), c1 = new THREE.Color(cor1);

  // ---------- lona do ringue
  const lona = textura(2048, 1400, (x, w, h) => {
    const gr = x.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.6);
    gr.addColorStop(0, '#141c38');
    gr.addColorStop(1, '#070a18');
    x.fillStyle = gr;
    x.fillRect(0, 0, w, h);
    // metades com a cor dos times
    const g0 = x.createLinearGradient(0, 0, w / 2, 0);
    g0.addColorStop(0, cor0 + '66'); g0.addColorStop(1, cor0 + '00');
    x.fillStyle = g0; x.fillRect(0, 0, w / 2, h);
    const g1 = x.createLinearGradient(w, 0, w / 2, 0);
    g1.addColorStop(0, cor1 + '66'); g1.addColorStop(1, cor1 + '00');
    x.fillStyle = g1; x.fillRect(w / 2, 0, w / 2, h);
    // círculo central e logo
    x.strokeStyle = 'rgba(255,255,255,0.35)';
    x.lineWidth = 14;
    x.beginPath(); x.arc(w / 2, h / 2, 330, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 5;
    x.beginPath(); x.arc(w / 2, h / 2, 360, 0, Math.PI * 2); x.stroke();
    x.font = 'italic 900 150px "Teko", "Arial Black"';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.16)';
    x.fillText(logo, w / 2, h / 2 + 10);
    // bordas
    x.strokeStyle = 'rgba(255,255,255,0.5)';
    x.lineWidth = 18;
    x.strokeRect(30, 30, w - 60, h - 60);
  });
  const L = 7.2, P = 5.2;
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(L, 0.5, P), [
    new THREE.MeshStandardMaterial({ color: '#0a0d1c', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: '#0a0d1c', roughness: 0.6 }),
    new THREE.MeshPhysicalMaterial({ map: lona, roughness: 0.75, sheen: 0.4, sheenColor: new THREE.Color('#8899ff') }),
    new THREE.MeshStandardMaterial({ color: '#0a0d1c' }),
    new THREE.MeshStandardMaterial({ color: '#0a0d1c' }),
    new THREE.MeshStandardMaterial({ color: '#0a0d1c' }),
  ]);
  mesa.position.y = -0.25;
  mesa.receiveShadow = true;
  g.add(mesa);
  // saia do ringue com LED
  const saia = textura(2048, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, cor0); gr.addColorStop(0.45, '#ffffff'); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, cor1);
    x.fillStyle = '#05060d'; x.fillRect(0, 0, w, h);
    x.globalAlpha = 0.6; x.fillStyle = gr; x.fillRect(0, 54, w, 18); x.globalAlpha = 1;
  });
  const ledSaia = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.5), new THREE.MeshBasicMaterial({ map: saia }));
  ledSaia.position.set(0, -0.25, P / 2 + 0.001);
  g.add(ledSaia);

  // ---------- postes e cordas
  const corner = (x, z, cor) => {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 24), new THREE.MeshPhysicalMaterial({ color: '#d9dde8', metalness: 1, roughness: 0.25 }));
    poste.position.set(x, 0.8, z);
    poste.castShadow = true;
    g.add(poste);
    const almofada = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.3, clearcoat: 1, emissive: cor, emissiveIntensity: 0.35 }));
    almofada.position.set(x, 0.85, z);
    g.add(almofada);
  };
  const xs = L / 2 - 0.35, zs = P / 2 - 0.35;
  corner(-xs, -zs, cor0);
  corner(xs, -zs, cor1);
  corner(-xs, zs, cor0);
  corner(xs, zs, cor1);
  const corda = (a, b, cor, emis) => {
    const curva = new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curva, 2, 0.028, 12), new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.25, clearcoat: 1, emissive: cor, emissiveIntensity: emis }));
    m.castShadow = true;
    g.add(m);
  };
  [0.45, 0.85, 1.25].forEach((y, i) => {
    const cor = i === 1 ? '#ffffff' : null;
    corda([-xs, y, -zs], [0, y, -zs], cor ?? cor0, 0.5);
    corda([0, y, -zs], [xs, y, -zs], cor ?? cor1, 0.5);
    corda([-xs, y, -zs], [-xs, y, zs], cor ?? cor0, 0.5);
    corda([xs, y, -zs], [xs, y, zs], cor ?? cor1, 0.5);
  });

  // ---------- plateia (silhuetas + luzes de celular)
  const pessoa = new THREE.CapsuleGeometry(0.17, 0.35, 4, 10);
  const cabeca = new THREE.SphereGeometry(0.13, 12, 10);
  const matP = new THREE.MeshStandardMaterial({ color: '#0d1024', roughness: 0.9 });
  const N = 900;
  const corpos = new THREE.InstancedMesh(pessoa, matP, N);
  const cabecas = new THREE.InstancedMesh(cabeca, matP, N);
  const luzes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.11), new THREE.MeshBasicMaterial({ color: '#ffffff' }), N);
  const m4 = new THREE.Matrix4();
  let n = 0, nl = 0;
  const rnd = mulberry(7);
  for (let fila = 0; fila < 9; fila++) {
    const z = -4.3 - fila * 0.8;
    const y = 0.2 + fila * 0.42;
    const largura = 12 + fila * 1.6;
    for (let x = -largura / 2; x < largura / 2 && n < N; x += 0.48 + rnd() * 0.12) {
      const px = x + rnd() * 0.1, py = y + rnd() * 0.12;
      m4.makeTranslation(px, py + 0.35, z);
      corpos.setMatrixAt(n, m4);
      m4.makeTranslation(px, py + 0.85, z + 0.02);
      cabecas.setMatrixAt(n, m4);
      if (rnd() < 0.18 && nl < N) {
        m4.makeTranslation(px + 0.15, py + 1.05 + rnd() * 0.25, z + 0.25);
        luzes.setMatrixAt(nl, m4);
        luzes.setColorAt(nl, rnd() < 0.5 ? new THREE.Color('#fff6d8').multiplyScalar(2) : (px < 0 ? c0 : c1).clone().multiplyScalar(2.5));
        nl++;
      }
      n++;
    }
  }
  corpos.count = cabecas.count = n;
  luzes.count = nl;
  g.add(corpos, cabecas, luzes);

  // ---------- telão
  const tela = textura(2048, 640, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, cor0); gr.addColorStop(0.5, '#120a2a'); gr.addColorStop(1, cor1);
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < h; i += 6) x.fillRect(0, i, w, 2);
    x.font = 'italic 700 240px "Teko", "Arial Black"';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.shadowColor = '#fff'; x.shadowBlur = 40;
    x.fillText(titulo, w / 2, h / 2 + 30);
  });
  const telao = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), new THREE.MeshBasicMaterial({ map: tela, toneMapped: false, color: new THREE.Color(0.55, 0.55, 0.55) }));
  telao.position.set(0, 5.4, -12);
  g.add(telao);
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(8.3, 2.8, 0.2), new THREE.MeshStandardMaterial({ color: '#05060c', metalness: 0.6, roughness: 0.4 }));
  moldura.position.set(0, 5.4, -12.12);
  g.add(moldura);

  // ---------- feixes de luz (cones aditivos)
  const feixe = (x, z, cor, abertura) => {
    const geo = new THREE.ConeGeometry(abertura, 9, 40, 1, true);
    geo.translate(0, -4.5, 0);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { cor: { value: new THREE.Color(cor) } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 cor; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float borda = pow(abs(dot(vN, vV)), 1.5); float a = smoothstep(-9., 0., vY) * 0.13 * borda; gl_FragColor = vec4(cor*a, a); }',
    }));
    m.position.set(x, 9.5, z);
    m.lookAt(x * 0.25, 0, z * 0.2 + 0.2);
    m.rotateX(-Math.PI / 2);
    g.add(m);
  };
  feixe(-4.5, -2, '#ff6a6a', 1.9);
  feixe(4.5, -2, '#6aff9a', 1.9);
  feixe(0, -3.5, '#cfd8ff', 2.4);
  feixe(-1.8, 1.5, '#ffffff', 1.5);
  feixe(1.8, 1.5, '#ffffff', 1.5);

  criarLuzes(g, cor0, cor1);
  cena.fog = new THREE.FogExp2('#070818', 0.045);
  cena.background = new THREE.Color('#05060f');
  return g;
}

// As mesmas luzes valem para o cenário e para os bonecos renderizados à parte.
export function criarLuzes(g, cor0, cor1) {
  const chave = new THREE.SpotLight('#fff3e2', 110, 30, 0.5, 0.5, 1.6);
  chave.position.set(0.8, 9, 5);
  chave.target.position.set(0, 1, 0);
  chave.castShadow = true;
  chave.shadow.mapSize.set(2048, 2048);
  chave.shadow.bias = -0.0004;
  g.add(chave, chave.target);
  const aro0 = new THREE.SpotLight(cor0, 70, 20, 0.5, 0.6, 1.5);
  aro0.position.set(-5, 5, -4);
  aro0.target.position.set(-0.8, 1.3, 0);
  g.add(aro0, aro0.target);
  const aro1 = new THREE.SpotLight(cor1, 70, 20, 0.5, 0.6, 1.5);
  aro1.position.set(5, 5, -4);
  aro1.target.position.set(0.8, 1.3, 0);
  g.add(aro1, aro1.target);
  const preenche = new THREE.DirectionalLight('#9fb4ff', 0.35);
  preenche.position.set(-3, 2, 6);
  g.add(preenche);
  g.add(new THREE.HemisphereLight('#4a5aa8', '#1a0d10', 0.3));
}

function mulberry(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
