# Roadmap — Jogos Social (2025 → 2029)

Plano de evolução da plataforma em cinco fases. Cada fase entrega algo utilizável por si mesmo: nada aqui depende de a seguinte existir.

> Status conferido no código em 15/11/2026. Para o retrato do que já está no ar, ver [funcionalidades.md](./funcionalidades.md) — este arquivo fala do que vem depois. O único item aberto da fase atual está detalhado em [verificacao-de-membros.md](./verificacao-de-membros.md).

---

## Como ler

- **Fases são cumulativas.** A fase 3 não substitui a 2; ela acrescenta.
- **O ano é janela, não promessa.** Serve para ordenar prioridade, não para anunciar data.
- **Status**: ✅ pronto · 🟡 parcial (base existe, falta o essencial) · ⬜ planejado.
- **Cada fase tem um critério de saída.** Sem isso a fase vira lista de desejos: o critério é o que autoriza dizer "acabou" e passar para a próxima.

## Visão geral

| Fase | Ano  | Tema                         | Estado                            |
| ---- | ---- | ---------------------------- | --------------------------------- |
| 1    | 2025 | Infraestrutura               | ✅ concluída                      |
| 2    | 2026 | Rede social                  | 🟡 em andamento                   |
| 3    | 2027 | Armazenamento e distribuição | ⬜ planejado                      |
| 4    | 2028 | Gestão de projetos           | ⬜ planejado                      |
| 5    | 2029 | Loja                         | 🟡 base pronta, vendas desligadas |

---

## Fase 1 — 2025: Infraestrutura ✅

Objetivo: existir de pé, com dado guardado, seguro e testado. Sem esta fase, todo o resto é protótipo.

| Item                                  | O que foi feito                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **APIs de frontend e backend**        | Next.js (Pages Router) + `next-connect`; rotas em `pages/api/v1/**` e `app/api/v1/**`, com autorização por feature em middleware                 |
| **Armazenamento de informações**      | PostgreSQL com `node-pg-migrate` (migrations versionadas e reversíveis); imagens e PDFs no Cloudinary                                            |
| **Segurança de dados**                | Features por usuário, sessão guardando o hash SHA-256 do token, rate limit por rota, sanitização de HTML, `safeFetch` contra SSRF e CSP no nginx |
| **Configuração de rede e containers** | `docker compose` (Postgres, Mailcatcher, Galene, nginx) com volumes e healthcheck                                                                |
| **Hospedagem**                        | VPS com nginx + HTTPS e host canônico único (`jogos.social.br`; `www` e `http` respondem 301)                                                    |
| **Testes unitários**                  | 536 testes unitários e suíte de integração por rota — a maior parte dos arquivos do repositório é teste                                          |
| **Desenvolvimento de utilitários**    | Sete ferramentas públicas que rodam no navegador (Markdown, HTML, recorte de imagem, imagens para PDF, OCR, QR Code, compressão de vídeo)        |
| **Automação do projeto**              | Scripts de auditoria (`audit-image-presets`, `audit-css-modules`, `repair-migration-order`, `sync-ffmpeg-core`), husky, commitizen e CI          |

**Critério de saída:** `npm run dev` sobe do zero numa máquina limpa, com migrations aplicadas, testes verdes e deploy reproduzível.

---

## Fase 2 — 2026: Rede social 🟡

Objetivo: virar a comunidade onde o desenvolvedor indie brasileiro se apresenta, publica e encontra estúdio.

| Item                                                                                     | Estado | O que existe hoje                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rede social** (posts, membros, cadastro, ativação, pontuações, tags, compartilhamento) | ✅     | Cadastro com ativação por e-mail, perfil público, reputação, tags e compartilhamento com card de OG por conteúdo                                |
| **Interações** (enquetes, curtir, comentar, integrações)                                 | ✅     | Enquetes em post, curtidas, comentários com resposta, embed de YouTube/Twitch/Instagram/Steam e cartão de prévia de link                        |
| **Currículo e press kit**                                                                | ✅     | Currículo imprimível por membro, press kit por obra nos três catálogos e press kit do estúdio                                                   |
| **Foco em estúdios**                                                                     | ✅     | Estúdios com papéis e hierarquia, jogos, jogos de mesa, livros/quadrinhos, assets, stream ao vivo e catálogo de serviços prestados              |
| **Classificação indicativa e de IA**                                                     | ✅     | Questionário alinhado ao ClassInd e ao ECA Digital, selos de monetização e faixas de uso de IA (0 a 5)                                          |
| **Videoconferência de estúdios**                                                         | ✅     | Galene por estúdio, sala por reunião, JWT com escopo de estúdio e encerramento com expulsão                                                     |
| **Notícias, avaliações e aulas**                                                         | ✅     | Notícias com checagem, análises de jogo/jogo de mesa/livro/asset e cursos com aula em PDF                                                       |
| **Moderação, sugestões e denúncias**                                                     | ✅     | Fila de denúncias, moderação por tipo de alvo, bloqueio aplicado em listagem/detalhe/sitemap e filas de sugestão de profissão, serviço e gênero |
| **Verificação de membros**                                                               | ⬜     | **Não existe.** Hoje o único critério de "conta real" é estar ativada, e o diretório já filtra por isso — falta a verificação de identidade     |

