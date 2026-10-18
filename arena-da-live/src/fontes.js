// De onde vêm os eventos da live:
//  - FonteConector: liga direto no TikTok pela biblioteca tiktok-live-connector (só precisa do seu @)
//  - FonteTikFinity: lê os eventos do TikFinity aberto no mesmo PC (plano B se a primeira falhar)
// As duas emitem: 'presente', 'comentario', 'curtida', 'seguiu', 'compartilhou', 'status'.

import { EventEmitter } from 'node:events';
import {
  normalizarComentario,
  normalizarCurtida,
  normalizarPresente,
  normalizarUsuario,
} from './normalizar.js';

const ESPERAS_RECONEXAO = [5, 10, 20, 40, 60];
// Quando o TikTok/Euler limita, cada tentativa nova conta como mais uma conexão e prolonga o bloqueio.
// Por isso a espera aqui é bem maior e cresce a cada limite seguido.
const ESPERAS_LIMITE = [120, 300, 600];
export const ehLimite = (msg) => /rate.?limit|too many|429/i.test(String(msg ?? ''));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Mensagens da biblioteca (em inglês) -> explicação em português
export function traduzirErro(msg) {
  const m = String(msg ?? '');
  if (/room ?id/i.test(m)) return 'Não encontrei sua live. Confira se o @ está certo e se você já está AO VIVO.';
  if (ehLimite(m)) return 'Muitas conexões seguidas: o TikTok/Euler limitou. Não clique em Conectar de novo: o programa espera sozinho e tenta mais tarde.';
  if (/timeout|timed out/i.test(m)) return 'O TikTok demorou para responder. Confira sua internet.';
  if (/business plan|premium|permission from the signature/i.test(m))
    return 'O servidor gratuito do TikTok (Euler Stream) recusou um recurso pago. Atualize o programa para a versão mais nova ou use o plano B (TikFinity).';
  if (/sign|euler/i.test(m)) return `Falha no servidor de assinatura (Euler Stream): ${m}`;
  if (/ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i.test(m)) return 'Sem internet ou TikTok bloqueado nesta rede.';
  return m;
}

class FonteBase extends EventEmitter {
  constructor() {
    super();
    this.estado = 'desconectado';
    this.detalhe = '';
    this.ativo = false;
    this.timer = null;
    this.tentativas = 0;
    this.limites = 0;
  }

  // Contagem do que chega do TikTok (aparece no painel). Ajuda a saber se a live manda eventos.
  zerarDiagnostico() {
    this.diag = { total: 0, comentarios: 0, curtidas: 0, presentes: 0, entradas: 0, ultimo: 0 };
  }

  contar(tipo, n = 1) {
    if (!this.diag) this.zerarDiagnostico();
    this.diag.total++;
    if (tipo) this.diag[tipo] = (this.diag[tipo] ?? 0) + n;
    this.diag.ultimo = Date.now();
    if (this.estado === 'semEventos') this.definirStatus('conectado', this.detalheConectado ?? '');
  }

  definirStatus(estado, detalhe = '') {
    this.estado = estado;
    this.detalhe = detalhe;
    this.emit('status', { estado, detalhe });
  }

  agendarReconexao(segundos) {
    clearTimeout(this.timer);
    if (!this.ativo) return;
    const espera = segundos ?? ESPERAS_RECONEXAO[Math.min(this.tentativas, ESPERAS_RECONEXAO.length - 1)];
    this.tentativas++;
    const quando = espera >= 120 ? `${Math.round(espera / 60)} min` : `${espera}s`;
    const estado = ['offline', 'limitado'].includes(this.estado) ? this.estado : 'reconectando';
    this.definirStatus(estado, `${this.detalhe ? this.detalhe + ' — ' : ''}nova tentativa em ${quando}`);
    this.timer = setTimeout(() => this.abrir(), espera * 1000);
  }

  async conectar() {
    this.ativo = true;
    this.tentativas = 0;
    this.limites = 0;
    await this.abrir();
  }

  async desconectar() {
    this.ativo = false;
    clearTimeout(this.timer);
    await this.fechar();
    this.definirStatus('desconectado');
  }
}

