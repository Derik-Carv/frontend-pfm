export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3336').replace(/\/$/, '')

// Chaves de persistência no localStorage para Multi-Tenant Hierárquico
export const STORAGE_COMPANY_KEY = 'pfm_selected_company_id'
export const STORAGE_VIEW_SCOPE_KEY = 'pfm_view_scope' // 'single' | 'consolidated'

export function getSelectedCompanyId(): string | null {
  return localStorage.getItem(STORAGE_COMPANY_KEY)
}

export function getViewScope(): 'single' | 'consolidated' {
  return (localStorage.getItem(STORAGE_VIEW_SCOPE_KEY) as 'single' | 'consolidated') || 'single'
}

export function setTenantContext(companyId: string, scope: 'single' | 'consolidated') {
  if (companyId) {
    localStorage.setItem(STORAGE_COMPANY_KEY, companyId)
  } else {
    localStorage.removeItem(STORAGE_COMPANY_KEY)
  }
  localStorage.setItem(STORAGE_VIEW_SCOPE_KEY, scope)
  window.dispatchEvent(new CustomEvent('pfm_tenant_change', { detail: { companyId, scope } }))
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly responseBody: unknown

  constructor(message: string, status: number, responseBody: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.responseBody = responseBody
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response

  try {
    const headers = new Headers(options.headers)
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    if (isFormData) {
      headers.delete('Content-Type')
    } else if (options.body != null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    // Injeção automática dos headers de contexto Multi-Tenant
    const companyId = getSelectedCompanyId()
    const viewScope = getViewScope()
    if (companyId && !headers.has('x-company-id')) {
      headers.set('x-company-id', companyId)
    }
    if (!headers.has('x-view-scope')) {
      headers.set('x-view-scope', viewScope)
    }

    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o backend está ativo.')
  }

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
        ? data.message
        : `A solicitação falhou (${response.status}).`
    throw new ApiRequestError(errorMessage, response.status, data)
  }

  return data as T
}

export async function apiFileRequest(path: string, token: string) {
  const headers = new Headers({ Authorization: `Bearer ${token}` })
  const companyId = getSelectedCompanyId()
  const viewScope = getViewScope()
  if (companyId) {
    headers.set('x-company-id', companyId)
  }
  headers.set('x-view-scope', viewScope)

  const response = await fetch(`${API_URL}${path}`, {
    headers,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
      ? data.message
      : `A solicitação falhou (${response.status}).`
    throw new ApiRequestError(message, response.status, data)
  }
  return response
}
