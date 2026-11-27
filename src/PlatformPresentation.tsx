import { Fragment, useState } from 'react'
import type { LegalDocKind } from './LegalDocumentsModal'
import './PlatformPresentation.css'

type Theme = 'dark' | 'light'
type DemoTab = 'finance' | 'bi' | 'nf' | 'governance'
type FinanceFilter = 'all' | 'receivable' | 'payable' | 'overdue'
type UnitKey = 'consolidated' | 'matriz' | 'filial_campinas'
type RoadmapTrack = 'all' | 'finance' | 'accounting'

export type PlatformPresentationProps = {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onBackToLogin: () => void
  onRequestAccess: () => void
  onOpenLegal: (doc: LegalDocKind) => void
  dpoEmail?: string
}

type DemoFinanceEntry = {
  id: string
  type: 'receivable' | 'payable'
  description: string
  counterparty: string
  category: string
  costCenter: string
  installmentLabel: string
  dueDate: string
  amount: number
  status: 'paid' | 'pending' | 'partial' | 'overdue'
  settlementNote: string
}

type DemoBiUnitData = {
  label: string
  scopeTag: string
  receivableTotal: number
  averageTicket: number
  completedCount: number
  pendingCount: number
  bars: Array<{ name: string; client: string; value: number; sharePercent: number }>
}

