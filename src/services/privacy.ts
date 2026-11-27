import { apiRequest } from './api'

export type LegalMetadata = {
  termsVersion: string
  privacyVersion: string
  controller: {
    name: string
    document: string | null
    address: string | null
    jurisdiction: string
    supportEmail: string
  }
  dpo: {
    name: string
    email: string
  }
  fiscalRetentionYears: number
  auditLogRetentionYears: number
  incidentRetentionYears: number
  incidentNotificationBusinessDays: number
  smallAgentNotificationBusinessDays: number
  otpRetentionHours: number
  rejectedRequestRetentionDays: number
  subprocessors: Array<{
    name: string
    purpose: string
    mechanism: string
  }>
}

export type PrivacyMeResponse = {
  user: {
    id: string
    name: string
    surname: string
    username: string
    email: string | null
    emailVerified: boolean
    cpfMasked: string
    role: string
    passwordChangeRequired?: boolean
    createdAt: string
    anonymizedAt: string | null
  }
  companies: Array<{
    id: string
    tradeName: string
    cnpj: string
    isMother: boolean
  }>
  legalAcceptances: Array<{
    id: string
    documentType: string
    documentVersion: string
    acceptedAt: string
  }>
  legalAcceptanceRequired: boolean
  legalMetadata: LegalMetadata
}

export type AuditLogItem = {
  id: string
  actorId: string | null
  actorRole: string | null
  companyId: string | null
  action: string
  targetTable: string | null
  targetId: string | null
  ipAddress: string | null
  statusCode: number | null
  createdAt: string
}

export type SecurityIncident = {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical' | string
  affectedDataCategories: string
  affectedSubjectsEstimate: number | null
  relevantRisk: boolean
  notifiedAnpd: boolean
  notifiedAnpdAt: string | null
  notifiedSubjects: boolean
  notifiedSubjectsAt: string | null
  containmentMeasures: string | null
  status: 'open' | 'mitigated' | 'closed' | string
  detectedAt: string
  reportedBy: string | null
  createdAt: string
  updatedAt: string
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function getPublicLegalMetadata(): Promise<LegalMetadata> {
  return apiRequest<LegalMetadata>('/public/legal', { method: 'GET' })
}

export async function getPrivacyMe(token: string): Promise<PrivacyMeResponse> {
  return apiRequest<PrivacyMeResponse>('/account/privacy/me', {
    method: 'GET',
    headers: authHeaders(token),
  })
}

export async function acceptLegalDocuments(token: string): Promise<{
  message: string
  legalAcceptanceRequired: boolean
  acceptedAt: string
}> {
  return apiRequest('/account/legal/accept', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      acceptedTerms: true,
      acceptedPrivacy: true,
    }),
  })
}

export async function updateMyProfile(
  token: string,
  payload: { name: string; surname: string },
): Promise<{
  message: string
  user: { id: string; name: string; surname: string }
}> {
  return apiRequest('/account/profile', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export async function exportMyPrivacyData(token: string): Promise<Record<string, unknown>> {
  return apiRequest('/account/privacy/export', {
    method: 'GET',
    headers: authHeaders(token),
  })
}

export async function anonymizeMyAccount(
  token: string,
  payload: { currentPassword: string; confirmation: 'ANONIMIZAR' },
): Promise<{
  message: string
  anonymizedAt: string
  fiscalRetentionNotice: string
}> {
  return apiRequest('/account/privacy/anonymize', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export async function anonymizeClient(
  token: string,
  clientId: string,
): Promise<{
  message: string
  id: string
  anonymizedAt: string
  fiscalRetentionNotice: string
}> {
  return apiRequest(`/clients/${clientId}/anonymize`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  })
}

export async function getAdminAuditLogs(
  token: string,
  params: { page?: number; limit?: number; action?: string } = {},
): Promise<{
  logs: AuditLogItem[]
  total: number
  page: number
  limit: number
}> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.action) qs.set('action', params.action)
  return apiRequest(`/admin/lgpd/audit-logs?${qs.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  })
}

export async function triggerLgpdCleanup(token: string): Promise<{
  message: string
  deletedOtpCodes: number
  scrubbedRequestHashes: number
  deletedRejectedRequests: number
  deletedExpiredAuditLogs: number
  deletedExpiredIncidents?: number
}> {
  return apiRequest('/admin/lgpd/cleanup', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  })
}

export async function getSecurityIncidents(token: string): Promise<{
  incidents: SecurityIncident[]
}> {
  return apiRequest('/admin/lgpd/incidents', {
    method: 'GET',
    headers: authHeaders(token),
  })
}

export async function createSecurityIncident(
  token: string,
  payload: {
    title: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    affectedDataCategories: string
    affectedSubjectsEstimate?: number
    relevantRisk: boolean
    notifiedAnpd: boolean
    notifiedSubjects: boolean
    containmentMeasures?: string
  },
): Promise<{
  message: string
  incident: SecurityIncident
}> {
  return apiRequest('/admin/lgpd/incidents', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export async function updateSecurityIncident(
  token: string,
  incidentId: string,
  payload: {
    status?: 'open' | 'mitigated' | 'closed'
    containmentMeasures?: string
    relevantRisk?: boolean
    notifiedAnpd?: boolean
    notifiedSubjects?: boolean
  },
): Promise<{
  message: string
  incident: SecurityIncident
}> {
  return apiRequest(`/admin/lgpd/incidents/${incidentId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}
