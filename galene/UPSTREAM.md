# UPSTREAM.md — relação com o Galene oficial

`galene/` é um **fork vendorizado**: a árvore do upstream fica versionada dentro
deste repositório e as nossas customizações convivem com ela, editadas
diretamente. Este arquivo é o contrato entre os dois — leia antes de alterar
qualquer arquivo do servidor.

Não há arquivos de patch neste subprojeto: **a árvore é a fonte única da
verdade**. O porquê de cada customização está em
[`CUSTOMIZATIONS.md`](CUSTOMIZATIONS.md).

## Versão base

| Campo         | Valor                                                    |
| ------------- | -------------------------------------------------------- |
| Upstream      | <https://github.com/jech/galene>                         |
| Tag base      | `galene-1.2.1`                                           |
| Publicada em  | 8 de setembro de 2026 (1ª linha de [`CHANGES`](CHANGES)) |
| Licença       | MIT ([`LICENCE`](LICENCE))                               |
| Imagem Docker | `indies-galene:galene-1.2.1`                             |

A árvore local é **byte a byte igual** à tag base, exceto pelos arquivos
listados abaixo. Essa é a propriedade que torna um rebase previsível, e ela é
verificável a qualquer momento:

```sh
node scripts/audit-galene-upstream.js
```

O script baixa a tag da tabela acima, compara as árvores e **falha** se aparecer
qualquer arquivo fora das duas tabelas abaixo (são 12 arquivos). Rode-o antes de
rebasar e depois de qualquer edição em `galene/` — uma divergência acidental
passa despercebida com facilidade e só aparece como bug em produção.

## Adições nossas (não existem no upstream)

| Caminho             | Papel                                                      |
| ------------------- | ---------------------------------------------------------- |
| `Dockerfile`        | Build da imagem a partir desta árvore                      |
| `.dockerignore`     | Mantém runtime e meta fora do contexto de build            |
| `.gitattributes`    | Força LF nesta subárvore (ver "Line endings")              |
| `UPSTREAM.md`       | Este arquivo                                               |
| `CUSTOMIZATIONS.md` | O porquê de cada customização do cliente                   |
| `templates/`        | `config.example.json` e `group.example.json` de referência |
| `groups/.gitkeep`   | Só o marcador do diretório — os grupos nascem em runtime   |
| `static/indies.css` | Skin da marca, carregada pela customização 3               |

## Arquivos do upstream que modificamos

| Caminho              | Mudança                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `static/galene.js`   | Customizações 1, 2, 4 e 5 (+149 / −1 linhas)                                                 |
| `static/galene.html` | Customização 3 (+1 linha: `<link rel="stylesheet" href="/indies.css"/>`)                     |
| `README.md`          | Substituído pela nossa documentação (o README do upstream virou a seção "Upstream" do nosso) |

Todo o código Go do servidor (`galene.go` e os subdiretórios) está **intacto**.
Manter isso é o que permite trocar a tag base com um merge mecânico.

## Como as customizações vivem na árvore

As mudanças estão **aplicadas** em `static/galene.js` e `static/galene.html`.
Quem explica cada uma — problema, solução, o que ela toca — é
[`CUSTOMIZATIONS.md`](CUSTOMIZATIONS.md). Leia antes de mexer: o diff mostra o
que mudou, mas não por quê, e é o porquê que permite refazer a mudança depois de
um rebase.

Uma customização nova segue o mesmo caminho: edite a árvore, descreva a intenção
em `CUSTOMIZATIONS.md` e rode o `audit-galene-upstream.js` para confirmar que o
conjunto de arquivos divergentes continua sendo o esperado.

## Line endings

A árvore precisa ficar em **LF**, exatamente como o upstream publica: o diff
contra a tag oficial só é limpo se os bytes baterem.

O repositório tem `core.autocrlf=true`, então o `.gitattributes` desta subárvore
força `eol=lf`. Ao adicionar um arquivo em `galene/`, confirme que ele não foi
gravado em CRLF (no Windows isso acontece com `>`/`Set-Content`).

## Rebase para uma nova tag do upstream

Use um **merge de 3 vias por arquivo**, não aplicação de patch. O merge conhece
o ancestral comum (a tag antiga) e por isso resolve sozinho o que mudou de cada
lado, deixando conflito só onde os dois mexeram na mesma região — e o conflito
vem como marcador no arquivo, não como falha opaca.

