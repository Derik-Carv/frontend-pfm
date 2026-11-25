import { apiRequest } from './api'

export type LegalMetadata = {
  termsVersion: string
  privacyVersion: string
  dpo: {
    name: string
    email: string
  }
  fiscalRetentionYears: number
  otpRetentionHours: number
  rejectedRequestRetentionDays: number
  subprocessors: Array<{
    name: string
    purpose: string
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
}> {
  return apiRequest('/admin/lgpd/cleanup', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  })
}
