# Customizações do cliente Galene

As customizações vivem **direto na árvore**, em `static/`. Não há arquivos de
patch neste subprojeto: a árvore é a fonte única da verdade, e o diff contra a
tag oficial é o registro do que mudamos (como gerar em
[`UPSTREAM.md`](UPSTREAM.md), seção "Rebase").

Este documento existe porque o diff conta o **o quê**, mas não o **porquê** —
e é o porquê que permite refazer a mudança depois de um rebase, quando o
contexto ao redor já mudou.

| #   | Mudança                                               | Onde                                                     |
| --- | ----------------------------------------------------- | -------------------------------------------------------- |
| 1   | Mantém o `?token=` no refresh                         | `static/galene.js`                                       |
| 2   | Contagem de participantes no painel esquerdo          | `static/galene.js`                                       |
| 3   | Carrega a skin `/indies.css`                          | `static/galene.html`                                     |
| 4   | Marca o tile de compartilhamento de tela              | `static/galene.js`                                       |
| 5   | Layout "palco + faixa" com screenshare                | `static/galene.js` + `indies.css`                        |
| 6   | Avatar do perfil do participante                      | `static/galene.js` + `lib/galene.js`                     |
| 7   | Sai da sala quando o organizador a encerra            | `static/galene.js`                                       |
| 8   | Saída que funciona: reconectar ou voltar              | `static/galene.js`                                       |
| 9   | Escolha do dispositivo de reprodução (saída de áudio) | `static/galene.html` + `static/galene.js` + `indies.css` |
| 10  | Controles do tile respondem de novo                   | `indies.css`                                             |
| 11  | Eco não é desligado pelo rótulo de ruído              | `static/galene.js` + `static/galene.html`                |
| 12  | Tela de entrada: prévia, medidor e dispositivos       | `static/galene.html` + `static/galene.js` + `indies.css` |
| 13  | Áudio da tela atenuado e em mono                      | `static/galene.js`                                       |
| 14  | Volume inicial do tile de tela                        | `static/galene.js`                                       |
| 15  | Barra de controles flutuante + botão "Parar tela"     | `static/galene.html` + `static/galene.js` + `indies.css` |
| 16  | Interface em português (textos do HTML)               | `static/galene.html` + `static/galene.js`                |

Nada de Go do servidor foi alterado — todas são de cliente. As customizações 6
a 8 dependem de contrato com o app (`lib/galene.js`), documentado em cada seção;
a 9 é inteiramente local e a 10 corrige um efeito colateral da skin (customização
3).

## 1. Manter o token de entrada no refresh

**Problema:** ao entrar na sala com `?token=...`, o Galene remove o token da URL
(`history.replaceState`) logo após carregar. Se o participante dá **refresh** na
página, o token não está mais na URL e o Galene mostra a tela de login
(usuário/senha) — inutilizável para salas protegidas apenas por `authKeys`/JWT,
já que não há senha local. Resultado: "softlock" de autorização ao recarregar.

**Solução:** persistir o token no `sessionStorage` no primeiro acesso e
restaurá-lo no `start()` quando a URL não tiver `?token=`. O token é apagado do
`sessionStorage` quando o servidor rejeita a entrada (`fail`), evitando loop de
tentativas com token expirado/revogado.

- `static/galene.js`, 3 pontos: grava `joinToken`, restaura `joinToken`, remove
  `joinToken` no caso `fail`.
- O `sessionStorage` é por aba e some ao fechar a aba: reabrir o link da sala
  volta a funcionar normalmente (token presente na URL).

Comentários no JS foram mantidos sem acentos para não depender de encoding no
arquivo servido.

## 2. Contagem de participantes no painel esquerdo

**Problema:** o texto do painel de usuários (`.galene-header`) fica fixo em
"Galène", porque só o `#title` da barra superior é atualizado por `setTitle`.

