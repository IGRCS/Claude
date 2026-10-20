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

// Chamadas do narrador (o tema pode trocar em narrador.frases.entrou / marco / convite).
export const CHAMADAS_PADRAO = {
  entrou: [
    '{nome} chegou pra lutar pelo {lutador}!',
    'Bem-vindo, {nome}! Time {lutador}!',
    '{nome} tá com o {lutador}! Comenta e curte pra socar!',
    'Olha o {nome} entrando no time {lutador}!',
  ],
  trocou: ['{nome} trocou de lado! Agora é {lutador}!', 'Virou a casaca! {nome} agora luta pelo {lutador}!'],
  marco: [
    '{nome} já deu {socos} socos pelo {lutador}!',
    '{socos} socos do {nome}! Que braço!',
    'O {nome} não para! {socos} socos pro {lutador}!',
  ],
  convite: [
    'Comente {dicaA} pro {a} ou {dicaB} pro {b} e entre na luta!',
    'Quem vai socar agora? Comente {dicaA} ou {dicaB}!',
    'Curta a tela pra dar soco! Comente {dicaA} ou {dicaB} pra escolher seu lado!',
    'Tá muito parado aqui! Escolha seu lutador: {dicaA} ou {dicaB}!',
  ],
};

// falas que citam presente, pagamento ou agradecimento (evitadas no modo discreto)
export const CITA_PRESENTE = /presente|patroc|\bpix\b|pagando|patr[aã]o|mand(ou|aram|a)\b|obrigad/i;

export class Narrador {
  constructor({ relogio = Date.now, aleatorio = Math.random } = {}) {
    this.relogio = relogio;
    this.aleatorio = aleatorio;
    this.tema = null;
    this.falas = { ativas: true, picantes: true, intervaloMinimoSeg: 3, falarPresentesAPartirDe: 1 };
    this.filtro = {};
    this.reiniciar();
  }

  configurar({ tema, falas, filtro, discreto }) {
    if (tema && tema !== this.tema) {
      this.tema = tema;
      this.reiniciar();
    }
    if (falas) this.falas = { ...this.falas, ...falas };
    if (filtro) this.filtro = filtro;
    if (discreto !== undefined) this.discreto = Boolean(discreto);
  }

  reiniciar() {
    this.recentes = new Map();
    this.ultimaFalaLado = [-Infinity, -Infinity];
    this.ultimaFalaUsuario = new Map();
    this.ultimaChamada = -Infinity;
    this.chamados = new Map();
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
    let permitidas = (lista ?? [])
      .map((f, i) => ({ f: lerFrase(f), i }))
      .filter((x) => x.f.t && (this.falas.picantes || !x.f.picante));
    // modo discreto: fora as falas que citam presente/pagamento (se sobrar alguma)
    if (this.discreto) {
      const semPresente = permitidas.filter((x) => !CITA_PRESENTE.test(x.f.voz ?? x.f.t));
      if (semPresente.length) permitidas = semPresente;
    }
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
  criarFala(quem, frase, vars, prioridade, { falarNome: forcarNome = false } = {}) {
    const f = lerFrase(frase);
    // modo discreto: o balão mostra a fala sem o nome de quem mandou (nada de "valeu, Fulano")
    const modeloBalao = this.discreto && quem !== 'narrador' ? f.voz ?? falaSemNome(f.t) : f.t;
    const { texto, partes } = montarFrase(modeloBalao, vars);
    const falarNome = forcarNome || Boolean(this.falas.falarNome);
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

  // ------------------------------------------------------------ chamadas (interação com quem assiste)
  frasesChamada(tipo) {
    const doTema = this.tema?.narrador?.frases?.[tipo];
    return doTema?.length ? doTema : CHAMADAS_PADRAO[tipo];
  }

  podeChamar() {
    return Boolean(this.tema && this.falas.ativas && this.falas.chamarNomes !== false) &&
      this.relogio() - this.ultimaChamada >= (Number(this.falas.intervaloChamadasSeg) || 0) * 1000;
  }

  // o narrador chama pelo nome (o nome passa pelo filtro de palavrões e vai na voz também)
  chamar(chave, tipo, usuario, vars) {
    const modelo = this.sortear(`narrador:${chave}`, this.frasesChamada(tipo));
    if (!modelo) return null;
    const agora = this.relogio();
    this.ultimaChamada = agora;
    if (usuario) {
      this.chamados.set(`${tipo}:${usuario.id}`, agora);
      if (this.chamados.size > 5000) this.chamados.clear();
    }
    return this.criarFala('narrador', modelo, { ...vars, nome: usuario ? this.nome(usuario) : '' }, 1, { falarNome: true });
  }

  aoEntrar(ev) {
    if (ev.origem !== 'comentario' || !this.podeChamar()) return null;
    if (this.relogio() - (this.chamados.get(`entrou:${ev.usuario.id}`) ?? -Infinity) < 120_000) return null;
    const tipo = ev.trocou ? 'trocou' : 'entrou';
    const fala = this.chamar(tipo, tipo, ev.usuario, this.varsBase(ev.lado));
    if (fala) this.chamados.set(`entrou:${ev.usuario.id}`, this.relogio());
    return fala;
  }

  aoMarco(ev) {
    if (!this.podeChamar()) return null;
    return this.chamar('marco', 'marco', ev.usuario, { ...this.varsBase(ev.lado), socos: ev.socos });
  }

  // ninguém interagindo há um tempo: convida a galera (o servidor decide quando)
  convite() {
    if (!this.tema || !this.falas.ativas) return null;
    const [a, b] = this.tema.lados;
    const fala = this.sortear('narrador:convite', this.frasesChamada('convite'));
    if (!fala) return null;
    const vars = { a: a?.nome, b: b?.nome, dicaA: a?.dicaChat, dicaB: b?.dicaChat };
    return this.criarFala('narrador', fala, vars, 1);
  }
}
