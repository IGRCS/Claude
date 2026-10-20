// Gera a arte 3D dos temas (bonecos, retratos e fundo da arena) num navegador sem janela.
//
//   npm i --no-save three@0.169.0 playwright      (só na primeira vez)
//   npm run bonecos3d                            (todos os temas de personagens3d.js)
//   npm run bonecos3d -- eleicao                 (só um)
//
// Saída: temas/<tema>/img/3d/  (<id>-<pose>.png, <id>-retrato.png, fundo.jpg, cabecas.json)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMAS, POSES_3D } from './personagens3d.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };
const servidor = createServer(async (req, res) => {
  try {
    const caminho = join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!caminho.startsWith(raiz)) throw new Error('fora');
    const corpo = await readFile(caminho);
    res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => servidor.once('listening', r));
const porta = servidor.address().port;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Instale antes:  npm i --no-save three@0.169.0 playwright');
  process.exit(1);
}
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server'],
});
const pagina = await navegador.newPage();
pagina.on('pageerror', (e) => console.error('[página]', e.message));
await pagina.goto(`http://127.0.0.1:${porta}/ferramentas/3d/render.html`);
await pagina.waitForFunction(() => window.pronto, null, { timeout: 120_000 });
const salvar = (arquivo, dataUrl) => writeFile(arquivo, Buffer.from(dataUrl.split(',')[1], 'base64'));

const filtro = process.argv.slice(2);
for (const [id, tema] of Object.entries(TEMAS)) {
  if (filtro.length && !filtro.includes(id)) continue;
  const pasta = join(raiz, 'temas', id, 'img', '3d');
  await mkdir(pasta, { recursive: true });
  await salvar(join(pasta, 'fundo.jpg'), await pagina.evaluate((p) => window.renderizar(p), { tipo: 'fundo', tema: id }));
  const cabecas = {};
  for (const lado of [0, 1]) {
    const nome = tema.ids[lado];
    await salvar(join(pasta, `${nome}-retrato.png`), await pagina.evaluate((p) => window.renderizar(p), { tipo: 'retrato', tema: id, lado }));
    for (const pose of POSES_3D) {
      const r = await pagina.evaluate((p) => window.renderizar(p), { tipo: 'sprite', tema: id, lado, pose });
      await salvar(join(pasta, `${nome}-${pose}.png`), r.png);
      if (pose === 'parado') cabecas[lado] = r.cabeca;
    }
    console.log(`✔ ${id}: ${nome}`);
  }
  await writeFile(join(pasta, 'cabecas.json'), JSON.stringify(cabecas) + '\n');
}
await navegador.close();
servidor.close();
