// Transforma as falas em áudio MP3.
// Motor principal: vozes neurais do Microsoft Edge (grátis, sem chave). Se falhar, usa a voz do Google Tradutor.
// Os dois são serviços não oficiais: se um dia pararem, o balão de fala continua aparecendo normalmente.

import { createHash } from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const VOZ_EDGE_PADRAO = 'pt-BR-AntonioNeural';
const MAX_CACHE = 150;

export function escaparXml(texto) {
  return String(texto).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

// Quebra em pedaços de até `max` caracteres sem cortar palavras (limite do Google).
export function dividirTexto(texto, max = 180) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const pedacos = [];
  let atual = '';
  for (const p of palavras) {
    if ((atual + ' ' + p).trim().length > max && atual) {
      pedacos.push(atual);
      atual = p;
    } else {
      atual = (atual + ' ' + p).trim();
    }
  }
  if (atual) pedacos.push(atual);
  return pedacos.map((p) => p.slice(0, max));
}

async function edgeTts(texto, cfg) {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 7000, synthesisTimeoutMs: 15000 });
  try {
    await tts.setMetadata(cfg.voz || VOZ_EDGE_PADRAO, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escaparXml(texto), {
      pitch: cfg.tom || '+0Hz',
      rate: cfg.velocidade || '+0%',
    });
    const audio = await new Promise((resolve, reject) => {
      const partes = [];
      audioStream.on('data', (d) => partes.push(d));
      audioStream.on('error', reject);
      audioStream.on('end', () => resolve(Buffer.concat(partes)));
      audioStream.on('close', () => resolve(Buffer.concat(partes)));
    });
    if (!audio.length) throw new Error('o Edge devolveu áudio vazio');
    return audio;
  } finally {
    try {
      tts.close();
    } catch {
      // nada a fazer
    }
  }
}

async function googleTts(texto, fetcher) {
  const buffers = [];
  for (const pedaco of dividirTexto(texto, 180)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=${encodeURIComponent(pedaco)}`;
    const resposta = await fetcher(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) throw new Error(`o Google respondeu ${resposta.status}`);
    buffers.push(Buffer.from(await resposta.arrayBuffer()));
  }
  const audio = Buffer.concat(buffers);
  if (!audio.length) throw new Error('o Google devolveu áudio vazio');
  return audio;
}

export class ServicoDeVoz {
  constructor({ obterMotor, edge = edgeTts, google = (t) => googleTts(t, globalThis.fetch), relogio = Date.now, log = console } = {}) {
    this.obterMotor = obterMotor ?? (() => 'auto');
    this.edge = edge;
    this.google = google;
    this.relogio = relogio;
    this.log = log;
    this.cache = new Map();
    this.falhasEdge = 0;
    this.edgePausadoAte = 0;
    this.ultimoMotor = null;
    this.ultimoErro = null;
  }

  status() {
    return {
      motor: this.obterMotor(),
      ultimoMotor: this.ultimoMotor,
      ultimoErro: this.ultimoErro,
      edgePausado: this.relogio() < this.edgePausadoAte,
    };
  }

  // Devolve Promise<{ audio: Buffer, motor } | null>. Pedidos iguais compartilham o mesmo resultado.
  sintetizar(texto, perfil = {}) {
    const motor = this.obterMotor();
    if (!texto || motor === 'desligado' || motor === 'navegador') return Promise.resolve(null);
    const chave = createHash('sha1').update(`${motor}|${JSON.stringify(perfil)}|${texto}`).digest('hex');
    if (this.cache.has(chave)) {
      const p = this.cache.get(chave);
      this.cache.delete(chave);
      this.cache.set(chave, p);
      return p;
    }
    const promessa = this.gerar(texto, perfil, motor).catch((erro) => {
      this.cache.delete(chave);
      this.ultimoErro = erro.message;
      this.log.warn?.(`[voz] Sem áudio para esta fala: ${erro.message}`);
      return null;
    });
    this.cache.set(chave, promessa);
    while (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
    return promessa;
  }

  async gerar(texto, perfil, motor) {
    const tentarEdge = motor === 'edge' || (motor === 'auto' && this.relogio() >= this.edgePausadoAte);
    if (tentarEdge) {
      try {
        const audio = await this.edge(texto, perfil.edge ?? {});
        this.falhasEdge = 0;
        this.ultimoMotor = 'edge';
        this.ultimoErro = null;
        return { audio, motor: 'edge' };
      } catch (erro) {
        this.falhasEdge++;
        this.ultimoErro = `Edge: ${erro.message}`;
        // depois de 2 falhas seguidas, deixa o Edge de lado por 5 minutos (evita atraso em toda fala)
        if (this.falhasEdge >= 2) this.edgePausadoAte = this.relogio() + 5 * 60_000;
        if (motor === 'edge') throw erro;
      }
    }
    if (motor === 'auto' || motor === 'google') {
      try {
        const audio = await this.google(texto);
        this.ultimoMotor = 'google';
        return { audio, motor: 'google' };
      } catch (erro) {
        const doEdge = tentarEdge && this.ultimoErro?.startsWith('Edge:') ? `${this.ultimoErro} | ` : '';
        throw new Error(`${doEdge}Google: ${erro.message}`);
      }
    }
    return null;
  }
}
