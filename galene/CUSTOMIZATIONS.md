# Customizações do cliente Galene

As customizações vivem **direto na árvore**, em `static/`. Não há arquivos de
patch neste subprojeto: a árvore é a fonte única da verdade, e o diff contra a
tag oficial é o registro do que mudamos (como gerar em
[`UPSTREAM.md`](UPSTREAM.md), seção "Rebase").

Este documento existe porque o diff conta o **o quê**, mas não o **porquê** —
e é o porquê que permite refazer a mudança depois de um rebase, quando o
contexto ao redor já mudou.

| #   | Mudança                                  | Onde                              |
| --- | ---------------------------------------- | --------------------------------- |
| 1   | Mantém o `?token=` no refresh            | `static/galene.js`                |
| 2   | Nome do estúdio no cabeçalho do painel   | `static/galene.js`                |
| 3   | Carrega a skin `/indies.css`             | `static/galene.html`              |
| 4   | Marca o tile de compartilhamento de tela | `static/galene.js`                |
| 5   | Layout "palco + faixa" com screenshare   | `static/galene.js` + `indies.css` |

Nada de Go do servidor foi alterado — as cinco são de cliente.

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

## 2. Nome do estúdio no cabeçalho do painel

**Problema:** o topo esquerdo da sala exibe o nome padrão "Galène" (ou o nome do
grupo quando o servidor manda `displayName`), mas o texto do painel de
usuários (`.galene-header`) fica fixo em "Galène" porque só o `#title` da barra
superior é atualizado por `setTitle`.

**Solução:** ao trocar o título (`setTitle`), também atualizar o texto de
`.galene-header`. Como a plataforma grava `displayName` (nome do estúdio) no
arquivo do grupo — e a sala herda esse `displayName` —, o nome do estúdio passa
a aparecer nos dois lugares.

- `static/galene.js`, em `setTitle` (função interna `set`).

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
