import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarPresente,
  normalizarComentario,
  normalizarCurtida,
  RastreadorDeCombos,
} from '../src/normalizar.js';

test('presente no formato novo da biblioteca (v2 / proto v3)', () => {
  const ev = normalizarPresente({
    user: { id: '123', displayId: 'ana_1', nickname: 'Ana 🌸' },
    giftId: '5655',
    gift: { name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['http://x/rose.png'] } },
    repeatCount: 3,
    repeatEnd: 1,
    groupId: 'g1',
  });
  assert.equal(ev.usuario.id, '123');
  assert.equal(ev.usuario.apelido, 'ana_1');
  assert.equal(ev.usuario.nome, 'Ana 🌸');
  assert.deepEqual(ev.presente, { id: '5655', nome: 'Rose', moedas: 1, imagem: 'http://x/rose.png', tipo: 1 });
  assert.equal(ev.repeatCount, 3);
  assert.equal(ev.repeatEnd, true);
  assert.equal(ev.groupId, 'g1');
});

test('presente no formato do TikFinity (formato antigo)', () => {
  const ev = normalizarPresente({
    uniqueId: 'joao', nickname: 'João', userId: '9', giftId: 5269, giftName: 'TikTok',
    diamondCount: 1, giftType: 1, repeatCount: 2, repeatEnd: false, giftPictureUrl: 'http://x/tt.png',
  });
  assert.equal(ev.usuario.id, '9');
  assert.equal(ev.usuario.nome, 'João');
  assert.equal(ev.presente.id, '5269');
  assert.equal(ev.presente.nome, 'TikTok');
  assert.equal(ev.presente.tipo, 1);
  assert.equal(ev.presente.imagem, 'http://x/tt.png');
  assert.equal(ev.repeatEnd, false);
});

test('usa o catálogo (extendedGiftInfo) quando o presente vem sem preço', () => {
  const ev = normalizarPresente({
    user: { id: '1', nickname: 'X' },
    giftId: '6',
    gift: { diamondCount: 0 },
    extendedGiftInfo: { name: 'Lion', diamond_count: 29999, image: { url_list: ['http://x/lion.png'] } },
  });
  assert.equal(ev.presente.moedas, 29999);
  assert.equal(ev.presente.nome, 'Lion');
  assert.equal(ev.presente.imagem, 'http://x/lion.png');
});

test('comentário e curtida nos dois formatos', () => {
  assert.equal(normalizarComentario({ user: { id: '1' }, content: 'oi' }).texto, 'oi');
  assert.equal(normalizarComentario({ uniqueId: 'a', comment: '2' }).texto, '2');
  assert.equal(normalizarCurtida({ user: { id: '1' }, count: 15 }).quantidade, 15);
  assert.equal(normalizarCurtida({ uniqueId: 'a', likeCount: 7 }).quantidade, 7);
});

const ev = (repeatCount, repeatEnd, extra = {}) => ({
  usuario: { id: 'u1' },
  presente: { id: '5655', tipo: 1, ...extra.presente },
  repeatCount,
  repeatEnd,
  groupId: extra.groupId ?? 'g1',
});

test('combo de rosas conta cada rosa uma vez só', () => {
  const r = new RastreadorDeCombos();
  const deltas = [ev(1, false), ev(2, false), ev(3, false), ev(3, true)].map((e) => r.quantidadeNova(e));
  assert.deepEqual(deltas, [1, 1, 1, 0]);
});

test('se eventos do meio se perdem, o total final continua certo', () => {
  const r = new RastreadorDeCombos();
  assert.equal(r.quantidadeNova(ev(1, false)), 1);
  assert.equal(r.quantidadeNova(ev(5, true)), 4);
});

test('novo combo depois do fim conta de novo', () => {
  const r = new RastreadorDeCombos();
  r.quantidadeNova(ev(2, false));
  r.quantidadeNova(ev(2, true));
  assert.equal(r.quantidadeNova(ev(1, false)), 1);
});

test('presente que não é de combo conta sempre', () => {
  const r = new RastreadorDeCombos();
  const leao = { presente: { id: '6', tipo: 2 }, groupId: '' };
  assert.equal(r.quantidadeNova(ev(1, false, leao)), 1);
  assert.equal(r.quantidadeNova(ev(1, false, leao)), 1);
});

test('tipo desconhecido sem groupId ignora o aviso de fim de sequência', () => {
  const r = new RastreadorDeCombos();
  const x = { presente: { id: '9', tipo: null }, groupId: '' };
  assert.equal(r.quantidadeNova(ev(1, false, x)), 1);
  assert.equal(r.quantidadeNova(ev(1, true, x)), 0);
});

test('combos de pessoas diferentes não se misturam', () => {
  const r = new RastreadorDeCombos();
  assert.equal(r.quantidadeNova(ev(3, false)), 3);
  assert.equal(r.quantidadeNova({ ...ev(2, false), usuario: { id: 'u2' } }), 2);
  assert.equal(r.quantidadeNova(ev(4, false)), 1);
});
