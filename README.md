# Indies Brasil

Portal da comunidade de desenvolvedores indie brasileiros. Plataforma web com feed de posts, perfis de usuários, compartilhamento de projetos, sistema de comentários e muito mais.

---

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Rodando localmente](#rodando-localmente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Comandos de desenvolvimento](#comandos-de-desenvolvimento)
- [Deploy em VPS Hostinger](#deploy-em-vps-hostinger)
- [GitHub Actions](#github-actions)
- [Variáveis de ambiente](#variáveis-de-ambiente)

---

## Pré-requisitos

Você precisa ter instalado na sua máquina:

| Ferramenta  | Versão | Como instalar                                      |
| ----------- | ------ | -------------------------------------------------- |
| **Node.js** | 24.x   | https://nodejs.org (use a versão LTS mais recente) |
| **Docker**  | 24+    | https://docs.docker.com/get-docker/                |
| **Git**     | 2.x    | https://git-scm.com/downloads                      |

Para verificar se tudo está instalado, abra um terminal e execute:

```bash
node --version   # Deve retornar v24.x.x
docker --version # Deve retornar 24.x.x ou superior
git --version    # Deve retornar 2.x.x ou superior
```

---

## Rodando localmente

Siga cada passo na ordem. Se algum comando falhar, volte e verifique o passo anterior.

### 1. Clone o repositório

```bash
git clone https://github.com/Fagoabreu/IndiesBrasil.git
cd IndiesBrasil
```

### 2. Configure as variáveis de ambiente

Crie um arquivo chamado `.env.development` na raiz do projeto com o seguinte conteúdo:

```bash
# App
PORT=3000
NEXT_PUBLIC_SITE_NAME=IndiesBrasil
NEXT_PUBLIC_BASE_URL=localhost
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Segurança
PEPPER="3.14mentinha"

# Banco de dados (PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_DB=local_db
POSTGRES_PORT=5432
POSTGRES_USER=local_user
POSTGRES_PASSWORD=local_password
DATABASE_URL=postgres://local_user:local_password@localhost:5432/local_db
POSTGRES_CA_PATH=/etc/ssl/postgres/root.crt

# Email (Mailcatcher para desenvolvimento local)
EMAIL_HTTP_HOST=localhost
EMAIL_HTTP_PORT=1080
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
```

> 💡 **O que é cada coisa?** `PEPPER` é uma string secreta usada para aumentar a segurança das senhas. `DATABASE_URL` é o endereço de conexão com o banco de dados. `EMAIL_SMTP_*` são as credenciais do servidor de email — no desenvolvimento local usamos o Mailcatcher, que não precisa de usuário nem senha.

### 3. Instale as dependências

```bash
npm install
```

Este comando baixa todas as bibliotecas que o projeto precisa. Pode levar alguns minutos na primeira vez.

### 4. Suba a aplicação

```bash
npm run dev
```

Este comando faz três coisas automaticamente:

1. **Sobe os serviços** (PostgreSQL na porta `5432` e Mailcatcher na porta `1080`) usando Docker
2. **Aguarda o banco de dados** ficar pronto para receber conexões
3. **Executa as migrações** (cria as tabelas no banco de dados)
4. **Inicia o Next.js** em modo desenvolvimento

### 5. Acesse a aplicação

| Serviço                  | Endereço                  |
| ------------------------ | ------------------------- |
| **Frontend**             | http://localhost:3000     |
| **API**                  | http://localhost:3000/api |
| **Emails (Mailcatcher)** | http://localhost:1080     |

Se tudo deu certo, você verá a página inicial do Indies Brasil no navegador.

---

## Estrutura do projeto

```
IndiesBrasil/
├── components/          # Componentes React reutilizáveis
│   ├── PostCard/        # Card de post (feed)
│   ├── PostActions/     # Botões de curtir, comentar, compartilhar
│   ├── ShareModal/      # Modal de compartilhamento
│   ├── Header/          # Cabeçalho do site
│   ├── LeftSidebarComponent.js  # Menu lateral
│   ├── SeoHead.js       # Meta tags (SEO / OG / Twitter Cards)
│   └── ...
├── pages/               # Páginas (Next.js Pages Router)
│   ├── index.js         # Página inicial
│   ├── posts/[id].jsx   # Página de post individual
│   ├── perfil/          # Perfis de usuários
│   └── api/             # Rotas da API REST
├── models/              # Lógica de negócio (acesso a dados)
├── infra/               # Infraestrutura
│   ├── compose.yaml     # Docker Compose de desenvolvimento
│   ├── database.js      # Conexão com PostgreSQL
│   ├── migrations/      # Migrações do banco de dados
│   └── scripts/         # Scripts utilitários
├── context/             # Contextos React (UserContext, etc.)
├── lib/                 # Utilitários compartilhados
├── deploy/              # Arquivos de deploy em produção
│   ├── compose.yaml     # Docker Compose de produção
│   └── nginx/           # Configurações do Nginx
├── .github/workflows/   # GitHub Actions (CI/CD)
├── tests/               # Testes automatizados (Jest)
├── Dockerfile           # Imagem Docker para produção
├── package.json         # Dependências e scripts
└── .env.development     # Variáveis de ambiente locais
```

---

## Comandos de desenvolvimento

| Comando                                       | O que faz                                 |
| --------------------------------------------- | ----------------------------------------- |
| `npm run dev`                                 | Sobe tudo (banco, email, app) em modo dev |
| `npm test`                                    | Roda os testes automatizados              |
| `npm run lint`                                | Verifica o código com ESLint              |
| `npm run lint:prettier:fix`                   | Formata o código automaticamente          |
| `npm run migrations:create nome_da_migration` | Cria uma nova migration do banco          |
| `npm run services:stop`                       | Para os containers Docker                 |
| `npm run services:down`                       | Remove os containers Docker               |
| `npm run build`                               | Gera o build de produção                  |

---

## Deploy em VPS Hostinger

O deploy é feito automaticamente via GitHub Actions com um **runner auto-hospedado** no VPS. Isso significa que não há SSH entre servidores — o próprio VPS puxa o código e faz o deploy.

### Parte 1: Preparar o VPS

Faça login no seu VPS Hostinger como root via SSH.

#### 1.1 Instalar Docker e Git

```bash
# Atualizar pacotes
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Instalar Docker Compose (plugin)
apt install -y docker-compose-plugin

# Verificar instalação
docker --version
docker compose version
```

> 💡 O VPS da Hostinger geralmente já vem com Git instalado. Verifique com `git --version`.

#### 1.2 Criar estrutura de diretórios

```bash
mkdir -p /var/www/indies/nginx /var/www/indies/certs
```

Estas são as pastas onde a aplicação vai morar no servidor:

| Pasta                    | Conteúdo                                                 |
| ------------------------ | -------------------------------------------------------- |
| `/var/www/indies/`       | Arquivo `.env.production`, `compose.yaml`, imagem Docker |
| `/var/www/indies/nginx/` | Configurações do Nginx (HTTP e HTTPS)                    |
| `/var/www/indies/certs/` | Certificados SSL                                         |

#### 1.3 Abrir portas no firewall

```bash
# Se estiver usando UFW
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Verificar se as portas estão abertas
ufw status
```

As portas `80` (HTTP) e `443` (HTTPS) precisam estar acessíveis da internet.

#### 1.4 Configurar DNS

No painel da Hostinger (ou onde seu domínio estiver registrado), crie um registro A apontando seu domínio para o IP do VPS:

```
Tipo: A
Nome: @
Valor: 69.62.94.15  (substitua pelo IP do seu VPS)
TTL: 3600
```

> ⚠️ A propagação do DNS pode levar até 48 horas, mas geralmente leva de 5 a 30 minutos.

### Parte 2: Instalar o GitHub Actions Runner

O runner auto-hospedado é o que permite o deploy automático. Ele roda no próprio VPS e se conecta ao GitHub.

#### 2.1 Criar usuário para o runner

```bash
useradd -m -s /bin/bash github-runner
usermod -aG docker github-runner
```

> 💡 O runner **nunca** deve rodar como root por segurança. O grupo `docker` permite que ele execute containers.

#### 2.2 Baixar e configurar o runner

```bash
# Entrar como o usuário do runner
su - github-runner

# Baixar o runner
mkdir -p actions-runner && cd actions-runner
curl -o actions-runner.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-x64-2.322.0.tar.gz
tar xzf actions-runner.tar.gz
```

Agora gere um token de autenticação:

1. Vá para GitHub → seu repositório → **Settings** → **Actions** → **Runners**
2. Clique em **New self-hosted runner**
3. Escolha **Linux** e copie apenas o token (não o comando inteiro)
4. Execute no VPS:

```bash
./config.sh --url https://github.com/Fagoabreu/IndiesBrasil --token TOKEN_AQUI
```

Quando perguntar o nome do runner, pressione Enter para aceitar o padrão.

#### 2.3 Instalar como serviço (inicia automaticamente após reboot)

```bash
exit  # Volta para root
cd /home/github-runner/actions-runner
sudo ./svc.sh install github-runner
sudo ./svc.sh start github-runner
```

#### 2.4 Verificar se está funcionando

```bash
sudo ./svc.sh status
# Deve mostrar: "Active: active (running)"
```

No GitHub, vá em **Settings → Actions → Runners**. Deve aparecer um runner com status verde "Idle".

#### 2.5 Dar permissão de escrita nas pastas do deploy

```bash
chown -R github-runner:github-runner /var/www/indies
```

### Parte 3: Configurar variáveis de produção no GitHub

Vá para o GitHub: **Settings → Secrets and variables → Actions**.

#### Variáveis de ambiente (`Variables`)

| Nome                      | Valor                                    | Exemplo                                       |
| ------------------------- | ---------------------------------------- | --------------------------------------------- |
| `CERTBOT_DOMAIN`          | Seus domínios (separados por vírgula)    | `indiesbrasil.com.br,www.indiesbrasil.com.br` |
| `CERTBOT_EMAIL`           | Email para notificações do Let's Encrypt | `seu@email.com`                               |
| `NEXT_PUBLIC_SITE_NAME`   | Nome do site                             | `Indies Brasil`                               |
| `NEXT_PUBLIC_BASE_URL`    | Domínio principal                        | `indiesbrasil.com.br`                         |
| `NEXT_PUBLIC_SITE_URL`    | URL completa                             | `https://indiesbrasil.com.br`                 |
| `POSTGRES_HOST`           | Host do banco                            | `postgres`                                    |
| `POSTGRES_PORT`           | Porta do banco                           | `5432`                                        |
| `POSTGRES_DB`             | Nome do banco                            | `indies_prod`                                 |
| `POSTGRES_USER`           | Usuário do banco                         | `indies_user`                                 |
| `POSTGRES_CA_PATH`        | Caminho do certificado CA                | `/etc/ssl/postgres/root.crt`                  |
| `EMAIL_SMTP_HOST`         | Servidor SMTP                            | `smtp.seuprovedor.com`                        |
| `EMAIL_SMTP_PORT`         | Porta SMTP                               | `587`                                         |
| `EMAIL_SMTP_USER`         | Usuário SMTP                             | `seu@email.com`                               |
| `CLOUDINARY_CLOUD_NAME`   | Cloudinary cloud name                    | `seu-cloud`                                   |
| `FILE_UPLOAD_BASE_FOLDER` | Pasta de uploads                         | `/tmp/indies-uploads`                         |

#### Segredos (`Secrets`)

| Nome                    | Descrição                          |
| ----------------------- | ---------------------------------- |
| `PEPPER`                | String secreta para hash de senhas |
| `POSTGRES_PASSWORD`     | Senha do banco de dados            |
| `EMAIL_SMTP_PASSWORD`   | Senha do servidor SMTP             |
| `CLOUDINARY_API_KEY`    | Chave da API do Cloudinary         |
| `CLOUDINARY_API_SECRET` | Segredo da API do Cloudinary       |
| `TWITCH_CLIENT_ID`      | Client ID da API da Twitch         |
| `TWITCH_CLIENT_SECRET`  | Client Secret da API da Twitch     |
| `YOUTUBE_API_KEY`       | Chave da API do YouTube            |

### Parte 4: Primeiro deploy

Agora que tudo está configurado, faça um push para a branch `main`:

```bash
git add .
git commit -m "chore: deploy initial"
git push origin main
```

O deploy será executado automaticamente. Você pode acompanhar em: **GitHub → Actions → Deploy Indies Brasil**.

#### 4.1 Emitir certificado SSL (executar UMA VEZ após o primeiro deploy)

Vá para **GitHub → Actions → Deploy Infra (Manual)** → **Run workflow** e digite `DEPLOY` no campo de confirmação.

Isso irá:

- Solicitar o certificado SSL via Let's Encrypt (Certbot)
- Configurar o Nginx para servir HTTPS
- Seu site estará acessível em `https://seudominio.com.br`

#### 4.2 Verificar o deploy

Acesse seu domínio no navegador:

```
https://seudominio.com.br
```

Para verificar os containers que estão rodando no servidor:

```bash
docker ps
```

Você deve ver 4 containers: `postgres`, `indies-app`, `nginx` e `certbot`.

---

## GitHub Actions

O projeto tem 5 workflows configurados:

| Workflow                              | Quando executa                | O que faz                                        |
| ------------------------------------- | ----------------------------- | ------------------------------------------------ |
| **Deploy** (`deploy.yml`)             | Push na `main`                | Builda a imagem Docker e sobe a aplicação        |
| **Deploy Infra** (`deploy-infra.yml`) | Manual                        | Provisiona certificado SSL e sobe nginx/postgres |
| **Renew SSL** (`renew-ssl.yml`)       | Todo dia às 3h                | Renova o certificado SSL automaticamente         |
| **Linting** (`linting.yaml`)          | Pull request                  | ESLint + Prettier + CommitLint                   |
| **Tests** (`tests.yaml`)              | Pull request e push na `main` | Testes automatizados com Jest                    |

Todos os workflows de deploy (`deploy.yml`, `deploy-infra.yml`, `renew-ssl.yml`) rodam no **runner auto-hospedado** — os comandos são executados diretamente no VPS, sem SSH.

---

## Variáveis de ambiente

### `.env.development` (desenvolvimento local)

```bash
PORT=3000
NEXT_PUBLIC_SITE_NAME=IndiesBrasil
NEXT_PUBLIC_BASE_URL=localhost
NEXT_PUBLIC_SITE_URL=http://localhost:3000
PEPPER="uma-string-secreta"
POSTGRES_HOST=localhost
POSTGRES_DB=local_db
POSTGRES_PORT=5432
POSTGRES_USER=local_user
POSTGRES_PASSWORD=local_password
DATABASE_URL=postgres://local_user:local_password@localhost:5432/local_db
POSTGRES_CA_PATH=/etc/ssl/postgres/root.crt
EMAIL_HTTP_HOST=localhost
EMAIL_HTTP_PORT=1080
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
```

> 💡 No desenvolvimento local, `EMAIL_SMTP_USER` e `EMAIL_SMTP_PASSWORD` podem ficar vazios porque o Mailcatcher não exige autenticação.

### `.env.production` (produção — gerado automaticamente pelo CI)

Este arquivo é gerado pelo GitHub Actions no momento do deploy usando os valores de **Variables** e **Secrets** configurados no repositório. Você **não precisa criá-lo manualmente**.

---

## Tecnologias

- **Next.js 16** (Pages Router) + React 19
- **PostgreSQL** com node-pg-migrate
- **Primer React** (design system do GitHub)
- **Docker** + Docker Compose
- **Nginx** (proxy reverso)
- **Certbot** (certificados SSL via Let's Encrypt)
- **Cloudinary** (upload de imagens)
- **GitHub Actions** (CI/CD com runner auto-hospedado)

---

## Licença

MIT © Fabio Gomes de Abreu
