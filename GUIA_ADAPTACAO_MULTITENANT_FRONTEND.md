# 🎨 Guia de Adaptação do Frontend: Suporte a Multi-Tenant Hierárquico (Mother & Filiais)

> **Documento de Especificação para o Frontend (`frontend-pfm`)**  
> **Conversa de Referência do Front:** `c525d643-9f6b-4c8c-acfa-c97546608b11`  
> **Backend Base:** `backend-pfm` (Branch `dev`)  
> **Novos Recursos da API:** Suporte a seleção de unidade/empresa ativa, visão consolidada (Mother + Filiais) e isolamento por filial.

---

## 1. Visão Geral das Mudanças

O backend foi atualizado para uma arquitetura **Multi-Tenant Hierárquica**:
- Cada usuário gestor agora pertence a uma **Mother (Matriz)** ou a uma de suas **Filiais (Branches)**.
- O Frontend precisa permitir que o usuário:
  1. Veja em qual empresa/filial está operando atualmente.
  2. Alterne facilmente entre **"Visão Consolidada (Todas as Filiais)"** e **"Filial Específica (ex: Matriz, Filial SP, Filial RJ)"**.
  3. Envie automaticamente os headers de contexto em **todas** as requisições autenticadas.
  4. Cadastre novas filiais caso seja gestor da Mother.

---

## 2. Novos Headers HTTP Obrigatórios

Em todas as chamadas autenticadas pelo cliente HTTP (`apiRequest`), devem ser injetados os seguintes headers:

| Header | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `x-company-id` | `UUID (string)` | ID da empresa/filial selecionada pelo usuário no seletor | `"018f0000-0000-7000-8000-000000000001"` |
| `x-view-scope` | `"single" \| "consolidated"` | Escopo de visualização dos dados e dashboards | `"consolidated"` ou `"single"` |

> [!NOTE]
> Se o usuário não selecionar nada ou estiver no primeiro acesso, o backend usará como fallback a empresa padrão do usuário. Porém, o Frontend **deve** persistir a seleção do usuário no `localStorage`.

---

## 3. Adaptação do Cliente de API (`src/services/api.ts`)

Adicione gerenciamento de estado do tenant e injeção automática dos headers:

```typescript
// src/services/api.ts

// Chaves de persistência no localStorage
export const STORAGE_COMPANY_KEY = 'pfm_selected_company_id'
export const STORAGE_VIEW_SCOPE_KEY = 'pfm_view_scope' // 'single' | 'consolidated'

export function getSelectedCompanyId(): string | null {
  return localStorage.getItem(STORAGE_COMPANY_KEY)
}

export function getViewScope(): 'single' | 'consolidated' {
  return (localStorage.getItem(STORAGE_VIEW_SCOPE_KEY) as 'single' | 'consolidated') || 'single'
}

export function setTenantContext(companyId: string, scope: 'single' | 'consolidated') {
  localStorage.setItem(STORAGE_COMPANY_KEY, companyId)
  localStorage.setItem(STORAGE_VIEW_SCOPE_KEY, scope)
}
```

No método `apiRequest`, injete os headers nas requisições autenticadas:

```typescript
// Dentro de apiRequest em src/services/api.ts:
const companyId = getSelectedCompanyId()
const viewScope = getViewScope()

if (companyId) {
  headers.set('x-company-id', companyId)
}
headers.set('x-view-scope', viewScope)
```

---

## 4. Novas Rotas Disponíveis na API

### 4.1 Obter Empresas e Filiais Acessíveis pelo Usuário Logado
- **Rota:** `GET /companies/me`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Resposta (200 OK):**
```json
{
  "message": "Companies retrieved successfully",
  "activeCompanyId": "018f0000-0000-7000-8000-000000000001",
  "isMother": true,
  "isConsolidated": false,
  "companies": [
    {
      "id": "018f0000-0000-7000-8000-000000000001",
      "registeredCompanyName": "Empresa Matriz Principal LTDA",
      "tradeName": "Matriz Principal",
      "cnpj": "00000000000191",
      "motherId": null,
      "active": true
    },
    {
      "id": "018f1234-0000-7000-8000-000000000002",
      "registeredCompanyName": "Filial São Paulo LTDA",
      "tradeName": "Filial SP",
      "cnpj": "00000000000272",
      "motherId": "018f0000-0000-7000-8000-000000000001",
      "active": true
    }
  ]
}
```

### 4.2 Cadastrar Nova Filial (Para Gestores da Mother)
- **Rota:** `POST /companies/branches`
- **Headers:** `Authorization: Bearer <TOKEN>`, `x-company-id: <MOTHER_ID>`
- **Body (JSON):**
```json
{
  "registeredCompanyName": "Filial Rio de Janeiro LTDA",
  "tradeName": "Filial RJ",
  "cnpj": "12345678000199",
  "email": "financeiro.rj@empresa.com",
  "phone": "21999999999"
}
```

---

## 5. Componentes de UI a Implementar no Frontend

### 5.1 Seletor de Unidade / Filial no Topo (Header / Navbar)
Crie um dropdown no cabeçalho (ao lado do nome do usuário / avatar):
- **Opções do Dropdown:**
  1. 🌐 **Todas as Unidades (Visão Consolidada)** *(Disponível se `isMother === true`)*
     - Define `x-view-scope = "consolidated"` e `x-company-id = motherId`
  2. 🏢 **Matriz Principal**
     - Define `x-view-scope = "single"` e `x-company-id = mother.id`
  3. 📍 **Filial SP**
     - Define `x-view-scope = "single"` e `x-company-id = filial.id`
  4. ➕ **Cadastrar Nova Filial** *(Abre modal com formulário para `POST /companies/branches`)*