export class FonteConector extends FonteBase {
  constructor({ usuario, signApiKey }) {
    super();
    this.usuario = String(usuario ?? '').trim().replace(/^@/, '');
    this.signApiKey = signApiKey || undefined;
    this.conexao = null;
    this.catalogo = [];
  }

  async abrir() {
    if (!this.ativo) return;
    if (!this.usuario) {
      this.definirStatus('erro', 'Informe seu @ do TikTok no painel.');
      return;
    }
    await this.fechar();
    let lib;
    try {
      lib = await import('tiktok-live-connector');
    } catch (erro) {
      this.definirStatus('erro', `Biblioteca do TikTok não carregou: ${erro.message}`);
      return;
    }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    const conexao = new TikTokLiveConnection(this.usuario, {
      signApiKey: this.signApiKey,
      // A lista completa de presentes exige plano pago da Euler Stream ("Business plan").
      // O jogo não precisa dela: preço e nome vêm em cada presente. O catálogo é montado conforme chegam.
      enableExtendedGiftInfo: false,
      processInitialData: false,
    });
    this.conexao = conexao;
    const minha = () => this.conexao === conexao;
    this.zerarDiagnostico();
    // qualquer mensagem da live (inclusive entradas e contagem de público) prova que os eventos estão chegando
    conexao.on('decodedData', () => minha() && this.contar());
    conexao.on(WebcastEvent.MEMBER, () => minha() && this.contar('entradas'));

    conexao.on(WebcastEvent.GIFT, (d) => {
      if (!minha()) return;
      const p = normalizarPresente(d);
      this.contar('presentes');
      this.lembrarPresente(p.presente);
      this.emit('presente', p);
    });
    conexao.on(WebcastEvent.CHAT, (d) => {
      if (!minha()) return;
      this.contar('comentarios');
      this.emit('comentario', normalizarComentario(d));
    });
    conexao.on(WebcastEvent.LIKE, (d) => {
      if (!minha()) return;
      const c = normalizarCurtida(d);
      this.contar('curtidas', c.quantidade);
      this.emit('curtida', c);
    });
    conexao.on(WebcastEvent.FOLLOW, (d) => minha() && this.emit('seguiu', { usuario: normalizarUsuario(d) }));
    conexao.on(WebcastEvent.SHARE, (d) => minha() && this.emit('compartilhou', { usuario: normalizarUsuario(d) }));
    conexao.on(WebcastEvent.STREAM_END, () => {
      if (!minha()) return;
      this.definirStatus('offline', 'A live terminou.');
      this.agendarReconexao(30);
    });
    conexao.on(ControlEvent.DISCONNECTED, ({ reason } = {}) => {
      if (!minha() || !this.ativo || this.estado === 'offline') return;
      this.definirStatus('reconectando', `Conexão caiu${reason ? ` (${reason})` : ''}`);
      this.agendarReconexao();
    });
    conexao.on(ControlEvent.ERROR, (erro) => {
      if (!minha()) return;
      const msg = erro?.exception?.message ?? erro?.info ?? String(erro);
      console.warn(`[tiktok] ${msg}`);
    });

    this.definirStatus('conectando', `@${this.usuario}`);
    try {
      const estado = await conexao.connect();
      if (!minha()) {
        conexao.disconnect().catch(() => {});
        return;
      }
      this.tentativas = 0;
      this.limites = 0;
      this.detalheConectado = `@${this.usuario} (sala ${estado?.roomId ?? '?'})`;
      this.definirStatus('conectado', this.detalheConectado);
      // Conectou mas nada chega? Avisa no painel com a causa mais comum.
      clearTimeout(this.timerSilencio);
      this.timerSilencio = setTimeout(() => {
        if (!minha() || this.estado !== 'conectado' || this.diag.total > 0) return;
        this.definirStatus(
          'semEventos',
          'Conectado, mas o TikTok não mandou NENHUM evento em 1 minuto. Causa mais comum: live/perfil restrito a maiores de 18 anos ' +
            '(Configurações e privacidade → desligue a restrição de idade) ou o @ é de outra conta. Se continuar, use o plano B (TikFinity).',
        );
      }, 60_000);
    } catch (erro) {
      if (!minha()) return;
      const nome = erro?.constructor?.name ?? '';
      const msg = erro?.message ?? String(erro);
      if (nome === 'UserOfflineError' || /offline|isn't online|not live/i.test(msg)) {
        this.definirStatus('offline', `@${this.usuario} não está ao vivo agora.`);
        this.agendarReconexao(60);
      } else if (ehLimite(msg)) {
        this.definirStatus('limitado', traduzirErro(msg));
        this.agendarReconexao(ESPERAS_LIMITE[Math.min(this.limites++, ESPERAS_LIMITE.length - 1)]);
      } else {
        this.definirStatus('erro', traduzirErro(msg));
        this.agendarReconexao();
      }
    }
  }

