import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarTroca, faltaParaTroca } from '../src/agendamento.js';
import { ServicoDeVoz, dividirTexto, escaparXml } from '../src/voz.js';

const ag = { ativa: true, quando: '2026-10-22T00:00:00-03:00', deTema: 'eleicao', paraTema: 'biscoito-vs-bolacha', feita: false };
const quando = Date.parse(ag.quando);

test('troca agendada: só depois do horário e só saindo do tema de origem', () => {
  assert.deepEqual(verificarTroca(ag, 'eleicao', quando - 1), { trocar: false, marcarFeita: false });
  assert.deepEqual(verificarTroca(ag, 'eleicao', quando), { trocar: true, marcarFeita: true, para: 'biscoito-vs-bolacha' });
  assert.deepEqual(verificarTroca(ag, 'rubro', quando + 1), { trocar: false, marcarFeita: true });
  assert.equal(verificarTroca({ ...ag, feita: true }, 'eleicao', quando + 1).trocar, false);
  assert.equal(verificarTroca({ ...ag, ativa: false }, 'eleicao', quando + 1).trocar, false);
  assert.equal(verificarTroca({ ...ag, quando: 'lixo' }, 'eleicao', quando + 1).trocar, false);
  assert.equal(verificarTroca({ ...ag, deTema: '' }, 'qualquer', quando + 1).trocar, true);
});

test('o horário padrão é 72h antes da abertura das urnas do 2º turno', () => {
  const votacao = Date.parse('2026-10-25T08:00:00-03:00');
  assert.ok(votacao - quando >= 72 * 3600 * 1000);
  assert.equal(faltaParaTroca(ag, quando - 5000), 5000);
  assert.equal(faltaParaTroca({ ...ag, feita: true }, 0), null);
});

test('texto da voz: divide em pedaços e escapa XML', () => {
  const longo = 'palavra '.repeat(60).trim();
  const pedacos = dividirTexto(longo, 180);
  assert.ok(pedacos.length > 1 && pedacos.every((p) => p.length <= 180));
  assert.equal(pedacos.join(' '), longo);
  assert.equal(escaparXml('a<b & "c"'), 'a&lt;b &amp; &quot;c&quot;');
});

test('voz automática: se o Edge falha, usa o Google; depois de 2 falhas pausa o Edge', async () => {
  let chamadasEdge = 0;
  let agora = 0;
  const voz = new ServicoDeVoz({
    obterMotor: () => 'auto',
    edge: async () => {
      chamadasEdge++;
      throw new Error('sem internet');
    },
    google: async (t) => Buffer.from(`g:${t}`),
    relogio: () => agora,
    log: { warn() {} },
  });
  const r1 = await voz.sintetizar('um', {});
  assert.equal(r1.motor, 'google');
  assert.equal(r1.audio.toString(), 'g:um');
  await voz.sintetizar('dois', {});
  await voz.sintetizar('tres', {});
  assert.equal(chamadasEdge, 2, 'na terceira fala o Edge já está pausado');
  assert.equal(voz.status().edgePausado, true);
  agora += 6 * 60_000;
  await voz.sintetizar('quatro', {});
  assert.equal(chamadasEdge, 3, 'depois de 5 minutos tenta o Edge de novo');
});

test('voz: pedidos iguais reaproveitam o mesmo áudio; motores desligados não geram nada', async () => {
  let n = 0;
  const voz = new ServicoDeVoz({ obterMotor: () => 'edge', edge: async () => Buffer.from(String(++n)), log: { warn() {} } });
  const [a, b] = await Promise.all([voz.sintetizar('oi', { edge: { voz: 'x' } }), voz.sintetizar('oi', { edge: { voz: 'x' } })]);
  assert.equal(n, 1);
  assert.equal(a, b);
  for (const motor of ['desligado', 'navegador']) {
    const v = new ServicoDeVoz({ obterMotor: () => motor, edge: async () => Buffer.from('x') });
    assert.equal(await v.sintetizar('oi', {}), null);
  }
});

test('voz: se tudo falha, devolve null e guarda o erro (o balão continua aparecendo)', async () => {
  const voz = new ServicoDeVoz({
    obterMotor: () => 'auto',
    edge: async () => { throw new Error('edge fora'); },
    google: async () => { throw new Error('google fora'); },
    log: { warn() {} },
  });
  assert.equal(await voz.sintetizar('oi', {}), null);
  assert.match(voz.status().ultimoErro, /google fora/);
});

test('config padrão não tem mais câmera nem vídeo em loop', async () => {
  const { CONFIG_PADRAO } = await import('../src/config.js');
  assert.equal('video' in CONFIG_PADRAO.tela, false);
  assert.equal('mostrarCamera' in CONFIG_PADRAO.tela, false);
});