**Sobre "verificação de membros":** há três caminhos possíveis e eles não são a mesma coisa. A análise completa, com custo de banco, LGPD e recomendação, está em [verificacao-de-membros.md](./verificacao-de-membros.md).

**Atenção ao calendário:** 2026 está no fim. A verificação de membros é o único item aberto da fase — ou entra agora, ou passa a ser o primeiro item de 2027 em vez de ficar pendurada numa fase "concluída".

**Critério de saída:** um desenvolvedor que nunca ouviu falar do site consegue se cadastrar, publicar o próprio jogo, conversar com um estúdio e receber uma proposta de serviço sem sair da plataforma.

---

## Fase 3 — 2027: Armazenamento e distribuição ⬜

Objetivo: parar de ser catálogo e passar a hospedar. É a fase mais cara e a que muda a natureza do projeto: hoje o site **não hospeda** o asset — `assets.external_url` aponta para itch.io, Kenney, OpenGameArt e afins, justamente para não pagar banda de terceiros.

| Item                                                                                                                 | Nota de partida                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Custo de storage** (Amazon S3, alternativa nacional ou hospedagem própria) e teto de arquivo de post acima de 5 MB | Hoje o limite prático vem do upload para o Cloudinary. A decisão é escolher egress e backup antes de escolher fornecedor      |
| **Armazenamento de jogos** — rodar no navegador ou guardar o instalador/executável                                   | Duas trilhas bem diferentes: build web (HTML5/WebGL/WASM, roda em iframe com sandbox) e binário para download                 |
| **Game jams** com integração com a agenda e postagens                                                                | O _tipo de evento_ "Game Jam" já existe na agenda. Falta o sistema: submissão de jogo, prazo, votação e ranking               |
| **Integração Git / deploy automático** de demos e executáveis                                                        | Pipeline que transforma um push ou tag do repositório do estúdio em build publicado, com histórico de versão                  |
| **Storage do jogo final** (jogos gratuitos)                                                                          | Depende do item 1 e da política de moderação de binário                                                                       |
| **Área de divulgação de crowdfunding**                                                                               | Vitrine de campanha em andamento, com link externo e prazo — não é gateway de pagamento                                       |
| **Financiamento da rede social** (sustentável, sem foco no lucro)                                                    | Definir o modelo antes de crescer: doação recorrente, apoio de estúdios, edital ou serviço pago. Muda o que a fase 5 pode ser |

**Riscos que precisam de decisão antes do primeiro upload de binário:**

- **Custo de banda cresce com o sucesso**, não com o número de usuários: um jogo de 300 MB baixado 1.000 vezes são 300 GB. Sem teto por obra e sem CDN, a conta chega antes da comunidade.
- **Moderação de executável** é diferente de moderação de texto: malware, licença de conteúdo de terceiro e DMCA exigem política escrita e um canal de remoção.
- **Backup e retenção**: hoje o dado de texto está num único Postgres. Guardar binário sem política de backup é pior que não guardar.

**Critério de saída:** um jogo publicado na plataforma pode ser baixado ou jogado no navegador sem sair do site, com custo por obra conhecido e plano de remoção em caso de denúncia.

---

## Fase 4 — 2028: Gestão de projetos ⬜

Objetivo: acompanhar o projeto, não só divulgá-lo. Referências de mercado: Notion e ClickUp. Hoje o estúdio já tem equipe, papéis, reuniões, agenda e notificações — o que falta é o **documento** e o **fluxo de aprovação**.

