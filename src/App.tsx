import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from './services/api'
import Dashboard from './Dashboard'
import './App.css'

type Screen = 'login' | 'register'
type Theme = 'dark' | 'light'

type RegisterResponse = {
  message: string
  user: { username: string }
}

function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('theme') === 'light' ? 'light' : 'dark',
  )
  const [screen, setScreen] = useState<Screen>('login')
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(() => localStorage.getItem('passwordChangeRequired') === 'true')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  function showMessage(text: string, error = false) {
    setMessage(text)
    setIsError(error)
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const loginUsername = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    try {
      const result = await apiRequest<{ message: string; token: string; passwordChangeRequired: boolean }>(
        '/public/login',
        {
          method: 'POST',
          body: JSON.stringify({ username: loginUsername, password }),
        },
      )
      localStorage.setItem('token', result.token)
      setToken(result.token)
      setUsername(loginUsername)
      setPasswordChangeRequired(result.passwordChangeRequired)
      localStorage.setItem('passwordChangeRequired', String(result.passwordChangeRequired))
      showMessage(result.passwordChangeRequired
        ? 'Por segurança, defina uma nova senha antes de acessar o painel.'
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

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    showMessage('')

    const formData = new FormData(event.currentTarget)
    const registration = {
      name: String(formData.get('name') ?? '').trim(),
      surname: String(formData.get('surname') ?? '').trim(),
      username: String(formData.get('username') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      cpf: String(formData.get('cpf') ?? '').trim(),
    }

    try {
      const result = await apiRequest<RegisterResponse>('/public/register', {
        method: 'POST',
        body: JSON.stringify(registration),
      })
      setUsername(result.user.username)
      setScreen('login')
      showMessage(`Conta criada. Seu usuário para entrar é ${result.user.username}.`)
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Não foi possível criar a conta.',
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
      await apiRequest<{ message: string; passwordChangeRequired: boolean }>(
        '/account/password',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      )
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
    localStorage.removeItem('token')
    localStorage.removeItem('passwordChangeRequired')
    setToken(null)
    setPasswordChangeRequired(false)
    setScreen('login')
    showMessage('Você saiu da sua conta.')
  }, [])

  return token && !passwordChangeRequired ? (
    <Dashboard onLogout={handleLogout} onThemeChange={setTheme} theme={theme} token={token} />
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
          {message && <p className={`form-message${isError ? ' is-error' : ''}`} role="status">{message}</p>}
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
                <p className="eyebrow">{screen === 'login' ? 'BEM-VINDO DE VOLTA' : 'COMECE POR AQUI'}</p>
                <h2>{screen === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h2>
                <p>{screen === 'login' ? 'Acesse seu espaço financeiro.' : 'Leva só alguns instantes.'}</p>
              </div>

              {screen === 'login' ? (
                <form className="auth-form" onSubmit={handleLogin}>
                  <label htmlFor="login-username">Usuário</label>
                  <input
                    autoComplete="username"
                    id="login-username"
                    name="username"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="seu.usuario"
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
                  <button className="submit-button" disabled={isLoading} type="submit">
                    {isLoading ? 'Entrando...' : 'Entrar'}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              ) : (
                <form className="auth-form register-form" onSubmit={handleRegister}>
                  <div className="field-row">
                    <div className="field-group">
                      <label htmlFor="register-name">Nome</label>
                      <input autoComplete="given-name" id="register-name" maxLength={100} minLength={2} name="name" required />
                    </div>
                    <div className="field-group">
                      <label htmlFor="register-surname">Sobrenome</label>
                      <input autoComplete="family-name" id="register-surname" maxLength={100} minLength={2} name="surname" required />
                    </div>
                  </div>
                  <label htmlFor="register-username">Usuário</label>
                  <input autoComplete="username" id="register-username" maxLength={50} minLength={3} name="username" placeholder="seu.usuario" required />
                  <label htmlFor="register-cpf">CPF</label>
                  <input autoComplete="off" id="register-cpf" inputMode="numeric" maxLength={14} name="cpf" placeholder="000.000.000-00" required />
                  <label htmlFor="register-password">Senha</label>
                  <input autoComplete="new-password" id="register-password" maxLength={50} minLength={8} name="password" placeholder="Mínimo de 8 caracteres" required type="password" />
                  <button className="submit-button" disabled={isLoading} type="submit">
                    {isLoading ? 'Criando conta...' : 'Criar conta'}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              )}

              {message && (
                <p className={`form-message${isError ? ' is-error' : ''}`} role="status">
                  {message}
                </p>
              )}

              <p className="switch-prompt">
                {screen === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'}{' '}
                <button
                  className="text-button"
                  onClick={() => {
                    setScreen(screen === 'login' ? 'register' : 'login')
                    showMessage('')
                  }}
                  type="button"
                >
                  {screen === 'login' ? 'Cadastre-se' : 'Fazer login'}
                </button>
              </p>
          </>
          <p className="form-footnote">© 2026 Derik Flash · Suas informações são tratadas com cuidado.</p>
        </div>
      </section>
    </main>
  )
}

export default App