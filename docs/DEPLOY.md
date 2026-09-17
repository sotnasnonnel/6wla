# Publicar o 6wla no servidor da PHD

Destino: `https://restricoes.phdengenharia.tech`, num servidor com Docker e
Nginx ou Caddy (o mesmo tipo de servidor do n8n `procint`).

O que roda onde:

- **6wla** (este repositório): container Docker na porta local `3006`.
- **Nginx/Caddy**: publica `restricoes.phdengenharia.tech` com HTTPS e repassa
  para `127.0.0.1:3006`.
- **Supabase**: banco e login (projeto "PHD View / 6wla", já existe).
- **n8n**: a cada 15 min chama `/api/automacoes/*` do 6wla e envia os e-mails.

## 1. DNS

No painel onde o domínio `phdengenharia.tech` é gerenciado, crie:

| Tipo | Nome         | Valor                                                                 |
| ---- | ------------ | --------------------------------------------------------------------- |
| A    | `restricoes` | IP público do servidor (o mesmo do `procint`, se for a mesma máquina) |

Se usar Cloudflare, deixe **DNS only** (nuvem cinza) até o HTTPS funcionar.

Confira: `nslookup restricoes.phdengenharia.tech` deve responder o IP.

## 2. Código no servidor

```bash
cd /opt            # ou a pasta onde ficam os apps
git clone https://github.com/sotnasnonnel/6wla.git
cd 6wla
git checkout main  # ou a branch que for publicada
```

## 3. Variáveis de produção

Crie o arquivo `6wla.producao` na pasta do projeto (ele já está no
`.gitignore`; nunca commite):

```bash
nano 6wla.producao
chmod 600 6wla.producao
```

Conteúdo (troque os valores; copie do `.env.local` de quem desenvolve):

```ini
# Públicas (entram no build)
NEXT_PUBLIC_SUPABASE_URL=https://cmuocmbvsdelayzjdmhi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=https://restricoes.phdengenharia.tech

# Segredos (só no servidor)
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
AUTOMACOES_TOKEN=<token aleatório, ver abaixo>
# n8n: a aba Automações cria o fluxo "<código da obra> - Restrições" (passo 7)
N8N_URL=https://<endereço do n8n procint>
N8N_API_KEY=<chave da API do n8n>
N8N_CREDENCIAL_SMTP_ID=<id da credencial SMTP no n8n>
N8N_CREDENCIAL_TOKEN_ID=<id da credencial Header Auth no n8n>
GEMINI_API_KEY=<chave do Gemini>
# opcionais
# GEMINI_MODEL=gemini-3.5-flash
# POWERBI_API_TOKEN=<token do Power BI>
```

Para gerar o `AUTOMACOES_TOKEN` (no servidor):

```bash
openssl rand -hex 32
```

Guarde esse valor: ele vai também na credencial do n8n (passo 7).

## 4. Subir o container

```bash
docker compose --env-file 6wla.producao up -d --build
docker compose logs -f 6wla     # Ctrl+C para sair
curl -I http://127.0.0.1:3006/login   # deve responder 200
```

Se a porta `3006` já estiver em uso, troque no `docker-compose.yml`
(`127.0.0.1:OUTRA:3000`) e no proxy abaixo.

## 5. HTTPS

### Opção A — Caddy

No `Caddyfile` do servidor, acrescente:

```caddy
restricoes.phdengenharia.tech {
    encode gzip
    request_body {
        max_size 25MB
    }
    reverse_proxy 127.0.0.1:3006
}
```

Depois: `sudo systemctl reload caddy` (ou `docker exec <caddy> caddy reload
--config /etc/caddy/Caddyfile` se o Caddy roda em container). O certificado
sai sozinho.

### Opção B — Nginx + Certbot

Crie `/etc/nginx/sites-available/restricoes.phdengenharia.tech`:

```nginx
server {
    listen 80;
    server_name restricoes.phdengenharia.tech;

    # Importação de planilha: até 20 MB.
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/restricoes.phdengenharia.tech /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d restricoes.phdengenharia.tech
```

