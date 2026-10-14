// Decide QUANDO um lutador fala e O QUE ele fala.
// As frases ficam no tema.json de cada tema (campo "frases"), com marcadores como {nome}.

import { escolherAleatorio } from './util.js';
import { nomeParaExibir } from './filtro.js';

// Nomes de presentes que costumam vir em inglês
const NOMES_PRESENTES = {
  rose: 'Rosa', 'ice cream cone': 'Casquinha', 'finger heart': 'Coraçãozinho', 'heart me': 'Coração',
  doughnut: 'Rosquinha', 'hand hearts': 'Coração de mão', lion: 'Leão', universe: 'Universo', galaxy: 'Galáxia',
  'hat and mustache': 'Chapéu e Bigode', sunglasses: 'Óculos', 'money gun': 'Chuva de Dinheiro', swan: 'Cisne',
  train: 'Trem', fireworks: 'Fogos', 'lightning bolt': 'Raio', 'love you': 'Te Amo', 'friendship necklace': 'Colar',
  'heart puff': 'Coração', 'cap': 'Boné', 'corgi': 'Corgi', 'gg': 'GG', 'tiktok': 'TikTok', perfume: 'Perfume',
  'paper crane': 'Tsuru', 'rosa': 'Rosa', 'mic': 'Microfone', 'confetti': 'Confete', 'sports car': 'Carrão',
  'interstellar': 'Interestelar', 'tiny diny': 'Dinossaurinho', 'garland': 'Guirlanda', 'disco ball': 'Globo de Luz',
};

export function nomeDoPresente(nome) {
  const chave = String(nome ?? '').trim().toLowerCase();
  return NOMES_PRESENTES[chave] ?? String(nome ?? 'presente');
}

// Uma frase pode ser só texto ou um objeto:
//   { "t": "texto do balão com {nome}", "voz": "versão falada, sem o nome", "audio": "audio/ID.mp3", "picante": true }
export function lerFrase(f) {
  if (typeof f === 'string') return { t: f, voz: null, audio: null, picante: false };
  return {
    t: String(f?.t ?? f?.texto ?? ''),
    voz: f?.voz ? String(f.voz) : null,
    audio: f?.audio ? String(f.audio) : null,
    picante: Boolean(f?.picante),
  };
}

