# 🥊 Arena da Live

Jogo de luta para live do TikTok: **cada presente do público vira um golpe** do lutador escolhido.
O boneco **fala uma frase de zoeira** (com voz gravada) e o **nome de quem mandou aparece no balão**, a vida do adversário cai,
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

**TikTok LIVE Studio**
1. Adicionar fonte → **Link** (ou "Navegador") → cole `http://localhost:3000/overlay`, tamanho 1080 × 1920.
2. Se o som da voz não sair, ative a captura do **áudio do computador** no LIVE Studio.

> Dica: `http://localhost:3000/overlay?fundo=0` deixa o fundo transparente (se quiser seu próprio fundo).

### Live pelo celular (quando o PC não consegue abrir a live)

O jogo continua rodando no PC; o celular só **mostra a tela do jogo** e o TikTok transmite a tela do celular.
1. PC e celular na **mesma rede Wi-Fi**. Na primeira vez, o Windows pergunta se libera o Node.js na rede:
   marque **Redes privadas** e clique **Permitir acesso**.
2. No painel, card **"1. Conectar na live"** → **"Live pelo celular"**: aparece um endereço tipo
   `http://192.168.0.10:3000/overlay/?celular=1`. Digite ele no **Chrome/Safari do celular**.
3. No celular, **toque na tela** (libera o som e entra em tela cheia).
4. No app do TikTok: **LIVE → Jogos / Transmitir tela** e comece a transmissão. Volte para o navegador com o jogo.
5. Com a live no ar, no painel do PC clique **Conectar**.
- Deixe o celular carregando, com a tela sem apagar sozinha e no modo "Não perturbe".
- Por segurança, pelo celular só abre a **tela** do jogo. O **painel** só funciona no próprio PC.

**Narre a live pelo microfone!** O TikTok exige alguém presente interagindo em tempo real: live só com o
jogo rodando sozinho é marcada como "conteúdo reproduzido/não original" (presentes suspensos e alcance cortado).

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

Quando chega um presente, o lutador do lado **fala uma frase de zoeira** e o balão mostra o nome da pessoa. Ex.:
*"Cadê a picanha, LULE? O **Carlos** cansou de esperar!"* ou *"Esse soco o Banco Master não cobre! Valeu, **Ana**!"*

- **No tema da eleição, as 65 falas dos lutadores já vêm com voz gravada** (33 do LULE e 32 do FLABIO,
  em `temas/eleicao/audio/`). Funciona sem internet.
- O **narrador** (início de round, empate) e os outros temas usam voz sintética: a voz usa as **vozes neurais do Microsoft Edge** (grátis, precisa de internet). Se falhar, usa a do **Google Tradutor**.
  Se as duas falharem, o balão aparece mesmo assim. Teste no painel: **"Testar voz"**.
- **Piadas picantes** (Banco Master, tornozeleira, INSS, rachadinha…) podem ser desligadas com 1 clique:
  painel → "4. Falas e voz" → desmarque **"Piadas picantes"**. Ficam só as leves (picanha, Faz o L, arregão, 6x1…).
- Nomes de quem manda presente são **limpos** antes de aparecer/falar: emojis saem, e apelidos com palavrão
  ou acusação (ex.: "Fulano Ladrão") viram **"alguém"**. A lista fica em `config.json` → `filtro.palavrasBloqueadas`.
- No tema da eleição, se alguém se chamar "Flávio" ou "Lula", o boneco fala "Flabio"/"Lule" (`substituicoesNoNome`).

### Usar uma voz gravada (gerada em outro site)

Por padrão a voz **não fala o nome** de quem mandou o presente: o nome aparece no balão e a voz diz uma
versão da frase sem o nome (assim dá para usar áudios gravados, que não sabem o nome de cada pessoa).
Para o nome voltar a ser falado (com a voz sintética), marque no painel "Falar o nome de quem mandou".

Para trocar a voz pela sua:
1. `npm run roteiro` gera em `roteiro/` a lista de falas de cada lutador com um **ID** por fala
   (ex.: `L-ataque-01`) e versões em partes de até 500 caracteres.
2. Gere **um arquivo de áudio por fala**, com o nome igual ao ID (ex.: `L-ataque-01.mp3`). Use uma voz de
   personagem, nunca a imitação da voz de uma pessoa real.
3. Coloque todos numa pasta e rode `npm run importar-audios -- caminho/da/pasta`. Pronto: as frases que têm
   áudio passam a tocar o arquivo; as que não têm continuam com a voz sintética.

## 6. Testar sem estar ao vivo

- **Barra fixa no topo do painel:** iniciar, pausar, encerrar, reiniciar e a **"▶ Simulação automática"**
  (uma live falsa rodando sozinha).
- **Embaixo da prévia, "Testar golpes (com voz)":** presente em combo, 30 moedas, especial, super, alguém
  comentando 1/2 e curtidas, de cada lado. Você vê e **ouve** o golpe na prévia, com a voz gravada.
- O botão **"🔊 Som da prévia"** liga/desliga o som da prévia. Se a tela do OBS também estiver aberta no mesmo PC
  e você ouvir a voz em dobro, desligue o som da prévia (o OBS continua com som).
- O navegador só libera som depois do primeiro clique na página do painel.
- **"Testar voz"** (seção 4) toca uma das falas gravadas daquele lutador.

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