| Item                                                   | Nota de partida                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **GDD** (Game Design Document)                         | Documento longo, com seções e histórico de versão                                                                           |
| **TDD** (Technical Design Document)                    | Mesma estrutura, com dono por seção — o papel do membro no estúdio já existe                                                |
| **Bíblia da História** (Story Bible)                   | Personagens, locais e cronologia com referência cruzada                                                                     |
| **Cronograma / Gantt**                                 | Tarefas com prazo, responsável e dependência, ligadas às entregas                                                           |
| **SGDD** (GDD resumido)                                | Versão de uma página para apresentar a terceiros — reaproveita o formato do press kit                                       |
| **Fluxo de desenvolvimento com entregas e aprovações** | Estados de entrega (rascunho → em revisão → aprovado) com notificação, no mesmo padrão de `org_notifications` que já existe |
| **Estágio**                                            | Vínculo de estudante com o estúdio, com escopo e duração                                                                    |

**Alavancas que já existem e devem ser reaproveitadas em vez de recriadas:**

- `lib/markdown.js` e `/ferramentas/mdviewer` já renderizam Markdown com sanitização — GDD em Markdown sai quase de graça e continua editável fora do site.
- Os papéis do estúdio (`org_members` / `org_roles`) já respondem "quem pode aprovar".
- O `PrintBar` do press kit e do currículo já resolve "exportar para PDF".
- A agenda e as reuniões já existem: cronograma é a mesma pergunta ("o que acontece quando") num formato diferente.

**Critério de saída:** um estúdio de três pessoas conduz um projeto inteiro na plataforma — documento, tarefa, entrega e aprovação — sem exportar para outra ferramenta.

---

## Fase 5 — 2029: Loja 🟡

Objetivo: vender. A base já está construída e **desligada de propósito**: `STORE_SALES_ENABLED` (`lib/store-constants.js`) bloqueia o pedido no servidor e mostra o aviso em `/loja`. Não é código faltando — é decisão de produto esperando o resto.

| Item                                                        | Estado | Nota                                                                                                               |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| **Indicar produtos na loja do estúdio**                     | 🟡     | `/estudios/[slug]/loja` e `store_products` existem, com elegibilidade do estúdio (CNPJ válido, endereço e contato) |
| **Pedido de compra e direcionamento para o estúdio**        | 🟡     | O pedido é registrado e conduzido pelo estúdio; não há checkout                                                    |
| **Acompanhamento de pedido**                                | 🟡     | `/loja/pedidos` lista o pedido; falta status por etapa com notificação                                             |
| **Integração com meios de pagamento** (Pix, boleto, cartão) | ⬜     | Não existe. É o item que autoriza ligar a flag                                                                     |
| **Conformidade fiscal**                                     | ⬜     | Não existe. É o item que decide se a plataforma **intermedia** ou apenas **indica**                                |

**A decisão que muda tudo: intermediar ou indicar.**

- **Indicar** (vitrine): a plataforma mostra o produto e leva a pessoa a comprar no site do estúdio. Sem split, sem nota fiscal da plataforma, sem chargeback. Muito mais barato — e é o que o código faz hoje.
- **Intermediar**: a plataforma recebe e repassa. Aí entram emissão de nota, retenção tributária, split, estorno, direito de arrependimento de 7 dias do CDC e contabilidade mensal. É um produto novo, não uma feature.

Recomendação: lançar a fase 5 como **vitrine com pedido registrado** (ligar a flag no modelo atual) e tratar pagamento como um marco separado, só depois de a operação de pedido estar rodando.

**Critério de saída:** um estúdio recebe um pedido e o comprador consegue acompanhá-lo até a entrega, com o modelo fiscal escrito e em dia.

---

## Decisões em aberto (uma por fase)

Cada fase tem **uma** decisão que trava as outras. Adiar essas decisões é o que faz roadmap virar lista.

| Fase | Decisão que destrava a fase                                                                     |
| ---- | ----------------------------------------------------------------------------------------------- |
| 2    | Qual é o critério de "membro verificado": documento, domínio ou CNPJ?                           |
| 3    | Onde o arquivo mora (nuvem estrangeira, nacional ou própria) e quanto se aceita pagar por banda |
| 4    | Documento nasce e morre na plataforma ou é espelho de um repositório?                           |
| 5    | A plataforma intermedeia a venda ou apenas indica?                                              |

## O que este roadmap não promete

- **Data de entrega.** O ano indica ordem de prioridade.
- **Que a fase anterior esteja 100% pronta.** A verificação de membros, por exemplo, pode atravessar 2026/2027 sem travar o resto.
- **Tempo real.** Mensagens e notificações continuam por consulta; tempo real não está em nenhuma fase.
- **App nativo.** Tudo é web.
