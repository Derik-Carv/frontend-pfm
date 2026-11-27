import { useEffect, useRef, useState, type FormEvent } from 'react'
import { notifyError, notifySuccess } from './services/toast'
import {
  getMyCompanies,
  createBranch,
  type Company,
  type CompaniesMeResponse,
} from './services/companies'
import {
  getSelectedCompanyId,
  getViewScope,
  setTenantContext,
} from './services/api'
import './CompanySelector.css'

type CompanySelectorProps = {
  token: string
  role?: string
  onTenantChanged: () => void
  onLogout: () => void
}

const setModalError = (msg: string) => {
  if (msg) notifyError(msg)
}
const setModalSuccess = (msg: string) => {
  if (msg) notifySuccess(msg)
}

export function CompanySelector({
  token,
  role = '',
  onTenantChanged,
  onLogout,
}: CompanySelectorProps) {
  const [data, setData] = useState<CompaniesMeResponse | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedCompanyId = getSelectedCompanyId()
  const viewScope = getViewScope()

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Carregar empresas acessíveis
  useEffect(() => {
    let active = true

    async function loadCompanies() {
      try {
        const response = await getMyCompanies(token)
        if (!active) return
        setData(response)

        // Se ainda não houver empresa selecionada válida no localStorage, inicializa com a ativa do backend
        const storedCompanyId = getSelectedCompanyId()
        const isValidSelection = Boolean(storedCompanyId && response.companies.some((c) => c.id === storedCompanyId))
        if (!isValidSelection && response.activeCompanyId) {
          setTenantContext(response.activeCompanyId, 'single')
          onTenantChanged()
        }
      } catch (err) {
        if (err instanceof Error && 'status' in err && err.status === 401) {
          onLogout()
        }
      }
    }

    void loadCompanies()
    return () => {
      active = false
    }
  }, [token, onLogout])

  const motherCompany = data?.companies.find((c) => !c.motherId) || data?.companies[0]
  const isMotherUser = data?.isMother ?? Boolean(motherCompany && !motherCompany.motherId)
  const canCreateBranch = role === 'company_admin' && isMotherUser

  // Nome exibido no botão do seletor
  let currentLabel = 'Carregando unidades...'
  let currentIcon = '🏢'

  if (viewScope === 'consolidated') {
    currentLabel = 'Todas as Unidades (Consolidado)'
    currentIcon = '🌐'
  } else if (data) {
    const current = data.companies.find((c) => c.id === selectedCompanyId)
    if (current) {
      currentLabel = current.tradeName || current.registeredCompanyName
      currentIcon = current.motherId ? '📍' : '🏢'
    } else if (motherCompany) {
      currentLabel = motherCompany.tradeName || motherCompany.registeredCompanyName
      currentIcon = '🏢'
    }
  }

  function handleSelectConsolidated() {
    if (!motherCompany) return
    setTenantContext(motherCompany.id, 'consolidated')
    setIsOpen(false)
    onTenantChanged()
  }

  function handleSelectCompany(company: Company) {
    setTenantContext(company.id, 'single')
    setIsOpen(false)
    onTenantChanged()
  }

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!motherCompany) return
    setIsSaving(true)
    setModalError('')
    setModalSuccess('')

    const formData = new FormData(event.currentTarget)
    const payload = {
      registeredCompanyName: String(formData.get('registeredCompanyName') ?? '').trim(),
      tradeName: String(formData.get('tradeName') ?? '').trim(),
      cnpj: String(formData.get('cnpj') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim() || undefined,
      phone: String(formData.get('phone') ?? '').trim() || undefined,
    }

    try {
      const response = await createBranch(token, motherCompany.id, payload)
      setModalSuccess(`Filial "${response.company.tradeName}" cadastrada com sucesso!`)
      // Recarrega a lista de empresas
      const updated = await getMyCompanies(token)
      setData(updated)
      setTimeout(() => {
        setIsModalOpen(false)
        setModalSuccess('')
      }, 1500)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erro ao cadastrar filial.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="company-selector-container" ref={menuRef}>
      <button
        type="button"
        className="company-selector-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Alternar unidade ou filial"
      >
        <span className="company-selector-icon">{currentIcon}</span>
        <span>{currentLabel}</span>
        <span className={`company-selector-arrow ${isOpen ? 'is-open' : ''}`}>▼</span>
      </button>

      {isOpen && data && (
        <div className="company-dropdown-menu" role="listbox">
          <div className="company-dropdown-header">Escopo de Operação</div>

          <div className="company-dropdown-list">
            {isMotherUser && (
              <button
                type="button"
                className={`company-dropdown-item ${viewScope === 'consolidated' ? 'is-selected' : ''}`}
                onClick={handleSelectConsolidated}
              >
                <div className="company-dropdown-item-info">
                  <span className="company-dropdown-item-title">
                    <span>🌐</span> Todas as Unidades
                  </span>
                  <span className="company-dropdown-item-cnpj">Visão consolidada (Matriz + Filiais)</span>
                </div>
                {viewScope === 'consolidated' && <span>✓</span>}
              </button>
            )}

            {data.companies.map((company) => {
              const isSelected = viewScope === 'single' && selectedCompanyId === company.id
              const isMother = !company.motherId
              return (
                <button
                  key={company.id}
                  type="button"
                  className={`company-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectCompany(company)}
                >
                  <div className="company-dropdown-item-info">
                    <span className="company-dropdown-item-title">
                      <span>{isMother ? '🏢' : '📍'}</span>
                      {company.tradeName || company.registeredCompanyName}
                    </span>
                    {company.cnpj && (
                      <span className="company-dropdown-item-cnpj">
                        CNPJ: {company.cnpj} {isMother ? '(Matriz)' : '(Filial)'}
                      </span>
                    )}
                  </div>
                  {isSelected && <span>✓</span>}
                </button>
              )
            })}
          </div>

          {canCreateBranch && (
            <>
              <div className="company-dropdown-divider" />
              <button
                type="button"
                className="company-dropdown-action"
                onClick={() => {
                  setIsOpen(false)
                  setModalError('')
                  setModalSuccess('')
                  setIsModalOpen(true)
                }}
              >
                <span>➕</span> Cadastrar Nova Filial
              </button>
            </>
          )}
        </div>
      )}

      {/* Modal de Cadastro de Filial */}
      {isModalOpen && (
        <div className="branch-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="branch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <h3>Cadastrar Nova Filial</h3>
              <button
                type="button"
                className="branch-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form className="branch-form" onSubmit={handleCreateBranch}>
              <label>
                Razão Social da Filial
                <input name="registeredCompanyName" required placeholder="Ex: Filial Rio de Janeiro LTDA" />
              </label>

              <label>
                Nome Fantasia
                <input name="tradeName" required placeholder="Ex: Filial RJ" />
              </label>

              <label>
                CNPJ
                <input name="cnpj" required maxLength={18} placeholder="00.000.000/0000-00" />
              </label>

              <label>
                E-mail (Opcional)
                <input name="email" type="email" placeholder="financeiro.rj@empresa.com" />
              </label>

              <label>
                Telefone (Opcional)
                <input name="phone" placeholder="(21) 99999-9999" />
              </label>

              <div className="branch-form-actions">
                <button
                  type="button"
                  className="management-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="management-primary" disabled={isSaving}>
                  {isSaving ? 'Cadastrando...' : 'Cadastrar Filial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
