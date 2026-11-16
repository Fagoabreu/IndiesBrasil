# Funcionalidades da Jogos Social

Inventário completo da aplicação, organizado por módulo. Serve como referência para apresentação, onboarding de equipe e planejamento de produto.

> Rotas e comportamentos conferidos no código em 13/11/2026. Os números do projeto mudam com o tempo; as contagens abaixo são um retrato dessa data.
>
> Para gravar a apresentação, use o [roteiro do vídeo](./roteiro-video.md).

---

## Visão geral

A Jogos Social é o portal da comunidade de desenvolvimento de jogos independentes brasileiros. Reúne, num só lugar:

- **Rede profissional** — perfil, currículo, portfólio, reputação e diretório de membros.
- **Estúdios** — equipe, papéis, contatos, relacionamentos, QR Code e press kit.
- **Catálogos** — jogos digitais, jogos de mesa, livros/quadrinhos e assets.
- **Comunidade** — posts, enquetes, embeds, comentários, mensagens diretas e notificações.
- **Conteúdo e educação** — notícias, análises e cursos.
- **Eventos** — agenda aberta, RSVP, convites e webconferência.
- **Negócios** — loja, pedidos, streams e catálogo de serviços.
- **Ferramentas** — sete utilitários gratuitos que rodam no navegador.
- **Administração** — moderação, denúncias, catálogos e status do servidor.

### Números do projeto

| Item                      | Quantidade |
| ------------------------- | ---------- |
| Páginas (fora da API)     | 80         |
| Rotas de API              | 176        |
| Arquivos em `models/`     | 44         |
| Migrações de banco        | 101        |
| Arquivos em `components/` | 95         |
| Arquivos de teste         | 161        |

Stack: Next.js (Pages Router), React, Primer React, PostgreSQL com `node-pg-migrate`, Cloudinary para imagens, Galene para webconferência e `ffmpeg.wasm` para compressão de vídeo no cliente.

---

## 1. Acesso e conta

- **Cadastro** com nome, `@username`, e-mail, CPF e senha, com medidor de regras de senha.
- **Ativação por token enviado por e-mail** — a conta só é liberada após a confirmação. O token tem prazo calculado pelo relógio do banco (não pelo relógio do processo), eliminando a janela em que ele nascia vencido.
- **Recuperação de senha** com token de finalidade separada (`reset`). Um token de ativação nunca troca a senha de ninguém.
- **Sessão por cookie** `httpOnly`, `sameSite=lax` e `secure` em produção. O banco guarda apenas o **hash SHA-256** do token da sessão — um dump do banco não entrega sessões prontas.
- **Limpeza de cadastro abandonado** — conta nunca ativada, sem token válido e sem nenhum pedido de reset é anulada no próximo cadastro com os mesmos dados, liberando e-mail, CPF e username.
- **Exclusão definitiva de conta** pelo admin, com confirmação por e-mail e decisão obrigatória sobre o estúdio do titular (apagar ou transferir).
- **Login e logout**, com redirecionamento de volta para a página pedida.

**Rotas:** `/cadastro`, `/cadastro/ativar/[token_id]`, `/cadastro/reset-password`, `/cadastro/reset-password/[token_id]`, `/login`

---

## 2. Perfil do membro e currículo

- **Perfil público** em `/perfil/@username` com foto, capa, nome, bio, selo de reputação, tempo de casa e contadores de seguindo, seguidores e postagens.
- **Visibilidade do perfil**: público, apenas seguidores ou privado. Quem não pode ler recebe o perfil sem o conteúdo do portfólio.
- **Abas do perfil:** Informações, Posts e — só para o dono — Mensagens e Notificações. A aba vive na URL (`?tab=`), então link de notificação abre direto na conversa e a página sobrevive ao recarregar.
- **Indicador de completude do perfil**, com o que falta para chegar a 100%.
- **Exportar PDF** direto do cabeçalho do perfil.
- **Histórico profissional** com cargo, empresa, local, período e descrição.
- **Formação acadêmica** (curso, instituição, período).
- **Especializações** com nível de experiência em cinco degraus (Estudante, Junior, Pleno, Sênior, Especialista).
- **Ferramentas e softwares** dominados, também com nível.
- **Contatos** (Discord, e-mail, WhatsApp, redes, itch.io, Steam etc.) com normalização, validação e handle legível. Telefone e WhatsApp conferem DDD contra a lista da Anatel.
- **Sugestão de profissão** enviada pelo próprio membro, fora do formulário de especializações (formulário dentro de formulário é HTML inválido).
- **Currículo para impressão/PDF** em `/perfil/@username/curriculo`, com barra de impressão e `@media print`.
- **Compartilhar perfil** com card de preview.
- **Caderno de endereços** (endereços salvos) para reaproveitar em pedidos.
- **Seguir membros** e acompanhar a atividade de quem interessa.
- **QR Code do perfil** para abrir no celular ou colocar em cartão.

