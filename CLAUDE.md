# CLAUDE.md — No-Show Protection SaaS
> Estado atual do projeto em 16/05/2026. Consultar no início de cada sessão.

---

## STATUS DO MVP

**Backend: COMPLETO** — todas as 10 etapas implementadas e funcionando.
**Frontend: COMPLETO + POLIDO** — todas as páginas construídas e melhoradas.
**Admin: COMPLETO** — painel super admin em `/admin` com login próprio.
**Integração WhatsApp: parcial** — Evolution API configurada para dev; webhook recebendo.

O produto está tecnicamente pronto para teste com usuário real.
O próximo passo é validação, não mais código.

---

## O QUE JÁ ESTÁ IMPLEMENTADO

### Backend (`/backend/src`)

| Módulo | Arquivo | Status |
|---|---|---|
| Auth (JWT + multi-tenant) | `modules/auth/` | ✅ Completo |
| Clientes (CRUD + LGPD + histórico) | `modules/clients/` | ✅ Completo |
| Profissionais | `modules/professionals/` | ✅ Completo |
| Agendamentos | `modules/scheduling/` | ✅ Completo |
| Motor de risco (score) | `modules/risk-engine/` | ✅ Completo |
| Notificações WhatsApp | `modules/notifications/` | ✅ Completo |
| Lista de espera | `modules/waitlist/` | ✅ Completo |
| Dashboard (métricas) | `modules/dashboard/` | ✅ Completo |
| Configurações + QR | `modules/settings/` | ✅ Completo |
| Webhook WhatsApp | `webhooks/whatsapp.webhook.ts` | ✅ Completo |
| Jobs BullMQ (lembretes) | `jobs/` | ✅ Completo |
| Auditoria | `shared/utils/audit.ts` | ✅ Completo |
| Admin (painel super admin) | `modules/admin/` | ✅ Completo |
| Métricas por profissional | `modules/users/users.routes.ts` | ✅ GET /users/metrics |

### Frontend (`/frontend/src`)

Estrutura de pastas: `pages/app/` (tenant), `pages/admin/` (super admin), `pages/client/` (reservado para portal do cliente final)

| Página | Arquivo | Status | Destaques |
|---|---|---|---|
| Login | `pages/app/LoginPage.tsx` | ✅ | Toggle de senha |
| Cadastro | `pages/app/RegisterPage.tsx` | ✅ | Força de senha + regras em tempo real |
| Dashboard | `pages/app/DashboardPage.tsx` | ✅ | Agenda do dia, gráfico no-shows, comparativo semanal |
| Agendamentos | `pages/app/AppointmentsPage.tsx` | ✅ | Navegação Dia/Semana/Mês, filtro profissional, ações inline |
| Clientes | `pages/app/ClientsPage.tsx` | ✅ | Cards de resumo, última visita, histórico no drawer |
| Profissionais | `pages/app/ProfessionalsPage.tsx` | ✅ | Grid de cards com métricas por profissional |
| Configurações | `pages/app/SettingsPage.tsx` | ✅ | Nav lateral, WhatsApp QR |
| Admin Login | `pages/admin/AdminLoginPage.tsx` | ✅ | Tema escuro, credenciais via env |
| Admin Dashboard | `pages/admin/AdminDashboardPage.tsx` | ✅ | KPIs de tenants |
| Admin Empresas | `pages/admin/AdminTenantsPage.tsx` | ✅ | CRUD de tenants, ativar/bloquear |

### Banco de dados

Migrations aplicadas:
- Schema base (Tenant, User, Client, Appointment, Waitlist, Notification, AuditLog)
- LGPD: campo `consentedAt` no Client
- WhatsApp: campos Evolution API por tenant
- `status` no Tenant (active | inactive | blocked)

---

## STACK

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend | Node.js + TypeScript | TS 6, Express 5 |
| Frontend | React + Vite | React 19, Vite 8 |
| Banco | PostgreSQL | 16 |
| ORM | Prisma + adapter pg | 7.8 |
| Jobs | BullMQ | 5 |
| Cache | Redis (ioredis) | 7 |
| Containers | Docker Compose | — |
| WhatsApp DEV | Evolution API v1.8.2 | self-hosted |
| WhatsApp PROD | API oficial Meta | ⚠️ pendente |

