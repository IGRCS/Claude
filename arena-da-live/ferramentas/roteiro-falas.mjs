// Gera o roteiro de gravação das falas de um tema (para produzir uma voz melhor fora do programa).
//   npm run roteiro                 (tema "eleicao")
//   npm run roteiro -- outro-tema
// Uma fala = um áudio, sem o nome de quem mandou o presente (o nome aparece só no balão).
// Saída em roteiro/: <lado>.txt (lista com IDs) e <lado>-partes.txt (blocos de até LIMITE caracteres).

import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerFrase, falaSemNome } from '../src/narrador.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const temaId = process.argv[2] || 'eleicao';
const LIMITE = Number(process.env.LIMITE || 500);
const tema = JSON.parse(await readFile(join(raiz, 'temas', temaId, 'tema.json'), 'utf8'));

const CATEGORIAS = [['ataque', 'GOLPES COMUNS'], ['especial', 'GOLPES ESPECIAIS'], ['super', 'SUPER GOLPES'], ['vitoria', 'VITÓRIA DO ROUND']];
const capitalizar = (s) => s.charAt(0) + s.slice(1).toLowerCase();

const manifesto = [];
const arquivos = [];
for (const [i, lado] of tema.lados.entries()) {
  const prefixo = i === 0 ? 'L' : 'F';
  const rival = capitalizar(tema.lados[1 - i].nome);
  const base = capitalizar(lado.nome).toLowerCase();
  const falas = [];
  for (const [cat] of CATEGORIAS) {
    (lado.frases?.[cat] ?? []).forEach((bruto, n) => {
      const f = lerFrase(bruto);
      const texto = (f.voz ?? falaSemNome(f.t)).replace(/\{rival\}/g, rival).replace(/\{lutador\}/g, capitalizar(lado.nome));
      const id = `${prefixo}-${cat}-${String(n + 1).padStart(2, '0')}`;
      falas.push({ id, lado: i, categoria: cat, indice: n, picante: f.picante, texto });
    });
  }
  manifesto.push(...falas);

  // lista com IDs
  const lista = [`ROTEIRO DE GRAVAÇÃO — ${lado.nome} (tema ${temaId}) — ${falas.length} falas`, ''];
  for (const [cat, titulo] of CATEGORIAS) {
    const doGrupo = falas.filter((f) => f.categoria === cat);
    if (!doGrupo.length) continue;
    lista.push(`== ${titulo} ==`);
    for (const f of doGrupo) lista.push(`${f.id}${f.picante ? ' (picante)' : ''}: ${f.texto}`);
    lista.push('');
  }
  arquivos.push([`${base}.txt`, lista.join('\n')]);

  // blocos de até LIMITE caracteres, sem cortar falas
  const partes = [];
  let atual = [];
  const tamanho = (l) => l.map((f) => f.texto).join('\n\n').length;
  for (const f of falas) {
    if (atual.length && tamanho([...atual, f]) > LIMITE) {
      partes.push(atual);
      atual = [];
    }
    atual.push(f);
  }
  if (atual.length) partes.push(atual);
  const txt = partes
    .map((p, n) => `######## ${lado.nome} — PARTE ${n + 1} de ${partes.length} — falas ${p[0].id} até ${p.at(-1).id} (${p.length} falas, ${tamanho(p)} caracteres) ########\n\n${p.map((f) => f.texto).join('\n\n')}\n`)
    .join('\n');
  arquivos.push([`${base}-partes.txt`, txt]);
}

const pasta = join(raiz, 'roteiro');
await rm(pasta, { recursive: true, force: true });
await mkdir(pasta, { recursive: true });
for (const [arq, texto] of arquivos) await writeFile(join(pasta, arq), texto + '\n');
await writeFile(join(pasta, `manifesto-${temaId}.json`), JSON.stringify(manifesto, null, 2) + '\n');
console.log(`Roteiro em roteiro/: ${arquivos.map((a) => a[0]).join(', ')}`);
console.log(`${manifesto.length} falas (${tema.lados.map((l, i) => `${l.nome}: ${manifesto.filter((m) => m.lado === i).length}`).join(', ')})`);