**Rotas:** `/perfil/[username]`, `/perfil/[username]/configuracoes`, `/perfil/[username]/curriculo`

---

## 3. Comunidade

- **Home** com vitrine de conteúdo em destaque — até 3 jogos, 3 jogos de mesa, 3 livros e 3 assets, uma coluna por tipo —, agenda, depoimentos e press kit.

### 3.1 Posts

- **Publicação** com texto, imagem (recorte 4:3 no envio), **enquetes** e **embeds** de YouTube, Twitch, Instagram e Steam. Demais links viram card de preview com título e imagem.
- **Embed correto por tipo de link** — vídeo vira player, canal vira card de preview. `youtube.com/live/<id>` é reconhecido como vídeo, e `/reel/<id>` do Instagram é normalizado para o permalink canônico (o plural `/reels/` responde 404 no embed).
- **Embed antigo se conserta na leitura**: posts gravados antes da correção passam a ser desenhados como player sem precisar regravar.
- **Curtidas, comentários e compartilhamento** com card de preview.
- **Exclusão** pelo autor, com permissões verificadas no servidor.
- **Denúncia** de post, estúdio, obra, asset e conversa.
- **Tags** com sugestão enquanto digita e lista de **tags em alta**.

**Rotas:** `/posts`, `/posts/[id]`

### 3.2 Mensagens diretas

- **Conversas entre membro e membro** e entre **membro e estúdio**.
- **O estúdio só responde** — quem inicia é sempre o membro, regra garantida pela ausência de rota para o estúdio iniciar.
- **Caixa do estúdio compartilhada**: qualquer membro ativo lê e responde em nome do estúdio, e o autor humano da mensagem fica gravado para a moderação.
- **Contador de não lidas**, histórico persistente e atualização automática (consulta a cada 15 segundos e ao voltar o foco para a aba).
- **Silenciar conversa**, com lista das silenciadas para reverter.
- **Denunciar conversa** — a conversa denunciada é congelada: os dois lados continuam lendo o histórico, mas ninguém envia novas mensagens.
- **Privacidade por desenho**: não participante recebe 404, não 403 — confirmar a existência revelaria que duas outras pessoas estão conversando.

**Rotas:** `/perfil/[username]?tab=mensagens`, `/estudios/[slug]` → aba Mensagens, `/admin/conversas/[id]` (leitura pela moderação)

### 3.3 Diretório de membros

- **Busca** por username, resumo, profissão e ferramenta.
- **Filtros de catálogo** por profissão e por ferramenta, com contagem populacional em cada opção (a opção não desaparece quando ninguém a preencheu).
- **Ordenação** por mais recentes, mais antigos, maior/menor reputação, mais/menos seguidores — sincronizada na URL e com paginação por cursor.
- **Abas** Descubra, Seguindo e — apenas para admin — Inativos (diagnóstico de contas travadas).
- **O próprio perfil aparece na lista** (aba Descubra), como qualquer outro membro — antes o leitor era removido do resultado e quem procurava o próprio nome não achava.
- **Seguidores e seguindo** com atualização imediata.

**Rotas:** `/membros`

### 3.4 Notificações

- **Sino e aba de notificações** no perfil, com marcação individual e "marcar todas como lidas".
- **Avisos de:** novo seguidor, convite de estúdio, curtida e comentário em post, curtida/comentário/avaliação em jogo, jogo de mesa, quadrinho e asset, novo pedido, pedido atualizado, reunião agendada e nova mensagem.
- **Clicar sempre navega**, inclusive em notificação já lida — o sino é histórico, não só fila de pendências.
- **Feed próprio do estúdio** com notificações da equipe e atalho para o recurso certo (ex.: reunião agendada abre a reunião destacada).

### 3.5 Reputação

- **Pontos por contribuição real**, com limite diário por ação:

| Ação                                  | Pontos | Limite diário |
| ------------------------------------- | ------ | ------------- |
| Post criado                           | 2      | 5             |
| Comentário criado                     | 1      | 20            |
| Post curtido                          | 1      | 50            |
| Estúdio criado                        | 15     | —             |
| Jogo / jogo de mesa / livro publicado | 8      | 5             |
| Perfil profissional preenchido        | 3      | —             |
| Denúncia validada                     | 10     | —             |
| Denúncia arquivada                    | -5     | —             |

