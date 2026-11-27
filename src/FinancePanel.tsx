import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest, ApiRequestError } from './services/api'
import { notifyError, notifySuccess, notifyWarning } from './services/toast'
import {
  cancelFinancialEntry,
  createCostCenter,
  createEntryFromService,
  createFinancialAccount,
  createFinancialCategory,
  createFinancialEntry,
  createIdempotencyKey,
  downloadEntriesCsv,
  formatCentsBRL,
  formatDateBR,
  getAgingReport,
  getCashflowReport,
  getFinancialEntryDetail,
  listCostCenters,
  listFinanceCounterparties,
  listFinancialAccounts,
  listFinancialCategories,
  listFinancialEntries,
  parseCurrencyInputToCents,
  reverseFinancialSettlement,
  settleFinancialEntry,
  updateFinancialAccount,
  type AccountType,
  type AgingBucket,
  type AgingReport,
  type CashflowReport,
  type CategoryKind,
  type CostCenter,
  type EntryStatus,
  type EntryType,
  type FinanceCounterparty,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialEntry,
  type FinancialSettlement,
  type PaymentMethod,
} from './services/finance'
import './FinancePanel.css'

type FinancePanelProps = {
  token: string
  role: string
  onLogout: () => void
}

type FinanceSubTab = 'summary' | 'entries' | 'structure'

type ServiceOption = {
  id: string
  serviceName: string
  price: string | number
  initialDate: string
  finishDate?: string | null
  clientId: string
}

type NfOption = {
  id: string
  numberNf: string | null
  totalValue: string
  servicesId: string
  active: boolean
}

const STATUS_LABELS: Record<EntryStatus, string> = {
  draft: 'Rascunho',
  pending: 'Em aberto',
  partially_paid: 'Parcial',
  paid: 'Liquidado',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  bank_transfer: 'Transferência (TED/DOC)',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  other: 'Outro',
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  cash: 'Caixa Físico',
  gateway: 'Carteira / Gateway',
  credit_card: 'Cartão Corporativo',
}

const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  revenue: 'Receita',
  deduction: 'Dedução / Imposto',
  direct_cost: 'Custo Direto',
  operating_expense: 'Despesa Operacional',
  financial_result: 'Resultado Financeiro',
  transfer: 'Transferência',
}

function getMonthBounds() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return {
    today: now.toISOString().slice(0, 10),
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function AgingCard({ title, bucket }: { title: string; bucket: AgingBucket }) {
  const maxVal = Math.max(
    bucket.upcomingCents,
    bucket.overdue1to15Cents,
    bucket.overdue16to30Cents,
    bucket.overdue31to60Cents,
    bucket.overdue61PlusCents,
    1,
  )
  const rows: Array<{ label: string; value: number; overdue: boolean }> = [
    { label: 'A vencer', value: bucket.upcomingCents, overdue: false },
    { label: '1–15d atraso', value: bucket.overdue1to15Cents, overdue: true },
    { label: '16–30d atraso', value: bucket.overdue16to30Cents, overdue: true },
    { label: '31–60d atraso', value: bucket.overdue31to60Cents, overdue: true },
    { label: '> 60d atraso', value: bucket.overdue61PlusCents, overdue: true },
  ]

  return (
    <article className="fin-panel">
      <div className="fin-card-top">
        <h3>{title}</h3>
        <span className="fin-badge">
          Inadimplência: {(bucket.delinquencyRateBps / 100).toFixed(2)}% ({bucket.overdueCount}/{bucket.openCount})
        </span>
      </div>
      <div className="fin-aging-bars">
        {rows.map((r) => (
          <div className="fin-aging-row" key={r.label}>
            <span>{r.label}</span>
            <div className="fin-aging-track">
              <div
                className={`fin-aging-fill ${r.overdue ? 'is-overdue' : ''}`}
                style={{ width: `${Math.round((r.value / maxVal) * 100)}%` }}
              />
            </div>
            <strong>{formatCentsBRL(r.value)}</strong>
          </div>
        ))}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--muted)' }}>
        Total em aberto: <strong>{formatCentsBRL(bucket.totalOpenCents)}</strong> · Total vencido:{' '}
        <strong>{formatCentsBRL(bucket.totalOverdueCents)}</strong>
      </p>
    </article>
  )
}

const setError = (msg: string) => {
  if (msg) notifyError(msg)
}
const setNotice = (msg: string) => {
  if (msg) notifySuccess(msg)
}
const setWarningNotice = (msg: string) => {
  if (msg) notifyWarning(msg)
}

