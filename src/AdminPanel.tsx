import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiRequest } from './services/api'
import './AdminPanel.css'

type AdminTable = 'roles' | 'users' | 'clients' | 'movimentations' | 'types' | 'status-services' | 'services' | 'notes' | 'bundled'
type StatusFilter = 'all' | 'active' | 'inactive'
type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'password' | 'boolean'
type FormValue = string | boolean

type FieldDefinition = {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  placeholder?: string
  help?: string
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

type AdminResponse = {
  records: Array<Record<string, unknown>>
  pagination: Pagination
}

type AdminPanelProps = {
  token: string
  onLogout: () => void
}

const tableOptions: Array<{ value: AdminTable; label: string }> = [
  { value: 'roles', label: 'Perfis' },
  { value: 'users', label: 'Usuários' },
  { value: 'clients', label: 'Clientes' },
  { value: 'movimentations', label: 'Movimentações' },
  { value: 'types', label: 'Tipos de NF' },
  { value: 'status-services', label: 'Status de serviços' },
  { value: 'services', label: 'Serviços' },
  { value: 'notes', label: 'Notas fiscais' },
  { value: 'bundled', label: 'Agrupamentos' },
]

const fieldsByTable: Record<AdminTable, FieldDefinition[]> = {
  roles: [
    { key: 'name', label: 'Nome do perfil', required: true, placeholder: 'Ex.: administrator' },
    { key: 'active', label: 'Ativo', type: 'boolean' },
  ],
  users: [
    { key: 'name', label: 'Nome', required: true },
    { key: 'surname', label: 'Sobrenome', required: true },
    { key: 'username', label: 'Usuário', required: true },
    { key: 'password', label: 'Senha', type: 'password', required: true, help: 'Na edição, deixe vazio para manter a senha atual.' },
    { key: 'roleId', label: 'ID do perfil', required: true, placeholder: 'Cole o ID UUID do perfil' },
    { key: 'cpf', label: 'CPF', required: true },
    { key: 'active', label: 'Ativo', type: 'boolean' },
    { key: 'passwordChangeRequired', label: 'Solicitar troca de senha', type: 'boolean' },
  ],
  clients: [
    { key: 'registeredCompanyName', label: 'Razão social', required: true },
    { key: 'tradeName', label: 'Nome fantasia', required: true },
    { key: 'cnpj', label: 'CNPJ', placeholder: 'Opcional' },
    { key: 'cpf', label: 'CPF', placeholder: 'Opcional' },
    { key: 'active', label: 'Ativo', type: 'boolean' },
  ],
  movimentations: [
    { key: 'name', label: 'Nome da movimentação', required: true },
    { key: 'nfId', label: 'ID da nota fiscal', placeholder: 'Opcional' },
    { key: 'destinationUserId', label: 'ID do usuário de destino', placeholder: 'Opcional' },
    { key: 'destinationClientId', label: 'ID do cliente de destino', placeholder: 'Opcional' },
    { key: 'justify', label: 'Justificativa', type: 'textarea', required: true },
    { key: 'active', label: 'Ativa', type: 'boolean' },
  ],
  types: [
    { key: 'name', label: 'Nome do tipo de nota', required: true, placeholder: 'Ex.: Entrada, Saída ou Serviço' },
    { key: 'active', label: 'Ativo', type: 'boolean' },
  ],
  'status-services': [
    { key: 'name', label: 'Nome do status', required: true, placeholder: 'Ex.: Em andamento' },
    { key: 'active', label: 'Ativo', type: 'boolean' },
  ],
  services: [
    { key: 'serviceName', label: 'Nome do serviço', required: true },
    { key: 'price', label: 'Preço', type: 'number', required: true, placeholder: '0,00' },
    { key: 'initialDate', label: 'Data inicial', type: 'date', required: true },
    { key: 'finishDate', label: 'Data final', type: 'date', placeholder: 'Opcional' },
    { key: 'clientId', label: 'ID do cliente', required: true, placeholder: 'Cole o ID UUID do cliente' },
    { key: 'details', label: 'Detalhes', type: 'textarea', required: true },
    { key: 'statusServiceId', label: 'ID do status', placeholder: 'Opcional' },
    { key: 'active', label: 'Ativo', type: 'boolean' },
  ],
  notes: [
    { key: 'typeId', label: 'ID do tipo de nota', required: true },
    { key: 'numberNf', label: 'Número da nota', placeholder: 'Opcional' },
    { key: 'acessKey', label: 'Chave de acesso', placeholder: 'Opcional' },
    { key: 'thirdPartyClientId', label: 'ID do cliente', required: true },
    { key: 'emissionDate', label: 'Data de emissão', type: 'date', required: true },
    { key: 'cancelDate', label: 'Data de cancelamento', type: 'date', placeholder: 'Opcional' },
    { key: 'totalValue', label: 'Valor total', type: 'number', required: true, placeholder: '0,00' },
    { key: 'pathFile', label: 'Caminho do arquivo', placeholder: 'Opcional' },
    { key: 'servicesId', label: 'ID do serviço', required: true },
    { key: 'movimentationId', label: 'ID da movimentação', placeholder: 'Opcional' },
    { key: 'active', label: 'Ativa', type: 'boolean' },
    { key: 'deactivationReason', label: 'Motivo da desativação', type: 'textarea', placeholder: 'Opcional' },
  ],
  bundled: [
    { key: 'serviceBundledId', label: 'ID do serviço', required: true },
    { key: 'userId', label: 'ID do usuário', required: true },
    { key: 'serviceNameBundled', label: 'Nome do serviço', required: true },
    { key: 'priceBundled', label: 'Preço', type: 'number', required: true, placeholder: '0,00' },
    { key: 'clientIdBundled', label: 'Cliente', required: true },
    { key: 'initialDateBundled', label: 'Data inicial', type: 'date', required: true },
    { key: 'finishDateBundled', label: 'Data final', type: 'date', placeholder: 'Opcional' },
    { key: 'active', label: 'Ativo', type: 'boolean' },
  ],
}

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false }

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function initialForm(table: AdminTable, record?: Record<string, unknown>): Record<string, FormValue> {
  return Object.fromEntries(fieldsByTable[table].map((field) => {
    const value = record?.[field.key]
    if (field.type === 'boolean') return [field.key, typeof value === 'boolean' ? value : true]
    return [field.key, value === null || value === undefined ? '' : String(value)]
  }))
}

