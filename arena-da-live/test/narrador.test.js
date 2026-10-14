import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Narrador, montarFrase, nomeDoPresente } from '../src/narrador.js';
import { nomeParaExibir, contemBloqueada } from '../src/filtro.js';
import { validarTema } from '../src/temas.js';

function montar(falas = {}) {
  let agora = 0;
  const narrador = new Narrador({ relogio: () => agora, aleatorio: () => 0 });
  const tema = validarTema('t', {
    substituicoesNoNome: { flavio: 'Flabio' },
    narrador: { voz: { edge: { voz: 'narr' } }, frases: { inicioRound: ['Round {round}!'], empate: ['Empate!'] } },
    lados: [
      {
        nome: 'LULE',
        voz: { edge: { voz: 'v0' } },
        frases: {
          ataque: ['Valeu, {nome}! Toma, {rival}!', { t: 'Picante do {nome}', picante: true }],
          especial: ['Especial do {nome}!'],
          super: ['Super do {nome}!'],
          vitoria: ['Venci!'],
        },
      },
      { nome: 'FLABIO', frases: { ataque: ['Oi {nome}'], vitoria: ['Ganhei, {rival}!'] } },
    ],
  });
  narrador.configurar({ tema, falas: { ativas: true, picantes: true, intervaloMinimoSeg: 3, falarPresentesAPartirDe: 1, ...falas }, filtro: { nomeSubstituto: 'alguém' } });
  return { narrador, avancar: (ms) => (agora += ms) };
}

const ataque = (extra = {}) => ({
  lado: 0, golpe: 'soco', pontos: 1, quantidade: 1, origem: 'presente',
  usuario: { id: 'u1', nome: 'Ana Paula', apelido: 'ana' }, presente: { nome: 'Rose' }, ...extra,
});

test('montarFrase destaca o nome e mantém o resto', () => {
  const r = montarFrase('Valeu, {nome}! Toma, {rival}!', { nome: 'Ana', rival: 'FLABIO' });
  assert.equal(r.texto, 'Valeu, Ana! Toma, FLABIO!');
  assert.deepEqual(r.partes.filter((p) => p.destaque), [{ t: 'Ana', destaque: true }]);
  assert.equal(montarFrase('Oi {desconhecido}', {}).texto, 'Oi {desconhecido}');
});

test('golpe gera fala com o nome de quem mandou e a voz do lutador', () => {
  const { narrador } = montar();
  const f = narrador.aoAtacar(ataque());
  assert.equal(f.quem, 0);
  assert.equal(f.texto, 'Valeu, Ana Paula! Toma, FLABIO!');
  assert.equal(f.voz.edge.voz, 'v0');
  assert.equal(f.prioridade, 1);
});

test('golpes comuns respeitam o intervalo; especial e super furam a fila', () => {
  const { narrador, avancar } = montar();
  assert.ok(narrador.aoAtacar(ataque()));
  assert.equal(narrador.aoAtacar(ataque({ usuario: { id: 'u2', nome: 'Beto' } })), null);
  const esp = narrador.aoAtacar(ataque({ golpe: 'especial', usuario: { id: 'u3', nome: 'Caio' } }));
  assert.equal(esp.texto, 'Especial do Caio!');
  assert.equal(esp.prioridade, 2);
  assert.equal(narrador.aoAtacar(ataque({ golpe: 'super', usuario: { id: 'u4', nome: 'Duda' } })).prioridade, 3);
  avancar(3100);
  assert.ok(narrador.aoAtacar(ataque({ usuario: { id: 'u5', nome: 'Eva' } })));
});

test('a mesma pessoa não é citada de novo em menos de 12s (combo de rosas)', () => {
  const { narrador, avancar } = montar({ intervaloMinimoSeg: 0 });
  assert.ok(narrador.aoAtacar(ataque()));
  avancar(5000);
  assert.equal(narrador.aoAtacar(ataque()), null);
  avancar(8000);
  assert.ok(narrador.aoAtacar(ataque()));
});

test('modo leve tira as frases picantes', () => {
  const { narrador, avancar } = montar({ picantes: false, intervaloMinimoSeg: 0 });
  for (let i = 0; i < 10; i++) {
    const f = narrador.aoAtacar(ataque({ usuario: { id: `u${i}`, nome: `Pessoa ${i}` } }));
    assert.ok(!f.texto.startsWith('Picante'));
    avancar(100);
  }
});

test('curtidas e falas desligadas não falam', () => {
  const { narrador } = montar({ ativas: false });
  assert.equal(narrador.aoAtacar(ataque()), null);
  const { narrador: n2 } = montar();
  assert.equal(n2.aoAtacar(ataque({ origem: 'curtida', golpe: 'jab' })), null);
});

