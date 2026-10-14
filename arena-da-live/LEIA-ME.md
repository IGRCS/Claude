# 🥊 Arena da Live

Jogo de luta para live do TikTok: **cada presente do público vira um golpe** do lutador escolhido.
O boneco **fala o nome de quem mandou o presente** numa frase de zoeira, a vida do adversário cai,
tem nocaute, rounds, mapa do Brasil sendo conquistado e ranking de quem mais apoiou.

Vem com 3 temas prontos e troca de personagem com 1 clique:

| Tema | Lado 1 | Lado 2 |
|---|---|---|
| `eleicao` | **LULE** 🔴 (presente: Rosa 🌹) | **FLABIO** 🟢🟡 (presente: TikTok 🎵) |
| `biscoito-vs-bolacha` | BISCOITO | BOLACHA |
| `rubro-negro-vs-alvinegro` | RUBRO-NEGRO | ALVINEGRO |

> ⏰ **Troca automática já configurada:** em **22/10/2026 às 00:00 (horário de Brasília)**, 72h antes do 2º turno,
> o programa sai sozinho do tema da eleição e vai para **Biscoito x Bolacha** — mesmo que você esqueça.
> Dá para mudar a data no painel (seção "Tema").

---

## 1. Instalar (uma vez só)

1. Instale o **Node.js** versão **LTS** (20 ou mais nova): https://nodejs.org/pt
2. Baixe esta pasta inteira (`arena-da-live`) para o seu computador.
3. **Windows:** clique duas vezes em **`iniciar.bat`**.
   **Mac:** clique duas vezes em **`iniciar.command`** (na primeira vez: botão direito → Abrir).
4. Na primeira vez ele instala o que precisa (1–2 minutos). Depois abre o **painel** no navegador sozinho.

Deixe a janela preta aberta enquanto estiver usando. Para fechar: feche a janela (ou Ctrl + C).

## 2. Colocar a tela na live

A tela do jogo fica em **http://localhost:3000/overlay** (tamanho **1080 × 1920**, vertical).

**OBS Studio**
1. Fontes → `+` → **Navegador**.
2. URL: `http://localhost:3000/overlay` — Largura **1080**, Altura **1920**.
3. Marque **"Controlar áudio pelo OBS"** (é por aí que sai a voz dos bonecos e os sons de soco).
4. Coloque sua **câmera por cima** da moldura "SUA CÂMERA AQUI" (no canto de baixo).

**TikTok LIVE Studio**
1. Adicionar fonte → **Link** (ou "Navegador") → cole `http://localhost:3000/overlay`, tamanho 1080 × 1920.
2. Se o som da voz não sair, ative a captura do **áudio do computador** no LIVE Studio.

> Dica: `http://localhost:3000/overlay?fundo=0` deixa o fundo transparente (se quiser seu próprio fundo).

**Fique na câmera narrando!** Live só com o jogo rodando sozinho pode perder a monetização no TikTok
(regra de "conteúdo automatizado/não original").

## 3. Conectar na sua live

1. Comece a live no TikTok.
2. No painel, seção **"1. Conectar na live"**: digite seu **@** (sem o @ mesmo) e clique **Conectar**.
3. O selo no topo fica verde: **"TikTok: conectado"**. Se a conexão cair, ele tenta de novo sozinho.

