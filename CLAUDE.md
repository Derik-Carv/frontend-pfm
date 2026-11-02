# Frontend PFM — Guia Arquitetural e Bíblia de Desenvolvimento

Este documento é a referência canônica do projeto **frontend-pfm** voltada para desenvolvedores e agentes de Inteligência Artificial. Toda e qualquer alteração no código deve respeitar integralmente as regras, convenções, padrões de projeto e decisões de arquitetura descritas a seguir.

---

## 1. Visão Geral e Contexto de Negócio

O **frontend-pfm** é a interface web do Sistema Financeiro e Operacional PFM, projetado para se integrar à API REST [`backend-pfm`](https://github.com/Derik-Carv/backend-pfm).

### Domínios Principais:
1. **Autenticação e Perfil**:
   - Login por `username` e `password`.
   - Registro de usuários (CPF, nome, sobrenome, usuário e senha).
   - Fluxo de obrigatoriedade de alteração de senha inicial ou redefinida (`passwordChangeRequired`).
2. **Dashboard de Serviços**:
   - Visualização geral de serviços (mais caros, recentes e antigos).
   - Busca/filtros dinâmicos por ID, cliente, valor, data inicial e final.
   - Detalhamento de métricas e status de serviços em andamento ou finalizados.
3. **Gestão Operacional (Management)**:
   - Cadastros e manutenção de Clientes (PJ/PF, contatos, endereços).
   - Movimentações financeiras (receitas/despesas/entradas vinculadas a serviços).
   - Status de serviços.
4. **Notas Fiscais (NfPanel)**:
   - Emissão manual ou importação automatizada via leitura de PDF.
   - Vinculação com Cliente, Movimentação e Serviço.
   - Visualização detalhada (accordion/expandable row) com chave de acesso, status, anexo PDF (download, preview modal com `pdfjs-dist`) e desativação com motivo obrigatório.
5. **Administração de Usuários (AdminPanel)**:
   - Listagem e criação de usuários com perfis de acesso (RBAC).
   - Reset de senha administrativa e alternância de status ativo/inativo.

### Perfis de Acesso (RBAC):
Os perfis são extraídos do payload JWT (`tokenRole`):
- `administrator`: Acesso irrestrito a todas as áreas, incluindo o `AdminPanel`.
- `manager`: Acesso a Dashboard, Gestão (Clientes, Serviços, Movimentações) e Notas Fiscais.
- `finance`: Acesso a operações financeiras e criação/edição de Notas Fiscais.
- `colaborator`: Acesso operacional restrito a serviços e registros atribuídos.
- `observer`: Acesso somente-leitura. **Nunca** exibir ou permitir ações de mutação (botões de desativar, criar, editar, upload de arquivo etc.) para este perfil.

---

## 2. Stack Tecnológica e Bibliotecas

- **Linguagem**: TypeScript (~6.0) em modo estrito.
- **Framework**: React 19 (`react`, `react-dom`).
- **Build Tool**: Vite 8.
- **Manipulação de PDF**: `pdfjs-dist` (com worker configurado localmente via Vite assets).
- **Gerenciador de Pacotes**: `bun` (primário) / `npm` (compatível com build CI/CD).
- **Qualidade e Padronização**: ESLint com `typescript-eslint` e `eslint-plugin-react-hooks`.
- **CSS**: CSS puro vanilla utilizando Custom Properties (CSS Variables) para theming (`dark` e `light`). Sem Tailwind, sem CSS-in-JS, sem bibliotecas externas de UI.

---

## 3. Padrões de Projeto e Arquitetura

### 3.1. Arquitetura de Componentes
- O projeto não utiliza React Router tradicional. A navegação entre visualizações principais ocorre por chaveamento de estado centralizado no `App.tsx` e abas/painéis no `Dashboard.tsx` (`services` | `management` | `nf` | `admin`).
- Os componentes de tela são auto-contidos com seu respectivo arquivo CSS modular (`NfPanel.tsx` + `NfPanel.css`, `AdminPanel.tsx` + `AdminPanel.css`, etc.).

### 3.2. Camada de Comunicação com a API (`src/services/api.ts`)
- **`apiRequest<T>(path, options)`**:
  - Encapsula chamadas REST utilizando `fetch`.
  - Injeta automaticamente `Content-Type: application/json` quando o corpo não for `FormData`.
  - Remove `Content-Type` quando o corpo for `FormData` para permitir que o navegador configure a fronteira de multipart.
  - Lança erros da classe `ApiRequestError` contendo `status` HTTP e `responseBody`.
- **`apiFileRequest(path, token)`**:
  - Dedicada para endpoints que retornam arquivos/blobs (ex: download de PDFs ou anexos).
- **Variáveis de Ambiente**:
  - `VITE_API_URL`: URL base da API. Tratada com fallback para `http://localhost:3336` e remoção da barra final.

### 3.3. Extração e Parse de PDF (`src/services/nfPdf.ts`)
- Extração de texto no cliente com `pdfjs-dist`.
- Identificação por Regex de Número de NF, Chave de Acesso de 44 dígitos, Data de Emissão e Valores Monetários.
- Campos extraídos recebem níveis de confiança (`high`, `medium`, `low`) para validação humana antes da submissão.

---

## 4. Regras Absolutas e Mandatórias (NUNCA QUEBRAR)

1. **Sem Bibliotecas de Componentes Externas**:
   - **NÃO** adicione bibliotecas pesadas de componentes como Material UI, AntD, Chakra, Radix, Tailwind ou Bootstrap. A UI é intencionalmente artesanal em CSS puro para manter leveza, performance e consistência visual.
2. **Preservação de Integridade de Tipagem**:
   - Todo código novo ou alterado **DEVE** compilar sem erros através de `npm run build` (`tsc -b && vite build`).
   - Não use `any` descuidado; defina interfaces e tipos claros para payloads da API.
3. **Respeito aos Papéis (RBAC)**:
   - Jamais exiba botões ou permita ações de escrita/exclusão/desativação para o perfil `observer`.
   - Apenas `administrator` pode acessar ou visualizar a aba de administração de usuários.
4. **Formatação Monetária e Datas**:
   - Valores monetários são manipulados numericamente e formatados para exibição em Real com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
   - Datas enviadas ao backend devem respeitar o formato ISO (`YYYY-MM-DD` ou ISO completo conforme o endpoint). Para exibição, use o padrão brasileiro `DD/MM/YYYY`.
5. **Desativação com Justificativa**:
   - No cancelamento/desativação de Notas Fiscais ou entidades sensíveis, o campo `reason` (motivo) é obrigatório e nunca deve ser omitido no payload.
6. **Mídias e Comunicação com a API**:
   - Nunca passe cabeçalho manual `Content-Type: multipart/form-data` ao enviar arquivos com `FormData`; deixe o `fetch` tratar automaticamente.
   - Trate sempre erros de rede e respostas `!response.ok` com feedback amigável ao usuário.
7. **Suporte a Temas (`light` e `dark`)**:
   - Novas classes CSS devem utilizar as variáveis semânticas definidas no design system global (`var(--paper)`, `var(--field-bg)`, `var(--field-border)`, `var(--ink)`, `var(--clay)`, `var(--muted)`).
   - Não utilize cores estáticas `hex` ou `rgb` que quebrem a legibilidade em qualquer um dos temas.

---

## 5. Fluxo de Trabalho Git e Branches

- `main`: Branch de produção / versão estável.
- `dev`: Branch principal de desenvolvimento e integração contínua. Novas funcionalidades e refatorações devem ser enviadas para esta branch.
- Commits devem seguir o padrão Conventional Commits (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`).
