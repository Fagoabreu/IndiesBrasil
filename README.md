# IndiesBrasil

<p>Software instalado previamente: Postgress database, Docker.</p>
<p>if docker port not run net stop winnat</p>
<p>(toEqual\(\{[^}]*\n)
(\s*)
(password\s*:.*)</p>

<p>Necessário para a aplicação</p>
<p>npm versão 24</p>
<p>Docker</p>

<p>===================</P>
<p>Subir o ambiente de desenvolvimento completo</p>
<p>npm run dev</p>
<p>a aplicação irá subir o banco de dados postgrsql na porta 5432, mailcatcher na porta 1080 e executa a aplicação</p>
<p>frontend em localhost:3000</p>
<p>backend api em localhost:3000/pages/api</p>
<p>pafinas url</p>
<p>===================</p>
<p>Dev tools<p>
<p>Lint de code: npm run lint</p>
<p>Testes unitarios: npm run test</p>
<p>Database migration: npm run migrations:create {nome_arquivo}</p>
<p>Fix Formatação: npm run lint:prettier:fix </p>
<p>===================</p>
<p>Deploy</p>
<p>Criar uma image docker para deploy:</p>
<p>docker build -t indies-app .</p>
<p>Executar o compose com a imagem criada</p>
<p>docker-compose up -d </>
<p>===================</p>
<p> env.develop example</p>

<br/># App
<br/>PORT=3000
<br/>NEXT_PUBLIC_SITE_NAME=IndiesBrasil

<br/>#Security
<br/>PEPPER="3.14mentinha"

<br/>#DB
<br/>POSTGRES_HOST=localhost
<br/>POSTGRES_DB=local_db
<br/>POSTGRES_PORT=5432
<br/>POSTGRES_USER=local_user
<br/>POSTGRES_PASSWORD=local_password
<br/>DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/<br/>$POSTGRES_DB

<br/>#Email
<br/>EMAIL_SMTP_HOST=localhost
<br/>EMAIL_SMTP_PORT=1025
<br/>EMAIL_SMTP_USER=
<br/>EMAIL_SMTP_PASSWORD=
<br/>EMAIL_HTTP_HOST=localhost
<br/>EMAIL_HTTP_PORT=1080
<br/>NEXT_PUBLIC_BASE_URL=localhost

<p>===================</p>
<h2>Emissão de Certificado</h2>
docker compose up -d nginx <br>
docker compose run --rm certbot certonly \ <br>
  --webroot \ <br>
  -w /var/www/certbot \ <br>
  -d jogos.social.br <br>
`
======================= <br>
<h2>Pastas deploy no servidor</h2>
<h4>Pastas<h4>
/var/www/<br>
├── infra/                 # Criado manualmente (scp/rsync UMA VEZ) <br>
│   ├── docker-compose.yml<br>
│   ├── nginx/<br>
│   ├── certs/<br>
│   └── .env.production    # secrets da infra <br>
│<br>
└── indies/<br>
    ├── docker-compose.yml <br>
    ├── .env.production    # secrets do app (gerado pelo CI) <br>
    └── indies-app.tar.gz <br>
<br>
<br>
<h4>INFRA: COMO DEPLOYAR (1 ÚNICA VEZ)<h4>
rsync -az deploy/infra/ user@vps:/var/www/infra/ <br>