**Histórico:** a primeira versão desta customização copiava o `displayName` do
grupo (nome do estúdio) para o `.galene-header`. Isso fazia o nome do estúdio
aparecer **duas vezes na mesma tela** — na barra superior e logo abaixo, no topo
do painel — porque ambos mostram `status.displayName`. Era duplicata, não
informação.

**Solução:** o `setTitle` agora **só** cuida do `#title`. O `.galene-header`
passa a mostrar a contagem de participantes (`Participantes (N)`), atualizada
por `updateUsersHeader()` — chamada quando alguém entra (`addUser`) ou sai
(`delUser`). É a informação que o painel realmente pode dar e o `#title` não.

- `static/galene.js`: `setTitle` (parou de escrever no painel),
  `updateUsersHeader`, e as chamadas em `addUser`/`delUser`/`start`.

## 3. Carregar a skin do Indies Brasil

**Problema:** o CSS do Galene (`galene.css`) é o único carregado, então não há
como aplicar uma skin/overlay local sem editar o CSS do upstream.

**Solução:** adicionar `<link rel="stylesheet" href="/indies.css"/>` logo após o
`galene.css` no `head`. O arquivo `static/indies.css` é copiado para a imagem
pelo `Dockerfile` (não faz parte do upstream).

- `static/galene.html`: a tag `<link>` no `<head>`.

## 4. Marcar o tile de compartilhamento de tela

**Problema:** não há marcador CSS para distinguir o tile de compartilhamento de
tela dos tiles de câmera (o `c.label` fica só em JS; as colunas da grade são
definidas inline por `resizePeers`).

**Solução:** no `setMedia`, quando a stream tem `label === 'screenshare'`, o tile
ganha a classe `peer-screenshare`. O `indies.css` usa essa classe para dar uma
moldura própria ao tile (sem alterar o layout calculado pelo JS).

- `static/galene.js`, em `setMedia` (classe `peer-screenshare`).

## 5. Layout "palco + faixa" com compartilhamento de tela

**Problema:** com o tile de screenshare marcado (mudança 4), a grade
igualitária do Galene ainda trata a tela compartilhada como mais um tile do
mesmo tamanho das câmeras. Em ferramentas comerciais (Teams, Zoom, Discord) o
compartilhamento ganha destaque: vira um "palco" em linha inteira no topo e as
câmeras descem para uma faixa de miniaturas.

**Solução:** o `resizePeers` detecta os tiles `.peer-screenshare` visíveis. Se
houver algum, adiciona a classe `has-screenshare` ao `#peers` e delega o cálculo
a `resizePeersScreenshare` (função nova):

1. Lê `row-gap`, `column-gap`, paddings e as variáveis `--thumb-w`/`--thumb-h`
   do `#peers` via `getComputedStyle`;
2. Calcula quantas miniaturas cabem por linha e quantas linhas as câmeras
   visíveis ocupam (`camRows`);
3. Define `height` inline no tile do palco = altura do container − padding −
   altura da faixa (`camRows * (thumbH + rowGap)`), com mínimo de 120px;
4. Limpa os `max-height` inline remanescentes (do caminho de grade
   igualitária), deixando o CSS dimensionar as miniaturas via flex.

Com **mais de uma tela** compartilhada (`screenPeers.length > 1`) o `#peers`
ganha também a classe `has-many-screens` e as telas **dividem o topo em grade**:
até 3 telas em uma única linha; acima disso, colunas/linhas na proporção raiz
quadrada. A reserva da faixa de câmeras é a mesma, então as câmeras continuam
visíveis na parte de baixo (não são empurradas para fora da área). O CSS de
`.has-many-screens` zera o `min-height` fixo do palco (que quebraria o cálculo)
e esconde o selo "Apresentando" repetido.

Sem screenshare o caminho original (grade igualitária) roda intacto — a única
diferença é a declaração de `let peers` movida para o topo da função.

- `static/galene.js`: em `resizePeers` + a função `resizePeersScreenshare`.

