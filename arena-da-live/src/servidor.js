// Arena da Live — servidor principal.
// Abre http://localhost:3000/painel (controle) e http://localhost:3000/overlay (tela para o OBS / LIVE Studio).

import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import { Config } from './config.js';
import { carregarTemas, temaParaTela } from './temas.js';
import { Jogo } from './jogo.js';
import { Narrador, nomeDoPresente } from './narrador.js';
import { ServicoDeVoz } from './voz.js';
import { RastreadorDeCombos } from './normalizar.js';
import { FonteConector, FonteTikFinity } from './fontes.js';
import { Simulador } from './simulador.js';
import { verificarTroca, faltaParaTroca } from './agendamento.js';
import { horaAgora } from './util.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_TEMAS = join(RAIZ, 'temas');
const PASTA_DADOS = join(RAIZ, 'dados');
const ARQUIVO_ESTADO = join(PASTA_DADOS, 'estado.json');

const log = (...a) => console.log(`[${horaAgora()}]`, ...a);
let estadoSalvoSujo = false;

process.on('unhandledRejection', (erro) => console.error('[erro]', erro?.stack ?? erro));
process.on('uncaughtException', (erro) => console.error('[erro]', erro?.stack ?? erro));

// ------------------------------------------------------------------ inicialização
const config = new Config(join(RAIZ, 'config.json'));
await config.carregar();
const cfg = () => config.dados;

let temas = new Map();
let avisosTemas = [];
async function recarregarTemas() {
  const r = await carregarTemas(PASTA_TEMAS);
  temas = r.temas;
  avisosTemas = r.avisos;
  for (const a of avisosTemas) log('[temas]', a);
  log(`[temas] ${temas.size} tema(s): ${[...temas.keys()].join(', ')}`);
}
await recarregarTemas();
if (temas.size === 0) {
  console.error('Nenhum tema encontrado na pasta "temas". Confira se a pasta foi copiada inteira.');
  process.exit(1);
}

const jogo = new Jogo({ regras: cfg().regras });
const narrador = new Narrador();
const voz = new ServicoDeVoz({ obterMotor: () => cfg().voz.motor });
const combos = new RastreadorDeCombos();
let temaAtual = null;

function aplicarTema(id, motivo = '') {
  const tema = temas.get(id) ?? temas.get(cfg().temaAtivo) ?? [...temas.values()][0];
  temaAtual = tema;
  jogo.definirTema(tema);
  narrador.configurar({ tema, falas: cfg().falas, filtro: cfg().filtro, discreto: cfg().tela.modoDiscreto });
  if (cfg().temaAtivo !== tema.id) {
    cfg().temaAtivo = tema.id;
    config.salvar();
  }
  log(`[tema] Ativo: ${tema.nome}${motivo ? ` (${motivo})` : ''}`);
  return tema;
}
aplicarTema(cfg().temaAtivo, 'inicialização');

try {
  const salvo = JSON.parse(await readFile(ARQUIVO_ESTADO, 'utf8'));
  if (jogo.restaurar(salvo)) log(`[jogo] Placar restaurado (round ${jogo.round}).`);
} catch {
  // primeira vez: sem placar salvo
}

// ------------------------------------------------------------------ web
const app = express();
app.disable('x-powered-by');

// Outros aparelhos da rede (ex.: o celular) só podem abrir a TELA do jogo, nunca o painel.
const ehLocal = (ip) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const PERMITIDO_NA_REDE = /^\/(overlay|comum|temas|voz|socket\.io)(\/|$)/;
app.use((req, res, next) => {
  if (ehLocal(req.socket.remoteAddress) || cfg().acessoNaRede) return next();
  if (PERMITIDO_NA_REDE.test(req.path)) return next();
  if (req.path === '/' || req.path === '/celular') return res.redirect('/overlay/?celular=1');
  res.status(403).type('text/plain; charset=utf-8').send('O painel só abre no próprio PC. No celular, use o endereço da tela do jogo.');
});
app.use('/overlay', express.static(join(RAIZ, 'public', 'overlay')));
app.use('/painel', express.static(join(RAIZ, 'public', 'painel')));
app.use('/comum', express.static(join(RAIZ, 'public', 'comum')));
app.use('/temas', express.static(PASTA_TEMAS, { maxAge: 0 }));
app.get('/', (_req, res) => res.redirect('/painel/'));

