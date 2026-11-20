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
