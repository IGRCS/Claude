// Efeitos sonoros sintetizados na hora (Web Audio), sem arquivos de áudio.
/* exported Sons */

const Sons = (() => {
  let ctx = null;
  let mestre = null;
  let volume = 0.6;
  let ligado = true;

  function iniciar() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    mestre = ctx.createGain();
    mestre.gain.value = volume;
    mestre.connect(ctx.destination);
    return ctx;
  }

  // Um único buffer de ruído (2s) reaproveitado em todos os golpes: gerar ruído novo a cada soco pesava.
  let bufferRuido = null;
  function ruido(duracao) {
    if (!bufferRuido) {
      const tamanho = Math.floor(ctx.sampleRate * 2);
      bufferRuido = ctx.createBuffer(1, tamanho, ctx.sampleRate);
      const dados = bufferRuido.getChannelData(0);
      for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
    }
    const fonte = ctx.createBufferSource();
    fonte.buffer = bufferRuido;
    fonte.loopEnd = Math.min(2, Math.max(0.01, duracao));
    const inicio = fonte.start.bind(fonte);
    // cada golpe começa num ponto diferente do ruído e para no tempo pedido
    fonte.start = (quando = 0) => inicio(quando, Math.random() * (2 - fonte.loopEnd), fonte.loopEnd);
    return fonte;
  }

  function envelope(no, t0, ataque, pico, duracao) {
    no.gain.setValueAtTime(0.0001, t0);
    no.gain.exponentialRampToValueAtTime(pico, t0 + ataque);
    no.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
  }

  function pancada(t0, forca) {
    // estalo
    const r = ruido(0.12);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 1400;
    filtro.Q.value = 0.8;
    const g = ctx.createGain();
    envelope(g, t0, 0.003, 0.9 * forca, 0.11);
    r.connect(filtro).connect(g).connect(mestre);
    r.start(t0);
    r.stop(t0 + 0.13);
    // grave
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
    const g2 = ctx.createGain();
    envelope(g2, t0, 0.005, 1.0 * forca, 0.2);
    o.connect(g2).connect(mestre);
    o.start(t0);
    o.stop(t0 + 0.22);
  }

  function zunido(t0, dur) {
    const r = ruido(dur);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 2;
    filtro.frequency.setValueAtTime(400, t0);
    filtro.frequency.exponentialRampToValueAtTime(3000, t0 + dur);
    const g = ctx.createGain();
    envelope(g, t0, dur * 0.7, 0.5, dur);
    r.connect(filtro).connect(g).connect(mestre);
    r.start(t0);
    r.stop(t0 + dur);
  }

  function estrondo(t0, forca) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(32, t0 + 0.6);
    const g = ctx.createGain();
    envelope(g, t0, 0.01, 1.1 * forca, 0.65);
    o.connect(g).connect(mestre);
    o.start(t0);
    o.stop(t0 + 0.7);
    const r = ruido(0.5);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 900;
    const g2 = ctx.createGain();
    envelope(g2, t0, 0.005, 0.7 * forca, 0.45);
    r.connect(filtro).connect(g2).connect(mestre);
    r.start(t0);
    r.stop(t0 + 0.5);
  }

  function sino(t0, vezes = 1) {
    for (let i = 0; i < vezes; i++) {
      const t = t0 + i * 0.32;
      for (const [freq, vol] of [[880, 0.5], [1760, 0.22], [2640, 0.12], [1320, 0.15]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        envelope(g, t, 0.004, vol, 1.4);
        o.connect(g).connect(mestre);
        o.start(t);
        o.stop(t + 1.5);
      }
    }
  }

  function brilho(t0) {
    [660, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      envelope(g, t0 + i * 0.07, 0.005, 0.25, 0.25);
      o.connect(g).connect(mestre);
      o.start(t0 + i * 0.07);
      o.stop(t0 + i * 0.07 + 0.3);
    });
  }

  function tocar(nome) {
    if (!ligado || !iniciar() || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    switch (nome) {
      case 'jab': pancada(t, 0.35); break;
      case 'soco': pancada(t, 0.7); break;
      case 'especial': zunido(t, 0.18); estrondo(t + 0.18, 0.8); pancada(t + 0.18, 0.8); break;
      case 'super': zunido(t, 0.28); estrondo(t + 0.28, 1.2); pancada(t + 0.28, 1); brilho(t + 0.35); break;
      case 'nocaute': estrondo(t, 1.2); sino(t + 0.3, 3); break;
      case 'sino': sino(t, 1); break;
      case 'conquista': brilho(t); break;
      default: break;
    }
  }

  return {
    iniciar,
    tocar,
    contexto: () => ctx,
    destravar: () => (iniciar() ? ctx.resume() : Promise.resolve()),
    volume(v) {
      volume = v;
      if (mestre) mestre.gain.value = v;
    },
    ligar(v) {
      ligado = v;
    },
  };
})();
