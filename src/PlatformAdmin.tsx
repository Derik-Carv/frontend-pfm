import { useEffect, useState } from 'react'
import {
  getSystemMetrics,
  getSystemHierarchy,
  getAdminCompanyClients,
  type SystemHealth,
  type SystemStats,
  type HierarchyMother,
  type HierarchyBranch,
  type AdminClient,
} from './services/adminSystem'
import './PlatformAdmin.css'

type PlatformAdminProps = {
  token: string
  onLogout: () => void
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return '0s'
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function PlatformAdminDashboard({ token, onLogout }: PlatformAdminProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [mothers, setMothers] = useState<HierarchyMother[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Controle de expansão de Matrizes na cascata
  const [expandedMotherIds, setExpandedMotherIds] = useState<Set<string>>(new Set())

  // Modal para visualização de clientes da empresa/filial selecionada
  const [clientsModal, setClientsModal] = useState<{
    companyName: string
    companyId: string
    clients: AdminClient[]
    loading: boolean
    error: string
  } | null>(null)

  useEffect(() => {
    let active = true

    async function loadData() {
      setIsLoading(true)
      setError('')
      try {
        const [metricsRes, hierarchyRes] = await Promise.all([
          getSystemMetrics(token),
          getSystemHierarchy(token),
        ])
        if (!active) return
        setHealth(metricsRes.data.systemHealth)
        setStats(metricsRes.data.stats)
        setMothers(hierarchyRes.mothers)

        // Por padrão, se houver apenas uma matriz, já deixa expandida
        if (hierarchyRes.mothers.length === 1) {
          setExpandedMotherIds(new Set([hierarchyRes.mothers[0].id]))
        }
      } catch (err) {
        if (!active) return
        if (err instanceof Error && 'status' in err && err.status === 401) {
          onLogout()
          return
        }
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados da plataforma.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      active = false
    }
  }, [token, onLogout, refreshKey])

  function toggleMotherExpand(motherId: string) {
    setExpandedMotherIds((prev) => {
      const next = new Set(prev)
      if (next.has(motherId)) {
        next.delete(motherId)
      } else {
        next.add(motherId)
      }
      return next
    })
  }

  async function handleOpenClients(companyId: string, companyName: string) {
    setClientsModal({
      companyId,
      companyName,
      clients: [],
      loading: true,
      error: '',
    })

    try {
      const response = await getAdminCompanyClients(token, companyId)
      setClientsModal({
        companyId,
        companyName,
        clients: response.clients,
        loading: false,
        error: '',
      })
    } catch (err) {
      setClientsModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: err instanceof Error ? err.message : 'Não foi possível carregar os clientes.',
            }
          : null,
      )
    }
  }

  return (
    <div className="platform-admin-shell">
      <div className="platform-admin-header">
        <div>
          <p className="dashboard-card-index">PLATAFORMA SAAS · CENTRO DE COMANDO</p>
          <h2>Monitoramento Global & Gestão em Cascata</h2>
          <p className="platform-admin-subtitle">
            Visão consolidada de infraestrutura, telemetria em tempo real e hierarquia multi-tenant de todas as empresas.
          </p>
        </div>
        <button
          className="management-secondary"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={isLoading}
          type="button"
          title="Atualizar métricas e hierarquia"
        >
          {isLoading ? 'Atualizando...' : '↻ Atualizar'}
        </button>
      </div>

      {error && <div className="management-message is-error">{error}</div>}

      {/* 1. CARDS SUPERIORES: TELEMETRIA E SAÚDE DO SISTEMA */}
      <section className="platform-metrics-grid">
        {/* Status do Sistema */}
        <div className="platform-metric-card">
          <div className="platform-metric-header">
            <span className="platform-metric-title">Saúde do Sistema</span>
            <span className="platform-metric-icon">🟢</span>
          </div>
          <div className="platform-metric-value" style={{ color: '#10b981' }}>
            {health?.status ? health.status.toUpperCase() : 'OPERACIONAL'}
          </div>
          <div className="platform-metric-meta">
            Banco de Dados: <strong>{health?.databaseConnection ? 'Conectado' : 'Indisponível'}</strong>
          </div>
        </div>

        {/* Uptime Contínuo */}
        <div className="platform-metric-card">
          <div className="platform-metric-header">
            <span className="platform-metric-title">Tempo de Atividade (Uptime)</span>
            <span className="platform-metric-icon">⏱️</span>
          </div>
          <div className="platform-metric-value">
            {health ? formatUptime(health.uptimeSeconds) : '—'}
          </div>
          <div className="platform-metric-meta">
            Ambiente: <strong>{health?.environment || 'produção'}</strong>
          </div>
        </div>

        {/* Memória RAM */}
        <div className="platform-metric-card">
          <div className="platform-metric-header">
            <span className="platform-metric-title">Uso de Memória RAM</span>
            <span className="platform-metric-icon">💾</span>
          </div>
          <div className="platform-metric-value">
            {health?.memoryUsageMb ? `${health.memoryUsageMb} MB` : '—'}
          </div>
          <div className="platform-metric-meta">
            Processo Node.js Backend
          </div>
        </div>

        {/* Acessos Diários Estimados */}
        <div className="platform-metric-card">
          <div className="platform-metric-header">
            <span className="platform-metric-title">Acessos Estimados/Dia</span>
            <span className="platform-metric-icon">⚡</span>
          </div>
          <div className="platform-metric-value">
            {stats?.estimatedDailyAccess ? stats.estimatedDailyAccess.toLocaleString('pt-BR') : '—'}
          </div>
          <div className="platform-metric-meta">
            Total de Usuários Ativos: <strong>{stats?.totalUsers ?? '—'}</strong>
          </div>
        </div>

        {/* Total de Empresas na Plataforma */}
        <div className="platform-metric-card">
          <div className="platform-metric-header">
            <span className="platform-metric-title">Empresas na Plataforma</span>
            <span className="platform-metric-icon">🏢</span>
          </div>
          <div className="platform-metric-value">
            {stats?.totalCompanies ?? '—'}
          </div>
          <div className="platform-metric-meta">
            <strong>{stats?.totalMothers ?? 0} Matrizes</strong> · <strong>{stats?.totalBranches ?? 0} Filiais</strong>
          </div>
        </div>
      </section>

      {/* 2. ÁRVORE EM CASCATA: MATRIZ -> FILIAIS */}
      <section className="platform-cascade-section">
        <div className="platform-cascade-header">
          <div>
            <p className="dashboard-card-index">MULTI-TENANT HIERÁRQUICO</p>
            <h3>Árvore de Empresas Contratantes</h3>
          </div>
          <span className="platform-cascade-count">
            {mothers.length} {mothers.length === 1 ? 'Matriz cadastrada' : 'Matrizes cadastradas'}
          </span>
        </div>

        {isLoading ? (
          <div className="management-loading">Carregando hierarquia da plataforma...</div>
        ) : !mothers.length ? (
          <div className="management-empty">Nenhuma empresa matriz encontrada no sistema.</div>
        ) : (
          <div className="platform-tree">
            {mothers.map((mother) => {
              const isExpanded = expandedMotherIds.has(mother.id)
              const hasBranches = mother.branches && mother.branches.length > 0

              return (
                <div className={`platform-mother-card ${isExpanded ? 'is-expanded' : ''}`} key={mother.id}>
                  {/* Linha Principal da Matriz */}
                  <div
                    className="platform-mother-row"
                    onClick={() => toggleMotherExpand(mother.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleMotherExpand(mother.id)
                      }
                    }}
                  >
                    <div className="platform-mother-identity">
                      <span className={`table-chevron ${isExpanded ? 'is-open' : ''}`}>▶</span>
                      <span className="platform-mother-badge">Matriz</span>
                      <div className="platform-mother-names">
                        <strong>{mother.tradeName || mother.registeredCompanyName}</strong>
                        {mother.cnpj && <small>CNPJ: {mother.cnpj}</small>}
                      </div>
                    </div>

                    <div className="platform-mother-stats">
                      <div className="platform-stat-pill" title="Quantidade de Filiais vinculadas">
                        <span>Filiais:</span> <strong>{mother.branchesCount ?? mother.branches?.length ?? 0}</strong>
                      </div>
                      <div className="platform-stat-pill" title="Clientes cadastrados">
                        <span>Clientes:</span> <strong>{mother.clientsCount ?? 0}</strong>
                      </div>
                      <div className="platform-stat-pill" title="Serviços registrados">
                        <span>Serviços:</span> <strong>{mother.servicesCount ?? 0}</strong>
                      </div>
                      <div className="platform-stat-pill" title="Usuários com acesso">
                        <span>Usuários:</span> <strong>{mother.usersCount ?? 0}</strong>
                      </div>

                      <button
                        type="button"
                        className="platform-view-clients-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleOpenClients(mother.id, mother.tradeName || mother.registeredCompanyName)
                        }}
                      >
                        👥 Ver Clientes
                      </button>
                    </div>
                  </div>

                  {/* Filiais em Cascata (Expandido) */}
                  {isExpanded && (
                    <div className="platform-branches-container">
                      {!hasBranches ? (
                        <div className="platform-no-branches">
                          Nenhuma filial cadastrada para esta Matriz.
                        </div>
                      ) : (
                        <div className="platform-branches-list">
                          {mother.branches.map((branch: HierarchyBranch) => (
                            <div className="platform-branch-row" key={branch.id}>
                              <div className="platform-branch-identity">
                                <span className="platform-branch-arrow">↳</span>
                                <span className="platform-branch-badge">Filial</span>
                                <div className="platform-branch-names">
                                  <strong>{branch.tradeName}</strong>
                                  {branch.cnpj && <small>CNPJ: {branch.cnpj}</small>}
                                </div>
                              </div>

                              <div className="platform-branch-stats">
                                <div className="platform-stat-pill">
                                  <span>Clientes:</span> <strong>{branch.clientsCount ?? 0}</strong>
                                </div>
                                <div className="platform-stat-pill">
                                  <span>Serviços:</span> <strong>{branch.servicesCount ?? 0}</strong>
                                </div>
                                <div className="platform-stat-pill">
                                  <span>Usuários:</span> <strong>{branch.usersCount ?? 0}</strong>
                                </div>

                                <button
                                  type="button"
                                  className="platform-view-clients-btn"
                                  onClick={() => void handleOpenClients(branch.id, branch.tradeName)}
                                >
                                  👥 Ver Clientes
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3. MODAL: LISTAGEM DE CLIENTES DA FILIAL/MATRIZ SELECIONADA */}
      {clientsModal && (
        <div className="branch-modal-backdrop" onClick={() => setClientsModal(null)}>
          <div className="branch-modal platform-clients-modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <div>
                <p className="dashboard-card-index">CARTEIRA DE CLIENTES</p>
                <h3>{clientsModal.companyName}</h3>
              </div>
              <button
                type="button"
                className="branch-modal-close"
                onClick={() => setClientsModal(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {clientsModal.loading ? (
              <div className="management-loading">Consultando clientes da empresa...</div>
            ) : clientsModal.error ? (
              <div className="management-message is-error">{clientsModal.error}</div>
            ) : !clientsModal.clients.length ? (
              <div className="management-empty">Nenhum cliente vinculado diretamente a esta unidade.</div>
            ) : (
              <div className="platform-clients-table-scroll">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Nome Fantasia</th>
                      <th>Razão Social</th>
                      <th>Documento</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsModal.clients.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.tradeName}</strong></td>
                        <td>{c.registeredCompanyName || '—'}</td>
                        <td>{c.cnpj ? `CNPJ: ${c.cnpj}` : c.cpf ? `CPF: ${c.cpf}` : '—'}</td>
                        <td>
                          <span className={`management-status ${c.active ? 'is-active' : 'is-inactive'}`}>
                            {c.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