Se o Nginx roda em container (e não no host), use o IP/nome do host no
`proxy_pass` (ex.: `http://host.docker.internal:3006` ou coloque o 6wla na
mesma rede Docker do Nginx e use `http://6wla:3000`).

Confira: abrir `https://restricoes.phdengenharia.tech` e fazer login.

## 6. Supabase

Painel do projeto **PHD View / 6wla** → Authentication → URL Configuration:

- **Redirect URLs** (adicionar, sem `*`):
  - `https://restricoes.phdengenharia.tech/definir-senha`
  - `http://localhost:3000/definir-senha`
- **Site URL**: só troque para `https://restricoes.phdengenharia.tech` se hoje
  não aponta para o PHD View (o valor vale para os dois apps).

## 7. n8n (automações por e-mail)

O 6wla cria sozinho, pela API do n8n, um fluxo por obra chamado
`<código da obra> - Restrições` quando o gestor salva a primeira automação
na aba **Automações**. O fluxo roda a cada 15 min, pede ao 6wla os e-mails
daquela obra, envia pelo SMTP e confirma cada envio. Pausar todas as
automações desativa o fluxo; excluir todas apaga o fluxo.

Uma vez só, no n8n (`procint`):

1. **Chave da API**: Settings → n8n API → Create an API key. Vai em
   `N8N_API_KEY`; o endereço do n8n (sem `/api/v1`) vai em `N8N_URL`.
2. **Credencial do token**: Credentials → Add credential → **Header Auth**
   - Name: `Authorization`
   - Value: `Bearer <AUTOMACOES_TOKEN>` (o mesmo do passo 3)
   - Nome da credencial: `6wla – automações`
3. **Credencial SMTP**: a conta de `sistema@phdengenharia.eng.br` (a mesma
   do fluxo antigo).
4. Copie o **id** de cada credencial (aparece na URL ao abri-la:
   `.../credentials/<id>`) para `N8N_CREDENCIAL_TOKEN_ID` e
   `N8N_CREDENCIAL_SMTP_ID`, e refaça o passo 4.

Teste:

- `curl -H "Authorization: Bearer <token>" "https://restricoes.phdengenharia.tech/api/automacoes/pendentes?obra=<id da obra>"`
  deve responder `[]` (ou a lista de e-mails). `400` = faltou `obra`;
  `401` = token diferente; `503` = `AUTOMACOES_TOKEN` não chegou ao container.
- Na aba Automações, crie uma automação: o aviso no topo deve dizer
  "Fluxo “<código> - Restrições” ativo no n8n", e o fluxo aparece no n8n.
  Use "Enviar teste para mim" e confira a chegada em até 15 min.
- Validado, desligue no n8n o fluxo antigo `IMCS-CT09-PLAN - Restrições`.

## 8. Atualizar depois

```bash
cd /opt/6wla
git pull
docker compose --env-file 6wla.producao up -d --build
docker image prune -f
```

Migrations do banco são aplicadas à parte (não fazem parte do deploy).

## Problemas comuns

| Sintoma                                                               | Causa provável                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Container reinicia com "Variáveis de ambiente públicas inválidas"     | Faltou `NEXT_PUBLIC_*` no `6wla.producao` na hora do build: refaça com `--build`. |
| Convite chega, mas o link abre outro site                             | Redirect URL não cadastrada no Supabase (passo 6).                                |
| Convite não é enviado e o log diz `NEXT_PUBLIC_SITE_URL não definida` | Variável faltando; refaça o build.                                                |
| Importação de planilha falha com arquivo grande                       | `client_max_body_size` / `max_size` do proxy.                                     |
| n8n recebe 503                                                        | `AUTOMACOES_TOKEN` ausente no container.                                          |
| Aba Automações diz que a integração não está configurada              | Falta alguma `N8N_*` (ou `NEXT_PUBLIC_SITE_URL`) no `6wla.producao`.              |
| Aba Automações mostra erro ao sincronizar                             | Chave da API ou id de credencial errado; detalhe no `docker compose logs 6wla`.   |