export default function FinancePanel({ token, role, onLogout }: FinancePanelProps) {
  const canWrite = role === 'company_admin' || role === 'finance'
  const bounds = useMemo(() => getMonthBounds(), [])

  const [subTab, setSubTab] = useState<FinanceSubTab>('summary')
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  // Core data
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [totalBalanceCents, setTotalBalanceCents] = useState(0)
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [counterparties, setCounterparties] = useState<FinanceCounterparty[]>([])

  // Reports
  const [cashflowFrom, setCashflowFrom] = useState(bounds.from)
  const [cashflowTo, setCashflowTo] = useState(bounds.to)
  const [cashflow, setCashflow] = useState<CashflowReport | null>(null)
  const [aging, setAging] = useState<AgingReport | null>(null)

  // Entries list & filters
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [entriesPage, setEntriesPage] = useState(1)
  const [entriesTotalPages, setEntriesTotalPages] = useState(1)
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [filterType, setFilterType] = useState<'' | EntryType>('')
  const [filterStatus, setFilterStatus] = useState<'' | EntryStatus>('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Master-Detail expanded entry + settlements
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [entrySettlements, setEntrySettlements] = useState<Record<string, FinancialSettlement[]>>({})

  // Modals / forms state
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false)
  const [isFromServiceOpen, setIsFromServiceOpen] = useState(false)
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([])
  const [nfOptions, setNfOptions] = useState<NfOption[]>([])
  const [settlingEntry, setSettlingEntry] = useState<FinancialEntry | null>(null)
  const [reversingSettlement, setReversingSettlement] = useState<FinancialSettlement | null>(null)
  const [cancellingEntry, setCancellingEntry] = useState<FinancialEntry | null>(null)

  // Form fields - Account
  const [accName, setAccName] = useState('')
  const [accType, setAccType] = useState<AccountType>('checking')
  const [accBankCode, setAccBankCode] = useState('')
  const [accInitialBalance, setAccInitialBalance] = useState('0,00')
  const [accInitialDate, setAccInitialDate] = useState(bounds.today)

  // Form fields - Category
  const [catCode, setCatCode] = useState('')
  const [catName, setCatName] = useState('')
  const [catKind, setCatKind] = useState<CategoryKind>('operating_expense')

  // Form fields - Cost center
  const [ccCode, setCcCode] = useState('')
  const [ccName, setCcName] = useState('')

  // Form fields - New Entry
  const [entryType, setEntryType] = useState<EntryType>('receivable')
  const [entryDescription, setEntryDescription] = useState('')
  const [entryClientId, setEntryClientId] = useState('')
  const [entryClientSearch, setEntryClientSearch] = useState('')
  const [isQuickCostCenterOpen, setIsQuickCostCenterOpen] = useState(false)
  const [quickCcCode, setQuickCcCode] = useState('')
  const [quickCcName, setQuickCcName] = useState('')
  const [entryCategoryId, setEntryCategoryId] = useState('')
  const [entryCostCenterId, setEntryCostCenterId] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryAmountMode, setEntryAmountMode] = useState<'total' | 'installment'>('total')
  const [entryCompetenceDate, setEntryCompetenceDate] = useState(bounds.today)
  const [entryDueDate, setEntryDueDate] = useState(bounds.today)
  const [entryInstallments, setEntryInstallments] = useState('1')
  const [entryInstallmentDueDay, setEntryInstallmentDueDay] = useState('')

  // Form fields - From Service
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedNfId, setSelectedNfId] = useState('')
  const [fromServiceDueDate, setFromServiceDueDate] = useState(bounds.today)

  // Form fields - Settle
  const [settleAccountId, setSettleAccountId] = useState('')
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('pix')
  const [settlePrincipal, setSettlePrincipal] = useState('')
  const [settleInterest, setSettleInterest] = useState('0,00')
  const [settleFine, setSettleFine] = useState('0,00')
  const [settleDiscount, setSettleDiscount] = useState('0,00')
  const [settleFee, setSettleFee] = useState('0,00')
  const [settleNotes, setSettleNotes] = useState('')

  // Form fields - Reverse / Cancel
  const [actionReason, setActionReason] = useState('')

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiRequestError && err.status === 401) {
        onLogout()
        return
      }
      setError(err instanceof Error ? err.message : fallback)
    },
    [onLogout],
  )

  const loadCoreAndReports = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [accRes, catRes, ccRes, cfRes, agingRes] = await Promise.all([
        listFinancialAccounts(token),
        listFinancialCategories(token),
        listCostCenters(token),
        getCashflowReport(token, { from: cashflowFrom, to: cashflowTo }),
        getAgingReport(token),
      ])
      setAccounts(accRes.accounts)
      setTotalBalanceCents(accRes.totalBalanceCents)
      setCategories(catRes.categories)
      setCostCenters(ccRes.costCenters)
      setCashflow(cfRes)
      setAging(agingRes)
      if (catRes.categories.length > 0) {
        setEntryCategoryId((prev) => prev || catRes.categories[0].id)
      }
      const firstActive = accRes.accounts.find((a) => a.active)
      if (firstActive) {
        setSettleAccountId((prev) => prev || firstActive.id)
      }
    } catch (err) {
      handleApiError(err, 'Não foi possível carregar os dados financeiros.')
    } finally {
      setIsLoading(false)
    }
  }, [cashflowFrom, cashflowTo, handleApiError, token])

  const loadEntries = useCallback(async () => {
    try {
      const res = await listFinancialEntries(token, {
        page: entriesPage,
        limit: 15,
        ...(filterType ? { entryType: filterType } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
        ...(filterSearch.trim() ? { search: filterSearch.trim() } : {}),
      })
      setEntries(res.entries)
      setEntriesTotalPages(res.pagination.totalPages)
      setEntriesTotal(res.pagination.total)
    } catch (err) {
      handleApiError(err, 'Não foi possível carregar os títulos financeiros.')
    }
  }, [entriesPage, filterCategoryId, filterSearch, filterStatus, filterType, handleApiError, token])

  useEffect(() => {
    let active = true
    void Promise.all([
      listFinancialAccounts(token),
      listFinancialCategories(token),
      listCostCenters(token),
      getCashflowReport(token, { from: cashflowFrom, to: cashflowTo }),
      getAgingReport(token),
    ])
      .then(([accRes, catRes, ccRes, cfRes, agingRes]) => {
        if (!active) return
        setAccounts(accRes.accounts)
        setTotalBalanceCents(accRes.totalBalanceCents)
        setCategories(catRes.categories)
        setCostCenters(ccRes.costCenters)
        setCashflow(cfRes)
        setAging(agingRes)
        if (catRes.categories.length > 0) {
          setEntryCategoryId((prev) => prev || catRes.categories[0].id)
        }
        const firstActive = accRes.accounts.find((a) => a.active)
        if (firstActive) {
          setSettleAccountId((prev) => prev || firstActive.id)
        }
        setError('')
      })
      .catch((err) => {
        if (!active) return
        handleApiError(err, 'Não foi possível carregar os dados financeiros.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [cashflowFrom, cashflowTo, handleApiError, token])

  useEffect(() => {
    let active = true
    void listFinancialEntries(token, {
      page: entriesPage,
      limit: 15,
      ...(filterType ? { entryType: filterType } : {}),
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
      ...(filterSearch.trim() ? { search: filterSearch.trim() } : {}),
    })
      .then((res) => {
        if (!active) return
        setEntries(res.entries)
        setEntriesTotalPages(res.pagination.totalPages)
        setEntriesTotal(res.pagination.total)
      })
      .catch((err) => {
        if (!active) return
        handleApiError(err, 'Não foi possível carregar os títulos financeiros.')
      })
    return () => {
      active = false
    }
  }, [entriesPage, filterCategoryId, filterSearch, filterStatus, filterType, handleApiError, token])

  async function refreshEntryDetail(entryId: string) {
    try {
      const detail = await getFinancialEntryDetail(token, entryId)
      if (detail.settlements) {
        setEntrySettlements((prev) => ({ ...prev, [entryId]: detail.settlements ?? [] }))
      }
    } catch (err) {
      handleApiError(err, 'Não foi possível carregar as baixas do título.')
    }
  }

  function handleToggleExpand(entry: FinancialEntry) {
    if (expandedEntryId === entry.id) {
      setExpandedEntryId(null)
      return
    }
    setExpandedEntryId(entry.id)
    void refreshEntryDetail(entry.id)
  }

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const initialCents = parseCurrencyInputToCents(accInitialBalance, { allowNegative: true })
      const res = await createFinancialAccount(token, {
        name: accName.trim(),
        type: accType,
        bankCode: accBankCode.trim() || null,
        initialBalanceCents: initialCents,
        initialBalanceDate: accInitialDate,
      })
      setNotice(res.message)
      setAccName('')
      setAccBankCode('')
      setAccInitialBalance('0,00')
      await loadCoreAndReports()
    } catch (err) {
      handleApiError(err, 'Falha ao criar conta financeira.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleToggleAccountActive(acc: FinancialAccount) {
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const res = await updateFinancialAccount(token, acc.id, { active: !acc.active })
      setNotice(res.message)
      await loadCoreAndReports()
    } catch (err) {
      handleApiError(err, 'Falha ao atualizar status da conta.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const res = await createFinancialCategory(token, {
        code: catCode.trim(),
        name: catName.trim(),
        kind: catKind,
      })
      setNotice(res.message)
      setCatCode('')
      setCatName('')
      await loadCoreAndReports()
    } catch (err) {
      handleApiError(err, 'Falha ao criar categoria financeira.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleCreateCostCenter(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const res = await createCostCenter(token, {
        code: ccCode.trim(),
        name: ccName.trim(),
      })
      setNotice(res.message)
      setCcCode('')
      setCcName('')
      await loadCoreAndReports()
    } catch (err) {
      handleApiError(err, 'Falha ao criar centro de custo.')
    } finally {
      setIsMutating(false)
    }
  }

  useEffect(() => {
    if (!isNewEntryOpen) return
    let active = true
    const timer = window.setTimeout(() => {
      void listFinanceCounterparties(token, entryClientSearch, 30)
        .then((res) => {
          if (!active) return
          setCounterparties(res.counterparties)
          setEntryClientId((prev) => {
            if (prev && res.counterparties.some((c) => c.id === prev)) return prev
            return res.counterparties[0]?.id ?? ''
          })
        })
        .catch((err) => {
          if (!active) return
          handleApiError(err, 'Não foi possível carregar clientes/fornecedores cadastrados.')
        })
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [entryClientSearch, handleApiError, isNewEntryOpen, token])

  const entryInstallmentPreview = useMemo(() => {
    const n = Number.parseInt(entryInstallments, 10)
    if (!Number.isInteger(n) || n < 1 || n > 60) return null
    try {
      const inputCents = parseCurrencyInputToCents(entryAmount)
      if (inputCents <= 0) return null
      if (n === 1) {
        return `Lançamento único de ${formatCentsBRL(inputCents)} · Vencimento: ${formatDateBR(entryDueDate)}.`
      }

      const parsedDueDay = Number.parseInt(entryInstallmentDueDay, 10)
      let datesLabel = 'Defina o dia de vencimento no mês (1 a 31).'
      if (
        Number.isInteger(parsedDueDay) &&
        parsedDueDay >= 1 &&
        parsedDueDay <= 31 &&
        /^\d{4}-\d{2}-\d{2}$/.test(entryDueDate)
      ) {
        const [yStr, mStr] = entryDueDate.split('-')
        const startYear = Number(yStr)
        const startMonthIdx = Number(mStr) - 1
        const previewDates: string[] = []
        for (let idx = 0; idx < n; idx++) {
          const totalM = startYear * 12 + startMonthIdx + idx
          const ty = Math.floor(totalM / 12)
          const tm = ((totalM % 12) + 12) % 12
          const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
          const day = Math.min(parsedDueDay, lastDay)
          previewDates.push(
            `${String(day).padStart(2, '0')}/${String(tm + 1).padStart(2, '0')}/${ty}`,
          )
        }
        datesLabel =
          previewDates.length <= 4
            ? `Vencimentos: ${previewDates.join(', ')}`
            : `Vencimentos: ${previewDates.slice(0, 3).join(', ')} ... até ${previewDates[previewDates.length - 1]}`
      }

      if (entryAmountMode === 'installment') {
        const totalCents = inputCents * n
        return `Serão geradas ${n} parcelas de ${formatCentsBRL(inputCents)} · Total: ${formatCentsBRL(totalCents)} · ${datesLabel}`
      }
      const baseCents = Math.floor(inputCents / n)
      if (baseCents <= 0) {
        return 'Valor total muito baixo para a quantidade de parcelas.'
      }
      const remainder = inputCents % n
      if (remainder === 0) {
        return `Serão geradas ${n} parcelas de ${formatCentsBRL(baseCents)} · Total: ${formatCentsBRL(inputCents)} · ${datesLabel}`
      }
      return `1ª parcela de ${formatCentsBRL(baseCents + remainder)} + ${n - 1}x de ${formatCentsBRL(baseCents)} · Total: ${formatCentsBRL(inputCents)} · ${datesLabel}`
    } catch {
      return null
    }
  }, [entryAmount, entryAmountMode, entryDueDate, entryInstallmentDueDay, entryInstallments])

  async function handleQuickCreateCostCenter() {
    if (!quickCcCode.trim() || !quickCcName.trim()) {
      setError('Informe código e nome para o centro de custo.')
      return
    }
    setError('')
    setIsMutating(true)
    try {
      const res = await createCostCenter(token, {
        code: quickCcCode.trim(),
        name: quickCcName.trim(),
      })
      setCostCenters((prev) => [...prev, res.costCenter])
      setEntryCostCenterId(res.costCenter.id)
      setQuickCcCode('')
      setQuickCcName('')
      setIsQuickCostCenterOpen(false)
      setNotice(res.message)
    } catch (err) {
      handleApiError(err, 'Falha ao cadastrar centro de custo.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleCreateEntry(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setWarningNotice('')
    setIsMutating(true)
    try {
      if (!entryClientId) {
        throw new Error('Selecione um cliente/fornecedor já cadastrado.')
      }
      const inputCents = parseCurrencyInputToCents(entryAmount)
      if (inputCents <= 0) {
        throw new Error('O valor do título deve ser maior que zero.')
      }
      const installments = Number.parseInt(entryInstallments, 10) || 1
      let parsedInstallmentDueDay: number | null = null
      if (installments > 1) {
        parsedInstallmentDueDay = Number.parseInt(entryInstallmentDueDay, 10)
        if (
          !Number.isInteger(parsedInstallmentDueDay) ||
          parsedInstallmentDueDay < 1 ||
          parsedInstallmentDueDay > 31
        ) {
          throw new Error('Informe o dia do mês de vencimento (1 a 31) para lançamentos parcelados.')
        }
      }
      const totalAmountCents =
        entryAmountMode === 'installment' && installments > 1
          ? inputCents * installments
          : inputCents
      const res = await createFinancialEntry(token, createIdempotencyKey(), {
        entryType,
        status: 'pending',
        description: entryDescription.trim(),
        clientId: entryClientId,
        categoryId: entryCategoryId,
        costCenterId: entryCostCenterId || null,
        competenceDate: entryCompetenceDate,
        issueDate: bounds.today,
        dueDate: entryDueDate,
        originalAmountCents: totalAmountCents,
        discountCents: 0,
        interestCents: 0,
        fineCents: 0,
        totalInstallments: installments,
        ...(parsedInstallmentDueDay !== null ? { installmentDueDay: parsedInstallmentDueDay } : {}),
      })
      setNotice(res.message)
      if (res.warnings?.length) setWarningNotice(res.warnings.join(' | '))
      setIsNewEntryOpen(false)
      setEntryDescription('')
      setEntryClientSearch('')
      setEntryAmount('')
      setEntryAmountMode('total')
      setEntryInstallments('1')
      setEntryInstallmentDueDay('')
      setIsQuickCostCenterOpen(false)
      await Promise.all([loadEntries(), loadCoreAndReports()])
    } catch (err) {
      handleApiError(err, 'Falha ao lançar título financeiro.')
    } finally {
      setIsMutating(false)
    }
  }

  async function openFromServiceModal() {
    setError('')
    setIsFromServiceOpen(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [svcRes, notesRes] = await Promise.all([
        apiRequest<{ myServicesList: { list: ServiceOption[] } }>('/services/list?page=1&limit=50', { headers }),
        apiRequest<{ notes: NfOption[] }>('/notes?page=1&limit=50&status=active', { headers }).catch(() => ({ notes: [] })),
      ])
      const list = svcRes.myServicesList?.list ?? []
      setServiceOptions(list)
      setNfOptions(notesRes.notes ?? [])
      if (list.length > 0) setSelectedServiceId(list[0].id)
    } catch (err) {
      handleApiError(err, 'Falha ao carregar serviços para faturamento.')
    }
  }

  async function handleCreateFromService(e: FormEvent) {
    e.preventDefault()
    if (!selectedServiceId) return
    setError('')
    setNotice('')
    setWarningNotice('')
    setIsMutating(true)
    try {
      const res = await createEntryFromService(token, selectedServiceId, createIdempotencyKey(), {
        nfId: selectedNfId || null,
        dueDate: fromServiceDueDate,
        competenceDate: fromServiceDueDate,
        totalInstallments: 1,
      })
      setNotice(res.message)
      if (res.warnings?.length) setWarningNotice(res.warnings.join(' | '))
      setIsFromServiceOpen(false)
      setSelectedNfId('')
      await Promise.all([loadEntries(), loadCoreAndReports()])
    } catch (err) {
      handleApiError(err, 'Falha ao gerar título a partir do serviço.')
    } finally {
      setIsMutating(false)
    }
  }

  function openSettleModal(entry: FinancialEntry) {
    const firstActiveAcc = accounts.find((a) => a.active)
    setSettlingEntry(entry)
    setSettleAccountId(firstActiveAcc?.id ?? '')
    setSettleMethod('pix')
    setSettlePrincipal(centsToInputValue(entry.remainingAmountCents))
    setSettleInterest('0,00')
    setSettleFine('0,00')
    setSettleDiscount('0,00')
    setSettleFee('0,00')
    setSettleNotes('')
  }

  async function handleSettleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!settlingEntry) return
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const principalCents = parseCurrencyInputToCents(settlePrincipal)
      const interestCents = parseCurrencyInputToCents(settleInterest || '0')
      const fineCents = parseCurrencyInputToCents(settleFine || '0')
      const discountCents = parseCurrencyInputToCents(settleDiscount || '0')
      const gatewayFeeCents = parseCurrencyInputToCents(settleFee || '0')

      const res = await settleFinancialEntry(token, settlingEntry.id, createIdempotencyKey(), {
        accountId: settleAccountId,
        paymentMethod: settleMethod,
        principalCents,
        interestCents,
        fineCents,
        discountCents,
        gatewayFeeCents,
        notes: settleNotes.trim() || null,
      })
      setNotice(`${res.message} · Saldo atualizado: ${formatCentsBRL(res.accountCurrentBalanceCents)}`)
      const targetId = settlingEntry.id
      setSettlingEntry(null)
      await Promise.all([loadEntries(), loadCoreAndReports(), refreshEntryDetail(targetId)])
    } catch (err) {
      handleApiError(err, 'Falha ao registrar baixa financeira.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleReverseSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reversingSettlement) return
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const res = await reverseFinancialSettlement(
        token,
        reversingSettlement.id,
        createIdempotencyKey(),
        { reason: actionReason.trim() },
      )
      setNotice(`${res.message} · Saldo atualizado: ${formatCentsBRL(res.accountCurrentBalanceCents)}`)
      const targetEntryId = reversingSettlement.entryId
      setReversingSettlement(null)
      setActionReason('')
      await Promise.all([loadEntries(), loadCoreAndReports(), refreshEntryDetail(targetEntryId)])
    } catch (err) {
      handleApiError(err, 'Falha ao estornar baixa.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleCancelSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cancellingEntry) return
    setError('')
    setNotice('')
    setIsMutating(true)
    try {
      const res = await cancelFinancialEntry(token, cancellingEntry.id, actionReason.trim())
      setNotice(res.message)
      setCancellingEntry(null)
      setActionReason('')
      await Promise.all([loadEntries(), loadCoreAndReports()])
    } catch (err) {
      handleApiError(err, 'Falha ao cancelar título.')
    } finally {
      setIsMutating(false)
    }
  }

  async function handleExportCsv() {
    setError('')
    try {
      await downloadEntriesCsv(token, {
        ...(filterType ? { entryType: filterType } : {}),
      })
      setNotice('Exportação CSV sanitizada gerada com sucesso.')
    } catch (err) {
      handleApiError(err, 'Falha ao exportar relatório CSV.')
    }
  }

  return (
    <section className="fin-view" aria-label="Módulo Financeiro">
      <header className="fin-heading">
        <div>
          <p className="dashboard-card-index">GESTÃO FINANCEIRA · REGIME DE CAIXA E LIQUIDEZ</p>
          <h2>Painel Financeiro</h2>
          <p>
            Contas a pagar e receber, baixas imutáveis com estorno auditável, fluxo de caixa e aging de vencimentos.
          </p>
        </div>
        <div className="fin-heading-actions">
          {!canWrite && <span className="fin-badge">Modo somente leitura ({role})</span>}
          <button
            className="fin-btn"
            disabled={isLoading}
            onClick={() => {
              void loadCoreAndReports()
              void loadEntries()
            }}
            type="button"
          >
            ↻ Atualizar
          </button>
        </div>
      </header>

      <nav className="fin-subnav" role="tablist" aria-label="Seções do módulo financeiro">
        <button
          aria-selected={subTab === 'summary'}
          onClick={() => setSubTab('summary')}
          role="tab"
          type="button"
        >
          Fluxo de Caixa & Aging
        </button>
        <button
          aria-selected={subTab === 'entries'}
          onClick={() => setSubTab('entries')}
          role="tab"
          type="button"
        >
          Contas a Pagar / Receber ({entriesTotal})
        </button>
        <button
          aria-selected={subTab === 'structure'}
          onClick={() => setSubTab('structure')}
          role="tab"
          type="button"
        >
          Contas Bancárias, Categorias & Centros
        </button>
      </nav>

      {subTab === 'summary' && (
        <>
          <div className="fin-kpi-grid">
            <article className="fin-kpi-card">
              <small>Saldo Atual em Contas</small>
              <strong>{formatCentsBRL(cashflow?.summary.currentAccountsBalanceCents ?? totalBalanceCents)}</strong>
              <span>{accounts.filter((a) => a.active).length} conta(s) ativa(s)</span>
            </article>
            <article className="fin-kpi-card is-positive">
              <small>Entradas Realizadas</small>
              <strong>{formatCentsBRL(cashflow?.summary.realizedInflowCents ?? 0)}</strong>
              <span>Previsto no período: {formatCentsBRL(cashflow?.summary.projectedInflowCents ?? 0)}</span>
            </article>
            <article className="fin-kpi-card is-negative">
              <small>Saídas Realizadas</small>
              <strong>{formatCentsBRL(cashflow?.summary.realizedOutflowCents ?? 0)}</strong>
              <span>Previsto no período: {formatCentsBRL(cashflow?.summary.projectedOutflowCents ?? 0)}</span>
            </article>
            <article
              className={`fin-kpi-card ${(cashflow?.summary.realizedNetCents ?? 0) >= 0 ? 'is-positive' : 'is-negative'}`}
            >
              <small>Resultado Realizado</small>
              <strong>{formatCentsBRL(cashflow?.summary.realizedNetCents ?? 0)}</strong>
              <span>
                Atrasados anteriores: +{formatCentsBRL(cashflow?.summary.overdueReceivablePriorCents ?? 0)} / -
                {formatCentsBRL(cashflow?.summary.overduePayablePriorCents ?? 0)}
              </span>
            </article>
          </div>

          <section className="fin-panel is-accent">
            <div className="fin-section-heading">
              <h3>Fluxo de Caixa Diário</h3>
              <div className="fin-actions-row" style={{ marginTop: 0 }}>
                <label style={{ fontSize: 12 }}>
                  De{' '}
                  <input
                    onChange={(e) => setCashflowFrom(e.target.value)}
                    type="date"
                    value={cashflowFrom}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Até{' '}
                  <input
                    onChange={(e) => setCashflowTo(e.target.value)}
                    type="date"
                    value={cashflowTo}
                  />
                </label>
              </div>
            </div>

            {cashflow && cashflow.series.length > 0 ? (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Entrada Realizada</th>
                      <th>Saída Realizada</th>
                      <th>Entrada Prevista</th>
                      <th>Saída Prevista</th>
                      <th>Saldo do Dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashflow.series.map((item) => (
                      <tr key={item.date}>
                        <td>{formatDateBR(item.date)}</td>
                        <td>{formatCentsBRL(item.realizedInflowCents)}</td>
                        <td>{formatCentsBRL(item.realizedOutflowCents)}</td>
                        <td>{formatCentsBRL(item.projectedInflowCents)}</td>
                        <td>{formatCentsBRL(item.projectedOutflowCents)}</td>
                        <td><strong>{formatCentsBRL(item.netCents)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: '14px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                Nenhuma movimentação realizada ou prevista nesta janela.
              </p>
            )}
          </section>

          {aging && (
            <div className="fin-grid-2">
              <AgingCard bucket={aging.receivable} title="Aging — Contas a Receber" />
              <AgingCard bucket={aging.payable} title="Aging — Contas a Pagar" />
            </div>
          )}
        </>
      )}

      {subTab === 'entries' && (
        <section className="fin-panel is-accent">
          <div className="fin-section-heading">
            <h3>Títulos Financeiros</h3>
            {canWrite && (
              <div className="fin-actions-row" style={{ marginTop: 0 }}>
                <button
                  className="fin-btn is-primary"
                  onClick={() => setIsNewEntryOpen(true)}
                  type="button"
                >
                  + Novo Título
                </button>
                <button
                  className="fin-btn"
                  onClick={() => void openFromServiceModal()}
                  type="button"
                >
                  Gerar de Serviço
                </button>
                <button
                  className="fin-btn"
                  onClick={() => void handleExportCsv()}
                  type="button"
                >
                  Exportar CSV
                </button>
              </div>
            )}
          </div>

          <div className="fin-form-grid">
            <label>
              Tipo
              <select
                onChange={(e) => {
                  setFilterType(e.target.value as '' | EntryType)
                  setEntriesPage(1)
                }}
                value={filterType}
              >
                <option value="">Todos</option>
                <option value="receivable">A Receber</option>
                <option value="payable">A Pagar</option>
              </select>
            </label>
            <label>
              Situação
              <select
                onChange={(e) => {
                  setFilterStatus(e.target.value as '' | EntryStatus)
                  setEntriesPage(1)
                }}
                value={filterStatus}
              >
                <option value="">Todas</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select
                onChange={(e) => {
                  setFilterCategoryId(e.target.value)
                  setEntriesPage(1)
                }}
                value={filterCategoryId}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Buscar descrição / documento
              <input
                onChange={(e) => {
                  setFilterSearch(e.target.value)
                  setEntriesPage(1)
                }}
                placeholder="Ex.: Mensalidade, NF 102..."
                type="search"
                value={filterSearch}
              />
            </label>
          </div>

          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor Líquido</th>
                  <th>Em Aberto</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      Nenhum título encontrado para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const isExpanded = expandedEntryId === entry.id
                    const settlements = entrySettlements[entry.id] ?? []
                    const reversedIds = new Set(
                      settlements
                        .filter((s) => s.reversedSettlementId)
                        .map((s) => s.reversedSettlementId as string),
                    )
                    const canSettle =
                      canWrite &&
                      entry.status !== 'paid' &&
                      entry.status !== 'cancelled' &&
                      entry.status !== 'draft'
                    const canCancel =
                      canWrite &&
                      entry.settledAmountCents === 0 &&
                      entry.status !== 'paid' &&
                      entry.status !== 'cancelled'

                    return (
                      <Fragment key={entry.id}>
                        <tr
                          className="is-clickable"
                          onClick={() => handleToggleExpand(entry)}
                        >
                          <td>
                            <span className={`fin-badge is-${entry.entryType}`}>
                              {entry.entryType === 'receivable' ? 'A Receber' : 'A Pagar'}
                            </span>
                          </td>
                          <td>
                            <strong>{entry.description}</strong>
                            {entry.categoryName && (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {entry.categoryCode} · {entry.categoryName}
                              </div>
                            )}
                          </td>
                          <td>{formatDateBR(entry.dueDate)}</td>
                          <td>{formatCentsBRL(entry.netAmountCents)}</td>
                          <td>{formatCentsBRL(entry.remainingAmountCents)}</td>
                          <td>
                            <span className={`fin-badge is-${entry.status}`}>
                              {STATUS_LABELS[entry.status]}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="fin-detail-row">
                            <td colSpan={6}>
                              <div className="fin-detail-grid">
                                <div>
                                  <small>Competência</small>
                                  <span>{formatDateBR(entry.competenceDate)}</span>
                                </div>
                                <div>
                                  <small>Emissão</small>
                                  <span>{formatDateBR(entry.issueDate)}</span>
                                </div>
                                <div>
                                  <small>Contraparte</small>
                                  <span>{entry.counterpartyName || '—'}</span>
                                </div>
                                <div>
                                  <small>Parcela / Liquidado</small>
                                  <span>
                                    {entry.installmentNumber}/{entry.totalInstallments} ·{' '}
                                    {formatCentsBRL(entry.settledAmountCents)}
                                  </span>
                                </div>
                              </div>

                              {entry.cancelReason && (
                                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--danger-text)' }}>
                                  Motivo do cancelamento: {entry.cancelReason}
                                </p>
                              )}

                              <div className="fin-actions-row">
                                {canSettle && (
                                  <button
                                    className="fin-btn is-primary"
                                    onClick={() => openSettleModal(entry)}
                                    type="button"
                                  >
                                    Registrar Baixa
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    className="fin-btn is-danger"
                                    onClick={() => {
                                      setCancellingEntry(entry)
                                      setActionReason('')
                                    }}
                                    type="button"
                                  >
                                    Cancelar Título
                                  </button>
                                )}
                              </div>

                              <div style={{ marginTop: 14 }}>
                                <strong style={{ fontSize: 12 }}>Histórico de Baixas e Estornos (Imutável)</strong>
                                {settlements.length === 0 ? (
                                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                                    Nenhuma movimentação registrada ainda para este título.
                                  </p>
                                ) : (
                                  <div className="fin-settlement-list">
                                    {settlements.map((s) => {
                                      const alreadyReversed = reversedIds.has(s.id)
                                      return (
                                        <div className="fin-settlement-item" key={s.id}>
                                          <div>
                                            <strong>
                                              {s.settlementType === 'reversal' ? '↩ ESTORNO' : '✓ BAIXA'} ·{' '}
                                              {formatCentsBRL(s.totalSettledCents)}
                                            </strong>{' '}
                                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                              (Principal {formatCentsBRL(s.principalCents)} · Taxa{' '}
                                              {formatCentsBRL(s.gatewayFeeCents)} · {PAYMENT_METHOD_LABELS[s.paymentMethod]} ·{' '}
                                              {s.accountName ?? 'Conta'} · {formatDateBR(s.settledAt)})
                                            </span>
                                            {s.notes && (
                                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.notes}</div>
                                            )}
                                          </div>
                                          {canWrite && s.settlementType === 'payment' && !alreadyReversed && (
                                            <button
                                              className="fin-btn is-danger"
                                              onClick={() => {
                                                setReversingSettlement(s)
                                                setActionReason('')
                                              }}
                                              type="button"
                                            >
                                              Estornar
                                            </button>
                                          )}
                                          {alreadyReversed && (
                                            <span className="fin-badge is-cancelled">Estornada</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="fin-actions-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Página {entriesPage} de {entriesTotalPages} ({entriesTotal} título(s))
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="fin-btn"
                disabled={entriesPage <= 1}
                onClick={() => setEntriesPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                Anterior
              </button>
              <button
                className="fin-btn"
                disabled={entriesPage >= entriesTotalPages}
                onClick={() => setEntriesPage((p) => p + 1)}
                type="button"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      )}

      {subTab === 'structure' && (
        <>
          <section className="fin-panel is-accent">
            <h3>Contas Financeiras e Caixas</h3>
            <div className="fin-cards-grid">
              {accounts.map((acc) => (
                <article className="fin-account-card" key={acc.id}>
                  <div className="fin-card-top">
                    <strong>{acc.name}</strong>
                    <span className={`fin-badge ${acc.active ? 'is-paid' : 'is-cancelled'}`}>
                      {acc.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {ACCOUNT_TYPE_LABELS[acc.type]} {acc.bankCode ? `· Banco ${acc.bankCode}` : ''}
                  </span>
                  <strong style={{ fontSize: 20 }}>{formatCentsBRL(acc.currentBalanceCents)}</strong>
                  {canWrite && (
                    <button
                      className="fin-btn"
                      disabled={isMutating}
                      onClick={() => void handleToggleAccountActive(acc)}
                      type="button"
                    >
                      {acc.active ? 'Desativar Conta' : 'Reativar Conta'}
                    </button>
                  )}
                </article>
              ))}
            </div>

            {canWrite && (
              <form className="fin-form-grid" onSubmit={(e) => void handleCreateAccount(e)} style={{ marginTop: 20 }}>
                <label className="fin-span-2">
                  Nome da Nova Conta
                  <input
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Ex.: Banco Inter PJ Matriz"
                    required
                    value={accName}
                  />
                </label>
                <label>
                  Tipo
                  <select onChange={(e) => setAccType(e.target.value as AccountType)} value={accType}>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Código Banco (opcional)
                  <input onChange={(e) => setAccBankCode(e.target.value)} placeholder="Ex.: 077" value={accBankCode} />
                </label>
                <label>
                  Saldo Inicial (R$)
                  <input onChange={(e) => setAccInitialBalance(e.target.value)} required value={accInitialBalance} />
                </label>
                <label>
                  Data do Saldo Inicial
                  <input
                    onChange={(e) => setAccInitialDate(e.target.value)}
                    required
                    type="date"
                    value={accInitialDate}
                  />
                </label>
                <div className="fin-span-2" style={{ display: 'flex', alignItems: 'end' }}>
                  <button className="fin-btn is-primary" disabled={isMutating} type="submit">
                    + Cadastrar Conta
                  </button>
                </div>
              </form>
            )}
          </section>

          <div className="fin-grid-2">
            <section className="fin-panel">
              <h3>Plano de Categorias ({categories.length})</h3>
              <div className="fin-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nome</th>
                      <th>Natureza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td><strong>{cat.code}</strong></td>
                        <td>
                          {cat.name}{' '}
                          {cat.isSystem && <span className="fin-badge">Padrão</span>}
                        </td>
                        <td>{CATEGORY_KIND_LABELS[cat.kind]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canWrite && (
                <form className="fin-inline-form" onSubmit={(e) => void handleCreateCategory(e)} style={{ marginTop: 14 }}>
                  <label>
                    Código
                    <input onChange={(e) => setCatCode(e.target.value)} placeholder="Ex.: 3.04" required value={catCode} />
                  </label>
                  <label>
                    Natureza
                    <select onChange={(e) => setCatKind(e.target.value as CategoryKind)} value={catKind}>
                      {Object.entries(CATEGORY_KIND_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="fin-span-2">
                    Nome da Categoria
                    <input onChange={(e) => setCatName(e.target.value)} placeholder="Ex.: Viagens e Hospedagem" required value={catName} />
                  </label>
                  <button className="fin-btn is-primary" disabled={isMutating} type="submit">
                    + Adicionar Categoria
                  </button>
                </form>
              )}
            </section>

            <section className="fin-panel">
              <h3>Centros de Custo ({costCenters.length})</h3>
              <div className="fin-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nome</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costCenters.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ color: 'var(--muted)' }}>
                          Nenhum centro de custo cadastrado.
                        </td>
                      </tr>
                    ) : (
                      costCenters.map((cc) => (
                        <tr key={cc.id}>
                          <td><strong>{cc.code}</strong></td>
                          <td>{cc.name}</td>
                          <td>{cc.active ? 'Ativo' : 'Inativo'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {canWrite && (
                <form className="fin-inline-form" onSubmit={(e) => void handleCreateCostCenter(e)} style={{ marginTop: 14 }}>
                  <label>
                    Código
                    <input onChange={(e) => setCcCode(e.target.value)} placeholder="Ex.: CC-01" required value={ccCode} />
                  </label>
                  <label>
                    Nome
                    <input onChange={(e) => setCcName(e.target.value)} placeholder="Ex.: Operações Cloud" required value={ccName} />
                  </label>
                  <button className="fin-btn is-primary" disabled={isMutating} type="submit">
                    + Adicionar Centro de Custo
                  </button>
                </form>
              )}
            </section>
          </div>
        </>
      )}

      {/* Modal: Novo Título */}
      {isNewEntryOpen && (
        <div className="fin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Novo Título Financeiro">
          <div className="fin-modal">
            <h3>Novo Título Financeiro</h3>
            <form className="fin-inline-form" onSubmit={(e) => void handleCreateEntry(e)}>
              <label>
                Tipo
                <select onChange={(e) => setEntryType(e.target.value as EntryType)} value={entryType}>
                  <option value="receivable">A Receber</option>
                  <option value="payable">A Pagar</option>
                </select>
              </label>
              <label>
                Categoria
                <select onChange={(e) => setEntryCategoryId(e.target.value)} required value={entryCategoryId}>
                  {categories.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                  ))}
                </select>
              </label>
              <label className="fin-span-2">
                Descrição
                <input
                  onChange={(e) => setEntryDescription(e.target.value)}
                  placeholder="Ex.: Assinatura Plano Pro - Cliente X"
                  required
                  value={entryDescription}
                />
              </label>
              <label>
                Buscar Cliente / Fornecedor
                <input
                  onChange={(e) => setEntryClientSearch(e.target.value)}
                  placeholder="Filtrar por nome ou CNPJ/CPF..."
                  type="search"
                  value={entryClientSearch}
                />
              </label>
              <label>
                Cliente / Fornecedor cadastrado *
                <select
                  onChange={(e) => setEntryClientId(e.target.value)}
                  required
                  value={entryClientId}
                >
                  {counterparties.length === 0 ? (
                    <option value="">Nenhum cadastro encontrado</option>
                  ) : (
                    counterparties.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.tradeName} {c.document ? `(${c.document})` : ''}
                      </option>
                    ))
                  )}
                </select>
                {counterparties.length === 0 && (
                  <span className="fin-helper-note">
                    Cadastre clientes/fornecedores primeiro na aba Clientes.
                  </span>
                )}
              </label>
              <label className="fin-span-2">
                <span className="fin-label-header">
                  <span>Centro de Custo</span>
                  <button
                    className="fin-link-btn"
                    onClick={() => setIsQuickCostCenterOpen((v) => !v)}
                    type="button"
                  >
                    {isQuickCostCenterOpen ? 'Fechar novo centro' : '+ Novo centro de custo'}
                  </button>
                </span>
                <select onChange={(e) => setEntryCostCenterId(e.target.value)} value={entryCostCenterId}>
                  <option value="">Nenhum</option>
                  {costCenters.filter((cc) => cc.active).map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.code} · {cc.name}</option>
                  ))}
                </select>
              </label>
              {isQuickCostCenterOpen && (
                <div className="fin-quick-box fin-span-2">
                  <label>
                    Código
                    <input
                      onChange={(e) => setQuickCcCode(e.target.value)}
                      placeholder="Ex.: CC-01"
                      value={quickCcCode}
                    />
                  </label>
                  <label>
                    Nome do Centro de Custo
                    <input
                      onChange={(e) => setQuickCcName(e.target.value)}
                      placeholder="Ex.: Operações IA / Cloud"
                      value={quickCcName}
                    />
                  </label>
                  <button
                    className="fin-btn is-primary"
                    disabled={isMutating}
                    onClick={() => void handleQuickCreateCostCenter()}
                    type="button"
                  >
                    Salvar Centro
                  </button>
                </div>
              )}
              <label className="fin-span-2">
                Como deseja informar o valor?
                <select
                  onChange={(e) => setEntryAmountMode(e.target.value as 'total' | 'installment')}
                  value={entryAmountMode}
                >
                  <option value="total">Valor Total (divide automaticamente entre as parcelas)</option>
                  <option value="installment">Valor da Parcela (repete este valor em cada parcela)</option>
                </select>
              </label>
              <label>
                {entryAmountMode === 'installment' && Number(entryInstallments) > 1
                  ? 'Valor da Parcela (R$)'
                  : 'Valor Total (R$)'}
                <input
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="Ex.: 600,00"
                  required
                  value={entryAmount}
                />
              </label>
              <label>
                Parcelas
                <input
                  max={60}
                  min={1}
                  onChange={(e) => setEntryInstallments(e.target.value)}
                  required
                  type="number"
                  value={entryInstallments}
                />
              </label>
              {Number(entryInstallments) > 1 && (
                <label className="fin-span-2">
                  Dia do Mês de Vencimento das Parcelas (1 a 31) *
                  <input
                    max={31}
                    min={1}
                    onChange={(e) => setEntryInstallmentDueDay(e.target.value)}
                    placeholder="Ex.: 10 (ajustado ao último dia em meses mais curtos)"
                    required
                    type="number"
                    value={entryInstallmentDueDay}
                  />
                </label>
              )}
              {entryInstallmentPreview && (
                <div className="fin-installment-preview fin-span-2" role="status">
                  {entryInstallmentPreview}
                </div>
              )}
              <label>
                Data de Competência
                <input
                  onChange={(e) => setEntryCompetenceDate(e.target.value)}
                  required
                  type="date"
                  value={entryCompetenceDate}
                />
              </label>
              <label>
                {Number(entryInstallments) > 1 ? 'Mês/Data Base da 1ª Parcela' : 'Data de Vencimento'}
                <input
                  onChange={(e) => setEntryDueDate(e.target.value)}
                  required
                  type="date"
                  value={entryDueDate}
                />
              </label>
              <div className="fin-actions-row fin-span-2" style={{ justifyContent: 'end' }}>
                <button className="fin-btn" onClick={() => setIsNewEntryOpen(false)} type="button">Cancelar</button>
                <button className="fin-btn is-primary" disabled={isMutating} type="submit">Lançar Título</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerar de Serviço */}
      {isFromServiceOpen && (
        <div className="fin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Gerar Título de Serviço">
          <div className="fin-modal">
            <h3>Gerar Conta a Receber de Serviço</h3>
            <form className="fin-inline-form" onSubmit={(e) => void handleCreateFromService(e)}>
              <label className="fin-span-2">
                Serviço
                <select
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                  value={selectedServiceId}
                >
                  {serviceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.serviceName} (R$ {String(s.price)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="fin-span-2">
                Nota Fiscal Vinculada (opcional)
                <select onChange={(e) => setSelectedNfId(e.target.value)} value={selectedNfId}>
                  <option value="">Sem vínculo direto com NF</option>
                  {nfOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      NF {n.numberNf || 'S/N'} · R$ {n.totalValue}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fin-span-2">
                Vencimento
                <input
                  onChange={(e) => setFromServiceDueDate(e.target.value)}
                  required
                  type="date"
                  value={fromServiceDueDate}
                />
              </label>
              <div className="fin-actions-row fin-span-2" style={{ justifyContent: 'end' }}>
                <button className="fin-btn" onClick={() => setIsFromServiceOpen(false)} type="button">Cancelar</button>
                <button className="fin-btn is-primary" disabled={isMutating || !selectedServiceId} type="submit">
                  Gerar Título
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Baixa */}
      {settlingEntry && (
        <div className="fin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Registrar Baixa Financeira">
          <div className="fin-modal">
            <h3>Registrar Baixa — {settlingEntry.description}</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
              Saldo em aberto: <strong>{formatCentsBRL(settlingEntry.remainingAmountCents)}</strong>
            </p>
            <form className="fin-inline-form" onSubmit={(e) => void handleSettleSubmit(e)}>
              <label>
                Conta Financeira
                <select onChange={(e) => setSettleAccountId(e.target.value)} required value={settleAccountId}>
                  {accounts.filter((a) => a.active).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCentsBRL(a.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Meio de Pagamento
                <select onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)} value={settleMethod}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Principal Amortizado (R$)
                <input onChange={(e) => setSettlePrincipal(e.target.value)} required value={settlePrincipal} />
              </label>
              <label>
                Taxa de Gateway / Banco (R$)
                <input onChange={(e) => setSettleFee(e.target.value)} value={settleFee} />
              </label>
              <label>
                Juros (R$)
                <input onChange={(e) => setSettleInterest(e.target.value)} value={settleInterest} />
              </label>
              <label>
                Multa (R$)
                <input onChange={(e) => setSettleFine(e.target.value)} value={settleFine} />
              </label>
              <label>
                Desconto Concedido (R$)
                <input onChange={(e) => setSettleDiscount(e.target.value)} value={settleDiscount} />
              </label>
              <label>
                Observação (opcional)
                <input onChange={(e) => setSettleNotes(e.target.value)} value={settleNotes} />
              </label>
              <div className="fin-actions-row fin-span-2" style={{ justifyContent: 'end' }}>
                <button className="fin-btn" onClick={() => setSettlingEntry(null)} type="button">Cancelar</button>
                <button className="fin-btn is-primary" disabled={isMutating || !settleAccountId} type="submit">
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Estornar Baixa */}
      {reversingSettlement && (
        <div className="fin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Estornar Baixa">
          <div className="fin-modal">
            <h3>Estornar Baixa</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13 }}>
              Será gerado um lançamento contábil/financeiro inverso de{' '}
              <strong>{formatCentsBRL(reversingSettlement.totalSettledCents)}</strong> (modelo append-only).
            </p>
            <form onSubmit={(e) => void handleReverseSubmit(e)}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>
                Motivo do estorno (obrigatório, mín. 5 caracteres)
                <textarea
                  minLength={5}
                  onChange={(e) => setActionReason(e.target.value)}
                  required
                  value={actionReason}
                />
              </label>
              <div className="fin-actions-row" style={{ justifyContent: 'end' }}>
                <button className="fin-btn" onClick={() => setReversingSettlement(null)} type="button">Fechar</button>
                <button className="fin-btn is-danger" disabled={isMutating} type="submit">Confirmar Estorno</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancelar Título */}
      {cancellingEntry && (
        <div className="fin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Cancelar Título">
          <div className="fin-modal">
            <h3>Cancelar Título — {cancellingEntry.description}</h3>
            <form onSubmit={(e) => void handleCancelSubmit(e)}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>
                Justificativa do cancelamento (mín. 5 caracteres)
                <textarea
                  minLength={5}
                  onChange={(e) => setActionReason(e.target.value)}
                  required
                  value={actionReason}
                />
              </label>
              <div className="fin-actions-row" style={{ justifyContent: 'end' }}>
                <button className="fin-btn" onClick={() => setCancellingEntry(null)} type="button">Fechar</button>
                <button className="fin-btn is-danger" disabled={isMutating} type="submit">Confirmar Cancelamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
