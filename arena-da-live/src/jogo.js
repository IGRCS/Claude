// Regras da luta: rounds, vida, pontos, times, curtidas e mapa do Brasil.
// Não sabe nada de TikTok nem de tela: recebe eventos já normalizados e emite eventos do jogo.

import { EventEmitter } from 'node:events';
import { escolherAleatorio, normalizarTexto, UFS } from './util.js';

export const REGRAS_PADRAO = {
  duracaoRoundSeg: 180, // duração de cada round
  intervaloSeg: 10, // pausa entre rounds
  vidaMax: 300, // vida de cada lutador (1 ponto = 1 de dano)
  especialAPartirDe: 99, // moedas num único envio para soltar golpe especial
  superAPartirDe: 299, // moedas num único envio para soltar super golpe
  curtidasPorPonto: 10, // curtidas de quem já tem time viram 1 ponto (toda curtida já dá um soquinho visual)
  pontosPorEstado: 20, // pontos para conquistar um estado no mapa
  presenteSemTime: 'mais-fraco', // presente "neutro" de quem não escolheu lado: 'mais-fraco' | 'aleatorio' | 'ignorar'
  autoIniciar: true, // o primeiro presente (ou curtida de quem tem time) já começa o round
  multiplicador: 1,
};

const limparPalavra = (p) => normalizarTexto(p).replace(/^[#!/]+/, '').trim();

function ladoNovo(vidaMax) {
  return { vida: vidaMax, vidaMax, pontosRound: 0, rounds: 0, total: 0, conquista: 0, curtidas: 0, pendente: 0 };
}

export class Jogo extends EventEmitter {
  constructor({ regras = {}, relogio = Date.now, aleatorio = Math.random } = {}) {
    super();
    this.relogio = relogio;
    this.aleatorio = aleatorio;
    this.regras = { ...REGRAS_PADRAO, ...regras };
    this.tema = null;
    this.chavesPresentes = [];
    this.palavras = [[], []];
    this.zerarTudo(false);
  }

  // ------------------------------------------------------------ configuração
  definirTema(tema) {
    this.tema = tema;
    this.chavesPresentes = tema.lados.map((l) => ({
      ids: new Set((l.presentes ?? []).flatMap((p) => (p.ids ?? []).map(String))),
      nomes: new Set((l.presentes ?? []).flatMap((p) => (p.nomes ?? []).map(normalizarTexto))),
    }));
    this.palavras = tema.lados.map((l) => (l.palavras ?? []).map(limparPalavra).filter(Boolean));
    this.zerarTudo();
  }

  definirRegras(regras) {
    this.regras = { ...this.regras, ...regras };
    // A vida nova vale a partir do próximo round (no meio da luta só limita ao novo máximo).
    for (const l of this.lados) {
      if (this.fase === 'aguardando') {
        l.vidaMax = this.regras.vidaMax;
        l.vida = l.vidaMax;
      } else if (this.fase === 'lutando' || this.fase === 'pausado') {
        l.vidaMax = this.regras.vidaMax;
        l.vida = Math.min(l.vida, l.vidaMax);
      }
    }
    if (this.fase === 'aguardando') this.restanteMs = this.regras.duracaoRoundSeg * 1000;
    this.mudou();
  }

  zerarTudo(emitir = true) {
    this.fase = 'aguardando';
    this.round = 1;
    this.fimRoundEm = 0;
    this.restanteMs = this.regras.duracaoRoundSeg * 1000;
    this.intervaloAte = 0;
    this.lados = [ladoNovo(this.regras.vidaMax), ladoNovo(this.regras.vidaMax)];
    this.mapa = Object.fromEntries(UFS.map((uf) => [uf, null]));
    this.times = new Map();
    this.membros = [0, 0];
    this.estadosUsuarios = new Map();
    this.doadores = [new Map(), new Map()];
    this.ultimoResultado = null;
    if (emitir) {
      this.emit('zerado');
      this.mudou();
    }
  }

  mudou() {
    this.emit('mudou');
  }

  // ------------------------------------------------------------ rounds
  iniciarRound() {
    for (const l of this.lados) {
      l.vidaMax = this.regras.vidaMax;
      l.vida = l.vidaMax;
      l.pontosRound = 0;
    }
    this.fase = 'lutando';
    this.fimRoundEm = this.relogio() + this.regras.duracaoRoundSeg * 1000;
    this.aplicarPendentes();
    this.emit('novoRound', { round: this.round });
    this.mudou();
  }

  // Pontos que chegaram no intervalo/pausa entram quando a luta volta (sem nocautear de cara).
  aplicarPendentes() {
    for (const lado of [0, 1]) {
      const pendente = this.lados[lado].pendente;
      if (pendente > 0) {
        this.lados[lado].pendente = 0;
        this.lados[lado].pontosRound += pendente;
        const alvo = this.lados[1 - lado];
        alvo.vida = Math.max(1, alvo.vida - pendente);
      }
    }
  }

  finalizarRound(vencedor, motivo) {
    if (this.fase !== 'lutando' && this.fase !== 'pausado') return;
    const [a, b] = this.lados;
    if (vencedor === null || vencedor === undefined) {
      vencedor = a.pontosRound === b.pontosRound ? null : a.pontosRound > b.pontosRound ? 0 : 1;
    }
    if (vencedor !== null) this.lados[vencedor].rounds++;
    this.fase = 'intervalo';
    this.intervaloAte = this.relogio() + this.regras.intervaloSeg * 1000;
    this.ultimoResultado = { round: this.round, vencedor, motivo, pontos: [a.pontosRound, b.pontosRound] };
    this.emit('fimRound', { ...this.ultimoResultado, placar: [a.rounds, b.rounds] });
    this.mudou();
  }

  // Chamado algumas vezes por segundo pelo servidor.
  tick() {
    const agora = this.relogio();
    if (this.fase === 'lutando' && agora >= this.fimRoundEm) {
      this.finalizarRound(null, 'tempo');
    } else if (this.fase === 'intervalo' && agora >= this.intervaloAte) {
      this.round++;
      this.iniciarRound();
    }
  }

  iniciar() {
    if (this.fase === 'aguardando') this.iniciarRound();
    else if (this.fase === 'intervalo') {
      this.round++;
      this.iniciarRound();
    } else if (this.fase === 'pausado') this.retomar();
  }

  pausar() {
    if (this.fase !== 'lutando') return;
    this.restanteMs = Math.max(0, this.fimRoundEm - this.relogio());
    this.fase = 'pausado';
    this.mudou();
  }

  retomar() {
    if (this.fase !== 'pausado') return;
    this.fase = 'lutando';
    this.fimRoundEm = this.relogio() + this.restanteMs;
    this.aplicarPendentes();
    this.mudou();
  }

  encerrarRound() {
    this.finalizarRound(null, 'encerrado');
  }

  reiniciarRound() {
    if (this.fase === 'aguardando') return;
    if (this.fase === 'intervalo' && this.ultimoResultado?.vencedor != null) {
      // desfaz o ponto do round que acabou de terminar
      this.lados[this.ultimoResultado.vencedor].rounds = Math.max(0, this.lados[this.ultimoResultado.vencedor].rounds - 1);
    }
    for (const l of this.lados) l.pendente = 0;
    this.iniciarRound();
  }

  // Correção manual pelo painel (positivo ataca, negativo devolve).
  ajustar(lado, pontos) {
    pontos = Math.round(Number(pontos) || 0);
    if (!pontos || (lado !== 0 && lado !== 1)) return;
    if (pontos > 0) {
      this.aplicarPontos(lado, pontos, {
        usuario: { id: 'painel', nome: 'Painel', apelido: 'painel' },
        presente: null, quantidade: 0, golpe: 'soco', origem: 'ajuste',
      });
      return;
    }
    const l = this.lados[lado];
    const tirar = Math.min(-pontos, l.pontosRound);
    l.pontosRound -= tirar;
    l.total = Math.max(0, l.total - tirar);
    const alvo = this.lados[1 - lado];
    alvo.vida = Math.min(alvo.vidaMax, alvo.vida + tirar);
    this.mudou();
  }

  // ------------------------------------------------------------ eventos da live
  ladoDoPresente(presente) {
    const id = String(presente?.id ?? '');
    const nome = normalizarTexto(presente?.nome);
    for (let i = 0; i < this.chavesPresentes.length; i++) {
      const c = this.chavesPresentes[i];
      if ((id && c.ids.has(id)) || (nome && c.nomes.has(nome))) return i;
    }
    return -1;
  }

  ladoMaisFraco() {
    const [a, b] = this.lados;
    if (this.fase === 'lutando' && a.vida !== b.vida) return a.vida < b.vida ? 0 : 1;
    if (a.pontosRound !== b.pontosRound) return a.pontosRound < b.pontosRound ? 0 : 1;
    if (a.total !== b.total) return a.total < b.total ? 0 : 1;
    return this.aleatorio() < 0.5 ? 0 : 1;
  }

  presente({ usuario, presente, quantidade }) {
    if (!this.tema || !(quantidade > 0)) return null;
    let lado = this.ladoDoPresente(presente);
    let motivo = 'presente';
    if (lado < 0) {
      if (this.times.has(usuario.id)) {
        lado = this.times.get(usuario.id);
        motivo = 'time';
      } else {
        const regra = this.regras.presenteSemTime;
        if (regra === 'ignorar') {
          this.emit('ignorado', { usuario, presente, quantidade });
          return null;
        }
        lado = regra === 'aleatorio' ? (this.aleatorio() < 0.5 ? 0 : 1) : this.ladoMaisFraco();
        motivo = 'sem-time';
        this.entrarNoTime(usuario, lado, 'presente');
      }
    } else if (!this.times.has(usuario.id)) {
      this.entrarNoTime(usuario, lado, 'presente');
    }
    const moedas = Math.max(1, Number(presente?.moedas) || 1);
    const valor = moedas * quantidade;
    const pontos = Math.max(1, Math.round(valor * (Number(this.regras.multiplicador) || 1)));
    const golpe = valor >= this.regras.superAPartirDe ? 'super' : valor >= this.regras.especialAPartirDe ? 'especial' : 'soco';
    return this.aplicarPontos(lado, pontos, { usuario, presente, quantidade, golpe, origem: 'presente', motivo, valor });
  }

  curtidas({ usuario, quantidade }) {
    if (!this.tema || !(this.regras.curtidasPorPonto > 0)) return null;
    const lado = this.times.get(usuario.id);
    if (lado === undefined) return null;
    if (this.fase === 'aguardando' && this.regras.autoIniciar) this.iniciarRound();
    const l = this.lados[lado];
    l.curtidas += Math.max(0, Number(quantidade) || 0);
    const N = this.regras.curtidasPorPonto;
    if (l.curtidas < N) {
      // ainda não deu 1 ponto, mas a curtida aparece na hora como um soquinho (sem dano)
      if (this.fase === 'lutando') this.emit('soquinho', { lado, alvo: 1 - lado, usuario });
      return null;
    }
    const pontos = Math.floor(l.curtidas / N);
    l.curtidas -= pontos * N;
    return this.aplicarPontos(lado, pontos, { usuario, presente: null, quantidade: 0, golpe: 'jab', origem: 'curtida' });
  }

  comentario({ usuario, texto }) {
    if (!this.tema) return null;
    const t = limparPalavra(texto);
    if (!t) return null;
    if (this.tema.mapa) {
      const uf = t.toUpperCase();
      if (/^[A-Z]{2}$/.test(uf) && UFS.includes(uf)) {
        this.estadosUsuarios.set(usuario.id, uf);
        if (this.estadosUsuarios.size > 20000) this.estadosUsuarios.delete(this.estadosUsuarios.keys().next().value);
        const ev = { usuario, uf };
        this.emit('estadoEscolhido', ev);
        return { tipo: 'estado', ...ev };
      }
    }
    const palavrasTexto = t.split(/\s+/);
    const semPontuacao = t.replace(/[^\p{L}\p{N}\s]/gu, '').trim(); // "13!!!" / "22 🔥" -> "13" / "22"
    const numeros = t.match(/\d+/g) ?? [];
    for (let lado = 0; lado < this.palavras.length; lado++) {
      const combina = this.palavras[lado].some(
        (p) =>
          t === p ||
          semPontuacao === p ||
          // números de 2+ dígitos (13, 22) valem em qualquer parte do comentário: "vai 13", "22 22 22"
          (/^\d{2,}$/.test(p) ? numeros.includes(p) : p.length >= 3 && (p.includes(' ') ? t.includes(p) : palavrasTexto.includes(p))),
      );
      if (combina) {
        const ev = this.entrarNoTime(usuario, lado, 'comentario');
        return ev ? { tipo: 'time', ...ev } : null;
      }
    }
    return null;
  }

  entrarNoTime(usuario, lado, origem) {
    const anterior = this.times.get(usuario.id);
    if (anterior === lado) return null;
    if (anterior !== undefined) this.membros[anterior]--;
    this.times.set(usuario.id, lado);
    this.membros[lado]++;
    if (this.times.size > 50000) {
      const [idVelho, ladoVelho] = this.times.entries().next().value;
      this.times.delete(idVelho);
      this.membros[ladoVelho]--;
    }
    const ev = { usuario, lado, trocou: anterior !== undefined, origem };
    this.emit('entrou', ev);
    this.mudou();
    return ev;
  }

  // ------------------------------------------------------------ pontos, dano e mapa
  aplicarPontos(lado, pontos, info) {
    if (this.fase === 'aguardando' && this.regras.autoIniciar && (info.origem === 'presente' || info.origem === 'curtida')) this.iniciarRound();
    const atacante = this.lados[lado];
    const alvo = this.lados[1 - lado];
    atacante.total += pontos;
    this.registrarDoador(lado, info.usuario, pontos);
    const conquistas = this.acumularConquista(lado, pontos, info.usuario);
    let dano = 0;
    let guardado = false;
    if (this.fase === 'lutando') {
      atacante.pontosRound += pontos;
      dano = Math.min(pontos, alvo.vida);
      alvo.vida -= dano;
    } else {
      atacante.pendente += pontos;
      guardado = true;
    }
    const ev = { lado, alvo: 1 - lado, pontos, dano, guardado, vidaAlvo: alvo.vida, conquistas, ...info };
    this.emit('ataque', ev);
    if (this.fase === 'lutando' && alvo.vida <= 0) this.finalizarRound(lado, 'nocaute');
    this.mudou();
    return ev;
  }

  registrarDoador(lado, usuario, pontos) {
    if (!usuario || usuario.id === 'painel') return;
    const mapa = this.doadores[lado];
    const atual = mapa.get(usuario.id) ?? { usuario, pontos: 0 };
    atual.usuario = usuario;
    atual.pontos += pontos;
    mapa.set(usuario.id, atual);
    if (mapa.size > 800) {
      const menores = [...mapa.entries()].sort((x, y) => x[1].pontos - y[1].pontos).slice(0, 200);
      for (const [id] of menores) mapa.delete(id);
    }
  }

  topDoadores(lado, n = 3) {
    return [...this.doadores[lado].values()].sort((x, y) => y.pontos - x.pontos).slice(0, n);
  }

  acumularConquista(lado, pontos, usuario) {
    if (!this.tema?.mapa) return [];
    const atacante = this.lados[lado];
    const N = Math.max(1, Number(this.regras.pontosPorEstado) || 1);
    atacante.conquista += pontos;
    const ufs = [];
    while (atacante.conquista >= N && ufs.length < UFS.length) {
      const uf = this.escolherEstado(lado, usuario);
      if (!uf) {
        atacante.conquista = Math.min(atacante.conquista, N);
        break;
      }
      atacante.conquista -= N;
      const de = this.mapa[uf];
      this.mapa[uf] = lado;
      ufs.push(uf);
      this.emit('conquista', { lado, uf, de, usuario });
    }
    return ufs;
  }

  escolherEstado(lado, usuario) {
    const preferido = this.estadosUsuarios.get(usuario?.id);
    if (preferido && this.mapa[preferido] !== lado) return preferido;
    const neutros = UFS.filter((uf) => this.mapa[uf] === null);
    if (neutros.length) return escolherAleatorio(neutros, this.aleatorio);
    const doRival = UFS.filter((uf) => this.mapa[uf] === 1 - lado);
    if (doRival.length) return escolherAleatorio(doRival, this.aleatorio);
    return null;
  }

  // ------------------------------------------------------------ estado
  estado() {
    const agora = this.relogio();
    const duracaoMs = this.regras.duracaoRoundSeg * 1000;
    let restanteMs = 0;
    if (this.fase === 'lutando') restanteMs = Math.max(0, this.fimRoundEm - agora);
    else if (this.fase === 'pausado') restanteMs = this.restanteMs;
    else if (this.fase === 'aguardando') restanteMs = duracaoMs;
    const estados = [0, 0];
    for (const dono of Object.values(this.mapa)) if (dono === 0 || dono === 1) estados[dono]++;
    return {
      fase: this.fase,
      round: this.round,
      restanteMs,
      duracaoMs,
      intervaloMs: this.fase === 'intervalo' ? Math.max(0, this.intervaloAte - agora) : 0,
      lados: this.lados.map((l, i) => ({
        vida: l.vida,
        vidaMax: l.vidaMax,
        pontosRound: l.pontosRound,
        rounds: l.rounds,
        total: l.total,
        pendente: l.pendente,
        estados: estados[i],
        membros: this.membros[i],
      })),
      mapa: { ...this.mapa },
      ultimoResultado: this.ultimoResultado,
    };
  }

  serializar() {
    const agora = this.relogio();
    return {
      versao: 1,
      temaId: this.tema?.id ?? null,
      fase: this.fase,
      round: this.round,
      restanteMs: this.fase === 'lutando' ? Math.max(0, this.fimRoundEm - agora) : this.restanteMs,
      intervaloRestanteMs: this.fase === 'intervalo' ? Math.max(0, this.intervaloAte - agora) : 0,
      lados: this.lados,
      mapa: this.mapa,
      times: [...this.times],
      estadosUsuarios: [...this.estadosUsuarios],
      doadores: this.doadores.map((m) => [...m]),
      ultimoResultado: this.ultimoResultado,
    };
  }

  restaurar(dados) {
    if (!dados || dados.versao !== 1 || !this.tema || dados.temaId !== this.tema.id) return false;
    const agora = this.relogio();
    this.fase = dados.fase;
    this.round = dados.round;
    this.restanteMs = dados.restanteMs;
    this.fimRoundEm = agora + dados.restanteMs;
    this.intervaloAte = agora + (dados.intervaloRestanteMs ?? 0);
    this.lados = dados.lados.map((l) => ({ ...ladoNovo(this.regras.vidaMax), ...l }));
    this.mapa = { ...Object.fromEntries(UFS.map((uf) => [uf, null])), ...dados.mapa };
    this.times = new Map(dados.times ?? []);
    this.membros = [0, 0];
    for (const lado of this.times.values()) if (lado === 0 || lado === 1) this.membros[lado]++;
    this.estadosUsuarios = new Map(dados.estadosUsuarios ?? []);
    this.doadores = (dados.doadores ?? [[], []]).map((lista) => new Map(lista));
    this.ultimoResultado = dados.ultimoResultado ?? null;
    this.mudou();
    return true;
  }
}