O layout em si (flex, `order:-1` no palco, dimensões das miniaturas, selo
"Apresentando") vive no `indies.css` sob `#peers.has-screenshare` — veja
[`static/indies.css`](static/indies.css).

## 6. Avatar do perfil do participante

**Problema:** a lista de participantes mostra só texto
(`elt.textContent = username`), e o cliente do Galene **não tem** nenhum
conceito de avatar — não há `<img>` em lugar nenhum, nem campo no protocolo.

**Solução:** usar o `setdata`, que já existe. `useraction`/`setdata`
(`galene/rtpconn/webclient.go`) aceita **chaves arbitrárias** do próprio usuário
e o servidor replica o mapa `data` a todos os clientes. Cada cliente publica
`{avatar: <url>}` ao entrar e os demais leem `userinfo.data.avatar` no
`setUserStatus`. Como o servidor não opina sobre a chave, **nenhuma linha de Go
foi alterada**.

O avatar chega pela URL de entrada (`?avatar=...&avatarPrefix=...`), e não pelo
JWT, porque o token é individual: cada cliente só lê o próprio. O `avatarPrefix`
acompanha para que os clientes validem o avatar **dos outros**.

**A trava é o ponto crítico.** O `avatarUrl()` do cliente só aceita URL que
comece com o prefixo publicado, e o `sanitizeAvatarUrl()` do app recusa tudo que
não seja do nosso Cloudinary. Sem isso, um participante poderia publicar
`{avatar: "https://rastreador.example.com/pixel.png"}` e **coletar o IP de todo
mundo que está na sala** — o navegador de cada um busca a imagem. O Galene é SFU
e não expõe IP entre participantes, então seria uma regressão de privacidade
introduzida por nós. Sem `CLOUDINARY_CLOUD_NAME` configurado não há avatar algum
(fail-closed), em vez de aceitar qualquer host.

Publica-se **apenas** no `kind === 'join'`: `setdata` sempre dispara um
broadcast de `change` (`UpdateData` → `Joined("change")`), então republicar a
cada `change` entraria em loop infinito.

- `static/galene.js`: `avatarUrl`, `publishAvatar`, `myAvatar`/`avatarPrefix`,
  `setUserStatus` (insere o `<img>` antes do nome), `start()` (lê os parâmetros).
- `lib/galene.js`: `getAvatarPrefix`, `sanitizeAvatarUrl`, e os parâmetros na
  URL de entrada.
- `static/indies.css`: `.user-avatar`.
- `deploy/nginx/meet.https.conf`: `https://res.cloudinary.com` no `img-src` da
  CSP — sem isso o navegador bloqueia a imagem em silêncio.

## 7. Sair da sala quando o organizador encerra a reunião

**Problema:** encerrar uma reunião precisa **expulsar** quem está dentro, e o
Galene não tem "expulsar todos" — conferido contra a tag 1.2.1:

| Caminho                              | Por que não serve                                        |
| ------------------------------------ | -------------------------------------------------------- |
| `group.Delete` (`deleteUnlocked`)    | Desiste se `len(g.clients) != 0`                         |
| `DELETE /galene-api/v0/.groups/<g>/` | `DeleteDescription` apaga só o **arquivo**               |
| `desc.Expires`                       | Lido só em `AddClient` → barra entrada, não tira ninguém |

O único mecanismo que alcança quem já está conectado é `groupaction lock`
(`webclient.go` → `SetLocked`), que exige `op` e é aplicado ao grupo do próprio
cliente — por isso o app entra na sala como moderador para trancá-la
(`lib/galene.js` → `lockRoom`, com token efêmero que carrega `op` e nunca é
entregue a ninguém).

**Solução no cliente:** o parceiro do `lock`. `SetLocked` empurra
`Joined("change")` a todos, e o tratamento de `joinedAction` responde com
`g.Status(true, nil)` (`authentified = true`) — logo `locked: true` chega aos
presentes. Ao receber isso, o cliente abandona a sala, descarta o token do
`sessionStorage` e mostra "Reunião encerrada".

