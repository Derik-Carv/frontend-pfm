import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest } from './services/api'
import './Management.css'

type Client = {
  id: string
  registeredCompanyName: string
  tradeName: string
  cnpj?: string | null
  cpf?: string | null
  active: boolean
}

type Service = {
  id: string
  serviceName: string
  price: string
  initialDate: string
  finishDate?: string | null
  clientId: string
  details: string
  statusServiceId?: string | null
  clientName?: string | null
  statusName?: string | null
}

type Status = { id: string; name: string }
type ClientPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}
type ManagementView = 'services' | 'clients'

type ManagementProps = {
  view: ManagementView
  role: string
  token: string
  onLogout: () => void
  onDataChanged: () => void
}

const serviceRoles = ['administrator', 'manager', 'finance']
const clientRoles = ['administrator', 'manager', 'finance', 'colaborator']
const clientCreateRoles = ['administrator', 'manager', 'finance']
const clientEditRoles = ['administrator', 'manager', 'finance']
const clientPageSizes = [5, 10]

async function fetchAllClients(headers: HeadersInit) {
  const firstPage = await apiRequest<{ clients: Client[]; pagination: ClientPagination }>(
    '/clients?page=1&limit=10',
    { headers },
  )
  if (firstPage.pagination.totalPages <= 1) return firstPage.clients

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, index) =>
      apiRequest<{ clients: Client[]; pagination: ClientPagination }>(
        `/clients?page=${index + 2}&limit=10`,
        { headers },
      ),
    ),
  )
  return [...firstPage.clients, ...remainingPages.flatMap((result) => result.clients)]
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function formatDate(value?: string | null) {
  if (!value) return 'Em aberto'
  const date = new Date(`${dateInput(value)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date)
}

function formatMoney(value: string | number) {
  const amount = Number(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0)
}

function ManagementPanel({ view, role, token, onLogout, onDataChanged }: ManagementProps) {
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientPagination, setClientPagination] = useState<ClientPagination>({ page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false })
  const [statuses, setStatuses] = useState<Status[]>([])
  const [search, setSearch] = useState('')
  const [clientPage, setClientPage] = useState(1)
  const [clientPageSize, setClientPageSize] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [serviceForm, setServiceForm] = useState<'create' | Service | null>(null)
  const [clientForm, setClientForm] = useState<'create' | Client | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  const canManageServices = serviceRoles.includes(role)
  const canViewClients = clientRoles.includes(role)
  const canCreateClients = clientCreateRoles.includes(role)
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    let active = true
    const requestHeaders = { Authorization: `Bearer ${token}` }

    async function loadView() {
      setIsLoading(true)
      setError('')
      setNotice('')
      setServiceForm(null)
      setClientForm(null)

      if (view === 'services' && !canManageServices) {
        setServices([])
        setIsLoading(false)
        return
      }
      if (view === 'clients' && !canViewClients) {
        setClients([])
        setIsLoading(false)
        return
      }

      try {
        if (view === 'services') {
          const [serviceResult, clientList] = await Promise.all([
            apiRequest<{ myServicesList: { list: Service[] } }>('/services/list', { headers: requestHeaders }),
            fetchAllClients(requestHeaders),
          ])
          if (!active) return
          setClients(clientList)
          setServices(serviceResult.myServicesList.list)
          if (role === 'administrator' || role === 'manager') {
            try {
              const statusResult = await apiRequest<{ status: Status[] }>('/manager/services/status', { headers: requestHeaders })
              if (active) setStatuses(statusResult.status)
            } catch (statusError) {
              if (statusError instanceof Error && 'status' in statusError && statusError.status === 401) onLogout()
            }
          }
        } else {
          const result = await apiRequest<{ clients: Client[]; pagination: ClientPagination }>(
            `/clients?page=${clientPage}&limit=${clientPageSize}`,
            { headers: requestHeaders },
          )
          if (!active) return
          setClients(result.clients)
          setClientPagination(result.pagination)
        }
      } catch (loadError) {
        if (!active) return
        if (loadError instanceof Error && 'status' in loadError && loadError.status === 401) {
          onLogout()
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os dados.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadView()
    return () => { active = false }
  }, [canManageServices, canViewClients, clientPage, clientPageSize, onLogout, reloadCount, role, token, view])

  const filteredServices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    if (!query) return services
    return services.filter((service) => {
      const client = clients.find((item) => item.id === service.clientId)
      return [service.serviceName, client?.tradeName ?? service.clientName ?? '', service.price, service.details]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(query))
    })
  }, [clients, search, services])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    if (!query) return clients
    return clients.filter((client) => [client.tradeName, client.registeredCompanyName, client.cpf ?? '', client.cnpj ?? '']
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(query)))
  }, [clients, search])

  function closeForms() {
    setServiceForm(null)
    setClientForm(null)
    setError('')
    setNotice('')
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageServices || !(serviceForm === 'create' || serviceForm)) return
    setIsSaving(true)
    setError('')
    setNotice('')
    const formData = new FormData(event.currentTarget)
    const values = {
      serviceName: String(formData.get('serviceName') ?? '').trim(),
      price: String(formData.get('price') ?? '').trim(),
      initialDate: String(formData.get('initialDate') ?? ''),
      finishDate: String(formData.get('finishDate') ?? ''),
      clientId: String(formData.get('clientId') ?? ''),
      details: String(formData.get('details') ?? '').trim(),
      statusServiceId: String(formData.get('statusServiceId') ?? ''),
    }

    try {
      if (serviceForm === 'create') {
        const payload: Record<string, string> = {
          serviceName: values.serviceName,
          price: values.price,
          initialDate: values.initialDate,
          clientId: values.clientId,
          details: values.details,
        }
        if (values.finishDate) payload.finishDate = values.finishDate
        if (values.statusServiceId) payload.statusServiceId = values.statusServiceId
        await apiRequest('/services/create', { method: 'POST', headers, body: JSON.stringify(payload) })
        setNotice('Serviço cadastrado.')
      } else {
        const original = serviceForm
        const originalValues: Record<keyof typeof values, string> = {
          serviceName: original.serviceName,
          price: original.price,
          initialDate: dateInput(original.initialDate),
          finishDate: dateInput(original.finishDate),
          clientId: original.clientId,
          details: original.details,
          statusServiceId: original.statusServiceId ?? '',
        }
        const candidates: Array<[keyof typeof values, string]> = [
          ['serviceName', values.serviceName],
          ['price', values.price],
          ['initialDate', values.initialDate],
          ['finishDate', values.finishDate],
          ['clientId', values.clientId],
          ['details', values.details],
          ['statusServiceId', values.statusServiceId],
        ]
        const changes = candidates.filter(([key, value]) => {
          if (key === 'finishDate' && value === '') return false
          return value !== originalValues[key]
        })
        for (const [key, value] of changes) {
          await apiRequest(`/services/${encodeURIComponent(original.id)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ [key]: value }),
          })
        }
        setNotice(changes.length ? 'Serviço atualizado.' : 'Nenhuma alteração para salvar.')
      }
      setServiceForm(null)
      const refreshed = await apiRequest<{ myServicesList: { list: Service[] } }>('/services/list', { headers })
      setServices(refreshed.myServicesList.list)
      onDataChanged()
    } catch (saveError) {
      if (saveError instanceof Error && 'status' in saveError && saveError.status === 401) {
        onLogout()
        return
      }
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o serviço.')
    } finally {
      setIsSaving(false)
    }
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (clientForm === null || (clientForm === 'create' && !canCreateClients)) return
    if (clientForm !== 'create' && !clientEditRoles.includes(role)) return
    setIsSaving(true)
    setError('')
    setNotice('')
    const formData = new FormData(event.currentTarget)
    const registeredCompanyName = String(formData.get('registeredCompanyName') ?? '').trim()
    const tradeName = String(formData.get('tradeName') ?? '').trim()
    const cpf = String(formData.get('cpf') ?? '').replace(/\D/g, '')
    const cnpj = String(formData.get('cnpj') ?? '').replace(/\D/g, '')

    try {
      if (clientForm === 'create') {
        const payload: Record<string, string | boolean> = { registeredCompanyName, tradeName, active: true }
        if (cpf) payload.cpf = cpf
        if (cnpj) payload.cnpj = cnpj
        await apiRequest('/clients', { method: 'POST', headers, body: JSON.stringify(payload) })
        setNotice('Cliente cadastrado.')
      } else {
        const original = clientForm
        const payload: Record<string, string> = { id: original.id }
        if (registeredCompanyName !== original.registeredCompanyName) payload.registeredCompanyName = registeredCompanyName
        if (tradeName !== original.tradeName) payload.tradeName = tradeName
        if (cpf && cpf !== (original.cpf ?? '').replace(/\D/g, '')) payload.cpf = cpf
        if (cnpj && cnpj !== (original.cnpj ?? '').replace(/\D/g, '')) payload.cnpj = cnpj
        if (Object.keys(payload).length === 1) {
          setNotice('Nenhuma alteração para salvar.')
        } else {
          await apiRequest('/clients', { method: 'PATCH', headers, body: JSON.stringify(payload) })
          setNotice('Cliente atualizado.')
        }
      }
      setClientForm(null)
      if (view === 'services') {
        setClients(await fetchAllClients(headers))
      } else {
        const refreshed = await apiRequest<{ clients: Client[]; pagination: ClientPagination }>(
          `/clients?page=${clientPage}&limit=${clientPageSize}`,
          { headers },
        )
        setClients(refreshed.clients)
        setClientPagination(refreshed.pagination)
      }
      onDataChanged()
    } catch (saveError) {
      if (saveError instanceof Error && 'status' in saveError && saveError.status === 401) {
        onLogout()
        return
      }
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível cadastrar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  function retry() {
    setSearch('')
    setError('')
    setNotice('')
    setIsLoading(true)
    setServiceForm(null)
    setClientForm(null)
    setReloadCount((count) => count + 1)
  }

  return (
    <section className="management-view" aria-labelledby="management-title">
      <header className="management-heading">
        <div>
          <p className="dashboard-card-index">HOME / {view === 'services' ? 'SERVIÇOS' : 'CLIENTES'}</p>
          <h2 id="management-title">{view === 'services' ? 'Serviços' : 'Clientes'}</h2>
          <p>{view === 'services' ? 'Consulte, cadastre e atualize os serviços autorizados.' : 'Consulte e cadastre clientes.'}</p>
        </div>
        <div className="management-actions">
          <label className="dashboard-search"><span aria-hidden="true">⌕</span><input aria-label={`Buscar ${view === 'services' ? 'serviços' : 'clientes'}`} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar ${view === 'services' ? 'serviços' : 'clientes'}`} type="search" value={search} /></label>
          {view === 'services' && canManageServices && <button className="management-primary" onClick={() => { setServiceForm('create'); setError(''); setNotice('') }} type="button">+ Novo serviço</button>}
          {view === 'clients' && canCreateClients && <button className="management-primary" onClick={() => { setClientForm('create'); setError(''); setNotice('') }} type="button">+ Novo cliente</button>}
        </div>
      </header>

      {error && <div className="management-message is-error" role="alert"><span>{error}</span><button onClick={retry} type="button">Tentar novamente</button></div>}
      {notice && <div className="management-message is-success" role="status"><span>{notice}</span><button onClick={() => setNotice('')} type="button" aria-label="Fechar aviso">×</button></div>}
      {!canManageServices && view === 'services' && <p className="management-empty">Seu perfil não possui acesso à listagem de serviços nesta área.</p>}
      {!canViewClients && view === 'clients' && <p className="management-empty">Seu perfil não possui acesso à listagem de clientes.</p>}

      {serviceForm && view === 'services' && (
        <form className="management-form" onSubmit={submitService}>
          <div className="management-form-heading"><div><p className="dashboard-card-index">{serviceForm === 'create' ? 'NOVO REGISTRO' : 'ATUALIZAÇÃO'}</p><h3>{serviceForm === 'create' ? 'Cadastrar serviço' : `Editar ${serviceForm.serviceName}`}</h3></div><button className="dashboard-close" onClick={closeForms} type="button" aria-label="Fechar formulário">×</button></div>
          <div className="management-fields">
            <label>Nome do serviço<input autoComplete="off" defaultValue={serviceForm === 'create' ? '' : serviceForm.serviceName} maxLength={200} name="serviceName" required /></label>
            <label>Valor (R$)<input defaultValue={serviceForm === 'create' ? '' : serviceForm.price} inputMode="decimal" name="price" pattern="\d+(\.\d+)?" placeholder="0.00" required /></label>
            <label>Data inicial<input defaultValue={serviceForm === 'create' ? '' : dateInput(serviceForm.initialDate)} name="initialDate" required type="date" /></label>
            <label>Data final<input defaultValue={serviceForm === 'create' ? '' : dateInput(serviceForm.finishDate)} name="finishDate" type="date" /></label>
            <label>Cliente<select defaultValue={serviceForm === 'create' ? '' : serviceForm.clientId} name="clientId" required><option disabled value="">Selecione um cliente</option>{clients.filter((client) => client.active).map((client) => <option key={client.id} value={client.id}>{client.tradeName}</option>)}</select></label>
            {(role === 'administrator' || role === 'manager') && statuses.length > 0 && <label>Status<select defaultValue={serviceForm === 'create' ? '' : serviceForm.statusServiceId ?? ''} name="statusServiceId"><option value="">{serviceForm === 'create' ? 'Padrão (Fila)' : 'Manter status atual'}</option>{statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>}
            <label className="management-full-field">Detalhes<textarea defaultValue={serviceForm === 'create' ? '' : serviceForm.details} maxLength={2000} name="details" required rows={3} /></label>
          </div>
          {serviceForm !== 'create' && <p className="management-hint">Cada campo alterado é enviado separadamente, conforme o contrato atual da API. Uma data final vazia mantém o valor existente.</p>}
          <div className="management-form-actions"><button className="management-secondary" onClick={closeForms} type="button">Cancelar</button><button className="management-primary" disabled={isSaving} type="submit">{isSaving ? 'Salvando...' : serviceForm === 'create' ? 'Cadastrar serviço' : 'Salvar alterações'}</button></div>
        </form>
      )}

      {clientForm !== null && view === 'clients' && (
        <form className="management-form" onSubmit={submitClient}>
          <div className="management-form-heading"><div><p className="dashboard-card-index">{clientForm === 'create' ? 'NOVO REGISTRO' : 'ATUALIZAÇÃO'}</p><h3>{clientForm === 'create' ? 'Cadastrar cliente' : `Editar ${clientForm.tradeName}`}</h3></div><button className="dashboard-close" onClick={closeForms} type="button" aria-label="Fechar formulário">×</button></div>
          <div className="management-fields">
            <label>Razão social<input autoComplete="organization" defaultValue={clientForm === 'create' ? '' : clientForm.registeredCompanyName} maxLength={100} name="registeredCompanyName" required /></label>
            <label>Nome fantasia<input autoComplete="organization" defaultValue={clientForm === 'create' ? '' : clientForm.tradeName} maxLength={100} name="tradeName" required /></label>
            <label>CPF<input autoComplete="off" defaultValue={clientForm === 'create' ? '' : clientForm.cpf ?? ''} inputMode="numeric" maxLength={14} name="cpf" placeholder="Opcional" /></label>
            <label>CNPJ<input autoComplete="off" defaultValue={clientForm === 'create' ? '' : clientForm.cnpj ?? ''} inputMode="numeric" maxLength={18} name="cnpj" placeholder="Opcional" /></label>
          </div>
          <p className="management-hint">A busca filtra a página atual. O backend valida duplicidade de razão social, nome fantasia, CPF e CNPJ. A API não oferece limpeza explícita de CPF/CNPJ.</p>
          <div className="management-form-actions"><button className="management-secondary" onClick={closeForms} type="button">Cancelar</button><button className="management-primary" disabled={isSaving} type="submit">{isSaving ? 'Salvando...' : clientForm === 'create' ? 'Cadastrar cliente' : 'Salvar alterações'}</button></div>
        </form>
      )}

      {isLoading ? <div className="management-loading" aria-live="polite">Carregando {view === 'services' ? 'serviços' : 'clientes'}...</div> : view === 'services' && canManageServices ? (
        <div className="dashboard-table-scroll management-table-scroll" role="region" aria-label="Lista de serviços" tabIndex={0}>
          <table className="dashboard-table">
            <thead><tr><th scope="col">Serviço</th><th scope="col">Cliente</th><th scope="col">Valor</th><th scope="col">Data inicial</th><th scope="col">Data final</th><th scope="col">Detalhes</th><th scope="col">Ações</th></tr></thead>
            <tbody>
              {filteredServices.map((service) => <tr key={service.id}>
                <td><strong>{service.serviceName}</strong></td>
                <td>{clients.find((client) => client.id === service.clientId)?.tradeName ?? service.clientName ?? 'Cliente'}</td>
                <td>{formatMoney(service.price)}</td>
                <td>{formatDate(service.initialDate)}</td>
                <td>{formatDate(service.finishDate)}</td>
                <td className="management-detail-cell">{service.details}</td>
                <td><button className="management-edit" onClick={() => { setServiceForm(service); setError(''); setNotice('') }} type="button" aria-label={`Editar ${service.serviceName}`} title="Editar serviço">✎</button></td>
              </tr>)}
              {!filteredServices.length && <tr><td className="dashboard-table-empty" colSpan={7}>{search ? 'Nenhum serviço corresponde à busca.' : 'Nenhum serviço disponível.'}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : !isLoading && view === 'clients' && canViewClients ? (
        <div className="dashboard-table-scroll management-table-scroll" role="region" aria-label="Lista de clientes" tabIndex={0}>
          <table className="dashboard-table">
            <thead><tr><th scope="col">Nome fantasia</th><th scope="col">Razão social</th><th scope="col">CPF</th><th scope="col">CNPJ</th><th scope="col">Situação</th>{clientEditRoles.includes(role) && <th scope="col">Ações</th>}</tr></thead>
            <tbody>
              {filteredClients.map((client) => <tr key={client.id}>
                <td><strong>{client.tradeName}</strong></td><td>{client.registeredCompanyName}</td><td>{client.cpf || '—'}</td><td>{client.cnpj || '—'}</td><td><span className={`management-status ${client.active ? 'is-active' : 'is-inactive'}`}>{client.active ? 'Ativo' : 'Inativo'}</span></td>{clientEditRoles.includes(role) && <td><button className="management-edit" onClick={() => { setClientForm(client); setError(''); setNotice('') }} type="button" aria-label={`Editar ${client.tradeName}`} title="Editar cliente">✎</button></td>}
              </tr>)}
              {!filteredClients.length && <tr><td className="dashboard-table-empty" colSpan={clientEditRoles.includes(role) ? 6 : 5}>{search ? 'Nenhum cliente corresponde à busca nesta página.' : 'Nenhum cliente cadastrado.'}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : null}
      {view === 'clients' && canViewClients && !isLoading && (
        <div className="management-pagination">
          <div className="management-pagination-summary" aria-live="polite">
            <span>{clients.length ? `${(clientPagination.page - 1) * clientPagination.limit + 1}–${(clientPagination.page - 1) * clientPagination.limit + clients.length} de ${clientPagination.total}` : `0 de ${clientPagination.total}`}</span>
            <label htmlFor="client-page-size">Itens por página</label>
            <select id="client-page-size" onChange={(event) => { setClientPageSize(Number(event.target.value)); setClientPage(1) }} value={clientPageSize}>
              {clientPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <nav className="dashboard-page-controls" aria-label="Paginação da lista de clientes">
            <button aria-label="Primeira página de clientes" disabled={clientPagination.page <= 1 || isLoading} onClick={() => setClientPage(1)} type="button">«</button>
            <button aria-label="Página anterior de clientes" disabled={clientPagination.page <= 1 || isLoading} onClick={() => setClientPage((page) => Math.max(1, page - 1))} type="button">‹</button>
            <span aria-current="page">{clientPagination.page} / {Math.max(clientPagination.totalPages, 1)}</span>
            <button aria-label="Próxima página de clientes" disabled={!clientPagination.hasMore || isLoading} onClick={() => setClientPage((page) => page + 1)} type="button">›</button>
            <button aria-label="Última página de clientes" disabled={clientPagination.page >= clientPagination.totalPages || isLoading} onClick={() => setClientPage(clientPagination.totalPages)} type="button">»</button>
          </nav>
        </div>
      )}
    </section>
  )
}

export default ManagementPanel
