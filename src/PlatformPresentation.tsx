import { Fragment, useState } from 'react'
import type { LegalDocKind } from './LegalDocumentsModal'
import './PlatformPresentation.css'

type Theme = 'dark' | 'light'
type DemoTab = 'finance' | 'bi' | 'nf' | 'governance'
type FinanceFilter = 'all' | 'receivable' | 'payable' | 'overdue'
type UnitKey = 'consolidated' | 'matriz' | 'filial_01'
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
  status: 'Ativa'
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

const audienceProfiles = [
  {
    title: 'Prestadores de Serviço & Consultorias',
    description:
      'Para quem fecha projetos ou contratos e quer enxergar o que foi entregue, faturado e realmente recebido.',
  },
  {
    title: 'Pequenas e Médias Empresas',
    description:
      'Para negócios que querem sair das planilhas espalhadas e centralizar clientes, notas e financeiro sem burocracia.',
  },
  {
    title: 'Empresas com Cobranças Parceladas',
    description:
      'Para quem vende em várias parcelas ou tem contas fixas todo mês e não quer perder datas de vencimento.',
  },
  {
    title: 'Negócios com 1 CNPJ ou Matriz + Filiais',
    description:
      'Funciona perfeitamente para uma empresa única e já cresce pronto para gerenciar outras unidades no mesmo lugar.',
  },
]

const beforeItems = [
  'Serviços anotados em planilha, notas fiscais em pastas no computador e cobranças no WhatsApp.',
  'Dificuldade para saber quanto realmente vai entrar e sair do caixa nas próximas semanas.',
  'Risco de esquecer uma parcela em atraso ou perder o comprovante de pagamento de um cliente.',
  'Dependência de horas conferindo extratos e procurando PDFs toda vez que o contador pede os documentos do mês.',
]

const afterItems = [
  'Clientes, serviços, notas fiscais e contas a pagar/receber conectados em um único painel simples.',
  'Visão imediata do dinheiro em conta, valores a receber, contas a vencer e parcelas atrasadas.',
  'Lançamento parcelado em segundos: basta informar o valor total, quantas parcelas e o dia fixo do mês.',
  'Cada pessoa da equipe vê apenas o que precisa, com histórico protegido e organização pronta para o contador.',
]

const practicalRoutineSteps = [
  {
    step: 'Passo 1 · Serviço fechado',
    title: 'Você cadastra o cliente e o serviço',
    example: 'Ex.: Fechou um serviço de R$ 6.000,00 para o Cliente Exemplo 01.',
    detail:
      'O serviço fica registrado com cliente, datas e acompanhamento de andamento (na fila, em execução ou finalizado).',
  },
  {
    step: 'Passo 2 · Nota fiscal anexada',
    title: 'Você sobe o PDF da nota e o sistema lê os dados',
    example: 'Ex.: Seleciona o PDF da NF 000002 e os campos são preenchidos na hora.',
    detail:
      'O arquivo fica guardado com segurança para consultar, baixar ou enviar por e-mail para o cliente com 1 clique.',
  },
  {
    step: 'Passo 3 · Cobrança parcelada',
    title: 'O sistema divide as parcelas automaticamente',
    example: 'Ex.: R$ 6.000,00 em 3 parcelas de R$ 2.000,00 vencendo todo dia 10.',
    detail:
      'Você escolhe se quer informar o valor total ou da parcela, define a área responsável e o dia fixo de vencimento.',
  },
  {
    step: 'Passo 4 · Dinheiro no caixa',
    title: 'Você registra o pagamento e acompanha o saldo real',
    example: 'Ex.: Cliente pagou a 1ª parcela? Dê baixa total ou parcial com data e conta.',
    detail:
      'O saldo da conta atualiza automaticamente e o painel mostra quanto entrou, o que falta receber e se há atrasos.',
  },
]

