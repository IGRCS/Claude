// Lutadores 3D de cada tema. Depois de mudar algo aqui: npm run bonecos3d
export const PERSONAGENS = {
  lule: {
    pele: '#e2a882', porte: 1.12, barriga: 1, nariz: 1.18, rugas: true, queixo: 1.05,
    cabelo: { estilo: 'grisalho-calvo', cor: '#e9e9e6' }, barba: { estilo: 'cheia', cor: '#f0efea' },
    sobrancelha: '#d8d8d4', sobrancelhaGrossa: true,
    camisa: '#d61f26', detalhe: '#ffffff', emblema: 'estrela', corEmblema: '#ffffff',
    short: '#b0141b', brilhoShort: '#ff9a9a', luva: '#e3162b', punho: '#ffffff', bota: '#f2f2f2', sola: '#b0141b',
  },
  flabio: {
    pele: '#f0c3a0', porte: 1.08, atletico: 1, barriga: 0, nariz: 1.0, queixo: 1.12,
    cabelo: { estilo: 'social', cor: '#2b1d14' }, barba: { estilo: 'sombra', cor: '#3a2a20' },
    sobrancelha: '#2b1d14',
    camisa: '#11a84a', detalhe: '#ffd400', emblema: 'losango', corEmblema: '#1f4fbf', fundoEmblema: '#ffd400',
    short: '#ffd400', brilhoShort: '#fff6b0', luva: '#13a04a', punho: '#ffd400', bota: '#11a84a', sola: '#ffd400',
  },
  rubro: {
    pele: '#a06a48', porte: 1.1, atletico: 1, nariz: 1.08, queixo: 1.1,
    cabelo: { estilo: 'curto', cor: '#151010' }, barba: { estilo: 'sombra', cor: '#151010' },
    sobrancelha: '#151010', sobrancelhaGrossa: true, olhos: '#2a1a10',
    camisa: '#d01f2e', listras: { cor: '#141414', padrao: 'h', largura: 0.07 }, detalhe: '#141414', emblema: 'nenhum',
    short: '#f4f4f4', brilhoShort: '#ffffff', luva: '#d01f2e', punho: '#141414', bota: '#141414', sola: '#d01f2e',
  },
  alvi: {
    pele: '#f0c6a4', porte: 1.04, atletico: 0.8, barriga: 0.3, nariz: 1.05, queixo: 1.05,
    cabelo: { estilo: 'curto', cor: '#5a3b22' }, barba: { estilo: 'sombra', cor: '#5a3b22' },
    sobrancelha: '#4a3020', sobrancelhaGrossa: true,
    camisa: '#f4f4f4', listras: { cor: '#141414', padrao: 'v', largura: 0.06 }, detalhe: '#141414', emblema: 'nenhum',
    short: '#161616', brilhoShort: '#888888', luva: '#1e1e1e', punho: '#ffffff', bota: '#f2f2f2', sola: '#141414',
  },
};

// tema -> lutadores (esquerda, direita) e textos do cenário
export const TEMAS = {
  eleicao: { ids: ['lule', 'flabio'], cores: ['#e0262e', '#12b04f'], telao: 'LULE  VS  FLABIO', logo: 'ARENA DA LIVE' },
  'rubro-negro-vs-alvinegro': { ids: ['rubro', 'alvi'], cores: ['#d01f2e', '#e9e9e9'], telao: 'CLÁSSICO NA ARENA', logo: 'ARENA DA LIVE' },
};

// Tela: 1080x1920. Câmera e posições iguais para fundo e bonecos (as imagens se encaixam).
export const CAMERA = { pos: [0, 1.5, 8.3], alvo: [0, 0.82, 0], fov: 38 };
export const LUTADOR = { x: 0.66, z: 0.3, giro: 0.62 };
// caixa de cada boneco na tela (igual ao .lutador do overlay.css): [x, y, largura, altura]
export const CAIXAS = [[-40, 438, 680, 880], [440, 438, 680, 880]];
export const POSES_3D = ['parado', 'soco', 'especial', 'apanhando', 'nocaute', 'vitoria'];
