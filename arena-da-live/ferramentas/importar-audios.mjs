// Coloca os áudios gravados nas frases do tema.
//   npm run importar-audios -- <pasta-com-os-audios> [tema]
// Os arquivos precisam ter o nome igual ao ID do roteiro (ex.: L-ataque-01.mp3, F-super-02.wav).
// Copia para temas/<tema>/audio/ e grava o campo "audio" de cada frase no tema.json.

import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const [origem, temaId = 'eleicao'] = process.argv.slice(2);
if (!origem) {
  console.error('Uso: npm run importar-audios -- <pasta-com-os-audios> [tema]');
  process.exit(1);
}
const EXT = ['.mp3', '.wav', '.ogg', '.m4a'];
const CATS = new Set(['ataque', 'especial', 'super', 'vitoria']);
const arqTema = join(raiz, 'temas', temaId, 'tema.json');
const tema = JSON.parse(await readFile(arqTema, 'utf8'));
await mkdir(join(raiz, 'temas', temaId, 'audio'), { recursive: true });

let ok = 0;
const ignorados = [];
for (const arq of await readdir(origem)) {
  const ext = extname(arq).toLowerCase();
  const id = basename(arq, extname(arq));
  const m = /^([LF])-(\w+)-(\d{2})$/.exec(id);
  if (!EXT.includes(ext) || !m || !CATS.has(m[2])) {
    ignorados.push(arq);
    continue;
  }
  const lado = tema.lados[m[1] === 'L' ? 0 : 1];
  const lista = lado.frases?.[m[2]];
  const n = Number(m[3]) - 1;
  if (!lista || !lista[n]) {
    ignorados.push(`${arq} (não existe essa frase)`);
    continue;
  }
  await copyFile(join(origem, arq), join(raiz, 'temas', temaId, 'audio', `${id}${ext}`));
  const f = typeof lista[n] === 'string' ? { t: lista[n] } : lista[n];
  f.audio = `audio/${id}${ext}`;
  lista[n] = f;
  ok++;
}
await writeFile(arqTema, JSON.stringify(tema, null, 2) + '\n');
console.log(`✔ ${ok} áudio(s) colocados no tema "${temaId}".`);
if (ignorados.length) console.log(`Ignorados: ${ignorados.join(', ')}`);