// Para temas sem a versão "voz": tira o nome da frase do jeito mais natural possível.
export function falaSemNome(t) {
  return String(t)
    .replace(/\b(do|de|da)\s+\{nome\}/gi, 'da galera')
    .replace(/\b(pelo|pela)\s+\{nome\}/gi, 'pela galera')
    .replace(/(^|[.!?]\s+)O\s+\{nome\}/g, '$1A galera')
    .replace(/,\s*\{nome\}(?=\s*[!?.])/g, '')
    .replace(/^\{nome\}[,!]?\s*/, '')
    .replace(/\{nome\}/g, 'galera')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// "Valeu, {nome}!" -> partes [{t:'Valeu, '},{t:'Ana',destaque:true},{t:'!'}]
export function montarFrase(modelo, vars) {
  const partes = [];
  let ultimo = 0;
  const regex = /\{(\w+)\}/g;
  let m;
  while ((m = regex.exec(modelo))) {
    if (m.index > ultimo) partes.push({ t: modelo.slice(ultimo, m.index) });
    const valor = vars[m[1]];
    if (valor === undefined || valor === null) partes.push({ t: m[0] });
    else partes.push({ t: String(valor), destaque: m[1] === 'nome' });
    ultimo = regex.lastIndex;
  }
  if (ultimo < modelo.length) partes.push({ t: modelo.slice(ultimo) });
  return { texto: partes.map((p) => p.t).join(''), partes };
}

let proximoId = 1;

export class Narrador {
  constructor({ relogio = Date.now, aleatorio = Math.random } = {}) {
    this.relogio = relogio;
    this.aleatorio = aleatorio;
    this.tema = null;
    this.falas = { ativas: true, picantes: true, intervaloMinimoSeg: 3, falarPresentesAPartirDe: 1 };
    this.filtro = {};
    this.reiniciar();
  }

  configurar({ tema, falas, filtro }) {
    if (tema && tema !== this.tema) {
      this.tema = tema;
      this.reiniciar();
    }
    if (falas) this.falas = { ...this.falas, ...falas };
    if (filtro) this.filtro = filtro;
  }

  reiniciar() {
    this.recentes = new Map();
    this.ultimaFalaLado = [-Infinity, -Infinity];
    this.ultimaFalaUsuario = new Map();
  }

  nome(usuario) {
    return nomeParaExibir(usuario, {
      bloqueadas: this.filtro.palavrasBloqueadas,
      substituto: this.filtro.nomeSubstituto || 'alguém',
      substituicoes: this.tema?.substituicoesNoNome,
    });
  }

  // Sorteia evitando repetir as últimas frases daquela lista.
  sortear(chave, lista) {
    const permitidas = (lista ?? [])
      .map((f, i) => ({ f: lerFrase(f), i }))
      .filter((x) => x.f.t && (this.falas.picantes || !x.f.picante));
    if (permitidas.length === 0) return null;
    const recentes = this.recentes.get(chave) ?? [];
    let opcoes = permitidas.filter((x) => !recentes.includes(x.i));
    if (opcoes.length === 0) opcoes = permitidas;
    const escolhida = escolherAleatorio(opcoes, this.aleatorio);
    recentes.push(escolhida.i);
    const memoria = Math.max(1, Math.min(8, Math.floor(permitidas.length * 0.6)));
    while (recentes.length > memoria) recentes.shift();
    this.recentes.set(chave, recentes);
    return escolhida.f;
  }

  varsBase(lado) {
    const lados = this.tema.lados;
    return {
      lutador: lados[lado]?.nome,
      rival: lados[1 - lado]?.nome,
    };
  }

  // texto/partes vão para o balão (com o nome); "falado" é o que a voz diz (sem o nome, salvo se ligado).
  criarFala(quem, frase, vars, prioridade) {
    const f = lerFrase(frase);
    const { texto, partes } = montarFrase(f.t, vars);
    const falarNome = Boolean(this.falas.falarNome);
    const modeloFalado = falarNome ? f.t : f.voz ?? falaSemNome(f.t);
    const falado = montarFrase(modeloFalado, { ...vars, nome: vars.nome ?? '' }).texto;
    const perfil = quem === 'narrador' ? this.tema.narrador?.voz : this.tema.lados[quem]?.voz;
    const gravado = f.audio && !falarNome ? (/^https?:/.test(f.audio) ? f.audio : `${this.tema.base}${f.audio}`) : null;
    return { id: `f${proximoId++}`, quem, texto, partes, falado, gravado, prioridade, voz: perfil ?? {} };
  }

  // Chamado a cada golpe. Devolve uma fala ou null (quando não é hora de falar).
  aoAtacar(ev) {
    if (!this.tema || !this.falas.ativas) return null;
    if (ev.origem === 'curtida' || ev.golpe === 'jab') return null;
    const agora = this.relogio();
    const prioridade = ev.golpe === 'super' ? 3 : ev.golpe === 'especial' ? 2 : 1;
    if (prioridade === 1) {
      if (ev.pontos < (this.falas.falarPresentesAPartirDe ?? 1)) return null;
      if (agora - this.ultimaFalaLado[ev.lado] < (this.falas.intervaloMinimoSeg ?? 3) * 1000) return null;
      if (agora - (this.ultimaFalaUsuario.get(ev.usuario.id) ?? -Infinity) < 12_000) return null;
    }
    const frases = this.tema.lados[ev.lado]?.frases ?? {};
    const categoria = prioridade === 3 ? 'super' : prioridade === 2 ? 'especial' : 'ataque';
    const lista = frases[categoria]?.length ? frases[categoria] : frases.ataque;
    const modelo = this.sortear(`${ev.lado}:${categoria}`, lista);
    if (!modelo) return null;
    this.ultimaFalaLado[ev.lado] = agora;
    this.ultimaFalaUsuario.set(ev.usuario.id, agora);
    if (this.ultimaFalaUsuario.size > 3000) this.ultimaFalaUsuario.clear();
    return this.criarFala(ev.lado, modelo, {
      ...this.varsBase(ev.lado),
      nome: this.nome(ev.usuario),
      presente: nomeDoPresente(ev.presente?.nome),
      qtd: ev.quantidade,
      pontos: ev.pontos,
    }, prioridade);
  }

  aoFimRound(ev) {
    if (!this.tema || !this.falas.ativas) return null;
    if (ev.vencedor === null || ev.vencedor === undefined) {
      const modelo = this.sortear('narrador:empate', this.tema.narrador?.frases?.empate);
      return modelo ? this.criarFala('narrador', modelo, { round: ev.round }, 3) : null;
    }
    const frases = this.tema.lados[ev.vencedor]?.frases ?? {};
    const modelo = this.sortear(`${ev.vencedor}:vitoria`, frases.vitoria);
    if (!modelo) return null;
    this.ultimaFalaLado[ev.vencedor] = this.relogio();
    return this.criarFala(ev.vencedor, modelo, { ...this.varsBase(ev.vencedor), round: ev.round }, 3);
  }

  aoNovoRound(ev) {
    if (!this.tema || !this.falas.ativas) return null;
    const modelo = this.sortear('narrador:inicio', this.tema.narrador?.frases?.inicioRound);
    if (!modelo) return null;
    return this.criarFala('narrador', modelo, {
      round: ev.round,
      a: this.tema.lados[0]?.nome,
      b: this.tema.lados[1]?.nome,
    }, 2);
  }
}
