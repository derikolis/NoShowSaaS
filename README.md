# Kired — No-Show Protection SaaS

Sistema de redução de faltas em agendamentos para clínicas, barbearias, estúdios e similares.

---

## Arquitetura

```
kired.com.br (Vercel)          noshowsaas.onrender.com (Render)
      │                                    │
  React + Vite                    Node.js + Express
  frontend/                        backend/
                                      │
                              PostgreSQL (Render)
                              Redis (Render / local)
```

---

## Stack

| Camada      | Tecnologia                        |
|-------------|-----------------------------------|
| Frontend    | React + Vite + Tailwind CSS       |
| Backend     | Node.js + Express + TypeScript    |
| Banco       | PostgreSQL + Prisma ORM           |
| Filas       | BullMQ + Redis                    |
| WhatsApp    | Evolution API                     |
| Auth        | JWT via httpOnly cookies          |
| Deploy      | Vercel (frontend) + Render (backend + banco) |

---

## Rodar localmente

### 1. Pré-requisitos

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Git](https://git-scm.com)

### 2. Clonar e instalar

```bash
git clone https://github.com/derikolis/NoShowSaaS.git
cd NoShowSaaS
```

### 3. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Abra `backend/.env` e preencha os campos obrigatórios (ver seção abaixo).

Para o frontend, crie `frontend/.env.local`:
```
VITE_API_URL=http://localhost:4000
```

### 4. Subir banco de dados e Redis

```bash
docker-compose up -d
```

Isso sobe PostgreSQL (porta 5432), Redis (porta 6379) e Evolution API (porta 8080).

### 5. Rodar migrations e iniciar

```powershell
# No PowerShell, execute o script de setup:
.\scripts\start-dev.ps1
```

Ou manualmente em dois terminais separados:

```bash
# Terminal 1 — Backend
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

```bash
# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

### 6. Acessar

| Serviço        | URL                          |
|----------------|------------------------------|
| Frontend       | http://localhost:3000        |
| Backend API    | http://localhost:4000/api    |
| Prisma Studio  | `npm run db:studio` (backend)|
| Evolution API  | http://localhost:8080        |

---

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável              | Obrigatória | Descrição                                      |
|-----------------------|-------------|------------------------------------------------|
| `DATABASE_URL`        | ✅           | URL do PostgreSQL                              |
| `REDIS_URL`           | ✅           | URL do Redis (BullMQ)                          |
| `JWT_SECRET`          | ✅           | Segredo para assinar tokens JWT                |
| `JWT_EXPIRES_IN`      | —           | Expiração do token (padrão: `7d`)              |
| `FRONTEND_URL`        | ✅           | URL do frontend (CORS) — separar por vírgula se múltiplos |
| `ADMIN_EMAIL`         | ✅           | Email do super-admin                           |
| `ADMIN_PASSWORD_HASH` | ✅           | Hash bcrypt da senha do super-admin            |
| `EVOLUTION_API_URL`   | —           | URL da Evolution API (WhatsApp)                |
| `EVOLUTION_API_KEY`   | —           | Chave de autenticação da Evolution API         |
| `EVOLUTION_INSTANCE`  | —           | Nome da instância WhatsApp                     |
| `SMTP_HOST`           | —           | Host SMTP para envio de e-mails                |
| `SMTP_PORT`           | —           | Porta SMTP (padrão: 587)                       |
| `SMTP_SECURE`         | —           | `true` para SSL (porta 465)                    |
| `SMTP_USER`           | —           | Usuário SMTP                                   |
| `SMTP_PASS`           | —           | Senha SMTP                                     |
| `SMTP_FROM`           | —           | E-mail remetente                               |

### Frontend (`frontend/.env.local`)

| Variável       | Descrição              |
|----------------|------------------------|
| `VITE_API_URL` | URL base do backend    |

---

## Gerar credenciais

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ADMIN_PASSWORD_HASH
node -e "require('bcryptjs').hash('sua-senha', 10).then(console.log)"
```

---

## Ver banco de dados (Prisma Studio)

**Local:**
```bash
cd backend && npm run db:studio
```

**Produção (Render):**
```powershell
$env:DATABASE_URL="postgresql://user:senha@host.render.com/noshow_postgres?sslmode=require"; npx prisma studio
```
A URL de produção está no painel do Render → banco → **External Database URL**.

---

## Deploy

O deploy é automático via GitHub:

| Push para `main` | Render detecta e faz deploy do backend automaticamente |
|------------------|--------------------------------------------------------|
| Push para `main` | Vercel detecta e faz deploy do frontend automaticamente |

Para forçar um redeploy manual, acesse o painel do Render ou Vercel.

### Render — variáveis de ambiente necessárias

Configure em Render → Backend service → **Environment**:

```
DATABASE_URL          = (gerado automaticamente pelo banco Render)
REDIS_URL             = (URL do Redis Render ou externo)
JWT_SECRET            = (gere com o comando acima)
FRONTEND_URL          = https://kired.com.br
ADMIN_EMAIL           = admin@kired.com.br
ADMIN_PASSWORD_HASH   = (gere com o comando acima)
EVOLUTION_API_URL     = (URL da sua Evolution API)
EVOLUTION_API_KEY     = (chave da Evolution API)
EVOLUTION_INSTANCE    = noshow
```

---

## Estrutura do projeto

```
NoShowSaaS/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Modelos do banco
│   │   └── migrations/            # Migrations versionadas
│   ├── src/
│   │   ├── modules/               # Módulos da aplicação
│   │   │   ├── admin/             # Painel super-admin
│   │   │   ├── auth/              # Login/logout tenant
│   │   │   ├── booking/           # Agendamento público + portal do cliente
│   │   │   ├── clients/           # CRUD de clientes
│   │   │   ├── dashboard/         # Métricas
│   │   │   ├── notifications/     # WhatsApp
│   │   │   ├── payments/          # PIX (MP, Stripe, AbacatePay)
│   │   │   ├── professionals/     # CRUD de profissionais
│   │   │   ├── risk-engine/       # Score de risco
│   │   │   ├── scheduling/        # CRUD de agendamentos
│   │   │   ├── services/          # CRUD de serviços
│   │   │   ├── settings/          # Configurações do tenant
│   │   │   ├── users/             # Usuários da empresa
│   │   │   └── waitlist/          # Lista de espera
│   │   ├── jobs/                  # Workers BullMQ (lembretes)
│   │   ├── shared/                # Middlewares, tipos, utilitários
│   │   ├── webhooks/              # Webhooks externos (WhatsApp)
│   │   ├── app.ts                 # Express + middlewares
│   │   └── server.ts              # Entry point
│   └── package.json
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── app/               # Painel do tenant
│       │   ├── admin/             # Painel super-admin
│       │   ├── booking/           # Página pública de agendamento
│       │   └── landing/           # Landing page
│       ├── hooks/                 # useAuth, useAdminAuth
│       ├── services/              # api.ts, adminApi.ts (axios)
│       └── components/            # Componentes compartilhados
├── scripts/
│   └── start-dev.ps1              # Inicia tudo de uma vez (Windows)
├── docker-compose.yml             # Postgres + Redis + Evolution API local
└── README.md
```

---

## O que falta implementar

Ver [TODO.txt](TODO.txt) para a lista completa priorizada.