function AdminPanel({ token, onLogout }: AdminPanelProps) {
  const [table, setTable] = useState<AdminTable>('types')
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<{ id?: string; values: Record<string, FormValue> } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  useEffect(() => {
    let active = true
    async function loadRecords() {
      setIsLoading(true)
      setError('')
      try {
        const query = new URLSearchParams({ page: String(page), limit: '20', status })
        const result = await apiRequest<AdminResponse>(`/admin/data/${table}?${query}`, { headers })
        if (!active) return
        setRecords(result.records)
        setPagination(result.pagination)
      } catch (loadError) {
        if (!active) return
        if (loadError instanceof Error && 'status' in loadError && loadError.status === 401) {
          onLogout()
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os registros.')
        setRecords([])
        setPagination(emptyPagination)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void loadRecords()
    return () => { active = false }
  }, [headers, onLogout, page, reloadKey, status, table])

  const columns = useMemo(() => {
    const keys = new Set<string>()
    records.forEach((record) => Object.keys(record).forEach((key) => keys.add(key)))
    return [...keys].slice(0, 7)
  }, [records])

  function changeTable(value: AdminTable) {
    setTable(value)
    setPage(1)
    setStatus('all')
    setEditor(null)
    setNotice('')
  }

  function openCreate() {
    setError('')
    setNotice('')
    setEditor({ values: initialForm(table) })
  }

  function openEdit(record: Record<string, unknown>) {
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) {
      setError('Este registro não possui um identificador editável.')
      return
    }
    setError('')
    setNotice('')
    setEditor({ id, values: initialForm(table, record) })
  }

  function updateField(key: string, value: FormValue) {
    if (editor) setEditor({ ...editor, values: { ...editor.values, [key]: value } })
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    const fields = fieldsByTable[table]
    const missing = fields.find((field) => field.required && !editor.values[field.key])
    if (missing && !(editor.id && missing.key === 'password')) {
      setError(`Preencha o campo "${missing.label}".`)
      return
    }
    setIsSaving(true)
    setError('')
    setNotice('')
    const payload: Record<string, unknown> = {}
    fields.forEach((field) => {
      const value = editor.values[field.key]
      if (field.type === 'boolean') payload[field.key] = value === true
      else if (value !== '') payload[field.key] = value
    })
    try {
      const path = editor.id ? `/admin/data/${table}/${encodeURIComponent(editor.id)}` : `/admin/data/${table}`
      await apiRequest(path, { method: editor.id ? 'PATCH' : 'POST', headers, body: JSON.stringify(payload) })
      setEditor(null)
      setNotice(editor.id ? 'Registro atualizado.' : 'Registro criado.')
      setPage(1)
      setReloadKey((current) => current + 1)
    } catch (saveError) {
      if (saveError instanceof Error && 'status' in saveError && saveError.status === 401) {
        onLogout()
        return
      }
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o registro.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-view" aria-labelledby="admin-title">
      <header className="admin-heading">
        <div>
          <p className="dashboard-card-index">ADMINISTRAÇÃO / BANCO DE DADOS</p>
          <h2 id="admin-title">Painel administrativo</h2>
          <p>Cadastre e edite informações sem precisar montar JSON.</p>
        </div>
        <button className="management-primary" onClick={openCreate} type="button">+ Novo registro</button>
      </header>

      <div className="admin-toolbar">
        <label>Recurso
          <select onChange={(event) => changeTable(event.target.value as AdminTable)} value={table}>
            {tableOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>Status
          <select onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1) }} value={status}>
            <option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
          </select>
        </label>
        <button className="management-secondary" disabled={isLoading} onClick={() => setReloadKey((current) => current + 1)} type="button">Atualizar</button>
      </div>

      {error && <div className="management-message is-error" role="alert">{error}</div>}
      {notice && <div className="management-message is-success" role="status">{notice}</div>}

      {editor && (
        <form className="management-form admin-editor" onSubmit={submitEditor}>
          <div className="management-form-heading">
            <div><p className="dashboard-card-index">{editor.id ? 'ATUALIZAÇÃO' : 'NOVO REGISTRO'}</p><h3>{editor.id ? 'Editar registro' : 'Criar registro'}</h3></div>
            <button className="dashboard-close" onClick={() => setEditor(null)} type="button" aria-label="Fechar editor">×</button>
          </div>
          <div className="admin-form-grid">
            {fieldsByTable[table].map((field) => {
              const value = editor.values[field.key]
              if (field.type === 'boolean') {
                return <label className="admin-checkbox" key={field.key}><input checked={value === true} onChange={(event) => updateField(field.key, event.target.checked)} type="checkbox" />{field.label}</label>
              }
              const common = { id: `admin-${field.key}`, name: field.key, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateField(field.key, event.target.value), placeholder: field.placeholder, required: field.required && !(editor.id && field.key === 'password'), value: String(value ?? '') }
              return <label className="admin-field" key={field.key}>{field.label}{field.required && !(editor.id && field.key === 'password') ? ' *' : ''}{field.type === 'textarea' ? <textarea {...common} rows={3} /> : <input {...common} type={field.type ?? 'text'} />}{field.help && <small>{field.help}</small>}</label>
            })}
          </div>
          <p className="management-hint">Campos com * são obrigatórios. IDs relacionados podem ser copiados da tabela correspondente.</p>
          <div className="management-form-actions">
            <button className="management-secondary" onClick={() => setEditor(null)} type="button">Cancelar</button>
            <button className="management-primary" disabled={isSaving} type="submit">{isSaving ? 'Salvando...' : 'Salvar registro'}</button>
          </div>
        </form>
      )}

      {isLoading ? <p className="management-loading">Carregando registros...</p> : records.length === 0 ? <p className="management-empty">Nenhum registro encontrado.</p> : (
        <div className="management-table-scroll admin-table-scroll" role="region" aria-label="Registros administrativos" tabIndex={0}>
          <table className="dashboard-table">
            <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th>Ações</th></tr></thead>
            <tbody>{records.map((record) => <tr key={String(record.id)}>{columns.map((column) => <td className="management-detail-cell" key={column} title={formatValue(record[column])}>{formatValue(record[column])}</td>)}<td><button className="management-edit" onClick={() => openEdit(record)} type="button" aria-label="Editar registro">↗</button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      <div className="dashboard-table-footer admin-pagination">
        <span>{pagination.total} registro(s)</span>
        <nav className="dashboard-page-controls" aria-label="Paginação administrativa">
          <button disabled={page <= 1 || isLoading} onClick={() => setPage(1)} type="button">«</button>
          <button disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)} type="button">‹</button>
          <span>{pagination.totalPages ? `${page} / ${pagination.totalPages}` : '0 / 0'}</span>
          <button disabled={!pagination.hasMore || isLoading} onClick={() => setPage((current) => current + 1)} type="button">›</button>
          <button disabled={!pagination.hasMore || isLoading} onClick={() => setPage(pagination.totalPages)} type="button">»</button>
        </nav>
      </div>
    </section>
  )
}

export default AdminPanel
