// Mapa do Brasil em hexágonos (um por estado), desenhado em SVG.
/* exported MapaBrasil */

const MapaBrasil = (() => {
  // [UF, coluna, linha] — linhas ímpares ficam deslocadas meio hexágono para a direita
  const GRADE = [
    ['RR', 2, 0], ['AP', 4, 0],
    ['AM', 1, 1], ['PA', 3, 1], ['MA', 4, 1], ['CE', 5, 1], ['RN', 6, 1],
    ['AC', 0, 2], ['RO', 1, 2], ['MT', 2, 2], ['TO', 3, 2], ['PI', 4, 2], ['PE', 5, 2], ['PB', 6, 2],
    ['MS', 2, 3], ['GO', 3, 3], ['BA', 4, 3], ['SE', 5, 3], ['AL', 6, 3],
    ['PR', 2, 4], ['SP', 3, 4], ['DF', 4, 4], ['MG', 5, 4], ['ES', 6, 4],
    ['SC', 2, 5], ['RJ', 5, 5],
    ['RS', 2, 6],
  ];
  const NS = 'http://www.w3.org/2000/svg';

  // Cor clara (ex.: branco do alvinegro) pede texto escuro em cima.
  function corClara(hex) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    if (Number.isNaN(n)) return false;
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return 0.299 * r + 0.587 * g + 0.114 * b > 170;
  }

  function criar(svg, raio = 34) {
    const larg = Math.sqrt(3) * raio;
    const passoY = raio * 1.5;
    const margem = 6;
    const pontos = (cx, cy) => {
      const p = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        p.push(`${(cx + raio * 0.94 * Math.cos(a)).toFixed(1)},${(cy + raio * 0.94 * Math.sin(a)).toFixed(1)}`);
      }
      return p.join(' ');
    };
    const celulas = {};
    let maxX = 0;
    let maxY = 0;
    svg.innerHTML = '';
    for (const [uf, col, lin] of GRADE) {
      const cx = margem + larg / 2 + col * larg + (lin % 2 ? larg / 2 : 0);
      const cy = margem + raio + lin * passoY;
      maxX = Math.max(maxX, cx + larg / 2);
      maxY = Math.max(maxY, cy + raio);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'hex');
      g.dataset.uf = uf;
      const poli = document.createElementNS(NS, 'polygon');
      poli.setAttribute('points', pontos(cx, cy));
      const texto = document.createElementNS(NS, 'text');
      texto.setAttribute('x', cx);
      texto.setAttribute('y', cy + 1);
      texto.setAttribute('text-anchor', 'middle');
      texto.setAttribute('dominant-baseline', 'middle');
      texto.textContent = uf;
      g.append(poli, texto);
      svg.append(g);
      celulas[uf] = { g, poli, cx, cy };
    }
    svg.setAttribute('viewBox', `0 0 ${(maxX + margem).toFixed(0)} ${(maxY + margem).toFixed(0)}`);

    return {
      celulas,
      atualizar(mapa, cores) {
        for (const [uf, c] of Object.entries(celulas)) {
          const dono = mapa?.[uf];
          const cor = dono === 0 || dono === 1 ? cores[dono] : null;
          c.g.classList.toggle('dominado', Boolean(cor));
          c.g.classList.toggle('claro', Boolean(cor) && corClara(cor));
          c.poli.style.fill = cor ?? '';
          c.g.dataset.dono = dono ?? '';
        }
      },
      pulsar(uf) {
        const c = celulas[uf];
        if (!c) return;
        c.g.classList.remove('pulso');
        void c.g.getBoundingClientRect();
        c.g.classList.add('pulso');
      },
    };
  }

  return { criar, GRADE };
})();