- **Níveis:** Novato (0), Membro Ativo (15), Confiável (50), Referência (100). Não é gamificação punitiva: é sinal de atividade e confiança.
- **Painel de reputação** com o extrato por ação.

### 3.6 Depoimentos

- **Um depoimento por pessoa**, garantido por índice único no banco.
- **Envio, edição e exclusão** pelo próprio autor em qualquer momento.
- **Seção na home** com os depoimentos aprovados; o formulário vira edição quando a pessoa já escreveu.
- **Limites** de 500 caracteres de conteúdo e 80 de função; texto puro, com remoção de tags e scripts.

---

## 4. Estúdios

- **Criação de estúdio** com nome, slug, logo, banner, descrição, história, pitch, CNPJ, fundação, endereço e contatos.
- **Equipe e papéis**: responsável, administrador e membro, com matriz de permissões única (`studioPermissions`).
- **Convite de membro** por username, com autocomplete que busca enquanto digita, mostra quem já é membro ou tem convite pendente e continua aceitando texto livre.
- **Aceite e recusa de convite**, com aviso no topo da página do estúdio.
- **Follow de estúdio** e contador de seguidores.
- **Relacionamentos entre estúdios** (parceiro, distribuidora, publicadora, incubadora, investidora, cooperativa, coletivo e outros), com solicitação e aceite entre as partes.
- **Página do estúdio** com abas Perfil, Postagens, Mensagens e Notificações (as duas últimas só para a equipe).
- **Painéis do perfil do estúdio**: Sobre, História, Ao Vivo, Streaming, Jogos, Jogos de Tabuleiro, Livros e Quadrinhos, Assets, Endereço, Contatos, Serviços, CNPJ, Informações, Membros e Relacionamentos.
- **QR Code do estúdio** para cartão, estande ou slide.
- **Atalhos de gestão** no cabeçalho: configurações, eventos, reuniões, loja, pedidos e press kit. Os atalhos de loja e pedidos ficam desabilitados quando as vendas estão desligadas.
- **Escolher estúdio** quando a pessoa participa de mais de um, antes de publicar.
- **Press kit oficial do estúdio** com história, destaques, trailer, mídia, equipe, logos, redes e obras.
- **Exclusão do estúdio** apaga as obras junto e nunca deixa asset orfão.

**Rotas:** `/estudios`, `/estudios/novo`, `/estudios/escolher`, `/estudios/[slug]`, `/estudios/[slug]/configuracoes`, `/estudios/[slug]/eventos`, `/estudios/[slug]/reunioes`, `/estudios/[slug]/loja`, `/estudios/[slug]/pedidos`, `/estudios/[slug]/press-kit`

### 4.1 Configurações do estúdio

Nove abas, cada uma com seu editor:

| Aba               | O que faz                                                          |
| ----------------- | ------------------------------------------------------------------ |
| **Perfil**        | Dados, descrição, história e endereço                              |
| **Equipe**        | Membros, papéis e convites                                         |
| **Contatos**      | Canais e redes sociais                                             |
| **Jogos**         | Cadastro de jogos digitais (informações, mídia e lojas)            |
| **Jogos de Mesa** | Cadastro de jogos de tabuleiro, cartas e RPG (informações e mídia) |
| **Publicações**   | Livros, quadrinhos e PDFs (informações, capa, PDF e lojas)         |
| **Streaming**     | Canais da Twitch e do YouTube                                      |
| **Assets**        | Pacotes para game dev, com categorias e licença                    |
| **Serviços**      | O que o estúdio presta, com resumo e valor de referência           |

---

## 5. Obras e catálogos

### 5.1 Jogos digitais

- **Ficha completa**: capa 16:9, banner, descrição, estágio (Conceito → Lançado/Cancelado), plataformas, tags, data de lançamento, links de loja (Steam, itch.io e outras) e galeria de vídeos.
- **Abas** Visão geral e Análises (com contador).
- **Embed da itch.io** quando o jogo tem página lá, e cartão de prévia da Steam.
- **Curtidas, comentários, avaliações (1 a 5 estrelas) e follow**.
- **Gêneros e tags** — ver 5.6.
- **Classificação indicativa** por questionário e **selos de monetização** — ver 5.5.
- **Press kit** por obra, com factsheet, descrição em níveis, mídia, equipe e contato de imprensa.
- **Edição** por quem é admin, criador ou membro ativo do estúdio.

