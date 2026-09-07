# Patches sobre a tag fixa `galene-1.1`

O `Dockerfile` clona o upstream na tag `galene-1.1` e aplica os arquivos
`*.patch` deste diretório com `git apply` **antes** do `go build`. Se um patch
não casar com o código da tag, o build falha de propósito (nada de imagem
silenciosamente diferente do esperado).

Patches aplicados hoje (nesta ordem — o glob `*.patch` do Dockerfile):

| Patch                                  | Efeito                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `0001-keep-join-token-on-reload.patch` | Mantém o `?token=` no refresh (sessionStorage)                                                                           |
| `0002-studio-name-header.patch`        | Nome do estúdio (`displayName` do grupo) no cabeçalho do painel esquerdo                                                 |
| `0003-load-indies-theme.patch`         | Carrega a skin local `/indies.css` (overlay após o `galene.css`)                                                         |
| `0004-mark-screenshare-peer.patch`     | Classe `peer-screenshare` no tile de compartilhamento de tela                                                            |
| `0005-stage-layout-screenshare.patch`  | Com screenshare: telas no topo — uma vira "palco" de linha inteira; varias dividem o topo em grade — + miniaturas abaixo |

## 0001-keep-join-token-on-reload.patch

**Problema:** ao entrar na sala com `?token=...`, o Galene remove o token da URL
(`history.replaceState`) logo após carregar. Se o participante dá **refresh** na
página, o token não está mais na URL e o Galene mostra a tela de login
(usuário/senha) — inutilizável para salas protegidas apenas por `authKeys`/JWT,
já que não há senha local. Resultado: "softlock" de autorização ao recarregar.

**Solução:** persistir o token no `sessionStorage` no primeiro acesso e
restaurá-lo no `start()` quando a URL não tiver `?token=`. O token é apagado do
`sessionStorage` quando o servidor rejeita a entrada (`fail`), evitando loop de
tentativas com token expirado/revogado.

- `static/galene.js` — 3 hunks: grava `joinToken`, restaura `joinToken`,
  remove `joinToken` no caso `fail`.
- O `sessionStorage` é por aba e some ao fechar a aba: reabrir o link da sala
  volta a funcionar normalmente (token presente na URL).

Comentários no JS foram mantidos sem acentos para não depender de encoding no
arquivo servido.

## 0002-studio-name-header.patch

**Problema:** o topo esquerdo da sala exibe o nome padrão "Galène" (ou o nome
do grupo quando o servidor manda `displayName`), mas o texto do painel de
usuários (`.galene-header`) fica fixo em "Galène" porque só o `#title` da barra
superior é atualizado por `setTitle`.

**Solução:** ao trocar o título (`setTitle`), o patch também atualiza o texto
de `.galene-header`. Como a plataforma grava `displayName` (nome do estúdio) no
arquivo do grupo, o nome do estúdio passa a aparecer nos dois lugares.

- `static/galene.js` — 1 hunk em `setTitle` (função interna `set`).

## 0003-load-indies-theme.patch

**Problema:** o CSS do Galene (`galene.css`) é o único carregado, então não há
como aplicar uma skin/overlay local sem editar o CSS do upstream.

**Solução:** adiciona `<link rel="stylesheet" href="/indies.css"/>` logo após o
`galene.css` no `head`. O arquivo `static/indies.css` é copiado pelo Dockerfile
a partir de `deploy/galene/static/` (não faz parte do upstream).

- `static/galene.html` — 1 hunk (tag `<link>` no `<head>`).

## 0004-mark-screenshare-peer.patch

**Problema:** não há marcador CSS para distinguir o tile de compartilhamento
de tela dos tiles de câmera (o `c.label` fica só em JS; as colunas da grade são
definidas inline por `resizePeers`).

**Solução:** no `setMedia`, quando a stream tem `label === 'screenshare'`, o
tile ganha a classe `peer-screenshare`. O `indies.css` usa essa classe para dar
uma moldura própria ao tile (sem alterar o layout calculado pelo JS).

- `static/galene.js` — 1 hunk em `setMedia` (classe `peer-screenshare`).

## 0005-stage-layout-screenshare.patch

**Problema:** com o tile de screenshare marcado (patch `0004`), a grade
igualitária do Galene ainda trata a tela compartilhada como mais um tile do
mesmo tamanho das câmeras. Em ferramentas comerciais (Teams, Zoom, Discord) o
compartilhamento ganha destaque: vira um "palco" em linha inteira no topo e as
câmeras descem para uma faixa de miniaturas.

**Solução:** o `resizePeers` agora detecta os tiles `.peer-screenshare`
visíveis. Se houver algum, adiciona a classe `has-screenshare` ao `#peers` e
delega o cálculo a `resizePeersScreenshare` (nova função):

1. Lê `row-gap`, `column-gap`, paddings e as variáveis `--thumb-w`/`--thumb-h`
   do `#peers` via `getComputedStyle`;
2. Calcula quantas miniaturas cabem por linha e quantas linhas as câmeras
   visíveis ocupam (`camRows`);
3. Define `height` inline no tile do palco = altura do container − padding −
   altura da faixa (`camRows * (thumbH + rowGap)`), com mínimo de 120px;
4. Limpa os `max-height` inline remanescentes (do caminho de grade
   igualitária), deixando o CSS dimensionar as miniaturas via flex.

Com **mais de uma tela** sendo compartilhada (`screenPeers.length > 1`) o
`#peers` ganha também a classe `has-many-screens` e as telas **dividem o topo
em grade**: até 3 telas em uma única linha; acima disso, colunas/linhas na
proporção raiz quadrada. A reserva da faixa de câmeras é a mesma, então as
câmeras continuam visíveis na parte de baixo (elas não são empurradas para
fora da área). O CSS de `.has-many-screens` zera o `min-height` fixo do palco
(que quebraria o cálculo) e esconde o selo "Apresentando" repetido.

Sem screenshare o caminho original (grade igualitária) roda intacto — a única
diferença é a declaração de `let peers` movida para o topo da função.

- `static/galene.js` — 2 hunks em `resizePeers` + função nova
  `resizePeersScreenshare`.

O layout em si (flex, `order:-1` no palco, dimensões das miniaturas, selo
"Apresentando") vive no `indies.css` sob `#peers.has-screenshare` — veja
`deploy/galene/static/indies.css`.