const demoFinanceEntries: DemoFinanceEntry[] = [
  {
    id: 'fin-1',
    type: 'receivable',
    description: 'Mensalidade de Suporte e Sistema — Plano Empresarial',
    counterparty: 'Cliente Exemplo 01 · Logística',
    category: 'Receita de Mensalidades',
    costCenter: 'Comercial',
    installmentLabel: 'Parcela 3 de 12 · Todo dia 10',
    dueDate: '10/12/2026',
    amount: 4850,
    status: 'pending',
    settlementNote: 'Gerado direto do cadastro de serviços do cliente.',
  },
  {
    id: 'fin-2',
    type: 'receivable',
    description: 'Implantação de Sistema (NF 000002)',
    counterparty: 'Cliente Exemplo 02 · Engenharia',
    category: 'Receita de Serviços',
    costCenter: 'Projetos',
    installmentLabel: 'Parcela 1 de 2 · Todo dia 15',
    dueDate: '15/11/2026',
    amount: 7200,
    status: 'overdue',
    settlementNote: 'Atrasado há 12 dias · sinalizado no resumo para cobrança.',
  },
  {
    id: 'fin-3',
    type: 'receivable',
    description: 'Consultoria Operacional Trimestral',
    counterparty: 'Cliente Exemplo 03 · Serviços',
    category: 'Receita de Serviços',
    costCenter: 'Projetos',
    installmentLabel: 'Pagamento único',
    dueDate: '25/11/2026',
    amount: 3200,
    status: 'paid',
    settlementNote: 'Recebimento confirmado na Conta Bancária Matriz (Exemplo) (histórico salvo).',
  },
  {
    id: 'fin-4',
    type: 'payable',
    description: 'Servidor em Nuvem & Backups',
    counterparty: 'Fornecedor Exemplo · Hospedagem',
    category: 'Custos Operacionais',
    costCenter: 'Tecnologia',
    installmentLabel: 'Parcela 2 de 3 · Todo dia 05',
    dueDate: '05/12/2026',
    amount: 1680,
    status: 'pending',
    settlementNote: 'Já considerado na previsão de pagamentos dos próximos 30 dias.',
  },
  {
    id: 'fin-5',
    type: 'payable',
    description: 'Assinatura de Ferramentas da Equipe',
    counterparty: 'Fornecedor Exemplo · Ferramentas',
    category: 'Despesas Administrativas',
    costCenter: 'Diretoria',
    installmentLabel: 'Parcela 1 de 3 · Todo dia 20',
    dueDate: '20/11/2026',
    amount: 600,
    status: 'partial',
    settlementNote: 'R$ 200,00 já pagos · faltam R$ 400,00 para quitar.',
  },
]

const demoBiByUnit: Record<UnitKey, DemoBiUnitData> = {
  consolidated: {
    label: 'Todas as Unidades (Visão Geral do Grupo)',
    scopeTag: 'Soma da Matriz + Filial',
    receivableTotal: 148900,
    averageTicket: 6473.91,
    completedCount: 19,
    pendingCount: 4,
    bars: [
      { name: 'Implantação de Gestão & Painel', client: 'Cliente Exemplo 01 · Logística', value: 42500, sharePercent: 100 },
      { name: 'Acompanhamento Mensal', client: 'Cliente Exemplo 02 · Engenharia', value: 31800, sharePercent: 75 },
      { name: 'Automação Financeira', client: 'Cliente Exemplo 03 · Serviços', value: 24400, sharePercent: 57 },
      { name: 'Organização de Notas por Filial', client: 'Cliente Exemplo 04 · Comércio', value: 18900, sharePercent: 44 },
    ],
  },
  matriz: {
    label: 'Unidade Matriz (Exemplo)',
    scopeTag: 'Somente unidade Matriz',
    receivableTotal: 102400,
    averageTicket: 6826.67,
    completedCount: 13,
    pendingCount: 2,
    bars: [
      { name: 'Implantação de Gestão & Painel', client: 'Cliente Exemplo 01 · Logística', value: 42500, sharePercent: 100 },
      { name: 'Acompanhamento Mensal', client: 'Cliente Exemplo 02 · Engenharia', value: 31800, sharePercent: 75 },
      { name: 'Consultoria Financeira', client: 'Cliente Exemplo 05 · Consultoria', value: 16200, sharePercent: 38 },
      { name: 'Revisão Operacional', client: 'Cliente Exemplo 06 · Operações', value: 11900, sharePercent: 28 },
    ],
  },
  filial_01: {
    label: 'Unidade Filial 01 (Exemplo)',
    scopeTag: 'Somente unidade Filial 01',
    receivableTotal: 46500,
    averageTicket: 5812.5,
    completedCount: 6,
    pendingCount: 2,
    bars: [
      { name: 'Automação Financeira', client: 'Cliente Exemplo 03 · Serviços', value: 24400, sharePercent: 100 },
      { name: 'Organização de Notas por Filial', client: 'Cliente Exemplo 04 · Comércio', value: 18900, sharePercent: 77 },
      { name: 'Treinamento da Equipe', client: 'Cliente Exemplo 07 · Indústria', value: 3200, sharePercent: 13 },
    ],
  },
}