// Áudio de cada fala (gerado na hora e guardado por alguns minutos)
const falas = new Map();
app.get('/voz/:id', async (req, res) => {
  const fala = falas.get(req.params.id);
  if (!fala) return res.status(404).end();
  const r = await voz.sintetizar(fala.falado, fala.voz);
  if (!r) return res.status(503).end();
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Motor-Voz': r.motor });
  return res.send(r.audio);
});

const servidorHttp = createServer(app);
const io = new Server(servidorHttp, { cors: { origin: false } });

// ------------------------------------------------------------------ estado para as telas
const nome = (usuario) => narrador.nome(usuario);

function configTela() {
  const c = cfg();
  return { tela: c.tela, som: c.som, voz: { motor: c.voz.motor, volume: c.voz.volume }, regras: c.regras };
}

function estadoParaTela() {
  const e = jogo.estado();
  e.lados.forEach((l, i) => {
    l.top = jogo.topDoadores(i, 3).map((d) => ({ nome: nome(d.usuario), pontos: d.pontos }));
  });
  return e;
}

function enderecosNaRede() {
  if (!cfg().telaNaRede && !cfg().acessoNaRede) return [];
  const lista = [];
  for (const [nome, ifs] of Object.entries(networkInterfaces())) {
    for (const i of ifs ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      if (/^169\.254\./.test(i.address)) continue;
      // Wi-Fi e cabo primeiro; adaptadores virtuais (VirtualBox, WSL, VPN) por último
      // Wi-Fi/cabo da casa (192.168.x, 10.x, 172.16-31.x) primeiro; VPNs (Radmin 26.x, Hamachi 25.x...) e virtuais por último
      const casa = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address);
      const virtual = !casa || /virtual|vmware|vbox|wsl|hyper-v|vethernet|docker|tailscale|zerotier|hamachi|radmin|vpn/i.test(nome);
      lista.push({ url: `http://${i.address}:${porta}/overlay/?celular=1`, virtual });
    }
  }
  return lista.sort((a, b) => a.virtual - b.virtual).map((e) => e.url);
}

function infoPainel() {
  const c = cfg();
  return {
    config: c,
    temas: [...temas.values()].map((t) => ({ id: t.id, nome: t.nome })),
    temaAtivo: temaAtual.id,
    avisosTemas,
    conexao: statusConexao(),
    voz: voz.status(),
    agendamento: { ...c.trocaAgendada, faltaMs: faltaParaTroca(c.trocaAgendada) },
    simulacaoAutomatica: simulador.ligado,
    telasAbertas: io.sockets.adapter.rooms.get('overlay')?.size ?? 0,
    enderecosCelular: enderecosNaRede(),
  };
}

let ultimoEnvioEstado = 0;
let estadoSujo = true;
function enviarEstado(forcar = false) {
  const agora = Date.now();
  if (!forcar && agora - ultimoEnvioEstado < 120) {
    estadoSujo = true;
    return;
  }
  ultimoEnvioEstado = agora;
  estadoSujo = false;
  io.emit('estado', estadoParaTela());
}
function enviarTema() {
  io.emit('tema', { tema: temaParaTela(temaAtual), config: configTela() });
}
function enviarPainel() {
  io.to('painel').emit('painel', infoPainel());
}

// ------------------------------------------------------------------ falas
function publicarFala(fala) {
  if (!fala) return;
  const motor = cfg().voz.motor;
  const comAudio = motor !== 'desligado' && motor !== 'navegador';
  falas.set(fala.id, { falado: fala.falado, voz: fala.voz, criada: Date.now() });
  // com áudio gravado não precisa gerar voz; sem ele, já começa a gerar
  if (comAudio && !fala.gravado) voz.sintetizar(fala.falado, fala.voz);
  io.emit('fala', {
    id: fala.id,
    quem: fala.quem,
    texto: fala.texto,
    falado: fala.falado,
    partes: fala.partes,
    prioridade: fala.prioridade,
    gravado: motor !== 'desligado' ? fala.gravado : null,
    audio: comAudio && !fala.gravado ? `/voz/${fala.id}` : null,
    perfil: fala.voz,
    maxFila: cfg().falas.maxFila,
  });
}
setInterval(() => {
  const limite = Date.now() - 3 * 60_000;
  for (const [id, f] of falas) if (f.criada < limite) falas.delete(id);
}, 30_000).unref();

