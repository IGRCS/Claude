// Gera o roteiro de gravação das falas de um tema (para você produzir uma voz melhor).
//   npm run roteiro                 (tema "eleicao")
//   npm run roteiro -- outro-tema
// Cada fala vira clipes numerados. Falas com {nome} são quebradas em duas partes (antes / depois do nome):
// o nome de quem mandou o presente continua sendo falado pela voz do programa, no meio.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const temaId = process.argv[2] || 'eleicao';
const tema = JSON.parse(await readFile(join(raiz, 'temas', temaId, 'tema.json'), 'utf8'));

const CATEGORIAS = [['ataque', 'GOLPES COMUNS'], ['especial', 'GOLPES ESPECIAIS'], ['super', 'SUPER GOLPES'], ['vitoria', 'VITÓRIA DO ROUND']];
const capitalizar = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const limpar = (s) => s.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();

const manifesto = [];
const saidas = [];
tema.lados.forEach((lado, i) => {
  const prefixo = i === 0 ? 'L' : 'F';
  const rival = capitalizar(tema.lados[1 - i].nome);
  const nomeLado = capitalizar(lado.nome);
  const linhas = [`ROTEIRO DE GRAVAÇÃO — ${lado.nome} (tema ${temaId})`, ''];
  const bloco = [];
  for (const [cat, titulo] of CATEGORIAS) {
    linhas.push('='.repeat(60), titulo, '='.repeat(60), '');
    (lado.frases[cat] ?? []).forEach((f, n) => {
      const bruto = typeof f === 'string' ? f : f.t;
      const picante = typeof f === 'object' && f.picante;
      const texto = bruto.replace(/\{rival\}/g, rival).replace(/\{lutador\}/g, nomeLado);
      const id = `${prefixo}-${cat}-${String(n + 1).padStart(2, '0')}`;
      const partes = texto.split('{nome}');
      if (partes.length > 2) throw new Error(`${id}: mais de um {nome}`);
      const clipes = [];
      if (partes.length === 1) clipes.push({ id, texto: limpar(partes[0]), posicao: 'inteira' });
      else {
        // a pontuação logo depois do nome ("{nome}!") pertence ao nome, não ao clipe seguinte
        const depois = limpar(partes[1].replace(/^[\s!?.,;:]+/, ''));
        if (limpar(partes[0])) clipes.push({ id: `${id}-a`, texto: limpar(partes[0]), posicao: 'antes' });
        if (/\p{L}/u.test(depois)) clipes.push({ id: `${id}-b`, texto: depois, posicao: 'depois' });
      }
      manifesto.push({ id, lado: i, categoria: cat, picante: Boolean(picante), original: bruto, clipes });
      linhas.push(`${id}${picante ? '  (picante)' : ''}`);
      linhas.push(`  Fala completa: ${texto.replace('{nome}', '[NOME]')}`);
      for (const c of clipes) {
        const rot = c.posicao === 'inteira' ? 'CLIPE' : c.posicao === 'antes' ? 'CLIPE (antes do nome)' : 'CLIPE (depois do nome)';
        linhas.push(`  ${rot} ${c.id}: ${c.texto}`);
        bloco.push(c.texto);
      }
      linhas.push('');
    });
  }
  const total = manifesto.filter((m) => m.lado === i).reduce((s, m) => s + m.clipes.length, 0);
  const cab = [
    linhas[0], '',
    `Total: ${manifesto.filter((m) => m.lado === i).length} falas = ${total} clipes de áudio.`,
    'Leia/gere os clipes NESTA ORDEM, com uma pausa de pelo menos 2 segundos entre um clipe e outro,',
    'e sem pausas longas (mais de 1 s) dentro de um mesmo clipe. Detalhes no final deste arquivo.',
    '', ...linhas.slice(2),
  ];
  const rodape = [
    '='.repeat(60), 'COMO GRAVAR E ME ENVIAR', '='.repeat(60), '',
    'OPÇÃO A (um arquivo só): cole o "BLOCO PARA COLAR" abaixo no gerador, com pelo menos 2 segundos de silêncio',
    '  entre os parágrafos, e me mande o áudio inteiro. Eu separo nos silêncios e confiro se deu exatamente',
    `  ${total} clipes; se o número não bater, eu aviso antes de usar.`,
    'OPÇÃO B (vários arquivos): um arquivo por clipe, com o nome igual ao ID (ex.: ' + `${prefixo}-ataque-01-a.mp3).`,
    '',
    'DICAS:',
    '- Os clipes "antes do nome" terminam como se a frase fosse continuar (sem entonação de final). Os "depois" começam',
    '  já no meio da frase. Se o gerador deixar, peça entonação natural de quem vai citar um nome em seguida.',
    '- Se o gerador pronunciar algo errado (ex.: "Flabio", "Lule", "L"), pode reescrever no texto só para a voz',
    '  (ex.: "éle", "Flábio"). Eu uso a ordem/ID dos clipes, não o texto.',
    '- Use uma voz de personagem. Não imite a voz real de nenhum candidato: o TSE proíbe áudio sintético que',
    '  imite a voz de pessoas reais em conteúdo eleitoral.',
    '',
  ];
  const colar = [
    '='.repeat(60), `BLOCO PARA COLAR NO GERADOR DE VOZ (${total} clipes, um por parágrafo, na ordem)`, '='.repeat(60), '',
    ...bloco.flatMap((t) => [t, '']),
  ];
  saidas.push([`${nomeLado.toLowerCase()}.txt`, [...cab, ...rodape, ...colar].join('\n')]);
});

// Bloco único para colar no gerador de voz: um clipe por parágrafo, na ordem do roteiro.
for (const [i, lado] of tema.lados.entries()) {
  const textos = manifesto.filter((m) => m.lado === i).flatMap((m) => m.clipes.map((c) => c.texto));
  const base = capitalizar(lado.nome).toLowerCase();
  saidas.push([`${base}-bloco.txt`, textos.join('\n\n')]);
  saidas.push([`${base}-bloco-com-pausa.txt`, textos.join('\n<break time="1.5s"/>\n')]);
}

await mkdir(join(raiz, 'roteiro'), { recursive: true });
for (const [arq, texto] of saidas) await writeFile(join(raiz, 'roteiro', arq), texto + '\n');
await writeFile(join(raiz, 'roteiro', `manifesto-${temaId}.json`), JSON.stringify(manifesto, null, 2) + '\n');
console.log(`Roteiros em roteiro/: ${saidas.map((s) => s[0]).join(', ')} (+ manifesto-${temaId}.json)`);
console.log(`Falas: ${manifesto.length} | clipes: ${manifesto.reduce((s, m) => s + m.clipes.length, 0)}`);
