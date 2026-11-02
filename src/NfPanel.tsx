import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { apiFileRequest, apiRequest, ApiRequestError } from './services/api'
import { extractNfFields, type ExtractedNfFields, type NfPdfField } from './services/nfPdf'
import './NfPanel.css'

type FiscalNote = {
  id: string
  typeId: string
  numberNf: string | null
  acessKey: string | null
  thirdPartyClientId: string
  emissionDate: string
  cancelDate: string | null
  totalValue: string
  pathFile: string | null
  servicesId: string
  movimentationId: string | null
  active: boolean
  deactivationReason: string | null
  deactivatedAt: string | null
  deactivatedBy: string | null
  createdAt: string
  updatedAt: string
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

type Filters = {
  note_number: string
  access_key: string
  min_value: string
  max_value: string
  start_date: string
  end_date: string
  status: 'active' | 'inactive' | 'cancelled'
}

type Client = { id: string; tradeName: string; active: boolean }
type NfType = { id: string; name: string; active: boolean }
type ServiceOption = { id: string; serviceName: string; clientId: string }

type NfPanelProps = {
  token: string
  role: string
  onLogout: () => void
}

const emptyFilters: Filters = {
  note_number: '',
  access_key: '',
  min_value: '',
  max_value: '',
  start_date: '',
  end_date: '',
  status: 'active',
}

const pageSizes = [10, 20, 50, 100]
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyNfFields: ExtractedNfFields = { numberNf: '', acessKey: '', emissionDate: '', totalValue: '' }
const nfFieldLabels: Record<NfPdfField, string> = {
  numberNf: 'número da nota',
  acessKey: 'chave de acesso',
  emissionDate: 'data de emissão',
  totalValue: 'valor total',
}

function displayDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date)
}

function displayMoney(value: string) {
  const amount = Number(value)
  return currency.format(Number.isFinite(amount) ? amount : 0)
}

function responseMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Não foi possível concluir a operação.'
}

function pdfInconsistencies(error: unknown) {
  if (!(error instanceof ApiRequestError) || typeof error.responseBody !== 'object' || error.responseBody === null) return []
  if (!('inconsistencies' in error.responseBody) || !Array.isArray(error.responseBody.inconsistencies)) return []
  return error.responseBody.inconsistencies.map((item) => {
    if (typeof item !== 'object' || item === null || !('field' in item)) return 'Confira os dados preenchidos com o conteúdo do PDF.'
    const field = String(item.field)
    const labels: Record<string, string> = {
      numberNf: 'Número da nota',
      acessKey: 'Chave de acesso',
      emissionDate: 'Data de emissão',
      totalValue: 'Valor total',
    }
    return `${labels[field] ?? field}: o valor informado não corresponde ao PDF.`
  })
}

async function loadAllClients(headers: HeadersInit) {
  const first = await apiRequest<{ clients: Client[]; pagination: Pagination }>('/clients?page=1&limit=10', { headers })
  if (first.pagination.totalPages <= 1) return first.clients
  const rest = await Promise.all(Array.from({ length: first.pagination.totalPages - 1 }, (_, index) =>
    apiRequest<{ clients: Client[]; pagination: Pagination }>(`/clients?page=${index + 2}&limit=10`, { headers }),
  ))
  return [...first.clients, ...rest.flatMap((page) => page.clients)]
}

