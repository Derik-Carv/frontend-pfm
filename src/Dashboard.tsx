import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { apiRequest } from './services/api'
import AdminPanel from './AdminPanel'
import ManagementPanel from './Management'
import NfPanel from './NfPanel'
import { CompanySelector } from './CompanySelector'
import { CompanyManagementPanel } from './CompanyManagementPanel'
import { PrivacyPanel } from './PrivacyPanel'
import { LegalDocumentsModal, type LegalDocKind } from './LegalDocumentsModal'
import './Dashboard.css'

type Role = 'administrator' | 'company_admin' | 'manager' | 'finance' | 'observer' | 'colaborator' | string
type FinderType = 'id' | 'client' | 'price' | 'initialdate' | 'finishdate'
type Theme = 'dark' | 'light'

type Service = {
  id: string
  serviceName: string
  price: string | number
  initialDate: string
  finishDate?: string | null
  clientId: string
  clientName?: string | null
  details: string
  statusServiceId?: string | null
  statusName?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

type Overview = {
  highValueServices: Service[]
  recentServices: Service[]
  oldestServices: Service[]
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

type Detail = {
  title: string
  type: FinderType
  value: string
  services: Service[]
}

type DashboardProps = {
  token: string
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onLogout: () => void
}

const palette = ['#309b79', '#e77c0a', '#1e5e49', '#3b82f6', '#8b5cf6', '#ec4899']
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function tokenRole(token: string): Role {
  try {
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return ''
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.role === 'string' ? payload.role : ''
  } catch {
    return ''
  }
}

function priceNumber(price: string | number) {
  const value = Number(price)
  return Number.isFinite(value) ? value : 0
}

function formatPrice(price: string | number) {
  return currency.format(priceNumber(price))
}

function formatDate(value?: string | Date | null) {
  if (!value) return 'Em aberto'
  const date = value instanceof Date
    ? value
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date)
}

function serviceKey(service: Service) {
  return service.id
}

function uniqueServices(...groups: Service[][]) {
  const services = new Map<string, Service>()
  groups.flat().forEach((service) => {
    const previous = services.get(service.id)
    services.set(service.id, { ...previous, ...service })
  })
  return [...services.values()]
}

function findMatches(services: Service[], type: FinderType, value: string) {
  return services.filter((service) => {
    if (type === 'id') return service.id === value
    if (type === 'client') return service.clientId === value
    if (type === 'price') return String(priceNumber(service.price)) === String(priceNumber(value))
    if (type === 'initialdate') return service.initialDate === value
    return service.finishDate === value
  })
}

function PieChart({
  services,
  selectedServiceId,
}: {
  services: Service[]
  selectedServiceId?: string | null
}) {
  const amounts = services.map((service) => Math.max(0, priceNumber(service.price)))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  let cursor = 0
  const segments = amounts.map((amount, index) => {
    const start = cursor
    cursor += total ? (amount / total) * 360 : 0
    return `${palette[index % palette.length]} ${start}deg ${cursor}deg`
  })

  return (
    <div
      aria-label={`Gráfico de pizza dos ${services.length} maiores valores, total ${formatPrice(total)}`}
      className="dashboard-pie"
      role="img"
      style={{ background: total ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#d9ded5 0deg 360deg)' }}
    >
      <span>
        <strong>{services.length}</strong>
        <small>{selectedServiceId ? 'filtrado' : 'serviços'}</small>
      </span>
    </div>
  )
}

function ServiceBars({
  services,
  dateMode = false,
  selectedId = null,
  onOpen,
}: {
  services: Service[]
  dateMode?: boolean
  selectedId?: string | null
  onOpen: (service: Service) => void
}) {
  const maxPrice = Math.max(...services.map((service) => priceNumber(service.price)), 1)

  return (
    <div className="dashboard-bars" aria-label="Gráfico analítico de valores">
      {services.map((service, index) => {
        const height = Math.max((priceNumber(service.price) / maxPrice) * 100, 6)
        const labelDate = dateMode ? formatDate(service.initialDate) : service.serviceName
        const isSelected = selectedId === service.id
        return (
          <button
            aria-label={`${service.serviceName}, ${formatPrice(service.price)}, início ${formatDate(service.initialDate)}`}
            className={`dashboard-bar-item ${isSelected ? 'is-selected' : ''}`}
            key={serviceKey(service)}
            onClick={() => onOpen(service)}
            title={`${service.serviceName} · ${formatPrice(service.price)} · ${formatDate(service.initialDate)} (Clique para detalhar)`}
            type="button"
          >
            <span className="dashboard-bar-value">{formatPrice(service.price)}</span>
            <span className="dashboard-bar-track">
              <span
                className="dashboard-bar-fill"
                style={{
                  '--bar-height': `${height}%`,
                  opacity: selectedId && !isSelected ? 0.35 : 1,
                  boxShadow: isSelected ? '0 0 10px var(--lime)' : 'none',
                } as CSSProperties}
              />
            </span>
            <span className="dashboard-bar-date">{labelDate}</span>
            <span className="dashboard-bar-name">{dateMode ? service.serviceName : `0${index + 1}`}</span>
          </button>
        )
      })}
    </div>
  )
}

function Dashboard({ token, theme, onThemeChange, onLogout }: DashboardProps) {
  const role = tokenRole(token)
  const isPlatformAdmin = role === 'administrator'
  const isCompanyAdmin = role === 'company_admin'
  const collaboratorView = role === 'colaborator' || role === ''
  const [overview, setOverview] = useState<Overview | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false })
  const [isOverviewLoading, setIsOverviewLoading] = useState(!isPlatformAdmin)
  const [isLoading, setIsLoading] = useState(!isPlatformAdmin)
  const [refreshing, setRefreshing] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activeArea, setActiveArea] = useState<'overview' | 'services' | 'clients' | 'nf' | 'company' | 'admin' | 'privacy'>(
    isPlatformAdmin ? 'admin' : 'overview',
  )
  const [legalModalDoc, setLegalModalDoc] = useState<LegalDocKind | null>(null)

  useEffect(() => {
    if (isPlatformAdmin && activeArea !== 'privacy') {
      setActiveArea('admin')
    } else if (!isPlatformAdmin && activeArea === 'admin') {
      setActiveArea('overview')
    }
  }, [isPlatformAdmin])

  // BI Interactivity States
  const [selectedKpiFilter, setSelectedKpiFilter] = useState<'all' | 'finished' | 'pending' | null>(null)
  const [filterClient, setFilterClient] = useState('')
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [crossSelectedServiceId, setCrossSelectedServiceId] = useState<string | null>(null)
  const [expandedChart, setExpandedChart] = useState<'top3' | 'recent' | 'oldest' | null>(null)

  const canAccessNf = isCompanyAdmin || role === 'manager' || role === 'finance'
  const canAccessCompanyManagement = isCompanyAdmin
  const canAccessAdmin = isPlatformAdmin

  useEffect(() => {
    let active = true
    if (isPlatformAdmin) {
      setIsOverviewLoading(false)
      return () => { active = false }
    }

    async function loadDashboard() {
      setIsOverviewLoading(true)
      const headers = { Authorization: `Bearer ${token}` }
      try {
        const overviewResult = await apiRequest<{ data: Overview }>('/home/services/index', { headers })
        if (!active) return
        setOverview(overviewResult.data)
      } catch (error) {
        if (!active) return
        if (error instanceof Error && 'status' in error && error.status === 401) {
          onLogout()
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o painel analítico.')
      } finally {
        if (active) setIsOverviewLoading(false)
      }
    }

    void loadDashboard()
    return () => { active = false }
  }, [isPlatformAdmin, onLogout, refreshing, token])

  useEffect(() => {
    let active = true

    async function loadServicesPage() {
      if (isPlatformAdmin) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setLoadError('')

      if (collaboratorView) {
        setServices([])
        setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 0, hasMore: false })
        setIsLoading(false)
        return
      }

      try {
        const result = await apiRequest<{ services: { list: Service[]; pagination: Pagination } }>(
          `/home/services?page=${currentPage}&limit=${pageSize}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!active) return
        setServices(result.services.list)
        setPagination(result.services.pagination)
      } catch (error) {
        if (!active) return
        if (error instanceof Error && 'status' in error && error.status === 401) {
          onLogout()
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os serviços.')
        setServices([])
        setPagination({ page: currentPage, limit: pageSize, total: 0, totalPages: 0, hasMore: false })
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadServicesPage()
    return () => { active = false }
  }, [collaboratorView, currentPage, isPlatformAdmin, onLogout, pageSize, refreshing, token])

  const overviewServices = useMemo(() => overview
    ? uniqueServices(overview.highValueServices, overview.recentServices, overview.oldestServices)
    : [], [overview])

  const clientNames = useMemo(() => new Map(overviewServices.map((service) => [service.clientId, service.clientName])), [overviewServices])
  const sourceServices = collaboratorView ? overviewServices : services

  // Distinct clients list for filtering
  const availableClients = useMemo(() => {
    const map = new Map<string, string>()
    sourceServices.forEach((s) => {
      const name = clientNames.get(s.clientId) || s.clientName || s.clientId
      map.set(s.clientId, name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [clientNames, sourceServices])

  // BI Cross Filtering Logic
  const biFilteredServices = useMemo(() => {
    return sourceServices.filter((service) => {
      // 1. KPI Filter (finalized vs open)
      if (selectedKpiFilter === 'finished' && !service.finishDate) return false
      if (selectedKpiFilter === 'pending' && service.finishDate) return false

      // 2. Client filter
      if (filterClient && service.clientId !== filterClient) return false

      // 3. Price range
      const price = priceNumber(service.price)
      if (filterMinPrice && price < Number(filterMinPrice)) return false
      if (filterMaxPrice && price > Number(filterMaxPrice)) return false

      // 4. Date range
      if (filterStartDate && service.initialDate < filterStartDate) return false
      if (filterEndDate && service.initialDate > filterEndDate) return false

      // 5. Cross-selected item from chart
      if (crossSelectedServiceId && service.id !== crossSelectedServiceId) return false

      // 6. Search query
      const query = search.trim().toLocaleLowerCase('pt-BR')
      if (query) {
        const client = clientNames.get(service.clientId) || service.clientName || service.clientId
        const matches = [service.serviceName, client, String(service.price), service.initialDate, service.finishDate || '']
          .some((val) => val.toLocaleLowerCase('pt-BR').includes(query))
        if (!matches) return false
      }

      return true
    })
  }, [
    sourceServices,
    selectedKpiFilter,
    filterClient,
    filterMinPrice,
    filterMaxPrice,
    filterStartDate,
    filterEndDate,
    crossSelectedServiceId,
    search,
    clientNames,
  ])

  // BI Calculated Metrics (Real Data Only)
  const kpiTotalValue = useMemo(() => {
    return biFilteredServices.reduce((acc, curr) => acc + priceNumber(curr.price), 0)
  }, [biFilteredServices])

  const kpiCount = biFilteredServices.length

  const kpiFinishedCount = useMemo(() => {
    return biFilteredServices.filter((s) => Boolean(s.finishDate)).length
  }, [biFilteredServices])

  const kpiPendingCount = kpiCount - kpiFinishedCount

  const kpiAverageTicket = useMemo(() => {
    return kpiCount > 0 ? kpiTotalValue / kpiCount : 0
  }, [kpiCount, kpiTotalValue])

  function resetAllFilters() {
    setSelectedKpiFilter(null)
    setFilterClient('')
    setFilterMinPrice('')
    setFilterMaxPrice('')
    setFilterStartDate('')
    setFilterEndDate('')
    setCrossSelectedServiceId(null)
    setSearch('')
    setCurrentPage(1)
  }

  const hasActiveFilters = Boolean(
    selectedKpiFilter ||
    filterClient ||
    filterMinPrice ||
    filterMaxPrice ||
    filterStartDate ||
    filterEndDate ||
    crossSelectedServiceId ||
    search
  )

  const totalPages = collaboratorView
    ? Math.max(1, Math.ceil(biFilteredServices.length / pageSize))
    : Math.max(1, pagination.totalPages)
  const activePage = collaboratorView ? Math.min(currentPage, totalPages) : pagination.page
  const pageServices = collaboratorView
    ? biFilteredServices.slice((activePage - 1) * pageSize, activePage * pageSize)
    : biFilteredServices
  const firstVisibleItem = pageServices.length ? (activePage - 1) * pageSize + 1 : 0
  const lastVisibleItem = firstVisibleItem ? firstVisibleItem + pageServices.length - 1 : 0

  async function openDetails(type: FinderType, value: string, title: string) {
    const localMatches = findMatches(sourceServices, type, value)
    setDetail({ title, type, value, services: localMatches })
    setDetailError('')
    if (collaboratorView) return

    setDetailLoading(true)
    try {
      const result = await apiRequest<{ finder: { list: Service[] } }>(
        `/home/services/index/${type}/${encodeURIComponent(value)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setDetail((current) => current
        ? { ...current, services: uniqueServices(current.services, result.finder.list) }
        : current)
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401) {
        onLogout()
        return
      }
      setDetailError(error instanceof Error ? error.message : 'Não foi possível consultar os registros.')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleBarSelect(service: Service) {
    if (crossSelectedServiceId === service.id) {
      setCrossSelectedServiceId(null) // desmarca
    } else {
      setCrossSelectedServiceId(service.id) // filtro cruzado
      void openDetails('id', service.id, service.serviceName)
    }
  }

  const highValues = overview?.highValueServices ?? []
  const recent = overview?.recentServices ?? []
  const oldest = overview?.oldestServices ?? []

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <a className="dashboard-wordmark" href="#inicio" aria-label="Derik Flash, painel inicial">
          <span className="dashboard-monogram" aria-hidden="true">D</span>
          <span>Derik Flash <i>/</i> <strong>Analytics BI</strong></span>
        </a>
        <nav className="dashboard-section-nav" aria-label="Navegação principal">
          {isPlatformAdmin ? (
            <>
              <button aria-current={activeArea === 'admin' ? 'page' : undefined} onClick={() => setActiveArea('admin')} type="button">Central SaaS (Plataforma)</button>
              <button aria-current={activeArea === 'privacy' ? 'page' : undefined} onClick={() => setActiveArea('privacy')} type="button">Privacidade (LGPD)</button>
            </>
          ) : (
            <>
              <button aria-current={activeArea === 'overview' ? 'page' : undefined} onClick={() => setActiveArea('overview')} type="button">Dashboard (BI)</button>
              <button aria-current={activeArea === 'services' ? 'page' : undefined} onClick={() => setActiveArea('services')} type="button">Serviços</button>
              <button aria-current={activeArea === 'clients' ? 'page' : undefined} onClick={() => setActiveArea('clients')} type="button">Clientes</button>
              {canAccessNf && <button aria-current={activeArea === 'nf' ? 'page' : undefined} onClick={() => setActiveArea('nf')} type="button">Notas fiscais</button>}
              {canAccessCompanyManagement && <button aria-current={activeArea === 'company' ? 'page' : undefined} onClick={() => setActiveArea('company')} type="button">Minha Empresa</button>}
              <button aria-current={activeArea === 'privacy' ? 'page' : undefined} onClick={() => setActiveArea('privacy')} type="button">Privacidade (LGPD)</button>
            </>
          )}
        </nav>
        <div className="dashboard-tools">
          {!isPlatformAdmin && (
            <CompanySelector
              onLogout={onLogout}
              onTenantChanged={() => setRefreshing((val) => val + 1)}
              role={role}
              token={token}
            />
          )}
          <div className="dashboard-theme-control" role="group" aria-label="Tema da tela">
            <button aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')} type="button">Claro</button>
            <button aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')} type="button">Escuro</button>
          </div>
          <button className="dashboard-logout" onClick={onLogout} type="button">Sair <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div className="dashboard-main" id="inicio">
        {activeArea === 'overview' ? <>
        <section className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">BUSINESS INTELLIGENCE <span>·</span> {role.toUpperCase() || 'ACESSO'}</p>
            <h1>Painel Analítico de Serviços</h1>
            <p className="dashboard-description">Visualização, exploração de dados, cruzamento de métricas e drill-down em tempo real.</p>
          </div>
          <button className="dashboard-refresh" disabled={isLoading || isOverviewLoading} onClick={() => setRefreshing((value) => value + 1)} type="button">
            <span aria-hidden="true">↻</span> Sincronizar dados
          </button>
        </section>

        {loadError && (
          <div className="dashboard-alert" role="alert">
            <span>{loadError}</span>
            <button onClick={() => setRefreshing((value) => value + 1)} type="button">Tentar novamente</button>
          </div>
        )}

        {/* 1.5 Filtros Globais Analíticos */}
        <section className="bi-toolbar" aria-label="Filtros analíticos interativos">
          <div className="bi-filters-row">
            <div className="bi-filter-group">
              <span>Cliente:</span>
              <select
                className="bi-filter-select"
                value={filterClient}
                onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1) }}
              >
                <option value="">Todos os clientes ({availableClients.length})</option>
                {availableClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="bi-filter-group">
              <span>Valor min:</span>
              <input
                className="bi-filter-input"
                type="number"
                placeholder="R$ 0,00"
                value={filterMinPrice}
                onChange={(e) => { setFilterMinPrice(e.target.value); setCurrentPage(1) }}
                style={{ width: '100px' }}
              />
            </div>

            <div className="bi-filter-group">
              <span>Valor max:</span>
              <input
                className="bi-filter-input"
                type="number"
                placeholder="R$ 999.999"
                value={filterMaxPrice}
                onChange={(e) => { setFilterMaxPrice(e.target.value); setCurrentPage(1) }}
                style={{ width: '100px' }}
              />
            </div>

            <div className="bi-filter-group">
              <span>De:</span>
              <input
                className="bi-filter-input"
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1) }}
              />
            </div>

            <div className="bi-filter-group">
              <span>Até:</span>
              <input
                className="bi-filter-input"
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1) }}
              />
            </div>

            {hasActiveFilters && (
              <button className="bi-clear-filters-btn" onClick={resetAllFilters} type="button">
                ✕ Limpar todos os filtros
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="bi-active-badges">
              <span>Filtros aplicados:</span>
              {selectedKpiFilter && (
                <span className="bi-badge">
                  Status: {selectedKpiFilter === 'finished' ? 'Finalizados' : 'Em aberto'}
                  <button onClick={() => setSelectedKpiFilter(null)}>×</button>
                </span>
              )}
              {filterClient && (
                <span className="bi-badge">
                  Cliente: {availableClients.find((c) => c.id === filterClient)?.name || filterClient}
                  <button onClick={() => setFilterClient('')}>×</button>
                </span>
              )}
              {filterMinPrice && (
                <span className="bi-badge">
                  Min: R$ {filterMinPrice}
                  <button onClick={() => setFilterMinPrice('')}>×</button>
                </span>
              )}
              {filterMaxPrice && (
                <span className="bi-badge">
                  Max: R$ {filterMaxPrice}
                  <button onClick={() => setFilterMaxPrice('')}>×</button>
                </span>
              )}
              {filterStartDate && (
                <span className="bi-badge">
                  Início ≥ {formatDate(filterStartDate)}
                  <button onClick={() => setFilterStartDate('')}>×</button>
                </span>
              )}
              {filterEndDate && (
                <span className="bi-badge">
                  Início ≤ {formatDate(filterEndDate)}
                  <button onClick={() => setFilterEndDate('')}>×</button>
                </span>
              )}
              {crossSelectedServiceId && (
                <span className="bi-badge">
                  Serviço cruzado: {sourceServices.find((s) => s.id === crossSelectedServiceId)?.serviceName}
                  <button onClick={() => setCrossSelectedServiceId(null)}>×</button>
                </span>
              )}
            </div>
          )}
        </section>

        {/* 1.2 Indicadores Financeiros Resumidos (KPIs Interativos) */}
        <section className="bi-kpi-grid" aria-label="Indicadores executivos">
          <div
            className={`bi-kpi-card ${selectedKpiFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setSelectedKpiFilter((prev) => prev === 'all' ? null : 'all')}
            role="button"
            tabIndex={0}
            title="Clique para alternar filtro geral"
          >
            <div className="bi-kpi-header">
              <span className="bi-kpi-title">Valor Total</span>
              <span className="bi-kpi-icon">💰</span>
            </div>
            <p className="bi-kpi-value">{formatPrice(kpiTotalValue)}</p>
            <span className="bi-kpi-meta">{kpiCount} registros no escopo</span>
          </div>

          <div
            className="bi-kpi-card"
            onClick={() => void openDetails('price', '', 'Todos os Serviços')}
            role="button"
            tabIndex={0}
            title="Clique para detalhar a média dos serviços"
          >
            <div className="bi-kpi-header">
              <span className="bi-kpi-title">Ticket Médio</span>
              <span className="bi-kpi-icon">📈</span>
            </div>
            <p className="bi-kpi-value">{formatPrice(kpiAverageTicket)}</p>
            <span className="bi-kpi-meta">Média aritmética por serviço</span>
          </div>

          <div
            className={`bi-kpi-card ${selectedKpiFilter === 'finished' ? 'is-active' : ''}`}
            onClick={() => setSelectedKpiFilter((prev) => prev === 'finished' ? null : 'finished')}
            role="button"
            tabIndex={0}
            title="Clique para filtrar apenas serviços finalizados"
          >
            <div className="bi-kpi-header">
              <span className="bi-kpi-title">Serviços Concluídos</span>
              <span className="bi-kpi-icon">✅</span>
            </div>
            <p className="bi-kpi-value">{kpiFinishedCount}</p>
            <span className="bi-kpi-meta">{kpiCount ? `${Math.round((kpiFinishedCount / kpiCount) * 100)}% de conclusão` : '0%'}</span>
          </div>

          <div
            className={`bi-kpi-card ${selectedKpiFilter === 'pending' ? 'is-active' : ''}`}
            onClick={() => setSelectedKpiFilter((prev) => prev === 'pending' ? null : 'pending')}
            role="button"
            tabIndex={0}
            title="Clique para filtrar apenas serviços em andamento"
          >
            <div className="bi-kpi-header">
              <span className="bi-kpi-title">Em Andamento / Pendente</span>
              <span className="bi-kpi-icon">⏳</span>
            </div>
            <p className="bi-kpi-value">{kpiPendingCount}</p>
            <span className="bi-kpi-meta">{kpiCount ? `${Math.round((kpiPendingCount / kpiCount) * 100)}% em aberto` : '0%'}</span>
          </div>
        </section>

        {/* 1.3 Gráficos Analíticos com Expansão e Filtros Cruzados */}
        <section className="dashboard-overview" aria-label="Gráficos analíticos">
          <article className="dashboard-card dashboard-value-card">
            <header className="dashboard-card-heading">
              <div>
                <p className="dashboard-card-index">01 / CONCENTRAÇÃO</p>
                <h2>Top 3 Maiores Valores</h2>
              </div>
              <button
                className="bi-expand-btn"
                onClick={() => setExpandedChart('top3')}
                title="Expandir gráfico"
                type="button"
              >
                ⤢
              </button>
            </header>
            {isOverviewLoading ? <div className="dashboard-skeleton" aria-label="Carregando valores" /> : (
              <div className="dashboard-value-content">
                <PieChart
                  selectedServiceId={crossSelectedServiceId}
                  services={highValues}
                />
                <div className="dashboard-legend">
                  {highValues.map((service, index) => {
                    const isSelected = crossSelectedServiceId === service.id
                    return (
                      <button
                        className={`dashboard-legend-row ${isSelected ? 'is-selected' : ''}`}
                        key={service.id}
                        onClick={() => handleBarSelect(service)}
                        style={{ background: isSelected ? 'rgb(48 155 121 / 20%)' : undefined }}
                        type="button"
                        title="Clique para cruzar informações com este serviço"
                      >
                        <span className="dashboard-legend-dot" style={{ background: palette[index % palette.length] }} />
                        <span className="dashboard-legend-info">
                          <strong>{service.serviceName}</strong>
                          <small>{formatPrice(service.price)}</small>
                        </span>
                        <span aria-hidden="true" className="dashboard-legend-arrow">
                          {isSelected ? '✓' : '↗'}
                        </span>
                      </button>
                    )
                  })}
                  {!highValues.length && <p className="dashboard-empty">Nenhum serviço encontrado.</p>}
                </div>
              </div>
            )}
          </article>

          <article className="dashboard-card">
            <header className="dashboard-card-heading">
              <div>
                <p className="dashboard-card-index">02 / CADASTRO</p>
                <h2>Datas Recentes</h2>
              </div>
              <button
                className="bi-expand-btn"
                onClick={() => setExpandedChart('recent')}
                title="Expandir gráfico"
                type="button"
              >
                ⤢
              </button>
            </header>
            {isOverviewLoading ? <div className="dashboard-skeleton" aria-label="Carregando datas recentes" /> : recent.length ? (
              <ServiceBars
                dateMode
                onOpen={handleBarSelect}
                selectedId={crossSelectedServiceId}
                services={recent}
              />
            ) : <p className="dashboard-empty">Nenhum serviço encontrado.</p>}
            <p className="dashboard-chart-note">Clique em uma barra para aplicar filtro cruzado nos demais componentes.</p>
          </article>

          <article className="dashboard-card">
            <header className="dashboard-card-heading">
              <div>
                <p className="dashboard-card-index">03 / HISTÓRICO</p>
                <h2>Datas Antigas</h2>
              </div>
              <button
                className="bi-expand-btn"
                onClick={() => setExpandedChart('oldest')}
                title="Expandir gráfico"
                type="button"
              >
                ⤢
              </button>
            </header>
            {isOverviewLoading ? <div className="dashboard-skeleton" aria-label="Carregando datas antigas" /> : oldest.length ? (
              <ServiceBars
                dateMode
                onOpen={handleBarSelect}
                selectedId={crossSelectedServiceId}
                services={oldest}
              />
            ) : <p className="dashboard-empty">Nenhum serviço encontrado.</p>}
            <p className="dashboard-chart-note">Clique em uma barra para aplicar filtro cruzado nos demais componentes.</p>
          </article>
        </section>

        {/* Modal de Gráfico Expandido (1.4 Componentes Expansíveis) */}
        {expandedChart && (
          <div
            className="bi-chart-expanded-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) setExpandedChart(null) }}
            role="presentation"
          >
            <div className="bi-chart-expanded-modal" role="dialog" aria-modal="true">
              <div className="bi-chart-expanded-header">
                <h2>
                  {expandedChart === 'top3' && 'Detalhamento: Top 3 Maiores Valores'}
                  {expandedChart === 'recent' && 'Detalhamento: Serviços com Datas Recentes'}
                  {expandedChart === 'oldest' && 'Detalhamento: Serviços com Datas Antigas'}
                </h2>
                <button
                  className="dashboard-close"
                  onClick={() => setExpandedChart(null)}
                  type="button"
                  aria-label="Fechar gráfico expandido"
                >
                  ×
                </button>
              </div>
              <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {expandedChart === 'top3' && (
                  <div style={{ width: '100%', maxWidth: '600px' }}>
                    <PieChart services={highValues} />
                    <div className="dashboard-legend" style={{ marginTop: '20px' }}>
                      {highValues.map((s, idx) => (
                        <div key={s.id} className="dashboard-legend-row">
                          <span className="dashboard-legend-dot" style={{ background: palette[idx % palette.length] }} />
                          <span className="dashboard-legend-info">
                            <strong>{s.serviceName}</strong>
                            <small>{formatPrice(s.price)} · Início: {formatDate(s.initialDate)}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {expandedChart === 'recent' && (
                  <div style={{ width: '100%' }}>
                    <ServiceBars dateMode onOpen={handleBarSelect} services={recent} />
                  </div>
                )}
                {expandedChart === 'oldest' && (
                  <div style={{ width: '100%' }}>
                    <ServiceBars dateMode onOpen={handleBarSelect} services={oldest} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 1.6 Tabela Analítica (Somente Leitura e Exploração de BI) */}
        <section className="dashboard-registers" aria-labelledby="registers-title">
          <div className="dashboard-register-heading">
            <div>
              <p className="dashboard-card-index">EXPLORAÇÃO DE DADOS</p>
              <h2 id="registers-title">Registros Analíticos de Serviços</h2>
            </div>
            <label className="dashboard-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Buscar serviço, cliente, valor ou data no escopo analítico"
                onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }}
                placeholder="Filtrar nesta visualização..."
                type="search"
                value={search}
              />
            </label>
          </div>

          {collaboratorView && <p className="dashboard-scope-note">Exibindo apenas os serviços autorizados para o seu perfil.</p>}

          <div className="dashboard-table-scroll" role="region" aria-label="Tabela analítica de serviços" tabIndex={0}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '35%' }}>Serviço</th>
                  <th scope="col" style={{ width: '30%' }}>Cliente</th>
                  <th scope="col" style={{ width: '15%' }}>Valor</th>
                  <th scope="col" style={{ width: '10%' }}>Data Inicial</th>
                  <th scope="col" style={{ width: '10%' }}>Data Final</th>
                </tr>
              </thead>
              <tbody>
                {pageServices.map((service) => {
                  const client = clientNames.get(service.clientId) || service.clientName || `Cliente ${service.clientId.slice(0, 8)}`
                  const isCrossSelected = crossSelectedServiceId === service.id
                  return (
                    <tr
                      key={service.id}
                      className={isCrossSelected ? 'is-selected' : ''}
                      style={{ background: isCrossSelected ? 'rgb(48 155 121 / 15%)' : undefined }}
                    >
                      <td>
                        <button
                          className="dashboard-cell-button dashboard-service-cell"
                          onClick={() => handleBarSelect(service)}
                          type="button"
                          title="Clique para aprofundar a análise (Drill-down)"
                        >
                          <strong>{service.serviceName}</strong>
                          <small>{service.statusName || (service.finishDate ? 'Concluído' : 'Em andamento')}</small>
                        </button>
                      </td>
                      <td>
                        <button
                          aria-label={`Explorar serviços do cliente ${client}`}
                          className="dashboard-cell-button"
                          onClick={() => void openDetails('client', service.clientId, `Cliente: ${client}`)}
                          type="button"
                          title="Filtrar por este cliente"
                        >
                          {client}
                        </button>
                      </td>
                      <td>
                        <button
                          aria-label={`Filtrar serviços com valor ${formatPrice(service.price)}`}
                          className="dashboard-cell-button dashboard-price-cell"
                          onClick={() => void openDetails('price', String(service.price), `Faixa de Valor: ${formatPrice(service.price)}`)}
                          type="button"
                          title="Explorar serviços neste valor"
                        >
                          {formatPrice(service.price)}
                        </button>
                      </td>
                      <td>
                        <button
                          aria-label={`Filtrar por data inicial ${formatDate(service.initialDate)}`}
                          className="dashboard-cell-button"
                          onClick={() => void openDetails('initialdate', service.initialDate, `Data de Início: ${formatDate(service.initialDate)}`)}
                          type="button"
                        >
                          {formatDate(service.initialDate)}
                        </button>
                      </td>
                      <td>
                        <button
                          aria-label={service.finishDate ? `Filtrar por data final ${formatDate(service.finishDate)}` : 'Sem data final'}
                          className="dashboard-cell-button"
                          disabled={!service.finishDate}
                          onClick={() => service.finishDate && void openDetails('finishdate', service.finishDate, `Conclusão: ${formatDate(service.finishDate)}`)}
                          type="button"
                        >
                          {formatDate(service.finishDate)}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!isLoading && !pageServices.length && (
                  <tr>
                    <td className="dashboard-table-empty" colSpan={5}>
                      {hasActiveFilters ? 'Nenhum serviço corresponde aos filtros analíticos selecionados.' : 'Nenhum serviço disponível.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="dashboard-pagination">
            <div className="dashboard-pagination-summary" aria-live="polite">
              <span>
                {isLoading ? 'Carregando registros...' : (
                  `${firstVisibleItem}–${lastVisibleItem} de ${biFilteredServices.length} analisados`
                )}
              </span>
              <label htmlFor="dashboard-page-size">Itens por página</label>
              <select
                id="dashboard-page-size"
                onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1) }}
                value={pageSize}
              >
                {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <nav className="dashboard-page-controls" aria-label="Paginação da lista de serviços">
              <button aria-label="Primeira página" disabled={activePage <= 1 || isLoading} onClick={() => setCurrentPage(1)} type="button">«</button>
              <button aria-label="Página anterior" disabled={activePage <= 1 || isLoading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">‹</button>
              <span aria-current="page">{activePage} / {totalPages}</span>
              <button aria-label="Próxima página" disabled={activePage >= totalPages || isLoading} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} type="button">›</button>
              <button aria-label="Última página" disabled={activePage >= totalPages || isLoading} onClick={() => setCurrentPage(totalPages)} type="button">»</button>
            </nav>
          </div>
          <div className="dashboard-table-footer">
            <span>Visualização analítica de BI · Painel de somente-leitura</span>
          </div>
        </section>

        {/* 2. Detalhamento Financeiro Aprofundado (Drill-Through / Drill-Down) */}
        {detail && (
          <section className="dashboard-details" aria-live="polite" aria-labelledby="details-title">
            <div className="dashboard-details-heading">
              <div>
                <p className="dashboard-card-index">A PROFUNDAMENTO ANALÍTICO · {detail.type.toUpperCase()}</p>
                <h2 id="details-title">{detail.title}</h2>
              </div>
              <button aria-label="Fechar detalhes" className="dashboard-close" onClick={() => setDetail(null)} type="button">×</button>
            </div>
            {detailLoading && <p className="dashboard-detail-status">Carregando registros da API...</p>}
            {detailError && <p className="dashboard-detail-error" role="status">{detailError}</p>}
            {detail.services.length ? (
              <>
                <div className="dashboard-detail-summary">
                  <strong>{detail.services.length}</strong>
                  <span>{detail.services.length === 1 ? 'registro encontrado' : 'registros consolidados'}</span>
                </div>
                {detail.services.length > 1 && (
                  <div className="dashboard-detail-chart">
                    <h3>Comparativo de Valores</h3>
                    <ServiceBars
                      onOpen={(service) => void openDetails('id', service.id, service.serviceName)}
                      services={detail.services}
                    />
                  </div>
                )}
                <div className="dashboard-detail-list">
                  {detail.services.map((service) => (
                    <article className="dashboard-detail-record" key={service.id}>
                      <header>
                        <div>
                          <h3>{service.serviceName}</h3>
                          <p>{clientNames.get(service.clientId) || service.clientName || `Cliente ${service.clientId.slice(0, 8)}`}</p>
                        </div>
                        <strong>{formatPrice(service.price)}</strong>
                      </header>
                      <dl>
                        <div><dt>Data Inicial</dt><dd>{formatDate(service.initialDate)}</dd></div>
                        <div><dt>Data Final</dt><dd>{formatDate(service.finishDate)}</dd></div>
                        <div><dt>Status</dt><dd>{service.statusName || (service.finishDate ? 'Concluído' : 'Em andamento')}</dd></div>
                      </dl>
                      <div className="dashboard-detail-description" style={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                        {service.details || 'Sem descrição cadastrada para este serviço.'}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : !detailLoading && <p className="dashboard-detail-status">Nenhum serviço correspondente encontrado para este filtro.</p>}
          </section>
        )}
        </> : activeArea === 'nf' ? (
          <NfPanel key={`nf-${token}-${refreshing}`} onLogout={onLogout} role={role} token={token} />
        ) : activeArea === 'company' ? (
          <CompanyManagementPanel
            onCompanyChanged={() => setRefreshing((value) => value + 1)}
            onLogout={onLogout}
            token={token}
          />
        ) : activeArea === 'admin' && canAccessAdmin ? (
          <AdminPanel onLogout={onLogout} token={token} />
        ) : activeArea === 'privacy' ? (
          <PrivacyPanel
            onLogout={onLogout}
            onOpenLegal={(doc) => setLegalModalDoc(doc)}
            token={token}
          />
        ) : (
          <ManagementPanel
            key={`${activeArea}-${token}-${refreshing}`}
            onDataChanged={() => setRefreshing((value) => value + 1)}
            onLogout={onLogout}
            role={role}
            token={token}
            view={activeArea === 'services' ? 'services' : 'clients'}
          />
        )}

        <footer className="dashboard-footer">
          <span>DERIK FLASH · CONFORMIDADE LGPD (DPO: privacidade@derikdev.cloud)</span>
          <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button
              className="text-button"
              onClick={() => setLegalModalDoc('privacy')}
              style={{ color: 'inherit', fontSize: 'inherit' }}
              type="button"
            >
              Política de Privacidade
            </button>
            <button
              className="text-button"
              onClick={() => setLegalModalDoc('terms')}
              style={{ color: 'inherit', fontSize: 'inherit' }}
              type="button"
            >
              Termos de Uso
            </button>
          </span>
        </footer>
      </div>
      {legalModalDoc && (
        <LegalDocumentsModal
          initialDoc={legalModalDoc}
          onClose={() => setLegalModalDoc(null)}
        />
      )}
    </main>
  )
}

export default Dashboard