### 5.2 Comportamento do Dashboard ao Mudar o Seletor
- Ao alterar a empresa no seletor:
  1. Salva no `localStorage` via `setTenantContext`.
  2. Dispara recarregamento automático dos dados (`fetchOverview`, `fetchServices`, `fetchClients`, `fetchNotes`).
  3. Se estiver em **"Visão Consolidada"**, os totais somam todas as filiais.
  4. Nas tabelas de Serviços e Notas, quando em visão consolidada, exiba uma badge/tag com a filial de origem.

---

## 6. Painel Exclusivo do Administrador Geral da Plataforma (`administrator`)

O perfil **`administrator`** (Platform Admin) **não precisa ver dashboards operacionais de serviços/clientes de uma empresa**, e sim o **Centro de Comando da Plataforma (SaaS Monitoring & Cascade Management)**.

Ao logar como `administrator`:
- O Frontend pode renderizar diretamente a visão administrativa ou destacar a aba **"Administração da Plataforma"**.
- O Admin tem acesso a 3 novas rotas exclusivas do backend:

---

### 6.1 Novas Rotas de Gestão Global e Monitoramento

| Endpoint | Método | Descrição |
|---|---|---|
| `/admin/system/metrics` | `GET` | Retorna saúde do sistema (status, uptime, uso de memória MB, banco conectado) e estatísticas gerais (total de empresas, matrizes, filiais, usuários, clientes, serviços e média de acessos/dia). |
| `/admin/system/hierarchy` | `GET` | Retorna a árvore em cascata: **Mother -> Filiais -> Totais de Usuários, Clientes e Serviços de cada uma**. |
| `/admin/system/clients?companyId=<ID>` | `GET` | Consulta os clientes diretos de uma empresa ou filial específica selecionada na cascata. |

---

### 6.2 Exemplo de Resposta de `/admin/system/metrics`

```json
{
  "message": "System metrics retrieved successfully",
  "data": {
    "systemHealth": {
      "status": "healthy",
      "uptimeSeconds": 1420,
      "databaseConnection": true,
      "memoryUsageMb": 181,
      "environment": "production"
    },
    "stats": {
      "totalCompanies": 12,
      "totalMothers": 4,
      "totalBranches": 8,
      "totalUsers": 54,
      "totalClients": 420,
      "totalServices": 5001,
      "totalNf": 89,
      "estimatedDailyAccess": 432
    }
  }
}
```

---

### 6.3 Exemplo de Resposta de `/admin/system/hierarchy` (Visão em Cascata)

```json
{
  "message": "Cascade hierarchy retrieved successfully",
  "mothers": [
    {
      "id": "018f0000-0000-7000-8000-000000000001",
      "registeredCompanyName": "Empresa Matriz Principal LTDA",
      "tradeName": "Matriz Principal",
      "cnpj": "00000000000191",
      "active": true,
      "branchesCount": 2,
      "usersCount": 8,
      "clientsCount": 150,
      "servicesCount": 3200,
      "branches": [
        {
          "id": "018f1234-0000-7000-8000-000000000002",
          "tradeName": "Filial SP",
          "cnpj": "00000000000272",
          "usersCount": 4,
          "clientsCount": 80,
          "servicesCount": 1200
        }
      ]
    }
  ]
}
```

---

### 6.4 Como Estruturar a Tela no Frontend para o Admin Geral

Em `src/AdminPanel.tsx` (ou em um componente `PlatformAdminDashboard.tsx`):

1. **Card Superior de Saúde do Sistema (Health & Telemetry):**
   - 🟢 **Status:** Operacional (Healthy)
   - ⏱️ **Uptime:** Tempo de atividade contínua
   - 💾 **Memória RAM:** Uso em MB
   - ⚡ **Acessos Estimados:** Média de acessos diários
   - 🏢 **Empresas na Plataforma:** Total de Mothers e Filiais

2. **Árvore / Lista em Cascata (Empresas Contratantes):**
   - Um acordeão/tabela expansível:
     - 📁 **[Mother] Matriz Principal** — CNPJ: `00.000.000/0001-91` (2 Filiais | 150 Clientes | 3.200 Serviços)
       - ↳ 🏢 **[Filial] Filial SP** — CNPJ: `00.000.000/0002-72` (80 Clientes) `[Ver Clientes]`
       - ↳ 🏢 **[Filial] Filial RJ** — CNPJ: `00.000.000/0003-53` (30 Clientes) `[Ver Clientes]`
   - Ao clicar em `[Ver Clientes]`, dispara `GET /admin/system/clients?companyId=<ID>` e exibe a listagem dos clientes pertencentes àquela filial/matriz.

---

## 7. Checklist de Implementação no Front

- [ ] **Passo 1:** Criar funções auxiliares em `src/services/api.ts` para armazenar `x-company-id` e `x-view-scope`.
- [ ] **Passo 2:** Atualizar `apiRequest` para enviar os headers automaticamente.
- [ ] **Passo 3:** Criar serviço `src/services/companies.ts` com as chamadas `getMyCompanies()` e `createBranch()`.
- [ ] **Passo 4:** Criar o componente `CompanySelector.tsx` no Header do `App.tsx` / `Dashboard.tsx`.
- [ ] **Passo 5:** Carregar as empresas do usuário no login e selecionar a primeira por padrão caso não haja nenhuma no `localStorage`.
- [ ] **Passo 6:** Criar modal simples para cadastro de nova filial para usuários administradores/gestores.
- [ ] **Passo 7:** Testar a alternância entre visão isolada e visão consolidada na tela de "Visão Geral".
