// Configuração geral (config.json na pasta do programa). Quase tudo também muda pelo painel.

import { readFile, writeFile, rename } from 'node:fs/promises';
import { REGRAS_PADRAO } from './jogo.js';
import { PALAVRAS_BLOQUEADAS_PADRAO } from './filtro.js';
import { mesclar } from './util.js';

export const CONFIG_PADRAO = {
  porta: 3000,
  acessoNaRede: false, // true = PAINEL acessível por outros aparelhos da mesma rede (sem senha!)
  telaNaRede: true, // true = só a TELA do jogo pode ser aberta no celular (mesma rede Wi-Fi); o painel continua só no PC
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
    falarNome: false, // true = a voz fala o nome de quem mandou (por voz sintética); false = nome só no balão
    intervaloMinimoSeg: 3, // tempo mínimo entre falas do mesmo lutador (golpes comuns)
    falarPresentesAPartirDe: 1, // pontos mínimos de um envio comum para o boneco falar
    maxFila: 2,
    // O narrador chama pelo nome quem entra num time e quem chega a 10, 25, 50... socos no round.
    chamarNomes: true,
    intervaloChamadasSeg: 8, // no máximo 1 chamada a cada N segundos
    // Live sem ninguém interagindo: o narrador convida a galera (só fala, não mexe no placar)
    convite: true,
    conviteAposSeg: 45, // tempo sem comentário/curtida/presente para convidar
    conviteIntervaloSeg: 90, // e depois repete no máximo a cada N segundos
  },
  voz: {
    motor: 'auto', // 'auto' (Edge e, se falhar, Google) | 'edge' | 'google' | 'navegador' | 'desligado'
    volume: 0.9,
  },
  som: { efeitos: true, volume: 0.6, musica: true, volumeMusica: 0.18 }, // música de batalha baixinha no fundo
  tela: {
    mostrarMapa: true,
    mostrarAviso: true,
    modoDiscreto: false, // tira da tela e das falas as referências diretas a presentes (menos risco de bloqueio)
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
      // padrão antigo de curtidas (30) era lento demais na live: vira 10 uma única vez
      if (!this.dados.migracoes?.curtidas10) {
        if (this.dados.regras?.curtidasPorPonto === 30) this.dados.regras.curtidasPorPonto = 10;
        if (this.dados.falas?.maxFila === 4) this.dados.falas.maxFila = 2; // fila curta = fala no tempo do golpe
        this.dados.migracoes = { ...this.dados.migracoes, curtidas10: true };
      }
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
