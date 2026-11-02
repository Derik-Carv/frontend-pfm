export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3336').replace(/\/$/, '')

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
    } else if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
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
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
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