// ------------------------------------------------------------------ eventos do jogo -> telas
const logPresentes = [];
// quem repete o número no chat recebe um lembrete na tela (no máx. 1 a cada 30s por pessoa, 1 a cada 4s no geral)
const ultimoLembrete = new Map();
let ultimoLembreteGeral = 0;
jogo.on('repetiu', (ev) => {
  const agora = Date.now();
  if (agora - ultimoLembreteGeral < 4000 || agora - (ultimoLembrete.get(ev.usuario.id) ?? 0) < 30_000) return;
  ultimoLembreteGeral = agora;
  ultimoLembrete.set(ev.usuario.id, agora);
  if (ultimoLembrete.size > 5000) ultimoLembrete.clear();
  io.emit('lembrete', { nome: nome(ev.usuario), lado: ev.lado });
});
jogo.on('soquinho', (ev) =>
  io.emit('ataque', { lado: ev.lado, alvo: ev.alvo, pontos: 0, dano: 0, golpe: 'jab', origem: 'curtida', visual: true, quantidade: ev.quantidade }),
);
jogo.on('ataque', (ev) => {
  io.emit('ataque', {
    lado: ev.lado,
    alvo: ev.alvo,
    pontos: ev.pontos,
    dano: ev.dano,
    golpe: ev.golpe,
    guardado: ev.guardado,
    origem: ev.origem,
    motivo: ev.motivo,
    quantidade: ev.quantidade,
    vidaAlvo: ev.vidaAlvo,
    nome: ev.usuario ? nome(ev.usuario) : '',
    presente: ev.presente ? { nome: nomeDoPresente(ev.presente.nome), imagem: ev.presente.imagem, moedas: ev.presente.moedas } : null,
  });
  if (ev.origem === 'presente') {
    const item = {
      hora: horaAgora(),
      usuario: ev.usuario.apelido || ev.usuario.nome,
      presente: ev.presente.nome,
      id: ev.presente.id,
      moedas: ev.presente.moedas,
      quantidade: ev.quantidade,
      lado: temaAtual.lados[ev.lado].nome,
      pontos: ev.pontos,
      motivo: ev.motivo,
    };
    logPresentes.unshift(item);
    logPresentes.length = Math.min(logPresentes.length, 60);
    io.to('painel').emit('log', item);
  }
  publicarFala(narrador.aoAtacar(ev));
  estadoSalvoSujo = true;
});
jogo.on('fimRound', (ev) => {
  io.emit('fimRound', ev);
  publicarFala(narrador.aoFimRound(ev));
  enviarEstado(true);
  log(`[jogo] Fim do round ${ev.round}: ${ev.vencedor === null ? 'empate' : `${temaAtual.lados[ev.vencedor].nome} venceu`} (${ev.motivo}).`);
});
jogo.on('novoRound', (ev) => {
  io.emit('novoRound', ev);
  publicarFala(narrador.aoNovoRound(ev));
  enviarEstado(true);
});
jogo.on('conquista', (ev) => io.emit('conquista', { lado: ev.lado, uf: ev.uf, nome: nome(ev.usuario) }));
jogo.on('entrou', (ev) => io.emit('entrou', { lado: ev.lado, nome: nome(ev.usuario), trocou: ev.trocou, origem: ev.origem }));
jogo.on('estadoEscolhido', (ev) => io.emit('estadoEscolhido', { uf: ev.uf, nome: nome(ev.usuario) }));
jogo.on('zerado', () => io.emit('zerado'));
jogo.on('mudou', () => {
  enviarEstado();
  estadoSalvoSujo = true;
});