Sem esta customização o aviso do Galene ("This group is locked") apareceria, mas
o participante **ficaria preso** numa sala que não aceita mais ninguém.

- `static/galene.js`: `gotJoined` (bloco `status.locked`), `meetingEnded`,
  `enterLeftState`.

## 8. Saída que funciona: reconectar ou voltar

**Problema:** o botão "Logout" do Galene (`#disconnectbutton`) chama
`serverConnection.close()`; o `gotClose` cai em `setConnected(false)`, que
mostra o `#login-container` — o formulário **usuário/senha**. Nas nossas salas a
autenticação é exclusivamente por token (`authKeys`), não há senha no grupo, e o
`token` já foi zerado em `gotJoined`. Aquele formulário **nunca** autentica.

E a URL não tem mais o token (o `replaceState` o removeu). Resultado: um beco sem
saída — a única forma de reentrar era recarregar a página, o que ninguém
descobre sozinho.

**Solução:** a saída passa a oferecer o que realmente funciona.

- **"Entrar novamente"** restaura `token` do `sessionStorage` e reconecta.
- **"Voltar para a plataforma"** navega para o `?back=` — a página da reunião no
  domínio do app, que o cliente não tem como deduzir (ele roda em `meet.…`).
- O formulário de usuário/senha é **escondido**: não é oferecido o que não
  funciona.
- O "Logout" passa a sair de verdade: limpa o `sessionStorage` e vai para o
  `back`. Sem `back` (link aberto direto), apenas encerra a sessão local.

O `back` é validado por `sanitizeBackUrl()` (só `http`/`https`, com teto de
tamanho) — é um destino de navegação, então `javascript:` e `data:` precisam
ficar de fora.

- `static/galene.js`: `storageGet/Set/Remove`, `ensureLeftPanel`,
  `hideLeftPanel`, `enterLeftState`, `gotClose`, `setConnected`,
  `#disconnectbutton`, `start()`.
- `static/indies.css`: `.ib-left-panel`, `.ib-left-actions`, `.ib-leave`.
- `lib/galene.js`: `sanitizeBackUrl` + parâmetro `back` na URL de entrada.

## 9. Escolha do dispositivo de reprodução (saída de áudio)

**Problema:** o painel de opções tinha **Camera** e **Microphone**, mas nenhuma
escolha de **saída** — o áudio remoto ia sempre para a saída padrão do sistema.
Não era só falta de botão: o cliente alimenta o áudio de cada participante em um
`<video>` (`setMedia` → `media.srcObject = c.stream`), e o Chromium **fixa o
elemento na saída que estava escolhida quando ele começou a tocar**. Trocar a
saída padrão no sistema no meio da chamada não movia quem já estava falando,
então "mudar o dispositivo de reprodução" simplesmente não funcionava.

**Solução:** um select **Speakers** no `#mediaoptions` e a aplicação da escolha
por `setSinkId` em cada elemento de mídia.

- `static/galene.html`: o `<select id="audiooutputselect">` (com a opção `""` =
  saída padrão do sistema, a única que nunca falha) e o
  `<div id="audiooutput-hint">`.
- `static/galene.js`: `audioOutputOptionsFromDevices` (popula a lista; ignora
  dispositivo sem `deviceId`, que não é escolhível), `canSelectAudioOutput`,
  `getAudioOutput`, `applyAudioOutput`, `applyAudioOutputToAll`,
  `reflectAudioOutput`, `showAudioOutputHint` e as chamadas em `setMediaChoices`
  (quando `done`), `setMedia`, `start()` e no evento `devicechange` de
  `navigator.mediaDevices`.
- `static/indies.css`: `.ib-hint` e o alinhamento do novo select.

Quatro decisões que não são óbvias:

