import { useEffect, useState, type FormEvent } from 'react'
import {
  getMyCompanies,
  listBranches,
  createBranch,
  updateBranchCompany,
  getCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  type Company,
  type CompanyUser,
} from './services/companies'
import './CompanyManagementPanel.css'

type CompanyManagementProps = {
  token: string
  onLogout: () => void
  onCompanyChanged: () => void
}

type CompanySubTab = 'branches' | 'users'
type CompanyRoleOption = 'company_admin' | 'manager' | 'finance' | 'observer' | 'colaborator'

const roleLabels: Record<string, string> = {
  company_admin: 'Administrador da Empresa',
  manager: 'Gerente Operacional',
  finance: 'Financeiro',
  observer: 'Observador (Leitura)',
  colaborator: 'Colaborador (Campo)',
}

function slugifyPreview(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'empresa'
}

export function CompanyManagementPanel({
  token,
  onLogout,
  onCompanyChanged,
}: CompanyManagementProps) {
  const [subTab, setSubTab] = useState<CompanySubTab>('branches')
  const [motherCompany, setMotherCompany] = useState<Company | null>(null)
  const [accessibleCompanies, setAccessibleCompanies] = useState<Company[]>([])
  const [branches, setBranches] = useState<Company[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Modal de nova filial
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false)
  const [isSavingBranch, setIsSavingBranch] = useState(false)

  // Modal de criação/edição de usuário
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null)
  const [userRoleInput, setUserRoleInput] = useState<CompanyRoleOption>('manager')
  const [userCompanyInput, setUserCompanyInput] = useState('')
  const [isSavingUser, setIsSavingUser] = useState(false)

  useEffect(() => {
    let active = true

    async function loadData() {
      setIsLoading(true)
      setError('')
      try {
        const [meRes, branchesRes, usersRes] = await Promise.all([
          getMyCompanies(token),
          listBranches(token),
          getCompanyUsers(token),
        ])
        if (!active) return

        const mother = meRes.companies.find((c) => !c.motherId) || meRes.companies[0] || null
        setMotherCompany(mother)
        setAccessibleCompanies(meRes.companies)
        setBranches(branchesRes.companies)
        setUsers(usersRes.users)
      } catch (err) {
        if (!active) return
        if (err instanceof Error && 'status' in err && err.status === 401) {
          onLogout()
          return
        }
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados da empresa.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      active = false
    }
  }, [token, onLogout, refreshKey])

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!motherCompany) return

    setIsSavingBranch(true)
    setError('')
    setNotice('')

    const formData = new FormData(event.currentTarget)
    try {
      const response = await createBranch(token, motherCompany.id, {
        registeredCompanyName: String(formData.get('registeredCompanyName') ?? '').trim(),
        tradeName: String(formData.get('tradeName') ?? '').trim(),
        cnpj: String(formData.get('cnpj') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim() || undefined,
        phone: String(formData.get('phone') ?? '').trim() || undefined,
      })
      setIsBranchModalOpen(false)
      setNotice(`Filial "${response.company.tradeName}" cadastrada com sucesso.`)
      setRefreshKey((k) => k + 1)
      onCompanyChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar a filial.')
    } finally {
      setIsSavingBranch(false)
    }
  }

  async function handleToggleBranchActive(branch: Company) {
    setError('')
    setNotice('')
    try {
      await updateBranchCompany(token, branch.id, { active: !branch.active })
      setNotice(`Filial "${branch.tradeName}" ${branch.active ? 'desativada' : 'reativada'}.`)
      setRefreshKey((k) => k + 1)
      onCompanyChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a filial.')
    }
  }

  function openCreateUser() {
    setEditingUser(null)
    setUserRoleInput('manager')
    setUserCompanyInput(motherCompany?.id ?? accessibleCompanies[0]?.id ?? '')
    setIsUserModalOpen(true)
  }

  function openEditUser(user: CompanyUser) {
    setEditingUser(user)
    setUserRoleInput((user.roleName as CompanyRoleOption) || 'manager')
    setUserCompanyInput(user.primaryCompanyId ?? motherCompany?.id ?? '')
    setIsUserModalOpen(true)
  }

  async function handleSubmitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingUser(true)
    setError('')
    setNotice('')

    const formData = new FormData(event.currentTarget)

    try {
      if (editingUser) {
        const passwordVal = String(formData.get('password') ?? '').trim()
        const emailVal = String(formData.get('email') ?? '').trim().toLowerCase()
        await updateCompanyUser(token, editingUser.id, {
          name: String(formData.get('name') ?? '').trim(),
          surname: String(formData.get('surname') ?? '').trim(),
          ...(emailVal ? { email: emailVal } : {}),
          roleName: userRoleInput,
          companyId: userCompanyInput || undefined,
          ...(passwordVal ? { password: passwordVal } : {}),
        })
        setNotice(`Conta "${editingUser.username}" atualizada com sucesso.`)
      } else {
        const usernameVal = String(formData.get('username') ?? '').trim()
        const res = await createCompanyUser(token, {
          name: String(formData.get('name') ?? '').trim(),
          surname: String(formData.get('surname') ?? '').trim(),
          email: String(formData.get('email') ?? '').trim().toLowerCase(),
          cpf: String(formData.get('cpf') ?? '').trim(),
          password: String(formData.get('password') ?? ''),
          roleName: userRoleInput,
          companyId: userCompanyInput || undefined,
          ...(usernameVal ? { username: usernameVal } : {}),
        })
        setNotice(`Conta "${res.user.username}" criada com senha provisória.`)
      }
      setIsUserModalOpen(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a conta.')
    } finally {
      setIsSavingUser(false)
    }
  }

  async function handleToggleUserActive(user: CompanyUser) {
    setError('')
    setNotice('')
    try {
      await updateCompanyUser(token, user.id, { active: !user.active })
      setNotice(`Usuário "${user.username}" ${user.active ? 'desativado' : 'reativado'}.`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o status do usuário.')
    }
  }

  const allCompanyOptions = motherCompany
    ? [motherCompany, ...branches.filter((b) => b.id !== motherCompany.id)]
    : accessibleCompanies

  const selectedTargetCompany = allCompanyOptions.find((c) => c.id === userCompanyInput)
  const adminUsernameHint = selectedTargetCompany
    ? `administrator.${slugifyPreview(selectedTargetCompany.tradeName)}`
    : 'administrator.empresa'

  return (
    <section className="company-mgmt-shell" aria-labelledby="company-mgmt-title">
      <header className="management-heading">
        <div>
          <p className="dashboard-card-index">
            ADMINISTRAÇÃO DA EMPRESA · {motherCompany?.tradeName || 'MATRIZ'}
          </p>
          <h2 id="company-mgmt-title">Gestão de Filiais & Contas</h2>
          <p>
            Administre suas unidades vinculadas e gerencie os acessos da sua equipe sem sair do contexto da empresa.
          </p>
        </div>

        <div className="management-actions">
          <div className="company-mgmt-tabs" role="tablist" aria-label="Subáreas da empresa">
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'branches'}
              className={`company-mgmt-tab ${subTab === 'branches' ? 'is-active' : ''}`}
              onClick={() => setSubTab('branches')}
            >
              📍 Filiais ({branches.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'users'}
              className={`company-mgmt-tab ${subTab === 'users' ? 'is-active' : ''}`}
              onClick={() => setSubTab('users')}
            >
              👥 Equipe & Contas ({users.length})
            </button>
          </div>

          {subTab === 'branches' ? (
            <button
              type="button"
              className="management-primary"
              onClick={() => setIsBranchModalOpen(true)}
              disabled={!motherCompany}
            >
              + Nova Filial
            </button>
          ) : (
            <button
              type="button"
              className="management-primary"
              onClick={openCreateUser}
              disabled={!allCompanyOptions.length}
            >
              + Novo Usuário
            </button>
          )}
        </div>
      </header>

      {error && <div className="management-message is-error" role="alert">{error}</div>}
      {notice && <div className="management-message is-success" role="status">{notice}</div>}

      {isLoading ? (
        <div className="management-loading">Carregando estrutura da empresa...</div>
      ) : subTab === 'branches' ? (
        <div className="company-mgmt-card">
          {motherCompany && (
            <div className="company-mgmt-mother-banner">
              <div>
                <span className="platform-mother-badge">Matriz Principal</span>
                <h3>{motherCompany.tradeName}</h3>
                <p>{motherCompany.registeredCompanyName} · CNPJ: {motherCompany.cnpj || '—'}</p>
              </div>
              <span className={`management-status ${motherCompany.active ? 'is-active' : 'is-inactive'}`}>
                {motherCompany.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
          )}

          {!branches.length ? (
            <div className="management-empty">
              Nenhuma filial cadastrada até o momento. Clique em <strong>+ Nova Filial</strong> para adicionar uma unidade.
            </div>
          ) : (
            <div className="management-table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Nome Fantasia</th>
                    <th>Razão Social</th>
                    <th>CNPJ</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id}>
                      <td><strong>{branch.tradeName}</strong></td>
                      <td>{branch.registeredCompanyName}</td>
                      <td>{branch.cnpj || '—'}</td>
                      <td>
                        <span className={`management-status ${branch.active ? 'is-active' : 'is-inactive'}`}>
                          {branch.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="management-secondary company-mgmt-action-btn"
                          onClick={() => void handleToggleBranchActive(branch)}
                        >
                          {branch.active ? 'Desativar' : 'Reativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="company-mgmt-card">
          {!users.length ? (
            <div className="management-empty">
              Nenhuma conta cadastrada para esta empresa além da conta raiz.
            </div>
          ) : (
            <div className="management-table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Unidade</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.username}</strong></td>
                      <td>{u.name} {u.surname}</td>
                      <td>{u.email || 'Sem e-mail'}</td>
                      <td>{roleLabels[u.roleName] || u.roleName}</td>
                      <td>{u.companyName || 'Matriz'}</td>
                      <td>
                        <span className={`management-status ${u.active ? 'is-active' : 'is-inactive'}`}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className="company-mgmt-row-actions">
                          <button
                            type="button"
                            className="management-secondary company-mgmt-action-btn"
                            onClick={() => openEditUser(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="management-secondary company-mgmt-action-btn"
                            onClick={() => void handleToggleUserActive(u)}
                          >
                            {u.active ? 'Desativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Nova Filial */}
      {isBranchModalOpen && (
        <div className="branch-modal-backdrop" onClick={() => setIsBranchModalOpen(false)}>
          <div className="branch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <h3>Cadastrar Nova Filial</h3>
              <button
                type="button"
                className="branch-modal-close"
                onClick={() => setIsBranchModalOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form className="branch-form" onSubmit={handleCreateBranch}>
              <label>
                Razão Social *
                <input name="registeredCompanyName" required placeholder="Ex.: Filial Norte LTDA" />
              </label>
              <label>
                Nome Fantasia *
                <input name="tradeName" required placeholder="Ex.: Filial Norte" />
              </label>
              <label>
                CNPJ *
                <input name="cnpj" required maxLength={18} placeholder="00.000.000/0000-00" />
              </label>
              <label>
                E-mail (Opcional)
                <input name="email" type="email" placeholder="unidade@empresa.com" />
              </label>
              <label>
                Telefone (Opcional)
                <input name="phone" placeholder="(11) 99999-9999" />
              </label>

              <div className="branch-form-actions">
                <button
                  type="button"
                  className="management-secondary"
                  onClick={() => setIsBranchModalOpen(false)}
                  disabled={isSavingBranch}
                >
                  Cancelar
                </button>
                <button type="submit" className="management-primary" disabled={isSavingBranch}>
                  {isSavingBranch ? 'Salvando...' : 'Cadastrar Filial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar / Editar Usuário */}
      {isUserModalOpen && (
        <div className="branch-modal-backdrop" onClick={() => setIsUserModalOpen(false)}>
          <div className="branch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <h3>{editingUser ? `Editar ${editingUser.username}` : 'Novo Usuário da Empresa'}</h3>
              <button
                type="button"
                className="branch-modal-close"
                onClick={() => setIsUserModalOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form className="branch-form" onSubmit={handleSubmitUser}>
              <label>
                Nome *
                <input name="name" required defaultValue={editingUser?.name ?? ''} />
              </label>
              <label>
                Sobrenome *
                <input name="surname" required defaultValue={editingUser?.surname ?? ''} />
              </label>
              <label>
                E-mail *
                <input
                  name="email"
                  type="email"
                  required={!editingUser}
                  defaultValue={editingUser?.email ?? ''}
                  placeholder="usuario@empresa.com"
                />
              </label>
              {!editingUser && (
                <label>
                  CPF (11 dígitos) *
                  <input name="cpf" required maxLength={14} placeholder="000.000.000-00" />
                </label>
              )}
              <label>
                Perfil de Acesso *
                <select
                  value={userRoleInput}
                  onChange={(e) => setUserRoleInput(e.target.value as CompanyRoleOption)}
                >
                  <option value="company_admin">Administrador da Empresa</option>
                  <option value="manager">Gerente Operacional</option>
                  <option value="finance">Financeiro</option>
                  <option value="observer">Observador (Somente Leitura)</option>
                  <option value="colaborator">Colaborador (Campo / Restrito)</option>
                </select>
              </label>
              <label>
                Unidade Principal *
                <select
                  value={userCompanyInput}
                  onChange={(e) => setUserCompanyInput(e.target.value)}
                >
                  {allCompanyOptions.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.tradeName} {!comp.motherId ? '(Matriz)' : '(Filial)'}
                    </option>
                  ))}
                </select>
              </label>
              {!editingUser && (
                <label>
                  Usuário (Opcional — gerado automaticamente se vazio)
                  <input
                    name="username"
                    placeholder={userRoleInput === 'company_admin' ? adminUsernameHint : 'nome.sobrenome'}
                  />
                </label>
              )}
              <label>
                {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha Provisória *'}
                <input
                  name="password"
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  placeholder={editingUser ? 'Opcional' : 'Mínimo 6 caracteres'}
                />
              </label>

              <div className="branch-form-actions">
                <button
                  type="button"
                  className="management-secondary"
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={isSavingUser}
                >
                  Cancelar
                </button>
                <button type="submit" className="management-primary" disabled={isSavingUser}>
                  {isSavingUser ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
