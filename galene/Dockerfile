# ─────────────────────────────────────────────────────────────────────────────
# Galene — imagem a partir da ÁRVORE LOCAL deste subprojeto.
#
# Este diretório é um fork vendorizado do upstream `jech/galene` na tag
# `galene-1.2.1`, com as nossas customizações JÁ APLICADAS nos arquivos de
# `static/`. Ver `UPSTREAM.md` para a lista exata do que é nosso e para o
# procedimento de rebase.
#
# Por que NÃO usar `docker pull`:
#   O jech/galene não publica imagem oficial no Docker Hub nem releases com
#   binários (as imagens do Docker Hub são de terceiros, sem garantia de
#   proveniência). A distribuição oficial é compilação do código-fonte.
#
# Por que compilar a árvore local em vez de clonar durante o build:
#   1. o build não depende de rede/git para obter o código-fonte;
#   2. o que foi revisado neste repositório é exatamente o que é compilado.
#      Antes o Dockerfile clonava a tag `galene-1.1` enquanto o repositório
#      vendorizava a 1.2.1 — a imagem entregue era a 1.1, e as customizações
#      eram aplicadas por patches em tempo de build.
#
# MediaPipe/background blur NÃO é incluído: é opcional e, na ausência, o
# Galene apenas desativa o menu — alinhado ao requisito "sem IA no servidor".
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS build

LABEL org.opencontainers.image.title="indies-galene" \
      org.opencontainers.image.description="Galene SFU (upstream galene-1.2.1 + customizacoes Indies Brasil)"

WORKDIR /src

# Não há `vendor/`: o `go build` baixa os módulos do proxy oficial via HTTPS e
# por isso precisa das CAs raiz (a imagem alpine não as traz por padrão).
RUN apk add --no-cache ca-certificates

# O `.dockerignore` deixa fora do contexto o runtime (groups/, data/) e o meta
# do subprojeto (patches/, templates/, docs).
COPY . .

RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o galene .

# ── runtime ──────────────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates \
    && adduser -D -H -u 1001 galene

WORKDIR /app

COPY --from=build /src/galene ./
COPY --from=build /src/static ./static

# Diretórios de dados conforme galene-install.md: `groups/` e `data/`.
# uid 1001 é o MESMO do usuário `nextjs` da imagem do app Indies Brasil:
# permite compartilhar um volume de grupos entre os dois containers.
RUN mkdir -p /app/groups /app/data/var \
    && chown -R galene:galene /app

USER galene

# -http/-insecure/-turn/-udp-range são decididos pelo compose de cada ambiente.
EXPOSE 8000 8443 1194/udp 1194/tcp

ENTRYPOINT ["./galene"]