1. **Vale para todos os elementos, não só o tile visível.** Há vários `<video>`
   com áudio: um por participante, incluindo os `peer-hidden` (quem está só de
   áudio continua tocando) e o de compartilhamento de tela. Trocar só o visível
   deixaria os outros na saída antiga.
2. **A falha nunca é silenciosa.** Se o dispositivo escolhido sumiu (headset
   desconectado, `deviceId` rotacionado), o `setSinkId` lança; o cliente volta
   para a saída padrão, limpa a escolha e avisa. Sem isso o sintoma seria "fiquei
   mudo e não sei por quê". A aplicação percorre os elementos **em série** por
   causa disso: o primeiro que falha já limpa a escolha, então o aviso sai uma
   vez, não um por participante.
3. **A escolha não é descartada antes da permissão de mídia.** O Chromium esconde
   as saídas de `enumerateDevices()` até a origem receber permissão de
   microfone/câmera; nessa janela a lista tem só o padrão. Por isso o descarte da
   escolha acontece somente quando a lista **mostra** outras saídas (mais de uma
   opção) e o id guardado não está entre elas — caso contrário um recarregamento
   apagaria a escolha do usuário (o `sessionStorage` sobrevive ao refresh).
   Pelo mesmo motivo a lista é repopulada no `devicechange`: plugar o headset
   durante a reunião precisa oferecer a saída nova.
4. **Sem a API, o controle é escondido com explicação.** `setSinkId` não existe
   no Firefox nem no Safari; ali o select não aparece e a `.ib-hint` diz para
   trocar o dispositivo padrão no sistema. Melhor não oferecer o que não funciona
   do que oferecer um select que não muda nada.

A escolha vive em `settings.audioOutput` (o `sessionStorage` do próprio
`settings.js`) — não foi preciso tocar em `settings.js`, que é arquivo do
upstream: a leitura da chave é feita por índice.

O lado da plataforma não precisou de nada: a sala abre em aba própria
(`pages/reunioes/[meetingId]/index.js`), então não há _permissions policy_ de
iframe a habilitar para `speaker-selection`.

## 10. Controles do tile voltam a responder ao clique

**Problema:** play, volume/mudo, PiP e tela cheia não funcionavam em nenhum tile
(câmera ou tela compartilhada). Só o botão de parar do próprio tile respondia.

**Causa:** a plaqueta com o nome (`.label`) é `position: absolute`,
`width: 100%` e **`z-index: 1`**, e é criada **depois** da barra de controles no
`setMedia`. A barra (`.video-controls`) fica em `bottom: 25px` e não tem
`z-index` — ou seja, o rótulo pinta por cima e captura o clique. O upstream tinha
a mesma fragilidade latente (um nome em duas linhas já passaria dos 25px), mas
aqui ela passou a acontecer **sempre** porque a skin deu padding ao rótulo
(`padding: 16px 10px 6px`, do `indies.css`): a caixa foi de 24px para 46px e
passou a cobrir os 21px de baixo da barra — justo a faixa onde estão os botões.

Medido no navegador (Chrome, CSS e markup reais): com a barra em `y 436..468` e o
rótulo em `y 447..493`, `elementFromPoint` no centro de **cada** botão devolvia
`DIV.label`, e o clique não tinha efeito nenhum.

**Solução:** no `indies.css` (nosso arquivo, sem tocar no `galene.css`):

- `.peer .label { pointer-events: none }` — o rótulo é informação, nunca alvo de
  clique;
- `.peer > .video-controls, .peer > .top-video-controls { z-index: 2 }` — a barra
  fica acima da plaqueta independentemente de a plaqueta crescer;
- a barra invisível não captura clique (`pointer-events: none`), liberado no
  mesmo `:hover` que o `galene.css` já usa para revelá-la. Sem isso, o clique que
  antes morria no rótulo passaria a acertar botões invisíveis — trocaríamos um
  bug por outro (mudo ligado sem querer);
- no layout de toque (`@media (max-width: 1024px)`) o botão de parar do próprio
  tile é **sempre visível** (`.top-video-controls { opacity: 1 }` do upstream) e
  não há hover: ali o `pointer-events` volta a `auto` explicitamente.

