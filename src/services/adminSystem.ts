import { apiRequest } from './api'

export type SystemHealth = {
  status: 'healthy' | 'unhealthy' | string
  uptimeSeconds: number
  databaseConnection: boolean
  memoryUsageMb: number
  environment: string
}

export type SystemStats = {
  totalCompanies: number
  totalMothers: number
  totalBranches: number
  totalUsers: number
  totalClients: number
  totalServices: number
  totalNf: number
  estimatedDailyAccess: number
}

export type SystemMetricsResponse = {
  message: string
  data: {
    systemHealth: SystemHealth
    stats: SystemStats
  }
}

export type HierarchyBranch = {
  id: string
  tradeName: string
  cnpj?: string | null
  active?: boolean
  usersCount: number
  clientsCount: number
  servicesCount: number
}

export type HierarchyMother = {
  id: string
  registeredCompanyName: string
  tradeName: string
  cnpj?: string | null
  active: boolean
  branchesCount: number
  usersCount: number
  clientsCount: number
  servicesCount: number
  branches: HierarchyBranch[]
}

export type HierarchyResponse = {
  message: string
  mothers: HierarchyMother[]
}

export type AdminClient = {
  id: string
  registeredCompanyName: string
  tradeName: string
  cnpj?: string | null
  cpf?: string | null
  active: boolean
  createdAt?: string
}

export type AdminClientsResponse = {
  message: string
  companyId: string
  clients: AdminClient[]
}

export type CompanyRegistrationRequest = {
  id: string
  registeredCompanyName: string
  tradeName: string
  cnpj: string
  companyEmail?: string | null
  phone?: string | null
  adminName: string
  adminSurname: string
  adminEmail: string
  adminCpf: string
  status: 'pending' | 'approved' | 'rejected' | string
  rejectionReason?: string | null
  createdAt: string
}

export type CompanyRequestsResponse = {
  message: string
  requests: CompanyRegistrationRequest[]
}

export async function getSystemMetrics(token: string): Promise<SystemMetricsResponse> {
  return apiRequest<SystemMetricsResponse>('/admin/system/metrics', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getSystemHierarchy(token: string): Promise<HierarchyResponse> {
  return apiRequest<HierarchyResponse>('/admin/system/hierarchy', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getAdminCompanyClients(
  token: string,
  companyId: string,
): Promise<AdminClientsResponse> {
  return apiRequest<AdminClientsResponse>(`/admin/system/clients?companyId=${encodeURIComponent(companyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getCompanyRequests(
  token: string,
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
): Promise<CompanyRequestsResponse> {
  return apiRequest<CompanyRequestsResponse>(`/admin/company-requests?status=${encodeURIComponent(status)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function approveCompanyRequest(
  token: string,
  id: string,
): Promise<{
  message: string
  company: { id: string; tradeName: string }
  adminUser: { id: string; username: string; email: string; role: string }
}> {
  return apiRequest(`/admin/company-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function rejectCompanyRequest(
  token: string,
  id: string,
  reason: string,
): Promise<{ message: string }> {
  return apiRequest(`/admin/company-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  })
}
