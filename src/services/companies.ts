import { apiRequest } from './api'

export type Company = {
  id: string
  registeredCompanyName: string
  tradeName: string
  cnpj?: string | null
  email?: string | null
  phone?: string | null
  motherId?: string | null
  active: boolean
}

export type CompaniesMeResponse = {
  message: string
  activeCompanyId?: string
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

export type CreateMotherPayload = {
  registeredCompanyName: string
  tradeName: string
  cnpj: string
  email?: string
  phone?: string
  admin?: {
    name: string
    surname: string
    cpf: string
    password: string
    username?: string
  }
}

export type UpdateCompanyPayload = {
  registeredCompanyName?: string
  tradeName?: string
  email?: string | null
  phone?: string | null
  active?: boolean
}

export type CompanyUser = {
  id: string
  name: string
  surname: string
  username: string
  cpf: string
  roleId: string
  roleName: 'company_admin' | 'manager' | 'finance' | 'observer' | 'colaborator' | string
  primaryCompanyId: string | null
  companyName?: string | null
  active: boolean
  passwordChangeRequired: boolean
  createdAt: string
}

export type CreateCompanyUserPayload = {
  name: string
  surname: string
  cpf: string
  password: string
  roleName: 'company_admin' | 'manager' | 'finance' | 'observer' | 'colaborator'
  companyId?: string
  username?: string
}

export type UpdateCompanyUserPayload = {
  name?: string
  surname?: string
  roleName?: 'company_admin' | 'manager' | 'finance' | 'observer' | 'colaborator'
  companyId?: string
  active?: boolean
  password?: string
}

export async function getMyCompanies(token: string): Promise<CompaniesMeResponse> {
  return apiRequest<CompaniesMeResponse>('/companies/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createMotherCompany(
  token: string,
  payload: CreateMotherPayload,
): Promise<{ message: string; company: Company; adminUser?: { id: string; username: string; role: string } }> {
  return apiRequest('/companies/mothers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function updateMotherCompany(
  token: string,
  id: string,
  payload: UpdateCompanyPayload,
): Promise<{ message: string; company: Company }> {
  return apiRequest(`/companies/mothers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function listBranches(token: string): Promise<{ message: string; companies: Company[] }> {
  return apiRequest('/companies/branches', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createBranch(
  token: string,
  motherId: string,
  payload: CreateBranchPayload,
): Promise<{ message: string; company: Company }> {
  return apiRequest<{ message: string; company: Company }>('/companies/branches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-company-id': motherId,
    },
    body: JSON.stringify(payload),
  })
}

export async function updateBranchCompany(
  token: string,
  id: string,
  payload: UpdateCompanyPayload,
): Promise<{ message: string; company: Company }> {
  return apiRequest(`/companies/branches/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function getCompanyUsers(token: string): Promise<{ message: string; users: CompanyUser[] }> {
  return apiRequest('/companies/users', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createCompanyUser(
  token: string,
  payload: CreateCompanyUserPayload,
): Promise<{ message: string; user: CompanyUser }> {
  return apiRequest('/companies/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function updateCompanyUser(
  token: string,
  id: string,
  payload: UpdateCompanyUserPayload,
): Promise<{ message: string; user: CompanyUser }> {
  return apiRequest(`/companies/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}
