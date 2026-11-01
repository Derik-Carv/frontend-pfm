import { useEffect, useState, type CSSProperties } from 'react'
import { apiRequest } from './services/api'
import AdminPanel from './AdminPanel'
import ManagementPanel from './Management'
import NfPanel from './NfPanel'
import './Dashboard.css'

type Role = 'administrator' | 'manager' | 'finance' | 'observer' | 'colaborator' | string
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

const palette = ['#2D9373', '#D97706', '#1B6951']
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

function PieChart({ services }: { services: Service[] }) {
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
      <span><strong>{services.length}</strong><small>serviços</small></span>
    </div>
  )
}

function ServiceBars({
  services,
  dateMode = false,
  onOpen,
}: {
  services: Service[]
  dateMode?: boolean
  onOpen: (service: Service) => void
}) {
  const maxPrice = Math.max(...services.map((service) => priceNumber(service.price)), 1)

  return (
    <div className="dashboard-bars" aria-label="Gráfico de valores dos serviços">
      {services.map((service, index) => {
        const height = Math.max((priceNumber(service.price) / maxPrice) * 100, 4)
        const labelDate = dateMode ? formatDate(service.initialDate) : service.serviceName
        return (
          <button
            aria-label={`${service.serviceName}, ${formatPrice(service.price)}, início ${formatDate(service.initialDate)}`}
            className="dashboard-bar-item"
            key={serviceKey(service)}
            onClick={() => onOpen(service)}
            title={`${service.serviceName} · ${formatPrice(service.price)} · ${formatDate(service.initialDate)}`}
            type="button"
          >
            <span className="dashboard-bar-value">{formatPrice(service.price)}</span>
            <span className="dashboard-bar-track">
              <span className="dashboard-bar-fill" style={{ '--bar-height': `${height}%` } as CSSProperties} />
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
  const collaboratorView = role === 'colaborator' || role === ''
  const [overview, setOverview] = useState<Overview | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false })
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activeArea, setActiveArea] = useState<'overview' | 'services' | 'clients' | 'nf' | 'admin'>('overview')
  const canAccessNf = role === 'administrator' || role === 'manager' || role === 'finance'
  const canAccessAdmin = role === 'administrator'

  useEffect(() => {
    let active = true

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
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o painel.')
      } finally {
        if (active) setIsOverviewLoading(false)
      }
    }

    void loadDashboard()
    return () => { active = false }
  }, [onLogout, refreshing, token])

  useEffect(() => {
    let active = true

    async function loadServicesPage() {
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
  }, [collaboratorView, currentPage, onLogout, pageSize, refreshing, token])

  const overviewServices = overview
    ? uniqueServices(overview.highValueServices, overview.recentServices, overview.oldestServices)
    : []
  const clientNames = new Map(overviewServices.map((service) => [service.clientId, service.clientName]))
  const sourceServices = collaboratorView ? overviewServices : services
  const filteredServices = sourceServices.filter((service) => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    if (!query) return true
    const client = clientNames.get(service.clientId) || service.clientName || service.clientId
    return [service.serviceName, client, String(service.price), service.initialDate, service.finishDate || '']
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(query))
  })
  const totalPages = collaboratorView
    ? Math.max(1, Math.ceil(filteredServices.length / pageSize))
    : Math.max(1, pagination.totalPages)
  const activePage = collaboratorView ? Math.min(currentPage, totalPages) : pagination.page
  const pageServices = collaboratorView
    ? filteredServices.slice((activePage - 1) * pageSize, activePage * pageSize)
    : filteredServices
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

  function openService(service: Service) {
    void openDetails('id', service.id, service.serviceName)
  }

  const highValues = overview?.highValueServices ?? []
  const recent = overview?.recentServices ?? []
  const oldest = overview?.oldestServices ?? []

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <a className="dashboard-wordmark" href="#inicio" aria-label="Derik Flash, painel inicial">
          <span className="dashboard-monogram" aria-hidden="true">D</span>
          <span>Derik Flash <i>/</i> <strong>Financeiro</strong></span>
        </a>
        <nav className="dashboard-section-nav" aria-label="Navegação principal">
          <button aria-current={activeArea === 'overview' ? 'page' : undefined} onClick={() => setActiveArea('overview')} type="button">Visão geral</button>
          <button aria-current={activeArea === 'services' ? 'page' : undefined} onClick={() => setActiveArea('services')} type="button">Serviços</button>
          <button aria-current={activeArea === 'clients' ? 'page' : undefined} onClick={() => setActiveArea('clients')} type="button">Clientes</button>
          {canAccessNf && <button aria-current={activeArea === 'nf' ? 'page' : undefined} onClick={() => setActiveArea('nf')} type="button">Notas fiscais</button>}
          {canAccessAdmin && <button aria-current={activeArea === 'admin' ? 'page' : undefined} onClick={() => setActiveArea('admin')} type="button">Administração</button>}
        </nav>
        <div className="dashboard-tools">
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
            <p className="dashboard-eyebrow">PAINEL DE SERVIÇOS <span>·</span> {role || 'ACESSO'}</p>
            <h1>Visão geral</h1>
            <p className="dashboard-description">Acompanhe valores, períodos e serviços vinculados ao seu acesso.</p>
          </div>
          <button className="dashboard-refresh" disabled={isLoading || isOverviewLoading} onClick={() => setRefreshing((value) => value + 1)} type="button">
            <span aria-hidden="true">↻</span> Atualizar
          </button>
        </section>

        {loadError && (
          <div className="dashboard-alert" role="alert">
            <span>{loadError}</span>
            <button onClick={() => setRefreshing((value) => value + 1)} type="button">Tentar novamente</button>
          </div>
        )}

        <section className="dashboard-overview" aria-label="Indicadores principais de serviços">
          <article className="dashboard-card dashboard-value-card">
            <header className="dashboard-card-heading">
              <div><p className="dashboard-card-index">01 / VALOR</p><h2>Top 3 valores</h2></div>
              <span className="dashboard-card-tag">MAIORES</span>
            </header>
            {isOverviewLoading ? <div className="dashboard-skeleton" aria-label="Carregando valores" /> : (
              <div className="dashboard-value-content">
                <PieChart services={highValues} />
                <div className="dashboard-legend">
                  {highValues.map((service, index) => (
                    <button className="dashboard-legend-row" key={service.id} onClick={() => openService(service)} type="button">
                      <span className="dashboard-legend-dot" style={{ background: palette[index % palette.length] }} />
                      <span className="dashboard-legend-info"><strong>{service.serviceName}</strong><small>{formatPrice(service.price)}</small></span>
                      <span aria-hidden="true" className="dashboard-legend-arrow">↗</span>
                    </button>
                  ))}
                  {!highValues.length && <p className="dashboard-empty">Nenhum serviço encontrado.</p>}
                </div>
              </div>
            )}
          </article>

          <article className="dashboard-card">
            <header className="dashboard-card-heading">
              <div><p className="dashboard-card-index">02 / CADASTRO</p><h2>Datas recentes</h2></div>
              <span className="dashboard-card-tag">TOP 3</span>
            </header>
            {isOverviewLoading ? <div className="dashboard-skeleton" aria-label="Carregando datas recentes" /> : recent.length
              ? <ServiceBars dateMode services={recent} onOpen={openService} />
              : <p className="dashboard-empty">Nenhum serviço encontrado.</p>}
            <p className="dashboard-chart-note">Ordenação do backend por cadastro; rótulos mostram a data inicial.</p>
          </article>

          <article className="dashboard-card">
            <header className="dashboard-card-heading">
              <div><p className="dashboard-card-index">03 / HISTÓRICO</p><h2>Datas antigas</h2></div>
              <span className="dashboard-card-tag">TOP 3</span>
            </header>
            {isOverviewLoading ? <div className="dashboard-skeleton" aria-label="Carregando datas antigas" /> : oldest.length
              ? <ServiceBars dateMode services={oldest} onOpen={openService} />
              : <p className="dashboard-empty">Nenhum serviço encontrado.</p>}
            <p className="dashboard-chart-note">Ordenação do backend por cadastro; rótulos mostram a data inicial.</p>
          </article>
        </section>

        <section className="dashboard-registers" aria-labelledby="registers-title">
          <div className="dashboard-register-heading">
            <div><p className="dashboard-card-index">REGISTROS NO BANCO</p><h2 id="registers-title">Serviços</h2></div>
            <label className="dashboard-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar serviço, cliente, valor ou data nesta página" onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }} placeholder="Buscar nesta página" type="search" value={search} /></label>
          </div>

          {collaboratorView && <p className="dashboard-scope-note">Exibindo apenas os serviços retornados pelo resumo autorizado para este perfil.</p>}

          <div className="dashboard-table-scroll" role="region" aria-label="Tabela de serviços" tabIndex={0}>
            <table className="dashboard-table">
              <thead><tr><th scope="col">Serviço</th><th scope="col">Cliente</th><th scope="col">Valor</th><th scope="col">Data inicial</th><th scope="col">Data final</th></tr></thead>
              <tbody>
                {pageServices.map((service) => {
                  const client = clientNames.get(service.clientId) || service.clientName || `Cliente ${service.clientId.slice(0, 8)}`
                  return (
                    <tr key={service.id}>
                      <td><button className="dashboard-cell-button dashboard-service-cell" onClick={() => openService(service)} type="button"><strong>{service.serviceName}</strong><small>{service.statusName || service.id.slice(0, 8)}</small></button></td>
                      <td><button aria-label={`Ver serviços do cliente ${client}`} className="dashboard-cell-button" onClick={() => void openDetails('client', service.clientId, client)} type="button" title="Ver serviços deste cliente">{client}</button></td>
                      <td><button aria-label={`Ver serviços com valor ${formatPrice(service.price)}`} className="dashboard-cell-button dashboard-price-cell" onClick={() => void openDetails('price', String(service.price), formatPrice(service.price))} type="button" title="Ver serviços com este valor">{formatPrice(service.price)}</button></td>
                      <td><button aria-label={`Ver serviços com data inicial ${formatDate(service.initialDate)}`} className="dashboard-cell-button" onClick={() => void openDetails('initialdate', service.initialDate, formatDate(service.initialDate))} type="button" title="Ver serviços desta data inicial">{formatDate(service.initialDate)}</button></td>
                      <td><button aria-label={service.finishDate ? `Ver serviços com data final ${formatDate(service.finishDate)}` : 'Serviço sem data final'} className="dashboard-cell-button" disabled={!service.finishDate} onClick={() => service.finishDate && void openDetails('finishdate', service.finishDate, formatDate(service.finishDate))} type="button" title={service.finishDate ? 'Ver serviços desta data final' : 'Sem data final cadastrada'}>{formatDate(service.finishDate)}</button></td>
                    </tr>
                  )
                })}
                {!isLoading && !filteredServices.length && <tr><td className="dashboard-table-empty" colSpan={5}>{search ? 'Nenhum serviço corresponde à busca.' : 'Nenhum serviço disponível para este perfil.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="dashboard-pagination">
            <div className="dashboard-pagination-summary" aria-live="polite">
              <span>{isLoading ? 'Carregando serviços...' : search
                ? `${pageServices.length} encontrados nesta página · ${collaboratorView ? filteredServices.length : pagination.total} no total`
                : `${firstVisibleItem}–${lastVisibleItem} de ${collaboratorView ? filteredServices.length : pagination.total}`}</span>
              <label htmlFor="dashboard-page-size">Itens por página</label>
              <select
                id="dashboard-page-size"
                onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1) }}
                value={pageSize}
              >
                {[5, 10].map((size) => <option key={size} value={size}>{size}</option>)}
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
          <div className="dashboard-table-footer"><span>{role || 'Acesso limitado'} · Dados conforme permissões da API</span></div>
        </section>

        {detail && (
          <section className="dashboard-details" aria-live="polite" aria-labelledby="details-title">
            <div className="dashboard-details-heading">
              <div><p className="dashboard-card-index">DETALHES · {detail.type.toUpperCase()}</p><h2 id="details-title">{detail.title}</h2></div>
              <button aria-label="Fechar detalhes" className="dashboard-close" onClick={() => setDetail(null)} type="button">×</button>
            </div>
            {detailLoading && <p className="dashboard-detail-status">Consultando detalhes na API...</p>}
            {detailError && <p className="dashboard-detail-error" role="status">{detailError}</p>}
            {detail.services.length ? (
              <>
                <div className="dashboard-detail-summary"><strong>{detail.services.length}</strong><span>{detail.services.length === 1 ? 'serviço relacionado' : 'serviços relacionados'}</span></div>
                <div className="dashboard-detail-chart"><h3>Valores dos serviços</h3><ServiceBars services={detail.services} onOpen={(service) => void openDetails('id', service.id, service.serviceName)} /></div>
                <div className="dashboard-detail-list">
                  {detail.services.map((service) => (
                    <article className="dashboard-detail-record" key={service.id}>
                      <header><div><h3>{service.serviceName}</h3><p>{clientNames.get(service.clientId) || service.clientName || `Cliente ${service.clientId.slice(0, 8)}`}</p></div><strong>{formatPrice(service.price)}</strong></header>
                      <dl><div><dt>Data inicial</dt><dd>{formatDate(service.initialDate)}</dd></div><div><dt>Data final</dt><dd>{formatDate(service.finishDate)}</dd></div><div><dt>Status</dt><dd>{service.statusName || 'Não informado'}</dd></div></dl>
                      <p className="dashboard-detail-description">{service.details}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : !detailLoading && <p className="dashboard-detail-status">Nenhum serviço correspondente foi encontrado.</p>}
          </section>
        )}
        </> : activeArea === 'nf' ? (
          <NfPanel onLogout={onLogout} role={role} token={token} />
        ) : activeArea === 'admin' ? (
          <AdminPanel onLogout={onLogout} token={token} />
        ) : (
          <ManagementPanel
            key={`${activeArea}-${token}`}
            onDataChanged={() => setRefreshing((value) => value + 1)}
            onLogout={onLogout}
            role={role}
            token={token}
            view={activeArea}
          />
        )}

        <footer className="dashboard-footer"><span>DERIK FLASH</span><span>VISÃO GERAL DE SERVIÇOS</span></footer>
      </div>
    </main>
  )
}

export default Dashboard