**Rotas:** `/jogos`, `/jogos/[slug]`, `/jogos/[slug]/press-kit`

### 5.2 Jogos de mesa

- **Ficha** com banner, descrição, categoria (tabuleiro, cartas, RPG de mesa, dados, miniaturas, party game), mecânicas, número de jogadores, duração, idade mínima, data de lançamento e links.
- **Galeria de mídia**, curtidas, comentários, avaliações e follow.
- **Classificação indicativa** com sugestão por questionário.
- **Press kit** por obra.

**Rotas:** `/jogos-de-mesa`, `/jogos-de-mesa/[slug]`, `/jogos-de-mesa/[slug]/press-kit`

### 5.3 Livros e quadrinhos

- **Tipos**: livro, quadrinho, mangá, romance gráfico, zine e artbook.
- **Ficha** com capa retrato, sinopse, editora, edição, páginas, idioma, ISBN, estágio, tags, data e links de compra.
- **Leitor de PDF no navegador**, com leitura página a página e download do arquivo.
- **Curtidas, comentários, avaliações e follow**.
- **Press kit** por obra, abrindo com a capa em vez do banner (uma capa 2:3 em caixa 16:9 cortaria o título).

**Rotas:** `/quadrinhos`, `/quadrinhos/[slug]`, `/quadrinhos/[slug]/press-kit`

### 5.4 Assets

- **O site não hospeda o asset**: `external_url` aponta para itch.io, Kenney, OpenGameArt, Unity Asset Store, GitHub ou site do estúdio. A única imagem enviada é a capa opcional.
- **Duas camadas de taxonomia**: grupos fixos em código (Arte 2D, Arte 3D, Áudio, UI, VFX, Código) e categorias cadastradas pelo admin, com 1 a 8 categorias por asset.
- **Ficha** com licença, preço informativo, autor, categorias, curtidas, comentários e avaliações.
- **Filtros** por categoria e por nível de uso de IA na listagem.
- **Categoria em uso não é excluída, é desativada** — o vínculo dos assets existentes é preservado.
- **Edição** na aba Assets das configurações do estúdio.

**Rotas:** `/assets`, `/assets/[slug]`

### 5.5 Classificação, IA e monetização

- **Classificação indicativa** (Livre, 6, 10, 12, 14, 16 e 18 anos) por questionário em etapas, alinhado ao ClassInd e ao ECA Digital. O selo escolhe a cor do texto pela luminância do fundo para manter contraste. As respostas de **monetização contam para a faixa etária** (decisão do projeto: um jogo só com DLCs sai como 10 anos), e o questionário avisa isso.
- **Selo de uso de IA em faixas de 0 a 5**, de "Sem Uso de IA" a "IA Autônoma", com modal explicando cada faixa. Nível não declarado aparece como "Não informado" — é um estado, não uma ausência.
- **Selos de monetização (ECA Digital — Lei nº 15.211/2025)**: lootboxes, compras dentro do jogo e publicidade excessiva, com o motivo descrevendo o que foi **respondido** no questionário (DLC é DLC, não "microtransação").
- **Filtros de listagem** por classificação indicativa em jogos, jogos de mesa e livros, e por nível de IA também nos assets, incluindo "não classificado".

### 5.6 Gêneros e tags de jogo

- **Gênero é catálogo curado em dois níveis** (gênero › subgênero): 11 gêneros e 66 subgêneros, mantidos em `/admin/game-genres`. Um jogo recebe de 1 a 5 gêneros pelo seletor — nunca texto livre.
- **Filtro hierárquico**: filtrar por "Ação" devolve também os jogos marcados com "Shooter" ou "Plataforma". Marcar o pai e o filho é permitido, mas o pai é removido da seleção porque o filtro já o alcança pelo filho.
- **Toda a base antiga de texto livre foi convertida**: o que casava com o catálogo (ou com uma grafia conhecida, como "Shoot 'Em Up" → "Shoot 'em up (Shmup)") virou vínculo; o que não era gênero — perspectiva, modo e tom, como "2D Topdown", "Multiplayer" e "Emocional" — virou **tag**. Nenhum jogo perdeu classificação.
- **Tag é vocabulário livre** (até 8 por jogo, com `#` só na exibição). A listagem filtra por tag exata (o clique no chip) e a busca livre (`?q=`) também casa trecho de tag.
- **Sugestão de gênero** por qualquer membro, direto da ficha do jogo; aprovar cria o gênero **e** o vincula ao jogo de origem, sem obrigar a pessoa a reabrir o formulário.
- **Gênero em uso não é excluído, é desativado** — excluir apagaria a classificação de jogos existentes.
- **No card**, os gêneros de primeiro nível ocupam a linha de identidade e as tags aparecem em `#tag` logo abaixo da descrição (duas + contador).