Verificado com eventos de mouse reais (CDP): sem hover o ponto do botão resolve
para o `<video>` e o clique não faz nada; com hover a barra fica `opacity: 1` /
`pointer-events: auto` e o clique real em play, mudo, tela cheia e parar executa
a ação — tanto na grade quanto no modo palco.

## 11. Cancelamento de eco não é mais desligado por "Noise suppression"

**Problema:** microfonia quando mais de uma pessoa está no **mesmo ambiente**.
Cada aparelho toca o áudio dos outros pelas caixas; esse som entra pelo microfone
do outro aparelho, volta ao servidor e se realimenta. Quem corta esse caminho é o
cancelamento de eco (AEC), porque cada navegador conhece o que está tocando.

**Causa:** o `addLocalMedia` tratava AEC como parte de "pré-processamento":

```js
if (!settings.preprocessing) {
  audio.echoCancellation = false; // <- o rotulo da caixa diz "Noise suppression"
  audio.noiseSuppression = false;
  audio.autoGainControl = false;
}
```

Desmarcar **"Noise suppression"** desligava o cancelador de eco junto. Como
"desligue a supressão de ruído" é conselho comum para voz robotizada, existia um
caminho silencioso para a microfonia — o rótulo não mencionava eco. Com AEC
desligado nos dois aparelhos da mesma sala, o laço fecha e apita. Fone de ouvido
em um dos lados evita o som do ar, mas cada lado precisa que o SEU cancelador
esteja ativo para não devolver o áudio do outro.

**Solução:** `echoCancellation: true` é pedido **sempre** (explícito, sem depender
do padrão do navegador), e a caixa passa a governar só o que o rótulo diz —
`noiseSuppression` e `autoGainControl`.

- `static/galene.js`: as constraints de áudio em `addLocalMedia`.
- `static/galene.html`: a dica `#audio-feedback-hint` no topo das opções de mídia,
  na mesma linha do que **faz diferença** na sala compartilhada — fone de ouvido.
  Sem isso, a orientação não chega a quem tem o problema. (A dica não cita o
  select **Speakers**, que só existe onde há `setSinkId` — customização 9 —, mas é
  ele que permite mandar o áudio da reunião para o próprio fone sem mexer no
  dispositivo padrão do sistema.)

O AEC nunca é desligado pelo usuário hoje. Isso é intencional: num app de reunião
a microfonia é pior do que qualquer artefato do cancelador, e quem precisa de
AEC desligado (interface de áudio dedicada) precisa de uma opção própria, não do
rótulo de ruído. Se um dia essa opção existir, mantenha-a **separada** de
"Noise suppression".

Verificado com o `addLocalMedia` real (stubs interceptando o `getUserMedia`):
com "Noise suppression" desmarcado, `echoCancellation` continua `true` e só
`noiseSuppression`/`autoGainControl` vão a `false`.

## 12. Tela de entrada (prévia, medidor de microfone e dispositivos)

**Problema:** com `?token=` na URL, `start()` conectava direto. O Galene ainda
fazia uma **sondagem** antes do join e, para dar ao navegador um gesto do usuário
(autoplay), mostrava uma tela com um botão solto "Connect" — sem prévia, sem
escolha de dispositivo, sem saber se o microfone estava funcionando. Quem entrava
com o fone errado descobria depois de já estar na sala, e entrar mudo era o
caminho mais fácil.

**Solução:** uma tela de entrada antes de conectar, no formato do Teams:
prévia espelhada da câmera, barra de nível do microfone, seletores de microfone,
alto-falante e câmera, e os botões "Cancelar" / "Entrar agora".

O clique em **"Entrar agora"** é o gesto do usuário, então não há mais motivo
para a sondagem: `prejoinJoin()` define `probingState = 'success'` antes de
`serverConnect()`, e `join()` passa direto. O nome do participante continua
vindo do `sub` do JWT (o formulário nunca era preenchido nessas salas).

