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
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Mensagens da biblioteca (em inglês) -> explicação em português
export function traduzirErro(msg) {
  const m = String(msg ?? '');
  if (/room ?id/i.test(m)) return 'Não encontrei sua live. Confira se o @ está certo e se você já está AO VIVO.';
  if (/rate.?limit|too many|429/i.test(m)) return 'Muitas conexões seguidas: o TikTok/Euler limitou. Espere uns minutos (ou use uma chave da Euler Stream no config.json).';
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
    this.definirStatus(this.estado === 'offline' ? 'offline' : 'reconectando', `${this.detalhe ? this.detalhe + ' — ' : ''}nova tentativa em ${espera}s`);
    this.timer = setTimeout(() => this.abrir(), espera * 1000);
  }

  async conectar() {
    this.ativo = true;
    this.tentativas = 0;
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

    conexao.on(WebcastEvent.GIFT, (d) => {
      if (!minha()) return;
      const p = normalizarPresente(d);
      this.lembrarPresente(p.presente);
      this.emit('presente', p);
    });
    conexao.on(WebcastEvent.CHAT, (d) => minha() && this.emit('comentario', normalizarComentario(d)));
    conexao.on(WebcastEvent.LIKE, (d) => minha() && this.emit('curtida', normalizarCurtida(d)));
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
      this.definirStatus('conectado', `@${this.usuario} (sala ${estado?.roomId ?? '?'})`);
    } catch (erro) {
      if (!minha()) return;
      const nome = erro?.constructor?.name ?? '';
      const msg = erro?.message ?? String(erro);
      if (nome === 'UserOfflineError' || /offline|isn't online|not live/i.test(msg)) {
        this.definirStatus('offline', `@${this.usuario} não está ao vivo agora.`);
        this.agendarReconexao(30);
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