**Rotas:** `/admin/game-genres`, `/api/v1/game-genres`, `/api/v1/game-genre-suggestions`, `/api/v1/game-tags`

### 5.7 Press kits

- **Um press kit por obra** (`/jogos/[slug]/press-kit`, `/jogos-de-mesa/[slug]/press-kit`, `/quadrinhos/[slug]/press-kit`) e um **press kit do estúdio**.
- **Formato `presskit()`**: factsheet, descrição em níveis, mídia, estúdio, equipe e contato de imprensa.
- **Tudo derivado** das colunas da obra — não existe tabela de press kit.
- **Barra de impressão** que salva em PDF, abre em outra aba e é `noindex` (o documento repete o conteúdo da página do produto).
- **Press kit oficial da plataforma** em `/presskit`.

---

## 6. Conteúdo editorial e educação

### 6.1 Notícias

- **Publicação e edição de notícias** com capa, tags, fonte e conteúdo.
- **Comentários, avaliação (1 a 5) e fact-check** votado pela comunidade.
- **Card específico** de notícia, com autor, data, engajamento e selo de checagem.
- **Whitelist de saída** no servidor: campo novo no model sem entrar na lista não vaza para o SSR.

**Rotas:** `/noticias`, `/noticias/[id]`

### 6.2 Análises e reviews

- **Análises de conteúdo** com título, tipo de conteúdo vinculado, nota de 1 a 5, capa e corpo dividido em seções.
- **Pontos positivos e negativos** estruturados.
- **Imagem e embed de vídeo por seção**.
- **Listagem própria** em `/analises` e página de leitura por slug.

**Rotas:** `/analises`, `/analises/novo`, `/analises/[slug]`

### 6.3 Cursos e estudos

- **Cursos com módulos e aulas** em vídeo e/ou material de leitura.
- **Inscrição, progresso por aula e lista "meus cursos"**.
- **Comentários por aula** e **avaliação do curso** (nota + review).
- **Página de aula** com navegação entre aulas.
- **Edição do curso** pelo autor.

**Rotas:** `/estudos`, `/estudos/novo`, `/estudos/[slug]`, `/estudos/[slug]/editar`, `/estudos/[slug]/aulas/[order]`

---

## 7. Agenda e eventos

- **Calendário com filtro por tipo**: geral, lançamento de jogo, game jam, maratona de stream, reunião e evento de estúdio.
- **Eventos públicos, para membros ou privados por convite**. Privado só é lido por quem criou ou foi convidado — negar é 404, não 403.
- **Criação e edição** com banner, local, link, descrição e organização.
- **Recorrência** diária, semanal, mensal ou anual, com dias da semana e término.
- **Dia inteiro** com término exclusivo (o formulário pede o último dia incluído; o servidor normaliza a fronteira).
- **Fuso fixo de Brasília** na exibição e na digitação — sem o clássico card com o dia anterior.
- **RSVP em três estados** (vou, talvez, não vou), com contadores, além de confirmação de presença de estúdios.
- **Posts vinculados** ao evento, com criação direta na página para quem organiza.
- **Página do evento** com endereço e mapa do local, links e contadores de presença.
- **Sitemap** inclui apenas eventos públicos e publicados; rascunho e evento privado ficam de fora.

**Rotas:** `/agenda`, `/agenda/criar`, `/agenda/[id]`, `/agenda/[id]/editar`

---

## 8. Reuniões (webconferência)

- **Reuniões agendadas por estúdio**, cada uma com sala própria no Galene (`<estúdio>/<reunião>`).
- **Entrada para membros** e **convidados por código**, sem precisar de conta.
- **Câmera, microfone e compartilhamento de tela**.
- **Layout em palco**: quem fala ocupa o topo, miniaturas dos demais ficam na faixa inferior; várias telas dividem o topo em grade.
- **Avatar do participante** carregado do Cloudinary, com allowlist de origem (o Galene é SFU e não expõe IP entre pares).
- **Encerrar reunião** faz quatro coisas: marca o fim no banco, fecha a sala, poda salas antigas e aplica lock para **expulsar** quem ainda está dentro. Sem o lock, o Galene não tem "expulsar todos".
- **Notificação de reunião agendada** leva direto à reunião, com o card destacado.
- **Link de participação** na página da reunião e na lista do estúdio.

