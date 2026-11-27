import { useEffect, useState } from 'react'
import { dismissToast, subscribeToasts, type ToastItem, type ToastVariant } from './services/toast'
import './ToastNotifications.css'

const VARIANT_LABELS: Record<ToastVariant, string> = {
  error: 'Erro',
  warning: 'Atenção',
  success: 'Sucesso',
  info: 'Informação',
}

const VARIANT_ICONS: Record<ToastVariant, string> = {
  error: '!',
  warning: '⚠',
  success: '✓',
  info: 'i',
}

export function ToastNotifications() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToasts(setItems)
  }, [])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pfm-toast-stack"
      role="region"
      aria-label="Avisos e notificações do sistema"
    >
      {items.map((item) => (
        <div
          className={`pfm-toast is-${item.variant}`}
          key={item.id}
          role={item.variant === 'error' || item.variant === 'warning' ? 'alert' : 'status'}
        >
          <span className="pfm-toast-icon" aria-hidden="true">
            {VARIANT_ICONS[item.variant]}
          </span>
          <div className="pfm-toast-body">
            <strong className="pfm-toast-title">{VARIANT_LABELS[item.variant]}</strong>
            <p className="pfm-toast-message">{item.message}</p>
            {item.details && item.details.length > 0 && (
              <ul className="pfm-toast-details">
                {item.details.map((detail, idx) => (
                  <li key={`${item.id}-${idx}`}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            aria-label="Fechar aviso"
            className="pfm-toast-close"
            onClick={() => dismissToast(item.id)}
            title="Fechar aviso"
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