---

## ARQUITETURA

Monolito modular. Cada módulo em `/backend/src/modules/<nome>/`.

```
backend/src/
  modules/
    auth/           → register, login
    admin/          → adminLogin, stats, listTenants, createTenant, updateStatus
    clients/        → CRUD, LGPD delete, getClientHistory (últimos 5 + stats)
    professionals/  → CRUD (só owner cria)
    scheduling/     → create, cancel, confirm, reschedule, no-show
    risk-engine/    → calculateScore, recalculateClientScore
    notifications/  → scheduleRiskBasedReminders, sendWhatsApp
    waitlist/       → addToWaitlist, notifyNextInWaitlist
    dashboard/      → getDashboardStats (today, weekComparison, noShowsByDay)
    settings/       → status WA, QR, test, evolutionInstance por tenant
    users/          → CRUD, GET /metrics (stats por profissional)
  webhooks/
    whatsapp.webhook.ts  → recebe eventos Evolution API
  jobs/
    queues.ts            → notificationQueue, riskRecalcQueue
    scheduler.ts         → jobs recorrentes (cron)
    notification.worker.ts → processa todos os tipos de job
  shared/
    middlewares/     → authMiddleware, requireRole, adminMiddleware, errorMiddleware
    types/           → ApiResponse, JwtPayload, express.d.ts
    utils/           → prisma.ts (PrismaPg), audit.ts
```

---

## AUTENTICAÇÃO — DOIS SISTEMAS SEPARADOS

| Sistema | Token | Armazenamento | Proteção |
|---|---|---|---|
| Tenant (empresa) | `noshow_token` | localStorage | `authMiddleware` |
| Super Admin | `noshow_admin_token` | localStorage | `adminMiddleware` (role: superadmin) |

- `App.tsx` lê localStorage diretamente (não usa hook) para evitar estado stale entre instâncias
- Login e logout usam `window.location.href` (reload forçado) para garantir leitura fresca do token
- Credenciais admin via env vars: `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`

---

## MOTOR DE RISCO

Sistema de score por regras — sem IA.

| Evento | Pontos |
|---|---|
| Cliente novo | +15 |
| Faltou 1x | +20 |
| Faltou 2x ou mais | +40 |
| Horário de pico (12–14h, 18–20h) | +20 |
| Agendamento última hora (< 2h) | +25 |
| Confirmou presença | -30 |
| Cliente VIP | -20 |

| Score | Nível | Ação |
|---|---|---|
| 0–30 | Baixo | Lembrete padrão (24h + 2h) |
| 31–60 | Médio | + confirmação 4h antes |
| 61–100 | Alto | + confirmação 6h antes + bloqueia horário de pico |

---

## JOBS BULLMQ

| Job | Quando | Tipo |
|---|---|---|
| `reminder_24h` | 24h antes do agendamento | Delayed |
| `reminder_2h` | 2h antes | Delayed |
| `confirmation_4h` | 4h antes (médio risco) | Delayed |
| `confirmation_6h` | 6h antes (alto risco) | Delayed |
| `cancel_unconfirmed` | A cada hora | Recorrente |
| `recalc_all_scores` | Meia-noite diária | Recorrente |
| `waitlist_notify` | Imediato ao cancelar | Imediato |

---

## WEBHOOK WHATSAPP

`POST /webhooks/whatsapp`

Lógica de parsing:
1. Ignora mensagens de grupo e `fromMe: true`
2. Extrai texto de: `conversation`, `extendedTextMessage`, `buttonsResponseMessage`, `templateButtonReplyMessage`, `listResponseMessage`
3. Busca cliente pelo telefone (com ou sem código 55)
4. Prioridade: lista de espera pendente → agendamento ativo
5. Reconhece: `sim/1/btn_confirm/confirmar` | `não/2/btn_cancel/cancelar` | `3/btn_reschedule/reagendar`