**Rotas:** `/estudios/[slug]/reunioes`, `/reunioes/[meetingId]`

---

## 9. Loja

- **Produtos físicos e digitais** por estúdio, com preço, galeria, descrição e prazo de entrega.
- **Página da loja do estúdio** com gestão de produtos.
- **Pedidos** com quantidade, nota do comprador, endereço salvo ou novo e acompanhamento de status:

`Pendente → Orçamento enviado → Aceito → Pago → Enviado → Entregue` (além de `Cancelado` e `Recusado`).

- **Cancelamento** pelo comprador e atualização de status pelo estúdio.
- **E-mails automáticos** para comprador e estúdio (pedido recebido e status atualizado).
- **Meus pedidos** em `/loja/pedidos`.
- **Alavanca única de vendas**: `NEXT_PUBLIC_STORE_SALES_ENABLED` bloqueia pedidos no servidor, mostra o aviso em `/loja` e desabilita os atalhos "Loja" e "Pedidos" no estúdio. Hoje as vendas estão desligadas por padrão.

**Rotas:** `/loja`, `/loja/[slug]`, `/loja/pedidos`, `/estudios/[slug]/loja`, `/estudios/[slug]/pedidos`

---

## 10. Streams ao vivo

- **Agrega canais Twitch e YouTube** dos estúdios, com verificação periódica de status.
- **Listagem** com quem está ao vivo, título, audiência, miniatura e plataforma; canais offline em seção separada.
- **Página de assistir por estúdio** (`/streams/<slug>`) com player grande, tela cheia, informações da transmissão, ações do canal e lista de outros canais.
- **O endereço é o do estúdio**, não o da plataforma: continua o mesmo quando a transmissão troca de Twitch para YouTube.
- **Registro único de plataformas** (`lib/streams.js`) — uma plataforma nova entra como entrada nesse registro, sem nenhuma tela saber que ela existe.
- **Estúdio bloqueado pela moderação** sai da listagem, da página e do sitemap.

**Rotas:** `/streams`, `/streams/[slug]`

---

## 11. Serviços prestados

- **Catálogo curado pelo admin** em `/admin/services`, com cinco grupos fixos (Desenvolvimento; Arte e Áudio; Produção e Publicação; Qualidade e Idioma; Estratégia e Legal) e 13 serviços iniciais.
- **Declaração do estúdio**: quais serviços presta, com resumo e valor de referência (até 8 serviços).
- **Diretório `/servicos`** que filtra estúdios por serviço, com filtro por grupo aplicado na tela.
- **Contato direto** por mensagem — o preço é informativo e o negócio fecha na conversa.
- **Fila de sugestões** de qualquer usuário autenticado; aprovar cria o serviço na mesma chamada.
- **Serviço em uso não é excluído, é desativado**, com a contagem de estúdios na resposta de recusa.

**Rotas:** `/servicos`, `/servicos/sugerir`, `/admin/services`, aba Serviços do estúdio

---

## 12. Ferramentas

sete utilitários gratuitos, sem instalação e sem upload para servidor de terceiros:

| Ferramenta                | Rota                            | O que faz                                                            |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| **Gerador de QR Code**    | `/ferramentas/qrgen`            | QR com personalização de cores e marca central, download em imagem   |
| **Recortar imagem**       | `/ferramentas/imagecrop`        | Recorte com zoom, rotação e proporções predefinidas                  |
| **Visualizador XML/JSON** | `/ferramentas/viewer`           | Formatação, validação e navegação por estrutura                      |
| **Visualizador HTML**     | `/ferramentas/htmlviewer`       | Renderização de HTML colado em área isolada                          |
| **Visualizador Markdown** | `/ferramentas/mdviewer`         | Prévia de arquivo `.md` ou de texto colado, lado a lado com o código |
| **Imagens para PDF**      | `/ferramentas/imagens-para-pdf` | Junta imagens em PDF na ordem de envio e comprime PDFs existentes    |
| **Comprimir vídeo**       | `/ferramentas/comprimir-video`  | Compressão com `ffmpeg.wasm`, 100% no navegador                      |

Sobre o visualizador de Markdown:

- **Abre arquivo `.md`** (arrastar ou botão) ou aceita texto colado, com prévia atualizada enquanto se digita.
- **Três modos de visualização**: lado a lado, só prévia e só código, além de **maximizar** o espaço de trabalho (tela cheia com `Esc` para sair).
- **GFM**: títulos, listas (inclusive listas de tarefas), tabelas, citação, riscado, blocos de código e imagens.
- **Copiar o HTML gerado** e **baixar um `.html` autônomo**, pronto para abrir fora do site.
- **Seguro por desenho**: o HTML gerado passa pelo sanitizador (sem `script`, `iframe`, `style` inline, handlers `on*` ou `javascript:`), e imagens remotas entram pelo proxy de imagem para funcionar dentro da CSP de produção.

