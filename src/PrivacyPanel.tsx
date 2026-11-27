import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { notifyError, notifySuccess } from './services/toast'
import {
  anonymizeMyAccount,
  exportMyPrivacyData,
  getPrivacyMe,
  updateMyProfile,
  type PrivacyMeResponse,
} from './services/privacy'
import type { LegalDocKind } from './LegalDocumentsModal'
import './PrivacyPanel.css'

type PrivacyPanelProps = {
  token: string
  onLogout: () => void
  onOpenLegal: (doc: LegalDocKind) => void
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR')
}

const setError = (msg: string) => {
  if (msg) notifyError(msg)
}
const setNotice = (msg: string) => {
  if (msg) notifySuccess(msg)
}

export function PrivacyPanel({ token, onLogout, onOpenLegal }: PrivacyPanelProps) {
  const [data, setData] = useState<PrivacyMeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [anonPassword, setAnonPassword] = useState('')
  const [anonConfirm, setAnonConfirm] = useState('')
  const [anonymizing, setAnonymizing] = useState(false)

  const loadPrivacy = useCallback(async () => {
    try {
      const response = await getPrivacyMe(token)
      setData(response)
      setName(response.user.name)
      setSurname(response.user.surname)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados de privacidade.'
      if (/unauthorized|token|expirad/i.test(msg)) {
        onLogout()
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [token, onLogout])

  useEffect(() => {
    let active = true
    void getPrivacyMe(token)
      .then((response) => {
        if (!active) return
        setData(response)
        setName(response.user.name)
        setSurname(response.user.surname)
      })
      .catch((err) => {
        if (!active) return
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados de privacidade.'
        if (/unauthorized|token|expirad/i.test(msg)) {
          onLogout()
          return
        }
        setError(msg)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token, onLogout])

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    setError('')
    setNotice('')
    try {
      const res = await updateMyProfile(token, { name: name.trim(), surname: surname.trim() })
      setNotice(res.message)
      await loadPrivacy()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar dados pessoais.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleExportJson() {
    setExporting(true)
    setError('')
    setNotice('')
    try {
      const exported = await exportMyPrivacyData(token)
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `meus-dados-lgpd-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setNotice('Arquivo JSON de portabilidade gerado e baixado com sucesso (LGPD Art. 18).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar dados.')
    } finally {
      setExporting(false)
    }
  }

  async function handleAnonymize(event: FormEvent) {
    event.preventDefault()
    if (anonConfirm !== 'ANONIMIZAR') {
      setError('Digite exatamente ANONIMIZAR para confirmar.')
      return
    }
    setAnonymizing(true)
    setError('')
    setNotice('')
    try {
      const res = await anonymizeMyAccount(token, {
        currentPassword: anonPassword,
        confirmation: 'ANONIMIZAR',
      })
      alert(`${res.message}\n\n${res.fiscalRetentionNotice}`)
      onLogout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível anonimizar a conta.')
    } finally {
      setAnonymizing(false)
    }
  }

  return (
    <section className="privacy-shell">
      <div className="privacy-heading">
        <div>
          <p className="dashboard-eyebrow">TRANSPARÊNCIA &amp; DIREITOS DO TITULAR (ART. 18)</p>
          <h1>Minha Conta &amp; Privacidade (LGPD)</h1>
          <p className="dashboard-description">
            Consulte seus dados pessoais armazenados, corrija seu nome cadastral, baixe seus dados (portabilidade) e acompanhe seus aceites legais.
          </p>
        </div>
        <div className="privacy-actions-row">
          <button className="privacy-btn" onClick={() => onOpenLegal('privacy')} type="button">
            Política de Privacidade
          </button>
          <button className="privacy-btn" onClick={() => onOpenLegal('terms')} type="button">
            Termos de Uso
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="privacy-card"><p>Carregando informações de privacidade...</p></div>
      ) : data && (
        <div className="privacy-grid">
          <article className="privacy-card">
            <h3>1. Meus Dados Pessoais (Art. 18, I e II)</h3>
            <dl className="privacy-kv-list">
              <div><dt>Nome completo</dt><dd>{data.user.name} {data.user.surname}</dd></div>
              <div><dt>Usuário</dt><dd>{data.user.username}</dd></div>
              <div><dt>E-mail</dt><dd>{data.user.email || 'Não informado'} {data.user.emailVerified ? '✓' : ''}</dd></div>
              <div><dt>CPF (mascarado)</dt><dd>{data.user.cpfMasked}</dd></div>
              <div><dt>Perfil</dt><dd>{data.user.role}</dd></div>
              <div><dt>Cadastro em</dt><dd>{formatDateTime(data.user.createdAt)}</dd></div>
            </dl>
            <p>
              <strong>Empresas vinculadas ({data.companies.length}):</strong>{' '}
              {data.companies.length > 0
                ? data.companies.map((c) => c.tradeName).join(', ')
                : 'Nenhuma empresa vinculada (Admin SaaS)'}
            </p>
            <div className="privacy-actions-row">
              <button
                className="privacy-btn is-primary"
                disabled={exporting}
                onClick={() => void handleExportJson()}
                type="button"
              >
                {exporting ? 'Gerando JSON...' : 'Baixar meus dados (JSON)'}
              </button>
            </div>
          </article>

          <article className="privacy-card">
            <h3>2. Correção Cadastral (Art. 18, III)</h3>
            <p>
              Atualize seu nome e sobrenome sempre que necessário. Para alteração de e-mail ou permissões, contate o administrador da sua empresa.
            </p>
            <form className="privacy-form" onSubmit={handleSaveProfile}>
              <label>
                Nome
                <input minLength={2} maxLength={100} required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Sobrenome
                <input minLength={2} maxLength={100} required value={surname} onChange={(e) => setSurname(e.target.value)} />
              </label>
              <div className="privacy-actions-row">
                <button className="privacy-btn is-primary" disabled={savingProfile} type="submit">
                  {savingProfile ? 'Salvando...' : 'Salvar correção'}
                </button>
              </div>
            </form>
          </article>

          <article className="privacy-card">
            <h3>3. Histórico de Aceites &amp; Encarregado (DPO)</h3>
            <p>
              Encarregado de Dados (Art. 41): <strong>{data.legalMetadata.dpo.name}</strong> —{' '}
              <a href={`mailto:${data.legalMetadata.dpo.email}`}>{data.legalMetadata.dpo.email}</a>
            </p>
            {data.legalAcceptances.length === 0 ? (
              <p>Nenhum aceite registrado ainda para este usuário.</p>
            ) : (
              <ul className="privacy-acceptances-list">
                {data.legalAcceptances.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.documentType === 'terms_of_use' ? 'Termos de Uso' : 'Política de Privacidade'}</strong>{' '}
                      ({item.documentVersion})
                    </span>
                    <span>{formatDateTime(item.acceptedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="privacy-card is-danger">
            <h3>4. Anonimização &amp; Encerramento de Conta (Art. 18, VI)</h3>
            <p>
              Esta ação é <strong>irreversível</strong>: seu nome, e-mail, usuário e CPF serão anonimizados e seu acesso será desativado imediatamente. Conforme o <strong>Art. 16, I da LGPD</strong>, notas fiscais emitidas vinculadas à empresa permanecem preservadas por {data.legalMetadata.fiscalRetentionYears} anos para cumprimento de obrigação fiscal.
            </p>
            <form className="privacy-form" onSubmit={handleAnonymize}>
              <label>
                Senha atual
                <input
                  autoComplete="current-password"
                  required
                  type="password"
                  value={anonPassword}
                  onChange={(e) => setAnonPassword(e.target.value)}
                />
              </label>
              <label>
                Digite ANONIMIZAR para confirmar
                <input
                  placeholder="ANONIMIZAR"
                  required
                  value={anonConfirm}
                  onChange={(e) => setAnonConfirm(e.target.value)}
                />
              </label>
              <div className="privacy-actions-row">
                <button
                  className="privacy-btn is-danger"
                  disabled={anonymizing || anonConfirm !== 'ANONIMIZAR'}
                  type="submit"
                >
                  {anonymizing ? 'Anonimizando...' : 'Anonimizar e encerrar minha conta'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
    </section>
  )
}
