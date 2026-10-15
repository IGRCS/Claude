/* global io */
// Painel de controle da Arena da Live.

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const socket = io();
  let info = null;
  let tema = null;

  // ---------------------------------------------------------------- som da prévia
  // A prévia pode tocar as vozes e os sons da luta (para testar sem abrir o OBS).
  let somPrevia = true;
  try { somPrevia = localStorage.getItem('arena:somPrevia') !== '0'; } catch {}
  const iframePrevia = () => $('#previa');
  function enviarSomPrevia() {
    iframePrevia()?.contentWindow?.postMessage({ tipo: 'previa-som', ligado: somPrevia }, location.origin);
  }
  function mostrarSomPrevia() {
    const b = $('#previa-som');
    if (b) {
      b.textContent = somPrevia ? '🔊 Som da prévia: ligado' : '🔇 Som da prévia: desligado';
      b.classList.toggle('ligado', somPrevia);
    }
    const aviso = $('#previa-aviso');
    if (aviso) {
      const dobro = somPrevia && (info?.telasAbertas ?? 0) > 0;
      aviso.hidden = !dobro;
      aviso.textContent = dobro
        ? 'A tela do OBS/LIVE Studio também está aberta. Se ouvir a voz em dobro, desligue o som da prévia.'
        : '';
    }
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.tipo === 'previa-pronta') enviarSomPrevia();
    if (e.data?.tipo === 'previa-som-bloqueado' && somPrevia) toast('Clique em qualquer botão do painel para liberar o som da prévia.');
  });
  // o navegador só libera som depois de um clique na página
  document.addEventListener('pointerdown', () => somPrevia && enviarSomPrevia(), { capture: true });

  // ---------------------------------------------------------------- tela no celular
  let ultimosEnderecos = '';
  function mostrarEnderecosCelular(lista) {
    const chave = lista.join('|');
    if (chave === ultimosEnderecos) return;
    ultimosEnderecos = chave;
    const caixa = $('#enderecos-celular');
    if (!lista.length) {
      caixa.innerHTML = '<p class="dica">PC sem rede Wi-Fi/cabo detectada (ou a opção <code>telaNaRede</code> está desligada no config.json).</p>';
      return;
    }
    caixa.innerHTML = lista
      .map((url, i) => `<div class="linha endereco-celular"><input readonly value="${esc(url)}"><button class="${i ? 'secundario' : 'primario'}" data-copiar="${esc(url)}">Copiar</button></div>`)
      .join('') + (lista.length > 1 ? '<p class="dica">Se o primeiro não abrir no celular, tente o próximo.</p>' : '');
    $$('[data-copiar]', caixa).forEach((b) =>
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(b.dataset.copiar); } catch {}
        toast('Endereço copiado! Mande para o celular ou digite no navegador dele.');
      }),
    );
  }

  // ---------------------------------------------------------------- utilidades
  let toastTimer = null;
  function toast(msg, erro = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('erro', erro);
    t.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visivel'), 2600);
  }

  function cmd(acao, dados) {
    return new Promise((resolve) => {
      socket.timeout(10000).emit('cmd', acao, dados, (erro, r) => {
        if (erro) {
          toast('O servidor não respondeu.', true);
          return resolve({ ok: false });
        }
        if (!r?.ok) toast(r?.erro || 'Algo deu errado.', true);
        resolve(r ?? { ok: false });
      });
    });
  }

  const pegar = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const pad = (n) => String(n).padStart(2, '0');
  function isoParaLocal(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function duracaoTexto(ms) {
    if (ms <= 0) return 'agora';
    const min = Math.floor(ms / 60000);
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    return [d ? `${d}d` : '', h ? `${h}h` : '', `${m}min`].filter(Boolean).join(' ');
  }
  const editando = (el) => document.activeElement === el || el.dataset.sujo === '1';

  // ---------------------------------------------------------------- prévia e link
  const urlOverlay = `${location.origin}/overlay/`;
  $('#url-overlay').value = urlOverlay;
  $('#copiar-url').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(urlOverlay);
    } catch {
      $('#url-overlay').select();
      document.execCommand('copy');
    }
    toast('Endereço copiado!');
  });

  // ---------------------------------------------------------------- preencher dados vindos do servidor
  function statusConexao(c) {
    const chip = $('#status-conexao');
    const nomes = {
      desconectado: 'TikTok: desconectado', conectando: 'TikTok: conectando…', conectado: 'TikTok: conectado',
      reconectando: 'TikTok: reconectando…', offline: 'TikTok: você não está ao vivo', erro: 'TikTok: erro',
    };
    chip.textContent = nomes[c?.estado] ?? `TikTok: ${c?.estado ?? '?'}`;
    chip.className = `chip ${c?.estado === 'conectado' ? 'ok' : c?.estado === 'erro' ? 'erro' : c?.estado === 'desconectado' ? '' : 'alerta'}`;
    $('#conexao-detalhe').textContent = c?.detalhe ?? '';
  }

  function opcoesTemas(select, lista, selecionado, vazio) {
    const atual = editando(select) ? select.value : selecionado;
    select.innerHTML = (vazio ? `<option value="">${esc(vazio)}</option>` : '') +
      lista.map((t) => `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join('');
    select.value = atual ?? '';
  }

  function atualizarAgendamento() {
    if (!info) return;
    const ag = info.agendamento;
    let texto;
    if (!ag.ativa) texto = 'Troca automática desligada.';
    else if (ag.feita) texto = '✔ A troca agendada já aconteceu (ou não era mais necessária).';
    else {
      const falta = new Date(ag.quando).getTime() - Date.now();
      texto = `⏰ Vai trocar para "${info.temas.find((t) => t.id === ag.paraTema)?.nome ?? ag.paraTema}" em ${duracaoTexto(falta)} (${new Date(ag.quando).toLocaleString('pt-BR')}).`;
    }
    $('#ag-status').textContent = texto;
  }
  setInterval(atualizarAgendamento, 1000);

  function preencher(d) {
    info = d;
    mostrarSomPrevia();
    mostrarEnderecosCelular(d.enderecosCelular ?? []);
    statusConexao(d.conexao);
    const usuario = $('#tiktok-usuario');
    if (!editando(usuario)) usuario.value = d.config.tiktok.usuario ?? '';
    const fonte = $('#tiktok-fonte');
    if (!editando(fonte)) fonte.value = d.config.tiktok.fonte ?? 'conector';

    opcoesTemas($('#tema-escolha'), d.temas, d.temaAtivo);
    opcoesTemas($('#ag-de'), d.temas, d.agendamento.deTema, '(qualquer tema)');
    opcoesTemas($('#ag-para'), d.temas, d.agendamento.paraTema);
    $('#avisos-temas').innerHTML = (d.avisosTemas ?? []).map((a) => `<li>${esc(a)}</li>`).join('');

    const agAtiva = $('#ag-ativa');
    if (!editando(agAtiva)) agAtiva.checked = Boolean(d.agendamento.ativa);
    const agQuando = $('#ag-quando');
    if (!editando(agQuando)) agQuando.value = isoParaLocal(d.agendamento.quando);
    atualizarAgendamento();

    for (const el of $$('[data-config]')) {
      if (editando(el)) continue;
      const valor = pegar(d.config, el.dataset.config);
      if (el.type === 'checkbox') el.checked = Boolean(valor);
      else el.value = valor ?? '';
    }

    const vid = d.config.tela.video ?? {};
    $('#video-status').textContent = vid.arquivo
      ? `Vídeo atual: ${vid.arquivo}${vid.ativo ? '' : ' (escondido)'}`
      : 'Nenhum vídeo enviado.';
    const v = d.voz ?? {};
    $('#voz-status').textContent = v.ultimoMotor
      ? `Última voz gerada por: ${v.ultimoMotor === 'edge' ? 'Microsoft Edge' : 'Google'}${v.ultimoErro ? ` • último erro: ${v.ultimoErro}` : ''}`
      : v.ultimoErro ? `Erro de voz: ${v.ultimoErro}` : 'Nenhuma voz gerada ainda. Clique em "Testar voz".';
    $('#sim-auto').textContent = d.simulacaoAutomatica ? '⏹ Parar simulação automática' : '▶ Simulação automática';
  }

  function nomesLados() {
    if (!tema) return;
    tema.lados.forEach((l, i) => {
      document.documentElement.style.setProperty(`--cor${i}`, l.cor);
      $$(`.nome-lado[data-lado="${i}"]`).forEach((el) => (el.textContent = l.nome));
      ajustarTopo();
      $$(`.nome-lado-botao[data-lado="${i}"]`).forEach((el) => (el.textContent = `Testar voz ${l.nome}`));
    });
  }

  // altura do cabeçalho fixo (a prévia gruda logo abaixo dele)
  const ajustarTopo = () => document.documentElement.style.setProperty('--altura-topo', `${$('#cabecalho').offsetHeight + 12}px`);
  addEventListener('resize', ajustarTopo);
  ajustarTopo();

  function resumo(e) {
    if (!tema) return;
    const fasesTopo = { aguardando: 'aguardando 1º presente', lutando: 'lutando', pausado: '⏸ pausado', intervalo: 'intervalo' };
    const st = Math.ceil((e.restanteMs || 0) / 1000);
    $('#resumo-topo').innerHTML = `<span style="color:${esc(tema.lados[0].cor)}">${esc(tema.lados[0].nome)} ${e.lados[0].pontosRound}</span> × <span style="color:${esc(tema.lados[1].cor)}">${e.lados[1].pontosRound} ${esc(tema.lados[1].nome)}</span> · R${e.round} · ${pad(Math.floor(st / 60))}:${pad(st % 60)} · ${fasesTopo[e.fase] ?? e.fase}`;
    const fases = { aguardando: 'aguardando', lutando: 'lutando', pausado: 'pausado', intervalo: 'intervalo' };
    const s = Math.ceil((e.restanteMs || 0) / 1000);
    const lado = (i) => `<div class="lado-resumo"><b style="color:${esc(tema.lados[i].cor)}">${esc(tema.lados[i].nome)}</b><span class="pts">${e.lados[i].pontosRound}<small> pts</small></span><span class="mini">❤ ${e.lados[i].vida} · 🏆 ${e.lados[i].rounds} · 👥 ${e.lados[i].membros}</span></div>`;
    $('#resumo-luta').innerHTML = `${lado(0)}<div class="meio-resumo">R${e.round}<span class="relogio">${pad(Math.floor(s / 60))}:${pad(s % 60)}</span><small>${fases[e.fase]}</small></div>${lado(1)}`;
  }

  function addLog(item, noTopo) {
    const tr = document.createElement('tr');
    tr.innerHTML = [item.hora, item.usuario, item.presente, item.id, item.moedas, item.quantidade, item.lado, item.pontos]
      .map((v) => `<td>${esc(v)}</td>`).join('');
    const corpo = $('#log');
    if (noTopo) corpo.prepend(tr);
    else corpo.append(tr);
    while (corpo.children.length > 60) corpo.lastChild.remove();
  }

  // ---------------------------------------------------------------- ações
  $$('[data-cmd]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.confirmar && !confirm(b.dataset.confirmar)) return;
      const acao = b.dataset.cmd;
      let dados;
      if (acao === 'conectar') {
        dados = { usuario: $('#tiktok-usuario').value, fonte: $('#tiktok-fonte').value };
        delete $('#tiktok-usuario').dataset.sujo;
        delete $('#tiktok-fonte').dataset.sujo;
        if (dados.fonte === 'conector' && !dados.usuario.trim()) return toast('Digite seu @ do TikTok primeiro.', true);
      }
      const r = await cmd(acao, dados);
      if (r.ok) toast('Feito!');
    }),
  );

  $$('[data-ajuste]').forEach((b) =>
    b.addEventListener('click', () => cmd('ajustar', { lado: Number(b.dataset.ajuste), pontos: Number(b.dataset.pontos) })),
  );

  $('#ativar-tema').addEventListener('click', async () => {
    const id = $('#tema-escolha').value;
    if (!confirm('Trocar de tema zera o placar. Continuar?')) return;
    const r = await cmd('ativarTema', { id });
    if (r.ok) toast('Tema ativado!');
  });

  $('#salvar-agendamento').addEventListener('click', async () => {
    const quando = $('#ag-quando').value;
    if (!quando) return toast('Escolha a data e a hora.', true);
    const r = await cmd('salvarAgendamento', {
      ativa: $('#ag-ativa').checked,
      quando: new Date(quando).toISOString(),
      deTema: $('#ag-de').value,
      paraTema: $('#ag-para').value,
    });
    for (const id of ['#ag-ativa', '#ag-quando', '#ag-de', '#ag-para']) delete $(id).dataset.sujo;
    if (r.ok) toast('Agendamento salvo!');
  });

  async function tocarTeste(r) {
    if (r.motor === 'desligado') return toast('A voz está desligada (só balão).');
    if (somPrevia) return toast(r.telasAbertas > 0 ? 'Tocando na prévia e na tela do OBS/LIVE Studio.' : 'Tocando na prévia.');
    if (r.telasAbertas > 0) return toast('Tocando na tela do OBS/LIVE Studio.');
    if (r.gravado) {
      try {
        await new Audio(r.gravado).play();
        return toast('Tocando aqui no painel (voz gravada).');
      } catch {
        return toast('Não consegui tocar o áudio gravado.', true);
      }
    }
    if (r.motor === 'navegador') {
      const u = new SpeechSynthesisUtterance(r.texto);
      u.lang = 'pt-BR';
      u.pitch = Number(r.perfil?.navegador?.tom ?? 1);
      u.rate = Number(r.perfil?.navegador?.velocidade ?? 1);
      speechSynthesis.speak(u);
      return toast('Tocando aqui no painel (a tela do OBS não está aberta).');
    }
    try {
      const resp = await fetch(r.audio);
      if (!resp.ok) throw new Error();
      const audio = new Audio(URL.createObjectURL(await resp.blob()));
      if (resp.headers.get('X-Motor-Voz') === 'google') {
        audio.preservesPitch = false;
        audio.playbackRate = Number(r.perfil?.google?.taxa ?? 1);
      }
      await audio.play();
      toast('Tocando aqui no painel (a tela do OBS não está aberta).');
    } catch {
      toast('Não consegui gerar a voz. Veja a mensagem de erro abaixo dos botões.', true);
    }
  }
  // ---- vídeo em loop
  $('#video-enviar').addEventListener('click', () => {
    const arquivo = $('#video-arquivo').files[0];
    if (!arquivo) return toast('Escolha um arquivo de vídeo primeiro.', true);
    const barra = $('#video-progresso');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/video');
    xhr.setRequestHeader('x-nome', encodeURIComponent(arquivo.name));
    barra.hidden = false;
    barra.value = 0;
    xhr.upload.onprogress = (e) => e.lengthComputable && (barra.value = (e.loaded / e.total) * 100);
    xhr.onload = () => {
      barra.hidden = true;
      let r = {};
      try { r = JSON.parse(xhr.responseText); } catch { /* resposta inesperada */ }
      if (r.ok) { toast('Vídeo enviado! Já está tocando na tela.'); $('#video-arquivo').value = ''; }
      else toast(r.erro || 'Falha ao enviar o vídeo.', true);
    };
    xhr.onerror = () => { barra.hidden = true; toast('Falha ao enviar o vídeo.', true); };
    xhr.send(arquivo);
  });
  $('#video-remover').addEventListener('click', async () => {
    if (!info?.config.tela.video?.arquivo) return toast('Não há vídeo enviado.', true);
    if (!confirm('Remover o vídeo e voltar para a moldura da câmera?')) return;
    const r = await cmd('removerVideo');
    if (r.ok) toast('Vídeo removido.');
  });

  mostrarSomPrevia();
  $('#previa-som').addEventListener('click', () => {
    somPrevia = !somPrevia;
    try { localStorage.setItem('arena:somPrevia', somPrevia ? '1' : '0'); } catch {}
    enviarSomPrevia();
    mostrarSomPrevia();
    toast(somPrevia ? 'Som da prévia ligado.' : 'Som da prévia desligado.');
  });

  $$('[data-testar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const r = await cmd('testarVoz', { quem: b.dataset.testar });
      if (r.ok) tocarTeste(r);
    }),
  );

  $$('[data-sim]').forEach((b) =>
    b.addEventListener('click', () =>
      cmd('simular', { tipo: b.dataset.sim, lado: Number(b.dataset.lado ?? 0), tamanho: b.dataset.tamanho }),
    ),
  );
  $('#sim-auto').addEventListener('click', () => cmd('simulacaoAutomatica', { ligar: !info?.simulacaoAutomatica }));

  // campos de configuração salvam sozinhos ao mudar
  for (const el of $$('[data-config], #tiktok-usuario, #tiktok-fonte, #ag-ativa, #ag-quando, #ag-de, #ag-para')) {
    el.addEventListener('input', () => (el.dataset.sujo = '1'));
  }
  for (const el of $$('[data-config]')) {
    el.addEventListener('change', async () => {
      const [secao, ...caminho] = el.dataset.config.split('.');
      let valor = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.tipo === 'numero') valor = Number(valor);
      const valores = caminho.reduceRight((acc, chave) => ({ [chave]: acc }), valor);
      const r = await cmd('salvarConfig', { secao, valores });
      delete el.dataset.sujo;
      if (r.ok) toast('Salvo!');
    });
  }

  // ---------------------------------------------------------------- eventos do servidor
  socket.on('connect', () => {
    socket.emit('ola', 'painel');
    const s = $('#status-servidor');
    s.textContent = 'programa rodando';
    s.className = 'chip ok';
  });
  socket.on('disconnect', () => {
    const s = $('#status-servidor');
    s.textContent = 'programa fechado!';
    s.className = 'chip erro';
  });
  socket.on('painel', preencher);
  socket.on('tema', ({ tema: t }) => {
    tema = t;
    nomesLados();
  });
  socket.on('estado', resumo);
  socket.on('conexao', statusConexao);
  socket.on('log', (item) => addLog(item, true));
  socket.on('catalogo', (lista) => {
    if (!lista?.length) return;
    $('#catalogo-conta').textContent = `${lista.length} presentes`;
    $('#catalogo').innerHTML = [...lista]
      .sort((a, b) => a.moedas - b.moedas)
      .map((g) => `<tr><td>${g.imagem ? `<img src="${esc(g.imagem)}" alt="">` : ''}</td><td>${esc(g.nome)}</td><td>${esc(g.id)}</td><td>${esc(g.moedas)}</td></tr>`)
      .join('');
  });
  socket.on('logInicial', (lista) => {
    $('#log').innerHTML = '';
    (lista ?? []).forEach((i) => addLog(i, false));
  });
})();