Sobre a compressão de vídeo:

- **O arquivo nunca sai da máquina** — não há upload, fila nem storage.
- **Presets**: status do WhatsApp, redes sociais (economia), WhatsApp como documento e alta qualidade (Full HD).
- **Alvo em MB inclui o áudio**, com piso de bitrate para não gerar vídeo ilegível.
- **Avisos honestos**: já cabe no alvo, resultado ficou maior que o original, compressão cancelada.
- **Cancelamento** termina o worker e invalida a execução em andamento.

---

## 13. Administração e moderação

- **Fila de denúncias** com resolução: validar (impacta reputação positivamente) ou arquivar (penaliza).
- **Moderação de conteúdo** por tipo de alvo: post, usuário, estúdio, jogo, jogo de mesa, livro, asset e conversa.
- **Leitura de conversas denunciadas** em modo somente leitura, restrita a administradores.
- **Congelamento de conversa** — os dois lados leem o histórico, ninguém escreve.
- **Catálogos**:
  - Tipos de contato
  - Ferramentas
  - Profissões (com grupo e ícone, sugeridas por usuários)
  - Serviços (com fila de sugestões)
  - Gêneros de jogos (dois níveis, com fila de sugestões que já vincula o gênero ao jogo)
  - Categorias de assets
- **Exclusão definitiva de conta** com confirmação por e-mail, recusa de autoexclusão, proteção do último admin e decisão sobre o estúdio (apagar ou transferir para membro ativo).
- **Status do servidor** com conexão do banco, migrações aplicadas e versão da API.
- **Trilha de auditoria** em `moderation_actions`, com o moderador responsável.
- **Menu Admin** só aparece para quem tem `read:admin`.

**Rotas:** `/admin`, `/admin/reports`, `/admin/moderation`, `/admin/conversas/[id]`, `/admin/contact-types`, `/admin/tools`, `/admin/professions`, `/admin/services`, `/admin/asset-categories`, `/admin/users`, `/status`

---

## 14. Plataforma (transversal)

### Descoberta e SEO

- **`SeoHead` único** com título, descrição, canonical, Open Graph e Twitter Cards.
- **JSON-LD por tipo**: `WebSite`, `VideoGame`, `Game`, `Book`, `NewsArticle`, `Review`, `Course`, `Event`, `CreativeWork` e `BreadcrumbList`, com escape anti-XSS.
- **Cards Open Graph gerados** em `/api/og/post/[id]`, `/api/og/event/[id]`, `/api/og/profile/[username]` e `/api/og/studio/[slug]`.
- **Sitemap em índice**, com um arquivo por tipo (estúdios, jogos, jogos de mesa, quadrinhos, cursos, notícias, análises, agenda, streams e assets) mais um para as rotas fixas, com `lastmod` real e o mesmo filtro de moderação das listagens.
- **Listagens montadas no servidor** — o HTML entregue já tem os links das entidades.
- **Um host canônico só**: `www` e `http` respondem 301 para o apex.
- **`noindex`** em áreas administrativas, press kits e páginas privadas; `robots.txt` coerente.
- **Rate limit** específico para sitemap, com teto maior para crawlers conhecidos (que escolhe o limiter, nunca a autorização).

### Experiência

- **Tema claro/escuro** por cookie, com modo automático seguindo o sistema. O escuro chega por dois caminhos (cookie e `prefers-color-scheme`) e é tratado como cidadão de primeira classe: sombra não existe sobre preto, a elevação é a superfície.
- **Sistema de design com tokens** de espaço, raio, elevação, movimento, tipografia e largura — sem `border-radius` solto nem cor hardcoded.
- **Responsivo** com layouts específicos para mobile (cards em linha, alvos de toque de 44px, cabeçalho de estúdio que empilha).
- **Acessibilidade**: abas com `role="tablist"` e navegação por setas, rótulos ARIA, foco visível e contraste revisado nos textos de marca e nos selos de estado (texto escolhido pela luminância do fundo).
- **Imagens com `next/image`** em todo o site, com cache imutável para os 31 MB do `ffmpeg`.

### Segurança

