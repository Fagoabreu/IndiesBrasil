# Patches sobre a tag fixa `galene-1.1`

O `Dockerfile` clona o upstream na tag `galene-1.1` e aplica os arquivos
`*.patch` deste diretório com `git apply` **antes** do `go build`. Se um patch
não casar com o código da tag, o build falha de propósito (nada de imagem
silenciosamente diferente do esperado).

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
