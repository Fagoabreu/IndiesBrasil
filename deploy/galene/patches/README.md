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