- **Autorização declarada em um único lugar** (`models/authorization.js`), com features concedidas na ativação e lista de features anônimas como fonte única do que é público.
- **Toda página que lê conteúdo no servidor tem gate** (`anonymousCan`) — sem gate, `getServerSideProps` burlaria o middleware.
- **Proteção contra SSRF** em image-proxy, pdf-proxy, preview de links e widget da itch.io: redirect seguido à mão, cada hop revalidado e endereço fixado na conexão.
- **Sanitização de HTML** de conteúdo de usuário, incluindo remoção de `style` (que permitiria sobreposição visual).
- **CPF como documento** (texto, não número), com normalização, validação e máscara progressiva.
- **Upload de imagem sempre pelo `ImageUploader`**, com recorte na proporção exata da superfície e presets em catálogo único.
- **CSP de produção** com `wasm-unsafe-eval`, `worker-src` e `media-src` para a ferramenta de vídeo.
- **Contas abandonadas e exclusão** tratadas em transação, com limpeza explícita de tabelas sem FK.

### Qualidade

- **ESLint** sem erros e sem warnings para entregar.
- **161 arquivos de teste** (unitários e de integração) cobrindo API, páginas, segurança, formatação de data, presets e regras de negócio.
- **Scripts de auditoria** que falham quando CSS Module, proporção de imagem, ordem de migração ou árvore do Galene divergem do documentado.
- **Commits em Conventional Commits**, com revisão obrigatória antes de push/merge.

---

## 15. Mapa rápido de rotas

### Públicas e de comunidade

| Rota             | Conteúdo                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`              | Home: proposta, métricas, destaques (até 3 jogos, 3 jogos de mesa, 3 livros e 3 assets), agenda, depoimentos e press kit |
| `/posts`         | Feed da comunidade                                                                                                       |
| `/membros`       | Diretório de membros                                                                                                     |
| `/estudios`      | Diretório de estúdios                                                                                                    |
| `/jogos`         | Catálogo de jogos digitais                                                                                               |
| `/jogos-de-mesa` | Catálogo de jogos de mesa                                                                                                |
| `/quadrinhos`    | Catálogo de livros e quadrinhos                                                                                          |
| `/assets`        | Catálogo de assets                                                                                                       |
| `/noticias`      | Notícias                                                                                                                 |
| `/analises`      | Análises e reviews                                                                                                       |
| `/estudos`       | Cursos                                                                                                                   |
| `/agenda`        | Agenda de eventos                                                                                                        |
| `/streams`       | Streams ao vivo                                                                                                          |
| `/servicos`      | Diretório de serviços                                                                                                    |
| `/presskit`      | Press kit oficial da plataforma                                                                                          |
| `/como-publicar` | Guia de publicação                                                                                                       |
| `/ferramentas/*` | Sete ferramentas                                                                                                         |
| `/status`        | Status do servidor                                                                                                       |

### Autenticadas

| Rota                               | Conteúdo                 |
| ---------------------------------- | ------------------------ |
| `/perfil/[username]`               | Perfil e abas            |
| `/perfil/[username]/configuracoes` | Edição do perfil         |
| `/perfil/[username]/curriculo`     | Currículo para impressão |
| `/estudios/novo`                   | Criar estúdio            |
| `/estudios/[slug]/configuracoes`   | Nove abas de gestão      |
| `/estudios/[slug]/reunioes`        | Reuniões do estúdio      |
| `/loja/pedidos`                    | Meus pedidos             |
| `/servicos/sugerir`                | Sugerir serviço          |

### Administrativas

`/admin`, `/admin/reports`, `/admin/moderation`, `/admin/conversas/[id]`, `/admin/contact-types`, `/admin/tools`, `/admin/professions`, `/admin/services`, `/admin/game-genres`, `/admin/asset-categories`, `/admin/users`, `/status`.

---

## 16. Limites atuais (o que não prometer no vídeo)

- **Loja**: o módulo está completo, mas as vendas estão **desligadas** por `NEXT_PUBLIC_STORE_SALES_ENABLED`. Não há checkout nem pagamento online — o pedido é registrado e conduzido pelo estúdio.
- **Mensagens**: não há tempo real; a conversa atualiza por consulta a cada 15 segundos.
- **Ajuda e suporte**: `/construcao/ajuda` e `/construcao/suporte` são páginas de "em construção".
- **Cursos**: não há certificado nem trilha obrigatória.
- **Galeria de screenshots**: depende de imagens cadastradas na mídia; hoje o envio de mídia grava vídeo.
- **Pacote de mídia em ZIP** para imprensa: não existe; o press kit é uma página para imprimir/salvar em PDF.
- **Idioma**: apenas pt-BR (sem `i18n`).
