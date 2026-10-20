import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jogo } from '../src/jogo.js';
import { validarTema } from '../src/temas.js';

function montar(regras = {}, temaExtra = {}) {
  let agora = 1_000_000;
  const relogio = () => agora;
  const avancar = (ms) => {
    agora += ms;
  };
  let sorteio = 0;
  const aleatorio = () => {
    sorteio = (sorteio + 0.37) % 1;
    return sorteio;
  };
  const jogo = new Jogo({ regras: { duracaoRoundSeg: 60, intervaloSeg: 5, vidaMax: 100, danoPorMoeda: 1, pontosPorComentario: 0, ...regras }, relogio, aleatorio });
  const tema = validarTema('teste', {
    mapa: true,
    ...temaExtra,
    lados: [
      { nome: 'A', presentes: [{ nomes: ['Rose'], ids: ['5655'] }], palavras: ['1', 'time a', '#aaa'] },
      { nome: 'B', presentes: [{ nomes: ['TikTok'], ids: ['5269'] }], palavras: ['2', 'bbb'] },
    ],
  });
  jogo.definirTema(tema);
  const eventos = [];
  for (const nome of ['ataque', 'fimRound', 'novoRound', 'conquista', 'entrou', 'ignorado']) {
    jogo.on(nome, (e) => eventos.push({ nome, ...e }));
  }
  return { jogo, avancar, eventos };
}

const usuario = (id) => ({ id, apelido: id, nome: id });
const rosa = { id: '5655', nome: 'Rose', moedas: 1 };
const tiktok = { id: '5269', nome: 'TikTok', moedas: 1 };
const presente = (moedas, nome = 'Lion') => ({ id: `x${moedas}`, nome, moedas });

test('presente do lado começa o round, causa dano e coloca a pessoa no time', () => {
  const { jogo, eventos } = montar();
  const ev = jogo.presente({ usuario: usuario('ana'), presente: rosa, quantidade: 5 });
  assert.equal(jogo.fase, 'lutando');
  assert.equal(ev.lado, 0);
  assert.equal(ev.pontos, 5);
  assert.equal(ev.golpe, 'soco');
  assert.equal(jogo.lados[1].vida, 95);
  assert.equal(jogo.lados[0].pontosRound, 5);
  assert.equal(jogo.times.get('ana'), 0);
  assert.ok(eventos.some((e) => e.nome === 'novoRound'));
});

test('presente reconhecido também pelo nome em português/maiúsculas', () => {
  const { jogo } = montar();
  const ev = jogo.presente({ usuario: usuario('a'), presente: { id: '', nome: 'tiktok', moedas: 1 }, quantidade: 1 });
  assert.equal(ev.lado, 1);
});

test('comentar 1/2 ou a palavra do time escolhe o lado do presente neutro', () => {
  const { jogo } = montar();
  jogo.comentario({ usuario: usuario('bia'), texto: '2' });
  assert.equal(jogo.presente({ usuario: usuario('bia'), presente: presente(30), quantidade: 1 }).lado, 1);
  jogo.comentario({ usuario: usuario('bia'), texto: '#AAA' });
  assert.equal(jogo.presente({ usuario: usuario('bia'), presente: presente(30), quantidade: 1 }).lado, 0);
  jogo.comentario({ usuario: usuario('ze'), texto: 'Eu sou do TIME A!!' });
  assert.equal(jogo.times.get('ze'), 0, 'palavra-chave de 2 palavras vale dentro de uma frase');
  jogo.comentario({ usuario: usuario('lu'), texto: 'bbb' });
  assert.equal(jogo.times.get('lu'), 1);
  assert.deepEqual(jogo.membros, [2, 1]);
});