Detalhes que não são óbvios:

1. **As escolhas têm de alimentar `settings`.** `addLocalMedia` lê `settings.audio`
   e `settings.video`; os selects da tela escrevem nessas chaves. Sem isso, a
   prévia mostraria uma câmera e a sala publicaria outra.
2. **Nada de `delSetting('video')`** no caminho de publicação. O `present ===
'both'` do Galene deleta a chave para cair na "primeira câmera"; aqui isso
   trocaria a câmera escolhida. A flag `prejoinPublishRequested` publica
   exatamente o que a pessoa viu.
3. **Fechar a tela sempre para o stream e o `AudioContext`.** Câmera aberta na
   prévia é câmera ocupada pelo navegador — inclusive na reentrada depois de "Sair".
4. **`echoCancellation` obrigatório na prévia** (customização 11): a prévia tem
   de refletir o que vai ao ar.
5. **`pointerdown` retoma o `AudioContext`.** Sem gesto, ele nasce suspenso e o
   medidor fica em zero — um medidor sempre zerado é pior que nenhum.
6. **`devicechange` atualiza a tela.** Plugar o headset antes de entrar precisa
   oferecer o aparelho novo e soltar o antigo (que pode ter sido desconectado).

- `static/galene.html`: `#ib-prejoin` e todo o conteúdo do card.
- `static/galene.js`: `prejoinOpen`, `prejoinClose`, `prejoinStartStream`,
  `prejoinStartMeter`, `prejoinDrawMeter`, `prejoinSync`, `prejoinSyncSelect`,
  `prejoinReflectToggles`, `prejoinJoin`, `prejoinCancel`, `prejoinToggle` e as
  chamadas em `start()` (token → `prejoinOpen`), `gotJoined` (publica),
  `enterLeftState` e `disconnectbutton` (fecham a tela).
- `static/indies.css`: `.ib-prejoin*`, `.ib-device-card`, `.ib-meter`,
  `.ib-round`, `.ib-btn*`.

## 13. Áudio da tela compartilhada atenuado e em mono

**Problema:** relato de "o áudio da tela fica muito mais alto que as vozes".
`getDisplayMedia({audio: true})` entrega o loopback do sistema em escala digital
cheia, enquanto o microfone passa por `autoGainControl` (fala estabilizada perto
de −18 dBFS): a diferença chega a 10–15 dB. E o Opus do WebRTC é **mono**, então
o downmix L+R do navegador **soma** os canais — mais 3 a 6 dB e clipping nos
picos.

**Solução:** o áudio da captura passa por `applyScreenshareGain` antes de ir ao
ar: `GainNode` de `0.6` (−4,4 dB) e destino `MediaStreamAudioDestinationNode` com
`channelCount: 1`. O downmix do WebAudio divide por 2 por especificação, o que
elimina o excesso e o clipping. O vídeo é repassado intacto e o grafo existe só
para o envio — o tile local é mudo, ninguém ouve o próprio sistema duas vezes.

Dois cuidados:

- **`onended` não é herdado.** A track do destino não propaga o `ended` da
  captura original: "Parar compartilhamento" na barra do navegador deixaria o
  tile vivo com um stream congelado. O hook religa o `onended` da captura ao
  `c.close()`.
- **O `AudioContext` fecha no `onclose`** do stream (`c.userdata.onclose`), antes
  de `delMedia`. Sem isso, cada compartilhamento vazaria um contexto de áudio.

- `static/galene.js`: `SCREENSHARE_GAIN`, `applyScreenshareGain` e a chamada em
  `addShareMedia`.

## 14. Volume inicial do tile de tela

**Problema:** o elemento `<video>` do recebimento nasce com `volume = 1.0`, e o
slider só aparece no hover do tile (customização 10). Quem não é apresentador
não tem como baixar o áudio sem descobrir o controle.