const demoNfs: DemoNfItem[] = [
  {
    id: 'nf-002',
    numberNf: '000002',
    client: 'Cliente Exemplo 02 · Engenharia',
    emissionDate: '12/11/2026',
    totalValue: 7200,
    status: 'Ativa',
    accessKey: '00000000000000000000000000000000000000000002',
    serviceName: 'Implantação de Sistema e Integração',
    fileName: 'NF-000002-cliente-exemplo-02.pdf',
    linkedEntry: 'Cobrança gerada em 2 parcelas de R$ 3.600,00',
  },
  {
    id: 'nf-001',
    numberNf: '000001',
    client: 'Cliente Exemplo 03 · Serviços',
    emissionDate: '08/11/2026',
    totalValue: 3200,
    status: 'Ativa',
    accessKey: '00000000000000000000000000000000000000000001',
    serviceName: 'Consultoria Operacional Trimestral',
    fileName: 'NF-000001-cliente-exemplo-03.pdf',
    linkedEntry: 'Recebimento já confirmado na Conta Bancária Matriz (Exemplo)',
  },
]

const activeCapabilities = [
  {
    tag: 'Disponível agora',
    title: 'Contas a Pagar e a Receber',
    description:
      'Controle o dinheiro que entra e sai com parcelamento automático, escolha do dia fixo de vencimento, áreas da empresa (centros de custo), previsão de caixa, lista de atrasados e exportação em planilha.',
  },
  {
    tag: 'Disponível agora',
    title: 'Painel de Resultados do Negócio',
    description:
      'Veja o total vendido, valor médio por serviço, o que já foi concluído e o que está pendente em gráficos fáceis de clicar para filtrar por cliente, valor ou data.',
  },
  {
    tag: 'Disponível agora',
    title: 'Notas Fiscais com Leitura de PDF',
    description:
      'Ao selecionar o PDF da nota fiscal, o PFM lê número, chave, data e valor automaticamente para você não precisar digitar tudo, guarda o arquivo e envia por e-mail para o cliente.',
  },
  {
    tag: 'Disponível agora',
    title: 'Cadastro de Clientes e Serviços',
    description:
      'Organize todos os seus clientes e serviços prestados em listas limpas. Com 1 clique na linha você vê os detalhes completos e transforma o serviço em cobrança no financeiro.',
  },
  {
    tag: 'Disponível agora',
    title: 'Matriz e Filiais no Mesmo Acesso',
    description:
      'Se a empresa tiver mais de um CNPJ ou filial, os dados ficam separados por unidade, mas quem administra a Matriz consegue enxergar tudo junto quando quiser.',
  },
  {
    tag: 'Disponível agora',
    title: 'Permissões por Cargo e Privacidade (LGPD)',
    description:
      'Defina exatamente o que cada funcionário pode fazer (quem lança pagamentos, quem só consulta e quem vê apenas suas próprias tarefas), com registro de segurança e proteção de dados.',
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
    trackLabel: 'Financeiro',
    phase: 'Etapa 1',
    statusLabel: 'Já funcionando',
    statusTone: 'live',
    title: 'Controle de Contas, Parcelas e Fluxo de Caixa',
    summary:
      'Tudo o que a empresa precisa hoje para saber quanto tem em caixa, quanto vai receber, quanto tem para pagar e quem está em atraso.',
    deliverables: [
      'Cadastro de contas bancárias, caixas e carteiras digitais com saldo atualizado automaticamente a cada baixa.',
      'Lançamentos divididos por valor total ou por parcela, com definição obrigatória do dia fixo de vencimento.',
      'Registro de pagamentos totais ou parciais com juros, multa, desconto e estorno seguro sem apagar o histórico.',
      'Visão do que já entrou/saiu, previsão futura de caixa, contas vencidas e download em planilha (CSV).',
    ],
  },
  {
    track: 'finance',
    trackLabel: 'Financeiro',
    phase: 'Etapa 2',
    statusLabel: 'Próxima entrega',
    statusTone: 'next',
    title: 'Importação do Extrato Bancário e Aprovação de Pagamentos',
    summary:
      'Menos trabalho manual conferindo extrato do banco e mais segurança antes de liberar pagamentos maiores.',
    deliverables: [
      'Importação gratuita do extrato do seu banco (arquivos OFX ou CSV) com sugestão automática do que já bate com suas contas.',
      'Transferência organizada entre contas da mesma empresa ou entre Matriz e Filiais, sem somar faturamento duplicado.',
      'Relatório mensal mostrando lucro/prejuízo real pelo mês do serviço prestado, não apenas pela data do pagamento.',
      'Regra de dupla conferência: pagamentos acima de um valor escolhido exigem aprovação de outra pessoa antes de pagar.',
    ],
  },
  {
    track: 'finance',
    trackLabel: 'Financeiro',
    phase: 'Etapa 3',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Assinaturas Recorrentes, PIX/Boleto Automático e Nota Fiscal Nacional',
    summary:
      'Pensado para empresas que cobram mensalidades ou querem automatizar cobranças e emissão de notas.',
    deliverables: [
      'Contratos mensais ou anuais que geram cobranças e previsões futuras automaticamente todo mês.',
      'Indicadores prontos para negócios de assinatura: receita mensal recorrente, cancelamentos e fôlego de caixa.',
      'Geração de PIX e boleto usando parceiros de pagamento regulados, dando baixa automática quando o cliente paga.',
      'Integração direta para emissão de Nota Fiscal de Serviço no padrão nacional.',
    ],
  },
  {
    track: 'accounting',
    trackLabel: 'Contabilidade',
    phase: 'Etapa 1',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Organização Contábil Automática desde a Origem',
    summary:
      'Estrutura pensada para deixar cada movimentação da empresa organizada no padrão que os escritórios de contabilidade utilizam.',
    deliverables: [
      'Plano de contas já pronto para pequenas e médias empresas, sem precisar montar do zero.',
      'Registros contábeis protegidos que não permitem exclusões silenciosas — qualquer correção gera um estorno transparente.',
      'Fechamento mensal de período para evitar alterações acidentais em meses que já foram conferidos.',
      'Relatórios de conferência contábil (Diário, Razão e Balancete) sempre batendo os valores automaticamente.',
    ],
  },
  {
    track: 'accounting',
    trackLabel: 'Contabilidade',
    phase: 'Etapa 2',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Envio Organizado de Tudo para o Seu Contador em 1 Clique',
    summary:
      'Chega de ficar juntando comprovantes e notas no fim do mês: o PFM prepara o pacote completo para a contabilidade.',
    deliverables: [
      'O que você lança no Financeiro e nas Notas Fiscais já alimenta automaticamente o resumo contábil do mês.',
      'Acesso exclusivo para o seu Contador entrar e conferir relatórios e documentos sem mexer no caixa da empresa.',
      'Demonstrativo prévio de lucro (DRE) e patrimônio para o dono da empresa acompanhar o resultado antes do fechamento.',
      'Botão "Pacote do Contador": baixa um pacote organizado com os relatórios e todos os PDFs das notas do mês.',
    ],
  },
  {
    track: 'accounting',
    trackLabel: 'Contabilidade',
    phase: 'Etapa 3',
    statusLabel: 'Planejado',
    statusTone: 'planned',
    title: 'Acompanhamento de Planos Anuais e Termômetro de Impostos (Fator R)',
    summary:
      'Recursos avançados para empresas de serviço e tecnologia tomarem decisões melhores ao longo do ano.',
    deliverables: [
      'Para quem vende planos anuais à vista: divide corretamente a receita mês a mês para não distorcer o resultado.',
      'Termômetro indicativo do Fator R (Simples Nacional) para ajudar você e seu contador a avaliarem economia de imposto.',
      'Visão consolidada do grupo já eliminando transferências internas entre Matriz e Filiais.',
      'Rastreio reforçado de integridade para auditorias e guarda segura pelo prazo exigido por lei.',
    ],
  },
]

