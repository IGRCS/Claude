import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarTemas, validarTema, POSES } from '../src/temas.js';

const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', 'temas');
const { temas, avisos } = await carregarTemas(PASTA);
const MARCADORES = new Set(['nome', 'rival', 'lutador', 'presente', 'qtd', 'pontos', 'round', 'a', 'b']);
const texto = (f) => (typeof f === 'string' ? f : f.t);

test('os três temas carregam sem avisos e com todas as poses', () => {
  assert.deepEqual(avisos, []);
  assert.deepEqual([...temas.keys()].sort(), ['biscoito-vs-bolacha', 'eleicao', 'rubro-negro-vs-alvinegro']);
  for (const tema of temas.values()) {
    for (const lado of tema.lados) assert.deepEqual(Object.keys(lado.personagem.imagens).sort(), [...POSES].sort());
  }
});

test('todas as frases usam só marcadores conhecidos e são curtas', () => {
  for (const tema of temas.values()) {
    const listas = [
      ...tema.lados.flatMap((l) => Object.values(l.frases)),
      ...Object.values(tema.narrador.frases),
    ];
    for (const lista of listas) {
      for (const f of lista) {
        for (const m of texto(f).matchAll(/\{(\w+)\}/g)) assert.ok(MARCADORES.has(m[1]), `${tema.id}: marcador {${m[1]}} em "${texto(f)}"`);
        assert.ok(texto(f).length <= 110, `${tema.id}: frase longa demais: "${texto(f)}"`);
      }
    }
  }
});

test('frases de golpe sempre citam quem mandou o presente', () => {
  for (const tema of temas.values()) {
    for (const lado of tema.lados) {
      for (const cat of ['ataque', 'especial', 'super']) {
        for (const f of lado.frases[cat]) assert.ok(texto(f).includes('{nome}'), `${tema.id}/${lado.nome}/${cat}: "${texto(f)}"`);
      }
    }
  }
});

test('o tema da eleição nunca fala o nome real dos candidatos', () => {
  const tema = temas.get('eleicao');
  const proibido = /lula|fl[aá]vio|bolsonaro|\bjair\b/i;
  const tudo = [
    tema.titulo, tema.subtitulo, tema.aviso, ...tema.lados.map((l) => l.nome),
    ...tema.lados.flatMap((l) => Object.values(l.frases).flat().map(texto)),
    ...Object.values(tema.narrador.frases).flat().map(texto),
  ];
  for (const t of tudo) assert.doesNotMatch(t, proibido, `"${t}"`);
  assert.ok(tema.lados.every((l) => l.frases.ataque.some((f) => typeof f === 'string')), 'precisa ter frases leves');
});

test('validação aponta erros claros', () => {
  assert.throws(() => validarTema('x', { lados: [{ nome: 'A' }] }), /exatamente 2 lados/);
  assert.throws(() => validarTema('x', { lados: [{ nome: 'A' }, {}] }), /lado 2 precisa de "nome"/);
  const t = validarTema('x', { lados: [{ nome: 'A' }, { nome: 'B' }] });
  assert.ok(t.lados[0].frases.ataque.length > 0, 'frases genéricas quando o tema não traz');
  assert.deepEqual(t.lados[1].palavras, ['2']);
});