test('números de 2 dígitos (13/22) valem com pontuação, emoji ou repetidos', () => {
  const { jogo } = montar({}, {});
  jogo.palavras = [['13'], ['22']];
  jogo.comentario({ usuario: usuario('a'), texto: '13' });
  jogo.comentario({ usuario: usuario('b'), texto: '22!!! 🔥' });
  jogo.comentario({ usuario: usuario('c'), texto: 'vai 13 13 13' });
  jogo.comentario({ usuario: usuario('d'), texto: '2022' });
  assert.equal(jogo.times.get('a'), 0);
  assert.equal(jogo.times.get('b'), 1);
  assert.equal(jogo.times.get('c'), 0);
  assert.equal(jogo.times.get('d'), undefined, '"2022" não é "22"');
});

test('tema da eleição: 13 = LULE e 22 = FLABIO', async () => {
  const { carregarTemas } = await import('../src/temas.js');
  const { temas } = await carregarTemas(new URL('../temas/', import.meta.url).pathname);
  const t = temas.get('eleicao');
  assert.equal(t.lados[0].dicaChat, '13');
  assert.equal(t.lados[1].dicaChat, '22');
  const { jogo } = montar();
  jogo.definirTema(t);
  jogo.comentario({ usuario: usuario('x'), texto: '13' });
  jogo.comentario({ usuario: usuario('y'), texto: '22' });
  assert.equal(jogo.times.get('x'), 0);
  assert.equal(jogo.times.get('y'), 1);
});

test('"1" no meio de outra frase não troca de time', () => {
  const { jogo } = montar();
  jogo.comentario({ usuario: usuario('x'), texto: 'tenho 1 pergunta' });
  assert.equal(jogo.times.get('x'), undefined);
});

test('presente neutro de quem não tem time ajuda o lado que está perdendo', () => {
  const { jogo } = montar();
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 20 }); // B toma 20 de dano
  const ev = jogo.presente({ usuario: usuario('novato'), presente: presente(10), quantidade: 1 });
  assert.equal(ev.lado, 1);
  assert.equal(ev.motivo, 'sem-time');
  assert.equal(jogo.times.get('novato'), 1);
});

test('regra "ignorar" não conta presente neutro de quem não tem time', () => {
  const { jogo, eventos } = montar({ presenteSemTime: 'ignorar' });
  assert.equal(jogo.presente({ usuario: usuario('n'), presente: presente(10), quantidade: 1 }), null);
  assert.ok(eventos.some((e) => e.nome === 'ignorado'));
  assert.equal(jogo.lados[0].total + jogo.lados[1].total, 0);
});

test('tipos de golpe pelo valor do envio', () => {
  const { jogo } = montar({ vidaMax: 100000 });
  jogo.comentario({ usuario: usuario('a'), texto: '1' });
  const golpe = (moedas, qtd = 1) => jogo.presente({ usuario: usuario('a'), presente: presente(moedas), quantidade: qtd }).golpe;
  assert.equal(golpe(98), 'soco');
  assert.equal(golpe(99), 'especial');
  assert.equal(golpe(33, 3), 'especial');
  assert.equal(golpe(299), 'super');
});

test('nocaute encerra o round, soma o round e o intervalo começa o próximo', () => {
  const { jogo, avancar, eventos } = montar();
  jogo.presente({ usuario: usuario('a'), presente: tiktok, quantidade: 150 });
  const fim = eventos.find((e) => e.nome === 'fimRound');
  assert.equal(fim.vencedor, 1);
  assert.equal(fim.motivo, 'nocaute');
  assert.equal(jogo.lados[1].rounds, 1);
  assert.equal(jogo.fase, 'intervalo');
  assert.equal(jogo.lados[0].vida, 0);
  avancar(5000);
  jogo.tick();
  assert.equal(jogo.fase, 'lutando');
  assert.equal(jogo.round, 2);
  assert.equal(jogo.lados[0].vida, 100);
  assert.equal(jogo.lados[0].pontosRound, 0);
});

test('fim do tempo: vence quem fez mais pontos; empate não dá ponto', () => {
  const { jogo, avancar, eventos } = montar();
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 10 });
  jogo.presente({ usuario: usuario('b'), presente: tiktok, quantidade: 4 });
  avancar(60_000);
  jogo.tick();
  assert.equal(eventos.find((e) => e.nome === 'fimRound').vencedor, 0);
  avancar(5000);
  jogo.tick();
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 3 });
  jogo.presente({ usuario: usuario('b'), presente: tiktok, quantidade: 3 });
  avancar(60_000);
  jogo.tick();
  const fins = eventos.filter((e) => e.nome === 'fimRound');
  assert.equal(fins[1].vencedor, null);
  assert.deepEqual([jogo.lados[0].rounds, jogo.lados[1].rounds], [1, 0]);
});