  // catálogo (nome/ID/ícone) montado com os presentes que chegam na live
  lembrarPresente(p) {
    if (!p?.id || !p.nome || this.catalogo.some((g) => g.id === p.id)) return;
    this.catalogo.push({ id: p.id, nome: p.nome, moedas: p.moedas, imagem: p.imagem });
    this.emit('catalogo', this.catalogo);
  }

  async fechar() {
    clearTimeout(this.timerSilencio);
    const c = this.conexao;
    this.conexao = null;
    if (c) {
      try {
        await Promise.race([c.disconnect(), esperar(2000)]);
      } catch {
        // ignorar
      }
    }
  }
}

// TikFinity (https://tikfinity.zerody.one) manda os eventos por WebSocket no formato antigo da biblioteca.
export class FonteTikFinity extends FonteBase {
  constructor({ url }) {
    super();
    this.url = url || 'ws://localhost:21213/';
    this.ws = null;
  }

  async abrir() {
    if (!this.ativo) return;
    await this.fechar();
    const WS = globalThis.WebSocket ?? (await import('ws')).default;
    this.definirStatus('conectando', this.url);
    let ws;
    try {
      ws = new WS(this.url);
    } catch (erro) {
      this.definirStatus('erro', erro.message);
      this.agendarReconexao();
      return;
    }
    this.ws = ws;
    const minha = () => this.ws === ws;
    this.zerarDiagnostico();
    ws.onopen = () => {
      if (!minha()) return;
      this.tentativas = 0;
      this.definirStatus('conectado', `TikFinity (${this.url})`);
    };
    ws.onmessage = (msg) => {
      if (!minha()) return;
      let pacote;
      try {
        pacote = JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString());
      } catch {
        return;
      }
      const d = pacote?.data ?? {};
      const tipos = { gift: 'presentes', chat: 'comentarios', like: 'curtidas', member: 'entradas' };
      this.contar(tipos[pacote?.event], pacote?.event === 'like' ? normalizarCurtida(d).quantidade : 1);
      switch (pacote?.event) {
        case 'gift': return this.emit('presente', normalizarPresente(d));
        case 'chat': return this.emit('comentario', normalizarComentario(d));
        case 'like': return this.emit('curtida', normalizarCurtida(d));
        case 'follow': return this.emit('seguiu', { usuario: normalizarUsuario(d) });
        case 'share': return this.emit('compartilhou', { usuario: normalizarUsuario(d) });
        case 'social': {
          const tipo = String(d.displayType ?? d.label ?? '').toLowerCase();
          if (tipo.includes('follow')) return this.emit('seguiu', { usuario: normalizarUsuario(d) });
          if (tipo.includes('share')) return this.emit('compartilhou', { usuario: normalizarUsuario(d) });
          return undefined;
        }
        default: return undefined;
      }
    };
    ws.onerror = () => {
      if (minha()) this.definirStatus('erro', 'Não achei o TikFinity. Ele está aberto e conectado na sua live?');
    };
    ws.onclose = () => {
      if (!minha()) return;
      this.ws = null;
      if (this.ativo) this.agendarReconexao();
    };
  }

  async fechar() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignorar
      }
    }
  }
}
