export type ToastVariant = 'error' | 'warning' | 'success' | 'info'

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  details?: string[]
}

type ToastListener = (items: ToastItem[]) => void

const MAX_TOASTS = 5
const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  error: null,
  warning: 9000,
  success: 5500,
  info: 5500,
}

let toasts: ToastItem[] = []
const listeners = new Set<ToastListener>()
const timers = new Map<string, number>()

function emit() {
  for (const listener of listeners) {
    listener(toasts)
  }
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => {
    listeners.delete(listener)
  }
}

export function dismissToast(id: string) {
  const timerId = timers.get(id)
  if (timerId !== undefined) {
    window.clearTimeout(timerId)
    timers.delete(id)
  }
  const next = toasts.filter((item) => item.id !== id)
  if (next.length !== toasts.length) {
    toasts = next
    emit()
  }
}

export function clearToasts(variant?: ToastVariant) {
  for (const item of toasts) {
    if (!variant || item.variant === variant) {
      const timerId = timers.get(item.id)
      if (timerId !== undefined) {
        window.clearTimeout(timerId)
        timers.delete(item.id)
      }
    }
  }
  toasts = variant ? toasts.filter((item) => item.variant !== variant) : []
  emit()
}

function pushToast(variant: ToastVariant, message: string, details?: string[]) {
  const cleanMessage = message.trim()
  if (!cleanMessage) return

  const cleanDetails = details?.map((d) => d.trim()).filter(Boolean)
  const existing = toasts.find(
    (item) =>
      item.variant === variant &&
      item.message === cleanMessage &&
      JSON.stringify(item.details ?? []) === JSON.stringify(cleanDetails ?? []),
  )

  if (existing) {
    dismissToast(existing.id)
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const nextItem: ToastItem = {
    id,
    variant,
    message: cleanMessage,
    ...(cleanDetails && cleanDetails.length > 0 ? { details: cleanDetails } : {}),
  }

  const updated = [nextItem, ...toasts]
  if (updated.length > MAX_TOASTS) {
    const removed = updated.slice(MAX_TOASTS)
    for (const item of removed) {
      const timerId = timers.get(item.id)
      if (timerId !== undefined) {
        window.clearTimeout(timerId)
        timers.delete(item.id)
      }
    }
  }
  toasts = updated.slice(0, MAX_TOASTS)
  emit()

  const ttl = AUTO_DISMISS_MS[variant]
  if (ttl !== null && typeof window !== 'undefined') {
    const timerId = window.setTimeout(() => {
      dismissToast(id)
    }, ttl)
    timers.set(id, timerId)
  }
}

export function notifyError(message: string, details?: string[]) {
  pushToast('error', message, details)
}

export function notifyWarning(message: string, details?: string[]) {
  pushToast('warning', message, details)
}

export function notifySuccess(message: string) {
  pushToast('success', message)
}

export function notifyInfo(message: string) {
  pushToast('info', message)
}