test('presentes no intervalo ficam guardados e entram no round seguinte sem nocautear', () => {
  const { jogo, avancar } = montar();
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 100 }); // nocaute
  const ev = jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 500 });
  assert.equal(ev.guardado, true);
  assert.equal(jogo.lados[0].pendente, 500);
  avancar(5000);
  jogo.tick();
  assert.equal(jogo.fase, 'lutando');
  assert.equal(jogo.lados[1].vida, 1);
  assert.equal(jogo.lados[0].pontosRound, 500);
  assert.equal(jogo.lados[0].pendente, 0);
});

test('pausar congela o relógio; presentes na pausa entram ao retomar', () => {
  const { jogo, avancar } = montar();
  jogo.iniciar();
  avancar(10_000);
  jogo.pausar();
  avancar(100_000);
  jogo.tick();
  assert.equal(jogo.fase, 'pausado');
  assert.equal(jogo.estado().restanteMs, 50_000);
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 7 });
  assert.equal(jogo.lados[0].pendente, 7);
  jogo.retomar();
  assert.equal(jogo.lados[1].vida, 93);
  assert.equal(jogo.estado().restanteMs, 50_000);
});

test('curtidas de quem tem time viram pontos', () => {
  const { jogo } = montar({ curtidasPorPonto: 30 });
  jogo.iniciar();
  assert.equal(jogo.curtidas({ usuario: usuario('semtime'), quantidade: 100 }), null);
  jogo.comentario({ usuario: usuario('c'), texto: '2' });
  assert.equal(jogo.curtidas({ usuario: usuario('c'), quantidade: 20 }), null);
  const ev = jogo.curtidas({ usuario: usuario('c'), quantidade: 45 });
  assert.equal(ev.golpe, 'jab');
  assert.equal(ev.pontos, 2);
  assert.equal(jogo.lados[1].curtidas, 5);
});

test('curtida de quem tem time começa o round e sempre dá um soquinho visível', () => {
  const { jogo } = montar({ curtidasPorPonto: 10 });
  const soquinhos = [];
  jogo.on('soquinho', (e) => soquinhos.push(e));
  jogo.curtidas({ usuario: usuario('semtime'), quantidade: 5 });
  assert.equal(jogo.fase, 'aguardando', 'sem time não faz nada');
  jogo.comentario({ usuario: usuario('c'), texto: '1' });
  assert.equal(jogo.curtidas({ usuario: usuario('c'), quantidade: 3 }), null);
  assert.equal(jogo.fase, 'lutando');
  assert.deepEqual(soquinhos.map((e) => e.lado), [0]);
  const ev = jogo.curtidas({ usuario: usuario('c'), quantidade: 8 });
  assert.equal(ev.golpe, 'jab');
  assert.equal(ev.pontos, 1);
});

test('curtidas não começam o round se o início automático estiver desligado', () => {
  const { jogo } = montar({ autoIniciar: false });
  jogo.comentario({ usuario: usuario('c'), texto: '1' });
  jogo.curtidas({ usuario: usuario('c'), quantidade: 300 });
  assert.equal(jogo.fase, 'aguardando');
});