type DemoNfItem = {
  id: string
  numberNf: string
  client: string
  emissionDate: string
  totalValue: number
  status: 'Ativa' | 'Emitida'
  accessKey: string
  serviceName: string
  fileName: string
  linkedEntry: string
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatMoney(value: number) {
  return currencyFormatter.format(value)
}

const demoFinanceEntries: DemoFinanceEntry[] = [
  {
    id: 'fin-1',
    type: 'receivable',
    description: 'Mensalidade Plataforma B2B — Plano Corporativo',
    counterparty: 'TechSul Logística LTDA',
    category: '1.02 · Receita de Assinaturas',
    costCenter: '001 · COMERCIAL',
    installmentLabel: 'Parcela 3/12 · Dia fixo 10',
    dueDate: '10/12/2026',
    amount: 4850,
    status: 'pending',
    settlementNote: 'Título gerado automaticamente pelo contrato de serviço.',
  },
  {
    id: 'fin-2',
    type: 'receivable',
    description: 'Implantação e Integração Fiscal (NF 00142)',
    counterparty: 'Grupo Horizonte Engenharia',
    category: '1.01 · Prestação de Serviços',
    costCenter: '002 · PROJETOS',
    installmentLabel: 'Parcela 1/2 · Dia fixo 15',
    dueDate: '15/11/2026',
    amount: 7200,
    status: 'overdue',
    settlementNote: 'Sinalizado no aging de inadimplência (12 dias em aberto).',
  },
  {
    id: 'fin-3',
    type: 'receivable',
    description: 'Consultoria Operacional Trimestral',
    counterparty: 'Data Home Serviços LTDA',
    category: '1.01 · Prestação de Serviços',
    costCenter: '002 · PROJETOS',
    installmentLabel: 'À vista',
    dueDate: '25/11/2026',
    amount: 2340,
    status: 'paid',
    settlementNote: 'Baixa integral liquidada na Conta Cora Matriz (registro imutável).',
  },
  {
    id: 'fin-4',
    type: 'payable',
    description: 'Infraestrutura Cloud & Observabilidade',
    counterparty: 'Provedor Nuvem Brasil S.A.',
    category: '2.01 · Custos de Hospedagem / Infra',
    costCenter: '003 · TECNOLOGIA',
    installmentLabel: 'Parcela 2/3 · Dia fixo 05',
    dueDate: '05/12/2026',
    amount: 1680,
    status: 'pending',
    settlementNote: 'Previsto no fluxo de caixa projetado para os próximos 30 dias.',
  },
  {
    id: 'fin-5',
    type: 'payable',
    description: 'Assinatura Ferramentas Corporativas',
    counterparty: 'Google Cloud Brasil',
    category: '3.02 · Despesas Administrativas',
    costCenter: '001 · DIRETORIA',
    installmentLabel: 'Parcela 1/3 · Dia fixo 20',
    dueDate: '20/11/2026',
    amount: 600,
    status: 'partial',
    settlementNote: 'R$ 200,00 baixados parcialmente; saldo em aberto de R$ 400,00.',
  },
]

const demoBiByUnit: Record<UnitKey, DemoBiUnitData> = {
  consolidated: {
    label: 'Todas as Unidades (Consolidado)',
    scopeTag: 'Matriz + Filial · Visão do Grupo',
    receivableTotal: 148900,
    averageTicket: 6473.91,
    completedCount: 19,
    pendingCount: 4,
    bars: [
      { name: 'Implantação ERP & BI Corporativo', client: 'TechSul Logística LTDA', value: 42500, sharePercent: 100 },
      { name: 'Sustentação Fiscal & Mensalidades', client: 'Grupo Horizonte Engenharia', value: 31800, sharePercent: 75 },
      { name: 'Automação de Fluxo Financeiro', client: 'Data Home Serviços LTDA', value: 24400, sharePercent: 57 },
      { name: 'Auditoria Documental Multi-Filial', client: 'Norte Sul Comércio S.A.', value: 18900, sharePercent: 44 },
    ],
  },
  matriz: {
    label: 'Matriz · São Paulo',
    scopeTag: 'Unidade Principal · CNPJ Matriz',
    receivableTotal: 102400,
    averageTicket: 6826.67,
    completedCount: 13,
    pendingCount: 2,
    bars: [
      { name: 'Implantação ERP & BI Corporativo', client: 'TechSul Logística LTDA', value: 42500, sharePercent: 100 },
      { name: 'Sustentação Fiscal & Mensalidades', client: 'Grupo Horizonte Engenharia', value: 31800, sharePercent: 75 },
      { name: 'Consultoria Financeira Estratégica', client: 'Atlântica Participações', value: 16200, sharePercent: 38 },
      { name: 'Revisão de Processos Operacionais', client: 'Alpha Serviços LTDA', value: 11900, sharePercent: 28 },
    ],
  },
  filial_campinas: {
    label: 'Filial · Campinas',
    scopeTag: 'Filial Operacional · Visão Isolada',
    receivableTotal: 46500,
    averageTicket: 5812.5,
    completedCount: 6,
    pendingCount: 2,
    bars: [
      { name: 'Automação de Fluxo Financeiro', client: 'Data Home Serviços LTDA', value: 24400, sharePercent: 100 },
      { name: 'Auditoria Documental Multi-Filial', client: 'Norte Sul Comércio S.A.', value: 18900, sharePercent: 77 },
      { name: 'Treinamento Equipe Financeira', client: 'Vanguard Indústria', value: 3200, sharePercent: 13 },
    ],
  },
}

const demoNfs: DemoNfItem[] = [
  {
    id: 'nf-142',
    numberNf: '000142',
    client: 'Grupo Horizonte Engenharia',
    emissionDate: '12/11/2026',
    totalValue: 7200,
    status: 'Ativa',
    accessKey: '35261112345678000195550010000001421000014210',
    serviceName: 'Implantação e Integração Fiscal',
    fileName: 'NF-000142-grupo-horizonte.pdf',
    linkedEntry: 'Título a Receber em 2 parcelas (R$ 3.600,00 cada)',
  },
  {
    id: 'nf-141',
    numberNf: '000141',
    client: 'Data Home Serviços LTDA',
    emissionDate: '08/11/2026',
    totalValue: 2340,
    status: 'Ativa',
    accessKey: '35261198765432000110550010000001411000014118',
    serviceName: 'Consultoria Operacional Trimestral',
    fileName: 'NF-000141-data-home.pdf',
    linkedEntry: 'Baixado integralmente na Conta Cora Matriz',
  },
]

const activeCapabilities = [
  {
    tag: 'DISPONÍVEL AGORA',
    title: 'Gestão Financeira — Fase 1 em Produção',
    description:
      'Contas a pagar e a receber com cálculo exato em centavos, parcelamento automático com dia fixo de vencimento, centros de custo, categorias gerenciais, fluxo de caixa realizado/projetado, aging de inadimplência, baixas imutáveis, estornos e exportação CSV protegida.',
  },
  {
    tag: 'DISPONÍVEL AGORA',
    title: 'Painel Analítico (BI & Analytics)',
    description:
      'Indicadores executivos em tempo real, gráficos interativos com filtro cruzado por serviço, cliente, faixa de valor e período, além de visão detalhada sob demanda sem risco de alteração acidental.',
  },
  {
    tag: 'DISPONÍVEL AGORA',
    title: 'Notas Fiscais com Leitura Automática de PDF',
    description:
      'Leitura local do PDF no navegador para extrair número, chave de acesso, data e valor, validação cruzada no servidor, visualização em modal, guarda segura dos anexos e envio por e-mail ao cliente.',
  },
  {
    tag: 'DISPONÍVEL AGORA',
    title: 'Clientes, Serviços & Fluxo Operacional',
    description:
      'Cadastro completo de clientes PF/PJ, carteira de serviços com acompanhamento de status, histórico expandido por linha (Master-Detail) e conversão direta de serviços em títulos financeiros.',
  },
  {
    tag: 'DISPONÍVEL AGORA',
    title: 'Estrutura Multi-Empresa (Matriz & Filiais)',
    description:
      'Cada empresa opera com isolamento rigoroso de dados. Administradores da Matriz alternam instantaneamente entre uma filial específica ou a visão consolidada do grupo.',
  },
  {
    tag: 'DISPONÍVEL AGORA',
    title: 'Controle de Acesso, Auditoria & LGPD',
    description:
      'Perfis dedicados (Administrador, Financeiro, Gestor, Observador e Colaborador), troca obrigatória de senha provisória, registro de consentimentos, anonimização LGPD e trilha de auditoria.',
  },
]

type RoadmapPhase = {
  track: 'finance' | 'accounting'
  trackLabel: string
  phase: string
  statusLabel: string
  statusTone: 'live' | 'next' | 'planned'
  title: string
  summary: string
  deliverables: string[]
}

const roadmapPhases: RoadmapPhase[] = [
  {
    track: 'finance',
    trackLabel: 'Módulo Financeiro',
    phase: 'Fase 1',
    statusLabel: 'Em produção',
    statusTone: 'live',
    title: 'MVP Financeiro Operacional (Contas, Títulos e Caixa)',
    summary:
      'Base sólida em produção para controlar liquidez diária, contas financeiras e títulos a pagar/receber integrados a clientes e serviços.',
    deliverables: [
      'Cadastro de contas bancárias, caixas e carteiras de recebimento com saldo atualizado transacionalmente.',
      'Títulos a pagar/receber com parcelamento por valor total ou parcela e dia fixo mensal de vencimento.',
      'Baixas totais ou parciais em modelo imutável (append-only) com registro de juros, multa, desconto e estorno.',
      'Fluxo de caixa realizado e projetado, aging de vencimentos e exportação CSV sanitizada.',
    ],
  },
  {
    track: 'finance',
    trackLabel: 'Módulo Financeiro',
    phase: 'Fase 2',
    statusLabel: 'Próxima implantação',
    statusTone: 'next',
    title: 'Conciliação Bancária (OFX/CSV), Transferências e Governança',
    summary:
      'Redução de digitação manual com conciliação de extratos bancários e controles de aprovação entre operadores.',
    deliverables: [
      'Importação de extratos OFX e CSV bancários com sugestão automática de conciliação e prevenção de duplicidade.',
      'Transferências entre contas próprias e entre Matriz ↔ Filial (intercompany), eliminadas na visão consolidada.',
      'DRE Gerencial por competência (além da visão de caixa) e marcação automática diária de títulos vencidos.',
      'Alçadas de aprovação (Maker-Checker) para pagamentos relevantes, exigindo dupla conferência.',
    ],
  },
  {
    track: 'finance',
    trackLabel: 'Módulo Financeiro',
    phase: 'Fase 3',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Recorrência SaaS, Cobrança via PSP e Integração NFS-e ADN',
    summary:
      'Automação de contratos recorrentes, indicadores SaaS nativos e cobrança automatizada por parceiros regulados.',
    deliverables: [
      'Contratos recorrentes (mensais/anuais) com faturamento agendado e projeção automática de recebíveis.',
      'Painel gerencial de MRR, ARR, Churn, Burn Rate e Runway para empresas de assinatura e serviços recorrentes.',
      'Emissão de PIX dinâmico e boleto exclusivamente via gateways/PSPs regulados, com baixa confirmada por webhook assinado.',
      'Integração direta com emissão de NFS-e no Padrão Nacional (ADN) vinculada aos serviços e títulos.',
    ],
  },
  {
    track: 'accounting',
    trackLabel: 'Módulo de Contabilidade',
    phase: 'Fase 1',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Núcleo em Partidas Dobradas e Livros Auxiliares (NBC TG 1002 / ITG 2000)',
    summary:
      'Estrutura contábil auxiliar em regime de competência para organizar a empresa desde a origem com total rastreabilidade.',
    deliverables: [
      'Plano de Contas padrão alinhado à NBC TG 1002 (Microentidades) e extensível à NBC TG 1001 (Pequenas Empresas).',
      'Lançamentos em partidas dobradas (Débito = Crédito) imutáveis, com histórico padronizado e lastro documental.',
      'Controle de competências mensais (abertura e fechamento de período contábil).',
      'Livro Diário auxiliar, Livro Razão analítico e Balancete de Verificação com conferência matemática automática.',
    ],
  },
  {
    track: 'accounting',
    trackLabel: 'Módulo de Contabilidade',
    phase: 'Fase 2',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Ponte Automática Financeiro → Contábil & Pacote do Contador',
    summary:
      'Integração nativa entre o caixa financeiro e a contabilidade de competência, eliminando retrabalho com o escritório contábil.',
    deliverables: [
      'Motor de regras contábeis gerando lançamentos automáticos a partir de NFs, títulos e baixas liquidadas.',
      'Perfil dedicado para Contador parceiro (accountant) com acesso seguro para conferência, ajustes e fechamento mensal.',
      'Emissão de DRE Preliminar e Balanço Patrimonial Preliminar com aviso legal e comparativo Matriz/Filiais.',
      'Pacote Mensal do Contador em 1 clique: plano de contas, diário, balancete, DRE e PDFs das NFs do mês.',
    ],
  },
  {
    track: 'accounting',
    trackLabel: 'Módulo de Contabilidade',
    phase: 'Fase 3',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Receita Diferida (CPC 47), Monitor do Fator R e Conformidade Estendida',
    summary:
      'Recursos estratégicos para empresas de tecnologia/SaaS acompanharem competência real e indicadores tributários.',
    deliverables: [
      'Apropriação mensal automática de Receita Diferida (CPC 47 / IFRS 15) em assinaturas anuais pagas antecipadamente.',
      'Termômetro estimativo do Fator R do Simples Nacional comparando folha/pró-labore e faturamento dos últimos 12 meses.',
      'Eliminação automática intercompany na visão consolidada e mapeamento referencial da Receita Federal.',
      'Cadeia criptográfica de integridade nos lançamentos contábeis para auditoria e retenção legal (5 a 10 anos).',
    ],
  },
]

function PlatformPresentation({
  theme,
  onThemeChange,
  onBackToLogin,
  onRequestAccess,
  onOpenLegal,
  dpoEmail,
}: PlatformPresentationProps) {
  const [activeTab, setActiveTab] = useState<DemoTab>('finance')
  const [financeFilter, setFinanceFilter] = useState<FinanceFilter>('all')
  const [selectedUnit, setSelectedUnit] = useState<UnitKey>('consolidated')
  const [expandedNfId, setExpandedNfId] = useState<string | null>('nf-142')
  const [roadmapTrack, setRoadmapTrack] = useState<RoadmapTrack>('all')

  const filteredFinanceEntries = demoFinanceEntries.filter((item) => {
    if (financeFilter === 'all') return true
    if (financeFilter === 'overdue') return item.status === 'overdue'
    return item.type === financeFilter
  })

  const currentBiData = demoBiByUnit[selectedUnit]

  const visibleRoadmapPhases = roadmapPhases.filter(
    (phase) => roadmapTrack === 'all' || phase.track === roadmapTrack,
  )

  return (
    <div className="pres-shell">
      <header className="pres-topbar">
        <div className="pres-topbar-inner">
          <a className="pres-brand" href="#pres-hero">
            <span className="brand-mark" aria-hidden="true">P</span>
            <span>
              PFM <strong>Plataforma</strong>
            </span>
          </a>

          <nav className="pres-nav" aria-label="Navegação da apresentação">
            <a href="#pres-hero">Visão Geral</a>
            <a href="#pres-demo">Demonstrativo</a>
            <a href="#pres-modules">Recursos Ativos</a>
            <a href="#pres-roadmap">Futuras Implantações</a>
          </nav>

          <div className="pres-topbar-actions">
            <div className="pres-theme-switch" role="group" aria-label="Tema da apresentação">
              <button
                aria-pressed={theme === 'dark'}
                onClick={() => onThemeChange('dark')}
                type="button"
              >
                Escuro
              </button>
              <button
                aria-pressed={theme === 'light'}
                onClick={() => onThemeChange('light')}
                type="button"
              >
                Claro
              </button>
            </div>

            <button className="pres-btn-secondary" onClick={onRequestAccess} type="button">
              Solicitar cadastro
            </button>
            <button className="pres-btn-primary" onClick={onBackToLogin} type="button">
              Entrar
            </button>
          </div>
        </div>
      </header>

      <main className="pres-main">
        <section className="pres-hero" id="pres-hero">
          <div className="pres-hero-copy">
            <p className="eyebrow">VISÃO EXECUTIVA DA PLATAFORMA</p>
            <h1>Gestão operacional, fiscal e financeira em um único fluxo confiável.</h1>
            <p className="pres-hero-lead">
              O <strong>PFM</strong> conecta o dia a dia de clientes, serviços e notas fiscais ao
              controle financeiro de caixa e à evolução planejada para pré-contabilidade gerencial —
              com arquitetura multi-empresa (Matriz e Filiais), trilha de auditoria e conformidade LGPD.
            </p>

            <div className="pres-hero-actions">
              <button className="pres-btn-primary is-lg" onClick={onRequestAccess} type="button">
                Solicitar cadastro da empresa
                <span aria-hidden="true">→</span>
              </button>
              <a className="pres-btn-secondary is-lg" href="#pres-demo">
                Explorar demonstrativo interativo
              </a>
              <button className="text-button pres-login-link" onClick={onBackToLogin} type="button">
                Já tenho acesso · Voltar ao login
              </button>
            </div>

            <div className="pres-hero-badges" aria-label="Pilares da plataforma">
              <span>Financeiro Fase 1 ativo</span>
              <span>Dashboard BI interativo</span>
              <span>Leitura local de NF em PDF</span>
              <span>Multi-empresa (Matriz &amp; Filiais)</span>
            </div>
          </div>

          <aside className="pres-hero-card" aria-label="Resumo executivo da jornada">
            <div className="pres-hero-card-head">
              <span>ARQUITETURA INTEGRADA PFM</span>
              <span className="pres-status-pill is-live">Operação + Financeiro</span>
            </div>

            <ol className="pres-flow-list">
              <li>
                <strong>1. Operação &amp; Clientes</strong>
                <span>Serviços prestados, contratos e faturamento organizados por unidade.</span>
              </li>
              <li>
                <strong>2. Notas Fiscais (PDF)</strong>
                <span>Extração automática, guarda segura e disparo de PDF por e-mail.</span>
              </li>
              <li>
                <strong>3. Financeiro · Fase 1 (Ativo)</strong>
                <span>Contas a pagar/receber, parcelamento com dia fixo, baixas imutáveis e fluxo de caixa.</span>
              </li>
              <li>
                <strong>4. Contabilidade &amp; Conciliação (Roadmap)</strong>
                <span>OFX/CSV, partidas dobradas (NBC TG 1002), DRE, CPC 47 e Pacote do Contador.</span>
              </li>
            </ol>
          </aside>
        </section>

        <section className="pres-section" id="pres-demo" aria-labelledby="pres-demo-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">DEMONSTRATIVO INTERATIVO</p>
              <h2 id="pres-demo-title">Explore como a plataforma funciona na prática</h2>
              <p>
                Navegue pelas visões reais do sistema utilizando um cenário ilustrativo seguro para
                conhecer a experiência antes de solicitar acesso.
              </p>
            </div>
            <span className="pres-demo-notice" role="note">
              Dados ilustrativos de demonstração
            </span>
          </div>

          <div className="pres-tabs" role="tablist" aria-label="Módulos do demonstrativo">
            <button
              aria-selected={activeTab === 'finance'}
              className={activeTab === 'finance' ? 'is-active' : ''}
              onClick={() => setActiveTab('finance')}
              role="tab"
              type="button"
            >
              Financeiro (Fase 1 Ativa)
            </button>
            <button
              aria-selected={activeTab === 'bi'}
              className={activeTab === 'bi' ? 'is-active' : ''}
              onClick={() => setActiveTab('bi')}
              role="tab"
              type="button"
            >
              Dashboard BI &amp; Unidades
            </button>
            <button
              aria-selected={activeTab === 'nf'}
              className={activeTab === 'nf' ? 'is-active' : ''}
              onClick={() => setActiveTab('nf')}
              role="tab"
              type="button"
            >
              Notas Fiscais &amp; PDF
            </button>
            <button
              aria-selected={activeTab === 'governance'}
              className={activeTab === 'governance' ? 'is-active' : ''}
              onClick={() => setActiveTab('governance')}
              role="tab"
              type="button"
            >
              Multi-Empresa &amp; Segurança
            </button>
          </div>

          <div className="pres-demo-stage" role="tabpanel">
            {activeTab === 'finance' && (
              <div className="pres-demo-pane">
                <div className="pres-pane-toolbar">
                  <div>
                    <h3>Painel Financeiro · Regime de Caixa e Títulos</h3>
                    <p>
                      Filtre títulos abaixo para ver como o PFM acompanha entradas, saídas,
                      parcelamento com dia fixo e aging de atrasos.
                    </p>
                  </div>
                  <div className="pres-chip-group" role="group" aria-label="Filtrar títulos de demonstração">
                    <button
                      aria-pressed={financeFilter === 'all'}
                      onClick={() => setFinanceFilter('all')}
                      type="button"
                    >
                      Todos (5)
                    </button>
                    <button
                      aria-pressed={financeFilter === 'receivable'}
                      onClick={() => setFinanceFilter('receivable')}
                      type="button"
                    >
                      A Receber
                    </button>
                    <button
                      aria-pressed={financeFilter === 'payable'}
                      onClick={() => setFinanceFilter('payable')}
                      type="button"
                    >
                      A Pagar
                    </button>
                    <button
                      aria-pressed={financeFilter === 'overdue'}
                      onClick={() => setFinanceFilter('overdue')}
                      type="button"
                    >
                      Vencidos
                    </button>
                  </div>
                </div>

                <div className="pres-kpi-grid">
                  <article className="pres-kpi-card">
                    <span>Saldo em Contas</span>
                    <strong>{formatMoney(48620)}</strong>
                    <small>Cora Matriz + Caixa Operacional</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>A Receber em Aberto</span>
                    <strong>{formatMoney(12050)}</strong>
                    <small>Inclui parcela com dia fixo mensal</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>A Pagar Previsto</span>
                    <strong>{formatMoney(2080)}</strong>
                    <small>Saldo restante após baixa parcial</small>
                  </article>
                  <article className="pres-kpi-card is-alert">
                    <span>Aging em Atraso</span>
                    <strong>{formatMoney(7200)}</strong>
                    <small>1 título na faixa 1–15 dias</small>
                  </article>
                </div>

                <div className="pres-table-wrap">
                  <table className="pres-table">
                    <thead>
                      <tr>
                        <th scope="col">Tipo</th>
                        <th scope="col">Título &amp; Contraparte</th>
                        <th scope="col">Centro de Custo</th>
                        <th scope="col">Vencimento / Parcela</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFinanceEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <span className={`pres-badge ${entry.type === 'receivable' ? 'is-ok' : 'is-warn'}`}>
                              {entry.type === 'receivable' ? 'A Receber' : 'A Pagar'}
                            </span>
                          </td>
                          <td>
                            <strong>{entry.description}</strong>
                            <small>
                              {entry.counterparty} · {entry.category}
                            </small>
                            <small className="pres-note-muted">{entry.settlementNote}</small>
                          </td>
                          <td>{entry.costCenter}</td>
                          <td>
                            <strong>{entry.dueDate}</strong>
                            <small>{entry.installmentLabel}</small>
                          </td>
                          <td className="pres-money-cell">{formatMoney(entry.amount)}</td>
                          <td>
                            <span
                              className={`pres-badge ${
                                entry.status === 'paid'
                                  ? 'is-ok'
                                  : entry.status === 'overdue'
                                    ? 'is-danger'
                                    : entry.status === 'partial'
                                      ? 'is-info'
                                      : 'is-neutral'
                              }`}
                            >
                              {entry.status === 'paid'
                                ? 'Liquidado'
                                : entry.status === 'overdue'
                                  ? 'Vencido'
                                  : entry.status === 'partial'
                                    ? 'Parcial'
                                    : 'Em aberto'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'bi' && (
              <div className="pres-demo-pane">
                <div className="pres-pane-toolbar">
                  <div>
                    <h3>Dashboard BI · Visão Isolada por Filial ou Consolidada</h3>
                    <p>
                      Alterne a unidade abaixo para simular como gestores acompanham faturamento,
                      ticket médio e concentração de receita por cliente.
                    </p>
                  </div>
                  <div className="pres-chip-group" role="group" aria-label="Selecionar unidade de demonstração">
                    <button
                      aria-pressed={selectedUnit === 'consolidated'}
                      onClick={() => setSelectedUnit('consolidated')}
                      type="button"
                    >
                      Consolidado (Todas)
                    </button>
                    <button
                      aria-pressed={selectedUnit === 'matriz'}
                      onClick={() => setSelectedUnit('matriz')}
                      type="button"
                    >
                      Matriz · SP
                    </button>
                    <button
                      aria-pressed={selectedUnit === 'filial_campinas'}
                      onClick={() => setSelectedUnit('filial_campinas')}
                      type="button"
                    >
                      Filial · Campinas
                    </button>
                  </div>
                </div>

                <div className="pres-unit-banner">
                  <strong>{currentBiData.label}</strong>
                  <span>{currentBiData.scopeTag}</span>
                </div>

                <div className="pres-kpi-grid">
                  <article className="pres-kpi-card">
                    <span>Volume de Serviços</span>
                    <strong>{formatMoney(currentBiData.receivableTotal)}</strong>
                    <small>Carteira filtrada na visão ativa</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Ticket Médio</span>
                    <strong>{formatMoney(currentBiData.averageTicket)}</strong>
                    <small>Calculado sobre serviços ativos</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Serviços Finalizados</span>
                    <strong>{currentBiData.completedCount}</strong>
                    <small>Prontos para faturamento / NF</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Em Andamento / Fila</span>
                    <strong>{currentBiData.pendingCount}</strong>
                    <small>Acompanhamento operacional</small>
                  </article>
                </div>

                <div className="pres-bars-card">
                  <h4>Principais contratos e serviços da visão selecionada</h4>
                  <div className="pres-bars-list">
                    {currentBiData.bars.map((bar) => (
                      <div className="pres-bar-row" key={bar.name}>
                        <div className="pres-bar-meta">
                          <strong>{bar.name}</strong>
                          <span>{bar.client}</span>
                        </div>
                        <div className="pres-bar-track" aria-hidden="true">
                          <span style={{ width: `${bar.sharePercent}%` }} />
                        </div>
                        <strong className="pres-bar-value">{formatMoney(bar.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'nf' && (
              <div className="pres-demo-pane">
                <div className="pres-pane-toolbar">
                  <div>
                    <h3>Notas Fiscais · Leitura Local de PDF e Rastreio Completo</h3>
                    <p>
                      Clique em uma linha da tabela para simular a abertura dos detalhes fiscais,
                      vínculo financeiro e opções de anexo/envio por e-mail.
                    </p>
                  </div>
                </div>

                <div className="pres-steps-row">
                  <div className="pres-step-box">
                    <span>Passo 1</span>
                    <strong>Upload + Leitura Local</strong>
                    <p>O navegador extrai número da NF, chave de 44 dígitos, data e valor do PDF.</p>
                  </div>
                  <div className="pres-step-box">
                    <span>Passo 2</span>
                    <strong>Conferência no Servidor</strong>
                    <p>O backend valida integridade do PDF e vincula ao cliente, serviço e título.</p>
                  </div>
                  <div className="pres-step-box">
                    <span>Passo 3</span>
                    <strong>Visualização &amp; E-mail</strong>
                    <p>Pré-visualização protegida no painel e envio direto com anexo ao cliente.</p>
                  </div>
                </div>

                <div className="pres-table-wrap">
                  <table className="pres-table">
                    <thead>
                      <tr>
                        <th scope="col">Nota</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Emissão</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoNfs.map((nf) => {
                        const isOpen = expandedNfId === nf.id
                        return (
                          <Fragment key={nf.id}>
                            <tr
                              className={`is-clickable ${isOpen ? 'is-open' : ''}`}
                              onClick={() => setExpandedNfId(isOpen ? null : nf.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setExpandedNfId(isOpen ? null : nf.id)
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isOpen}
                            >
                              <td>
                                <span className={`pres-chevron ${isOpen ? 'is-open' : ''}`}>▶</span>
                                <strong>{nf.numberNf}</strong>
                              </td>
                              <td>{nf.client}</td>
                              <td>{nf.emissionDate}</td>
                              <td className="pres-money-cell">{formatMoney(nf.totalValue)}</td>
                              <td>
                                <span className="pres-badge is-ok">{nf.status}</span>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="pres-nf-detail-row" key={`${nf.id}-detail`}>
                                <td colSpan={5}>
                                  <div className="pres-nf-detail-box">
                                    <div>
                                      <span>Serviço Vinculado</span>
                                      <strong>{nf.serviceName}</strong>
                                    </div>
                                    <div>
                                      <span>Reflexo no Financeiro</span>
                                      <strong>{nf.linkedEntry}</strong>
                                    </div>
                                    <div>
                                      <span>PDF Armazenado</span>
                                      <strong>{nf.fileName} (Ver · Baixar · Enviar por e-mail)</strong>
                                    </div>
                                    <div className="pres-nf-key">
                                      <span>Chave de Acesso</span>
                                      <code>{nf.accessKey}</code>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'governance' && (
              <div className="pres-demo-pane">
                <div className="pres-pane-toolbar">
                  <div>
                    <h3>Governança Multi-Tenant, Perfis de Acesso e LGPD</h3>
                    <p>
                      Segregação estrita entre empresas e papéis de usuário para que cada área
                      acesse apenas o que precisa para operar com segurança.
                    </p>
                  </div>
                </div>

                <div className="pres-gov-grid">
                  <div className="pres-gov-card">
                    <h4>Matriz &amp; Filiais em Camadas</h4>
                    <p>
                      Cadastre a empresa Matriz e habilite filiais sob a mesma governança. O acesso é
                      validado no servidor em todas as consultas e exportações.
                    </p>
                    <ul className="pres-check-list">
                      <li>Visão individual por CNPJ (Matriz ou Filial específica).</li>
                      <li>Visão consolidada autorizada apenas para gestores da Matriz.</li>
                      <li>Trilha de auditoria registrando ações sensíveis, exportações e alterações.</li>
                    </ul>
                  </div>

                  <div className="pres-gov-card">
                    <h4>Conformidade LGPD Nativa</h4>
                    <p>
                      Fluxo preparado para transparência com titulares e preservação de obrigações
                      legais e fiscais.
                    </p>
                    <ul className="pres-check-list">
                      <li>Aceite versionado de Termos de Uso &amp; Política de Privacidade.</li>
                      <li>Portal de Privacidade para consulta, portabilidade e anonimização.</li>
                      <li>Guarda fiscal de títulos e notas preservada conforme prazo legal (5 anos).</li>
                    </ul>
                  </div>
                </div>

                <div className="pres-table-wrap">
                  <table className="pres-table">
                    <thead>
                      <tr>
                        <th scope="col">Perfil</th>
                        <th scope="col">Dashboard BI &amp; Gestão</th>
                        <th scope="col">Financeiro</th>
                        <th scope="col">Notas Fiscais</th>
                        <th scope="col">Administração</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Company Admin</strong></td>
                        <td>Completo + Matriz/Filiais</td>
                        <td>Contas, Títulos, Baixas &amp; CSV</td>
                        <td>Upload, Consulta &amp; Envio</td>
                        <td>Equipe &amp; Filiais</td>
                      </tr>
                      <tr>
                        <td><strong>Finance</strong></td>
                        <td>Consulta de Serviços</td>
                        <td>Contas, Títulos, Baixas &amp; CSV</td>
                        <td>Upload, Consulta &amp; Envio</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td><strong>Manager</strong></td>
                        <td>Clientes &amp; Serviços</td>
                        <td>Leitura de Relatórios</td>
                        <td>Consulta &amp; PDF</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td><strong>Observer</strong></td>
                        <td>Somente leitura</td>
                        <td>Somente leitura</td>
                        <td>Somente leitura</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td><strong>Colaborator</strong></td>
                        <td>Apenas serviços atribuídos</td>
                        <td>Bloqueado por segurança</td>
                        <td>Bloqueado por segurança</td>
                        <td>—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="pres-section" id="pres-modules" aria-labelledby="pres-modules-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">O QUE JÁ ESTÁ EM PRODUÇÃO</p>
              <h2 id="pres-modules-title">Módulos ativos hoje no PFM</h2>
              <p>
                Capacidades já homologadas e disponíveis imediatamente após a aprovação do cadastro
                da sua empresa.
              </p>
            </div>
          </div>

          <div className="pres-cards-grid">
            {activeCapabilities.map((item) => (
              <article className="pres-feature-card" key={item.title}>
                <span className="pres-status-pill is-live">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pres-section" id="pres-roadmap" aria-labelledby="pres-roadmap-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">EVOLUÇÃO ESTRUTURADA</p>
              <h2 id="pres-roadmap-title">Roadmap: Financeiro e Contabilidade</h2>
              <p>
                Evolução planejada em fases para unir o controle diário do caixa (Financeiro) à
                escrituração em regime de competência (Contabilidade), respeitando limites técnicos
                e regulatórios.
              </p>
            </div>

            <div className="pres-chip-group" role="group" aria-label="Filtrar trilha do roadmap">
              <button
                aria-pressed={roadmapTrack === 'all'}
                onClick={() => setRoadmapTrack('all')}
                type="button"
              >
                Visão Completa
              </button>
              <button
                aria-pressed={roadmapTrack === 'finance'}
                onClick={() => setRoadmapTrack('finance')}
                type="button"
              >
                Financeiro (Fases 1–3)
              </button>
              <button
                aria-pressed={roadmapTrack === 'accounting'}
                onClick={() => setRoadmapTrack('accounting')}
                type="button"
              >
                Contabilidade (Fases 1–3)
              </button>
            </div>
          </div>

          <div className="pres-roadmap-grid">
            {visibleRoadmapPhases.map((phase) => (
              <article
                className={`pres-roadmap-card is-${phase.statusTone}`}
                key={`${phase.track}-${phase.phase}`}
              >
                <div className="pres-roadmap-top">
                  <span className="pres-roadmap-track">
                    {phase.trackLabel} · {phase.phase}
                  </span>
                  <span className={`pres-status-pill is-${phase.statusTone}`}>
                    {phase.statusLabel}
                  </span>
                </div>
                <h3>{phase.title}</h3>
                <p className="pres-roadmap-summary">{phase.summary}</p>
                <ul className="pres-check-list">
                  {phase.deliverables.map((deliverable) => (
                    <li key={deliverable}>{deliverable}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="pres-disclaimer" role="note">
            <strong>Compromisso de transparência operacional e legal:</strong> o PFM não atua como
            banco ou instituição de pagamento (eventuais cobranças online na Fase 3 serão operadas
            via parceiros/PSPs regulados) e o futuro Módulo de Contabilidade atua como apoio
            gerencial e pré-contabilidade integrada — sem substituir a escrituração oficial e a
            assinatura de profissional habilitado no CRC.
          </div>
        </section>

        <section className="pres-cta-band" aria-label="Solicitar acesso à plataforma">
          <div>
            <p className="eyebrow">PRONTO PARA CONHECER DE PERTO?</p>
            <h2>Leve organização financeira e previsibilidade para sua operação.</h2>
            <p>
              Solicite o cadastro da sua empresa em poucos minutos com validação por e-mail ou
              entre com sua conta existente para começar a operar.
            </p>
          </div>
          <div className="pres-cta-actions">
            <button className="pres-btn-primary is-lg" onClick={onRequestAccess} type="button">
              Solicitar cadastro da empresa
              <span aria-hidden="true">→</span>
            </button>
            <button className="pres-btn-secondary is-lg" onClick={onBackToLogin} type="button">
              Voltar para o login
            </button>
          </div>
        </section>
      </main>

      <footer className="pres-footer">
        <p>
          © 2026 PFM ·{' '}
          <button className="text-button footnote-link" onClick={() => onOpenLegal('privacy')} type="button">
            Política de Privacidade
          </button>{' '}
          ·{' '}
          <button className="text-button footnote-link" onClick={() => onOpenLegal('terms')} type="button">
            Termos de Uso
          </button>
          {dpoEmail ? ` · DPO: ${dpoEmail}` : ''}
        </p>
      </footer>
    </div>
  )
}

export default PlatformPresentation
