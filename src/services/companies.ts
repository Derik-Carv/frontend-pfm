import { apiRequest } from './api'

export type Company = {
  id: string
  registeredCompanyName: string
  tradeName: string
  cnpj?: string | null
  motherId?: string | null
  active: boolean
}

export type CompaniesMeResponse = {
  message: string
  activeCompanyId: string
  isMother: boolean
  isConsolidated: boolean
  companies: Company[]
}

export type CreateBranchPayload = {
  registeredCompanyName: string
  tradeName: string
  cnpj: string
  email?: string
  phone?: string
}

export async function getMyCompanies(token: string): Promise<CompaniesMeResponse> {
  return apiRequest<CompaniesMeResponse>('/companies/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createBranch(
  token: string,
  motherId: string,
  payload: CreateBranchPayload,
): Promise<{ message: string; branch: Company }> {
  return apiRequest<{ message: string; branch: Company }>('/companies/branches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-company-id': motherId,
    },
    body: JSON.stringify(payload),
  })
}
