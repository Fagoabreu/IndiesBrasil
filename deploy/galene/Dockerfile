# ─────────────────────────────────────────────────────────────────────────────
# Galene — imagem a partir do código-fonte oficial (tag fixa).
#
# Por que NÃO usar `docker pull`:
#   O projeto jech/galene NÃO publica imagem oficial no Docker Hub nem releases
#   com binários (os assets do Docker Hub são de terceiros, sem garantia de
#   proveniência). A distribuição oficial é compilação do código-fonte. Aqui
#   fixamos a tag e compilamos com CGO_ENABLED=0 (binário estático).
#
# MediaPipe/background blur NÃO é incluído: é opcional e, na ausência, o
# Galene apenas desativa o menu — alinhado ao requisito "sem IA no servidor".
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS build

ARG GALENE_TAG=galene-1.1

WORKDIR /src

# Módulos Go são baixados do proxy oficial; clone raso na tag fixada.
RUN apk add --no-cache git ca-certificates \
    && git clone --depth 1 --branch "${GALENE_TAG}" https://github.com/jech/galene.git . \
    && CGO_ENABLED=0 go build -ldflags="-s -w" -o galene .

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
