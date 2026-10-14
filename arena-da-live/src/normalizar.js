// Converte os eventos do TikTok (biblioteca tiktok-live-connector v2 ou TikFinity)
// para um formato único usado pelo jogo. Os nomes dos campos mudam entre versões,
// por isso cada valor é procurado em vários lugares.

export function primeiraUrl(imagem) {
  if (!imagem) return null;
  if (typeof imagem === 'string') return imagem;
  return imagem.urlList?.[0] ?? imagem.url_list?.[0] ?? imagem.url?.[0] ?? null;
}

function primeiroNumeroPositivo(...valores) {
  for (const v of valores) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function normalizarUsuario(dados) {
  const u = dados?.user ?? dados ?? {};
  const apelido = String(u.uniqueId ?? u.displayId ?? dados?.uniqueId ?? '').trim();
  const id = String(u.userId ?? u.id ?? dados?.userId ?? '').trim() || apelido || 'anonimo';
  const nome = String(u.nickname ?? dados?.nickname ?? apelido ?? '').trim();
  const foto =
    primeiraUrl(u.profilePicture) ?? primeiraUrl(u.avatarThumb) ?? dados?.profilePictureUrl ?? null;
  return { id, apelido, nome: nome || apelido || 'alguém', foto };
}

export function normalizarPresente(dados) {
  const g = dados?.gift ?? dados?.giftDetails ?? {};
  const ext = dados?.extendedGiftInfo ?? {};
  const tipoBruto = g.type ?? g.giftType ?? dados?.giftType ?? ext.type;
  return {
    usuario: normalizarUsuario(dados),
    presente: {
      id: String(dados?.giftId ?? g.id ?? ext.id ?? ''),
      nome: String(g.name || g.giftName || dados?.giftName || ext.name || 'Presente'),
      moedas: primeiroNumeroPositivo(g.diamondCount, g.diamond_count, dados?.diamondCount, ext.diamond_count, ext.diamondCount) || 1,
      imagem:
        primeiraUrl(g.image) ?? primeiraUrl(g.icon) ?? primeiraUrl(g.giftImage) ?? dados?.giftPictureUrl ??
        primeiraUrl(ext.image) ?? primeiraUrl(ext.icon) ?? null,
      tipo: tipoBruto === undefined || tipoBruto === null ? null : Number(tipoBruto),
    },
    repeatCount: Math.max(1, Number(dados?.repeatCount) || 1),
    repeatEnd: dados?.repeatEnd === true || Number(dados?.repeatEnd) === 1,
    groupId: String(dados?.groupId ?? ''),
  };
}

export function normalizarComentario(dados) {
  return { usuario: normalizarUsuario(dados), texto: String(dados?.comment ?? dados?.content ?? '') };
}

export function normalizarCurtida(dados) {
  return { usuario: normalizarUsuario(dados), quantidade: Math.max(1, Number(dados?.likeCount ?? dados?.count) || 1) };
}

// Presentes "em sequência" (tipo 1, ex.: Rosa) chegam várias vezes com repeatCount crescente
// e uma última vez com repeatEnd = true. Aqui só devolvemos a quantidade NOVA de cada evento,
// para o jogo reagir na hora sem contar nada em dobro.
export class RastreadorDeCombos {
  constructor(relogio = Date.now) {
    this.relogio = relogio;
    this.combos = new Map();
  }

  quantidadeNova(ev) {
    const agora = this.relogio();
    this.limpar(agora);
    const tipo = ev.presente.tipo;
    // Tipo desconhecido: só dá para seguir o combo se ele tiver um groupId próprio.
    const emSequencia = tipo === 1 || (tipo === null && ev.groupId !== '' && ev.groupId !== '0');
    if (!emSequencia) {
      // Sem como seguir o combo, o aviso de "fim de sequência" repetiria a contagem.
      if (tipo === null && ev.repeatEnd) return 0;
      return ev.repeatCount;
    }
    const chave = `${ev.usuario.id}|${ev.presente.id}|${ev.groupId}`;
    const anterior = this.combos.get(chave)?.n ?? 0;
    const nova = ev.repeatCount >= anterior ? ev.repeatCount - anterior : ev.repeatCount;
    if (ev.repeatEnd) this.combos.delete(chave);
    else this.combos.set(chave, { n: ev.repeatCount, t: agora });
    return nova;
  }

  limpar(agora) {
    for (const [chave, v] of this.combos) if (agora - v.t > 120_000) this.combos.delete(chave);
  }
}