Operação de risco: faça numa branch e revise o diff antes de seguir.

```sh
ANTIGA=galene-1.2.1   # a tag da tabela "Versão base"
NOVA=galene-1.2.2

# 0. Branch de trabalho (nada de rebase direto em main).
git switch -c rebase-galene-$NOVA

# 1. Baixe as DUAS árvores: a antiga é o ancestral comum do merge.
tmp=$(mktemp -d)
for t in "$ANTIGA" "$NOVA"; do
  curl -fsSL -o "$tmp/$t.tar.gz" \
    "https://github.com/jech/galene/archive/refs/tags/$t.tar.gz"
  tar xzf "$tmp/$t.tar.gz" -C "$tmp"
  test -f "$tmp/galene-$t/galene.go" || { echo "tag inválida: $t"; exit 1; }
done
antigo="$tmp/galene-$ANTIGA"
novo="$tmp/galene-$NOVA"

# 2. Troque o upstream sob a nossa árvore, preservando tudo o que é nosso.
#    `--delete` remove arquivos do upstream que sumiram; os `--exclude`
#    protegem o que não vem dele (inclusive groups/, com os grupos em runtime).
rsync -a --delete \
  --exclude '/Dockerfile' --exclude '/.dockerignore' --exclude '/.gitattributes' \
  --exclude '/UPSTREAM.md' --exclude '/CUSTOMIZATIONS.md' --exclude '/README.md' \
  --exclude '/templates/' --exclude '/groups/' --exclude '/data/' \
  --exclude '/static/indies.css' \
  "$novo/" galene/

# 3. Mescle as customizações: `git merge-file -p NOSSA ANCESTRAL NOVA`.
#    Sai com o nº de conflitos (0 = limpo) e escreve marcadores no arquivo.
for f in static/galene.js static/galene.html; do
  if git merge-file -p "galene/$f" "$antigo/$f" "$novo/$f" > "$tmp/merged"; then
    echo "OK   $f"
  else
    echo "CONFLITO em $f — resolva os marcadores <<<<<<< ======= >>>>>>>"
  fi
  cp "$tmp/merged" "galene/$f"
done
```

Se houver conflito, resolva **lendo o motivo da customização** em
`CUSTOMIZATIONS.md`: na dúvida entre manter a nossa mudança e aceitar a nova do
upstream, a resposta costuma estar no problema que a customização resolve.

Ao terminar o rebase:

1. rode `node scripts/audit-galene-upstream.js` — ele falha se o conjunto de
   arquivos divergentes mudou, e é a rede de segurança contra perder uma
   customização no meio do caminho;
2. confira que a 1ª linha de `CHANGES` bate com a tag nova;
3. atualize a tabela "Versão base" e **os três lugares** que citam a tag da
   imagem: `deploy/compose.yaml`, `infra/compose.yaml` e
   `.github/workflows/deploy.yml`;
4. reconstrua a imagem e teste uma reunião de ponta a ponta antes do merge —
   `static/galene.js` é servido ao navegador e uma quebra ali derruba a sala;
5. atualize a contagem de linhas na tabela "Arquivos do upstream que
   modificamos".

## O que não alterar sem ler isto

- **`group/description.go`** — `readDescription` usa `DisallowUnknownFields`: um
  campo desconhecido no JSON do grupo faz o **decode falhar e o grupo inteiro
  não carregar** (a sala some). Todo campo gravado por `lib/galene.js` precisa
  existir na struct `Description`; o caminho seguro é usar um campo que já
  existe. `allow-anonymous` está **obsoleto desde a 0.9** e é ignorado.
- **`group/description.go` — `auto-subgroups`** — é o que faz o Galene resolver
  `<estudio>/<sala>` pelo arquivo do estúdio. Sem ele, **todas** as salas do
  estúdio deixam de abrir. É a base de como `lib/galene.js` provisiona hoje (um
  arquivo por estúdio, não por reunião).
- **`token/jwt.go`** — é quem valida os JWTs que `lib/galene.js` assina (HS256,
  32 bytes exatos, `aud` do estúdio com a barra final, `include-subgroups`).
  Mudança aqui muda o contrato com o app.
- **Código Go em geral** — mantê-lo intacto é o que permite trocar a tag base
  com um rebase mecânico.