test('não repete a mesma frase em seguida quando há opções', () => {
  const { narrador, avancar } = montar({ intervaloMinimoSeg: 0 });
  const a = narrador.aoAtacar(ataque({ usuario: { id: 'a', nome: 'Ana' } }));
  avancar(10);
  const b = narrador.aoAtacar(ataque({ usuario: { id: 'b', nome: 'Bia' } }));
  assert.notEqual(a.texto.replace('Ana', ''), b.texto.replace('Bia', ''));
});

test('fim de round: vencedor comemora; empate é do narrador', () => {
  const { narrador } = montar();
  const v = narrador.aoFimRound({ vencedor: 1, round: 2 });
  assert.equal(v.quem, 1);
  assert.equal(v.texto, 'Ganhei, LULE!');
  const e = narrador.aoFimRound({ vencedor: null, round: 2 });
  assert.equal(e.quem, 'narrador');
  assert.equal(narrador.aoNovoRound({ round: 3 }).texto, 'Round 3!');
});

test('filtro de nomes: emojis, risadas, palavrões, acusações e nome real', () => {
  assert.equal(nomeParaExibir({ nome: '🔥Ana🔥 Paula✨' }), 'Ana Paula');
  assert.equal(nomeParaExibir({ nome: 'kkkkkkkk Zé' }), 'kk Zé');
  assert.equal(nomeParaExibir({ nome: 'Fulano Ladrão' }), 'alguém');
  assert.equal(nomeParaExibir({ nome: 'L4DR40 da silva' }), 'alguém');
  assert.equal(nomeParaExibir({ nome: 'Ana', apelido: 'ana_corrupta' }), 'Ana');
  assert.equal(nomeParaExibir({ nome: 'Ana', apelido: 'ana_corrupto' }), 'alguém');
  assert.equal(nomeParaExibir({ nome: 'Cunha Filho' }), 'Cunha Filho', 'palavra curta só bloqueia inteira');
  assert.equal(nomeParaExibir({ nome: '✨✨', apelido: 'joao.silva_10' }), 'joao silva 10');
  assert.equal(nomeParaExibir({ nome: '', apelido: '' }), 'alguém');
  assert.equal(nomeParaExibir({ nome: 'Flávio Santos' }, { substituicoes: { flavio: 'Flabio' } }), 'Flabio Santos');
  assert.equal(nomeParaExibir({ nome: 'Um nome muito comprido demais para falar' }).length <= 22, true);
  assert.equal(contemBloqueada('nove dedos'), true);
});

test('nomes de presentes em inglês viram português', () => {
  assert.equal(nomeDoPresente('Rose'), 'Rosa');
  assert.equal(nomeDoPresente('Lion'), 'Leão');
  assert.equal(nomeDoPresente('Presente Novo'), 'Presente Novo');
});

test('a voz não fala o nome (só o balão mostra), a menos que "falarNome" esteja ligado', () => {
  const { narrador } = montar();
  const f = narrador.aoAtacar(ataque());
  assert.match(f.texto, /Ana Paula/);
  assert.equal(f.falado, 'Valeu! Toma, FLABIO!');
  const { narrador: n2 } = montar({ falarNome: true });
  assert.equal(n2.aoAtacar(ataque()).falado, 'Valeu, Ana Paula! Toma, FLABIO!');
});

test('frase com versão "voz" e áudio gravado', () => {
  const { narrador } = montar();
  const f = narrador.criarFala(0, { t: 'Valeu, {nome}!', voz: 'Valeu, {rival}!', audio: 'audio/L-ataque-01.mp3' }, { nome: 'Bia', rival: 'FLABIO' }, 1);
  assert.equal(f.texto, 'Valeu, Bia!');
  assert.equal(f.falado, 'Valeu, FLABIO!');
  assert.equal(f.gravado, '/temas/t/audio/L-ataque-01.mp3');
  const { narrador: n2 } = montar({ falarNome: true });
  assert.equal(n2.criarFala(0, { t: 'Oi {nome}', audio: 'a.mp3' }, { nome: 'Bia' }, 1).gravado, null, 'com nome falado, o áudio fixo não serve');
});

test('falaSemNome tira o nome de forma natural', async () => {
  const { falaSemNome } = await import('../src/narrador.js');
  assert.equal(falaSemNome('Esse soco é cortesia do {nome}!'), 'Esse soco é cortesia da galera!');
  assert.equal(falaSemNome('Valeu, {nome}! Toma essa!'), 'Valeu! Toma essa!');
  assert.equal(falaSemNome('O {nome} mandou e eu bati!'), 'A galera mandou e eu bati!');
  assert.equal(falaSemNome('{nome}, meu parceiro!'), 'meu parceiro!');
  assert.equal(falaSemNome('Patrocinado pelo {nome}!'), 'Patrocinado pela galera!');
});
