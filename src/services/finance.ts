import { apiFileRequest, apiRequest } from './api'

export type AccountType = 'checking' | 'savings' | 'cash' | 'gateway' | 'credit_card'
export type CategoryKind =
  | 'revenue'
  | 'deduction'
  | 'direct_cost'
  | 'operating_expense'
  | 'financial_result'
  | 'transfer'
export type EntryType = 'receivable' | 'payable'
export type EntryStatus =
  | 'draft'
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
export type PaymentMethod =
  | 'pix'
  | 'boleto'
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'other'

export interface FinancialAccount {
  id: string
  companyId: string
  name: string
  type: AccountType
  bankCode: string | null
  agencyMasked: string | null
  accountMasked: string | null
  initialBalanceCents: number
  initialBalanceDate: string
  currentBalanceCents: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface FinancialCategory {
  id: string
  companyId: string
  parentId: string | null
  code: string
  name: string
  kind: CategoryKind
  dreGroup: string | null
  isSystem: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CostCenter {
  id: string
  companyId: string
  code: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface FinanceCounterparty {
  id: string
  companyId: string | null
  tradeName: string
  registeredCompanyName: string
  document: string | null
}

export interface FinancialSettlement {
  id: string
  companyId: string
  entryId: string
  accountId: string
  accountName?: string | null
  settlementType: 'payment' | 'reversal'
  reversedSettlementId: string | null
  paymentMethod: PaymentMethod
  settledAt: string
  principalCents: number
  interestCents: number
  fineCents: number
  discountCents: number
  gatewayFeeCents: number
  totalSettledCents: number
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface FinancialEntry {
  id: string
  companyId: string
  entryType: EntryType
  status: EntryStatus
  description: string
  documentNumber: string | null
  notes: string | null
  clientId: string | null
  counterpartyName: string | null
  counterpartyDocument: string | null
  serviceId: string | null
  nfId: string | null
  categoryId: string
  categoryCode?: string | null
  categoryName?: string | null
  costCenterId: string | null
  costCenterName?: string | null
  competenceDate: string
  issueDate: string
  dueDate: string
  paidAt: string | null
  originalAmountCents: number
  discountCents: number
  interestCents: number
  fineCents: number
  netAmountCents: number
  settledAmountCents: number
  remainingAmountCents: number
  installmentNumber: number
  totalInstallments: number
  installmentGroupId: string | null
  isIntercompany: boolean
  counterpartyCompanyId: string | null
  createdBy: string
  cancelledBy: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

export interface CashflowSeriesItem {
  date: string
  realizedInflowCents: number
  realizedOutflowCents: number
  projectedInflowCents: number
  projectedOutflowCents: number
  netCents: number
}

export interface CashflowReport {
  message: string
  period: { from: string; to: string }
  summary: {
    currentAccountsBalanceCents: number
    realizedInflowCents: number
    realizedOutflowCents: number
    realizedNetCents: number
    projectedInflowCents: number
    projectedOutflowCents: number
    projectedNetCents: number
    overdueReceivablePriorCents: number
    overduePayablePriorCents: number
  }
  series: CashflowSeriesItem[]
}

export interface AgingBucket {
  upcomingCents: number
  overdue1to15Cents: number
  overdue16to30Cents: number
  overdue31to60Cents: number
  overdue61PlusCents: number
  totalOpenCents: number
  totalOverdueCents: number
  delinquencyRateBps: number
  openCount: number
  overdueCount: number
}

export interface AgingReport {
  message: string
  referenceDate: string
  receivable: AgingBucket
  payable: AgingBucket
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCentsBRL(cents: number): string {
  return brlFormatter.format(cents / 100)
}

export function formatDateBR(value?: string | null): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date)
}

/**
 * Converte entrada monetária ("1.250,50", "1250,50", "1250.50", "500")
 * para centavos inteiros via manipulação de string sem ponto flutuante binário.
 */
export function parseCurrencyInputToCents(raw: string, opts?: { allowNegative?: boolean }): number {
  const trimmed = raw.trim().replace(/\s+/g, '').replace(/^R\$\s?/i, '')
  if (!trimmed) {
    throw new Error('Informe um valor monetário válido.')
  }

  const isNegative = trimmed.startsWith('-')
  if (isNegative && !opts?.allowNegative) {
    throw new Error('Valor não pode ser negativo.')
  }

  const unsigned = isNegative ? trimmed.slice(1) : trimmed
  let normalized = unsigned

  if (unsigned.includes(',') && unsigned.includes('.')) {
    const lastComma = unsigned.lastIndexOf(',')
    const lastDot = unsigned.lastIndexOf('.')
    if (lastComma > lastDot) {
      normalized = unsigned.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = unsigned.replace(/,/g, '')
    }
  } else if (unsigned.includes(',')) {
    normalized = unsigned.replace(',', '.')
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!match) {
    throw new Error('Valor monetário inválido. Use até 2 casas decimais (ex.: 1250,50).')
  }

  const whole = Number(match[1])
  const frac = Number((match[2] ?? '').padEnd(2, '0'))
  const total = whole * 100 + frac

  if (!Number.isSafeInteger(total)) {
    throw new Error('Valor monetário fora do limite suportado.')
  }

  return isNegative ? -total : total
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pfm-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export function listFinancialAccounts(token: string) {
  return apiRequest<{
    message: string
    accounts: FinancialAccount[]
    totalBalanceCents: number
  }>('/finance/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createFinancialAccount(
  token: string,
  body: {
    name: string
    type: AccountType
    bankCode?: string | null
    agencyMasked?: string | null
    accountMasked?: string | null
    initialBalanceCents: number
    initialBalanceDate: string
  },
) {
  return apiRequest<{ message: string; account: FinancialAccount }>('/finance/accounts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function updateFinancialAccount(
  token: string,
  id: string,
  body: { name?: string; active?: boolean },
) {
  return apiRequest<{ message: string; account: FinancialAccount }>(`/finance/accounts/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function listFinancialCategories(token: string) {
  return apiRequest<{ message: string; categories: FinancialCategory[] }>('/finance/categories', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createFinancialCategory(
  token: string,
  body: { code: string; name: string; kind: CategoryKind; dreGroup?: string | null },
) {
  return apiRequest<{ message: string; category: FinancialCategory }>('/finance/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function listCostCenters(token: string) {
  return apiRequest<{ message: string; costCenters: CostCenter[] }>('/finance/cost-centers', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createCostCenter(
  token: string,
  body: { code: string; name: string },
) {
  return apiRequest<{ message: string; costCenter: CostCenter }>('/finance/cost-centers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function listFinanceCounterparties(token: string, search?: string, limit = 30) {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (search?.trim()) qs.set('search', search.trim())
  return apiRequest<{ message: string; counterparties: FinanceCounterparty[] }>(
    `/finance/counterparties?${qs.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
}

export function listFinancialEntries(
  token: string,
  params: {
    page?: number
    limit?: number
    entryType?: EntryType
    status?: EntryStatus
    categoryId?: string
    dueFrom?: string
    dueTo?: string
    search?: string
  },
) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.entryType) qs.set('entryType', params.entryType)
  if (params.status) qs.set('status', params.status)
  if (params.categoryId) qs.set('categoryId', params.categoryId)
  if (params.dueFrom) qs.set('dueFrom', params.dueFrom)
  if (params.dueTo) qs.set('dueTo', params.dueTo)
  if (params.search) qs.set('search', params.search)

  return apiRequest<{
    message: string
    entries: FinancialEntry[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(`/finance/entries?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getFinancialEntryDetail(token: string, id: string) {
  return apiRequest<{
    message: string
    entry: FinancialEntry
    settlements?: FinancialSettlement[]
  }>(`/finance/entries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createFinancialEntry(
  token: string,
  idempotencyKey: string,
  body: {
    entryType: EntryType
    status: 'draft' | 'pending'
    description: string
    documentNumber?: string | null
    notes?: string | null
    clientId: string
    categoryId: string
    costCenterId?: string | null
    competenceDate: string
    issueDate: string
    dueDate: string
    originalAmountCents: number
    discountCents: number
    interestCents: number
    fineCents: number
    totalInstallments: number
    installmentDueDay?: number | null
  },
) {
  return apiRequest<{ message: string; entries: FinancialEntry[]; warnings?: string[] }>(
    '/finance/entries',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    },
  )
}

export function createEntryFromService(
  token: string,
  serviceId: string,
  idempotencyKey: string,
  body: {
    categoryId?: string
    costCenterId?: string | null
    nfId?: string | null
    dueDate?: string
    competenceDate?: string
    totalInstallments: number
    installmentDueDay?: number | null
    description?: string
  },
) {
  return apiRequest<{ message: string; entries: FinancialEntry[]; warnings?: string[] }>(
    `/finance/entries/from-service/${serviceId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    },
  )
}

export function settleFinancialEntry(
  token: string,
  entryId: string,
  idempotencyKey: string,
  body: {
    accountId: string
    paymentMethod: PaymentMethod
    settledAt?: string
    principalCents: number
    interestCents: number
    fineCents: number
    discountCents: number
    gatewayFeeCents: number
    notes?: string | null
  },
) {
  return apiRequest<{
    message: string
    entry: FinancialEntry
    settlement: FinancialSettlement
    accountCurrentBalanceCents: number
  }>(`/finance/entries/${entryId}/settle`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
}

export function reverseFinancialSettlement(
  token: string,
  settlementId: string,
  idempotencyKey: string,
  body: { reason: string; settledAt?: string },
) {
  return apiRequest<{
    message: string
    entry: FinancialEntry
    settlement: FinancialSettlement
    accountCurrentBalanceCents: number
  }>(`/finance/settlements/${settlementId}/reverse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
}

export function cancelFinancialEntry(
  token: string,
  entryId: string,
  reason: string,
) {
  return apiRequest<{ message: string; entry: FinancialEntry }>(
    `/finance/entries/${entryId}/cancel`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    },
  )
}

export function getCashflowReport(
  token: string,
  params: { from: string; to: string },
) {
  const qs = new URLSearchParams({ from: params.from, to: params.to })
  return apiRequest<CashflowReport>(`/finance/reports/cashflow?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getAgingReport(token: string, referenceDate?: string) {
  const qs = new URLSearchParams()
  if (referenceDate) qs.set('referenceDate', referenceDate)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiRequest<AgingReport>(`/finance/reports/aging${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function downloadEntriesCsv(
  token: string,
  params: { from?: string; to?: string; entryType?: EntryType },
) {
  const qs = new URLSearchParams()
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.entryType) qs.set('entryType', params.entryType)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const response = await apiFileRequest(`/finance/reports/export${suffix}`, token)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'financeiro-export.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
