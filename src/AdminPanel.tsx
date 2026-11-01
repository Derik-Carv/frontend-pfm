import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest } from './services/api'
import './AdminPanel.css'

type AdminTable = 'roles' | 'users' | 'clients' | 'movimentations' | 'types' | 'status-services' | 'services' | 'notes' | 'bundled'
type StatusFilter = 'all' | 'active' | 'inactive'

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

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false }

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
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
  const [editor, setEditor] = useState<{ id?: string; value: string } | null>(null)
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
    setEditor({ value: '{\n  \n}' })
  }

  function openEdit(record: Record<string, unknown>) {
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) {
      setError('Este registro não possui um identificador editável.')
      return
    }
    setError('')
    setNotice('')
    setEditor({ id, value: JSON.stringify(record, null, 2) })
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    setIsSaving(true)
    setError('')
    setNotice('')
    let payload: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(editor.value)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('O conteúdo precisa ser um objeto JSON.')
      }
      payload = parsed as Record<string, unknown>
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'JSON inválido.')
      setIsSaving(false)
      return
    }

    try {
      const path = editor.id
        ? `/admin/data/${table}/${encodeURIComponent(editor.id)}`
        : `/admin/data/${table}`
      await apiRequest(path, {
        method: editor.id ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      setEditor(null)
      setNotice(editor.id ? 'Registro atualizado.' : 'Registro criado.')
      setPage(1)
      const query = new URLSearchParams({ page: '1', limit: '20', status })
      const refreshed = await apiRequest<AdminResponse>(`/admin/data/${table}?${query}`, { headers })
      setRecords(refreshed.records)
      setPagination(refreshed.pagination)
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
          <p>Gerencie registros do sistema com as mesmas regras da API.</p>
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
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
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
          <label className="admin-json-label" htmlFor="admin-json">JSON do registro</label>
          <textarea className="admin-json-editor" id="admin-json" onChange={(event) => setEditor({ ...editor, value: event.target.value })} spellCheck={false} value={editor.value} />
          <p className="management-hint">Não inclua <code>id</code>, <code>createdAt</code> ou <code>updatedAt</code>. Em usuários, a senha será protegida pelo backend.</p>
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
            <tbody>{records.map((record) => (
              <tr key={String(record.id)}>
                {columns.map((column) => <td className="management-detail-cell" key={column} title={formatValue(record[column])}>{formatValue(record[column])}</td>)}
                <td><button className="management-edit" onClick={() => openEdit(record)} type="button" aria-label="Editar registro">↗</button></td>
              </tr>
            ))}</tbody>
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