**Plano B:** se a conexão direta não funcionar, abra o **TikFinity** (https://tikfinity.zerody.one),
conecte ele na sua live, e no painel escolha **"Pelo TikFinity aberto no PC"** → Conectar.

## 4. Como o público joga

| O que o público faz | O que acontece |
|---|---|
| Manda o presente do lado (ex.: **Rosa** = LULE, **TikTok** = FLABIO) | Soco do lutador, dano no rival, e a pessoa entra no time |
| Comenta **1** ou **2** (ou o nome do lutador, ex.: `lule`, `#flabio`) | Entra no time. A partir daí **qualquer presente** dela ajuda esse lado |
| Manda presente de **99+ moedas** de uma vez | **Golpe especial** (tela treme) |
| Manda presente de **299+ moedas** de uma vez | **SUPER GOLPE** com anúncio na tela |
| Dá **curtidas** (já tendo time) | A cada 30 curtidas, 1 ponto (soquinho) |
| Comenta a **sigla do estado** (ex.: `BA`, `SP`) | Os pontos dela conquistam esse estado no mapa primeiro |

- Cada **moeda = 1 ponto = 1 de dano**. Vida de cada lutador: 300. Round: 3 minutos.
- Zerou a vida → **NOCAUTE**. Acabou o tempo → vence quem fez mais pontos no round.
- Presente de quem ainda não escolheu lado vai para **quem está perdendo** (dá para mudar no painel).
- Tudo isso é ajustável no painel, seção **"5. Regras"**.

## 5. Falas e voz dos bonecos

Quando chega um presente, o lutador do lado **fala uma frase com o nome da pessoa** (balão + voz). Ex.:
*"Cadê a picanha, LULE? O **Carlos** cansou de esperar!"* ou *"Esse soco o Banco Master não cobre! Valeu, **Ana**!"*

- A voz usa as **vozes neurais do Microsoft Edge** (grátis, precisa de internet). Se falhar, usa a do **Google Tradutor**.
  Se as duas falharem, o balão aparece mesmo assim. Teste no painel: **"Testar voz"**.
- **Piadas picantes** (Banco Master, tornozeleira, INSS, rachadinha…) podem ser desligadas com 1 clique:
  painel → "4. Falas e voz" → desmarque **"Piadas picantes"**. Ficam só as leves (picanha, Faz o L, arregão, 6x1…).
- Nomes de quem manda presente são **limpos** antes de aparecer/falar: emojis saem, e apelidos com palavrão
  ou acusação (ex.: "Fulano Ladrão") viram **"alguém"**. A lista fica em `config.json` → `filtro.palavrasBloqueadas`.
- No tema da eleição, se alguém se chamar "Flávio" ou "Lula", o boneco fala "Flabio"/"Lule" (`substituicoesNoNome`).

## 6. Testar sem estar ao vivo

Painel → **"6. Testar sem live"**: botões de presente pequeno, médio, especial, super, curtidas, e
**"▶ Simulação automática"** (uma live falsa rodando sozinha). Ótimo para ajustar o OBS antes.

## 7. Trocar personagens, frases e presentes

Cada tema é uma pasta em `temas/` com um arquivo **`tema.json`** e as imagens em `img/`.

**Trocar só as imagens:** substitua os PNGs mantendo os nomes (ex.: `temas/eleicao/img/lule-parado.png`).
- Formato: **PNG com fundo transparente**, de preferência **600 × 760**, personagem **olhando para a DIREITA**
  (o programa espelha sozinho o lutador da direita).
- Poses: `parado`, `soco`, `especial`, `apanhando`, `nocaute`, `vitoria`. Só a **`parado` é obrigatória**:
  se faltar alguma, ele usa a `parado` com animação.

**Criar um tema novo:** copie a pasta `biscoito-vs-bolacha`, renomeie (sem espaços), edite o `tema.json`
e clique **"Recarregar"** no painel. No `tema.json` você muda: nomes, cores, presentes de cada lado
(`nomes` e `ids`), palavras do chat, vozes e todas as frases.

**Frases:** use os marcadores `{nome}` (quem mandou), `{rival}`, `{lutador}`, `{presente}`, `{qtd}`.
Para marcar uma frase como picante: `{ "t": "Texto com {nome}", "picante": true }`.

**Descobrir o nome/ID certo de um presente:** a tabela **"Últimos presentes recebidos"** no painel mostra
o nome e o ID de tudo que chega. Coloque em `"presentes": [{ "nomes": [...], "ids": [...] }]`.

**Vozes disponíveis no Edge (português):** `pt-BR-AntonioNeural` (masculina), `pt-BR-FranciscaNeural`
e `pt-BR-ThalitaMultilingualNeural` (femininas). Mude `tom` (ex.: `-14%`) e `velocidade` (ex.: `+10%`).

**Bonecos desenhados por código:** os PNGs atuais foram gerados por `ferramentas/gerar-bonecos.mjs`
a partir de `ferramentas/personagens.mjs` (cores, cabelo, barba, camisa…). Para gerar de novo:
`npm i --no-save @resvg/resvg-js` e depois `npm run bonecos`.

## 8. Problemas comuns

| Problema | Solução |
|---|---|
| "Não encontrei sua live" | Você precisa estar **ao vivo** antes de conectar. Confira o @. Espere: ele tenta de novo sozinho. |
| Conecta mas não chegam presentes | Use o **plano B (TikFinity)**. |
| Bonecos não falam | Painel → Testar voz. No OBS marque "Controlar áudio pelo OBS". Veja a linha de status da voz no painel. |
| Num navegador comum aparece "Clique aqui para ativar o som" | Normal (regra dos navegadores). No OBS isso não aparece. |
| "A porta 3000 já está em uso" | Feche a outra janela do programa, ou mude `"porta"` no `config.json`. |
| Quero recomeçar o placar | Painel → "Zerar tudo". |

O placar é salvo sozinho (`dados/estado.json`): se o PC reiniciar, a luta continua de onde parou.

## 9. Cuidados (leia!)

- É um **jogo de humor** com personagens fictícios. Mantenha o aviso do rodapé ligado
  ("não é pesquisa nem enquete") — a lei eleitoral proíbe enquetes durante a campanha.
- As imagens e vozes são **sintéticas**; o rodapé do tema da eleição já avisa isso (o TSE exige esse aviso em conteúdo eleitoral feito com IA).
- O TSE proíbe publicar conteúdo sintético novo sobre a eleição nas **72h antes** da votação (e nas 24h depois) —
  por isso a troca automática está marcada para 22/10/2026 00:00. Não desligue sem ter certeza.
- O TikTok pode reduzir alcance/monetização de conteúdo político. As piadas picantes citam casos reais
  noticiados — use o modo leve se quiser menos risco. Isto não é orientação jurídica.

## Para quem programa

- `npm test` roda os testes automáticos (regras do jogo, combos, frases, filtros, voz, temas).
- Código: `src/` (servidor, jogo, narrador, voz, conexões), `public/overlay` (tela), `public/painel` (painel).
- A conexão com o TikTok usa a biblioteca não oficial `tiktok-live-connector`; se o TikTok mudar algo,
  atualize com `npm update tiktok-live-connector`.