---

## MULTI-TENANT

- `tenantId` em todas as tabelas
- Tenant resolvido pelo JWT (`payload.tenantId`)
- Middleware `authMiddleware` injeta `req.tenantId` e `req.user`
- Configurações WhatsApp por tenant (sobrescrevem env vars)
- Slug único por empresa (usado no login)
- Tenant pode ter status `active | inactive | blocked` (bloqueado = login negado)

---

## PERMISSÕES

| Role | O que pode |
|---|---|
| `superadmin` | Painel /admin — gerencia todos os tenants |
| `owner` | Tudo dentro do tenant, incluindo deletar cliente (LGPD) |
| `receptionist` | Criar/editar clientes e agendamentos |
| `employee` | Ver apenas agenda própria (filtrado por `professionalId`) |

---

## PADRÕES DE CÓDIGO

- **Idioma do código:** inglês (variáveis, funções, nomes de arquivo)
- **Idioma dos comentários:** português
- **Commits:** português, verbos imperativos ("Adiciona", "Corrige", "Remove")
- **Resposta da API:** sempre `{ success: boolean, message: string, data: any }`
- **Validação:** Zod em todas as entradas (routes)
- **Erros:** capturados no `errorMiddleware`, ZodError retorna 400, outros 500
- **Prisma:** singleton em `shared/utils/prisma.ts` usando `PrismaPg` (adapter pg pool)

---

## COMO RODAR

```bash
# 1. Containers (postgres + redis + evolution-api)
docker compose up -d

# 2. Variáveis de ambiente
cp backend/.env.example backend/.env
# Editar backend/.env — especialmente ADMIN_EMAIL e ADMIN_PASSWORD_HASH

# 3. Gerar hash da senha admin
node -e "require('bcryptjs').hash('sua-senha',10).then(console.log)"

# 4. Migration
cd backend && npm run db:migrate

# 5. Backend (porta 4000)
npm run dev

# 6. Frontend (porta 3000, proxy /api → :4000)
cd ../frontend && npm run dev

# 7. Configurar webhook Evolution API (opcional, dev)
./scripts/setup-whatsapp.ps1
```

---

## PENDÊNCIAS REAIS (o que falta de fato)

### Crítico para produção
- [ ] **Migrar WhatsApp para API oficial Meta** — Evolution API não é homologada; qualquer cliente real exige isso
- [ ] **Configurar CORS** — backend sem CORS explícito; em produção vai quebrar se domínios forem diferentes
- [ ] **Variável `JWT_SECRET`** — o `.env.example` tem valor placeholder; produção precisa de segredo real
- [ ] **HTTPS + reverse proxy** — Nginx ou similar na frente do Express em produção

### Funcional mas incompleto
- [ ] **professionalId no waitlist** — `waitlist.service.ts` usa `client.id` como `professionalId` ao criar agendamento via lista de espera (placeholder explícito no código, linha ~80 de `whatsapp.webhook.ts`)
- [ ] **Reagendar via WhatsApp** — webhook cancela o agendamento mas não oferece horários; cliente precisa ligar ou acessar a plataforma
- [ ] **Testes automatizados** — cobertura mínima; risco em refatorações

---

## O QUE NÃO FAZER AGORA

- Não adicionar IA, ML ou previsão avançada (sem dados reais ainda)
- Não construir app mobile antes de validar a web com clientes reais
- Não adicionar PIX/pagamento antes de ter faturamento próprio
- Não escalar para microserviços (monolito ainda é adequado)
- Não colocar cliente real em produção usando Evolution API (risco de bloqueio)

---

## PRÓXIMO PASSO REAL

O produto está completo e polido. A prioridade agora é:

1. **Validar o produto com 1–3 clientes reais** (mesmo que em desenvolvimento local)
2. **Definir o nicho prioritário** (odontologia? barbearia? psicologia?) antes de iterar em features
3. **CORS + produção** — antes de colocar qualquer cliente real em servidor

Só depois de validação partir para Fase 2 (PIX, analytics avançado, reputação).