function NfPanel({ token, role, onLogout }: NfPanelProps) {
  const canCreate = role === 'administrator' || role === 'finance'
  const headers = { Authorization: `Bearer ${token}` }
  const [notes, setNotes] = useState<FiscalNote[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false })
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [types, setTypes] = useState<NfType[]>([])
  const [isLoadingTypes, setIsLoadingTypes] = useState(false)
  const [pdfFields, setPdfFields] = useState<ExtractedNfFields>(emptyNfFields)
  const [pdfParseState, setPdfParseState] = useState<'idle' | 'reading' | 'success' | 'partial' | 'error'>('idle')
  const [pdfParseMessage, setPdfParseMessage] = useState('')
  const pdfSelectionVersion = useRef(0)
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [services, setServices] = useState<ServiceOption[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [servicesLoadError, setServicesLoadError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deactivatingNote, setDeactivatingNote] = useState<FiscalNote | null>(null)
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [previewNote, setPreviewNote] = useState<FiscalNote | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    let active = true
    const requestHeaders = { Authorization: `Bearer ${token}` }

    if (!selectedClientId) return () => { active = false }

    async function loadClientServices() {
      setIsLoadingServices(true)
      setServices([])
      setServicesLoadError('')
      const query = new URLSearchParams({ clientId: selectedClientId })
      try {
        const result = await apiRequest<{ myServicesList: { list: ServiceOption[] } }>(`/services/list?${query}`, { headers: requestHeaders })
        if (active) setServices(result.myServicesList.list)
      } catch (serviceError) {
        if (!active) return
        if (serviceError instanceof Error && 'status' in serviceError && serviceError.status === 401) {
          onLogout()
          return
        }
        if (serviceError instanceof Error && 'status' in serviceError && serviceError.status === 404) {
          setServices([])
          setServicesLoadError('Este cliente ainda não possui serviços ativos.')
        } else {
          setServicesLoadError(responseMessage(serviceError))
        }
      } finally {
        if (active) setIsLoadingServices(false)
      }
    }

    void loadClientServices()
    return () => { active = false }
  }, [onLogout, selectedClientId, token])

  useEffect(() => {
    let active = true
    const requestHeaders = { Authorization: `Bearer ${token}` }

    async function loadNotes() {
      setIsLoading(true)
      setError('')
      const query = new URLSearchParams({ page: String(page), limit: String(limit), status: filters.status })
      if (filters.note_number) query.set('note_number', filters.note_number)
      if (filters.access_key) query.set('access_key', filters.access_key)
      if (filters.min_value) query.set('min_value', filters.min_value)
      if (filters.max_value) query.set('max_value', filters.max_value)
      if (filters.start_date) query.set('start_date', filters.start_date)
      if (filters.end_date) query.set('end_date', filters.end_date)

      try {
        const result = await apiRequest<{ notes: FiscalNote[]; pagination: Pagination }>(`/notes?${query}`, { headers: requestHeaders })
        if (!active) return
        setNotes(result.notes)
        setPagination(result.pagination)
      } catch (loadError) {
        if (!active) return
        if (loadError instanceof Error && 'status' in loadError && loadError.status === 401) {
          onLogout()
          return
        }
        setError(responseMessage(loadError))
        setNotes([])
        setPagination({ page, limit, total: 0, totalPages: 0, hasMore: false })
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadNotes()
    return () => { active = false }
  }, [filters, limit, onLogout, page, refreshKey, token])

  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.tradeName])), [clients])

  async function handlePdfSelection(file: File | null) {
    const selectionVersion = pdfSelectionVersion.current + 1
    pdfSelectionVersion.current = selectionVersion
    setPdfFields(emptyNfFields)
    setPdfParseMessage('')

    if (!file) {
      setPdfParseState('idle')
      return
    }
    if (file.type !== 'application/pdf' || file.size === 0) {
      setPdfParseState('error')
      setPdfParseMessage('Selecione um arquivo PDF válido e não vazio.')
      return
    }

    setPdfParseState('reading')
    setPdfParseMessage('Lendo o texto do PDF localmente...')
    try {
      const extraction = await extractNfFields(file)
      if (selectionVersion !== pdfSelectionVersion.current) return
      setPdfFields(extraction.fields)
      if (extraction.missing.length) {
        setPdfParseState('partial')
        setPdfParseMessage(`Preenchimento parcial. Confira manualmente: ${extraction.missing.map((field) => nfFieldLabels[field]).join(', ')}.`)
      } else {
        setPdfParseState('success')
        setPdfParseMessage('Campos extraídos do PDF. Confira os valores antes de enviar.')
      }
    } catch (parseError) {
      if (selectionVersion !== pdfSelectionVersion.current) return
      setPdfParseState('error')
      setPdfParseMessage(parseError instanceof Error ? parseError.message : 'Não foi possível ler o PDF. Preencha os campos manualmente.')
    }
  }

  async function selectType(typeId: string) {
    setSelectedTypeId(typeId)
    setSelectedClientId('')
    setServices([])
    setServicesLoadError('')
    setClients([])
    if (!typeId) return

    setIsLoadingClients(true)
    try {
      const allClients = await loadAllClients(headers)
      setClients(allClients)
    } catch (loadError) {
      if (loadError instanceof Error && 'status' in loadError && loadError.status === 401) {
        onLogout()
        return
      }
      setError(`Não foi possível carregar os clientes: ${responseMessage(loadError)}`)
    } finally {
      setIsLoadingClients(false)
    }
  }

  async function openCreateForm() {
    setError('')
    setErrorDetails([])
    setNotice('')
    setIsCreateOpen(true)
    setSelectedTypeId('')
    setSelectedClientId('')
    setServices([])
    setServicesLoadError('')
    setPdfFields(emptyNfFields)
    setPdfParseState('idle')
    setPdfParseMessage('')
    if (types.length) return
    setIsLoadingTypes(true)
    try {
      const result = await apiRequest<{ types: NfType[] }>('/types', { headers })
      setTypes(result.types.filter((item) => item.active))
    } catch (loadError) {
      if (loadError instanceof Error && 'status' in loadError && loadError.status === 401) {
        onLogout()
        return
      }
      setError(`Não foi possível carregar os tipos de NF: ${responseMessage(loadError)}`)
    } finally {
      setIsLoadingTypes(false)
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draftFilters.min_value && draftFilters.max_value && Number(draftFilters.min_value) > Number(draftFilters.max_value)) {
      setError('O valor mínimo não pode ser maior que o valor máximo.')
      return
    }
    if (draftFilters.start_date && draftFilters.end_date && draftFilters.start_date > draftFilters.end_date) {
      setError('A data inicial não pode ser posterior à data final.')
      return
    }
    setError('')
    setFilters({ ...draftFilters })
    setPage(1)
  }

  function resetFilters() {
    setDraftFilters(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
    setError('')
  }

  async function submitNf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) return
    setIsSaving(true)
    setError('')
    setErrorDetails([])
    setNotice('')
    const data = new FormData(event.currentTarget)
    const file = data.get('file')
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') {
      setError('Selecione um arquivo PDF válido e não vazio.')
      setIsSaving(false)
      return
    }

    const nf = {
      typeId: String(data.get('typeId') ?? '').trim(),
      numberNf: String(data.get('numberNf') ?? '').trim(),
      acessKey: String(data.get('acessKey') ?? '').replace(/\D/g, ''),
      thirdPartyClientId: String(data.get('thirdPartyClientId') ?? '').trim(),
      emissionDate: String(data.get('emissionDate') ?? ''),
      totalValue: Number(data.get('totalValue')),
      servicesId: String(data.get('servicesId') ?? '').trim(),
    }
    if (!/^\d{44}$|^\d{50}$/.test(nf.acessKey)) {
      setError('A chave de acesso deve conter 44 ou 50 dígitos numéricos.')
      setIsSaving(false)
      return
    }
    if (!Number.isFinite(nf.totalValue) || nf.totalValue <= 0) {
      setError('O valor total deve ser maior que zero.')
      setIsSaving(false)
      return
    }

    const body = new FormData()
    body.append('file', file)
    body.append('nf', JSON.stringify(nf))
    try {
      await apiRequest('/nf', { method: 'POST', headers, body })
      setIsCreateOpen(false)
      setNotice('Nota fiscal cadastrada e validada com o PDF.')
      setDraftFilters({ ...filters, status: 'active' })
      setFilters({ ...filters, status: 'active' })
      setPage(1)
      setRefreshKey((key) => key + 1)
    } catch (saveError) {
      if (saveError instanceof Error && 'status' in saveError && saveError.status === 401) {
        onLogout()
        return
      }
      setError(responseMessage(saveError))
      setErrorDetails(pdfInconsistencies(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  async function openNfFile(note: FiscalNote, download: boolean) {
    if (!download) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
      setPreviewError('')
      setPreviewNote(note)
      setIsPreviewLoading(true)
    }
    try {
      const response = await apiFileRequest(`/notes/${encodeURIComponent(note.id)}/file${download ? '?download=true' : ''}`, token)
      const url = URL.createObjectURL(await response.blob())
      if (download) {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = note.pathFile?.split('/').pop() || `nota-${note.numberNf || note.id}.pdf`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        setPreviewUrl(url)
      }
    } catch (fileError) {
      if (!download) {
        setPreviewError(responseMessage(fileError))
        setIsPreviewLoading(false)
      }
      if (fileError instanceof Error && 'status' in fileError && fileError.status === 401) {
        onLogout()
        return
      }
      setError(responseMessage(fileError))
    } finally {
      if (!download) setIsPreviewLoading(false)
    }
  }

  function closeNfPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setPreviewNote(null)
    setIsPreviewLoading(false)
    setPreviewError('')
  }

  async function submitDeactivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!deactivatingNote) return
    setIsSaving(true)
    setError('')
    setErrorDetails([])
    const data = new FormData(event.currentTarget)
    const reason = String(data.get('reason') ?? '').trim()
    try {
      await apiRequest(`/notes/${encodeURIComponent(deactivatingNote.id)}/deactivate`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reason }),
      })
      setDeactivatingNote(null)
      setNotice('Nota fiscal desativada.')
      setRefreshKey((key) => key + 1)
    } catch (deactivationError) {
      if (deactivationError instanceof Error && 'status' in deactivationError && deactivationError.status === 401) {
        onLogout()
        return
      }
      setError(responseMessage(deactivationError))
    } finally {
      setIsSaving(false)
    }
  }

  function closeCreateForm() {
    setIsCreateOpen(false)
    pdfSelectionVersion.current += 1
    setSelectedTypeId('')
    setSelectedClientId('')
    setServices([])
    setServicesLoadError('')
    setPdfFields(emptyNfFields)
    setPdfParseState('idle')
    setPdfParseMessage('')
    setError('')
    setErrorDetails([])
  }

  const firstRecord = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const lastRecord = firstRecord ? firstRecord + notes.length - 1 : 0

  return (
    <section className="nf-view" aria-labelledby="nf-title">
      <header className="nf-heading">
        <div>
          <p className="dashboard-card-index">FINANCEIRO / DOCUMENTOS FISCAIS</p>
          <h2 id="nf-title">Notas fiscais</h2>
          <p>Consulte notas vinculadas, envie PDFs e registre desativações.</p>
        </div>
        <div className="nf-heading-actions">
          <span className="nf-role-note">Acesso: {role}</span>
          {canCreate && <button className="management-primary" disabled={isCreateOpen} onClick={() => void openCreateForm()} type="button">Upload de NF</button>}
        </div>
      </header>

      {error && <div className="management-message is-error" role="alert"><div><strong>{error}</strong>{errorDetails.length > 0 && <ul>{errorDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul>}</div><button onClick={() => { setError(''); setErrorDetails([]) }} type="button" aria-label="Fechar erro">×</button></div>}
      {notice && <div className="management-message is-success" role="status"><span>{notice}</span><button onClick={() => setNotice('')} type="button" aria-label="Fechar aviso">×</button></div>}

      {isCreateOpen && (
        <form className="management-form nf-form" onSubmit={submitNf}>
          <div className="management-form-heading"><div><p className="dashboard-card-index">UPLOAD DE DOCUMENTO</p><h3>Registrar nota fiscal</h3></div><button className="dashboard-close" onClick={closeCreateForm} type="button" aria-label="Fechar formulário">×</button></div>
          <div className="management-fields">
            <label>Arquivo PDF<input accept="application/pdf,.pdf" name="file" onChange={(event) => { void handlePdfSelection(event.currentTarget.files?.[0] ?? null) }} required type="file" /></label>
            <label>Número da NF<input autoComplete="off" maxLength={50} name="numberNf" onChange={(event) => setPdfFields({ ...pdfFields, numberNf: event.target.value })} required value={pdfFields.numberNf} /></label>
            <label className="management-full-field">Chave de acesso<input autoComplete="off" inputMode="numeric" maxLength={50} name="acessKey" onChange={(event) => setPdfFields({ ...pdfFields, acessKey: event.target.value })} pattern="(\d{44}|\d{50})" required value={pdfFields.acessKey} /></label>
            <label>Tipo de NF<select disabled={isLoadingTypes || isLoadingClients || !types.length} name="typeId" onChange={(event) => { void selectType(event.target.value) }} required value={selectedTypeId}><option value="">{isLoadingTypes ? 'Carregando tipos...' : types.length ? 'Selecione um tipo' : 'Nenhum tipo ativo disponível'}</option>{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Cliente relacionado<select disabled={!selectedTypeId || isLoadingClients || !clients.some((client) => client.active)} name="thirdPartyClientId" onChange={(event) => { setSelectedClientId(event.target.value); setServices([]); setServicesLoadError('') }} required value={selectedClientId}><option value="">{!selectedTypeId ? 'Selecione primeiro um tipo' : isLoadingClients ? 'Carregando clientes...' : clients.length ? 'Selecione um cliente' : 'Clientes indisponíveis'}</option>{clients.filter((client) => client.active).map((client) => <option key={client.id} value={client.id}>{client.tradeName}</option>)}</select></label>
            <label>Data de emissão<input name="emissionDate" onChange={(event) => setPdfFields({ ...pdfFields, emissionDate: event.target.value })} required type="date" value={pdfFields.emissionDate} /></label>
            <label>Valor total (R$)<input inputMode="decimal" min="0.01" name="totalValue" onChange={(event) => setPdfFields({ ...pdfFields, totalValue: event.target.value })} required step="0.01" type="number" value={pdfFields.totalValue} /></label>
            <label>Serviço prestado<select disabled={!selectedClientId || isLoadingServices || !services.length} key={selectedClientId} name="servicesId" required><option value="">{!selectedClientId ? 'Selecione primeiro um cliente' : isLoadingServices ? 'Carregando serviços...' : services.length ? 'Selecione um serviço' : 'Nenhum serviço ativo para este cliente'}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.serviceName}</option>)}</select></label>
          </div>
          {pdfParseMessage && <p className={`nf-pdf-status is-${pdfParseState}`} role="status" aria-live="polite">{pdfParseMessage}</p>}
          {servicesLoadError && selectedClientId && <p className="nf-service-error" role="status">{servicesLoadError}</p>}
          <p className="management-hint">O PDF é lido localmente no navegador. Os campos preenchidos automaticamente continuam editáveis. O backend compara número, chave, data e valor com o PDF; envie um PDF digital com texto selecionável. A movimentação é opcional e não será enviada.</p>
          <div className="management-form-actions"><button className="management-secondary" onClick={closeCreateForm} type="button">Cancelar</button><button className="management-primary" disabled={isSaving || pdfParseState === 'reading' || isLoadingClients || isLoadingTypes || isLoadingServices || !types.length || !clients.some((client) => client.active) || !services.length} type="submit">{pdfParseState === 'reading' ? 'Lendo PDF...' : isSaving ? 'Validando e enviando...' : 'Enviar nota fiscal'}</button></div>
        </form>
      )}

      {deactivatingNote && (
        <form className="nf-deactivate-form" onSubmit={submitDeactivation}>
          <div className="management-form-heading"><div><p className="dashboard-card-index">DESATIVAÇÃO</p><h3>NF {deactivatingNote.numberNf || 'sem número'}</h3></div><button className="dashboard-close" onClick={() => setDeactivatingNote(null)} type="button" aria-label="Cancelar desativação">×</button></div>
          <label htmlFor="nf-deactivation-reason">Motivo da desativação</label>
          <textarea id="nf-deactivation-reason" maxLength={500} minLength={5} name="reason" required rows={3} />
          <p className="management-hint">A desativação é permanente e registra a data, o usuário e o motivo.</p>
          <div className="management-form-actions"><button className="management-secondary" onClick={() => setDeactivatingNote(null)} type="button">Cancelar</button><button className="management-danger" disabled={isSaving} type="submit">{isSaving ? 'Desativando...' : 'Confirmar desativação'}</button></div>
        </form>
      )}

      <form className="nf-filters" onSubmit={applyFilters}>
        <div className="nf-filter-heading"><div><p className="dashboard-card-index">CONSULTA</p><h3>Filtrar notas</h3></div><label>Status<select value={draftFilters.status} onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value as Filters['status'] })}><option value="active">Ativas</option><option value="inactive">Inativas</option><option value="cancelled">Canceladas</option></select></label></div>
        <div className="nf-filter-grid">
          <label>Número da NF<input value={draftFilters.note_number} onChange={(event) => setDraftFilters({ ...draftFilters, note_number: event.target.value })} /></label>
          <label>Chave de acesso<input maxLength={50} value={draftFilters.access_key} onChange={(event) => setDraftFilters({ ...draftFilters, access_key: event.target.value })} /></label>
          <label>Valor mínimo<input min="0" step="0.01" type="number" value={draftFilters.min_value} onChange={(event) => setDraftFilters({ ...draftFilters, min_value: event.target.value })} /></label>
          <label>Valor máximo<input min="0" step="0.01" type="number" value={draftFilters.max_value} onChange={(event) => setDraftFilters({ ...draftFilters, max_value: event.target.value })} /></label>
          <label>Emissão a partir de<input type="date" value={draftFilters.start_date} onChange={(event) => setDraftFilters({ ...draftFilters, start_date: event.target.value })} /></label>
          <label>Emissão até<input type="date" value={draftFilters.end_date} onChange={(event) => setDraftFilters({ ...draftFilters, end_date: event.target.value })} /></label>
        </div>
        <div className="nf-filter-actions"><button className="management-secondary" onClick={resetFilters} type="button">Limpar filtros</button><button className="management-primary" type="submit">Aplicar filtros</button></div>
      </form>

      <div className="nf-list-heading"><div><p className="dashboard-card-index">REGISTROS FISCAIS</p><h3>Notas {filters.status === 'active' ? 'ativas' : filters.status === 'inactive' ? 'inativas' : 'canceladas'}</h3></div><button className="nf-refresh" disabled={isLoading} onClick={() => setRefreshKey((key) => key + 1)} type="button" title="Atualizar lista">Atualizar</button></div>
      <div className="dashboard-table-scroll nf-table-scroll" role="region" aria-label="Lista de notas fiscais" tabIndex={0}>
        <table className="dashboard-table nf-table">
          <thead><tr><th scope="col">Nota / chave</th><th scope="col">Cliente / serviço</th><th scope="col">Emissão</th><th scope="col">Valor</th><th scope="col">Situação</th><th scope="col">Arquivo</th>{role !== 'observer' && <th scope="col">Ação</th>}</tr></thead>
          <tbody>
            {notes.map((note) => <tr key={note.id}>
              <td><strong>{note.numberNf || 'Sem número'}</strong><small className="nf-mono" title={note.acessKey || ''}>{note.acessKey || 'Sem chave'}</small></td>
              <td><span title={note.thirdPartyClientId}>{clientNames.get(note.thirdPartyClientId) || note.thirdPartyClientId.slice(0, 8)}</span><small title={note.servicesId}>Serviço · {note.servicesId.slice(0, 8)}</small>{note.movimentationId && <small title={note.movimentationId}>Mov. · {note.movimentationId.slice(0, 8)}</small>}</td>
              <td>{displayDate(note.emissionDate)}</td>
              <td className="nf-money">{displayMoney(note.totalValue)}</td>
              <td><span className={`management-status ${note.active ? 'is-active' : 'is-inactive'}`}>{note.active ? 'Ativa' : note.cancelDate ? 'Cancelada' : 'Inativa'}</span>{note.deactivationReason && <small className="nf-reason" title={note.deactivationReason}>{note.deactivationReason}</small>}</td>
              <td>{note.pathFile ? <><span className="nf-file-name" title={note.pathFile}>{note.pathFile.split('/').pop()}</span><span className="nf-file-actions"><button type="button" onClick={() => void openNfFile(note, false)}>Ver</button><button type="button" onClick={() => void openNfFile(note, true)}>Baixar</button></span></> : '—'}</td>
              {role !== 'observer' && <td>{note.active && !note.cancelDate ? <button className="nf-deactivate-button" onClick={() => { setError(''); setErrorDetails([]); setDeactivatingNote(note) }} type="button" aria-label={`Desativar NF ${note.numberNf || ''}`}>Desativar</button> : '—'}</td>}
            </tr>)}
            {!isLoading && !notes.length && <tr><td className="dashboard-table-empty" colSpan={role !== 'observer' ? 7 : 6}>{error ? 'Não foi possível carregar as notas.' : 'Nenhuma nota fiscal encontrada.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="nf-pagination">
        <div className="nf-pagination-summary" aria-live="polite"><span>{isLoading ? 'Carregando...' : `${firstRecord}–${lastRecord} de ${pagination.total}`}</span><label htmlFor="nf-page-size">Itens por página</label><select id="nf-page-size" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
        <nav className="dashboard-page-controls" aria-label="Paginação das notas fiscais">
          <button aria-label="Primeira página de notas" disabled={page <= 1 || isLoading} onClick={() => setPage(1)} type="button">«</button>
          <button aria-label="Página anterior de notas" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">‹</button>
          <span aria-current="page">{pagination.page} / {Math.max(pagination.totalPages, 1)}</span>
          <button aria-label="Próxima página de notas" disabled={!pagination.hasMore || isLoading} onClick={() => setPage((current) => current + 1)} type="button">›</button>
          <button aria-label="Última página de notas" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage(pagination.totalPages)} type="button">»</button>
        </nav>
      </div>
      {previewNote && (
        <div className="nf-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeNfPreview() }}>
          <section aria-label={`Visualização da nota ${previewNote.numberNf || ''}`} aria-modal="true" className="nf-preview-modal" role="dialog">
            <header className="nf-preview-header">
              <div><p className="dashboard-card-index">VISUALIZAÇÃO</p><h3>Nota fiscal {previewNote.numberNf || 'sem número'}</h3></div>
              <button className="dashboard-close" onClick={closeNfPreview} type="button" aria-label="Fechar visualização">×</button>
            </header>
            {isPreviewLoading ? <div className="nf-preview-loading">Carregando PDF...</div> : previewUrl ? <iframe className="nf-preview-frame" src={previewUrl} title={`Nota fiscal ${previewNote.numberNf || ''}`} /> : <p className="nf-preview-loading">{previewError || 'Não foi possível carregar o PDF.'}</p>}
            <footer className="nf-preview-actions">
              <button className="management-secondary" onClick={() => void openNfFile(previewNote, true)} type="button">Baixar PDF</button>
              <button className="management-primary" onClick={closeNfPreview} type="button">Fechar</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  )
}

export default NfPanel