test('mapa: pontos conquistam estados, começando pelo estado escolhido no chat', () => {
  const { jogo, eventos } = montar({ pontosPorEstado: 20, vidaMax: 100000 });
  jogo.comentario({ usuario: usuario('ba'), texto: 'BA' });
  jogo.comentario({ usuario: usuario('ba'), texto: '1' });
  jogo.presente({ usuario: usuario('ba'), presente: presente(45), quantidade: 1 });
  const conquistas = eventos.filter((e) => e.nome === 'conquista');
  assert.equal(conquistas.length, 2);
  assert.equal(conquistas[0].uf, 'BA');
  assert.equal(jogo.mapa.BA, 0);
  assert.equal(jogo.lados[0].conquista, 5);
  // um presente enorme toma o Brasil inteiro e para
  jogo.presente({ usuario: usuario('ba'), presente: presente(100000), quantidade: 1 });
  assert.ok(Object.values(jogo.mapa).every((d) => d === 0));
  // o outro lado passa a roubar estados
  jogo.presente({ usuario: usuario('z'), presente: tiktok, quantidade: 40 });
  assert.equal(Object.values(jogo.mapa).filter((d) => d === 1).length, 2);
});

test('sem mapa no tema, sigla de estado não é capturada', () => {
  const { jogo } = montar({}, { mapa: false });
  assert.equal(jogo.comentario({ usuario: usuario('a'), texto: 'SP' }), null);
});

test('ajuste manual positivo e negativo', () => {
  const { jogo } = montar();
  jogo.iniciar();
  jogo.ajustar(0, 30);
  assert.equal(jogo.lados[1].vida, 70);
  jogo.ajustar(0, -10);
  assert.equal(jogo.lados[0].pontosRound, 20);
  assert.equal(jogo.lados[1].vida, 80);
});

test('reiniciar round no intervalo desfaz o ponto do round', () => {
  const { jogo } = montar();
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 200 });
  assert.equal(jogo.lados[0].rounds, 1);
  jogo.reiniciarRound();
  assert.equal(jogo.lados[0].rounds, 0);
  assert.equal(jogo.fase, 'lutando');
  assert.equal(jogo.lados[1].vida, 100);
});

test('salvar e restaurar mantém placar, times e mapa', () => {
  const { jogo } = montar({ pontosPorEstado: 10 });
  jogo.comentario({ usuario: usuario('a'), texto: '2' });
  jogo.presente({ usuario: usuario('a'), presente: presente(25), quantidade: 1 });
  const dados = JSON.parse(JSON.stringify(jogo.serializar()));
  const { jogo: outro } = montar({ pontosPorEstado: 10 });
  assert.equal(outro.restaurar(dados), true);
  assert.equal(outro.fase, 'lutando');
  assert.equal(outro.lados[1].pontosRound, 25);
  assert.equal(outro.lados[0].vida, 75);
  assert.equal(outro.times.get('a'), 1);
  assert.deepEqual(outro.membros, [0, 1]);
  assert.equal(Object.values(outro.mapa).filter((d) => d === 1).length, 2);
  assert.equal(outro.topDoadores(1)[0].pontos, 25);
});

test('não restaura placar de outro tema', () => {
  const { jogo } = montar();
  const dados = jogo.serializar();
  dados.temaId = 'outro';
  assert.equal(jogo.restaurar(dados), false);
});

test('top doadores ordena por pontos', () => {
  const { jogo } = montar({ vidaMax: 100000 });
  jogo.presente({ usuario: usuario('x'), presente: rosa, quantidade: 5 });
  jogo.presente({ usuario: usuario('y'), presente: rosa, quantidade: 50 });
  jogo.presente({ usuario: usuario('x'), presente: rosa, quantidade: 10 });
  assert.deepEqual(jogo.topDoadores(0).map((d) => [d.usuario.id, d.pontos]), [['y', 50], ['x', 15]]);
});

test('mudar as regras no intervalo não "ressuscita" a barra de vida; vale no próximo round', () => {
  const { jogo, avancar } = montar();
  jogo.presente({ usuario: usuario('a'), presente: rosa, quantidade: 100 }); // nocaute
  jogo.definirRegras({ vidaMax: 500 });
  assert.equal(jogo.lados[1].vida, 0);
  avancar(5000);
  jogo.tick();
  assert.equal(jogo.lados[1].vida, 500);
  assert.equal(jogo.lados[1].vidaMax, 500);
});