// ------------------------------------------------------------------ entrada de eventos (live ou simulação)
function receberPresente(ev) {
  const grupo = ev.grupo ?? 1;
  const quantidade = combos.quantidadeNova(ev) * grupo;
  // quanto o combo já somou até aqui (ex.: 99 rosas em sequência viram golpe especial ao passar de 99)
  const quantidadeCombo = Math.max(quantidade, (ev.repeatCount ?? 1) * grupo);
  if (quantidade > 0) jogo.presente({ usuario: ev.usuario, presente: ev.presente, quantidade, quantidadeCombo });
}
function ligarFonte(fonte) {
  fonte.on('presente', receberPresente);
  fonte.on('comentario', (ev) => jogo.comentario(ev));
  fonte.on('curtida', (ev) => jogo.curtidas(ev));
  fonte.on('seguiu', (ev) => io.emit('social', { tipo: 'seguiu', nome: nome(ev.usuario) }));
  fonte.on('compartilhou', (ev) => io.emit('social', { tipo: 'compartilhou', nome: nome(ev.usuario) }));
}

const simulador = new Simulador({ obterTema: () => temaAtual });
ligarFonte(simulador);

let fonte = null;
let catalogoPresentes = [];
function statusConexao() {
  return fonte
    ? {
        estado: fonte.estado,
        detalhe: fonte.detalhe,
        fonte: fonte instanceof FonteTikFinity ? 'tikfinity' : 'conector',
        diag: fonte.diag ? { ...fonte.diag, haSeg: fonte.diag.ultimo ? Math.round((Date.now() - fonte.diag.ultimo) / 1000) : null } : null,
      }
    : { estado: 'desconectado', detalhe: '', fonte: cfg().tiktok.fonte };
}
// contador de eventos no painel
setInterval(() => {
  if (fonte?.estado === 'conectado' || fonte?.estado === 'semEventos') io.to('painel').emit('conexao', statusConexao());
}, 3000).unref();

function aoVivo() {
  return Boolean(fonte) && ['conectado', 'semEventos', 'conectando', 'reconectando'].includes(fonte.estado);
}
function bloquearSimulacaoAoVivo() {
  if (aoVivo()) throw new Error('Simulação desligada enquanto o TikTok está conectado (presente falso na live real é punido). Desconecte para testar.');
}

async function conectar() {
  if (simulador.ligado) simulador.automatico(false); // nada de presente falso na live real
  await desconectar();
  const t = cfg().tiktok;
  fonte = t.fonte === 'tikfinity' ? new FonteTikFinity({ url: t.tikfinityUrl }) : new FonteConector({ usuario: t.usuario, signApiKey: t.signApiKey });
  ligarFonte(fonte);
  fonte.on('status', (s) => {
    log(`[conexão] ${s.estado}${s.detalhe ? `: ${s.detalhe}` : ''}`);
    io.to('painel').emit('conexao', statusConexao());
  });
  // mostra na janela preta o que chega da live (ajuda a conferir se os eventos estão chegando)
  fonte.on('comentario', (ev) => log(`[chat] ${nome(ev.usuario)}: ${String(ev.texto).slice(0, 80)}`));
  fonte.on('catalogo', (lista) => {
    catalogoPresentes = lista;
    enviarIconesPresentes();
    io.to('painel').emit('catalogo', catalogoPresentes);
  });
  await fonte.conectar();
}
async function desconectar() {
  if (!fonte) return;
  const f = fonte;
  fonte = null;
  await f.desconectar();
  f.removeAllListeners();
  io.to('painel').emit('conexao', statusConexao());
}

// Quando a live conecta, descobrimos as imagens oficiais dos presentes de cada lado.
function enviarIconesPresentes() {
  if (!catalogoPresentes.length || !temaAtual) return;
  const icones = temaAtual.lados.map((l) =>
    l.presentes.map((p) => {
      const achado = catalogoPresentes.find(
        (g) => p.ids.includes(g.id) || p.nomes.some((n) => n.toLowerCase() === g.nome.toLowerCase()),
      );
      return achado?.imagem ?? null;
    }),
  );
  io.emit('iconesPresentes', icones);
}

