import { Head, Html, Main, NextScript } from "next/document";

/**
 * `next/font` **não pode** ser usado aqui: o `_document` roda fora da árvore
 * React (renderizado uma vez no servidor, sem contexto) e o carregador lança
 * `Cannot be used within _document.js` em runtime — o sintoma é a página
 * inteira respondendo 500. A fonte é carregada em `_app.js`.
 *
 * `lang="pt-BR"` fica aqui porque só o `_document` escreve atributo no
 * `<html>`; sem ele o leitor de tela pronuncia o conteúdo em inglês.
 */
export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