const faqItems = [
  {
    question: 'Não sou contador nem trabalho com finanças. Vou conseguir usar o PFM?',
    answer:
      'Sim. O sistema foi pensado para o dia a dia do dono da empresa ou da equipe administrativa: você escolhe o cliente, cadastra o valor e as parcelas em linguagem simples, e o sistema cuida dos cálculos e saldos.',
  },
  {
    question: 'O PFM substitui o meu contador ou escritório de contabilidade?',
    answer:
      'Não. Por lei no Brasil, balanços oficiais e guias de impostos precisam ser feitos e assinados por um contador habilitado. O PFM organiza toda a rotina financeira e as notas fiscais da empresa para facilitar muito o trabalho entre você e seu contador.',
  },
  {
    question: 'O sistema mexe diretamente no dinheiro da minha conta bancária?',
    answer:
      'Não. O PFM não é um banco e não movimenta seu dinheiro. Ele funciona como seu painel de controle e organização: você registra as contas e dá baixa nos recebimentos/pagamentos (e nas próximas etapas poderá importar o extrato bancário para conferir tudo rápido).',
  },
  {
    question: 'Minha empresa é pequena e só tem 1 CNPJ. Vale a pena usar?',
    answer:
      'Com certeza. Você pode começar com apenas 1 empresa, 1 conta bancária e poucos clientes. Se no futuro abrir uma filial ou aumentar a equipe, a estrutura já está pronta sem precisar trocar de sistema.',
  },
  {
    question: 'Consigo limitar o que cada funcionário vê dentro da ferramenta?',
    answer:
      'Sim. Existem perfis separados: quem é de campo vê apenas os próprios serviços e nunca vê o financeiro da empresa; quem só acompanha pode ter acesso apenas de leitura; e apenas perfis autorizados alteram contas e pagamentos.',
  },
  {
    question: 'Como funciona para liberar o acesso para a minha empresa?',
    answer:
      'Você clica em "Solicitar cadastro", preenche os dados da empresa e do responsável, confirma o código enviado no seu e-mail e, assim que aprovado, já pode entrar e começar a usar no mesmo dia.',
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
  const [expandedNfId, setExpandedNfId] = useState<string | null>('nf-002')
  const [roadmapTrack, setRoadmapTrack] = useState<RoadmapTrack>('all')
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

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
              PFM <strong>Gestão Empresarial</strong>
            </span>
          </a>

          <nav className="pres-nav" aria-label="Navegação da apresentação">
            <a href="#pres-for-who">Para quem é</a>
            <a href="#pres-how">Como funciona</a>
            <a href="#pres-demo">Veja na tela</a>
            <a href="#pres-roadmap">Futuras novidades</a>
            <a href="#pres-faq">Dúvidas</a>
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
            <p className="eyebrow">SIMPLES DE ENTENDER E PRONTO PARA O DIA A DIA</p>
            <h1>Organize clientes, notas fiscais e o dinheiro da empresa sem depender de planilhas.</h1>
            <p className="pres-hero-lead">
              Mesmo que você não seja da área financeira ou contábil, o <strong>PFM</strong> mostra
              com clareza quanto tem em caixa, quem precisa pagar você, quais contas vencem nos
              próximos dias e onde estão as notas fiscais da sua empresa.
            </p>

            <div className="pres-hero-actions">
              <button className="pres-btn-primary is-lg" onClick={onRequestAccess} type="button">
                Solicitar cadastro da empresa
                <span aria-hidden="true">→</span>
              </button>
              <a className="pres-btn-secondary is-lg" href="#pres-how">
                Entender em 4 passos
              </a>
              <button className="text-button pres-login-link" onClick={onBackToLogin} type="button">
                Já tenho conta · Voltar ao login
              </button>
            </div>

            <div className="pres-hero-badges" aria-label="Benefícios principais">
              <span>Sem complicação contábil</span>
              <span>Leitura automática de PDF da nota</span>
              <span>Parcelamento com dia fixo</span>
              <span>Funciona para 1 empresa ou várias filiais</span>
            </div>
          </div>

          <aside className="pres-hero-card" aria-label="Resumo rápido do que o PFM entrega">
            <div className="pres-hero-card-head">
              <span>EM RESUMO, O QUE ELE ENTREGA?</span>
              <span className="pres-status-pill is-live">Pronto para usar</span>
            </div>

            <ol className="pres-flow-list">
              <li>
                <strong>1. Tudo do cliente em um lugar só</strong>
                <span>Serviços prestados, status de entrega e histórico de faturamento organizados.</span>
              </li>
              <li>
                <strong>2. Notas fiscais fáceis de achar e enviar</strong>
                <span>Você sobe o PDF, o sistema lê os dados e envia por e-mail quando precisar.</span>
              </li>
              <li>
                <strong>3. Controle claro do que entra e sai (Ativo hoje)</strong>
                <span>Contas a pagar/receber, parcelas automáticas, saldo real e alertas de atraso.</span>
              </li>
              <li>
                <strong>4. Integração com banco e contador (Próximas fases)</strong>
                <span>Importação de extrato bancário e pacote mensal pronto para enviar ao contador.</span>
              </li>
            </ol>
          </aside>
        </section>

        <section className="pres-section" id="pres-for-who" aria-labelledby="pres-for-who-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">CLAREZA ANTES DE TUDO</p>
              <h2 id="pres-for-who-title">Para quem o PFM foi feito e o que muda na rotina</h2>
              <p>
                Se você já se pegou procurando uma nota fiscal antiga ou tentando somar no papel
                quanto vai sobrar no fim do mês, veja como o sistema ajuda na prática.
              </p>
            </div>
          </div>

          <div className="pres-audience-grid">
            {audienceProfiles.map((profile) => (
              <article className="pres-audience-card" key={profile.title}>
                <h3>{profile.title}</h3>
                <p>{profile.description}</p>
              </article>
            ))}
          </div>

          <div className="pres-compare-grid">
            <article className="pres-compare-card is-before">
              <span className="pres-compare-tag">Como costuma ser antes</span>
              <h3>Informações soltas e retrabalho toda semana</h3>
              <ul className="pres-check-list">
                {beforeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="pres-compare-card is-after">
              <span className="pres-compare-tag is-good">Como fica com o PFM</span>
              <h3>Rotina conectada do serviço até o saldo em conta</h3>
              <ul className="pres-check-list">
                {afterItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="pres-section" id="pres-how" aria-labelledby="pres-how-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">NA PRÁTICA, PASSO A PASSO</p>
              <h2 id="pres-how-title">Como funciona um dia comum usando o PFM</h2>
              <p>
                Acompanhe um exemplo real de ponta a ponta — desde fechar um serviço até ver o
                dinheiro cair na conta da empresa.
              </p>
            </div>
          </div>

          <div className="pres-routine-grid">
            {practicalRoutineSteps.map((item) => (
              <article className="pres-routine-card" key={item.step}>
                <span className="pres-routine-step">{item.step}</span>
                <h3>{item.title}</h3>
                <div className="pres-routine-example">{item.example}</div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pres-section" id="pres-demo" aria-labelledby="pres-demo-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">VEJA COMO É POR DENTRO</p>
              <h2 id="pres-demo-title">Demonstrativo interativo com exemplos do sistema</h2>
              <p>
                Clique nas abas e botões abaixo para testar as principais telas sem precisar criar
                conta primeiro.
              </p>
            </div>
            <span className="pres-demo-notice" role="note">
              Exemplo ilustrativo para demonstração
            </span>
          </div>

          <div className="pres-tabs" role="tablist" aria-label="Telas do demonstrativo">
            <button
              aria-selected={activeTab === 'finance'}
              className={activeTab === 'finance' ? 'is-active' : ''}
              onClick={() => setActiveTab('finance')}
              role="tab"
              type="button"
            >
              1. Contas e Caixa
            </button>
            <button
              aria-selected={activeTab === 'bi'}
              className={activeTab === 'bi' ? 'is-active' : ''}
              onClick={() => setActiveTab('bi')}
              role="tab"
              type="button"
            >
              2. Resumo do Negócio
            </button>
            <button
              aria-selected={activeTab === 'nf'}
              className={activeTab === 'nf' ? 'is-active' : ''}
              onClick={() => setActiveTab('nf')}
              role="tab"
              type="button"
            >
              3. Notas Fiscais (PDF)
            </button>
            <button
              aria-selected={activeTab === 'governance'}
              className={activeTab === 'governance' ? 'is-active' : ''}
              onClick={() => setActiveTab('governance')}
              role="tab"
              type="button"
            >
              4. Equipe e Segurança
            </button>
          </div>

          <div className="pres-demo-stage" role="tabpanel">
            {activeTab === 'finance' && (
              <div className="pres-demo-pane">
                <div className="pres-pane-toolbar">
                  <div>
                    <h3>Controle de Contas a Pagar e a Receber</h3>
                    <p>
                      Filtre pelos botões ao lado para enxergar o que já entrou, o que está para
                      vencer e o que precisa de cobrança.
                    </p>
                  </div>
                  <div className="pres-chip-group" role="group" aria-label="Filtrar contas de demonstração">
                    <button
                      aria-pressed={financeFilter === 'all'}
                      onClick={() => setFinanceFilter('all')}
                      type="button"
                    >
                      Mostrar tudo (5)
                    </button>
                    <button
                      aria-pressed={financeFilter === 'receivable'}
                      onClick={() => setFinanceFilter('receivable')}
                      type="button"
                    >
                      Vou receber
                    </button>
                    <button
                      aria-pressed={financeFilter === 'payable'}
                      onClick={() => setFinanceFilter('payable')}
                      type="button"
                    >
                      Vou pagar
                    </button>
                    <button
                      aria-pressed={financeFilter === 'overdue'}
                      onClick={() => setFinanceFilter('overdue')}
                      type="button"
                    >
                      Atrasados
                    </button>
                  </div>
                </div>

                <div className="pres-kpi-grid">
                  <article className="pres-kpi-card">
                    <span>Dinheiro em Conta Hoje</span>
                    <strong>{formatMoney(48620)}</strong>
                    <small>Soma das contas cadastradas</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Falta Receber</span>
                    <strong>{formatMoney(12050)}</strong>
                    <small>Parcelas futuras dos clientes</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Falta Pagar</span>
                    <strong>{formatMoney(2080)}</strong>
                    <small>Já descontando o que foi pago</small>
                  </article>
                  <article className="pres-kpi-card is-alert">
                    <span>Em Atraso</span>
                    <strong>{formatMoney(7200)}</strong>
                    <small>1 parcela vencida para cobrar</small>
                  </article>
                </div>

                <div className="pres-table-wrap">
                  <table className="pres-table">
                    <thead>
                      <tr>
                        <th scope="col">Movimento</th>
                        <th scope="col">Descrição &amp; Cliente / Fornecedor</th>
                        <th scope="col">Área</th>
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
                              {entry.type === 'receivable' ? 'Entrada' : 'Saída'}
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
                                ? 'Pago'
                                : entry.status === 'overdue'
                                  ? 'Atrasado'
                                  : entry.status === 'partial'
                                    ? 'Pago em parte'
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
                    <h3>Resumo para o Dono Acompanhar Resultados</h3>
                    <p>
                      Se tiver mais de uma unidade, clique nos botões para ver tudo somado ou
                      acompanhar cada filial separadamente.
                    </p>
                  </div>
                  <div className="pres-chip-group" role="group" aria-label="Selecionar unidade de demonstração">
                    <button
                      aria-pressed={selectedUnit === 'consolidated'}
                      onClick={() => setSelectedUnit('consolidated')}
                      type="button"
                    >
                      Todas as Unidades
                    </button>
                    <button
                      aria-pressed={selectedUnit === 'matriz'}
                      onClick={() => setSelectedUnit('matriz')}
                      type="button"
                    >
                      Unidade Matriz
                    </button>
                    <button
                      aria-pressed={selectedUnit === 'filial_01'}
                      onClick={() => setSelectedUnit('filial_01')}
                      type="button"
                    >
                      Unidade Filial 01
                    </button>
                  </div>
                </div>

                <div className="pres-unit-banner">
                  <strong>{currentBiData.label}</strong>
                  <span>{currentBiData.scopeTag}</span>
                </div>

                <div className="pres-kpi-grid">
                  <article className="pres-kpi-card">
                    <span>Total em Serviços</span>
                    <strong>{formatMoney(currentBiData.receivableTotal)}</strong>
                    <small>Soma dos trabalhos ativos</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Valor Médio por Serviço</span>
                    <strong>{formatMoney(currentBiData.averageTicket)}</strong>
                    <small>Média dos contratos cadastrados</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Serviços Concluídos</span>
                    <strong>{currentBiData.completedCount}</strong>
                    <small>Entregues ao cliente</small>
                  </article>
                  <article className="pres-kpi-card">
                    <span>Em Andamento</span>
                    <strong>{currentBiData.pendingCount}</strong>
                    <small>Sendo executados pela equipe</small>
                  </article>
                </div>

                <div className="pres-bars-card">
                  <h4>Serviços com maior peso no faturamento desta visão</h4>
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
                    <h3>Notas Fiscais Organizadas (Sem Digitação Repetida)</h3>
                    <p>
                      Clique em qualquer linha da tabela abaixo para abrir ou fechar os detalhes da
                      nota e o vínculo com o pagamento.
                    </p>
                  </div>
                </div>

                <div className="pres-steps-row">
                  <div className="pres-step-box">
                    <span>1. Subiu o PDF</span>
                    <strong>Preenchimento automático</strong>
                    <p>O sistema lê número, data, valor e chave direto do arquivo PDF da nota.</p>
                  </div>
                  <div className="pres-step-box">
                    <span>2. Tudo conectado</span>
                    <strong>Ligada ao cliente e ao caixa</strong>
                    <p>A nota já fica associada ao serviço prestado e à cobrança no financeiro.</p>
                  </div>
                  <div className="pres-step-box">
                    <span>3. Fácil de achar</span>
                    <strong>Ver na tela ou enviar</strong>
                    <p>Precisa mandar para o cliente ou contador? Visualize, baixe ou envie por e-mail.</p>
                  </div>
                </div>

                <div className="pres-table-wrap">
                  <table className="pres-table">
                    <thead>
                      <tr>
                        <th scope="col">Nota</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Data</th>
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
                              <tr className="pres-nf-detail-row">
                                <td colSpan={5}>
                                  <div className="pres-nf-detail-box">
                                    <div>
                                      <span>Serviço ligado à nota</span>
                                      <strong>{nf.serviceName}</strong>
                                    </div>
                                    <div>
                                      <span>Como está no Financeiro</span>
                                      <strong>{nf.linkedEntry}</strong>
                                    </div>
                                    <div>
                                      <span>Arquivo salvo</span>
                                      <strong>{nf.fileName} (Abrir · Baixar · Enviar por e-mail)</strong>
                                    </div>
                                    <div className="pres-nf-key">
                                      <span>Código / Chave da Nota</span>
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
                    <h3>Cada Pessoa Vê Apenas o Que Faz Sentido para o Cargo</h3>
                    <p>
                      Segurança para trabalhar com tranquilidade: a equipe operacional não vê o
                      saldo da empresa, e tudo fica registrado com histórico.
                    </p>
                  </div>
                </div>

                <div className="pres-gov-grid">
                  <div className="pres-gov-card">
                    <h4>Separação entre Unidades</h4>
                    <p>
                      Quem trabalha em uma filial acessa apenas os dados daquela filial. Só quem
                      administra a Matriz consegue alternar entre unidades ou ver o todo.
                    </p>
                    <ul className="pres-check-list">
                      <li>Dados de clientes e financeiro nunca se misturam entre empresas.</li>
                      <li>Histórico registra quem criou, alterou ou baixou cada valor.</li>
                    </ul>
                  </div>

                  <div className="pres-gov-card">
                    <h4>Privacidade e Proteção de Dados (LGPD)</h4>
                    <p>
                      Seus clientes e colaboradores contam com regras claras de privacidade e guarda
                      segura das informações.
                    </p>
                    <ul className="pres-check-list">
                      <li>Registro oficial de termos de uso e política de privacidade.</li>
                      <li>Notas e registros financeiros preservados pelo prazo legal de 5 anos.</li>
                    </ul>
                  </div>
                </div>

                <div className="pres-table-wrap">
                  <table className="pres-table">
                    <thead>
                      <tr>
                        <th scope="col">Tipo de Usuário</th>
                        <th scope="col">Clientes e Serviços</th>
                        <th scope="col">Financeiro</th>
                        <th scope="col">Notas Fiscais</th>
                        <th scope="col">Equipe e Filiais</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Dono / Administrador</strong></td>
                        <td>Acesso completo</td>
                        <td>Cadastra, baixa e exporta</td>
                        <td>Sobe PDF, consulta e envia</td>
                        <td>Gerencia tudo</td>
                      </tr>
                      <tr>
                        <td><strong>Financeiro</strong></td>
                        <td>Consulta serviços</td>
                        <td>Cadastra, baixa e exporta</td>
                        <td>Sobe PDF, consulta e envia</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td><strong>Gestor</strong></td>
                        <td>Gerencia clientes e serviços</td>
                        <td>Apenas visualiza relatórios</td>
                        <td>Consulta e abre PDFs</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td><strong>Somente Consulta</strong></td>
                        <td>Apenas visualização</td>
                        <td>Apenas visualização</td>
                        <td>Apenas visualização</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td><strong>Equipe de Campo</strong></td>
                        <td>Vê apenas seus próprios serviços</td>
                        <td>Sem acesso</td>
                        <td>Sem acesso</td>
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
              <p className="eyebrow">O QUE VOCÊ JÁ RECEBE HOJE</p>
              <h2 id="pres-modules-title">Recursos já disponíveis desde o primeiro acesso</h2>
              <p>
                Tudo o que está abaixo já funciona em produção e fica liberado logo após a
                aprovação do cadastro da sua empresa.
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
              <p className="eyebrow">PRÓXIMOS PASSOS DA PLATAFORMA</p>
              <h2 id="pres-roadmap-title">Evolução planejada: Financeiro e Contabilidade</h2>
              <p>
                Veja o que já está no ar hoje e o que vamos entregar nas próximas etapas para unir
                o controle financeiro à organização contábil da sua empresa.
              </p>
            </div>

            <div className="pres-chip-group" role="group" aria-label="Filtrar próximas etapas">
              <button
                aria-pressed={roadmapTrack === 'all'}
                onClick={() => setRoadmapTrack('all')}
                type="button"
              >
                Ver tudo
              </button>
              <button
                aria-pressed={roadmapTrack === 'finance'}
                onClick={() => setRoadmapTrack('finance')}
                type="button"
              >
                Financeiro (Etapas 1–3)
              </button>
              <button
                aria-pressed={roadmapTrack === 'accounting'}
                onClick={() => setRoadmapTrack('accounting')}
                type="button"
              >
                Contabilidade (Etapas 1–3)
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
            <strong>Transparência importante:</strong> o PFM não funciona como banco (seu dinheiro
            continua sempre no seu banco de confiança) e o futuro Módulo de Contabilidade atua para
            organizar e facilitar o fechamento do mês — funcionando em parceria com o seu contador,
            sem substituí-lo.
          </div>
        </section>

        <section className="pres-section" id="pres-faq" aria-labelledby="pres-faq-title">
          <div className="pres-section-head">
            <div>
              <p className="eyebrow">PERGUNTAS COMUNS</p>
              <h2 id="pres-faq-title">Dúvidas de quem está conhecendo o sistema</h2>
              <p>
                Respostas diretas para você saber rapidamente se o PFM faz sentido para o momento da
                sua empresa.
              </p>
            </div>
          </div>

          <div className="pres-faq-list">
            {faqItems.map((faq, index) => {
              const isOpen = openFaqIndex === index
              return (
                <article className={`pres-faq-item ${isOpen ? 'is-open' : ''}`} key={faq.question}>
                  <button
                    aria-expanded={isOpen}
                    className="pres-faq-trigger"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    type="button"
                  >
                    <span>{faq.question}</span>
                    <span className="pres-faq-icon" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && <p className="pres-faq-answer">{faq.answer}</p>}
                </article>
              )
            })}
          </div>
        </section>

        <section className="pres-cta-band" aria-label="Solicitar acesso à plataforma">
          <div>
            <p className="eyebrow">QUER TESTAR NA SUA EMPRESA?</p>
            <h2>Comece a organizar seus clientes, notas e financeiro em um único lugar.</h2>
            <p>
              Faça a solicitação em poucos minutos com confirmação por e-mail ou volte para o login
              se sua empresa já tiver acesso.
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