// ------------------------------------------------------------------ comandos do painel
const comandos = {
  conectar: async (d) => {
    await config.atualizar('tiktok', {
      usuario: String(d?.usuario ?? cfg().tiktok.usuario).trim().replace(/^@/, ''),
      fonte: d?.fonte === 'tikfinity' ? 'tikfinity' : 'conector',
    });
    conectar();
  },
  desconectar: () => desconectar(),
  iniciar: () => jogo.iniciar(),
  pausar: () => jogo.pausar(),
  retomar: () => jogo.retomar(),
  encerrarRound: () => jogo.encerrarRound(),
  reiniciarRound: () => jogo.reiniciarRound(),
  zerarTudo: () => jogo.zerarTudo(),
  ajustar: (d) => jogo.ajustar(Number(d?.lado), Number(d?.pontos)),
  ativarTema: async (d) => {
    if (!temas.has(d?.id)) throw new Error('Tema não encontrado.');
    aplicarTema(d.id, 'painel');
    enviarTema();
    enviarIconesPresentes();
    enviarEstado(true);
  },
  recarregarTemas: async () => {
    await recarregarTemas();
    aplicarTema(temaAtual.id, 'recarregado');
    enviarTema();
    enviarEstado(true);
  },
  salvarAgendamento: async (d) => {
    const quando = new Date(d?.quando);
    if (Number.isNaN(quando.getTime())) throw new Error('Data/hora inválida.');
    await config.atualizar('trocaAgendada', {
      ativa: Boolean(d.ativa),
      quando: quando.toISOString(),
      deTema: String(d.deTema ?? ''),
      paraTema: String(d.paraTema ?? ''),
      feita: false,
    });
  },
  salvarConfig: async (d) => {
    const secoes = ['regras', 'falas', 'voz', 'som', 'tela', 'tiktok', 'filtro'];
    if (!secoes.includes(d?.secao)) throw new Error('Seção inválida.');
    await config.atualizar(d.secao, d.valores ?? {});
    if (d.secao === 'regras') jogo.definirRegras(cfg().regras);
    if (d.secao === 'falas' || d.secao === 'filtro') narrador.configurar({ falas: cfg().falas, filtro: cfg().filtro });
    if (d.secao === 'tela') narrador.configurar({ discreto: cfg().tela.modoDiscreto });
    enviarTema();
    enviarEstado(true);
    enviarPainel();
  },
  // Simulação só fora da live: presentes falsos na tela de uma live real enganam o público
  // (e o TikTok pune como "solicitação artificial de presente").
  simular: (d) => {
    bloquearSimulacaoAoVivo();
    return simulador.executar(d);
  },
  simulacaoAutomatica: (d) => {
    if (d?.ligar) bloquearSimulacaoAoVivo();
    return simulador.automatico(Boolean(d?.ligar));
  },
  // Toca na tela do OBS; se nenhuma tela estiver aberta, o próprio painel toca o áudio.
  testarVoz: (d) => {
    const quem = d?.quem === 'narrador' ? 'narrador' : Number(d?.quem) === 1 ? 1 : 0;
    const nomeLutador = quem === 'narrador' ? 'Narrador' : temaAtual.lados[quem].nome;
    // com falas gravadas, testa com uma delas (é a voz que vai tocar na live)
    const frases = quem === 'narrador' ? [] : Object.values(temaAtual.lados[quem].frases ?? {}).flat();
    const gravadas = frases.filter((f) => typeof f === 'object' && f?.audio);
    const modelo = gravadas.length
      ? narrador.sortear(`teste:${quem}`, gravadas)
      : `Teste de voz! Aqui é ${nomeLutador}. Valeu, {nome}!`;
    const vars = quem === 'narrador' ? {} : { ...narrador.varsBase(quem), presente: 'Rosa', qtd: 1 };
    const fala = narrador.criarFala(quem, modelo ?? `Teste de voz! Aqui é ${nomeLutador}. Valeu, {nome}!`, { ...vars, nome: 'Fulano' }, 3);
    publicarFala(fala);
    const motor = cfg().voz.motor;
    return {
      telasAbertas: io.sockets.adapter.rooms.get('overlay')?.size ?? 0,
      motor,
      gravado: motor !== 'desligado' ? fala.gravado : null,
      audio: motor !== 'desligado' && motor !== 'navegador' && !fala.gravado ? `/voz/${fala.id}` : null,
      texto: fala.falado,
      perfil: fala.voz,
    };
  },
};

