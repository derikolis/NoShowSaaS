# CLAUDE.md — No-Show Protection SaaS
> Guia de desenvolvimento para o Claude Code consultar em toda sessão.

---

## CONTEXTO DO PROJETO

SaaS B2B para reduzir no-show em agendamentos.

**Problema:** cliente agenda, não aparece, empresa perde dinheiro e o horário fica vazio.

**Solução:** sistema de lembretes automáticos via WhatsApp com motor de risco baseado em regras, lista de espera automática e confirmação obrigatória.

**Status atual:** MVP em construção. Sem clientes reais ainda. Hipótese a ser validada.

**Time:** 1 desenvolvedor (Derik).

---

## REGRA PRINCIPAL DE DESENVOLVIMENTO

> Sempre construir o mínimo que funciona antes de adicionar complexidade.

Se uma solução simples resolve, use a simples. Não adicione camadas antes de precisar delas.

---

## STACK DEFINIDA

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + TypeScript |
| Frontend | React + Vite |
| Banco | PostgreSQL |
| ORM | Prisma |
| Jobs | BullMQ |
| Cache | Redis (necessário para BullMQ) |
| Containers | Docker |
| WhatsApp | Evolution API (desenvolvimento) → API oficial Meta (produção) |

**O que NÃO usar no MVP:**
- Microserviços (usar monolito modular)
- Next.js (desnecessário para painel B2B)
- Machine Learning / IA (zero por enquanto)
- Frameworks pesados desnecessários

---

## ARQUITETURA DO MVP

### Estrutura: Monolito Modular

Organizar o código em módulos dentro de um único projeto. Cada módulo pode virar um serviço separado no futuro sem reescrever tudo.

```
/
  /backend
    /src
      /modules
        /scheduling      → agendamentos
        /clients         → cadastro de clientes
        /risk-engine     → cálculo de score
        /notifications   → envio de lembretes
        /waitlist        → lista de espera
        /auth            → autenticação multi-tenant
      /shared
        /middlewares
        /utils
        /types
      /jobs              → BullMQ workers
      /webhooks          → receber respostas do WhatsApp
    /prisma
      schema.prisma
  /frontend
    /src
      /pages
      /components
      /hooks
      /services
```

---

## MVP — O QUE CONSTRUIR

Escopo fechado. Nada além disso até validar com usuário real.

### Funcionalidades obrigatórias no MVP

1. **Agendamento**
   - Criar, cancelar, reagendar
   - Dados: nome, telefone, serviço, data, hora, profissional

2. **Motor de risco (sem IA)**
   - Calcular score baseado em regras
   - Classificar: baixo / médio / alto risco

3. **Lembretes via WhatsApp**
   - 24h antes do agendamento
   - 2h antes do agendamento
   - Botões: confirmar / cancelar / reagendar

4. **Confirmação e cancelamento**
   - Cliente responde no WhatsApp
   - Sistema atualiza status automaticamente via webhook

5. **Lista de espera**
   - Quando vaga cancela, notifica próximo da fila
   - Primeiro a aceitar recebe a vaga

6. **Dashboard básico**
   - Taxa de comparecimento
   - Horários recuperados
   - Clientes com mais faltas

### Fora do MVP (não construir agora)
- PIX e pagamento antecipado
- Analytics avançado
- App mobile
- White-label
- API pública
- Integrações (Google Calendar, CRM, ERP)
- Machine learning

---

## MOTOR DE RISCO

Sistema de score baseado em regras. Sem IA, sem custo por uso.

### Regras de pontuação

| Evento | Pontos |
|---|---|
| Cliente novo (sem histórico) | +15 |
| Faltou 1x no passado | +20 |
| Faltou 2x ou mais | +40 |
| Horário de pico (12h–14h, 18h–20h) | +20 |
| Confirmou presença | -30 |
| Agendamento de última hora (< 2h) | +25 |
| Cliente VIP / histórico positivo | -20 |

### Classificação

| Score | Risco | Ação |
|---|---|---|
| 0–30 | Baixo | Lembrete simples |
| 31–60 | Médio | Confirmação obrigatória |
| 61–100 | Alto | Confirmação dupla + possível bloqueio |

### Ações automáticas por risco

**Baixo:** envia lembrete padrão.

**Médio:** exige confirmação. Se não confirmar em X horas, lembrete adicional.

**Alto:** exige confirmação dupla. Pode bloquear agendamento em horários premium.

---

## MULTI-TENANT

Cada empresa tem seus próprios dados isolados.

- Usar `tenantId` em todas as tabelas
- Resolver tenant pelo subdomínio ou pelo JWT
- Nunca misturar dados entre tenants
- Middleware de tenant obrigatório em todas as rotas autenticadas

---

## PERMISSÕES

| Perfil | Acesso |
|---|---|
| Dono | Tudo |
| Recepcionista | Agenda clientes, vê todos os agendamentos |
| Funcionário | Vê apenas agenda própria |

---

