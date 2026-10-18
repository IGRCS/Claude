import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FonteConector, ehLimite, traduzirErro } from '../src/fontes.js';

test('limite do TikTok/Euler é reconhecido e traduzido', () => {
  assert.ok(ehLimite('Too many connections started, try again later'));
  assert.ok(ehLimite('Rate limit exceeded'));
  assert.ok(!ehLimite('timeout'));
  assert.match(traduzirErro('429 Too Many Requests'), /limitou/);
});

test('depois de um limite a reconexão espera minutos, não segundos', () => {
  const f = new FonteConector({ usuario: 'x' });
  f.ativo = true;
  f.estado = 'limitado';
  f.detalhe = 'limitou';
  let espera;
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => ((espera = ms), 0);
  try {
    f.agendarReconexao(120);
  } finally {
    globalThis.setTimeout = original;
  }
  assert.equal(espera, 120_000);
  assert.equal(f.estado, 'limitado');
  assert.match(f.detalhe, /2 min/);
});
