# Frontend PFM

Frontend do sistema financeiro integrado ao [backend-pfm](https://github.com/Derik-Carv/backend-pfm).

## Autoria

Este frontend é de autoria de [Renan Miranda](https://github.com/renanbmiranda).  
A publicação deste repositório e as adaptações de integração, containerização e painel administrativo são feitas com autorização do autor.

## Requisitos

- Bun
- Docker e Docker Compose para execução em container

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
