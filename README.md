# Frontend PFM

Frontend do sistema financeiro integrado ao [backend-pfm](https://github.com/Derik-Carv/backend-pfm).

## Autoria

Este frontend é de autoria de [Renan Miranda](https://github.com/renanbmiranda).  
A publicação deste repositório e as adaptações de integração, containerização e painel administrativo são feitas com autorização do autor.

## Requisitos

- Bun
- Docker e Docker Compose para execução opcional em container

## Desenvolvimento local

```bash
bun install
cp .env.example .env.local
```

Configure `.env.local`:

```env
VITE_API_URL=http://localhost:3336
```

Inicie o frontend:

```bash
bun run dev
```

## Deploy na Vercel

O projeto está configurado para Vercel em [vercel.json](./vercel.json).

1. Importe `Derik-Carv/frontend-pfm` na Vercel.
2. Use o preset **Vite**.
3. Configure `VITE_API_URL` como a URL **HTTPS** pública da API na VM.
4. Faça o deploy.

Exemplo:

```env
VITE_API_URL=https://api.seu-dominio.com
```

Não use `http://137.131.254.117:3336` em produção: o frontend da Vercel será
servido por HTTPS e o navegador bloqueará essa chamada por mixed content.

Após o primeiro deploy, configure no backend `CORS_ORIGIN` com o domínio
gerado pela Vercel, por exemplo:

```env
CORS_ORIGIN=https://frontend-pfm.vercel.app
```

Se houver domínio próprio, prefira configurar o domínio final:

```env
CORS_ORIGIN=https://app.seu-dominio.com
```

## Produção com Docker

Defina a URL pública da API antes de iniciar:

```bash
export VITE_API_URL=http://137.131.254.117:3336
export FRONTEND_PORT=8080
docker compose up -d --build
```

O frontend ficará disponível na porta configurada em `FRONTEND_PORT`.

> A URL da API é incorporada durante o build do Vite. Após alterá-la, recrie a imagem.

## Funcionalidades

- Autenticação e troca obrigatória da senha inicial.
- Dashboard de serviços e clientes.
- Cadastro e consulta de notas fiscais.
- Painel administrativo restrito ao perfil `administrator`.

## Licença e colaboração

Consulte o autor antes de redistribuir, relicenciar ou reutilizar este código fora do projeto.
