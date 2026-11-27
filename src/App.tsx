import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiRequest, clearTenantContext } from './services/api'
import { acceptLegalDocuments, getPrivacyMe, getPublicLegalMetadata } from './services/privacy'
import { notifyError, notifySuccess } from './services/toast'
import { LegalDocumentsModal, type LegalDocKind } from './LegalDocumentsModal'
import Dashboard from './Dashboard'
import './App.css'

type Screen = 'login' | 'register' | 'forgot'
type Theme = 'dark' | 'light'

type CompanyRequestDraft = {
  registeredCompanyName: string
  tradeName: string
  cnpj: string
  phone?: string
  adminName: string
  adminSurname: string
  adminEmail: string
  adminCpf: string
  adminPassword: string
  acceptedTerms: true
  acceptedPrivacy: true
}

type CompanyRequestResponse = {
  message: string
  request: {
    id: string
    tradeName: string
    adminEmail: string
    status: string
  }
}

function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('theme') === 'light' ? 'light' : 'dark',
  )
  const [screen, setScreen] = useState<Screen>('login')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(() => localStorage.getItem('passwordChangeRequired') === 'true')
  const [legalAcceptanceRequired, setLegalAcceptanceRequired] = useState(() => localStorage.getItem('legalAcceptanceRequired') === 'true')
  const [legalModalDoc, setLegalModalDoc] = useState<LegalDocKind | null>(null)
  const [legalAgreeChecked, setLegalAgreeChecked] = useState(false)
  const [dpoEmail, setDpoEmail] = useState('')

  useEffect(() => {
    let active = true
    void getPublicLegalMetadata()
      .then((meta) => {
        if (active && meta.dpo?.email) setDpoEmail(meta.dpo.email)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Fluxo de solicitação de empresa em 2 etapas (dados -> código OTP no e-mail do admin)
  const [registerStep, setRegisterStep] = useState<'form' | 'code'>('form')
  const [companyDraft, setCompanyDraft] = useState<CompanyRequestDraft | null>(null)
  const [registerCode, setRegisterCode] = useState('')

  // Fluxo de recuperação de senha em 2 etapas (e-mail -> código OTP + nova senha)
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email')
  const [forgotEmail, setForgotEmail] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  function showMessage(text: string, error = false) {
    if (!text.trim()) return
    if (error) {
      notifyError(text)
    } else {
      notifySuccess(text)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const loginUsername = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    try {
      const result = await apiRequest<{
        message: string
        token: string
        passwordChangeRequired: boolean
        legalAcceptanceRequired?: boolean
      }>(
        '/public/login',
        {
          method: 'POST',
          body: JSON.stringify({ username: loginUsername, password }),
        },
      )
      clearTenantContext()
      localStorage.setItem('token', result.token)
      setToken(result.token)
      setUsername(loginUsername)
      setPasswordChangeRequired(result.passwordChangeRequired)
      localStorage.setItem('passwordChangeRequired', String(result.passwordChangeRequired))
      const needsLegal = Boolean(result.legalAcceptanceRequired)
      setLegalAcceptanceRequired(needsLegal)
      localStorage.setItem('legalAcceptanceRequired', String(needsLegal))
      setLegalAgreeChecked(false)
      showMessage(result.passwordChangeRequired
        ? 'Por segurança, defina uma nova senha antes de acessar o painel.'
        : needsLegal
          ? 'Confirme a leitura dos Termos de Uso e Política de Privacidade (LGPD).'
          : 'Login realizado com sucesso.')
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRequestCompanyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const phoneVal = String(formData.get('phone') ?? '').trim()
    const acceptedLegal = formData.get('acceptedLegal') === 'on'
    if (!acceptedLegal) {
      setIsLoading(false)
      showMessage('É obrigatório aceitar os Termos de Uso e a Política de Privacidade (LGPD).', true)
      return
    }
    const draft: CompanyRequestDraft = {
      registeredCompanyName: String(formData.get('registeredCompanyName') ?? '').trim(),
      tradeName: String(formData.get('tradeName') ?? '').trim(),
      cnpj: String(formData.get('cnpj') ?? '').trim(),
      ...(phoneVal ? { phone: phoneVal } : {}),
      adminName: String(formData.get('adminName') ?? '').trim(),
      adminSurname: String(formData.get('adminSurname') ?? '').trim(),
      adminEmail: String(formData.get('adminEmail') ?? '').trim().toLowerCase(),
      adminCpf: String(formData.get('adminCpf') ?? '').trim(),
      adminPassword: String(formData.get('adminPassword') ?? ''),
      acceptedTerms: true,
      acceptedPrivacy: true,
    }

    try {
      await apiRequest<{ message: string; expiresInMinutes: number }>('/public/company-requests/request-code', {
        method: 'POST',
        body: JSON.stringify({
          email: draft.adminEmail,
          cnpj: draft.cnpj,
          name: draft.adminName,
        }),
      })
      setCompanyDraft(draft)
      setRegisterCode('')
      setRegisterStep('code')
      showMessage(`Código de verificação enviado para ${draft.adminEmail}. Válido por 15 minutos.`)
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível enviar o código de verificação.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendCompanyCode() {
    if (!companyDraft) return
    setIsLoading(true)
    showMessage('')
    try {
      await apiRequest<{ message: string; expiresInMinutes: number }>('/public/company-requests/request-code', {
        method: 'POST',
        body: JSON.stringify({
          email: companyDraft.adminEmail,
          cnpj: companyDraft.cnpj,
          name: companyDraft.adminName,
        }),
      })
      showMessage(`Novo código enviado para ${companyDraft.adminEmail}.`)
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível reenviar o código.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmitCompanyRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!companyDraft) return
    setIsLoading(true)
    showMessage('')

    try {
      await apiRequest<CompanyRequestResponse>('/public/company-requests', {
        method: 'POST',
        body: JSON.stringify({ ...companyDraft, code: registerCode.trim() }),
      })
      setUsername(companyDraft.adminEmail)
      setCompanyDraft(null)
      setRegisterCode('')
      setRegisterStep('form')
      setScreen('login')
      showMessage('Solicitação enviada! Seu cadastro está aguardando aprovação do administrador da plataforma. Você receberá um e-mail assim que for aprovado.')
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível validar o código ou enviar a solicitação.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleForgotSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()

    try {
      const result = await apiRequest<{ message: string; expiresInMinutes: number }>('/public/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setForgotEmail(email)
      setForgotStep('reset')
      showMessage(result.message)
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível solicitar o código.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendForgotCode() {
    if (!forgotEmail) return
    setIsLoading(true)
    showMessage('')
    try {
      const result = await apiRequest<{ message: string; expiresInMinutes: number }>('/public/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      })
      showMessage(result.message)
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível reenviar o código.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const code = String(formData.get('code') ?? '').trim()
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (newPassword !== confirmPassword) {
      showMessage('A confirmação não corresponde à nova senha.', true)
      setIsLoading(false)
      return
    }

    try {
      await apiRequest<{ message: string }>('/public/password/reset', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, code, newPassword }),
      })
      setUsername(forgotEmail)
      setForgotEmail('')
      setForgotStep('email')
      setScreen('login')
      showMessage('Senha redefinida com sucesso. Já pode entrar com a nova senha.')
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível redefinir a senha.',
        true,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const currentPassword = String(formData.get('currentPassword') ?? '')
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirmation = String(formData.get('confirmPassword') ?? '')

    if (newPassword !== confirmation) {
      showMessage('A confirmação não corresponde à nova senha.', true)
      setIsLoading(false)
      return
    }
    if (newPassword === currentPassword) {
      showMessage('A nova senha precisa ser diferente da senha atual.', true)
      setIsLoading(false)
      return
    }

    try {
      const result = await apiRequest<{ message: string; passwordChangeRequired: boolean; token?: string }>(
        '/account/password',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      )
      if (result.token) {
        localStorage.setItem('token', result.token)
        setToken(result.token)
      }
      setPasswordChangeRequired(false)
      localStorage.removeItem('passwordChangeRequired')
      showMessage('Senha alterada. O painel está liberado.')
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401 && error.message.includes('Unauthorized')) {
        handleLogout()
        return
      }
      showMessage(error instanceof Error ? error.message : 'Não foi possível alterar a senha.', true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = useCallback(() => {
    clearTenantContext()
    localStorage.removeItem('token')
    localStorage.removeItem('passwordChangeRequired')
    localStorage.removeItem('legalAcceptanceRequired')
    setToken(null)
    setPasswordChangeRequired(false)
    setLegalAcceptanceRequired(false)
    setScreen('login')
    showMessage('Você saiu da sua conta.')
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true
    void getPrivacyMe(token)
      .then((me) => {
        if (!active) return
        const needsPassword = Boolean(me.user.passwordChangeRequired)
        const needsLegal = Boolean(me.legalAcceptanceRequired)
        setPasswordChangeRequired(needsPassword)
        localStorage.setItem('passwordChangeRequired', String(needsPassword))
        setLegalAcceptanceRequired(needsLegal)
        localStorage.setItem('legalAcceptanceRequired', String(needsLegal))
      })
      .catch((error) => {
        if (!active) return
        if (error instanceof Error && 'status' in error && error.status === 401) {
          handleLogout()
        }
      })
    return () => {
      active = false
    }
  }, [token, handleLogout])

  async function handleAcceptLegalGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !legalAgreeChecked) return
    setIsLoading(true)
    showMessage('')
    try {
      await acceptLegalDocuments(token)
      setLegalAcceptanceRequired(false)
      localStorage.setItem('legalAcceptanceRequired', 'false')
      showMessage('Aceite registrado com sucesso.')
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401) {
        handleLogout()
        return
      }
      showMessage(error instanceof Error ? error.message : 'Não foi possível registrar o aceite.', true)
    } finally {
      setIsLoading(false)
    }
  }

  const headingEyebrow = screen === 'login'
    ? 'BEM-VINDO DE VOLTA'
    : screen === 'register'
      ? (registerStep === 'form' ? 'SOLICITAÇÃO EMPRESARIAL' : 'CONFIRMAÇÃO POR E-MAIL')
      : 'RECUPERAÇÃO DE ACESSO'

  const headingTitle = screen === 'login'
    ? 'Entre na sua conta'
    : screen === 'register'
      ? (registerStep === 'form' ? 'Solicitar cadastro' : 'Valide seu e-mail')
      : 'Redefinir senha'

  const headingSubtitle = screen === 'login'
    ? 'Acesse seu espaço financeiro.'
    : screen === 'register'
      ? (registerStep === 'form'
          ? 'Cadastre os dados da sua empresa e do administrador responsável. O acesso é liberado após aprovação do Admin SaaS.'
          : `Digite o código enviado para ${companyDraft?.adminEmail || 'seu e-mail'} para enviar a solicitação.`)
      : (forgotStep === 'email'
          ? 'Informe seu e-mail cadastrado para receber o código de recuperação.'
          : `Digite o código enviado para ${forgotEmail} e escolha a nova senha.`)

  return (
    <>
      {token && !passwordChangeRequired && !legalAcceptanceRequired ? (
        <Dashboard onLogout={handleLogout} onThemeChange={setTheme} theme={theme} token={token} />
      ) : token && !passwordChangeRequired && legalAcceptanceRequired ? (
        <main className="auth-shell">
          <div className="theme-switch" role="group" aria-label="Tema da tela">
            <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} type="button">Escuro</button>
            <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')} type="button">Claro</button>
          </div>
          <section className="form-panel">
            <div className="form-wrap">
              <div className="form-heading">
                <p className="eyebrow">CONFORMIDADE LGPD</p>
                <h2>Termos e Privacidade</h2>
                <p>Para continuar usando o painel, confirme ciência da Política de Privacidade e dos Termos de Uso vigentes.</p>
              </div>
              <form className="auth-form" onSubmit={handleAcceptLegalGate}>
                <label className="legal-consent-box">
                  <input
                    checked={legalAgreeChecked}
                    onChange={(e) => setLegalAgreeChecked(e.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span>
                    Li e aceito os{' '}
                    <button className="text-button" onClick={() => setLegalModalDoc('terms')} type="button">
                      Termos de Uso &amp; DPA
                    </button>{' '}
                    e a{' '}
                    <button className="text-button" onClick={() => setLegalModalDoc('privacy')} type="button">
                      Política de Privacidade (LGPD)
                    </button>.
                  </span>
                </label>
                <button className="submit-button" disabled={isLoading || !legalAgreeChecked} type="submit">
                  {isLoading ? 'Registrando aceite...' : 'Aceitar e acessar o painel'}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
              <button className="text-button password-logout" onClick={handleLogout} type="button">Sair</button>
            </div>
          </section>
        </main>
      ) : token ? (
    <main className="auth-shell">
      <div className="theme-switch" role="group" aria-label="Tema da tela">
        <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} type="button">Escuro</button>
        <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')} type="button">Claro</button>
      </div>
      <section className="form-panel">
        <div className="form-wrap">
          <div className="form-heading">
            <p className="eyebrow">PRIMEIRO ACESSO</p>
            <h2>Troque sua senha</h2>
            <p>Por segurança, atualize a senha temporária para continuar ao painel.</p>
          </div>
          <form className="auth-form" onSubmit={handlePasswordChange}>
            <label htmlFor="current-password">Senha atual</label>
            <input autoComplete="current-password" id="current-password" name="currentPassword" required type="password" />
            <label htmlFor="new-password">Nova senha</label>
            <input autoComplete="new-password" id="new-password" maxLength={100} minLength={8} name="newPassword" required type="password" />
            <label htmlFor="confirm-password">Confirme a nova senha</label>
            <input autoComplete="new-password" id="confirm-password" maxLength={100} minLength={8} name="confirmPassword" required type="password" />
            <p className="password-guidance">Use de 8 a 100 caracteres. A nova senha deve ser diferente da atual.</p>
            <button className="submit-button" disabled={isLoading} type="submit">
              {isLoading ? 'Atualizando...' : 'Atualizar senha'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <button className="text-button password-logout" onClick={handleLogout} type="button">Sair</button>
        </div>
      </section>
    </main>
  ) : (
    <main className="auth-shell">
      <div className="theme-switch" role="group" aria-label="Tema da tela">
        <button
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
          type="button"
        >
          Escuro
        </button>
        <button
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
          type="button"
        >
          Claro
        </button>
      </div>
      <section className="form-panel">
        <div className="form-wrap">
          <>
              <div className="form-heading">
                <p className="eyebrow">{headingEyebrow}</p>
                <h2>{headingTitle}</h2>
                <p>{headingSubtitle}</p>
              </div>

              {screen === 'login' ? (
                <form className="auth-form" onSubmit={handleLogin}>
                  <label htmlFor="login-username">Usuário ou e-mail</label>
                  <input
                    autoComplete="username"
                    id="login-username"
                    name="username"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="seu.usuario ou email@exemplo.com"
                    required
                    value={username}
                  />
                  <label htmlFor="login-password">Senha</label>
                  <input
                    autoComplete="current-password"
                    id="login-password"
                    minLength={8}
                    name="password"
                    placeholder="Mínimo de 8 caracteres"
                    required
                    type="password"
                  />
                  <button
                    className="text-button auth-forgot-btn"
                    onClick={() => {
                      setScreen('forgot')
                      setForgotStep('email')
                      showMessage('')
                    }}
                    type="button"
                  >
                    Esqueci minha senha
                  </button>
                  <button className="submit-button" disabled={isLoading} type="submit">
                    {isLoading ? 'Entrando...' : 'Entrar'}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              ) : screen === 'register' ? (
                registerStep === 'form' ? (
                  <form className="auth-form register-form" onSubmit={handleRequestCompanyCode}>
                    <p className="auth-section-caption">Dados da Empresa</p>
                    <label htmlFor="req-registered-name">Razão Social *</label>
                    <input
                      defaultValue={companyDraft?.registeredCompanyName ?? ''}
                      id="req-registered-name"
                      minLength={2}
                      name="registeredCompanyName"
                      placeholder="Ex.: Empresa Alpha Serviços LTDA"
                      required
                    />
                    <div className="field-row">
                      <div className="field-group">
                        <label htmlFor="req-trade-name">Nome Fantasia *</label>
                        <input defaultValue={companyDraft?.tradeName ?? ''} id="req-trade-name" minLength={2} name="tradeName" placeholder="Ex.: Alpha Serviços" required />
                      </div>
                      <div className="field-group">
                        <label htmlFor="req-cnpj">CNPJ *</label>
                        <input defaultValue={companyDraft?.cnpj ?? ''} id="req-cnpj" maxLength={18} name="cnpj" placeholder="00.000.000/0000-00" required />
                      </div>
                    </div>
                    <label htmlFor="req-phone">Telefone da Empresa (Opcional)</label>
                    <input defaultValue={companyDraft?.phone ?? ''} id="req-phone" name="phone" placeholder="(11) 99999-9999" />

                    <p className="auth-section-caption">Administrador Responsável</p>
                    <div className="field-row">
                      <div className="field-group">
                        <label htmlFor="req-admin-name">Nome *</label>
                        <input autoComplete="given-name" defaultValue={companyDraft?.adminName ?? ''} id="req-admin-name" minLength={2} name="adminName" required />
                      </div>
                      <div className="field-group">
                        <label htmlFor="req-admin-surname">Sobrenome *</label>
                        <input autoComplete="family-name" defaultValue={companyDraft?.adminSurname ?? ''} id="req-admin-surname" minLength={2} name="adminSurname" required />
                      </div>
                    </div>
                    <label htmlFor="req-admin-email">E-mail do Administrador *</label>
                    <input autoComplete="email" defaultValue={companyDraft?.adminEmail ?? ''} id="req-admin-email" name="adminEmail" placeholder="admin@suaempresa.com" required type="email" />
                    <div className="field-row">
                      <div className="field-group">
                        <label htmlFor="req-admin-cpf">CPF *</label>
                        <input autoComplete="off" defaultValue={companyDraft?.adminCpf ?? ''} id="req-admin-cpf" inputMode="numeric" maxLength={14} name="adminCpf" placeholder="000.000.000-00" required />
                      </div>
                      <div className="field-group">
                        <label htmlFor="req-admin-password">Senha de Acesso *</label>
                        <input autoComplete="new-password" defaultValue={companyDraft?.adminPassword ?? ''} id="req-admin-password" minLength={8} name="adminPassword" placeholder="Mínimo 8 caracteres" required type="password" />
                      </div>
                    </div>
                    <label className="legal-consent-box">
                      <input defaultChecked={Boolean(companyDraft?.acceptedTerms)} name="acceptedLegal" required type="checkbox" />
                      <span>
                        Li e concordo com os{' '}
                        <button className="text-button" onClick={() => setLegalModalDoc('terms')} type="button">
                          Termos de Uso &amp; DPA
                        </button>{' '}
                        e a{' '}
                        <button className="text-button" onClick={() => setLegalModalDoc('privacy')} type="button">
                          Política de Privacidade (LGPD)
                        </button>.
                      </span>
                    </label>
                    <button className="submit-button" disabled={isLoading} type="submit">
                      {isLoading ? 'Enviando código...' : 'Enviar código para o e-mail'}
                      <span aria-hidden="true">→</span>
                    </button>
                  </form>
                ) : (
                  <form className="auth-form" onSubmit={handleSubmitCompanyRequest}>
                    <label htmlFor="register-code">Código de verificação (6 dígitos)</label>
                    <input
                      autoComplete="one-time-code"
                      className="auth-code-input"
                      id="register-code"
                      inputMode="numeric"
                      maxLength={6}
                      minLength={6}
                      onChange={(e) => setRegisterCode(e.target.value.replace(/\D/g, ''))}
                      pattern="\d{6}"
                      placeholder="000000"
                      required
                      value={registerCode}
                    />
                    <button className="submit-button" disabled={isLoading} type="submit">
                      {isLoading ? 'Enviando solicitação...' : 'Confirmar e enviar solicitação'}
                      <span aria-hidden="true">→</span>
                    </button>
                    <div className="auth-secondary-actions">
                      <button className="text-button" disabled={isLoading} onClick={() => void handleResendCompanyCode()} type="button">
                        Reenviar código
                      </button>
                      <button
                        className="text-button"
                        disabled={isLoading}
                        onClick={() => {
                          setRegisterStep('form')
                          showMessage('')
                        }}
                        type="button"
                      >
                        Alterar dados
                      </button>
                    </div>
                  </form>
                )
              ) : forgotStep === 'email' ? (
                <form className="auth-form" onSubmit={handleForgotSendCode}>
                  <label htmlFor="forgot-email">E-mail cadastrado</label>
                  <input
                    autoComplete="email"
                    defaultValue={forgotEmail}
                    id="forgot-email"
                    name="email"
                    placeholder="voce@empresa.com"
                    required
                    type="email"
                  />
                  <button className="submit-button" disabled={isLoading} type="submit">
                    {isLoading ? 'Enviando código...' : 'Enviar código'}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleResetPassword}>
                  <label htmlFor="reset-code">Código de 6 dígitos</label>
                  <input
                    autoComplete="one-time-code"
                    className="auth-code-input"
                    id="reset-code"
                    inputMode="numeric"
                    maxLength={6}
                    minLength={6}
                    name="code"
                    pattern="\d{6}"
                    placeholder="000000"
                    required
                  />
                  <label htmlFor="reset-new-password">Nova senha</label>
                  <input
                    autoComplete="new-password"
                    id="reset-new-password"
                    maxLength={100}
                    minLength={8}
                    name="newPassword"
                    placeholder="Mínimo de 8 caracteres"
                    required
                    type="password"
                  />
                  <label htmlFor="reset-confirm-password">Confirmar nova senha</label>
                  <input
                    autoComplete="new-password"
                    id="reset-confirm-password"
                    maxLength={100}
                    minLength={8}
                    name="confirmPassword"
                    placeholder="Repita a nova senha"
                    required
                    type="password"
                  />
                  <button className="submit-button" disabled={isLoading} type="submit">
                    {isLoading ? 'Redefinindo...' : 'Redefinir senha'}
                    <span aria-hidden="true">→</span>
                  </button>
                  <div className="auth-secondary-actions">
                    <button className="text-button" disabled={isLoading} onClick={() => void handleResendForgotCode()} type="button">
                      Reenviar código
                    </button>
                    <button
                      className="text-button"
                      disabled={isLoading}
                      onClick={() => {
                        setForgotStep('email')
                        showMessage('')
                      }}
                      type="button"
                    >
                      Alterar e-mail
                    </button>
                  </div>
                </form>
              )}

              <p className="switch-prompt">
                {screen === 'login'
                  ? 'Sua empresa quer usar o sistema?'
                  : screen === 'forgot'
                    ? 'Lembrou sua senha?'
                    : 'Sua empresa já tem acesso?'}{' '}
                <button
                  className="text-button"
                  onClick={() => {
                    if (screen === 'login') {
                      setScreen('register')
                      setRegisterStep('form')
                    } else {
                      setScreen('login')
                      setRegisterStep('form')
                      setForgotStep('email')
                    }
                    showMessage('')
                  }}
                  type="button"
                >
                  {screen === 'login' ? 'Solicitar cadastro' : 'Voltar para o login'}
                </button>
              </p>
          </>
          <p className="form-footnote">
            © 2026 PFM ·{' '}
            <button className="text-button footnote-link" onClick={() => setLegalModalDoc('privacy')} type="button">
              Política de Privacidade
            </button>{' '}
            ·{' '}
            <button className="text-button footnote-link" onClick={() => setLegalModalDoc('terms')} type="button">
              Termos de Uso
            </button>
            {dpoEmail ? ` · DPO: ${dpoEmail}` : ''}
          </p>
        </div>
      </section>
    </main>
  )}
      {legalModalDoc && (
        <LegalDocumentsModal
          initialDoc={legalModalDoc}
          onClose={() => setLegalModalDoc(null)}
        />
      )}
    </>
  )
}

export default App
