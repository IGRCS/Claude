// Limpa o nome de quem mandou presente antes de aparecer no balão e na voz.
// Protege contra apelidos ofensivos (ex.: alguém se chamar "Fulano é ladrão" para o boneco "acusar").

import { normalizarTexto } from './util.js';

export const PALAVRAS_BLOQUEADAS_PADRAO = [
  // palavrões e ofensas
  'porra', 'caralho', 'buceta', 'boceta', 'puta', 'putinha', 'viado', 'veado', 'bicha', 'foder', 'fuder', 'fodase',
  'merda', 'cu', 'cuzao', 'piroca', 'rola', 'xota', 'xoxota', 'punheta', 'boquete', 'arrombado', 'corno',
  'retardado', 'mongol', 'macaco', 'vagabunda', 'vadia', 'prostituta', 'pqp', 'vsf', 'tnc', 'fdp',
  // acusações e ódio que o boneco não deve repetir
  'ladrao', 'ladra', 'bandido', 'corrupto', 'miliciano', 'milicia', 'genocida', 'nazista', 'nazi', 'hitler',
  'fascista', 'facista', 'presidiario', 'cachaceiro', 'estuprador', 'pedofilo', 'assassino', 'traficante',
  'terrorista', 'golpista', 'descondenado', 'lularapio', 'bolsonazi', 'molusco', 'nove dedos', 'bozo',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

function paraComparar(texto) {
  return normalizarTexto(texto)
    .replace(/[01345@$7]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z ]/g, ' ')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function contemBloqueada(texto, bloqueadas = PALAVRAS_BLOQUEADAS_PADRAO) {
  const alvo = paraComparar(texto);
  if (!alvo) return false;
  const palavras = alvo.split(' ');
  const juntas = alvo.replace(/ /g, '');
  return bloqueadas.some((b) => {
    const bb = paraComparar(b);
    if (!bb) return false;
    if (bb.includes(' ')) return alvo.includes(bb);
    // palavras curtas só valem inteiras (evita "cu" em "Cunha")
    if (bb.length <= 4) return palavras.includes(bb);
    return juntas.includes(bb);
  });
}

function limparTexto(texto, max) {
  let t = String(texto ?? '').normalize('NFC');
  t = t.replace(/[^\p{L}\p{N} '\-]/gu, ' '); // tira emojis e símbolos
  t = t.replace(/(\p{L})\1{2,}/gu, '$1$1'); // "kkkkkk" -> "kk"
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > max) {
    const cortado = t.slice(0, max);
    t = cortado.includes(' ') ? cortado.replace(/\s+\S*$/, '') : cortado;
  }
  return t;
}

// Troca palavras inteiras (sem diferenciar acento/maiúscula). Ex.: { "flavio": "Flabio" }
function aplicarSubstituicoes(texto, substituicoes) {
  if (!substituicoes) return texto;
  return texto
    .split(' ')
    .map((palavra) => {
      const chave = normalizarTexto(palavra);
      for (const [de, para] of Object.entries(substituicoes)) {
        if (normalizarTexto(de) === chave) return para;
      }
      return palavra;
    })
    .join(' ');
}

export function nomeParaExibir(usuario, opcoes = {}) {
  const { bloqueadas = PALAVRAS_BLOQUEADAS_PADRAO, substituto = 'alguém', substituicoes = null, max = 22 } = opcoes;
  let nome = limparTexto(usuario?.nome, max);
  if (nome.replace(/[^\p{L}]/gu, '').length < 2) {
    nome = limparTexto(String(usuario?.apelido ?? '').replace(/[._]+/g, ' '), max);
  }
  if (nome.replace(/[^\p{L}\p{N}]/gu, '').length < 2) return substituto;
  if (contemBloqueada(nome, bloqueadas) || contemBloqueada(usuario?.apelido ?? '', bloqueadas)) return substituto;
  return aplicarSubstituicoes(nome, substituicoes);
}