**Solução:** o tile de tela começa em `0.75` (`SCREENSHARE_VOLUME`), com o slider
já refletindo o valor. A marca em `slider.dataset.ibInit` garante que o ajuste
aconteça **uma vez**: `setMedia` roda a cada track recebido, e sem isso a escolha
manual do usuário seria desfeita no evento seguinte.

- `static/galene.js`: `SCREENSHARE_VOLUME`, `initScreenshareVolume` e a chamada
  em `setMedia`.

## 15. Barra de controles flutuante e "Parar tela"

**Problema:** as ações ficavam na barra do topo (`nav-menu` do Galene), com os
rótulos "Enable/Disable/Mute/Share Screen", e **não havia** nenhum botão para
encerrar o compartilhamento — o único controle era o "stop" do próprio tile,
invisível até o hover. Quem apresentava precisava mirar num botão que não
aparecia, e no mobile ele é sempre visível mas fica no canto do palco.

**Solução:** barra flutuante centrada na base, no padrão de Teams/Zoom/Discord:
microfone, ligar/desligar câmera, compartilhar tela, **parar tela** e ajustes.

Os `id`s são os mesmos do Galene (`mutebutton`, `presentbutton`,
`unpresentbutton`, `sharebutton`, `openside`): `setButtonsVisibility` e os
handlers procuram por `id`, e a posição na tela não participa da lógica. O que
mudou é o lugar no DOM e o estilo.

- O `#controlbar` só aparece dentro da sala (`setConnected`), e o
  `#stopsharebutton` só enquanto `findUpMedia('screenshare')` existir
  (`setButtonsVisibility`).
- `#mutebutton` deixou de ser `<div>` e virou `<button>` — agora é focável por
  teclado. `setLocalMute` continua achando o ícone por `span .fas`.
- **O `#peers` termina acima da barra** (`bottom`/`min-height` com
  `--ib-ctlbar`), e `resizePeersScreenshare` passou a medir a altura do
  `#peers` — e não do container — porque usar a altura do container colocaria a
  última linha de tiles embaixo da barra.
- O controle de parar do **palco** fica sempre visível: no palco ele é
  informação, não enfeite.

- `static/galene.html`: `#controlbar` e o `#stopsharebutton`; a `nav-menu` saiu
  do topo.
- `static/galene.js`: handler do `#stopsharebutton`, as duas linhas em
  `setButtonsVisibility`/`setConnected`, `resizePeersScreenshare`.
- `static/indies.css`: `#controlbar`, `.ib-ctl*`, e o `#peers` com folga.

## 16. Interface em português

**Problema:** o cliente falava inglês ("Enable", "Share Screen", "Media
Options", "Logout"), no meio de um site em português.

**Solução:** tradução dos textos do HTML (rótulos, títulos, `legend`, botões e
`title` de acessibilidade) e das mensagens próprias do JS. As mensagens internas
do upstream (erros de protocolo) continuam em inglês de propósito: traduzir
`galene.js` inteiro inflaria o diff do arquivo do upstream a cada rebase, sem
ganho para quem usa.

- `static/galene.html`, `static/galene.js` (placeholders de chat, dica de
  "Ligar", título do painel de saída).

## Por que não há mais arquivos `.patch`

O subprojeto nasceu com 5 arquivos `.patch` que o `Dockerfile` aplicava por
`git apply` durante o build, sobre um clone da tag do upstream. Isso criou duas
representações da mesma mudança (a árvore **e** os patches) e elas divergiram
em silêncio: os patches tinham sido gerados contra a `galene-1.1`, enquanto a
árvore vendorizada era a `galene-1.2.1` — e a imagem publicada era construída da
1.1. Ou seja, o que o repositório mostrava não era o que rodava.

Hoje há uma representação só: a árvore. O diff contra a tag oficial é derivado
dela (nunca fica obsoleto) e o procedimento de rebase está em
[`UPSTREAM.md`](UPSTREAM.md).
