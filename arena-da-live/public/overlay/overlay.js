/* global io, MapaBrasil, Sons */
// Tela da luta (vai no OBS / TikTok LIVE Studio como "Navegador", 1080 x 1920).
// Parâmetros opcionais na URL: ?mudo=1 (sem som)  ?fundo=0 (fundo transparente)
//   ?previa=1 (prévia do painel: começa muda e o painel liga/desliga o som)

(() => {
  const params = new URLSearchParams(location.search);
  const PREVIA = params.get('previa') === '1';
  // ?celular=1: tela aberta no navegador do celular (live pelo celular com transmissão de tela)
  const CELULAR = params.get('celular') === '1';
  if (CELULAR) document.body.classList.add('celular');
  let MUDO = params.get('mudo') === '1' || PREVIA;
  if (params.get('fundo') === '0') document.body.classList.add('transparente');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const palco = $('#palco');
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- escala do palco
  // clientWidth/clientHeight: no celular, innerWidth "cresce" para caber o palco de 1080px
  function ajustarEscala() {
    const w = document.documentElement.clientWidth || innerWidth;
    const h = document.documentElement.clientHeight || innerHeight;
    const s = Math.min(w / 1080, h / 1920);
    palco.style.transform = `scale(${s})`;
    palco.style.left = `${Math.max(0, (w - 1080 * s) / 2)}px`;
    palco.style.top = `${Math.max(0, (h - 1920 * s) / 2)}px`;
  }
  addEventListener('resize', ajustarEscala);
  addEventListener('orientationchange', () => setTimeout(ajustarEscala, 300));
  document.addEventListener('fullscreenchange', ajustarEscala);
  ajustarEscala();

  // ---------------------------------------------------------------- cores
  function hexRgb(h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function misturar(a, b, t) {
    const A = hexRgb(a);
    const B = hexRgb(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  }

  // ---------------------------------------------------------------- plateia de fundo
  (function montarPlateia() {
    const p = $('#plateia');
    for (let i = 0; i < 46; i++) {
      const d = document.createElement('div');
      d.className = 'cabeca';
      const w = 40 + Math.random() * 34;
      d.style.width = `${w}px`;
      d.style.height = `${w * (1.3 + Math.random() * 0.8)}px`;
      d.style.left = `${(i / 46) * 1100 - 20 + Math.random() * 14}px`;
      d.style.bottom = `${Math.random() * 40}px`;
      p.append(d);
    }
    for (let i = 0; i < 14; i++) {
      const f = document.createElement('div');
      f.className = 'flash';
      f.style.left = `${Math.random() * 1060}px`;
      f.style.top = `${40 + Math.random() * 150}px`;
      f.style.animationDelay = `${-Math.random() * 3.2}s`;
      f.style.animationDuration = `${2.4 + Math.random() * 3}s`;
      p.append(f);
    }
  })();

  // ---------------------------------------------------------------- lutadores
  function silhueta(cor) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760"><g fill="${cor}" stroke="#000" stroke-width="6"><circle cx="310" cy="220" r="100"/><rect x="215" y="320" width="170" height="190" rx="40"/><rect x="230" y="500" width="60" height="220" rx="28"/><rect x="320" y="500" width="60" height="220" rx="28"/><circle cx="430" cy="350" r="45"/></g></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function criarLutador(lado) {
    const el = $(`.lutador[data-lado="${lado}"]`);
    const corpo = $('.lutador-corpo', el);
    const img = $('.lutador-img', el);
    return {
      lado,
      el,
      corpo,
      img,
      imagens: {},
      travado: null,
      timer: null,
      definir(base, imagens, escala, cor) {
        this.imagens = {};
        for (const [pose, rel] of Object.entries(imagens || {})) {
          const url = /^(https?:|data:)/.test(rel) ? rel : base + rel;
          this.imagens[pose] = url;
          const pre = new Image();
          pre.src = url;
        }
        if (!this.imagens.parado) this.imagens.parado = silhueta(cor);
        img.style.setProperty('--escala', escala || 1);
        this.destravar();
      },
      pose(p) {
        const src = this.imagens[p] || this.imagens.parado;
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      },
      travar(p) {
        this.travado = p;
        clearTimeout(this.timer);
        el.classList.add('travado');
        el.classList.toggle('vitoria', p === 'vitoria');
        this.pose(p);
      },
      destravar() {
        this.travado = null;
        el.classList.remove('travado', 'vitoria', 'falando', 'caido');
        corpo.getAnimations().forEach((a) => a.cancel());
        this.pose('parado');
      },
      voltarEm(ms) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          if (!this.travado) this.pose('parado');
        }, ms);
      },
    };
  }
  const lutadores = [criarLutador(0), criarLutador(1)];
  const dirDe = (lado) => (lado === 0 ? 1 : -1);
  // posição aproximada da cabeça de cada lutador dentro da arena
  const CABECA = [{ x: 280, y: 268 }, { x: 800, y: 268 }];

  // ---------------------------------------------------------------- efeitos (partículas)
  const canvas = $('#efeitos');
  const ctx2d = canvas.getContext('2d');
  const particulas = [];
  let animando = false;

  function loopEfeitos() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= p.decai;
      if (p.vida <= 0) {
        particulas.splice(i, 1);
        continue;
      }
      ctx2d.globalAlpha = Math.max(0, Math.min(1, p.vida));
      if (p.tipo === 'faisca') {
        ctx2d.strokeStyle = p.cor;
        ctx2d.lineWidth = p.larg;
        ctx2d.lineCap = 'round';
        ctx2d.beginPath();
        ctx2d.moveTo(p.x, p.y);
        ctx2d.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx2d.stroke();
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.88;
        p.vy = p.vy * 0.88 + 0.35;
      } else if (p.tipo === 'anel') {
        ctx2d.strokeStyle = p.cor;
        ctx2d.lineWidth = 8 * p.vida;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.stroke();
        p.r += p.vr;
        p.vr *= 0.9;
      } else if (p.tipo === 'clarao') {
        const g = ctx2d.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.4, p.cor);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx2d.fillStyle = g;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fill();
        p.r *= 1.06;
      } else if (p.tipo === 'confete') {
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.rot);
        ctx2d.fillStyle = p.cor;
        ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx2d.restore();
        p.x += p.vx + Math.sin(p.fase) * 1.5;
        p.y += p.vy;
        p.vy = Math.min(p.vy + 0.12, 7);
        p.rot += p.vr;
        p.fase += 0.08;
      }
    }
    ctx2d.globalAlpha = 1;
    if (particulas.length) requestAnimationFrame(loopEfeitos);
    else animando = false;
  }
  function rodarEfeitos() {
    if (!animando) {
      animando = true;
      requestAnimationFrame(loopEfeitos);
    }
  }
  const efeitos = {
    impacto(x, y, cor, forca) {
      const n = 12 + forca * 14;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (5 + Math.random() * 9) * (1 + forca * 0.5);
        particulas.push({ tipo: 'faisca', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, decai: 0.035 + Math.random() * 0.03, cor: Math.random() < 0.5 ? '#fff6b0' : cor, larg: 3 + Math.random() * 4 });
      }
      particulas.push({ tipo: 'anel', x, y, r: 12, vr: 12 + forca * 7, vida: 1, decai: 0.07, cor: '#ffffff' });
      if (forca >= 2) particulas.push({ tipo: 'clarao', x, y, r: 60 + forca * 30, vida: 1, decai: 0.08, cor: cor });
      rodarEfeitos();
    },
    confete(cores) {
      for (let i = 0; i < 140; i++) {
        particulas.push({
          tipo: 'confete', x: Math.random() * 1080, y: -20 - Math.random() * 300, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
          w: 10 + Math.random() * 10, h: 6 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
          fase: Math.random() * 6, vida: 2.6, decai: 0.008, cor: cores[i % cores.length],
        });
      }
      rodarEfeitos();
    },
  };

  function tremer(forte) {
    const arena = $('#arena');
    arena.classList.remove('tremer', 'tremer-forte');
    void arena.offsetWidth;
    arena.classList.add(forte ? 'tremer-forte' : 'tremer');
  }

  function numeroDano(lado, valor, cor, grande, legenda) {
    const n = document.createElement('div');
    n.className = `numero${grande ? ' grande' : ''}`;
    n.style.left = `${CABECA[lado].x + (Math.random() - 0.5) * 80}px`;
    n.style.top = `${CABECA[lado].y - 110 + (Math.random() - 0.5) * 40}px`;
    n.style.color = cor;
    n.innerHTML = `-${esc(valor)}${legenda ? `<small>${esc(legenda)}</small>` : ''}`;
    $('#numeros').append(n);
    setTimeout(() => n.remove(), 1200);
  }

  function anunciar(titulo, sub = '', fixo = false) {
    const a = $('#anuncio');
    $('.anuncio-titulo', a).textContent = titulo;
    $('.anuncio-sub', a).textContent = sub;
    a.classList.remove('ativo', 'fixo');
    void a.offsetWidth;
    a.classList.add(fixo ? 'fixo' : 'ativo');
  }

  // ---------------------------------------------------------------- tema e configuração
  let tema = null;
  let cfg = { tela: {}, som: {}, voz: {}, regras: {} };
  let estado = null;
  let icones = [[], []];
  const mapa = MapaBrasil.criar($('#mapa'), 34);

  function desenharPresentes() {
    if (!tema) return;
    tema.lados.forEach((l, i) => {
      const caixa = $(`.cartao[data-lado="${i}"] .cartao-presentes`);
      caixa.innerHTML = l.presentes
        .map((p, j) => {
          const img = icones[i]?.[j] || p.imagem;
          const icone = img ? `<img src="${esc(img)}" alt="">` : `<span class="emoji">${esc(p.emoji)}</span>`;
          return `<span class="chip">${icone}${esc(p.rotulo)} = ${esc(l.nome)}</span>`;
        })
        .join('');
    });
  }

  function aplicarTema(t, c) {
    tema = t;
    cfg = c || cfg;
    const raiz = document.documentElement.style;
    t.lados.forEach((l, i) => {
      raiz.setProperty(`--cor${i}`, l.cor);
      raiz.setProperty(`--texto${i}`, l.corTexto);
      raiz.setProperty(`--cor${i}-claro`, misturar(l.cor, '#ffffff', 0.42));
      raiz.setProperty(`--cor${i}-escuro`, misturar(l.cor, '#000000', 0.48));
      $(`.cartao[data-lado="${i}"] .cartao-nome`).textContent = l.nome;
      lutadores[i].definir(t.base, l.personagem?.imagens, l.personagem?.escala, l.cor);
    });
    raiz.setProperty('--fundo1', t.cores.fundo1);
    raiz.setProperty('--fundo2', t.cores.fundo2);
    raiz.setProperty('--destaque', t.cores.destaque);
    $('#titulo').textContent = t.titulo;
    $('#subtitulo').textContent = t.subtitulo;
    $('#lona-texto').textContent = t.titulo;
    $('#aviso-texto').textContent = t.aviso;
    $('#aviso-ia').textContent = t.avisoIA || '';
    icones = [[], []];
    desenharPresentes();
    aplicarConfig(cfg);
    falas.limpar();
    filaGolpes.length = 0;
    filaTicker.length = 0;
    document.title = `${t.titulo} — Arena da Live`;
  }

  // Vídeo em loop dentro da moldura da câmera
  function aplicarVideo(c) {
    const caixa = $('#camera');
    const video = $('#camera-video');
    const url = c.videoUrl || null;
    caixa.classList.toggle('com-video', Boolean(url));
    caixa.classList.toggle('caber', c.tela?.video?.ajuste === 'caber');
    video.muted = MUDO || !c.tela?.video?.som;
    if (!url) {
      if (video.getAttribute('src')) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      return;
    }
    if (video.getAttribute('src') !== url) video.setAttribute('src', url);
    if (video.paused) video.play().catch(() => {});
  }

  function aplicarConfig(c) {
    cfg = c;
    aplicarVideo(c);
    document.body.classList.toggle('sem-mapa', !(tema?.mapa && cfg.tela?.mostrarMapa !== false));
    document.body.classList.toggle('sem-camera', cfg.tela?.mostrarCamera === false);
    document.body.classList.toggle('sem-aviso', cfg.tela?.mostrarAviso === false);
    Sons.volume(Number(cfg.som?.volume ?? 0.6));
    Sons.ligar(!MUDO && cfg.som?.efeitos !== false);
  }

  // ---------------------------------------------------------------- estado (placar, vida, mapa)
  function formatarTempo(ms) {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  const pontosAnteriores = [0, 0];
  function atualizarEstado(e) {
    estado = e;
    if (!tema) return;
    $('#round').textContent = `ROUND ${e.round}`;
    const tempo = $('#tempo');
    tempo.textContent = formatarTempo(e.restanteMs);
    tempo.classList.toggle('urgente', e.fase === 'lutando' && e.restanteMs <= 10_000);
    $('#placar .p0').textContent = e.lados[0].rounds;
    $('#placar .p1').textContent = e.lados[1].rounds;
    const fases = {
      aguardando: 'Mande um presente para começar!',
      pausado: '⏸ PAUSADO',
      intervalo: `Próximo round em ${Math.ceil(e.intervaloMs / 1000)}s`,
      lutando: '',
    };
    $('#fase').textContent = fases[e.fase] ?? '';

    const somaRound = e.lados[0].pontosRound + e.lados[1].pontosRound;
    e.lados.forEach((l, i) => {
      const cartao = $(`.cartao[data-lado="${i}"]`);
      $('.cartao-pontos .num', cartao).textContent = l.pontosRound;
      if (l.pontosRound > pontosAnteriores[i]) {
        cartao.classList.remove('pulso');
        void cartao.offsetWidth;
        cartao.classList.add('pulso');
      }
      pontosAnteriores[i] = l.pontosRound;
      $('.cartao-dica', cartao).innerHTML = `Comente <b>${esc(tema.lados[i].dicaChat)}</b> • 👥 ${l.membros}`;
      $('.cartao-top', cartao).textContent = l.top?.length
        ? `🏆 ${l.top.map((d) => `${d.nome} ${d.pontos}`).join(' · ')}`
        : '🏆 Seja o primeiro a apoiar!';
      const vida = $(`.vida[data-lado="${i}"]`);
      const pct = l.vidaMax > 0 ? Math.max(0, (l.vida / l.vidaMax) * 100) : 0;
      $('.vida-cheia', vida).style.width = `${pct}%`;
      $('.vida-rastro', vida).style.width = `${pct}%`;
      $('.vida-num', vida).textContent = l.vida;
      vida.classList.toggle('baixa', e.fase === 'lutando' && pct <= 25);
      $(`.mapa-conta[data-lado="${i}"]`).textContent = `${tema.lados[i].nome} ${l.estados}`;
      $(`#cabo .cabo-lado[data-lado="${i}"] .cabo-texto`).textContent =
        i === 0 ? `${tema.lados[0].nome} ${l.pontosRound}` : `${l.pontosRound} ${tema.lados[1].nome}`;
    });
    const parte = somaRound > 0 ? (e.lados[0].pontosRound / somaRound) * 100 : 50;
    const visivel = Math.max(8, Math.min(92, parte));
    $('#cabo .cabo-lado[data-lado="0"]').style.flexBasis = `${visivel}%`;
    $('#cabo-no').style.left = `${visivel}%`;
    mapa.atualizar(e.mapa, tema.lados.map((l) => l.cor));

    const guardado = $('#guardado');
    const pend = e.lados.map((l) => l.pendente);
    if (e.fase !== 'lutando' && (pend[0] || pend[1])) {
      guardado.textContent = `Guardado pro próximo round: ${tema.lados[0].nome} +${pend[0]} • ${tema.lados[1].nome} +${pend[1]}`;
      guardado.classList.add('visivel');
    } else guardado.classList.remove('visivel');
  }

  // Ao (re)abrir a tela no meio de um intervalo, deixa as poses coerentes.
  function sincronizarPoses(e) {
    if (e.fase === 'intervalo' && e.ultimoResultado && e.ultimoResultado.vencedor !== null && e.ultimoResultado.vencedor !== undefined) {
      const v = e.ultimoResultado.vencedor;
      lutadores[v].travar('vitoria');
      lutadores[1 - v].travar(e.ultimoResultado.motivo === 'nocaute' ? 'nocaute' : 'apanhando');
      if (e.ultimoResultado.motivo === 'nocaute') lutadores[1 - v].el.classList.add('caido');
    } else if (e.fase !== 'intervalo') {
      lutadores.forEach((l) => l.travado && l.destravar());
    }
  }

  // ---------------------------------------------------------------- golpes
  const filaGolpes = [];
  let livreEm = 0;

  function processarGolpes() {
    if (!filaGolpes.length || !tema) return;
    const agora = performance.now();
    if (agora < livreEm) return;
    let ev = filaGolpes.shift();
    // junta golpes pequenos seguidos do mesmo lado (chuva de rosas vira um combo)
    const pequeno = (g) => g.golpe === 'soco' || g.golpe === 'jab';
    while (filaGolpes.length && pequeno(ev) && pequeno(filaGolpes[0]) && filaGolpes[0].lado === ev.lado) {
      const prox = filaGolpes.shift();
      ev = { ...ev, dano: ev.dano + prox.dano, pontos: ev.pontos + prox.pontos, golpe: 'soco', combo: (ev.combo || 1) + 1 };
    }
    if (filaGolpes.length > 25) filaGolpes.splice(0, filaGolpes.length - 25);
    const duracao = executarGolpe(ev);
    livreEm = agora + duracao;
  }
  setInterval(processarGolpes, 40);

  function executarGolpe(ev) {
    const a = lutadores[ev.lado];
    const d = lutadores[ev.alvo];
    if (a.travado || d.travado) return 0;
    const dir = dirDe(ev.lado);
    const cor = tema.lados[ev.lado].cor;
    const forte = ev.golpe === 'especial' || ev.golpe === 'super';
    const pose = forte ? 'especial' : 'soco';
    const alcance = ev.golpe === 'jab' ? 30 : ev.golpe === 'soco' ? 70 : ev.golpe === 'especial' ? 110 : 140;
    const tempoImpacto = forte ? 210 : 110;
    a.pose(pose);
    a.corpo.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${dir * alcance}px, ${forte ? -24 : 0}px)`, offset: 0.35 },
        { transform: 'translate(0, 0)' },
      ],
      { duration: forte ? 620 : 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    setTimeout(() => {
      if (d.travado) return;
      d.pose('apanhando');
      d.corpo.animate(
        [
          { transform: 'translate(0,0) rotate(0deg)' },
          { transform: `translate(${dir * alcance * 0.55}px, 0) rotate(${dir * (forte ? 7 : 3)}deg)`, offset: 0.3 },
          { transform: 'translate(0,0) rotate(0deg)' },
        ],
        { duration: forte ? 560 : 360, easing: 'ease-out' },
      );
      d.img.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.4) saturate(0.3)' }, { filter: 'brightness(1)' }], { duration: 220 });
      const alvo = CABECA[ev.alvo];
      const forca = ev.golpe === 'super' ? 3 : ev.golpe === 'especial' ? 2 : ev.golpe === 'jab' ? 0 : 1;
      efeitos.impacto(alvo.x - dir * 90, alvo.y + 30, cor, forca);
      const valor = ev.dano || ev.pontos;
      if (valor > 0) numeroDano(ev.alvo, valor, cor, forte, ev.combo > 1 ? `COMBO x${ev.combo}` : ev.golpe === 'super' ? 'SUPER!' : '');
      Sons.tocar(ev.golpe);
      if (forte) tremer(ev.golpe === 'super');
      if (ev.golpe === 'super') anunciar('SUPER GOLPE!', ev.nome ? `de ${ev.nome}` : '');
    }, tempoImpacto);
    a.voltarEm(forte ? 650 : 340);
    d.voltarEm(tempoImpacto + (forte ? 520 : 300));
    return ev.golpe === 'super' ? 950 : ev.golpe === 'especial' ? 700 : ev.golpe === 'jab' ? 220 : 330;
  }

  // Nocaute: cai de cara no meio do ringue (cair para trás jogaria o boneco para fora da tela).
  // O estado final fica numa classe CSS (.caido); a animação só faz o caminho até lá.
  function cair(lado) {
    const l = lutadores[lado];
    const dir = dirDe(lado);
    l.corpo.getAnimations().forEach((a) => a.cancel());
    l.el.classList.add('caido');
    l.corpo.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: `translate(${-dir * 20}px, -24px) rotate(${-dir * 10}deg)`, offset: 0.22 },
        { transform: `translate(${dir * 30}px, 50px) rotate(${dir * 76}deg)` },
      ],
      { duration: 900, easing: 'cubic-bezier(.5,0,.8,.5)' },
    );
  }

  // ---------------------------------------------------------------- letreiro (ticker)
  // Cada item é { html } ou um presente agrupável { chave, render() } (combos viram uma linha só).
  const filaTicker = [];
  let tickerOcupado = false;
  let tickerAtual = null;
  function noticia(item) {
    if (typeof item === 'string') item = { html: item };
    if (item.chave) {
      const igual = [tickerAtual, ...filaTicker].find((x) => x && x.chave === item.chave && performance.now() - x.criado < 6000);
      if (igual) {
        igual.qtd += item.qtd;
        igual.pontos += item.pontos;
        if (igual === tickerAtual) $('#ticker-texto').innerHTML = igual.render();
        return;
      }
      item.criado = performance.now();
    }
    filaTicker.push(item);
    if (filaTicker.length > 8) filaTicker.splice(0, filaTicker.length - 8);
    if (!tickerOcupado) proximaNoticia();
  }
  async function proximaNoticia() {
    const el = $('#ticker-texto');
    if (!filaTicker.length) {
      tickerOcupado = false;
      tickerAtual = null;
      el.classList.remove('visivel');
      return;
    }
    tickerOcupado = true;
    el.classList.remove('visivel');
    await espera(170);
    tickerAtual = filaTicker.shift();
    el.innerHTML = tickerAtual.render ? tickerAtual.render() : tickerAtual.html;
    el.classList.add('visivel');
    await espera(Math.max(1100, 2600 - filaTicker.length * 320));
    proximaNoticia();
  }
  const nomeLado = (i) => `<b class="t${i}">${esc(tema.lados[i].nome)}</b>`;

  // ---------------------------------------------------------------- falas (balão + voz)
  const baloes = { 0: $('.balao[data-quem="0"]'), 1: $('.balao[data-quem="1"]'), narrador: $('.balao[data-quem="narrador"]') };
  let somLiberado = MUDO;

  function mostrarBalao(f) {
    const b = baloes[f.quem];
    if (!b) return;
    const t = $('.balao-texto', b);
    t.innerHTML = '';
    for (const p of f.partes ?? [{ t: f.texto }]) {
      const s = document.createElement(p.destaque ? 'b' : 'span');
      if (p.destaque) s.className = 'nome';
      s.textContent = p.t;
      t.append(s);
    }
    b.classList.add('visivel');
    if (f.quem === 0 || f.quem === 1) lutadores[f.quem].el.classList.add('falando');
  }
  function esconderBalao(f) {
    baloes[f.quem]?.classList.remove('visivel');
    if (f.quem === 0 || f.quem === 1) lutadores[f.quem].el.classList.remove('falando');
  }
  const tempoDeLeitura = (texto) => Math.min(6500, Math.max(2200, String(texto).length * 75));

  let vozesNavegador = [];
  if ('speechSynthesis' in window) {
    const carregar = () => (vozesNavegador = speechSynthesis.getVoices().filter((v) => /^pt(-|_)BR/i.test(v.lang)));
    carregar();
    speechSynthesis.onvoiceschanged = carregar;
  }

  function falarNavegador(f) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve(false);
      const u = new SpeechSynthesisUtterance(f.falado || f.texto);
      u.lang = 'pt-BR';
      const perfil = f.perfil?.navegador ?? {};
      u.pitch = Number(perfil.tom ?? 1);
      u.rate = Number(perfil.velocidade ?? 1);
      u.volume = Number(cfg.voz?.volume ?? 0.9);
      const masculina = vozesNavegador.find((v) => /antonio|daniel|male|masculin/i.test(v.name));
      const feminina = vozesNavegador.find((v) => /francisca|maria|female|feminin|google/i.test(v.name));
      u.voice = (f.quem === 'narrador' ? feminina : masculina) || vozesNavegador[0] || null;
      const fim = setTimeout(() => resolve(true), 15_000);
      u.onend = () => { clearTimeout(fim); resolve(true); };
      u.onerror = () => { clearTimeout(fim); resolve(false); };
      speechSynthesis.speak(u);
    });
  }

  // Toca pelo AudioContext (liberado uma vez no clique). No celular, um <audio> novo a cada fala
  // costuma ser bloqueado; o AudioContext não. Devolve null quando não dá (aí usa o <audio>).
  const buffersGravados = new Map();
  function tocarNoContexto(buffer, taxa = 1) {
    const ctx = Sons.contexto();
    if (!ctx || ctx.state !== 'running' || !buffer) return null;
    return new Promise((resolve) => {
      const fonte = ctx.createBufferSource();
      const ganho = ctx.createGain();
      ganho.gain.value = Math.max(0, Math.min(1, Number(cfg.voz?.volume ?? 0.9)));
      fonte.buffer = buffer;
      fonte.playbackRate.value = taxa;
      fonte.connect(ganho).connect(ctx.destination);
      const fim = setTimeout(() => { try { fonte.stop(); } catch {} resolve(true); }, 20_000);
      fonte.onended = () => { clearTimeout(fim); resolve(true); };
      fonte.start();
    });
  }
  async function decodificar(dados) {
    const ctx = Sons.contexto();
    if (!ctx) return null;
    try {
      return await new Promise((ok, erro) => {
        const p = ctx.decodeAudioData(dados, ok, erro);
        if (p?.then) p.then(ok, erro);
      });
    } catch {
      return null;
    }
  }

  // Áudio gravado (arquivo do tema) tem prioridade sobre a voz sintética.
  async function tocarGravado(f) {
    const ctx = Sons.contexto();
    if (ctx && ctx.state === 'running') {
      let buffer = buffersGravados.get(f.gravado);
      if (!buffer) {
        try {
          const r = await fetch(f.gravado);
          if (r.ok) buffer = await decodificar(await r.arrayBuffer());
        } catch {}
        if (buffer) {
          buffersGravados.set(f.gravado, buffer);
          if (buffersGravados.size > 80) buffersGravados.delete(buffersGravados.keys().next().value);
        }
      }
      const tocou = tocarNoContexto(buffer);
      if (tocou) return tocou;
    }
    return tocarGravadoElemento(f);
  }
  function tocarGravadoElemento(f) {
    return new Promise((resolve) => {
      const audio = new Audio(f.gravado);
      audio.volume = Math.max(0, Math.min(1, Number(cfg.voz?.volume ?? 0.9)));
      const fim = setTimeout(() => { audio.pause(); resolve(true); }, 20_000);
      audio.onended = () => { clearTimeout(fim); resolve(true); };
      audio.onerror = () => { clearTimeout(fim); resolve(false); };
      audio.play().catch((erro) => {
        clearTimeout(fim);
        if (erro?.name === 'NotAllowedError') pedirSom();
        resolve(false);
      });
    });
  }

  async function falarAudio(f) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 9000);
    let url = null;
    try {
      const r = await fetch(f.audio, { signal: controle.signal });
      clearTimeout(limite);
      if (!r.ok) return false;
      const motor = r.headers.get('X-Motor-Voz');
      const blob = await r.blob();
      const taxa = motor === 'google' ? Number(f.perfil?.google?.taxa ?? 1) : 1;
      const tocou = tocarNoContexto(await decodificar(await blob.arrayBuffer()), taxa);
      if (tocou) return await tocou;
      url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, Number(cfg.voz?.volume ?? 0.9)));
      if (motor === 'google') {
        audio.preservesPitch = false;
        audio.playbackRate = Number(f.perfil?.google?.taxa ?? 1);
      }
      return await new Promise((resolve) => {
        const fim = setTimeout(() => { audio.pause(); resolve(true); }, 20_000);
        audio.onended = () => { clearTimeout(fim); resolve(true); };
        audio.onerror = () => { clearTimeout(fim); resolve(false); };
        audio.play().catch((erro) => {
          clearTimeout(fim);
          if (erro?.name === 'NotAllowedError') pedirSom();
          resolve(false);
        });
      });
    } catch {
      return false;
    } finally {
      clearTimeout(limite);
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  const falas = {
    fila: [],
    atual: null,
    adicionar(f) {
      this.fila.push(f);
      const max = Math.max(1, Number(f.maxFila) || 4);
      while (this.fila.length > max) {
        let menor = 0;
        for (let i = 1; i < this.fila.length; i++) if (this.fila[i].prioridade < this.fila[menor].prioridade) menor = i;
        this.fila.splice(menor, 1);
      }
      this.proxima();
    },
    limpar() {
      this.fila = [];
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    async proxima() {
      if (this.atual || !this.fila.length) return;
      let idx = 0;
      for (let i = 1; i < this.fila.length; i++) if (this.fila[i].prioridade === 3 && this.fila[idx].prioridade < 3) idx = i;
      const f = this.fila.splice(idx, 1)[0];
      this.atual = f;
      mostrarBalao(f);
      const inicio = performance.now();
      const motor = cfg.voz?.motor;
      let falou = false;
      if (!MUDO && somLiberado && f.gravado) falou = await tocarGravado(f);
      if (!falou && !MUDO && somLiberado && motor === 'navegador') falou = await falarNavegador(f);
      else if (!falou && !MUDO && somLiberado && f.audio) falou = await falarAudio(f);
      const minimo = falou ? 600 : tempoDeLeitura(f.texto);
      const restante = minimo - (performance.now() - inicio);
      if (restante > 0) await espera(restante);
      esconderBalao(f);
      this.atual = null;
      setTimeout(() => this.proxima(), 260);
    },
  };

  // ---------------------------------------------------------------- liberação de som (navegador comum)
  const botaoSom = $('#ativar-som');
  function pedirSom() {
    if (MUDO) return;
    if (PREVIA) {
      somLiberado = false;
      parent.postMessage({ tipo: 'previa-som-bloqueado' }, location.origin);
      return;
    }
    somLiberado = false;
    botaoSom.hidden = false;
  }
  botaoSom.addEventListener('click', async () => {
    await Sons.destravar();
    somLiberado = true;
    botaoSom.hidden = true;
    if (CELULAR) telaCheia();
  });
  // no celular: toque libera o som e deixa em tela cheia (esconde a barra do navegador)
  function telaCheia() {
    const el = document.documentElement;
    const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    if (pedir && !document.fullscreenElement && !document.webkitFullscreenElement) {
      try { Promise.resolve(pedir.call(el)).catch(() => {}); } catch {}
    }
  }
  if (CELULAR) {
    botaoSom.textContent = '👆 Toque aqui para começar (som + tela cheia)';
    botaoSom.hidden = false;
    document.addEventListener('click', async () => {
      telaCheia();
      if (!somLiberado) {
        await Sons.destravar().catch(() => {});
        somLiberado = true;
        botaoSom.hidden = true;
      }
    });
  }
  if (!MUDO) {
    Sons.iniciar();
    setTimeout(() => {
      const c = Sons.contexto();
      if (c && c.state === 'running') somLiberado = true;
      else pedirSom();
    }, 400);
  }

  // ---------------------------------------------------------------- conexão com o servidor
  const socket = io();
  socket.on('connect', () => socket.emit('ola', MUDO || PREVIA ? 'previa' : 'overlay'));

  // a prévia do painel recebe "liga/desliga o som" da página do painel
  if (PREVIA) {
    window.addEventListener('message', async (e) => {
      if (e.origin !== location.origin || e.data?.tipo !== 'previa-som') return;
      MUDO = !e.data.ligado;
      if (MUDO) {
        falas.limpar();
        somLiberado = false;
      } else {
        Sons.iniciar();
        await Sons.destravar().catch(() => {});
        somLiberado = true;
      }
      if (cfg) aplicarConfig(cfg);
    });
    parent.postMessage({ tipo: 'previa-pronta' }, location.origin);
  }
  socket.on('tema', ({ tema: t, config: c }) => {
    const mesmo = tema && tema.id === t.id;
    if (mesmo) {
      tema = t;
      aplicarConfig(c);
      desenharPresentes();
    } else aplicarTema(t, c);
    if (estado) {
      atualizarEstado(estado);
      if (!mesmo) sincronizarPoses(estado);
    }
  });
  let primeiroEstado = true;
  socket.on('estado', (e) => {
    atualizarEstado(e);
    if (primeiroEstado && tema) {
      primeiroEstado = false;
      sincronizarPoses(e);
    }
  });
  socket.on('iconesPresentes', (lista) => {
    icones = lista || [[], []];
    desenharPresentes();
  });
  socket.on('ataque', (ev) => {
    if (!tema) return;
    if (!ev.guardado) filaGolpes.push(ev);
    if (ev.origem === 'presente' && ev.presente) {
      const icone = ev.presente.imagem ? `<img src="${esc(ev.presente.imagem)}" alt=""> ` : '🎁 ';
      const extra = ev.motivo === 'sem-time' ? ' (sem time: foi pro lado que está perdendo)' : '';
      const item = {
        chave: `${ev.nome}|${ev.presente.nome}|${ev.lado}`,
        qtd: ev.quantidade,
        pontos: ev.pontos,
        render() {
          const qtd = this.qtd > 1 ? `${this.qtd}× ` : '';
          return `${icone}<b>${esc(ev.nome)}</b> mandou ${qtd}${esc(ev.presente.nome)} → ${nomeLado(ev.lado)} +${this.pontos}${extra}`;
        },
      };
      noticia(item);
    }
  });
  socket.on('fala', (f) => falas.adicionar(f));
  socket.on('novoRound', (ev) => {
    lutadores.forEach((l) => l.destravar());
    filaGolpes.length = 0;
    Sons.tocar('sino');
    anunciar(`ROUND ${ev.round}`, 'LUTEM!');
  });
  socket.on('fimRound', (ev) => {
    // o golpe que decidiu o round ainda aparece; o resto da fila é descartado
    const decisivo = filaGolpes.pop();
    filaGolpes.length = 0;
    if (decisivo) {
      livreEm = 0;
      executarGolpe(decisivo);
    }
    setTimeout(() => {
      if (!tema) return;
      if (ev.vencedor === null || ev.vencedor === undefined) {
        Sons.tocar('sino');
        anunciar('EMPATE!', `Round ${ev.round}`);
        return;
      }
      const v = ev.vencedor;
      const p = 1 - v;
      const titulo = ev.motivo === 'nocaute' ? 'NOCAUTE!' : ev.motivo === 'tempo' ? 'TEMPO!' : 'FIM DO ROUND!';
      anunciar(titulo, `${tema.lados[v].nome} VENCEU O ROUND ${ev.round}!`);
      lutadores[v].travar('vitoria');
      if (ev.motivo === 'nocaute') {
        Sons.tocar('nocaute');
        lutadores[p].travar('nocaute');
        cair(p);
        tremer(true);
      } else {
        Sons.tocar('sino');
        lutadores[p].travar('apanhando');
      }
      efeitos.confete([tema.lados[v].cor, tema.cores.destaque, '#ffffff']);
    }, 380);
  });
  socket.on('conquista', (ev) => {
    if (!tema) return;
    mapa.pulsar(ev.uf);
    Sons.tocar('conquista');
    noticia(`📍 <b>${esc(ev.uf)}</b> agora é do ${nomeLado(ev.lado)}${ev.nome ? ` (valeu, ${esc(ev.nome)}!)` : ''}`);
  });
  socket.on('entrou', (ev) => {
    if (!tema || ev.origem !== 'comentario') return;
    noticia(`🤝 <b>${esc(ev.nome)}</b> ${ev.trocou ? 'trocou para' : 'entrou no'} time ${nomeLado(ev.lado)}`);
  });
  socket.on('estadoEscolhido', (ev) => noticia(`📍 <b>${esc(ev.nome)}</b> está jogando por <b>${esc(ev.uf)}</b>`));
  socket.on('social', (ev) => {
    if (ev.tipo === 'seguiu') noticia(`⭐ <b>${esc(ev.nome)}</b> seguiu a live!`);
    else noticia(`🔁 <b>${esc(ev.nome)}</b> compartilhou a live!`);
  });
  socket.on('zerado', () => {
    lutadores.forEach((l) => l.destravar());
    filaGolpes.length = 0;
    pontosAnteriores[0] = pontosAnteriores[1] = 0;
  });

  // expõe para testes/diagnóstico
  window.__arena = { lutadores, efeitos, anunciar, falas };
})();