io.on('connection', (socket) => {
  const local = ehLocal(socket.handshake.address) || cfg().acessoNaRede;
  socket.on('ola', (tipo) => {
    if (tipo === 'painel' && local) {
      socket.join('painel');
      socket.emit('painel', infoPainel());
      socket.emit('logInicial', logPresentes);
      socket.emit('catalogo', catalogoPresentes);
    } else {
      // a prévia muda do painel não conta como tela aberta
      socket.join(tipo === 'previa' ? 'previa' : 'overlay');
      if (tipo !== 'previa') {
        enviarPainel();
        socket.on('disconnect', () => setTimeout(enviarPainel, 50));
      }
    }
    socket.emit('tema', { tema: temaParaTela(temaAtual), config: configTela() });
    socket.emit('estado', estadoParaTela());
    enviarIconesPresentes();
  });
  socket.on('cmd', async (acao, dados, responder) => {
    const fn = comandos[acao];
    const ok = typeof responder === 'function' ? responder : () => {};
    if (!local) return ok({ ok: false, erro: 'Comandos só pelo painel no PC.' });
    if (!fn) return ok({ ok: false, erro: `Comando desconhecido: ${acao}` });
    try {
      const extra = await fn(dados);
      ok({ ok: true, ...(extra && typeof extra === 'object' ? extra : {}) });
      enviarPainel();
    } catch (erro) {
      ok({ ok: false, erro: erro.message });
    }
  });
});

// ------------------------------------------------------------------ relógio, troca agendada e salvamento
setInterval(() => {
  jogo.tick();
  if (estadoSujo || jogo.fase === 'lutando' || jogo.fase === 'intervalo') enviarEstado(true);
}, 250);

function checarTrocaAgendada() {
  const ag = cfg().trocaAgendada;
  const r = verificarTroca(ag, temaAtual.id);
  if (r.marcarFeita) {
    ag.feita = true;
    config.salvar();
  }
  if (!r.trocar) return;
  let destino = temas.get(r.para);
  if (!destino) destino = [...temas.values()].find((t) => t.id !== ag.deTema);
  if (!destino) {
    log('[agendamento] Não há outro tema para trocar!');
    return;
  }
  aplicarTema(destino.id, 'troca automática agendada');
  enviarTema();
  enviarIconesPresentes();
  enviarEstado(true);
  enviarPainel();
}
checarTrocaAgendada();
setInterval(checarTrocaAgendada, 10_000);
setInterval(() => enviarPainel(), 15_000);

async function salvarEstado() {
  if (!estadoSalvoSujo) return;
  estadoSalvoSujo = false;
  try {
    await mkdir(PASTA_DADOS, { recursive: true });
    await writeFile(`${ARQUIVO_ESTADO}.tmp`, JSON.stringify(jogo.serializar()));
    await rename(`${ARQUIVO_ESTADO}.tmp`, ARQUIVO_ESTADO);
  } catch (erro) {
    console.error('[salvar]', erro.message);
  }
}
setInterval(salvarEstado, 3000);

async function encerrar() {
  log('Encerrando...');
  estadoSalvoSujo = true;
  await salvarEstado();
  await desconectar().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

// ------------------------------------------------------------------ escutar
const host = cfg().acessoNaRede || cfg().telaNaRede ? '0.0.0.0' : '127.0.0.1';
const porta = Number(process.env.PORTA || cfg().porta || 3000);
servidorHttp.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`\nA porta ${porta} já está em uso. Feche o outro programa ou mude "porta" no config.json.\n`);
    process.exit(1);
  }
  throw erro;
});
servidorHttp.listen(porta, host, () => {
  console.log('');
  console.log('  ARENA DA LIVE rodando!');
  console.log(`  Painel de controle:  http://localhost:${porta}/painel`);
  console.log(`  Tela para o OBS:     http://localhost:${porta}/overlay   (1080 x 1920)`);
  console.log(`  Tela p/ LIVE Studio: http://127.0.0.1.nip.io:${porta}/overlay/   (fonte "Link")`);
  const [celular] = enderecosNaRede();
  if (celular) console.log(`  Tela no celular:     ${celular}   (mesma rede Wi-Fi)`);
  console.log('  Para fechar: Ctrl + C');
  console.log('');
  if (cfg().tiktok.conectarAoIniciar && cfg().tiktok.usuario) conectar();
  if (process.env.ABRIR_PAINEL === '1') abrirNavegador(`http://localhost:${porta}/painel/`);
});

function abrirNavegador(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' })
      .on('error', () => {})
      .unref();
  } catch {
    // sem navegador: o endereço já aparece no terminal
  }
}
