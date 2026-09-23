# Customizações do cliente Galene

As customizações vivem **direto na árvore**, em `static/`. Não há arquivos de
patch neste subprojeto: a árvore é a fonte única da verdade, e o diff contra a
tag oficial é o registro do que mudamos (como gerar em
[`UPSTREAM.md`](UPSTREAM.md), seção "Rebase").

Este documento existe porque o diff conta o **o quê**, mas não o **porquê** —
e é o porquê que permite refazer a mudança depois de um rebase, quando o
contexto ao redor já mudou.

| #   | Mudança                                      | Onde                                 |
| --- | -------------------------------------------- | ------------------------------------ |
| 1   | Mantém o `?token=` no refresh                | `static/galene.js`                   |
| 2   | Contagem de participantes no painel esquerdo | `static/galene.js`                   |
| 3   | Carrega a skin `/indies.css`                 | `static/galene.html`                 |
| 4   | Marca o tile de compartilhamento de tela     | `static/galene.js`                   |
| 5   | Layout "palco + faixa" com screenshare       | `static/galene.js` + `indies.css`    |
| 6   | Avatar do perfil do participante             | `static/galene.js` + `lib/galene.js` |
| 7   | Sai da sala quando o organizador a encerra   | `static/galene.js`                   |
| 8   | Saída que funciona: reconectar ou voltar     | `static/galene.js`                   |

Nada de Go do servidor foi alterado — todas são de cliente. As customizações 6
a 8 dependem de contrato com o app (`lib/galene.js`), documentado em cada seção.

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
