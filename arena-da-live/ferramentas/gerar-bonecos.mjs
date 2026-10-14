// Gera os PNGs dos lutadores desenhados por código.
//
//   npm i --no-save @resvg/resvg-js     (só na primeira vez)
//   npm run bonecos                     (todos)
//   npm run bonecos -- lule flabio      (só alguns)
//   npm run bonecos -- --svg            (também salva o .svg ao lado)

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desenharBoneco, NOMES_POSES } from './bonecos.mjs';
import { PERSONAGENS } from './personagens.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const salvarSvg = args.includes('--svg');
const filtro = args.filter((a) => !a.startsWith('--'));

let Resvg;
try {
  ({ Resvg } = await import('@resvg/resvg-js'));
} catch {
  console.error('Para gerar PNG instale antes:  npm i --no-save @resvg/resvg-js');
  process.exit(1);
}

const lista = PERSONAGENS.filter((p) => filtro.length === 0 || filtro.includes(p.id));
for (const def of lista) {
  const pasta = join(raiz, 'temas', def.tema, 'img');
  await mkdir(pasta, { recursive: true });
  for (const pose of NOMES_POSES) {
    const svg = desenharBoneco(def, pose);
    const png = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
    await writeFile(join(pasta, `${def.id}-${pose}.png`), png);
    if (salvarSvg) await writeFile(join(pasta, `${def.id}-${pose}.svg`), svg);
  }
  console.log(`✔ ${def.id}: ${NOMES_POSES.length} poses em temas/${def.tema}/img/`);
}