test('luta automática: mesmo número de socos para cada lado em cada round, sem nomes', () => {
  const { jogo, avancar, eventos } = montar({ lutaAutomatica: true, socosAutomaticosPorRound: 12, duracaoRoundSeg: 60, vidaMax: 1000 });
  jogo.tick(); // começa sozinho
  assert.equal(jogo.fase, 'lutando');
  for (let i = 0; i < 70; i++) {
    avancar(1000);
    jogo.tick();
  }
  const idxFim = eventos.findIndex((e) => e.nome === 'fimRound');
  const auto = eventos.slice(0, idxFim).filter((e) => e.nome === 'ataque' && e.origem === 'automatico');
  const porLado = [0, 1].map((l) => auto.filter((e) => e.lado === l).length);
  assert.equal(porLado[0], 12, `lado 0: ${porLado[0]}`);
  assert.equal(porLado[0], porLado[1], 'os dois lados levam o mesmo número de socos');
  assert.ok(auto.every((e) => e.usuario === null && e.golpe === 'jab'));
  const fim = eventos.find((e) => e.nome === 'fimRound');
  assert.equal(fim.vencedor, null, 'só com socos automáticos o round empata');
});

test('luta automática desligada não soca nada', () => {
  const { jogo, avancar, eventos } = montar({ duracaoRoundSeg: 60 });
  jogo.iniciar();
  for (let i = 0; i < 30; i++) {
    avancar(1000);
    jogo.tick();
  }
  assert.equal(eventos.filter((e) => e.origem === 'automatico').length, 0);
});

test('dano por moeda: 10 rosas tiram 10 × danoPorMoeda de vida', () => {
  const { jogo } = montar({ danoPorMoeda: 3, vidaMax: 300 });
  const ev = jogo.presente({ usuario: usuario('r'), presente: rosa, quantidade: 10 });
  assert.equal(ev.pontos, 30);
  assert.equal(jogo.lados[1].vida, 270);
  assert.equal(ev.golpe, 'soco');
});

test('combo de rosas: o envio que passa de 99 moedas no total solta o golpe especial (uma vez)', () => {
  const { jogo } = montar({ vidaMax: 100000, especialAPartirDe: 99, superAPartirDe: 299 });
  const golpes = [];
  let total = 0;
  for (const delta of [40, 40, 40, 40]) {
    total += delta;
    golpes.push(jogo.presente({ usuario: usuario('c'), presente: rosa, quantidade: delta, quantidadeCombo: total }).golpe);
  }
  assert.deepEqual(golpes, ['soco', 'soco', 'especial', 'soco']);
  // um presente único caro continua soltando super direto
  assert.equal(jogo.presente({ usuario: usuario('c'), presente: presente(300), quantidade: 1 }).golpe, 'super');
});

test('comentar o número do time dá soco (como curtida), com intervalo por pessoa', () => {
  const { jogo, avancar, eventos } = montar({ pontosPorComentario: 1, intervaloComentarioSeg: 2 });
  jogo.palavras = [['13'], ['22']];
  jogo.comentario({ usuario: usuario('a'), texto: '13' }); // entra no time, começa o round e já soca
  assert.equal(jogo.fase, 'lutando');
  assert.equal(jogo.lados[1].vida, 99);
  jogo.comentario({ usuario: usuario('a'), texto: '13 13 13' }); // rápido demais: não conta
  assert.equal(jogo.lados[1].vida, 99);
  avancar(2000);
  jogo.comentario({ usuario: usuario('a'), texto: '13' });
  assert.equal(jogo.lados[1].vida, 98);
  jogo.comentario({ usuario: usuario('b'), texto: '22' });
  assert.equal(jogo.lados[0].vida, 99);
  const socos = eventos.filter((e) => e.nome === 'ataque' && e.origem === 'comentario');
  assert.equal(socos.length, 3);
  assert.ok(socos.every((e) => e.golpe === 'jab'));
});

test('soco por comentário pode ser desligado', () => {
  const { jogo } = montar({ pontosPorComentario: 0 });
  jogo.palavras = [['13'], ['22']];
  jogo.comentario({ usuario: usuario('a'), texto: '13' });
  assert.equal(jogo.lados[1].vida, 100);
});
