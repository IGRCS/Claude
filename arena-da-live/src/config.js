// Configuração geral (config.json na pasta do programa). Quase tudo também muda pelo painel.

import { readFile, writeFile, rename } from 'node:fs/promises';
import { REGRAS_PADRAO } from './jogo.js';
import { PALAVRAS_BLOQUEADAS_PADRAO } from './filtro.js';
import { mesclar } from './util.js';

export const CONFIG_PADRAO = {
  porta: 3000,
  acessoNaRede: false, // true = painel acessível por outros aparelhos da mesma rede (sem senha!)
  tiktok: {
    usuario: '', // seu @ do TikTok, sem o @
    fonte: 'conector', // 'conector' (direto) | 'tikfinity' (usa o TikFinity aberto no PC)
    conectarAoIniciar: false,
    signApiKey: '', // opcional: chave da Euler Stream, se o TikTok limitar as conexões
    tikfinityUrl: 'ws://localhost:21213/',
  },
  temaAtivo: 'eleicao',
  trocaAgendada: {
    ativa: true,
    quando: '2026-10-22T00:00:00-03:00', // 72h antes do 2º turno (25/10)
    deTema: 'eleicao',
    paraTema: 'biscoito-vs-bolacha',
    feita: false,
  },
  regras: REGRAS_PADRAO,
  falas: {
    ativas: true,
    picantes: true, // false = só as piadas leves
    intervaloMinimoSeg: 3, // tempo mínimo entre falas do mesmo lutador (golpes comuns)
    falarPresentesAPartirDe: 1, // pontos mínimos de um envio comum para o boneco falar
    maxFila: 4,
  },
  voz: {
    motor: 'auto', // 'auto' (Edge e, se falhar, Google) | 'edge' | 'google' | 'navegador' | 'desligado'
    volume: 0.9,
  },
  som: { efeitos: true, volume: 0.6 },
  tela: {
    mostrarMapa: true,
    mostrarCamera: true,
    mostrarAviso: true,
    // vídeo em loop dentro da moldura da câmera (enviado pelo painel)
    video: { ativo: false, arquivo: '', versao: 0, ajuste: 'cobrir', som: false },
  },
  filtro: {
    nomeSubstituto: 'alguém',
    palavrasBloqueadas: PALAVRAS_BLOQUEADAS_PADRAO,
  },
};

export class Config {
  constructor(caminho) {
    this.caminho = caminho;
    this.dados = structuredClone(CONFIG_PADRAO);
    this.salvando = Promise.resolve();
  }

  async carregar() {
    try {
      const texto = (await readFile(this.caminho, 'utf8')).replace(/^﻿/, '');
      this.dados = mesclar(CONFIG_PADRAO, JSON.parse(texto));
    } catch (erro) {
      if (erro.code !== 'ENOENT') {
        console.error(`[config] Não consegui ler ${this.caminho}: ${erro.message}. Usando o padrão.`);
      }
      this.dados = structuredClone(CONFIG_PADRAO);
    }
    await this.salvar();
    return this.dados;
  }

  // Grava num arquivo temporário e troca, para não corromper se o PC desligar no meio.
  salvar() {
    this.salvando = this.salvando.then(async () => {
      const tmp = `${this.caminho}.tmp`;
      await writeFile(tmp, JSON.stringify(this.dados, null, 2) + '\n', 'utf8');
      await rename(tmp, this.caminho);
    }).catch((erro) => console.error(`[config] Erro ao salvar: ${erro.message}`));
    return this.salvando;
  }

  atualizar(secao, valores) {
    if (secao) this.dados[secao] = mesclar(this.dados[secao] ?? {}, valores);
    else this.dados = mesclar(this.dados, valores);
    return this.salvar();
  }
}