## BANCO DE DADOS — SCHEMA PRISMA

```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  plan      String   @default("basic")
  createdAt DateTime @default(now())

  users        User[]
  clients      Client[]
  appointments Appointment[]
  waitlist     Waitlist[]
}

model User {
  id       String @id @default(uuid())
  tenantId String
  name     String
  email    String
  role     String // owner | receptionist | employee
  tenant   Tenant @relation(fields: [tenantId], references: [id])
}

model Client {
  id           String   @id @default(uuid())
  tenantId     String
  name         String
  phone        String
  email        String?
  riskScore    Int      @default(0)
  createdAt    DateTime @default(now())
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  appointments Appointment[]
}

model Appointment {
  id             String    @id @default(uuid())
  tenantId       String
  clientId       String
  professionalId String
  service        String
  scheduledAt    DateTime
  status         String    // scheduled | confirmed | cancelled | no_show
  riskScore      Int       @default(0)
  confirmedAt    DateTime?
  cancelledAt    DateTime?
  createdAt      DateTime  @default(now())
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  client         Client    @relation(fields: [clientId], references: [id])
  notifications  Notification[]
}

model Waitlist {
  id         String    @id @default(uuid())
  tenantId   String
  slot       DateTime
  clientId   String
  notifiedAt DateTime?
  acceptedAt DateTime?
  tenant     Tenant    @relation(fields: [tenantId], references: [id])
}

model Notification {
  id            String    @id @default(uuid())
  tenantId      String
  appointmentId String
  type          String    // reminder_24h | reminder_2h | confirmation | waitlist
  channel       String    // whatsapp | email
  status        String    // pending | sent | failed
  sentAt        DateTime?
  appointment   Appointment @relation(fields: [appointmentId], references: [id])
}

model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String?
  action    String
  entity    String
  entityId  String
  ip        String?
  createdAt DateTime @default(now())
}
```

---

## WHATSAPP

### Fluxo de mensagem

```
Job dispara lembrete
→ Backend envia via Evolution API
→ Cliente responde com botão
→ Webhook recebe resposta
→ Sistema atualiza status do agendamento
→ Se cancelou: aciona lista de espera
```

### Mensagem padrão

```
Olá {nome}.
Você tem um agendamento amanhã às {hora} com {profissional}.
Deseja confirmar sua presença?

[✅ Confirmar] [❌ Cancelar] [🔄 Reagendar]
```

### Atenção

Evolution API é self-hosted e não oficial. Usar apenas em desenvolvimento.
Migrar para API oficial Meta (via 360dialog ou direta) antes de colocar clientes reais em produção.

---

## BACKGROUND JOBS (BullMQ)

| Job | Frequência |
|---|---|
| Enviar lembretes 24h antes | A cada hora |
| Enviar lembretes 2h antes | A cada 15 min |
| Cancelar agendamentos sem confirmação | A cada hora |
| Acionar lista de espera | Imediato após cancelamento |
| Recalcular score de clientes | Diário |

---

## LGPD — OBRIGATÓRIO DESDE O DIA 1

- Consentimento explícito no cadastro do cliente
- Endpoint para exclusão de dados
- Logs de auditoria para todas as alterações
- Dados sensíveis criptografados
- Política de privacidade visível na plataforma

---

## ORDEM DE DESENVOLVIMENTO

Seguir essa ordem. Não pular etapas.

```
1. Setup do projeto (Docker, PostgreSQL, Prisma, estrutura de pastas)
2. Auth (JWT, multi-tenant, middleware de tenant)
3. Cadastro de clientes e profissionais
4. Módulo de agendamento (CRUD)
5. Motor de risco (score por regras)
6. Integração WhatsApp — envio de mensagem
7. Webhook WhatsApp — receber confirmação/cancelamento
8. Lista de espera
9. Background jobs com BullMQ (lembretes automáticos)
10. Dashboard básico
```

---

## PADRÕES DE CÓDIGO

- **Idioma do código:** inglês (variáveis, funções, classes)
- **Idioma dos comentários:** português
- **Commits:** português, objetivos ("Adiciona motor de risco", "Corrige webhook WhatsApp")
- **Respostas da API:** sempre `{ success: boolean, message: string, data: any }`
- **Validação:** Zod em todas as entradas
- **Erros:** nunca deixar erro sem tratamento, sempre retornar mensagem clara

---

## O QUE NUNCA FAZER

- Não adicionar complexidade antes de precisar
- Não construir fora do escopo do MVP sem validar com usuário real
- Não usar microserviços agora
- Não integrar IA antes de ter faturamento e dados suficientes
- Não começar app mobile antes de validar a web
- Não colocar cliente real em produção usando Evolution API

---

## FASES FUTURAS (não construir agora)

**Fase 2:** PIX, analytics avançado, sistema de reputação, automações configuráveis.

**Fase 3:** Previsão de no-show com ML, análise comportamental.

**Fase 4:** White-label, marketplace, IA conversacional, integrações massivas.